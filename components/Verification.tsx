import Link from 'next/link';

const cards = [
  {
    href: '/dashboard/',
    title: 'Live Dashboard',
    description: 'Real-time positions, P&L, and risk exposure.',
    note: 'Auth-gated for v1.',
  },
  {
    href: '/trades/',
    title: 'Full Trade Log',
    description: 'Every closed trade with entry, exit, R-multiple, and duration.',
  },
  {
    href: '/methodology/',
    title: 'Methodology',
    description: 'The eight named robustness tests, the system rules, the loss discipline.',
  },
  {
    href: '/reports/',
    title: 'Monthly Live Report',
    description: 'Live results vs backtest expectation. Published the first business day of each month.',
  },
];

export function Verification() {
  return (
    <section id="verification" className="bg-clean-white section-pad">
      <div className="container-page">
        <header className="mx-auto max-w-3xl text-center">
          <h2 className="font-serif text-section-mobile md:text-section text-deep-navy">
            The Verification — Built to Be Watched
          </h2>
          <p className="mt-3 text-body-lg text-deep-navy/75">
            Every entry. Every stop. Every exit. Verifiable in real time.
          </p>
        </header>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group block rounded-lg border border-deep-navy/10 bg-soft-ivory p-6 transition hover:border-warm-gold/60 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-gold"
            >
              <span aria-hidden className="block h-8 w-8 mb-4 rounded border border-deep-navy/30 group-hover:border-warm-gold" />
              <h3 className="font-serif text-xl text-deep-navy">{card.title}</h3>
              <p className="mt-2 text-body text-deep-navy/75">{card.description}</p>
              {card.note ? (
                <p className="mt-3 text-small text-slate-gray italic">{card.note}</p>
              ) : null}
              <span className="mt-4 inline-flex items-center text-small text-warm-gold group-hover:underline">
                View &rarr;
              </span>
            </Link>
          ))}
        </div>

        <p className="mx-auto mt-12 max-w-3xl text-center font-serif text-2xl text-deep-navy">
          Most managers ask for trust. We offer math — and the means to verify it.
        </p>
      </div>
    </section>
  );
}
