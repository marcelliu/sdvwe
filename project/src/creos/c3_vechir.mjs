// Creo 3 — «Той самий вечір»: split screen, cold variant A vs warm variant B; B takes over.
// 90 BPM (beat 0.6667 s): phrase pairs land on beats, takeover on the music drop at 10.667 s.
import { clamp, ease, win } from '../engine/core.mjs';
import { layout, draw, wordPop } from '../engine/text.mjs';
import { cover, tint, vignette, scrim, grain, bokeh } from '../engine/fx.mjs';
import { C, rr, grad, pill, bubble, bubbleLayout, avatar, endCardBG, endCardFG } from '../engine/ui.mjs';
import { flash } from './common.mjs';

const B = 2 / 3; // beat
const S = { P1: 4 * B, P2: 8 * B, P3: 12 * B, TAKE: 16 * B, GIRL: 24 * B, E: 30 * B, END: 24 };
const PAIRS = [
  [S.P1, S.P1 + B],
  [S.P2, S.P2 + B],
  [S.P3, S.P3 + B],
];
const BUBBLE_T = S.TAKE + 0.95;

function divX(env) {
  // divider position: centre, slides off to the left on the takeover
  const p = ease.inOutCubic(clamp((env.t - S.TAKE) / 0.6));
  return env.W / 2 - p * (env.W / 2 + 12);
}

function sideA(ctx, env, x0, x1) {
  const { W, H, t } = env;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, 0, x1 - x0, H);
  ctx.clip();
  const sw = W / 2;
  // cold, still evening: TV flicker on a static frame
  const flick = 0.9 + 0.06 * Math.sin(t * 13.1) + 0.04 * Math.sin(t * 29.7 + 1.3);
  cover(ctx, env.img('P2'), 0, 0, sw, H, { zoom: 1.05 + 0.02 * clamp(t / 10), fx: 0.42, fy: 0.47, filter: `brightness(${flick}) saturate(0.55)` });
  tint(ctx, sw, H, '#1d3f7a', 'soft-light', 0.55);
  tint(ctx, sw, H, '#0a1222', 'multiply', 0.32);
  ctx.restore();
}

function sideB(ctx, env, x0) {
  const { W, H, t } = env;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, 0, W - x0, H);
  ctx.clip();
  if (t < S.TAKE) {
    // right strip shows the kitchen framed on the man
    cover(ctx, env.vid('va1'), W / 2, 0, W / 2, H, { zoom: 1.04, fx: 0.55, fy: 0.46 });
  } else {
    const k = clamp((t - S.TAKE) / (S.GIRL - S.TAKE));
    // grow from the strip framing to full frame during the slide
    const p = ease.inOutCubic(clamp((t - S.TAKE) / 0.6));
    const bx = (W / 2) * (1 - p), bw = W - bx;
    cover(ctx, env.vid('va2'), bx, 0, bw, H, { zoom: 1.04 + 0.06 * k, fx: 0.55, fy: env.geom.tall ? 0.46 : 0.43 });
  }
  tint(ctx, W, H, '#ff9440', 'soft-light', 0.22);
  ctx.restore();
}

function bgSplit(ctx, env) {
  const { W, H, t } = env;
  const dx = divX(env);
  sideB(ctx, env, Math.max(0, dx));
  if (dx > 0) sideA(ctx, env, 0, dx);
  scrim(ctx, W, 0, H * 0.42, '6,8,16', 0.72, 0);
  if (t >= S.TAKE) bokeh(ctx, W, H, t, { n: 9, alpha: 0.12 * clamp((t - S.TAKE) / 0.8), seed: 21, colors: ['255,170,90', '255,120,80', '255,200,140'] });
  vignette(ctx, W, H, 0.45);
  if (dx > 2) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#fff';
    ctx.fillRect(dx - 3, 0, 6, H);
    ctx.restore();
  }
}

function bgGirl(ctx, env) {
  const { W, H, t } = env;
  const k = clamp((t - S.GIRL) / 4);
  const img = env.img('GIRL_1_1');
  // tight crop: face, hand and shoulder only (frame never goes below source y≈1300 px)
  const s0 = Math.max(W / img.width, H / img.height);
  const zoom = (H / 1300 / s0) * (1 + 0.06 * k);
  cover(ctx, img, 0, 0, W, H, { zoom, fx: 0.49, fy: 0.235 });
  tint(ctx, W, H, '#ffb070', 'soft-light', 0.12);
  scrim(ctx, W, H * 0.5, H, '24,8,10', 0, 0.75);
  vignette(ctx, W, H, 0.4);
}

