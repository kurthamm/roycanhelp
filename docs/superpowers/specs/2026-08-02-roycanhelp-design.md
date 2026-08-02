# roycanhelp.org — Design Spec

**Date:** 2026-08-02
**Owners:** Roy (site owner/editor), Kurt (infrastructure)
**Status:** Draft for review

## What this is

Roy's personal website for parents of children with disabilities — Down
syndrome, autism, or any condition that might qualify a child for federal,
state, or local services. Roy's son has autism; Kurt's daughter has Down
syndrome. The site is Roy talking directly to visiting parents in the first
person: "I've been through this, here's what I learned the hard way."

Roy is non-technical. He edits and reshapes the entire site — content, pages,
layout, anything — through a password-protected chat interface where he types
plain English. Changes go live immediately.

## Voice and personality

- **First person, personal.** Roy speaking to the reader as a fellow parent,
  drawing on his own experience raising his son. Not an anonymous nonprofit.
- **Ironic and sardonic, Mad Magazine DNA.** The weary parent who has filled
  out the same 40-page packet four times and decided laughing is cheaper than
  screaming. Bold headlines, editorial-cartoon energy, margin-gag sidebars.
  Example register: "Turning 18: Congratulations, the State Now Thinks Your
  Child Is a Stranger."
- **Satire punches up only** — at bureaucracies, waitlists, insurance denials,
  and acronym soup. Never at kids, families, or disability itself.
- **Accurate underneath.** Every joke sits on top of real, correct, useful
  information: eligibility rules, deadlines, phone numbers, links. Humor is
  the sugar; the medicine is real. No medical or legal advice — information
  and pointers only.
- Roy can change the voice itself at any time via chat; the agent treats these
  rules as defaults, not law.

## Site content and structure

Static site modeled structurally on mediprimer (`~/mediprimer/`), organized
around the parent's situation, not the agency org chart:

- **Situation guides:** "We just got a diagnosis" → Early Intervention
  (birth–3) → Starting school (IEPs & 504s) → Paying for care (SSI, Medicaid
  waivers, ABLE accounts) → Therapies & services → Turning 18 (guardianship,
  adult services).
- **"Does my child qualify?"** — eligibility is a first-class topic per
  program (IDEA, SSI, Medicaid waivers, EPSDT), because many parents don't
  know their child qualifies.
- **State-by-state directory** — DD agencies, Medicaid waiver programs, Parent
  Training & Information centers, driven by `data/states.json` (mediprimer
  pattern). National scope, all 50 states + DC.
- **Glossary** with hover/tap tooltips — sardonic definitions with the real
  meaning underneath (IEP, LRE, waiver, EPSDT, prior authorization…).
- **Depth on Down syndrome and autism** specifically, written to serve any
  qualifying disability.

Kurt seeds the full skeleton and starter content in Roy's voice; Roy reshapes
everything from there via chat.

### Site tech

- Static HTML/CSS/JS in a git repository on the droplet; nginx serves the
  working tree directly. **No build pipeline** — every page is a
  self-contained file the chat agent can edit and have live instantly.
- Shared look via one stylesheet + one small JS file (nav, glossary
  tooltips). Consistency enforced by the agent's system prompt plus a
  lightweight `make check` (HTML validity, internal links, JS syntax) the
  agent runs after every edit.

## Roy's chat service

- **URL:** `https://roycanhelp.org/<unadvertised-path>/` — single
  chat page, `X-Robots-Tag: noindex, nofollow`, not linked or in the sitemap.
- **Auth:** one shared password over HTTPS; session cookie after login.
- **Backend:** small Node service (systemd unit, listens on 127.0.0.1,
  proxied by nginx) wrapping the **Claude Agent SDK**. Each Roy message runs
  an agent session with Read/Edit/Write/Glob/Grep plus whitelisted Bash
  (`make check`, `git ...`), filesystem-scoped to the site repo only.
- **System prompt** encodes the site as Roy's: his first-person voice, the
  punch-up rule, plain-English replies ("Done — I added a respite-care
  section to the Paying-for-Care page: [link]"), never diffs or code unless
  asked.
- **Sessions:** streaming responses; chat history persists so Roy can say
  "actually, make that shorter."
- **Publishing:** nginx serves the repo working tree, so a saved file is
  live immediately. The service auto-commits after each completed request
  with a message describing the change.
- **Billing:** Kurt's Anthropic API key; per-request token usage logged.

## Safety and rollback

- Every change is a git commit → **Undo button** in the chat UI reverts the
  last commit.
- If `make check` fails after an edit, the agent must fix it before
  finishing — Roy never publishes a broken page.
- Nightly `git bundle` backup copied outside the repo.
- Kurt's audit trail is `git log` and the chat history (no notifications by
  default).

## Infrastructure and security

- **Host:** existing DigitalOcean droplet (Civitae-Server, 165.245.140.51),
  alongside mediprimer.
- **DNS:** Cloudflare zone `roycanhelp.org` (already active, zero
  records). A record → 165.245.140.51, **grey-cloud/DNS-only** so
  fail2ban/GeoIP see real client IPs. Kurt approves record creation before it
  is made.
- **TLS:** Let's Encrypt via certbot.
- **nginx vhost:** serves the site at `/`, proxies the chat path to the Node
  service; security headers server-wide.
- **Chat hardening:** rate-limited login endpoint (nginx `limit_req`) and a
  fail2ban jail on repeated failed logins (same recipe as the Guacamole
  jail).

## Out of scope (v1)

- User accounts, comments, newsletters, analytics beyond basic logs.
- Plan/provider recommendations, medical or legal advice.
- Multi-editor support (one shared password; per-user accounts later if
  needed).
- Build pipeline / SEO tooling ports from mediprimer (revisit after launch).

## Success criteria

- Roy, with only a URL and a password, can add a page, rewrite a section,
  and change the site's look — each live within a minute of asking, in his
  voice, with no broken pages.
- A parent landing on the site can find their situation, learn whether their
  child might qualify for a program, and reach their state's agencies —
  and laugh at least once on the way.
- Kurt can revert any change with one command (or Roy with one button).
