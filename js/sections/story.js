import { $$, clamp, on, smooth } from '../core/dom.js';

export function initStory() {
  const root = document.documentElement;
  const header = document.querySelector('#nav');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const phone = matchMedia('(max-width: 719px), (max-width: 960px) and (max-height: 540px)');
  const brand = header?.querySelector('.nav__brand');
  const logo = brand?.querySelector('.nav__logo');
  const nativeTimeline = CSS.supports('animation-timeline', 'scroll(root block)')
    && CSS.supports('animation-range', '0px 1px');
  const chapters = $$('[data-story]').map(scene => {
    const track = document.createElement('div');
    track.className = scene.id === 'hero' ? 'story-track story-track--hero' : 'story-track';
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
  let needsOpeningLayout = true;
  let openingDistance = 0;
  let phoneProgress;
  let phoneVelocity = 0;
  let phoneFrameTime = 0;

  // All opening beats share one progress value, with the copy following the logo.
  const dockEnd = .54;
  const taglineEnd = .76;
  const leadStart = .55;
  const leadEnd = .78;
  const detailStart = .65;

  function followPhoneScroll(target, now, visible) {
    const remaining = target - (phoneProgress ?? target);
    const settled = Math.abs(remaining) < .001 && Math.abs(phoneVelocity) < .025;
    if (!visible || phoneProgress === undefined || settled) {
      phoneProgress = target;
      phoneVelocity = 0;
      phoneFrameTime = 0;
      return phoneProgress;
    }

    // A critically damped response preserves velocity between touch events.
    // Limit the spring's pull so a fling still gives the logo time to dock.
    const dt = phoneFrameTime ? Math.min((now - phoneFrameTime) / 1000, 1 / 30) : 1 / 60;
    const response = 18;
    const gap = clamp(remaining, -.2, .2);
    const velocityTerm = (phoneVelocity - response * gap) * dt;
    const decay = Math.exp(-response * dt);
    const step = gap + (velocityTerm - gap) * decay;
    phoneFrameTime = now;
    phoneVelocity = (phoneVelocity - response * velocityTerm) * decay;
    phoneProgress = clamp(phoneProgress + step, 0, 1);
    if (remaining * (target - phoneProgress) <= 0) {
      phoneProgress = target;
      phoneVelocity = 0;
      phoneFrameTime = 0;
    } else {
      schedule();
    }
    return phoneProgress;
  }

  function layoutOpening(distance, sceneHeight, viewportHeight, mobile) {
    openingDistance = distance;
    if (brand && logo?.offsetWidth) {
      const rect = brand.getBoundingClientRect();
      const width = root.clientWidth;
      const margin = Math.max(18, rect.left);
      const scale = Math.max(1, Math.min(mobile ? 3.16 : 4.4, (width - 2 * margin) / logo.offsetWidth));
      const startX = width / 2 - (rect.left + logo.offsetWidth / 2);
      const startY = Math.min(viewportHeight, sceneHeight) / 2 - (rect.top + rect.height / 2);
      root.style.setProperty('--brand-start-x', startX + 'px');
      root.style.setProperty('--brand-start-y', startY + 'px');
      root.style.setProperty('--brand-start-scale', String(scale));
    }

    if (nativeTimeline && !mobile) {
      const milestones = {
        'brand-dock-end': dockEnd,
        'brand-tag-end': taglineEnd,
        'hero-lead-start': leadStart,
        'hero-lead-end': leadEnd,
        'hero-detail-start': detailStart,
        'hero-detail-end': 1,
      };
      for (const [name, fraction] of Object.entries(milestones)) {
        root.style.setProperty('--' + name, (distance * fraction) + 'px');
      }
    }
  }
  function update(now) {
    frame = 0;
    const height = window.innerHeight;
    const mobile = phone.matches;
    const useNativeTimeline = nativeTimeline && !mobile;
    const still = motion.matches;
    const headerHeight = header?.offsetHeight ?? 0;

    // Read scene and track geometry together, then write animation state.
    const measurements = chapters.map(({ scene, track, copy, aboutVisual }) => {
      const sceneHeight = scene.offsetHeight;
      const hero = scene.id === 'hero';
      const inset = hero ? 0 : headerHeight;
      // Match the hero's small viewport height while the phone toolbar moves.
      const sceneViewport = mobile && hero
        ? parseFloat(getComputedStyle(scene).minHeight) || height
        : height;
      // Allow the mobile About text and full-height plots to enter separately.
      const aboutInFlow = mobile && aboutVisual;
      const fits = !aboutInFlow && sceneViewport >= sceneHeight + inset - 2;
      return {
        scene, track, sceneHeight, sceneViewport, inset,
        top: track.getBoundingClientRect().top,
        travel: track.offsetHeight - sceneHeight,
        copyTop: copy?.getBoundingClientRect().top,
        aboutVisualTop: aboutInFlow ? aboutVisual.getBoundingClientRect().top : null,
        fits,
      };
    });
    if (needsMeasure) {
      needsMeasure = false;
      needsOpeningLayout = true;
      for (const { sceneHeight, track, fits } of measurements) {
        track.style.setProperty('--story-height', sceneHeight + 'px');
        track.classList.toggle('story-track--pinned', fits && !still);
      }
      // The track heights have changed; resolve every chapter against their new positions.
      schedule();
      return;
    }
    for (const { scene, sceneHeight, sceneViewport, top, inset, travel, copyTop, aboutVisualTop } of measurements) {
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
        const distance = pinned ? travel : 128;
        if (needsOpeningLayout || distance !== openingDistance) {
          layoutOpening(distance, sceneHeight, sceneViewport, mobile);
          needsOpeningLayout = false;
        }
        if (useNativeTimeline && !still && root.classList.contains('story-active')) continue;

        const target = clamp(window.scrollY / distance, 0, 1);
        let progress = target;
        if (mobile && !still) {
          progress = followPhoneScroll(target, now, top + sceneHeight + travel > 0);
        } else {
          phoneProgress = undefined;
        }
        root.style.setProperty('--brand-progress', String(still ? 1 : smooth(0, dockEnd, progress)));
        root.style.setProperty('--brand-tagline', String(still ? 1 : smooth(dockEnd, taglineEnd, progress)));
        lead = smooth(leadStart, leadEnd, progress);
        detail = smooth(detailStart, 1, progress);
      }
      if (aboutVisualTop !== null) {
        const visible = height * .92 - aboutVisualTop;
        scene.style.setProperty('--about-visual-opacity', String(still ? 1 : smooth(0, height * .24, visible)));
      }
      scene.style.setProperty('--story-lead', still ? '1' : String(lead));
      scene.style.setProperty('--story-detail', still ? '1' : String(detail));
      scene.classList.toggle('story-detail-ready', still || detail > .5);
    }
    root.classList.add('story-active');
    root.classList.toggle('story-native', useNativeTimeline && !still);
    root.classList.remove('story-pending');
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
