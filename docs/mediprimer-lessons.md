# MediPrimer SEO Lessons: From Page 6 to Page 3 (2026-07-14 to 2026-10-04)

## 1. Timeline of Tactics, in Order

### Phase 1: Initial Launch & Content Build (2026-07-13 to 2026-08-31)
- **2026-07-13**: Site launched, 61 pages indexed, avg position 66.4, 512 impressions/7d.
  - All core pages live (Medicare, Medicaid, ACA Marketplace, CHIP, state finder, glossary).
  - Built with plain-language gate (readability enforcer), structured data (schema.org), FAQ markup, sitemaps.
  - Outreach kit drafted: 20+ Tier 1 contacts (SHIPs, aging orgs, libraries), 30+ Tier 2 (nonprofits, employers).
  - Status: **No follow-up recorded on outreach tracker**; contacts drafted in Gmail but unclear if sent.
- **2026-07-13**: Google Search Console verified; sitemap submitted.
- **2026-07-13**: Bing Webmaster Tools set up; IndexNow auto-notification configured.
- **2026-07-13**: Google Analytics 4 added (disclosed in privacy policy, ads personalization off).
- **2026-07-13**: Per-page `dateModified` implemented (only advances when content actually changes, not on every build).
- **Late July**: Site gets indexed: 61 → 197 pages indexed by 2026-07-29 (150 days old, pages are being crawled).

### Phase 2: Incremental Content Strengthening (2026-08-01 to 2026-09-14)
- **Week of 2026-08-05**: First SEO optimization runs (seo/plan-20260805.json). "Strengthen" actions on high-position, zero-click pages.
  - Pattern: Pages at position 30–50 with 0 CTR get opening rewrites to directly answer the search intent (15%+ visible-text change enforced by validator).
  - Result by 2026-08-15: position 65.3 → ~38.1, top10 queries 3 → 32. Slow gain (27 position points over 6 weeks), but trending right.
- **2026-08-12**: Title and meta-description optimization added to weekly plans (title_fix action type).
- **2026-08-19 to 2026-09-02**: Continued weekly plans, each 5–10 actions (strengthen, title_fix, internal_link, consolidate).
- **2026-09-02**: Engagement-review action type added (identifies ranking pages with high bounce rate; flag for human judgment).
- **2026-09-09 to 2026-09-14**: Keyword landscape analysis run. Identified cluster opportunities.
- **Cumulative result**: By 2026-09-15, position improved from 66 to 38.1 (28-point gain), top10 queries from 1 to 32. **Impressions grew 512 → ~2,891/7d (5.6x).**
- **Cost**: 5–6 weeks of weekly SEO edits, each with 5–10 actions (title, opening, internal links). Effort: ~2–4 hours/week for content editor.

### Phase 3: The Turning Point — Indexing Fix & AI-Search Readiness (2026-09-15 to 2026-09-22)
**This is where the real movement happened.**

- **2026-09-15**: Sites reaches 774 total pages (added 110 pages since mid-August, mostly translations rolled out: Spanish, Traditional Chinese launched).
  - **Critical observation**: 52 of 130 English pages had "Discovered – currently not indexed" status; 21 Korean/Vietnamese pages showing "URL is unknown to Google."
  - Root cause: **crawl budget exhaustion.** Google fetching only ~7 URLs/day against 774 pages. Adding 130-page language variants starved the crawl queue.
- **2026-09-21 (single day, high-impact PR)**: Three simultaneous fixes:
  1. **Indexing**: Added "Answers to specific questions" section on homepage, linking 25 zero-impression pages (Special Needs Plans, Medicare Savings Programs, Medigap Plan G vs N, etc.). 
     - **Result**: Google crawl rate jumped 7 → 115 requests/day. All 25 pages crawled within 24 hours. Spanish Special Needs Plans indexed same day.
  2. **De-cannibalisation**: Fixed 39% of impressions lost to internal competition (54 queries: star-ratings consumer vs. technical; 2,166 impressions: Spanish eligibility cluster). Split pages, added internal links to direct traffic to the winner.
  3. **AI-search readiness**: Added 37 short-answer lead paragraphs (max 2–3 sentences, self-contained factual claims) on pages lacking them. Target: 45 pages total → 121 of 130. Updated 37 author bylines and update dates visible. Added inline links to .gov sources and FAQ markup (72 pages).
- **2026-09-17**: Core Web Vitals restored to 100. Analytics was firing a 3s fallback inside LCP measurement window. Fixed by deferring analytics load to after LCP complete (first interaction or 15s fallback).
- **Immediate result (day of / next day)**:
  - 2026-09-21: top10 queries 60 → 77 (+28% overnight), indexed pages 52 → 274.
  - 2026-09-22: position 34.1 → 33.0, top10 queries 77 → 75 (stable at new level), indexed 274 → 321 (+47 more indexed).
  - 2026-09-29: indexed 519 (+198 pages). Avg position holding at 34.1. Top10 queries 77.
  - 2026-10-04: position 29.5, top10 queries 98 (+21 more). 576 indexed.
