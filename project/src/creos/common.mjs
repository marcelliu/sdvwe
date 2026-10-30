// Helpers shared by the creatives: chat panel, captions, typing, transitions.
import { clamp, ease } from '../engine/core.mjs';
import { layout, draw } from '../engine/text.mjs';
import { C, THEMES, rr, bubble, bubbleLayout, typingBubble, chatHeader, inputBar } from '../engine/ui.mjs';

/** Characters of `str` revealed between t0 and t1 (emoji-safe). */
export function typed(str, t, t0, t1) {
  const ch = Array.from(str);
  const n = Math.round(clamp((t - t0) / (t1 - t0)) * ch.length);
  return ch.slice(0, n).join('');
}

/** Times of individual key taps for typed(): used to place key-tap SFX. */
export function keyTimes(str, t0, t1) {
  const ch = Array.from(str);
  const out = [];
  for (let i = 1; i <= ch.length; i++) if (ch[i - 1] !== ' ') out.push(t0 + ((i - 0.5) / ch.length) * (t1 - t0));
  return out;
}

export function keySfx(str, t0, t1, gainDb = -13) {
  return keyTimes(str, t0, t1).map((t, i) => ({ sfx: `key_tap_${(i % 3) + 1}`, t, gainDb: gainDb + ((i * 7) % 3) - 1 }));
}

/** TikTok-native caption: white rounded line boxes with dark text. Returns bbox. */
export function caption(ctx, str, x, y, o = {}) {
  const size = o.size ?? 58;
  const L = layout(ctx, str, { size, weight: o.weight ?? 800, maxW: o.maxW ?? 820, lh: o.lh ?? 1.32, balance: true });
  if (o.pop !== undefined) {
    // whole caption pops in (scale + fade) instead of word-by-word
    const p = clamp(o.pop);
    if (p <= 0) return { x, y, w: 0, h: 0 };
    const s = 0.86 + 0.14 * ease.outBack(p);
    const py = o.valign === 'bottom' ? y - L.height / 2 : y + L.height / 2;
    ctx.save();
    ctx.translate(x, py);
    ctx.scale(s, s);
    ctx.translate(-x, -py);
    ctx.globalAlpha *= clamp(p * 2.5);
  }
  const r = draw(ctx, L, x, y, {
    align: o.align ?? 'center', valign: o.valign ?? 'top', color: o.color ?? C.ink, hlColor: o.hlColor ?? C.accent,
    lineBox: { fill: o.box ?? '#FFFFFF', padX: size * 0.42, padY: size * 0.02, r: size * 0.3, shadow: { color: 'rgba(0,0,0,0.25)', blur: 18, y: 4 } },
    wordFx: o.wordFx, alpha: o.alpha ?? 1,
  });
  if (o.pop !== undefined) ctx.restore();
  return r;
}

/** White flash overlay peaking at t0. */
export function flash(ctx, W, H, t, t0, d = 0.25, a = 0.5, color = '255,255,255') {
  const x = Math.abs(t - t0) / d;
  if (x >= 1) return;
  ctx.save();
  ctx.fillStyle = `rgba(${color},${a * (1 - x) * (1 - x)})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Clip to a circle of radius r around (cx,cy) and run fn. */
export function inCircle(ctx, cx, cy, r, fn) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0.1, r), 0, Math.PI * 2);
  ctx.clip();
  fn();
  ctx.restore();
}

/** Geometry of the chat panel header avatar (used for match-cut transitions). */
export function panelAvatar(o) {
  const hh = o.headerH ?? 132;
  const size = hh * 0.3, ar = hh * 0.32;
  return { x: o.x + size * 1.9 + ar, y: o.y + hh / 2, r: ar };
}

/**
 * Chat panel (header + messages + optional input).
 * o: {x,y,w,h,headerH,t,theme,appear, name,img,fx,fy,zoom, status(t)->{text,color}, msgs:[{side,text,t,time,ticks:[[t,n],..]}],
 *     typing:[[t0,t1]], input:{text,t0,t1,sendT}, size, placeholder}
 */
export function chatPanel(ctx, o) {
  const th = THEMES[o.theme ?? 'dark'];
  const { x, y, w, h, t } = o;
  const ap = o.appear ?? 1;
  if (ap <= 0) return;
  const size = o.size ?? 40;
  const hh = o.headerH ?? 132;
  ctx.save();
  ctx.globalAlpha *= clamp(ap * 1.5);
  ctx.translate(0, (1 - ease.outCubic(clamp(ap))) * 80);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 18;
  rr(ctx, x, y, w, h, 46);
  ctx.fillStyle = th.panel;
  ctx.fill();
  ctx.restore();
  ctx.save();
  rr(ctx, x, y, w, h, 46);
  ctx.clip();
  const st = o.status ? o.status(t) : { text: 'онлайн', color: C.green };
  chatHeader(ctx, { x, y, w, h: hh, theme: o.theme, img: o.img, fx: o.fx, fy: o.fy, zoom: o.zoom, name: o.name, status: st.text, statusColor: st.color, online: true });
  const pad = size * 0.85;
  const inputH = o.input ? size * 2.5 : 0;
  const areaTop = y + hh + size * 0.9;
  const areaBot = y + h - (o.input ? inputH + pad * 1.2 : pad);
  const maxW = w * 0.76;
  const items = [];
  for (const m of o.msgs ?? []) {
    if (t < m.t) continue;
    const B = bubbleLayout(ctx, { text: m.text, size, maxW, time: m.time });
    const ticks = (m.ticks ?? []).reduce((n, [tt, k]) => (t >= tt ? k : n), 0);
    items.push({ kind: 'msg', m, B, ticks, t0: m.t, h: B.h });
  }
  for (const [a, b] of o.typing ?? []) if (t >= a && t < b) items.push({ kind: 'typing', t0: a, h: size * 1.55 });
  items.sort((p, q) => p.t0 - q.t0);
  const gap = size * 0.5;
  const total = items.reduce((s, it) => s + it.h + gap, 0);
  const scroll = Math.max(0, total - (areaBot - areaTop));
  let cy = areaTop - scroll;
  for (const it of items) {
    const p = clamp((t - it.t0) / 0.38);
    if (it.kind === 'msg') {
      const out = it.m.side === 'out';
      bubble(ctx, { B: it.B, x: out ? x + w - pad : x + pad, y: cy, side: it.m.side, theme: o.theme, appear: p, time: it.m.time, ticks: it.ticks, text: it.m.text, size });
    } else typingBubble(ctx, { x: x + pad, y: cy, t, theme: o.theme, appear: p, size });
    cy += it.h + gap;
  }
  if (o.input) {
    const I = o.input;
    const txt = I.text ? typed(I.text, t, I.t0, I.t1) : '';
    const sent = I.sendT !== undefined && t >= I.sendT;
    inputBar(ctx, {
      x: x + pad * 0.7, y: y + h - inputH - pad * 0.7, w: w - pad * 1.4, h: inputH, theme: o.theme, size: size * 0.95,
      text: sent ? '' : txt, caret: !sent && t >= I.t0 - 0.4 && Math.floor(t * 2.2) % 2 === 0, placeholder: o.placeholder,
      press: I.sendT !== undefined ? clamp((t - I.sendT + 0.12) / 0.24) : 0,
    });
  }
  ctx.restore();
  ctx.restore();
}
