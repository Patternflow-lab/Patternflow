// ===== Patternflow pattern =====
// Title:   Smalti
// Family:  glass
// Idea:    A Ravenna mosaic of glass and gold tesserae set in dark mortar, a starry vault over a white-robed apostle, where a carried lamp wanders across the wall and every gold tessera, set at its own small tilt, flashes as the light finds its angle.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 19, after the starry vault and the apostles of the Mausoleum of Galla Placidia, Ravenna
// Round:   19
// ===============================
// @matrix 64x128
// @knobs Light=0..1, Speed=0.2..3, Tesserae=2..4, Gold=0..1
//
// Knob 1: Light. The colour of the lamp, from a pale white flame at 0 to a small amber oil flame at 1 that throws a smaller pool and leaves the rest of the chapel dim.
// Knob 2: Speed. How fast the lamp is carried about: at 2 it crosses the wall in about six seconds and climbs from the apostle's feet to the cross in about seven.
// Knob 3: Tesserae. How big the cubes of the blue ground and the grass are, from 2 LEDs across to 4; the gold work and the apostle keep their fine cubes.
// Knob 4: Gold. At 0.06 only the stars, the cross, the rim and the halo are gold; turned up, a gold ground spreads out from the cross, over the whole vault by 0.5 and down the whole wall by 1.

const W = 64;
const H = 128;
const N = W * H;
const TAU = Math.PI * 2;
// The vault: a disc of blue round the cross, with a banded rim.
const VX = 32;
const VY = 37;
const VR = 31.5;
// A frieze under the vault, then the niche where the apostle stands.
const FR0 = 70;
const FR1 = 78;
const GROUND = 120;
// Kinds of tessera.
const BLUE = 0;
const NAVY = 1;
const GOLD = 2;
const RED = 3;
const WHITE = 4;
const GREY = 5;
const PURPLE = 6;
const FLESH = 7;
const HAIR = 8;
const GREEN = 9;
const LEAF = 10;
const SKY = 11;
const BROWN = 12;
const PEARL = 13;
const KINDS = 14;
const BASE = [
  [38, 62, 200],
  [28, 44, 172],
  [204, 160, 58],
  [214, 50, 36],
  [232, 232, 220],
  [158, 170, 204],
  [172, 70, 160],
  [240, 188, 152],
  [116, 66, 38],
  [52, 166, 84],
  [124, 190, 64],
  [70, 112, 230],
  [150, 92, 50],
];
// A flash off gold leaf is a pale gold, not white.
const FLASH = [255, 240, 186];
// The gold work is set in cubes of 2 LEDs whatever the ground: the cross in
// two columns, and each star as a cube with four cubes round it. Steps are
// of 3 LEDs, a cube and its mortar.
const CROSS = [];
for (let by = -3; by <= 3; by++) CROSS.push([-1, by], [0, by]);
for (const bx of [-3, -2, 1, 2]) CROSS.push([bx, -2], [bx, -1]);
const STAR = [
  [0, 0],
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];
const DOT = [[0, 0]];
// The apostle, cube by cube: a gold halo, a white robe with purple stripes,
// both forearms raised in prayer, sandals on the grass. Faces and haloes were
// set in finer cubes than the ground in Ravenna too, so the figure keeps its
// 2 LED cubes at every Tesserae setting.
const SPRITE = [
  "....GGGGG....",
  ".F.GGHHHGG.F.",
  ".F.GHFFFHG.F.",
  ".W.GGFFFGG.W.",
  ".W..GGHGG..W.",
  ".WWWWWWWWWWS.",
  "...WPWWWPS...",
  "...WPWWWPS...",
  "...WPWWWPSS..",
  "..WWPWWWPWS..",
  "..WWPWWWPWS..",
  "..WWPWWWPWS..",
  "..WWWWWWWWS..",
  "....B...B....",
];
const LETTER = { G: GOLD, H: HAIR, F: FLESH, W: WHITE, S: GREY, P: PURPLE, B: BROWN };
const APOSTLE = [];
SPRITE.forEach((row, by) => [...row].forEach((ch, bx) => ch !== "." && APOSTLE.push([bx, by, LETTER[ch]])));
// Rings of stars round the cross: radius, count, turn, and whether each is
// a full star or a single cube.
const STARS = [
  [11.5, 6, 0.5, 0],
  [19.5, 8, 0, 1],
  [26.4, 16, 0.5, 0],
];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function hash(a, b, s) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Cut a run of tesserae along u: each cut sits near a multiple of len,
// moved by up to 0.8 LED, so the cubes come out 1 LED longer or shorter.
function cut(u, len, row, s) {
  const c = Math.floor(u / len);
  if (u < c * len + 1.6 * (hash(row, c, s) - 0.5)) return c - 1;
  if (u >= (c + 1) * len + 1.6 * (hash(row, c + 1, s) - 0.5)) return c + 1;
  return c;
}

