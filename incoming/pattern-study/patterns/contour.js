// ===== Patternflow pattern =====
// Title:   Contour Map
// Family:  data
// Idea:    A topographic map of slowly heaving land, a contour line every so many metres and every fifth one brighter, tinted green in the lowland and white on the peaks, with a sea that floods whatever lies below it.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// Round:   2
// ===============================
// @matrix 64x128
// @knobs Palette=0..1, Morph=0..6, Interval=50..200, Sea level=-300..600
//
// Knob 1: Palette. The atlas, then a viridis data plot, then neon lines on black, then a survey sheet in dark ink.
// Knob 2: Morph. How fast the land rises and sinks; 0 holds the map still.
// Knob 3: Interval. Metres between contour lines, from a dense survey at 50 to a few wide rings at 200.
// Knob 4: Sea level. Floods the lowland or drains the shelf; the lines stay where the ground is and go under the water.

const W = 64;
const H = 128;
const N = 128;
const LAND_LO = -400;
const LAND_HI = 1400;
const DEEP = 700;
const KEYS = ["fill", "line", "index", "water", "wline", "coast"];
// Where the three slices of the noise are read from.
const OX = [0, 61.3, 17.9];
const OY = [0, 23.7, 88.1];

// Stops are [metres, colour]: land by height, water by depth.
const PALETTES = [
  {
    land: [[-400, 0x2c6e30], [0, 0x2f7a34], [150, 0x5c9a38], [350, 0xa6a64c], [550, 0xb08444], [750, 0x8a5a36], [950, 0x7a625a], [1150, 0xb4aea8], [1400, 0xf2f4f6]],
    water: [[0, 0x3c8ed4], [200, 0x1c52a0], [700, 0x0a1c50]],
    fill: 0.5, line: 0.3, index: 0.7, wline: 0.45, coast: 0xd8f0ff,
  },
  {
    land: [[-150, 0x440154], [50, 0x472d7b], [200, 0x3b528b], [350, 0x2c728e], [500, 0x21918c], [650, 0x28ae80], [800, 0x5ec962], [950, 0xaadc32], [1100, 0xfde725]],
    water: [[0, 0x2a2a34], [700, 0x0e0e14]],
    fill: 0.6, line: 0.3, index: 0.7, wline: 0.35, coast: 0xffffff,
  },
  {
    land: [[-400, 0x00c8ff], [300, 0x00ffa0], [700, 0xc0ff40], [1000, 0xff9020], [1400, 0xff40c0]],
    water: [[0, 0x082050], [700, 0x020818]],
    fill: 0.08, line: 0, index: 0.55, wline: 0.6, coast: 0x60ffe0,
  },
  {
    // Dark ink on paper: here the index lines are heavier, not brighter.
    land: [[-400, 0xe0d0a8], [1400, 0xc8ae86]],
    water: [[0, 0x6c9cac], [700, 0x48788c]],
    fill: 0.58, ink: 0x3a2412, inkIndex: 0x1a0c04, wink: 0x1e3c58, coast: 0x102c4a,
  },
];

function hash(x, y, s) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// Tileable gradient noise, three octaves, zero mean and unit spread. Value
// noise was tried first; its contours run along the lattice. A fourth
// octave put a wiggle in every line that the panel cannot draw.
function bake(seed) {
  const tex = new Float32Array(N * N);
  let amp = 1;
  for (let o = 0; o < 3; o++) {
    const cells = 4 << o;
    const size = N / cells;
    for (let y = 0; y < N; y++) {
      const gy = Math.floor(y / size);
      const fy = y / size - gy;
      const uy = fade(fy);
      for (let x = 0; x < N; x++) {
        const gx = Math.floor(x / size);
        const fx = x / size - gx;
        const ux = fade(fx);
        let top = 0;
        let bottom = 0;
        for (let c = 0; c < 4; c++) {
          const cx = (gx + (c & 1)) % cells;
          const cy = (gy + (c >> 1)) % cells;
          const a = hash(cx, cy, seed * 8 + o) * 6.2832;
          const d = Math.cos(a) * (fx - (c & 1)) + Math.sin(a) * (fy - (c >> 1));
          if (c === 0) top = d;
          else if (c === 1) top += (d - top) * ux;
          else if (c === 2) bottom = d;
          else bottom += (d - bottom) * ux;
        }
        tex[y * N + x] += (top + (bottom - top) * uy) * amp;
      }
    }
    amp *= 0.4;
  }
  let sum = 0;
  for (let i = 0; i < tex.length; i++) sum += tex[i];
  const mean = sum / tex.length;
  let sq = 0;
  for (let i = 0; i < tex.length; i++) sq += (tex[i] - mean) * (tex[i] - mean);
  const sd = Math.sqrt(sq / tex.length);
  for (let i = 0; i < tex.length; i++) tex[i] = (tex[i] - mean) / sd;
  return tex;
}

