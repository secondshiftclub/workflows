# Prompt 4 — The synthesis

Four files is three too many for someone writing an ad on a Tuesday. One more pass
collapses them into the two artifacts people actually open.

**Input:** the language bank, the objection index, the gap report, and the competitor
sentiment CSV.

```
You are collapsing four research files into two working artifacts for a marketing team.

INPUTS:
[language bank — quotes by persona and trigger]
[objection index — labels, counts, trend, quotes]
[gap report — validated and gaps, scored]
[competitor sentiment — brand, kind, quotes]

Produce TWO outputs.

OUTPUT 1 — RANKED PRIORITY LIST. Exactly ten items in each of three sections:
  - objections to address, ordered by frequency × growth
  - content topics, ordered by gap volume × growth
  - competitive angles, ordered by switching-quote volume
Each item: one line, plus the single best verbatim quote that justifies it.

OUTPUT 2 — VOICE-OF-CUSTOMER BRIEF. Thirty verbatim quotes, each tagged with persona
and pain theme. Chosen for range, not for volume: cover every persona and every top
theme at least once. Short enough to paste into any writing task.

RULES:
- Never rewrite a quote. Truncate with an ellipsis if you must, never paraphrase.
- Strip usernames, employer names, and any identifying detail from every quote.
- Do not add themes that aren't in the inputs. If the inputs are thin, say so and
  return fewer items rather than inventing.

Return markdown, ready to paste.
```

## Then wire it in — this is the step people skip

**Attach the brief to the task, not to a folder.** Every copy brief opens with the
relevant slice of the language bank and the objections that page must answer. If a
writer or an assistant has to go *find* the research, they won't, and you'll get generic
copy from an expensive corpus.

**Route each asset to the right surface.** Mixing them produces mush:

| Asset | Feeds |
|---|---|
| Language bank | Headlines, ad copy, hero sections, email subject lines |
| Objection index | FAQs, landing-page objection blocks, sales decks, comparison pages |
| Gap report | Blog calendar, top-of-funnel content, campaign themes |
| Competitor sentiment | Comparison pages, switcher campaigns, battlecards |

**Refresh on a cadence, not on inspiration.** Monthly is plenty. Pull the new window,
re-run the extraction, and **diff it**. The diff is the interesting part: a *rising*
objection is an early warning about your category that no analyst report will tell you
for another year.

**Close the loop.** Track how pages built from the bank perform against pages that
weren't. When a headline lifted straight from a quote beats one you wrote, that's the
evidence that keeps the pipeline funded and used.
