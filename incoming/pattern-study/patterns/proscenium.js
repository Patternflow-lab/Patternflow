// ===== Patternflow pattern =====
// Title:   Proscenium
// Family:  stage
// Idea:    A theatre from the stalls: under a gilded arch the red house curtain rises on a painted backcloth, lamps above cut shafts through the haze, a dancer crosses in a follow spot, and the curtain falls for her bow before the next scene.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 23, after the proscenium stage of a nineteenth-century opera house
// Round:   23
// ===============================
// @matrix 64x128
// @knobs Gel=0..1, Speed=0.2..3, Scene=0..3, Haze=0..1
//
// Knob 1: Gel. The colour of the stage wash and the beams: steel blue at 0, turning through violet and rose to amber in the middle, then through green back to blue.
// Knob 2: Speed. How fast the show runs: at 2 the curtain takes 2.8 s to rise and a whole round of rise, dance, fall and bow is 12 s; at 0.2 it all runs ten times slower.
// Knob 3: Scene. The backdrop the curtain rises on: a moonlit sea, a forest, a night city or a snowfall, the others following in that order. Turning it brings the curtain in and out again on the new one.
// Knob 4: Haze. How much haze hangs in the air. At 0 the beams are thin shafts; turned up they swell and the whole stage glows in the gel.
// Buttons: K1 tap brings the curtain in now, or takes it out again if it is in.


const W = 64;
const H = 128;
const N = W * H;
// Inside the arch: columns XL..XR, rows from TOP down to the stage lip.
const [XL, XR, TOP, TRUSS, SKY, LENS, BACK, CURT, LIP] = [4, 59, 8, 11, 15, 17, 78, 96, 100];
// The phases of a round, in seconds at Speed 2.
const [TRISE, TSHOW, TFALL, TBOW, THOLD] = [2.8, 4, 1.8, 3.2, 0.6];
const LAMPS = [10, 19, 27, 36, 44, 53];
const AIM = [34, 46, 15, 49, 20, 31];
const { min, max, sqrt, sin, cos, exp, abs, round, floor, hypot, PI } = Math;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// Smooth value noise, for the forest's leaves and bark.
function vnoise(x, y) {
  const xi = floor(x), yi = floor(y);
  const u = x - xi, v = y - yi;
  const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const h = (a, b) => hash(a * 157 + b * 7919 + 13);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}
