#!/usr/bin/env node
// question_digest.mjs — turn a subreddit pull into the fan-out's fourth source.
//
// Source 4 of the gap audit is "the questions buyers actually ask". Keyword tools
// give you `email deliverability best practices`. A forum gives you "why do my emails
// keep landing in promotions", which is the same question in human words — and those
// phrasings are what AI engines are increasingly answering.
//
// This reads the JSONL that ../../reddit-customer-language/scripts/pull.mjs writes,
// so pull once and use it for both workflows.
//
// Usage:
//   node ../../reddit-customer-language/scripts/pull.mjs --sub YourSubreddit --months 6 > posts.jsonl
//   node question_digest.mjs posts.jsonl --terms "your topic,synonym" --top 40
//   node question_digest.mjs posts.jsonl --terms "sms api" --csv > questions.csv
//
// Output: ranked questions with how many threads asked them, and the facet each one
// maps to. Paste the table into the gap audit's fan-out set.

import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const val = (f, d) => { const i = args.indexOf(f); return i > -1 ? args[i + 1] : d; };
const csv = args.includes('--csv');
const top = parseInt(val('--top', '40'), 10);
const terms = val('--terms', '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

if (!file) {
  console.error('usage: node question_digest.mjs posts.jsonl --terms "topic,synonym" [--top 40] [--csv]');
  process.exit(1);
}

// Facets mirror the systematic expansion in prompts/01-gap-audit.md, so the digest
// drops straight into the coverage matrix.
const FACETS = [
  ['definitional', /\b(what (is|are|does)|what'?s|meaning|stand for|define)\b/],
  ['task',         /\b(how (do|to|can)|steps?|set ?up|enable|turn (on|off)|install|switch)\b/],
  ['troubleshoot', /\b(why (is|are|does|do|can'?t|won'?t)|not (work|working|sending|connect|connecting|showing)|stopped working|issues? with|broken|fail|error|stuck|missing|disappear)\b/],
  ['judgment',     /\b(better|best|worth it|should i|vs\.?|versus|compare|difference between|replace)\b/],
  ['compatibility',/\b(work with|compatible|supports?|include|does .* (have|include|support)|between .* and|with (iphone|android|samsung|ios)|on (iphone|android|ios|mac|windows))\b/],
  ['cost',         /\b(cost|price|pricing|free|charge|expensive|cheap|billing)\b/],
  ['limits',       /\b(limit|max|maximum|size|how (many|much|long|big)|cap)\b/],
  ['trust',        /\b(safe|secure|encrypt|private|privacy|scam|spam|legit|trust)\b/],
];

const facetOf = q => (FACETS.find(([, re]) => re.test(q)) || ['other'])[0];

// Normalise for dedupe: lowercase, strip filler, collapse numbers and quoted names.
const norm = q => q.toLowerCase()
  .replace(/https?:\/\/\S+/g, '')
  .replace(/[“”"'’]/g, '')
  .replace(/\b\d+\b/g, '#')
  .replace(/[^a-z0-9#\s?]/g, ' ')
  .replace(/\b(so|just|basically|really|actually|please|anyone|guys|hey|hi)\b/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const sentences = t => t.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/);

// A question is only useful if it stands on its own. "Is that normal?" is anaphoric —
// it means nothing outside its thread — and a digest full of those is noise. Keep a
// question if it names the topic, or carries enough content words to be self-contained.
const STOP = new Set(('a an the is are was were be been being do does did doing have has had having '
  + 'i you he she it we they me him her us them my your his its our their this that these those '
  + 'what which who whom whose when where why how any anyone anybody anything someone something '
  + 'else other others there here to of in on at for with from about as if or and but not no yes '
  + 'can could will would should shall may might must know get got make made go going normal sure '
  + 'possible fix solution solutions experience story idea ideas help please thanks').split(' '));

function selfContained(q, terms) {
  const low = q.toLowerCase();
  if (terms.length && terms.some(t => low.includes(t))) return true;
  const content = low.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w));
  return new Set(content).size >= 3;
}

const records = readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => {
  try { return JSON.parse(l); } catch { return null; }
}).filter(Boolean);

const seenThread = new Map();   // normalised question -> {raw, threads:Set}
let scanned = 0;

for (const r of records) {
  const title = r.title || '';
  const body = r.selftext || r.body || '';
  const blob = `${title} ${body}`.toLowerCase();
  if (terms.length && !terms.some(t => blob.includes(t))) continue;
  scanned++;
  const id = r.id || r.name || title;

  // Titles are self-contained by construction; body questions usually are not, so
  // they have to earn their place.
  const candidates = [];
  if (title.trim().endsWith('?')) candidates.push([title.trim(), 2]);
  for (const s of sentences(body)) if (s.trim().endsWith('?')) candidates.push([s.trim(), 1]);

  for (const [q, weight] of candidates) {
    const words = q.split(/\s+/).length;
    if (words < 4 || words > 25) continue;            // fragments and rambles
    if (!selfContained(q, terms)) continue;
    const key = norm(q);
    if (!key || key.length < 12) continue;
    if (!seenThread.has(key)) seenThread.set(key, { raw: q, threads: new Set(), weight: 0 });
    const rec = seenThread.get(key);
    rec.threads.add(id);
    rec.weight = Math.max(rec.weight, weight);
  }
}

const rows = [...seenThread.values()]
  .map(v => ({ q: v.raw, threads: v.threads.size, weight: v.weight, facet: facetOf(v.raw.toLowerCase()) }))
  .sort((a, b) => (b.threads * b.weight) - (a.threads * a.weight) || a.q.length - b.q.length)
  .slice(0, top);

if (csv) {
  console.log('threads,facet,question');
  for (const r of rows) console.log(`${r.threads},${r.facet},"${r.q.replace(/"/g, '""')}"`);
} else {
  console.error(`\n${records.length} records, ${scanned} matched the topic terms, ${seenThread.size} distinct questions\n`);
  const byFacet = {};
  for (const r of rows) (byFacet[r.facet] ||= []).push(r);
  for (const [facet, qs] of Object.entries(byFacet).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n## ${facet}  (${qs.length})`);
    for (const r of qs) console.log(`  ${String(r.threads).padStart(3)}×  ${r.q}`);
  }
  console.log('\nFacets with the most distinct questions are the ones your page is most likely under-answering.\n');
}
