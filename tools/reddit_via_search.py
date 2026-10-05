#!/usr/bin/env python3
"""Find public Reddit threads (titles and search snippets only) about South Carolina disability topics via Firecrawl search.
Output: content/research/raw/reddit-search.json (gitignored). No usernames. Used only to find recurring themes."""
import json, os, time, urllib.request, urllib.error
KEY = open(os.path.expanduser('~/.config/firecrawl/key')).read().strip()
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'content/research/raw'); os.makedirs(OUT, exist_ok=True)
def fc(body):
    req = urllib.request.Request('https://api.firecrawl.dev/v1/search', data=json.dumps(body).encode(), headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    for a in range(4):
        try: return json.load(urllib.request.urlopen(req, timeout=120))
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500: time.sleep(15 * (a + 1)); continue
            return {}
        except Exception: time.sleep(8)
    return {}
TOPICS = ['DDSN waiver waitlist autism', 'DDSN intake eligibility autism child', 'BabyNet early intervention delay wait', 'BabyNet transition to school age 3 IEP', 'IEP meeting advice school district', 'IEP denied evaluation school will not test', 'autism diagnosis wait list pediatric developmental', 'ABA therapy insurance denied', 'Ryan\'s Law autism insurance coverage', 'Medicaid autism ABA therapy coverage children', 'Medicaid renewal lost coverage disabled child', 'TEFRA Katie Beckett Medicaid child', 'SSI child application denied parent income', 'SSI turning 18 redetermination disability', 'guardianship adult child probate court alternatives', 'special needs trust ABLE account', 'private school autism no IEP scholarship', 'Education Scholarship Trust Fund special needs IEP', 'homeschool autism special education services', 'respite care provider shortage', 'speech therapy occupational therapy wait list', 'behavior school suspension autism restraint', 'special education diploma graduation certificate', 'transition services after high school age 21 adult day program', 'vocational rehabilitation autism employment', 'aging off insurance 26 disabled adult child', 'special education advocate help free', 'Family Connection of South Carolina Disability Rights', 'Richland School District autism special education', 'Lexington School District autism special education', 'Charleston County School District special education', 'Greenville County Schools special education autism']
SUBS = ['site:reddit.com South Carolina {t}', 'site:reddit.com SC {t}']
out = {}
for i, t in enumerate(TOPICS):
    for tmpl in SUBS:
        q = tmpl.format(t=t)
        r = fc({'query': q, 'limit': 10})
        for x in r.get('data') or []:
            u = x.get('url', '')
            if 'reddit.com' in u and u not in out:
                out[u] = {'url': u, 'title': x.get('title'), 'snippet': x.get('description'), 'topic': t}
        time.sleep(1.5)
    print(f'[{i+1}/{len(TOPICS)}] {t}: total threads {len(out)}', flush=True)
    json.dump(list(out.values()), open(os.path.join(OUT, 'reddit-search.json'), 'w'))
print('done', len(out))
