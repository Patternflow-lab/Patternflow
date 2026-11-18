// ===== Patternflow pattern =====
// Title:   Klein Transport
// Family:  topology
// Idea:    A pixel R is carried once round the orientation-reversing loop of a figure-eight Klein bottle turning in the top square and comes back onto the patch it left as its own mirror image, gold turning to lilac at the seam, while the flat square below shows the same walk by its rule: the R goes out through the right edge and comes in through the left at the flipped height, upside down.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Klein bottle (Felix Klein, 1882) in its figure-eight immersion with a circle of self-crossing, a surface with one side whose loop in u reverses orientation, pattern round 104
// Round:   104
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Loop=0..1, Tilt=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the face the flat square shows is rose and the other face teal, the R is pale gold until it crosses the seam and pale lilac after, the seam is green and the crossing circle violet.
// Knob 2: Speed. At 2 the R goes once round the ring in 7.9 s, at a sixth of that pace as it passes home and at full pace 1.1 rad (a sixth of a lap) from it, and the eye follows it round, rocking 23 degrees either way once in 25 s. 0.2 is ten times slower, 3 half as fast again (5.3 s a lap).
// Knob 3: Loop. Which loop the R takes. At 0 it goes round the ring in u, the loop that reverses orientation: one lap later it sits on its own patch as a mirror R, and two laps later as itself. At 1 it goes round the figure-eight section in v. That loop keeps orientation, and the R is home unchanged after one turn. Between, it moves in both at once at shares 1 - Loop and Loop, so at 0.5 a lap of the ring takes 17 s.
// Knob 4: Tilt. The height of the eye, from 54 degrees above the ring at 0 to 16 degrees at 1, where the figure-eight section is seen nearly side on.

const W = 64, H = 128, N = W * H, TOP = 68;
const { min, max, floor, ceil, sqrt, sin, cos, abs, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// The figure-eight Klein bottle, u and v in [0, 2 pi):
//   r = A + cos(u/2) sin v - sin(u/2) sin 2v
//   (x, y, z) = (r cos u, r sin u, sin(u/2) sin v + cos(u/2) sin 2v)
// v is a plain period. Going once round u comes back to the same point with
// v turned into -v: P(u + 2 pi, v) = P(u, -v), so the square's left and right
// edges are glued with a flip. The circle v = 0, which is the same circle as
// v = pi, is where the surface passes through itself.
const A0 = 2;
// The mesh: NU by NV cells, a vertex row more each way. Column NU is the
// geometric copy of column 0 with v flipped and needs no stitching.
const NU = 112, NV = 56, NV1 = NV + 1, NVT = (NU + 1) * NV1;
// LEDs a unit, and the middle of the top square.
const SC = 9, CX = 32, CY = 34;
// The flat square at the foot: SQ LEDs a side, its corner, and two LEDs of
// it are one cell of the R, so the pixel R is drawn whole there at about the
// size it has above. u runs right and v runs down, as on the screen.
const SQ = 52, SQX = 6, SQY = 70, CELL = (2 * TAU) / SQ;
// The R's home patch and its pixels. From the front, on the near wall, u
// runs right and v runs down, so the R stands upright there. The R is 5 by 7
// cells; in the top square a cell is 0.083 by 0.133 rad, about 2 LEDs a side
// at home, and in the flat square it is 2 LEDs by 2.
const UH = 0.9, VH = 1.6;
const R5 = ["XXXX.", "X...X", "X...X", "XXXX.", "X.X..", "X..X.", "X...X"];
const GL = new Uint8Array(35);
for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) GL[r * 5 + c] = R5[r][c] === "X" ? 1 : 0;
const CU3 = 0.083, CV3 = 0.133, HM = 0.45;
// The trail keeps the lap so far in the flat square and half a lap at most on
// the surface, a sample every 0.012 rad.
const TS = 0.012, TL3 = 3.2, TCAP = 700;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Position and normal at (u, v).
function surf(u, v, out, o) {
  const c = cos(u / 2), s = sin(u / 2), sv = sin(v), s2 = sin(2 * v);
  const r = A0 + c * sv - s * s2;
  out[o] = r * cos(u);
  out[o + 1] = r * sin(u);
  out[o + 2] = s * sv + c * s2;
}
function norm(u, v, out, o) {
  const c = cos(u / 2), s = sin(u / 2), sv = sin(v), s2 = sin(2 * v), cu = cos(u), su = sin(u);
  const r = A0 + c * sv - s * s2;
  const ru = -0.5 * s * sv - 0.5 * c * s2, rv = c * cos(v) - 2 * s * cos(2 * v);
  const xu = ru * cu - r * su, yu = ru * su + r * cu, zu = 0.5 * c * sv - 0.5 * s * s2;
  const xv = rv * cu, yv = rv * su, zv = s * cos(v) + 2 * c * cos(2 * v);
  const nx = yu * zv - zu * yv, ny = zu * xv - xu * zv, nz = xu * yv - yu * xv, l = 1 / (sqrt(nx * nx + ny * ny + nz * nz) + 1e-30);
  out[o] = nx * l;
  out[o + 1] = ny * l;
  out[o + 2] = nz * l;
}

