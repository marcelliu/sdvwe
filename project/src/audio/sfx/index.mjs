// SFX registry. hit: 'onset' (first point >= 50% of peak), 'peak' (max of 10 ms RMS), or seconds.
import * as ui from './ui.mjs';
import * as cine from './cine.mjs';
import * as amb from './amb.mjs';

export const SFX = [
  { name: 'notify_chime', fn: ui.notifyChime, maxLen: 0.65, desc: 'soft 2-note FM bell notification (A5 -> E6)' },
  { name: 'vibrate_table', fn: cine.vibrateTable, maxLen: 1.0, desc: 'phone vibrating on wood: 2 x 0.35 s buzz, 0.15 s gap' },
  { name: 'sub_boom', fn: cine.subBoom, maxLen: 1.6, desc: 'cinematic sub drop 60 -> 35 Hz, soft transient' },
  { name: 'bubble_pop_1', fn: ui.bubblePop1, maxLen: 0.15, desc: 'chat bubble pop (lower)' },
  { name: 'bubble_pop_2', fn: ui.bubblePop2, maxLen: 0.15, desc: 'chat bubble pop (higher)' },
  { name: 'msg_send', fn: ui.msgSend, maxLen: 0.36, hit: 'peak', desc: 'outgoing message swish' },
  { name: 'msg_receive', fn: ui.msgReceive, maxLen: 0.42, desc: 'incoming soft blip/ding' },
  { name: 'key_tap_1', fn: ui.keyTap1, maxLen: 0.05, desc: 'touch keyboard tap A' },
  { name: 'key_tap_2', fn: ui.keyTap2, maxLen: 0.05, desc: 'touch keyboard tap B' },
  { name: 'key_tap_3', fn: ui.keyTap3, maxLen: 0.05, desc: 'touch keyboard tap C' },
  { name: 'typing_loop', fn: ui.typingLoop, loop: true, desc: 'soft touchscreen typing, 3.0 s seamless loop' },
  { name: 'swipe', fn: ui.swipe, maxLen: 0.32, hit: 'peak', desc: 'card swipe whoosh L -> R' },
  { name: 'tap', fn: ui.uiTap, maxLen: 0.08, desc: 'UI tap/click' },
  { name: 'like_pling', fn: ui.likePling, maxLen: 0.55, desc: 'like/heart sparkle arpeggio' },
  { name: 'whoosh_short', fn: cine.whooshShort, maxLen: 0.5, hit: 'peak', desc: 'short whoosh, hitOffset = loudest point' },
  { name: 'whoosh_long', fn: cine.whooshLong, maxLen: 1.0, hit: 'peak', desc: 'long whoosh, hitOffset = loudest point' },
  { name: 'riser_2s', fn: cine.riser2s, maxLen: 2.0, hit: 2.0, fadeOut: 0.003, desc: 'noise + tone riser peaking at 2.0 s' },
  { name: 'impact', fn: cine.impact, maxLen: 1.25, desc: 'punchy hit: kick + noise + low boom' },
  { name: 'text_hit', fn: cine.textHit, maxLen: 0.12, desc: 'short punchy thump/click for kinetic text' },
  { name: 'tick', fn: ui.tick, maxLen: 0.05, desc: 'clock tick (high)' },
  { name: 'tock', fn: ui.tock, maxLen: 0.06, desc: 'clock tock (low)' },
  { name: 'countdown_beep', fn: ui.countdownBeep, maxLen: 0.15, desc: 'game beep 880 Hz' },
  { name: 'countdown_beep_high', fn: ui.countdownBeepHigh, maxLen: 0.15, desc: 'game beep 1760 Hz' },
  { name: 'buzzer_wrong', fn: ui.buzzerWrong, maxLen: 0.55, desc: 'playful descending wrong-answer bwomp' },
  { name: 'ding_correct', fn: ui.dingCorrect, maxLen: 0.95, desc: 'bright correct-answer bell (D6 -> G6) + sparkle' },
  { name: 'heartbeat', fn: cine.heartbeat, maxLen: 0.8, desc: 'lub-dub double thump' },
  { name: 'shimmer', fn: cine.shimmer, maxLen: 1.25, hit: 'peak', desc: 'magical sparkle swell' },
  { name: 'final_hit', fn: cine.finalHit, maxLen: 2.05, desc: 'end-card soft impact + open bell chord' },
  { name: 'tv_noise_loop', fn: amb.tvNoiseLoop, loop: true, amb: true, desc: 'muffled TV in another room, 12 s loop (no speech-like content)' },
  { name: 'rain_car_loop', fn: amb.rainCarLoop, loop: true, amb: true, desc: 'rain on car roof/windshield at night, 30 s loop' },
  { name: 'room_tone_night', fn: amb.roomToneNight, loop: true, amb: true, desc: 'quiet night apartment ambience, 30 s loop' },
];
