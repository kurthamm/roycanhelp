check:
	node --test 'tools/test/*.test.mjs'
	@if [ -d service/test ]; then cd service && npm test; fi
	node tools/check-site.mjs site
	node tools/seo.mjs check site
	node tools/voice-check.mjs site
	node tools/roy-guard.mjs check

# Regenerate site/sitemap.xml from the pages and their git history.
sitemap:
	node tools/seo.mjs sitemap site

# Before merging anyone else's change: does it rewrite or delete text Roy wrote? Usage: make roy-diff BASE=origin/main
roy-diff:
	node tools/roy-guard.mjs diff $(BASE)

# Rebuild the JSON-LD blocks and Wisdom anchors on every page (safe to re-run).
structured:
	node tools/structured-data.mjs site

# Fetch the live site the way a search engine does and report problems.
seo-live:
	node tools/seo.mjs live

.PHONY: check sitemap structured seo-live roy-diff
