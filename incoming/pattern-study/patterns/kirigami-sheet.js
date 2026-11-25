// ===== Patternflow pattern =====
// Title:   Kirigami Sheet
// Family:  kirigami
// Idea:    A sheet cut into 180 rigid squares hinged at their corners, neighbours turning in opposite senses, so that as a travelling field of opening angles runs over it the squares rotate and diamond holes open and close between them, the whole sheet widening in both directions at once, every square a dark anodised tile with a thin bright edge and a glint that sweeps across it as it turns, and the ground between them near black, lit only inside the holes, each as warm as it is open, by a slow aurora behind.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the rotating-squares auxetic mechanism, a sheet of rigid squares joined at their corners that turn in opposite senses and so grow in both directions when pulled, a Poisson ratio of exactly -1 (Grima and Evans 2000, "Auxetic behavior from rotating squares", from memory; the hole opening as sin 2 theta of the tile area, from memory); kirigami, the Japanese art of cutting paper, as the cut-sheet form of it; the lattice relaxed by position-based constraints on the hinge points; pattern round 241
// Round:   241
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pull=0..4, Wave=-1..1, Skew=-1..1
//
// Knob 1: Hue. Turns the whole scheme round the wheel. At 0 the tiles are dark slate blue with pale periwinkle edges and glints, the ground between them is near-black indigo, and a hole lights from violet through rose to pale gold as it opens; at 0.25 the tiles are mauve and the light olive, at 0.5 the tiles are sage and the light sand. The tile saturation stays under 0.55 everywhere on the wheel.
// Knob 2: Pull. 0 to 4, opening at 2. The mean turning angle of the squares: 3 degrees at 0 (the squares touch, the sheet is a solid dark plane with a hairline seam and a few ripples, and no hole is lit) and 41 degrees at 4 (the squares stand almost on their points and each hole is as big as a square, half the sheet, and lit gold and rose). At 2 the squares are turned 22 degrees on average, between 11 and 33 as the waves pass, and the holes take two fifths of the sheet. The sheet is 32 percent wider and taller at 2 than shut, and 41 percent at 4. The waves fade towards both ends of the knob.
// Knob 3: Wave. -1 to 1, opening at 0. How strong and how short the travelling waves of angle are. At -1 the whole sheet mostly breathes together, swinging between 14 and 30 degrees about every 12 s, under long faint swells 90 to 180 LED from crest to crest. At 0 the angle runs between 11 and 33 degrees, the waves are 60 to 120 LED long and cross in 6 to 10 s, and the lattice warps visibly. At 1 it runs between 7 and 37 degrees, the waves are 47 to 88 LED long, and where the angle changes fastest two neighbouring squares can part at a corner by up to 2 LED.
// Knob 4: Skew. -1 to 1, opening at about 0. A gradient of the angle across the sheet that bends the lattice, its axis swinging 17 degrees either way once in about 170 s. At -1 and at 1 the squares are almost shut in one corner of the panel and nearly 40 degrees open in the opposite one, so the holes grow from nothing to a full square across the panel and the rows fan out, the sign only choosing the corner. At 0 the sheet has no gradient except the slow turning one in the waves.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, exp, sqrt, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const A = 9;                         // the side of a square, LED
const NX = 10, NY = 18, NT = NX * NY; // 180 squares, a sheet 90 x 162 LED when shut, always larger than the panel
const THMAX = 0.77;                  // the widest turn, 44 degrees
const HH = A / 2 - 0.22;             // half side drawn, so that two shut squares leave a hairline
const RAD = A * 0.7071 + 1.4;
const ITER = 22, ITER0 = 120;
const LX = -0.55, LY = -0.83;        // the light, from upper left
const LUTN = 64;

