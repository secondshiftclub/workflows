#!/usr/bin/env python3
"""Internal-link candidates, and the cannibalisation check that matters more.

Scores every page in your markdown corpus against the target query — title hits
weigh most, then slug, then body frequency — and prints ranked candidates with
their live URLs, ready to paste into the draft's link plan.

It also flags cannibalisation: pages whose title already contains the whole
query. That is how you find out you are about to refresh a page into a
competitor of one you already own.

Usage:
  python3 internal_links.py --corpus ./corpus --query "sms api pricing" --site https://acme.example
  python3 internal_links.py --corpus ./corpus --query "sms api" --top 20 --path-prefix /blog/
"""
import argparse, pathlib, re
from collections import namedtuple

Hit = namedtuple("Hit", "score title url path body_hits in_title in_slug")


def title_of(text, fallback):
    m = re.search(r"^title:\s*[\"']?(.+?)[\"']?\s*$", text, re.M)
    if m:
        return m.group(1)
    m = re.search(r"^#\s+(.+)$", text, re.M)
    return m.group(1).strip() if m else fallback


def url_of(path, root, site, prefix):
    rel = path.relative_to(root).with_suffix("")
    slug = "/".join(rel.parts)
    if prefix and not slug.startswith(prefix.strip("/")):
        slug = prefix.strip("/") + "/" + rel.parts[-1]
    return f"{site.rstrip('/')}/{slug}/"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", required=True)
    ap.add_argument("--query", required=True)
    ap.add_argument("--site", default="", help="site base URL, for building live links")
    ap.add_argument("--path-prefix", default="", help="e.g. /blog/ if your corpus is flat")
    ap.add_argument("--top", type=int, default=15)
    a = ap.parse_args()

    root = pathlib.Path(a.corpus)
    q = a.query.lower().strip()
    terms = [t for t in re.split(r"\s+", q) if len(t) > 2]
    hits = []
    for f in root.rglob("*.md"):
        text = f.read_text(encoding="utf8", errors="ignore")
        low = text.lower()
        title = title_of(text, f.stem)
        tl, sl = title.lower(), f.stem.lower().replace("-", " ")
        body_hits = sum(low.count(t) for t in terms)
        in_title = sum(1 for t in terms if t in tl)
        in_slug = sum(1 for t in terms if t in sl)
        if not (body_hits or in_title or in_slug):
            continue
        score = in_title * 25 + in_slug * 10 + min(body_hits, 40)
        if q in tl:
            score += 40
        hits.append(Hit(score, title, url_of(f, root, a.site or "", a.path_prefix), f, body_hits, q in tl, q in sl))

    hits.sort(key=lambda h: -h.score)
    cannibals = [h for h in hits if h.in_title]

    if cannibals:
        print(f"\n⚠  CANNIBALISATION — {len(cannibals)} page(s) already own \"{a.query}\" in the title:\n")
        for h in cannibals:
            print(f"   {h.title}\n     {h.url or h.path}")
        print("\n   Decide which URL owns this query before drafting. Two pages on one query is the\n"
              "   problem the refresh is supposed to fix, not a thing to add to.\n")
    else:
        print(f"\nNo title-level cannibalisation for \"{a.query}\".\n")

    print(f"Internal-link candidates ({min(a.top, len(hits))} of {len(hits)} matching pages)")
    print("-" * 72)
    for h in hits[:a.top]:
        flag = " ←owns the query" if h.in_title else ""
        print(f"  {h.score:4}  {h.title[:56]}{flag}")
        print(f"        {h.url or h.path}")
    print()


if __name__ == "__main__":
    main()
