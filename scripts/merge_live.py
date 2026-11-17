#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
直播源合并脚本。

抓取公开直播源（流媒体频道，txt/m3u 自动识别）+ 本地网页台单（docs/live/wtv.txt）
-> 按组去重合并 -> 输出 docs/live/all.txt。

由 GitHub Actions 定时调用（跟随 update-epg），零服务器。
"""

import os
import re
import sys

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "docs", "live")
WTV_FILE = os.path.join(OUT_DIR, "wtv.txt")
UA = {"User-Agent": "Mozilla/5.0 (compatible; epg-tools/1.0)"}

# 远程流媒体直播源。单个源失效会被跳过，不影响整体。
SOURCES = [
    "https://raw.githubusercontent.com/fanmingming/live/main/tv/m3u/index.m3u",
    "https://raw.githubusercontent.com/Guovin/iptv-api/gd/output/result.m3u",
]

_GROUP_TITLE_RE = re.compile(r'group-title="([^"]*)"')


def fetch(url):
    r = requests.get(url, headers=UA, timeout=30)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    return r.text


def _add(groups, order, group, name, url):
    group = group or "其他"
    name = name.strip()
    url = url.strip()
    if not name or not url:
        return
    if group not in groups:
        groups[group] = []
        order.append(group)
    if not any(n == name for n, _ in groups[group]):
        groups[group].append((name, url))


def parse_txt(content, groups, order):
    """TVBox txt：分组行 `名,#genre#`，频道行 `名,地址[#地址…]`。"""
    current = None
    for raw in content.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.endswith(",#genre#"):
            current = line[: -len(",#genre#")].strip()
            if current and current not in order:
                order.append(current)
                groups[current] = []
            continue
        if current is None or "," not in line:
            continue
        name, _, url = line.partition(",")
        _add(groups, order, current, name, url)


def parse_m3u(content, groups, order):
    """m3u：#EXTINF 取 tvg-name/group-title，下一非注释行为地址。"""
    pending = None
    for raw in content.splitlines():
        line = raw.strip()
        if not line or line.startswith("#EXTINF"):
            if line.startswith("#EXTINF"):
                m = _GROUP_TITLE_RE.search(line)
                group = m.group(1).strip() if m else ""
                title = line.rsplit(",", 1)[-1].strip()
                pending = (group, title)
            continue
        if line.startswith("#"):
            continue
        if pending:
            _add(groups, order, pending[0], pending[1], line)
            pending = None


def looks_like_html(content):
    head = content[:300].lstrip().lower()
    return head.startswith("<!doctype") or head.startswith("<html") or head.startswith("<!--")


def parse_auto(content, groups, order, url):
    if looks_like_html(content):
        raise ValueError("anti-bot html page")
    head = content[:500]
    if "#extm3u" in head.lower() or url.lower().endswith(".m3u"):
        parse_m3u(content, groups, order)
    else:
        parse_txt(content, groups, order)


def dump(groups, order, path):
    lines = []
    for g in order:
        lines.append(f"{g},#genre#")
        for name, url in groups[g]:
            lines.append(f"{name},{url}")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    return sum(len(groups[g]) for g in order)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    groups = {}
    order = []
    for url in SOURCES:
        try:
            parse_auto(fetch(url), groups, order, url)
            print(f"[ok] {url}")
        except Exception as e:  # noqa: BLE001
            print(f"[skip] {url}: {e}", file=sys.stderr)
    # 网页台单最后追加（WebView 容器播放）
    with open(WTV_FILE, encoding="utf-8") as f:
        parse_txt(f.read(), groups, order)
    n = dump(groups, order, os.path.join(OUT_DIR, "all.txt"))
    print(f"[done] {len(order)} groups, {n} channels -> live/all.txt")


if __name__ == "__main__":
    main()
