// Core DSP primitives: PRNG, notes, buffers, envelopes, oscillators, filters, noise.
// Everything is mono Float32Array or stereo [L, R] at SR.
export const SR = 48000;
export const TAU = 2 * Math.PI;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed = 1) { this.f = mulberry32(seed); }
  next() { return this.f(); }
  bi() { return this.f() * 2 - 1; }
  range(a, b) { return a + (b - a) * this.f(); }
  int(a, b) { return a + Math.floor(this.f() * (b - a + 1)); }
  chance(p) { return this.f() < p; }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  gauss() { const u = 1 - this.f(), v = this.f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
}

export const db = (d) => Math.pow(10, d / 20);
export const toDb = (g) => 20 * Math.log10(Math.max(Math.abs(g), 1e-12));
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const S = (sec) => Math.round(sec * SR);

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'C#4' -> 61 (numbers pass through) */
export function nm(x) {
  if (typeof x === 'number') return x;
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(x);
  if (!m) throw new Error(`bad note ${x}`);
  return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
export const nf = (x) => mtof(nm(x));

export const mono = (n) => new Float32Array(Math.max(0, Math.ceil(n)));
export const stereo = (n) => [mono(n), mono(n)];
export const copyStereo = (b) => [Float32Array.from(b[0]), Float32Array.from(b[1])];

/** Equal-power pan gains, normalised so pan=0 gives unity per channel. */
export function panGains(pan) {
  const th = (clamp(pan, -1, 1) + 1) * Math.PI / 4;
  return [Math.cos(th) * Math.SQRT2, Math.sin(th) * Math.SQRT2];
}

export function mixMono(bus, sig, off, gain = 1, pan = 0) {
  const [gl, gr] = panGains(pan);
  const L = bus[0], R = bus[1], a = gain * gl, b = gain * gr;
  const s0 = Math.max(0, -off), s1 = Math.min(sig.length, L.length - off);
  for (let i = s0; i < s1; i++) { const v = sig[i]; L[off + i] += v * a; R[off + i] += v * b; }
}

export function mixStereo(bus, sig, off, gain = 1) {
  const s0 = Math.max(0, -off);
  for (let c = 0; c < 2; c++) {
    const d = bus[c], s = sig[c], s1 = Math.min(s.length, d.length - off);
    for (let i = s0; i < s1; i++) d[off + i] += s[i] * gain;
  }
}

export function addBus(dst, src, gain = 1) {
  for (let c = 0; c < 2; c++) {
    const d = dst[c], s = src[c], n = Math.min(d.length, s.length);
    for (let i = 0; i < n; i++) d[i] += s[i] * gain;
  }
  return dst;
}

export function scale(buf, g) { for (let i = 0; i < buf.length; i++) buf[i] *= g; return buf; }
export function mulEnv(buf, env) { const n = Math.min(buf.length, env.length); for (let i = 0; i < n; i++) buf[i] *= env[i]; return buf; }
export function peakAbs(chs) { let p = 0; for (const c of chs) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > p) p = a; } return p; }
export function reverse(buf) { return Float32Array.from(buf).reverse(); }

/** Piecewise automation: pts = [[sec, value], ...]. log=true interpolates geometrically. */
export function curve(n, pts, log = false) {
  const out = new Float32Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    while (k < pts.length - 1 && t >= pts[k + 1][0]) k++;
    let v;
    if (t <= pts[0][0]) v = pts[0][1];
    else if (k >= pts.length - 1) v = pts[pts.length - 1][1];
    else {
      const [t0, v0] = pts[k], [t1, v1] = pts[k + 1];
      const x = (t - t0) / Math.max(1e-9, t1 - t0);
      v = log ? v0 * Math.pow(v1 / v0, x) : v0 + (v1 - v0) * x;
    }
    out[i] = v;
  }
  return out;
}

