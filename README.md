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
make check     # canonical verification: tools tests + service tests + site checker + SEO rules
make sitemap   # regenerate site/sitemap.xml from the pages and git history
make seo-live  # fetch the live site like a search engine and report problems
```

## SEO

`tools/seo.mjs` enforces the SEO rules on every page: one H1, a title of at most 65 characters, a 70 to 160 character meta description, a canonical URL that matches the page, `og:image`, image alt text, valid JSON-LD, and a sitemap that lists exactly the indexable pages. `make check` runs it. `deploy/roycanhelp-seo.timer` runs the live audit daily (status codes, response time, www and http redirects, `/admin/` noindex) and logs to `/var/log/roycanhelp/seo.log`; a failing audit shows as a failed unit.

## Production (DigitalOcean droplet, alongside mediprimer)

- Live clone: `/var/www/roycanhelp` (owned by `roychat`; nginx root is its `site/`)
- Service: `roycanhelp-chat.service` (127.0.0.1:8791; env in `/etc/roycanhelp/env`)
- nginx: `/etc/nginx/sites-available/roycanhelp.org` (roycanhelp.com and
  disabilitiessupport.org 301 → roycanhelp.org)
- fail2ban jail `rchat`; nightly bundle backups in `/var/backups/roycanhelp`
- **The live clone is the source of truth once Roy starts editing** — pull
  from it before developing here.

GitHub (private): https://github.com/kurthamm/roycanhelp
