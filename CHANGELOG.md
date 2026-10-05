# Changelog

## 2026-10-05 — The Fine Print series, South Carolina depth, search and discovery

- **Fine Print explainers (27 pages)**: school, Early Intervention, evaluation, behavior, Medicaid, SSI, ABLE, turning 18 and 26, three traps, a timeline (birth to 26), eleven ready-to-send letters. Every quoted rule is copied word for word from the regulation and machine-checked before the page is written (`tools/ecfr_text.py`, per-page scripts); agent-reported "verified" flags are never trusted. Each page opens with an "In short" answer and is written in Roy's voice (`docs/roy/voice.md`, `tools/voice_guard.py`).
- **South Carolina set (13 pages)**: state law, SCDHHS Medicaid and waivers, BabyNet, SCDE disputes, waiver waitlists, ABA and Medicaid, school records destruction, the scholarship trade-off, Medicaid at 18 and 19, diplomas and transition at 13, respite. Built from the problems South Carolina parents raise most in public threads, then verified at official sources.
- **Your State page**: parent rights notices and parent centers for most states (school notice 43, Early Intervention 34, parent center 36 of 51), every link scraped and reviewed by hand (`tools/state_gap_fill.py`, `tools/check_state_links.py`); "Five Questions to Ask Your State".
- **Search and discovery**: site search (reads the sitemap), homepage links to every explainer, `llms.txt`, IndexNow notifier (`tools/indexnow.py`), weekly rank scoreboard and AI-signal audit in the weekly report.
- **Research tooling**: Firecrawl (`tools/fc.py`), public Reddit text via PullPush/Firecrawl search (`tools/reddit_*.py`, no usernames, raw data gitignored). Mediprimer review: `docs/mediprimer-lessons.md`.
- **Fix**: generated pages' Contact links pointed at themselves; corrected everywhere.

## 2026-08-02 — Initial build and launch

- Static site seeded in Roy's voice: journey timeline homepage, six situation
  guides (diagnosis → turning 18), Roy's Lessons Learned, "Does My Child
  Qualify?", 50-state + DC directory, 40-term glossary, About.
- Chat editor service at `/admin/`: shared password, SSE streaming, Claude
  Agent SDK backend, auto-commit per change, single-level Undo, image and
  document uploads, per-request token usage logging.
- Deployed to the droplet: `roychat` user, systemd, nginx + Let's Encrypt,
  DNS for roycanhelp.org / roycanhelp.com / disabilitiessupport.org (the
  latter two redirect), fail2ban jail, nightly git-bundle backups.
