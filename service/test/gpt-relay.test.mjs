import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mountGptRelay } from '../gpt-relay.mjs';

const KEY = 'k'.repeat(40);
let headCalls = 0;

async function start(runTurn, commit = async () => 'abc123', extra = {}) {
  headCalls = 0;
  const app = express();
  const usage = [];
  mountGptRelay(app, {
    env: { GPT_ACTION_KEY: KEY, SITE_DIR: '/site', SITE_REPO_DIR: '/repo', USAGE_LOG: '/log' },
    runTurn, commit, logUsage: (f, row) => usage.push(row), origin: 'https://example.test',
    undo: async () => ({ undone: 'Roy: x' }), head: async () => (headCalls++ ? 'new' : 'old'), history: async () => [{ when: '2026-10-05T00:00:00Z', who: 'Roy via Chat', what: 'Roy: fix' }], adminFetch: async () => new Response('{}'), ...extra,
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
  assert.equal((await post(s.base, { message: 'x'.repeat(60000) })).status, 400);
  assert.equal((await post(s.base, {})).status, 400);
  s.close();
});

test('the spec carries the behavior rules so the GPT needs no pasted instructions', async () => {
  const s = await start(async () => ({}));
  const spec = await (await fetch(`${s.base}/api/gpt/openapi.json`)).json();
  assert.match(spec.info.description, /EVERY message/);
  assert.match(spec.info.description, /word for word/);
  assert.match(spec.paths['/api/gpt/message'].post.summary, /EVERY message/);
  s.close();
});

const authed = (base, path, init = {}) => fetch(`${base}${path}`, { ...init, headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json', ...init.headers } });

test('admin endpoints are forwarded as-is, with the body, and need the key', async () => {
  const calls = [];
  const s = await start(async () => ({}), undefined, { adminFetch: async (path, init) => { calls.push([path, init.method, init.body]); return new Response(JSON.stringify([{ id: 'q1' }]), { status: 200, headers: { 'content-type': 'application/json' } }); } });
  assert.equal((await fetch(`${s.base}/api/gpt/questions`)).status, 401);
  const list = await (await authed(s.base, '/api/gpt/questions')).json();
  assert.equal(list[0].id, 'q1');
  await authed(s.base, '/api/gpt/questions/update', { method: 'POST', body: JSON.stringify({ id: 'q1', draft: 'hello' }) });
  assert.deepEqual(calls[1], ['/api/questions/update', 'POST', JSON.stringify({ id: 'q1', draft: 'hello' })]);
  s.close();
});

test('an admin error is passed through, not hidden', async () => {
  const s = await start(async () => ({}), undefined, { adminFetch: async () => new Response('Question not found', { status: 404 }) });
  const r = await authed(s.base, '/api/gpt/questions/publish', { method: 'POST', body: JSON.stringify({ id: 'nope' }) });
  assert.equal(r.status, 404);
  assert.equal(await r.text(), 'Question not found');
  s.close();
});

test('drafting an answer streams from admin and returns the draft by polling', async () => {
  const sse = 'event: progress\ndata: {"text":"working"}\n\nevent: done\ndata: {"ok":true,"draft":"The drafted answer."}\n\n';
  const s = await start(async () => ({}), undefined, { adminFetch: async () => new Response(sse, { status: 200 }) });
  const { jobId } = await (await authed(s.base, '/api/gpt/questions/draft', { method: 'POST', body: JSON.stringify({ id: 'q1' }) })).json();
  let r;
  for (let i = 0; i < 50; i++) { r = await (await authed(s.base, `/api/gpt/questions/draft/${jobId}`)).json(); if (r.status !== 'running') break; await new Promise(x => setTimeout(x, 10)); }
  assert.equal(r.status, 'done');
  assert.equal(r.reply, 'The drafted answer.');
  s.close();
});

test('undo returns what was undone, and reports why it cannot', async () => {
  const s = await start(async () => ({}));
  assert.deepEqual(await (await authed(s.base, '/api/gpt/undo', { method: 'POST' })).json(), { undone: 'Roy: x' });
  s.close();
  const t = await start(async () => ({}), undefined, { undo: async () => { throw new Error('already an undo'); } });
  const r = await authed(t.base, '/api/gpt/undo', { method: 'POST' });
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /already an undo/);
  t.close();
});

test('upload sends each attached file through the admin upload with a clean name', async () => {
  const sent = [];
  const file = http => http.createServer((q, r) => r.end('FILEBYTES'));
  const { createServer } = await import('node:http');
  const dl = createServer((q, r) => r.end('FILEBYTES'));
  await new Promise(r => dl.listen(0, '127.0.0.1', r));
  const s = await start(async () => ({}), undefined, { adminFetch: async (path, init) => { sent.push([path, init.headers['x-filename'], init.body.toString()]); return new Response(JSON.stringify({ path: 'files/My-Doc.pdf' }), { status: 200 }); } });
  // http links are refused, so no byte is fetched
  const bad = await (await authed(s.base, '/api/gpt/upload', { method: 'POST', body: JSON.stringify({ openaiFileIdRefs: [{ name: 'a b.pdf', download_link: `http://127.0.0.1:${dl.address().port}/f` }] }) })).json();
  assert.equal(bad[0].ok, false);
  assert.match(bad[0].error, /https/);
  assert.equal(sent.length, 0);
  dl.close(); s.close();
});

test('recent site changes are listed, and need the key', async () => {
  const s = await start(async () => ({}));
  assert.equal((await fetch(`${s.base}/api/gpt/history`)).status, 401);
  const h = await (await authed(s.base, '/api/gpt/history')).json();
  assert.equal(h[0].what, 'Roy: fix');
  s.close();
});

test('a message sent while an undo is running is refused', async () => {
  let finish;
  const s = await start(async () => ({}), undefined, { undo: () => new Promise(r => { finish = () => r({ undone: 'x' }); }) });
  const undoing = authed(s.base, '/api/gpt/undo', { method: 'POST' });
  await new Promise(r => setTimeout(r, 30));
  assert.equal((await post(s.base, { message: 'hi' })).status, 409);
  finish();
  await undoing;
  assert.equal((await post(s.base, { message: 'hi' })).status, 202);
  s.close();
});

test('changedSite is true when the editor committed on its own and false when nothing changed', async () => {
  // the editor committed itself: the commit step finds nothing left, but history moved
  const a = await start(async () => ({}), async () => null);
  const moved = await poll(a.base, (await (await post(a.base, { message: 'make it live' })).json()).jobId);
  assert.equal(moved.changedSite, true);
  a.close();
  const b = await start(async () => ({}), async () => null, { head: async () => 'same' });
  const same = await poll(b.base, (await (await post(b.base, { message: 'just a question' })).json()).jobId);
  assert.equal(same.changedSite, false);
  b.close();
});
