// Brand UI components (palette from otkrovenno.online CSS: accent #FF4B2B, ink #12142A, surfaces #171922/#20232E).
import { clamp, ease, prog, mkCanvas } from './core.mjs';
import { F, layout, draw } from './text.mjs';
import { cover, glow, grain, vignette, blurred } from './fx.mjs';

export const C = {
  accent: '#FF4B2B',
  accentHover: '#E63E20',
  pink: '#FF3D7F',
  violet: '#8E4BFF',
  cyan: '#3FD0FF',
  ink: '#12142A',
  bg: '#0E0F14',
  night: '#1A0C2E',
  surface: '#171922',
  surface2: '#20232E',
  border: '#272A37',
  text: '#F2F2F5',
  text3: '#9A9DAF',
  light: '#F3F3F6',
  white: '#FFFFFF',
  green: '#2BD576',
  yellow: '#FFD23F',
  red: '#FF4D5E',
};
export const GRAD = ['#FF4B2B', '#FF3D7F', '#A54BFF'];

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (Array.isArray(r)) ctx.roundRect(x, y, w, h, r);
  else ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, h / 2, w / 2)));
}

export function grad(ctx, x, y, w, h, stops = GRAD, angle = 0.35) {
  const cx = x + w / 2, cy = y + h / 2;
  const R = Math.hypot(w, h) / 2;
  const g = ctx.createLinearGradient(cx - Math.cos(angle) * R, cy - Math.sin(angle) * R, cx + Math.cos(angle) * R, cy + Math.sin(angle) * R);
  stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
  return g;
}

/** Scale/alpha transform around a pivot for pop animations. */
export function withPop(ctx, px, py, s, a, fn) {
  if (a <= 0.001 || s <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  ctx.translate(px, py);
  ctx.scale(s, s);
  ctx.translate(-px, -py);
  fn();
  ctx.restore();
}

export function heartPath(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.35);
  ctx.bezierCurveTo(cx - s * 0.05, cy + s * 0.3, cx - s * 0.5, cy + s * 0.02, cx - s * 0.5, cy - s * 0.18);
  ctx.bezierCurveTo(cx - s * 0.5, cy - s * 0.42, cx - s * 0.2, cy - s * 0.5, cx, cy - s * 0.26);
  ctx.bezierCurveTo(cx + s * 0.2, cy - s * 0.5, cx + s * 0.5, cy - s * 0.42, cx + s * 0.5, cy - s * 0.18);
  ctx.bezierCurveTo(cx + s * 0.5, cy + s * 0.02, cx + s * 0.05, cy + s * 0.3, cx, cy + s * 0.35);
  ctx.closePath();
}

export function arrowPath(ctx, x, y, s, color, lw) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw ?? s * 0.16;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.45, y);
  ctx.lineTo(x + s * 0.4, y);
  ctx.moveTo(x + s * 0.05, y - s * 0.36);
  ctx.lineTo(x + s * 0.43, y);
  ctx.lineTo(x + s * 0.05, y + s * 0.36);
  ctx.stroke();
  ctx.restore();
}

export function checkPath(ctx, x, y, s, color, lw) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw ?? s * 0.18;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.42, y + s * 0.02);
  ctx.lineTo(x - s * 0.12, y + s * 0.32);
  ctx.lineTo(x + s * 0.45, y - s * 0.32);
  ctx.stroke();
  ctx.restore();
}

export function crossPath(ctx, x, y, s, color, lw) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw ?? s * 0.18;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.34, y - s * 0.34);
  ctx.lineTo(x + s * 0.34, y + s * 0.34);
  ctx.moveTo(x + s * 0.34, y - s * 0.34);
  ctx.lineTo(x - s * 0.34, y + s * 0.34);
  ctx.stroke();
  ctx.restore();
}

