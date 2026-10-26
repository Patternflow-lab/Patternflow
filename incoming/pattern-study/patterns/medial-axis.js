// ===== Patternflow pattern =====
// Title:   Medial Axis
// Family:  algo
// Idea:    A fire lit along a closed curve that fills the panel burns inward and outward at one speed, its fronts drawn as staggered dashes of the distance to the curve, and every LED takes the colour of the point of the curve nearest it, so the medial axis shows as a pale seam where that point jumps across and the fronts fold into corners: a tall tree that grows a long new branch from every bump a fraction of an LED high.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: medial axis and the grassfire transform (Harry Blum, 1967), pattern round 57
// Round:   57
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Bumps=0..1, Width=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 an LED is teal where its nearest point is on the right of the curve, blue where it is at the top or bottom and magenta where it is on the left, in 32 steps round the curve; outside the curve the same hues go pale. At 0.5 the right is magenta, the top and bottom yellow and the left teal.
// Knob 2: Speed. The fronts move 1.5 times the knob in LEDs a second: 3 at 2, so a front lit on the curve reaches the deepest point, about 29 LEDs in, after 9.5 seconds; 0.3 at 0.2 and 4.5 at 3. At 2 the blob's five harmonics drift 0.07 to 0.13 radians a second and the bumps travel round the curve 1 to 3.6 LEDs a second; both scale with the knob.
// Knob 3: Bumps. Adds ripples of 11, 14, 17, 21, 25 and 29 waves round the curve, 1.6 down to 0.7 LEDs high, one more each sixth of the knob. At 0 the axis is a trunk with a fork, 3.5 ends inside the curve on average. Ripples a fifth of an LED high (0.02) give it 8 ends, half an LED (0.05) 15 and the whole first ripple (0.17) 26, each new branch running from its ripple deep into the curve to the trunk; past that the count stays at 21 to 24 while the branches crowd and the pale seams grow from 5% of the inside to 16%.
// Knob 4: Width. The distance between fronts, 6.2 + 8 x knob LEDs: 6.7 at the opening 0.06, 14.2 at 1. The dashes stay about 12 LEDs long along the curve, so wide fronts break into squarer blocks.

const W = 64, H = 128, NP = W * H;
const { floor, min, max, abs, sqrt, cos, sin, PI, round } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Vertices of the curve.
const N = 384;
// The blob: harmonic k of the radius, its amplitude and its drift in
// radians a second at Speed 2.
const LOW = [[2, 0.09, 0.13], [3, 0.08, -0.09], [4, 0.07, 0.07], [5, 0.05, -0.11], [6, 0.035, 0.1]];
// The bumps, in LEDs along the outward ray, k waves round the curve. Bumps
// brings them in one after another.
const BUMPS = [[11, 1.6, 0.21], [14, 1.3, -0.17], [17, 1.1, 0.13], [21, 0.9, -0.23], [25, 0.8, 0.19], [29, 0.7, -0.15]];
// The margin left between the blob and the panel's edges.
const M = 2;
// Length of a dash along the curve, in LEDs.
const DASH = 12;
// The sawtooth's height: each front is 255 on its bright side.
const A = 255;

