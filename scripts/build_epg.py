#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EPG 聚合主脚本。

抓取公开 XMLTV 源 -> 频道名标准化（繁转简/去修饰/字典匹配）-> 合并去重
-> 输出 docs/epg.xml 与 docs/epg.xml.gz。

由 GitHub Actions 定时调用，零服务器。
"""

import gzip
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

import requests
from opencc import OpenCC

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "docs")
DICT_FILE = os.path.join(ROOT, "scripts", "channels.json")
UA = {"User-Agent": "Mozilla/5.0 (compatible; epg-tools/1.0)"}

# 公开 EPG 源（XMLTV）。单个源失效会被跳过，不影响整体。
SOURCES = [
    "http://epg.51zmt.top:8000/e.xml",
    "https://raw.githubusercontent.com/fanmingming/live/main/e.xml",
    "https://epg.pw/xmltv.xml",
]

# 单个频道最多保留的节目条数（防止某些源输出爆炸）
MAX_PROGS_PER_CHANNEL = 4000

CC = OpenCC("hk2s")

GROUP_RULES = [
    ("央视", ["CCTV", "央视", "中央", "CGTN"]),
    ("卫视", ["卫视"]),
    ("北京", ["BTV", "北京"]),
    ("港澳台", [
        "翡翠", "明珠", "民视", "台视", "华视", "TVB", "纬来", "年代", "原住民",
        "中视", "澳亚", "东森", "好消息电视台", "大爱", "博斯", "ELEVEN", "FOX",
        "ASTRO", "HBO", "NIPPON", "NHK", "GSTV", "无线", "凤凰",
    ]),
]

REGION_RE = re.compile(
    r"北京|上海|NEWTV|IHOT|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|"
    r"湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾|香港|重庆"
)

_HAN_RE = re.compile(r"^[\u4e00-\u9fff]")


def load_dict():
    with open(DICT_FILE, encoding="utf-8") as f:
        return [x for x in json.load(f) if x]


def sanitize(name):
    """复刻前端转换器的频道名清洗管线。"""
    n = CC.convert((name or "").strip())
    n = n.upper()
    n = re.sub(r"\[[^\]]*\]", "", n)                      # [xx] 修饰
    n = re.sub(r"\b(8M|1080P|60FPS|FHD|HEVC|HDR|SD)\b", "", n)
    n = re.sub(r"(超清|高清|蓝光|标清|频道)$", "", n)
    n = re.sub(r"[-\s]+", "", n)
    # CCTV 频道规范化：去 4K/8K 后缀，保留 5+/4美洲/4欧洲
    n = re.sub(r"CCTV[-\s]*([0-9]{1,2}[+]?)[48]?K?", r"CCTV\1", n, flags=re.I)
    n = n.replace("BTV", "北京")
    return n.strip()


def _lcs(a, b):
    """最长公共子串长度。"""
    if not a or not b:
        return 0
    prev = [0] * (len(b) + 1)
    best = 0
    for i in range(1, len(a) + 1):
        cur = [0] * (len(b) + 1)
        ai = a[i - 1]
        for j in range(1, len(b) + 1):
            if ai == b[j - 1]:
                cur[j] = prev[j - 1] + 1
                if cur[j] > best:
                    best = cur[j]
        prev = cur
    return best


def match_tvg(name, dict_names):
    """四级匹配：精确 -> 汉字前缀 -> 任意前缀 -> 最长公共子串。"""
    n = sanitize(name)
    if not n:
        return "未知频道"
    for d in dict_names:                       # 1 精确（字典已统一为大写/简体）
        if n == d.upper():
            return d
    for d in dict_names:                       # 2 汉字前缀
        if n.startswith(d.upper()) and _HAN_RE.match(d):
            return d
    for d in dict_names:                       # 3 任意前缀
        if n.startswith(d.upper()):
            return d
    best, best_len = None, 0                   # 4 最长公共子串回退
    for d in dict_names:
        l = _lcs(n, d.upper())
        if l > best_len:
            best, best_len = d, l
    if best and best_len >= 2:
        return best
    return "未知频道"


def group_of(name):
    """分组：省市名优先，其次关键词。"""
    n = sanitize(name)
    m = REGION_RE.search(n)
    if m:
        return m.group(0)
    for g, kws in GROUP_RULES:
        if any(k in n for k in kws):
            return g
    return "其他"


def fetch(url):
    r = requests.get(url, headers=UA, timeout=30)
    r.raise_for_status()
    return r.content


def build():
    os.makedirs(OUT_DIR, exist_ok=True)
    dict_names = load_dict()
    channels = {}  # std -> {"display": std, "progs": {key: (start,stop,title,desc)}}

    for url in SOURCES:
        try:
            root = ET.fromstring(fetch(url))
        except Exception as e:  # noqa: BLE001
            print(f"[skip] {url}: {e}", file=sys.stderr)
            continue
        id_map = {}
        for ch in root.findall("channel"):
            cid = ch.get("id")
            raw = (ch.findtext("display-name") or cid or "").strip()
            if not raw or not cid:
                continue
            id_map[cid] = match_tvg(raw, dict_names)
        n_prog = 0
        for p in root.findall("programme"):
            std = id_map.get(p.get("channel"))
            if not std:
                continue
            entry = channels.setdefault(std, {"display": std, "progs": {}})
            start = p.get("start") or ""
            stop = p.get("stop") or ""
            title = (p.findtext("title") or "").strip()
            desc = (p.findtext("desc") or "").strip()
            entry["progs"].setdefault((start, stop, title), (start, stop, title, desc))
            n_prog += 1
        print(f"[ok] {url}: {len(id_map)} channels, {n_prog} programmes")

    tv = ET.Element("tv", {"generator-info-name": "epg-tools"})
    total = 0
    for std in sorted(channels):
        e = channels[std]
        progs = sorted(e["progs"].values(), key=lambda x: x[0])[:MAX_PROGS_PER_CHANNEL]
        ch_el = ET.SubElement(tv, "channel", {"id": std})
        ET.SubElement(ch_el, "display-name").text = std
        for start, stop, title, desc in progs:
            pe = ET.SubElement(tv, "programme", {"start": start, "stop": stop, "channel": std})
            ET.SubElement(pe, "title").text = title
            if desc:
                ET.SubElement(pe, "desc").text = desc
        total += len(progs)

    xml_bytes = ET.tostring(tv, encoding="utf-8", xml_declaration=True)
    xml_bytes = _indent(tv, xml_bytes)

    with open(os.path.join(OUT_DIR, "epg.xml"), "wb") as f:
        f.write(xml_bytes)
    with gzip.open(os.path.join(OUT_DIR, "epg.xml.gz"), "wb", compresslevel=9) as f:
        f.write(xml_bytes)

    # 前端转换器也要用同一份字典
    with open(os.path.join(OUT_DIR, "channels.json"), "w", encoding="utf-8") as f:
        json.dump(dict_names, f, ensure_ascii=False, indent=0)

    # 预构建 DIYP JSON 查表数据（供 Cloudflare Worker /json 接口直接读取）
    write_epgdata(channels)

    print(f"[done] {len(channels)} channels, {total} programmes")


_SAFE_KEY_RE = re.compile(r'[<>:"/\\|?*\s]')


def _safe_key(std):
    return _SAFE_KEY_RE.sub("_", std)


def write_epgdata(channels):
    """按频道预生成逐日 DIYP JSON：docs/epgdata/<频道>/<日期>.json + docs/epgdata/index.json。"""
    base = os.path.join(OUT_DIR, "epgdata")
    os.makedirs(base, exist_ok=True)
    index = {}
    for std in sorted(channels):
        safe = _safe_key(std)
        index[std] = safe
        by_date = {}
        for src in channels[std]["progs"].values():
            start, stop, title, desc = src
            s_digits = re.sub(r"\D", "", start)
            e_digits = re.sub(r"\D", "", stop)
            if len(s_digits) < 8 or len(e_digits) < 8:
                continue
            date_c = s_digits[:8]
            entry = {
                "start": _fmt_dt(s_digits),
                "end": _fmt_dt(e_digits),
                "title": title,
            }
            if desc:
                entry["desc"] = desc
            by_date.setdefault(date_c, []).append(entry)
        ch_dir = os.path.join(base, safe)
        for date_c, items in by_date.items():
            if len(items) > MAX_PROGS_PER_CHANNEL:
                items = items[:MAX_PROGS_PER_CHANNEL]
            day_obj = {
                "channel_name": std,
                "date": f"{date_c[:4]}-{date_c[4:6]}-{date_c[6:8]}",
                "epg_data": items,
            }
            os.makedirs(ch_dir, exist_ok=True)
            with open(os.path.join(ch_dir, date_c + ".json"), "w", encoding="utf-8") as f:
                json.dump(day_obj, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(base, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    print(f"[epgdata] {len(index)} channels -> epgdata/")


def _fmt_dt(digits):
    d = (digits + "00000000000000")[:14]
    return f"{d[0:4]}-{d[4:6]}-{d[6:8]} {d[8:10]}:{d[10:12]}:{d[12:14]}"


def _indent(elem, xml_bytes):
    """轻量缩进，避免额外依赖。"""
    try:
        ET.indent(elem, space="  ")
        return ET.tostring(elem, encoding="utf-8", xml_declaration=True)
    except Exception:  # noqa: BLE001
        return xml_bytes


if __name__ == "__main__":
    build()
