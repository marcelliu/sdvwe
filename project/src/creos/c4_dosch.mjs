// Creo 4 — «Думав, що вже пізно»: cinematic story in the car, rain + piano. 72 BPM (beat 0.8333 s).
import { clamp, ease, win } from '../engine/core.mjs';
import { layout, draw, fit, wordReveal } from '../engine/text.mjs';
import { cover, tint, vignette, scrim, grain, bokeh, sweep } from '../engine/fx.mjs';
import { C, avatar, bubble, bubbleLayout, heartPath, withPop, endCardBG, endCardFG } from '../engine/ui.mjs';

const BT = 60 / 72;
const S = { W1: 4 * BT, W2: 5 * BT, W3: 6 * BT, W4: 7 * BT, TURN: 8 * BT, CHAT: 10 * BT, GIRL: 18 * BT, E: 25 * BT, END: 26 };
const MSG1 = 9.0, MSG2 = 12.4, REACT = 13.2;

const serif = (size) => ({ size, weight: 600, fam: 'Literata', italic: true, lh: 1.18, balance: true });
const glowText = { color: 'rgba(0,0,0,0.75)', blur: 28, y: 3 };

function bgCar(ctx, env) {
  const { W, H, t } = env;
  const v = t < S.W3 ? env.vid('vb1') : env.vid('vb2');
  const k = clamp(t / S.GIRL);
  cover(ctx, v, 0, 0, W, H, { zoom: 1.12 - 0.06 * k, fx: 0.45, fy: env.geom.tall ? 0.42 : 0.4 });
  // teal/amber night grade
  tint(ctx, W, H, '#0f3a4a', 'soft-light', 0.35);
  tint(ctx, W, H, '#ffb060', 'soft-light', 0.12 * clamp((t - S.TURN) / 3));
  // passing headlights
  sweep(ctx, W, H, clamp((t - 1.1) / 1.6), '255,214,170', 0.16, 0.5, -0.5);
  sweep(ctx, W, H, clamp((t - 9.6) / 1.8), '255,200,150', 0.12, 0.5, -0.5);
  scrim(ctx, W, 0, H * 0.4, '4,6,10', 0.55, 0);
  scrim(ctx, W, H * 0.5, H, '4,6,10', 0, 0.6);
  vignette(ctx, W, H, 0.55);
}

function bgGirl(ctx, env) {
  const { W, H, t } = env;
  const img = env.img('GIRL_1');
  const k = clamp((t - S.GIRL) / (S.E - S.GIRL));
  const s0 = Math.max(W / img.width, H / img.height);
  // face + shoulders only (visible height ≈ top 62% of the photo)
  const zoom = (H / (img.height * 0.62) / s0) * (1 + 0.05 * k);
  cover(ctx, img, 0, 0, W, H, { zoom, fx: 0.5, fy: 0.31 });
  tint(ctx, W, H, '#0f3a4a', 'soft-light', 0.2);
  bokeh(ctx, W, H, t, { n: 12, alpha: 0.13, rMin: 30, rMax: 100, seed: 31, colors: ['255,200,140', '255,160,90', '180,200,255'], speed: 10 });
  scrim(ctx, W, H * 0.48, H, '6,8,14', 0, 0.8);
  scrim(ctx, W, 0, H * 0.35, '6,8,14', 0.6, 0);
  vignette(ctx, W, H, 0.45);
}

