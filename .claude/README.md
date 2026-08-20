# Claude Code skills

Drop-in skills for [Claude Code](https://claude.com/claude-code). Copy a folder into
your own project's `.claude/skills/` (or `~/.claude/skills/` to have it everywhere) and
it loads automatically — the `description` in its frontmatter is what decides when it
fires.

| Skill | What it does |
|---|---|
| [`slop-check/`](skills/slop-check/) | Score any draft, page, or URL against the Slop Check rubric — *could an LLM have written this?* — and de-slop what fails. |

---

## slop-check

The same judge that powers **[check.hiresecondshift.com](https://check.hiresecondshift.com)**,
running locally: no API key, no cost, and — unlike the public tool — it can score **drafts
that aren't published yet**, which is where the check actually matters.

One question decides everything: *could an LLM have written this?* If it could, it's slop
— readers get the same answer without ever visiting. If it couldn't, because it rests on
your own numbers, customers, tests, or product, it's the real thing.

It scores four signals (`only_you` 40%, `worth_clicking` 30%, `quotable` 20%,
`helps_business` 10%), then either reports or rewrites. The de-slop mode has one hard
rule: **never fabricate evidence.** It cuts, reorders, and leaves bracketed asks like
`[YOUR NUMBER: how many candidates last quarter?]` for you to fill — those brackets are
the deliverable.

### One dependency you need to supply

The skill deliberately does **not** do its own arithmetic. It calls the same scoring
module the deployed tool uses, so the local judge can never drift from the public one:

```
commodity-check/core/scoring.mjs   → baseScore, applyLimits, verdictFor
commodity-check/core/extract.mjs   → page extraction for URL mode
```

**Those files are not in this repo.** Until they are, you have three options:

1. **Draft mode works as-is** if you do the weighting yourself — four signal scores
   against the weights above. You lose the evidence caps and exact parity with the
   public tool, which mostly matters when a score sits near a band boundary.
2. **Point it at your own scoring module** by editing the two code blocks in `SKILL.md`.
   The contract is small: `baseScore(signals)` → number, `applyLimits(base, {yours,
   signalScores})` → `{score, limits}`, `verdictFor(score)` → label.
3. **Use the hosted tool** at [check.hiresecondshift.com](https://check.hiresecondshift.com)
   for anything already published.

### Evals

[`skills/slop-check/evals/`](skills/slop-check/evals/) ships the **framework**, not one
run's results: three eval definitions with their assertions, and a
[README](skills/slop-check/evals/README.md) covering how the harness works — the
with-skill / without-skill A/B, what makes an assertion discriminating rather than
decorative, the exact `grading.json` field names the viewer depends on, and why an empty
benchmark still renders as a real-looking 0% result.

The runner itself is Anthropic's `skill-creator` plugin, which ships with Claude Code.

Bring your own fixture for eval 1 (`evals/fixtures/draft.md`) — the assertions are about
report shape and scoring parity, not about any particular piece of text.
