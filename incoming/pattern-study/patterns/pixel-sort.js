// ===== Patternflow pattern =====
// Title:   Pixel Sort
// Family:  pixelsort
// Idea:    A handful of large soft luminous shapes drift over a dark ground, and in every column the runs of pixels brighter than a breathing threshold are sorted by brightness, so each shape melts into a gradient curtain that hangs from a crisp bright rim while the unsorted shapes show through where the threshold lets them.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: pixel sorting (Kim Asendorf, 2010), pattern round 223
// Round:   223
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Melt=0..4, Fall=-1..1, Scale=-1..1
//
// Knob 1: Hue. Turns the whole palette round the colour wheel. At 0 the big shapes are blue, violet and magenta with a coral edge on the hottest cores over a deep indigo ground; the palette spans a third of the wheel, and a full turn comes back to the start.
// Knob 2: Melt. How much of each column is sorted. At 0 the threshold is above every shape and nothing is sorted: the soft shapes alone. At 2 (the opening) the threshold sits at about a third of the brightest level, so every shape and its halo are melted into curtains and a few dim edges stay as they were. At 4 the threshold is below the ground and every column is one run, sorted whole: brightest at the top, darkest at the bottom.
// Knob 3: Fall. The direction the sort runs. At 0 each column is sorted top to bottom and the curtains hang straight down, with a slow sway of a few degrees; turning it tilts the whole sort round the middle of the panel, to 45 degrees at plus or minus 0.5 and to 90 degrees at plus or minus 1, where the rows are sorted, brightest at the left for -1 and at the right for +1.
// Knob 4: Scale. The size of the shapes, from 0.62 times at -1 (a dozen small curtains, 10 LEDs across) through 1 at the middle to 1.62 times at 1, where three or four shapes fill the panel and the curtains are 50 LEDs long.

// What the picture is. A hidden source image is built every frame: seven soft shapes, five ellipses of different aspect and two wedges, each a compact bump
// (1 - d^2) to a power between 1 and 2, drifting on two sines a axis whose periods (37 to 120 s) are golden-ratio multiples of one another, so the
// layout does not come back. They are blended as light (1 - the product of 1 - I), so overlaps brighten and never clip, over a dim ground
// of about 0.07 that a slow broad bump lifts to 0.12. Each shape carries a hue offset, spread over a third of the wheel, and the hue at a
// pixel is the average of the offsets weighted by I squared, so where two shapes meet the colour blends instead of switching.
// The sort: the grid is turned to the sort direction (so Fall turns the whole sort, not the picture), and in every column of that grid the
// cells with I at or above the threshold form runs. The cells of one run are sorted by I, the brightest first, and each carries its own hue
// along. The hue is then smoothed down the run so two shapes of nearly the same I do not stripe it. The bright end of a run is crisp where
// the run begins; the dark end is the threshold and meets the unsorted ground with no step. The sorted grid is read back onto the panel by bilinear
// sampling, and the result is smoothed over about a tenth of a second, which turns the one real discontinuity of pixel sorting, two runs
// merging when the gap between them crosses the threshold, into a quick melt instead of a pop. The threshold breathes on 37.9 s and 61.7 s.
// Colour is made at the end from I and the hue: value from I, saturation falling in the hot cores, hue drifting a little with I.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, sqrt, abs, exp, sin, cos, atan2, pow, PI, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const TAU = 2 * PI;
const frac = (v) => v - floor(v);

const MB = 14; // rows of grid beyond the panel along the sort, so runs that cross the edge are whole
const GMAX = 192;
const PLEAT = 0.1; // how deep the folds in the sorted curtains go
const HUE0 = 0.6; // the palette at Hue 0 starts in blue

