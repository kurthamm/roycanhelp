// Site search: reads the pages listed in sitemap.xml, builds a small in-memory index, scores by word matches.
(function () {
  const form = document.getElementById('site-search-form');
  if (!form) return;
  const input = document.getElementById('site-search-input');
  const out = document.getElementById('site-search-results');
  const status = document.getElementById('site-search-status');
  let index = null;

  const skip = new Set(['admin.html', 'terms.html', 'privacy.html', 'disclaimer.html', 'accessibility.html', 'search.html']);
  const words = s => (s.toLowerCase().match(/[a-z0-9]+/g) || []);

  async function load() {
    if (index) return index;
    status.textContent = 'Loading the pages...';
    const xml = await (await fetch('sitemap.xml')).text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname.replace(/^\//, '') || 'index.html')
      .filter(p => p.endsWith('.html') || p === 'index.html').filter(p => !skip.has(p));
    const pages = await Promise.all(urls.map(async p => {
      const res = await fetch(p);
      if (!res.ok) throw new Error('Could not load ' + p);
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const main = doc.querySelector('main');
      const h1 = doc.querySelector('h1');
      return { url: p, title: h1 ? h1.textContent.trim() : p, text: main ? main.textContent.replace(/\s+/g, ' ').trim() : '' };
    }));
    index = pages;
    status.textContent = '';
    return index;
  }

  function score(page, terms) {
    const title = page.title.toLowerCase();
    const body = page.text.toLowerCase();
    let s = 0;
    for (const t of terms) {
      if (title.includes(t)) s += 10;
      const n = body.split(t).length - 1;
      if (!n && !title.includes(t)) return 0;
      s += Math.min(n, 10);
    }
    return s;
  }

  function snippet(page, terms) {
    const lower = page.text.toLowerCase();
    let at = -1;
    for (const t of terms) { const i = lower.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; }
    if (at < 0) return page.text.slice(0, 160);
    const start = Math.max(0, at - 70);
    return (start ? '...' : '') + page.text.slice(start, start + 180) + '...';
  }

  async function run(q) {
    out.innerHTML = '';
    const terms = words(q);
    if (!terms.length) { status.textContent = 'Type a word or two, like "IEP" or "Medicaid denial".'; return; }
    let pages;
    try { pages = await load(); } catch (e) { status.textContent = 'Search could not load the pages. Please refresh and try again.'; return; }
    const hits = pages.map(p => ({ p, s: score(p, terms) })).filter(h => h.s > 0).sort((a, b) => b.s - a.s).slice(0, 12);
    status.textContent = hits.length ? hits.length + ' pages found.' : 'Nothing found for "' + q + '". Try a simpler word, or look at the topics bar above.';
    for (const h of hits) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = h.p.url;
      a.textContent = h.p.title;
      const p = document.createElement('p');
      p.textContent = snippet(h.p, terms);
      li.append(a, p);
      out.appendChild(li);
    }
  }

  form.addEventListener('submit', e => { e.preventDefault(); const q = input.value.trim(); history.replaceState(null, '', q ? '?q=' + encodeURIComponent(q) : location.pathname); run(q); });
  const initial = new URLSearchParams(location.search).get('q');
  if (initial) { input.value = initial; run(initial); }
})();
