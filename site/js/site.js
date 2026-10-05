// Roy Can Help — glossary tooltips + state picker
// Glossary tooltips: <span class="term" data-def="...">word</span>
document.addEventListener('DOMContentLoaded', () => {
  // Secondary navigation disclosure control (mobile)
  const toggle = document.querySelector('.nav-secondary-toggle');
  const navSecondary = document.getElementById('nav-secondary');

  if (toggle && navSecondary) {
    toggle.addEventListener('click', () => {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', !isExpanded);
      navSecondary.setAttribute('aria-expanded', !isExpanded);
    });

    // Close menu when clicking on a link (for mobile)
    const secondaryLinks = navSecondary.querySelectorAll('a');
    secondaryLinks.forEach(link => {
      link.addEventListener('click', () => {
        toggle.setAttribute('aria-expanded', 'false');
        navSecondary.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Sticky header: check if we should apply sticky styles
  const masthead = document.querySelector('.masthead');
  const navPrimary = document.querySelector('nav.nav-primary');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (masthead && !prefersReduced) {
    const stickyThreshold = masthead.offsetHeight + navPrimary.offsetHeight;

    window.addEventListener('scroll', () => {
      if (window.scrollY > stickyThreshold) {
        masthead.classList.add('sticky-compact');
        navPrimary.classList.add('sticky-compact');
      } else {
        masthead.classList.remove('sticky-compact');
        navPrimary.classList.remove('sticky-compact');
      }
    });
  }

  // Glossary tooltips
  let tooltipCounter = 0;
  for (const el of document.querySelectorAll('.term')) {
    el.setAttribute('tabindex', '0');
    const tip = document.createElement('span');
    tip.className = 'tooltip';
    tip.textContent = el.dataset.def;
    const tooltipId = `tooltip-${++tooltipCounter}`;
    tip.id = tooltipId;
    el.setAttribute('aria-describedby', tooltipId);
    el.append(tip);
    const toggle = (on) => tip.classList.toggle('visible', on);
    el.addEventListener('mouseenter', () => toggle(true));
    el.addEventListener('mouseleave', () => toggle(false));
    el.addEventListener('focus', () => toggle(true));
    el.addEventListener('blur', () => toggle(false));
    el.addEventListener('click', () => tip.classList.toggle('visible'));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        toggle(false);
        el.blur();
      }
    });
  }

  // State picker
  const picker = document.getElementById('state-picker');
  const card = document.getElementById('state-card');
  if (!picker) return;

  let checkedOn = '';
  // Fetch and populate states
  fetch('data/states.json')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      const states = data.states;
      checkedOn = data.checked;
      states.forEach(state => {
        const option = document.createElement('option');
        option.value = state.code;
        option.textContent = state.name;
        picker.appendChild(option);
      });

      // Restore last selection
      const lastState = localStorage.getItem('lastState');
      if (lastState) {
        picker.value = lastState;
        renderState(states.find(s => s.code === lastState));
      }

      // Handle state selection
      picker.addEventListener('change', (e) => {
        const state = states.find(s => s.code === e.target.value);
        if (state) {
          localStorage.setItem('lastState', state.code);
          renderState(state);
        } else {
          clearCard();
        }
      });
    })
    .catch(err => {
      const msg = document.createElement('p');
      msg.textContent = 'The state list did not load. Please refresh the page.';
      msg.style.color = '#c41e3a';
      msg.style.fontWeight = 'bold';
      card.appendChild(msg);
      console.error('State data fetch failed:', err);
    });

  function renderState(state) {
    card.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'state-info';

    const heading = document.createElement('h2');
    heading.textContent = state.name;
    wrapper.appendChild(heading);

    const groups = [
      { title: 'Your rights, in your state\'s own words', keepEmpty: true, blurb: 'Nobody hands you a list of your rights. Every state has to put them in writing, so here is where your state keeps them. If a link below is missing, just ask the school for the Procedural Safeguards Notice. They have to give you one (34 CFR 300.504).', items: [
        state.rights_school && { label: 'School (ages 3 to 21): ' + state.rights_school.name, url: state.rights_school.url, cta: 'Read your rights →' },
        state.rights_ei && { label: 'Early Intervention (birth to 3): ' + state.rights_ei.name, url: state.rights_ei.url, cta: 'Read your rights →' }
      ] },
      { title: 'Free help from other parents and advocates', blurb: '', items: [
        state.parent_center
          ? { label: state.parent_center.name, url: state.parent_center.url, cta: 'Visit →' }
          : { label: 'Your state\'s Parent Training and Information Center', url: 'https://www.parentcenterhub.org/find-your-center/', cta: 'Find yours →' }
      ] },
      { title: 'Programs and services', blurb: '', items: [
        state.medicaid && { label: state.medicaid.name, url: state.medicaid.url, cta: 'Visit →' },
        state.dd_agency && { label: state.dd_agency.name, url: state.dd_agency.url, cta: 'Visit →' }
      ] }
    ];

    groups.forEach(g => {
      const items = g.items.filter(Boolean);
      if (!items.length && !g.keepEmpty) return;
      const section = document.createElement('section');
      section.className = 'state-group';
      const h3 = document.createElement('h3');
      h3.textContent = g.title;
      section.appendChild(h3);
      if (g.blurb) {
        const p = document.createElement('p');
        p.textContent = g.blurb;
        section.appendChild(p);
      }
      const services = document.createElement('div');
      services.className = 'state-services';
      items.forEach(svc => {
        const div = document.createElement('div');
        div.className = 'service';
        const t = document.createElement('p');
        t.className = 'service-name';
        t.textContent = svc.label;
        div.appendChild(t);
        const a = document.createElement('a');
        a.href = svc.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = svc.cta;
        div.appendChild(a);
        services.appendChild(div);
      });
      if (items.length) section.appendChild(services);
      wrapper.appendChild(section);
    });

    if (checkedOn) {
      const stamp = document.createElement('p');
      stamp.className = 'last-checked';
      stamp.textContent = 'Links last checked: ' + checkedOn + '.';
      wrapper.appendChild(stamp);
    }
    card.appendChild(wrapper);
  }

  function clearCard() {
    card.innerHTML = '';
  }
});


// Build an on-this-page index from the article's section headings (wide screens only).
document.addEventListener('DOMContentLoaded', () => {
  const main = document.getElementById('main');
  const article = main && main.querySelector('article');
  if (!main || !article) return;
  const headings = [...article.querySelectorAll('h2')].filter(h => h.textContent.trim());
  if (headings.length < 3) return;

  const toc = document.createElement('nav');
  toc.className = 'page-toc';
  toc.setAttribute('aria-label', 'On this page');
  const title = document.createElement('h2');
  title.textContent = 'On this page';
  const list = document.createElement('ol');
  headings.forEach((h, i) => {
    if (!h.id) h.id = 'section-' + (i + 1);
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent.trim();
    li.append(a);
    list.append(li);
  });
  toc.append(title, list);
  main.prepend(toc);

  const links = [...list.querySelectorAll('a')];
  const spy = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(l => l.classList.toggle('is-current', l.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  headings.forEach(h => spy.observe(h));
});

// Copy buttons for the ready-to-send letters
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.letter').forEach(box => {
    if (!navigator.clipboard) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-letter';
    btn.textContent = 'Copy this letter';
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(box.innerText.trim()).then(
        () => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy this letter'; }, 2000); },
        () => { btn.textContent = 'Could not copy. Select the text instead.'; }
      );
    });
    box.after(btn);
  });
});
