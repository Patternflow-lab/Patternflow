// ===== Patternflow pattern =====
// Title:   Mummy
// Family:  halloween
// Idea:    A mummy the height of the panel shambles in a dark purple tomb with its arms out and its hands hanging, glowing green eyes in the slit of its wrappings, loose bandage ends fluttering in the draught, and every few seconds one long strip peels off and whips away in the wind, twisting as it goes, baring a glowing empty hollow where it was, then winds itself back on.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 45
// Round:   45
// ===============================
// @matrix 64x128
// @knobs Glow=0..1, Speed=0.2..3, Wind=0..1, Torch=0..1
//
// Knob 1: Glow. The colour of the eyes, of the hollow inside and of the motes that blow out of it: toxic green at 0, cyan at 0.35, blue at 0.6, violet at 0.8, magenta at 1. The wrappings stay bone white, with the glow only on their right flanks and the undersides of the arms.
// Knob 2: Speed. At 2 a shambling step takes 2.8 seconds, a strip peels off in 1.6, flies for 2.4 and winds back on in 1.8, and the next comes 2 to 4 seconds later; the first starts at 1.6 seconds. At 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Wind. At 0 a draught: the loose ends hang and sway, and the strip that peels off, 38 LEDs long, streams out to the right and curls down beside the legs. At 1 a gale from the left: the ends stand out straight and snap, the strip is 64 LEDs long and climbs the right side of the panel, the mummy leans into it, and two strips can be off at once.
// Knob 4: Torch. A torch on the left wall. At 0 a small low flame and a little warm light on the mummy's left side; at 0.06 about the same; at 1 a flame twice the size that throws flickering orange light over the wall and the wrappings.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, asin, atan2, exp, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// Piecewise linear lookup in a table of [at, value] rows.
const tab = (T, v) => {
  if (v <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (v <= T[i][0]) return T[i - 1][1] + ((T[i][1] - T[i - 1][1]) * (v - T[i - 1][0])) / (T[i][0] - T[i - 1][0]);
  return T[T.length - 1][1];
};

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// Linen in the light, and the cold purple of the tomb it turns to in shadow.
// A dark warm shade reads brown on the panel, so the shadows go violet.
const CREAM = [1, 0.93, 0.76], DUSK = [0.16, 0.09, 0.26];
const FIRE = [1, 0.52, 0.12];
// Half widths of the torso by row (shoulders, chest, waist, hips) and of a
// leg by distance down from the hip.
const TORSO_W = [[31, 7], [34, 12], [44, 11.5], [62, 9.2], [72, 10.4], [80, 10.8]];
const LEG_W = [[0, 5.9], [14, 5.2], [23, 4.3], [34, 3.9], [44, 3.5]];
// The torch on the left wall: the top of its bowl.
const TX = 4, TY = 74;
// One strip's turn, in story seconds: it peels off, flies, winds back on.
const PEEL = 1.6, FLY = 2.4, REWIND = 1.8;
// Where the loose ends hang: which part, how far along it, which side, length.
const ENDS = [
  ["armL", 0.45, 1, 9], ["armR", 0.82, 1, 7], ["torso", 35, -1, 8], ["torso", 21, 1, 10],
  ["legR", 23, 1, 7], ["legL", 36, -1, 6], ["head", -6, 1, 6],
];

export function setup(params) {
  params.s = {
    t: 0, glow: 0, speed: 2, wind: 0, torch: 0.06, gust: 0.5,
    ev: [], rest: 1.6, motes: [], voids: [],
    bg: null, buf: new Float32Array(N * 3), pose: null,
  };
}

// The tomb wall: courses of big stones, all below the panel's lit threshold
// of 24, so what counts as lit is the mummy and the torch.
function wall(S) {
  const bg = new Float32Array(N * 3);
  for (let y = 0; y < H; y++) {
    const row = floor(y / 11), off = (row & 1) * 9, my = y % 11 === 0;
    for (let x = 0; x < W; x++) {
      const col = floor((x + off) / 18), mx = (x + off) % 18 === 0;
      const v = (0.62 + 0.38 * hash(row * 31 + col * 7)) * (my || mx ? 0.45 : 1) * (0.7 + 0.3 * (y / H));
      const o = (y * W + x) * 3;
      const floorY = y >= 124;
      bg[o] = (floorY ? 0.07 : 0.05) * v;
      bg[o + 1] = (floorY ? 0.035 : 0.022) * v;
      bg[o + 2] = 0.085 * v;
    }
  }
  S.bg = bg;
}

function newEvent(S) {
  const busy = S.ev.map((e) => e.part);
  // The first strip always comes off the chest, where it shows most.
  let part = "torso";
  for (let k = S.begun ? 0 : 6; k < 6; k++) {
    const r = Math.random() * 5.6;
    part = r < 3 ? "torso" : r < 4 ? "legL" : r < 5 ? "legR" : "head";
    if (!busy.includes(part)) break;
  }
  // A band well inside the part, so the strip and its hollow are seen whole.
  const span = { torso: [9, 40, 4.2], legL: [9, 36, 4], legR: [9, 36, 4], head: [4, 16, 3] }[part];
  const band = floor((span[0] + Math.random() * (span[1] - span[0])) / span[2]);
  // A strip off the chest is two bands wide.
  S.ev.push({ part, band, bands: part === "torso" ? 2 : 1, stage: 0, timer: 0, p: 0, seed: Math.random() * 6.3 });
  S.begun = true;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.glow = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.wind = cl(k[2], 0, 1);
  S.torch = cl(k[3], 0, 1);
  const ds = (d * S.speed) / 2;
  S.t += ds;
  const T = S.t, wind = S.wind;
  // Gusts: the draught swells and drops on two slow beats.
  S.gust = 0.5 + 0.5 * sin(T * 0.9) * sin(T * 0.37 + 1);
  // The strips: one at a time, two at once in a strong wind. The rest
  // before the next one only runs while there is room for it.
  if (S.ev.length < (wind > 0.5 ? 2 : 1)) S.rest -= ds;
  if (S.rest <= 0) {
    newEvent(S);
    S.rest = (2 + 2 * Math.random()) * (1 - 0.35 * wind);
  }
  for (const e of S.ev) {
    e.timer += ds;
    if (e.stage === 0) {
      e.p = sm(0, PEEL, e.timer);
      if (e.timer >= PEEL) (e.stage = 1), (e.timer = 0);
    } else if (e.stage === 1) {
      e.p = 1;
      if (e.timer >= FLY) (e.stage = 2), (e.timer = 0);
    } else {
      e.p = 1 - sm(0, REWIND, e.timer);
      if (e.timer >= REWIND) e.done = true;
    }
  }
  S.ev = S.ev.filter((e) => !e.done);
  // Motes of the glow blow out of an open hollow and away on the wind.
  const aw = windAngle(S), v0 = 9 + 22 * wind;
  if (S.voids.length) {
    let n = ds * 14;
    while (n > 0 && S.motes.length < 60) {
      if (Math.random() < n) {
        const [x, y] = S.voids[floor(Math.random() * S.voids.length)];
        const a = aw + (Math.random() - 0.5) * 0.9, v = v0 * (0.5 + Math.random());
        S.motes.push({ x, y, vx: cos(a) * v, vy: sin(a) * v - 4, life: 1, ph: Math.random() * 6 });
      }
      n -= 1;
    }
  }
  for (const m of S.motes) {
    m.life -= ds * 0.75;
    m.x += m.vx * ds;
    m.y += (m.vy + 4 * sin(T * 5 + m.ph)) * ds;
  }
  S.motes = S.motes.filter((m) => m.life > 0 && m.x > -2 && m.x < W + 2 && m.y > -2 && m.y < H + 2);
  S.pose = pose(S);
}

// The wind's direction for strips and ends: down and to the right in a
// draught, out and up to the right in a gale.
function windAngle(S) {
  const B = 0.45 + 0.25 * S.gust + S.wind * (0.3 + 0.3 * S.gust);
  return mix(1.45, -0.4, min(1.05, B));
}

// The body this frame. The shamble is one step every 2.8 story seconds: the
// weight goes from foot to foot, the free foot drags up, the hips and then
// the shoulders swing over it, the head lolls behind, and the arms bob out
// of step.
function pose(S) {
  const T = S.t, w = (2 * PI * T) / 2.8, sw = sin(w);
  const dy = 0.6 - 0.9 * abs(sw);
  const hipX = 32 + 1.1 * sw;
  // The gale pushes the mummy over a little; it leans back into it.
  const lean = -2.4 * S.wind * (0.6 + 0.4 * S.gust);
  const sway = 2.1 * sin(w - 0.4) + lean;
  const torsoX = (y) => hipX + sway * cl((78 - y) / 46, 0, 1.15);
  const torso = { y0: 31 + dy, y1: 80 + dy, cx: (y) => torsoX(y - dy), w: (y) => tab(TORSO_W, y - dy), tilt: 0.42, bw: 4.2, seed: 0.3 };
  const legs = {};
  for (const [name, side, lift] of [["legL", -1, 2.6 * max(0, sw) ** 1.5], ["legR", 1, 2.6 * max(0, -sw) ** 1.5]]) {
    const hx = hipX + side * 6.1, ax = 32 + side * 7.2, y0 = 77 + dy, y1 = 120 - lift, L = y1 - y0;
    // A lifted leg bends its knee in.
    const knee = -side * 1.6 * (lift / 2.6);
    legs[name] = {
      y0, y1, cx: (y) => mix(hx, ax, (y - y0) / L) + knee * sin((PI * (y - y0)) / L),
      w: (y) => tab(LEG_W, ((y - y0) * 44) / L), tilt: side * 0.5, bw: 4, seed: side > 0 ? 0.6 : 0.1, foot: [ax + side * 0.8, y1 + 3],
    };
  }
  const sy = 37 + dy, shX = torsoX(37);
  const reach = -1.4 * sin(T * 0.7);
  const arms = {};
  for (const [name, side, bob] of [["armL", -1, 2.6 * sin(w + 0.6)], ["armR", 1, 2.6 * sin(w + PI + 0.6)]]) {
    const x0 = shX + side * 9, x1 = cl(shX + side * 25, 4, 59), wy = sy - 1.5 + bob + reach;
    arms[name] = {
      x0, x1, cy: (x) => mix(sy, wy, (x - x0) / (x1 - x0)), w: (x) => mix(4.3, 3, (x - x0) / (x1 - x0)), tilt: 0.5, bw: 3.6, seed: side > 0 ? 0.5 : 0,
      // The hand hangs limp from the wrist and swings.
      hand: [x1 + side * 0.5, wy, 1.3 * sin(w * 2 + side) + side * 0.6],
    };
  }
  const head = { hx: torsoX(31) + 1.3 * sin(w - 1.3), hy: 18.5 + dy * 0.5 - 0.6 * abs(sin(w - 0.9)), rx: 8.4, ry: 11 };
  return { dy, torso, ...legs, ...arms, head };
}

// The colour of bandage: lit level v (0 to 1) on the linen ramp, in steps
// of 1/14 so a smooth shade does not cost the frame its bytes.
function linen(buf, o, v) {
  v = round(cl(v, 0, 1) * 14) / 14;
  const k = 0.32 + 0.68 * v;
  buf[o] = mix(DUSK[0], CREAM[0], v) * k;
  buf[o + 1] = mix(DUSK[1], CREAM[1], v) * k;
  buf[o + 2] = mix(DUSK[2], CREAM[2], v) * k;
}

// The torch turns the side of the linen that faces it orange, in steps;
// t is where the LED sits across its limb, -1 on the left.
function torchlit(S, o, x, y, t, v) {
  const dx = x - TX, dy = y - TY + 6;
  const warm = round(((S.tl * max(0, 0.6 - t)) / 1.6 / (1 + (dx * dx + dy * dy) / 5000)) * 10) / 10;
  if (warm <= 0) return;
  const a = min(0.85, warm * 0.9), k = 0.35 + 0.65 * v;
  S.buf[o] = S.buf[o] * (1 - a) + FIRE[0] * k * a;
  S.buf[o + 1] = S.buf[o + 1] * (1 - a) + FIRE[1] * k * a;
  S.buf[o + 2] = S.buf[o + 2] * (1 - a) + FIRE[2] * k * a;
}

// One LED on a wrapped limb. t runs across the limb (-1 to 1), s along it;
// the bands run round it on a helix, so on the front they cross at a slant
// and bend over the curve. Each band throws a thin shadow on the next, and
// the light comes from the upper left.
function wrapped(S, o, x, y, t, s, part, id, light) {
  const th = asin(t), phi = (s + part.tilt * part.wd * th) / part.bw + part.seed, b = floor(phi), f = phi - b;
  for (const e of S.ev)
    if (e.part === id && b >= e.band && b < e.band + e.bands && t < -1 + 2 * min(1, e.p * 1.5)) {
      // The hollow: nothing inside but the glow, brightest deep in the middle.
      const g = round((0.12 + 0.55 * (1 - abs(t)) * (0.85 + 0.15 * sin(S.t * 7 + y * 0.4))) * 10) / 10;
      S.buf[o] = S.G[0] * g;
      S.buf[o + 1] = S.G[1] * g;
      S.buf[o + 2] = S.G[2] * g;
      if (((x * 7 + y * 3) & 7) === 0) S.voids.push([x, y]);
      return;
    }
  const lam = 0.36 + 0.64 * max(0, cos(th - light));
  const band = f < 0.15 ? 0.5 : 0.78 + 0.22 * ((f - 0.15) / 0.85);
  const vary = 0.86 + 0.14 * hash(b * 13 + floor(part.seed * 10));
  const v = lam * band * vary;
  linen(S.buf, o, v);
  // The torch turns the near side orange, in steps.
  torchlit(S, o, x, y, t, v);
  // The glow from inside the tomb catches the far side: the right flank of
  // an upright limb, the underside of an arm.
  const gl = round(max(0, t - 0.05) * 0.66 * 8 * (0.9 + 0.1 * sin(S.t * 3.1))) / 8;
  if (gl > 0) {
    S.buf[o] = S.buf[o] * (1 - gl) + S.G[0] * gl;
    S.buf[o + 1] = S.buf[o + 1] * (1 - gl) + S.G[1] * gl;
    S.buf[o + 2] = S.buf[o + 2] * (1 - gl) + S.G[2] * gl;
  }
}

// A limb standing up: centre and half width by row.
function upright(S, part, id) {
  const y0 = max(0, Math.ceil(part.y0)), y1 = min(H - 1, floor(part.y1));
  for (let y = y0; y <= y1; y++) {
    const c = part.cx(y), w = part.w(y);
    if (w < 0.6) continue;
    part.wd = w;
    for (let x = max(0, Math.ceil(c - w)); x <= min(W - 1, floor(c + w)); x++) {
      const t = (x - c) / w;
      if (abs(t) > 1) continue;
      wrapped(S, (y * W + x) * 3, x, y, t, y - part.y0, part, id, -0.55);
    }
  }
}

// An arm held out: centre row and half height by column.
function outstretched(S, arm) {
  const a = min(arm.x0, arm.x1), b = max(arm.x0, arm.x1);
  for (let x = max(0, Math.ceil(a)); x <= min(W - 1, floor(b)); x++) {
    const c = arm.cy(x), w = arm.w(x);
    arm.wd = w;
    for (let y = max(0, Math.ceil(c - w)); y <= min(H - 1, floor(c + w)); y++) {
      const t = (y - c) / w;
      if (abs(t) > 1) continue;
      wrapped(S, (y * W + x) * 3, x, y, t, abs(x - arm.x0), arm, "arm", -1.1);
    }
  }
  // The hand hangs from the wrist, wrapped too, with the fingers parted at
  // the bottom.
  const [hx, hy, swing] = arm.hand;
  const hand = { y0: hy - 2, y1: hy + 8, cx: (y) => hx + (swing * (y - hy)) / 8, w: (y) => (y < hy + 4 ? 2.7 : 2.7 - (y - hy - 4) * 0.2), tilt: 0.2, bw: 2.4, seed: 0.2 };
  upright(S, hand, "hand");
  for (let y = round(hy + 4); y <= round(hy + 8); y++)
    for (const f of [-0.9, 0.9]) {
      const x = round(hand.cx(y) + f);
      if (x >= 0 && x < W && y >= 0 && y < H) linen(S.buf, (y * W + x) * 3, 0.12);
    }
}

// A ribbon of linen from (x, y), heading off at angle a0 and turning into
// the wind over its first 9 LEDs, whipping more towards its free end and
// curling by curl radians an LED after that. It
// twists as it goes: where it turns edge-on it narrows, and its back is
// darker than its face, so the twist reads as a spiral.
function ribbon(S, x, y, a0, L, aw, flut, ph, wide, curl) {
  const buf = S.buf;
  for (let s = 0; s < L; s += 0.5) {
    const u = s / L;
    const a = mix(a0, aw, sm(0, 9, s)) + curl * max(0, s - 6) + flut * u * sin(ph - 0.3 * s) + 0.18 * flut * sin(ph * 1.7 - 0.7 * s);
    x += 0.5 * cos(a);
    y += 0.5 * sin(a);
    const tw = cos(0.36 * s - ph * 1.2), hw = wide * (0.3 + 0.7 * abs(tw)), face = tw > 0 ? 1 : 0.74;
    const nx = -sin(a), ny = cos(a);
    for (let q = -hw; q <= hw + 1e-6; q += 0.5) {
      const px = round(x + q * nx), py = round(y + q * ny);
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const o = (py * W + px) * 3, v = face * (1 - 0.25 * (q / max(hw, 0.5)) ** 2) * (0.92 + 0.08 * cos(s * 1.3));
      linen(buf, o, v);
      torchlit(S, o, px, py, 0, v);
    }
  }
}

// The torch: a bowl on a bracket and a flame that licks and leans with the
// wind, its light on the wall in steps.
function torch(S) {
  const buf = S.buf, T = S.t, size = 0.75 + 0.85 * S.torch, lit = S.tl;
  for (let y = 40; y < 104; y++)
    for (let x = 0; x < 30; x++) {
      const dx = x - TX, dy = (y - TY + 6) * 0.8, r = sqrt(dx * dx + dy * dy);
      const g = round(exp(-r / (5 + 9 * S.torch)) * lit * 14) / 20;
      if (g <= 0) continue;
      const o = (y * W + x) * 3;
      buf[o] += FIRE[0] * g * 0.55;
      buf[o + 1] += FIRE[1] * g * 0.45;
      buf[o + 2] += FIRE[2] * g * 0.4;
    }
  // Bracket and bowl, dark iron with a lit rim.
  for (let y = TY; y < TY + 10; y++) for (const x of [TX - 1, TX]) if (y > TY + 2 || x === TX) buf.set([0.1, 0.06, 0.1], (y * W + x) * 3);
  for (let x = TX - 3; x <= TX + 3; x++) {
    buf.set([0.32, 0.16, 0.08], (TY * W + x) * 3);
    if (abs(x - TX) < 3) buf.set([0.12, 0.07, 0.1], ((TY + 1) * W + x) * 3);
  }
  const Hf = 9 * size * (0.9 + 0.1 * sin(T * 17) * sin(T * 6.1)), bend = (0.15 + 0.5 * S.wind) * (0.7 + 0.6 * S.gust);
  for (let y = floor(TY - Hf - 1); y < TY; y++) {
    const u = (TY - y) / Hf;
    if (u > 1 || y < 0) continue;
    const fx = TX + bend * u * u * Hf * 0.5 + 0.8 * u * sin(T * 13 + y * 0.7);
    const fw = 2.6 * size * sin(PI * min(1, u * 1.2 + 0.12)) ** 0.7 * (1 - 0.5 * u);
    for (let x = floor(fx - fw); x <= Math.ceil(fx + fw); x++) {
      if (x < 0 || x >= W) continue;
      const r = abs(x - fx) / max(0.5, fw);
      if (r > 1) continue;
      const o = (y * W + x) * 3;
      const c = r < 0.45 && u < 0.55 ? [1, 0.92, 0.55] : r < 0.75 && u < 0.85 ? [1, 0.62, 0.12] : [1, 0.36, 0.05];
      buf[o] = c[0];
      buf[o + 1] = c[1];
      buf[o + 2] = c[2];
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.pose) return;
  if (!S.bg) wall(S);
  const P = S.pose, buf = S.buf, T = S.t;
  S.G = hsv(0.3 + 0.55 * S.glow, 0.88, 1);
  // The torch's light now: it flickers.
  S.tl = (0.12 + 1.25 * S.torch) * (0.82 + 0.18 * sin(T * 11) * sin(T * 7.3 + 1));
  buf.set(S.bg);
  S.voids = [];
  torch(S);
  // A shadow on the floor under the feet.
  for (let y = 122; y < H; y++)
    for (let x = 14; x < 50; x++) {
      const q = ((x - 32) / 18) ** 2 + ((y - 125) / 3) ** 2;
      if (q < 1) for (let c = 0; c < 3; c++) buf[(y * W + x) * 3 + c] *= 0.4;
    }
  // Back to front: legs and feet, torso, neck, arms, head.
  for (const id of ["legL", "legR"]) {
    const L = P[id];
    upright(S, L, id);
    const [fx, fy] = L.foot;
    upright(S, { y0: fy - 2.6, y1: fy + 2.4, cx: () => fx, w: (y) => 4.6 * sqrt(max(0, 1 - ((y - fy) / 2.7) ** 2)), tilt: 0.1, bw: 2.5, seed: 0.4 }, "foot");
  }
  upright(S, { y0: P.head.hy + 8, y1: P.torso.y0 + 2, cx: (y) => P.torso.cx(y), w: () => 5, tilt: 0.3, bw: 2.6, seed: 0 }, "neck");
  upright(S, P.torso, "torso");
  outstretched(S, P.armL);
  outstretched(S, P.armR);
  const h = P.head;
  const head = {
    y0: h.hy - h.ry, y1: h.hy + h.ry, cx: () => h.hx, tilt: -0.12, bw: 3, seed: 0.1,
    w: (y) => h.rx * sqrt(max(0, 1 - ((y - h.hy) / h.ry) ** 2)) * (y > h.hy ? 1 - (0.14 * (y - h.hy)) / h.ry : 1),
  };
  upright(S, head, "head");
  // The slit in the wrappings and the eyes in it.
  const ey = round(h.hy), ex = round(h.hx);
  const flare = S.ev.reduce((m, e) => max(m, e.p), 0);
  const eg = 0.8 + 0.2 * sin(T * 3.1) + 0.2 * flare;
  for (let y = ey - 2; y <= ey + 1; y++)
    for (let x = ex - 6; x <= ex + 6; x++) {
      if (abs(x - ex) > (y === ey - 2 || y === ey + 1 ? 4 : 6)) continue;
      const o = (y * W + x) * 3, eye = (y === ey - 1 || y === ey) && (x === ex - 4 || x === ex - 3 || x === ex + 3 || x === ex + 4);
      const near = abs(abs(x - ex) - 3.5) < 2 ? 0.3 : 0.06;
      const g = eye ? min(1, eg) : near * eg;
      buf[o] = 0.02 + S.G[0] * g + (eye ? 0.35 * flare : 0);
      buf[o + 1] = 0.01 + S.G[1] * g + (eye ? 0.35 * flare : 0);
      buf[o + 2] = 0.04 + S.G[2] * g + (eye ? 0.35 * flare : 0);
    }
  // Loose ends: short tails pinned to the body, fluttering on the wind.
  const aw = windAngle(S), wind = S.wind;
  ENDS.forEach(([id, at, side, len], n) => {
    let x, y;
    if (id === "armL" || id === "armR") {
      const A = P[id];
      x = mix(A.x0, A.x1, at);
      y = A.cy(x) + A.w(x) * side;
    } else if (id === "head") {
      x = h.hx + side * 5.5;
      y = h.hy + at;
    } else {
      const L = P[id], yy = L.y0 + at;
      x = L.cx(yy) + L.w(yy) * side;
      y = yy;
    }
    const a = mix(1.5, aw, 0.35 + 0.6 * wind), ph = T * (6 + 7 * wind) + n * 1.9;
    ribbon(S, x, y, PI / 2 - side * 0.2, len * (1 + 0.3 * wind), a, 0.5 + 0.6 * wind, ph, 1, 0);
  });
  // The strips coming off: each leaves its band at the peel point, which
  // runs across the front from the left as it unwinds and back as it winds
  // on.
  for (const e of S.ev) {
    const part = P[e.part === "head" ? "head" : e.part], geo = e.part === "head" ? head : part;
    const tp = cl(-1 + 2 * min(1, e.p * 1.5), -0.98, 0.98), th = asin(tp);
    const mid = e.band + e.bands / 2 - geo.seed;
    let y = geo.y0 + mid * geo.bw;
    for (let it = 0; it < 3; it++) y = geo.y0 + mid * geo.bw - geo.tilt * geo.w(y) * th;
    const x = geo.cx(y) + geo.w(y) * tp;
    const L = e.p * (38 + 26 * wind);
    // In a draught the strip streams out to the right and curls down into
    // the open space beside the legs; in a gale it catches the updraft and
    // climbs the right side of the panel. Either way it stays on the panel.
    if (L > 1) ribbon(S, x, y, atan2(-geo.tilt, cos(th)), L, aw + mix(0.15, -0.7, wind), 0.7 + 0.6 * wind, T * (7 + 6 * wind) + e.seed, 0.9 + 0.7 * e.bands, mix(0.035, -0.02, wind));
  }
  // Motes from the hollows.
  for (const m of S.motes) {
    const x = round(m.x), y = round(m.y);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const o = (y * W + x) * 3, g = round(m.life * 4) / 4;
    buf[o] = max(buf[o], S.G[0] * g);
    buf[o + 1] = max(buf[o + 1], S.G[1] * g);
    buf[o + 2] = max(buf[o + 2], S.G[2] * g);
  }
  for (let p = 0, o = 0; p < N; p++, o += 3)
    display.setPixel(p % W, (p / W) | 0, round(255 * min(1, buf[o])), round(255 * min(1, buf[o + 1])), round(255 * min(1, buf[o + 2])));
}
