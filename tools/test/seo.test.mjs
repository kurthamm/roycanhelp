import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPage, seoCheck, buildSitemap, liveAudit, ORIGIN } from '../seo.mjs';

const DESC = 'A description that is comfortably long enough to satisfy the minimum length rule for search snippets.';
const page = (file, extra = '') => `<!doctype html><html lang="en"><head><title>Page | Roy Can Help</title>
<meta name="description" content="${DESC}">
<link rel="canonical" href="${ORIGIN}/${file}">
<meta property="og:url" content="${ORIGIN}/${file}">
<meta property="og:image" content="${ORIGIN}/og-image.png">${extra}</head><body><h1>Hi</h1></body></html>`;

function site(files) {
  const dir = mkdtempSync(join(tmpdir(), 'seo-'));
  for (const [k, v] of Object.entries(files)) writeFileSync(join(dir, k), v);
  return dir;
}
const SM = urls => `<urlset>${urls.map(u => `<url><loc>${ORIGIN}/${u}</loc><lastmod>2026-01-01</lastmod></url>`).join('')}</urlset>`;
const ROBOTS = `Sitemap: ${ORIGIN}/sitemap.xml`;

test('clean page passes', () => assert.deepEqual(checkPage('a.html', page('a.html')), []));

test('missing description, wrong canonical, bad JSON-LD, missing alt all reported', () => {
  const html = page('a.html', '<script type="application/ld+json">{oops</script>')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace(`${ORIGIN}/a.html"`, `${ORIGIN}/b.html"`)
    .replace('<h1>Hi</h1>', '<h1>Hi</h1><img src="x.png">');
  const msgs = checkPage('a.html', html).join('\n');
  assert.match(msgs, /missing meta description/);
  assert.match(msgs, /canonical is .*b\.html/);
  assert.match(msgs, /JSON-LD does not parse/);
  assert.match(msgs, /without alt/);
});

test('sitemap must list every indexable page and nothing else', () => {
  const dir = site({ 'a.html': page('a.html'), 'b.html': page('b.html'), 'robots.txt': ROBOTS, 'sitemap.xml': SM(['a.html', 'gone.html']) });
  const errs = seoCheck(dir).join('\n');
  assert.match(errs, /missing .*b\.html/);
  assert.match(errs, /lists .*gone\.html/);
});

test('noindex pages are excluded from the generated sitemap', () => {
  const dir = site({ 'a.html': page('a.html'), 'b.html': page('b.html', '<meta name="robots" content="noindex">') });
  const xml = buildSitemap(dir, () => '2026-02-02');
  assert.match(xml, /a\.html/);
  assert.doesNotMatch(xml, /b\.html/);
});

test('live audit flags a 404 page and an unredirected www host', async () => {
  const ok = (body, status = 200, headers = {}) => new Response(body, { status, headers });
  const fake = async url => {
    if (url.endsWith('/sitemap.xml')) return ok(SM(['a.html', 'b.html']));
    if (url.endsWith('/robots.txt')) return ok(ROBOTS);
    if (url.endsWith('/a.html')) return ok(page('a.html'));
    if (url.endsWith('/b.html')) return ok('nope', 404);
    if (url.includes('/admin/')) return ok('', 200, { 'x-robots-tag': 'noindex' });
    if (url.includes('www.')) return ok('', 200);
    return ok('', 301);
  };
  const errs = (await liveAudit(ORIGIN, fake)).join('\n');
  assert.match(errs, /b\.html: HTTP 404/);
  assert.match(errs, /www host returned 200/);
  assert.doesNotMatch(errs, /a\.html/);
});

test('live audit throws when the sitemap is unreachable', async () => {
  await assert.rejects(liveAudit(ORIGIN, async () => new Response('', { status: 500 })), /sitemap\.xml returned 500/);
});
