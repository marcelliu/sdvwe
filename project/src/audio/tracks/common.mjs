// Shared arrangement / bus helpers for the music tracks.
import { SR, TAU, clamp, db, nf, mixMono, curve, svf, panGains } from '../dsp.mjs';
import { plate, pingPong, modDelay, lufs } from '../fx.mjs';

export const at = (t) => Math.round(t * SR);

export function addWet(bus, wet, gain = 1) {
  for (let c = 0; c < 2; c++) { const b = bus[c], w = wet[c], n = Math.min(b.length, w.length); for (let i = 0; i < n; i++) b[i] += w[i] * gain; }
  return bus;
}
/** Plate send (pre-filtered copy), wet added in place, truncated to bus length. */
export function reverb(bus, send, o = {}) {
  const src = bus.map((c) => Float32Array.from(c));
  for (const c of src) { svf(c, 'hp', o.preHp ?? 200, 0.7); if (o.preLp) svf(c, 'lp', o.preLp, 0.7); }
  return addWet(bus, plate(src[0], src[1], { tail: 0, ...o }), send);
}
export function delay(bus, send, o = {}) { return addWet(bus, pingPong(bus[0], bus[1], { tail: 0, ...o }), send); }
export function lpAuto(bus, pts, q = 0.707) { const fc = curve(bus[0].length, pts, true); for (const c of bus) svf(c, 'lp', fc, q); return bus; }
export function hpAuto(bus, pts, q = 0.707) { const fc = curve(bus[0].length, pts, true); for (const c of bus) svf(c, 'hp', fc, q); return bus; }
export function gainAuto(bus, pts) { const g = curve(bus[0].length, pts); for (const c of bus) for (let i = 0; i < c.length; i++) c[i] *= g[i]; return bus; }
export function mulEnvBus(bus, env) { for (const c of bus) for (let i = 0; i < c.length; i++) c[i] *= env[i]; return bus; }
export function widthAuto(bus, pts) {
  const w = curve(bus[0].length, pts), [L, R] = bus;
  for (let i = 0; i < L.length; i++) { const m = 0.5 * (L[i] + R[i]), s = 0.5 * (L[i] - R[i]) * w[i]; L[i] = m + s; R[i] = m - s; }
  return bus;
}
/** Equal-power auto-pan (Rhodes-style stereo tremolo); depth curve 0..1. */
export function autoPan(bus, rate, depthPts) {
  const d = curve(bus[0].length, depthPts), [L, R] = bus, w = (TAU * rate) / SR;
  for (let i = 0; i < L.length; i++) {
    const th = (d[i] * Math.sin(w * i) + 1) * Math.PI / 4;
    L[i] *= Math.cos(th) * Math.SQRT2; R[i] *= Math.sin(th) * Math.SQRT2;
  }
  return bus;
}
/** Gentle tape wow/flutter on both channels. */
export function wow(bus, o = {}) { return bus.map((c, k) => modDelay(c, { depth: 0.0006, rate: 0.5, flutter: 0.00008, ...o, phase: k * 0.7 })); }

/** Strummed chord: fn(freqHz, vel, durSec, index) -> mono; low-to-high stagger, small pan spread. */
export function strumChord(bus, fn, notes, t, dur, vel, o = {}) {
  notes.forEach((nn, k) => {
    const v = clamp(vel * (1 + (o.rng ? o.rng.bi() * (o.velJit ?? 0.06) : 0)), 0.05, 1);
    const p = (o.pan ?? 0) + (notes.length > 1 ? (k / (notes.length - 1) - 0.5) * (o.spread ?? 0.4) : 0);
    mixMono(bus, fn(nf(nn), v, dur, k), at(t + k * (o.strum ?? 0.012)), o.gain ?? 1, p);
  });
}

/** sin^2 fade-out of every stem between from..to, silence after. */
export function fadeAll(stems, from, to) {
  const a = at(from), b = at(to);
  for (const s of Object.values(stems)) for (const c of s) {
    for (let i = a; i < c.length; i++) { const x = i >= b ? 0 : Math.cos(((i - a) / (b - a)) * Math.PI / 2) ** 2; c[i] *= x; }
  }
}
/** Fade a bus to silence over [from, to] and keep it silent afterwards. */
export function gateOut(bus, from, to) {
  const a = at(from), b = at(to);
  for (const c of bus) for (let i = a; i < c.length; i++) c[i] *= i >= b ? 0 : Math.cos(((i - a) / (b - a)) * Math.PI / 2) ** 2;
  return bus;
}
/** Silence before `to`, sin^2 fade-in over [from, to]. */
export function gateIn(bus, from, to) {
  const a = at(from), b = at(to);
  for (const c of bus) for (let i = 0; i < Math.min(b, c.length); i++) c[i] *= i < a ? 0 : Math.sin(((i - a) / (b - a)) * Math.PI / 2) ** 2;
  return bus;
}
/** Scale each stem so its integrated loudness (BS.1770, gated) hits the given LUFS target. */
export function balanceStems(stems, targets) {
  for (const [k, t] of Object.entries(targets)) {
    const s = stems[k]; if (!s) continue;
    const l = lufs(s); if (!Number.isFinite(l)) continue;
    const g = db(t - l); for (const c of s) for (let i = 0; i < c.length; i++) c[i] *= g;
  }
}
export { panGains };
