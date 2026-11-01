// ===== Patternflow pattern =====
// Title:   Coffee Ring Letters
// Family:  type
// Idea:    A three-letter word stacked down the panel is poured as puddles of a liquid full of dark grains, each puddle's edge stays pinned while it dries, the liquid lost fastest at the edge is made up by an outward flow that carries the grains to the rim, and as the sheen shrinks back to the strokes' spines the word is left as dark-rimmed outlines with faint interiors, WET, DRY, RIM and SET in turn.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the coffee-ring effect (Robert Deegan, Olgica Bakajin, Todd Dupont, Greb Huber, Sidney Nagel and Thomas Witten, 1997), its reversal by Marangoni flow (Hailong Hu and Ronald Larson, 2006), its suppression by elongated particles (Peter Yunker, Tim Still, Matthew Lohr and Arjun Yodh, 2011), letters drawn for this pattern as round-ended strokes, pattern round 83
// Round:   83
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Marangoni=0..1, Shape=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the ground is a pale warm grey, the liquid a light azure and the grains deep indigo.
// Knob 2: Speed. How fast a word goes round. At the opening 2 it pours in 0.8 s, dries in 6.5 s, stands 2.6 s and clears in 1 s, a word every 10.9 s; at 0.2 a word every 109 s and at 3 every 7.3 s.
// Knob 3: Marangoni. A flow along the liquid's surface that pulls the grains back towards each stroke's spine. At 0 none, and the grains go to the rim. At 0.25 the grains in the inner half of a stroke turn back, so a ring and a spine line both form; at 1 the outward flow wins only in the last 1.5% before the edge and the word dries as thin centre lines.
// Knob 4: Shape. The grains' length over their width, 1 at 0 to 4 at 1. Longer grains catch on the liquid's surface and come down where they are caught, so the ring fades into an evenly filled letter; past about 1.5 they are drawn as two-LED dashes.

// Deegan and his colleagues found why a spilled drop of coffee dries to a
// dark ring. The drop's edge is pinned, and evaporation is fastest at the
// edge, so to keep the edge where it is liquid has to flow out from the
// middle to replace what the edge loses, and it carries what floats in it.
//
// Each stroke is treated as a long thin drop of half-width r. With s the
// distance from the stroke's spine over r, the height is H (1 - s^2), H
// falling evenly to 0 over the drying time, and evaporation goes as
// J0 / sqrt(1 - s^2), the edge singularity of a thin drop. Mass balance
// across the stroke gives J0 = 4 / (3 pi) times the rate H falls, and the
// depth-averaged outward speed
//
//   v(s) = r E [ s - s^3/3 - (4 / 3 pi) asin s ] / (H (1 - s^2)),
//
// E the rate at which H falls. It grows without bound towards the edge and
// as H runs out, so the last grains rush to the rim just before the
// liquid is gone. A grain stops at the edge, or against grains already
// packed there, so the ring grows inwards. A few grains stick to the
// ground on the way, and the few that start right on a spine are still
// short of the rim when the liquid is gone: they are the faint interior.
//
// Hu and Larson showed that a surface-tension gradient along the surface
// of a drying drop sets up a circulation that brings the grains back to the
// middle: here an inward speed in s, which only the diverging flow at the
// very edge can beat. Yunker and his colleagues showed that elongated
// grains catch on the liquid's surface, where they jam into a loose skin
// and come down where they are: here a capture rate that grows as the
// square of the length over width minus one.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, sqrt, cos, sin, exp, asin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Stroke half-width, letter height, gap, first row, letter box across.
const RAD = 5, LH = 38, GAP = 4, TOP0 = 3, X0 = 7, X1 = 57;
// Word timeline in seconds at Speed 2.
const POUR = 0.8, DRY = 6.5, STAND = 2.6, CLEAR = 1;
// Grains per LED of liquid, where a grain stops at the edge, grains an LED
// holds before the next one stops short of it, and the height at which
// the last liquid is gone.
const DENS = 0.65, SSTOP = 1 - 0.45 / RAD, PACK = 3, HEND = 0.01;
// Inward Marangoni speed at full knob, the base sticking rate, Brownian
// spread (LED^2 per second) and the capture rate of a 2:1 grain.
const MAR = 2.5, STICK = 0.012, BROWN = 0.12, CAPT = 0.5;
const HUE0 = 0.55;

