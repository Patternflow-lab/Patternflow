// ===== Patternflow pattern =====
// Title:   Fiber Tracts
// Family:  tractography
// Idea:    Threads grow from seeds along the principal direction of an invented diffusion-tensor field, coloured by the way they run, so combed bundles sweep across a dark ground, cross, and fade while they drift.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: diffusion tensor MRI tractography, from memory: tensor principal direction and fractional anisotropy (Basser, Mattiello and Le Bihan 1994), streamlines that stop where FA falls or the path turns too far (FACT, Mori et al. 1999; Basser et al. 2000), the colour code red left-right, green front-back, blue up-down (Pajevic and Pierpaoli 1999); the field is invented, no brain; pattern round 240
// Round:   240
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Cutoff=0..4, Bundles=-3..1, Turn=-1..1
//
// Knob 1: Hue. Turns the direction colour wheel. At 0 it is the standard code: left to right red, up and down blue, into the screen green, and mixes between.
// Knob 2: Cutoff. 0 to 4, opening at 2: the anisotropy at which a thread stops, 0.10 to 0.65. Low, and threads wander into weak tissue as thin spaghetti and the gaps inside a bundle fill; high, and only the cores of the bundles are traced.
// Knob 3: Bundles. -3 to 1, opening at 0: 5 bundles at 0, 2 at -3, 6 at 1, one fading in as the knob passes its number. An arc over the top and a near-vertical tract come first, then a diagonal, a front-to-back loop, a yellow sweep and a red one, each adding crossings.
// Knob 4: Turn. -1 to 1, opening near 0: the angle a thread may turn in one step before it stops, 15 degrees at -1, about 35 at 0, 75 at 1. Low, and threads stop dead at every crossing, short strands; high, and they swerve across into the neighbouring bundle and run on.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, round, min, max, abs, exp, sqrt, sin, cos, acos, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = (a, b) => a + (b - a) * Math.random();
const cidx = (ex, ey) => (min(31, floor(abs(ex) * 31.99)) << 5) | min(31, floor(abs(ey) * 31.99));
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

// Box: x in [-1, 1] the 64 columns, y in [-2, 2] the 128 rows (up is +y), z about +-0.6 depth, 32 LED to a unit, yawed
// 0.3 rad so a fibre into the screen is a short slanted stroke.
const U = 32, CYAW = cos(0.3), SYAW = sin(0.3);
const ZS = 0.5;                    // depth counts half in a distance
const EPS = 0.15;                  // isotropic floor of the tensor
const NOISE_A = 0.045;             // smooth noise in each tensor entry
const COMB = 0.9;                  // depth of the valleys between strands
const LANE = 4.2;                  // LED between strands
const SEGS = 6;                    // samples per control-point span

// Six bundles: a curve through control points (box units), strength, width in LED, fade period in s. The first two never
// drop below 0.4, so the panel is never empty.
const DESIGN = [
  { p: [[-0.95, 0.15, 0], [-0.5, 0.95, 0.1], [0.1, 1.25, 0.05], [0.7, 0.95, -0.05], [0.95, 0.4, -0.1]], str: 1.0, wid: 9, T: 190, floor: 0.4 },
  { p: [[0.45, -1.95, 0.05], [0.25, -0.9, 0], [0.1, 0.2, -0.05], [-0.1, 1.2, 0], [-0.25, 1.95, 0.05]], str: 1.2, wid: 7, T: 140, floor: 0.4 },
  { p: [[-0.95, -1.3, -0.3], [-0.3, -0.85, -0.2], [0.3, -0.15, 0.1], [0.95, 0.5, 0.3]], str: 0.95, wid: 8, T: 230, floor: 0 },
  { p: [[-0.55, -0.6, -0.55], [-0.5, 0, -0.3], [-0.55, 0.5, 0.1], [-0.6, 0.1, 0.45], [-0.6, -0.5, 0.55]], str: 1.0, wid: 8, T: 120, floor: 0 },
  { p: [[-0.9, -0.3, -0.5], [-0.3, 0.25, -0.2], [0.3, -0.05, 0.2], [0.9, 0.5, 0.5]], str: 0.9, wid: 7, T: 165, floor: 0 },
  { p: [[-0.95, -0.5, 0.1], [-0.4, -0.85, 0], [0.2, -0.6, 0.05], [0.95, -1.15, 0.1]], str: 1.1, wid: 9, T: 270, floor: 0 },
];

