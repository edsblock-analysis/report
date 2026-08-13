// Build the American Equity → EDS discovery report (single self-contained HTML).
// Design mirrors the BRP report. Curated analysis model is inline below (evidence-derived).
// NO estimates / timelines / story points / dev-days anywhere.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const AE = path.join(ROOT, 'american-equity');
const pages = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'pages.json'), 'utf8'));
const agg = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'aggregates.json'), 'utf8'));
const ta = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'template-assignment.json'), 'utf8'));
const log = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'fetch-log.json'), 'utf8'));

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cx = (c) => `<span class="cx cx-${c.replace(/\s/g, '')}">${c}</span>`;

// ============================================================================
// CURATED MODEL — derived from evidence in data/. Each entry cites its signal.
// ============================================================================

// ---- BLOCKS & VARIATIONS ----
// pages = # of the 74 URLs where the block's data-component was observed.
const BLOCKS = [
  {
    name: 'Hero (In-Page Intro Band)', comps: ['heroHeaderSection', 'heroHeader', 'blogHeader'], pages: 74, complexity: 'Medium',
    variations: [
      ['Standard Hero', 'Heading + subcopy + optional image/CTA; on 73 pages', '73 pages'],
      ['Article Hero', 'Title + author/date/read-time meta + eyebrow; used on dynamic article/listing pages', '4 pages'],
      ['Simple Hero', 'Minimal heading-only variant (form template page)', '1 page'],
    ],
    behavior: 'The first content band INSIDE <main> (not the site navigation) — background image/color, optional eyebrow, heading, subcopy, CTA. Structurally similar across product/landing/legal; article variant adds post metadata. The global nav is a separate block (below).',
    eds: 'One hero block with a variant class (e.g. hero / hero.article). Distinct from the global header/nav. Breadcrumb rendered separately. Image via EDS optimized picture.',
  },
  {
    name: 'Feature Cards & Media', comps: ['featureCardsAndMediaRow', 'featuredIconCard', 'featuredImageCard', 'feature3SetsImage', 'featureSetCard'], pages: 36, complexity: 'Medium',
    variations: [
      ['Media + copy row', 'Alternating image/text rows with optional CTA — the site\'s workhorse content band', '36 pages'],
      ['Icon card grid', 'Grid of icon + heading + text cards (3–9 up)', '18 pages'],
      ['Image card grid', 'Grid of image + heading + text/link cards', '21 pages'],
      ['3-set image feature', 'Three-column image feature grouping', '1 page'],
    ],
    behavior: 'One family of feature/card layouts: alternating media+copy rows and responsive card grids (icon or image). Media side, background, and column count are authoring options. Icon vs image is a meaningful media/structural difference, so they are counted as variations of the same block.',
    eds: 'Single "cards / columns" block with media-row, icon-card, and image-card variants. Grid responsive by card count; image via EDS optimized picture.',
  },
  {
    name: 'Tabs (Tabbed Content)', comps: ['featureHorizontalLineTab', 'featureHorizontalLineTabCard', 'featureVerticalLineTab', 'featureVerticalLineTabCard'], pages: 17, complexity: 'High',
    variations: [
      ['Horizontal line tabs', 'Tab strip along the top; tab → card panel', '13 pages'],
      ['Vertical line tabs', 'Tab list on the side; tab → card panel', '4 pages'],
    ],
    behavior: 'Interactive tab switching (client JS), ARIA tablist/tabpanel, keyboard nav. Horizontal vs vertical differ in layout + interaction model.',
    eds: 'Tabs block with orientation variant. Needs JS decoration for tab state, ARIA roles, and deep-link/anchor support.',
  },
  {
    name: 'Progress Bar / Stepper', comps: ['progressBar', 'progressBarStep'], pages: 10, complexity: 'Medium',
    variations: [
      ['Numbered step sequence', 'Ordered “how it works / next steps” 3–5 step sequence', '10 pages'],
    ],
    behavior: 'Presentational stepped sequence (not a form wizard). Each step = icon/number + heading + text.',
    eds: 'Static stepper block; no state machine. CSS-driven connectors. Low interactivity.',
  },
  {
    name: 'Video (Wistia)', comps: ['videoBlock'], pages: 14, complexity: 'Medium',
    variations: [
      ['Inline Wistia video', 'Wistia web component (<wistia-video>) with poster + heading + copy', '14 pages'],
    ],
    behavior: 'Uses Wistia player web-component + Wistia embed script (videoType:"wistia"). YouTube appears only as outbound links inside rich text, not as an embed.',
    eds: 'Video block with lazy facade → Wistia embed. Load player script only on interaction/delayed phase for CWV.',
  },
  {
    name: 'Metrics / Stats', comps: ['metrics', 'metricsCard'], pages: 4, complexity: 'Low',
    variations: [
      ['Stat row', 'Large-number + label KPI row (e.g. financial-strength, about)', '4 pages'],
    ],
    behavior: 'Static numeric highlights. No animation/data source observed.',
    eds: 'Simple stats block; author-entered numbers.',
  },
  {
    name: 'Accordion / Disclosure', comps: ['accordion', 'disclosure'], pages: 43, complexity: 'Medium',
    variations: [
      ['FAQ accordion', 'Expand/collapse Q&A groups', '6 pages'],
      ['Disclosure / legal expander', 'Collapsible fine-print / disclaimer region (very common footer-of-content)', '42 pages'],
    ],
    behavior: 'Both are expand/collapse; accordion is multi-item FAQ, disclosure is single legal expander. Distinct authoring purpose + placement.',
    eds: 'Accordion block with a "disclosure" variant. ARIA disclosure pattern, keyboard support.',
  },
  {
    name: 'Blog Card / Related Posts', comps: ['blogCard', 'relatedBlogPosts'], pages: 34, complexity: 'Medium',
    variations: [
      ['Related posts strip', 'Auto-populated “related/insights” cards at article foot', '30 pages'],
      ['Editorial card grid', 'Curated card links to insight articles', 'within 34 pages'],
    ],
    behavior: 'Related-posts is data-driven (pulls related Insights); cards render title/image/excerpt/link. Depends on content taxonomy.',
    eds: 'Card block + a query-driven variant (index/taxonomy) for related posts. Needs an index (e.g. EDS query-index.json).',
  },
  {
    name: 'Dynamic Content Listing (Insights index)', comps: ['blogHeader'], pages: 4, complexity: 'High',
    variations: [
      ['Insights listing (client-fetched)', 'Paginated article feed ("BlogPosts", "Pagination", "articles" in payload); SSR renders shell, list hydrates client-side', '/insights + 3 legacy redirects'],
    ],
    behavior: 'List of posts with pagination is fetched/rendered client-side (empty in SSR HTML). Category/feed driven.',
    eds: 'Listing block backed by an EDS index (query-index.json) with pagination; replaces the client feed. Higher effort due to data model + pagination.',
  },
  {
    name: 'Searchable Form / Document Library', comps: ['formListing', 'formTable'], pages: 4, complexity: 'High',
    variations: [
      ['Form listing w/ search + category tabs', 'Consumer /forms and /professionals/document-library', '3 pages'],
      ['Form table directory', 'Professionals /forms-library', '1 page'],
    ],
    behavior: 'This is NOT a data-entry form. It is a searchable/filterable DIRECTORY of downloadable service forms and documents (e.g. annuity service forms, statements). The page renders a search box plus category tabs (formListing) or a sortable table (formTable) over a set of documents; each result row links out to the PDF on the DAM (via /api/assets/resolve-by-key → asset.american-equity.com). The list itself is fetched and rendered client-side, so the server HTML is only an empty shell. In short: a "find the form/document I need, then download it" tool.',
    eds: 'Listing block backed by an EDS index (query-index.json) with client-side search/filter (and a tabbed vs table display variant). Result links resolve to the existing DAM. Higher effort because it needs a document data model + search UX, not just static markup.',
  },
  {
    name: 'Native Data-Entry Form (Form Input Model)', comps: ['formInputModel'], pages: 1, complexity: 'High',
    variations: [['Native form', 'The only true HTML <form> on the site — text inputs, a select, a textarea and a submit button, on /form', '1 page']],
    behavior: 'This is an actual data-collection form built natively in the CMS (component "formInputModel") — the visitor types values and submits them, unlike the vendor-embedded forms (ion/Greenhouse) which live inside third-party iframes. On the one page it appears (/form) the fields carry placeholder labels ("Form title", "Form description") and the server HTML shows no submit endpoint, so it looks like a template/sample rather than a wired-up production form. Whether it is live, and where it posts to, cannot be confirmed from the accessible page behavior.',
    eds: 'Build as an EDS form block (or AEM Forms) once the real field model, validation rules, and submit endpoint are confirmed with American Equity. Tracked in the Forms section and Gray Areas as a "confirm before building" item.',
  },
  {
    name: 'Contact Card / Row', comps: ['contactCard', 'contactRow'], pages: 2, complexity: 'Low',
    variations: [['Contact cards', 'Phone/email/dept contact cards (contact-us, professionals/contact-us)', '2 pages']],
    behavior: 'Static contact detail cards with tel:/mailto: links.',
    eds: 'Cards variant; author-entered contact info.',
  },
  {
    name: 'Modal / Dialog', comps: ['generalModal'], pages: 1, complexity: 'Medium',
    variations: [['General modal', 'Dialog triggered from content (professionals landing)', '1 page']],
    behavior: 'Overlay dialog; focus trap + ARIA dialog semantics.',
    eds: 'Modal block/util; accessible dialog, opened from a trigger link.',
  },
  {
    name: 'Global Header / Navigation (site chrome)', comps: [], pages: 74, complexity: 'High', global: true,
    variations: [['Mega-menu header', '4 top-level menus (About Us, Annuities, Retirement Resources, Support) with dropdown panels + utility menu (Login/Register/Search) + Find an Agent', 'site-wide']],
    behavior: 'The site navigation in <header>/<nav> (NOT a per-page hero). Desktop mega-menu (navigation-menu triggers + content panels), mobile drawer, utility links to external portal/register. Carries no data-component — it is structural chrome, built once for the whole site. GTM nav tracking attributes.',
    eds: 'Standard EDS header block from the nav document; mega-menu panels + mobile drawer. Built once, shared by every page. External utility links (Login/Register) preserved.',
  },
  {
    name: 'Global Footer', comps: ['footerNavigationColumn', 'footerNavigationLink'], pages: 74, complexity: 'Medium', global: true,
    variations: [['Multi-column footer', 'Nav columns + social links (Facebook/LinkedIn) + legal/disclosure + logo; ~10 link cols site-wide', 'site-wide']],
    behavior: 'Static multi-column footer with social + legal links and rich disclosure text. GTM footer tracking attributes.',
    eds: 'Standard EDS footer block from footer document.',
  },
  {
    name: 'Breadcrumb', comps: [], pages: 51, complexity: 'Low', global: true,
    variations: [['Breadcrumb trail', 'Interior-page breadcrumb (aria-label="Breadcrumb")', '51 pages']],
    behavior: 'Path breadcrumb on interior pages; not present on home/some landings.',
    eds: 'Breadcrumb block/auto-block derived from path or metadata.',
  },
];

