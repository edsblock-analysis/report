// Extract structured per-page signals from cached American Equity HTML.
// Observed signals only. Primary block signal = Optimizely data-component attribute.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const AE = path.join(ROOT, 'american-equity');
const CACHE = path.join(AE, 'pages_cache');
const fetchLog = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'fetch-log.json'), 'utf8'));

// Ordered, de-duplicated URL list (same as fetch)
const RAW = fs.readFileSync(path.join(ROOT, 'american-equity.txt'), 'utf8')
  .split('\n').map((s) => s.trim()).filter(Boolean);
const seenU = new Set();
const URLS = RAW.filter((u) => { const k = u.toLowerCase(); if (seenU.has(k)) return false; seenU.add(k); return true; });

const logByUrl = Object.fromEntries(fetchLog.map((r) => [r.url, r]));

function keyFor(u) {
  return u.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 180) + '.html';
}
const dec = (s) => (s || '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
const strip = (s) => dec((s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

// Integrations detected by evidence signature (regex over full HTML incl. escaped JSON)
const INTEGRATIONS = {
  'Google Tag Manager': /googletagmanager\.com|GTM-[A-Z0-9]{6,}/,
  'Google Analytics (gtag)': /gtag\(|www\.google-analytics\.com|\/G-[A-Z0-9]{6,}/,
  'OneTrust (consent)': /onetrust|cookielaw\.org|data-domain-script|otSDKStub/i,
  'Optimizely CMS (SaaS)': /cms\.optimizely\.com|opti-content-area/i,
  'Optimizely Web/Experimentation': /cdn\.optimizely\.com\/js\//i,
  'Wistia (video)': /wistia-video|home\.wistia\.com|wistia\.com\/(embed|medias)|fast\.wistia/i,
  'ion interactive (Scribble/forms)': /scribblecdn\.net|ionizer|data-ion-embed-hash/i,
  'Greenhouse (job board)': /boards\.greenhouse\.io|grnhse_app/i,
  'Hedgeness (income-gap calculator)': /hedgenessapp\.com|hedgenessWidget/i,
  'Adobe Fonts (Typekit)': /use\.typekit\.net/i,
  'Google Fonts': /fonts\.googleapis\.com/i,
  'YouTube (linked/embedded)': /youtube\.com|youtu\.be/i,
  'Vimeo': /player\.vimeo\.com|vimeo\.com\/video/i,
  'Google Maps': /maps\.googleapis\.com|google\.maps/i,
  'reCAPTCHA': /recaptcha|grecaptcha/i,
  'hCaptcha': /hcaptcha/i,
};

// External / infra hosts we care about (evidence of dependency, not necessarily a tracker)
const EXTERNAL_HOSTS = {
  'asset.american-equity.com (DAM download)': /asset\.american-equity\.com/i,
  '/api/assets/resolve-by-key (asset resolver)': /\/api\/assets\/resolve-by-key/i,
  'myportal.american-equity.com (customer login)': /myportal\.american-equity\.com/i,
  'register.american-equity.com (Okta register)': /register\.american-equity\.com/i,
  'experience.american-equity.com (ion pages)': /experience\.american-equity\.com/i,
  'eagle-lifeco.com': /eagle-lifeco\.com/i,
  'ae-newyork.com': /ae-newyork\.com/i,
  'ambest.com (ratings)': /ambest\.com/i,
  'fitchratings.com (ratings)': /fitchratings\.com/i,
  'spglobal.com (ratings)': /spglobal\.com/i,
};

// Template classification from URL path + observed component composition.
function classify(u, comps, sig) {
  const p = u.replace(/^https?:\/\/www\.american-equity\.com/, '').replace(/\/$/, '') || '/';
  const seg = p.split('/').filter(Boolean);
  const has = (c) => comps[c] > 0;
  const low = p.toLowerCase();

  if (p === '/') return 'Home';
  // Legal / utility
  if (/(privacy|terms-of-use|accessibility|security-disclosure|usa-patriot-act|sms-privacy|job-applicant-privacy|naic-statutory)/.test(low)) return 'Legal / Utility';
  // Insights / blog article (single article under /insights/ or /resources/blog/)
  if (/^\/insights\/.+/.test(low) || /^\/resources\/blog\/.+/.test(low)) return 'Article (Insight/Blog)';
  // Insights listing
  if (low === '/insights') return 'Listing (Insights/Blog)';
  // Professional FP insight article
  if (/^\/professionals\/fp-insights-and-education\/.+/.test(low)) return 'Article (Insight/Blog)';
  // Product / annuity marketing pages
  if (/(assetshield|estateshield|guaranteeshield|incomeshield|incomeshield-annuity)/.test(low) && !low.includes('professionals')) return 'Product / Annuity (Consumer)';
  if (/^\/professionals\/american-equity-/.test(low)) return 'Product / Annuity (Professional)';
  // Calculators / tools (third-party embed)
  if (/income-gap-calculator|tools-calculators/.test(low)) return 'Tool / Calculator (Embed)';
  // Forms
  if (has('formListing') || has('formTable') || has('formInputModel') || /material-request-form|(^\/form$)|(^\/forms$)/.test(low)) return 'Form / Document Listing';
  // Document/forms library (searchable listings w/ brochure/attachment)
  if (/document-library|forms-library/.test(low)) return 'Form / Document Listing';
  // Careers
  if (/^\/about\/careers/.test(low)) return 'Careers';
  // Professionals landing/sub-landing
  if (low === '/professionals' || /^\/professionals\/(client-engagement-collections|resources|our-annuities|rates-and-indexes|fp-insights-and-education|contact-us)(\/.*)?$/.test(low)) return 'Section Landing / Hub';
  // Consumer section landings / hubs
  if (/(our-annuities|annuities-101|financial-strength|community|contact-us|beneficiary-support|about)$/.test(low)) return 'Section Landing / Hub';
  // fallback by composition
  if (has('blogCard') || has('relatedBlogPosts')) return 'Listing (Insights/Blog)';
  return 'Content Page (Generic)';
}

const pages = [];
const compGlobal = {};   // data-component -> {count, pages, urls:Set}
const integGlobal = {};  // integration -> pages count + urls
const extGlobal = {};
const tmplGlobal = {};

for (const u of URLS) {
  const file = path.join(CACHE, keyFor(u));
  let html = '';
  try { html = fs.readFileSync(file, 'utf8'); } catch { pages.push({ url: u, error: 'no-cache' }); continue; }

  const meta = logByUrl[u] || {};
  const head = (html.split(/<\/head>/i)[0] || html);
  const bodyStart = html.indexOf('>', html.search(/<body/i));
  const body = bodyStart > 0 ? html.slice(bodyStart) : html;

  const title = strip((head.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
  const canonicalTag = (head.match(/<link[^>]+rel="canonical"[^>]*>/i) || [])[0];
  const canonicalHref = canonicalTag ? attr(canonicalTag, 'href') : null;
  const metaDescTag = (head.match(/<meta[^>]+name="description"[^>]*>/i) || [])[0];
  const metaDesc = metaDescTag ? dec(attr(metaDescTag, 'content')) : '';
  const contentType = (head.match(/<meta[^>]+name="idio:content-type"[^>]+content="([^"]*)"/i) || [])[1] || '';
  const ogType = (head.match(/<meta[^>]+property="og:type"[^>]+content="([^"]*)"/i) || [])[1] || '';
  const robots = (head.match(/<meta[^>]+name="robots"[^>]+content="([^"]*)"/i) || [])[1] || '';

  // data-component signatures (the Optimizely block signal)
  const comps = {};
  for (const m of body.matchAll(/data-component="([^"]+)"/g)) {
    comps[m[1]] = (comps[m[1]] || 0) + 1;
  }
  // remove structural wrappers from "block" consideration but keep counts
  const h1s = [...body.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1])).filter(Boolean);
  const h2s = [...body.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => strip(m[1])).filter(Boolean);

  // structural counts
  const forms = (body.match(/<form[\s>]/gi) || []).length;
  const inputs = (body.match(/<input[\s>]|<select[\s>]|<textarea[\s>]/gi) || []).length;
  const iframes = (body.match(/<iframe/gi) || []).length;
  const imgs = (body.match(/<img[\s>]/gi) || []).length;
  const wistia = (body.match(/wistia-video|videoType\\?":\\?"wistia/gi) || []).length;
  const pdfLinks = (body.match(/href="[^"]+\.pdf(\?[^"]*)?"/gi) || []).length;
  const assetResolver = (html.match(/\/api\/assets\/resolve-by-key/gi) || []).length;
  const assetDownload = (html.match(/asset\.american-equity\.com\/download/gi) || []).length;
  const tables = (body.match(/<table[\s>]/gi) || []).length;
  const accordions = comps.accordion || 0;
  const scriptRow = comps.scriptRow || 0;

  // integrations
  const integs = [];
  for (const [name, re] of Object.entries(INTEGRATIONS)) if (re.test(html)) integs.push(name);
  const exts = [];
  for (const [name, re] of Object.entries(EXTERNAL_HOSTS)) if (re.test(html)) exts.push(name);

  const template = classify(u, comps, { integs });

  const rec = {
    url: u,
    path: (u.replace(/^https?:\/\/www\.american-equity\.com/, '') || '/'),
    finalUrl: meta.finalUrl || u,
    redirected: !!meta.redirected,
    status: meta.finalStatus,
    depth: (u.replace(/^https?:\/\/www\.american-equity\.com\/?/, '').replace(/\/$/, '').split('/').filter(Boolean).length),
    title,
    canonical: canonicalHref,
    metaDesc,
    metaDescLen: metaDesc.length,
    contentType,
    ogType,
    robots,
    h1: h1s,
    h1count: h1s.length,
    h2count: h2s.length,
    template,
    components: comps,
    structure: { forms, inputs, iframes, imgs, wistia, pdfLinks, assetResolver, assetDownload, tables, accordions, scriptRow },
    integrations: integs,
    externalDeps: exts,
    bytes: html.length,
  };
  pages.push(rec);

  for (const [k, v] of Object.entries(comps)) {
    compGlobal[k] = compGlobal[k] || { count: 0, pages: 0, urls: [] };
    compGlobal[k].count += v; compGlobal[k].pages += 1; compGlobal[k].urls.push(rec.path);
  }
  for (const k of integs) { integGlobal[k] = integGlobal[k] || { pages: 0, urls: [] }; integGlobal[k].pages += 1; integGlobal[k].urls.push(rec.path); }
  for (const k of exts) { extGlobal[k] = extGlobal[k] || { pages: 0, urls: [] }; extGlobal[k].pages += 1; extGlobal[k].urls.push(rec.path); }
  tmplGlobal[template] = tmplGlobal[template] || { pages: 0, urls: [] };
  tmplGlobal[template].pages += 1; tmplGlobal[template].urls.push(rec.path);
}

fs.writeFileSync(path.join(AE, 'data', 'pages.json'), JSON.stringify(pages, null, 2));
fs.writeFileSync(path.join(AE, 'data', 'aggregates.json'), JSON.stringify({
  totalPages: pages.length,
  templates: Object.fromEntries(Object.entries(tmplGlobal).sort((a, b) => b[1].pages - a[1].pages)),
  components: Object.fromEntries(Object.entries(compGlobal).sort((a, b) => b[1].pages - a[1].pages)),
  integrations: Object.fromEntries(Object.entries(integGlobal).sort((a, b) => b[1].pages - a[1].pages)),
  externalDeps: Object.fromEntries(Object.entries(extGlobal).sort((a, b) => b[1].pages - a[1].pages)),
}, null, 2));

console.log('Pages processed:', pages.length);
console.log('\n=== TEMPLATES ===');
for (const [k, v] of Object.entries(tmplGlobal).sort((a, b) => b[1].pages - a[1].pages)) console.log(String(v.pages).padStart(4), k);
console.log('\n=== COMPONENTS (by pages) ===');
for (const [k, v] of Object.entries(compGlobal).sort((a, b) => b[1].pages - a[1].pages)) console.log(String(v.pages).padStart(4), 'pg', String(v.count).padStart(5), 'tot ', k);
console.log('\n=== INTEGRATIONS ===');
for (const [k, v] of Object.entries(integGlobal).sort((a, b) => b[1].pages - a[1].pages)) console.log(String(v.pages).padStart(4), k);
console.log('\n=== EXTERNAL DEPS ===');
for (const [k, v] of Object.entries(extGlobal).sort((a, b) => b[1].pages - a[1].pages)) console.log(String(v.pages).padStart(4), k);
