// http.mjs — proxy-aware HTTP GET for the citation-outreach scripts.
//
// Why not native fetch: Node's built-in fetch (undici) does NOT honor HTTPS_PROXY, and
// undici isn't require-able here to install a ProxyAgent. In any environment where
// egress is proxy-only (a scheduled agent behind its network policy, or a sandbox),
// native fetch gets a 403 "host not in allowlist" while curl — which reads the proxy
// from the environment — succeeds. curl also goes direct when no proxy is set, so this
// works in both proxied and open-egress environments.
//
// Returns { status, text, error? }. Never throws.

import { spawn } from 'node:child_process';

export function httpGet(url, headers = {}, { timeoutMs = 20000, maxRedirs = 5 } = {}) {
  return new Promise((resolve) => {
    const args = ['-sS', '-L', '--max-redirs', String(maxRedirs),
      '-m', String(Math.ceil(timeoutMs / 1000)), '-w', '\n%{http_code}'];
    for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`);
    args.push(url);
    let out = '', err = '';
    let child;
    try {
      child = spawn('curl', args);
    } catch (e) {
      return resolve({ status: 0, text: '', error: String(e) });
    }
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('error', e => resolve({ status: 0, text: '', error: String(e) }));
    child.on('close', (code) => {
      if (!out) return resolve({ status: 0, text: '', error: (err.trim() || `curl exit ${code}`) });
      const nl = out.lastIndexOf('\n');
      const status = parseInt(out.slice(nl + 1).trim(), 10) || 0;
      resolve({ status, text: out.slice(0, Math.max(0, nl)) });
    });
  });
}
