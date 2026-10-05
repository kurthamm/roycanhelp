import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
export const CHAT_AUTHOR = 'Roy via Chat <chat@roycanhelp.org>';

const git = (dir, ...args) => run('git', args, { cwd: dir });

// Parse CHAT_AUTHOR to extract expected author name and email
const match = CHAT_AUTHOR.match(/^(.+)\s<(.+)>$/);
const EXPECTED_AUTHOR = match[1];
const EXPECTED_EMAIL = match[2];

export async function commitAll(repoDir, message) {
  await git(repoDir, 'add', '-A');
  const { stdout: status } = await git(repoDir, 'status', '--porcelain');
  if (!status.trim()) return null;
  await git(repoDir, 'commit', '--author', CHAT_AUTHOR, '-m', message);
  // Push to GitHub so every change Roy makes lands in the repo, not just on this
  // server. A push failure (network, auth) must not lose the commit, which is
  // already safe locally, so it is reported and rethrown by the caller's logger.
  try {
    await git(repoDir, 'push', 'origin', 'HEAD:main');
  } catch (err) {
    console.error(`PUSH FAILED after commit: ${err.message}`);
  }
  return (await git(repoDir, 'rev-parse', 'HEAD')).stdout.trim();
}

export async function lastChange(repoDir) {
  const { stdout } = await git(repoDir, 'log', '-1', '--format=%H%x00%an%x00%ae%x00%s');
  const [hash, author, email, message] = stdout.trim().split('\0');
  return { hash, author, email, message };
}


// Undo the most recent editor change. Single level on purpose: undoing an undo would re-apply the change.
export async function undoLast(repoDir) {
  const last = await lastChange(repoDir);
  if (last.email !== EXPECTED_EMAIL) {
    throw new Error(`The most recent change was not made through the editor (${last.author}), so it will not be undone automatically.`);
  }
  if (/^Revert /.test(last.message)) {
    throw new Error('The most recent change is already an undo. Make a new change instead of undoing the undo.');
  }
  try {
    await git(repoDir, '-c', `user.name=${EXPECTED_AUTHOR}`, '-c', `user.email=${EXPECTED_EMAIL}`, 'revert', '--no-edit', 'HEAD');
  } catch (err) {
    // A failed revert leaves the repo mid-revert, which would break the next edit. Put it back, then report the real error.
    await git(repoDir, 'revert', '--abort').catch(() => {});
    throw err;
  }
  try {
    await git(repoDir, 'push', 'origin', 'HEAD:main');
  } catch (err) {
    console.error(`PUSH FAILED after undo: ${err.message}`);
  }
  return { undone: last.message };
}

// The most recent changes to the site, newest first, so Roy can see what changed and when.
export async function recentChanges(repoDir, limit = 20) {
  const { stdout } = await git(repoDir, 'log', `-${limit}`, '--format=%cI%x00%an%x00%s');
  return stdout.trim().split('\n').filter(Boolean).map(line => {
    const [when, who, what] = line.split('\0');
    return { when, who, what };
  });
}
