// m1_lofi_night: mellow night lo-fi hip-hop. 80 BPM (beat 0.75 s, bar 3 s), 24.000 s, C major / F-lydian colour.
import { SR, Rng, nf, stereo, mixMono, mixStereo, eq, fadeIn, fadeOut, addBus } from '../dsp.mjs';
import { plate, compressor, duckEnv } from '../fx.mjs';
import { rhodes } from '../inst/keys.mjs';
import { sawPad, subBass, softLead } from '../inst/synth.mjs';
import { kick, snare, rim, hat, vinyl } from '../inst/perc.mjs';
import { at, reverb, delay, lpAuto, autoPan, wow, widthAuto, strumChord, fadeAll, gateOut, gateIn, mulEnvBus, balanceStems } from './common.mjs';

export const meta = {
  bpm: 80, key: 'C major (F lydian colour)', duration: 24,
  chords: 'intro Am9 | Fmaj9 | Em11 | Dm9 | Cmaj9 | Fmaj9 | Em11 Dm9 | Cmaj9 (final)',
  instruments: 'FM Rhodes (wow/flutter, autopan), detuned-saw night pad, reversed Rhodes swell, sine sub bass, soft kick, rim+snare, swung 16th hats, open hats, vinyl crackle, soft flute/bell lead',
  sections: [
    { t: 0, label: 'intro: dark pad + reversed Rhodes Am9 swell into 3.0, no drums' },
    { t: 3, label: 'beat in exactly on 3.000 (kick, rim/snare 2&4, swung hats, crackle, sub, Rhodes; dusty LP ~4.5-5 kHz)' },
    { t: 15, label: 'opens up: LP to ~12 kHz, open hats, lead melody, wider pad/Rhodes' },
    { t: 21, label: 'drums stop; final Cmaj9 + reverb tail; fade 23.4-24.0' },
  ],
  checks: [{ t: 3, label: 'beat in' }, { t: 15, label: 'open-up' }, { t: 21, label: 'drums stop' }],
  marks: [3, 15, 21, 23.4],
};

const DUR = 24, BEAT = 0.75, STEP = BEAT / 4, SWING = 0.03, N = Math.round(DUR * SR);
const stepT = (bar, s) => 3 * bar + s * STEP + (s % 2 ? SWING : 0);

