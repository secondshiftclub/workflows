# The intent classification prompt

This is the prompt `05_classify_intent.py` builds from `config.json`. It's here so you
can read it, argue with it, and change the buckets — which is the point.

```
Classify each search query into exactly one bucket for [COMPANY],
a [CATEGORY] company:

- JUNK: hack/spy/surveillance intent, prank tools ("bomber"),
  pirated/modified apps, anything with zero legitimate buyer intent
- CONSUMER: legitimate but non-commercial ("is [app] down",
  "[app] usage by country")
- BUSINESS: API/developer, business accounts, pricing, features,
  OTP/verification, marketing use cases, branded queries

Return query, bucket, confidence. When unsure between CONSUMER
and BUSINESS, look at whether the query implies operating an
account at scale.
```

---

## The buckets are the whole ballgame

**The classification is only as good as your buckets.** Spend time reading raw queries
before you define them. Our `JUNK` category was invented *after* seeing all the junk
queries — it is not a category we would have thought of in advance, and it turned out to
be the one that killed a cluster's biggest traffic page.

So: run step 3, open `out/gsc_queries.csv`, and read a few hundred rows before you touch
`intent_buckets` in `config.json`. An afternoon of reading beats any amount of clever
prompting.

## Two implementation details

**Batch 50 at a time, with the running bucket list passed forward.** Dump 900 queries
into one context and the classifications drift by the end. Ask me how I know.

**`temperature: 0` plus `response_format: {"type": "json_object"}`.** Small models love
wrapping JSON in prose and code fences. The format flag is the fix; parsing around
fences is not.

## Then roll up per page

`05_classify_intent.py` weights the rollup by impressions, so a page is described by
what its traffic actually asks for rather than by its query count. Every URL comes out
with an honest label. Ours ranged from **95% business intent** (keep, obviously) to
**96% junk on the biggest traffic page in the cluster** (kill, obviously).

That second number is the reason to run this at all. Page-level click counts would have
told you that page was the crown jewel.

---

## A different-shaped example

If your category doesn't have a junk problem, the buckets change completely. For a B2B
tool sold to a business buyer, something like:

```
- JOB_SEEKER: someone looking for work, not someone buying software
- PRACTITIONER: doing the job by hand, no budget, researching technique
- BUYER: evaluating tools, pricing, comparisons, integrations, alternatives
- BRAND: our name or a competitor's name

When unsure between PRACTITIONER and BUYER, look at whether the query
implies responsibility for a budget.
```

The tiebreak sentence at the end matters more than it looks. Every bucket set has one
fuzzy boundary that produces most of the disagreement, and naming the tiebreak
explicitly is what makes a batch of 50 come back consistent with the batch before it.
