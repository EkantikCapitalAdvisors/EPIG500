'use client';

import { getSchedulerHref, isSchedulerConfigured } from '@/lib/cta';
import { track } from '@/lib/analytics';

export function SchedulerCTA({ children, className = 'btn-primary' }: { children: React.ReactNode; className?: string }) {
  const href = getSchedulerHref();
  const external = isSchedulerConfigured();
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener' } : {})}
      onClick={() => track('briefing_requested', { configured: external ? 'cal' : 'mailto' })}
      className={className}
    >
      {children}
    </a>
  );
}
