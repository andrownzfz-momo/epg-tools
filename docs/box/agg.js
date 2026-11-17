/**
 * 阿福影视 — drpy 多源聚合规则（自有第1份 drpy 规则）
 * 数据源：多个公开苹果CMS JSON API，任一失效自动跳过
 * 一级/搜索聚合去重不合并（同名不同源各自成条目），二级按同名跨源补线路
 * 命名约定：url = 源序号_vod_id（二级据此路由回正确源）
 *
 * 注意：drpy 引擎 eval 加载本文件时只把 `var rule` 重命名为引擎的 rule，
 * 其余顶层 var 不会跨函数可见。故共享变量/函数一律挂 globalThis。
 */

globalThis.AF_SOURCES = [
    {name: '非凡', api: 'https://cj.ffzyapi.com/api.php/provide/vod', cats: {dy: 1, ju: 2, zy: 3, dm: 4}},
    {name: '量子', api: 'https://cj.lziapi.com/api.php/provide/vod', cats: {dy: 1, ju: 2, zy: 3, dm: 4}},
    {name: '暴风', api: 'https://bfzyapi.com/api.php/provide/vod', cats: {dy: 20, ju: 30, zy: 45, dm: 39}},
    {name: '360', api: 'https://360zy.com/api.php/provide/vod', cats: {dy: 1, ju: 2, zy: 3, dm: 4}},
    {name: '索尼', api: 'https://suoniapi.com/api.php/provide/vod', cats: {dy: 1, ju: 2, zy: 3, dm: 4}}
];

globalThis.afFetch = function (u) {
    return JSON.parse(request(u));
};

globalThis.afPush = function (d, arr, si) {
    (arr || []).forEach(function (x) {
        if (!x || !x.vod_id || !x.vod_name) return;
        d.push({
            title: x.vod_name,
            desc: x.vod_remarks || '',
            img: x.vod_pic || '',
            url: si + '_' + x.vod_id
        });
    });
};

globalThis.afEps = function (it) {
    var out = [];
    var urls = (it.vod_play_url || '').split('$$$');
    for (var g = 0; g < urls.length; g++) {
        var eps = urls[g].split('#');
        for (var k = 0; k < eps.length; k++) {
            if (!eps[k]) continue;
            var kv = eps[k].split('$');
            if (kv.length >= 2 && kv[1]) out.push(kv[0] + '$' + kv[1]);
        }
    }
    return out;
};

var rule = {
    title: '阿福影视',
    host: 'https://cj.ffzyapi.com',
    url: '/api.php/provide/vod?ac=videolist&t=fyclass&pg=fypage',
    searchUrl: '/api.php/provide/vod?ac=videolist&wd=**',
    searchable: 2,
    quickSearch: 1,
    filterable: 0,
    class_name: '电影&剧集&综艺&动漫',
    class_url: 'dy&ju&zy&dm',
    limit: 6,
    double: false,
    play_parse: false,
    lazy: `js:
        input = {parse: 0, url: input, jx: 0}
    `,
    一级: `js:
        var d = [];
        var cate = (typeof MY_CATE !== 'undefined' && MY_CATE) ? MY_CATE : 'dy';
        var pg = (typeof MY_PAGE !== 'undefined' && MY_PAGE) ? MY_PAGE : 1;
        AF_SOURCES.forEach(function (s, i) {
            try {
                var j = afFetch(s.api + '?ac=videolist&t=' + s.cats[cate] + '&pg=' + pg);
                afPush(d, j.list, i);
            } catch (e) {}
        });
        setResult(d);
    `,
    二级: `js:
        var p = input.split('_');
        var si = parseInt(p[0], 10);
        var vid = p.slice(1).join('_');
        var s = AF_SOURCES[si];
        var tabs = [];
        var lists = [];
        var main = null;
        try {
            var j = afFetch(s.api + '?ac=detail&ids=' + vid);
            main = (j.list || [])[0];
        } catch (e) {}
        if (main) {
            tabs.push(s.name);
            lists.push(afEps(main).join('#'));
            for (var i = 0; i < AF_SOURCES.length; i++) {
                if (i === si) continue;
                try {
                    var so = AF_SOURCES[i];
                    var j2 = afFetch(so.api + '?ac=videolist&wd=' + encodeURIComponent(main.vod_name) + '&pg=1');
                    var arr = j2.list || [];
                    var hit = null;
                    for (var k = 0; k < arr.length; k++) {
                        if (arr[k].vod_name === main.vod_name) { hit = arr[k]; break; }
                    }
                    if (!hit) continue;
                    var j3 = afFetch(so.api + '?ac=detail&ids=' + hit.vod_id);
                    var it3 = (j3.list || [])[0];
                    if (!it3) continue;
                    var eps3 = afEps(it3);
                    if (eps3.length) {
                        tabs.push(so.name);
                        lists.push(eps3.join('#'));
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
            vod_play_from: tabs.join('$$$'),
            vod_play_url: lists.join('$$$')
        }
    `,
    搜索: `js:
        var d = [];
        var kw = (typeof KEY !== 'undefined') ? KEY : '';
        var pg = (typeof MY_PAGE !== 'undefined' && MY_PAGE) ? MY_PAGE : 1;
        AF_SOURCES.forEach(function (s, i) {
            try {
                var j = afFetch(s.api + '?ac=videolist&wd=' + encodeURIComponent(kw) + '&pg=' + pg);
                afPush(d, j.list, i);
            } catch (e) {}
        });
        setResult(d);
    `,
    推荐: `js:
        var d = [];
        AF_SOURCES.forEach(function (s, i) {
            try {
                var j = afFetch(s.api + '?ac=videolist&pg=1');
                afPush(d, (j.list || []).slice(0, 10), i);
            } catch (e) {}
        });
        setResult(d);
    `
};
