#!/usr/bin/env python3
"""Step 4 — Classify every query into intent buckets, then roll up per page.

This is an LLM-shaped task. The buckets in config.json are the whole ballgame: spend
time reading raw queries BEFORE you define them. Our "junk" category was invented after
seeing all the junk queries, not before.

Roll the buckets up per page and every URL gets an honest label. Ours ranged from 95%
business intent (keep, obviously) to 96% junk on the biggest traffic page in one cluster
(kill, obviously).

Output:
  out/query_intent.csv  — query, bucket, confidence
  out/page_intent.csv   — url, pct_<bucket>..., dominant_bucket, impressions

Batch 50 queries per call with the running bucket list passed forward. Dump 900 into one
context and the classifications drift by the end — ask me how I know.
"""

import json
import sys
import urllib.request
from collections import defaultdict

from lib import load_config, read_csv, require_env, write_csv

cfg = load_config()
llm = cfg.get("classifier", {})
MODEL = llm.get("model", "gpt-4o-mini")
BASE = llm.get("base_url", "https://api.openai.com/v1/chat/completions")
BATCH = llm.get("batch_size", 50)
KEY = require_env("OPENAI_API_KEY", "intent classification")

buckets = cfg["intent_buckets"]  # {name: description}
bucket_names = list(buckets)

rows = read_csv("gsc_queries.csv")
queries = {}
for r in rows:
    q = r["query"]
    queries.setdefault(q, 0)
    queries[q] += int(r["impressions"])
unique = sorted(queries, key=lambda q: -queries[q])
print(f"{len(unique)} unique queries to classify in batches of {BATCH}", file=sys.stderr)

bucket_block = "\n".join(f"- {name}: {desc}" for name, desc in buckets.items())
SYSTEM = f"""Classify each search query into exactly one bucket for {cfg['company']}, a {cfg['category']} company:

{bucket_block}

Return query, bucket, confidence. {cfg.get('intent_tiebreak', '')}

Return ONLY valid JSON, no fences:
{{"results":[{{"query":"...","bucket":"...","confidence":"high|medium|low"}}]}}"""


def classify(batch):
    body = json.dumps(
        {
            "model": MODEL,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": "\n".join(batch)},
            ],
        }
    ).encode()
    req = urllib.request.Request(
        BASE, data=body, headers={"Content-Type": "application/json", "Authorization": f"Bearer {KEY}"}
    )
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                content = json.loads(r.read())["choices"][0]["message"]["content"]
            return json.loads(content).get("results", [])
        except Exception as e:
            print(f"  batch attempt {attempt}/3 failed: {e}", file=sys.stderr)
    # Fail hard rather than silently labelling a batch. An unclassified page that looks
    # classified is worse than a missing row.
    sys.exit("classification failed after 3 attempts — refusing to emit partial labels")


out = []
for i in range(0, len(unique), BATCH):
    batch = unique[i : i + BATCH]
    for r in classify(batch):
        if r.get("bucket") in bucket_names:
            out.append({"query": r["query"], "bucket": r["bucket"], "confidence": r.get("confidence", "")})
    print(f"  {min(i + BATCH, len(unique))}/{len(unique)}", file=sys.stderr)

write_csv("query_intent.csv", out)

# Roll up per page, weighted by impressions — a page is what its traffic asks for.
label = {r["query"]: r["bucket"] for r in out}
per_page = defaultdict(lambda: defaultdict(int))
totals = defaultdict(int)
for r in rows:
    b = label.get(r["query"])
    if not b:
        continue
    imp = int(r["impressions"])
    per_page[r["url"]][b] += imp
    totals[r["url"]] += imp

page_rows = []
for url, counts in per_page.items():
    total = totals[url] or 1
    row = {"url": url, "impressions": total}
    for b in bucket_names:
        row[f"pct_{b.lower()}"] = round(counts.get(b, 0) / total, 3)
    row["dominant_bucket"] = max(bucket_names, key=lambda b: counts.get(b, 0))
    page_rows.append(row)

page_rows.sort(key=lambda r: -r["impressions"])
write_csv("page_intent.csv", page_rows)

print("\nHonest labels, worst first:", file=sys.stderr)
worst = cfg.get("junk_bucket", bucket_names[0]).lower()
for r in sorted(page_rows, key=lambda r: -r.get(f"pct_{worst}", 0))[:10]:
    print(f"  {r.get(f'pct_{worst}', 0):>6.0%} {worst:<9} {r['impressions']:>8,} impr  {r['url']}", file=sys.stderr)
