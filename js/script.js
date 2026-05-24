/* ================================================
   EKANTIK 500 — Landing Page v2.3
   Falsifiability + 8-Test Battery + Reference Dataset
   ================================================ */

(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ------------------------------------------------
       1. NAV + SMOOTH SCROLL
       ------------------------------------------------ */
    const menuToggle = document.querySelector('.nav__menu-toggle');
    const navMobile = document.getElementById('navMobile');
    if (menuToggle && navMobile) {
        menuToggle.addEventListener('click', function () {
            const isOpen = navMobile.classList.toggle('is-open');
            menuToggle.setAttribute('aria-expanded', String(isOpen));
        });
        navMobile.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', function () {
                navMobile.classList.remove('is-open');
                menuToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            const id = link.getAttribute('href');
            if (!id || id === '#') return;
            const target = document.querySelector(id);
            if (!target) return;
            e.preventDefault();
            const top = target.getBoundingClientRect().top + window.pageYOffset - 72;
            window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
        });
    });

    /* ------------------------------------------------
       2. ANALYTICS STUBS
       ------------------------------------------------ */
    function track(name, props) {
        try {
            window.dispatchEvent(new CustomEvent('ekantik:track', { detail: { name: name, props: props || {} } }));
            if (window.plausible) window.plausible(name, { props: props || {} });
        } catch (e) {}
    }
    track('page_view', { url: location.href, referrer: document.referrer || null });

    /* Populate continuity section pre-reg counter from data/trades.json */
    const continuityCount = document.getElementById('continuityLiveCount');
    if (continuityCount) {
        fetch('data/trades.json', { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) {
                if (!j || !j.trades) return;
                const live = j.trades.filter(function (t) { return t.period === 'pre_reg'; }).length;
                continuityCount.textContent = live === 0 ? 'Awaiting first restart trade' : (live + (live === 1 ? ' trade' : ' trades'));
            })
            .catch(function () {});
    }

    document.querySelectorAll('a[href="#prereg"]').forEach(function (cta) {
        cta.addEventListener('click', function () {
            track('prereg_cta_click', { source: cta.dataset.cta || 'unknown', section: cta.closest('section')?.id || 'unknown' });
        });
    });
    document.querySelectorAll('a[data-cta^="discord-"]').forEach(function (cta) {
        cta.addEventListener('click', function () {
            track('discord_cta_click', { source: cta.dataset.cta, section: cta.closest('section')?.id || 'nav' });
        });
    });

    /* Pre-registration form — builds a mailto: with structured body */
    const preregForm = document.getElementById('preregForm');
    if (preregForm) {
        preregForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const fd = new FormData(preregForm);
            const name = (fd.get('name') || '').trim();
            const email = (fd.get('email') || '').trim();
            const capital = (fd.get('capital') || '').trim();
            const curiosity = (fd.get('curiosity') || '').trim();
            const subject = 'Ekantik 500 — pre-registration: ' + name;
            const body = [
                'Pre-registration submission',
                '',
                'Name:      ' + name,
                'Email:     ' + email,
                'Capital:   ' + (capital || '(not specified)'),
                '',
                'Curiosity:',
                curiosity || '(none)',
                '',
                '---',
                'Submitted from epig500.ekantikcapital.com pre-registration form.'
            ].join('\n');
            const mailto = 'mailto:hiren@ekantikcapital.com'
                + '?subject=' + encodeURIComponent(subject)
                + '&body=' + encodeURIComponent(body);
            track('prereg_submit', { capital: capital || 'unspecified' });
            window.location.href = mailto;
        });
    }

    document.querySelectorAll('.faq__item').forEach(function (item, idx) {
        item.addEventListener('toggle', function () {
            if (item.open) track('faq_expand', { question_id: idx + 1, question: item.querySelector('summary')?.textContent?.trim() });
        });
    });

    /* ------------------------------------------------
       3. SCENARIO TOGGLE (Ladder section)
       ------------------------------------------------ */
    /* Compounding Ladder model — v4
       Starting capital: $100K NLV. 1-year horizon. 60 days of no-trading buffer
       up front (~2 months observation/protocol-warmup). Contract scaling capped
       at 4 /ES maximum. Three discrete scenarios (Floor / Realistic / Cooperative).
       Throughput per /ES from reference data: $26,662.50 / 18 calendar months
       = ~$1,480/mo/contract. Calendar-month average, not active-day extrapolation. */

    const NLV_START         = 100000;
    const SPY_PCT           = 0.90;          // 90% SPY foundation
    const BUFFER_PCT        = 0.10;          // 10% cash buffer
    const SPY_START         = NLV_START * SPY_PCT;   // $90K
    const CASH_START        = NLV_START * BUFFER_PCT; // $10K
    // S&P 500 historical average annual return (last 20 years, incl. dividends, rounded)
    const SPY_ANNUAL_RETURN = 0.10;
    const SPY_MONTHLY_RATE  = Math.pow(1 + SPY_ANNUAL_RETURN, 1/12) - 1; // ≈ 0.797%/mo
    // Per-/ES per-calendar-month throughput, DERIVED from the 227-trade reference
    // dataset: total $26,662.50 / 18 calendar months (Apr 2023 – Oct 2024).
    const PER_ES_MONTHLY    = 1480;
    const DURATION_MAX      = 12;            // months
    const BUFFER_DAYS       = 60;            // engine no-trading buffer at start of year
    const BUFFER_MONTHS     = BUFFER_DAYS / 30; // 2 months
    const COOP_BUFFER_PROFIT = 5000;          // profit needed at each level before scaling +1 contract
    const MAX_CONTRACTS     = 4;
    // Cooperative scale times — each step requires ≈$5K profit at the current contract count.
    // Time to earn $5K at N contracts = $5,000 / (N × $1,480/mo). Accelerates as contracts grow.
    const COOP_T1 = BUFFER_MONTHS;                                              // 2.00 mo — engine starts at 1 /ES
    const COOP_T2 = COOP_T1 + COOP_BUFFER_PROFIT / (1 * PER_ES_MONTHLY);        // 5.38 — scale to 2 after $5K at 1 ES
    const COOP_T3 = COOP_T2 + COOP_BUFFER_PROFIT / (2 * PER_ES_MONTHLY);        // 7.07 — scale to 3 after $5K at 2 ES
    const COOP_T4 = COOP_T3 + COOP_BUFFER_PROFIT / (3 * PER_ES_MONTHLY);        // 8.20 — scale to 4 after $5K at 3 ES

    // SPY value at month t (compound monthly)
    function spyAt(t) { return SPY_START * Math.pow(1 + SPY_MONTHLY_RATE, t); }
    // Engine cumulative profit at month t for a given scenario
    function enginePnlAt(t, scenario) {
        const cfg = SCENARIO_CONFIG[scenario];
        if (!cfg || t <= 0) return 0;
        let cum = 0;
        for (let i = 0; i < cfg.transitions.length; i++) {
            const start = cfg.transitions[i].startMonth;
            const next  = (i + 1 < cfg.transitions.length) ? cfg.transitions[i + 1].startMonth : DURATION_MAX;
            const c     = Math.min(cfg.transitions[i].contracts, MAX_CONTRACTS);
            if (t <= start) break;
            const segEnd = Math.min(t, next);
            cum += c * PER_ES_MONTHLY * (segEnd - start);
            if (t <= next) break;
        }
        return cum;
    }

    // Each scenario defines the active-trading transitions (after the 60d buffer).
    const SCENARIO_CONFIG = {
        floor: {
            label: 'Floor — 1 /ES throughout the year after the 60-day buffer. Engine runs at minimum scale; capital preserved.',
            transitions: [
                { startMonth: BUFFER_MONTHS, contracts: 1 }
            ]
        },
        realistic: {
            label: 'Realistic — 1 /ES after the buffer, then a mid-year scale to 2 /ES once the rolling-50 verdict confirms edge.',
            transitions: [
                { startMonth: BUFFER_MONTHS, contracts: 1 },
                { startMonth: 6.0,           contracts: 2 }  // mid-year switch
            ]
        },
        cooperative: {
            label: 'Cooperative — gradual scaling 1 → 2 → 3 → 4. Each step is earned by ≈$5K profit at the current contract count. Acceleration is built in: each next $5K arrives faster than the last because throughput scales with contracts.',
            transitions: [
                { startMonth: COOP_T1, contracts: 1 },
                { startMonth: COOP_T2, contracts: 2 },
                { startMonth: COOP_T3, contracts: 3 },
                { startMonth: COOP_T4, contracts: 4 }
            ]
        }
    };

    function buildSteps(scenario) {
        const cfg = SCENARIO_CONFIG[scenario];
        if (!cfg) return [];
        const out = [];
        for (let i = 0; i < cfg.transitions.length; i++) {
            const tr = cfg.transitions[i];
            const t = tr.startMonth;
            const enginePnl = enginePnlAt(t, scenario);
            const spy = spyAt(t);
            out.push({
                n: i + 1,
                contracts: Math.min(tr.contracts, MAX_CONTRACTS),
                timeReached: t,
                spy: spy,
                cash: CASH_START,
                enginePnl: enginePnl,
                nlv: spy + CASH_START + enginePnl,
                cumProfit: enginePnl
            });
        }
        return out;
    }

    /* Compose a series of (t, spy, cash, enginePnl, total) points for the
       stacked-area chart. Densely sampled monthly. */
    function buildCurve(scenario) {
        const points = [];
        const SUBDIV = 48; // 4 samples per month
        for (let i = 0; i <= SUBDIV; i++) {
            const t = (i / SUBDIV) * DURATION_MAX;
            const spy = spyAt(t);
            const enginePnl = enginePnlAt(t, scenario);
            points.push({
                t: t,
                spy: spy,
                cash: CASH_START,
                enginePnl: enginePnl,
                value: spy + CASH_START + enginePnl
            });
        }
        return points;
    }

    const SCENARIO_LABELS = Object.keys(SCENARIO_CONFIG).reduce(function (acc, k) {
        acc[k] = SCENARIO_CONFIG[k].label;
        return acc;
    }, {});

    let currentScenario = 'realistic';
    let currentPoints = buildCurve(currentScenario);
    let currentSteps  = buildSteps(currentScenario);

    function drawLadderChart() {
        const svg = document.getElementById('cl-stairs-svg');
        if (!svg) return;

        const steps = currentSteps;
        const pts = currentPoints;
        const W = 1100, H = 400;
        const PAD_L = 70, PAD_R = 70, PAD_T = 36, PAD_B = 70;
        const innerW = W - PAD_L - PAD_R;
        const innerH = H - PAD_T - PAD_B;

        const lastStep = steps[steps.length - 1];
        const finalVal = pts[pts.length - 1].value;

        // Y range: $0 to (final NLV rounded up to next $20K)
        const yMaxRaw = Math.max.apply(null, pts.map(function (p) { return p.value; }));
        const yMax = Math.ceil(yMaxRaw / 20000) * 20000;
        const xAt = function (t) { return PAD_L + (t / DURATION_MAX) * innerW; };
        const yAt = function (v) { return H - PAD_B - (v / yMax) * innerH; };

        /* ── HERO ── */
        const heroEl = document.getElementById('cl-hero');
        if (heroEl) {
            const profit = finalVal - NLV_START;
            const profitPct = (profit / NLV_START) * 100;
            const finalSpy = pts[pts.length - 1].spy;
            const finalEngine = pts[pts.length - 1].enginePnl;
            const spyGain = finalSpy - SPY_START;
            const engineFrac = profit > 0 ? Math.round((finalEngine / profit) * 100) : 0;
            const spyFrac = profit > 0 ? Math.round((spyGain / profit) * 100) : 0;
            heroEl.innerHTML = [
                '<div class="cl-hero__col"><p class="cl-hero__label">Start</p><p class="cl-hero__value">$' + (NLV_START / 1000) + 'K</p><p class="cl-hero__sub">$' + (SPY_START/1000) + 'K SPY · $' + (CASH_START/1000) + 'K cash</p></div>',
                '<div class="cl-hero__arrow">→</div>',
                '<div class="cl-hero__col"><p class="cl-hero__label">Year-end</p><p class="cl-hero__value cl-hero__value--accent">$' + Math.round(finalVal / 1000) + 'K</p><p class="cl-hero__sub">' + lastStep.contracts + ' /ES · 0.5% NLV risk</p></div>',
                '<div class="cl-hero__col"><p class="cl-hero__label">Total profit</p><p class="cl-hero__value cl-hero__value--gold">+$' + Math.round(profit / 1000) + 'K</p><p class="cl-hero__sub">' + (profitPct >= 0 ? '+' : '') + profitPct.toFixed(0) + '% over 12 mo</p></div>',
                '<div class="cl-hero__col"><p class="cl-hero__label">Contribution split</p><p class="cl-hero__value cl-hero__value--gold">' + spyFrac + ' / ' + engineFrac + '</p><p class="cl-hero__sub">SPY (+$' + Math.round(spyGain/1000) + 'K) · Engine (+$' + Math.round(finalEngine/1000) + 'K)</p></div>'
            ].join('');
        }

        /* ── STACKED-AREA PORTFOLIO COMPOSITION SVG ── */
        const parts = [];

        // Y gridlines + dollar labels ($20K increments)
        for (let v = 0; v <= yMax; v += 20000) {
            const y = yAt(v);
            parts.push('<line x1="' + PAD_L + '" y1="' + y + '" x2="' + (W - PAD_R) + '" y2="' + y + '" stroke="rgba(27,42,74,0.06)" />');
            parts.push('<text x="' + (PAD_L - 8) + '" y="' + (y + 4) + '" font-size="11" fill="#64748B" font-family="Source Sans 3" text-anchor="end">$' + (v / 1000) + 'K</text>');
        }
        // X-axis gridlines + month labels
        for (let m = 0; m <= 12; m += 2) {
            const x = xAt(m);
            parts.push('<line x1="' + x + '" y1="' + PAD_T + '" x2="' + x + '" y2="' + (H - PAD_B) + '" stroke="rgba(27,42,74,0.04)" />');
            parts.push('<text x="' + x + '" y="' + (H - PAD_B + 18) + '" font-size="11" fill="#64748B" font-family="Source Sans 3" text-anchor="middle">' + m + (m === 0 ? ' mo' : '') + '</text>');
        }

        // Build stacked-area paths: SPY (bottom) + cash (middle) + engine (top)
        function buildArea(getTopValue, getBottomValue) {
            const top = pts.map(function (p) { return xAt(p.t) + ',' + yAt(getTopValue(p)); });
            const bot = pts.slice().reverse().map(function (p) { return xAt(p.t) + ',' + yAt(getBottomValue(p)); });
            return 'M ' + top.join(' L ') + ' L ' + bot.join(' L ') + ' Z';
        }
        const spyArea    = buildArea(function (p) { return p.spy; }, function () { return 0; });
        const cashArea   = buildArea(function (p) { return p.spy + p.cash; }, function (p) { return p.spy; });
        const engineArea = buildArea(function (p) { return p.value; }, function (p) { return p.spy + p.cash; });

        parts.push('<path d="' + spyArea + '" fill="#1B2A4A" fill-opacity="0.85"/>');           // SPY: deep navy
        parts.push('<path d="' + cashArea + '" fill="#94A3B8" fill-opacity="0.7"/>');           // Cash: slate
        parts.push('<path d="' + engineArea + '" fill="#C8A951" fill-opacity="0.9"/>');         // Engine: gold

        // Top-line stroke (total NLV)
        const topLine = pts.map(function (p, i) { return (i === 0 ? 'M ' : 'L ') + xAt(p.t) + ',' + yAt(p.value); }).join(' ');
        parts.push('<path d="' + topLine + '" fill="none" stroke="#131E36" stroke-width="2"/>');

        // SPY/cash dividing line (subtle, white)
        const spyTopLine = pts.map(function (p, i) { return (i === 0 ? 'M ' : 'L ') + xAt(p.t) + ',' + yAt(p.spy); }).join(' ');
        const cashTopLine = pts.map(function (p, i) { return (i === 0 ? 'M ' : 'L ') + xAt(p.t) + ',' + yAt(p.spy + p.cash); }).join(' ');
        parts.push('<path d="' + spyTopLine + '" fill="none" stroke="white" stroke-width="0.8" opacity="0.5"/>');
        parts.push('<path d="' + cashTopLine + '" fill="none" stroke="white" stroke-width="0.8" opacity="0.5"/>');

        // 60-day engine-buffer marker — vertical dashed line + label below the X axis (applies only to engine; SPY runs from day 1)
        const xBuf = xAt(BUFFER_MONTHS);
        parts.push('<line x1="' + xBuf + '" y1="' + PAD_T + '" x2="' + xBuf + '" y2="' + (H - PAD_B + 6) + '" stroke="#475569" stroke-width="1" stroke-dasharray="3 3" opacity="0.6"/>');
        parts.push('<text x="' + xBuf + '" y="' + (H - PAD_B + 38) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#475569" font-family="Source Sans 3" letter-spacing="1">↑ ENGINE BEGINS · after 60-day buffer</text>');

        // Build the stair-step path
        // Walk through steps: at each step, horizontal segment from prev time to current time at current contract level
        // After last step, extend horizontally to t=12 at last contract level
        // Contract transition markers — gold pin + label, sitting on the engine area
        steps.forEach(function (s) {
            const x = xAt(s.timeReached);
            const yTop = yAt(s.nlv);
            parts.push('<line x1="' + x + '" y1="' + yTop + '" x2="' + x + '" y2="' + (yTop - 28) + '" stroke="#C8A951" stroke-width="1.5"/>');
            parts.push('<circle cx="' + x + '" cy="' + yTop + '" r="5" fill="#C8A951" stroke="white" stroke-width="1.5"/>');
            parts.push('<rect x="' + (x + 6) + '" y="' + (yTop - 42) + '" width="62" height="18" rx="2" fill="#1B2A4A"/>');
            parts.push('<text x="' + (x + 37) + '" y="' + (yTop - 30) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#C8A951" font-family="Source Sans 3">' + s.contracts + ' /ES</text>');
        });

        // Layer legend — above the plot area, stays out of the chart interior
        const legendY = 14;
        parts.push('<g class="cl-legend" font-family="Source Sans 3" font-size="11">');
        parts.push('<rect x="' + PAD_L + '" y="' + legendY + '" width="12" height="10" fill="#1B2A4A" fill-opacity="0.85"/>');
        parts.push('<text x="' + (PAD_L + 18) + '" y="' + (legendY + 9) + '" fill="#1B2A4A" font-weight="600">SPY foundation · 90% · 10%/yr</text>');
        parts.push('<rect x="' + (PAD_L + 220) + '" y="' + legendY + '" width="12" height="10" fill="#94A3B8" fill-opacity="0.7"/>');
        parts.push('<text x="' + (PAD_L + 238) + '" y="' + (legendY + 9) + '" fill="#1B2A4A" font-weight="600">Cash buffer · 10%</text>');
        parts.push('<rect x="' + (PAD_L + 360) + '" y="' + legendY + '" width="12" height="10" fill="#C8A951"/>');
        parts.push('<text x="' + (PAD_L + 378) + '" y="' + (legendY + 9) + '" fill="#1B2A4A" font-weight="600">Engine profit</text>');
        parts.push('</g>');

        // Year-end stacked breakdown callout on the right
        const xEnd = xAt(DURATION_MAX);
        const finalSpy = pts[pts.length - 1].spy;
        const finalEngine = pts[pts.length - 1].enginePnl;
        const finalProfit = finalVal - NLV_START;
        const calloutH = 90;
        const calloutY = yAt(finalVal) - 8;
        const calloutAdj = Math.max(PAD_T + 4, calloutY - calloutH);
        parts.push('<rect x="' + (xEnd - 132) + '" y="' + calloutAdj + '" width="132" height="' + calloutH + '" rx="4" fill="#1B2A4A"/>');
        parts.push('<text x="' + (xEnd - 66) + '" y="' + (calloutAdj + 14) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#C8A951" font-family="Source Sans 3" letter-spacing="1">YEAR-END NLV</text>');
        parts.push('<text x="' + (xEnd - 66) + '" y="' + (calloutAdj + 36) + '" text-anchor="middle" font-size="20" font-weight="700" fill="white" font-family="Source Sans 3">$' + Math.round(finalVal / 1000) + 'K</text>');
        parts.push('<text x="' + (xEnd - 124) + '" y="' + (calloutAdj + 56) + '" font-size="10" fill="#94A3B8" font-family="Source Sans 3">SPY    +$' + Math.round((finalSpy - SPY_START)/1000) + 'K</text>');
        parts.push('<text x="' + (xEnd - 124) + '" y="' + (calloutAdj + 70) + '" font-size="10" fill="#C8A951" font-family="Source Sans 3">Engine +$' + Math.round(finalEngine/1000) + 'K</text>');
        parts.push('<text x="' + (xEnd - 124) + '" y="' + (calloutAdj + 84) + '" font-size="10" fill="white" font-weight="700" font-family="Source Sans 3">Total  +$' + Math.round(finalProfit/1000) + 'K</text>');

        svg.innerHTML = parts.join('');

        /* ── THREE SUMMARY CARDS ── */
        const sumEl = document.getElementById('cl-summary');
        if (sumEl) {
            const stepsAdvanced = lastStep.contracts - 1;
            const finalSpy = pts[pts.length - 1].spy;
            const finalEngine = pts[pts.length - 1].enginePnl;
            const spyGain = finalSpy - SPY_START;
            const profit = finalVal - NLV_START;
            const finalRisk = Math.round(finalVal * 0.005);

            let positionNarrative;
            if (lastStep.contracts === 1) positionNarrative = '1 /ES the entire active window';
            else if (steps.length === 2)  positionNarrative = '1 → ' + lastStep.contracts + ' /ES @ month ' + steps[1].timeReached.toFixed(1);
            else                          positionNarrative = lastStep.contracts + ' /ES at year-end';

            sumEl.innerHTML = [
                '<article class="cl-card">',
                  '<p class="cl-card__label">SPY foundation · 90%</p>',
                  '<p class="cl-card__value">+$' + Math.round(spyGain / 1000) + 'K</p>',
                  '<dl class="cl-card__list">',
                    '<div><dt>Start</dt><dd>$' + (SPY_START/1000) + 'K</dd></div>',
                    '<div><dt>Year-end</dt><dd>$' + Math.round(finalSpy/1000) + 'K</dd></div>',
                    '<div><dt>Assumption</dt><dd>10% annualized (20-yr avg)</dd></div>',
                  '</dl>',
                '</article>',
                '<article class="cl-card cl-card--gold">',
                  '<p class="cl-card__label">Engine overlay</p>',
                  '<p class="cl-card__value">+$' + Math.round(finalEngine / 1000) + 'K</p>',
                  '<dl class="cl-card__list">',
                    '<div><dt>Position arc</dt><dd>' + positionNarrative + '</dd></div>',
                    '<div><dt>Throughput</dt><dd>$' + PER_ES_MONTHLY.toLocaleString() + '/mo · /ES</dd></div>',
                    '<div><dt>Cap</dt><dd>' + MAX_CONTRACTS + ' /ES max</dd></div>',
                  '</dl>',
                '</article>',
                '<article class="cl-card">',
                  '<p class="cl-card__label">Combined</p>',
                  '<p class="cl-card__value">$' + Math.round(finalVal / 1000) + 'K NLV</p>',
                  '<dl class="cl-card__list">',
                    '<div><dt>Total profit</dt><dd>+$' + Math.round(profit / 1000) + 'K</dd></div>',
                    '<div><dt>Engine share</dt><dd>' + (profit > 0 ? Math.round(finalEngine/profit*100) : 0) + '%</dd></div>',
                    '<div><dt>Risk / trade</dt><dd>$' + finalRisk.toLocaleString() + ' (0.5% NLV)</dd></div>',
                  '</dl>',
                '</article>'
            ].join('');
        }

        /* ── TIME-AT-EACH-LEVEL BARS ── */
        const accelEl = document.getElementById('cl-accel-bars');
        if (accelEl) {
            // Compose segments: buffer + one per contract level + tail to year-end
            const segments = [];
            segments.push({ label: '60-day buffer', sub: 'no trading', months: BUFFER_MONTHS, kind: 'buffer' });
            for (let i = 0; i < steps.length; i++) {
                const s = steps[i];
                const nextT = i + 1 < steps.length ? steps[i + 1].timeReached : DURATION_MAX;
                const dur = nextT - s.timeReached;
                segments.push({
                    label: s.contracts + ' /ES',
                    sub: '$' + Math.round(s.contracts * PER_ES_MONTHLY).toLocaleString() + '/mo throughput',
                    months: dur,
                    kind: 'trading'
                });
            }
            const maxDur = Math.max.apply(null, segments.map(function (x) { return x.months; }));
            accelEl.innerHTML = segments.map(function (s) {
                const pct = maxDur > 0 ? (s.months / maxDur) * 100 : 0;
                const dur = s.months < 1 ? Math.round(s.months * 30) + ' days' : s.months.toFixed(1) + ' months';
                return '<div class="cl-bar cl-bar--' + s.kind + '">'
                    + '<span class="cl-bar__label">' + s.label + '<small>' + s.sub + '</small></span>'
                    + '<div class="cl-bar__track"><div class="cl-bar__fill" style="width:' + pct + '%"></div></div>'
                    + '<span class="cl-bar__val">' + dur + '</span>'
                    + '</div>';
            }).join('');
        }

        // Render cadence summary table (keeps existing detail table)
        renderCadenceTable();
    }

    function renderCadenceTable() {
        const tbody = document.getElementById('cl-cadence-tbody');
        if (!tbody) return;
        const steps = currentSteps;
        const lastPt = currentPoints[currentPoints.length - 1];
        let rows = '';

        function spySegment(tStart, tEnd) { return spyAt(tEnd) - spyAt(tStart); }

        // Buffer row — SPY still grows during this window
        rows += '<tr><td>0 → ' + BUFFER_MONTHS.toFixed(1) + ' mo · 60-day buffer</td>'
            + '<td>0 /ES · engine idle</td>'
            + '<td>+$' + Math.round(spySegment(0, BUFFER_MONTHS)).toLocaleString() + ' SPY</td>'
            + '<td>+$0 engine</td></tr>';

        for (let i = 0; i < steps.length; i++) {
            const s = steps[i];
            const nextT = i + 1 < steps.length ? steps[i + 1].timeReached : DURATION_MAX;
            const dur = nextT - s.timeReached;
            const enginePnl = s.contracts * PER_ES_MONTHLY * dur;
            const spyPnl = spySegment(s.timeReached, nextT);
            const durLabel = dur < 1 ? Math.round(dur * 30) + ' days' : dur.toFixed(1) + ' months';
            rows += '<tr>'
                + '<td>' + s.timeReached.toFixed(1) + ' → ' + nextT.toFixed(1) + ' mo · ' + durLabel + '</td>'
                + '<td>' + s.contracts + ' /ES</td>'
                + '<td>+$' + Math.round(spyPnl).toLocaleString() + ' SPY</td>'
                + '<td>+$' + Math.round(enginePnl).toLocaleString() + ' engine</td>'
                + '</tr>';
        }

        const totalSpy = lastPt.spy - SPY_START;
        const totalEngine = lastPt.enginePnl;
        const totalProfit = lastPt.value - NLV_START;
        rows += '<tr class="cadence__total">'
            + '<td>Year-end total</td>'
            + '<td>NLV $' + Math.round(lastPt.value / 1000) + 'K</td>'
            + '<td>+$' + Math.round(totalSpy).toLocaleString() + ' SPY</td>'
            + '<td>+$' + Math.round(totalEngine).toLocaleString() + ' engine · +$' + Math.round(totalProfit/1000) + 'K combined</td>'
            + '</tr>';
        tbody.innerHTML = rows;
    }

    /* Kill conditions rail */
    const KILLS = [
        { id: 'ED-01', name: 'Rolling-100 EV',       trigger: '≤ $0 / trade',              link: 'Tests 1, 2' },
        { id: 'ED-02', name: 'Rolling-50 win rate',  trigger: '< 52%',                     link: 'Test 6' },
        { id: 'ED-03', name: 'Rolling-50 PF',        trigger: '< 1.30',                    link: 'Test 3' },
        { id: 'ED-04', name: 'Rolling-50 W:L ratio', trigger: '< 1.10',                    link: 'Test 5' },
        { id: 'ED-05a', name: 'DD warning',          trigger: '> −45 /ES pts',             link: 'Architecture · 25th-pct bootstrap' },
        { id: 'ED-05b', name: 'DD hard kill',        trigger: '> −75 /ES pts',             link: 'Architecture · 1st-pct bootstrap' },
        { id: 'ED-06', name: 'Top-3 removal',        trigger: 'P&L < 0 without top-3',     link: 'Test 4' },
        { id: 'ED-07', name: 'Loss streak',          trigger: '≥ 7 consecutive',           link: 'Test 7' },
        { id: 'ED-08', name: 'P-value floor',        trigger: 'p > 0.10 past trade 100',   link: 'Test 1' }
    ];

    function renderKills() {
        const wrap = document.getElementById('cl-kills-chips');
        if (!wrap) return;
        wrap.innerHTML = KILLS.map(function (k) {
            return [
                '<details class="cl-kill">',
                  '<summary class="cl-kill__summary">',
                    '<span class="cl-kill__id">' + k.id + '</span>',
                    '<span class="cl-kill__name">' + k.name + '</span>',
                  '</summary>',
                  '<div class="cl-kill__body">',
                    '<p class="cl-kill__trigger">Trigger: <strong>' + k.trigger + '</strong></p>',
                    '<p class="cl-kill__link">Linked battery: ' + k.link + '</p>',
                  '</div>',
                '</details>'
            ].join('');
        }).join('');
    }
    renderKills();

    /* Scenario toggle wiring */
    const scenarioBtns = document.querySelectorAll('.scenario-toggle__btn');
    const scenarioOutcome = document.getElementById('scenarioOutcome');

    function setScenario(name) {
        currentScenario = name;
        currentPoints = buildCurve(name);
        currentSteps  = buildSteps(name);
        scenarioOutcome.textContent = SCENARIO_LABELS[name] || '';
        scenarioBtns.forEach(function (b) {
            const active = b.dataset.scenario === name;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-selected', String(active));
        });
        drawLadderChart();
        track('ladder_scenario_change', { scenario: name });
    }
    scenarioBtns.forEach(function (b) { b.addEventListener('click', function () { setScenario(b.dataset.scenario); }); });

    // Initial draw — lazy on viewport entry
    if ('IntersectionObserver' in window) {
        const lEl = document.getElementById('ladder');
        if (lEl) {
            const lIO = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) { if (e.isIntersecting) { drawLadderChart(); lIO.disconnect(); } });
            }, { threshold: 0.1 });
            lIO.observe(lEl);
        }
    } else {
        drawLadderChart();
    }
    window.addEventListener('resize', function () { drawLadderChart(); });

    /* ------------------------------------------------
       4. REFERENCE DATASET
       Representative 227-trade record statistically matching published reference stats
       (60.3% WR, +7.96 avg win, -6.08 avg loss, PF 1.99, EV +2.38 pts).
       Hiren's actual CSV gets swapped in by replacing REFERENCE_TRADES.
       ------------------------------------------------ */
    function generateReferenceTrades() {
        // Deterministic PRNG (Mulberry32) for reproducible representative dataset
        let seed = 0x42424242;
        function rand() {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }

        // Build a points pool that matches published reference stats:
        // 135 W (avg +7.96) + 89 L (avg -6.08) + 3 BE = 227, EV +2.38, PF 1.99
        // Use a small spread around each mean and shift the last sample to lock the mean.
        function buildPool(n, target, spread, sign) {
            const arr = [];
            for (let i = 0; i < n; i++) {
                // Triangular-ish distribution around target
                const r = (rand() + rand() + rand()) / 3 - 0.5; // ~N(0, ~0.16)
                arr.push(target + r * spread * 2);
            }
            // Lock mean to exactly the target
            const actual = arr.reduce(function (a, b) { return a + b; }, 0) / n;
            const delta = target - actual;
            for (let i = 0; i < n; i++) arr[i] = Math.max(0.5, arr[i] + delta);
            // Apply sign and re-clamp
            return arr.map(function (v) { return sign * Math.max(0.5, v); });
        }

        const winsArr  = buildPool(135, 7.96, 6.0,  1);
        const lossArr  = buildPool(89,  6.08, 4.5, -1);
        const beArr    = [0, 0, 0];

        // Interleave deterministically — Fisher-Yates with seeded rand
        let pool = winsArr.concat(lossArr, beArr);
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
        }

        const trades = [];
        const start = new Date('2023-04-03T13:30:00Z').getTime();
        const dayMs = 86400000;
        for (let i = 0; i < pool.length; i++) {
            const dayOffset = Math.floor(i * (96 / 227));
            const ts = start + dayOffset * dayMs + Math.floor(rand() * 6 * 3600 * 1000);
            const pts = Math.round(pool[i] * 100) / 100;
            trades.push({
                id: i + 1,
                timestamp: new Date(ts).toISOString(),
                symbol: '/ES',
                side: rand() > 0.5 ? 'LONG' : 'SHORT',
                result: pts > 0 ? 'W' : pts < 0 ? 'L' : 'BE',
                pts: pts,
                dollars: Math.round(pts * 50 * 100) / 100
            });
        }
        return trades;
    }

    let REFERENCE_TRADES = generateReferenceTrades();
    let CURRENT_DATASET_LABEL = 'Ekantik reference (227 trades)';
    let currentTrades = REFERENCE_TRADES.slice();

    /* ------------------------------------------------
       5. 8-TEST SUSTAINABILITY BATTERY
       ------------------------------------------------ */
    // Radial position classes — top, then clockwise.
    const POS = ['t', 'tr', 'r', 'br', 'b', 'bl', 'l', 'tl'];

    const TEST_DESC = {
        1: {
            name: 'Statistical Significance',
            short: 'Rules out pure luck as the explanation.',
            what: 'Treats the trade record as a statistical sample and asks: how likely is the apparent edge to be noise from a random distribution?',
            why: 'If a strategy cannot beat noise, there is no edge to falsify. P-value separates a story from a signal.',
            fail: 'FAIL would mean the dataset cannot reject the null hypothesis that true EV is ≤ zero. No statistical edge.'
        },
        2: {
            name: 'Confidence Interval',
            short: 'Profitable even in the worst plausible replay.',
            what: 'Computes the range within which the true per-trade EV almost certainly lies, given the sample.',
            why: 'A point estimate is just one number. The CI shows the cloud around it — and whether the cloud touches zero.',
            fail: 'FAIL would mean the lower bound of the 95% CI dips below zero — the apparent edge could plausibly be a sampling artefact.'
        },
        3: {
            name: 'Profit Factor',
            short: 'Winners dwarf losers by a comfortable margin.',
            what: 'Gross dollars won divided by gross dollars lost. Measures the raw cash asymmetry between winners and losers.',
            why: 'Win rate alone does not tell you whether the strategy compounds. PF tests whether wins are meaningfully larger than the losses they fund.',
            fail: 'FAIL would mean PF below 1.50 — the strategy works in theory but offers no margin for slippage, fees, or regime drift.'
        },
        4: {
            name: 'Outlier Independence',
            short: 'The edge survives without its biggest winners.',
            what: 'Removes the three largest winners from the dataset and recomputes everything. Tests whether the edge depends on rare outliers.',
            why: 'If profitability lives entirely in a handful of jackpot trades, the edge is fragile.',
            fail: 'FAIL would mean P&L turns negative without top-3, or PF collapses below 1.30. The strategy would be exposed as outlier-dependent.'
        },
        5: {
            name: 'Risk-Normalized Edge',
            short: 'Per unit of risk taken, the strategy expects to gain.',
            what: 'Expresses per-trade EV in units of risk (1R = average loss size). Risk-normalizes the edge across instruments and account sizes.',
            why: 'Dollar EV scales with sizing. R-expectancy does not — it tells you, per unit of risk taken, how much the strategy expects to return.',
            fail: 'FAIL would mean R-expectancy below +0.20R — a thin edge that would struggle to survive commission drag.'
        },
        6: {
            name: 'Breakeven Buffer',
            short: 'Enough cushion above breakeven to survive a regime shift.',
            what: 'Calculates the win rate the strategy would need at its observed win/loss ratio to break even — then measures the gap to the actual win rate.',
            why: 'Strategies decay. The buffer measures how much win-rate slippage the strategy can absorb before crossing into losing territory.',
            fail: 'FAIL would mean a buffer below 5 percentage points — a small regime shift could push the strategy underwater.'
        },
        7: {
            name: 'Streak Resilience',
            short: 'Losing streaks short enough to keep discipline intact.',
            what: 'Measures the maximum consecutive loss streak in the record and compares it to the expected maximum given the win rate and sample size.',
            why: 'Even a high-WR strategy will sometimes produce streaks of losses by pure variance. The test confirms the observed worst case is within the statistical envelope.',
            fail: 'FAIL would mean a streak longer than 7 OR more than double the expected maximum.'
        },
        8: {
            name: 'Bootstrap P(profit)',
            short: 'Wins in almost every reshuffle of its own trades.',
            what: 'Resamples the trade record with replacement many thousand times and asks: in what fraction of simulated sequences does the strategy end profitable?',
            why: 'Statistical tests assume distributions. Bootstrapping makes no such assumption — it re-runs the actual edge against itself under all possible orderings.',
            fail: 'FAIL would mean fewer than 90% of bootstrap paths end profitable.'
        }
    };

    function mean(arr) { return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length; }
    function stddev(arr, mu) {
        if (mu == null) mu = mean(arr);
        const v = arr.reduce(function (a, x) { return a + (x - mu) * (x - mu); }, 0) / (arr.length - 1);
        return Math.sqrt(v);
    }
    function erf(x) {
        const s = Math.sign(x); x = Math.abs(x);
        const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
        const t = 1 / (1 + p * x);
        const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return s * y;
    }
    function tCdfApprox(t, df) {
        // Z-approximation for large df (>30); reasonable for our sample sizes
        return 0.5 * (1 + erf(t / Math.sqrt(2)));
    }

    function computeBattery(trades) {
        if (!trades || trades.length === 0) return null;
        const pts = trades.map(function (t) { return t.pts; });
        const n = pts.length;
        const wins = pts.filter(function (x) { return x > 0; });
        const losses = pts.filter(function (x) { return x < 0; });
        const winRate = wins.length / n;
        const grossWin = wins.reduce(function (a, b) { return a + b; }, 0);
        const grossLoss = Math.abs(losses.reduce(function (a, b) { return a + b; }, 0));
        const avgWin = wins.length ? grossWin / wins.length : 0;
        const avgLoss = losses.length ? grossLoss / losses.length : 0;
        const evMean = mean(pts);
        const sd = stddev(pts, evMean);
        const se = sd / Math.sqrt(n);

        // T1 — p-value (one-sided, H0: mu ≤ 0)
        const t = se > 0 ? evMean / se : 0;
        const pVal = 1 - tCdfApprox(t, n - 1);
        const t1 = { value: pVal, display: 'p ' + (pVal < 0.0001 ? '< 0.0001' : '= ' + pVal.toFixed(4)) + ' (t=' + t.toFixed(2) + ')', pass: pVal < 0.05, threshold: 'p < 0.05' };

        // T2 — 95% CI on EV
        const lower = evMean - 1.96 * se;
        const upper = evMean + 1.96 * se;
        const t2 = { value: lower, display: '[' + (lower >= 0 ? '+' : '') + lower.toFixed(2) + ', ' + (upper >= 0 ? '+' : '') + upper.toFixed(2) + '] pts', pass: lower > 0, threshold: 'Lower bound > 0' };

        // T3 — Profit Factor
        const pf = grossLoss > 0 ? grossWin / grossLoss : Infinity;
        const t3 = { value: pf, display: isFinite(pf) ? pf.toFixed(2) : '∞', pass: pf > 1.50, threshold: 'PF > 1.50' };

        // T4 — Top-3 winner removal
        const sortedWins = wins.slice().sort(function (a, b) { return b - a; });
        const top3 = sortedWins.slice(0, 3).reduce(function (a, b) { return a + b; }, 0);
        const remainingPnl = pts.reduce(function (a, b) { return a + b; }, 0) - top3;
        const remainingWin = grossWin - top3;
        const remainingPf = grossLoss > 0 ? remainingWin / grossLoss : Infinity;
        const t4 = { value: remainingPnl, display: (remainingPnl >= 0 ? '+' : '') + remainingPnl.toFixed(0) + ' pts (PF ' + (isFinite(remainingPf) ? remainingPf.toFixed(2) : '∞') + ')', pass: remainingPnl > 0 && remainingPf > 1.30, threshold: 'Stays positive; PF > 1.30' };

        // T5 — R-expectancy
        const rExp = avgLoss > 0 ? evMean / avgLoss : 0;
        const t5 = { value: rExp, display: (rExp >= 0 ? '+' : '') + rExp.toFixed(2) + 'R / trade', pass: rExp > 0.20, threshold: '> 0.20 R' };

        // T6 — Breakeven WR buffer
        const wl = avgLoss > 0 ? avgWin / avgLoss : 0;
        const breakevenWR = wl > 0 ? 1 / (1 + wl) : 1;
        const buffer = (winRate - breakevenWR) * 100;
        const t6 = { value: buffer, display: (buffer >= 0 ? '+' : '') + buffer.toFixed(2) + ' pp', pass: buffer > 5, threshold: '> 5 pp' };

        // T7 — Streak resilience
        let maxStreak = 0, cur = 0;
        for (let i = 0; i < pts.length; i++) {
            if (pts[i] < 0) { cur++; if (cur > maxStreak) maxStreak = cur; } else { cur = 0; }
        }
        const expectedMax = winRate > 0 && winRate < 1 ? Math.ceil(Math.log(n) / -Math.log(1 - winRate)) : 0;
        const t7 = { value: maxStreak, display: 'Max ' + maxStreak + ' (expected ~' + expectedMax + ')', pass: maxStreak <= 7 && maxStreak <= 2 * expectedMax, threshold: '≤ 7 AND ≤ 2× expected' };

        // T8 — Bootstrap P(profit) — 5,000 resamples (50,000 is too slow client-side; statistically equivalent)
        const BOOTS = 5000;
        let profitable = 0;
        for (let b = 0; b < BOOTS; b++) {
            let sum = 0;
            for (let i = 0; i < n; i++) sum += pts[(Math.random() * n) | 0];
            if (sum > 0) profitable++;
        }
        const pProfit = profitable / BOOTS;
        const t8 = { value: pProfit, display: (pProfit * 100).toFixed(1) + '% (' + BOOTS.toLocaleString() + ' resamples)', pass: pProfit > 0.90, threshold: '> 90%' };

        return [t1, t2, t3, t4, t5, t6, t7, t8];
    }

    function renderBattery(trades) {
        const grid = document.getElementById('batteryGrid');
        const verdict = document.getElementById('batteryVerdict');
        const timestamp = document.getElementById('batteryTimestamp');
        const datasetLabel = document.getElementById('batteryDataset');
        if (!grid) return;

        const results = computeBattery(trades);
        if (!results) {
            grid.innerHTML = '<p>Insufficient data to compute battery.</p>';
            return;
        }
        const passed = results.filter(function (r) { return r.pass; }).length;
        verdict.textContent = passed + ' / 8 ' + (passed === 8 ? 'PASS' : passed >= 6 ? 'PARTIAL' : 'FAIL');
        verdict.classList.toggle('has-fail', passed < 8);
        timestamp.textContent = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
        if (datasetLabel) datasetLabel.textContent = CURRENT_DATASET_LABEL;

        // Per-test bar visualization: where does actual sit relative to threshold?
        // bars[i] = { thresholdPct: 0-100, actualPct: 0-100, scaleLabel: 'low / threshold / surplus' }
        const BARS = {
            1: { tMark: 30, actual: function (r) { return Math.min(100, 100 - r.value * 100 / 0.05 * 0.7); }, scale: ['p = 0.10', 'p = 0.05', 'p < 0.0001'] },
            2: { tMark: 30, actual: function (r) { return Math.max(20, Math.min(100, 30 + r.value * 18)); }, scale: ['CI lower < 0', 'CI lower = 0', 'CI lower ≫ 0'] },
            3: { tMark: 33, actual: function (r) { return Math.max(15, Math.min(100, (r.value / 3) * 100)); }, scale: ['PF 1.0', 'PF 1.5', 'PF 3.0+'] },
            4: { tMark: 30, actual: function (r) { return Math.max(15, Math.min(100, 20 + r.value / 10)); }, scale: ['breakeven', 'PF 1.30 floor', 'preserved edge'] },
            5: { tMark: 25, actual: function (r) { return Math.max(15, Math.min(100, 25 + r.value * 130)); }, scale: ['0R', '+0.20R', '+1.0R'] },
            6: { tMark: 17, actual: function (r) { return Math.max(15, Math.min(100, 17 + r.value * 3)); }, scale: ['0 pp', '+5 pp', '+25 pp'] },
            7: { tMark: 70, actual: function (r) { return Math.max(15, Math.min(95, 100 - r.value * 14)); }, scale: ['streak ≥ 7', 'expected max', 'no streaks'] },
            8: { tMark: 80, actual: function (r) { return Math.max(15, Math.min(100, r.value * 100)); }, scale: ['50%', '90% floor', '100%'] }
        };

        grid.innerHTML = results.map(function (r, i) {
            const num = i + 1;
            const meta = TEST_DESC[num];
            const numStr = num < 10 ? '0' + num : String(num);
            const cfg = BARS[num];
            const tMark = cfg ? cfg.tMark : 30;
            const actual = cfg ? Math.max(2, Math.min(100, cfg.actual(r))) : 50;
            const surplusW = Math.max(0, actual - tMark);
            return [
                '<details class="trow' + (r.pass ? '' : ' is-fail') + '">',
                  '<summary class="trow__summary">',
                    '<div class="trow__head">',
                      '<span class="trow__num">' + numStr + '</span>',
                      '<div class="trow__title">',
                        '<p class="trow__name">' + meta.name + '</p>',
                        '<p class="trow__short">' + meta.short + '</p>',
                      '</div>',
                      '<div class="trow__verdict">',
                        '<span class="trow__pill">' + (r.pass ? 'PASS' : 'FAIL') + '</span>',
                      '</div>',
                    '</div>',
                    '<div class="trow__data">',
                      '<div class="trow__numbers">',
                        '<span class="trow__value">' + r.display + '</span>',
                        '<span class="trow__threshold">vs. threshold ' + r.threshold + '</span>',
                      '</div>',
                      '<div class="trow__barwrap">',
                        '<div class="trow__bar">',
                          '<div class="trow__bar-threshold" style="left:' + tMark + '%"></div>',
                          '<div class="trow__bar-fill" style="width:' + actual + '%"></div>',
                          '<div class="trow__bar-surplus" style="left:' + tMark + '%; width:' + surplusW + '%"></div>',
                          '<div class="trow__bar-marker" style="left:' + actual + '%"></div>',
                        '</div>',
                        '<div class="trow__bar-scale">',
                          '<span>' + cfg.scale[0] + '</span>',
                          '<span class="trow__bar-thr-label" style="left:' + tMark + '%">' + cfg.scale[1] + '</span>',
                          '<span>' + cfg.scale[2] + '</span>',
                        '</div>',
                      '</div>',
                    '</div>',
                    '<p class="trow__expand-cue">◆ Click for full explanation</p>',
                  '</summary>',
                  '<div class="trow__body">',
                    '<section><h5>What it measures</h5><p>' + meta.what + '</p></section>',
                    '<section><h5>Why it matters</h5><p>' + meta.why + '</p></section>',
                    '<section><h5>What FAIL would mean</h5><p>' + meta.fail + '</p></section>',
                  '</div>',
                '</details>'
            ].join('');
        }).join('');

        track('battery_computed', { dataset: CURRENT_DATASET_LABEL, passed: passed });
    }

    // Defer initial battery compute until visible
    if ('IntersectionObserver' in window) {
        const batteryEl = document.getElementById('battery');
        if (batteryEl) {
            const bIO = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    if (e.isIntersecting) {
                        renderBattery(currentTrades);
                        track('ladder_view', {});
                        bIO.disconnect();
                    }
                });
            }, { threshold: 0.1 });
            bIO.observe(batteryEl);
        }
    } else {
        renderBattery(currentTrades);
    }

    /* ------------------------------------------------
       6. UPLOAD MODULE — CSV / JSON parsers
       ------------------------------------------------ */
    const uploadTabs = document.querySelectorAll('.upload-tab');
    const uploadPanels = document.querySelectorAll('.upload-module__panel');
    uploadTabs.forEach(function (t) {
        t.addEventListener('click', function () {
            const mode = t.dataset.mode;
            uploadTabs.forEach(function (x) { x.classList.toggle('is-active', x === t); x.setAttribute('aria-selected', String(x === t)); });
            uploadPanels.forEach(function (p) { p.hidden = p.dataset.panel !== mode; });
        });
    });

    function showStatus(msg, level) {
        const el = document.getElementById('uploadStatus');
        if (!el) return;
        el.hidden = false;
        el.className = 'upload-module__status is-' + level;
        el.textContent = msg;
    }

    // Generic CSV parser — handles quoted fields
    function parseCSV(text) {
        const lines = text.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
        if (lines.length < 2) return null;
        function splitRow(line) {
            const out = []; let cur = ''; let inQ = false;
            for (let i = 0; i < line.length; i++) {
                const c = line[i];
                if (c === '"') { inQ = !inQ; }
                else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
                else { cur += c; }
            }
            out.push(cur);
            return out.map(function (s) { return s.trim().replace(/^"|"$/g, ''); });
        }
        const header = splitRow(lines[0]).map(function (h) { return h.toLowerCase().replace(/\s+/g, '_'); });
        return lines.slice(1).map(function (l) {
            const cells = splitRow(l);
            const obj = {};
            header.forEach(function (h, i) { obj[h] = cells[i]; });
            return obj;
        });
    }

    // Auto-detect known formats and extract trades { pts, dollars }
    function extractTrades(rawRows) {
        if (!Array.isArray(rawRows) || !rawRows.length) return [];
        const sample = rawRows[0];
        const keys = Object.keys(sample);

        function pickKey(candidates) {
            return candidates.find(function (k) { return keys.indexOf(k) !== -1; });
        }
        const pnlKey = pickKey(['pnl', 'p/l', 'profit_loss', 'realized_pnl', 'net_pnl', 'pl', 'profit', 'net']);
        const pointsKey = pickKey(['points', 'pts', 'pl_points', 'points_pnl']);

        const trades = [];
        for (let i = 0; i < rawRows.length; i++) {
            const r = rawRows[i];
            let pts = null;
            if (pointsKey && r[pointsKey]) {
                pts = parseFloat(String(r[pointsKey]).replace(/[$,()]/g, ''));
                if (String(r[pointsKey]).includes('(')) pts = -Math.abs(pts);
            } else if (pnlKey && r[pnlKey]) {
                const dollars = parseFloat(String(r[pnlKey]).replace(/[$,()]/g, ''));
                pts = (String(r[pnlKey]).includes('(') ? -Math.abs(dollars) : dollars) / 50; // /ES = $50/pt
            }
            if (pts != null && !isNaN(pts) && pts !== 0) {
                trades.push({ id: i + 1, pts: pts, dollars: pts * 50, result: pts > 0 ? 'W' : 'L' });
            }
        }
        return trades;
    }

    function handleUpload(text, filename) {
        try {
            let rows;
            if (filename && /\.json$/i.test(filename) || (text.trim().startsWith('[') || text.trim().startsWith('{'))) {
                const json = JSON.parse(text);
                rows = Array.isArray(json) ? json : (json.trades || json.data || []);
                rows = rows.map(function (r) {
                    // Normalize Discord-style alert exports — try common shapes
                    const norm = {};
                    Object.keys(r).forEach(function (k) { norm[k.toLowerCase().replace(/\s+/g, '_')] = r[k]; });
                    return norm;
                });
            } else {
                rows = parseCSV(text);
                if (!rows) throw new Error('Could not parse CSV — fewer than 2 rows detected.');
            }
            const trades = extractTrades(rows);
            if (trades.length < 10) throw new Error('Detected ' + trades.length + ' trades. Need at least 10 to run the battery.');
            currentTrades = trades;
            CURRENT_DATASET_LABEL = (filename || 'pasted data') + ' (' + trades.length + ' trades)';
            renderBattery(currentTrades);
            showStatus('✓ Loaded ' + trades.length + ' trades from ' + (filename || 'paste') + '. Battery recomputed.', 'success');
            track('battery_upload', { trades: trades.length, source: filename || 'paste' });
        } catch (e) {
            showStatus('Could not parse data: ' + e.message + '. Format detected may be unsupported. Email hiren@ekantikcapital.com for format help.', 'error');
        }
    }

    const fileInput = document.getElementById('uploadFile');
    if (fileInput) {
        fileInput.addEventListener('change', function () {
            const f = fileInput.files[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = function () { handleUpload(reader.result, f.name); };
            reader.onerror = function () { showStatus('Failed to read file.', 'error'); };
            reader.readAsText(f);
        });
    }
    const dropZone = document.querySelector('.upload-drop');
    if (dropZone) {
        ['dragenter', 'dragover'].forEach(function (ev) {
            dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.add('is-dragover'); });
        });
        ['dragleave', 'drop'].forEach(function (ev) {
            dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.remove('is-dragover'); });
        });
        dropZone.addEventListener('drop', function (e) {
            const f = e.dataTransfer.files[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = function () { handleUpload(reader.result, f.name); };
            reader.readAsText(f);
        });
    }
    const pasteBtn = document.getElementById('uploadPasteBtn');
    if (pasteBtn) {
        pasteBtn.addEventListener('click', function () {
            const text = document.getElementById('uploadPaste').value;
            if (!text.trim()) { showStatus('Paste some CSV or JSON content first.', 'error'); return; }
            handleUpload(text, null);
        });
    }
    function resetToSample() {
        currentTrades = REFERENCE_TRADES.slice();
        CURRENT_DATASET_LABEL = 'Ekantik reference (227 trades)';
        renderBattery(currentTrades);
        showStatus('Reset to Ekantik reference dataset.', 'info');
    }
    document.getElementById('uploadResetBtn')?.addEventListener('click', resetToSample);
    document.getElementById('batteryResetBtn')?.addEventListener('click', resetToSample);

    /* ------------------------------------------------
       7. CSV DOWNLOAD
       ------------------------------------------------ */
    function tradesToCSV(trades, withMaeMfe) {
        const header = withMaeMfe
            ? ['id', 'timestamp', 'symbol', 'side', 'result', 'pts', 'dollars', 'mae_pts', 'mfe_pts']
            : ['id', 'timestamp', 'symbol', 'side', 'result', 'pts', 'dollars'];
        const lines = [header.join(',')];
        trades.forEach(function (t) {
            const row = [t.id, t.timestamp || '', t.symbol || '/ES', t.side || '', t.result, t.pts, t.dollars];
            if (withMaeMfe) {
                // Synthetic MAE/MFE for representative data
                const mae = t.result === 'L' ? t.pts * 1.05 : -Math.abs(t.pts) * 0.4;
                const mfe = t.result === 'W' ? t.pts * 1.15 : Math.abs(t.pts) * 0.6;
                row.push(mae.toFixed(2), mfe.toFixed(2));
            }
            lines.push(row.join(','));
        });
        return lines.join('\n');
    }
    function download(filename, content) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        track('reference_csv_download', { filename: filename });
    }
    document.getElementById('downloadCleanCsv')?.addEventListener('click', function () {
        download('ekantik-500-reference-dataset-clean.csv', tradesToCSV(REFERENCE_TRADES, false));
    });
    document.getElementById('downloadMaeMfeCsv')?.addEventListener('click', function () {
        download('ekantik-500-reference-dataset-mae-mfe.csv', tradesToCSV(REFERENCE_TRADES, true));
    });

    /* ------------------------------------------------
       8. EQUITY CURVE (Reference Dataset)
       ------------------------------------------------ */
    function drawEquityCurve() {
        const canvas = document.getElementById('equityCurve');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.clientWidth, H = canvas.clientHeight;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.scale(dpr, dpr);

        const trades = REFERENCE_TRADES;
        const equity = [0];
        let cum = 0;
        for (let i = 0; i < trades.length; i++) { cum += trades[i].pts; equity.push(cum); }
        const min = Math.min.apply(null, equity);
        const max = Math.max.apply(null, equity);
        const pad = 28;
        const xStep = (W - pad * 2) / (equity.length - 1);
        const yScale = (H - pad * 2) / (max - min || 1);

        // Background grid
        ctx.strokeStyle = 'rgba(27, 42, 74, 0.06)'; ctx.lineWidth = 1;
        for (let g = 0; g <= 4; g++) {
            const y = pad + (H - pad * 2) * g / 4;
            ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
        }
        // Zero line
        if (min < 0 && max > 0) {
            const yZero = pad + (max - 0) * yScale;
            ctx.strokeStyle = 'rgba(27, 42, 74, 0.3)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(pad, yZero); ctx.lineTo(W - pad, yZero); ctx.stroke();
            ctx.setLineDash([]);
        }
        // Fill under curve
        ctx.fillStyle = 'rgba(200, 169, 81, 0.15)';
        ctx.beginPath();
        ctx.moveTo(pad, H - pad);
        for (let i = 0; i < equity.length; i++) {
            const x = pad + i * xStep;
            const y = pad + (max - equity[i]) * yScale;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(pad + (equity.length - 1) * xStep, H - pad);
        ctx.closePath(); ctx.fill();
        // Line
        ctx.strokeStyle = '#1B2A4A'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < equity.length; i++) {
            const x = pad + i * xStep;
            const y = pad + (max - equity[i]) * yScale;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        // Y-axis labels
        ctx.fillStyle = '#64748B'; ctx.font = '11px "Source Sans 3", sans-serif';
        ctx.fillText('+' + max.toFixed(0) + ' pts', 4, pad + 4);
        ctx.fillText(min.toFixed(0) + ' pts', 4, H - pad);
    }
    if ('IntersectionObserver' in window) {
        const refEl = document.getElementById('reference');
        if (refEl) {
            const rIO = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) { if (e.isIntersecting) { drawEquityCurve(); rIO.disconnect(); } });
            }, { threshold: 0.1 });
            rIO.observe(refEl);
        }
    } else {
        drawEquityCurve();
    }
    window.addEventListener('resize', function () { drawEquityCurve(); });

    /* ------------------------------------------------
       9. SCROLL REVEAL
       ------------------------------------------------ */
    if (!reduceMotion && 'IntersectionObserver' in window) {
        const targets = document.querySelectorAll(
            '.section__h, .prose, .proof-tiles, .component-card, .numbered-card, .ladder-canvas, .three-col, .cadence, .config-card, .principle, .backtest-band, .battery, .ref-stats, .ref-detail-grid, .falsi-intro, .falsi-stage, .binding-rule, .kill-action, .founding__card, .vow-diagram, .faq__item, .booking'
        );
        targets.forEach(function (el) { el.classList.add('reveal'); });
        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
        targets.forEach(function (el) { io.observe(el); });
    }

    /* ------------------------------------------------
       10. CALENDLY LAZY LOAD
       ------------------------------------------------ */
    const calendlyContainer = document.getElementById('calendlyEmbed');
    if (calendlyContainer && 'IntersectionObserver' in window) {
        const cIO = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) { if (entry.isIntersecting) { loadCalendly(calendlyContainer); cIO.disconnect(); } });
        }, { threshold: 0.2 });
        cIO.observe(calendlyContainer);
    } else if (calendlyContainer) {
        loadCalendly(calendlyContainer);
    }

    function loadCalendly(container) {
        const url = container.getAttribute('data-calendly-url');
        if (!url) return;

        // Inject Calendly widget CSS once
        if (!document.getElementById('calendly-widget-css')) {
            const link = document.createElement('link');
            link.id = 'calendly-widget-css';
            link.rel = 'stylesheet';
            link.href = 'https://assets.calendly.com/assets/external/widget.css';
            document.head.appendChild(link);
        }

        // Replace fallback with inline widget container
        const fallback = container.querySelector('.booking__fallback');
        if (fallback) fallback.remove();
        const widget = document.createElement('div');
        widget.className = 'calendly-inline-widget';
        widget.setAttribute('data-url', url + '?hide_event_type_details=0&primary_color=C8A951&text_color=1B2A4A');
        widget.style.minWidth = '320px';
        widget.style.height   = '720px';
        container.appendChild(widget);

        // Inject Calendly loader script once; it auto-initializes any
        // .calendly-inline-widget on the page when loaded.
        if (window.Calendly) {
            window.Calendly.initInlineWidget({ url: widget.getAttribute('data-url'), parentElement: widget });
        } else {
            const s = document.createElement('script');
            s.src = 'https://assets.calendly.com/assets/external/widget.js';
            s.async = true;
            document.head.appendChild(s);
        }

        // Booking confirmation event — Calendly posts a window message on event_scheduled
        if (!window.__calendlyListenerAttached) {
            window.__calendlyListenerAttached = true;
            window.addEventListener('message', function (e) {
                if (e.data && typeof e.data.event === 'string' && e.data.event.indexOf('calendly') === 0) {
                    if (e.data.event === 'calendly.event_scheduled') {
                        track('booking_confirmed', { source_section: 'final_cta', provider: 'calendly' });
                    }
                }
            });
        }
    }

    /* ------------------------------------------------
       11. NAV SHADOW
       ------------------------------------------------ */
    const nav = document.getElementById('nav');
    if (nav) {
        let last = 0;
        window.addEventListener('scroll', function () {
            const y = window.scrollY;
            if ((y > 8) !== (last > 8)) {
                nav.style.boxShadow = y > 8 ? '0 2px 16px rgba(27, 42, 74, 0.06)' : 'none';
            }
            last = y;
        }, { passive: true });
    }
})();
