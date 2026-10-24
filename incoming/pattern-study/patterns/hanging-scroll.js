// ===== Patternflow pattern =====
// Title:   Hanging Scroll
// Family:  paper
// Idea:    A hanging scroll in a dim alcove lets its weighted roller down from the upper rod to show an ink painting on ivory paper in silk borders row by row, hangs swaying in a draft, then rolls up from the bottom so the next painting can come down.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 23, after Japanese kakemono hanging scrolls and Song dynasty ink landscapes
// Round:   23
// ===============================
// @matrix 64x128
// @knobs Lamp=0..1, Speed=0.2..3, Painting=0..3, Ink=0..1
//
// Knob 1: Lamp. The light on the scroll: a warm candle low on the left turns the paper ivory at 0, and towards 1 it gives way to cool moonlight from a window on the right.
// Knob 2: Speed. How fast the scroll moves: at 2 the roller takes under three seconds to come down, a painting hangs for seven and the draft swings it about once in two and a half.
// Knob 3: Painting. Which painting unrolls next: misty mountains with a waterfall at 0, bamboo in wind at 1, a plum branch under the moon at 2, cranes over waves at 3. Turning it rolls the scroll up and lets that one down.
// Knob 4: Ink. How wet the ink was: crisp dry-brush lines with broken edges at 0, washes that bled out into the paper and strokes feathered at their edges at 1.
// Buttons: K1 tap rolls the scroll up now and unrolls the next painting.

