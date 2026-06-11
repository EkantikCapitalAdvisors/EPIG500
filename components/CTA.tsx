import { SchedulerCTA } from '@/components/forms/SchedulerCTA';
import { EmailCapture } from '@/components/forms/EmailCapture';
import config from '@/data/config.json';

export function CTA() {
  const c = config as { MIN_INVESTABLE_ASSETS: string };
  return (
    <section id="cta" className="bg-deep-navy text-clean-white section-pad">
      <div className="container-page text-center">
        <h2 className="font-serif text-section-mobile md:text-section text-clean-white">
          Request a Founders Circle Briefing
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-body-lg text-clean-white/80">
          A 30-minute private conversation. No pitch. Just the math, the methodology, and your questions.
        </p>

        <div className="mt-10 flex justify-center">
          <SchedulerCTA className="btn-primary text-lg px-8 py-4">Request the Briefing</SchedulerCTA>
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-small text-clean-white/65 italic">
          Most useful for investors with <span className="not-italic font-semibold text-warm-gold">{c.MIN_INVESTABLE_ASSETS}</span>{' '}
          or more in investable assets, currently allocated to long equity, evaluating active S&amp;P 500 exposure
          with defined risk and hedge characteristics.
        </p>

        <div className="mx-auto mt-12 max-w-md border-t border-clean-white/15 pt-8">
          <p className="text-clean-white/80 text-body mb-4">
            Not ready? Receive the monthly live report:
          </p>
          <div className="flex justify-center">
            <EmailCapture />
          </div>
        </div>
      </div>
    </section>
  );
}
