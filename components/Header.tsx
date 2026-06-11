import Link from 'next/link';
import { getSchedulerHref, isSchedulerConfigured } from '@/lib/cta';

export function Header() {
  const href = getSchedulerHref();
  const external = isSchedulerConfigured();
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="container-page flex items-center justify-between py-6 md:py-8">
        <Link href="/" aria-label="Ekantik 500 home" className="inline-flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={180} height={36} className="h-9 w-auto" />
        </Link>
        <a
          href={href}
          {...(external ? { target: '_blank', rel: 'noopener' } : {})}
          className="btn-secondary text-sm md:text-base"
        >
          Request a Founders Circle Briefing
        </a>
      </div>
    </header>
  );
}
