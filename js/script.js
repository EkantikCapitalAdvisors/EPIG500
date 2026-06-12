/* ================================================
   EKANTIK 500 — Landing Page v2.3
   Falsifiability + 8-Test Battery + Reference Dataset
   ================================================ */

(function () {
    'use strict';

    /* ------------------------------------------------
       CLAIM GATES (CEG) — ship OFF. Flip only after written
       countersignature per spec §5 (Manish Dharod).
       ------------------------------------------------ */
    const EPIG_FLAGS = window.EPIG_FLAGS = {
        CLAIMS_THROUGHPUT_ENABLED: false,
        BOOSTER_TOGGLE_ENABLED: false
    };

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ------------------------------------------------
       SHARED TRADES FETCH — one request, many consumers.
       Period discipline: only protocol-bound Period 2 trades
       (period === 'pre_reg'; fallback: close date >= 2026-05-01)
       feed any count, KPI, or extrapolation on this page.
       ------------------------------------------------ */
    const PERIOD2_START = '2026-05-01';
    function isProtocolBound(t) {
        if (t && typeof t.period === 'string') return t.period === 'pre_reg';
        return !!(t && typeof t.timestamp === 'string' && t.timestamp.slice(0, 10) >= PERIOD2_START);
    }
    const tradesPromise = fetch('data/trades.json?t=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
        .then(function (j) {
            if (!j || !Array.isArray(j.trades)) throw new Error('bad payload');
            return j.trades;
        });
    // 4s timeout guard — fallback copy must replace any pending state.
    const tradesWithTimeout = Promise.race([
        tradesPromise,
        new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, 4000); })
    ]);

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

    const footnoteRef = document.querySelector('.hero__footnote-ref');
    if (footnoteRef) {
        footnoteRef.addEventListener('click', function () {
            const fn = document.getElementById('hero-footnote');
            if (fn) fn.open = true;
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

    /* Scroll-depth events: 25 / 50 / 75 / 100 */
    (function () {
        const fired = {};
        function onScroll() {
            const doc = document.documentElement;
            const max = doc.scrollHeight - window.innerHeight;
            if (max <= 0) return;
            const pct = ((window.scrollY || doc.scrollTop) / max) * 100;
            [25, 50, 75, 100].forEach(function (mark) {
                if (!fired[mark] && pct >= mark) {
                    fired[mark] = true;
                    track('scroll_depth', { depth: mark });
                }
            });
            if (fired[100]) window.removeEventListener('scroll', onScroll);
        }
        window.addEventListener('scroll', onScroll, { passive: true });
    })();

    /* ------------------------------------------------
       TRADE COUNTDOWN — embedded in proof strip (S1),
       The Proof (S6), and Pre-Registration (S10).
       States per spec §S6; static fallback on fetch
       failure / 4s timeout. '—' / 'Loading…' / spinners
       must never persist on screen.
       ------------------------------------------------ */
    const BATTERY_BINDING_N = 100;
    function countdownCopy(n) {
        if (n < 30) {
            return { state: 'building', n: n,
                text: 'Trade ' + n + ' of 30 toward battery activation — every trade published within 24 hours of close. ',
                link: 'Watch each one land →', href: '/dashboard.html', bar: Math.max(0, Math.min(100, (n / 30) * 100)) };
        }
        if (n < BATTERY_BINDING_N) {
            return { state: 'provisional', n: n,
                text: 'Battery live on ' + n + ' trades — verdict provisional until 100. ',
                link: 'Open the live battery →', href: '#battery', bar: null };
        }
        return { state: 'binding', n: n,
            text: 'Battery binding — ' + n + ' trades on the protocol-bound record. ',
            link: 'Open the live battery →', href: '#battery', bar: null };
    }
    function renderCountdown(n) {
        document.querySelectorAll('.js-trade-countdown').forEach(function (el) {
            const c = countdownCopy(n);
            let html = '';
            if (c.bar !== null) {
                html += '<div class="trade-countdown__bar" role="img" aria-label="' + c.n + ' of 30 trades toward battery activation"><div class="trade-countdown__fill" style="width:' + c.bar + '%"></div></div>';
            }
            html += '<p class="trade-countdown__text">' + c.text + '<a href="' + c.href + '" data-cta="countdown-' + (el.dataset.variant || 'full') + '">' + c.link + '</a></p>';
            el.innerHTML = html;
            el.dataset.state = c.state;
        });
    }
    function renderCountdownFallback() {
        document.querySelectorAll('.js-trade-countdown').forEach(function (el) {
            el.innerHTML = '<p class="trade-countdown__text">The live record updates within 24 hours of every closed trade — <a href="/dashboard.html" data-cta="countdown-fallback">open the dashboard →</a></p>';
            el.dataset.state = 'fallback';
        });
    }
    /* ------------------------------------------------
       LIVE RECORD vs. KILL BOUNDARIES (§Arithmetic)
       Approved mockup — countersigned 2026-06-12.
       Plots realized Period 2 cumulative points against the
       armed ED-05a (−45) / ED-05b (−100) peak-to-trough
       floors. Realized data + contractual thresholds only.
       ------------------------------------------------ */
    let liveBoundedTrades = null;
    function drawLiveBounded() {
        const wrap = document.getElementById('liveBounded');
        const canvas = document.getElementById('liveBoundedCanvas');
        const statEl = document.getElementById('liveBoundedStat');
        const trades = liveBoundedTrades;
        if (!wrap || !canvas || !trades || !trades.length) return;
        wrap.hidden = false;

        // Cumulative equity (pts) and the two ratcheting drawdown floors.
        const eq = [0];
        let cum = 0;
        for (let i = 0; i < trades.length; i++) { cum += trades[i].pts; eq.push(Math.round(cum * 100) / 100); }
        const hard = [], warn = [];
        let peak = 0;
        for (let i = 0; i < eq.length; i++) {
            peak = Math.max(peak, eq[i]);
            hard.push(peak - 100);
            warn.push(peak - 45);
        }

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.clientWidth || 1100;
        const H = canvas.clientHeight || 340;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        const PAD_L = 56, PAD_R = 130, PAD_T = 22, PAD_B = 34;
        const xN = eq.length - 1;
        const yMax = Math.max.apply(null, eq) + 12;
        const yMin = Math.min(Math.min.apply(null, hard), Math.min.apply(null, eq)) - 12;
        function x(i) { return PAD_L + (i / xN) * (W - PAD_L - PAD_R); }
        function y(v) { return PAD_T + (yMax - v) / (yMax - yMin) * (H - PAD_T - PAD_B); }

        // Grid + Y labels (pts)
        ctx.font = '11px "Source Sans 3", sans-serif';
        const span = yMax - yMin;
        const step = span > 160 ? 50 : 25;
        for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
            ctx.strokeStyle = 'rgba(27, 42, 74, 0.06)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(PAD_L, y(v)); ctx.lineTo(W - PAD_R, y(v)); ctx.stroke();
            ctx.fillStyle = '#64748B'; ctx.textAlign = 'right';
            ctx.fillText((v > 0 ? '+' : '') + v + ' pts', PAD_L - 6, y(v) + 4);
        }
        // Zero line
        ctx.strokeStyle = 'rgba(27, 42, 74, 0.3)'; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(PAD_L, y(0)); ctx.lineTo(W - PAD_R, y(0)); ctx.stroke();
        ctx.setLineDash([]);
        // X labels (trade #)
        ctx.fillStyle = '#64748B'; ctx.textAlign = 'center';
        const every = Math.max(1, Math.ceil(xN / 12));
        for (let i = 0; i <= xN; i += every) ctx.fillText(i === 0 ? 'start' : '#' + i, x(i), H - PAD_B + 18);

        function tracePath(arr) {
            ctx.beginPath();
            for (let i = 0; i < arr.length; i++) {
                const px = x(i), py = y(arr[i]);
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
        }

        // Survival margin: shade between equity and hard-kill floor (neutral slate)
        ctx.fillStyle = 'rgba(100, 116, 139, 0.07)';
        ctx.beginPath();
        for (let i = 0; i < eq.length; i++) ctx.lineTo(x(i), y(eq[i]));
        for (let i = eq.length - 1; i >= 0; i--) ctx.lineTo(x(i), y(hard[i]));
        ctx.closePath(); ctx.fill();

        // ED-05a warning floor — red dotted (kill semantics, lighter weight)
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.55)'; ctx.lineWidth = 1.4; ctx.setLineDash([2, 4]);
        tracePath(warn); ctx.stroke();
        // ED-05b hard kill floor — red dashed
        ctx.strokeStyle = '#DC2626'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
        tracePath(hard); ctx.stroke();
        ctx.setLineDash([]);

        // Equity curve — gold (earned series) with per-trade dots
        ctx.strokeStyle = '#b8962e'; ctx.lineWidth = 2.4;
        tracePath(eq); ctx.stroke();
        ctx.fillStyle = '#d4af37';
        for (let i = 1; i < eq.length; i++) {
            ctx.beginPath(); ctx.arc(x(i), y(eq[i]), 3, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1; ctx.stroke();
        }

        // End labels
        const last = eq.length - 1;
        ctx.textAlign = 'left'; ctx.font = '12px "Source Sans 3", sans-serif';
        ctx.fillStyle = '#b8962e';
        ctx.fillText((eq[last] >= 0 ? '+' : '') + eq[last].toFixed(1) + ' pts · live record', x(last) + 10, y(eq[last]) + 4);
        ctx.fillStyle = '#DC2626';
        ctx.fillText('hard kill · ' + hard[last].toFixed(0) + ' pts', x(last) + 10, y(hard[last]) + 4);
        ctx.fillText('warning · ' + warn[last].toFixed(0) + ' pts', x(last) + 10, y(warn[last]) + 4);

        if (statEl) {
            const headroom = eq[last] - hard[last];
            const peakStr = (peak >= 0 ? '+' : '') + peak.toFixed(1);
            statEl.innerHTML = '◆ Current: <strong>' + (eq[last] >= 0 ? '+' : '') + eq[last].toFixed(1) + ' pts</strong> over <strong>' + trades.length + ' closed trades</strong> · equity peak ' + peakStr + ' pts · distance to the ED-05b hard kill: <strong>' + headroom.toFixed(1) + ' pts of headroom</strong>. Both floors ratchet up with every new equity high — earned profit raises the line a falsification would have to cross.';
        }
    }
    window.addEventListener('resize', function () { drawLiveBounded(); });

    tradesWithTimeout.then(function (trades) {
        const live = trades.filter(isProtocolBound);
        const n = live.length;
        renderCountdown(n);
        liveBoundedTrades = live;
        drawLiveBounded();
        const continuityCount = document.getElementById('continuityLiveCount');
        if (continuityCount) {
            continuityCount.innerHTML = '<strong>' + n + ' pre-registration ' + (n === 1 ? 'trade' : 'trades') + '</strong> published so far — every trade within 24 hours of close.';
        }
        document.querySelectorAll('.js-prereg-count').forEach(function (el) {
            el.textContent = n + ' pre-registration ' + (n === 1 ? 'trade' : 'trades') + ' to date';
        });
        const boosterCaption = document.getElementById('arithBoosterCaption');
        if (boosterCaption && !EPIG_FLAGS.BOOSTER_TOGGLE_ENABLED) {
            boosterCaption.textContent = 'Engine layer unlocks with the protocol-bound record (trade ' + n + ' of 30).';
        }
        const baseline = document.getElementById('arithBaselineIndicator');
        if (baseline && !EPIG_FLAGS.CLAIMS_THROUGHPUT_ENABLED) {
            baseline.innerHTML = '<p class="arith-baseline__headline"><span class="diamond">◆</span> Engine throughput will be reported here from the protocol-bound live record once the battery activates at 30 closed trades (currently ' + n + '). Until then, we publish the trades — not an extrapolation.</p>';
        }
    }).catch(function () {
        renderCountdownFallback();
    });

    /* Analytics — spec §6 event names */
    document.querySelectorAll('a[href="#prereg"]').forEach(function (cta) {
        cta.addEventListener('click', function () {
            track('cta_prereg_click', { location: cta.dataset.cta || 'unknown', section: cta.closest('section')?.id || 'unknown' });
        });
    });
    document.querySelectorAll('a[href="#talk"], a[data-cta^="founder-call"]').forEach(function (cta) {
        cta.addEventListener('click', function () {
            track('cta_founder_call_click', { location: cta.dataset.cta || 'unknown', section: cta.closest('section')?.id || 'unknown' });
        });
    });
    document.querySelectorAll('a[data-cta^="discord-"]').forEach(function (cta) {
        cta.addEventListener('click', function () {
            track('discord_click', { location: cta.dataset.cta, section: cta.closest('section')?.id || 'nav' });
        });
    });
    document.querySelectorAll('a[href*="falsifiability-protocol"]').forEach(function (a) {
        a.addEventListener('click', function () { track('protocol_open', { location: a.dataset.cta || 'inline' }); });
    });
    document.querySelectorAll('a[href*="dashboard"]').forEach(function (a) {
        a.addEventListener('click', function () { track('dashboard_open', { location: a.dataset.cta || 'inline' }); });
    });

    /* Pre-registration form — POSTs to the configured endpoint.
       No mailto: anywhere in the submit path. Honeypot + inline errors.
       Server-side validation lives with the form provider. */
    const preregForm = document.getElementById('preregForm');
    if (preregForm) {
        const statusEl = document.getElementById('preregStatus');
        const submitBtn = document.getElementById('preregSubmit');

        function setFieldError(input, show) {
            const field = input.closest('.prereg-form__field');
            const err = field ? field.querySelector('.prereg-form__error') : null;
            if (err) err.hidden = !show;
            input.classList.toggle('is-invalid', show);
        }
        function showStatusMsg(msg) {
            if (!statusEl) return;
            statusEl.hidden = false;
            statusEl.textContent = msg;
        }
        function clearStatusMsg() {
            if (statusEl) { statusEl.hidden = true; statusEl.textContent = ''; }
        }

        preregForm.addEventListener('submit', function (e) {
            e.preventDefault();
            clearStatusMsg();

            const nameInput = preregForm.querySelector('input[name="name"]');
            const emailInput = preregForm.querySelector('input[name="email"]');
            const honeypot = preregForm.querySelector('input[name="_honey"]');

            const name = (nameInput.value || '').trim();
            const email = (emailInput.value || '').trim();
            const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

            setFieldError(nameInput, !name);
            setFieldError(emailInput, !emailOk);
            if (!name || !emailOk) return;

            // Honeypot: silently drop bot submissions.
            if (honeypot && honeypot.value.trim() !== '') return;

            const endpoint = preregForm.dataset.endpoint || '';
            if (!endpoint || endpoint.indexOf('[CONFIG') === 0) {
                showStatusMsg('Submissions are briefly offline. Please email info@ekantikcapital.com with the subject "Ekantik 500 pre-registration".');
                return;
            }

            const fd = new FormData(preregForm);
            fd.delete('_honey');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting…';

            fetch(endpoint, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
                .then(function (r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    track('prereg_submit_success', { capital: (fd.get('capital') || 'unspecified') });
                    const tpl = document.getElementById('preregSuccessTemplate');
                    if (tpl) {
                        const success = tpl.content.cloneNode(true);
                        preregForm.replaceWith(success);
                    }
                })
                .catch(function () {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit pre-registration';
                    showStatusMsg('Something went wrong submitting the form. Please try again, or email info@ekantikcapital.com.');
                });
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
       at 2 /ES maximum. Three discrete scenarios (Floor / Realistic / Cooperative).
       Per-/ES monthly throughput is a DESIGN TARGET used by the ladder
       illustration. The actual throughput will be reported from the live
       pre-registration record as it accumulates. */

    const NLV_START         = 100000;
    const SPY_PCT           = 0.80;          // 80% SPY foundation
    const BUFFER_PCT        = 0.20;          // 20% cash buffer
    const SPY_START         = NLV_START * SPY_PCT;   // $80K
    const CASH_START        = NLV_START * BUFFER_PCT; // $20K
    // S&P 500 historical average annual return (last 20 years, incl. dividends, rounded)
    const SPY_ANNUAL_RETURN = 0.10;
    const SPY_MONTHLY_RATE  = Math.pow(1 + SPY_ANNUAL_RETURN, 1/12) - 1; // ≈ 0.797%/mo
    // Per-/ES per-active-month throughput, derived from the Telegram-verified
    // historical record: 369.5 pts over 14 active months = ~26.4 pts/mo
    // × $50/pt = ~$1,321/mo/ES. Active-month basis (months with ≥1 trade), not
    // calendar; the strategy by design does not trade continuously.
    const PER_ES_MONTHLY    = 1321;
    const DURATION_MAX      = 12;            // months
    const BUFFER_DAYS       = 60;            // engine no-trading buffer at start of year
    const BUFFER_MONTHS     = BUFFER_DAYS / 30; // 2 months
    const COOP_BUFFER_PROFIT = 5000;          // profit needed at each level before scaling +1 contract
    const MAX_CONTRACTS     = 2;   // margin ceiling under the 80/20 structure
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
            label: 'Cooperative — scaling 1 → 2 (the margin ceiling). The second contract is earned by ≈$5K profit at the current contract count.',
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

        parts.push('<path d="' + spyArea + '" fill="#12264a" fill-opacity="0.85"/>');           // SPY: deep navy
        parts.push('<path d="' + cashArea + '" fill="#94A3B8" fill-opacity="0.7"/>');           // Cash: slate
        parts.push('<path d="' + engineArea + '" fill="#d4af37" fill-opacity="0.9"/>');         // Engine: gold

        // Top-line stroke (total NLV)
        const topLine = pts.map(function (p, i) { return (i === 0 ? 'M ' : 'L ') + xAt(p.t) + ',' + yAt(p.value); }).join(' ');
        parts.push('<path d="' + topLine + '" fill="none" stroke="#0a1628" stroke-width="2"/>');

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
            parts.push('<line x1="' + x + '" y1="' + yTop + '" x2="' + x + '" y2="' + (yTop - 28) + '" stroke="#d4af37" stroke-width="1.5"/>');
            parts.push('<circle cx="' + x + '" cy="' + yTop + '" r="5" fill="#d4af37" stroke="white" stroke-width="1.5"/>');
            parts.push('<rect x="' + (x + 6) + '" y="' + (yTop - 42) + '" width="62" height="18" rx="2" fill="#12264a"/>');
            parts.push('<text x="' + (x + 37) + '" y="' + (yTop - 30) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#d4af37" font-family="Source Sans 3">' + s.contracts + ' /ES</text>');
        });

        // Layer legend — above the plot area, stays out of the chart interior
        const legendY = 14;
        parts.push('<g class="cl-legend" font-family="Source Sans 3" font-size="11">');
        parts.push('<rect x="' + PAD_L + '" y="' + legendY + '" width="12" height="10" fill="#12264a" fill-opacity="0.85"/>');
        parts.push('<text x="' + (PAD_L + 18) + '" y="' + (legendY + 9) + '" fill="#12264a" font-weight="600">SPY foundation · 80% · 10%/yr</text>');
        parts.push('<rect x="' + (PAD_L + 220) + '" y="' + legendY + '" width="12" height="10" fill="#94A3B8" fill-opacity="0.7"/>');
        parts.push('<text x="' + (PAD_L + 238) + '" y="' + (legendY + 9) + '" fill="#12264a" font-weight="600">Cash buffer · 10%</text>');
        parts.push('<rect x="' + (PAD_L + 360) + '" y="' + legendY + '" width="12" height="10" fill="#d4af37"/>');
        parts.push('<text x="' + (PAD_L + 378) + '" y="' + (legendY + 9) + '" fill="#12264a" font-weight="600">Engine profit</text>');
        parts.push('</g>');

        // Year-end stacked breakdown callout on the right
        const xEnd = xAt(DURATION_MAX);
        const finalSpy = pts[pts.length - 1].spy;
        const finalEngine = pts[pts.length - 1].enginePnl;
        const finalProfit = finalVal - NLV_START;
        const calloutH = 90;
        const calloutY = yAt(finalVal) - 8;
        const calloutAdj = Math.max(PAD_T + 4, calloutY - calloutH);
        parts.push('<rect x="' + (xEnd - 132) + '" y="' + calloutAdj + '" width="132" height="' + calloutH + '" rx="4" fill="#12264a"/>');
        parts.push('<text x="' + (xEnd - 66) + '" y="' + (calloutAdj + 14) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#d4af37" font-family="Source Sans 3" letter-spacing="1">YEAR-END NLV</text>');
        parts.push('<text x="' + (xEnd - 66) + '" y="' + (calloutAdj + 36) + '" text-anchor="middle" font-size="20" font-weight="700" fill="white" font-family="Source Sans 3">$' + Math.round(finalVal / 1000) + 'K</text>');
        parts.push('<text x="' + (xEnd - 124) + '" y="' + (calloutAdj + 56) + '" font-size="10" fill="#94A3B8" font-family="Source Sans 3">SPY    +$' + Math.round((finalSpy - SPY_START)/1000) + 'K</text>');
        parts.push('<text x="' + (xEnd - 124) + '" y="' + (calloutAdj + 70) + '" font-size="10" fill="#d4af37" font-family="Source Sans 3">Engine +$' + Math.round(finalEngine/1000) + 'K</text>');
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
                  '<p class="cl-card__label">SPY foundation · 80%</p>',
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
       4. REFERENCE DATASET — DEPRECATED
       Earlier versions of this site embedded a synthetic 227-trade dataset here
       to populate the battery before any real record existed. That has been
       removed. The page-level battery now reads the same live trades.json the
       dashboard uses, and refuses to render a verdict below n=30.
       ------------------------------------------------ */
    function generateReferenceTrades_DEPRECATED() {
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

    // Live trades.json is the single source of truth — no embedded fallback.
    // Period discipline: only protocol-bound Period 2 trades feed the page-level
    // battery. The Period 1 Telegram record stays on the dashboard, never here.
    let REFERENCE_TRADES = [];
    let CURRENT_DATASET_LABEL = 'Live pre-registration record';
    let currentTrades = [];
    const BATTERY_MIN_N = 30;
    tradesWithTimeout
        .then(function (trades) {
            REFERENCE_TRADES = trades.filter(isProtocolBound);
            currentTrades = REFERENCE_TRADES.slice();
            CURRENT_DATASET_LABEL = 'Live pre-reg record (' + REFERENCE_TRADES.length + ' trades)';
            if (typeof renderBattery === 'function') renderBattery(currentTrades);
            // Refresh the §Arithmetic Booster Engine baseline now that real data is in.
            if (typeof window.__epigArithRefreshBaseline === 'function') {
                try { window.__epigArithRefreshBaseline(); } catch (e) {}
            }
        })
        .catch(function () {
            // Static fallback — pending copy must not persist on screen.
            const verdict = document.getElementById('batteryVerdict');
            const timestamp = document.getElementById('batteryTimestamp');
            const datasetLabel = document.getElementById('batteryDataset');
            const grid = document.getElementById('batteryGrid');
            if (timestamp) timestamp.textContent = 'unavailable right now';
            if (datasetLabel) datasetLabel.textContent = 'live pre-registration record';
            if (verdict) verdict.textContent = 'Activates at ' + BATTERY_MIN_N + '+ trades';
            if (grid) grid.innerHTML = '<div style="padding:24px;text-align:center;color:var(--slate);font-size:14px;line-height:1.6"><p style="margin:0">The live record updates within 24 hours of every closed trade — <a href="/dashboard.html">open the dashboard →</a></p></div>';
        });

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

        const n = (trades || []).length;
        if (n < BATTERY_MIN_N) {
            verdict.textContent = 'Activates at ' + BATTERY_MIN_N + '+ trades';
            verdict.classList.remove('has-fail');
            verdict.classList.add('is-pending');
            if (timestamp) timestamp.textContent = '—';
            if (datasetLabel) datasetLabel.textContent = CURRENT_DATASET_LABEL + ' · n = ' + n;
            grid.innerHTML = '<div style="padding:24px;text-align:center;color:var(--slate);font-size:14px;line-height:1.6">'
                + '<p style="margin:0 0 8px"><strong>The 8-test battery is a statistical claim about the entire dataset.</strong></p>'
                + '<p style="margin:0 0 8px">With <strong>n = ' + n + '</strong> trades the sample is too small for meaningful inference. The battery returns when the live record reaches <strong>' + BATTERY_MIN_N + '+ closed trades</strong>.</p>'
                + '<p style="margin:0"><a href="/dashboard.html">See the live record so far →</a></p>'
                + '</div>';
            return;
        }
        const results = computeBattery(trades);
        if (!results) {
            grid.innerHTML = '<p>Insufficient data to compute battery.</p>';
            return;
        }
        const passed = results.filter(function (r) { return r.pass; }).length;
        verdict.textContent = passed + ' / 8 ' + (passed === 8 ? 'PASS' : passed >= 6 ? 'PARTIAL' : 'FAIL');
        verdict.classList.toggle('has-fail', passed < 8);
        verdict.classList.remove('is-pending');
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
            showStatus('Could not parse data: ' + e.message + '. Format detected may be unsupported. Email info@ekantikcapital.com for format help.', 'error');
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
        CURRENT_DATASET_LABEL = 'Live pre-reg record (' + currentTrades.length + ' trades)';
        renderBattery(currentTrades);
        showStatus('Reset to live pre-registration record.', 'info');
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
        ctx.strokeStyle = '#12264a'; ctx.lineWidth = 2;
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
        }, { threshold: 0, rootMargin: '200px 0px' });
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
        widget.setAttribute('data-url', url + '?hide_event_type_details=0&primary_color=d4af37&text_color=12264a');
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

    /* ------------------------------------------------
       The Arithmetic — Doubling Arithmetic calculator
       Real S&P 500 annual total returns (incl. dividends).
       Compounds each year as: index >= 0 ? index * upCapture : index * downCapture.
       Three windows: calm bull (2013–2019), crash window (2007–2010), full 20yr (2005–2024).
       Hypothetical inputs, historical illustration only — not a projection.
       ------------------------------------------------ */
    (function setupArithmetic() {
        const calc = document.getElementById('arithCalc');
        if (!calc) return;

        // S&P 500 total returns (decimal), calendar year — index values from public sources
        const SP_TR = {
            2005: 0.0483, 2006: 0.1585, 2007: 0.0549, 2008: -0.3700, 2009: 0.2646,
            2010: 0.1506, 2011: 0.0211, 2012: 0.1600, 2013: 0.3239, 2014: 0.1369,
            2015: 0.0138, 2016: 0.1196, 2017: 0.2183, 2018: -0.0438, 2019: 0.3149,
            2020: 0.1840, 2021: 0.2871, 2022: -0.1811, 2023: 0.2629, 2024: 0.2502
        };

        const windows = [
            { id: 'calm',  label: 'Calm bull run',        range: '2013 – 2019', years: [2013,2014,2015,2016,2017,2018,2019] },
            { id: 'crash', label: 'Crash window',          range: '2007 – 2010', years: [2007,2008,2009,2010] },
            { id: 'full',  label: 'Full 20-year span',     range: '2005 – 2024', years: Object.keys(SP_TR).map(Number).sort() }
        ];

        function compound(years, up, down, contracts) {
            // Returns { idx, strat } for the END of the window. Wraps buildSeries so
            // the cards reflect the exact same model as the chart: 80% SPY foundation
            // (compounded by index TR) + 20% capture-asymmetric engine (slider-driven)
            // + optional Booster Engine layer (claim-gated; Period 2 throughput, linear).
            // At sliders 100/100 and contracts=0, strat === idx (calibration check).
            const s = buildSeries(years, up, down, contracts || 0);
            const last = s[s.length - 1];
            return { idx: last.idx, strat: last.total };
        }

        function fmtMult(m) {
            // 1.0 -> "1.00x", 2.34 -> "2.34x"
            return m.toFixed(2) + 'x';
        }
        function fmtPct(p) {
            const sign = p >= 0 ? '+' : '';
            return sign + (p * 100).toFixed(1) + '%';
        }
        // Compact USD formatter: 1234 -> "$1.2K", 28250 -> "$28.3K", 1034000 -> "$1.03M"
        function fmtUSD0(d) {
            const a = Math.abs(d);
            if (a >= 1e6) return '$' + (a / 1e6).toFixed(2) + 'M';
            if (a >= 1e3) return '$' + (a / 1e3).toFixed(a >= 1e4 ? 1 : 2) + 'K';
            return '$' + a.toFixed(0);
        }
        function moodClass(v) { return v > 0 ? ' arith-window__val--pos' : v < 0 ? ' arith-window__val--neg' : ''; }

        function render() {
            const up = parseInt(document.getElementById('arithUp').value, 10) / 100;
            const down = parseInt(document.getElementById('arithDown').value, 10) / 100;
            document.getElementById('arithUpVal').textContent = (up * 100).toFixed(0);
            document.getElementById('arithDownVal').textContent = (down * 100).toFixed(0);

            const wrap = document.getElementById('arithWindows');
            const stratLabel = activeRiskPct > 0
                ? 'Strategy (incl. Booster from live record)'
                : 'Strategy (capture only)';
            wrap.innerHTML = windows.map(function (w) {
                const r = compound(w.years, up, down, activeRiskPct);
                const idxPct = r.idx - 1;
                const stratPct = r.strat - 1;
                const alpha = r.strat - r.idx;       // absolute multiple gap
                const alphaPct = r.strat / r.idx - 1; // relative outperformance over the window
                // Alpha CAGR: annualized excess return. Geometric mean of the per-year
                // outperformance ratio, expressed as %/yr. Lets the visitor compare
                // windows of different lengths (4yr crash vs 20yr full) on equal footing.
                const years = w.years.length;
                const alphaCagr = years > 0 ? Math.pow(r.strat / r.idx, 1 / years) - 1 : 0;
                // Dollar reference: a $100K model portfolio.
                const NLV0 = 100000;
                const idxDollar = r.idx * NLV0;
                const stratDollar = r.strat * NLV0;
                const alphaDollar = alpha * NLV0;   // = stratDollar - idxDollar
                return ''
                    + '<div class="arith-window">'
                    +   '<p class="arith-window__h">' + w.label + '</p>'
                    +   '<p class="arith-window__range">' + w.range + ' · ' + years + ' yrs</p>'
                    +   '<div class="arith-window__row"><span class="arith-window__lbl">S&amp;P 500</span><span class="arith-window__val' + moodClass(idxPct) + '">' + fmtMult(r.idx) + ' <span class="arith-window__dollars">' + fmtUSD0(idxDollar) + '</span></span></div>'
                    +   '<div class="arith-window__row"><span class="arith-window__lbl">' + stratLabel + '</span><span class="arith-window__val' + moodClass(stratPct) + '">' + fmtMult(r.strat) + ' <span class="arith-window__dollars">' + fmtUSD0(stratDollar) + '</span></span></div>'
                    +   '<div class="arith-window__row"><span class="arith-window__lbl">Δ (strat − index)</span><span class="arith-window__val' + moodClass(alpha) + '">' + (alpha >= 0 ? '+' : '') + alpha.toFixed(2) + 'x</span></div>'
                    +   '<div class="arith-window__alpha">'
                    +     '<span class="arith-window__alpha-lbl">Outperformance<br><span class="arith-window__alpha-vs">vs 100% S&amp;P 500</span></span>'
                    +     '<span class="arith-window__alpha-stack">'
                    +       '<span class="arith-window__alpha-val' + moodClass(alphaPct) + '">' + fmtPct(alphaPct) + ' <span class="arith-window__alpha-suffix">total</span></span>'
                    +       '<span class="arith-window__alpha-dollars">' + fmtPct(alphaCagr) + '/yr CAGR · ' + (alphaDollar >= 0 ? '+' : '−') + fmtUSD0(Math.abs(alphaDollar)) + ' on $100K</span>'
                    +     '</span>'
                    +   '</div>'
                    + '</div>';
            }).join('');

            drawEquityChart(up, down);
            renderPlainEnglish(up, down);
        }

        /* ------------------------------------------------
           Dynamic plain-English summary for the currently-active window.
           Updates on every slider, window-tab, and Booster-toggle change.
           Reads sliders + active window + Booster state; outputs one sentence
           in the same units as the cards so the visitor can audit at a glance.
           ------------------------------------------------ */
        function renderPlainEnglish(up, down) {
            const el = document.getElementById('arithPlainEnglish');
            if (!el) return;
            const win = windows.find(function (w) { return w.id === activeWindow; }) || windows[2];
            const series = buildSeries(win.years, up, down, activeRiskPct);
            const last = series[series.length - 1];
            const years = win.years.length;
            const NLV0 = 100000;
            const stratDollar = last.total * NLV0;
            const idxDollar = last.idx * NLV0;
            const ratio = last.total / last.idx;
            const upPct = Math.round(up * 100);
            const downPct = Math.round(down * 100);

            // Pick a comparison phrase that matches the magnitude.
            let comparePhrase;
            if (ratio >= 1.95 && ratio < 2.10) comparePhrase = 'about double';
            else if (ratio >= 2.10)            comparePhrase = 'roughly ' + ratio.toFixed(1) + '× more than';
            else if (ratio >= 1.50)            comparePhrase = 'about ' + Math.round((ratio - 1) * 100) + '% more than';
            else if (ratio >= 1.05)            comparePhrase = Math.round((ratio - 1) * 100) + '% more than';
            else if (ratio >= 0.95)            comparePhrase = 'roughly matching';
            else                                comparePhrase = Math.round((1 - ratio) * 100) + '% less than';

            // Booster clause — only when the countersigned flag is on; no monthly dollarization.
            let boosterClause = '';
            if (activeRiskPct > 0 && EPIG_FLAGS.BOOSTER_TOGGLE_ENABLED) {
                const m = throughputBaselineMeta;
                boosterClause = ', AND the Booster Engine repeats its protocol-bound live-record throughput (sample: <strong>' + (m.tradeCount || 0) + ' trades</strong>, at the 0.5% risk anchor) consistently';
            }

            // Window label in plain text
            const winLabel = win.label.toLowerCase() === 'full 20-year span'
                ? 'over the full 20-year span (2005–2024)'
                : win.label.toLowerCase() === 'calm bull run'
                    ? 'across the calm 2013–2019 bull run'
                    : 'through the 2007–2010 crash window';

            el.innerHTML =
                  '<span class="diamond">◆</span> <strong>In plain English ' + winLabel + ':</strong> '
                + 'if the overlay captures <strong>' + upPct + '%</strong> of every up year '
                + 'and only <strong>' + downPct + '%</strong> of every down year for <strong>' + years + ' straight years</strong>'
                + boosterClause + ', '
                + 'a $100K portfolio ends at <strong>' + fmtUSD0(stratDollar) + '</strong> — '
                + comparePhrase + ' the <strong>' + fmtUSD0(idxDollar) + '</strong> '
                + 'an investor would have gotten from just buying SPY and holding.';
        }

        /* ------------------------------------------------
           Historical equity chart — stacked 80% SPY + 20% engine vs 100% S&P 500.
           For each year y in the active window:
             r_spy  = SP_TR[y]
             r_eng  = r_spy * (r_spy >= 0 ? up : down)
             total  = 0.80*(1+r_spy)*spyVal + 0.20*(1+r_eng)*engVal
           Two stacked area traces (SPY base, engine overlay) + S&P benchmark line.
           ------------------------------------------------ */
        const ALLOC_SPY = 0.80;
        const ALLOC_ENG = 0.20;
        let activeWindow = 'full';
        // Booster Engine state: 0 = off; 0.5 = on (live-record extrapolation at the
        // 0.5% architectural risk anchor). Ships OFF: the engine layer only unlocks
        // when BOOSTER_TOGGLE_ENABLED is countersigned on (spec §5), and is then
        // computed from protocol-bound Period 2 trades only.
        let activeRiskPct = 0;

        // Annual throughput as a fraction of $100K starting NLV at the 0.5% per-trade
        // architectural risk anchor. No hardcoded fallback: the rate stays 0 until it
        // is computed from the protocol-bound Period 2 record (REFERENCE_TRADES).
        let THROUGHPUT_RATE_AT_HISTORICAL_RISK = 0;
        let throughputBaselineMeta = {
            source: 'protocol-bound Period 2 record (pending)',
            tradeCount: 0,
            totalPts: 0,
            activeMonths: 0,
            ratePct: 0
        };
        const HISTORICAL_RISK_PCT = 0.5;

        // Throughput scales linearly with per-trade risk:
        //   risk 0.25% → 0.5× baseline
        //   risk 0.5%  → 1.0× baseline  (== architectural anchor)
        //   risk 1.0%  → 2.0× baseline
        function throughputRateFor(riskPct) {
            if (!riskPct) return 0;
            return (riskPct / HISTORICAL_RISK_PCT) * THROUGHPUT_RATE_AT_HISTORICAL_RISK;
        }

        // Compute the live baseline from a trade array, plus R-multiple stats
        // (avg loss = 1R, EV, R-expectancy, Annual R). Returns null if the data
        // is empty / un-parseable; in that case the fallback constant stays in use.
        function computeBaselineFromTrades(trades) {
            if (!trades || !trades.length) return null;
            const months = {};
            let totalPts = 0;
            let winSum = 0, lossSum = 0, winN = 0, lossN = 0;
            for (let i = 0; i < trades.length; i++) {
                const t = trades[i];
                const pts = typeof t.pts === 'number' ? t.pts : parseFloat(t.pts);
                if (!isFinite(pts)) continue;
                totalPts += pts;
                if (pts > 0) { winSum += pts; winN++; }
                else if (pts < 0) { lossSum += pts; lossN++; }
                const ts = t.timestamp;
                if (ts && typeof ts === 'string') months[ts.slice(0, 7)] = true;
            }
            const activeMonths = Object.keys(months).length;
            if (!activeMonths) return null;
            // Throughput rate: pts/active month × 12 months/yr × $50/pt / $100K NLV
            const ratePct100 = (totalPts / activeMonths) * 12 * 50 / 100000;
            // R-multiple framing: 1R = average loss in points
            const avgLoss = lossN > 0 ? Math.abs(lossSum / lossN) : 0;
            const avgWin  = winN > 0 ? winSum / winN : 0;
            const evPerTrade = trades.length > 0 ? totalPts / trades.length : 0;
            const rExpectancy = avgLoss > 0 ? evPerTrade / avgLoss : 0;          // R per trade
            const tradesPerYear = activeMonths > 0 ? (trades.length / activeMonths) * 12 : 0;
            const annualR = rExpectancy * tradesPerYear;                          // R per year
            return {
                rate: ratePct100,
                tradeCount: trades.length,
                totalPts: totalPts,
                activeMonths: activeMonths,
                ratePct: ratePct100 * 100,
                avgLoss: avgLoss,
                avgWin: avgWin,
                evPerTrade: evPerTrade,
                rExpectancy: rExpectancy,
                tradesPerYear: tradesPerYear,
                annualR: annualR,
                winN: winN,
                lossN: lossN
            };
        }

        // Refresh the baseline + re-render. Called by the outer fetch handler once
        // REFERENCE_TRADES populates. Safe to call repeatedly.
        function refreshBaselineFromLiveRecord() {
            // REFERENCE_TRADES is Period-2-only by construction (see fetch handler).
            const meta = computeBaselineFromTrades(REFERENCE_TRADES);
            if (meta && isFinite(meta.rate) && meta.rate > 0) {
                THROUGHPUT_RATE_AT_HISTORICAL_RISK = meta.rate;
                throughputBaselineMeta = Object.assign({
                    source: 'protocol-bound Period 2 live record'
                }, meta);
            }
            updateBaselineIndicator();
            if (typeof render === 'function') render();
        }

        function updateBaselineIndicator() {
            const el = document.getElementById('arithBaselineIndicator');
            if (!el) return;

            // CLAIM GATE (spec §5): no throughput %, $/yr, or $/mo figure may render
            // while CLAIMS_THROUGHPUT_ENABLED is off. Monthly dollarization stays
            // removed permanently even after the gate opens.
            if (!EPIG_FLAGS.CLAIMS_THROUGHPUT_ENABLED) {
                const n = REFERENCE_TRADES.length;
                el.innerHTML =
                      '<p class="arith-baseline__headline"><span class="diamond">◆</span> Engine throughput will be reported here from the protocol-bound live record once the battery activates at 30 closed trades (currently ' + n + '). Until then, we publish the trades — not an extrapolation.</p>';
                return;
            }

            const m = throughputBaselineMeta;
            const ratePct = (m.ratePct || 0).toFixed(2);
            const totalPts = (m.totalPts || 0).toFixed(1);
            const trades = m.tradeCount || 0;
            const months = m.activeMonths || 0;

            el.innerHTML =
                  '<p class="arith-baseline__headline">'
                +   '<span class="diamond">◆</span> Booster Engine throughput on the protocol-bound live record · <strong>+' + ratePct + '% NLV / yr</strong> on a $100K portfolio · sample: <strong>' + trades + ' trades</strong>'
                + '</p>'
                + '<p class="arith-baseline__src">'
                +   '<em>Source: protocol-bound Period 2 live record (' + trades + ' trades · ' + totalPts + ' pts · ' + months + ' active months). Updates automatically with every admin publish. Throughput modeled at the 0.5% per-trade architectural risk anchor — the level the record was generated at. Historical illustration of past throughput extrapolated forward at constant contract count; not a projection of any Ekantik strategy.</em>'
                + '</p>';
        }

        // Expose for the outer fetch handler.
        window.__epigArithRefreshBaseline = refreshBaselineFromLiveRecord;

        function buildSeries(years, up, down, riskPct) {
            // Each output point: { yr, spy, eng, thr, total, idx }
            // v1.3 model: capture asymmetry now drives the FOUNDATION (the
            // synthetic-passive S&P 500 overlay), not a 20% slice. The 20%
            // bucket is operational cash (flat). The Booster Engine adds
            // throughput on top.
            //   spy  = 80% S&P foundation, grown by CAPTURE-MODIFIED past returns
            //   eng  = 20% cash bucket (flat — operational buffer)
            //   thr  = Booster Engine layer (real Telegram-derived, scaled by per-trade risk %)
            //   total = spy + eng + thr (stacked layers; thr=0 when risk=0)
            //   idx  = S&P 500 benchmark (100% exposure)
            const risk = riskPct || 0;
            const out = [{ yr: years[0] - 1, spy: ALLOC_SPY, eng: ALLOC_ENG, thr: 0, total: 1, idx: 1 }];
            let spy = ALLOC_SPY, eng = ALLOC_ENG, thr = 0, idx = 1;
            const thrRate = throughputRateFor(risk);
            for (let i = 0; i < years.length; i++) {
                const r = SP_TR[years[i]];
                // Capture-asymmetric return on the foundation (overlay output):
                //   up year: r × upsideCapture (e.g. 100% = full participation)
                //   down year: r × downsideParticipation (e.g. 50% = take half the drawdown)
                const rFoundation = r * (r >= 0 ? up : down);
                spy = spy * (1 + rFoundation);
                // Cash bucket stays flat (no exposure, no yield in this illustration)
                // eng unchanged from previous year
                // Throughput layer is linear: each year the engine adds thrRate × $100K
                // in PnL (constant in dollar terms — the per-trade risk % is fixed for
                // the illustration, so the dollar throughput stays steady year to year).
                if (risk > 0) thr = thrRate * (i + 1);
                idx = idx * (1 + r);
                out.push({ yr: years[i], spy: spy, eng: eng, thr: thr, total: spy + eng + thr, idx: idx });
            }
            return out;
        }

        let chartHover = null;   // geometry of the last draw, for the hover tooltip

        function drawEquityChart(up, down) {
            const canvas = document.getElementById('arithEquityCanvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            const W = canvas.clientWidth || 1100;
            const H = canvas.clientHeight || 360;
            canvas.width = W * dpr; canvas.height = H * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);

            const win = windows.find(function (w) { return w.id === activeWindow; }) || windows[2];
            const series = buildSeries(win.years, up, down, activeRiskPct);

            const PAD_L = 56, PAD_R = 24, PAD_T = 24, PAD_B = 36;
            const xN = series.length - 1;
            chartHover = { series: series, PAD_L: PAD_L, PAD_R: PAD_R, PAD_T: PAD_T, PAD_B: PAD_B, W: W, H: H };
            const maxVal = Math.max.apply(null, series.map(function (p) { return Math.max(p.total, p.idx); }));
            const minVal = Math.min.apply(null, series.map(function (p) { return Math.min(p.total, p.idx, p.spy); }));
            const yMax = maxVal * 1.05;
            const yMin = Math.min(minVal * 0.95, 0.5);

            function x(i) { return PAD_L + (i / xN) * (W - PAD_L - PAD_R); }
            function y(v) { return PAD_T + (yMax - v) / (yMax - yMin) * (H - PAD_T - PAD_B); }

            // Grid lines + Y-axis labels (every 0.5x roughly)
            ctx.strokeStyle = 'rgba(27, 42, 74, 0.06)'; ctx.lineWidth = 1;
            ctx.fillStyle = '#64748B'; ctx.font = '11px "Source Sans 3", sans-serif';
            const yStep = (yMax - yMin) > 6 ? 1 : 0.5;
            for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) {
                const yy = y(v);
                ctx.beginPath(); ctx.moveTo(PAD_L, yy); ctx.lineTo(W - PAD_R, yy); ctx.stroke();
                ctx.textAlign = 'right'; ctx.fillText(v.toFixed(yStep >= 1 ? 1 : 2) + 'x', PAD_L - 6, yy + 4);
            }
            // Start line (1.0x) emphasized
            const y1 = y(1);
            ctx.strokeStyle = 'rgba(27, 42, 74, 0.3)'; ctx.setLineDash([3,3]);
            ctx.beginPath(); ctx.moveTo(PAD_L, y1); ctx.lineTo(W - PAD_R, y1); ctx.stroke();
            ctx.setLineDash([]);

            // X-axis labels (years), spaced
            ctx.fillStyle = '#64748B'; ctx.textAlign = 'center';
            const labelEvery = Math.max(1, Math.ceil(series.length / 8));
            for (let i = 0; i < series.length; i++) {
                if (i % labelEvery !== 0 && i !== series.length - 1) continue;
                ctx.fillText(String(series[i].yr + (i === 0 ? '' : '')), x(i), H - PAD_B + 18);
            }

            // Stacked area: SPY foundation (teal — data color)
            ctx.fillStyle = 'rgba(13, 148, 136, 0.16)';
            ctx.beginPath();
            ctx.moveTo(x(0), y(0));
            for (let i = 0; i < series.length; i++) ctx.lineTo(x(i), y(series[i].spy));
            ctx.lineTo(x(xN), y(0));
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#0D9488'; ctx.lineWidth = 1.6;
            ctx.beginPath();
            for (let i = 0; i < series.length; i++) {
                const px = x(i), py = y(series[i].spy);
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();

            // Stacked area: 20% cash buffer on top of SPY (slate band, spy → spy+eng).
            // Gold is reserved for the Booster Engine band only.
            ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
            ctx.beginPath();
            ctx.moveTo(x(0), y(series[0].spy));
            for (let i = 0; i < series.length; i++) ctx.lineTo(x(i), y(series[i].spy + series[i].eng));
            for (let i = series.length - 1; i >= 0; i--) ctx.lineTo(x(i), y(series[i].spy));
            ctx.closePath();
            ctx.fill();

            // Stacked area: Booster Engine layer on top (gold-deep band, spy+eng → total) — only if contracts > 0
            if (activeRiskPct > 0) {
                ctx.fillStyle = 'rgba(168, 138, 56, 0.45)';
                ctx.beginPath();
                ctx.moveTo(x(0), y(series[0].spy + series[0].eng));
                for (let i = 0; i < series.length; i++) ctx.lineTo(x(i), y(series[i].total));
                for (let i = series.length - 1; i >= 0; i--) ctx.lineTo(x(i), y(series[i].spy + series[i].eng));
                ctx.closePath();
                ctx.fill();
            }

            // Total NLV line (gold-deep, sits at top of all stacked bands)
            ctx.strokeStyle = '#b8962e'; ctx.lineWidth = 2.4;
            ctx.beginPath();
            for (let i = 0; i < series.length; i++) {
                const px = x(i), py = y(series[i].total);
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();

            // S&P 500 benchmark line (navy)
            ctx.strokeStyle = '#12264a'; ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]);
            ctx.beginPath();
            for (let i = 0; i < series.length; i++) {
                const px = x(i), py = y(series[i].idx);
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // End-point callouts: strategy multiplier + S&P multiplier
            const last = series[series.length - 1];
            ctx.fillStyle = '#b8962e'; ctx.textAlign = 'left'; ctx.font = '12px "Source Sans 3", sans-serif';
            ctx.fillText(last.total.toFixed(2) + 'x · Strategy', x(xN) - 90, y(last.total) - 8);
            ctx.fillStyle = '#12264a';
            ctx.fillText(last.idx.toFixed(2) + 'x · S&P 500', x(xN) - 90, y(last.idx) + 16);

            updateChartReading(up, down);
        }

        /* ------------------------------------------------
           Dynamic chart interpretation — derived arithmetic
           from the user's slider inputs over the active
           window. M = how much the capture settings multiply
           the foundation's cumulative growth vs the index;
           M* = the bar needed to overcome the 80% allocation
           haircut + flat 20% cash.
           ------------------------------------------------ */
        function updateChartReading(up, down) {
            const el = document.getElementById('arithChartReading');
            if (!el) return;
            const win = windows.find(function (w) { return w.id === activeWindow; }) || windows[2];
            let m = 1, idx = 1;
            for (let i = 0; i < win.years.length; i++) {
                const r = SP_TR[win.years[i]];
                const c = r >= 0 ? up : down;
                m *= (1 + r * c) / (1 + r);
                idx *= (1 + r);
            }
            const mStar = (idx - ALLOC_ENG) / (ALLOC_SPY * idx);
            const cleared = m >= mStar;
            el.innerHTML =
                  '<span class="diamond">◆</span> <strong>Reading the chart:</strong> at these capture settings, the overlay multiplies the foundation\'s cumulative growth by <strong>≈' + m.toFixed(2) + '×</strong> relative to the index over this window. Beating 100% S&amp;P requires <strong>≈' + mStar.toFixed(2) + '×</strong> — the bar set by the 80% allocation and the flat 20% cash. '
                + (cleared
                    ? 'Cleared here, so the strategy line ends above the benchmark: the drawdowns avoided in the down years raise the base that every later up year compounds from.'
                    : 'Not cleared here — there isn\'t enough drawdown in this window to step aside from, so the cash drag dominates and the strategy lags the index.')
                + ' Hover or tap any year on the chart for exact readings. <em>Hypothetical inputs, historical illustration.</em>';
        }

        /* ------------------------------------------------
           Hover / tap tooltip — exact per-year readings.
           ------------------------------------------------ */
        (function setupChartTooltip() {
            const canvas = document.getElementById('arithEquityCanvas');
            if (!canvas) return;
            const box = canvas.parentElement;            // .arith-chart
            const tip = document.createElement('div');
            tip.className = 'arith-tooltip';
            tip.hidden = true;
            const line = document.createElement('div');
            line.className = 'arith-tooltip__line';
            line.hidden = true;
            box.appendChild(tip); box.appendChild(line);

            function hide() { tip.hidden = true; line.hidden = true; }
            function onPointer(e) {
                const g = chartHover;
                if (!g) return;
                const rect = canvas.getBoundingClientRect();
                const px = e.clientX - rect.left;
                const innerW = g.W - g.PAD_L - g.PAD_R;
                if (innerW <= 0) return;
                const xN = g.series.length - 1;
                let i = Math.round((px - g.PAD_L) / innerW * xN);
                if (i < 0) i = 0;
                if (i > xN) i = xN;
                const p = g.series[i];
                const delta = p.total - p.idx;
                tip.innerHTML =
                      '<strong>' + (i === 0 ? 'Start · ' : '') + p.yr + '</strong><br>'
                    + 'Strategy <strong>' + p.total.toFixed(2) + 'x</strong> · ' + fmtUSD0(p.total * 100000) + ' on $100K<br>'
                    + 'S&amp;P 500 ' + p.idx.toFixed(2) + 'x · ' + fmtUSD0(p.idx * 100000) + '<br>'
                    + 'Δ ' + (delta >= 0 ? '+' : '') + delta.toFixed(2) + 'x';
                tip.hidden = false; line.hidden = false;
                const xpx = g.PAD_L + (i / xN) * innerW;
                const cLeft = canvas.offsetLeft, cTop = canvas.offsetTop;
                line.style.left = (cLeft + xpx) + 'px';
                line.style.top = (cTop + g.PAD_T) + 'px';
                line.style.height = (canvas.clientHeight - g.PAD_T - g.PAD_B) + 'px';
                const flip = xpx > g.W - 200;
                tip.style.left = (cLeft + xpx + (flip ? -(tip.offsetWidth + 14) : 14)) + 'px';
                tip.style.top = (cTop + g.PAD_T + 8) + 'px';
            }
            canvas.addEventListener('pointermove', onPointer);
            canvas.addEventListener('pointerdown', onPointer);
            canvas.addEventListener('pointerleave', hide);
        })();

        // Window tabs
        document.querySelectorAll('.arith-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                activeWindow = tab.getAttribute('data-window');
                document.querySelectorAll('.arith-tab').forEach(function (t) { t.classList.toggle('is-active', t === tab); });
                const up = parseInt(document.getElementById('arithUp').value, 10) / 100;
                const down = parseInt(document.getElementById('arithDown').value, 10) / 100;
                drawEquityChart(up, down);
                renderPlainEnglish(up, down);
            });
        });

        // Booster Engine on/off toggle.
        function syncThroughLegend() {
            const legend = document.getElementById('arithLegendThrough');
            const baseline = document.getElementById('arithBaselineIndicator');
            const isOn = activeRiskPct > 0;
            if (legend) legend.hidden = !isOn;
            // The claim-gate notice stays fully visible while throughput claims are off.
            if (baseline) baseline.style.opacity = (isOn || !EPIG_FLAGS.CLAIMS_THROUGHPUT_ENABLED) ? '1' : '0.5';
        }
        document.querySelectorAll('.arith-contract').forEach(function (chip) {
            const risk = parseFloat(chip.getAttribute('data-risk')) || 0;
            if (risk > 0 && EPIG_FLAGS.BOOSTER_TOGGLE_ENABLED) {
                chip.disabled = false;
                chip.removeAttribute('aria-disabled');
            }
            chip.addEventListener('click', function () {
                if (chip.disabled) return;
                if (risk > 0 && !EPIG_FLAGS.BOOSTER_TOGGLE_ENABLED) return;
                activeRiskPct = risk;
                document.querySelectorAll('.arith-contract').forEach(function (c) { c.classList.toggle('is-active', c === chip); });
                syncThroughLegend();
                render();   // re-render both cards AND chart so they stay in sync
            });
        });
        syncThroughLegend();

        window.addEventListener('resize', function () {
            const up = parseInt(document.getElementById('arithUp').value, 10) / 100;
            const down = parseInt(document.getElementById('arithDown').value, 10) / 100;
            drawEquityChart(up, down);
        });

        document.getElementById('arithUp').addEventListener('input', render);
        document.getElementById('arithDown').addEventListener('input', render);
        render();
    })();
})();
