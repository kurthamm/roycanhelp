import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createApp } from '../server.mjs';

// Minimal PNG buffer (1x1 transparent pixel)
const MINIMAL_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

// Minimal PDF buffer (valid PDF header)
const MINIMAL_PDF = Buffer.from('%PDF-1.4\n%EOF\n', 'utf8');

// Minimal DOCX buffer (ZIP-based format with valid magic bytes)
const MINIMAL_DOCX = Buffer.from([
  0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00,
  0x21, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x0b, 0x00, 0x00, 0x00, 0x5b, 0x43, 0x6f, 0x6e, 0x74, 0x65,
  0x6e, 0x74, 0x5f, 0x54, 0x79, 0x70, 0x65, 0x73, 0x5d, 0x2e, 0x78, 0x6d,
  0x6c, 0x50, 0x4b, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01,
  0x39, 0x00, 0x00, 0x00, 0x31, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

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

// Fake runDraftTurn for testing
function fakeRunDraftTurn() {
  return async ({ message, siteDir, onText }) => {
    // Simulate a drafted answer
    onText('This is a drafted answer based on the site content.');
    return {
      usage: { input_tokens: 20, output_tokens: 30 },
      summary: 'This is a drafted answer based on the site content.',
    };
  };
}

// Helper to start server and get fetch
async function setupServer(env, runTurn, runDraftTurn) {
  const app = createApp({ env, runTurn, runDraftTurn });
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
    /ANTHROPIC_API_KEY.*CHAT_PASSWORD.*SESSION_SECRET.*SITE_DIR.*SITE_REPO_DIR.*USAGE_LOG.*QUESTIONS_FILE/
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
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
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
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
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
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
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
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
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
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
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
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
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
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
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

test('POST /api/upload without auth returns 401', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    const res = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: { 'X-Filename': 'test.png' },
      body: MINIMAL_PNG,
    });
    assert.equal(res.status, 401);
  } finally {
    close();
  }
});

test('POST /api/upload with auth and valid png creates file and commit', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Upload image
    const uploadRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'X-Filename': 'test.png',
        'Cookie': sessionCookie,
      },
      body: MINIMAL_PNG,
    });
    assert.equal(uploadRes.status, 200);
    const data = await uploadRes.json();
    assert.equal(data.path, 'images/test.png');

    // Verify file exists
    const imagePath = join(repoDir, 'images', 'test.png');
    assert.ok(existsSync(imagePath));
    const content = readFileSync(imagePath);
    assert.deepStrictEqual(content, MINIMAL_PNG);

    // Verify commit was made
    const git = (...a) => execFileSync('git', a, { cwd: repoDir, encoding: 'utf8' });
    const stdout = git('log', '-1', '--oneline');
    assert.match(stdout, /Roy: uploaded/);
  } finally {
    close();
  }
});

test('POST /api/upload with path traversal filename returns 400', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Try to upload with path traversal
    const uploadRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'X-Filename': '../evil.png',
        'Cookie': sessionCookie,
      },
      body: MINIMAL_PNG,
    });
    assert.equal(uploadRes.status, 400);
  } finally {
    close();
  }
});

test('POST /api/upload with unsupported format returns 415', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Try to upload unsupported format
    const uploadRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'X-Filename': 'bad.exe',
        'Cookie': sessionCookie,
      },
      body: MINIMAL_PNG,
    });
    assert.equal(uploadRes.status, 415);
  } finally {
    close();
  }
});

test('POST /api/upload with duplicate filename returns 409', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // First upload
    const uploadRes1 = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'X-Filename': 'test.png',
        'Cookie': sessionCookie,
      },
      body: MINIMAL_PNG,
    });
    assert.equal(uploadRes1.status, 200);

    // Duplicate upload
    const uploadRes2 = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'X-Filename': 'test.png',
        'Cookie': sessionCookie,
      },
      body: MINIMAL_PNG,
    });
    assert.equal(uploadRes2.status, 409);
  } finally {
    close();
  }
});

