'use client';

import { ReactNode, useId, useState } from 'react';
import { track, AnalyticsEvent } from '@/lib/analytics';

type Props = {
  label: string;
  children: ReactNode;
  trackEvent?: AnalyticsEvent;
};

export function Accordion({ label, children, trackEvent }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="border-t border-deep-navy/15">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && trackEvent) track(trackEvent);
        }}
        className="flex w-full items-center justify-between py-4 text-left font-medium text-deep-navy hover:text-warm-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-gold"
      >
        <span>{label}</span>
        <span aria-hidden className={`transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      <div
        id={id}
        role="region"
        hidden={!open}
        className={`pb-6 ${open ? 'block' : 'hidden'}`}
      >
        {children}
      </div>
    </div>
  );
}