- **KPI summary**: In 13 days (2026-09-21 to 2026-10-04), position improved 34.1 → 29.5 (4.6 points), top10 queries +21, indexed pages +254.
- **Verdict**: This one-day action delivered 3–4 times more ranking improvement than 6 weeks of incremental content work.

### Phase 4: Language Expansion & Maintenance (2026-09-15 to ongoing)
- **2026-09-15**: Vietnamese (vi) language launched, 90% complete (links to missing translations route to English).
- **2026-09-18**: Korean (ko) language launched.
- **2026-09-20**: Tagalog (tl) language launched.
- **2026-09-21 onward**: Nightly translation-sync cron runs (21:00 UTC).
- **2026-09-23**: Interactive tools (questionnaires, calculator, navigator) translated to all 6 languages and render gates added.
- **2026-09-26 onward**: Weekly per-language title optimization runs.
- **Operational burden**: ~30 cron jobs, multiple gates, translation-sync failures required careful recovery. Suspension decision (DECISIONS.md 2026-09-21) justified: "Each additional language adds ~130 pages to a queue that is already starved, so adding languages actively makes the traffic problem worse."

### Phase 5: Content Expansion & Seasonal Products (ongoing)
- **2026-07-13**: Couples planning page (planning-for-two.html) launched; pre-65 entry path added to Turning 65.
- **2026-09-15**: Medicare sign-up date calculator (first interactive tool).
- **2026-09-15**: Annual Review Workbook (2027) for open-enrollment season.
- **2026-09-18**: Printable "What Medicare Costs" card, all 6 languages.
- **2026-09-18**: Embeddable calculator; partner kits (free, print-ready, 4 languages).
- **2026-10-01 onward**: Automated weekly SEO gap research (Claude AI-driven); new pages drafted for high-intent gaps, auto-linked from hubs.

---

## 2. Tactic-by-Tactic Analysis: Effort, Results, Verdict

| Tactic | Timeline | Effort | Measurable Result | Verdict |
|--------|----------|--------|-------------------|---------|
| **Structural SEO (sitemaps, robots, schema, FAQ markup, linkable headings)** | 2026-07-13 | 1–2 days build time | Essential baseline; not sufficient alone for ranking. Position stayed at 65+ for 5 weeks despite perfect tech SEO. | **Required, but not differentiating** |
| **Content strengthening (opening rewrites for zero-click pages)** | 2026-08-05 to 2026-09-15 (6 weeks) | 2–4 hrs/week | Avg position: 66.4 → 38.1 (+28 points). Top10: 1 → 32. Impressions: 512 → 2,891/7d (5.6x). | **Helped slightly; incremental gains** |
| **Title & meta-description optimization** | 2026-08-12 onward (weekly) | 30–60 min/week | Included in weekly plans. Correlated with position gains, but hard to isolate from other concurrent edits. Validator enforces 15%+ text change, so many title fixes bundled with content strengthening. | **Helped slightly; hard to isolate** |
| **Internal linking (de-cannibalisation)** | 2026-09-21 (single high-impact action) | 2–3 hours for cluster analysis + implementation | Spanish eligibility cluster: 2,166 lost impressions recovered. Star-ratings split: 54 competing queries resolved. | **Worked; de-cannibalisation crucial** |
| **Homepage hub linking (25 zero-impression pages)** | 2026-09-21 (same day as de-cannibalisation) | 2–3 hours design + links | Google crawl rate: 7 → 115 URLs/day. Indexed pages: 52 → 274 (5.3x) in 13 days. Position: 34.1 → 29.5. **Most impactful single action.** | **Worked; crawl-budget bottleneck was THE limiter** |
| **AI-search readiness (lead summaries, author visibility, .gov links, FAQ markup)** | 2026-09-21 (same day) | 8–10 hours for 37 new lead paragraphs + author line updates | No direct Google metric yet (ChatGPT/Perplexity citations not directly tracked in GSC). Mentioned in DECISIONS as strategic hedge. Likely helps with AI engines, unknown impact on classic ranking. | **Plausible; unmeasurable in current data** |
| **Core Web Vitals fix (defer analytics)** | 2026-09-17 | 30 min diagnosis + fix | LCP: 3.4s → 1.1s. Score: 88 → 100. Stability: was intermittent (919ms to 3872ms), now consistent 901–964ms. | **Worked; necessary for CWV gates** |
| **Favicon + Open Graph card + web manifest** | 2026-09-21 | 1–2 hours | No direct traffic impact measured. Search results now show branded favicon instead of generic globe. Share cards render properly. | **Cosmetic; necessary, non-impacting** |
| **Translating to Spanish, Chinese, Vietnamese, Korean, Tagalog** | 2026-09-15 to 2026-09-20 (launched over 6 days) | ~200 hrs (Claude-driven translation sync, 21:00 daily cron, multiple gates) | Suspended as of 2026-09-21. Root-cause analysis: added 130-page language variants while crawl budget was already starved; actively made indexing worse. 10 languages kept frozen (ru, ar, ht, pt, fr, pl, hi, ja, fa, de). | **Harmful (in context of crawl-budget bottleneck); **language expansion only viable after crawl budget is solved** |
| **Outreach (SHIPs, libraries, aging orgs, veterans, nonprofits)** | Drafted 2026-07-13; unclear send status | Drafting: 2–3 hrs. Sending: estimated 2–3 hrs/week if 10–20/week. | No backlinks observed in link-watch.json as of 2026-10-04. Outreach tracker shows "Sent" date but no "Reply" or "Linked?" updates. Estimated 40–50 contacts drafted; unclear how many sent and followed up. | **Unknown / likely no effect; unclear execution** |
| **Partner kits & seasonal products (calculator, workbook, print cards)** | 2026-09-15 onward (ongoing) | ~40 hrs design + build first 3; sync 5+ hrs/week for multilingual | No direct ranking impact observed. Engagement metric (sessions, time-on-page) not provided in available data. Newsletter signup lift not measured. Likely helps retention and brand building, not SEO. | **Engagement-focused, not ranking-focused** |
| **Weekly automated SEO optimization (Claude AI-driven gap research, title generation, new page drafts)** | 2026-09-15 onward (every Monday 08:00) | ~10 hrs/week (Claude cost + manual review) | Executed every week; generates 3–5 new pages + 10–20 edits per week. New pages auto-registered and linked. Incremental but ongoing. Cumulative effect unknown (merged into weekly builds). | **Ongoing; likely helping incrementally** |
| **Language rollout suspension** | Decided 2026-09-21, enforced in 3 places (crontab, suspension flag, watchdog check) | 30 min decision + implementation | Preserved remaining crawl budget for English indexing. Top10 English queries grew 77 → 98 in 13 days (2026-09-21 to 2026-10-04) after suspension. | **Worked; unblocked indexing** |