test('POST /api/upload with >15MB stream returns 413 and no file written', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Create a large buffer (16 MB) by streaming chunks
    const chunkSize = 1024 * 1024; // 1 MB chunks
    const numChunks = 17; // 17 MB total
    const largeBuffer = Buffer.alloc(numChunks * chunkSize);

    // Upload oversized file
    const uploadRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'X-Filename': 'toolarge.png',
        'Cookie': sessionCookie,
      },
      body: largeBuffer,
    });
    assert.equal(uploadRes.status, 413);

    // Verify file was NOT written
    const imagePath = join(repoDir, 'images', 'toolarge.png');
    assert.equal(existsSync(imagePath), false, 'File should not be written');
  } finally {
    close();
  }
});

test('POST /api/upload with pdf creates file in files/ and commit', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Upload PDF
    const uploadRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'X-Filename': 'document.pdf',
        'Cookie': sessionCookie,
      },
      body: MINIMAL_PDF,
    });
    assert.equal(uploadRes.status, 200);
    const data = await uploadRes.json();
    assert.equal(data.path, 'files/document.pdf');

    // Verify file exists in files/ directory
    const filePath = join(repoDir, 'files', 'document.pdf');
    assert.ok(existsSync(filePath));
    const content = readFileSync(filePath);
    assert.deepStrictEqual(content, MINIMAL_PDF);

    // Verify commit was made
    const git = (...a) => execFileSync('git', a, { cwd: repoDir, encoding: 'utf8' });
    const stdout = git('log', '-1', '--oneline');
    assert.match(stdout, /Roy: uploaded/);
  } finally {
    close();
  }
});

test('POST /api/upload with docx creates file in files/', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Upload DOCX
    const uploadRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'X-Filename': 'document.docx',
        'Cookie': sessionCookie,
      },
      body: MINIMAL_DOCX,
    });
    assert.equal(uploadRes.status, 200);
    const data = await uploadRes.json();
    assert.equal(data.path, 'files/document.docx');

    // Verify file exists in files/ directory
    const filePath = join(repoDir, 'files', 'document.docx');
    assert.ok(existsSync(filePath));
  } finally {
    close();
  }
});

test('POST /api/upload with unsupported document format returns 415', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Try to upload unsupported doc format
    const uploadRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'X-Filename': 'bad.exe',
        'Cookie': sessionCookie,
      },
      body: MINIMAL_PDF,
    });
    assert.equal(uploadRes.status, 415);
  } finally {
    close();
  }
});

test('login page submits to a relative path (works behind /admin/ prefix)', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    const res = await fetch(`${baseUrl}/`);
    const html = await res.text();
    assert.match(html, /fetch\('api\/login'/);
    assert.doesNotMatch(html, /action="\/api\/login"/);
  } finally {
    close();
  }
});

test('POST /api/ask without honeypot stores question with id and ts', async () => {
  const repoDir = repo();
  const questionsFile = join(repoDir, 'questions.jsonl');
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: questionsFile,
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    const res = await fetch(`${baseUrl}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Where can I find help?', consent: true, website: '' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);

    const content = readFileSync(questionsFile, 'utf8');
    const lines = content.trim().split('\n');
    assert.equal(lines.length, 1);
    const q = JSON.parse(lines[0]);
    assert.ok(q.id, 'question has id');
    assert.ok(q.ts, 'question has ts');
    assert.equal(q.question, 'Where can I find help?');
  } finally {
    close();
  }
});

test('POST /api/ask with honeypot (website non-empty) returns 200 but stores nothing', async () => {
  const repoDir = repo();
  const questionsFile = join(repoDir, 'questions.jsonl');
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: questionsFile,
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    const res = await fetch(`${baseUrl}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'This is spam', consent: true, website: 'http://spam.com' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);

    // Verify nothing was stored
    assert.equal(existsSync(questionsFile), false, 'questions file should not exist');
  } finally {
    close();
  }
});