const GLYPHS = {
  W: [[0, 0, 0.22, 1], [0.22, 1, 0.5, 0.38], [0.5, 0.38, 0.78, 1], [0.78, 1, 1, 0]],
  E: [[0, 0, 0, 1], [0, 0, 1, 0], [0, 0.5, 0.85, 0.5], [0, 1, 1, 1]],
  T: [[0, 0, 1, 0], [0.5, 0, 0.5, 1]],
  D: [[0, 0, 0, 1], [0, 0, 0.45, 0], [0, 1, 0.45, 1], ["a", 0.45, 0.5, 0.55, 0.5, -90, 90]],
  R: [[0, 1, 0, 0], [0, 0, 0.55, 0], ["a", 0.55, 0.26, 0.45, 0.26, -90, 90], [0.55, 0.52, 0, 0.52], [0.45, 0.52, 1, 1]],
  Y: [[0, 0, 0.5, 0.5], [1, 0, 0.5, 0.5], [0.5, 0.5, 0.5, 1]],
  I: [[0.2, 0, 0.8, 0], [0.5, 0, 0.5, 1], [0.2, 1, 0.8, 1]],
  M: [[0, 1, 0, 0], [0, 0, 0.5, 0.62], [0.5, 0.62, 1, 0], [1, 0, 1, 1]],
  S: [["a", 0.5, 0.26, 0.5, 0.26, -20, -270], ["a", 0.5, 0.74, 0.5, 0.26, -90, 160]],
};
const WORDS = ["WET", "DRY", "RIM", "SET"];
const MAXG = 4000;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// Letter k's strokes as panel segments [x0, y0, x1, y1].
function strokes(ch, k) {
  const segs = [];
  const top = TOP0 + k * (LH + GAP) + RAD, bot = TOP0 + k * (LH + GAP) + LH - RAD;
  const px = (u) => X0 + RAD + (X1 - X0 - 2 * RAD) * u, py = (v) => top + (bot - top) * v;
  for (const s of GLYPHS[ch]) {
    if (s[0] === "a") {
      const [, cx, cy, rx, ry, a0, a1] = s, n = 14;
      for (let j = 0; j < n; j++) {
        const t0 = ((a0 + ((a1 - a0) * j) / n) * PI) / 180, t1 = ((a0 + ((a1 - a0) * (j + 1)) / n) * PI) / 180;
        segs.push([px(cx + rx * cos(t0)), py(cy + ry * sin(t0)), px(cx + rx * cos(t1)), py(cy + ry * sin(t1))]);
      }
    } else segs.push([px(s[0]), py(s[1]), px(s[2]), py(s[3])]);
  }
  return segs;
}

// Distance to the nearest spine over RAD, and the outward unit normal,
// written into o = [s, nx, ny].
function near(segs, x, y, o) {
  let best = 1e9, bx = 0, by = 0;
  for (const s of segs) {
    const dx = s[2] - s[0], dy = s[3] - s[1], l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? cl(((x - s[0]) * dx + (y - s[1]) * dy) / l2, 0, 1) : 0;
    const ex = x - s[0] - t * dx, ey = y - s[1] - t * dy, d2 = ex * ex + ey * ey;
    if (d2 < best) {
      best = d2;
      bx = ex;
      by = ey;
    }
  }
  const d = sqrt(best);
  o[0] = d / RAD;
  o[1] = d > 1e-6 ? bx / d : 0;
  o[2] = d > 1e-6 ? by / d : 0;
  return o;
}

// The outward speed's shape, the bracket over (1 - s^2).
function flow(s) {
  s = min(s, 0.999);
  return (s - (s * s * s) / 3 - (4 / (3 * PI)) * asin(s)) / (1 - s * s);
}