function phraseBox(ctx, env, str, side, t0) {
  const { t, geom, W } = env;
  const { tall } = geom;
  const p = clamp((t - t0) / 0.3);
  if (p <= 0) return;
  const size = tall ? 54 : 46;
  const colW = W / 2;
  const maxW = colW - (tall ? 110 : 100);
  const L = layout(ctx, str, { size, weight: 800, maxW, lh: 1.2, balance: true });
  const padX = 26, padY = 18;
  const bw = L.width + padX * 2, bh = L.height + padY * 2;
  const cx = side === 'A' ? colW / 2 : colW + colW / 2 - (tall ? 22 : 0);
  const y = tall ? 300 : 196;
  const s = 0.7 + 0.3 * ease.outBack(p);
  ctx.save();
  ctx.globalAlpha = clamp(p * 3);
  ctx.translate(cx, y + bh / 2);
  ctx.scale(s, s);
  ctx.translate(-cx, -(y + bh / 2));
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 24;
  rr(ctx, cx - bw / 2, y, bw, bh, 22);
  ctx.fillStyle = side === 'A' ? 'rgba(28,36,54,0.88)' : grad(ctx, cx - bw / 2, y, bw, bh, ['#FF4B2B', '#FF3D7F', '#B04BFF'], 0.4);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  draw(ctx, L, cx, y + padY, { align: 'center', color: side === 'A' ? '#C9D3E6' : '#fff' });
  ctx.restore();
}