const mix3 = (a, b, t) => a.map((v, j) => v + (b[j] - v) * t);
function put(A, i, c, k = 1) {
  for (let j = 0; j < 3; j++) A[i * 3 + j] = c[j] * k;
}
function add(A, i, c, k = 1) {
  for (let j = 0; j < 3; j++) A[i * 3 + j] += c[j] * k;
}
const gilt = (v) => [min(255, 268 * v), 178 * v + 30 * v ** 4, 58 * v + 70 * v ** 6];
function hsv(h, s, v) {
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

// The painted backcloths. Each writes what the paint reflects (A, 0..1) and
// what glows on its own from behind the cloth (E, 0..255).
function sea(x, y, i, A, E) {
  const px = x + 0.5, py = y + 0.5;
  if (py < 56) {
    put(A, i, mix3([0.1, 0.14, 0.36], [0.36, 0.44, 0.7], ((py - SKY) / 41) ** 1.3));
    if (y < 48 && hash(i + 77) > 0.982) add(E, i, [1, 1, 1], 60 + 90 * hash(i + 5));
    const d = hypot(px - 43, py - 31);
    if (d < 6.3) {
      put(A, i, [0, 0, 0]);
      put(E, i, [242, 236, 205], 0.88 + 0.12 * sqrt(1 - (d / 6.3) ** 2) - 0.14 * (vnoise(px * 0.7, py * 0.7) > 0.64));
    } else add(E, i, [80, 88, 110], exp(-(d - 6.3) / 3.5));
    // A headland on the left and a ship with its sails up on the horizon.
    const ship = (abs(px - 26) < 4.2 - (py - 53.5) * 0.9 && py > 53.5) || (abs(px - 26) < 0.5 && py > 44) || (py > 45 && px > 26.5 && px < 26.6 + (py - 45) * 0.55) || (py > 47.5 && px < 25.5 && px > 25.4 - (py - 47.5) * 0.45);
    if ((px < 15 && py > 43 + 1.2 * (px - 4) + 1.5 * sin(px * 1.1)) || ship) put(A, i, [0.035, 0.05, 0.09]);
  } else put(A, i, mix3([0.05, 0.12, 0.3], [0.1, 0.2, 0.42], (py - 56) / 22), 1 + 0.2 * sin(py * 1.9 + 1.4 * sin(px * 0.35)));
}

const TRUNKS = [[8, 2.2, 0.2], [14, 3.4, 1], [22, 1.7, 0], [30, 2.4, 0.5], [40, 3.8, 1], [47, 1.9, 0], [53, 3, 0.9], [58.5, 2.2, 0.3]];
function forest(x, y, i, A) {
  const px = x + 0.5, py = y + 0.5;
  const t = (py - SKY) / (BACK - SKY);
  let c = mix3([0.18, 0.32, 0.32], [0.5, 0.62, 0.44], t);
  c = mix3(c, [0.62, 0.68, 0.48], 0.45 * exp(-((px - 32) ** 2) / 90 - ((py - 60) ** 2) / 260));
  for (const [tx, hw, near] of TRUNKS)
    if (abs(px - tx - 0.7 * sin(py * 0.07 + tx)) < hw * (0.85 + 0.35 * t)) c = mix3(c, [0.09, 0.07, 0.05].map((v) => v * (0.7 + 0.5 * vnoise(px * 1.4, py * 0.22))), 0.45 + 0.45 * near);
  const n = vnoise(px * 0.16, py * 0.2) * 0.65 + vnoise(px * 0.45, py * 0.5) * 0.35;
  if (n - (py - 20) * 0.022 > 0.42) c = mix3([0.05, 0.16, 0.06], [0.2, 0.44, 0.14], vnoise(px * 0.9, py * 0.9));
  if (py > 67 + 2.5 * sin(px * 0.55) + 1.5 * sin(px * 1.4 + 1)) c = mix3([0.05, 0.16, 0.05], [0.16, 0.36, 0.1], hash(i * 3));
  put(A, i, c);
}

// The city's skyline, two rows of blocks, and which LED is which window.
const [FARTOP, NEARTOP, NEARL] = [0, 0, 0].map(() => new Int16Array(W));
const WIN = new Int16Array(N).fill(-1);
let NWIN = 0;
for (let x = 0, k = 0; x < W; k++)
  for (let j = 0, w = 5 + floor(hash(k + 400) * 5), top = 38 + floor(hash(k + 500) * 16); j < w && x < W; j++) FARTOP[x++] = top;
for (let x = 0, k = 0; x < W; k++)
  for (let j = 0, w = 6 + floor(hash(k + 600) * 6), top = 50 + floor(hash(k + 700) * 15); j < w && x < W; j++, x++) {
    NEARTOP[x] = top;
    NEARL[x] = x - j;
  }
function city(x, y, i, A, E) {
  const px = x + 0.5, py = y + 0.5;
  put(A, i, mix3([0.1, 0.07, 0.24], [0.44, 0.25, 0.42], clamp((py - SKY) / 45, 0, 1) ** 1.2));
  if (y < 40 && hash(i + 91) > 0.986) add(E, i, [1, 1, 1], 50 + 70 * hash(i));
  if (hypot(px - 15, py - 28) < 4.4 && hypot(px - 17, py - 26.6) > 3.8) put(E, i, [240, 226, 170]);
  const tower = (abs(px - 46.5) < 2.2 && py > 31) || (abs(px - 46.5) < 0.6 && py > 25);
  if (py > FARTOP[x] || tower) put(A, i, [0.14, 0.12, 0.25]);
  if (tower && py > 33 && x === 46 && y % 3 === 0) put(E, i, [170, 140, 90]);
  if (py > NEARTOP[x]) {
    put(A, i, [0.05, 0.045, 0.09]);
    if ((x - NEARL[x]) % 2 === 1 && (y - NEARTOP[x]) % 3 === 2 && NEARTOP[min(W - 1, x + 1)] === NEARTOP[x]) WIN[i] = NWIN++;
  }
}

const PINES = [[9, 60, 15], [15, 58, 11], [50, 61, 16], [57, 59, 12], [22, 69, 9], [43, 70, 10]];
function snow(x, y, i, A, E) {
  const px = x + 0.5, py = y + 0.5;
  let c = mix3([0.2, 0.26, 0.44], [0.48, 0.54, 0.68], (py - SKY) / 50);
  if (y < 44 && hash(i + 33) > 0.988) add(E, i, [1, 1, 1], 40 + 50 * hash(i));
  if (py > 54 + 5 * sin(px * 0.08 + 0.6) + 2 * sin(px * 0.23)) c = [0.56, 0.62, 0.8];
  if (py > 65 + 4 * sin(px * 0.11 - 1.1)) c = [0.8, 0.84, 0.96];
  for (const [tx, base, h] of PINES) {
    const d = py - (base - h);
    if (d > 0 && d < h + 2 && abs(px - tx) < (d < h ? (d % 4) * 0.55 + d * 0.22 : 0.7) + 0.3) c = d < h && d % 4 < 0.9 ? [0.85, 0.9, 1] : [0.04, 0.13, 0.09];
  }
  // A cottage on the near hill, its roof under snow and one window lit.
  if (px > 30 && px < 38 && py > 62 && py < 68) c = [0.24, 0.13, 0.08];
  if (py > 58 && py <= 62 && abs(px - 34) < (py - 57.5) * 1.2) c = [0.88, 0.92, 1];
  if (px > 35.5 && px < 37 && py > 56.5 && py < 60) c = [0.2, 0.12, 0.1];
  if (px > 32.5 && px < 34.5 && py > 63.5 && py < 66) put(E, i, [255, 190, 90]);
  put(A, i, c);
}
const SCENES = [sea, forest, city, snow];

// The front row: heads [x, top, half-width] above red seat backs.
const HEADS = [[5, 109, 4.2], [15.5, 106.5, 4.5], [27, 109.5, 4.3], [37.5, 107.5, 4.6], [49, 108.5, 4.4], [59, 106.5, 4.3]];

export function setup(params) {
  const F = (n) => new Float32Array(n);
  const U = (n) => new Uint8Array(n);
  const S = { base: -1, alb: [], emi: [], arch: U(N), archC: F(N * 3), floorA: F(N), house: F(N * 3), R: F(N), G: F(N), B: F(N), M: U(N), fb: F(W), flakes: [] };
  const seat = U(N);
  const edge = new Int16Array(W);
  params.s = S;
  for (let x = 0; x < W; x++) {
    const dx = min(x - XL, XR - x);
    edge[x] = x < XL || x > XR ? LIP + 2 : TOP + (dx < 9 ? round(9 - sqrt(81 - (9 - dx) ** 2)) : 0);
    S.fb[x] = ((2 * PI) / 5.4) * (x + 1.3 * sin(x * 0.31));
  }
  // The arch's gilt mouldings go by how far an LED is from the opening.
  const crest = (x, y) => hypot((x + 0.5 - 32) / 5.5, (y + 0.5 - 6.5) / 4.5);
  for (let y = 0; y <= LIP + 1; y++) for (let x = 0; x < W; x++) if (y < edge[x] || crest(x, y) < 1) S.arch[y * W + x] = 1;
  for (let y = 0; y <= LIP + 1; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!S.arch[i]) continue;
      let d = 99;
      for (let v = max(0, y - 6); v <= min(LIP + 1, y + 6); v++)
        for (let u = max(XL, x - 6); u <= min(XR, x + 6); u++) if (!S.arch[v * W + u]) d = min(d, hypot(u - x, v - y));
      const along = x >= XL && x <= XR ? x : y;
      let g = 0.52 + 0.22 * sin(along * 0.9) * sin(d * 1.7) + 0.08 * hash(i);
      if (d < 5.2) g = d < 1.2 ? 1 : d < 2.2 ? 0.36 : d < 3.2 ? (along % 3 ? 0.55 : 1) : d < 4.2 ? 0.72 : 0.34;
      const q = crest(x, y);
      put(S.archC, i, gilt(q < 1 ? (q > 0.8 ? 1 : q > 0.62 ? 0.3 : 0.62 + 0.4 * (1 - q) - 0.25 * (abs(x - 31.5) < 1 && y > 4)) : g * (x < XL || x > XR ? 0.8 + 0.28 * (y / LIP) : 0.95)));
    }
  for (let s = 0; s < 4; s++) {
    const A = F(N * 3);
    const E = F(N * 3);
    for (let y = SKY; y < BACK; y++) for (let x = XL; x <= XR; x++) SCENES[s](x, y, y * W + x, A, E);
    S.alb.push(A), S.emi.push(E);
  }
  S.won = U(NWIN).map(() => (Math.random() < 0.55 ? 1 : 0));
  // Floorboards running away from us to the backcloth.
  for (let y = BACK; y < LIP; y++)
    for (let x = XL; x <= XR; x++) {
      const f = ((((x + 0.5 - 32) / (y + 0.5 - 44)) * 5) % 1 + 1) % 1;
      S.floorA[y * W + x] = (y === BACK ? 0.4 : 1) * (abs(f - 0.5) > 0.42 ? 0.55 : 1) * (0.92 + 0.16 * hash(y * W + x));
    }
  // The house: the pit's glow and its music stand lamps behind the heads.
  for (let y = LIP + 2; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const px = x + 0.5, py = y + 0.5;
      let c = [255, 140, 60].map((v) => v * (y < 104 ? 0.12 : 0.3 * exp(-(((py - 110) / 7) ** 2))));
      for (let k = 0; k < 7; k++) {
        const d = hypot(px - (4 + k * 9.3), (py - 113.5) * 1.6);
        if (d < 3) c = c.map((v, j) => v + [230, 170, 90][j] * exp(-d * d));
      }
      for (const [cx, top, rx] of HEADS) {
        const ry = rx * 1.25;
        // One gentleman has kept his top hat on.
        const hat = cx === 37.5 && ((abs(px - cx) < 3 && py > top - 5 && py < top + 1.5) || (abs(px - cx) < 5.6 && abs(py - top - 1.5) < 0.8));
        if (hat || hypot((px - cx) / rx, (py - top - ry) / ry) < 1 || (abs(px - cx) < rx * 0.55 && py > top + ry)) {
          c = [3, 2, 3];
          seat[i] = 2;
        }
      }
      // Seat backs in red velvet hide the shoulders.
      const sx = (((px - 0.3) % 10.6) + 10.6) % 10.6;
      if (y >= 119 && sx > 0.6 && sx < 10 && (y > 120 || (sx > 1.6 && sx < 9))) {
        c = [255, 30, 36].map((v) => v * (0.1 + 0.32 * exp(-(py - 119) / 2.5)));
        seat[i] = 1;
      }
      put(S.house, i, c);
    }
  // The top of each head catches a little of the stage light.
  for (let i = W; i < N; i++) if (seat[i] === 2 && !seat[i - W]) put(S.house, i, [96, 62, 40]);
  const rnd = Math.random;
  for (let k = 0; k < 70; k++) S.flakes.push({ x: XL + rnd() * (XR - XL), y: SKY + rnd() * (LIP - SKY), v: rnd(), p: rnd() * 6 });
}

