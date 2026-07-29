# Private hosting runbook — gate the whole site behind Cloudflare Access

**Goal:** make the entire EPIG 500 site (landing, dashboard, alerts, admin, and all
`data/*.json` + raw IBKR statements) visible **only to an email allowlist**, so nothing
is "held out" to the public. Whether a given audience/claim is permissible is **counsel's
call**; this runbook only enforces "only invited people can load it."

## Why a client-side password is NOT enough
The site is static hosting on a **public GitHub Pages repo**. Two public bypasses exist:
1. `github.com/EkantikCapitalAdvisors/EPIG500` — the repo itself serves every file
   (`data/charter.json`, `data/nav.json`, `data/periodic.json`, `data/raw/*.xml`) to anyone.
2. The `*.github.io` Pages URL — public regardless of the custom domain.
A JavaScript password gate does not stop either. Real privacy requires server-enforced auth.

## Target architecture
```
private GitHub repo  →  Cloudflare Pages (deploy on push)  →  Cloudflare Access (email allowlist)  →  epig500.ekantikcapital.com
```
The nightly `charter-sync` Action still commits data to the (now private) repo; Cloudflare
Pages redeploys on each push, so the gated site keeps updating. No pipeline changes needed.

## Prerequisite
- `ekantikcapital.com` must be managed in **Cloudflare** (nameservers pointed to Cloudflare).
  If DNS is elsewhere today, move it to Cloudflare first (Cloudflare → Add a site).

## Recommended sequence — kill public exposure FIRST (brief downtime)
Because this is a holding-out concern, remove public access before rebuilding.

1. **Take the public site down immediately:**
   - GitHub → repo **Settings → Pages → set Source to "None"** (stops the live public site + data).
   - GitHub → repo **Settings → General → Danger Zone → Change visibility → Private**
     (stops public browsing of the repo files). Actions/`charter-sync` keep working on a private repo.
2. **Stand up the gated site on Cloudflare Pages:**
   - Cloudflare **Workers & Pages → Create → Pages → Connect to Git** → pick the (now private) repo.
   - Build settings: **Framework preset = None**, **Build command = (empty)**, **Output directory = `/`**
     (this is a plain static site — no build step).
   - Deploy. Confirm the `*.pages.dev` preview renders.
3. **Attach the custom domain:**
   - Pages project → **Custom domains → Set up a domain → `epig500.ekantikcapital.com`**.
     Cloudflare adds the DNS record automatically (domain is already on Cloudflare).
4. **Gate it with Cloudflare Access (Zero Trust):**
   - Cloudflare **Zero Trust → Access → Applications → Add an application → Self-hosted**.
   - Application domain: `epig500.ekantikcapital.com` (add a second app for the bare/root if used).
   - **Policy:** Action = **Allow**, Include = **Emails** → paste the invitee list
     (or **Emails ending in** a domain, or an **Access Group** you maintain).
   - Identity/login: **One-time PIN** (email a code) is simplest; Google/OIDC also fine.
   - Free tier covers up to 50 seats.
5. **Verify the gate holds:**
   - Load `epig500.ekantikcapital.com` in a private window → you should hit the Access login.
   - After login, spot-check a data file directly, e.g. `…/data/charter.json` and
     `…/data/raw/<date>.xml` — both must require login too (they will, same origin).
   - Confirm the old `*.github.io` URL no longer serves (Pages disabled + repo private).
6. **Confirm the pipeline still flows:** trigger `charter-sync` (Actions → Run workflow);
   it commits to the private repo → Cloudflare Pages redeploys → gated site updates.

## If downtime is unacceptable (gate-then-cutover)
Do steps 2–5 first on the `*.pages.dev` domain, verify Access works, then do step 1 and
point the custom domain at Pages. There is a short window where the public Pages site is
still up during setup — acceptable only if counsel is OK with that gap.

## Extra care
- **`admin.html`** (trade publisher) is the most sensitive surface. Keep it behind the same
  Access app; consider a **stricter, separate policy** (a smaller allowlist) just for `/admin.html`.
- Once gated, `robots noindex` is moot (crawlers can't reach it) but harmless to leave.
- The `CNAME` file in the repo only mattered for GitHub Pages; it's inert once Pages is off.
  Leave it or delete it — Cloudflare Pages uses its own custom-domain config.
- Making the repo private does not affect the `charter-sync` schedule or the GitHub Actions
  minutes on the free plan.

## What is genuinely private after this
Every page **and** every data file (`charter/nav/periodic.json`, raw statements) sits behind
the email gate. Nothing about the strategy or the record is reachable without an invite.