// ---- the shapes. kind 0 is an ellipse, kind 1 a wedge pointing from a pivot
const SHAPES = [
  { kind: 0, hue: 0.0, rx: 25, ry: 34, peak: 1.0, p: 1.5, rot: 0.2, cx: 22, cy: 24, ax: 18, ay: 22 },
  { kind: 0, hue: 0.2, rx: 22, ry: 26, peak: 0.95, p: 2, rot: 0.0, cx: 48, cy: 40, ax: 16, ay: 24 },
  { kind: 0, hue: 0.1, rx: 34, ry: 14, peak: 0.9, p: 1.5, rot: 0.9, cx: 28, cy: 62, ax: 18, ay: 26 },
  { kind: 1, hue: 0.26, len: 84, half: 0.5, peak: 1.0, rot: 1.45, cx: 14, cy: 4, ax: 18, ay: 10 },
  { kind: 0, hue: 0.05, rx: 22, ry: 28, peak: 1.0, p: 1, rot: -0.3, cx: 50, cy: 96, ax: 16, ay: 16 },
  { kind: 1, hue: 0.14, len: 80, half: 0.46, peak: 0.95, rot: -1.7, cx: 50, cy: 126, ax: 16, ay: 8 },
  { kind: 0, hue: 0.24, rx: 20, ry: 22, peak: 0.9, p: 2, rot: 0.0, cx: 16, cy: 100, ax: 18, ay: 22 },
  { kind: 0, hue: 0.15, rx: 26, ry: 12, peak: 0.85, p: 1.5, rot: -0.7, cx: 40, cy: 12, ax: 20, ay: 10 },
];
// periods and phases: golden-ratio multiples, so no two share a factor and the layout does not come back
SHAPES.forEach((s, i) => {
  s.per = [];
  s.ph = [];
  for (let k = 0; k < 6; k++) {
    s.per.push(37 + 83 * frac(0.6180339887 * (i * 6 + k + 1) + 0.137 * i));
    s.ph.push(TAU * frac(0.7548776662 * (i * 6 + k + 1) + 0.3));
  }
});

// ---- colour tables
const HN = 1024;
const HLUT = new Float32Array(HN * 3);
for (let i = 0; i < HN; i++) {
  const h = i / HN;
  HLUT[i * 3] = cl(abs(6 * h - 3) - 1, 0, 1);
  HLUT[i * 3 + 1] = cl(2 - abs(6 * h - 2), 0, 1);
  HLUT[i * 3 + 2] = cl(2 - abs(6 * h - 4), 0, 1);
}
const VN = 512;
const VLUT = new Float32Array(VN + 1);
for (let i = 0; i <= VN; i++) VLUT[i] = 0.12 + 0.88 * pow(i / VN, 0.8);

function makeState() {
  const n = GMAX * GMAX;
  return {
    ready: false, t: 13.7, ang: 0, scl: 1, lo: 0.4,
    inv: new Float32Array(n), ws: new Float32Array(n), wp: new Float32Array(n),
    Ic: new Float32Array(n), Pc: new Float32Array(n), Io: new Float32Array(n), Po: new Float32Array(n),
    key: new Float64Array(GMAX), tmp: new Float32Array(GMAX),
    loCol: new Float32Array(GMAX), fa: new Float32Array(GMAX * 6), fb: new Float32Array(GMAX * 6),
    Is: new Float32Array(NPX), Ps: new Float32Array(NPX),
    kn: [0, 2, 0, 0.06],
  };
}

export function setup(params) {
  params.s = makeState();
}

function pathOf(s, t, axis) {
  const o = axis * 2;
  const a = axis === 0 ? s.ax : s.ay;
  const c = axis === 0 ? s.cx : s.cy;
  return c + a * 0.72 * sin((TAU * t) / s.per[o] + s.ph[o]) + a * 0.28 * sin((TAU * t) / s.per[o + 1] + s.ph[o + 1]);
}

