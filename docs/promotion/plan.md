# Promotion plan (owned by Claude, not Roy)

Roy contributes helpful information for parents. He makes no SEO or promotion decisions and is never asked to. Claude decides, executes, and measures. Kurt sends Roy the first email and is otherwise out of the loop.

## Positioning
Roy is the dad who read the documentation. The site wins by being the most useful, trusted answer at the moment a parent is stuck. Every claim cites the spec (law, regulation, or an agency's own published rule). Satire aims at systems, never at people. Escalation advice stays in official channels. No legal or medical advice.

## The engine
1. `question-queue.md` holds the questions parents search for, ranked by expected demand. Roy's editor offers the next one, drafts an answer from the site's researched content and citations, Roy approves or edits, it publishes as a Wisdom entry or page.
2. Claude re-ranks the queue weekly from Search Console queries, rank positions and crawl data. Roy never sees this, only the next question.
3. Every published answer gets title, description, canonical, structured data, an anchor, a sitemap entry and a menu or related-page link, handled by the editor's rules and `make check`.
4. Strong answers graduate from a Wisdom entry to a standalone page when Search Console shows demand.

## Distribution (Claude drafts, Claude sends what needs no one's identity)
- Allies and resource-page listings (`allies.md`): outreach emails drafted for the site operator to send. Nothing goes out in Roy's name without Roy.
- Parent communities: helpful public answers only, following each community's rules, never astroturf.
- Press and podcast: held until there is a body of published answers to point at.

## Measurement (weekly, `tools/seo_weekly.py`)
Index status of every page, queries and pages up or down, positions 8 to 20 (striking distance), low-CTR pages, Roy's commits in the window. Findings change the queue order and the title and description of pages.

## Decision log
- 2026-10-04: no analytics scripts on the site (privacy page promises no tracking). Signals come from Search Console, Bing, server logs, public speed data.
- 2026-10-04: no newsletter until the privacy language is reviewed. Revisit when there are 30 published answers.
- 2026-10-04: other-state contributors are a later phase, after the South Carolina and federal base is strong.
