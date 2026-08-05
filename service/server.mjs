import express from 'express';
import { makeSession, verifySession, checkPassword } from './auth.mjs';
import { commitAll } from './gitops.mjs';
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

// Question queue helpers: one JSON record per line.
function readQuestions(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
function writeQuestions(file, questions) {
  writeFileSync(file, questions.map((q) => JSON.stringify(q)).join('\n') + (questions.length ? '\n' : ''));
}

// The model sometimes wraps a draft in conversation. The card needs the answer only.
// Drafts arrive with light markdown. Convert links and bold; everything else stays literal.
function markdownToHtml(escaped) {
  return escaped
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function stripDraftChatter(text) {
  let out = (text || '').trim();
  const lead = /^(here'?s?|here is)\b[^\n]*:\s*$/i;
  const trail = /^(say the word|let me know|tell me which|want me to|i can publish|shall i)\b/i;
  let lines = out.split('\n');
  while (lines.length && (lines[0].trim() === '' || lines[0].trim() === '---' || lead.test(lines[0].trim()))) lines.shift();
  while (lines.length && (lines[lines.length - 1].trim() === '' || lines[lines.length - 1].trim() === '---' || trail.test(lines[lines.length - 1].trim()))) lines.pop();
  return lines.join('\n').trim();
}

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

export function createApp({ env, runTurn, runDraftTurn }) {
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

  // Ask Roy endpoint (public)
  app.post('/api/ask', express.json(), (req, res) => {
    const { question, website, consent } = req.body;

    // Check for honeypot
    if (website) {
      return res.json({ ok: true });
    }

    // Reject empty questions
    if (!question || !String(question).trim()) {
      return res.status(400).send('Question cannot be empty');
    }

    // The form states the terms and asks for agreement. Enforce it here too, so
    // consent is a real condition of storing the question rather than a checkbox.
    if (consent !== true) {
      return res.status(400).send('Consent is required before a question can be sent');
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
        question: String(question).trim(), consent: true, consentedAt: new Date().toISOString(),
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

  // Update question endpoint (auth) - updates question, draft, or section
  app.post('/api/questions/update', requireAuth, express.json(), (req, res) => {
    const { id, question, draft, section } = req.body;
    if (!id) {
      return res.status(400).send('Missing id');
    }

    // At least one field must be provided
    if (question === undefined && draft === undefined && section === undefined) {
      return res.status(400).send('At least one of question, draft, or section must be provided');
    }

    // If question is provided, it cannot be empty
    if (question !== undefined && (!String(question).trim())) {
      return res.status(400).send('Question cannot be empty');
    }

    try {
      if (!existsSync(env.QUESTIONS_FILE)) {
        return res.status(404).send('Question not found');
      }

      const content = readFileSync(env.QUESTIONS_FILE, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      const updated = [];
      let found = false;

      for (const line of lines) {
        try {
          const q = JSON.parse(line);
          if (q.id === id) {
            found = true;
            if (question !== undefined) q.question = String(question).trim();
            if (draft !== undefined) q.draft = String(draft);
            if (section !== undefined) q.section = String(section);
            updated.push(JSON.stringify(q));
          } else {
            updated.push(line);
          }
        } catch (e) {
          console.error('Failed to parse question line:', e);
          updated.push(line);
        }
      }

      if (!found) {
        return res.status(404).send('Question not found');
      }

      // Rewrite file with updated question
      writeFileSync(env.QUESTIONS_FILE, updated.join('\n') + '\n');
      res.json({ ok: true });
    } catch (err) {
      console.error('Failed to update question:', err);
      res.status(500).send(err.message);
    }
  });

  // Draft answer endpoint (auth) - generates a draft answer for a question
  app.post('/api/questions/draft', requireAuth, express.json(), async (req, res) => {
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
      let question = null;

      for (const line of lines) {
        try {
          const q = JSON.parse(line);
          if (q.id === id) {
            question = q;
            break;
          }
        } catch (e) {
          console.error('Failed to parse question line:', e);
        }
      }

      if (!question) {
        return res.status(404).send('Question not found');
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Build prompt for drafting answer (read-only mode)
      const draftPrompt = `A visitor asked: "${question.question}"

Write the answer itself and nothing else.

Rules for your output:
- Output ONLY the answer text. No preamble, no "here is the draft", no sign off, no offer to publish, no asking which section, no horizontal rules, no headings, no restating of the question.
- Your entire response is pasted directly into a card on the site, so the first character must be the first word of the answer and the last character must be the end of the answer.
- Roy's voice: first person, plain language, sardonic about bureaucracy but never about kids or families.
- Ground it in the site's existing researched content and cite the regulation or the page where a claim comes from.
- A few short paragraphs. End with one sentence of what to actually do.`;

      try {
        const { usage, summary } = await runDraftTurn({
          message: draftPrompt,
          siteDir: env.SITE_DIR,
          // Progress only. JSON encode so multi line text cannot break SSE framing.
          onText: (text) => {
            res.write(`event: progress\ndata: ${JSON.stringify({ text })}\n\n`);
          },
        });

        const cleaned = stripDraftChatter(summary);

        // Persist the final answer so it survives a reload and is not re-drafted.
        const updated = readQuestions(env.QUESTIONS_FILE).map((q) =>
          q.id === id ? { ...q, draft: cleaned } : q
        );
        writeQuestions(env.QUESTIONS_FILE, updated);
        if (usage) logUsage(env.USAGE_LOG, { ts: new Date().toISOString(), kind: 'draft', ...usage });

        res.write(`event: done\ndata: ${JSON.stringify({ ok: true, draft: cleaned })}\n\n`);
        res.end();
      } catch (err) {
        res.write(`event: error\ndata: ${err.message}\n\n`);
        res.end();
      }
    } catch (err) {
      console.error('Failed to draft answer:', err);
      res.status(500).send(err.message);
    }
  });

  // Publish question to Wisdom endpoint (auth)
  app.post('/api/questions/publish', requireAuth, express.json(), async (req, res) => {
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
      let question = null;
      let questionIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        try {
          const q = JSON.parse(lines[i]);
          if (q.id === id) {
            question = q;
            questionIndex = i;
            break;
          }
        } catch (e) {
          console.error('Failed to parse question line:', e);
        }
      }

      if (!question || !question.draft || !question.section) {
        return res.status(400).send('Question must have draft and section before publishing');
      }

      // Escape HTML entities
      function escapeHtml(text) {
        return String(text)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      // Build the lesson card HTML
      const questionText = escapeHtml(question.question);
      // Escape first, then convert the small amount of markdown the draft may contain.
      const paragraphs = escapeHtml(question.draft).split('\n').filter((p) => p.trim());
      const lessonContent = paragraphs.map((p, idx) => {
        const body = markdownToHtml(p);
        if (idx === paragraphs.length - 1 && paragraphs.length > 1) {
          return `<p><strong>${body}</strong></p>`;
        }
        return `<p>${body}</p>`;
      }).join('');

      const lessonCard = `<div class="lesson">
<h3>${questionText}</h3>
${lessonContent}
</div>`;

      // Read roys-wisdom.html
      const wisdomPath = join(env.SITE_DIR, 'roys-wisdom.html');
      let wisdomContent = '';
      if (existsSync(wisdomPath)) {
        wisdomContent = readFileSync(wisdomPath, 'utf8');
      }

      // Find the section and insert the card
      const sectionRegex = new RegExp(`(<h2>${escapeHtml(question.section)}</h2>.*?)(?=<h2>|</article>|$)`, 's');
      const sectionMatch = wisdomContent.match(sectionRegex);

      let updatedWisdom;
      if (sectionMatch) {
        // Section exists: insert card before the next h2 or closing tag
        const insertPoint = sectionMatch.index + sectionMatch[1].length;
        updatedWisdom = wisdomContent.slice(0, insertPoint) + '\n' + lessonCard + '\n' + wisdomContent.slice(insertPoint);
      } else {
        // Section doesn't exist: create it
        // Find the closing </article> tag
        const articleEndMatch = wisdomContent.match(/<\/article>/);
        if (articleEndMatch) {
          const insertPoint = articleEndMatch.index;
          const newSection = `<h2>${escapeHtml(question.section)}</h2>
${lessonCard}
`;
          updatedWisdom = wisdomContent.slice(0, insertPoint) + newSection + wisdomContent.slice(insertPoint);
        } else {
          // No article tag, append at end
          updatedWisdom = wisdomContent + `
<h2>${escapeHtml(question.section)}</h2>
${lessonCard}
`;
        }
      }

      // Write updated wisdom file
      writeFileSync(wisdomPath, updatedWisdom);

      // Commit the change
      const committed = await commitAll(env.SITE_REPO_DIR, 'Roy: published a visitor question to Wisdom');

      // Remove the question from the queue
      const updatedLines = lines.filter((_, idx) => idx !== questionIndex);
      if (updatedLines.length === 0) {
        writeFileSync(env.QUESTIONS_FILE, '');
      } else {
        writeFileSync(env.QUESTIONS_FILE, updatedLines.join('\n') + '\n');
      }

      res.json({ ok: true, path: wisdomPath });
    } catch (err) {
      console.error('Failed to publish question:', err);
      res.status(500).send(err.message);
    }
  });

  // Get wisdom sections endpoint (auth)
  app.get('/api/wisdom-sections', requireAuth, (req, res) => {
    try {
      const wisdomFile = join(env.SITE_DIR, 'roys-wisdom.html');
      if (!existsSync(wisdomFile)) {
        return res.status(404).send('Wisdom file not found');
      }

      const content = readFileSync(wisdomFile, 'utf8');
      const sections = [];
      const h2Regex = /<h2>([^<]+)<\/h2>/g;
      let match;

      while ((match = h2Regex.exec(content)) !== null) {
        sections.push(match[1]);
      }

      res.json(sections);
    } catch (err) {
      console.error('Failed to read wisdom sections:', err);
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
  const { runTurn, runDraftTurn } = await import('./agent.mjs');
  const app = createApp({ env, runTurn, runDraftTurn });
  app.listen(parseInt(env.PORT, 10), '127.0.0.1', () => {
    console.log(`Server running on port ${env.PORT}`);
  });
}
