// Build the American Equity → EDS MIGRATION DISCOVERY report (single self-contained HTML).
// Perspective: what it takes to migrate this site to EDS — for estimation & customer discussion.
// Sections: Summary · Analyzed URLs · EDS Block Inventory · Templates · Template↔Block Mapping ·
// Forms · Third-Party Integrations · Redirects/APIs/External · Assumptions & Scope · Other Observations.
// NO estimates / timelines / story points / dev-days (structural discovery only).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT = path.join(ROOT, 'american-equity-report');
const pages = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'pages.json'), 'utf8'));
const agg = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'aggregates.json'), 'utf8'));
const tbm = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'template-block-mapping.json'), 'utf8'));
const log = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'fetch-log.json'), 'utf8'));

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cx = (c) => `<span class="cx cx-${c.replace(/\s/g, '')}">${esc(c)}</span>`;
const scopeBadge = (s) => { const cls = /Out of/.test(s) ? 'sc-out' : /Confirm|Requires/.test(s) ? 'sc-conf' : 'sc-in'; return `<span class="scope ${cls}">${esc(s)}</span>`; };
const finalOf = Object.fromEntries(log.map((r) => [r.url, r.finalUrl || r.url]));
const redirected = new Set(log.filter((r) => r.redirected).map((r) => r.url));
const pageByPath = Object.fromEntries(pages.map((p) => [p.path, p]));
const inputLines = fs.readFileSync(path.join(ROOT, 'american-equity.txt'), 'utf8').split('\n').filter((l) => l.trim()).length;
const distinctFinal = new Set(log.map((r) => r.finalUrl || r.url)).size;
const redirects = log.filter((r) => r.redirected).length;

