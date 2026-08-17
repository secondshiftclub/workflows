#!/usr/bin/env python3
"""Step 3 — Competitor keyword universes.

One script pulls the keyword universe for your domain and each competitor in the
category, caching every response so re-runs are free. This feeds two things: evidence
for the cannibalization calls, and expansion opportunities — keywords where a competitor
ranks #1 and you have no page at all.

Output:
  out/ahrefs_keywords.csv   — domain, keyword, position, volume, url
  out/ahrefs_expansion.csv  — keywords a competitor owns and you don't rank for

Cost: Ahrefs bills by ROW, with a 50-unit minimum per billable request. Trim `limit` in
config.json before you trim competitors — dropping a competitor blinds the gap, dropping
rows just shortens the tail.
"""

import json
import sys
import urllib.parse
import urllib.request

from lib import CACHE, load_config, require_env, write_csv

cfg = load_config()
KEY = require_env("AHREFS_API_KEY", "the competitor keyword universes")
ah = cfg.get("ahrefs", {})
LIMIT = ah.get("limit", 1000)
COUNTRY = ah.get("country", "us")
domains = [cfg["site_url"].replace("https://", "").replace("http://", "").strip("/").replace("www.", "")]
domains += ah.get("competitors", [])


def fetch(domain):
    path = CACHE / f"ahrefs_{domain}.json"
    if path.exists():
        print(f"  cache hit: {domain}", file=sys.stderr)
        return json.loads(path.read_text())

    params = urllib.parse.urlencode(
        {
            "target": domain,
            "mode": "domain",
            "country": COUNTRY,
            "limit": LIMIT,
            "select": "keyword,best_position,volume,best_position_url",
            "order_by": "volume:desc",
        }
    )
    url = f"https://api.ahrefs.com/v3/site-explorer/organic-keywords?{params}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {KEY}", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code == 402:
            print(f"  402 for {domain} — plan/rows exhausted, partial results", file=sys.stderr)
            return {"keywords": []}
        sys.exit(f"Ahrefs {e.code} for {domain}: {e.read()[:300].decode(errors='replace')}")
    path.write_text(json.dumps(data))
    return data


rows = []
by_domain = {}
for d in domains:
    print(f"fetching {d}", file=sys.stderr)
    kws = fetch(d).get("keywords", [])
    by_domain[d] = {k["keyword"]: k for k in kws if k.get("keyword")}
    for k in kws:
        rows.append(
            {
                "domain": d,
                "keyword": k.get("keyword"),
                "position": k.get("best_position"),
                "volume": k.get("volume") or 0,
                "url": k.get("best_position_url"),
            }
        )

write_csv("ahrefs_keywords.csv", rows)

# Expansion: a competitor ranks top 3 and we don't rank at all.
own = by_domain.get(domains[0], {})
expansion = []
for d in domains[1:]:
    for kw, k in by_domain.get(d, {}).items():
        pos = k.get("best_position")
        if pos is None or pos > 3 or kw in own:
            continue
        expansion.append(
            {
                "keyword": kw,
                "volume": k.get("volume") or 0,
                "competitor": d,
                "competitor_position": pos,
                "competitor_url": k.get("best_position_url"),
            }
        )

expansion.sort(key=lambda r: -r["volume"])
write_csv("ahrefs_expansion.csv", expansion)
print(
    f"\n{len(expansion)} keywords where a competitor ranks top-3 and you have no page at all.",
    file=sys.stderr,
)
