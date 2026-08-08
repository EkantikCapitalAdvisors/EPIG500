/* EPIG 500 — Return-by-sleeve renderer (Intraday Engine vs Foundational SPY).
   Reads precomputed data/sleeves.json (per-symbol MTM contribution to return,
   computed by the pipeline). ZERO financial math here beyond formatting.
   Palette: Engine = Warm Gold, Foundational = Slate-blue. */
(function () {
  "use strict";
  var el = document.getElementById("sleeveBreakdown");
  if (!el) return;

  var GOLD = "#C8A951", BLUE = "#5E83B3", SLATE = "#64748B", SLATE2 = "#8CA0BE";
  var bust = "?t=" + Date.now();

  function money(n) {
    if (n == null || isNaN(n)) return "—";
    var v = Math.round(Number(n));
    return (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-US");
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

  function empty(msg) { el.innerHTML = '<div class="score-empty">' + msg + '</div>'; }

  function card(label, cumPnl, pctOfTotal, color) {
    var pct = "";
    if (pctOfTotal != null && !isNaN(pctOfTotal)) {
      pct = '<p class="score-stat__desc"><b>' + Number(pctOfTotal).toFixed(0) + '% of total return</b> · cumulative contribution since inception.</p>';
    } else {
      pct = '<p class="score-stat__desc">cumulative contribution since inception.</p>';
    }
    return '<div class="score-stat sleeve-stat" style="border-top:3px solid ' + color + '">' +
      '<p class="score-stat__label">' + esc(label) + '</p>' +
      '<div class="score-stat__val" style="color:' + color + '">' + money(cumPnl) + '</div>' +
      pct +
    '</div>';
  }

  // cumulative $ contribution over time — two lines (engine, foundation)
  function chart(series) {
    var pts = series.filter(function (r) { return r.date; });
    if (pts.length < 2) return "";
    var W = 1000, H = 260, PADL = 8, PADB = 26, PADT = 12, n = pts.length;
    var vals = pts.reduce(function (a, r) { return a.concat([r.engine_cum_pnl, r.foundation_cum_pnl, 0]); }, []);
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
    var x = function (i) { return PADL + (W - PADL - 12) * (i / (n - 1)); };
    var y = function (v) { return PADT + (H - PADB - PADT) * (1 - (v - lo) / (hi - lo)); };
    var zeroY = y(0);
    function path(key, color) {
      var d = pts.map(function (r, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(r[key]).toFixed(1); }).join(" ");
      return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2.5"/>';
    }
    var labelEvery = Math.ceil(n / 12);
    var xlabels = pts.map(function (r, i) {
      if (i % labelEvery && i !== n - 1) return "";
      return '<text x="' + x(i).toFixed(1) + '" y="' + (H - PADB + 16) + '" text-anchor="middle" font-size="10.5" fill="' + SLATE + '">' + esc(r.date.slice(5)) + '</text>';
    }).join("");
    return '<div class="sleeve-chart">' +
      '<p class="charter-panel-title" style="color:' + SLATE + '">Cumulative $ contribution · since inception</p>' +
      '<svg class="score-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Cumulative dollar contribution: Intraday Engine vs Foundational SPY">' +
        '<line x1="' + PADL + '" y1="' + zeroY.toFixed(1) + '" x2="' + (W - 12) + '" y2="' + zeroY.toFixed(1) + '" stroke="#CBD5E1" stroke-width="1" stroke-dasharray="3 3"/>' +
        path("foundation_cum_pnl", BLUE) + path("engine_cum_pnl", GOLD) +
        xlabels +
      '</svg>' +
      '<div class="sleeve-legend">' +
        '<span><span class="sw" style="background:' + GOLD + '"></span>Intraday Engine</span>' +
        '<span><span class="sw" style="background:' + BLUE + '"></span>Foundational (SPY)</span>' +
      '</div>' +
    '</div>';
  }

  fetch("data/sleeves.json" + bust, { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (d) {
      var st = d.state;
      if (st === "ENGINE_ONLY" || st === "STALE" || st === "ERROR" || !d.series || !d.series.length) {
        empty("Accumulating — the sleeve breakdown renders once the account is funded and reporting per-symbol P&amp;L.");
        return;
      }
      el.innerHTML =
        '<div class="score-capture">' +
          card(d.engine_label || "Intraday Engine", d.engine_cum_pnl, d.engine_pct_of_pnl, GOLD) +
          card(d.foundation_label || "Foundational (SPY)", d.foundation_cum_pnl, d.foundation_pct_of_pnl, BLUE) +
        '</div>' +
        chart(d.series) +
        '<p class="sleeve-note">Split by holding: <b>Foundational</b> is the SPY ETF; <b>Intraday Engine</b> is every other symbol (futures, options, non-SPY). Each figure is that sleeve’s contribution to the account’s return; the two sum to the total. Gross of fees.</p>';
    })
    .catch(function () { empty("Sleeve breakdown unavailable right now."); });
})();
