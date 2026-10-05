import express from 'express';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

// Gives Roy's private custom GPT everything the /admin/ page can do: chat with the editor, work the visitor
// questions queue, upload files, and undo. ChatGPT is only the front end; the editor agent and all of the
// site's existing admin logic do the work. The admin endpoints are reached internally through adminFetch,
// so the GPT can never do something /admin/ cannot.
// Long operations outlast a ChatGPT action's wait, so they return a job id that is polled.

const MAX_MESSAGE = 8000;
const MAX_UPLOAD = 15 * 1024 * 1024;
const JOB_TTL_MS = 60 * 60 * 1000;

const digest = s => createHash('sha256').update(s).digest();

const obj = (properties, required = []) => ({ type: 'object', required, properties });
const str = description => ({ type: 'string', description });
const jsonBody = schema => ({ required: true, content: { 'application/json': { schema } } });
const ok = (description, schema) => ({ description, ...(schema && { content: { 'application/json': { schema } } }) });

export function openApiSpec(origin) {
  const idOnly = obj({ id: str('The question id from listVisitorQuestions.') }, ['id']);
  const jobStatus = obj({
    status: { type: 'string', enum: ['running', 'done', 'error'] },
    reply: str('The full result text. Show it to Roy exactly as written.'),
    progress: str('Latest text while still running.'),
    changedSite: { type: 'boolean', description: 'True if the live site changed.' },
    elapsedSeconds: { type: 'integer' },
    error: { type: 'string' },
  });
  const jobParam = [{ name: 'jobId', in: 'path', required: true, schema: { type: 'string' } }];
  return {
    openapi: '3.1.0',
    info: {
      title: 'Roy Can Help site editor',
      version: '2.0.0',
      description: 'You are Roy\'s helper for his website, roycanhelp.org. Roy owns the site and his decisions are final. You never change the site or answer questions yourself; you pass Roy\'s words to the editor and show him what comes back. For EVERY message Roy writes, call sendMessageToEditor with his exact words, then call getEditorReply with the jobId, repeating every few seconds for up to ten minutes until the status is done. Show Roy the editor\'s reply exactly as written, word for word, never summarized, shortened, corrected or added to. Never make up facts about benefits, laws or rules. Never say the site changed unless changedSite is true. If Roy says hello or asks what is next, send exactly: What\'s next? Use the other operations when Roy asks for them: visitor questions (list, edit, delete, draft an answer, publish), Wisdom sections, uploading a file or picture he attached, and undoing his last change, and seeing recent site changes. Speak plainly and never use technical words with Roy.',
    },
    servers: [{ url: origin }],
    paths: {
      '/api/gpt/message': { post: {
        operationId: 'sendMessageToEditor',
        summary: 'Use this for EVERY message Roy writes, with his exact words. Returns a job id; then call getEditorReply until the status is done.',
        requestBody: jsonBody(obj({ message: { ...str('Roy\'s words, exactly as he wrote them.'), maxLength: MAX_MESSAGE } }, ['message'])),
        responses: { 202: ok('Accepted', obj({ jobId: { type: 'string' } })), 409: ok('The editor is still working on the previous message', obj({ error: { type: 'string' }, jobId: { type: 'string' } })) },
      } },
      '/api/gpt/message/{jobId}': { get: {
        operationId: 'getEditorReply',
        summary: 'Get the editor\'s reply. If status is running, wait a few seconds and call again.',
        parameters: jobParam,
        responses: { 200: ok('Job state', jobStatus), 404: ok('Unknown job') },
      } },
      '/api/gpt/undo': { post: {
        operationId: 'undoLastChange',
        summary: 'Undo the editor\'s most recent change to the site, when Roy asks. One level only.',
        responses: { 200: ok('Undone', obj({ undone: { type: 'string' } })), 409: ok('Cannot undo', obj({ error: { type: 'string' } })) },
      } },
      '/api/gpt/history': { get: {
        operationId: 'listRecentSiteChanges',
        summary: 'Show the most recent changes made to the site, newest first, when Roy asks what changed or when.',
        responses: { 200: ok('Recent changes', { type: 'array', items: obj({ when: { type: 'string' }, who: { type: 'string' }, what: { type: 'string' } }) }) },
      } },
      '/api/gpt/questions': { get: {
        operationId: 'listVisitorQuestions',
        summary: 'List the questions visitors sent through Ask Roy, with any drafts.',
        responses: { 200: ok('Questions', { type: 'array', items: { type: 'object' } }) },
      } },
      '/api/gpt/questions/update': { post: {
        operationId: 'updateVisitorQuestion',
        summary: 'Edit a visitor question\'s text, its draft answer, or the Wisdom section it will be published in.',
        requestBody: jsonBody(obj({ id: str('Question id'), question: str('New question text'), draft: str('New draft answer text'), section: str('Wisdom section name from listWisdomSections') }, ['id'])),
        responses: { 200: ok('Updated') },
      } },
      '/api/gpt/questions/delete': { post: {
        operationId: 'deleteVisitorQuestion',
        summary: 'Delete a visitor question, only when Roy asks.',
        requestBody: jsonBody(idOnly),
        responses: { 200: ok('Deleted') },
      } },
      '/api/gpt/questions/draft': { post: {
        operationId: 'draftAnswerToVisitorQuestion',
        summary: 'Have the editor draft an answer to a visitor question in Roy\'s voice. Returns a job id; poll getDraftResult.',
        requestBody: jsonBody(idOnly),
        responses: { 202: ok('Accepted', obj({ jobId: { type: 'string' } })) },
      } },
      '/api/gpt/questions/draft/{jobId}': { get: {
        operationId: 'getDraftResult',
        summary: 'Get the drafted answer. If status is running, wait a few seconds and call again. Show Roy the full draft.',
        parameters: jobParam,
        responses: { 200: ok('Job state', jobStatus) },
      } },
      '/api/gpt/questions/publish': { post: {
        operationId: 'publishAnswerToWisdom',
        summary: 'Publish a visitor question and its draft to the Wisdom page, only after Roy approves.',
        requestBody: jsonBody(idOnly),
        responses: { 200: ok('Published') },
      } },
      '/api/gpt/wisdom-sections': { get: {
        operationId: 'listWisdomSections',
        summary: 'List the section names on the Wisdom page.',
        responses: { 200: ok('Section names', { type: 'array', items: { type: 'string' } }) },
      } },
      '/api/gpt/upload': { post: {
        operationId: 'uploadFileToSite',
        summary: 'Put a file or picture Roy attached to the chat onto the site (pictures, PDF, Word, text). Then tell the editor where it is if Roy wants it used on a page.',
        requestBody: jsonBody(obj({ openaiFileIdRefs: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, id: { type: 'string' }, mime_type: { type: 'string' }, download_link: { type: 'string' } } } } }, ['openaiFileIdRefs'])),
        responses: { 200: ok('Results', { type: 'array', items: { type: 'object' } }) },
      } },
    },
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
    security: [{ bearer: [] }],
  };
}