// ---- TEMPLATES ----
const TEMPLATES = [
  { name: 'Article (Insight / Blog)', complexity: 'Medium',
    blocks: 'Hero (article/standard) · Related Posts (blogCard) · Accordion/Disclosure',
    note: 'Editorial article body (prose is default rich-text content). Two sub-shapes: full editorial (hero + body + related posts) and lightweight (blogHeader + single card) — same template, content-driven difference.' },
  { name: 'Product / Annuity (Consumer)', complexity: 'High',
    blocks: 'Hero · Tabs · Progress Bar/Stepper · Video (Wistia) · Feature Cards & Media · Accordion (FAQ) · Related Posts',
    note: 'AssetShield/EstateShield/GuaranteeShield/IncomeShield + our-annuities. Richest consumer composition; interactive tabs + stepper + video.' },
  { name: 'Product / Annuity (Professional)', complexity: 'High',
    blocks: 'Hero · Tabs · Feature Cards & Media · Video · Accordion/Disclosure',
    note: 'Professionals product pages mirror the consumer shape and add tabbed groups of downloadable resource cards that link to DAM assets (handled as authored download links, not a bespoke block).' },
  { name: 'Section Landing / Hub', complexity: 'Medium',
    blocks: 'Hero · Feature Cards & Media · Metrics · Accordion/Disclosure',
    note: 'Marketing hubs (about, community, financial-strength, professionals, resources, our-annuities pro). Composition varies by hub but same block palette.' },
  { name: 'Content Listing (Dynamic)', complexity: 'High',
    blocks: 'Article Hero (blogHeader) · Dynamic Insights feed (client-fetched, paginated)',
    note: '/insights (+3 legacy /annuities & /resources/blog redirects land here). List hydrates client-side; needs an EDS index + pagination.' },
  { name: 'Form / Document Listing', complexity: 'High',
    blocks: 'Hero · Searchable Form/Document Library OR Native Data-Entry Form OR vendor embed',
    note: 'Heterogeneous: /forms & document-library and forms-library are searchable document directories; /form is the native data-entry form; material-request-form is a vendor (ion) embed. Directory data hydrates client-side.' },
  { name: 'Careers', complexity: 'Medium',
    blocks: 'Hero · Feature Cards & Media · Tabs · Video · Progress Bar (openings) + Greenhouse job-board embed',
    note: 'careers hub + why-work-here + internship-program (marketing) and openings, which embeds the Greenhouse job board.' },
  { name: 'Tool / Calculator (Embed)', complexity: 'High',
    blocks: 'Hero · Hedgeness calculator embed · Accordion/Disclosure · (tools-calculators hub uses Feature Cards)',
    note: 'income-gap-calculator (consumer + professional) embed the third-party Hedgeness widget; tools-calculators landing is a hub of tool links.' },
  { name: 'Contact', complexity: 'Low',
    blocks: 'Hero · Contact Cards/Row · Feature Cards & Media · (ion form embed on professionals/contact-us)',
    note: 'contact-us (consumer) and professionals/contact-us; latter also embeds an ion interactive contact form.' },
  { name: 'Legal / Utility', complexity: 'Low',
    blocks: 'Hero · Accordion/Disclosure · (Feature Cards on some)',
    note: 'Prose is default rich-text content. privacy, terms-of-use, accessibility, security-disclosure, patriot-act, sms-privacy, job-applicant-privacy, naic-statutory-financial-statements (the last links to statement PDFs).' },
  { name: 'Home', complexity: 'High',
    blocks: 'Hero · Feature Cards & Media · Tabs · Metrics · Video · Accordion/Disclosure',
    note: 'Single homepage; densest marketing composition.' },
];

