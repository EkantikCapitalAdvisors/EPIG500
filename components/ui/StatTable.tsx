import { ReactNode } from 'react';

export type StatRow = {
  label: ReactNode;
  value: ReactNode;
  emphasis?: 'gold' | 'navy' | 'navy-lg' | 'live';
};

type Props = {
  caption?: string;
  rows: StatRow[];
  qualifier: ReactNode;
  variant?: 'default' | 'panel';
  ariaLabel: string;
};

export function StatTable({ caption, rows, qualifier, variant = 'default', ariaLabel }: Props) {
  const wrapper =
    variant === 'panel'
      ? 'rounded-lg bg-soft-ivory p-6 md:p-8 shadow-[0_1px_0_rgba(27,42,74,0.08)]'
      : '';
  return (
    <div className={wrapper}>
      {caption ? (
        <h3 className="font-serif text-2xl md:text-3xl text-deep-navy mb-4 text-center">{caption}</h3>
      ) : null}
      <table className="w-full text-deep-navy" aria-label={ariaLabel}>
        <tbody>
          {rows.map((row, i) => {
            const valueClasses = (() => {
              switch (row.emphasis) {
                case 'gold':
                  return 'text-warm-gold font-semibold';
                case 'navy-lg':
                  return 'font-bold text-[1.25em] text-deep-navy';
                case 'live':
                  return 'font-semibold text-deep-navy';
                case 'navy':
                default:
                  return 'font-semibold text-deep-navy';
              }
            })();
            return (
              <tr
                key={i}
                className={`border-t border-deep-navy/10 first:border-t-0 ${
                  i === rows.length - 1 ? 'border-b border-deep-navy/10' : ''
                }`}
              >
                <th
                  scope="row"
                  className="py-3 pr-4 text-left font-normal text-deep-navy/80 align-middle"
                >
                  <span className="inline-flex items-center gap-2">
                    {row.label}
                    {row.emphasis === 'live' ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-bright-teal/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-bright-teal"
                        aria-label="Live indicator"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-bright-teal" aria-hidden />
                        Live
                      </span>
                    ) : null}
                  </span>
                </th>
                <td className={`py-3 pl-4 text-right ${valueClasses}`}>{row.value}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-4 text-small text-slate-gray text-center md:text-left">{qualifier}</p>
    </div>
  );
}
