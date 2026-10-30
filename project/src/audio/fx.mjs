// Effects & dynamics: Dattorro plate reverb, ping-pong delay, modulated delay (wow/chorus),
// compressor, lookahead true-peak limiter, sidechain duck envelopes, BS.1770 loudness.
import { SR, TAU, db, clamp } from './dsp.mjs';

class DL {
  constructor(len) { let s = 4; while (s < len + 4) s <<= 1; this.b = new Float32Array(s); this.m = s - 1; this.w = 0; }
  push(v) { this.b[this.w] = v; this.w = (this.w + 1) & this.m; }
  tap(d) { return this.b[(this.w - d) & this.m]; }
  tapF(d) { const i = Math.floor(d), f = d - i, a = this.b[(this.w - i) & this.m], c = this.b[(this.w - i - 1) & this.m]; return a + (c - a) * f; }
}
function ap(dl, len, g, x) { const d = dl.tap(len); const w = x + g * d; dl.push(w); return d - g * w; }

/**
 * Dattorro plate reverb. Input stereo (summed to mono), returns wet [L, R] of length n + tail.
 * decay 0..0.95, damping 0..0.9 (higher = darker), bandwidth 0..1 (input LP), size scales delays.
 */
export function plate(L, R, o = {}) {
  const decay = o.decay ?? 0.6, damping = o.damping ?? 0.4, bw = o.bandwidth ?? 0.7, size = o.size ?? 1;
  const pre = Math.max(1, Math.round((o.predelay ?? 0.012) * SR));
  const tail = Math.round((o.tail ?? 2.5) * SR);
  const k = (SR / 29761) * size, N = (x) => Math.max(2, Math.round(x * k));
  const exc = (o.mod ?? 1) * 16 * (SR / 29761);
  const i1 = N(142), i2 = N(107), i3 = N(379), i4 = N(277);
  const lA1 = N(672), lD1 = N(4453), lA2 = N(1800), lD2 = N(3720);
  const rA1 = N(908), rD1 = N(4217), rA2 = N(2656), rD2 = N(3163);
  const pd = new DL(pre + 2), a1 = new DL(i1), a2 = new DL(i2), a3 = new DL(i3), a4 = new DL(i4);
  const la1 = new DL(lA1 + exc + 8), ld1 = new DL(lD1), la2 = new DL(lA2), ld2 = new DL(lD2);
  const ra1 = new DL(rA1 + exc + 8), rd1 = new DL(rD1), ra2 = new DL(rA2), rd2 = new DL(rD2);
  const T = (x) => Math.max(1, Math.round(x * k));
  const t = [266, 2974, 1913, 1996, 1990, 187, 1066, 353, 3627, 1228, 2673, 2111, 335, 121].map(T);
  const id1 = 0.75, id2 = 0.625, dd1 = 0.7, dd2 = clamp(decay + 0.15, 0.25, 0.5);
  const n0 = L.length, n = n0 + tail;
  const oL = new Float32Array(n), oR = new Float32Array(n);
  let bwS = 0, dL = 0, dR = 0, lfo = (o.seedPhase ?? 0);
  const lfoInc = TAU * (o.modRate ?? 0.7) / SR;
  for (let i = 0; i < n; i++) {
    pd.push(i < n0 ? 0.5 * (L[i] + R[i]) : 0);
    bwS += bw * (pd.tap(pre) - bwS);
    let v = bwS + 1e-20;
    v = ap(a1, i1, id1, v); v = ap(a2, i2, id1, v); v = ap(a3, i3, id2, v); v = ap(a4, i4, id2, v);
    const fbL = ld2.tap(lD2), fbR = rd2.tap(rD2);
    let s = v + decay * fbR;
    { const d = la1.tapF(lA1 + exc * Math.sin(lfo)); const w = s - dd1 * d; la1.push(w); s = d + dd1 * w; }
    const d1 = ld1.tap(lD1); ld1.push(s);
    dL += (1 - damping) * (d1 - dL);
    ld2.push(ap(la2, lA2, dd2, dL * decay));
    let u = v + decay * fbL;
    { const d = ra1.tapF(rA1 + exc * Math.cos(lfo)); const w = u - dd1 * d; ra1.push(w); u = d + dd1 * w; }
    const d2 = rd1.tap(rD1); rd1.push(u);
    dR += (1 - damping) * (d2 - dR);
    rd2.push(ap(ra2, rA2, dd2, dR * decay));
    lfo += lfoInc;
    oL[i] = 0.6 * (ld1.tap(t[0]) + ld1.tap(t[1]) - la2.tap(t[2]) + ld2.tap(t[3]) - rd1.tap(t[4]) - ra2.tap(t[5]) - rd2.tap(t[6]));
    oR[i] = 0.6 * (rd1.tap(t[7]) + rd1.tap(t[8]) - ra2.tap(t[9]) + rd2.tap(t[10]) - ld1.tap(t[11]) - la2.tap(t[12]) - ld2.tap(t[13]));
  }
  return [oL, oR];
}

