# EPIG 500 V3.1 — COMMIT 1 EXECUTION PLAN (for approval)
**Ref:** EPIG500-REDESIGN-V3.1-2026-08 · Commit 1 (UNGATED) only · nothing here ships until you approve
**Scope rule:** structural removals + terminology + archive + instrument-modular scaffolding. **No new performance or yield claims** (those are Commit 2, gated). Archive method: **`/archive/futures-v1/` folder in repo** (preserve, never destroy).

---

## 0 · Delivery
- One **unmerged PR** for your review before anything is public.
- An **archive README** noting the retirement + a placeholder for the Item C protocol-disclosure reference. (Filing the formal FP disclosure is yours; I only stamp the reference.)
- Acceptance greps (§1.5) run and pasted into the PR.

## 1 · Archive setup — `/archive/futures-v1/`
1. Create `/archive/futures-v1/` + `README.md` (dated; states: futures engine retired from public surface per V3.1, record preserved verbatim, reinstatement path per spec R.1–R.4, Item C disclosure ref `[TBD]`).
2. Copy **verbatim** into the archive: `data/trades.json`, `alerts.html` (the futures record page), `js/dashboard.js` (futures-record renderer), and a snapshot of each removed index.html section (so the copy is human-readable, not only in git history).
3. Nothing in `/archive/` is linked from any public page or sitemap.

## 2 · Engine registry (R.1) — instrument-modular, built now
- New `data/engines.json`:
  ```
  { "engines": [
    { "id":"options-v1", "label":"Overlay Engine · stocks & options", "instrument":"equity_options",
      "status":"live", "recordSource":"data/…(Commit 2)", "gates":["beat-or-protect","yield-gate(Commit2)"] },
    { "id":"futures-v1", "label":"Intraday Engine · /ES futures (retired)", "instrument":"futures",
      "status":"retired", "recordSource":"archive/futures-v1/trades.json", "gates":["ED-05a/b","OP-03"] }
  ] }
  ```
- Barbell label, engine section, dashboard record module, and battery **read the registry** so a future `futures-v1 → status:live` re-mount needs zero copy surgery. (Commit 1 scaffolds the registry + wires the barbell/label; the gauges themselves are Commit 2.)

## 3 · index.html — section-by-section (line refs are current `main`)
| Spec item | Section / lines | Action |
|---|---|---|
| §1.1 terminology | meta 7/11/30; barbell 262/266/281; cash body; 610 | **Rewrite** per §1.1 map ("stocks and options strategy", "Overlay Engine · stocks & options", "CASH · ENGINE COLLATERAL") |
| The Proven Engine | `#proven-engine` 308–321 + bridge 810–817 | **Remove** → **Republishing placeholder** card (§1.2 verbatim) |
| Booster layer in chart | `#stacks-over-time` 323–409 (toggle, $/yr, 9.16× table 396–400, source note 405, /ES-/MES notes) | **Strip Booster**, keep chart with **foundation + cash layers only**; remove trades.json feed |
| Engine live-record vs kill | `#engine-live-bounded` 411–434 | **Remove/archive** (futures-fed) → placeholder or fold into republishing |
| Stack / engine-range figures | `#how-the-target-adds-up` 436–470 (17–26, 30R, 16–17%, 11–15%) + hero/honest-problem 189 + summary strip + footer | **Remove** every "17–26%/yr", "16–17%/yr", "11–15% engine range (30R×0.5%)". **Per §2.8: ship no stack figure.** Foundation +6–11% modeled range **survives** (do-not-touch) |
| Methodology Provenance | `#battery` 490–530 (cards 497–499) | **Remove** 01/02/03 provenance cards (futures-derived) |
| Signal Continuity | `#continuity` 544–603 (Telegram, 196, Period 1/2, **Two-records block**) | **Remove whole section** (Two-records rebuilt in Commit 2) |
| /ES–/MES sizing | `#ladder` 605–758 (staircase + cadence) | **Strip all /ES/MES/contract denomination**; 0.5%-NLV anchor + "earned, never assumed" **survive** as % NLV. No v1.7 figures (those are Commit 2) — holes get the republishing note |
| /ES hard-kill figures | `#falsifiability` 1070–1227 (ED-05a/b in /ES pts) | **Strip /ES point figures**; keep instrument-agnostic doctrine; gate /ES-specific hard-kill behind republishing note (redefinition is v1.7 = Commit 2) |
| FAQ | `#faq` 1385–1412 | **Remove** Telegram / blended-record / ECFS-futures answers; **add interim ECFS answer** (§1.4 verbatim) |
| Footer | 1426+ | **Remove** Telegram + /MES-sized-record disclaimer sentences |

## 4 · Cascade to sibling pages (§1.3)
- **alerts.html** → the futures record page: **archive the page**, replace public route with the **republishing placeholder** (and remove/repoint the 9 landing links that point to it). No futures record renders publicly.
- **dashboard.html** (the Charter/custodian scoreboard) → largely instrument-agnostic (custodian NAV vs S&P). Commit 1: **terminology only** (sleeve label "Intraday Engine" → registry-driven "Overlay Engine · stocks & options"); the custodian gauges are Commit 2 (§2.3).
- **run-the-math.html** → keep the instrument-agnostic calculators (Repair Bill, Volatility Tax, volatility explorer). **Gate** the Worst-Case interactive + 8-test battery behind the republishing card (futures-fed; restart from zero in Commit 2).

## 5 · Acceptance greps (§1.5, run on index.html)
`/ES`→0 · `/MES`→0 · `telegram`(i)→0 · `196`→0 · `futures`(i)→**1** (ECFS answer only, "futures strategy") · `contract`(i)→0 · `17–26`→0 · `30R`→0 · `16–17%`→0. Plus global forbidden-strings pass.

## 6 · Do-not-touch (§1.6, protect)
Anatomy/239-day · asymmetric-capture block · "beta cannot beat itself" · Harbor/Fire/Breaker (Circuit Breaker's 0.5%/trade survives) · Re-Entry Ladder · **foundation +6–11%/yr modeled range (overlay v1.3)** · Ekantik Standard · Founder · pre-registration mechanics · educational/no-offer posture · brand system.

---

## RISKS / DECISIONS to confirm before I execute
1. **Ladder + Falsifiability become partial in Commit 1** — I strip /ES denomination but can't add v1.7 replacements (not countersigned). Those sections lean on the republishing placeholder until Commit 2. OK, or hold those two sections' edits until v1.7?
2. **alerts.html disposition** — archive the page and replace the public route with the republishing placeholder (my plan), vs. leave a bare 404. Confirm placeholder.
3. **Stack figure** — I follow §2.8 and remove it entirely (no "~18–23%" successor). Confirm.
4. **"contract"→0 grep** is aggressive — it also catches non-futures uses (e.g. "contract" in legal/founder copy if any). I'll verify each hit is futures-related before removing.
5. **The removal is a disclosed protocol event (Item C)** — I stamp the archive README + PR with a disclosure-reference placeholder; you file the formal FP disclosure. Confirm that division.

## What I will NOT do in Commit 1 (Commit 2 / gated)
New proof-posture copy · 1%/month yield claim · custodian gauges · v1.7 risk figures · options disclosures · eligibility copy · any stack number.