test('POST /api/ask with empty question returns 400', async () => {
  const repoDir = repo();
  const questionsFile = join(repoDir, 'questions.jsonl');
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: questionsFile,
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    const res = await fetch(`${baseUrl}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '', consent: true, website: '' }),
    });
    assert.equal(res.status, 400);
  } finally {
    close();
  }
});

test('POST /api/ask with >2000 char question returns 413', async () => {
  const repoDir = repo();
  const questionsFile = join(repoDir, 'questions.jsonl');
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: questionsFile,
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    const longQuestion = 'a'.repeat(2001);
    const res = await fetch(`${baseUrl}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: longQuestion, consent: true, website: '' }),
    });
    assert.equal(res.status, 413);
  } finally {
    close();
  }
});

test('GET /api/questions without auth returns 401', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    const res = await fetch(`${baseUrl}/api/questions`);
    assert.equal(res.status, 401);
  } finally {
    close();
  }
});

test('GET /api/questions with auth returns pending questions as array', async () => {
  const repoDir = repo();
  const questionsFile = join(repoDir, 'questions.jsonl');
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: questionsFile,
    PORT: '0',
  };

  // Pre-populate questions file
  writeFileSync(questionsFile, '{"id":"1","ts":"2026-01-01T00:00:00Z","question":"Q1"}\n');
  writeFileSync(questionsFile, '{"id":"2","ts":"2026-01-01T00:01:00Z","question":"Q2"}\n', { flag: 'a' });

  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Get questions
    const res = await fetch(`${baseUrl}/api/questions`, {
      headers: { 'Cookie': sessionCookie },
    });
    assert.equal(res.status, 200);
    const questions = await res.json();
    assert.ok(Array.isArray(questions));
    assert.equal(questions.length, 2);
    assert.equal(questions[0].id, '1');
    assert.equal(questions[0].question, 'Q1');
    assert.equal(questions[1].id, '2');
    assert.equal(questions[1].question, 'Q2');
  } finally {
    close();
  }
});

test('POST /api/questions/delete without auth returns 401', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    const res = await fetch(`${baseUrl}/api/questions/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'test-id' }),
    });
    assert.equal(res.status, 401);
  } finally {
    close();
  }
});

test('POST /api/questions/delete with auth removes question by id', async () => {
  const repoDir = repo();
  const questionsFile = join(repoDir, 'questions.jsonl');
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: questionsFile,
    PORT: '0',
  };

  // Pre-populate questions file
  writeFileSync(questionsFile, '{"id":"1","ts":"2026-01-01T00:00:00Z","question":"Q1"}\n');
  writeFileSync(questionsFile, '{"id":"2","ts":"2026-01-01T00:01:00Z","question":"Q2"}\n', { flag: 'a' });

  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Delete question with id 1
    const delRes = await fetch(`${baseUrl}/api/questions/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ id: '1' }),
    });
    assert.equal(delRes.status, 200);

    // Verify question was deleted
    const content = readFileSync(questionsFile, 'utf8');
    const lines = content.trim().split('\n').filter(l => l);
    assert.equal(lines.length, 1);
    const remaining = JSON.parse(lines[0]);
    assert.equal(remaining.id, '2');
  } finally {
    close();
  }
});

test('POST /api/questions/delete with unknown id returns 404', async () => {
  const repoDir = repo();
  const questionsFile = join(repoDir, 'questions.jsonl');
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: questionsFile,
    PORT: '0',
  };

  // Pre-populate questions file
  writeFileSync(questionsFile, '{"id":"1","ts":"2026-01-01T00:00:00Z","question":"Q1"}\n');

  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Try to delete unknown question
    const delRes = await fetch(`${baseUrl}/api/questions/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ id: 'nonexistent' }),
    });
    assert.equal(delRes.status, 404);
  } finally {
    close();
  }
});

test('POST /api/questions/update without auth returns 401', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    const res = await fetch(`${baseUrl}/api/questions/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'test-id', question: 'new text' }),
    });
    assert.equal(res.status, 401);
  } finally {
    close();
  }
});

