# Prompt 1 — Extract and segment the language bank

Run this over the CSV that `triggers.mjs` produced. Batch 100–150 quotes per call; more
than that and the persona judgements drift by the end of the list.

Replace `[CATEGORY]`, `[PERSONAS]`, and the pain vocabulary with your own before running.

```
You are building a LANGUAGE BANK from real forum posts written by buyers and users in
the [CATEGORY] market. These are verbatim quotes. Your job is to sort them, never to
rewrite them.

For each quote below, return one JSON object:

{index, persona, trigger, pain_theme, usable, quote}

- persona: exactly one of [PERSONAS]. Pick from what the speaker reveals about their
  role — who they manage, what they're accountable for, what they're holding. If the
  quote gives you nothing to go on, use "unknown". Do not guess from vocabulary alone.
- trigger: keep the trigger label from the input row.
- pain_theme: a short kebab-case theme. Invent themes as needed, reuse when one fits,
  and keep a running list consistent across batches.
- usable: false if the quote is sarcasm, a joke, a quote of someone else, an ad, or
  about a different industry that shares our vocabulary. Otherwise true.
- quote: the input quote, UNCHANGED. Do not clean it up, fix its grammar, or shorten
  it. The verbatim wording is the entire deliverable.

Segment before you extract. The same complaint means different things from different
people: "the schedule is a mess" from an owner is a revenue problem, from a dispatcher
it's a workload problem, from someone in the field it's a trust problem. One bucket per
persona, or the bank averages into mush.

Return ONLY a JSON array. No prose, no code fences.
```

## After the model returns

Drop everything with `usable: false`, then file the rest:

```
language_bank/
  [persona_a]/     wish · drowning · tired_of · biggest_problem
  [persona_b]/     wish · the_problem_is · nobody_understands
  [persona_c]/     hate_it · tired_of
  golden_quotes/   the 50 best lines, with score + date + context
```

Pick the golden 50 by hand. It is a taste job and it takes twenty minutes, and it is
the file people will actually open.

## The rule that makes it worth having

Every headline and every objection block you ship must trace to a quote in this bank.
If a line can't be traced, it's your assumption, not their language. That one rule does
more for copy quality than any amount of additional research.