// Set the curtain moving from wherever it is.
function move(S, ph, quick) {
  S.ph = ph;
  S.o0 = S.o;
  S.c = 0;
  S.quick = quick;
  S.dur = ph ? TFALL * max(0.25, S.o) : TRISE * max(0.25, 1 - S.o);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = clamp(dt || 0, 0, 0.1);
  S.gel = clamp(k[0], 0, 1);
  const rate = clamp(k[1], 0.2, 3) / 2;
  const base = clamp(round(k[2]), 0, 3);
  S.haze = clamp(k[3], 0, 1);
  if (S.base < 0) {
    // Open on the curtain just about to go out.
    Object.assign(S, { base, scene: base, count: 0, o: 0, t: 0, foot: 1 });
    move(S, 0, false);
    S.c = -0.6;
  }
  if (base !== S.base) {
    S.base = base;
    if (S.ph === 3) {
      S.count = 0;
      S.scene = base;
      move(S, 0, false);
    } else if (S.ph === 2) S.quick = true;
    else move(S, 2, true);
  }
  if (input.btnPressed && input.btnPressed[0]) move(S, S.ph < 2 ? 2 : 0, false);
  const st = dt * rate;
  S.t += st;
  S.c += st;
  if (S.ph === 0) {
    S.o = S.o0 + (1 - S.o0) * sstep(0, S.dur, S.c);
    if (S.c >= S.dur) {
      S.ph = 1;
      S.c = 0;
      S.dir = S.count % 2 ? -1 : 1;
    }
  } else if (S.ph === 1) {
    S.o = 1;
    if (S.c >= TSHOW) move(S, 2, false);
  } else if (S.ph === 2) {
    S.o = S.o0 * (1 - sstep(0, S.dur, S.c));
    if (S.c >= S.dur) {
      // The curtain is in: change the cloth behind it while she bows.
      S.ph = 3;
      S.c = 0;
      S.count = S.quick ? 0 : S.count + 1;
      S.scene = (S.base + S.count) % 4;
      S.dur = S.quick ? THOLD : TBOW;
    }
  } else if (S.c >= S.dur) move(S, 0, false);
  S.foot += ((S.ph === 1 ? 0.7 : 1) - S.foot) * min(1, dt * 2);
  // Lit windows come and go, and snow falls from the flies.
  for (let w = 0; w < S.won.length; w++) if (Math.random() < st * 0.25) S.won[w] ^= 1;
  for (const f of S.flakes) {
    f.x += sin(S.t * 1.3 + f.p) * 0.12 * rate;
    if ((f.y += (5 + 4 * f.v) * st) >= LIP) Object.assign(f, { y: SKY - Math.random() * 6, x: XL + Math.random() * (XR - XL) });
  }
}

