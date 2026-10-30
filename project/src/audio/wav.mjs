// Minimal RIFF/WAVE reader & writer (PCM 8/16/24/32-bit, IEEE float 32/64, WAVE_FORMAT_EXTENSIBLE).
import fs from 'node:fs';
import path from 'node:path';

/** writeWav(path, channels, sampleRate = 48000, bitDepth = 24). bitDepth 32 writes IEEE float. */
export function writeWav(file, channels, sampleRate = 48000, bitDepth = 24) {
  if (![16, 24, 32].includes(bitDepth)) throw new Error(`unsupported bitDepth ${bitDepth}`);
  const nCh = channels.length, n = channels[0].length, bps = bitDepth / 8;
  const dataBytes = n * nCh * bps;
  const b = Buffer.alloc(44 + dataBytes);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(36 + dataBytes, 4); b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii'); b.writeUInt32LE(16, 16); b.writeUInt16LE(bitDepth === 32 ? 3 : 1, 20);
  b.writeUInt16LE(nCh, 22); b.writeUInt32LE(sampleRate, 24); b.writeUInt32LE(sampleRate * nCh * bps, 28);
  b.writeUInt16LE(nCh * bps, 32); b.writeUInt16LE(bitDepth, 34);
  b.write('data', 36, 'ascii'); b.writeUInt32LE(dataBytes, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nCh; c++) {
      let v = channels[c][i];
      if (v !== v) v = 0;
      if (bitDepth === 32) { b.writeFloatLE(v, o); o += 4; continue; }
      v = v > 1 ? 1 : v < -1 ? -1 : v;
      if (bitDepth === 24) {
        let s = Math.round(v * 8388607); if (s < 0) s += 16777216;
        b[o] = s & 255; b[o + 1] = (s >> 8) & 255; b[o + 2] = (s >> 16) & 255; o += 3;
      } else { b.writeInt16LE(Math.round(v * 32767), o); o += 2; }
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, b);
  return file;
}

/** readWav(path) -> { sampleRate, channels: Float32Array[] } */
export function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`not a WAV file: ${file}`);
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4), size = b.readUInt32LE(pos + 4), body = pos + 8;
    if (id === 'fmt ') {
      let format = b.readUInt16LE(body);
      if (format === 0xfffe && size >= 26) format = b.readUInt16LE(body + 24);
      fmt = { format, channels: b.readUInt16LE(body + 2), sampleRate: b.readUInt32LE(body + 4), bits: b.readUInt16LE(body + 14) };
    } else if (id === 'data') {
      data = { off: body, len: Math.min(size, b.length - body) };
      if (size >= b.length - body) break; // streamed/unknown size: data runs to EOF
    }
    pos = body + size + (size & 1);
  }
  if (!fmt || !data) throw new Error(`WAV missing fmt/data chunk: ${file}`);
  const { format, channels: nCh, bits } = fmt;
  const bps = bits / 8, n = Math.floor(data.len / (nCh * bps));
  const chs = Array.from({ length: nCh }, () => new Float32Array(n));
  let o = data.off;
  const rd =
    format === 3 && bits === 32 ? (p) => b.readFloatLE(p)
    : format === 3 && bits === 64 ? (p) => b.readDoubleLE(p)
    : format === 1 && bits === 16 ? (p) => b.readInt16LE(p) / 32768
    : format === 1 && bits === 24 ? (p) => { let s = b[p] | (b[p + 1] << 8) | (b[p + 2] << 16); if (s & 0x800000) s -= 0x1000000; return s / 8388608; }
    : format === 1 && bits === 32 ? (p) => b.readInt32LE(p) / 2147483648
    : format === 1 && bits === 8 ? (p) => (b[p] - 128) / 128
    : null;
  if (!rd) throw new Error(`unsupported WAV encoding format=${format} bits=${bits}: ${file}`);
  for (let i = 0; i < n; i++) for (let c = 0; c < nCh; c++) { chs[c][i] = rd(o); o += bps; }
  return { sampleRate: fmt.sampleRate, channels: chs };
}
