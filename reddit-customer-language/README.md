# Mining Reddit for customer language

> Companion to **[How to mine Reddit for customer language](https://www.hiresecondshift.com/p/how-to-mine-reddit-for-customer-language)**

Keyword tools tell you what people *type into Google*. Reddit tells you what they
*actually say* when nobody's selling to them. That gap is where the good copy lives.

Search data gives you `field service management software` — flat, transactional,
stripped of feeling. The same person on r/HVAC writes *"I'm running five trucks off a
whiteboard and my wife does the invoicing at 11pm."* One of those is a keyword. The
other is a headline, an ad hook, and a landing page's opening paragraph.

**Cost: $0.** The archive API is free and the embedding-free extraction runs on a
laptop. The only spend is whatever LLM you point at the prompts, and the batches are
small.

---

## Run it

Requires Node 18+. No install step, no dependencies.

```bash
# 1. Pull six months of posts (start with posts, never comments)
node scripts/pull.mjs --sub HVAC --months 6 > posts.jsonl

# 2. Extract the unmet-need sentences
node scripts/triggers.mjs posts.jsonl > language-bank.csv

# 3. Pull the switching stories
node scripts/competitors.mjs posts.jsonl --brands "ServiceTitan,Housecall Pro,Jobber" > competitors.csv

# 4. Only once the corpus is big — extraction passes become queries
node scripts/to-sqlite.mjs posts.jsonl | sqlite3 corpus.db
```

Then run the four prompts in [`prompts/`](prompts/) over the CSVs, and file the results
into the [`templates/`](templates/).

**Scope it sanely.** A busy subreddit runs a few thousand posts a month — very
manageable in a spreadsheet. **Comments are roughly twenty times that volume.** Pull
posts first; go to comments only once you know which threads deserve a closer look.

---

## The shape of the thing

The problem with a one-off pull: you do it once, you get a burst of good copy, and four
months later the doc is stale and nobody opens it. The fix is to stop treating the pull
as *research* and start treating it as **infrastructure** — a small set of durable files
that every copy task reads from, refreshed on a schedule.

```
  Raw corpus (posts + comments, archived once, refreshed monthly)
        │
        ▼  extraction pass — segment, then pattern-match
        │
  ┌─────┴──────┬──────────────┬─────────────┐
  ▼            ▼              ▼             ▼
LANGUAGE    OBJECTION      GAP           COMPETITOR
  BANK        INDEX        REPORT         SENTIMENT
  │            │              │             │
  └─────┬──────┴──────────────┴─────────────┘
        ▼  synthesis — cross-reference, rank
   PRIORITY LIST  +  VOICE-OF-CUSTOMER BRIEF
        │
        ▼  attached to every copy task
   Landing pages · Ads · Blog · Sales decks · FAQs
        │
        ▼  measure what shipped → feeds the next refresh
```

| File | Built by | Feeds |
|---|---|---|
| Language bank | `triggers.mjs` → [prompt 1](prompts/01-extract-and-segment.md) | Headlines, ad copy, hero sections, subject lines |
| Objection index | [prompt 2](prompts/02-objection-index.md) | FAQs, objection blocks, sales decks, comparison pages |
| Gap report | [prompt 3](prompts/03-gap-report.md) | Blog calendar, top-of-funnel, campaign themes |
| Competitor sentiment | `competitors.mjs` | Comparison pages, switcher campaigns, battlecards |
| **Priority list + VoC brief** | [prompt 4](prompts/04-synthesis.md) | Everything — this is the one people open |

---

## Three things that make or break it

**Find the right subreddits, which are usually not the obvious one.** The industry
subreddit is often the *worst* one — it's full of practitioners performing expertise for
each other rather than customers describing problems. Two questions get you to better
sources: *where does your buyer hang out for reasons unrelated to your product*, and
*where do people go to complain about the job your product does*. Before committing,
skim thirty posts and ask whether this is customers describing problems or practitioners
giving each other advice. Both are useful; only the first gives you buyer language.

**Sort by comment count, not score.** The single most useful habit in the whole guide.
Score means people *agreed* — that's viral advice and relatable jokes. Comment count
means people *had something to add*, which is where the specific, messy, quotable
stories are. The most-upvoted posts are usually the least useful ones in the file.
`triggers.mjs` sorts this way by default.

**Search for grammatical markers, not topics.** Don't do topic modelling. Eight phrases
do almost all the work, because they're how people announce a problem in plain speech:

| Trigger | What it surfaces |
|---|---|
| "I wish…" / "if only…" | Feature demand, stated as a want |
| "I'm drowning in…" | Volume and overwhelm pain |
| "tired of…" / "I hate…" | Emotional intensity — ad copy gold |
| "the problem is…" | Their own framing of the core issue |
| "my biggest problem…" | Priority ranking, self-reported |
| "nobody understands…" | Isolation — the empathy angle |

---

## Start smaller than the diagram

The full shape above is where it ends up, not where it starts. A working version one:

1. One subreddit, six months of posts
2. `triggers.mjs`, sorted into three persona buckets — a spreadsheet is fine
3. The top ten objections with a quote each
4. The best thirty quotes in a doc, linked at the top of every copy brief

That's a day's work and it will noticeably change what you ship. Add the counting, the
time distribution, and the automated refresh once it's proved itself. **Building the
pipeline before proving the value is the most common way this dies.**

---

## The rules

**Don't publish anyone's words verbatim in public.** These are real people who didn't
write for your marketing. The language bank is an *input* — it shapes how you phrase
things; it is not a quote sheet to paste into a landing page. Paraphrase the pain, never
the person. Strip usernames, employers, and identifying details from anything that ships.

**Don't treat it as evidence.** "Contractors on Reddit say…" is not a statistic, a
validated claim, or a market trend. Reddit tells you *how to say* something. A count of
400 mentions is a count of 400 mentions, not market share.

**Account for the selection bias.** People post when frustrated, stuck, or showing off.
The quietly satisfied majority is invisible. Excellent for language and objections;
genuinely bad for sizing a market or gauging sentiment.

**Check whose side of the transaction you're reading.** Every market has a loud,
quotable subreddit full of people on the *other* side from your buyer — users instead of
purchasers, employees instead of owners, technicians instead of the person holding the
invoice. Their language is vivid and it will walk you into positioning that resonates
beautifully with people who will never buy. Know which side you're reading, every time.

---

## Appendix — the API, and the two gotchas

[Arctic Shift](https://arctic-shift.photon-reddit.com/download-tool) has a browser
download tool that needs nothing technical. `pull.mjs` uses the public API behind it:

```
https://arctic-shift.photon-reddit.com/api/posts/search
  ?subreddit=<name>
  &after=<unix-timestamp>&before=<unix-timestamp>
  &sort=asc&limit=100
  &fields=id,created_utc,author,title,selftext,score,num_comments,link_flair_text
```

Swap `/posts/` for `/comments/` to pull comments.

- **`permalink` is not a valid field.** Requesting it returns a 400 that kills the whole
  call. Rebuild links as `reddit.com/r/<sub>/comments/<id>/`.
- **Paginate on `created_utc`, and bump forward a second** when a batch shares one
  timestamp, or the loop stalls on it forever. Dedupe on `id`.
- **`query=<terms>`** does full-text filtering and ANDs the terms — the fastest way to
  cut a huge subreddit down to relevant posts.
- Be polite: a short pause between requests and a real User-Agent string.

Both gotchas are already handled in `pull.mjs`.