function ramp(out, stops, lo, hi, scale, toward, mix) {
  const n = out.length / 3;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const m = lo + ((hi - lo) * i) / (n - 1);
    while (s < stops.length - 2 && m > stops[s + 1][0]) s++;
    const a = stops[s];
    const b = stops[Math.min(stops.length - 1, s + 1)];
    const f = b[0] === a[0] ? 0 : Math.max(0, Math.min(1, (m - a[0]) / (b[0] - a[0])));
    for (let c = 0; c < 3; c++) {
      const sh = 16 - c * 8;
      const v = ((a[1] >> sh) & 255) * (1 - f) + ((b[1] >> sh) & 255) * f;
      out[i * 3 + c] = (v + (toward - v) * mix) * scale;
    }
  }
}

// One palette as five tables: land fill, land line, index line, water fill, water line.
function tables(p) {
  const t = {
    fill: new Float32Array(128 * 3),
    line: new Float32Array(128 * 3),
    index: new Float32Array(128 * 3),
    water: new Float32Array(64 * 3),
    wline: new Float32Array(64 * 3),
    coast: new Float32Array(3),
  };
  ramp(t.fill, p.land, LAND_LO, LAND_HI, p.fill, 0, 0);
  ramp(t.water, p.water, 0, DEEP, 1, 0, 0);
  if (p.ink) {
    ramp(t.line, [[0, p.ink], [1, p.ink]], 0, 1, 1, 0, 0);
    ramp(t.index, [[0, p.inkIndex], [1, p.inkIndex]], 0, 1, 1, 0, 0);
    ramp(t.wline, [[0, p.wink], [1, p.wink]], 0, 1, 1, 0, 0);
  } else {
    ramp(t.line, p.land, LAND_LO, LAND_HI, 0.85, 255, p.line);
    ramp(t.index, p.land, LAND_LO, LAND_HI, 1, 255, p.index);
    ramp(t.wline, p.water, 0, DEEP, 1, 200, p.wline);
  }
  t.coast[0] = (p.coast >> 16) & 255;
  t.coast[1] = (p.coast >> 8) & 255;
  t.coast[2] = p.coast & 255;
  return t;
}

export function setup(params) {
  params.tex = bake(1);
  params.e = new Float32Array(W * H);
  params.cx = new Int32Array(3 * W);
  params.cf = new Float32Array(3 * W);
  params.ry = new Int32Array(3 * H);
  params.rf = new Float32Array(3 * H);
  params.wk = new Float32Array(3);
  params.sets = PALETTES.map(tables);
  params.mix = tables(PALETTES[0]);
  params.palKey = -1;
  params.phi = 0.6;
  params.psi = 0;
  params.drift = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 50, 0.06];
  dt = Math.min(dt, 0.1);
  const morph = Math.max(0, k[1]);
  params.phi += dt * morph * 0.0075;
  params.psi += dt * morph * 0.003;
  params.drift += dt * morph * 0.016;
  params.interval = Math.max(10, k[2]);
  params.sea = k[3];

  // Four palettes in a row, each held for a while before it blends into the next.
  const pos = Math.max(0, Math.min(1, k[0])) * (PALETTES.length - 1);
  if (pos !== params.palKey) {
    params.palKey = pos;
    const a = Math.min(PALETTES.length - 2, Math.floor(pos));
    const u = pos - a;
    const g = Math.max(0, Math.min(1, (u - 0.2) / 0.6));
    const m = g * g * (3 - 2 * g);
    const A = params.sets[a];
    const B = params.sets[a + 1];
    for (const key of KEYS) {
      const o = params.mix[key];
      for (let i = 0; i < o.length; i++) o[i] = A[key][i] * (1 - m) + B[key][i] * m;
    }
  }
}

