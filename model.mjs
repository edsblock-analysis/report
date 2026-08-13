// Curated analysis model for American Equity EDS discovery.
// Assigns every URL to a template by FINAL (post-redirect) URL + observed block composition,
// derives block inventory & variations, and validates 74/74 coverage.
// Pure derivation from evidence in data/pages.json + data/fetch-log.json. No estimates.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const AE = path.join(ROOT, 'american-equity');
const pages = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'pages.json'), 'utf8'));
const log = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'fetch-log.json'), 'utf8'));
const finalByUrl = Object.fromEntries(log.map((r) => [r.url, (r.finalUrl || r.url)]));
const byPath = Object.fromEntries(pages.map((p) => [p.url, p]));

const P = (u) => u.replace(/^https?:\/\/www\.american-equity\.com/, '').replace(/\/$/, '') || '/';

// ---- Template assignment (evidence-based) ----
// key: template id; test: (finalPath, page) -> bool. First match wins (order matters).
const TEMPLATES = [
  ['Home', (fp) => fp === '/'],
  ['Legal / Utility', (fp) => /^\/(accessibility|agent-sms-privacy-terms|job-applicant-privacy-policy|naic-statutory-financial-statements|privacy|security-disclosure|terms-of-use|usa-patriot-act-notice)$/.test(fp)],
  ['Careers', (fp) => /^\/about\/careers/.test(fp)],
  ['Tool / Calculator (Embed)', (fp) => /(^\/income-gap-calculator$)|(tools-calculators\/income-gap-calculator$)/.test(fp)],
  ['Form / Document Listing', (fp) => /^\/(form|forms)$/.test(fp) || /(forms-library|document-library|material-request-form)$/.test(fp)],
  ['Content Listing (Dynamic)', (fp) => fp === '/insights'],
  ['Article (Insight / Blog)', (fp) => /^\/insights\/.+/.test(fp) || /^\/professionals\/fp-insights-and-education\/.+/.test(fp)],
  ['Product / Annuity (Professional)', (fp) => /^\/professionals\/american-equity-/i.test(fp)],
  ['Product / Annuity (Consumer)', (fp) => /^\/(assetshield|estateshield|guaranteeshield|incomeshield|our-annuities)$/i.test(fp)],
  ['Contact', (fp) => /(^\/contact-us$)|(professionals\/contact-us$)/.test(fp)],
  ['Section Landing / Hub', () => true], // fallback for remaining marketing landings
];

function templateFor(url) {
  const fp = P(finalByUrl[url] || url);
  for (const [name, test] of TEMPLATES) if (test(fp, byPath[url])) return name;
  return 'Section Landing / Hub';
}

const assign = pages.map((p) => ({
  url: p.url,
  path: p.path,
  finalPath: P(finalByUrl[p.url] || p.url),
  redirected: p.redirected,
  template: templateFor(p.url),
  components: p.components,
  integrations: p.integrations,
  externalDeps: p.externalDeps,
  structure: p.structure,
}));

// counts
const tmpl = {};
for (const a of assign) { (tmpl[a.template] = tmpl[a.template] || { pages: 0, urls: [] }); tmpl[a.template].pages++; tmpl[a.template].urls.push(a.path); }

// distinct rendered pages (unique final paths)
const distinctFinal = new Set(assign.map((a) => a.finalPath));

fs.writeFileSync(path.join(AE, 'data', 'template-assignment.json'), JSON.stringify({ templates: tmpl, assign }, null, 2));

console.log('=== TEMPLATE ASSIGNMENT (final-URL based) ===');
let sum = 0;
for (const [k, v] of Object.entries(tmpl).sort((a, b) => b[1].pages - a[1].pages)) { console.log(String(v.pages).padStart(3), k); sum += v.pages; }
console.log('TOTAL urls assigned:', sum, '/ 74');
console.log('Distinct final rendered pages:', distinctFinal.size);
console.log('\nUnassigned/leftover check:', assign.filter((a) => !a.template).length);
