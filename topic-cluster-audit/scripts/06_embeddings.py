#!/usr/bin/env python3
"""Step 5 — Embeddings, locally, for free.

Embeddings get a lot of hate as a nerdy SEO thing people use to sell expensive agency
engagements. But content cannibalization is mostly a machine problem, and it benefits
from a machine-based analysis.

Four things this does, in the order that matters:

1. STRIP EACH PAGE TO ITS MAIN CONTENT. Kill the nav, footer, CTA blocks, and
   related-posts modules before you do anything else. Skip this and every page on your
   site scores as similar to every other page. This is not optional.
2. Chunk into ~250-word passages with 40-word overlap; embed every chunk with
   BAAI/bge-small-en-v1.5 via sentence-transformers. Runs on a laptop, no API — 1,239
   passages took a couple of minutes.
3. Mean-pool chunks into one normalized vector per page, AND KEEP THE CHUNK VECTORS.
   You want two similarity numbers per page pair:
     - whole-page cosine        → catches twin pages
     - max chunk-to-chunk cosine → catches the sneakier case, a 3,000-word guide whose
       middle section duplicates another page wholesale, which mean-pooling averages
       into invisibility
4. Flag thin pages (under ~200 words of real content) rather than scoring them.

Output:
  out/similarity_pairs.csv  — page pairs >= threshold, both similarity numbers
  out/page_clusters.csv     — agglomerative cluster id per page
  out/thin_pages.csv        — pages under the word floor

THE THRESHOLD DOES NOT TRANSFER BETWEEN CORPORA. 0.70 is our calibration, not a
constant. Recalibrate every time; it takes ten minutes. And keep pairs as a TRIAGE
LIST, not a verdict list — clusters shift with the linkage settings, so treat them as
folders, not findings.
"""

import re
import sys
from pathlib import Path

import numpy as np

from lib import ROOT, load_config, read_csv, write_csv

cfg = load_config()
emb = cfg.get("embeddings", {})
MODEL = emb.get("model", "BAAI/bge-small-en-v1.5")
CHUNK_WORDS = emb.get("chunk_words", 250)
OVERLAP = emb.get("overlap_words", 40)
THRESHOLD = emb.get("similarity_threshold", 0.70)
THIN_WORDS = emb.get("thin_page_words", 200)
N_CLUSTERS_DIVISOR = emb.get("cluster_divisor", 6)

corpus = Path(cfg["corpus_dir"]).expanduser()
if not corpus.is_absolute():
    corpus = (ROOT / corpus).resolve()

# Boilerplate patterns — the single highest-impact config in this script.
BOILERPLATE = [re.compile(p, re.I | re.S) for p in emb.get("boilerplate_patterns", [])]


def main_content(raw):
    text = re.sub(r"^---.*?\n---", "", raw, flags=re.S)      # frontmatter
    text = re.sub(r"```.*?```", " ", text, flags=re.S)        # code blocks
    for pat in BOILERPLATE:
        text = pat.sub(" ", text)
    text = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", text)    # links/images → label
    text = re.sub(r"^[#>*_|-]+\s*", " ", text, flags=re.M)
    return re.sub(r"\s+", " ", text).strip()


def chunks(words):
    step = CHUNK_WORDS - OVERLAP
    if step <= 0:
        sys.exit("overlap_words must be smaller than chunk_words")
    out = []
    for i in range(0, max(len(words) - OVERLAP, 1), step):
        piece = words[i : i + CHUNK_WORDS]
        if len(piece) < 30 and out:
            break
        out.append(" ".join(piece))
    return out or [" ".join(words)]


inventory = read_csv("inventory.csv")
pages, thin = [], []
for row in inventory:
    path = corpus / row["path"]
    if not path.exists():
        continue
    text = main_content(path.read_text(encoding="utf-8", errors="replace"))
    words = text.split()
    if len(words) < THIN_WORDS:
        thin.append({"url": row["url"], "title": row["title"], "real_words": len(words)})
        continue
    pages.append({"url": row["url"], "title": row["title"], "chunks": chunks(words)})

write_csv("thin_pages.csv", thin)
if not pages:
    sys.exit("no pages above the thin-page floor — check corpus_dir and boilerplate_patterns")

print(f"{len(pages)} pages, {sum(len(p['chunks']) for p in pages)} passages", file=sys.stderr)
print(f"loading {MODEL} (first run downloads ~130MB)", file=sys.stderr)

from sentence_transformers import SentenceTransformer  # noqa: E402

model = SentenceTransformer(MODEL)

flat = [c for p in pages for c in p["chunks"]]
vectors = model.encode(flat, normalize_embeddings=True, batch_size=64, show_progress_bar=True)

# Slice chunk vectors back per page; mean-pool for the page vector, renormalize.
page_vecs, chunk_vecs, cursor = [], [], 0
for p in pages:
    n = len(p["chunks"])
    cv = vectors[cursor : cursor + n]
    cursor += n
    chunk_vecs.append(cv)
    mean = cv.mean(axis=0)
    page_vecs.append(mean / (np.linalg.norm(mean) or 1.0))
page_vecs = np.vstack(page_vecs)

# Whole-page cosine for every pair.
page_sim = page_vecs @ page_vecs.T

pairs = []
for i in range(len(pages)):
    for j in range(i + 1, len(pages)):
        whole = float(page_sim[i, j])
        # max chunk-to-chunk — the one that catches a duplicated middle section
        best = float((chunk_vecs[i] @ chunk_vecs[j].T).max())
        if whole >= THRESHOLD or best >= THRESHOLD:
            pairs.append(
                {
                    "url_a": pages[i]["url"],
                    "url_b": pages[j]["url"],
                    "title_a": pages[i]["title"],
                    "title_b": pages[j]["title"],
                    "page_cosine": round(whole, 4),
                    "max_chunk_cosine": round(best, 4),
                    "signal": "twin pages" if whole >= THRESHOLD else "overlapping section",
                }
            )

pairs.sort(key=lambda r: -max(r["page_cosine"], r["max_chunk_cosine"]))
write_csv("similarity_pairs.csv", pairs)

# Agglomerative clustering — useful for ORGANIZING the review, not for findings.
from sklearn.cluster import AgglomerativeClustering  # noqa: E402

n_clusters = max(2, len(pages) // N_CLUSTERS_DIVISOR)
labels = AgglomerativeClustering(
    n_clusters=n_clusters, metric="cosine", linkage="average"
).fit_predict(page_vecs)

write_csv(
    "page_clusters.csv",
    sorted(
        [{"url": p["url"], "title": p["title"], "cluster": int(l)} for p, l in zip(pages, labels)],
        key=lambda r: r["cluster"],
    ),
)

print(
    f"\n{len(pairs)} pairs at or above {THRESHOLD}, {len(thin)} thin pages, {n_clusters} clusters.\n"
    "\nThis is a TRIAGE LIST, not a verdict list. Recalibrate the threshold for your own\n"
    "corpus — it does not transfer. And treat clusters as folders, not findings: they\n"
    "shift with the linkage settings.\n"
    "\nSmall embedding models are fine for near-duplicate detection at page level. They\n"
    "are not fine for judging content quality, which is a very subjective, very human job.",
    file=sys.stderr,
)
