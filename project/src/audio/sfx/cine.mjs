// Cinematic / transition SFX: vibration, booms, whooshes, riser, impacts, heartbeat, shimmer, end-card hit.
import { SR, TAU, Rng, white, pink, biquad, svf, saturate, mono, stereo, mixMono, oscSaw } from '../dsp.mjs';
import { fmBell } from '../inst/synth.mjs';
import { kick, noiseRiser } from '../inst/perc.mjs';
import { dup, addVerb } from './ui.mjs';

const len = (s) => Math.max(1, Math.round(s * SR));
const rms = (x) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, x.length)) || 1e-9; };

/** Phone buzzing on a wooden table: motor tone + per-cycle contact rattle through woody resonances. */
export function vibrateTable() {
  const n = len(1.0), r = new Rng(901), motor = mono(n), imp = mono(n);
  for (const [t0, d] of [[0.0, 0.35], [0.5, 0.35]]) {
    const s0 = len(t0), m = len(d + 0.06);
    let ph = r.next();
    for (let i = 0; i < m && s0 + i < n; i++) {
      const t = i / SR, up = Math.min(1, t / 0.03), down = t > d ? Math.max(0, 1 - (t - d) / 0.06) : 1;
      const env = Math.sin((up * Math.PI) / 2) ** 2 * down;
      const f = 170 * (0.94 + 0.06 * up) * (t > d ? 1 - (0.15 * (t - d)) / 0.06 : 1) * (1 + 0.004 * Math.sin(TAU * 7 * t));
      const prev = ph; ph += f / SR;
      motor[s0 + i] += (Math.sin(TAU * ph) + 0.45 * Math.sin(2 * TAU * ph + 0.5) + 0.25 * Math.sin(3 * TAU * ph + 1.1)) * env;
      if (Math.floor(ph) !== Math.floor(prev)) imp[s0 + i] += env * (0.6 + 0.4 * r.next());
    }
  }
  const a = Float32Array.from(imp), b = Float32Array.from(imp), c = Float32Array.from(imp), hi = Float32Array.from(imp);
  biquad(a, 'bp', 330, 4); biquad(b, 'bp', 780, 5); biquad(c, 'bp', 1850, 6); biquad(hi, 'hp', 3000, 0.7);
  const rattle = mono(n);
  for (let i = 0; i < n; i++) rattle[i] = a[i] / rms(a.subarray(0, 100)) * 0 + a[i] * 1.0 + b[i] * 0.7 + c[i] * 0.45 + hi[i] * 0.15;
  const k = (1.1 * rms(motor)) / rms(rattle), out = mono(n);
  for (let i = 0; i < n; i++) out[i] = motor[i] * 0.5 + rattle[i] * k;
  biquad(out, 'hp', 60, 0.7); biquad(out, 'lp', 6500, 0.7);
  saturate(out, 1.4);
  return dup(out);
}

export function subBoom() {
  const n = len(1.6), out = mono(n), r = new Rng(501);
  let ph = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = 35 + 25 * Math.exp(-t / 0.35);
    ph += f / SR;
    out[i] = Math.sin(TAU * ph) * Math.min(1, t / 0.008) * Math.exp(-t / 0.55);
    const ft = 50 + 60 * Math.exp(-t / 0.015); p2 += ft / SR;
    if (t < 0.15) out[i] += 0.4 * Math.sin(TAU * p2) * Math.min(1, t / 0.002) * Math.exp(-t / 0.05);
  }
  const tn = len(0.06), nz = white(tn, r); biquad(nz, 'lp', 700, 0.7);
  for (let i = 0; i < tn; i++) out[i] += nz[i] * 0.35 * Math.exp(-i / (0.012 * SR)) * Math.min(1, i / (0.002 * SR));
  saturate(out, 1.6);
  biquad(out, 'hp', 22, 0.7);
  return dup(out);
}