// Straight courses laid across the wall, a little wavy, as a mosaicist sets
// a plain ground.
function course(x, y, p, s, region) {
  const v = y + 0.45 * Math.sin(x * 0.21 + s);
  const row = Math.floor(v / p);
  return region * 1e6 + row * 1000 + cut(x + row * 1.7, p, row, s) + 300;
}

// What the design asks for under the courses.
function paint(x, y) {
  const dv = Math.hypot(x - VX, y - VY);
  if (dv < VR) return BLUE;
  if (y < FR0) return NAVY;
  if (y < FR1) return PEARL;
  if (y >= GROUND) {
    if (hash(Math.floor(x / 3), Math.floor(y / 3), 91) < 0.12) return y < GROUND + 4 ? RED : WHITE;
    return y < GROUND + 4 ? LEAF : GREEN;
  }
  return BLUE;
}

// The setting: which tessera a point belongs to.
function layout(x, y, p, s) {
  const dv = Math.hypot(x - VX, y - VY);
  if (dv < VR) return course(x, y, p, s, 1);
  if (y < FR0) return course(x, y, p, s + 1, 3);
  if (y < FR1) {
    const row = y < (FR0 + FR1) / 2 ? 0 : 1;
    return 4e6 + row * 1000 + cut(x + 2 * row, 4, row + 70, s) + 300;
  }
  if (y >= GROUND) return course(x, y - GROUND, p, s + 2, 5);
  return course(x, y, p, s + 7, 10);
}

// Lay a motif cube by cube over the ground: each cube is a 3 by 3 block, its
// last row and column becoming mortar. A cube that would overlap one already
// set is left out.
function setMotif(key, set, x0, y0, cubes, tag) {
  for (const [bx, by, kd] of cubes) {
    const ax = x0 + 3 * bx;
    const ay = y0 + 3 * by;
    let free = ax >= 0 && ay >= 0 && ax + 3 <= W && ay + 3 <= H;
    for (let y = ay; free && y < ay + 3; y++) for (let x = ax; x < ax + 3; x++) if (set[y * W + x] >= 0) free = false;
    if (!free) continue;
    for (let y = ay; y < ay + 3; y++)
      for (let x = ax; x < ax + 3; x++) {
        key[y * W + x] = 2e7 + tag * 1000 + (bx + 20) * 40 + by + 20;
        set[y * W + x] = kd === undefined ? GOLD : kd;
      }
  }
}

