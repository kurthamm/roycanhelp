import express from 'express';
import { makeSession, verifySession, checkPassword } from './auth.mjs';
import { commitAll, undoLast } from './gitops.mjs';
import { logUsage } from './usage.mjs';

const REQUIRED_ENV = [
  'ANTHROPIC_API_KEY',
  'CHAT_PASSWORD',
  'SESSION_SECRET',
  'SITE_DIR',
  'SITE_REPO_DIR',
  'USAGE_LOG',
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
    const [name, value] = cookie.trim().split('=');
    if (name && value) cookies[name] = value;
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
  <form method="post" action="/api/login">
    <h1>Roy Can Help</h1>
    <input type="password" name="password" placeholder="Password" required autofocus>
    <button type="submit">Login</button>
  </form>
</body>
</html>`;

export function createApp({ env, runTurn }) {
  validateEnv(env);

  const app = express();
  app.use(express.json());

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

  app.post('/api/message', requireAuth, async (req, res) => {
    const { message } = req.body;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const { sessionId: newSessionId, usage, summary } = await runTurn({
        message,
        sessionId: req.agentSession,
        siteDir: env.SITE_DIR,
        onText: (text) => {
          res.write(`event: text\ndata: ${text}\n\n`);
        },
      });

      // Store new session ID for cookie (set before writing done event)
      const newSessionCookie = newSessionId
        ? `agentsession=${newSessionId}; Path=/; HttpOnly; Secure; SameSite=Strict`
        : null;

      // Commit the message
      const messageShort = message.substring(0, 60);
      const commitMessage = `Roy: ${messageShort}`;
      const committed = await commitAll(env.SITE_REPO_DIR, commitMessage) !== null;

      // Log usage
      if (usage) {
        logUsage(env.USAGE_LOG, {
          ts: new Date().toISOString(),
          sessionId: newSessionId || req.agentSession,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
        });
      }

      // Include new session in done event and set cookie header via Set-Cookie trailer (if supported)
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
