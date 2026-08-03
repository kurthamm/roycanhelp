import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkSite } from '../check-site.mjs';

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'site-'));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return dir;
}

const GOOD = '<!doctype html><html lang="en"><head><title>T</title></head><body><a href="other.html">x</a></body></html>';

test('clean site passes', () => {
  const dir = fixture({ 'index.html': GOOD, 'other.html': GOOD.replace('other.html', 'index.html') });
  assert.deepEqual(checkSite(dir), []);
});

test('broken internal link reported', () => {
  const dir = fixture({ 'index.html': GOOD }); // other.html missing
  const errs = checkSite(dir);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /index\.html.*other\.html/);
});

test('missing title and bad js reported', () => {
  const dir = fixture({
    'index.html': '<!doctype html><html lang="en"><body><script src="js/a.js"></script></body></html>',
    'js/a.js': 'function ( {',
  });
  const errs = checkSite(dir);
  assert.ok(errs.some(e => /title/i.test(e)));
  assert.ok(errs.some(e => /a\.js/.test(e)));
});
