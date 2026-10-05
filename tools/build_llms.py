#!/usr/bin/env python3
"""Write site/llms.txt: a plain list of the site's pages with one-line descriptions, for AI answer engines."""
import html, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGIN = 'https://roycanhelp.org'
xml = open(os.path.join(ROOT, 'site/sitemap.xml')).read()
urls = re.findall(r'<loc>([^<]+)</loc>', xml)
lines = ['# Roy Can Help', '',
         '> A field guide for parents of children with disabilities, written from one dad\'s experience in South Carolina. The federal rules apply anywhere. On the Fine Print and letters pages every quoted rule is checked word for word against the federal text. Not legal or medical advice.', '', '## Pages', '']
for u in urls:
    name = u.replace(ORIGIN, '').strip('/') or 'index.html'
    path = os.path.join(ROOT, 'site', name)
    if not os.path.isfile(path): raise SystemExit(f'llms: sitemap lists {u} but {path} is missing')
    t = open(path).read()
    title = html.unescape(re.search(r'<title>(.*?)</title>', t, re.S).group(1)).replace(' | Roy Can Help', '').strip()
    desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)"', t).group(1)).strip()
    lines.append(f'- [{title}]({u}): {desc}')
open(os.path.join(ROOT, 'site/llms.txt'), 'w').write('\n'.join(lines) + '\n')
print(f'llms.txt: {len(urls)} pages')
