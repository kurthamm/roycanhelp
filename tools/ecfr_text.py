#!/usr/bin/env python3
"""Print the plain text of eCFR sections: ecfr_text.py 34 300.502 300.518 ..."""
import re, sys, html, urllib.request
title = sys.argv[1]
for sec in sys.argv[2:]:
    u = f'https://www.ecfr.gov/api/renderer/v1/content/enhanced/current/title-{title}?part={sec.split(".")[0]}&section={sec}'
    t = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30).read().decode()
    t = html.unescape(re.sub(r'<[^>]+>', ' ', t)); t = re.sub(r'\s+', ' ', t)
    print('=====', sec); print(t[:3500]); print()
