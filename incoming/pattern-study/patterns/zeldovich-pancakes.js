// ===== Patternflow pattern =====
// Title:   Zeldovich Pancakes
// Family:  space
// Idea:    A sheet of 32768 particles is moved by the Zeldovich approximation through a periodic box the size of the panel, and their density, counted per LED, grows from a smooth fog into thin pancakes that light up where the larger eigenvalue of the deformation tensor reaches 1/D, then into the walls, filaments and knots of a cosmic web, before a new random potential fades in.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Zeldovich approximation (Yakov Zeldovich, 1970), pattern round 40
// Round:   40
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Scale=1.8..3.4, Cross=0..1
//
// Knob 1: Hue. Turns both palettes round the wheel together, the free sheet and the matter the walls have swallowed. At 0 an indigo fog with walls rose to peach and knots near white; at 0.1 magenta and peach, 0.2 crimson and cream, 0.3 red and pale lime, 0.4 dark grey-green and green, 0.5 green and cyan, 0.6 teal and sky blue, 0.7 teal and violet, 0.8 blue and pink, 0.9 indigo and peach. Where a palette lands on orange, yellow or lime its dim end leans to crimson or to green and its middle is lifted toward cream, so nothing reads brown or olive.
// Knob 2: Speed. At 2 a new realisation goes from fog to its first caustic in 2.0 s, spends 4.3 s on pancakes (D from 1 to 1.6), reaches D = 2.4 at 10.5 s and D = 3.8 at 15.9 s, and the next one fades in over 1.6 s. At 0.2 all of it ten times slower, at 3 one and a half times faster.
// Knob 3: Scale. The smoothing length of the random potential, 1.8 to 3.4 LEDs. At 1.8 the web at D = 3.2 holds about 42 voids on the panel, at 2.6 about 26 and at 3.4 about 18, and the pancakes are born fewer and longer. Waves longer than 48 LEDs are tapered off at every setting.
// Knob 4: Cross. How far two streams of particles that meet pass through each other. At 0 they stick, the zero-viscosity limit of the adhesion model, and every wall stays one LED thin while its mass drains into the knots; at 1 they pass straight through, the plain Zeldovich approximation, and past D = 2 the knots puff up into wide diamonds of crossing streams. It opens at 0.06, 94 percent sticky. By D = 3.8 about half of the particles have been swallowed by a wall.
// Buttons: K1 tap starts a new realisation now; the old web stands still and fades out over 1.6 s at Speed 2.

