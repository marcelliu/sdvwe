// Seamless ambience loops. Noise beds are rendered long and cross-faded (equal power) at the seam;
// tonal/periodic parts use exact loop periods; discrete events are written into a circular buffer.
import { SR, TAU, Rng, pink, white, brown, biquad, svf, mono, panGains, nf } from '../dsp.mjs';

const len = (s) => Math.max(1, Math.round(s * SR));
const rms = (x) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, x.length)) || 1e-9; };
const norm = (x, target) => { const k = target / rms(x); for (let i = 0; i < x.length; i++) x[i] *= k; return x; };

/** x has N + X samples; returns N samples whose end flows into its start. */
export function loopify(chs, N, X) {
  return chs.map((x) => {
    const y = x.slice(0, N);
    for (let i = 0; i < X; i++) { const t = i / X; y[i] = x[i] * Math.sin((t * Math.PI) / 2) + x[N + i] * Math.cos((t * Math.PI) / 2); }
    return y;
  });
}
function placeCircular(bus, sig, start, gain = 1, pan = 0) {
  const N = bus[0].length, [gl, gr] = panGains(pan);
  for (let i = 0; i < sig.length; i++) { const j = (((start + i) % N) + N) % N; bus[0][j] += sig[i] * gain * gl; bus[1][j] += sig[i] * gain * gr; }
}
function periodicLFO(N, loopSec, comps, r) {
  const out = mono(N), ph = comps.map(() => r.next() * TAU);
  for (let i = 0; i < N; i++) { const t = i / SR; let v = 0; comps.forEach(([k, a], j) => { v += a * Math.sin((TAU * k * t) / loopSec + ph[j]); }); out[i] = v; }
  return out;
}

/** Muffled TV in another room: LP noise with slow (<=0.25 Hz) swells, mains hum, distant sustained tones. Not speech-like. */
export function tvNoiseLoop() {
  const sec = 12, N = len(sec), X = len(1.5), r = new Rng(1001);
  const a = pink(N + X, r), b = pink(N + X, r);
  for (const x of [a, b]) { biquad(x, 'lp', 650, 0.6); biquad(x, 'lp', 900, 0.6); biquad(x, 'hp', 110, 0.7); biquad(x, 'peak', 350, 1, 3); norm(x, 0.1); }
  const bed = loopify([a, b], N, X), L = mono(N), R = mono(N);
  const am = periodicLFO(N, sec, [[1, 0.5], [2, 0.3], [3, 0.2]], r);
  for (let i = 0; i < N; i++) {
    const g = 0.75 + 0.25 * am[i];
    L[i] = (0.85 * bed[0][i] + 0.15 * bed[1][i]) * g;
    R[i] = (0.15 * bed[0][i] + 0.85 * bed[1][i]) * g;
  }
  for (let i = 0; i < N; i++) {
    const t = i / SR, h = 0.004 * Math.sin(TAU * 50 * t) + 0.007 * Math.sin(TAU * 100 * t + 0.4) + 0.002 * Math.sin(TAU * 150 * t + 1.3);
    L[i] += h; R[i] += h;
  }
  const bus = [L, R];
  const segs = [[0, 2.8, ['D3', 'A3']], [2.4, 2.6, ['F3', 'C4']], [4.6, 3.0, ['C3', 'G3']], [7.2, 2.8, ['Bb2', 'F3']], [9.6, 2.9, ['D3', 'A3']]];
  for (const [t0, d, notes] of segs) {
    const m = len(d), s = mono(m), fade = len(0.45);
    notes.forEach((nn, k) => {
      const f = nf(nn); let ph = r.next();
      for (let i = 0; i < m; i++) { ph += f / SR; if (ph >= 1) ph -= 1; s[i] += (1 - 4 * Math.abs(ph - 0.5)) * (k ? 0.6 : 1); }
    });
    for (let i = 0; i < m; i++) s[i] *= Math.min(1, i / fade, (m - 1 - i) / fade);
    biquad(s, 'lp', 380, 0.7); biquad(s, 'lp', 500, 0.7);
    placeCircular(bus, s, len(t0), 0.035, -0.1);
  }
  for (const t0 of [1.7, 5.9, 9.3]) {
    const m = len(0.25), s = mono(m); let ph = 0;
    for (let i = 0; i < m; i++) { const t = i / SR; ph += (70 + 40 * Math.exp(-t / 0.02)) / SR; s[i] = Math.sin(TAU * ph) * Math.min(1, t / 0.006) * Math.exp(-t / 0.06); }
    biquad(s, 'lp', 220, 0.7);
    placeCircular(bus, s, len(t0), 0.05, 0);
  }
  return bus;
}

