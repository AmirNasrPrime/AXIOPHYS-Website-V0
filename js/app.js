/* ============================================================================
   PRIME-CAE · application entry
   Five moments, five modules. Every one is initialised behind a guard, so one
   failure cannot take the page down with it.
   ========================================================================== */
import { initReveal, initMagnetic, initRanges } from './core/motion.js';
import { initHeroSequence } from './hero/sequence.js';
import { initStory } from './sections/story.js';
import { initNav } from './sections/nav.js';
import { initAbout } from './sections/about.js';
import { initLayer } from './sections/layer.js';
import { initProducts } from './sections/products.js';
import { initAccess } from './sections/access.js';
import { initContactAtom } from './sections/contact-atom.js';

const failed = [];
function safeInit(name, fn) {
  try { fn(); }
  catch (err) { failed.push(name); console.error(`[prime] ${name} failed to initialise`, err); }
}

function boot() {
  safeInit('hero', initHeroSequence);      /* starts the hero film */
  safeInit('story', initStory);
  safeInit('nav', initNav);
  safeInit('reveal', initReveal);
  safeInit('ranges', initRanges);
  safeInit('magnetic', initMagnetic);

  safeInit('about', initAbout);
  safeInit('layer', initLayer);
  safeInit('products', initProducts);
  safeInit('contact', initAccess);
  safeInit('contact atom', initContactAtom);

  document.documentElement.classList.add('prime-ready');
  if (failed.length) console.warn('[prime] degraded sections:', failed.join(', '));
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', boot)
  : boot();
