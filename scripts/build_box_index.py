#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
点播多仓索引生成：探测第三方 TVBox 配置（sites/urls 结构），活站写进 docs/box/index.json。

- 与 check_box_sites.py 分工：那边只收 type=1 苹果CMS直连（自己可控），
  这边收第三方完整配置（依赖其自有 spider jar，故只做「多仓索引」由 TVBox 自行订阅，
  不混进 my.json —— my.json 的 custom_spider.jar 没有那些 csp_* 类）。
- 格式 = 多仓订阅 {"urls":[{"url":..,"name":..}]}，TVBox 内可切换源。
- 由 GitHub Actions 定时调用，index.json 是生成物，死链自动剔除。
"""

import json
import os

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "box", "index.json")
UA = {"User-Agent": "Mozilla/5.0 (compatible; epg-tools/1.0)"}
TIMEOUT = 12

# (name, url)。源清单来自 tvbox.shenzjd.com 导航站实测 ok 项（2026-11-23），
# 同族多线路只保留主线路，避免索引冗余。
CANDIDATES = [
    ("菠菜园", "https://0.12yue.de5.net/5/x4.json"),
    ("饭太硬", "http://www.饭太硬.net/tv"),
    ("嗷呜", "https://9763.kstore.vip/aowu.json"),
    ("王二小", "https://9280.kstore.vip/aiwex.json"),
    ("摸鱼", "https://6800.kstore.vip/fish.json"),
    ("老张", "https://zhangqun1818.serv00.net/zq/api.json"),
    ("挺好", "https://ztha.top/TVBox/thdjk.json"),
    ("小米", "https://gh-proxy.org/raw.githubusercontent.com/ggrrttyyiii/CatVodSpider/refs/heads/main/json/demo.json"),
    ("心魔", "https://gh-proxy.com/raw.githubusercontent.com/yw88075/tvbox/main/yw.json"),
    ("俊宇", "http://home.jundie.top:81/top98.json"),
    ("clun", "https://clun.top/box.json"),
    ("夏夏影视", "https://11405.kstore.space/xiaye/qk4k.json"),
    ("凯弟", "https://jihulab.com/jyqhkd/kd/-/raw/main/kai.json"),
    ("动漫", "https://www.yingm.cc/dm/dm.json"),
    ("刺桐", "https://www.cttv.vip/ys/json/ctys.json"),
    ("宝盒", "https://raw.githubusercontent.com/guot55/yg/main/pg/bh.json"),
    ("软件小哥", "http://47.96.82.41:5188/svip/svip.json"),
    ("高天流云", "https://raw.githubusercontent.com/gaotianliuyun/gao/master/js.json"),
    ("ray", "https://raw.githubusercontent.com/dxawi/0/main/0.json"),
    ("幸福年年", "http://150.158.52.248/tgyg/bbm.json"),
    ("健康家用", "https://gitlab.com/noimank/tvbox/-/raw/main/tvbox1.json"),
    ("香雅情", "https://play.iptv365.org/香雅情/api.json"),
    ("少儿频道", "https://0.12yue.de5.net/5/tv少儿.json"),
    ("老刘备", "https://raw.liucn.cc/box/m.json"),
    ("小马", "https://szyyds.cn/tv/x.json"),
    ("肥猫", "https://6296.kstore.vip/facat.json"),
    ("4K小盒子", "http://xhztv.top/4k.json"),
]


def loads_lenient(text):
    """TVBox 同宽解析：剥 BOM、剥 // 行注释（引号外），再 json.loads。"""
    if text.startswith("\ufeff"):
        text = text[1:]
    try:
        return json.loads(text)
    except Exception:  # noqa: BLE001
        pass
    out = []
    for line in text.splitlines():
        idx = line.find("//")
        if idx == 0:
            continue
        if idx > 0 and line[:idx].count('"') % 2 == 0:
            line = line[:idx]
        out.append(line)
    return json.loads("\n".join(out))


def alive(url):
    """探测单配置：200 + 可解析 JSON + 非空 sites/urls 才算活。"""
    try:
        r = requests.get(url, headers=UA, timeout=TIMEOUT)
        if r.status_code != 200:
            return False, "http %d" % r.status_code
        text = r.content.decode("utf-8-sig", errors="replace")
        try:
            j = loads_lenient(text)
        except Exception:  # noqa: BLE001
            # 最后兜底：TVBox 也接受带残缺注释的配置，只要结构字段在
            if '"sites"' in text or '"urls"' in text:
                return True, "lenient hit"
            return False, "not json"
        sites = j.get("sites") or []
        urls = j.get("urls") or []
        if sites:
            return True, "%d sites" % len(sites)
        if urls:
            return True, "%d urls" % len(urls)
        return False, "no sites/urls"
    except Exception as e:  # noqa: BLE001
        return False, str(e)[:60]


def main():
    entries = []
    for name, url in CANDIDATES:
        ok, msg = alive(url)
        print(("[ok] %s: %s" if ok else "[skip] %s: %s") % (name, msg))
        if ok:
            entries.append({"url": url, "name": name})
    cfg = {
        "urls": entries,
        "notice": "阿福多仓索引（第三方配置聚合，探活自动剔除）\n维护: andrownzfz-momo\n联系邮箱: andrownzfz@gmail.com",
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    print("[done] urls=%d / %d" % (len(entries), len(CANDIDATES)))


if __name__ == "__main__":
    main()
