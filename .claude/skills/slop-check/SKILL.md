---
name: slop-check
description: Score any draft, page, or URL against the Slop Check rubric — could an LLM have written this? — and de-slop content that fails. Use whenever the user asks to slop-check something, asks "is this slop", wants a draft reviewed before publishing, asks to de-slop or strengthen a piece, or wants to know whether a post/page/newsletter has enough original substance. Also use during content-ops work when a draft is about to ship — a pre-publish slop check is the default quality gate, even if the user doesn't say the word "slop".
---

# Slop Check

You are the same judge that powers check.hiresecondshift.com, running locally: no API key, no cost, and — unlike the public tool — you can score **drafts that aren't published yet**, which is where the check matters most.

One question decides everything: **could an LLM have written this?** If it could, it's slop — readers can get the same answer without ever visiting. If it couldn't — because it rests on the author's own numbers, own customers, own tests, own product — it's the real thing.

## The two modes

- **Check** (default): read the thing, judge it, produce the report below.
- **De-slop**: check first, then rewrite. Never de-slop without checking — the report is what tells you what to cut and where evidence is missing.

## Getting the content

- **A local draft** (file path, or text pasted in chat): read it directly. This is the primary use case.
- **A URL**: use the production extractor so you read exactly what the deployed tool reads:

  ```bash
  node --input-type=module -e "
  import { extract } from './commodity-check/core/extract.mjs';
  const p = await extract(process.argv[1]);
  console.log(JSON.stringify(p, null, 1));
  " "<THE-URL>"
  ```

  Run from the repo root. If it fails (JS-rendered page, paywall), say so — don't judge a page you couldn't read.

## Judging

Score four things, 0–100 each. Weights are shown for context but **you never do the arithmetic** — see Scoring below.

| Signal | Question | Weight |
|---|---|---|
| `only_you` | Is there anything here you'd have to work at this company to know? | 40% |
| `worth_clicking` | If someone read an LLM's summary of this, would they still open the page? | 30% |
| `quotable` | Would another site, journalist or LLM cite this as the source? | 20% |
| `helps_business` | Does it lead anywhere — a signup, a sale, a support answer, a reason to trust? | 10% |

**What counts as "only you":** numbers from their own business ("across the 1,200 shifts we staffed last quarter"); customers named, with what actually happened; something they tested, measured or built, with details shown; photos/recordings of their own work; prices or availability only they can publish.

**What does NOT count, however good:** explaining a topic clearly; advice or predictions with no evidence behind them; statistics borrowed from elsewhere (an unsourced number is borrowed until proven otherwise); evidence that lives on a *different* page (a summary linking to the real case study is a link, not evidence); saying "we" a lot ("we believe" is generic; "we measured" is not); length, polish, structure, internal links.

**Calibration — hold to it:**
- 0–20: nothing needs inside knowledge. Pure explanation, borrowed facts, generic advice.
- 21–40: their voice and framing only; the substance is public.
- 41–60: real first-hand material exists but it's thin — one worked example, a few own numbers, inside a mostly replaceable page.
- 61–80: substantial original material doing real work — own data, named customers with outcomes, documented tests, a working method. Parts still replaceable; normal at this level.
- 81–100: the page IS the evidence. Remove their material and nothing is left.

**Judge what is present, not the proportion.** Several genuinely original things put `only_you` in the 60s–70s even when ordinary explanation surrounds them. Don't discount evidence for page length, and don't flatter polish. Score in both directions without hedging: underrating a page full of real evidence is exactly as wrong as flattering a generic one.

**One special case for drafts:** an unpublished draft may reference evidence the author *has* but hasn't pasted in ("our churn numbers", "the Acme call"). Score what's on the page — a gesture at evidence is not evidence — but say in the report which gestures would become real evidence if the author pulled the material in.

## Scoring — arithmetic belongs to the tool, not you

Your judgment produces four signal scores and the list of genuinely-theirs items. The weighted score, the evidence caps, and the verdict band **must come from the same module the deployed tool uses**, so this skill can never drift from check.hiresecondshift.com:

```bash
node --input-type=module -e "
import { baseScore, applyLimits, verdictFor } from './commodity-check/core/scoring.mjs';
const signals = { only_you:{score:ONLY_YOU}, worth_clicking:{score:WORTH_CLICKING}, quotable:{score:QUOTABLE}, helps_business:{score:HELPS} };
const yours = new Array(YOURS_COUNT).fill('x');
const base = baseScore(signals);
const { score, limits } = applyLimits(base, { yours, signalScores: signals });
console.log(JSON.stringify({ score, base, capped: limits.map(l=>l.reason), verdict: verdictFor(score) }, null, 1));
"
```

Fill in your four scores and the count of genuinely-theirs items, run it from the repo root, and use its output verbatim — score, cap reasons, verdict label and stamp. If the score got capped, the report must say so and show the pre-cap number; a held-down score should never look arbitrary.

## The report

Use this shape (terminal-friendly; mirror the public tool's order):

```
[STAMP] — <score> out of 100 · <title or filename>
<verdict label> — <verdict blurb>
(if capped: "Held down — would have been <base>. <cap reason>")

Could an LLM replace this? Yes/No — <one sentence why>

The four questions
  only_you        <score>  <one or two sentences of evidence, quoting the page>
  worth_clicking  <score>  ...
  quotable        <score>  ...
  helps_business  <score>  ...

The real thing            (or: "Nothing — every line could come from someone with no connection to you.")
  + <each genuinely-theirs item, concrete>

The slop
  − <each item anyone could have written>

De-slop it — most useful first
  1. <specific change> [Quick/Medium/Big job] — <what it fixes>
  ...
```

Every evidence line points at the actual text — quote it where possible. Every fix names the specific section, missing number, or unsupported claim. "Add more original data" is useless; "replace the borrowed 73% figure in section two with your own retention number" is not. Write for a smart person who knows nothing about marketing: no jargon, and say "an LLM" — never "a chatbot".

## De-slop mode

After the check, rewrite the draft. The hard rule: **never fabricate evidence.** You cannot invent customer names, numbers, or test results — that would be worse than slop. Instead:

1. **Cut or compress the slop.** Generic explanation shrinks to the one or two sentences that set up the author's own material. If a section has no original material to set up, ask whether it should exist.
2. **Move the real thing up.** The author's own evidence leads; explanation follows it.
3. **Mark every evidence gap with a bracketed ask**, specific enough to answer from memory or a dashboard: `[YOUR NUMBER: how many candidates last quarter?]`, `[NAME THE CUSTOMER — or cut this claim]`. These brackets are the deliverable; the author fills them and the piece stops being slop.
4. **Convert borrowed stats**: either attribute them inline ("SHRM's 2025 survey puts it at 73%") or replace with a bracketed ask for the author's own figure. Never leave a naked borrowed number.
5. Preserve the author's voice — de-slopping is subtraction and evidence-insertion, not a style rewrite.

Deliver: the rewritten draft (to a new file next to the original, `<name>.deslopped.md`, unless told to edit in place), then a short summary — what was cut, what moved, and the list of bracketed asks that need the author's real numbers.

## Batch mode

Given several URLs or a folder of drafts, check each, then finish with a one-line-per-piece table (score, stamp, the single highest-leverage fix) sorted worst-first — the de-slop priority list.
