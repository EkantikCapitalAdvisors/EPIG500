'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import monthly from '@/data/monthly_returns.json';
import { SampleDataBadge } from '@/components/ui/SampleDataBadge';

type Point = { month: string; sp500: number; strategy: number };

export function CorrelationScatter() {
  const series = (monthly as { series: Point[] }).series;
  return (
    <figure className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-xl text-deep-navy">Monthly Returns — Strategy vs S&amp;P 500</h3>
        <SampleDataBadge />
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#1B2A4A" strokeOpacity={0.08} />
            <XAxis
              type="number"
              dataKey="sp500"
              name="S&P 500"
              unit="%"
              domain={[-15, 15]}
              stroke="#64748B"
              fontSize={11}
            />
            <YAxis
              type="number"
              dataKey="strategy"
              name="Strategy"
              unit="%"
              domain={[-15, 15]}
              stroke="#64748B"
              fontSize={11}
            />
            <ReferenceLine x={0} stroke="#1B2A4A" strokeOpacity={0.2} />
            <ReferenceLine y={0} stroke="#1B2A4A" strokeOpacity={0.2} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ borderRadius: 8, borderColor: '#1B2A4A', fontSize: 12 }}
              formatter={(v: number) => `${v.toFixed(2)}%`}
            />
            <Scatter data={series} fill="#1B2A4A" fillOpacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-3 text-small text-slate-gray">
        In normal markets, the strategy participates. In stress months, it diverges.
      </figcaption>
    </figure>
  );
}
