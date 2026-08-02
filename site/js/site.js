// Roy Can Help — glossary tooltips + state picker
// Glossary tooltips: <span class="term" data-def="...">word</span>
document.addEventListener('DOMContentLoaded', () => {
  // Glossary tooltips
  for (const el of document.querySelectorAll('.term')) {
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    const tip = document.createElement('span');
    tip.className = 'tooltip';
    tip.textContent = el.dataset.def;
    el.append(tip);
    const toggle = (on) => tip.classList.toggle('visible', on);
    el.addEventListener('mouseenter', () => toggle(true));
    el.addEventListener('mouseleave', () => toggle(false));
    el.addEventListener('focus', () => toggle(true));
    el.addEventListener('blur', () => toggle(false));
    el.addEventListener('click', () => tip.classList.toggle('visible'));
  }

  // State picker
  const picker = document.getElementById('state-picker');
  const card = document.getElementById('state-card');
  if (!picker) return;

  // Fetch and populate states
  fetch('data/states.json')
    .then(response => response.json())
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
          card.innerHTML = '';
        }
      });
    });

  function renderState(state) {
    const html = `
      <div class="state-info">
        <h2>${state.name}</h2>
        <div class="state-services">
          <div class="service">
            <h3>${state.dd_agency.name}</h3>
            <a href="${state.dd_agency.url}" target="_blank">Visit →</a>
          </div>
          <div class="service">
            <h3>${state.medicaid.name}</h3>
            <a href="${state.medicaid.url}" target="_blank">Visit →</a>
          </div>
          <div class="service">
            <h3>${state.ei_program.name}</h3>
            <a href="${state.ei_program.url}" target="_blank">Visit →</a>
          </div>
          <div class="service">
            <h3>${state.pti_center.name}</h3>
            <a href="${state.pti_center.url}" target="_blank">Visit →</a>
          </div>
        </div>
      </div>
    `;
    card.innerHTML = html;
  }
});
