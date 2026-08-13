// Re-analyze all 74 cached AE pages: extract per-page signals, assign template by
// final URL + block composition, and build the evidence-based template↔block mapping.
// Writes data/pages.json, data/template-assignment.json, data/template-block-mapping.json,
// data/aggregates.json. Observed signals only.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT = path.join(ROOT, 'american-equity-report');
const CACHE = path.join(OUT, 'pages_cache');
const log = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'fetch-log.json'), 'utf8'));
const logByUrl = Object.fromEntries(log.map((r) => [r.url, r]));

const RAW = fs.readFileSync(path.join(ROOT, 'american-equity.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const seen = new Set();
const URLS = RAW.filter((u) => { const k = u.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });

const keyFor = (u) => u.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 180) + '.html';
const dec = (s) => (s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
const strip = (s) => dec((s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
const attr = (tag, n) => { const m = tag.match(new RegExp(`${n}="([^"]*)"`, 'i')); return m ? m[1] : null; };
const P = (u) => (u.replace(/^https?:\/\/www\.american-equity\.com/, '').replace(/\/$/, '') || '/');

const INTEGRATIONS = {
  'Google Tag Manager': /googletagmanager\.com|GTM-[A-Z0-9]{6,}/,
  'Google Analytics 4 (via GTM)': /gtag\(|www\.google-analytics\.com/,
  'OneTrust (consent)': /onetrust|cookielaw\.org|data-domain-script|otSDKStub/i,
  'Optimizely CMS (SaaS)': /cms\.optimizely\.com|opti-content-area/i,
  'Optimizely Web / Experimentation': /cdn\.optimizely\.com\/js\//i,
  'Wistia (video)': /wistia-video|home\.wistia\.com|wistia\.com\/(embed|medias)|fast\.wistia/i,
  'ion interactive (Scribble) — forms': /scribblecdn\.net|ionizer|data-ion-embed-hash/i,
  'Greenhouse (job board / ATS)': /boards\.greenhouse\.io|grnhse_app/i,
  'Hedgeness (income-gap calculator)': /hedgenessapp\.com|hedgenessWidget/i,
  'YouTube (outbound links only)': /youtube\.com|youtu\.be/i,
};
const EXTERNAL = {
  'asset.american-equity.com (DAM download)': /asset\.american-equity\.com/i,
  '/api/assets/resolve-by-key (asset resolver)': /\/api\/assets\/resolve-by-key/i,
  'myportal.american-equity.com (customer login)': /myportal\.american-equity\.com/i,
  'register.american-equity.com (Okta register)': /register\.american-equity\.com/i,
  'experience.american-equity.com (ion pages)': /experience\.american-equity\.com/i,
  'eagle-lifeco.com (affiliate)': /eagle-lifeco\.com/i,
  'ae-newyork.com (affiliate)': /ae-newyork\.com/i,
  'ambest.com (ratings)': /ambest\.com/i,
  'fitchratings.com (ratings)': /fitchratings\.com/i,
  'spglobal.com (ratings)': /spglobal\.com/i,
};

function classify(finalPath, comps) {
  const p = finalPath.toLowerCase();
  const has = (c) => comps[c] > 0;
  if (p === '/') return 'Home';
  if (/^\/(accessibility|agent-sms-privacy-terms|job-applicant-privacy-policy|naic-statutory-financial-statements|privacy|security-disclosure|terms-of-use|usa-patriot-act-notice)$/.test(p)) return 'Legal / Utility';
  if (/^\/about\/careers/.test(p)) return 'Careers';
  if (/(^\/income-gap-calculator$)|(tools-calculators\/income-gap-calculator$)/.test(p)) return 'Tool / Calculator (Embed)';
  if (/^\/(form|forms)$/.test(p) || /(forms-library|document-library|material-request-form)$/.test(p)) return 'Form / Document Listing';
  if (p === '/insights') return 'Content Listing (Dynamic)';
  if (/^\/insights\/.+/.test(p) || /^\/professionals\/fp-insights-and-education\/.+/.test(p)) return 'Article (Insight / Blog)';
  if (/^\/professionals\/american-equity-/i.test(p)) return 'Product / Annuity (Professional)';
  if (/^\/(assetshield|estateshield|guaranteeshield|incomeshield|our-annuities)$/i.test(p)) return 'Product / Annuity (Consumer)';
  if (/(^\/contact-us$)|(professionals\/contact-us$)/.test(p)) return 'Contact';
  return 'Section Landing / Hub';
}

const pages = [];
const compGlobal = {}; const integGlobal = {}; const extGlobal = {}; const tmplGlobal = {};

for (const u of URLS) {
  const html = fs.readFileSync(path.join(CACHE, keyFor(u)), 'utf8');
  const meta = logByUrl[u] || {};
  const head = html.split(/<\/head>/i)[0] || html;
  const bStart = html.indexOf('>', html.search(/<body/i));
  const body = bStart > 0 ? html.slice(bStart) : html;

  const title = strip((head.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
  const canonicalTag = (head.match(/<link[^>]+rel="canonical"[^>]*>/i) || [])[0];
  const canonical = canonicalTag ? attr(canonicalTag, 'href') : null;
  const mdTag = (head.match(/<meta[^>]+name="description"[^>]*>/i) || [])[0];
  const metaDesc = mdTag ? dec(attr(mdTag, 'content')) : '';
  const contentType = (head.match(/<meta[^>]+name="idio:content-type"[^>]+content="([^"]*)"/i) || [])[1] || '';

  const comps = {};
  for (const m of body.matchAll(/data-component="([^"]+)"/g)) comps[m[1]] = (comps[m[1]] || 0) + 1;
  const h1s = [...body.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1])).filter(Boolean);

  const structure = {
    forms: (body.match(/<form[\s>]/gi) || []).length,
    inputs: (body.match(/<input[\s>]|<select[\s>]|<textarea[\s>]/gi) || []).length,
    wistia: (body.match(/wistia-video|videoType\\?":\\?"wistia/gi) || []).length,
    pdfLinks: (body.match(/href="[^"]+\.pdf(\?[^"]*)?"/gi) || []).length,
    assetResolver: (html.match(/\/api\/assets\/resolve-by-key/gi) || []).length,
    assetDownload: (html.match(/asset\.american-equity\.com\/download/gi) || []).length,
    scriptRow: comps.scriptRow || 0,
    breadcrumb: /aria-label="Breadcrumb navigation"/.test(html) ? 1 : 0,
  };

  const integs = []; for (const [n, re] of Object.entries(INTEGRATIONS)) if (re.test(html)) integs.push(n);
  const exts = []; for (const [n, re] of Object.entries(EXTERNAL)) if (re.test(html)) exts.push(n);

  const finalPath = P(meta.finalUrl || u);
  const template = classify(finalPath, comps);

  const rec = {
    url: u, path: P(u), finalUrl: meta.finalUrl || u, finalPath, redirected: !!meta.redirected, status: meta.finalStatus,
    title, canonical, metaDesc, metaDescLen: metaDesc.length, contentType,
    h1count: h1s.length, template, components: comps, structure, integrations: integs, externalDeps: exts, bytes: html.length,
  };
  pages.push(rec);
  for (const [k, v] of Object.entries(comps)) { compGlobal[k] = compGlobal[k] || { count: 0, pages: 0 }; compGlobal[k].count += v; compGlobal[k].pages += 1; }
  for (const k of integs) { integGlobal[k] = integGlobal[k] || { pages: 0, urls: [] }; integGlobal[k].pages += 1; integGlobal[k].urls.push(rec.path); }
  for (const k of exts) { extGlobal[k] = extGlobal[k] || { pages: 0, urls: [] }; extGlobal[k].pages += 1; extGlobal[k].urls.push(rec.path); }
  tmplGlobal[template] = tmplGlobal[template] || { pages: 0, urls: [] }; tmplGlobal[template].pages += 1; tmplGlobal[template].urls.push(rec.path);
}

fs.writeFileSync(path.join(OUT, 'data', 'pages.json'), JSON.stringify(pages, null, 2));
fs.writeFileSync(path.join(OUT, 'data', 'aggregates.json'), JSON.stringify({
  totalPages: pages.length,
  templates: Object.fromEntries(Object.entries(tmplGlobal).sort((a, b) => b[1].pages - a[1].pages)),
  components: Object.fromEntries(Object.entries(compGlobal).sort((a, b) => b[1].pages - a[1].pages)),
  integrations: Object.fromEntries(Object.entries(integGlobal).sort((a, b) => b[1].pages - a[1].pages)),
  externalDeps: Object.fromEntries(Object.entries(extGlobal).sort((a, b) => b[1].pages - a[1].pages)),
}, null, 2));

// ---- template assignment ----
const ta = { templates: tmplGlobal, assign: pages.map((p) => ({ url: p.url, path: p.path, finalPath: p.finalPath, redirected: p.redirected, template: p.template, components: p.components, integrations: p.integrations })) };
fs.writeFileSync(path.join(OUT, 'data', 'template-assignment.json'), JSON.stringify(ta, null, 2));

// ---- component -> block/variation map ----
const MAP = {
  heroHeaderSection: ['Hero (In-Page Intro Band)', 'Standard Hero', 'block'],
  blogHeader: ['Hero (In-Page Intro Band)', 'Article Hero', 'block'],
  heroHeader: ['Hero (In-Page Intro Band)', 'Simple Hero', 'block'],
  featureCardsAndMediaRow: ['Feature Cards & Media', 'Media + copy row', 'block'],
  featuredIconCard: ['Feature Cards & Media', 'Icon card grid', 'block'],
  featuredImageCard: ['Feature Cards & Media', 'Image card grid', 'block'],
  feature3SetsImage: ['Feature Cards & Media', '3-set image feature', 'block'],
  featureSetCard: ['Feature Cards & Media', '3-set image feature', 'block'],
  featureHorizontalLineTab: ['Tabs (Tabbed Content)', 'Horizontal tabs', 'block'],
  featureHorizontalLineTabCard: ['Tabs (Tabbed Content)', 'Horizontal tabs', 'block'],
  featureVerticalLineTab: ['Tabs (Tabbed Content)', 'Vertical tabs', 'block'],
  featureVerticalLineTabCard: ['Tabs (Tabbed Content)', 'Vertical tabs', 'block'],
  progressBar: ['Progress Bar / Stepper', 'Numbered step sequence', 'block'],
  progressBarStep: ['Progress Bar / Stepper', 'Numbered step sequence', 'block'],
  videoBlock: ['Video (Wistia)', 'Inline Wistia video', 'block'],
  metrics: ['Metrics / Stats', 'Stat row', 'block'],
  metricsCard: ['Metrics / Stats', 'Stat row', 'block'],
  accordion: ['Accordion / Disclosure', 'FAQ accordion', 'block'],
  disclosure: ['Accordion / Disclosure', 'Disclosure / legal expander', 'block'],
  relatedBlogPosts: ['Blog Card / Related Posts', 'Related posts strip', 'block'],
  blogCard: ['Blog Card / Related Posts', 'Editorial card grid', 'block'],
  formListing: ['Searchable Form / Document Library', 'Search + category tabs', 'block'],
  formTable: ['Searchable Form / Document Library', 'Table directory', 'block'],
  formInputModel: ['Native Data-Entry Form', 'Native form', 'block'],
  contactCard: ['Contact Card / Row', 'Contact cards', 'block'],
  contactRow: ['Contact Card / Row', 'Contact cards', 'block'],
  generalModal: ['Modal / Dialog', 'General modal', 'block'],
  // default content (not bespoke blocks)
  richTextRow: [null, null, 'default'], imageBlock: [null, null, 'default'], ctaBlock: [null, null, 'default'],
  anchorLinkTarget: [null, null, 'default'], attachments: [null, null, 'default'],
  brochure: [null, null, 'default'], brochureTab: [null, null, 'default'], brochureCard: [null, null, 'default'],
  // 3rd-party embed
  scriptRow: [null, null, 'embed'],
  // structural / global
  ContentArea: [null, null, 'skip'],
  footerNavigationColumn: ['Global Footer', 'Multi-column footer', 'global'],
  footerNavigationLink: ['Global Footer', 'Multi-column footer', 'global'],
};
const EMBED_BY_PATH = {
  '/professionals/material-request-form': 'ion interactive form',
  '/professionals/contact-us': 'ion interactive form',
  '/income-gap-calculator': 'Hedgeness calculator',
  '/professionals/tools-calculators/income-gap-calculator': 'Hedgeness calculator',
  '/about/careers/openings': 'Greenhouse job board',
};

const tmap = {};
for (const p of pages) {
  const tpl = p.template;
  tmap[tpl] = tmap[tpl] || { pages: new Set(), blocks: {}, embeds: {} };
  tmap[tpl].pages.add(p.path);
  const add = (block, variation, kind) => {
    tmap[tpl].blocks[block] = tmap[tpl].blocks[block] || { kind, pages: new Set(), variations: {} };
    tmap[tpl].blocks[block].pages.add(p.path);
    if (variation) { tmap[tpl].blocks[block].variations[variation] = tmap[tpl].blocks[block].variations[variation] || new Set(); tmap[tpl].blocks[block].variations[variation].add(p.path); }
  };
  for (const c of Object.keys(p.components)) {
    const m = MAP[c]; if (!m || m[2] === 'skip' || m[2] === 'default') continue;
    if (m[2] === 'embed') { const e = EMBED_BY_PATH[p.path] || 'third-party embed'; tmap[tpl].embeds[e] = (tmap[tpl].embeds[e] || 0) + 1; continue; }
    add(m[0], m[1], m[2]);
  }
  add('Global Header / Navigation (site chrome)', 'Mega-menu header', 'global');
  if (p.structure.breadcrumb) add('Breadcrumb', 'Breadcrumb trail', 'global');
  if (tpl === 'Content Listing (Dynamic)') add('Dynamic Content Listing (Insights index)', 'Client-fetched paginated feed', 'block');
}
const mapping = {};
for (const [tpl, d] of Object.entries(tmap)) {
  mapping[tpl] = {
    pageCount: d.pages.size,
    urls: [...d.pages].sort(),
    embeds: Object.keys(d.embeds).length ? d.embeds : null,
    blocks: Object.fromEntries(Object.entries(d.blocks).map(([b, v]) => [b, { kind: v.kind, pages: v.pages.size, variations: Object.fromEntries(Object.entries(v.variations).map(([vn, s]) => [vn, s.size])) }]).sort((a, b2) => b2[1].pages - a[1].pages)),
  };
}
fs.writeFileSync(path.join(OUT, 'data', 'template-block-mapping.json'), JSON.stringify(mapping, null, 2));

console.log('Pages:', pages.length, '| all 200:', pages.every((p) => p.status === 200));
console.log('Templates:', Object.keys(tmplGlobal).length, '| Redirects:', pages.filter((p) => p.redirected).length);
console.log('Breadcrumb pages:', pages.filter((p) => p.structure.breadcrumb).length);
for (const [t, d] of Object.entries(tmplGlobal).sort((a, b) => b[1].pages - a[1].pages)) console.log('  ', String(d.pages).padStart(2), t);
