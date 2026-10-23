// ===== Patternflow pattern =====
// Title:   Needlepoint
// Family:  textile
// Idea:    A needle and wool work a printed canvas in tent stitch on a slate frame, diagonal row after diagonal row from the top right corner, each stitch two lit LEDs across a dark hole, until a parrot cushion, a Berlin rose bouquet or an alphabet sampler is filled in and the frame rolls on a fresh canvas.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 19, after Berlin woolwork, the tent stitch pictures worked from printed charts in the nineteenth century
// Round:   19
// ===============================
// @matrix 64x128
// @knobs Wool=0..1, Speed=0.2..3, Design=0..2, Lamp=0..1
//
// Knob 1: Wool. Turns every wool in the box round the dye wheel together, starting from the natural shades: a green parrot on a teal ground.
// Knob 2: Speed. Stitches a second, 7 at 0.2, 72 at 2 and 108 at 3; at 2 the 1920 stitches of a canvas take 27 seconds.
// Knob 3: Design. Which canvas is on the frame: the parrot cushion, the rose bouquet on black or the sampler with its alphabet and house; turning it rolls the work on to that canvas, and after it the canvases follow in that order.
// Knob 4: Lamp. Where the lamp stands, low on the left at 0, overhead at 0.5, low on the right at 1; the side of each stitch that faces it shines and the far side of the hole falls into shadow.

const W = 64;
const H = 128;
const N = W * H;
// The canvas is 32 stitches across and 60 down, each stitch a 2 by 2 LED cell, between the
// slate frame's two rollers of 4 rows.
const SU = 32;
const SV = 60;
const NS = SU * SV;
const Y0 = 4;
const CH = SV * 2;
// Stitches a second for each unit of Speed, the hold on a finished canvas and the roll on.
const RATE = 36;
const HOLD = 3.5;
const ROLL = 2.4;
const STITCH = 0;
const HOLDING = 1;
const ROLLING = 2;
// A stitch's two yarn LEDs at full wool; the hole between stitches gets GAP of the wool
// on the lamp's side and less on the other. Bare canvas threads sit near PRINT of 255,
// the ground left plain ecru and the motifs printed in a wash of their wool.
const GAP = 0.15;
const RAKE = 0.1;
const SHEEN = 0.18;
const PRINT = 34;
// Grain of the wool: about one fibre in four is JIT levels off in a weaker channel. The
// strongest channel is left alone, so the grain shows as tint, not as brightness.
const JIT = 10;

// The wool box. Index 0 is never used.
const WOOL = [
  [0, 0, 0],
  [36, 122, 170], // 1 teal ground
  [134, 28, 46], // 2 maroon
  [220, 170, 56], // 3 old gold
  [30, 96, 46], // 4 dark green
  [70, 160, 56], // 5 green
  [154, 212, 70], // 6 light green
  [238, 208, 52], // 7 yellow
  [222, 54, 40], // 8 scarlet
  [46, 76, 196], // 9 royal blue
  [230, 222, 196], // 10 ivory
  [44, 36, 34], // 11 near black
  [126, 78, 40], // 12 brown
  [80, 50, 30], // 13 dark brown
  [240, 136, 34], // 14 orange
  [150, 150, 164], // 15 grey
  [34, 30, 56], // 16 Berlin black
  [128, 18, 40], // 17 deep crimson
  [206, 50, 82], // 18 rose
  [238, 118, 152], // 19 pink
  [250, 194, 210], // 20 pale pink
  [244, 222, 120], // 21 pale yellow
  [146, 92, 196], // 22 lilac
  [92, 142, 226], // 23 cornflower
  [222, 204, 156], // 24 cream ground
  [168, 64, 40], // 25 brick
];
const ECRU = [230, 220, 186];
// The ground wool of each chart, which the printer leaves off the canvas.
const GROUND = [1, 16, 24];