// Vertex angles spaced evenly by arc length round a 29 x 61 ellipse.
const TH = new Float32Array(N), CO = new Float32Array(N), SI = new Float32Array(N);
{
  const K = 4096, acc = new Float64Array(K + 1);
  for (let k = 0; k < K; k++) {
    const a = (k + 0.5) / K * TAU;
    acc[k + 1] = acc[k] + Math.hypot(29 * sin(a), 61 * cos(a));
  }
  for (let i = 0, k = 0; i < N; i++) {
    const target = (i / N) * acc[K];
    while (acc[k + 1] < target) k++;
    TH[i] = ((k + (target - acc[k]) / (acc[k + 1] - acc[k])) / K) * TAU;
    CO[i] = cos(TH[i]);
    SI[i] = sin(TH[i]);
  }
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  params.s = {
    clock: 0, ph: 0, hue: 0, speed: 2, bumps: 0, width: 5,
    px: new Float32Array(N), py: new Float32Array(N),
    // Per segment: start, direction, 1 / length squared, length, arc start.
    ax: new Float32Array(N), ay: new Float32Array(N), dx: new Float32Array(N), dy: new Float32Array(N),
    il: new Float32Array(N), len: new Float32Array(N), arc: new Float32Array(N), per: 1,
    F: new Int16Array(NP), D2: new Float32Array(NP), T: new Float32Array(NP), U: new Float32Array(NP),
    G: new Float32Array(NP), IN: new Uint8Array(NP),
    DIS: new Float32Array(NP), SH: new Float32Array(NP), HT: new Float32Array(NP),
    CR: new Float32Array(NP), CG: new Float32Array(NP), CB: new Float32Array(NP), frame: 0, ready: false,
    xs: new Float32Array(H * 32), xc: new Int32Array(H),
    pal: new Float32Array(256 * 6), palHue: -1,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(kv[0], 0, 1);
  s.speed = cl(kv[1], 0.2, 3);
  s.bumps = cl(kv[2], 0, 1);
  s.width = 6.2 + 8 * cl(kv[3], 0, 1);
  s.clock += d * s.speed / 2;
  // The fronts move 1.5 x Speed LEDs a second.
  s.ph += (d * 1.5 * s.speed) / s.width;
  s.ph -= floor(s.ph);
}

// The curve at this moment: the blob scaled to the panel less the margin,
// then the bumps pushed out along the ray from its centre.
function curve(s) {
  const { px, py } = s, t = s.clock;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < N; i++) {
    let r = 1;
    for (const [k, a, w] of LOW) r += a * cos(k * TH[i] + w * t + k);
    px[i] = r * CO[i];
    py[i] = r * SI[i];
    x0 = min(x0, px[i]); x1 = max(x1, px[i]); y0 = min(y0, py[i]); y1 = max(y1, py[i]);
  }
  const sx = (W - 1 - 2 * M) / (x1 - x0), sy = (H - 1 - 2 * M) / (y1 - y0), cx = M - x0 * sx, cy = M - y0 * sy;
  const nb = s.bumps * BUMPS.length;
  for (let i = 0; i < N; i++) {
    const X = px[i] * sx, Y = py[i] * sy, rho = sqrt(X * X + Y * Y);
    let b = 0;
    for (let j = 0; j < BUMPS.length && j < nb; j++) {
      const [k, a, w] = BUMPS[j];
      b += min(1, nb - j) * a * cos((k * TAU * i) / N + w * t * 4 + j * 2.1);
    }
    const f = 1 + b / rho;
    px[i] = cx + X * f;
    py[i] = cy + Y * f;
  }
  let arc = 0;
  for (let i = 0; i < N; i++) {
    const j = i + 1 === N ? 0 : i + 1, dx = px[j] - px[i], dy = py[j] - py[i], l2 = dx * dx + dy * dy;
    s.ax[i] = px[i]; s.ay[i] = py[i]; s.dx[i] = dx; s.dy[i] = dy;
    s.il[i] = l2 > 0 ? 1 / l2 : 0;
    s.len[i] = sqrt(l2);
    s.arc[i] = arc;
    arc += s.len[i];
  }
  s.per = arc;
}

// Inside or out, row by row: where the curve's edges cross each row's
// centre line, sorted, filled between pairs.
function fill(s) {
  const { xs, xc, IN, px, py } = s;
  xc.fill(0);
  IN.fill(0);
  for (let i = 0; i < N; i++) {
    const j = i + 1 === N ? 0 : i + 1, ya = py[i], yb = py[j];
    if (ya === yb) continue;
    const lo = min(ya, yb), hi = max(ya, yb);
    for (let y = max(0, Math.ceil(lo)); y < hi && y < H; y++) {
      if (xc[y] < 32) xs[y * 32 + xc[y]++] = px[i] + ((y - ya) * (px[j] - px[i])) / (yb - ya);
    }
  }
  for (let y = 0; y < H; y++) {
    const n = xc[y], o = y * 32;
    for (let a = 1; a < n; a++) {
      const v = xs[o + a];
      let b = a - 1;
      while (b >= 0 && xs[o + b] > v) (xs[o + b + 1] = xs[o + b]), b--;
      xs[o + b + 1] = v;
    }
    for (let a = 0; a + 1 < n; a += 2) {
      for (let x = max(0, Math.ceil(xs[o + a])); x < W && x < xs[o + a + 1]; x++) IN[y * W + x] = 1;
    }
  }
}