// ---------------- CURATED EDS BLOCK INVENTORY ----------------
// pages = # of 74 URLs where the block appears. effort = build-relative complexity (Low/Medium/High).
const BLOCKS = [
  { name: 'Hero (In-Page Intro Band)', pages: 74, complexity: 'Medium', global: false,
    variations: [['Standard Hero', 'Heading + subcopy + optional image/CTA (73 pages)'], ['Article Hero', 'Adds author / date / read-time metadata (4 pages)'], ['Simple Hero', 'Minimal heading-only (form template, 1 page)']],
    behavior: 'First content band inside <main> — background image/color, eyebrow, heading, subcopy, CTA. Distinct from the global navigation header.',
    eds: 'One hero block with a variant class (hero / hero.article). Author supplies image, heading, CTA; image via EDS optimized <picture>.' },
  { name: 'Feature Cards & Media', pages: 36, complexity: 'Medium', global: false,
    variations: [['Media + copy row', 'Alternating image/text bands with optional CTA (36 pages)'], ['Icon card grid', 'Grid of icon + heading + text (18 pages)'], ['Image card grid', 'Grid of image + heading + text/link (21 pages)'], ['3-set image feature', 'Three-up image feature grouping (1 page)']],
    behavior: 'The workhorse marketing block. Media side, background and column count are authoring options. Icon vs image is a real media/structural difference.',
    eds: 'Single cards/columns block with media-row, icon-card, image-card variants; responsive grid by card count.' },
  { name: 'Tabs (Tabbed Content)', pages: 17, complexity: 'High', global: false,
    variations: [['Horizontal tabs', 'Tab strip on top; tab → panel (13 pages)'], ['Vertical tabs', 'Tab list on the side; tab → panel (4 pages)']],
    behavior: 'Interactive client-side tab switching with card panels. Horizontal vs vertical differ in layout + interaction.',
    eds: 'Tabs block with orientation variant; JS decoration for tab state, ARIA tablist/tabpanel, keyboard nav, deep-link anchors.' },
  { name: 'Progress Bar / Stepper', pages: 10, complexity: 'Medium', global: false,
    variations: [['Numbered step sequence', 'Ordered “how it works / next steps” 3–5 steps (10 pages)']],
    behavior: 'Presentational stepped sequence (not a form wizard). Each step = number/icon + heading + text.',
    eds: 'Static stepper block; CSS connectors, no state machine.' },
  { name: 'Video (Wistia)', pages: 14, complexity: 'Medium', global: false,
    variations: [['Inline Wistia video', 'Wistia web component (<wistia-video>) + poster + heading/copy (14 pages)']],
    behavior: 'Wistia player web-component + Wistia embed script. YouTube appears only as outbound links, not embeds.',
    eds: 'Video block with lazy facade → Wistia embed loaded in delayed phase for Core Web Vitals; keep Wistia media IDs.' },
  { name: 'Metrics / Stats', pages: 4, complexity: 'Low', global: false,
    variations: [['Stat row', 'Large-number + label KPI row (financial-strength, about) (4 pages)']],
    behavior: 'Static numeric highlights; no data source/animation observed.',
    eds: 'Simple stats block; author-entered numbers.' },
  { name: 'Accordion / Disclosure', pages: 43, complexity: 'Medium', global: false,
    variations: [['FAQ accordion', 'Multi-item expand/collapse Q&A (6 pages)'], ['Disclosure / legal expander', 'Collapsible fine-print / disclaimer (42 pages)']],
    behavior: 'Both expand/collapse; accordion = multi-item FAQ, disclosure = single legal expander. Distinct authoring purpose + placement.',
    eds: 'Accordion block with a disclosure variant; ARIA disclosure pattern, keyboard support.' },
  { name: 'Blog Card / Related Posts', pages: 34, complexity: 'Medium', global: false,
    variations: [['Related posts strip', 'Auto-populated related/insights cards at article foot (30 pages)'], ['Editorial card grid', 'Curated card links to insight articles (within 34 pages)']],
    behavior: 'Related-posts is data-driven (pulls related Insights by taxonomy); cards render title/image/excerpt/link.',
    eds: 'Card block + a query-driven variant backed by an EDS index (query-index.json); related logic depends on content taxonomy.' },
  { name: 'Dynamic Content Listing (Insights index)', pages: 4, complexity: 'High', global: false,
    variations: [['Client-fetched paginated feed', 'Insights feed with pagination; SSR renders shell, list hydrates client-side (/insights + 3 legacy redirects)']],
    behavior: 'Paginated article feed fetched/rendered client-side (empty in server HTML). Category/feed driven.',
    eds: 'Listing block backed by an EDS index with pagination + filtering; the main net-new data-modeling work.' },
  { name: 'Searchable Form / Document Library', pages: 4, complexity: 'High', global: false,
    variations: [['Search + category tabs', 'Consumer /forms & /professionals/document-library (3 pages)'], ['Table directory', 'Professionals /forms-library (1 page)']],
    behavior: 'NOT a data-entry form — a searchable/filterable directory of downloadable service forms/documents. Rows link to PDFs on the DAM (via the asset resolver). The list hydrates client-side (empty SSR shell).',
    eds: 'Listing block with client search/filter over an EDS index (tabbed vs table variant); result links resolve to the existing DAM. Needs a document data model + search UX.' },
  { name: 'Native Data-Entry Form', pages: 1, complexity: 'High', global: false,
    variations: [['Native form', 'Only true HTML <form> on the site — text inputs, select, textarea, submit (/form)']],
    behavior: 'An actual data-collection form (component formInputModel). On /form the labels are placeholders ("Form title/description") and no submit endpoint is present in server HTML — looks like a template/sample, not a wired-up production form.',
    eds: 'Build as an EDS form block (or AEM Forms) ONCE the field model, validation and submit endpoint are confirmed with AE. Flagged in Assumptions/Gray areas.' },
  { name: 'Contact Card / Row', pages: 2, complexity: 'Low', global: false,
    variations: [['Contact cards', 'Phone/email/dept cards with tel:/mailto: (contact-us, professionals/contact-us)']],
    behavior: 'Static contact detail cards.',
    eds: 'Cards variant; author-entered contact info.' },
  { name: 'Modal / Dialog', pages: 1, complexity: 'Medium', global: false,
    variations: [['General modal', 'Overlay dialog triggered from content (professionals landing)']],
    behavior: 'Accessible overlay dialog; focus trap + ARIA dialog semantics.',
    eds: 'Modal util/block; opened from a trigger link.' },
  { name: 'Global Header / Navigation (site chrome)', pages: 74, complexity: 'High', global: true,
    variations: [['Mega-menu header', '4 top-level menus (About Us, Annuities, Retirement Resources, Support) + dropdown panels + utility menu (Login/Register/Search) + Find an Agent']],
    behavior: 'Site navigation in <header>/<nav>: desktop mega-menu, mobile drawer, utility links out to the login/register subdomains. Built once for the whole site.',
    eds: 'Standard EDS header block from a nav document; mega-menu panels + mobile drawer. External utility links (Login/Register) preserved as links.' },
  { name: 'Global Footer', pages: 74, complexity: 'Medium', global: true,
    variations: [['Multi-column footer', 'Nav columns + social links + legal/disclosure + logo (~10 link columns)']],
    behavior: 'Static multi-column footer with social + legal links and rich disclosure text. GTM tracking attributes.',
    eds: 'Standard EDS footer block from a footer document.' },
  { name: 'Breadcrumb', pages: 51, complexity: 'Low', global: true,
    variations: [['Breadcrumb trail', 'Interior-page breadcrumb (aria-label="Breadcrumb navigation")']],
    behavior: 'Path breadcrumb on interior pages; absent on home, /professionals and Insights articles.',
    eds: 'Breadcrumb block/auto-block derived from path or metadata.' },
];
const blockCx = Object.fromEntries(BLOCKS.map((b) => [b.name, b.complexity]));
const contentBlocks = BLOCKS.filter((b) => !b.global).length;
const globalBlocks = BLOCKS.filter((b) => b.global).length;
const totalVariations = BLOCKS.reduce((n, b) => n + b.variations.length, 0);
const cxCount = BLOCKS.reduce((m, b) => { m[b.complexity] = (m[b.complexity] || 0) + 1; return m; }, {});

