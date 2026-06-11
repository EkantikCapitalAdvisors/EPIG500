// §7.6 events. No-op when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is unset; logs to console in dev.

export type AnalyticsEvent =
  | 'hero_cta_click'
  | 'proof_section_view'
  | 'drawdown_chart_interaction'
  | 'hedge_section_view'
  | 'stress_chart_interaction'
  | 'scatter_expand'
  | 'methodology_expand'
  | 'briefing_requested'
  | 'briefing_scheduled'
  | 'email_subscribed';

declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: Record<string, string | number | boolean> }) => void;
  }
}

export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined') return;
  if (window.plausible) {
    window.plausible(event, props ? { props } : undefined);
    return;
  }
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[analytics]', event, props ?? '');
  }
}