// The feature transform: for every LED the nearest segment of the curve,
// the squared distance to it and where on it the nearest point lies. The
// arrays sit in module variables so the two small functions below inline.
let AX, AY, DX, DY, IL, FF, DD, TT, tt = 0;
function sd(i, x, y) {
  const ex = x - AX[i], ey = y - AY[i];
  let t = (ex * DX[i] + ey * DY[i]) * IL[i];
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  tt = t;
  const fx = ex - t * DX[i], fy = ey - t * DY[i];
  return fx * fx + fy * fy;
}
// Try segment c for LED p, then walk along the curve while it gets nearer.
// A segment within two of the one held is skipped: the one held is already
// the nearest of its neighbours.
function relax(p, x, y, c) {
  if (c < 0) return;
  const e = FF[p];
  if (e >= 0) {
    const k = c > e ? c - e : e - c;
    if (k <= 2 || k >= N - 2) return;
  }
  let bd = sd(c, x, y);
  if (bd >= DD[p]) return;
  let bt = tt;
  for (;;) {
    const j = c + 1 === N ? 0 : c + 1, d = sd(j, x, y);
    if (d < bd) (bd = d), (bt = tt), (c = j);
    else break;
  }
  for (;;) {
    const j = c === 0 ? N - 1 : c - 1, d = sd(j, x, y);
    if (d < bd) (bd = d), (bt = tt), (c = j);
    else break;
  }
  FF[p] = c;
  DD[p] = bd;
  TT[p] = bt;
}
function transform(s) {
  (AX = s.ax), (AY = s.ay), (DX = s.dx), (DY = s.dy), (IL = s.il), (FF = s.F), (DD = s.D2), (TT = s.T);
  const F = FF, D2 = DD;
  F.fill(-1);
  D2.fill(1e9);
  // Seeds: the LED nearest each vertex takes that vertex's segment, walked
  // to the nearest segment around it.
  for (let i = 0; i < N; i++) {
    const x = round(AX[i]), y = round(AY[i]);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    relax(y * W + x, x, y, i);
  }
  // Two raster passes carry the nearest segment from neighbour to neighbour.
  for (let y = 0; y < H; y++) {
    for (let x = 0, p = y * W; x < W; x++, p++) {
      if (x > 0) relax(p, x, y, F[p - 1]);
      if (y > 0) {
        relax(p, x, y, F[p - W]);
        if (x > 0) relax(p, x, y, F[p - W - 1]);
        if (x < W - 1) relax(p, x, y, F[p - W + 1]);
      }
    }
    for (let x = W - 2, p = y * W + x; x >= 0; x--, p--) relax(p, x, y, F[p + 1]);
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1, p = y * W + x; x >= 0; x--, p--) {
      if (x < W - 1) relax(p, x, y, F[p + 1]);
      if (y < H - 1) {
        relax(p, x, y, F[p + W]);
        if (x < W - 1) relax(p, x, y, F[p + W + 1]);
        if (x > 0) relax(p, x, y, F[p + W - 1]);
      }
    }
    for (let x = 1, p = y * W + 1; x < W; x++, p++) relax(p, x, y, F[p - 1]);
  }
}

