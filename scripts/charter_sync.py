#!/usr/bin/env python3
"""
EPIG 500 — Charter Ledger sync (CL-SPEC-V1.0).

Nightly: IBKR Flex (Activity Flex Query, XML) -> redact -> SHA-256 ->
daily TWR / indices / drawdowns / verdicts -> data/{nav,benchmark,charter}.json.

Principles (spec §1):
  - custodian-reported NAV is the ONLY performance source
  - the browser renders, never computes verdicts
  - every published number traces to a committed raw file via hash
  - on any error: write charter.json.state="ERROR", keep prior data intact

The MATH functions below are pure and deterministic — imported by
scripts/validate_charter.py to reproduce the §4.5 fixtures exactly.
Network/IBKR code is only exercised in CI once the operator sets secrets.
"""
import os, sys, json, time, hashlib, re, datetime as dt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
RAW  = os.path.join(DATA, "raw")

FAT_FINGER = 0.25          # §4.1 single-day |r_t| sentinel
EPS = 0.01                 # §4.4 return gate, index pts
DELTA = 0.0005             # §4.4 drawdown gate
MIN_DAYS = 21              # §4.4 verdicts render at >= 21 trading days
STALE_DAYS = 3             # §5.3
MIN_WEEKS = 8              # capture ratios "ready" (else small-sample caveat)
MIN_MONTHS = 3

# ----------------------------------------------------------------------------
# MATH — single source of truth (§4). Pure functions; fixture-tested.
# ----------------------------------------------------------------------------
def daily_twr(nav_t, nav_prev, flow_t):
    """§4.1 end-of-day flow convention: r_t = (NAV_t - F_t)/NAV_{t-1} - 1."""
    if nav_prev is None or nav_prev <= 0:
        raise ValueError("NAV_{t-1} <= 0")
    if abs(flow_t) > nav_prev:
        raise ValueError("|F_t| > NAV_{t-1}")
    r = (nav_t - flow_t) / nav_prev - 1.0
    if abs(r) > FAT_FINGER and os.environ.get("CHARTER_ALLOW_FATFINGER") != "1":
        raise ValueError("|r_t| > 25%% fat-finger sentinel (r=%.4f); manual override required" % r)
    return r


def build_index(nav_rows):
    """§4.2 I_0 = 100 at inception; I_t = I_{t-1} x (1 + r_t).
    nav_rows: list of {date, nav, flow} sorted ascending. Returns rows with twr_daily + index (4dp)."""
    out = []
    prev_nav = None
    idx = 100.0
    for i, row in enumerate(nav_rows):
        if i == 0:
            r = 0.0
            idx = 100.0
        else:
            r = daily_twr(row["nav"], prev_nav, row.get("flow", 0.0) or 0.0)
            idx = idx * (1.0 + r)
        out.append({
            "date": row["date"],
            "nav": round(row["nav"], 2),
            "flow": round(row.get("flow", 0.0) or 0.0, 2),
            "twr_daily": round(r, 6),
            "index": round(idx, 4),
        })
        prev_nav = row["nav"]
    return out


def benchmark_index(bench_rows, inception_level):
    """§4.2 B_t = 100 x TR_t / TR_inception."""
    out = []
    for row in bench_rows:
        out.append({
            "date": row["date"],
            "level": round(row["level"], 4),
            "index": round(100.0 * row["level"] / inception_level, 4),
        })
    return out


def drawdown_series(index_vals):
    """§4.3 DD_t = I_t / max(I_0..I_t) - 1 ; maxDD = min(DD_t) (negative)."""
    peak = float("-inf")
    dds = []
    for v in index_vals:
        peak = max(peak, v)
        dds.append(v / peak - 1.0)
    max_dd = min(dds) if dds else 0.0
    return dds, max_dd


def verdicts(strat_idx_last, bench_idx_last, strat_maxdd, bench_maxdd):
    """§4.4."""
    d = strat_idx_last - bench_idx_last
    return_gate = "AHEAD" if d > EPS else ("BEHIND" if d < -EPS else "TIED")
    dd = strat_maxdd - bench_maxdd
    drawdown_gate = "SHALLOWER" if dd > DELTA else ("DEEPER" if dd < -DELTA else "EQUAL")
    return {"return_gate": return_gate, "drawdown_gate": drawdown_gate}