// The dancer, as a mask: 1 skin, 2 tutu and bodice, 3 tights, 4 hair.
function stamp(M, x, y, r, c) {
  for (let v = max(0, floor(y - r)); v <= min(H - 1, floor(y + r)); v++)
    for (let u = max(0, floor(x - r)); u <= min(W - 1, floor(x + r)); u++) if ((u + 0.5 - x) ** 2 + (v + 0.5 - y) ** 2 <= r * r) M[v * W + u] = c;
}
function limb(M, x0, y0, x1, y1, r, c) {
  const n = Math.ceil(hypot(x1 - x0, y1 - y0) * 2) + 1;
  for (let k = 0; k <= n; k++) stamp(M, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, r, c);
}
function dancer(M, p) {
  const { hx, hy, s, dir } = p;
  const ux = dir * sin(p.lean), uy = -cos(p.lean);
  for (const a of [p.la, p.lb]) limb(M, hx, hy, hx + dir * sin(a) * 9 * s, hy + cos(a) * 9 * s, 0.72, 3);
  const sx = hx + ux * 6.2 * s * p.tq, sy = hy + uy * 6.2 * s * p.tq;
  limb(M, hx, hy, sx, sy, 1.05, 2);
  const ax = sx - ux * 0.6, ay = sy - uy * 0.6;
  for (const a of [p.aa, p.ab]) limb(M, ax, ay, ax + dir * sin(a) * 6 * s, ay + cos(a) * 6 * s, 0.65, 1);
  // The tutu: two layers square to her body.
  const cx = hx + ux * 0.6, cy = hy + uy * 0.6;
  limb(M, cx + uy * 5 * s, cy - ux * 5 * s, cx - uy * 5 * s, cy + ux * 5 * s, 0.85, 2);
  limb(M, cx + ux + uy * 3.8 * s, cy + uy - ux * 3.8 * s, cx + ux - uy * 3.8 * s, cy + uy + ux * 3.8 * s, 0.85, 2);
  const nx = sx + ux * 2.1 * s, ny = sy + uy * 2.1 * s + p.hd;
  stamp(M, nx, ny, 1.75 * s, 1);
  stamp(M, nx + ux * 1.4 * s - dir * 0.5, ny + uy * 1.4 * s, 0.95, 4);
}

