# A truth layer for your business

> Companion to **[the post on hiresecondshift.com](https://www.hiresecondshift.com/)**

Ask a model about the Treaty of Westphalia and it gets it right. Ask it about your own
product and it quotes pricing you retired last spring. The fix is not a better model. It
is a small set of files that pin down what is true about your business, kept where every
prompt and every agent reads them first.

This folder is that set, empty. Eight files. Fill them in and you have a truth layer by
the end of the day.

**Cost: $0.** It is markdown.

---

## The files

Read in this order. When two files disagree, the one higher in the list wins.

| File | What it pins down | Who reads it |
|---|---|---|
| [`brand/guardrails.md`](brand/guardrails.md) | What you may never claim. Can-say / cannot-say lists. Legal and category lines. | Every prompt, first |
| [`brand/positioning.md`](brand/positioning.md) | The one-sentence claim, the parts of it that always travel together, how to vary it per surface, and a dated log of rulings. | Every prompt |
| [`product/facts.md`](product/facts.md) | The only hard numbers you publish about yourself, and a map of every page that repeats them. | Anything that states a number |
| [`product/pricing.md`](product/pricing.md) | Plans, prices, what is and is not included, the worked example. | Anything near a price |
| [`product/features.md`](product/features.md) | What the product does. If it is not in here, it does not exist. | Anything describing the product |
| [`audience/icp.md`](audience/icp.md) | Who buys and stays, who buys and churns, and the one filter that tells them apart. | Anything choosing an angle |
| [`audience/objections.md`](audience/objections.md) | What buyers push back on, in their words, and the honest answer to each. | Sales, landing pages, FAQs |
| [`brand/voice.md`](brand/voice.md) | How you sound. Vocabulary, banned words, structural rules. | Every prompt, last |

Plus [`CLAUDE.md.example`](CLAUDE.md.example): the wiring. Copy it to the root of the
project your agent runs in so the layer gets read before anything gets written.

## How to fill it in

Each file is a template with the questions to answer and a worked line or two in
brackets. Delete the brackets, keep the headings. The headings are what your prompts
will reference, so keep them stable once anything depends on them.

Three rules that cost us credibility to learn:

1. **Facts get one home.** Every number lives in `facts.md` and every page that repeats
   it is listed there. Change the file first, then propagate. If a page and the file
   disagree, the page is wrong.
2. **Date every ruling.** Positioning changes. When it does, add a dated line to the
   rulings log in `positioning.md` saying what changed and what it supersedes. A model
   with both the old and new line and no dates will pick one at random.
3. **Never seed the canonical claim verbatim.** One sentence pasted across twenty
   surfaces reads as spam to search engines, AI engines and humans. Keep the meaning
   fixed and the wording varied. The mutations bank in `positioning.md` is for that.

## How to use it

**With Claude Code or any file-reading agent:** copy `CLAUDE.md.example` to `CLAUDE.md`,
point the paths at wherever you put this folder, done. The agent reads the layer before
every content task.

**With a plain chat model:** paste `guardrails.md`, `positioning.md`, and the channel's
voice rules at the top of the prompt, in that order. They are written to be pasted.

**With a linter or style checker:** derive its config from `voice.md` and tag each rule
with the line it came from, so when the voice file changes you know which rules to
regenerate.

## Keeping it true

A truth layer depreciates. Pricing moves, features ship, the claim gets sharpened.
Put a `Last verified:` date at the top of each file, and when you touch a live page that
restates something from the layer, touch the layer in the same commit. If a file has not
been verified in a quarter, treat it as suspect until someone reads it against the live
product.

If you have an upstream source (a Notion page, a product catalogue, a pricing table in
your billing system), say so at the top of the file and treat these files as the cached
copy. The cache is what the agents read; the upstream is what humans edit.