// A 3 by 5 alphabet for the sampler, and the three digits of its year.
const FONT = {};
"A010101111101101B110101110101110C011100100100011D110101101101110E111100110100111F111100110100100G011100101101011H101101111101101I111010010010111J001001001101010K101101110101101L100100100100111M101111111101101N110101101101101O010101101101010P110101110100100Q010101101110011R110101110101101S011100010001110T111010010010010U101101101101111V101101101101010W101101111111101X101101010101101Y101101010010010Z111001010100111101011001001011181111011111011115111100110001110"
  .match(/[A-Z1-9][01]{15}/g)
  .forEach((g) => (FONT[g[0]] = g.slice(1)));

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function inPoly(x, y, q) {
  let inside = false;
  for (let i = 0, j = q.length - 2; i < q.length; j = i, i += 2) {
    const xi = q[i];
    const yi = q[i + 1];
    const xj = q[j];
    const yj = q[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segT(x, y, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return clamp(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1), 0, 1);
}

function segDist(x, y, x0, y0, x1, y1) {
  const t = segT(x, y, x0, y0, x1, y1);
  return Math.hypot(x - x0 - t * (x1 - x0), y - y0 - t * (y1 - y0));
}

// How far in from the edge of the canvas a stitch is: 0 on the outer row.
const ring = (u, v) => Math.min(u, SU - 1 - u, v, SV - 1 - v);

// A Berlin rose: shaded from a deep heart to pale outer petals, with curled petal edges.
function rose(put, cx, cy, r, tones) {
  for (let i = 0; i < 4; i++)
    put(tones[i], (u, v) => {
      const d = Math.hypot(u - cx, v - cy) / r;
      if (d > 1) return false;
      const a = Math.atan2(v - cy, u - cx);
      const t = 0.15 + 0.8 * d + 0.22 * Math.sin(5 * a + 7 * d);
      return Math.min(3, Math.floor(clamp(t, 0, 0.999) * 4)) === i;
    });
}

// The three charts, painted stitch by stitch: discs, boxes, polygons, thick lines, leaves.
const CHARTS = [
  // Parrot cushion: a green Amazon parrot with a yellow crown on an orange branch.
  (D, R, P, L, F, put) => {
    put(1, () => true);
    put(2, (u, v) => ring(u, v) === 0 || (ring(u, v) === 1 && (u + v) % 4 === 0));
    put(3, (u, v) => ring(u, v) === 1 && (u + v) % 4 !== 0);
    put(10, (u, v) => ring(u, v) === 2 && (u + v) % 4 === 2);
    // Corner sprigs of cornflowers.
    for (const [x, y, s] of [[4, 50, 1], [27, 52, -1], [27, 6, -1], [4, 8, 1]]) {
      F(4, x, y + 4 * Math.sign(y - 30), x + 3 * s, y, 1.6);
      D(23, x + 3 * s, y, 1.6);
      D(9, x + 3 * s, y, 0.6);
    }
    // The branch and its leaves and fruit.
    L(12, 2, 41, 30, 36, 1.4);
    L(13, 2, 42.5, 30, 37.5, 0.6);
    L(12, 24, 37, 29, 29, 0.9);
    F(4, 6, 41, 3, 33, 1.7);
    F(5, 8, 40, 12, 46, 1.6);
    F(4, 27, 35, 30, 42, 1.6);
    F(5, 28, 31, 25, 25, 1.5);
    D(14, 5, 45, 2);
    D(7, 4.5, 44.5, 0.6);
    D(14, 22, 41.5, 1.8);
    D(7, 21.5, 41, 0.6);
    // The tail, long and green with a red bar and yellow tips.
    P(5, 12, 36, 18, 36, 19, 55, 12, 55);
    put(8, (u, v) => v >= 45 && v <= 46 && inPoly(u, v, [12, 36, 18, 36, 19, 55, 12, 55]));
    put(6, (u, v) => v >= 52 && inPoly(u, v, [12, 36, 18, 36, 19, 55, 12, 55]));
    put(4, (u, v) => v > 36 && (u === 15 || u === 16) && v < 52 && inPoly(u, v, [12, 36, 18, 36, 19, 55, 12, 55]));
    // Body, belly and wing with blue flight feathers and a red shoulder.
    D(5, 15.5, 26, 6, 10.5);
    D(6, 17.5, 27, 3.4, 7.5);
    D(4, 12.5, 28, 4.3, 8.5);
    put(9, (u, v) => ((u - 12.5) / 4.3) ** 2 + ((v - 28) / 8.5) ** 2 <= 1 && v > 31 && (u + v) % 3 !== 0);
    put(23, (u, v) => ((u - 12.5) / 4.3) ** 2 + ((v - 28) / 8.5) ** 2 <= 1 && v > 31 && (u + v) % 3 === 0);
    D(8, 11.5, 23, 2, 1.6);
    // Head, crown, eye and beak.
    D(5, 17, 15, 5, 4.6);
    D(7, 17, 12, 4, 2.6);
    D(6, 18, 17.5, 3, 1.4);
    D(10, 19, 14, 1.3);
    D(11, 19.2, 14, 0.5);
    P(10, 21, 13, 24.5, 14.5, 23.5, 19, 21, 17.5);
    P(11, 21, 17.5, 23, 18.5, 21.5, 19.5);
    // Feet round the branch.
    R(15, 14, 36, 14, 39);
    R(15, 17, 36, 18, 38);
  },
  // Rose bouquet on black: three roses, buds, blue convolvulus and lilac, tied with a gold bow.
  (D, R, P, L, F, put) => {
    put(16, () => true);
    put(4, (u, v) => ring(u, v) === 0);
    put(3, (u, v) => ring(u, v) === 1 && (u + 2 * v) % 6 === 0);
    // Stems gathered into the bow.
    for (const [x, y] of [[15, 30], [10, 40], [23, 40], [6, 22], [26, 20]]) L(4, x, y, 16, 51, 0.6);
    L(4, 16, 51, 13, 56, 0.6);
    L(4, 16, 51, 19, 56, 0.6);
    // Leaves round the flowers.
    for (const [x0, y0, x1, y1] of [[8, 28, 2, 23], [24, 28, 30, 22], [6, 46, 1, 51], [25, 46, 30, 52], [16, 30, 12, 36], [17, 31, 21, 36], [12, 13, 7, 8], [21, 12, 26, 7], [4, 34, 2, 41], [28, 34, 30, 41]])
      F(Math.abs(x0 - 16) > 9 ? 4 : 5, x0, y0, x1, y1, 2);
    // Lilac sprays and convolvulus.
    for (let i = 0; i < 14; i++) D(22, 4 + (i % 3) * 1.6 + Math.floor(i / 3) * 0.4, 14 + Math.floor(i / 3) * 1.8 - (i % 3) * 0.5, 0.7);
    for (let i = 0; i < 12; i++) D(22, 26 - (i % 3) * 1.5, 12 + Math.floor(i / 3) * 1.9 + (i % 3) * 0.4, 0.7);
    for (const [x, y] of [[4, 31], [28, 31], [16, 6]]) {
      D(23, x, y, 2.2);
      D(10, x, y, 0.7);
    }
    // Buds.
    for (const [x, y] of [[9, 9], [23, 8], [3, 44], [29, 45]]) {
      D(18, x, y, 1.2, 1.8);
      put(5, (u, v) => Math.abs(u - x) <= 1 && v === y + 2);
    }
    rose(put, 16, 20, 7.6, [17, 18, 19, 20]);
    rose(put, 9, 37, 5.6, [3, 7, 21, 10]);
    rose(put, 23, 37, 5.6, [17, 8, 18, 19]);
    // The bow.
    P(3, 16, 51, 10, 48, 10, 54);
    P(3, 16, 51, 22, 48, 22, 54);
    D(7, 16, 51, 1.2);
  },
  // Sampler on cream: the alphabet, a band of diamonds, a brick house between two trees, the year.
  (D, R, P, L, F, put) => {
    put(24, () => true);
    put(4, (u, v) => ring(u, v) === 0);
    put(8, (u, v) => ring(u, v) === 1 && (u + v) % 4 === 0);
    const text = (s, u0, v0, c) => {
      for (let i = 0; i < s.length; i++) {
        const g = FONT[s[i]];
        if (g) put(c, (u, v) => u >= u0 + 4 * i && u < u0 + 4 * i + 3 && v >= v0 && v < v0 + 5 && g[(v - v0) * 3 + (u - u0 - 4 * i)] === "1");
      }
    };
    text("ABCDEFG", 2, 4, 9);
    text("HIJKLMN", 2, 11, 17);
    text("OPQRSTU", 2, 18, 4);
    text("VWXYZ", 6, 25, 13);
    put(3, (u, v) => v >= 31 && v <= 33 && Math.abs((u % 4) - 1.5) + Math.abs(v - 32) <= 1.5 && ring(u, v) > 1);
    put(4, (u, v) => v === 32 && u % 4 === 3 && ring(u, v) > 1);
    // House: roof, chimney, walls, door and windows.
    P(13, 15.5, 36, 24, 42, 7, 42);
    R(13, 20, 36, 21, 39);
    R(25, 9, 42, 22, 50);
    R(11, 15, 46, 16, 50);
    for (const x of [11, 19]) {
      R(9, x, 44, x + 1, 45);
      R(7, x, 47, x + 1, 47);
    }
    // Trees and birds.
    for (const x of [4, 27]) {
      P(5, x, 37, x + 2.6, 47, x - 2.6, 47);
      P(4, x, 41, x + 2.6, 47, x - 2.6, 47);
      R(13, x, 48, x, 50);
    }
    for (const [x, y] of [[6, 33], [26, 34]]) {
      R(9, x, y, x + 1, y);
      R(9, x - 1, y - 1, x - 1, y - 1);
      R(9, x + 2, y - 1, x + 2, y - 1);
    }
    R(5, 2, 51, 29, 51);
    text("1851", 8, 53, 17);
  },
];

// Paint a chart into one wool index per stitch.
function buildChart(art) {
  const col = new Uint8Array(NS);
  const put = (c, f) => {
    for (let v = 0; v < SV; v++) for (let u = 0; u < SU; u++) if (f(u, v)) col[v * SU + u] = c;
  };
  const D = (c, cx, cy, rx, ry) => put(c, (u, v) => ((u - cx) / rx) ** 2 + ((v - cy) / (ry || rx)) ** 2 <= 1);
  const R = (c, u0, v0, u1, v1) => put(c, (u, v) => u >= u0 && u <= u1 && v >= v0 && v <= v1);
  const P = (c, ...q) => put(c, (u, v) => inPoly(u, v, q));
  const L = (c, x0, y0, x1, y1, w) => put(c, (u, v) => segDist(u, v, x0, y0, x1, y1) <= w);
  // A leaf from its stalk to its tip, w wide at the middle, with a paler midrib.
  const F = (c, x0, y0, x1, y1, w) => {
    put(c, (u, v) => {
      const t = segT(u, v, x0, y0, x1, y1);
      return segDist(u, v, x0, y0, x1, y1) <= w * 2 * Math.sqrt(t * (1 - t)) + 0.3;
    });
    put(c === 4 ? 5 : 6, (u, v) => {
      const t = segT(u, v, x0, y0, x1, y1);
      return t > 0.15 && t < 0.8 && segDist(u, v, x0, y0, x1, y1) < 0.5;
    });
  };
  art(D, R, P, L, F, put);
  return col;
}

// Basketweave: diagonal rows from the top right corner, down one row and up the next.
const ORDER = new Int16Array(NS);
const RANK = new Int16Array(NS);
const DOWN = new Uint8Array(NS);
{
  let n = 0;
  for (let d = 0; d <= SU - 1 + SV - 1; d++) {
    const v0 = Math.max(0, d - (SU - 1));
    const v1 = Math.min(SV - 1, d);
    for (let i = 0; i <= v1 - v0; i++) {
      const v = d % 2 === 0 ? v0 + i : v1 - i;
      const u = SU - 1 - d + v;
      const s = v * SU + u;
      ORDER[n] = s;
      RANK[s] = n++;
      DOWN[s] = d % 2 === 0 ? 1 : 0;
    }
  }
}

function hueTurn(c, turn) {
  // Rotate a colour round the grey axis, which keeps its level and saturation close.
  const a = turn * 2 * Math.PI;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const k = (1 - cs) / 3;
  const q = Math.sqrt(1 / 3) * sn;
  const m0 = cs + k;
  const m1 = k - q;
  const m2 = k + q;
  return [
    clamp(c[0] * m0 + c[1] * m1 + c[2] * m2, 0, 255),
    clamp(c[0] * m2 + c[1] * m0 + c[2] * m1, 0, 255),
    clamp(c[0] * m1 + c[1] * m2 + c[2] * m0, 0, 255),
  ];
}

export function setup(params) {
  const P = params;
  P.charts = CHARTS.map(buildChart);
  P.buf = new Float32Array(N * 3);
  P.light = new Float32Array(N);
  P.jit = new Float32Array(N * 3);
  P.tone = new Float32Array(NS);
  for (let i = 0; i < N * 3; i++) P.jit[i] = clamp(Math.round(Math.random() + Math.random() - 1), -1, 1);
  for (let s = 0; s < NS; s++) P.tone[s] = 0.93 + 0.12 * Math.random();
  P.wool = [];
  P.print = [];
  P.woolKey = -1;
  P.lampKey = -1;
  P.t = 0;
  P.started = false;
}

function begin(P, d) {
  P.design = d;
  P.k = 0;
  P.phase = STITCH;
}

function startRoll(P, to) {
  P.next = to;
  P.phase = ROLLING;
  P.rollFrom = P.t;
}

function step(P, dt, speed) {
  P.t += dt;
  if (P.phase === STITCH) {
    P.k = Math.min(NS, P.k + dt * RATE * speed);
    if (P.k >= NS) {
      P.phase = HOLDING;
      P.until = P.t + HOLD;
    }
  } else if (P.phase === HOLDING) {
    if (P.t >= P.until) startRoll(P, (P.design + 1) % CHARTS.length);
  } else if (P.t - P.rollFrom >= P.rollDur) begin(P, P.next);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(Math.max(dt, 0), 0.1);
  const wool = clamp(k[0], 0, 1);
  const speed = clamp(k[1], 0.2, 3);
  const pick = Math.round(clamp(k[2], 0, 2));
  P.lamp = clamp(k[3], 0, 1);
  P.rollDur = ROLL * Math.sqrt(2 / speed);
  if (wool !== P.woolKey) {
    P.woolKey = wool;
    for (let i = 0; i < WOOL.length; i++) {
      const c = hueTurn(WOOL[i], wool);
      P.wool[i] = c;
      // The printed chart is a pale wash of the wool over the ecru canvas.
      const m = [0, 1, 2].map((ch) => 0.7 * c[ch] + 0.3 * ECRU[ch]);
      const top = Math.max(m[0], m[1], m[2], 1);
      P.print[i] = m.map((x) => (x / top) * PRINT);
    }
    const e = Math.max(...ECRU);
    P.print[0] = ECRU.map((x) => (x / e) * PRINT * 0.72);
  }
  if (!P.started) {
    P.started = true;
    P.pick = pick;
    begin(P, pick);
    // The canvas has been on the frame a while: over a quarter of it is worked, and seven more
    // seconds go by at the knob's pace before the panel opens.
    P.k = 0.28 * NS;
    for (let i = 0; i < 70; i++) step(P, 0.1, speed);
  }
  if (pick !== P.pick) {
    P.pick = pick;
    if (P.phase === ROLLING) P.next = pick;
    else startRoll(P, pick);
  }
  step(P, dt, speed);
}

// Light from the lamp on each LED, and how far it rakes: -1 from the left, 1 from the right.
function lampLight(P) {
  if (P.lampKey === P.lamp) return;
  P.lampKey = P.lamp;
  // The lamp swings on an arc round the frame, from low on the left over the top to low on the right.
  const a = (P.lamp * 2 - 1) * 1.3;
  const lx = 32 + 96 * Math.sin(a);
  const ly = 56 - 104 * Math.cos(a);
  for (let p = 0; p < N; p++) {
    const dx = (p % W) - lx;
    const dy = Math.floor(p / W) - ly;
    P.light[p] = 0.52 + 0.68 / (1 + (dx * dx + dy * dy) / 8000);
  }
}

export function draw(display, params) {
  const P = params;
  lampLight(P);
  const buf = P.buf;
  const { light, jit, tone, wool, print } = P;
  const s = P.lamp * 2 - 1;
  const shineLL = 1 - SHEEN * s;
  const shineUR = 1 + SHEEN * s;
  const gapUL = GAP - RAKE * s;
  const gapLR = GAP + RAKE * s;
  const rolling = P.phase === ROLLING;
  const off = rolling ? Math.round(clamp((P.t - P.rollFrom) / P.rollDur, 0, 1) * CH) : 0;
  const cur = P.charts[P.design];
  const nxt = rolling ? P.charts[P.next] : cur;
  const k = P.k;
  // The rollers: turned wood, the grain running round them as they turn.
  for (let y = 0; y < H; y++) {
    if (y >= Y0 && y < Y0 + CH) continue;
    const ry = y < Y0 ? y : y - Y0 - CH;
    const sh = [0.5, 0.95, 0.8, 0.45][ry];
    const turn = y < Y0 ? -off : off;
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const g = 0.82 + 0.18 * Math.sin(x * 0.7 + ry * 2.1 + Math.sin((x + turn) * 0.23) * 3);
      const o = p * 3;
      buf[o] = 168 * sh * g;
      buf[o + 1] = 108 * sh * g;
      buf[o + 2] = 56 * sh * g;
    }
  }
  for (let y = Y0; y < Y0 + CH; y++) {
    let r = y - Y0 - off;
    let chart = cur;
    let done = k;
    let ground = GROUND[P.design];
    if (r < 0) {
      r += CH;
      chart = nxt;
      done = 0;
      ground = GROUND[P.next];
    }
    const v = r >> 1;
    const lower = r & 1;
    for (let x = 0; x < W; x++) {
      const u = x >> 1;
      const right = x & 1;
      const st = v * SU + u;
      const c = chart[st];
      const p = y * W + x;
      const o = p * 3;
      const L = light[p];
      let f;
      let col;
      if (RANK[st] < done) {
        col = wool[c];
        // Upper right and lower left are the stitch; the other two are the holes beside it.
        if (right !== lower) f = (right ? shineUR : shineLL) * tone[st] * L;
        else f = (right ? gapLR : gapUL) * L;
      } else {
        col = print[c === ground ? 0 : c];
        f = right && lower ? 0.12 : Math.sqrt(L);
      }
      let r0 = col[0] * f;
      let g0 = col[1] * f;
      let b0 = col[2] * f;
      // Wool grain, in the weaker channels only.
      const mx = Math.max(r0, g0, b0);
      const amp = Math.min(1, mx / 60) * JIT;
      if (r0 !== mx) r0 += jit[o] * amp;
      if (g0 !== mx) g0 += jit[o + 1] * amp;
      if (b0 !== mx) b0 += jit[o + 2] * amp;
      buf[o] = r0;
      buf[o + 1] = g0;
      buf[o + 2] = b0;
    }
  }
  if (P.phase === STITCH && k < NS) drawNeedle(P, cur, buf);
  for (let p = 0; p < N; p++) {
    const o = p * 3;
    display.setPixel(p % W, Math.floor(p / W), clamp(buf[o], 0, 255), clamp(buf[o + 1], 0, 255), clamp(buf[o + 2], 0, 255));
  }
}

function dot(buf, x, y, c) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  for (let ch = 0; ch < 3; ch++) buf[o + ch] = c[ch];
}

