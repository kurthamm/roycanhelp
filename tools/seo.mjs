import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

export const ORIGIN = 'https://roycanhelp.org';
const TITLE_MAX = 65;
const DESC_MIN = 70;
const DESC_MAX = 160;

// Everything in the site folder is public. Planning notes, drafts and data exports must live outside it.
const PUBLIC_EXTENSIONS = new Set(['.html', '.css', '.js', '.json', '.xml', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.pdf', '.webmanifest']);
export function publicFileErrors(root) {
  const bad = [];
  const walk = dir => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (!PUBLIC_EXTENSIONS.has(extname(e.name).toLowerCase())) bad.push(`${p}: file type is not meant to be public; move it out of the site folder`);
    }
  };
  walk(root);
  return bad;
}

const pageFiles = root => readdirSync(root).filter(f => f.endsWith('.html')).sort();
const urlFor = file => (file === 'index.html' ? `${ORIGIN}/` : `${ORIGIN}/${file}`);
const attr = (html, re) => html.match(re)?.[1];

export function checkPage(file, html) {
  const e = [];
  const title = attr(html, /<title>([^<]*)<\/title>/i);
  const desc = attr(html, /<meta name="description" content="([^"]*)"/i);
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/i);
  const ogUrl = attr(html, /<meta property="og:url" content="([^"]*)"/i);
  const noindex = /<meta name="robots" content="[^"]*noindex/i.test(html);

  if (!title) e.push('missing <title>');
  else if (title.length > TITLE_MAX) e.push(`title is ${title.length} chars, max ${TITLE_MAX}`);
  if (!desc) e.push('missing meta description');
  else if (desc.length < DESC_MIN || desc.length > DESC_MAX) e.push(`meta description is ${desc.length} chars, want ${DESC_MIN}-${DESC_MAX}`);
  if (!noindex) {
    if (!canonical) e.push('missing canonical link');
    else if (canonical !== urlFor(file)) e.push(`canonical is ${canonical}, expected ${urlFor(file)}`);
    if (ogUrl && ogUrl !== canonical) e.push(`og:url ${ogUrl} does not match canonical`);
  }
  if (!attr(html, /<meta property="og:image" content="([^"]*)"/i)) e.push('missing og:image');
  const h1s = (html.match(/<h1[\s>]/gi) ?? []).length;
  if (h1s !== 1) e.push(`expected exactly one <h1>, found ${h1s}`);
  for (const img of html.match(/<img\b[^>]*>/gi) ?? []) {
    if (!/\balt="/i.test(img)) e.push(`<img> without alt: ${img.slice(0, 80)}`);
  }
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1]);
      if (j['@context'] !== 'https://schema.org' || !j['@type']) e.push('JSON-LD missing @context or @type');
    } catch (err) {
      e.push(`JSON-LD does not parse: ${err.message}`);
    }
  }
  return e;
}

export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
}

export function seoCheck(root) {
  const errors = [...publicFileErrors(root)];
  const indexable = [];
  for (const f of pageFiles(root)) {
    const html = readFileSync(join(root, f), 'utf8');
    for (const msg of checkPage(f, html)) errors.push(`${f}: ${msg}`);
    if (!/<meta name="robots" content="[^"]*noindex/i.test(html)) indexable.push(urlFor(f));
  }
  const robots = readFileSync(join(root, 'robots.txt'), 'utf8');
  if (!robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`)) errors.push('robots.txt: missing Sitemap line');
  const xml = readFileSync(join(root, 'sitemap.xml'), 'utf8');
  const listed = sitemapUrls(xml);
  for (const u of indexable) if (!listed.includes(u)) errors.push(`sitemap.xml: missing ${u}`);
  for (const u of listed) if (!indexable.includes(u)) errors.push(`sitemap.xml: lists ${u} which is not an indexable page`);
  for (const d of xml.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d[1])) errors.push(`sitemap.xml: bad lastmod ${d[1]}`);
  }
  return errors;
}

// Priority and change frequency are ignored by Google, so the generated sitemap carries only loc and lastmod.
export function buildSitemap(root, lastmodFor) {
  const urls = pageFiles(root)
    .filter(f => !/<meta name="robots" content="[^"]*noindex/i.test(readFileSync(join(root, f), 'utf8')))
    .map(f => `  <url>\n    <loc>${urlFor(f)}</loc>\n    <lastmod>${lastmodFor(f)}</lastmod>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

const gitDate = (root, f) =>
  execFileSync('git', ['log', '-1', '--format=%cs', '--', join(root, f)], { encoding: 'utf8' }).trim();

// Live audit: fetch what search engines fetch, report anything they would trip on.
export async function liveAudit(origin, fetchFn = fetch) {
  const errors = [];
  const get = (url, opts = {}) => fetchFn(url, { redirect: 'manual', ...opts });

  const robots = await get(`${origin}/robots.txt`);
  if (robots.status !== 200) errors.push(`robots.txt returned ${robots.status}`);
  const sm = await get(`${origin}/sitemap.xml`);
  if (sm.status !== 200) throw new Error(`sitemap.xml returned ${sm.status}`);
  const urls = sitemapUrls(await sm.text());
  if (!urls.length) throw new Error('sitemap.xml lists no URLs');

  for (const u of urls) {
    const t0 = Date.now();
    const r = await get(u);
    const ms = Date.now() - t0;
    if (r.status !== 200) { errors.push(`${u}: HTTP ${r.status}`); continue; }
    if (ms > 1500) errors.push(`${u}: slow response ${ms}ms`);
    if (/noindex/i.test(r.headers.get('x-robots-tag') ?? '')) errors.push(`${u}: served with noindex`);
    const html = await r.text();
    const file = u === `${origin}/` ? 'index.html' : u.slice(origin.length + 1);
    for (const msg of checkPage(file, html)) errors.push(`${u}: ${msg}`);
  }

  try {
    const www = await get(origin.replace('://', '://www.'));
    if (![301, 308].includes(www.status)) errors.push(`www host returned ${www.status}, expected a permanent redirect`);
  } catch (err) {
    if (err.cause?.code !== 'ENOTFOUND') throw err;
    errors.push('www host does not resolve in DNS; visitors typing www get nothing');
  }
  const http = await get(origin.replace('https:', 'http:'));
  if (![301, 308].includes(http.status)) errors.push(`http host returned ${http.status}, expected a permanent redirect`);
  const admin = await get(`${origin}/admin/`);
  if (!/noindex/i.test(admin.headers.get('x-robots-tag') ?? '')) errors.push('/admin/ is not served with noindex');
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, arg = cmd === 'live' ? ORIGIN : 'site'] = process.argv.slice(2);
  if (cmd === 'check') {
    const errs = seoCheck(arg);
    errs.forEach(x => console.error(x));
    process.exit(errs.length ? 1 : 0);
  } else if (cmd === 'sitemap') {
    writeFileSync(join(arg, 'sitemap.xml'), buildSitemap(arg, f => gitDate(arg, f)));
  } else if (cmd === 'live') {
    const errs = await liveAudit(arg);
    errs.forEach(x => console.error(x));
    console.log(errs.length ? `${errs.length} SEO problem(s)` : `live SEO audit clean for ${arg}`);
    process.exit(errs.length ? 1 : 0);
  } else {
    console.error('usage: seo.mjs check [dir] | sitemap [dir] | live [origin]');
    process.exit(2);
  }
}