export function draw(display, params, time) {
  const tex = params.tex;
  const e = params.e;
  // The land is three slices of one noise, turned slowly against each other,
  // so hills swell and sink in place instead of sliding past.
  const c1 = Math.cos(params.phi);
  const s1 = Math.sin(params.phi);
  const c2 = Math.cos(params.psi) * s1;
  const s2 = Math.sin(params.psi) * s1;
  const s = 0.6;
  const dr = params.drift;
  // Each slice is read at the same columns in every row and the same rows in
  // every column, so the lattice lookups are worked out once per frame.
  const cx = params.cx;
  const cf = params.cf;
  const ry = params.ry;
  const rf = params.rf;
  for (let k = 0; k < 3; k++) {
    for (let x = 0; x < W; x++) {
      const u = x * s + dr + OX[k];
      const fu = Math.floor(u);
      cx[k * W + x] = fu & (N - 1);
      cf[k * W + x] = u - fu;
    }
    for (let y = 0; y < H; y++) {
      const v = y * s + dr * 0.4 + OY[k];
      const fv = Math.floor(v);
      ry[k * H + y] = (fv & (N - 1)) * N;
      rf[k * H + y] = v - fv;
    }
  }
  const wk = params.wk;
  wk[0] = c1;
  wk[1] = c2;
  wk[2] = s2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) e[y * W + x] = 0;
    for (let k = 0; k < 3; k++) {
      const r0 = ry[k * H + y];
      const r1 = (r0 + N) & (N * N - 1);
      const ty = rf[k * H + y];
      const w = wk[k];
      for (let x = 0; x < W; x++) {
        const x0 = cx[k * W + x];
        const x1 = (x0 + 1) & (N - 1);
        const tx = cf[k * W + x];
        const a = tex[r0 + x0];
        const b = tex[r0 + x1];
        const c = tex[r1 + x0];
        const d = tex[r1 + x1];
        e[y * W + x] += (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty) * w;
      }
    }
    for (let x = 0; x < W; x++) {
      const n = e[y * W + x];
      // Peaks a little sharper than valleys, the way real ground erodes.
      e[y * W + x] = 190 + 240 * n + 50 * n * Math.abs(n);
    }
  }

  const P = params.mix;
  const fill = P.fill;
  const line = P.line;
  const index = P.index;
  const water = P.water;
  const wline = P.wline;
  const coast = P.coast;
  const I = params.interval;
  const sea = params.sea;
  const toLand = 127 / (LAND_HI - LAND_LO);
  const toDepth = 63 / DEEP;
  for (let y = 0; y < H; y++) {
    const up = (y === 0 ? 0 : y - 1) * W;
    const row = y * W;
    const down = (y === H - 1 ? H - 1 : y + 1) * W;
    for (let x = 0; x < W; x++) {
      const l = x === 0 ? 0 : x - 1;
      const r = x === W - 1 ? W - 1 : x + 1;
      const h = e[row + x];
      const gx = (e[row + r] - e[row + l]) * 0.5;
      const gy = (e[down + x] - e[up + x]) * 0.5;
      // Metres per LED here, so a height difference becomes a distance.
      const ig = 1 / (Math.sqrt(gx * gx + gy * gy) + 0.5);
      const q = h / I;
      const level = Math.floor(q + 0.5);
      const major = level % 5 === 0;
      // A line is drawn by its distance from the pixel, so it glides as the
      // land moves instead of jumping a whole LED.
      const off = q > level ? q - level : level - q;
      let a = 1 - off * I * ig * (major ? 1.05 : 1.43);
      if (a < 0) a = 0;
      let R;
      let G;
      let B;
      let LR;
      let LG;
      let LB;
      if (h < sea) {
        let d = ((sea - h) * toDepth + 0.5) | 0;
        d = (d > 63 ? 63 : d) * 3;
        R = water[d];
        G = water[d + 1];
        B = water[d + 2];
        LR = wline[d];
        LG = wline[d + 1];
        LB = wline[d + 2];
        if (!major) a *= 0.5;
      } else {
        let i = ((h - LAND_LO) * toLand + 0.5) | 0;
        i = (i < 0 ? 0 : i > 127 ? 127 : i) * 3;
        // Light from the top left, a hillshade under the tint.
        let sh = 1 + (e[up + l] - e[down + r]) * 0.006;
        sh = sh < 0.55 ? 0.55 : sh > 1.45 ? 1.45 : sh;
        R = fill[i] * sh;
        G = fill[i + 1] * sh;
        B = fill[i + 2] * sh;
        const t = major ? index : line;
        LR = t[i];
        LG = t[i + 1];
        LB = t[i + 2];
      }
      R += (LR - R) * a;
      G += (LG - G) * a;
      B += (LB - B) * a;
      // The shore is a line of its own at whatever height the sea stands.
      const c = 1 - (h > sea ? h - sea : sea - h) * ig * 1.25;
      if (c > 0) {
        R += (coast[0] - R) * c;
        G += (coast[1] - G) * c;
        B += (coast[2] - B) * c;
      }
      display.setPixel(x, y, R > 255 ? 255 : R, G > 255 ? 255 : G, B > 255 ? 255 : B);
    }
  }
}
