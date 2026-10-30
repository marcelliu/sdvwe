// Keyboard instruments: FM electric piano (Rhodes-like) and additive acoustic piano.
import { SR, TAU, Rng, white, biquad, clamp, mono, mtof } from '../dsp.mjs';

/**
 * FM electric piano: body pair (1:1, decaying index) + tine pair (1:14, fast decay) + pickup "bark".
 * Returns mono; output has a small DC component from the bark term (HP the bus).
 */
export function rhodes(freq, vel, dur, o = {}) {
  const rel = o.release ?? 0.3, n = Math.ceil((dur + rel) * SR) + 16, out = mono(n);
  const bright = o.bright ?? 1, tineAmt = o.tine ?? 1;
  const tauBody = clamp(2.2 * Math.pow(220 / freq, 0.5), 0.6, 4.5);
  const I0 = (0.6 + 1.6 * vel) * bright, Is = 0.18 * bright, kI = Math.exp(-1 / ((0.18 + 0.35 * (1 - vel)) * SR));
  const It0 = 2.4 * vel * tineAmt * Math.min(1, 900 / freq), kIt = Math.exp(-1 / (0.016 * SR));
  const aT = 0.22 * vel * tineAmt, kT = Math.exp(-1 / (0.12 * SR));
  const kB = Math.exp(-1 / (tauBody * SR)), kB2 = Math.exp(-1 / (0.35 * SR));
  const det = Math.pow(2, (o.detuneCents ?? 1.2) / 1200);
  const d1 = freq / SR, d3 = (freq * det) / SR, d4 = (freq * 14 * det) / SR;
  const gN = Math.round(dur * SR), rN = Math.max(2, Math.round(rel * SR)), aN = Math.round(0.0025 * SR);
  const kR = Math.exp(-5 / rN), bark = o.bark ?? 0.12 * vel;
  let p1 = 0, p3 = 0, p4 = 0, eI = 1, eIt = 1, eT = 1, eB = 1, eB2 = 1, relG = 1;
  for (let i = 0; i < n; i++) {
    const I = Is + (I0 - Is) * eI;
    const body = Math.sin(TAU * p1 + I * Math.sin(TAU * p1));
    const tn = Math.sin(TAU * p3 + It0 * eIt * Math.sin(TAU * p4));
    let s = body * eB * (0.7 + 0.3 * eB2) + tn * aT * eT;
    s += bark * s * s;
    if (i < aN) s *= i / aN;
    if (i >= gN) { relG *= kR; s *= relG * Math.max(0, 1 - (i - gN) / rN); }
    out[i] = s * (0.35 + 0.65 * vel);
    p1 += d1; if (p1 >= 1) p1 -= 1;
    p3 += d3; if (p3 >= 1) p3 -= 1;
    p4 += d4; if (p4 >= 1) p4 -= 1;
    eI *= kI; eIt *= kIt; eT *= kT; eB *= kB; eB2 *= kB2;
  }
  return out;
}

/**
 * Additive piano: inharmonic partials, strike-position comb, velocity-dependent brightness,
 * two detuned strings per partial (prompt + aftersound decay), hammer noise, damper release.
 * dur = time until the damper falls (use long values to emulate sustain pedal).
 */
export function piano(midi, vel, dur, o = {}) {
  const f0 = mtof(midi), rel = o.release ?? 0.22;
  const B = 0.00006 * Math.pow(2, (midi - 40) / 13);
  const T1 = clamp(5.5 * Math.pow(2, -(midi - 36) / 16), 0.6, 9);
  const held = Math.min(dur, 6 * T1);
  const n = Math.ceil((held + rel) * SR) + 8, out = mono(n);
  const hard = clamp(vel, 0, 1) * (o.bright ?? 0.7);
  const det = Math.pow(2, (o.detune ?? 0.9) / 1200);
  const maxF = Math.min(0.46 * SR, o.maxF ?? 11000), maxP = o.partials ?? 32;
  for (let k = 1; k <= maxP; k++) {
    const fk = k * f0 * Math.sqrt(1 + B * k * k);
    if (fk > maxF) break;
    const amp = Math.pow(k, -0.9) * Math.exp(-(k - 1) * (0.38 - 0.28 * hard)) * (0.25 + 0.75 * Math.abs(Math.sin((Math.PI * k) / 7.5)));
    if (amp < 1e-4) continue;
    const tau = (T1 / (1 + 0.1 * (k - 1) + 0.006 * (k - 1) ** 2)) * (fk < 400 ? 1.3 : 1);
    for (const [ratio, tf, w] of [[det, 0.35, 0.62], [1 / det, 1.7, 0.38]]) {
      const tauS = tau * tf, a0 = amp * w;
      const r = Math.exp(-1 / (tauS * SR)), w0 = (TAU * fk * ratio) / SR, c = r * Math.cos(w0), s = r * Math.sin(w0);
      const stop = Math.min(n, Math.ceil(tauS * SR * Math.log(a0 / 2e-5)));
      let re = a0, im = 0;
      for (let i = 0; i < stop; i++) { out[i] += im; const nr = re * c - im * s; im = re * s + im * c; re = nr; }
    }
  }
  // hammer noise + felt thump
  const hn = Math.round(0.02 * SR), nz = white(hn, new Rng(o.seed ?? midi * 7 + 1));
  biquad(nz, 'bp', clamp(f0 * 3, 600, 4000), 0.8);
  for (let i = 0; i < hn; i++) out[i] += nz[i] * 0.05 * vel * Math.exp(-i / (0.004 * SR));
  const aN = Math.round((0.0015 + 0.003 * (1 - vel)) * SR), gN = Math.round(held * SR), rN = Math.max(2, Math.round(rel * SR));
  const g = 0.22 * Math.pow(vel, 1.3);
  let relG = 1; const kR = Math.exp(-4 / rN);
  for (let i = 0; i < n; i++) {
    let e = i < aN ? i / aN : 1;
    if (i >= gN) { relG *= kR; e *= relG * Math.max(0, 1 - (i - gN) / rN); }
    out[i] *= e * g;
  }
  return out;
}
