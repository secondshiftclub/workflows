#!/usr/bin/env python3
"""Step 2a — Page-level Search Console metrics for a 90-day window.

Everyone has this one. It's here because the join needs it, and because the clicks
column is what you'll use to show a stakeholder that 16% of pages drive 93% of the
clicks. It is NOT what you make the keep/kill call on — step 3 is.

Output: out/gsc_pages.csv — url, clicks, impressions, ctr, position
"""

import sys

from lib import cached, date_window, gsc_client, load_config, read_csv, write_csv

cfg = load_config()
DAYS = cfg.get("gsc", {}).get("days", 90)
start, end = date_window(DAYS)
site = cfg.get("gsc", {}).get("property") or cfg["site_url"]

inventory = {r["url"].rstrip("/") for r in read_csv("inventory.csv")}
client = gsc_client()

print(f"pulling {site} page metrics {start} → {end}", file=sys.stderr)

rows, start_row = [], 0
while True:
    body = {
        "startDate": start,
        "endDate": end,
        "dimensions": ["page"],
        "rowLimit": 25000,
        "startRow": start_row,
    }
    resp = cached(
        f"gsc_pages_{start}_{end}_{start_row}",
        lambda: client.searchanalytics().query(siteUrl=site, body=body).execute(),
    )
    batch = resp.get("rows", [])
    if not batch:
        break
    rows.extend(batch)
    if len(batch) < 25000:
        break
    start_row += len(batch)

out = []
for r in rows:
    url = r["keys"][0]
    if inventory and url.rstrip("/") not in inventory:
        continue
    out.append(
        {
            "url": url,
            "clicks": int(r.get("clicks", 0)),
            "impressions": int(r.get("impressions", 0)),
            "ctr": round(r.get("ctr", 0.0), 5),
            "position": round(r.get("position", 0.0), 2),
        }
    )

out.sort(key=lambda r: -r["clicks"])
write_csv("gsc_pages.csv", out)

if out:
    total = sum(r["clicks"] for r in out)
    running, head = 0, 0
    for r in out:
        running += r["clicks"]
        head += 1
        if total and running >= total * 0.93:
            break
    print(
        f"\n{head} of {len(out)} pages ({head / len(out):.0%}) carry 93% of the clicks.",
        file=sys.stderr,
    )
