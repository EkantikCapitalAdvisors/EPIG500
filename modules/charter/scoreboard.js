/* EPIG 500 — Charter Scoreboard renderer.
   Reads precomputed data/periodic.json (weekly + monthly). ZERO financial
   math in the browser beyond formatting — period returns, beat tally, and
   upside/downside capture are all computed by the pipeline. Dependency-free.
   Palette: Warm Gold = strategy, Slate = S&P 500; red is never used. */
(function () {
  "use strict";
  var periodsEl = document.getElementById("scorePeriods");
  if (!periodsEl) return;                    // not the scoreboard page
  var captureEl = document.getElementById("scoreCapture");
  var tallyEl = document.getElementById("scoreBeatTally");
  var metaEl = document.getElementById("scoreToggleMeta");
  var chips = Array.prototype.slice.call(document.querySelectorAll(".score-chip"));
  var winChips = Array.prototype.slice.call(document.querySelectorAll(".score-win"));
  var datesEl = document.getElementById("scoreDates");
  var fromEl = document.getElementById("scoreFrom");
  var toEl = document.getElementById("scoreTo");

  var GOLD = "#C8A951", GOLD_DK = "#b8962e", SLATE = "#64748B", SLATE2 = "#8CA0BE", NAVY = "#1B2A4A";
  var bust = "?t=" + Date.now();
  var DATA = null, freq = "weekly", win = "all";

  // ---- windowing: filter precomputed period returns, re-aggregate tally +
  // capture (period returns themselves are pipeline-computed; this only slices
  // and averages them — the capture formula mirrors charter_sync.capture_ratios). --
  function inWindow(r) {
    if (win === "all") return true;
    var d = r.end;
    if (win === "ytd") { return d >= (new Date().getFullYear()) + "-01-01"; }
    if (win === "custom") {
      var f = fromEl && fromEl.value, t = toEl && toEl.value;
      return (!f || d >= f) && (!t || d <= t);
    }
    return true;
  }
  function windowBlock(blk) {
    if (win === "all") return blk;
    var rows = (blk.periods || []).filter(inWindow);
    function avg(b, k) { return b.reduce(function (a, r) { return a + r[k]; }, 0) / b.length; }
    function cap(b) { if (!b.length) return null; var mb = avg(b, "bench_ret_pct"); if (Math.abs(mb) < 1e-9) return null; return Math.round(avg(b, "strat_ret_pct") / mb * 1000) / 10; }
    var up = rows.filter(function (r) { return r.bench_ret_pct > 0; });
    var dn = rows.filter(function (r) { return r.bench_ret_pct < 0; });
    return {
      periods: rows, beat_count: rows.filter(function (r) { return r.beat; }).length, total: rows.length,
      upside_capture_pct: cap(up), downside_capture_pct: cap(dn),
      up_periods: up.length, down_periods: dn.length,
      min_periods: blk.min_periods, capture_ready: rows.length >= blk.min_periods
    };
  }

  function pct(n, dp) { if (n == null || isNaN(n)) return "—"; dp = dp == null ? 2 : dp; return (n >= 0 ? "+" : "") + Number(n).toFixed(dp) + "%"; }
  function noun(n) { return freq === "weekly" ? (n === 1 ? "week" : "weeks") : (n === 1 ? "month" : "months"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

  function emptyStates() {
    periodsEl.innerHTML = '<div class="score-empty">Accumulating — the period-by-period record renders once the full architecture is measuring.</div>';
    if (captureEl) captureEl.innerHTML = '<div class="score-empty">Accumulating — capture figures render as the record builds.</div>';
    if (tallyEl) tallyEl.textContent = "Awaiting the first measured period.";
    if (metaEl) metaEl.textContent = "not yet measuring";
  }

  function caveat(text) {
    return '<div class="score-caveat"><span class="diamond">◆</span><span>' + text + '</span></div>';
  }

  // ---- Section 2: beat bars + tally + table -------------------------------
  function renderPeriods(blk) {
    var rows = blk.periods || [];
    if (tallyEl) {
      tallyEl.innerHTML = '<span class="score-tally">Beat the S&amp;P 500 in <b>' + blk.beat_count + '</b> of <b>' + blk.total + '</b> ' + noun(blk.total) + '.</span>';
    }
    if (metaEl) metaEl.textContent = blk.total + " " + noun(blk.total) + " · " + winLabel();
    if (!rows.length) {
      periodsEl.innerHTML = '<div class="score-empty">No measured ' + noun(0) + ' in this window.</div>';
      return;
    }
    periodsEl.innerHTML = barsSvg(rows) + tableHtml(rows);
  }

  function barsSvg(rows) {
    var W = 1000, H = 300, PAD_L = 40, PAD_B = 46, PAD_T = 16, n = rows.length;
    var maxAbs = Math.max.apply(null, rows.map(function (r) { return Math.abs(r.diff_pct); }).concat([0.5]));
    var plotH = H - PAD_B - PAD_T, zeroY = PAD_T + plotH / 2, half = plotH / 2;
    var step = (W - PAD_L - 10) / n, bw = Math.min(46, step * 0.6);
    var yFor = function (v) { return zeroY - (v / maxAbs) * half; };
    var labelEvery = Math.ceil(n / 16);
    var bars = rows.map(function (r, i) {
      var cx = PAD_L + step * (i + 0.5);
      var y = yFor(r.diff_pct), h = Math.abs(zeroY - y);
      var fill = r.beat ? GOLD : SLATE2;
      var lbl = (i % labelEvery === 0)
        ? '<text x="' + cx.toFixed(1) + '" y="' + (H - PAD_B + 16) + '" text-anchor="middle" font-size="10.5" fill="' + SLATE + '">' + esc(shortLabel(r.label)) + '</text>'
        : '';
      return '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + Math.min(y, zeroY).toFixed(1) + '" width="' + bw.toFixed(1) +
             '" height="' + Math.max(h, 1).toFixed(1) + '" rx="2" fill="' + fill + '"><title>' + esc(r.label) + ': strategy ' + pct(r.strat_ret_pct) + ' vs S&P ' + pct(r.bench_ret_pct) + ' (' + pct(r.diff_pct) + ')</title></rect>' + lbl;
    }).join("");
    return '' +
      '<div class="score-bars">' +
        '<div class="score-bars__legend">' +
          '<span><span class="sw" style="background:' + GOLD + '"></span>Beat the S&amp;P this period</span>' +
          '<span><span class="sw" style="background:' + SLATE2 + '"></span>Trailed the S&amp;P this period</span>' +
        '</div>' +
        '<svg class="score-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Excess return versus the S&P 500 total return, each ' + noun(1) + '">' +
          '<line x1="' + PAD_L + '" y1="' + zeroY.toFixed(1) + '" x2="' + (W - 6) + '" y2="' + zeroY.toFixed(1) + '" stroke="#CBD5E1" stroke-width="1"/>' +
          '<text x="6" y="' + (PAD_T + 8) + '" font-size="10.5" fill="' + SLATE + '">+' + maxAbs.toFixed(1) + '%</text>' +
          '<text x="6" y="' + (H - PAD_B) + '" font-size="10.5" fill="' + SLATE + '">-' + maxAbs.toFixed(1) + '%</text>' +
          bars +
        '</svg>' +
        '<p class="score-bars__note">Bar = strategy return minus S&amp;P 500 total return that ' + noun(1) + '. Above the line = beat; below = trailed. Gross of fees.</p>' +
      '</div>';
  }

  function shortLabel(l) { return String(l).replace(" 2026", "").replace(/–\d+.*/, function (m) { return m; }); }

  function tableHtml(rows) {
    var body = rows.slice().reverse().map(function (r) {
      return '<tr>' +
        '<td>' + esc(r.label) + '</td>' +
        '<td class="val-strat">' + pct(r.strat_ret_pct) + '</td>' +
        '<td class="val-bench">' + pct(r.bench_ret_pct) + '</td>' +
        '<td>' + pct(r.diff_pct) + '</td>' +
        '<td class="' + (r.beat ? "beat-yes" : "beat-no") + '">' + (r.beat ? "BEAT" : "trailed") + '</td>' +
      '</tr>';
    }).join("");
    return '<div class="score-table-wrap"><table class="score-table">' +
      '<thead><tr><th>' + (freq === "weekly" ? "Week" : "Month") + '</th><th>Strategy</th><th>S&amp;P 500 TR</th><th>+/−</th><th>Result</th></tr></thead>' +
      '<tbody>' + body + '</tbody></table></div>';
  }

  // ---- Section 3: capture stats + scatter ---------------------------------
  function renderCapture(blk) {
    if (!captureEl) return;
    var rows = blk.periods || [];
    if (!rows.length) {
      captureEl.innerHTML = '<div class="score-empty">No measured ' + noun(0) + ' yet.</div>';
      return;
    }
    var cav = blk.capture_ready ? "" : caveat("Small sample — <b>" + blk.total + " " + noun(blk.total) + "</b> measured. Capture figures stabilise near " + blk.min_periods + " " + noun(blk.min_periods) + "; early readings swing.");
    captureEl.innerHTML =
      cav +
      '<div class="score-capture">' +
        statUpside(blk.upside_capture_pct, blk.up_periods) +
        statDownside(blk.downside_capture_pct, blk.down_periods) +
      '</div>' +
      scatterSvg(rows);
  }

  function statCard(label, nper, body, tag, desc) {
    return '<div class="score-stat">' +
      '<p class="score-stat__label">' + label + (nper ? ' · ' + nper + ' ' + noun(nper) : '') + '</p>' +
      body +
      '<p class="score-stat__desc">' + (tag ? '<b>' + tag + '</b> · ' : '') + desc + '.</p>' +
    '</div>';
  }

  function statUpside(val, nper) {
    if (val == null) return statCard("Upside capture", nper,
      '<div class="score-stat__pending">— no up ' + noun(2) + ' yet</div>', "",
      "in up " + noun(2) + ", strategy gain as a share of the <b>S&amp;P's gain</b>");
    return statCard("Upside capture", nper,
      '<div class="score-stat__val">' + Number(val).toFixed(0) + '<span class="score-stat__unit">%</span></div>',
      ">100% = more than the S&P",
      "in up " + noun(2) + ", strategy gain as a share of the <b>S&amp;P's gain</b>");
  }

  function statDownside(val, nper) {
    if (val == null) return statCard("Downside participation", nper,
      '<div class="score-stat__pending">— no down ' + noun(2) + ' yet</div>', "",
      "in down " + noun(2) + ", strategy loss as a share of the <b>S&amp;P's loss</b>");
    if (val < 0) {
      // strategy net-positive while the benchmark fell — the best outcome.
      // Keep the honest signed value; reframe so it doesn't read as alarm.
      return statCard("Downside participation", nper,
        '<div class="score-stat__val">' + Number(val).toFixed(0) + '<span class="score-stat__unit">%</span></div>',
        "rose while the S&P fell",
        "negative — on average the strategy was <b>up</b> in down " + noun(2) + ", not down");
    }
    return statCard("Downside participation", nper,
      '<div class="score-stat__val is-muted">' + Number(val).toFixed(0) + '<span class="score-stat__unit">%</span></div>',
      "<100% = less than the S&P",
      "in down " + noun(2) + ", strategy loss as a share of the <b>S&amp;P's loss</b>");
  }

  function scatterSvg(rows) {
    var W = 640, H = 460, PAD = 52, n = rows.length;
    var m = Math.max.apply(null, rows.reduce(function (a, r) { return a.concat([Math.abs(r.strat_ret_pct), Math.abs(r.bench_ret_pct)]); }, []).concat([0.6]));
    m = m * 1.12;
    var x0 = PAD, x1 = W - 14, y0 = H - PAD, y1 = 14, cx0 = (x0 + x1) / 2, cy0 = (y0 + y1) / 2;
    var sx = function (v) { return cx0 + (v / m) * ((x1 - x0) / 2); };
    var sy = function (v) { return cy0 - (v / m) * ((y0 - y1) / 2); };
    // best quadrant: S&P down (x<0) & strategy up (y>0) -> top-left
    var quad = '<rect x="' + x0 + '" y="' + y1 + '" width="' + (cx0 - x0) + '" height="' + (cy0 - y1) + '" fill="' + GOLD + '" fill-opacity="0.07"/>';
    var diag = '<line x1="' + sx(-m) + '" y1="' + sy(-m) + '" x2="' + sx(m) + '" y2="' + sy(m) + '" stroke="' + SLATE2 + '" stroke-width="1" stroke-dasharray="5 4"/>';
    var axes =
      '<line x1="' + x0 + '" y1="' + cy0 + '" x2="' + x1 + '" y2="' + cy0 + '" stroke="#CBD5E1" stroke-width="1"/>' +
      '<line x1="' + cx0 + '" y1="' + y1 + '" x2="' + cx0 + '" y2="' + y0 + '" stroke="#CBD5E1" stroke-width="1"/>';
    var dots = rows.map(function (r) {
      var above = r.strat_ret_pct > r.bench_ret_pct;
      return '<circle cx="' + sx(r.bench_ret_pct).toFixed(1) + '" cy="' + sy(r.strat_ret_pct).toFixed(1) + '" r="5.5" fill="' + (above ? GOLD : SLATE2) + '" fill-opacity="0.9" stroke="#fff" stroke-width="1"><title>' + esc(r.label) + ': strategy ' + pct(r.strat_ret_pct) + ' vs S&P ' + pct(r.bench_ret_pct) + '</title></circle>';
    }).join("");
    var labels =
      '<text x="' + x1 + '" y="' + (cy0 - 8) + '" text-anchor="end" font-size="11" fill="' + SLATE + '">S&amp;P 500 return →</text>' +
      '<text x="' + (cx0 + 8) + '" y="' + (y1 + 12) + '" font-size="11" fill="' + SLATE + '">↑ Strategy return</text>' +
      '<text x="' + (x0 + 6) + '" y="' + (y1 + 14) + '" font-size="10.5" fill="' + GOLD_DK + '" font-weight="700">S&amp;P down · we’re up</text>' +
      '<text x="' + (x1 - 6) + '" y="' + (y0 - 8) + '" text-anchor="end" font-size="10.5" fill="' + SLATE2 + '">on the line = matched</text>';
    return '<div class="score-scatter">' +
      '<p class="score-scatter__title">Each ' + noun(1) + ': strategy return vs S&amp;P 500 return</p>' +
      '<p class="score-scatter__hint">Every dot is one ' + noun(1) + '. <b>Above the dashed line</b> = beat the S&amp;P that ' + noun(1) + '; the shaded corner is the best outcome — <b>S&amp;P down while the strategy is up</b>.</p>' +
      '<svg class="score-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Scatter of strategy return versus S&P 500 return per ' + noun(1) + '">' +
        quad + axes + diag + dots + labels +
      '</svg></div>';
  }

  // ---- render + toggle ----------------------------------------------------
  function winLabel() {
    if (win === "ytd") return "year to date";
    if (win === "custom") {
      var f = fromEl && fromEl.value, t = toEl && toEl.value;
      if (!f && !t) return "custom range";
      return (f || "start") + " → " + (t || "now");
    }
    return "since inception";
  }

  function render() {
    if (!DATA) return;
    var st = DATA.state;
    if (st === "ENGINE_ONLY" || st === "STALE" || st === "ERROR" || !DATA[freq]) { emptyStates(); return; }
    var blk = windowBlock(DATA[freq]);
    renderPeriods(blk);
    renderCapture(blk);
  }

  function selectChip(list, el, attr, setter) {
    list.forEach(function (x) {
      var on = x === el;
      x.classList.toggle("is-active", on);
      x.setAttribute("aria-checked", on ? "true" : "false");
    });
    setter(el.getAttribute(attr));
  }

  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      selectChip(chips, c, "data-freq", function (v) { freq = v; });
      render();
    });
  });

  winChips.forEach(function (c) {
    c.addEventListener("click", function () {
      selectChip(winChips, c, "data-win", function (v) { win = v; });
      if (datesEl) datesEl.hidden = (win !== "custom");
      render();
    });
  });
  [fromEl, toEl].forEach(function (el) { if (el) el.addEventListener("change", function () { if (win === "custom") render(); }); });

  fetch("data/periodic.json" + bust, { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (j) { DATA = j; render(); })
    .catch(function () { emptyStates(); });
})();