export function render() {
  const r = new Rng(101);
  const S = { drums: stereo(N), bass: stereo(N), harmony: stereo(N), lead: stereo(N), fx: stereo(N) };

  // ---------- pad (night bed) ----------
  const pad = stereo(N);
  const pads = [
    [0, 3, ['A2', 'E3', 'G3', 'B3'], 650, 0.55, 1.6],
    [3, 6, ['F3', 'C4', 'E4'], 950, 0.3, 0.3],
    [6, 9, ['E3', 'B3', 'D4'], 950, 0.3, 0.3],
    [9, 12, ['D3', 'A3', 'C4'], 950, 0.3, 0.3],
    [12, 15, ['C3', 'G3', 'B3'], 950, 0.3, 0.3],
    [15, 18, ['F3', 'C4', 'E4', 'A4'], 1700, 0.34, 0.3],
    [18, 19.5, ['E3', 'B3', 'D4', 'G4'], 1700, 0.34, 0.25],
    [19.5, 21, ['D3', 'A3', 'C4', 'F4'], 1700, 0.34, 0.25],
    [21, 24, ['C3', 'G3', 'B3', 'D4'], 1300, 0.36, 0.2],
  ];
  for (const [s, e, notes, cut, g, a] of pads) {
    const last = e >= DUR;
    const p = sawPad(notes.map(nf), e - s + (last ? 0 : 0.15), { attack: a, release: last ? 0.5 : 0.9, cutoff: cut, voices: 3, detune: 0.12, width: 0.9, q: 0.6, lp2: true, hp: 110, seed: 300 + s * 10 });
    mixStereo(pad, p, at(s), g);
  }
  widthAuto(pad, [[0, 1], [14.8, 1], [15.3, 1.35], [21, 1.35], [24, 1.2]]);
  reverb(pad, 0.25, { decay: 0.7, damping: 0.5, predelay: 0.02 });
  addBus(S.harmony, pad);

  // ---------- reversed Rhodes swell into 3.0 ----------
  {
    const len = at(2.6), m = new Float32Array(len);
    ['A2', 'G3', 'B3', 'C4', 'E4'].forEach((nn, k) => {
      const x = rhodes(nf(nn), 0.55, 2.2, { release: 0.3, bright: 0.8 });
      for (let i = 0; i < Math.min(len, x.length); i++) m[i] += x[i] * (k === 0 ? 0.5 : 0.8);
    });
    const dry = [m, Float32Array.from(m)], wet = plate(dry[0], dry[1], { decay: 0.82, damping: 0.45, predelay: 0.02, tail: 1.2 });
    const n2 = wet[0].length, swellLen = at(2.4);
    const rev = [0, 1].map((c) => {
      const x = new Float32Array(n2);
      for (let i = 0; i < n2; i++) x[i] = (i < len ? dry[c][i] * 0.5 : 0) + wet[c][i] * 1.1;
      const y = Float32Array.from(x.reverse().subarray(n2 - swellLen));
      fadeIn(y, 0.9); return fadeOut(y, 0.012);
    });
    eq(rev, [['hp', 120, 0.7], ['lp', 5000, 0.7]]);
    mixStereo(S.harmony, rev, at(3) - swellLen, 0.75);
  }

  // ---------- Rhodes comping ----------
  const rh = stereo(N);
  const RH = (f, v, d) => rhodes(f, v, d, { release: 0.35, bright: 0.85, tine: 0.7 });
  for (const [t0, v] of [[3, ['A3', 'C4', 'E4', 'G4']], [6, ['G3', 'A3', 'B3', 'D4']], [9, ['F3', 'A3', 'C4', 'E4']], [12, ['E3', 'G3', 'B3', 'D4']], [15, ['A3', 'C4', 'E4', 'G4']]]) {
    strumChord(rh, RH, v, t0, 7 * STEP, 0.55, { strum: 0.014, rng: r, spread: 0.3 });
    strumChord(rh, RH, v, t0 + 10 * STEP + SWING, 5.5 * STEP, 0.42, { strum: 0.01, rng: r, spread: 0.3 });
  }
  strumChord(rh, RH, ['G3', 'A3', 'B3', 'D4'], 18, 1.4, 0.52, { strum: 0.014, rng: r, spread: 0.3 });
  strumChord(rh, RH, ['F3', 'A3', 'C4', 'E4'], 19.5, 1.4, 0.5, { strum: 0.014, rng: r, spread: 0.3 });
  strumChord(rh, (f, v, d) => rhodes(f, v, d, { release: 0.5, bright: 0.8, tine: 0.6 }), ['C3', 'E3', 'G3', 'B3', 'D4'], 21, 2.6, 0.5, { strum: 0.03, rng: r, spread: 0.4 });
  autoPan(rh, 3.5, [[0, 0.3], [14.8, 0.3], [15.2, 0.5], [24, 0.5]]);
  const rhw = wow(rh);
  eq(rhw, [['hp', 110, 0.7], ['peak', 2600, 1, -2.5]]);
  lpAuto(rhw, [[0, 4500], [14.85, 4500], [15, 9000], [21, 9000], [24, 7000]]);
  reverb(rhw, 0.28, { decay: 0.65, damping: 0.45, predelay: 0.015 });
  addBus(S.harmony, rhw, 0.85);

  // ---------- drums 3.0-21.0 ----------
  const K = kick({ f0: 105, f1: 47, pd: 0.03, ad: 0.28, click: 0.08, drive: 1.6, lp: 2600, len: 0.6, seed: 111 });
  const SN = snare({ tone: 180, toneAmt: 0.45, noiseAmt: 0.55, nDecay: 0.15, hp: 900, snap: 3000, lp: 6500, seed: 112 });
  const RM = rim({ f: 1650, seed: 113 });
  const HH = [114, 115, 116].map((s) => hat({ decay: 0.032, seed: s, hp: 6500, lp: 12000, metal: 0.3 }));
  const OH = hat({ open: true, decay: 0.24, seed: 117, lp: 12000, metal: 0.35, len: 0.6 });
  const kickTimes = [];
  for (let bar = 1; bar <= 6; bar++) {
    const open = bar >= 5;
    for (const s of bar % 2 ? [0, 10] : [0, 7, 10]) { const t = stepT(bar, s); kickTimes.push(t); mixMono(S.drums, K, at(t), s === 0 ? 0.9 : 0.72, 0); }
    for (const s of [4, 12]) { const t = stepT(bar, s) + 0.012; mixMono(S.drums, RM, at(t), 0.42, 0.05); mixMono(S.drums, SN, at(t + 0.003), 0.4, 0); }
    for (let s = 0; s < 16; s++) {
      if (open && (s === 6 || s === 14)) { mixMono(S.drums, OH, at(stepT(bar, s)), 0.3, 0.25); continue; }
      if (s % 2 && r.chance(0.15)) continue;
      const v = (s % 4 === 0 ? 0.42 : s % 2 === 0 ? 0.33 : 0.21) * (1 + 0.15 * r.bi());
      mixMono(S.drums, HH[r.int(0, 2)], at(stepT(bar, s) + (s ? r.bi() * 0.004 : 0)), v, 0.25 + 0.05 * r.bi());
    }
    if (bar % 2 === 0) mixMono(S.drums, SN, at(stepT(bar, 15)), 0.12, 0);
  }
  compressor(S.drums, { threshold: -22, ratio: 3, attackMs: 8, releaseMs: 120, knee: 6 });
  reverb(S.drums, 0.12, { decay: 0.35, damping: 0.5, size: 0.45, predelay: 0.005, preHp: 300 });
  lpAuto(S.drums, [[0, 5200], [14.85, 5200], [15, 13000], [24, 13000]]);
  gateOut(S.drums, 21.0, 21.25);

  // ---------- bass ----------
  const B = { h2: 0.35, h3: 0.12, drive: 1.5, attack: 0.012, release: 0.09, decay: 0.5, sustain: 0.75 };
  for (const [t0, rt, fifth] of [[3, 'F2', 'C3'], [6, 'E2', 'B2'], [9, 'D2', 'A2'], [12, 'C2', 'G2'], [15, 'F2', 'C3']]) {
    mixMono(S.bass, subBass(nf(rt), 0.9, 7 * STEP, B), at(t0), 1, 0);
    mixMono(S.bass, subBass(nf(rt), 0.7, 3 * STEP, B), at(t0 + 10 * STEP), 1, 0);
    mixMono(S.bass, subBass(nf(fifth), 0.55, 1.5 * STEP, B), at(t0 + 14 * STEP + SWING), 1, 0);
  }
  mixMono(S.bass, subBass(nf('E2'), 0.9, 1.4, B), at(18), 1, 0);
  mixMono(S.bass, subBass(nf('D2'), 0.85, 1.3, B), at(19.5), 1, 0);
  mixMono(S.bass, subBass(nf('C2'), 0.8, 2.3, { ...B, release: 0.5, decay: 1.5, sustain: 0.5 }), at(21), 1, 0);
  eq(S.bass, [['hp', 30, 0.7], ['lp', 800, 0.7]]);
  mulEnvBus(S.bass, duckEnv(N, kickTimes, { depthDb: -3, releaseMs: 140 }));

  // ---------- lead (15-21, last note rings into the final chord) ----------
  const mel = [[0, 'A5', 1.5], [1.5, 'G5', 0.5], [2, 'E5', 1], [3, 'C5', 0.5], [3.5, 'D5', 0.5], [4, 'E5', 1], [5, 'G5', 0.5], [5.5, 'A5', 0.5], [6, 'F5', 0.5], [6.5, 'E5', 0.5], [7, 'D5', 0.5], [7.5, 'E5', 3.6]];
  for (const [b, nn, d] of mel) {
    const x = softLead(nf(nn), 0.7, d * BEAT * 0.95, { attack: 0.03, release: 0.3, vibCents: 9, breath: 0.06, bell: 0.4, seed: 700 + Math.round(b * 2) });
    mixMono(S.lead, x, at(15 + b * BEAT), 0.5, 0.1);
  }
  eq(S.lead, [['hp', 250, 0.7], ['peak', 2800, 1, -1.5]]);
  delay(S.lead, 0.22, { time: 0.5625, feedback: 0.3, lp: 3500, hp: 400 });
  reverb(S.lead, 0.32, { decay: 0.7, damping: 0.4, predelay: 0.02 });

  // ---------- fx: vinyl crackle from 3.0 ----------
  const vc = vinyl(N, { rate: 20, hiss: 0.025, seed: 121 });
  eq(vc, [['lp', 8000, 0.7]]);
  gateIn(vc, 2.96, 3.0);
  mixStereo(S.fx, vc, 0, 0.12);

  balanceStems(S, { drums: -21, bass: -22.5, harmony: -21, lead: -22, fx: -40 });
  fadeAll(S, 23.4, 24.0);
  return {
    stems: S,
    master: { target: -16, glueThreshold: -17, glueRatio: 2, eq: [['lowshelf', 90, 0.7, 1], ['highshelf', 9000, 0.7, -1]], ceiling: -1.3 },
  };
}
