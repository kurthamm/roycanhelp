import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { logUsage, readUsage } from '../usage.mjs';

test('logUsage appends JSON lines and readUsage reads them back', () => {
  const dir = mkdtempSync(join(tmpdir(), 'usage-'));
  const file = join(dir, 'usage.jsonl');

  const record1 = { ts: 1234567890, sessionId: 'session1', input_tokens: 100, output_tokens: 50 };
  const record2 = { ts: 1234567891, sessionId: 'session2', input_tokens: 200, output_tokens: 75 };

  logUsage(file, record1);
  logUsage(file, record2);

  const records = readUsage(file);
  assert.equal(records.length, 2);
  assert.deepEqual(records[0], record1);
  assert.deepEqual(records[1], record2);
});

test('readUsage returns empty array for missing file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'usage-'));
  const file = join(dir, 'nonexistent.jsonl');

  // Missing file is a legitimate empty state, not an error
  const records = readUsage(file);
  assert.deepEqual(records, []);
});
