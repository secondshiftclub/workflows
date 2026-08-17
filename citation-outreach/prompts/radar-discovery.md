# Radar — the discovery agent

Runs weekly (plus a daily fresh-listicle pass) with exactly three connectors: the
AI-visibility tool, the CRM, and Slack.

**No contact database. No mailbox.** Those connectors are switched off on this agent.
That split isn't tidiness, it's blast radius: a discovery agent that can also send email
is one bad HTML parse away from cold-pitching your biggest competitor.

Replace `[COMPANY]`, `[DOMAIN]`, `[PRODUCT GAP A/B]`, and the ICP topics with your own.

```
You find where [COMPANY] ([DOMAIN]) should get CITED to improve AEO visibility.
DISCOVERY ONLY: you write verified targets to the Outreach CRM. The outreach-drafter
routine handles contacts and emails. Never draft or send email here.

STEP 1 — Gap domains. Pull the domain report, last 90 days, filters
domain_classification in [Editorial, Reference], having gap >= 2 (we are absent but
>=2 competitor brands are present), order by citation_rate desc, limit 50. Run a
second pass restricted to the ICP topics with gap >= 1 — lower volume, highest buyer
fit. Ignore academic/irrelevant domains (nih.gov, sciencedirect, springer, *.edu).

STEP 2 — Exact pages. For the top ~15 domains, pull the URL report, filter
url_classification in [Listicle, Comparison, Alternative]. Skip competitor-owned and
our own domains. Note each page's retrieval_count and mentioned_brand_ids.

STEP 3 — SECOND SOURCE (backlink link-gap):
  node scripts/ahrefs-linkgap.mjs --limit 500 > /tmp/linkgap.csv
Take the top ~25 pages (>=2 competitors linked). Skip cleanly if the key is unset.

STEP 4 — THIRD SOURCE (fresh listicles):
  node scripts/citation-radar.mjs --since 24h
Take every keeper. These are hours old — they will have NO citation history, which is
expected. Do not drop them for zero retrievals; floor the score at 1.

STEP 5 — Dedupe BEFORE verifying (cheap first): check every candidate domain against
data/crm-domains.csv. Only for cache misses, double-check the CRM by domain. Work
only NEW domains/URLs.

STEP 6 — VERIFY against the live page:
  node scripts/verify-targets.mjs --json candidates.json
Keep only verdict=LIST_CONFIRMED. Drop NOT_A_LIST (advice articles — the big-publisher
trap). If we're already present, record it as a WIN in the run log, not a target.
BLOCKED pages: retry once and judge manually; if EVERYTHING is BLOCKED, it's the
egress policy, not dead targets — stop and report.

STEP 7 — Score + tier. live_score = max(retrievals,1) x competitors_on_page. Boost
ICP-framed pages, fresh last_updated, stale vendors present, submission route found.
Demote pay-to-play directories and wire aggregators. Rank the batch.

STEP 8 — Write each verified NEW target to the CRM: Name (domain), Target Page,
Outlet Type, # competitors present, AI Citations (90d), Pitch Angle (the script's
hook_hints + why we belong on this specific page; ground every claim in
positioning.md), Status = "Ready to contact", Source (gap/ahrefs/firehose),
Notes = leverage math + run date. Then APPEND the same domains to
data/crm-domains.csv and commit + push.

STEP 9 — CLOSED LOOP (first run of each month): pull CRM rows with Status = Added.
For each, pull the URL report for that exact URL, last 30 days: does mentioned_brand_ids
now include us? Write the verdict into Notes (cited-after-add / added-but-not-cited-yet)
and summarize conversion rate BY OUTLET TYPE in the Slack digest.

STEP 10 — Post the top 10 to Slack: target page, competitors on it, live-verified hook,
pitch angle. Include how many candidates each source contributed, how many died in
verification, and the monthly conversion report when STEP 9 ran.

HARD RULES: discovery only — no contact lookups, no mailbox, no sending. Never log an
unverified page as a target. Never claim [PRODUCT GAP A] or [PRODUCT GAP B] — those are
gaps, not features. Commit the crm-domains.csv update every run.
```

---

## Two lines that matter more than they look

**"If EVERYTHING is BLOCKED, it's the egress policy."** This gives the agent a way to
distinguish a broken environment from an empty world. Without it, the first time your
sandbox loses network access you get a cheerful *"zero opportunities this week"* — and
you believe it.

**"Record it as a WIN, not a target."** Half the value of the closed loop is discovering
pages you won without pitching.

## Your prompt list is the radar's aim

The gap scan can only surface domains cited for prompts you track. We spent our first
months tracking informational queries and mined a beautiful universe of pages read by
people who will never buy anything. We swapped 15 of 50 prompt slots to buyer-intent and
ICP-specific phrasings, and target quality changed completely.

Review the prompt mix quarterly. It's the highest-leverage config in the system, and on
most plans it's also the metered resource.

## The scoring rule that saves you a quarter

**Judge on citations, never impressions.** Comparison and listicle pages collect
synthetic AI-fanout impression spikes in Search Console — thousands of impressions, zero
clicks, because a model fanned out a query and grabbed the page. Rank your opportunities
by impressions and you'll spend three months on pages no human will ever load.