// ---------------- TEMPLATES ----------------
const TEMPLATES = {
  'Article (Insight / Blog)': { complexity: 'Medium', note: 'Editorial article. Prose is default content; blocks are hero + related posts + disclosure. Two content-driven sub-shapes (full editorial vs lightweight).' },
  'Product / Annuity (Consumer)': { complexity: 'High', note: 'Richest consumer composition: hero + tabs (both orientations) + stepper + Wistia video + feature cards + FAQ + related posts. AssetShield/EstateShield/GuaranteeShield/IncomeShield + our-annuities.' },
  'Product / Annuity (Professional)': { complexity: 'High', note: 'Mirrors consumer shape and adds tabbed groups of downloadable resource cards (DAM links, handled as authored downloads).' },
  'Section Landing / Hub': { complexity: 'Medium', note: 'Marketing hubs (about, community, financial-strength, professionals, resources). Same palette, composition varies by hub.' },
  'Content Listing (Dynamic)': { complexity: 'High', note: '/insights + 3 legacy redirects. Client-hydrated paginated feed → needs an EDS index + pagination.' },
  'Form / Document Listing': { complexity: 'High', note: 'Heterogeneous: searchable document libraries (/forms, document-library, forms-library), the native /form, and the ion-embedded material-request-form.' },
  'Careers': { complexity: 'Medium', note: 'careers hub + why-work-here + internship-program (marketing) and openings (Greenhouse job-board embed).' },
  'Tool / Calculator (Embed)': { complexity: 'High', note: 'income-gap-calculator (consumer + professional) embed the third-party Hedgeness widget; hub page is a tool index.' },
  Contact: { complexity: 'Low', note: 'contact-us (consumer) and professionals/contact-us (also embeds an ion contact form).' },
  'Legal / Utility': { complexity: 'Low', note: 'Prose is default content. privacy, terms, accessibility, security-disclosure, patriot-act, sms-privacy, job-applicant-privacy, naic-statutory-financial-statements.' },
  Home: { complexity: 'High', note: 'Single homepage; densest marketing composition.' },
};

// ---------------- FORMS ----------------
const FORMS = [
  ['Material Request Form', '/professionals/material-request-form', 'Third-party embedded (ion interactive)', 'Owned by ion app', 'Posts within ion (experience.american-equity.com)', 'Preserve the ion embed via an embed/script block. EDS integrates it the same way it is today — the vendor app stays authoritative. Not rebuilt natively unless AE requests it.'],
  ['Income Gap Calculator', '/income-gap-calculator · /professionals/tools-calculators/income-gap-calculator', 'Third-party embedded (Hedgeness widget)', 'Owned by Hedgeness widget', 'Client-side calc in vendor widget', 'Preserve via embed/script block (mount aelWidget.js into #hedgenessWidget). Same integration model as today.'],
  ['Job Openings / Application', '/about/careers/openings', 'Third-party embedded (Greenhouse ATS)', 'Owned by Greenhouse', 'Greenhouse ATS (boards.greenhouse.io)', 'Preserve Greenhouse embed via embed/script block. Applications stay in Greenhouse.'],
  ['Professional Contact Form', '/professionals/contact-us', 'Third-party embedded (ion interactive)', 'Owned by ion app', 'ion interactive', 'Preserve ion embed; static contact cards are a native cards block.'],
  ['Native Form Template', '/form', 'Native (formInputModel) — appears to be a template/sample', 'noValidate on <form>; client validation unconfirmed', 'No submit endpoint in server HTML — not verifiable', 'Only true native form. Build an EDS/AEM form ONLY after AE confirms it is live and provides field model + submit endpoint.'],
  ['Forms / Document Search', '/forms · /professionals/document-library · /professionals/forms-library', 'Searchable listing (client-hydrated) — not a submission form', 'n/a (search UI)', 'No submission; rows link to DAM PDFs', 'Listing block over an EDS index; not a data-collection form.'],
];

// ---------------- INTEGRATIONS ----------------
const INTEGS = [
  ['Google Tag Manager', 74, 'Site-wide', 'Tag management container (GTM-MZDFLT8W); loads GA4 & other tags', 'GTM script + GTM-MZDFLT8W on every page', 'Re-add via delayed.js with the same container ID; preserve data-gtm-* attributes on links/CTAs for tracking parity.'],
  ['Google Analytics 4 (via GTM)', 74, 'Site-wide', 'Web analytics', 'gtag() present; GA4 fires through GTM (no standalone G- id in markup)', 'Ships through GTM — no separate work. Custom events/data-layer changes out of scope unless requested.'],
  ['OneTrust (consent)', 74, 'Site-wide', 'Cookie consent / privacy banner', 'cdn.cookielaw.org + data-domain-script="019aa2c6-…-a83a0e6bf1ab"', 'Load in delayed phase with the same domain-script id; consent must gate tag firing.'],
  ['Optimizely CMS (SaaS)', 74, 'Platform (source)', 'Current CMS behind the Next.js front end', 'app-*.cms.optimizely.com + opti-content-area DOM', 'This is the source system being migrated FROM. Content re-authored into EDS documents; not an ongoing runtime integration.'],
  ['Optimizely Web / Experimentation', 74, 'Site-wide', 'A/B testing & experimentation snippet', 'cdn.optimizely.com/js/5000773591891968.js on every page', 'Re-add via delayed.js IF AE keeps Optimizely Experiment. Confirm active usage — treat as optional.'],
  ['Wistia (video)', 14, 'Page-specific', 'Hosted video player', '<wistia-video> web component + videoType:"wistia"', 'Video block with lazy facade → Wistia embed in delayed phase. Keep Wistia media IDs.'],
  ['ion interactive (Scribble) — forms', 2, 'Page-specific', 'Interactive forms hosted externally', 'scribblecdn.net/ionizer + data-ion-embed-hash → experience.american-equity.com', 'Preserve via embed/script block. Vendor app authoritative for form logic + submission. Same integration model in EDS.'],
  ['Hedgeness (calculator)', 2, 'Page-specific', 'Income-gap calculator widget', 'ael.hedgenessapp.com/aelWidget.js → #hedgenessWidget', 'Preserve via embed/script block. Calculator logic stays in vendor widget.'],
  ['Greenhouse (job board / ATS)', 1, 'Page-specific', 'Job board / applications', 'boards.greenhouse.io/embed/job_board/js → #grnhse_app', 'Preserve via embed/script block. ATS stays external.'],
  ['YouTube (outbound links only)', 5, 'Page-specific', 'Linked videos in article text', 'youtube.com/watch links in rich text; NOT an on-page embed', 'No player integration needed — links only. Add a lite-YouTube facade only if an embed is later desired.'],
];

