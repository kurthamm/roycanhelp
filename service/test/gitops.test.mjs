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