const W = 64, H = 128, NL = W * H;
// The particle lattice: two by two particles to an LED, 128 by 256.
const NX = 128, NY = 256, NP = NX * NY, HQ = 0.5;
const { floor, min, max, sqrt, exp, log, sin, cos, round, random, PI, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// In-place radix-2 FFT of one line, sign +1 or -1.
function fft(re, im, n, sgn) {
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (sgn * 2 * PI) / len, wr = cos(ang), wi = sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < h; k++) {
        const a = i + k, b = a + h;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

// 2D FFT of an NX by NY field, rows then columns.
function fft2(re, im, sgn, T) {
  const { lr, li, cr, ci } = T;
  for (let y = 0; y < NY; y++) {
    const o = y * NX;
    for (let x = 0; x < NX; x++) {
      lr[x] = re[o + x];
      li[x] = im[o + x];
    }
    fft(lr, li, NX, sgn);
    for (let x = 0; x < NX; x++) {
      re[o + x] = lr[x];
      im[o + x] = li[x];
    }
  }
  for (let x = 0; x < NX; x++) {
    for (let y = 0; y < NY; y++) {
      cr[y] = re[y * NX + x];
      ci[y] = im[y * NX + x];
    }
    fft(cr, ci, NY, sgn);
    for (let y = 0; y < NY; y++) {
      re[y * NX + x] = cr[y];
      im[y * NX + x] = ci[y];
    }
  }
}

// A new realisation: white noise, its transform kept so a new Scale only
// filters it again.
function noise(R) {
  const { nr, ni } = R;
  for (let p = 0; p < NP; p += 2) {
    const u = 1 - random(), v = random(), m = sqrt(-2 * log(u));
    nr[p] = m * cos(2 * PI * v);
    nr[p + 1] = m * sin(2 * PI * v);
  }
  ni.fill(0);
  fft2(nr, ni, -1, R.T);
}

// The potential phi has power k^(-4) exp(-(k s)^2), so the linear density
// D lap(phi) is white noise smoothed over s LEDs. Waves
// longer than about 48 LEDs are tapered off: the box has only a few of them,
// all lined up with its sides, and one alone lays a ruled wall across the
// panel. Its gradient, the deformation tensor d2 phi / dq2 and phi itself
// come back from three inverse transforms, and all of it is scaled so the
// largest eigenvalue lambda1 over the lattice is 1: the first caustic is
// due at D = 1. On three seeds the first cell of the lattice turned over at
// D = 1.002 to 1.013, and before that the counted density matched
// 1 / ((1 - D lambda1)(1 - D lambda2)) per LED to a median 1 to 2.6 percent.
const KLO = (2 * PI) / 48;
function amp(k2, s) {
  return (k2 / sqrt(k2 * k2 + KLO ** 4)) * k2 ** -1 * exp(-0.5 * k2 * s * s);
}

function filter(R, s) {
  const { nr, ni, ar, ai, br, bi, cr, ci, gx, gy, T } = R;
  for (let j = 0; j < NY; j++) {
    const ky = ((2 * PI) / H) * (j < NY / 2 ? j : j - NY);
    for (let i = 0; i < NX; i++) {
      const kx = ((2 * PI) / W) * (i < NX / 2 ? i : i - NX), p = j * NX + i, k2 = kx * kx + ky * ky;
      if (k2 === 0 || i === NX / 2 || j === NY / 2) {
        ar[p] = ai[p] = br[p] = bi[p] = cr[p] = ci[p] = 0;
        continue;
      }
      const w = amp(k2, s), Ar = nr[p] * w, Ai = ni[p] * w;
      // gx + i gy
      ar[p] = -kx * Ai - ky * Ar;
      ai[p] = kx * Ar - ky * Ai;
      // phi_xx + i phi_yy
      br[p] = -kx * kx * Ar + ky * ky * Ai;
      bi[p] = -kx * kx * Ai - ky * ky * Ar;
      // phi_xy + i phi
      cr[p] = -kx * ky * Ar - Ai;
      ci[p] = -kx * ky * Ai + Ar;
    }
  }
  fft2(ar, ai, 1, T);
  fft2(br, bi, 1, T);
  fft2(cr, ci, 1, T);
  let l1 = 0;
  for (let p = 0; p < NP; p++) {
    const a = br[p], b = bi[p], c = cr[p], m = 0.5 * (a + b) + sqrt(0.25 * (a - b) * (a - b) + c * c);
    if (m > l1) l1 = m;
  }
  R.l1raw = l1;
  const k = 1 / l1;
  for (let p = 0; p < NP; p++) {
    gx[p] = ar[p] * k;
    gy[p] = ai[p] * k;
    R.phi[p] = ci[p] * k;
    const a = br[p], b = bi[p], c = cr[p];
    R.l1[p] = (0.5 * (a + b) + sqrt(0.25 * (a - b) * (a - b) + c * c)) * k;
  }
  R.scale = s;
  R.Dh = R.D1 = -1;
}

function realisation() {
  const R = {
    nr: new Float64Array(NP), ni: new Float64Array(NP),
    ar: new Float64Array(NP), ai: new Float64Array(NP), br: new Float64Array(NP), bi: new Float64Array(NP),
    cr: new Float64Array(NP), ci: new Float64Array(NP),
    gx: new Float32Array(NP), gy: new Float32Array(NP), phi: new Float32Array(NP),
    // Where each particle would be in the sticky limit, less where it is.
    dx: new Float32Array(NP), dy: new Float32Array(NP), psi: new Float64Array(NP), Dh: -1, D1: -1,
    X: new Float32Array(NP), Y: new Float32Array(NP), wk: new Float32Array(NP), l1: new Float32Array(NP),
    T: { lr: new Float64Array(NX), li: new Float64Array(NX), cr: new Float64Array(NY), ci: new Float64Array(NY) },
    l1raw: 1, scale: 0,
  };
  noise(R);
  return R;
}

// The sticky limit is the adhesion model (Gurbatov, Saichev and Shandarin,
// 1989): Burgers flow with the viscosity taken to zero. A particle sits at
// the gradient of the convex hull of G(q) = |q|^2 / 2 - D phi(q); where G is
// its own hull the particle is where Zeldovich put it, and where the hull
// bridges over G the particle has been swallowed by a wall or a knot. The
// hull is two Legendre transforms, each two passes of Felzenszwalb and
// Huttenlocher's lower envelope of parabolas:
//   Phi(p) = min_q |p - q|^2 / 2 - D phi(q),  Psi(q) = min_p |q - p|^2 / 2 - Phi(p),
// and the hull is |q|^2 / 2 - Psi(q). Sites q one an LED, MQ LEDs of the
// periodic box copied round it; the p grid two an LED, MP LEDs round the
// box, wide enough for the largest move, D = 3.8 times 5.3 LEDs at Scale 3.4.
const MQ = 30, SX = W + 2 * MQ, SY = H + 2 * MQ, MP = 20, PD = 2, PX = PD * (W + 2 * MP), PY = PD * (H + 2 * MP);
const NE = max(SY, PY) + 2;
const A = {
  zsx: new Float64Array(SX), zsy: new Float64Array(SY), zpx: new Float64Array(PX), zpy: new Float64Array(PY),
  zlx: new Float64Array(NX), zly: new Float64Array(NY),
  T1: new Float64Array(SY * PX), PH: new Float64Array(PY * PX), T2: new Float64Array(PY * NX),
  f: new Float64Array(NE), o: new Float64Array(NE), V: new Int32Array(NE), Zb: new Float64Array(NE + 1),
};
for (let m = 0; m < SX; m++) A.zsx[m] = m - MQ + 0.25;
for (let m = 0; m < SY; m++) A.zsy[m] = m - MQ + 0.25;
for (let k = 0; k < PX; k++) A.zpx[k] = (k + 0.5) / PD - MP;
for (let k = 0; k < PY; k++) A.zpy[k] = (k + 0.5) / PD - MP;
for (let i = 0; i < NX; i++) A.zlx[i] = (i + 0.5) * HQ;
for (let j = 0; j < NY; j++) A.zly[j] = (j + 0.5) * HQ;

// Lower envelope of (x - z[i])^2 / 2 + f[i] over n sites, read at m
// queries xq, both in increasing order.
function envelope(z, f, n, xq, m, out) {
  const { V, Zb } = A;
  let k = 0;
  V[0] = 0;
  Zb[0] = -Infinity;
  Zb[1] = Infinity;
  for (let i = 1; i < n; i++) {
    const ai = f[i] + 0.5 * z[i] * z[i];
    let s = 0;
    for (;;) {
      const v = V[k];
      s = (ai - f[v] - 0.5 * z[v] * z[v]) / (z[i] - z[v]);
      if (s <= Zb[k]) k--;
      else break;
    }
    k++;
    V[k] = i;
    Zb[k] = s;
    Zb[k + 1] = Infinity;
  }
  k = 0;
  for (let j = 0; j < m; j++) {
    const x = xq[j];
    while (Zb[k + 1] < x) k++;
    const v = V[k], d = x - z[v];
    out[j] = 0.5 * d * d + f[v];
  }
}

// The hull is split over two frames: Phi at growth D on one, Psi and the
// particles' moves on the next, so they lag the growth by two frames at
// most, a twentieth of an LED.
function hullPhi(R, D) {
  const { zsx, zsy, zpx, zpy, T1, PH, f, o } = A;
  const phi = R.phi;
  // Along x for each row of sites, then along y for each column of p.
  for (let n = 0; n < SY; n++) {
    const jy = 2 * ((((n - MQ) % H) + H) % H);
    for (let m = 0; m < SX; m++) f[m] = -D * phi[jy * NX + 2 * ((((m - MQ) % W) + W) % W)];
    envelope(zsx, f, SX, zpx, PX, o);
    T1.set(o.subarray(0, PX), n * PX);
  }
  for (let k = 0; k < PX; k++) {
    for (let n = 0; n < SY; n++) f[n] = T1[n * PX + k];
    envelope(zsy, f, SY, zpy, PY, o);
    for (let j = 0; j < PY; j++) PH[j * PX + k] = o[j];
  }
  R.D1 = D;
}

function hullPsi(R) {
  const { zpx, zpy, zlx, zly, PH, T2, f, o } = A;
  const { phi, gx, gy, dx, dy, psi, wk } = R, D = R.D1;
  // Along x for each row of p, then along y, read at the lattice.
  for (let j = 0; j < PY; j++) {
    for (let k = 0; k < PX; k++) f[k] = -PH[j * PX + k];
    envelope(zpx, f, PX, zlx, NX, o);
    T2.set(o.subarray(0, NX), j * NX);
  }
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < PY; j++) f[j] = T2[j * NX + i];
    envelope(zpy, f, PY, zly, NY, o);
    for (let j = 0; j < NY; j++) psi[j * NX + i] = o[j];
  }
  // Psi - |q|^2 / 2 is periodic like phi, so the hull's gradient q - grad Psi
  // comes from central differences round the box; on a knot's flat facet it
  // is the same point for every particle on the facet, on a wall it runs
  // along the wall. Where the hull touches G (to within GAP0, the slack of
  // the grids) the particle is free and stays where Zeldovich put it.
  for (let j = 0; j < NY; j++) {
    const jn = ((j + 1) % NY) * NX, js = ((j + NY - 1) % NY) * NX;
    for (let i = 0; i < NX; i++) {
      const p = j * NX + i, w = cl((psi[p] - D * phi[p] - GAP0) / GAP0, 0, 1);
      wk[p] = w;
      if (w === 0) {
        dx[p] = dy[p] = 0;
        continue;
      }
      const ie = (i + 1) % NX, iw = (i + NX - 1) % NX;
      dx[p] = w * (D * gx[p] - (psi[j * NX + ie] - psi[j * NX + iw]) / (2 * HQ));
      dy[p] = w * (D * gy[p] - (psi[jn + i] - psi[js + i]) / (2 * HQ));
    }
  }
  R.Dh = D;
  R.D1 = -1;
}
const GAP0 = 0.05;

