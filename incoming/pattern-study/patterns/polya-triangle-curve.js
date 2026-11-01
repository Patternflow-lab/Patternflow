// ===== Patternflow pattern =====
// Title:   Pólya's Triangle Curve
// Family:  fractal
// Idea:    The panel's diagonal cuts it into two right triangles with legs 64 and 128, and Pólya's space-filling curve runs through both: in the upper half a head moving at a steady pace of Pólya's parameter paints every LED in the order the curve reaches it, sweeping hundreds of LEDs a frame across the big pieces of the cut and crawling through the small ones, while the lower half, the upper turned through 180 degrees, holds the same curve cut into pieces of at most 16 LEDs and drawn as a line through them, its stretch under the painted part lit.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Pólya's space-filling curve in a right triangle (George Pólya, 1913), the differentiability of Pólya's function (Peter Lax, 1973), pattern round 83
// Round:   83
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Angle=26.6..63.4, Depth=8..12
//
// Knob 1: Hue. Turns the colour ramp along the curve round the wheel. At 0 the curve starts in teal, turns azure and blue across its big first piece, is violet by the right-angle corner and ends in magenta; at 0.5 it starts in rose and ends in green.
// Knob 2: Speed. How fast the parameter runs: one pass through the triangle takes 30 s at the opening 2, 20 s at 3 and 300 s at 0.2.
// Knob 3: Angle. The acute angle at the corner where the curve starts, which sets where the altitude's foot falls on the diagonal: 80% of the way along at 26.6, the panel's own half drawn true; halfway at 45, where the painting runs evenly; 20% at 63.4. Away from 26.6 the triangle with that angle is laid on the panel's half by the affine map between them, so the cuts lean.
// Knob 4: Depth. How fine the lower half's line is: the triangle is cut until each piece holds at most 4096 / 2^Depth LEDs, so at 8 the line runs through pieces of 16 LEDs or less and at 12 through single LEDs, where it fills its half the way the painting fills the upper one.

// Pólya's construction. Take a right triangle and walk from one acute
// corner p to the other q by way of the right angle r. Drop the altitude
// from r: its foot f splits the triangle into (p, f, r) and (r, f, q), each
// a right triangle similar to the whole, with the right angle now at f.
// The first half of the parameter goes into the first, the second half into
// the second, and the same cut is made again inside each, the order of the
// corners flipping every time. Writing the parameter in binary, each digit
// picks one of the two pieces, the pieces shrink to a point, and that point
// is where the curve is. It reaches every point of the triangle, and it
// works for any right triangle, not only the half square.
//
// When the angle at p is a, the foot sits cos^2(a) of the way from p to q,
// and the two pieces hold cos^2(a) and sin^2(a) of the area. Only in the
// half square are they equal. In the panel's half, a = 26.6 degrees and the
// first piece is 80% of the triangle, yet it gets only half the parameter;
// inside it the split repeats. So a head moving at a steady parameter
// paints up to 505 LEDs in one frame where the digits keep choosing the
// big piece and stays on one LED for up to half a second where they keep
// choosing the small one; the first quarter of a pass paints 2601 of the
// 4096 LEDs and the last half only 819. In the half square it never paints
// more than 6 in a frame. Peter Lax studied in 1973 where Pólya's function has a
// derivative, and the answer turns on this angle.
//
// Here each LED of the upper half is located in the cuts 60 levels deep,
// which gives the parameter at which the curve passes through it, and the
// LEDs sorted by it are the order the head paints them in. The colour runs
// along that order, so each stretch of the ramp covers the same area and
// the parameter shows only in the head's pace. The pieces of the lower
// half's cut alternate in shade underneath. The last 62% of the half the
// head painted stay lit, brightest at the head. The lower half is
// the upper half turned through 180 degrees, so the two curves join at the
// panel's corners into one loop; there the curve is cut only to the Depth
// knob and drawn as a line through the pieces' centres, and the line lights
// up wherever its twin LED in the upper half is lit.

