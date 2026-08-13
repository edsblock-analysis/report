// Build the evidence-based Template → Block → Variation mapping for American Equity.
// Derived by walking EVERY page's observed data-component set (data/pages.json) — not assumed.
// Each component is mapped to one of the 16 curated blocks (+ its variation), or flagged as
// default-content / third-party embed / global chrome so every component is accounted for.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const AE = path.join(ROOT, 'american-equity');
const pages = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'pages.json'), 'utf8'));
const ta = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'template-assignment.json'), 'utf8'));
const model = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'model.json'), 'utf8'));
const breadcrumb = JSON.parse(fs.readFileSync(path.join(AE, 'data', 'breadcrumb.json'), 'utf8'));

const templateOf = Object.fromEntries(ta.assign.map((a) => [a.path, a.template]));
const compsOf = Object.fromEntries(pages.map((p) => [p.path, p.components]));
const integsOf = Object.fromEntries(pages.map((p) => [p.path, p.integrations]));

// ---- component -> { block, variation, kind } ----
// kind: 'block' (one of 16 real blocks) | 'default' (core content) | 'embed' (3rd-party) | 'global'
const MAP = {
  // Hero
  heroHeaderSection: { block: 'Hero (In-Page Intro Band)', variation: 'Standard Hero', kind: 'block' },
  blogHeader: { block: 'Hero (In-Page Intro Band)', variation: 'Article Hero', kind: 'block' },
  heroHeader: { block: 'Hero (In-Page Intro Band)', variation: 'Simple Hero', kind: 'block' },
  // Feature Cards & Media
  featureCardsAndMediaRow: { block: 'Feature Cards & Media', variation: 'Media + copy row', kind: 'block' },
  featuredIconCard: { block: 'Feature Cards & Media', variation: 'Icon card grid', kind: 'block' },
  featuredImageCard: { block: 'Feature Cards & Media', variation: 'Image card grid', kind: 'block' },
  feature3SetsImage: { block: 'Feature Cards & Media', variation: '3-set image feature', kind: 'block' },
  featureSetCard: { block: 'Feature Cards & Media', variation: '3-set image feature', kind: 'block' },
  // Line-Tab Feature
  featureHorizontalLineTab: { block: 'Tabs (Tabbed Content)', variation: 'Horizontal line tabs', kind: 'block' },
  featureHorizontalLineTabCard: { block: 'Tabs (Tabbed Content)', variation: 'Horizontal line tabs', kind: 'block' },
  featureVerticalLineTab: { block: 'Tabs (Tabbed Content)', variation: 'Vertical line tabs', kind: 'block' },
  featureVerticalLineTabCard: { block: 'Tabs (Tabbed Content)', variation: 'Vertical line tabs', kind: 'block' },
  // Progress Bar / Stepper
  progressBar: { block: 'Progress Bar / Stepper', variation: 'Numbered step sequence', kind: 'block' },
  progressBarStep: { block: 'Progress Bar / Stepper', variation: 'Numbered step sequence', kind: 'block' },
  // Video
  videoBlock: { block: 'Video (Wistia)', variation: 'Inline Wistia video', kind: 'block' },
  // Metrics
  metrics: { block: 'Metrics / Stats', variation: 'Stat row', kind: 'block' },
  metricsCard: { block: 'Metrics / Stats', variation: 'Stat row', kind: 'block' },
  // Accordion / Disclosure
  accordion: { block: 'Accordion / Disclosure', variation: 'FAQ accordion', kind: 'block' },
  disclosure: { block: 'Accordion / Disclosure', variation: 'Disclosure / legal expander', kind: 'block' },
  // Blog Card / Related Posts
  relatedBlogPosts: { block: 'Blog Card / Related Posts', variation: 'Related posts strip', kind: 'block' },
  blogCard: { block: 'Blog Card / Related Posts', variation: 'Editorial card grid', kind: 'block' },
  // Searchable Form / Document Library
  formListing: { block: 'Searchable Form / Document Library', variation: 'Form listing w/ search + tabs', kind: 'block' },
  formTable: { block: 'Searchable Form / Document Library', variation: 'Form table directory', kind: 'block' },
  // Native form
  formInputModel: { block: 'Native Data-Entry Form (Form Input Model)', variation: 'Native form', kind: 'block' },
  // Contact
  contactCard: { block: 'Contact Card / Row', variation: 'Contact cards', kind: 'block' },
  contactRow: { block: 'Contact Card / Row', variation: 'Contact cards', kind: 'block' },
  // Modal
  generalModal: { block: 'Modal / Dialog', variation: 'General modal', kind: 'block' },
  // Dynamic listing — represented by blogHeader shell on /insights; tracked via template, keep as block on listing pages
  // (handled specially below)

  // ---- default content (core decoration; not bespoke blocks) ----
  richTextRow: { block: 'Rich Text (default content)', variation: '—', kind: 'default' },
  imageBlock: { block: 'Image (default content)', variation: '—', kind: 'default' },
  ctaBlock: { block: 'CTA / Button (default content)', variation: '—', kind: 'default' },
  anchorLinkTarget: { block: 'Anchor target (default content)', variation: '—', kind: 'default' },
  attachments: { block: 'Download links → DAM (default content)', variation: '—', kind: 'default' },
  brochure: { block: 'Download links → DAM (default content)', variation: '—', kind: 'default' },
  brochureTab: { block: 'Download links → DAM (default content)', variation: '—', kind: 'default' },
  brochureCard: { block: 'Download links → DAM (default content)', variation: '—', kind: 'default' },

  // ---- third-party embed (script mount; preserve, not rebuild) ----
  scriptRow: { block: 'Third-party embed (preserve)', variation: '—', kind: 'embed' },

  // ---- global chrome ----
  ContentArea: { block: '(layout wrapper)', variation: '—', kind: 'skip' },
  footerNavigationColumn: { block: 'Global Footer', variation: 'Multi-column footer', kind: 'global' },
  footerNavigationLink: { block: 'Global Footer', variation: 'Multi-column footer', kind: 'global' },
};