const [W, H] = [64, 128];
const N = W * H;
// The scroll hangs from a nail at row 3. Its upper rod fills rows 15 and 16,
// and the mounting runs 96 rows down from row 17 to the roller, 44 columns
// wide from column 10. The painting sits inside the mounting, 36 by 74.
const [NAIL, TOP, LEN, MX, MW] = [3, 17, 96, 10, 44];
const [PX, PY, PW, PH] = [4, 14, 36, 74];
const PN = PW * PH;
// At Speed 2, in seconds: unroll, hang, roll up, rest rolled.
const [TU, TS, TR, TZ] = [2.6, 7, 2, 0.5];
const [PAPER, SILK, GOLD, BACK] = [[0.95, 0.91, 0.8], [0.2, 0.31, 0.3], [0.8, 0.61, 0.27], [0.6, 0.58, 0.5]];
const [WOOD, BONE, BRASS, CORD] = [[0.4, 0.27, 0.16], [0.86, 0.8, 0.64], [0.85, 0.66, 0.32], [0.5, 0.3, 0.45]];
// Seal vermilion, plum blossom and the red sun.
const PIG = [[0.82, 0.14, 0.1], [0.9, 0.3, 0.42], [0.93, 0.3, 0.12]];
const CANDLE = [1, 0.9, 0.72];
const MOON = [0.56, 0.67, 0.92];
const { min, max, floor, ceil, round, sqrt, sin, cos, exp, abs, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
// A fixed hash and a value noise made from it, so a painting comes out the
// same every time it unrolls.
const hash = (a, b) => {
  let h = Math.imul((a | 0) * 374761393 + (b | 0) * 668265263, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vn = (x, y) => {
  const i = floor(x);
  const j = floor(y);
  const [u, v] = [sm(0, 1, x - i), sm(0, 1, y - j)];
  const [a, b, c] = [hash(i, j), hash(i + 1, j), hash(i, j + 1)];
  return a + (b - a) * u + (c - a) * v + (a - b - c + hash(i + 1, j + 1)) * u * v;
};

// The painting being made: wash and stroke densities, pigment cover and which
// pigment. RID is a ridge row per column for fill(), ROC how solid it is there.
let Wm, Sm, Am, Pg;
let rs = 1;
const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
const RID = new Float32Array(PW);
const ROC = new Float32Array(PW);

// A brush stroke through points [x, y, half width, ...]. dry parts the hairs
// into streaks along the stroke, more of them toward its end.
function brush(p, dens, dry = 0) {
  const n = p.length / 3 - 1;
  for (let k = 0; k < n; k++) {
    const [ax, ay, aw, bx, by, bw] = p.slice(k * 3, k * 3 + 6);
    const dx = bx - ax;
    const dy = by - ay;
    const L2 = dx * dx + dy * dy || 1e-6;
    const L = sqrt(L2);
    const m = max(aw, bw) + 1;
    for (let y = max(0, floor(min(ay, by) - m)); y <= min(PH - 1, floor(max(ay, by) + m)); y++)
      for (let x = max(0, floor(min(ax, bx) - m)); x <= min(PW - 1, floor(max(ax, bx) + m)); x++) {
        const qx = x + 0.5 - ax;
        const qy = y + 0.5 - ay;
        const t = cl((qx * dx + qy * dy) / L2, 0, 1);
        let a = cl(aw + (bw - aw) * t + 0.5 - hypot(qx - dx * t, qy - dy * t), 0, 1);
        if (a <= 0) continue;
        if (dry) {
          const g = (dry * (k + t)) / n;
          const c = (qx * dy - qy * dx) / L;
          a *= 0.15 + 0.85 * sm(g - 0.1, g + 0.1, 0.55 * hash(floor(c * 1.8) + 99, floor(t * L * 0.5) + k * 31) + 0.45 * vn(x * 0.9, y * 0.9));
        }
        const i = y * PW + x;
        // A negative density leaves the paper bare instead.
        if (dens < 0) Wm[i] *= 1 + dens * a;
        else Sm[i] = max(Sm[i], a * dens);
      }
  }
}

// A round patch of pigment, which leaves no wash under it.
function disc(cx, cy, r, pg, a0 = 0.92) {
  for (let y = max(0, floor(cy - r - 1)); y < min(PH, cy + r + 1); y++)
    for (let x = max(0, floor(cx - r - 1)); x < min(PW, cx + r + 1); x++) {
      const a = cl(r + 0.5 - hypot(x + 0.5 - cx, y + 0.5 - cy), 0, 1);
      const i = y * PW + x;
      if (a > Am[i]) {
        Am[i] = a * a0;
        Pg[i] = pg;
      }
      Wm[i] *= 1 - a;
    }
}

// Fill below the ridge in RID: the wash is darkest at the ridge and fades down
// into mist, and it covers what was painted behind. edge inks the ridge line
// and cun the short texture strokes under it.
function fill(dens, fade, edge, cun, sd) {
  for (let x = 0; x < PW; x++) {
    const r = RID[x];
    const oc = ROC[x];
    for (let y = max(0, floor(r)); y < PH; y++) {
      // The row the ridge crosses is covered only in part.
      const cv = cl(y + 1 - r, 0, 1) * oc;
      const d = max(0, y + 0.5 - r);
      const i = y * PW + x;
      const o = 0.92 * cl(d / 2 + 0.3, 0, 1) * cv;
      Wm[i] = min(1, Wm[i] * (1 - o) + dens * exp(-d / fade) * (0.7 + 0.6 * vn(x * 0.5 + sd, y * 0.2)) * cv);
      Sm[i] *= 1 - o;
      if (d < 1.5) Sm[i] = max(Sm[i], edge * (1 - d / 1.7) * (0.35 + 0.65 * vn(x * 1.3 + sd, y * 0.5)) * cv);
      const c = vn(x * 1.2 + sd, y * 0.3);
      if (c > 0.64) Sm[i] = max(Sm[i], cun * (c - 0.6) * 2.6 * exp(-d / (fade * 0.8)) * oc);
    }
  }
}

function mtn(cx, base, hw, ht, dens, fade, edge, cun, sd) {
  for (let x = 0; x < PW; x++) {
    const u = abs(x + 0.5 - cx) / hw;
    RID[x] = u < 1 ? base - ht * (1 - u ** 1.6) * (0.62 + 0.45 * vn(x * 0.28 + sd, sd) + 0.3 * vn(x * 0.8, sd + 5)) : PH;
    ROC[x] = sm(1, 0.75, u);
  }
  fill(dens, fade, edge, cun, sd);
}

// A pine clinging to a ridge: a crooked trunk and flat layers of needles.
function pine(x, y, h, d) {
  brush([x, y, 0.45, x + 0.5, y - h * 0.5, 0.35, x - 0.2, y - h, 0.3], d);
  for (let k = 0; k < 3; k++) {
    const yy = y - h * (0.42 + 0.26 * k);
    const w = h * (0.55 - 0.13 * k);
    brush([x - w, yy + 0.4, 0.45, x + 0.2, yy - 0.3, 0.75, x + w, yy + 0.2, 0.4], d);
  }
}

// A column of characters, each a few short strokes in a square cell, and the
// red seal under it.
function calli(x, y, n) {
  for (let c = 0; c < n; c++) {
    const cy = y + c * 4.6;
    for (let k = 3 + floor(rnd() * 3); k > 0; k--) {
      const t = rnd() * 4;
      const a = x + rnd() * 2.6;
      const b = cy + rnd() * 3;
      brush(t < 1.6 ? [a - 0.3, b, 0.4, min(x + 3.2, a + 2), b + 0.2, 0.35] : t < 3 ? [a, b - 0.4, 0.4, a + 0.2, min(cy + 3.6, b + 2.2), 0.3] : [a, b, 0.55, a + 0.7, b + 0.7, 0.3], 0.92);
    }
  }
  const sy = floor(y + n * 4.6 + 0.6);
  const sx = floor(x + 0.2);
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 3; i++) {
      const k = (sy + j) * PW + sx + i;
      // Carved lines let the paper show through the red.
      Am[k] = (i + j) % 2 && hash(sx + i, sy + j) < 0.6 ? 0.45 : 0.95;
      Pg[k] = 0;
    }
}

function landscape() {
  // The far peak towers over the left, a lower one stands behind on the right.
  mtn(13, 42, 15, 34, 0.32, 10, 0.45, 0.3, 3);
  mtn(29, 40, 9, 12, 0.26, 7, 0.35, 0.25, 11);
  mtn(24, 56, 16, 18, 0.5, 8, 0.85, 0.6, 23);
  for (const x of [15, 18, 21, 31, 34]) pine(x, RID[x] + 1.5, 4 + (x % 3), 0.9);
  // A waterfall drops from a cleft in the middle ridge into the mist.
  for (let y = floor(RID[28] + 3); y < 58; y++)
    for (let x = 25; x < 31; x++) {
      const i = y * PW + x;
      const c = abs(x + 0.5 - 28 - 0.4 * sin(y * 0.45));
      const f = sm(58, 50, y);
      if (c < 0.9) {
        Wm[i] *= 1 - 0.9 * f;
        Sm[i] *= 1 - f;
      } else if (c < 2.4) Sm[i] = max(Sm[i], (0.75 * f * (2.4 - c)) / 1.5);
    }
  mtn(30, 63, 9, 3, 0.3, 2.5, 0.5, 0, 51);
  // The near bank, with a hut under two pines.
  mtn(5, 70, 17, 16, 0.72, 6, 1, 0.85, 37);
  pine(3, RID[3] + 2, 7, 0.95);
  pine(8, RID[8] + 2, 6, 0.95);
  const hy = round(RID[15] + 4);
  for (let j = -4; j <= 1; j++)
    for (let i = 11; i <= 18; i++) {
      Wm[(hy + j) * PW + i] *= 0.1;
      Sm[(hy + j) * PW + i] = 0;
    }
  brush([10.5, hy - 2.2, 0.55, 14.5, hy - 4.6, 0.7, 18.5, hy - 2.2, 0.55], 0.97);
  brush([12, hy - 2, 0.3, 12, hy + 0.6, 0.3], 0.7);
  brush([17, hy - 2, 0.3, 17, hy + 0.6, 0.3], 0.7);
  brush([14.5, hy - 1, 0.45, 14.5, hy + 0.6, 0.45], 0.85);
  // Still water, a boat with its fisherman and his rod.
  brush([19, 66.5, 0.25, 23, 66.5, 0.2], 0.3);
  brush([28, 71.5, 0.25, 34, 71.5, 0.2], 0.28);
  brush([20, 72.5, 0.2, 24, 72.5, 0.2], 0.25);
  brush([22.5, 68, 0.35, 25, 69, 0.6, 28, 68.9, 0.6, 29.5, 67.7, 0.35], 0.92);
  brush([26.5, 68, 0.55, 26.6, 66.4, 0.5], 0.9);
  brush([27, 66.8, 0.25, 31, 63.5, 0.2], 0.6);
  calli(31.6, 1.5, 4);
}

function bamboo() {
  // Three stalks lean in the wind, the far one pale.
  for (const [x0, x1, y1, w, d] of [[6, 11, -2, 1.1, 0.32], [14, 20, -2, 1.7, 0.9], [25, 29, 10, 1.3, 0.72]]) {
    const n = round((75 - y1) / 10.5);
    for (let k = 0; k < n; k++) {
      const ax = mix(x0, x1, k / n);
      const ay = mix(75, y1, k / n);
      const bx = mix(x0, x1, (k + 1) / n);
      const by = mix(75, y1, (k + 1) / n);
      brush([ax, ay - 0.8, w, bx, by + 0.8, w * 0.9], d, 0.45);
      brush([bx - w - 0.5, by + 0.2, 0.45, bx + w + 0.5, by - 0.4, 0.45], min(1, d * 1.1));
    }
  }
  // Leaves stream off the twigs to the right.
  for (const [x, y, n, d, s] of [
    [12, 8, 4, 0.35, 0.9], [9, 40, 4, 0.35, 0.9], [21, 12, 5, 0.92, 1.2], [20, 34, 5, 0.9, 1.15],
    [19, 56, 4, 0.85, 1.05], [29, 24, 5, 0.75, 1], [28, 46, 3, 0.75, 0.95],
  ]) {
    brush([x - 3.5, y + 2.5, 0.35, x, y, 0.25], d);
    for (let j = 0; j < n; j++) {
      const a = 0.35 + (j / (n - 1) - 0.5) * 1.3 + (rnd() - 0.5) * 0.3;
      const L = (8 + rnd() * 4) * s;
      const w = (1 + rnd() * 0.3) * s;
      brush([x, y, 0.25, x + cos(a) * L * 0.3, y + sin(a) * L * 0.3, w, x + cos(a + 0.12) * L, y + sin(a + 0.12) * L, 0.05], d);
    }
  }
  calli(31.4, 42, 5);
}

function plum() {
  // The sky washed grey round a full moon left bare.
  for (let y = 0; y < 50; y++)
    for (let x = 0; x < PW; x++)
      Wm[y * PW + x] = 0.28 * sm(8, 9.6, hypot(x + 0.5 - 23, y + 0.5 - 17)) * sm(50, 18, y) * (0.75 + 0.5 * vn(x * 0.2, y * 0.15));
  // An old branch in dry brush, straight young shoots off it, and red blossom.
  brush([-1, 75, 3, 5, 63, 2.5, 3, 51, 2.1, 10, 41, 1.7, 8, 31, 1.3, 15, 21, 1, 13, 12, 0.6], 0.93, 0.9);
  brush([5, 61, 1.3, 13, 56, 1, 21, 51, 0.75, 29, 42, 0.45], 0.88, 0.8);
  for (const t of [[10, 41, 12, 28], [15, 21, 22, 8], [13, 12, 14, 4], [21, 51, 24, 41], [29, 42, 33, 33], [8, 31, 3, 23], [13, 56, 16, 48], [24, 47, 31, 47]])
    brush([t[0], t[1], 0.45, t[2], t[3], 0.25], 0.85);
  for (const [x, y, r] of [
    [12, 30, 1.5], [12.5, 26, 1.3], [17, 16, 1.4], [20, 11, 1.5], [21.5, 7.5, 1.2], [14, 6, 1.3],
    [22, 44, 1.5], [24, 40.5, 1.2], [31, 37, 1.4], [32.5, 33, 1.2], [5, 25, 1.4], [3, 21.5, 1.2],
    [15.5, 50, 1.4], [27.5, 47, 1.3], [9, 37.5, 1.5], [17.5, 54, 1.3], [6, 57, 1.6], [11, 16.5, 1.1],
  ]) {
    disc(x, y, r, 1);
    Sm[floor(y) * PW + floor(x)] = 0.6;
  }
  calli(31.4, 50, 4);
}

// A red-crowned crane flying left, wings raised (up 1) or lowered (up -1).
function crane(cx, cy, s, up) {
  const u = up * s;
  // The far wing and the near wing are left bare in the grey sky, each with
  // black flight feathers along its trailing edge.
  for (const [fx, d] of [[-2.5, -0.55], [4.5, -0.95]]) {
    const w = [cx, cy - 0.3 * u, 1.9 * s, cx + (fx * 0.4 + 0.6) * s, cy - 5 * u, 1.4 * s, cx + fx * s, cy - 9.5 * u, 0.7 * s];
    brush(w, d);
    brush(w.map((v, k) => (k % 3 === 0 ? v + 1.6 * s : k % 3 === 2 ? 0.3 * s : v)), 0.9);
  }
  brush([cx - 3 * s, cy, 1.3 * s, cx + 3 * s, cy + 0.3 * s, 1.1 * s], -0.95);
  // The black neck, a grey bill, the black tail and the trailing legs.
  brush([cx - 2.6 * s, cy - 0.2 * s, 0.55 * s, cx - 7.8 * s, cy - 1.4 * s, 0.45 * s], 0.95);
  brush([cx - 8.3 * s, cy - 1.4 * s, 0.3, cx - 10.5 * s, cy - 1 * s, 0.2], 0.5);
  brush([cx + 2.5 * s, cy - 0.2 * s, 0.8 * s, cx + 4.3 * s, cy + 0.5 * s, 0.4 * s], 0.9);
  brush([cx + 3 * s, cy + 0.9 * s, 0.3, cx + 9.5 * s, cy + 1.9 * s, 0.25], 0.6);
  disc(cx - 8 * s, cy - 2 * s, 0.6, 0);
}

function cranes() {
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) Wm[y * PW + x] = (0.5 + 0.25 * sm(62, 0, y)) * (0.8 + 0.4 * vn(x * 0.13 + 4, y * 0.09));
  disc(27, 10, 4.4, 2);
  crane(19, 30, 1.3, 1);
  crane(23, 47, 0.95, -1);
  crane(8, 41, 0.5, 1);
  // Rows of waves, each crest inked and its trough left pale.
  for (let b = 0; b < 4; b++) {
    const y0 = 56 + b * 5.4;
    const amp = 1.4 + b * 0.8;
    const f = 0.5 - b * 0.07;
    for (let x = 0; x < PW; x++) {
      RID[x] = y0 - amp * (0.5 + 0.5 * sin(x * f + b * 2.1)) ** 3;
      ROC[x] = 1;
    }
    fill(0.42, 2.6, 0.9, 0, b * 13);
    // A curl of foam breaks off each crest.
    for (let x0 = (PI / 2 - b * 2.1 + 2 * PI * 3) / f; x0 > -2; x0 -= (2 * PI) / f) {
      const py = y0 - amp;
      brush([x0 + 1, py + 0.6, 0.35, x0, py - 0.6, 0.4, x0 - 1.6, py - 0.3, 0.3, x0 - 2.2, py + 0.8, 0.2], 0.85);
    }
  }
  calli(1.6, 2, 4);
}

const PAINT = [landscape, bamboo, plum, cranes];

// Each painting is kept twice: as painted with a dry brush, and as it would
// be had the ink been wet, its washes spread and its strokes bled.
function blur(src, r) {
  let a = src;
  for (let pass = 0; pass < 2; pass++) {
    const b = new Float32Array(PN);
    const c = new Float32Array(PN);
    for (let y = 0; y < PH; y++)
      for (let x = 0; x < PW; x++) {
        let s = 0;
        for (let k = -r; k <= r; k++) s += a[y * PW + cl(x + k, 0, PW - 1)];
        b[y * PW + x] = s / (2 * r + 1);
      }
    for (let y = 0; y < PH; y++)
      for (let x = 0; x < PW; x++) {
        let s = 0;
        for (let k = -r; k <= r; k++) s += b[cl(y + k, 0, PH - 1) * PW + x];
        c[y * PW + x] = s / (2 * r + 1);
      }
    a = c;
  }
  return a;
}

function paint(n) {
  Wm = new Float32Array(PN);
  Sm = new Float32Array(PN);
  Am = new Float32Array(PN);
  Pg = new Uint8Array(PN);
  rs = 11 + n * 7;
  PAINT[n]();
  const wb = blur(Wm, 2);
  const sb = blur(Sm, 1);
  const hb = blur(sb, 2);
  const wh = blur(wb, 3);
  const d0 = new Float32Array(PN);
  const d1 = new Float32Array(PN);
  for (let i = 0; i < PN; i++) {
    // A dry wash catches only the raised fibres of the paper, in streaks.
    const x = i % PW;
    const y = (i / PW) | 0;
    d0[i] = 1 - (1 - Wm[i] * (0.5 + 0.45 * vn(x * 0.25, y * 0.6))) * (1 - Sm[i]);
    d1[i] = 1 - exp(-1.7 * (wb[i] + 0.5 * wh[i]) - 1.5 * (sb[i] + 0.6 * hb[i]));
  }
  return [d0, d1, Am, Pg];
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  const P = (params.s = { F: [F(N), F(N), F(N)], A: [F(N), F(N), F(N)], S: [F(MW * LEN), F(MW * LEN), F(MW * LEN)], L: [F(W), F(W), F(W)] });
  Object.assign(P, { cache: [], base: -1, st: 0, tm: 0, u: 0, u0: 0, hold: 2.2, T: 0, rt: 0, kick: -99, th: 0, bow: 0, tw: 0, built: -1, wetD: -1, lamp: 0, wet: 0.06 });
  // The alcove: an earth wall, a wooden post at the left, and the raised floor
  // with its lacquered front edge.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let c = [0.085, 0.07, 0.055];
      let f = 0.8 + 0.4 * vn(x * 0.25, y * 0.12) + 0.08 * (hash(x, y) - 0.5);
      if (x < 3) {
        c = [0.22, 0.15, 0.09];
        f = (x === 2 ? 0.55 : 1) * (0.85 + 0.3 * vn(x * 2, y * 0.05));
      } else if (y === 120) f = 0.35;
      else if (y > 120 && y < 125) {
        c = [0.2, 0.14, 0.085];
        f = 0.8 + 0.25 * vn(x * 0.06, y * 2) + (y - 121) * 0.06;
      } else if (y >= 125) {
        c = [0.1, 0.075, 0.06];
        f = y === 125 ? 3.2 : 0.6;
      }
      for (let k = 0; k < 3; k++) P.A[k][y * W + x] = c[k] * f;
    }
  // The mounting: silk with a small woven figure, gold brocade strips above
  // and below the painting, and the two hanging strips from the rod.
  for (let y = 0; y < LEN; y++)
    for (let x = 0; x < MW; x++) {
      let c = SILK;
      let f = (0.92 + 0.08 * ((x + y) & 1)) * ((x % 4 === 1 && y % 4 === 1) || (x % 4 === 3 && y % 4 === 3) ? 1.3 : 1);
      if (x >= PX && x < PX + PW && (y === PY - 2 || y === PY - 1 || y === PY + PH || y === PY + PH + 1)) {
        c = GOLD;
        f = (x + 2 * y) % 3 ? 0.88 : 1.15;
      }
      if (x === PX - 1 || x === PX + PW) f *= 0.8;
      const fu = x % 23 > 8 && x % 23 < 12;
      if (fu && y <= 10) {
        c = GOLD;
        f = (x % 23 === 10 ? 1 : 0.8) * (y % 3 ? 0.92 : 1.12);
      } else if (fu && y === 11 && x % 23 !== 10) {
        c = PAPER;
        f = 0.75;
      } else if (x % 23 === 12 && y <= 11) f *= 0.55;
      if (y === 0) f *= 0.65;
      for (let k = 0; k < 3; k++) P.S[k][y * MW + x] = c[k] * f;
    }
}

