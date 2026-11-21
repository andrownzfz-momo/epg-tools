/**
 * 阿福影视 — drpy 多源聚合规则（不依赖 globalThis，全部挂 rule 自身）
 * url 约定：源序号_vod_id
 * 列表结果用引擎 getItem/setItem 做 KV 缓存；空结果只缓存 60s，避免一次网络抽风导致长时间无数据
 */
try { console.log('AF_JS_START'); } catch (e0) {}

var rule = {
    title: '阿福影视',
    host: 'https://cj.ffzyapi.com',
    url: '',
    searchUrl: '',
    searchable: 2,
    quickSearch: 1,
    filterable: 0,
    class_name: '电影&剧集&综艺&动漫&动作&喜剧&爱情&科幻&恐怖&剧情&战争&纪录&短剧',
    class_url: 'dy&ju&zy&dm&dz&xj&aq&kh&kb&jq&zz&jl&dj',
    limit: 6,
    double: false,
    play_parse: false,
    lazy: 'js: input = {parse: 0, url: input}',
    // 每源 13 个分类 tid，顺序与 class_url 一致（暴风站点分类 ID 整体偏移）
    rg: [
        ['非凡', 'https://cj.ffzyapi.com/api.php/provide/vod', '1,2,3,4,6,7,8,9,10,11,12,20,36'],
        ['量子', 'https://cj.lziapi.com/api.php/provide/vod', '1,2,3,4,6,7,8,9,10,11,12,20,46'],
        ['暴风', 'https://bfzyapi.com/api.php/provide/vod', '20,30,45,39,21,22,25,24,23,26,27,28,58'],
        ['360', 'https://360zy.com/api.php/provide/vod', '1,2,3,4,6,7,8,9,10,11,12,27,46'],
        ['索尼', 'https://suoniapi.com/api.php/provide/vod', '1,2,3,4,6,7,8,9,10,11,12,20,54']
    ],
    一级: `js:
        var d = [];
        var cate = (typeof MY_CATE !== 'undefined' && MY_CATE) ? MY_CATE : 'dy';
        var pg = (typeof MY_PAGE !== 'undefined' && MY_PAGE) ? MY_PAGE : 1;
        var keys = 'dy,ju,zy,dm,dz,xj,aq,kh,kb,jq,zz,jl,dj'.split(',');
        var pos = keys.indexOf(cate);
        if (pos < 0) pos = 0;
        var rg = (rule && rule.rg) ? rule.rg : [];
        for (var i = 0; i < rg.length; i++) {
            var s = rg[i];
            var tid = s[2].split(',')[pos];
            var arr = rule.afq(s[1] + '?ac=videolist&t=' + tid + '&pg=' + pg, i + '_' + cate + '_' + pg);
            for (var k = 0; k < arr.length; k++) {
                d.push({title: arr[k][1], desc: arr[k][2], img: arr[k][3], url: i + '_' + arr[k][0]});
            }
        }
        setResult(d);
    `,
    搜索: `js:
        var d = [];
        var kw = (typeof KEY !== 'undefined') ? KEY : '';
        var pg = (typeof MY_PAGE !== 'undefined' && MY_PAGE) ? MY_PAGE : 1;
        var rg = (rule && rule.rg) ? rule.rg : [];
        for (var i = 0; i < rg.length; i++) {
            var s = rg[i];
            var arr = rule.afq(s[1] + '?ac=videolist&wd=' + encodeURIComponent(kw) + '&pg=' + pg, i + '_s_' + kw + '_' + pg);
            for (var k = 0; k < arr.length; k++) {
                d.push({title: arr[k][1], desc: arr[k][2], img: arr[k][3], url: i + '_' + arr[k][0]});
            }
        }
        setResult(d);
    `,
    推荐: `js:
        var d = [];
        var rg = (rule && rule.rg) ? rule.rg : [];
        for (var i = 0; i < rg.length && i < 2; i++) {
            var s = rg[i];
            var arr = rule.afq(s[1] + '?ac=videolist&pg=1', i + '_h_1');
            for (var k = 0; k < arr.length && k < 10; k++) {
                d.push({title: arr[k][1], desc: arr[k][2], img: arr[k][3], url: i + '_' + arr[k][0]});
            }
        }
        setResult(d);
    `,
    二级: `js:
        var p = ('' + input).split('_');
        var si = parseInt(p[0], 10);
        var vid = p.slice(1).join('_');
        var rg = (rule && rule.rg) ? rule.rg : [];
        var s = rg[si] || rg[0];
        var pg = (typeof MY_PAGE !== 'undefined' && MY_PAGE) ? MY_PAGE : 1;
        var main = null;
        try {
            var j = JSON.parse(request(s[1] + '?ac=detail&ids=' + vid));
            main = (j && j.list) ? j.list[0] : null;
        } catch (e) {}
        var froms = [];
        var urls = [];
        if (main) {
            var eps = [];
            var groups = (main.vod_play_url || '').split('$$$');
            for (var g = 0; g < groups.length; g++) {
                var items = groups[g].split('#');
                for (var k = 0; k < items.length; k++) {
                    if (!items[k]) continue;
                    var kv = items[k].split('$');
                    if (kv.length >= 2 && kv[1]) eps.push(kv[0] + '$' + kv[1]);
                }
                if (eps.length) break;
            }
            if (eps.length) {
                froms.push(s[0]);
                urls.push(eps.join('#'));
            }
            for (var i = 0; i < rg.length; i++) {
                if (i === si) continue;
                try {
                    var so = rg[i];
                    var hit = null;
                    var arr2 = rule.afq(so[1] + '?ac=videolist&wd=' + encodeURIComponent(main.vod_name) + '&pg=1', i + '_s_' + main.vod_name + '_1');
                    for (var m = 0; m < arr2.length; m++) {
                        if (arr2[m][1] === main.vod_name) { hit = arr2[m]; break; }
                    }
                    if (!hit) continue;
                    var j3 = JSON.parse(request(so[1] + '?ac=detail&ids=' + hit[0]));
                    var it3 = (j3 && j3.list) ? j3.list[0] : null;
                    if (!it3) continue;
                    var e2 = [];
                    var gs = (it3.vod_play_url || '').split('$$$');
                    for (var g2 = 0; g2 < gs.length; g2++) {
                        var its = gs[g2].split('#');
                        for (var k2 = 0; k2 < its.length; k2++) {
                            if (!its[k2]) continue;
                            var kv2 = its[k2].split('$');
                            if (kv2.length >= 2 && kv2[1]) e2.push(kv2[0] + '$' + kv2[1]);
                        }
                        if (e2.length) break;
                    }
                    if (e2.length) {
                        froms.push(so[0]);
                        urls.push(e2.join('#'));
                    }
                } catch (e) {}
            }
        }
        VOD = {
            vod_id: input,
            vod_name: main ? main.vod_name : '',
            vod_pic: main ? main.vod_pic : '',
            type_name: main ? (main.type_name || '') : '',
            vod_year: main ? (main.vod_year || '') : '',
            vod_area: main ? (main.vod_area || '') : '',
            vod_actor: main ? (main.vod_actor || '') : '',
            vod_director: main ? (main.vod_director || '') : '',
            vod_content: main ? (main.vod_content || '') : '',
            vod_remarks: main ? (main.vod_remarks || '') : '',
            vod_play_from: froms.join('$$$'),
            vod_play_url: urls.join('$$$')
        }
    `
};