const W = 64, H = 128, N = W * H, HALF = N / 2;
const { floor, max, round, cos, atan, exp, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Corners of the upper half in panel units (LED x covers x..x+1): start at
// the bottom right, right angle at the top right, end at the top left.
const P0 = [64, 128], R0 = [64, 0], Q0 = [0, 0];
const LEVELS = 60;
const TRAIL = 0.62; // share of the upper half lit behind the head
const PASS = 60; // seconds for one pass at Speed 1
const LO = 28; // every channel of a lit LED is at least this
const HUE0 = 0.47, SPAN = 0.43;
const A_TRUE = atan(0.5), A_FAR = atan(2); // the panel's half and its mirror

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  const S = {
    hue: 0, speed: 2, angle: 26.6, depth: 8, tau: 0, akey: "", rkey: "",
    tauOf: new Float64Array(N), rank: new Int32Array(N), order: new Int32Array(HALF), sorted: new Float64Array(HALF),
    route: new Uint8Array(N), piece: new Int32Array(N), noise: new Uint8Array(N * 3),
    jh: new Float32Array(N), js: new Float32Array(N), jv: new Float32Array(N), c: [0, 0, 0],
  };
  // Dark LEDs keep a faint grain in every channel, below the lit floor.
  for (let i = 0; i < N * 3; i++) S.noise[i] = floor(Math.random() * 25);
  for (let i = 0; i < N; i++) {
    S.jh[i] = (Math.random() - 0.5) * 0.14;
    S.js[i] = 0.42 + Math.random() * 0.36;
    S.jv[i] = 0.84 + Math.random() * 0.16;
  }
  params.s = S;
}

// The share of the hypotenuse from the start corner to the altitude's foot.
function footOf(S) {
  const a = A_TRUE + ((S.angle - 26.6) / (63.4 - 26.6)) * (A_FAR - A_TRUE);
  const c = cos(a);
  return c * c;
}

// The parameter at which the curve passes through the point (px, py).
function locate(px, py, k) {
  let p0 = P0[0], p1 = P0[1], r0 = R0[0], r1 = R0[1], q0 = Q0[0], q1 = Q0[1];
  let t = 0, w = 0.5;
  for (let l = 0; l < LEVELS; l++) {
    const f0 = p0 + k * (q0 - p0), f1 = p1 + k * (q1 - p1);
    const ex = f0 - r0, ey = f1 - r1;
    const sx = ex * (py - r1) - ey * (px - r0), sp = ex * (p1 - r1) - ey * (p0 - r0);
    if (sx * sp >= 0) {
      // (p, f, r)
      q0 = r0;
      q1 = r1;
    } else {
      // (r, f, q)
      t += w;
      p0 = r0;
      p1 = r1;
    }
    r0 = f0;
    r1 = f1;
    w *= 0.5;
  }
  return t;
}

// Every LED of the upper half (y <= 2x), its parameter and its place in
// the order the curve reaches them.
function build(S) {
  const k = footOf(S), T = S.tauOf, idx = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (y <= 2 * x) {
        const i = y * W + x;
        T[i] = locate(x + 0.5, y + 0.5, k);
        idx.push(i);
      }
  idx.sort((a, b) => T[a] - T[b]);
  for (let r = 0; r < idx.length; r++) {
    S.rank[idx[r]] = r;
    S.order[r] = idx[r];
    S.sorted[r] = T[idx[r]];
  }
}

// The coarse curve: cut until a piece holds at most thr LEDs, keep each
// piece's centre and where its stretch of the parameter starts, then join
// the centres in order.
function pieces(p0, p1, r0, r1, q0, q1, area, t0, w, k, thr, out, starts) {
  if (area <= thr) {
    out.push((p0 + r0 + q0) / 3, (p1 + r1 + q1) / 3);
    starts.push(t0);
    return;
  }
  const f0 = p0 + k * (q0 - p0), f1 = p1 + k * (q1 - p1);
  pieces(p0, p1, f0, f1, r0, r1, area * k, t0, w / 2, k, thr, out, starts);
  pieces(r0, r1, f0, f1, q0, q1, area * (1 - k), t0 + w / 2, w / 2, k, thr, out, starts);
}

