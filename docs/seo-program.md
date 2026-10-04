# roycanhelp.org SEO and search program

Goal: a loop that runs on its own. Search engines tell us what they see, the loop turns that into a short weekly report, and Roy's edits and our fixes go back out. Nothing publishes without Roy or Kurt approving it.

Privacy constraint: the site's privacy page says it does not track behavior. So no Google Analytics, no pixels, no cookies. Every signal below comes from search engines' own consoles, server logs, and public speed data.

## Part 1. One-time setup (about 45 minutes)

### 1. Google Search Console (the main feedback source)
1. Go to https://search.google.com/search-console and sign in with the Google account that will own this.
2. Add property, choose **Domain**, enter `roycanhelp.org`.
3. Google shows a TXT record. In Cloudflare, DNS, Add record: Type `TXT`, Name `@`, Content = the value Google shows. Or paste the value to Claude and it adds it with the cf CLI. Click Verify.
4. Sitemaps, add `https://roycanhelp.org/sitemap.xml`, Submit. Status must read Success.
5. Settings, Users and permissions, add Roy (Full) so he can see it too.

### 2. Let the program read Search Console (service account)
1. https://console.cloud.google.com, create project `roycanhelp-seo`.
2. APIs and Services, Library, enable **Google Search Console API** and **PageSpeed Insights API**.
3. APIs and Services, Credentials, Create credentials, **API key**, restrict it to PageSpeed Insights API. Copy it.
4. IAM and Admin, Service accounts, Create `seo-reader`. Keys, Add key, JSON. A file downloads.
5. In Search Console, Settings, Users and permissions, Add user: the service account email (ends `iam.gserviceaccount.com`), permission **Restricted**.
6. Put the JSON on the server, never in chat or git:
   `sudo install -m 640 -o root -g roychat key.json /etc/roycanhelp/gsc-service-account.json`
7. Add to `/etc/roycanhelp/env`: `PAGESPEED_API_KEY=<the key from step 3>`

### 3. Bing Webmaster Tools (also feeds DuckDuckGo, Yahoo, Copilot, and ChatGPT search)
1. https://www.bing.com/webmasters, sign in, **Import from Google Search Console**. It verifies the site and copies the sitemap.
2. Settings, API access, Generate API key. Add to `/etc/roycanhelp/env`: `BING_WEBMASTER_API_KEY=<key>`

### 4. IndexNow (instant notice to Bing and others when Roy publishes)
No account. Claude generates a key file in `site/` and the editor pings on every publish. Google does not use IndexNow, it relies on the sitemap and Search Console.

### 5. Server logs for crawl data
One nginx change so the site has its own access log: add `access_log /var/log/nginx/roycanhelp.access.log;` to the roycanhelp.org server blocks, then `sudo nginx -t && sudo systemctl reload nginx`. Logrotate default covers it. The program reads this for Googlebot and Bingbot visits, 404s, and referrers.

### 6. Hand-off to Claude
Tell Claude: "setup done". It checks each credential, runs a first report, and turns on the timers.

## Part 2. What runs by itself

| When | What | Output |
|---|---|---|
| On every Roy publish | IndexNow ping, sitemap and structured data rebuild, `make check` | Bing told within seconds |
| Daily 05:30 | Live audit: every page's status, speed, title, description, canonical, redirects, noindex on /admin/ | `/var/log/roycanhelp/seo.log`, failed unit if broken |
| Weekly (Mon 06:00) | Search Console: queries, pages, clicks, impressions, CTR, position, 28 days against the previous 28. URL Inspection on every sitemap URL (indexed? last crawled? which canonical did Google choose?). Bing stats. PageSpeed and Core Web Vitals on key pages. Server log: bot visits, 404s, referrers. Roy's commits for the same window. | `/var/lib/roychat/seo/latest.md` plus dated archive |
| Monthly | Content gaps: queries with impressions but no page that answers them. Outreach list for links. | Section of the weekly report |

The weekly report is plain English and ends with at most five recommendations ranked by expected payoff:
- Pages with impressions but low CTR: suggested new title and description.
- Queries at positions 8 to 20: which page to strengthen.
- Pages not indexed or with a different canonical chosen by Google: what to fix.
- Questions people search that Roy has not answered: candidates for new Wisdom entries or pages.
- Speed regressions after a recent change, with the commit that likely caused it.

## Part 3. How Roy and the program talk to each other
- The editor reads `latest.md` when Roy asks "how is the site doing" and at most once a week offers the top recommendation in plain English.
- Every suggestion is a proposal. Roy says yes, the editor makes the edit, the rules in `make check` guard it.
- Changes are annotated in the next report ("title changed Oct 12, clicks up 18 percent"), so we learn what works.

## Part 4. Targets
- Indexed pages equal sitemap pages (URL Inspection).
- Zero crawler 404s and zero audit failures.
- Mobile LCP under 2.5 s, CLS under 0.1, INP under 200 ms.
- Month over month growth in impressions, then clicks. A domain launched in August 2026 usually takes 3 to 6 months to settle, so judge trends, not days.
- Links from relevant sites (churches, disability and parent organizations, local directories, Roy's own network). This is the biggest lever and the only one that needs people, not code. The monthly outreach list names who to ask.

## Part 5. Rules
- Nothing invented. New content comes only from Roy's words and his citations.
- No tracking of visitors. No third-party scripts.
- Code changes go through branch, PR, CodeRabbit. Deploys to the live clone only when Kurt says so.
