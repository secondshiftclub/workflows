#!/usr/bin/env python3
"""Step 2b — Top 250 queries for every significant URL. This is the one that matters.

The Search Console UI actively discourages this view, which is why nobody has it, which
is why page-level click counts survive as a KPI despite being largely meaningless. A
page can rank beautifully and collect thousands of impressions for queries no buyer
would ever type.

43 top pages produced about 9,000 rows for one cluster.

Output: out/gsc_queries.csv — url, query, clicks, impressions, ctr, position

Caveat the post makes and the code can't fix: GSC's per-URL query API caps what it
returns and samples the long tail. Treat the counts as a shape, not a census.
"""

import sys

from lib import cached, date_window, gsc_client, load_config, read_csv, write_csv

cfg = load_config()
gsc_cfg = cfg.get("gsc", {})
DAYS = gsc_cfg.get("days", 90)
PER_URL = gsc_cfg.get("queries_per_url", 250)
MIN_IMPRESSIONS = gsc_cfg.get("min_impressions", 10)
start, end = date_window(DAYS)
site = gsc_cfg.get("property") or cfg["site_url"]

pages = [r for r in read_csv("gsc_pages.csv") if int(r["impressions"]) >= MIN_IMPRESSIONS]
print(f"pulling top {PER_URL} queries for {len(pages)} URLs (>= {MIN_IMPRESSIONS} impressions)", file=sys.stderr)

client = gsc_client()
out = []

for i, page in enumerate(pages, 1):
    url = page["url"]
    body = {
        "startDate": start,
        "endDate": end,
        "dimensions": ["query"],
        "dimensionFilterGroups": [
            {"filters": [{"dimension": "page", "operator": "equals", "expression": url}]}
        ],
        "rowLimit": PER_URL,
    }
    key = f"gsc_q_{start}_{end}_{abs(hash(url))}"
    try:
        resp = cached(key, lambda: client.searchanalytics().query(siteUrl=site, body=body).execute())
    except Exception as e:  # one bad URL should not kill a 40-minute pull
        print(f"  {url}: {e}", file=sys.stderr)
        continue

    for r in resp.get("rows", []):
        out.append(
            {
                "url": url,
                "query": r["keys"][0],
                "clicks": int(r.get("clicks", 0)),
                "impressions": int(r.get("impressions", 0)),
                "ctr": round(r.get("ctr", 0.0), 5),
                "position": round(r.get("position", 0.0), 2),
            }
        )
    if i % 10 == 0:
        print(f"  {i}/{len(pages)} URLs, {len(out)} query rows", file=sys.stderr)

write_csv("gsc_queries.csv", out)

# The finding that justifies the whole step: many URLs splitting one query.
from collections import defaultdict

by_query = defaultdict(list)
for r in out:
    by_query[r["query"]].append(r)
split = sorted(
    ((q, rows) for q, rows in by_query.items() if len(rows) >= 5),
    key=lambda kv: -sum(r["impressions"] for r in kv[1]),
)[:10]
if split:
    print("\nQueries split across 5+ of your own URLs (cannibalization, by impressions):", file=sys.stderr)
    for q, rows in split:
        imp = sum(r["impressions"] for r in rows)
        clk = sum(r["clicks"] for r in rows)
        print(f"  {len(rows):>3} URLs  {imp:>8,} impr  {clk:>5,} clicks  {clk / imp if imp else 0:.2%}  {q}", file=sys.stderr)
