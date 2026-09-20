# Prompt — verification report

Save as `<slug>.verification.md` beside the draft. Built so a reviewer can check any claim in
**under a minute** without re-researching it.

**A draft without its verification file does not ship.**

---

```markdown
# Source verification — [Post title]

**Draft:** `<slug>.md` · **Primary keyword:** [kw] · **Content type:** [type] · **Words:** [n]
**Lint:** clean / [n] warnings (each explained below)

## Claim → source map

| # | Claim in the draft | Section | Source | Type |
|---|---|---|---|---|
| 1 | "[verbatim or near-verbatim claim]" | Intro | [report name](url) | First-party |
| 2 | "[claim]" | How it works | `source-of-truth/product/features.md` | Source of truth |
| 3 | "[claim]" | Comparison | [authority](url) | External authority |

Types: **Source of truth** (file + line) · **First-party** (own research + URL) ·
**Own corpus** (existing page URL) · **External authority** (URL) · **Live page**
(fetched — needs a human eyeball).

## Lint warnings kept, and why

| Warning | Reason it stands |
|---|---|
| 0 external links | Every quantitative claim is first-party research; product-led pages link internally only. |

## Gaps and flags

- [ ] [Claims that could not be sourced — say what was cut or hedged instead]
- [ ] [Stats older than two years that should be refreshed before publish]
- [ ] [Anything touching pricing, competitors, or compliance — always a human decision]
- [ ] [CMS tasks the markdown cannot carry: schema, meta title, redirects to set at publish]

## Links used

| Anchor | Target | Why |
|---|---|---|
```