/** Circular avatar with optional ring and online dot. */
export function avatar(ctx, img, cx, cy, r, o = {}) {
  ctx.save();
  if (o.ring) {
    ctx.beginPath();
    ctx.arc(cx, cy, r + (o.ringW ?? 5) + 2, 0, Math.PI * 2);
    ctx.fillStyle = typeof o.ring === 'string' ? o.ring : grad(ctx, cx - r, cy - r, r * 2, r * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.fillStyle = o.ringGap ?? C.surface;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  cover(ctx, img, cx - r, cy - r, r * 2, r * 2, { fx: o.fx ?? 0.5, fy: o.fy ?? 0.3, zoom: o.zoom ?? 1 });
  ctx.restore();
  if (o.online) {
    const dr = o.dotR ?? r * 0.26;
    const a = o.dotAngle ?? Math.PI * 0.25;
    const dx = cx + Math.cos(a) * r * 0.82, dy = cy + Math.sin(a) * r * 0.82;
    ctx.save();
    ctx.beginPath();
    ctx.arc(dx, dy, dr + (o.dotBorder ?? 4), 0, Math.PI * 2);
    ctx.fillStyle = o.dotBorderColor ?? C.surface;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    ctx.fillStyle = C.green;
    ctx.fill();
    ctx.restore();
  }
}

export const THEMES = {
  dark: {
    panel: 'rgba(16,18,28,0.94)', header: '#171922', inBg: '#262A37', inText: '#F2F2F5', sub: '#9A9DAF',
    input: '#20232E', inputText: '#F2F2F5', placeholder: '#7C8094', divider: 'rgba(255,255,255,0.07)', time: 'rgba(242,242,245,0.55)',
  },
  light: {
    panel: '#F3F3F6', header: '#FFFFFF', inBg: '#FFFFFF', inText: '#12142A', sub: '#6C7084',
    input: '#FFFFFF', inputText: '#12142A', placeholder: '#9A9DAF', divider: '#E6E7EE', time: 'rgba(18,20,42,0.45)',
  },
};

/** Measure a chat bubble. */
export function bubbleLayout(ctx, o) {
  const size = o.size ?? 40;
  const padX = size * 0.62, padY = size * 0.42;
  const L = layout(ctx, o.text, { size, weight: o.weight ?? 500, maxW: (o.maxW ?? 640) - padX * 2, lh: 1.28 });
  const metaW = o.time ? size * 2.6 : 0;
  // time label sits inline after the last line if it fits, otherwise on its own row
  const lastW = L.lines.length ? L.lines[L.lines.length - 1].w : 0;
  const inlineMeta = o.time && lastW + metaW <= (o.maxW ?? 640) - padX * 2;
  const w = Math.max(L.width, inlineMeta ? lastW + metaW : L.width) + padX * 2;
  const h = L.height + padY * 2 + (o.time && !inlineMeta ? size * 0.7 : 0);
  return { L, w: Math.max(w, size * 2.2), h, padX, padY, size, inlineMeta };
}

/**
 * Chat bubble. side 'in' anchors x at the left edge, 'out' anchors x at the right edge.
 * appear: 0..1 progress (pop from tail corner).
 */
export function bubble(ctx, o) {
  const th = THEMES[o.theme ?? 'dark'];
  const B = o.B ?? bubbleLayout(ctx, o);
  const { w, h, padX, padY, size, L } = B;
  const out = o.side === 'out';
  const x = out ? o.x - w : o.x, y = o.y;
  const p = o.appear ?? 1;
  if (p <= 0) return B;
  const s = 0.55 + 0.45 * ease.outBack(clamp(p));
  const px = out ? x + w : x, py = y + h;
  const R = size * 0.82, rs = size * 0.22;
  withPop(ctx, px, py, s, clamp(p * 3), () => {
    ctx.save();
    if (o.shadow !== false) {
      ctx.shadowColor = 'rgba(0,0,0,0.28)';
      ctx.shadowBlur = size * 0.6;
      ctx.shadowOffsetY = size * 0.12;
    }
    rr(ctx, x, y, w, h, out ? [R, R, rs, R] : [R, R, R, rs]);
    ctx.fillStyle = out ? grad(ctx, x, y, w, h, o.outStops ?? GRAD, 0.5) : (o.inBg ?? th.inBg);
    ctx.fill();
    ctx.restore();
    draw(ctx, L, x + padX, y + padY, { align: 'left', color: out ? '#fff' : (o.inText ?? th.inText) });
    if (o.time) {
      ctx.save();
      ctx.font = F(size * 0.52, 500);
      ctx.fillStyle = out ? 'rgba(255,255,255,0.78)' : th.time;
      ctx.textAlign = 'right';
      const ty = y + h - padY * 0.62;
      const tx = x + w - padX * 0.7 - (out && o.ticks ? size * 0.75 : 0);
      ctx.fillText(o.time, tx, ty);
      ctx.restore();
      if (out && o.ticks) {
        const cx = x + w - padX * 0.7 - size * 0.32, cy = y + h - padY * 0.62 - size * 0.18;
        const col = o.ticks >= 2 ? '#FFFFFF' : 'rgba(255,255,255,0.75)';
        checkPath(ctx, cx - size * 0.1, cy, size * 0.36, col, size * 0.07);
        if (o.ticks >= 2) checkPath(ctx, cx + size * 0.1, cy, size * 0.36, col, size * 0.07);
      }
    }
  });
  return B;
}

/** Typing indicator bubble (three bouncing dots). */
export function typingBubble(ctx, o) {
  const th = THEMES[o.theme ?? 'dark'];
  const size = o.size ?? 40;
  const w = size * 2.6, h = size * 1.55;
  const p = o.appear ?? 1;
  if (p <= 0) return { w, h };
  const x = o.x, y = o.y;
  withPop(ctx, x, y + h, 0.6 + 0.4 * ease.outBack(clamp(p)), clamp(p * 3), () => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = size * 0.5;
    rr(ctx, x, y, w, h, [size * 0.8, size * 0.8, size * 0.8, size * 0.22]);
    ctx.fillStyle = o.bg ?? th.inBg;
    ctx.fill();
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      const ph = (o.t * 2.4 - i * 0.18) % 1;
      const b = ph < 0.5 ? Math.sin(ph * Math.PI * 2) : 0;
      ctx.beginPath();
      ctx.arc(x + w / 2 + (i - 1) * size * 0.55, y + h / 2 - b * size * 0.18, size * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = o.dot ?? (o.theme === 'light' ? 'rgba(18,20,42,' : 'rgba(242,242,245,') + (0.45 + b * 0.5) + ')';
      ctx.fill();
    }
  });
  return { w, h };
}

/** App-style chat header: back chevron, avatar, name, status. */
export function chatHeader(ctx, o) {
  const th = THEMES[o.theme ?? 'dark'];
  const { x, y, w, h } = o;
  const size = o.size ?? h * 0.3;
  if (o.bg !== false) {
    ctx.save();
    if (o.radius) rr(ctx, x, y, w, h, [o.radius, o.radius, 0, 0]);
    else {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
    }
    ctx.fillStyle = th.header;
    ctx.fill();
    ctx.fillStyle = th.divider;
    ctx.fillRect(x, y + h - 2, w, 2);
    ctx.restore();
  }
  // back chevron
  ctx.save();
  ctx.strokeStyle = o.theme === 'light' ? C.ink : C.text;
  ctx.lineWidth = size * 0.13;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const bx = x + size * 0.9, by = y + h / 2;
  ctx.beginPath();
  ctx.moveTo(bx + size * 0.22, by - size * 0.42);
  ctx.lineTo(bx - size * 0.2, by);
  ctx.lineTo(bx + size * 0.22, by + size * 0.42);
  ctx.stroke();
  ctx.restore();
  const ar = h * 0.32;
  const ax = x + size * 1.9 + ar;
  if (o.img) avatar(ctx, o.img, ax, by, ar, { online: o.online, fx: o.fx, fy: o.fy, zoom: o.zoom, dotBorderColor: th.header, dotR: ar * 0.26, dotBorder: 3 });
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = F(size * 1.02, 700);
  ctx.fillStyle = o.theme === 'light' ? C.ink : C.text;
  ctx.fillText(o.name ?? '', ax + ar + size * 0.55, by - size * 0.08);
  ctx.font = F(size * 0.72, 500);
  ctx.fillStyle = o.statusColor ?? C.green;
  ctx.fillText(o.status ?? '', ax + ar + size * 0.55, by + size * 0.82);
  ctx.restore();
  // menu dots
  ctx.save();
  ctx.fillStyle = o.theme === 'light' ? 'rgba(18,20,42,0.55)' : 'rgba(242,242,245,0.6)';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x + w - size * 1.1, by + (i - 1) * size * 0.34, size * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Message input bar with optional typed text and caret. */
export function inputBar(ctx, o) {
  const th = THEMES[o.theme ?? 'dark'];
  const { x, y, w, h } = o;
  const size = o.size ?? h * 0.4;
  const bw = w - h - size * 0.4;
  ctx.save();
  rr(ctx, x, y, bw, h, h / 2);
  ctx.fillStyle = th.input;
  ctx.fill();
  if (o.theme === 'light') {
    ctx.strokeStyle = '#E6E7EE';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.font = F(size, 500);
  ctx.textAlign = 'left';
  const tx = x + size * 0.9, ty = y + h / 2 + size * 0.36;
  const txt = o.text ?? '';
  if (txt) {
    ctx.fillStyle = th.inputText;
    ctx.fillText(txt, tx, ty);
  } else {
    ctx.fillStyle = th.placeholder;
    ctx.fillText(o.placeholder ?? 'Повідомлення…', tx, ty);
  }
  if (o.caret) {
    const cw = txt ? ctx.measureText(txt).width : 0;
    ctx.fillStyle = C.accent;
    ctx.fillRect(tx + cw + 3, y + h * 0.26, 3, h * 0.48);
  }
  ctx.restore();
  // send button
  const sx = x + w - h / 2, sy = y + h / 2;
  const active = o.active ?? !!txt;
  const ps = o.press ? 1 - 0.12 * Math.sin(clamp(o.press) * Math.PI) : 1;
  withPop(ctx, sx, sy, ps, 1, () => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, h / 2, 0, Math.PI * 2);
    ctx.fillStyle = active ? grad(ctx, sx - h / 2, sy - h / 2, h, h) : th.input;
    if (active) {
      ctx.shadowColor = 'rgba(255,75,43,0.55)';
      ctx.shadowBlur = h * 0.4;
    }
    ctx.fill();
    ctx.restore();
    // paper plane-ish arrow (up)
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-Math.PI / 2);
    arrowPath(ctx, 0, 0, h * 0.42, active ? '#fff' : th.placeholder, h * 0.075);
    ctx.restore();
  });
}

