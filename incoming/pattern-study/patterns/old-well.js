// ===== Patternflow pattern =====
// Title:   Old Well
// Family:  halloween
// Idea:    A cut-away old stone well under a moonlit sky lowers its wooden bucket down the whole height of the shaft, and when the bucket touches the black water the water glows sickly green, two pale eyes open beneath and a pale hand reaches up and yanks the bucket under, the rope whipping and the windlass spinning, until the water calms and the bucket is wound back up brimming and dripping, sometimes with the hand still on its rim.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 50
// Round:   50
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Moon=0..1, Fog=0..1
//
// Knob 1: Hue. The colour of the glow in the water, of the light it throws up the shaft and of what comes up in the bucket: sickly green at 0, cyan at 0.25, violet at 0.5, orange at 0.75. The sky, the stones and the moonlight stay as they are.
// Knob 2: Speed. At 2 the bucket goes down at 18 LEDs a second and comes up at 20, and one round takes about 14 s: down 3.6 s, the water and the hand 4.2 s, a 0.6 s calm, up 4.8 s and 0.9 s hanging at the top. At 0.2 everything is ten times slower, at 3 half as fast again. The first round starts with the bucket already low, so it touches the water 0.7 s in.
// Knob 3: Moon. Where the moon stands. At 0 it is high on the left and its light falls into the shaft slanting right, thinning as it goes down until it reaches the water on the right; at 0.25 it falls almost straight; at 0.5 the moon peeks over the ridge of the roof and the light leans left; at 1 it hangs low on the right and lights only the upper half of the left wall.
// Knob 4: Fog. A mist over the water, added as light, moonlit and tinted by the glow. At 0 none; at 0.06 a thin layer over the water; at 0.5 it fills the bottom third of the shaft; at 1 it rises 70 rows, to just below the ground.
// Buttons: K1 tap lets go of the crank while the bucket is going down or hanging at the top: it falls to the water at once.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vn = (x, sd) => {
  const i = floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return (hash(i * 7919 + sd) * (1 - u) + hash((i + 1) * 7919 + sd) * u) * 2 - 1;
};
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return out;
}

// The shaft's inside runs from column SX0 to SX1; its stone walls, seen cut
// through, are the eight columns either side, and earth lies beyond them.
const SX0 = 13, SX1 = 50;
// The parapet's top, the ground and the water.
const PY = 32, GY = 40, WS = 104;
// The little roof: its ridge and its eaves.
const AY = 5, EY = 15;
// The windlass wheel, seen end on, and the column the rope hangs down.
const CX = 26, CY = 22, RX = 31;
// The bucket's rim at the top and floating on the water.
const TOPB = 33, BOTB = 97;
// Seconds into the event at Speed 2: the glow is up, the hand has risen, it
// has a grip, the yank, the glow starts to fade, and it is all over.
const E_GLOW = 0.35, E_HAND0 = 0.5, E_HAND1 = 1.0, E_GRIP = 1.15, E_YANK = 1.3, E_FADE = 2.6, E_END = 4.2;
// Kinds of LED in the still picture.
const SKY = 0, ROOF = 1, GABLE = 2, WOOD = 3, BACK = 4, SECT = 5, SOIL = 6, GRASS = 7, WATER = 8;
const MOONC = [175, 185, 225], TINT = [0.95, 0.9, 1.12];
// The glow's light, falling off up the shaft from the water.
const UP = new Float32Array(128);
for (let i = 0; i < 128; i++) UP[i] = exp(-i / 16);

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, moon: -1, fog: 0.06, s: 0.3,
    ph: "lower", e: 0, by: 84, v: 0, cyc: 0, cling: false,
    th: 0, ex: 0, sv: 0, wa: 0, wp: 0,
    hand: { on: false, x: 22, y: 140, c: 0, v: 0, fall: false },
    eo: 0, g: 0, cg: 0,
    bits: [], bubbles: [], ripples: [], dripT: 0, bubT: 0,
    kind: new Uint8Array(N), alb: new Float32Array(N), bg: new Float32Array(N * 3), buf: new Float32Array(N * 3),
    gc: [0, 0, 0], off: new Float32Array(W),
  };
  geometry(params.s);
}

