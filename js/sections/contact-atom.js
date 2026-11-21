import { $, clamp, reduced, rng } from '../core/dom.js';
import { fitCanvas, sceneLoop } from '../core/canvas.js';

const ATOM_TURN = Math.PI * 2;

export function initContactAtom() {
  const canvas = $('#contactAtom');
  if (!canvas) return;
  const { ctx, size } = fitCanvas(canvas, 1.75);
  if (!ctx) return;

  // Three views of tilted circular paths around the same center. This is a
  // stylized atom emblem, not a model of electron trajectories.
  const planes = [
    { tilt: -.25, pitch: 1.17, speed: .94, phase: .23, ink: '51,211,246' },
    { tilt: 1.00, pitch: 1.10, speed: -.78, phase: 3.63, ink: '123,171,255' },
    { tilt: -1.04, pitch: 1.08, speed: .67, phase: 2.55, ink: '162,237,255' },
  ].map(plane => ({
    ...plane,
    c: Math.cos(plane.tilt),
    s: Math.sin(plane.tilt),
    compression: Math.cos(plane.pitch),
    depth: Math.sin(plane.pitch),
  }));
  const random = rng(3407);
  const specks = Array.from({ length: 90 }, () => ({
    x: random(), y: random(), alpha: .05 + random() ** 3 * .16,
  }));

  const backdrop = document.createElement('canvas');
  const background = backdrop.getContext('2d');
  let cache = '';
  let elapsed = 0;
  let lastFrame = 0;

  function point(plane, angle, cx, cy, radius) {
    const x = Math.cos(angle);
    const sin = Math.sin(angle);
    const y = sin * plane.compression;
    const z = sin * plane.depth;
    const perspective = 1 + .12 * z;
    return {
      x: cx + (x * plane.c - y * plane.s) * radius * 1.23 * perspective,
      y: cy + (x * plane.s + y * plane.c) * radius * perspective,
      z,
    };
  }

  function paintBackdrop(w, h, dpr, cx, cy, radius) {
    backdrop.width = Math.round(w * dpr);
    backdrop.height = Math.round(h * dpr);
    background.setTransform(dpr, 0, 0, dpr, 0, 0);

    const dark = background.createLinearGradient(0, 0, w, h);
    dark.addColorStop(0, '#050e20');
    dark.addColorStop(.58, '#0a1c34');
    dark.addColorStop(1, '#040a17');
    background.fillStyle = dark;
    background.fillRect(0, 0, w, h);
    const light = background.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.36);
    light.addColorStop(0, 'rgba(32,170,222,.28)');
    light.addColorStop(.28, 'rgba(26,121,201,.12)');
    light.addColorStop(1, 'rgba(11,53,105,0)');
    background.fillStyle = light;
    background.fillRect(0, 0, w, h);

    for (const speck of specks) {
      background.fillStyle = `rgba(151,211,241,${speck.alpha})`;
      background.fillRect(speck.x * w, speck.y * h, .9, .9);
    }

    // Lighter foreground arcs give each plane depth without a heavy grid.
    for (const plane of planes) {
      for (const half of [1, 0]) {
        background.strokeStyle = `rgba(${plane.ink},${half ? .16 : .36})`;
        background.lineWidth = half ? .72 : 1;
        background.beginPath();
        for (let i = 0; i <= 64; i++) {
          const p = point(plane, (half + i / 64) * Math.PI, cx, cy, radius);
          if (i) background.lineTo(p.x, p.y);
          else background.moveTo(p.x, p.y);
        }
        background.stroke();
      }
    }
  }

  function paintElectron(plane, angle, cx, cy, radius) {
    const tip = point(plane, angle, cx, cy, radius);
    const depth = (tip.z + 1) * .5;
    const direction = Math.sign(plane.speed);
    ctx.lineCap = 'round';
    const segments = 22;
    let start = point(plane, angle - direction * .88, cx, cy, radius);
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const end = point(plane, angle - direction * .88 * (1 - t), cx, cy, radius);
      ctx.strokeStyle = `rgba(${plane.ink},${t * t * (.48 + depth * .35)})`;
      ctx.lineWidth = .7 + t * (1 + depth * .7);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      start = end;
    }

    const size = clamp(radius * .027, 2.4, 4.7) * (.77 + depth * .23);
    const haloSize = size * 4;
    const halo = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, haloSize);
    halo.addColorStop(0, `rgba(${plane.ink},.74)`);
    halo.addColorStop(.35, `rgba(${plane.ink},.24)`);
    halo.addColorStop(1, `rgba(${plane.ink},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, haloSize, 0, ATOM_TURN);
    ctx.fill();
    ctx.fillStyle = '#e9fcff';
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, size, 0, ATOM_TURN);
    ctx.fill();
  }

  const view = sceneLoop(canvas, now => {
    const { w, h, dpr } = size;
    if (!w || !h) return;
    if (lastFrame) elapsed += clamp(now - lastFrame, 0, .065);
    lastFrame = now;
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w * .35, h * .426);
    const key = `${w}:${h}:${dpr}`;
    if (key !== cache) {
      paintBackdrop(w, h, dpr, cx, cy, radius);
      cache = key;
    }
    ctx.drawImage(backdrop, 0, 0, w, h);

    const time = reduced() ? 0 : Math.min(elapsed, 4.8);
    const electrons = planes.map(plane => {
      const angle = plane.phase + plane.speed * time;
      return { plane, angle, depth: Math.sin(angle) * plane.depth };
    }).sort((a, b) => a.depth - b.depth);
    for (const { plane, angle } of electrons) paintElectron(plane, angle, cx, cy, radius);
    if (elapsed >= 4.8) view.halt();
  }, { fps: 30 });
}
