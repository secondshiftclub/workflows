#!/usr/bin/env node
// verify-targets.mjs — page-level verification. Build this FIRST.
//
// Your citation data is a cache, and it is wrong in four expensive ways: the page is an
// advice article and not a vendor list; you're already on it; the list changed last
// week; or the "adjacent site" you're about to pitch is a direct competitor in disguise.
// That last one is not rare — in one big mine, roughly a THIRD of the "adjacent vendor"
// gap domains turned out to be competitors, two dozen of them caught only by fetching
// the homepage.
//
// So: fetch each candidate and answer four questions.
//   1. Is this actually a vendor list, or an advice article?  -> NOT_A_LIST kills it
//   2. Are we genuinely absent?                               -> BRAND_PRESENT = already won
//   3. Which competitors are on the page RIGHT NOW?           -> the leverage number
//   4. What's the hook? (byline, last-updated, stale vendors, submission route)
//
// Usage:
//   node verify-targets.mjs urls.txt                # newline-separated URLs
//   node verify-targets.mjs --json candidates.json  # [{url, retrievals?, ...}] fields kept
//   echo "https://example.com/best-x" | node verify-targets.mjs -
//
// Output: JSON array on stdout, sorted by live_score.
// verdicts: LIST_CONFIRMED | NOT_A_LIST | BRAND_PRESENT | FETCH_FAILED | BLOCKED
// Only LIST_CONFIRMED should ever reach your CRM.
//
// live_score = (input retrievals || 1) x competitors on the LIVE page — not the cache's
// count.
//
// Network: needs direct egress. If EVERYTHING comes back BLOCKED, that's your egress
// policy, not dead targets. The script says so rather than reporting an empty world.

import { readFileSync } from 'node:fs';
import { httpGet } from './lib/http.mjs';
import { loadConfig, competitorNames } from './lib/config.mjs';

const cfg = loadConfig();
const COMPETITORS = competitorNames(cfg);
const STALE_VENDORS = cfg.stale_vendors || [];
const VENDOR_HINTS = cfg.vendor_hints || [];
const BRAND_TERMS = (cfg.brand_terms || [cfg.company]).map(s => s.toLowerCase());
const UA = `Mozilla/5.0 (compatible; CitationRadar/1.0; +https://${cfg.domain})`;

function parseArgs() {
  const args = process.argv.slice(2);
  if (args[0] === '--json') return JSON.parse(readFileSync(args[1], 'utf8'));
  const src = args[0] === '-' || !args[0] ? '/dev/stdin' : args[0];
  return readFileSync(src, 'utf8')
    .split('\n').map(s => s.trim()).filter(Boolean)
    .map(url => ({ url }));
}

function textify(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

function findAll(text, names) {
  const found = [];
  for (const n of names) {
    const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) found.push(n);
  }
  return found;
}

function extract(html, text) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
  // A real person's name means a real pitch. No byline means a house-brand list site,
  // which is a different (and colder) motion.
  const byline =
    html.match(/rel=["']author["'][^>]*>([^<]{2,60})</i)?.[1]?.trim() ||
    html.match(/"author"\s*:\s*{[^}]*"name"\s*:\s*"([^"]{2,60})"/)?.[1] ||
    text.match(/\bBy ([A-Z][a-z]+ [A-Z][a-zA-Z'-]+)\b/)?.[1] || null;
  const lastUpdated =
    html.match(/"dateModified"\s*:\s*"([^"]+)"/)?.[1] ||
    text.match(/(?:last )?updated[:\s]+([A-Z][a-z]+ \d{1,2},? \d{4}|\d{4}-\d{2}-\d{2})/i)?.[1] || null;
  const mailto = /mailto:([^"'\s?]+)/i.exec(html)?.[1];
  const submission = mailto
    ? `email:${mailto}`
    : /href=["'][^"']*(submit|suggest|contribute|get-listed|contact)[^"']*["']/i.test(html)
      ? 'web-form'
      : null;
  return { title, byline, last_updated: lastUpdated, submission_route: submission };
}

async function verify(item) {
  const out = { ...item };
  const res = await httpGet(item.url, { 'user-agent': UA, accept: 'text/html' }, { timeoutMs: 20000 });
  if (res.status === 403 || res.status === 429) return { ...out, verdict: 'BLOCKED', http_status: res.status };
  if (res.status !== 200 || !res.text) {
    return { ...out, verdict: 'FETCH_FAILED', http_status: res.status, error: res.error };
  }
  const html = res.text;
  const text = textify(html);

  const haystack = (text + ' ' + html).toLowerCase();
  const brandPresent = BRAND_TERMS.some(t => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(haystack));

  const competitors = [...new Set(findAll(text, [...COMPETITORS.keys()]).map(n => COMPETITORS.get(n)))];
  const stale = findAll(text, STALE_VENDORS);
  const otherVendors = findAll(text, VENDOR_HINTS);
  const vendorCount = new Set([...competitors, ...otherVendors]).size;
  const headings = (html.match(/<h[23][^>]*>/gi) || []).length;

  // A real roundup names several vendors and is structured as a list. Big publications
  // write ABOUT your category constantly; pitching an editor to "add us to your list"
  // when there is no list is how you get blocked.
  const isList = vendorCount >= 3 || (vendorCount >= 2 && headings >= 5);

  const meta = extract(html, text);
  const hooks = [];
  // The strongest hook available: a vendor that shut down, still listed. It means the
  // article hasn't been touched in two years and the editor knows it. That's not a cold
  // pitch, it's a favor.
  if (stale.length) hooks.push(`stale vendor(s) still listed: ${stale.join(', ')}`);
  if (meta.last_updated) hooks.push(`last updated ${meta.last_updated}`);
  if (meta.last_updated && /20(1\d|2[0-4])/.test(meta.last_updated)) hooks.push('list looks outdated');
  if (meta.byline) hooks.push(`byline: ${meta.byline}`);
  if (meta.submission_route) hooks.push(`submission route: ${meta.submission_route}`);

  return {
    ...out,
    ...meta,
    verdict: brandPresent ? 'BRAND_PRESENT' : isList ? 'LIST_CONFIRMED' : 'NOT_A_LIST',
    brand_present: brandPresent,
    competitors_on_page: competitors,
    stale_vendors: stale,
    vendor_count: vendorCount,
    // Multiply, don't add. 600 retrievals x 1 competitor is a brand mention. 200 x 8 is
    // a CATEGORY LIST — the shape a model reaches for when someone asks about options.
    live_score: (Number(out.retrievals) || 1) * competitors.length,
    hook_hints: hooks,
  };
}

const items = parseArgs();
const results = [];
for (let i = 0; i < items.length; i += 5) {
  results.push(...await Promise.all(items.slice(i, i + 5).map(verify)));
  process.stderr.write(`verified ${results.length}/${items.length}\n`);
}
results.sort((a, b) => (b.live_score || 0) - (a.live_score || 0));

// An agent must always be able to tell "the world is empty" from "my tooling is broken".
if (results.length && results.every(r => r.verdict === 'BLOCKED' || r.verdict === 'FETCH_FAILED')) {
  process.stderr.write(
    'WARNING: every fetch failed — this is almost certainly blocked egress in the\n' +
    'environment, not dead targets. Do NOT log these as verified.\n'
  );
}

const tally = results.reduce((m, r) => ((m[r.verdict] = (m[r.verdict] || 0) + 1), m), {});
process.stderr.write(Object.entries(tally).map(([k, v]) => `${k}:${v}`).join('  ') + '\n');
console.log(JSON.stringify(results, null, 2));
