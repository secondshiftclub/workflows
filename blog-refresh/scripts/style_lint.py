#!/usr/bin/env python3
"""Style linter for blog drafts — the mechanical half of your voice guide.

Two severities, and the difference is the whole design:

  ERROR    a house fact. There is no context where it's right, so the draft
           doesn't move until the count is zero.
  WARNING  a default you're allowed to argue with. It says "you're off the
           house pattern, say why" — and a warning you can justify in writing
           survives, in the draft's verification report. One you can't is a bug.

Rules come from config.json. Thresholds can come from the voice profile you
derived from your own archive, so the linter enforces your numbers, not mine.

Usage:
  python3 style_lint.py draft.md
  python3 style_lint.py draft.md --config ../config.json --profile ../voice-profile.json

Exit 0 = no errors (warnings allowed). Exit 1 = errors present.
"""
import argparse, json, pathlib, re, sys

EMOJI = re.compile("[\U0001F300-\U0001FAFF\U00002700-\U000027BF\U0001F000-\U0001F0FF]")
UK = (r"\b(?:recognise|colour|optimise|behaviour|favourite|favour|organise|organisation|analyse|"
      r"centre|fibre|personalise|utilise|realise|licence|programme|signalling|authorised)\b")
US = (r"\b(?:recognize|color|optimize|behavior|favorite|favor|organize|organization|analyze|"
      r"center|fiber|personalize|utilize|realize|license)\b")

DEFAULTS = {
    "spelling": "us",
    "dash": "spaced_en",                  # spaced_en | em | any
    "banned_anchors": ["here", "click here", "this link", "read more", "link"],
    "banned_patterns": [],                # [{"pattern": "...", "message": "..."}]
    "banned_headings": ["conclusion"],
    "allow_emoji": False,
    "oxford_comma": True,
    "word_bands": {"default": [1400, 2600]},
    "links": {"internal_min": 10, "internal_max": 35, "external_min": 2},
    "keyword_in_h2_min": 3,
    "exclamation_max": 5,
}


