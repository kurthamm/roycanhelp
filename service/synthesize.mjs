import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import { runTurn } from './agent.mjs';
import { commitAll } from './gitops.mjs';

const run = promisify(execFile);

export async function hasNewQuestions(repoDir, markerHash) {
  try {
    const range = markerHash ? `${markerHash}..HEAD` : 'HEAD';
    const { stdout } = await run('git', ['log', range, '--oneline', '--', 'site/ask-roy.html'], { cwd: repoDir });
    return stdout.trim().length > 0;
  } catch (err) {
    if (err.code === 128 && err.message.includes('bad revision')) {
      // Marker hash invalid or doesn't exist, treat as first run
      return true;
    }
    throw err;
  }
}

async function getCurrentHead(repoDir) {
  const { stdout } = await run('git', ['rev-parse', 'HEAD'], { cwd: repoDir });
  return stdout.trim();
}

async function main() {
  const env = process.env;
  const required = ['SITE_DIR', 'SITE_REPO_DIR', 'ANTHROPIC_API_KEY', 'SYNTH_MARKER'];
  const missing = required.filter(k => !env[k]);
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const siteDir = env.SITE_DIR;
  const repoDir = env.SITE_REPO_DIR;
  const markerPath = env.SYNTH_MARKER;

  let markerHash = null;
  try {
    markerHash = readFileSync(markerPath, 'utf8').trim();
  } catch {
    // First run: marker file doesn't exist yet
  }

  const hasNew = await hasNewQuestions(repoDir, markerHash);
  if (!hasNew) {
    console.log('nothing new');
    return;
  }

  // New Q&As detected. Synthesize wisdom.
  const synthesisPrompt = `Read the files site/ask-roy.html and site/roys-wisdom.html. Identify any Q&As recently added to ask-roy.html that contain genuinely unique insight not yet present in roys-wisdom.html. Update roys-wisdom.html with only those distillations in Roy's voice (no em dashes, no duplication, follow existing formatting). Be selective: only add wisdom that's distinct from what's already there. Do not invent new Q&As; distill only from what's in ask-roy.html.`;

  await runTurn({
    message: synthesisPrompt,
    sessionId: null,
    siteDir,
    onText: (delta) => process.stdout.write(delta),
  });

  const newHead = await getCurrentHead(repoDir);
  const commitHash = await commitAll(repoDir, 'Roy: weekly wisdom synthesis');

  if (commitHash) {
    writeFileSync(markerPath, newHead);
  } else {
    console.error('Synthesis completed but no changes were made');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
  });
}
