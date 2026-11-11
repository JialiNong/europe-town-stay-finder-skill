/* europe-town-stay-finder 住宿对比页渲染器 v2 · stay comparison page renderer
 * 读取 <script type="application/json" id="stay-data"> 的 JSON，渲染成对比页。
 * 预算区间、每家的最低价渠道、表格里的最低价都自动计算。
 * 双语：任何文本字段都可以写成 {"zh": "…", "en": "…"}，页面右上角可切换中文 / English。
 * 标了「html」的字段只保留 <b> <i> <a> <br> 等行内标签，其余按纯文本处理。
 */
(function () {
  "use strict";
  var app = document.getElementById("app") || document.body.appendChild(document.createElement("div"));

  var DICT = {
    zh: {
      version: function (n) { return "第 " + n + " 版"; },
      nights: function (n) { return n + " 晚"; },
      heading: function (town) { return town + " 及周边住宿"; },
      perNight: "每晚预算", inBudget: "预算内", floatBand: "浮动区间",
      bandIn: "预算内", bandBelow: function (p) { return "低于预算 " + p + "%"; }, bandOver: function (p) { return "超预算 " + p + "%"; }, bandFarBelow: "远低于预算",
      verdict: "结论", towns: "公交 1 小时圈",
      thTown: "村镇", thToCore: "到核心小镇", thTransfers: "换乘", thFreq: "班次", thLast: "末班回村", thFare: "单程票价", thCard: "游客卡 / 城市税",
      core: "核心小镇", coreSuffix: "（核心小镇）", cityTax: "城市税 ",
      legendCore: "核心小镇", legendTown: "周边村镇", legendStay: "推荐住宿",
      mapNote: "示意位置图，不是精确地理底图；鼠标悬停或点开看名字。",
      stays: "住宿总览", thStay: "住宿", thType: "房型", thRating: "评分", thWalk: "到车站", thLowest: "每晚最低", thWhere: "在哪订",
      perNightUnit: " /晚", metaTown: "村镇", metaType: "房型", metaWalk: "到车站", metaToCore: "到核心小镇", metaBreakfast: "早餐", metaCancel: "取消",
      channels: "各渠道价格", chChannel: "渠道", chRating: "评分", chPrice: "每晚 / 全程",
      nearMiss: "差点入选", activities: "户外运动与教练、团体",
      hikes: "komoot 高分徒步路线", thRoute: "路线", thRated: "评分（人数）", thDiff: "难度", thDist: "距离 · 时长 · 爬升", thStart: "起点和公交", thSeason: "季节",
      easy: "简单", moderate: "中等", hard: "困难",
      excluded: "排除的村镇",
      queried: function (s) { return "查询时间：" + s + "。价格是查询时的快照，以平台为准。"; },
      mapFail: "地图渲染失败：",
      print: "导出 / 打印 PDF",
      noData: function (id) { return "页面里没有找到 id=\"" + id + "\" 的 JSON。"; },
      renderFail: "住宿页渲染失败："
    },
    en: {
      version: function (n) { return "v" + n; },
      nights: function (n) { return n + (n === 1 ? " night" : " nights"); },
      heading: function (town) { return "Where to stay in and around " + town; },
      perNight: "Budget per night", inBudget: "In budget", floatBand: "Stretch range",
      bandIn: "In budget", bandBelow: function (p) { return p + "% under budget"; }, bandOver: function (p) { return p + "% over budget"; }, bandFarBelow: "Well under budget",
      verdict: "Bottom line", towns: "Within 1 hour by public transport",
      thTown: "Village / town", thToCore: "To main town", thTransfers: "Changes", thFreq: "Frequency", thLast: "Last ride back", thFare: "Single fare", thCard: "Guest card / tourist tax",
      core: "Main town", coreSuffix: " (main town)", cityTax: "Tourist tax ",
      legendCore: "Main town", legendTown: "Nearby village", legendStay: "Recommended stay",
      mapNote: "Schematic map, not to geographic detail; hover or tap a dot to see its name.",
      stays: "Stays at a glance", thStay: "Stay", thType: "Room type", thRating: "Rating", thWalk: "To station", thLowest: "Lowest / night", thWhere: "Book on",
      perNightUnit: " /night", metaTown: "Village", metaType: "Room", metaWalk: "To station", metaToCore: "To main town", metaBreakfast: "Breakfast", metaCancel: "Cancellation",
      channels: "Price by channel", chChannel: "Channel", chRating: "Rating", chPrice: "Per night / total",
      nearMiss: "Near misses", activities: "Outdoor sports: instructors and groups",
      hikes: "Top-rated komoot hikes", thRoute: "Route", thRated: "Rating (votes)", thDiff: "Difficulty", thDist: "Distance · time · ascent", thStart: "Start and transit", thSeason: "Season",
      easy: "Easy", moderate: "Moderate", hard: "Hard",
      excluded: "Villages ruled out",
      queried: function (s) { return "Checked " + s + ". Prices are a snapshot from that time; the booking platform is authoritative."; },
      mapFail: "Could not draw the map: ",
      print: "Print / save as PDF",
      noData: function (id) { return "No JSON with id=\"" + id + "\" found on the page."; },
      renderFail: "Could not render the stay page: "
    }
  };

  /* ---- 共用：双语、HTML 白名单、链接校验 · shared: i18n, HTML allowlist, URL check ---- */
  var LANG_KEY = "travel-skill-lang";
  var CUR = /^zh/i.test((navigator.language || "")) ? "zh" : "en";
  function t(k) {
    var s = DICT[CUR][k];
    if (s == null) s = DICT.zh[k];
    return typeof s === "function" ? s.apply(null, Array.prototype.slice.call(arguments, 1)) : s;
  }
  // 本地化字段：任何字符串（或数组）都可以写成 {"zh": "…", "en": "…"}；缺一种语言时退回另一种
  function isLoc(v) {
    if (!v || typeof v !== "object" || Array.isArray(v)) return false;
    var k = Object.keys(v);
    return k.length > 0 && k.every(function (x) { return x === "zh" || x === "en"; });
  }
  function localize(v, lang) {
    if (isLoc(v)) {
      var pick = v[lang];
      if (pick == null || pick === "") pick = v[lang === "zh" ? "en" : "zh"];
      return localize(pick, lang);
    }
    if (Array.isArray(v)) return v.map(function (x) { return localize(x, lang); });
    if (v && typeof v === "object") {
      var o = {};
      Object.keys(v).forEach(function (k) { o[k] = localize(v[k], lang); });
      return o;
    }
    return v;
  }
  function scanLangs(v, acc) {
    if (isLoc(v)) Object.keys(v).forEach(function (k) { if (v[k] != null && v[k] !== "") acc[k] = 1; });
    if (v && typeof v === "object") Object.keys(v).forEach(function (k) { scanLangs(v[k], acc); });
    return acc;
  }
  function availableLangs(raw) {
    var langs = (Array.isArray(raw.languages) ? raw.languages : []).filter(function (l) { return l === "zh" || l === "en"; });
    if (!langs.length) langs = Object.keys(scanLangs(raw, {})).sort().reverse(); // zh 在前
    if (!langs.length) langs = [raw.lang === "en" ? "en" : "zh"];
    return langs;
  }
  function initialLang(raw, langs) {
    var q = (location.search.match(/[?&]lang=(zh|en)\b/) || [])[1];
    var saved = null;
    try { saved = localStorage.getItem(LANG_KEY); } catch (e) { /* 隐私模式等 */ }
    var order = [q, saved, raw.lang, CUR, langs[0]];
    for (var i = 0; i < order.length; i++) if (order[i] && langs.indexOf(order[i]) >= 0) return order[i];
    return langs[0];
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) {
    u = String(u == null ? "" : u).trim();
    return /^(https?:|mailto:|#)/i.test(u) ? u : "";
  }
  function a(url, text) {
    var u = safeUrl(url);
    return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(text) + "</a>" : esc(text);
  }
  // 标「html」的字段只保留少量行内标签，链接只允许 http(s) / mailto，其余标签去壳、属性全部去掉
  var KEEP = { B: 1, STRONG: 1, I: 1, EM: 1, A: 1, BR: 1, SMALL: 1, CODE: 1, SPAN: 1 };
  var DROP = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, TEMPLATE: 1, NOSCRIPT: 1, SVG: 1, MATH: 1, LINK: 1, META: 1 };
  function clean(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (n) {
      if (n.nodeType === 3) return;
      if (n.nodeType !== 1 || DROP[n.tagName.toUpperCase()]) { node.removeChild(n); return; }
      clean(n);
      var tag = n.tagName.toUpperCase();
      if (!KEEP[tag]) {
        while (n.firstChild) node.insertBefore(n.firstChild, n);
        node.removeChild(n);
        return;
      }
      var href = tag === "A" ? safeUrl(n.getAttribute("href")) : "";
      Array.prototype.slice.call(n.attributes).forEach(function (at) { n.removeAttribute(at.name); });
      if (href) { n.setAttribute("href", href); n.setAttribute("target", "_blank"); n.setAttribute("rel", "noopener"); }
    });
  }
  function html(s) {
    if (s == null || s === "") return "";
    s = String(s);
    if (!/[<&]/.test(s)) return s;
    var tpl = document.createElement("template");
    tpl.innerHTML = s;
    clean(tpl.content);
    var box = document.createElement("div");
    box.appendChild(tpl.content);
    return box.innerHTML;
  }
  function toolbar(langs) {
    var s = '<div class="toolbar no-print">';
    if (langs.length > 1) {
      s += '<div class="lang-switch" role="group" aria-label="Language / 语言">' + langs.map(function (l) {
        return '<button type="button" data-lang="' + l + '" aria-pressed="' + (l === CUR) + '">' + (l === "zh" ? "中文" : "EN") + "</button>";
      }).join("") + "</div>";
    }
    return s + '<button type="button" class="print-btn" data-print>' + esc(t("print")) + "</button></div>";
  }
  // 启动：读 JSON → 选语言 → 渲染；切换语言时保持滚动位置
  function boot(dataId) {
    var raw, langs;
    function draw() {
      document.documentElement.lang = CUR === "zh" ? "zh-CN" : "en";
      var d = localize(raw, CUR);
      render(d, toolbar(langs));
      if (d.title) document.title = d.title;
    }
    try {
      var el = document.getElementById(dataId);
      if (!el) throw new Error(t("noData", dataId));
      raw = JSON.parse(el.textContent);
      langs = availableLangs(raw);
      CUR = initialLang(raw, langs);
      draw();
    } catch (e) {
      app.className = "wrap";
      app.innerHTML = '<div class="render-error">' + esc(t("renderFail")) + esc(e.message) + "</div>";
      return;
    }
    app.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest("[data-lang],[data-print]") : null;
      if (!b) return;
      if (b.hasAttribute("data-print")) { window.print(); return; }
      var l = b.getAttribute("data-lang");
      if (!l || l === CUR) return;
      CUR = l;
      try { localStorage.setItem(LANG_KEY, l); } catch (x) { /* ignore */ }
      var y = window.scrollY;
      draw();
      window.scrollTo(0, y);
    });
  }
  /* ---- 共用部分结束 · end of shared part ---- */


  function num(s) {
    if (typeof s === "number") return s;
    var m = String(s == null ? "" : s).replace(/,/g, ".").match(/\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
  }
  function list(items) {
    return items && items.length ? '<ul class="notes">' + items.map(function (x) { return "<li>" + html(x) + "</li>"; }).join("") + "</ul>" : "";
  }
  function fmt(v, cur) { return isNaN(v) ? "—" : (Math.round(v * 100) / 100) + cur; }
  function isNum(v) { return typeof v === "number" && !isNaN(v); }
  function mapNote() { return '<p class="small muted" style="margin-top:6px">' + esc(t("mapNote")) + "</p>"; }

  function render(d, bar) {
    var cur = (d.budget && d.budget.currency) || "€";
    var B = d.budget ? num(d.budget.perNight) : NaN;
    var out = [bar];

    // 地图用的点：住宿（村镇 + 住宿自己的坐标）、户外运动、komoot 路线
    var mapStays = [];
    (d.towns || []).forEach(function (tw) {
      if (isNum(tw.lat) && isNum(tw.lng)) mapStays.push({ lat: tw.lat, lng: tw.lng, core: !!tw.core, label: tw.name + (tw.core ? t("coreSuffix") : "") });
    });
    (d.stays || []).forEach(function (s, i) {
      if (!isNum(s.lat) || !isNum(s.lng)) return;
      // 同一村镇的几家住宿坐标常常完全一样（退回村镇坐标），加一点点固定偏移避免点完全重叠
      var dupes = (d.stays || []).filter(function (o) { return isNum(o.lat) && o.lat === s.lat && o.lng === s.lng; });
      var j = dupes.length > 1 ? dupes.indexOf(s) : 0;
      var jitter = j ? (j % 2 ? 1 : -1) * Math.ceil(j / 2) * 0.0009 : 0;
      mapStays.push({ lat: s.lat + jitter, lng: s.lng + jitter, kind: "stay", label: "#" + (i + 1) + " " + s.name });
    });
    var mapActivities = [];
    (d.activities || []).forEach(function (g) {
      (g.items || []).forEach(function (it) {
        if (isNum(it.lat) && isNum(it.lng)) mapActivities.push({ lat: it.lat, lng: it.lng, label: g.sport + ": " + it.name });
      });
    });
    var mapHikes = (d.hikes || []).filter(function (h) { return isNum(h.lat) && isNum(h.lng); }).map(function (h) {
      return { lat: h.lat, lng: h.lng, label: h.name + (h.rating ? " (" + h.rating + "★)" : "") };
    });

    // 预算区间：×0.9–1.1 预算内；×0.8–0.9 / ×1.1–1.2 浮动
    function band(p) {
      if (isNaN(B) || isNaN(p)) return "";
      var r = p / B;
      if (r >= 0.9 && r <= 1.1) return '<span class="band in">' + esc(t("bandIn")) + "</span>";
      if (r >= 0.8 && r < 0.9) return '<span class="band float">' + esc(t("bandBelow", Math.round((1 - r) * 100))) + "</span>";
      if (r > 1.1 && r <= 1.2) return '<span class="band float">' + esc(t("bandOver", Math.round((r - 1) * 100))) + "</span>";
      if (r < 0.8) return '<span class="band">' + esc(t("bandFarBelow")) + "</span>";
      return '<span class="band">' + esc(t("bandOver", Math.round((r - 1) * 100))) + "</span>";
    }
    // 每家住宿：最低价渠道
    function cheapest(s) {
      var best = null;
      (s.prices || []).forEach(function (p) {
        var v = num(p.perNight);
        if (!isNaN(v) && (best === null || v < best.v)) best = { v: v, p: p };
      });
      return best;
    }

    // 页头
    var eyebrow = d.eyebrow || [d.town, d.dateLabel, d.nights ? t("nights", d.nights) : "", t("version", d.version || 1)].filter(Boolean).join(" · ");
    out.push('<header><div class="eyebrow">' + esc(eyebrow) + "</div>");
    out.push("<h1>" + esc(d.heading || t("heading", d.town)) + "</h1>");
    if (!isNaN(B)) {
      out.push('<div class="budget"><span>' + esc(t("perNight")) + " <b>" + fmt(B, cur) + "</b></span><span>" + esc(t("inBudget")) + " <b>" + fmt(B * 0.9, cur) + "–" + fmt(B * 1.1, cur) +
        "</b></span><span>" + esc(t("floatBand")) + " <b>" + fmt(B * 0.8, cur) + "–" + fmt(B * 1.2, cur) + "</b></span></div>");
    }
    if (d.intro) out.push('<p class="route-line">' + html(d.intro) + "</p>");
    out.push("</header>");

    // 结论
    if (d.verdict) {
      out.push('<div class="verdict"><h2>' + esc(t("verdict")) + "</h2>" + (d.verdict.items ? "<ul>" + d.verdict.items.map(function (x) { return "<li>" + html(x) + "</li>"; }).join("") + "</ul>" : ""));
      (d.verdict.alerts || (d.verdict.alert ? [d.verdict.alert] : [])).forEach(function (x) { out.push('<p class="alert">' + html(x) + "</p>"); });
      out.push("</div>");
    }

    // 公交 1 小时圈
    var towns = d.towns || [];
    if (towns.length) {
      out.push('<section><h2 class="sec">' + esc(d.townsTitle || t("towns")) + '</h2><div class="scroll"><table class="wide"><thead><tr>' +
        ["thTown", "thToCore", "thTransfers", "thFreq", "thLast", "thFare", "thCard"].map(function (k) { return "<th>" + esc(t(k)) + "</th>"; }).join("") + "</tr></thead><tbody>");
      towns.forEach(function (tw) {
        out.push('<tr class="' + (tw.core ? "core-row" : "") + '"><td>' + esc(tw.name) + (tw.core ? '<span class="core-mark">' + esc(t("core")) + "</span>" : "") + "</td>" +
          '<td class="num">' + esc(tw.core ? "—" : (tw.time || "—")) + (tw.mode && !tw.core ? '<br><span class="small muted">' + esc(tw.mode) + "</span>" : "") + "</td>" +
          '<td class="num">' + esc(tw.core ? "—" : (tw.transfers == null ? "—" : tw.transfers)) + "</td>" +
          '<td style="white-space:nowrap">' + esc(tw.freq || "—") + '</td><td class="num">' + esc(tw.lastBack || "—") + '</td><td class="num">' + esc(tw.fare || "—") + "</td>" +
          "<td>" + (tw.guestCard ? html(tw.guestCard) : "—") + (tw.cityTax ? '<br><span class="small muted">' + esc(t("cityTax")) + esc(tw.cityTax) + "</span>" : "") + "</td></tr>");
      });
      out.push("</tbody></table></div>");
      if (d.townsNote) out.push('<p class="small muted" style="margin-top:8px">' + html(d.townsNote) + "</p>");
      if (mapStays.length) {
        out.push('<div id="map-stays" class="mapbox"></div><div class="map-legend"><span><i class="lg-core"></i>' + esc(t("legendCore")) + '</span><span><i class="lg-town"></i>' + esc(t("legendTown")) +
          '</span><span><i class="lg-stay"></i>' + esc(t("legendStay")) + "</span></div>" + mapNote());
      }
      out.push("</section>");
    }

    // 住宿总览表
    var stays = d.stays || [];
    if (stays.length) {
      var mins = stays.map(function (s) { var c = cheapest(s); return c ? c.v : NaN; }).filter(function (v) { return !isNaN(v); });
      var lowest = mins.length ? Math.min.apply(null, mins) : NaN;
      out.push('<section><h2 class="sec">' + esc(d.staysTitle || t("stays")) + '</h2><div class="scroll"><table class="wide"><thead><tr><th>#</th>' +
        ["thStay", "thTown", "thType", "thRating", "thWalk", "thLowest", "thWhere"].map(function (k) { return "<th>" + esc(t(k)) + "</th>"; }).join("") + "</tr></thead><tbody>");
      stays.forEach(function (s, i) {
        var c = cheapest(s);
        var ratings = (s.prices || []).filter(function (p) { return p.rating; }).map(function (p) { return p.channel + " " + p.rating; });
        out.push('<tr><td class="num">' + (i + 1) + '</td><td><a href="#stay-' + (i + 1) + '">' + esc(s.name) + "</a></td><td>" + esc(s.town) + "</td><td>" + esc(s.type || "—") + '</td><td class="num">' + esc(ratings.join(" / ") || "—") +
          "</td><td>" + esc(s.walk || "—") + '</td><td class="num' + (c && c.v === lowest ? " best" : "") + '">' + (c ? fmt(c.v, cur) : "—") + "<br>" + (c ? band(c.v) : "") +
          "</td><td>" + (c ? esc(c.p.channel) : "—") + "</td></tr>");
      });
      out.push("</tbody></table></div>");
      if (d.staysNote) out.push('<p class="small muted" style="margin-top:8px">' + html(d.staysNote) + "</p>");
      out.push("</section>");

      // 每家住宿的卡片
      stays.forEach(function (s, i) {
        var c = cheapest(s);
        out.push('<section class="route" id="stay-' + (i + 1) + '"><div class="route-head"><div style="display:flex;flex-direction:column;gap:4px">' +
          (s.tag ? '<span class="pick">' + esc(s.tag) + "</span>" : "") + "<h3>" + (i + 1) + " · " + esc(s.name) + '</h3></div><div class="total">' +
          (c ? fmt(c.v, cur) + '<span class="small muted" style="font-family:var(--f-body);font-weight:400">' + esc(t("perNightUnit")) + "</span>" : "—") + "</div></div>");
        var meta = [["metaTown", s.town], ["metaType", s.type], ["metaWalk", s.walk], ["metaToCore", s.toCore], ["metaBreakfast", s.breakfast], ["metaCancel", s.cancel]]
          .filter(function (m) { return m[1]; }).map(function (m) { return "<span>" + esc(t(m[0])) + " <b>" + esc(m[1]) + "</b></span>"; });
        if (meta.length) out.push('<div class="stay-meta">' + meta.join("") + "</div>");
        if (s.summary) out.push("<p>" + html(s.summary) + "</p>");
        if (s.prices && s.prices.length) {
          out.push('<div><div class="block-title">' + esc(t("channels")) + '</div><div class="channels"><span class="h">' + esc(t("chChannel")) + '</span><span class="h num">' + esc(t("chRating")) +
            '</span><span class="h num">' + esc(t("chPrice")) + "</span>");
          s.prices.forEach(function (p) {
            var v = num(p.perNight), isBest = c && v === c.v;
            out.push("<span>" + a(p.url, p.channel) + (p.note ? '<br><span class="small muted">' + html(p.note) + "</span>" : "") + '</span><span class="num">' + esc(p.rating || "—") +
              '</span><span class="num' + (isBest ? " best" : "") + '">' + fmt(v, cur) + (p.total != null ? " / " + fmt(num(p.total), cur) : "") + "</span>");
          });
          out.push("</div></div>");
        }
        out.push(list(s.notes));
        out.push("</section>");
      });
    }

    // 差点入选
    if (d.nearMiss && d.nearMiss.length) {
      out.push('<section class="excluded"><h2>' + esc(t("nearMiss")) + "</h2>" + d.nearMiss.map(function (n) {
        return '<div class="ex"><b>' + a(n.url, n.name) + (n.town ? '<span class="muted" style="font-weight:400"> · ' + esc(n.town) + "</span>" : "") +
          (n.price ? '<span class="muted" style="font-weight:400;font-family:var(--f-data)"> · ' + esc(n.price) + "</span>" : "") + "</b><span>" + html(n.why) + "</span></div>";
      }).join("") + "</section>");
    }

    // 户外运动与教练/团体
    if (d.activities && d.activities.length) {
      out.push('<section class="panel"><h2>' + esc(d.activitiesTitle || t("activities")) + "</h2>");
      d.activities.forEach(function (g) {
        out.push('<div class="sport"><h3>' + esc(g.sport) + "</h3>" + (g.note ? '<p class="small muted">' + html(g.note) + "</p>" : ""));
        (g.items || []).forEach(function (it) {
          var meta = [it.where, it.level, it.price, it.season, it.lang].filter(Boolean).map(esc).join(" · ");
          out.push('<div class="act"><span class="name">' + a(it.url, it.name) + (it.kind ? '<span class="muted" style="font-weight:400"> · ' + esc(it.kind) + "</span>" : "") + "</span>" +
            (meta ? '<span class="meta">' + meta + "</span>" : "") + (it.how ? '<span class="meta">' + html(it.how) + "</span>" : "") + "</div>");
        });
        out.push("</div>");
      });
      if (mapActivities.length) out.push('<div id="map-activities" class="mapbox"></div>' + mapNote());
      out.push("</section>");
    }

    // komoot 徒步路线
    if (d.hikes && d.hikes.length) {
      out.push('<section><h2 class="sec">' + esc(d.hikesTitle || t("hikes")) + '</h2><div class="scroll"><table class="wide"><thead><tr>' +
        ["thRoute", "thRated", "thDiff", "thDist", "thStart", "thSeason"].map(function (k) { return "<th>" + esc(t(k)) + "</th>"; }).join("") + "</tr></thead><tbody>");
      d.hikes.forEach(function (h) {
        var dk = { easy: 1, moderate: 1, hard: 1 }[h.difficulty] ? h.difficulty : "moderate";
        out.push("<tr><td>" + a(h.url, h.name) + (h.area ? '<br><span class="small muted">' + esc(h.area) + "</span>" : "") + "</td>" +
          '<td class="hike-rating">' + esc(h.rating || "—") + (h.count ? " <small>(" + esc(h.count) + ")</small>" : "") + "</td>" +
          '<td><span class="diff ' + dk + '"><i></i>' + esc(t(dk)) + "</span></td>" +
          '<td class="num">' + [h.distance, h.duration, h.ascent ? "↑" + h.ascent : ""].filter(Boolean).map(esc).join(" · ") + "</td>" +
          "<td>" + (h.start ? html(h.start) : "—") + "</td><td>" + (h.season ? html(h.season) : "—") + "</td></tr>");
      });
      out.push("</tbody></table></div>");
      if (d.hikesNote) out.push('<p class="small muted" style="margin-top:8px">' + html(d.hikesNote) + "</p>");
      if (mapHikes.length) out.push('<div id="map-hikes" class="mapbox"></div>' + mapNote());
      out.push("</section>");
    }

    // 排除的村镇 / 其他
    if (d.excluded && d.excluded.length) {
      out.push('<section class="excluded"><h2>' + esc(d.excludedTitle || t("excluded")) + "</h2>" + d.excluded.map(function (e) {
        return '<div class="ex"><b>' + esc(e.name) + "</b><span>" + html(e.why) + "</span></div>";
      }).join("") + "</section>");
    }

    // 页脚
    var f = d.footer || {};
    out.push("<footer><p>" + esc(t("queried", d.queriedAt || "")) + "</p>");
    (f.paragraphs || []).forEach(function (p) { out.push("<p>" + html(p) + "</p>"); });
    if (f.links && f.links.length) {
      out.push("<ul>" + f.links.map(function (row) {
        return "<li>" + (Array.isArray(row) ? row : [row]).map(function (l) { return a(l.url, l.text); }).join(" · ") + "</li>";
      }).join("") + "</ul>");
    }
    out.push("</footer>");

    app.className = "wrap";
    app.innerHTML = out.join("");

    buildMap("map-stays", mapStays);
    buildMap("map-activities", mapActivities);
    buildMap("map-hikes", mapHikes);
  }

  // 自绘的示意地图：没有任何外部依赖（不用联网、不用地图库），直接用坐标按等距投影画成 SVG。
  // 不是精确地理底图，只表示几个点之间的相对位置、方向和大致距离，小范围（同一个山谷/小镇圈）足够看懂。
  function buildMap(id, points) {
    var el = document.getElementById(id);
    if (!el) return;
    var pts = (points || []).filter(function (p) { return isNum(p.lat) && isNum(p.lng); });
    if (!pts.length) { if (el.parentNode) el.parentNode.removeChild(el); return; }
    try {
      var W = 640, H = 320, PAD = 36;
      var lats = pts.map(function (p) { return p.lat; });
      var lngs = pts.map(function (p) { return p.lng; });
      var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
      var minLng = Math.min.apply(null, lngs), maxLng = Math.max.apply(null, lngs);
      if (maxLat - minLat < 0.002) { var cLat = (minLat + maxLat) / 2; minLat = cLat - 0.01; maxLat = cLat + 0.01; }
      if (maxLng - minLng < 0.002) { var cLng = (minLng + maxLng) / 2; minLng = cLng - 0.01; maxLng = cLng + 0.01; }
      var cosLat = Math.max(0.15, Math.cos((minLat + maxLat) / 2 * Math.PI / 180)); // 按纬度修正经度方向的比例
      var spanX = (maxLng - minLng) * cosLat, spanY = maxLat - minLat;
      var scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
      var offX = PAD + ((W - PAD * 2) - spanX * scale) / 2;
      var offY = PAD + ((H - PAD * 2) - spanY * scale) / 2;
      function project(lat, lng) { return [offX + (lng - minLng) * cosLat * scale, offY + (maxLat - lat) * scale]; }

      // 比例尺：挑一个让比例尺长度落在 40–110px 之间的整数公里数
      var pxPerKm = scale / 111.32;
      var niceKm = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].reduce(function (best, km) {
        var px = km * pxPerKm;
        return (px >= 40 && px <= 110) ? km : best;
      }, null) || Math.max(1, Math.round(70 / pxPerKm));
      var barPx = niceKm * pxPerKm;

      var svg = ['<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img">'];
      svg.push('<rect width="' + W + '" height="' + H + '" class="map-bg"></rect>');
      for (var gx = 1; gx < 4; gx++) { var xg = (W / 4) * gx; svg.push('<line x1="' + xg + '" y1="0" x2="' + xg + '" y2="' + H + '" class="map-grid"></line>'); }
      for (var gy = 1; gy < 3; gy++) { var yg = (H / 3) * gy; svg.push('<line x1="0" y1="' + yg + '" x2="' + W + '" y2="' + yg + '" class="map-grid"></line>'); }
      svg.push('<g class="map-compass" transform="translate(' + (W - 28) + ',26)"><line x1="0" y1="11" x2="0" y2="-9"></line><polygon points="0,-13 -5,-3 5,-3"></polygon><text y="23" text-anchor="middle">N</text></g>');
      var sx = PAD, sy = H - 16;
      svg.push('<g class="map-scale"><line x1="' + sx + '" y1="' + sy + '" x2="' + (sx + barPx) + '" y2="' + sy + '"></line>' +
        '<line x1="' + sx + '" y1="' + (sy - 4) + '" x2="' + sx + '" y2="' + (sy + 4) + '"></line>' +
        '<line x1="' + (sx + barPx) + '" y1="' + (sy - 4) + '" x2="' + (sx + barPx) + '" y2="' + (sy + 4) + '"></line>' +
        '<text x="' + (sx + barPx / 2) + '" y="' + (sy - 7) + '" text-anchor="middle">' + niceKm + " km</text></g>");
      pts.forEach(function (p, i) {
        var xy = project(p.lat, p.lng), x = xy[0], y = xy[1];
        var cls = p.core ? "core" : (p.kind === "stay" ? "stay" : "");
        svg.push('<g><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (p.core ? 7 : 5) + '" class="map-dot ' + cls + '">' +
          (p.label ? "<title>" + esc(p.label) + "</title>" : "") + "</circle>");
        if (p.label) {
          var anchor = x > W - 90 ? "end" : (x < 90 ? "start" : "middle");
          svg.push('<text x="' + x.toFixed(1) + '" y="' + (y + (i % 2 === 0 ? -10 : 17)).toFixed(1) + '" text-anchor="' + anchor + '" class="map-label">' + esc(p.label) + "</text>");
        }
        svg.push("</g>");
      });
      svg.push("</svg>");
      el.innerHTML = svg.join("");
    } catch (e) {
      el.outerHTML = '<p class="small muted">' + esc(t("mapFail")) + esc(e.message) + "</p>";
    }
  }

  boot("stay-data");
})();
