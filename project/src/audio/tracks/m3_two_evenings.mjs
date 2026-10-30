// m3_two_evenings: split-screen bed. 90 BPM (beat 0.6667 s, bar 2.6667 s), 24.000 s, Eb major.
// 0-10.667: LEFT cold muffled "TV in another room" drone vs RIGHT warm Rhodes/pad; riser 10.0; drop 10.667 into neo-soul groove.
import { SR, TAU, Rng, nf, stereo, mono, mixMono, mixStereo, eq, addBus, pink, biquad } from '../dsp.mjs';
import { compressor, plate } from '../fx.mjs';
import { rhodes } from '../inst/keys.mjs';
import { sawPad, synthBass, subBass } from '../inst/synth.mjs';
import { ks } from '../inst/mallets.mjs';
import { kick, snare, hat, crash, swell, noiseRiser } from '../inst/perc.mjs';
import { at, reverb, delay, lpAuto, autoPan, wow, strumChord, fadeAll, gateOut, balanceStems } from './common.mjs';

const DUR = 24, BEAT = 2 / 3, BAR = 8 / 3, STEP = 1 / 6, SWING = 0.033, N = Math.round(DUR * SR), DROP = 4 * BAR;
const bt = (bar, s) => bar * BAR + s * STEP + (s % 2 ? SWING : 0);

export const meta = {
  bpm: 90, key: 'Eb major', duration: 24,
  chords: 'Abmaj9 | Gm11 | Fm9 | Bb13sus || Abmaj9 | Gm11 | Fm9 | Bb13sus->Bb13 (20.0) | Ab/Bb -> Ebmaj9 (22.667)',
  instruments: 'LEFT: low-passed noise + cold G/D drone + muffled 2-beat thump (TV through a wall, no speech-like modulation); RIGHT: soft FM Rhodes + warm pad + soft sub; groove: neo-soul kick/snare/ghosts, swung hats, round filtered bass, autopanned Rhodes, wide pad, Karplus-Strong pluck counter-melody, riser + reverse-cymbal swells',
  sections: [
    { t: 0, label: 'split: cold TV drone panned -0.7 vs warm Rhodes/pad panned +0.7' },
    { t: 10, label: 'riser / filter sweep + reverse cymbal' },
    { t: 10.667, label: 'drop: full-stereo warm groove; cold layer gone' },
    { t: 16, label: 'accent: cymbal swell + crash + Fm9 stab' },
    { t: 20, label: 'accent: swell + Bb13 stab' },
    { t: 22.667, label: 'final Ebmaj9 rings; fade to silence by 24.0' },
  ],
  checks: [{ t: 10, label: 'riser start' }, { t: 10.667, label: 'drop' }, { t: 16, label: 'accent' }, { t: 20, label: 'accent' }, { t: 22.667, label: 'final chord' }],
  marks: [10, 10.667, 16, 20, 22.667],
  balance: [[0.5, 10.4, 'pre-drop', 'fx'], [0.5, 10.4, 'pre-drop', 'harmony'], [11, 22, 'groove', 'harmony'], [0.5, 10.4, 'pre-drop mix'], [11, 22, 'groove mix']],
};

const RH = { Abmaj9: ['G3', 'Bb3', 'C4', 'Eb4'], Gm11: ['F3', 'Bb3', 'C4', 'D4'], Fm9: ['Eb3', 'G3', 'Ab3', 'C4'], Bb13sus: ['Ab3', 'C4', 'Eb4', 'G4'], Bb13: ['Ab3', 'D4', 'G4'], AbBb: ['Ab3', 'C4', 'Eb4'], Ebmaj9: ['D4', 'F4', 'G4', 'Bb4'] };
const ROOT = { Abmaj9: 'Ab1', Gm11: 'G1', Fm9: 'F1', Bb13sus: 'Bb1', Bb13: 'Bb1', AbBb: 'Bb1', Ebmaj9: 'Eb2' };
const LOOP = ['Abmaj9', 'Gm11', 'Fm9', 'Bb13sus'];

