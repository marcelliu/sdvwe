// UI / chat / game SFX (original designs; no imitation of platform or app tones).
import { SR, TAU, Rng, white, biquad, svf, fadeOut, mono, stereo, mixMono, curve, oscSquare, oscSine, oscSaw, panGains } from '../dsp.mjs';
import { fmBell } from '../inst/synth.mjs';
import { woodblock } from '../inst/mallets.mjs';
import { plate } from '../fx.mjs';

const len = (s) => Math.max(1, Math.round(s * SR));
export const dup = (m) => [m, Float32Array.from(m)];
/** Adds plate-reverb wet signal into bus in place (tail truncated to bus length). */
export function addVerb(bus, send, o = {}) {
  const w = plate(bus[0], bus[1], { tail: 0, ...o });
  for (let c = 0; c < 2; c++) { const b = bus[c], x = w[c]; for (let i = 0; i < b.length; i++) b[i] += x[i] * send; }
  return bus;
}
function panSweep(bus, x, c, from, to, total, gain = 1) {
  for (let i = 0; i < x.length; i++) {
    const p = from + (to - from) * Math.min(1, i / SR / total), th = (p + 1) * Math.PI / 4;
    bus[c][i] += x[i] * gain * (c ? Math.sin(th) : Math.cos(th)) * Math.SQRT2;
  }
}

export function notifyChime() {
  const bus = stereo(len(0.75));
  const note = (f, t, pan, v) => {
    const b = fmBell(f, v, 0.6, { ratio: 2, index: 1.3, iDecay: 0.05, decay: 0.15, attack: 0.003 });
    const body = fmBell(f / 2, v * 0.4, 0.6, { ratio: 1, index: 0.35, iDecay: 0.06, decay: 0.18, attack: 0.004 });
    for (let i = 0; i < b.length; i++) b[i] += body[i];
    mixMono(bus, b, len(t), 1, pan);
  };
  note(880, 0, -0.12, 0.8);
  note(1318.51, 0.11, 0.12, 0.9);
  return addVerb(bus, 0.16, { decay: 0.45, damping: 0.5, predelay: 0.008, size: 0.6 });
}

export function msgReceive() {
  const n = len(0.5), out = mono(n), f1 = 1046.5;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = f1 * (0.8 + 0.2 * (1 - Math.exp(-t / 0.015)));
    ph += f / SR;
    out[i] = (Math.sin(TAU * ph) + 0.22 * Math.sin(2 * TAU * ph)) * Math.min(1, t / 0.004) * Math.exp(-t / 0.1);
  }
  const bell = fmBell(f1 * 2, 0.4, 0.45, { ratio: 1.5, index: 0.7, iDecay: 0.04, decay: 0.11, attack: 0.008 });
  for (let i = 0; i < bell.length; i++) out[i] += bell[i] * 0.45;
  return addVerb(dup(out), 0.12, { decay: 0.4, damping: 0.5, size: 0.5 });
}

export function msgSend() {
  const n = len(0.4), r = new Rng(201), bus = stereo(n), pk = 0.11, env = mono(n);
  const fc = curve(n, [[0, 900], [pk, 3400], [0.32, 6500]], true);
  for (let i = 0; i < n; i++) { const t = i / SR; env[i] = t < pk ? Math.pow(t / pk, 1.6) : Math.exp(-(t - pk) / 0.055); }
  for (let c = 0; c < 2; c++) {
    const x = white(n, r); svf(x, 'bp', fc, 1.3);
    for (let i = 0; i < n; i++) x[i] *= env[i];
    panSweep(bus, x, c, -0.5, 0.5, 0.36, 0.9);
  }
  const tone = mono(n); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = 480 * Math.pow(2.8, Math.min(1, t / 0.13));
    ph += f / SR;
    tone[i] = Math.sin(TAU * ph) * Math.pow(Math.min(1, t / 0.06), 2) * Math.exp(-Math.max(0, t - 0.06) / 0.045);
  }
  mixMono(bus, tone, 0, 0.35, 0.2);
  return bus;
}

