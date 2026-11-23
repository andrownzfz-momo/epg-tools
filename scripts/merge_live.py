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
# 来源：tvbox.shenzjd.com 导航站 ok 源筛出（2026-11-22 检测），去镜像留直连。
SOURCES = [
    # --- 综合 IPTV 大合集 ---
    "https://raw.githubusercontent.com/fanmingming/live/main/tv/m3u/index.m3u",
    "https://raw.githubusercontent.com/Guovin/iptv-api/gd/output/result.m3u",
    "https://raw.githubusercontent.com/Guovin/iptv-api/gd/output/ipv4/result.m3u",
    "https://raw.githubusercontent.com/Kimentanm/aptv/master/m3u/iptv.m3u",
    "https://raw.githubusercontent.com/suxuang/myIPTV/main/ipv4.m3u",
    "https://raw.githubusercontent.com/YanG-1989/m3u/main/Gather.m3u",
    "https://raw.githubusercontent.com/vinkerq/iptv-api/refs/heads/master/iptv.txt",
    "https://raw.githubusercontent.com/xJEYDAin/iptv/main/output/all_merged.m3u",
    "https://raw.githubusercontent.com/yoursmile66/TVBox/main/live.txt",
    "https://raw.githubusercontent.com/gaotianliuyun/gao/master/list.txt",
    "https://raw.githubusercontent.com/mlzlzj/TV/main/output/result.m3u",
    "https://raw.githubusercontent.com/gambiarras/legal-iptv/refs/heads/main/playlist.m3u",
    "https://raw.githubusercontent.com/develop202/migu_video/refs/heads/main/interface.txt",
    "https://raw.githubusercontent.com/zhoujck/config/main/ext/live.txt",
    "https://raw.githubusercontent.com/807080747/zv/refs/heads/main/sese.txt",
    "https://raw.githubusercontent.com/807080747/zv/refs/heads/main/suale.txt",
    "https://raw.githubusercontent.com/bang359/dsj/raw/main/dsjcs.txt",
    "https://raw.githubusercontent.com/Wirili/IPTV/main/live.txt",
    "https://raw.githubusercontent.com/Supprise0901/TVBox_live/main/live.txt",
    "https://raw.githubusercontent.com/lubin776/tvbox/refs/heads/main/xuexiji/lib/live.txt",
    "https://raw.githubusercontent.com/lubin776/tvbox/refs/heads/main/xuexiji/lib/ipv6.m3u",
    "https://raw.githubusercontent.com/fafa002/yf2025/refs/heads/main/yiyifafa.txt",
    "https://raw.githubusercontent.com/wujiangliu/live-sources/refs/heads/main/%E5%85%A8%E7%90%83%E7%9B%B4%E6%92%AD.m3u",
    "https://raw.githubusercontent.com/wujiangliu/live-sources/refs/heads/main/bhmb.m3u",
    "https://gitee.com/OscarWilde/itv/raw/master/tv.txt",
    "https://live.fanmingming.cn/tv/m3u/ipv6.m3u",
    # --- 站点直连台单 ---
    "http://fmys.top/lib/live.m3u",
    "http://fmys.top/lib/yidong.m3u",
    "https://clun.top/lib/iptv.m3u",
    "http://iptv.ruyitv.cc/m3u/tv.txt",
    "http://tv123.vvvv.ee/tv.m3u",
    "https://cdn.qd.je/live.m3u",
    "https://www.xn--rgv465a.top/live/Daily.txt",
    "https://live.zbds.top/tv/iptv4.txt",
    "http://xhztv.top/xhz/live.txt",
    "https://szyyds.cn/tv/live/x.txt",
    "https://ztha.top/TVBox/tv/thtv.txt",
    "https://ztha.top/TVBox/lib/iptv.m3u",
    "https://ztha.top/TVBox/lib/interface.txt",
    "https://ztha.top/TVBox/lib/fwc.m3u",
    "https://epg.pw/test_channels_taiwan.m3u",
    "http://xtvantsc.xyz/%E6%96%B0%E5%8A%A0%E5%9D%A1.m3u",
    # --- 平台直播（445569 家族）---
    "https://iptv.445569.xyz/live.m3u",
    "https://douyin.445569.xyz/live.m3u",
    "https://kuaishou.445569.xyz/list.m3u",
    "https://douyu.445569.xyz/live.m3u",
    "https://yahu.445569.xyz/live.m3u",
    "https://kugou.445569.xyz/live.m3u",
    "https://laifeng.445569.xyz/live.m3u",
    "https://tiktok.445569.xyz/live.m3u",
    # --- 一起看 / 轮播 / 体育 ---
    "https://ztha.top/TVBox/lib/huyayqk.m3u",
    "https://ztha.top/TVBox/lib/douyuyqk.m3u",
    "https://ztha.top/TVBox/lib/bililive.m3u",
    "https://ztha.top/TVBox/lib/yylunbo.m3u",
    "https://jsnzkpg.de5.net/all.m3u",
    "https://stymei.pages.dev/live.m3u",
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


# 单组频道上限：防止 Undefined/General 这类无名大组把台单撑到 TVBox 卡死。
GROUP_CAP = 200
# 少于该数量的碎组直接丢弃（原始导航站里 1000+ 组多数是 1~4 条的噪声）。
GROUP_MIN = 2


def dump(groups, order, path):
    lines = []
    kept_groups = 0
    total = 0
    for g in order:
        items = groups[g]
        if len(items) < GROUP_MIN:
            continue
        lines.append(f"{g},#genre#")
        for name, url in items[:GROUP_CAP]:
            lines.append(f"{name},{url}")
        kept_groups += 1
        total += min(len(items), GROUP_CAP)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    return kept_groups, total


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
    n_groups, n = dump(groups, order, os.path.join(OUT_DIR, "all.txt"))
    print(f"[done] {n_groups} groups, {n} channels -> live/all.txt")


if __name__ == "__main__":
    main()
