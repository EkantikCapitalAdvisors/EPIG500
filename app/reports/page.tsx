import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { EmailCapture } from '@/components/forms/EmailCapture';

export const metadata = {
  title: 'Monthly Live Report — Ekantik 500',
  description: 'Live results vs backtest expectation. Published the first business day of each month.',
};

export default function ReportsPage() {
  return (
    <>
      <Header />
      <main className="bg-clean-white">
        <section className="bg-deep-navy text-clean-white section-pad">
          <div className="container-page max-w-3xl pt-24 text-center">
            <Link href="/" className="text-small text-warm-gold hover:underline">&larr; Back to home</Link>
            <h1 className="mt-6 font-serif text-section-mobile md:text-section text-clean-white">
              Monthly Live Report
            </h1>
            <p className="mt-6 text-body-lg text-clean-white/80">
              Live results vs backtest expectation. Published the first business day of each month. The first
              issue ships once live deployment reaches a full reporting period.
            </p>
            <div className="mt-10 flex justify-center">
              <EmailCapture />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
