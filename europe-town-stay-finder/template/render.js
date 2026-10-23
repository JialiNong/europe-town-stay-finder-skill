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
      if (isNum(s.lat) && isNum(s.lng)) mapStays.push({ lat: s.lat, lng: s.lng, kind: "stay", label: "#" + (i + 1) + " " + s.name });
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
        out.push('<div id="map-stays" class="mapbox"></div><div class="map-legend"><span><i style="background:#c0392b"></i>核心小镇</span><span><i style="background:#2e7d4f"></i>周边村镇</span><span><i style="background:#1f5f8f"></i>推荐住宿</span></div>');
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
      if (mapActivities.length) out.push('<div id="map-activities" class="mapbox"></div>');
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
      if (mapHikes.length) out.push('<div id="map-hikes" class="mapbox"></div>');
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

    initMap("map-stays", mapStays);
    initMap("map-activities", mapActivities);
    initMap("map-hikes", mapHikes);
  }

  // 用 Leaflet + OpenStreetMap 画点状地图；没有 Leaflet（例如离线打开）或没有坐标数据时跳过
  function initMap(id, points) {
    var el = document.getElementById(id);
    if (!el) return;
    if (typeof L === "undefined" || !points.length) { el.parentNode && el.parentNode.removeChild(el); return; }
    try {
      var map = L.map(id, { scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
      }).addTo(map);
      var latlngs = [];
      points.forEach(function (p) {
        var color = p.core ? "#c0392b" : (p.kind === "stay" ? "#1f5f8f" : "#2e7d4f");
        var marker = L.circleMarker([p.lat, p.lng], {
          radius: p.core ? 10 : 7, color: color, weight: 2, fillColor: color, fillOpacity: 0.85
        }).addTo(map);
        if (p.label) marker.bindTooltip(esc(p.label), { direction: "top", offset: [0, -6] });
        latlngs.push([p.lat, p.lng]);
      });
      if (latlngs.length === 1) map.setView(latlngs[0], 13);
      else map.fitBounds(L.latLngBounds(latlngs), { padding: [26, 26] });
    } catch (e) {
      el.outerHTML = '<p class="small muted">地图加载失败：' + esc(e.message) + "</p>";
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
