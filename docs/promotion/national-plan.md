# Making roycanhelp.org national, easier for Roy, and bigger

## Finding that shapes everything (2026-10-04)
Only the Wisdom page is heavily South Carolina (26 mentions). The other pages are mostly federal law, which is already national. The site is not SC-specific, it is framed that way. The real gap is state coverage: `site/data/states.json` drives a dropdown on one page (one URL), and it is not trustworthy:
- 83 of 204 links did not resolve when checked (some are bot-blocked 403s, many are dead domains).
- In 15 of 51 states the developmental disabilities agency, Medicaid and early intervention entries are the same generic URL.
- 9 states list a Protection and Advocacy agency where the Parent Training and Information center belongs (for example AL, AR, FL, HI, ID, MN, MT, NE, PA).
A site whose promise is "specs beat opinions" cannot ship that. Fix before scaling.

## Direction (revised 2026-10-04): this site is about Roy
The first draft of this plan borrowed the Mediprimer playbook: a directory, one page per state, data at scale. That is wrong for this site. Mediprimer is a reference utility. roycanhelp.org is a person: the dad who read the documentation. His voice and first-hand experience are the product and the reason to link to, share or trust the site. Programmatic state pages would bury that.

### What changes
- Dropped as a lead strategy: 51 generated state pages. Instead, repair the existing state picker data (it has dead links and mislabeled agencies) so it is accurate, and keep it as a small tool.
- Grow by being more Roy:
  1. Visible Roy: a real About page and story in chapters, only with facts he confirms, a photo or voice only if he supplies it. Podcast and short video over SEO pages.
  2. Every answer in his three parts: what happened to us, what the rule says (with citation), what I would do. This is first-hand experience plus evidence, which is what search rewards.
  3. Win branded and story searches first (his name, "Roy Can Help", the autism dad engineer angle, the questions his lessons answer).
  4. People-driven traffic: his church and Gamecock network, Partners in Policymaking alumni, the SC Autism Society, parents sharing a page that helped them, human-interest press, podcast guests who bring their own audiences, speaking at autism society events.
  5. Parent testimonials, with consent.
- Not SC-specific, the Roy way: the rule is national, the story is his. Each page gives the federal rule, what happened to his family in South Carolina, and how to find your state's version. Parents from other states can share how their state differed, curated by Roy. That builds community around him and covers other states without turning him into a database.

### Making it easy for Roy
Pre-drafted, verified questions from his own words and notes, forwarded parent messages become Q&A, one chat in his ChatGPT, direct instructions run at once, three drafts offered at a time.

### Still true from before
Federal rights are national already. Only the Wisdom page is heavily South Carolina. State data in site/data/states.json must be repaired from official directories (parent training centers, protection and advocacy systems, early intervention coordinators), with last-checked dates and a link audit.