function bubble(f0, f1, seed) {
  const n = len(0.16), out = mono(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = f0 + (f1 - f0) * (1 - Math.exp(-t / 0.012));
    ph += f / SR;
    out[i] = (Math.sin(TAU * ph) + 0.12 * Math.sin(2 * TAU * ph)) * Math.min(1, t / 0.0015) * Math.exp(-t / 0.034);
  }
  const cn = len(0.003), nz = white(cn, new Rng(seed)); biquad(nz, 'bp', 2500, 1);
  for (let i = 0; i < cn; i++) out[i] += nz[i] * 0.15 * (1 - i / cn);
  return dup(out);
}
export const bubblePop1 = () => bubble(380, 820, 211);
export const bubblePop2 = () => bubble(520, 1110, 212);

function keyTapMono(v, r) {
  const n = len(0.05), out = mono(n);
  let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; p1 += v.thump / SR; p2 += v.tick / SR;
    out[i] = Math.sin(TAU * p1) * 0.55 * Math.exp(-t / 0.007) + Math.sin(TAU * p2) * 0.1 * Math.exp(-t / 0.0025);
  }
  const cn = len(0.006), nz = white(cn, r); biquad(nz, 'bp', v.bp, 1.2);
  for (let i = 0; i < cn; i++) out[i] += nz[i] * 0.7 * Math.exp(-i / (0.0011 * SR));
  for (let i = 0; i < 16; i++) out[i] *= i / 16;
  return fadeOut(out, 0.01);
}
const KEYS = [{ thump: 205, tick: 2600, bp: 3200 }, { thump: 190, tick: 2400, bp: 2800 }, { thump: 222, tick: 2900, bp: 3600 }];
export const keyTap1 = () => dup(keyTapMono(KEYS[0], new Rng(221)));
export const keyTap2 = () => dup(keyTapMono(KEYS[1], new Rng(222)));
export const keyTap3 = () => dup(keyTapMono(KEYS[2], new Rng(223)));

/** 3.0 s seamless loop: taps placed in a circular buffer (tails wrap to the start). */
export function typingLoop() {
  const N = len(3.0), bus = stereo(N), r = new Rng(301);
  let t = 0.04;
  while (t < 2.97) {
    const burst = r.int(3, 7);
    for (let k = 0; k < burst && t < 2.97; k++) {
      const v = KEYS[r.int(0, 2)];
      const x = keyTapMono({ thump: v.thump * r.range(0.93, 1.07), tick: v.tick * r.range(0.9, 1.1), bp: v.bp * r.range(0.9, 1.1) }, r);
      const g = r.range(0.55, 1), [gl, gr] = panGains(r.range(-0.2, 0.2)), s = len(t);
      for (let i = 0; i < x.length; i++) { const j = (s + i) % N; bus[0][j] += x[i] * g * gl; bus[1][j] += x[i] * g * gr; }
      t += r.range(0.085, 0.16);
    }
    t += r.range(0.18, 0.4);
  }
  return bus;
}

export function uiTap() {
  const n = len(0.08), out = mono(n);
  let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; p1 += 1450 / SR; p2 += 160 / SR;
    out[i] = Math.sin(TAU * p1) * 0.3 * Math.exp(-t / 0.009) + Math.sin(TAU * p2) * 0.45 * Math.exp(-t / 0.012);
  }
  const cn = len(0.004), nz = white(cn, new Rng(401)); biquad(nz, 'bp', 4200, 1.0);
  for (let i = 0; i < cn; i++) out[i] += nz[i] * 0.8 * Math.exp(-i / (0.0007 * SR));
  for (let i = 0; i < 12; i++) out[i] *= i / 12;
  return dup(fadeOut(out, 0.015));
}

export function swipe() {
  const total = 0.32, n = len(total), r = new Rng(411), bus = stereo(n), pk = 0.095, env = mono(n), fc = mono(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    env[i] = t < pk ? Math.pow(t / pk, 1.8) : Math.pow(Math.max(0, 1 - (t - pk) / (total - pk)), 2.2);
    fc[i] = 700 * Math.pow(4200 / 700, env[i]);
  }
  for (let c = 0; c < 2; c++) {
    const x = white(n, r), body = white(n, r);
    svf(x, 'bp', fc, 0.9); biquad(body, 'lp', 600, 0.7);
    for (let i = 0; i < n; i++) x[i] = (x[i] + body[i] * 0.5) * env[i];
    panSweep(bus, x, c, -0.6, 0.6, total);
  }
  return bus;
}