/** Cold "TV in another room" bed: LP noise with very slow swells, detuned G/D drone, muffled thump every 2 beats, faint hum. */
function tvBed(r, n) {
  const out = mono(n), nz = pink(n, r);
  biquad(nz, 'lp', 450, 0.7); biquad(nz, 'lp', 650, 0.7); biquad(nz, 'hp', 130, 0.7);
  let s = 0; for (let i = 0; i < n; i++) s += nz[i] * nz[i];
  const kn = 0.12 / Math.sqrt(s / n);
  const ph = [r.next(), r.next(), r.next(), r.next()].map((x) => x * TAU);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const am = 0.8 + 0.12 * Math.sin(TAU * 0.11 * t + ph[0]) + 0.08 * Math.sin(TAU * 0.23 * t + ph[1]);
    const drone = 0.05 * Math.sin(TAU * 98 * t) + 0.04 * Math.sin(TAU * 98.6 * t + ph[2]) + 0.035 * Math.sin(TAU * 146.83 * t + ph[3]) + 0.02 * Math.sin(TAU * 196.4 * t) + 0.012 * Math.sin(TAU * 50 * t);
    out[i] = nz[i] * kn * am + drone;
  }
  for (let t0 = 0; t0 < n / SR; t0 += 2 * BEAT) {
    const m = at(0.4), s0 = at(t0); let p = 0;
    for (let i = 0; i < m && s0 + i < n; i++) { const t = i / SR; p += (58 + 30 * Math.exp(-t / 0.03)) / SR; out[s0 + i] += 0.16 * Math.sin(TAU * p) * Math.min(1, t / 0.008) * Math.exp(-t / 0.12); }
  }
  biquad(out, 'lp', 900, 0.7);
  return out;
}