const KB_ROWS = [
  ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ї'],
  ['ф', 'і', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'є'],
  ['⇧', 'я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', '⌫'],
];

/** Ukrainian on-screen keyboard; `pressed` = lowercase char being tapped (pops a key preview). */
export function keyboard(ctx, o) {
  const { x, y, w, h } = o;
  const light = o.theme === 'light';
  ctx.save();
  ctx.fillStyle = light ? '#D5D8E0' : '#1B1D27';
  ctx.fillRect(x, y, w, h);
  const gap = w * 0.012;
  const rowH = (h - gap * 6) / 4.3;
  const keyW = (w - gap * 13) / 12;
  const pos = {};
  KB_ROWS.forEach((row, ri) => {
    const rowW = row.length * keyW + (row.length - 1) * gap;
    let kx = x + (w - rowW) / 2;
    const ky = y + gap * 1.6 + ri * (rowH + gap * 1.4);
    row.forEach((k) => {
      const special = k === '⇧' || k === '⌫';
      rr(ctx, kx, ky, keyW, rowH, keyW * 0.16);
      ctx.fillStyle = special ? (light ? '#AEB3BF' : '#2C2F3B') : light ? '#FFFFFF' : '#3A3D4A';
      ctx.fill();
      ctx.font = F(rowH * 0.46, 500);
      ctx.textAlign = 'center';
      ctx.fillStyle = light ? C.ink : C.text;
      ctx.fillText(k, kx + keyW / 2, ky + rowH * 0.66);
      pos[k] = { x: kx, y: ky };
      kx += keyW + gap;
    });
  });
  // bottom row: emoji, space, send
  const ky = y + gap * 1.6 + 3 * (rowH + gap * 1.4);
  const spaceW = keyW * 6.2;
  const sx = x + (w - spaceW) / 2;
  rr(ctx, sx, ky, spaceW, rowH, keyW * 0.16);
  ctx.fillStyle = light ? '#FFFFFF' : '#3A3D4A';
  ctx.fill();
  ctx.font = F(rowH * 0.36, 500);
  ctx.fillStyle = light ? '#6C7084' : '#9A9DAF';
  ctx.fillText('пробіл', sx + spaceW / 2, ky + rowH * 0.64);
  pos[' '] = { x: sx + spaceW / 2 - keyW / 2, y: ky };
  rr(ctx, x + gap * 2, ky, keyW * 2.3, rowH, keyW * 0.16);
  ctx.fillStyle = light ? '#AEB3BF' : '#2C2F3B';
  ctx.fill();
  ctx.font = F(rowH * 0.46, 500);
  ctx.fillStyle = C.ink;
  ctx.fillText('🙂', x + gap * 2 + keyW * 1.15, ky + rowH * 0.68);
  pos['👋'] = { x: x + gap * 2 + keyW * 0.65, y: ky };
  ctx.restore();
  // pressed key preview
  const k = o.pressed;
  if (k && pos[k]) {
    const p = pos[k];
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 16;
    rr(ctx, p.x - keyW * 0.25, p.y - rowH * 1.25, keyW * 1.5, rowH * 1.25 + rowH, keyW * 0.3);
    ctx.fillStyle = light ? '#FFFFFF' : '#4A4E5E';
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.font = F(rowH * 0.8, 600);
    ctx.textAlign = 'center';
    ctx.fillStyle = light ? C.ink : C.text;
    ctx.fillText(k === ' ' ? '␣' : k, p.x + keyW / 2, p.y - rowH * 0.3);
    ctx.restore();
  }
}

