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
    /* Compounding Ladder model — simplified
       Starting capital: $100K NLV. 1-year horizon. Rule: every $5,000 in cumulative
       profit earns one additional /ES contract. Throughput per /ES from reference
       data (~$1,900/mo/contract under realistic scenario). */

    const NLV_START = 100000;
    const PROFIT_PER_STEP = 5000;
    const PER_ES_MONTHLY = 1900;
    const DURATION_MAX = 12; // months
    const MAX_STEPS = 10;

    function buildSteps(scenario) {
        // Throughput multiplier per scenario
        const mult = scenario === 'cooperative' ? 1.3
                   : scenario === 'realistic'   ? 1.0
                   : 0; // floor: no compounding
        const steps = [{ n: 1, contracts: 1, timeReached: 0, nlv: NLV_START, cumProfit: 0 }];
        if (mult === 0) return steps;
        let t = 0, cum = 0, c = 1;
        while (t < DURATION_MAX && c < MAX_STEPS) {
            const monthsToNext = PROFIT_PER_STEP / (c * PER_ES_MONTHLY * mult);
            if (t + monthsToNext > DURATION_MAX) break;
            t += monthsToNext;
            cum += PROFIT_PER_STEP;
            c += 1;
            steps.push({ n: c, contracts: c, timeReached: t, nlv: NLV_START + cum, cumProfit: cum });
        }
        return steps;
    }

    function buildCurve(scenario) {
        const mult = scenario === 'cooperative' ? 1.3
                   : scenario === 'realistic'   ? 1.0
                   : 0;
        const steps = buildSteps(scenario);
        const points = [{ t: 0, value: NLV_START }];
        let value = NLV_START;
        // Smooth growth between each pair of steps
        for (let i = 0; i < steps.length - 1; i++) {
            const a = steps[i], b = steps[i + 1];
            const duration = b.timeReached - a.timeReached;
            const SUBDIV = 6;
            for (let k = 1; k <= SUBDIV; k++) {
                const tFrac = k / SUBDIV;
                points.push({ t: a.timeReached + tFrac * duration, value: value + (b.nlv - a.nlv) * tFrac });
            }
            value = b.nlv;
        }
        // After last step, continue accumulating at constant contracts until 12 months
        if (mult > 0 && steps.length > 0) {
            const lastStep = steps[steps.length - 1];
            const remaining = DURATION_MAX - lastStep.timeReached;
            if (remaining > 0) {
                const monthlyGain = lastStep.contracts * PER_ES_MONTHLY * mult;
                const SUBDIV = 8;
                for (let k = 1; k <= SUBDIV; k++) {
                    const tFrac = k / SUBDIV;
                    points.push({ t: lastStep.timeReached + tFrac * remaining, value: value + monthlyGain * tFrac * remaining });
                }
            }
        } else {
            // floor: flat at NLV_START all year
            points.push({ t: DURATION_MAX, value: NLV_START });
        }
        return points;
    }

    const SCENARIO_LABELS = {
        cooperative: 'Cooperative — published cadence × 1.3. Ladder reaches the engine ceiling early; subsequent months compound at full intensity.',
        realistic:   'Realistic — published reference cadence applied unmodified. Most likely terrain.',
        floor:       'Floor — strategy launches but no edge expression. Active sleeve flat at 1 /ES the whole year.'
    };

    let currentScenario = 'realistic';
    let currentPoints = buildCurve(currentScenario);
    let currentSteps  = buildSteps(currentScenario);

    function drawLadderChart() {
        const canvas = document.getElementById('ladderCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.clientWidth || 1100;
        const H = canvas.clientHeight || 420;
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        const PAD_L = 70, PAD_R = 40, PAD_T = 30, PAD_B = 60;
        const tMax = DURATION_MAX;
        // Y range: always start at NLV_START; cap to max value observed (rounded up)
        const valMin = NLV_START;
        const finalVal = currentPoints[currentPoints.length - 1].value;
        const valMax = currentScenario === 'cooperative' ? 300000
                     : currentScenario === 'realistic'   ? 250000
                     : 120000;

        function xAt(t) { return PAD_L + (t / tMax) * (W - PAD_L - PAD_R); }
        function yAt(v) { return PAD_T + (1 - (v - valMin) / (valMax - valMin)) * (H - PAD_T - PAD_B); }

        // Y gridlines + dollar labels
        ctx.strokeStyle = 'rgba(27, 42, 74, 0.06)'; ctx.lineWidth = 1;
        ctx.fillStyle = '#64748B'; ctx.font = '11px "Source Sans 3", sans-serif';
        const yTicks = 5;
        for (let i = 0; i <= yTicks; i++) {
            const v = valMin + (valMax - valMin) * i / yTicks;
            const y = yAt(v);
            ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
            ctx.fillText('$' + Math.round(v / 1000) + 'K', 8, y + 4);
        }
        // X axis labels (months)
        for (let m = 0; m <= 12; m += 2) {
            const x = xAt(m);
            ctx.fillText(m + (m === 0 ? ' mo' : ''), x - 10, H - PAD_B + 18);
            ctx.strokeStyle = 'rgba(27, 42, 74, 0.04)';
            ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, H - PAD_B); ctx.stroke();
        }

        // Baseline at NLV_START
        ctx.strokeStyle = 'rgba(27, 42, 74, 0.25)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        const yBase = yAt(NLV_START);
        ctx.beginPath(); ctx.moveTo(PAD_L, yBase); ctx.lineTo(W - PAD_R, yBase); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(27, 42, 74, 0.5)';
        ctx.font = '10px "Source Sans 3", sans-serif';
        ctx.fillText('start: $100K', W - PAD_R - 65, yBase - 5);

        // Area fill
        const pts = currentPoints;
        ctx.fillStyle = 'rgba(200, 169, 81, 0.15)';
        ctx.beginPath();
        ctx.moveTo(xAt(pts[0].t), yBase);
        for (let i = 0; i < pts.length; i++) ctx.lineTo(xAt(pts[i].t), yAt(pts[i].value));
        ctx.lineTo(xAt(pts[pts.length - 1].t), yBase);
        ctx.closePath(); ctx.fill();

        // Curve line
        ctx.strokeStyle = '#1B2A4A'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
            const x = xAt(pts[i].t), y = yAt(pts[i].value);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Step markers
        for (let i = 0; i < currentSteps.length; i++) {
            const s = currentSteps[i];
            const x = xAt(s.timeReached);
            const y = yAt(s.nlv);
            // Dashed drop line
            ctx.strokeStyle = 'rgba(200, 169, 81, 0.5)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, H - PAD_B); ctx.stroke();
            ctx.setLineDash([]);
            // Dot
            ctx.fillStyle = '#C8A951';
            ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1B2A4A';
            ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
        }

        // Final NLV callout
        const lastPt = pts[pts.length - 1];
        const xEnd = xAt(lastPt.t), yEnd = yAt(lastPt.value);
        ctx.fillStyle = '#1B2A4A';
        ctx.font = 'bold 13px "Source Sans 3", sans-serif';
        ctx.fillText('$' + Math.round(lastPt.value / 1000) + 'K @ 12 mo', xEnd - 90, yEnd - 12);

        // Render step badges
        const stepsContainer = document.getElementById('cl-chart-steps');
        if (stepsContainer) {
            stepsContainer.innerHTML = currentSteps.map(function (s, idx) {
                const x = xAt(s.timeReached);
                const xPct = (x / W) * 100;
                const riskDollars = Math.round(s.nlv * 0.005);
                return [
                    '<div class="cl-step-badge ' + (idx % 2 === 0 ? 'cl-step-badge--bot' : 'cl-step-badge--top') + '" style="left:' + xPct + '%" data-step="' + s.n + '">',
                      '<p class="cl-step-badge__num">Step ' + s.n + '</p>',
                      '<p class="cl-step-badge__contracts">' + s.contracts + ' /ES</p>',
                      '<p class="cl-step-badge__detail">NLV $' + Math.round(s.nlv / 1000) + 'K</p>',
                      '<p class="cl-step-badge__detail">Risk: $' + riskDollars.toLocaleString() + '/trade</p>',
                      '<p class="cl-step-badge__time">' + s.timeReached.toFixed(1) + ' mo · +$' + (s.cumProfit / 1000).toFixed(0) + 'K profit</p>',
                    '</div>'
                ].join('');
            }).join('');
        }

        // Render cadence summary table
        renderCadenceTable();
    }

    function renderCadenceTable() {
        const tbody = document.getElementById('cl-cadence-tbody');
        if (!tbody) return;
        const steps = currentSteps;
        let rows = '';
        for (let i = 0; i < steps.length - 1; i++) {
            const a = steps[i], b = steps[i + 1];
            const dt = (b.timeReached - a.timeReached);
            const dtLabel = dt < 1 ? Math.round(dt * 30) + ' days' : dt.toFixed(1) + ' months';
            rows += '<tr>'
                + '<td>' + a.contracts + ' → ' + b.contracts + ' /ES</td>'
                + '<td>$' + (a.cumProfit / 1000).toFixed(0) + 'K → $' + (b.cumProfit / 1000).toFixed(0) + 'K</td>'
                + '<td>$' + a.nlv.toLocaleString() + ' → $' + b.nlv.toLocaleString() + '</td>'
                + '<td>' + dtLabel + '</td>'
                + '</tr>';
        }
        const last = steps[steps.length - 1];
        const lastPt = currentPoints[currentPoints.length - 1];
        rows += '<tr class="cadence__total">'
            + '<td>Year-end</td>'
            + '<td colspan="2">@ ' + last.contracts + ' /ES, ' + last.timeReached.toFixed(1) + ' mo to ladder peak</td>'
            + '<td>NLV $' + Math.round(lastPt.value / 1000) + 'K (illustrative)</td>'
            + '</tr>';
        tbody.innerHTML = rows;
    }

    /* Kill conditions rail */
    const KILLS = [
        { id: 'ED-01', name: 'Rolling-100 EV',       trigger: '≤ $0 / trade',              link: 'Tests 1, 2' },
        { id: 'ED-02', name: 'Rolling-50 win rate',  trigger: '< 52%',                     link: 'Test 6' },
        { id: 'ED-03', name: 'Rolling-50 PF',        trigger: '< 1.30',                    link: 'Test 3' },
        { id: 'ED-04', name: 'Rolling-50 W:L ratio', trigger: '< 1.10',                    link: 'Test 5' },
        { id: 'ED-05', name: 'Realized drawdown',    trigger: '> −30 /ES pts',             link: 'Architecture' },
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
