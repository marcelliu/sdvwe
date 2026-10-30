// Creo 1 — «23:47»: night POV. Phone lights up on the table -> kitchen -> chat -> her -> end card.
// 80 BPM: scene cuts on bar lines (bar = 3 s).
import { clamp, ease, prog, win, shake } from '../engine/core.mjs';
import { layout, draw, fit, wordReveal, wordPop } from '../engine/text.mjs';
import { cover, blurred, tint, vignette, scrim, grain, glow, bokeh } from '../engine/fx.mjs';
import { C, rr, notifCard, pill, endCardBG, endCardFG } from '../engine/ui.mjs';
import { caption, chatPanel, panelAvatar, flash, inCircle, keySfx } from './common.mjs';

const S = { B: 3, C: 9, D: 15, E: 21, END: 24 };
// Phone screen inside P4_phone.jpg (source pixels) and its centre.
const SCR = { x: 541, y: 905, w: 468, h: 960, r: 64 };
const FOC = { fx: 775 / 1536, fy: 1385 / 2752 };
const vib = (t) => ((t >= 0.15 && t < 0.5) || (t >= 0.65 && t < 1.0) ? 1 : 0);

function camA(env) {
  const { t, geom, W, H } = env;
  const img = env.img('P4');
  const s0 = Math.max(W / img.width, H / img.height);
  const Hs = geom.tall ? 840 : 820;
  const cy = geom.tall ? 985 : 860;
  let zoom = (Hs / SCR.h / s0) * (1 + 0.05 * ease.inOutSine(clamp(t / 3)));
  zoom *= 1 + 1.4 * ease.inCubic(clamp((t - 2.7) / 0.3));
  const sh = shake(t, 5 * vib(t), 60, 3);
  return { zoom, fx: FOC.fx, fy: FOC.fy, ox: sh.x, oy: cy - H / 2 + sh.y, clampEdges: false };
}

/** Same mapping the background uses for P4 (no drawing). */
function coverMap(env) {
  const { W, H } = env;
  const img = env.img('P4');
  const o = camA(env);
  const s = Math.max(W / img.width, H / img.height) * o.zoom;
  const dx = W / 2 - o.fx * img.width * s + o.ox;
  const dy = H / 2 - o.fy * img.height * s + o.oy;
  return { s, map: (px, py) => [dx + px * s, dy + py * s] };
}

function screenRect(m) {
  const [x, y] = m.map(SCR.x, SCR.y);
  return { x, y, w: SCR.w * m.s, h: SCR.h * m.s, r: SCR.r * m.s };
}

function chatGeom(geom) {
  return geom.tall ? { x: geom.cx - 425, y: 440, w: 850, h: 880, headerH: 150 } : { x: 540 - 445, y: 290, w: 890, h: 980, headerH: 150 };
}

// ---------------- background ----------------
function bgA(ctx, env) {
  const { W, H, t } = env;
  const m = cover(ctx, env.img('P4'), 0, 0, W, H, camA(env));
  tint(ctx, W, H, '#0b1733', 'multiply', 0.3);
  const on = prog(t, 0.15, 0.15);
  const s = screenRect(m);
  glow(ctx, s.x + s.w / 2, s.y + s.h / 2, s.h * 0.95, '160,185,255', 0.24 * on);
  vignette(ctx, W, H, 0.62);
}

function bgB(ctx, env) {
  const { W, H, t } = env;
  const k = clamp((t - S.B) / 6);
  cover(ctx, env.vid('va'), 0, 0, W, H, { zoom: 1.16 - 0.1 * ease.outCubic(clamp((t - S.B) / 0.6)) + 0.05 * k, fx: 0.5, fy: 0.42 });
  tint(ctx, W, H, '#ff9a50', 'soft-light', 0.18);
  scrim(ctx, W, H * 0.55, H, '8,6,14', 0, 0.55);
  vignette(ctx, W, H, 0.5);
}