function build(P, p) {
  P.p = p;
  const s = P.seed;
  const key = new Float64Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) key[y * W + x] = layout(x + 0.5, y + 0.5, p, s);
  const set = new Int8Array(N).fill(-1);
  setMotif(key, set, 13, 81, APOSTLE, 0);
  setMotif(key, set, VX - 1, VY - 1, CROSS, 1);
  let tag = 2;
  for (const [rr, n, ph, big] of STARS)
    for (let k = 0; k < n; k++) {
      const a = ((k + ph) / n) * TAU - Math.PI / 2;
      setMotif(key, set, Math.round(VX + rr * Math.cos(a) - 1), Math.round(VY + rr * Math.sin(a) - 1), big ? STAR : DOT, tag++);
    }
  // The rim of the vault: a band of red, gold and white cubes.
  const rim = [];
  for (let k = 0; k < 58; k++) {
    const a = (k / 58) * TAU;
    rim.push([Math.round(VX - 1 + 29.9 * Math.cos(a)), Math.round(VY - 1 + 29.9 * Math.sin(a)), [RED, GOLD, WHITE, GOLD][k % 4]]);
  }
  for (const [x, y, kd] of rim) setMotif(key, set, x, y, [[0, 0, kd]], tag++);
  // Small stars in the niche round the apostle, and a flower in each spandrel.
  for (const [sx, sy] of [
    [4, 84],
    [57, 84],
    [4, 106],
    [57, 106],
  ])
    setMotif(key, set, sx, sy, STAR, tag++);
  setMotif(key, set, 3, 2, [[0, 0], [1, 0], [0, 1]], tag++);
  setMotif(key, set, W - 6, 2, [[0, 0], [-1, 0], [0, 1]], tag++);
  // Mortar runs along every join: the LED left of or above a join is mortar.
  const ids = new Int32Array(N);
  const index = new Map();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = y * W + x;
      if ((x < W - 1 && key[q + 1] !== key[q]) || (y < H - 1 && key[q + W] !== key[q])) {
        ids[q] = -1;
        continue;
      }
      let id = index.get(key[q]);
      if (id === undefined) {
        id = index.size;
        index.set(key[q], id);
      }
      ids[q] = id;
    }
  const n = index.size;
  const cx = new Float32Array(n);
  const cy = new Float32Array(n);
  const count = new Float32Array(n);
  const votes = new Float32Array(n * KINDS);
  for (let q = 0; q < N; q++) {
    const id = ids[q];
    if (id < 0) continue;
    const x = q % W;
    const y = (q - x) / W;
    cx[id] += x + 0.5;
    cy[id] += y + 0.5;
    count[id]++;
    votes[id * KINDS + (set[q] >= 0 ? set[q] : paint(x + 0.5, y + 0.5))]++;
  }
  const kind = new Uint8Array(n);
  const tint = new Float32Array(n * 3);
  const tilt = new Float32Array(n * 2);
  const rank = new Float32Array(n);
  let alt = 0;
  for (let i = 0; i < n; i++) {
    cx[i] /= count[i];
    cy[i] /= count[i];
    let best = 0;
    for (let k = 1; k < KINDS; k++) if (votes[i * KINDS + k] > votes[i * KINDS + best]) best = k;
    const dv = Math.hypot(cx[i] - VX, cy[i] - VY);
    // The frieze's upper course alternates red and white cube by cube.
    if (best === PEARL) best = cy[i] < (FR0 + FR1) / 2 ? (alt++ % 2 ? WHITE : RED) : GOLD;
    // The vault's blue pales toward the cross: lighter cubes are mixed in.
    else if (best === BLUE && dv < VR && Math.random() < 0.75 - dv / 30) best = SKY;
    else if (best === BLUE && Math.random() < 0.25) best = NAVY;
    kind[i] = best;
    // Every cube is its own pour of glass: a little lighter or darker,
    // warmer or cooler than the next.
    const v = 0.86 + 0.14 * Math.random();
    for (let c = 0; c < 3; c++) tint[i * 3 + c] = v * (0.9 + 0.2 * Math.random());
    tilt[i * 2] = gauss() * 0.25;
    tilt[i * 2 + 1] = gauss() * 0.25;
    // As Gold turns up, gold ground takes the blue's place nearest the cross
    // first, with a ragged edge.
    rank[i] = 0.78 * clamp(Math.hypot(cx[i] - VX, (cy[i] - VY) * 0.8) / 90, 0, 1) + 0.22 * Math.random();
  }
  // Per LED the glass is uneven in its weaker colours, and the mortar is
  // grainy.
  const jit = new Int8Array(N * 3);
  for (let q = 0; q < N * 3; q++) jit[q] = Math.floor(Math.random() * 31) - 15;
  const mortar = new Uint8Array(N * 3);
  for (let q = 0; q < N; q++) {
    const lv = 5 + Math.floor(Math.random() * 7);
    const m = Math.floor(Math.random() * 3);
    for (let c = 0; c < 3; c++) mortar[q * 3 + c] = c === m ? lv : Math.floor(Math.random() * (lv + 1));
  }
  Object.assign(P, { ids, n, cx, cy, kind, tint, tilt, rank, jit, mortar, col: new Float32Array(n * 3), top: new Uint8Array(n) });
}

