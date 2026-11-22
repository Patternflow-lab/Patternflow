// ===== Patternflow pattern =====
// Title:   Stomata
// Family:  stomata
// Idea:    Two big breathing pores, each walled by a pair of bean-shaped guard cells full of drifting green chloroplasts, open and close over tens of seconds as a sunfleck and a wandering humidity push on them, while a soft jigsaw of leaf skin cells with warm yellow-green walls shears slowly behind and fades out into a defocused edge.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Stomata, the pores in a leaf's skin, each held open or shut by a pair of guard cells that swell with water (turgor) and sag without it; Hugo von Mohl tied the opening and closing to the guard cells in 1856. The lobed neighbours are pavement cells, drawn here the way a leaf looks under a microscope when it is lit from behind
// Round:   218
// ===============================
// @matrix 64x128
// @knobs Hue=-0.11..0.15, Turgor=0..4, Lens=0..1, Sunfleck=0..0.5
//
// Knob 1: Hue. Adds the knob to the hue of the whole leaf. At the opening 0 the cell bodies are a leaf green with a yellow cast (hue 0.29, 104 degrees), the walls a warm yellow-green, the guard cells a deeper green and the pore a lime-white. At -0.11 the leaf is a golden yellow-green (hue 0.18) and the walls and pore go amber, held at hue 0.115 so they never turn red or brown. At 0.15 it is a blue-green at hue 0.44 (158 degrees).
// Knob 2: Turgor. The water bias of the pores, the knob over 2 minus 1, so -1 to 1. At 0 both big pores sit almost shut, a bright seam about 3 LEDs wide, and only the humidity drift opens one a crack now and then. At the opening 2 the average opening is half, so one pore can gape 10 LEDs wide while the other is nearly shut. At 4 both gape, the big stoma 32 LEDs across with a pore 13 LEDs wide, against 18 across when shut.
// Knob 3: Lens. Magnification, from broad at 0 to fine at 1. The scale runs from 1 to 0.56. At 0 the big stoma is 46 LEDs long and the skin cells are 14 to 22 LEDs wide. At 1 it is 26 LEDs long, the cells are 8 to 12 wide and two more stomata slide in at the right and left edges.
// Knob 4: Sunfleck. How strongly and how fast a patch of brighter light drifts over the leaf, 0 to 0.5. At 0 the light is steady. At the opening 0.06 the patch lifts the light by about a quarter at its centre and a half sweep across the leaf takes about 2.5 minutes. At 0.5 it lifts it by 85 percent, sweeps in about 30 s, and drives the guard cells so that a pore swells open as the patch reaches it.

// The panel is a close-up of the underside of a leaf, backlit. Four stomata sit in the sheet at fixed places,
// and the lens only decides how many of them are on the panel. The sheet is a field of coordinates (U, V):
// the screen coordinates minus a slow shear, up to 4.1 units sideways by row and 2.7 up and down by column, on
// swings of 60 to 140 s that share no period. Everything below is drawn in sheet coordinates, so the cells,
// the pores and the chloroplasts shear together.
// Skin cells: a jittered grid of seeds 18 units apart, each wobbling about 1.3 units on its own phase. A pixel
// is warped a little before it looks for its nearest seeds (two sine layers of 1.1 and 0.25 units, wavelengths
// 16 and 10 units, too weak to fold). The distance to the border between the nearest two seeds draws the wall,
// and every wall is bent sideways by a sine along its own length, 1.7 to 2.2 units over 16, with a phase of its
// own, so it runs in lobes like the pieces of a jigsaw. Walls are 2.3 LEDs wide at half height with a wide
// faint glow. Each cell body is a translucent green with a soft lighter patch round its seed. Away from the
// middle of the panel the lens loses focus: walls widen, dim and fade, and the corners fall to a deep green.
// Stoma: a ring between two ellipses, outer semi-axes (L/2, g + T) and inner (L/2 - 5 k, g), where g is the
// half width of the pore, 0.3 shut and 6.7 k open, T the guard cell thickness (8.8 k to 9.8 k) and k = L / 46.
// L is 46 for the big one, 29, 34 and 31 for the others, each leaning a few degrees on slow swings. The
// distance to each ellipse is exact, so a shut pore stays one smooth seam. The inner wall is thick (2.8 LEDs
// at half height) and gold, the outer one thin and pale; the guard cells are a deep green that is lighter in
// the middle of their thickness; the pore is a lime-white hole, whitest along its middle, with a bloom on the
// guard cells beside it.
// Turgor: each pore has an opening a between 0 and 1. It follows a target, the logistic of three times the
// Turgor bias, plus 2.6 times the sunfleck strength times how much light is on the stoma, plus a humidity
// signal of its own, an Ornstein-Uhlenbeck noise with a memory of 40 s. The opening closes in 11 s and opens
// in 16 s. So the pores change over tens of seconds, never on a fixed period, and two of them are usually in
// different states. The first update runs 120 s of this at the opening knobs so the picture is already formed.
// Sunfleck: two soft ellipses of light on paths of sums of sines with no common period.
// Chloroplasts: soft dots, 3 LEDs across at half height, that ride loops inside each guard cell (out along
// one lane, back along the other, each at its own speed, a loop takes 14 to 35 s) and follow the bean as it
// bends. Skin cells carry two dimmer ones each that circle their seeds in 37 to 57 s. Now and then a dot glints.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, sin, cos, exp, sqrt, abs, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const F = (n) => new Float32Array(n);
const rnd = () => Math.random();
const gauss = () => sqrt(-2 * log(1 - rnd())) * cos(6.2831853 * rnd());