// ---- tracking and drawing numbers ----
const DENSITY = 3.5;               // threads' worth of length aimed at per LED of strand
const MEANMASS = 30;               // mean bright length of a thread over its life, LED
const LIFE = 26;                   // about how long a thread lives, s
const SIG = 0.8;                   // sigma of a thread across, LED
const PEAK = 0.35;                 // what one thread adds at its middle
const MAXLEN = 150;                // longest run each way from a seed, LED
const KILL = 3;                    // s an out-of-date thread takes to go
const PRE = 50;                    // s of tracking run before the first frame
const PAD = 5, PW = W + 2 * PAD, PH = H + 2 * PAD;

// ---- colour ----
function hsv(h, s, v, out, o) {
  for (let c = 0; c < 3; c++) {
    const k = (5 - 2 * c + (h - floor(h)) * 6) % 6;
    out[o + c] = v - v * s * max(0, min(k, 4 - k, 1));
  }
}
// A thread's direction is kept as 5 bits each of |tx| and |ty|. This table gives its colour for the current hue:
// red |tx|, green |tz|, blue |ty|, pushed to full saturation, red and blue scaled up against green.
function buildLut(lut, hue) {
  const c = [0, 0, 0];
  for (let q = 0; q < 1024; q++) {
    const ax = (q >> 5) / 31, ay = (q & 31) / 31, az = sqrt(max(0, 1 - ax * ax - ay * ay));
    const r = ax, g = az, b = ay, mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
    let h = 0;
    if (d > 1e-6) h = (mx === r ? (g - b) / d : mx === g ? 2 + (b - r) / d : 4 + (r - g) / d) / 6;
    const s = pow(d / mx, 0.55);
    // Orange is pulled to yellow and paled, blue leaned to azure: the LEDs show dim orange brown and blue dark.
    if (h > 0 && h < 0.17) h = 0.17 * pow(h / 0.17, 0.6);
    const ho = h + hue - floor(h + hue);
    hsv(ho, s, 1, c, 0);
    const bl = sstep(0.55, 0.62, ho) * (1 - sstep(0.7, 0.8, ho)), og = (1 - sstep(0.1, 0.2, ho)) * sstep(0.02, 0.06, ho);
    c[1] += 0.32 * bl * (1 - c[1]);
    c[0] += 0.12 * og * (1 - c[0]); c[2] += 0.2 * og * (1 - c[2]);
    const lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    const gain = cl(pow(0.5 / lum, 0.5), 0.7, 1.7);
    lut[q * 3] = c[0] * gain;
    lut[q * 3 + 1] = c[1] * gain;
    lut[q * 3 + 2] = c[2] * gain;
  }
}

// ---- the bundles ----
function makeBundle(d, flip, idx) {
  const M = d.p.length, ns = (M - 1) * SEGS + 1;
  const o = {
    M, ns, w: 0, kk: 0, env: 1, str: d.str, floor: d.floor, ph: Math.random() * 2 * PI,
    sig: (d.wid * 0.3 * (0.9 + 0.2 * Math.random())) / U, nl: d.wid >= 8 ? 3 : 2, ph2: d.wid >= 8 ? 0 : PI, lscr: 100, sph: Math.random() * 6.28,
    P0: d.p.map((q) => [q[0] * flip, q[1], q[2] * flip]), cx: 0, cy: 0,
    ra: rnd(0.3, 0.55), rw: (2 * PI) / rnd(120, 260), rp: Math.random() * 6.28, tw: (2 * PI) / rnd(90, 210), tp: Math.random() * 6.28, tq: Math.random() * 6.28,
    dr: [],
    C: new Float32Array(M * 3),
    P: new Float32Array(ns * 3), T: new Float32Array(ns * 3), il: new Float32Array(ns), R: new Float32Array(ns * 3), I: new Float32Array(ns),
  };
  for (const q of o.P0) (o.cx += q[0] / M), (o.cy += q[1] / M);
  o.we = (2 * PI) / (d.T * rnd(0.85, 1.15));
  // The five bundles the knob opens on start in their present stretch.
  if (idx < 5) o.ph = rnd(1.45, 3.3);
  // The control points wander on slow sines of unrelated rates.
  for (let k = 0; k < M; k++) {
    o.dr.push([rnd(0.1, 0.22), rnd(0.1, 0.22), rnd(0.05, 0.14), rnd(0.035, 0.11), rnd(0.035, 0.11), rnd(0.04, 0.1), rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)]);
  }
  return o;
}

