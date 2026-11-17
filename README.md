# epg-tools

零服务器 IPTV 工具站：定时聚合公开 EPG 源 → 静态 XMLTV → GitHub Pages/CDN 分发。

## 架构

```
公开 EPG 源 (51zmt / 112114 / fanmingming/live ...)
        │  GitHub Actions 定时 (每天 4 次)
        ▼
scripts/build_epg.py   聚合 + 频道名标准化 + 合并去重
        ▼
docs/epg.xml, docs/epg.xml.gz, docs/logo/*.png
        ▼
GitHub Pages (docs/) + 自定义域名 epg.773211.xyz (Cloudflare CDN)
```

## 目录

- `scripts/build_epg.py` — EPG 聚合主脚本
- `scripts/channels.json` — 标准频道名字典（匹配词表，同时给前端转换器用）
- `scripts/fetch_logos.py` — 台标拉取（best-effort）
- `.github/workflows/update-epg.yml` — 定时任务
- `docs/index.html` — 工具站前端（EPG 接口 + txt↔m3u 转换）
- `docs/CNAME` — 自定义域名

## 本地运行

```bash
pip install opencc-python-reimplemented requests
python scripts/build_epg.py
python scripts/fetch_logos.py
```

## 自定义

- 换 EPG 源：改 `scripts/build_epg.py` 里的 `SOURCES`
- 换台标源：设环境变量 `LOGO_BASES`（逗号分隔的 URL 模板，`{}` 为频道名）
- 换域名：改 `docs/CNAME`

## 限制

静态托管无法提供动态 `?ch=&date=` JSON 接口。需要的话用 Cloudflare Worker
包一层，从 `epg.xml.gz` 里过滤输出。
