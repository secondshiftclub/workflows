#!/usr/bin/env node
// to-sqlite.mjs — load a JSONL corpus into SQLite.
//
// Once you're past a few hundred thousand rows, stop re-parsing files. Extraction
// passes become queries, monthly refreshes become an insert, and the whole thing still
// fits on a laptop.
//
// Zero dependencies: this emits SQL on stdout, you pipe it into the sqlite3 CLI that
// already ships with macOS and most Linux distros.
//
// Usage:
//   node to-sqlite.mjs posts.jsonl | sqlite3 corpus.db
//   node to-sqlite.mjs comments.jsonl --table comments | sqlite3 corpus.db
//
// Then the monthly refresh is just the same command again — inserts are idempotent on
// id, so re-running over an overlapping window is safe.
//
// Useful queries once it's loaded:
//
//   -- objection frequency over time, the thing that separates a live problem
//   -- from a solved one
//   SELECT strftime('%Y-%m', created_utc, 'unixepoch') AS month, COUNT(*)
//   FROM posts WHERE body LIKE '%another thing to manage%' GROUP BY month ORDER BY month;
//
//   -- full-text search across the corpus
//   SELECT permalink, substr(body, 1, 200) FROM posts_fts
//   WHERE posts_fts MATCH 'whiteboard AND scheduling' LIMIT 50;
//
//   -- the highest-signal threads: people had something to ADD, not just agreed
//   SELECT num_comments, score, title, permalink FROM posts
//   ORDER BY num_comments DESC LIMIT 50;

import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file || file.startsWith('--')) {
  console.error('usage: node to-sqlite.mjs <corpus.jsonl> [--table posts] | sqlite3 corpus.db');
  process.exit(1);
}
const argv = process.argv.slice(3);
const ti = argv.indexOf('--table');
const table = ti !== -1 && argv[ti + 1] ? argv[ti + 1] : 'posts';
if (!/^[a-z_][a-z0-9_]*$/i.test(table)) {
  console.error(`--table must be a plain identifier, got "${table}"`);
  process.exit(1);
}

const q = v => (v === null || v === undefined ? 'NULL' : `'${String(v).replaceAll("'", "''")}'`);
const n = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

console.log('PRAGMA journal_mode=WAL;');
console.log('BEGIN;');
console.log(`CREATE TABLE IF NOT EXISTS ${table} (
  id            TEXT PRIMARY KEY,
  created_utc   INTEGER,
  author        TEXT,
  title         TEXT,
  body          TEXT,
  score         INTEGER,
  num_comments  INTEGER,
  flair         TEXT,
  permalink     TEXT
);`);
console.log(`CREATE INDEX IF NOT EXISTS ${table}_created ON ${table}(created_utc);`);
console.log(`CREATE INDEX IF NOT EXISTS ${table}_comments ON ${table}(num_comments DESC);`);
console.log(`CREATE VIRTUAL TABLE IF NOT EXISTS ${table}_fts USING fts5(
  title, body, permalink UNINDEXED, content='${table}', content_rowid='rowid'
);`);

let count = 0;
for (const line of readFileSync(file, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let it;
  try { it = JSON.parse(line); } catch { continue; }
  // INSERT OR REPLACE so an overlapping monthly window updates scores rather than
  // failing the whole transaction.
  console.log(
    `INSERT OR REPLACE INTO ${table} VALUES (${[
      q(it.id), n(it.created_utc), q(it.author), q(it.title ?? ''),
      q(it.selftext ?? it.body ?? ''), n(it.score), n(it.num_comments),
      q(it.link_flair_text), q(it.permalink),
    ].join(',')});`
  );
  count++;
}

console.log(`INSERT INTO ${table}_fts(${table}_fts) VALUES('rebuild');`);
console.log('COMMIT;');
process.stderr.write(`${count} rows → ${table}\n`);