// Where the dancer is and how she stands, or null when she is off.
function pose(S) {
  const T = S.c;
  if (S.ph === 1) {
    const u = (T - 0.15) / 3.6;
    if (u < 0 || u > 1) return null;
    const dir = S.dir;
    const lc = ((T - 0.15) / 1.2) % 1;
    const p = { hx: dir > 0 ? -9 + 82 * u : 73 - 82 * u, s: 1, dir, lean: 0, tq: 1, hd: 0, fy: 91, aa: 1.35, ab: -1.35, la: 0.45, lb: -0.45, cy: 79, r: 11, ox: 6, oy: -3 };
    p.hy = 91 - 9 * cos(0.45);
    if (lc < 0.4) {
      p.la = 0.42 * sin((lc / 0.4) * 2 * PI);
      p.lb = -p.la;
      p.hy = 91 - 9 * cos(p.la);
    } else if (lc < 0.88) {
      // The grand jete: a split in the air with the front arm raised.
      const air = sin(PI * ((lc - 0.4) / 0.48));
      const sp = 1.35 * min(1, air * 1.6);
      Object.assign(p, { la: sp, lb: -sp * 1.1, hy: 91 - 9 * max(cos(sp), 0.2) - 6 * air, aa: 1.35 + air, ab: -1.35 - 0.5 * air, lean: 0.08 * air });
    }
    p.lev = sstep(0.05, 0.4, T) * (1 - sstep(3.45, 3.85, T));
    // The operator follows her with the spot, a little behind.
    S.spx = S.spx === undefined || T < 0.2 ? p.hx : S.spx + (p.hx - S.spx) * 0.25;
    p.cx = S.spx;
    return p;
  }
  if (S.ph === 3 && !S.quick) {
    // Her bow in front of the curtain, sinking into the reverence and up again.
    const k = sstep(0.6, 1.3, T) * (1 - sstep(2.1, 2.7, T));
    const la = 0.14 + 0.3 * k;
    const hy = 99 - 9.9 * cos(la);
    return { hx: 31.5, hy, s: 1.1, dir: 1, lean: 0, tq: 1 - 0.5 * k, hd: 2.6 * k, la, lb: -la, aa: 2.5 - 1.9 * k, ab: -2.5 + 1.9 * k, fy: 99, lev: sstep(0, 0.3, T) * (1 - sstep(2.8, 3.15, T)), cx: 31.5, cy: hy - 4, r: 13, ox: 4, oy: 1 };
  }
  return null;
}

