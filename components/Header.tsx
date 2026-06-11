import Link from 'next/link';
import { getSchedulerHref, isSchedulerConfigured } from '@/lib/cta';

type Props = {
  variant?: 'on-dark' | 'on-light';
};

export function Header({ variant = 'on-light' }: Props) {
  const href = getSchedulerHref();
  const external = isSchedulerConfigured();
  const onDark = variant === 'on-dark';
  const textColor = onDark ? 'text-clean-white' : 'text-deep-navy';
  const ctaClass = onDark
    ? 'inline-flex items-center justify-center rounded-md border border-clean-white/40 px-5 py-2.5 text-clean-white font-medium transition hover:border-clean-white/80 hover:bg-clean-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-clean-white text-sm md:text-base'
    : 'btn-secondary text-sm md:text-base';
  return (
    <header className={`absolute inset-x-0 top-0 z-30 ${textColor}`}>
      <div className="container-page flex items-center justify-between py-6 md:py-8">
        <Link href="/" aria-label="Ekantik 500 home" className="inline-flex items-center">
          <Logo />
        </Link>
        <a
          href={href}
          {...(external ? { target: '_blank', rel: 'noopener' } : {})}
          className={ctaClass}
        >
          Request a Founders Circle Briefing
        </a>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg
      width="180"
      height="36"
      viewBox="0 0 240 48"
      role="img"
      aria-label="Ekantik 500"
      className="h-9 w-auto"
    >
      <text
        x="0"
        y="34"
        fontFamily="Playfair Display, Georgia, serif"
        fontSize="28"
        fill="currentColor"
        fontWeight="600"
        letterSpacing="0.5"
      >
        Ekantik
      </text>
      <text
        x="118"
        y="34"
        fontFamily="Source Sans Pro, system-ui, sans-serif"
        fontSize="18"
        fill="#C8A951"
        letterSpacing="2"
      >
        500
      </text>
    </svg>
  );
}