function updateCurve(B, t) {
  const M = B.M, C = B.C;
  for (let k = 0; k < M; k++) {
    const q = B.P0[k], d = B.dr[k];
    for (let c = 0; c < 3; c++) C[k * 3 + c] = q[c] + d[c] * sin(d[3 + c] * t + d[6 + c]);
  }
  // It also turns about its middle and slides, so no layout lasts.
  const th = B.ra * sin(B.rw * t + B.rp), co = cos(th), si = sin(th), tx = 0.2 * sin(B.tw * t + B.tp), ty = 0.28 * sin(B.tw * 0.77 * t + B.tq);
  for (let k = 0; k < M; k++) {
    const x = C[k * 3] - B.cx, y = C[k * 3 + 1] - B.cy;
    C[k * 3] = B.cx + x * co - y * si + tx;
    C[k * 3 + 1] = B.cy + x * si + y * co + ty;
  }
  const R = B.R, ns = B.ns;
  for (let k = 0; k < M - 1; k++) {
    const k0 = max(0, k - 1), k1 = k, k2 = k + 1, k3 = min(M - 1, k + 2);
    for (let s = 0; s < SEGS + (k === M - 2 ? 1 : 0); s++) {
      const u = s / SEGS, u2 = u * u, u3 = u2 * u, o = (k * SEGS + s) * 3;
      for (let c = 0; c < 3; c++) {
        const p0 = C[k0 * 3 + c], p1 = C[k1 * 3 + c], p2 = C[k2 * 3 + c], p3 = C[k3 * 3 + c];
        R[o + c] = 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (3 * p1 - p0 - 3 * p2 + p3) * u3);
      }
    }
  }
  const P = B.P, T = B.T;
  for (let j = 0; j < ns; j++) {
    const a = max(0, j - 1) * 3, b = min(ns - 1, j + 1) * 3;
    let tx = R[b] - R[a], ty = R[b + 1] - R[a + 1], tz = R[b + 2] - R[a + 2];
    const il = 1 / sqrt(tx * tx + ty * ty + tz * tz + 1e-12);
    T[j * 3] = tx * il; T[j * 3 + 1] = ty * il; T[j * 3 + 2] = tz * il;
    P[j * 3] = R[j * 3]; P[j * 3 + 1] = R[j * 3 + 1]; P[j * 3 + 2] = R[j * 3 + 2] * ZS;
  }
  for (let j = 0; j < ns - 1; j++) {
    const ex = P[j * 3 + 3] - P[j * 3], ey = P[j * 3 + 4] - P[j * 3 + 1], ez = P[j * 3 + 5] - P[j * 3 + 2];
    B.il[j] = 1 / (ex * ex + ey * ey + ez * ez + 1e-12);
  }
  // Swells and pinches, so outer strands come and go.
  let ls = 0;
  for (let j = 0; j < ns; j++) {
    const sg = B.sig * (1 + 0.3 * sin(6.28 * 1.3 * (j / (ns - 1)) + B.sph + 0.04 * t));
    B.I[j] = 1 / (2 * sg * sg);
    if (j) {
      const ax = (R[j * 3] - R[j * 3 - 3]) * CYAW + (R[j * 3 + 2] - R[j * 3 - 1]) * SYAW, ay = R[j * 3 + 1] - R[j * 3 - 2];
      ls += sqrt(ax * ax + ay * ay) * U;
    }
  }
  B.lscr = ls;
}

