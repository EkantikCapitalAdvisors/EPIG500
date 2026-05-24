/* ================================================
   EKANTIK 500 — Live Dashboard
   Loads /data/trades.json and renders KPIs, equity curve, battery, trade table.
   ================================================ */
(function () {
    'use strict';

    let TRADES = [];
    let META = {};
    let filteredTrades = [];

    fetch('data/trades.json', { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (json) {
            TRADES = (json.trades || []).slice();
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

        // Streak
        let maxStreak = 0, cur = 0;
        for (let i = 0; i < chrono.length; i++) {
            if (chrono[i].pts < 0) { cur++; if (cur > maxStreak) maxStreak = cur; } else { cur = 0; }
        }

        return {
            n: n, wins: wins.length, losses: losses.length, be: be.length,
            winRate: winRate, evMean: evMean, total: total, pf: pf,
            avgWin: avgWin, avgLoss: avgLoss, grossWin: grossWin, grossLoss: grossLoss,
            equity: eq, chrono: chrono, maxDD: maxDD, curDD: curDD, maxStreak: maxStreak
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

    /* ---------- Render ---------- */
    function render() {
        const s = compute(TRADES);
        if (!s) return;
        renderMeta();
        renderKpis(s);
        renderBattery(s);
        drawEquityCurve(s);
        renderTable();
    }

    function renderMeta() {
        const meta = document.getElementById('dashMeta');
        const updated = META.last_updated ? new Date(META.last_updated).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
        meta.innerHTML = (META.dataset_label || 'Dataset') + ' · ' + (META.dataset_range || '') + ' · <strong>Last updated:</strong> ' + updated + ' · <strong>' + TRADES.length + '</strong> total trades';
    }

    function renderKpis(s) {
        const k = document.getElementById('dashKpis');
        const totalDollars = (s.total * 50).toLocaleString('en-US', { maximumFractionDigits: 0 });
        const kpis = [
            { label: 'Total trades',  val: String(s.n),                       sub: s.wins + ' W · ' + s.losses + ' L · ' + s.be + ' BE' },
            { label: 'Win rate',      val: (s.winRate*100).toFixed(1) + '%',  sub: 'excl. BE' },
            { label: 'EV / trade',    val: (s.evMean>=0?'+':'') + s.evMean.toFixed(2) + ' pts', sub: '($' + Math.round(s.evMean*50).toLocaleString() + ' / contract)', mood: s.evMean>=0?'pos':'neg' },
            { label: 'Profit Factor', val: isFinite(s.pf) ? s.pf.toFixed(2) : '∞', sub: 'wins/losses', mood: s.pf>=1.5?'pos':'neg' },
            { label: 'Total P&L',     val: (s.total>=0?'+':'') + s.total.toFixed(0) + ' pts', sub: '$' + totalDollars + ' / contract', mood: s.total>=0?'pos':'neg' },
            { label: 'Max DD',        val: s.maxDD.toFixed(1) + ' pts',                sub: 'cur: ' + s.curDD.toFixed(1) + ' pts', mood: 'neg' }
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
        const results = battery(s);
        const passed = results.filter(function (r) { return r.pass; }).length;
        const verdict = document.getElementById('dashBatteryVerdict');
        const wrap = document.querySelector('.dash-battery');
        verdict.textContent = passed + ' / 8 ' + (passed === 8 ? 'PASS' : passed >= 6 ? 'PARTIAL' : 'FAIL');
        wrap.classList.toggle('is-fail', passed < 8);

        const grid = document.getElementById('dashBatteryGrid');
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
        const PAD_L = 60, PAD_R = 24, PAD_T = 20, PAD_B = 40;
        const xStep = (W - PAD_L - PAD_R) / Math.max(1, eq.length - 1);
        const yScale = (H - PAD_T - PAD_B) / (max - min || 1);

        // grid
        ctx.strokeStyle = 'rgba(27, 42, 74, 0.06)'; ctx.lineWidth = 1;
        ctx.fillStyle = '#64748B'; ctx.font = '11px "Source Sans 3", sans-serif';
        for (let g = 0; g <= 4; g++) {
            const v = min + (max - min) * g / 4;
            const y = PAD_T + (max - v) * yScale;
            ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
            ctx.fillText((v>=0?'+':'') + v.toFixed(0) + ' pts', 8, y + 4);
        }
        // zero line
        if (min < 0 && max > 0) {
            const yZero = PAD_T + (max) * yScale;
            ctx.strokeStyle = 'rgba(27, 42, 74, 0.3)'; ctx.setLineDash([4,4]);
            ctx.beginPath(); ctx.moveTo(PAD_L, yZero); ctx.lineTo(W - PAD_R, yZero); ctx.stroke();
            ctx.setLineDash([]);
        }
        // area
        ctx.fillStyle = 'rgba(200, 169, 81, 0.15)';
        ctx.beginPath();
        ctx.moveTo(PAD_L, H - PAD_B);
        for (let i = 0; i < eq.length; i++) ctx.lineTo(PAD_L + i * xStep, PAD_T + (max - eq[i]) * yScale);
        ctx.lineTo(PAD_L + (eq.length - 1) * xStep, H - PAD_B);
        ctx.closePath(); ctx.fill();
        // line
        ctx.strokeStyle = '#1B2A4A'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < eq.length; i++) {
            const x = PAD_L + i * xStep, y = PAD_T + (max - eq[i]) * yScale;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        document.getElementById('dashChartSub').textContent = eq.length + ' trades · ending +' + eq[eq.length-1].toFixed(0) + ' pts · peak +' + max.toFixed(0) + ' · trough ' + min.toFixed(0);
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
        filteredTrades = TRADES.filter(function (t) {
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
        const s = compute(TRADES);
        if (s) drawEquityCurve(s);
    });
})();
