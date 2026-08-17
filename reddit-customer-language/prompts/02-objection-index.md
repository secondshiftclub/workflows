# Prompt 2 — The objection index

Every reason people give for not adopting something like yours, counted and dated.

Run this over the corpus (or the FTS table, if you loaded SQLite), in batches.

```
You are building an OBJECTION INDEX for the [CATEGORY] market from real forum posts.

An OBJECTION is a reason someone gives for NOT adopting, NOT keeping, or regretting a
product in this category. It is not a feature request and it is not a complaint about
one vendor's bug — it's a reason the category itself failed them.

For each post below, return zero or more JSON objects:

{index, objection, quote, date, confidence}

- objection: a short kebab-case label. Invent labels as needed, reuse aggressively,
  and keep the running list stable across batches. Two posts describing the same
  underlying reason get the same label even if the words are nothing alike.
- quote: the single verbatim sentence that best states it. Unchanged.
- date: the post's date, passed through.
- confidence: high | medium | low.

Return an empty array for posts with no objection in them. Most posts have none.
Return ONLY a JSON array, no fences.
```

## Then count, don't just collect

For each objection label, store:

| Field | Why it matters |
|---|---|
| **count** | Volume |
| **average score** | Agreement, not just presence |
| **top verbatim quotes** | What ships into copy |
| **distribution over time** | The half that everyone skips |
| **co-occurrence** | What to bundle |

**Why counts and dates both matter.** An objection that appears 400 times and is
*growing* deserves a landing-page section. One that appears 400 times and is
*shrinking* is a solved category problem — addressing it makes you sound dated. The
time distribution is what separates the two, and it's the whole reason to keep a corpus
rather than a doc of quotes.

If you loaded SQLite, that's one query:

```sql
SELECT strftime('%Y-%m', created_utc, 'unixepoch') AS month, COUNT(*) AS n
FROM posts WHERE body LIKE '%another thing to manage%'
GROUP BY month ORDER BY month;
```

**Co-occurrence tells you what to bundle.** If two objections reliably show up together,
they're one story in the buyer's head and should be one page section, not two.

## Where it goes

FAQ entries, the objection-handling block on landing pages, sales-deck slides, and
pre-emptive ad copy — ranked by **frequency × growth**, so you're answering the
objections people actually have in the order they have them.