export function setup(params) {
  const S = (params.s = {
    hue: 0, speed: 2, mar: 0, shape: 0.06, tau: 0, word: -1, next: 0,
    segs: [], let: new Int8Array(N), sig: new Float32Array(N), nx: new Float32Array(N), ny: new Float32Array(N),
    gx: new Float32Array(MAXG), gy: new Float32Array(MAXG), gs: new Float32Array(MAXG), ga: new Float32Array(MAXG),
    gk: new Uint8Array(MAXG), st: new Uint8Array(MAXG), long: new Uint8Array(MAXG), ng: 0,
    dep: new Float32Array(N), mov: new Float32Array(N), paper: new Float32Array(N * 2),
    o: [0, 0, 0], c: [0, 0, 0], cg: [0, 0, 0], cq: [0, 0, 0],
  });
  for (let i = 0; i < N * 2; i++) S.paper[i] = Math.random();
  pour(S);
}

// Lay out the next word: every LED's letter, distance and normal, and the
// grains spread evenly through the letters.
function pour(S) {
  S.word = S.next;
  S.next = (S.next + 1) % WORDS.length;
  S.tau = 0;
  const word = WORDS[S.word], o = S.o;
  S.segs = [];
  for (let k = 0; k < word.length; k++) S.segs.push(strokes(word[k], k));
  S.let.fill(-1);
  for (let k = 0; k < word.length; k++) {
    const y0 = TOP0 + k * (LH + GAP), y1 = y0 + LH;
    for (let y = max(0, y0 - 1); y < min(H, y1 + 1); y++)
      for (let x = 0; x < W; x++) {
        near(S.segs[k], x + 0.5, y + 0.5, o);
        if (o[0] < 1) {
          const i = y * W + x;
          S.let[i] = k;
          S.sig[i] = o[0];
          S.nx[i] = o[1];
          S.ny[i] = o[2];
        }
      }
  }
  let area = 0;
  for (let i = 0; i < N; i++) if (S.let[i] >= 0) area++;
  const want = min(MAXG, round(area * DENS));
  let n = 0;
  for (let tries = 0; n < want && tries < want * 20; tries++) {
    const x = Math.random() * W, y = Math.random() * H, i = floor(y) * W + floor(x), k = S.let[i];
    if (k < 0) continue;
    near(S.segs[k], x, y, o);
    if (o[0] >= SSTOP) continue;
    S.gx[n] = x;
    S.gy[n] = y;
    S.gs[n] = o[0];
    S.gk[n] = k;
    S.ga[n] = Math.random() * PI;
    S.st[n] = 0;
    n++;
  }
  S.ng = n;
  S.dep.fill(0);
}