// The still shapes: roof, posts, walls, earth and water, and how much light
// each stone gives back.
function geometry(S) {
  const { kind, alb } = S;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, ry = AY + ((EY - AY) * abs(x + 0.5 - 32)) / 26;
      let k = SKY, a = 0;
      if (x >= 6 && x <= 57 && y >= ry && y < ry + 3) (k = ROOF), (a = y < ry + 1 ? 1 : (x + (floor(y - ry) & 1) * 2) % 4 === 0 ? 0.45 : 0.7);
      else if (x >= 9 && x <= 54 && y >= ry + 3 && y <= EY) (k = GABLE), (a = x % 4 === 0 ? 0.4 : 1);
      else if ((x >= 7 && x <= 56 && (y === EY + 1 || y === EY + 2)) || ((x === 9 || x === 10 || x === 53 || x === 54) && y > EY && y < PY - 1) || (x > 10 && x < 53 && (y === 21 || y === 22)))
        (k = WOOD), (a = x === 9 || x === 53 || y === EY + 1 || y === 21 ? 1.3 : 1);
      else if ((y === PY - 1 && ((x >= 4 && x <= 13) || (x >= 50 && x <= 59))) || (y >= PY && ((x >= 5 && x < SX0) || (x > SX1 && x <= 58)))) {
        // Cut stone: the same courses as the wall behind, one joint per course.
        k = SECT;
        const c = floor((y - PY + 6) / 6), r = (y - PY + 6) % 6, side = x < 32 ? 0 : 1, j = (x - (side ? 51 : 5) + (c % 2) * 4) % 8;
        a = y === PY - 1 ? 1.5 : r === 5 || j === 7 ? 0.3 : 0.78 + 0.22 * floor(hash(c * 31 + side * 7 + (j > 3 ? 1 : 0)) * 3) / 2;
      } else if (y >= PY && x >= SX0 && x <= SX1) {
        if (y >= WS) k = WATER;
        else {
          // The back wall, in courses six rows high with staggered joints.
          k = BACK;
          const c = floor((y - PY) / 6), r = (y - PY) % 6, w = 7 + (c % 3), xx = x - SX0 + (c % 2) * 4 + floor(hash(c * 7 + 1) * 3), si = floor(xx / w);
          a = r === 5 || xx % w === w - 1 ? 0.3 : 0.5 + 0.14 * floor(hash(c * 131 + si * 17) * 4) + (r === 0 ? 0.1 : 0) - (hash(p) < 0.12 ? 0.12 : 0);
        }
      } else if (y > GY) (k = SOIL), (a = hash(p * 3 + 1) < 0.05 ? 1.6 : 1);
      else if (y >= GY - 2 && (y === GY || hash(x * 5 + y) < 0.45 + (y - GY) * 0.2)) (k = GRASS), (a = 1);
      kind[p] = k;
      alb[p] = a;
    }
}

// The beam of moonlight in the shaft at (x, y): 0 in the shadow of the lip,
// 1 inside, with a soft edge.
function beam(s, x, y) {
  const d = y - PY, L = SX0 + max(0, s) * d, R = SX1 + 1 + min(0, s) * d;
  return cl(min(x + 0.5 - L, R - x - 0.5) / 1.5 + 0.5, 0, 1);
}

