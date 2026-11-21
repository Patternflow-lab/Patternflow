// ===== Patternflow pattern =====
// Title:   Ogives
// Family:  glacier
// Idea:    A valley glacier seen from above flows down the tall panel from a broken icefall of indigo crevasses and lit seracs into a smooth tongue, time-lapsed, and the ice carries a banded record of years, a pale clean band for each winter and a dusty slate one for each summer, bowed into arches that point down-valley because the ice in the middle of the valley runs faster than the ice at the walls; the valley winds and narrows and widens so the arches turn and stretch round the bends, a low sun from the upper left shades the wave ogives, a gray medial moraine begins where a tributary joins and carries slow pulses of debris, and dark rock walls hold the whole glacier in.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Forbes bands and ogives (James David Forbes, Travels through the Alps of Savoy, 1843), the plug-like cross-flow profile of a glacier with a nonlinear ice law (John Nye, 1965), wave ogives (Edwin Waddington, 1986), band ogives below an icefall at Bas Glacier d'Arolla (Goodsell, Hambrey and Glasser, 2005), hill shading (Berthold Horn, 1981), pattern round 212
// Round:   212
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.4..4, Years=6..13, Bend=0..0.3
//
// Knob 1: Hue. Turns the tint of the ice once round the colour wheel, while the dust, rock and moraines swing 57 degrees one way and the other and come back, so a full turn ends where it began. At 0 the ice is white-cyan in the sun and blue in the shade, the dust bands slate, the rock near black indigo and the crevasses indigo; at 0.25 the ice is lime over teal-gray dust, at 0.5 salmon over blue-gray dust, at 0.75 violet.
// Knob 2: Flow. How fast the time-lapse runs, as the speed of the ice at the middle of the valley where it is 38 LEDs wide: 0.75 LEDs a second per unit, 0.3 at 0.4, 1.5 where it opens at 2, 3 at 4. At 1.5 a band takes about a minute to go from the foot of the icefall to the bottom of the panel. Only the clock of the ice changes, so the bands, the seracs and the moraines carry on from where they were and a turn never jumps the picture.
// Knob 3: Years. How many years of ice lie in the 100 rows below the icefall, 6 to 13: at the opening, 6, the bands are 16.7 LEDs from one winter to the next at the middle of the valley, and at 13 they are 7.7 apart. A year lasts 72 to 128 percent of the mean and its winter takes 36 to 64 percent of it, drawn from a seeded generator, so the narrowest winter band is 4.3 LEDs wide at 6 years and 2.0 at 13.
// Knob 4: Bend. How much the valley winds, 0 to 0.3. At 0 it is straight, the width varies 4 percent and the arches are clean and symmetric. Where it opens, at 0.06, the middle line swings up to 1.8 LEDs and the width 8 percent either way. At 0.3 the middle swings up to 9 LEDs in an S and the width by a quarter, narrow where the ice speeds up and the bands stretch, wide where it slows and they crowd, and the arches turn with each bend. The tributary joins at 40 percent down at every setting, and it widens the valley by 1.8 LEDs at 0 and by 5 at 0.3.