/**
 * Phone mockup. Draws body + bezel and calls screenFn(ctx, rect) clipped to the screen.
 * Returns the screen rect.
 */
export function phone(ctx, o, screenFn) {
  const { x, y, w, h } = o;
  const R = w * 0.15;
  const bez = w * 0.032;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = w * 0.12;
  ctx.shadowOffsetY = w * 0.05;
  rr(ctx, x, y, w, h, R);
  ctx.fillStyle = o.body ?? '#0B0C10';
  ctx.fill();
  ctx.restore();
  // metallic edge
  ctx.save();
  rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, R);
  ctx.strokeStyle = o.edge ?? 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  const s = { x: x + bez, y: y + bez, w: w - bez * 2, h: h - bez * 2, r: R - bez };
  ctx.save();
  rr(ctx, s.x, s.y, s.w, s.h, s.r);
  ctx.clip();
  screenFn?.(ctx, s);
  ctx.restore();
  // dynamic island
  ctx.save();
  rr(ctx, x + w / 2 - w * 0.15, s.y + w * 0.03, w * 0.3, w * 0.085, w * 0.05);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
  return s;
}

/** Simple status bar for phone screens. */
export function statusBar(ctx, s, time = '23:47', dark = true) {
  const fs = s.w * 0.042;
  ctx.save();
  ctx.font = F(fs, 700);
  ctx.fillStyle = dark ? '#fff' : C.ink;
  ctx.textAlign = 'left';
  ctx.fillText(time, s.x + s.w * 0.1, s.y + s.w * 0.085);
  // battery + bars
  const bx = s.x + s.w * 0.8, by = s.y + s.w * 0.058;
  ctx.globalAlpha = 0.95;
  for (let i = 0; i < 4; i++) ctx.fillRect(s.x + s.w * 0.68 + i * fs * 0.32, by + fs * 0.6 - i * fs * 0.15, fs * 0.2, fs * 0.15 + i * fs * 0.15);
  rr(ctx, bx, by, fs * 1.5, fs * 0.72, fs * 0.18);
  ctx.strokeStyle = dark ? '#fff' : C.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillRect(bx + 3, by + 3, fs * 1.1, fs * 0.72 - 6);
  ctx.restore();
}

