#!/usr/bin/env node
// citation-radar.mjs — discovery source #3: listicles published in the last 24 hours.
//
// The other two sources find pages that already exist and have already settled. This one
// is a live stream of pages AS THEY'RE PUBLISHED, and it converts better than the other
// two combined — for a reason that has nothing to do with technology.
//
// An editor who published a "best X tools" roundup eighteen months ago has moved on.
// Getting added means convincing them to reopen a doc they consider finished. An editor
// who published one YESTERDAY is still in the doc. They know it's thin. Half the time
// they're already planning a v2. Adding a vendor is a two-minute edit that makes their
// week's work better. Same pitch, roughly ten times the hit rate.
//
// Run this DAILY on a tight window. The other sources are weekly because the data under
// them moves in months; here the asset is the editor's attention and it decays fast.
//
// Usage: node citation-radar.mjs [--since 24h]
// Env:   FIREHOSE_TAP_TOKEN, OPENAI_API_KEY
//
// Output: JSON on stdout — { generated_for, raw_candidates, opportunities: [...] }
// It does NOT post anywhere and does NOT pick winners. It surfaces candidates.

import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { loadConfig, loadEnv, requireEnv, bareDomain, isCompetitorOwned } from './lib/config.mjs';

loadEnv();
const cfg = loadConfig();
const TAP_TOKEN = requireEnv('FIREHOSE_TAP_TOKEN');
const OPENAI_API_KEY = requireEnv('OPENAI_API_KEY');

const FIREHOSE_BASE = 'https://api.firehose.com';
const STREAM_TIMEOUT = 300;
const LIMIT = 10_000;

const sinceArg = (() => {
  const i = process.argv.indexOf('--since');
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : '24h';
})();

const BLOCKED_DOMAINS = new Set(cfg.blocked_domains || []);
const LISTICLE_SIGNALS = cfg.listicle_signals || [];
const CATEGORY_TERMS = cfg.category_terms || [];
const BRAND_TERMS = (cfg.brand_terms || [cfg.company]).map(s => s.toLowerCase());

let lastEventId = null;
const candidates = [];
let finished = false;

// --- cheap pre-filter, run BEFORE the expensive model ---------------------------
//
// A day of stream in a normal category is thousands of documents. Running an LLM over
// all of them costs real money and an hour of wall clock. A keyword pre-filter costs
// nothing and cuts it to a few dozen.
//
// THE SUBTLEST RULE IN THE WHOLE SYSTEM: block the competitor's DOMAIN, never the
// competitor's NAME. A post titled "7 best [Competitor] alternatives" on that
// competitor's own blog is worthless — they will never add you. The identical page on a
// third-party site is the highest-intent target in the pipeline: someone shopping for
// alternatives to your closest competitor, mid-decision. This is easy to get backwards
// while writing a blocklist at 11pm, and getting it backwards silently deletes your
// best lane.
function looksLikeOpportunity(url, title, snippet) {
  const domain = bareDomain(url);
  if (!domain) return false;
  if (BLOCKED_DOMAINS.has(domain)) return false;
  if (isCompetitorOwned(cfg, domain)) return false;
  if (domain === cfg.domain || domain.endsWith(`.${cfg.domain}`)) return false;

  const hay = `${title} ${snippet}`.toLowerCase();
  const isListicle = LISTICLE_SIGNALS.some(s => hay.includes(s));
  const inCategory = CATEGORY_TERMS.some(t => hay.includes(t));
  // BOTH, not either. "Top 10 productivity tools" is a list and not your category.
  // "How to run a structured interview" is your category and not a list. You want the
  // intersection, and the intersection is small.
  return isListicle && inCategory;
}

// --- stream -------------------------------------------------------------------
async function connect() {
  const params = new URLSearchParams({
    timeout: String(STREAM_TIMEOUT),
    since: sinceArg,
    limit: String(LIMIT),
  });
  const headers = { Authorization: `Bearer ${TAP_TOKEN}` };
  if (lastEventId) headers['Last-Event-ID'] = lastEventId;

  const res = await fetch(`${FIREHOSE_BASE}/v1/stream?${params}`, { headers });
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const rl = createInterface({ input: Readable.fromWeb(res.body) });
  let eventType = null, dataBuffer = '';
  rl.on('line', (line) => {
    if (line.startsWith('event: ')) eventType = line.slice(7).trim();
    else if (line.startsWith('id: ')) lastEventId = line.slice(4).trim();
    else if (line.startsWith('data: ')) dataBuffer += line.slice(6);
    else if (line === '') {
      if (eventType && dataBuffer) handleEvent(eventType, dataBuffer);
      eventType = null; dataBuffer = '';
    }
  });
  rl.on('error', () => finish());
  rl.on('close', () => finish());
}

function handleEvent(type, rawData) {
  if (type === 'end') return finish();
  if (type !== 'update') return;
  let payload;
  try { payload = JSON.parse(rawData); } catch { return; }
  const doc = payload?.document || {};
  const title = doc.title || '(no title)';
  const url = doc.url || '';
  const snippet = extractSnippet(doc) || '';
  if (!looksLikeOpportunity(url, title, snippet)) return;
  const hay = `${title} ${snippet}`.toLowerCase();
  candidates.push({
    title, url, snippet,
    matched_at: payload.matched_at,
    brand_already_present: BRAND_TERMS.some(t => hay.includes(t)),
  });
}

