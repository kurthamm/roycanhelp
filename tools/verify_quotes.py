#!/usr/bin/env python3
"""For content/questions/*.json: confirm each 'quote' appears in the text of the cited eCFR section(s)."""
import glob, json, re, sys, urllib.request, html
from concurrent.futures import ThreadPoolExecutor
def norm(t): return re.sub(r'[^a-z0-9]+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', t)).lower()).strip()
cache = {}
def section(title, sec):
    part = sec.split('.')[0]
    k = (title, sec)
    if k not in cache:
        u = f'https://www.ecfr.gov/api/renderer/v1/content/enhanced/current/title-{title}?part={part}&section={sec}'
        try: cache[k] = norm(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30).read().decode())
        except Exception as e: cache[k] = ''
    return cache[k]
out = []
for f in sorted(glob.glob('content/questions/*.json')):
    for i, q in enumerate(json.load(open(f))):
        cites = re.findall(r'(\d+)\s*CFR\s*(?:Part\s*)?(\d+\.\d+)', q.get('cite', ''))
        if not cites: out.append((f, i, 'NOCFR', q['question'][:60])); continue
        quote = norm(q.get('quote', ''))
        if not quote: out.append((f, i, 'NOQUOTE', q['question'][:60])); continue
        # compare on first 60 normalized chars and last 40 so ellipses in quotes don't break it
        parts = [p for p in re.split(r'\s{2,}|\.\.\.|…', q['quote']) if len(norm(p)) > 25] or [q['quote']]
        ok = any(all(norm(p) in section(t, s) for p in parts) for t, s in cites)
        out.append((f, i, 'OK' if ok else 'MISMATCH', q['question'][:60]))
from collections import Counter
print(Counter((o[0].split('/')[-1], o[2]) for o in out))
json.dump(out, open('/tmp/quote-check.json', 'w'))