/** Ping-pong delay (mono-summed input). Returns wet [L, R] of length n + tail. */
export function pingPong(L, R, o = {}) {
  const tL = Math.round((o.time ?? 0.375) * SR), tR = Math.round((o.timeR ?? o.time ?? 0.375) * SR);
  const fb = o.feedback ?? 0.35, tail = Math.round((o.tail ?? 2) * SR);
  const lpA = 1 - Math.exp(-TAU * (o.lp ?? 4500) / SR), hpA = 1 - Math.exp(-TAU * (o.hp ?? 250) / SR);
  const dl = new DL(tL + 4), dr = new DL(tR + 4);
  const n0 = L.length, n = n0 + tail, oL = new Float32Array(n), oR = new Float32Array(n);
  let l1 = 0, h1 = 0, l2 = 0, h2 = 0;
  for (let i = 0; i < n; i++) {
    const x = i < n0 ? 0.5 * (L[i] + R[i]) : 0;
    const yl = dl.tap(tL), yr = dr.tap(tR);
    l1 += lpA * (yr - l1); h1 += hpA * (l1 - h1);
    l2 += lpA * (yl - l2); h2 += hpA * (l2 - h2);
    dl.push(x + fb * (l1 - h1)); dr.push(fb * (l2 - h2) + (o.cross ? 0 : 0));
    oL[i] = yl; oR[i] = yr;
  }
  return [oL, oR];
}

/** Modulated short delay (tape wow/flutter or chorus). Returns new buffer, same length. */
export function modDelay(buf, o = {}) {
  const base = o.base ?? 0.0015, depth = o.depth ?? 0.0008, rate = o.rate ?? 0.55;
  const fl = o.flutter ?? 0.00012, fRate = o.flutterRate ?? 6.3, ph = o.phase ?? 0;
  const n = buf.length, out = new Float32Array(n), dl = new DL(Math.ceil((base + depth + fl) * SR) + 8);
  const w1 = TAU * rate / SR, w2 = TAU * fRate / SR;
  for (let i = 0; i < n; i++) {
    dl.push(buf[i]);
    out[i] = dl.tapF(1 + (base + depth * Math.sin(w1 * i + ph) + fl * Math.sin(w2 * i + 2 * ph)) * SR);
  }
  return out;
}

