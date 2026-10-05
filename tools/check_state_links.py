#!/usr/bin/env python3
"""Fetch every URL in content/states/*.json and report which do not answer. Exits 1 if any fail."""
import glob, json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
jobs = []
for f in sorted(glob.glob('content/states/[A-Z][A-Z].json')):
    s = json.load(open(f))
    for k in ('part_b', 'part_c', 'parent_center'):
        x = s.get(k)
        if x and x.get('url'): jobs.append((s['code'], k, x['url']))
def probe(j):
    r = subprocess.run(['curl', '-sL', '-o', '/dev/null', '-A', UA, '--max-time', '25', '-w', '%{http_code}', j[2]], capture_output=True, text=True)
    return j, r.stdout.strip()
with ThreadPoolExecutor(12) as ex: res = list(ex.map(probe, jobs))
bad = [(j, c) for j, c in res if not c.startswith('2')]
json.dump([[list(j), c] for j, c in res], open('/tmp/state-link-results.json', 'w'))
for j, c in bad: print(c, *j)
print(len(res), 'urls,', len(bad), 'not 2xx')
sys.exit(1 if bad else 0)