function scene(S, t, phi, scl, NA, NB) {
  const cs = cos(phi), sn = sin(phi);
  const a0 = -NA / 2, b0 = -NB / 2;
  const n = NA * NB;
  const { inv, ws, wp } = S;
  inv.fill(1, 0, n);
  ws.fill(0, 0, n);
  wp.fill(0, 0, n);
  for (let k = 0; k < SHAPES.length; k++) {
    const s = SHAPES[k];
    const sx = pathOf(s, t, 0), sy = pathOf(s, t, 1);
    const rx0 = sx - 32, ry0 = sy - 64;
    const ac = rx0 * cs - ry0 * sn, bc = rx0 * sn + ry0 * cs;
    const swing = 0.4 * sin((TAU * t) / s.per[4] + s.ph[4]);
    const breath = 1 + 0.12 * sin((TAU * t) / s.per[5] + s.ph[5]);
    let i0, i1, j0, j1, wal = 0, wL = 0, whb = 0;
    if (s.kind === 0) {
      const R = max(s.rx, s.ry) * scl * breath;
      i0 = floor(ac - R - a0 - 0.5); i1 = ceil(ac + R - a0 - 0.5);
      j0 = floor(bc - R - b0 - 0.5); j1 = ceil(bc + R - b0 - 0.5);
    } else {
      // the wedge's box: the pivot and five points along its far arc
      const al = s.rot + 0.5 * swing + 0.7 * sin((TAU * t) / s.per[3] + s.ph[3]);
      const L = s.len * scl, hb = s.half * (1 + 0.2 * sin((TAU * t) / s.per[2] + s.ph[2]));
      let amin = ac, amax = ac, bmin = bc, bmax = bc;
      for (let q = -2; q <= 2; q++) {
        const th = al + (hb * q) / 2;
        const px = rx0 + L * cos(th), py = ry0 + L * sin(th);
        const pa = px * cs - py * sn, pb = px * sn + py * cs;
        if (pa < amin) amin = pa; if (pa > amax) amax = pa;
        if (pb < bmin) bmin = pb; if (pb > bmax) bmax = pb;
      }
      i0 = floor(amin - a0 - 1.5); i1 = ceil(amax - a0 + 0.5);
      j0 = floor(bmin - b0 - 1.5); j1 = ceil(bmax - b0 + 0.5);
      wal = al; wL = L; whb = hb;
    }
    i0 = max(0, i0); i1 = min(NA - 1, i1); j0 = max(0, j0); j1 = min(NB - 1, j1);
    if (s.kind === 0) {
      const om = phi + s.rot + swing;
      const co = cos(om), so = sin(om);
      const irx = 1 / (s.rx * scl * breath), iry = 1 / (s.ry * scl * breath);
      const pk = s.peak, p = s.p, hu = s.hue;
      for (let i = i0; i <= i1; i++) {
        const da = a0 + i + 0.5 - ac;
        let idx = i * NB + j0;
        for (let j = j0; j <= j1; j++, idx++) {
          const db = b0 + j + 0.5 - bc;
          const u = (da * co + db * so) * irx, v = (-da * so + db * co) * iry;
          const d2 = u * u + v * v;
          if (d2 >= 1) continue;
          const tt = 1 - d2;
          const I = pk * (p === 2 ? tt * tt : p === 1 ? tt : tt * sqrt(tt));
          inv[idx] *= 1 - I;
          const w = I * I;
          ws[idx] += w;
          wp[idx] += w * (hu + 0.05 * d2);
        }
      }
    } else {
      const al = wal, L = wL, hb = whb, hu = s.hue, pk = s.peak;
      const px = rx0, py = ry0;
      for (let i = i0; i <= i1; i++) {
        const a = a0 + i + 0.5;
        let idx = i * NB + j0;
        for (let j = j0; j <= j1; j++, idx++) {
          const b = b0 + j + 0.5;
          const dx = a * cs + b * sn - px, dy = -a * sn + b * cs - py;
          const r = sqrt(dx * dx + dy * dy);
          const q = r / L;
          if (q >= 1) continue;
          let dth = atan2(dy, dx) - al;
          if (dth > PI) dth -= TAU; else if (dth < -PI) dth += TAU;
          const e = dth / hb;
          if (e >= 1 || e <= -1) continue;
          const A = 1 - e * e;
          const Rr = sm(0.02, 0.45, q) * (1 - sm(0.4, 1, q));
          const I = pk * A * sqrt(A) * Rr;
          if (I < 1e-4) continue;
          inv[idx] *= 1 - I;
          const w = I * I;
          ws[idx] += w;
          wp[idx] += w * (hu + 0.05 * q);
        }
      }
    }
  }
  // the ground: a dim broad bump, never black, with a hue that eases across the panel
  const gcx = 32 + 14 * sin((TAU * t) / 71.3 + 1.2), gcy = 64 + 26 * sin((TAU * t) / 93.1 + 0.4);
  for (let i = 0; i < NA; i++) {
    const a = a0 + i + 0.5;
    let idx = i * NB;
    for (let j = 0; j < NB; j++, idx++) {
      const b = b0 + j + 0.5;
      const x = 32 + a * cs + b * sn, y = 64 - a * sn + b * cs;
      const gx = (x - gcx) / 60, gy = (y - gcy) / 100;
      const gb = max(0, 1 - gx * gx - gy * gy);
      const Ig = 0.07 + 0.05 * gb;
      const w = Ig * Ig;
      S.Ic[idx] = 1 - inv[idx] * (1 - Ig);
      S.Pc[idx] = (wp[idx] + w * (0.06 + 0.14 * cl(x / 64, 0, 1))) / (ws[idx] + w);
    }
  }
}

