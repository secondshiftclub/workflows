#!/usr/bin/env node
// ahrefs-linkgap.mjs — discovery source #2: pages that LINK to >=2 competitors but not
// to you.
//
// Why this matters: your AI-visibility tool only sees pages engines ALREADY cite.
// Backlink overlap is the LEADING indicator — a page that ranks and links to four
// competitors today is a page the models will cite in three months. Getting added
// before it gets cited is free. The universe is roughly 10x bigger too.
//
// Usage:
//   AHREFS_API_KEY=... node ahrefs-linkgap.mjs [--limit 500] [--min-dr 20]
//
// Output: CSV on stdout — url_from,title,domain_rating,competitors_linked,n_competitors
// sorted by competitor count desc, then DR desc. Pipe the URLs into verify-targets.mjs.
//
// Cost: Ahrefs bills by ROW, not by query, with a 50-unit minimum per billable request.
// Default is 500 rows x each competitor + 1 own-domain query. Trim --limit before you
// trim competitors: dropping a competitor blinds the gap, dropping rows just shortens
// the tail.

import { httpGet } from './lib/http.mjs';
import { loadConfig, loadEnv, optionalEnv, bareDomain, isCompetitorOwned } from './lib/config.mjs';

loadEnv();
const cfg = loadConfig();
// Optional source: no key means skip this booster, not fail the run.
const KEY = optionalEnv('AHREFS_API_KEY', 'the Ahrefs link-gap source');

const args = process.argv.slice(2);
const num = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? Number(args[i + 1]) || fallback : fallback;
};
const limit = num('--limit', cfg.ahrefs?.limit ?? 500);
const minDr = num('--min-dr', cfg.ahrefs?.min_dr ?? 15);
const OWN = cfg.domain;

async function backlinks(target) {
  const url = new URL('https://api.ahrefs.com/v3/site-explorer/all-backlinks');
  url.search = new URLSearchParams({
    target,
    mode: 'domain',
    limit: String(limit),
    select: 'url_from,title,domain_rating_source,is_dofollow',
    order_by: 'domain_rating_source:desc',
    aggregation: '1_per_domain',
    history: 'live',
  });
  const res = await httpGet(url.toString(), {
    Authorization: `Bearer ${KEY}`,
    Accept: 'application/json',
  });
  if (res.status === 402) {
    console.error(`402 for ${target} — Ahrefs plan/rows exhausted, partial results.`);
    return [];
  }
  if (res.status !== 200) {
    console.error(`${res.status || 'ERR'} for ${target}: ${(res.text || res.error || '').slice(0, 200)}`);
    return [];
  }
  try {
    return JSON.parse(res.text).backlinks || [];
  } catch {
    console.error(`bad JSON for ${target}`);
    return [];
  }
}

// Referring pages per competitor.
const byPage = new Map(); // url_from -> { title, dr, brands:Set }
for (const [domain, brand] of Object.entries(cfg.competitors)) {
  for (const b of await backlinks(domain)) {
    if ((b.domain_rating_source ?? 0) < minDr) continue;
    const d = bareDomain(b.url_from);
    if (!d || isCompetitorOwned(cfg, d) || d.endsWith(OWN)) continue;
    const e = byPage.get(b.url_from) || {
      title: b.title || '',
      dr: b.domain_rating_source ?? 0,
      brands: new Set(),
    };
    e.brands.add(brand);
    byPage.set(b.url_from, e);
  }
  console.error(`fetched ${brand}`);
}

// Subtract anything already linking to us — match on the referring DOMAIN, since one
// link from a domain usually means the relationship already exists.
const ourDomains = new Set();
for (const b of await backlinks(OWN)) {
  const d = bareDomain(b.url_from);
  if (d) ourDomains.add(d);
}

const rows = [...byPage.entries()]
  .filter(([u, e]) => e.brands.size >= 2 && !ourDomains.has(bareDomain(u)))
  .sort((a, b) => b[1].brands.size - a[1].brands.size || b[1].dr - a[1].dr);

const csv = s => `"${String(s).replaceAll('"', '""')}"`;
console.log('url_from,title,domain_rating,competitors_linked,n_competitors');
for (const [u, e] of rows) {
  console.log([csv(u), csv(e.title), e.dr, csv([...e.brands].join('; ')), e.brands.size].join(','));
}
console.error(`${rows.length} link-gap pages (>=2 competitors, DR>=${minDr}, not linking to ${OWN})`);
