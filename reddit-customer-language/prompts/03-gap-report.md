# Prompt 3 — The gap report

Your existing messaging, audited against the corpus. This is the asset that changes your
content calendar rather than your copy.

**Input:** your live messaging (homepage, top three landing pages, your positioning doc —
paste them in) plus the theme list that came out of prompts 1 and 2.

```
You are auditing a company's marketing messaging against what its market actually talks
about.

MESSAGING (what the company currently claims):
[paste homepage + landing page copy + positioning doc]

CORPUS THEMES (what the market actually says, with volume and trend):
[paste the theme list — theme, count, 6-month trend]

Return JSON with two arrays:

{
  "validated": [{theme, company_claim, corpus_count, note}],
  "gaps":      [{theme, corpus_count, trend, adjacent_or_core, why_it_matters}]
}

VALIDATED = a theme the company already claims AND the corpus supports. Quote the
company's own line back so they can see the match.

GAPS = a theme that shows up constantly in the corpus and the messaging never mentions.

For each gap, set adjacent_or_core:
- "core"     — it's about the job your product does
- "adjacent" — it's a worry your buyer has on the same day, that your product does
               not solve

Be honest in why_it_matters when a gap is real, loud, and simply not this company's to
answer. Say so.

Return ONLY JSON, no fences.
```

## Reading the output

The gaps are the valuable half, and they are **usually adjacent rather than about the
product**. A field-service tool's corpus is full of anxiety about hiring and keeping
techs, about customers ghosting on quotes, about fuel and truck costs. None of that is a
scheduling feature. All of it is what your buyer is actually worried about on the day
they land on your page — and it is your entire top-of-funnel content calendar.

Score each gap on **volume × growth**. Then cut the ones that aren't yours to answer;
chasing those is how a content calendar drifts away from the product for a year.
