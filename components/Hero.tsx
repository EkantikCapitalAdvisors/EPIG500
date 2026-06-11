'use client';

import Link from 'next/link';
import { track } from '@/lib/analytics';

export function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-[80vh] md:min-h-screen items-center bg-deep-navy text-clean-white overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(200,169,81,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(13,148,136,0.12),transparent_60%)]"
      />
      <div className="container-page relative z-10 pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="max-w-3xl text-center md:text-left">
          <h1 className="font-serif text-hero-mobile md:text-hero font-semibold text-clean-white">
            Limit losses. Don&rsquo;t cap gains.
          </h1>
          <p className="mt-6 text-sub-mobile md:text-sub text-clean-white/80 max-w-2xl mx-auto md:mx-0">
            15 years of backtesting. Every calendar year positive. 10% maximum drawdown. No upside cap.
            The hedged equity strategy designed to refuse the trade-off.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center md:items-start gap-4 sm:gap-6 justify-center md:justify-start">
            <Link
              href="#edge"
              onClick={() => track('hero_cta_click', { target: 'see_the_math' })}
              className="btn-primary text-base"
            >
              See the Math
            </Link>
            <span className="text-clean-white/55 text-small">All figures backtested. Live deployment in progress.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
