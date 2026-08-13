// Build the single, self-contained PRE-SALES report for American Equity → EDS.
// Sections: Summary · Analyzed URLs (linked) · Blocks & Variations (complexity) ·
// Template ↔ Block ↔ Variation mapping (evidence-based) · Assumptions ·
// Third-Party Integrations · Other Observations.
// NO estimates / timelines / story points / dev-days.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const AE = path.join(ROOT, 'american-equity');
const pages = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'pages.json'), 'utf8'));
const ta = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'template-assignment.json'), 'utf8'));
const model = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'model.json'), 'utf8'));
const tbm = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'template-block-mapping.json'), 'utf8'));
const log = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'fetch-log.json'), 'utf8'));
const { BLOCKS, TEMPLATES, INTEGS, ASSUMPTIONS, COUNTS } = model;

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cx = (c) => `<span class="cx cx-${c.replace(/\s/g, '')}">${esc(c)}</span>`;
const scopeBadge = (s) => { const cls = /Out of/.test(s) ? 'sc-out' : /Requires/.test(s) ? 'sc-conf' : 'sc-in'; return `<span class="scope ${cls}">${esc(s)}</span>`; };
const finalOf = Object.fromEntries(log.map((r) => [r.url, r.finalUrl || r.url]));
const redirectedSet = new Set(log.filter((r) => r.redirected).map((r) => r.url));
const pathByUrl = Object.fromEntries(pages.map((p) => [p.url, p.path]));
const templateOf = Object.fromEntries(ta.assign.map((a) => [a.path, a.template]));

// complexity per block name (for mapping table badges)
const blockCx = Object.fromEntries(BLOCKS.map((b) => [b.name, b.complexity]));

// order templates by page count desc for display
const tmplOrder = Object.entries(tbm).sort((a, b) => b[1].pageCount - a[1].pageCount).map(([t]) => t);

// ---------- renderers ----------
function kpi(n, l, alt) { return `<div class="kpi${alt ? ' alt' : ''}"><div class="n">${n}</div><div class="l">${l}</div></div>`; }

function urlRows() {
  // group by template
  return tmplOrder.map((tpl) => {
    const urls = tbm[tpl].urls;
    const rows = urls.map((pth) => {
      const p = pages.find((x) => x.path === pth);
      const url = p.url;
      const fin = finalOf[url];
      const red = redirectedSet.has(url);
      return `<tr>
        <td><a href="${esc(url)}" target="_blank" rel="noopener">${esc(pth)}</a>${red ? `<div class="redir">301 → ${esc(fin.replace('https://www.american-equity.com', '') || '/')}</div>` : ''}</td>
        <td>${esc(p.title)}</td>
        <td class="found">${esc(p.contentType || '—')}</td></tr>`;
    }).join('');
    return `<tr class="grp"><td colspan="3"><b>${esc(tpl)}</b> · ${urls.length} URL${urls.length > 1 ? 's' : ''}</td></tr>${rows}`;
  }).join('\n');
}

function blockRows() {
  return BLOCKS.map((b) => `<tr>
    <td><b>${esc(b.name)}</b>${b.global ? ' <span class="cbadge">global</span>' : ''}</td>
    <td class="num">${b.pages}</td>
    <td class="num">${b.variations.length}</td>
    <td>${cx(b.complexity)}</td>
    <td>${b.variations.map((v) => `<b>${esc(v[0])}</b> — ${esc(v[1])}`).join('<br>')}</td></tr>`).join('\n');
}

