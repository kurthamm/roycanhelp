#!/usr/bin/env python3
"""Weekly SEO report for roycanhelp.org. Read-only: reads Search Console and git,
writes one markdown file. Fail-fast: any Google error raises and the job fails.

    python3 tools/seo_weekly.py OUT_DIR

Writes OUT_DIR/latest.md and OUT_DIR/YYYY-MM-DD.md.
"""
import json
import pathlib
import re
import subprocess
import sys
from datetime import date, timedelta

from google.oauth2 import service_account
from googleapiclient.discovery import build

KEY_FILE = pathlib.Path.home() / ".config/google-service-accounts/claude-ops.json"
SITE = "sc-domain:roycanhelp.org"
ORIGIN = "https://roycanhelp.org"
REPO = pathlib.Path(__file__).resolve().parent.parent
LAG_DAYS = 2  # Search Console's final data trails by about two days


def gsc():
    if not KEY_FILE.exists():
        raise FileNotFoundError(f"service account key missing: {KEY_FILE}")
    creds = service_account.Credentials.from_service_account_file(
        str(KEY_FILE), scopes=["https://www.googleapis.com/auth/webmasters"])
    return build("searchconsole", "v1", credentials=creds, cache_discovery=False)


def query(svc, start, end, dims):
    rows, offset = [], 0
    while True:
        r = svc.searchanalytics().query(siteUrl=SITE, body={
            "startDate": str(start), "endDate": str(end), "dimensions": dims,
            "rowLimit": 25000, "startRow": offset, "type": "web", "dataState": "final"}).execute()
        batch = r.get("rows", [])
        rows += batch
        if len(batch) < 25000:
            return rows
        offset += 25000


def totals(rows):
    clicks = sum(r["clicks"] for r in rows)
    imps = sum(r["impressions"] for r in rows)
    return int(clicks), int(imps)


def sitemap_urls():
    xml = (REPO / "site/sitemap.xml").read_text()
    return re.findall(r"<loc>([^<]+)</loc>", xml)


def roy_commits(since):
    out = subprocess.check_output(
        ["git", "-C", str(REPO), "log", f"--since={since}", "--format=%cs %s", "--author=Roy"], text=True)
    return [l for l in out.splitlines() if l.strip()]


def pct(a, b):
    return "n/a" if not b else f"{(a - b) / b * 100:+.0f}%"


