/* ================================================
   Calculator 2 — "The Volatility Tax"
   (Arithmetic vs Geometric Mean) · Spec §2.
   Self-contained; consumes EPIG_CALC_CORE and the
   page's canonical S&P series (EPIG_SP_TR, 2005–2024
   slice — never a second copy of the data).
   ================================================ */
(function () {
    'use strict';
    const root = document.getElementById('calcVolTax');
    const core = window.EPIG_CALC_CORE;
    if (!root || !core) return;

    let interacted = false;
    function trackOnce() {
        if (interacted) return;
        interacted = true;
        try {
            window.dispatchEvent(new CustomEvent('ekantik:track', { detail: { name: 'calc_interacted', props: { calculator: 'volatility_tax' } } }));
            if (window.plausible) window.plausible('calc_interacted', { props: { calculator: 'volatility_tax' } });
        } catch (e) {}
    }

    function presetSeries() {
        const sp = window.EPIG_SP_TR || {};
        const out = [];
        for (let y = 2005; y <= 2024; y++) if (typeof sp[y] === 'number') out.push(sp[y]);
        return out;
    }

    const DEFAULT_P = 100;
    let series = presetSeries();
    let seriesLabel = 'S&P 2005–2024';

    root.innerHTML = [
        '<div class="calc__controls">',
        '  <div class="calc__tabs" role="tablist" aria-label="Return series">',
        '    <button type="button" class="calc__chip is-active" data-mode="preset" role="tab" aria-selected="true">S&amp;P 2005–2024</button>',
        '    <button type="button" class="calc__chip" data-mode="paste" role="tab" aria-selected="false">Paste your own</button>',
        '  </div>',
        '  <div class="calc__paste" id="vtPaste" hidden>',
        '    <textarea id="vtPasteText" rows="3" placeholder="Annual % returns, comma/space/newline separated — e.g. 12, -8, 21.5 (max 50 values, −95%..+200%)"></textarea>',
        '    <div class="calc__paste-row"><button type="button" class="btn btn--secondary btn--sm" id="vtPasteBtn">Use this series</button><span class="calc__error" id="vtPasteErr" hidden role="alert"></span></div>',
        '  </div>',
        '  <label class="arith-control">',
        '    <span class="arith-control__label">Downside participation</span>',
        '    <span class="arith-control__val"><span id="vtVal">' + DEFAULT_P + '</span>%</span>',
        '    <input type="range" id="vtSlider" min="0" max="100" step="5" value="' + DEFAULT_P + '" aria-label="Downside participation percent">',
        '    <span class="arith-control__hint">% of each negative year taken — upside is never modified</span>',
        '  </label>',
        '</div>',
        '<div class="calc__bars" id="vtBars" role="img" aria-label="Arithmetic versus geometric mean: the gap between them is the volatility tax."></div>',
        '<div class="calc__chart" id="vtSpark" role="img" aria-label="Cumulative wealth of a hypothetical $100,000: fixed baseline at 100% participation versus the current participation setting."></div>',
        '<p class="calc__verdict" id="vtLine" aria-live="polite"></p>',
        '<p class="calc__reset-row"><button type="button" class="calc__reset" id="vtReset">Reset to default</button></p>'
    ].join('');

    const slider = document.getElementById('vtSlider');
    const valEl = document.getElementById('vtVal');
    const barsEl = document.getElementById('vtBars');
    const sparkEl = document.getElementById('vtSpark');
    const lineEl = document.getElementById('vtLine');

    function fmtUSD(v) {
        if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
        return '$' + Math.round(v / 1000) + 'K';
    }

    function render() {
        const p = parseInt(slider.value, 10) / 100;
        valEl.textContent = Math.round(p * 100);
        const cur = core.volTax(series, p);
        const base = core.volTax(series, 1.0);

        // Twin bars: arithmetic (muted gold) vs geometric (gold), tax bracket in red-pink.
        const maxMean = Math.max(cur.A, cur.G, base.A, 0.001);
        function barRow(label, v, cls) {
            const w = Math.max(2, (v / maxMean) * 100);
            return '<div class="vt-bar"><span class="vt-bar__label">' + label + '</span>'
                + '<div class="vt-bar__track"><div class="vt-bar__fill ' + cls + '" style="width:' + w + '%"></div></div>'
                + '<span class="vt-bar__val">' + (v * 100).toFixed(1) + '%/yr</span></div>';
        }
        barsEl.innerHTML =
              barRow('Arithmetic mean', cur.A, 'vt-bar__fill--arith')
            + barRow('Geometric mean (what compounds)', cur.G, 'vt-bar__fill--geom')
            + '<p class="vt-tax">the volatility tax: <strong>' + ((cur.T) * 100).toFixed(1) + ' pp</strong>'
            + ' <span class="vt-tax__base">(at 100% participation: A ' + (base.A * 100).toFixed(1) + '% · G ' + (base.G * 100).toFixed(1) + '% · tax ' + (base.T * 100).toFixed(1) + ' pp)</span></p>';

        // Wealth sparkline: p=100% fixed gray vs current p live.
        const W = 640, H = 150, PL = 8, PR = 118, PT = 10, PB = 10;
        const n = base.wealthPath.length - 1;
        const maxW = Math.max.apply(null, base.wealthPath.concat(cur.wealthPath));
        const minW = Math.min.apply(null, base.wealthPath.concat(cur.wealthPath));
        function X(i) { return PL + (i / n) * (W - PL - PR); }
        function Y(v) { return PT + (1 - (v - minW) / (maxW - minW || 1)) * (H - PT - PB); }
        function path(arr) { return arr.map(function (v, i) { return (i ? 'L ' : 'M ') + X(i) + ' ' + Y(v); }).join(' '); }
        sparkEl.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="xMidYMid meet">'
            + '<path d="' + path(base.wealthPath) + '" fill="none" stroke="#94A3B8" stroke-width="1.6"/>'
            + '<path d="' + path(cur.wealthPath) + '" fill="none" stroke="#b8962e" stroke-width="2.2"/>'
            + '<text x="' + (X(n) + 6) + '" y="' + (Y(cur.wealth) + 4) + '" font-size="12" font-weight="700" fill="#b8962e">' + fmtUSD(cur.wealth) + '</text>'
            + '<text x="' + (X(n) + 6) + '" y="' + (Y(base.wealth) + (Math.abs(Y(base.wealth) - Y(cur.wealth)) < 14 ? 16 : 4)) + '" font-size="11" fill="#64748B">' + fmtUSD(base.wealth) + ' at 100%</text>'
            + '<text x="' + PL + '" y="' + (H - 2) + '" font-size="10" fill="#8E99AC" font-style="italic">hypothetical $100K, this series (' + seriesLabel + ')</text>'
            + '</svg>';

        lineEl.innerHTML = 'At <strong>' + Math.round(p * 100) + '%</strong> downside participation, the geometric mean rises to <strong>' + (cur.G * 100).toFixed(1) + '%/yr</strong> and the volatility tax falls to <strong>' + (cur.T * 100).toFixed(1) + ' pp</strong>.';
    }

    let raf = false;
    function queue() {
        trackOnce();
        if (raf) return;
        raf = true;
        requestAnimationFrame(function () { raf = false; render(); });
    }
    slider.addEventListener('input', queue);
    document.getElementById('vtReset').addEventListener('click', function () {
        slider.value = DEFAULT_P;
        series = presetSeries(); seriesLabel = 'S&P 2005–2024';
        root.querySelectorAll('.calc__tabs .calc__chip').forEach(function (c) {
            const active = c.dataset.mode === 'preset';
            c.classList.toggle('is-active', active); c.setAttribute('aria-selected', String(active));
        });
        document.getElementById('vtPaste').hidden = true;
        queue();
    });
    root.querySelectorAll('.calc__tabs .calc__chip').forEach(function (tab) {
        tab.addEventListener('click', function () {
            root.querySelectorAll('.calc__tabs .calc__chip').forEach(function (c) {
                c.classList.toggle('is-active', c === tab); c.setAttribute('aria-selected', String(c === tab));
            });
            const paste = tab.dataset.mode === 'paste';
            document.getElementById('vtPaste').hidden = !paste;
            if (!paste) { series = presetSeries(); seriesLabel = 'S&P 2005–2024'; queue(); }
        });
    });
    document.getElementById('vtPasteBtn').addEventListener('click', function () {
        const err = document.getElementById('vtPasteErr');
        const res = core.parseReturnSeries(document.getElementById('vtPasteText').value);
        if (!res.ok) { err.hidden = false; err.textContent = res.error; return; }
        err.hidden = true;
        series = res.values; seriesLabel = 'your series (' + res.values.length + ' yrs)';
        queue();
    });
    render();
})();