function mappingCards() {
  return tmplOrder.map((tpl) => {
    const d = tbm[tpl];
    const t = TEMPLATES.find((x) => x.name === tpl) || {};
    const blockEntries = Object.entries(d.blocks);
    const rows = blockEntries.map(([bn, bv]) => {
      const kindTag = bv.kind === 'global' ? ' <span class="kt kt-glob">global</span>' : '';
      const vs = Object.entries(bv.variations);
      const varText = vs.length ? vs.map(([vn, c]) => `${esc(vn)} <span class="vc">${c}</span>`).join(' · ') : '<span class="found">—</span>';
      const cxCell = blockCx[bn] ? cx(blockCx[bn]) : '<span class="found">n/a</span>';
      return `<tr>
        <td><b>${esc(bn)}</b>${kindTag}</td>
        <td class="num">${bv.pages}/${d.pageCount}</td>
        <td>${cxCell}</td>
        <td>${varText}</td></tr>`;
    }).join('');
    const embedNote = d.embeds
      ? `<div class="embed-note"><b>Third-party embed on this template (preserved, not rebuilt):</b> ${Object.entries(d.embeds).map(([e, c]) => `${esc(e)} <span class="vc">${c}</span>`).join(' · ')}</div>`
      : '';
    return `<div class="vblock">
      <h4>${esc(tpl)} <span class="found">· ${d.pageCount} page${d.pageCount > 1 ? 's' : ''} · complexity ${t.complexity ? esc(t.complexity) : '—'}</span></h4>
      <table class="mapt"><thead><tr><th>Block used on this template</th><th class="num">Pages</th><th>Block cx</th><th>Variation(s) observed <span class="found">(count = pages)</span></th></tr></thead>
      <tbody>${rows}</tbody></table>
      ${embedNote}
      <div class="urls">${d.urls.map((u) => { const pg = pages.find((x) => x.path === u); return `<a href="${esc(pg.url)}" target="_blank" rel="noopener">${esc(u)}</a>`; }).join('')}</div>
    </div>`;
  }).join('\n');
}

function integRows() {
  return INTEGS.map((i) => `<tr>
    <td><b>${esc(i.name)}</b></td>
    <td class="num">${i.pages}</td>
    <td>${esc(i.scope)}</td>
    <td>${esc(i.purpose)}</td>
    <td class="found">${esc(i.evidence)}</td>
    <td>${esc(i.eds)}</td></tr>`).join('\n');
}

function assumptionRows() {
  return ASSUMPTIONS.map((a) => `<tr><td><b>${esc(a[0])}</b></td><td>${esc(a[1])}</td><td>${esc(a[2])}</td><td>${scopeBadge(a[3])}</td></tr>`).join('\n');
}

// Other observations (derived facts)
const multiH1 = pages.filter((p) => p.h1count > 1).length;
const wistiaPages = pages.filter((p) => (p.structure.wistia || 0) > 0).length;
const resolverPages = pages.filter((p) => (p.structure.assetResolver || 0) > 0).length;
const OBS = [
  ['Platform', `Source is <b>Next.js (App Router / RSC)</b> on <b>Optimizely CMS (SaaS)</b>, server <code>envoy</code>. Blocks are identified from the site's own <code>data-component</code> attributes — the mapping below is read from the markup, not inferred.`],
  ['Redirects', `${COUNTS.redirects} of the ${COUNTS.uniqueUrls} input URLs are <b>301/308 redirects</b> to canonical in-scope pages (legacy <code>/annuities*</code>, <code>/incomeshield-annuity/*</code>, <code>/resources/blog/*</code>). These must be recreated in EDS redirect config for SEO parity.`],
  ['Client-hydrated lists', `The Insights feed and the form/document libraries render their lists <b>client-side</b> (empty in server HTML). In EDS these become index-backed listing blocks (query-index.json) with search/pagination — the main net-new data-modeling work.`],
  ['Asset resolver', `<code>/api/assets/resolve-by-key</code> (used on ${resolverPages} pages) is a <b>verified 301 asset resolver</b> to <code>asset.american-equity.com</code> (returns a PDF). It is a redirect/download service, <b>not custom application code</b> — reuse it.`],
  ['External authenticated apps', `Login (<code>myportal</code>) and registration (<code>register</code>, Okta) are separate applications on other subdomains, plus affiliate sites (<code>eagle-lifeco.com</code>, <code>ae-newyork.com</code>). EDS <b>links out</b>; it does not rebuild them.`],
  ['Video', `Wistia is the only on-page video (${wistiaPages} pages) via the <code>&lt;wistia-video&gt;</code> web component; YouTube appears only as outbound links in article text. Use a lazy facade + delayed script for Core Web Vitals.`],
  ['SEO / accessibility', `All ${COUNTS.uniqueUrls} pages carry meta descriptions and canonicals; <b>${multiH1} pages have more than one H1</b> — worth normalizing during migration. Preserve <code>data-gtm-*</code> tracking attributes on nav/CTAs for analytics parity.`],
  ['No CAPTCHA', `No reCAPTCHA/hCaptcha/Turnstile was found in American Equity's own markup. Any CAPTCHA would live inside vendor iframes (ion / Greenhouse) and is <b>not verifiable from the accessible page behavior</b>.`],
];