export default {
  id: 'c4',
  slug: '04_dumav_shcho_pizno',
  title: '«Думав, що вже пізно»',
  duration: S.END,
  bpm: 72,
  videos: [
    // speed ramp: the routine is slow, the message moment plays near real time
    { key: 'vb1', src: 'VB', from: 0.0, speed: 2.0 / S.W3, t0: 0, t1: S.W3 + 0.05 },
    { key: 'vb2', src: 'VB', from: 2.0, speed: 6.0 / (S.GIRL - S.W3), t0: S.W3, t1: S.GIRL + 0.5 },
  ],

  audio() {
    return {
      music: [{ track: 'm4_rain_piano', gainDb: -1 }],
      events: [
        { sfx: 'rain_car_loop', t: 0, gainDb: -7, loopUntil: S.END, fadeOutSec: 4.5 },
        { sfx: 'heartbeat', t: S.TURN, gainDb: -2 },
        { sfx: 'heartbeat', t: S.TURN + 0.85, gainDb: -8 },
        { sfx: 'msg_receive', t: MSG1, gainDb: -4 },
        { sfx: 'msg_send', t: MSG2, gainDb: -5 },
        { sfx: 'like_pling', t: REACT, gainDb: -11 },
        { sfx: 'whoosh_long', t: S.GIRL, gainDb: -9, hit: true },
        { sfx: 'shimmer', t: S.GIRL + 0.1, gainDb: -13 },
        { sfx: 'whoosh_short', t: S.E, gainDb: -7, hit: true },
        { sfx: 'final_hit', t: S.E + 0.03, gainDb: -4 },
      ],
    };
  },

  bg(ctx, env) {
    const { W, H, t } = env;
    if (t < S.GIRL) bgCar(ctx, env);
    else if (t < S.E) {
      bgGirl(ctx, env);
      if (t < S.GIRL + 0.7) {
        ctx.save();
        ctx.globalAlpha = 1 - ease.inOutQuad(clamp((t - S.GIRL) / 0.7));
        bgCar(ctx, env);
        ctx.restore();
      }
    } else {
      endCardBG(ctx, env, { t0: S.E, photo: env.img('GIRL_1'), photoKey: 'g1', fy: 0.3, photoAlpha: 0.45 });
      if (t < S.E + 0.5) {
        ctx.save();
        ctx.globalAlpha = 1 - ease.inOutQuad(clamp((t - S.E) / 0.5));
        bgGirl(ctx, env);
        ctx.restore();
      }
    }
    grain(ctx, W, H, t, 0.075);
  },

  fg(ctx, env) {
    const { t, geom, T } = env;
    const { box, cx, maxW, tall } = geom;
    const topY = box.y0 + (tall ? 60 : 20);
    if (t < S.CHAT) {
      // hook line
      const aH = 1 - clamp((t - (S.W1 - 0.35)) / 0.3);
      if (aH > 0) {
        const L = layout(ctx, T.hook, { ...serif(tall ? 86 : 70), maxW: maxW - 10 });
        draw(ctx, L, cx, topY, { align: 'center', color: '#fff', shadow: glowText, alpha: aH, wordFx: wordReveal(t, 0.08, 0.11, 0.45, 16) });
      }
      // routine words on the beat, then the turn
      const aR = win(t, S.W1, S.TURN - 0.05, 0.01, 0.3);
      if (aR > 0) {
        const words = [T.w1, T.w2, T.w3];
        const times = [S.W1, S.W2, S.W3];
        const L = fit(ctx, words.join(' '), { size: tall ? 92 : 78, weight: 600, fam: 'Literata', italic: true, maxW: maxW + 60, maxLines: 1 });
        draw(ctx, L, cx, topY, {
          align: 'center', color: '#fff', shadow: glowText, alpha: aR,
          wordFx: (i) => {
            const p = clamp((t - times[i]) / 0.35);
            return { a: ease.outCubic(p), dy: (1 - ease.outCubic(p)) * 20 };
          },
        });
        const L2 = layout(ctx, T.w4, { ...serif(tall ? 70 : 60), maxW });
        draw(ctx, L2, cx, topY + L.height + (tall ? 24 : 14), { align: 'center', color: 'rgba(255,255,255,0.8)', shadow: glowText, alpha: aR * clamp((t - S.W4) / 0.4) });
      }
      const aT = win(t, S.TURN, S.CHAT - 0.05, 0.4, 0.35);
      if (aT > 0) {
        const L = layout(ctx, T.turn, { ...serif(tall ? 78 : 66), maxW: maxW - 20 });
        draw(ctx, L, cx, topY, { align: 'center', color: '#fff', shadow: glowText, alpha: aT, wordFx: wordReveal(t, S.TURN, 0.1, 0.45, 14) });
      }
    }
    if (t >= S.CHAT - 0.2 && t < S.GIRL + 0.3) {
      const out = 1 - clamp((t - S.GIRL) / 0.3);
      ctx.save();
      ctx.globalAlpha = out;
      const size = tall ? 48 : 44;
      const ar = size * 0.95;
      const y0 = tall ? 980 : 760;
      const B1 = bubbleLayout(ctx, { text: T.msg1, size, maxW: tall ? 700 : 760, time: '22:14' });
      const x0 = box.x0 + 8;
      if (t >= MSG1) {
        const p = clamp((t - MSG1) / 0.4);
        ctx.save();
        ctx.globalAlpha *= clamp(p * 2);
        avatar(ctx, env.img('GIRL_1'), x0 + ar, y0 + B1.h - ar, ar, { fx: 0.5, fy: 0.3, zoom: 3.2, online: true, dotBorderColor: '#11131c' });
        ctx.restore();
        bubble(ctx, { B: B1, x: x0 + ar * 2 + 16, y: y0, side: 'in', theme: 'light', appear: p, text: T.msg1, size, time: '22:14' });
        // heart reaction on her message
        const rp = clamp((t - REACT) / 0.35);
        if (rp > 0) {
          const hx = x0 + ar * 2 + 16 + B1.w - 10, hy = y0 + B1.h - 4;
          withPop(ctx, hx, hy, ease.outBack(rp), 1, () => {
            ctx.beginPath();
            ctx.arc(hx, hy, size * 0.62, 0, Math.PI * 2);
            ctx.fillStyle = '#2B2F3D';
            ctx.fill();
            heartPath(ctx, hx, hy + 2, size * 0.62);
            ctx.fillStyle = C.accent;
            ctx.fill();
          });
        }
      }
      if (t >= MSG2) {
        const B2 = bubbleLayout(ctx, { text: T.msg2, size: size * 1.1, maxW: 600, time: '22:15' });
        bubble(ctx, { B: B2, x: box.x1 - 8, y: y0 + B1.h + size * 0.9, side: 'out', theme: 'dark', appear: clamp((t - MSG2) / 0.4), text: T.msg2, size: size * 1.1, time: '22:15', ticks: t > MSG2 + 0.6 ? 2 : 1 });
      }
      ctx.restore();
    }
    if (t >= S.GIRL && t < S.E) {
      const a = win(t, S.GIRL + 0.5, S.E - 0.02, 0.5, 0.35);
      const L = layout(ctx, T.quote, { ...serif(tall ? 86 : 74), maxW: maxW - 10 });
      // 9:16: above her head (dark awning); 3:4: below the chin
      if (tall) draw(ctx, L, cx, topY - 20, { align: 'center', color: '#fff', shadow: glowText, alpha: a, wordFx: wordReveal(t, S.GIRL + 0.5, 0.1, 0.5, 16) });
      else draw(ctx, L, cx, box.y1 - 36, { align: 'center', valign: 'bottom', color: '#fff', shadow: glowText, alpha: a, wordFx: wordReveal(t, S.GIRL + 0.5, 0.1, 0.5, 16) });
      return;
    }
    if (t >= S.E) endCardFG(ctx, env, { t0: S.E + 0.2, cta: T.cta, sub: T.endSub });
  },
};
