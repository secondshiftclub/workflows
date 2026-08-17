#!/usr/bin/env node
// competitors.mjs — pull every mention of named competitors, and the switching stories.
//
// This is not share-of-voice. What you want is SPECIFIC FAILURE MODES. "We left [X]
// because…" is the highest-value sentence in the entire corpus, and there are usually
// hundreds of them. It gives you the switching trigger, the breaking point, and the
// exact words a switcher uses to justify the change — which is precisely the copy that
// converts a switcher.
//
// Usage:
//   node competitors.mjs posts.jsonl --brands "ServiceTitan,Housecall Pro,Jobber" > competitor-sentiment.csv
//   node competitors.mjs posts.jsonl --brands-file brands.txt --switching-only
//
// Output: CSV — brand,kind,quote,score,num_comments,date,permalink
//   kind = switching | complaint | mention

import { readFileSync } from 'node:fs';

// The sentences that carry a switching trigger. Ordered — first match wins.
const SWITCHING = [
  /\bwe (?:left|dropped|ditched|switched (?:away )?from|moved (?:off|away from)|cancell?ed)\b/i,
  /\bi (?:left|dropped|ditched|switched (?:away )?from|moved (?:off|away from)|cancell?ed)\b/i,
  /\b(?:switched|moved|migrated) to\b/i,
  /\bwent back to\b/i,
];
const COMPLAINT = [
  /\b(?:doesn'?t|does not|won'?t|can'?t|cannot) (?:work|do|handle|support)\b/i,
  /\b(?:too expensive|overpriced|price hike|raised (?:their|the) price)\b/i,
  /\b(?:clunky|buggy|slow|useless|garbage|terrible|awful|nightmare)\b/i,
  /\bsupport (?:is|was) (?:terrible|awful|useless|nonexistent|non-existent)\b/i,
];

const file = process.argv[2];
if (!file || file.startsWith('--')) {
  console.error('usage: node competitors.mjs <corpus.jsonl> --brands "A,B,C" [--switching-only] [--min-len 40]');
  console.error('       node competitors.mjs <corpus.jsonl> --brands-file brands.txt');
  process.exit(1);
}
const argv = process.argv.slice(3);
const flag = (f, d = null) => {
  const i = argv.indexOf(f);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};

let brands = (flag('--brands') || '').split(',').map(s => s.trim()).filter(Boolean);
const brandsFile = flag('--brands-file');
if (brandsFile) {
  brands = brands.concat(
    readFileSync(brandsFile, 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'))
  );
}
if (!brands.length) {
  console.error('no brands given — pass --brands "A,B,C" or --brands-file brands.txt');
  process.exit(1);
}
const switchingOnly = argv.includes('--switching-only');
const minLen = Number(flag('--min-len', 40));

const brandRes = brands.map(b => ({
  name: b,
  re: new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')}\\b`, 'i'),
}));

const sentences = text =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(Boolean);

const rows = [];
let scanned = 0;

for (const line of readFileSync(file, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let item;
  try { item = JSON.parse(line); } catch { continue; }
  scanned++;

  const body = [item.title, item.selftext, item.body].filter(Boolean).join('. ');
  const hits = brandRes.filter(b => b.re.test(body));
  if (!hits.length) continue;

  for (const sentence of sentences(body)) {
    if (sentence.length < minLen || sentence.length > 400) continue;
    for (const b of hits) {
      if (!b.re.test(sentence)) continue;
      const kind = SWITCHING.some(re => re.test(sentence)) ? 'switching'
        : COMPLAINT.some(re => re.test(sentence)) ? 'complaint'
        : 'mention';
      if (switchingOnly && kind !== 'switching') continue;
      rows.push({
        brand: b.name,
        kind,
        quote: sentence,
        score: item.score ?? 0,
        num_comments: item.num_comments ?? 0,
        date: new Date((item.created_utc || 0) * 1000).toISOString().slice(0, 10),
        permalink: item.permalink || '',
      });
    }
  }
}

const rank = { switching: 0, complaint: 1, mention: 2 };
rows.sort((a, b) => rank[a.kind] - rank[b.kind] || b.num_comments - a.num_comments);

const esc = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
console.log('brand,kind,quote,score,num_comments,date,permalink');
for (const r of rows) {
  console.log([r.brand, r.kind, r.quote, r.score, r.num_comments, r.date, r.permalink].map(esc).join(','));
}

const tally = {};
for (const r of rows) {
  tally[r.brand] ??= { switching: 0, complaint: 0, mention: 0 };
  tally[r.brand][r.kind]++;
}
process.stderr.write(`scanned ${scanned} items → ${rows.length} brand sentences\n`);
for (const [brand, t] of Object.entries(tally).sort((a, b) => b[1].switching - a[1].switching)) {
  process.stderr.write(`  ${brand.padEnd(24)} switching:${t.switching}  complaint:${t.complaint}  mention:${t.mention}\n`);
}
process.stderr.write(
  '\nMap objections to competitors and the positioning writes itself. If a rival owns\n' +
  'the market but its mentions cluster around price shock at scale, your comparison\n' +
  'page has one job.\n'
);