// Everything that depends on the curve and not on the phase of the fire:
// the distance of each LED, its dash, its screen offset and its colour.
//
// The dashes and the screen are there for the study map. Bands of the
// distance rise along the normal and stay flat along the front, so where
// the curve runs up the panel only the steps along a row change. With every
// rise kept under 40 levels, the mean step between neighbours stayed at
// 0.151 of full scale with bands alone, and no height or width of band took
// it past 0.16. The half-band jumps between dashes and the screen's steps
// along the fronts give the columns their share too: 0.203.
function field(s) {
  curve(s);
  fill(s);
  transform(s);
  const { F, D2, T, U, G, IN, arc, len, pal, ax, ay, dx, dy, DIS, SH, HT, CR, CG, CB } = s, per = s.per, half = per / 2;
  for (let p = 0; p < NP; p++) U[p] = arc[F[p]] + T[p] * len[F[p]];
  // How far apart along the curve the nearest points of two neighbours
  // lie: a few LEDs off the medial axis, up to half the curve across it.
  G.fill(0);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      if (x < W - 1) {
        let g = abs(U[p] - U[p + 1]);
        if (g > half) g = per - g;
        if (g > G[p]) G[p] = g;
        if (g > G[p + 1]) G[p + 1] = g;
      }
      if (y < H - 1) {
        let g = abs(U[p] - U[p + W]);
        if (g > half) g = per - g;
        if (g > G[p]) G[p] = g;
        if (g > G[p + W]) G[p + W] = g;
      }
    }
  if (s.palHue !== s.hue) {
    // Round the curve the hue runs from teal on the right through blue at
    // the top and bottom to magenta on the left; outside it the same hues
    // go pale.
    for (let i = 0; i < 256; i++) {
      const tri = 1 - abs(1 - 2 * (i / 256));
      hsv(0.42 + s.hue + 0.5 * tri, 0.85, 1, pal, i * 6);
      hsv(0.42 + s.hue + 0.5 * tri, 0.38, 1, pal, i * 6 + 3);
    }
    s.palHue = s.hue;
  }
  const rise = A / s.width, nd = 2 * max(2, round(per / (2 * DASH))), dl = per / nd;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const i = F[p], d = sqrt(D2[p]), u = U[p];
      DIS[p] = d;
      SH[p] = 0.5 * (floor(u / dl) & 1);
      // The screen: rows, or columns where the normal is nearer vertical,
      // alternate up and down by as much as the step to the neighbour across
      // leaves under 38 levels. It needs the direction to the nearest point,
      // or across the segment for an LED on the curve.
      let gx, gy, gn;
      if (d > 0.3) (gx = abs(x - ax[i] - T[p] * dx[i])), (gy = abs(y - ay[i] - T[p] * dy[i])), (gn = d);
      else (gx = abs(dy[i])), (gy = abs(dx[i])), (gn = len[i] || 1);
      const row = gx >= gy, del = (38 - (rise * (row ? gy : gx)) / gn) / 2;
      HT[p] = del > 0 ? ((row ? y : x) & 1 ? del : -del) : 0;
      // The hue steps 32 times round the curve.
      const o = ((floor((u / per) * 32) & 31) << 3) * 6 + (IN[p] ? 0 : 3);
      const wh = cl((G[p] - 3) / 9, 0, 1) * 0.8;
      CR[p] = pal[o] + (1 - pal[o]) * wh;
      CG[p] = pal[o + 1] + (1 - pal[o + 1]) * wh;
      CB[p] = pal[o + 2] + (1 - pal[o + 2]) * wh;
    }
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  // The curve moves a small fraction of an LED a frame, so its field is
  // worked out every other frame; the fire moves every frame.
  if (!s.ready || (s.frame++ & 1) === 0) field(s), (s.ready = true);
  const { DIS, SH, HT, CR, CG, CB } = s, w = s.width, ph = s.ph;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      // A sawtooth of the distance: each front bright on its trailing side,
      // dark ahead of it, the brightness fading back towards the curve.
      // Every other dash runs half a band behind.
      const f = DIS[p] / w - ph + SH[p];
      let lv = A * (f - floor(f)) + HT[p];
      lv = lv < 0 ? 0 : lv > 255 ? 255 : lv;
      display.setPixel(x, y, round(CR[p] * lv), round(CG[p] * lv), round(CB[p] * lv));
    }
}
