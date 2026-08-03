import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { hasNewQuestions } from '../synthesize.mjs';

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'repo-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir });
  git('init', '-b', 'main');
  git('config', 'user.email', 'test@test'); git('config', 'user.name', 'Test');
  mkdirSync(join(dir, 'site'), { recursive: true });
  writeFileSync(join(dir, 'site', 'ask-roy.html'), '<p>v1</p>');
  git('add', '.'); git('commit', '-m', 'seed');
  return dir;
}

test('hasNewQuestions returns true when ask-roy.html changed since marker', async () => {
  const dir = repo();
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  const markerHash = git('rev-parse', 'HEAD').trim();

  // Make a change to ask-roy.html
  writeFileSync(join(dir, 'site', 'ask-roy.html'), '<p>v2</p>');
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-m', 'update ask-roy'], { cwd: dir });

  const hasNew = await hasNewQuestions(dir, markerHash);
  assert.equal(hasNew, true);
});

test('hasNewQuestions returns false when ask-roy.html unchanged since marker', async () => {
  const dir = repo();
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  const markerHash = git('rev-parse', 'HEAD').trim();

  // Make a change to a different file
  writeFileSync(join(dir, 'other.txt'), 'change');
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-m', 'update other file'], { cwd: dir });

  const hasNew = await hasNewQuestions(dir, markerHash);
  assert.equal(hasNew, false);
});

test('hasNewQuestions returns true for null marker (first run)', async () => {
  const dir = repo();
  const hasNew = await hasNewQuestions(dir, null);
  assert.equal(hasNew, true);
});

test('hasNewQuestions treats invalid marker as first run', async () => {
  const dir = repo();
  const hasNew = await hasNewQuestions(dir, 'nonexistent0000000');
  assert.equal(hasNew, true);
});
