import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mountGptRelay } from '../gpt-relay.mjs';

const KEY = 'k'.repeat(40);

async function start(runTurn, commit = async () => 'abc123') {
  const app = express();
  const usage = [];
  mountGptRelay(app, {
    env: { GPT_ACTION_KEY: KEY, SITE_DIR: '/site', SITE_REPO_DIR: '/repo', USAGE_LOG: '/log' },
    runTurn, commit, logUsage: (f, row) => usage.push(row), origin: 'https://example.test',
  });
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, usage, close: () => server.close() };
}
const post = (base, body, key = KEY) => fetch(`${base}/api/gpt/message`, {
  method: 'POST', headers: { 'content-type': 'application/json', ...(key && { authorization: `Bearer ${key}` }) }, body: JSON.stringify(body),
});
async function poll(base, jobId) {
  for (let i = 0; i < 50; i++) {
    const r = await (await fetch(`${base}/api/gpt/message/${jobId}`, { headers: { authorization: `Bearer ${KEY}` } })).json();
    if (r.status !== 'running') return r;
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error('job never finished');
}

test('refuses to mount without a strong key', () => {
  assert.throws(() => mountGptRelay(express(), { env: { GPT_ACTION_KEY: 'short' } }), /at least 32/);
});

test('missing or wrong key is rejected', async () => {
  const s = await start(async () => ({}));
  assert.equal((await post(s.base, { message: 'hi' }, null)).status, 401);
  assert.equal((await post(s.base, { message: 'hi' }, 'x'.repeat(40))).status, 401);
  s.close();
});

test('openapi spec is public and declares bearer auth', async () => {
  const s = await start(async () => ({}));
  const spec = await (await fetch(`${s.base}/api/gpt/openapi.json`)).json();
  assert.equal(spec.openapi, '3.1.0');
  assert.ok(spec.paths['/api/gpt/message']);
  s.close();
});

test('message runs the editor, commits, and the reply is fetched by polling', async () => {
  const seen = [];
  const s = await start(async o => {
    seen.push(o);
    o.onText('First.'); o.onText('Second.');
    return { sessionId: 'sess1', usage: { input_tokens: 1, output_tokens: 2 }, summary: 'Second.' };
  });
  const r = await post(s.base, { message: 'What is next?' });
  assert.equal(r.status, 202);
  const done = await poll(s.base, (await r.json()).jobId);
  assert.equal(done.status, 'done');
  assert.equal(done.reply, 'First.\n\nSecond.');
  assert.equal(done.changedSite, true);
  assert.equal(seen[0].siteDir, '/site');
  assert.equal(s.usage[0].via, 'gpt');
  // the conversation continues in the same agent session
  await poll(s.base, (await (await post(s.base, { message: 'ok' })).json()).jobId);
  assert.equal(seen[1].sessionId, 'sess1');
  s.close();
});

test('second message while one is running gets 409', async () => {
  let release;
  const s = await start(() => new Promise(r => { release = () => r({}); }));
  const first = await post(s.base, { message: 'one' });
  assert.equal(first.status, 202);
  assert.equal((await post(s.base, { message: 'two' })).status, 409);
  release();
  s.close();
});

test('agent failure is reported, not hidden', async () => {
  const s = await start(async () => { throw new Error('boom'); });
  const done = await poll(s.base, (await (await post(s.base, { message: 'x' })).json()).jobId);
  assert.equal(done.status, 'error');
  assert.equal(done.error, 'boom');
  s.close();
});

test('bad message bodies are rejected', async () => {
  const s = await start(async () => ({}));
  assert.equal((await post(s.base, { message: '' })).status, 400);
  assert.equal((await post(s.base, { message: 'x'.repeat(9000) })).status, 400);
  assert.equal((await post(s.base, {})).status, 400);
  s.close();
});
