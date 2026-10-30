// Timeline mixer used by the video renderer: places music beds and SFX events, ducks music,
// and runs a true-peak safety limiter (-1 dBFS) on the mix bus.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWav, writeWav } from './wav.mjs';
import { limiter } from './fx.mjs';

export { readWav, writeWav };
export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST = path.join(PROJECT_ROOT, 'build/audio/manifest.json');

export const resolveFile = (f) => (path.isAbsolute(f) ? f : path.join(PROJECT_ROOT, f));
const dbg = (d) => Math.pow(10, (d ?? 0) / 20);
const sCurve = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * x));

function loadManifestHits() {
  const map = new Map();
  if (!fs.existsSync(MANIFEST)) return map;
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  for (const e of [...(m.sfx ?? []), ...(m.music ?? []), ...(m.stems ?? [])]) map.set(path.basename(e.path), e);
  return map;
}

/** Cubic (Catmull-Rom) resampler, used only if a file is not at the timeline rate. */
function resample(x, from, to) {
  if (from === to) return x;
  const n = Math.floor(x.length * to / from), out = new Float32Array(n), r = from / to, last = x.length - 1;
  for (let i = 0; i < n; i++) {
    const p = i * r, k = Math.floor(p), t = p - k;
    const y0 = x[Math.max(0, k - 1)], y1 = x[Math.min(last, k)], y2 = x[Math.min(last, k + 1)], y3 = x[Math.min(last, k + 2)];
    out[i] = y1 + 0.5 * t * (y2 - y0 + t * (2 * y0 - 5 * y1 + 4 * y2 - y3 + t * (3 * (y1 - y2) + y3 - y0)));
  }
  return out;
}

/**
 * mixTimeline(spec) -> { sampleRate, channels: [L, R] }
 * spec = { durationSec, sampleRate = 48000,
 *   music:  [{ file, startSec = 0, gainDb = 0, fadeInSec = 0, fadeOutSec = 0, endSec }],
 *   events: [{ file, t, gainDb = 0, pan = 0, offsetIsHit = false, loopUntil, fadeOutSec }],
 *   duck:   [{ fromSec, toSec, gainDb }] }   // music-only, 80 ms ramps outside [fromSec, toSec]
 */
export function mixTimeline(spec) {
  const sr = spec.sampleRate ?? 48000;
  const n = Math.round(spec.durationSec * sr);
  const mus = [new Float32Array(n), new Float32Array(n)];
  const out = [new Float32Array(n), new Float32Array(n)];
  const cache = new Map();
  const load = (f) => {
    const p = resolveFile(f);
    if (!cache.has(p)) {
      const w = readWav(p);
      let chs = w.channels.length === 1 ? [w.channels[0], w.channels[0]] : w.channels.slice(0, 2);
      if (w.sampleRate !== sr) chs = chs.map((c) => resample(c, w.sampleRate, sr));
      cache.set(p, chs);
    }
    return cache.get(p);
  };

  for (const m of spec.music ?? []) {
    const a = load(m.file), len = a[0].length, g = dbg(m.gainDb);
    const start = Math.round((m.startSec ?? 0) * sr);
    const natural = start + len;
    let end = natural;
    if (m.endSec != null) end = Math.min(end, Math.round(m.endSec * sr));
    end = Math.min(end, n);
    const fi = Math.round((m.fadeInSec ?? 0) * sr);
    // auto 5 ms declick when the bed is cut short without a fade
    let fo = Math.round((m.fadeOutSec ?? 0) * sr);
    if (fo === 0 && end < natural) fo = Math.round(0.005 * sr);
    for (let i = Math.max(0, start); i < end; i++) {
      const k = i - start; let w = g;
      if (fi > 0 && k < fi) w *= sCurve(k / fi);
      if (fo > 0 && i >= end - fo) w *= sCurve((end - i) / fo);
      mus[0][i] += a[0][k] * w; mus[1][i] += a[1][k] * w;
    }
  }

  if (spec.duck?.length) {
    const env = new Float32Array(n).fill(1), ramp = Math.round(0.08 * sr);
    for (const d of spec.duck) {
      const gd = dbg(d.gainDb), f = Math.round(d.fromSec * sr), t = Math.round(d.toSec * sr);
      for (let i = Math.max(0, f - ramp); i < Math.min(n, t + ramp); i++) {
        let x = 1;
        if (i < f) x = sCurve((i - (f - ramp)) / ramp);
        else if (i > t) x = sCurve(1 - (i - t) / ramp);
        const g = 1 + (gd - 1) * x;
        if (g < env[i]) env[i] = g;
      }
    }
    for (const c of mus) for (let i = 0; i < n; i++) c[i] *= env[i];
  }
  for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) out[c][i] = mus[c][i];

  let hits = null;
  for (const e of spec.events ?? []) {
    const a = load(e.file), len = a[0].length;
    let hit = 0;
    if (e.offsetIsHit) {
      hits ??= loadManifestHits();
      const m = hits.get(path.basename(e.file));
      if (m && typeof m.hitOffset === 'number') hit = m.hitOffset;
      else console.warn(`[mixer] no hitOffset in manifest for ${e.file}; using 0`);
    }
    const start = Math.round((e.t - hit) * sr);
    const loop = e.loopUntil != null;
    let end = loop ? Math.round(e.loopUntil * sr) : start + len;
    end = Math.min(end, n);
    const g = dbg(e.gainDb), th = (Math.max(-1, Math.min(1, e.pan ?? 0)) + 1) * Math.PI / 4;
    const gl = g * Math.cos(th) * Math.SQRT2, gr = g * Math.sin(th) * Math.SQRT2;
    let fo = Math.round((e.fadeOutSec ?? 0) * sr);
    if (fo === 0 && (loop || end < start + len)) fo = Math.round(0.005 * sr);
    for (let i = Math.max(0, start); i < end; i++) {
      let k = i - start; if (loop) k %= len;
      let w = 1;
      if (fo > 0 && i >= end - fo) w = sCurve((end - i) / fo);
      out[0][i] += a[0][k] * w * gl; out[1][i] += a[1][k] * w * gr;
    }
  }

  // declick the very end of the timeline, then safety limiter
  const tailN = Math.min(n, Math.round(0.003 * sr));
  for (const c of out) for (let i = 0; i < tailN; i++) c[n - 1 - i] *= i / tailN;
  limiter(out, { ceilingDb: -1, lookaheadMs: 1.5, releaseMs: 60, truePeak: true });
  return { sampleRate: sr, channels: out };
}

/** renderMix(spec, outPath) = mixTimeline + 24-bit writeWav. Returns outPath. */
export function renderMix(spec, outPath) {
  const r = mixTimeline(spec);
  writeWav(resolveFile(outPath), r.channels, r.sampleRate, 24);
  return outPath;
}