test('POST /api/questions/update with auth updates question text by id', async () => {
  const repoDir = repo();
  const questionsFile = join(repoDir, 'questions.jsonl');
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: questionsFile,
    PORT: '0',
  };

  // Pre-populate questions file
  writeFileSync(questionsFile, '{"id":"1","ts":"2026-01-01T00:00:00Z","question":"Original Q1"}\n');
  writeFileSync(questionsFile, '{"id":"2","ts":"2026-01-01T00:01:00Z","question":"Q2"}\n', { flag: 'a' });

  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Update question with id 1
    const updateRes = await fetch(`${baseUrl}/api/questions/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ id: '1', question: 'Updated Q1' }),
    });
    assert.equal(updateRes.status, 200);
    const data = await updateRes.json();
    assert.equal(data.ok, true);

    // Verify question was updated
    const content = readFileSync(questionsFile, 'utf8');
    const lines = content.trim().split('\n').filter(l => l);
    const q1 = JSON.parse(lines[0]);
    assert.equal(q1.id, '1');
    assert.equal(q1.question, 'Updated Q1');
    const q2 = JSON.parse(lines[1]);
    assert.equal(q2.id, '2');
    assert.equal(q2.question, 'Q2');
  } finally {
    close();
  }
});

test('POST /api/questions/update with empty question returns 400', async () => {
  const repoDir = repo();
  const questionsFile = join(repoDir, 'questions.jsonl');
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: questionsFile,
    PORT: '0',
  };

  // Pre-populate questions file
  writeFileSync(questionsFile, '{"id":"1","ts":"2026-01-01T00:00:00Z","question":"Q1"}\n');

  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Try to update with empty question
    const updateRes = await fetch(`${baseUrl}/api/questions/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ id: '1', question: '' }),
    });
    assert.equal(updateRes.status, 400);
  } finally {
    close();
  }
});

test('POST /api/questions/update with unknown id returns 404', async () => {
  const repoDir = repo();
  const questionsFile = join(repoDir, 'questions.jsonl');
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: questionsFile,
    PORT: '0',
  };

  // Pre-populate questions file
  writeFileSync(questionsFile, '{"id":"1","ts":"2026-01-01T00:00:00Z","question":"Q1"}\n');

  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Try to update unknown question
    const updateRes = await fetch(`${baseUrl}/api/questions/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ id: 'nonexistent', question: 'Updated text' }),
    });
    assert.equal(updateRes.status, 404);
  } finally {
    close();
  }
});

test('GET /api/wisdom-sections without auth returns 401', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    const res = await fetch(`${baseUrl}/api/wisdom-sections`);
    assert.equal(res.status, 401);
  } finally {
    close();
  }
});

test('GET /api/wisdom-sections with auth returns h2 section headings from roys-wisdom.html', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };

  // Create a minimal roys-wisdom.html with sections
  const wisdomHtml = `<!DOCTYPE html>
<html>
<head><title>Roy's Wisdom</title></head>
<body>
<h1>Roy's Wisdom</h1>
<h2>First Section</h2>
<p>Content here</p>
<h2>Second Section</h2>
<p>More content</p>
<h2>Third Section</h2>
</body>
</html>`;
  writeFileSync(join(repoDir, 'roys-wisdom.html'), wisdomHtml);

  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Get wisdom sections
    const res = await fetch(`${baseUrl}/api/wisdom-sections`, {
      headers: { 'Cookie': sessionCookie },
    });
    assert.equal(res.status, 200);
    const sections = await res.json();
    assert.ok(Array.isArray(sections));
    assert.equal(sections.length, 3);
    assert.equal(sections[0], 'First Section');
    assert.equal(sections[1], 'Second Section');
    assert.equal(sections[2], 'Third Section');
  } finally {
    close();
  }
});

test('POST /api/questions/update with draft field updates draft', async () => {
  const repoDir = repo();
  const questionsFile = join(repoDir, 'questions.jsonl');
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: questionsFile,
    PORT: '0',
  };

  // Pre-populate questions file
  writeFileSync(questionsFile, '{"id":"1","ts":"2026-01-01T00:00:00Z","question":"Q1"}\n');

  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Update question with draft
    const updateRes = await fetch(`${baseUrl}/api/questions/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ id: '1', draft: 'This is a draft answer.' }),
    });
    assert.equal(updateRes.status, 200);

    // Verify draft was saved
    const content = readFileSync(questionsFile, 'utf8');
    const q = JSON.parse(content.trim());
    assert.equal(q.draft, 'This is a draft answer.');
  } finally {
    close();
  }
});

