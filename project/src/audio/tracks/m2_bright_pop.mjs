// m2_bright_pop: bright feel-good pop/house. 120 BPM (beat 0.5 s, bar 2 s), 22.000 s, D major.
import { SR, TAU, Rng, nf, stereo, mono, mixMono, mixStereo, eq, addBus, saturate } from '../dsp.mjs';
import { compressor, duckEnv } from '../fx.mjs';
import { sawPad, pluck, synthBass } from '../inst/synth.mjs';
import { kick, snare, clap, hat, crash, swell, noiseRiser, shaker } from '../inst/perc.mjs';
import { at, reverb, delay, lpAuto, strumChord, fadeAll, mulEnvBus, balanceStems } from './common.mjs';

export const meta = {
  bpm: 120, key: 'D major', duration: 22,
  chords: 'D | A | Bm | G (A push 7.5) | D | A | Bm | G ... stabs Bm 16.5, G 17.5, A 18.5 -> D(add9) 19.0',
  instruments: 'punchy sine kick 4-on-the-floor, clap 2&4, offbeat open hats + 16th closed hats, shaker, crashes, snare-roll fill, supersaw pad with sidechain pump, detuned-saw pluck stabs, offbeat octave saw bass, pluck arpeggio, sub impacts, noise riser, reverse-cymbal swells',
  sections: [
    { t: 0, label: 'starts on a hit (kick + crash + sub impact + stab) with the full groove' },
    { t: 3, label: 'accent: crash + big stab (A)' },
    { t: 7.5, label: 'accent: crash + pushed A stab' },
    { t: 12, label: 'accent: crash + Bm stab (reverse cymbal into it)' },
    { t: 15.5, label: 'kick/bass drop out, snare roll + noise riser' },
    { t: 16.5, label: 'high-energy section; strong stabs 16.5 / 17.5 / 18.5' },
    { t: 19, label: 'final hit (D add9) + sustained chord, light groove to 21.0, fade to 22.0' },
  ],
  checks: [{ t: 0, label: 'start hit' }, { t: 3, label: 'accent' }, { t: 7.5, label: 'accent' }, { t: 12, label: 'accent' }, { t: 15.5, label: 'fill start' }, { t: 16.5, label: 'drop stab' }, { t: 17.5, label: 'stab' }, { t: 18.5, label: 'stab' }, { t: 19, label: 'final hit' }, { t: 21, label: 'groove out' }],
  marks: [3, 7.5, 12, 15.5, 16.5, 17.5, 18.5, 19, 21],
};

const DUR = 22, BEAT = 0.5, N = Math.round(DUR * SR);
const V = { D: ['D4', 'F#4', 'A4', 'D5'], A: ['C#4', 'E4', 'A4', 'C#5'], Bm: ['D4', 'F#4', 'B4', 'D5'], G: ['D4', 'G4', 'B4', 'D5'] };
const PADV = { D: ['A3', 'D4', 'F#4', 'A4'], A: ['A3', 'C#4', 'E4', 'A4'], Bm: ['B3', 'D4', 'F#4', 'B4'], G: ['B3', 'D4', 'G4', 'B4'] };
const ARP = { D: ['D5', 'F#5', 'A5', 'D6'], A: ['C#5', 'E5', 'A5', 'C#6'], Bm: ['B4', 'D5', 'F#5', 'B5'], G: ['B4', 'D5', 'G5', 'B5'] };
const ROOT = { D: 'D2', A: 'A1', Bm: 'B1', G: 'G1' };
const CH = [[0, 2, 'D'], [2, 4, 'A'], [4, 6, 'Bm'], [6, 7.5, 'G'], [7.5, 8, 'A'], [8, 10, 'D'], [10, 12, 'A'], [12, 14, 'Bm'], [14, 16.5, 'G'], [16.5, 17.5, 'Bm'], [17.5, 18.5, 'G'], [18.5, 19, 'A'], [19, 22, 'D']];
const chordAt = (t) => (CH.find(([s, e]) => t >= s - 1e-6 && t < e - 1e-6) ?? CH[CH.length - 1])[2];

function subImpact() {
  const n = at(1.2), x = mono(n);
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, f = 38 + 30 * Math.exp(-t / 0.12); ph += f / SR; x[i] = Math.sin(TAU * ph) * Math.min(1, t / 0.003) * Math.exp(-t / 0.4); }
  return saturate(x, 1.8);
}

