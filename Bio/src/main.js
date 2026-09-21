import { startFluid } from './fluid.js';

const nav = document.querySelector('.site-nav');
const canvas = document.getElementById('flow-canvas');
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
window.addEventListener('pageshow', queueNavUpdate);
updateNav();

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