function tick(R, D) {
  if (R.Dh < 0) {
    hullPhi(R, D);
    hullPsi(R);
  } else if (R.D1 < 0) hullPhi(R, D);
  else hullPsi(R);
}

// One point into the LEDs by cloud in cell, weight w into rho and the
// share k of it that a wall has swallowed into rs as well.
function cic(rho, rs, x, y, w, k) {
  x -= W * floor(x / W);
  y -= H * floor(y / H);
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const ix1 = ix + 1 === W ? 0 : ix + 1, o0 = iy * W, o1 = iy + 1 === H ? 0 : o0 + W;
  const a = w * (1 - fy), b = w * fy, a0 = a * (1 - fx), a1 = a * fx, b0 = b * (1 - fx), b1 = b * fx;
  rho[o0 + ix] += a0;
  rho[o0 + ix1] += a1;
  rho[o1 + ix] += b0;
  rho[o1 + ix1] += b1;
  if (k > 0) {
    rs[o0 + ix] += k * a0;
    rs[o0 + ix1] += k * a1;
    rs[o1 + ix] += k * b0;
    rs[o1 + ix1] += k * b1;
  }
}

// How much of a particle a wall has swallowed: all of it once it has passed
// through its own caustic, D lambda1(q) > 1, ramped in over the first tenth;
// in the sticky limit also its neighbours that the hull bridges over.
const eaten = (dl, w) => {
  const e = dl <= 1 ? 0 : dl >= 1.1 ? 1 : (dl - 1) * 10;
  return e > w ? e : w;
};

