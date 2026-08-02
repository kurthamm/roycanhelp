check:
	node --test tools/test/
	@if [ -d service/test ]; then cd service && npm test; fi
	node tools/check-site.mjs site
.PHONY: check
