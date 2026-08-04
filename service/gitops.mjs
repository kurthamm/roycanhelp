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

export async function undoLast(repoDir) {
  const last = await lastChange(repoDir);
  if (last.author !== EXPECTED_AUTHOR || last.email !== EXPECTED_EMAIL) throw new Error('last commit was not made by chat');
  if (last.message.startsWith('Revert ')) throw new Error('nothing to undo — the last change was already undone; ask in chat to restore older versions');
  await git(repoDir, 'revert', '--no-edit', 'HEAD');
  return last;
}
