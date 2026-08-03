import express from 'express';
import { makeSession, verifySession, checkPassword } from './auth.mjs';
import { commitAll, undoLast } from './gitops.mjs';
import { logUsage } from './usage.mjs';
import { mkdirSync, existsSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

const REQUIRED_ENV = [
  'ANTHROPIC_API_KEY',
  'CHAT_PASSWORD',
  'SESSION_SECRET',
  'SITE_DIR',
  'SITE_REPO_DIR',
  'USAGE_LOG',
  'QUESTIONS_FILE',
  'PORT',
];

function validateEnv(env) {
  const missing = REQUIRED_ENV.filter(key => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  const cookies = {};
  cookieHeader.split(';').forEach(cookie => {
    const eqIdx = cookie.trim().indexOf('=');
    if (eqIdx > 0) {
      const name = cookie.trim().substring(0, eqIdx);
      const value = cookie.trim().substring(eqIdx + 1);
      if (name) cookies[name] = value;
    }
  });
  return cookies;
}

function getClientIp(req) {
  const forwarded = req.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
}

const LOGIN_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Roy Can Help - Login</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Georgia, serif;
      background: #f5f1eb;
      color: #2c2c2c;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    form {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      max-width: 400px;
      width: 100%;
    }
    h1 {
      margin-bottom: 1.5rem;
      font-size: 1.5rem;
      color: #8b0000;
    }
    input[type="password"] {
      width: 100%;
      padding: 0.75rem;
      margin-bottom: 1rem;
      border: 1px solid #d4c9be;
      border-radius: 4px;
      font-family: inherit;
      font-size: 1rem;
    }
    button {
      width: 100%;
      padding: 0.75rem;
      background: #8b0000;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
    }
    button:hover { background: #6b0000; }
  </style>
</head>
<body>
  <form id="login-form">
    <h1>Roy Can Help</h1>
    <input type="password" name="password" placeholder="Password" required autofocus>
    <button type="submit">Login</button>
    <p id="login-error" style="color:#8b0000;display:none;">Wrong password.</p>
  </form>
  <script>
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = e.target.password.value;
      const res = await fetch('api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) { location.reload(); }
      else { document.getElementById('login-error').style.display = 'block'; }
    });
  </script>
</body>
</html>`;

export function createApp({ env, runTurn }) {
  validateEnv(env);

  const app = express();

  // Middleware to check auth
  const requireAuth = (req, res, next) => {
    const cookies = parseCookies(req.get('cookie'));
    const session = cookies.session;
    if (!session || !verifySession(session, env.SESSION_SECRET)) {
      return res.status(401).send('Unauthorized');
    }
    req.session = session;
    req.agentSession = cookies.agentsession;
    next();
  };

  app.get('/', (req, res) => {
    const cookies = parseCookies(req.get('cookie'));
    const session = cookies.session;
    if (!session || !verifySession(session, env.SESSION_SECRET)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(LOGIN_HTML);
    } else {
      res.sendFile('/chat.html', { root: new URL('public/', import.meta.url).pathname });
    }
  });

  app.post('/api/login', express.json(), (req, res) => {
    const { password } = req.body;
    if (!checkPassword(password, env.CHAT_PASSWORD)) {
      const ip = getClientIp(req);
      console.log(`LOGIN FAIL ip=${ip}`);
      return res.status(401).send('Invalid password');
    }
    const session = makeSession(env.SESSION_SECRET);
    res.setHeader('Set-Cookie', `session=${session}; Path=/; HttpOnly; Secure; SameSite=Strict`);
    res.json({ ok: true });
  });

  app.post('/api/message', requireAuth, express.json(), async (req, res) => {
    const { message, sessionId } = req.body;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const { sessionId: newSessionId, usage, summary } = await runTurn({
        message,
        sessionId: sessionId || req.agentSession,
        siteDir: env.SITE_DIR,
        onText: (text) => {
          res.write(`event: text\ndata: ${text}\n\n`);
        },
      });

      // Commit the message
      const messageShort = message.substring(0, 60);
      const commitMessage = `Roy: ${messageShort}`;
      const committed = await commitAll(env.SITE_REPO_DIR, commitMessage) !== null;

      // Log usage
      if (usage) {
        logUsage(env.USAGE_LOG, {
          ts: new Date().toISOString(),
          sessionId: newSessionId || sessionId || req.agentSession,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
        });
      }

      // Include new session in done event
      const doneData = { summary, committed };
      if (newSessionId) {
        doneData.sessionId = newSessionId;
      }

      res.write(`event: done\ndata: ${JSON.stringify(doneData)}\n\n`);
      res.end();
    } catch (err) {
      res.write(`event: error\ndata: ${err.message}\n\n`);
      res.end();
    }
  });

  app.post('/api/undo', requireAuth, async (req, res) => {
    try {
      const last = await undoLast(env.SITE_REPO_DIR);
      res.json({ reverted: last.message });
    } catch (err) {
      res.status(409).send(err.message);
    }
  });

  // Ask Roy endpoint (public)
  app.post('/api/ask', express.json(), (req, res) => {
    const { question, website } = req.body;

    // Check for honeypot
    if (website) {
      return res.json({ ok: true });
    }

    // Reject empty questions
    if (!question || !String(question).trim()) {
      return res.status(400).send('Question cannot be empty');
    }

    // Reject questions over 2000 chars
    if (String(question).length > 2000) {
      return res.status(413).send('Question too long (max 2000 characters)');
    }

    // Append to QUESTIONS_FILE
    try {
      const questionRecord = {
        id: randomUUID(),
        ts: new Date().toISOString(),
        question: String(question).trim(),
      };
      appendFileSync(env.QUESTIONS_FILE, JSON.stringify(questionRecord) + '\n');
      res.json({ ok: true });
    } catch (err) {
      console.error('Failed to store question:', err);
      res.status(500).send(err.message);
    }
  });

  // Get questions endpoint (auth)
  app.get('/api/questions', requireAuth, (req, res) => {
    try {
      const questions = [];
      if (existsSync(env.QUESTIONS_FILE)) {
        const content = readFileSync(env.QUESTIONS_FILE, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            questions.push(JSON.parse(line));
          } catch (e) {
            console.error('Failed to parse question line:', e);
          }
        }
      }
      res.json(questions);
    } catch (err) {
      console.error('Failed to read questions:', err);
      res.status(500).send(err.message);
    }
  });

  // Delete question endpoint (auth)
  app.post('/api/questions/delete', requireAuth, express.json(), (req, res) => {
    const { id } = req.body;
    if (!id) {
      return res.status(400).send('Missing id');
    }

    try {
      if (!existsSync(env.QUESTIONS_FILE)) {
        return res.status(404).send('Question not found');
      }

      const content = readFileSync(env.QUESTIONS_FILE, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      const filtered = [];
      let found = false;

      for (const line of lines) {
        try {
          const q = JSON.parse(line);
          if (q.id === id) {
            found = true;
          } else {
            filtered.push(line);
          }
        } catch (e) {
          console.error('Failed to parse question line:', e);
          filtered.push(line);
        }
      }

      if (!found) {
        return res.status(404).send('Question not found');
      }

      // Rewrite file without the deleted question
      if (filtered.length === 0) {
        writeFileSync(env.QUESTIONS_FILE, '');
      } else {
        writeFileSync(env.QUESTIONS_FILE, filtered.join('\n') + '\n');
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete question:', err);
      res.status(500).send(err.message);
    }
  });

  // Upload endpoint with manual body parsing
  app.post('/api/upload', requireAuth, async (req, res) => {
    try {
      const filename = req.get('x-filename');
      if (!filename) {
        return res.status(400).send('Missing X-Filename header');
      }

      // Validate filename: only alphanumeric, dash, underscore, dot
      // Reject path separators and traversal attempts
      if (!/^[a-z0-9._-]+$/i.test(filename)) {
        return res.status(400).send('Invalid filename characters');
      }
      if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
        return res.status(400).send('Path traversal not allowed');
      }

      // Validate file extension and determine target directory
      const ext = filename.split('.').pop().toLowerCase();
      const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
      const documentExts = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'];

      let targetDir, pathPrefix;
      if (imageExts.includes(ext)) {
        targetDir = join(env.SITE_DIR, 'images');
        pathPrefix = 'images';
      } else if (documentExts.includes(ext)) {
        targetDir = join(env.SITE_DIR, 'files');
        pathPrefix = 'files';
      } else {
        return res.status(415).send('Unsupported file format');
      }

      // Ensure target directory exists
      try {
        mkdirSync(targetDir, { recursive: true });
      } catch (err) {
        if (err.code !== 'EEXIST') throw err;
      }

      // Defense-in-depth: resolve the final path and verify it's within target dir
      const filepath = resolve(targetDir, filename);
      const targetDirResolved = resolve(targetDir);
      if (!filepath.startsWith(targetDirResolved + sep)) {
        return res.status(400).send('Invalid file path');
      }

      // Check for duplicate
      if (existsSync(filepath)) {
        return res.status(409).send('File already exists');
      }

      // Collect raw body with accumulated byte tracking
      const chunks = [];
      let accumulatedBytes = 0;
      const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

      for await (const chunk of req) {
        accumulatedBytes += chunk.length;
        if (accumulatedBytes > MAX_SIZE) {
          return res.status(413).send('Payload too large');
        }
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Write file
      writeFileSync(filepath, buffer);

      // Commit
      await commitAll(env.SITE_REPO_DIR, `Roy: uploaded ${filename}`);

      res.json({ path: `${pathPrefix}/${filename}` });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).send(err.message);
    }
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = process.env;
  try {
    validateEnv(env);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  // Lazy-load agent only when running server
  const { runTurn } = await import('./agent.mjs');
  const app = createApp({ env, runTurn });
  app.listen(parseInt(env.PORT, 10), '127.0.0.1', () => {
    console.log(`Server running on port ${env.PORT}`);
  });
}
