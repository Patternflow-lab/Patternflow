// ===== Patternflow pattern =====
// Title:   Crystal Ball
// Family:  halloween
// Idea:    A big crystal ball sits on a small brass stand in a dark room, purple and toxic green smoke rising up its middle and spiralling down its sides, and now and then the smoke gathers into a vision, a grinning skull, a staring eye or a crescent moon, holds it for a second or two and lets it go back into the swirl.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 44
// Round:   44
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Smoke=0..1, Visions=0..1
//
// Knob 1: Hue. The two smokes' colours, kept out of red, orange and yellow, which turn brown when smoke thins. At 0 purple and toxic green, at 0.25 indigo and sea green, at 0.5 magenta and sky blue, at 0.75 crimson and blue violet, at 1 cyan and pink; the glass takes a dark shade of the first, visions stay bone white.
// Knob 2: Speed. At 2 the smoke rises up the middle of the ball at 14 LEDs a second and sinks down the sides, the whole swirl turning once in 3.9 s; a vision gathers in 1.4 s and lets go over 1.6 s. At 0.2 all of it is ten times slower, at 3 half as fast again.
// Knob 3: Smoke. How much smoke: 700 chunks at 0, 1500 at 1, each living 4.5 to 8 s from one of two wells low in the glass, one for each colour, turning slowly round the middle.
// Knob 4: Visions. How often a vision comes and how much of the smoke goes into it. At 0.06 the first comes at 2 s and takes 62% of the smoke, holds 1.5 s, and the next comes 12.4 s after one has gone; at 1 the first comes at 0.4 s and takes all of it, holds 2.6 s, and the next comes after 3 s. They come as a grinning skull with a chattering jaw, a slit-pupilled eye that blinks once, and a crescent moon, then in any order.
// Buttons: any tap calls the next vision at once when none is showing.

const W = 64, H = 128, CX = 32, CY = 60, R = 28, RIN = 25.5, GW = 32, GH = 64;
const { floor, round, min, max, abs, sqrt, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (v) => v * v * (3 - 2 * v);
const MAXN = 1500;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const r = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  const g = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  const b = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return [round(r * 63) * 4, round(g * 63) * 4, round(b * 63) * 4];
}

// The visions, in u, v from -1 to 1 (v down), 20 LEDs to a unit, tested
// at the middle of each 2x2 cell. Each returns 0 outside, else the colour
// class: 1 the first smoke, 2 the second, 3 bone. The skull is drawn by
// hand, one character to a cell.
const SKULL = [
  "......######......",
  "...############...",
  "..##############..",
  ".################.",
  ".################.",
  "##################",
  "##################",
  "##.....####.....##",
  "#......####......#",
  "#......####......#",
  "##.....####.....##",
  "###...######...###",
  ".#######..#######.",
  "..######..######..",
  "...############...",
  "...#.##.##.##.#...",
  "....##########....",
  ".....########.....",
];
function skull(u, v) {
  const c = floor(u * 10 + 9), r = floor(v * 10 + 9);
  return r >= 0 && r < SKULL.length && c >= 0 && c < 18 && SKULL[r][c] === "#" ? 3 : 0;
}
function eye(u, v) {
  const lid = 0.5 * (1 - u * u) ** 0.9;
  if (abs(u) >= 1 || abs(v) > lid + 0.1) return 0;
  if (abs(v) > lid) return 1;
  // A slit pupil in a green iris.
  if (u * u + v * v < 0.38 ** 2) return abs(u) < 0.06 && abs(v) < 0.32 ? 0 : 2;
  return 3;
}
function moon(u, v) {
  if (u * u + v * v > 0.82 ** 2) return 0;
  return (u - 0.42) ** 2 + (v + 0.2) ** 2 < 0.64 ** 2 ? 0 : 3;
}
const SHAPES = [skull, eye, moon];
// Which layer a vision's colour class draws in: lids, iris, bone.
const LAYER = [0, 3, 4, 2];

