// Fetch all URLs from american-equity.txt. Capture status, redirect chain, final URL,
// key headers, and cache raw HTML. No inference here — only observed network behavior.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const AE = path.join(ROOT, 'american-equity');
const RAW = fs.readFileSync(path.join(ROOT, 'american-equity.txt'), 'utf8')
  .split('\n').map((s) => s.trim()).filter(Boolean);
// de-dup, keep first occurrence order
const seen = new Set();
const URLS = RAW.filter((u) => { const k = u.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });

const CACHE = path.join(AE, 'pages_cache');
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(path.join(AE, 'data'), { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const CONCURRENCY = 6;

function keyFor(u) {
  return u.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 180) + '.html';
}

// Manually walk the redirect chain so we can record every hop and status.
async function fetchChain(u) {
  const chain = [];
  let current = u;
  for (let hop = 0; hop < 8; hop += 1) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 35000);
    let res;
    try {
      res = await fetch(current, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en', Accept: 'text/html,application/xhtml+xml' },
        signal: ctrl.signal,
        redirect: 'manual',
      });
    } finally { clearTimeout(t); }
    const loc = res.headers.get('location');
    chain.push({ url: current, status: res.status, location: loc || null });
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, current).toString();
      continue;
    }
    const body = await res.text();
    return {
      chain,
      finalUrl: current,
      finalStatus: res.status,
      contentType: res.headers.get('content-type') || '',
      server: res.headers.get('server') || '',
      xPoweredBy: res.headers.get('x-powered-by') || '',
      cacheControl: res.headers.get('cache-control') || '',
      body,
    };
  }
  return { chain, finalUrl: current, finalStatus: 'TOO_MANY_REDIRECTS', body: '' };
}

const results = [];
let done = 0;

async function fetchOne(u) {
  const file = path.join(CACHE, keyFor(u));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const r = await fetchChain(u);
      if (r.body && r.body.length > 300) fs.writeFileSync(file, r.body);
      done += 1;
      const { body, ...meta } = r;
      return { url: u, bytes: body ? body.length : 0, redirected: r.finalUrl !== u, ...meta };
    } catch (e) {
      if (attempt === 2) { done += 1; return { url: u, finalStatus: 'ERROR', error: String(e).slice(0, 160) }; }
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return { url: u, finalStatus: 'ERROR' };
}

async function run() {
  const queue = URLS.map((u, i) => ({ u, i }));
  const out = new Array(URLS.length);
  async function worker() {
    while (queue.length) {
      const { u, i } = queue.shift();
      out[i] = await fetchOne(u);
      process.stderr.write(`  ${done}/${URLS.length}  ${out[i].finalStatus}  ${u}\n`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  results.push(...out);
  fs.writeFileSync(path.join(AE, 'data', 'fetch-log.json'), JSON.stringify(results, null, 2));
  const errs = results.filter((r) => r.finalStatus === 'ERROR' || (typeof r.finalStatus === 'number' && r.finalStatus >= 400));
  const reds = results.filter((r) => r.redirected);
  process.stderr.write(`\nDONE. total=${results.length} unique-input=${URLS.length} redirected=${reds.length} errors/4xx+=${errs.length}\n`);
}
run();
