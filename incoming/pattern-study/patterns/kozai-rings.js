// ===== Patternflow pattern =====
// Title:   Kozai Rings
// Family:  secular
// Idea:    Twenty-four orbits of one size and different tilt open as a globe of wire ellipses seen in perspective round a central glow, and the pull of a distant ring makes each swing from a round loop to a needle and back, violet when round and gold when thin, so the globe tangles, thins and opens again without ever coming round.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kozai-Lidov cycle (Yoshihide Kozai for asteroids and Mikhail Lidov for satellites, both 1962), its vector form (Scott Tremaine, Jihad Touma and Fathi Namouni, 2009; Boaz Katz, Subo Dong and Renu Malhotra, 2011), all recalled, pattern round 271
// Round:   271
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.5..4, Tilt=10..70, View=0..1
//
// Knob 1: Hue. Adds the knob to the hue of the whole ramp from round to thin, one turn over the range. At 0 a round orbit is blue violet, one at e = 0.5 magenta, at 0.7 coral, from 0.85 up gold that goes pale yellow toward 1. At 0.15 the round ones are pink and the needles lime, at 0.35 orange and green, at 0.55 green and blue, at 0.85 blue and pink. The ramp is lifted where a hue is dark so every colour has about the same light.
// Knob 2: Pace. Kozai time per second, 0.11 units for each unit of the knob: 0.055 at 0.5, 0.22 at the opening 2 and 0.44 at 4. At 2 the orbits whose tilt is nearest to a right angle take about 15 to 20 s to go from round to a needle and back, the ones on the edge of the window up to 47 s at Tilt 10, and an ellipse that is already eccentric turns in its plane every 7 to 8 s. The bodies on the ellipses go once round in 3.2 s at 2, 6.4 s at 0.5 and 2.3 s at 4.
// Knob 3: Tilt. The angle from the bundle's axis (up the panel when seen from the side) to the axis of the distant ring, 10 degrees at the opening, 40 at the middle and 70 at the top. It moves which orbits sit inside the window of 39.2 to 140.8 degrees from the ring's axis: in a 10 minute run 11 of the 24 reach e = 0.8 at Tilt 10, 16 at 40 and 21 at 70, and the share of orbit time spent thinner than that goes from 8 to 12 to 20 percent. The faint ring that stands for the distant body tilts at once, the orbits answer over the next 10 to 20 s.
// Knob 4: View. The camera's elevation above the plane across the bundle's axis: 4 degrees at 0, 44 at 0.5 and 84 at 1, with a nod of 16 and 7 degrees on periods of 24 and 35 s riding on it. Low, the globe is seen from the side and its rings stand as tall loops that cross at the poles; high, it is seen down its axis and the loops lie inside one another.
//
// What the picture is. A small body orbits a central mass while a distant body, on a circular orbit about that pair, pulls on it. Averaged over both orbits the pull keeps the size of each ellipse, its energy and the part of its orbit's normal along the distant orbit's axis, so what it changes is the shape: eccentricity and tilt trade, and when the tilt from the distant orbit's plane starts between 39.2 and 140.8 degrees the pericentre keeps to one side and a near circle stretches into a thin ellipse as its tilt falls, then rounds out again. Below 39.2 degrees an orbit only turns in its plane. The panel draws 24 such orbits, each a ring of light 2 LED across, all with a semi-major axis of 29 LED and the central mass at one focus, in the middle of the panel as a soft cream glow. A ring is violet when it is round, magenta, coral and gold as it thins, and its light is thickest where the body lingers, at the far end, and faintest at the near one. A bead of the orbit's colour is the body itself, from Kepler's equation. A faint grey ring, tilted by Tilt, is the distant body's orbit. The whole is seen in perspective from 2.8 semi-major axes away, stretched 2.0 times along the panel's height, and the camera goes round the bundle's axis once in about 24 s while it nods.
// The model. For each orbit e is the eccentricity vector, pointing to the pericentre, and j is sqrt(1 - e^2) times the unit normal, both in a frame that stays put. With n the unit axis of the distant orbit, in units of the Kozai time, dj/dt = 3/4 [ (j.n)(j x n) - 5 (e.n)(e x n) ] and de/dt = 3/4 [ (j.n)(e x n) + 2 (j x e) - 5 (e.n)(j x n) ]. A frame takes one to three RK4 steps of at most 0.02, and e is pulled back to right angles with j and to e^2 + j^2 = 1 after every frame. Checked alone with n fixed: an orbit begun at e0 = 0.01 and 70 degrees reaches e = 0.8973 against sqrt(1 - 5/3 cos^2 i0) = 0.8972, j.n holds to 6e-11 and e^2 + j^2 to 1e-15 over 600 s. Only n moves when Tilt does, so the orbits answer at once. n wobbles by 2.2 and 1.6 degrees and turns about the bundle's axis once in 5 minutes, slowly against the cycles so the orbits follow it, and nothing in the picture comes round.
// The start. The 24 orbits begin as the meridians of a globe: their planes share one line of nodes, the hinge, and their normals are spread from 12 to 168 degrees about it. Each has e0 between 0.03 and 0.62 (more near the low end) pointing anywhere in its plane, which sets where in its cycle it starts, so they flip one after another and not together. The bundle takes half a minute to a minute to wind from the globe into a tangle, because the nodes turn at rates that differ with the tilt; the hinge and the camera's start differ every time the pattern opens.
// What is exact and what is not. The two equations, their RK4 and the Kepler beads are the textbook quadrupole secular problem, and the ellipses are drawn with the right eccentricity, orientation and tilt at every moment. The distant body is not integrated: its ring is what its average is, and the bodies' own turns are 3.2 s of panel time where the real ratio to the cycle is in the hundreds. The semi-major axis is the same for all, as the brief says it would be, which makes the globe. The e cap of 0.985 keeps the thinnest ellipse 0.17 of its length wide, as a real orbit would pass through e = 1 and turn over where the tilt starts near 90 degrees; held at the cap it is a bright needle of two lines up to 10 LED apart, never a hairline. Perspective, the stretch, the lift of every line toward the edge of the panel (0.5 at the middle, 1.4 at the edge) and the colour ramp are drawing choices, made so the 64 by 128 panel is full.

