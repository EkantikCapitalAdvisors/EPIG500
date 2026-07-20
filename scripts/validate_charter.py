#!/usr/bin/env python3
"""
EPIG 500 — Charter Ledger validator (CL-SPEC-V1.0 §11.2).
Reproduces the §4.5 fixtures exactly and validates the committed JSON contracts.
Run in CI; exit non-zero on any failure.
"""
import os, sys, json, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import charter_sync as cs

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
fails = []

def check(name, cond, detail=""):
    print(("  ✓ " if cond else "  ✗ ") + name + (("" if cond else "  — " + detail)))
    if not cond:
        fails.append(name)

# ---- §4.5 TWR / index fixture --------------------------------------------
print("§4.5 fixtures:")
rows = [{"date": "d1", "nav": 100000, "flow": 0.0},
        {"date": "d2", "nav": 101000, "flow": 0.0},
        {"date": "d3", "nav": 111500, "flow": 10000.0}]
idx = cs.build_index(rows)
check("r_1 = +1.0000%", round(idx[1]["twr_daily"] * 100, 4) == 1.0000, str(idx[1]["twr_daily"]))
check("r_2 = +0.4950%", round(idx[2]["twr_daily"] * 100, 4) == 0.4950, str(idx[2]["twr_daily"]))
check("index == [100.0000, 101.0000, 101.5000]",
      [r["index"] for r in idx] == [100.0000, 101.0000, 101.5000], str([r["index"] for r in idx]))

# ---- §4.5 drawdown fixture ------------------------------------------------
dds, maxdd = cs.drawdown_series([100, 102, 99, 101])
dd_pct = [round(x * 100, 4) for x in dds]
check("DD == [0, 0, -2.9412%, -0.9804%]", dd_pct == [0.0, 0.0, -2.9412, -0.9804], str(dd_pct))
check("maxDD == -2.9412%", round(maxdd * 100, 4) == -2.9412, str(round(maxdd * 100, 4)))

# ---- verdict logic spot-check --------------------------------------------
v = cs.verdicts(101.83, 102.10, -0.0094, -0.0312)
check("verdict BEHIND + SHALLOWER", v == {"return_gate": "BEHIND", "drawdown_gate": "SHALLOWER"}, str(v))

# ---- periodic returns + capture fixture ----------------------------------
print("periodic:")
_pairs = [{"date": "2026-07-01", "s": 100.0, "b": 100.0},
          {"date": "2026-07-03", "s": 101.5, "b": 100.8},
          {"date": "2026-07-06", "s": 101.0, "b": 100.2},
          {"date": "2026-07-10", "s": 100.9, "b": 99.6},
          {"date": "2026-07-17", "s": 103.0, "b": 101.2}]
_w = cs.periodic_summary(_pairs, "W", 8)
check("weekly period count == 3", _w["total"] == 3, str(_w["total"]))
check("week1 strat +1.5% / bench +0.8%",
      _w["periods"][0]["strat_ret_pct"] == 1.5 and _w["periods"][0]["bench_ret_pct"] == 0.8)
check("beat 3 of 3", _w["beat_count"] == 3 and all(p["beat"] for p in _w["periods"]))
check("upside cap 148.5 / downside cap 49.6",
      _w["upside_capture_pct"] == 148.5 and _w["downside_capture_pct"] == 49.6,
      "%s / %s" % (_w["upside_capture_pct"], _w["downside_capture_pct"]))
check("capture gated (<8 weeks -> not ready)", _w["capture_ready"] is False)
_cap0 = cs.capture_ratios([{"strat_ret_pct": 1.0, "bench_ret_pct": 1.0}])
check("empty down bucket -> downside None", _cap0["downside_capture_pct"] is None)

# ---- JSON contracts (§11.2) ----------------------------------------------
print("JSON contracts:")
def load(f):
    return json.load(open(os.path.join(DATA, f)))
try:
    nav = load("nav.json"); bench = load("benchmark.json"); charter = load("charter.json")
    check("nav series[0].index == 100.0", nav["series"][0]["index"] == 100.0)
    check("benchmark series[0].index == 100.0", bench["series"][0]["index"] == 100.0)
    check("every nav row has a flow field", all("flow" in r for r in nav["series"]))
    dates = [r["date"] for r in nav["series"]]
    check("nav dates strictly increasing, no dups", dates == sorted(set(dates)) and len(dates) == len(set(dates)))
    check("reserved fee fields present", "fee_drag_annual" in nav and "net_series" in nav)
    check("charter has required keys",
          all(k in charter for k in ("state", "account_mode", "trading_days", "min_days", "provenance", "verdicts")))
    # state consistency (§7.3)
    st, mode, days = charter["state"], charter["account_mode"], charter["trading_days"]
    ok = ((mode != "FULL_ARCHITECTURE" and st in ("ENGINE_ONLY", "STALE", "ERROR")) or
          (mode == "FULL_ARCHITECTURE" and st in ("ACCUMULATING", "LIVE", "STALE", "ERROR")))
    check("state consistent with account_mode", ok, f"{st}/{mode}/{days}")
    if st in ("ENGINE_ONLY", "ACCUMULATING"):
        check("no verdicts before LIVE", charter.get("verdicts") in (None, {}), str(charter.get("verdicts")))
    # raw sha (only when a raw file is referenced)
    if nav.get("raw_file"):
        p = os.path.join(ROOT, nav["raw_file"])
        if os.path.exists(p):
            h = hashlib.sha256(open(p, "rb").read()).hexdigest()
            check("sha256(raw) == nav.raw_sha256", h == nav.get("raw_sha256"))
    # periodic.json contract
    periodic = load("periodic.json")
    for freq in ("weekly", "monthly"):
        blk = periodic[freq]
        check("periodic.%s has required keys" % freq,
              all(k in blk for k in ("periods", "beat_count", "total", "capture_ready",
                                     "upside_capture_pct", "downside_capture_pct")))
        check("periodic.%s beat_count <= total" % freq, blk["beat_count"] <= blk["total"])
        check("periodic.%s total == len(periods)" % freq, blk["total"] == len(blk["periods"]))
except Exception as e:
    check("JSON contracts loadable", False, str(e))

print()
if fails:
    print("FAILED: " + ", ".join(fails)); sys.exit(1)
print("ALL CHARTER VALIDATIONS PASS")