// The still picture for one place of the moon: sky, moon, roof, the lit and
// shaded stones, the dust in the moonbeam and the dark water.
function build(S) {
  const u = S.moon, bg = S.bg, kind = S.kind, alb = S.alb;
  const mx = 9 + 46 * u, my = 8 + 14 * u * u - 6 * sin(PI * u), s = (S.s = 0.3 - 1.2 * u);
  for (let y = 0; y < H; y++) {
    const f = floor(min(1, y / 40) * 6) / 6, I = exp(-max(0, y - PY) / 36), amb = 5 + 21 * exp(-max(0, y - PY) / 50);
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = p * 3, k = kind[p];
      let r = 0, g = 0, b = 0;
      if (k === SKY) {
        r = 30 + 14 * f;
        g = 20 + 16 * f;
        b = 64 + 24 * f;
        const dx = x + 0.5 - mx, dy = y + 0.5 - my, dd = sqrt(dx * dx + dy * dy);
        if (dd < 5.3) {
          const sea = (dx - 1.3) ** 2 + (dy + 1.2) ** 2 < 3.6 || (dx + 1.9) ** 2 + (dy - 1.8) ** 2 < 1.5;
          (r = sea ? 196 : 238), (g = sea ? 194 : 234), (b = sea ? 190 : 214);
        } else {
          const hl = dd < 7.5 ? 0.3 : dd < 10.5 ? 0.16 : dd < 15 ? 0.07 : 0;
          (r += MOONC[0] * hl), (g += MOONC[1] * hl), (b += MOONC[2] * hl);
          if (hl === 0 && y < 30 && hash(p * 13 + 1) < 0.012) r = g = b = 90 + 80 * hash(p);
        }
      } else if (k === ROOF) (r = 70 * alb[p]), (g = 50 * alb[p]), (b = 66 * alb[p]);
      else if (k === GABLE) (r = 40 * alb[p]), (g = 26 * alb[p]), (b = 30 * alb[p]);
      else if (k === WOOD) (r = 104 * alb[p]), (g = 66 * alb[p]), (b = 42 * alb[p]);
      else if (k === GRASS) (r = 34), (g = 66), (b = 50);
      else if (k === SOIL) (r = alb[p] * 30), (g = alb[p] * 19), (b = alb[p] * 26);
      else if (k === SECT) {
        const l = 62 - 22 * max(0, y - PY) / 96;
        (r = alb[p] * l * TINT[0]), (g = alb[p] * l * TINT[1]), (b = alb[p] * l * TINT[2]);
      } else if (k === BACK) {
        // A stone gives back the dim light of the night and the moonbeam;
        // the dust in the beam glows whatever is behind it.
        const m = I * beam(s, x, y);
        r = alb[p] * (TINT[0] * amb + MOONC[0] * 0.5 * m) + MOONC[0] * 0.2 * m;
        g = alb[p] * (TINT[1] * amb + MOONC[1] * 0.5 * m) + MOONC[1] * 0.2 * m;
        b = alb[p] * (TINT[2] * amb + MOONC[2] * 0.5 * m) + MOONC[2] * 0.2 * m;
      } else if (k === WATER) {
        // Black water; a faint broken copy of the moonbeam just under the top.
        const dy = y - WS, m = dy < 6 && (x + dy) % 3 !== 0 ? 0.3 * exp(-1.5) * beam(s, x, WS) * (1 - dy / 6) : 0;
        (r = 3 + MOONC[0] * m), (g = 5 + MOONC[1] * m), (b = 10 + MOONC[2] * m);
      }
      bg[o] = r;
      bg[o + 1] = g;
      bg[o + 2] = b;
    }
  }
}