const W = 64, H = 128;
const { floor, sqrt, exp, sin, cos, min, max, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const NO = 24;            // orbits
const A = 29;             // semi-major axis of every orbit, in LEDs
const SY = 2.0;           // the picture is stretched along the panel's long side
const NS = 80;            // samples round each ellipse
const SP = 0.8;           // LEDs between splats along a line
const DIST = 2.8 * A;     // camera distance from the central body
const EDGE0 = 0.5, EDGE1 = 0.9; // lines are fainter near the middle of the panel and stronger toward its edges
const ECAP = 0.985;       // the thinnest ellipse the integrator lets through
const KU = 0.11;          // Kozai units a second for each unit of Pace
const H_STEP = 0.02;      // RK4 step in Kozai units
const T_ORB = 3.2;        // seconds for a body to go once round at Pace 2

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---------------------------------------------------------------- the model
// State per orbit: e, the eccentricity vector (to the pericentre, length e),
// and j, sqrt(1 - e^2) times the unit normal of the orbit. n is the axis of the
// distant ring. Averaged over both orbits the quadrupole pull gives
//   dj/dt = 3/4 [ (j.n)(j x n) - 5 (e.n)(e x n) ]
//   de/dt = 3/4 [ (j.n)(e x n) + 2 (j x e) - 5 (e.n)(j x n) ]
// in units where one unit is the Kozai time. j.n and e^2 + j^2 are constants.
const X = new Float64Array(6); // scratch: ex ey ez jx jy jz
const K1 = new Float64Array(6), K2 = new Float64Array(6), K3 = new Float64Array(6), K4 = new Float64Array(6), YY = new Float64Array(6);

function deriv(y, nx, ny, nz, o) {
  const ex = y[0], ey = y[1], ez = y[2], jx = y[3], jy = y[4], jz = y[5];
  const jn = jx * nx + jy * ny + jz * nz, en = ex * nx + ey * ny + ez * nz;
  const jnx = jy * nz - jz * ny, jny = jz * nx - jx * nz, jnz = jx * ny - jy * nx; // j x n
  const enx = ey * nz - ez * ny, eny = ez * nx - ex * nz, enz = ex * ny - ey * nx; // e x n
  const jex = jy * ez - jz * ey, jey = jz * ex - jx * ez, jez = jx * ey - jy * ex; // j x e
  o[0] = 0.75 * (jn * enx + 2 * jex - 5 * en * jnx);
  o[1] = 0.75 * (jn * eny + 2 * jey - 5 * en * jny);
  o[2] = 0.75 * (jn * enz + 2 * jez - 5 * en * jnz);
  o[3] = 0.75 * (jn * jnx - 5 * en * enx);
  o[4] = 0.75 * (jn * jny - 5 * en * eny);
  o[5] = 0.75 * (jn * jnz - 5 * en * enz);
}

function rk4(y, h, nx, ny, nz) {
  deriv(y, nx, ny, nz, K1);
  for (let i = 0; i < 6; i++) YY[i] = y[i] + 0.5 * h * K1[i];
  deriv(YY, nx, ny, nz, K2);
  for (let i = 0; i < 6; i++) YY[i] = y[i] + 0.5 * h * K2[i];
  deriv(YY, nx, ny, nz, K3);
  for (let i = 0; i < 6; i++) YY[i] = y[i] + h * K3[i];
  deriv(YY, nx, ny, nz, K4);
  for (let i = 0; i < 6; i++) y[i] += (h / 6) * (K1[i] + 2 * K2[i] + 2 * K3[i] + K4[i]);
}

// Put e back at right angles to j and e^2 + j^2 back at 1, and keep the
// ellipse from going thinner than ECAP allows. Costs nothing a viewer could see.
function tidy(S, i) {
  const o = i * 6;
  let ex = S.y[o], ey = S.y[o + 1], ez = S.y[o + 2], jx = S.y[o + 3], jy = S.y[o + 4], jz = S.y[o + 5];
  const ee = ex * ex + ey * ey + ez * ez;
  let jj = jx * jx + jy * jy + jz * jz;
  if (!(isFinite(ee + jj)) || ee < 1e-14 || jj < 1e-14) {
    // restart this one on a fresh tilt
    seed(S, i);
    return;
  }
  const ej = ex * jx + ey * jy + ez * jz;
  jx -= (ex * ej) / ee;
  jy -= (ey * ej) / ee;
  jz -= (ez * ej) / ee;
  jj = jx * jx + jy * jy + jz * jz;
  if (jj < 1e-14) {
    seed(S, i);
    return;
  }
  let es = sqrt(ee);
  if (es > ECAP) {
    const s = ECAP / es;
    ex *= s;
    ey *= s;
    ez *= s;
    es = ECAP;
  }
  const jm = sqrt(max(1 - es * es, 1e-6)), sj = jm / sqrt(jj);
  S.y[o] = ex;
  S.y[o + 1] = ey;
  S.y[o + 2] = ez;
  S.y[o + 3] = jx * sj;
  S.y[o + 4] = jy * sj;
  S.y[o + 5] = jz * sj;
}

// A new orbit on the fan: every plane holds the same line of nodes (the hinge,
// at angle S.hinge in the plane across z) and its normal turns about that line
// from 0 to 180 degrees over the bundle, a small eccentricity pointed anywhere
// in the plane. Planes that share a hinge draw as the meridians of a globe.
function seed(S, i) {
  const r = S.r;
  const ia = PI * (0.07 + 0.86 * ((i + 0.5 + 0.35 * (r() - 0.5)) / NO));
  const hx = cos(S.hinge + 0.04 * (r() - 0.5)), hy = sin(S.hinge + 0.04 * (r() - 0.5));
  // j = cos(ia) z + sin(ia) (z-perpendicular, hinge-perpendicular)
  const jx = -sin(ia) * hy, jy = sin(ia) * hx, jz = cos(ia);
  const px = hx, py = hy, pz = 0;
  const qx = jy * pz - jz * py, qy = jz * px - jx * pz, qz = jx * py - jy * px;
  const e0 = min(0.62, 0.03 * exp(3.2 * r())), om = TAU * r(), co = cos(om), so = sin(om);
  const jm = sqrt(1 - e0 * e0), o = i * 6;
  S.y[o] = e0 * (co * px + so * qx);
  S.y[o + 1] = e0 * (co * py + so * qy);
  S.y[o + 2] = e0 * (co * pz + so * qz);
  S.y[o + 3] = jx * jm;
  S.y[o + 4] = jy * jm;
  S.y[o + 5] = jz * jm;
  S.M[i] = TAU * r();
}

function mulberry(seedv) {
  let a = seedv >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function setup(params) {
  const r = mulberry((Math.random() * 4294967296) >>> 0);
  const S = {
    r, y: new Float64Array(NO * 6), M: new Float64Array(NO), gain: new Float32Array(NO),
    hinge: TAU * r(), T: 0, psi: TAU * r(), k: null, ou: 0,
    tilt: 0.3, pnaz: TAU * r(), nx: 0, ny: 0, nz: 1,
  };
  for (let i = 0; i < NO; i++) S.gain[i] = 0.85 + 0.3 * r();
  for (let i = 0; i < NO; i++) seed(S, i);
  params.s = S;
}

function nAxis(S) {
  const th = S.tilt + (2.2 * sin(0.119 * S.T + 0.4) + 1.6 * sin(0.0731 * S.T + 2.1)) * PI / 180;
  const az = S.pnaz + 0.021 * S.T + 0.25 * sin(0.0529 * S.T);
  S.nx = sin(th) * cos(az);
  S.ny = sin(th) * sin(az);
  S.nz = cos(th);
}

// advance the bundle by du Kozai units
function evolve(S, du) {
  nAxis(S);
  const steps = max(1, Math.ceil(du / H_STEP));
  const h = du / steps;
  const nx = S.nx, ny = S.ny, nz = S.nz;
  for (let i = 0; i < NO; i++) {
    const o = i * 6;
    for (let k = 0; k < 6; k++) X[k] = S.y[o + k];
    for (let q = 0; q < steps; q++) rk4(X, h, nx, ny, nz);
    for (let k = 0; k < 6; k++) S.y[o + k] = X[k];
    tidy(S, i);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 10, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) S.k = [kv[0], kv[1], kv[2], kv[3]];
  const al = 1 - exp(-d / 0.18);
  for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  const k = S.k;
  S.tilt = cl(k[2], 0, 89) * PI / 180;
  S.T += d;
  const pace = cl(k[1], 0.5, 4);
  evolve(S, d * KU * pace);
  S.psi += d * (0.26 + 0.06 * sin(0.0711 * S.T + 1.0) + 0.04 * sin(0.0437 * S.T));
  S.ou += d * TAU / 21;
  const bm = d * TAU / T_ORB * sqrt(pace / 2);
  for (let i = 0; i < NO; i++) S.M[i] += bm * (0.96 + 0.08 * ((i * 0.37) % 1));
}

// ------------------------------------------------------------------ drawing
const FR = new Float32Array(W * H), FG = new Float32Array(W * H), FB = new Float32Array(W * H);
const TR = new Float32Array(W * H), TG = new Float32Array(W * H), TB = new Float32Array(W * H);
const GR = new Float32Array(W * H), GG = new Float32Array(W * H), GB = new Float32Array(W * H);
const C = [0, 0, 0];

// the ramp from round to thin, hue unwrapped so it runs from violet through
// magenta, coral and amber to gold and gets paler at the thin end
const RE = [0, 0.2, 0.4, 0.58, 0.72, 0.86, 1];
const RH = [0.7, 0.77, 0.88, 0.97, 1.045, 1.11, 1.14];
const RS = [0.85, 0.85, 0.85, 0.8, 0.78, 0.7, 0.45];
function ramp(u, hue, o) {
  u = cl(u / 0.46, 0, 1);
  let i = 0;
  while (i < RE.length - 2 && u > RE[i + 1]) i++;
  const f = cl((u - RE[i]) / (RE[i + 1] - RE[i]), 0, 1);
  hsv(RH[i] + (RH[i + 1] - RH[i]) * f + hue, RS[i] + (RS[i + 1] - RS[i]) * f, 1, o);
  // blues and violets are dark: lift them so every colour has similar light
  const l = 0.299 * o[0] + 0.587 * o[1] + 0.114 * o[2], g = pow(0.62 / (l + 0.05), 0.85);
  const hot = 1 + 0.7 * u * u;
  o[0] *= g * hot;
  o[1] *= g * hot;
  o[2] *= g * hot;
}

function splat(x, y, r, g, b) {
  x -= 0.5;
  y -= 0.5;
  const x0 = floor(x), y0 = floor(y);
  if (x0 < -1 || x0 >= W || y0 < -1 || y0 >= H) return;
  const fx = x - x0, fy = y - y0;
  const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
  if (x0 >= 0 && y0 >= 0) {
    const p = y0 * W + x0;
    FR[p] += r * w00;
    FG[p] += g * w00;
    FB[p] += b * w00;
  }
  if (x0 + 1 < W && y0 >= 0) {
    const p = y0 * W + x0 + 1;
    FR[p] += r * w10;
    FG[p] += g * w10;
    FB[p] += b * w10;
  }
  if (x0 >= 0 && y0 + 1 < H) {
    const p = (y0 + 1) * W + x0;
    FR[p] += r * w01;
    FG[p] += g * w01;
    FB[p] += b * w01;
  }
  if (x0 + 1 < W && y0 + 1 < H) {
    const p = (y0 + 1) * W + x0 + 1;
    FR[p] += r * w11;
    FG[p] += g * w11;
    FB[p] += b * w11;
  }
}

// a soft round dot about 2 LED across, at (x, y), as a Gaussian of sigma 0.8 over the 4 x 4 LEDs round it
function dot(x, y, r, g, b) {
  const x0 = floor(x - 0.5) - 1, y0 = floor(y - 0.5) - 1;
  for (let j = 0; j < 4; j++) {
    const yy = y0 + j;
    if (yy < 0 || yy >= H) continue;
    const ey = yy + 0.5 - y;
    for (let i = 0; i < 4; i++) {
      const xx = x0 + i;
      if (xx < 0 || xx >= W) continue;
      const ex = xx + 0.5 - x, w = exp(-(ex * ex + ey * ey) / 1.28) * 0.62, p = yy * W + xx;
      FR[p] += r * w;
      FG[p] += g * w;
      FB[p] += b * w;
    }
  }
}

// [1 2 1] / 4 along rows then columns at a stride, in place in a (b is scratch)
function blur(a, b, st, k) {
  const c = 1 - 2 * k;
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const l = x - st >= 0 ? a[row + x - st] : a[row + x], rr = x + st < W ? a[row + x + st] : a[row + x];
      b[row + x] = k * l + c * a[row + x] + k * rr;
    }
  }
  for (let y = 0; y < H; y++) {
    const ya = max(y - st, 0) * W, yb = min(y + st, H - 1) * W, row = y * W;
    for (let x = 0; x < W; x++) a[row + x] = k * b[ya + x] + c * b[row + x] + k * b[yb + x];
  }
}

