import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata = {
  title: 'Trade Log — Ekantik 500',
  description: 'Every closed trade with entry, exit, R-multiple, and duration.',
};

export default function TradesPage() {
  return (
    <>
      <Header />
      <main className="bg-clean-white">
        <section className="section-pad">
          <div className="container-page max-w-3xl pt-24 text-center">
            <Link href="/" className="text-small text-warm-gold hover:underline">&larr; Back to home</Link>
            <h1 className="mt-6 font-serif text-section-mobile md:text-section text-deep-navy">Full Trade Log</h1>
            <p className="mt-6 text-body-lg text-deep-navy/80">
              Every closed trade — entry, exit, R-multiple, duration — published in Phase 2 once the live track
              record reaches the threshold for transparent disclosure.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