// The two smoke hues along Hue, kept out of red, orange and yellow, which
// go brown when the smoke thins.
const STOPS = [[0.78, 0.33], [0.66, 0.46], [0.88, 0.55], [0.95, 0.7], [0.55, 0.9]];
function smokeHues(k) {
  const f = cl(k, 0, 1) * 4, i = min(3, floor(f)), u = f - i;
  return [0, 1].map((j) => STOPS[i][j] + (STOPS[i + 1][j] - STOPS[i][j]) * u);
}

// Targets on the 2-LED lattice the smoke is drawn on, so a vision's cells
// tile it edge to edge: [x, y, class] relative to the ball's middle.
function targets(shape) {
  const cells = [];
  for (let j = -24; j < 24; j += 2)
    for (let i = -24; i < 24; i += 2) {
      const a = shape((i + 1) / 20, (j + 1) / 20);
      if (a) cells.push(i, j, a);
    }
  return cells;
}

export function setup(params) {
  const P = {
    hue: 0, speed: 1, smoke: 0, rate: 0.06, share: 0.62, n: 0, t: 0, warm: false,
    x: new Float32Array(MAXN), y: new Float32Array(MAXN), z: new Float32Array(MAXN),
    age: new Float32Array(MAXN), life: new Float32Array(MAXN), sp: new Uint8Array(MAXN), lag: new Float32Array(MAXN),
    slot: new Uint16Array(MAXN),
    shapes: SHAPES.map(targets), vis: -1, vt: 0, next: 2, order: 0, glow: 0,
    vc: 0, sparks: [], cw: [0, 1, 2, 3, 4].map(() => new Float32Array(GW * GH)), tmp: new Float32Array(GW * GH),
  };
  for (let i = 0; i < MAXN; i++) {
    P.sp[i] = Math.random() < 0.55 ? 1 : 2;
    P.lag[i] = Math.random();
    P.slot[i] = floor(Math.random() * 65536);
    spawn(P, i, Math.random());
  }
  params.s = P;
}

// A particle starts at one of two wells low in the ball, the purple one and
// the green one across from it, both turning slowly round the middle.
function spawn(P, i, age) {
  const a = P.t * 0.35 + (P.sp[i] === 1 ? 0 : PI) + (Math.random() - 0.5) * 1.2, rr = (0.3 + 0.4 * Math.random()) * RIN;
  P.x[i] = rr * cos(a);
  P.z[i] = rr * sin(a);
  P.y[i] = (0.4 + 0.3 * Math.random()) * RIN;
  P.life[i] = 4.5 + 3.5 * Math.random();
  P.age[i] = age * P.life[i];
}