/** Feed-forward stereo-linked compressor, in place. sidechain: optional [L,R] (or mono array) key signal. */
export function compressor(chs, o = {}) {
  const thr = o.threshold ?? -18, ratio = o.ratio ?? 2, knee = o.knee ?? 6, mk = o.makeup ?? 0;
  const aC = Math.exp(-1 / ((o.attackMs ?? 10) * SR / 1000)), rC = Math.exp(-1 / ((o.releaseMs ?? 150) * SR / 1000));
  const rmsC = Math.exp(-1 / ((o.rmsMs ?? 8) * SR / 1000));
  const key = o.sidechain ? (Array.isArray(o.sidechain) ? o.sidechain : [o.sidechain]) : chs;
  const n = chs[0].length, slope = 1 / ratio - 1;
  let ms = 0, gr = 0;
  for (let i = 0; i < n; i++) {
    let x = 0; for (const c of key) { const v = c[i] || 0; if (v * v > x) x = v * v; }
    ms = rmsC * ms + (1 - rmsC) * x;
    const over = 10 * Math.log10(ms + 1e-20) - thr;
    let tgt = 0;
    if (2 * over >= knee) tgt = slope * over;
    else if (2 * over > -knee) tgt = slope * (over + knee / 2) ** 2 / (2 * knee);
    gr = tgt < gr ? aC * gr + (1 - aC) * tgt : rC * gr + (1 - rC) * tgt;
    const g = Math.pow(10, (gr + mk) / 20);
    for (const c of chs) c[i] *= g;
  }
  return chs;
}

/** Duck envelope (gain array) dipping to depthDb at each trigger time (sec). */
export function duckEnv(n, times, { depthDb = -8, attackMs = 4, holdMs = 20, releaseMs = 170 } = {}) {
  const env = new Float32Array(n).fill(1), d = db(depthDb);
  const aN = Math.max(1, Math.round(attackMs * SR / 1000)), hN = Math.round(holdMs * SR / 1000), rN = Math.max(1, Math.round(releaseMs * SR / 1000));
  for (const t of times) {
    const c = Math.round(t * SR);
    for (let i = c - aN; i < c + hN + rN; i++) {
      if (i < 0 || i >= n) continue;
      let g;
      if (i < c) g = 1 - (1 - d) * ((i - (c - aN)) / aN);
      else if (i < c + hN) g = d;
      else { const x = (i - c - hN) / rN; g = d + (1 - d) * (0.5 - 0.5 * Math.cos(Math.PI * x)); }
      if (g < env[i]) env[i] = g;
    }
  }
  return env;
}

export function softClip(chs, t = 0.7) {
  const k = 1 - t;
  for (const c of chs) for (let i = 0; i < c.length; i++) {
    const a = Math.abs(c[i]);
    if (a > t) c[i] = Math.sign(c[i]) * (t + k * Math.tanh((a - t) / k));
  }
  return chs;
}

// ---- true-peak estimation (4x oversampling, 12-tap Blackman-windowed sinc per phase) ----
const TPK = [0.25, 0.5, 0.75].map((mu) => {
  const k = new Float64Array(12); let s = 0;
  for (let j = 0; j < 12; j++) {
    const x = j - 5 - mu, sinc = Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    const w = 0.42 + 0.5 * Math.cos(Math.PI * x / 6.5) + 0.08 * Math.cos(2 * Math.PI * x / 6.5);
    k[j] = sinc * w; s += k[j];
  }
  for (let j = 0; j < 12; j++) k[j] /= s;
  return k;
});
/** Per-sample peak detector including inter-sample estimates (only computed where |x| > floor). */
export function tpDetect(x, floor = 0) {
  const n = x.length, d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = Math.abs(x[i]);
  for (let i = 5; i < n - 7; i++) {
    if (d[i] < floor && d[i + 1] < floor) continue;
    let m = 0;
    for (let p = 0; p < 3; p++) {
      const k = TPK[p]; let s = 0;
      for (let j = 0; j < 12; j++) s += k[j] * x[i - 5 + j];
      const a = Math.abs(s); if (a > m) m = a;
    }
    if (m > d[i]) d[i] = m;
    if (m > d[i + 1]) d[i + 1] = m;
  }
  return d;
}
export function truePeak(chs) { let p = 0; for (const c of chs) { const d = tpDetect(c, 0); for (let i = 0; i < d.length; i++) if (d[i] > p) p = d[i]; } return p; }

