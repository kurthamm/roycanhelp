#!/usr/bin/env python3
"""Build explainer pages and the Explainers hub from content/explainers/*.json.

Each spec is a source file kept outside the public site. Output goes to site/<slug>.html.
Spec fields: slug, title (<=65 incl. suffix handled here), description (70-160), h1, intro,
group (School | Money | Health | Adulthood | Tools), summary (one line for the hub),
sections [{h2, html}], see_also [slugs], checked (one sentence naming what was verified), sources [urls].
Run:  python3 tools/build_explainers.py   (then node tools/structured-data.mjs site; node tools/seo.mjs sitemap site)
"""
import glob, json, os, re, sys, html
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
SUFFIX = ' | Roy Can Help'
CHECKED_MONTH = date.today().strftime('%B %Y')

# pages that already exist and belong in the hub
STATIC = [
    {'slug': 'fight-plan', 'group': 'Tools', 'label': 'How to Disagree', 'summary': 'What to do when the school, Early Intervention or Medicaid says no: the steps and the deadlines.'},
    {'slug': 'checklists', 'group': 'Tools', 'label': 'Printable Checklists', 'summary': 'Steps from these pages, ready to print and check off.'},
]
GROUPS = ['Start Here', 'Early Years', 'School', 'Money', 'Health', 'Adulthood', 'Tools']
LABELS = {  # short names used in "See also" lines
    'diagnosis': 'The Diagnosis', 'early-intervention': 'Birth to Three', 'school-ieps': 'School Years', 'turning-18': 'Ages 14 to 26',
    'qualify': 'Do You Qualify?', 'paying-for-care': 'Paying for It', 'protecting-benefits': 'Protecting the Money', 'therapies': 'Therapies',
    'glossary': 'Glossary', 'be-in-charge': 'Be in Charge', 'iep-meeting-decoded': 'The IEP Meeting, Decoded', 'ssi-deeming': 'SSI Deeming', 'tefra-katie-beckett': 'TEFRA / Katie Beckett', 'states': 'Your State', 'fight-plan': 'How to Disagree', 'checklists': 'Printable Checklists', 'explainers': 'All Explainers',
}

def esc_attr(s): return html.escape(s, quote=True)

def load_specs():
    specs = []
    for f in sorted(glob.glob('content/explainers/*.json')):
        s = json.load(open(f))
        problems = []
        title = s['title'] + SUFFIX
        if len(title.replace("'", '&#39;')) > 65: problems.append(f"title too long ({len(title)}): {title}")
        if not 70 <= len(s['description']) <= 160: problems.append(f"description length {len(s['description'])}")
        if '—' in json.dumps(s, ensure_ascii=False): problems.append('em dash')
        if not s.get('sections'): problems.append('no sections')
        if problems: sys.exit(f"{f}: " + '; '.join(problems))
        s['_file'] = f
        specs.append(s)
    return specs

def template():
    t = open('site/contact.html').read()
    t = re.sub(r'\s*<!-- structured-data:start -->[\s\S]*?<!-- structured-data:end -->\n?', '\n', t)
    return t.replace(' aria-current="page"', '')

def page(tpl, slug, title, desc, main):
    s = tpl
    t = esc_attr(title)
    s = re.sub(r'<title>[^<]*</title>', f'<title>{html.escape(title, quote=False).replace(chr(39), "&#39;")}</title>', s, 1)
    s = re.sub(r'(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*"', lambda m: m.group(1) + esc_attr(desc) + '"', s)
    s = re.sub(r'(<meta property="og:title" content=")[^"]*"', lambda m: m.group(1) + t + '"', s, 1)
    s = re.sub(r'(<meta name="twitter:title" content=")[^"]*"', lambda m: m.group(1) + esc_attr(title.replace(SUFFIX, '')) + '"', s, 1)
    s = s.replace('contact.html', f'{slug}.html')
    s = s.replace(f'href="{slug}.html">Contact', 'href="contact.html">Contact')  # nav and footer Contact links must keep pointing at the contact page
    return re.sub(r'<main[\s\S]*?</main>', lambda m: main, s, 1)

def explainer_main(sp):
    if not sp.get('short_answer'): raise SystemExit(f"{sp['slug']}: short_answer is required (the answer in one or two sentences, for readers and AI search)")
    secs = '\n'.join(f'      <section>\n        <h2>{x["h2"]}</h2>\n{x["html"]}\n      </section>' for x in sp['sections'])
    also = ', '.join(f'<a href="{s}.html">{LABELS.get(s, s)}</a>' for s in sp.get('see_also', []) + ['explainers'])
    srcs = ''
    if sp.get('sources'):
        srcs = '        <p class="sources"><strong>Sources:</strong> ' + ', '.join(f'<a href="{u}">{html.escape(re.sub(r"^https?://(www\\.)?", "", u).split("/")[0])}</a>' for u in sp['sources']) + '.</p>\n'
    return f'''<main id="main" tabindex="-1">
    <article>
      <h1>{sp["h1"]}</h1>
      <section class="hero">
        <p class="in-short"><strong>In short:</strong> {sp["short_answer"]}</p>
        <p>{sp["intro"]}</p>
      </section>
{secs}
      <section class="page-end">
        <p class="see-also"><strong>See also:</strong> {also}.</p>
{srcs}        <p class="last-checked">Last checked: {CHECKED_MONTH}. {sp["checked"]} This is not legal advice; see the <a href="disclaimer.html">full disclaimer</a>.</p>
      </section>
    </article>
  </main>'''