// ---------------- EXTERNAL / REDIRECTS / APIS ----------------
const EXTERNAL = [
  ['/api/assets/resolve-by-key?key=… (17 pages, ~81 links)', 'Asset resolver → 301 to asset.american-equity.com/download/… (verified: returns application/pdf)', 'EDS links must keep resolving to the DAM download.', 'REUSE the resolver or link the final asset URL directly. Simple redirect/asset service — NOT custom EDS development.'],
  ['asset.american-equity.com/download/… (site-wide)', 'DAM download host for PDFs/brochures/statements', 'Externally hosted documents must stay reachable.', 'Keep DAM external; reference assets as-is. Re-host into EDS/DAM only if AE explicitly requires it.'],
  ['myportal.american-equity.com ("Login", 74 pages)', 'Customer login portal — separate application (login page)', 'Header/footer "Login" must link out.', 'PRESERVE link. Out of EDS scope — authentication is NOT rebuilt.'],
  ['register.american-equity.com ("Register", 74 pages)', 'Registration app (Okta-backed)', 'Header "Register" must link out.', 'PRESERVE link. Out of EDS scope.'],
  ['experience.american-equity.com', 'Host for ion interactive form pages (embedded)', 'ion embeds must keep loading from here.', 'PRESERVE embeds; external app authoritative.'],
  ['eagle-lifeco.com, ae-newyork.com (site-wide footer)', 'Affiliate / subsidiary company sites', 'Footer/nav links to affiliates.', 'PRESERVE external links.'],
  ['ambest.com, fitchratings.com, spglobal.com (financial-strength)', 'Ratings-agency references / links', 'Outbound links to ratings sources.', 'PRESERVE external links.'],
  ['10 legacy URLs → 301/308', 'Redirect map (/annuities*, /incomeshield-annuity/how-it-works, /resources/blog/*) → canonical pages', 'SEO redirect parity at launch.', 'Recreate these redirects in EDS redirect config so legacy URLs keep resolving.'],
];

// ---------------- ASSUMPTIONS ----------------
const ASSUMPTIONS = [
  ['Login / Register redirect to subdomains — OUT OF SCOPE', 'Header/footer "Login" → myportal.american-equity.com and "Register" → register.american-equity.com (Okta) on all 74 pages.', 'EDS preserves these as outbound links to the existing subdomains/applications; the authenticated apps are NOT rebuilt or migrated.', 'Out of Scope'],
  ['External authenticated apps & portals stay external', 'Customer portal, registration, affiliate sites (eagle-lifeco, ae-newyork) are separate apps/domains.', 'Linked out from EDS; no reimplementation.', 'Out of Scope'],
  ['Forms are third-party integrated — same integration model in EDS', 'material-request-form & professionals/contact-us embed ion interactive; income-gap-calculator embeds Hedgeness; careers/openings embeds Greenhouse.', 'These forms/tools are NOT rebuilt natively; EDS re-embeds the same vendor scripts the same way they run today (embed/script block). Vendor app owns fields, validation, submission, CAPTCHA.', 'In Scope (embed only)'],
  ['Native /form purpose unconfirmed', '/form uses placeholder labels and shows no submit endpoint in server HTML.', 'Likely a template/sample. Confirm whether it is a live form before building a native EDS/AEM form.', 'Confirm'],
  ['Externally hosted PDFs/assets stay external', 'PDFs/brochures/statements served from asset.american-equity.com via the resolver.', 'Reference as-is; re-host into EDS/DAM only if AE explicitly requires migration.', 'Confirm'],
  ['Asset resolver reused, not rebuilt', '/api/assets/resolve-by-key is a verified 301 redirect service.', 'Reuse the resolver or use final asset URLs; no custom API build.', 'In Scope (reuse)'],
  ['Dynamic listings need an EDS index', '/insights and the form/document libraries hydrate lists client-side (empty SSR).', 'Rebuild as index-backed listing blocks with search/pagination.', 'In Scope'],
  ['Analytics re-instated as observed', 'GTM + GA4 + Optimizely Web + OneTrust present site-wide.', 'Re-add the same containers/snippets in the delayed phase; new tracking or data-layer work estimated separately.', 'Confirm'],
  ['Optimizely Experimentation usage unconfirmed', 'Experiment snippet present site-wide; active tests not visible in HTML.', 'Confirm whether AE keeps Optimizely Experiment before re-integrating.', 'Confirm'],
  ['Content, not variations', 'Many pages share block composition with different copy/images.', 'Variations counted only for real structural/behavioral/authoring/technical differences.', 'In Scope'],
  ['SEO redirect parity required', '10 legacy URLs 301/308 to canonical pages.', 'Recreate the redirect map in EDS at launch.', 'In Scope'],
  ['Design parity, not redesign', 'Migration reproduces the current visual design.', 'Pixel-reasonable parity; no redesign in scope.', 'In Scope'],
];

