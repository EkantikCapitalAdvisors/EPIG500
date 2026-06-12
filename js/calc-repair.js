/* ================================================
   Calculator 1 — "The Repair Bill" (Recovery Convexity)
   Spec §1. Self-contained; reads only EPIG_CALC_CORE.
   Identity math on a user-set hypothetical drawdown.
   ================================================ */
(function () {
    'use strict';
    const root = document.getElementById('calcRepair');
    const core = window.EPIG_CALC_CORE;
    if (!root || !core) return;

    let interacted = false;
    function trackOnce() {
        if (interacted) return;
        interacted = true;
        try {
            window.dispatchEvent(new CustomEvent('ekantik:track', { detail: { name: 'calc_interacted', props: { calculator: 'repair_bill' } } }));
            if (window.plausible) window.plausible('calc_interacted', { props: { calculator: 'repair_bill' } });
        } catch (e) {}
    }

    const DEFAULT_D = 37;
    const PRESETS = [
        { d: 10, label: '−10%' }, { d: 20, label: '−20%' }, { d: 37, label: '−37% (2008)' },
        { d: 50, label: '−50%' }, { d: 74, label: '−74% (2008 ×2 leverage)' }
    ];

    root.innerHTML = [
        '<div class="calc__controls">',
        '  <label class="arith-control">',
        '    <span class="arith-control__label">Drawdown</span>',
        '    <span class="arith-control__val">−<span id="crVal">' + DEFAULT_D + '</span>%</span>',
        '    <input type="range" id="crSlider" min="1" max="90" step="1" value="' + DEFAULT_D + '" aria-label="Drawdown percent">',
        '    <span class="arith-control__hint">hypothetical loss to repair</span>',
        '  </label>',
        '  <div class="calc__chips" role="group" aria-label="Drawdown presets">',
        PRESETS.map(function (p) { return '<button type="button" class="calc__chip" data-d="' + p.d + '">' + p.label + '</button>'; }).join(''),
        '  </div>',
        '</div>',
        '<div class="calc__readout">',
        '  <p class="calc__pair" id="crMain" aria-live="polite"></p>',
        '  <p class="calc__pair calc__pair--teal" id="crHalf"></p>',
        '</div>',
        '<div class="calc__chart" id="crChart" role="img" aria-label="Required recovery versus drawdown: the recovery curve rises faster than the loss — the gap is the asymmetry tax."></div>',
        '<p class="calc__verdict" id="crVerdict" aria-live="polite"></p>',
        '<p class="calc__reset-row"><button type="button" class="calc__reset" id="crReset">Reset to default</button></p>'
    ].join('');

    const slider = document.getElementById('crSlider');
    const valEl = document.getElementById('crVal');
    const mainEl = document.getElementById('crMain');
    const halfEl = document.getElementById('crHalf');
    const chartEl = document.getElementById('crChart');
    const verdictEl = document.getElementById('crVerdict');

    function pct(x, dp) { return (x * 100).toFixed(dp === undefined ? 0 : dp); }

    function drawChart(d) {
        const W = 640, H = 300, PL = 56, PR = 18, PT = 16, PB = 34;
        const r = core.repair(d);
        const xMax = 0.90;
        const yMax = Math.max(2.5, core.repairRequired(Math.min(d * 1.15, 0.9)) * 1.15);
        function X(v) { return PL + (v / xMax) * (W - PL - PR); }
        function Y(v) { return PT + (1 - Math.min(v, yMax) / yMax) * (H - PT - PB); }
        const s = [];
        // gridlines
        const step = yMax > 5 ? 2 : 1;
        for (let v = 0; v <= yMax; v += step) {
            s.push('<line x1="' + PL + '" y1="' + Y(v) + '" x2="' + (W - PR) + '" y2="' + Y(v) + '" stroke="rgba(18,38,74,0.07)"/>');
            s.push('<text x="' + (PL - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="11" fill="#64748B">+' + (v * 100) + '%</text>');
        }
        for (let v = 0; v <= xMax + 1e-9; v += 0.3) {
            s.push('<text x="' + X(v) + '" y="' + (H - PB + 16) + '" text-anchor="middle" font-size="11" fill="#64748B">−' + Math.round(v * 100) + '%</text>');
        }
        // asymmetry-tax shading: between R(d) curve and identity line
        let shade = 'M ' + X(0) + ' ' + Y(0);
        for (let v = 0; v <= xMax + 1e-9; v += 0.01) shade += ' L ' + X(v) + ' ' + Y(core.repairRequired(v));
        for (let v = xMax; v >= -1e-9; v -= 0.01) shade += ' L ' + X(v) + ' ' + Y(v);
        s.push('<path d="' + shade + ' Z" fill="rgba(224,90,107,0.13)"/>');
        // identity line — "if losses were symmetric"
        s.push('<line x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(Math.min(xMax, yMax)) + '" y2="' + Y(Math.min(xMax, yMax)) + '" stroke="#94A3B8" stroke-width="1.4" stroke-dasharray="5 4"/>');
        s.push('<text x="' + X(0.42) + '" y="' + (Y(0.42) - 8) + '" font-size="11" fill="#64748B" font-style="italic">if losses were symmetric</text>');
        // recovery curve (teal — data series)
        let curve = '';
        for (let v = 0; v <= xMax + 1e-9; v += 0.005) curve += (curve ? ' L ' : 'M ') + X(v) + ' ' + Y(core.repairRequired(v));
        s.push('<path d="' + curve + '" fill="none" stroke="#0D9488" stroke-width="2.4"/>');
        // shaded-region label
        s.push('<text x="' + X(0.60) + '" y="' + Y(0.32) + '" font-size="12" font-weight="700" fill="#E05A6B">the asymmetry tax</text>');
        // markers: current d (gold) + half-loss comparator (teal)
        s.push('<circle cx="' + X(r.dHalf) + '" cy="' + Y(r.RHalf) + '" r="5.5" fill="#0D9488" stroke="#fff" stroke-width="1.5"/>');
        s.push('<circle cx="' + X(d) + '" cy="' + Y(r.R) + '" r="6.5" fill="#d4af37" stroke="#fff" stroke-width="1.5"/>');
        chartEl.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="xMidYMid meet">' + s.join('') + '</svg>';
    }

    function render() {
        const d = parseInt(slider.value, 10) / 100;
        const r = core.repair(d);
        valEl.textContent = Math.round(d * 100);
        mainEl.innerHTML = '<span class="calc__num">−' + pct(d) + '%</span> <span class="calc__arrow">→</span> <span class="calc__num">+' + pct(r.R) + '%</span> <span class="calc__pair-label">required to repair</span>';
        halfEl.innerHTML = '<span class="calc__num">−' + pct(r.dHalf, 1).replace(/\.0$/, '') + '%</span> <span class="calc__arrow">→</span> <span class="calc__num">+' + pct(r.RHalf) + '%</span> <span class="calc__pair-label">the same loss, cut in half</span>';
        verdictEl.innerHTML = 'Cutting this loss in half cuts the repair bill by <strong>' + pct(r.cutPct) + '%</strong> (×' + r.ratio.toFixed(1) + ') — convex losses mean protection pays twice.';
        drawChart(d);
        document.querySelectorAll('#calcRepair .calc__chip').forEach(function (c) {
            c.classList.toggle('is-active', parseInt(c.dataset.d, 10) === Math.round(d * 100));
        });
    }

    let raf = false;
    function queue() {
        trackOnce();
        if (raf) return;
        raf = true;
        requestAnimationFrame(function () { raf = false; render(); });
    }
    slider.addEventListener('input', queue);
    root.querySelectorAll('.calc__chip').forEach(function (c) {
        c.addEventListener('click', function () { slider.value = c.dataset.d; queue(); });
    });
    document.getElementById('crReset').addEventListener('click', function () { slider.value = DEFAULT_D; queue(); });
    render();
})();