function buildRoute(S) {
  const k = footOf(S), pts = [], starts = [], R = S.route;
  pieces(P0[0], P0[1], R0[0], R0[1], Q0[0], Q0[1], HALF, 0, 1, k, HALF / pow(2, S.depth), pts, starts);
  R.fill(0);
  for (let j = 0; j + 3 < pts.length; j += 2) {
    const ax = pts[j], ay = pts[j + 1], dx = pts[j + 2] - ax, dy = pts[j + 3] - ay;
    const n = Math.ceil(max(Math.abs(dx), Math.abs(dy)) * 2) + 1;
    for (let s = 0; s <= n; s++) {
      const x = floor(ax + (dx * s) / n), y = floor(ay + (dy * s) / n);
      if (x >= 0 && x < W && y >= 0 && y < H && y <= 2 * x) R[y * W + x] = 1;
    }
  }
  // Which piece each LED of the upper half lies in.
  for (let i = 0; i < N; i++) {
    if (floor(i / W) > 2 * (i % W)) continue;
    const t = S.tauOf[i];
    let lo = 0, hi = starts.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (starts[m] <= t) lo = m + 1;
      else hi = m;
    }
    S.piece[i] = lo - 1;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 26.6, 8], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  S.speed = cl(kv[1] == null ? 2 : kv[1], 0.2, 3);
  S.angle = cl(kv[2] == null ? 26.6 : kv[2], 26.6, 63.4);
  S.depth = cl(kv[3] == null ? 8 : kv[3], 8, 12);
  S.tau += (d * S.speed) / PASS;
  S.tau -= floor(S.tau);
  const ak = S.angle.toFixed(2), rk = ak + "/" + S.depth.toFixed(2);
  if (ak !== S.akey) {
    S.akey = ak;
    build(S);
  }
  if (rk !== S.rkey) {
    S.rkey = rk;
    buildRoute(S);
  }
}

// How many LEDs of the upper half the head has painted in this pass.
function painted(S) {
  const A = S.sorted;
  let lo = 0, hi = HALF;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (A[m] <= S.tau) lo = m + 1;
    else hi = m;
  }
  return lo;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const cnt = painted(S), NT = round(TRAIL * HALF), c = S.c;
  // The head: the LED painted last, and a small glow round it.
  const hi = S.order[cnt > 0 ? cnt - 1 : HALF - 1], hx = (hi % W) + 0.5, hy = floor(hi / W) + 0.5;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, upper = y <= 2 * x, j = upper ? i : N - 1 - i;
      const ex = (upper ? x + 0.5 : W - x - 0.5) - hx, ey = (upper ? y + 0.5 : H - y - 0.5) - hy;
      const gd = 1 - (ex * ex + ey * ey) / 7.3;
      let r, g, b;
      let a = cnt - 1 - S.rank[j];
      if (a < 0) a += HALF;
      if ((!upper && !S.route[j]) || (upper && a >= NT)) {
        r = S.noise[i * 3];
        g = S.noise[i * 3 + 1];
        b = S.noise[i * 3 + 2];
        if (upper && gd > 0) {
          const w = 0.75 * gd * gd * 255;
          r += w;
          g += w;
          b += w;
        }
        display.setPixel(x, y, r, g, b);
        continue;
      }
      // Lit: along the trail from the head's white through the ramp's colour
      // down to a dim tail; the lower line keeps a dim glow off the trail.
      const odd = S.piece[j] & 1;
      let v = a < NT ? 0.28 + 0.72 * pow(1 - a / NT, 1.3) : 0.2;
      v *= S.jv[i] * (odd ? 0.74 : 1);
      hsv(HUE0 + S.hue + (SPAN * S.rank[j]) / HALF + S.jh[i] + (odd ? 0.035 : -0.035), S.js[i] + (odd ? 0.16 : 0), 1, c);
      const top = v * (255 - LO);
      let wb = a < NT ? exp(-a / 14) * (upper ? 0.9 : 0.6) : 0;
      if (gd > 0) wb = max(wb, gd * gd);
      r = c[0] * top;
      g = c[1] * top;
      b = c[2] * top;
      const tw = max(top, wb * (255 - LO));
      r += (tw - r) * wb;
      g += (tw - g) * wb;
      b += (tw - b) * wb;
      display.setPixel(x, y, LO + r, LO + g, LO + b);
    }
}
