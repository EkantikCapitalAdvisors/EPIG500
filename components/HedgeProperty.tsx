'use client';

import { useEffect, useRef } from 'react';
import { StressEventChart } from '@/components/charts/StressEventChart';
import { CorrelationScatter } from '@/components/charts/CorrelationScatter';
import { Accordion } from '@/components/ui/Accordion';
import { SampleDataBadge } from '@/components/ui/SampleDataBadge';
import { track } from '@/lib/analytics';
import config from '@/data/config.json';

export function HedgeProperty() {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === 'undefined') return;
    const el = ref.current;
    let fired = false;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.5 && !fired) {
            fired = true;
            track('hedge_section_view');
          }
        }
      },
      { threshold: [0.5] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const c = config as { BETA_UP: string; BETA_DOWN: string; BETA_STRESS: string };

  return (
    <section id="hedge" ref={ref} className="bg-soft-ivory section-pad">
      <div className="container-page">
        <header className="mx-auto max-w-3xl text-center">
          <h2 className="font-serif text-section-mobile md:text-section text-deep-navy">
            When the Market Falls, This Strategy Doesn&rsquo;t
          </h2>
        </header>

        <p className="mx-auto mt-8 max-w-3xl text-body-lg text-deep-navy/80">
          Most equity strategies share a fatal symmetry: they participate in up markets <em>and</em> in down
          markets. Ekantik 500 is designed differently. The same long/flat/short architecture that caps losses
          on each trade produces a structural hedge property at the portfolio level — market participation when
          conditions favor, divergence when they don&rsquo;t. Across 15 years of backtesting through multiple
          stress regimes — including the March 2020 COVID gap and the 2022 bear market (out-of-sample) — every
          calendar year produced a positive return, with the worst year still up 10% and the maximum drawdown
          contained to 10%.
        </p>

        <p className="mx-auto mt-10 max-w-3xl killer-line text-deep-navy text-center font-semibold">
          A long equity strategy that gets shorter as the market gets worse.
        </p>

        <aside className="mx-auto mt-10 max-w-3xl rounded-lg border border-warm-gold/40 bg-warm-gold/10 p-6 md:p-8">
          <p className="font-serif text-xl md:text-2xl text-deep-navy">
            Across 15 years of backtest, every calendar year produced a positive return.
          </p>
          <p className="mt-3 text-body text-deep-navy/80">
            Worst year: <strong>+10%</strong>. Best year: <strong>+24%</strong>. Maximum drawdown contained to{' '}
            <strong>10%</strong>, including the March 2020 COVID gap and the 2022 bear market (out-of-sample).
            All figures backtested. Live deployment in progress.
          </p>
        </aside>

        <div className="mx-auto mt-12 max-w-5xl">
          <StressEventChart />
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif text-xl text-deep-navy">Beta by Regime</h3>
            <SampleDataBadge />
          </div>
          <table className="w-full" aria-label="Strategy beta by market regime">
            <thead>
              <tr className="border-b border-deep-navy/15 text-small uppercase tracking-wider text-deep-navy/70">
                <th className="py-3 pr-4 text-left font-medium">Market Regime</th>
                <th className="py-3 pl-4 text-right font-medium">Strategy Beta to S&amp;P 500</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-deep-navy/10">
                <td className="py-3 pr-4">Up months (S&amp;P &gt; 0%)</td>
                <td className="py-3 pl-4 text-right font-semibold text-deep-navy">{c.BETA_UP}</td>
              </tr>
              <tr className="border-b border-deep-navy/10">
                <td className="py-3 pr-4">Down months (S&amp;P &lt; 0%)</td>
                <td className="py-3 pl-4 text-right font-semibold text-deep-navy">{c.BETA_DOWN}</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">Stress months (S&amp;P &lt; -3%)</td>
                <td className="py-3 pl-4 text-right font-semibold text-deep-navy">{c.BETA_STRESS}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-small text-slate-gray">
            Beta calculated from backtested monthly returns. The asymmetric profile is by design, not by accident.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-5xl">
          <Accordion label="Show correlation scatter" trackEvent="scatter_expand">
            <CorrelationScatter />
          </Accordion>
        </div>

        <p className="mx-auto mt-10 max-w-3xl text-body-lg text-deep-navy/80">
          This is why Ekantik 500 is a portfolio complement — not a substitute. Held alongside passive equity
          exposure, the strategy contributes returns in normal markets and meaningful protection — sometimes
          positive returns — when the market is falling.
        </p>
      </div>
    </section>
  );
}