export function render() {
  const r = new Rng(202);
  const S = { drums: stereo(N), bass: stereo(N), harmony: stereo(N), lead: stereo(N), fx: stereo(N) };
  const ACC = [3, 7.5, 12], DROP = [16.5, 17.5, 18.5];

  // ---------- drums ----------
  const K = kick({ f0: 150, f1: 50, pd: 0.032, ad: 0.26, click: 0.3, drive: 1.8, len: 0.5, seed: 211 });
  const KS = kick({ f0: 120, f1: 50, pd: 0.03, ad: 0.2, click: 0.1, drive: 1.3, len: 0.4, lp: 3000, seed: 212 });
  const CL = clap({ seed: 213, tail: 0.18, bp: 1400 }), SN = snare({ tone: 200, noiseAmt: 0.8, nDecay: 0.12, seed: 214 });
  const HC = hat({ decay: 0.03, seed: 215, metal: 0.4 }), HO = hat({ open: true, decay: 0.16, len: 0.35, seed: 216, metal: 0.45 });
  const CR = crash({ len: 2.6, decay: 1.2, seed: 217 }), SH = shaker({ seed: 218 });
  const kickTimes = [];
  for (let k = 0; k < 31; k++) kickTimes.push(k * BEAT);
  kickTimes.push(16.5, 17, 17.5, 18, 18.5, 19);
  for (const t of kickTimes) mixMono(S.drums, K, at(t), [0, 16.5, 19].includes(t) ? 1 : 0.85, 0);
  mixMono(S.drums, KS, at(20), 0.5, 0);
  for (let bar = 0; bar < 8; bar++) for (const b of [1, 3]) { const t = bar * 2 + b * BEAT; if (t < 15.5) mixMono(S.drums, CL, at(t), 0.6, 0); }
  for (const t of [17, 18]) mixMono(S.drums, CL, at(t), 0.7, 0);
  mixMono(S.drums, CL, at(20.5), 0.32, 0);
  for (let k = 0; k < 42; k++) { const t = k * BEAT + 0.25; if (t >= 21) break; if (t > 15.4 && t < 16.5) continue; mixMono(S.drums, HO, at(t), t > 19 ? 0.22 : 0.38, 0.2); }
  for (let k = 0; k < 168; k++) {
    const t = k * 0.125; if (k % 4 === 2 || (t > 15.4 && t < 16.5)) continue;
    mixMono(S.drums, HC, at(t + (k % 4 ? r.bi() * 0.003 : 0)), (k % 4 === 0 ? 0.24 : 0.15) * (1 + 0.15 * r.bi()), -0.25);
  }
  for (let k = 64; k < 168; k++) { const t = k * 0.125; if (t > 15.4 && t < 16.5) continue; mixMono(S.drums, SH, at(t), k % 2 ? 0.12 : 0.18, 0.35); }
  for (const t of [0, 3, 7.5, 12, 16.5, 19]) mixStereo(S.drums, CR, at(t), t === 0 || t >= 16.5 ? 0.5 : 0.38);
  const fill = [15.5, 15.625, 15.75, 15.875];
  for (let k = 0; k < 8; k++) fill.push(16 + k * 0.0625);
  fill.forEach((t, k) => mixMono(S.drums, SN, at(t), 0.22 + (0.5 * k) / (fill.length - 1), 0));
  compressor(S.drums, { threshold: -18, ratio: 2.5, attackMs: 10, releaseMs: 100, knee: 6 });
  reverb(S.drums, 0.1, { decay: 0.4, damping: 0.4, size: 0.5, preHp: 400 });

  const pump = duckEnv(N, kickTimes, { depthDb: -9, attackMs: 3, holdMs: 15, releaseMs: 190 });
  const pumpL = duckEnv(N, kickTimes, { depthDb: -5, attackMs: 3, holdMs: 10, releaseMs: 150 });

  // ---------- bass: offbeat octave bounce ----------
  const BS = (f, v, d) => synthBass(f, v, d, { cutoff: 380, envAmt: 2.5, fDecay: 0.09, saw: 0.6, square: 0.3, sub: 0.55, decay: 0.15, sustain: 0.6, release: 0.04, drive: 1.6 });
  for (let b = 0; b < 38; b++) {
    const t = b * BEAT + 0.25; if (t >= 19) break; if (t > 15.4 && t < 16.5) continue;
    const root = nf(ROOT[chordAt(t)]);
    mixMono(S.bass, BS(b % 2 ? root * 2 : root, 0.9, 0.19), at(t), 1, 0);
  }
  for (let bar = 1; bar < 7; bar += 2) { const t = bar * 2 + 1.875; mixMono(S.bass, BS(nf(ROOT[chordAt(t)]) * 1.5, 0.6, 0.1), at(t), 0.8, 0); }
  mixMono(S.bass, synthBass(nf('D2'), 0.9, 1.9, { cutoff: 300, envAmt: 2, fDecay: 0.2, sub: 0.8, decay: 1.2, sustain: 0.4, release: 0.8 }), at(19), 1, 0);
  eq(S.bass, [['hp', 32, 0.7]]);
  mulEnvBus(S.bass, pumpL);

  // ---------- harmony: pluck stabs + supersaw pad ----------
  const stab = stereo(N);
  const ST = (f, v, d) => pluck(f, v, d, { voices: 2, detuneCents: 9, fHi: 5200, fLo: 700, fDecay: 0.1, decay: 0.22, release: 0.06, q: 1.2, seed: Math.round(f) });
  const STB = (f, v, d) => pluck(f, v, d, { voices: 3, detuneCents: 12, fHi: 7000, fLo: 900, fDecay: 0.16, decay: 0.45, release: 0.15, q: 1.0, sub: 0.3, seed: Math.round(f) + 7 });
  for (let bar = 0; bar < 8; bar++) for (const e of [0, 3, 6]) {
    const t = bar * 2 + e * 0.25; if (t >= 15.5 || ACC.includes(t)) continue;
    strumChord(stab, ST, V[chordAt(t)], t, 0.16, 0.7, { strum: 0.003, rng: r, spread: 0.5 });
  }
  for (const t of [0, ...ACC, ...DROP]) strumChord(stab, STB, V[chordAt(t)], t, 0.3, 1, { strum: 0.003, rng: r, spread: 0.6 });
  for (let t = 16.75; t < 19; t += 0.25) if (!DROP.includes(t)) strumChord(stab, ST, V[chordAt(t)], t, 0.1, 0.45, { strum: 0.002, rng: r, spread: 0.5 });
  strumChord(stab, (f, v, d) => pluck(f, v, d, { voices: 3, detuneCents: 10, fHi: 6000, fLo: 1200, fDecay: 0.5, decay: 1.4, sustain: 0.2, release: 0.9, q: 0.9, sub: 0.2, seed: 9 }),
    ['D4', 'F#4', 'A4', 'D5', 'E5'], 19, 1.9, 1, { strum: 0.006, rng: r, spread: 0.7 });
  mulEnvBus(stab, pumpL);
  eq(stab, [['hp', 200, 0.7], ['peak', 3000, 1, -1.5]]);
  delay(stab, 0.12, { time: 0.375, feedback: 0.25, lp: 4000 });
  reverb(stab, 0.18, { decay: 0.55, damping: 0.4 });
  addBus(S.harmony, stab);

  const pad = stereo(N);
  for (const [s, e, ch] of CH) {
    if (s >= 19) continue;
    mixStereo(pad, sawPad(PADV[ch].map(nf), e - s, { attack: 0.04, release: 0.25, cutoff: 7000, voices: 5, detune: 0.18, width: 1, q: 0.7, hp: 180, seed: 400 + Math.round(s * 10) }), at(s), 0.3);
  }
  mixStereo(pad, sawPad(['A3', 'D4', 'F#4', 'A4', 'E5'].map(nf), 2.0, { attack: 0.02, release: 1.0, cutoff: 7000, voices: 5, detune: 0.16, width: 1, hp: 180, seed: 499 }), at(19), 0.4);
  mulEnvBus(pad, pump);
  lpAuto(pad, [[0, 2600], [15.5, 2600], [16.45, 8000], [16.5, 4800], [19, 4800], [22, 3200]]);
  reverb(pad, 0.15, { decay: 0.5 });
  addBus(S.harmony, pad);

  // ---------- lead: pluck arpeggio (8ths from 8.0, 16ths in the high-energy part) ----------
  const seq = [0, 2, 1, 3, 2, 1, 3, 2];
  const AP = (f, v, d, k) => pluck(f, v, d, { voices: 1, wave: 'square', fHi: 4500, fLo: 900, fDecay: 0.06, decay: 0.15, release: 0.04, seed: 600 + k });
  let k = 0;
  for (let t = 8; t < 15.5; t += 0.25, k++) mixMono(S.lead, AP(nf(ARP[chordAt(t)][seq[k % 8]]), 0.6, 0.12, k), at(t), 0.5, k % 2 ? 0.3 : -0.3);
  for (let t = 16.5; t < 19; t += 0.125, k++) mixMono(S.lead, AP(nf(ARP[chordAt(t)][seq[k % 8]]), 0.55, 0.08, k), at(t), 0.42, k % 2 ? 0.35 : -0.35);
  eq(S.lead, [['hp', 400, 0.7]]);
  delay(S.lead, 0.2, { time: 0.375, timeR: 0.25, feedback: 0.3, lp: 5000 });
  reverb(S.lead, 0.15, { decay: 0.5 });

  // ---------- fx: impacts, swells, riser ----------
  const imp = subImpact();
  for (const t of [0, 19]) mixMono(S.fx, imp, at(t), 0.8, 0);
  for (const [t, d] of [[12, 1.0], [16.5, 1.0], [19, 0.5]]) mixStereo(S.fx, swell(d, { seed: 230 + t }), at(t - d), 0.35);
  const rs = noiseRiser(1.0, { f0: 600, f1: 9000, q: 1.2, shape: 2, seed: 231 });
  mixStereo(S.fx, rs, at(15.5), 0.25);

  balanceStems(S, { drums: -19.5, bass: -21.5, harmony: -20.5, lead: -25, fx: -25 });
  fadeAll(S, 21.1, 22.0);
  return {
    stems: S,
    master: { target: -16, glueThreshold: -14, glueRatio: 2.5, glueAttack: 15, glueRelease: 150, softClip: 0.85, eq: [['lowshelf', 80, 0.7, 1], ['highshelf', 8000, 0.7, 1.5]], ceiling: -1.3 },
  };
}