// ---------------- OTHER OBSERVATIONS ----------------
const multiH1 = pages.filter((p) => p.h1count > 1).length;
const wistiaPages = pages.filter((p) => (p.structure.wistia || 0) > 0).length;
const resolverPages = pages.filter((p) => (p.structure.assetResolver || 0) > 0).length;
const OBS = [
  ['Source platform', 'Next.js (App Router / RSC) on Optimizely CMS (SaaS), server envoy. Blocks are read from the site\'s own <code>data-component</code> attributes, so the block/template mapping is evidence-based, not inferred.'],
  ['Migration content source', 'Content re-authored from Optimizely into EDS documents (Google Drive / SharePoint or DA). Because components are explicitly named, block boundaries map deterministically to EDS blocks.'],
  ['Client-hydrated content', 'The Insights feed and the form/document libraries render their lists client-side (empty in server HTML). These need EDS index-backed listing blocks — the main net-new data-modeling effort.'],
  ['Asset resolver', `<code>/api/assets/resolve-by-key</code> (${resolverPages} pages) is a verified 301 asset resolver to <code>asset.american-equity.com</code> (returns a PDF). It is a redirect/download service, not custom application code — reuse it.`],
  ['Login / Register', 'Header/footer Login and Register link to separate subdomain applications (portal + Okta). Out of EDS scope — preserve links, do not rebuild.'],
  ['Video', `Wistia is the only on-page video (${wistiaPages} pages) via the <code>&lt;wistia-video&gt;</code> web component; YouTube appears only as outbound links. Use a lazy facade + delayed script for CWV.`],
  ['SEO & accessibility', `All ${pages.length} pages carry meta descriptions and canonicals; <b>${multiH1} pages have more than one H1</b> — normalize during migration. Preserve <code>data-gtm-*</code> attributes for analytics parity; maintain ARIA on nav/tabs/accordions/modal.`],
  ['No CAPTCHA in AE markup', 'No reCAPTCHA/hCaptcha/Turnstile in American Equity\'s own markup. Any CAPTCHA lives inside vendor iframes (ion / Greenhouse) and is not verifiable from the accessible page behavior.'],
  ['Redirects', `${redirects} of ${pages.length} input URLs are 301/308 redirects to canonical pages, leaving ${distinctFinal} distinct rendered pages. Recreate these in EDS redirect config.`],
];

// ---------------- RENDER HELPERS ----------------
const kpi = (n, l, alt) => `<div class="kpi${alt ? ' alt' : ''}"><div class="n">${n}</div><div class="l">${l}</div></div>`;
const tmplOrder = Object.entries(tbm).sort((a, b) => b[1].pageCount - a[1].pageCount).map(([t]) => t);