// ---- the sheet
const GR = 18; // seed spacing, sheet units
const IG = 1 / GR;
const OI = 4, OJ = 6, NI = 12, NJ = 20; // seed grid i in -4..7, j in -6..13
const NG = NI * NJ;
const WALL_W = 1.5; // wall half width scale, LEDs
const SIGMA_C = 1.2; // chloroplast sigma, LEDs
const LOBE_A = 1.7; // sideways swing of a wall, sheet units
const LOBE_K = 0.4; // its wave number along the wall

// Stomata: offset from the panel centre in sheet units, lean from vertical, length, and chloroplasts per cell.
const STO = [
  { ox: -2, oy: -27, th: 0.17, L: 46, nc: 11 },
  { ox: 4, oy: 34, th: -0.93, L: 29, nc: 7 },
  { ox: 47, oy: -49, th: 0.62, L: 34, nc: 8 },
  { ox: -47, oy: 52, th: -0.3, L: 31, nc: 7 },
];

const EXPT = F(512); // exp(-q) at a step of 1/64
for (let i = 0; i < 512; i++) EXPT[i] = exp(-i / 64);
const PROF = F(128); // wall profile against distance over half width, step 1/16
for (let i = 0; i < 128; i++) PROF[i] = exp(-1.2 * (i / 16) * (i / 16));
const TONE = F(1024); // soft shoulder: linear to 0.62, then rolls toward 1
for (let i = 0; i < 1024; i++) {
  const v = i / 256;
  TONE[i] = v < 0.62 ? v : 0.62 + 0.38 * (1 - exp(-(v - 0.62) / 0.38));
}

