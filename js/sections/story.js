import { $$, clamp, on, smooth } from '../core/dom.js';

export function initStory() {
  const root = document.documentElement;
  const header = document.querySelector('#nav');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const phone = matchMedia('(max-width: 719px), (max-width: 960px) and (max-height: 540px)');
  const chapters = $$('[data-story]').map(scene => {
    const track = document.createElement('div');
    track.className = 'story-track';
    scene.before(track);
    track.append(scene);
    return {
      scene, track,
      copy: scene.querySelector('.story-copy'),
      aboutVisual: scene.querySelector('.about__fig'),
    };
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
    const measurements = chapters.map(({ scene, track, copy, aboutVisual }) => {
      const sceneHeight = scene.offsetHeight;
      // Allow the mobile About text and full-height plots to enter separately.
      const aboutInFlow = mobile && aboutVisual;
      const fits = !aboutInFlow && height >= sceneHeight + headerHeight - 2;
      return {
        scene, track, sceneHeight,
        top: track.getBoundingClientRect().top,
        travel: track.offsetHeight - sceneHeight,
        copyTop: copy?.getBoundingClientRect().top,
        aboutVisualTop: aboutInFlow ? aboutVisual.getBoundingClientRect().top : null,
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
    for (const { scene, top, travel, copyTop, aboutVisualTop } of measurements) {
      const pinned = travel > 0;
      const entered = pinned
        ? clamp((headerHeight - top) / travel, 0, 1)
        : clamp((height * .95 - copyTop) / (height * .36), 0, 1);
      const lead = smooth(.08, .46, entered);
      // Complete the copy at the sticky release. In normal flow, finish sooner
      // so the paragraph is readable as it reaches the middle of the screen.
      const detail = smooth(.26, pinned ? 1 : .67, entered);
      if (aboutVisualTop !== null) {
        const visible = height * .92 - aboutVisualTop;
        scene.style.setProperty('--about-visual-opacity', String(still ? 1 : smooth(0, height * .24, visible)));
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