function whoosh(total, pk, o) {
  const n = len(total), r = new Rng(o.seed), bus = stereo(n), env = mono(n), fc = mono(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    env[i] = t < pk ? Math.pow(t / pk, o.rise ?? 2.2) : Math.pow(Math.max(0, 1 - (t - pk) / (total - pk)), o.fall ?? 1.8);
    fc[i] = o.fLo * Math.pow(o.fHi / o.fLo, env[i]);
  }
  for (let c = 0; c < 2; c++) {
    const x = white(n, r), body = pink(n, r);
    svf(x, 'bp', fc, o.q ?? 1.1); biquad(body, 'lp', o.bodyLp ?? 450, 0.7);
    for (let i = 0; i < n; i++) {
      const t = i / SR, p = -0.7 + (1.4 * t) / total, th = ((p + 1) * Math.PI) / 4;
      bus[c][i] = (x[i] * 0.9 + body[i] * (o.body ?? 1.2)) * env[i] * (c ? Math.sin(th) : Math.cos(th)) * Math.SQRT2;
    }
  }
  return bus;
}
export const whooshShort = () => whoosh(0.5, 0.3, { seed: 511, fLo: 500, fHi: 3200 });
export const whooshLong = () => whoosh(1.0, 0.62, { seed: 512, fLo: 350, fHi: 2800, q: 1.0 });

/** 2.0 s riser: band-passed noise sweep + detuned saw sweep, peaking exactly at the end. */
export function riser2s() {
  const n = len(2.0), r = new Rng(601);
  const bus = noiseRiser(2.0, { f0: 250, f1: 9000, q: 1.6, shape: 2.2, sweepCurve: 1.2, seed: 602 });
  const fA = mono(n), tone = mono(n), fc = mono(n);
  for (let i = 0; i < n; i++) { fA[i] = 110 * Math.pow(8, Math.pow(i / n, 1.3)); fc[i] = 400 * Math.pow(15, i / n); }
  for (const dt of [-0.07, 0, 0.07]) {
    const s = oscSaw(n, fA.map((v) => v * Math.pow(2, dt / 12)), r.next());
    for (let i = 0; i < n; i++) tone[i] += s[i] / 3;
  }
  svf(tone, 'lp', fc, 1.2);
  for (let i = 0; i < n; i++) tone[i] *= Math.pow((i + 1) / n, 2.5);
  const k = (0.6 * rms(bus[0])) / rms(tone);
  mixMono(bus, tone, 0, k, 0);
  return bus;
}

export function impact() {
  const n = len(1.3), bus = stereo(n), r = new Rng(611);
  mixMono(bus, kick({ f0: 170, f1: 42, pd: 0.03, ad: 0.3, len: 1.0, click: 0.35, drive: 2.0, seed: 612 }), 0, 0.9, 0);
  const boom = mono(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, f = 38 + 16 * Math.exp(-t / 0.2); ph += f / SR; boom[i] = Math.sin(TAU * ph) * Math.min(1, t / 0.004) * Math.exp(-t / 0.5); }
  mixMono(bus, boom, 0, 0.6, 0);
  for (let c = 0; c < 2; c++) {
    const m = len(0.4), nz = white(m, r); biquad(nz, 'lp', 2500, 0.7);
    for (let i = 0; i < m; i++) bus[c][i] += nz[i] * 0.45 * Math.exp(-i / SR / 0.07) * Math.min(1, i / 24);
  }
  addVerb(bus, 0.22, { decay: 0.6, damping: 0.6, size: 0.9, bandwidth: 0.5 });
  for (const c of bus) saturate(c, 1.2);
  return bus;
}

export function textHit() {
  const n = len(0.13), out = mono(n), r = new Rng(621);
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, f = 65 + 120 * Math.exp(-t / 0.012); ph += f / SR; out[i] = Math.sin(TAU * ph) * Math.min(1, t / 0.0008) * Math.exp(-t / 0.035); }
  const cn = len(0.003), nz = white(cn, r); biquad(nz, 'hp', 2000, 0.7);
  for (let i = 0; i < cn; i++) out[i] += nz[i] * 0.45 * (1 - i / cn);
  const sn = len(0.03), s2 = white(sn, r); biquad(s2, 'bp', 1800, 2);
  for (let i = 0; i < sn; i++) out[i] += s2[i] * 0.5 * Math.exp(-i / SR / 0.008);
  saturate(out, 1.6);
  return dup(out);
}

