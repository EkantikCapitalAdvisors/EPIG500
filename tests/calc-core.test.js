/* Unit tests — Calculator Spec v1.0 §5.2. Run: node tests/calc-core.test.js */
const C = require('../js/calc-core.js');
let pass = 0, fail = 0;
function eq(name, got, want, tol) {
    tol = tol === undefined ? 1e-9 : tol;
    if (Math.abs(got - want) <= tol) { pass++; }
    else { fail++; console.error('FAIL', name, 'got', got, 'want', want); }
}
function ok(name, cond) { if (cond) pass++; else { fail++; console.error('FAIL', name); } }

/* ---- Calc 1 (§1.5) ---- */
eq('R(50%) = +100%', C.repairRequired(0.50), 1.00);
eq('R(74%) ≈ +285%', Math.round(C.repairRequired(0.74) * 100), 285, 0);
eq('R(37%) ≈ +59%', Math.round(C.repairRequired(0.37) * 100), 59, 0);
eq('R(18.5%) ≈ +23%', Math.round(C.repairRequired(0.185) * 100), 23, 0);
ok('convexity: cutPct > 50% (halving the loss cuts the bill by more than half)', C.repair(0.37).cutPct > 0.5);

/* ---- Calc 2 (§2.5) — S&P 2005–2024 preset (page canonical dataset) ---- */
const SP = [0.0483,0.1585,0.0549,-0.37,0.2646,0.1506,0.0211,0.16,0.3239,0.1369,
            0.0138,0.1196,0.2183,-0.0438,0.3149,0.184,0.2871,-0.1811,0.2629,0.2502];
const base = C.volTax(SP, 1.0);
eq('A ≈ 11.9%/yr at p=100', base.A, 0.119, 0.0015);
eq('G ≈ 10.4%/yr at p=100', base.G, 0.104, 0.0015);
ok('T > 0 at p=100', base.T > 0);
// monotonicity: G non-increasing as p increases 0 → 100
let prevG = Infinity, mono = true;
for (let p = 0; p <= 1.0001; p += 0.05) {
    const g = C.volTax(SP, p).G;
    if (g > prevG + 1e-12) mono = false;
    prevG = g;
}
ok('G non-increasing as p rises 0→100%', mono);
// parser
ok('parser accepts valid', C.parseReturnSeries('10, -5 7.5\n12%').ok);
ok('parser rejects >200', !C.parseReturnSeries('10, 300').ok);
ok('parser names first invalid token', C.parseReturnSeries('10, abc, 5').error.indexOf('abc') !== -1);
ok('parser rejects >50 values', !C.parseReturnSeries(Array(51).fill('5').join(',')).ok);

/* ---- Calc 3 (§3.5) ---- */
let allPos = true;
for (let D = 0.001; D <= 0.55; D += 0.001) if (C.tradeoffAdv(D, 0, 0) <= 0) allPos = false;
ok('g=m=0 → Adv > 0 for all D > 0 (fractional model)', allPos);
ok('fractional g=m=0 at D=20% yields max alpha D/(1−D) = 25%',
    Math.abs(C.tradeoffAdv(0.20, 0, 0) - 0.25) < 1e-9);
ok('fractional g=m=1 at D=20% yields worst case −D = −20%',
    Math.abs(C.tradeoffAdv(0.20, 1, 1) - (-0.20)) < 1e-9);
ok('fractional g+m=1 → Adv = 0 regardless of depth (D=10%)',
    Math.abs(C.tradeoffAdv(0.10, 0.4, 0.6)) < 1e-9);
ok('fractional g+m=1 → Adv = 0 regardless of depth (D=50%)',
    Math.abs(C.tradeoffAdv(0.50, 0.7, 0.3)) < 1e-9);
ok('fractional g+m<1 → Adv > 0 for any D > 0', C.tradeoffAdv(0.10, 0.2, 0.1) > 0 && C.tradeoffAdv(0.40, 0.2, 0.1) > 0);
ok('fractional g+m>1 → Adv < 0 for any D > 0', C.tradeoffAdv(0.10, 0.7, 0.5) < 0 && C.tradeoffAdv(0.40, 0.7, 0.5) < 0);
eq('break-even is depth-independent constant 1.0 (g+m sum)', C.tradeoffBreakEven(), 1.0);

/* ---- Calc 4 (§4.5, updated to the v1.5 two-contract ceiling) ---- */
const K = require('../data/protocol-constants.json');
ok('constants: maxContracts = 2 (v1.5 ceiling)', K.maxContracts === 2);
const b1 = C.bounds(100000, 1, K);
eq('NLV $100K n=1: per-trade $500', b1.perContractDollars, 500);
eq('NLV $100K n=1: daily floor −$500 (starting)', b1.dailyFloorStartDollars, 500);
eq('NLV $100K n=1: hard kill $5,000', b1.hardKillDollars, 5000);
const b2 = C.bounds(400000, 2, K);
eq('NLV $400K n=2: per-contract $2,000', b2.perContractDollars, 2000);
eq('NLV $400K n=2: total exposure 1% = $4,000', b2.totalDollars, 4000);
eq('NLV $400K n=2: hard kill $10,000', b2.hardKillDollars, 10000);
ok('sizing warning at NLV $100K n=2', C.bounds(100000, 2, K).exceedsStandardSizing === true);
ok('no warning at NLV $200K n=2', C.bounds(200000, 2, K).exceedsStandardSizing === false);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
