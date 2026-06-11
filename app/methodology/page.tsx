import Link from 'next/link';
import methodology from '@/data/methodology.json';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';

export const metadata = {
  title: 'Methodology — Ekantik 500',
  description: 'The eight named robustness tests, system rules, and loss discipline behind the Ekantik 500 strategy.',
};

export default function MethodologyPage() {
  const tests = (methodology as { tests: { name: string; description: string }[] }).tests;
  return (
    <>
      <Header />
      <main className="bg-clean-white">
        <section className="bg-soft-ivory section-pad">
          <div className="container-page max-w-3xl pt-24">
            <Link href="/" className="text-small text-warm-gold hover:underline">&larr; Back to home</Link>
            <h1 className="mt-6 font-serif text-section-mobile md:text-section text-deep-navy">Methodology</h1>
            <p className="mt-4 text-body-lg text-deep-navy/80">
              The Ekantik 500 system has been backtested over a 15-year window spanning multiple stress regimes.
              The eight robustness tests below establish that the edge is statistically significant, parameter-stable,
              and survives out-of-sample evaluation. Live deployment in progress.
            </p>
          </div>
        </section>

        <section className="section-pad">
          <div className="container-page max-w-3xl">
            <ol className="space-y-8">
              {tests.map((t, i) => (
                <li key={t.name} className="border-l-2 border-warm-gold pl-5">
                  <p className="text-small uppercase tracking-wider text-slate-gray">Test {i + 1}</p>
                  <h2 className="font-serif text-2xl text-deep-navy mt-1">{t.name}</h2>
                  <p className="mt-2 text-body text-deep-navy/80">{t.description}</p>
                </li>
              ))}
            </ol>
            <p className="mt-12 text-small text-slate-gray italic">
              The canonical 8 tests are pending production update. Hiren Desai to confirm names and detailed descriptions.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
