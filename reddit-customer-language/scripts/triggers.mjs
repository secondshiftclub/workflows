#!/usr/bin/env node
// triggers.mjs — extract unmet-need sentences from a corpus pulled by pull.mjs.
//
// The trick that makes the language bank work: don't do topic modelling. Search for
// GRAMMATICAL MARKERS OF UNMET NEED. Eight phrases do almost all the work, because
// they're how people announce a problem in plain speech. It is crude and it beats
// clustering.
//
// Usage:
//   node pull.mjs --sub HVAC --months 6 > posts.jsonl
//   node triggers.mjs posts.jsonl > language-bank.csv
//   node triggers.mjs posts.jsonl --pain whiteboard,double-booked,callback > filtered.csv
//
// Output: CSV — trigger,quote,score,num_comments,date,permalink
// sorted by comment count, because comment count means people HAD SOMETHING TO ADD.
// Score just means they agreed, which is viral advice and relatable jokes.
//
// What you do with it: read the quotes, sort them into persona buckets by hand, and
// keep the exact phrasing. The verbatim wording IS the deliverable. Rewrite it in your
// own voice and you've thrown away the only thing you came for.

import { readFileSync } from 'node:fs';

const TRIGGERS = [
  { name: 'wish',              re: /\bi wish\b/i,                 surfaces: 'feature demand, stated as a want' },
  { name: 'if_only',           re: /\bif only\b/i,                surfaces: 'feature demand, stated as a want' },
  { name: 'drowning',          re: /\b(?:i'?m |im |we'?re )?drowning in\b/i, surfaces: 'volume and overwhelm pain' },
  { name: 'tired_of',          re: /\b(?:so |really |just )?tired of\b/i,   surfaces: 'emotional intensity — ad copy gold' },
  { name: 'hate_it',           re: /\bi (?:really |absolutely |just )?hate\b/i, surfaces: 'emotional intensity — ad copy gold' },
  { name: 'the_problem_is',    re: /\bthe problem is\b/i,         surfaces: 'their own framing of the core issue' },
  { name: 'biggest_problem',   re: /\b(?:my|our) biggest (?:problem|issue|headache)\b/i, surfaces: 'priority ranking, self-reported' },
  { name: 'nobody_understands',re: /\bnobody (?:understands|gets)\b/i, surfaces: 'isolation — the empathy angle' },
];

const file = process.argv[2];
if (!file || file.startsWith('--')) {
  console.error('usage: node triggers.mjs <corpus.jsonl> [--pain word,word] [--min-len 40]');
  console.error('\ntriggers:');
  for (const t of TRIGGERS) console.error(`  ${t.name.padEnd(20)} ${t.surfaces}`);
  process.exit(1);
}
const argv = process.argv.slice(3);
const flag = (f, d = null) => {
  const i = argv.indexOf(f);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : d;
};
const painWords = (flag('--pain') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const minLen = Number(flag('--min-len', 40));

// Split on sentence enders, but keep it dumb — Reddit punctuation is not a spec.
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
  if (painWords.length && !painWords.some(w => body.toLowerCase().includes(w))) continue;

  for (const sentence of sentences(body)) {
    if (sentence.length < minLen || sentence.length > 400) continue;
    for (const t of TRIGGERS) {
      if (!t.re.test(sentence)) continue;
      rows.push({
        trigger: t.name,
        quote: sentence,
        score: item.score ?? 0,
        num_comments: item.num_comments ?? 0,
        date: new Date((item.created_utc || 0) * 1000).toISOString().slice(0, 10),
        permalink: item.permalink || '',
      });
      break; // one trigger per sentence, first match wins
    }
  }
}

// Sort by comment count, not score. This is the single most useful habit in the guide.
rows.sort((a, b) => b.num_comments - a.num_comments || b.score - a.score);

const esc = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
console.log('trigger,quote,score,num_comments,date,permalink');
for (const r of rows) {
  console.log([r.trigger, r.quote, r.score, r.num_comments, r.date, r.permalink].map(esc).join(','));
}

const byTrigger = rows.reduce((m, r) => ((m[r.trigger] = (m[r.trigger] || 0) + 1), m), {});
process.stderr.write(`scanned ${scanned} items → ${rows.length} trigger sentences\n`);
for (const [k, v] of Object.entries(byTrigger).sort((a, b) => b[1] - a[1])) {
  process.stderr.write(`  ${k.padEnd(20)} ${v}\n`);
}
process.stderr.write(
  '\nNext: segment these by persona before you use them. The same complaint means\n' +
  'different things from different people, and one undifferentiated bucket averages\n' +
  'into mush. See ../templates/language-bank.md\n'
);