// ---- colour -----------------------------------------------------------------
// The brownness of a dim red, orange or yellow is cured by paling and lifting it. Every colour goes through here.
function rgb(h, s, v, out, o) {
  h = h - floor(h);
  const br = (h > 0.5 ? sstep(0.8, 0.95, h) : 1 - sstep(0.2, 0.34, h)) * sstep(0.1, 0.35, s) * sstep(0.06, 0.34, v), dv = 1 - v;
  s *= 1 - 0.55 * br * dv;
  v = min(1, v * (1 + 1.0 * br * dv));
  const hh = h * 6, i = floor(hh) % 6, f = hh - floor(hh), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// ---- state ------------------------------------------------------------------
export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], t: 0, init: false,
    u0: 0.5, wv: 0.5, sk: 0,
    ph: [], rnd: new Float32Array(NT), th: new Float32Array(NT),
    cx: new Float32Array(NT), cy: new Float32Array(NT),
    orx: new Float32Array(NT), ory: new Float32Array(NT), olx: new Float32Array(NT), oly: new Float32Array(NT),
    oux: new Float32Array(NT), ouy: new Float32Array(NT), odx: new Float32Array(NT), ody: new Float32Array(NT),
    co: new Float32Array(NT), si: new Float32Array(NT),
    col: new Float32Array(NT * 12),
    bg: new Float32Array(17 * 33 * 3), buf: new Float32Array(W * H * 3), dm: new Float32Array(W * H), tl: new Float32Array(W * H), lut: new Float32Array(LUTN * 3), lutHue: -9,
    err: 0, mx: 0, my: 0,
  });
  for (let i = 0; i < 12; i++) st.ph.push(Math.random() * 6.2832);
  for (let i = 0; i < NT; i++) st.rnd[i] = Math.random() - 0.5;
  return st;
}

// ---- the angle field ----------------------------------------------------------
// u runs 0 (shut) to 1 (squares on their points). Position p is in LED from the middle of the sheet, in the lattice's own frame.
function field(st, px, py, w) {
  const t = st.t, ph = st.ph;
  const ks = 0.5 + 0.5 * w;
  // waves running over the sheet, each its own way, wavelength and speed
  let f = 0.5 * sin(ks * 0.0713 * (0.82 * px + 0.57 * py) - 0.62 * t + ph[2]);
  f += 0.36 * sin(ks * 0.1031 * (-0.58 * px + 0.81 * py) + 0.88 * t + ph[3]);
  f += 0.24 * sin(ks * 0.1337 * (0.99 * px - 0.15 * py) - 1.14 * t + ph[4]);
  // a slow rotating gradient
  const a = 0.061 * t + ph[5];
  f += 0.3 * (px * cos(a) + py * sin(a)) / 60;
  return f;
}

// soft clamp of u to 0..1
const sc = (u) => 0.5 * (sqrt(u * u + 0.02) - sqrt((u - 1) * (u - 1) + 0.02)) + 0.5;

function angles(st) {
  const th = st.th, u0 = st.u0, w = st.wv, sk = st.sk, t = st.t;
  const e = 0.28 + 0.72 * 4 * u0 * (1 - u0);
  // the whole sheet breathes: two incommensurate periods, 12.6 s and 30 s
  const breath = (0.2 - 0.06 * w) * e * (0.55 * sin(0.5 * t + st.ph[0]) + 0.27 * sin(0.2 * t + st.ph[1]) + 0.18 * sin(0.0877 * t + st.ph[2]));
  const amp = (0.1 + 0.3 * w) * e;
  const sa = 0.9 + 0.3 * sin(0.037 * t + st.ph[6]), ca = cos(sa), sn = sin(sa);
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const px = (i - (NX - 1) / 2) * A * 1.2, py = (j - (NY - 1) / 2) * A * 1.2;
      const u = u0 + breath + amp * field(st, px, py, w) + 0.5 * sk * (px * ca + py * sn) / 70;
      th[j * NX + i] = THMAX * sc(u);
    }
  }
}