// The flow inside the glass: a turn about the upright axis, a ring vortex
// rising up the middle and sinking down the sides (Hill's vortex, which
// never crosses the glass), and an ABC flow drifting in phase for the curls.
function step(P, d) {
  const t = P.t, om = 1.6, C = 14, Rq = RIN * RIN, k = 0.16;
  const p1 = t * 0.7, p2 = t * 0.53 + 2, p3 = t * 0.47 + 4;
  const s = P.vis >= 0 ? 1 - 0.7 * P.glow : 1;
  for (let i = 0; i < P.n; i++) {
    let x = P.x[i], y = P.y[i], z = P.z[i];
    const vx = -om * z - (C * x * y) / Rq + 8 * sin(k * z + p1) + 6 * cos(k * y + p2);
    const vz = om * x - (C * z * y) / Rq + 8 * cos(k * x + p3) + 6 * sin(k * y + p1);
    const vy = -C * (1 - (2 * (x * x + z * z) + y * y) / Rq) + 6 * sin(k * x + p2) + 8 * cos(k * z + p3);
    x += vx * d;
    y += vy * d;
    z += vz * d;
    const r = sqrt(x * x + y * y + z * z);
    if (r > RIN) {
      const f = RIN / r;
      x *= f;
      y *= f;
      z *= f;
    }
    P.x[i] = x;
    P.y[i] = y;
    P.z[i] = z;
    P.age[i] += d * s;
    if (P.age[i] > P.life[i]) spawn(P, i, 0);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3) / 2;
  P.smoke = cl(k[2], 0, 1);
  P.rate = cl(k[3], 0, 1);
  P.share = 0.6 + 0.4 * P.rate;
  P.n = round(700 + 800 * P.smoke);
  const real = cl(dt || 0, 0, 0.1), d = real * P.speed;
  if (!P.warm) {
    // Let the smoke fill the ball before the first frame.
    P.warm = true;
    for (let i = 0; i < 120; i++) {
      P.t += 0.05;
      step(P, 0.05);
    }
  }
  P.t += d;
  P.vc += d;
  step(P, d);

  // Visions: gather 1.4 s, hold 1.4 to 2.6 s, let go over 1.6 s. The
  // smoke ages slower while it is held.
  const press = input.btnPressed && (input.btnPressed[0] || input.btnPressed[1] || input.btnPressed[2] || input.btnPressed[3]);
  if (P.order === 0) P.next = 2.1 - 1.7 * P.rate;
  if (P.vis < 0 && (P.vc >= P.next || press)) {
    P.vis = P.order < 3 ? P.order : floor(Math.random() * 3);
    P.order++;
    P.vt = 0;
    const cells = P.shapes[P.vis], m = cells.length / 3;
    // The particles that join take the cells in turn, so every cell gets
    // one before any gets two.
    const idx = [];
    for (let i = 0; i < P.n; i++) idx.push(i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    let q = 0;
    for (const i of idx) if (P.lag[i] < P.share) P.slot[i] = q++ % m;
  }
  if (P.vis >= 0) {
    P.vt += d;
    const hold = 1.4 + 1.2 * P.rate, end = 1.4 + hold + 1.6;
    P.glow = P.vt < 1.4 ? ease(P.vt / 1.4) : P.vt < 1.4 + hold ? 1 : 1 - ease(cl((P.vt - 1.4 - hold) / 1.6, 0, 1));
    if (P.vt > 1.4 && P.vt - d <= 1.4)
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * 2 * PI;
        P.sparks.push({ x: CX + R * cos(a), y: CY + R * sin(a), vx: cos(a) * 8, vy: sin(a) * 8 - 6, life: 0.8 + 0.8 * Math.random(), g: 1 });
      }
    if (P.vt > end) {
      P.vis = -1;
      P.glow = 0;
      P.next = P.vc + 13 - 10 * P.rate;
    }
  }

  // Sparks leave the top of the glass and drift up.
  if (Math.random() < 8 * d) {
    const a = -PI / 2 + (Math.random() - 0.5) * 2.4;
    P.sparks.push({ x: CX + (R + 1) * cos(a), y: CY + (R + 1) * sin(a), vx: (Math.random() - 0.5) * 3, vy: -5 - 5 * Math.random(), life: 1 + Math.random(), g: Math.random() < 0.5 ? 1 : 0 });
  }
  for (const s of P.sparks) {
    s.x += s.vx * d;
    s.y += s.vy * d;
    s.vx += sin(s.y * 0.3 + P.t * 3) * 6 * d;
    s.life -= d;
  }
  P.sparks = P.sparks.filter((s) => s.life > 0 && s.y > -1);
}

// Blur one coarse layer with a 1-2-1 kernel each way.
function blur(a, tmp) {
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const p = y * GW + x;
      tmp[p] = (2 * a[p] + (x > 0 ? a[p - 1] : 0) + (x < GW - 1 ? a[p + 1] : 0)) / 4;
    }
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const p = y * GW + x;
      a[p] = (2 * tmp[p] + (y > 0 ? tmp[p - GW] : 0) + (y < GH - 1 ? tmp[p + GW] : 0)) / 4;
    }
}