function lay(S, g) {
  S.st[g] = 2;
  const x = floor(S.gx[g]), y = floor(S.gy[g]);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  S.dep[y * W + x] += 1;
  if (S.long[g]) {
    const x2 = floor(S.gx[g] + cos(S.ga[g])), y2 = floor(S.gy[g] + sin(S.ga[g]));
    if (x2 >= 0 && x2 < W && y2 >= 0 && y2 < H) S.dep[y2 * W + x2] += 0.8;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.mar = cl(k[2] || 0, 0, 1);
  S.shape = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const dtau = (d * S.speed) / 2;
  S.tau += dtau;
  if (S.tau > POUR + DRY + STAND + CLEAR) pour(S);
  const aspect = 1 + 3 * S.shape, capt = CAPT * (aspect - 1) * (aspect - 1), isLong = aspect > 1.5 ? 1 : 0;
  const o = S.o, R = Math.random;
  if (S.tau < POUR) {
    // The liquid spreads out from the spines to the pinned edge.
    const sw = S.tau / POUR;
    for (let g = 0; g < S.ng; g++) if (S.st[g] === 0 && S.gs[g] < sw) S.st[g] = 1;
    return;
  }
  const Hh = 1 - (S.tau - POUR) / DRY, E = 1 / DRY, dry = Hh <= HEND;
  const step = sqrt(2 * BROWN * dtau);
  for (let g = 0; g < S.ng; g++) {
    if (S.st[g] === 2) continue;
    S.long[g] = isLong;
    if (dry || R() < (STICK + capt) * dtau) {
      lay(S, g);
      continue;
    }
    const segs = S.segs[S.gk[g]];
    near(segs, S.gx[g], S.gy[g], o);
    let v = (RAD * E * (flow(o[0]) - S.mar * MAR * o[0])) / max(Hh, HEND);
    v = cl(v, -12, 12) * dtau;
    S.gx[g] += o[1] * v + step * (R() + R() + R() - 1.5) * 2;
    S.gy[g] += o[2] * v + step * (R() + R() + R() - 1.5) * 2;
    near(segs, S.gx[g], S.gy[g], o);
    if (o[0] >= SSTOP) {
      // Pinned edge: pull back inside it and stop.
      const back = (o[0] - SSTOP) * RAD + 0.01;
      S.gx[g] -= o[1] * back;
      S.gy[g] -= o[2] * back;
      lay(S, g);
      continue;
    }
    // Against grains already packed one LED further out.
    if (v > 0 && o[0] > 0.5) {
      const ax = floor(S.gx[g] + o[1] * 0.8), ay = floor(S.gy[g] + o[2] * 0.8);
      if (ax >= 0 && ax < W && ay >= 0 && ay < H && S.dep[ay * W + ax] >= PACK) lay(S, g);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const h = S.hue + HUE0, tau = S.tau, c = S.c, cg = S.cg, cq = S.cq;
  const mov = S.mov;
  mov.fill(0);
  for (let g = 0; g < S.ng; g++) {
    if (S.st[g] !== 1) continue;
    const x = floor(S.gx[g]), y = floor(S.gy[g]);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    mov[y * W + x] += 1;
    if (S.long[g]) {
      const x2 = floor(S.gx[g] + cos(S.ga[g])), y2 = floor(S.gy[g] + sin(S.ga[g]));
      if (x2 >= 0 && x2 < W && y2 >= 0 && y2 < H) mov[y2 * W + x2] += 0.8;
    }
  }
  // Liquid height scale, how far the pour has spread, and the clearing.
  const Hh = tau < POUR ? 1 : max(0, 1 - (tau - POUR) / DRY);
  const wet = tau < POUR ? tau / POUR : Hh > HEND ? 1 : 0;
  const t3 = POUR + DRY + STAND, fade = tau > t3 ? max(0, 1 - (tau - t3) / CLEAR) : 1;
  hsv(h + 0.12, 0.8, 0.13, cg);
  hsv(h, 0.38, 0.62, cq);
  const P = S.paper;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // The ground: a pale grey with a little warmth, grained per LED.
      hsv(h + 0.5 + 0.04 * (P[i * 2] - 0.5), 0.08 + 0.08 * P[i * 2 + 1], 0.31 + 0.07 * P[i * 2], c);
      let r = c[0], gg = c[1], b = c[2];
      const k = S.let[i];
      if (k >= 0 && wet > 0) {
        const s = S.sig[i];
        if (s < wet) {
          // The sheen: thicker liquid lighter, and a highlight on the side
          // of each stroke that faces the upper left.
          const th = Hh * (1 - s * s), m = 0.12 * min(1, Hh / 0.06) + 0.7 * Math.pow(min(1, th / 0.4), 0.8);
          r += (cq[0] - r) * m;
          gg += (cq[1] - gg) * m;
          b += (cq[2] - b) * m;
          const face = -0.6 * S.nx[i] - 0.8 * S.ny[i];
          if (face > 0) {
            const bump = exp(-((s - 0.62) * (s - 0.62)) / 0.03) * face * face * sqrt(Hh) * 0.55;
            r += (1 - r) * bump;
            gg += (1 - gg) * bump;
            b += (1 - b) * bump;
          }
        }
      }
      const rho = S.dep[i] * fade + mov[i];
      if (rho > 0) {
        const a = 1 - exp(-0.65 * rho);
        r += (cg[0] - r) * a;
        gg += (cg[1] - gg) * a;
        b += (cg[2] - b) * a;
      }
      display.setPixel(x, y, round(r * 255), round(gg * 255), round(b * 255));
    }
}
