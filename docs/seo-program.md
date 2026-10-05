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
Already done. The existing service account `claude-ops@aihammcloud.iam.gserviceaccount.com` (key in `~/.config/google-service-accounts/claude-ops.json`, shared with the mediprimer SEO job) was added to the `roycanhelp.org` Search Console property as Full on 2026-10-05. The weekly job runs as the `deltaprism` user so it can read that key; the key is never copied into the repo or `/etc/roycanhelp`.

### 3. Bing Webmaster Tools (also feeds DuckDuckGo, Yahoo, Copilot, and ChatGPT search)
1. https://www.bing.com/webmasters, sign in, **Import from Google Search Console**. It verifies the site and copies the sitemap.
2. Settings, API access, Generate API key. Add to `/etc/roycanhelp/env`: `BING_WEBMASTER_API_KEY=<key>`

### 4. IndexNow (instant notice to Bing and others when Roy publishes)
No account. Claude generates a key file in `site/` and the editor pings on every publish. Google does not use IndexNow, it relies on the sitemap and Search Console.

### 5. Server logs for crawl data
One nginx change so the site has its own access log: add `access_log /var/log/nginx/roycanhelp.access.log;` to the roycanhelp.org server blocks, then `sudo nginx -t && sudo systemctl reload nginx`. Logrotate default covers it. The program reads this for Googlebot and Bingbot visits, 404s, and referrers.

### 7. Rank tracking vendor (where the site falls in the results)
Search Console reports the average position only for searches that already produced impressions. It cannot say "you are on page 4 for this phrase" or who is ahead of you. A rank tracker fills that gap by running a fixed list of searches every week and recording where roycanhelp.org appears and which sites rank above it.

Recommended: a pay-as-you-go SERP API, because the program can call it directly and a fixed list of about 50 searches checked weekly costs very little. Check current prices on each site before signing up.
- **DataForSEO** (dataforseo.com): pay as you go, SERP API with location and mobile/desktop, returns full top 100. First choice.
- **Serper.dev**: cheaper and simpler Google results API, top 100 per query. Good fallback.
- **SerpApi**: well known, more expensive, monthly plans.

Dashboards for humans (optional, not needed by the program): SE Ranking, Nightwatch, AccuRanker, Semrush, Ahrefs. Ahrefs and Semrush are the best for backlink data but are costly; Ahrefs Webmaster Tools is free for your own verified site and shows who links to you.

Setup:
1. Sign up for DataForSEO (or Serper), add a small prepaid balance, and copy the API login/key.
2. Add to `/etc/roycanhelp/env`: `DATAFORSEO_LOGIN=...` and `DATAFORSEO_PASSWORD=...` (or `SERPER_API_KEY=...`).
3. Decide location: United States nationwide, or South Carolina for the state-specific searches. Both can be tracked.
4. Claude drafts the tracked-search list from Roy's Wisdom questions and page topics (for example "what is BabyNet", "SSI for children with autism", "IEP evaluation timeline South Carolina"). You and Roy approve it. About 50 searches to start.
5. Sign up (free) for Ahrefs Webmaster Tools, verify with the same Cloudflare TXT method, and Claude reads who links to the site.

The weekly report then shows, per search: this week's position and page, change since last week, the three sites directly above, and whether Google shows an answer box or video that Roy could target.

### 6. Hand-off to Claude
Tell Claude: "setup done". It checks each credential, runs a first report, and turns on the timers.

## Part 2. What runs by itself

| When | What | Output |
|---|---|---|
| On every Roy publish | IndexNow ping, sitemap and structured data rebuild, `make check` | Bing told within seconds |
| Daily 05:30 | Live audit: every page's status, speed, title, description, canonical, redirects, noindex on /admin/ | `/var/log/roycanhelp/seo.log`, failed unit if broken |
| Weekly (Mon 06:00) | Rank tracker positions for the approved search list. Search Console: queries, pages, clicks, impressions, CTR, position, 28 days against the previous 28. URL Inspection on every sitemap URL (indexed? last crawled? which canonical did Google choose?). Bing stats. PageSpeed and Core Web Vitals on key pages. Server log: bot visits, 404s, referrers. Roy's commits for the same window. | `/var/lib/roycanhelp-seo/latest.md` plus a dated archive in the same folder |
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
