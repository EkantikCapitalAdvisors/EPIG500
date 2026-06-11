import { SampleDataBadge } from '@/components/ui/SampleDataBadge';
import config from '@/data/config.json';

export function Engine() {
  const c = config as { BUFFER_THRESHOLD: string; CORRECTION_TRIGGER: string; MAX_LEVERAGE: string };
  return (
    <section id="engine" className="bg-deep-navy text-clean-white section-pad">
      <div className="container-page">
        <header className="mx-auto max-w-3xl text-center">
          <h2 className="font-serif text-section-mobile md:text-section text-clean-white">
            The Engine — Earned Leverage, Not Borrowed Leverage
          </h2>
        </header>

        <div className="mx-auto mt-12 max-w-3xl overflow-x-auto">
          <table className="w-full text-clean-white" aria-label="Industry standard versus Ekantik 500">
            <thead>
              <tr className="border-b border-clean-white/20 text-small uppercase tracking-wider text-clean-white/70">
                <th className="py-3 pr-4 text-left font-medium">Axis</th>
                <th className="py-3 px-4 text-left font-medium">Industry Standard</th>
                <th className="py-3 pl-4 text-left font-medium">Ekantik 500</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-clean-white/10">
                <td className="py-3 pr-4 font-medium">Source</td>
                <td className="py-3 px-4 text-clean-white/75">Borrowed capital</td>
                <td className="py-3 pl-4 font-semibold">Earned profits</td>
              </tr>
              <tr className="border-b border-clean-white/10">
                <td className="py-3 pr-4 font-medium">Cadence</td>
                <td className="py-3 px-4 text-clean-white/75">Perpetual</td>
                <td className="py-3 pl-4 font-semibold">Opportunistic</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium">Risk Discipline</td>
                <td className="py-3 px-4 text-clean-white/75">Amplifies drawdowns</td>
                <td className="py-3 pl-4 font-semibold">Same 0.5% catastrophic stop applies</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mx-auto mt-12 max-w-3xl killer-line text-warm-gold text-center font-semibold">
          Leverage doesn&rsquo;t increase our maximum loss per attempt. It increases our maximum gain per attempt
          on the same bounded-risk trade.
        </p>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-2">
          <article className="rounded-lg border border-clean-white/15 bg-clean-white/5 p-6 md:p-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-2xl text-clean-white">Trigger 1 — The Profit Buffer</h3>
              <SampleDataBadge />
            </div>
            <p className="text-body text-clean-white/85">
              Once accumulated gains exceed{' '}
              <span className="font-semibold text-warm-gold">{c.BUFFER_THRESHOLD}</span>, a portion of those gains
              becomes available as leverage capital. Trading on the casino&rsquo;s chips. Principal stays
              structurally protected by the architectural 0.5% per-attempt catastrophic stop.
            </p>
          </article>
          <article className="rounded-lg border border-clean-white/15 bg-clean-white/5 p-6 md:p-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-2xl text-clean-white">Trigger 2 — The Correction Event</h3>
              <SampleDataBadge />
            </div>
            <p className="text-body text-clean-white/85">
              When the market drops by{' '}
              <span className="font-semibold text-warm-gold">{c.CORRECTION_TRIGGER}</span>, asymmetric long
              setups appear with extraordinary R:R. Leverage activates on these specific opportunities to
              compound the edge precisely when it&rsquo;s largest.
            </p>
          </article>
        </div>

        <div className="mx-auto mt-12 max-w-3xl overflow-x-auto">
          <table className="w-full text-clean-white" aria-label="Risk and expected R-multiple per attempt">
            <thead>
              <tr className="border-b border-clean-white/20 text-small uppercase tracking-wider text-clean-white/70">
                <th className="py-3 pr-4 text-left font-medium">Configuration</th>
                <th className="py-3 px-4 text-right font-medium">Risk per Attempt</th>
                <th className="py-3 pl-4 text-right font-medium">Expected per Attempt</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-clean-white/10">
                <td className="py-3 pr-4">Base case</td>
                <td className="py-3 px-4 text-right font-semibold">0.5%</td>
                <td className="py-3 pl-4 text-right font-semibold">1.3% (2.65:1)</td>
              </tr>
              <tr className="border-b border-clean-white/10">
                <td className="py-3 pr-4">Earned 2× on opportunity</td>
                <td className="py-3 px-4 text-right font-semibold">1.0%</td>
                <td className="py-3 pl-4 text-right font-semibold">2.6%</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">Earned 3× on rare correction event</td>
                <td className="py-3 px-4 text-right font-semibold">1.5%</td>
                <td className="py-3 pl-4 text-right font-semibold">3.9%</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-small text-clean-white/65">
            The R-multiple is constant. Leverage scales the dollar magnitude — not the risk discipline. Maximum
            leverage configuration: <span className="text-warm-gold font-semibold">{c.MAX_LEVERAGE}</span>.{' '}
            All figures backtested.
          </p>
        </div>

        <p className="mx-auto mt-12 max-w-3xl text-center font-serif text-2xl text-clean-white">
          We don&rsquo;t borrow our way to returns. We earn the right to scale.
        </p>
      </div>
    </section>
  );
}