// The needle lies slanting on the bare canvas with its point in the next hole, and the
// slack wool hangs in a loop from the last stitch down and up to its eye.
function drawNeedle(P, chart, buf) {
  const n = Math.floor(P.k);
  const st = ORDER[n];
  const u = st % SU;
  const v = (st - u) / SU;
  const tx = 2 * u;
  const ty = Y0 + 2 * v + 1;
  // On a row going down the needle lies nearly upright, on a row going up nearly level,
  // the way basketweave is worked.
  const dx = DOWN[st] ? -0.55 : -1;
  const dy = DOWN[st] ? 1 : 0.55;
  const ex = tx + dx * 7;
  const ey = ty + dy * 7;
  const wc = P.wool[chart[st]];
  const yarn = [0, 1, 2].map((ch) => Math.min(255, wc[ch] * 1.25 + 24));
  const prev = n > 0 ? ORDER[n - 1] : st;
  const pu = prev % SU;
  const px = 2 * pu + 1;
  const py = Y0 + 2 * ((prev - pu) / SU);
  // The loop swings a little as the needle is pulled through.
  const sway = Math.sin(P.t * 2.3) * 3;
  const sag = 13 + 2 * Math.sin(P.t * 1.7);
  const c1x = px + 7 + sway;
  const c1y = py + sag;
  const c2x = ex + 1 + sway;
  const c2y = ey + sag;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = (1 - t) ** 3;
    const b = 3 * t * (1 - t) ** 2;
    const c = 3 * t * t * (1 - t);
    const d = t ** 3;
    dot(buf, a * px + b * c1x + c * c2x + d * ex, a * py + b * c1y + c * c2y + d * ey, yarn);
  }
  // The steel: a bright point, the shaft and the eye.
  for (let i = 0; i <= 8; i++) {
    const g = i === 7 ? 0.4 : i === 0 ? 1 : 0.85;
    dot(buf, tx + dx * i, ty + dy * i, [205 * g, 212 * g, 226 * g]);
  }
}
