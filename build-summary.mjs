// Build the American Equity → EDS executive summary (self-contained HTML).
// Mirrors the BRP summary layout, but contains NO estimates/timelines/story points/days.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const AE = path.join(ROOT, 'american-equity');
const model = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'model.json'), 'utf8'));
const ta = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'template-assignment.json'), 'utf8'));
const { BLOCKS, TEMPLATES, INTEGS, COUNTS } = model;
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cx = (c) => `<span class="cx cx-${c.replace(/\s/g, '')}">${c}</span>`;

const blockRows = BLOCKS.map((b) => `<tr><td><b>${esc(b.name)}</b>${b.global ? ' <span class="cbadge">global</span>' : ''}</td><td class="num">${b.pages}</td><td class="num">${b.variations.length}</td><td>${cx(b.complexity)}</td></tr>`).join('');
const tmplRows = TEMPLATES.map((t) => { const d = ta.templates[t.name] || { pages: 0 }; return `<tr><td><b>${esc(t.name)}</b></td><td class="num">${d.pages}</td><td class="num">${((d.pages / COUNTS.uniqueUrls) * 100).toFixed(1)}%</td><td>${cx(t.complexity)}</td></tr>`; }).join('');
const integRows = INTEGS.map((i) => `<tr><td><b>${esc(i.name)}</b></td><td class="num">${i.pages}</td><td>${esc(i.scope)}</td><td>${esc(i.purpose)}</td></tr>`).join('');

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>American Equity → EDS · Discovery Summary</title>
<style>
:root{--brand:#c8102e;--ink:#0b0f19;--edge:#e2e6ee;--blue:#1f4e9b;--muted:#5b6472;--navy:#0a2240}
*{box-sizing:border-box}
body{margin:0;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#f4f6fa}
header.hero{background:linear-gradient(135deg,#0a2240,#123a6b 60%,#1f4e9b);color:#fff;padding:44px 40px 38px}
header.hero h1{margin:0 0 8px;font-size:27px;letter-spacing:-.5px}
header.hero .sub{color:#c3d2ea;font-size:14.5px;max-width:900px}
header.hero .badge{display:inline-block;background:var(--brand);color:#fff;font-weight:700;padding:3px 11px;border-radius:5px;font-size:12px;margin-bottom:14px;letter-spacing:.5px}
nav.toc{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--edge);z-index:40;padding:10px 24px;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13px}
nav.toc a{color:var(--muted);text-decoration:none;white-space:nowrap}nav.toc a:hover{color:var(--blue)}
.wrap{max-width:1140px;margin:0 auto;padding:0 24px 70px}
section{background:#fff;border:1px solid var(--edge);border-radius:14px;padding:24px 28px;margin:20px 0;box-shadow:0 1px 3px rgba(10,15,25,.05)}
h2.sec{font-size:20px;margin:0 0 4px;padding-bottom:9px;border-bottom:3px solid var(--brand);display:inline-block}
.lead{color:#28303d;max-width:900px;font-size:14px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:18px 0}
.kpi{background:linear-gradient(160deg,#f8fafc,#eef2f9);border:1px solid var(--edge);border-radius:12px;padding:16px}
.kpi .n{font-size:25px;font-weight:800;color:var(--blue);line-height:1}
.kpi .l{font-size:11.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:6px}
.kpi.alt .n{color:var(--brand)}
table{border-collapse:collapse;width:100%;font-size:13px;margin:10px 0}
th,td{border:1px solid var(--edge);padding:7px 9px;text-align:left;vertical-align:top}
th{background:#f0f3f8;font-weight:700}
td.num,th.num{text-align:center;white-space:nowrap}
tr:nth-child(even){background:#fafbfd}
.cx{padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;display:inline-block}
.cx-Low{background:#dcfce7;color:#166534}.cx-Medium{background:#fef9c3;color:#854d0e}.cx-High{background:#ffedd5;color:#9a3412}.cx-VeryHigh{background:#ede9fe;color:#5b21b6}
.total-row td{background:#0a2240!important;color:#fff;font-weight:800}
.cbadge{display:inline-block;background:var(--blue);color:#fff;font-size:10px;font-weight:800;padding:1px 7px;border-radius:20px;margin-left:6px;text-transform:uppercase}
.evidence{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.evidence a{font-size:12px;background:#eef2f9;border:1px solid #dfe6f1;color:#1a4bcc;padding:4px 11px;border-radius:20px;text-decoration:none;font-weight:600}
.evidence a:hover{background:var(--blue);color:#fff}
.assume li{font-size:13px;margin:4px 0}
.note{background:#fff8e6;border-left:4px solid #d99400;padding:10px 14px;border-radius:6px;font-size:13px;margin:12px 0}
footer{text-align:center;color:var(--muted);font-size:12px;padding:24px}
@media print{nav.toc{display:none}section{break-inside:avoid;box-shadow:none}}
</style></head>
<body>
<header class="hero">
  <div class="badge">ADOBE EDGE DELIVERY SERVICES · DISCOVERY SUMMARY</div>
  <h1>American-Equity.com → EDS · Discovery Summary</h1>
  <div class="sub">Structural discovery of <code>www.american-equity.com</code> for migration to Adobe Edge Delivery Services, based on inspection of <b>all ${COUNTS.uniqueUrls} in-scope URLs</b>. Source platform: <b>Next.js on Optimizely CMS</b>. This is a scope-definition summary — it contains <b>no estimates, timelines, story points, or development days</b>.</div>
</header>
<nav class="toc">
  <a href="#top">Top-line</a>
  <a href="#blocks">Blocks &amp; Variations</a>
  <a href="#templates">Templates</a>
  <a href="#integ">Integrations</a>
  <a href="#scope">Scope Boundaries</a>
  <a href="#evidence">Evidence</a>
</nav>
<div class="wrap">

<section id="top">
<h2 class="sec">Top-line</h2>
<div class="kpis">
  <div class="kpi"><div class="n">${COUNTS.uniqueUrls}</div><div class="l">URLs analyzed</div></div>
  <div class="kpi"><div class="n">${COUNTS.distinctRendered}</div><div class="l">Distinct pages</div></div>
  <div class="kpi alt"><div class="n">${COUNTS.blocks}</div><div class="l">Blocks</div></div>
  <div class="kpi alt"><div class="n">${COUNTS.variations}</div><div class="l">Variations</div></div>
  <div class="kpi alt"><div class="n">${COUNTS.templates}</div><div class="l">Templates</div></div>
  <div class="kpi"><div class="n">${COUNTS.forms}</div><div class="l">Forms</div></div>
  <div class="kpi"><div class="n">${COUNTS.integrations}</div><div class="l">Integrations</div></div>
  <div class="kpi"><div class="n">${COUNTS.grayAreas}</div><div class="l">Open questions</div></div>
</div>
<p class="lead">The site is standard marketing/content composition with clean, self-describing components (<code>data-component</code>). The higher-complexity areas are dynamic listings (insights feed, searchable form/document libraries), the tabbed line-feature block, and third-party embeds (ion forms, Hedgeness calculator, Greenhouse jobs) that should be preserved rather than rebuilt.</p>
</section>

<section id="blocks">
<h2 class="sec">1 · Blocks &amp; Variations</h2>
<p class="lead"><b>${COUNTS.blocks} blocks</b> (${COUNTS.contentBlocks} content + ${COUNTS.globalBlocks} global) · <b>${COUNTS.variations} variations</b>. Variations reflect real structural/behavioral/authoring/technical differences only.</p>
<table><thead><tr><th>Block</th><th class="num">Pages</th><th class="num">Variations</th><th>Complexity</th></tr></thead>
<tbody>${blockRows}
<tr class="total-row"><td>TOTAL — ${COUNTS.blocks} blocks</td><td class="num">—</td><td class="num">${COUNTS.variations}</td><td>—</td></tr></tbody></table>
<div class="evidence"><a href="index.html#blocks" target="_blank">▸ Blocks &amp; variations (detail)</a><a href="index.html#blockdetail" target="_blank">▸ Variation deep-dive</a><a href="data/model.json" target="_blank">▸ model.json</a></div>
</section>

<section id="templates">
<h2 class="sec">2 · Templates</h2>
<p class="lead"><b>${COUNTS.templates} templates</b> across ${COUNTS.uniqueUrls} URLs, grouped by block composition (not URL pattern).</p>
<table><thead><tr><th>Template</th><th class="num">Pages</th><th class="num">% Site</th><th>Complexity</th></tr></thead>
<tbody>${tmplRows}
<tr class="total-row"><td>TOTAL — ${COUNTS.templates} templates</td><td class="num">${COUNTS.uniqueUrls}</td><td class="num">100%</td><td>—</td></tr></tbody></table>
<div class="evidence"><a href="index.html#templates" target="_blank">▸ Template inventory + URL mapping</a></div>
</section>

<section id="integ">
<h2 class="sec">3 · Third-Party Integrations</h2>
<p class="lead"><b>${COUNTS.integrations} verified integrations</b>. "Pages" = pages where observed.</p>
<table><thead><tr><th>Integration</th><th class="num">Pages</th><th>Scope</th><th>Purpose</th></tr></thead>
<tbody>${integRows}</tbody></table>
<div class="evidence"><a href="index.html#integ" target="_blank">▸ Integration detail + evidence</a><a href="index.html#external" target="_blank">▸ Redirects / APIs / external</a></div>
</section>

<section id="scope">
<h2 class="sec">4 · Scope Boundaries (key assumptions)</h2>
<ul class="assume">
<li><b>External authenticated apps are out of scope</b> — login (<code>myportal</code>) and register (<code>register</code>, Okta) are separate applications; EDS links to them, does not rebuild them.</li>
<li><b>External portals/affiliates linked, not rebuilt</b> — <code>eagle-lifeco.com</code>, <code>ae-newyork.com</code> remain external links.</li>
<li><b>Externally hosted PDFs/assets stay external</b> — <code>asset.american-equity.com</code> DAM; reference as-is unless re-hosting is explicitly required.</li>
<li><b>Asset resolver reused, not rebuilt</b> — <code>/api/assets/resolve-by-key</code> is a verified 301 redirect service, not custom application code.</li>
<li><b>Third-party platforms stay external</b> — ion interactive, Hedgeness, Greenhouse are preserved as embeds; vendor apps remain authoritative.</li>
<li><b>Content differences do not create variations</b>; only material structural/behavioral/authoring/technical differences do.</li>
<li><b>Analytics re-instated as observed</b> (GTM/GA4/Optimizely Web/OneTrust); new tracking or data-layer work would be separate.</li>
</ul>
<div class="note"><b>Open items to confirm with AE:</b> whether <code>/form</code> is a live native form or a demo; whether Optimizely Experimentation stays; the Insights feed taxonomy/data model; whether any DAM assets must be re-hosted; and the global search provider. See the full report §8 (Gray Areas).</div>
</section>

<section id="evidence">
<h2 class="sec">5 · Evidence &amp; Detailed Report</h2>
<p class="lead">This summary is backed by the following deliverables in the <code>american-equity/</code> folder:</p>
<div class="evidence">
  <a href="index.html" target="_blank">▸ Full discovery report (10 sections, all ${COUNTS.uniqueUrls} URLs)</a>
  <a href="data/pages.json" target="_blank">◦ pages.json — per-page extraction</a>
  <a href="data/aggregates.json" target="_blank">◦ aggregates.json — components/integrations</a>
  <a href="data/template-assignment.json" target="_blank">◦ template-assignment.json — URL→template</a>
  <a href="data/model.json" target="_blank">◦ model.json — curated blocks/templates/forms</a>
  <a href="data/fetch-log.json" target="_blank">◦ fetch-log.json — status &amp; redirects</a>
</div>
</section>

<footer>American Equity → EDS discovery summary · Generated 2026-08-13 · No estimates/timelines/story points included by design.</footer>
</div>
</body></html>`;

fs.writeFileSync(path.join(AE, 'summary.html'), html);
console.log('Wrote american-equity/summary.html', (html.length / 1024).toFixed(1) + 'KB');
