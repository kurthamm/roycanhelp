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
      // Allow /admin/ as a special case (chat service mount point, served by nginx, not a file)
      if (ref === '/admin/') continue;
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
