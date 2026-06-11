import config from '@/data/config.json';

export function Footer() {
  const advLink = (config as { ADV_LINK: string | null }).ADV_LINK;
  const advStatus = (config as { ADV_STATUS: string }).ADV_STATUS;
  return (
    <footer className="bg-deep-navy text-clean-white/85">
      <div className="container-page py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Ekantik 500" width={180} height={36} className="h-9 w-auto invert brightness-200" />
            <p className="mt-4 text-small text-clean-white/60">
              Ekantik Capital Advisors LLC
            </p>
          </div>
          <nav aria-label="Site links" className="text-small">
            <h3 className="font-serif text-clean-white text-lg mb-3">Verification</h3>
            <ul className="space-y-2">
              <li><a href="/methodology/" className="hover:text-warm-gold">Methodology</a></li>
              <li><a href="/trades/" className="hover:text-warm-gold">Trade Log</a></li>
              <li><a href="/reports/" className="hover:text-warm-gold">Monthly Live Report</a></li>
              <li><a href="/dashboard/" className="hover:text-warm-gold">Live Dashboard</a></li>
            </ul>
          </nav>
          <div className="text-small">
            <h3 className="font-serif text-clean-white text-lg mb-3">Regulatory</h3>
            <p className="text-clean-white/70">{advStatus}</p>
            {advLink ? (
              <a href={advLink} className="mt-2 inline-block text-warm-gold hover:underline">
                ADV Part 2
              </a>
            ) : (
              <p className="mt-2 text-clean-white/50">ADV Part 2 link forthcoming.</p>
            )}
          </div>
        </div>

        <div className="mt-12 space-y-4 border-t border-clean-white/10 pt-8 text-small text-clean-white/65">
          <p>Ekantik Capital Advisors LLC is a registered investment advisor.</p>
          <p>
            All historical figures presented on this page reflect backtested results over a 15-year period
            spanning multiple market regimes including the March 2020 COVID drawdown and the 2022 bear market
            (out-of-sample relative to system design). Past backtested results are not indicative of future live
            performance. Investing involves risk, including risk of loss of principal.
          </p>
          <p>
            The 0.5% catastrophic stop is a forward-looking architectural commitment that applies to every live
            position. Drawdown, losing-streak, and calendar-year figures characterize historical backtest behavior
            and are not guarantees of future outcomes.
          </p>
          <p>
            Hedge property is a structural design feature based on backtested behavior. Negative correlation in
            down-market regimes is not guaranteed in future market conditions.
          </p>
          <p>This page does not constitute an offer to sell or a solicitation to buy any security.</p>
          <p className="text-clean-white/50">
            &copy; {new Date().getFullYear()} Ekantik Capital Advisors LLC. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