// Every point of the ice is a parcel that left the top of the icefall some time ago. Its position
// in the valley is a distance along the valley, the row y, and a place across it, xi, which is the
// signed distance from the middle line x_c(y) in units of half the local width, so the walls are
// xi = -1 and +1. The ice runs parallel to the walls, so a flow line is a line of constant xi and
// the speed along y is
//   v(y, xi) = c(y) f(xi),    c(y) = v0 W0 / W(y),    f(xi) = U0 + (1 - U0) (1 - |xi|^4).
// c is mass conservation (the same ice goes through a narrower gap faster) and f is the plug-like
// profile that Nye found for an ice law with exponent 3: it is nearly flat in the middle and falls
// to the walls, where U0 = 0.5 of the middle speed is left (Nye's value for no slip at the wall is 0). Because v is a product of a function
// of y and a function of xi, the time a parcel has taken from the top is separable,
//   A(y, xi) = FG(y) / f(xi),    FG(y) = integral of dy' / c(y') with v0 divided out.
// A row's FG is summed once a frame. A band is born at the icefall at the time its year begins, so the
// ice at (y, xi) shows the year that began A ago: no particles, and the bands go where the flow takes
// them. The line A = constant is an arch with its tip down-valley where f is the largest.
// Near the walls an arch runs almost along the flow and the band between two of them is thinner than
// an LED, whatever U0 is (at xi = 0.8 and 50 seconds of age it is under one LED for U0 = 0.4). Where a
// band comes out under 3 LEDs it is drawn as the mean of its two tones, and the lateral moraine
// covers the last few LEDs at the wall.
// Speeding up v0 changes the clock of the flow, THETA = the integral of v0 dt, and nothing else.
// The year boundaries sit in an array of lengths drawn when they are needed: the array grows by one year
// whenever the icefall has made one, and the first 70 are made before the first frame.
// Surface relief of the wave ogives is a height h = HAMP(y) wave(phase of the year), with the crest in
// the middle of the winter band and the trough in the middle of the summer band, and its gradient is
// worked out from the gradient of A, not from the picture. The shading is Lambert, from a sun that
// stands 28 degrees up and swings slowly about the upper left.
// The icefall is a Voronoi field in (xi, birth time of the ice), so it moves with the ice and is sheared
// by the same arches. It is steepest in the top rows, where c is 2.7 times faster, and it calms
// down the same way the picture cross-fades into the ogives below it.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, sin, cos, exp, abs, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  v = (v - a) / (b - a);
  v = v < 0 ? 0 : v > 1 ? 1 : v;
  return v * v * (3 - 2 * v);
};
const TAU = 2 * PI;

// ---- the valley
const W0 = 38; // mean width of the ice, LEDs
const HW0 = W0 / 2;
const U0 = 0.5; // the speed at the walls over the speed in the middle
const GF = 1.7; // extra speed in the icefall
const YT = 52; // the row where the tributary joins, 40 percent down
const CXS = 13, CYS = 2.7; // size of a serac block in the icefall's own units, across and along
const HAMP = 0.75; // height of the wave ogives, LEDs
const ZC = 2.4; // height of the crown of the ice, LEDs
const XIM = 0.46; // the flow line the medial moraine runs along
const FM = U0 + (1 - U0) * (1 - XIM * XIM * XIM * XIM);
const V0K = 0.75; // LEDs a second at the middle per unit of Flow
const SEED = 0x6a09e667;

