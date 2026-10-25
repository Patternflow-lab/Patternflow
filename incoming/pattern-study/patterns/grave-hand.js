// ===== Patternflow pattern =====
// Title:   Grave Hand
// Family:  halloween
// Idea:    Under a big low moon a headstone and a heap of fresh grave earth stand black; the heap heaves and cracks with green light, a bony hand bursts out of it throwing clods, gropes and claws at the air in front of the moon, then sinks back and the earth settles, and it all begins again a few seconds later.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 43; after the hand rising from the grave of Halloween yard decorations
// Round:   43
// ===============================
// @matrix 64x128
// @knobs Colour=0..1, Speed=0.2..3, Hands=1..3, Fog=0..1
//
// Knob 1: Colour. Three palettes round the knob: at 0 an orange moon in a purple sky, with toxic green light from the grave on the hands; at 0.33 a sickly green moon and orange light; at 0.67 a lilac moon and green light. Each holds for 0.1 either side of its point and blends into the next in between, and 1 is 0 again.
// Knob 2: Speed. At 2 a round takes 12 to 13 seconds: the earth heaves for 1.6, the hand is out in 0.45, gropes for 4.2, sinks back in three pulls over 2.2, the heap settles for 1.5 and rests 0.8 to 2.2. The first hand bursts out at 2.3 seconds. At 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Hands, 1 to 3. The first comes up in the middle of the heap in front of the moon, its fingertips 56 LEDs above the hole at full stretch. The second, 0.86 its size, comes up on the right, and the third, 0.82, on the left in front of the headstone; each keeps its own round, so they rise and sink out of step.
// Knob 4: Fog. How high and thick the ground fog lies. At 0 a thin layer fills the bottom 29 rows; at 1 it climbs to row 55, over the heap and the lower half of the moon, three times as thick. Over a glowing hole it is lit the colour of the grave light.
// Buttons: K1 tap brings every hand that is under the earth, resting, heaving, sinking or settling, bursting out at once.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, abs, sin, cos, exp, round, PI } = Math;
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

// The moon, low behind the grave.
const MX = 35, MY = 58, MR = 25;
// The ground line, and the mound of fresh earth on it: centre, half width,
// height.
const GY = 105, KX = 37, KW = 27, KH = 13;
// Palettes, cycled by K1: sky top, sky at the horizon, moon, moon's bright
// limb, rim light on the hands, glow from the grave, fog, lit edge of earth.
const PAL = [
  [[0.02, 0, 0.05], [0.24, 0.06, 0.32], [1, 0.55, 0.12], [1, 0.8, 0.45], [0.45, 1, 0.12], [0.35, 1, 0.1], [0.55, 0.42, 0.85], [1, 0.55, 0.15]],
  [[0, 0.02, 0.05], [0.2, 0.04, 0.3], [0.62, 1, 0.22], [0.85, 1, 0.6], [1, 0.5, 0.08], [1, 0.42, 0.05], [0.4, 0.9, 0.35], [0.6, 1, 0.25]],
  [[0.01, 0, 0.03], [0.13, 0.03, 0.16], [0.82, 0.68, 1], [0.95, 0.9, 1], [0.45, 1, 0.15], [0.4, 1, 0.12], [0.7, 0.45, 1], [0.8, 0.65, 1]],
];
// Where each hand comes up: x on the mound, its size, and when its first
// burst comes, in story seconds (one a second at Speed 2).
const HANDS = [
  { x: 37, s: 1.12, first: 2.3 },
  { x: 53, s: 0.86, first: 0.9 },
  { x: 22, s: 0.82, first: 1.3 },
];
// One round, in story seconds: the earth heaves, the hand bursts out, gropes,
// sinks back, and the earth settles.
const HEAVE = 1.6, BURST = 0.45, GROPE = 4.2, SINK = 2.2, SETTLE = 1.5;
// Fingers: base on the palm (local x across, y up, at full size), splay
// angle, segment lengths, and which way the finger hooks as the hand closes.
// The last is the thumb. RAD holds the radii at the knuckles and the tip.
const FINGERS = [
  { bx: -3.4, by: 9.2, a: -0.32, len: [4.4, 3.1, 2.7], hook: 1 },
  { bx: -1.1, by: 10, a: -0.08, len: [4.9, 3.4, 2.9], hook: 0.4 },
  { bx: 1.2, by: 9.8, a: 0.14, len: [4.6, 3.2, 2.7], hook: -1 },
  { bx: 3.4, by: 8.8, a: 0.4, len: [3.6, 2.6, 2.3], hook: -1 },
  { bx: -4.2, by: 3, a: -1.05, len: [3.6, 3.1], hook: 1 },
];
const RAD = [1.35, 1.2, 1.0, 0.55];
// Upper arm, forearm and hand (wrist to fingertip), and how far the
// fingertips reach above the hole, all at full size.
const UA = 22, FA = 21, HL = 21, REACH = 50;

