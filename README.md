# roycanhelp.org

Roy's sardonic, first-person field guide for parents of children with
disabilities — Down syndrome, autism, or anything else that might qualify a
child for federal, state, or local services. Framed as the journey Roy's
family actually took: diagnosis → Early Intervention → school & IEPs →
paying for care → therapies → turning 18, plus Roy's Lessons Learned, a
50-state directory, and a plain-English glossary.

Roy (non-technical) edits the entire site through a password-gated chat at
`/admin/` (linked in every footer): he types plain English, a Claude agent
edits the live files, every change auto-commits, and an Undo button reverts
the last change. He can also upload images and documents.

## Layout

- `site/` — the static website (no build step; nginx serves this directly)
- `service/` — the chat editor (Node/Express + Claude Agent SDK)
- `tools/` — `check-site.mjs` link/HTML/JS checker
- `docs/superpowers/` — design spec and implementation plan

## Commands

```sh
make check   # canonical verification: tools tests + service tests + site checker
```

## Production (DigitalOcean droplet, alongside mediprimer)

- Live clone: `/var/www/roycanhelp` (owned by `roychat`; nginx root is its `site/`)
- Service: `roycanhelp-chat.service` (127.0.0.1:8791; env in `/etc/roycanhelp/env`)
- nginx: `/etc/nginx/sites-available/roycanhelp.org` (roycanhelp.com and
  disabilitiessupport.org 301 → roycanhelp.org)
- fail2ban jail `rchat`; nightly bundle backups in `/var/backups/roycanhelp`
- **The live clone is the source of truth once Roy starts editing** — pull
  from it before developing here.

GitHub (private): https://github.com/kurthamm/roycanhelp
