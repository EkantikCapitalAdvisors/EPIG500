/* ================================================
   EKANTIK 500 — Live Dashboard
   Loads /data/trades.json and renders KPIs, equity curve, battery, trade table.
   ================================================ */
(function () {
    'use strict';

    let TRADES = [];
    let META = {};
    let filteredTrades = [];
    let currentTf = 'all';     // active timeframe key

    /* ---------- Timeframe filter ----------
       Returns a subset of trades whose timestamps fall in the selected window.
       'all' = no filter; 'prereg' / 'historical' = period-based. */
    function tfFilter(trades, tf) {
        if (!tf || tf === 'all') return trades.slice();
        if (tf === 'prereg')      return trades.filter(function (t) { return t.period === 'pre_reg'; });
        if (tf === 'historical')  return trades.filter(function (t) { return t.period === 'historical'; });

        const now = new Date();
        let cutoff;
        if (tf === 'ytd') {
            cutoff = new Date(now.getFullYear(), 0, 1);
        } else if (tf === 'mtd') {
            cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (tf === '7d')  { cutoff = new Date(now.getTime() -  7 * 86400000); }
        else if (tf === '30d') { cutoff = new Date(now.getTime() - 30 * 86400000); }
        else if (tf === '90d') { cutoff = new Date(now.getTime() - 90 * 86400000); }
        else { return trades.slice(); }
        return trades.filter(function (t) { return new Date(t.timestamp) >= cutoff; });
    }

    function tfLabel(tf) {
        return ({
            'all': 'All time',
            'ytd': 'Year-to-date',
            'mtd': 'Month-to-date',
            '7d':  'Last 7 days',
            '30d': 'Last 30 days',
            '90d': 'Last 90 days',
            'prereg': 'Pre-registration trades only',
            'historical': 'Historical reference dataset only'
        })[tf] || 'All time';
    }

    fetch('data/trades.json?t=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (json) {
            // The dashboard is the public ES-points engine record. Per the
            // store-and-bucket model, exclude the synthetic-passive (SPY) book
            // and any dollar-denominated trade without an ES-equivalent point
            // (IB stock / option / non-ES futures booster trades). They remain
            // in data/trades.json; a dollar-denominated multi-asset view is a
            // separate follow-up. No-op for the current all-/ES dataset.
            TRADES = (json.trades || []).filter(function (t) {
                return t.book !== 'synthetic_passive' && typeof t.pts === 'number';
            });
            META = json.meta || {};
            // Sort newest first for display
            TRADES.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
            filteredTrades = TRADES.slice();
            render();
        })
        .catch(function (err) {
            document.getElementById('dashMeta').textContent = 'Error loading dataset: ' + err.message;
        });

    /* ---------- Computation ---------- */
    function compute(trades) {
        if (!trades.length) return null;
        const pts = trades.map(function (t) { return t.pts; });
        const n = pts.length;
        const wins = pts.filter(function (x) { return x > 0; });
        const losses = pts.filter(function (x) { return x < 0; });
        const be = pts.filter(function (x) { return x === 0; });
        const winRate = wins.length / (n - be.length || 1);
        const grossWin = wins.reduce(function (a, b) { return a + b; }, 0);
        const grossLoss = Math.abs(losses.reduce(function (a, b) { return a + b; }, 0));
        const avgWin = wins.length ? grossWin / wins.length : 0;
        const avgLoss = losses.length ? grossLoss / losses.length : 0;
        const evMean = pts.reduce(function (a, b) { return a + b; }, 0) / n;
        const total = pts.reduce(function (a, b) { return a + b; }, 0);
        const pf = grossLoss > 0 ? grossWin / grossLoss : Infinity;

        // Equity curve (chronological)
        const chrono = trades.slice().sort(function (a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
        const eq = [0];
        let cum = 0;
        for (let i = 0; i < chrono.length; i++) { cum += chrono[i].pts; eq.push(cum); }

        // Max drawdown
        let peak = -Infinity, maxDD = 0;
        for (let i = 0; i < eq.length; i++) {
            if (eq[i] > peak) peak = eq[i];
            const dd = eq[i] - peak;
            if (dd < maxDD) maxDD = dd;
        }
        // Current drawdown
        const lastPeak = Math.max.apply(null, eq);
        const curDD = eq[eq.length - 1] - lastPeak;

        // Streaks — max losing streak and current streak (signed: +n win streak, -n loss streak)
        let maxStreak = 0, runLoss = 0, runWin = 0;
        for (let i = 0; i < chrono.length; i++) {
            if (chrono[i].pts < 0) { runLoss++; runWin = 0; if (runLoss > maxStreak) maxStreak = runLoss; }
            else if (chrono[i].pts > 0) { runWin++; runLoss = 0; }
            else { runWin = 0; runLoss = 0; }
        }
        const currentStreak = runWin > 0 ? runWin : -runLoss;

        // Best / worst single trade
        const best = pts.reduce(function (a, b) { return b > a ? b : a; }, -Infinity);
        const worst = pts.reduce(function (a, b) { return b < a ? b : a; }, Infinity);

        // W/L ratio (avg win / avg loss); recovery factor (total / |maxDD|)
        const wlRatio = avgLoss > 0 ? avgWin / avgLoss : Infinity;
        const recovery = maxDD < 0 ? total / Math.abs(maxDD) : Infinity;

        // R-Expectancy: per-trade points expressed in units of average loss (1R)
        const rExp = avgLoss > 0 ? evMean / avgLoss : 0;

        // Annual R: total R-multiples earned annualized over the elapsed window.
        // Total R = sum(points) / avgLoss. Year fraction uses the span between
        // first and last trade in the window. Below 30 days the annualization is
        // noisy; we surface that in the tile sub-label rather than suppressing.
        const _firstMs = chrono.length ? new Date(chrono[0].timestamp).getTime() : 0;
        const _lastMs  = chrono.length ? new Date(chrono[chrono.length-1].timestamp).getTime() : 0;
        const _yrMs = 365.25 * 86400 * 1000;
        const yearsElapsed = (_lastMs > _firstMs) ? (_lastMs - _firstMs) / _yrMs : 0;
        const totalR = avgLoss > 0 ? total / avgLoss : 0;
        const annualR = (yearsElapsed > 0 && avgLoss > 0) ? totalR / yearsElapsed : null;
        const annualRDaysCovered = yearsElapsed * 365.25;

        // Trades-to-recover from the deepest drawdown: from the trough, how many
        // subsequent trades until equity reclaims the peak that preceded it.
        // null if not yet recovered (still in drawdown).
        let _peak = -Infinity, _ddVal = 0, _troughIdx = -1, _peakAtTrough = 0;
        for (let i = 0; i < eq.length; i++) {
            if (eq[i] > _peak) _peak = eq[i];
            const dd = eq[i] - _peak;
            if (dd < _ddVal) { _ddVal = dd; _troughIdx = i; _peakAtTrough = _peak; }
        }
        let recoveryTrades = null;
        let recoveryInProgress = 0;
        if (_troughIdx >= 0) {
            for (let j = _troughIdx + 1; j < eq.length; j++) {
                if (eq[j] >= _peakAtTrough) { recoveryTrades = j - _troughIdx; break; }
            }
            if (recoveryTrades === null) recoveryInProgress = (eq.length - 1) - _troughIdx;
        }

        // Date range
        const firstTs = chrono.length ? new Date(chrono[0].timestamp) : null;
        const lastTs  = chrono.length ? new Date(chrono[chrono.length-1].timestamp) : null;

        return {
            n: n, wins: wins.length, losses: losses.length, be: be.length,
            winRate: winRate, evMean: evMean, total: total, pf: pf,
            avgWin: avgWin, avgLoss: avgLoss, grossWin: grossWin, grossLoss: grossLoss,
            equity: eq, chrono: chrono, maxDD: maxDD, curDD: curDD,
            maxStreak: maxStreak, currentStreak: currentStreak,
            best: best, worst: worst, wlRatio: wlRatio, recovery: recovery,
            rExp: rExp, recoveryTrades: recoveryTrades, recoveryInProgress: recoveryInProgress,
            totalR: totalR, annualR: annualR, annualRDaysCovered: annualRDaysCovered,
            yearsElapsed: yearsElapsed,
            firstTs: firstTs, lastTs: lastTs
        };
    }

    /* ---------- 8-Test Battery (compact) ---------- */
    function battery(stats) {
        const n = stats.n;
        const pts = stats.chrono.map(function (t) { return t.pts; });
        // Standard error
        const mu = stats.evMean;
        const variance = pts.reduce(function (a, x) { return a + (x - mu) * (x - mu); }, 0) / (n - 1);
        const sd = Math.sqrt(variance);
        const se = sd / Math.sqrt(n);
        const t = se > 0 ? mu / se : 0;
        // Approx p-value via z
        function erf(x) {
            const s = Math.sign(x); x = Math.abs(x);
            const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
            const tt = 1/(1+p*x);
            return s*(1-(((((a5*tt+a4)*tt)+a3)*tt+a2)*tt+a1)*tt*Math.exp(-x*x));
        }
        const pVal = 1 - 0.5*(1+erf(t/Math.sqrt(2)));
        const lower = mu - 1.96 * se;
        // Top-3 removal
        const sortedWins = pts.filter(function (x) { return x > 0; }).sort(function (a, b) { return b - a; });
        const top3 = sortedWins.slice(0, 3).reduce(function (a, b) { return a + b; }, 0);
        const remPnl = pts.reduce(function (a, b) { return a + b; }, 0) - top3;
        const remPf = stats.grossLoss > 0 ? (stats.grossWin - top3) / stats.grossLoss : Infinity;
        const rExp = stats.avgLoss > 0 ? mu / stats.avgLoss : 0;
        const wl = stats.avgLoss > 0 ? stats.avgWin / stats.avgLoss : 0;
        const buffer = (stats.winRate - (wl > 0 ? 1 / (1 + wl) : 1)) * 100;
        // Quick bootstrap (2,000 samples for speed)
        const BOOTS = 2000;
        let pp = 0;
        for (let b = 0; b < BOOTS; b++) {
            let s = 0;
            for (let i = 0; i < n; i++) s += pts[(Math.random() * n) | 0];
            if (s > 0) pp++;
        }
        const pProfit = pp / BOOTS;

        return [
            { name: '1 · p-value',       val: 'p ' + (pVal < 0.0001 ? '<0.0001' : '=' + pVal.toFixed(3)),  pass: pVal < 0.05 },
            { name: '2 · 95% CI',        val: '[' + (lower>=0?'+':'') + lower.toFixed(2) + ', …]',           pass: lower > 0 },
            { name: '3 · Profit Factor', val: isFinite(stats.pf) ? stats.pf.toFixed(2) : '∞',                pass: stats.pf > 1.50 },
            { name: '4 · Top-3 removal', val: (remPnl>=0?'+':'') + remPnl.toFixed(0) + ' pts',                pass: remPnl > 0 && remPf > 1.30 },
            { name: '5 · R-Expectancy',  val: (rExp>=0?'+':'') + rExp.toFixed(2) + 'R',                       pass: rExp > 0.20 },
            { name: '6 · WR Buffer',     val: (buffer>=0?'+':'') + buffer.toFixed(1) + ' pp',                 pass: buffer > 5 },
            { name: '7 · Max streak',    val: stats.maxStreak + ' losses',                                   pass: stats.maxStreak <= 7 },
            { name: '8 · P(profit)',     val: (pProfit*100).toFixed(0) + '%',                                pass: pProfit > 0.90 }
        ];
    }

    /* ---------- Render ----------
       Battery always uses the full record (the canonical 8-test is a sustainability
       claim on the entire dataset). KPIs + equity curve + trade table respect the
       active timeframe.
    */
    function render() {
        const tfSlice = tfFilter(TRADES, currentTf);
        const sTf = compute(tfSlice);
        const sFull = compute(TRADES);
        renderMeta();
        renderTimeframeMeta(sTf, tfSlice.length);
        if (sTf) {
            renderKpis(sTf);
            drawEquityCurve(sTf);
            renderMonthly(tfSlice);
        } else {
            document.getElementById('dashKpis').innerHTML = '<div class="kpi" style="grid-column:1/-1;text-align:center;padding:24px"><p class="kpi__sub">No trades in this window. Pick a wider timeframe.</p></div>';
            const ctx = document.getElementById('dashEquityCurve').getContext('2d');
            ctx.clearRect(0, 0, document.getElementById('dashEquityCurve').width, document.getElementById('dashEquityCurve').height);
            document.getElementById('dashChartSub').textContent = '—';
            clearMonthly();
        }
        if (sFull) renderBattery(sFull);
        applyFilters();   // re-applies search/result/side over the current timeframe slice
    }

    /* ------------------------------------------------
       Monthly P&L breakdown — bar chart + table.
       Groups the timeframe-filtered trades by YYYY-MM and renders:
         - canvas bar chart (gold = positive months, red = negative)
         - audit table with trades / W-L / WR / net pts / net $ / best / worst
       Respects the active timeframe selector (uses tfSlice).
       ------------------------------------------------ */
    function clearMonthly() {
        const sub = document.getElementById('dashMonthlySub');
        if (sub) sub.textContent = '—';
        const body = document.getElementById('dashMonthlyBody');
        if (body) body.innerHTML = '';
        const canvas = document.getElementById('dashMonthlyChart');
        if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }

    function groupByMonth(trades) {
        // Returns sorted array of { ym, label, trades[], n, wins, losses, be, wr, net, dollars, best, worst }
        const buckets = {};
        for (let i = 0; i < trades.length; i++) {
            const t = trades[i];
            if (!t.timestamp) continue;
            const ym = String(t.timestamp).slice(0, 7); // YYYY-MM
            (buckets[ym] = buckets[ym] || []).push(t);
        }
        const keys = Object.keys(buckets).sort();
        return keys.map(function (ym) {
            const ts = buckets[ym];
            let wins = 0, losses = 0, be = 0, net = 0, best = -Infinity, worst = Infinity;
            for (let i = 0; i < ts.length; i++) {
                const p = ts[i].pts;
                net += p;
                if (p > 0) wins++;
                else if (p < 0) losses++;
                else be++;
                if (p > best) best = p;
                if (p < worst) worst = p;
            }
            const ruled = ts.length - be;
            // Build the label from the YYYY-MM string directly so timezone shift
            // can't push the month back. (new Date('2026-05-01T00:00:00Z').toLocale...
            // would have rendered as "Apr 26" for any negative UTC offset, since
            // midnight UTC May 1 = April 30 evening locally.)
            const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const yy = ym.slice(2, 4);
            const mm = parseInt(ym.slice(5, 7), 10);
            const label = MONTH_ABBR[mm - 1] + ' ' + yy;
            return {
                ym: ym, label: label, n: ts.length,
                wins: wins, losses: losses, be: be,
                wr: ruled > 0 ? wins / ruled : 0,
                net: net, dollars: net * 50,
                best: isFinite(best) ? best : 0,
                worst: isFinite(worst) ? worst : 0
            };
        });
    }

    function renderMonthly(trades) {
        const months = groupByMonth(trades);
        const sub = document.getElementById('dashMonthlySub');
        const body = document.getElementById('dashMonthlyBody');

        if (!months.length) { clearMonthly(); return; }

        const positives = months.filter(function (m) { return m.net > 0; }).length;
        const negatives = months.filter(function (m) { return m.net < 0; }).length;
        const total = months.reduce(function (a, m) { return a + m.net; }, 0);
        const avg = total / months.length;
        sub.innerHTML = months.length + ' months · '
            + '<span style="color:var(--forest,#2D5016)">' + positives + ' up</span> · '
            + '<span style="color:var(--signal,#DC2626)">' + negatives + ' down</span> · '
            + 'avg <strong>' + (avg >= 0 ? '+' : '') + avg.toFixed(1) + ' pts/mo</strong> '
            + '<span style="color:var(--slate)">(≈ $' + Math.round(avg * 50).toLocaleString() + '/mo per /ES)</span>';

        // Table rows
        body.innerHTML = months.map(function (m) {
            const netClass = m.net > 0 ? 'pos' : m.net < 0 ? 'neg' : 'zero';
            const wrPct = (m.wr * 100).toFixed(0) + '%';
            return ''
                + '<tr>'
                +   '<td>' + m.label + '</td>'
                +   '<td class="num">' + m.n + '</td>'
                +   '<td class="num">' + m.wins + ' / ' + m.losses + (m.be ? ' / ' + m.be + ' BE' : '') + '</td>'
                +   '<td class="num">' + wrPct + '</td>'
                +   '<td class="num ' + netClass + '">' + (m.net >= 0 ? '+' : '') + m.net.toFixed(2) + '</td>'
                +   '<td class="num ' + netClass + '">$' + Math.round(m.dollars).toLocaleString() + '</td>'
                +   '<td class="num pos">+' + m.best.toFixed(1) + '</td>'
                +   '<td class="num neg">' + m.worst.toFixed(1) + '</td>'
                + '</tr>';
        }).join('');

        drawMonthlyChart(months);
    }

    function drawMonthlyChart(months) {
        const canvas = document.getElementById('dashMonthlyChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.clientWidth || 1100;
        const H = canvas.clientHeight || 220;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        const PAD_L = 56, PAD_R = 24, PAD_T = 16, PAD_B = 36;
        const n = months.length;
        const maxAbs = Math.max.apply(null, months.map(function (m) { return Math.abs(m.net); })) || 1;
        const yMax = maxAbs * 1.15;
        const yMin = -yMax;

        function x(i) { return PAD_L + (i + 0.5) * ((W - PAD_L - PAD_R) / Math.max(1, n)); }
        function y(v) { return PAD_T + (yMax - v) / (yMax - yMin) * (H - PAD_T - PAD_B); }

        // Grid + Y labels
        ctx.font = '10px "Source Sans 3", sans-serif';
        ctx.strokeStyle = 'rgba(27,42,74,0.06)'; ctx.lineWidth = 1;
        ctx.fillStyle = '#64748B'; ctx.textAlign = 'right';
        const yStep = niceStep(maxAbs);
        for (let v = -Math.ceil(maxAbs / yStep) * yStep; v <= maxAbs * 1.05; v += yStep) {
            const yy = y(v);
            if (yy < PAD_T || yy > H - PAD_B) continue;
            ctx.beginPath(); ctx.moveTo(PAD_L, yy); ctx.lineTo(W - PAD_R, yy); ctx.stroke();
            ctx.fillText((v >= 0 ? '+' : '') + v.toFixed(0), PAD_L - 6, yy + 3);
        }
        // Zero line emphasized
        const y0 = y(0);
        ctx.strokeStyle = 'rgba(27,42,74,0.3)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD_L, y0); ctx.lineTo(W - PAD_R, y0); ctx.stroke();

        // Bars
        const barW = Math.min(28, Math.max(6, (W - PAD_L - PAD_R) / n * 0.7));
        for (let i = 0; i < n; i++) {
            const m = months[i];
            const cx = x(i);
            const yTop = y(Math.max(m.net, 0));
            const yBot = y(Math.min(m.net, 0));
            ctx.fillStyle = m.net >= 0 ? '#C8A951' : '#DC2626';
            ctx.fillRect(cx - barW / 2, yTop, barW, Math.max(1, yBot - yTop));
        }

        // X labels — first, last, and every few in between
        ctx.fillStyle = '#64748B'; ctx.textAlign = 'center';
        const every = Math.max(1, Math.ceil(n / 8));
        for (let i = 0; i < n; i++) {
            if (i % every !== 0 && i !== n - 1) continue;
            ctx.fillText(months[i].label, x(i), H - PAD_B + 16);
        }
    }

    function niceStep(maxAbs) {
        if (maxAbs > 200) return 100;
        if (maxAbs > 80) return 50;
        if (maxAbs > 40) return 20;
        if (maxAbs > 20) return 10;
        if (maxAbs > 8) return 5;
        if (maxAbs > 4) return 2;
        return 1;
    }

    function renderTimeframeMeta(s, sliceLen) {
        const el = document.getElementById('dashTimeframeMeta');
        if (!el) return;
        if (!s || !sliceLen) {
            el.textContent = tfLabel(currentTf) + ' · no trades in window';
            return;
        }
        const fmt = function (d) { return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; };
        el.innerHTML = '<strong>' + tfLabel(currentTf) + '</strong> · ' + sliceLen + ' of ' + TRADES.length + ' trades · ' + fmt(s.firstTs) + ' → ' + fmt(s.lastTs);
    }

    function renderMeta() {
        const meta = document.getElementById('dashMeta');
        const updated = META.last_updated ? new Date(META.last_updated).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
        const hist = TRADES.filter(function (t) { return t.period === 'historical'; }).length;
        const live = TRADES.filter(function (t) { return t.period === 'pre_reg'; }).length;
        const parts = [];
        if (hist > 0) parts.push('<span class="dash-meta-period dash-meta-period--hist">' + hist + ' historical</span>');
        parts.push('<span class="dash-meta-period dash-meta-period--live">' + live + ' pre-reg live</span>');
        meta.innerHTML = (META.dataset_label || 'Dataset') + ' · <strong>Last updated:</strong> ' + updated + '<br>' + parts.join(' · ');
    }

    function renderKpis(s) {
        const k = document.getElementById('dashKpis');
        const totalDollars = (s.total * 50).toLocaleString('en-US', { maximumFractionDigits: 0 });
        const streakLabel = s.currentStreak === 0
            ? 'flat'
            : (s.currentStreak > 0 ? s.currentStreak + ' W' : Math.abs(s.currentStreak) + ' L');
        const streakMood = s.currentStreak > 0 ? 'pos' : s.currentStreak < 0 ? 'neg' : null;
        const recoveryStr = isFinite(s.recovery) ? s.recovery.toFixed(2) + 'x' : '∞';
        const wlStr = isFinite(s.wlRatio) ? s.wlRatio.toFixed(2) : '∞';

        // R-Expectancy formatting
        const rExpStr = (s.rExp >= 0 ? '+' : '') + s.rExp.toFixed(2) + 'R';
        // Annual R formatting
        let annualRStr, annualRSub, annualRMood;
        if (s.annualR === null || !isFinite(s.annualR)) {
            annualRStr = '—';
            annualRSub = 'need >1 trade with span';
            annualRMood = null;
        } else {
            annualRStr = (s.annualR >= 0 ? '+' : '') + s.annualR.toFixed(1) + 'R/yr';
            const daysCovered = Math.max(1, Math.round(s.annualRDaysCovered));
            const totalRStr = (s.totalR >= 0 ? '+' : '') + s.totalR.toFixed(1) + 'R';
            if (daysCovered < 30) {
                annualRSub = 'short window · ' + daysCovered + 'd · total ' + totalRStr;
            } else if (s.yearsElapsed >= 1) {
                annualRSub = 'over ' + s.yearsElapsed.toFixed(1) + ' yrs · total ' + totalRStr;
            } else {
                annualRSub = 'annualized · ' + daysCovered + 'd · total ' + totalRStr;
            }
            annualRMood = s.annualR >= 0 ? 'pos' : 'neg';
        }
        // Trades-to-recover formatting
        let recovVal, recovSub, recovMood;
        if (s.recoveryTrades !== null) {
            recovVal = s.recoveryTrades + ' trades';
            recovSub = 'trough → peak reclaim';
            recovMood = 'pos';
        } else if (s.recoveryInProgress > 0) {
            recovVal = 'In progress';
            recovSub = s.recoveryInProgress + ' trades since trough';
            recovMood = 'neg';
        } else {
            recovVal = '—';
            recovSub = 'no drawdown yet';
            recovMood = null;
        }

        const kpis = [
            // Row 1 — return / throughput
            { label: 'Total trades',  val: String(s.n),                       sub: s.wins + ' W · ' + s.losses + ' L · ' + s.be + ' BE' },
            { label: 'Win rate',      val: (s.winRate*100).toFixed(1) + '%',  sub: 'excl. BE' },
            { label: 'EV / trade',    val: (s.evMean>=0?'+':'') + s.evMean.toFixed(2) + ' pts', sub: '$' + Math.round(s.evMean*50).toLocaleString() + ' / ctr', mood: s.evMean>=0?'pos':'neg' },
            { label: 'Profit Factor', val: isFinite(s.pf) ? s.pf.toFixed(2) : '∞', sub: 'gross W / gross L', mood: s.pf>=1.5?'pos':'neg' },
            { label: 'Total P&L',     val: (s.total>=0?'+':'') + s.total.toFixed(0) + ' pts', sub: '$' + totalDollars + ' / ctr', mood: s.total>=0?'pos':'neg' },
            { label: 'Max DD',        val: s.maxDD.toFixed(1) + ' pts',       sub: 'cur: ' + s.curDD.toFixed(1) + ' pts', mood: 'neg' },
            // Row 2 — distribution / quality
            { label: 'Avg win',       val: '+' + s.avgWin.toFixed(2) + ' pts',  sub: 'over ' + s.wins + ' winners', mood: 'pos' },
            { label: 'Avg loss',      val: '−' + s.avgLoss.toFixed(2) + ' pts', sub: 'over ' + s.losses + ' losers', mood: 'neg' },
            { label: 'W/L ratio',     val: wlStr,                              sub: 'avg win ÷ avg loss', mood: s.wlRatio>=1?'pos':'neg' },
            { label: 'Best trade',    val: '+' + s.best.toFixed(2) + ' pts',    sub: 'single best', mood: 'pos' },
            { label: 'Worst trade',   val:       s.worst.toFixed(2) + ' pts',   sub: 'single worst', mood: 'neg' },
            { label: 'R-Expectancy',  val: rExpStr,                             sub: 'EV ÷ avg loss · 1R units', mood: s.rExp>=0.2?'pos':'neg' },
            // Row 3 — durability & throughput
            { label: 'Max loss streak', val: s.maxStreak + ' in a row',         sub: 'longest consecutive losses', mood: s.maxStreak<=7?'pos':'neg' },
            { label: 'Trades to recover', val: recovVal,                        sub: recovSub, mood: recovMood },
            { label: 'Annual R',       val: annualRStr,                          sub: annualRSub, mood: annualRMood },
            { label: 'Current streak', val: streakLabel,                        sub: 'consecutive', mood: streakMood }
        ];
        k.innerHTML = kpis.map(function (x) {
            const moodClass = x.mood ? ' kpi--' + x.mood : '';
            return '<div class="kpi' + moodClass + '">'
                 + '<p class="kpi__label">' + x.label + '</p>'
                 + '<p class="kpi__value">' + x.val + '</p>'
                 + '<p class="kpi__sub">' + x.sub + '</p>'
                 + '</div>';
        }).join('');
    }

    function renderBattery(s) {
        const wrap = document.querySelector('.dash-battery');
        const verdict = document.getElementById('dashBatteryVerdict');
        const grid = document.getElementById('dashBatteryGrid');
        const BATTERY_MIN_N = 30;
        if (!s || s.n < BATTERY_MIN_N) {
            wrap.classList.add('is-pending');
            wrap.classList.remove('is-fail');
            verdict.textContent = 'Activates at ' + BATTERY_MIN_N + '+ trades';
            grid.innerHTML = '<p style="font-size:13px;color:var(--slate);grid-column:1/-1;margin:0">The 8-test sustainability battery is a statistical claim about the entire dataset. With <strong>n = ' + (s ? s.n : 0) + '</strong> trades the sample is too small for meaningful inference. The battery returns when the live record reaches ' + BATTERY_MIN_N + '+ closed trades.</p>';
            return;
        }
        wrap.classList.remove('is-pending');
        const results = battery(s);
        const passed = results.filter(function (r) { return r.pass; }).length;
        verdict.textContent = passed + ' / 8 ' + (passed === 8 ? 'PASS' : passed >= 6 ? 'PARTIAL' : 'FAIL');
        wrap.classList.toggle('is-fail', passed < 8);

        grid.innerHTML = results.map(function (r) {
            return '<div class="tpill' + (r.pass ? '' : ' is-fail') + '">'
                 + '<span class="tpill__name">' + r.name + '</span>'
                 + '<span class="tpill__val">' + r.val + '</span>'
                 + '</div>';
        }).join('');
    }

    function drawEquityCurve(s) {
        const canvas = document.getElementById('dashEquityCurve');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.clientWidth || 1100;
        const H = canvas.clientHeight || 320;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        const eq = s.equity;
        const min = Math.min.apply(null, eq);
        const max = Math.max.apply(null, eq);
        const PAD_L = 64, PAD_R = 80, PAD_T = 20, PAD_B = 40;   // extra right pad for $ axis
        const xStep = (W - PAD_L - PAD_R) / Math.max(1, eq.length - 1);
        const yScale = (H - PAD_T - PAD_B) / (max - min || 1);

        // Compact $ formatter: 1,234 -> 1.2k, 28,250 -> 28.3k, 1,250,000 -> 1.25M
        function fmtDollars(d) {
            const sign = d < 0 ? '-' : '+';
            const a = Math.abs(d);
            if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
            if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(a >= 1e4 ? 1 : 2) + 'k';
            return sign + '$' + a.toFixed(0);
        }

        // grid + dual-axis labels: /ES points on the left, $ per contract on the right
        ctx.strokeStyle = 'rgba(27, 42, 74, 0.06)'; ctx.lineWidth = 1;
        ctx.font = '11px "Source Sans 3", sans-serif';
        for (let g = 0; g <= 4; g++) {
            const v = min + (max - min) * g / 4;
            const y = PAD_T + (max - v) * yScale;
            ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
            // Left axis: points (navy)
            ctx.fillStyle = '#1B2A4A';
            ctx.textAlign = 'right';
            ctx.fillText((v>=0?'+':'') + v.toFixed(0) + ' pts', PAD_L - 8, y + 4);
            // Right axis: dollars per /ES contract (gold-deep)
            ctx.fillStyle = '#A88A38';
            ctx.textAlign = 'left';
            ctx.fillText(fmtDollars(v * 50), W - PAD_R + 8, y + 4);
        }
        ctx.textAlign = 'left';
        // Axis legends
        ctx.fillStyle = '#1B2A4A'; ctx.font = '10px "Source Sans 3", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('/ES pts', PAD_L - 8, PAD_T - 6);
        ctx.fillStyle = '#A88A38';
        ctx.textAlign = 'left';
        ctx.fillText('$ / contract', W - PAD_R + 8, PAD_T - 6);
        ctx.textAlign = 'left';
        ctx.font = '11px "Source Sans 3", sans-serif';
        // zero line
        if (min < 0 && max > 0) {
            const yZero = PAD_T + (max) * yScale;
            ctx.strokeStyle = 'rgba(27, 42, 74, 0.3)'; ctx.setLineDash([4,4]);
            ctx.beginPath(); ctx.moveTo(PAD_L, yZero); ctx.lineTo(W - PAD_R, yZero); ctx.stroke();
            ctx.setLineDash([]);
        }

        // Find boundary between historical and pre-reg trades on the eq array
        const histCount = s.chrono.filter(function (t) { return t.period === 'historical'; }).length;
        const liveCount = s.chrono.length - histCount;
        const gapStartIdx = histCount; // eq[histCount] = last historical equity point
        const gapEndIdx   = histCount; // same point — gap is a band between historical end and pre-reg start

        // Area fill (historical)
        ctx.fillStyle = 'rgba(45, 80, 22, 0.10)';
        ctx.beginPath();
        ctx.moveTo(PAD_L, H - PAD_B);
        for (let i = 0; i <= histCount; i++) ctx.lineTo(PAD_L + i * xStep, PAD_T + (max - eq[i]) * yScale);
        ctx.lineTo(PAD_L + histCount * xStep, H - PAD_B);
        ctx.closePath(); ctx.fill();

        // Area fill (pre-reg) — gold
        if (liveCount > 0) {
            ctx.fillStyle = 'rgba(200, 169, 81, 0.18)';
            ctx.beginPath();
            ctx.moveTo(PAD_L + histCount * xStep, H - PAD_B);
            for (let i = histCount; i < eq.length; i++) ctx.lineTo(PAD_L + i * xStep, PAD_T + (max - eq[i]) * yScale);
            ctx.lineTo(PAD_L + (eq.length - 1) * xStep, H - PAD_B);
            ctx.closePath(); ctx.fill();
        }

        // Gap separator — vertical dashed line + label
        if (liveCount > 0) {
            const xGap = PAD_L + histCount * xStep;
            ctx.strokeStyle = 'rgba(200, 169, 81, 0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
            ctx.beginPath(); ctx.moveTo(xGap, PAD_T); ctx.lineTo(xGap, H - PAD_B); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#A88A38'; ctx.font = 'bold 10px "Source Sans 3", sans-serif';
            ctx.fillText('PRE-REG RESTART', xGap + 6, PAD_T + 14);
        }

        // Curve line — historical segment (navy)
        ctx.strokeStyle = '#1B2A4A'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= histCount; i++) {
            const x = PAD_L + i * xStep, y = PAD_T + (max - eq[i]) * yScale;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        // Pre-reg segment (gold)
        if (liveCount > 0) {
            ctx.strokeStyle = '#A88A38'; ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let i = histCount; i < eq.length; i++) {
                const x = PAD_L + i * xStep, y = PAD_T + (max - eq[i]) * yScale;
                if (i === histCount) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        const endPts = eq[eq.length-1];
        const fmtUSD = function (d) { return d.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }); };
        document.getElementById('dashChartSub').innerHTML =
              eq.length + ' trades · '
            + 'ending <strong>' + (endPts>=0?'+':'') + endPts.toFixed(0) + ' pts</strong> '
            + '<span style="color:var(--gold-deep)">(' + fmtUSD(endPts * 50) + ' / ctr)</span> · '
            + 'peak +' + max.toFixed(0) + ' pts <span style="color:var(--gold-deep)">(' + fmtUSD(max * 50) + ')</span> · '
            + 'trough ' + min.toFixed(0) + ' pts <span style="color:var(--gold-deep)">(' + fmtUSD(min * 50) + ')</span>';
    }

    function renderTable() {
        const body = document.getElementById('dashTableBody');
        body.innerHTML = filteredTrades.map(function (t) {
            const date = new Date(t.timestamp).toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' });
            const ptsClass = t.pts > 0 ? 'pos' : t.pts < 0 ? 'neg' : 'zero';
            const ptsStr = (t.pts >= 0 ? '+' : '') + t.pts.toFixed(2);
            const dollars = Math.round(t.pts * 50);
            const dollarStr = (dollars >= 0 ? '+$' : '-$') + Math.abs(dollars).toLocaleString();
            return '<tr>'
                 + '<td>' + t.id + '</td>'
                 + '<td>' + date + '</td>'
                 + '<td>' + (t.symbol || '/ES') + '</td>'
                 + '<td>' + (t.side || '—') + '</td>'
                 + '<td>' + t.result + '</td>'
                 + '<td class="num ' + ptsClass + '">' + ptsStr + '</td>'
                 + '<td class="num ' + ptsClass + '">' + dollarStr + '</td>'
                 + '<td><span class="tag tag--' + (t.tag || 'H3') + '">' + (t.tag || 'H3') + '</span></td>'
                 + '</tr>';
        }).join('');
        document.getElementById('dashTableCount').textContent = 'Showing ' + filteredTrades.length + ' of ' + TRADES.length + ' trades';
    }

    /* ---------- Filters ---------- */
    function applyFilters() {
        const res = document.getElementById('dashFilterResult').value;
        const side = document.getElementById('dashFilterSide').value;
        const q = (document.getElementById('dashSearch').value || '').toLowerCase().trim();
        const tfSlice = tfFilter(TRADES, currentTf);
        filteredTrades = tfSlice.filter(function (t) {
            if (res && t.result !== res) return false;
            if (side && t.side !== side) return false;
            if (q) {
                const hay = (String(t.id) + ' ' + (t.symbol||'') + ' ' + (t.tag||'') + ' ' + t.timestamp).toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });
        renderTable();
    }
    ['dashFilterResult','dashFilterSide','dashSearch'].forEach(function (id) {
        document.getElementById(id).addEventListener('input', applyFilters);
    });

    /* ---------- Timeframe chips ---------- */
    document.querySelectorAll('#dashTimeframe .tf-chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
            currentTf = btn.getAttribute('data-tf') || 'all';
            document.querySelectorAll('#dashTimeframe .tf-chip').forEach(function (b) {
                b.classList.toggle('is-active', b === btn);
            });
            render();
        });
    });

    /* ---------- CSV export ---------- */
    document.getElementById('dashExportCsv').addEventListener('click', function () {
        const header = ['id','timestamp','symbol','side','result','pts','dollars','tag'];
        const lines = [header.join(',')];
        filteredTrades.forEach(function (t) {
            lines.push([t.id, t.timestamp, t.symbol||'/ES', t.side||'', t.result, t.pts, t.dollars, t.tag||'H3'].join(','));
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'ekantik-500-trades-export.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });

    window.addEventListener('resize', function () {
        const s = compute(tfFilter(TRADES, currentTf));
        if (s) drawEquityCurve(s);
    });
})();