// ---- the tensor field ----
// D = sum of w_i t_i t_i^T, a floor and smooth noise. FOUT gets the principal direction and FA.
const FOUT = new Float64Array(4);
function field(st, x, y, z) {
  let a = EPS, b = EPS, c = EPS, d = 0, e = 0, f = 0;
  const zs = z * ZS, bs = st.bund;
  for (let i = 0; i < bs.length; i++) {
    const B = bs[i];
    if (B.w < 0.004) continue;
    const ns1 = B.ns - 1, P = B.P, il = B.il;
    let best = 1e9, bj = 0, bu = 0, bx = 0, by = 0;
    for (let j = 0; j < ns1; j++) {
      const o = j * 3;
      const ex = P[o + 3] - P[o], ey = P[o + 4] - P[o + 1], ez = P[o + 5] - P[o + 2];
      const px = x - P[o], py = y - P[o + 1], pz = zs - P[o + 2];
      let u = (px * ex + py * ey + pz * ez) * il[j];
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const qx = px - u * ex, qy = py - u * ey, qz = pz - u * ez, d2 = qx * qx + qy * qy + qz * qz;
      if (d2 < best) (best = d2), (bj = j), (bu = u), (bx = qx), (by = qy);
    }
    const q = best * (B.I[bj] + (B.I[bj + 1] - B.I[bj]) * bu);
    if (q > 9) continue;
    const s = (bj + bu) / ns1;
    const T = B.T, o = bj * 3;
    let tx = T[o] + (T[o + 3] - T[o]) * bu, ty = T[o + 1] + (T[o + 4] - T[o + 1]) * bu, tz = T[o + 2] + (T[o + 5] - T[o + 2]) * bu;
    // The weight is ridged across the bundle into strands; a thread that strays into a valley finds FA low and stops.
    const nl = sqrt(tx * tx + ty * ty);
    const lat = nl < 0.3 ? bx : (-ty * bx + tx * by) / nl;
    const g = B.w * exp(-q) * sstep(0, 0.1, s) * sstep(1, 0.9, s) * (1 - 0.5 * COMB + 0.5 * COMB * cos((6.2832 * U * lat) / LANE - B.ph2));
    const n = g / (tx * tx + ty * ty + tz * tz + 1e-12);
    a += n * tx * tx; b += n * ty * ty; c += n * tz * tz; d += n * tx * ty; e += n * tx * tz; f += n * ty * tz;
  }
  const nz = st.nz, t = st.t;
  for (let k = 0; k < 6; k++) {
    const n1 = nz[k * 2], n2 = nz[k * 2 + 1];
    const v = NOISE_A * 0.5 * (sin(n1[0] * x + n1[1] * y + n1[2] * z + n1[3] * t + n1[4]) + sin(n2[0] * x + n2[1] * y + n2[2] * z + n2[3] * t + n2[4]));
    if (k === 0) a += v; else if (k === 1) b += v; else if (k === 2) c += v; else if (k === 3) d += v; else if (k === 4) e += v; else f += v;
  }
  // Eigenvalue in closed form; the eigenvector is a cross product of two rows of D - l1 I.
  const q3 = (a + b + c) / 3, A = a - q3, Bq = b - q3, Cq = c - q3;
  const p2 = A * A + Bq * Bq + Cq * Cq + 2 * (d * d + e * e + f * f);
  const fro = a * a + b * b + c * c + 2 * (d * d + e * e + f * f);
  FOUT[3] = min(1, sqrt(max(0, (1.5 * (fro - 3 * q3 * q3)) / (fro + 1e-12))));
  const p = sqrt(p2 / 6);
  if (p < 1e-7) return void ((FOUT[0] = 1), (FOUT[1] = 0), (FOUT[2] = 0));
  const ip = 1 / p, b11 = A * ip, b22 = Bq * ip, b33 = Cq * ip, b12 = d * ip, b13 = e * ip, b23 = f * ip;
  const det = b11 * (b22 * b33 - b23 * b23) - b12 * (b12 * b33 - b23 * b13) + b13 * (b12 * b23 - b22 * b13);
  const l1 = q3 + 2 * p * cos(acos(cl(det / 2, -1, 1)) / 3);
  const M = [[a - l1, d, e], [d, b - l1, f], [e, f, c - l1]];
  let bn = 0;
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
    const u = M[i], v = M[j], x = u[1] * v[2] - u[2] * v[1], y = u[2] * v[0] - u[0] * v[2], z = u[0] * v[1] - u[1] * v[0], n = x * x + y * y + z * z;
    if (n > bn) (bn = n), (FOUT[0] = x), (FOUT[1] = y), (FOUT[2] = z);
  }
  if (bn < 1e-14) return void ((FOUT[0] = 1), (FOUT[1] = 0), (FOUT[2] = 0));
  const iu = 1 / sqrt(bn);
  FOUT[0] *= iu; FOUT[1] *= iu; FOUT[2] *= iu;
}

