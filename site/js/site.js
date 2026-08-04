// Roy Can Help — glossary tooltips + state picker
// Glossary tooltips: <span class="term" data-def="...">word</span>
document.addEventListener('DOMContentLoaded', () => {
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

  // Fetch and populate states
  fetch('data/states.json')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(states => {
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
      msg.textContent = 'Couldn\'t load the state list — refresh, or yell at Roy.';
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

    const services = document.createElement('div');
    services.className = 'state-services';

    const serviceData = [
      { label: state.dd_agency.name, url: state.dd_agency.url },
      { label: state.medicaid.name, url: state.medicaid.url },
      { label: state.ei_program.name, url: state.ei_program.url },
      { label: state.pti_center.name, url: state.pti_center.url }
    ];

    serviceData.forEach(svc => {
      const div = document.createElement('div');
      div.className = 'service';

      const h3 = document.createElement('h3');
      h3.textContent = svc.label;
      div.appendChild(h3);

      const a = document.createElement('a');
      a.href = svc.url;
      a.target = '_blank';
      a.textContent = 'Visit →';
      div.appendChild(a);

      services.appendChild(div);
    });

    wrapper.appendChild(services);
    card.appendChild(wrapper);
  }

  function clearCard() {
    card.innerHTML = '';
  }
});