// Moves every particle to x = q - D grad phi(q), pulled the sticky share of
// the way to where the sticky limit puts it, and counts it into the LEDs, a
// quarter of a particle each so the untouched sheet is density 1. Where the
// sheet is stretched so that neighbours land more than SPREAD apart (the
// voids, and walls draining into their knots), a particle is laid as 2 to 4
// points across the parallelogram its own cell of the lattice went to;
// otherwise those stretches show as a ladder of dots.
const SPREAD = 0.9, S1 = SPREAD * SPREAD, S2 = 4 * S1, S3 = 9 * S1;
function deposit(R, D, st, rho, rs, wgt) {
  const { gx, gy, dx, dy, X, Y, wk, l1 } = R;
  const hull = R.Dh >= 0;
  if (!hull) st = 0;
  for (let j = 0; j < NY; j++) {
    const qy = (j + 0.5) * HQ - 0.5;
    for (let i = 0; i < NX; i++) {
      const p = j * NX + i;
      X[p] = (i + 0.5) * HQ - 0.5 - D * gx[p] + st * dx[p];
      Y[p] = qy - D * gy[p] + st * dy[p];
    }
  }
  for (let j = 0; j < NY; j++) {
    const on = (j === NY - 1 ? 0 : j + 1) * NX, os = (j === 0 ? NY - 1 : j - 1) * NX, yn = j === NY - 1 ? H : 0, ys = j === 0 ? H : 0;
    for (let i = 0; i < NX; i++) {
      const p = j * NX + i, e = j * NX + (i === NX - 1 ? 0 : i + 1), w = j * NX + (i === 0 ? NX - 1 : i - 1);
      // The cell's edges, half the central differences.
      const ax = 0.5 * (X[e] - X[w] + (i === NX - 1 || i === 0 ? W : 0)), ay = 0.5 * (Y[e] - Y[w]);
      const bx = 0.5 * (X[on + i] - X[os + i]), by = 0.5 * (Y[on + i] - Y[os + i] + yn + ys);
      const la = ax * ax + ay * ay, lb = bx * bx + by * by;
      if (la < S1 && lb < S1) {
        cic(rho, rs, X[p], Y[p], wgt, eaten(D * l1[p], hull ? wk[p] : 0));
        continue;
      }
      const k = la < S1 ? 1 : la < S2 ? 2 : la < S3 ? 3 : 4, l = lb < S1 ? 1 : lb < S2 ? 2 : lb < S3 ? 3 : 4, ww = wgt / (k * l), sw = eaten(D * l1[p], hull ? wk[p] : 0);
      for (let b = 0; b < l; b++) {
        const v = (b + 0.5) / l - 0.5;
        for (let a = 0; a < k; a++) {
          const u = (a + 0.5) / k - 0.5;
          cic(rho, rs, X[p] + u * ax + v * bx, Y[p] + u * ay + v * by, ww, sw);
        }
      }
    }
  }
}