function sortGrid(S, NA, NB) {
  const { Ic, Pc, Io, Po, key, tmp, loCol, fa, fb } = S;
  for (let i = 0; i < NA; i++) {
    const base = i * NB, lo = loCol[i], i6 = i * 6;
    let j = 0;
    while (j < NB) {
      if (Ic[base + j] < lo) {
        Io[base + j] = Ic[base + j];
        Po[base + j] = Pc[base + j];
        j++;
        continue;
      }
      let e = j + 1;
      while (e < NB && Ic[base + e] >= lo) e++;
      const n = e - j;
      if (n < 2) {
        Io[base + j] = Ic[base + j];
        Po[base + j] = Pc[base + j];
      } else {
        for (let q = 0; q < n; q++) key[q] = floor(Ic[base + j + q] * 8191 + 0.5) * 256 + q;
        const view = key.subarray(0, n);
        view.sort();
        for (let q = 0; q < n; q++) {
          const kk = view[n - 1 - q] & 255;
          const Iv = Ic[base + j + kk];
          // the folds of the curtain: two waves of different spacing across the columns, bent along the fall, and a slow envelope that makes some folds deep and some shallow
          const j6 = (j + q) * 6;
          const f1 = fa[i6] * fb[j6 + 1] + fa[i6 + 1] * fb[j6];
          const f2 = fa[i6 + 2] * fb[j6 + 3] + fa[i6 + 3] * fb[j6 + 2];
          const en = 0.55 + 0.45 * (fa[i6 + 4] * fb[j6 + 5] + fa[i6 + 5] * fb[j6 + 4]);
          Io[base + j + q] = Iv * (1 + PLEAT * en * sm(0.06, 0.4, Iv) * (0.62 * f1 + 0.38 * f2));
          tmp[q] = Pc[base + j + kk];
        }
        // four passes of a 1-2-1 filter on the hue down the run
        for (let pass = 0; pass < 4; pass++) {
          let prev = tmp[0];
          for (let q = 0; q < n; q++) {
            const cur = tmp[q], nx = q + 1 < n ? tmp[q + 1] : cur;
            tmp[q] = (prev + 2 * cur + nx) * 0.25;
            prev = cur;
          }
        }
        for (let q = 0; q < n; q++) Po[base + j + q] = tmp[q];
      }
      j = e;
    }
  }
}

// read the sorted grid back onto the panel
function resample(S, phi, NA, NB, alpha) {
  const cs = cos(phi), sn = sin(phi);
  const { Io, Po, Is, Ps } = S;
  const ha = NA / 2 - 0.5, hbb = NB / 2 - 0.5;
  for (let y = 0; y < H; y++) {
    const ry = y + 0.5 - 64;
    for (let x = 0; x < W; x++) {
      const rx = x + 0.5 - 32;
      const fi = rx * cs - ry * sn + ha, fj = rx * sn + ry * cs + hbb;
      let i0 = floor(fi), j0 = floor(fj);
      const fx = fi - i0, fy = fj - j0;
      if (i0 < 0) i0 = 0; else if (i0 > NA - 2) i0 = NA - 2;
      if (j0 < 0) j0 = 0; else if (j0 > NB - 2) j0 = NB - 2;
      const k00 = i0 * NB + j0, k01 = k00 + 1, k10 = k00 + NB, k11 = k10 + 1;
      const w00 = (1 - fx) * (1 - fy), w01 = (1 - fx) * fy, w10 = fx * (1 - fy), w11 = fx * fy;
      const I = Io[k00] * w00 + Io[k01] * w01 + Io[k10] * w10 + Io[k11] * w11;
      const P = Po[k00] * w00 + Po[k01] * w01 + Po[k10] * w10 + Po[k11] * w11;
      const o = y * W + x;
      Is[o] += (I - Is[o]) * alpha;
      Ps[o] += (P - Ps[o]) * alpha;
    }
  }
}

