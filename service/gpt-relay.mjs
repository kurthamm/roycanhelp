import express from 'express';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

// Lets Roy's ChatGPT (a private custom GPT with an Action) drive the same editor agent as the /admin/ chat.
// ChatGPT is only the front end: every turn runs through runTurn with the site's own rules and verification.
// Turns outlast a ChatGPT action's wait, so a message returns a job id and the reply is fetched by polling.

const MAX_MESSAGE = 8000;
const JOB_TTL_MS = 60 * 60 * 1000;

const digest = s => createHash('sha256').update(s).digest();

export function openApiSpec(origin) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Roy Can Help site editor',
      version: '1.0.0',
      description: 'Send Roy\'s message to the site editor and fetch its reply. The editor edits roycanhelp.org.',
    },
    servers: [{ url: origin }],
    paths: {
      '/api/gpt/message': {
        post: {
          operationId: 'sendMessageToEditor',
          summary: 'Send one message from Roy to the site editor. Returns a job id; then call getEditorReply until the status is done.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['message'],
              properties: { message: { type: 'string', maxLength: MAX_MESSAGE, description: 'Roy\'s words, exactly as he wrote them.' } },
            } } },
          },
          responses: {
            202: { description: 'Accepted', content: { 'application/json': { schema: { type: 'object', properties: { jobId: { type: 'string' } } } } } },
            409: { description: 'The editor is still working on the previous message' },
          },
        },
      },
      '/api/gpt/message/{jobId}': {
        get: {
          operationId: 'getEditorReply',
          summary: 'Get the editor\'s reply. If status is running, wait a few seconds and call again.',
          parameters: [{ name: 'jobId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Job state', content: { 'application/json': { schema: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['running', 'done', 'error'] },
                reply: { type: 'string', description: 'The editor\'s full reply. Show it to Roy exactly as written.' },
                changedSite: { type: 'boolean', description: 'True if the editor changed the live site.' },
                elapsedSeconds: { type: 'integer' },
                error: { type: 'string' },
              },
            } } } },
            404: { description: 'Unknown job' },
          },
        },
      },
    },
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
    security: [{ bearer: [] }],
  };
}

export function mountGptRelay(app, { env, runTurn, commit, logUsage, origin }) {
  const key = env.GPT_ACTION_KEY;
  if (!key || key.length < 32) throw new Error('GPT_ACTION_KEY must be set to at least 32 characters');
  const keyDigest = digest(key);
  const jobs = new Map();
  let running = null;
  let sessionId = null; // one continuing conversation, like Roy's /admin/ chat

  const clientIp = req => (req.get('x-forwarded-for') ?? req.ip ?? '').split(',')[0].trim();

  const requireKey = (req, res, next) => {
    const m = /^Bearer (.+)$/.exec(req.get('authorization') ?? '');
    if (!m || !timingSafeEqual(digest(m[1]), keyDigest)) {
      // Same line shape as the /admin/ login so the existing fail2ban jail bans repeat offenders.
      console.log(`LOGIN FAIL ip=${clientIp(req)} via=gpt`);
      return res.status(401).json({ error: 'unauthorized' });
    }
    next();
  };

  app.get('/api/gpt/openapi.json', (req, res) => res.json(openApiSpec(origin)));

  app.post('/api/gpt/message', express.json({ limit: '32kb' }), requireKey, (req, res) => {
    const message = req.body?.message;
    if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE) {
      return res.status(400).json({ error: `message must be 1 to ${MAX_MESSAGE} characters` });
    }
    if (running) return res.status(409).json({ error: 'The editor is still working on the previous message', jobId: running });

    const jobId = randomUUID();
    const job = { status: 'running', startedAt: Date.now(), chunks: [] };
    jobs.set(jobId, job);
    running = jobId;

    (async () => {
      try {
        const out = await runTurn({
          message,
          sessionId: sessionId ?? undefined,
          siteDir: env.SITE_DIR,
          onText: t => job.chunks.push(t),
        });
        if (out.sessionId) sessionId = out.sessionId;
        job.changedSite = (await commit(env.SITE_REPO_DIR, `Roy: ${message.substring(0, 60)}`)) !== null;
        if (out.usage) logUsage(env.USAGE_LOG, { ts: new Date().toISOString(), sessionId, via: 'gpt', ...out.usage });
        job.status = 'done';
      } catch (err) {
        console.error(`GPT relay turn failed: ${err.stack}`);
        job.status = 'error';
        job.error = err.message;
      } finally {
        job.finishedAt = Date.now();
        running = null;
        setTimeout(() => jobs.delete(jobId), JOB_TTL_MS).unref();
      }
    })();

    res.status(202).json({ jobId });
  });

  app.get('/api/gpt/message/:jobId', requireKey, (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'unknown job' });
    const elapsedSeconds = Math.round(((job.finishedAt ?? Date.now()) - job.startedAt) / 1000);
    res.json({
      status: job.status,
      elapsedSeconds,
      ...(job.status === 'done' && { reply: job.chunks.join('\n\n'), changedSite: job.changedSite }),
      ...(job.status === 'error' && { error: job.error }),
    });
  });
}