function slidingMinFwd(a, L) {
  const n = a.length, pre = new Float32Array(n), suf = new Float32Array(n), out = new Float32Array(n);
  for (let i = 0; i < n; i++) pre[i] = i % L === 0 ? a[i] : Math.min(pre[i - 1], a[i]);
  for (let i = n - 1; i >= 0; i--) suf[i] = i === n - 1 || (i + 1) % L === 0 ? a[i] : Math.min(suf[i + 1], a[i]);
  for (let i = 0; i < n; i++) out[i] = Math.min(suf[i], pre[Math.min(n - 1, i + L - 1)]);
  return out;
}

/** Offline lookahead brickwall limiter (true-peak aware), in place. */
export function limiter(chs, { ceilingDb = -1, lookaheadMs = 1.5, releaseMs = 80, truePeak: tp = true } = {}) {
  const n = chs[0].length, ceil = db(ceilingDb);
  const req = new Float32Array(n).fill(1);
  for (const c of chs) {
    const d = tp ? tpDetect(c, ceil * 0.6) : c.map(Math.abs);
    for (let i = 0; i < n; i++) if (d[i] > ceil) { const r = ceil / d[i]; if (r < req[i]) req[i] = r; }
  }
  const L = Math.max(1, Math.round(lookaheadMs * SR / 1000));
  const h = slidingMinFwd(req, L);
  const rc = Math.exp(-1 / (releaseMs * SR / 1000));
  let g = 1;
  for (let i = 0; i < n; i++) { g = 1 - (1 - g) * rc; if (h[i] < g) g = h[i]; h[i] = g; }
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += h[i]; if (i >= L) acc -= h[i - L];
    const gain = (acc + (i < L - 1 ? L - 1 - i : 0)) / L;
    for (const c of chs) c[i] *= gain;
  }
  return chs;
}

// ---- ITU-R BS.1770-4 integrated loudness ----
function kCoefs(sr) {
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196, K = Math.tan(Math.PI * f0 / sr);
  const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const pb = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0];
  const pa = [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  f0 = 38.13547087602444; Q = 0.5003270373238773; K = Math.tan(Math.PI * f0 / sr); a0 = 1 + K / Q + K * K;
  return { pb, pa, ra: [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0] };
}
export function lufs(chs, sr = SR) {
  const { pb, pa, ra } = kCoefs(sr), hop = Math.round(0.1 * sr), nSeg = Math.floor(chs[0].length / hop);
  if (nSeg < 4) return -Infinity;
  const seg = new Float64Array(nSeg);
  for (const x of chs) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, u1 = 0, u2 = 0, z1 = 0, z2 = 0;
    for (let s = 0; s < nSeg; s++) {
      let acc = 0;
      for (let i = s * hop, e = i + hop; i < e; i++) {
        const xi = x[i];
        const y = pb[0] * xi + pb[1] * x1 + pb[2] * x2 - pa[0] * y1 - pa[1] * y2; x2 = x1; x1 = xi; y2 = y1; y1 = y;
        const z = y - 2 * u1 + u2 - ra[0] * z1 - ra[1] * z2; u2 = u1; u1 = y; z2 = z1; z1 = z;
        acc += z * z;
      }
      seg[s] += acc / hop;
    }
  }
  const nb = nSeg - 3, bp = new Float64Array(nb);
  for (let j = 0; j < nb; j++) bp[j] = (seg[j] + seg[j + 1] + seg[j + 2] + seg[j + 3]) / 4;
  const Lk = (p) => -0.691 + 10 * Math.log10(p);
  let sum = 0, cnt = 0;
  for (const p of bp) if (Lk(p) > -70) { sum += p; cnt++; }
  if (!cnt) return -Infinity;
  const rel = Lk(sum / cnt) - 10;
  sum = 0; cnt = 0;
  for (const p of bp) { const l = Lk(p); if (l > -70 && l > rel) { sum += p; cnt++; } }
  return cnt ? Lk(sum / cnt) : -Infinity;
}
