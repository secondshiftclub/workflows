#!/usr/bin/env python3
"""Step 6 — Join everything into master.csv. One row per URL.

Merges inventory + GSC pages + intent rollup + similarity + clusters into a single table,
and proposes a decision for each URL. The proposal is a starting point for a human, not
an answer:

  KEEP           strong business intent, no duplicate problem
  KEEP+REWRITE   right intent, thin or overlapping
  MERGE          a near-twin with a stronger page
  KILL           the queries say nobody who matters is asking
  CHECK-FIRST    anything that might be in active campaigns

Output: out/master.csv

YOU HAVE TO LOOK OVER THIS MANUALLY. I have caught mistakes. People love to call out
LLMs for making mistakes; I also catch my own.
"""

import sys
from collections import defaultdict

from lib import load_config, read_csv, write_csv

cfg = load_config()
rules = cfg.get("decision_rules", {})
BUSINESS = cfg.get("business_bucket", "BUSINESS").lower()
JUNK = cfg.get("junk_bucket", "JUNK").lower()
JUNK_KILL = rules.get("junk_pct_kill", 0.60)
BUSINESS_KEEP = rules.get("business_pct_keep", 0.50)
MERGE_AT = rules.get("merge_cosine", 0.80)
THIN_WORDS = cfg.get("embeddings", {}).get("thin_page_words", 200)


def load(name):
    try:
        return read_csv(name)
    except SystemExit:
        print(f"note: {name} missing — continuing without it", file=sys.stderr)
        return []


inventory = {r["url"]: r for r in read_csv("inventory.csv")}
gsc = {r["url"]: r for r in load("gsc_pages.csv")}
intent = {r["url"]: r for r in load("page_intent.csv")}
clusters = {r["url"]: r["cluster"] for r in load("page_clusters.csv")}
thin = {r["url"]: int(r["real_words"]) for r in load("thin_pages.csv")}
pairs = load("similarity_pairs.csv")
campaign_urls = set(cfg.get("campaign_urls", []))

# Best duplicate partner per URL, by whichever similarity number is higher.
best_pair = {}
for p in pairs:
    sim = max(float(p["page_cosine"]), float(p["max_chunk_cosine"]))
    for a, b in ((p["url_a"], p["url_b"]), (p["url_b"], p["url_a"])):
        if a not in best_pair or sim > best_pair[a][1]:
            best_pair[a] = (b, sim, p["signal"])

# Queries split across several of our own URLs — the cannibalization evidence.
splits = defaultdict(set)
for r in load("gsc_queries.csv"):
    splits[r["query"]].add(r["url"])
split_count = defaultdict(int)
for q, urls in splits.items():
    if len(urls) >= 3:
        for u in urls:
            split_count[u] += 1

rows = []
for url, inv in inventory.items():
    g = gsc.get(url, {})
    it = intent.get(url, {})
    clicks = int(g.get("clicks") or 0)
    impressions = int(g.get("impressions") or 0)
    pct_junk = float(it.get(f"pct_{JUNK}") or 0)
    pct_business = float(it.get(f"pct_{BUSINESS}") or 0)
    dupe_url, dupe_sim, dupe_signal = best_pair.get(url, ("", 0.0, ""))
    words = thin.get(url, int(inv.get("word_count") or 0))
    is_thin = url in thin

    # Proposed call. Order matters — the first rule that fires wins.
    if url in campaign_urls:
        decision, why = "CHECK-FIRST", "listed in campaign_urls"
    elif pct_junk >= JUNK_KILL:
        decision, why = "KILL", f"{pct_junk:.0%} of impressions are {JUNK} intent"
    elif dupe_sim >= MERGE_AT and clicks < int(gsc.get(dupe_url, {}).get("clicks") or 0):
        decision, why = "MERGE", f"{dupe_sim:.2f} similar to a page with more clicks"
    elif is_thin:
        decision, why = "KEEP+REWRITE", f"only {words} words of real content (floor {THIN_WORDS})"
    elif dupe_sim >= MERGE_AT:
        decision, why = "KEEP+REWRITE", f"{dupe_signal} with {dupe_url}"
    elif pct_business >= BUSINESS_KEEP:
        decision, why = "KEEP", f"{pct_business:.0%} {BUSINESS} intent"
    elif impressions == 0:
        decision, why = "CHECK-FIRST", "no Search Console data — new, noindexed, or orphaned"
    else:
        decision, why = "CHECK-FIRST", "no rule fired — read the queries yourself"

    rows.append(
        {
            "url": url,
            "title": inv.get("title", ""),
            "page_type": inv.get("page_type", ""),
            "word_count": words,
            "clicks": clicks,
            "impressions": impressions,
            "ctr": g.get("ctr", ""),
            "position": g.get("position", ""),
            f"pct_{BUSINESS}": round(pct_business, 3),
            f"pct_{JUNK}": round(pct_junk, 3),
            "dominant_bucket": it.get("dominant_bucket", ""),
            "cluster": clusters.get(url, ""),
            "nearest_duplicate": dupe_url,
            "duplicate_similarity": round(dupe_sim, 4) if dupe_sim else "",
            "duplicate_signal": dupe_signal,
            "queries_split_with_others": split_count.get(url, 0),
            "thin": is_thin,
            "proposed_decision": decision,
            "why": why,
            "final_decision": "",  # you fill this in
            "notes": "",
        }
    )

rows.sort(key=lambda r: (-r["clicks"], -r["impressions"]))
write_csv("master.csv", rows)

tally = defaultdict(int)
for r in rows:
    tally[r["proposed_decision"]] += 1
print("\nProposed:", file=sys.stderr)
for k, v in sorted(tally.items(), key=lambda kv: -kv[1]):
    print(f"  {k:<14} {v}", file=sys.stderr)
print(
    "\nNow do the part the pipeline can't. Three rules of thumb from two rounds:\n"
    "  1. Kill your winners when the queries say so. I've killed a cluster's #1 traffic\n"
    "     page. Ranking top-10 for a spammy term isn't something to brag about.\n"
    "  2. Keep despite similarity when the citations say so. If it's valuable and being\n"
    "     cited, figure out how to reangle it instead.\n"
    "  3. Fill in final_decision yourself. The pipeline assembles evidence; you make the call.",
    file=sys.stderr,
)