// ---- hash, noise and the Voronoi field
function hh(i, j) {
  let h = (Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hh(ix, iy), b = hh(ix + 1, iy), c = hh(ix, iy + 1), d = hh(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
// the rock: ridges that run along the valley
const rockRidge = (x, y) => 1 - abs(2 * vn(x * 0.17 + 3 + 2.5 * vn(y * 0.03, 8), y * 0.025 + 1) - 1);
const rockH = (x, y) => {
  const a = vn(x * 0.11 + 11, y * 0.06 + 5), c = vn(x * 0.17 + 3 + 2.5 * vn(y * 0.03, 8), y * 0.025 + 1), d = vn(x * 0.31 + 8, y * 0.07 + 4);
  return 0.5 * a + 0.34 * (1 - abs(2 * c - 1)) + 0.16 * (1 - abs(2 * d - 1));
};
const VO = new Float64Array(6);
function cells(u, v) {
  const iu = floor(u), iv = floor(v);
  let f1 = 9, f2 = 9, bi = 0, bj = 0, bx = 0, by = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const ci = iu + i, cj = iv + j;
      const dx = ci + 0.15 + 0.7 * hh(ci * 2 + 1, cj) - u, dy = cj + 0.15 + 0.7 * hh(ci, cj * 2 + 1) - v;
      const d = dx * dx + dy * dy;
      if (d < f1) {
        f2 = f1; f1 = d; bi = ci; bj = cj; bx = dx; by = dy;
      } else if (d < f2) f2 = d;
    }
  VO[0] = sqrt(f2) - sqrt(f1);
  VO[1] = bi; VO[2] = bj; VO[3] = bx; VO[4] = by;
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- colour ramps, 256 steps over a shade s from 0 to 2.2, turned round the wheel by an angle
const ICE = [[0, 22, 26, 84], [0.3, 38, 60, 132], [0.55, 58, 111, 160], [1.0, 127, 216, 240], [1.4, 215, 242, 255], [2.2, 245, 252, 255]];
const DUST = [[0, 20, 22, 58], [0.5, 44, 50, 94], [1.0, 90, 106, 128], [1.5, 156, 154, 166], [2.2, 206, 200, 204]];
const ROCK = [[0, 14, 16, 38], [0.75, 22, 26, 52], [1.05, 32, 36, 68], [1.4, 64, 64, 104], [1.8, 112, 98, 136], [2.2, 196, 156, 160]];
const GRAY = [[0, 34, 34, 62], [0.6, 82, 80, 100], [1.0, 142, 138, 150], [1.5, 200, 192, 196], [2.2, 238, 230, 228]];
const STEPS = 256, SCALE = (STEPS - 1) / 2.2;
const SLIT = ((0.13 * SCALE) | 0) * 3; // the indigo of a crevasse, as a place in the dust ramp

function rampLut(stops, ang) {
  const lut = new Float32Array(STEPS * 3);
  const cs = cos(ang), sn = sin(ang);
  let k = 0;
  for (let i = 0; i < STEPS; i++) {
    const s = i / SCALE;
    while (k < stops.length - 2 && s > stops[k + 1][0]) k++;
    const a = stops[k], b = stops[k + 1], t = cl((s - a[0]) / (b[0] - a[0]), 0, 1);
    const r = a[1] + (b[1] - a[1]) * t, g = a[2] + (b[2] - a[2]) * t, bl = a[3] + (b[3] - a[3]) * t;
    // The turn is on the chroma plane of YIQ, which keeps the light of every step as it was.
    const y = 0.299 * r + 0.587 * g + 0.114 * bl, I = 0.596 * r - 0.274 * g - 0.322 * bl, Q = 0.211 * r - 0.523 * g + 0.312 * bl;
    const I2 = I * cs - Q * sn, Q2 = I * sn + Q * cs;
    lut[i * 3] = cl(y + 0.956 * I2 + 0.621 * Q2, 0, 255);
    lut[i * 3 + 1] = cl(y - 0.272 * I2 - 0.647 * Q2, 0, 255);
    lut[i * 3 + 2] = cl(y - 1.106 * I2 + 1.703 * Q2, 0, 255);
  }
  return lut;
}

// ---- the valley's shape at row y: the middle line, the half width
const GO = [0, 0];
function geom(y, b) {
  const wv = 0.04 + 0.22 * b;
  let w = W0 * (1 + wv * (0.6 * sin((TAU * y) / 47 + 1.9) + 0.4 * sin((TAU * y) / 83 + 4.0)));
  const wc = 5 * (0.35 + 0.65 * b) * sm(YT - 3, YT + 12, y);
  w += wc;
  GO[0] = 31 + b * (6.5 * sin((TAU * y) / 121 + 0.9) + 2.6 * sin((TAU * y) / 53 + 2.6)) + 0.5 * wc;
  GO[1] = 0.5 * w;
}
const bump = (y) => sm(0, 8, y) * (1 - sm(28, 46, y));

// ---- years
function addYear(S) {
  const r1 = S.rnd(), r2 = S.rnd();
  const len = 0.72 + 0.56 * r1;
  S.B.push(S.B[S.B.length - 1] + len);
  S.PH.push(0.36 + 0.28 * r2);
}

export function setup(params) {
  const S = {
    warm: false, t: 0, Th: 0, P: 70.37, kf: 40,
    v0: 1.5, v0T: 1.5, Ly: 16.7, LyT: 16.7, b: 0.2, bT: 0.2, hue: -1, hueT: 0,
    rnd: mulberry(SEED), B: [0], PH: [], ice: null, dust: null, rock: null, gray: null,
    xc: new Float32Array(H), hw: new Float32Array(H), dxc: new Float32Array(H), dhw: new Float32Array(H),
    g: new Float32Array(H), fg: new Float32Array(H), ej: new Float32Array(H * 2), rb: new Float32Array(H),
    sun: [0, 0, 0],
    hx: new Float32Array(N), hy: new Float32Array(N), mm: new Float32Array(N), lm: new Float32Array(N),
    md: new Float32Array(N), cw: new Float32Array(N), hb: new Float32Array(N), we: new Float32Array(N),
    rub: new Float32Array(N), fo: new Float32Array(N), rk: new Float32Array(N * 3),
  };
  while (S.B[S.B.length - 1] < S.P + 3) addYear(S);
  params.s = S;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06];
  S.hueT = cl(kn[0], 0, 1);
  S.v0T = V0K * cl(kn[1], 0.4, 4);
  S.LyT = 100 / cl(kn[2], 6, 13);
  S.bT = cl(kn[3], 0, 0.3) / 0.3;
  if (!S.warm) {
    S.warm = true;
    S.v0 = S.v0T; S.Ly = S.LyT; S.b = S.bT;
  }
  const d = cl(dt || 0, 0, 0.1);
  const k = (tau) => 1 - exp(-d / tau);
  S.v0 += (S.v0T - S.v0) * k(0.5);
  S.Ly += (S.LyT - S.Ly) * k(0.5);
  S.b += (S.bT - S.b) * k(0.5);
  S.t += d;
  const dth = S.v0 * d;
  S.Th += dth;
  S.P += dth / S.Ly;
  while (S.B[S.B.length - 1] < S.P + 3) addYear(S);
  if (S.B[0] < S.P - 260) {
    let n = 0;
    while (S.B[n + 1] < S.P - 160) n++;
    S.B.splice(0, n);
    S.PH.splice(0, n);
    S.kf = max(0, S.kf - n);
  }
  if (S.hue < 0 || abs(S.hueT - S.hue) > 0.002) {
    S.hue = S.hueT;
    const a = TAU * S.hue;
    S.ice = rampLut(ICE, a);
    // the dust, rock and moraines swing 57 degrees either way and come back, so one turn of the knob ends where it began
    const a2 = sin(a);
    S.dust = rampLut(DUST, a2);
    S.rock = rampLut(ROCK, a2);
    S.gray = rampLut(GRAY, a2);
  }
  // the rows
  const b = S.b;
  let acc = 0;
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5;
    geom(yc - 0.5, b);
    const xa = GO[0], ha = GO[1];
    geom(yc + 0.5, b);
    const xb = GO[0], hb2 = GO[1];
    geom(yc, b);
    S.xc[y] = GO[0];
    S.hw[y] = GO[1];
    S.dxc[y] = xb - xa;
    S.dhw[y] = hb2 - ha;
    const g = (GO[1] / HW0) / (1 + GF * bump(yc));
    S.g[y] = g;
    S.fg[y] = acc + 0.5 * g;
    acc += g;
    // the rock's own edge: a few LEDs of wander, left and right, and how wide the lit rock band is
    S.ej[y * 2] = 1.6 * (vn(y * 0.17 + 3.1, 5.5) - 0.5);
    S.ej[y * 2 + 1] = 1.6 * (vn(y * 0.15 + 9.3, 17.5) - 0.5);
    S.rb[y] = 3 + 3 * vn(y * 0.09 + 21.7, 2.5);
  }
  // the sun, on the screen's plane: toward the sun is up and to the left
  const az = (225 + 13 * sin((TAU * S.t) / 143 + 1) + 8 * sin((TAU * S.t) / 61.3 + 2.2)) * (PI / 180);
  const el = (28 + 3 * sin((TAU * S.t) / 97 + 0.4)) * (PI / 180);
  S.sun[0] = cos(el) * cos(az);
  S.sun[1] = cos(el) * sin(az);
  S.sun[2] = sin(el);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ice) return;
  const { B, PH, hx, hy, mm, lm, md, cw, hb, we, rk, rub, fo } = S;
  const Ly = S.Ly, Th = S.Th, P = S.P;
  const lx = S.sun[0], ly = S.sun[1], lz = S.sun[2];
  const RF = 52; // rows with an icefall
  const rock = S.rock, ice = S.ice, dust = S.dust, gray = S.gray;
  let kf = S.kf;
  if (kf > B.length - 2) kf = B.length - 2;
  // the tributary's tongue lies in the right wall: from up and out to the edge of the ice at row YT
  const yT = floor(YT);
  const tx1 = S.xc[yT] + S.hw[yT] - 1, ty1 = YT + 4, tx0 = tx1 + 11, ty0 = YT - 19;
  const tl = sqrt((tx1 - tx0) * (tx1 - tx0) + (ty1 - ty0) * (ty1 - ty0));
  const tdx = (tx1 - tx0) / tl, tdy = (ty1 - ty0) / tl;

  // ---- pass 1: where is every LED in the valley, and what has the ice there been through
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5, xc = S.xc[y], hw = S.hw[y], dxc = S.dxc[y], dhw = S.dhw[y], g = S.g[y], fg = S.fg[y];
    const ejl = S.ej[y * 2], ejr = S.ej[y * 2 + 1], rb = S.rb[y];
    const ampy = (0.25 + 0.75 * sm(30, 66, yc)) * (1 - 0.45 * sm(70, 128, yc)) * sm(14, 40, yc);
    const wfall = sm(1, 9, yc) * (1 - sm(22, 42, yc));
    const bandOn = sm(12, 40, yc);
    const medOn = sm(YT - 4, YT + 5, yc);
    const medW = 1.7 + max(0, yc - YT) * 0.035;
    const xim = XIM + (1 - XIM) * (1 - sm(YT - 2, YT + 24, yc));
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const dx = x + 0.5 - xc;
      const side = dx < 0 ? -1 : 1;
      const dout = abs(dx) - hw - (side < 0 ? ejl : ejr);
      // 1 in the ice, 0 in the rock, with a soft LED at the edge
      const w = cl(0.5 - dout, 0, 1);
      we[i] = w;
      if (w < 1) {
        // rock: ridges that run along the valley, a slope that rises away from the ice, lit from the upper left
        const xr = x + 0.5, eps = 0.7;
        const r0 = rockH(xr, yc), rx = rockH(xr + eps, yc) - r0, ry = rockH(xr, yc + eps) - r0;
        const dd = max(dout, 0);
        const gx = (rx / eps) * 3 + side * 0.5, gy = (ry / eps) * 3;
        const sr = (lz - gx * lx - gy * ly) / (sqrt(1 + gx * gx + gy * gy) * lz);
        const env = 1 - 0.65 * sm(rb, rb + 9, dd);
        const crest = sm(0.72, 0.9, rockRidge(xr, yc)) * (side > 0 ? 0.75 : 0.28) * (0.5 + 0.5 * vn(xr * 0.1 + 40, yc * 0.05 + 3));
        const si = cl((0.98 + (r0 - 0.5) * 0.35 * env + (sr - 1) * 0.8 * env + crest * env) * SCALE, 0, STEPS - 1) | 0;
        let cr = rock[si * 3], cg = rock[si * 3 + 1], cb = rock[si * 3 + 2];
        // the tongue of the tributary
        if (side > 0 && y > ty0 - 6 && y < ty1 + 6) {
          const rx2 = xr - tx0, ry2 = yc - ty0;
          const along = rx2 * tdx + ry2 * tdy, across = -rx2 * tdy + ry2 * tdx;
          const hwt = 4.4 - 1.0 * (along / tl);
          const tw = sm(-0.7, 0.7, hwt - abs(across)) * sm(-1.5, 1.5, along);
          if (tw > 0.01) {
            const u = across / hwt;
            const ts = 1 + 0.35 * u;
            const ti = cl(ts * 1.15 * SCALE, 0, STEPS - 1) | 0, td = ti;
            const ph2 = (Th * 0.85 - along) / (Ly * 0.9), fr = ph2 - floor(ph2);
            const mt = sm(0.5, 0.6, fr) * (1 - sm(0.92, 1.0, fr)) * 0.45;
            let tr = ice[ti * 3] * (1 - mt) + dust[td * 3] * mt;
            let tg = ice[ti * 3 + 1] * (1 - mt) + dust[td * 3 + 1] * mt;
            let tb = ice[ti * 3 + 2] * (1 - mt) + dust[td * 3 + 2] * mt;
            const e = sm(0.55, 0.88, abs(u)) * 0.85, gi = (0.6 + 0.4 * ts) * SCALE | 0;
            tr += (gray[gi * 3] - tr) * e;
            tg += (gray[gi * 3 + 1] - tg) * e;
            tb += (gray[gi * 3 + 2] - tb) * e;
            cr += (tr - cr) * tw;
            cg += (tg - cg) * tw;
            cb += (tb - cb) * tw;
          }
        }
        rk[i * 3] = cr;
        rk[i * 3 + 1] = cg;
        rk[i * 3 + 2] = cb;
        if (w <= 0) {
          hx[i] = hy[i] = mm[i] = lm[i] = md[i] = cw[i] = hb[i] = rub[i] = fo[i] = 0;
          continue;
        }
      }
      // ice: xi, the speed profile, the age
      const xi = cl(dx / hw, -1, 1);
      const x2 = xi * xi, x4 = x2 * x2;
      const f = U0 + (1 - U0) * (1 - x4);
      const q = 4 * (1 - U0) * xi * x2;
      const A = fg / f;
      const lag = Th - A;
      // the bands' wobble, carried with the ice
      let p = P - A / Ly + 0.05 * (vn(xi * HW0 * 0.16 + 40, lag * 0.13) - 0.5);
      const r = (fg * q) / (f * f * hw);
      const dAx = r, dAy = g / f - r * (dxc + xi * dhw);
      const gpx = -dAx / Ly, gpy = -dAy / Ly;
      const gp = sqrt(gpx * gpx + gpy * gpy) + 1e-4;
      // which year
      let k = kf;
      if (p < B[0]) p = B[0];
      while (k < B.length - 2 && p >= B[k + 1]) k++;
      while (k > 0 && p < B[k]) k--;
      kf = k;
      const Bk = B[k], len = B[k + 1] - Bk, ph = PH[k], pw = Bk + ph * len;
      const summer = p >= pw;
      const dsum = summer ? min(p - pw, B[k + 1] - p) : -min(p - Bk, pw - p);
      const mraw = sm(-1, 1, dsum / gp / 0.9);
      // bands thinner than 3 LEDs melt into one tone
      const cf = sm(1.3, 3.2, (min(ph, 1 - ph) * len) / gp);
      mm[i] = (mraw * cf + 0.45 * (1 - cf)) * bandOn;
      // wave ogive: crest mid winter, trough mid summer
      const pos = summer ? 0.5 + (0.5 * (p - pw)) / ((1 - ph) * len) : (0.5 * (p - Bk)) / (ph * len);
      const dpos = summer ? 0.5 / ((1 - ph) * len) : 0.5 / (ph * len);
      const dh = HAMP * ampy * cf * TAU * cos(TAU * pos) * dpos;
      // and the crown of the ice, high in the middle
      hx[i] = dh * gpx - (2 * ZC * xi) / hw;
      hy[i] = dh * gpy;
      // the icefall: cells that ride with the ice, sheared by the same arches
      let cwv = 0, hbv = 0;
      if (y < RF) {
        const wfx = wfall * w * (1 - sm(0.7, 0.95, abs(xi)));
        if (wfx > 0.01) {
          const u0 = (xi * HW0) / CXS, v0 = lag / CYS;
          const u = u0 + 0.7 * (vn(u0 * 0.5 + 5, v0 * 0.5 + 2) - 0.5), v = v0 + 0.9 * (vn(u0 * 0.5 + 9, v0 * 0.45 + 7) - 0.5);
          cells(u, v);
          const e = VO[0];
          const tx = hh(VO[1] + 101, VO[2]) - 0.5, ty = hh(VO[1], VO[2] + 77) - 0.5;
          hbv = (4.2 * sm(0.02, 0.62, e) + 1.6 * (tx * -VO[3] + ty * -VO[4])) * wfx;
          // the slit is e < 0.26 of a cell, and is dropped where that comes to under 1 LED
          const gu = HW0 / (hw * CXS), gv = sqrt(dAx * dAx + dAy * dAy) / CYS;
          const slit = 0.26 / sqrt((gu * gu + gv * gv) * 0.5);
          cwv = (1 - sm(0.1, 0.26, e)) * sm(1.3, 2.4, slit) * wfx * (1 - sm(0.52, 0.72, abs(xi)));
        }
      }
      hb[i] = hbv;
      cw[i] = cwv;
      // lateral moraines, along the flow lines at both walls, and the medial one
      const sd = xi < 0 ? 0 : 1;
      const xlm = 1 - (2.6 + 2.0 * vn(lag * 0.085 + sd * 13.1, 7.7 + sd * 3)) / hw;
      rub[i] = vn(xi * HW0 * 0.3 + 50, lag * 0.55);
      fo[i] = vn(xi * HW0 * 0.3 + 70, lag * 0.045 + 3) - 0.5;
      lm[i] = sm(-1.4, 1.4, (abs(xi) - xlm) * hw) * (0.65 + 0.35 * vn(lag * 0.21 + 2.3, sd * 5.1));
      const am = Th * FM - fg;
      const pulse = 0.22 + 0.78 * sm(0.22, 0.7, vn(am * 0.058 + 8.2, 4.4));
      const medw = medW * (0.7 + 0.6 * vn(am * 0.17 + 1.1, 9.9));
      const um = (dx - xim * hw) / medw;
      md[i] = (1 - sm(medw - 0.9, medw + 0.9, abs(dx - xim * hw))) * pulse * medOn;
      // the stripe is a ridge of rubble, lit on its left side
      hx[i] += ((-2 * um * 1.8) / medw) * md[i];
    }
  }
  S.kf = kf;

  // ---- pass 2: the light on the ice, the icefall's relief by differences, the colours
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, w = we[i];
      let r = rk[i * 3], g = rk[i * 3 + 1], b = rk[i * 3 + 2];
      if (w > 0) {
        let gx = hx[i], gy = hy[i];
        if (y < RF) {
          const il = x > 0 ? i - 1 : i, ir = x < W - 1 ? i + 1 : i, iu = y > 0 ? i - W : i, id = y < H - 1 ? i + W : i;
          gx += ((hb[ir] - hb[il]) / (ir - il || 1)) * 0.9;
          gy += ((hb[id] - hb[iu]) / ((id - iu) / W || 1)) * 0.9;
        }
        const s = (lz - gx * lx - gy * ly) / (sqrt(1 + gx * gx + gy * gy) * lz) + 0.16 * fo[i];
        const m = mm[i];
        const ii = cl(s * 1.2 * SCALE, 0, STEPS - 1) | 0, di = cl(s * 0.95 * SCALE, 0, STEPS - 1) | 0;
        let ir2 = ice[ii * 3] * (1 - m) + dust[di * 3] * m;
        let ig = ice[ii * 3 + 1] * (1 - m) + dust[di * 3 + 1] * m;
        let ib = ice[ii * 3 + 2] * (1 - m) + dust[di * 3 + 2] * m;
        // the slits of the icefall, deep indigo
        const c = cw[i] * 0.9;
        if (c > 0) {
          ir2 += (dust[SLIT] - ir2) * c;
          ig += (dust[SLIT + 1] - ig) * c;
          ib += (dust[SLIT + 2] - ib) * c;
        }
        // the lateral moraine, slate with rubble
        const l = lm[i] * 0.88;
        if (l > 0.01) {
          const gi = cl((0.2 + 0.27 * s + 0.2 * sm(0.55, 0.7, rub[i])) * SCALE, 0, STEPS - 1) | 0;
          ir2 += (gray[gi * 3] - ir2) * l;
          ig += (gray[gi * 3 + 1] - ig) * l;
          ib += (gray[gi * 3 + 2] - ib) * l;
        }
        // the medial moraine, gray
        const mv = md[i];
        if (mv > 0.01) {
          const gi = cl((0.62 + 0.45 * s) * SCALE, 0, STEPS - 1) | 0;
          const a = min(mv * 1.3, 0.97);
          ir2 += (gray[gi * 3] - ir2) * a;
          ig += (gray[gi * 3 + 1] - ig) * a;
          ib += (gray[gi * 3 + 2] - ib) * a;
        }
        r += (ir2 - r) * w;
        g += (ig - g) * w;
        b += (ib - b) * w;
      }
      display.setPixel(x, y, r, g, b);
    }
  }
}