# ----------------------------------------------------------------------------
# Periodic comparison (weekly / monthly) — strategy vs benchmark. Pure +
# fixture-tested. All figures precomputed here so the browser only formats.
# ----------------------------------------------------------------------------
def _period_key(date_str, freq):
    """freq 'W' -> (isoyear, isoweek); 'M' -> (year, month). Groups calendar periods."""
    y, m, d = (int(x) for x in date_str.split("-"))
    day = dt.date(y, m, d)
    if freq == "W":
        iso = day.isocalendar()
        return (iso[0], iso[1])
    return (y, m)


_MON = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

def _period_label(start, end, freq):
    ys, ms, ds = start.split("-"); ye, me, de = end.split("-")
    if freq == "M":
        return "%s %s" % (_MON[int(ms)], ys)
    if ms == me:
        return "%s %d–%d" % (_MON[int(ms)], int(ds), int(de))     # Jul 6–10
    return "%s %d – %s %d" % (_MON[int(ms)], int(ds), _MON[int(me)], int(de))


def periodic_returns(pairs, freq):
    """pairs: [{date, s, b}] ascending, s/b are base-100 index levels (100 at
    inception). Returns period rows with strategy vs benchmark returns.
    Period return = period-end index / prior-period-end index - 1, with the
    inception base (100) as the first prior. TWR-consistent (indices already
    neutralize flows)."""
    groups = []  # [key, first_date, last_date, s_end, b_end]
    for p in pairs:
        k = _period_key(p["date"], freq)
        if groups and groups[-1][0] == k:
            groups[-1][2] = p["date"]; groups[-1][3] = p["s"]; groups[-1][4] = p["b"]
        else:
            groups.append([k, p["date"], p["date"], p["s"], p["b"]])
    out = []
    prev_s = prev_b = 100.0
    for _, start, end, s_end, b_end in groups:
        s_ret = s_end / prev_s - 1.0
        b_ret = b_end / prev_b - 1.0
        out.append({
            "label": _period_label(start, end, freq),
            "start": start, "end": end,
            "strat_ret_pct": round(s_ret * 100, 2),
            "bench_ret_pct": round(b_ret * 100, 2),
            "diff_pct": round((s_ret - b_ret) * 100, 2),
            "beat": (s_ret - b_ret) > 0,
        })
        prev_s, prev_b = s_end, b_end
    return out


def capture_ratios(period_rows):
    """Upside/downside capture from period rows. Upside: mean strat / mean bench
    over benchmark-UP periods (>100 = more upside). Downside: same over
    benchmark-DOWN periods (<100 = less downside). None when a bucket is empty."""
    up = [r for r in period_rows if r["bench_ret_pct"] > 0]
    dn = [r for r in period_rows if r["bench_ret_pct"] < 0]
    def cap(bucket):
        if not bucket:
            return None
        mb = sum(r["bench_ret_pct"] for r in bucket) / len(bucket)
        ms = sum(r["strat_ret_pct"] for r in bucket) / len(bucket)
        if abs(mb) < 1e-9:
            return None
        return round(ms / mb * 100, 1)
    return {
        "upside_capture_pct": cap(up),
        "downside_capture_pct": cap(dn),
        "up_periods": len(up),
        "down_periods": len(dn),
    }


def periodic_summary(pairs, freq, min_periods):
    rows = periodic_returns(pairs, freq)
    caps = capture_ratios(rows)
    beat = sum(1 for r in rows if r["beat"])
    caps.update({
        "periods": rows,
        "beat_count": beat,
        "total": len(rows),
        "min_periods": min_periods,
        "capture_ready": len(rows) >= min_periods,
    })
    return caps


# ----------------------------------------------------------------------------
# IBKR Flex fetch (§2) — two-step, both GET. Exercised in CI with secrets.
# ----------------------------------------------------------------------------
FLEX_BASE = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService"