test('POST /api/questions/update with section field updates section', async () => {
  const repoDir = repo();
  const questionsFile = join(repoDir, 'questions.jsonl');
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: questionsFile,
    PORT: '0',
  };

  // Pre-populate questions file
  writeFileSync(questionsFile, '{"id":"1","ts":"2026-01-01T00:00:00Z","question":"Q1"}\n');

  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Update question with section
    const updateRes = await fetch(`${baseUrl}/api/questions/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ id: '1', section: 'My Section' }),
    });
    assert.equal(updateRes.status, 200);

    // Verify section was saved
    const content = readFileSync(questionsFile, 'utf8');
    const q = JSON.parse(content.trim());
    assert.equal(q.section, 'My Section');
  } finally {
    close();
  }
});

test('POST /api/questions/draft without auth returns 401', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    const res = await fetch(`${baseUrl}/api/questions/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'test-id' }),
    });
    assert.equal(res.status, 401);
  } finally {
    close();
  }
});

test('POST /api/questions/draft with auth streams SSE draft answer', async () => {
  const repoDir = repo();
  const questionsFile = join(repoDir, 'questions.jsonl');
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: questionsFile,
    PORT: '0',
  };

  // Pre-populate questions file
  writeFileSync(questionsFile, '{"id":"1","ts":"2026-01-01T00:00:00Z","question":"Where can I find help?"}\n');

  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Draft answer
    const draftRes = await fetch(`${baseUrl}/api/questions/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ id: '1' }),
    });
    assert.equal(draftRes.status, 200);
    assert.equal(draftRes.headers.get('content-type'), 'text/event-stream');

    // Read SSE stream
    const text = await draftRes.text();
    // Progress carries the agent's narration; the finished answer arrives on done.
    assert.match(text, /event: progress\ndata: \{"text":/);
    assert.match(text, /event: done\ndata: .*"draft":/);
    assert.match(text, /event: done/);
  } finally {
    close();
  }
});

test('POST /api/questions/publish without auth returns 401', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    const res = await fetch(`${baseUrl}/api/questions/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'test-id' }),
    });
    assert.equal(res.status, 401);
  } finally {
    close();
  }
});

