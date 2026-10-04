import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ORIGIN } from './seo.mjs';

const START = '<!-- structured-data:start -->';
const END = '<!-- structured-data:end -->';
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'");
const text = html => decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const slug = s => text(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

// Give every lesson question a stable anchor so it can be linked to and shown by search engines as a jump link.
export function addAnchors(html) {
  const seen = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  return html.replace(/<h3>([\s\S]*?)<\/h3>/g, (whole, inner) => {
    let id = slug(inner);
    if (!id) return whole;
    for (let n = 2; seen.has(id); n++) id = `${slug(inner)}-${n}`;
    seen.add(id);
    return `<h3 id="${id}">${inner}</h3>`;
  });
}

export function faqEntries(html) {
  const out = [];
  for (const m of html.matchAll(/<div class="lesson">\s*<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)<\/div>/g)) {
    const q = text(m[1]);
    if (!q.endsWith('?')) continue;
    const a = [...m[2].matchAll(/<p>([\s\S]*?)<\/p>/g)].map(p => text(p[1])).filter(t => t && !t.startsWith('Citation:')).join(' ');
    if (a) out.push({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } });
  }
  return out;
}

export function buildBlock(file, html, modified) {
  const url = `${ORIGIN}/${file}`;
  const h1 = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1]);
  const description = html.match(/<meta name="description" content="([^"]*)"/)[1];
  const nodes = [{
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: h1.slice(0, 110),
    description: decode(description),
    url,
    mainEntityOfPage: url,
    inLanguage: 'en-US',
    dateModified: modified,
    author: { '@type': 'Person', name: 'Roy Williams' },
    isPartOf: { '@type': 'WebSite', name: 'Roy Can Help', url: `${ORIGIN}/` },
    image: `${ORIGIN}/og-image.png`,
  }, {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: text(html.match(/<title>([^<]*)<\/title>/)[1]).replace(/ \| Roy Can Help$/, ''), item: url },
    ],
  }];
  const faq = faqEntries(html);
  if (faq.length) nodes.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq });
  return `${START}\n${nodes.map(n => `  <script type="application/ld+json">${JSON.stringify(n)}</script>`).join('\n')}\n  ${END}`;
}

export function applyStructuredData(file, html, modified) {
  const body = html.includes(START) ? html.replace(new RegExp(` *${START}[\\s\\S]*?${END}\\n?`), '') : html;
  const anchored = file === 'roys-wisdom.html' ? addAnchors(body) : body;
  return anchored.replace('</head>', `  ${buildBlock(file, anchored, modified)}\n</head>`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] ?? 'site';
  const skip = new Set(['index.html']); // the homepage carries its own hand-written WebSite block
  for (const f of readdirSync(root).filter(f => f.endsWith('.html') && !skip.has(f))) {
    const p = join(root, f);
    const modified = execFileSync('git', ['log', '-1', '--format=%cs', '--', p], { encoding: 'utf8' }).trim();
    const before = readFileSync(p, 'utf8');
    const after = applyStructuredData(f, before, modified);
    if (after !== before) writeFileSync(p, after);
  }
}
