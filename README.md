# Ekantik 500 Landing Page

Public marketing site for the **Ekantik 500** strategy at `epig500.ekantikcapital.com`.
Built per the v1.3 specification: defined-risk long equity with structural hedge property.

## Stack

- Next.js 14 (App Router) with `output: 'export'` for static GitHub Pages deploy
- TypeScript, Tailwind CSS, Recharts
- Supabase (form storage), Resend (transactional email), Cal.com (scheduler) — all env-gated
- Plausible (analytics) — env-gated

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # static export to ./out
npm run compliance:scan
```

Copy `.env.example` to `.env.local` and fill in the four scaffolded integrations
(Supabase, Resend, Cal.com URL, Plausible). The site renders fully without any of
these set — forms succeed against a stub, the scheduler CTA falls back to `mailto:`,
and analytics events log to the dev console.

## Deployment

`main` branch pushes deploy to GitHub Pages via `.github/workflows/deploy.yml`.
The `public/CNAME` file pins the custom domain. The workflow runs the compliance
scan before building; build fails if forbidden phrasings are detected.

Required GitHub secrets:

| Secret | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Email capture writes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Email capture writes |
| `NEXT_PUBLIC_SCHEDULER_URL` | Cal.com link for primary CTA |
| `NEXT_PUBLIC_FALLBACK_EMAIL` | mailto fallback if scheduler unset |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Analytics domain |

## Repo layout

```
app/                  # App Router pages: /, /methodology, /trades, /reports, /dashboard
components/           # Section components (Hero, Edge, Promise, HedgeProperty, Engine, Verification, CTA)
components/charts/    # Recharts components (Drawdown, StressEvent, CorrelationScatter)
components/ui/        # StatTable, Accordion, SampleDataBadge
components/forms/     # EmailCapture, SchedulerCTA
data/                 # Sample JSON datasets + bracketed config tokens
lib/                  # supabase, analytics, cta, copy
public/               # CNAME, logo, og-image
scripts/              # generate-sample-data, compliance-scan
.github/workflows/    # deploy.yml
```

## Inputs still needed from Hiren (per spec §10)

All sample placeholders are clearly marked in the UI ("Sample data — pending production update").
Swap-in points:

| # | Item | File / token | Spec section |
|---|---|---|---|
| 1 | 8 named robustness tests | `data/methodology.json` → `tests` | §3.2 |
| 2 | Profit buffer threshold | `data/config.json` → `BUFFER_THRESHOLD` | §3.5 |
| 3 | Correction event trigger | `data/config.json` → `CORRECTION_TRIGGER` | §3.5 |
| 4 | Maximum leverage ratio | `data/config.json` → `MAX_LEVERAGE` | §3.5 |
| 5 | Equity curve / drawdown JSON (15-yr) | `data/equity_curve.json` → `series` | §5.1 |
| 6 | Stress event windows + strategy returns | `data/stress_events.json` → `events` | §5.2 |
| 7 | Beta in up / down / stress regimes | `data/config.json` → `BETA_UP`/`BETA_DOWN`/`BETA_STRESS` | §3.4 |
| 8 | Monthly returns scatter dataset | `data/monthly_returns.json` → `series` | §5.3 |
| 9 | Hero headline selection | `components/Hero.tsx` (default Option A) | §3.1 |
| 10 | Minimum investable assets qualifier | `data/config.json` → `MIN_INVESTABLE_ASSETS` | §3.7 |
| 11 | Logo files (SVG, PNG) | `public/logo.svg` (placeholder) | Header / footer |
| 12 | ADV registration status / link | `data/config.json` → `ADV_LINK` / `ADV_STATUS` | §6.5 |
| 13 | Scheduler URL (Cal.com) | env: `NEXT_PUBLIC_SCHEDULER_URL` | §3.7 |

To regenerate sample chart data: `node scripts/generate-sample-data.mjs`.

## Compliance discipline

The build runs `scripts/compliance-scan.mjs`, which fails on:

- Forbidden tokens: `guaranteed`, `principal protection`, `you will earn`, `risk-free`, `always negatively correlated`
- Numeric performance references (e.g. `16%`, `CAGR`) that lack a `backtested` / `live` / `forward-looking` qualifier within ±240 characters

To intentionally allow a match (e.g. inside a disclaimer that contains "not guaranteed"), tag the surrounding context with `ALLOW-COPY`.

## Phase 2 (post-launch)

- Live dashboard with real-time positions
- Auth-gated Founders Circle area
- Monthly live report publication automation
- Full trade log
- Live-vs-backtest tracking
- A/B testing of hero headline variants
