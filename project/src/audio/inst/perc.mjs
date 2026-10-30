// Synthesized drums & percussion. Mono Float32Array unless noted (crash/swell/vinyl/riser are stereo).
import { SR, TAU, Rng, white, pink, biquad, svf, saturate, fadeIn, fadeOut, oscSquare, mono, reverse } from '../dsp.mjs';

const len = (s) => Math.max(1, Math.round(s * SR));

/** Sine kick with pitch envelope + click. */
export function kick(o = {}) {
  const f0 = o.f0 ?? 130, f1 = o.f1 ?? 48, pd = o.pd ?? 0.035, ad = o.ad ?? 0.3, hold = o.hold ?? 0.01;
  const n = len(o.len ?? 0.7), out = mono(n), atk = 0.0012 * SR;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = f1 + (f0 - f1) * Math.exp(-t / pd);
    ph += f / SR;
    out[i] = Math.sin(TAU * ph) * Math.min(1, i / atk) * Math.exp(-Math.max(0, t - hold) / ad);
  }
  const ck = o.click ?? 0.2;
  if (ck > 0) {
    const cn = len(0.008), c = white(cn, new Rng(o.seed ?? 11));
    for (let i = 0; i < cn; i++) c[i] *= Math.exp(-i / (0.0012 * SR));
    biquad(c, 'bp', o.clickF ?? 3200, 0.9);
    for (let i = 0; i < cn; i++) out[i] += c[i] * ck * Math.min(1, i / 8);
  }
  saturate(out, o.drive ?? 1.4);
  if (o.lp) biquad(out, 'lp', o.lp, 0.7071);
  return fadeOut(out, 0.03);
}

export function snare(o = {}) {
  const n = len(o.len ?? 0.4), out = mono(n), tone = o.tone ?? 190, td = o.tDecay ?? 0.06, nd = o.nDecay ?? 0.13;
  let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = tone * (1 + 0.25 * Math.exp(-t / 0.012));
    p1 += f / SR; p2 += (f * 1.73) / SR;
    out[i] = (Math.sin(TAU * p1) + 0.45 * Math.sin(TAU * p2)) * Math.exp(-t / td) * (o.toneAmt ?? 0.5);
  }
  const nz = white(n, new Rng(o.seed ?? 12));
  for (let i = 0; i < n; i++) nz[i] *= Math.exp(-i / SR / nd);
  biquad(nz, 'hp', o.hp ?? 1200, 0.7); biquad(nz, 'peak', o.snap ?? 4000, 0.9, 5); biquad(nz, 'lp', o.lp ?? 10000, 0.7);
  for (let i = 0; i < n; i++) out[i] = (out[i] + nz[i] * (o.noiseAmt ?? 0.8)) * Math.min(1, i / (0.0006 * SR));
  saturate(out, 1.2);
  return fadeOut(out, 0.03);
}

/** Cross-stick / rim click: resonant modes + tiny click. */
export function rim(o = {}) {
  const n = len(0.1), out = mono(n), f = o.f ?? 1750;
  for (const [fr, d, a] of [[f, 0.016, 1], [f * 0.31, 0.03, 0.55], [f * 2.05, 0.007, 0.35]]) {
    let ph = 0;
    for (let i = 0; i < n; i++) { ph += fr / SR; out[i] += Math.sin(TAU * ph) * a * Math.exp(-i / SR / d); }
  }
  const cn = len(0.004), c = white(cn, new Rng(o.seed ?? 13)); biquad(c, 'hp', 2500, 0.7);
  for (let i = 0; i < cn; i++) out[i] += c[i] * 0.5 * Math.exp(-i / (0.0008 * SR));
  for (let i = 0; i < 24; i++) out[i] *= i / 24;
  return fadeOut(out, 0.02);
}