// The surface of the mound, before any heave: a heap with a few lumps.
const mound = (x) => {
  const q = (x - KX) / KW;
  return q * q < 1 ? GY - KH * (1 - q * q) ** 0.7 - 0.8 * sin(x * 1.7) * (1 - q * q) : GY;
};

function newHand(d, i) {
  // The first round starts in the heave, or rests until it is due.
  const wait = d.first - HEAVE;
  const cracks = [];
  for (let c = 0; c < 4; c++) {
    let a = PI / 2 + (c - 1.5) * 0.75 + 0.3 * (hash(i * 31 + c) - 0.5), x = 0, y = 1;
    const pts = [[x, y]];
    for (let k = 0; k < 3; k++) {
      a += 0.6 * (hash(i * 31 + c * 7 + k) - 0.5);
      x += cos(a) * (2.5 + 1.5 * hash(i * 17 + c * 5 + k)) * 1.6;
      y += sin(a) * (2.5 + 1.5 * hash(i * 19 + c * 3 + k)) * 0.7;
      pts.push([x, y]);
    }
    cracks.push(pts);
  }
  return {
    ...d, i, on: false, phase: wait > 0 ? "rest" : "heave", timer: wait > 0 ? 0 : -wait, rest: max(0, wait),
    L: 0, from: 0, bump: 0, lift: 0, glow: 0, crack: 0, sway: 0, bend: 0, tilt: 0, open: 0.3, g: 0, cracks,
  };
}

export function setup(params) {
  params.s = {
    t: 0, pal: -1, colour: 0, speed: 2, count: 1, fog: 0.06,
    hands: HANDS.map(newHand), clods: [],
    bg: new Float32Array(N * 3), rgb: new Float32Array(N * 3), sdf: new Float32Array(N), surf: new Float32Array(W), gx: new Float32Array(W),
  };
}

function spawnClods(S, h, n, fast) {
  const y0 = mound(h.x) - h.bump;
  for (let k = 0; k < n; k++) {
    const a = -PI / 2 + (Math.random() - 0.5) * (fast ? 2.3 : 1.6), v = (fast ? 28 + 52 * Math.random() : 8 + 14 * Math.random()) * (0.6 + 0.4 * h.s);
    S.clods.push({ x: h.x + (Math.random() - 0.5) * 6 * h.s, y: y0 - 1, vx: cos(a) * v, vy: sin(a) * v, r: fast ? 0.5 + 1.1 * Math.random() : 0.5, life: 3 + Math.random() * 2, hot: fast ? 1 : 0.4, bounces: 0 });
  }
}

// A hand at rest or switched off: the heap and the light die down.
function calm(h, d) {
  const f = exp(-d * 3);
  h.bump *= f;
  h.lift *= f;
  h.glow *= f;
  h.crack *= f;
}

