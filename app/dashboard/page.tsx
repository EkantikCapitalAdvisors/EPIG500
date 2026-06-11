import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SchedulerCTA } from '@/components/forms/SchedulerCTA';

export const metadata = {
  title: 'Live Dashboard — Ekantik 500',
  description: 'Real-time positions, P&L, and risk exposure for Founders Circle members.',
};

export default function DashboardPage() {
  return (
    <>
      <Header />
      <main className="bg-clean-white">
        <section className="section-pad">
          <div className="container-page max-w-3xl pt-24 text-center">
            <Link href="/" className="text-small text-warm-gold hover:underline">&larr; Back to home</Link>
            <h1 className="mt-6 font-serif text-section-mobile md:text-section text-deep-navy">Live Dashboard</h1>
            <p className="mt-6 text-body-lg text-deep-navy/80">
              Founders Circle members only. Real-time positions, daily P&amp;L, and risk exposure ship in Phase 2.
            </p>
            <div className="mt-10 inline-block">
              <SchedulerCTA className="btn-primary">Request Founders Circle Access</SchedulerCTA>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
