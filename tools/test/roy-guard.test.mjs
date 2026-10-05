import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkRemovedStayRemoved, checkRoyTextUntouched, plain } from '../roy-guard.mjs';

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'roy-'));
  mkdirSync(join(dir, 'site'));
  const g = (author, ...a) => execFileSync('git', ['-c', `user.name=${author}`, '-c', 'user.email=a@x', ...a], { cwd: dir, encoding: 'utf8' });
  g('Kurt', 'init', '-b', 'main');
  const save = (html) => writeFileSync(join(dir, 'site/a.html'), html);
  const commit = (author, msg) => { g(author, 'add', '-A'); g(author, 'commit', '-q', '--author', `${author} <a@x>`, '-m', msg); };
  return { dir, g, save, commit };
}
const page = body => `<html><body>\n${body}\n</body></html>\n`;
const LINE_A = '<p>The original sentence that Kurt wrote long ago, about the school meeting.</p>';
const ROY_LINE = '<p>Roy wrote this sentence himself about recording every IEP meeting with a tape recorder.</p>';
const GONE = '<p>This paragraph was total nonsense and Roy asked the editor to remove it from the page.</p>';

test('text Roy removed may not come back, unless Roy brings it back himself', () => {
  const r = repo();
  r.save(page(`${LINE_A}\n${GONE}`)); r.commit('Kurt', 'start');
  r.save(page(LINE_A)); r.commit('Roy via Chat', 'Roy: remove the nonsense');
  assert.deepEqual(checkRemovedStayRemoved(r.dir), []);
  r.save(page(`${LINE_A}\n${GONE}`)); r.commit('Kurt', 'oops puts it back');
  const errs = checkRemovedStayRemoved(r.dir);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /Roy removed this on purpose/);
  r.save(page(`${LINE_A}\n${GONE}`)); // Roy re-adds it on purpose later
  r.save(page(LINE_A)); r.commit('Roy via Chat', 'Roy: remove again');
  r.save(page(`${LINE_A}\n${GONE}`)); r.commit('Roy via Chat', 'Roy: actually keep it');
  assert.deepEqual(checkRemovedStayRemoved(r.dir), []);
});

test('rewriting or deleting a line Roy wrote is caught; markup-only changes and additions are not', () => {
  const r = repo();
  r.save(page(`${LINE_A}\n`)); r.commit('Kurt', 'start');
  const base0 = r.g('Kurt', 'rev-parse', 'HEAD').trim();
  r.save(page(`${LINE_A}\n${ROY_LINE}`)); r.commit('Roy via Chat', 'Roy: adds his tape recorder tip');
  const base = r.g('Kurt', 'rev-parse', 'HEAD').trim();

  r.save(page(`${LINE_A}\n<p class="x">Roy wrote this sentence himself about recording every IEP meeting with a tape recorder.</p>\n<p>A brand new extra sentence nobody had written before this change.</p>`));
  r.commit('Kurt', 'markup only plus an addition');
  assert.deepEqual(checkRoyTextUntouched(r.dir, base), []);

  r.save(page(`${LINE_A}\n<p>Someone else rewrote what Roy said about the tape recorder entirely.</p>`));
  r.commit('Kurt', 'rewrite');
  const errs = checkRoyTextUntouched(r.dir, base);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /this is Roy's text/);
  assert.deepEqual(checkRoyTextUntouched(r.dir, base0).length, 0); // Kurt's own old line was not touched
});

test('commits Roy later reverted do not count as his removals', () => {
  const r = repo();
  r.save(page(`${LINE_A}\n${GONE}`)); r.commit('Kurt', 'start');
  r.save(page(LINE_A)); r.commit('Roy via Chat', 'Roy: temporary removal');
  r.g('Roy via Chat', 'revert', '--no-edit', 'HEAD');
  assert.deepEqual(checkRemovedStayRemoved(r.dir), []);
});

test('plain() ignores markup, case and spacing', () => {
  assert.equal(plain('<p class="a">Hello   <b>World</b></p>'), 'hello world');
});