/** Rain on a car roof/windshield at night: hiss bed, droplet ticks, roof plinks, cabin rumble. Stereo, 30 s. */
export function rainCarLoop() {
  const sec = 30, N = len(sec), X = len(2), M = N + X, r = new Rng(1101);
  const hs = [pink(M, r), pink(M, r)];
  for (const x of hs) { biquad(x, 'hp', 350, 0.7); biquad(x, 'lp', 7500, 0.7); biquad(x, 'peak', 2800, 0.8, 2); norm(x, 0.1); }
  const drops = [mono(M), mono(M)];
  for (const x of drops) {
    let pos = 0;
    for (;;) {
      pos += Math.max(1, Math.round((-Math.log(1 - r.next()) / 150) * SR));
      if (pos >= M) break;
      x[pos] += (r.chance(0.5) ? 1 : -1) * (0.05 + 0.95 * Math.pow(r.next(), 4));
    }
    const y = Float32Array.from(x), z = Float32Array.from(x);
    biquad(y, 'bp', 3500, 0.9); biquad(z, 'bp', 1400, 1.8); biquad(x, 'hp', 5000, 0.7);
    for (let i = 0; i < M; i++) x[i] = y[i] + z[i] * 0.6 + x[i] * 0.15;
    norm(x, 0.06);
  }
  const rb = brown(M, r); biquad(rb, 'lp', 160, 0.7); biquad(rb, 'hp', 30, 0.7); norm(rb, 0.045);
  const pre = [0, 1].map((c) => { const x = mono(M); for (let i = 0; i < M; i++) x[i] = hs[c][i] + drops[c][i] + rb[i]; return x; });
  const bus = loopify(pre, N, X);
  for (let k = 0; k < sec * 6; k++) {
    const m = len(0.06), s = mono(m), f = r.range(2200, 4800), fl = r.range(280, 420), d = r.range(0.01, 0.025);
    let p1 = 0, p2 = 0;
    for (let i = 0; i < m; i++) { const t = i / SR; p1 += f / SR; p2 += fl / SR; s[i] = (Math.sin(TAU * p1) * Math.exp(-t / d) * 0.5 + Math.sin(TAU * p2) * Math.exp(-t / 0.02)) * Math.min(1, i / 12); }
    placeCircular(bus, s, len(r.next() * sec), 0.02 + 0.06 * Math.pow(r.next(), 2), r.bi() * 0.8);
  }
  return bus;
}

/** Quiet night apartment: 50 Hz fridge hum + compressor whir, distant city wash, one far car pass, air. 30 s. */
export function roomToneNight() {
  const sec = 30, N = len(sec), X = len(2), M = N + X, r = new Rng(1201);
  const wh = [pink(M, r), pink(M, r)], city = [pink(M, r), pink(M, r)], air = [pink(M, r), pink(M, r)];
  for (const x of wh) { const y = Float32Array.from(x); svf(x, 'bp', 180, 1.4); svf(y, 'bp', 420, 2); for (let i = 0; i < M; i++) x[i] += y[i] * 0.5; norm(x, 0.02); }
  for (const x of city) { biquad(x, 'lp', 300, 0.7); biquad(x, 'lp', 300, 0.7); biquad(x, 'hp', 40, 0.7); norm(x, 0.05); }
  for (const x of air) { biquad(x, 'hp', 3000, 0.7); biquad(x, 'lp', 9000, 0.7); norm(x, 0.006); }
  const pre = [0, 1].map((c) => { const x = mono(M); for (let i = 0; i < M; i++) x[i] = wh[c][i] + city[c][i] + air[c][i]; return x; });
  const bus = loopify(pre, N, X);
  const wob = periodicLFO(N, sec, [[1, 0.6], [3, 0.4]], r), swell = periodicLFO(N, sec, [[1, 0.5], [2, 0.3], [3, 0.2]], r);
  const H = [[50, 0.45], [100, 1], [150, 0.4], [200, 0.22], [250, 0.08], [300, 0.1], [400, 0.04]];
  for (let i = 0; i < N; i++) {
    const t = i / SR; let v = 0;
    for (const [f, a] of H) v += a * Math.sin(TAU * f * t + f * 0.01);
    v *= 0.012 * (0.85 + 0.15 * wob[i]);
    const g = 0.8 + 0.2 * swell[i];
    bus[0][i] = bus[0][i] * g + v; bus[1][i] = bus[1][i] * g + v;
  }
  const m = len(7), car = brown(m, r), fc = mono(m);
  for (let i = 0; i < m; i++) fc[i] = 260 - 80 * (i / m);
  svf(car, 'bp', fc, 1.0); biquad(car, 'hp', 60, 0.7); norm(car, 0.05);
  for (let i = 0; i < m; i++) car[i] *= Math.sin((Math.PI * i) / m) ** 2;
  placeCircular(bus, car, len(14), 1, -0.3);
  return bus;
}