def load(path, default=None):
    if path and pathlib.Path(path).exists():
        return json.loads(pathlib.Path(path).read_text())
    return default or {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("draft")
    ap.add_argument("--config", default="config.json")
    ap.add_argument("--profile", help="voice-profile.json — sets thresholds from your own archive")
    a = ap.parse_args()

    cfg = dict(DEFAULTS)
    cfg.update(load(a.config).get("lint", {}))
    prof = load(a.profile)
    if prof:                                            # your archive overrides my guesses
        m = prof.get("mechanics", {})
        if m.get("exclamations_p90") is not None:
            cfg["exclamation_max"] = max(1, int(m["exclamations_p90"]))
        if m.get("em_dash_posts_pct", 0) > 60:
            cfg["dash"] = "em"
        if m.get("uk_spelling_hits", 0) > m.get("us_spelling_hits", 0):
            cfg["spelling"] = "uk"

    text = pathlib.Path(a.draft).read_text(encoding="utf8")
    fm = re.match(r"---\n(.*?)\n---\n", text, re.S)
    meta = fm.group(1) if fm else ""
    body = text[fm.end():] if fm else text
    ctype = (re.search(r"^content_type:\s*(.+)$", meta, re.M) or [None, ""])[1].strip().strip('"')
    keyword = (re.search(r"^primary_keyword:\s*(.+)$", meta, re.M) or [None, ""])[1].strip().strip('"').lower()

    prose = re.sub(r"\]\([^)]*\)", "]", body)
    prose = re.sub(r"!\[[^\]]*\]", "", prose)
    prose = re.sub(r"```.*?```", " ", prose, flags=re.S)

    errors, warnings = [], []
    def err(cond, msg):  errors.append(msg) if cond else None
    def warn(cond, msg): warnings.append(msg) if cond else None

    # ---- house facts (errors) ----
    wrong = UK if cfg["spelling"] == "us" else US
    hits = sorted(set(w.lower() for w in re.findall(wrong, prose, re.I)))
    err(bool(hits), f"{'UK' if cfg['spelling']=='us' else 'US'} spelling found: {hits}")
    err(not cfg["allow_emoji"] and bool(EMOJI.search(body)), "Emoji in body.")
    if cfg["dash"] == "spaced_en":
        n = len(re.findall("—", prose))
        err(n > 0, f"{n} em dash(es) — house dash is a spaced en dash ( – ).")
    elif cfg["dash"] == "em":
        err(bool(re.search(r"\s–\s", prose)), "Spaced en dash — house dash is the em dash (—).")
    bad = sorted(set(m.lower() for m in re.findall(r"\[([^\]]+)\]\(", body) if m.lower() in cfg["banned_anchors"]))
    err(bool(bad), f"Generic link anchors: {bad} — use descriptive anchors.")
    for h in re.findall(r"^#{2,4}\s+(.+)$", body, re.M):
        err(h.strip().lower().rstrip(":") in cfg["banned_headings"], f'Banned heading: "{h.strip()}"')
    err(bool(re.search(r"^#{2,4}\s+\*\*", body, re.M)), "Bold-wrapped heading (## **…**) — legacy CMS artifact.")
    err(bool(re.findall(r"(?<![A-Za-z])\d+ percent\b", prose)), '"N percent" — use digits and %.')
    err(bool(re.search(r"!!|\(!+\)", prose)), 'Stacked or parenthetical exclamations ("!!", "(!)").')
    for rule in cfg["banned_patterns"]:
        err(bool(re.search(rule["pattern"], prose, re.I)), rule.get("message", f"Banned pattern: {rule['pattern']}"))
    if cfg["oxford_comma"]:
        no_ox = re.findall(r"\w+, \w+ and \w+", prose)
        warn(len(no_ox) > 0, f"{len(no_ox)} possible missing Oxford comma(s), e.g. \"{no_ox[0]}\"" if no_ox else "")

    # ---- defaults you can argue with (warnings) ----
    words = len(re.sub(r"[#>*_\[\]()!-]", " ", body).split())
    lo, hi = cfg["word_bands"].get(ctype, cfg["word_bands"]["default"])
    warn(not (lo <= words <= hi), f"~{words} words (band for {ctype or 'default'}: {lo}–{hi}).")

    linkbody = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", body)
    site = (load(a.config).get("site_url") or "").replace("https://", "").replace("http://", "").rstrip("/")
    internal = [u for u in re.findall(r"\]\(([^)]+)\)", linkbody) if u.startswith("/") or (site and site in u)]
    external = [u for u in re.findall(r"\]\((https?://[^)]+)\)", linkbody) if not (site and site in u)]
    L = cfg["links"]
    warn(len(internal) < L["internal_min"], f"Only {len(internal)} internal links (norm {L['internal_min']}–{L['internal_max']}).")
    warn(len(internal) > L["internal_max"], f"{len(internal)} internal links (over the {L['internal_max']} ceiling).")
    warn(len(external) < L["external_min"], f"Only {len(external)} external links — stats need authority sources.")

    h2s = re.findall(r"^##\s+(.+)$", body, re.M)
    if keyword and len(h2s) >= 5:
        n = sum(1 for h in h2s if keyword in h.lower())
        warn(n < cfg["keyword_in_h2_min"], f"Primary keyword in only {n} H2(s) (norm {cfg['keyword_in_h2_min']}+).")

    excl = len(re.findall(r"!(?!\[)", prose))
    warn(excl > cfg["exclamation_max"], f"{excl} exclamation marks (ceiling {cfg['exclamation_max']}).")

    intro = "\n".join(body.split("\n## ")[0].splitlines()[:20])
    warn(not re.search(r"\byou(r)?\b", intro, re.I), '"you/your" missing from the intro.')

    print(f"style_lint: {a.draft}")
    print(f"  ~{words} words | {len(h2s)} H2s | {len(internal)} internal / {len(external)} external links | {excl} exclamations")
    for e in errors:   print(f"  ERROR   {e}")
    for w in warnings:
        if w: print(f"  WARNING {w}")
    if not errors and not [w for w in warnings if w]:
        print("  CLEAN")
    elif not errors:
        print(f"  {len([w for w in warnings if w])} warning(s) — each one needs a written reason in the verification report.")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