function kepler(M, e) {
  M = M - TAU * floor(M / TAU);
  let E = e > 0.8 ? PI : M + e * sin(M);
  for (let it = 0; it < 12; it++) {
    const f = E - e * sin(E) - M, fp = max(1 - e * cos(E), 0.015);
    E -= f / fp;
  }
  return E;
}

// the camera, set once a frame
let rx = 0, ry = 0, ux = 0, uy = 0, uz = 0, dx = 0, dy = 0, dz = 0;
const CX = 32, CY = 64;
// screen position of a point whose offsets along the camera's right, up and
// toward-us axes are (xs, ys, zs): perspective from DIST away, stretched along
// the panel's long side. Writes sx, sy, and the depth in P.
const P = [0, 0, 0];
function proj(xs, ys, zs) {
  const f = DIST / max(DIST - zs, DIST / 1.9);
  P[0] = CX + f * xs;
  P[1] = CY - SY * f * ys;
  P[2] = zs / A;
}

// an orbit's frame: unit pericentre direction, unit in-plane direction ahead of
// it, and b/a, from its e and j; the camera components of the first two go in F
const F = new Float64Array(8);
function frame(S, i) {
  const o = i * 6;
  const ex = S.y[o], ey = S.y[o + 1], ez = S.y[o + 2], jx = S.y[o + 3], jy = S.y[o + 4], jz = S.y[o + 5];
  const e = sqrt(ex * ex + ey * ey + ez * ez);
  const pxh = ex / e, pyh = ey / e, pzh = ez / e;
  const jl = sqrt(jx * jx + jy * jy + jz * jz);
  const jhx = jx / jl, jhy = jy / jl, jhz = jz / jl;
  const qx = jhy * pzh - jhz * pyh, qy = jhz * pxh - jhx * pzh, qz = jhx * pyh - jhy * pxh;
  F[0] = pxh * rx + pyh * ry;                  // x of the pericentre axis
  F[1] = pxh * ux + pyh * uy + pzh * uz;       // y
  F[2] = pxh * dx + pyh * dy + pzh * dz;       // z
  F[3] = qx * rx + qy * ry;
  F[4] = qx * ux + qy * uy + qz * uz;
  F[5] = qx * dx + qy * dy + qz * dz;
  F[6] = e;
  F[7] = sqrt(max(1 - e * e, 1e-4));
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const k = S.k, hue = k[0];
  const el = cl((4 + 80 * cl(k[3], 0, 1)) + 16 * sin(0.2613 * S.T + 0.5) + 7 * sin(0.1771 * S.T + 1.7), 0, 88) * PI / 180;
  // camera: azimuth psi about the bundle's axis (z), elevation el above the plane across it
  const cp = cos(S.psi), sp = sin(S.psi), ce = cos(el), se = sin(el);
  rx = -sp;
  ry = cp;
  ux = -se * cp;
  uy = -se * sp;
  uz = ce;
  dx = ce * cp;
  dy = ce * sp;
  dz = se;
  FR.fill(0);
  FG.fill(0);
  FB.fill(0);

  // ---- the outer ring: a circle in the plane across n
  {
    const nx = S.nx, ny = S.ny, nz = S.nz;
    let ax = -ny, ay = nx;
    let al = sqrt(ax * ax + ay * ay);
    if (al < 1e-6) {
      ax = 1;
      ay = 0;
      al = 1;
    }
    ax /= al;
    ay /= al;
    const bx = -nz * ay, by = nz * ax, bz = nx * ay - ny * ax;
    const R = A * 1.22;
    hsv(0.58 + hue, 0.45, 1, C);
    const lr = C[0] * 0.34, lg = C[1] * 0.34, lb = C[2] * 0.34;
    let px = 0, py = 0, pz = 0;
    const NR = 96;
    for (let q = 0; q <= NR; q++) {
      const s = (q / NR) * TAU, cs = cos(s) * R, ss = sin(s) * R;
      const wx = cs * ax + ss * bx, wy = cs * ay + ss * by, wz = ss * bz;
      proj(wx * rx + wy * ry, wx * ux + wy * uy + wz * uz, wx * dx + wy * dy + wz * dz);
      const sx = P[0], sy = P[1], dp = P[2];
      if (q > 0) {
        const L = sqrt((sx - px) * (sx - px) + (sy - py) * (sy - py)), m = max(1, Math.ceil(L / SP));
        const fz = 0.3 + 0.7 * 0.5 * (1 + (dp + pz) * 0.5);
        for (let t = 0; t < m; t++) {
          const f = (t + 0.5) / m, w = (L / m) * fz;
          splat(px + (sx - px) * f, py + (sy - py) * f, lr * w, lg * w, lb * w);
        }
      }
      px = sx;
      py = sy;
      pz = dp;
    }
    // the outer body, at the angle the ring has turned to
    const s = S.ou, cs = cos(s) * R, ss = sin(s) * R;
    const wx = cs * ax + ss * bx, wy = cs * ay + ss * by, wz = ss * bz;
    proj(wx * rx + wy * ry, wx * ux + wy * uy + wz * uz, wx * dx + wy * dy + wz * dz);
    hsv(0.58 + hue, 0.25, 1, C);
    dot(P[0], P[1], C[0] * 1.1, C[1] * 1.1, C[2] * 1.1);
  }

  // ---- the bundle
  for (let i = 0; i < NO; i++) {
    frame(S, i);
    const Xp = F[0], Yp = F[1], Zp = F[2], Xq = F[3], Yq = F[4], Zq = F[5], e = F[6], bb = F[7];
    ramp(1 - bb, hue, C);
    const uu = cl((1 - bb) / 0.46, 0, 1);
    const g0 = 0.9 * S.gain[i] * (0.5 + 0.75 * uu) * (0.68 + 0.32 * bb);
    const cr = C[0] * g0, cg = C[1] * g0, cb = C[2] * g0;
    let px = 0, py = 0, pI = 0, pz = 0, pE = 1;
    for (let q = 0; q <= NS; q++) {
      const E = (q / NS) * TAU, cE = cos(E), sE = sin(E);
      const u = A * (cE - e), v = A * bb * sE;
      proj(u * Xp + v * Xq, u * Yp + v * Yq, u * Zp + v * Zq);
      const sx = P[0], sy = P[1], dp = P[2];
      // brighter where the body lingers
      const I = 0.3 + 0.7 * pow((1 - e * cE) / (1 + e), 0.7);
      const rr = min(sqrt(((sx - CX) / 32) * ((sx - CX) / 32) + ((sy - CY) / 64) * ((sy - CY) / 64)), 1.3), eg = EDGE0 + EDGE1 * pow(rr, 1.4);
      if (q > 0) {
        const L = sqrt((sx - px) * (sx - px) + (sy - py) * (sy - py)), m = max(1, Math.ceil(L / SP));
        for (let t = 0; t < m; t++) {
          const f = (t + 0.5) / m, w = (L / m) * (pI + (I - pI) * f) * (0.3 + 0.7 * 0.5 * (1 + (pz + (dp - pz) * f))) * (pE + (eg - pE) * f);
          splat(px + (sx - px) * f, py + (sy - py) * f, cr * w, cg * w, cb * w);
        }
      }
      px = sx;
      py = sy;
      pI = I;
      pz = dp;
      pE = eg;
    }
  }

  // ---- bloom: the lines are blurred once, a wide copy is added under them
  blur(FR, TR, 1, 0.16);
  blur(FG, TG, 1, 0.16);
  blur(FB, TB, 1, 0.16);
  GR.set(FR);
  GG.set(FG);
  GB.set(FB);
  blur(GR, TR, 2, 0.25);
  blur(GG, TG, 2, 0.25);
  blur(GB, TB, 2, 0.25);
  blur(GR, TR, 4, 0.25);
  blur(GG, TG, 4, 0.25);
  blur(GB, TB, 4, 0.25);

  // ---- the central body and the beads go on top of the blur, as sharp as the lines
  hsv(0.1 + hue, 0.35, 1, C);
  for (let yy = -7; yy <= 7; yy++)
    for (let xx = -7; xx <= 7; xx++) {
      const r2 = (xx * xx + yy * yy / (SY * SY)) / 6.0;
      const w = exp(-r2) * 0.9;
      const p = (CY + yy) * W + CX + xx;
      FR[p] += C[0] * w;
      FG[p] += C[1] * w;
      FB[p] += C[2] * w;
    }
  for (let i = 0; i < NO; i++) {
    frame(S, i);
    const e = F[6], bb = F[7];
    const E = kepler(S.M[i], e), u = A * (cos(E) - e), v = A * bb * sin(E);
    proj(u * F[0] + v * F[3], u * F[1] + v * F[4], u * F[2] + v * F[5]);
    ramp(1 - bb, hue, C);
    const uu = cl((1 - bb) / 0.46, 0, 1), w = (0.5 + 0.9 * uu) * (0.45 + 0.55 * 0.5 * (1 + P[2]));
    // the bead is the orbit's colour with some white in it
    dot(P[0], P[1], (0.3 + 0.7 * C[0]) * w, (0.3 + 0.7 * C[1]) * w, (0.3 + 0.7 * C[2]) * w);
  }

  // ---- tone map and out: the brightest channel is soft-clipped and the colour keeps
  // its ratios, with a little white added where the light piles up
  const G = 1.7;
  for (let p = 0; p < W * H; p++) {
    const r = FR[p] + 0.12 * GR[p], g = FG[p] + 0.12 * GG[p], b = FB[p] + 0.12 * GB[p];
    const m = max(r, g, b);
    if (m < 0.012) {
      display.setPixel(p % W, (p / W) | 0, 0, 0, 0);
      continue;
    }
    const o = 1 - exp(-G * m), f = o / m, wh = 0.45 * o * o * o;
    display.setPixel(p % W, (p / W) | 0, min(255, ((r * f + wh) * 255) | 0), min(255, ((g * f + wh) * 255) | 0), min(255, ((b * f + wh) * 255) | 0));
  }
}