/* 列表抓取 + KV 缓存：rule.afq(url, cacheKey) -> [[id,name,remarks,pic], ...]
   成功结果缓存 15 分钟；空结果仅缓存 60 秒，网络恢复后能自动重试。
   注意：必须挂在 rule 上，引擎 eval 的顶层函数不会泄漏到 js 块作用域 */
rule.afq = function (u, key) {
    var now = new Date().getTime();
    var ck = 'af3_' + key;
    try {
        var c = getItem(ck, '');
        if (c) {
            var o = JSON.parse(c);
            if (o && (now - o.t) < 900000) return o.v;
        }
    } catch (e) {}
    var out = [];
    try {
        var j = JSON.parse(request(u, {timeout: 9000}));
        var lst = (j && j.list) ? j.list : [];
        for (var k = 0; k < lst.length; k++) {
            var x = lst[k];
            if (!x || !x.vod_id || !x.vod_name) continue;
            out.push([x.vod_id, x.vod_name, x.vod_remarks || '', x.vod_pic || '']);
        }
    } catch (e2) {}
    try {
        // 空结果写入 60s 前的时间戳，等价于只缓存 60 秒
        setItem(ck, JSON.stringify({t: out.length ? now : (now - 840000), v: out}));
    } catch (e3) {}
    return out;
};

try { console.log('AF_JS_DONE title=' + rule.title + ' cats=' + rule.class_name.split('&').length + ' rg=' + (rule.rg ? rule.rg.length : 0)); } catch (e1) {}