// ---- the lattice --------------------------------------------------------------
// Square (i, j) has sign s = +1 or -1 by checkerboard and turns by s theta. Its four corners are the hinges: the right one for the
// neighbour to its right, and so on, each corner the one the neighbour's own turn brings to meet it.
function layout(st, iters) {
  const th = st.th, cx = st.cx, cy = st.cy;
  const orx = st.orx, ory = st.ory, olx = st.olx, oly = st.oly, oux = st.oux, ouy = st.ouy, odx = st.odx, ody = st.ody;
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const n = j * NX + i, s = (i + j) & 1 ? -1 : 1, p = s * th[n], c = cos(p), q = sin(p);
      st.co[n] = c;
      st.si[n] = q;
      // R(p) applied to the corner (x, y) of a unit square, times A
      orx[n] = A * (c * 0.5 + q * 0.5 * s);   // right: (0.5, -0.5 s)
      ory[n] = A * (q * 0.5 - c * 0.5 * s);
      olx[n] = A * (-c * 0.5 - q * 0.5 * s);  // left: (-0.5, 0.5 s)
      oly[n] = A * (-q * 0.5 + c * 0.5 * s);
      oux[n] = A * (c * 0.5 * s - q * 0.5);   // up: (0.5 s, 0.5)
      ouy[n] = A * (q * 0.5 * s + c * 0.5);
      odx[n] = A * (-c * 0.5 * s + q * 0.5);  // down: (-0.5 s, -0.5)
      ody[n] = A * (-q * 0.5 * s - c * 0.5);
    }
  }
  if (iters > ITER) {
    // a first guess from adding up the hinge steps along each row and column
    for (let j = 0; j < NY; j++) {
      cx[j * NX] = 0;
      for (let i = 1; i < NX; i++) {
        const a = j * NX + i - 1, b = a + 1;
        cx[b] = cx[a] + orx[a] - olx[b];
      }
    }
    for (let i = 0; i < NX; i++) {
      cy[i] = 0;
      for (let j = 1; j < NY; j++) {
        const a = (j - 1) * NX + i, b = a + NX;
        cy[b] = cy[a] + ouy[a] - ody[b];
      }
    }
  }
  for (let it = 0; it < iters; it++) {
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const a = j * NX + i;
        if (i < NX - 1) {
          const b = a + 1;
          const ex = (cx[a] + orx[a] - cx[b] - olx[b]) * 0.5, ey = (cy[a] + ory[a] - cy[b] - oly[b]) * 0.5;
          cx[a] -= ex; cy[a] -= ey; cx[b] += ex; cy[b] += ey;
        }
        if (j < NY - 1) {
          const b = a + NX;
          const ex = (cx[a] + oux[a] - cx[b] - odx[b]) * 0.5, ey = (cy[a] + ouy[a] - cy[b] - ody[b]) * 0.5;
          cx[a] -= ex; cy[a] -= ey; cx[b] += ex; cy[b] += ey;
        }
      }
    }
  }
  // centre the sheet on the panel
  let mx = 0, my = 0;
  for (let n = 0; n < NT; n++) { mx += cx[n]; my += cy[n]; }
  mx /= NT; my /= NT;
  for (let n = 0; n < NT; n++) { cx[n] -= mx; cy[n] -= my; }
  // the worst hinge gap, for the record
  let worst = 0;
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const a = j * NX + i;
      if (i < NX - 1) {
        const b = a + 1;
        worst = max(worst, Math.hypot(cx[a] + orx[a] - cx[b] - olx[b], cy[a] + ory[a] - cy[b] - oly[b]));
      }
      if (j < NY - 1) {
        const b = a + NX;
        worst = max(worst, Math.hypot(cx[a] + oux[a] - cx[b] - odx[b], cy[a] + ouy[a] - cy[b] - ody[b]));
      }
    }
  }
  st.err = worst;
}

// ---- update -----------------------------------------------------------------
export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  dt = cl(dt || 0, 0, 0.1);
  const goalU = cl(st.k[1] / 4, 0, 1), goalW = cl((st.k[2] + 1) / 2, 0, 1), goalS = cl(st.k[3], -1, 1);
  if (!st.init) {
    st.init = true;
    st.u0 = goalU; st.wv = goalW; st.sk = goalS;
    st.t = 0;
    angles(st);
    layout(st, ITER0);
    return;
  }
  const b = 1 - exp(-dt / 0.12);
  st.u0 += (goalU - st.u0) * b;
  st.wv += (goalW - st.wv) * b;
  st.sk += (goalS - st.sk) * b;
  st.t += dt;
  angles(st);
  layout(st, ITER);
}

// ---- draw -------------------------------------------------------------------
// The ground is a deep indigo, nearly black. Light shows only in the holes, and a hole is as warm as it is open: the heat of a hole
// (how far the nearest square is turned, times the slow aurora) walks a ramp from indigo through violet and rose to pale gold, so a
// hole that is only a crack stays cool and dark and never goes brown.
const HEAT = [
  [0.0, 0.74, 0.8, 0.11],
  [0.25, 0.76, 0.78, 0.25],
  [0.5, 0.84, 0.62, 0.42],
  [0.72, 0.92, 0.55, 0.58],
  [0.88, 1.05, 0.44, 0.8],
  [1.0, 1.1, 0.24, 0.9],
];
function buildLut(st) {
  const c = [0, 0, 0];
  for (let i = 0; i < LUTN; i++) {
    const u = i / (LUTN - 1);
    let k = 0;
    while (k < HEAT.length - 2 && u > HEAT[k + 1][0]) k++;
    const a = HEAT[k], b = HEAT[k + 1], f = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
    rgb(a[1] + (b[1] - a[1]) * f + st.k[0], a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f, c, 0);
    st.lut[i * 3] = c[0]; st.lut[i * 3 + 1] = c[1]; st.lut[i * 3 + 2] = c[2];
  }
  st.lutHue = st.k[0];
}

