/* ================================================
   Calculator 4 — "The Worst Case, Priced"
   (Bounded-Loss Architecture) · Spec §4.
   LOSS-SIDE ONLY: this component has no code path
   that renders a gain, throughput, expectancy,
   win-rate, or any positive P&L figure (§4.3).
   All protocol numbers come from
   /data/protocol-constants.json — never hard-coded.
   ================================================ */
(function () {
    'use strict';
    const root = document.getElementById('calcBounds');
    const core = window.EPIG_CALC_CORE;
    if (!root || !core) return;

    let interacted = false;
    function trackOnce() {
        if (interacted) return;
        interacted = true;
        try {
            window.dispatchEvent(new CustomEvent('ekantik:track', { detail: { name: 'calc_interacted', props: { calculator: 'worst_case_priced' } } }));
            if (window.plausible) window.plausible('calc_interacted', { props: { calculator: 'worst_case_priced' } });
        } catch (e) {}
    }

    const DEFAULT_NLV = 100000;
    let K = null;       // protocol constants — loaded from the shared JSON
    let nlv = DEFAULT_NLV;
    let n = 1;
    let userTouchedN = false;   // once the user adjusts contracts manually, stop auto-snapping

    function fmt(v) { return '$' + Math.round(v).toLocaleString('en-US'); }
    function fmtK(v) { return v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : '$' + Math.round(v / 1000) + 'K'; }
    function stdContractsFor(v) {
        if (!K) return 1;
        return Math.max(1, Math.min(K.maxContracts, Math.floor(v / K.standardSizingNLVPerContract)));
    }

    function build() {
        root.innerHTML = [
            '<div class="calc__controls cb-controls">',
            '  <label class="arith-control">',
            '    <span class="arith-control__label">Hypothetical NLV</span>',
            '    <span class="arith-control__val" id="cbNlvVal">' + fmtK(nlv) + '</span>',
            '    <input type="range" id="cbNlv" min="100000" max="2000000" step="25000" value="' + nlv + '" aria-label="Hypothetical net liquidation value">',
            '    <span class="arith-control__hint">or type: <input type="number" id="cbNlvNum" min="100000" max="2000000" step="25000" value="' + nlv + '" aria-label="Hypothetical NLV exact value"></span>',
            '  </label>',
            '  <div class="cb-stepper" role="group" aria-label="Contract count">',
            '    <span class="cb-stepper__label">Contracts</span>',
            '    <button type="button" class="cb-stepper__btn" id="cbMinus" aria-label="Fewer contracts">−</button>',
            '    <span class="cb-stepper__n" id="cbN">' + n + '</span>',
            '    <button type="button" class="cb-stepper__btn" id="cbPlus" aria-label="More contracts">+</button>',
            '    <span class="cb-warn" id="cbWarn" hidden></span>',
            '  </div>',
            '</div>',
            '<div class="cb-ladder" id="cbLadder"></div>',
            '<p class="calc__reset-row"><button type="button" class="calc__reset" id="cbReset">Reset to default</button>',
            '  <a href="/falsifiability-protocol.html" target="_blank" rel="noopener" class="cb-protocol-link" data-cta="protocol-calc">Read the full protocol →</a></p>'
        ].join('');
        wire();
        render();
    }

    function render() {
        if (!K) return;
        const b = core.bounds(nlv, n, K);
        const hardKillPct = (b.hardKillDollars / nlv) * 100;
        document.getElementById('cbNlvVal').textContent = fmtK(nlv);
        document.getElementById('cbN').textContent = n;
        const warn = document.getElementById('cbWarn');
        const stdN = stdContractsFor(nlv);
        if (n < stdN) {
            warn.hidden = false;
            warn.textContent = 'below Standard sizing (1 /ES per $' + (K.standardSizingNLVPerContract / 1000) + 'K → ' + stdN + ' contracts at this NLV)';
        } else if (n > stdN) {
            warn.hidden = false;
            warn.textContent = 'above Standard sizing (1 /ES per $' + (K.standardSizingNLVPerContract / 1000) + 'K → ' + stdN + ' contracts at this NLV)';
        } else {
            warn.hidden = true;
        }

        const rungs = [
            { id: 'OP-02', title: 'Per trade', fig: '−' + fmt(b.perContractDollars) + (n > 1 ? ' per contract · −' + fmt(b.totalDollars) + ' total (' + b.totalPct.toFixed(1) + '% of NLV)' : ' (' + b.totalPct.toFixed(1) + '% of NLV)'),
              text: 'Per-contract risk fixed at ' + K.perContractRiskPctNLV + '% of NLV. Contract count scales 1 per $' + (K.standardSizingNLVPerContract / 1000) + 'K NLV at Standard sizing — earned, not assumed. After any closed losing trade, the day is over (one-loss daily rule).' },
            { id: 'OP-03', title: 'Daily floor', fig: '−' + fmt(b.dailyFloorStartDollars) + ' (starting)',
              text: 'Trailing high-water-mark floor — ratchets up with every new equity peak, never down.' },
            { id: 'OP-05', title: 'Weekly stand-down', fig: K.weeklyStandDownRule,
              text: 'A rule, not a dollar figure: consecutive losing days halt the week pending witness review.', chip: true },
            { id: 'ED-05b', title: 'Hard kill', fig: '−' + fmt(b.hardKillDollars) + ' (' + hardKillPct.toFixed(1) + '% of NLV)',
              text: 'The most the engine can lose before it is declared dead, in public: ' + fmt(b.hardKillDollars) + ' = ' + K.hardKillPoints + ' /ES pts × $' + K.dollarsPerPoint + '/pt × ' + n + ' contracts. At Standard sizing this is ' + hardKillPct.toFixed(1) + '% of NLV. Budgeted in advance.', kill: true }
        ];
        document.getElementById('cbLadder').innerHTML = rungs.map(function (r) {
            return '<div class="cb-rung' + (r.kill ? ' cb-rung--kill' : '') + '">'
                + '<span class="cb-rung__id">' + r.id + '</span>'
                + '<div class="cb-rung__body"><p class="cb-rung__title">' + r.title + '</p>'
                + '<p class="cb-rung__fig' + (r.chip ? ' cb-rung__fig--rule' : '') + '">' + r.fig + '</p>'
                + '<p class="cb-rung__text">' + r.text + '</p></div></div>';
        }).join('');
    }

    let raf = false;
    function queue() {
        trackOnce();
        if (raf) return;
        raf = true;
        requestAnimationFrame(function () { raf = false; render(); });
    }
    function setNlv(v) {
        nlv = Math.min(2000000, Math.max(100000, Math.round(v / 25000) * 25000));
        document.getElementById('cbNlv').value = nlv;
        document.getElementById('cbNlvNum').value = nlv;
        if (!userTouchedN) n = stdContractsFor(nlv);
        queue();
    }
    function wire() {
        document.getElementById('cbNlv').addEventListener('input', function (e) { setNlv(parseInt(e.target.value, 10)); });
        document.getElementById('cbNlvNum').addEventListener('change', function (e) { setNlv(parseInt(e.target.value, 10) || DEFAULT_NLV); });
        document.getElementById('cbMinus').addEventListener('click', function () { if (n > 1) { userTouchedN = true; n--; queue(); } });
        document.getElementById('cbPlus').addEventListener('click', function () { if (K && n < K.maxContracts) { userTouchedN = true; n++; queue(); } });
        document.getElementById('cbReset').addEventListener('click', function () { userTouchedN = false; nlv = DEFAULT_NLV; n = stdContractsFor(nlv); setNlv(nlv); });
    }

    fetch('data/protocol-constants.json?t=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
        .then(function (json) { K = json; n = stdContractsFor(nlv); build(); })
        .catch(function () { /* static default-state HTML remains — never blank */ });
})();
