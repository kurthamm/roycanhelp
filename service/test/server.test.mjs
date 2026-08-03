import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createApp } from '../server.mjs';

// Test fixture: temp git repo
function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'repo-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir });
  git('init', '-b', 'main');
  git('config', 'user.email', 'kurt@test');
  git('config', 'user.name', 'Kurt');
  writeFileSync(join(dir, 'a.txt'), 'v1');
  git('add', '.');
  git('commit', '-m', 'seed');
  return dir;
}

// Fake runTurn for testing
function fakeRunTurn() {
  return async ({ message, sessionId, onText, siteDir }) => {
    onText('first ');
    onText('delta');
    // Simulate agent making a change
    const { writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    writeFileSync(join(siteDir, 'chat.log'), `${message}\n`, { flag: 'a' });
    return {
      sessionId: sessionId || 'test-session-123',
      usage: { input_tokens: 10, output_tokens: 20 },
      summary: 'first delta',
    };
  };
}

// Helper to start server and get fetch
async function setupServer(env, runTurn) {
  const app = createApp({ env, runTurn });
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const baseUrl = `http://127.0.0.1:${port}`;
      const fetch = global.fetch;
      resolve({
        fetch,
        baseUrl,
        close: () => server.close(),
      });
    });
    server.on('error', reject);
  });
}

test('missing env vars throws error listing all missing', async () => {
  const env = { PORT: '3000' };
  assert.throws(
    () => createApp({ env, runTurn: fakeRunTurn() }),
    /ANTHROPIC_API_KEY.*CHAT_PASSWORD.*SESSION_SECRET.*SITE_DIR.*SITE_REPO_DIR.*USAGE_LOG/
  );
});

test('login with wrong password returns 401 and logs LOGIN FAIL', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn());
  try {
    let output = '';
    const originalLog = console.log;
    console.log = (...args) => {
      output += args.join(' ') + '\n';
      originalLog(...args);
    };

    const res = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password' }),
    });
    assert.equal(res.status, 401);
    assert.match(output, /LOGIN FAIL ip=/);
    console.log = originalLog;
  } finally {
    close();
  }
});

test('login with correct password sets session cookie', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn());
  try {
    const res = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    assert.equal(res.status, 200);
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie);
    assert.match(setCookie, /session=/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    assert.match(setCookie, /Secure/);
  } finally {
    close();
  }
});

test('GET / without auth returns login form', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn());
  try {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /login|password/i);
  } finally {
    close();
  }
});

test('GET / with valid auth returns chat.html', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn());
  try {
    // First login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');

    // Then access chat
    const res = await fetch(`${baseUrl}/`, {
      headers: { 'Cookie': setCookie.split(';')[0] },
    });
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /textarea|send|chat|localStorage/i);
  } finally {
    close();
  }
});

test('POST /api/message without auth returns 401', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn());
  try {
    const res = await fetch(`${baseUrl}/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello' }),
    });
    assert.equal(res.status, 401);
  } finally {
    close();
  }
});

test('POST /api/message with auth streams SSE, commits, and logs usage', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn());
  try {
    // First login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Send message
    const res = await fetch(`${baseUrl}/api/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ message: 'hello world' }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/event-stream');

    // Read SSE stream
    const text = await res.text();
    assert.match(text, /event: text\ndata: first /);
    assert.match(text, /event: text\ndata: delta/);
    assert.match(text, /event: done/);
    assert.match(text, /summary.*first delta/);
    assert.match(text, /committed.*true/);
    // Extract sessionId from done event
    const doneMatch = text.match(/event: done\ndata: ({.*?})\n\n/);
    assert.ok(doneMatch, 'done event contains JSON');
    const doneData = JSON.parse(doneMatch[1]);
    assert.ok(doneData.sessionId, 'done event contains sessionId');
  } finally {
    close();
  }
});

test('POST /api/message with sessionId resumes agent conversation', async () => {
  const repoDir = repo();
  let receivedSessionIds = [];
  const fakeRunTurnWithTracking = () => {
    return async ({ message, sessionId, onText, siteDir }) => {
      receivedSessionIds.push(sessionId);
      onText('response');
      const { writeFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      writeFileSync(join(siteDir, 'chat.log'), `${message}\n`, { flag: 'a' });
      return {
        sessionId: sessionId ? `resumed-${sessionId}` : 'new-session-456',
        usage: { input_tokens: 10, output_tokens: 20 },
        summary: 'response',
      };
    };
  };
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurnWithTracking());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // First message - no sessionId
    const res1 = await fetch(`${baseUrl}/api/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ message: 'first' }),
    });
    const text1 = await res1.text();
    const doneMatch1 = text1.match(/event: done\ndata: ({.*?})\n\n/);
    const doneData1 = JSON.parse(doneMatch1[1]);
    const firstSessionId = doneData1.sessionId;
    assert.equal(firstSessionId, 'new-session-456');

    // Second message - with sessionId from first response
    const res2 = await fetch(`${baseUrl}/api/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ message: 'second', sessionId: firstSessionId }),
    });
    const text2 = await res2.text();
    const doneMatch2 = text2.match(/event: done\ndata: ({.*?})\n\n/);
    const doneData2 = JSON.parse(doneMatch2[1]);
    assert.equal(doneData2.sessionId, `resumed-${firstSessionId}`);

    // Verify server received sessionIds correctly
    assert.equal(receivedSessionIds[0], undefined, 'first message has no sessionId');
    assert.equal(receivedSessionIds[1], firstSessionId, 'second message received sessionId');
  } finally {
    close();
  }
});

test('POST /api/undo without auth returns 401', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn());
  try {
    const res = await fetch(`${baseUrl}/api/undo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(res.status, 401);
  } finally {
    close();
  }
});

test('POST /api/undo with auth reverts last chat commit', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn());
  try {
    // Login and send message to create a chat commit
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Create a commit by sending a message
    const msgRes = await fetch(`${baseUrl}/api/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ message: 'test edit' }),
    });
    await msgRes.text();

    // Now undo
    const undoRes = await fetch(`${baseUrl}/api/undo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
    });
    assert.equal(undoRes.status, 200);
    const body = await undoRes.json();
    assert.ok(body.reverted);
  } finally {
    close();
  }
});

test('POST /api/undo on non-chat commit returns 409 with error', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Try to undo the seed commit (not made by chat)
    const undoRes = await fetch(`${baseUrl}/api/undo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
    });
    assert.equal(undoRes.status, 409);
    const body = await undoRes.text();
    assert.match(body, /not made by chat/);
  } finally {
    close();
  }
});