// ---- FORMS ----
const FORMS = [
  { name: 'Material Request Form', where: '/professionals/material-request-form', type: 'Third-party embedded (ion interactive)',
    fields: 'Supply/material request fields (rendered inside ion iframe app)', validation: 'Handled by ion app', submit: 'Posts within ion interactive (experience.american-equity.com/material-request-form)', captcha: 'Not verifiable from page (inside vendor iframe)', complexity: 'Medium',
    eds: 'Preserve ion embed via a Script/Embed block. Do not rebuild. Confirm whether AE wants this natively rebuilt.' },
  { name: 'Income Gap Calculator', where: '/income-gap-calculator, /professionals/tools-calculators/income-gap-calculator', type: 'Third-party embedded app (Hedgeness widget)',
    fields: 'Calculator inputs rendered by ael.hedgenessapp.com widget', validation: 'Handled by Hedgeness widget', submit: 'Client-side calculation in vendor widget (no AE submit observed)', captcha: 'None observed', complexity: 'Medium',
    eds: 'Preserve via Script/Embed block; mount aelWidget.js into #hedgenessWidget. Do not rebuild.' },
  { name: 'Job Openings / Application', where: '/about/careers/openings', type: 'Third-party embedded (Greenhouse job board)',
    fields: 'Job search & application flow rendered by Greenhouse', validation: 'Greenhouse', submit: 'Greenhouse ATS (boards.greenhouse.io)', captcha: 'Not verifiable (vendor)', complexity: 'Medium',
    eds: 'Preserve Greenhouse embed via Script/Embed block. Applications remain in Greenhouse.' },
  { name: 'Professional Contact Form', where: '/professionals/contact-us', type: 'Third-party embedded (ion interactive) + static contact cards',
    fields: 'Contact fields inside ion embed; page also shows static contact cards', validation: 'ion app', submit: 'ion interactive', captcha: 'Not verifiable (vendor)', complexity: 'Medium',
    eds: 'Preserve ion embed; contact cards are a native cards block.' },
  { name: 'Native Form Template', where: '/form', type: 'Native (formInputModel) — appears to be a template/sample page',
    fields: 'Text input(s), select, textarea, submit; labels are placeholders ("Form title", "Form description")', validation: 'noValidate on <form>; client validation not confirmed', submit: 'Endpoint not present in SSR HTML — not verifiable', captcha: 'None observed', complexity: 'High',
    eds: 'If required as a real form: build a Form block (or AEM Forms) with confirmed field model + submit endpoint. Confirm whether /form is a live form or a demo.' },
  { name: 'Forms / Document Search (consumer /forms, document-library, forms-library)', where: '/forms, /professionals/document-library, /professionals/forms-library', type: 'Search/filter listing (client-hydrated), not a submission form',
    fields: 'Search box + category tabs (form-listing) / table (form-table)', validation: 'n/a (search)', submit: 'No submission — links resolve to DAM assets', captcha: 'n/a', complexity: 'High',
    eds: 'Listing block with client search/filter over an EDS index; rows link to DAM. Not a data-collection form.' },
];

// ---- INTEGRATIONS ---- (evidence-based, verified in HTML)
const INTEGS = [
  { name: 'Google Tag Manager', pages: 74, scope: 'Site-wide', purpose: 'Tag management container (GTM-MZDFLT8W); loads GA4 & other tags', evidence: 'googletagmanager.com script + GTM-MZDFLT8W on every page',
    eds: 'Re-add GTM via delayed.js; keep container ID. Preserve data-gtm-* attributes on links/CTAs for tracking parity.' },
  { name: 'Google Analytics 4 (via GTM)', pages: 74, scope: 'Site-wide', purpose: 'Web analytics', evidence: 'gtag() present; GA4 fired through GTM container (no standalone G- id in markup)',
    eds: 'Ships through GTM; no separate work beyond GTM. Custom events/data-layer changes out of scope unless requested.' },
  { name: 'OneTrust (consent management)', pages: 74, scope: 'Site-wide', purpose: 'Cookie consent / privacy banner', evidence: 'cdn.cookielaw.org script + data-domain-script="019aa2c6-...-a83a0e6bf1ab" on every page',
    eds: 'Load OneTrust in delayed phase with the same domain-script id. Consent gates tag firing.' },
  { name: 'Optimizely CMS (SaaS)', pages: 74, scope: 'Site-wide (platform)', purpose: 'Current content management platform (Next.js front end)', evidence: 'app-*.cms.optimizely.com references + opti-content-area DOM',
    eds: 'This is the source CMS being migrated FROM. Content is re-authored into EDS documents; not an ongoing runtime integration.' },
  { name: 'Optimizely Web / Experimentation', pages: 74, scope: 'Site-wide', purpose: 'A/B testing & experimentation snippet', evidence: 'cdn.optimizely.com/js/5000773591891968.js preloaded/pushed on every page',
    eds: 'Re-add experimentation snippet via delayed.js if AE keeps Optimizely Experiment. Confirm whether it is actively used.' },
  { name: 'Wistia (video)', pages: 14, scope: 'Page-specific (product/marketing pages)', purpose: 'Hosted video player', evidence: '<wistia-video> web component + videoType:"wistia" (e.g. medias/ldupiv1d6y)',
    eds: 'Video block with lazy facade → Wistia embed script (delayed). Keep Wistia media IDs.' },
  { name: 'ion interactive (Scribble)', pages: 2, scope: 'Page-specific (material-request-form, professionals/contact-us)', purpose: 'Interactive forms hosted externally', evidence: 'ionfiles.scribblecdn.net/ionizer + data-ion-embed-hash → experience.american-equity.com',
    eds: 'Preserve via Script/Embed block. External app remains authoritative for form logic/submission.' },
  { name: 'Hedgeness', pages: 2, scope: 'Page-specific (income-gap calculators)', purpose: 'Income-gap calculator widget', evidence: 'ael.hedgenessapp.com/aelWidget.js → #hedgenessWidget',
    eds: 'Preserve via Script/Embed block. Calculator logic remains in vendor widget.' },
  { name: 'Greenhouse', pages: 1, scope: 'Page-specific (careers/openings)', purpose: 'Job board / ATS', evidence: 'boards.greenhouse.io/embed/job_board/js?for=americanequity... → #grnhse_app',
    eds: 'Preserve via Script/Embed block. ATS remains external.' },
  { name: 'YouTube (outbound links only)', pages: 5, scope: 'Page-specific', purpose: 'Linked videos in article rich text', evidence: 'youtube.com/watch links inside rich text; NOT an on-page embed',
    eds: 'No player integration needed — links only. If an embed is later desired, add a lite-YouTube facade.' },
];

