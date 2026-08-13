// FRESH re-fetch of every American Equity URL, one at a time (sequential).
// Records the full redirect chain, final URL/status, key headers, and caches raw HTML.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT = path.join(ROOT, 'american-equity-report');
const RAW = fs.readFileSync(path.join(ROOT, 'american-equity.txt'), 'utf8')
  .split('\n').map((s) => s.trim()).filter(Boolean);
const seen = new Set();
const URLS = RAW.filter((u) => { const k = u.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });

const CACHE = path.join(OUT, 'pages_cache');
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const keyFor = (u) => u.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 180) + '.html';

async function fetchChain(u) {
  const chain = [];
  let current = u;
  for (let hop = 0; hop < 8; hop += 1) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 35000);
    let res;
    try {
      res = await fetch(current, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en', Accept: 'text/html,application/xhtml+xml' }, signal: ctrl.signal, redirect: 'manual' });
    } finally { clearTimeout(t); }
    const loc = res.headers.get('location');
    chain.push({ url: current, status: res.status, location: loc || null });
    if (res.status >= 300 && res.status < 400 && loc) { current = new URL(loc, current).toString(); continue; }
    const body = await res.text();
    return { chain, finalUrl: current, finalStatus: res.status, contentType: res.headers.get('content-type') || '', server: res.headers.get('server') || '', body };
  }
  return { chain, finalUrl: current, finalStatus: 'TOO_MANY_REDIRECTS', body: '' };
}

const results = [];
let i = 0;
for (const u of URLS) {
  i += 1;
  let rec = { url: u, finalStatus: 'ERROR' };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const r = await fetchChain(u);
      if (r.body && r.body.length > 300) fs.writeFileSync(path.join(CACHE, keyFor(u)), r.body);
      const { body, ...meta } = r;
      rec = { url: u, bytes: body ? body.length : 0, redirected: r.finalUrl !== u, ...meta };
      break;
    } catch (e) {
      if (attempt === 2) rec = { url: u, finalStatus: 'ERROR', error: String(e).slice(0, 160) };
      else await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  results.push(rec);
  process.stderr.write(`  ${i}/${URLS.length}  ${rec.finalStatus}${rec.redirected ? ' (redir)' : ''}  ${u}\n`);
}
fs.writeFileSync(path.join(OUT, 'data', 'fetch-log.json'), JSON.stringify(results, null, 2));
const errs = results.filter((r) => r.finalStatus === 'ERROR' || (typeof r.finalStatus === 'number' && r.finalStatus >= 400));
const reds = results.filter((r) => r.redirected);
process.stderr.write(`\nDONE. total=${results.length} redirected=${reds.length} errors/4xx+=${errs.length}\n`);
