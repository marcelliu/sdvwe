// Finishing: SFX trim/normalise/hit detection and the music master bus (EQ, glue, limiter, -16 LUFS).
import { SR, db, clamp, peakAbs, fadeOut, dcBlock, biquad, scale } from './dsp.mjs';
import { compressor, limiter, softClip, lufs } from './fx.mjs';

export function hitOffsetOf(chs, mode = 'onset') {
  if (typeof mode === 'number') return mode;
  const n = chs[0].length, pk = peakAbs(chs);
  if (mode === 'onset') {
    for (let i = 0; i < n; i++) if (Math.abs(chs[0][i]) >= 0.5 * pk || Math.abs(chs[1][i]) >= 0.5 * pk) return i / SR;
    return 0;
  }
  const w = Math.round(0.01 * SR), sq = (i) => chs[0][i] ** 2 + chs[1][i] ** 2;
  let acc = 0, best = -1, bi = 0;
  for (let i = 0; i < n; i++) { acc += sq(i); if (i >= w) acc -= sq(i - w); if (acc > best) { best = acc; bi = i - w / 2; } }
  return Math.max(0, bi) / SR;
}

/** Limiter on a circularly padded copy so gain is continuous across the loop seam. */
function limitCircular(chs, ceilDb) {
  const n = chs[0].length, P = Math.min(n, SR);
  const ext = chs.map((c) => { const e = new Float32Array(n + 2 * P); e.set(c.subarray(n - P), 0); e.set(c, P); e.set(c.subarray(0, P), n + P); return e; });
  limiter(ext, { ceilingDb: ceilDb, releaseMs: 120 });
  return ext.map((e) => e.slice(P, P + n));
}

/** Returns { chs, hitOffset }. One-shots: DC-block, trim tail, fades, peak -> -3 dBFS. Ambience: -24 LUFS, peak <= -6 dBFS. */
export function finalizeSfx(bus, meta) {
  let chs = bus.map((c) => Float32Array.from(c));
  if (!meta.loop) {
    for (const c of chs) dcBlock(c, 15);
    const pk = peakAbs(chs), thr = pk * 1e-3;
    let last = chs[0].length - 1;
    while (last > 0 && Math.abs(chs[0][last]) < thr && Math.abs(chs[1][last]) < thr) last--;
    let end = Math.min(chs[0].length, last + 1 + Math.round(0.005 * SR));
    if (meta.maxLen) end = Math.min(end, Math.round(meta.maxLen * SR));
    chs = chs.map((c) => c.slice(0, end));
    const fo = meta.fadeOut ?? clamp((end / SR) * 0.12, 0.003, 0.08);
    for (const c of chs) { fadeOut(c, fo); const fi = Math.min(16, c.length); for (let i = 0; i < fi; i++) c[i] *= i / fi; }
  }
  if (meta.amb) {
    for (let it = 0; it < 5; it++) {
      const g = db(-24 - lufs(chs)); for (const c of chs) scale(c, g);
      if (peakAbs(chs) > db(-6.2)) chs = limitCircular(chs, -6.3);
      if (Math.abs(lufs(chs) + 24) < 0.1) break;
    }
  } else {
    const g = db(-3) / peakAbs(chs); for (const c of chs) scale(c, g);
  }
  return { chs, hitOffset: meta.loop ? 0 : +hitOffsetOf(chs, meta.hit ?? 'onset').toFixed(4) };
}

/**
 * Music master: sum stems -> HP + EQ -> gain -> glue compressor -> optional soft clip -> true-peak limiter,
 * gain iterated until integrated loudness hits `target` (default -16 LUFS). Stems are not modified.
 */
export function masterTrack(stems, o = {}) {
  const list = Object.values(stems), n = list[0][0].length;
  const pre = [new Float32Array(n), new Float32Array(n)];
  for (const s of list) for (let c = 0; c < 2; c++) { const d = pre[c], x = s[c]; for (let i = 0; i < n; i++) d[i] += x[i]; }
  for (const c of pre) { biquad(c, 'hp', o.hp ?? 28, 0.7071); for (const [t, f, q, g] of o.eq ?? []) biquad(c, t, f, q, g); }
  const target = o.target ?? -16, ceiling = o.ceiling ?? -1.3;
  let gDb = target - lufs(pre), out = null, measured = -Infinity;
  for (let it = 0; it < 6; it++) {
    const g = db(gDb);
    out = pre.map((c) => c.map((v) => v * g));
    if (o.glue !== false) compressor(out, { threshold: o.glueThreshold ?? -14, ratio: o.glueRatio ?? 2, attackMs: o.glueAttack ?? 20, releaseMs: o.glueRelease ?? 220, knee: 8, rmsMs: 15 });
    if (o.softClip) softClip(out, o.softClip);
    limiter(out, { ceilingDb: ceiling, lookaheadMs: 1.5, releaseMs: o.limRelease ?? 90 });
    measured = lufs(out);
    if (Math.abs(target - measured) < 0.05) break;
    gDb += target - measured;
  }
  for (const c of out) { for (let i = 0; i < 48; i++) c[i] *= i / 48; for (let i = 0; i < 96; i++) c[c.length - 1 - i] *= i / 96; }
  return { out, inputGainDb: gDb, lufs: measured };
}