// One hand's round. Everything runs on story time d.
function stepHand(S, h, d, tap) {
  h.timer += d;
  h.g += d;
  const s = h.s;
  // A tap: a hand under the earth bursts out now, even one sinking back.
  if (tap && h.phase !== "burst" && h.phase !== "grope") {
    h.phase = "heave";
    h.timer = HEAVE;
  }
  // The pose eases towards what the phase asks for, so nothing snaps when
  // one phase hands over to the next.
  const ease = 1 - exp(-d * 9);
  if (h.phase === "rest") {
    calm(h, d);
    if (h.timer >= h.rest) {
      h.phase = "heave";
      h.timer = 0;
    }
  }
  if (h.phase === "heave") {
    const u = cl(h.timer / HEAVE, 0, 1);
    // The earth swells and trembles over the hand, and a few crumbs hop.
    h.bump = s * (4.5 * sm(0, 1, u) + 0.9 * u * sin(h.g * 31 + h.i));
    h.crack = sm(0.35, 1, u);
    h.glow = 0.3 * u;
    if (Math.random() < d * 7 * u) spawnClods(S, h, 1, false);
    if (h.timer >= HEAVE) {
      h.phase = "burst";
      h.timer = 0;
      h.from = h.L;
      spawnClods(S, h, round(26 * s), true);
    }
  } else if (h.phase === "burst") {
    const u = cl(h.timer / BURST, 0, 1);
    // Out in under half a second, a little past full height and back.
    h.L = mix(h.from, REACH * s * (1 + 0.12 * sin(PI * u)), 1 - (1 - u) ** 3);
    h.bump = 4.5 * s * (1 - u);
    h.lift = 3.2 * s * sm(0, 1, u);
    h.glow = 1;
    h.open = mix(0.05, 1, u);
    h.sway += (0.08 * sin(h.g * 5 + h.i) - h.sway) * ease;
    h.bend += (0 - h.bend) * ease;
    h.tilt += (0 - h.tilt) * ease;
    if (h.timer >= BURST) {
      h.phase = "grope";
      h.timer = 0;
    }
  } else if (h.phase === "grope") {
    const t = h.timer;
    // Groping at the air: the arm sways and stretches, the wrist turns, and
    // the fingers open wide and close into a claw about once a second.
    const w = sm(0, 0.8, t);
    h.L = REACH * s * (1 + w * (0.09 * sin(t * 2.6) - 0.05 * sin(t * 5.1 + 1)));
    h.sway += (w * (0.2 * sin(t * 1.8 + h.i * 2) + 0.06 * sin(t * 4.1)) - h.sway) * ease;
    h.bend += (w * 0.5 * sin(t * 1.25 + 2 + h.i) - h.bend) * ease;
    h.tilt += (w * (0.45 * sin(t * 2.4 + 1 + h.i) + 0.12 * sin(t * 4.7)) - h.tilt) * ease;
    h.open += (0.5 + 0.5 * sin(t * 6.3 + 1.6) - h.open) * ease;
    h.glow = mix(1, 0.35, sm(0, 1.5, t));
    h.crack = 1 - sm(0, 2, t) * 0.5;
    if (h.timer >= GROPE) {
      h.phase = "sink";
      h.timer = 0;
    }
  } else if (h.phase === "sink") {
    const u = cl(h.timer / SINK, 0, 1);
    // Back down in three pulls, the fingers clawing at the earth.
    const pull = (u * 3 + 0.35 * sin(u * 6 * PI)) / 3;
    h.L = REACH * s * (1 - sm(0, 1, pull)) * (1 + 0.05 * sin(h.g * 4));
    h.sway *= exp(-d * 1.5);
    h.bend *= exp(-d * 2);
    h.tilt += (0.25 * sin(h.timer * 3.1) - h.tilt) * ease;
    h.open += (0.25 + 0.25 * sin(h.timer * 9) - h.open) * ease;
    h.glow = 0.35 * (1 - u) + 0.15;
    h.lift = 3.2 * s * (1 - 0.4 * u);
    if (h.timer >= SINK) {
      h.phase = "settle";
      h.timer = 0;
      h.L = 0;
    }
  } else if (h.phase === "settle") {
    h.L = 0;
    const u = cl(h.timer / SETTLE, 0, 1);
    // The heap slumps back and wobbles still.
    h.lift = 1.9 * s * (1 - sm(0, 1, u));
    h.bump = -1.2 * s * sin(u * PI) * exp(-u * 2);
    h.glow = 0.15 * (1 - u);
    h.crack = 0.5 * (1 - u);
    if (h.timer >= SETTLE) {
      h.phase = "rest";
      h.timer = 0;
      h.rest = 0.8 + 1.4 * Math.random();
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.colour = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.count = cl(round(k[2]), 1, 3);
  S.fog = cl(k[3], 0, 1);
  const ds = (d * S.speed) / 2;
  S.t += ds;
  const tap = !!(input.btnPressed && input.btnPressed[0]);
  // The hands the knob asks for at the start keep their first schedule; one
  // turned on later comes up after a short rest.
  if (!S.begun) for (const h of S.hands) h.on = h.i < S.count;
  S.begun = true;
  for (const h of S.hands) {
    const on = h.i < S.count;
    if (on && !h.on) {
      h.phase = "rest";
      h.timer = 0;
      h.rest = 0.3 + 0.5 * h.i;
    }
    h.on = on;
    if (on) stepHand(S, h, ds, tap);
    else {
      h.L = 0;
      calm(h, ds);
    }
  }
  // Clods: thrown, falling, bouncing once on the heap, then lying on it until
  // they fade into it.
  const surf = S.surf;
  surface(S, surf);
  for (const c of S.clods) {
    c.life -= ds;
    c.hot *= exp(-ds * 2);
    if (c.bounces < 2) {
      c.vy += 120 * ds;
      c.x += c.vx * ds;
      c.y += c.vy * ds;
      const xi = cl(floor(c.x), 0, W - 1);
      if (c.y >= surf[xi] - c.r * 0.5 && c.vy > 0) {
        c.y = surf[xi] - c.r * 0.5;
        c.vy *= -0.25;
        c.vx *= 0.4;
        c.bounces++;
      }
    } else {
      const xi = cl(floor(c.x), 0, W - 1);
      c.y = surf[xi] - c.r * 0.5;
    }
  }
  S.clods = S.clods.filter((c) => c.life > 0 && c.x > -3 && c.x < W + 3 && c.y < H + 3);
}

// The heap's surface now, column by column: the mound, the heave over each
// hand and the earth pushed up on either side of an arm.
function surface(S, surf) {
  for (let x = 0; x < W; x++) {
    let y = mound(x + 0.5);
    for (const h of S.hands) {
      const dx = x + 0.5 - h.x, w = 5.5 * h.s, sh = 4.6 * h.s, sw = 2.6 * h.s;
      y -= h.bump * exp(-(dx * dx) / (w * w));
      y -= h.lift * (exp(-((dx - sh) ** 2) / (sw * sw)) + exp(-((dx + sh) ** 2) / (sw * sw)));
    }
    surf[x] = y;
  }
}

function palette(S) {
  const h = (S.colour - floor(S.colour)) * 3, i = floor(h) % 3, f = h - floor(h), j = (i + 1) % 3;
  // Each palette holds for 0.1 either side of 0, 1/3 and 2/3 of the knob.
  const g = cl((f - 0.3) / 0.4, 0, 1), s = g * g * (3 - 2 * g);
  return PAL[0].map((_, n) => [0, 1, 2].map((c) => mix(PAL[i][n][c], PAL[j][n][c], s)));
}

// Sky, stars, moon and headstone: they change only with the palette.
function background(S, pal) {
  const bg = S.bg, [top, hor, moon, limb, , , , edge] = pal;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, f = cl(y / GY, 0, 1) ** 1.6;
      const dx = x + 0.5 - MX, dy = y + 0.5 - MY, r = sqrt(dx * dx + dy * dy);
      // The halo in steps of 0.02: a smooth one costs the frame a third more
      // bytes and looks no different on the panel.
      const halo = round(15 * exp(-max(0, r - MR) / 7)) * 0.02;
      const a = cl(MR - r + 0.5, 0, 1);
      let sea = 0;
      for (const [sx, sy, sr] of [[-8, -6, 7], [6, 4, 6], [-3, 10, 4], [9, -9, 4], [-12, 5, 3]]) sea = max(sea, cl(1 - sqrt((dx - sx) ** 2 + (dy - sy) ** 2) / sr, 0, 1));
      const lift = cl(0.55 - (dx + dy) / (2.2 * MR), 0, 1);
      for (let c = 0; c < 3; c++) {
        const sky = mix(top[c], hor[c], f) + halo * moon[c];
        bg[o + c] = mix(sky, mix(moon[c], limb[c], lift) * (1 - 0.25 * sea), a);
      }
    }
  // Stars, out of the moon's halo.
  for (let n = 0; n < 16; n++) {
    const x = floor(hash(n * 3 + 1) * W), y = floor(hash(n * 3 + 2) * 40), dx = x - MX, dy = y - MY;
    if (dx * dx + dy * dy < (MR + 6) ** 2) continue;
    const o = (y * W + x) * 3, b = 0.35 + 0.4 * hash(n * 3 + 3);
    bg[o] = max(bg[o], b * 0.9);
    bg[o + 1] = max(bg[o + 1], b * 0.85);
    bg[o + 2] = max(bg[o + 2], b);
  }
  // The headstone: a slab with a round top, leaning a little, black against
  // the moon with its right edge lit.
  for (let y = 60; y < GY; y++)
    for (let x = 0; x < 26; x++) {
      const lx = x + 0.5 - 12 - (GY - y) * 0.08, ly = y + 0.5;
      const top = 75, half = 8.5;
      let inside = abs(lx) < half && ly > top;
      if (!inside && ly <= top) inside = lx * lx + (ly - top) ** 2 < half * half;
      if (!inside) continue;
      const o = (y * W + x) * 3, d = min(half - abs(lx), ly <= top ? half - sqrt(lx * lx + (ly - top) ** 2) : 99);
      const rim = lx > 0 && d < 1.2 ? 0.55 : 0;
      for (let c = 0; c < 3; c++) bg[o + c] = 0.025 + rim * edge[c] * 0.8;
    }
  // RIP cut into the stone, a little lighter than the stone.
  const RIP = ["110 111 110", "101 010 101", "110 010 110", "101 010 100", "101 111 100"];
  RIP.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] !== "1") continue;
      const y = 79 + j, x = floor(6.5 + i + (GY - y) * 0.08), o = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) bg[o + c] = 0.06 + 0.16 * edge[c] * 0.6 + (c === 2 ? 0.08 : 0.03);
    }
  });
  // Grass along the ground line, black against the glow of the horizon.
  for (let x = 0; x < W; x++) {
    const tall = floor(1 + 3.2 * hash(x * 7 + 5) * hash(x * 11 + 3));
    for (let y = GY - tall; y < GY; y++) for (let c = 0; c < 3; c++) bg[(y * W + x) * 3 + c] = 0.02;
  }
  for (let y = GY; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) bg[(y * W + x) * 3 + c] = c === 2 ? 0.035 : 0.02;
}

