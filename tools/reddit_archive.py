#!/usr/bin/env python3
"""Collect public Reddit posts and comments about South Carolina disability topics from the PullPush research archive
(https://api.pullpush.io). Reddit itself blocks this server.

Privacy and etiquette: no usernames or author fields are stored; raw text stays in content/research/raw/ (gitignored) and is
only used to find recurring themes, never republished; requests are slow (one every two seconds) with backoff.
"""
import json, os, time, urllib.parse, urllib.request, urllib.error
BASE = 'https://api.pullpush.io/reddit/search'
UA = 'roycanhelp-research/1.0 (nonprofit parent resource; light use)'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'content/research/raw')
os.makedirs(OUT, exist_ok=True)
SC_SUBS = ['SouthCarolina', 'columbiasc', 'Charleston', 'greenville', 'Clemson', 'myrtlebeach']
GEN_SUBS = ['specialed', 'Autism_Parents', 'autism', 'medicaid', 'SSDI', 'disability', 'Parenting', 'ABA', 'IEP', 'SpecialNeedsParents', 'autismparenting']
SC_TERMS = ['DDSN', 'BabyNet', 'IEP', 'autism', 'ABA therapy', 'Medicaid waiver', 'waitlist', 'SSI', 'special needs', 'guardianship', 'disability', 'insurance autism', 'respite', 'Ryan\'s Law', 'early intervention', 'special education']
GEN_TERMS = ['South Carolina', 'SC DDSN', 'BabyNet', 'SCDHHS']
def get(kind, params, tries=6):
    url = f'{BASE}/{kind}/?' + urllib.parse.urlencode(params)
    for a in range(tries):
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60))
            if d.get('error'): raise RuntimeError(str(d['error'])[:60])
            return d.get('data') or []
        except Exception as e:
            print('  retry', str(e)[:60], flush=True); time.sleep(min(60, 8 * (a + 1)))
    return None
def post(p): return {'id': p.get('id'), 'subreddit': p.get('subreddit'), 'title': p.get('title'), 'text': (p.get('selftext') or '')[:2500], 'score': p.get('score'), 'comments': p.get('num_comments'), 'created': p.get('created_utc'), 'url': 'https://www.reddit.com' + (p.get('permalink') or '')}
def comment(c): return {'id': c.get('id'), 'link_id': c.get('link_id'), 'subreddit': c.get('subreddit'), 'text': (c.get('body') or '')[:1500], 'score': c.get('score'), 'created': c.get('created_utc'), 'url': 'https://www.reddit.com' + (c.get('permalink') or '')}
posts, comments = {}, {}
jobs = [(s, t) for s in SC_SUBS for t in SC_TERMS] + [(s, t) for s in GEN_SUBS for t in GEN_TERMS]
for i, (sub, term) in enumerate(jobs):
    r = get('submission', {'q': term, 'subreddit': sub, 'size': 100, 'sort': 'desc', 'sort_type': 'score'})
    for p in (r or []): posts.setdefault(p['id'], post(p))
    time.sleep(6)
    c = get('comment', {'q': term, 'subreddit': sub, 'size': 100, 'sort': 'desc', 'sort_type': 'score'})
    for x in (c or []):
        if (x.get('body') or '') not in ('[deleted]', '[removed]'): comments.setdefault(x['id'], comment(x))
    print(f'[{i+1}/{len(jobs)}] r/{sub} "{term}": posts {len(r) if r is not None else "FAILED"}, comments {len(c) if c is not None else "FAILED"} (totals {len(posts)}/{len(comments)})', flush=True)
    time.sleep(6)
    if i % 10 == 9:
        json.dump(list(posts.values()), open(os.path.join(OUT, 'posts.json'), 'w')); json.dump(list(comments.values()), open(os.path.join(OUT, 'comments.json'), 'w'))
json.dump(list(posts.values()), open(os.path.join(OUT, 'posts.json'), 'w'))
json.dump(list(comments.values()), open(os.path.join(OUT, 'comments.json'), 'w'))
print('done: posts', len(posts), 'comments', len(comments))
