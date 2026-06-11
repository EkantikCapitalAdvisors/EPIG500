'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ResponsiveContainer,
} from 'recharts';
import { track } from '@/lib/analytics';
import stressData from '@/data/stress_events.json';
import { SampleDataBadge } from '@/components/ui/SampleDataBadge';

type Event = { window: string; sp500: number; strategy: number };

export function StressEventChart() {
  const events = (stressData as { events: Event[] }).events;
  return (
    <figure
      className="w-full"
      onMouseEnter={() => track('stress_chart_interaction', { device: 'desktop' })}
      onTouchStart={() => track('stress_chart_interaction', { device: 'mobile' })}
    >
      <div className="mb-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <h3 className="font-serif text-xl text-deep-navy">
          How the strategy behaved when the S&amp;P 500 fell
        </h3>
        <SampleDataBadge />
      </div>
      <div className="h-72 sm:h-80 w-full">
        <ResponsiveContainer>
          <BarChart data={events} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#1B2A4A" strokeOpacity={0.08} vertical={false} />
            <XAxis dataKey="window" stroke="#64748B" fontSize={12} interval={0} />
            <YAxis stroke="#64748B" fontSize={11} tickFormatter={(v) => `${v}%`} width={50} />
            <Tooltip
              contentStyle={{ borderRadius: 8, borderColor: '#1B2A4A', fontSize: 12 }}
              formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name === 'strategy' ? 'Strategy' : 'S&P 500']}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#64748B' }} formatter={(v) => (v === 'strategy' ? 'Strategy' : 'S&P 500')} />
            <Bar dataKey="sp500" fill="#64748B" radius={[3, 3, 0, 0]}>
              <LabelList dataKey="sp500" position="top" formatter={(v: number) => `${v.toFixed(1)}%`} fontSize={11} fill="#1B2A4A" />
            </Bar>
            <Bar dataKey="strategy" fill="#1B2A4A" radius={[3, 3, 0, 0]}>
              <LabelList dataKey="strategy" position="top" formatter={(v: number) => `${v.toFixed(1)}%`} fontSize={11} fill="#1B2A4A" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-3 text-small text-slate-gray">
        Backtested results. Live performance during these windows is published in the monthly report.
      </figcaption>
      <table className="visually-hidden">
        <caption>Stress events — text alternative</caption>
        <thead><tr><th>Window</th><th>S&P 500</th><th>Strategy</th></tr></thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.window}>
              <td>{e.window}</td>
              <td>{e.sp500}%</td>
              <td>{e.strategy}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