def main(out_dir):
    out = pathlib.Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    svc = gsc()
    end = date.today() - timedelta(days=LAG_DAYS)
    cur_start = end - timedelta(days=27)
    prev_end = cur_start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=27)

    L = [f"# roycanhelp.org SEO report, {date.today()}", "",
         f"Window {cur_start} to {end} against {prev_start} to {prev_end}.", ""]

    sm = svc.sitemaps().list(siteUrl=SITE).execute().get("sitemap", [])
    L += ["## Sitemap"]
    for s in sm:
        L.append(f"- {s['path']}: errors {s.get('errors', '0')}, warnings {s.get('warnings', '0')}, submitted {s.get('lastSubmitted', '?')[:10]}")
    if not sm:
        L.append("- NOT SUBMITTED")
    L.append("")

    L += ["## Index status (URL Inspection)"]
    problems = []
    urls = sitemap_urls()
    for u in urls:
        r = svc.urlInspection().index().inspect(body={"inspectionUrl": u, "siteUrl": SITE}).execute()["inspectionResult"]["indexStatusResult"]
        ok = r.get("verdict") == "PASS"
        canon_ok = r.get("googleCanonical") in (None, u)
        if not ok or not canon_ok:
            problems.append(f"- {u}: {r.get('coverageState')}; Google canonical {r.get('googleCanonical', '-')}; last crawl {(r.get('lastCrawlTime') or 'never')[:10]}")
    L += problems or ["- every sitemap URL is indexed with the expected canonical"]
    L.append("")

    cur_p, prev_p = query(svc, cur_start, end, ["page"]), query(svc, prev_start, prev_end, ["page"])
    cur_q, prev_q = query(svc, cur_start, end, ["query"]), query(svc, prev_start, prev_end, ["query"])
    (cc, ci), (pc, pi) = totals(cur_p), totals(prev_p)
    L += ["## Search performance", f"- Clicks {cc} ({pct(cc, pc)}), impressions {ci} ({pct(ci, pi)}).", ""]
    if not cur_q:
        L += ["No search data yet for this window.", ""]

    prev_pos = {r["keys"][0]: r["position"] for r in prev_q}
    L += ["## Striking distance (positions 8 to 20, most impressions first)"]
    strike = sorted((r for r in cur_q if 8 <= r["position"] <= 20), key=lambda r: -r["impressions"])[:15]
    for r in strike:
        was = prev_pos.get(r["keys"][0])
        L.append(f"- \"{r['keys'][0]}\": position {r['position']:.1f}{'' if was is None else f' (was {was:.1f})'}, {int(r['impressions'])} impressions, {int(r['clicks'])} clicks")
    L += ([] if strike else ["- none yet"]) + [""]

    L += ["## Low click-through pages (100 or more impressions, CTR under 2 percent)"]
    low = [r for r in cur_p if r["impressions"] >= 100 and r["ctr"] < 0.02]
    for r in sorted(low, key=lambda r: -r["impressions"])[:10]:
        L.append(f"- {r['keys'][0]}: {int(r['impressions'])} impressions, CTR {r['ctr'] * 100:.1f}%, position {r['position']:.1f}. Rework title and description.")
    L += ([] if low else ["- none"]) + [""]

    L += ["## Top queries"]
    for r in sorted(cur_q, key=lambda r: -r["impressions"])[:15]:
        L.append(f"- \"{r['keys'][0]}\": {int(r['impressions'])} impressions, {int(r['clicks'])} clicks, position {r['position']:.1f}")
    L += ([] if cur_q else ["- none yet"]) + [""]

    # ---- scoreboard: one line per week, appended to rank-history.jsonl so progress is measured, not assumed
    p1 = sum(1 for r in cur_q if r["position"] <= 10)
    p2 = sum(1 for r in cur_q if 10 < r["position"] <= 20)
    deeper = sum(1 for r in cur_q if r["position"] > 20)
    seen = {r["keys"][0] for r in cur_p}
    zero = [u for u in urls if u not in seen]
    snap = {"date": str(date.today()), "window": f"{cur_start}..{end}", "urls": len(urls), "indexed": len(urls) - len(problems),
            "impressions": ci, "clicks": cc, "queries_page1": p1, "queries_page2": p2, "queries_deeper": deeper, "pages_with_no_impressions": len(zero)}
    hist = out / "rank-history.jsonl"
    prior = [json.loads(l) for l in hist.read_text().splitlines() if l.strip()] if hist.exists() else []
    with hist.open("a") as f:
        f.write(json.dumps(snap) + "\n")
    L += ["## Scoreboard (week over week)"]
    for k, label in (("indexed", "Pages indexed"), ("impressions", "Impressions"), ("clicks", "Clicks"), ("queries_page1", "Queries on page 1"), ("queries_page2", "Queries on page 2"), ("queries_deeper", "Queries deeper than page 2"), ("pages_with_no_impressions", "Pages with no impressions")):
        was = f" (last week {prior[-1][k]})" if prior else " (first snapshot)"
        L.append(f"- {label}: {snap[k]}{'' if k == 'indexed' else ''}{was}" + (f" of {snap['urls']}" if k == 'indexed' else ""))
    L += [""]
    L += subprocess.check_output(["python3", str(REPO / "tools/ai_signals.py")], text=True).splitlines() + [""]

    L += ["## Roy's changes in the window"] + [f"- {c}" for c in roy_commits(str(prev_start))] + [""]

    text = "\n".join(L)
    (out / f"{date.today()}.md").write_text(text)
    (out / "latest.md").write_text(text)
    print(text)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