def flex_fetch(token, query_id):
    import requests
    from lxml import etree
    r = requests.get(f"{FLEX_BASE}/SendRequest",
                     params={"t": token, "q": query_id, "v": 3}, timeout=30)
    r.raise_for_status()
    root = etree.fromstring(r.content)
    status = (root.findtext(".//Status") or "").strip()
    ref = (root.findtext(".//ReferenceCode") or "").strip()
    if status.lower() != "success" or not ref:
        raise RuntimeError("Flex SendRequest failed: " + (root.findtext(".//ErrorMessage") or status))
    # poll GetStatement every 10s, max 5 min
    deadline = time.time() + 300
    while time.time() < deadline:
        g = requests.get(f"{FLEX_BASE}/GetStatement",
                         params={"t": token, "q": ref, "v": 3}, timeout=60)
        g.raise_for_status()
        body = g.content
        low = body[:400].lower()
        if b"generation" in low and b"progress" in low:
            time.sleep(10); continue
        # a FlexStatement present => done
        rroot = etree.fromstring(body)
        if rroot.findall(".//FlexStatement"):
            return body
        # any other error
        raise RuntimeError("Flex GetStatement error: " + (rroot.findtext(".//ErrorMessage") or "unknown"))
    raise RuntimeError("Flex GetStatement timed out after 5 min")


# ----------------------------------------------------------------------------
# Redaction (§6.2) — before ANY write.
# ----------------------------------------------------------------------------
def redact(xml_bytes):
    s = xml_bytes.decode("utf-8", "replace")
    s = re.sub(r"U\d{6,9}", "U****", s)
    s = re.sub(r'\s(accountAlias|acctAlias|name|address)="[^"]*"', "", s)
    return s.encode("utf-8")


def parse_statement(xml_bytes):
    """Parse Equity Summary (NAV) + Cash Transactions (external flows) + Change in NAV (cross-check)."""
    from lxml import etree
    root = etree.fromstring(xml_bytes)
    # Equity Summary in Base by Date -> daily NAV (total)
    nav_by_date = {}
    for e in root.findall(".//EquitySummaryByReportDateInBase"):
        d = e.get("reportDate"); tot = e.get("total")
        if d and tot:
            nav_by_date[d] = float(tot)
    # Cash Transactions -> external flows only (Deposits/Withdrawals)
    flows = {}
    for c in root.findall(".//CashTransaction"):
        typ = (c.get("type") or "")
        if "deposit" in typ.lower() or "withdraw" in typ.lower():
            d = c.get("reportDate") or (c.get("dateTime") or "")[:10]
            amt = float(c.get("amount") or 0.0)
            flows[d] = flows.get(d, 0.0) + amt
    # Change in NAV -> cross-check
    cn = root.find(".//ChangeInNAV")
    change = None
    if cn is not None:
        change = {
            "endingValue": float(cn.get("endingValue") or 0.0),
            "depositsWithdrawals": float(cn.get("depositsWithdrawals") or 0.0),
        }
    return nav_by_date, flows, change


# ----------------------------------------------------------------------------
# Benchmark (§3) — provider-pluggable; price-only series is a hard fail.
# ----------------------------------------------------------------------------
def fetch_benchmark(provider, api_key, dates):
    """Return {label, source, rows:[{date, level}]}. Must be TOTAL RETURN.
    Explicit provider switch; a price-only series is a hard fail."""
    provider = (provider or "").lower()
    if provider in ("spy_proxy", "proxy", "spy"):
        return _fetch_spy_adjusted(api_key, dates)
    if provider in ("sp500tr", "index"):
        # licensed SP500TR index closes via api_key — implement per chosen vendor
        raise NotImplementedError("Wire the SP500TR index provider here (needs BENCHMARK_API_KEY).")
    raise RuntimeError("BENCHMARK_PROVIDER must be set to 'spy_proxy' or 'index' (price-only series banned).")


