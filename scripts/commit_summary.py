#!/usr/bin/env python3
"""One-line commit summary for the charter-sync Action (§6.1)."""
import json, os
p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "charter.json")
try:
    c = json.load(open(p))
    print("state=%s days=%s mode=%s" % (c.get("state"), c.get("trading_days"), c.get("account_mode")))
except Exception:
    print("state=unknown")
