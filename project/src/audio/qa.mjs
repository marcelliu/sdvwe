// QA: spectrogram/waveform images (+ a gridded review image) and numeric section checks.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PROJECT_ROOT } from './mixer.mjs';
import { readWav } from './wav.mjs';
import { SR, biquad } from './dsp.mjs';

const QA = path.join(PROJECT_ROOT, 'build/audio/_qa');
const ff = (args) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { encoding: 'utf8' }); if (r.status) console.warn('[qa] ffmpeg failed:', (r.stderr || '').slice(0, 300)); };

function band(chs, kind) {
  return chs.map((c) => {
    const y = Float32Array.from(c);
    if (kind === 'low') { biquad(y, 'lp', 150); biquad(y, 'lp', 150); }
    if (kind === 'high') { biquad(y, 'hp', 5000); biquad(y, 'hp', 5000); }
    return y;
  });
}
function rmsDb(chs, a, b) {
  let s = 0, n = 0;
  for (const c of chs) for (let i = Math.max(0, a); i < Math.min(c.length, b); i++) { s += c[i] * c[i]; n++; }
  return 10 * Math.log10(s / Math.max(1, n) + 1e-12);
}
const firstAbove = (chs, thr) => { for (let i = 0; i < chs[0].length; i++) if (Math.abs(chs[0][i]) > thr || Math.abs(chs[1][i]) > thr) return i; return -1; };
const lastAbove = (chs, thr) => { for (let i = chs[0].length - 1; i >= 0; i--) if (Math.abs(chs[0][i]) > thr || Math.abs(chs[1][i]) > thr) return i; return -1; };

export function runQa(entry) {
  fs.mkdirSync(QA, { recursive: true });
  const file = path.join(PROJECT_ROOT, entry.path), name = entry.name, dur = entry.duration;
  const spec = path.join(QA, `${name}_spectrogram.png`), wave = path.join(QA, `${name}_waveform.png`), review = path.join(QA, `${name}_review.png`);
  ff(['-y', '-i', file, '-lavfi', 'showspectrumpic=s=1200x500:legend=1', spec]);
  ff(['-y', '-i', file, '-lavfi', 'showwavespic=s=1200x240', wave]);
  // review image: legend-free spectrogram + split-channel waveform, 1 s grid (grey) and section marks (red)
  const marks = (entry.marks ?? []).map((t) => `drawbox=x=${Math.round((t / dur) * 1200)}:y=0:w=2:h=ih:color=red@0.9:t=fill`).join(',');
  const grid = `drawgrid=w=${(1200 / dur).toFixed(3)}:h=ih:t=1:c=white@0.25`;
  ff(['-y', '-i', file, '-filter_complex',
    `[0:a]showspectrumpic=s=1200x400:legend=0:scale=log,${grid}${marks ? ',' + marks : ''}[s];[0:a]showwavespic=s=1200x200:split_channels=1,${grid}${marks ? ',' + marks : ''}[w];[s][w]vstack`,
    '-frames:v', '1', review]);

  const { channels } = readWav(file);
  const bands = { full: channels, low: band(channels, 'low'), high: band(channels, 'high') };
  const w = Math.round(0.18 * SR), g = Math.round(0.02 * SR);
  const lines = (entry.checks ?? []).map(({ t, label }) => {
    const i = Math.round(t * SR), d = (b) => (rmsDb(bands[b], i, i + w) - rmsDb(bands[b], i - w - g, i - g)).toFixed(1).padStart(5);
    return `  ${String(t).padEnd(6)} ${label.padEnd(16)} dFull ${d('full')} dLow ${d('low')} dHigh ${d('high')} dB`;
  });
  const stemInfo = (entry.stems ?? []).map((p) => {
    const st = readWav(path.join(PROJECT_ROOT, p)).channels, thr = 10 ** (-60 / 20);
    const a = firstAbove(st, thr), b = lastAbove(st, thr);
    return `${path.basename(p, '.wav').replace(name + '_', '')} ${(a / SR).toFixed(3)}-${(b / SR).toFixed(3)}s`;
  });
  console.log(`QA ${name}:\n${lines.join('\n')}\n  stems(>-60dBFS): ${stemInfo.join(', ')}`);
  for (const [from, to, label] of entry.balance ?? []) {
    const a = Math.round(from * SR), b = Math.round(to * SR);
    console.log(`  balance ${label} ${from}-${to}s: L ${rmsDb([channels[0]], a, b).toFixed(1)} R ${rmsDb([channels[1]], a, b).toFixed(1)} dB`);
  }
}
