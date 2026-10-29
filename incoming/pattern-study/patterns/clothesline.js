// ===== Patternflow pattern =====
// Title:   Clothesline
// Family:  type
// Idea:    Four ropes sag from wall to wall down the tall panel with ten letter cards pegged on them, 바람이 / 분다 / 살아야 / 겠다, and gusts cross the panel from the left so the cards swing on their pegs one after another like pendulums and twist on the line, the ropes lift and bob under them, and every card falls back to hanging straight once the gust has gone.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 72; the text is «Le vent se lève, il faut tenter de vivre» from Paul Valéry's Le Cimetière marin (1920) in the Korean it is usually given; the mean wind from the Beaufort scale (Francis Beaufort, 1805) by v = 0.836 B^(3/2) m/s; the Hangul syllables drawn as strokes for this pattern
// Round:   72
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Wind=2..7, Gust=0..1
//
// Knob 1: Hue. The card colour, the ink always cream: sea green at 0, azure at 0.25, blue violet at 0.5, magenta at 0.75 and rose red at 1, each card a little off its neighbours. The wheel skips orange, which on a dim card reads brown.
// Knob 2: Speed. The time scale. At 2 a card left to itself swings once a second and a gust crosses the 64 columns in 1.6 s in a light breeze; at 1 everything is half as fast, at 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Wind. The mean wind in Beaufort force. At the opening 2, a light breeze of 2.4 m/s, the cards lean 7 degrees and the gusts swing them to 20 or 35 and back past straight; at 4, 6.7 m/s, they lean 45 degrees; at 7, a near gale of 15.5 m/s, they fly 79 degrees out, almost flat, and the ropes pull from a 5-LED sag to 1.
// Knob 4: Gust. Turbulence on top of the gust fronts. At 0 only the fronts, one every 1.5 to 3 s; at the opening 0.06 a little flutter; at 1 the fronts come twice as often and half as strong again, eddies throw neighbouring cards opposite ways and the cards twist round their pegs until some turn their backs, where the ink shows through mirrored.
// Buttons: K1 tap sends a strong gust across the whole line.

