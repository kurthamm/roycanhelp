import { appendFileSync, readFileSync, existsSync } from 'node:fs';

/**
 * Log a usage record to a JSONL file.
 * Each record is appended as a single JSON line.
 *
 * @param {string} file - Path to the JSONL file
 * @param {object} record - Record with { ts, sessionId, input_tokens, output_tokens }
 */
export function logUsage(file, record) {
  appendFileSync(file, JSON.stringify(record) + '\n');
}

/**
 * Read all usage records from a JSONL file.
 *
 * A missing file is a legitimate empty state, not an error condition.
 * This allows the system to start fresh without requiring file pre-creation.
 *
 * @param {string} file - Path to the JSONL file
 * @returns {object[]} Array of usage records, or empty array if file doesn't exist
 */
export function readUsage(file) {
  if (!existsSync(file)) {
    return [];
  }

  const content = readFileSync(file, 'utf8');
  if (!content.trim()) {
    return [];
  }

  return content
    .trim()
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}
