#!/usr/bin/env python3
"""Print the plain text of eCFR sections: ecfr_text.py 34 300.502 300.518 ..."""
import re, sys, html, time, urllib.request, urllib.error
title = sys.argv[1]
for sec in sys.argv[2:]:
    u = f'https://www.ecfr.gov/api/renderer/v1/content/enhanced/current/title-{title}?part={sec.split(".")[0]}&section={sec}'
    for attempt in range(8):
        try: t = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30).read().decode(); break
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 7: raise
            time.sleep(15 * (attempt + 1))
    t = html.unescape(re.sub(r'<[^>]+>', ' ', t)); t = re.sub(r'\s+', ' ', t)
    print('=====', sec); print(t.split('{"origins"')[0][:3000]); print()
