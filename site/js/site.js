// Roy Can Help — glossary tooltips
// Glossary tooltips: <span class="term" data-def="...">word</span>
document.addEventListener('DOMContentLoaded', () => {
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
});
