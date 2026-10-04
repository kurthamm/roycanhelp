check:
	node --test 'tools/test/*.test.mjs'
	@if [ -d service/test ]; then cd service && npm test; fi
	node tools/check-site.mjs site
	node tools/seo.mjs check site

# Regenerate site/sitemap.xml from the pages and their git history.
sitemap:
	node tools/seo.mjs sitemap site

# Fetch the live site the way a search engine does and report problems.
seo-live:
	node tools/seo.mjs live

.PHONY: check sitemap seo-live