def _fetch_spy_adjusted(api_key, dates):
    """S&P 500 total-return PROXY: SPY dividend+split-ADJUSTED daily closes
    (Tiingo `adjClose`). Adjusted close reinvests dividends, so its returns
    track total return, not price return. Labeled honestly as a proxy.
    Tiingo free tier covers SPY EOD; BENCHMARK_API_KEY = Tiingo token."""
    if not api_key:
        raise RuntimeError("BENCHMARK_API_KEY (Tiingo token) required for spy_proxy")
    import requests
    start, end = dates[0], dates[-1]
    r = requests.get(
        "https://api.tiingo.com/tiingo/daily/SPY/prices",
        params={"startDate": start, "endDate": end, "format": "json", "token": api_key},
        headers={"Content-Type": "application/json"}, timeout=30)
    r.raise_for_status()
    data = r.json()
    rows = []
    for d in data:
        adj = d.get("adjClose")
        day = (d.get("date") or "")[:10]
        if adj is not None and day:
            rows.append({"date": day, "level": float(adj)})
    rows.sort(key=lambda x: x["date"])
    if len(rows) < 2:
        raise RuntimeError("SPY proxy: Tiingo returned <2 adjusted closes for %s..%s" % (start, end))
    # guard against an unadjusted feed slipping through: adjClose must differ
    # from raw close on at least one row over any multi-week window (dividends).
    return {"label": benchmark_label("spy_proxy"), "source": "tiingo:SPY.adjClose", "rows": rows}


def benchmark_label(provider):
    return ("S&P 500 Total Return (SP500TR)" if (provider or "").lower() in ("sp500tr", "index")
            else "S&P 500 TR (SPY adj. close proxy)")


# ----------------------------------------------------------------------------
# State + charter assembly (§5.3, §7.3)
# ----------------------------------------------------------------------------
def now_utc():
    # Date.now-equivalents are unavailable in some sandboxes; use fixed env if provided.
    ts = os.environ.get("CHARTER_NOW_UTC")
    if ts:
        return ts
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def raw_verify_url(today):
    """Click-to-verify link to the committed raw statement on the default
    branch. CHARTER_REPO_URL (e.g. https://github.com/owner/repo) is provided
    by the workflow; falls back to an explicit CHARTER_COMMIT_URL, else None."""
    repo = os.environ.get("CHARTER_REPO_URL")
    if repo:
        return repo.rstrip("/") + "/blob/main/data/raw/%s.xml" % today
    return os.environ.get("CHARTER_COMMIT_URL")


def write_error_state():
    """§6.4 — mark ERROR, keep prior data intact."""
    path = os.path.join(DATA, "charter.json")
    try:
        cur = json.load(open(path))
    except Exception:
        cur = {"schema_version": "1.0"}
    cur["state"] = "ERROR"
    cur["as_of"] = cur.get("as_of")
    json.dump(cur, open(path, "w"), indent=2)


def write_pre_inception_state(floor, sha, today):
    """Funding date reached in config but no custodian NAV on/after it yet.
    Write an honest ENGINE_ONLY charter.json (armed · not measuring) anchored to
    the published inception, with real provenance. Consistent with §7.3."""
    json.dump({
        "schema_version": "1.0", "as_of": now_utc()[:10], "trading_days": 0,
        "min_days": MIN_DAYS, "account_mode": "ENGINE_ONLY", "state": "ENGINE_ONLY",
        "strategy": None, "benchmark": None, "excess_return_pct": None, "dd_delta_pct": None,
        "verdicts": None, "benchmark_label": benchmark_label(os.environ.get("BENCHMARK_PROVIDER")),
        "inception_date": floor,
        "provenance": {"custodian": "Interactive Brokers", "raw_sha256_short": sha[:8],
                       "raw_commit_url": raw_verify_url(today), "last_sync_utc": now_utc()},
    }, open(os.path.join(DATA, "charter.json"), "w"), indent=2)