function bgC(ctx, env) {
  const { W, H, t } = env;
  const b = blurred('P1', env.img('P1'), 34, { brightness: 0.62, saturate: 1.15 });
  cover(ctx, b, 0, 0, W, H, { zoom: 1.12 + 0.04 * clamp((t - S.C) / 6), fx: 0.55, fy: 0.3 });
  tint(ctx, W, H, '#2a1240', 'multiply', 0.25);
  glow(ctx, W * 0.15, H * 0.2, W * 0.6, '255,140,70', 0.22);
  glow(ctx, W * 0.9, H * 0.75, W * 0.7, '142,75,255', 0.2);
  vignette(ctx, W, H, 0.5);
}

function bgD(ctx, env) {
  const { W, H, t } = env;
  const k = clamp((t - S.D) / 6);
  cover(ctx, env.vid('vc'), 0, 0, W, H, { zoom: 1.1 + 0.06 * k, fx: 0.5, fy: env.geom.tall ? 0.36 : 0.33 });
  tint(ctx, W, H, '#ff8a5c', 'soft-light', 0.12);
  bokeh(ctx, W, H, t, { n: 10, alpha: 0.12, rMin: 40, rMax: 120, seed: 9 });
  scrim(ctx, W, H * 0.5, H, '10,6,18', 0, 0.78);
  vignette(ctx, W, H, 0.45);
}

