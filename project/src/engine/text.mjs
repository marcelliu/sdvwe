// Rich text layout + drawing (word wrap, [[highlight]] markup, per-line caption boxes, per-word animation).
import { clamp } from './core.mjs';

export const EMOJI = '"Noto Color Emoji"';

/** CSS font string with colour-emoji fallback. */
export function F(size, weight = 800, fam = 'Onest', italic = false) {
  return `${italic ? 'italic ' : ''}${weight} ${Math.round(size * 10) / 10}px ${fam}, ${EMOJI}`;
}

const hasLetter = (s) => /[\p{L}\p{N}]/u.test(s);

/**
 * Split text into unbreakable units. A unit is a run of tokens that must stay on one line:
 * tokens glued without whitespace (e.g. «[[привіт]]»), trailing emoji/dashes/punctuation,
 * and words following a lone opening quote.
 */
function tokenize(text) {
  const segs = [];
  const re = /\[\[(.+?)\]\]/gs;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index), hl: false });
    segs.push({ text: m[1], hl: true });
    last = re.lastIndex;
  }
  if (last < text.length) segs.push({ text: text.slice(last), hl: false });

  const toks = [];
  let space = false, brk = false;
  for (const seg of segs) {
    // split on ordinary whitespace only: U+00A0 (NBSP) keeps words together
    for (const p of seg.text.split(/([ \t\n\r]+)/)) {
      if (p === '') continue;
      if (/^[ \t\n\r]+$/.test(p)) {
        if (p.includes('\n')) brk = true;
        else space = true;
        continue;
      }
      toks.push({ text: p, hl: seg.hl, space: toks.length > 0 && space && !brk, br: brk });
      space = false;
      brk = false;
    }
  }
  const isOpen = (s) => /^[«„“(\[]+$/.test(s);
  // Ukrainian typography: one-letter words (і, й, в, у, з, а, о…) stay with the next word
  const isShort = (s) => /^[«„“(]?[\p{L}][.,]?$/u.test(s);
  const units = [];
  for (const tk of toks) {
    const u = units[units.length - 1];
    const prev = u && u.toks[u.toks.length - 1];
    const attach = u && !tk.br && (!tk.space || !hasLetter(tk.text) || (prev && (isOpen(prev.text) || isShort(prev.text))));
    if (attach) u.toks.push(tk);
    else units.push({ toks: [tk], br: tk.br });
  }
  return units;
}

/**
 * Layout text into lines.
 * opts: size, weight, fam, italic, maxW, lh (line-height multiplier), ls (letter spacing px)
 */
export function layout(ctx, text, opts = {}) {
  if (opts.balance) {
    // shortest width that keeps the same line count -> even lines, no orphans
    const first = layout(ctx, text, { ...opts, balance: false });
    if (first.lines.length < 2) return first;
    let lo = (opts.maxW ?? 900) * 0.4, hi = opts.maxW ?? 900, best = first;
    for (let i = 0; i < 9; i++) {
      const mid = (lo + hi) / 2;
      const L = layout(ctx, text, { ...opts, maxW: mid, balance: false });
      if (L.lines.length <= first.lines.length) {
        best = L;
        hi = mid;
      } else lo = mid;
    }
    return best;
  }
  const size = opts.size ?? 64, weight = opts.weight ?? 800, fam = opts.fam ?? 'Onest', italic = !!opts.italic;
  const maxW = opts.maxW ?? 900, lhMul = opts.lh ?? 1.15, ls = opts.ls ?? 0;
  const font = F(size, weight, fam, italic);
  ctx.save();
  ctx.font = font;
  ctx.letterSpacing = `${ls}px`;
  const spaceW = ctx.measureText(' ').width;
  const capH = ctx.measureText('НЖ').actualBoundingBoxAscent || size * 0.72;
  const units = tokenize(String(text ?? ''));
  const lines = [];
  let cur = { words: [], w: 0 };
  let n = 0;
  for (const u of units) {
    let uw = 0;
    const placed = u.toks.map((tk, k) => {
      const gap = k > 0 && tk.space ? spaceW : 0;
      const w = ctx.measureText(tk.text).width;
      const p = { text: tk.text, hl: tk.hl, w, dx: uw + gap };
      uw += gap + w;
      return p;
    });
    const gap = cur.words.length ? spaceW : 0;
    if (u.br || (cur.words.length && cur.w + gap + uw > maxW)) {
      lines.push(cur);
      cur = { words: [], w: 0 };
    }
    const g = cur.words.length ? spaceW : 0;
    for (const p of placed) cur.words.push({ text: p.text, hl: p.hl, w: p.w, x: cur.w + g + p.dx, i: n });
    cur.w += g + uw;
    n++;
  }
  if (cur.words.length) lines.push(cur);
  ctx.restore();
  const lh = size * lhMul;
  const width = lines.reduce((a, l) => Math.max(a, l.w), 0);
  return { lines, lh, size, font, ls, capH, width, height: lines.length * lh, words: n, maxW };
}

/** Largest size (<= opts.size) that fits maxW and maxLines. */
export function fit(ctx, text, opts = {}) {
  let size = opts.size ?? 64;
  const minSize = opts.minSize ?? size * 0.5;
  const maxLines = opts.maxLines ?? 3;
  let L = layout(ctx, text, { ...opts, size });
  while ((L.lines.length > maxLines || L.width > (opts.maxW ?? 900) + 0.5) && size > minSize) {
    size *= 0.95;
    L = layout(ctx, text, { ...opts, size });
  }
  return L;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
}

/**
 * Draw a layout. (x, y) = anchor; align = left|center|right; valign = top|middle|bottom.
 * o: color, hlColor, hlBox{fill,padX,padY,r}, lineBox{fill,padX,padY,r}, shadow{color,blur,y},
 *    stroke{color,width}, alpha, wordFx(i,total)->{a,dy,dx,s}
 * Returns bbox.
 */
export function draw(ctx, L, x, y, o = {}) {
  const align = o.align ?? 'center', valign = o.valign ?? 'top';
  const totalH = L.height;
  let top = valign === 'middle' ? y - totalH / 2 : valign === 'bottom' ? y - totalH : y;
  const alpha = o.alpha ?? 1;
  if (alpha <= 0.001) return { x, y: top, w: 0, h: totalH };
  ctx.save();
  ctx.font = L.font;
  ctx.letterSpacing = `${L.ls}px`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const lineX = (l) => (align === 'center' ? x - l.w / 2 : align === 'right' ? x - l.w : x);
  const baseOff = L.lh / 2 + L.capH / 2;
  let minX = Infinity, maxX = -Infinity;

  // per-line caption boxes
  if (o.lineBox) {
    const b = o.lineBox;
    ctx.save();
    ctx.globalAlpha = alpha * (b.alpha ?? 1);
    ctx.fillStyle = b.fill ?? '#fff';
    if (b.shadow) {
      ctx.shadowColor = b.shadow.color;
      ctx.shadowBlur = b.shadow.blur;
      ctx.shadowOffsetY = b.shadow.y ?? 0;
    }
    L.lines.forEach((l, li) => {
      const lx = lineX(l);
      const vis = o.wordFx ? Math.max(...l.words.map((w) => o.wordFx(w.i, L.words).a ?? 1)) : 1;
      if (vis <= 0.001) return;
      ctx.globalAlpha = alpha * (b.alpha ?? 1) * clamp(vis);
      rr(ctx, lx - b.padX, top + li * L.lh - b.padY + (b.dy ?? 0), l.w + b.padX * 2, L.lh + b.padY * 2, b.r ?? 16);
      ctx.fill();
    });
    ctx.restore();
  }

  L.lines.forEach((l, li) => {
    const lx = lineX(l);
    minX = Math.min(minX, lx);
    maxX = Math.max(maxX, lx + l.w);
    const by = top + li * L.lh + baseOff;
    for (const w of l.words) {
      const fx = o.wordFx ? o.wordFx(w.i, L.words) : null;
      const a = alpha * (fx?.a ?? 1);
      if (a <= 0.001) continue;
      const wx = lx + w.x + (fx?.dx ?? 0);
      const wy = by + (fx?.dy ?? 0);
      const s = fx?.s ?? 1;
      ctx.save();
      ctx.globalAlpha = a;
      if (s !== 1) {
        const cx = wx + w.w / 2, cy = wy - L.capH / 2;
        ctx.translate(cx, cy);
        ctx.scale(s, s);
        ctx.translate(-cx, -cy);
      }
      if (w.hl && o.hlBox) {
        const b = o.hlBox;
        ctx.save();
        ctx.fillStyle = b.fill;
        if (b.rot) {
          ctx.translate(wx + w.w / 2, wy - L.capH / 2);
          ctx.rotate(b.rot);
          ctx.translate(-(wx + w.w / 2), -(wy - L.capH / 2));
        }
        rr(ctx, wx - b.padX, wy - L.capH - b.padY, w.w + b.padX * 2, L.capH + b.padY * 2, b.r ?? 12);
        ctx.fill();
        ctx.restore();
      }
      if (o.shadow) {
        ctx.shadowColor = o.shadow.color;
        ctx.shadowBlur = o.shadow.blur;
        ctx.shadowOffsetY = o.shadow.y ?? 0;
      }
      if (o.stroke) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = o.stroke.width;
        ctx.strokeStyle = o.stroke.color;
        ctx.strokeText(w.text, wx, wy);
        ctx.shadowColor = 'transparent';
      }
      ctx.fillStyle = w.hl ? (o.hlColor ?? o.color ?? '#fff') : (o.color ?? '#fff');
      ctx.fillText(w.text, wx, wy);
      ctx.restore();
    }
  });
  ctx.restore();
  return { x: minX, y: top, w: maxX - minX, h: totalH };
}

/** Convenience: layout + draw in one call. Returns bbox. */
export function text(ctx, str, x, y, o = {}) {
  const L = o.fit ? fit(ctx, str, o) : layout(ctx, str, o);
  return { ...draw(ctx, L, x, y, o), L };
}

/** Word-by-word reveal helper for draw(...wordFx). */
export function wordReveal(t, t0, step = 0.12, dur = 0.3, rise = 28) {
  return (i) => {
    const p = clamp((t - (t0 + i * step)) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    return { a: e, dy: (1 - e) * rise };
  };
}

/** Word pop (scale overshoot) helper. */
export function wordPop(t, t0, step = 0.1, dur = 0.28) {
  return (i) => {
    const p = clamp((t - (t0 + i * step)) / dur);
    if (p <= 0) return { a: 0, s: 0.6 };
    const s = 1.70158;
    const e = 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
    return { a: Math.min(1, p * 2.5), s: 0.6 + 0.4 * e };
  };
}
