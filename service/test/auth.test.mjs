import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSession, verifySession, checkPassword } from '../auth.mjs';

test('round trip verifies', () => {
  const t = makeSession('s3cret');
  assert.equal(verifySession(t, 's3cret'), true);
});
test('wrong secret rejected', () => {
  assert.equal(verifySession(makeSession('a'), 'b'), false);
});
test('tampered and garbage tokens rejected', () => {
  const t = makeSession('s');
  assert.equal(verifySession(t.replace(/.$/, 'x'), 's'), false);
  assert.equal(verifySession('garbage', 's'), false);
});
test('expired token rejected', async () => {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() - 1000 })).toString('base64url');
  const { createHmac } = await import('node:crypto');
  const sig = createHmac('sha256', 's').update(payload).digest('base64url');
  assert.equal(verifySession(`${payload}.${sig}`, 's'), false);
});
test('password compare', () => {
  assert.equal(checkPassword('hunter2', 'hunter2'), true);
  assert.equal(checkPassword('hunter2', 'hunter3'), false);
  assert.equal(checkPassword('short', 'muchlongerpassword'), false);
});