function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) * 2;
}

export function setup(params) {
  const P = params;
  P.seed = Math.floor(Math.random() * 1e6);
  P.t = 0;
  P.p = 0;
  P.started = false;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 2, 0.06];
  dt = clamp(dt, 0, 0.1);
  P.warm = clamp(k[0], 0, 1);
  const speed = clamp(k[1], 0, 3) / 2;
  const p = Math.round(clamp(k[2], 2, 4)) + 1;
  P.gold = clamp((k[3] - 0.06) / 0.94, 0, 1);
  if (p !== P.p) build(P, p);
  if (!P.started) {
    P.started = true;
    P.t = 3 + 6 * speed;
  }
  P.t += dt * speed;
}

export function draw(display, params) {
  const P = params;
  if (!P.p) return;
  const t = P.t;
  // The lamp wanders the wall on a slow figure, a little in front of it, and
  // its flame breathes.
  const lx = 32 + 30 * Math.sin(0.5 * t);
  const ly = 70 + 52 * Math.sin(0.29 * t - 0.93);
  const flame = 1 + 0.05 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 11.9 + 1);
  const warm = P.warm;
  const R = 25 - 9 * warm;
  const amb = 0.45 - 0.17 * warm;
  const lc = [1, 0.95 - 0.25 * warm, 0.88 - 0.5 * warm];
  const D2 = 2 * 34;
  const { n, cx, cy, kind, tint, tilt, rank, col, top } = P;
  const gold = P.gold * 1.08;
  for (let i = 0; i < n; i++) {
    let kd = kind[i];
    if ((kd === BLUE || kd === NAVY || kd === SKY) && rank[i] < gold) kd = GOLD;
    const dx = lx - cx[i];
    const dy = ly - cy[i];
    const pool = Math.exp(-(dx * dx + dy * dy) / (2 * R * R));
    const lit = amb + pool * flame;
    // A cube flashes when its tilt sends the lamp straight back at you.
    const gx = tilt[i * 2] - dx / D2;
    const gy = tilt[i * 2 + 1] - dy / D2;
    const flash = Math.exp(-(gx * gx + gy * gy) / 0.035);
    const shine = kd === GOLD ? 1 : 0.18;
    const b = BASE[kd];
    let mx = 0;
    for (let c = 0; c < 3; c++) {
      const v = b[c] * tint[i * 3 + c] * lc[c] * lit * (kd === GOLD ? 1.1 : 1);
      const w = clamp(v + shine * flash * (FLASH[c] * lc[c] - v), 0, 255);
      col[i * 3 + c] = w;
      if (w > col[i * 3 + mx]) mx = c;
    }
    // Even in the dark a cube stands clear of its mortar.
    const hi = col[i * 3 + mx];
    if (hi < 58) for (let c = 0; c < 3; c++) col[i * 3 + c] *= 58 / Math.max(1, hi);
    top[i] = mx;
  }
  const { ids, jit, mortar } = P;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = y * W + x;
      const id = ids[q];
      if (id < 0) {
        display.setPixel(x, y, mortar[q * 3], mortar[q * 3 + 1], mortar[q * 3 + 2]);
        continue;
      }
      const m = top[id];
      const hi = col[id * 3 + m];
      let r = col[id * 3] + jit[q * 3];
      let g = col[id * 3 + 1] + jit[q * 3 + 1];
      let b = col[id * 3 + 2] + jit[q * 3 + 2];
      r = m === 0 ? hi : clamp(r, 0, hi);
      g = m === 1 ? hi : clamp(g, 0, hi);
      b = m === 2 ? hi : clamp(b, 0, hi);
      display.setPixel(x, y, Math.round(r), Math.round(g), Math.round(b));
    }
}
