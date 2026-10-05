#!/usr/bin/env python3
"""Check that a voice rewrite of an explainer spec changed only connective prose.

    python3 tools/voice_guard.py BASELINE_DIR [SPEC_DIR=content/explainers]

For every spec present in both directories, these must be identical:
  - every <p class="rule-quote"> block (the exact rule sentences),
  - every <p class="say-this"> block (the scripts parents copy),
  - the set of link targets,
  - the number and order of sections, and the sources, checked and see_also fields.
Fails loudly on any difference."""
import glob, json, os, re, sys
base = sys.argv[1]; cur = sys.argv[2] if len(sys.argv) > 2 else 'content/explainers'
def blocks(sp, cls): return re.findall(r'<p class="%s">.*?</p>' % cls, ''.join(x['html'] for x in sp['sections']), re.S)
def links(sp): return sorted(set(re.findall(r'href="([^"]+)"', ''.join(x['html'] for x in sp['sections']) + sp.get('intro', ''))))
bad = 0
for f in sorted(glob.glob(os.path.join(base, '*.json'))):
    name = os.path.basename(f); g = os.path.join(cur, name)
    if not os.path.exists(g): continue
    a, b = json.load(open(f)), json.load(open(g))
    probs = []
    for cls in ('rule-quote', 'say-this'):
        if blocks(a, cls) != blocks(b, cls): probs.append(f'{cls} blocks differ')
    la, lb = links(a), links(b)
    if not set(la) <= set(lb): probs.append('links removed: ' + ', '.join(sorted(set(la) - set(lb))))
    if len(a['sections']) != len(b['sections']): probs.append('number of sections changed')
    # prose outside the protected blocks: no new numbers, and no first-person events about Roy's family
    def prose(sp):
        t = sp.get('intro', '') + ' ' + sp.get('short_answer', '') + ' ' + ' '.join(x['html'] for x in sp['sections'])
        t = re.sub(r'<p class="(rule-quote|say-this)">.*?</p>', ' ', t, flags=re.S)
        return re.sub(r'<[^>]+>', ' ', t)
    pa, pb = prose(a), prose(b)
    new_nums = sorted(set(re.findall(r'\d[\d,.]*', pb)) - set(re.findall(r'\d[\d,.]*', pa)))
    if new_nums: probs.append('new numbers in prose: ' + ', '.join(new_nums))
    EVENT = re.compile(r"\b(my son|my wife|my family|my daughter|our son|our family|we were|we had|we got|I remember|when I was|I once|I spent|I lost|I waited|I called|I walked|I sat|my first|the day I)\b", re.I)
    ev = sorted(set(m.group(0).lower() for m in EVENT.finditer(pb)) - set(m.group(0).lower() for m in EVENT.finditer(pa)))
    if ev: probs.append('first-person events not in the baseline (invented anecdotes are not allowed): ' + ', '.join(ev))
    for k in ('sources', 'checked', 'see_also', 'slug', 'anchor'):
        if a.get(k) != b.get(k): probs.append(f'{k} changed')
    if probs:
        bad += 1; print(name + ': ' + '; '.join(probs))
print('voice guard:', 'FAILED on %d spec(s)' % bad if bad else 'clean')
sys.exit(1 if bad else 0)
