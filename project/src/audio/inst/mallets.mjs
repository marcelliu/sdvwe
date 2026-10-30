// Plucked & struck instruments: Karplus-Strong, pizzicato, marimba, glockenspiel, woodblock.
import { SR, TAU, Rng, white, biquad, clamp, fadeOut, mono } from '../dsp.mjs';

const len = (s) => Math.max(1, Math.round(s * SR));

/** Karplus-Strong string with allpass fine tuning and optional loop low-pass (loopLP<1 = darker). Mono. */
export function ks(freq, vel, dur, o = {}) {
  const t60 = o.t60 ?? 1.0, bright = o.bright ?? 0.5, rel = o.release ?? 0.06, c = o.loopLP ?? 1;
  const n = len(dur + rel), out = mono(n), r = new Rng(o.seed ?? 81);
  const P = SR / freq, lpDelay = (1 - c) / c;
  let N = Math.floor(P - 0.5 - lpDelay - 0.1), d = P - 0.5 - lpDelay - N;
  if (N < 2) { N = 2; d = Math.max(0.1, d); }
  const C = (1 - d) / (1 + d), g = Math.pow(10, (-3 * P) / (t60 * SR)), buf = new Float32Array(N);
  let y = 0, mean = 0;
  const a = clamp(0.12 + 0.85 * bright * (0.4 + 0.6 * vel), 0.05, 1);
  for (let i = 0; i < N; i++) { y += a * (r.bi() - y); buf[i] = y; mean += y; }
  mean /= N; for (let i = 0; i < N; i++) buf[i] -= mean;
  let idx = 0, prev = 0, apX = 0, apY = 0, lp = 0;
  const gN = Math.round(dur * SR), rN = Math.max(2, Math.round(rel * SR));
  for (let i = 0; i < n; i++) {
    const x0 = buf[idx], avg = 0.5 * (x0 + prev); prev = x0;
    lp += c * (avg - lp);
    const ap = C * lp + apX - C * apY; apX = lp; apY = ap;
    buf[idx] = ap * g;
    if (++idx >= N) idx = 0;
    out[i] = i >= gN ? x0 * Math.max(0, 1 - (i - gN) / rN) : x0;
  }
  for (let i = 0; i < Math.min(n, 24); i++) out[i] *= i / 24;
  for (let i = 0; i < n; i++) out[i] *= vel;
  return out;
}

/** Pizzicato string: dark short KS + body resonances. */
export function pizz(freq, vel, o = {}) {
  const t60 = o.t60 ?? clamp(0.9 * Math.pow(220 / freq, 0.35), 0.25, 1.4);
  const x = ks(freq, vel, o.dur ?? Math.min(1.4, t60 * 1.1), { t60, bright: o.bright ?? 0.35, loopLP: o.loopLP ?? 0.75, seed: o.seed });
  biquad(x, 'peak', 280, 1.2, 4); biquad(x, 'peak', 1100, 1.5, 2.5); biquad(x, 'lp', o.lp ?? 5000, 0.7); biquad(x, 'hp', 70, 0.7);
  return fadeOut(x, 0.03);
}

function modal(freq, vel, n, modes, out) {
  for (const [ratio, a, tau] of modes) {
    const f = freq * ratio; if (f > 18000) continue;
    const r = Math.exp(-1 / (tau * SR)), w = (TAU * f) / SR, c = r * Math.cos(w), s = r * Math.sin(w);
    const stop = Math.min(n, Math.ceil(tau * SR * Math.log(Math.max(a, 1e-6) / 1e-5)));
    let re = a * vel, im = 0;
    for (let i = 0; i < stop; i++) { out[i] += im; const nr = re * c - im * s; im = re * s + im * c; re = nr; }
  }
  return out;
}

/** Marimba: tuned-bar modes (1 : 3.93 : 9.24) + soft mallet. */
export function marimba(freq, vel, o = {}) {
  const dur = o.dur ?? clamp(1.2 * Math.pow(262 / freq, 0.6), 0.35, 2), n = len(dur), out = mono(n);
  modal(freq, vel, n, [[1, 1, dur * 0.42], [3.93, 0.32 * (0.6 + 0.6 * vel), 0.06], [9.24, 0.12 * vel, 0.022]], out);
  const mn = len(0.006), nz = white(mn, new Rng(o.seed ?? 91)); biquad(nz, 'lp', 2500 + 3000 * vel, 0.7);
  for (let i = 0; i < mn; i++) out[i] += nz[i] * 0.12 * vel * (1 - i / mn);
  for (let i = 0; i < 48; i++) out[i] *= i / 48;
  return fadeOut(out, 0.02);
}

/** Glockenspiel: free-bar modes + hard mallet click. */
export function glock(freq, vel, o = {}) {
  const n = len(o.dur ?? 1.6), out = mono(n);
  modal(freq, vel, n, [[1, 1, o.decay ?? 0.9], [2.76, 0.35, 0.25], [5.4, 0.18, 0.09], [8.93, 0.08, 0.04]], out);
  const mn = len(0.002), nz = white(mn, new Rng(o.seed ?? 92)); biquad(nz, 'hp', 3000, 0.7);
  for (let i = 0; i < mn; i++) out[i] += nz[i] * 0.1 * vel * (1 - i / mn);
  for (let i = 0; i < 16; i++) out[i] *= i / 16;
  return fadeOut(out, 0.03);
}

/** Woodblock / clock tick. */
export function woodblock(freq, vel, o = {}) {
  const n = len(o.dur ?? 0.12), out = mono(n);
  modal(freq, vel, n, [[1, 1, o.decay ?? 0.022], [1.47, 0.5, 0.014], [2.6, 0.25, 0.008]], out);
  const mn = len(0.0015), nz = white(mn, new Rng(o.seed ?? 93)); biquad(nz, 'bp', Math.min(freq * 2, 12000), 1.2);
  for (let i = 0; i < mn; i++) out[i] += nz[i] * 0.4 * vel * (1 - i / mn);
  for (let i = 0; i < 12; i++) out[i] *= i / 12;
  return fadeOut(out, 0.01);
}
