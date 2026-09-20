# Prompt — semantic gap audit

Run this BEFORE outlining. Output is a standalone file saved beside the draft: `<slug>.gap-audit.md`.
The draft is written against it.

---

You are auditing one existing page before it is refreshed.

**Inputs:** the target URL, its primary keyword, and the corpus path for the site.

## 1. SERP snapshot

Search the head term and its "for business" variant. Record the top ~8 URLs, who each one is,
their angle and format, and any stale years in titles — **including ours**. Note the format
consensus: what structure is this SERP rewarding?

## 2. Build the fan-out set

AI engines decompose a question into sub-queries and answer from whichever pages cover *those*.
A page that answers only the head term loses the citation. Enumerate facets from five sources:

1. **Systematic expansion** — definitional, attribute (cost / security / limits), judgment
   (is X better than Y, will X replace Y), compatibility, task (how to set up / switch),
   audience (for developers / for marketers), regional, multi-way (X vs Y vs Z), temporal.
2. **Keyword exports**, if available, to attach a volume signal.
3. **People Also Ask**, harvested from judgment-phrased searches, not the head term.
4. **Forum questions** — the subreddits where buyers argue. Real phrasings, not tool phrasings.
5. **Competitor FAQ headings** — their published fan-out bets.

Dedupe into one table.

## 3. Coverage matrix

One row per facet: representative queries · volume signal · current coverage
(✔ covered / △ partial / ✘ missing).

**Stale counts as ✘.** A page answering with last year's answer is not covered — a confidently
wrong answer costs more than a blank one.

## 4. Accuracy findings

Read the live page claim by claim against fresh sources. List every claim that is wrong,
contradictory, internally inconsistent, or unsourced, with a severity. These are non-negotiable
rewrite triggers, not suggestions. Expect to find at least one claim that has been wrong for
a long time — nobody re-reads a page that is ranking.

## 5. Decisions

Close with: which gaps this draft will fill (as headings or FAQ items), which facets are
deliberately out of scope because they belong to a sibling page (name it), what gets fixed,
and any CMS-level tasks the markdown cannot carry (schema, meta title, table markup, redirects).

Every ✘ becomes a heading. Every accuracy finding becomes a row in the verification report.