const totalBlockInstances = tmplOrder.reduce((n, t) => n + Object.keys(tbm[t].blocks).length, 0);

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>American Equity → EDS · Pre-Sales Report</title>
<style>
:root{--brand:#c8102e;--ink:#0b0f19;--edge:#e2e6ee;--blue:#1f4e9b;--muted:#5b6472;--navy:#0a2240}
*{box-sizing:border-box}
body{margin:0;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#f4f6fa}
header.hero{background:linear-gradient(135deg,#0a2240,#123a6b 60%,#1f4e9b);color:#fff;padding:44px 40px 38px}
header.hero h1{margin:0 0 8px;font-size:27px;letter-spacing:-.5px}
header.hero .sub{color:#c3d2ea;font-size:14.5px;max-width:960px}
header.hero .badge{display:inline-block;background:var(--brand);color:#fff;font-weight:700;padding:3px 11px;border-radius:5px;font-size:12px;margin-bottom:14px;letter-spacing:.5px}
nav.toc{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--edge);z-index:40;padding:10px 24px;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13px}
nav.toc a{color:var(--muted);text-decoration:none;white-space:nowrap}nav.toc a:hover{color:var(--blue)}
.wrap{max-width:1200px;margin:0 auto;padding:0 24px 70px}
section{background:#fff;border:1px solid var(--edge);border-radius:14px;padding:24px 28px;margin:20px 0;box-shadow:0 1px 3px rgba(10,15,25,.05)}
h2.sec{font-size:20px;margin:0 0 4px;padding-bottom:9px;border-bottom:3px solid var(--brand);display:inline-block}
h4{margin:16px 0 6px;font-size:15px}
.lead{color:#28303d;max-width:1000px;font-size:14px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin:18px 0}
.kpi{background:linear-gradient(160deg,#f8fafc,#eef2f9);border:1px solid var(--edge);border-radius:12px;padding:16px}
.kpi .n{font-size:25px;font-weight:800;color:var(--blue);line-height:1}
.kpi .l{font-size:11.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:6px}
.kpi.alt .n{color:var(--brand)}
table{border-collapse:collapse;width:100%;font-size:13px;margin:10px 0}
th,td{border:1px solid var(--edge);padding:7px 9px;text-align:left;vertical-align:top}
th{background:#f0f3f8;font-weight:700}
td.num,th.num{text-align:center;white-space:nowrap}
tr:nth-child(even){background:#fafbfd}
tr.grp td{background:#0a2240!important;color:#fff;font-weight:700}
tr.grp td b{color:#fff}
.found{color:var(--muted);font-size:11.5px}
.redir{color:#9a3412;font-size:11px;font-weight:600}
.cx{padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;display:inline-block}
.cx-Low{background:#dcfce7;color:#166534}.cx-Medium{background:#fef9c3;color:#854d0e}.cx-High{background:#ffedd5;color:#9a3412}.cx-VeryHigh{background:#ede9fe;color:#5b21b6}
.total-row td{background:#0a2240!important;color:#fff;font-weight:800}
.cbadge{display:inline-block;background:var(--blue);color:#fff;font-size:10px;font-weight:800;padding:1px 7px;border-radius:20px;margin-left:6px;text-transform:uppercase}
.kt{font-size:9.5px;font-weight:800;padding:1px 6px;border-radius:20px;text-transform:uppercase;letter-spacing:.2px;margin-left:4px}
.kt-def{background:#e5e7eb;color:#374151}.kt-emb{background:#fee2e2;color:#991b1b}.kt-glob{background:#e0e7ff;color:#3730a3}
.vc{display:inline-block;background:#eef2f9;border:1px solid #dfe6f1;color:#1a4bcc;font-size:10px;font-weight:800;padding:0 6px;border-radius:20px}
.scope{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;display:inline-block}
.sc-in{background:#dcfce7;color:#166534}.sc-out{background:#e5e7eb;color:#374151}.sc-conf{background:#fef3c7;color:#92400e}
.vblock{margin:14px 0;padding:12px 14px;border:1px solid var(--edge);border-radius:10px;background:#fbfcfe}
.vblock h4{margin:0 0 8px}
.mapt{margin:6px 0}
.urls{margin-top:8px}
.urls a{display:inline-block;background:#eef2f9;border:1px solid #dfe6f1;color:#1a4bcc;padding:2px 7px;border-radius:6px;margin:2px;font-size:11px;text-decoration:none}
.urls a:hover{background:var(--blue);color:#fff}
a{color:#1a4bcc}
.callout{background:#eff5ff;border-left:4px solid var(--blue);padding:10px 14px;border-radius:6px;font-size:13px;margin:12px 0}
.note{background:#fff8e6;border-left:4px solid #d99400;padding:10px 14px;border-radius:6px;font-size:13px;margin:12px 0}
.embed-note{background:#fef2f2;border-left:3px solid #dc2626;padding:6px 12px;border-radius:6px;font-size:12px;margin:6px 0}
.obs dt{font-weight:700;color:var(--navy);margin-top:10px}
.obs dd{margin:2px 0 0;font-size:13.5px}
.legend{font-size:12px;color:var(--muted);margin:8px 0}
.legend .kt{margin-left:0;margin-right:4px}
footer{text-align:center;color:var(--muted);font-size:12px;padding:24px}
@media print{nav.toc{display:none}section{break-inside:avoid;box-shadow:none}a{color:inherit}}
</style></head>
<body>
<header class="hero">
  <div class="badge">ADOBE EDGE DELIVERY SERVICES · PRE-SALES DISCOVERY REPORT</div>
  <h1>American-Equity.com → EDS · Blocks, Templates &amp; Block↔Template Mapping</h1>
  <div class="sub">A single, shareable pre-sales discovery of <code>www.american-equity.com</code> for migration to Adobe Edge Delivery Services. Every one of the <b>${COUNTS.uniqueUrls} in-scope URLs</b> was fetched and read individually (no sampling); the template↔block mapping is built from each page's own <code>data-component</code> markup. Source platform: <b>Next.js on Optimizely CMS</b>. Contains <b>no estimates, timelines, story points, or development days</b> — it is a structural scope-definition artifact.</div>
</header>
<nav class="toc">
  <a href="#summary">1 · Summary</a>
  <a href="#urls">2 · Analyzed URLs</a>
  <a href="#blocks">3 · Blocks &amp; Variations</a>
  <a href="#mapping">4 · Template ↔ Block Mapping</a>
  <a href="#integ">5 · Third-Party Integrations</a>
  <a href="#assume">6 · Assumptions &amp; Scope</a>
  <a href="#obs">7 · Other Observations</a>
</nav>
<div class="wrap">

<section id="summary">
<h2 class="sec">1 · Summary</h2>
<div class="kpis">
  ${kpi(COUNTS.uniqueUrls, 'URLs analyzed')}
  ${kpi(COUNTS.distinctRendered, 'Distinct pages')}
  ${kpi(COUNTS.templates, 'Templates', true)}
  ${kpi(COUNTS.blocks, 'Blocks', true)}
  ${kpi(COUNTS.variations, 'Variations', true)}
  ${kpi(COUNTS.forms, 'Forms')}
  ${kpi(COUNTS.integrations, 'Integrations')}
  ${kpi(COUNTS.grayAreas, 'Open questions')}
</div>
<p class="lead">American Equity is a marketing/content site on <b>Optimizely CMS</b> with a <b>Next.js</b> front end. Because the DOM labels every component with a <code>data-component</code> name, block boundaries and their placement per template are read directly from the markup rather than guessed. All ${COUNTS.uniqueUrls} URLs returned HTTP 200; ${COUNTS.redirects} are legacy 301/308 redirects to canonical pages, leaving <b>${COUNTS.distinctRendered} distinct rendered pages</b> across <b>${COUNTS.templates} templates</b>.</p>
<div class="callout"><b>What this report gives pre-sales:</b> (2) the exact list of URLs analyzed with live links, (3) the ${COUNTS.blocks} reusable blocks with their variations and complexity, (4) a per-template <b>block↔variation mapping</b> showing which blocks appear on each template and how many pages use each variation, (5) verified third-party integrations, (6) assumptions &amp; scope boundaries, and (7) other technical observations. The heavier items are the Tabs block, the client-hydrated listings (Insights + form/document libraries), and third-party embeds that are preserved rather than rebuilt.</div>
</section>

<section id="urls">
<h2 class="sec">2 · URLs Analyzed (all ${COUNTS.uniqueUrls}, grouped by template)</h2>
<p class="lead">Every input URL (links open the live page). Input file had ${COUNTS.inputLines} lines — 1 duplicate (<code>/IncomeShield</code>) removed → ${COUNTS.uniqueUrls} unique URLs, all HTTP 200. Redirecting URLs show their canonical target.</p>
<table><thead><tr><th>URL (click to open)</th><th>Page title</th><th>Content type</th></tr></thead>
<tbody>${urlRows()}</tbody></table>
</section>

<section id="blocks">
<h2 class="sec">3 · Blocks &amp; Variations with Complexity</h2>
<p class="lead"><b>${COUNTS.blocks} blocks</b> (${COUNTS.contentBlocks} content + ${COUNTS.globalBlocks} global) · <b>${COUNTS.variations} variations</b>. A variation is counted only for a real structural/behavioral/authoring/technical difference — never content/image/text differences. "Pages" = number of the ${COUNTS.uniqueUrls} URLs where the block appears.</p>
<table>
<thead><tr><th>Block</th><th class="num">Pages</th><th class="num">Var.</th><th>Complexity</th><th>Variations (what differs)</th></tr></thead>
<tbody>
${blockRows()}
<tr class="total-row"><td>TOTAL — ${COUNTS.blocks} blocks</td><td class="num">—</td><td class="num">${COUNTS.variations}</td><td>—</td><td></td></tr>
</tbody></table>
</section>

<section id="mapping">
<h2 class="sec">4 · Template ↔ Block ↔ Variation Mapping</h2>
<p class="lead">Built by reading the <code>data-component</code> markup of <b>all ${COUNTS.uniqueUrls} pages</b>. For each of the ${COUNTS.templates} templates: the blocks that appear on it, how many of the template's pages use each block, the block's complexity, and each variation with its page count. Only the ${COUNTS.blocks} real blocks are listed (<span class="kt kt-glob">global</span> = site chrome built once); default content (prose, images, buttons, download links) is handled by core decoration and is not listed. Any third-party embed on a template is called out in a note under its table.</p>
${mappingCards()}
<div class="note"><b>Reading the counts:</b> "Pages" is <i>x/y</i> = pages of that template using the block. A block can carry several variations on one template — e.g. consumer product pages use <b>both</b> horizontal and vertical tab orientations. Only the ${COUNTS.contentBlocks} content + ${COUNTS.globalBlocks} global blocks are bespoke EDS build items.</div>
</section>

<section id="integ">
<h2 class="sec">5 · Third-Party Integrations (verified)</h2>
<p class="lead"><b>${COUNTS.integrations} integrations</b> confirmed by on-page evidence. "Pages" = pages where observed. Facebook/LinkedIn appear only as footer social <i>links</i> (not tracking pixels) and are therefore excluded.</p>
<table>
<thead><tr><th>Integration</th><th class="num">Pages</th><th>Scope</th><th>Purpose</th><th>Evidence</th><th>EDS consideration</th></tr></thead>
<tbody>${integRows()}</tbody></table>
</section>

<section id="assume">
<h2 class="sec">6 · Assumptions &amp; Scope Boundaries</h2>
<table>
<thead><tr><th>Assumption</th><th>Observed basis</th><th>How we treat it</th><th>Scope</th></tr></thead>
<tbody>${assumptionRows()}</tbody></table>
</section>

<section id="obs">
<h2 class="sec">7 · Other Observations</h2>
<dl class="obs">
${OBS.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${d}</dd>`).join('\n')}
</dl>
</section>

<footer>American Equity → EDS · Pre-sales discovery report · Generated 2026-08-13 · All findings evidence-based from live page markup · No estimates/timelines/story points by design.</footer>
</div>
</body></html>`;

fs.writeFileSync(path.join(AE, 'pre-sales-report.html'), html);
console.log('Wrote american-equity/pre-sales-report.html', (html.length / 1024).toFixed(1) + 'KB');
console.log('Templates mapped:', tmplOrder.length, '| block-instances across templates:', totalBlockInstances);
