#!/usr/bin/env python3
"""Build site/data/states.json from the researched, link-verified files in content/states/<CODE>.json.

New data (verified by hand against official sites): part_b (the state's Procedural Safeguards Notice, the written
statement of parent rights in special education), part_c (early intervention rights), parent_center (the state's
federally funded Parent Training and Information Center).
Older data (site/data/states.json from the first version) is kept only for Medicaid and developmental disabilities
links, and only where the link answered when re-checked (content/states/_old-link-check.json lists the ones that
did not) and does not duplicate another link for the same state.
"""
import glob, json, os, sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
OLD = {s['code']: s for s in json.load(open('site/data/states.json'))} if os.path.exists('site/data/states.json') else {}
BAD = set()
if os.path.exists('content/states/_old-link-check.json'):
    for j, status, _ in json.load(open('content/states/_old-link-check.json')):
        BAD.add((j[0], j[1]))

UNVER = {tuple(x) for x in json.load(open('content/states/_unverified.json'))} if os.path.exists('content/states/_unverified.json') else set()

def link(x, code=None, key=None):
    if (code, key) in UNVER: return None
    if not x: return None
    url = x.get('url')
    if not x.get('name'): return None  # an unnamed entry is a landing page the researcher could not tie to a rights document
    if not url or not url.startswith('https://'): return None
    return {'name': x['name'].strip(), 'url': url}

def main():
    out, problems = [], []
    files = sorted(glob.glob('content/states/[A-Z][A-Z].json'))
    for f in files:
        s = json.load(open(f))
        code = s['code']
        rec = {'code': code, 'name': s['name'],
               'rights_school': link(s.get('part_b'), code, 'part_b'), 'rights_ei': link(s.get('part_c'), code, 'part_c'),
               'parent_center': link(s.get('parent_center'), code, 'parent_center'),
               'note': s.get('note', '')}
        old = OLD.get(code, {})
        used = {v['url'] for v in (rec['rights_school'], rec['rights_ei'], rec['parent_center']) if v}
        for key in ('medicaid', 'dd_agency'):
            o = old.get(key)
            if o and (code, key) not in BAD and o['url'].startswith('https://') and o['url'] not in used:
                rec[key] = {'name': o['name'], 'url': o['url']}
                used.add(o['url'])
        out.append(rec)
    out.sort(key=lambda r: r['name'])
    codes = {r['code'] for r in out}
    if len(out) != 51: problems.append(f"expected 51 jurisdictions, found {len(out)}; missing {sorted(set(OLD) - codes)}")
    json.dump({'checked': date.today().strftime('%B %Y'), 'states': out}, open('site/data/states.json', 'w'), indent=1, ensure_ascii=False)
    print(f"{len(out)} states written; problems: {len(problems)}")
    for p in problems: print('  -', p)
    return 1 if any('expected 51' in p for p in problems) else 0

if __name__ == '__main__':
    sys.exit(main())
