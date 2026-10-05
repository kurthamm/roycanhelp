#!/usr/bin/env python3
"""Report how many content pages carry the signals AI answer engines use to pick sources:
 - a short-answer lead ("In short:" or a first paragraph) near the top,
 - a link to a primary government source (.gov),
 - a visible date ("Last checked" or "Last updated"),
 - structured data (JSON-LD).
Read-only. Prints a markdown block (used by seo_weekly.py)."""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {'admin.html', 'contact.html', 'terms.html', 'privacy.html', 'disclaimer.html', 'accessibility.html', 'search.html', '404.html', 'index.html', 'explainers.html'}
rows = []
for name in sorted(os.listdir(os.path.join(ROOT, 'site'))):
    if not name.endswith('.html') or name in SKIP: continue
    t = open(os.path.join(ROOT, 'site', name)).read()
    m = re.search(r'<main[\s\S]*?</main>', t); main = m.group(0) if m else ''
    rows.append((name, 'in-short' in main, bool(re.search(r'href="https?://[^"]*\.gov[/"]', main)), bool(re.search(r'Last (checked|updated)', main)), 'application/ld+json' in t))
n = len(rows)
def cnt(i): return sum(1 for r in rows if r[i])
print('## AI-search signals (content pages)')
print(f'- Short-answer lead: {cnt(1)} of {n}')
print(f'- Link to a .gov source: {cnt(2)} of {n}')
print(f'- Visible "Last checked/updated" date: {cnt(3)} of {n}')
print(f'- Structured data: {cnt(4)} of {n}')
missing = [r[0] for r in rows if not r[1]]
print('- Without a short-answer lead: ' + (', '.join(missing) if missing else 'none'))
