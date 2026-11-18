/**
 * epg-json — epg.773211.xyz 的 DIYP 风格单频道 EPG 查表接口。
 *
 * 路由：epg.773211.xyz/json?*  →  本 Worker（其余路径照常回源 GitHub Pages）
 * 数据：构建脚本预生成的静态查表文件 /epgdata/<频道>/<日期>.json（零解析、低 CPU）
 *
 * 兼容 TVBox/DIYP：
 *   响应为对象：{"channel_name":..., "date":"YYYY-MM-DD", "epg_data":[{start,end,title,desc?}]}
 *   date 接受 20261117 / 2026-11-17；缺省 = 当天（Asia/Shanghai）
 */

var SITE = "https://epg.773211.xyz";
// /box* 分支的回源地址：必须绕开本 Worker 自己的路由（同域名 /box* 会循环）
var BOX_ORIGIN = "https://andyhang1980.github.io/epg-tools";

var INDEX_CACHE_TTL = 3600;      // 频道索引缓存 1h
var NO_DATA_CACHE_TTL = 300;     // 空结果缓存 5min
var BOX_CACHE_TTL = 3600;        // /box* 点播文件边缘缓存 1h（CI 每天4次更新）
// 缓存版本盐：改这个数字重新部署即可立刻让所有 /box* 边缘缓存失效
var BOX_CACHE_VER = 2;

function jsonResp(obj, status, ttl) {
    return new Response(JSON.stringify(obj), {
        status: status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "access-control-allow-origin": "*",
            "cache-control": "public, max-age=" + (ttl || 600),
        },
    });
}

function normDate(raw) {
    var d = (raw || "").replace(/[^0-9]/g, "");
    if (d.length !== 8) {
        // 默认取 Asia/Shanghai 当天
        var now = new Date(Date.now() + 8 * 3600 * 1000);
        d = now.toISOString().slice(0, 10).replace(/-/g, "");
    }
    return {
        compact: d,
        full: d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8),
    };
}

// 与 docs/index.html 的 matchTvg 同一思路的精简版：精确 -> 汉字/任意前缀 -> 包含
function normName(s) {
    return (s || "").toUpperCase().replace(/[\s_\-]/g, "");
}

function matchChannel(query, keys) {
    var q = normName(query);
    if (!q) return null;
    var hit = keys.filter(function (k) { return normName(k) === q; });
    if (hit.length) return hit[0];
    var han = keys.filter(function (k) { return /^[\u4e00-\u9fff]/.test(k); });
    hit = han.filter(function (k) { return q.indexOf(normName(k)) === 0; });
    if (hit.length) return hit[0];
    hit = keys.filter(function (k) { return q.indexOf(normName(k)) === 0; });
    if (hit.length) return hit[0];
    hit = keys.filter(function (k) { return normName(k).indexOf(q) >= 0 && q.length >= 2; });
    if (hit.length) return hit[0];
    hit = keys.filter(function (k) { return q.indexOf(normName(k)) >= 0; });
    if (hit.length) return hit[0];
    return null;
}

async function loadIndex(ctx) {
    var url = SITE + "/epgdata/index.json";
    var cacheKey = new Request(url);
    var cached = await caches.default.match(cacheKey);
    if (cached) return cached.json();
    var r = await fetch(url, { cf: { cacheTtl: INDEX_CACHE_TTL, cacheEverything: true } });
    if (!r.ok) return {};
    var obj = await r.json();
    var res = new Response(JSON.stringify(obj), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=" + INDEX_CACHE_TTL },
    });
    ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
    return obj;
}

function emptyDay(ch, d) {
    return { channel_name: ch, date: d.full, epg_data: [] };
}

// /box* 点播文件透传：jar/引擎/依赖/配置走 1h 边缘缓存，消除回源延迟
async function handleBox(req, ctx) {
    var url = new URL(req.url);
    var originUrl = BOX_ORIGIN + url.pathname + url.search;
    var r = await fetch(originUrl, { cf: { cacheTtl: BOX_CACHE_TTL, cacheEverything: true } });
    var headers = {
        "cache-control": "public, max-age=" + BOX_CACHE_TTL,
        "access-control-allow-origin": "*",
    };
    if (r.ok) {
        headers["content-type"] = r.headers.get("content-type") || "application/octet-stream";
        return new Response(await r.arrayBuffer(), { status: 200, headers: headers });
    }
    return new Response(JSON.stringify({ error: "box origin " + r.status }), {
        status: r.status === 404 ? 404 : 502,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" },
    });
}

async function handle(req, ctx) {
    var url = new URL(req.url);
    var ch = url.searchParams.get("ch") || url.searchParams.get("name") || "";
    var d = normDate(url.searchParams.get("date"));
    if (!ch.trim()) {
        return jsonResp({ error: "missing ch" }, 400, 60);
    }

    var index = await loadIndex(ctx);
    var keys = Object.keys(index);
    var std = matchChannel(ch, keys);
    if (!std) {
        return jsonResp(emptyDay(ch, d), 200, NO_DATA_CACHE_TTL);
    }

    var fileUrl = SITE + "/epgdata/" + encodeURIComponent(index[std]) + "/" + d.compact + ".json";
    var r = await fetch(fileUrl, { cf: { cacheTtl: INDEX_CACHE_TTL, cacheEverything: true } });
    if (!r.ok) {
        return jsonResp(emptyDay(std, d), 200, NO_DATA_CACHE_TTL);
    }
    var day = await r.json();
    // 防御：文件里的 channel_name 是标准名，直接以文件为准
    return jsonResp(day, 200, INDEX_CACHE_TTL);
}

addEventListener("fetch", function (event) {
    event.respondWith((function () {
        var req = event.request;
        var url = new URL(req.url);
        var cache = caches.default;
        if (url.pathname.startsWith("/box/")) {
            var keyUrl = new URL(req.url);
            keyUrl.searchParams.set("__v", String(BOX_CACHE_VER));
            var cacheKey = new Request(keyUrl.toString(), req);
            return cache.match(cacheKey).then(function (hit) {
                if (hit) return hit;
                return handleBox(req, event).then(function (res) {
                    if (res.status === 200) event.waitUntil(cache.put(cacheKey, res.clone()));
                    return res;
                });
            });
        }
        if (url.pathname !== "/json") {
            return jsonResp({ error: "not found" }, 404, 60);
        }
        return cache.match(req).then(function (hit) {
            if (hit) return hit;
            return handle(req, event).then(function (res) {
                if (res.status === 200) event.waitUntil(cache.put(req, res.clone()));
                return res;
            });
        });
    })());
});
