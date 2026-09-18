#!/usr/bin/env python3
"""Derive a voice profile from your own archive.

Reads a directory of markdown posts and counts what is actually there — intro
shape, sentence rhythm, contraction rate, dash and exclamation habits, and the
sentence-initial tics that are unmistakably yours. Writes voice-profile.json
(machine-readable, feeds style_lint.py) and prints a human summary.

The point is frequencies, not adjectives. "70% of posts open with a roadmap
promise" is something a writer or a model can hit. "Conversational but
authoritative" is not.

Usage:
  python3 voice_profile.py --corpus ./corpus/blog --out voice-profile.json
  python3 voice_profile.py --corpus ./corpus/blog --since 2024   # recent strata only
"""
import argparse, json, pathlib, re, statistics as st
from collections import Counter

CONTRACTION = re.compile(r"\b\w+['’](?:s|t|re|ve|ll|d|m)\b", re.I)
SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")
# sentence-initial fragment followed by a question mark: "The result?", "The catch?"
TIC = re.compile(r"(?:^|(?<=[.!?]\s))((?:[A-Z][a-z']+\s?){1,4})\?", re.M)
UK = re.compile(r"\b(?:recognise|colour|optimise|behaviour|favourite|organise|organisation|"
                r"analyse|centre|fibre|personalise|utilise|realise|licence|programme)\b", re.I)
US_MARKER = re.compile(r"\b(?:recognize|color|optimize|behavior|favorite|organize|organization|"
                       r"analyze|center|fiber|personalize|utilize|realize|license|program)\b", re.I)


def strip_md(text):
    text = re.sub(r"^---\n.*?\n---\n", "", text, flags=re.S)      # frontmatter
    text = re.sub(r"```.*?```", " ", text, flags=re.S)            # code
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)             # images
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)          # links -> anchor text
    return text


def paragraphs(body):
    return [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip() and not p.lstrip().startswith(("#", "|", ">", "-", "*"))]


def analyse(path, since=None):
    raw = path.read_text(encoding="utf8", errors="ignore")
    if since:
        m = re.search(r"(20\d\d)", raw[:600])
        if m and int(m.group(1)) < since:
            return None
    body = strip_md(raw)
    paras = paragraphs(body)
    if len(paras) < 3:
        return None
    words = body.split()
    n_words = len(words)
    if n_words < 250:
        return None
    intro = " ".join(paras[:3])
    sent_counts = [len([s for s in SENT_SPLIT.split(p) if s.strip()]) for p in paras]
    heads = re.findall(r"^(#{2,3})\s+(.+)$", raw, re.M)
    titlecase = sum(1 for _, h in heads if len([w for w in h.split()[1:] if re.match(r"^[A-Z][a-z]+$", w)]) >= 2)
    return {
        "words": n_words,
        "first_para_words": len(paras[0].split()),
        "you_in_intro": bool(re.search(r"\byou(r)?\b", intro, re.I)),
        "you_in_first_sentence": bool(re.search(r"\byou(r)?\b", SENT_SPLIT.split(paras[0])[0], re.I)),
        "roadmap": bool(re.search(r"\b(in this (guide|post|article)|we'?ll (break|walk|show|cover)|let'?s (dive|explore|take a look))", intro, re.I)),
        "question_open": paras[0].rstrip().endswith("?"),
        "contractions_per_1k": len(CONTRACTION.findall(body)) / n_words * 1000,
        "exclamations": len(re.findall(r"!", body)),
        "em_dashes": len(re.findall(r"—", body)),
        "spaced_en": len(re.findall(r"\s–\s", body)),
        "median_sentences_per_para": st.median(sent_counts) if sent_counts else 0,
        "long_paras": sum(1 for c in sent_counts if c > 4),
        "h2s": len([h for h, _ in heads if h == "##"]),
        "titlecase_heads": titlecase,
        "heads": len(heads),
        "uk": len(UK.findall(body)),
        "us": len(US_MARKER.findall(body)),
        "tics": [t.strip() for t in TIC.findall(body)],
    }


