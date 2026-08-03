# Changelog

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