// --- LLM confirmation + metadata extraction -----------------------------------
async function classify(items) {
  if (items.length === 0) return [];
  const list = items
    .map((m, i) => `[${i}] URL: ${m.url}\nTitle: ${m.title}\nSnippet: ${m.snippet || '(none)'}`)
    .join('\n\n');

  const system = `You find CITATION OPPORTUNITIES for ${cfg.company} (${cfg.domain}), a ${cfg.category} company. ${cfg.company}'s AEO problem is SURFACING: getting NAMED in AI answers. The lever is being listed in the third-party roundups, listicles, and comparison articles that AI engines cite. Your job: from web pages just published, keep only the ones where ${cfg.company} could realistically be pitched for INCLUSION.

KEEP if the page is a third-party listicle / roundup / "best X tools" / "top software" / "[competitor] alternatives" / comparison article in the ${cfg.category} space — i.e. a page that lists multiple vendors and a writer or editor could add ${cfg.company} to.

SKIP if: a single-vendor product/pricing page; a competitor's OWN domain; a job posting; generic industry news with no vendor list; off-topic; or low-quality auto-generated spam.

For each item return: keep (bool), topic (short), tools_listed (array of vendor names you can see), company_listed (bool — are we already in it), authority ("high"/"medium"/"low" guess from domain + writing), pitch_angle (one line: why we fit this list), reason.

Return ONLY valid JSON, no fences:
{"results":[{"index":0,"keep":true,"topic":"...","tools_listed":["..."],"company_listed":false,"authority":"medium","pitch_angle":"...","reason":"..."}]}`;

  const body = JSON.stringify({
    model: cfg.classifier?.model || 'gpt-4o-mini',
    temperature: 0,
    // Small models love wrapping JSON in prose and code fences. The format flag is the
    // fix; parsing around fences is not.
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      // Batch every item into ONE call with indices. One request per page is slower,
      // more expensive, and loses the model's ability to compare items to each other.
      { role: 'user', content: `Review these ${items.length} items:\n\n${list}` },
    ],
  });

  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(cfg.classifier?.base_url || 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body,
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error(`classifier ${res.status} (attempt ${attempt}/${MAX_ATTEMPTS}): ${txt.slice(0, 300)}`);
        // Retry transient failures; fail hard on 401/400 — those won't fix themselves.
        if (res.status === 429 || res.status >= 500) { await sleep(2000 * attempt); continue; }
        throw new Error(`classifier ${res.status}`);
      }
      const json = await res.json();
      const parsed = JSON.parse(json.choices?.[0]?.message?.content || '{"results":[]}');
      return (parsed.results || []).filter(r => r.keep).map(r => ({ ...items[r.index], ...r }));
    } catch (e) {
      console.error(`classify attempt ${attempt}/${MAX_ATTEMPTS} failed: ${e.message}`);
      if (attempt === MAX_ATTEMPTS) return null; // signal hard failure
      await sleep(2000 * attempt);
    }
  }
  return null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function finish() {
  if (finished) return;
  finished = true;

  const reviewed = await classify(candidates);

  // FAIL HARD, NOT SOFT. This inverts the usual "optional sources skip silently" rule,
  // on purpose. A failed classifier must never degrade into "emit everything, let the
  // agent sort it out" — the agent downstream has no way to know vetting didn't happen.
  // It'll write 200 junk domains to your CRM and report a fantastic week.
  if (reviewed === null) {
    console.error('citation-radar: classification failed after retries — refusing to emit unclassified candidates.');
    process.stdout.write(JSON.stringify({
      generated_for: sinceArg,
      raw_candidates: candidates.length,
      error: 'classification_failed',
      classified: false,
      opportunities: [],
    }, null, 2) + '\n');
    process.exit(1);
  }

  const seen = new Set();
  const rank = { high: 0, medium: 1, low: 2 };
  const out = reviewed
    .filter(m => m.url && !m.company_listed && !seen.has(m.url) && seen.add(m.url))
    .sort((a, b) => (rank[a.authority] ?? 3) - (rank[b.authority] ?? 3));

  process.stdout.write(JSON.stringify({
    generated_for: sinceArg,
    raw_candidates: candidates.length,
    opportunities: out,
  }, null, 2) + '\n');
  process.exit(0);
}

// --- helpers ------------------------------------------------------------------
function extractSnippet(doc) {
  if (!doc) return null;
  if (doc.diff?.chunks) {
    const ins = doc.diff.chunks.filter(c => c.typ === 'ins').map(c => c.text).join(' ');
    if (ins.length > 0) return truncate(ins, 300);
  }
  if (doc.markdown) return truncate(doc.markdown, 300);
  return null;
}
function truncate(str, max) {
  const clean = str.replace(/\n+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '...' : clean;
}

await connect();
