import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { commitAll, lastChange } from '../gitops.mjs';

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'repo-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir });
  git('init', '-b', 'main');
  git('config', 'user.email', 'kurt@test'); git('config', 'user.name', 'Kurt');
  writeFileSync(join(dir, 'a.txt'), 'v1');
  git('add', '.'); git('commit', '-m', 'seed');
  return dir;
}

test('commitAll commits as chat author, null when clean', async () => {
  const dir = repo();
  writeFileSync(join(dir, 'a.txt'), 'v2');
  const hash = await commitAll(dir, 'Roy: edited a.txt');
  assert.match(hash, /^[0-9a-f]{7,}/);
  assert.equal((await lastChange(dir)).author, 'Roy via Chat');
  assert.equal(await commitAll(dir, 'nothing'), null);
});


import { undoLast, recentChanges } from '../gitops.mjs';
import { execFileSync as run } from 'node:child_process';
import { mkdtempSync as mk, writeFileSync as wf } from 'node:fs';
import { tmpdir as td } from 'node:os';
import { join as j } from 'node:path';

function undoRepo() {
  const dir = mk(j(td(), 'undo-'));
  const g = (...a) => run('git', a, { cwd: dir, encoding: 'utf8' });
  g('init', '-b', 'main'); g('config', 'user.email', 'k@x'); g('config', 'user.name', 'K');
  wf(j(dir, 'a.txt'), 'v1'); g('add', '.'); g('commit', '-m', 'start');
  return { dir, g };
}

test('undoLast reverts an editor change once and refuses to undo an undo', async () => {
  const { dir, g } = undoRepo();
  wf(j(dir, 'a.txt'), 'v2'); g('add', '.');
  g('commit', '--author', 'Roy via Chat <chat@roycanhelp.org>', '-m', 'Roy: change a');
  assert.deepEqual(await undoLast(dir), { undone: 'Roy: change a' });
  assert.equal(run('cat', [j(dir, 'a.txt')], { encoding: 'utf8' }), 'v1');
  await assert.rejects(undoLast(dir), /already an undo/);
  assert.equal((await recentChanges(dir, 5))[0].what, 'Revert "Roy: change a"');
});

test('undoLast refuses a change that did not come from the editor', async () => {
  const { dir, g } = undoRepo();
  wf(j(dir, 'a.txt'), 'v2'); g('add', '.'); g('commit', '-m', 'manual change');
  await assert.rejects(undoLast(dir), /not made through the editor/);
});

test('a failed undo reports the error and leaves no revert in progress', async () => {
  const { dir, g } = undoRepo();
  wf(j(dir, 'a.txt'), 'v2'); g('add', '.');
  g('commit', '--author', 'Roy via Chat <chat@roycanhelp.org>', '-m', 'Roy: change a');
  wf(j(dir, 'a.txt'), 'uncommitted edit'); // revert refuses to overwrite local changes
  await assert.rejects(undoLast(dir));
  assert.throws(() => g('rev-parse', '-q', '--verify', 'REVERT_HEAD'));
  assert.equal(g('log', '-1', '--format=%s').trim(), 'Roy: change a');
});