/** ADSR envelope (seconds). Smooth sin^2 attack, exponential decay/release, exact zero at end of release. */
export function adsr(n, { a = 0.005, d = 0.2, s = 0.7, r = 0.2, gate = Infinity, k = 4 } = {}) {
  const env = new Float32Array(n);
  const aN = Math.max(2, Math.round(a * SR));
  const gN = Math.min(n, Math.round(Math.min(gate, n / SR) * SR));
  const dk = Math.exp(-k / Math.max(1, d * SR));
  let lvl = 0, i = 0;
  for (; i < gN; i++) {
    if (i < aN) { const x = Math.sin((i + 1) / aN * Math.PI / 2); lvl = x * x; } else lvl = s + (lvl - s) * dk;
    env[i] = lvl;
  }
  const rN = Math.max(2, Math.round(r * SR));
  const rk = Math.exp(-k / rN);
  for (let j = 0; i < n && j < rN; i++, j++) { lvl *= rk; env[i] = lvl * (1 - j / rN); }
  return env;
}

export function fadeIn(buf, sec, start = 0) {
  const n = Math.max(1, Math.round(sec * SR));
  for (let i = 0; i < n && start + i < buf.length; i++) { const x = Math.sin((i / n) * Math.PI / 2); buf[start + i] *= x * x; }
  for (let i = 0; i < start && i < buf.length; i++) buf[i] = 0;
  return buf;
}
export function fadeOut(buf, sec, end = buf.length) {
  const n = Math.max(1, Math.round(sec * SR));
  for (let i = 0; i < n; i++) { const j = end - 1 - i; if (j < 0) break; const x = Math.sin((i / n) * Math.PI / 2); buf[j] *= x * x; }
  for (let i = end; i < buf.length; i++) buf[i] = 0;
  return buf;
}

// ---------- oscillators ----------
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
/** freq: Hz number or per-sample Float32Array */
export function oscSaw(n, freq, phase = 0) {
  const out = new Float32Array(n), fa = typeof freq !== 'number';
  let ph = phase;
  for (let i = 0; i < n; i++) {
    const dt = (fa ? freq[i] : freq) / SR;
    out[i] = 2 * ph - 1 - blep(ph, dt);
    ph += dt; if (ph >= 1) ph -= 1;
  }
  return out;
}
export function oscSquare(n, freq, phase = 0, pw = 0.5) {
  const out = new Float32Array(n), fa = typeof freq !== 'number';
  let ph = phase;
  for (let i = 0; i < n; i++) {
    const dt = (fa ? freq[i] : freq) / SR;
    let v = ph < pw ? 1 : -1;
    v += blep(ph, dt);
    let p2 = ph + 1 - pw; if (p2 >= 1) p2 -= 1;
    v -= blep(p2, dt);
    out[i] = v;
    ph += dt; if (ph >= 1) ph -= 1;
  }
  return out;
}
export function oscSine(n, freq, phase = 0) {
  const out = new Float32Array(n), fa = typeof freq !== 'number';
  let ph = phase;
  for (let i = 0; i < n; i++) { out[i] = Math.sin(TAU * ph); ph += (fa ? freq[i] : freq) / SR; if (ph >= 1) ph -= 1; }
  return out;
}
export function oscTri(n, freq, phase = 0) {
  const out = new Float32Array(n), fa = typeof freq !== 'number';
  let ph = phase;
  for (let i = 0; i < n; i++) { out[i] = 1 - 4 * Math.abs(ph - 0.5); ph += (fa ? freq[i] : freq) / SR; if (ph >= 1) ph -= 1; }
  return out;
}

