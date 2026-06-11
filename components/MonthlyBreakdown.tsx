'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import monthlyReturns from '@/data/monthly_returns.json';
import { SampleDataBadge } from '@/components/ui/SampleDataBadge';

type Row = { month: string; sp500: number; strategy: number };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function groupByYear(series: Row[]) {
  const byYear = new Map<number, (number | null)[]>();
  for (const r of series) {
    const [y, m] = r.month.split('-').map(Number);
    if (!byYear.has(y)) byYear.set(y, new Array(12).fill(null));
    byYear.get(y)![m - 1] = r.strategy;
  }
  return Array.from(byYear.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, months]) => {
      const ytd = months.reduce<number>(
        (acc, v) => (v == null ? acc : (1 + acc / 100) * (1 + v / 100) * 100 - 100),
        0,
      );
      return { year, months, ytd };
    });
}

function cellColor(v: number | null): string {
  if (v == null) return 'bg-deep-navy/[0.02] text-deep-navy/30';
  if (v === 0) return 'bg-clean-white text-deep-navy/70';
  if (v > 0) {
    const intensity = Math.min(1, Math.abs(v) / 6);
    const opacity = 0.08 + intensity * 0.32;
    return `text-deep-navy`;
  }
  return `text-signal-red`;
}

function cellBg(v: number | null): React.CSSProperties {
  if (v == null) return {};
  if (v > 0) {
    const intensity = Math.min(1, v / 6);
    return { backgroundColor: `rgba(45, 80, 22, ${0.08 + intensity * 0.32})` };
  }
  return { backgroundColor: `rgba(220, 38, 38, ${0.08 + Math.min(1, Math.abs(v) / 6) * 0.32})` };
}

export function MonthlyBreakdown() {
  const series = (monthlyReturns as { series: Row[] }).series;
  const grouped = groupByYear(series);
  const lastN = 24;
  const recent = series.slice(-lastN).map((r) => ({
    month: r.month,
    strategy: r.strategy,
  }));
  const ytdRow = grouped[0];
  const ytdCompleteMonths = ytdRow ? ytdRow.months.filter((v) => v !== null).length : 0;
  const allValues = series.map((r) => r.strategy);
  const best = Math.max(...allValues);
  const worst = Math.min(...allValues);
  const lastTwelve = series.slice(-12);
  const trailing12 = lastTwelve.reduce((acc, r) => (1 + acc / 100) * (1 + r.strategy / 100) * 100 - 100, 0);

  return (
    <div className="space-y-12">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={`YTD (${ytdCompleteMonths} mo)`} value={ytdRow ? `${ytdRow.ytd.toFixed(1)}%` : '—'} qualifier="Backtested sample" tone={ytdRow && ytdRow.ytd >= 0 ? 'positive' : 'negative'} />
        <Stat label="Trailing 12 months" value={`${trailing12.toFixed(1)}%`} qualifier="Backtested sample" tone={trailing12 >= 0 ? 'positive' : 'negative'} />
        <Stat label="Best month (15-yr backtest)" value={`+${best.toFixed(1)}%`} qualifier="Backtested" tone="positive" />
        <Stat label="Worst month (15-yr backtest)" value={`${worst.toFixed(1)}%`} qualifier="Backtested" tone={worst >= 0 ? 'positive' : 'negative'} />
      </div>

      <section>
        <div className="mb-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h3 className="font-serif text-2xl text-deep-navy">Monthly P&amp;L — Last 24 Months</h3>
            <p className="mt-1 text-small text-slate-gray">
              Backtested strategy returns. Live deployment in progress.
            </p>
          </div>
          <SampleDataBadge />
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <BarChart data={recent} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#1B2A4A" strokeOpacity={0.08} vertical={false} />
              <XAxis
                dataKey="month"
                stroke="#64748B"
                fontSize={11}
                tickFormatter={(d) => d.slice(2).replace('-', '/')}
                interval={1}
              />
              <YAxis stroke="#64748B" fontSize={11} tickFormatter={(v) => `${v}%`} width={50} />
              <Tooltip
                contentStyle={{ borderRadius: 8, borderColor: '#1B2A4A', fontSize: 12 }}
                formatter={(v: number) => [`${v.toFixed(2)}%`, 'Strategy (backtested)']}
              />
              <ReferenceLine y={0} stroke="#1B2A4A" strokeOpacity={0.3} />
              <Bar dataKey="strategy" radius={[3, 3, 0, 0]}>
                {recent.map((r, i) => (
                  <Cell key={i} fill={r.strategy >= 0 ? '#2D5016' : '#DC2626'} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h3 className="font-serif text-2xl text-deep-navy">Monthly P&amp;L by Year</h3>
            <p className="mt-1 text-small text-slate-gray">
              Backtested strategy returns over the 15-year window. Live deployment in progress.
            </p>
          </div>
          <SampleDataBadge />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-small text-deep-navy" aria-label="Monthly returns by year — backtested">
            <thead>
              <tr className="border-b border-deep-navy/20 text-[11px] uppercase tracking-wider text-deep-navy/70">
                <th className="py-2 pr-3 text-left font-medium">Year</th>
                {MONTHS.map((m) => (
                  <th key={m} className="py-2 px-1 text-center font-medium">{m}</th>
                ))}
                <th className="py-2 pl-3 text-right font-semibold">YTD</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ year, months, ytd }) => (
                <tr key={year} className="border-b border-deep-navy/5">
                  <td className="py-2 pr-3 font-semibold">{year}</td>
                  {months.map((v, i) => (
                    <td
                      key={i}
                      className={`py-2 px-1 text-center tabular-nums ${cellColor(v)}`}
                      style={cellBg(v)}
                    >
                      {v == null ? '—' : v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1)}
                    </td>
                  ))}
                  <td
                    className={`py-2 pl-3 text-right font-semibold tabular-nums ${ytd >= 0 ? 'text-forest-green' : 'text-signal-red'}`}
                  >
                    {ytd >= 0 ? '+' : ''}{ytd.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-small text-slate-gray">
          All figures backtested over a 15-year window including the March 2020 COVID gap and the 2022 bear
          market (out-of-sample). Past backtested results are not indicative of future performance.
        </p>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  qualifier,
  tone,
}: {
  label: string;
  value: string;
  qualifier: string;
  tone: 'positive' | 'negative';
}) {
  return (
    <div className="rounded-lg border border-deep-navy/10 bg-soft-ivory p-5">
      <p className="text-[11px] uppercase tracking-wider text-deep-navy/60">{label}</p>
      <p
        className={`mt-2 font-serif text-3xl ${tone === 'positive' ? 'text-deep-navy' : 'text-signal-red'}`}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] italic text-slate-gray">{qualifier}</p>
    </div>
  );
}