export function setup(params) {
  const A = (n) => new Float32Array(n), I = (n) => new Int32Array(n);
  const S = {
    P: A(NVT * 3), Nn: A(NVT * 3), sx: A(NVT), sy: A(NVT), sd: A(NVT), en: A(NVT * 3), fl: new Uint8Array(NVT),
    // The depth buffer of the whole surface, and of the cells under the R.
    zb: A(W * TOP), ti: I(W * TOP), w1: A(W * TOP), w2: A(W * TOP),
    zg: A(W * TOP), tg: I(W * TOP), g1: A(W * TOP), g2: A(W * TOP),
    col: A(N * 3), pal: A(24), palHue: -1,
    // The R: its place in the covering plane (U runs on without bound, a lap
    // is 2 pi; V is the height), the sideways drift of the v loop, and a
    // trail of where it has been, each sample with the phase it was left at.
    U: UH, W: 0, V: VH, phase: 0, rock: 0, az: -PI / 2 - UH,
    tu: A(TCAP), tv: A(TCAP), tp: A(TCAP), tn: 0, last: 0,
    hue: 0, loop: 0, tilt: 0.06, t: 0,
  };
  for (let i = 0; i <= NU; i++)
    for (let j = 0; j <= NV; j++) {
      const k = (i * NV1 + j) * 3, u = (TAU * i) / NU, v = (TAU * j) / NV;
      surf(u, v, S.P, k);
      norm(u, v, S.Nn, k);
    }
  params.s = S;
  pushSample(S);
}

// Where the R is in the covering plane for a given U, drift Wd and loop share L.
// At L = 0 it rides the S curve V = VH cos((U - UH) / 2), which is a closed
// loop of the bottle: a lap of U later the R is the flipped image of where it
// started. At L = 1 U stands still and V climbs.
const heightAt = (U, Wd, L) => (1 - L) * VH * cos((U - UH) / 2) + L * VH + Wd;

function pushSample(S) {
  S.last = S.phase;
  const n = S.tn % TCAP;
  S.tu[n] = S.U;
  S.tv[n] = S.V;
  S.tp[n] = S.phase;
  S.tn++;
}