const put = (display, x, y, c) => {
  if (x >= 0 && x < W && y >= 0 && y < H) display.setPixel(x, y, c[0], c[1], c[2]);
};

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.warm) return;
  const cw = P.cw;
  const vis = P.vis, cells = vis >= 0 ? P.shapes[vis] : null, G = P.glow;
  // Smoke on 2x2-LED cells. A vision takes a share of the particles that
  // grows with Visions; each comes a little earlier or later than the next.
  const share = P.share;
  // Held, a vision bobs a cell up and down; the skull's jaw chatters and the
  // eye blinks once.
  const vt = P.vt - 1.4, hold = 1.4 + 1.2 * P.rate;
  const bob = 2 * round(sin(P.vt * 4)), jaw = vt > 0 && sin(vt * 14) > 0.2 ? 2 : 0;
  const blink = vt > 0 ? max(0, 1 - abs(vt - hold * 0.6) / 0.18) : 0;
  for (const c of P.cw) c.fill(0);
  const raw = [];
  for (let i = 0; i < P.n; i++) {
    let x = P.x[i], y = P.y[i];
    const a = P.age[i] / P.life[i];
    let w = (0.55 + 0.45 * cl((P.z[i] / RIN + 1) / 2, 0, 1)) * min(1, a / 0.12, (1 - a) / 0.3);
    let cls = P.sp[i] - 1;
    if (cells && P.lag[i] >= share) w *= 1 - 0.5 * G;
    if (cells && P.lag[i] < share) {
      const s = ease(cl(G * 1.5 - (0.5 * P.lag[i]) / share, 0, 1));
      if (s > 0) {
        const c = (P.slot[i] % (cells.length / 3)) * 3;
        let ty = cells[c + 1];
        if (vis === 0 && ty >= 10) ty += jaw;
        if (vis === 1) ty = 2 * round((ty * (1 - blink)) / 2);
        x += (cells[c] + 1 - x) * s;
        y += (ty + bob + 1 - y) * s;
        w += (1.4 - w) * s;
        if (s > 0.5) cls = LAYER[cells[c + 2]];
      }
    }
    const gx = floor((CX + x) / 2), gy = floor((CY + y) / 2);
    if (gx >= 0 && gx < GW && gy >= 0 && gy < GH) cw[cls][gy * GW + gx] += w;
  }
  // The free smoke is blurred into soft blobs; a vision stands sharp.
  for (let k = 0; k < 5; k++) {
    const c = cw[k];
    if (G > 0) raw[k] = c.slice();
    blur(c, P.tmp);
    if (G > 0) for (let p = 0; p < c.length; p++) c[p] += (raw[k][p] - c[p]) * G;
  }
  // Colours: the two smokes in four levels, bone for visions; a vision's
  // lids and iris stay saturated.
  const [hA, hB] = smokeHues(P.hue);
  const PUR = [hsv(hA, 0.85, 0.36), hsv(hA, 0.82, 0.6), hsv(hA + 0.01, 0.66, 0.84), hsv(hA + 0.02, 0.36, 1)];
  const GRN = [hsv(hB, 0.9, 0.36), hsv(hB - 0.01, 0.9, 0.6), hsv(hB - 0.03, 0.78, 0.86), hsv(hB - 0.05, 0.4, 1)];
  const BONE = [hsv(hB, 0.3, 0.4), hsv(hB, 0.25, 0.65), hsv(hB - 0.02, 0.18, 0.88), [244, 255, 232]];
  const PAL = [PUR, GRN, BONE, [PUR[0], PUR[1], PUR[2], PUR[2]], [GRN[0], GRN[1], GRN[2], GRN[2]]];
  const GLASS = hsv(hA - 0.03, 0.75, 0.12), RIM = hsv(hA - 0.04, 0.5, 0.36);
  let sumP = 0, sumG = 0;

  // The ball.
  for (let y = CY - R - 1; y <= CY + R + 1; y++)
    for (let x = CX - R - 1; x <= CX + R + 1; x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, r = sqrt(dx * dx + dy * dy);
      if (r > R + 0.5) continue;
      if (r > R - 0.6) {
        put(display, x, y, RIM);
        continue;
      }
      const p = (y >> 1) * GW + (x >> 1);
      let w = 0, top = 0, best = 0;
      for (let k = 0; k < 5; k++) {
        const v = cw[k][p];
        w += v;
        if (v > best) (best = v), (top = k);
      }
      sumP += cw[0][p];
      sumG += cw[1][p];
      let col = GLASS;
      if (w >= 0.3) col = PAL[top][w < 0.75 ? 0 : w < 1.4 ? 1 : w < 2.3 ? 2 : 3];
      put(display, x, y, col);
    }
  // The highlight: an arc high on the left and a small glint.
  for (let y = CY - R; y < CY; y++)
    for (let x = CX - R; x < CX; x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, r = sqrt(dx * dx + dy * dy), an = Math.atan2(dy, dx);
      if (r > R - 4.6 && r < R - 2.4 && an > -2.75 && an < -1.95) display.setPixel(x, y, 200, 196, 228);
    }
  for (const [x, y] of [[13, 44], [14, 44], [13, 45], [16, 41]]) display.setPixel(x, y, 236, 236, 252);

  // Light under the ball: the smoke's colour, brighter in a vision.
  const gmix = sumG / max(1e-6, sumP + sumG), lit = 0.55 + 0.45 * G;
  const tint = hsv(gmix > 0.5 ? hB : hA, 0.75, 1);
  // The table: a pool of light in three rings, then the stand on it.
  for (let y = 100; y < 118; y++)
    for (let x = 0; x < W; x++) {
      const e = ((x + 0.5 - CX) / 30) ** 2 + ((y + 0.5 - 104) / 7) ** 2;
      if (e >= 1) continue;
      const v = lit * (e < 0.25 ? 0.5 : e < 0.6 ? 0.32 : 0.18);
      put(display, x, y, [round((tint[0] * v) / 4) * 4, round((tint[1] * v) / 4) * 4, round((tint[2] * v) / 4) * 4]);
    }
  drawStand(display, G);

  // A faint ring round the glass while a vision holds.
  if (G > 0.3)
    for (let a = 0; a < 2 * PI; a += 0.02) {
      const c = G > 0.8 ? BONE[1] : PUR[0];
      put(display, floor(CX + (R + 2) * cos(a)), floor(CY + (R + 2) * sin(a)), c);
    }
  for (const s of P.sparks) {
    const c = s.life < 0.3 ? (s.g ? GRN[1] : PUR[1]) : s.g ? GRN[3] : PUR[3];
    put(display, floor(s.x), floor(s.y), c);
  }
}

// The brass stand: a cup round the bottom of the glass, a neck and a foot,
// lit from the left in three tones, its top edge catching the ball's light.
const BRASS = [[244, 204, 96], [184, 128, 40], [112, 72, 24]];
function drawStand(display) {
  const rows = [];
  for (let y = 80; y <= 91; y++) rows.push([y, 19 - ((y - 80) * 7) / 11]);
  for (let y = 92; y <= 95; y++) rows.push([y, 6]);
  for (let y = 96; y <= 103; y++) rows.push([y, y === 96 ? 8 : 10 + ((y - 97) * 7) / 6]);
  for (const [y, hw] of rows) {
    const x0 = round(CX - hw), x1 = round(CX + hw);
    for (let x = x0; x < x1; x++) {
      const u = (x + 0.5 - CX) / hw;
      let t = u < -0.35 ? 0 : u < 0.45 ? 1 : 2;
      if (y === 80 || y === 92 || y === 97) t = max(0, t - 1);
      if (y === 91 || y === 95 || y === 103) t = 2;
      put(display, x, y, BRASS[t]);
    }
  }
}
