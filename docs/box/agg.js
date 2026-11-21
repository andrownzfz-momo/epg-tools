/**
 * 阿福影视 — drpy 多源聚合规则（不依赖 globalThis，全部挂 rule 自身）
 * url 约定：源序号_vod_id
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
    class_name: '电影&剧集&综艺&动漫',
    class_url: 'dy&ju&zy&dm',
    limit: 6,
    double: false,
    play_parse: false,
    lazy: 'js: input = {parse: 0, url: input}',
    rg: [
        ['非凡', 'https://cj.ffzyapi.com/api.php/provide/vod', '1,2,3,4'],
        ['量子', 'https://cj.lziapi.com/api.php/provide/vod', '1,2,3,4'],
        ['暴风', 'https://bfzyapi.com/api.php/provide/vod', '20,30,45,39'],
        ['360', 'https://360zy.com/api.php/provide/vod', '1,2,3,4'],
        ['索尼', 'https://suoniapi.com/api.php/provide/vod', '1,2,3,4']
    ],
    一级: `js:
        var d = [];
        var cate = (typeof MY_CATE !== 'undefined' && MY_CATE) ? MY_CATE : 'dy';
        var pg = (typeof MY_PAGE !== 'undefined' && MY_PAGE) ? MY_PAGE : 1;
        var pos = (cate === 'ju') ? 1 : (cate === 'zy' ? 2 : (cate === 'dm' ? 3 : 0));
        var rg = (rule && rule.rg) ? rule.rg : [];
        for (var i = 0; i < rg.length; i++) {
            try {
                var s = rg[i];
                var tid = s[2].split(',')[pos];
                var j = JSON.parse(request(s[1] + '?ac=videolist&t=' + tid + '&pg=' + pg));
                var lst = (j && j.list) ? j.list : [];
                for (var k = 0; k < lst.length; k++) {
                    var x = lst[k];
                    if (!x || !x.vod_id || !x.vod_name) continue;
                    d.push({title: x.vod_name, desc: x.vod_remarks || '', img: x.vod_pic || '', url: i + '_' + x.vod_id});
                }
            } catch (e) {}
        }
        setResult(d);
    `,
    搜索: `js:
        var d = [];
        var kw = (typeof KEY !== 'undefined') ? KEY : '';
        var pg = (typeof MY_PAGE !== 'undefined' && MY_PAGE) ? MY_PAGE : 1;
        var rg = (rule && rule.rg) ? rule.rg : [];
        for (var i = 0; i < rg.length; i++) {
            try {
                var s = rg[i];
                var j = JSON.parse(request(s[1] + '?ac=videolist&wd=' + encodeURIComponent(kw) + '&pg=' + pg));
                var lst = (j && j.list) ? j.list : [];
                for (var k = 0; k < lst.length; k++) {
                    var x = lst[k];
                    if (!x || !x.vod_id || !x.vod_name) continue;
                    d.push({title: x.vod_name, desc: x.vod_remarks || '', img: x.vod_pic || '', url: i + '_' + x.vod_id});
                }
            } catch (e) {}
        }
        setResult(d);
    `,
    推荐: `js:
        var d = [];
        var rg = (rule && rule.rg) ? rule.rg : [];
        for (var i = 0; i < rg.length; i++) {
            try {
                var s = rg[i];
                var j = JSON.parse(request(s[1] + '?ac=videolist&pg=1'));
                var lst = (j && j.list) ? j.list : [];
                for (var k = 0; k < lst.length && k < 10; k++) {
                    var x = lst[k];
                    if (!x || !x.vod_id || !x.vod_name) continue;
                    d.push({title: x.vod_name, desc: x.vod_remarks || '', img: x.vod_pic || '', url: i + '_' + x.vod_id});
                }
            } catch (e) {}
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
                    var j2 = JSON.parse(request(so[1] + '?ac=videolist&wd=' + encodeURIComponent(main.vod_name) + '&pg=1'));
                    var arr = (j2 && j2.list) ? j2.list : [];
                    var hit = null;
                    for (var m = 0; m < arr.length; m++) {
                        if (arr[m].vod_name === main.vod_name) { hit = arr[m]; break; }
                    }
                    if (!hit) continue;
                    var j3 = JSON.parse(request(so[1] + '?ac=detail&ids=' + hit.vod_id));
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
try { console.log('AF_JS_DONE title=' + rule.title + ' rg=' + (rule.rg ? rule.rg.length : 0)); } catch (e1) {}
