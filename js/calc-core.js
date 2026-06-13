/* ================================================
   EPIG 500 — Calculator Suite · shared pure math
   (Calculator Spec v1.0 §1.2 / §2.2 / §3.2 / §4.2)
   UMD: browser (window.EPIG_CALC_CORE) + node (tests).
   No DOM, no state — pure functions only.
   ================================================ */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.EPIG_CALC_CORE = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /* ---------- Calculator 1 — The Repair Bill (§1.2) ----------
       R(d) = d / (1 − d): the gain required to repair a loss d.   */
    function repairRequired(d) { return d / (1 - d); }
    function repair(d) {
        const R = repairRequired(d);
        const dHalf = d / 2;
        const RHalf = repairRequired(dHalf);
        return {
            d: d, R: R, dHalf: dHalf, RHalf: RHalf,
            savedPP: R - RHalf,            // repair-bill points saved by halving the loss
            ratio: R / RHalf,              // "×N.N"
            cutPct: (R - RHalf) / R        // fraction of the repair bill removed
        };
    }

    /* ---------- Calculator 2 — The Volatility Tax (§2.2) ----------
       Downside participation p scales ONLY negative years.          */
    function adjustSeries(returns, p) {
        return returns.map(function (r) { return r < 0 ? p * r : r; });
    }
    function arithMean(rs) {
        return rs.reduce(function (a, b) { return a + b; }, 0) / rs.length;
    }
    function geomMean(rs) {
        const prod = rs.reduce(function (a, r) { return a * (1 + r); }, 1);
        return Math.pow(prod, 1 / rs.length) - 1;
    }
    function volTax(returns, p) {
        const adj = adjustSeries(returns, p);
        const A = arithMean(adj);
        const G = geomMean(adj);
        let w = 100000;
        const wealthPath = [w];
        adj.forEach(function (r) { w *= (1 + r); wealthPath.push(w); });
        return { A: A, G: G, T: A - G, wealth: w, wealthPath: wealthPath, adjusted: adj };
    }
    /* Paste-your-own parser: comma/space/newline separated %, max 50,
       each in [−95, +200]; reports the first invalid token (§2.1).   */
    function parseReturnSeries(text) {
        const tokens = String(text).split(/[\s,;]+/).filter(function (t) { return t.length > 0; });
        if (tokens.length === 0) return { ok: false, error: 'No values found.' };
        if (tokens.length > 50) return { ok: false, error: 'Too many values (max 50).' };
        const values = [];
        for (let i = 0; i < tokens.length; i++) {
            const cleaned = tokens[i].replace(/%$/, '').replace(/^\+/, '').replace(/−/g, '-');
            const v = Number(cleaned);
            if (!isFinite(v)) return { ok: false, error: 'Invalid value: "' + tokens[i] + '"' };
            if (v < -95 || v > 200) return { ok: false, error: 'Out of range (−95%..+200%): "' + tokens[i] + '"' };
            values.push(v / 100);
        }
        return { ok: true, values: values };
    }

    /* ---------- Calculator 3 — The Honest Trade-off (§3.2) ----------
       MODEL NOTE (documented deviation): the spec drafts the lags as
       fractions of the decline: S = (1 − g·D) / (1 − D·(1 − m)).
       Closed form of its sign: Adv = D·(1 − m − g) / (1 − D·(1 − m)),
       FRACTIONAL-LAG MODEL (v2, 2026-06-13). g and m are fractions
       of the correction depth D — exit after g·D given back from the
       peak; re-enter after m·D rebound above the trough. This matches
       discretionary execution semantics (operator thinks in terms of
       "what % of the move did I catch", not absolute index levels).
           exit price   = 1 − g·D
           re-entry     = 1 − D + m·D = 1 − D(1−m)
           S            = (1 − g·D) / (1 − D(1−m))
       Sign of Adv is then independent of D — the depth amplifies
       magnitude, not direction. Whether step-aside wins depends only
       on whether g + m < 1 (you exited above where you re-entered).
       Edge cases: g=m=0 → max alpha D/(1−D); g=m=1 → −D (worst case,
       sold trough / bought peak); g+m=1 → zero (exit price equals
       re-entry price).                                                  */
    function tradeoffOutcome(D, g, m) {
        const exit = 1 - g * D;
        const reentry = 1 - D * (1 - m);
        return reentry > 0 ? exit / reentry : 1;
    }
    function tradeoffAdv(D, g, m) { return tradeoffOutcome(D, g, m) - 1; }
    function tradeoffBreakEven() {
        // Under fractional lags the break-even is depth-independent:
        // Adv = 0 iff g + m = 1. Returned as the constant 1.0 (sum of
        // fractional lags). The chart's break-even marker is therefore
        // drawn against the slider sum, not against D.
        return 1.0;
    }

    /* ---------- Calculator 4 — The Worst Case, Priced (§4.2) ----------
       All protocol numbers arrive via the constants object (loaded from
       /data/protocol-constants.json) — never hard-coded here.            */
    function bounds(nlv, n, c) {
        const perContract = (c.perContractRiskPctNLV / 100) * nlv;
        const totalPct = c.perContractRiskPctNLV * n;
        return {
            perContractDollars: perContract,
            totalPct: totalPct,
            totalDollars: perContract * n,
            dailyFloorStartDollars: (c.dailyFloorStartPctNLV / 100) * nlv,
            hardKillDollars: c.hardKillDollarsPerContract * n,
            exceedsStandardSizing: n > Math.floor(nlv / c.standardSizingNLVPerContract)
        };
    }

    return {
        repairRequired: repairRequired,
        repair: repair,
        adjustSeries: adjustSeries,
        arithMean: arithMean,
        geomMean: geomMean,
        volTax: volTax,
        parseReturnSeries: parseReturnSeries,
        tradeoffOutcome: tradeoffOutcome,
        tradeoffAdv: tradeoffAdv,
        tradeoffBreakEven: tradeoffBreakEven,
        bounds: bounds
    };
}));