def pct(rows, key):
    return 100.0 * sum(1 for r in rows if r[key]) / len(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", required=True, help="directory of .md posts")
    ap.add_argument("--out", default="voice-profile.json")
    ap.add_argument("--since", type=int, help="only posts whose header mentions this year or later")
    a = ap.parse_args()

    files = sorted(pathlib.Path(a.corpus).rglob("*.md"))
    rows = [r for r in (analyse(f, a.since) for f in files) if r]
    if not rows:
        raise SystemExit(f"no usable posts found under {a.corpus}")

    tics = Counter(t for r in rows for t in r["tics"])
    # a tic is only a tic if it recurs across posts, not 20 times in one
    tic_posts = Counter()
    for r in rows:
        for t in set(r["tics"]):
            tic_posts[t] += 1
    signature = [(t, n, round(100 * n / len(rows))) for t, n in tic_posts.most_common(12) if n >= max(3, len(rows) * 0.05)]

    prof = {
        "posts_analysed": len(rows),
        "length": {"median_words": int(st.median(r["words"] for r in rows)),
                   "p10": int(st.quantiles([r["words"] for r in rows], n=10)[0]),
                   "p90": int(st.quantiles([r["words"] for r in rows], n=10)[8])},
        "intro": {
            "you_within_3_paragraphs_pct": round(pct(rows, "you_in_intro")),
            "you_in_first_sentence_pct": round(pct(rows, "you_in_first_sentence")),
            "roadmap_promise_pct": round(pct(rows, "roadmap")),
            "opens_with_question_pct": round(pct(rows, "question_open")),
            "median_first_paragraph_words": int(st.median(r["first_para_words"] for r in rows)),
        },
        "rhythm": {
            "median_sentences_per_paragraph": st.median(r["median_sentences_per_para"] for r in rows),
            "posts_with_a_5plus_sentence_paragraph_pct": round(100 * sum(1 for r in rows if r["long_paras"]) / len(rows)),
            "median_h2s": int(st.median(r["h2s"] for r in rows)),
        },
        "mechanics": {
            "contractions_per_1000_words": round(st.median(r["contractions_per_1k"] for r in rows), 1),
            "exclamations_median": st.median(r["exclamations"] for r in rows),
            "exclamations_p90": int(st.quantiles([r["exclamations"] for r in rows], n=10)[8]),
            "em_dash_posts_pct": round(100 * sum(1 for r in rows if r["em_dashes"]) / len(rows)),
            "spaced_en_dash_posts_pct": round(100 * sum(1 for r in rows if r["spaced_en"]) / len(rows)),
            "title_case_heading_share_pct": round(100 * sum(r["titlecase_heads"] for r in rows) / max(1, sum(r["heads"] for r in rows))),
            "uk_spelling_hits": sum(r["uk"] for r in rows),
            "us_spelling_hits": sum(r["us"] for r in rows),
        },
        "signature_moves": [{"fragment": t + "?", "posts": n, "pct_of_posts": p} for t, n, p in signature],
    }
    pathlib.Path(a.out).write_text(json.dumps(prof, indent=2))

    print(f"\nVoice profile — {len(rows)} posts\n" + "=" * 46)
    print(f"  median length            {prof['length']['median_words']} words (p10 {prof['length']['p10']}, p90 {prof['length']['p90']})")
    i = prof["intro"]
    print(f"  'you' within 3 paras     {i['you_within_3_paragraphs_pct']}%   (first sentence: {i['you_in_first_sentence_pct']}%)")
    print(f"  roadmap promise          {i['roadmap_promise_pct']}%")
    print(f"  opens with a question    {i['opens_with_question_pct']}%")
    print(f"  first paragraph          {i['median_first_paragraph_words']} words")
    m = prof["mechanics"]
    print(f"  contractions / 1k words  {m['contractions_per_1000_words']}")
    print(f"  exclamations per post    median {m['exclamations_median']}, p90 {m['exclamations_p90']}")
    print(f"  dash habit               em dash in {m['em_dash_posts_pct']}% of posts, spaced en in {m['spaced_en_dash_posts_pct']}%")
    print(f"  spelling                 {m['us_spelling_hits']} US / {m['uk_spelling_hits']} UK hits")
    if prof["signature_moves"]:
        print("\n  Signature moves (recurring sentence-initial fragments):")
        for s in prof["signature_moves"][:6]:
            print(f"    {s['fragment']:<28} {s['pct_of_posts']}% of posts")
    else:
        print("\n  No recurring fragment tic found — not every archive has one.")
    print(f"\nwrote {a.out}\n")


if __name__ == "__main__":
    main()
