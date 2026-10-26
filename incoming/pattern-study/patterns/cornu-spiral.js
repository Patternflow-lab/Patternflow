// ===== Patternflow pattern =====
// Title:   Cornu Spiral
// Family:  line
// Idea:    The Euler spiral curls its two arms into their eyes at (1/2, 1/2) and (-1/2, -1/2) across the top of the panel, a bright phasor chord slides along it from one eye or across a fixed arc of it, and the square of that chord's length, the light Fresnel diffraction puts at one point behind a straight edge or a slit, is traced below as a fringe profile and shown under it as the fringes themselves.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Euler spiral (Leonhard Euler, 1744), Fresnel integrals (Augustin-Jean Fresnel, 1818), Cornu spiral as a diffraction calculator (Marie Alfred Cornu, 1874), pattern round 60
// Round:   60
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Slit=0..1, Spread=0..1
//
// Knob 1: Hue. Turns the spiral and the light round the wheel together. At 0 the spiral is sky blue and the light, the chord, the profile and the fringes, gold; at 0.25 violet and green, at 0.5 red and blue, at 0.75 green and pink. The spiral skips the orange part of the wheel, which reads brown when dim.
// Knob 2: Speed. At 2 the point on the screen crosses it in 5 s and comes back in 5 s, slowing at both ends, so the chord's free end runs up the spiral and back; at 0.2 a crossing takes 50 s, at 3 it takes 3.3 s.
// Knob 3: Slit. At 0 a straight edge: the chord runs from the lower eye, the screen spans w = -2 to 5 in Fresnel units, the light rises from 0 in the shadow through 0.25 at the edge to 1.37 at w = 1.22 and rings down to 1, the dotted line. Above 0 a slit of width a = 0.6 + 7.4 (1 - K3)^1.5, the screen w = -6 to 6, and the chord joins the two ends of an arc a long: at 0.25 (a = 5.4) Fresnel fringes stand inside the slit's image, at 0.5 (a = 3.2) two humps of 1.42 with a dip to 1.05 between them, at 0.75 (a = 1.5) one peak of 1.08 with dark zeros at w = +-1.31, and at 1 (a = 0.6) a broad hump of only 0.18 whose zeros sit at w = +-3.33 = 2 / a, the Fraunhofer sinc squared. The profile is scaled so its highest point stands 42 rows tall.
// Knob 4: Spread. The light's band of wavelengths. At 0 one wavelength in the colour of K1; at 1 white light, 650, 530 and 450 nm in red, green and blue, each with its own chord to its own point of the spiral, since w scales as one over the square root of the wavelength. Behind the straight edge the first fringe is then white with a blue rim toward the shadow and an orange one away from it, the next ones pass through pink, sky blue, yellow, violet and green, and past w = 4.4 they wash out to white. It opens at 0.06, close to one wavelength.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, cos, sin, exp, round, ceil, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// The wheel without its orange and yellow, 0.03 to 0.17.
const wheel = (h) => 0.17 + (h - floor(h)) * 0.86;

// C(t) and S(t), the Fresnel integrals of cos and sin of pi s^2 / 2 from 0
// to t, tabled every 1/200 for |t| <= 12 by Simpson's rule on eight
// substeps a step: C(1) = 0.7798934004 and S(1) = 0.4382591474, and the
// whole table is within 5e-11 of one built on 64 substeps. Between entries
// the spiral is read as a straight chord, at most 0.005 LED off the curve
// at t = 12, where at 39.5 LEDs a unit a coil is one LED across; everything
// past that is the eye.
const TM = 12, TS = 200, NT = 2 * TM * TS + 1, I0 = TM * TS;
const FC = new Float64Array(NT), FS = new Float64Array(NT);
let tabled = false;
function fresnel() {
  if (tabled) return;
  const h = 1 / TS, m = 8, q = h / m;
  let c = 0, s = 0;
  for (let i = 1; i <= I0; i++) {
    const a = (i - 1) * h;
    let sc = 0, ss = 0;
    for (let j = 0; j <= m; j++) {
      const u = a + j * q, ph = (PI * u * u) / 2, wt = j === 0 || j === m ? 1 : j & 1 ? 4 : 2;
      sc += wt * cos(ph);
      ss += wt * sin(ph);
    }
    c += (sc * q) / 3;
    s += (ss * q) / 3;
    FC[I0 + i] = c;
    FS[I0 + i] = s;
    FC[I0 - i] = -c;
    FS[I0 - i] = -s;
  }
  tabled = true;
}
const ZP = [0, 0];
function Z(t) {
  let f = (cl(t, -TM, TM) + TM) * TS, i = floor(f);
  if (i > NT - 2) i = NT - 2;
  f -= i;
  ZP[0] = FC[i] + (FC[i + 1] - FC[i]) * f;
  ZP[1] = FS[i] + (FS[i + 1] - FS[i]) * f;
  return ZP;
}