/** Generic notification card (rounded, glassy). */
export function notifCard(ctx, o) {
  const { x, y, w } = o;
  const size = o.size ?? w * 0.05;
  const h = o.h ?? size * 3.9;
  const light = o.theme === 'light';
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = size * 1.2;
  ctx.shadowOffsetY = size * 0.3;
  rr(ctx, x, y, w, h, size * 1.05);
  ctx.fillStyle = o.bg ?? (light ? 'rgba(250,250,252,0.94)' : 'rgba(38,40,52,0.86)');
  ctx.fill();
  ctx.restore();
  const icS = size * 2.1;
  const icX = x + size * 0.8, icY = y + (h - icS) / 2;
  if (o.icon) {
    ctx.save();
    rr(ctx, icX, icY, icS, icS, icS * 0.24);
    ctx.clip();
    ctx.drawImage(o.icon, icX, icY, icS, icS);
    ctx.restore();
  }
  const tx = icX + icS + size * 0.7;
  const fg = light ? C.ink : '#fff';
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = F(size * 0.95, 700);
  ctx.fillStyle = fg;
  ctx.fillText(o.title ?? '', tx, y + h * 0.42);
  ctx.font = F(size * 0.95, 500);
  ctx.fillStyle = light ? '#2A2D3E' : 'rgba(255,255,255,0.92)';
  ctx.fillText(o.text ?? '', tx, y + h * 0.42 + size * 1.3);
  ctx.font = F(size * 0.72, 500);
  ctx.textAlign = 'right';
  ctx.fillStyle = light ? '#6C7084' : 'rgba(255,255,255,0.6)';
  ctx.fillText(o.when ?? 'зараз', x + w - size * 0.8, y + h * 0.42);
  ctx.restore();
  return { h };
}