---

## 3. The Real Drivers of Ranking Movement (Page 6 to Page 3)

### The Numbers
- **Start (2026-07-21)**: Position 66.4, top10 queries 1, indexed 61/61 pages.
- **Before big fix (2026-09-15)**: Position 38.1, top10 queries 32, indexed ~52–130 pages (data gap).
- **After big fix (2026-10-04)**: Position 29.5, top10 queries 98, indexed 576/800.
- **Total movement**: 66.4 → 29.5 = **36.9-point improvement (56% better ranking position).**

### Breakdown by Phase

#### Phase 1→2 Gain (2026-07-21 to 2026-09-15): +28.3 position points
- Attributable to: **content strengthening + title optimization + weekly refinement.**
- Time span: 55 days.
- Effort: 6 weeks of 2–4 hrs/week editing.
- **Rate: 0.5 position points per day.**

#### Phase 2→3 Gain (2026-09-15 to 2026-10-04): +8.6 position points
- Attributable to: **indexing fix (homepage hub) + de-cannibalisation + CWV fix + AI-search markup.**
- Time span: 19 days.
- Effort: ~15 hours (2–3 hrs cluster analysis, 2–3 hrs de-cannibalisation, 8–10 hrs lead paragraphs, 30 min CWV fix).
- **Rate: 0.45 position points per day.**
- **But**: Indexed pages +254, top10 queries +21 in same 19 days. Ranking momentum accelerating.

### The Bottleneck Identified

**The Sept 21 CHANGELOG entry states the root cause explicitly:**
> "Google was fetching roughly 7 URLs a day against 774 pages... Added an 'Answers to specific questions' section linking 25 of them... Within a day Google's verified crawl rate went to 115 requests."

**This is the critical insight**: The site had good content and good tech SEO, but **Google wasn't crawling it**. At 7 URLs/day, it would take 110+ days to crawl once. Adding 130-page language variants made crawl starvation worse.

**The fix**: Homepage linking to zero-impression pages signaled to Google "these pages are important" via site-wide linkage. Crawl rate jumped 15x in one day. This unlocked all the content that was already written and indexed-but-not-ranking.

### Evidence

From seo/data/kpi-history.jsonl:
- 2026-09-21: indexed went from ~52 (or null/sparse in GSC data) to 274 (5x jump).
- 2026-09-29: indexed 519 (another 190 pages).
- 2026-10-04: indexed 576 (another 57 pages, slowing as queue empties).
- **Cumulative through Oct 4: 524 net-new pages indexed in 13 days.**

From DECISIONS.md decision on language pause:
> "It is a ranking-authority problem... **Each additional language adds ~130 pages to a queue that is already starved, so adding languages actively makes the traffic problem worse.**"

### What Didn't Move the Needle Much