/** Clap: staggered noise bursts + tail, band-passed. */
export function clap(o = {}) {
  const n = len(o.len ?? 0.5), r = new Rng(o.seed ?? 14), nz = white(n, r), env = mono(n);
  const bursts = o.bursts ?? 4, sp = o.spacing ?? 0.0095, tail = o.tail ?? 0.17;
  for (let b = 0; b < bursts; b++) {
    const s = Math.round(b * sp * SR * (1 + 0.15 * r.bi())), last = b === bursts - 1, d = last ? tail : 0.0045;
    for (let i = s; i < n; i++) {
      const v = (last ? 1 : 0.85) * Math.exp(-(i - s) / SR / d) * Math.min(1, (i - s) / (0.0004 * SR));
      if (v > env[i]) env[i] = v;
    }
  }
  for (let i = 0; i < n; i++) nz[i] *= env[i];
  biquad(nz, 'hp', o.hp ?? 700, 0.7); biquad(nz, 'peak', o.bp ?? 1350, 1.2, 7); biquad(nz, 'lp', o.lp ?? 9000, 0.7);
  return fadeOut(nz, 0.03);
}

const HAT_F = [205.3, 304.4, 369.6, 522.7, 540, 800];
/** Metallic hat (808-style square cluster + noise). */
export function hat(o = {}) {
  const open = !!o.open, n = len(o.len ?? (open ? 0.7 : 0.14)), r = new Rng(o.seed ?? 15), m = mono(n);
  for (const f of HAT_F) { const sq = oscSquare(n, f * (o.pitch ?? 1.6), r.next()); for (let i = 0; i < n; i++) m[i] += sq[i] / 6; }
  const nz = white(n, r), mix = o.metal ?? 0.45;
  for (let i = 0; i < n; i++) m[i] = m[i] * mix + nz[i] * (1 - mix);
  biquad(m, 'hp', o.hp ?? 7000, 0.7); biquad(m, 'peak', o.bp ?? 10500, 1.0, 4);
  if (o.lp) biquad(m, 'lp', o.lp, 0.7);
  const d = o.decay ?? (open ? 0.28 : 0.04);
  for (let i = 0; i < n; i++) m[i] *= Math.exp(-i / SR / d) * Math.min(1, i / (0.0005 * SR));
  return fadeOut(m, open ? 0.05 : 0.01);
}

export function shaker(o = {}) {
  const n = len(o.len ?? 0.12), nz = white(n, new Rng(o.seed ?? 16));
  biquad(nz, 'hp', o.hp ?? 4500, 0.7); biquad(nz, 'peak', o.bp ?? 7500, 0.8, 4); biquad(nz, 'lp', 13000, 0.7);
  const a = o.attack ?? 0.018, d = o.decay ?? 0.045;
  for (let i = 0; i < n; i++) { const t = i / SR; nz[i] *= t < a ? Math.sin((t / a) * Math.PI / 2) ** 2 : Math.exp(-(t - a) / d); }
  return fadeOut(nz, 0.01);
}

/** Finger snap: sharp click + two resonant bands. */
export function snap(o = {}) {
  const n = len(0.16), out = mono(n), nz = white(n, new Rng(o.seed ?? 17)), f = o.f ?? 2600;
  const a = Float32Array.from(nz), b = Float32Array.from(nz);
  biquad(a, 'bp', f, 3.5); biquad(b, 'bp', f * 0.48, 2.5);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = (a[i] * 2.2 * Math.exp(-t / 0.022) + b[i] * 1.2 * Math.exp(-t / 0.012) + nz[i] * 0.35 * Math.exp(-t / 0.0015)) * Math.min(1, i / 10);
  }
  biquad(out, 'hp', 600, 0.7);
  return fadeOut(out, 0.02);
}

