// ===== Patternflow pattern =====
// Title:   Elephant Toothpaste
// Family:  chemistry
// Idea:    A gloved hand tips potassium iodide into a tall graduated cylinder of peroxide and dish soap striped inside with food colouring, and the fat column of striped foam that shoots out of its mouth climbs to the top of the panel before it folds over and slumps steaming into a heap on the lab bench.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 23, after the elephant toothpaste demonstration of the school chemistry lab
// Round:   23
// ===============================
// @matrix 64x128
// @knobs Dye=0..1, Speed=0.2..3, Stripes=1..4, Strength=0..1
//
// Knob 1: Dye. The food colours striped down the glass, all turned round the colour wheel together. Blue and yellow at 0 become orange and blue at 0.5 and come back round at 1.
// Knob 2: Speed. How fast the demonstration runs: at 2 the foam leaves the mouth a second after the catalyst goes in and a round from fresh cylinder to wiped bench takes 18.6 s; at 0.2 it all runs ten times slower.
// Knob 3: Stripes. How many dye colours run down the glass and so through the foam: one blue against white foam at 1, up to four colours at 4.
// Knob 4: Strength. How much stronger than the lab-grade 30% peroxide the bottle is: at 0 the column takes half a second to reach the top and stands about 25 LEDs wide, at 1 it gets there in a sixth of a second at 37 wide and leaves a taller heap.
// Buttons: K1 tap pours the catalyst now, or once the foam has finished, wipes the bench and sets down a fresh cylinder.

const W = 64;
const H = 128;
const N = W * H;
// The cylinder's mouth and the bench top, in rows, and the liquid's depth below the mouth.
const MY = 52;
const BENCH = 114;
const LIQ = 28;
// The round at Speed 2, in seconds from the moment a fresh cylinder comes down.
const T_DOWN = 0.9;
const T_OUT = 1.4;
const T_IN = 2.2;
const T_POUR = 2.45;
const T_DRY = 3.05;
const T_BACK = 3.5;
const T_FROTH = 2.7;
const T_ERUPT = 3.4;
const T_STOP = 8.4;
const T_FOLD = 10;
const T_SLUMP = 12;
const T_WIPE = 16;
const T_LIFT = 17.6;
const T_END = 18.6;
// The study opens with the hand on its way in with the beaker.
const OPEN = 1.6;
const { min, max, floor, ceil, round, sin, cos, exp, sqrt, abs, asin, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// The dye hues before the Dye knob turns them: blue, yellow, pink, green.
const HUES = [0.62, 0.15, 0.93, 0.38];
const WHITE = [255, 250, 240];
// The light comes from the upper left and a little in front.
const LX = -0.48;
const LY = -0.56;
const LZ = 0.67;

function hsv(h, s, v) {
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return 255 * (v - v * s * max(0, min(k, 4 - k, 1)));
  };
  return [f(5), f(3), f(1)];
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  const S = { bub: F(N), stn: F(N), bg: F(N * 3), R: F(N), G: F(N), B: F(N) };
  Object.assign(S, { q: F(N), nx: F(N), ny: F(N), u: F(N), s: F(N), tx: F(N), hs: F(W), len: [], c: OPEN, t: 0 });
  // Bubbles: a few cells about 4 LEDs across with darker walls, and finer
  // grain over them, on a tile that wraps both ways to slide with the foam.
  const px = [];
  const py = [];
  for (let k = 0; k < 512; k++) {
    px.push((k & 15) * 4 + 4 * hash(k * 2));
    py.push((k >> 4) * 4 + 4 * hash(k * 2 + 1));
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let f1 = 99;
      let f2 = 99;
      let best = 0;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const k = (((y >> 2) + j + 32) % 32) * 16 + (((x >> 2) + i + 16) % 16);
          let dx = abs(x + 0.5 - px[k]);
          let dy = abs(y + 0.5 - py[k]);
          dx = min(dx, 64 - dx);
          dy = min(dy, 128 - dy);
          const d = sqrt(dx * dx + dy * dy);
          if (d < f1) {
            f2 = f1;
            f1 = d;
            best = k;
          } else if (d < f2) f2 = d;
        }
      S.bub[y * W + x] = 0.74 + 0.2 * min(1, (f2 - f1) / 1.3) + 0.08 * hash(best + 777) + 0.1 * hash(y * W + x + 5000);
      // Steam: a smooth field that also wraps.
      const a = (2 * PI * x) / 64;
      const b = (2 * PI * y) / 128;
      const v = sin(a + 2 * b + 1.3) + 0.7 * sin(-2 * a + 3 * b + 4.1) + 0.5 * sin(3 * a + 5 * b + 2.2) + 0.35 * sin(5 * a - 7 * b + 5.7);
      S.stn[y * W + x] = 0.5 + v / 5.1;
    }
  // The dark lab: a tiled wall the panel barely shows over a bench whose
  // black top is lit along its front edge, with a wooden cupboard under it.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r;
      let g;
      let b;
      if (y < BENCH) {
        const v = (x % 8 === 0 || y % 8 === 7 ? 6 : 11 + 3 * hash(((y >> 3) << 3) + (x >> 3))) * (0.7 + 0.4 * exp(-(((x - 32) / 30) ** 2)) * (y / BENCH));
        r = v * 0.8;
        g = v * 0.95;
        b = v * 1.3;
      } else if (y < BENCH + 3) {
        const v = y === BENCH + 2 ? 2.1 : 1 + 0.08 * (y - BENCH);
        r = 40 * v;
        g = 43 * v;
        b = 48 * v;
      } else {
        const door = x === 31 || x === 32 || y === 126 || y === 127;
        const knob = (x === 28 || x === 35) && y > 119 && y < 122;
        const v = door ? 0.5 : knob ? 2.4 : 1 - 0.02 * (y - 117);
        r = 44 * v;
        g = 31 * v;
        b = 21 * v;
      }
      S.bg[(y * W + x) * 3] = r;
      S.bg[(y * W + x) * 3 + 1] = g;
      S.bg[(y * W + x) * 3 + 2] = b;
    }
  params.S = S;
  fresh(S);
}