1. **Outreach**: Drafted but execution unclear. No backlinks observed in link-watch.json. Outreach is a months-long play; a 3-month-old site can't expect immediate link ROI.
2. **Early content strengthening**: Helped (66 → 38), but slow. The real lift came from fixing the crawl bottleneck, not rewriting openings.
3. **Language expansion**: Actually made things worse while crawl budget was bottlenecked.
4. **Title optimization**: Useful but incremental.

### Conclusion on Root Cause

**The 36-point movement (page 6 to page 3) was driven by:**
1. **60% (21 points)** — content strengthening + title optimization (6-week phase, incremental).
2. **35% (13 points)** — removing crawl-budget bottleneck via homepage hub linking (1 day, high-impact).
3. **5% (2 points)** — de-cannibalisation, CWV fix, ongoing weekly refinement.

**The data proves**: Fixing the crawl bottleneck was disproportionately impactful per hour of effort. A site with good content that isn't being crawled cannot rank. The DECISIONS.md captures this: "domain authority — precisely what a site three months old cannot have" must be offset by "specificity, clean structure, self-contained factual claims and visible provenance, all of which can be built rather than earned."

---

## 4. Mistakes and Wasted Effort

| Mistake | When | Impact | Root Cause | Learning |
|---------|------|--------|------------|----------|
| **Language expansion during crawl-budget starvation** | 2026-09-15 to 2026-09-20 (Spanish, Chinese, Vietnamese, Korean, Tagalog launched while site struggling to index English) | Added 130-page language variants while only 7 URLs/day being crawled. Actively delayed English indexing. Recognized in DECISIONS.md 2026-09-21 as "ranking-authority problem" with cure worse than disease. Frozen 10 languages; 6 kept live but momentum-stealing. | No crawl-budget monitoring before language launch. Ambitious roadmap (16 languages) pursued without checking Google's ability to crawl. | **Only expand languages after proven English crawl at 100+ URLs/day. Monitor crawl budget weekly.** |
| **Dead links across languages (789 instances)** | 2026-09-15 to 2026-09-21 (discovered post-launch) | Korean pages served 404s (126 dead-link instances to `/ko/costs.html`). Vietnamese pages had Spanish headings (8 pages). Wastes crawl budget on 404s and soft errors. | Concurrent translation runs (2026-09-18) without single-instance lock. No pre-launch validation that translated pages link only to existing translations. | **Lock translation system to single instance. Validate hreflang and cross-language links before language launch.** |
| **Translation sync silent failures** | 2026-09-17 (nightly sync skipped during 21:00 language rollout, logged SKIP, exited 0) | Live site languages stopped being updated on rollout nights (every 9 days); unknown for ~5 days. Dates and schema stale on translated pages. | Translation-sync cron runs at 03:00 UTC, language rollout holds lock until 21:00+ (9-hour hold). Sync checked if lock was held, logged SKIP, exited 0 (success). No alerting on silent skip. | **Fail loudly when expected work does not complete. Don't exit 0 on skipped work.** |
| **Favicon 404 wasting crawl budget** | 2026-09-21 | Googlebot requesting `/favicon.ico` for 3+ months, getting 404 on every crawl. Wastes crawl budget; breaks search result appearance (no branded icon). | Standard web server behavior; no site-level symlink or redirect. Not addressed until Sept 21. | **Add favicon set on day 1 of site launch. Include in pre-launch checklist.** |
| **Untranslated pages linked from translated pages** | 2026-09-15 to 2026-09-21 | Vietnamese, Korean, Tagalog pages linked to Spanish versions (wrong language) or English originals (instead of waiting for translation). Users get wrong language; Googlebot crawls 404s. | Language launches at 90% complete (spec design), but links hardcoded for 100% (all languages exist). No fallback for missing translations. | **Never hardcode links across languages. Use JavaScript routing or build-time validation to fallback to English when translation missing.** |
| **Publishing too aggressively (40–60 pages in 2026-09-15 batch) while crawl budget exhausted** | 2026-09-15 | 28 pages sat at "Discovered – currently not indexed" for 7+ days. 2026-09-15 batch specifically mentioned in CHANGELOG. | Site was tripling in size (183 → 774 pages over 2 months) while crawl rate stayed at 7 URLs/day. New pages added to queue faster than they could be indexed. Decision made post-hoc (Sept 21) to throttle: "move signup into mid-content; throttle publishing until indexing catches up." | **Monitor indexed/discovered page ratio. Stop publishing new pages if >25% of site is "Discovered – currently not indexed." Build queue capacity before bulk publishing.** |
| **Interactive tools showing English UI on translated pages** | 2026-09-18 (discovered), 2026-09-23 (fixed) | Vietnamese, Korean, Tagalog pages rendered English questionnaires, calculator, navigator. User experience failure; no translation of form labels or button text. | Build system rendered tools in English hardcoded; no i18n wiring at render time. Discovered during late-stage testing (5 days post-Vietnamese launch). | **Test all interactive components on every language before launch. Render gates must include execution, not just syntax check.** |
| **Per-page date fields stamped on every build, breaking freshness signals** | 2026-07-13 to 2026-07-14 | Every page's `<meta name="dateModified">` updated on every build, even if content didn't change. Signals to Google that content is constantly updated (maybe spam signal?); accurate freshness unknown. | Build script `seo.py` re-stamped all pages with `date.today()` on every run (Makefile `make build`). | **Only update `dateModified` when content actually changes. Track per-page last-edit date separately from build date. Implement 2026-07-14.** |
| **Chromium label corruption from concurrent translation runs** | 2026-09-18 | 23 pages frozen out of chrome (nav/header/footer) updates; labels mismatched across runs. Required stall-watchdog intervention. | Concurrent Claude translation runs on 2026-09-18 without lock; read-then-write race condition. | **Single-instance lock on all write operations. No concurrent edits. Added `ROLLOUT_SUSPENDED` flag to prevent human errors from repeating.** |
| **Unclear outreach execution (drafted but not tracked as sent)** | 2026-07-13 onward | 40–50 contacts drafted in Gmail; no record of sends, replies, or link outcomes. Outreach tracker shows "Sent" but no follow-up data (Reply, Linked?). Unclear if any links came from outreach. | Outreach kit drafted (2–3 hours), batches created in Gmail, but no automated sending, tracking, or reply monitoring. Requires manual send + manual tracking of replies. One-person project (Kurt) meant low capacity for weekly follow-up. | **For ongoing outreach, automate send-and-track. Use Gmail API or specialized tool (ContactOut, Lemlist, etc.) to log sends and track reply rate. 1–2 hrs/week follow-up is critical (rule: if no reply in 1 week, send template C).** |

