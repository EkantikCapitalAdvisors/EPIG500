/* EPIG 500 — Engine yield gauge (§2.3 Objective 1).
   Reads precomputed data/yield.json: monthly engine yield vs the 1%/month
   target, its rolling-12-month average, and the retire floor. ZERO financial
   math in the browser beyond formatting. Palette: gold = engine, slate/blue. */
(function () {
  "use strict";
  var el = document.getElementById("engineYieldGauge");
  if (!el) return;
  var GOLD = "#C8A951", SLATE = "#64748B", SLATE2 = "#8CA0BE", NAVY = "#1B2A4A", FLOOR = "#8CA0BE";
  var bust = "?t=" + Date.now();

  function pct(n, dp) { if (n == null || isNaN(n)) return "—"; dp = dp == null ? 2 : dp; return Number(n).toFixed(dp) + "%"; }
  function esc(s) { return String(s == null ? "" : s); }

  function empty(msg) { el.innerHTML = '<div class="score-empty">' + msg + '</div>'; }

  function statusChip(st) {
    var map = {
      on_track: ["on track", "pos"],
      below_floor: ["below target", "neu"],
      retire: ["RETIRE CONDITION MET", "neu"],
      accumulating: ["accumulating", "armed"]
    };
    var m = map[st] || map.accumulating;
    return '<span class="charter-chip charter-chip--' + m[1] + '">' + m[0] + '</span>';
  }

  function bars(months, target, floor) {
    if (!months.length) return "";
    var W = 1000, H = 220, PADL = 8, PADB = 26, PADT = 14, n = months.length;
    var vals = months.map(function (m) { return m.engine_yield_pct; });
    var hi = Math.max.apply(null, vals.concat([target, 0])) * 1.12 || 1.5;
    var lo = Math.min.apply(null, vals.concat([0])) * 1.12;
    var span = (hi - lo) || 1;
    var y = function (v) { return PADT + (H - PADB - PADT) * (1 - (v - lo) / span); };
    var step = (W - PADL - 12) / n, bw = Math.min(46, step * 0.6);
    var b = months.map(function (m, i) {
      var cx = PADL + step * (i + 0.5), yy = y(m.engine_yield_pct), y0 = y(0);
      var pos = m.engine_yield_pct >= 0;
      return '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + Math.min(yy, y0).toFixed(1) + '" width="' + bw.toFixed(1) +
             '" height="' + Math.max(Math.abs(yy - y0), 1).toFixed(1) + '" rx="2" fill="' + (pos ? GOLD : SLATE2) + '"><title>' + esc(m.label) + ': ' + pct(m.engine_yield_pct) + '</title></rect>' +
             ((i % Math.ceil(n / 14) === 0 || i === n - 1) ? '<text x="' + cx.toFixed(1) + '" y="' + (H - PADB + 16) + '" text-anchor="middle" font-size="10" fill="' + SLATE + '">' + esc(m.label.slice(2)) + '</text>' : '');
    }).join("");
    var tgt = '<line x1="' + PADL + '" y1="' + y(target).toFixed(1) + '" x2="' + (W - 12) + '" y2="' + y(target).toFixed(1) + '" stroke="' + GOLD + '" stroke-width="1.5" stroke-dasharray="6 4"/>' +
              '<text x="' + (W - 14) + '" y="' + (y(target) - 5).toFixed(1) + '" text-anchor="end" font-size="10.5" fill="' + GOLD + '">1%/mo target</text>';
    var flr = '<line x1="' + PADL + '" y1="' + y(floor).toFixed(1) + '" x2="' + (W - 12) + '" y2="' + y(floor).toFixed(1) + '" stroke="' + FLOOR + '" stroke-width="1" stroke-dasharray="3 3"/>' +
              '<text x="' + (W - 14) + '" y="' + (y(floor) - 5).toFixed(1) + '" text-anchor="end" font-size="10.5" fill="' + FLOOR + '">0.5% retire floor</text>';
    return '<div class="sleeve-chart"><p class="charter-panel-title" style="color:' + SLATE + '">Realized engine yield · by month · vs target &amp; retire floor</p>' +
      '<svg class="score-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Monthly engine yield vs the 1%/month target and 0.5% retire floor">' +
        '<line x1="' + PADL + '" y1="' + y(0).toFixed(1) + '" x2="' + (W - 12) + '" y2="' + y(0).toFixed(1) + '" stroke="#CBD5E1" stroke-width="1"/>' +
        b + tgt + flr +
      '</svg></div>';
  }

  fetch("data/yield.json" + bust, { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (d) {
      var st = d.state, months = d.months || [];
      if (st === "ENGINE_ONLY" || st === "STALE" || st === "ERROR" || !months.length) {
        empty("Accumulating — the engine yield gauge renders once the record is live and reporting monthly.");
        return;
      }
      var avg = d.rolling_avg_pct;
      el.innerHTML =
        '<div class="score-capture">' +
          '<div class="score-stat" style="border-top:3px solid ' + GOLD + '">' +
            '<p class="score-stat__label">Rolling engine yield · ' + esc(d.months_count) + ' mo ' + statusChip(d.gate_status) + '</p>' +
            '<div class="score-stat__val" style="color:' + GOLD + '">' + pct(avg) + '<span class="score-stat__unit"> / mo</span></div>' +
            '<p class="score-stat__desc">rolling-12-month average vs the <b>1%/month target</b>. Retires in public if this stays below <b>0.5%/month for 6 consecutive months</b>.</p>' +
          '</div>' +
          '<div class="score-stat">' +
            '<p class="score-stat__label">Latest month</p>' +
            '<div class="score-stat__val is-muted">' + pct(months[months.length - 1].engine_yield_pct) + '<span class="score-stat__unit"> / mo</span></div>' +
            '<p class="score-stat__desc">' + esc(months[months.length - 1].label) + ' · realized as positions closed. Variable — a target under trial, not a schedule.</p>' +
          '</div>' +
        '</div>' +
        bars(months, d.target_pct, d.floor_pct);
    })
    .catch(function () { empty("Engine yield gauge unavailable right now."); });
})();