// The spiral's plane on the panel: 39.5 LEDs a unit about (31.5, 30), S up.
// C runs to +-0.780 (columns 0.7 to 62.3), S to +-0.714 (rows 1.8 to 58.2);
// the eyes sit at (11.75, 49.75) and (51.25, 10.25).
const SC = 39.5, CX = 31.5, CY = 30;
const lx = (c) => CX + c * SC, ly = (s) => CY - s * SC;
// The profile: I = 0 on row 112, the highest value 42 rows up; the screen
// on rows 116 to 127, its LEDs as bright as the light that falls there.
const PB = 112, PH = 42, BAND = 116;
// Wavelengths over the middle one at full Spread: 650 / 530 and 450 / 530.
const DL = [0.226, 0, -0.151], PRIM = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function setup(params) {
  fresnel();
  // The whole spiral once, as the length of curve under each LED.
  const D = new Float32Array(W * 64);
  const step = SC / TS;
  for (let i = 0; i < NT; i++) {
    const x = lx(FC[i]), y = ly(FS[i]), ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
    const put = (a, b, v) => {
      if (a >= 0 && a < W && b >= 0 && b < 64) D[b * W + a] += v;
    };
    put(ix, iy, (1 - fx) * (1 - fy) * step);
    put(ix + 1, iy, fx * (1 - fy) * step);
    put(ix, iy + 1, (1 - fx) * fy * step);
    put(ix + 1, iy + 1, fx * fy * step);
  }
  for (let p = 0; p < D.length; p++) D[p] = min(1, D[p]) ** 0.75;
  params.s = {
    hue: 0, speed: 2, slit: 0, spread: 0.06, clock: 0, phase: 0, warm: false, D,
    last: new Float32Array(W), xh: 0, I: new Float32Array(W * 3),
    A: new Float32Array(W * 65), R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N), c: new Float32Array(24),
  };
}

// Where the screen point is, 0..1 across, from the sweep's phase: there and
// back, slowing at both ends.
const ease = (ph) => {
  const u = ph - 2 * floor(ph / 2), f = u < 1 ? u : 2 - u;
  return (1 - cos(PI * f)) / 2;
};

function mark(S, x0, x1, t) {
  // Columns the head passed between x0 and x1 were lit at time t.
  const a = max(0, ceil(min(x0, x1) - 1e-9)), b = min(W - 1, floor(max(x0, x1)));
  for (let c = a; c <= b; c++) S.last[c] = t;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.slit = cl(k[2], 0, 1);
  S.spread = cl(k[3], 0, 1);
  const rate = S.speed / 10; // crossings a second
  if (!S.warm) {
    // Open as if the head had just come back across the screen from the
    // right, so the whole profile is already there, brightest at the left.
    S.last.fill(-99);
    let px = W - 0.5;
    for (let i = 1; i <= 200; i++) {
      const ph = i / 200 - 1, x = ease(ph) * W - 0.5;
      mark(S, px, x, ph / rate);
      px = x;
    }
    S.xh = -0.5;
    S.warm = true;
  }
  S.clock += d;
  S.phase += d * rate;
  const x = ease(S.phase) * W - 0.5;
  mark(S, S.xh, x, S.clock);
  S.xh = x;
}

