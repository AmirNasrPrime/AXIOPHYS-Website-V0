import { $$, clamp, on, smooth } from '../core/dom.js';

export function initStory() {
  const root = document.documentElement;
  const header = document.querySelector('#nav');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const phone = matchMedia('(max-width: 719px)');
  const chapters = $$('[data-story]').map(scene => {
    const track = document.createElement('div');
    track.className = scene.id === 'hero' ? 'story-track story-track--hero' : 'story-track';
    scene.before(track);
    track.append(scene);
    return { scene, track, copy: scene.querySelector('.story-copy') };
  });
  if (!chapters.length) return;

  let frame = 0;
  let needsMeasure = true;
  function update() {
    frame = 0;
    const height = window.innerHeight;
    const mobile = phone.matches;
    const still = motion.matches;
    const headerHeight = header?.offsetHeight ?? 0;

    // Read scene and track geometry together, then write animation state.
    const measurements = chapters.map(({ scene, track, copy }) => {
      const sceneHeight = scene.offsetHeight;
      const inset = scene.id === 'hero' ? 0 : headerHeight;
      const fits = height >= sceneHeight + inset - 2;
      return {
        scene, track, sceneHeight, inset,
        top: track.getBoundingClientRect().top,
        travel: track.offsetHeight - sceneHeight,
        copyTop: copy?.getBoundingClientRect().top,
        fits,
      };
    });
    if (needsMeasure) {
      needsMeasure = false;
      for (const { sceneHeight, track, fits } of measurements) {
        track.style.setProperty('--story-height', sceneHeight + 'px');
        track.classList.toggle('story-track--pinned', fits && !still);
      }
      // The track heights have changed; resolve every chapter against their new positions.
      schedule();
      return;
    }
    for (const { scene, top, inset, travel, copyTop } of measurements) {
      const hero = scene.id === 'hero';
      const pinned = travel > 0;
      const entered = pinned
        ? clamp((inset - top) / travel, 0, 1)
        : clamp((height * .95 - copyTop) / (height * .36), 0, 1);
      let lead = smooth(.08, .46, entered);
      // Complete the copy at the sticky release. In normal flow, finish sooner
      // so the paragraph is readable as it reaches the middle of the screen.
      let detail = smooth(.26, pinned ? 1 : .67, entered);
      if (hero) {
        const y = Math.max(window.scrollY, 0);
        const p = clamp(y / (pinned ? travel : 180), 0, 1);
        // Give the desktop logo most of the opening scroll before the copy enters.
        const brand = mobile ? Number(y > 0) : smooth(0, .58, p);
        root.style.setProperty('--brand-progress', still ? '1' : String(brand));
        root.classList.toggle('story-hero-open', y > 0);
        lead = mobile ? brand * (.68 + .32 * smooth(0, .58, p)) : smooth(.59, .8, p);
        detail = mobile ? brand * (.56 + .44 * smooth(.12, 1, p)) : smooth(.71, 1, p);
      }
      scene.style.setProperty('--story-lead', still ? '1' : String(lead));
      scene.style.setProperty('--story-detail', still ? '1' : String(detail));
      scene.classList.toggle('story-detail-ready', still || detail > .5);
    }
    root.classList.add('story-active');
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  function measure() {
    needsMeasure = true;
    schedule();
  }

  if ('ResizeObserver' in window) {
    const resize = new ResizeObserver(measure);
    chapters.forEach(({ scene }) => resize.observe(scene));
  }
  on(window, 'resize', measure);
  on(window, 'scroll', schedule, { passive: true });
  on(window, 'pageshow', measure);
  on(motion, 'change', measure);
  measure();
}
