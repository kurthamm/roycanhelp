# roycanhelp.org Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Roy's sardonic static resource site for parents of children with disabilities, plus a password-gated web chat backed by the Claude Agent SDK that lets non-technical Roy change the live site by typing plain English.

**Architecture:** One git repo (`~/dhelp`) holds `site/` (static HTML/CSS/JS, no build pipeline) and `service/` (Node/Express chat backend wrapping `@anthropic-ai/claude-agent-sdk`). In production the repo is cloned to `/var/www/roycanhelp`; nginx serves `site/` directly and proxies an unadvertised chat path to the service on 127.0.0.1. The agent edits files in the live clone and auto-commits — edits are live instantly, every change is revertible.

**Tech Stack:** Static HTML/CSS/vanilla JS; Node 20+ (ESM), Express, `@anthropic-ai/claude-agent-sdk`; `node:test` for tests; nginx, certbot, systemd, fail2ban on the existing DigitalOcean droplet; Cloudflare DNS (grey-cloud).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-02-roycanhelp-design.md` — re-read the Voice section before writing any site content.
- Voice: first-person Roy, sardonic Mad-Magazine register; satire punches up (bureaucracies, waitlists, insurers) NEVER at kids, families, or disability; every joke sits on accurate info; no medical/legal advice.
- Never commit on `master`/`main` — all work on `feature/*` branches (repo currently on `feature/design-spec`; continue there or branch `feature/build`).
- No fallback/masking patterns (`|| {}`, empty catch, stubbed integrations). Missing env config = immediate startup failure with a clear message.
- Verification: `make check` at repo root is the canonical command (`testrepo` will resolve to it). Run it after every task.
- Infra mutations (DNS record, nginx reload, certbot, systemd enable, fail2ban) are flagged in-plan; DNS record creation additionally requires Kurt's explicit approval at that step.
- ~~The chat URL slug must NEVER appear in any committed file.~~ Superseded 2026-08-02 by Kurt: the chat lives at the fixed path `/admin/`, reachable via a small "Admin" link in every page footer. Defense = password + nginx rate limit + fail2ban (no secret slug). The path still carries `X-Robots-Tag: noindex, nofollow`.
- Secrets (`ANTHROPIC_API_KEY`, `CHAT_PASSWORD`, `SESSION_SECRET`) live only in `/etc/roycanhelp/env` (root:roychat 640). Never committed.

---

### Task 1: Repo scaffold, Makefile, site checker

**Files:**
- Create: `Makefile`
- Create: `tools/check-site.mjs`
- Create: `.gitignore`
- Test: `tools/test/check-site.test.mjs`

**Interfaces:**
- Produces: `make check` (runs site checker + service tests if present); `node tools/check-site.mjs site` exits 0 on clean, 1 with per-file errors on: broken internal links/hrefs to missing local files, `<script src>` targets missing, JS files failing `node --check`, HTML files missing `<title>` or `lang` attribute.

- [ ] **Step 1: Write the failing test**

`tools/test/check-site.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkSite } from '../check-site.mjs';

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'site-'));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return dir;
}

const GOOD = '<!doctype html><html lang="en"><head><title>T</title></head><body><a href="other.html">x</a></body></html>';

test('clean site passes', () => {
  const dir = fixture({ 'index.html': GOOD, 'other.html': GOOD.replace('other.html', 'index.html') });
  assert.deepEqual(checkSite(dir), []);
});

test('broken internal link reported', () => {
  const dir = fixture({ 'index.html': GOOD }); // other.html missing
  const errs = checkSite(dir);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /index\.html.*other\.html/);
});

test('missing title and bad js reported', () => {
  const dir = fixture({
    'index.html': '<!doctype html><html lang="en"><body><script src="js/a.js"></script></body></html>',
    'js/a.js': 'function ( {',
  });
  const errs = checkSite(dir);
  assert.ok(errs.some(e => /title/i.test(e)));
  assert.ok(errs.some(e => /a\.js/.test(e)));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tools/test/`
Expected: FAIL — cannot find module `../check-site.mjs`

- [ ] **Step 3: Implement the checker**

`tools/check-site.mjs`:
```js
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

export function checkSite(root) {
  const errors = [];
  const files = walk(root);
  for (const f of files.filter(f => f.endsWith('.js'))) {
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
    catch (e) { errors.push(`${f}: JS syntax error: ${e.stderr.toString().split('\n')[0]}`); }
  }
  for (const f of files.filter(f => f.endsWith('.html'))) {
    const html = readFileSync(f, 'utf8');
    if (!/<title>[^<]+<\/title>/i.test(html)) errors.push(`${f}: missing <title>`);
    if (!/<html[^>]+lang=/i.test(html)) errors.push(`${f}: missing lang attribute on <html>`);
    const refs = [...html.matchAll(/(?:href|src)="([^"#?]+[^"]*?)"/g)].map(m => m[1].split(/[#?]/)[0]);
    for (const ref of refs) {
      if (!ref || /^(https?:|mailto:|tel:|\/\/|data:)/.test(ref)) continue;
      const target = ref.startsWith('/') ? join(root, ref) : resolve(dirname(f), ref);
      if (!existsSync(target)) errors.push(`${f}: broken internal link -> ${ref}`);
    }
  }
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errs = checkSite(process.argv[2] ?? 'site');
  errs.forEach(e => console.error(e));
  process.exit(errs.length ? 1 : 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tools/test/`
Expected: 3 pass

- [ ] **Step 5: Makefile and .gitignore**

`Makefile`:
```make
check:
	node --test tools/test/
	@if [ -d service/test ]; then cd service && npm test; fi
	node tools/check-site.mjs site
.PHONY: check
```
`.gitignore`:
```
node_modules/
*.log
.env
```
Note: `site/` doesn't exist until Task 2 — for this task only, verify with `node --test tools/test/`. From Task 2 on, `make check` is the command.

- [ ] **Step 6: Commit**

```bash
git add Makefile .gitignore tools/
git commit -m "feat: repo scaffold with site checker and make check"
```

---

### Task 2: Site skeleton — stylesheet, shared JS, homepage

**Files:**
- Create: `site/css/site.css`
- Create: `site/js/site.js`
- Create: `site/index.html`

**Interfaces:**
- Produces: the shared page shell every later page copies — `<header class="masthead">` with site title + `<nav>` linking all top pages; `js/site.js` provides glossary tooltips: any `<span class="term" data-def="...">word</span>` shows its definition on hover/tap.
- Nav links (exact filenames later tasks must create): `index.html, diagnosis.html, early-intervention.html, school-ieps.html, paying-for-care.html, therapies.html, turning-18.html, qualify.html, states.html, glossary.html, about.html`.

- [ ] **Step 1: Write `site/css/site.css`**

Design language (Mad-Magazine energy, still readable): cream background `#fdf6e3`; ink `#1a1a1a`; accent red `#d62828`; accent yellow `#ffd166`. Big slab headlines (`font-family: 'Archivo Black', Impact, sans-serif` with system fallback — no external font loading), body in system serif (Georgia). Headlines slightly rotated (`transform: rotate(-1deg)`) on `h1`; `.margin-gag` class for Mad-style sidebar quips (yellow box, hand-drawn border via `border: 3px solid #1a1a1a; border-radius: 255px 15px 225px 15px/15px 225px 15px 255px`); `.term` dotted-underlined with a positioned tooltip on hover/focus. Mobile-first, max content width 46rem, WCAG AA contrast. Write the full stylesheet (~150 lines).

- [ ] **Step 2: Write `site/js/site.js`**

```js
// Glossary tooltips: <span class="term" data-def="...">word</span>
document.addEventListener('DOMContentLoaded', () => {
  for (const el of document.querySelectorAll('.term')) {
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    const tip = document.createElement('span');
    tip.className = 'tooltip';
    tip.textContent = el.dataset.def;
    el.append(tip);
    const toggle = (on) => tip.classList.toggle('visible', on);
    el.addEventListener('mouseenter', () => toggle(true));
    el.addEventListener('mouseleave', () => toggle(false));
    el.addEventListener('focus', () => toggle(true));
    el.addEventListener('blur', () => toggle(false));
    el.addEventListener('click', () => tip.classList.toggle('visible'));
  }
});
```

- [ ] **Step 3: Write `site/index.html`**

Full homepage in Roy's voice. Required elements: masthead with site name **"Roy Can Help — a field guide from a dad who's been in the waiting room"**; hero intro (first-person Roy, ~120 words: his son has autism, his friend's daughter has Down syndrome, nobody hands you a map, so he drew one); a "Where are you right now?" grid of situation cards linking to the six situation pages; one `.margin-gag` (e.g. "Fun fact: the paperwork weighs more than the kid did at birth"); footer with about/disclaimer link ("I'm a dad, not a doctor or a lawyer"). Every nav filename from the Interfaces block must be present in the nav even though pages arrive in Tasks 3–5 — create empty-but-valid placeholder pages for each (shell + `<h1>` + "Roy's still typing this one." line) so `make check` link-checking passes from this commit onward.

- [ ] **Step 4: Verify**

Run: `make check`
Expected: PASS (checker now runs against `site/`)

- [ ] **Step 5: Commit**

```bash
git add site/ && git commit -m "feat: site skeleton — shell, styles, tooltips, homepage"
```

---

### Task 3: Content — six situation guides + qualify + glossary + about

**Files:**
- Modify: `site/diagnosis.html`, `site/early-intervention.html`, `site/school-ieps.html`, `site/paying-for-care.html`, `site/therapies.html`, `site/turning-18.html`, `site/qualify.html`, `site/glossary.html`, `site/about.html` (replace Task 2 placeholders with real content)

**Interfaces:**
- Consumes: Task 2 shell, `.margin-gag`, `.term` tooltip markup.
- Produces: the seeded editorial content Roy will reshape.

- [ ] **Step 1: Author the six situation guides**

Each page: 700–1200 words, Roy's first-person sardonic voice, structure = sardonic H1 → "what this actually is" plain-English section → step-by-step "what to do" list with real program names, federal law citations (IDEA Part C/Part B, Section 504, SSI, Medicaid EPSDT, ABLE Act) and real national links (ecta​center.org, parentcenterhub.org, ssa.gov, medicaid.gov, ablenrc.org) → "traps I fell into" section → at least one `.margin-gag` → "your state" pointer to `states.html`. Required angles per page:
  - `diagnosis.html` — "So You Have a Diagnosis. The Casserole Brigade Is On Its Way." Grief-is-normal note played straight (no jokes at feelings), then the actual first-90-days checklist.
  - `early-intervention.html` — Part C, free evaluations, "call your state's EI line before you finish this paragraph," IFSP explained.
  - `school-ieps.html` — IEP vs 504, evaluations, "the meeting where eight professionals and one box of tissues discuss your child," parent rights (prior written notice, IEE).
  - `paying-for-care.html` — SSI, Medicaid waivers (and the waitlist reality), EPSDT, ABLE accounts, "the deductible is not a suggestion."
  - `therapies.html` — ABA/OT/PT/speech, insurance mandates vary by state, getting schools vs insurance to pay, waitlist survival.
  - `turning-18.html` — "Congratulations, the State Now Thinks Your Child Is a Stranger." Guardianship vs supported decision-making (present both honestly), SSI adult redetermination, adult Medicaid, transition plans required by IDEA at 16.
- Down syndrome and autism each get a dedicated call-out box on relevant pages (e.g., DS: congenital-heart/Medicaid interplay, autism: state insurance mandates), written to also generalize.

- [ ] **Step 2: Author `qualify.html`**

"Does My Child Qualify? (Probably For More Than You Think)" — table of programs × who qualifies × where to apply: IDEA Part C (0–3), IDEA Part B (3–21), Section 504, SSI (childhood disability + family income), Medicaid waivers (child's income, not parents', in most waiver states — flag this loudly), EPSDT, CHIP, ABLE. Each acronym wrapped in `.term` tooltips.

- [ ] **Step 3: Author `glossary.html` and `about.html`**

Glossary: ≥30 terms, each entry = sardonic one-liner **then** the straight definition. (IEP: "A legally binding document the school hopes you won't read. Really: Individualized Education Program — the written plan IDEA requires…"). `about.html`: who Roy is, why the site exists, the disclaimer (not medical/legal advice, no affiliations, nothing sold), and the punch-up promise stated to readers.

- [ ] **Step 4: Verify**

Run: `make check` — PASS. Manually skim each page for voice violations (any joke whose target is a child/family = fix before commit).

- [ ] **Step 5: Commit**

```bash
git add site/ && git commit -m "feat: seed situation guides, qualify, glossary, about"
```

---

### Task 4: State directory

**Files:**
- Create: `site/data/states.json`
- Modify: `site/states.html`, `site/js/site.js`

**Interfaces:**
- Produces: `states.json` — array of 51 objects `{ "code": "AL", "name": "Alabama", "dd_agency": {"name": "...", "url": "..."}, "medicaid": {"name": "...", "url": "..."}, "ei_program": {"name": "...", "url": "..."}, "pti_center": {"name": "...", "url": "..."} }` (DD agency, Medicaid/waiver info, Part C Early Intervention program, federally-funded Parent Training & Information center). `site.js` gains a renderer: on `states.html`, a `<select id="state-picker">` populated from the JSON renders the chosen state's card into `#state-card`.

- [ ] **Step 1: Build `states.json`**

Populate all 50 states + DC from authoritative directories: ECTA Center's Part C contacts list, parentcenterhub.org's PTI directory, medicaid.gov state overviews, and each state's DD agency (NASDDDS member list). Use official state URLs. This is research-heavy: verify each URL resolves (script a `curl -sIL -o /dev/null -w '%{http_code}'` loop over the JSON; every URL must return <400).

- [ ] **Step 2: Renderer + page**

Add to `site.js` (guarded by `document.getElementById('state-picker')`): fetch `data/states.json`, populate the select, render card with the four links on change, remember last choice in `localStorage`. `states.html`: intro in Roy's voice ("Every state runs this differently, because why would they make it easy"), the picker, empty `#state-card`.

- [ ] **Step 3: Verify**

Run: `make check` and the URL-status loop — PASS / all <400. Open with `python3 -m http.server -d site` and spot-check three states render.

- [ ] **Step 4: Commit**

```bash
git add site/ && git commit -m "feat: state-by-state directory with picker"
```

---

### Task 5: Service scaffold + auth module

**Files:**
- Create: `service/package.json`
- Create: `service/auth.mjs`
- Test: `service/test/auth.test.mjs`

**Interfaces:**
- Produces: `service/auth.mjs` exporting:
  - `makeSession(secret) -> string` — `payload.signature`, payload = base64url `{exp}` (now + 30 days), signature = HMAC-SHA256(secret, payload).
  - `verifySession(token, secret) -> boolean` — valid signature and unexpired.
  - `checkPassword(supplied, actual) -> boolean` — timing-safe compare.
- `service/package.json`: `{ "name": "roycanhelp-chat", "private": true, "type": "module", "scripts": { "test": "node --test test/" }, "dependencies": { "express": "^4", "@anthropic-ai/claude-agent-sdk": "latest" } }` — then `cd service && npm install` (commits `package-lock.json`, not `node_modules`).

- [ ] **Step 1: Write the failing test**

`service/test/auth.test.mjs`:
```js
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
test('expired token rejected', () => {
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
```
(Note: top-level `await import` inside a non-async test callback is a syntax error — make that test callback `async`.)

- [ ] **Step 2: Run to verify failure**

Run: `cd service && npm test` — FAIL, module not found.

- [ ] **Step 3: Implement `service/auth.mjs`**

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

const sign = (payload, secret) =>
  createHmac('sha256', secret).update(payload).digest('base64url');

export function makeSession(secret) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + THIRTY_DAYS })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySession(token, secret) {
  if (typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload, secret);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url')).exp > Date.now(); }
  catch { return false; }
}

export function checkPassword(supplied, actual) {
  const a = Buffer.from(String(supplied)), b = Buffer.from(String(actual));
  return a.length === b.length && timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run tests — PASS. Then commit**

```bash
git add service/package.json service/package-lock.json service/auth.mjs service/test/
git commit -m "feat: chat service scaffold with signed-cookie auth"
```

---

### Task 6: Git operations module (auto-commit + undo)

**Files:**
- Create: `service/gitops.mjs`
- Test: `service/test/gitops.test.mjs`

**Interfaces:**
- Produces: `service/gitops.mjs` exporting (all take `repoDir`, run git via `execFile`, promisified):
  - `commitAll(repoDir, message) -> Promise<string|null>` — stages everything, commits as author `Roy via Chat <chat@roycanhelp.org>`; returns commit hash, or `null` if nothing to commit.
  - `undoLast(repoDir) -> Promise<{hash: string, message: string}>` — reverts HEAD **only if** HEAD's author matches the chat author; otherwise throws `Error('last commit was not made by chat')`.
  - `lastChange(repoDir) -> Promise<{hash: string, message: string, author: string}>`.

- [ ] **Step 1: Write the failing test**

`service/test/gitops.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { commitAll, undoLast, lastChange } from '../gitops.mjs';

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'repo-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir });
  git('init', '-b', 'main');
  git('config', 'user.email', 'kurt@test'); git('config', 'user.name', 'Kurt');
  writeFileSync(join(dir, 'a.txt'), 'v1');
  git('add', '.'); git('commit', '-m', 'seed');
  return dir;
}

test('commitAll commits as chat author, null when clean', async () => {
  const dir = repo();
  writeFileSync(join(dir, 'a.txt'), 'v2');
  const hash = await commitAll(dir, 'Roy: edited a.txt');
  assert.match(hash, /^[0-9a-f]{7,}/);
  assert.equal((await lastChange(dir)).author, 'Roy via Chat');
  assert.equal(await commitAll(dir, 'nothing'), null);
});

test('undoLast reverts a chat commit', async () => {
  const dir = repo();
  writeFileSync(join(dir, 'a.txt'), 'v2');
  await commitAll(dir, 'Roy: edit');
  await undoLast(dir);
  assert.equal(readFileSync(join(dir, 'a.txt'), 'utf8'), 'v1');
});

test('undoLast refuses non-chat commits', async () => {
  const dir = repo();
  await assert.rejects(() => undoLast(dir), /not made by chat/);
});
```

- [ ] **Step 2: Run — FAIL (module not found)**

- [ ] **Step 3: Implement `service/gitops.mjs`**

```js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
export const CHAT_AUTHOR = 'Roy via Chat <chat@roycanhelp.org>';

const git = (dir, ...args) => run('git', args, { cwd: dir });

export async function commitAll(repoDir, message) {
  await git(repoDir, 'add', '-A');
  const { stdout: status } = await git(repoDir, 'status', '--porcelain');
  if (!status.trim()) return null;
  await git(repoDir, 'commit', '--author', CHAT_AUTHOR, '-m', message);
  return (await git(repoDir, 'rev-parse', 'HEAD')).stdout.trim();
}

export async function lastChange(repoDir) {
  const { stdout } = await git(repoDir, 'log', '-1', '--format=%H%x00%an%x00%s');
  const [hash, author, message] = stdout.trim().split('\0');
  return { hash, author, message };
}

export async function undoLast(repoDir) {
  const last = await lastChange(repoDir);
  if (last.author !== 'Roy via Chat') throw new Error('last commit was not made by chat');
  await git(repoDir, 'revert', '--no-edit', 'HEAD');
  return last;
}
```
Note: `git commit --author` still requires committer identity — production service sets env `GIT_COMMITTER_NAME=Roy via Chat`, `GIT_COMMITTER_EMAIL=chat@roycanhelp.org` in the systemd unit; tests inherit repo-level config already set in the fixture.

- [ ] **Step 4: Run tests — PASS. Commit**

```bash
git add service/gitops.mjs service/test/gitops.test.mjs
git commit -m "feat: auto-commit and author-guarded undo"
```

---

### Task 7: Agent wrapper, Roy prompt, usage log

**Files:**
- Create: `service/prompt.mjs`
- Create: `service/agent.mjs`
- Create: `service/usage.mjs`
- Test: `service/test/usage.test.mjs`

**Interfaces:**
- Consumes: nothing internal (SDK only).
- Produces:
  - `prompt.mjs` exports `ROY_SYSTEM_PROMPT` (string).
  - `agent.mjs` exports `async function runTurn({ message, sessionId, siteDir, onText }) -> {sessionId, usage, summary}` — wraps SDK `query()`; `onText(delta)` fires per assistant text chunk; `usage` = `{input_tokens, output_tokens}` from the result message; `summary` = final assistant text.
  - `usage.mjs` exports `logUsage(file, record)` — appends one JSON line `{ts, sessionId, input_tokens, output_tokens}`; and `readUsage(file) -> record[]`.

- [ ] **Step 1: TDD `usage.mjs`** (test: log two records to a temp file, read them back, assert fields; missing file reads as `[]` — that is a real empty state, not masking). Implement with `appendFileSync`/`readFileSync` + JSONL parse.

- [ ] **Step 2: Write `prompt.mjs`**

`ROY_SYSTEM_PROMPT` must state, in full sentences: you are the editor of roycanhelp.org, Roy's personal site; Roy is the non-technical owner talking to you; the site voice is first-person Roy, sardonic, Mad-Magazine register, satire punches up at bureaucracies never at kids/families/disability; all program facts must stay accurate, no medical/legal advice; reply to Roy in plain English with links to changed pages (e.g. `https://roycanhelp.org/qualify.html`), never show code or diffs unless he asks; after any file change run `make -C .. check` and fix failures before finishing; keep pages consistent with `css/site.css` classes (`.margin-gag`, `.term` tooltips); never edit files outside the site directory; never mention the chat URL in site content.

- [ ] **Step 3: Write `agent.mjs`**

```js
import { query } from '@anthropic-ai/claude-agent-sdk';
import { ROY_SYSTEM_PROMPT } from './prompt.mjs';

const ALLOWED_TOOLS = ['Read', 'Edit', 'Write', 'Glob', 'Grep',
  'Bash(make:*)', 'Bash(git status:*)', 'Bash(git log:*)', 'Bash(git diff:*)'];

export async function runTurn({ message, sessionId, siteDir, onText }) {
  const q = query({
    prompt: message,
    options: {
      cwd: siteDir,
      resume: sessionId ?? undefined,
      allowedTools: ALLOWED_TOOLS,
      permissionMode: 'acceptEdits',
      settingSources: [],
      systemPrompt: { type: 'preset', preset: 'claude_code', append: ROY_SYSTEM_PROMPT },
    },
  });
  let usage = null, summary = '', sid = sessionId ?? null;
  for await (const msg of q) {
    if (msg.type === 'system' && msg.subtype === 'init') sid = msg.session_id;
    if (msg.type === 'assistant') {
      for (const block of msg.message.content) {
        if (block.type === 'text') { onText(block.text); summary = block.text; }
      }
    }
    if (msg.type === 'result') usage = { input_tokens: msg.usage?.input_tokens, output_tokens: msg.usage?.output_tokens };
  }
  return { sessionId: sid, usage, summary };
}
```
Implementer note: verify field names against the installed SDK version's docs (`node_modules/@anthropic-ai/claude-agent-sdk/README.md`) — `resume`, `allowedTools`, `permissionMode`, `settingSources`, `systemPrompt` are current API; adjust if the installed version differs. No automated test for this module (it calls a live agent); it is exercised by the Task 9 smoke test.

- [ ] **Step 4: Run `npm test` (usage tests pass) and `make check`. Commit**

```bash
git add service/prompt.mjs service/agent.mjs service/usage.mjs service/test/usage.test.mjs
git commit -m "feat: agent wrapper with Roy voice prompt and usage log"
```

---

### Task 8: HTTP server + chat UI

**Files:**
- Create: `service/server.mjs`
- Create: `service/public/chat.html`
- Test: `service/test/server.test.mjs`

**Interfaces:**
- Consumes: `auth.mjs` (`makeSession/verifySession/checkPassword`), `gitops.mjs` (`commitAll/undoLast`), `usage.mjs` (`logUsage`), `agent.mjs` (`runTurn`).
- Produces: `createApp({ env, runTurn })` (dependency-injected for tests) plus a main block that reads env and listens. Routes (all under the nginx-proxied prefix, so the app uses relative paths only):
  - `GET /` → login form if no valid cookie, else `chat.html`.
  - `POST /api/login` (`{password}`) → sets `session` cookie (HttpOnly, Secure, SameSite=Strict) or 401 + log line `LOGIN FAIL ip=<ip>` to stdout (fail2ban hook).
  - `POST /api/message` (`{message}`, auth) → SSE stream: events `text` (deltas), then commits via `commitAll(env.SITE_REPO_DIR, 'Roy: ' + first 60 chars of message)`, logs usage, ends with event `done` `{summary, committed}`.
  - `POST /api/undo` (auth) → `undoLast`; 200 `{reverted: message}` or 409 with the error message.
  - Session id ↔ SDK session: kept in an HttpOnly `agentsession` cookie so Roy's browser continues one conversation.
- Env (all REQUIRED, startup throws listing missing ones): `ANTHROPIC_API_KEY, CHAT_PASSWORD, SESSION_SECRET, SITE_DIR, SITE_REPO_DIR, USAGE_LOG, PORT`.

- [ ] **Step 1: Write failing tests** — using `node:test` + `fetch` against `createApp` with a **fake** `runTurn` (emits two text deltas, returns fixed usage) and a temp git repo (reuse Task 6 fixture helper): login wrong password → 401 and `LOGIN FAIL` on stdout; login right password → cookie; `/api/message` without cookie → 401; with cookie → SSE contains both deltas and a `done` event, and the temp repo gained a chat-authored commit; `/api/undo` reverts it; missing env var → `createApp` throws naming it.

- [ ] **Step 2: Run — FAIL. Step 3: Implement `server.mjs`** (~120 lines: express, cookie parse by hand or `cookie` pkg, SSE via `res.write('event: text\ndata: ...\n\n')`, no external session store). Main block: `if (import.meta.url === file://argv[1])` → validate env, `createApp({env, runTurn})`, listen on `127.0.0.1:PORT`.

- [ ] **Step 4: Write `service/public/chat.html`** — single self-contained page, mobile-first, site stylesheet vibes: transcript pane, textarea + Send, **Undo last change** button (confirm dialog), "working…" indicator while SSE open, transcript persisted to `localStorage`, renders links as clickable. Plain vanilla JS, `fetch` + `EventSource`-style reading of the SSE response via `ReadableStream` (POST body rules out native EventSource).

- [ ] **Step 5: Run `npm test` and `make check` — PASS. Commit**

```bash
git add service/server.mjs service/public/ service/test/server.test.mjs
git commit -m "feat: chat HTTP service with SSE streaming and undo"
```

---

### Task 3b: Journey framing (added 2026-08-02 per Kurt)

**Files:** Modify `site/index.html`, the six situation guides, `site/css/site.css` (small additions only).

Kurt: the site should follow the journey Roy's son took — birth, the federal layer, the state/local battles, learning what services and benefits exist. Reframe, don't rebuild:
- [ ] `index.html`: replace the situation-card grid with **"The Road Map — the route Roy's family actually drove"**: a vertical numbered timeline (CSS only, `.journey` list) of the six stages in chronological order — 1. The diagnosis (birth & the casserole brigade) → 2. Birth to three (Early Intervention, the federal front door) → 3. School years (IEPs — the state and local battles begin) → 4. Paying for it (SSI, waivers — learning what exists) → 5. Therapies (the waitlist wars) → 6. Turning 18 (starting over as an adult). Each stage: number, sardonic title, one-line first-person hook from Roy's story, link to the existing page. Keep the hero intro; sharpen it: Roy learned this map the hard way so you get it free.
- [ ] Each situation guide gets a short first-person **"Where we were"** opening paragraph (2-4 sentences of Roy's own story at that stage — invented plausibly, marked nothing as medical fact) before the existing content, plus "← previous stage / next stage →" links at the bottom in journey order.
- [ ] Nav order in every page's header becomes journey order (same filenames, reordered), qualify/states/glossary/about after the journey pages.
- [ ] `make check` PASS; voice rules hold (grief straight, satire up). Commit `feat: reframe site as Roy's journey timeline`.

---

### Task 3c: Roy's Lessons Learned section (added 2026-08-02 per Kurt)

**Files:** Create `site/lessons.html`; modify all site page navs (new item after Turning 18: "Roy's Lessons"), `service/prompt.mjs`.

Kurt: a key part of the site is Roy's lessons learned — NOT a blog; a section Roy organizes and grows however he wants.
- [ ] `lessons.html`: "Roy's Lessons Learned (or: Scar Tissue, Organized)" — field-notes format, grouped by theme, no dates: **The Paperwork · The Phone Calls · The Meetings · The Money · What I'd Tell Myself on Day One**. Seed 2–3 lessons per theme, each a `.lesson` card: bold what-happened one-liner → what Roy learned → "do this instead" takeaway. First-person, sardonic, punch-up rules hold; grief straight. Intro paragraph tells the reader (and future Roy) this section grows every time he learns something new the hard way.
- [ ] `.lesson` card styles in css/site.css (hand-drawn border family, yellow takeaway strip).
- [ ] Nav: add "Roy's Lessons" identically to every site page (after Turning 18, before Do You Qualify).
- [ ] `service/prompt.mjs`: teach the agent the convention — new lessons from Roy go into lessons.html under the matching theme (create a new theme if none fits); Roy may rename/reorganize the section freely.
- [ ] `make check` PASS (nav consistency); service tests still pass. Commit `feat: Roy's Lessons Learned section`.

---

### Task 8b: Image upload (added 2026-08-02 per Kurt)

**Files:**
- Modify: `service/server.mjs`, `service/public/chat.html`
- Test: `service/test/server.test.mjs` (extend)

**Interfaces:**
- Consumes: auth middleware, `commitAll` from Task 6, `createApp` DI from Task 8.
- Produces: `POST api/upload` (auth, multipart or raw body with `X-Filename` header — implementer's choice, documented): accepts png/jpg/jpeg/gif/webp/svg up to 15 MB; sanitizes the filename to `[a-z0-9-_.]` (reject path separators/traversal outright — 400, not silent rename); writes to `<SITE_DIR>/images/` (create dir if absent); auto-commits via `commitAll` ("Roy: uploaded <name>"); returns `{path: "images/<name>"}`. Duplicate name → 409, not overwrite.
- chat.html gains a 📎 attach button + drag-drop onto the composer; after upload it inserts `[uploaded: images/<name>]` into the textarea so Roy's next message can tell the agent where to put it, and shows a thumbnail preview in the transcript.

- [ ] **Step 1: TDD** — extend server tests: upload w/o auth → 401; valid png (small fixture buffer) → 200 {path}, file exists in temp SITE_DIR, chat-authored commit created; `../evil.png` filename → 400; `.exe` → 415; duplicate → 409.
- [ ] **Step 2: Implement + wire UI. Step 3: `npm test` + `make check`. Step 4: Commit** `feat: image upload for Roy's chat`

---

### Task 8c: Document upload + footer Admin link (added 2026-08-02 per Kurt)

**Files:** Modify `service/server.mjs`, `service/public/chat.html`, `service/test/server.test.mjs`, all 13 `site/*.html` footers.

- [ ] **Step 1 (TDD): extend upload for documents** — allowed set grows to: images (png/jpg/jpeg/gif/webp/svg → `<SITE_DIR>/images/`) and documents (pdf/doc/docx/txt/rtf/odt → `<SITE_DIR>/files/`), routed by extension; same sanitization/size/duplicate/commit rules ("Roy: uploaded <name>"); returns `{path: "images/<name>"|"files/<name>"}`. Tests: pdf lands in files/ with commit; docx accepted; still 415 for .exe; images still land in images/.
- [ ] **Step 2: chat.html** — attach accepts the new types (file input `accept` list + drop handler); document uploads show a 📄 name chip instead of a thumbnail; inserts `[uploaded: files/<name>]`.
- [ ] **Step 3: footer Admin link** — every site page's footer gains a small, low-key `<a href="/admin/">Admin</a>` (styled muted; it's for Roy, not visitors). Note: the link is absolute `/admin/` — the site pages live at the domain root so this is correct; the checker treats leading-`/` links against the site root and `/admin/` won't exist as a file, so EXTEND `tools/check-site.mjs` with an explicit allowance for `/admin/` (documented in a comment as the chat mount point — not a masking pattern, a routing fact).
- [ ] **Step 4:** `make check` PASS; commit `feat: document upload and footer admin link`.

---

### Task 9: Local end-to-end smoke test

**Files:** none new (fixes only).

- [ ] **Step 1: Run the real stack locally**

```bash
cd ~/dhelp/service
ANTHROPIC_API_KEY=<Kurt's key> CHAT_PASSWORD=test SESSION_SECRET=$(openssl rand -hex 16) \
SITE_DIR=$HOME/dhelp/site SITE_REPO_DIR=$HOME/dhelp USAGE_LOG=/tmp/usage.jsonl PORT=8791 \
node server.mjs
```
Browse `http://127.0.0.1:8791/` (or curl the API): log in, send *"Add a one-line joke to the glossary intro."* Verify: streamed reply in plain English, file actually changed, `git log -1` shows a `Roy via Chat` commit, `make check` passes, usage line in `/tmp/usage.jsonl`. Press Undo → change reverted.

- [ ] **Step 2: Fix anything found (root cause, one fix per cycle), re-run. Commit fixes.**

- [ ] **Step 3: Gate — CodeRabbit review**

Per Kurt's global workflow: push `feature/*` branch to GitHub and open a PR for CodeRabbit review before user testing. **Creating the GitHub repo is an outward-facing action — ask Kurt first** (name suggestion: private repo `roycanhelp`; the chat slug is not in the repo so a later public repo is possible but default private). Address all CodeRabbit IMPORTANT findings.

---

### Task 10: Server deployment — clone, service user, systemd

All steps on the droplet (sudo). Mutating; proceed step-by-step, verify each.

- [ ] **Step 1: Service user + clone**

```bash
sudo useradd -r -m -d /var/lib/roychat -s /usr/sbin/nologin roychat
sudo git clone ~/dhelp /var/www/roycanhelp
sudo chown -R roychat:roychat /var/www/roycanhelp
sudo chmod -R o+rX /var/www/roycanhelp/site   # nginx read access
sudo -u roychat git -C /var/www/roycanhelp config user.name "Roy via Chat"
sudo -u roychat git -C /var/www/roycanhelp config user.email chat@roycanhelp.org
cd /var/www/roycanhelp/service && sudo -u roychat npm ci --omit=dev
```

- [ ] **Step 2: Env file `/etc/roycanhelp/env`** (root:roychat 640)

```
ANTHROPIC_API_KEY=<Kurt provides>
CHAT_PASSWORD=<Kurt+Roy choose>
SESSION_SECRET=<openssl rand -hex 32>
SITE_DIR=/var/www/roycanhelp/site
SITE_REPO_DIR=/var/www/roycanhelp
USAGE_LOG=/var/log/roycanhelp/usage.jsonl
PORT=8791
# CHAT_SLUG removed 2026-08-02 — chat mounts at fixed /admin/ per Kurt
```
`sudo install -d -o roychat /var/log/roycanhelp`

- [ ] **Step 3: systemd unit `/etc/systemd/system/roycanhelp-chat.service`**

```ini
[Unit]
Description=roycanhelp.org chat editor
After=network.target

[Service]
User=roychat
EnvironmentFile=/etc/roycanhelp/env
Environment=GIT_COMMITTER_NAME=Roy via Chat GIT_COMMITTER_EMAIL=chat@roycanhelp.org
WorkingDirectory=/var/www/roycanhelp/service
ExecStart=/usr/bin/node server.mjs
Restart=on-failure
StandardOutput=append:/var/log/roycanhelp/chat.log
StandardError=append:/var/log/roycanhelp/chat.log
ReadWritePaths=/var/www/roycanhelp /var/log/roycanhelp
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```
`sudo systemctl daemon-reload && sudo systemctl enable --now roycanhelp-chat`
Verify: `curl -s http://127.0.0.1:8791/ | grep -qi password` (login page).
Note: the SDK spawns the bundled Claude Code CLI; with `ProtectHome=true` confirm the CLI runs under `/var/lib/roychat` (HOME for roychat is exempt? It is NOT — `ProtectHome=true` hides /home but `/var/lib/roychat` is fine as HOME). If the agent needs a writable HOME set `Environment=HOME=/var/lib/roychat`.

---

### Task 11: DNS, TLS, nginx vhost

- [ ] **Step 1: DNS — ASK KURT FIRST** (explicit approval gate)

Create via Cloudflare API once approved: A record `roycanhelp.org` → `165.245.140.51`, **proxied=false** (grey cloud), TTL auto. Also (Kurt 2026-08-02): `roycanhelp.com` AND `disabilitiessupport.org` (both zones active in Cloudflare, zero records) must redirect to the .org — A records for each → `165.245.140.51` grey-cloud, certbot certs covering both, and a shared nginx server block (`server_name roycanhelp.com disabilitiessupport.org;`) doing `return 301 https://roycanhelp.org$request_uri;`. Verify: `dig +short` on all three domains returns the IP, and `curl -sI https://roycanhelp.com/ https://disabilitiessupport.org/` both 301 to https://roycanhelp.org/.

- [ ] **Step 2: Minimal HTTP vhost + certbot**

Create `/etc/nginx/sites-available/roycanhelp.org` serving port 80 with root `/var/www/roycanhelp/site`, symlink into `sites-enabled`, `sudo nginx -t && sudo systemctl reload nginx`, then `sudo certbot --nginx -d roycanhelp.org -d www.roycanhelp.org --redirect` (www only if a CNAME is added; otherwise apex only).

- [ ] **Step 3: Full vhost**

Replace with (certbot-managed ssl lines retained; `$CHAT_SLUG` written literally from the env file — this file lives only on the server, never in the repo):
```nginx
server {
  listen 443 ssl http2;
  server_name roycanhelp.org;
  # ssl_* lines as installed by certbot

  root /var/www/roycanhelp/site;
  index index.html;

  add_header X-Content-Type-Options nosniff always;
  add_header X-Frame-Options DENY always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;

  location = /admin { return 301 /admin/; }
  location /admin/ {
    add_header X-Robots-Tag "noindex, nofollow" always;
    proxy_pass http://127.0.0.1:8791/;
    proxy_http_version 1.1;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_read_timeout 600s;    # long agent turns
    client_max_body_size 20m;   # image uploads
    proxy_buffering off;        # SSE
  }
  location /admin/api/login {
    limit_req zone=rchatlogin burst=5 nodelay;
    proxy_pass http://127.0.0.1:8791/api/login;
    proxy_set_header X-Forwarded-For $remote_addr;
  }
}
```
Plus `/etc/nginx/conf.d/rchat-ratelimit.conf`: `limit_req_zone $binary_remote_addr zone=rchatlogin rate=10r/m;`
`sudo nginx -t && sudo systemctl reload nginx`.

- [ ] **Step 4: Verify**

`curl -s https://roycanhelp.org/ | grep -qi disabilities` (site up); chat path serves login; `curl https://roycanhelp.org/robots.txt` — add a plain `robots.txt` to `site/` allowing all (the chat path is simply absent from it); confirm security headers with `curl -sI`.

---

### Task 12: fail2ban, backups, handoff

- [ ] **Step 1: fail2ban jail**

`/etc/fail2ban/filter.d/rchat.conf`:
```ini
[Definition]
failregex = ^.*LOGIN FAIL ip=<HOST>.*$
```
`/etc/fail2ban/jail.d/rchat.conf`:
```ini
[rchat]
enabled = true
filter = rchat
logpath = /var/log/roycanhelp/chat.log
maxretry = 5
findtime = 1h
bantime = 24h
ignoreip = 127.0.0.0/8 100.64.0.0/10 192.168.50.0/24
```
`sudo systemctl reload fail2ban; sudo fail2ban-client status rchat`. Test with 6 bad logins from an external host expectation documented (or `fail2ban-regex` against a synthetic log line).

- [ ] **Step 2: Nightly backup**

`/usr/local/bin/backup-roycanhelp.sh` (root, 755): `git -C /var/www/roycanhelp bundle create /var/backups/roycanhelp/site-$(date +%F).bundle --all` keeping last 14 (`find -mtime +14 -delete`). Systemd timer `roycanhelp-backup.timer` daily 03:30. Enable, then run once manually and verify the bundle: `git bundle verify <file>`.

- [ ] **Step 3: Roy handoff card + final e2e**

Full production test: from a phone, visit the chat URL, log in, request a visible change, see it live on the site, undo it. Then write Roy's one-paragraph instructions (URL, password delivery out-of-band, "type what you want changed; Undo button undoes the last change") — delivered to Kurt in chat, not committed. Update `README.md` (repo root: what this is, `make check`, deploy layout pointer) — README/CHANGELOG/DECISIONS only, per docs policy.

---

## Self-review notes

- Spec coverage: voice (T2/T3/T7 prompt), situation guides + qualify + glossary + about (T3), states (T4), chat auth (T5/T8/T11), agent + live publish + auto-commit (T6–T8, T10), undo (T6/T8), usage logging (T7), DNS/TLS/nginx/noindex (T11), fail2ban + backups (T12), success criteria exercised in T9 and T12 Step 3.
- Deliberately out of plan (per spec): notifications, per-user accounts, SEO tooling.
- Type consistency: `runTurn` signature (T7) matches T8 injection; gitops names consistent across T6/T8; env var names consistent across T8/T10.

### Task 13: Ask Roy + Roy's Wisdom (added 2026-08-02 per Kurt)

Vision: public question box feeds a private queue; Roy answers (with AI-drafted starting point), deletes, or leaves pending; answered Q&As publish anonymized to a searchable Ask Roy page; a weekly synthesis distills unique insights into Roy's Wisdom, which Roy can also add to from chat.

- [ ] Server: POST /api/ask (public via nginx, rate-limited, honeypot field, 2000-char cap) appends {id, ts, question} to QUESTIONS_FILE (jsonl, outside site/); GET /api/questions (auth) lists pending; POST /api/questions/delete {id} (auth) removes. TDD.
- [ ] Chat UI: pending-questions panel (count badge, list, per-question Answer/Delete buttons; Answer inserts a prompt asking the agent to draft an answer in Roy's voice from site content for Roy's approval before posting).
- [ ] Pages: site/ask-roy.html (client-side search + topic tags + collapsed Q&A cards + public question form) and site/roys-wisdom.html (question-shaped sections); nav + footer on all pages updated identically.
- [ ] Seed: research-backed common questions, South Carolina (BabyNet, DDSN waivers, Healthy Connections, TEFRA, Ryan's Law, Family Connection SC) + federal; ~12 Q&As in Roy's voice with citations; first Wisdom distillation from the seed.
- [ ] prompt.mjs: conventions for posting approved answers (anonymize asker, card format, tag), adding to Wisdom, never posting without Roy's say-so.
- [ ] Synthesis: script run by systemd timer (weekly) invoking runTurn: read Q&As added since last marker, update roys-wisdom.html with unique insights only, commit; marker in /var/lib/roychat.
- [ ] nginx: location /api/ask → service with its own limit_req zone.
- [ ] All voice rules hold (no em dashes, no invented biography, no Kurt). `make check` green.