// A turn's distance from its start, in [0, pi].
const away = (a) => abs(a - TAU * round(a / TAU));

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  const sp = cl(k[1], 0.2, 3), L = cl(k[2], 0, 1);
  S.loop = L;
  S.tilt = cl(k[3], 0, 1);
  S.t += d;
  // The R slows to a sixth of its pace at home and is back to full pace 1.1
  // rad away, so the mismatch there has time to be read.
  const near = (1 - L) * away(S.U - UH) + L * away(S.W);
  const pace = 0.16 + 0.84 * sm(near / 1.1);
  const ds = d * 1.2 * (sp / 2) * pace, steps = max(1, ceil(ds / TS)), h = ds / steps;
  for (let i = 0; i < steps; i++) {
    S.U += (1 - L) * h;
    S.W += L * h;
    // With the u loop, the drift settles to a whole number of laps of v, so
    // the closed loop of the u lap returns to the home patch.
    S.W += (TAU * round(S.W / TAU) - S.W) * (1 - L) * (1 - L) * min(1, 6 * h);
    S.phase += h;
    S.V = heightAt(S.U, S.W, L);
    if (S.phase - S.last >= TS * 0.9) pushSample(S);
  }
  S.rock += d * 0.25 * (sp / 2);
  // The eye keeps the R's azimuth at the front, and rocks a little.
  S.az = -PI / 2 - S.U + 0.4 * sin(S.rock);
}

// Rose on the face the parameter normal turns from the eye and teal on the
// face it turns to it (the square, with u right and v down, shows the rose
// face). A dim orange reads as brown, so in shadow a face from red to yellow
// goes to crimson and one from yellow to green goes to green; other hues
// slide a little toward violet. The R is pale gold while it stands as it did
// at home and pale lilac where it is flipped against it, the seam is green and
// the crossing circle violet.
function palette(S) {
  const t = S.pal;
  for (let f = 0; f < 2; f++) {
    let h = S.hue + 0.5 + (f ? 0.42 : 0);
    h -= floor(h);
    const sh = h < 0.17 ? 0.94 : h < 0.33 ? 0.33 : h + cl(0.7 - h, -0.04, 0.04);
    hsv(h, 0.62, 1, t, f * 6);
    hsv(sh, 0.9, 0.34, t, f * 6 + 3);
  }
  hsv(S.hue + 0.12, 0.38, 1, t, 12);
  hsv(S.hue + 0.3, 0.8, 1, t, 15);
  hsv(S.hue + 0.68, 0.42, 1, t, 18);
  S.palHue = S.hue;
}

// The R's code at (u, v) for an R whose centre, reduced to the fundamental
// square, is (gu, gv), with cells of cu by cv and which has crossed the seam an
// odd number of times (f = 1): 0 outside, 1 shadow, 2 ink. A point of the
// square also stands for the lifts (u + 2 pi k, (-1)^k v) plus whole turns of
// v, and the R is small enough that only one of them can lie under it. The
// shadow is the R's box and half a cell round it; m widens the outside. The
// lift that held the point is left in lift, for the part of an R that has
// crossed the seam is flipped against the rest.
let lift = 0;
function glyph(u, v, gu, gv, f, cu, cv, m) {
  const du = u - gu, hu = (2.5 + HM) * cu + m, hv = (3.5 + HM) * cv + m;
  for (let k = 0; k < 3; k++) {
    const kk = k === 2 ? -1 : k, d = du + TAU * kk;
    if (d <= -hu || d >= hu) continue;
    let dv = (kk & 1 ? -v : v) - gv;
    dv -= TAU * round(dv / TAU);
    if (dv <= -hv || dv >= hv) return 0;
    const c = floor(d / cu + 2.5), r = floor(3.5 + (f ? -dv : dv) / cv);
    lift = kk & 1;
    return c < 0 || c > 4 || r < 0 || r > 6 ? 1 : GL[r * 5 + c] + 1;
  }
  return 0;
}

// The R's centre in the fundamental square: after k laps the covering plane
// point (U, V) is the square's (U - 2 pi k, +-V), flipped when k is odd.
function reduce(U, V, out) {
  const k = floor(U / TAU);
  out[0] = U - TAU * k;
  out[1] = k & 1 ? -V : V;
  out[2] = k & 1;
}

