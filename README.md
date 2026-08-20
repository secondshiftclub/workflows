# Second Shift workflows

Everything you need to run the workflows written up on **[The Second Shift Club](https://www.hiresecondshift.com/)**.

Each post on the blog describes a system we actually run. Each folder here is that system: the
scripts, the prompts, and the config, with our own keys, contacts, and internal URLs taken out.
Nothing here needs our accounts — point the config at your own domain and category and it runs.

| Workflow | The post | What it does |
|---|---|---|
| [`reddit-customer-language/`](reddit-customer-language/) | [How to mine Reddit for customer language](https://www.hiresecondshift.com/p/how-to-mine-reddit-for-customer-language) | Pull a subreddit's full history from an archive, extract verbatim buyer language, and turn it into four reference files every copy task reads from. |
| [`citation-outreach/`](citation-outreach/) | [How to automate getting mentioned in third-party listicles](https://www.hiresecondshift.com/p/how-to-automate-getting-mentioned) | Find the roundups AI engines cite that list your competitors and not you, verify them on the live page, and draft the pitch. |
| [`topic-cluster-audit/`](topic-cluster-audit/) | [How to identify and audit topic clusters on your website](https://www.hiresecondshift.com/p/how-to-identify-and-audit-topic-clusters) | Nine scripts that turn your site, Search Console, and Ahrefs into a keep / rewrite / merge / kill call on every page in a cluster. |

## Claude Code skills

Separate from the workflows above: [`.claude/skills/`](.claude/) holds drop-in skills
you can copy into your own project.

| Skill | What it does |
|---|---|
| [`slop-check/`](.claude/skills/slop-check/) | The judge behind [check.hiresecondshift.com](https://check.hiresecondshift.com), running locally — score a draft, page, or URL on *could an LLM have written this?*, then de-slop what fails. Works on unpublished drafts, which the hosted tool can't do. |

It needs one scoring module that isn't in this repo yet; [`.claude/README.md`](.claude/README.md)
explains the three ways round that.

## Start here

Every workflow follows the same shape, so you can pick one and ignore the rest:

```
<workflow>/
  README.md          what it does, what it costs, how to run it
  .env.example       every key it needs (copy to .env)
  config.example.*   your domain, your competitors, your category
  scripts/           the runnable parts
  prompts/           the LLM instructions, verbatim

.claude/skills/      drop-in Claude Code skills, independent of the workflows
```

Nothing shares state between workflows. There is no install step at the top level.

## What these cost to run

Roughly, per month, at the scale we run them:

| Workflow | Floor | Full |
|---|---|---|
| Reddit customer language | **$0** — the archive API is free | $0 |
| Citation outreach | **$95** (one AI-visibility tool) | ~$150–200 + firehose cap |
| Topic cluster audit | **$0** if you already have Ahrefs | Ahrefs API units + a few dollars of LLM |

Each README breaks its own numbers down, including the three places cost hides in the citation
pipeline. Prices were accurate in August 2026 and are not our prices to guarantee — check before
you commit.

## Ground rules baked into these scripts

Two of them cost us real money to learn, so they are worth stating up front.

**An agent must always be able to tell "the world is empty" from "my tooling is broken."**
Every silent-degradation path in a scheduled system eventually produces a confident, wrong Slack
message. Optional sources skip loudly; a failed classifier fails hard rather than emitting
unvetted rows.

**Verify against the live page, never against cached data.** Citation and backlink data is a
cache, and it is wrong in expensive ways — the page changed, you're already on it, or the
"adjacent site" you're about to pitch is a direct competitor in disguise.

## A note on the data

The sample CSVs here are shaped like the real ones and filled with invented rows. We stripped
every real contact, byline, and account ID before publishing — those are other people's details,
not ours to hand out. You build your own list; the scripts show you how.

## License

MIT. Take them, change them, ship them. No attribution needed, though we'd love to hear if one
of these works for you — [drop a comment on the post](https://www.hiresecondshift.com/).
