/* EPIG 500 — Charter Ledger modules renderer (CL-SPEC-V1.0 §7, §8).
   Reads precomputed data/{charter,nav,benchmark}.json. ZERO financial math in
   the browser beyond formatting — verdicts/indices/drawdowns are computed by
   the pipeline and rendered here as-is. Dependency-free.
   (This file is in modules/charter/ and is kept clear of §10.2 forbidden
   strings; the binding disclaimers live in the static dashboard.html markup.) */
(function () {
  "use strict";
  var board = document.getElementById("charterBoard");
  if (!board) return;                       // modules absent on this page
  var curves = document.getElementById("charterCurves");
  var provEl = document.getElementById("charterProv");

  var GOLD = "#C8A951", SLATE = "#64748B", SLATE2 = "#8CA0BE";
  var bust = "?t=" + Date.now();

  function pct(n) { return (n >= 0 ? "+" : "") + Number(n).toFixed(2) + "%"; }
  function esc(s) { return String(s == null ? "" : s); }

  // §5.3 STALE override — client re-derives staleness from last_sync_utc.
  function effectiveState(c) {
    if (c.state === "ERROR") return "ERROR";
    var ls = c.provenance && c.provenance.last_sync_utc;
    if (ls) {
      var age = (Date.now() - new Date(ls).getTime()) / 86400000;
      if (age > 3 && c.state !== "ENGINE_ONLY") return "STALE";
    }
    return c.state;
  }

  var NOTES = {
    ENGINE_ONLY: "The Charter Standard measures the full 80/20 + engine architecture against the S&P 500 total return. This account currently runs the engine sleeve only, so the gates are armed but not yet measuring. Measurement begins the day the account composition matches the published architecture — and that start date is published here.",
    STALE: "Data is older than 3 days. Verdicts suspended until the next successful custodian sync.",
    ERROR: "Last sync failed; prior data shown unverified. Verdicts suspended."
  };

  function chip(text, kind) { return '<span class="charter-chip charter-chip--' + kind + '">' + text + '</span>'; }

  function renderBoard(c) {
    var st = effectiveState(c);
    if (st === "ENGINE_ONLY" || st === "STALE" || st === "ERROR") {
      var label = st === "ENGINE_ONLY" ? "ARMED · NOT MEASURING"
                : st === "STALE" ? "STALE · last sync " + (c.provenance && c.provenance.last_sync_utc ? String(c.provenance.last_sync_utc).slice(0, 10) : "—")
                : "SYNC ERROR";
      board.innerHTML =
        '<div class="charter-gate" style="grid-column:1/-1">' +
          '<div class="charter-gate__head"><span class="charter-gate__title">The Charter Standard</span>' + chip(label, "armed") + '</div>' +
          '<p class="charter-note">' + esc(NOTES[st] || NOTES.ENGINE_ONLY) + '</p>' +
        '</div>';
      return;
    }
    if (st === "ACCUMULATING") {
      board.innerHTML =
        '<div class="charter-gate" style="grid-column:1/-1">' +
          '<div class="charter-gate__head"><span class="charter-gate__title">The Charter Standard</span>' +
            chip("ACCUMULATING · " + esc(c.trading_days) + " of " + esc(c.min_days), "armed") + '</div>' +
          '<p class="charter-note">Verdicts render at ' + esc(c.min_days) + ' trading days of custodian-reported NAV. Until then: numbers, no verdict.</p>' +
        '</div>';
      return;
    }
    // LIVE
    var s = c.strategy || {}, b = c.benchmark || {}, v = c.verdicts || {};
    var rg = v.return_gate, dg = v.drawdown_gate;
    var rgKind = rg === "AHEAD" ? "pos" : "neu";     // BEHIND rendered identical prominence, never red
    var dgKind = dg === "SHALLOWER" ? "pos" : "neu";
    board.innerHTML =
      '<div class="charter-gate">' +
        '<div class="charter-gate__head"><span class="charter-gate__title">Return Gate</span>' + chip(rg, rgKind) + '</div>' +
        '<div class="charter-row"><span class="lbl">Strategy</span><span class="val">' + pct(s.cum_return_pct) + '</span></div>' +
        '<div class="charter-row"><span class="lbl">S&amp;P 500 TR</span><span class="val">' + pct(b.cum_return_pct) + '</span></div>' +
        '<div class="charter-row charter-row--excess"><span class="lbl">Excess</span><span class="val">' + pct(c.excess_return_pct) + '</span></div>' +
      '</div>' +
      '<div class="charter-gate">' +
        '<div class="charter-gate__head"><span class="charter-gate__title">Drawdown Gate</span>' + chip(dg, dgKind) + '</div>' +
        '<div class="charter-row"><span class="lbl">Strategy</span><span class="val">' + pct(s.max_dd_pct) + '</span></div>' +
        '<div class="charter-row"><span class="lbl">S&amp;P 500 TR</span><span class="val">' + pct(b.max_dd_pct) + '</span></div>' +
        '<div class="charter-gate__foot">peak-to-trough, since inception</div>' +
      '</div>';
  }

  function renderProvenance(c, benchLabel) {
    if (!provEl) return;
    var p = c.provenance || {};
    provEl.innerHTML =
      "Source: Interactive Brokers Flex Query · NAV as reported by custodian · benchmark: " + esc(benchLabel || c.benchmark_label) +
      " · last sync " + esc(p.last_sync_utc || "—") +
      " · raw file sha256 " + esc(p.raw_sha256_short || "—") +
      (p.raw_commit_url ? ' · verify: <a href="' + esc(p.raw_commit_url) + '" target="_blank" rel="noopener">view commit</a>' : "");
  }

  // ---- Module 2: twin curves + underwater (SVG) --------------------------
  function renderCurves(nav, bench, charter) {
    if (!curves) return;
    var st = effectiveState(charter);
    var ns = (nav && nav.series) || [];
    if (st !== "LIVE" || ns.length < 5) {
      curves.innerHTML = '<div class="charter-empty">Record accumulating — chart renders at 5 trading days of the full architecture.</div>';
      return;
    }
    var bs = (bench && bench.series) || [];
    var bByDate = {}; bs.forEach(function (r) { bByDate[r.date] = r.index; });
    var pts = ns.filter(function (r) { return bByDate[r.date] != null; })
                .map(function (r) { return { date: r.date, s: r.index, b: bByDate[r.date] }; });
    if (pts.length < 5) { curves.innerHTML = '<div class="charter-empty">Record accumulating — chart renders at 5 trading days.</div>'; return; }

    // drawdowns (values are precomputed indices; DD is display arithmetic, not a verdict)
    function dd(arr, key) { var peak = -1e9; return arr.map(function (p) { peak = Math.max(peak, p[key]); return p[key] / peak - 1; }); }
    var sDD = dd(pts, "s"), bDD = dd(pts, "b");

    var W = 1000, HA = 300, HB = 135, PAD = 44, n = pts.length;
    var xs = function (i) { return PAD + (W - PAD - 16) * (i / (n - 1)); };
    var allIdx = pts.reduce(function (a, p) { return a.concat([p.s, p.b]); }, []);
    var lo = Math.min.apply(null, allIdx), hi = Math.max.apply(null, allIdx);
    var padY = (hi - lo) * 0.03 || 1; lo -= padY; hi += padY;
    var yA = function (v) { return 12 + (HA - 24) * (1 - (v - lo) / (hi - lo)); };
    var ddMin = Math.min.apply(null, sDD.concat(bDD).concat([-0.001]));
    var yB = function (v) { return 8 + (HB - 20) * (v / ddMin); };  // v<=0; 0 at top
    function path(fn, key, arr) { return pts.map(function (p, i) { return (i ? "L" : "M") + xs(i).toFixed(1) + " " + fn(arr ? arr[i] : p[key]).toFixed(1); }).join(" "); }
    function area(arr, hbase) { return "M" + xs(0).toFixed(1) + " " + hbase + " " + pts.map(function (p, i) { return "L" + xs(i).toFixed(1) + " " + yB(arr[i]).toFixed(1); }).join(" ") + " L" + xs(n - 1).toFixed(1) + " " + hbase + " Z"; }
    var benchMaxDD = Math.min.apply(null, bDD);

    curves.innerHTML =
      '<p class="charter-panel-title">Growth of 100 · strategy vs S&amp;P 500 total return · custodian-reported NAV</p>' +
      '<svg class="charter-svg" viewBox="0 0 ' + W + ' ' + HA + '" role="img" aria-label="Growth of 100: strategy vs S&P 500 total return since inception">' +
        '<path d="' + path(yA, "b") + '" fill="none" stroke="' + SLATE + '" stroke-width="1.5" stroke-dasharray="4 3"/>' +
        '<path d="' + path(yA, "s") + '" fill="none" stroke="' + GOLD + '" stroke-width="2"/>' +
      '</svg>' +
      '<div class="charter-legend">' +
        '<span><span class="sw" style="border-top-color:' + GOLD + '"></span>Strategy (index = 100 at inception)</span>' +
        '<span><span class="sw" style="border-top-color:' + SLATE + ';border-top-style:dashed"></span>S&amp;P 500 total return</span>' +
      '</div>' +
      '<p class="charter-panel-title">Drawdown · peak-to-trough · both series, same dates</p>' +
      '<svg class="charter-svg" viewBox="0 0 ' + W + ' ' + HB + '" role="img" aria-label="Underwater drawdown, peak-to-trough, both series">' +
        '<path d="' + area(bDD, 8) + '" fill="' + SLATE + '" fill-opacity="0.35"/>' +
        '<path d="' + area(sDD, 8) + '" fill="' + GOLD + '" fill-opacity="0.35"/>' +
        '<line x1="' + PAD + '" y1="' + yB(benchMaxDD).toFixed(1) + '" x2="' + (W - 16) + '" y2="' + yB(benchMaxDD).toFixed(1) + '" stroke="' + SLATE + '" stroke-width="1" stroke-dasharray="3 3"/>' +
      '</svg>';
  }

  function fail() {
    board.innerHTML = '<div class="charter-gate" style="grid-column:1/-1"><div class="charter-gate__head"><span class="charter-gate__title">The Charter Standard</span>' + chip("SYNC ERROR", "armed") + '</div><p class="charter-note">' + NOTES.ERROR + '</p></div>';
    if (curves) curves.innerHTML = '<div class="charter-empty">Charter data unavailable right now.</div>';
  }

  Promise.all([
    fetch("data/charter.json" + bust, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : Promise.reject(); }),
    fetch("data/nav.json" + bust, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
    fetch("data/benchmark.json" + bust, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
  ]).then(function (res) {
    var charter = res[0], nav = res[1], bench = res[2];
    renderBoard(charter);
    renderProvenance(charter, bench && bench.label);
    renderCurves(nav, bench, charter);
  }).catch(fail);
})();