/** Crash cymbal, stereo. */
export function crash(o = {}) {
  const n = len(o.len ?? 2.6), d = o.decay ?? 1.1, r = new Rng(o.seed ?? 18), out = [];
  for (let c = 0; c < 2; c++) {
    const m = mono(n);
    for (let k = 0; k < 10; k++) { const sq = oscSquare(n, r.range(340, 1150) * (o.pitch ?? 1), r.next()); for (let i = 0; i < n; i++) m[i] += sq[i] * 0.1; }
    const nz = white(n, r);
    for (let i = 0; i < n; i++) m[i] = m[i] * 0.55 + nz[i] * 0.45;
    biquad(m, 'hp', o.hp ?? 3200, 0.7); biquad(m, 'peak', 6500, 0.8, 3); biquad(m, 'lp', o.lp ?? 14000, 0.7);
    for (let i = 0; i < n; i++) { const t = i / SR; m[i] *= (0.55 * Math.exp(-t / 0.06) + 0.45 * Math.exp(-t / d)) * Math.min(1, i / (0.0008 * SR)); }
    out.push(fadeOut(m, 0.15));
  }
  return out;
}

/** Reverse-cymbal swell of `sec` seconds, peaking at its very end (stereo). */
export function swell(sec, o = {}) {
  const N = len(sec + 0.05), keep = len(sec);
  const c = crash({ len: sec + 0.05, decay: sec * 0.55, seed: o.seed ?? 19, hp: o.hp ?? 2500, lp: o.lp ?? 12000 });
  return c.map((x) => { const y = Float32Array.from(reverse(x).subarray(N - keep)); fadeIn(y, sec * 0.25); return fadeOut(y, 0.004); });
}

export function tom(o = {}) {
  const n = len(o.len ?? 0.5), out = mono(n), f0 = o.f0 ?? 170, f1 = o.f1 ?? 110;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = f1 + (f0 - f1) * Math.exp(-t / 0.05);
    ph += f / SR; out[i] = Math.sin(TAU * ph) * Math.exp(-t / (o.decay ?? 0.22)) * Math.min(1, i / 40);
  }
  const nz = white(len(0.03), new Rng(o.seed ?? 20)); biquad(nz, 'bp', 1500, 0.8);
  for (let i = 0; i < nz.length; i++) out[i] += nz[i] * 0.25 * Math.exp(-i / (0.004 * SR));
  saturate(out, 1.3);
  return fadeOut(out, 0.03);
}

/** Vinyl crackle + hiss bed (stereo, n samples). */
export function vinyl(n, o = {}) {
  const r = new Rng(o.seed ?? 21), rate = o.rate ?? 22, out = [];
  for (let c = 0; c < 2; c++) {
    const x = mono(n);
    let pos = Math.floor((-Math.log(1 - r.next()) / rate) * SR);
    while (pos < n) {
      const amp = (0.15 + 0.85 * Math.pow(r.next(), 3)) * (r.chance(0.5) ? 1 : -1), w = 1 + Math.floor(r.next() * 3);
      for (let j = 0; j < w * 6 && pos + j < n; j++) x[pos + j] += amp * Math.exp(-j / (w * 1.5)) * (j % 2 ? -0.6 : 1);
      pos += Math.max(1, Math.floor((-Math.log(1 - r.next()) / rate) * SR));
    }
    biquad(x, 'hp', 900, 0.7); biquad(x, 'lp', 7000, 0.7);
    const hiss = pink(n, r); biquad(hiss, 'hp', 1500, 0.7); biquad(hiss, 'lp', 9000, 0.7);
    for (let i = 0; i < n; i++) x[i] = x[i] * 0.5 + hiss[i] * (o.hiss ?? 0.05);
    out.push(x);
  }
  return out;
}

/** Band-passed noise riser (stereo), amplitude rises to the end. */
export function noiseRiser(sec, o = {}) {
  const n = len(sec), r = new Rng(o.seed ?? 22), f0 = o.f0 ?? 300, f1 = o.f1 ?? 8000, sh = o.shape ?? 2;
  const fc = mono(n);
  for (let i = 0; i < n; i++) fc[i] = f0 * Math.pow(f1 / f0, Math.pow(i / n, o.sweepCurve ?? 1.4));
  const out = [];
  for (let c = 0; c < 2; c++) {
    const x = white(n, r);
    svf(x, 'bp', fc, o.q ?? 1.4);
    for (let i = 0; i < n; i++) x[i] *= Math.pow((i + 1) / n, sh);
    out.push(x);
  }
  return out;
}
