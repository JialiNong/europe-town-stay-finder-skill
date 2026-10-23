/* europe-town-stay-finder 住宿对比页渲染器 v1
 * 读取页面里 <script type="application/json" id="stay-data"> 的 JSON，渲染成对比页。
 * 预算区间、每家的最低价渠道、表格里的最低价都自动计算。
 * 标了「html」的字段允许 <b> <a> <br> 等行内标签，其余字段按纯文本处理。
 */
(function () {
  "use strict";
  var app = document.getElementById("app") || document.body.appendChild(document.createElement("div"));

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function html(s) { return s == null ? "" : String(s); }
  function num(s) {
    if (typeof s === "number") return s;
    var m = String(s == null ? "" : s).replace(/,/g, ".").match(/\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
  }
  function a(url, text) {
    return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(text) + "</a>" : esc(text);
  }
  function list(items) {
    return items && items.length ? '<ul class="notes">' + items.map(function (x) { return "<li>" + html(x) + "</li>"; }).join("") + "</ul>" : "";
  }
  function fmt(v, cur) { return isNaN(v) ? "—" : (Math.round(v * 100) / 100) + cur; }

  function isNum(v) { return typeof v === "number" && !isNaN(v); }

  function render(d) {
    var cur = (d.budget && d.budget.currency) || "€";
    var B = d.budget ? num(d.budget.perNight) : NaN;
    var out = [];

    out.push('<div class="toolbar no-print"><button type="button" onclick="window.print()">导出 / 打印 PDF</button></div>');

    // 地图用的点：住宿（村镇 + 住宿自己的坐标）、户外运动、komoot 路线
    var mapStays = [];
    (d.towns || []).forEach(function (t) {
      if (isNum(t.lat) && isNum(t.lng)) mapStays.push({ lat: t.lat, lng: t.lng, core: !!t.core, label: t.name + (t.core ? "（核心小镇）" : "") });
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
        if (isNum(it.lat) && isNum(it.lng)) mapActivities.push({ lat: it.lat, lng: it.lng, label: g.sport + "：" + it.name });
      });
    });
    var mapHikes = (d.hikes || []).filter(function (h) { return isNum(h.lat) && isNum(h.lng); }).map(function (h) {
      return { lat: h.lat, lng: h.lng, label: h.name + (h.rating ? "（" + h.rating + "★）" : "") };
    });

    // 预算区间：×0.9–1.1 预算内；×0.8–0.9 / ×1.1–1.2 浮动
    function band(p) {
      if (isNaN(B) || isNaN(p)) return "";
      var r = p / B;
      if (r >= 0.9 && r <= 1.1) return '<span class="band in">预算内</span>';
      if (r >= 0.8 && r < 0.9) return '<span class="band float">低于预算 ' + Math.round((1 - r) * 100) + "%</span>";
      if (r > 1.1 && r <= 1.2) return '<span class="band float">超预算 ' + Math.round((r - 1) * 100) + "%</span>";
      if (r < 0.8) return '<span class="band">远低于预算</span>';
      return '<span class="band">超预算 ' + Math.round((r - 1) * 100) + "%</span>";
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
    var eyebrow = d.eyebrow || [d.town, d.dateLabel, d.nights ? d.nights + " 晚" : "", "第 " + (d.version || 1) + " 版"].filter(Boolean).join(" · ");
    out.push('<header><div class="eyebrow">' + esc(eyebrow) + "</div>");
    out.push("<h1>" + esc(d.heading || (d.town + " 及周边住宿")) + "</h1>");
    if (!isNaN(B)) {
      out.push('<div class="budget"><span>每晚预算 <b>' + fmt(B, cur) + "</b></span><span>预算内 <b>" + fmt(B * 0.9, cur) + "–" + fmt(B * 1.1, cur) +
        "</b></span><span>浮动区间 <b>" + fmt(B * 0.8, cur) + "–" + fmt(B * 1.2, cur) + "</b></span></div>");
    }
    if (d.intro) out.push('<p class="route-line">' + html(d.intro) + "</p>");
    out.push("</header>");

    // 结论
    if (d.verdict) {
      out.push('<div class="verdict"><h2>结论</h2>' + (d.verdict.items ? "<ul>" + d.verdict.items.map(function (x) { return "<li>" + html(x) + "</li>"; }).join("") + "</ul>" : ""));
      (d.verdict.alerts || (d.verdict.alert ? [d.verdict.alert] : [])).forEach(function (x) { out.push('<p class="alert">' + html(x) + "</p>"); });
      out.push("</div>");
    }

    // 公交 1 小时圈
    var towns = d.towns || [];
    if (towns.length) {
      out.push('<section><h2 class="sec">' + esc(d.townsTitle || "公交 1 小时圈") + '</h2><div class="scroll"><table class="wide"><thead><tr><th>村镇</th><th>到核心小镇</th><th>换乘</th><th>班次</th><th>末班回村</th><th>单程票价</th><th>游客卡 / 城市税</th></tr></thead><tbody>');
      towns.forEach(function (t) {
        out.push('<tr class="' + (t.core ? "core-row" : "") + '"><td>' + esc(t.name) + (t.core ? '<span class="core-mark">核心小镇</span>' : "") + "</td>" +
          '<td class="num">' + esc(t.core ? "—" : (t.time || "—")) + (t.mode && !t.core ? '<br><span class="small muted">' + esc(t.mode) + "</span>" : "") + "</td>" +
          '<td class="num">' + esc(t.core ? "—" : (t.transfers == null ? "—" : t.transfers)) + "</td>" +
          '<td style="white-space:nowrap">' + esc(t.freq || "—") + '</td><td class="num">' + esc(t.lastBack || "—") + '</td><td class="num">' + esc(t.fare || "—") + "</td>" +
          "<td>" + html(t.guestCard || "—") + (t.cityTax ? '<br><span class="small muted">城市税 ' + esc(t.cityTax) + "</span>" : "") + "</td></tr>");
      });
      out.push("</tbody></table></div>");
      if (d.townsNote) out.push('<p class="small muted" style="margin-top:8px">' + html(d.townsNote) + "</p>");
      if (mapStays.length) {
        out.push('<div id="map-stays" class="mapbox"></div><div class="map-legend"><span><i style="background:#c0392b"></i>核心小镇</span><span><i style="background:#2e7d4f"></i>周边村镇</span><span><i style="background:#1f5f8f"></i>推荐住宿</span></div>' +
          '<p class="small muted" style="margin-top:6px">示意位置图，不是精确地理底图；鼠标悬停或点开看名字。</p>');
      }
      out.push("</section>");
    }

    // 住宿总览表
    var stays = d.stays || [];
    if (stays.length) {
      var mins = stays.map(function (s) { var c = cheapest(s); return c ? c.v : NaN; });
      var lowest = Math.min.apply(null, mins.filter(function (v) { return !isNaN(v); }));
      out.push('<section><h2 class="sec">' + esc(d.staysTitle || "住宿总览") + '</h2><div class="scroll"><table class="wide"><thead><tr><th>#</th><th>住宿</th><th>村镇</th><th>房型</th><th>评分</th><th>到车站</th><th>每晚最低</th><th>在哪订</th></tr></thead><tbody>');
      stays.forEach(function (s, i) {
        var c = cheapest(s);
        var ratings = (s.prices || []).filter(function (p) { return p.rating; }).map(function (p) { return p.channel + " " + p.rating; });
        out.push('<tr><td class="num">' + (i + 1) + "</td><td>" + esc(s.name) + "</td><td>" + esc(s.town) + "</td><td>" + esc(s.type || "—") + '</td><td class="num">' + esc(ratings.join(" / ") || "—") +
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
          (c ? fmt(c.v, cur) + '<span class="small muted" style="font-family:var(--f-body);font-weight:400"> /晚</span>' : "—") + "</div></div>");
        var meta = [["村镇", s.town], ["房型", s.type], ["到车站", s.walk], ["到核心小镇", s.toCore], ["早餐", s.breakfast], ["取消", s.cancel]]
          .filter(function (m) { return m[1]; }).map(function (m) { return "<span>" + m[0] + " <b>" + esc(m[1]) + "</b></span>"; });
        if (meta.length) out.push('<div class="stay-meta">' + meta.join("") + "</div>");
        if (s.summary) out.push("<p>" + html(s.summary) + "</p>");
        if (s.prices && s.prices.length) {
          out.push('<div><div class="block-title">各渠道价格</div><div class="channels"><span class="h">渠道</span><span class="h num">评分</span><span class="h num">每晚 / 全程</span>');
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
      out.push('<section class="excluded"><h2>差点入选</h2>' + d.nearMiss.map(function (n) {
        return '<div class="ex"><b>' + a(n.url, n.name) + (n.town ? '<span class="muted" style="font-weight:400"> · ' + esc(n.town) + "</span>" : "") +
          (n.price ? '<span class="muted" style="font-weight:400;font-family:var(--f-data)"> · ' + esc(n.price) + "</span>" : "") + "</b><span>" + html(n.why) + "</span></div>";
      }).join("") + "</section>");
    }

    // 户外运动与教练/团体
    if (d.activities && d.activities.length) {
      out.push('<section class="panel"><h2>' + esc(d.activitiesTitle || "户外运动与教练、团体") + "</h2>");
      d.activities.forEach(function (g) {
        out.push('<div class="sport"><h3>' + esc(g.sport) + "</h3>" + (g.note ? '<p class="small muted">' + html(g.note) + "</p>" : ""));
        (g.items || []).forEach(function (it) {
          var meta = [it.where, it.level, it.price, it.season, it.lang].filter(Boolean).map(esc).join(" · ");
          out.push('<div class="act"><span class="name">' + a(it.url, it.name) + (it.kind ? '<span class="muted" style="font-weight:400"> · ' + esc(it.kind) + "</span>" : "") + "</span>" +
            (meta ? '<span class="meta">' + meta + "</span>" : "") + (it.how ? '<span class="meta">' + html(it.how) + "</span>" : "") + "</div>");
        });
        out.push("</div>");
      });
      if (mapActivities.length) out.push('<div id="map-activities" class="mapbox"></div><p class="small muted" style="margin-top:6px">示意位置图，不是精确地理底图；鼠标悬停或点开看名字。</p>');
      out.push("</section>");
    }

    // komoot 徒步路线
    if (d.hikes && d.hikes.length) {
      var dmap = { easy: "简单", moderate: "中等", hard: "困难" };
      out.push('<section><h2 class="sec">' + esc(d.hikesTitle || "komoot 高分徒步路线") + '</h2><div class="scroll"><table class="wide"><thead><tr><th>路线</th><th>评分（人数）</th><th>难度</th><th>距离 · 时长 · 爬升</th><th>起点和公交</th><th>季节</th></tr></thead><tbody>');
      d.hikes.forEach(function (h) {
        var dk = dmap[h.difficulty] ? h.difficulty : "moderate";
        out.push("<tr><td>" + a(h.url, h.name) + (h.area ? '<br><span class="small muted">' + esc(h.area) + "</span>" : "") + "</td>" +
          '<td class="hike-rating">' + esc(h.rating) + " <small>(" + esc(h.count) + ")</small></td>" +
          '<td><span class="diff ' + dk + '"><i></i>' + dmap[dk] + "</span></td>" +
          '<td class="num">' + [h.distance, h.duration, h.ascent ? "↑" + h.ascent : ""].filter(Boolean).map(esc).join(" · ") + "</td>" +
          "<td>" + html(h.start || "—") + "</td><td>" + html(h.season || "—") + "</td></tr>");
      });
      out.push("</tbody></table></div>");
      if (d.hikesNote) out.push('<p class="small muted" style="margin-top:8px">' + html(d.hikesNote) + "</p>");
      if (mapHikes.length) out.push('<div id="map-hikes" class="mapbox"></div><p class="small muted" style="margin-top:6px">示意位置图，不是精确地理底图；鼠标悬停或点开看名字。</p>');
      out.push("</section>");
    }

    // 排除的村镇 / 其他
    if (d.excluded && d.excluded.length) {
      out.push('<section class="excluded"><h2>' + esc(d.excludedTitle || "排除的村镇") + "</h2>" + d.excluded.map(function (e) {
        return '<div class="ex"><b>' + esc(e.name) + "</b><span>" + html(e.why) + "</span></div>";
      }).join("") + "</section>");
    }

    // 页脚
    var f = d.footer || {};
    out.push("<footer><p>查询时间：" + esc(d.queriedAt || "") + "。价格是查询时的快照，以平台为准。</p>");
    (f.paragraphs || []).forEach(function (p) { out.push("<p>" + html(p) + "</p>"); });
    if (f.links && f.links.length) {
      out.push("<ul>" + f.links.map(function (row) {
        return "<li>" + (Array.isArray(row) ? row : [row]).map(function (l) { return a(l.url, l.text); }).join(" · ") + "</li>";
      }).join("") + "</ul>");
    }
    out.push("</footer>");

    app.className = "wrap";
    app.innerHTML = out.join("");
    if (d.title) document.title = d.title;

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
    if (!pts.length) { el.parentNode && el.parentNode.removeChild(el); return; }
    try {
      var W = 640, H = 320, PAD = 36;
      var lats = pts.map(function (p) { return p.lat; });
      var lngs = pts.map(function (p) { return p.lng; });
      var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
      var minLng = Math.min.apply(null, lngs), maxLng = Math.max.apply(null, lngs);
      if (maxLat - minLat < 0.002) { var cLat = (minLat + maxLat) / 2; minLat = cLat - 0.01; maxLat = cLat + 0.01; }
      if (maxLng - minLng < 0.002) { var cLng = (minLng + maxLng) / 2; minLng = cLng - 0.01; maxLng = cLng + 0.01; }
      var cosLat = Math.max(0.15, Math.cos((minLat + maxLat) / 2 * Math.PI / 180)); // 按纬度修正经度方向的比例，避免东西方向被拉宽
      var spanX = (maxLng - minLng) * cosLat, spanY = maxLat - minLat;
      var scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
      var offX = PAD + ((W - PAD * 2) - spanX * scale) / 2;
      var offY = PAD + ((H - PAD * 2) - spanY * scale) / 2;
      function project(lat, lng) {
        return [offX + (lng - minLng) * cosLat * scale, offY + (maxLat - lat) * scale];
      }

      // 比例尺：挑一个让比例尺长度落在 40–110px 之间的整数公里数
      var pxPerKm = scale / 111.32;
      var niceKm = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].reduce(function (best, km) {
        var px = km * pxPerKm;
        return (px >= 40 && px <= 110) ? km : best;
      }, null) || Math.round(70 / pxPerKm) || 1;
      var barPx = niceKm * pxPerKm;

      var svg = [];
      svg.push('<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">');
      svg.push('<rect width="' + W + '" height="' + H + '" class="map-bg"></rect>');
      for (var gx = 1; gx < 4; gx++) { var xg = (W / 4) * gx; svg.push('<line x1="' + xg + '" y1="0" x2="' + xg + '" y2="' + H + '" class="map-grid"></line>'); }
      for (var gy = 1; gy < 3; gy++) { var yg = (H / 3) * gy; svg.push('<line x1="0" y1="' + yg + '" x2="' + W + '" y2="' + yg + '" class="map-grid"></line>'); }

      // 指北针
      svg.push('<g class="map-compass" transform="translate(' + (W - 28) + ',26)">' +
        '<line x1="0" y1="11" x2="0" y2="-9"></line><polygon points="0,-13 -5,-3 5,-3"></polygon>' +
        '<text y="23" text-anchor="middle">N</text></g>');

      // 比例尺
      var sx = PAD, sy = H - 16;
      svg.push('<g class="map-scale">' +
        '<line x1="' + sx + '" y1="' + sy + '" x2="' + (sx + barPx) + '" y2="' + sy + '"></line>' +
        '<line x1="' + sx + '" y1="' + (sy - 4) + '" x2="' + sx + '" y2="' + (sy + 4) + '"></line>' +
        '<line x1="' + (sx + barPx) + '" y1="' + (sy - 4) + '" x2="' + (sx + barPx) + '" y2="' + (sy + 4) + '"></line>' +
        '<text x="' + (sx + barPx / 2) + '" y="' + (sy - 7) + '" text-anchor="middle">' + (niceKm < 1 ? niceKm : niceKm) + ' km</text></g>');

      // 点和标签（示意位置，标签交替上下/贴边自动靠内，避免被裁切）
      pts.forEach(function (p, i) {
        var xy = project(p.lat, p.lng);
        var x = xy[0], y = xy[1];
        var cls = p.core ? "core" : (p.kind === "stay" ? "stay" : "");
        var r = p.core ? 7 : 5;
        svg.push('<g>');
        svg.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r + '" class="map-dot ' + cls + '">' +
          (p.label ? "<title>" + esc(p.label) + "</title>" : "") + "</circle>");
        if (p.label) {
          var dy = i % 2 === 0 ? -10 : 17;
          var anchor = x > W - 90 ? "end" : (x < 90 ? "start" : "middle");
          svg.push('<text x="' + x.toFixed(1) + '" y="' + (y + dy).toFixed(1) + '" text-anchor="' + anchor + '" class="map-label">' + esc(p.label) + "</text>");
        }
        svg.push("</g>");
      });
      svg.push("</svg>");
      el.innerHTML = svg.join("");
    } catch (e) {
      el.outerHTML = '<p class="small muted">地图渲染失败：' + esc(e.message) + "</p>";
    }
  }

  try {
    var el = document.getElementById("stay-data");
    if (!el) throw new Error("页面里没有找到 id=\"stay-data\" 的 JSON。");
    render(JSON.parse(el.textContent));
  } catch (e) {
    app.className = "wrap";
    app.innerHTML = '<div class="render-error">住宿页渲染失败：' + esc(e.message) + "</div>";
  }
})();
