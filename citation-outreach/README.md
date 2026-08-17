# Citation outreach

> Companion to **[How to automate getting mentioned in third-party listicles](https://www.hiresecondshift.com/p/how-to-automate-getting-mentioned)**

We ranked top three for a stack of buyer-intent queries and earned a **0.09%
click-through rate** on them. Not "the competitor is winning the click." Nobody was
clicking. The answer was being assembled above the results, and our page was one of the
ingredients — retrieved, parsed, digested, and never named.

There are two completely different AEO failures, and they need different fixes:

- **Retrieval gap** — the model can't read your site. Fix with SSR, schema, `llms.txt`,
  clean crawlability. Boring, mechanical, done in a week.
- **Surfacing gap** — the model reads your site, uses your content, and still recommends
  five other vendors by name. **Not fixable on your own domain at all.**

This is the machine for the second one: **get named in the pages the models already
quote.**

---

## The core insight

Every AI-visibility tool can tell you which domains get cited for your category's
prompts, and which brands get mentioned in those answers. Almost everyone reads this as
a scoreboard — *"our visibility is 12%, up three points."*

Stop reading it as a scoreboard. Read it as a **CRM import file.**

Filter for `gap > 0`: pages where two or more of your competitors are cited and you
aren't. Every row is a page that has already earned the model's trust, is already being
quoted in answers to the exact question your buyer is asking, and is missing exactly one
vendor. You.

That's not a content opportunity. That's a to-do list with a name and an email address
at the end of it.

---

## Run it

Requires Node 18+ and `curl`. No dependencies.

```bash
cp config.example.json config.json   # your domain, competitors, category
cp .env.example .env                 # your keys
```

```bash
# Source 2 — the leading indicator
node scripts/ahrefs-linkgap.mjs --limit 500 --min-dr 15 > linkgap.csv

# Source 3 — yesterday's listicles (run this DAILY)
node scripts/citation-radar.mjs --since 24h > fresh.json

# Verify everything against the LIVE page before it touches your CRM
node scripts/verify-targets.mjs --json candidates.json > verified.json
```

Source 1 (the citation-gap scan) runs through your AI-visibility tool's own connector —
the [Radar prompt](prompts/radar-discovery.md) drives it.

---

## The architecture

Six stages, two scheduled agents, one human in exactly one place.

```
[Discovery: 3 sources] → [Dedupe vs cache] → [Verify on the LIVE page]
      → [Score by leverage] → [CRM row] → [Draft — human sends] → [Closed loop]
```

The two agents are deliberately separated:

- **[Radar](prompts/radar-discovery.md)** (weekly + a daily fresh pass): discovery only.
  Finds and verifies targets, writes CRM rows. **No contact database, no mailbox.**
- **[Drafter](prompts/outreach-drafter.md)** (weekly): picks up rows marked ready, finds
  the human, writes the pitch, leaves it **as a draft**.

That split isn't tidiness, it's blast radius. A discovery agent that can also send email
is one bad HTML parse away from cold-pitching your biggest competitor.

---

## Three supply sources, in order of maturity

| Source | What it sees | Universe | Conversion | Cadence | Script |
|---|---|---|---|---|---|
| **Citation-gap scan** | Pages engines cite *today* | Small | High | Weekly | your visibility tool |
| **Backlink link-gap** | Pages linking to ≥2 competitors, not you | ~10× bigger | Medium — these get cited *next* | Weekly | [`ahrefs-linkgap.mjs`](scripts/ahrefs-linkgap.mjs) |
| **Fresh-listicle firehose** | Lists published in the last 24h | Small, perishable | **Highest** | Daily | [`citation-radar.mjs`](scripts/citation-radar.mjs) |

The firehose converts better than the other two combined, for a reason that has nothing
to do with technology. An editor who published a roundup eighteen months ago has moved
on; getting added means convincing them to reopen a doc they consider finished. An
editor who published one **yesterday** is still in the doc. They know it's thin. Adding
a vendor is a two-minute edit that makes their week's work better. Same pitch, same
product, roughly ten times the hit rate.

---

## The rules that cost us money to learn

**Block the competitor's domain. Never block the competitor's name.** A post titled *"7
best [Competitor A] alternatives"* on Competitor A's own blog is worthless — they will
never add you. The identical page on a third-party site is the highest-intent target in
the whole pipeline. Filter on the domain, keep the keyword. This is easy to get
backwards while writing a blocklist at 11pm, and getting it backwards silently deletes
your best lane.

**Filter cheap first, expensive second.** A day of stream is thousands of documents. A
keyword pre-filter costs nothing and cuts it to a few dozen — and a candidate must match
**both** the listicle signals and the category terms, not either. "Top 10 productivity
tools" is a list and not your category. "How to run a structured interview" is your
category and not a list.

**Fail hard, not soft.** An optional source with a missing key should skip. A *failed
classifier* must never degrade into "emit everything, let the agent sort it out" — the
agent downstream has no way to know vetting didn't happen. It'll write 200 junk domains
to your CRM and report a fantastic week. Same principle as the `BLOCKED` verdict:
**an agent must always be able to tell "the world is empty" from "my tooling is broken."**

**Build live verification first.** We ran two weeks on cached data and wrote pitches
referencing details that had already been fixed. Nothing burns an editor faster than
being confidently wrong about their own page. In one big mine, roughly a **third** of the
"adjacent vendor" gap domains turned out to be competitors in disguise — two dozen of
them caught only by fetching the homepage.

**Multiply, don't add.** `live_score = retrievals × competitors_on_the_live_page`. A page
with 600 retrievals and one competitor is a brand mention. A page with 200 retrievals and
eight competitors is a **category list** — the shape a model reaches for when someone
asks "what are my options."

---

## What it costs

| Layer | Tool | Cost | Droppable? |
|---|---|---|---|
| Citation gap | AI-visibility tool, entry tier | **$95/mo** | No — this is the fuel |
| Backlink link-gap | Ahrefs API | ~16k units/mo | Yes at first |
| Fresh listicles | Firehose | **$5 per 1,000 matches**, prepaid | Yes — best source, most variable bill |
| Classifier | `gpt-4o-mini`, batched | **~$1–2/mo** | Already free-ish |
| Contact finding | Apollo | **$0–49/mo** | Free tier is usually enough |
| CRM / drafts / digest | Notion + Gmail + Slack | owned | Airtable or Sheets is fine |
| Scripts | ~400 lines of Node, zero deps | $0 | — |

**All-in: $95/mo minimum, ~$150–200/mo for the full pipeline**, plus whatever cap you set
on the firehose.

### The three places cost hides

1. **Ahrefs bills by row, not by query.** One row = one API unit; every billable request
   costs a minimum of 50 units; expensive fields cost 10 units per row instead of 1. Trim
   `--limit` before you trim competitors — dropping a competitor blinds the gap, dropping
   rows just shortens the tail.

2. **The firehose bills per match delivered, not per keeper.** Your bill is set entirely
   by how tight your upstream stream rules are — *not* by the local keyword filter, which
   runs after you've already paid for the document. **Push the filter upstream**, and keep
   general monitoring rules in a separate tap from the citation radar.

3. **Contact credits are cheaper than everyone assumes — if you use them right.**
   Domain-level people-search is free; batch 10 domains at a time. Only the email reveal
   costs a credit, and you should only reveal at draft time on rows that survived
   verification. Our biggest outreach day — 194 opportunities triaged, 22 drafts — spent
   about **26 credits**. The anti-pattern that burns them is bulk person-matching your
   whole candidate list at import.

*Prices were accurate in August 2026. Verify before relying on them.*

---

## Files

```
config.example.json          your domain, competitors, category, blocklists, stale vendors
.env.example                 the three keys
scripts/
  ahrefs-linkgap.mjs         source 2 — pages linking to >=2 competitors, not you
  citation-radar.mjs         source 3 — yesterday's listicles, keyword-filtered then classified
  verify-targets.mjs         the live-page check. build this first.
  lib/config.mjs             config + env loading
  lib/http.mjs               proxy-aware GET (native fetch ignores HTTPS_PROXY)
prompts/
  radar-discovery.md         the discovery agent, all 10 steps
  outreach-drafter.md        contacts, drafts, pitch template, money rules
data/
  crm-domains.sample.csv     the dedupe cache — shape only, invented rows
```

The sample CSV is invented. Every real contact, byline, and account ID was stripped
before publishing — those are other people's details, not ours to hand out.
