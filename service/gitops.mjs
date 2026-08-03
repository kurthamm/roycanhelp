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