// ---- tracking ----
// One direction from a seed, stepping along the principal direction at each midpoint, sign-matched to the last step.
// Ends where FA is under the cutoff (1), the turn passes the limit (2), or it leaves the box (3).
function trace(st, x, y, z, dx, dy, dz, stepU, stride, lenCap, out) {
  const cut = st.cut, cosLim = cos(st.turn), maxSteps = ceil(lenCap / (stepU * U));
  let since = 0, ended = 3;
  for (let n = 0; n < maxSteps; n++) {
    const h = 0.5 * stepU;
    field(st, x + dx * h, y + dy * h, z + dz * h);
    let ex = FOUT[0], ey = FOUT[1], ez = FOUT[2];
    const fa = FOUT[3];
    let dot = ex * dx + ey * dy + ez * dz;
    if (dot < 0) (ex = -ex), (ey = -ey), (ez = -ez), (dot = -dot);
    if (fa < cut) { ended = 1; break; }
    if (dot < cosLim) { ended = 2; break; }
    x += ex * stepU; y += ey * stepU; z += ez * stepU;
    dx = ex; dy = ey; dz = ez;
    if (x < -1.1 || x > 1.1 || y < -2.08 || y > 2.08 || z < -0.6 || z > 0.6) { ended = 3; break; }
    if (++since >= stride) {
      since = 0;
      out.X.push((x * CYAW + z * SYAW) * U + 32);
      out.Y.push(64 - y * U);
      out.C.push(cidx(ex, ey));
      out.A.push(0.3 + 0.7 * sstep(cut, cut + 0.35, fa));
    }
  }
  return ended;
}

// A seed sits on one of two or three lanes across a bundle, LANE apart, so strands lie side by side. A few go anywhere.
function candidate(st, out) {
  const bs = st.bund;
  if (st.wsum < 0.02 || Math.random() < 0.08) {
    out.x = rnd(-1, 1); out.y = rnd(-2, 2); out.z = rnd(-0.5, 0.5); out.home = -1;
    return;
  }
  let r = Math.random() * st.wsum, i = 0;
  for (; i < bs.length - 1; i++) {
    r -= bs[i].sw;
    if (r < 0) break;
  }
  const B = bs[i], s = Math.random() * (B.ns - 1), j = min(floor(s), B.ns - 2), u = s - j, o = j * 3;
  const T = B.T;
  const tx = T[o] + (T[o + 3] - T[o]) * u, ty = T[o + 1] + (T[o + 4] - T[o + 1]) * u;
  let nx = -ty, ny = tx;
  const nl = sqrt(nx * nx + ny * ny);
  if (nl < 0.3) (nx = 1), (ny = 0);
  else (nx /= nl), (ny /= nl);
  const lane = B.nl === 3 ? floor(Math.random() * 3) - 1 : Math.random() < 0.5 ? -0.5 : 0.5;
  const off = ((lane + gauss() * 0.06) * LANE) / U;
  out.x = B.R[o] + (B.R[o + 3] - B.R[o]) * u + nx * off;
  out.y = B.R[o + 1] + (B.R[o + 4] - B.R[o + 1]) * u + ny * off;
  out.z = B.R[o + 2] + (B.R[o + 5] - B.R[o + 2]) * u + gauss() * 0.03;
  out.home = i;
}

