#!/usr/bin/env node
// Render CLI.
//   node src/render.mjs                               -> all creatives, both formats (final + clean bg + alpha overlay + audio)
//   node src/render.mjs --creo c1 --fmt 9x16          -> subset
//   node src/render.mjs --creo c1 --stills 0.5,2,10   -> PNG stills + contact sheet (fast preview)
//   node src/render.mjs --audio-only                  -> rebuild mixes and re-mux audio into existing videos
//   flags: --no-bg --no-layers (skip extra outputs), --frames N (render only the first N frames)
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { setPlatform, formatGeom, clearCache } from './engine/core.mjs';
import { C } from './engine/ui.mjs';
import { platform, registerFonts, loadImages, VideoReader, ensureVideoCache, P } from './node/platform.mjs';
import { CREOS } from './creos/index.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => {
  const i = args.indexOf('--' + k);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d;
};
const FPS = 30;
const only = arg('creo') ? String(arg('creo')).split(',') : null;
const fmts = arg('fmt') ? String(arg('fmt')).split(',') : ['9x16', '3x4'];
const stills = arg('stills') ? String(arg('stills')).split(',').map(Number) : null;
const audioOnly = !!arg('audio-only');
const maxFrames = arg('frames') ? Number(arg('frames')) : Infinity;
const doBg = !arg('no-bg');
const doLayers = !arg('no-layers');

setPlatform(platform);
registerFonts();
const content = JSON.parse(fs.readFileSync(P('content', 'ua.json'), 'utf8'));
const images = await loadImages();
const mk = (...a) => (fs.mkdirSync(P(...a), { recursive: true }), P(...a));

function makeEnv(creo, geom) {
  const vids = {};
  return {
    W: geom.W, H: geom.H, fps: FPS, geom, fmt: geom.fmt, t: 0, C,
    img: (k) => {
      if (!images[k]) throw new Error('missing image ' + k);
      return images[k];
    },
    vid: (k) => vids[k],
    _vids: vids,
    T: content[creo.id],
    common: content.common,
  };
}

/** Advance all video layers that are (nearly) visible at time t. */
async function prepVideos(readers, env, t) {
  for (const r of readers) {
    const s = r.spec;
    if (t >= s.t0 - 1.0 && t <= s.t1 + 1.0) env._vids[s.key] = await r.frameAt(t);
    else if (t > s.t1 + 1.0) r.close();
  }
}

function drawFrame(creo, env, t, bgCtx, fgCtx) {
  env.t = t;
  bgCtx.save();
  bgCtx.fillStyle = '#000';
  bgCtx.fillRect(0, 0, env.W, env.H);
  creo.bg(bgCtx, env);
  bgCtx.restore();
  fgCtx.clearRect(0, 0, env.W, env.H);
  fgCtx.save();
  creo.fg(fgCtx, env);
  fgCtx.restore();
}