const W = 64, H = 128;
const { floor, round, min, max, abs, sin, cos, exp, sqrt, tanh, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The cards' syllables, drawn as strokes in an 11 by 13 box, one unit
// an LED: polylines, and ellipses [cx, cy, rx, ry] for the ㅇ. Each vowel
// stands at column 8, each initial in columns 0 to 5 beside it.
const A_ = [[[8, 0], [8, 12]], [[8, 6], [10, 6]]];
const O_ = { e: [2.5, 6, 2.5, 3.6] };
const GLYPHS = {
  바: [[[0, 1], [0, 11]], [[5, 1], [5, 11]], [[0, 6], [5, 6]], [[0, 11], [5, 11]], ...A_],
  람: [[[0, 0], [5, 0], [5, 2], [0, 2], [0, 4], [5, 4]], [[8, 0], [8, 6]], [[8, 3], [10, 3]], [[1, 8], [9, 8], [9, 12], [1, 12], [1, 8]]],
  이: [O_, [[8, 0], [8, 12]]],
  분: [[[1, 0], [1, 4]], [[9, 0], [9, 4]], [[1, 2], [9, 2]], [[1, 4], [9, 4]], [[0, 6.5], [10, 6.5]], [[5, 6.5], [5, 8.5]], [[1, 10], [1, 12], [9, 12]]],
  다: [[[5, 1], [0, 1], [0, 11], [5, 11]], ...A_],
  살: [[[2.6, 0], [0, 5]], [[2.6, 0.5], [5.2, 5]], [[8, 0], [8, 6]], [[8, 3], [10, 3]], [[1, 8], [9, 8], [9, 10], [1, 10], [1, 12], [9, 12]]],
  아: [O_, ...A_],
  야: [O_, [[8, 0], [8, 12]], [[8, 4], [10, 4]], [[8, 8], [10, 8]]],
  겠: [[[0, 0], [3.5, 0], [3.5, 5]], [[5, 3], [7, 3]], [[7, 0], [7, 6.5]], [[10, 0], [10, 7]], [[2.5, 8.5], [0.5, 12]], [[2.5, 8.5], [4.5, 12]], [[7.5, 8.5], [5.5, 12]], [[7.5, 8.5], [9.5, 12]]],
};

// Each glyph's distance field, 4 samples an LED over x -2..12 and y -2..14,
// so a card turned to any angle samples its strokes smoothly.
const FS = 4, FX0 = -2, FY0 = -2, FW = 14 * FS + 1, FH = 16 * FS + 1;
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? cl(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
  const ex = px - ax - t * dx, ey = py - ay - t * dy;
  return sqrt(ex * ex + ey * ey);
}
const FIELD = {};
for (const key in GLYPHS) {
  const F = new Float32Array(FW * FH);
  for (let j = 0; j < FH; j++)
    for (let i = 0; i < FW; i++) {
      const x = FX0 + i / FS, y = FY0 + j / FS;
      let d = 99;
      for (const s of GLYPHS[key]) {
        if (s.e) {
          const [cx, cy, rx, ry] = s.e, ux = (x - cx) / rx, uy = (y - cy) / ry, r = sqrt(ux * ux + uy * uy);
          // |r - 1| over the gradient of r: the distance to the ellipse near it.
          const gx = ux / rx, gy = uy / ry, gl = sqrt(gx * gx + gy * gy);
          d = min(d, gl > 1e-6 ? (abs(r - 1) * r) / gl : min(rx, ry));
        } else for (let k = 1; k < s.length; k++) d = min(d, segDist(x, y, s[k - 1][0], s[k - 1][1], s[k][0], s[k][1]));
      }
      F[j * FW + i] = d;
    }
  FIELD[key] = F;
}
function fieldAt(F, gx, gy) {
  const fx = (gx - FX0) * FS, fy = (gy - FY0) * FS;
  if (fx < 0 || fy < 0 || fx >= FW - 1 || fy >= FH - 1) return 99;
  const i = floor(fx), j = floor(fy), u = fx - i, v = fy - j, o = j * FW + i;
  return (F[o] * (1 - u) + F[o + 1] * u) * (1 - v) + (F[o + FW] * (1 - u) + F[o + FW + 1] * u) * v;
}

// ---- The line. Four ropes 32 rows apart, anchored at both walls with a
// 5-LED sag; the cards 16 by 18, hung from a peg at the middle of the top.
const ROPES = [
  { y: 5, cards: "바람이" },
  { y: 37, cards: "분다" },
  { y: 69, cards: "살아야" },
  { y: 101, cards: "겠다" },
];
const SAG = 5, CW = 8, CT = 1, CB = 19, GX = 5, GY = 4.5;
// A card about its peg: centre of mass 10 LEDs down, J = I / m in LED^2.
const L = (CT + CB) / 2, J = (2 * CW) ** 2 / 12 + (CB - CT) ** 2 / 12 + L * L;
// A swing of 1 s at small angles: g l / J = (2 pi)^2.
const G = (4 * PI * PI * J) / L;
// Drag: tan(lean) = 0.022 v^2 for v in m/s, and 10 LED/s to a m/s.
const Q = 10, KD = (0.022 * G) / (Q * Q);

// The rope hangs in a catenary, y = c cosh(x / c) about its lowest point:
// a 5-LED sag over the 63 columns between the hooks makes c = 99, a pull
// along the rope equal to the weight of 99 LEDs of it. A gust lifting it
// shrinks the sag in the same shape, and tips it in a sine of the span.
const CC = 99, CH = Math.cosh(31.5 / CC) - 1;
const cat = (x) => (Math.cosh(31.5 / CC) - Math.cosh((x - 31.5) / CC)) / CH;
const tip = (x) => sin((2 * PI * x) / 63);
function ropeY(r, x) {
  return r.y + (SAG - r.b1) * cat(x) - r.b2 * tip(x);
}

export function setup(params) {
  const ropes = ROPES.map((R) => {
    const n = [...R.cards].length, cards = [];
    [...R.cards].forEach((ch, i) => {
      const x = 32 + (i - (n - 1) / 2) * 20 + (Math.random() - 0.5) * 2;
      cards.push({ ch, x, th: (Math.random() - 0.5) * 0.1, w: 0, ph: 0, pw: 0, dh: (Math.random() - 0.5) * 0.08 });
    });
    return { y: R.y, cards, b1: 0, v1: 0, a1: 0, b2: 0, v2: 0, a2: 0 };
  });
  params.s = { t: 0, ropes, gusts: [], next: 0.3, ph: [0, 1, 2, 3, 4, 5].map(() => Math.random() * 2 * PI), warm: false, hue: 0, speed: 2, B: 2, V: 24, gust: 0.06, F: new Float32Array(W * H * 3) };
}

// The wind across the panel, LED/s rightward, at sim time t.
function windAt(S, x, y) {
  const V = S.V, t = S.t;
  let g = 0;
  for (const q of S.gusts) {
    const u = (x - q.x + 0.18 * (y - 64)) / q.s, v = (y - q.yc) / 90;
    g += q.a * exp(-u * u - v * v);
  }
  const P = S.ph, k = S.gust;
  // Turbulence: four drifting waves of different sizes.
  const tu =
    0.45 * sin(0.21 * (x - 0.8 * V * t) + 0.05 * y + P[0]) +
    0.3 * sin(0.37 * (x - 0.8 * V * t) - 0.11 * y + 2.3 * t + P[1]) +
    0.25 * sin(0.6 * x - 0.17 * y - 3.7 * t + P[2]) +
    0.2 * sin(0.09 * y + 1.3 * t + P[3]);
  return V * (1 + g + 1.6 * k * tu);
}

function step(S, h) {
  S.t += h;
  const V = S.V, k = S.gust;
  // Gust fronts: born left of the panel every 1.5 to 3 s (twice as often at
  // Gust 1), crossing at 0.9 V + 20 LED/s.
  S.next -= h;
  if (S.next <= 0) {
    S.next = (1.5 + Math.random() * 1.5) / (1 + k);
    S.gusts.push({ x: -25, s: 8 + Math.random() * 5, a: (0.7 + Math.random() * 0.6) * (1 + 0.5 * k), yc: Math.random() * 128, c: 0.9 * V + 20 });
  }
  for (const q of S.gusts) q.x += q.c * h;
  S.gusts = S.gusts.filter((q) => q.x < 110);
  for (const r of S.ropes) {
    // The wind on its cards lifts the rope (the first mode) and tips it
    // toward the side the gust has reached (the second); 0.9 and 1.6 Hz.
    let l1 = 0, l2 = 0;
    for (const c of r.cards) {
      const py = ropeY(r, c.x), w = windAt(S, c.x, py + L);
      c.wv = w;
      c.wd = windAt(S, c.x + 6, py + L) - windAt(S, c.x - 6, py + L);
      const f = (w * w) / (Q * Q) / 100;
      l1 += f * cat(c.x);
      l2 += f * tip(c.x);
    }
    const w1 = 2 * PI * 0.9, w2 = 2 * PI * 1.6;
    r.a1 = -w1 * w1 * r.b1 - 0.5 * w1 * r.v1 + w1 * w1 * 4 * tanh(l1);
    r.a2 = -w2 * w2 * r.b2 - 0.5 * w2 * r.v2 + w2 * w2 * 1.5 * tanh(l2 - 0.3 * l1);
    r.v1 += r.a1 * h;
    r.v2 += r.a2 * h;
    r.b1 = min(SAG * 0.85, r.b1 + r.v1 * h);
    r.b2 += r.v2 * h;
    for (const c of r.cards) {
      // The peg's own acceleration, down, changes the gravity the card feels.
      const ay = -r.a1 * cat(c.x) - r.a2 * tip(c.x);
      const ct = cos(c.th), st = sin(c.th), rel = c.wv - 0.5 * L * ct * c.w, F = KD * rel * abs(rel);
      const acc = ((-(G - ay) * st + F * ct) * L) / J - 0.3 * c.w;
      c.w += acc * h;
      c.th += c.w * h;
      // Twist about the peg: a gust front reaching one edge of the card
      // before the other turns it, and a spring brings it back.
      const target = cl(((0.5 * c.wd) / max(V, 1)) * (0.3 + 1.6 * k) * (0.7 + 0.08 * S.B) + c.dh, -1.5, 1.5);
      c.pw += (16 * (target - c.ph) - 1.4 * c.pw) * h;
      c.ph += c.pw * h;
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 2, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kn[0] || 0;
  S.speed = cl(kn[1], 0.2, 3);
  S.B = cl(kn[2], 2, 7);
  S.gust = cl(kn[3], 0, 1);
  // Beaufort: v = 0.836 B^1.5 m/s.
  S.V = 0.836 * S.B ** 1.5 * Q;
  let T = d * (S.speed / 2);
  if (input.btnPressed && input.btnPressed[0]) S.gusts.push({ x: -25, s: 12, a: 2.4, yc: 64, c: 0.9 * S.V + 20 });
  // Start with the line already in the wind, 2.5 s in.
  if (!S.warm) (S.warm = true), (T += 2.5);
  const n = max(1, Math.ceil(T / (1 / 240)));
  for (let i = 0; i < n; i++) step(S, T / n);
}

// ---- Drawing.
const BG0 = [5, 7, 16], BG1 = [2, 3, 8];
function blend(F, x, y, a, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3;
  F[o] += (r - F[o]) * a;
  F[o + 1] += (g - F[o + 1]) * a;
  F[o + 2] += (b - F[o + 2]) * a;
}

function drawCard(S, F, r, c, ci) {
  const px = c.x, py = ropeY(r, c.x), th = c.th, ct = cos(th), st = sin(th);
  const cp = cos(c.ph), sx = max(0.06, abs(cp)), back = cp < 0;
  // The knob runs the cards from sea green through azure and violet to rose,
  // past the oranges, which a dim card turns brown.
  const hue = 0.42 + 0.56 * S.hue + ((ci * 0.37) % 1 - 0.5) * 0.07;
  const card = hsv(hue, 0.78, back ? 0.3 : 0.5), ink = [1, 0.96, 0.86];
  // Light from the upper left: a card turned away from it dims.
  const lit = 0.55 + 0.45 * sx + 0.12 * st;
  const Fg = FIELD[c.ch];
  // Bounding box of the turned card and its peg.
  let x0 = 99, x1 = -99, y0 = 99, y1 = -99;
  for (const [u, v] of [[-CW, -3], [CW, -3], [-CW, CB], [CW, CB]]) {
    const X = px + u * sx * ct + v * st, Y = py - u * sx * st + v * ct;
    x0 = min(x0, X);
    x1 = max(x1, X);
    y0 = min(y0, Y);
    y1 = max(y1, Y);
  }
  for (let Y = max(0, floor(y0) - 1); Y <= min(H - 1, Math.ceil(y1) + 1); Y++)
    for (let X = max(0, floor(x0) - 1); X <= min(W - 1, Math.ceil(x1) + 1); X++) {
      const dx = X - px, dy = Y - py, us = dx * ct - dy * st, v = dx * st + dy * ct;
      // Coverage of the card, its edges antialiased in LEDs on the panel.
      const cov = cl(CW * sx - abs(us) + 0.5, 0, 1) * cl(min(v - CT, CB - v) + 0.5, 0, 1);
      if (cov > 0) {
        const u = (back ? -us : us) / sx;
        const dd = fieldAt(Fg, u + GX, v - GY);
        // Ink: strokes 1.3 LEDs wide, faint and mirrored through the paper
        // from behind.
        const ik = cl(0.65 + 0.5 - dd * (0.6 + 0.4 * sx), 0, 1) * (back ? 0.18 : 1);
        const shade = lit * (1 - 0.18 * max(0, (v - 12) / 7));
        blend(F, X, Y, cov, (card[0] + (ink[0] - card[0]) * ik) * shade, (card[1] + (ink[1] - card[1]) * ik) * shade, (card[2] + (ink[2] - card[2]) * ik) * shade);
      }
      // The peg: a pale wooden clip 2.4 LEDs wide over the rope.
      const pc = cl(1.2 - abs(us) + 0.5, 0, 1) * cl(min(v + 2.6, 3 - v) + 0.5, 0, 1);
      if (pc > 0) blend(F, X, Y, pc, 0.82, 0.72, 0.55);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const F = S.F;
  for (let y = 0, o = 0; y < H; y++) {
    const f = y / (H - 1);
    for (let x = 0; x < W; x++, o += 3) {
      F[o] = (BG0[0] + (BG1[0] - BG0[0]) * f) / 255;
      F[o + 1] = (BG0[1] + (BG1[1] - BG0[1]) * f) / 255;
      F[o + 2] = (BG0[2] + (BG1[2] - BG0[2]) * f) / 255;
    }
  }
  let ci = 0;
  for (const r of S.ropes) {
    // The rope, one LED thick, shared between the two rows it falls across.
    for (let x = 0; x < W; x++) {
      const y = ropeY(r, x), iy = floor(y), f = y - iy;
      blend(F, x, iy, 1 - f, 0.55, 0.5, 0.42);
      blend(F, x, iy + 1, f, 0.55, 0.5, 0.42);
    }
    // Hooks in the walls.
    blend(F, 0, r.y - 1, 1, 0.7, 0.7, 0.72);
    blend(F, 63, r.y - 1, 1, 0.7, 0.7, 0.72);
    for (const c of r.cards) drawCard(S, F, r, c, ci++);
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, round(cl(F[o], 0, 1) * 255), round(cl(F[o + 1], 0, 1) * 255), round(cl(F[o + 2], 0, 1) * 255));
}