// A point into the colour buffer at weight a, if it is in front of the
// surface (or without that test, for the square).
function plot(S, x, y, d, c, a, test) {
  const ix = floor(x), iy = floor(y);
  if (ix < 0 || ix >= W || iy < 0 || iy >= (test ? TOP : H)) return;
  const q = iy * W + ix;
  if (test && (d < S.zb[q] - 0.3 || S.ti[q] < 0)) return;
  const o = q * 3, col = S.col;
  col[o] += (c[0] - col[o]) * a;
  col[o + 1] += (c[1] - col[o + 1]) * a;
  col[o + 2] += (c[2] - col[o + 2]) * a;
}

// One triangle into a depth buffer, with the barycentric weights of the
// LED's centre kept for the shading pass. Orthographic, so they are linear
// in the screen and the interpolation is exact.
function tri(S, a, b, c, id, zb, ti, w1, w2) {
  const sx = S.sx, sy = S.sy, sd = S.sd, x0 = sx[a], y0 = sy[a], x1 = sx[b], y1 = sy[b], x2 = sx[c], y2 = sy[c];
  const ix0 = max(0, ceil(min(x0, x1, x2) - 0.5)), ix1 = min(W - 1, floor(max(x0, x1, x2) - 0.5));
  const iy0 = max(0, ceil(min(y0, y1, y2) - 0.5)), iy1 = min(TOP - 1, floor(max(y0, y1, y2) - 0.5));
  if (ix0 > ix1 || iy0 > iy1) return;
  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (abs(area) < 1e-9) return;
  const inv = 1 / area, d0 = sd[a], d1 = sd[b], d2 = sd[c];
  for (let py = iy0; py <= iy1; py++) {
    const Y = py + 0.5;
    for (let px = ix0; px <= ix1; px++) {
      const X = px + 0.5;
      const e1 = ((X - x0) * (y2 - y0) - (x2 - x0) * (Y - y0)) * inv, e2 = ((x1 - x0) * (Y - y0) - (X - x0) * (y1 - y0)) * inv, e0 = 1 - e1 - e2;
      if (e0 < -1e-6 || e1 < -1e-6 || e2 < -1e-6) continue;
      const z = e0 * d0 + e1 * d1 + e2 * d2, q = py * W + px;
      if (z > zb[q]) {
        zb[q] = z;
        ti[q] = id;
        w1[q] = e1;
        w2[q] = e2;
      }
    }
  }
}

