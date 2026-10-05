#!/usr/bin/env python3
"""Use Firecrawl search and scrape to propose verified links for the gaps in site/data/states.json.
Writes /tmp/state-gap-candidates.json for human review (nothing is applied automatically).
Key: ~/.config/firecrawl/key"""
import json, os, re, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
KEY = open(os.path.expanduser('~/.config/firecrawl/key')).read().strip()
def fc(path, body, t=150):
    req = urllib.request.Request('https://api.firecrawl.dev/v1/' + path, data=json.dumps(body).encode(), headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    for a in range(3):
        try: return json.load(urllib.request.urlopen(req, timeout=t))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503): time.sleep(10 * (a + 1)); continue
            return {'http_error': e.code}
        except Exception as e:
            time.sleep(5)
    return {'err': 'failed'}
states = json.load(open('site/data/states.json'))['states']
FIELDS = {'part_b': ('rights_school', '{n} Department of Education procedural safeguards notice parents special education', r'procedural safeguards|parent rights|parents.? rights', r'procedural safeguards'),
          'part_c': ('rights_ei', '{n} early intervention Part C family rights procedural safeguards', r'procedural safeguards|family rights|parent rights|parents.? rights', r'procedural safeguards|family rights|parent rights'),
          'parent_center': ('parent_center', '{n} Parent Training and Information Center PTI families disabilities', r'parent (training|center)|PTI|family (network|voices)|advocacy|support', r'parent|famil')}
BLOCK = re.compile(r'parentcenterhub|ed\.gov|wrightslaw|understood\.org|facebook|youtube|pinterest|linkedin|ectacenter|cpfamilynetwork|wikipedia|reddit|twitter', re.I)
def gov_ok(u): return bool(re.search(r'\.(gov|us)(/|$)|\.k12\.|\.edu(/|$)|state\.[a-z]{2}\.us|\.org(/|$)', u))
def candidates(st, field):
    sf, q, tm, vm = FIELDS[field]
    r = fc('search', {'query': q.format(n=st['name']), 'limit': 6})
    out = []
    for x in (r.get('data') or []):
        u = x.get('url', ''); t = (x.get('title') or '') + ' ' + (x.get('description') or '')
        if BLOCK.search(u) or not gov_ok(u) or not re.search(tm, t, re.I): continue
        if field != 'parent_center' and not re.search(r'\.gov|\.us|k12', u): continue
        if st['name'].lower() not in (t + u).lower() and st['code'].lower() not in u.lower(): continue
        out.append({'url': u, 'title': (x.get('title') or '')[:110]})
    for c in out[:2]:
        s = fc('scrape', {'url': c['url'], 'formats': ['markdown'], 'timeout': 60000})
        d = s.get('data') or {}; md = d.get('markdown') or ''; meta = d.get('metadata') or {}
        c['status'] = meta.get('statusCode'); c['chars'] = len(md); c['verified'] = bool(meta.get('statusCode') == 200 and len(md) > 400 and re.search(vm, md, re.I) and not re.search(r'page not found|404|access denied', meta.get('title') or '', re.I))
        c['page_title'] = (meta.get('title') or '')[:90]
        if c['verified']: return {'state': st['code'], 'field': field, 'best': c}
    return {'state': st['code'], 'field': field, 'best': None, 'seen': out[:2]}
jobs = [(st, f) for st in states for f, (sf, *_rest) in FIELDS.items() if not st.get(sf)]
print(len(jobs), 'gaps', flush=True)
with ThreadPoolExecutor(4) as ex: res = list(ex.map(lambda j: candidates(*j), jobs))
json.dump(res, open('/tmp/state-gap-candidates.json', 'w'), indent=1)
print('found', sum(1 for r in res if r['best']), 'of', len(res))
