// Generate sample chart datasets for v1 launch.
// Re-run: `node scripts/generate-sample-data.mjs`. Outputs are deterministic (seeded RNG).
// All shapes are illustrative; replace with real backtest data before publishing.

import fs from 'node:fs';
import path from 'node:path';

const seed = 42;
let s = seed;
const rand = () => {
  s = (s * 1664525 + 1013904223) >>> 0;
  return s / 0xffffffff;
};
const norm = () => {
  // Box-Muller
  const u1 = Math.max(rand(), 1e-9);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

// 15-year window: ~3,780 trading days.
const start = new Date('2010-01-04T00:00:00Z');
const days = 15 * 252;

// Daily log returns: S&P ~ 9% CAGR, ~16% vol; Strategy ~ 16% CAGR, lower vol with shallower DDs.
const annTradingDays = 252;
const spMu = Math.log(1.09) / annTradingDays;
const spSigma = 0.16 / Math.sqrt(annTradingDays);
const stMu = Math.log(1.16) / annTradingDays;
const stSigma = 0.09 / Math.sqrt(annTradingDays);

const equityCurve = [];
let spLevel = 100;
let stLevel = 100;
let spPeak = spLevel;
let stPeak = stLevel;
const sampleEveryN = 5; // weekly samples to keep payload small

for (let i = 0; i < days; i++) {
  // Inject stress windows where strategy goes flat/short while S&P drops.
  // Q4 2018 (~day index for Oct-Dec 2018): days ~2210-2270
  // COVID crash (~Feb-Mar 2020): days ~2540-2580
  // 2022 bear market: days ~3020-3260
  let stressFactor = 1;
  let stPosture = 1; // 1 long, 0 flat, -1 short
  if (i >= 2210 && i <= 2270) { stressFactor = 1.6; stPosture = i > 2230 ? -0.3 : 0; }
  if (i >= 2540 && i <= 2580) { stressFactor = 3.5; stPosture = i > 2550 ? -0.4 : 0; }
  if (i >= 3020 && i <= 3260) { stressFactor = 1.4; stPosture = -0.15; }

  const spShock = norm() * spSigma * stressFactor + spMu - (stressFactor > 1 ? 0.0015 : 0);
  spLevel *= Math.exp(spShock);

  // Strategy: scaled by posture — long market most of the time, flat/short in stress.
  const stShock = norm() * stSigma + stMu + (stPosture < 0 ? -spShock * Math.abs(stPosture) : spShock * Math.max(stPosture, 0) * 0.4);
  stLevel *= Math.exp(stShock);

  spPeak = Math.max(spPeak, spLevel);
  stPeak = Math.max(stPeak, stLevel);
  const spDD = (spLevel / spPeak) - 1;
  const stDD = (stLevel / stPeak) - 1;

  if (i % sampleEveryN === 0 || i === days - 1) {
    const date = new Date(start.getTime() + i * 86400000);
    equityCurve.push({
      date: date.toISOString().slice(0, 10),
      strategy: Number(stLevel.toFixed(2)),
      sp500: Number(spLevel.toFixed(2)),
      strategyDrawdown: Number((stDD * 100).toFixed(2)),
      sp500Drawdown: Number((spDD * 100).toFixed(2)),
    });
  }
}

// Hard-cap strategy max drawdown to ~10% in the sample (matches v1.3 spec credential).
const maxDDAllowed = 10;
const observedMaxDD = Math.min(...equityCurve.map((d) => d.strategyDrawdown));
if (observedMaxDD < -maxDDAllowed) {
  const scale = maxDDAllowed / Math.abs(observedMaxDD);
  for (const row of equityCurve) {
    row.strategyDrawdown = Number((row.strategyDrawdown * scale).toFixed(2));
  }
}

const stressEvents = [
  { window: 'Q4 2018', sp500: -13.5, strategy: 1.4 },
  { window: 'COVID Mar 2020', sp500: -33.8, strategy: 4.2 },
  { window: '2022 Bear', sp500: -25.4, strategy: 3.6 },
  { window: 'Aug 2024 Correction', sp500: -8.5, strategy: 0.9 },
];

// Monthly returns: ~180 months of correlated samples with asymmetric beta.
const monthlyReturns = [];
const months = 15 * 12;
const monthDate = new Date('2010-01-31T00:00:00Z');
for (let i = 0; i < months; i++) {
  const spMonth = norm() * 0.045 + 0.0075;
  let stMonth;
  if (spMonth > 0) {
    stMonth = spMonth * 0.55 + Math.abs(norm()) * 0.012; // up months: participate ~55%
  } else if (spMonth > -0.03) {
    stMonth = spMonth * 0.15 + norm() * 0.01; // mild down: small participation
  } else {
    stMonth = -spMonth * 0.6 + norm() * 0.012; // stress: invert
  }
  monthlyReturns.push({
    month: new Date(monthDate.getFullYear(), monthDate.getMonth() + i, 1).toISOString().slice(0, 7),
    sp500: Number((spMonth * 100).toFixed(2)),
    strategy: Number((stMonth * 100).toFixed(2)),
  });
}

// Beta by regime, computed from the monthly sample.
const up = monthlyReturns.filter((m) => m.sp500 > 0);
const down = monthlyReturns.filter((m) => m.sp500 < 0);
const stress = monthlyReturns.filter((m) => m.sp500 < -3);
const beta = (rows) => {
  if (!rows.length) return null;
  const mx = rows.reduce((a, b) => a + b.sp500, 0) / rows.length;
  const my = rows.reduce((a, b) => a + b.strategy, 0) / rows.length;
  const num = rows.reduce((a, b) => a + (b.sp500 - mx) * (b.strategy - my), 0);
  const den = rows.reduce((a, b) => a + (b.sp500 - mx) ** 2, 0);
  return den ? Number((num / den).toFixed(2)) : null;
};
const betaSample = {
  up: beta(up),
  down: beta(down),
  stress: beta(stress),
  _note: 'Sample beta values derived from sample monthlyReturns. Replace with real backtested betas before publishing.',
};

const root = path.resolve(process.cwd());
const outDir = path.join(root, 'data');
fs.writeFileSync(path.join(outDir, 'equity_curve.json'), JSON.stringify({
  _note: 'Sample data — pending production update. Generated by scripts/generate-sample-data.mjs.',
  series: equityCurve,
}, null, 2));
fs.writeFileSync(path.join(outDir, 'stress_events.json'), JSON.stringify({
  _note: 'Sample data — pending production update.',
  events: stressEvents,
}, null, 2));
fs.writeFileSync(path.join(outDir, 'monthly_returns.json'), JSON.stringify({
  _note: 'Sample data — pending production update.',
  series: monthlyReturns,
  betaSample,
}, null, 2));

console.log(`Wrote ${equityCurve.length} equity rows, ${stressEvents.length} stress events, ${monthlyReturns.length} monthly returns.`);
console.log(`Sample betas: up=${betaSample.up}, down=${betaSample.down}, stress=${betaSample.stress}`);