function advance(S, dt, kn) {
  S.t += dt;
  const t = S.t;
  const target = (cl(kn[2], -1, 1) * PI) / 2 + 0.06 * sin((TAU * t) / 57.3 + 0.7) + 0.035 * sin((TAU * t) / 89.9 + 2.1);
  const sTarget = pow(2, 0.7 * cl(kn[3], -1, 1));
  const m = cl(kn[1], 0, 4) / 4;
  const breathe = 1 + 0.16 * sin((TAU * t) / 37.9 + 0.5) + 0.09 * sin((TAU * t) / 61.7 + 2.3);
  const loT = 1.6 * pow(1 - m, 1.7) * breathe;
  const first = !S.ready;
  const kf = first ? 1 : 1 - exp(-dt / 0.15);
  S.ang += (target - S.ang) * kf;
  S.scl += (sTarget - S.scl) * kf;
  S.lo += (loT - S.lo) * kf;
  const phi = S.ang;
  const HA = abs(cos(phi)) * 32 + abs(sin(phi)) * 64 + 1.5;
  const HB = abs(sin(phi)) * 32 + abs(cos(phi)) * 64 + 1.5 + MB;
  const NA = min(GMAX, 2 * ceil(HA)), NB = min(GMAX, 2 * ceil(HB));
  scene(S, t, phi, S.scl, NA, NB);
  for (let i = 0; i < NA; i++) {
    const a = i + 0.5 - NA / 2;
    S.loCol[i] = S.lo * (1 + 0.1 * sin((TAU * a) / 17.3 + 0.17 * t + 2) + 0.05 * sin((TAU * a) / 7.9 - 0.11 * t));
    // fa holds sin and cos of each column's phase for the three waves, fb the same down the rows, so a fold is sin(A + B) with no trig per cell
    const p1 = (TAU * a) / 8.3 + 0.31 * t, p2 = (TAU * a) / 13.7 - 0.23 * t + 1.7, p3 = (TAU * a) / 41 + 0.07 * t + 0.4;
    S.fa[i * 6] = sin(p1); S.fa[i * 6 + 1] = cos(p1);
    S.fa[i * 6 + 2] = sin(p2); S.fa[i * 6 + 3] = cos(p2);
    S.fa[i * 6 + 4] = sin(p3); S.fa[i * 6 + 5] = cos(p3);
  }
  for (let j = 0; j < NB; j++) {
    const b = j + 0.5 - NB / 2;
    const q1 = 0.9 * sin(b / 21 + t / 7.3) + 0.5 * sin(b / 8.7 - t / 4.1 + 1);
    const q2 = 1.1 * sin(b / 17 - t / 9.1 + 2) + 0.4 * sin(b / 6.3 + t / 5.3);
    const q3 = b / 53 + 0.13 * t;
    S.fb[j * 6] = sin(q1); S.fb[j * 6 + 1] = cos(q1);
    S.fb[j * 6 + 2] = sin(q2); S.fb[j * 6 + 3] = cos(q2);
    S.fb[j * 6 + 4] = sin(q3); S.fb[j * 6 + 5] = cos(q3);
  }
  sortGrid(S, NA, NB);
  resample(S, phi, NA, NB, first ? 1 : 1 - exp(-dt / 0.1));
  S.ready = true;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06];
  S.kn = kn;
  advance(S, cl(dt || 0, 0, 0.1), kn);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const hue0 = HUE0 + cl(S.kn[0], 0, 1);
  const { Is, Ps } = S;
  for (let o = 0; o < NPX; o++) {
    const I = cl(Is[o], 0, 1);
    let h = hue0 + Ps[o] + 0.1 * sm(0.1, 1, I);
    h -= floor(h);
    const hi = ((h * HN) | 0) * 3;
    const s = 0.86 - 0.42 * sm(0.7, 1.05, I);
    const v = VLUT[(I * VN) | 0] * 255;
    const r = v * (1 - s + s * HLUT[hi]), g = v * (1 - s + s * HLUT[hi + 1]), b = v * (1 - s + s * HLUT[hi + 2]);
    display.setPixel(o % W, (o / W) | 0, r | 0, g | 0, b | 0);
  }
}