function spawn(st) {
  const cd = st.cd;
  for (let attempt = 0; attempt < 14; attempt++) {
    candidate(st, cd);
    if (cd.z < -0.55 || cd.z > 0.55 || abs(cd.x) > 1.05 || abs(cd.y) > 2.02) continue;
    field(st, cd.x, cd.y, cd.z);
    const fa = FOUT[3];
    if (fa < st.cut || Math.random() > fa) continue;
    // Seeds keep off places already lit.
    const sx = (cd.x * CYAW + cd.z * SYAW) * U + 32, sy = 64 - cd.y * U;
    const px = cl(floor(sx), 0, W - 1), py = cl(floor(sy), 0, H - 1);
    if (Math.random() < 0.97 * sstep(0.25, 0.6, st.occ[py * W + px])) continue;
    const ex = FOUT[0], ey = FOUT[1], ez = FOUT[2];
    const stepLED = rnd(0.6, 1), stepU = stepLED / U, stride = max(1, round(1.9 / stepLED)), sp = stepLED * stride;
    const bw = { X: [], Y: [], C: [], A: [] }, fw = { X: [], Y: [], C: [], A: [] };
    const e1 = trace(st, cd.x, cd.y, cd.z, -ex, -ey, -ez, stepU, stride, rnd(35, MAXLEN), bw);
    const e2 = trace(st, cd.x, cd.y, cd.z, ex, ey, ez, stepU, stride, rnd(35, MAXLEN), fw);
    const nb = bw.X.length, nf = fw.X.length, n = nb + nf + 1;
    if (n < 6) continue;
    const sd = { X: sx, Y: sy, C: cidx(ex, ey), A: 0.3 + 0.7 * sstep(st.cut, st.cut + 0.35, fa) };
    const mk = (k, Type) => Type.from([...bw[k].reverse(), sd[k], ...fw[k]]);
    const X = mk("X", Float32Array), Y = mk("Y", Float32Array), C = mk("C", Uint16Array), A = mk("A", Float32Array);
    // Where it petered out or turned too far, the last LED thin away.
    const rampEnd = (end, dir) => {
      if (end === 3) return;
      for (let j = 0; j < 6; j++) {
        const i = dir > 0 ? n - 1 - j : j;
        if (i >= 0 && i < n) A[i] *= 0.25 + 0.75 * min(1, (j * sp) / 9);
      }
    };
    rampEnd(e1, -1);
    rampEnd(e2, 1);
    const speed = rnd(14, 22);
    st.threads.push({
      n, k: nb, sp, X, Y, C, A, t0: st.t, speed, tg: (max(nb, nf) * sp) / speed, hold: rnd(2, 7), fade: rnd(14, 22),
      amp: rnd(0.6, 1.4), kill: -1, cut: st.cut, trn: st.turn, home: cd.home, kk: cd.home >= 0 ? st.bund[cd.home].kk : 1,
    });
    return true;
  }
  return false;
}

// ---- state ----
export function setup(params) {
  const flip = Math.random() < 0.5 ? -1 : 1;
  const nz = [];
  for (let k = 0; k < 12; k++) {
    const wl = rnd(14, 30) / U, th = Math.random() * 6.28, ph = Math.acos(rnd(-1, 1));
    const kk = 6.283 / wl;
    nz.push([kk * sin(ph) * cos(th), kk * sin(ph) * sin(th), kk * cos(ph), rnd(0.05, 0.18) * (Math.random() < 0.5 ? -1 : 1), Math.random() * 6.28]);
  }
  const st = (params.st = {
    k: [0, 2, 0, 0.06], t: -PRE, init: false, acc: new Float32Array(PW * PH * 3), occ: new Float32Array(NPX), out: new Float32Array(NPX * 3),
    lut: new Float32Array(1024 * 3), hue: -9, nz, bund: DESIGN.map((d, i) => makeBundle(d, flip, i)), wsum: 0,
    threads: [], cut: 0.4, turn: 0.6, cnt: 5, tcut: 0.4, tturn: 0.6, tcnt: 5, cd: { x: 0, y: 0, z: 0, home: -1 }, rate: 0,
  });
  buildBundles(st);
}

function knobs(st, kv) {
  st.k = [kv[0], cl(kv[1], 0, 4), cl(kv[2], -3, 1), cl(kv[3], -1, 1)];
  st.tcut = 0.1 + 0.55 * (st.k[1] / 4);
  st.tcnt = 5 + st.k[2];
  st.tturn = (15 * pow(5, (st.k[3] + 1) / 2) * PI) / 180;
}