function roll(P) {
  if (P.st < 2) Object.assign(P, { st: 2, tm: 0, u0: P.u });
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  P.lamp = cl(k[0], 0, 1);
  const rate = cl(k[1], 0.2, 3) / 2;
  const base = cl(round(k[2]), 0, 3);
  P.wet = cl(k[3], 0, 1);
  if (P.base < 0) {
    P.base = P.cur = base;
    P.nx = (base + 1) % 4;
  }
  if (base !== P.base) {
    P.base = P.nx = base;
    roll(P);
  }
  if (input.btnPressed && input.btnPressed[0]) roll(P);
  const st = dt * rate;
  P.T += st;
  P.rt += dt;
  P.tm += st;
  if (P.st === 0) {
    P.u = sm(0, 1, P.tm / TU);
    if (P.tm >= TU) Object.assign(P, { st: 1, tm: 0, kick: P.T });
  } else if (P.st === 1) {
    if (P.tm >= P.hold) roll(P);
  } else if (P.st === 2) {
    P.u = P.u0 * (1 - sm(0, 1, P.tm / (TR * max(0.25, P.u0))));
    if (P.u <= 0) Object.assign(P, { u: 0, st: 3, tm: 0 });
  } else if (P.tm >= TZ) {
    // Rolled up, the scroll is swapped for the next one, which comes down.
    Object.assign(P, { cur: P.nx, nx: (P.nx + 1) % 4, st: 0, tm: 0, hold: TS });
  }
  // The swing: a kick when the roller comes to rest, then the draft.
  const w = (2 * PI) / 2.4;
  const tk = P.T - P.kick;
  const kick = tk > 0 ? 1.7 * exp(-tk / 2.2) * sin(w * tk) : 0;
  const T = P.T;
  P.th = (kick + 0.55 * (0.6 + 0.4 * sin(0.29 * w * T)) * sin(w * T + 0.6 * sin(0.13 * w * T))) / 110;
  P.bow = 0.45 * sin(0.71 * w * T + 1.3) + 0.3 * kick;
  P.tw = sin(0.57 * w * T + 0.4);
}