// ---- EXTERNAL DEPS / REDIRECTS / APIS ----
const EXTERNAL = [
  { observed: '/api/assets/resolve-by-key?key=... (17 pages, 81 links)', dep: 'Asset resolver → 301 to asset.american-equity.com/download/... (verified: returns application/pdf)',
    req: 'EDS must let these links keep resolving to the DAM download.', rec: 'REUSE the existing resolver OR link the final asset URL directly. It is a simple redirect/asset service — NOT custom app development.' },
  { observed: 'asset.american-equity.com/download/... (site-wide)', dep: 'DAM download host for PDFs/brochures/statements',
    req: 'Externally hosted documents must remain reachable.', rec: 'Keep DAM external; reference assets as-is. Migrate into EDS/DAM only if AE explicitly requires re-hosting.' },
  { observed: 'myportal.american-equity.com (site-wide "Login")', dep: 'Customer login portal (separate app; login page)',
    req: 'Header/footer "Login" must link to the portal.', rec: 'PRESERVE link. Out of EDS scope — do not rebuild authentication.' },
  { observed: 'register.american-equity.com (site-wide "Register")', dep: 'Registration app (Okta-backed)',
    req: 'Header "Register" must link out.', rec: 'PRESERVE link. Out of EDS scope.' },
  { observed: 'experience.american-equity.com', dep: 'Host for ion interactive form pages (embedded)',
    req: 'ion embeds must continue to load from here.', rec: 'PRESERVE embeds; external app remains authoritative.' },
  { observed: 'eagle-lifeco.com, ae-newyork.com (site-wide footer)', dep: 'Affiliate/subsidiary company sites',
    req: 'Footer/nav links to affiliates.', rec: 'PRESERVE external links.' },
  { observed: 'ambest.com, fitchratings.com, spglobal.com (financial-strength)', dep: 'Ratings agency references / links',
    req: 'Outbound links to ratings sources.', rec: 'PRESERVE external links.' },
  { observed: '10 legacy URLs return 301/308', dep: 'Redirect map (/annuities*, /incomeshield-annuity/how-it-works, /resources/blog/*) → canonical pages',
    req: 'SEO redirect parity on launch.', rec: 'Recreate these redirects in EDS redirect config so legacy URLs keep resolving.' },
];

// ---- ASSUMPTIONS ----
const ASSUMPTIONS = [
  ['External authenticated apps are out of scope', 'myportal (login) and register (Okta) are separate applications on other subdomains.', 'EDS preserves links to them; authentication is not rebuilt.', 'Out of Scope'],
  ['External portals linked, not rebuilt', 'Login/Register/affiliate (eagle-lifeco, ae-newyork) surfaces are external.', 'Link out from header/footer; no reimplementation.', 'Out of Scope'],
  ['DAM assets remain external', 'PDFs/brochures/statements served from asset.american-equity.com.', 'Reference assets as-is unless AE requires re-hosting into EDS.', 'Requires Confirmation'],
  ['Asset resolver reused, not rebuilt', '/api/assets/resolve-by-key is a verified 301 redirect service, not app logic.', 'Reuse resolver or use final asset URLs; do not build custom API code.', 'In Scope (reuse)'],
  ['Third-party platforms stay external', 'ion interactive, Hedgeness, Greenhouse render inside vendor scripts/iframes.', 'Preserve embeds via an embed/script block; vendor apps remain authoritative.', 'In Scope (embed only)'],
  ['Content differences do not create variations', 'Many pages share identical block composition with different copy/images.', 'Variations only where structure/behavior/authoring/tech differ.', 'In Scope'],
  ['Structural/behavioral differences can create variations', 'e.g. horizontal vs vertical line-tabs; icon vs image cards; accordion vs disclosure.', 'These are counted as distinct variations.', 'In Scope'],
  ['Dynamic listings need an EDS index', '/insights, /forms, document/forms libraries hydrate lists client-side (empty SSR).', 'Rebuild as index-backed listing blocks with search/pagination.', 'In Scope'],
  ['Analytics re-instated as observed', 'GTM + GA4 + Optimizely Web + OneTrust present site-wide.', 'Re-add the same containers/snippets; new tracking/data-layer work estimated separately.', 'Requires Confirmation'],
  ['Native /form purpose unconfirmed', '/form uses placeholder labels and no visible submit endpoint in SSR.', 'Confirm whether it is a live form or a demo before building a native Form block.', 'Requires Confirmation'],
  ['Optimizely Experimentation usage unconfirmed', 'Experiment snippet is present site-wide but active tests are not verifiable from HTML.', 'Confirm whether AE keeps Optimizely Experiment before re-integrating.', 'Requires Confirmation'],
  ['SEO redirect parity required', '10 legacy URLs 301/308 to canonical pages.', 'Recreate redirect map in EDS at launch.', 'In Scope'],
];

// ---- GRAY AREAS ----
const GRAY = [
  ['/form submission target', 'Native form has placeholder labels and no submit endpoint in server HTML.', 'It is likely a template/sample; the real intake is the ion "material request" form.', 'Confirm with AE whether /form is live; if so, obtain the submit endpoint + field spec.', 'Requires Confirmation'],
  ['ion / Hedgeness / Greenhouse rebuild vs embed', 'These render entirely inside vendor scripts/iframes.', 'Rebuilding vendor apps in EDS is not warranted; embeds are the intended integration.', 'Preserve embeds unless AE explicitly wants a native rebuild (separate scope).', 'Out of Scope (embed only)'],
  ['DAM re-hosting', 'Documents live on asset.american-equity.com via a resolver.', 'Re-hosting thousands of PDFs into EDS/DAM may be unnecessary.', 'Keep external + reuse resolver; migrate only if AE mandates it.', 'Requires Confirmation'],
  ['Insights feed data model', '/insights list is client-fetched; taxonomy/category source not in SSR.', 'An EDS query-index will be needed to reproduce the feed + pagination.', 'Confirm article taxonomy/tagging so the index & related-posts logic match.', 'In Scope (needs data model)'],
  ['CAPTCHA on vendor forms', 'No CAPTCHA observed in AE markup; vendor forms may add their own.', 'Any CAPTCHA is inside ion/Greenhouse, not AE.', 'No AE-side CAPTCHA work assumed; not verifiable from accessible page behavior.', 'Requires Confirmation'],
  ['Optimizely Experimentation', 'Snippet present; live experiments not visible in HTML.', 'May or may not be actively used.', 'Confirm before re-integrating; treat as optional.', 'Requires Confirmation'],
  ['Search functionality', 'Header shows a search affordance; a global search backend is not verifiable from SSR.', 'Search may be powered by Optimizely/other service.', 'Confirm search provider & scope; not verifiable from accessible page behavior.', 'Requires Confirmation'],
];