function touch(S, hard) {
  S.ph = "event";
  S.e = 0;
  S.by = BOTB;
  S.cyc++;
  S.ripples.push({ x: RX, t: 0, a: hard ? 2 : 1.2 });
  for (let i = 0; i < (hard ? 14 : 6); i++) S.bits.push({ x: RX - 6 + Math.random() * 12, y: WS - 1, vx: (Math.random() - 0.5) * 18, vy: -14 - Math.random() * (hard ? 34 : 16), gl: 0 });
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.fog = cl(k[3], 0, 1);
  const m = cl(k[2], 0, 1);
  if (abs(m - S.moon) > 0.003) (S.moon = m), build(S);
  const ds = (d * S.speed) / 2, hd = S.hand;
  S.t += ds;
  S.e += ds;
  if (input.btnPressed && input.btnPressed[0] && (S.ph === "lower" || S.ph === "top")) (S.ph = "drop"), (S.v = 18);
  if (S.ph === "lower") {
    S.by += 18 * ds;
    if (S.by >= BOTB) touch(S, false);
  } else if (S.ph === "drop") {
    S.v += 160 * ds;
    S.by += S.v * ds;
    if (S.by >= BOTB) touch(S, true);
  } else if (S.ph === "event") {
    const e = S.e;
    if (e < E_YANK) S.by = BOTB + 1.3 * sin(e * 8) * exp(-e * 2.5);
    else {
      const y = (e - E_YANK) / 0.3;
      S.by = min(190, BOTB + (y < 1 ? 34 * y * y : 34 + 40 * (y - 1)));
      if (e - ds < E_YANK) {
        // The yank: a splash, a big ring, the rope whips and the wheel runs free.
        S.ripples.push({ x: RX, t: 0, a: 2.4 });
        for (let i = 0; i < 18; i++) S.bits.push({ x: RX - 7 + Math.random() * 14, y: WS - 1, vx: (Math.random() - 0.5) * 30, vy: -22 - Math.random() * 40, gl: 0 });
        S.wa = 6;
        S.sv = 16;
      }
    }
    S.g = e < E_FADE ? sm(e / E_GLOW) * (0.92 + 0.08 * vn(S.t * 7, 3)) : 1 - sm((e - E_FADE) / (E_END - E_FADE));
    S.eo = e < 0.25 ? 0 : e < 2.8 ? sm((e - 0.25) / 0.2) * (abs(e - 1.9) < 0.07 ? 0.2 : 1) : 1 - sm((e - 2.8) / 0.25);
    // The hand rises beside the bucket, takes the rim and goes under with it.
    hd.on = e > E_HAND0 && S.by < 150;
    hd.fall = false;
    hd.x = 22;
    hd.y = e < E_HAND1 ? 134 - (134 - BOTB - 6) * (1 - (1 - (e - E_HAND0) / (E_HAND1 - E_HAND0)) ** 2) : S.by + 6;
    hd.c = sm((e - E_HAND1) / (E_GRIP - E_HAND1));
    if (e > 1.4 && e < 3.3 && (S.bubT += ds * 10) >= 1) {
      S.bubT--;
      S.bubbles.push({ x: RX + (Math.random() - 0.5) * 12, y: 128, v: 10 + Math.random() * 9, sd: floor(Math.random() * 999) });
    }
    if (e > E_END) (S.ph = "calm"), (S.e = 0), (S.g = 0), (S.eo = 0);
  } else if (S.ph === "calm") {
    if (S.e > 0.6) {
      S.ph = "raise";
      S.by = 132;
      // Every other round the hand comes up still holding the rim.
      S.cling = S.cyc % 2 === 1;
      hd.on = S.cling;
      hd.c = 1;
      hd.fall = false;
    }
  } else if (S.ph === "raise") {
    S.by -= 20 * ds;
    if (hd.on && !hd.fall) {
      hd.y = S.by + 6;
      if (S.by < 62) (hd.fall = true), (hd.v = 0);
    }
    if (S.by <= TOPB) (S.by = TOPB), (S.ph = "top"), (S.e = 0);
  } else if (S.ph === "top" && S.e > 0.9) (S.ph = "lower"), (S.e = 0);
  // A hand that lets go drops back down the shaft, opening as it falls.
  if (hd.fall) {
    hd.v += 150 * ds;
    hd.y += hd.v * ds;
    hd.c = max(0, hd.c - ds * 3);
    if (hd.y > WS + 12) {
      hd.fall = hd.on = false;
      S.ripples.push({ x: hd.x + 2, t: 0, a: 1.6 });
      for (let i = 0; i < 8; i++) S.bits.push({ x: hd.x + Math.random() * 5, y: WS - 1, vx: (Math.random() - 0.5) * 16, vy: -12 - Math.random() * 22, gl: 0 });
    }
  }
  if (S.ph === "raise" || S.ph === "top" || S.ph === "lower") hd.on = hd.on && S.ph === "raise";
  // What the bucket brings up glows and drips, less the higher it gets.
  S.cg = S.ph === "raise" || S.ph === "top" ? (S.by < WS - 9 ? exp(-(WS - 9 - S.by) / 40) : 1) : 0;
  if (S.cg > 0.15 && S.by < WS - 9 && (S.dripT += ds * 12 * S.cg) >= 1) {
    S.dripT--;
    S.bits.push({ x: RX - 5 + floor(Math.random() * 10), y: S.by + 10, vx: 0, vy: 0, gl: 1 });
  }
  // The rope's length turns the wheel; after the yank it also runs free a while.
  S.ex += S.sv * ds;
  S.sv *= exp(-1.4 * ds);
  S.th = -(S.by - 5 - CY) / 5 + S.ex;
  S.wa *= exp(-2.4 * ds);
  S.wp += 24 * ds;
  // Flying water falls back; drips fall; bubbles rise and break the surface.
  let n = 0;
  for (const b of S.bits) {
    b.vy += 170 * ds;
    b.x += b.vx * ds;
    b.y += b.vy * ds;
    if (b.y > WS && b.vy > 0) {
      if (b.gl) S.ripples.push({ x: b.x, t: 0, a: 0.5 });
    } else S.bits[n++] = b;
  }
  S.bits.length = n;
  n = 0;
  for (const b of S.bubbles) {
    b.y -= b.v * ds;
    if (b.y <= WS + 1) S.ripples.push({ x: b.x, t: 0, a: 0.6 });
    else S.bubbles[n++] = b;
  }
  S.bubbles.length = n;
  n = 0;
  for (const r of S.ripples) if ((r.t += ds) < 2.2) S.ripples[n++] = r;
  S.ripples.length = n;
  if (S.ripples.length > 24) S.ripples.splice(0, S.ripples.length - 24);
}

