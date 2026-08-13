# Futures engine v1 — retired archive

**Retired:** 2026-08 · per **EPIG500-REDESIGN-V3.1**
**Status:** RETIRED from the public EPIG 500 surface — **preserved, not destroyed.**
**FP protocol disclosure ref:** `[TO BE FILED — Item C, FP-MOPS-V1.7 disclosure]`

## What this is
The intraday **/ES futures** engine was retired from the public EPIG 500 architecture
and replaced by a stocks & options overlay (its record starts at zero). Per the
V3.1 reversibility requirement, the futures material is **archived intact here**, not
deleted, so a futures sleeve can be reinstated later under its own gates and its own
record (see the spec's REINSTATEMENT PATH, R.1–R.4).

## Contents
- `trades.json` — the full futures trade record, verbatim (Period 1 Telegram + Period 2 protocol-bound).
- `alerts.html.snapshot` — the public futures record page as it stood at retirement.
- `dashboard.js.snapshot` — the futures-record renderer.
- (index.html removed sections are preserved in git history at the pre-retirement commit.)

## Reinstatement (summary — full rules in the spec)
Futures returns only through the front door: its own countersigned annex, its own CEG
claim set, its own record (clearly periodized, never blended with the options record),
its own dashboard module mounted from the engine registry (`data/engines.json`), and an
eligibility re-check. Never presented as evidence for the options engine.

## Do NOT
- Link this archive from any public page or sitemap.
- Present any figure here as evidence for the stocks & options engine.
- Re-mount silently — reinstatement is a disclosed protocol event, same as this removal.
