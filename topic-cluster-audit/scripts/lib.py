"""Shared config, paths, and Search Console auth for the topic-cluster pipeline.

Every script reads config.json (falling back to config.example.json) and writes its
output as a CSV into out/. Every API response is cached under cache/, so a re-run is
free and refreshes every number in every slide.
"""

import csv
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
CACHE = ROOT / "cache"


def load_config():
    real, example = ROOT / "config.json", ROOT / "config.example.json"
    path = real if real.exists() else example
    if path is example:
        print(
            "note: using config.example.json — copy it to config.json and point it at "
            "your own site before you trust the output.",
            file=sys.stderr,
        )
    try:
        cfg = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as e:
        sys.exit(f"could not read {path}: {e}")

    for key in ("site_url", "topic", "topic_terms", "corpus_dir"):
        if not cfg.get(key):
            sys.exit(f'config is missing "{key}" — see config.example.json')
    OUT.mkdir(exist_ok=True)
    CACHE.mkdir(exist_ok=True)
    return cfg


def load_env():
    """Read .env from the workflow root without clobbering real env vars."""
    path = ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def require_env(key, why):
    load_env()
    val = os.environ.get(key)
    if not val:
        sys.exit(f"Missing env var: {key} — needed for {why}. See .env.example")
    return val


def write_csv(name, rows, fieldnames=None):
    """Write rows (list of dicts) to out/<name>. Returns the path."""
    path = OUT / name
    if not rows:
        print(f"warning: {name} is empty — writing header only", file=sys.stderr)
    fieldnames = fieldnames or (list(rows[0].keys()) if rows else [])
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {path.relative_to(ROOT)} ({len(rows)} rows)", file=sys.stderr)
    return path


def read_csv(name):
    path = OUT / name
    if not path.exists():
        sys.exit(f"{path.relative_to(ROOT)} not found — run the earlier steps first")
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def cached(key, fn):
    """Cache a JSON-serializable API response under cache/<key>.json."""
    path = CACHE / f"{key}.json"
    if path.exists():
        print(f"  cache hit: {key}", file=sys.stderr)
        return json.loads(path.read_text())
    data = fn()
    path.write_text(json.dumps(data))
    return data


def gsc_client():
    """Authenticated Search Console client.

    Enabling the Search Console API and creating credentials is genuinely fiddly. The
    short version: create a project, enable "Google Search Console API", create a
    SERVICE ACCOUNT, download its JSON key, then add the service account's email as a
    user on your property in Search Console. That last step is the one everyone misses.
    """
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    key_path = require_env("GOOGLE_SERVICE_ACCOUNT_JSON", "the Search Console pulls")
    if not Path(key_path).exists():
        sys.exit(f"GOOGLE_SERVICE_ACCOUNT_JSON points at {key_path}, which does not exist")
    creds = service_account.Credentials.from_service_account_file(
        key_path, scopes=["https://www.googleapis.com/auth/webmasters.readonly"]
    )
    return build("searchconsole", "v1", credentials=creds, cache_discovery=False)


def date_window(days):
    from datetime import date, timedelta

    end = date.today() - timedelta(days=3)  # GSC lags ~3 days
    return (end - timedelta(days=days)).isoformat(), end.isoformat()