// scriptRow embed sub-type per page (from evidence gathered earlier)
const EMBED_BY_PATH = {
  '/professionals/material-request-form': 'ion interactive form',
  '/professionals/contact-us': 'ion interactive form',
  '/income-gap-calculator': 'Hedgeness calculator',
  '/professionals/tools-calculators/income-gap-calculator': 'Hedgeness calculator',
  '/about/careers/openings': 'Greenhouse job board',
};

// Build: template -> block -> { variations:Set, pages:Set, kind }
const tmap = {};
for (const [pth, comps] of Object.entries(compsOf)) {
  const tpl = templateOf[pth];
  if (!tpl) continue;
  tmap[tpl] = tmap[tpl] || { pages: new Set(), blocks: {} };
  tmap[tpl].pages.add(pth);
  const add = (block, variation, kind, page) => {
    tmap[tpl].blocks[block] = tmap[tpl].blocks[block] || { variations: {}, pages: new Set(), kind };
    tmap[tpl].blocks[block].kind = kind;
    tmap[tpl].blocks[block].pages.add(page);
    if (variation && variation !== '—') {
      tmap[tpl].blocks[block].variations[variation] = tmap[tpl].blocks[block].variations[variation] || new Set();
      tmap[tpl].blocks[block].variations[variation].add(page);
    }
  };
  for (const c of Object.keys(comps)) {
    const m = MAP[c];
    if (!m || m.kind === 'skip') continue;
    let variation = m.variation;
    if (c === 'scriptRow') variation = EMBED_BY_PATH[pth] || 'third-party embed';
    add(m.block, variation, m.kind, pth);
  }
  // Global header + breadcrumb are chrome present on all/most pages (breadcrumb from evidence)
  add('Global Header / Navigation (site chrome)', 'Mega-menu header', 'global', pth);
  if (breadcrumb[pth]) add('Breadcrumb', 'Breadcrumb trail', 'global', pth);
  // Dynamic listing block: only on the /insights-style pages (Content Listing template)
  if (tpl === 'Content Listing (Dynamic)') add('Dynamic Content Listing (Insights index)', 'Insights listing (client-fetched)', 'block', pth);
}

// serialize — mapping shows only REAL blocks (bespoke content blocks + global chrome).
// default-content components are excluded from the mapping (not blocks); third-party
// embeds are collapsed into a per-template `embeds` note rather than a block row.
const out = {};
for (const [tpl, d] of Object.entries(tmap)) {
  const embeds = d.blocks['Third-party embed (preserve)'];
  out[tpl] = {
    pageCount: d.pages.size,
    urls: [...d.pages].sort(),
    embeds: embeds ? Object.fromEntries(Object.entries(embeds.variations).map(([vn, s]) => [vn, s.size])) : null,
    blocks: Object.fromEntries(Object.entries(d.blocks)
      .filter(([, v]) => v.kind === 'block' || v.kind === 'global')
      .map(([b, v]) => [b, {
        kind: v.kind,
        pages: v.pages.size,
        variations: Object.fromEntries(Object.entries(v.variations).map(([vn, s]) => [vn, s.size])),
      }])
      .sort((a, b2) => b2[1].pages - a[1].pages)),
  };
}
fs.writeFileSync(path.join(AE, 'data', 'template-block-mapping.json'), JSON.stringify(out, null, 2));

// console preview
for (const [tpl, d] of Object.entries(out)) {
  console.log(`\n### ${tpl}  (${d.pageCount} pages)`);
  for (const [b, v] of Object.entries(d.blocks)) {
    const vs = Object.entries(v.variations).map(([n, c]) => `${n}(${c})`).join(', ');
    console.log(`  [${v.kind}] ${b} — ${v.pages}pg ${vs ? '· ' + vs : ''}`);
  }
}
console.log('\nWrote template-block-mapping.json');
