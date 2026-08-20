# The eval framework

How to measure whether a skill is actually doing anything — the harness, not one run's
results.

The runner is Anthropic's **[skill-creator](https://github.com/anthropics/claude-code)**
plugin, which ships with Claude Code:

```
/plugin install skill-creator@claude-plugins-official
```

What lives in this repo is the part that's ours: the eval definitions in
[`evals.json`](evals.json), and the notes below on the parts that bit us.

---

## The idea

Every eval runs **twice**: once with the skill loaded, once without. Three runs per
configuration, so you can see variance rather than one lucky sample.

The delta between the two configurations is the only number that means anything. A skill
scoring 90% pass rate looks great until the no-skill baseline also scores 90%, at which
point the skill is decoration and the assertions are measuring the model, not the skill.

```
                      ┌─ with_skill/     ×3 runs ─┐
evals.json ─ eval N ──┤                           ├─→ grading.json ─→ benchmark
                      └─ without_skill/  ×3 runs ─┘
```

---

## Writing the evals

`evals.json` holds one object per test case. The schema:

| Field | What it is |
|---|---|
| `id` | Unique integer |
| `name` | Descriptive — `draft-check-and-deslop`, not `eval-1`. It's what you read in the viewer. |
| `prompt` | The task, phrased the way a user would actually phrase it |
| `expected_output` | Human-readable description of success |
| `files` | Input fixtures, relative to the skill root |
| `expectations` | The assertions, each objectively verifiable |

**Write the prompts first, the assertions second** — ideally while the first runs are
still going. Assertions written before you've seen any output tend to describe the skill
you imagined rather than the one you shipped.

### What makes an assertion good

**Objectively verifiable.** "The report is helpful" can't be graded. "Report contains a
stamp verdict and a score out of 100" can.

**Discriminating.** If an assertion passes with and without the skill, it's measuring
the base model. Those are worth spotting and cutting — they inflate your pass rate and
hide the assertions that actually separate the two configurations.

**Aimed at the failure you fear.** Eval 3 here exists solely because the expensive
failure mode for this skill isn't a wrong score — it's confidently scoring a page it
never managed to read. Assertions that only check the happy path won't catch that.

**Not forced onto subjective ground.** Writing style and design quality need human
judgment. Grade those qualitatively by reading the outputs; don't invent a checkbox.

---

## Running them

```bash
# 1. Run each eval in both configurations, 3× each, saving to:
#    <skill>-workspace/iteration-N/eval-<id>-<name>/{with_skill,without_skill}/outputs/

# 2. Grade each run → grading.json in each run directory

# 3. Aggregate, from the skill-creator directory:
python -m scripts.aggregate_benchmark <workspace>/iteration-N --skill-name slop-check

# 4. View
python <skill-creator-path>/eval-viewer/generate_review.py \
  --benchmark <workspace>/iteration-N/benchmark.json
```

Results land in `<skill-name>-workspace/`, a **sibling of the skill directory** — not
inside it. That keeps run output from shipping with the skill, which is deliberate:
those files are a snapshot of one afternoon, they go stale immediately, and they can
quietly contain whatever you fed the skill that day.

### Two things that cost us time

**`grading.json` field names are load-bearing.** The expectations array must use exactly
`text`, `passed`, and `evidence`. Not `name`/`met`/`details`. The viewer reads those
exact keys and fails quietly if you improvise.

```json
{
  "expectations": [
    {
      "text": "Report contains stamp, score out of 100, and all four signals",
      "passed": true,
      "evidence": "\"[SLOP] — NN out of 100\" with all four signals and quoted evidence"
    }
  ]
}
```

**An empty benchmark still renders as a real result.** If the aggregation runs with no
completed runs, you get a valid-looking `benchmark.json` with `evals_run: []`, `runs:
[]`, and a summary table reading 0% pass rate for both configurations. It is
indistinguishable at a glance from a skill that genuinely does nothing. Check
`metadata.evals_run` is non-empty before you believe any benchmark, your own included.

---

## The fixture

Eval 1 needs `evals/fixtures/draft.md`. Supply your own — any draft that sounds like it
could have come from an LLM will do. The assertions are about report *shape* and scoring
parity, not about a specific piece of text.

A good fixture for this particular skill has a real voice on top of entirely public
substance. That's the case where the judge has to do actual work, and it's the one where
a lazy judge flatters you.
