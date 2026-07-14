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
except Exception as e:
    check("JSON contracts loadable", False, str(e))

print()
if fails:
    print("FAILED: " + ", ".join(fails)); sys.exit(1)
print("ALL CHARTER VALIDATIONS PASS")
