// Creo 5 — «Що він хоче почути?»: TikTok quiz with three message options and a reveal. 100 BPM (beat 0.6 s).
import { clamp, ease, win, shake } from '../engine/core.mjs';
import { F, layout, draw, fit, wordPop } from '../engine/text.mjs';
import { cover, blurred, tint, vignette, scrim, grain, glow } from '../engine/fx.mjs';
import { C, rr, pill, avatar, bubble, bubbleLayout, stamp, confetti, withPop, endCardBG, endCardFG } from '../engine/ui.mjs';
import { flash } from './common.mjs';

const BT = 0.6;
const S = { Q: 4 * BT, OA: 4 * BT, OB: 6 * BT, OC: 8 * BT, CD: 10 * BT, WRONG: 13 * BT, RIGHT: 14 * BT, VC: 15 * BT, PROM: 25 * BT, E: 32 * BT, END: 37 * BT };
const MSG = S.VC + 0.8;

function bgDark(ctx, env) {
  const { W, H, t } = env;
  const b = blurred('P4q', env.img('P4'), 10, { brightness: 0.42, saturate: 0.9, scale: 0.6 });
  cover(ctx, b, 0, 0, W, H, { zoom: 1.25 + 0.03 * Math.sin(t * 0.5), fx: 0.5, fy: 0.45 });
  tint(ctx, W, H, '#1b0f3a', 'multiply', 0.45);
  glow(ctx, W * 0.2, H * 0.15, W * 0.7, '255,210,63', 0.12);
  glow(ctx, W * 0.85, H * 0.8, W * 0.8, '142,75,255', 0.22);
  vignette(ctx, W, H, 0.55);
}

function bgGirl(ctx, env) {
  const { W, H, t } = env;
  const v = t < S.PROM ? env.vid('vc1') : env.vid('vc2');
  cover(ctx, v, 0, 0, W, H, { zoom: 1.1 + 0.05 * clamp((t - S.VC) / 10), fx: 0.5, fy: env.geom.tall ? 0.36 : 0.33 });
  tint(ctx, W, H, '#ff9a6a', 'soft-light', 0.12);
  scrim(ctx, W, 0, H * 0.3, '10,6,20', 0.55, 0);
  scrim(ctx, W, H * 0.5, H, '10,6,20', 0, 0.8);
  vignette(ctx, W, H, 0.45);
}

function cardsGeom(geom) {
  return geom.tall ? { x: 540 - 440, w: 880, y0: 560, h: 196, gap: 30 } : { x: 540 - 450, w: 900, y0: 330, h: 178, gap: 24 };
}

function optionCard(ctx, env, i, o) {
  const { t, geom } = env;
  const g = cardsGeom(geom);
  const y = g.y0 + i * (g.h + g.gap);
  const p = clamp((t - o.t0) / 0.4);
  if (p <= 0) return null;
  const wrong = i < 2 && t >= S.WRONG;
  const right = i === 2 && t >= S.RIGHT;
  const dx = (1 - ease.outBack(p)) * 700;
  const sh = wrong ? shake(t, 10 * Math.max(0, 1 - (t - S.WRONG) / 0.4), 40, i + 2) : { x: 0, y: 0 };
  const sc = right ? 1 + 0.05 * ease.outBack(clamp((t - S.RIGHT) / 0.35)) : 1;
  const cx = g.x + g.w / 2, cy = y + g.h / 2;
  // pre-reveal pulse during the countdown
  const pulse = t >= S.CD && t < S.WRONG ? 1 + 0.015 * Math.sin(((t - S.CD) * Math.PI * 2) / BT) : 1;
  ctx.save();
  ctx.translate(dx + sh.x, sh.y);
  withPop(ctx, cx, cy, sc * pulse, clamp(p * 3) * (wrong ? 0.55 : 1), () => {
    ctx.save();
    if (right) {
      ctx.shadowColor = 'rgba(43,213,118,0.75)';
      ctx.shadowBlur = 50;
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
    }
    rr(ctx, g.x, y, g.w, g.h, 36);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
    if (right) {
      ctx.save();
      rr(ctx, g.x, y, g.w, g.h, 36);
      ctx.lineWidth = 7;
      ctx.strokeStyle = C.green;
      ctx.stroke();
      ctx.restore();
    }
    // letter badge
    const r = g.h * 0.3;
    const bx = g.x + r + 26, by = cy;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = right ? C.green : wrong ? '#C9CBD6' : C.ink;
    ctx.fill();
    ctx.font = F(r * 1.15, 900);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(o.letter, bx, by + r * 0.4);
    // sender line + message (space on the right is reserved for the ✕/✓ stamp)
    const tx = bx + r + 30;
    if (o.avatar) avatar(ctx, o.avatar, tx + 20, y + g.h * 0.3, 20, { fx: 0.5, fy: 0.3, zoom: 3.2 });
    ctx.font = F(geom.tall ? 32 : 30, 700);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6C7084';
    ctx.fillText(o.sender, tx + (o.avatar ? 50 : 0), y + g.h * 0.3 + 11);
    const L = fit(ctx, o.text, { size: geom.tall ? 50 : 46, weight: 800, maxW: g.x + g.w - tx - 130, maxLines: 1 });
    draw(ctx, L, tx, y + g.h * 0.47, { align: 'left', color: C.ink });
  });
  ctx.restore();
  if (wrong) stamp(ctx, 'x', g.x + g.w - 64 + dx + sh.x, cy + sh.y, 42, clamp((t - S.WRONG) / 0.3));
  if (right) stamp(ctx, 'check', g.x + g.w - 64, cy, 46, clamp((t - S.RIGHT) / 0.3));
  return { y, h: g.h };
}