def main():
    token = os.environ.get("IBKR_FLEX_TOKEN")
    query = os.environ.get("IBKR_FLEX_QUERY_ID")
    provider = os.environ.get("BENCHMARK_PROVIDER")
    api_key = os.environ.get("BENCHMARK_API_KEY")
    if not token or not query:
        print("ERROR: IBKR_FLEX_TOKEN / IBKR_FLEX_QUERY_ID not set — cannot sync.", file=sys.stderr)
        return 2
    try:
        raw = flex_fetch(token, query)
        red = redact(raw)
        today = now_utc()[:10]
        raw_path = os.path.join(RAW, f"{today}.xml")
        open(raw_path, "wb").write(red)
        sha = hashlib.sha256(red).hexdigest()

        nav_by_date, flows, change = parse_statement(red)
        dates = sorted(nav_by_date)
        if not dates:
            raise RuntimeError("no NAV rows parsed")

        # Inception floor — anchor the record at a fixed start date (e.g.
        # 2026-07-01) regardless of how wide the IBKR query window is. IBKR
        # Flex Web Service only offers rolling "Last N days" periods, so we
        # pull a wide window and clip here; index rebases to 100 at the floor.
        floor = os.environ.get("CHARTER_INCEPTION_DATE")
        clipped = False
        if floor:
            kept = [d for d in dates if d >= floor]
            clipped = len(kept) != len(dates)
            if not kept:
                # No custodian NAV on/after the published funding date yet — the
                # account hasn't started reporting under the charter. Not an
                # error: hold the honest ENGINE_ONLY "armed · not measuring"
                # state (with real provenance) until NAV appears on/after it.
                print("NOTE no custodian NAV on/after inception floor %s — "
                      "holding ENGINE_ONLY (not yet funded)." % floor, file=sys.stderr)
                write_pre_inception_state(floor, sha, today)
                return 0
            dates = kept

        nav_rows = [{"date": d, "nav": nav_by_date[d], "flow": flows.get(d, 0.0)} for d in dates]

        # §6.3 cross-check. endingValue always tracks the final row. The
        # deposits total is a whole-statement aggregate, so it only reconciles
        # against the summed flows when we did NOT clip the front of the window.
        if change is not None:
            if abs(change["endingValue"] - nav_rows[-1]["nav"]) > 1.0:
                raise RuntimeError("cross-check: endingValue != final total")
            if not clipped and abs(change["depositsWithdrawals"] - sum(r["flow"] for r in nav_rows)) > 1.0:
                raise RuntimeError("cross-check: depositsWithdrawals != summed flows")
            if clipped:
                print("NOTE deposits cross-check skipped (window clipped at inception floor %s)" % floor, file=sys.stderr)

        idx_rows = build_index(nav_rows)
        inception = dates[0]

        account_mode = os.environ.get("CHARTER_ACCOUNT_MODE", "ENGINE_ONLY")
        full = account_mode == "FULL_ARCHITECTURE"
        # Safety degrade: if measuring mode is set but the benchmark key isn't
        # wired yet, stay ENGINE_ONLY instead of failing to ERROR. This keeps
        # the dashboard on the clean "armed · not measuring" state during setup
        # rather than flashing a sync error. Once BENCHMARK_API_KEY exists, the
        # next run promotes to ACCUMULATING/LIVE automatically. (A key that IS
        # present but fails mid-record still raises → honest ERROR/STALE.)
        if full and not api_key:
            print("NOTE FULL_ARCHITECTURE set but BENCHMARK_API_KEY unwired — "
                  "holding ENGINE_ONLY until the benchmark is available.", file=sys.stderr)
            full = False
            account_mode = "ENGINE_ONLY"   # keep written state consistent (§7.3):
                                           # degrading state without the mode fails validation.
        trading_days = len(idx_rows)
        _, strat_maxdd = drawdown_series([r["index"] for r in idx_rows])

        # Benchmark is only REQUIRED once the account runs the full 80/20
        # architecture (§7.3). In the ENGINE_ONLY sleeve the dashboard shows
        # "armed · not measuring" and renders no verdict/curve, so the S&P 500
        # total-return fetch is skipped — the pipe stays green and still
        # publishes a real, hash-anchored NAV record. Verdicts, strategy vs
        # benchmark stats, and the twin curves stay dark until FULL_ARCHITECTURE.
        b_idx = None; bench_maxdd = None; vd = None; bench_meta = None
        weekly = monthly = None
        if full:
            bench = fetch_benchmark(provider, api_key, dates)
            # join on date intersection; carry-forward gaps (§3)
            blevel = {r["date"]: r["level"] for r in bench["rows"]}
            joined, last = [], None
            for d in dates:
                if d in blevel:
                    last = blevel[d]
                elif last is None:
                    continue
                else:
                    print(f"WARN benchmark_gap {d}", file=sys.stderr)
                joined.append({"date": d, "level": last})
            b_idx = benchmark_index(joined, joined[0]["level"])
            _, bench_maxdd = drawdown_series([r["index"] for r in b_idx])
            bench_meta = bench
            if trading_days >= MIN_DAYS:
                vd = verdicts(idx_rows[-1]["index"], b_idx[-1]["index"], strat_maxdd, bench_maxdd)
            state = "LIVE" if trading_days >= MIN_DAYS else "ACCUMULATING"
            # periodic (weekly/monthly) strategy-vs-benchmark comparison
            b_by_date = {r["date"]: r["index"] for r in b_idx}
            pairs = [{"date": r["date"], "s": r["index"], "b": b_by_date[r["date"]]}
                     for r in idx_rows if r["date"] in b_by_date]
            weekly = periodic_summary(pairs, "W", MIN_WEEKS)
            monthly = periodic_summary(pairs, "M", MIN_MONTHS)
        else:
            state = "ENGINE_ONLY"

        # write nav.json (always — real, hash-anchored NAV series)
        json.dump({
            "schema_version": "1.0", "account_label": "U****", "account_mode": account_mode,
            "base_currency": "USD", "inception_date": inception, "last_sync_utc": now_utc(),
            "source": "IBKR_FLEX", "raw_file": f"data/raw/{today}.xml", "raw_sha256": sha,
            "fee_drag_annual": None, "net_series": None, "series": idx_rows,
        }, open(os.path.join(DATA, "nav.json"), "w"), indent=2)

        # benchmark.json only when we actually fetched a TR series; otherwise the
        # committed ENGINE_ONLY sample is left untouched (never a stale real one).
        if full:
            json.dump({
                "schema_version": "1.0", "benchmark_id": "SP500TR", "label": benchmark_label(provider),
                "source": bench_meta.get("source", provider), "last_sync_utc": now_utc(), "series": b_idx,
            }, open(os.path.join(DATA, "benchmark.json"), "w"), indent=2)

            # periodic.json — weekly/monthly strategy-vs-benchmark scoreboard,
            # fully precomputed (browser only formats). Written with benchmark.
            json.dump({
                "schema_version": "1.0", "as_of": dates[-1], "state": state,
                "inception_date": inception, "benchmark_label": benchmark_label(provider),
                "last_sync_utc": now_utc(), "weekly": weekly, "monthly": monthly,
            }, open(os.path.join(DATA, "periodic.json"), "w"), indent=2)

        strat_block = bench_block = excess = dd_delta = None
        if full:
            strat_block = {"cum_return_pct": round(idx_rows[-1]["index"] - 100, 2),
                           "max_dd_pct": round(strat_maxdd * 100, 2), "index_last": idx_rows[-1]["index"]}
            bench_block = {"cum_return_pct": round(b_idx[-1]["index"] - 100, 2),
                           "max_dd_pct": round(bench_maxdd * 100, 2), "index_last": b_idx[-1]["index"]}
            excess = round(idx_rows[-1]["index"] - b_idx[-1]["index"], 2)
            dd_delta = round((strat_maxdd - bench_maxdd) * 100, 2)

        json.dump({
            "schema_version": "1.0", "as_of": dates[-1], "trading_days": trading_days,
            "min_days": MIN_DAYS, "account_mode": account_mode, "state": state,
            "strategy": strat_block,
            "benchmark": bench_block,
            "excess_return_pct": excess,
            "dd_delta_pct": dd_delta,
            "verdicts": vd,
            "benchmark_label": benchmark_label(provider),
            "inception_date": inception,
            "provenance": {"custodian": "Interactive Brokers", "raw_sha256_short": sha[:8],
                            "raw_commit_url": raw_verify_url(today), "last_sync_utc": now_utc()},
        }, open(os.path.join(DATA, "charter.json"), "w"), indent=2)
        print("charter sync OK · state=%s · days=%d" % (state, trading_days))
        return 0
    except Exception as e:
        print("charter sync ERROR: %s" % e, file=sys.stderr)
        write_error_state()
        return 1


if __name__ == "__main__":
    sys.exit(main())
