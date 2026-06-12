/* ================================================
   Calculator 3 — "The Honest Trade-off"
   (Break-Even Lag Explorer) · Spec §3.
   MODEL NOTE: lags are absolute index-level
   percentages (closed form D* = g + m) — see the
   documented derivation in calc-core.js: the spec's
   fractional-lag draft makes the sign independent of
   depth, contradicting its own acceptance criteria.
   ================================================ */
(function () {
    'use strict';
    const root = document.getElementById('calcTradeoff');
    const core = window.EPIG_CALC_CORE;
    if (!root || !core) return;

    let interacted = false;
    function trackOnce() {
        if (interacted) return;
        interacted = true;
        try {
            window.dispatchEvent(new CustomEvent('ekantik:track', { detail: { name: 'calc_interacted', props: { calculator: 'honest_tradeoff' } } }));
            if (window.plausible) window.plausible('calc_interacted', { props: { calculator: 'honest_tradeoff' } });
        } catch (e) {}
    }

    const DEF = { D: 20, g: 25, m: 25 };
    const D_MIN = 0.05, D_MAX = 0.55;

    root.innerHTML = [
        '<div class="calc__controls to-controls">',
        '  <label class="arith-control">',
        '    <span class="arith-control__label">Correction depth</span>',
        '    <span class="arith-control__val">−<span id="toDVal">' + DEF.D + '</span>%</span>',
        '    <input type="range" id="toD" min="5" max="55" step="1" value="' + DEF.D + '" aria-label="Correction depth percent">',
        '    <span class="arith-control__hint">how deep the round-trip correction goes</span>',
        '  </label>',
        '  <label class="arith-control">',
        '    <span class="arith-control__label">Exit give-back</span>',
        '    <span class="arith-control__val"><span id="toGVal">' + DEF.g + '</span>%</span>',
        '    <input type="range" id="toG" min="0" max="60" step="5" value="' + DEF.g + '" aria-label="Exit give-back percent of index level">',
        '    <span class="arith-control__hint">index decline absorbed before stepping aside</span>',
        '  </label>',
        '  <label class="arith-control">',
        '    <span class="arith-control__label">Re-entry miss</span>',
        '    <span class="arith-control__val"><span id="toMVal">' + DEF.m + '</span>%</span>',
        '    <input type="range" id="toM" min="0" max="60" step="5" value="' + DEF.m + '" aria-label="Re-entry miss percent of index level">',
        '    <span class="arith-control__hint">rebound absorbed before re-entering</span>',
        '  </label>',
        '</div>',
        '<p class="calc__pair" id="toHead" aria-live="polite"></p>',
        '<div class="calc__chart" id="toChart" role="img" aria-label="Step-aside advantage versus correction depth: negative in shallow corrections where the lags cost more than the protection, positive in deep ones where the avoided middle wins."></div>',
        '<p class="calc__verdict" id="toHonesty">In shallow corrections this mechanism loses by design — its value concentrates in deep drawdowns. That regime-dependence is exactly what the overlay’s <a href="/falsifiability-protocol.html" target="_blank" rel="noopener">Expression Layer gate measures across full cycles</a>.</p>',
        '<p class="calc__reset-row"><button type="button" class="calc__reset" id="toReset">Reset to default</button></p>'
    ].join('');

    const dEl = document.getElementById('toD'), gEl = document.getElementById('toG'), mEl = document.getElementById('toM');

    function render() {
        const D = parseInt(dEl.value, 10) / 100;
        const g = parseInt(gEl.value, 10) / 100;
        const m = parseInt(mEl.value, 10) / 100;
        document.getElementById('toDVal').textContent = Math.round(D * 100);
        document.getElementById('toGVal').textContent = Math.round(g * 100);
        document.getElementById('toMVal').textContent = Math.round(m * 100);

        const S = core.tradeoffOutcome(D, g, m);
        const advNow = S - 1;
        const dStar = core.tradeoffBreakEven(g, m, D_MAX);

        const headNote = D <= g
            ? ' <span class="calc__pair-label">(a ' + Math.round(D * 100) + '% correction never reaches a ' + Math.round(g * 100) + '% give-back — the step-aside never triggers; you held through)</span>'
            : '';
        document.getElementById('toHead').innerHTML =
              '<span class="calc__pair-label">Hold-through:</span> <span class="calc__num">0.0%</span> <span class="calc__pair-label">round trip ·</span> '
            + '<span class="calc__pair-label">Step-aside:</span> <span class="calc__num" style="color:' + (advNow > 0 ? '#0D9488' : advNow < 0 ? '#E05A6B' : '#12264a') + '">' + (advNow >= 0 ? '+' : '') + (advNow * 100).toFixed(1) + '%</span>' + headNote;

        // Advantage curve
        const W = 640, H = 280, PL = 56, PR = 18, PT = 18, PB = 34;
        const pts = [];
        let aMin = 0, aMax = 0;
        for (let v = D_MIN; v <= D_MAX + 1e-9; v += 0.005) {
            const a = core.tradeoffAdv(v, g, m);
            pts.push([v, a]);
            if (a < aMin) aMin = a; if (a > aMax) aMax = a;
        }
        aMax = Math.max(aMax, 0.02) * 1.15; aMin = Math.min(aMin, -0.02) * 1.15;
        function X(v) { return PL + ((v - D_MIN) / (D_MAX - D_MIN)) * (W - PL - PR); }
        function Y(a) { return PT + (1 - (a - aMin) / (aMax - aMin)) * (H - PT - PB); }
        const s = [];
        // zero line + region shading
        const y0 = Y(0);
        s.push('<rect x="' + PL + '" y="' + PT + '" width="' + (W - PL - PR) + '" height="' + (y0 - PT) + '" fill="rgba(13,148,136,0.07)"/>');
        s.push('<rect x="' + PL + '" y="' + y0 + '" width="' + (W - PL - PR) + '" height="' + (H - PB - y0) + '" fill="rgba(224,90,107,0.10)"/>');
        s.push('<line x1="' + PL + '" y1="' + y0 + '" x2="' + (W - PR) + '" y2="' + y0 + '" stroke="rgba(18,38,74,0.35)" stroke-dasharray="3 3"/>');
        // axis labels
        [aMin, 0, aMax].forEach(function (a) {
            s.push('<text x="' + (PL - 6) + '" y="' + (Y(a) + 4) + '" text-anchor="end" font-size="11" fill="#64748B">' + (a >= 0 ? '+' : '') + (a * 100).toFixed(0) + '%</text>');
        });
        for (let v = 0.05; v <= 0.55 + 1e-9; v += 0.10) {
            s.push('<text x="' + X(v) + '" y="' + (H - PB + 16) + '" text-anchor="middle" font-size="11" fill="#64748B">−' + Math.round(v * 100) + '%</text>');
        }
        // mandatory region labels (§3.3 — the honesty feature)
        s.push('<text x="' + X(0.30) + '" y="' + Math.min(H - PB - 8, y0 + 20) + '" font-size="12" font-weight="700" fill="#E05A6B">the lags cost more than the protection</text>');
        s.push('<text x="' + X(0.30) + '" y="' + Math.max(PT + 14, y0 - 10) + '" font-size="12" font-weight="700" fill="#0D9488">the avoided middle wins</text>');
        // advantage curve
        let path = '';
        pts.forEach(function (p, i) { path += (i ? ' L ' : 'M ') + X(p[0]) + ' ' + Y(p[1]); });
        s.push('<path d="' + path + '" fill="none" stroke="#12264a" stroke-width="2.2"/>');
        // break-even marker
        if (dStar !== null && dStar >= D_MIN && dStar <= D_MAX) {
            s.push('<line x1="' + X(dStar) + '" y1="' + PT + '" x2="' + X(dStar) + '" y2="' + (H - PB) + '" stroke="#b8962e" stroke-width="1.6" stroke-dasharray="5 4"/>');
            const flip = X(dStar) > PL + (W - PL - PR) * 0.7;
            s.push('<text x="' + (X(dStar) + (flip ? -5 : 5)) + '" y="' + (PT + 12) + '" text-anchor="' + (flip ? 'end' : 'start') + '" font-size="11.5" font-weight="700" fill="#b8962e">break-even ≈ ' + Math.round(dStar * 100) + '%</text>');
        } else {
            s.push('<text x="' + X(0.30) + '" y="' + (PT + 12) + '" text-anchor="middle" font-size="11.5" font-weight="700" fill="#b8962e">no break-even below 55% at these lags</text>');
        }
        // live dot at current D
        s.push('<circle cx="' + X(D) + '" cy="' + Y(advNow) + '" r="6" fill="#d4af37" stroke="#fff" stroke-width="1.5"/>');
        document.getElementById('toChart').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="xMidYMid meet">' + s.join('') + '</svg>';
    }

    let raf = false;
    function queue() {
        trackOnce();
        if (raf) return;
        raf = true;
        requestAnimationFrame(function () { raf = false; render(); });
    }
    [dEl, gEl, mEl].forEach(function (el) { el.addEventListener('input', queue); });
    document.getElementById('toReset').addEventListener('click', function () {
        dEl.value = DEF.D; gEl.value = DEF.g; mEl.value = DEF.m; queue();
    });
    render();
})();