export function render() {
  const r = new Rng(303);
  const S = { drums: stereo(N), bass: stereo(N), harmony: stereo(N), lead: stereo(N), fx: stereo(N) };

  // ---------- 0-10.667 LEFT: cold TV layer (fx stem) ----------
  const tv = tvBed(r, at(DROP));
  mixMono(S.fx, tv, 0, 1, -0.7);
  gateOut(S.fx, DROP - 0.03, DROP);

  // ---------- 0-10.667 RIGHT: warm Rhodes + pad + soft bass ----------
  const warm = stereo(N), warmB = stereo(N);
  const RW = (f, v, d) => rhodes(f, v, d, { release: 0.6, bright: 0.7, tine: 0.5 });
  LOOP.forEach((ch, bar) => {
    strumChord(warm, RW, RH[ch], bar * BAR, BAR - 0.05, 0.42, { strum: 0.04, rng: r, pan: 0.7, spread: 0.15 });
    strumChord(warm, RW, RH[ch].slice(-2), bar * BAR + 2 * BEAT, BEAT * 1.8, 0.28, { strum: 0.03, rng: r, pan: 0.75, spread: 0.1 });
    const p = sawPad(RH[ch].map(nf), BAR, { attack: 0.5, release: 0.6, cutoff: 1100, voices: 2, detune: 0.1, width: 0.2, wave: 'tri', hp: 150, seed: 330 + bar });
    for (let i = 0; i < p[0].length; i++) { const m = 0.5 * (p[0][i] + p[1][i]); p[0][i] = m * 0.33; p[1][i] = m * 1.37; }
    mixStereo(warm, p, at(bar * BAR), 0.5);
    mixMono(warmB, subBass(nf(ROOT[ch]) * 2, 0.55, BAR - 0.1, { h2: 0.3, h3: 0.1, attack: 0.05, release: 0.3, decay: 1, sustain: 0.6 }), at(bar * BAR), 1, 0.5);
  });
  lpAuto(warm, [[0, 2200], [10, 2200], [10.6, 7000], [24, 7000]]);
  {
    const src = warm.map((c) => Float32Array.from(c));
    const w = plate(src[0], src[1], { tail: 0, decay: 0.6, damping: 0.5 });
    for (let i = 0; i < N; i++) { warm[0][i] += w[0][i] * 0.08; warm[1][i] += w[1][i] * 0.3; }
  }
  gateOut(warm, DROP - 0.06, DROP + 0.02); gateOut(warmB, DROP - 0.06, DROP + 0.02);
  addBus(S.harmony, warm); addBus(S.bass, warmB, 0.6);

  // ---------- 10.0-10.667 riser + swell ----------
  mixStereo(S.fx, noiseRiser(DROP - 10, { f0: 400, f1: 7000, q: 1.3, shape: 1.8, seed: 331 }), at(10), 0.3);
  mixStereo(S.fx, swell(DROP - 10 + 0.4, { seed: 332 }), at(DROP) - at(DROP - 10 + 0.4), 0.35);

  // ---------- groove 10.667-22.667 ----------
  const chordFor = (bar, s) => (bar === 7 && s >= 8 ? 'Bb13' : bar === 8 ? 'AbBb' : LOOP[bar % 4]);
  const K = kick({ f0: 115, f1: 50, pd: 0.03, ad: 0.3, click: 0.12, drive: 1.6, lp: 3500, len: 0.6, seed: 341 });
  const SN = snare({ tone: 185, toneAmt: 0.5, noiseAmt: 0.65, nDecay: 0.14, hp: 900, snap: 3200, lp: 8000, seed: 342 });
  const HH = [343, 344].map((s) => hat({ decay: 0.035, seed: s, hp: 6500, lp: 13000, metal: 0.35 }));
  const OH = hat({ open: true, decay: 0.22, len: 0.5, seed: 345, metal: 0.4, lp: 12000 });
  const CR = crash({ len: 2.6, decay: 1.3, seed: 346, lp: 11000 });
  for (let bar = 4; bar <= 8; bar++) {
    const steps = bar === 8 ? 8 : 16;
    for (const s of [0, 7, 10, ...(bar % 2 ? [15] : [])]) if (s < steps) mixMono(S.drums, K, at(bt(bar, s)), s === 0 ? 0.9 : 0.72, 0);
    for (const s of [4, 12]) if (s < steps) mixMono(S.drums, SN, at(bt(bar, s) + 0.015), 0.55, 0);
    for (const s of [3, 9, 14]) if (s < steps) mixMono(S.drums, SN, at(bt(bar, s)), 0.1, 0.1);
    for (let s = 0; s < steps; s++) {
      if (s === 14 && bar % 2) { mixMono(S.drums, OH, at(bt(bar, s)), 0.26, 0.3); continue; }
      mixMono(S.drums, HH[s % 2], at(bt(bar, s) + (s ? r.bi() * 0.004 : 0)), (s % 4 === 0 ? 0.36 : s % 2 ? 0.2 : 0.28) * (1 + 0.12 * r.bi()), 0.3);
    }
  }
  mixMono(S.drums, K, at(22.667), 0.7, 0);
  for (const [t, g] of [[16, 0.3], [22.667, 0.28]]) mixStereo(S.drums, CR, at(t), g);
  compressor(S.drums, { threshold: -20, ratio: 2.5, attackMs: 10, releaseMs: 120, knee: 6 });
  reverb(S.drums, 0.12, { decay: 0.45, damping: 0.5, size: 0.6, preHp: 300 });

  // round bass
  const RB = (f, v, d) => synthBass(f, v, d, { cutoff: 240, envAmt: 1.6, fDecay: 0.08, saw: 0.45, square: 0.15, sub: 0.85, decay: 0.5, sustain: 0.65, release: 0.06, drive: 1.3, seed: Math.round(f) });
  for (let bar = 4; bar <= 7; bar++) {
    const root = nf(ROOT[LOOP[bar % 4]]) * 2, next = nf(ROOT[bar === 7 ? 'AbBb' : LOOP[(bar + 1) % 4]]) * 2;
    mixMono(S.bass, RB(root, 0.95, 5 * STEP), at(bt(bar, 0)), 1, 0);
    mixMono(S.bass, RB(root * 2, 0.6, 1.5 * STEP), at(bt(bar, 7)), 0.8, 0);
    mixMono(S.bass, RB(root, 0.85, 3 * STEP), at(bt(bar, 10)), 1, 0);
    mixMono(S.bass, RB(next * Math.pow(2, -1 / 12), 0.7, 1.6 * STEP), at(bt(bar, 14)), 0.9, 0);
  }
  mixMono(S.bass, RB(nf('Bb1') * 2, 0.9, 7 * STEP), at(bt(8, 0)), 1, 0);
  mixMono(S.bass, synthBass(nf('Eb2'), 0.85, 1.2, { cutoff: 220, envAmt: 1.2, sub: 0.9, saw: 0.35, decay: 0.8, sustain: 0.5, release: 0.4 }), at(22.667), 1, 0);
  eq(S.bass, [['hp', 32, 0.7], ['lp', 1400, 0.7]]);

  // Rhodes comping + wide pad
  const rh = stereo(N);
  const RG = (f, v, d) => rhodes(f, v, d, { release: 0.3, bright: 0.9, tine: 0.8 });
  for (let bar = 4; bar <= 7; bar++) {
    const ch = LOOP[bar % 4];
    strumChord(rh, RG, RH[ch], bt(bar, 0) + 0.01, 5 * STEP, bar === 6 ? 0.68 : 0.55, { strum: 0.012, rng: r, spread: 0.4 });
    strumChord(rh, RG, RH[ch], bt(bar, 6), 1.5 * STEP, 0.38, { strum: 0.006, rng: r, spread: 0.4 });
    if (bar === 7) strumChord(rh, RG, RH.Bb13, 20, 4 * STEP, 0.66, { strum: 0.008, rng: r, spread: 0.4 });
    else strumChord(rh, RG, RH[ch], bt(bar, 10), 5 * STEP, 0.47, { strum: 0.01, rng: r, spread: 0.4 });
  }
  strumChord(rh, RG, RH.AbBb, bt(8, 0) + 0.01, 7 * STEP, 0.5, { strum: 0.012, rng: r, spread: 0.4 });
  strumChord(rh, (f, v, d) => rhodes(f, v, d, { release: 0.6, bright: 0.8, tine: 0.7 }), ['Eb3', ...RH.Ebmaj9], 22.667, 1.1, 0.55, { strum: 0.025, rng: r, spread: 0.5 });
  autoPan(rh, 3, [[0, 0.45], [24, 0.45]]);
  const rhw = wow(rh, { depth: 0.0004 });
  eq(rhw, [['hp', 120, 0.7], ['peak', 2500, 1, -2]]);
  reverb(rhw, 0.24, { decay: 0.6, damping: 0.45, predelay: 0.015 });
  addBus(S.harmony, rhw);
  const pad = stereo(N);
  for (let bar = 4; bar <= 8; bar++) {
    const ch = bar === 8 ? 'AbBb' : LOOP[bar % 4], d = bar === 8 ? 2 * BEAT : BAR;
    mixStereo(pad, sawPad(RH[ch].map((x) => nf(x)), d, { attack: 0.35, release: 0.5, cutoff: 1800, voices: 3, detune: 0.14, width: 1, hp: 160, seed: 350 + bar }), at(bar * BAR), 0.3);
    if (bar === 7) mixStereo(pad, sawPad(RH.Bb13.map(nf), 1.3, { attack: 0.1, release: 0.5, cutoff: 1800, voices: 3, detune: 0.14, width: 1, hp: 160, seed: 359 }), at(20), 0.2);
  }
  mixStereo(pad, sawPad(['Eb3', ...RH.Ebmaj9].map(nf), 1.3, { attack: 0.08, release: 0.8, cutoff: 2000, voices: 3, detune: 0.14, width: 1, hp: 140, seed: 360 }), at(22.667), 0.34);
  reverb(pad, 0.2, { decay: 0.65 });
  addBus(S.harmony, pad);

  // Karplus-Strong pluck counter-melody
  const mel = [[4, 8, 'C5', 2], [4, 10, 'Eb5', 1], [4, 11, 'F5', 1], [4, 12, 'G5', 4], [5, 2, 'F5', 2], [5, 4, 'D5', 2], [5, 6, 'Bb4', 2], [5, 8, 'C5', 6],
    [6, 6, 'Ab4', 2], [6, 8, 'C5', 2], [6, 10, 'Eb5', 2], [6, 12, 'G5', 2], [6, 14, 'F5', 2], [7, 0, 'Eb5', 4], [7, 6, 'C5', 2], [7, 8, 'D5', 4], [7, 12, 'F5', 2], [7, 14, 'Eb5', 2],
    [8, 0, 'C5', 4], [8, 4, 'Bb4', 4], [8, 8, 'G5', 8]];
  mel.forEach(([bar, s, nn, d], k) => mixMono(S.lead, ks(nf(nn), 0.75, d * STEP + 0.15, { t60: 0.9, bright: 0.55, release: 0.12, seed: 370 + k }), at(bt(bar, s)), 0.6, k % 2 ? 0.3 : -0.25));
  eq(S.lead, [['hp', 220, 0.7], ['peak', 1800, 1, 2], ['lp', 7000, 0.7]]);
  delay(S.lead, 0.16, { time: BEAT * 0.75, feedback: 0.28, lp: 4000 });
  reverb(S.lead, 0.2, { decay: 0.55 });

  // accents 16.0 / 20.0: reverse-cymbal swells
  for (const [t, d] of [[16, 1.333], [20, 1.333]]) mixStereo(S.fx, swell(d, { seed: 380 + t }), at(t - d), 0.3);

  balanceStems(S, { drums: -21, bass: -22.5, harmony: -20.5, lead: -24.5, fx: -24 });
  fadeAll(S, 22.95, 24.0);
  return {
    stems: S,
    master: { target: -16, glueThreshold: -16, glueRatio: 2, eq: [['lowshelf', 100, 0.7, 1], ['highshelf', 9000, 0.7, 0.5]], ceiling: -1.3 },
  };
}