// Read a server-sent-events body and return the payload of the final done event; throw on an error event.
async function readDraftStream(body) {
  const decoder = new TextDecoder();
  let buf = '';
  let result = null;
  for await (const chunk of body) {
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const raw = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const type = /^event: (.*)$/m.exec(raw)?.[1];
      const data = /^data: (.*)$/m.exec(raw)?.[1] ?? '';
      if (type === 'error') throw new Error(data);
      if (type === 'done') result = JSON.parse(data);
    }
  }
  if (!result) throw new Error('The draft ended without a result');
  return result;
}

export function mountGptRelay(app, { env, runTurn, commit, logUsage, undo, history, adminFetch, origin }) {
  const key = env.GPT_ACTION_KEY;
  if (!key || key.length < 32) throw new Error('GPT_ACTION_KEY must be set to at least 32 characters');
  const keyDigest = digest(key);
  const jobs = new Map();
  let running = null; // the editor runs one message at a time and shares one conversation, like /admin/
  let sessionId = null;

  const clientIp = req => (req.get('x-forwarded-for') ?? req.ip ?? '').split(',')[0].trim();
  const json = express.json({ limit: '32kb' });

  const requireKey = (req, res, next) => {
    const m = /^Bearer (.+)$/.exec(req.get('authorization') ?? '');
    if (!m || !timingSafeEqual(digest(m[1]), keyDigest)) {
      // Same line shape as the /admin/ login so the existing fail2ban jail bans repeat offenders.
      console.log(`LOGIN FAIL ip=${clientIp(req)} via=gpt`);
      return res.status(401).json({ error: 'unauthorized' });
    }
    next();
  };

  const startJob = work => {
    const jobId = randomUUID();
    const job = { status: 'running', startedAt: Date.now(), chunks: [] };
    jobs.set(jobId, job);
    (async () => {
      try {
        await work(job);
        job.status = 'done';
      } catch (err) {
        console.error(`GPT relay job failed: ${err.stack}`);
        job.status = 'error';
        job.error = err.message;
      } finally {
        job.finishedAt = Date.now();
        setTimeout(() => jobs.delete(jobId), JOB_TTL_MS).unref();
      }
    })();
    return { jobId, job };
  };

  const jobView = (job) => ({
    status: job.status,
    elapsedSeconds: Math.round(((job.finishedAt ?? Date.now()) - job.startedAt) / 1000),
    ...(job.status === 'running' && job.chunks.length && { progress: job.chunks[job.chunks.length - 1] }),
    ...(job.status === 'done' && { reply: job.chunks.join('\n\n'), changedSite: job.changedSite ?? false }),
    ...(job.status === 'error' && { error: job.error }),
  });

  const pollRoute = path => app.get(path, requireKey, (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'unknown job' });
    res.json(jobView(job));
  });

  // Pass a request to the matching /admin/ endpoint and hand back exactly what it said.
  const forward = (method, path, adminPath) => app[method](path, requireKey, json, async (req, res) => {
    try {
      const r = await adminFetch(adminPath, {
        method: method.toUpperCase(),
        ...(method === 'post' && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(req.body ?? {}) }),
      });
      const text = await r.text();
      res.status(r.status).type(r.headers.get('content-type') ?? 'text/plain').send(text);
    } catch (err) {
      console.error(`GPT relay forward ${adminPath} failed: ${err.stack}`);
      res.status(502).json({ error: err.message });
    }
  });

  app.get('/api/gpt/openapi.json', (req, res) => res.json(openApiSpec(origin)));

  app.post('/api/gpt/message', json, requireKey, (req, res) => {
    const message = req.body?.message;
    if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE) {
      return res.status(400).json({ error: `message must be 1 to ${MAX_MESSAGE} characters` });
    }
    if (running) return res.status(409).json({ error: 'The editor is still working on the previous request', ...(running !== 'undo' && { jobId: running }) });
    const { jobId } = startJob(async job => {
      try {
        const out = await runTurn({ message, sessionId: sessionId ?? undefined, siteDir: env.SITE_DIR, onText: t => job.chunks.push(t) });
        if (out.sessionId) sessionId = out.sessionId;
        job.changedSite = (await commit(env.SITE_REPO_DIR, `Roy: ${message.substring(0, 60)}`)) !== null;
        if (out.usage) logUsage(env.USAGE_LOG, { ts: new Date().toISOString(), sessionId, via: 'gpt', ...out.usage });
      } finally {
        running = null;
      }
    });
    running = jobId;
    res.status(202).json({ jobId });
  });
  pollRoute('/api/gpt/message/:jobId');

  app.post('/api/gpt/undo', requireKey, async (req, res) => {
    if (running) return res.status(409).json({ error: 'The editor is still working; wait for it to finish before undoing.' });
    running = 'undo'; // blocks new messages while the repo is being reverted
    try {
      res.json(await undo(env.SITE_REPO_DIR));
    } catch (err) {
      res.status(409).json({ error: err.message });
    } finally {
      running = null;
    }
  });

  app.get('/api/gpt/history', requireKey, async (req, res) => {
    try {
      res.json(await history(env.SITE_REPO_DIR, 20));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  forward('get', '/api/gpt/questions', '/api/questions');
  forward('post', '/api/gpt/questions/update', '/api/questions/update');
  forward('post', '/api/gpt/questions/delete', '/api/questions/delete');
  forward('post', '/api/gpt/questions/publish', '/api/questions/publish');
  forward('get', '/api/gpt/wisdom-sections', '/api/wisdom-sections');

  app.post('/api/gpt/questions/draft', json, requireKey, (req, res) => {
    const id = req.body?.id;
    if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'id is required' });
    const { jobId } = startJob(async job => {
      const r = await adminFetch('/api/questions/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      job.chunks.push((await readDraftStream(r.body)).draft);
    });
    res.status(202).json({ jobId });
  });
  pollRoute('/api/gpt/questions/draft/:jobId');

  // ChatGPT passes attached files as short-lived download links. Each one goes through the admin upload,
  // which enforces the allowed types, name rules and size.
  app.post('/api/gpt/upload', json, requireKey, async (req, res) => {
    const refs = req.body?.openaiFileIdRefs;
    if (!Array.isArray(refs) || !refs.length) return res.status(400).json({ error: 'openaiFileIdRefs is required' });
    const results = [];
    for (const ref of refs) {
      const name = String(ref?.name ?? '').trim().replace(/\s+/g, '-');
      try {
        const link = new URL(ref?.download_link);
        if (link.protocol !== 'https:') throw new Error('download link must be https');
        const dl = await fetch(link);
        if (!dl.ok) throw new Error(`download failed with ${dl.status}`);
        const buf = Buffer.from(await dl.arrayBuffer());
        if (buf.length > MAX_UPLOAD) throw new Error('file is larger than 15 MB');
        const r = await adminFetch('/api/upload', { method: 'POST', headers: { 'x-filename': name, 'content-type': 'application/octet-stream' }, body: buf });
        const text = await r.text();
        results.push(r.ok ? { name, ok: true, ...JSON.parse(text) } : { name, ok: false, error: text });
      } catch (err) {
        results.push({ name, ok: false, error: err.message });
      }
    }
    res.json(results);
  });
}