def hub_main(specs):
    items = {g: [] for g in GROUPS}
    for sp in specs: items[sp['group']].append((sp['slug'], sp['h1'] if len(sp['h1']) < 70 else sp['title'], sp['summary']))
    for st in STATIC: items[st['group']].append((st['slug'], st['label'], st['summary']))
    out = []
    for g in GROUPS:
        if not items[g]: continue
        lis = '\n'.join(f'          <li><a href="{s}.html"><strong>{html.escape(l, quote=False)}</strong><span>{html.escape(sm, quote=False)}</span></a></li>' for s, l, sm in sorted(items[g], key=lambda x: x[1].lower()))
        out.append(f'      <section class="explainer-group">\n        <h2>{g}</h2>\n        <ul class="help-grid">\n{lis}\n        </ul>\n      </section>')
    return f'''<main id="main" tabindex="-1">
    <article>
      <h1>Explainers and Tools</h1>
      <section class="hero">
        <p>The hard stuff, explained in plain English with the rules cited, plus tools you can print. Each one is checked against official sources and dated at the bottom.</p>
      </section>
{chr(10).join(out)}
    </article>
  </main>'''

def fix_nav(slugs_current):
    entry = '<li><a href="explainers.html">Explainers</a></li>'
    pat_old = re.compile(r'<li><a href="checklists.html"[^>]*>Checklists</a></li>\s*<li><a href="fight-plan.html"[^>]*>How to Fight a No</a></li>')
    for f in glob.glob('site/*.html'):
        t = open(f).read(); n = t
        n = pat_old.sub(entry, n)
        n = re.sub(r'<li><a href="explainers.html"[^>]*>Explainers</a></li>', entry, n)  # normalise
        if 'explainers.html">Explainers' not in n:
            n = re.sub(r'(<li><a href="glossary.html"[^>]*>Glossary</a></li>)', r'\1\n        ' + entry, n, 1)
        slug = os.path.basename(f)[:-5]
        if slug in slugs_current:
            n = n.replace(entry, '<li><a href="explainers.html" aria-current="page">Explainers</a></li>', 1)
        if n != t: open(f, 'w').write(n)

# ---- home page: link every explainer directly (helps search engines find and crawl them) ----
def update_home(specs):
    p = 'site/index.html'
    t = open(p).read()
    items = ''.join(f'\n          <li><a href="{sp["slug"]}.html"><strong>{sp["h1"] if len(sp["h1"]) < 70 else sp["title"]}</strong><span>{sp["summary"]}</span></a></li>' for sp in sorted(specs, key=lambda x: (GROUPS.index(x["group"]), x["title"])))
    block = ('<!-- home-explainers:start -->\n      <section class="help">\n        <h2>The fine print, one rule at a time</h2>\n'
             '        <p>Short pages with the exact rule, the sentence that proves it, and what to say. South Carolina has its own set.</p>\n'
             f'        <ul class="help-grid">{items}\n        </ul>\n      </section>\n      <!-- home-explainers:end -->')
    if 'home-explainers:start' in t:
        t = re.sub(r'<!-- home-explainers:start -->[\s\S]*?<!-- home-explainers:end -->', lambda m: block, t, 1)
    else:
        anchor = '      <section class="margin-gag">'
        assert anchor in t, 'home page anchor not found'
        t = t.replace(anchor, block + '\n\n' + anchor, 1)
    open(p, 'w').write(t)

def main():
    specs = load_specs(); tpl = template()
    for sp in specs:
        open(f'site/{sp["slug"]}.html', 'w').write(page(tpl, sp['slug'], sp['title'] + SUFFIX, sp['description'], explainer_main(sp)))
    open('site/explainers.html', 'w').write(page(tpl, 'explainers', 'Explainers and Tools for Parents' + SUFFIX, 'The hard parts of special education, benefits and Medicaid explained in plain English with the rules cited, plus printable tools.', hub_main(specs)))
    fix_nav({sp['slug'] for sp in specs} | {'explainers', 'fight-plan', 'checklists'})
    update_home(specs)
    print(f'built {len(specs)} explainer(s) + hub')

if __name__ == '__main__':
    main()

import subprocess as _sp
_sp.run(['python3', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build_llms.py')], check=True)