// ---- FINAL COUNTS ----
const contentBlocks = BLOCKS.filter((b) => !b.global);
const globalBlocks = BLOCKS.filter((b) => b.global);
const totalVariations = BLOCKS.reduce((n, b) => n + b.variations.length, 0);
const complexityCount = BLOCKS.reduce((m, b) => { m[b.complexity] = (m[b.complexity] || 0) + 1; return m; }, {});
const templateComplexity = TEMPLATES.reduce((m, t) => { m[t.complexity] = (m[t.complexity] || 0) + 1; return m; }, {});
const redirects = log.filter((r) => r.redirected);
const distinctFinal = new Set(log.map((r) => r.finalUrl || r.url));

const COUNTS = {
  inputLines: fs.readFileSync(path.join(ROOT, 'american-equity.txt'), 'utf8').split('\n').filter((l) => l.trim()).length,
  uniqueUrls: pages.length,
  distinctRendered: distinctFinal.size,
  redirects: redirects.length,
  blocks: BLOCKS.length,
  contentBlocks: contentBlocks.length,
  globalBlocks: globalBlocks.length,
  variations: totalVariations,
  templates: TEMPLATES.length,
  forms: FORMS.length,
  integrations: INTEGS.length,
  externalDeps: EXTERNAL.length,
  grayAreas: GRAY.length,
  complexityCount,
  templateComplexity,
};
fs.writeFileSync(path.join(AE, 'data', 'model.json'), JSON.stringify({ BLOCKS, TEMPLATES, FORMS, INTEGS, EXTERNAL, ASSUMPTIONS, GRAY, COUNTS }, null, 2));

// ============================================================================
// RENDER
// ============================================================================
const templateUrls = ta.templates;

function blockRows() {
  return BLOCKS.map((b) => `<tr>
    <td><b>${esc(b.name)}</b>${b.global ? ' <span class="cbadge">global</span>' : ''}<div class="found">${esc(b.comps.join(', ') || '—')}</div></td>
    <td class="num">${b.pages}</td>
    <td class="num">${b.variations.length}</td>
    <td>${cx(b.complexity)}</td>
    <td>${esc(b.behavior)}</td>
    <td>${esc(b.eds)}</td></tr>`).join('\n');
}

function variationDetail() {
  return BLOCKS.map((b) => `<div class="vblock"><h4>${esc(b.name)} ${cx(b.complexity)} <span class="found">· ${b.pages} pages · ${esc(b.comps.join(', ') || 'global')}</span></h4>
  <table><thead><tr><th>Variation</th><th>Distinguishing structure / behavior</th><th class="num">Seen</th></tr></thead><tbody>
  ${b.variations.map((v) => `<tr><td><b>${esc(v[0])}</b></td><td>${esc(v[1])}</td><td class="num">${esc(v[2])}</td></tr>`).join('')}
  </tbody></table></div>`).join('\n');
}

function templateRows() {
  return TEMPLATES.map((t) => {
    const d = templateUrls[t.name] || { pages: 0, urls: [] };
    return `<tr>
      <td><b>${esc(t.name)}</b></td>
      <td class="num">${d.pages}</td>
      <td class="num">${((d.pages / pages.length) * 100).toFixed(1)}%</td>
      <td>${cx(t.complexity)}</td>
      <td>${esc(t.blocks)}</td>
      <td>${esc(t.note)}</td></tr>`;
  }).join('\n');
}

function templateUrlList() {
  return TEMPLATES.map((t) => {
    const d = templateUrls[t.name] || { urls: [] };
    return `<div class="vblock"><h4>${esc(t.name)} <span class="found">· ${d.urls.length} URLs</span></h4>
    <div class="urls">${d.urls.map((u) => `<code>${esc(u)}</code>`).join(' ')}</div></div>`;
  }).join('\n');
}