// The fog's two waves across the panel, as tables.
const SX1 = new Float32Array(W), CX1 = new Float32Array(W), SX2 = new Float32Array(W), CX2 = new Float32Array(W);
for (let x = 0; x < W; x++) {
  SX1[x] = sin(x * 0.17);
  CX1[x] = cos(x * 0.17);
  SX2[x] = sin(x * 0.07);
  CX2[x] = cos(x * 0.07);
}

// How bright the glow from a hand's hole is this instant: it throbs.
const pulse = (h) => 0.62 + 0.25 * sin(h.g * 6.3) + 0.13 * sin(h.g * 15.1 + 1);

// The hand's bones for this frame, in panel coordinates. L is how high the
// fingertips stand above the hole when the arm is straight; the arm slides
// out of the hole along the upper arm, and bends at the elbow only once the
// elbow is out.
function bones(h) {
  const s = h.s, hole = mound(h.x);
  const d1x = sin(h.sway), d1y = -cos(h.sway), e = h.L - (FA + HL) * s;
  const ex = h.x + e * d1x, ey = hole + e * d1y;
  const a2 = h.sway + h.bend * sm(0, 5 * s, e), d2x = sin(a2), d2y = -cos(a2);
  const wx = ex + FA * s * d2x, wy = ey + FA * s * d2y;
  const ang = a2 + h.tilt, ux = sin(ang), uy = -cos(ang), rx = -uy, ry = ux;
  const P = (lx, ly) => [wx + (lx * rx + ly * ux) * s, wy + (lx * ry + ly * uy) * s];
  const caps = [];
  caps.push([ex, ey, ex - d1x * UA * s, ey - d1y * UA * s, 4 * s, 4.6 * s]);
  caps.push([ex, ey, wx, wy, 3.9 * s, 3.2 * s]);
  // Palm: two fat bones side by side.
  const p0 = P(-2.2, 1.5), p1 = P(-2.4, 7.6), p2 = P(2.2, 1.5), p3 = P(2.3, 7.2);
  caps.push([p0[0], p0[1], p1[0], p1[1], 3 * s, 2.6 * s]);
  caps.push([p2[0], p2[1], p3[0], p3[1], 3 * s, 2.5 * s]);
  // Fingers splay with h.open and hook inwards as they close.
  const close = 1 - h.open;
  for (let f = 0; f < FINGERS.length; f++) {
    const F = FINGERS[f], lag = sin(h.g * 6.3 + 1.6 - f * 0.5) * 0.12;
    const c = cl(close + lag, 0, 1);
    let [x, y] = [F.bx, F.by], a = F.a * (0.55 + 0.75 * (1 - c));
    for (let k = 0; k < F.len.length; k++) {
      a += F.hook * c * [0.35, 0.6, 0.55][k];
      const l = F.len[k] * (1 - 0.35 * c);
      const nx = x + sin(a) * l, ny = y + cos(a) * l;
      const A = P(x, y), B = P(nx, ny);
      const r0 = RAD[k] * (f === 4 ? 1.1 : 1), r1 = (k === F.len.length - 1 ? RAD[3] : RAD[k + 1]) * (f === 4 ? 1.1 : 1);
      caps.push([A[0], A[1], B[0], B[1], r0 * s, r1 * s]);
      x = nx;
      y = ny;
    }
  }
  return { caps, wx, wy };
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const pal = palette(S);
  const [, , , , rimC, glowC, fogC, edgeC] = pal;
  if (S.pal !== S.colour) {
    background(S, pal);
    S.pal = S.colour;
  }
  const { rgb, sdf, surf } = S;
  rgb.set(S.bg);
  surface(S, surf);
  sdf.fill(99);
  // The hands, as one distance field: below zero is inside.
  for (const h of S.hands) {
    if (!h.on || h.L <= 0.2) continue;
    const B = bones(h);
    let bx0 = 99, bx1 = -99, by0 = 999;
    for (const c of B.caps) {
      bx0 = min(bx0, c[0] - c[4], c[2] - c[5]);
      bx1 = max(bx1, c[0] + c[4], c[2] + c[5]);
      by0 = min(by0, c[1] - c[4], c[3] - c[5]);
    }
    const x0 = max(0, floor(bx0 - 1)), x1 = min(W - 1, floor(bx1 + 1)), y0 = max(0, floor(by0 - 1)), y1 = min(H - 1, floor(mound(h.x) + 2));
    // Each bone as a, b - a, 1 / |b - a|^2 and its two radii, for the
    // distance from a pixel to the bone rounded from ra to rb.
    const n = B.caps.length, K = new Float64Array(n * 7);
    B.caps.forEach((c, i) => {
      const ex = c[2] - c[0], ey = c[3] - c[1];
      K.set([c[0], c[1], ex, ey, 1 / (ex * ex + ey * ey || 1e-9), c[4], c[5] - c[4]], i * 7);
    });
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (y > surf[x] + 1) continue;
        const px = x + 0.5, py = y + 0.5;
        let d = 99;
        for (let i = 0; i < n * 7; i += 7) {
          const wx = px - K[i], wy = py - K[i + 1];
          let t = (wx * K[i + 2] + wy * K[i + 3]) * K[i + 4];
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const dx = wx - K[i + 2] * t, dy = wy - K[i + 3] * t, e = sqrt(dx * dx + dy * dy) - K[i + 5] - K[i + 6] * t;
          if (e < d) d = e;
        }
        const o = y * W + x;
        if (d < sdf[o]) sdf[o] = d;
      }
  }
  // Hands: black, with a rim of light from the grave all round. The fingers
  // are thin enough to be all rim.
  for (let o = 0; o < N; o++) {
    const d = sdf[o];
    if (d >= 0.7) continue;
    const q = o * 3;
    if (d >= 0) {
      const a = 0.55 * (1 - d / 0.7);
      for (let c = 0; c < 3; c++) rgb[q + c] = mix(rgb[q + c], rimC[c], a);
    } else {
      const rim = cl(1 + d / 1.5, 0, 1);
      for (let c = 0; c < 3; c++) rgb[q + c] = 0.015 + rimC[c] * rim * 0.8;
    }
  }
  // The heap: dark earth up to its surface, its top edge caught by the moon,
  // cracks and the ground round each arm lit from below.
  for (let x = 0; x < W; x++) {
    const ys = surf[x];
    for (let y = max(0, floor(ys)); y < GY + 1; y++) {
      const o = (y * W + x) * 3, cov = cl(y + 1 - ys, 0, 1);
      if (cov <= 0) continue;
      const depth = y + 0.5 - ys, lit = depth < 1.3 ? 0.45 * (1 - depth / 1.3) : 0;
      for (let c = 0; c < 3; c++) {
        const earth = (c === 2 ? 0.04 : c === 0 ? 0.035 : 0.022) + edgeC[c] * lit;
        rgb[o + c] = mix(rgb[o + c], earth, cov);
      }
    }
  }
  for (const h of S.hands) {
    if (h.glow <= 0.01 && h.crack <= 0.01) continue;
    const ys = mound(h.x) - h.bump;
    // Glow from the hole, throbbing, spilling up into the air and over the
    // earth.
    const R = 11 * h.s, beat = h.glow * pulse(h), gx = S.gx;
    for (let x = 0; x < W; x++) gx[x] = exp(-(((x + 0.5 - h.x) / (1.6 * R)) ** 2));
    for (let y = max(0, floor(ys - 2.6 * R)); y < min(H, ys + 2.2 * R); y++) {
      const gy = beat * exp(-(((y + 0.5 - ys) / R) ** 2));
      for (let x = 0; x < W; x++) {
        const g = gy * gx[x] * (y + 0.5 >= surf[x] ? 0.6 : 0.35), o = (y * W + x) * 3;
        rgb[o] += glowC[0] * g;
        rgb[o + 1] += glowC[1] * g;
        rgb[o + 2] += glowC[2] * g;
      }
    }
    // Cracks in the heaving earth.
    if (h.crack > 0.01)
      for (const pts of h.cracks)
        for (let k = 0; k + 1 < pts.length; k++)
          for (let n = 0; n <= 4; n++) {
            const x = floor(h.x + mix(pts[k][0], pts[k + 1][0], n / 4) * h.s), y = floor(ys + 1 + mix(pts[k][1], pts[k + 1][1], n / 4) * h.s);
            if (x < 0 || x >= W || y < 0 || y >= H || y < surf[x] + 0.5) continue;
            const o = (y * W + x) * 3, a = h.crack * (1 - 0.25 * k);
            for (let c = 0; c < 3; c++) rgb[o + c] = mix(rgb[o + c], glowC[c], a * 0.85);
          }
  }
  // Clods: black against the moon, dim earth against the night, and green
  // while they are fresh from the hole.
  for (const c of S.clods) {
    const fade = cl(c.life / 1.2, 0, 1);
    for (let y = floor(c.y - c.r); y <= floor(c.y + c.r); y++)
      for (let x = floor(c.x - c.r); x <= floor(c.x + c.r); x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const dx = x + 0.5 - c.x, dy = y + 0.5 - c.y;
        if (dx * dx + dy * dy > (c.r + 0.35) ** 2) continue;
        const o = (y * W + x) * 3, lum = max(rgb[o], rgb[o + 1], rgb[o + 2]);
        for (let ch = 0; ch < 3; ch++) {
          const col = lum > 0.3 ? 0.02 : edgeC[ch] * 0.3;
          rgb[o + ch] = mix(rgb[o + ch], mix(col, glowC[ch] * 0.8, c.hot * 0.6), fade);
        }
      }
  }
  // Ground fog rolling in front of everything, lit green where the grave
  // glows under it.
  const fog = S.fog, top = GY - 6 - 44 * fog, dens = 0.22 + 0.5 * fog, t = S.t;
  // Each lamp's light falls off as a Gaussian, so it splits into a factor per
  // column, kept here, and one per row.
  const lamps = S.hands.filter((h) => h.glow > 0.01).map((h) => {
    const r2 = (16 * h.s) ** 2, gx = new Float32Array(W);
    for (let x = 0; x < W; x++) gx[x] = exp(-((x + 0.5 - h.x) ** 2) / r2);
    return { y: mound(h.x), g: h.glow * pulse(h), r2, gx };
  });
  for (let y = max(0, floor(top)); y < H; y++) {
    const rise = sm(top, top + 12 + 10 * fog, y), p1 = y * 0.09 - t * 0.9, p2 = -y * 0.21 + t * 0.55 + 1.3;
    const s1 = sin(p1), c1 = cos(p1), s2 = sin(p2), c2 = cos(p2);
    for (const L of lamps) L.row = L.g * exp(-((y + 0.5 - L.y) ** 2) / L.r2);
    for (let x = 0; x < W; x++) {
      // sin(x k + p) as sin(x k) cos p + cos(x k) sin p, from tables.
      const n = 0.5 + 0.28 * (SX1[x] * c1 + CX1[x] * s1) + 0.22 * (SX2[x] * c2 + CX2[x] * s2);
      const a = round(16 * cl(dens * rise * n, 0, 0.85)) / 16, o = (y * W + x) * 3;
      let lit = 0;
      for (const L of lamps) lit += L.row * L.gx[x];
      lit = round(12 * min(1, lit)) / 12;
      for (let c = 0; c < 3; c++) rgb[o + c] = mix(rgb[o + c], mix(fogC[c] * 0.6, glowC[c] * 0.9, lit), a);
    }
  }
  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) display.setPixel(x, y, round(255 * cl(rgb[o * 3], 0, 1)), round(255 * cl(rgb[o * 3 + 1], 0, 1)), round(255 * cl(rgb[o * 3 + 2], 0, 1)));
}
