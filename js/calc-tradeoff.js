/* ================================================
   Calculator 3 — "The Honest Trade-off"
   (Volatility Opportunity vs Lag Explorer) · Spec §3.
   MODEL NOTE (v2, 2026-06-13): lags are FRACTIONS
   of the correction depth — g·D given back from
   the peak, m·D missed off the rebound. Sign of
   Adv is depth-independent; the depth amplifies
   magnitude only. Break-even is the depth-free
   line g + m = 1. See calc-core.js for derivation.
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

    // g and m are now FRACTIONS of D (0–100%). g=20 means "exited after
    // giving back 20% of the correction depth"; m=10 means "re-entered
    // after 10% of the rebound was missed."
    const DEF = { D: 20, g: 25, m: 25, N: 2, R: 20, K: 1, W: 3 };
    const PRESETS = {
        mechanical: { label: 'Mechanical overlay', D: 20, g: 60, m: 60, N: 2, R: 20, K: 1, W: 3,
            note: 'Trigger-based: laggy exit (60% of correction given back) and laggy re-entry (60% of rebound missed). Sum > 100% → re-entry above exit → whipsaw. All three honest negatives apply.' },
        ekantik:    { label: 'Operator style (discretionary)', D: 20, g: 0,  m: 0,  N: 2, R: 20, K: 0, W: 3,
            note: 'Exit at highs (catch 100% of correction down), re-enter at the low (catch 100% of rebound up), no mid-trade stops. Whipsaw impossible; whiplash zero. The false alarm is the only remaining honest negative.' }
    };
    const D_MIN = 0.05, D_MAX = 0.55;

    root.innerHTML = [
        '<div class="to-presets" role="radiogroup" aria-label="Step-aside execution style">',
        '  <span class="to-presets__label">Execution style:</span>',
        '  <button type="button" class="to-presets__chip is-active" data-preset="mechanical" role="radio" aria-checked="true">Mechanical overlay</button>',
        '  <button type="button" class="to-presets__chip" data-preset="ekantik" role="radio" aria-checked="false">Operator style</button>',
        '  <p class="to-presets__note" id="toPresetNote" aria-live="polite">' + PRESETS.mechanical.note + '</p>',
        '</div>',
        '<div class="calc__controls to-controls">',
        '  <label class="arith-control">',
        '    <span class="arith-control__label">Correction depth <span class="calc__info" tabindex="0" aria-label="How far the round-trip drawdown goes, peak to trough to back to peak.">i</span></span>',
        '    <span class="arith-control__val">−<span id="toDVal">' + DEF.D + '</span>%</span>',
        '    <input type="range" id="toD" min="5" max="55" step="1" value="' + DEF.D + '" aria-label="Correction depth percent">',
        '    <span class="arith-control__hint">Peak → trough → back to peak. E.g. −25% = a one-quarter drawdown that fully retraces.</span>',
        '  </label>',
        '  <label class="arith-control">',
        '    <span class="arith-control__label">Exit give-back <span class="calc__info" tabindex="0" aria-label="What fraction of the correction depth you gave back before exiting. 0% = perfect exit at the peak. 100% = no exit, rode the whole drawdown down to the trough.">i</span></span>',
        '    <span class="arith-control__val"><span id="toGVal">' + DEF.g + '</span>%</span>',
        '    <input type="range" id="toG" min="0" max="100" step="5" value="' + DEF.g + '" aria-label="Exit give-back as percent of correction depth">',
        '    <span class="arith-control__hint"><strong>Fraction of the correction</strong> given back before exit. 0% = perfect exit at peak. 25% with D=10% = exit at −2.5% off peak. 100% = no exit, rode the full drawdown.</span>',
        '  </label>',
        '  <label class="arith-control">',
        '    <span class="arith-control__label">Re-entry miss <span class="calc__info" tabindex="0" aria-label="What fraction of the rebound you missed before re-entering. 0% = perfect bottom-tick re-entry. 100% = missed the whole rebound, re-entered at the prior peak.">i</span></span>',
        '    <span class="arith-control__val"><span id="toMVal">' + DEF.m + '</span>%</span>',
        '    <input type="range" id="toM" min="0" max="100" step="5" value="' + DEF.m + '" aria-label="Re-entry miss as percent of correction depth">',
        '    <span class="arith-control__hint"><strong>Fraction of the rebound</strong> missed before re-entry. 0% = bottom-tick. 25% with D=10% = re-entered after market rallied 2.5 pts off the low. 100% = missed the entire rebound, bought back at the peak.</span>',
        '  </label>',
        '</div>',
        '<p class="calc__pair" id="toHead" aria-live="polite"></p>',
        '<div class="calc__decomp" id="toDecomp" aria-live="polite"></div>',
        '<div class="calc__chart" id="toChart" role="img" aria-label="Step-aside advantage versus correction depth under fractional lags: monotonic in depth, sign set by whether exit-give-back plus re-entry-miss is under or over 100%."></div>',
        '<p class="calc__breakeven" id="toBreakeven"></p>',
        '<details class="calc-disclose"><summary>Show full analysis — annualized cumulative alpha, false-alarm cost, whiplash drag</summary>',
        '<div class="calc-disclose__body">',
        '<div class="to-annual" aria-label="Annual cumulative alpha across multiple step-aside opportunities">',
        '  <label class="arith-control to-annual__control">',
        '    <span class="arith-control__label">Step-aside opportunities / yr <span class="calc__info" tabindex="0" aria-label="How many independent round-trip drawdowns of this depth and profile the strategy catches in a year. Cumulative alpha compounds across them.">i</span></span>',
        '    <span class="arith-control__val"><span id="toNVal">' + DEF.N + '</span> / yr</span>',
        '    <input type="range" id="toN" min="0" max="6" step="1" value="' + DEF.N + '" aria-label="Step-aside opportunities per year">',
        '    <span class="arith-control__hint">Assumes each opportunity has the same depth / lag profile. Cumulative alpha = (1 + per-trip)<sup>N</sup> − 1.</span>',
        '  </label>',
        '  <div class="to-annual__readout" id="toAnnual" aria-live="polite"></div>',
        '</div>',
        '<p class="calc__verdict" id="toHonesty">Everything above assumes the correction actually arrives. Under fractional lags, sign is set by whether you caught more of the move than you missed — depth amplifies the magnitude either way. <strong>The real lag isn\'t here — it\'s below, in the false-alarm case where no correction comes at all.</strong></p>',
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
        '<div class="to-wh" aria-label="Whiplash cost: wrong-footed mid-correction">',
        '  <h4 class="to-wh__h">Whiplash — wrong-footed inside the correction</h4>',
        '  <p class="to-wh__sub">Two patterns sit between the opportunity and the false alarm: (1) you re-enter during a correction, market drops further, you bail again — selling lower than you re-bought; (2) market rebounds to highs, you re-enter at the top, then it corrects again — long into a fresh drawdown. Each whip is a sell-low / buy-high cycle that costs slippage.</p>',
        '  <div class="to-wh__sliders">',
        '    <label class="arith-control">',
        '      <span class="arith-control__label">Whip cycles per round trip <span class="calc__info" tabindex="0" aria-label="Number of extra exit/re-entry cycles inside the trade where you were wrong-footed (sold lower than your re-entry).">i</span></span>',
        '      <span class="arith-control__val"><span id="toKVal">' + DEF.K + '</span></span>',
        '      <input type="range" id="toK" min="0" max="3" step="1" value="' + DEF.K + '" aria-label="Whip cycles per round trip">',
        '      <span class="arith-control__hint">0 = clean trade. 1 = faked out once (e.g. re-entered too early). 2 = faked out twice.</span>',
        '    </label>',
        '    <label class="arith-control">',
        '      <span class="arith-control__label">Slippage per whip <span class="calc__info" tabindex="0" aria-label="Average % shrinkage of the position per whip cycle. Equals (re-entry price − exit price) / re-entry price. E.g. 3% means you sold at 100 and re-bought at ~103.">i</span></span>',
        '      <span class="arith-control__val"><span id="toWVal">' + DEF.W + '</span>%</span>',
        '      <input type="range" id="toW" min="0" max="10" step="1" value="' + DEF.W + '" aria-label="Slippage per whip percent">',
        '      <span class="arith-control__hint">Average shortfall per whip = (re-entry − exit) / re-entry. Position shrinks by this factor each cycle.</span>',
        '    </label>',
        '  </div>',
        '  <div class="to-wh__readout" id="toWhip" aria-live="polite"></div>',
        '</div>',
        '</div></details>',
        '<p class="calc__reset-row"><button type="button" class="calc__reset" id="toReset">Reset to default</button></p>'
    ].join('');

    const dEl = document.getElementById('toD'), gEl = document.getElementById('toG'), mEl = document.getElementById('toM'), nEl = document.getElementById('toN'), rEl = document.getElementById('toR'), kEl = document.getElementById('toK'), wEl = document.getElementById('toW');

    function render() {
        const D = parseInt(dEl.value, 10) / 100;
        const g = parseInt(gEl.value, 10) / 100;
        const m = parseInt(mEl.value, 10) / 100;
        const N = parseInt(nEl.value, 10);
        const R = parseInt(rEl.value, 10) / 100;
        const K = parseInt(kEl.value, 10);
        const W = parseInt(wEl.value, 10) / 100;
        document.getElementById('toDVal').textContent = Math.round(D * 100);
        document.getElementById('toGVal').textContent = Math.round(g * 100);
        document.getElementById('toMVal').textContent = Math.round(m * 100);
        document.getElementById('toNVal').textContent = N;
        document.getElementById('toRVal').textContent = Math.round(R * 100);
        document.getElementById('toKVal').textContent = K;
        document.getElementById('toWVal').textContent = Math.round(W * 100);

        const S = core.tradeoffOutcome(D, g, m);
        const advNow = S - 1;

        // Fractional-lag derived prices (per $1 starting at peak)
        const givenBackPct = g * D;                       // fraction of peak given back to exit
        const exitLevel  = 1 - givenBackPct;              // $ at exit
        const trough     = 1 - D;                         // $ at bottom
        const missedPct  = m * D;                         // fraction of peak missed on rebound
        const reentry    = 1 - D + missedPct;             // $ where you re-enter
        const recover    = reentry > 0 ? 1 / reentry : 1;
        const finalVal   = exitLevel * recover;
        const avoidedMiddle = exitLevel - trough;         // % of peak skipped in cash

        document.getElementById('toHead').innerHTML =
              '<span class="calc__pair-label">Hold-through:</span> <span class="calc__num">0.0%</span> <span class="calc__pair-label">round trip ·</span> '
            + '<span class="calc__pair-label">Step-aside:</span> <span class="calc__num" style="color:' + (advNow > 0 ? '#0D9488' : advNow < 0 ? '#E05A6B' : '#12264a') + '">' + (advNow >= 0 ? '+' : '') + (advNow * 100).toFixed(1) + '%</span>';

        // Decomposition readout — walks through the math step by step
        const decompEl = document.getElementById('toDecomp');
        const exitTagText = g === 0 ? 'perfect exit at peak' : g >= 1 ? 'no exit — rode to the trough' : 'gave back ' + (g * 100).toFixed(0) + '% of the ' + (D * 100).toFixed(0) + '% correction';
        const missTagText = m === 0 ? 'bottom-tick re-entry' : m >= 1 ? 'missed the entire rebound — re-entered at the peak' : 'missed ' + (m * 100).toFixed(0) + '% of the rebound';

        decompEl.innerHTML =
              '<p class="calc__decomp-h">Where the <span class="calc__num" style="color:' + (advNow > 0 ? '#0D9488' : advNow < 0 ? '#E05A6B' : '#12264a') + '">' + (advNow >= 0 ? '+' : '') + (advNow * 100).toFixed(1) + '%</span> comes from <span class="calc__decomp-sub">(starting from $1.000 at the peak · correction depth ' + (D * 100).toFixed(0) + '%)</span></p>'
            + '<ol class="calc__decomp-steps">'
            + '<li><strong>Exit point:</strong> ' + (g * 100).toFixed(0) + '% × ' + (D * 100).toFixed(0) + '% = ' + (givenBackPct * 100).toFixed(1) + '% given back → you exit at <strong>$' + exitLevel.toFixed(3) + '</strong>. <span class="calc__decomp-cost">(' + exitTagText + ')</span></li>'
            + '<li><strong>Sit in cash through the avoided middle:</strong> market falls from $' + exitLevel.toFixed(3) + ' to the trough at $' + trough.toFixed(3) + ' (' + (avoidedMiddle * 100).toFixed(1) + ' pts skipped). You stay flat at $' + exitLevel.toFixed(3) + '. <span class="calc__decomp-gain">(this is the <em>protection</em>)</span></li>'
            + '<li><strong>Re-entry point:</strong> ' + (m * 100).toFixed(0) + '% × ' + (D * 100).toFixed(0) + '% = ' + (missedPct * 100).toFixed(1) + '% of rebound missed → you re-enter at <strong>$' + reentry.toFixed(3) + '</strong>. <span class="calc__decomp-cost">(' + missTagText + ')</span></li>'
            + '<li><strong>Ride the recovery back to peak:</strong> $' + exitLevel.toFixed(3) + ' <span class="calc__decomp-sub">(cash from step 1)</span> × ' + recover.toFixed(3) + ' <span class="calc__decomp-sub">(peak ÷ re-entry price)</span> = <strong>$' + finalVal.toFixed(3) + '</strong>.</li>'
            + '<li><strong>Net vs hold-through ($1.000):</strong> <span class="calc__num" style="color:' + (advNow > 0 ? '#0D9488' : advNow < 0 ? '#E05A6B' : '#12264a') + '">' + (advNow >= 0 ? '+' : '') + (advNow * 100).toFixed(1) + '%</span> on the round trip.</li>'
            + '</ol>';

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

        // Whiplash: wrong-footed mid-correction (K whip cycles × W slippage each)
        const whipMult = Math.pow(1 - W, K);          // surviving fraction of the position
        const whipDrag = whipMult - 1;                  // negative
        // Combined per-trip outcome: opportunity (S) × whip survival
        const sCombined = S * whipMult;
        const advCombined = sCombined - 1;
        const annualCombined = N === 0 ? 0 : Math.pow(sCombined, N) - 1;
        const whipEl = document.getElementById('toWhip');
        function pctTxt(x) { return (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%'; }
        function colTxt(x) { return x > 0 ? '#0D9488' : x < 0 ? '#E05A6B' : '#12264a'; }
        if (K === 0 || W === 0) {
            whipEl.innerHTML =
                  '<p class="to-wh__h2">No whips → <span class="calc__num" style="color:#12264a;font-size:22px">0.0%</span> extra drag</p>'
                + '<p class="to-wh__formula">Dial up cycles and slippage to see how a wrong-footed trade compounds onto the per-trip number above.</p>';
        } else {
            whipEl.innerHTML =
                  '<p class="to-wh__h2">Whip drag this trip: <span class="calc__num" style="color:#E05A6B;font-size:22px">' + (whipDrag * 100).toFixed(1) + '%</span></p>'
                + '<p class="to-wh__formula">drag = (1 − ' + (W * 100).toFixed(0) + '%)<sup>' + K + '</sup> − 1 = (' + (1 - W).toFixed(2) + ')<sup>' + K + '</sup> − 1 = <strong>' + (whipDrag * 100).toFixed(1) + '%</strong></p>'
                + '<div class="to-wh__combined">'
                + '  <p class="to-wh__combined-h">Combined per round-trip (opportunity × whip survival):</p>'
                + '  <p class="to-wh__combined-eq">'
                + '    <span>Per-trip alpha: <strong style="color:' + colTxt(advNow) + '">' + pctTxt(advNow) + '</strong></span> '
                + '    <span class="to-wh__sep">×</span> '
                + '    <span>Whip survival: <strong>' + (whipMult).toFixed(3) + '</strong></span> '
                + '    <span class="to-wh__sep">⇒</span> '
                + '    <span>Net per-trip: <strong style="color:' + colTxt(advCombined) + ';font-size:17px">' + pctTxt(advCombined) + '</strong></span>'
                + '  </p>'
                + (N > 0
                    ? '  <p class="to-wh__combined-eq">Annual at <strong>' + N + '/yr</strong>: <strong style="color:' + colTxt(annualCombined) + ';font-size:17px">' + pctTxt(annualCombined) + '</strong> <span class="to-wh__sub-note">(was ' + pctTxt(Math.pow(S, N) - 1) + ' without whips)</span></p>'
                    : '')
                + '</div>'
                + '<p class="to-wh__synthesis"><strong>Two patterns to keep in mind:</strong> (1) <em>continuation whip</em> — you re-enter during the correction, market drops further, you sell again; (2) <em>second-leg whip</em> — market rebounds to highs, you re-enter at the top, then it corrects again. Each is one cycle here. Both cost the same arithmetically — your position shrinks by the slippage factor.</p>';
        }

        // Break-even legend — under fractional lags this is depth-independent
        const beEl = document.getElementById('toBreakeven');
        const lagSumPct = Math.round((g + m) * 100);
        const sign = (g + m) < 1 ? 'opportunity (alpha grows with depth)' : (g + m) > 1 ? 'whipsaw (drag grows with depth)' : 'exact zero alpha at any depth';
        const signColor = (g + m) < 1 ? '#0D9488' : (g + m) > 1 ? '#E05A6B' : '#12264a';
        beEl.innerHTML =
              '<span class="calc__breakeven-formula">break-even line: exit give-back + re-entry miss = 100%</span> '
            + '<span class="calc__breakeven-eq">→ your sum = ' + Math.round(g * 100) + '% + ' + Math.round(m * 100) + '% = <strong style="color:' + signColor + '">' + lagSumPct + '%</strong></span> '
            + '<span class="calc__breakeven-note">— ' + sign + '. Under fractional lags, depth amplifies magnitude only; sign is set by whether you caught more of the move than you missed.</span>';

        // Advantage curve (CW = chart width; the user-facing W slippage var is already in scope)
        const CW = 640, CH = 280, PL = 56, PR = 18, PT = 18, PB = 34;
        const pts = [];
        let aMin = 0, aMax = 0;
        for (let v = D_MIN; v <= D_MAX + 1e-9; v += 0.005) {
            const a = core.tradeoffAdv(v, g, m);
            pts.push([v, a]);
            if (a < aMin) aMin = a; if (a > aMax) aMax = a;
        }
        aMax = Math.max(aMax, 0.02) * 1.15; aMin = Math.min(aMin, -0.02) * 1.15;
        function X(v) { return PL + ((v - D_MIN) / (D_MAX - D_MIN)) * (CW - PL - PR); }
        function Y(a) { return PT + (1 - (a - aMin) / (aMax - aMin)) * (CH - PT - PB); }
        const s = [];
        // zero line + region shading
        const y0 = Y(0);
        s.push('<rect x="' + PL + '" y="' + PT + '" width="' + (CW - PL - PR) + '" height="' + (y0 - PT) + '" fill="rgba(13,148,136,0.07)"/>');
        s.push('<rect x="' + PL + '" y="' + y0 + '" width="' + (CW - PL - PR) + '" height="' + (CH - PB - y0) + '" fill="rgba(224,90,107,0.10)"/>');
        s.push('<line x1="' + PL + '" y1="' + y0 + '" x2="' + (CW - PR) + '" y2="' + y0 + '" stroke="rgba(18,38,74,0.35)" stroke-dasharray="3 3"/>');
        // axis labels
        [aMin, 0, aMax].forEach(function (a) {
            s.push('<text x="' + (PL - 6) + '" y="' + (Y(a) + 4) + '" text-anchor="end" font-size="11" fill="#64748B">' + (a >= 0 ? '+' : '') + (a * 100).toFixed(0) + '%</text>');
        });
        for (let v = 0.05; v <= 0.55 + 1e-9; v += 0.10) {
            s.push('<text x="' + X(v) + '" y="' + (CH - PB + 16) + '" text-anchor="middle" font-size="11" fill="#64748B">−' + Math.round(v * 100) + '%</text>');
        }
        // region labels: under fractional lags one regime dominates the whole chart
        const isOpp = (g + m) < 1, isWhip = (g + m) > 1;
        if (isOpp) {
            s.push('<text x="' + X(0.30) + '" y="' + Math.max(PT + 14, y0 - 10) + '" font-size="12" font-weight="700" fill="#0D9488">volatility opportunity — deeper = more alpha</text>');
        } else if (isWhip) {
            s.push('<text x="' + X(0.30) + '" y="' + Math.min(CH - PB - 8, y0 + 20) + '" font-size="12" font-weight="700" fill="#E05A6B">whipsaw — deeper = more drag (re-entry above exit)</text>');
        } else {
            s.push('<text x="' + X(0.30) + '" y="' + (y0 - 6) + '" font-size="12" font-weight="700" fill="#12264a">flat — exit equals re-entry at any depth</text>');
        }
        // advantage curve
        let path = '';
        pts.forEach(function (p, i) { path += (i ? ' L ' : 'M ') + X(p[0]) + ' ' + Y(p[1]); });
        s.push('<path d="' + path + '" fill="none" stroke="#12264a" stroke-width="2.2"/>');
        // three named walk-through callouts: mild / typical / crash
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
        callout(0.10, 'mild −10%', 'start');
        callout(0.30, 'typical −30%', 'middle');
        callout(0.50, 'crash −50%', 'end');
        // live dot at current D
        s.push('<circle cx="' + X(D) + '" cy="' + Y(advNow) + '" r="6" fill="#d4af37" stroke="#fff" stroke-width="1.5"/>');
        document.getElementById('toChart').innerHTML = '<svg viewBox="0 0 ' + CW + ' ' + CH + '" width="100%" preserveAspectRatio="xMidYMid meet">' + s.join('') + '</svg>';
    }

    let raf = false;
    function queue() {
        trackOnce();
        if (raf) return;
        raf = true;
        requestAnimationFrame(function () { raf = false; render(); });
    }
    [dEl, gEl, mEl, nEl, rEl, kEl, wEl].forEach(function (el) { el.addEventListener('input', queue); });

    function applyPreset(name) {
        const p = PRESETS[name]; if (!p) return;
        dEl.value = p.D; gEl.value = p.g; mEl.value = p.m; nEl.value = p.N;
        rEl.value = p.R; kEl.value = p.K; wEl.value = p.W;
        root.querySelectorAll('.to-presets__chip').forEach(function (c) {
            const active = c.dataset.preset === name;
            c.classList.toggle('is-active', active);
            c.setAttribute('aria-checked', String(active));
        });
        document.getElementById('toPresetNote').textContent = p.note;
        queue();
    }
    root.querySelectorAll('.to-presets__chip').forEach(function (chip) {
        chip.addEventListener('click', function () { applyPreset(chip.dataset.preset); });
    });

    document.getElementById('toReset').addEventListener('click', function () {
        applyPreset('mechanical');
    });
    render();
})();
