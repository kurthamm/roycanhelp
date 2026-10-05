import { execFileSync } from 'node:child_process';

// Roy's territory. Text that Roy's editor added is his: nobody else rewrites it.
// Text that Roy removed is gone: nobody puts it back. Both are read from git history, where every
// change Roy makes is a commit by "Roy via Chat".
export const ROY = 'Roy via Chat';
const MIN_CHARS = 30;

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

export const plain = html => html
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'")
  .replace(/\s+/g, ' ').trim().toLowerCase();

// Commits Roy made that still stand (a commit later reverted, such as a test, never counted).
export function royCommits(cwd) {
  const log = git(cwd, 'log', '--reverse', '--format=%H%x00%an%x00%s%x00%b%x01').split('\x01').map(s => s.trim()).filter(Boolean);
  const rows = log.map(r => { const [sha, author, subject, body] = r.split('\0'); return { sha, author, subject, body: body ?? '' }; });
  const reverted = new Set(rows.flatMap(r => [...r.body.matchAll(/This reverts commit ([0-9a-f]{40})/g)].map(m => m[1])));
  return rows.filter(r => r.author === ROY && !reverted.has(r.sha) && !/^Revert /.test(r.subject));
}

const changedLines = (cwd, sha) => {
  const out = git(cwd, 'show', '-U0', '--format=', sha, '--', 'site/*.html');
  const removed = [];
  const added = [];
  let file = null;
  for (const line of out.split('\n')) {
    const f = /^\+\+\+ b\/(.+)$/.exec(line);
    if (f) { file = f[1]; continue; }
    if (line.startsWith('---') || line.startsWith('+++') || !file) continue;
    if (line.startsWith('-')) removed.push({ file, text: plain(line.slice(1)) });
    else if (line.startsWith('+')) added.push({ file, text: plain(line.slice(1)) });
  }
  return { removed, added };
};

// Passages Roy removed: they must not appear on any page unless Roy himself later put them back.
export function removedByRoy(cwd) {
  const out = [];
  for (const c of royCommits(cwd)) {
    const { removed, added } = changedLines(cwd, c.sha);
    const addedText = new Set(added.map(a => a.text));
    for (const r of removed) {
      if (r.text.length >= MIN_CHARS && !addedText.has(r.text)) out.push({ ...r, sha: c.sha, subject: c.subject });
    }
  }
  return out;
}

const blameAuthors = (cwd, rev, file, lines) => {
  const out = git(cwd, 'blame', '--line-porcelain', '-L', `${lines[0]},${lines[1]}`, rev, '--', file);
  return [...out.matchAll(/^author (.*)$/gm)].map(m => m[1]);
};

export function checkRemovedStayRemoved(cwd, root = 'site') {
  const errors = [];
  const removed = removedByRoy(cwd);
  // Judge what is committed. Roy's live edits are uncommitted until his editor saves them, and they must never be blocked.
  const files = git(cwd, 'ls-tree', '--name-only', 'HEAD', `${root}/`).split('\n').filter(f => f.endsWith('.html'));
  for (const rel of files) {
    const lines = git(cwd, 'show', `HEAD:${rel}`).split('\n');
    lines.forEach((raw, i) => {
      const text = plain(raw);
      if (text.length < MIN_CHARS) return;
      for (const r of removed) {
        if (r.file === rel && text.includes(r.text)) {
          const [author] = blameAuthors(cwd, 'HEAD', rel, [i + 1, i + 1]);
          if (author !== ROY) errors.push(`${rel}:${i + 1}: Roy removed this on purpose (${r.subject}): "${r.text.slice(0, 90)}"`);
        }
      }
    });
  }
  return errors;
}

// For a change someone other than Roy proposes (base..HEAD): list any line of Roy's that it rewrites or deletes.
export function checkRoyTextUntouched(cwd, base) {
  const errors = [];
  const diff = git(cwd, 'diff', '-U0', `${base}`, 'HEAD', '--', 'site/*.html');
  let file = null;
  const hunks = [];
  for (const line of diff.split('\n')) {
    const f = /^--- a\/(.+)$/.exec(line);
    if (f) { file = f[1]; continue; }
    const h = /^@@ -(\d+)(?:,(\d+))? \+/.exec(line);
    if (h && file) { hunks.push({ file, start: Number(h[1]), count: h[2] === undefined ? 1 : Number(h[2]), added: '' }); continue; }
    if (line.startsWith('+') && !line.startsWith('+++') && hunks.length) hunks[hunks.length - 1].added += ' ' + plain(line.slice(1));
  }
  for (const { file, start, count, added } of hunks) {
    if (count === 0) continue; // pure addition: nothing of Roy's is touched
    const authors = blameAuthors(cwd, base, file, [start, start + count - 1]);
    const royLines = authors.map((a, i) => (a === ROY ? start + i : null)).filter(Boolean);
    if (royLines.length) {
      const text = git(cwd, 'show', `${base}:${file}`).split('\n');
      for (const n of royLines) {
        const t = plain(text[n - 1]);
        // Same words with different markup (a style attribute, a link anchor) is not a rewrite.
        if (t.length >= 12 && !added.includes(t)) errors.push(`${file}:${n}: this is Roy's text and this change rewrites or deletes it: "${t.slice(0, 100)}"`);
      }
    }
  }
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, base] = process.argv.slice(2);
  const cwd = process.cwd();
  let errs;
  if (cmd === 'check') errs = checkRemovedStayRemoved(cwd);
  else if (cmd === 'diff' && base) errs = checkRoyTextUntouched(cwd, base);
  else { console.error('usage: roy-guard.mjs check | diff <base-rev>'); process.exit(2); }
  errs.forEach(e => console.error(e));
  console.log(errs.length ? `${errs.length} problem(s)` : `roy-guard ${cmd}: clean`);
  process.exit(errs.length ? 1 : 0);
}
