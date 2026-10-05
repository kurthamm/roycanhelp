#!/usr/bin/env python3
"""Tell IndexNow engines (Bing and others on the protocol) about pages that changed.

    python3 tools/indexnow.py [--days N] [--all]

Default: URLs whose site/*.html files changed in the last N days (default 2) in git history of the repo it runs in.
--all submits every URL in sitemap.xml (use once after launch, not routinely).
The key is public by design: it is served at https://roycanhelp.org/<key>.txt and must match the file in site/.
Fails loudly on a missing key file or any non-2xx answer."""
import argparse, glob, json, os, re, subprocess, sys, urllib.request

ORIGIN = 'https://roycanhelp.org'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser(); ap.add_argument('--days', type=int, default=2); ap.add_argument('--all', action='store_true')
a = ap.parse_args()

keys = [os.path.basename(p)[:-4] for p in glob.glob(os.path.join(ROOT, 'site', '[0-9a-f]' * 32 + '.txt'))]
if len(keys) != 1: sys.exit(f'indexnow: expected exactly one key file in site/, found {len(keys)}')
key = keys[0]
if open(os.path.join(ROOT, 'site', key + '.txt')).read().strip() != key: sys.exit('indexnow: key file content does not match its name')

if a.all:
    urls = re.findall(r'<loc>(.*?)</loc>', open(os.path.join(ROOT, 'site', 'sitemap.xml')).read())
else:
    out = subprocess.run(['git', '-C', ROOT, 'log', f'--since={a.days} days ago', '--name-only', '--pretty=format:', '--', 'site/*.html'], capture_output=True, text=True, check=True).stdout
    names = sorted({l.strip()[len('site/'):] for l in out.splitlines() if l.strip().startswith('site/') and l.strip().endswith('.html')})
    names = [n for n in names if os.path.exists(os.path.join(ROOT, 'site', n)) and n not in ('admin.html', '404.html')]
    urls = [ORIGIN + '/' + ('' if n == 'index.html' else n) for n in names]
if not urls:
    print('indexnow: nothing changed, nothing to submit'); sys.exit(0)

payload = json.dumps({'host': 'roycanhelp.org', 'key': key, 'keyLocation': f'{ORIGIN}/{key}.txt', 'urlList': urls}).encode()
req = urllib.request.Request('https://api.indexnow.org/indexnow', data=payload, headers={'Content-Type': 'application/json; charset=utf-8'})
with urllib.request.urlopen(req, timeout=30) as r:
    if not 200 <= r.status < 300: sys.exit(f'indexnow: HTTP {r.status}')
    print(f'indexnow: submitted {len(urls)} urls (HTTP {r.status})')