function encoder(out, W, H, codecArgs) {
  const p = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', 'pipe:0', ...codecArgs, out], {
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  let err = '';
  p.stderr.on('data', (d) => (err += d));
  const done = new Promise((res, rej) => p.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg failed (${out}): ${err}`)))));
  return {
    // canvas.data() may be a view of the live surface: always wait until the pipe has taken it
    async write(buf) {
      if (!p.stdin.write(buf)) await once(p.stdin, 'drain');
    },
    async end() {
      p.stdin.end();
      await done;
    },
  };
}
const X264 = (crf) => [
  '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-profile:v', 'high', '-level', '4.2', '-g', '60', '-threads', '2',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart',
];
// Skia pixels are premultiplied; ProRes 4444 alpha is straight -> unpremultiply before encoding.
const PRORES = ['-vf', 'format=gbrap,unpremultiply=inplace=1', '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0', '-qscale:v', '11'];

// NB: ctx.getImageData() leaks native memory in @napi-rs/canvas (~8 MB per call); canvas.data() does not.
const pix = (canvas) => canvas.data();

async function renderStills(creo, geom) {
  clearCache();
  const env = makeEnv(creo, geom);
  const readers = (creo.videos ?? []).map((s) => new VideoReader(s, FPS));
  const bg = createCanvas(geom.W, geom.H), fg = createCanvas(geom.W, geom.H), fin = createCanvas(geom.W, geom.H);
  const bgC = bg.getContext('2d'), fgC = fg.getContext('2d'), finC = fin.getContext('2d');
  const dir = mk('build', 'stills');
  const tw = 360, th = Math.round((tw * geom.H) / geom.W);
  const cols = Math.min(stills.length, 6), rows = Math.ceil(stills.length / cols);
  const sheet = createCanvas(cols * (tw + 8) + 8, rows * (th + 44) + 8);
  const sc = sheet.getContext('2d');
  sc.fillStyle = '#222';
  sc.fillRect(0, 0, sheet.width, sheet.height);
  for (const [i, t] of stills.entries()) {
    await prepVideos(readers, env, t);
    drawFrame(creo, env, t, bgC, fgC);
    finC.drawImage(bg, 0, 0);
    finC.drawImage(fg, 0, 0);
    const png = fin.toBuffer('image/png');
    fs.writeFileSync(path.join(dir, `${creo.slug}_${geom.fmt}_${t.toFixed(2)}.png`), png);
    const cx = 8 + (i % cols) * (tw + 8), cy = 8 + Math.floor(i / cols) * (th + 44);
    // decode the PNG instead of drawing the live canvas (avoids lazy canvas snapshots in the sheet)
    sc.drawImage(await loadImage(png), cx, cy, tw, th);
    sc.fillStyle = '#fff';
    sc.font = '600 26px Onest';
    sc.fillText(`t=${t.toFixed(2)}s`, cx + 6, cy + th + 32);
  }
  readers.forEach((r) => r.close());
  const sheetPath = path.join(dir, `_sheet_${creo.slug}_${geom.fmt}.jpg`);
  fs.writeFileSync(sheetPath, sheet.toBuffer('image/jpeg', 88));
  console.log('sheet:', sheetPath);
}

async function renderVideo(creo, geom) {
  clearCache();
  const env = makeEnv(creo, geom);
  const readers = (creo.videos ?? []).map((s) => new VideoReader(s, FPS));
  const { W, H } = geom;
  const bg = createCanvas(W, H), fg = createCanvas(W, H), fin = createCanvas(W, H);
  const bgC = bg.getContext('2d'), fgC = fg.getContext('2d'), finC = fin.getContext('2d');
  const base = `${creo.slug}_${geom.fmt}`;
  const encFinal = encoder(path.join(mk('build', 'tmp'), `${base}_v.mp4`), W, H, X264(16));
  const encBg = doBg ? encoder(path.join(mk('build', 'backgrounds', geom.fmt), `${base}_bg.mp4`), W, H, X264(19)) : null;
  const encFg = doLayers ? encoder(path.join(mk('build', 'layers', geom.fmt), `${base}_overlay.mov`), W, H, PRORES) : null;
  const N = Math.min(maxFrames, Math.round(creo.duration * FPS));
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const t = i / FPS;
    await prepVideos(readers, env, t);
    drawFrame(creo, env, t, bgC, fgC);
    finC.drawImage(bg, 0, 0);
    finC.drawImage(fg, 0, 0);
    await encFinal.write(pix(fin));
    if (encBg) await encBg.write(pix(bg));
    if (encFg) await encFg.write(pix(fg));
    if (i % 60 === 0) {
      const rss = process.memoryUsage().rss / 1e9;
      process.stdout.write(`[${base}] ${i}/${N} frames, ${((i + 1) / ((Date.now() - t0) / 1000)).toFixed(1)} fps, rss ${rss.toFixed(2)} GB\n`);
      if (rss > 4.5) throw new Error('memory guard: RSS above 4.5 GB, aborting to protect the sandbox');
    }
  }
  readers.forEach((r) => r.close());
  await Promise.all([encFinal.end(), encBg?.end(), encFg?.end()]);
  console.log(`[${base}] done ${N} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

// ---------------- audio ----------------
const AUDIO = (...a) => P('build', 'audio', ...a);

async function buildMix(creo) {
  const mixer = await import('./audio/mixer.mjs');
  const spec = creo.audio(content[creo.id], content.common);
  const mixSpec = {
    durationSec: creo.duration,
    sampleRate: 48000,
    music: spec.music.map((m) => ({ file: AUDIO('music', `${m.track}.wav`), gainDb: m.gainDb ?? 0, fadeOutSec: m.fadeOutSec ?? 0, fadeInSec: m.fadeInSec ?? 0 })),
    events: spec.events.map((e) => ({
      file: AUDIO('sfx', `${e.sfx}.wav`), t: e.t, gainDb: e.gainDb ?? 0, pan: e.pan ?? 0, offsetIsHit: !!e.hit,
      ...(e.loopUntil !== undefined ? { loopUntil: e.loopUntil } : {}), ...(e.fadeOutSec !== undefined ? { fadeOutSec: e.fadeOutSec } : {}),
    })),
    duck: spec.duck ?? [],
  };
  for (const f of [...mixSpec.music, ...mixSpec.events].map((x) => x.file)) if (!fs.existsSync(f)) throw new Error('missing audio file ' + f);
  const dir = mk('build', 'audio', 'mix');
  const raw = path.join(dir, `${creo.slug}_mix_raw.wav`);
  await mixer.renderMix(mixSpec, raw);
  // two-pass loudnorm to -14 LUFS integrated, -1 dBTP
  const m = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  const js = JSON.parse(m.stderr.slice(m.stderr.lastIndexOf('{'), m.stderr.lastIndexOf('}') + 1));
  const out = path.join(dir, `${creo.slug}_mix.wav`);
  const af = `loudnorm=I=-14:TP=-1.0:LRA=11:measured_I=${js.input_i}:measured_TP=${js.input_tp}:measured_LRA=${js.input_lra}:measured_thresh=${js.input_thresh}:offset=${js.target_offset}:linear=true,aresample=48000`;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', af, '-ar', '48000', '-c:a', 'pcm_s24le', out]);
  if (r.status !== 0) throw new Error('loudnorm failed ' + r.stderr);
  fs.rmSync(raw);
  return out;
}

function mux(creo, fmt, wav) {
  const base = `${creo.slug}_${fmt}`;
  const v = P('build', 'tmp', `${base}_v.mp4`);
  if (!fs.existsSync(v)) return false;
  const out = path.join(mk('build', 'renders', fmt), `${base}.mp4`);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', v, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-t', String(creo.duration), '-movflags', '+faststart', out]);
  if (r.status !== 0) throw new Error('mux failed ' + r.stderr);
  console.log('final:', out);
  return true;
}

// ---------------- main ----------------
const list = CREOS.filter((c) => !only || only.includes(c.id) || only.includes(c.slug));
if (!stills && !audioOnly) ensureVideoCache();
for (const creo of list) {
  for (const fmt of fmts) {
    const geom = formatGeom(fmt);
    if (stills) await renderStills(creo, geom);
    else if (!audioOnly) await renderVideo(creo, geom);
  }
  if (!stills) {
    const haveAudio = fs.existsSync(P('src', 'audio', 'mixer.mjs')) && fs.existsSync(AUDIO('manifest.json'));
    if (!haveAudio) {
      console.log('audio not built yet — run `npm run audio` then `node src/render.mjs --audio-only`');
      continue;
    }
    const wav = await buildMix(creo);
    for (const fmt of fmts) mux(creo, fmt, wav);
  }
}
