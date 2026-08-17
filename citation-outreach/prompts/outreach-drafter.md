# Drafter — the outreach agent

Separate routine, separate connectors: contact database, mailbox, CRM. It never runs
discovery, and Radar never holds the mailbox.

It **leaves drafts**. It does not send.

```
You are the outreach drafter. Pull CRM rows with Status = "Ready to contact", highest
live_score first, firehose-sourced rows first within that, max 12 per run.

1. FIND THE HUMAN. Use the page's byline first. Search the contact DB by DOMAIN in
   batches of 10 — domain search is free; NEVER bulk-match individual people, that
   burns a credit each. Save the person_id on the CRM row; reveal the email only at
   draft time (1 credit). No contact found → mark channel = LinkedIn or web-form and
   move on. Do not guess email patterns.

2. VERIFY THE HOOK ON THE PAGE. Before writing a line, re-fetch the target page and
   confirm the hook is really there — the dead vendor, the stale date, the competitor
   slot. If it's been fixed since discovery, pick a new hook or drop the row. Never
   write a pitch from cached data.

3. WRITE THE DRAFT (template below). Sender = the founder for founder-to-founder
   targets, or the regionally-matched teammate for regional outlets.

4. LEAVE IT AS A DRAFT. Never send. Post a Slack summary listing each draft, its
   recipient, and the verified hook, so a human can review and send in one sitting.

HARD RULES: never offer money to an editorial listicle or any journalist. Never invent
an on-page detail. Every product claim must trace to positioning.md. LinkedIn connection
notes cap at 300 characters — count them.
```

---

## The pitch template

```
Subject: [the specific thing that's wrong on their page]

Hi [name] —

[ONE verified, specific on-page detail. "Your best-X roundup still lists [defunct
vendor], which shut down in [year]." / "The list was last updated [date] and
[competitor] has since [changed thing]."]

[ONE sentence: the gap you fill on that specific page, in their framing, not yours.]

[SOMETHING YOU GIVE: a mention from your own cited guides, an integration, first-party
data, a startup deal — pick per segment.]

Happy to send a 40-word blurb in your format if it's useful.

[Sender]
```

---

## Money rules by segment

Getting this wrong is unrecoverable, so encode it in the prompt. A well-meaning agent
will absolutely offer a journalist a sponsorship.

| Segment | Approach | Why |
|---|---|---|
| Commercial directories, trade-media sales desks | **Sponsor freely** | Paid placement is literally their business model |
| Review sites with an independence disclaimer | **Ask softly** — "sponsorship if you have it" | Don't imply you're buying a ranking they publicly say they don't sell |
| Editorial listicles + **every** journalist | **Never offer money** | Offering disqualifies you, and it travels |

---

## Segment playbook

| Segment | What it is | How to win it |
|---|---|---|
| **Buyer guide** | Editorial "best X tools" listicles | Merit only. Specific in-article hook + be a source. |
| **Review site** | Independent review/roundup sites | Submit or pitch on merit; some take sponsorship. |
| **News / journalist** | Reported pieces | Be an expert **source** + offer first-party data. Never offer a backlink for coverage. |
| **Aggregator** | House-brand list sites with no byline | Email the operator; cross-list where you're missing. |
| **Adjacent vendor** | Non-competitors with content blogs | Content-gap + integration angle; reciprocal link. |

---

## Ground pitches in a positioning doc, not vibes

Our first pass of pitch angles led with a capability we don't actually ship, because the
model inferred it from adjacent content. Twenty-eight rows had to be rewritten.

Now every routine reads the positioning file first, and the prompt names the product
gaps explicitly: *never claim X or Y.* Put yours in `config.json` under `product_gaps`.

**If your agent doesn't know what you don't do, it will invent it — persuasively.**

---

## Budget the send step before you budget the tools

Everything upstream is automated and cheap. The bottleneck is a human reviewing a draft
and pressing send, and it is a real bottleneck, not a theoretical one.

At one point we had **15 outreach touches sent, 6 drafts written twelve days ago and
still unsent, and 92 verified targets nobody had touched** — roughly six times more
qualified outreach than the team was sending.

A pipeline that outruns its send capacity is just a very expensive list. Book the
30-minute review slot first. Then build the machine.