function buildBundles(st) {
  let ws = 0, wn = 0;
  for (let i = 0; i < st.bund.length; i++) {
    const B = st.bund[i];
    B.kk = cl(st.cnt - i, 0, 1);
    B.env = B.floor + (1 - B.floor) * sstep(-0.95, -0.3, sin(B.we * st.t + B.ph));
    B.w = B.kk * B.env * B.str;
    updateCurve(B, st.t);
    B.sw = B.kk * B.env * B.nl * B.lscr;
    ws += B.sw;
    wn += B.kk * (B.floor + (1 - B.floor) * 0.75) * B.nl * B.lscr;
  }
  st.wsum = ws;
  st.wnom = wn;
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st;
  knobs(st, (input && input.knobValues) || [0, 2, 0, 0.06]);
  if (!st.init) {
    st.init = true;
    st.cut = st.tcut; st.cnt = st.tcnt; st.turn = st.tturn;
    // Run PRE s first so the panel opens finished; the first threads get a spread of ages.
    buildBundles(st);
    for (let c = 0; c < 12; c++) {
      compose(st, false);
      for (let i = 0; i < 8; i++) if (spawn(st)) st.threads[st.threads.length - 1].t0 -= rnd(0, 22);
    }
    let n = 0;
    while (st.t < 0) {
      step(st, 0.25);
      if (++n % 4 === 0) compose(st, false);
    }
    compose(st, false);
  }
  step(st, cl(dt || 0, 0, 0.1));
}

function step(st, d) {
  if (d <= 0) return;
  st.t += d;
  const t = st.t, f = 1 - exp(-d / 0.5);
  st.cut += (st.tcut - st.cut) * f;
  st.cnt += (st.tcnt - st.cnt) * f;
  st.turn += (st.tturn - st.turn) * f;
  buildBundles(st);
  // Retire faded threads, send out-of-date ones away fast, add up the bright length.
  const th = st.threads;
  let mass = 0;
  for (let i = th.length - 1; i >= 0; i--) {
    const T = th[i];
    if (T.kill < 0 && (abs(T.cut - st.cut) > 0.06 || abs(T.trn - st.turn) > 0.2 || (T.home >= 0 && st.bund[T.home].kk < T.kk - 0.45))) T.kill = t;
    const age = t - T.t0, u = (age - T.tg - T.hold) / T.fade;
    if (u >= 1 || (T.kill >= 0 && t - T.kill > KILL)) {
      th[i] = th[th.length - 1];
      th.pop();
    } else if (T.kill < 0) {
      mass += min(T.n, 2 * ((age * T.speed) / T.sp) + 1) * T.sp * (u > 0 ? (1 - u) * (1 - u) : 1);
    }
  }
  // Seeding aims at a density of thread over the strand length on offer (wsum), pushed up when the panel is short and
  // down when it has too much; few bundles present get the same thread, within limits.
  const want = DENSITY * cl(st.wnom, 0.8 * st.wsum, 1.7 * st.wsum), base = want / (MEANMASS * LIFE);
  st.rate += cl(base * (1 + 1.6 * ((want - mass) / (want + 1))), 0.2 * base, 2.5 * base) * d;
  let n = floor(st.rate);
  st.rate -= n;
  while (n-- > 0 && th.length < 460) spawn(st);
}

// ---- drawing ----
const GX = new Float32Array(5), GY = new Float32Array(5);
const GLUT = new Float32Array(641);
for (let i = 0; i <= 640; i++) GLUT[i] = exp(-((i / 128) * (i / 128)) / (2 * SIG * SIG));

