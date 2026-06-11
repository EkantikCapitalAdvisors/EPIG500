'use client';

import { useEffect, useRef } from 'react';
import { StatTable } from '@/components/ui/StatTable';
import { Accordion } from '@/components/ui/Accordion';
import { track } from '@/lib/analytics';
import methodology from '@/data/methodology.json';

export function Edge() {
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
            track('proof_section_view');
          }
        }
      },
      { threshold: [0.5] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="edge" ref={ref} className="bg-soft-ivory section-pad">
      <div className="container-page">
        <header className="mx-auto max-w-3xl text-center">
          <h2 className="font-serif text-section-mobile md:text-section text-deep-navy">
            The Edge — Proven by Math
          </h2>
          <p className="mt-3 text-body-lg text-deep-navy/75">
            Backtested. Robustness-verified. Live deployment in progress.
          </p>
        </header>

        <div className="mt-12 grid gap-10 md:grid-cols-2 mx-auto max-w-5xl">
          <StatTable
            ariaLabel="System characteristics"
            qualifier="This is a system characterization, not a return promise. Past backtested results are not indicative of future live results."
            rows={[
              { label: 'Win rate', value: '53.6%' },
              { label: 'Profit factor', value: '3.06' },
              { label: 'Avg reward-to-risk', value: '2.65 : 1' },
              { label: 'R-expectancy', value: '+0.346R per attempt' },
              {
                label: 'P-value',
                value: (
                  <span>
                    0.023 <span className="text-slate-gray font-normal">(statistically significant)</span>
                  </span>
                ),
              },
              { label: 'Robustness tests passed', value: '8 of 8' },
              { label: 'Top-3 outlier removal', value: 'Edge holds (+$567)' },
              {
                label: <span className="font-semibold text-deep-navy">Edge verdict</span>,
                value: 'PROVEN',
                emphasis: 'gold',
              },
            ]}
          />

          <StatTable
            caption="Upside, Defined"
            ariaLabel="Upside Defined — backtested calendar-year characterization"
            qualifier="All figures backtested over 15 years including March 2020 COVID and the 2022 bear market (out-of-sample). Past results are not indicative of future performance. Live deployment in progress."
            rows={[
              {
                label: 'Per attempt expected gain',
                value: (
                  <>
                    +0.346R <span className="text-slate-gray font-normal">(≈ 1.3% on 0.5% risk)</span>
                  </>
                ),
                emphasis: 'navy',
              },
              { label: 'Reward-to-risk ratio', value: '2.65 : 1', emphasis: 'navy' },
              { label: 'Best calendar year (15-yr backtest)', value: '+24%', emphasis: 'navy' },
              {
                label: 'Average annual return / CAGR (15-yr backtest)',
                value: '16%',
                emphasis: 'navy',
              },
              { label: 'Worst calendar year (15-yr backtest)', value: '+10%', emphasis: 'navy' },
              {
                label: 'Calendar year range (15-yr backtest)',
                value: '+10% to +24% — every year positive',
                emphasis: 'gold',
              },
            ]}
          />
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <Accordion label="How we tested" trackEvent="methodology_expand">
            <ul className="space-y-4 text-body text-deep-navy/85">
              {(methodology as { tests: { name: string; description: string }[] }).tests.map((t) => (
                <li key={t.name}>
                  <strong className="font-semibold text-deep-navy">{t.name}.</strong>{' '}
                  {t.description}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-small text-slate-gray">
              Full methodology page:{' '}
              <a className="text-warm-gold hover:underline" href="/methodology/">/methodology</a>
            </p>
          </Accordion>
        </div>
      </div>
    </section>
  );
}
