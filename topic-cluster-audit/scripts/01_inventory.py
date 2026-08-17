#!/usr/bin/env python3
"""Step 1 — Inventory what actually exists.

This sounds trivial. It is probably the most important step of the process.

"How many pages do we have about X" is a question most content teams can't answer
easily on a large-ish site. It's also where the skeletons surface — wrong-language
pages on English URLs, debris from a platform migration eighteen months earlier,
sitting there cannibalizing the real pages for their own keywords.

Input:  a markdown corpus of your site (crawl it once; ours is ~6,600 pages and now
        rebuilds weekly). Screaming Frog will get you there if you don't have a
        friendly web dev.
Output: out/inventory.csv — url, slug, title, page_type, word_count, path

The topic has to be the page's PRIMARY subject, not a passing mention. The default
rule below: a topic term in the title or slug, or the terms appearing at a real
density in the body.
"""

import re
import sys
from pathlib import Path

from lib import ROOT, load_config, write_csv

cfg = load_config()
TERMS = [t.lower() for t in cfg["topic_terms"]]
MIN_HITS = cfg.get("inventory", {}).get("min_body_hits", 4)
MIN_DENSITY = cfg.get("inventory", {}).get("min_density", 0.0015)

corpus = Path(cfg["corpus_dir"]).expanduser()
if not corpus.is_absolute():
    corpus = (ROOT / corpus).resolve()
if not corpus.exists():
    sys.exit(f"corpus_dir {corpus} not found — point config.json at your markdown crawl")


def frontmatter(text):
    """Pull a title and url out of YAML frontmatter, if there is any."""
    meta = {}
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            for line in text[3:end].splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    meta[k.strip().lower()] = v.strip().strip("\"'")
    return meta


def strip_markdown(text):
    text = re.sub(r"^---.*?\n---", "", text, flags=re.S)
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"[#>*_`|-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def page_type(url, path):
    """Bucket by URL shape. Adjust to your own site's architecture."""
    for pattern, label in (cfg.get("page_types") or {}).items():
        if re.search(pattern, url):
            return label
    return "page"


rows = []
scanned = 0
for path in sorted(corpus.rglob("*.md")) + sorted(corpus.rglob("*.mdx")):
    scanned += 1
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        continue
    meta = frontmatter(raw)
    body = strip_markdown(raw)
    words = body.split()
    word_count = len(words)
    if word_count == 0:
        continue

    slug = meta.get("slug") or path.stem
    url = meta.get("url") or f"{cfg['site_url'].rstrip('/')}/{slug}"
    title = meta.get("title") or (
        re.search(r"^#\s+(.+)$", raw, flags=re.M).group(1) if re.search(r"^#\s+(.+)$", raw, flags=re.M) else slug
    )

    haystack = f"{title} {slug}".lower()
    body_lower = body.lower()
    hits = sum(body_lower.count(t) for t in TERMS)
    in_title_or_slug = any(t in haystack for t in TERMS)
    density = hits / max(word_count, 1)

    # Primary subject, not a passing mention.
    if not (in_title_or_slug or (hits >= MIN_HITS and density >= MIN_DENSITY)):
        continue

    rows.append(
        {
            "url": url,
            "slug": slug,
            "title": title,
            "page_type": page_type(url, path),
            "word_count": word_count,
            "topic_hits": hits,
            "in_title_or_slug": in_title_or_slug,
            "path": str(path.relative_to(corpus)),
        }
    )

rows.sort(key=lambda r: -r["word_count"])
write_csv("inventory.csv", rows)
print(f"scanned {scanned} files → {len(rows)} pages in the '{cfg['topic']}' cluster", file=sys.stderr)
print(
    "\nRead this file before you run anything else. Look for pages in the wrong "
    "language, migration debris, and duplicate slugs. That's where the skeletons are.",
    file=sys.stderr,
)