// Add a colour at a pixel, by alpha.
function put(buf, x, y, r, g, b, a) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] += (r - buf[o]) * a;
  buf[o + 1] += (g - buf[o + 1]) * a;
  buf[o + 2] += (b - buf[o + 2]) * a;
}

// Something solid at (x, y): under the water it takes the glow's colour and
// darkens.
function solid(S, x, y, r, g, b) {
  if (y > WS + S.off[cl(round(x), 0, W - 1)]) {
    const gc = S.gc, k = 0.3 * S.g;
    r = r * 0.55 + gc[0] * k;
    g = g * 0.55 + gc[1] * k;
    b = b * 0.55 + gc[2] * k;
  }
  put(S.buf, x, y, r, g, b, 1);
}

// The hand, wrist at (x, y): a long forearm from below, a palm, three long
// fingers and a thumb. c is the grip: 0 spread upward, 1 hooked over to the
// right, onto the bucket's rim.
function hand(S, x, y, c) {
  const P = [205, 222, 200];
  for (let j = 0; j < 40; j++) {
    const yy = y + 1 + j, xx = x - 1 - j * 0.12;
    for (let i = -1; i <= 1; i++) solid(S, xx + i, yy, P[0] * 0.86, P[1] * 0.86, P[2] * 0.86);
  }
  for (let j = 0; j < 3; j++) for (let i = -2; i <= 2; i++) solid(S, x + i, y - j, P[0], P[1], P[2]);
  for (let f = 0; f < 3; f++) {
    const bx = x - 2 + 2 * f, sp = (f - 1) * (1 - c);
    for (let j = 0; j < 4 + (f === 1 ? 1 : 0); j++) solid(S, bx + round(sp * j * 0.3), y - 3 - j, P[0], P[1], P[2]);
    const jx = bx + round(sp * 1.4), jy = y - 7 - (f === 1 ? 1 : 0);
    // The last joint: up when open, over and down when it grips.
    solid(S, jx + round(c), jy - round(1 - c), P[0], P[1], P[2]);
    solid(S, jx + round(2 * c), jy - round(2 * (1 - c)) + round(c), P[0] * 0.9, P[1] * 0.9, P[2] * 0.9);
  }
  solid(S, x - 3, y - 2, P[0], P[1], P[2]);
  solid(S, x - 4, y - 3, P[0], P[1], P[2]);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.moon < 0) return;
  const { buf, alb, kind, off } = S, t = S.t, g = S.g, cg = S.cg, by = S.by, s = S.s;
  const gc = hsv(0.3 + S.hue, 0.85, 1, S.gc);
  buf.set(S.bg);
  // The water's surface, rings running out from where things went in.
  for (let x = 0; x < W; x++) {
    let v = 0;
    for (const r of S.ripples) {
      const dx = abs(x + 0.5 - r.x), front = 18 * r.t;
      if (dx < front) v += r.a * exp(-1.6 * r.t) * sin(0.9 * (dx - front)) * min(1, (front - dx) / 3);
    }
    off[x] = cl(round(v), -3, 3);
  }
  // The glow, and what the bucket brings up, light the stones and the air.
  if (g > 0.01 || cg > 0.01) {
    for (let y = PY; y < WS; y++) {
      const fw = g * UP[WS - y];
      for (let x = SX0 - 1; x <= SX1 + 1; x++) {
        let f = fw;
        if (cg > 0.01) {
          const dx = x - RX, dy = y - by - 4;
          f += 0.8 * cg * exp(-sqrt(dx * dx + dy * dy) / 7);
        }
        if (f < 0.012) continue;
        const p = y * W + x, o = p * 3, a = alb[p] * 0.72 + (kind[p] === BACK ? 0.3 : 0);
        buf[o] += gc[0] * f * a;
        buf[o + 1] += gc[1] * f * a;
        buf[o + 2] += gc[2] * f * a;
      }
    }
  }
  // The water: black, or lit from below in slow swirls with a brighter
  // heart round the eyes.
  for (let y = WS; y < H; y++)
    for (let x = SX0; x <= SX1; x++) {
      const o = (y * W + x) * 3;
      if (y < WS + off[x]) {
        // A trough: the stones and air above show through.
        const q = ((y - 1) * W + x) * 3;
        (buf[o] = buf[q]), (buf[o + 1] = buf[q + 1]), (buf[o + 2] = buf[q + 2]);
        continue;
      }
      if (g < 0.01) continue;
      const n = vn(x * 0.21 + 1.6 * vn(y * 0.17 - t * 0.6, 3) + t * 0.5, 11 + (y >> 2)), ex = x - RX, ey = y - 117;
      const f = g * (0.12 + 0.1 * floor(n * 3 + 1.5) / 2 + 0.6 * exp(-sqrt(ex * ex * 0.4 + ey * ey) / 6) + (y - WS < 2 ? 0.2 : 0));
      buf[o] += gc[0] * f;
      buf[o + 1] += gc[1] * f;
      buf[o + 2] += gc[2] * f;
    }
  // Mist over the water, added as light.
  if (S.fog > 0) {
    const top = WS - 4 - 66 * S.fog, a0 = 0.16 + 0.42 * S.fog, mk = 0.7 * g;
    const mr = 150 + (gc[0] - 150) * mk, mg = 150 + (gc[1] - 150) * mk, mb = 186 + (gc[2] - 186) * mk;
    for (let y = max(PY, floor(top)); y < WS + 3; y++) {
      const ramp = sm((y - top) / 12);
      for (let x = SX0; x <= SX1; x++) {
        const nn = 0.55 + 0.45 * vn(x * 0.13 - t * 0.7 + y * 0.04, 17 + (y >> 3)) + 0.3 * vn(x * 0.31 + t * 1.1, 29 + (y >> 2));
        const a = floor(a0 * ramp * cl(nn, 0, 1) * 10) / 10;
        if (a <= 0) continue;
        const o = (y * W + x) * 3;
        buf[o] += mr * a;
        buf[o + 1] += mg * a;
        buf[o + 2] += mb * a;
      }
    }
  }
  // Eyes under the water, pale, with dark slits.
  if (S.eo > 0.02)
    for (const ex of [RX - 6, RX + 4]) {
      const ey = 116, wide = S.eo > 0.45;
      for (let i = 0; i < 5; i++) {
        const pup = i === 2, c = pup ? [20, 30, 20] : [228 + gc[0] * 0.1, 240, 222];
        put(buf, ex + i, ey, c[0], c[1], c[2], min(1, S.eo * 2));
        if (wide && i > 0 && i < 4) {
          put(buf, ex + i, ey - 1, c[0], c[1], c[2], 1);
          put(buf, ex + i, ey + 1, c[0], c[1], c[2], 1);
        }
      }
    }
  // The rope, whipping after the yank.
  const end = min(H - 1, by - 5), ry = PY;
  for (let y = CY; y <= end; y++) {
    const x = RX + S.wa * sin(0.32 * y - S.wp) * ((y - CY) / 90);
    const l = y < ry ? 0.95 : 0.5 + 0.5 * exp(-(y - ry) / 48) * (0.5 + 0.5 * beam(s, round(x), y));
    solid(S, x, y, 200 * l, 176 * l, 122 * l);
  }
  // The windlass wheel: rim, four spokes, the hub and the crank.
  const th = S.th;
  for (let a = 0; a < 2 * PI; a += 0.2) put(buf, CX + 5 * cos(a), CY + 5 * sin(a), 140, 92, 54, 1);
  for (let q = 0; q < 4; q++) {
    const a = th + (q * PI) / 2;
    for (let r = 1; r < 5; r++) put(buf, CX + r * cos(a), CY + r * sin(a), 118, 76, 44, 1);
  }
  const ca = th + PI / 4;
  for (let r = 1; r <= 7; r++) put(buf, CX + r * cos(ca), CY + r * sin(ca), 90, 90, 104, 1);
  put(buf, CX + 7.6 * cos(ca), CY + 7.6 * sin(ca), 170, 120, 70, 1);
  put(buf, CX, CY, 60, 60, 72, 1);
  // The bucket: staves, two iron hoops, its bail, lit less the deeper it hangs.
  if (by - 6 < H) {
    const lit = by < PY ? 1 : 0.45 + 0.55 * exp(-(by - PY) / 45) * (0.55 + 0.45 * beam(s, RX, round(by))), gl = g * UP[cl(round(WS - by - 5), 0, 127)] * 0.22;
    for (let r = 0; r < 10; r++) {
      const xl = RX - 6 + round(r / 9), xr = RX + 5 - round(r / 9);
      for (let x = xl; x <= xr; x++) {
        const hoop = r === 2 || r === 7, edge = x === xl || x === xr, rim = r === 0;
        let c = hoop ? [70, 70, 86] : rim ? [214, 150, 84] : (x & 1) ? [186, 116, 58] : [160, 98, 48];
        const e = edge && !hoop ? 0.7 : 1;
        solid(S, x, by + r, (c[0] * lit + gc[0] * gl) * e, (c[1] * lit + gc[1] * gl) * e, (c[2] * lit + gc[2] * gl) * e);
      }
    }
    for (let x = RX - 6; x <= RX + 5; x++) solid(S, x, by - 5 * (1 - ((x - RX + 0.5) / 6) ** 2), 120 * lit, 120 * lit, 136 * lit);
    // Brimming with the glowing water it brought up.
    if (cg > 0.05) for (let x = RX - 5; x <= RX + 4; x++) put(buf, x, by - 1, gc[0], gc[1], gc[2], min(1, cg * 1.4));
  }
  // The hand, rising, gripping, clinging or falling.
  const hd = S.hand;
  if (hd.on) hand(S, hd.x, hd.y, hd.c);
  // Bubbles, flying water and green drips.
  for (const b of S.bubbles) {
    const x = b.x + 1.2 * sin(b.y * 0.5 + b.sd);
    put(buf, x, b.y, 220, 255, 230, 0.8);
    if (b.sd % 3 === 0) put(buf, x + 1, b.y, 200, 240, 210, 0.5);
  }
  for (const b of S.bits)
    if (b.gl) put(buf, b.x, b.y, gc[0], gc[1], gc[2], 0.9);
    else put(buf, b.x, b.y, 170 + gc[0] * 0.3 * g, 190 + gc[1] * 0.25 * g, 200, 0.85);
  // The surface line: moonlit where the beam reaches it, bright with the glow.
  for (let x = SX0; x <= SX1; x++) {
    const m = beam(s, x, WS) * 0.25, y = WS + off[x], crest = off[x] < 0 ? 1.4 : 1;
    put(buf, x, y, (40 + MOONC[0] * m + gc[0] * g * 0.6) * crest, (44 + MOONC[1] * m + gc[1] * g * 0.6) * crest, (60 + MOONC[2] * m + gc[2] * g * 0.6) * crest, 1);
  }
  for (let p = 0, o = 0; p < N; p++, o += 3)
    display.setPixel(p % W, (p / W) | 0, min(255, round(buf[o] / 4) * 4), min(255, round(buf[o + 1] / 4) * 4), min(255, round(buf[o + 2] / 4) * 4));
}