// Thin fog and voids, where both an LED and its neighbours hold under FOG,
// are smoothed by a 1 2 1 blur: there the lattice of particles beats with
// the LEDs in a faint cross-hatch. Walls and knots are left sharp.
const FOG = 1.6;
function smooth(rho, t1, t2) {
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) t1[o + x] = 0.25 * (rho[o + (x === 0 ? W - 1 : x - 1)] + rho[o + (x === W - 1 ? 0 : x + 1)]) + 0.5 * rho[o + x];
  }
  for (let y = 0; y < H; y++) {
    const on = (y === H - 1 ? 0 : y + 1) * W, os = (y === 0 ? H - 1 : y - 1) * W, o = y * W;
    for (let x = 0; x < W; x++) t2[o + x] = 0.25 * (t1[on + x] + t1[os + x]) + 0.5 * t1[o + x];
  }
  for (let p = 0; p < NL; p++) {
    const r = rho[p], b = t2[p], m = r > b ? r : b;
    if (m < FOG) rho[p] = b;
    else if (m < 2 * FOG) rho[p] = r + (b - r) * (2 - m / FOG);
  }
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, sticky: 0.94,
    D: DSTART, cur: null, old: null, fade: 0, Dold: 0,
    rho: new Float32Array(NL), rs: new Float32Array(NL), t1: new Float32Array(NL), t2: new Float32Array(NL),
    lut: new Uint8Array(256 * 3), lutS: new Uint8Array(256 * 3), lutHue: -1, c: [0, 0, 0],
  };
}

// Growth: D climbs RATE a second at Speed 2 times pace(D), from D0 to DMAX,
// where the next realisation fades in over FADE seconds and the old web
// stands still as it fades. It hurries through the fog, slows to half
// speed while the pancakes are born (D 1 to 1.6) and quickens again as the
// web drains into its knots. The first run opens at DSTART, the web grown.
const RATE = 0.2, D0 = 0.5, DMAX = 3.8, DSTART = 2.6, FADE = 1.6;
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const pace = (D) => 0.7 + 0.9 * (1 - sm(0.7, 1, D)) + 0.6 * sm(1.6, 2.4, D);
// Opening hue: the fog indigo, the swallowed walls rose to peach.
const H0 = 0.68;