// the slow aurora, on a 4 LED grid: a number 0.5 to 1 that scales the heat of the holes
function backing(st) {
  const bg = st.bg, t = st.t;
  for (let gy = 0; gy < 33; gy++) {
    for (let gx = 0; gx < 17; gx++) {
      const x = gx * 4, y = gy * 4;
      const c = 0.5 + 0.5 * sin(0.11 * x + 1.7 * sin(0.021 * y + 0.17 * t) + 0.23 * t);
      const d = 0.5 + 0.5 * sin(0.047 * y - 0.6 * sin(0.03 * x + 0.09 * t) - 0.13 * t);
      const e = 0.5 + 0.5 * sin(0.083 * (0.8 * x - 0.6 * y) + 0.071 * t + 2.0 * sin(0.016 * (0.6 * x + 0.8 * y) - 0.049 * t));
      bg[gy * 17 + gx] = 0.5 + 0.5 * (0.4 * c + 0.3 * d + 0.3 * e);
    }
  }
}

function tileColours(st) {
  const col = st.col, th = st.th, t = st.t, h0 = 0.6 + st.k[0];
  const v = [0, 0, 0];
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const n = j * NX + i, s = (i + j) & 1 ? -1 : 1;
      const slow = 0.02 * sin(0.05 * t + 0.7 * i + 0.4 * j + st.ph[7]) + 0.015 * sin(0.031 * t - 0.5 * i + 0.9 * j + st.ph[8]);
      const h = h0 + 0.04 * (th[n] / THMAX) + 0.008 * s + 0.01 * st.rnd[n] + slow, o = n * 12;
      // anodised metal: one hue, a dark end, a body, a pale end; the saturation stays low
      rgb(h - 0.015, 0.7, 0.1 + 0.02 * st.rnd[n], v, 0); col[o] = v[0]; col[o + 1] = v[1]; col[o + 2] = v[2];
      rgb(h, 0.52, 0.34, v, 0); col[o + 3] = v[0]; col[o + 4] = v[1]; col[o + 5] = v[2];
      rgb(h + 0.02, 0.28, 0.82, v, 0); col[o + 6] = v[0]; col[o + 7] = v[1]; col[o + 8] = v[2];
      rgb(h + 0.01, 0.16, 0.98, v, 0); col[o + 9] = v[0]; col[o + 10] = v[1]; col[o + 11] = v[2];
    }
  }
}

// A second, larger sheet far behind, seen only through the holes: a plain uniform lattice, so its centres are known without a
// relaxation, turning on a breath of its own and drifting the other way from the near sheet. It only dims and edges the glow.
const GA = 15, GNX = 7, GNY = 12, GH2 = GA / 2 - 0.2;
function ghost(st, buf) {
  const t = st.t, th = 0.3 + 0.16 * st.u0 + 0.2 * sin(0.113 * t + st.ph[7]) + 0.08 * sin(0.047 * t + st.ph[8]);
  const c = cos(th), q = sin(th), d = GA * (c + q);
  const ox = W / 2 - 5 * sin(0.061 * t + st.ph[9] + 1.0) - 3 * sin(0.0267 * t + 2.0), oy = H / 2 - 8 * sin(0.047 * t + st.ph[11] + 1.0);
  const rad = GA * 0.7071 + 1.4;
  for (let j = 0; j < GNY; j++) {
    for (let i = 0; i < GNX; i++) {
      const s = (i + j) & 1 ? -1 : 1, qq = s * q;
      const cxn = (i - (GNX - 1) / 2) * d + ox, cyn = (j - (GNY - 1) / 2) * d + oy;
      const x0 = max(0, floor(cxn - rad)), x1 = min(W - 1, ceil(cxn + rad)), y0 = max(0, floor(cyn - rad)), y1 = min(H - 1, ceil(cyn + rad));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - cxn, dy = y + 0.5 - cyn;
          const ux = c * dx + qq * dy, uy = -qq * dx + c * dy;
          const dd = GH2 - max(abs(ux), abs(uy)), cov = cl(dd + 0.5, 0, 1);
          if (cov <= 0) continue;
          const p = (y * W + x) * 3, e = 1 - sstep(0.2, 1.3, dd);
          // frosted: the glow is a little dimmer in the middle of the tile and a little brighter along its edge
          const f = 1 + (0.72 + 0.5 * e - 1) * cov;
          buf[p] *= f; buf[p + 1] *= f; buf[p + 2] *= f;
        }
      }
    }
  }
}