function compose(P) {
  const c = P.cache[P.cur] || (P.cache[P.cur] = paint(P.cur));
  const wet = P.wet;
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const i = y * PW + x;
      const D = c[0][i] + (c[1][i] - c[0][i]) * wet;
      const f = (1 - 0.9 * D) * (0.965 + 0.05 * hash(x + 7, y + 3));
      const a = c[2][i];
      const p = PIG[c[3][i]];
      for (let k = 0; k < 3; k++) P.S[k][(PY + y) * MW + PX + x] = PAPER[k] * f * (1 - a) + p[k] * a;
    }
  P.built = P.cur;
  P.wetD = wet;
}

export function draw(display, params) {
  const P = params.s;
  if (!P || P.base < 0) return;
  if (P.built !== P.cur || abs(P.wetD - P.wet) > 0.004) compose(P);
  const [FR, FG, FB] = P.F;
  const [AR, AG, AB] = P.A;
  const [SR, SG, SB] = P.S;
  const [LR, LG, LB] = P.L;
  const lamp = P.lamp;
  const fl = 1 + (1 - lamp) * 0.035 * (sin(P.rt * 9.3) * 0.6 + sin(P.rt * 14.1 + 1) * 0.4);
  // The light on each column: the candle from the left, the moon from the right.
  for (let x = 0; x < W; x++) {
    const gc = (1.08 - (0.42 * x) / 63) * fl;
    const gm = 0.66 + (0.4 * x) / 63;
    for (let k = 0; k < 3; k++) P.L[k][x] = mix(CANDLE[k] * gc, MOON[k] * gm, lamp);
  }
  const vy = (y) => 0.8 + 0.2 * min(1, y / 60);
  const yR = TOP + P.u * LEN;
  const dia = sqrt(16 + 26 * (1 - P.u));
  const yc = yR + dia / 2;
  const { th, bow } = P;
  const side = 1 - 2 * lamp;

  // The wall, with the scroll's soft shadow thrown away from the light.
  const sx0 = MX + th * 60 + 3 * side;
  for (let y = 0; y < H; y++) {
    const v = vy(y);
    const sy = y > 15 && y < yc + dia / 2 + 1.5 ? 0.55 : 0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const s = (1 - sy * cl(min(x + 0.5 - sx0, sx0 + MW - x - 0.5) * 0.6 + 0.5, 0, 1)) * v;
      FR[i] = AR[i] * LR[x] * s;
      FG[i] = AG[i] * LG[x] * s;
      FB[i] = AB[i] * LB[x] * s;
    }
  }

  // The hanging part, each row shifted by the swing and the bow of the paper.
  // The paper turned toward the light is brighter, and the rows curling onto
  // the roller darker.
  const glow = 1 + 0.06 * P.tw * side;
  for (let y = TOP; y < yR; y++) {
    const cov = min(1, yR - y);
    const ty = y - TOP;
    const bw = bow * sin(PI * cl((y + 0.5 - TOP) / (yR - TOP), 0, 1));
    const dx = th * (y + 0.5 - NAIL) + bw;
    const v = vy(y) * glow * (0.62 + 0.38 * cl((yR - y - 0.5) / 1.6, 0, 1)) * cov;
    for (let x = MX - 3; x < MX + MW + 3; x++) {
      const fx = x - MX - dx;
      const i0 = floor(fx);
      const f = fx - i0;
      const w0 = i0 >= 0 && i0 < MW ? 1 - f : 0;
      const w1 = i0 >= -1 && i0 < MW - 1 ? f : 0;
      const a = (w0 + w1) * cov;
      if (a <= 0) continue;
      const t = ty * MW + i0;
      const r = (w0 ? SR[t] * w0 : 0) + (w1 ? SR[t + 1] * w1 : 0);
      const g = (w0 ? SG[t] * w0 : 0) + (w1 ? SG[t + 1] * w1 : 0);
      const b = (w0 ? SB[t] * w0 : 0) + (w1 ? SB[t + 1] * w1 : 0);
      const s = v * (1 + (0.12 * bw * side * (31.5 - x)) / 22);
      const i = y * W + x;
      FR[i] = FR[i] * (1 - a) + r * LR[x] * s;
      FG[i] = FG[i] * (1 - a) + g * LG[x] * s;
      FB[i] = FB[i] * (1 - a) + b * LB[x] * s;
    }
  }

  const put = (x, y, c, f, a = 1) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = y * W + x;
    const s = f * vy(y) * a;
    FR[i] = FR[i] * (1 - a) + c[0] * LR[x] * s;
    FG[i] = FG[i] * (1 - a) + c[1] * LG[x] * s;
    FB[i] = FB[i] * (1 - a) + c[2] * LB[x] * s;
  };
  // The nail, the cord to two rings on the rod, and the rod.
  for (let y = 4; y < 15; y++)
    for (const ex of [20.5, 43.5]) {
      const x = mix(31.5, ex, (y - 4) / 10.5) - 0.5;
      const x0 = floor(x);
      put(x0, y, CORD, 1, 1 - (x - x0));
      put(x0 + 1, y, CORD, 1, x - x0);
    }
  for (const [x, y, f] of [[31, 2, 1.25], [32, 2, 0.8], [31, 3, 0.8], [32, 3, 0.55], [20, 14, 1.1], [43, 14, 1.1]]) put(x, y, BRASS, f);
  for (let x = MX - 1; x <= MX + MW; x++) {
    const e = x < MX || x >= MX + MW ? 0.75 : 1;
    put(x, 15, WOOD, 1.3 * e);
    put(x, 16, WOOD, 0.7 * e);
  }

  // The roller and the rolled scroll on it, turning as it goes, with a knob
  // of bone at each end standing proud of the roll.
  const dxr = th * (yc - NAIL);
  const rolled = 1 - P.u;
  const ang = (rolled * LEN) / (dia / 2);
  const seam = cos(ang) > 0.2 && rolled > 0.02 ? sin(ang) : 9;
  const rc = [0, 1, 2].map((k) => mix(SILK[k], BACK[k], sm(0, 0.3, rolled)));
  for (let y = floor(yc - 3.6); y <= yc + 3.6; y++) {
    const yy = y + 0.5 - yc;
    const v = yy / (dia / 2);
    const vk = yy / 3.4;
    for (let x = MX - 5; x < MX + MW + 5; x++) {
      const px = x + 0.5 - dxr;
      const kx = px < MX ? MX - px : px - MX - MW;
      if (kx < 0) {
        const a = cl(dia / 2 - abs(yy) + 0.5, 0, 1) * cl(0.5 - kx, 0, 1);
        if (a <= 0) continue;
        const n = sqrt(max(0, 1 - v * v));
        put(x, y, rc, (0.25 + 0.75 * n * (0.8 - 0.35 * v)) * (abs(v - seam) < 0.3 ? 0.6 : 1), a);
      } else if (kx < 4.6) {
        const e = 3.4 * sqrt(max(0, 1 - (kx / 4.4) ** 4));
        const a = cl(e - abs(yy) + 0.5, 0, 1);
        if (a <= 0) continue;
        const n = sqrt(max(0, 1 - vk * vk));
        const hi = 0.45 * exp(-((vk + 0.45) ** 2) / 0.05);
        put(x, y, BONE, (0.3 + 0.75 * n * (0.85 - 0.3 * vk) + hi) * (kx < 0.8 ? 0.55 : 1), a);
      }
    }
  }

  for (let i = 0; i < N; i++) display.setPixel(i % W, (i / W) | 0, min(255, FR[i] * 255), min(255, FG[i] * 255), min(255, FB[i] * 255));
}