export default {
  id: 'c3',
  slug: '03_toi_samyi_vechir',
  title: '«Той самий вечір»',
  duration: S.END,
  bpm: 90,
  videos: [
    { key: 'va1', src: 'VA', from: 0.3, speed: 0.55, t0: 0, t1: S.TAKE + 0.1 },
    { key: 'va2', src: 'VA', from: 0.3 + S.TAKE * 0.55, speed: 0.34, t0: S.TAKE, t1: S.GIRL + 0.5 },
  ],

  audio() {
    const ev = [
      { sfx: 'tv_noise_loop', t: 0, gainDb: -11, pan: -0.65, loopUntil: S.TAKE + 0.2, fadeOutSec: 0.5 },
      { sfx: 'text_hit', t: 0.05, gainDb: -7 },
      { sfx: 'text_hit', t: 0.55, gainDb: -7 },
      { sfx: 'riser_2s', t: S.TAKE, gainDb: -12, hit: true },
      { sfx: 'whoosh_long', t: S.TAKE + 0.3, gainDb: -7, hit: true },
      { sfx: 'msg_receive', t: BUBBLE_T, gainDb: -3 },
      { sfx: 'whoosh_short', t: S.GIRL, gainDb: -6, hit: true },
      { sfx: 'shimmer', t: S.GIRL + 0.1, gainDb: -12 },
      { sfx: 'text_hit', t: S.GIRL + 0.55, gainDb: -8 },
      { sfx: 'whoosh_short', t: S.E, gainDb: -5, hit: true },
      { sfx: 'final_hit', t: S.E + 0.05, gainDb: -3 },
    ];
    for (const [a, b] of PAIRS) {
      ev.push({ sfx: 'tock', t: a, gainDb: -6, pan: -0.5 });
      ev.push({ sfx: 'tick', t: b, gainDb: -6, pan: 0.5 });
      ev.push({ sfx: 'bubble_pop_2', t: b + 0.02, gainDb: -12, pan: 0.5 });
    }
    return { music: [{ track: 'm3_two_evenings', gainDb: -1.5 }], events: ev };
  },

  bg(ctx, env) {
    const { W, H, t } = env;
    if (t < S.GIRL) bgSplit(ctx, env);
    else if (t < S.E) {
      const p = ease.inOutCubic(clamp((t - S.GIRL) / 0.45));
      if (p < 1) {
        bgSplit(ctx, env);
        ctx.save();
        ctx.beginPath();
        ctx.rect(W * (1 - p), 0, W * p, H);
        ctx.clip();
        bgGirl(ctx, env);
        ctx.restore();
      } else bgGirl(ctx, env);
    } else {
      endCardBG(ctx, env, { t0: S.E, photo: env.img('GIRL_1_1'), photoKey: 'g11', fy: 0.2, photoAlpha: 0.4 });
      if (t < S.E + 0.4) {
        ctx.save();
        ctx.globalAlpha = 1 - ease.inOutQuad(clamp((t - S.E) / 0.4));
        bgGirl(ctx, env);
        ctx.restore();
      }
    }
    flash(ctx, W, H, t, S.TAKE + 0.05, 0.25, 0.35, '255,220,180');
    grain(ctx, W, H, t, 0.055);
  },

  fg(ctx, env) {
    const { W, t, geom, T, common } = env;
    const { box, cx, maxW, tall } = geom;
    if (t < S.GIRL) {
      const dx = divX(env);
      // hook title (0 – first pair)
      const ta = 1 - ease.inCubic(clamp((t - S.P1 + 0.25) / 0.25));
      if (ta > 0) {
        const top = box.y0 + (tall ? 20 : 4);
        const L1 = layout(ctx, T.hook1, { size: tall ? 84 : 72, weight: 900, maxW: maxW + 80 });
        draw(ctx, L1, W / 2, top, { align: 'center', color: '#fff', alpha: ta, shadow: { color: 'rgba(0,0,0,0.6)', blur: 20, y: 3 }, wordFx: wordPop(t, 0.0, 0.1, 0.28) });
        const L2 = layout(ctx, T.hook2, { size: tall ? 84 : 72, weight: 900, maxW: maxW + 80 });
        draw(ctx, L2, W / 2, top + L1.height + 10, { align: 'center', color: '#fff', hlColor: '#fff', hlBox: { fill: C.accent, padX: 16, padY: 12, r: 14, rot: -0.025 }, alpha: ta, wordFx: wordPop(t, 0.45, 0.12, 0.28) });
      }
      // labels: under the title during the hook, then move up
      const lp = ease.inOutCubic(clamp((t - S.P1 + 0.25) / 0.35));
      const ly = tall ? 175 + (1 - lp) * 260 : 92 + (1 - lp) * 180;
      const la = clamp((t - 0.9) / 0.3);
      const lsz = tall ? 36 : 32;
      const bHome = W * 0.75 - (tall ? 22 : 0);
      if (dx > W * 0.2) pill(ctx, { x: W / 4, y: ly, text: T.labelA, size: lsz, weight: 800, ls: 3, bg: 'rgba(40,52,78,0.9)', color: '#C9D3E6', align: 'center', alpha: la * clamp(dx / (W / 2)) });
      const bLabelX = t < S.TAKE ? bHome : bHome + (cx - bHome) * ease.inOutCubic(clamp((t - S.TAKE) / 0.6));
      pill(ctx, { x: bLabelX, y: ly, text: T.labelB, size: lsz, weight: 800, ls: 3, bg: 'grad', color: '#fff', align: 'center', alpha: la, shadow: 'rgba(255,75,43,0.5)' });
      // phrase pairs
      const keys = [['a1', 'b1'], ['a2', 'b2'], ['a3', 'b3']];
      PAIRS.forEach(([ta0, tb0], i) => {
        const next = i < 2 ? PAIRS[i + 1][0] : S.TAKE;
        if (t >= ta0 - 0.01 && t < next) {
          const out = 1 - clamp((t - (next - 0.12)) / 0.12);
          ctx.save();
          ctx.globalAlpha = out;
          if (dx > W * 0.2) phraseBox(ctx, env, T[keys[i][0]], 'A', ta0);
          phraseBox(ctx, env, T[keys[i][1]], 'B', tb0);
          ctx.restore();
        }
      });
      // takeover: her message on the warm side
      if (t >= BUBBLE_T - 0.01) {
        const size = tall ? 50 : 46;
        const Bl = bubbleLayout(ctx, { text: T.bubble, size, maxW: tall ? 700 : 760 });
        const ar = size * 1.05;
        const total = ar * 2 + 18 + Bl.w;
        const x0 = cx - total / 2;
        const y = tall ? 330 : 230;
        const p = clamp((t - BUBBLE_T) / 0.4);
        const fl = Math.sin((t - BUBBLE_T) * 1.6) * 6;
        const out = 1 - clamp((t - (S.GIRL - 0.2)) / 0.2);
        ctx.save();
        ctx.globalAlpha = out;
        if (p > 0) {
          ctx.save();
          ctx.globalAlpha *= clamp(p * 2);
          avatar(ctx, env.img('GIRL_1'), x0 + ar, y + Bl.h - ar + fl, ar, { fx: 0.5, fy: 0.3, zoom: 3.2, ring: true, ringGap: '#1a1420', online: true, dotBorderColor: '#1a1420' });
          ctx.restore();
        }
        bubble(ctx, { B: Bl, x: x0 + ar * 2 + 18, y: y + fl, side: 'in', theme: 'light', appear: p, text: T.bubble, size });
        ctx.restore();
      }
      return;
    }
    if (t < S.E) {
      const a = win(t, S.GIRL + 0.3, S.E - 0.02, 0.25, 0.3);
      pill(ctx, { x: cx, y: box.y0 + (tall ? 20 : 10), text: `${common.girl} · ${common.online}`, size: tall ? 38 : 34, bg: 'rgba(12,12,22,0.6)', dot: true, t, align: 'center', alpha: a });
      const L = layout(ctx, T.choose, { size: tall ? 104 : 88, weight: 900, maxW, lh: 1.08, balance: true });
      draw(ctx, L, cx, box.y1 - (tall ? 40 : 30), {
        align: 'center', valign: 'bottom', color: '#fff', hlColor: '#fff', hlBox: { fill: C.accent, padX: 16, padY: 12, r: 16, rot: -0.025 },
        shadow: { color: 'rgba(0,0,0,0.5)', blur: 24, y: 4 }, wordFx: wordPop(t, S.GIRL + 0.5, 0.14, 0.3), alpha: win(t, S.GIRL, S.E - 0.02, 0.01, 0.3),
      });
      return;
    }
    endCardFG(ctx, env, { t0: S.E + 0.15, cta: T.cta, sub: T.endSub });
  },
};
