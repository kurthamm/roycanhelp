#!/usr/bin/env python3
"""Fetch every URL in content/states/*.json and write content/states/_unverified.json (links that do not load).

Step 1: curl with a browser user agent; any 2xx passes.
Step 2: for the rest, load in headless Chromium. A real page title passes. A bot-challenge page (Cloudflare, "Just a moment")
passes because a real browser gets through it. Connection errors, 404 / not found / access denied / error titles fail.
build_states.py drops everything listed in _unverified.json."""
import glob, json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
CHROMIUM = '/snap/bin/chromium'
BAD_TITLE = re.compile(r'404|not found|can.t find|apologies|can.t be found|cannot be found|access denied|forbidden|error|unavailable|privacy|invalid|could not be satisfied|no longer', re.I)
CHALLENGE = re.compile(r'just a moment|attention required|checking your browser|verify you are human', re.I)
FC_OK = {(a, b, c) for a, b, c in json.load(open('content/states/_firecrawl_ok.json'))} if os.path.exists('content/states/_firecrawl_ok.json') else set()  # confirmed by Firecrawl; bot-blocked for curl
jobs = []
for f in sorted(glob.glob('content/states/[A-Z][A-Z].json')):
    s = json.load(open(f))
    for k in ('part_b', 'part_c', 'parent_center'):
        x = s.get(k)
        if x and x.get('url') and x.get('name') and (s['code'], k, x['url']) not in FC_OK: jobs.append((s['code'], k, x['url']))
def curl_ok(u):
    r = subprocess.run(['curl', '-sL', '-o', '/dev/null', '-A', UA, '--max-time', '25', '-w', '%{http_code}', u], capture_output=True, text=True)
    return r.stdout.strip().startswith('2')
def browser_ok(u):
    try: d = subprocess.run([CHROMIUM, '--headless=new', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=8000', '--dump-dom', u], capture_output=True, text=True, timeout=45).stdout
    except subprocess.TimeoutExpired: return False, 'timeout'
    m = re.search(r'<title>(.*?)</title>', d, re.S); t = m.group(1).strip() if m else ''
    if CHALLENGE.search(t): return True, 'challenge:' + t
    host = re.sub(r'^https?://([^/]+).*', r'\1', u)
    if not d or 250000 < len(d) < 254000 and t.lower() in (host.lower(), ''): return False, 'connection error'
    if BAD_TITLE.search(t): return False, t[:60]
    return True, t[:60]
def probe(j):
    if curl_ok(j[2]): return j, True, 'curl'
    ok, why = browser_ok(j[2]); return j, ok, why
with ThreadPoolExecutor(6) as ex: res = list(ex.map(probe, jobs))
bad = sorted([j[0], j[1]] for j, ok, _ in res if not ok)
json.dump(bad, open('content/states/_unverified.json', 'w'))
for j, ok, why in res:
    if not ok: print('FAIL', *j, why)
print(len(res), 'urls checked,', len(bad), 'unverified')