// Accumulate light into the float frame: a bilinear splat, and lines as
// splats every third of an LED so a line carries the same light per LED of
// length at any slope.
function splat(S, x, y, v, c, o) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  add(S, ix, iy, (1 - fx) * (1 - fy) * v, c, o);
  add(S, ix + 1, iy, fx * (1 - fy) * v, c, o);
  add(S, ix, iy + 1, (1 - fx) * fy * v, c, o);
  add(S, ix + 1, iy + 1, fx * fy * v, c, o);
}
function add(S, x, y, v, c, o) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = y * W + x;
  S.R[p] += v * c[o];
  S.G[p] += v * c[o + 1];
  S.B[p] += v * c[o + 2];
}
function line(S, x0, y0, x1, y1, v, c, o, ends) {
  const L = hypot(x1 - x0, y1 - y0), n = max(1, ceil(L * 3)), w = (v * L) / n;
  for (let i = ends ? 0 : 1; i <= n; i++) splat(S, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, w, c, o);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { R, G, B, c, D, I, last } = S, sp = S.spread, slit = S.slit > 0;
  R.fill(0);
  G.fill(0);
  B.fill(0);
  // Colours: 0 the dim spiral, 3 the lit arc, 6 the light, 9.. the three
  // wavelengths, 18 white, 21 grey.
  hsv(wheel(0.48 + S.hue), 0.8, 0.32, c, 0);
  hsv(wheel(0.48 + S.hue), 0.4, 0.8, c, 3);
  hsv(0.13 + S.hue, 0.85, 1, c, 6);
  for (let q = 0; q < 3; q++)
    for (let ch = 0; ch < 3; ch++) c[9 + q * 3 + ch] = ((1 - sp) * c[6 + ch]) / 3 + sp * PRIM[q * 3 + ch];
  c[18] = c[19] = c[20] = 1;
  c[21] = c[22] = c[23] = 0.2;

  // The screen in Fresnel units and the slit, a = 0.6 + 7.4 (1 - K3)^1.5.
  const a = 0.6 + 7.4 * (1 - S.slit) ** 1.5;
  const w0 = slit ? -6 : -2, w1 = slit ? 6 : 5, ws = (w1 - w0) / W;
  const rs = [0, 1, 2].map((q) => 1 / sqrt(1 + sp * DL[q]));
  let Imax = 0;
  for (let col = 0; col < W; col++) {
    const w = w0 + (col + 0.5) * ws;
    for (let q = 0; q < 3; q++) {
      let dx, dy;
      if (slit) {
        const p = Z((w - a / 2) * rs[q]), px = p[0], py = p[1], e = Z((w + a / 2) * rs[q]);
        dx = e[0] - px;
        dy = e[1] - py;
      } else {
        const e = Z(w * rs[q]);
        dx = e[0] + 0.5;
        dy = e[1] + 0.5;
      }
      const v = (I[col * 3 + q] = (dx * dx + dy * dy) / 2);
      if (v > Imax) Imax = v;
    }
  }
  const ks = PH / Imax;

  // The spiral, dim, and the part of it that lets light through bright: from
  // the lower eye up to the chord's end behind a straight edge, the arc a
  // long inside a slit.
  for (let y = 0, p = 0; y < 64; y++)
    for (let x = 0; x < W; x++, p++) {
      const v = D[p];
      if (v > 0) (R[p] = v * c[0]), (G[p] = v * c[1]), (B[p] = v * c[2]);
    }
  const wh = w0 + (S.xh + 0.5) * ws;
  const t1 = slit ? wh - a / 2 : -TM, t2 = slit ? wh + a / 2 : wh;
  const i1 = max(0, ceil((t1 + TM) * TS)), i2 = min(NT - 1, floor((t2 + TM) * TS)), st = SC / TS;
  // The lit arc goes through the same tone curve as the spiral, so the
  // coils round an eye stay rings instead of piling up into a white disc.
  const A = S.A;
  A.fill(0);
  for (let i = i1; i <= i2; i++) {
    const x = lx(FC[i]), y = ly(FS[i]), ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy, p = iy * W + ix;
    A[p] += (1 - fx) * (1 - fy) * st;
    A[p + 1] += fx * (1 - fy) * st;
    A[p + W] += (1 - fx) * fy * st;
    A[p + W + 1] += fx * fy * st;
  }
  for (let p = 0; p < A.length; p++)
    if (A[p] > 0) {
      const v = min(1, A[p]) ** 0.75;
      R[p] += v * c[3];
      G[p] += v * c[4];
      B[p] += v * c[5];
    }
  // The unobstructed wave's chord, eye to eye, length sqrt 2: I = 1.
  for (let u = 0.04; u < 1; u += 0.06) splat(S, lx(u - 0.5), ly(u - 0.5), 0.9, c, 21);
  // The chords, one a wavelength, each from its own two points.
  for (let q = 0; q < 3; q++) {
    let x0, y0;
    if (slit) {
      const p = Z((wh - a / 2) * rs[q]);
      (x0 = lx(p[0])), (y0 = ly(p[1]));
    } else (x0 = lx(-0.5)), (y0 = ly(-0.5));
    const e = Z((slit ? wh + a / 2 : wh) * rs[q]), x1 = lx(e[0]), y1 = ly(e[1]);
    line(S, x0, y0, x1, y1, 1.15, c, 9 + q * 3, true);
    splat(S, x1, y1, 0.9, c, 9 + q * 3);
    if (slit) splat(S, x0, y0, 0.9, c, 9 + q * 3);
  }
  splat(S, lx(0.5), ly(0.5), 0.5, c, 18);
  splat(S, lx(-0.5), ly(-0.5), 0.5, c, 18);

  // The profile: I = 1 dotted, the geometric shadow's edges dotted, the
  // curve brightest where the head has just been, and the head itself.
  if (PB - ks > PB - PH - 6) for (let x = 0; x < W; x += 2) add(S, x, round(PB - ks), 0.9, c, 21);
  const edges = slit ? [-a / 2, a / 2] : [0];
  for (const e of edges) {
    const ex = round((e - w0) / ws - 0.5);
    for (let y = PB - PH; y <= PB; y += 2) add(S, ex, y, 0.8, c, 21);
  }
  const now = S.clock, glow = (col) => 0.45 + 0.55 * exp(-(now - last[col]) / 2.2);
  for (let q = 0; q < 3; q++)
    for (let col = 0; col < W - 1; col++) {
      const g = (glow(col) + glow(col + 1)) / 2;
      line(S, col, PB - I[col * 3 + q] * ks, col + 1, PB - I[(col + 1) * 3 + q] * ks, g, c, 9 + q * 3, col === 0);
    }
  const xh = S.xh, ia = floor(cl(xh, 0, W - 2)), fa = cl(xh - ia, 0, 1);
  const Ih = I[ia * 3 + 1] * (1 - fa) + I[(ia + 1) * 3 + 1] * fa, yh = PB - Ih * ks;
  for (let y = yh + 2; y <= PB; y += 2) splat(S, xh, y, 0.5, c, 21);
  splat(S, xh, yh, 1.6, c, 18);
  // The screen.
  for (let col = 0; col < W; col++) {
    const r = [0, 0, 0];
    for (let q = 0; q < 3; q++) {
      const v = I[col * 3 + q] / Imax;
      for (let ch = 0; ch < 3; ch++) r[ch] += v * c[9 + q * 3 + ch];
    }
    for (let y = BAND; y < H; y++) {
      const p = y * W + col;
      (R[p] = r[0]), (G[p] = r[1]), (B[p] = r[2]);
    }
  }
  splat(S, xh, BAND - 2, 1, c, 18);

  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++)
      display.setPixel(x, y, round(min(1, R[p]) * 255), round(min(1, G[p]) * 255), round(min(1, B[p]) * 255));
}