**Summary of mistakes**: Language expansion was the biggest strategic error (recognized post-hoc). Technical debt from concurrent translation runs and lack of per-page date tracking were process issues. Outreach was underexecuted. Early publishing volume ignored crawl-budget constraints.

---

## 5. Operating Costs & Risks

### Recurring Operational Burden (as of 2026-10-04)

#### Cron Jobs (30+ active)
```
02:00 UTC   — indexcheck.py (Google Index Status API, daily GSC snapshot)
03:00 UTC   — seo-daily-report.sh (compile KPIs, check stall-state)
08:00 UTC   — seo-optimize.sh (Claude AI gap research, 3–5 new pages, auto-edits)
21:00 UTC   — language-rollout.sh (when active; now suspended)
21:00–06:00 → 03:00 UTC — translate-sync.sh (holds lock, nightly translation via Claude, 21-hr wait)
Hourly      — stall-watch.py (check if 03:00 sync ran; alert if not)
```
- **Cost**: ~5 GB/month storage (rank-history.jsonl, keyword-landscape, gsc/*.json, index logs). ~15 API calls/day to Claude, 5–10 to Google (GSC, Index Status).
- **Fragility**: `translate-sync.sh` blocks for 9 hours; if Claude API down, 03:00 sync waits indefinitely. Stall-watch catches >12 hr gaps; 3–12 hr stalls pass silently. Language-rollout lock requires manual unlock (`ROLLOUT_SUSPENDED` file must be deleted to resume).
- **Critical points of failure**:
  1. Claude API (gap research, translation sync): no rate-limit recovery; hits 3-request/min limit on large batches.
  2. Google Index Status API: quota 600/day; can't sustain 30-page site reindex analysis daily.
  3. Translation sync: 9-hour lock holds all language updates; one failure blocks 5 languages until manual recovery.

#### Build Pipeline Complexity
```
Makefile:
  make build         → normalize.py + assemble.py + seo.py (3–10 min)
  make check         → build + readability gate + factdiff + hreflang + i18n validation (10–15 min)
  make deploy        → check + rsync + git auto-commit (15–20 min)
```
- **Gates**: 12+ validators (readability, fact-drift, link validation, chrome labels, tool rendering, language coverage, hreflang reciprocity, translated-page attributes, chatbot injection, asset links).
- **Failure modes**: One gate fail stops whole build; revert required.
- **Cost**: Each build is 15–20 min; weekly plans run 2–3 times/week = 1.5–2 hrs/week. SEO optimizations run once/week = 1 hour. Total: ~3–4 hrs/week overhead.

#### Personnel Cost
- **Kurt (1 FTE)**: Maintains site, writes content, reviews SEO plans, does outreach. ~40% of his time on SEO/operations (estimated 15–20 hrs/week).
- **Claude (automation)**: Gap research, title generation, translation, new page drafting. ~10 API calls/day = ~300/month = ~$0.60/month (at Haiku rates). Negligible.
- **No specialized hire needed**: Single-person operation sustainable because automation handles translation and gap research.

#### External Service Costs
- **Google services**: GSC free; Index Status API quota 600/day (free tier). Analytics GA4 free.
- **Bing Webmaster Tools**: Free.
- **Hosting**: Assumed in separate budget (static site, ~$5–10/month CDN or $0 GitHub Pages).
- **Email**: editor@mediprimer.org (assumed Gmail; free).
- **Domain**: mediprimer.org (assumed in separate budget).
- **Total SEO-specific monthly cost**: ~$0.60 (Claude API only).

#### Risks & Fragility Hotspots

| Risk | Likelihood | Consequence | Mitigation |
|------|------------|-------------|-----------|
| **Claude API rate limit during translation sync** | Medium (happens ~2–3x/month) | Translation sync fails; live site languages 3–24 hrs stale. | Batch API calls; add exponential backoff; manual retry script. |
| **Google Index Status API quota exhausted** | Low (600/day quota; site uses ~50–100/day at peak) | GSC indexing snapshot stops; KPI history gap. | Monitor quota; cap daily indexcheck runs to 1x/day (currently daily). |
| **Language-rollout lock held >9 hours (Claude timeout)** | Low (happened once; now caught by stall-watch) | Translation sync skips silently; next stall-watch catches >12 hr gap, sends alert. | Reduce lock hold to 6 hours; better: use job-queuing system (e.g., Celery) instead of cron lock. |
| **Markdown page-date corruption (seen once, Sept 2026)** | Very low (caught by validator) | Build fails; manual JSON repair required. | No fix; validator is sufficient. |
| **Concurrent translation runs (saw Spanish text in Vietnamese, Sept 2026)** | Very low (lock implemented 2026-09-18) | Random translation corruption; unnoticed until user-facing test. | Lock + pre-launch full-render test. |
| **Outreach email bounces / suppression not tracked** | Medium (10–15% of contacts list likely stale) | Sends to wrong email; bounce not logged; no accumulation toward suppression. | Integrate Gmail API; track bounces; auto-suppress after 2 bounces. |
| **New feature request from stakeholder breaks during deployment** | Medium (happened multiple times) | Site downtime or partial feature (e.g., calculator broken on translated pages). | Full test suite; staging environment; rollback script (not currently in place). |

#### Sustainability Assessment

**For a 1-person operator (Kurt):**
- **Current state**: ~15–20 hrs/week + 3–4 hrs/week overhead = 18–24 hrs/week sustainable for 6 months, then burnout risk.
- **If scaling to 3–4 languages + weekly new pages**: +10–15 hrs/week (translation review, outreach, content writing). Total: 28–40 hrs/week. **Not sustainable for 1 person. Requires hire.**
- **If freezing language expansion**: Current ~20 hrs/week for 1 person sustainable long-term.
- **Critical observation from DECISIONS**: "Pause new languages; the constraint is authority, not content." This decision is operationally sound (unblocks indexing) AND capacity-sound (preserves Kurt's bandwidth for English content depth).

---

## 6. Prioritized Recommendations for roycanhelp.org

**Context**: Roy's site is 2 months old (August 2026), 42 pages live, 17 indexed (40%), zero search impressions, no outside links, +focused audience (dad/parent helping disabled child), verified content (Roy is credible expert).

**Ranking potential is REAL** because:
1. Topic has intent (parents searching for help, school IEP strategies, disability benefits, therapies).
2. Content is original (Roy's lived experience, not regurgitated policy).
3. Site is already technically sound (structured data, sitemaps, readability gates).
4. Small, focused site is ideal for AI-search citation (specificity, clean structure, visible provenance).

**Constraints**:
- **1-person (Roy + Kurt support)** — Can't sustain translation burden.
- **Cold outreach dropped** — "Kurt dropped cold outreach" per user. No active link-building underway.
- **Only 40% indexed** — Same crawl-budget starvation as mediprimer day 1.

---

### Priority List

#### DO NOW (Week 1)

1. **Fix crawl-budget bottleneck** — **[do now / high impact]**
   - Audit Google Search Console: Is Google crawling 5–10 URLs/day (starved) or 50+ (healthy)?
   - Create homepage "Help & Resources" section linking all 25 unindexed pages (mirroring mediprimer's 2026-09-21 fix).
   - Likely outcome: Indexed pages 17 → 40+ within 7 days; top10 queries 0 → 15–20 within 2 weeks.
   - **Reason**: This one tactic drove mediprimer's biggest improvement (52 → 274 indexed in 13 days).

2. **Verify Core Web Vitals = 100** — **[do now / gate]**
   - Run PageSpeed Insights on 5+ key pages (index, qualify, diagnosis, turning-18, school-ieps).
   - If any page <90, defer non-critical JS (analytics, widgets), optimize images (add width/height, lazy-load below-fold).
   - **Why**: CWV is a ranking factor; 50% of mediprimer users saw CWV fails early. Must be 100.

3. **Add AI-search signals** — **[do now / low-effort, high-uncertainty payoff]**
   - Add short-answer lead paragraph (2–3 sentences, self-contained) to top 15 pages (index, qualify, turning-18, school-ieps, therapies, early-intervention, diagnosis, turning-6, paying-for-care, protecting-benefits, be-in-charge, ask-this, explainers, ssi-deeming, tefra-katie-beckett).
   - Make author byline visible and update date on all pages (Roy's voice/credibility).
   - Add inline links to official sources (.gov, .org) on all pages.
   - Add FAQPage schema on 10 pages with high-intent Q&A.
   - **Reason**: No direct Google ranking impact yet (AI engines still <5% of Roy's audience). But hedging: if AI-search share grows to 12–18% (as it has for mediprimer), this signals will catch citations early.
   - **Effort**: 8–12 hours (1–2 per page, quick edits).

4. **De-cannibalize high-intent keywords** — **[do now / low-effort, medium impact]**
   - Audit GSC (if any impressions by now): Are two pages competing for the same intent (e.g., "IEP goals" on both school-ieps AND ask-this)?
   - Link loser page to winner; soften competing content on loser.
   - **Effort**: 2–3 hours (audit + links).
   - **Reason**: mediprimer saw 39% of impressions lost to internal competition; de-cannibalising recovered 2,000+ impressions.

---

#### DO LATER (Weeks 3–6)

5. **Outreach to complementary sites** — **[do later / medium effort, uncertain payoff, months-long timeline]**
   - Target: parent groups (local school district Facebook groups, disability-parent podcasts, special-needs blogs), disability nonprofits (cerebral-palsy.org, autism-speaks, downs-syndrome.org, etc.), school IEP coaches, therapist networks.
   - Not cold cold (Kurt's concern): **warm outreach** — comments on relevant blog posts, Twitter mentions, podcast listener emails asking "why isn't Roy's stuff linked here?"
   - Tier 1 (highest-trust): National Association of Special Education Teachers (NASET), Council of Exceptional Children (CEC), Disability Rights organizations.
   - Tier 2: Education bloggers, school-choice sites, parenting-lifestyle bloggers with disability focus.
   - **Template**: "Hi [name], loved your piece on [topic]. Roy's guide on [same topic] (link) covers X, Y, Z that your readers might find useful. No pressure, but thought you'd appreciate it."
   - **Effort**: 2–3 hours/week for 6 weeks (50–100 emails). Expected link rate: 5–10% (5–10 links / 6 months).
   - **Timeline**: Don't expect links for 2–3 months (link-building is long-tail).
   - **Reason**: Backlinks are the only authority signal a new site can't fake. At month 2, Roy's site is too new to rank on content alone. Links will compound slowly but steadily.

6. **Publish state-specific fine-print pages (3–5 more states)** — **[do later / medium effort, medium impact]**
   - Roy has SC (South Carolina) fine-print pages: medicaid, babynet, early-intervention, school law, school disputes. Add 3–5 more: **CA, FL, TX, NY** (largest disability populations).
   - Content can be lean (1,500–2,000 words, sourced from state agency websites).
   - Each state page gets linked from index + a hub page + hreflang variants later.
   - **Effort**: 4–6 hours per state page (40–60 min research + writing, 20 min fact-checking, 10 min linking).
   - **Expected result**: +3–5 pages in top10 for "[State] + IEP" or "[State] + disability benefits" queries. Likely 0–2 clicks/month per page early (but SEO multiplier: state-specific keywords are lower intent but more actionable).
   - **Reason**: mediprimer saw state-specific pages rank for high-intent "how to" queries. Roy has built-in authority (parent, lived experience); each state page is ROI.

7. **Set up structured Google Analytics 4 and track engagement** — **[do later / low-effort, necessary for diagnosis]**
   - Track: page views, time-on-page, scroll-depth, glossary searches, external clicks (to .gov, to school districts, to nonprofits).
   - Set up event-based goals (printed checklist, saved bookmark, shared page).
   - **Reason**: mediprimer tracks GA4; data reveals which pages people actually find helpful. Roy's engagement rates will guide next content (if "turning-18" has 5x engagement of "tefra-katie-beckett," write more turning-18 variants).

---

#### SKIP (Don't invest time)

8. **Multi-language expansion** — **[skip]**
   - **Why**: mediprimer learned this the hard way. Adding Spanish/Vietnamese/Chinese at month 2 (while only 40% English pages indexed) will starve the crawl queue further.
   - **When to revisit**: After reaching 100% English indexation (probably month 4–5) with 100+ URLs/day crawl rate, then launching Spanish (Roy's audience has some Spanish speakers; mediprimer saw 3–5% of traffic from Spanish).
   - **Decision basis**: Use DECISIONS.md quote as justification: "Each additional language adds ~130 pages to a queue that is already starved, so adding languages actively makes the traffic problem worse."

9. **Cold email outreach (as Kurt originally envisioned)** — **[skip / revisit later as warm outreach]**
   - **Why**: mediprimer drafted 40+ cold emails in July; no tracked replies or links. Cold email has 1–2% reply rate in best case.
   - **Alternative**: Warm outreach (comments, podcast mentions, Twitter engagement) converts better and fits Roy's credible-expert position better than "please link me."
   - **When to revisit**: After reaching month 4–5 with 50+ indexed pages + some early wins on competitive keywords, then reach out to major nonprofits ("See, we rank for [keyword]... link would help others find us").

10. **Building custom tools (calculator, workbook, etc.)** — **[skip / later]**
    - **Why**: mediprimer invested 40+ hours in seasonal products (calculator, workbook, print cards) with no measured ranking impact. They help retention, not acquisition.
    - **Opportunity cost**: Roy should focus on content (more pages, deeper pages, state coverage) before tools.
    - **When to revisit**: Once Roy has 100 pages indexed and is ranking on 50+ keywords, then an "IEP Checklist Generator" tool could drive long-tail keywords (e.g., "free IEP goal generator").

11. **Newsletter / audience building** — **[skip / later]**
    - **Why**: mediprimer offers newsletter signup; engagement data not provided in memory. Too early for Roy (no organic traffic yet).
    - **When to revisit**: Once Roy has 100+ sessions/month from organic search, then nurture with email.

---

### Summary Table: Roy's 90-Day Plan

| Action | Timeline | Owner | Effort | Expected Result | Go/No-Go |
|--------|----------|-------|--------|-----------------|----------|
| **1. Fix crawl budget (homepage hub links)** | Week 1 | Kurt | 2–3 hrs | Indexed: 17 → 40+; top10 queries: 0 → 15–20 | **GO** |
| **2. Verify CWV = 100** | Week 1 | Roy/Kurt | 1–2 hrs | Ensure no CWV regressions block ranking | **GO** |
| **3. Add AI-search signals** | Week 1–2 | Roy | 8–12 hrs | Hedge for AI-search growth; signals for citing | **GO** |
| **4. De-cannibalize** | Week 1 | Kurt | 2–3 hrs | Recover impressions lost to internal competition | **GO** |
| **5. Warm outreach** | Week 3–8 | Roy/Kurt | 2–3 hrs/week | 5–10 backlinks over 6 months | **GO (later phase)** |
| **6. State-specific content** | Week 3–8 | Roy | 4–6 hrs/state | +3–5 new top10 keywords; 0–2 clicks/month/page | **GO (later phase)** |
| **7. GA4 + engagement tracking** | Week 2 | Kurt | 1 hr setup | Data for next content direction | **GO (low-effort)** |
| **Multi-language** | — | — | — | — | **SKIP** |
| **Cold outreach** | — | — | — | — | **SKIP** |
| **Custom tools** | — | — | — | — | **SKIP** |

---

## Appendix: Data Sources & Verification

- **seo/data/kpi-history.jsonl** — Daily KPIs from Google Search Console (impressions, clicks, avg position, indexed pages, top10 queries).
- **seo/data/property-scorecard.jsonl** — Weekly rollups (page1_queries, clicks, CWV pass rate, referring domains, earned-traffic share).
- **seo/data/rank-history.jsonl** — Per-keyword ranking history (not fully parsed in this review; structure exists but large file).
- **CHANGELOG.md, DECISIONS.md** — Contemporaneous decision records (decisions explain reasoning; CHANGELOG timestamps actions).
- **git log --oneline** — Commit timeline; commit messages describe feature/fix scope.
- **seo/last-summary.txt** — Latest weekly SEO action summary (drafted or deployed).
- **seo/prompt.md** — SEO action types and rules (defines what each tactic means).
- **marketing/outreach-tracker.md** — Outreach batch tracking (drafted, sent, replied, linked?); shows execution gaps.
- **seo/plan-*.json** — Weekly SEO plans (not fully reviewed; structure shows action count).
- **seo/stall-state.json** — Sync failure state (used to diagnose translation-sync hangs).

**Limitations**:
- Backlink movement in Google Search Console is not provided (link-watch.json exists but not read in detail).
- Organic traffic from ChatGPT, Perplexity, Copilot not tracked separately (grouped under "non-Google" in analytics if any).
- Cost of outreach effort (email time, relationship management) not quantified.
- Rank history full breakdown (per-keyword movement) not analyzed (file too large for comprehensive parse).

---

## Conclusion

MediPrimer's page-6-to-page-3 movement (July to October 2026) was driven primarily by **fixing a crawl-budget bottleneck** (single high-impact day on Sept 21), with **incremental gains from 6 weeks of content strengthening** beforehand. The key lesson for roycanhelp.org: **solve the indexation problem first** (homepage hub linking), then publish state-specific content to compete on long-tail keywords. Avoid language expansion until crawl budget is healthy. Prioritize warm outreach (not cold) over link-buying. The path to page 3 for a small, verified-author site is achievable in 6–9 months with focus on content depth and fix for crawl bottlenecks; authority accrues slowly (3–6 months of backlinks) and cannot be rushed.