// The (u, v) under an LED from its triangle and weights.
function where(id, q1, q2, out) {
  const cell = id >> 1, h = id & 1, i = (cell / NV) | 0, j = cell - i * NV;
  out[0] = (TAU * (i + q1 + (h ? 0 : q2))) / NU;
  out[1] = (TAU * (j + (h ? q1 : 0) + q2)) / NV;
  out[2] = i;
  out[3] = j;
  out[4] = h;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.palHue !== S.hue) palette(S);
  const { P, Nn, sx, sy, sd, en, fl, zb, ti, w1, w2, zg, tg, g1, g2, col, pal } = S;
  const ca = cos(S.az), sa = sin(S.az), el = (54 - 38 * S.tilt) * (PI / 180), ce = cos(el), se = sin(el);
  // The R and its home stamp, reduced to the square.
  const g = [0, 0, 0], s = [0, 0, 0];
  reduce(S.U, S.V, g);
  reduce(UH, VH, s);
  // The mesh into the eye's frame (right, up, depth toward the eye), and
  // which vertices lie under the R.
  for (let k = 0, o = 0, i = 0, j = 0; k < NVT; k++, o += 3) {
    const x = P[o], y = P[o + 1], z = P[o + 2], xr = x * ca - y * sa, yr = x * sa + y * ca;
    sx[k] = CX + SC * xr;
    sy[k] = CY - SC * (yr * se + z * ce);
    sd[k] = z * se - yr * ce;
    const nx = Nn[o], ny = Nn[o + 1], nz = Nn[o + 2], nxr = nx * ca - ny * sa, nyr = nx * sa + ny * ca;
    en[o] = nxr;
    en[o + 1] = nyr * se + nz * ce;
    en[o + 2] = nz * se - nyr * ce;
    fl[k] = glyph((TAU * i) / NU, (TAU * j) / NV, g[0], g[1], g[2], CU3, CV3, 0.07) ? 1 : 0;
    if (++j === NV1) (j = 0), i++;
  }
  zb.fill(-1e9);
  zg.fill(-1e9);
  ti.fill(-1);
  tg.fill(-1);
  for (let i = 0; i < NU; i++)
    for (let j = 0; j < NV; j++) {
      const a = i * NV1 + j, b = a + NV1, c = a + 1, d = b + 1, id = (i * NV + j) * 2, under = fl[a] | fl[b] | fl[c] | fl[d];
      tri(S, a, b, d, id, zb, ti, w1, w2);
      tri(S, a, d, c, id + 1, zb, ti, w1, w2);
      if (under) {
        tri(S, a, b, d, id, zg, tg, g1, g2);
        tri(S, a, d, c, id + 1, zg, tg, g1, g2);
      }
    }
  // Light from the upper left, in front.
  const LX = -0.4, LY = 0.4, LZ = 0.82, HX = LX, HY = LY, HZ = LZ + 1, HL = 1 / sqrt(HX * HX + HY * HY + HZ * HZ);
  const cG = [pal[12], pal[13], pal[14]], cM = [pal[18], pal[19], pal[20]], uv = [0, 0, 0, 0, 0];
  for (let q = 0; q < W * TOP; q++) {
    const o = q * 3, id = ti[q];
    if (id < 0) {
      col[o] = col[o + 1] = col[o + 2] = 0;
      continue;
    }
    const q1 = w1[q], q2 = w2[q], q0 = 1 - q1 - q2;
    where(id, q1, q2, uv);
    const i = uv[2], j = uv[3], h = uv[4], a = i * NV1 + j, b = a + NV1, c = a + 1, d = b + 1, v1 = h ? d : b, v2 = h ? c : d;
    let nx = en[a * 3] * q0 + en[v1 * 3] * q1 + en[v2 * 3] * q2, ny = en[a * 3 + 1] * q0 + en[v1 * 3 + 1] * q1 + en[v2 * 3 + 1] * q2, nz = en[a * 3 + 2] * q0 + en[v1 * 3 + 2] * q1 + en[v2 * 3 + 2] * q2;
    const nl = 1 / (sqrt(nx * nx + ny * ny + nz * nz) + 1e-30);
    nx *= nl;
    ny *= nl;
    nz *= nl;
    const face = nz >= 0 ? 0 : 1, sg = face ? -1 : 1, f6 = face * 6;
    const ld = max(0, sg * (nx * LX + ny * LY + nz * LZ)), hh = max(0, sg * (nx * HX + ny * HY + nz * HZ) * HL), sp = hh ** 24 * 0.5;
    const m = 0.14 + 0.86 * ld, dn = cl((zb[q] + 3.6) / 7.2, 0, 1), dim = 0.72 + 0.28 * dn;
    let r = (pal[f6 + 3] + (pal[f6] - pal[f6 + 3]) * m) * dim + sp, gg = (pal[f6 + 4] + (pal[f6 + 1] - pal[f6 + 4]) * m) * dim + sp, bb = (pal[f6 + 5] + (pal[f6 + 2] - pal[f6 + 5]) * m) * dim + sp;
    // The stamp (dim, where the R started) and then the R itself.
    let gc = glyph(uv[0], uv[1], s[0], s[1], 0, CU3, CV3, 0);
    if (gc === 2) (r = r * 0.45 + cG[0] * 0.4), (gg = gg * 0.45 + cG[1] * 0.4), (bb = bb * 0.45 + cG[2] * 0.4);
    gc = glyph(uv[0], uv[1], g[0], g[1], g[2], CU3, CV3, 0);
    if (gc === 2) {
      const e = 0.8 + 0.2 * ld, ci = (g[2] ^ lift) === 0 ? cG : cM;
      (r = ci[0] * e), (gg = ci[1] * e), (bb = ci[2] * e);
    } else if (gc === 1) (r *= 0.58), (gg *= 0.58), (bb *= 0.58);
    col[o] = r * 255;
    col[o + 1] = gg * 255;
    col[o + 2] = bb * 255;
  }
  // The R behind the surface, seen through it: its own cells' ink, where
  // something nearer covers them. From behind it reads as its mirror image.
  for (let q = 0; q < W * TOP; q++) {
    const id = tg[q];
    if (id < 0 || zg[q] > zb[q] - 1e-4) continue;
    where(id, g1[q], g2[q], uv);
    if (glyph(uv[0], uv[1], g[0], g[1], g[2], CU3, CV3, 0) !== 2) continue;
    const o = q * 3, ci = (g[2] ^ lift) === 0 ? cG : cM;
    col[o] += (ci[0] * 255 - col[o]) * 0.62;
    col[o + 1] += (ci[1] * 255 - col[o + 1]) * 0.62;
    col[o + 2] += (ci[2] * 255 - col[o + 2]) * 0.62;
  }
  // The seam (u = 0, the left and right edges of the square) and the
  // crossing circle (v = 0, its top and bottom), on the surface.
  const pt = [0, 0, 0], tr = [0, 0, 0], cSeam = [pal[15] * 255, pal[16] * 255, pal[17] * 255], cCross = [0, 0, 0];
  hsv(S.hue + 0.78, 0.7, 1, pt, 0);
  for (let e = 0; e < 3; e++) cCross[e] = pt[e] * 255;
  const line = (n, f, c, a) => {
    for (let i = 0; i < n; i++) {
      f(i / n, pt);
      const xr = pt[0] * ca - pt[1] * sa, yr = pt[0] * sa + pt[1] * ca;
      plot(S, CX + SC * xr, CY - SC * (yr * se + pt[2] * ce), pt[2] * se - yr * ce, c, a, true);
    }
  };
  line(260, (t, o) => surf(0, TAU * t, o, 0), cSeam, 0.85);
  line(360, (t, o) => surf(TAU * t, 0, o, 0), cCross, 0.85);
  // The trail, fading with the phase since the R was there: on the surface
  // in the top square, where it is in sight.
  const cT = [[cG[0] * 255, cG[1] * 255, cG[2] * 255], [cM[0] * 255, cM[1] * 255, cM[2] * 255]], n0 = max(0, S.tn - TCAP);
  const into = S.phase - TAU * floor(S.phase / TAU), tl3 = min(TL3, into), tl = into;
  for (let m = S.tn - 1; m >= n0; m--) {
    const ix = m % TCAP, age = S.phase - S.tp[ix];
    if (age > tl3) break;
    reduce(S.tu[ix], S.tv[ix], tr);
    surf(tr[0], tr[1], pt, 0);
    const xr = pt[0] * ca - pt[1] * sa, yr = pt[0] * sa + pt[1] * ca;
    plot(S, CX + SC * xr, CY - SC * (yr * se + pt[2] * ce), pt[2] * se - yr * ce, cT[tr[2]], 0.55 * (1 - age / TL3) ** 2, true);
  }
  // The square: dim ground with a quarter grid, the R and its stamp, the
  // trail behind the R and the road ahead of it, then the edges.
  for (let y = 0; y < SQ; y++)
    for (let x = 0; x < SQ; x++) {
      const u = (x + 0.5) * (TAU / SQ), v = (y + 0.5) * (TAU / SQ), o = ((SQY + y) * W + SQX + x) * 3;
      const grid = (x % 13 === 0 || y % 13 === 0) && (x + y) % 2 === 0 ? 1.5 : 1;
      let r = pal[6] * 0.13 * grid, gg = pal[7] * 0.13 * grid, bb = pal[8] * 0.13 * grid;
      let gc = glyph(u, v, s[0], s[1], 0, CELL, CELL, 0);
      if (gc === 2) (r = cG[0] * 0.3), (gg = cG[1] * 0.3), (bb = cG[2] * 0.3);
      gc = glyph(u, v, g[0], g[1], g[2], CELL, CELL, 0);
      if (gc === 2) {
        const ci = (g[2] ^ lift) === 0 ? cG : cM;
        (r = ci[0]), (gg = ci[1]), (bb = ci[2]);
      } else if (gc === 1) (r *= 0.4), (gg *= 0.4), (bb *= 0.4);
      col[o] = r * 255;
      col[o + 1] = gg * 255;
      col[o + 2] = bb * 255;
    }
  for (let m = S.tn - 1; m >= n0; m--) {
    const ix = m % TCAP, age = S.phase - S.tp[ix];
    if (age > tl) break;
    reduce(S.tu[ix], S.tv[ix], tr);
    const v = ((tr[1] % TAU) + TAU) % TAU;
    plot(S, SQX + (tr[0] * SQ) / TAU, SQY + (v * SQ) / TAU, 0, cT[tr[2]], 0.18 + 0.55 * (1 - age / TAU) ** 2, false);
  }
  // The road ahead: the same steps run on, to the end of the lap, where the
  // R is home again and flipped.
  let fU = S.U, fW = S.W;
  for (let n = 0, nn = ceil((TAU - into) / TS); n < nn; n++) {
    fU += (1 - S.loop) * TS;
    fW += S.loop * TS;
    fW += (TAU * round(fW / TAU) - fW) * (1 - S.loop) * (1 - S.loop) * min(1, 6 * TS);
    reduce(fU, heightAt(fU, fW, S.loop), tr);
    const v = ((tr[1] % TAU) + TAU) % TAU;
    plot(S, SQX + (tr[0] * SQ) / TAU, SQY + (v * SQ) / TAU, 0, cT[tr[2]], 0.13, false);
  }
  const x0 = SQX - 1, x1 = SQX + SQ, y0 = SQY - 1, y1 = SQY + SQ, xm = SQX + SQ / 2, ym = SQY + SQ / 2;
  for (let i = x0; i <= x1; i++) {
    plot(S, i, y0, 0, cCross, 1, false);
    plot(S, i, y1, 0, cCross, 1, false);
  }
  for (let i = y0; i <= y1; i++) {
    plot(S, x0, i, 0, cSeam, 1, false);
    plot(S, x1, i, 0, cSeam, 1, false);
  }
  // Arrows: the seam's two edges point opposite ways (down on the left, up on
  // the right), the crossing circle's two the same way, twice each.
  const chev = (x, y, dx, dy, c) => {
    // A chevron of five LEDs pointing along (dx, dy), its tip at (x, y).
    for (let w = 0; w < 3; w++) {
      const bx = x - dx * w, by = y - dy * w, sx2 = dx === 0 ? w : 0, sy2 = dy === 0 ? w : 0;
      plot(S, bx - sx2, by - sy2, 0, c, 1, false);
      plot(S, bx + sx2, by + sy2, 0, c, 1, false);
    }
  };
  chev(x0, ym + 2, 0, 1, cSeam);
  chev(x1, ym - 2, 0, -1, cSeam);
  for (const yy of [y0, y1]) {
    chev(xm - 3, yy, 1, 0, cCross);
    chev(xm + 5, yy, 1, 0, cCross);
  }
  for (let q = 0, o = 0; q < N; q++, o += 3) display.setPixel(q % W, (q / W) | 0, min(255, col[o]), min(255, col[o + 1]), min(255, col[o + 2]));
}