test('POST /api/questions/publish with auth inserts card into existing section', async () => {
  const repoDir = repo();
  const questionsFile = join(repoDir, 'questions.jsonl');
  const wisdomFile = join(repoDir, 'roys-wisdom.html');
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: questionsFile,
    PORT: '0',
  };

  // Create wisdom file with a section
  const wisdomHtml = `<!DOCTYPE html>
<html>
<head><title>Roy's Wisdom</title></head>
<body>
<article>
<h1>Roy's Wisdom</h1>
<h2>Test Section</h2>
<p>Existing content</p>
</article>
</body>
</html>`;
  writeFileSync(wisdomFile, wisdomHtml);

  // Pre-populate questions file
  writeFileSync(questionsFile, '{"id":"1","ts":"2026-01-01T00:00:00Z","question":"What is a test?","draft":"This is a test answer.","section":"Test Section"}\n');

  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Publish question
    const publishRes = await fetch(`${baseUrl}/api/questions/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ id: '1' }),
    });
    assert.equal(publishRes.status, 200);

    // Verify card was inserted
    const wisdomContent = readFileSync(wisdomFile, 'utf8');
    assert.match(wisdomContent, /class="lesson"/);
    assert.match(wisdomContent, /What is a test\?/);
    assert.match(wisdomContent, /This is a test answer\./);

    // Verify question was removed from queue
    const questionsContent = readFileSync(questionsFile, 'utf8');
    assert.equal(questionsContent.trim(), '');
  } finally {
    close();
  }
});

test('POST /api/questions/publish creates new section if not found', async () => {
  const repoDir = repo();
  const questionsFile = join(repoDir, 'questions.jsonl');
  const wisdomFile = join(repoDir, 'roys-wisdom.html');
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: questionsFile,
    PORT: '0',
  };

  // Create wisdom file without the section
  const wisdomHtml = `<!DOCTYPE html>
<html>
<head><title>Roy's Wisdom</title></head>
<body>
<article>
<h1>Roy's Wisdom</h1>
<h2>Existing Section</h2>
<p>Content</p>
</article>
</body>
</html>`;
  writeFileSync(wisdomFile, wisdomHtml);

  // Pre-populate questions file
  writeFileSync(questionsFile, '{"id":"1","ts":"2026-01-01T00:00:00Z","question":"New topic?","draft":"New answer.","section":"New Section"}\n');

  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Publish question
    const publishRes = await fetch(`${baseUrl}/api/questions/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ id: '1' }),
    });
    assert.equal(publishRes.status, 200);

    // Verify new section was created
    const wisdomContent = readFileSync(wisdomFile, 'utf8');
    assert.match(wisdomContent, /<h2>New Section<\/h2>/);
    assert.match(wisdomContent, /class="lesson"/);
  } finally {
    close();
  }
});

test('POST /api/questions/publish without draft returns 400', async () => {
  const repoDir = repo();
  const questionsFile = join(repoDir, 'questions.jsonl');
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: questionsFile,
    PORT: '0',
  };

  // Pre-populate questions file without draft
  writeFileSync(questionsFile, '{"id":"1","ts":"2026-01-01T00:00:00Z","question":"Q1"}\n');

  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn(), fakeRunDraftTurn());
  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookie.split(';')[0];

    // Try to publish without draft
    const publishRes = await fetch(`${baseUrl}/api/questions/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ id: '1' }),
    });
    assert.equal(publishRes.status, 400);
  } finally {
    close();
  }
});

test('POST /api/ask without consent is refused', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn());
  try {
    const res = await fetch(`${baseUrl}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'A real question', website: '' }),
    });
    assert.equal(res.status, 400);
    assert.equal(existsSync(join(repoDir, 'questions.jsonl')), false);
  } finally {
    close();
  }
});

test('POST /api/ask records the consent with the question', async () => {
  const repoDir = repo();
  const env = {
    ANTHROPIC_API_KEY: 'test-key',
    CHAT_PASSWORD: 'correct-password',
    SESSION_SECRET: 'test-secret',
    SITE_DIR: repoDir,
    SITE_REPO_DIR: repoDir,
    USAGE_LOG: join(repoDir, 'usage.log'),
    QUESTIONS_FILE: join(repoDir, 'questions.jsonl'),
    PORT: '0',
  };
  const { fetch, baseUrl, close } = await setupServer(env, fakeRunTurn());
  try {
    await fetch(`${baseUrl}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'A real question', consent: true, website: '' }),
    });
    const stored = JSON.parse(readFileSync(join(repoDir, 'questions.jsonl'), 'utf8').trim());
    assert.equal(stored.consent, true);
    assert.ok(stored.consentedAt);
  } finally {
    close();
  }
});
