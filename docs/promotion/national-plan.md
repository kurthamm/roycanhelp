# Making roycanhelp.org national, easier for Roy, and bigger

## Finding that shapes everything (2026-10-04)
Only the Wisdom page is heavily South Carolina (26 mentions). The other pages are mostly federal law, which is already national. The site is not SC-specific, it is framed that way. The real gap is state coverage: `site/data/states.json` drives a dropdown on one page (one URL), and it is not trustworthy:
- 83 of 204 links did not resolve when checked (some are bot-blocked 403s, many are dead domains).
- In 15 of 51 states the developmental disabilities agency, Medicaid and early intervention entries are the same generic URL.
- 9 states list a Protection and Advocacy agency where the Parent Training and Information center belongs (for example AL, AR, FL, HI, ID, MN, MT, NE, PA).
A site whose promise is "specs beat opinions" cannot ship that. Fix before scaling.

## Plan
1. Rebuild the state data from the official directories only: Part C lead agencies (ECTA Center), Parent Training and Information centers (Center for Parent Information and Resources), Protection and Advocacy systems (NDRN), developmental disabilities councils (ACL), state special education offices (Dept. of Education IDEA contacts), Medicaid waiver pages (medicaid.gov), state ABLE programs (ABLE National Resource Center). Each record carries source URL and last-checked date. A link and label audit runs in the daily live audit.
2. One page per state (51 URLs): "[State] early intervention, IEP rights, Medicaid waivers and benefits for children with disabilities". Federal rights summary linked to Roy's federal pages, then the verified state contacts, then a "last checked" date. Roy's South Carolina material becomes "one family's example" and links from the SC page. This is what captures state-specific searches.
3. Reframe titles, H1s and descriptions of the federal pages as national. Keep Roy's story and voice; label South Carolina specifics as such (the about page already does).
4. Build once, refresh yearly: a script regenerates state pages from the data; the editor can rerun it.
5. Traffic assets that other sites link to: a "denial letter" template citing the rule, a 60-day evaluation clock explainer, an IEP meeting checklist, a printable "what the school must tell you in writing" card. Each is a page plus a PDF.
6. Allies: national organizations (Autism Society of America, The Arc, NDRN, Parent Center Hub) and each state's PTI and P&A, once the state pages exist, because the state page is a natural thing for them to link to.

## Making it easy for Roy
- Parents' questions arrive pre-drafted and verified, so he approves instead of writing.
- He can forward any real parent message into his chat ("a parent asked me this: ...") and it becomes a question and answer.
- Everything is one chat in his ChatGPT. Direct instructions run immediately.
- Weekly, the editor offers the next three drafted answers at once so he can say "yes to all" or edit one.
