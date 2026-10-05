#!/usr/bin/env python3
"""Check each item in content/sc/*.json: fetch source_url (curl, then headless Chromium) and confirm the quote is on the page."""
import glob, json, re, subprocess, sys, html
from concurrent.futures import ThreadPoolExecutor
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
def norm(t): return re.sub(r'[^a-z0-9]+', ' ', html.unescape(re.sub(r'<(script|style)[\s\S]*?</\1>|<[^>]+>', ' ', t)).lower()).strip()
cache = {}
def page(u):
    if u in cache: return cache[u]
    raw = subprocess.run(['curl', '-sL', '-A', UA, '--max-time', '60', u], capture_output=True).stdout
    if raw[:4] == b'%PDF':
        open('/tmp/_scq.pdf', 'wb').write(raw)
        t = subprocess.run(['pdftotext', '/tmp/_scq.pdf', '-'], capture_output=True).stdout.decode('utf-8', 'ignore')
    else:
        t = raw.decode('utf-8', 'ignore')
        if len(norm(t)) < 300:
            try: t = subprocess.run(['/snap/bin/chromium', '--headless=new', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=8000', '--dump-dom', u], capture_output=True, timeout=60).stdout.decode('utf-8', 'ignore')
            except subprocess.TimeoutExpired: t = ''
    cache[u] = norm(t); return cache[u]
jobs = []
for f in sorted(glob.glob('content/sc/*.json')):
    for i, q in enumerate(json.load(open(f))):
        jobs.append((f, i, q))
def run(j):
    f, i, q = j
    txt = page(q['source_url']) if q.get('source_url') else ''
    quote = norm(q.get('quote', ''))
    return f.split('/')[-1], i, q.get('cite', '')[:40], ('NOFETCH' if not txt else ('OK' if quote and quote in txt else 'MISMATCH'))
with ThreadPoolExecutor(5) as ex: res = list(ex.map(run, jobs))
for r in res: print(*r)
json.dump(res, open('/tmp/sc-quote-check.json', 'w'))
