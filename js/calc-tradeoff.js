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

    const DEF = { D: 20, g: 25, m: 25, N: 2, R: 20 };
    const D_MIN = 0.05, D_MAX = 0.55;

    root.innerHTML = [
        '<div class="calc__controls to-controls">',
        '  <label class="arith-control">',
        '    <span class="arith-control__label">Correction depth <span class="calc__info" tabindex="0" aria-label="How far the round-trip drawdown goes, peak to trough to back to peak.">i</span></span>',
        '    <span class="arith-control__val">−<span id="toDVal">' + DEF.D + '</span>%</span>',
        '    <input type="range" id="toD" min="5" max="55" step="1" value="' + DEF.D + '" aria-label="Correction depth percent">',
        '    <span class="arith-control__hint">Peak → trough → back to peak. E.g. −25% = a one-quarter drawdown that fully retraces.</span>',
        '  </label>',
        '  <label class="arith-control">',
        '    <span class="arith-control__label">Exit give-back <span class="calc__info" tabindex="0" aria-label="Absolute index decline absorbed before the overlay step-aside trigger fires. E.g. 25% = strategy rides through a 25% drop, then exits.">i</span></span>',
        '    <span class="arith-control__val"><span id="toGVal">' + DEF.g + '</span>%</span>',
        '    <input type="range" id="toG" min="0" max="60" step="5" value="' + DEF.g + '" aria-label="Exit give-back percent of index level">',
        '    <span class="arith-control__hint"><strong>Absolute</strong> decline absorbed before exit — not a fraction of the drawdown. 25% = strategy exits at −25% off peak.</span>',
        '  </label>',
        '  <label class="arith-control">',
        '    <span class="arith-control__label">Re-entry miss <span class="calc__info" tabindex="0" aria-label="Absolute rebound off the bottom absorbed before the overlay re-entry trigger fires. E.g. 0% = perfect catch at the bottom; 10% = re-enters after market has bounced 10% off the trough.">i</span></span>',
        '    <span class="arith-control__val"><span id="toMVal">' + DEF.m + '</span>%</span>',
        '    <input type="range" id="toM" min="0" max="60" step="5" value="' + DEF.m + '" aria-label="Re-entry miss percent of index level">',
        '    <span class="arith-control__hint"><strong>Absolute</strong> rebound absorbed before re-entry. 0% = perfect catch at the bottom; 10% = re-enters 10% off the trough.</span>',
        '  </label>',
        '</div>',
        '<p class="calc__pair" id="toHead" aria-live="polite"></p>',
        '<div class="calc__decomp" id="toDecomp" aria-live="polite"></div>',
        '<div class="to-annual" aria-label="Annual cumulative alpha across multiple step-aside opportunities">',
        '  <label class="arith-control to-annual__control">',
        '    <span class="arith-control__label">Step-aside opportunities / yr <span class="calc__info" tabindex="0" aria-label="How many independent round-trip drawdowns of this depth and profile the strategy catches in a year. Cumulative alpha compounds across them.">i</span></span>',
        '    <span class="arith-control__val"><span id="toNVal">' + DEF.N + '</span> / yr</span>',
        '    <input type="range" id="toN" min="0" max="6" step="1" value="' + DEF.N + '" aria-label="Step-aside opportunities per year">',
        '    <span class="arith-control__hint">Assumes each opportunity has the same depth / lag profile. Cumulative alpha = (1 + per-trip)<sup>N</sup> − 1.</span>',
        '  </label>',
        '  <div class="to-annual__readout" id="toAnnual" aria-live="polite"></div>',
        '</div>',
        '<div class="calc__chart" id="toChart" role="img" aria-label="Step-aside advantage versus correction depth: negative in shallow corrections where the lags cost more than the protection, positive in deep ones where the avoided middle wins."></div>',
        '<p class="calc__breakeven" id="toBreakeven"></p>',
        '<p class="calc__verdict" id="toHonesty">Everything above assumes the correction actually arrives. When the lags are large relative to depth, the mechanism whipsaws; when depth dwarfs the lags and opportunities repeat, alpha compounds. <strong>But the real lag isn\'t in either of those — it\'s below.</strong></p>',
        '<div class="to-fa" aria-label="False-alarm cost: exited at highs but no correction came">',
        '  <h4 class="to-fa__h">The true lag — exited at highs, no correction came</h4>',
        '  <p class="to-fa__sub">When the step-aside fires and a drawdown <em>does</em> materialize, deep + frequent vol is an opportunity (above). When it <em>doesn\'t</em> — market just breaks out higher — being flat is the real, undeniable lag. You held cash through a rally your $1 will never buy back at the same price.</p>',
        '  <label class="arith-control to-fa__control">',
        '    <span class="arith-control__label">Missed breakout rally <span class="calc__info" tabindex="0" aria-label="How far the market rallies from your exit price before you re-enter at the new higher level. The breakout you went flat through.">i</span></span>',
        '    <span class="arith-control__val">+<span id="toRVal">' + DEF.R + '</span>%</span>',
        '    <input type="range" id="toR" min="0" max="50" step="1" value="' + DEF.R + '" aria-label="Missed breakout rally percent">',
        '    <span class="arith-control__hint">Hold-through rides the rally. You sit in cash and re-enter at the higher level — your $1 then buys fewer shares than the position you sold.</span>',
        '  </label>',
        '  <div class="to-fa__readout" id="toFalseAlarm" aria-live="polite"></div>',
        '</div>',
        '<p class="calc__reset-row"><button type="button" class="calc__reset" id="toReset">Reset to default</button></p>'
    ].join('');

    const dEl = document.getElementById('toD'), gEl = document.getElementById('toG'), mEl = document.getElementById('toM'), nEl = document.getElementById('toN'), rEl = document.getElementById('toR');

    function render() {
        const D = parseInt(dEl.value, 10) / 100;
        const g = parseInt(gEl.value, 10) / 100;
        const m = parseInt(mEl.value, 10) / 100;
        const N = parseInt(nEl.value, 10);
        const R = parseInt(rEl.value, 10) / 100;
        document.getElementById('toDVal').textContent = Math.round(D * 100);
        document.getElementById('toGVal').textContent = Math.round(g * 100);
        document.getElementById('toMVal').textContent = Math.round(m * 100);
        document.getElementById('toNVal').textContent = N;
        document.getElementById('toRVal').textContent = Math.round(R * 100);

        const S = core.tradeoffOutcome(D, g, m);
        const advNow = S - 1;
        const dStar = core.tradeoffBreakEven(g, m, D_MAX);

        const headNote = D <= g
            ? ' <span class="calc__pair-label">(a ' + Math.round(D * 100) + '% correction never reaches a ' + Math.round(g * 100) + '% give-back — the step-aside never triggers; you held through)</span>'
            : '';
        document.getElementById('toHead').innerHTML =
              '<span class="calc__pair-label">Hold-through:</span> <span class="calc__num">0.0%</span> <span class="calc__pair-label">round trip ·</span> '
            + '<span class="calc__pair-label">Step-aside:</span> <span class="calc__num" style="color:' + (advNow > 0 ? '#0D9488' : advNow < 0 ? '#E05A6B' : '#12264a') + '">' + (advNow >= 0 ? '+' : '') + (advNow * 100).toFixed(1) + '%</span>' + headNote;

        // Decomposition readout — walks through the math step by step
        const decompEl = document.getElementById('toDecomp');
        if (D <= g) {
            decompEl.innerHTML =
                  '<p class="calc__decomp-h">Why <span class="calc__num">0.0%</span>?</p>'
                + '<ol class="calc__decomp-steps">'
                + '<li>Drawdown only reaches <strong>−' + Math.round(D * 100) + '%</strong>, which is shallower than the <strong>−' + Math.round(g * 100) + '%</strong> exit trigger.</li>'
                + '<li>The step-aside <strong>never fires</strong> — you held the index through the full round trip.</li>'
                + '<li>Round trip back to peak ⇒ <strong>0.0%</strong> on both legs.</li>'
                + '</ol>';
        } else {
            const exitLevel = (1 - g);                       // $ at exit, from $1 peak
            const trough   = (1 - D);                        // $ at the bottom
            const reentry  = Math.min(1 - D + m, 1);         // $ where you re-enter
            const recover  = 1 / reentry;                    // multiple to get back to peak
            const finalVal = exitLevel * recover;            // step-aside ending $
            const avoidedMiddle = (1 - g) - (1 - D);         // % of peak you skipped in cash
            decompEl.innerHTML =
                  '<p class="calc__decomp-h">Where the <span class="calc__num" style="color:' + (advNow > 0 ? '#0D9488' : advNow < 0 ? '#E05A6B' : '#12264a') + '">' + (advNow >= 0 ? '+' : '') + (advNow * 100).toFixed(1) + '%</span> comes from <span class="calc__decomp-sub">(starting from $1.000 at the peak)</span></p>'
                + '<ol class="calc__decomp-steps">'
                + '<li><strong>Ride down to the exit trigger:</strong> market drops to −' + Math.round(g * 100) + '% → you exit at <strong>$' + exitLevel.toFixed(3) + '</strong>. <span class="calc__decomp-cost">(this is the <em>exit lag</em> — −' + (g * 100).toFixed(0) + '% paid)</span></li>'
                + '<li><strong>Sit in cash through the avoided middle:</strong> market falls another ' + (avoidedMiddle * 100).toFixed(0) + ' pts (−' + Math.round(g * 100) + '% → −' + Math.round(D * 100) + '%), you stay flat at $' + exitLevel.toFixed(3) + '. <span class="calc__decomp-gain">(this is the <em>protection</em>)</span></li>'
                + '<li><strong>Re-enter after the bounce:</strong> market troughs at $' + trough.toFixed(3) + ', rebounds ' + (m * 100).toFixed(0) + ' pts, you re-enter at <strong>$' + reentry.toFixed(3) + '</strong>. <span class="calc__decomp-cost">(this is the <em>re-entry miss</em> — ' + (m * 100).toFixed(0) + '% paid)</span></li>'
                + '<li><strong>Ride the recovery back to peak:</strong> $' + exitLevel.toFixed(3) + ' <span class="calc__decomp-sub">(cash from step 1)</span> × ' + recover.toFixed(3) + ' <span class="calc__decomp-sub">(peak ÷ re-entry price)</span> = <strong>$' + finalVal.toFixed(3) + '</strong>.</li>'
                + '<li><strong>Net vs hold-through ($1.000):</strong> <span class="calc__num" style="color:' + (advNow > 0 ? '#0D9488' : advNow < 0 ? '#E05A6B' : '#12264a') + '">' + (advNow >= 0 ? '+' : '') + (advNow * 100).toFixed(1) + '%</span> on the round trip.</li>'
                + '</ol>';
        }

        // Annual cumulative alpha — compounding N identical step-aside trips per year
        const annEl = document.getElementById('toAnnual');
        function fmtPct(x) { return (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%'; }
        function colorFor(x) { return x > 0 ? '#0D9488' : x < 0 ? '#E05A6B' : '#12264a'; }
        const annual = N === 0 ? 0 : Math.pow(S, N) - 1;
        const ladder = [1, 2, 3, 4, 5, 6].map(function (k) {
            const v = Math.pow(S, k) - 1;
            const active = k === N;
            return '<div class="to-annual__cell' + (active ? ' is-active' : '') + '">'
                 + '<span class="to-annual__k">' + k + '/yr</span>'
                 + '<span class="to-annual__v" style="color:' + colorFor(v) + '">' + fmtPct(v) + '</span></div>';
        }).join('');
        annEl.innerHTML =
              '<p class="to-annual__h">'
            + '<span>Per round-trip: <strong style="color:' + colorFor(advNow) + '">' + fmtPct(advNow) + '</strong></span> '
            + '<span class="to-annual__sep">×</span> '
            + '<span><strong>' + N + '</strong> opportunities</span> '
            + '<span class="to-annual__sep">⇒</span> '
            + '<span>Annual alpha: <strong style="color:' + colorFor(annual) + ';font-size:18px">' + fmtPct(annual) + '</strong></span>'
            + '</p>'
            + '<p class="to-annual__formula">' + (advNow === 0
                ? 'Lags exactly cancel protection — compounding zero gives zero, no matter how many opportunities.'
                : '(1 ' + (advNow >= 0 ? '+ ' : '− ') + Math.abs(advNow * 100).toFixed(1) + '%)<sup>' + N + '</sup> − 1 = ' + fmtPct(annual))
            + '</p>'
            + '<div class="to-annual__ladder" aria-label="Cumulative alpha at 1 through 6 opportunities per year">' + ladder + '</div>'
            + '<p class="to-annual__caveat"><em>Upper bound:</em> assumes every opportunity has the same depth / lag profile and that lags compound independently. Real years vary — some give one opportunity, some give none, some give an opportunity the strategy mis-times.</p>';

        // False-alarm cost: exited at highs but no correction came
        const faEl = document.getElementById('toFalseAlarm');
        const faDrag = R === 0 ? 0 : -R / (1 + R);
        const holdVal = 1 + R;
        const sharesAfterReentry = 1 / holdVal;             // $1 cash buys this many shares at the new high
        // Ladder of common breakout sizes for context
        const faLadder = [0.05, 0.10, 0.20, 0.30, 0.50].map(function (r) {
            const drag = r === 0 ? 0 : -r / (1 + r);
            const active = Math.abs(r - R) < 0.005;
            return '<div class="to-fa__cell' + (active ? ' is-active' : '') + '">'
                 + '<span class="to-fa__k">+' + Math.round(r * 100) + '%</span>'
                 + '<span class="to-fa__v">' + (drag * 100).toFixed(1) + '%</span></div>';
        }).join('');
        if (R === 0) {
            faEl.innerHTML =
                  '<p class="to-fa__h2">No missed rally → <span class="calc__num" style="color:#12264a;font-size:22px">0.0%</span> drag</p>'
                + '<p class="to-fa__formula">Exit and re-entry at the same price means the false alarm cost nothing — slide right to see what a real missed breakout costs.</p>'
                + '<div class="to-fa__ladder" aria-label="False-alarm drag at common breakout sizes">' + faLadder + '</div>';
        } else {
            faEl.innerHTML =
                  '<p class="to-fa__h2">False-alarm drag: <span class="calc__num" style="color:#E05A6B;font-size:22px">' + (faDrag * 100).toFixed(1) + '%</span></p>'
                + '<ol class="calc__decomp-steps">'
                + '<li><strong>Exit at peak:</strong> $1.000 cash.</li>'
                + '<li><strong>Market breaks out — no correction:</strong> rallies +' + Math.round(R * 100) + '%. Hold-through compounds to <strong>$' + holdVal.toFixed(3) + '</strong>. You\'re still at $1.000.</li>'
                + '<li><strong>Re-enter at the new high ($' + holdVal.toFixed(3) + '):</strong> your $1.000 buys <strong>' + sharesAfterReentry.toFixed(3) + ' shares</strong>.</li>'
                + '<li><strong>Net vs hold-through:</strong> $1.000 / $' + holdVal.toFixed(3) + ' − 1 = <span style="color:#E05A6B;font-weight:700">' + (faDrag * 100).toFixed(1) + '%</span>. The rally is permanently lost — every dollar you reinvest now buys ' + (R * 100).toFixed(0) + '% fewer shares than the position you sold.</li>'
                + '</ol>'
                + '<p class="to-fa__formula">drag = −R / (1 + R) = −' + Math.round(R * 100) + '% / ' + holdVal.toFixed(2) + ' = <strong>' + (faDrag * 100).toFixed(1) + '%</strong></p>'
                + '<div class="to-fa__ladder" aria-label="False-alarm drag at common breakout sizes">' + faLadder + '</div>'
                + '<p class="to-fa__synthesis"><strong>The honest picture:</strong> a defensive exit is a coin flip on regime. If the correction comes, the math above (volatility opportunity) applies. If it doesn\'t, this drag does. Expected value depends on how often the call is right — which is exactly what the <a href="/falsifiability-protocol.html" target="_blank" rel="noopener">Expression Layer gate</a> measures.</p>';
        }

        // Break-even formula legend
        const beEl = document.getElementById('toBreakeven');
        const dStarPct = Math.round((g + m) * 100);
        beEl.innerHTML =
              '<span class="calc__breakeven-formula">break-even depth = exit give-back + re-entry miss</span> '
            + '<span class="calc__breakeven-eq">= ' + Math.round(g * 100) + '% + ' + Math.round(m * 100) + '% = <strong>' + dStarPct + '%</strong></span> '
            + '<span class="calc__breakeven-note">— shallower than this and the lags cost more than the protection; deeper and the avoided middle wins.</span>';

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
        // three named walk-through callouts: mild / break-even / crash
        function callout(vDepth, label, anchor) {
            const a = core.tradeoffAdv(vDepth, g, m);
            const cx = X(vDepth), cy = Y(a);
            s.push('<circle cx="' + cx + '" cy="' + cy + '" r="3.5" fill="#12264a" stroke="#fff" stroke-width="1"/>');
            const above = a >= 0;
            const ty = above ? (cy - 10) : (cy + 18);
            const tAnchor = anchor || 'middle';
            const tx = tAnchor === 'start' ? cx + 6 : tAnchor === 'end' ? cx - 6 : cx;
            s.push('<text x="' + tx + '" y="' + ty + '" text-anchor="' + tAnchor + '" font-size="10.5" font-weight="600" fill="#12264a">' + label + ' <tspan fill="#64748B" font-weight="400">(' + (a >= 0 ? '+' : '') + (a * 100).toFixed(1) + '%)</tspan></text>');
        }
        callout(0.10, 'mild correction', 'start');
        if (dStar !== null && dStar >= D_MIN + 0.03 && dStar <= D_MAX - 0.03) {
            callout(dStar, 'break-even', 'middle');
        }
        callout(0.50, 'crash', 'end');
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
    [dEl, gEl, mEl, nEl, rEl].forEach(function (el) { el.addEventListener('input', queue); });
    document.getElementById('toReset').addEventListener('click', function () {
        dEl.value = DEF.D; gEl.value = DEF.g; mEl.value = DEF.m; nEl.value = DEF.N; rEl.value = DEF.R; queue();
    });
    render();
})();