// Per row: the beams' light in the air, and their pools on the floor.
const [RB, RP, TX, TY, LI] = [W * 3, W * 3, 6, 6, 6].map((n) => new Float32Array(n));
const HR = new Int16Array(W);
const DCOL = [0, 0, 0, 1, 0.8, 0.68, 1, 0.95, 0.98, 0.95, 0.74, 0.8, 0.42, 0.26, 0.18];
const LIPC = gilt(0.42);

export function draw(display, params) {
  const S = params.s;
  if (!S || S.base < 0) return;
  const { R, G, B, M, arch, archC, fb, house } = S;
  const gel = hsv((0.58 + S.gel) % 1, 0.75, 1);
  const [w0, w1, w2] = gel.map((v) => v + (1 - v) * 0.45);
  const [b0, b1, b2] = gel.map((v) => v + (1 - v) * 0.35);
  const hz = 0.32 + 0.9 * S.haze;
  const fog = 4 + 56 * S.haze;
  const bw = 5.5 + 3 * S.haze;
  const A = S.alb[S.scene];
  const E = S.emi[S.scene];
  const T = S.t;
  const ft = S.foot;
  // The lamps on the bridge, each aimed at a spot on the floor that wanders.
  for (let j = 0; j < 6; j++) {
    TX[j] = AIM[j] + 7 * sin(T * 0.33 + j * 1.9);
    TY[j] = 88 + 4 * sin(T * 0.21 + j * 2.7);
    LI[j] = 0.62 + 0.38 * sin(T * 0.4 + j * 1.3);
  }
  const hem = 94 - S.o * 92;
  for (let x = 0; x < W; x++) HR[x] = round(hem + 0.4 + 0.4 * sin(fb[x]));
  const p = pose(S);
  M.fill(0);
  const lev = p && p.lev > 0.04 ? p.lev : 0;
  if (lev) dancer(M, p);
  const DL = 250 * (0.3 + 0.7 * lev);

  for (let y = 0; y < H; y++) {
    RB.fill(0);
    RP.fill(0);
    for (let j = 0; y > LENS && y < LIP && j < 6; j++) {
      if (y > TY[j] + 1) continue;
      const lx = LAMPS[j] + 0.5, ly = LENS + 1;
      const dx = TX[j] - lx, dy = TY[j] - ly;
      const inv = 1 / (dx * dx + dy * dy);
      const tt = clamp((y + 0.5 - ly) / dy, 0, 1);
      const rc = lx + dx * tt;
      const rb = (1.9 + bw * tt) * 1.25;
      const kk = 200 * hz * LI[j];
      // Each beam is a cone in the haze from its lens down to the floor.
      for (let x = max(XL, floor(rc - rb)); x <= min(XR, rc + rb); x++) {
        const ex0 = x + 0.5 - lx, ey0 = y + 0.5 - ly;
        const t = (ex0 * dx + ey0 * dy) * inv;
        if (t < 0 || t > 1) continue;
        const ex = ex0 - t * dx, ey = ey0 - t * dy;
        const wd = 0.9 + bw * t;
        const q = (ex * ex + ey * ey) / (wd * wd);
        if (q >= 1) continue;
        const k = kk * (1 - q) * (1 - q) * (1.25 - 0.55 * t);
        RB[x * 3] += b0 * k; RB[x * 3 + 1] += b1 * k; RB[x * 3 + 2] += b2 * k;
      }
      const qy = (y + 0.5 - TY[j]) / 3;
      if (y >= BACK && qy * qy < 1)
        for (let x = max(XL, floor(TX[j] - 7.5)); x <= min(XR, TX[j] + 7.5); x++) {
          const qx = (x + 0.5 - TX[j]) / 7.5;
          const q = 1 - qx * qx - qy * qy;
          if (q <= 0) continue;
          const k = 220 * LI[j] * q * sqrt(q);
          RP[x * 3] += b0 * k; RP[x * 3 + 1] += b1 * k; RP[x * 3 + 2] += b2 * k;
        }
    }
    const spotRow = lev && abs(y + 0.5 - p.cy) < p.r + 1.5;
    const lv = ft * (0.22 + 0.78 * clamp((y - TOP) / (CURT - TOP), 0, 1) ** 1.5) + 0.16;
    const fl = ft * 70 * clamp((y - BACK) / (LIP - BACK), 0, 1) ** 2;

    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const hr = HR[x];
      let r, g, b;
      if (arch[i]) (r = archC[i * 3]), (g = archC[i * 3 + 1]), (b = archC[i * 3 + 2]);
      else if (y > LIP + 1) (r = house[i * 3] * ft), (g = house[i * 3 + 1] * ft), (b = house[i * 3 + 2] * ft);
      else if (y === LIP) {
        const on = (x - XL) % 4 === 1;
        r = on ? 255 : 190 * ft; g = (on ? 215 : 120) * ft; b = (on ? 140 : 50) * ft;
      } else if (y === LIP + 1) [r, g, b] = LIPC;
      else {
        if (y < hr + 3 - (x & 1)) {
          if (y < hr - 2) {
            // The house curtain in velvet folds, lit from the footlights below.
            const q = 0.5 + 0.5 * sin(fb[x] + 0.5 * sin((y - hem) * 0.09 + x * 0.6) * (0.4 + sstep(12, 0, hr - y)));
            const v = 0.16 + 0.84 * q * (0.4 + 0.6 * q);
            const sh = 26 * v * v * v * v * lv;
            r = 250 * v * lv + sh + w0 * 18 * v; g = r * 0.05 + sh + w1 * 10 * v; b = r * 0.09 + sh + w2 * 14 * v;
          } else {
            // The gold braid, and the fringe that hangs below it.
            const gv = (y < hr ? ((x + y) & 1 ? 0.95 : 0.62) : x & 1 ? 0.5 - 0.12 * (y - hr) : 0.88 - 0.1 * (y - hr)) * (0.35 + 0.75 * lv);
            [r, g, b] = gilt(gv);
          }
        } else if (y < TRUSS) r = g = b = 3;
        else if (y < SKY) {
          const lace = y === TRUSS || y === SKY - 1 || (x + y) % 4 === 0 || (x - y + 64) % 4 === 0;
          r = g = lace ? 52 : 4;
          b = lace ? 58 : 5;
        } else {
          if (y < BACK) {
            r = A[i * 3] * w0 * 165 + E[i * 3]; g = A[i * 3 + 1] * w1 * 165 + E[i * 3 + 1]; b = A[i * 3 + 2] * w2 * 165 + E[i * 3 + 2];
            if (S.scene === 0 && y >= 56) {
              // The moon's path: short glints on the swell, wider toward us.
              const gd = abs(x + 0.5 - 43) / (2 + (y - 56) * 0.22);
              const cell = floor((x + 0.5 * y) / 3) + y * 31;
              const gl = gd < 1.5 ? hash(cell + floor(T * 3 + hash(cell) * 9) * 4096) - 0.6 - 0.18 * gd * gd : 0;
              if (gl > 0) { r += gl * 480; g += gl * 480; b += gl * 430; }
            } else if (S.scene === 2) {
              const w = WIN[i];
              if (w >= 0 && S.won[w]) { r += 235; g += 170; b += 80; }
              if (x === 46 && y === 25 && T % 1.6 < 0.3) r += 255;
            }
          } else {
            // The floor, lit by the wash and the lamps' pools.
            const fa = S.floorA[i];
            r = fa * (w0 * 55 + fl + RP[x * 3]); g = fa * 0.88 * (w1 * 55 + fl * 0.7 + RP[x * 3 + 1]); b = fa * 0.76 * (w2 * 55 + fl * 0.35 + RP[x * 3 + 2]);
          }
          if (y > LENS) {
            r += RB[x * 3]; g += RB[x * 3 + 1]; b += RB[x * 3 + 2];
          } else
            for (let j = 0; j < 6; j++) {
              // A lamp hangs from its yoke, the lens shining down.
              const d = abs(x - LAMPS[j]);
              if (d > 1 || (y === SKY && d)) continue;
              if (y < LENS) r = g = b = y === SKY ? 60 : d ? 34 : 70;
              else {
                const k = (0.45 + 0.55 * LI[j]) * (d ? 190 : 255);
                r = b0 * k; g = b1 * k; b = b2 * k;
              }
            }
        }
        // Haze in the air, lit by the wash.
        r += fog * w0; g += fog * w1; b += fog * w2;
        if (spotRow) {
          // The follow spot: a pool of white light, with her shadow in it.
          const ddx = x + 0.5 - p.cx, ddy = y + 0.5 - p.cy;
          const inn = sstep(p.r + 1.5, p.r - 1.5, sqrt(ddx * ddx + ddy * ddy)) * lev;
          if (inn > 0) {
            const bx = floor(p.hx + (x + 0.5 - p.hx - p.ox) / 1.2);
            const by = floor(p.fy + (y + 0.5 - p.fy - p.oy) / 1.2);
            const shade = bx >= 0 && bx < W && by >= 0 && by < H && M[by * W + bx] && !M[i];
            const k = shade ? inn * 0.1 : inn;
            const dk = (1 + 1.1 * k) * (shade ? 0.55 : 1);
            r = r * dk + 62 * k; g = g * dk + 58 * k; b = b * dk + 52 * k;
          }
        }
        const c = M[i];
        if (c) { r = DCOL[c * 3] * DL; g = DCOL[c * 3 + 1] * DL; b = DCOL[c * 3 + 2] * DL; }
      }
      R[i] = r; G[i] = g; B[i] = b;
    }
  }

  // Paper snow falls from the flies in front of the backcloth.
  for (const f of S.scene === 3 ? S.flakes : []) {
    const x = floor(f.x), y = floor(f.y), i = y * W + x;
    if (y >= SKY && y >= HR[x] + 3 && !arch[i]) {
      R[i] += 190; G[i] += 195; B[i] += 210;
    }
  }
  for (let i = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) display.setPixel(x, y, R[i] > 255 ? 255 : R[i], G[i] > 255 ? 255 : G[i], B[i] > 255 ? 255 : B[i]);
}
