import { StatTable } from '@/components/ui/StatTable';
import { DrawdownChart } from '@/components/charts/DrawdownChart';

export function Promise() {
  return (
    <section id="promise" className="bg-clean-white section-pad">
      <div className="container-page">
        <header className="mx-auto max-w-3xl text-center">
          <h2 className="font-serif text-section-mobile md:text-section text-deep-navy">
            The Promise — A Hard Floor on Every Trade
          </h2>
          <div className="mt-6 space-y-1 text-body-lg text-deep-navy/80">
            <p>Long S&amp;P 500 futures when conditions favor it.</p>
            <p>Flat when they don&rsquo;t.</p>
            <p>Occasionally short when the trend inverts.</p>
          </div>
          <p className="mt-8 font-serif text-2xl md:text-3xl leading-snug text-deep-navy">
            Every position carries a <span className="text-warm-gold font-semibold">0.5% catastrophic stop</span>,
            hard-stopped after hours.
            <br />
            <span className="text-deep-navy/85">You always know your worst case before the trade is taken.</span>
          </p>
        </header>

        <div className="mx-auto mt-12 max-w-prose">
          <StatTable
            caption="Downside, Defined"
            variant="panel"
            ariaLabel="Downside Defined — per-trade and portfolio-level loss limits"
            qualifier={
              <>
                The 0.5% per-attempt cap is forward-looking and applies to every live position. All other
                figures are backtested over 15 years including March 2020 COVID and the 2022 bear market
                (out-of-sample), or — for the YTD line — current live operation. Past backtested results are
                not indicative of future performance.
              </>
            }
            rows={[
              {
                label: 'Per attempt (architectural, forward-looking)',
                value: '0.5%',
                emphasis: 'navy-lg',
              },
              {
                label: 'Worst losing streak (15-yr backtest)',
                value: '6 trades / 3.5%',
                emphasis: 'navy',
              },
              {
                label: 'Maximum drawdown (15-yr backtest)',
                value: '10%',
                emphasis: 'navy-lg',
              },
              {
                label: 'Worst calendar year return (15-yr backtest)',
                value: '+10% (positive)',
                emphasis: 'navy-lg',
              },
              {
                label: 'Year-to-date drawdown (live/current)',
                value: '3.5%',
                emphasis: 'live',
              },
            ]}
          />
        </div>

        <p className="mx-auto mt-10 max-w-prose text-center text-body-lg text-deep-navy/75 italic">
          The same architecture that caps losses on every trade also produces something rarer at the portfolio
          level — see below.
        </p>

        <div className="mx-auto mt-12 max-w-5xl">
          <DrawdownChart />
        </div>
      </div>
    </section>
  );
}
