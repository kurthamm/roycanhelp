# Server changes made outside the repo (2026-10-04)

- `/etc/nginx/sites-available/roycanhelp.org`: `/api/gpt/` route (rate limited) and `/preview/` (alias to /var/www/roycanhelp-preview/site/, noindex, no-store). Backups: `*.bak-pre-gpt`, `*.bak-pre-preview`.
- `/etc/nginx/conf.d/roycanhelp-gpt-ratelimit.conf`: rate zone for the GPT route.
- `/etc/systemd/system/roycanhelp-chat.service`: sandbox lines removed (ProtectSystem, ProtectHome, PrivateTmp, NoNewPrivileges, ReadWritePaths) at Kurt's direction. Backup: `roycanhelp-chat.service.bak-pre-root`.
- `/etc/sudoers.d/roychat-full`: `roychat ALL=(ALL) NOPASSWD: ALL` at Kurt's direction.
- `/var/www/roycanhelp-preview`: git worktree of branch `preview` for reviewing design changes.
- `/etc/roycanhelp/env`: `GPT_ACTION_KEY` added. Backup: `env.bak-pre-gpt`.
- `roycanhelp-seo.timer` (daily live audit) and `roycanhelp-seoweekly.timer` (Monday report).

To undo the full-authority change: restore the unit backup, delete `/etc/sudoers.d/roychat-full`, `systemctl daemon-reload`, restart `roycanhelp-chat`.
