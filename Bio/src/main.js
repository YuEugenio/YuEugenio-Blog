import { startFluid } from './fluid.js?v=20260922-1';

const pageAddress = location.pathname + location.search;
const nav = document.querySelector('.site-nav');
const canvas = document.getElementById('flow-canvas');
const backToTop = document.querySelector('.back-to-top');
const links = [...nav.querySelectorAll('a[href^="#"]')];
const sections = links.map(link => document.querySelector(link.getAttribute('href')));
let navFrame = 0;
const updateNav = () => {
  navFrame = 0;
  nav.classList.toggle('scrolled', window.scrollY > 80);
  const fade = Math.min(1, Math.max(0, window.scrollY / (innerHeight * .4)));
  canvas.style.setProperty('--fallback-brightness', 1 - .82 * fade * fade * (3 - 2 * fade));
  let active = -1;
  sections.forEach((section, index) => {
    if (section && section.getBoundingClientRect().top <= window.innerHeight * .35) active = index;
  });
  links.forEach((link, index) => {
    link.classList.toggle('active', index === active);
    if (index === active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
};
const queueNavUpdate = () => {
  if (!navFrame) navFrame = requestAnimationFrame(updateNav);
};
window.addEventListener('scroll', queueNavUpdate, { passive: true });
window.addEventListener('resize', queueNavUpdate);
updateNav();

const clearFragment = () => {
  if (location.hash) history.replaceState(null, '', pageAddress);
};
const scrollToTarget = target => {
  clearFragment();
  target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
};
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', event => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    scrollToTarget(target);
  });
});
backToTop.addEventListener('click', () => {
  clearFragment();
  window.scrollTo({ top: 0, left: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});
const resetToTop = () => {
  clearFragment();
  window.scrollTo(0, 0);
  queueNavUpdate();
};
window.addEventListener('pageshow', () => requestAnimationFrame(resetToTop));
window.addEventListener('pagehide', () => window.scrollTo(0, 0));
requestAnimationFrame(resetToTop);

const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  }
}, { threshold: .15 });
document.querySelectorAll('.reveal').forEach(element => observer.observe(element));

startFluid(canvas).catch(error => {
  canvas.dataset.renderer = 'fallback';
  console.warn('[BioYu]', error.message);
});