// A fresh cylinder brings new drips of dye and a new heap. The side the
// column will fall to is picked here too.
function fresh(S) {
  const rnd = Math.random;
  for (let k = 0; k < 10; k++) S.len[k] = LIQ + 2 - floor(rnd() * 13);
  S.side = rnd() < 0.5 ? -1 : 1;
  S.ph = [rnd() * 6.3, rnd() * 6.3, rnd() * 6.3];
  for (let x = 0; x < W; x++) {
    const d = (x - 32) / 27;
    const h = exp(-d * d * 1.6) * (0.78 + 0.1 * sin(x * 0.45 + S.ph[0]) + 0.07 * sin(x * 1.1 + S.ph[1]));
    S.hs[x] = max(0, h + 0.22 * exp(-(((x - 22.5) / 5) ** 2)) + 0.22 * exp(-(((x - 41.5) / 5) ** 2)));
  }
}

export function update(dt, input, params) {
  if (!params.S) setup(params);
  const S = params.S;
  const k = input.knobValues || [0, 2, 1, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.dye = cl(k[0], 0, 1);
  const rate = cl(k[1], 0.2, 3) / 2;
  S.n = cl(round(k[2]), 1, 4);
  S.st = cl(k[3], 0, 1);
  S.bands = 2 * S.n + 2;
  S.pal = HUES.map((h) => hsv((h + S.dye) % 1, 0.88, 1));
  if (input.btnPressed && input.btnPressed[0]) {
    if (S.c < T_IN) S.c = T_IN;
    else if (S.c >= T_SLUMP && S.c < T_WIPE) S.c = T_WIPE;
  }
  S.c += dt * rate;
  S.t += dt * rate;
  if (S.c >= T_END) {
    S.c -= T_END;
    fresh(S);
  }
}

// One LED of foam, its bubbles lit by the lamp on the rounded surface and
// coloured by the dye band it falls in. b is the band coordinate, s how far
// the foam has moved.
function foam(S, i, nx, ny, nz, b, s, tx, dim, a, sat) {
  const tex = S.bub[((s | 0) & 127) * 64 + ((tx | 0) & 63)];
  const lit = max(0, LX * nx + LY * ny + LZ * nz);
  const sh = (0.16 + 1.1 * lit + 0.25 * lit ** 8) * tex * dim;
  b += 0.3 * (tex - 0.88);
  const m = cl((cos(2 * PI * b) - 0.05) * 2.5, 0, 1) * sat;
  const n = S.n;
  const c = S.pal[(((floor(b + 0.5) % n) + n) % n)];
  const o = 1 - a;
  S.R[i] = S.R[i] * o + (WHITE[0] + (c[0] - WHITE[0]) * m) * sh * a;
  S.G[i] = S.G[i] * o + (WHITE[1] + (c[1] - WHITE[1]) * m) * sh * a;
  S.B[i] = S.B[i] * o + (WHITE[2] + (c[2] - WHITE[2]) * m) * sh * a;
}

// A disc of a foam tube. Where discs overlap, the LED keeps the one it sits
// deepest in, so a row of them makes a soft round-ended tube.
function stamp(S, cx, cy, tx, ty, w, s0, asp = 1) {
  const { q, nx, ny, u, s } = S;
  const iw = 1 / w;
  const y1 = min(H - 1, ceil(cy + w / asp));
  const x1 = min(W - 1, ceil(cx + w));
  for (let y = max(0, floor(cy - w / asp)); y <= y1; y++) {
    const dy = (y - cy) * iw * asp;
    for (let x = max(0, floor(cx - w)); x <= x1; x++) {
      const dx = (x - cx) * iw;
      const d = dx * dx + dy * dy;
      const i = y * W + x;
      if (d < 1 && d < q[i]) {
        q[i] = d;
        nx[i] = dx;
        ny[i] = dy;
        u[i] = -dx * ty + dy * tx;
        s[i] = s0 - (dx * tx + dy * ty) * w * 0.8;
        S.tx[i] = u[i] * w;
      }
    }
  }
}

function cylinder(S, oy, top, M, dim, xs) {
  const { R, G, B, pal, n, len } = S;
  for (let ly = -1; ly < 62; ly++) {
    const y = MY + ly + oy;
    if (y < 0 || y >= H) continue;
    for (let x = 16; x <= 48; x++) {
      const i = y * W + x;
      let r = -1;
      let g = 0;
      let b = 0;
      if (ly <= 0) {
        if ((ly === 0 && x >= 23 && x <= 41) || (ly < 0 && x >= 21 && x <= 24)) [r, g, b] = [120, 136, 150];
      } else if (ly < 55) {
        if (x === 24 || x === 40) {
          const v = x === 24 ? 1 : 0.7;
          [r, g, b] = [58 * v, 74 * v, 90 * v];
        } else if (x > 24 && x < 40) {
          if (ly >= top) {
            // Foam that has filled the glass, seen through it.
            const u = (x - 32) / 7.6;
            foam(S, i, u, 0, sqrt(1 - u * u), (asin(u) / (2 * PI)) * S.bands + 0.022 * (M + ly), M + ly, x, 0.72 * dim, 1, 1);
            [r, g, b] = [R[i], G[i], B[i]];
          } else if (ly >= LIQ) {
            const v = ly === LIQ ? 2.4 : 1 - (ly - LIQ) * 0.012;
            [r, g, b] = [25 * v, 38 * v, 46 * v];
            // The dye that has run down into the liquid spreads in it.
            for (let k = 0; k < S.bands; k++) {
              if (len[k] < LIQ) continue;
              const sp = 0.8 + (ly - LIQ) * 0.18;
              const e = 0.4 * exp(-(((x - xs[k]) / sp) ** 2) - (ly - LIQ) / 10);
              const c = pal[k % n];
              r += c[0] * e;
              g += c[1] * e;
              b += c[2] * e;
            }
          } else [r, g, b] = [15, 20, 26];
          if (ly < top && ly >= 2)
            for (let k = 0; k < S.bands; k++) {
              if (ly > len[k] || abs(x - xs[k]) > (ly >= len[k] - 1 ? 1.1 : 0.7)) continue;
              const c = pal[k % n];
              const v = xs.front[k] ? 0.85 : 0.35;
              [r, g, b] = [c[0] * v, c[1] * v, c[2] * v];
            }
          // The graduations, and a glint down the near side of the glass.
          const tick = ly >= 6 && ly <= 50 && ly % 4 === 2 && x >= (ly % 16 === 2 ? 26 : 27) && x <= (ly % 16 === 2 ? 31 : 29);
          const glint = x === 26 ? 22 : 0;
          r += (tick ? 60 : 0) + glint;
          g += (tick ? 62 : 0) + glint;
          b += (tick ? 64 : 0) + glint;
        }
      } else if (ly < 57) {
        if (x >= 24 && x <= 40) [r, g, b] = [70, 86, 100];
      } else if (abs(x - 32) <= 11 + (ly - 57) * 1.1) {
        const v = ly === 57 ? 1.5 : 1 - (ly - 58) * 0.08;
        [r, g, b] = [34 * v, 54 * v, 82 * v];
      }
      if (r >= 0) {
        R[i] = r;
        G[i] = g;
        B[i] = b;
      }
    }
  }
}

const GLOVE = [116, 82, 230];
// A gloved hand in its lab-coat sleeve. Kind 1 holds the catalyst beaker and
// kind 2 presses a paper towel to the bench. Kind 3 grips the cylinder.
function hand(S, kind, hx, hy, a, pour) {
  const { R, G, B } = S;
  const ca = cos(a);
  const sa = sin(a);
  const wx = hx + ca * 10 - sa * 0.5;
  const wy = hy + sa * 10 + ca * 0.5;
  const slope = kind === 2 ? -0.45 : -0.12;
  // The beaker's liquid stays level as it tips; pour runs 0 to 1 as it empties.
  const lipx = hx + ca * -5.6 - sa * -6.6;
  const lipy = hy + sa * -5.6 + ca * -6.6;
  const surf = hy - 1 + (lipy + 0.5 + pour * 7 - hy + 1) * ss(-0.1, -0.9, a);
  for (let y = max(0, floor(min(hy, wy) - 14)); y <= min(H - 1, ceil(max(hy, wy) + 14)); y++)
    for (let x = max(0, floor(hx - 13)); x < W; x++) {
      const i = y * W + x;
      const dx = x - hx;
      const dy = y - hy;
      const lx = ca * dx + sa * dy;
      const ly = -sa * dx + ca * dy;
      let col = null;
      let v = 1;
      if (x >= wx - 1) {
        const t = (y - wy - (x - wx) * slope) / (x < wx + 7 ? 4.3 : 5.8);
        if (abs(t) < 1) {
          v = 0.4 + 0.6 * (1 - t * t) - 0.15 * t;
          col = x < wx + 7 ? GLOVE : x < wx + 8 ? [120, 120, 116] : [175, 175, 168];
        }
      }
      if (kind === 1 && abs(lx) <= 5.6 && abs(ly) <= 6.6) {
        v = 1;
        if (ly < -5.6) col = [125, 140, 155];
        else if (abs(lx) > 4.6 || ly > 5.6) col = [70, 90, 105];
        else if (y > surf) col = [190, 150, 60];
        else col = [R[i] * 0.7 + 12, G[i] * 0.7 + 14, B[i] * 0.7 + 16];
      } else if (kind === 1 && lx >= -7 && lx < -5.6 && ly >= -7.2 && ly < -5.6) col = [125, 140, 155];
      if (kind === 2) {
        const e = ((lx + 0.5) / 9.5) ** 2 + ((ly - 1.5) / 3) ** 2;
        if (e < 1) {
          col = [190, 194, 190];
          v = (0.55 + 0.45 * S.bub[(y & 127) * 64 + ((x * 2) & 63)]) * (0.7 + 0.3 * (1 - e));
        }
        const p = ((lx - 2.5) / 7.5) ** 2 + ((ly + 2.6) / 3.3) ** 2;
        if (p < 1) {
          col = GLOVE;
          v = 0.5 + 0.5 * sqrt(1 - p) - 0.12 * ly;
        }
      } else {
        const p = ((lx - 6.5) / 4.6) ** 2 + ((ly - 0.4) / 6.2) ** 2;
        if (p < 1) {
          col = GLOVE;
          v = 0.4 + 0.5 * sqrt(1 - p) - 0.04 * ly;
        }
        // Four curled fingers across the front, the thumb over the top.
        for (let j = 0; j < 4; j++) {
          const fy = ly + 4.4 - j * 2.9;
          const fx = lx < -0.5 ? lx + 0.5 : lx > 6 ? lx - 6 : 0;
          const d = fx * fx + fy * fy;
          if (d < 1.8) {
            col = GLOVE;
            v = 0.5 + 0.5 * sqrt(1 - d / 1.8) - 0.03 * ly;
          }
        }
        const tx = cl((lx - 2.5) / 5.5, 0, 1);
        const d = (lx - 2.5 - 5.5 * tx) ** 2 + (ly + 6.8 - 1.6 * tx) ** 2;
        if (d < 2.3) {
          col = GLOVE;
          v = 0.65 + 0.35 * sqrt(1 - d / 2.3);
        }
      }
      if (col) {
        R[i] = col[0] * v;
        G[i] = col[1] * v;
        B[i] = col[2] * v;
      }
    }
  // The catalyst falling from the lip into the mouth.
  if (kind === 1 && pour > 0.02 && pour < 0.98)
    for (let y = max(0, round(lipy)); y < MY + 2; y++) {
      const x0 = round(lipx - 0.5 + 0.4 * sin(y * 0.9 + S.t * 30));
      for (let x = x0; x <= x0 + (pour < 0.7 ? 1 : 0); x++) {
        const i = y * W + x;
        R[i] = 200;
        G[i] = 160;
        B[i] = 70;
      }
    }
}

export function draw(display, params) {
  const S = params.S;
  if (!S || !S.pal) return;
  const { R, G, B, bg, q, nx, ny, u, s, hs } = S;
  for (let i = 0; i < N; i++) {
    R[i] = bg[i * 3];
    G[i] = bg[i * 3 + 1];
    B[i] = bg[i * 3 + 2];
  }
  const c = S.c;
  const st = S.st;
  // The cylinder comes down at the start of a round and is lifted off at its end.
  let oy = 0;
  if (c < T_DOWN) oy = -140 * (1 - ss(0, T_DOWN, c));
  else if (c > T_LIFT + 0.35) oy = -140 * ss(T_LIFT + 0.35, T_END, c);
  oy = round(oy);

  // The column rises fast and keeps pouring out while the peroxide lasts.
  // Then it folds over to one side and sinks back into the glass.
  const tau = c - T_ERUPT;
  const Tr = 1.6 - 0.9 * st;
  const x01 = cl(tau / Tr, 0, 1);
  const f = ss(T_STOP, T_FOLD, c);
  const sl = ss(T_FOLD - 0.8, T_SLUMP, c);
  const flow = tau > 0 ? (20 + 30 * st) * 3 * (1 - exp(-min(tau, T_STOP - T_ERUPT) / 3)) + 4 * max(0, c - T_STOP) : 0;
  let L = tau > 0 ? (66 + 40 * st) * (1 - (1 - x01) ** 2) : 0;
  const M = tau > 0 ? L + flow : (ss(T_FROTH, T_ERUPT, c) - 1) * LIQ;
  L = tau > 0 ? 2 + (L - 2) * (1 - sl) : 0;
  // How far the foam inside the glass has risen above the liquid.
  const top = c < T_FROTH ? 99 : LIQ * (1 - ss(T_FROTH, T_ERUPT, c));
  // Once it is down, the foam stiffens and dulls.
  const se = ss(T_SLUMP, T_WIPE, c);
  const dim = 1 - 0.45 * se;

  // Where the dye streaks sit round the inside of the glass.
  const xs = [];
  xs.front = [];
  for (let k = 0; k < S.bands; k++) {
    const th = ((k + 0.5) / S.bands) * 2 * PI + 0.3;
    xs.push(32 + 6.8 * sin(th));
    xs.front.push(cos(th) > 0);
  }
  if (oy > -80) cylinder(S, oy, top, M, dim, xs);

  q.fill(2);
  if (tau > 0) {
    const wm = 12.5 + 6 * st;
    const l0 = 14 + 20 * (1 - f);
    let px = 32;
    let py = MY - 3 + oy;
    for (let l = 0; l <= L + 0.01; l += 1.5) {
      const a = S.side * 2.8 * f * ss(l0, l0 + 26, l);
      const w = (8.2 + (wm - 8.2) * (1 - exp(-l / 14))) * (1 + 0.35 * sl);
      const sway = 1.3 * sin(l * 0.08 - S.t * 1.9) * min(1, l / 25) * (1 - f);
      stamp(S, px + sway, py, sin(a), -cos(a), w, M - 55 * log(1 + l / 55), 1 + 0.7 * sl);
      px += 1.5 * sin(a);
      py -= 1.5 * cos(a);
    }
  }
  // Foam running down the outside of the glass to the bench, first and
  // fattest on the side the column fell to, swelling as it nears the heap.
  for (let sd = -1; sd <= 1; sd += 2) {
    const near = sd === S.side;
    const dr = ss(T_STOP + (near ? 0.3 : 0.9), T_SLUMP - (near ? 0.8 : 0.2), c);
    for (let l = 0; dr > 0 && l <= 60 * dr; l += 1.5) {
      const x = 32 + sd * (8.5 + 3 * ss(0, 12, l) + 1.1 * sin(l * 0.17 + S.ph[0] * sd));
      const w = (3.6 + 1.3 * sin(l * 0.23 + S.ph[1] + sd) + 3.4 * ss(4, 60, l)) * (near ? 1.15 : 0.95);
      stamp(S, x, MY - 1 + l + oy, 0, 1, w, 18 * (c - T_STOP) - l);
    }
  }
  const bands = S.bands;
  for (let i = 0; i < N; i++) {
    const d = q[i];
    if (d >= 1) continue;
    const a = cl((1 - sqrt(d)) * 5, 0, 1);
    foam(S, i, nx[i], ny[i], sqrt(1 - d), (asin(cl(u[i], -1, 1)) / (2 * PI)) * bands + 0.022 * s[i], s[i], S.tx[i] + 32, dim, a, 1);
  }

  // The heap on the bench, coiled foam with the dye folded through it, until
  // the towel sweeps it off from the right.
  const wx = 72 - 86 * ss(T_WIPE, T_LIFT, c);
  const A = (30 + 12 * st) * ss(T_STOP + 1, T_SLUMP + 0.5, c) * (1 - 0.18 * se);
  if (A > 0.3 && c < T_LIFT)
    for (let x = 0; x < W && x < wx - 7; x++) {
      const h = A * hs[x];
      if (h < 0.4) continue;
      const g = A * (hs[min(W - 1, x + 1)] - hs[max(0, x - 1)]) * 0.5;
      const ytop = BENCH - h;
      for (let y = max(0, floor(ytop)); y < BENCH; y++) {
        const dd = y + 0.5 - ytop;
        const e = exp(-max(0, dd) / 4);
        const coil = sin((y + 1.5 * sin(x * 0.3 + S.ph[2])) * 0.95);
        let hx = -g * e + 0.25 * sin(x * 0.7 + y * 0.4);
        let hy = -e + 0.4 * coil * (1 - e);
        let hz = 0.45 + (1 - e);
        const k = 1 / sqrt(hx * hx + hy * hy + hz * hz);
        hx *= k;
        hy *= k;
        hz *= k;
        const b = (y + 2.5 * sin(x * 0.19 + S.ph[0]) + 1.5 * sin(x * 0.47 + S.ph[1])) * 0.15 + (x - 32) * 0.03;
        foam(S, y * W + x, hx, hy, hz, b, y * 2 + 40, x * 2, dim * (0.62 + 0.38 * ss(0, 3, BENCH - 1 - y)), cl(dd + 0.5, 0, 1), 1 - 0.35 * se);
      }
    }

  // Steam off the hot heap.
  const stA = ss(T_STOP + 0.8, T_SLUMP - 1, c) * (1 - ss(T_SLUMP + 0.5, T_WIPE, c));
  if (stA > 0.01) {
    const crown = BENCH - A * 0.9;
    const rise = S.t * 13;
    for (let y = max(0, floor(crown - 70)); y < BENCH; y++) {
      const v = crown - y;
      const env = ss(-8, 4, v) * exp(-max(0, v) / 26) * stA;
      if (env < 0.01) continue;
      const row = ((y + rise) | 0) & 127;
      const sw = 4 * sin(y * 0.09 + S.t);
      for (let x = 0; x < W; x++) {
        const n = S.stn[row * 64 + ((x + sw) & 63)];
        const add = 280 * env * exp(-(((x - 32) / 21) ** 2)) * max(0, n - 0.4);
        const i = y * W + x;
        R[i] += add * 0.85;
        G[i] += add * 0.9;
        B[i] += add;
      }
    }
  }

  // The hands.
  if (c < T_OUT) hand(S, 3, 40.5 + 46 * ss(T_DOWN, T_OUT, c), MY + 9 + oy, 0, 0);
  else if (c < T_BACK) {
    const back = ss(T_DRY, T_BACK, c);
    const hx = 41 + 44 * (1 - ss(T_OUT, T_IN, c)) + 46 * back;
    const a = -1.25 * ss(T_IN, T_POUR, c) * (1 - 0.75 * back);
    hand(S, 1, hx, 41 - 4 * back, a, ss(T_POUR, T_DRY, c));
  } else if (c >= T_WIPE && c < T_LIFT) hand(S, 2, wx, BENCH - 4, 0, 0);
  else if (c >= T_LIFT) hand(S, 3, 40.5 + 44 * (1 - ss(T_LIFT, T_LIFT + 0.35, c)), MY + 9 + oy, 0, 0);

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      display.setPixel(x, y, min(255, R[i]), min(255, G[i]), min(255, B[i]));
    }
}