export default {
  id: 'c5',
  slug: '05_shcho_vin_khoche_pochuty',
  title: '«Що він хоче почути?»',
  duration: S.END,
  bpm: 100,
  videos: [
    { key: 'vc1', src: 'VC', from: 0.0, speed: 1.0, t0: S.VC - 0.4, t1: S.PROM + 0.05 },
    { key: 'vc2', src: 'VC', from: 6.0, speed: 2.0 / (S.E - S.PROM), t0: S.PROM, t1: S.E + 0.5 },
  ],

  audio() {
    const ev = [
      { sfx: 'text_hit', t: 0.03, gainDb: -5 },
      { sfx: 'whoosh_short', t: S.OA, gainDb: -11, hit: true },
      { sfx: 'bubble_pop_1', t: S.OA + 0.1, gainDb: -5 },
      { sfx: 'bubble_pop_2', t: S.OB + 0.1, gainDb: -5 },
      { sfx: 'bubble_pop_1', t: S.OC + 0.1, gainDb: -5 },
      { sfx: 'countdown_beep', t: S.CD, gainDb: -5 },
      { sfx: 'countdown_beep', t: S.CD + BT, gainDb: -5 },
      { sfx: 'countdown_beep_high', t: S.CD + 2 * BT, gainDb: -5 },
      { sfx: 'buzzer_wrong', t: S.WRONG, gainDb: -3 },
      { sfx: 'ding_correct', t: S.RIGHT, gainDb: -2 },
      { sfx: 'whoosh_short', t: S.VC, gainDb: -5, hit: true },
      { sfx: 'text_hit', t: S.VC + 0.2, gainDb: -8 },
      { sfx: 'msg_receive', t: MSG, gainDb: -3 },
      { sfx: 'whoosh_short', t: S.PROM, gainDb: -8, hit: true },
      { sfx: 'text_hit', t: S.PROM + 0.35, gainDb: -8 },
      { sfx: 'whoosh_short', t: S.E, gainDb: -5, hit: true },
      { sfx: 'final_hit', t: S.E + 0.03, gainDb: -3 },
    ];
    for (let i = 0; i < 4; i++) ev.push({ sfx: i % 2 ? 'tock' : 'tick', t: i * BT, gainDb: -12 });
    return { music: [{ track: 'm5_quiz_game', gainDb: -1.5 }], events: ev };
  },

  bg(ctx, env) {
    const { W, H, t } = env;
    if (t < S.VC) bgDark(ctx, env);
    else if (t < S.E) {
      bgGirl(ctx, env);
      if (t < S.VC + 0.3) {
        ctx.save();
        ctx.globalAlpha = 1 - ease.inOutQuad(clamp((t - S.VC) / 0.3));
        bgDark(ctx, env);
        ctx.restore();
      }
    } else {
      endCardBG(ctx, env, { t0: S.E, photo: env.img('GIRL_1'), photoKey: 'g1', fy: 0.3, photoAlpha: 0.4 });
      if (t < S.E + 0.4) {
        ctx.save();
        ctx.globalAlpha = 1 - ease.inOutQuad(clamp((t - S.E) / 0.4));
        bgGirl(ctx, env);
        ctx.restore();
      }
    }
    flash(ctx, W, H, t, S.RIGHT, 0.3, 0.25, '120,255,170');
    grain(ctx, W, H, t, 0.05);
  },

  fg(ctx, env) {
    const { t, geom, T, common } = env;
    const { box, cx, maxW, tall } = geom;
    if (t < S.VC + 0.25) {
      const out = 1 - clamp((t - S.VC) / 0.25);
      ctx.save();
      ctx.globalAlpha = out;
      // question: big in the hook, then docks at the top
      const dock = ease.inOutCubic(clamp((t - (S.Q - 0.25)) / 0.4));
      const bigS = tall ? 96 : 82, smallS = tall ? 58 : 50;
      const size = bigS + (smallS - bigS) * dock;
      const L = layout(ctx, T.question, { size, weight: 900, maxW: maxW + 20 * (1 - dock), lh: 1.1, balance: true });
      const yBig = tall ? 520 : 330, ySmall = box.y0 + (tall ? 90 : 70);
      const y = yBig + (ySmall - yBig) * dock;
      pill(ctx, { x: cx, y: y - (tall ? 90 : 76) + 20 * dock, text: `🤔 ${T.tag}`, size: tall ? 34 : 30, weight: 900, ls: 2, bg: C.yellow, color: C.ink, align: 'center' });
      draw(ctx, L, cx, y, { align: 'center', color: '#fff', hlColor: C.ink, hlBox: { fill: C.yellow, padX: 14, padY: 10, r: 14, rot: -0.02 }, shadow: { color: 'rgba(0,0,0,0.5)', blur: 20, y: 3 }, wordFx: wordPop(t, 0.0, 0.07, 0.26) });
      // options
      optionCard(ctx, env, 0, { t0: S.OA, letter: 'А', sender: `💼 ${T.senderA}`, text: T.optA });
      optionCard(ctx, env, 1, { t0: S.OB, letter: 'Б', sender: `🧾 ${T.senderB}`, text: T.optB });
      optionCard(ctx, env, 2, { t0: S.OC, letter: 'В', sender: common.girl, text: T.optC, avatar: env.img('GIRL_1') });
      // countdown
      const g = cardsGeom(geom);
      const cyc = g.y0 + 3 * (g.h + g.gap) + (tall ? 120 : 70);
      if (t >= S.CD && t < S.WRONG + 0.2) {
        const k = Math.min(2, Math.floor((t - S.CD) / BT));
        const local = (t - S.CD - k * BT) / BT;
        const a = t < S.WRONG ? 1 : 1 - clamp((t - S.WRONG) / 0.2);
        const PL = layout(ctx, T.yourPick, { size: tall ? 52 : 46, weight: 800, maxW });
        draw(ctx, PL, cx - (tall ? 70 : 60), cyc - PL.height / 2, { align: 'center', color: '#fff', alpha: a });
        const r = tall ? 62 : 54;
        const rx = cx + PL.width / 2 + (tall ? 10 : 0);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(rx, cyc, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(rx, cyc, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - clamp((t - S.CD) / (3 * BT))));
        ctx.lineWidth = 9;
        ctx.strokeStyle = C.yellow;
        ctx.lineCap = 'round';
        ctx.stroke();
        withPop(ctx, rx, cyc, 1 + 0.25 * (1 - ease.outCubic(clamp(local / 0.4))), 1, () => {
          ctx.font = F(r * 1.15, 900);
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.fillText(String(3 - k), rx, cyc + r * 0.4);
        });
        ctx.restore();
      }
      if (t >= S.RIGHT) confetti(ctx, t, S.RIGHT, g.x + g.w - 70, g.y0 + 2 * (g.h + g.gap) + g.h / 2, { n: 46, seed: 9 });
      ctx.restore();
      if (t < S.VC) return;
    }
    if (t < S.PROM) {
      const a = win(t, S.VC, S.PROM - 0.02, 0.25, 0.25);
      const L = layout(ctx, T.answer, { size: tall ? 76 : 66, weight: 900, maxW, lh: 1.1, balance: true });
      draw(ctx, L, cx, box.y0 + (tall ? 40 : 20), { align: 'center', color: '#fff', hlColor: '#fff', hlBox: { fill: C.green, padX: 16, padY: 10, r: 14 }, alpha: a, shadow: { color: 'rgba(0,0,0,0.5)', blur: 20, y: 3 }, wordFx: wordPop(t, S.VC + 0.15, 0.09, 0.28) });
      if (t >= MSG) {
        const size = tall ? 52 : 46;
        const Bl = bubbleLayout(ctx, { text: T.optC, size, maxW: 720 });
        const ar = size;
        const total = ar * 2 + 16 + Bl.w;
        const x0 = cx - total / 2;
        const y = box.y1 - Bl.h - (tall ? 60 : 40);
        const p = clamp((t - MSG) / 0.4);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.save();
        ctx.globalAlpha *= clamp(p * 2);
        avatar(ctx, env.img('GIRL_1'), x0 + ar, y + Bl.h - ar, ar, { fx: 0.5, fy: 0.3, zoom: 3.2, online: true, dotBorderColor: '#2a1a24' });
        ctx.restore();
        bubble(ctx, { B: Bl, x: x0 + ar * 2 + 16, y, side: 'in', theme: 'light', appear: p, text: T.optC, size });
        ctx.restore();
      }
      return;
    }
    if (t < S.E) {
      const a = win(t, S.PROM + 0.2, S.E - 0.02, 0.3, 0.3);
      const L = layout(ctx, T.promise, { size: tall ? 80 : 68, weight: 900, maxW, lh: 1.1, balance: true });
      draw(ctx, L, cx, box.y1 - (tall ? 40 : 30), { align: 'center', valign: 'bottom', color: '#fff', hlColor: '#FF6A4D', shadow: { color: 'rgba(0,0,0,0.55)', blur: 24, y: 4 }, alpha: a, wordFx: wordPop(t, S.PROM + 0.3, 0.1, 0.3) });
      return;
    }
    endCardFG(ctx, env, { t0: S.E + 0.12, cta: T.cta, sub: T.endSub });
  },
};