// ---------- filters ----------
export function bqCoefs(type, f, q = 0.7071, gainDb = 0) {
  const w0 = TAU * clamp(f, 5, SR * 0.49) / SR, cw = Math.cos(w0), sw = Math.sin(w0);
  const al = sw / (2 * q), A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lp': b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'hp': b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'bp': b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'notch': b0 = 1; b1 = -2 * cw; b2 = 1; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'peak': b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; break;
    case 'lowshelf': {
      const sq = 2 * Math.sqrt(A) * al;
      b0 = A * ((A + 1) - (A - 1) * cw + sq); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - sq);
      a0 = (A + 1) + (A - 1) * cw + sq; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - sq; break;
    }
    case 'highshelf': {
      const sq = 2 * Math.sqrt(A) * al;
      b0 = A * ((A + 1) + (A - 1) * cw + sq); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - sq);
      a0 = (A + 1) - (A - 1) * cw + sq; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - sq; break;
    }
    default: throw new Error(`biquad type ${type}`);
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
/** In-place biquad (TDF-II). */
export function biquad(buf, type, f, q = 0.7071, gainDb = 0) {
  const [b0, b1, b2, a1, a2] = bqCoefs(type, f, q, gainDb);
  let z1 = 0, z2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i], y = b0 * x + z1;
    z1 = b1 * x - a1 * y + z2; z2 = b2 * x - a2 * y; buf[i] = y;
  }
  return buf;
}
/** Apply a list of [type, f, q, gainDb] biquads to every channel of a stereo bus. */
export function eq(chs, list) { for (const c of chs) for (const [t, f, q, g] of list) biquad(c, t, f, q ?? 0.7071, g ?? 0); return chs; }

/** In-place TPT state-variable filter; cutoff Hz number or per-sample array. mode lp|hp|bp (unity-peak bp). */
export function svf(buf, mode, cutoff, q = 0.7071) {
  const n = buf.length, k = 1 / q, arr = typeof cutoff !== 'number', lim = SR * 0.45;
  let ic1 = 0, ic2 = 0, a1 = 0, a2 = 0, a3 = 0;
  const set = (fc) => { const g = Math.tan(Math.PI * clamp(fc, 5, lim) / SR); a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; };
  set(arr ? cutoff[0] : cutoff);
  const m = mode === 'lp' ? 0 : mode === 'bp' ? 1 : 2;
  for (let i = 0; i < n; i++) {
    if (arr && (i & 7) === 0) set(cutoff[Math.min(i, cutoff.length - 1)]);
    const v0 = buf[i], v3 = v0 - ic2;
    const v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    buf[i] = m === 0 ? v2 : m === 1 ? k * v1 : v0 - k * v1 - v2;
  }
  return buf;
}

export function onePoleLP(buf, fc) { const a = 1 - Math.exp(-TAU * fc / SR); let y = 0; for (let i = 0; i < buf.length; i++) { y += a * (buf[i] - y); buf[i] = y; } return buf; }
export function onePoleHP(buf, fc) { const a = 1 - Math.exp(-TAU * fc / SR); let y = 0; for (let i = 0; i < buf.length; i++) { y += a * (buf[i] - y); buf[i] -= y; } return buf; }

// ---------- noise / shaping ----------
export function white(n, rng) { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = rng.bi(); return o; }
export function pink(n, rng) {
  const o = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = rng.bi();
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    o[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return o;
}
export function brown(n, rng) { const o = new Float32Array(n); let y = 0; for (let i = 0; i < n; i++) { y = 0.995 * y + 0.06 * rng.bi(); o[i] = y; } return o; }

export function saturate(buf, drive = 1.5) { const k = 1 / Math.tanh(drive); for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(drive * buf[i]) * k; return buf; }
export function dcBlock(buf, fc = 12) { return biquad(buf, 'hp', fc, 0.7071); }
/** M/S width: 0 = mono, 1 = unchanged, >1 wider. */
export function width(chs, w) {
  const [L, R] = chs;
  for (let i = 0; i < L.length; i++) { const m = 0.5 * (L[i] + R[i]), s = 0.5 * (L[i] - R[i]) * w; L[i] = m + s; R[i] = m - s; }
  return chs;
}