function splat(acc, cx, cy, r, g, b, q) {
  if (cx < -2.6 || cx > 66.6 || cy < -2.6 || cy > 130.6) return;
  const ix = floor(cx), iy = floor(cy), fx = cx - ix - 0.5, fy = cy - iy - 0.5;
  for (let i = 0; i < 5; i++) {
    GX[i] = GLUT[(abs(i - 2 - fx) * 128 + 0.5) | 0];
    GY[i] = GLUT[(abs(i - 2 - fy) * 128 + 0.5) | 0] * q;
  }
  for (let j = 0; j < 5; j++) {
    const wy = GY[j];
    let o = ((iy + j - 2 + PAD) * PW + ix - 2 + PAD) * 3;
    for (let i = 0; i < 5; i++, o += 3) {
      const w = GX[i] * wy;
      acc[o] += w * r; acc[o + 1] += w * g; acc[o + 2] += w * b;
    }
  }
}

function tip(acc, lut, T, i, i2, fr, stop, dir, base) {
  const X = T.X, Y = T.Y, C = T.C, A = T.A, c = C[i] * 3;
  splat(acc, X[i] + (X[i2] - X[i]) * fr, Y[i] + (Y[i2] - Y[i]) * fr, lut[c], lut[c + 1], lut[c + 2], base * A[i] * 2.1);
  for (let j = 0; j < 2 && (dir < 0 ? i - j >= stop : i + j <= stop); j++) {
    const k = i + dir * j, c2 = C[k] * 3;
    splat(acc, X[k], Y[k], lut[c2], lut[c2 + 1], lut[c2 + 2], base * A[k] * (j === 0 ? 0.9 : 0.4));
  }
}

// Threads go down as Gaussian splats 1.6 to 2 LED apart, summed and tone mapped on the largest channel so heaps of
// strands glow without the hue washing to white. occ (how lit) is read by the seeding.
function compose(st, full = true) {
  const acc = st.acc, lut = st.lut, t = st.t;
  if (abs(st.k[0] - st.hue) > 1e-4) (st.hue = st.k[0]), buildLut(lut, st.k[0]);
  acc.fill(0);
  const norm = PEAK / (SIG * 2.5066);
  for (const T of st.threads) {
    const age = t - T.t0;
    let f = sstep(0, 0.6, age);
    const u = (age - T.tg - T.hold) / T.fade;
    if (u > 0) f = (1 - u) * (1 - u);
    if (T.kill >= 0) {
      const v = 1 - (t - T.kill) / KILL;
      f *= v * v;
    }
    if (f < 0.01) continue;
    const gi = (age * T.speed) / T.sp, X = T.X, Y = T.Y, C = T.C, A = T.A, n = T.n;
    const lo = T.k - gi, hi = T.k + gi;
    const ilo = max(0, ceil(lo)), ihi = min(n - 1, floor(hi));
    const base = norm * T.amp * f * T.sp;
    for (let i = ilo; i <= ihi; i++) {
      const c = C[i] * 3;
      splat(acc, X[i], Y[i], lut[c], lut[c + 1], lut[c + 2], base * A[i]);
    }
    // A growing tip is brighter, its part-grown last step placed between two points.
    if (hi < n - 1 && ihi >= 0 && ihi < n - 1) tip(acc, lut, T, ihi, ihi + 1, hi - ihi, ilo, -1, base);
    if (lo > 0 && ilo > 0 && ilo < n) tip(acc, lut, T, ilo, ilo - 1, ilo - lo, ihi, 1, base);
  }
  const out = st.out, occ = st.occ;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * W + x, a = ((y + PAD) * PW + x + PAD) * 3;
      const r = acc[a], g = acc[a + 1], b = acc[a + 2], m = max(r, g, b);
      if (m < 0.003) {
        occ[o] = 0;
        if (full) (out[o * 3] = 0), (out[o * 3 + 1] = 0), (out[o * 3 + 2] = 0);
        continue;
      }
      const tm = m / (m + 0.6);
      occ[o] = tm;
      if (!full) continue;
      // The LEDs barely light under a tenth and dim colour goes muddy, so the lowest values go.
      const s = (tm / m) * sstep(0.015, 0.09, tm);
      out[o * 3] = r * s; out[o * 3 + 1] = g * s; out[o * 3 + 2] = b * s;
    }
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  compose(st, true);
  const out = st.out;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, round(255 * cl(out[o], 0, 1)), round(255 * cl(out[o + 1], 0, 1)), round(255 * cl(out[o + 2], 0, 1)));
    }
  }
}
