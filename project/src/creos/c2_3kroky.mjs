// Creo 2 — «3 кроки»: bright UI demo in brand colours. 120 BPM (beat 0.5 s): every cut on a beat.
import { clamp, ease, win } from '../engine/core.mjs';
import { F, layout, draw, fit, wordPop } from '../engine/text.mjs';
import { cover, tint, vignette, scrim, grain, glow, brandGradient } from '../engine/fx.mjs';
import { C, rr, grad, bubble, bubbleLayout, typingBubble, chatHeader, inputBar, keyboard, phone, statusBar, pill, withPop, heartPath, crossPath, hearts, endCardBG, endCardFG } from '../engine/ui.mjs';
import { typed, keySfx } from './common.mjs';

const S = { B: 3, C: 7.5, D: 12, E: 16.5, F: 19, END: 22 };
const SWIPE = 4.0, TAP = 5.5, TO_CHAT = 6.7;
const TYPE0 = 8.2, TYPE1 = 9.5, SEND = 10.0;
const TYPING0 = 12.4, REPLY = 13.65;

function phoneRect(geom) {
  if (geom.tall) return { x: 540 - 320, y: 335, w: 640, h: 1185 };
  return { x: 540 - 300, y: 214, w: 600, h: 1160 };
}

// ---------- phone screens ----------
function profileCard(ctx, s, img, o) {
  const cw = s.w * 0.9, ch = s.h * 0.6;
  const x = s.x + (s.w - cw) / 2, y = s.y + s.h * 0.15;
  ctx.save();
  ctx.translate(x + cw / 2 + (o.dx ?? 0), y + ch / 2 + (o.dy ?? 0));
  ctx.rotate(o.rot ?? 0);
  ctx.scale(o.scale ?? 1, o.scale ?? 1);
  ctx.translate(-(x + cw / 2), -(y + ch / 2));
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.shadowColor = 'rgba(18,20,42,0.25)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  rr(ctx, x, y, cw, ch, s.w * 0.06);
  ctx.fillStyle = '#ddd';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save();
  rr(ctx, x, y, cw, ch, s.w * 0.06);
  ctx.clip();
  cover(ctx, img, x, y, cw, ch, { fx: o.fx, fy: o.fy, zoom: o.zoom ?? 1 });
  const g = ctx.createLinearGradient(0, y + ch * 0.5, 0, y + ch);
  g.addColorStop(0, 'rgba(10,8,20,0)');
  g.addColorStop(1, 'rgba(10,8,20,0.82)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, cw, ch);
  ctx.restore();
  const fs = s.w * 0.09;
  ctx.font = F(fs, 800);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText(o.name, x + s.w * 0.06, y + ch - s.w * 0.17);
  const nw = ctx.measureText(o.name).width;
  ctx.beginPath();
  ctx.arc(x + s.w * 0.06 + nw + fs * 0.42, y + ch - s.w * 0.17 - fs * 0.32, fs * 0.17, 0, Math.PI * 2);
  ctx.fillStyle = C.green;
  ctx.fill();
  let tx = x + s.w * 0.06;
  for (const tag of o.tags ?? []) {
    const r = pill(ctx, { x: tx, y: y + ch - s.w * 0.13, text: tag, size: s.w * 0.036, weight: 600, bg: 'rgba(255,255,255,0.22)', h: s.w * 0.075, padX: s.w * 0.025 });
    tx += r.w + s.w * 0.018;
  }
  ctx.restore();
  return { x, y, w: cw, h: ch };
}

function appTop(ctx, s, env) {
  statusBar(ctx, s, '21:15', false);
  const y = s.y + s.w * 0.15;
  ctx.save();
  rr(ctx, s.x + s.w * 0.06, y, s.w * 0.085, s.w * 0.085, s.w * 0.02);
  ctx.clip();
  ctx.drawImage(env.img('app_icon'), s.x + s.w * 0.06, y, s.w * 0.085, s.w * 0.085);
  ctx.restore();
  ctx.font = F(s.w * 0.052, 800);
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'left';
  ctx.fillText(env.common.app, s.x + s.w * 0.17, y + s.w * 0.063);
  pill(ctx, { x: s.x + s.w * 0.94, y: y + s.w * 0.004, text: env.common.online, size: s.w * 0.034, weight: 700, bg: '#E9FBF1', color: '#169A55', dot: true, align: 'right', h: s.w * 0.075, padX: s.w * 0.025 });
}

function screenProfiles(ctx, s, env) {
  const { t, T, common } = env;
  ctx.fillStyle = C.light;
  ctx.fillRect(s.x, s.y, s.w, s.h);
  appTop(ctx, s, env);
  const sw = ease.inCubic(clamp((t - SWIPE) / 0.45));
  const front = ease.outBack(clamp((t - SWIPE - 0.25) / 0.4));
  // back card (Ніка) comes forward after the swipe
  const card = profileCard(ctx, s, env.img('GIRL_1'), { name: common.girl, tags: T.tags1, fx: 0.49, fy: 0.36, zoom: 1.12, scale: 0.94 + 0.06 * front, dy: 26 * (1 - front) });
  if (sw < 1) profileCard(ctx, s, env.img('GIRL_1_2'), { name: common.girl2, tags: T.tags2, fx: 0.47, fy: 0.3, zoom: 1.1, dx: -sw * s.w * 1.3, rot: -sw * 0.35, alpha: 1 - sw * 0.6 });
  // buttons
  const by = card.y + card.h + s.w * 0.07;
  const r = s.w * 0.075;
  ctx.save();
  ctx.shadowColor = 'rgba(18,20,42,0.18)';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(s.x + s.w * 0.2, by + r, r, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
  crossPath(ctx, s.x + s.w * 0.2, by + r, r * 0.9, '#9A9DAF', r * 0.16);
  const press = t >= TAP - 0.08 && t < TAP + 0.25 ? 1 - 0.1 * Math.sin(clamp((t - TAP + 0.08) / 0.33) * Math.PI) : 1;
  const bw = s.w * 0.56, bh = r * 2;
  const bx = s.x + s.w * 0.36;
  withPop(ctx, bx + bw / 2, by + r, press, 1, () => {
    ctx.save();
    ctx.shadowColor = 'rgba(255,75,43,0.45)';
    ctx.shadowBlur = 24;
    rr(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = grad(ctx, bx, by, bw, bh);
    ctx.fill();
    ctx.restore();
    ctx.font = F(s.w * 0.05, 800);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(`💬 ${T.write}`, bx + bw / 2, by + r + s.w * 0.018);
  });
  hearts(ctx, t, TAP + 0.05, bx + bw / 2, by, { n: 9, size: s.w * 0.08, dist: s.w * 0.7, seed: 4 });
  return { swipeFrom: { x: card.x + card.w * 0.6, y: card.y + card.h * 0.45 }, tapAt: { x: bx + bw / 2, y: by + r } };
}

function screenChat(ctx, s, env, mode) {
  const { t, T, common } = env;
  ctx.fillStyle = C.light;
  ctx.fillRect(s.x, s.y, s.w, s.h);
  statusBar(ctx, s, '21:16', false);
  const hh = s.w * 0.22;
  const hy = s.y + s.w * 0.12;
  const typingNow = t >= TYPING0 && t < REPLY;
  chatHeader(ctx, { x: s.x, y: hy, w: s.w, h: hh, theme: 'light', img: env.img('GIRL_1'), fx: 0.5, fy: 0.3, zoom: 3.2, name: common.girl, status: typingNow ? common.typing : common.online, statusColor: typingNow ? C.accent : '#169A55', online: true, size: s.w * 0.05 });
  const size = s.w * 0.072;
  const pad = s.w * 0.05;
  const kbH = s.h * 0.33;
  const kbIn = mode === 'type' ? 1 - ease.inCubic(clamp((t - S.D) / 0.3)) : 0;
  const kbY = s.y + s.h - kbH * kbIn;
  const inH = s.w * 0.13;
  const inY = kbY - inH - s.w * 0.04;
  let y = hy + hh + s.w * 0.06;
  pill(ctx, { x: s.x + s.w / 2, y, text: `${common.girl} ${common.online}`, size: s.w * 0.032, weight: 600, bg: 'rgba(18,20,42,0.06)', color: '#6C7084', align: 'center', h: s.w * 0.07, dot: true });
  y += s.w * 0.12;
  if (t >= SEND) {
    const B = bubbleLayout(ctx, { text: T.typed, size, maxW: s.w * 0.78, time: '21:16' });
    bubble(ctx, { B, x: s.x + s.w - pad, y, side: 'out', theme: 'light', appear: clamp((t - SEND) / 0.35), time: '21:16', ticks: t >= SEND + 0.8 ? 2 : 1, text: T.typed, size, shadow: false });
    y += B.h + size * 0.5;
  }
  if (typingNow) typingBubble(ctx, { x: s.x + pad, y, t, theme: 'light', appear: clamp((t - TYPING0) / 0.3), size, bg: '#fff' });
  if (t >= REPLY) {
    const B = bubbleLayout(ctx, { text: T.reply, size, maxW: s.w * 0.8, time: '21:16' });
    bubble(ctx, { B, x: s.x + pad, y, side: 'in', theme: 'light', appear: clamp((t - REPLY) / 0.38), time: '21:16', text: T.reply, size, shadow: true });
    hearts(ctx, t, REPLY + 0.45, s.x + pad + B.w * 0.8, y + B.h * 0.2, { n: 7, size: s.w * 0.07, dist: s.w * 0.55, seed: 8 });
  }
  const txt = typed(T.typed, t, TYPE0, TYPE1);
  inputBar(ctx, { x: s.x + pad * 0.6, y: inY, w: s.w - pad * 1.2, h: inH, theme: 'light', size: s.w * 0.05, text: t >= SEND ? '' : txt, caret: t < SEND && Math.floor(t * 2.2) % 2 === 0, placeholder: common.placeholder, press: clamp((t - SEND + 0.12) / 0.24) });
  if (kbIn > 0) {
    const ch = Array.from(T.typed);
    const idx = Math.floor(clamp((t - TYPE0) / (TYPE1 - TYPE0)) * ch.length - 0.0001);
    const pressed = t >= TYPE0 && t < TYPE1 + 0.05 ? (ch[idx] ?? '').toLowerCase() : null;
    keyboard(ctx, { x: s.x, y: kbY, w: s.w, h: kbH, theme: 'light', pressed });
  }
  return { sendAt: { x: s.x + s.w - pad * 0.6 - inH / 2, y: inY + inH / 2 } };
}

/** Finger / touch indicator. */
function touch(ctx, x, y, a, press) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.beginPath();
  ctx.arc(x, y, 44 - press * 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.stroke();
  if (press > 0) {
    ctx.beginPath();
    ctx.arc(x, y, 44 + press * 50, 0, Math.PI * 2);
    ctx.globalAlpha *= 1 - press;
    ctx.stroke();
  }
  ctx.restore();
}

function stepHeader(ctx, env, n, str, t0) {
  const { t, geom } = env;
  const { box, cx, maxW, tall } = geom;
  const p = clamp((t - t0) / 0.35);
  if (p <= 0) return;
  const size = tall ? 68 : 58;
  const L = fit(ctx, str, { size, weight: 900, maxW: maxW + 40 - size * 1.9, maxLines: 1 });
  const r = size * 0.78;
  const total = r * 2 + size * 0.4 + L.width;
  const x0 = cx - total / 2;
  const y = box.y0 + (tall ? 28 : 8);
  const s = 0.6 + 0.4 * ease.outBack(p);
  withPop(ctx, cx, y + r, s, clamp(p * 3), () => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(x0 + r, y + r, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
    ctx.font = F(size * 1.05, 900);
    ctx.textAlign = 'center';
    ctx.fillStyle = C.accent;
    ctx.fillText(String(n), x0 + r, y + r + size * 0.38);
    draw(ctx, L, x0 + r * 2 + size * 0.4, y + r - L.height / 2, { align: 'left', color: '#fff', shadow: { color: 'rgba(80,0,40,0.35)', blur: 18, y: 3 } });
  });
}

function plate(ctx, env, str, i, t0) {
  const { t, geom } = env;
  const { cx, maxW, tall } = geom;
  const p = clamp((t - t0) / 0.32);
  if (p <= 0) return;
  const size = i === 2 ? (tall ? 132 : 112) : tall ? 66 : 58;
  const L = layout(ctx, str, { size, weight: 900, maxW: maxW - 40, lh: 1.12 });
  const ys = tall ? [420, 660, 1000] : [230, 450, 760];
  const rots = [-0.05, 0.035, -0.02];
  const s = 1.35 - 0.35 * ease.outBack(p);
  const padX = 40, padY = 26;
  const w = L.width + padX * 2, h = L.height + padY * 2;
  const y = ys[i];
  ctx.save();
  ctx.globalAlpha = clamp(p * 3);
  ctx.translate(cx, y + h / 2);
  ctx.rotate(rots[i]);
  ctx.scale(s, s);
  ctx.translate(-cx, -(y + h / 2));
  ctx.shadowColor = 'rgba(60,0,30,0.35)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  rr(ctx, cx - w / 2, y, w, h, 28);
  ctx.fillStyle = i === 2 ? C.ink : '#fff';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  draw(ctx, L, cx, y + padY, { align: 'center', color: i === 2 ? '#fff' : C.ink });
  ctx.restore();
}

function bgBrand(ctx, env) {
  const { W, H, t } = env;
  brandGradient(ctx, W, H, t, { stops: ['#FF5A36', '#FF3D7F', '#9B4DFF'], angle: 1.1 });
  glow(ctx, W * (0.2 + 0.1 * Math.sin(t * 0.7)), H * 0.25, W * 0.7, '255,210,120', 0.25);
  glow(ctx, W * 0.85, H * (0.7 + 0.05 * Math.cos(t * 0.6)), W * 0.8, '90,40,255', 0.28);
  // floating soft hearts
  for (let i = 0; i < 12; i++) {
    const sp = 40 + ((i * 37) % 60);
    const x = ((i * 233) % W) + Math.sin(t * 0.8 + i) * 24;
    const y = H + 120 - ((t * sp + i * 311) % (H + 240));
    ctx.save();
    ctx.globalAlpha = 0.1 + ((i * 7) % 5) * 0.025;
    heartPath(ctx, x, y, 50 + ((i * 13) % 40));
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
  }
}

function bgHook(ctx, env) {
  const { W, H, t } = env;
  cover(ctx, env.vid('vc'), 0, 0, W, H, { zoom: 1.08 + 0.05 * clamp(t / 3), fx: 0.5, fy: env.geom.tall ? 0.36 : 0.33 });
  tint(ctx, W, H, '#ff9a6a', 'soft-light', 0.15);
  scrim(ctx, W, H * 0.45, H, '30,6,30', 0, 0.82);
  vignette(ctx, W, H, 0.4);
}

export default {
  id: 'c2',
  slug: '02_3_kroky',
  title: '«3 кроки»',
  duration: S.END,
  bpm: 120,
  videos: [{ key: 'vc', src: 'VC', from: 5.0, speed: 1.0, t0: 0, t1: S.B + 0.5 }],

  audio(T) {
    return {
      music: [{ track: 'm2_bright_pop', gainDb: -1 }],
      events: [
        { sfx: 'impact', t: 0.0, gainDb: -4 },
        { sfx: 'text_hit', t: 0.05, gainDb: -6 },
        { sfx: 'whoosh_short', t: S.B, gainDb: -4, hit: true },
        { sfx: 'text_hit', t: S.B + 0.15, gainDb: -8 },
        { sfx: 'swipe', t: SWIPE + 0.1, gainDb: -4 },
        { sfx: 'tap', t: TAP, gainDb: -4 },
        { sfx: 'like_pling', t: TAP + 0.05, gainDb: -6 },
        { sfx: 'whoosh_short', t: TO_CHAT + 0.2, gainDb: -10, hit: true },
        { sfx: 'text_hit', t: S.C + 0.1, gainDb: -8 },
        ...keySfx(T.typed, TYPE0, TYPE1, -10),
        { sfx: 'tap', t: SEND - 0.05, gainDb: -6 },
        { sfx: 'msg_send', t: SEND, gainDb: -3 },
        { sfx: 'text_hit', t: S.D + 0.1, gainDb: -8 },
        { sfx: 'msg_receive', t: REPLY, gainDb: -2 },
        { sfx: 'like_pling', t: REPLY + 0.45, gainDb: -9 },
        { sfx: 'text_hit', t: S.E, gainDb: -4 },
        { sfx: 'text_hit', t: S.E + 1, gainDb: -4 },
        { sfx: 'impact', t: S.E + 2, gainDb: -6 },
        { sfx: 'whoosh_short', t: S.F, gainDb: -6, hit: true },
        { sfx: 'final_hit', t: S.F + 0.05, gainDb: -4 },
      ],
    };
  },

  bg(ctx, env) {
    const { W, H, t } = env;
    if (t < S.B) bgHook(ctx, env);
    else if (t < S.F) {
      bgBrand(ctx, env);
      if (t < S.B + 0.3) {
        // hook slides up and away
        const p = ease.inOutCubic(clamp((t - S.B) / 0.3));
        ctx.save();
        ctx.translate(0, -p * H);
        bgHook(ctx, env);
        ctx.restore();
      }
      if (t >= S.E) {
        const k = Math.max(0, 1 - ((t - S.E) % 1) / 0.25);
        if (k > 0) {
          ctx.save();
          ctx.globalAlpha = 0.18 * k;
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
        }
      }
    } else {
      endCardBG(ctx, env, { t0: S.F, photo: env.img('GIRL_1'), photoKey: 'g1', fy: 0.3, photoAlpha: 0.35 });
      if (t < S.F + 0.35) {
        ctx.save();
        ctx.globalAlpha = 1 - ease.inOutQuad(clamp((t - S.F) / 0.35));
        bgBrand(ctx, env);
        ctx.restore();
      }
    }
    grain(ctx, W, H, t, 0.045);
  },

  fg(ctx, env) {
    const { H, t, geom, T } = env;
    const { box, cx, maxW, tall } = geom;
    if (t < S.B + 0.3) {
      const p = ease.inOutCubic(clamp((t - S.B) / 0.3));
      ctx.save();
      ctx.translate(0, -p * H);
      const L = layout(ctx, T.hook, { size: tall ? 96 : 84, weight: 900, maxW, lh: 1.1, balance: true });
      draw(ctx, L, cx, box.y1 - (tall ? 40 : 30), {
        align: 'center', valign: 'bottom', color: '#fff', hlColor: '#fff', hlBox: { fill: C.accent, padX: 14, padY: 12, r: 16, rot: -0.03 },
        shadow: { color: 'rgba(0,0,0,0.5)', blur: 24, y: 4 }, wordFx: wordPop(t, 0.0, 0.09, 0.28),
      });
      ctx.restore();
      if (t < S.B) return;
    }
    if (t < S.F) {
      // phone mockup slides in, screens switch inside
      const pr = phoneRect(geom);
      const pin = ease.outBack(clamp((t - S.B) / 0.45));
      const away = ease.inCubic(clamp((t - S.E) / 0.35));
      const yOff = (1 - pin) * (H - pr.y) + away * (H - pr.y + 200);
      if (away < 1) {
        let info = {};
        ctx.save();
        ctx.translate(0, yOff);
        phone(ctx, pr, (c, s) => {
          if (t < TO_CHAT) info = screenProfiles(c, s, env);
          else {
            const sl = ease.inOutCubic(clamp((t - TO_CHAT) / 0.35));
            if (sl < 1) {
              c.save();
              c.translate(-sl * s.w, 0);
              screenProfiles(c, s, env);
              c.restore();
            }
            c.save();
            c.translate((1 - sl) * s.w, 0);
            info = screenChat(c, s, env, t < S.D ? 'type' : 'chat');
            c.restore();
          }
        });
        // touch indicators
        if (t < TO_CHAT && info.swipeFrom) {
          const a1 = win(t, SWIPE - 0.35, SWIPE + 0.45, 0.15, 0.15);
          const dx = -ease.inCubic(clamp((t - SWIPE) / 0.45)) * 360;
          touch(ctx, info.swipeFrom.x + dx, info.swipeFrom.y, a1, 0);
          const a2 = win(t, TAP - 0.4, TAP + 0.4, 0.15, 0.2);
          touch(ctx, info.tapAt.x + 40, info.tapAt.y + 20, a2, clamp((t - TAP) / 0.4));
        }
        if (t >= S.C && t < S.D && info.sendAt) {
          const a = win(t, SEND - 0.45, SEND + 0.35, 0.15, 0.2);
          touch(ctx, info.sendAt.x + 20, info.sendAt.y + 16, a, clamp((t - SEND) / 0.4));
        }
        ctx.restore();
      }
      if (t < S.E) {
        if (t < S.C) stepHeader(ctx, env, 1, T.step1, S.B + 0.1);
        else if (t < S.D) stepHeader(ctx, env, 2, T.step2, S.C);
        else stepHeader(ctx, env, 3, T.step3, S.D);
      } else {
        plate(ctx, env, `🟢 ${T.plate1}`, 0, S.E);
        plate(ctx, env, T.plate2, 1, S.E + 1);
        plate(ctx, env, T.plate3, 2, S.E + 2);
      }
      return;
    }
    endCardFG(ctx, env, { t0: S.F + 0.12, cta: T.cta, sub: T.endSub });
  },
};