/** Lub-dub: two low pitched thumps with felt-like noise, saturated so it reads on phone speakers. */
export function heartbeat() {
  const n = len(0.85), out = mono(n), r = new Rng(631);
  const beat = (t0, f0, f1, amp, dec) => {
    const s0 = len(t0), m = len(0.3);
    let ph = 0;
    for (let i = 0; i < m && s0 + i < n; i++) {
      const t = i / SR, f = f1 + (f0 - f1) * Math.exp(-t / 0.03); ph += f / SR;
      out[s0 + i] += Math.sin(TAU * ph) * amp * Math.min(1, t / 0.005) * Math.exp(-t / dec);
    }
    const nn = len(0.05), nz = white(nn, r); biquad(nz, 'lp', 260, 0.8);
    for (let i = 0; i < nn && s0 + i < n; i++) out[s0 + i] += nz[i] * amp * 1.5 * Math.min(1, i / (0.003 * SR)) * Math.exp(-i / SR / 0.018);
  };
  beat(0, 78, 48, 1, 0.075);
  beat(0.26, 88, 56, 0.72, 0.065);
  saturate(out, 2.2); biquad(out, 'lp', 1000, 0.7); biquad(out, 'hp', 25, 0.7);
  return dup(out);
}

export function shimmer() {
  const n = len(1.3), bus = stereo(n), r = new Rng(641), pk = 0.35;
  const envAt = (t) => (t < pk ? Math.pow(t / pk, 1.5) : Math.exp(-(t - pk) / 0.28));
  const scale = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093, 2349.3, 2637, 3136, 3520];
  for (let k = 0; k < 48; k++) {
    let t; do { t = r.next(); } while (r.next() > envAt(t));
    const f = r.pick(scale) * (r.chance(0.25) ? 2 : 1);
    const g = fmBell(f, r.range(0.4, 1), 0.35, { ratio: 2, index: 0.5, iDecay: 0.02, decay: r.range(0.05, 0.14), attack: 0.003 });
    mixMono(bus, g, len(t), 0.22, r.bi() * 0.85);
  }
  for (let c = 0; c < 2; c++) {
    const nz = white(n, r); biquad(nz, 'hp', 6000, 0.7);
    for (let i = 0; i < n; i++) bus[c][i] += nz[i] * 0.06 * envAt(i / SR);
  }
  return addVerb(bus, 0.35, { decay: 0.7, damping: 0.2, size: 0.8 });
}

/** End-card accent: soft impact + open Csus2-type bell chord (C5 G5 D6 G6) with plate tail. */
export function finalHit() {
  const n = len(2.2), bus = stereo(n), r = new Rng(651);
  mixMono(bus, kick({ f0: 120, f1: 44, pd: 0.035, ad: 0.35, len: 0.9, click: 0.12, drive: 1.5, lp: 3000, seed: 652 }), 0, 0.75, 0);
  const sub = mono(len(1.6)); let ph = 0;
  for (let i = 0; i < sub.length; i++) { const t = i / SR; ph += 45 / SR; sub[i] = Math.sin(TAU * ph) * Math.min(1, t / 0.006) * Math.exp(-t / 0.6); }
  mixMono(bus, sub, 0, 0.45, 0);
  for (let c = 0; c < 2; c++) {
    const m = len(0.5), nz = pink(m, r); biquad(nz, 'lp', 1800, 0.7);
    for (let i = 0; i < m; i++) bus[c][i] += nz[i] * 0.9 * Math.exp(-i / SR / 0.12) * Math.min(1, i / 48);
  }
  for (const [f, p, dt] of [[523.25, -0.4, 0], [783.99, 0.3, 0.006], [1174.66, -0.15, 0.012], [1567.98, 0.4, 0.018]]) {
    mixMono(bus, fmBell(f, 0.8, 2.0, { ratio: 3.5, index: 1.1, iDecay: 0.08, decay: 0.75, attack: 0.002 }), len(dt), 0.32, p);
  }
  mixMono(bus, fmBell(261.63, 0.6, 2.0, { ratio: 1, index: 0.4, iDecay: 0.1, decay: 0.8 }), 0, 0.3, 0);
  return addVerb(bus, 0.3, { decay: 0.75, damping: 0.4, size: 1.0 });
}
