#!/usr/bin/env python3
"""For entries with no CFR cite: fetch source_url (curl, then headless chromium) and confirm the quote is on the page."""
import glob, json, re, subprocess, sys, html
from concurrent.futures import ThreadPoolExecutor
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
def norm(t): return re.sub(r'[^a-z0-9]+', ' ', html.unescape(re.sub(r'<(script|style)[\s\S]*?</\1>|<[^>]+>', ' ', t)).lower()).strip()
cache = {}
def page(u):
    if u in cache: return cache[u]
    t = subprocess.run(['curl', '-sL', '-A', UA, '--max-time', '30', u], capture_output=True, text=True).stdout
    if len(norm(t)) < 300:
        t = subprocess.run(['/snap/bin/chromium', '--headless=new', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=8000', '--dump-dom', u], capture_output=True, text=True, timeout=60).stdout
    cache[u] = norm(t); return cache[u]
jobs = []
for f in sorted(glob.glob('content/questions/*.json')):
    for i, q in enumerate(json.load(open(f))):
        if not re.search(r'CFR', q.get('cite', '')) and q.get('quote') and q.get('source_url'): jobs.append((f, i, q))
def run(j):
    f, i, q = j
    try: txt = page(q['source_url'])
    except Exception: txt = ''
    parts = [p for p in re.split(r'\.\.\.|…', q['quote']) if len(norm(p)) > 20] or [q['quote']]
    return f, i, ('OK' if txt and all(norm(p) in txt for p in parts) else ('NOFETCH' if not txt else 'MISMATCH'))
with ThreadPoolExecutor(6) as ex: res = list(ex.map(run, jobs))
from collections import Counter
print(Counter((r[0].split('/')[-1], r[2]) for r in res))
json.dump(res, open('/tmp/web-quote-check.json', 'w'))
