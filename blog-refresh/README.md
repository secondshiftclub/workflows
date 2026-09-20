# Refreshing a blog post

> Companion to **[The five-step loop for refreshing a blog post](https://www.hiresecondshift.com/)**

"Update this post" is not an instruction. It's a wish. Give it to a writer and you get a nicer
version of the same page; give it to an agent and you get the same page with fresher adjectives.
Neither one answers the questions the page is losing, and neither tells you what's now wrong on it.

This is the loop that replaces it. Five steps, and every one of them writes a file next to the
draft — which is why a human can review the result in five minutes instead of thirty.

```
1. Audit    what the SERP answers, what the page misses, what's now wrong
2. Detect   which stratum is this page from? which fingerprints must go?
3. Draft    against the voice profile — frequencies, not adjectives
4. Lint     errors to zero; each surviving warning gets a written reason
5. Verify   every claim mapped to a source, gaps flagged for a human
```

**Cost: $0** for the scripts — three Python files, standard library only, no API keys. The spend
is whatever model you point at the four prompts, one page at a time.

This runs *after* a cluster decision. If you don't yet know which pages deserve a refresh at all,
start with [`topic-cluster-audit/`](../topic-cluster-audit/) and come back with the keep list.

---

## Run it

Requires Python 3.9+. No install step, no dependencies.

```bash
cp config.example.json config.json          # your site URL and house rules
cp strata.example.md strata.md              # the eras in your archive

# Step 3's raw material: derive the voice profile from your own archive, once.
python3 scripts/voice_profile.py --corpus ../corpus/blog --out voice-profile.json

# Per page — plan the links and check you're not about to compete with yourself.
python3 scripts/internal_links.py --corpus ../corpus/blog --query "your target query" \
    --site https://acme.example

# Steps 1, 2, 3 and 5 are the prompts in prompts/, run in order.

# Step 4, after drafting:
python3 scripts/style_lint.py draft.md --config config.json --profile voice-profile.json
```

---

## The voice profile is the part people skip

Don't write a voice guide. **Derive one**, by reading your own archive and recording what's
actually there as numbers:

```
Voice profile — 214 posts          # illustrative output; your numbers will differ
==============================================
  median length            1,650 words (p10 900, p90 3,200)
  'you' within 3 paras     88%   (first sentence: 40%)
  roadmap promise          70%
  opens with a question    12%
  first paragraph          38 words
  contractions / 1k words  15.0
  exclamations per post    median 1, p90 4
  dash habit               em dash in 12% of posts, spaced en in 81%
  spelling                 1,340 US / 3 UK hits

  Signature moves (recurring sentence-initial fragments):
    The result?                  31% of posts
    The catch?                   12% of posts
```

Frequencies beat adjectives for two reasons. A model can hit "64% of posts open with a roadmap
promise" and cannot hit "conversational but authoritative". And a frequency is a *default*, not a
cage — it tells a writer that breaking the pattern is a normal move, which an absolute rule never
does.

The signature moves are the interesting output. Every archive has a tic or two that are
unmistakably yours and that nobody would ever invent in a workshop — writers reproduce them
without being told. Name it and it becomes reproducible.

`voice-profile.json` then feeds the linter, so it enforces your numbers rather than mine.

---

## Errors block, warnings argue

The linter's design decision isn't which rules it has. It's that it has two severities that mean
genuinely different things.

**Errors are house facts.** Wrong spelling variant, an emoji, a bare "here" anchor, a bold-faked
heading, a term you've retired. There's no context where these are right, so nothing moves until
the count is zero.

**Warnings are defaults you're allowed to argue with.** *"Only 0 external links." "~3,400 words
(band 1,400–2,600)." "Primary keyword in only 1 H2."* A warning says *you're off the house
pattern, say why* — and sometimes there's a good why. A product-led page whose every number is
your own research legitimately carries no outbound links.

So: **a warning you can justify in writing survives** — in the verification report, where the
reviewer sees it — **and one you can't is a bug.** That's your stopping rule. Without one, review
becomes an infinite polish loop and drafts die in it.

---

## What you end up with

One page produces three files, with the lint result stamped on the draft:

```
<slug>.gap-audit.md        what was missing, what was wrong, what this page will now own
<slug>.md                  the draft
<slug>.verification.md     every claim → its source, warnings kept and why, gaps for a human
```

That's the real output of the workflow — not a better blog post but a **reviewable package**,
where the thinking is inspectable at every step.

It's also what makes the work delegable. "Refresh this post" can't be handed to anyone, human or
machine, without a long conversation. *Fill these six gaps, migrate these fingerprints, hit these
frequencies, zero the errors, source every claim* can be handed to the night shift.

---

## Files

```
blog-refresh/
  config.example.json      site URL, house rules, word bands, banned patterns
  strata.example.md        the eras in your archive and their fingerprints
  scripts/
    voice_profile.py       derive frequencies from your own posts → voice-profile.json
    internal_links.py      link candidates + the cannibalisation check
    style_lint.py          errors block, warnings argue
  prompts/
    01-gap-audit.md        SERP + query fan-out, coverage matrix, accuracy findings
    02-stratum-detect.md   which era is this page from, what must change, what to keep
    03-draft.md            write against the audit and the profile
    05-verification-report.md   claim → source map, kept warnings, gaps
```
