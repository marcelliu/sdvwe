// ffmpeg ebur128 measurement (summary only) and manifest persistence.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function ffMeasure(file, padTo = 0) {
  const af = (padTo ? `apad=whole_dur=${padTo},` : '') + 'ebur128=framelog=verbose:peak=sample+true';
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', af, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const e = r.stderr || '', s = e.slice(e.lastIndexOf('Summary:'));
  const num = (re) => { const m = re.exec(s); return m ? (m[1] === '-inf' ? null : Number(m[1])) : null; };
  return {
    lufs: num(/I:\s+(-?[\d.]+|-inf) LUFS/),
    peakDb: num(/Sample peak:\s+Peak:\s+(-?[\d.]+|-inf)/),
    truePeakDb: num(/True peak:\s+Peak:\s+(-?[\d.]+|-inf)/),
  };
}

/** Measure a file; files shorter than one 400 ms gating block are measured padded with silence to 0.4 s. */
export function measureEntry(file, duration) {
  let m = ffMeasure(file), lufsNote;
  if (duration < 0.4 || m.lufs == null || m.lufs <= -69.9) { m = { ...m, lufs: ffMeasure(file, 0.4).lufs }; lufsNote = 'measured padded to 0.4 s (shorter than one BS.1770 block)'; }
  return { ...m, ...(lufsNote ? { lufsNote } : {}) };
}

export function loadManifest(p) {
  if (fs.existsSync(p)) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { /* rebuild */ } }
  return { format: { sampleRate: 48000, channels: 2, bitDepth: 24, encoding: 'PCM WAV' }, music: [], stems: [], sfx: [] };
}

export function upsert(list, entry) {
  const i = list.findIndex((e) => e.path === entry.path);
  if (i >= 0) list[i] = entry; else list.push(entry);
  list.sort((a, b) => a.path.localeCompare(b.path));
}

export function saveManifest(p, m) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(m, null, 2) + '\n');
}