function hsv(h, s, v, out) {
  h -= floor(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  out[0] = f(5);
  out[1] = f(3);
  out[2] = f(1);
}

export function setup(params) {
  const S = {
    t: 0, ready: false,
    hue: 0.29, s: 1, bias: 0, str: 0.3, spd: 0.5,
    ph: [], fa: rnd() * 6.28, fb: rnd() * 6.28, fc: rnd() * 6.28, fd: rnd() * 6.28, fr: rnd() * 6.28,
    f: { x1: 32, y1: 64, c: 1, s: 0, x2: 32, y2: 64 },
    SX: F(NG), SY: F(NG), CV: F(NG), JX: F(NG), JY: F(NG), SP: F(NG), SA: F(NG), SW: F(NG),
    CHL: F(N), FOC: F(N), FLG: F(17 * 33),
    colX: F(W), rowY: F(H), cS: F(W), rS: F(H), shx: F(H), shy: F(W),
    st: [],
    pal: {
      bodyA: [0, 0, 0], bodyB: [0, 0, 0], wall: [0, 0, 0], guard: [0, 0, 0], iw: [0, 0, 0], ow: [0, 0, 0],
      pore: [0, 0, 0], core: [0, 0, 0], chl: [0, 0, 0], sun: [0, 0, 0],
    },
  };
  for (let i = 0; i < 16; i++) S.ph.push(rnd() * 6.2832);
  for (let i = 0; i < NG; i++) {
    S.JX[i] = (rnd() * 2 - 1) * 0.34;
    S.JY[i] = (rnd() * 2 - 1) * 0.34;
    S.SP[i] = rnd() * 6.2832;
    S.SA[i] = 0.7 + rnd() * 0.6;
    S.CV[i] = rnd();
    S.SW[i] = rnd() * 6.2832;
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const dx = (x + 0.5 - 32) / 36, dy = (y + 0.5 - 64) / 70;
      S.FOC[p] = 1 - sm(0.2, 1.55, dx * dx + dy * dy);
    }
  for (const d of STO) {
    const o = { a: 0.5, H: gauss(), light: 0, th: d.th, cells: [] };
    for (let c = 0; c < 2; c++) {
      const dots = [];
      for (let j = 0; j < d.nc; j++)
        dots.push({
          phi: rnd() * 6.2832,
          om: (0.2 + rnd() * 0.2) * (0.9 + 0.2 * c),
          lane: (rnd() * 2 - 1) * 0.85,
          gw: 0.13 + rnd() * 0.2,
          gp: rnd() * 6.2832,
        });
      o.cells.push(dots);
    }
    o.ph = rnd() * 6.2832;
    S.st.push(o);
  }
  params.s = S;
}

function readKnobs(S, k) {
  S.hue = 0.29 + k[0];
  S.bias = (cl(k[1], 0, 4) - 2) / 2;
  S.s = exp(-0.58 * cl(k[2], 0, 1));
  const u = cl(k[3], 0, 0.5) / 0.5;
  S.str = Math.pow(u, 0.55);
  S.spd = 0.15 + 1.45 * u;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  readKnobs(S, k);
  if (!S.ready) {
    S.ready = true;
    for (let i = 0; i < 480; i++) step(S, 0.25);
  }
  step(S, d);
}

// The light at a point of the sheet: two soft ellipses.
function fleckAt(S, X, Y) {
  const f = S.f;
  const dx = X - f.x1, dy = Y - f.y1;
  const u = (dx * f.c + dy * f.s) / 30, v = (-dx * f.s + dy * f.c) / 17;
  const ex = X - f.x2, ey = Y - f.y2;
  return exp(-0.5 * (u * u + v * v)) + 0.55 * exp(-(ex * ex + ey * ey) / 450);
}

function step(S, dt) {
  S.t += dt;
  const sp = S.spd, ph = S.ph;
  S.fa += dt * 0.0613 * sp;
  S.fb += dt * 0.0371 * sp;
  S.fc += dt * 0.0829 * sp;
  S.fd += dt * 0.0517 * sp;
  S.fr += dt * 0.0233 * sp;
  const f = S.f;
  f.x1 = 32 + 44 * sin(S.fa + ph[0]) + 12 * sin(S.fc * 1.7 + ph[1]);
  f.y1 = 64 + 74 * sin(S.fb + ph[2]) + 16 * sin(S.fd * 1.3 + ph[3]);
  const ang = 0.6 + 0.6 * sin(S.fr + ph[4]);
  f.c = cos(ang);
  f.s = sin(ang);
  f.x2 = 32 + 40 * sin(S.fc + ph[5]);
  f.y2 = 64 + 70 * sin(S.fd + ph[6]);
  const eh = exp(-dt / 40), sh = sqrt(1 - eh * eh);
  for (let i = 0; i < STO.length; i++) {
    const d = STO[i], o = S.st[i];
    o.H = o.H * eh + sh * gauss();
    o.light = min(fleckAt(S, 32 + d.ox, 64 + d.oy), 1.2);
    const logit = 3.0 * S.bias + 2.6 * S.str * (o.light - 0.35) + 1.3 * o.H;
    const T = 1 / (1 + exp(-logit));
    const tau = T > o.a ? 16 : 11;
    o.a += (T - o.a) * (1 - exp(-dt / tau));
    o.th = d.th + 0.07 * sin(S.t * 0.0213 + o.ph) + 0.04 * sin(S.t * 0.0377 + 2 * o.ph);
  }
}

// Exact signed distance from (px, py) to an ellipse with semi-axes a and b, negative inside. The cheap
// estimate (r - 1) over the gradient is far out for a thin ellipse such as a shut pore, and the shut seam then
// breaks into dots; this one is exact (the closed form for the nearest point on an ellipse).
function sdEll(px, py, a, b) {
  px = abs(px);
  py = abs(py);
  let ax = a, ay = b;
  if (px > py) {
    const t = px;
    px = py;
    py = t;
    ax = b;
    ay = a;
  }
  const l = ay * ay - ax * ax;
  if (abs(l) < 1e-6) return sqrt(px * px + py * py) - ax;
  const m = (ax * px) / l, m2 = m * m, n = (ay * py) / l, n2 = n * n;
  const c = (m2 + n2 - 1) / 3, c3 = c * c * c;
  const q = c3 + m2 * n2 * 2, d = c3 + m2 * n2, g = m + m * n2;
  let co;
  if (d < 0) {
    const h = Math.acos(cl(q / c3, -1, 1)) / 3, s = cos(h), t = sin(h) * 1.7320508;
    const rx = sqrt(max(0, -c * (s + t + 2) + m2)), ry = sqrt(max(0, -c * (s - t + 2) + m2));
    co = (ry + (l < 0 ? -rx : rx) + abs(g) / (rx * ry + 1e-12) - m) / 2;
  } else {
    const h = 2 * m * n * sqrt(d), qh = q + h, qm = q - h;
    const s = (qh < 0 ? -1 : 1) * Math.pow(abs(qh), 1 / 3), u = (qm < 0 ? -1 : 1) * Math.pow(abs(qm), 1 / 3);
    const rx = -s - u - c * 4 + 2 * m2, ry = (s - u) * 1.7320508, rm = sqrt(rx * rx + ry * ry);
    co = (ry / sqrt(max(1e-12, rm - rx)) + (2 * g) / (rm + 1e-12) - m) / 2;
  }
  co = cl(co, -1, 1);
  const rx = ax * co, ry = ay * sqrt(1 - co * co), dist = sqrt((rx - px) * (rx - px) + (ry - py) * (ry - py));
  return py < ry ? -dist : dist;
}

// ---- drawing
function shearX(Y, t, ph) {
  return 2.6 * sin(0.034 * Y + 0.1013 * t + ph[7]) + 1.5 * sin(0.071 * Y - 0.0597 * t + ph[8]);
}
function shearY(X, t, ph) {
  return 1.7 * sin(0.041 * X + 0.0847 * t + ph[9]) + 1.0 * sin(0.083 * X - 0.0461 * t + ph[10]);
}

function palette(S) {
  const h = S.hue, P = S.pal;
  const hh = (d) => max(0.115, h + d); // never lower than amber, so no red or brown
  hsv(hh(-0.005), 0.72, 0.27, P.bodyA);
  hsv(hh(-0.04), 0.62, 0.35, P.bodyB);
  hsv(hh(-0.06), 0.5, 0.9, P.wall);
  hsv(hh(0.05), 1.0, 0.36, P.guard);
  hsv(hh(-0.1), 0.86, 0.95, P.iw);
  hsv(hh(-0.04), 0.55, 1.0, P.ow);
  hsv(hh(-0.07), 0.5, 0.95, P.pore);
  hsv(hh(-0.1), 0.15, 1.0, P.core);
  hsv(hh(-0.07), 0.5, 1.0, P.chl);
  hsv(hh(-0.06), 0.45, 1.0, P.sun);
}

// The seeds and the warp for this moment.
function sheet(S) {
  const t = S.t, s = S.s, ph = S.ph;
  for (let j = 0; j < NJ; j++)
    for (let i = 0; i < NI; i++) {
      const idx = j * NI + i;
      S.SX[idx] = (i - OI + 0.5 + S.JX[idx] + 0.07 * sin(t * 0.113 * S.SA[idx] + S.SP[idx])) * GR;
      S.SY[idx] = (j - OJ + 0.5 + S.JY[idx] + 0.07 * sin(t * 0.093 * S.SA[idx] + S.SP[idx] * 1.7 + 1)) * GR;
    }
  for (let x = 0; x < W; x++) {
    const X = 32 + (x + 0.5 - 32) / s;
    S.colX[x] = X;
    S.cS[x] = sin(0.27 * X + ph[11] + t * 0.031);
    S.shy[x] = shearY(X, t, ph);
  }
  for (let y = 0; y < H; y++) {
    const Y = 64 + (y + 0.5 - 64) / s;
    S.rowY[y] = Y;
    S.rS[y] = sin(0.27 * Y + ph[12] - t * 0.027);
    S.shx[y] = shearX(Y, t, ph);
  }
}

// The distance to the nearest wall in leaf units (wB), the squared distance to the nearest seed (wD1) and the
// owner of the point (wId) at a point of the sheet. A wall is the border between the two nearest seeds, bent
// sideways by a sine along its own length, with a phase of its own, so it runs in lobes.
let wB = 0, wD1 = 0, wId = 0;
function cells(S, U, V, cSx, rSy, w1, w2, w3, w4) {
  const wx = U + 1.1 * sin(0.38 * V + w1 + 0.7 * cSx) + 0.25 * sin(0.62 * V + w2);
  const wy = V + 1.1 * sin(0.38 * U + w3 + 0.7 * rSy) + 0.25 * sin(0.62 * U + w4);
  const gi = cl(floor(wx * IG), 1 - OI, NI - OI - 2), gj = cl(floor(wy * IG), 1 - OJ, NJ - OJ - 2);
  let b1 = 1e9, b2 = 1e9, i1 = 0, i2 = 0;
  for (let jj = gj - 1; jj <= gj + 1; jj++) {
    const row = (jj + OJ) * NI + OI;
    for (let ii = gi - 1; ii <= gi + 1; ii++) {
      const idx = row + ii, dx = wx - S.SX[idx], dy = wy - S.SY[idx], d = dx * dx + dy * dy;
      if (d < b1) {
        b2 = b1;
        i2 = i1;
        b1 = d;
        i1 = idx;
      } else if (d < b2) {
        b2 = d;
        i2 = idx;
      }
    }
  }
  const ex = S.SX[i1] - S.SX[i2], ey = S.SY[i1] - S.SY[i2];
  const len = sqrt(ex * ex + ey * ey) + 1e-6;
  let sd = (b2 - b1) / (2 * len);
  // along the wall
  const sn = i1 < i2 ? 1 : -1, hh = i1 + i2;
  const tau = sn * ((wx - 0.5 * (S.SX[i1] + S.SX[i2])) * -ey + (wy - 0.5 * (S.SY[i1] + S.SY[i2])) * ex) / len;
  const arg = LOBE_K * tau + S.SW[hh % NG] + 0.37 * (hh % 7);
  const A = LOBE_A * (0.7 + 0.6 * S.SA[hh % NG] * 0.77);
  const lo = A * sin(arg), sl = A * LOBE_K * cos(arg);
  sd += sn * lo;
  wId = sd < 0 ? i2 : i1;
  const sa = abs(sd);
  wB = sa / sqrt(1 + sl * sl / (1 + sa * sa * 0.35));
  wD1 = b1;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  sheet(S);
  const t = S.t, s = S.s, ph = S.ph, P = S.pal;
  const w1 = ph[13] + t * 0.0713, w2 = ph[14] - t * 0.0957, w3 = ph[15] + t * 0.0613, w4 = ph[0] * 0.5 - t * 0.0811;

  // Stoma geometry for this frame.
  const geo = [];
  for (let i = 0; i < STO.length; i++) {
    const d = STO[i], o = S.st[i], k = d.L / 46, a = o.a;
    const Lh = d.L / 2, Te = 5.0 * k, Tm = (8.8 + 1.0 * a) * k, g = max(0.3, (0.3 + 6.4 * a) * k);
    const sn = sin(o.th), cs = cos(o.th);
    const Ao = Lh, Bo = g + Tm, Ai = Lh - Te, Bi = g;
    const R = Lh + 9;
    geo.push({
      cx: 32 + d.ox, cy: 64 + d.oy, sn, cs, k, a, Lh, Te, Tm, g, Ao, Bo, Ai, Bi, R2: R * R,
      light: o.light,
    });
  }

  // Chloroplasts as soft dots, splatted into S.CHL.
  const CHL = S.CHL;
  CHL.fill(0);
  const splat = (U, V, br, sg) => {
    // sheet coordinates to the screen: invert the shear by two passes
    let Y = V, X = U;
    for (let it = 0; it < 3; it++) {
      X = U + shearX(Y, t, ph);
      Y = V + shearY(X, t, ph);
    }
    const sx = 32 + (X - 32) * s, sy = 64 + (Y - 64) * s;
    const x0 = max(0, floor(sx - 3.2)), x1 = min(W - 1, ceil(sx + 3.2)), y0 = max(0, floor(sy - 3.2)), y1 = min(H - 1, ceil(sy + 3.2));
    const inv = 1 / (2 * sg * sg);
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx + 0.5 - sx, dy = yy + 0.5 - sy;
        const q = (dx * dx + dy * dy) * inv;
        if (q < 7.9) CHL[yy * W + xx] += br * EXPT[(q * 64) | 0];
      }
  };
  for (let i = 0; i < STO.length; i++) {
    const G = geo[i], o = S.st[i], d = STO[i];
    // is this stoma anywhere near the panel? the centre and the reach in LEDs
    const scx = 32 + (G.cx - 32) * s, scy = 64 + (G.cy - 64) * s;
    if (scx < -G.R * s - 6 || scx > 64 + G.R * s + 6 || scy < -G.R * s - 6 || scy > 128 + G.R * s + 6) continue;
    const Lm = G.Lh - G.Te * 0.5, Bm = G.g + G.Tm * 0.5;
    for (let c = 0; c < 2; c++) {
      const sg = c === 0 ? 1 : -1, dots = o.cells[c];
      for (let j = 0; j < dots.length; j++) {
        const q = dots[j], phi = q.phi + t * q.om;
        const thp = PI * 0.5 + 0.38 * PI * (0.63662 * Math.asin(sin(phi))), ln = cos(phi) * q.lane;
        const A = Lm + ln * G.Te * 0.35, B = Bm + ln * G.Tm * 0.33;
        const p = A * cos(thp), qq = sg * B * sin(thp);
        const U = G.cx + p * G.sn - qq * G.cs, V = G.cy + p * G.cs + qq * G.sn;
        const gl = 0.72 + 0.28 * sm(0.2, 0.95, sin(t * q.gw + q.gp));
        const foc = S.FOC[cl(floor(32 + (U - 32) * s), 0, W - 1) + cl(floor(64 + (V - 64) * s), 0, H - 1) * W];
        splat(U, V, gl * (0.8 + 0.3 * G.light) * (0.3 + 0.7 * foc) * (0.85 + 0.25 * G.a), SIGMA_C);
      }
    }
  }
  // Skin cell chloroplasts: two per seed on the seed's own small orbit, dim.
  for (let j = 2; j < NJ - 2; j++)
    for (let i = 2; i < NI - 2; i++) {
      const idx = j * NI + i, sx = S.SX[idx], sy = S.SY[idx];
      // leaf position of this seed (rough, warp ignored) to the screen, skip if far off
      const scx = 32 + (sx - 32) * s, scy = 64 + (sy - 64) * s;
      if (scx < -6 || scx > 70 || scy < -6 || scy > 134) continue;
      for (let m = 0; m < 2; m++) {
        const ang = S.SW[idx] * (1 + m * 1.7) + t * (0.11 + 0.06 * m) * (m ? -1 : 1) * (0.8 + 0.4 * S.CV[idx]);
        const r = (0.12 + 0.05 * m) * GR;
        const wx = sx + r * cos(ang), wy = sy + r * 0.8 * sin(ang);
        // back to the sheet: undo the warp roughly
        const U = wx - 2.0 * sin(0.38 * wy + w1), V = wy - 2.0 * sin(0.38 * wx + w3);
        const stomaNear = nearStoma(geo, U, V);
        if (stomaNear < 4.5) continue;
        const foc = S.FOC[cl(floor(scx), 0, W - 1) + cl(floor(scy), 0, H - 1) * W];
        splat(U, V, 0.36 * (0.3 + 0.7 * foc) * sm(4.5, 9, stomaNear), SIGMA_C * 0.95);
      }
    }

  // The light on a 4 LED grid, read back with a bilinear blend (the patch is soft, so this loses nothing).
  const FLG = S.FLG, lit = S.str > 0.002;
  if (lit)
    for (let gy = 0; gy < 33; gy++)
      for (let gx = 0; gx < 17; gx++)
        FLG[gy * 17 + gx] = fleckAt(S, 32 + (gx * 4 - 32) / s, 64 + (gy * 4 - 64) / s) * S.str;

  // The pixels.
  const wl = WALL_W;
  for (let y = 0, p = 0; y < H; y++) {
    const Y = S.rowY[y], shx = S.shx[y], rSy = S.rS[y];
    for (let x = 0; x < W; x++, p++) {
      const X = S.colX[x];
      const U = X - shx, V = Y - S.shy[x];
      const foc = S.FOC[p];
      const vig = 0.34 + 0.66 * foc;
      // light
      let fl = 0;
      if (lit) {
        const fx = (x + 0.5) * 0.25, fy = (y + 0.5) * 0.25, ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, o = iy * 17 + ix;
        fl = (FLG[o] * (1 - ax) + FLG[o + 1] * ax) * (1 - ay) + (FLG[o + 17] * (1 - ax) + FLG[o + 18] * ax) * ay;
      }
      const lm = vig * (1 + 0.85 * fl);

      // stomata fields
      let moat = 9, gm = 0, pm = 0, Iin = 0, Iout = 0, cyl = 0, bl = 0, gi = -1, cdIn = 0;
      for (let i = 0; i < STO.length; i++) {
        const G = geo[i];
        const dx = U - G.cx, dy = V - G.cy;
        if (dx * dx + dy * dy > G.R2) continue;
        const pp = dx * G.sn + dy * G.cs, qq = abs(-dx * G.cs + dy * G.sn);
        const dOut = sdEll(pp, qq, G.Ao, G.Bo) * s;
        if (dOut < moat) moat = dOut;
        if (dOut > 3.2) continue;
        const dIn = sdEll(pp, qq, G.Ai, G.Bi) * s;
        const gmi = cl(0.5 - dOut / 1.6, 0, 1);
        if (gmi * 1 >= gm || Iout === 0) {
          gm = gmi;
          pm = cl(0.5 - dIn / 1.6, 0, 1);
          const wd = dIn - dOut;
          cyl = wd > 0.01 ? sin(PI * cl(dIn / wd, 0, 1)) : 0;
          const xi = dIn / 1.7, xo = dOut / 1.15;
          Iin = exp(-xi * xi * 1.2) * 0.88;
          Iout = exp(-xo * xo * 1.2) * 0.9;
          bl = G.a * exp(-((dIn > 0 ? dIn : 0) / 4.0) * ((dIn > 0 ? dIn : 0) / 4.0)) * 0.26;
          gi = i;
          cdIn = dIn;
        }
      }

      // skin cells
      cells(S, U, V, S.cS[x], rSy, w1, w2, w3, w4);
      const cv = S.CV[wId];
      const lens = EXPT[min(511, (wD1 * 0.0076 * 64) | 0)];
      const bm = (0.5 + 0.8 * lens) * (0.9 + 0.2 * cv) * lm;
      let r = mix(P.bodyA[0], P.bodyB[0], cv) * bm;
      let g = mix(P.bodyA[1], P.bodyB[1], cv) * bm;
      let b = mix(P.bodyA[2], P.bodyB[2], cv) * bm;
      // sunwash: the translucent leaf glows where the light is
      const sw = fl * 0.2 * (0.4 + 0.6 * vig);
      r += P.sun[0] * sw;
      g += P.sun[1] * sw;
      b += P.sun[2] * sw;
      // walls
      const bl_ = wB * s;
      const wf = 1 + 1.1 * (1 - foc);
      const wi = (bl_ / (wl * wf)) * 16;
      const wmask = moat > 3.4 ? 1 : sm(0.3, 3.4, moat);
      const wamp = (0.25 + 0.6 * foc) * (0.8 + 0.2 * cv) * wmask * (1 + 0.35 * fl);
      const wI = wi < 127 ? PROF[wi | 0] * wamp / sqrt(wf) : 0;
      const gI = EXPT[min(511, ((bl_ / 3.4) * (bl_ / 3.4) * 64) | 0)] * 0.13 * wamp;
      const wa = min(0.95, wI);
      r = mix(r, P.wall[0] * (0.78 + 0.22 * vig), wa) + P.wall[0] * gI;
      g = mix(g, P.wall[1] * (0.78 + 0.22 * vig), wa) + P.wall[1] * gI;
      b = mix(b, P.wall[2] * (0.78 + 0.22 * vig), wa) + P.wall[2] * gI;

      // the stoma on top
      if (gi >= 0) {
        const G = geo[gi];
        const gb = 0.62 + 0.4 * cyl;
        const lg = lm * (0.86 + 0.3 * G.a);
        const pvis = sm(0.4, 2.2, G.g * s); // a shut pore is the bright seam of the two inner walls, not a dotted slit
        const ring = gm * (1 - pm * pvis);
        r = mix(r, P.guard[0] * gb * lg, ring);
        g = mix(g, P.guard[1] * gb * lg, ring);
        b = mix(b, P.guard[2] * gb * lg, ring);
        // bloom of the open pore onto the guard cells beside it
        const bb = bl * ring * (0.5 + 0.5 * vig);
        r += P.pore[0] * bb;
        g += P.pore[1] * bb;
        b += P.pore[2] * bb;
        // the pore, a lime-white hole in the backlit leaf
        const pw = G.g * s + 0.6;
        const core = cl(-cdIn / pw, 0, 1);
        const pb = (0.62 + 0.3 * min(fl, 1)) * (0.45 + 0.55 * vig) * (0.8 + 0.5 * core);
        const cw = core * 0.8 * vig * pvis;
        const pr = mix(P.pore[0] * pb, P.core[0], cw), pg = mix(P.pore[1] * pb, P.core[1], cw), pbl = mix(P.pore[2] * pb, P.core[2], cw);
        const pmv = pm * pvis;
        r = mix(r, pr, pmv);
        g = mix(g, pg, pmv);
        b = mix(b, pbl, pmv);
        // thick bright wall on the pore side, thin on the outside
        const vv = 0.4 + 0.6 * vig;
        const ia = Iin * vv, oa = Iout * vv;
        r = mix(r, P.iw[0], ia);
        g = mix(g, P.iw[1], ia);
        b = mix(b, P.iw[2], ia);
        r = mix(r, P.ow[0], oa * 0.8);
        g = mix(g, P.ow[1], oa * 0.8);
        b = mix(b, P.ow[2], oa * 0.8);
      }

      // chloroplasts
      const ch = CHL[p];
      if (ch > 0.004) {
        const c = min(ch * 1.1, 1);
        r = mix(r, P.chl[0], c);
        g = mix(g, P.chl[1], c);
        b = mix(b, P.chl[2], c);
      }

      const R = TONE[(cl(r, 0, 3.99) * 256) | 0], Gc = TONE[(cl(g, 0, 3.99) * 256) | 0], B = TONE[(cl(b, 0, 3.99) * 256) | 0];
      display.setPixel(x, y, R * 255, Gc * 255, B * 255);
    }
  }
}

// How far a sheet point is outside the nearest stoma's outer ring, in sheet units (rough).
function nearStoma(geo, U, V) {
  let m = 99;
  for (let i = 0; i < geo.length; i++) {
    const G = geo[i], dx = U - G.cx, dy = V - G.cy;
    if (dx * dx + dy * dy > G.R2) continue;
    const pp = dx * G.sn + dy * G.cs, qq = -dx * G.cs + dy * G.sn;
    const d = sdEll(pp, qq, G.Ao, G.Bo);
    if (d < m) m = d;
  }
  return m;
}
