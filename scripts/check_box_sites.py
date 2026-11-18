#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
点播直连源健检：逐个探测苹果CMS JSON API，活站写进 docs/box/my.json（type=1 直连站点）。

- drpy 聚合站（type=3，规则内自带容错）恒在首位；
- 候选站（含本地网络判死、CI 网络可能复活的）全部探测，以 CI 视角为准；
- 由 GitHub Actions 定时调用，my.json 是生成物，自动增删站点实现容灾。
"""

import json
import os

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "box", "my.json")
UA = {"User-Agent": "Mozilla/5.0 (compatible; epg-tools/1.0)"}
TIMEOUT = 12

# drpy 聚合站恒在（api/ext 自托管于 docs/box/）
DRPY_SITE = {
    "key": "juhe",
    "name": "阿福影视",
    "type": 3,
    "api": "https://epg.773211.xyz/box/drpy.min.js",
    "ext": "https://epg.773211.xyz/box/agg.js",
    "searchable": 2,
    "quickSearch": 1,
    "filterable": 0,
}

# (key, name, api)。前 8 个为实测活站；其余为本机判死但 CI 可能复活的候选。
CANDIDATES = [
    ("ffy", "非凡", "https://cj.ffzyapi.com/api.php/provide/vod"),
    ("lz", "量子", "https://cj.lziapi.com/api.php/provide/vod"),
    ("bf", "暴风", "https://bfzyapi.com/api.php/provide/vod"),
    ("z360", "360", "https://360zy.com/api.php/provide/vod"),
    ("sn", "索尼", "https://suoniapi.com/api.php/provide/vod"),
    ("hn", "红牛", "https://www.hongniuzy2.com/api.php/provide/vod"),
    ("lzb", "量子备", "https://cj.lzcaiji.com/api.php/provide/vod"),
    ("b360", "360备", "https://360zy5.com/api.php/provide/vod"),
    ("wl", "卧龙", "https://collect.wolongzy.cc/api.php/provide/vod"),
    ("tk", "天空", "https://api.tiankongapi.com/api.php/provide/vod"),
    ("yy", "优优", "https://caiji.yycaiji.com/api.php/provide/vod"),
    ("lzg", "蓝光", "https://api.lzzy6.com/api.php/provide/vod"),
    ("snb", "索尼备", "https://suoniapi2.com/api.php/provide/vod"),
]


def alive(api):
    """探测单站：200 + JSON + 非空 list 才算活。"""
    try:
        r = requests.get(api, params={"ac": "videolist", "pg": 1}, headers=UA, timeout=TIMEOUT)
        if r.status_code != 200:
            return False, "http %d" % r.status_code
        j = r.json()
        lst = j.get("list") or j.get("data") or []
        if not lst:
            return False, "empty list"
        return True, "%d items, pagecount=%s" % (len(lst), j.get("pagecount", "?"))
    except Exception as e:  # noqa: BLE001
        return False, str(e)[:60]


def main():
    sites = [dict(DRPY_SITE)]
    for key, name, api in CANDIDATES:
        ok, msg = alive(api)
        print(("[ok] %s: %s" if ok else "[skip] %s: %s") % (name, msg))
        if ok:
            sites.append({
                "key": key,
                "name": name,
                "type": 1,
                "api": api,
                "searchable": 1,
                "quickSearch": 1,
                "filterable": 0,
            })
    cfg = {
        "spider": "https://epg.773211.xyz/box/custom_spider.jar",
        "sites": sites,
        "wallpaper": "https://epg.773211.xyz/",
        "logo": "https://epg.773211.xyz/box/logo.png?v=3",
  "notice": "阿福影视（自建源套件：点播聚合 + 直播 + EPG）\n维护: andyhang1980\n联系邮箱: 3630452982@qq.com",
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    print("[done] sites=%d (1 drpy + %d direct)" % (len(sites), len(sites) - 1))


if __name__ == "__main__":
    main()
