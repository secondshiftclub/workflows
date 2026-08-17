# Topic cluster audit

> Companion to **[How to identify and audit topic clusters on your website](https://www.hiresecondshift.com/p/how-to-identify-and-audit-topic-clusters)**

I think the AI era is exposing two things: that website traffic as a metric is/was
stupid, and that most content is/was corporate navel-gazing with zero impact on the
bottom line.

That said, there is still value in thinking about your website as an entity, and in
making it easy for any bot to identify *the* page on your site for a specific topic.

This is the pipeline for finding out which page that is, and what to do with the other
seventy-nine.

**What two runs of it found:** 79 pages that needed to be retired or merged. The 16% of
pages driving 93% of the clicks. Eleven pages splitting 107K impressions for one keyword
at a collective 0.1% CTR.

> **A note on what this code is.** These scripts are a clean reimplementation written
> from the post, not the original client pipeline — same architecture, same models, same
> thresholds, no client data. Everything is config-driven, so pointing it at your own
> site is the only setup step.

---

## What you need

- **Search Console API** enabled with credentials. Free, and a genuine pain in the
  ass — the [`.env.example`](.env.example) spells out the step everyone misses.
- **Ahrefs API** (or any SEO tool with a keyword-universe endpoint).
- **A markdown corpus of your site.** Crawl it once. Screaming Frog will get you there.
- **A few dollars of LLM credit** for the intent classification.
- The embeddings run **locally, for free**, on a laptop.

```bash
pip install -r requirements.txt
cp config.example.json config.json   # your site, topic, buckets, competitors
cp .env.example .env                 # your keys
```

---

## The architecture

Seven scripts, run in order, then two generators. Every output is a CSV, every API
response is cached, and the final deliverables are generated from the data — so a re-run
refreshes every number in every slide.

```
[Inventory: markdown corpus scan]
      |
      v
[GSC pull: page metrics]───[GSC pull #2: top 250 queries PER URL]
      |                              |
      v                              v
[Ahrefs pull: you + competitors]   [Intent classification]
      |                              |
      v                              |
[Embeddings: local bge-small]        |
      |                              |
      +──────────────┬───────────────+
                     v
              [Join → master.csv]
                     |
            +────────+────────+
            v                 v
   [Decision workbook]   [Deck, generated]
```

```bash
python scripts/01_inventory.py        # → out/inventory.csv
python scripts/02_gsc_pages.py        # → out/gsc_pages.csv
python scripts/03_gsc_queries.py      # → out/gsc_queries.csv          ← the one that matters
python scripts/04_ahrefs.py           # → out/ahrefs_keywords.csv, ahrefs_expansion.csv
python scripts/05_classify_intent.py  # → out/query_intent.csv, page_intent.csv
python scripts/06_embeddings.py       # → out/similarity_pairs.csv, page_clusters.csv, thin_pages.csv
python scripts/07_join.py             # → out/master.csv
python scripts/08_workbook.py         # → out/decisions.xlsx
python scripts/09_deck.py             # → out/deck.pptx
```

---

## Step 1 — Inventory what actually exists

This sounds trivial. It is probably the most important step of the process.

*"How many pages do we have about X"* is a question most content teams can't answer
easily on a large-ish site. It's also where the skeletons surface. I saw wrong-language
pages on English URLs — debris from a platform migration eighteen months earlier, sitting
there cannibalizing the English pages for their own keywords.

The rule the script enforces: the topic has to be the page's **primary subject**, not a
passing mention.

## Step 2 — Pull the queries, not the clicks

Two Search Console scripts. The first pulls standard page-level metrics. Everyone has
this.

The second is the one that matters: **top 250 queries for every significant URL** — about
9,000 rows for one cluster's 43 top pages. The GSC UI actively discourages this view,
which is why nobody has it, which is why page-level click counts survive as a KPI despite
being largely meaningless.

Then [classify every query into intent buckets](prompts/intent-classification.md) and
roll them up per page. Every URL gets an honest label. Ours ranged from 95% business
intent (keep, obviously) to **96% junk on the biggest traffic page in one cluster** (kill,
obviously).

## Step 3 — Competitor keyword universes

Caching every response so re-runs are free. Feeds two things: evidence for the
cannibalization calls, and expansion opportunities — keywords where a competitor ranks #1
and you don't have a page at all.

## Step 4 — Embeddings, locally, for free

Content cannibalization is mostly a machine problem, so it benefits from a machine-based
analysis.

1. **Strip each page to its main content.** Kill the nav, footer, CTA blocks, and
   related-posts modules before you do anything else. Skip this and every page on your
   site scores as similar to every other page.
2. Chunk into ~250-word passages with 40-word overlap; embed with
   **BAAI/bge-small-en-v1.5** via sentence-transformers. No API — 1,239 passages took a
   couple of minutes.
3. Mean-pool into one vector per page, **and keep the chunk vectors**. You want two
   numbers per page pair: whole-page cosine, which catches twin pages, and max
   chunk-to-chunk cosine, which catches the sneakier case — a 3,000-word guide whose
   middle section duplicates another page wholesale, which mean-pooling averages into
   invisibility.
4. Flag thin pages (under ~200 words of real content) rather than scoring them.

Keep pairs ≥ 0.70 as a **triage list, not a verdict list**. Agglomerative clustering gives
you topic groups — useful for organizing the review, but clusters shift with the linkage
settings, so treat them as folders and not findings.

## Step 5 — Join and generate

`07_join.py` merges everything into one row per URL and proposes a call. `08_workbook.py`
builds the multi-sheet Excel file you actually work in (with `final_decision` as a
dropdown, and `proposed_decision` colour-coded so you can see where you and the pipeline
disagree). `09_deck.py` builds the stakeholder deck from the same data.

**You need to look over this stuff manually. I have caught mistakes.** People love to
call out LLMs for making mistakes; I also catch my own.

---

## Making the calls

Every URL gets **KEEP / KEEP+REWRITE / MERGE / KILL / CHECK-FIRST** — that last one for
anything that might be in active campaigns. Three rules of thumb from two rounds:

**Kill your winners when the queries say so.** I've killed a cluster's #1 traffic page.
Ranking top-10 for a term that is spammy isn't something to brag about.

**Keep despite similarity when the citations say so.** If a page is valuable and being
cited, figure out how to reangle or rework it instead.

**Multiple languages are still an open problem.** I've struggled with how to manage these
across languages and I'm still working through it.

---

## Important caveats

**The intent classification is only as good as your buckets.** Spend time reading raw
queries before you define them. Our "junk" category was invented after seeing all the
junk queries.

**Small embedding models are fine for near-duplicate detection at page level.** They are
not fine for judging content quality, which is a very subjective, very human job.

**The similarity threshold does not transfer between corpora.** Calibrate every time;
it's ten minutes.

**GSC's per-URL query API caps what it returns and samples long-tail queries.** Treat the
counts as a shape, not a census.

---

## What happens to the keepers

Every kept page goes through a rewrite discipline that gets its own post, but the shape
is: a query fan-out audit before outlining (enumerate the sub-queries an AI engine
decomposes your topic into — attributes, comparisons, tasks, regions — and score the
current page against each one), the rewrite grounded in a verified internal fact base
rather than whatever the old page claimed, and a verification report mapping every
factual claim to its source.
