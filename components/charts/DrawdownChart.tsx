'use client';

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useMemo } from 'react';
import equityData from '@/data/equity_curve.json';
import { track } from '@/lib/analytics';
import { SampleDataBadge } from '@/components/ui/SampleDataBadge';

type Row = {
  date: string;
  strategy: number;
  sp500: number;
  strategyDrawdown: number;
  sp500Drawdown: number;
};

const STRESS_EVENTS = [
  { date: '2018-12-21', label: 'Q4 2018' },
  { date: '2020-03-23', label: 'COVID Mar 2020' },
  { date: '2022-10-12', label: '2022 Bear' },
];

function findClosest(rows: Row[], targetDate: string): Row | undefined {
  const target = new Date(targetDate).getTime();
  let best: Row | undefined;
  let bestDiff = Infinity;
  for (const r of rows) {
    const diff = Math.abs(new Date(r.date).getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = r;
    }
  }
  return best;
}

export function DrawdownChart() {
  const rows = (equityData as { series: Row[] }).series;
  const stressMarkers = useMemo(
    () =>
      STRESS_EVENTS.map((s) => {
        const row = findClosest(rows, s.date);
        return row ? { ...s, x: row.date, ddY: row.strategyDrawdown } : null;
      }).filter((x): x is { date: string; label: string; x: string; ddY: number } => x !== null),
    [rows],
  );

  const formatYear = (d: string) => d.slice(0, 4);

  return (
    <figure
      className="w-full"
      onMouseEnter={() => track('drawdown_chart_interaction', { device: 'desktop' })}
      onTouchStart={() => track('drawdown_chart_interaction', { device: 'mobile' })}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-xl text-deep-navy">Strategy vs S&amp;P 500 — 15-Year Backtest</h3>
        <SampleDataBadge />
      </div>

      <div className="space-y-2">
        <div className="h-56 w-full">
          <ResponsiveContainer>
            <ComposedChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1B2A4A" strokeOpacity={0.08} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatYear}
                interval="preserveStartEnd"
                minTickGap={48}
                stroke="#64748B"
                fontSize={11}
              />
              <YAxis
                stroke="#64748B"
                fontSize={11}
                tickFormatter={(v) => `${v}`}
                width={50}
                domain={[80, 'auto']}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, borderColor: '#1B2A4A', fontSize: 12 }}
                labelFormatter={(d) => d}
                formatter={(v: number, name: string) => [v.toFixed(2), name === 'strategy' ? 'Strategy' : 'S&P 500']}
              />
              <Line type="monotone" dataKey="sp500" stroke="#64748B" strokeWidth={1.5} strokeOpacity={0.75} dot={false} />
              <Line type="monotone" dataKey="strategy" stroke="#1B2A4A" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="h-40 w-full">
          <ResponsiveContainer>
            <ComposedChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#1B2A4A" strokeOpacity={0.08} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatYear}
                interval="preserveStartEnd"
                minTickGap={48}
                stroke="#64748B"
                fontSize={11}
              />
              <YAxis stroke="#64748B" fontSize={11} tickFormatter={(v) => `${v}%`} width={50} />
              <Tooltip
                contentStyle={{ borderRadius: 8, borderColor: '#1B2A4A', fontSize: 12 }}
                formatter={(v: number, name: string) => [`${v.toFixed(2)}%`, name === 'strategyDrawdown' ? 'Strategy DD' : 'S&P 500 DD']}
              />
              <Area type="monotone" dataKey="sp500Drawdown" stroke="#64748B" fill="#64748B" fillOpacity={0.18} strokeWidth={1.5} />
              <Area type="monotone" dataKey="strategyDrawdown" stroke="#1B2A4A" fill="#1B2A4A" fillOpacity={0.22} strokeWidth={2} />
              {stressMarkers.map((m) => (
                <ReferenceDot
                  key={m.label}
                  x={m.x}
                  y={m.ddY}
                  r={5}
                  fill="#DC2626"
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  ifOverflow="extendDomain"
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748B' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <figcaption className="mt-3 text-small text-slate-gray">
        Same market exposure. A fraction of the drawdown. Across 15 years and three stress regimes (Q4 2018, March 2020 COVID, 2022 bear market).
      </figcaption>

      <table className="visually-hidden">
        <caption>Strategy vs S&P 500 — text alternative</caption>
        <thead>
          <tr><th>Series</th><th>Min drawdown</th><th>End level</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Strategy</td>
            <td>{Math.min(...rows.map((r) => r.strategyDrawdown)).toFixed(2)}%</td>
            <td>{rows[rows.length - 1]?.strategy.toFixed(2)}</td>
          </tr>
          <tr>
            <td>S&P 500</td>
            <td>{Math.min(...rows.map((r) => r.sp500Drawdown)).toFixed(2)}%</td>
            <td>{rows[rows.length - 1]?.sp500.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </figure>
  );
}
