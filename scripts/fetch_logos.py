#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
台标拉取（best-effort）。

从公开台标库按标准频道名下载 logo 到 docs/logo/。单个失败直接跳过。
可用环境变量 LOGO_BASES 覆盖源模板（逗号分隔，{} 会被替换成频道名）。
"""

import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "docs", "logo")
DICT_FILE = os.path.join(ROOT, "scripts", "channels.json")
UA = {"User-Agent": "Mozilla/5.0 (compatible; epg-tools/1.0)"}

DEFAULT_BASES = [
    "https://raw.githubusercontent.com/fanmingming/live/main/tv/{}.png",
    "https://raw.githubusercontent.com/wanglindl/TVlogo/master/img/{}.png",
]


def main():
    bases = [b.strip() for b in os.environ.get("LOGO_BASES", "").split(",") if b.strip()]
    bases = bases or DEFAULT_BASES

    with open(DICT_FILE, encoding="utf-8") as f:
        names = [x for x in json.load(f) if x]

    os.makedirs(OUT_DIR, exist_ok=True)
    ok = miss = 0
    for name in names:
        dst = os.path.join(OUT_DIR, f"{name}.png")
        if os.path.exists(dst) and os.path.getsize(dst) > 0:
            ok += 1
            continue
        got = False
        for base in bases:
            url = base.format(name)
            try:
                req = urllib.request.Request(url, headers=UA)
                with urllib.request.urlopen(req, timeout=15) as r:
                    data = r.read()
                if data[:8] == b"\x89PNG\r\n\x1a\n" and len(data) > 100:
                    with open(dst, "wb") as f:
                        f.write(data)
                    got = True
                    ok += 1
                    break
            except Exception:  # noqa: BLE001
                continue
        if not got:
            miss += 1
    print(f"[logo] ok={ok} miss={miss}")


if __name__ == "__main__":
    main()
