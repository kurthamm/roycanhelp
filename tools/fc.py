#!/usr/bin/env python3
"""Tiny Firecrawl helper: python3 tools/fc.py search "query" [n]   |   python3 tools/fc.py scrape URL [outfile]
Key: ~/.config/firecrawl/key. Prints results; scrape writes markdown to outfile (default /tmp/fc-last.md)."""
import json, os, sys, time, urllib.request, urllib.error
KEY = open(os.path.expanduser('~/.config/firecrawl/key')).read().strip()
def call(path, body, t=150):
    req = urllib.request.Request('https://api.firecrawl.dev/v1/' + path, data=json.dumps(body).encode(), headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    for a in range(4):
        try: return json.load(urllib.request.urlopen(req, timeout=t))
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500: time.sleep(12 * (a + 1)); continue
            return {'http_error': e.code}
        except Exception: time.sleep(6)
    return {}
if __name__ == '__main__':
    if sys.argv[1] == 'search':
        r = call('search', {'query': sys.argv[2], 'limit': int(sys.argv[3]) if len(sys.argv) > 3 else 8})
        for x in r.get('data') or []: print(x['url'][:120], '|', (x.get('title') or '')[:80], '|', (x.get('description') or '')[:150].replace('\n', ' '))
    else:
        r = call('scrape', {'url': sys.argv[2], 'formats': ['markdown'], 'timeout': 90000})
        d = r.get('data') or {}; md = d.get('markdown') or ''
        out = sys.argv[3] if len(sys.argv) > 3 else '/tmp/fc-last.md'; open(out, 'w').write(md)
        print('status', (d.get('metadata') or {}).get('statusCode'), 'chars', len(md), '->', out)