export function likePling() {
  const bus = stereo(len(0.6));
  [[1046.5, 0, -0.25], [1318.5, 0.04, -0.05], [1568, 0.08, 0.15], [2093, 0.12, 0.3]].forEach(([f, t, p], k) => {
    const b = fmBell(f, 0.75 - k * 0.06, 0.45, { ratio: 3.01, index: 1.1, iDecay: 0.025, decay: 0.12 + k * 0.03, attack: 0.002 });
    mixMono(bus, b, len(t), 1, p);
  });
  const n = bus[0].length, nz = white(n, new Rng(421)); biquad(nz, 'hp', 7000, 0.7);
  for (let i = 0; i < n; i++) nz[i] *= 0.05 * Math.exp(-i / SR / 0.12) * Math.min(1, i / (0.01 * SR));
  mixMono(bus, nz, 0, 1, 0);
  return addVerb(bus, 0.2, { decay: 0.5, damping: 0.3, size: 0.6 });
}

export const tick = () => dup(woodblock(2900, 0.9, { decay: 0.008, dur: 0.05, seed: 431 }));
export const tock = () => dup(woodblock(1300, 0.9, { decay: 0.013, dur: 0.06, seed: 432 }));

function beep(f) {
  const n = len(0.15), sq = oscSquare(n, f), si = oscSine(n, f), out = mono(n);
  for (let i = 0; i < n; i++) out[i] = 0.3 * sq[i] + 0.7 * si[i];
  svf(out, 'lp', 3600, 0.7);
  const a = len(0.003), hold = len(0.1), rel = n - a - hold;
  for (let i = 0; i < n; i++) {
    const e = i < a ? Math.sin((i / a) * Math.PI / 2) ** 2 : i < a + hold ? 1 : Math.cos(((i - a - hold) / rel) * Math.PI / 2) ** 2;
    out[i] *= e;
  }
  return dup(out);
}
export const countdownBeep = () => beep(880);
export const countdownBeepHigh = () => beep(1760);

/** Playful two-step "bwomp" (descending, resonant LP wah) — soft, not harsh. */
export function buzzerWrong() {
  const n = len(0.55), out = mono(n), r = new Rng(441);
  for (const [t0, d, fA, fB] of [[0, 0.2, 233.08, 207.65], [0.25, 0.27, 196, 164.81]]) {
    const m = len(d), fa = mono(m);
    for (let i = 0; i < m; i++) fa[i] = fA * Math.pow(fB / fA, i / m);
    const s1 = oscSaw(m, fa, r.next()), s2 = oscSquare(m, fa.map((v) => v * 1.006), r.next()), x = mono(m), fc = mono(m);
    for (let i = 0; i < m; i++) { x[i] = 0.6 * s1[i] + 0.4 * s2[i]; fc[i] = 500 + 1500 * Math.exp(-i / SR / 0.07); }
    svf(x, 'lp', fc, 2.0);
    const s0 = len(t0);
    for (let i = 0; i < m && s0 + i < n; i++) {
      const t = i / SR;
      out[s0 + i] += x[i] * Math.min(1, t / 0.008) * Math.min(1, (d - t) / 0.04) * (0.85 + 0.15 * Math.sin(TAU * 14 * t));
    }
  }
  return dup(out);
}

export function dingCorrect() {
  const bus = stereo(len(1.0)), r = new Rng(451);
  mixMono(bus, fmBell(1174.66, 0.8, 0.9, { ratio: 3.5, index: 1.4, iDecay: 0.04, decay: 0.3, attack: 0.002 }), 0, 0.8, -0.15);
  mixMono(bus, fmBell(1567.98, 0.95, 0.9, { ratio: 3.5, index: 1.6, iDecay: 0.05, decay: 0.38, attack: 0.002 }), len(0.07), 1, 0.15);
  mixMono(bus, fmBell(783.99, 0.5, 0.9, { ratio: 1, index: 0.3, iDecay: 0.05, decay: 0.3 }), len(0.07), 0.6, 0);
  const scale = [2349.3, 2637, 3136, 3520, 4186, 4699, 5274];
  for (let k = 0; k < 16; k++) {
    const t = 0.08 + Math.pow(r.next(), 1.5) * 0.55, f = r.pick(scale) * (r.chance(0.3) ? 2 : 1);
    const g = fmBell(f, 0.25 * r.range(0.4, 1), 0.2, { ratio: 2, index: 0.4, iDecay: 0.02, decay: r.range(0.03, 0.08) });
    mixMono(bus, g, len(t), 1, r.bi() * 0.8);
  }
  return addVerb(bus, 0.2, { decay: 0.55, damping: 0.35, size: 0.7 });
}
