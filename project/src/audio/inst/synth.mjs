// Subtractive / FM synth voices: pads, strings, plucks, basses, soft lead, FM bell.
import { SR, TAU, Rng, white, biquad, svf, saturate, adsr, fadeOut, oscSaw, oscSquare, oscSine, oscTri, panGains, mono } from '../dsp.mjs';

const len = (s) => Math.max(1, Math.round(s * SR));

/** Detuned saw/tri pad through LP. freqs: Hz[]. cutoff: Hz or per-sample array (note-relative). Stereo. */
export function sawPad(freqs, dur, o = {}) {
  const atk = o.attack ?? 0.6, rel = o.release ?? 1.0, n = len(dur + rel), r = new Rng(o.seed ?? 31);
  const voices = o.voices ?? 3, spread = o.detune ?? 0.1, L = mono(n), R = mono(n);
  for (const f of freqs) for (let v = 0; v < voices; v++) {
    const x = voices === 1 ? 0 : (v / (voices - 1) - 0.5) * 2;
    const ff = f * Math.pow(2, (x * spread) / 12);
    const s = o.wave === 'tri' ? oscTri(n, ff, r.next()) : oscSaw(n, ff, r.next());
    const [gl, gr] = panGains(x * (o.width ?? 0.8));
    for (let i = 0; i < n; i++) { L[i] += s[i] * gl; R[i] += s[i] * gr; }
  }
  const cut = o.cutoff ?? 1200;
  for (const c of [L, R]) { svf(c, 'lp', cut, o.q ?? 0.8); if (o.lp2) svf(c, 'lp', cut, 0.6); if (o.hp) biquad(c, 'hp', o.hp, 0.7); }
  const env = adsr(n, { a: atk, d: 0.5, s: 1, r: rel, gate: dur });
  const g = 1 / Math.sqrt(freqs.length * voices);
  for (let i = 0; i < n; i++) { L[i] *= env[i] * g; R[i] *= env[i] * g; }
  return [L, R];
}

/** String ensemble: per-note detuned saws with delayed vibrato, LP + body EQ. Stereo. */
export function strings(freqs, dur, o = {}) {
  const atk = o.attack ?? 0.5, rel = o.release ?? 1.2, n = len(dur + rel), r = new Rng(o.seed ?? 41);
  const L = mono(n), R = mono(n), voices = o.voices ?? 4, fa = new Float32Array(n);
  for (const f of freqs) for (let v = 0; v < voices; v++) {
    const det = (r.bi() * (o.detuneCents ?? 8)) / 1200, vr = (o.vibRate ?? 5) * (1 + 0.08 * r.bi());
    const vd = (o.vibCents ?? 6) / 1200, vph = r.next() * TAU;
    for (let i = 0; i < n; i++) { const t = i / SR; fa[i] = f * Math.pow(2, det + vd * Math.min(1, t / 0.6) * Math.sin(TAU * vr * t + vph)); }
    const s = oscSaw(n, fa, r.next()), [gl, gr] = panGains(r.bi() * 0.7);
    for (let i = 0; i < n; i++) { L[i] += s[i] * gl; R[i] += s[i] * gr; }
  }
  for (const c of [L, R]) {
    svf(c, 'lp', o.cutoff ?? 3000, 0.7); biquad(c, 'peak', 900, 0.9, 2.5);
    biquad(c, 'hp', o.hp ?? 140, 0.7); biquad(c, 'highshelf', 6000, 0.7, -6);
  }
  const env = adsr(n, { a: atk, d: 0.4, s: 1, r: rel, gate: dur, k: 3 });
  const g = 1 / Math.sqrt(freqs.length * voices);
  for (let i = 0; i < n; i++) { L[i] *= env[i] * g; R[i] *= env[i] * g; }
  return [L, R];
}

/** Plucky synth (saw/square, filter envelope). Mono. */
export function pluck(freq, vel, dur, o = {}) {
  const rel = o.release ?? 0.08, n = len(dur + rel), r = new Rng(o.seed ?? 51), out = mono(n);
  const voices = o.voices ?? 2, det = o.detuneCents ?? 7;
  for (let v = 0; v < voices; v++) {
    const x = voices === 1 ? 0 : (v / (voices - 1) - 0.5) * 2, f = freq * Math.pow(2, (x * det) / 1200);
    const s = o.wave === 'square' ? oscSquare(n, f, r.next()) : oscSaw(n, f, r.next());
    for (let i = 0; i < n; i++) out[i] += s[i] / voices;
  }
  if (o.sub) { const s = oscSine(n, freq / 2); for (let i = 0; i < n; i++) out[i] += s[i] * o.sub; }
  const hi = o.fHi ?? 4500 * (0.5 + 0.5 * vel), lo = o.fLo ?? 500, fd = o.fDecay ?? 0.12, fc = mono(n);
  for (let i = 0; i < n; i++) fc[i] = lo + (hi - lo) * Math.exp(-i / SR / fd);
  svf(out, 'lp', fc, o.q ?? 1.0);
  const env = adsr(n, { a: o.attack ?? 0.002, d: o.decay ?? 0.25, s: o.sustain ?? 0, r: rel, gate: dur, k: 3 });
  for (let i = 0; i < n; i++) out[i] *= env[i] * vel;
  return out;
}

