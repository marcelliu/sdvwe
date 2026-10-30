// Node platform: fonts, images and sequential video-frame readers (ffmpeg -> raw RGBA).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, GlobalFonts, loadImage, ImageData } from '@napi-rs/canvas';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
export const P = (...a) => path.join(ROOT, ...a);

export const platform = { createCanvas: (w, h) => createCanvas(w, h) };

export function registerFonts() {
  const dir = P('assets', 'fonts');
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.ttf'))) {
    const fam = f.startsWith('Onest') ? 'Onest' : f.startsWith('Literata') ? 'Literata' : f.startsWith('Caveat') ? 'Caveat' : 'Noto Color Emoji';
    if (!GlobalFonts.registerFromPath(path.join(dir, f), fam)) throw new Error('font failed: ' + f);
  }
}

export const IMAGES = {
  P1: 'assets/in/P1_kitchen.jpg',
  P2: 'assets/in/P2_sofa.jpg',
  P3: 'assets/in/P3_car.jpg',
  P4: 'assets/in/P4_phone.jpg',
  GIRL_1: 'assets/in/GIRL_1.jpg',
  GIRL_1_1: 'assets/in/GIRL_1_1.jpg',
  GIRL_1_2: 'assets/in/GIRL_1_2.jpg',
  app_icon: 'assets/brand/app_icon.png',
};

export const VIDEOS = {
  VA: { src: 'assets/in/VA_kitchen.mp4', cache: 'assets/cache/VA_kitchen_60.mp4' },
  VB: { src: 'assets/in/VB_car.mp4', cache: 'assets/cache/VB_car_60.mp4' },
  VC: { src: 'assets/in/VC_girl.mp4', cache: 'assets/cache/VC_girl_60.mp4' },
};

export async function loadImages() {
  const out = {};
  for (const [k, f] of Object.entries(IMAGES)) out[k] = await loadImage(P(f));
  return out;
}

/** Build 60 fps motion-interpolated 1080x1920 intermediates (once). */
export function ensureVideoCache() {
  for (const [k, v] of Object.entries(VIDEOS)) {
    if (fs.existsSync(P(v.cache))) continue;
    fs.mkdirSync(path.dirname(P(v.cache)), { recursive: true });
    console.log(`[cache] interpolating ${k} -> 60fps 1080x1920 (one-time, a few minutes)…`);
    const r = spawnSyncFfmpeg([
      '-y', '-i', P(v.src),
      '-vf', 'minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,scale=1080:1920:flags=lanczos,unsharp=5:5:0.55:5:5:0.0',
      '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-an', P(v.cache),
    ]);
    if (r !== 0) throw new Error('ffmpeg cache failed for ' + k);
  }
}

import { spawnSync } from 'node:child_process';
function spawnSyncFfmpeg(args) {
  const r = spawnSync('ffmpeg', ['-v', 'error', ...args], { stdio: 'inherit' });
  return r.status;
}

/**
 * Sequential reader for one timeline video layer.
 * Layer spec: {key, src:'VA', from (source sec), speed, t0, t1}
 * Frame n corresponds to timeline t0 + n/fps and source from + n/fps*speed.
 */
export class VideoReader {
  constructor(spec, fps = 30) {
    this.spec = spec;
    this.fps = fps;
    this.W = 1080;
    this.H = 1920;
    this.frameSize = this.W * this.H * 4;
    this.N = Math.ceil((spec.t1 - spec.t0) * fps) + 2;
    this.canvas = createCanvas(this.W, this.H);
    this.ctx = this.canvas.getContext('2d');
    this.index = -1;
    this.proc = null;
  }
  _file() {
    const v = VIDEOS[this.spec.src];
    return fs.existsSync(P(v.cache)) ? P(v.cache) : P(v.src);
  }
  _start(n) {
    this._kill();
    const s = this.spec;
    const ss = Math.max(0, s.from + (n / this.fps) * s.speed);
    const remaining = this.N - n;
    const vf = `setpts=(PTS-STARTPTS)/${s.speed},fps=${this.fps}:round=near,scale=${this.W}:${this.H}:flags=lanczos`;
    this.proc = spawn('ffmpeg', ['-v', 'error', '-ss', ss.toFixed(4), '-i', this._file(), '-vf', vf, '-frames:v', String(Math.max(1, remaining)), '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    this.chunks = [];
    this.have = 0;
    this.ended = false;
    this.waiters = [];
    this.proc.stdout.on('data', (c) => {
      this.chunks.push(c);
      this.have += c.length;
      if (this.have > this.frameSize * 3) this.proc.stdout.pause();
      this._flush();
    });
    this.proc.stdout.on('end', () => {
      this.ended = true;
      this._flush();
    });
    this.index = n - 1;
  }
  _flush() {
    while (this.waiters.length && (this.have >= this.frameSize || this.ended)) {
      const w = this.waiters.shift();
      if (this.have >= this.frameSize) w(this._take());
      else w(null);
    }
  }
  _take() {
    const all = this.chunks.length === 1 ? this.chunks[0] : Buffer.concat(this.chunks);
    const frame = all.subarray(0, this.frameSize);
    const rest = all.subarray(this.frameSize);
    this.chunks = rest.length ? [rest] : [];
    this.have = rest.length;
    if (this.proc && this.have < this.frameSize * 2) this.proc.stdout.resume();
    return frame;
  }
  _read() {
    return new Promise((res) => {
      this.waiters.push(res);
      this._flush();
    });
  }
  async frameAt(t) {
    const n = Math.max(0, Math.min(this.N - 1, Math.round((t - this.spec.t0) * this.fps)));
    if (n === this.index) return this.canvas;
    if (!this.proc || n < this.index || n - this.index > 45) this._start(n);
    while (this.index < n) {
      const buf = await this._read();
      if (!buf) {
        // source exhausted: hold last frame
        this.index = n;
        break;
      }
      this.index++;
      if (this.index === n) {
        const id = new ImageData(new Uint8ClampedArray(buf.buffer, buf.byteOffset, this.frameSize), this.W, this.H);
        this.ctx.putImageData(id, 0, 0);
      }
    }
    return this.canvas;
  }
  _kill() {
    if (this.proc) {
      this.proc.stdout.removeAllListeners();
      this.proc.kill('SIGKILL');
      this.proc = null;
    }
  }
  close() {
    this._kill();
  }
}
