import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SchedulerCTA } from '@/components/forms/SchedulerCTA';
import { MonthlyBreakdown } from '@/components/MonthlyBreakdown';

export const metadata = {
  title: 'Live Dashboard — Ekantik 500',
  description:
    'Real-time positions, monthly P&L, and risk exposure for Founders Circle members. Live deployment in progress.',
};

export default function DashboardPage() {
  return (
    <>
      <Header />
      <main className="bg-clean-white">
        <section className="bg-soft-ivory section-pad">
          <div className="container-page max-w-5xl pt-24">
            <Link href="/" className="text-small text-warm-gold hover:underline">&larr; Back to home</Link>
            <h1 className="mt-6 font-serif text-section-mobile md:text-section text-deep-navy">
              Live Dashboard
            </h1>
            <p className="mt-4 max-w-2xl text-body-lg text-deep-navy/80">
              Founders Circle members only. The values below show the <strong>backtested</strong> monthly
              breakdown over the 15-year window — a preview of what the live operating dashboard will display
              once live deployment matures. Real-time positions, daily P&amp;L, and risk exposure ship in
              Phase 2.
            </p>
          </div>
        </section>

        <section className="section-pad">
          <div className="container-page max-w-5xl">
            <MonthlyBreakdown />
          </div>
        </section>

        <section className="bg-deep-navy text-clean-white section-pad">
          <div className="container-page max-w-3xl text-center">
            <h2 className="font-serif text-section-mobile md:text-section text-clean-white">
              Want the live operating view?
            </h2>
            <p className="mt-4 text-body-lg text-clean-white/80">
              The full live dashboard — current posture (long / flat / short), open trade, intraday P&amp;L,
              and month-to-date R-multiple — is reserved for Founders Circle members.
            </p>
            <div className="mt-8 flex justify-center">
              <SchedulerCTA className="btn-primary">Request Founders Circle Access</SchedulerCTA>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
