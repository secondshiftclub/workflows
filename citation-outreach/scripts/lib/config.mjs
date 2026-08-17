// config.mjs — load config.json (falling back to config.example.json) and .env.
//
// Nothing in these scripts is hardcoded to a company. Copy config.example.json to
// config.json, point it at your domain and category, and every script picks it up.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadConfig() {
  const real = join(ROOT, 'config.json');
  const example = join(ROOT, 'config.example.json');
  const path = existsSync(real) ? real : example;

  if (path === example) {
    console.error(
      'note: using config.example.json — copy it to config.json and set your own ' +
      'domain, competitors, and category before you trust the output.'
    );
  }
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`could not read ${path}: ${e.message}`);
    process.exit(1);
  }
  for (const key of ['company', 'domain', 'category', 'competitors']) {
    if (!cfg[key]) {
      console.error(`config is missing "${key}" — see config.example.json`);
      process.exit(1);
    }
  }
  return cfg;
}

// Load .env from the workflow root, without clobbering real environment variables.
export function loadEnv() {
  const path = join(ROOT, '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
  }
}

// Required env var — exit loudly. Use for keys the script cannot run without.
export function requireEnv(key) {
  const val = process.env[key];
  if (!val) {
    console.error(`Missing env var: ${key} — see .env.example`);
    process.exit(1);
  }
  return val;
}

// Optional env var — skip the SOURCE cleanly, but say so out loud. An optional source
// may skip silently in spirit; it must never look like "the world is empty".
export function optionalEnv(key, whatItPowers) {
  const val = process.env[key];
  if (!val) {
    console.error(`${key} not set — skipping ${whatItPowers}. This is not a fatal error.`);
    process.exit(0);
  }
  return val;
}

// Every competitor spelling we should match on a page, mapped to its canonical name.
export function competitorNames(cfg) {
  const map = new Map();
  for (const name of Object.values(cfg.competitors)) map.set(name, name);
  for (const [alias, canonical] of Object.entries(cfg.competitor_aliases || {})) {
    map.set(alias, canonical);
  }
  return map;
}

export const bareDomain = u => {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; }
};

export function isCompetitorOwned(cfg, domain) {
  if (!domain) return false;
  const domains = Object.keys(cfg.competitors);
  return domains.includes(domain) || domains.some(c => domain.endsWith(`.${c}`));
}