/** Warm sine sub bass with optional glide; light saturation adds audible harmonics. Mono. */
export function subBass(freq, vel, dur, o = {}) {
  const rel = o.release ?? 0.08, n = len(dur + rel), out = mono(n), gf = o.glideFrom, gt = o.glideTime ?? 0.06;
  const h2 = o.h2 ?? 0.25, h3 = o.h3 ?? 0.08;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const f = gf ? freq * Math.pow(gf / freq, Math.exp(-i / SR / gt)) : freq;
    ph += f / SR; if (ph >= 1) ph -= 1;
    out[i] = Math.sin(TAU * ph) + h2 * Math.sin(2 * TAU * ph + 0.3) + h3 * Math.sin(3 * TAU * ph);
  }
  saturate(out, o.drive ?? 1.2);
  const env = adsr(n, { a: o.attack ?? 0.008, d: o.decay ?? 0.4, s: o.sustain ?? 0.8, r: rel, gate: dur });
  for (let i = 0; i < n; i++) out[i] *= env[i] * vel;
  return out;
}

/** Filtered saw/square bass + sine sub (24 dB LP with envelope). Mono. */
export function synthBass(freq, vel, dur, o = {}) {
  const rel = o.release ?? 0.05, n = len(dur + rel), r = new Rng(o.seed ?? 61), out = mono(n);
  const saw = oscSaw(n, freq, r.next()), sq = oscSquare(n, freq, r.next()), sub = oscSine(n, freq);
  const mS = o.saw ?? 0.6, mQ = o.square ?? 0.25, mSub = o.sub ?? 0.6;
  for (let i = 0; i < n; i++) out[i] = saw[i] * mS + sq[i] * mQ;
  const base = o.cutoff ?? 350, amt = o.envAmt ?? 3, fd = o.fDecay ?? 0.12, fc = mono(n);
  for (let i = 0; i < n; i++) fc[i] = base * (1 + amt * vel * Math.exp(-i / SR / fd));
  svf(out, 'lp', fc, o.q ?? 0.9); svf(out, 'lp', fc, 0.7);
  for (let i = 0; i < n; i++) out[i] += sub[i] * mSub;
  saturate(out, o.drive ?? 1.3);
  const env = adsr(n, { a: o.attack ?? 0.003, d: o.decay ?? 0.3, s: o.sustain ?? 0.7, r: rel, gate: dur });
  for (let i = 0; i < n; i++) out[i] *= env[i] * vel;
  return out;
}

/** Soft flute/bell lead: sine + few harmonics, breath noise, delayed vibrato, soft FM ping on attack. Mono. */
export function softLead(freq, vel, dur, o = {}) {
  const rel = o.release ?? 0.25, n = len(dur + rel), r = new Rng(o.seed ?? 71), out = mono(n);
  const vd = o.vibDelay ?? 0.25, vr = o.vibRate ?? 5.2, vc = (o.vibCents ?? 10) / 1200, bell = o.bell ?? 0.35;
  const kb = Math.exp(-1 / (0.12 * SR));
  let ph = 0, pb = 0, eb = 1;
  for (let i = 0; i < n; i++) {
    const t = i / SR, vib = Math.min(1, Math.max(0, (t - vd) / 0.3)) * vc * Math.sin(TAU * vr * t);
    ph += (freq * Math.pow(2, vib)) / SR; if (ph >= 1) ph -= 1;
    pb += (freq * 4) / SR; if (pb >= 1) pb -= 1;
    out[i] = Math.sin(TAU * ph + bell * eb * Math.sin(TAU * pb)) + 0.16 * Math.sin(2 * TAU * ph) + 0.05 * Math.sin(3 * TAU * ph);
    eb *= kb;
  }
  const br = white(n, r); svf(br, 'bp', Math.min(freq * 2, 9000), 2.5); biquad(br, 'hp', 800, 0.7);
  const breath = o.breath ?? 0.08;
  for (let i = 0; i < n; i++) out[i] += br[i] * breath * (0.4 + 0.6 * Math.exp(-i / SR / 0.15));
  const env = adsr(n, { a: o.attack ?? 0.035, d: 0.3, s: o.sustain ?? 0.8, r: rel, gate: dur });
  for (let i = 0; i < n; i++) out[i] *= env[i] * vel;
  return out;
}

/** Two-operator FM bell. Mono, `dur` total length. */
export function fmBell(freq, vel, dur, o = {}) {
  const n = len(dur), out = mono(n), ratio = o.ratio ?? 3.5;
  const I0 = (o.index ?? 2.5) * (0.5 + 0.5 * vel), Ifl = o.indexFloor ?? 0;
  const kI = Math.exp(-1 / ((o.iDecay ?? 0.25) * SR)), kA = Math.exp(-1 / ((o.decay ?? 0.8) * SR));
  const aN = Math.max(2, Math.round((o.attack ?? 0.002) * SR)), dc = freq / SR, dm = (freq * ratio) / SR;
  let pc = 0, pm = 0, eI = 1, eA = 1;
  for (let i = 0; i < n; i++) {
    out[i] = Math.sin(TAU * pc + (Ifl + I0 * eI) * Math.sin(TAU * pm)) * eA * Math.min(1, i / aN) * vel;
    pc += dc; if (pc >= 1) pc -= 1; pm += dm; if (pm >= 1) pm -= 1;
    eI *= kI; eA *= kA;
  }
  return fadeOut(out, Math.min(0.05, dur * 0.2));
}