/** Pill / chip. Returns {w,h}. align: left|center|right relative to x. */
export function pill(ctx, o) {
  const size = o.size ?? 34;
  if ((o.alpha ?? 1) <= 0.001) return { w: 0, h: 0, x: o.x, y: o.y };
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.font = F(size, o.weight ?? 700);
  ctx.letterSpacing = `${o.ls ?? 0}px`;
  const tw = ctx.measureText(o.text).width;
  const padX = o.padX ?? size * 0.7, h = o.h ?? size * 1.9;
  const dotW = o.dot ? size * 0.95 : 0;
  const w = tw + padX * 2 + dotW;
  const x = o.align === 'center' ? o.x - w / 2 : o.align === 'right' ? o.x - w : o.x;
  const y = o.y;
  if (o.shadow) {
    ctx.shadowColor = o.shadow;
    ctx.shadowBlur = size * 0.8;
  }
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = o.bg === 'grad' ? grad(ctx, x, y, w, h) : (o.bg ?? 'rgba(0,0,0,0.5)');
  ctx.fill();
  ctx.shadowColor = 'transparent';
  if (o.border) {
    ctx.strokeStyle = o.border;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (o.dot) {
    const pulse = o.t !== undefined ? 0.5 + 0.5 * Math.sin(o.t * 5) : 1;
    const dx = x + padX + size * 0.28, dy = y + h / 2;
    ctx.beginPath();
    ctx.arc(dx, dy, size * 0.28 + pulse * size * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(43,213,118,${0.25 * pulse})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dx, dy, size * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = o.dot === true ? C.green : o.dot;
    ctx.fill();
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = o.color ?? '#fff';
  ctx.fillText(o.text, x + padX + dotW, y + h / 2 + size * 0.36);
  ctx.restore();
  return { w, h, x, y };
}

/** Gradient CTA button with arrow and pulse. */
export function ctaButton(ctx, o) {
  const size = o.size ?? 52;
  ctx.save();
  ctx.font = F(size, 800);
  const tw = ctx.measureText(o.text).width;
  ctx.restore();
  const arrowW = o.arrow === false ? 0 : size * 1.3;
  const h = size * 2.15;
  const w = Math.max(o.minW ?? 0, tw + arrowW + size * 1.7);
  const pulse = o.t !== undefined ? 1 + 0.035 * Math.sin(o.t * Math.PI * 2 * (o.pulseHz ?? 1.25)) : 1;
  const s = (o.scale ?? 1) * pulse;
  withPop(ctx, o.cx, o.cy, s, o.alpha ?? 1, () => {
    const x = o.cx - w / 2, y = o.cy - h / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(255,75,43,0.6)';
    ctx.shadowBlur = size * 1.1;
    ctx.shadowOffsetY = size * 0.2;
    rr(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = grad(ctx, x, y, w, h, o.stops ?? ['#FF4B2B', '#FF3D7F', '#B04BFF'], 0.15);
    ctx.fill();
    ctx.restore();
    // sheen
    if (o.t !== undefined) {
      const p = ((o.t * 0.6) % 1.6) / 1.6;
      ctx.save();
      rr(ctx, x, y, w, h, h / 2);
      ctx.clip();
      const sx = x - w * 0.3 + p * w * 1.6;
      const g = ctx.createLinearGradient(sx - 60, y, sx + 60, y + h);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.28)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }
    ctx.save();
    ctx.font = F(size, 800);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(o.text, o.cx - arrowW / 2, o.cy + size * 0.36);
    ctx.restore();
    if (arrowW) arrowPath(ctx, o.cx + tw / 2 - arrowW / 2 + size * 0.95, o.cy, size * 0.62, '#fff', size * 0.12);
  });
  return { w: w * s, h: h * s };
}

/** Rounded app icon with glow. */
export function appIcon(ctx, img, cx, cy, size, o = {}) {
  ctx.save();
  if (o.glow !== false) glow(ctx, cx, cy, size * 1.2, '255,75,43', 0.28 * (o.alpha ?? 1));
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = size * 0.25;
  ctx.shadowOffsetY = size * 0.06;
  rr(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.23);
  ctx.fillStyle = '#12082A';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  ctx.restore();
}

/** Animated stamp (✓ or ✕) inside a circle. p = 0..1 */
export function stamp(ctx, type, cx, cy, r, p) {
  if (p <= 0) return;
  const s = ease.outBack(clamp(p));
  withPop(ctx, cx, cy, s, clamp(p * 2), () => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = type === 'check' ? C.green : C.red;
    ctx.shadowColor = type === 'check' ? 'rgba(43,213,118,0.6)' : 'rgba(255,77,94,0.5)';
    ctx.shadowBlur = r * 0.8;
    ctx.fill();
    ctx.restore();
    if (type === 'check') checkPath(ctx, cx, cy + r * 0.04, r * 1.05, '#fff', r * 0.2);
    else crossPath(ctx, cx, cy, r * 1.0, '#fff', r * 0.2);
  });
}

/** Burst of floating hearts. */
export function hearts(ctx, t, t0, x, y, o = {}) {
  const n = o.n ?? 8, life = o.life ?? 1.6;
  const dt = t - t0;
  if (dt < 0 || dt > life + 0.6) return;
  let seed = o.seed ?? 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const delay = rnd() * 0.5, ang = -Math.PI / 2 + (rnd() - 0.5) * (o.spread ?? 1.6);
    const sp = (o.dist ?? 260) * (0.6 + rnd() * 0.6), sz = (o.size ?? 46) * (0.6 + rnd() * 0.7);
    const p = clamp((dt - delay) / life);
    if (p <= 0 || p >= 1) continue;
    const e = ease.outCubic(p);
    const hx = x + Math.cos(ang) * sp * e + Math.sin(p * 9 + i) * 12;
    const hy = y + Math.sin(ang) * sp * e;
    ctx.save();
    ctx.globalAlpha = (1 - p) * clamp(p * 6);
    heartPath(ctx, hx, hy, sz * (0.7 + 0.3 * ease.outBack(clamp(p * 3))));
    ctx.fillStyle = i % 3 === 0 ? C.pink : i % 3 === 1 ? C.accent : '#FF7A9A';
    ctx.fill();
    ctx.restore();
  }
}

/** Confetti burst. */
export function confetti(ctx, t, t0, cx, cy, o = {}) {
  const n = o.n ?? 40, life = o.life ?? 1.4;
  const dt = t - t0;
  if (dt < 0 || dt > life) return;
  let seed = o.seed ?? 5;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cols = o.colors ?? [C.accent, C.pink, C.violet, C.cyan, C.yellow, C.green];
  for (let i = 0; i < n; i++) {
    const ang = rnd() * Math.PI * 2, sp = (o.speed ?? 900) * (0.4 + rnd() * 0.8);
    const p = dt / life;
    const x = cx + Math.cos(ang) * sp * dt * (1 - p * 0.5);
    const y = cy + Math.sin(ang) * sp * dt * (1 - p * 0.5) + 700 * dt * dt;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.translate(x, y);
    ctx.rotate(rnd() * 6 + dt * 8 * (rnd() - 0.5));
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(-7, -4, 14, 8);
    ctx.restore();
  }
}

// ---------------- End card ----------------

/** End card background layer (no text). */
export function endCardBG(ctx, env, o = {}) {
  const { W, H, t } = env;
  const t0 = o.t0 ?? 0;
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
  g.addColorStop(0, '#0E0F14');
  g.addColorStop(0.55, '#170B26');
  g.addColorStop(1, '#2A0E2E');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (o.photo) {
    const b = blurred(o.photoKey ?? 'end', o.photo, 40, { brightness: 0.55, saturate: 1.1 });
    cover(ctx, b, 0, 0, W, H, { zoom: 1.1 + (t - t0) * 0.02, fx: o.fx ?? 0.5, fy: o.fy ?? 0.35, alpha: o.photoAlpha ?? 0.45 });
  }
  const dt = t - t0;
  glow(ctx, W * (0.25 + 0.08 * Math.sin(dt * 0.9)), H * (0.3 + 0.04 * Math.cos(dt * 0.7)), W * 0.75, '255,75,43', 0.32);
  glow(ctx, W * (0.8 + 0.06 * Math.cos(dt * 0.8)), H * (0.62 + 0.05 * Math.sin(dt * 0.6)), W * 0.8, '142,75,255', 0.3);
  glow(ctx, W * 0.5, H * 0.95, W * 0.7, '255,61,127', 0.18);
  vignette(ctx, W, H, 0.45);
  grain(ctx, W, H, t, 0.05);
}

/** End card overlay (logo, domain, CTA, disclaimer). Group is centred above the disclaimer. */
export function endCardFG(ctx, env, o) {
  const { t, geom, img, common, W } = env;
  const dt = t - o.t0;
  if (dt < -0.01) return;
  const { box, tall } = geom;
  const cx = W / 2;
  const appear = (d) => {
    const p = clamp((dt - d) / 0.45);
    return { a: ease.outCubic(p), dy: (1 - ease.outCubic(p)) * 50 };
  };
  // disclaimer — legible (>= 30px) and visible for the whole end card
  const DL = layout(ctx, common.disclaimer, { size: tall ? 32 : 30, weight: 500, maxW: tall ? 760 : 900, lh: 1.3, balance: true });
  const discY = box.y1 - DL.height - (tall ? 6 : 4);
  const iconS = tall ? 230 : 180;
  const domL = layout(ctx, common.domain, { size: tall ? 74 : 64, weight: 800, maxW: geom.maxW + 60 });
  const subL = o.sub ? layout(ctx, o.sub, { size: tall ? 42 : 38, weight: 500, maxW: geom.maxW, lh: 1.25, balance: true }) : null;
  const ctaSize = tall ? 58 : 52;
  const ctaH = ctaSize * 2.15;
  const g1 = tall ? 64 : 44, g2 = tall ? 22 : 16, g3 = tall ? 70 : 50;
  const groupH = iconS + g1 + domL.height + (subL ? g2 + subL.height : 0) + g3 + ctaH;
  const regionTop = box.y0, regionBot = discY - (tall ? 60 : 40);
  let y = regionTop + Math.max(0, (regionBot - regionTop - groupH) / 2);
  const a1 = appear(0);
  ctx.save();
  ctx.globalAlpha = a1.a;
  appIcon(ctx, img('app_icon'), cx, y + iconS / 2 + a1.dy, iconS * (0.85 + 0.15 * ease.outBack(clamp(dt / 0.5))));
  ctx.restore();
  y += iconS + g1;
  const a2 = appear(0.12);
  draw(ctx, domL, cx, y + a2.dy, { align: 'center', color: '#fff', alpha: a2.a });
  y += domL.height;
  if (subL) {
    const a3 = appear(0.22);
    y += g2;
    draw(ctx, subL, cx, y + a3.dy, { align: 'center', color: 'rgba(242,242,245,0.85)', alpha: a3.a });
    y += subL.height;
  }
  y += g3;
  const pb = clamp((dt - 0.35) / 0.5);
  if (pb > 0) {
    ctaButton(ctx, { cx, cy: y + ctaH / 2, text: o.cta, size: ctaSize, t: dt > 0.85 ? dt : undefined, scale: 0.7 + 0.3 * ease.outBack(pb), alpha: clamp(pb * 3), minW: tall ? 640 : 600 });
  }
  const ad = appear(0.3);
  draw(ctx, DL, cx, discY + ad.dy * 0.4, { align: 'center', color: 'rgba(225,227,236,0.92)', alpha: ad.a });
}
