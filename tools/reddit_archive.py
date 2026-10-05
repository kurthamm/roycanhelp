#!/usr/bin/env python3
"""Collect public Reddit posts and top comments about South Carolina disability topics from the Arctic Shift research archive
(https://arctic-shift.photon-reddit.com). Reddit itself blocks this server.

Privacy and etiquette: no usernames or author fields are stored; raw text stays in content/research/raw/ (gitignored) and is
only used to find recurring themes, never republished; requests are slow (one every few seconds) with backoff.

    python3 tools/reddit_archive.py            # run all queries, then fetch comments for the busiest posts
"""
import json, os, sys, time, urllib.parse, urllib.request, urllib.error
BASE = 'https://arctic-shift.photon-reddit.com/api'
UA = 'roycanhelp-research/1.0 (nonprofit parent resource; light use)'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'content/research/raw')
os.makedirs(OUT, exist_ok=True)
AFTER = '2021-01-01'
SC_SUBS = ['SouthCarolina', 'columbiasc', 'Charleston', 'greenville', 'Clemson', 'myrtlebeach']
GEN_SUBS = ['specialed', 'Autism_Parents', 'autism', 'medicaid', 'SSDI', 'disability', 'Parenting', 'ABA', 'SpecialNeedsParents', 'IEP']
SC_TERMS = ['DDSN', 'BabyNet', 'IEP', 'autism', 'ABA', 'Medicaid', 'waiver', 'waitlist', 'SSI', 'special needs', 'guardianship', 'Ryan', 'respite', 'disability', 'early intervention', 'diagnosis', 'school district', 'insurance']
GEN_TERMS = ['South Carolina', 'SC DDSN', 'BabyNet']
def get(path, params, tries=5):
    url = f'{BASE}/{path}?' + urllib.parse.urlencode(params)
    for a in range(tries):
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=80))
            if d.get('error'):
                time.sleep(8 * (a + 1)); continue
            return d.get('data') or []
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            time.sleep(8 * (a + 1))
    return None
def clean_post(p):
    return {'id': p.get('id'), 'subreddit': p.get('subreddit'), 'title': p.get('title'), 'text': (p.get('selftext') or '')[:2500], 'score': p.get('score'), 'comments': p.get('num_comments'), 'created': p.get('created_utc'), 'url': 'https://www.reddit.com' + (p.get('permalink') or '')}
posts = {}
jobs = [(s, 'title', t) for s in SC_SUBS for t in SC_TERMS] + [(s, 'selftext', t) for s in GEN_SUBS for t in GEN_TERMS] + [(s, 'title', t) for s in GEN_SUBS for t in GEN_TERMS]
for i, (sub, field, term) in enumerate(jobs):
    r = get('posts/search', {'subreddit': sub, field: term, 'after': AFTER, 'limit': 100, 'sort': 'desc'})
    n0 = len(posts)
    for p in (r or []):
        posts.setdefault(p['id'], clean_post(p))
    print(f'[{i+1}/{len(jobs)}] r/{sub} {field}~{term}: {"FAILED" if r is None else len(r)} (total {len(posts)})', flush=True)
    time.sleep(3)
json.dump(list(posts.values()), open(os.path.join(OUT, 'posts.json'), 'w'))
busy = sorted((p for p in posts.values() if (p['comments'] or 0) >= 6), key=lambda p: -(p['comments'] or 0))[:80]
comments = {}
for j, p in enumerate(busy):
    r = get('comments/search', {'link_id': p['id'], 'limit': 100})
    comments[p['id']] = [{'text': (c.get('body') or '')[:900], 'score': c.get('score')} for c in (r or []) if (c.get('body') or '') not in ('[deleted]', '[removed]')]
    print(f'comments {j+1}/{len(busy)} {p["id"]}: {len(comments[p["id"]])}', flush=True)
    time.sleep(3)
json.dump(comments, open(os.path.join(OUT, 'comments.json'), 'w'))
print('done: posts', len(posts), 'threads with comments', len(comments))