// Two palettes from the log density, LUTs rebuilt when Hue turns: one for
// the free sheet, which runs up 0.3 of the wheel from the voids to the
// knots while it pales, and one a third of the way round, paler and
// brighter, for the matter a wall has swallowed, so a pancake shows the
// moment it forms. Orange, yellow and lime go brown or olive when dim, so
// where a palette lands there it leans to crimson (from orange) or to green
// (from yellow) in the dark, and is lifted toward cream at mid brightness.
function entry(lut, k, h, s, v, c) {
  h -= floor(h);
  const warm = cl(h / 0.04, 0, 1) * cl((0.3 - h) / 0.06, 0, 1), dim = warm * cl((0.62 - v) / 0.3, 0, 1), mid = warm * cl((v - 0.25) / 0.2, 0, 1);
  const toRed = cl((0.125 - h) / 0.04, 0, 1), toGreen = cl((h - 0.125) / 0.04, 0, 1);
  h += dim * (toGreen * (0.32 - h) - toRed * (h + 0.03));
  s *= 1 - 0.7 * dim * (1 - toRed - toGreen);
  v += mid * 0.6 * (1 - v);
  s *= 1 - 0.55 * mid;
  hsv(h, s, v, c);
  lut[k * 3] = round(255 * c[0]);
  lut[k * 3 + 1] = round(255 * c[1]);
  lut[k * 3 + 2] = round(255 * c[2]);
}

function buildLut(S) {
  const c = S.c, h0 = S.hue + H0;
  for (let k = 0; k < 256; k++) {
    const t = k / 255;
    entry(S.lut, k, h0 + 0.3 * t, 0.92 - 0.8 * t * t, 0.03 + 0.97 * t ** 1.25, c);
    entry(S.lutS, k, h0 + 0.22 + 0.14 * t, 0.78 - 0.5 * t * t, 0.04 + 0.96 * t ** 1.3, c);
  }
  S.lutHue = S.hue;
}

function fresh(S, sc) {
  S.old = S.cur;
  S.Dold = S.D;
  S.cur = realisation();
  filter(S.cur, sc);
  S.D = D0;
  S.fade = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1.8, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const sc = round(cl(k[2], 1.8, 3.4) * 10) / 10;
  S.sticky = 1 - cl(k[3], 0, 1);
  if (!S.cur) S.cur = realisation();
  if (S.cur.scale !== sc) filter(S.cur, sc);
  if (S.old && S.old.scale !== sc) filter(S.old, sc);
  S.D += ((RATE * S.speed) / 2) * pace(S.D) * d;
  if (S.old) {
    S.fade += (d * S.speed) / 2 / FADE;
    if (S.fade >= 1) S.old = null;
  }
  if (!S.old && (S.D >= DMAX || (input.btnPressed && input.btnPressed[0]))) fresh(S, sc);
  tick(S.cur, S.D);
  // The old web stands still while it fades, so its hull is done once.
  if (S.old && S.old.Dh !== S.Dold) {
    hullPhi(S.old, S.Dold);
    hullPsi(S.old);
    S.cur.D1 = -1;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.cur) return;
  if (S.lutHue !== S.hue) buildLut(S);
  const { rho, rs, t1, lut, lutS } = S;
  rho.fill(0);
  rs.fill(0);
  if (S.old) {
    // The old web fades as the new one comes in.
    const f = S.fade * S.fade * (3 - 2 * S.fade);
    deposit(S.cur, S.D, S.sticky, rho, rs, 0.25 * f);
    deposit(S.old, S.Dold, S.sticky, rho, rs, 0.25 * (1 - f));
  } else deposit(S.cur, S.D, S.sticky, rho, rs, 0.25);
  // The swallowed share of each LED, before the fog is smoothed.
  for (let p = 0; p < NL; p++) rs[p] = rho[p] > 0 ? min(1, (1.4 * rs[p]) / rho[p]) : 0;
  smooth(rho, t1, S.t2);
  // Brightness from the log of the density: 0.25 dark, 1 a dim fog, 16 full.
  const lo = log(0.25), sp = 1 / (log(16) - lo);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, r = rho[p], a = rs[p], b = 1 - a;
      const i = r > 0.25 ? round(min(1, (log(r) - lo) * sp) * 255) * 3 : 0;
      display.setPixel(x, y, round(b * lut[i] + a * lutS[i]), round(b * lut[i + 1] + a * lutS[i + 1]), round(b * lut[i + 2] + a * lutS[i + 2]));
    }
}
