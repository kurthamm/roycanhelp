import { query } from '@anthropic-ai/claude-agent-sdk';
import { ROY_SYSTEM_PROMPT } from './prompt.mjs';

const ALLOWED_TOOLS = [
  'Read', 'Edit', 'Write', 'Glob', 'Grep',
  'Bash(make:*)', 'Bash(git status:*)', 'Bash(git log:*)', 'Bash(git diff:*)', 'Bash(pandoc:*)',
];

/**
 * Run a single agent turn with Roy's voice.
 *
 * @param {object} options - Query options
 * @param {string} options.message - The user's message
 * @param {string} [options.sessionId] - Session ID to resume, or undefined for a new session
 * @param {string} options.siteDir - Working directory for the agent (site root)
 * @param {function} options.onText - Callback fired for each text chunk from the assistant
 * @returns {Promise<{sessionId: string, usage: {input_tokens: number, output_tokens: number}, summary: string}>}
 */
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

  let usage = null;
  let summary = '';
  let sid = sessionId ?? null;

  for await (const msg of q) {
    if (msg.type === 'system' && msg.subtype === 'init') {
      sid = msg.session_id;
    }

    if (msg.type === 'assistant') {
      for (const block of msg.message.content) {
        if (block.type === 'text') {
          onText(block.text);
          summary = block.text;
        }
      }
    }

    if (msg.type === 'result') {
      usage = {
        input_tokens: msg.usage?.input_tokens,
        output_tokens: msg.usage?.output_tokens,
      };
    }
  }

  return { sessionId: sid, usage, summary };
}
