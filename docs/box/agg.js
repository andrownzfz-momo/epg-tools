/**
 * 阿福影视 — drpy 多源聚合规则 v4（不依赖 globalThis，全部挂 rule 自身）
 * 手机网络直连采集站不通，全部列表请求经 Worker 中转：/p?u=<encoded>
 * url 约定：源序号_vod_id
 * 每源独立 13 类 tid 映射（各站分类体系不同）
 */
try { console.log('AF_JS_START'); } catch (e0) {}

var rule = {
    title: '阿福影视',
    host: 'https://www.hongniuzy2.com',
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
    // 每源: [名称, API, 13类tid(顺序同 class_url, 0=该站无此类)]
    rg: [
        ['红牛', 'https://www.hongniuzy2.com/api.php/provide/vod', '1,12,39,36,5,6,7,8,9,10,11,0,46'],
        ['量子备', 'https://cj.lzcaiji.com/api.php/provide/vod', '1,2,3,4,6,7,8,9,10,11,12,20,46'],
        ['360备', 'https://360zy5.com/api.php/provide/vod', '1,13,34,38,6,7,8,9,10,11,12,27,46'],
        ['暴风', 'https://bfzyapi.com/api.php/provide/vod', '20,30,45,39,21,22,25,24,23,26,27,28,58']
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
            if (!tid || tid === '0') continue;
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
        var main = null;
        try {
            var j = JSON.parse(rule.afp(s[1] + '?ac=detail&ids=' + vid));
            main = (j && j.list) ? j.list[0] : null;
        } catch (e) {}
        var froms = [];
        var urls = [];
        function epsOf(it) {
            var e = [];
            var groups = (it.vod_play_url || '').split('$$$');
            for (var g = 0; g < groups.length; g++) {
                var items = groups[g].split('#');
                for (var k = 0; k < items.length; k++) {
                    if (!items[k]) continue;
                    var kv = items[k].split('$');
                    if (kv.length >= 2 && kv[1]) e.push(kv[0] + '$' + kv[1]);
                }
                if (e.length) break;
            }
            return e;
        }
        if (main) {
            var e1 = epsOf(main);
            if (e1.length) { froms.push(s[0]); urls.push(e1.join('#')); }
            // v5：不再跨源补线路——同名不同片很常见，混进别人线路会出现显示与播放不一致；
            // 只保留主源线路，显示与实际完全一致。
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

/* Worker 中转：手机网络直连采集站失败，统一走 /p?u=<encoded> */
rule.afp = function (u) {
    return request('https://epg.773211.xyz/p?u=' + encodeURIComponent(u), {timeout: 15000});
};

/* 列表抓取 + KV 缓存：rule.afq(url, cacheKey) -> [[id,name,remarks,pic], ...]
   成功缓存 15 分钟；空结果仅缓存 60 秒，网络恢复自动重试 */
rule.afq = function (u, key) {
    var now = new Date().getTime();
    var ck = 'af4_' + key;
    try {
        var c = getItem(ck, '');
        if (c) {
            var o = JSON.parse(c);
            if (o && (now - o.t) < 900000) return o.v;
        }
    } catch (e) {}
    var out = [];
    try {
        var j = JSON.parse(rule.afp(u));
        var lst = (j && j.list) ? j.list : [];
        for (var k = 0; k < lst.length; k++) {
            var x = lst[k];
            if (!x || !x.vod_id || !x.vod_name) continue;
            out.push([x.vod_id, x.vod_name, x.vod_remarks || '', x.vod_pic || '']);
        }
    } catch (e2) {}
    console.log('AFQ ' + key + ' -> ' + out.length);
    try {
        setItem(ck, JSON.stringify({t: out.length ? now : (now - 840000), v: out}));
    } catch (e3) {}
    return out;
};

try { console.log('AF_JS_DONE title=' + rule.title + ' cats=' + rule.class_name.split('&').length + ' rg=' + (rule.rg ? rule.rg.length : 0)); } catch (e1) {}