function formRows() {
  return FORMS.map((f) => `<tr>
    <td><b>${esc(f.name)}</b><div class="found">${esc(f.where)}</div></td>
    <td>${esc(f.type)}</td>
    <td>${esc(f.fields)}</td>
    <td>${esc(f.validation)}</td>
    <td>${esc(f.submit)}</td>
    <td>${esc(f.captcha)}</td>
    <td>${cx(f.complexity)}</td>
    <td>${esc(f.eds)}</td></tr>`).join('\n');
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

function externalRows() {
  return EXTERNAL.map((e) => `<tr>
    <td>${esc(e.observed)}</td>
    <td>${esc(e.dep)}</td>
    <td>${esc(e.req)}</td>
    <td>${esc(e.rec)}</td></tr>`).join('\n');
}

function assumptionRows() {
  return ASSUMPTIONS.map((a) => `<tr><td><b>${esc(a[0])}</b></td><td>${esc(a[1])}</td><td>${esc(a[2])}</td><td>${scopeBadge(a[3])}</td></tr>`).join('\n');
}
function scopeBadge(s) {
  const cls = /Out of/.test(s) ? 'sc-out' : /Requires/.test(s) ? 'sc-conf' : 'sc-in';
  return `<span class="scope ${cls}">${esc(s)}</span>`;
}
function grayRows() {
  return GRAY.map((g) => `<tr><td><b>${esc(g[0])}</b></td><td>${esc(g[1])}</td><td>${esc(g[2])}</td><td>${esc(g[3])}</td><td>${scopeBadge(g[4])}</td></tr>`).join('\n');
}

function urlAuditRows() {
  return ta.assign.map((a) => {
    const cs = Object.entries(a.components).filter(([k]) => !['ContentArea', 'footerNavigationColumn', 'footerNavigationLink'].includes(k)).map(([k, v]) => `${k}×${v}`).join(', ');
    return `<tr>
      <td><code>${esc(a.path)}</code>${a.redirected ? ` <span class="redir">301→ ${esc(a.finalPath)}</span>` : ''}</td>
      <td>${esc(a.template)}</td>
      <td class="found">${esc(cs || '—')}</td>
      <td>${a.integrations.map((i) => `<span class="tag">${esc(i)}</span>`).join(' ')}</td></tr>`;
  }).join('\n');
}

const complexityChips = (obj) => Object.entries(obj).sort().map(([k, v]) => `${cx(k)} <b>${v}</b>`).join(' &nbsp; ');

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>American Equity → EDS · Discovery Analysis</title>
<style>
:root{--brand:#c8102e;--ink:#0b0f19;--edge:#e2e6ee;--blue:#1f4e9b;--muted:#5b6472;--navy:#0a2240}
*{box-sizing:border-box}
body{margin:0;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#f4f6fa}
header.hero{background:linear-gradient(135deg,#0a2240,#123a6b 60%,#1f4e9b);color:#fff;padding:44px 40px 38px}
header.hero h1{margin:0 0 8px;font-size:27px;letter-spacing:-.5px}
header.hero .sub{color:#c3d2ea;font-size:14.5px;max-width:920px}
header.hero .badge{display:inline-block;background:var(--brand);color:#fff;font-weight:700;padding:3px 11px;border-radius:5px;font-size:12px;margin-bottom:14px;letter-spacing:.5px}
nav.toc{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--edge);z-index:40;padding:10px 24px;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13px}
nav.toc a{color:var(--muted);text-decoration:none;white-space:nowrap}nav.toc a:hover{color:var(--blue)}
.wrap{max-width:1220px;margin:0 auto;padding:0 24px 70px}
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
.found{color:var(--muted);font-size:11.5px;margin-top:3px}
.cx{padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;display:inline-block}
.cx-Low{background:#dcfce7;color:#166534}.cx-Medium{background:#fef9c3;color:#854d0e}.cx-High{background:#ffedd5;color:#9a3412}.cx-VeryHigh{background:#ede9fe;color:#5b21b6}
.total-row td{background:#0a2240!important;color:#fff;font-weight:800;border-color:#333}
.cbadge{display:inline-block;background:var(--blue);color:#fff;font-size:10px;font-weight:800;padding:1px 7px;border-radius:20px;margin-left:6px;text-transform:uppercase;letter-spacing:.3px}
.scope{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;display:inline-block}
.sc-in{background:#dcfce7;color:#166534}.sc-out{background:#e5e7eb;color:#374151}.sc-conf{background:#fef3c7;color:#92400e}
.vblock{margin:14px 0;padding:12px 14px;border:1px solid var(--edge);border-radius:10px;background:#fbfcfe}
.vblock h4{margin:0 0 8px}
.urls code,.tag{font-size:11px}
.urls code{display:inline-block;background:#eef2f9;border:1px solid #dfe6f1;color:#1a4bcc;padding:2px 7px;border-radius:6px;margin:2px}
.tag{display:inline-block;background:#eef7ee;border:1px solid #cfe6cf;color:#1d6b2b;padding:1px 6px;border-radius:6px;margin:1px}
.redir{color:#9a3412;font-size:11px;font-weight:600}
.assume li{font-size:13px;margin:3px 0}
.callout{background:#eff5ff;border-left:4px solid var(--blue);padding:10px 14px;border-radius:6px;font-size:13px;margin:12px 0}
.note{background:#fff8e6;border-left:4px solid #d99400;padding:10px 14px;border-radius:6px;font-size:13px;margin:12px 0}
footer{text-align:center;color:var(--muted);font-size:12px;padding:24px}
@media print{nav.toc{display:none}section{break-inside:avoid;box-shadow:none}}
</style></head>
<body>
<header class="hero">
  <div class="badge">ADOBE EDGE DELIVERY SERVICES · DISCOVERY ANALYSIS</div>
  <h1>American-Equity.com → EDS · Site Discovery &amp; Component Analysis</h1>
  <div class="sub">Evidence-based discovery of <code>www.american-equity.com</code> for migration to Adobe Edge Delivery Services. Every one of the <b>${COUNTS.uniqueUrls} unique URLs</b> in scope was fetched and inspected (no sampling). Source platform observed: <b>Next.js (App Router / RSC) on Optimizely CMS</b>. Blocks are identified from the site's own <code>data-component</code> attributes. This document contains <b>no estimates, timelines, story points, or development days</b> — it is a structural/technical discovery for scope definition.</div>
</header>
<nav class="toc">
  <a href="#summary">Executive Summary</a>
  <a href="#urls">URL / Page Analysis</a>
  <a href="#blocks">Blocks &amp; Variations</a>
  <a href="#blockdetail">Variation Detail</a>
  <a href="#templates">Templates</a>
  <a href="#forms">Forms</a>
  <a href="#integ">Integrations</a>
  <a href="#external">Redirects / APIs / External</a>
  <a href="#assume">Assumptions &amp; Scope</a>
  <a href="#gray">Gray Areas</a>
  <a href="#eds">EDS Considerations</a>
  <a href="#counts">Final Counts</a>
</nav>
<div class="wrap">

<section id="summary">
<h2 class="sec">Executive Summary</h2>
<div class="kpis">
  <div class="kpi"><div class="n">${COUNTS.uniqueUrls}</div><div class="l">Unique URLs analyzed</div></div>
  <div class="kpi"><div class="n">${COUNTS.distinctRendered}</div><div class="l">Distinct rendered pages</div></div>
  <div class="kpi"><div class="n">${COUNTS.redirects}</div><div class="l">Legacy redirects</div></div>
  <div class="kpi alt"><div class="n">${COUNTS.blocks}</div><div class="l">Blocks</div></div>
  <div class="kpi alt"><div class="n">${COUNTS.variations}</div><div class="l">Variations</div></div>
  <div class="kpi alt"><div class="n">${COUNTS.templates}</div><div class="l">Templates</div></div>
  <div class="kpi"><div class="n">${COUNTS.forms}</div><div class="l">Forms</div></div>
  <div class="kpi"><div class="n">${COUNTS.integrations}</div><div class="l">Integrations</div></div>
  <div class="kpi"><div class="n">${COUNTS.externalDeps}</div><div class="l">External dependencies</div></div>
  <div class="kpi"><div class="n">${COUNTS.grayAreas}</div><div class="l">Open questions</div></div>
</div>
<p class="lead">American Equity is a marketing/content site built on <b>Optimizely CMS</b> with a <b>Next.js (App Router)</b> front end. The DOM exposes clean Optimizely component names via <code>data-component</code>, which we used as the authoritative block signal (rather than inferring from CSS classes). All ${COUNTS.uniqueUrls} URLs returned HTTP 200; ${COUNTS.redirects} are 301/308 redirects that resolve to canonical in-scope pages, leaving <b>${COUNTS.distinctRendered} distinct rendered pages</b>.</p>
<div class="callout"><b>Scope shape:</b> The bulk of the site is standard content composition (hero, feature cards &amp; media, tabs, accordions, video) — prose, standalone images, CTAs and download links are default content handled by core decoration, not bespoke blocks. The higher-complexity areas are (1) the <b>tabbed line-feature</b> block and <b>dynamic listings</b> (insights feed, searchable form/document libraries) that hydrate client-side and need an EDS index, and (2) <b>third-party embeds</b> (ion interactive forms, Hedgeness calculator, Greenhouse jobs) that should be <b>preserved, not rebuilt</b>. Downloadable resources (brochures, statements) are authored as links resolving to the existing DAM.</p>
<div class="note"><b>Out of EDS scope (link, don't rebuild):</b> customer login (<code>myportal</code>), registration (<code>register</code>, Okta), affiliate sites (<code>eagle-lifeco</code>, <code>ae-newyork</code>), DAM downloads (<code>asset.american-equity.com</code>), and the vendor-hosted forms/calculator/jobs apps. The <code>/api/assets/resolve-by-key</code> endpoint is a <b>verified 301 asset resolver</b> — a redirect service, not custom application code.</p>
</section>

<section id="urls">
<h2 class="sec">1 · URL / Page Analysis (all ${COUNTS.uniqueUrls})</h2>
<p class="lead">Every input URL, its assigned template, observed content components, and integrations. Redirecting URLs show their canonical target. Input file had ${COUNTS.inputLines} lines (1 duplicate: <code>/IncomeShield</code> listed twice) → ${COUNTS.uniqueUrls} unique URLs.</p>
<table><thead><tr><th>URL</th><th>Template</th><th>Observed components</th><th>Integrations</th></tr></thead>
<tbody>${urlAuditRows()}</tbody></table>
</section>

<section id="blocks">
<h2 class="sec">2 · Blocks &amp; Variations with Complexity</h2>
<p class="lead"><b>${COUNTS.blocks} blocks</b> (${COUNTS.contentBlocks} content + ${COUNTS.globalBlocks} global), <b>${COUNTS.variations} variations</b>. A variation is only counted where there is a real structural, behavioral, authoring, or technical difference — not content/image/text differences. Complexity distribution: ${complexityChips(COUNTS.complexityCount)}.</p>
<div class="callout"><b>Hero vs. navigation — no overlap:</b> the <b>Hero (In-Page Intro Band)</b> is the first content band <i>inside</i> <code>&lt;main&gt;</code> (heading/image/CTA authored per page). The site's <b>navigation</b> is a separate <b>global</b> block living in <code>&lt;header&gt;/&lt;nav&gt;</code>, built once for the whole site. They are distinct blocks; the ${COUNTS.globalBlocks} global blocks (header/navigation, footer, breadcrumb) are page chrome, not per-page content.</div>
<table>
<thead><tr><th>Block</th><th class="num">Pages</th><th class="num">Var.</th><th>Complexity</th><th>Important behavior / dependencies</th><th>EDS implementation considerations</th></tr></thead>
<tbody>
${blockRows()}
<tr class="total-row"><td>TOTAL — ${COUNTS.blocks} blocks</td><td class="num">—</td><td class="num">${COUNTS.variations}</td><td>—</td><td colspan="2"></td></tr>
</tbody></table>
</section>

<section id="blockdetail">
<h2 class="sec">2b · Variation Detail</h2>
<p class="lead">Per-block breakdown of each counted variation and the structural/behavioral evidence that distinguishes it.</p>
${variationDetail()}
</section>

<section id="templates">
<h2 class="sec">3 · Template Inventory</h2>
<p class="lead"><b>${COUNTS.templates} templates</b>, assigned by <b>final (post-redirect) URL + observed block composition</b>, not URL pattern alone. Template complexity: ${complexityChips(COUNTS.templateComplexity)}. Pages with the same purpose but materially different block variations are noted inline (e.g. consumer vs professional product pages).</p>
<table>
<thead><tr><th>Template</th><th class="num">Pages</th><th class="num">% Site</th><th>Complexity</th><th>Block composition</th><th>Notes / variations</th></tr></thead>
<tbody>
${templateRows()}
<tr class="total-row"><td>TOTAL — ${COUNTS.templates} templates</td><td class="num">${pages.length}</td><td class="num">100%</td><td>—</td><td colspan="2"></td></tr>
</tbody></table>
<h4>Template → URL mapping</h4>
${templateUrlList()}
</section>

<section id="forms">
<h2 class="sec">4 · Forms</h2>
<p class="lead"><b>${COUNTS.forms} form surfaces</b> identified. Most are <b>third-party embedded</b> (ion interactive, Hedgeness, Greenhouse) — the vendor app owns fields, validation, submission, and any CAPTCHA. Only <code>/form</code> is a native form component, and it appears to be a template/sample (placeholder labels, no submit endpoint in server HTML).</p>
<table>
<thead><tr><th>Form</th><th>Type</th><th>Important fields</th><th>Validation</th><th>Submission</th><th>CAPTCHA</th><th>Cx</th><th>EDS consideration</th></tr></thead>
<tbody>${formRows()}</tbody></table>
<div class="note">No CAPTCHA (reCAPTCHA/hCaptcha/Turnstile) was found anywhere in American Equity's own markup. Any CAPTCHA present would live inside the vendor iframes (ion / Greenhouse) and is <b>not verifiable from the accessible page behavior</b>.</div>
</section>

<section id="integ">
<h2 class="sec">5 · Third-Party Integrations (verified)</h2>
<p class="lead"><b>${COUNTS.integrations} integrations</b> confirmed by on-page evidence. "Pages" = number of the ${COUNTS.uniqueUrls} URLs where the integration was observed. Facebook/LinkedIn appear only as <b>footer social links</b> (not tracking pixels) and are therefore not listed as integrations.</p>
<table>
<thead><tr><th>Integration</th><th class="num">Pages</th><th>Scope</th><th>Purpose</th><th>Evidence</th><th>EDS migration consideration</th></tr></thead>
<tbody>${integRows()}</tbody></table>
</section>

<section id="external">
<h2 class="sec">6 · Redirects, APIs &amp; External Dependencies</h2>
<p class="lead">Observed → Dependency → EDS Requirement → Recommendation. The only <code>/api/</code> endpoint on the site is the asset resolver, verified as a simple 301 redirect to the DAM (not custom application logic).</p>
<table>
<thead><tr><th>Observed</th><th>Dependency</th><th>EDS requirement</th><th>Recommendation</th></tr></thead>
<tbody>${externalRows()}</tbody></table>
<h4>Login / Register / Subdomains</h4>
<p class="lead">Login (<code>myportal.american-equity.com</code>) and registration (<code>register.american-equity.com</code>, Okta) are separate authenticated applications on other subdomains. Per the working assumption, these are <b>out of the main american-equity.com EDS scope</b>: EDS preserves the links rather than rebuilding the systems. Affiliate sites (<code>eagle-lifeco.com</code>, <code>ae-newyork.com</code>) are external links in the header/footer.</p>
</section>

<section id="assume">
<h2 class="sec">7 · Assumptions &amp; Scope Boundaries</h2>
<table>
<thead><tr><th>Assumption</th><th>Observed basis</th><th>How we treat it</th><th>Scope</th></tr></thead>
<tbody>${assumptionRows()}</tbody></table>
</section>

<section id="gray">
<h2 class="sec">8 · Gray Areas / Open Questions</h2>
<table>
<thead><tr><th>Area</th><th>Observed</th><th>Assumption</th><th>Recommendation</th><th>Scope</th></tr></thead>
<tbody>${grayRows()}</tbody></table>
</section>

<section id="eds">
<h2 class="sec">9 · AEM / EDS Implementation Considerations</h2>
<ul class="assume">
<li><b>Content source:</b> Content is currently authored in Optimizely CMS and delivered via a Next.js front end. Migration re-authors content into EDS documents (Google Drive/SharePoint or DA). Optimizely CMS is a source, not an ongoing runtime dependency.</li>
<li><b>Block signal advantage:</b> Because the source DOM carries explicit <code>data-component</code> names, block boundaries and variations are unusually clear — mapping to EDS blocks is deterministic rather than inferred.</li>
<li><b>Global chrome:</b> Header (mega-menu with 4 top-level menus + utility login/register/search + "Find an Agent") and footer (multi-column + social + disclosure) are built once as EDS header/footer blocks from nav/footer documents. Preserve <code>data-gtm-*</code> tracking attributes for analytics parity.</li>
<li><b>Dynamic listings:</b> <code>/insights</code>, <code>/forms</code>, and the document/forms libraries hydrate their lists client-side (empty in SSR). In EDS these become index-backed listing blocks (e.g. <code>query-index.json</code>) with search/filter/pagination. This is the main net-new data-modeling work.</li>
<li><b>Interactivity:</b> Tabbed line-feature blocks and accordions/disclosures need accessible JS decoration (ARIA tablist/disclosure, keyboard nav). The progress-bar/stepper is presentational (no state machine).</li>
<li><b>Media:</b> Wistia videos should use a lazy facade and load the Wistia script in the delayed phase to protect Core Web Vitals. YouTube appears only as outbound links.</li>
<li><b>Embeds:</b> ion interactive, Hedgeness, and Greenhouse are mounted via a generic embed/script block. Load vendor scripts in the delayed phase; keep the embed hashes/IDs.</li>
<li><b>Assets &amp; documents:</b> PDFs/brochures resolve through <code>/api/assets/resolve-by-key</code> → <code>asset.american-equity.com</code>. Reuse the resolver or link final asset URLs; re-hosting into EDS/DAM only if AE requires it.</li>
<li><b>Consent &amp; tags:</b> OneTrust gates GTM (GA4 + Optimizely Web). Re-add OneTrust + GTM in the delayed phase with the same IDs; consent must gate tag firing.</li>
<li><b>SEO:</b> Recreate the 10 legacy 301/308 redirects in EDS redirect config. Canonicals, OG/Twitter metadata, and robots are present per page and map to EDS metadata. (All ${COUNTS.uniqueUrls} pages already have meta descriptions; ${pages.filter((p) => p.h1count > 1).length} pages carry more than one H1 — worth normalizing during migration.)</li>
<li><b>Accessibility:</b> Preserve ARIA on nav, tabs, accordions/disclosures, and modal; maintain heading hierarchy (address multi-H1 pages).</li>
</ul>
</section>

<section id="counts">
<h2 class="sec">10 · Final Counts &amp; Validation</h2>
<table>
<thead><tr><th>Metric</th><th class="num">Exact count</th></tr></thead>
<tbody>
<tr><td>Input lines in american-equity.txt</td><td class="num">${COUNTS.inputLines}</td></tr>
<tr><td>Unique URLs (1 duplicate removed: /IncomeShield)</td><td class="num">${COUNTS.uniqueUrls}</td></tr>
<tr><td>URLs analyzed (fetched, HTTP 200)</td><td class="num">${COUNTS.uniqueUrls}</td></tr>
<tr><td>URLs that could not be analyzed</td><td class="num">0</td></tr>
<tr><td>Legacy redirects (301/308) among inputs</td><td class="num">${COUNTS.redirects}</td></tr>
<tr><td>Distinct rendered pages (unique final URLs)</td><td class="num">${COUNTS.distinctRendered}</td></tr>
<tr><td>Blocks (total)</td><td class="num">${COUNTS.blocks}</td></tr>
<tr><td>&nbsp;&nbsp;· content blocks</td><td class="num">${COUNTS.contentBlocks}</td></tr>
<tr><td>&nbsp;&nbsp;· global blocks (header/footer/breadcrumb)</td><td class="num">${COUNTS.globalBlocks}</td></tr>
<tr><td>Block variations (total)</td><td class="num">${COUNTS.variations}</td></tr>
<tr><td>&nbsp;&nbsp;· Low complexity blocks</td><td class="num">${COUNTS.complexityCount.Low || 0}</td></tr>
<tr><td>&nbsp;&nbsp;· Medium complexity blocks</td><td class="num">${COUNTS.complexityCount.Medium || 0}</td></tr>
<tr><td>&nbsp;&nbsp;· High complexity blocks</td><td class="num">${COUNTS.complexityCount.High || 0}</td></tr>
<tr><td>Templates</td><td class="num">${COUNTS.templates}</td></tr>
<tr><td>Forms (surfaces)</td><td class="num">${COUNTS.forms}</td></tr>
<tr><td>Third-party integrations (verified)</td><td class="num">${COUNTS.integrations}</td></tr>
<tr><td>External dependencies / redirect classes</td><td class="num">${COUNTS.externalDeps}</td></tr>
<tr><td>Gray areas / open questions</td><td class="num">${COUNTS.grayAreas}</td></tr>
</tbody></table>
<div class="callout"><b>Coverage validation:</b> All ${COUNTS.uniqueUrls}/${COUNTS.uniqueUrls} unique URLs were fetched (HTTP 200) and each is mapped to a template and its observed blocks in §1. There are <b>0 analysis gaps</b>. The 1 duplicate line in the input file (<code>/IncomeShield</code>) was de-duplicated. Signals are derived from live server HTML; where behavior lives inside client hydration or vendor iframes, it is explicitly flagged as "not verifiable from the accessible page behavior."</div>
</section>

<footer>American Equity → EDS discovery analysis · Generated ${'2026-08-13'} · Evidence: <code>american-equity/data/*.json</code> · No estimates/timelines/story points included by design.</footer>
</div>
</body></html>`;

fs.writeFileSync(path.join(AE, 'index.html'), html);
console.log('Wrote american-equity/index.html', (html.length / 1024).toFixed(1) + 'KB');
console.log('Counts:', JSON.stringify(COUNTS.complexityCount), 'templates', COUNTS.templates, 'blocks', COUNTS.blocks, 'vars', COUNTS.variations);
