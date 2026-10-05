import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Roy's standing decisions about wording on his site. Each one came from a request he made in his editor,
// so the check protects his choices from being undone by a later edit.
export const RULES = [
  { re: /\bkids?\b/gi, why: 'Roy: never use the word "kid" for a child' },
  { re: /\b(autistic|disabled|handicapped|retarded|special needs)\s+(child|children|person|people|kid|kids|adult|adults|son|daughter)\b/gi, why: 'Roy: use people-first language (a child with autism)' },
  { re: /inspiration porn/gi, why: 'Roy: do not use the word "porn"; he had this phrase removed' },
  { re: /—/g, why: 'Kurt: no em dashes' },
  { re: /\b(fuck\w*|shit\w*|bullshit|damn\w*|crap\w*|piss\w*|asshole|hell|bullocks|bastard\w*|bitch\w*|ass|asses)\b/gi, why: 'Roy: clean language for a family audience' },
  { re: /\b(stupid\w*|idiot\w*|moron\w*|dumb\w*)\b/gi, why: 'Roy: no bad words, including mild put-downs' },
  { re: /\babortion\w*|\bpro-?life\b|\bpro-?choice\b|\bterminat\w*\s+(a |the |your )?pregnan\w*|\bselective reduction\b|\bprenatal (testing|screening|diagnosis)\b/gi, why: 'Roy: nothing close to abortion on the site' },
];

const visibleText = html => html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');

export function voiceCheck(root) {
  const errors = [];
  for (const f of readdirSync(root).filter(f => f.endsWith('.html')).sort()) {
    const text = visibleText(readFileSync(join(root, f), 'utf8'));
    for (const { re, why } of RULES) {
      for (const m of text.matchAll(re)) {
        const at = Math.max(0, m.index - 30);
        errors.push(`${f}: "${text.slice(at, m.index + m[0].length + 30).replace(/\s+/g, ' ').trim()}" (${why})`);
      }
    }
  }
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errs = voiceCheck(process.argv[2] ?? 'site');
  errs.forEach(e => console.error(e));
  process.exit(errs.length ? 1 : 0);
}
