#!/usr/bin/env node
// pull.mjs — pull a subreddit's history from the Arctic Shift archive.
//
// Why an archive and not Reddit: Reddit's own search caps out around 1,000 results
// with no way past it, so anything older than the recent slice is invisible. Most
// third-party scrapers hit the same wall. Arctic Shift has the full history and stays
// current to about yesterday.
//
// Usage:
//   node pull.mjs --sub HVAC --months 6 > posts.jsonl
//   node pull.mjs --sub HVAC --months 6 --query "scheduling dispatch" > posts.jsonl
//   node pull.mjs --sub HVAC --months 6 --kind comments > comments.jsonl
//   node pull.mjs --sub HVAC --after 2026-01-01 --before 2026-07-01 --csv > posts.csv
//
// Output: JSONL on stdout (one record per line), or CSV with --csv. Progress on stderr.
//
// Scope it sanely: a busy subreddit runs a few thousand posts a month. Comments are
// roughly twenty times that volume — pull posts first, and go to comments only once
// you know which threads deserve a closer look.

const API = 'https://arctic-shift.photon-reddit.com/api';
const UA = 'second-shift-workflows/1.0 (https://github.com/secondshiftclub/workflows)';

// `permalink` is NOT a valid field — requesting it returns a 400 that kills the whole
// call. We rebuild links from the id instead.
const FIELDS = {
  posts: ['id', 'created_utc', 'author', 'title', 'selftext', 'score', 'num_comments', 'link_flair_text'],
  comments: ['id', 'created_utc', 'author', 'body', 'score', 'link_id', 'parent_id'],
};

function args() {
  const a = process.argv.slice(2);
  const get = (flag, fallback = null) => {
    const i = a.indexOf(flag);
    return i !== -1 && a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : fallback;
  };
  const sub = get('--sub');
  if (!sub) {
    console.error('usage: node pull.mjs --sub <name> [--months 6] [--after YYYY-MM-DD] [--before YYYY-MM-DD]');
    console.error('                     [--kind posts|comments] [--query "terms"] [--csv]');
    process.exit(1);
  }
  const kind = get('--kind', 'posts');
  if (!['posts', 'comments'].includes(kind)) {
    console.error(`--kind must be posts or comments, got "${kind}"`);
    process.exit(1);
  }
  const months = Number(get('--months', 6));
  const now = Math.floor(Date.now() / 1000);
  const before = get('--before') ? Math.floor(Date.parse(`${get('--before')}T00:00:00Z`) / 1000) : now;
  const after = get('--after')
    ? Math.floor(Date.parse(`${get('--after')}T00:00:00Z`) / 1000)
    : before - Math.round(months * 30.44 * 86400);

  if (!Number.isFinite(after) || !Number.isFinite(before) || after >= before) {
    console.error('bad date range — check --after / --before (expect YYYY-MM-DD)');
    process.exit(1);
  }
  return {
    sub: sub.replace(/^\/?r\//, ''),
    kind,
    after,
    before,
    // query= does full-text filtering and ANDs the terms — the fastest way to cut a
    // huge subreddit down to relevant posts.
    query: get('--query'),
    csv: a.includes('--csv'),
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage({ sub, kind, after, before, query }) {
  const params = new URLSearchParams({
    subreddit: sub,
    after: String(after),
    before: String(before),
    sort: 'asc',
    limit: '100',
    fields: FIELDS[kind].join(','),
  });
  if (query) params.set('query', query);

  const url = `${API}/${kind}/search?${params}`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
    } catch (e) {
      if (attempt === 5) throw new Error(`network error after 5 attempts: ${e.message}`);
      await sleep(1500 * attempt);
      continue;
    }
    // Arctic Shift rate-limits with a 422 "Timeout. Maybe slow down a bit", not a 429.
    // Back off and retry those the same way; only a 400 is genuinely fatal.
    if (res.status === 429 || res.status === 422 || res.status >= 500) {
      if (attempt === 5) throw new Error(`HTTP ${res.status} after 5 attempts — slow down further`);
      process.stderr.write(`  HTTP ${res.status}, backing off (${attempt}/5)\n`);
      await sleep(3000 * attempt);
      continue;
    }
    if (!res.ok) {
      // 400 here almost always means a bad `fields` value. Say so, don't retry.
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const json = await res.json();
    return json.data || [];
  }
  return [];
}

function toCsv(rows, kind) {
  const cols = [...FIELDS[kind], 'permalink'];
  const esc = v => `"${String(v ?? '').replaceAll('"', '""').replace(/\r?\n/g, ' ')}"`;
  const out = [cols.join(',')];
  for (const r of rows) out.push(cols.map(c => esc(r[c])).join(','));
  return out.join('\n');
}

const opts = args();
const seen = new Set();
const rows = [];
let cursor = opts.after;

process.stderr.write(
  `pulling r/${opts.sub} ${opts.kind} ` +
  `${new Date(opts.after * 1000).toISOString().slice(0, 10)} → ` +
  `${new Date(opts.before * 1000).toISOString().slice(0, 10)}` +
  `${opts.query ? ` matching "${opts.query}"` : ''}\n`
);

while (cursor < opts.before) {
  const batch = await fetchPage({ ...opts, after: cursor });
  if (batch.length === 0) break;

  let fresh = 0;
  let maxTs = cursor;
  for (const item of batch) {
    maxTs = Math.max(maxTs, item.created_utc || 0);
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    fresh++;
    item.permalink = `https://reddit.com/r/${opts.sub}/comments/${
      opts.kind === 'comments' ? String(item.link_id || '').replace(/^t3_/, '') : item.id
    }/`;
    if (opts.csv) rows.push(item);
    else process.stdout.write(JSON.stringify(item) + '\n');
  }

  // Paginate by moving the cursor to the last item's timestamp. Bump forward a second
  // when a whole batch shares one timestamp, or the loop stalls forever on it.
  cursor = maxTs > cursor ? maxTs : cursor + 1;
  process.stderr.write(`  ${seen.size} unique (+${fresh}) → ${new Date(cursor * 1000).toISOString().slice(0, 10)}\n`);

  if (fresh === 0 && batch.length < 100) break;
  await sleep(400); // be polite
}

if (opts.csv) process.stdout.write(toCsv(rows, opts.kind) + '\n');
process.stderr.write(`done — ${seen.size} unique ${opts.kind}\n`);