function urlRows() {
  return tmplOrder.map((tpl) => {
    const urls = tbm[tpl].urls;
    const rows = urls.map((pth) => { const p = pageByPath[pth]; const red = redirected.has(p.url);
      return `<tr><td><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(pth)}</a>${red ? `<div class="redir">301 → ${esc(finalOf[p.url].replace('https://www.american-equity.com', '') || '/')}</div>` : ''}</td><td>${esc(p.title)}</td><td class="found">${esc(p.contentType || '—')}</td></tr>`; }).join('');
    return `<tr class="grp"><td colspan="3"><b>${esc(tpl)}</b> · ${urls.length} URL${urls.length > 1 ? 's' : ''}</td></tr>${rows}`;
  }).join('\n');
}
function blockRows() {
  return BLOCKS.map((b) => `<tr><td><b>${esc(b.name)}</b>${b.global ? ' <span class="cbadge">global</span>' : ''}</td><td class="num">${b.pages}</td><td class="num">${b.variations.length}</td><td>${cx(b.complexity)}</td><td>${b.variations.map((v) => `<b>${esc(v[0])}</b> — ${esc(v[1])}`).join('<br>')}</td><td>${esc(b.eds)}</td></tr>`).join('\n');
}
function templateRows() {
  return tmplOrder.map((tpl) => { const d = tbm[tpl]; const t = TEMPLATES[tpl] || {};
    const bl = Object.keys(d.blocks).filter((b) => d.blocks[b].kind === 'block');
    return `<tr><td><b>${esc(tpl)}</b></td><td class="num">${d.pageCount}</td><td class="num">${((d.pageCount / pages.length) * 100).toFixed(1)}%</td><td>${cx(t.complexity || 'Medium')}</td><td class="found">${bl.map(esc).join(' · ')}</td><td>${esc(t.note || '')}</td></tr>`; }).join('\n');
}
function mappingCards() {
  return tmplOrder.map((tpl) => { const d = tbm[tpl]; const t = TEMPLATES[tpl] || {};
    const rows = Object.entries(d.blocks).map(([bn, bv]) => {
      const kindTag = bv.kind === 'global' ? ' <span class="kt kt-glob">global</span>' : '';
      const vs = Object.entries(bv.variations);
      const varText = vs.length ? vs.map(([vn, c]) => `${esc(vn)} <span class="vc">${c}</span>`).join(' · ') : '<span class="found">—</span>';
      return `<tr><td><b>${esc(bn)}</b>${kindTag}</td><td class="num">${bv.pages}/${d.pageCount}</td><td>${blockCx[bn] ? cx(blockCx[bn]) : '<span class="found">n/a</span>'}</td><td>${varText}</td></tr>`; }).join('');
    const embedNote = d.embeds ? `<div class="embed-note"><b>Third-party embed on this template (preserved, integrated the same way — not rebuilt):</b> ${Object.entries(d.embeds).map(([e, c]) => `${esc(e)} <span class="vc">${c}</span>`).join(' · ')}</div>` : '';
    return `<div class="vblock"><h4>${esc(tpl)} <span class="found">· ${d.pageCount} page${d.pageCount > 1 ? 's' : ''} · template complexity ${esc(t.complexity || '—')}</span></h4>
      <table class="mapt"><thead><tr><th>Block on this template</th><th class="num">Pages</th><th>Block cx</th><th>Variation(s) observed <span class="found">(count = pages)</span></th></tr></thead><tbody>${rows}</tbody></table>
      ${embedNote}
      <div class="urls">${d.urls.map((u) => `<a href="${esc(pageByPath[u].url)}" target="_blank" rel="noopener">${esc(u)}</a>`).join('')}</div></div>`;
  }).join('\n');
}
const cxChips = (obj) => Object.entries(obj).sort().map(([k, v]) => `${cx(k)} <b>${v}</b>`).join(' &nbsp; ');

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>American Equity → EDS · Migration Discovery Report</title>
<style>
:root{--brand:#c8102e;--ink:#0b0f19;--edge:#e2e6ee;--blue:#1f4e9b;--muted:#5b6472;--navy:#0a2240}
*{box-sizing:border-box}
body{margin:0;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#f4f6fa}
header.hero{background:linear-gradient(135deg,#0a2240,#123a6b 60%,#1f4e9b);color:#fff;padding:44px 40px 38px}
header.hero h1{margin:0 0 8px;font-size:27px;letter-spacing:-.5px}
header.hero .sub{color:#c3d2ea;font-size:14.5px;max-width:980px}
header.hero .badge{display:inline-block;background:var(--brand);color:#fff;font-weight:700;padding:3px 11px;border-radius:5px;font-size:12px;margin-bottom:14px;letter-spacing:.5px}
nav.toc{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--edge);z-index:40;padding:10px 24px;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13px}
nav.toc a{color:var(--muted);text-decoration:none;white-space:nowrap}nav.toc a:hover{color:var(--blue)}
.wrap{max-width:1220px;margin:0 auto;padding:0 24px 70px}
section{background:#fff;border:1px solid var(--edge);border-radius:14px;padding:24px 28px;margin:20px 0;box-shadow:0 1px 3px rgba(10,15,25,.05)}
h2.sec{font-size:20px;margin:0 0 4px;padding-bottom:9px;border-bottom:3px solid var(--brand);display:inline-block}
h4{margin:16px 0 6px;font-size:15px}
.lead{color:#28303d;max-width:1010px;font-size:14px}
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
.found{color:var(--muted);font-size:11.5px}
.redir{color:#9a3412;font-size:11px;font-weight:600}
.cx{padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;display:inline-block}
.cx-Low{background:#dcfce7;color:#166534}.cx-Medium{background:#fef9c3;color:#854d0e}.cx-High{background:#ffedd5;color:#9a3412}
.total-row td{background:#0a2240!important;color:#fff;font-weight:800}
.cbadge{display:inline-block;background:var(--blue);color:#fff;font-size:10px;font-weight:800;padding:1px 7px;border-radius:20px;margin-left:6px;text-transform:uppercase}
.kt{font-size:9.5px;font-weight:800;padding:1px 6px;border-radius:20px;text-transform:uppercase;margin-left:4px}
.kt-glob{background:#e0e7ff;color:#3730a3}
.vc{display:inline-block;background:#eef2f9;border:1px solid #dfe6f1;color:#1a4bcc;font-size:10px;font-weight:800;padding:0 6px;border-radius:20px}
.scope{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;display:inline-block}
.sc-in{background:#dcfce7;color:#166534}.sc-out{background:#fee2e2;color:#991b1b}.sc-conf{background:#fef3c7;color:#92400e}
.vblock{margin:14px 0;padding:12px 14px;border:1px solid var(--edge);border-radius:10px;background:#fbfcfe}
.vblock h4{margin:0 0 8px}
.mapt{margin:6px 0}.urls{margin-top:8px}
.urls a{display:inline-block;background:#eef2f9;border:1px solid #dfe6f1;color:#1a4bcc;padding:2px 7px;border-radius:6px;margin:2px;font-size:11px;text-decoration:none}
.urls a:hover{background:var(--blue);color:#fff}
a{color:#1a4bcc}
.callout{background:#eff5ff;border-left:4px solid var(--blue);padding:10px 14px;border-radius:6px;font-size:13px;margin:12px 0}
.note{background:#fff8e6;border-left:4px solid #d99400;padding:10px 14px;border-radius:6px;font-size:13px;margin:12px 0}
.embed-note{background:#fef2f2;border-left:3px solid #dc2626;padding:6px 12px;border-radius:6px;font-size:12px;margin:6px 0}
.obs dt{font-weight:700;color:var(--navy);margin-top:10px}.obs dd{margin:2px 0 0;font-size:13.5px}
footer{text-align:center;color:var(--muted);font-size:12px;padding:24px}
@media print{nav.toc{display:none}section{break-inside:avoid;box-shadow:none}a{color:inherit}}
</style></head>
<body>
<header class="hero">
  <div class="badge">ADOBE EDGE DELIVERY SERVICES · MIGRATION DISCOVERY</div>
  <h1>American-Equity.com → EDS · Migration Discovery &amp; Block/Template Mapping</h1>
  <div class="sub">A single migration-discovery report for moving <code>www.american-equity.com</code> to Adobe Edge Delivery Services — written to support <b>estimation and customer discussion</b>. All <b>${pages.length} in-scope URLs were re-fetched and analyzed one by one</b> (no sampling); the block inventory and template↔block mapping are read from each page's own <code>data-component</code> markup. Source platform: <b>Next.js on Optimizely CMS</b>. Structural discovery only — <b>no estimates, timelines, or story points</b> are included.</div>
</header>
<nav class="toc">
  <a href="#summary">1 · Summary</a>
  <a href="#urls">2 · Analyzed URLs</a>
  <a href="#blocks">3 · EDS Block Inventory</a>
  <a href="#templates">4 · Templates</a>
  <a href="#mapping">5 · Template ↔ Block Mapping</a>
  <a href="#forms">6 · Forms</a>
  <a href="#integ">7 · Integrations</a>
  <a href="#external">8 · Redirects / APIs / External</a>
  <a href="#assume">9 · Assumptions &amp; Scope</a>
  <a href="#obs">10 · Other Observations</a>
</nav>
<div class="wrap">

<section id="summary">
<h2 class="sec">1 · Summary</h2>
<div class="kpis">
  ${kpi(pages.length, 'URLs analyzed')}
  ${kpi(distinctFinal, 'Distinct pages')}
  ${kpi(redirects, 'Legacy redirects')}
  ${kpi(BLOCKS.length, 'EDS blocks', true)}
  ${kpi(totalVariations, 'Variations', true)}
  ${kpi(Object.keys(tbm).length, 'Templates', true)}
  ${kpi(FORMS.length, 'Forms')}
  ${kpi(INTEGS.length, 'Integrations')}
  ${kpi(EXTERNAL.length, 'External deps')}
</div>
<p class="lead">American Equity is a marketing/content site on <b>Optimizely CMS</b> with a <b>Next.js</b> front end. Because the DOM labels every component with a <code>data-component</code> name, block boundaries and their per-template placement are read from the markup. All ${pages.length} URLs returned HTTP 200; ${redirects} are legacy 301/308 redirects to canonical pages, leaving <b>${distinctFinal} distinct rendered pages</b> across <b>${Object.keys(tbm).length} templates</b>. The EDS build surface is <b>${BLOCKS.length} blocks</b> (${contentBlocks} content + ${globalBlocks} global) with <b>${totalVariations} variations</b>. Block complexity: ${cxChips(cxCount)}.</p>
<div class="callout"><b>For estimation &amp; the customer conversation, the drivers are:</b>
(a) the <b>Tabs</b> block and the two <b>client-hydrated listings</b> (Insights feed + searchable form/document libraries) that need an EDS index with search/pagination — the main net-new data-modeling work;
(b) <b>third-party embeds</b> — ion interactive forms, Hedgeness calculator, Greenhouse jobs — which are <b>preserved and integrated the same way they run today</b>, not rebuilt;
(c) global chrome (mega-menu header, footer, breadcrumb) built once.</div>
<div class="note"><b>Explicitly OUT of EDS scope (link, don't rebuild):</b> customer <b>Login</b> (<code>myportal</code>) and <b>Register</b> (<code>register</code>, Okta) redirect to separate subdomain applications; affiliate sites (<code>eagle-lifeco</code>, <code>ae-newyork</code>); DAM downloads (<code>asset.american-equity.com</code>) and the <code>/api/assets/resolve-by-key</code> resolver (a verified 301 redirect, not custom code); and the vendor-hosted forms/calculator/jobs apps.</div>
</section>

<section id="urls">
<h2 class="sec">2 · URLs Analyzed (all ${pages.length}, grouped by template)</h2>
<p class="lead">Every input URL (links open the live page), grouped by assigned template. Input file had ${inputLines} lines — 1 duplicate (<code>/IncomeShield</code>) removed → ${pages.length} unique URLs, all HTTP 200. Redirecting URLs show their canonical target.</p>
<table><thead><tr><th>URL (click to open)</th><th>Page title</th><th>Content type</th></tr></thead><tbody>${urlRows()}</tbody></table>
</section>

<section id="blocks">
<h2 class="sec">3 · EDS Block Inventory with Variations &amp; Complexity</h2>
<p class="lead"><b>${BLOCKS.length} blocks</b> (${contentBlocks} content + ${globalBlocks} global) · <b>${totalVariations} variations</b>. A variation is counted only for a real structural/behavioral/authoring/technical difference — never content/image/text. "Pages" = number of the ${pages.length} URLs where the block appears. Complexity: ${cxChips(cxCount)}.</p>
<table><thead><tr><th>Block</th><th class="num">Pages</th><th class="num">Var.</th><th>Complexity</th><th>Variations (what differs)</th><th>EDS implementation consideration</th></tr></thead>
<tbody>${blockRows()}
<tr class="total-row"><td>TOTAL — ${BLOCKS.length} blocks</td><td class="num">—</td><td class="num">${totalVariations}</td><td>—</td><td colspan="2"></td></tr></tbody></table>
</section>

<section id="templates">
<h2 class="sec">4 · Template Inventory</h2>
<p class="lead"><b>${Object.keys(tbm).length} templates</b>, assigned by final (post-redirect) URL + observed block composition. Pages summing to all ${pages.length} URLs.</p>
<table><thead><tr><th>Template</th><th class="num">Pages</th><th class="num">% Site</th><th>Complexity</th><th>Blocks used</th><th>Notes</th></tr></thead>
<tbody>${templateRows()}
<tr class="total-row"><td>TOTAL — ${Object.keys(tbm).length} templates</td><td class="num">${pages.length}</td><td class="num">100%</td><td>—</td><td colspan="2"></td></tr></tbody></table>
</section>

<section id="mapping">
<h2 class="sec">5 · Template ↔ Block ↔ Variation Mapping</h2>
<p class="lead">Built by reading the <code>data-component</code> markup of <b>all ${pages.length} pages</b>. For each template: the blocks on it, how many of the template's pages use each block, block complexity, and each variation with its page count. Only real blocks are listed (<span class="kt kt-glob">global</span> = site chrome built once); default content (prose, images, buttons, download links) is handled by core decoration. Third-party embeds are called out under each table.</p>
${mappingCards()}
<div class="note"><b>Reading the counts:</b> "Pages" is <i>x/y</i> = pages of that template using the block. A block can carry several variations on one template — e.g. consumer product pages use <b>both</b> horizontal and vertical tab orientations. Only the ${contentBlocks} content + ${globalBlocks} global blocks are bespoke EDS build items.</div>
</section>

<section id="forms">
<h2 class="sec">6 · Forms</h2>
<p class="lead"><b>${FORMS.length} form surfaces.</b> Most are <b>third-party integrated</b> (ion interactive, Hedgeness, Greenhouse) — the vendor app owns fields, validation, submission and any CAPTCHA. <b>In EDS these are integrated the same way they run today</b> (re-embed the vendor script), not rebuilt. The only native form is <code>/form</code>, which appears to be a template/sample.</p>
<table><thead><tr><th>Form</th><th>Location</th><th>Type</th><th>Validation</th><th>Submission</th><th>EDS handling</th></tr></thead>
<tbody>${FORMS.map((f) => `<tr><td><b>${esc(f[0])}</b></td><td class="found">${esc(f[1])}</td><td>${esc(f[2])}</td><td>${esc(f[3])}</td><td>${esc(f[4])}</td><td>${esc(f[5])}</td></tr>`).join('\n')}</tbody></table>
<div class="note">No CAPTCHA (reCAPTCHA/hCaptcha/Turnstile) was found in American Equity's own markup. Any CAPTCHA would live inside the vendor iframes (ion / Greenhouse) and is <b>not verifiable from the accessible page behavior</b>.</div>
</section>

<section id="integ">
<h2 class="sec">7 · Third-Party Integrations (verified)</h2>
<p class="lead"><b>${INTEGS.length} integrations</b> confirmed by on-page evidence. "Pages" = pages where observed. Facebook/LinkedIn appear only as footer social <i>links</i> (not pixels) and are excluded.</p>
<table><thead><tr><th>Integration</th><th class="num">Pages</th><th>Scope</th><th>Purpose</th><th>Evidence</th><th>EDS consideration</th></tr></thead>
<tbody>${INTEGS.map((i) => `<tr><td><b>${esc(i[0])}</b></td><td class="num">${i[1]}</td><td>${esc(i[2])}</td><td>${esc(i[3])}</td><td class="found">${esc(i[4])}</td><td>${esc(i[5])}</td></tr>`).join('\n')}</tbody></table>
</section>

<section id="external">
<h2 class="sec">8 · Redirects, APIs &amp; External Dependencies</h2>
<p class="lead">Observed → Dependency → EDS requirement → Recommendation. The only <code>/api/</code> endpoint on the site is the asset resolver, verified as a 301 redirect to the DAM (not application logic).</p>
<table><thead><tr><th>Observed</th><th>Dependency</th><th>EDS requirement</th><th>Recommendation</th></tr></thead>
<tbody>${EXTERNAL.map((e) => `<tr><td>${esc(e[0])}</td><td>${esc(e[1])}</td><td>${esc(e[2])}</td><td>${esc(e[3])}</td></tr>`).join('\n')}</tbody></table>
</section>

<section id="assume">
<h2 class="sec">9 · Assumptions &amp; Scope Boundaries</h2>
<table><thead><tr><th>Assumption</th><th>Observed basis</th><th>How we treat it</th><th>Scope</th></tr></thead>
<tbody>${ASSUMPTIONS.map((a) => `<tr><td><b>${esc(a[0])}</b></td><td>${esc(a[1])}</td><td>${esc(a[2])}</td><td>${scopeBadge(a[3])}</td></tr>`).join('\n')}</tbody></table>
</section>

<section id="obs">
<h2 class="sec">10 · Other Observations</h2>
<dl class="obs">${OBS.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${d}</dd>`).join('\n')}</dl>
</section>

<footer>American Equity → EDS · Migration discovery report · Generated 2026-08-13 · All ${pages.length} URLs re-fetched &amp; analyzed one by one · Evidence in <code>american-equity-report/data/*.json</code> · No estimates/timelines/story points by design.</footer>
</div>
</body></html>`;

fs.writeFileSync(path.join(OUT, 'migration-discovery-report.html'), html);
console.log('Wrote american-equity-report/migration-discovery-report.html', (html.length / 1024).toFixed(1) + 'KB');
console.log('Blocks', BLOCKS.length, '| variations', totalVariations, '| templates', Object.keys(tbm).length, '| forms', FORMS.length, '| integrations', INTEGS.length);