export function draw(display, params) {
  let st = params.st;
  if (!st) st = setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  backing(st);
  tileColours(st);
  const buf = st.buf, bg = st.bg, dm = st.dm, tl = st.tl, col = st.col, th = st.th;
  const t = st.t, ox = W / 2 + 4.2 * sin(0.061 * t + st.ph[9]) + 2.4 * sin(0.0267 * t + st.ph[10]);
  const oy = H / 2 + 6.5 * sin(0.047 * t + st.ph[11]) + 3 * sin(0.0213 * t + st.ph[10]);
  // pass one: for each LED, how far out of the nearest square it lies, and how far that square is turned
  dm.fill(-9);
  tl.fill(st.u0 * THMAX);
  for (let n = 0; n < NT; n++) {
    const cxn = st.cx[n] + ox, cyn = st.cy[n] + oy, c = st.co[n], q = st.si[n];
    const x0 = max(0, floor(cxn - RAD - 3)), x1 = min(W - 1, ceil(cxn + RAD + 3)), y0 = max(0, floor(cyn - RAD - 3)), y1 = min(H - 1, ceil(cyn + RAD + 3));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cxn, dy = y + 0.5 - cyn;
        const d = HH - max(abs(c * dx + q * dy), abs(-q * dx + c * dy)), p = y * W + x;
        if (d > dm[p]) { dm[p] = d; tl[p] = th[n]; }
      }
    }
  }
  // the glow, bilinear from its 4 LED grid, and the ground
  if (abs(st.k[0] - st.lutHue) > 1e-4) buildLut(st);
  const lut = st.lut;
  for (let y = 0; y < H; y++) {
    const gy = (y + 0.5) / 4 - 0.5, y0 = cl(floor(gy), 0, 31), fy = cl(gy - y0, 0, 1);
    for (let x = 0; x < W; x++) {
      const gx = (x + 0.5) / 4 - 0.5, x0 = cl(floor(gx), 0, 15), fx = cl(gx - x0, 0, 1);
      const p = y * W + x, o = p * 3, a = y0 * 17 + x0;
      const aur = (bg[a] * (1 - fx) + bg[a + 1] * fx) * (1 - fy) + (bg[a + 17] * (1 - fx) + bg[a + 18] * fx) * fy;
      // how lit this place is: by the turn of the nearest square (hole area goes as sin 2 theta), and a little less at the lip
      const heat = sstep(0.1, 0.5, tl[p]) * (0.7 + 0.3 * sstep(0.2, 2.2, -dm[p])) * aur;
      const li = round(heat * (LUTN - 1)) * 3;
      buf[o] = lut[li]; buf[o + 1] = lut[li + 1]; buf[o + 2] = lut[li + 2];
    }
  }
  ghost(st, buf);
  // pass two: the squares
  // the light wanders: tile classes brighten and darken in turn as it passes their angle
  const lam = 0.45 + 0.4 * sin(0.043 * t + st.ph[1]) + 0.2 * sin(0.0197 * t + st.ph[2]), cb = 0.7071, sb = 0.7071;
  for (let n = 0; n < NT; n++) {
    const i = n % NX, j = (n / NX) | 0, s = (i + j) & 1 ? -1 : 1, phi = s * th[n];
    const cxn = st.cx[n] + ox, cyn = st.cy[n] + oy, c = st.co[n], q = st.si[n];
    const x0 = max(0, floor(cxn - RAD)), x1 = min(W - 1, ceil(cxn + RAD));
    const y0 = max(0, floor(cyn - RAD)), y1 = min(H - 1, ceil(cyn + RAD));
    if (x0 > x1 || y0 > y1) continue;
    const o = n * 12;
    const bphi = 0.5 + 0.5 * cos(2 * (phi - lam));
    // the light as the tile sees it
    const lx = c * LX + q * LY, ly = -q * LX + c * LY;
    const gt = 1.7 * sin(2.6 * phi - 0.9 + 0.8 * st.rnd[n]);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cxn, dy = y + 0.5 - cyn;
        const ux = c * dx + q * dy, uy = -q * dx + c * dy;
        const d = HH - max(abs(ux), abs(uy));
        const cov = cl(d + 0.5, 0, 1);
        if (cov <= 0) continue;
        const nx = ux / HH, ny = uy / HH;
        let tone = 0.04 + 0.5 * bphi + 0.08 * sin(0.047 * cxn - 0.031 * cyn + 0.29 * t + st.ph[3]) + 0.16 * (nx * cb + ny * sb) + 0.09 * (ny * lx + nx * ly);
        tone = cl(tone, 0, 1);
        let r, g, b;
        if (tone < 0.5) {
          const f = tone * 2;
          r = col[o] + (col[o + 3] - col[o]) * f; g = col[o + 1] + (col[o + 4] - col[o + 1]) * f; b = col[o + 2] + (col[o + 5] - col[o + 2]) * f;
        } else {
          const f = (tone - 0.5) * 2;
          r = col[o + 3] + (col[o + 6] - col[o + 3]) * f; g = col[o + 4] + (col[o + 7] - col[o + 4]) * f; b = col[o + 5] + (col[o + 8] - col[o + 5]) * f;
        }
        // the glint: a band that sweeps across the tile as it turns
        const gp = nx * 0.866 + ny * 0.5 - gt;
        const gl = 0.55 * exp(-gp * gp * 6);
        if (gl > 0.01) { r += (col[o + 9] - r) * gl; g += (col[o + 10] - g) * gl; b += (col[o + 11] - b) * gl; }
        // the thin bright edge
        const rim = (1 - sstep(0.1, 0.8, d)) * 0.5;
        const p = (y * W + x) * 3;
        r += (col[o + 9] - r) * rim; g += (col[o + 10] - g) * rim; b += (col[o + 11] - b) * rim;
        buf[p] += (r - buf[p]) * cov; buf[p + 1] += (g - buf[p + 1]) * cov; buf[p + 2] += (b - buf[p + 2]) * cov;
      }
    }
  }
  // the hinges: a small pin where two corners meet, only as the sheet opens, so that the squares read as joined
  for (let n = 0; n < NT; n++) {
    const i = n % NX, j = (n / NX) | 0;
    for (let k = 0; k < 2; k++) {
      let m, hx, hy;
      if (k === 0) {
        if (i === NX - 1) continue;
        m = n + 1;
        hx = (st.cx[n] + st.orx[n] + st.cx[m] + st.olx[m]) * 0.5; hy = (st.cy[n] + st.ory[n] + st.cy[m] + st.oly[m]) * 0.5;
      } else {
        if (j === NY - 1) continue;
        m = n + NX;
        hx = (st.cx[n] + st.oux[n] + st.cx[m] + st.odx[m]) * 0.5; hy = (st.cy[n] + st.ouy[n] + st.cy[m] + st.ody[m]) * 0.5;
      }
      hx += ox; hy += oy;
      const open = sstep(0.2, 0.45, (th[n] + th[m]) * 0.5);
      if (open <= 0) continue;
      const x0 = max(0, floor(hx - 2)), x1 = min(W - 1, ceil(hx + 2)), y0 = max(0, floor(hy - 2)), y1 = min(H - 1, ceil(hy + 2));
      const o = n * 12 + 6, o2 = m * 12 + 6;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dd = sqrt((x + 0.5 - hx) * (x + 0.5 - hx) + (y + 0.5 - hy) * (y + 0.5 - hy));
          const cov = cl(1.15 - dd, 0, 1) * 0.7 * open;
          if (cov <= 0) continue;
          const p = (y * W + x) * 3;
          buf[p] += ((col[o] + col[o2]) * 0.5 - buf[p]) * cov;
          buf[p + 1] += ((col[o + 1] + col[o2 + 1]) * 0.5 - buf[p + 1]) * cov;
          buf[p + 2] += ((col[o + 2] + col[o2 + 2]) * 0.5 - buf[p + 2]) * cov;
        }
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      display.setPixel(x, y, cl(buf[p], 0, 255) | 0, cl(buf[p + 1], 0, 255) | 0, cl(buf[p + 2], 0, 255) | 0);
    }
  }
}
