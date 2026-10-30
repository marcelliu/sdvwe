#!/usr/bin/env node
// Audio build CLI.
//   node src/audio/build.mjs                 build all SFX + music, measure, manifest, QA images
//   node src/audio/build.mjs --only m3       one track (also: m1..m5, music, sfx, sfx:<name>; comma-separated)
//   flags: --no-qa (skip QA images/checks), --no-measure (skip ffmpeg loudness + manifest)
import path from 'node:path';
import { PROJECT_ROOT } from './mixer.mjs';
import { writeWav } from './wav.mjs';
import { SR, peakAbs, toDb } from './dsp.mjs';
import { SFX } from './sfx/index.mjs';
import { finalizeSfx, masterTrack } from './master.mjs';
import { lufs as lufsJs } from './fx.mjs';
import { measureEntry, loadManifest, saveManifest, upsert } from './measure.mjs';

export const TRACKS = [
  { id: 'm1', name: 'm1_lofi_night' },
  { id: 'm2', name: 'm2_bright_pop' },
  { id: 'm3', name: 'm3_two_evenings' },
  { id: 'm4', name: 'm4_rain_piano' },
  { id: 'm5', name: 'm5_quiz_game' },
];
const OUT = path.join(PROJECT_ROOT, 'build/audio');
const MANIFEST = path.join(OUT, 'manifest.json');
const rel = (p) => path.relative(PROJECT_ROOT, p);
const r3 = (x) => Math.round(x * 1000) / 1000;

const argv = process.argv.slice(2);
const onlyIdx = argv.indexOf('--only');
const only = onlyIdx >= 0 ? (argv[onlyIdx + 1] || '').split(',').filter(Boolean) : null;
const doMeasure = !argv.includes('--no-measure'), doQa = !argv.includes('--no-qa');
const wantSfx = (name) => !only || only.includes('sfx') || only.includes(`sfx:${name}`);
const wantTrack = (t) => !only || only.includes('music') || only.includes(t.id) || only.includes(t.name);

const t0 = Date.now();
const built = { sfx: [], music: [], stems: [] };

for (const s of SFX) {
  if (!wantSfx(s.name)) continue;
  const t1 = Date.now();
  const { chs, hitOffset } = finalizeSfx(s.fn(), s);
  const file = path.join(OUT, 'sfx', `${s.name}.wav`);
  writeWav(file, chs, SR, 24);
  const duration = r3(chs[0].length / SR);
  built.sfx.push({ name: s.name, path: rel(file), duration, hitOffset, loop: !!s.loop, kind: s.amb ? 'ambience' : 'sfx', description: s.desc });
  console.log(`sfx ${s.name.padEnd(20)} ${duration.toFixed(3)}s peak ${toDb(peakAbs(chs)).toFixed(1)} dB hit ${hitOffset}s (${Date.now() - t1} ms)`);
}

for (const t of TRACKS) {
  if (!wantTrack(t)) continue;
  const t1 = Date.now();
  const mod = await import(`./tracks/${t.name}.mjs`);
  const { stems, master } = mod.render();
  const { out, inputGainDb, lufs } = masterTrack(stems, master);
  const file = path.join(OUT, 'music', `${t.name}.wav`);
  writeWav(file, out, SR, 24);
  // stems: pre-master, common scale so none clips; sum(stems) * 10^(masterInputGainDb/20) = master input
  const stemPeak = Math.max(...Object.values(stems).map((s) => peakAbs(s)));
  const sg = Math.min(1, 0.89 / Math.max(stemPeak, 1e-9));
  const stemFiles = [];
  for (const [k, s] of Object.entries(stems)) {
    const f = path.join(OUT, 'music', 'stems', `${t.name}_${k}.wav`);
    writeWav(f, s.map((c) => (sg === 1 ? c : c.map((v) => v * sg))), SR, 24);
    stemFiles.push(f);
    built.stems.push({ track: t.name, stem: k, path: rel(f), duration: r3(s[0].length / SR) });
  }
  built.music.push({ name: t.name, path: rel(file), duration: r3(out[0].length / SR), ...mod.meta, masterInputGainDb: +(inputGainDb - toDb(sg)).toFixed(2), stems: stemFiles.map(rel) });
  const stemL = Object.entries(stems).map(([k, s]) => `${k} ${lufsJs(s).toFixed(1)}`).join(', ');
  console.log(`music ${t.name} ${(out[0].length / SR).toFixed(3)}s internal ${lufs.toFixed(2)} LUFS, master in-gain ${inputGainDb.toFixed(1)} dB; stem LUFS: ${stemL} (${((Date.now() - t1) / 1000).toFixed(1)} s)`);
}

if (doMeasure && (built.sfx.length || built.music.length)) {
  const m = loadManifest(MANIFEST);
  for (const [list, key] of [[built.sfx, 'sfx'], [built.music, 'music'], [built.stems, 'stems']]) {
    for (const e of list) {
      const meas = measureEntry(path.join(PROJECT_ROOT, e.path), e.duration);
      upsert(m[key], { ...e, ...meas });
    }
  }
  m.notes = 'peakDb = sample peak dBFS, truePeakDb = ffmpeg ebur128 true peak, lufs = ffmpeg ebur128 integrated loudness. hitOffset = seconds from file start to the main transient/peak (mixer offsetIsHit).';
  saveManifest(MANIFEST, m);
  console.log(`manifest: ${m.music.length} music, ${m.stems.length} stems, ${m.sfx.length} sfx`);
}

if (doQa && built.music.length) {
  const { runQa } = await import('./qa.mjs');
  for (const e of built.music) runQa(e);
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
