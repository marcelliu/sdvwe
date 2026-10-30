// Math, easing, timing and platform helpers shared by Node renderer and browser preview.

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a));
export const TAU = Math.PI * 2;

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  outBack: (t) => {
    const s = 1.70158;
    return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  },
  outBackSoft: (t) => {
    const s = 1.1;
    return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  },
  outElastic: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};

/** Eased progress of t inside [t0, t0+d]. */
export const prog = (t, t0, d, e = ease.outCubic) => e(clamp((t - t0) / Math.max(1e-6, d)));

/** Visibility window: fades in at t0 (din), fades out ending at t1 (dout). */
export const win = (t, t0, t1, din = 0.25, dout = 0.25) => {
  if (t < t0 || t > t1) return 0;
  const a = din > 0 ? ease.outCubic(clamp((t - t0) / din)) : 1;
  const b = dout > 0 ? 1 - ease.inCubic(clamp((t - (t1 - dout)) / dout)) : 1;
  return Math.min(a, b);
};

/** Pop-in scale: overshoot then settle. */
export const pop = (t, t0, d = 0.35) => {
  const p = clamp((t - t0) / d);
  return p <= 0 ? 0 : ease.outBack(p);
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth pseudo-random shake (sum of incommensurate sines). */
export function shake(t, amp, freq = 18, seed = 1) {
  const s = seed * 12.9898;
  const x =
    Math.sin(t * freq * 1.0 + s) * 0.6 + Math.sin(t * freq * 2.31 + s * 1.7) * 0.3 + Math.sin(t * freq * 4.7 + s * 0.3) * 0.1;
  const y =
    Math.sin(t * freq * 1.13 + s * 2.1) * 0.6 + Math.sin(t * freq * 2.7 + s * 0.9) * 0.3 + Math.sin(t * freq * 5.3 + s) * 0.1;
  return { x: x * amp, y: y * amp };
}

// ---- platform (Node canvas vs browser canvas) ----
let platform = null;
export function setPlatform(p) {
  platform = p;
}
export function mkCanvas(w, h) {
  return platform.createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

// ---- per-render cache (blurred backgrounds, layouts, noise tiles) ----
const cache = new Map();
export function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}
export function clearCache() {
  cache.clear();
}

/** Frame geometry for a delivery format. */
export function formatGeom(fmt) {
  if (fmt === '3x4') {
    // Instagram feed 3:4 — almost no UI overlays, small uniform margins.
    const W = 1080, H = 1440;
    const safe = { l: 64, r: 64, t: 72, b: 84 };
    return finishGeom(fmt, W, H, safe, 540, 930);
  }
  // TikTok 9:16 — keep clear of top tabs, right action column and bottom caption/CTA area.
  const W = 1080, H = 1920;
  const safe = { l: 64, r: 150, t: 150, b: 470 };
  return finishGeom(fmt, W, H, safe, 525, 830);
}
function finishGeom(fmt, W, H, safe, cx, maxW) {
  const x0 = safe.l, x1 = W - safe.r, y0 = safe.t, y1 = H - safe.b;
  return { fmt, W, H, safe, box: { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 }, cx, maxW, tall: fmt === '9x16' };
}
