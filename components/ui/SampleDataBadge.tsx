import { SAMPLE_DATA_LABEL } from '@/lib/copy';

export function SampleDataBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-warm-gold/40 bg-warm-gold/10 px-3 py-1 text-[12px] uppercase tracking-wider text-deep-navy ${className}`}
    >
      <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-warm-gold" aria-hidden />
      {SAMPLE_DATA_LABEL}
    </span>
  );
}
