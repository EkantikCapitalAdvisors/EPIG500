export function getSchedulerHref(): string {
  const url = process.env.NEXT_PUBLIC_SCHEDULER_URL;
  const fallback = process.env.NEXT_PUBLIC_FALLBACK_EMAIL || 'hiren@ekantikcapital.com';
  if (url && url.length > 0) return url;
  const subject = encodeURIComponent('Ekantik 500 — Founders Circle Briefing Request');
  const body = encodeURIComponent(
    'Hello,\n\nI would like to request a 30-minute Founders Circle briefing on the Ekantik 500 strategy.\n\nName:\nAvailability:\n\nThank you.',
  );
  return `mailto:${fallback}?subject=${subject}&body=${body}`;
}

export function isSchedulerConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SCHEDULER_URL);
}