export default {
  id: 'c1',
  slug: '01_2347',
  title: '«23:47»',
  duration: S.END,
  bpm: 80,
  videos: [
    { key: 'va', src: 'VA', from: 1.2, speed: 1.13, t0: S.B, t1: S.C + 0.4 },
    { key: 'vc', src: 'VC', from: 3.5, speed: 0.75, t0: S.D - 0.6, t1: S.E + 0.5 },
  ],

  audio(T) {
    return {
      music: [{ track: 'm1_lofi_night', gainDb: -1.5 }],
      events: [
        { sfx: 'room_tone_night', t: 0, gainDb: -4, loopUntil: 9.3, fadeOutSec: 0.8 },
        { sfx: 'vibrate_table', t: 0.15, gainDb: 0 },
        { sfx: 'sub_boom', t: 0.17, gainDb: -5 },
        { sfx: 'notify_chime', t: 0.25, gainDb: -3 },
        { sfx: 'whoosh_short', t: 0.6, gainDb: -10, hit: true },
        { sfx: 'text_hit', t: 0.02, gainDb: -7 },
        { sfx: 'text_hit', t: 0.6, gainDb: -9 },
        { sfx: 'whoosh_short', t: 3.0, gainDb: -4, hit: true },
        { sfx: 'bubble_pop_1', t: 3.4, gainDb: -12 },
        { sfx: 'whoosh_short', t: 9.0, gainDb: -9, hit: true },
        { sfx: 'msg_receive', t: 9.35, gainDb: -4 },
        ...keySfx(T.msg2, 10.0, 11.3),
        { sfx: 'tap', t: 11.42, gainDb: -8 },
        { sfx: 'msg_send', t: 11.5, gainDb: -5 },
        { sfx: 'msg_receive', t: 13.25, gainDb: -4 },
        { sfx: 'whoosh_long', t: 15.25, gainDb: -6, hit: true },
        { sfx: 'shimmer', t: 15.3, gainDb: -11 },
        { sfx: 'text_hit', t: 15.65, gainDb: -9 },
        { sfx: 'whoosh_short', t: 21.0, gainDb: -5, hit: true },
        { sfx: 'final_hit', t: 21.05, gainDb: -3 },
        { sfx: 'bubble_pop_2', t: 21.5, gainDb: -9 },
      ],
    };
  },

  bg(ctx, env) {
    const { W, H, t } = env;
    if (t < S.B) bgA(ctx, env);
    else if (t < S.C) bgB(ctx, env);
    else if (t < S.D) {
      bgC(ctx, env);
      if (t < S.C + 0.35) {
        ctx.save();
        ctx.globalAlpha = 1 - ease.inOutQuad(clamp((t - S.C) / 0.35));
        bgB(ctx, env);
        ctx.restore();
      }
    } else if (t < S.E) {
      // match-cut: her avatar in the chat header expands into the full frame
      const p = clamp((t - S.D) / 0.55);
      if (p < 1) {
        bgC(ctx, env);
        const a = panelAvatar(chatGeom(env.geom));
        const e = ease.inOutCubic(p);
        inCircle(ctx, a.x + (W / 2 - a.x) * e, a.y + (H / 2 - a.y) * e, a.r + e * Math.hypot(W, H), () => bgD(ctx, env));
      } else bgD(ctx, env);
    } else {
      endCardBG(ctx, env, { t0: S.E, photo: env.img('GIRL_1'), photoKey: 'g1', fy: 0.3 });
      if (t < S.E + 0.4) {
        ctx.save();
        ctx.globalAlpha = 1 - ease.inOutQuad(clamp((t - S.E) / 0.4));
        bgD(ctx, env);
        ctx.restore();
      }
    }
    flash(ctx, W, H, t, S.B, 0.22, 0.55);
    grain(ctx, W, H, t, 0.065);
  },

  fg(ctx, env) {
    const { t, geom, T, common } = env;
    const { box, cx, maxW, tall } = geom;

    // ---- A: hook (0–3) ----
    if (t < S.B) {
      const out = 1 - ease.inCubic(clamp((t - 2.7) / 0.3));
      const m = coverMap(env);
      const s = screenRect(m);
      const on = prog(t, 0.15, 0.12);
      if (on > 0) {
        // lock screen on the real phone
        ctx.save();
        ctx.globalAlpha = on;
        rr(ctx, s.x, s.y, s.w, s.h, s.r);
        ctx.clip();
        const g = ctx.createLinearGradient(s.x, s.y, s.x + s.w * 0.4, s.y + s.h);
        g.addColorStop(0, '#2B1B4D');
        g.addColorStop(0.55, '#141529');
        g.addColorStop(1, '#3A1426');
        ctx.fillStyle = g;
        ctx.fillRect(s.x, s.y, s.w, s.h);
        glow(ctx, s.x + s.w * 0.2, s.y + s.h * 0.85, s.w * 0.9, '255,75,43', 0.35, 'source-over');
        glow(ctx, s.x + s.w * 0.9, s.y + s.h * 0.2, s.w * 0.8, '142,75,255', 0.3, 'source-over');
        draw(ctx, layout(ctx, T.lockTime, { size: s.w * 0.25, weight: 600, maxW: s.w }), s.x + s.w / 2, s.y + s.h * 0.09, { align: 'center', color: 'rgba(255,255,255,0.95)' });
        ctx.restore();
      }
      // notification: small on screen, then pops out of the phone
      const small = { x: s.x + s.w * 0.04, y: s.y + s.h * 0.4, w: s.w * 0.92 };
      const bigW = tall ? 880 : 860;
      const big = { x: cx - bigW / 2, y: s.y + s.h * 0.43, w: bigW };
      const pp = ease.outBack(clamp((t - 0.5) / 0.42));
      if (t >= 0.25) {
        const a0 = clamp((t - 0.25) / 0.12);
        const r = { x: small.x + (big.x - small.x) * pp, y: small.y + (big.y - small.y) * pp, w: small.w + (big.w - small.w) * pp };
        ctx.save();
        ctx.globalAlpha = a0 * out;
        if (pp > 0.02) glow(ctx, r.x + r.w / 2, r.y + r.w * 0.1, r.w * 0.8, '255,75,43', 0.25 * pp);
        notifCard(ctx, { x: r.x, y: r.y, w: r.w, size: r.w * 0.05, icon: env.img('app_icon'), title: common.girl, text: T.notifText, when: 'зараз', theme: pp > 0.5 ? 'light' : 'dark' });
        ctx.restore();
      }
      // title: visible from the first frame (thumbnail), subtitle lands with the notification
      const top = box.y0 + (tall ? 18 : 6);
      const tOut = 1 - ease.inCubic(clamp((t - 2.5) / 0.25));
      ctx.save();
      ctx.globalAlpha = tOut;
      const L1 = layout(ctx, T.titleTime, { size: tall ? 168 : 132, weight: 900, maxW, ls: -3 });
      const ps = 1 + 0.06 * Math.exp(-((t - 0.15) ** 2) / 0.004);
      ctx.save();
      ctx.translate(cx, top + L1.height / 2);
      ctx.scale(ps, ps);
      ctx.translate(-cx, -(top + L1.height / 2));
      draw(ctx, L1, cx, top, { align: 'center', color: '#fff', shadow: { color: 'rgba(255,75,43,0.55)', blur: 40 } });
      ctx.restore();
      const L2 = fit(ctx, T.title, { size: tall ? 70 : 60, weight: 800, maxW: maxW + 40, maxLines: 1 });
      draw(ctx, L2, cx, top + L1.height - (tall ? 4 : 2), { align: 'center', color: '#fff', shadow: { color: 'rgba(0,0,0,0.6)', blur: 20, y: 4 }, wordFx: wordReveal(t, 0.55, 0.1, 0.3, 24) });
      ctx.restore();
      return;
    }

    // ---- B: kitchen (3–9) ----
    if (t < S.C) {
      const a = win(t, S.B + 0.35, S.C - 0.05, 0.01, 0.3);
      caption(ctx, T.question, cx, box.y1 - (tall ? 30 : 20), { size: tall ? 64 : 56, maxW: maxW - 40, valign: 'bottom', alpha: a, pop: (t - S.B - 0.35) / 0.35 });
      pill(ctx, { x: box.x0, y: box.y0 + 6, text: `🌙 ${T.lockTime}`, size: tall ? 34 : 30, bg: 'rgba(10,10,20,0.55)', align: 'left' });
      return;
    }

    // ---- C: chat (9–15) ----
    const cg = chatGeom(geom);
    if (t < S.D + 0.3) {
      const out = 1 - clamp((t - S.D) / 0.25);
      ctx.save();
      ctx.globalAlpha = out;
      const capY = tall ? box.y0 + 30 : box.y0 + 10;
      const capL = layout(ctx, T.caption, { size: tall ? 58 : 52, weight: 800, maxW: maxW - 20, lh: 1.22, balance: true });
      draw(ctx, capL, cx, capY, {
        align: 'center', color: '#fff', hlColor: '#fff', hlBox: { fill: C.accent, padX: 12, padY: 10, r: 12, rot: -0.02 },
        shadow: { color: 'rgba(0,0,0,0.5)', blur: 16, y: 3 }, wordFx: wordReveal(t, S.C + 0.1, 0.07, 0.3, 18),
      });
      chatPanel(ctx, {
        ...cg, t, theme: 'dark', appear: clamp((t - S.C) / 0.4), size: tall ? 46 : 44,
        name: common.girl, img: env.img('GIRL_1'), fx: 0.5, fy: 0.3, zoom: 3.2,
        status: (tt) => (tt >= 12.1 && tt < 13.25 ? { text: common.typing, color: C.accent } : { text: common.online, color: C.green }),
        msgs: [
          { side: 'in', text: T.msg1, t: 9.35, time: T.time1 },
          { side: 'out', text: T.msg2, t: 11.5, time: T.time2, ticks: [[11.5, 1], [12.0, 2]] },
          { side: 'in', text: T.msg3, t: 13.25, time: T.time2 },
        ],
        typing: [[12.1, 13.25]],
        input: { text: T.msg2, t0: 10.0, t1: 11.3, sendT: 11.42 },
        placeholder: common.placeholder,
      });
      ctx.restore();
      if (t < S.D) return;
    }

    // ---- D: her (15–21) ----
    if (t < S.E) {
      const a = win(t, S.D + 0.35, S.E - 0.02, 0.3, 0.3);
      pill(ctx, { x: cx, y: box.y0 + (tall ? 20 : 10), text: `${common.girl} · ${common.online}`, size: tall ? 38 : 34, bg: 'rgba(12,12,22,0.6)', dot: true, t, align: 'center', alpha: a });
      const L = layout(ctx, T.online, { size: tall ? 92 : 80, weight: 900, maxW, lh: 1.08, balance: true });
      draw(ctx, L, cx, box.y1 - (tall ? 40 : 30), { align: 'center', valign: 'bottom', color: '#fff', hlColor: '#FF6A4D', shadow: { color: 'rgba(0,0,0,0.55)', blur: 24, y: 4 }, wordFx: wordPop(t, S.D + 0.6, 0.12, 0.3), alpha: win(t, S.D, S.E - 0.02, 0.01, 0.3) });
      return;
    }

    // ---- E: end card (21–24) ----
    endCardFG(ctx, env, { t0: S.E + 0.15, cta: T.cta, sub: T.endSub });
  },
};
