// Image placement and photographic effects (Ken Burns, grading, grain, vignette, glows).
import { mkCanvas, cached, mulberry32, clamp } from './core.mjs';

/**
 * Draw `img` covering the box (x,y,w,h). fx/fy = focus point in image-normalised coords,
 * zoom >= 1 pushes in around the focus. Returns mapping {dx,dy,s} (image px -> canvas px).
 */
export function cover(ctx, img, x, y, w, h, o = {}) {
  const iw = img.width, ih = img.height;
  const zoom = o.zoom ?? 1, fx = o.fx ?? 0.5, fy = o.fy ?? 0.5;
  const s = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * s, dh = ih * s;
  let dx = x + w / 2 - fx * dw + (o.ox ?? 0);
  let dy = y + h / 2 - fy * dh + (o.oy ?? 0);
  if (o.clampEdges !== false) {
    dx = Math.min(x, Math.max(x + w - dw, dx));
    dy = Math.min(y, Math.max(y + h - dh, dy));
  }
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.filter) ctx.filter = o.filter;
  if (o.clip) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
  return { dx, dy, s, map: (px, py) => [dx + px * s, dy + py * s] };
}

/** Pre-blurred (and optionally darkened) copy of an image, cached. */
export function blurred(key, img, blurPx, o = {}) {
  return cached(`blur:${key}:${blurPx}:${o.scale ?? 0.5}:${o.brightness ?? 1}:${o.saturate ?? 1}`, () => {
    const sc = o.scale ?? 0.5;
    const pad = blurPx * 3;
    const c = mkCanvas(img.width * sc, img.height * sc);
    const x = c.getContext('2d');
    // draw slightly enlarged so blurred edges do not darken
    x.filter = `blur(${blurPx * sc}px) brightness(${o.brightness ?? 1}) saturate(${o.saturate ?? 1})`;
    x.drawImage(img, -pad * sc, -pad * sc, c.width + pad * 2 * sc, c.height + pad * 2 * sc);
    return c;
  });
}

/** Colour tint with blend mode (soft-light, overlay, multiply, screen, color...). */
export function tint(ctx, W, H, color, mode = 'soft-light', alpha = 0.3) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function vignette(ctx, W, H, strength = 0.55, inner = 0.45) {
  ctx.save();
  const r = Math.hypot(W, H) / 2;
  const g = ctx.createRadialGradient(W / 2, H / 2, r * inner, W / 2, H / 2, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Vertical gradient band for text legibility. */
export function scrim(ctx, W, y0, y1, color = '0,0,0', a0 = 0, a1 = 0.6) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, `rgba(${color},${a0})`);
  g.addColorStop(1, `rgba(${color},${a1})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
  ctx.restore();
}

function noiseTiles() {
  return cached('noiseTiles', () => {
    const tiles = [];
    const rnd = mulberry32(7);
    for (let k = 0; k < 6; k++) {
      const n = 384;
      const c = mkCanvas(n, n);
      const x = c.getContext('2d');
      const id = x.createImageData(n, n);
      for (let i = 0; i < n * n; i++) {
        const v = 128 + (rnd() + rnd() + rnd() - 1.5) * 120;
        id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = clamp(v, 0, 255);
        id.data[i * 4 + 3] = 255;
      }
      x.putImageData(id, 0, 0);
      tiles.push(c);
    }
    return tiles;
  });
}

/** Film grain (overlay blend), changes every frame. */
// Global grain scale: grain is costly in bitrate, keep it subtle (TikTok re-encodes anyway).
export const GRAIN_SCALE = 0.6;
export function grain(ctx, W, H, t, amount = 0.07) {
  amount *= GRAIN_SCALE;
  if (amount <= 0) return;
  const tiles = noiseTiles();
  const f = Math.floor(t * 30);
  const tile = tiles[f % tiles.length];
  const ox = (f * 97) % tile.width, oy = (f * 61) % tile.height;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = amount;
  for (let y = -oy; y < H; y += tile.height) for (let x = -ox; x < W; x += tile.width) ctx.drawImage(tile, x, y);
  ctx.restore();
}

/** Soft radial light blob. */
export function glow(ctx, x, y, r, color = '255,75,43', alpha = 0.5, mode = 'screen') {
  if (alpha <= 0 || r <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = mode;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${color},${alpha})`);
  g.addColorStop(0.45, `rgba(${color},${alpha * 0.35})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** Diagonal light sweep (e.g. passing headlights / sheen). p = 0..1 position. */
export function sweep(ctx, W, H, p, color = '255,220,180', alpha = 0.35, width = 0.35, angle = -0.35) {
  if (alpha <= 0 || p <= 0 || p >= 1) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.translate(W / 2, H / 2);
  ctx.rotate(angle);
  const span = W * 2.2;
  const cx = -span / 2 + p * span;
  const g = ctx.createLinearGradient(cx - (W * width) / 2, 0, cx + (W * width) / 2, 0);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(0.5, `rgba(${color},${alpha})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-span, -H * 1.5, span * 2, H * 3);
  ctx.restore();
}

/** Floating bokeh circles (deterministic). */
export function bokeh(ctx, W, H, t, o = {}) {
  const n = o.n ?? 14, seed = o.seed ?? 3;
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.globalCompositeOperation = o.mode ?? 'screen';
  for (let i = 0; i < n; i++) {
    const bx = rnd() * W, by = rnd() * H, r = (o.rMin ?? 30) + rnd() * ((o.rMax ?? 110) - (o.rMin ?? 30));
    const sp = (o.speed ?? 18) * (0.5 + rnd());
    const ph = rnd() * 6.28;
    const x = bx + Math.sin(t * 0.4 + ph) * 30;
    const y = ((by - t * sp) % (H + 2 * r) + H + 2 * r) % (H + 2 * r) - r;
    const cols = o.colors ?? ['255,140,90', '255,90,120', '170,110,255'];
    const col = cols[i % cols.length];
    const a = (o.alpha ?? 0.18) * (0.6 + 0.4 * Math.sin(t * 1.3 + ph));
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(0.7, `rgba(${col},${a * 0.6})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Animated brand gradient background (coral -> pink -> violet) with slow drift. */
export function brandGradient(ctx, W, H, t, o = {}) {
  const a = (o.angle ?? 0.6) + Math.sin(t * 0.35) * 0.15;
  const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2;
  const g = ctx.createLinearGradient(cx - Math.cos(a) * R, cy - Math.sin(a) * R, cx + Math.cos(a) * R, cy + Math.sin(a) * R);
  const stops = o.stops ?? ['#FF4B2B', '#FF3D7F', '#8E4BFF'];
  stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
