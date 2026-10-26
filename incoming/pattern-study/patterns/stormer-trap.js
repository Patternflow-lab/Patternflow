// ===== Patternflow pattern =====
// Title:   Størmer Trap
// Family:  particle
// Idea:    Charged particles in the field of a magnetic dipole lying across the panel are integrated in three dimensions: each one spirals along a faint field-line loop that stands up to the top or the bottom of the panel and turns back at a mirror point near the centre, while the whole belt drifts slowly round the dipole's axis, positive charges one way and negative ones the other; the few inside the loss cone reach the small sphere at the centre and flash where they land.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Størmer's problem, charged particles in a dipole field (Carl Størmer, 1907)
// Round:   54
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Energy=0..1, Pitch=0..90
//
// Knob 1: Hue. Turns both charges round the colour wheel together. At 0 the positive charges are gold and the negative ones sky blue, at 0.5 blue and orange; the field lines stay a faint violet.
// Knob 2: Speed. At 2 a particle covers 100 LEDs a second and one on an outer shell goes from one mirror point to the other and back in two to three seconds, while the belt takes about 100 s to drift once round. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Energy. The particles' momentum against the field, given as the outermost shell's distance from the centre in Størmer lengths, from 0.19 at 0 to 1 at 1. At 0 a gyration at the top of an outer loop is 4.5 LEDs across and the magnetic moment holds to a fifth of a percent. Størmer showed that a particle on the equator nearer than sqrt(2) - 1 = 0.414 of his length can never leave, whatever its direction, and the outermost shell passes that at 0.47. Around 0.5 the gyrations swell to 24 LEDs and the moment breaks; past it the orbits begin to leave the panel, two a second at 0.75 and at 1 nearly all of them within a second or two.
// Knob 4: Pitch. The smallest angle, in degrees, between a particle's velocity and the field where it crosses the equator; each particle starts between it and 60% of the way to 90. At 0 most dive deep toward the sphere, and the few inside the loss cone (1.9 degrees on the outermost shell, 4.9 on the innermost) land on it within one bounce. At 90 they all stay on the equator, a tall thin ellipse in the tilted view, and only gyrate and drift.

const W = 64, H = 128, N = W * H, CX = 31.5, CY = 63.5;
const { floor, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// NP particles on shells LMIN to LMAX LEDs from the centre at the equator,
// round a sphere of radius RS. RATE is the simulated time per second at
// Speed 1; a particle moves one LED per unit of it.
const NP = 48, RS = 8, LMIN = 34, LMAX = 62, RATE = 50;
// The view is turned TILT radians about the vertical, so a ring round the
// dipole's axis shows as a narrow ellipse instead of a line.
const TILT = 0.21, CT = cos(TILT), ST = sin(TILT);
// Largest gyration angle and largest distance one Boris step may take.
const DPHI = 0.3, DMAX = 0.5;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// The dipole points along +x, across the panel; y is up and z comes out of
// the panel toward the viewer. B = k (3 x r / r^5 - x_hat / r^3), with k the
// dipole moment times the charge-to-mass ratio, so that a charge s = +1 or -1
// feels dv/dt = s v x B.
function field(x, y, z, k, o) {
  const r2 = x * x + y * y + z * z, i3 = k / (r2 * sqrt(r2)), f = (3 * x) / r2;
  o[0] = i3 * (f * x - 1);
  o[1] = i3 * f * y;
  o[2] = i3 * f * z;
}

// The latitude where a particle of equatorial pitch angle a mirrors: there
// the field is 1 / sin^2(a) times its equatorial value, and along a dipole
// field line B / B_eq = sqrt(1 + 3 sin^2 l) / cos^6 l.
function mirrorLat(s2) {
  let lo = 0, hi = PI / 2 - 1e-6;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2, c = cos(m), sn = sin(m), g = (c * c * c * c * c * c) / sqrt(1 + 3 * sn * sn);
    if (g > s2) lo = m;
    else hi = m;
  }
  return lo;
}

// Equatorial distance from the centre in Størmer lengths for the outermost
// shell, from the Energy knob. The Størmer length is sqrt(k / v) with v = 1.
const sOf = (u) => 0.19 * (1 / 0.19) ** u;

export function setup(params) {
  const F = (n) => new Float64Array(n);
  const S = (params.s = {
    hue: 0, speed: 2, en: 0, pitch: 0, k: 1, cst: 1,
    x: F(NP), y: F(NP), z: F(NP), vx: F(NP), vy: F(NP), vz: F(NP), sg: new Int8Array(NP), tc: F(NP), rh: F(NP), L: F(NP), a: F(NP), want: new Uint8Array(NP),
    tp: new Float32Array(N), tn: new Float32Array(N), fx: new Float32Array(N), fl: new Float32Array(N), b: F(3), c: [0, 0, 0], d: [0, 0, 0],
    lost: 0, esc: 0, started: false,
  });
  // The faint field lines in the plane of the panel: x = L cos^2 l sin l and
  // y = +-L cos^3 l, from the sphere on one side round to the sphere on the
  // other, for six shells.
  for (const L of [16, 26, 36, 46, 56, 66]) {
    const lh = Math.acos(sqrt(RS / L));
    for (let t = -lh; t <= lh; t += 0.002) {
      const c = cos(t), x = CT * L * c * c * sin(t), y = L * c * c * c;
      splat(S.fl, CX + x, CY - y, 1);
      splat(S.fl, CX + x, CY + y, 1);
    }
  }
  let m = 0;
  for (let i = 0; i < N; i++) m = max(m, S.fl[i]);
  for (let i = 0; i < N; i++) S.fl[i] = min(1, S.fl[i] / (0.55 * m));
}

function splat(A, px, py, w) {
  const x0 = floor(px), y0 = floor(py), fx = px - x0, fy = py - y0;
  if (x0 >= 0 && x0 < W && y0 >= 0 && y0 < H) A[y0 * W + x0] += w * (1 - fx) * (1 - fy);
  if (x0 + 1 >= 0 && x0 + 1 < W && y0 >= 0 && y0 < H) A[y0 * W + x0 + 1] += w * fx * (1 - fy);
  if (x0 >= 0 && x0 < W && y0 + 1 >= 0 && y0 + 1 < H) A[(y0 + 1) * W + x0] += w * (1 - fx) * fy;
  if (x0 + 1 >= 0 && x0 + 1 < W && y0 + 1 >= 0 && y0 + 1 < H) A[(y0 + 1) * W + x0 + 1] += w * fx * fy;
}

// Puts particle i on a shell L at a random point of its bounce: its guiding
// centre goes on the field line at a latitude inside its mirror latitude,
// with the pitch angle there that keeps the magnetic moment
// sin^2(a) / B the same as at the equator, then the particle is set off by
// its gyration radius in a random gyration phase.
function inject(S, i) {
  const R = Math.random;
  const sg = i & 1 ? -1 : 1, L = LMIN + (LMAX - LMIN) * R();
  const a = ((S.pitch + 0.6 * (90 - S.pitch) * R()) * PI) / 180, s2 = sin(a) ** 2;
  // A guiding centre whose mirror point lies inside the sphere starts above
  // the sphere: it is in the loss cone and will land on its way down.
  const lm = min(mirrorLat(s2), 0.97 * Math.acos(sqrt(RS / L))), l0 = lm * sin(2 * PI * R());
  const c = cos(l0), r = L * c * c, ph = 2 * PI * R(), rho = r * c;
  const gx = r * sin(l0), gy = rho * cos(ph), gz = rho * sin(ph);
  const b = S.b;
  field(gx, gy, gz, S.k, b);
  const bm = sqrt(b[0] * b[0] + b[1] * b[1] + b[2] * b[2]), hx = b[0] / bm, hy = b[1] / bm, hz = b[2] / bm;
  const sl = min(1, (s2 * bm * L * L * L) / S.k), vp = sqrt(sl), va = sqrt(1 - sl) * (R() < 0.5 ? -1 : 1);
  // Two unit vectors across the field line.
  let ex = -hy, ey = hx, ez = 0, n = sqrt(ex * ex + ey * ey);
  if (n < 1e-6) (ex = 0), (ey = -hz), (ez = hy), (n = sqrt(ey * ey + ez * ez));
  ex /= n;
  ey /= n;
  ez /= n;
  const fx = hy * ez - hz * ey, fy = hz * ex - hx * ez, fz = hx * ey - hy * ex, ps = 2 * PI * R(), cp = cos(ps), sp = sin(ps);
  const ux = vp * (cp * ex + sp * fx), uy = vp * (cp * ey + sp * fy), uz = vp * (cp * ez + sp * fz);
  S.vx[i] = va * hx + ux;
  S.vy[i] = va * hy + uy;
  S.vz[i] = va * hz + uz;
  // The gyration radius vector is s (b_hat x v_perp) / B.
  S.x[i] = gx + (sg * (hy * uz - hz * uy)) / bm;
  S.y[i] = gy + (sg * (hz * ux - hx * uz)) / bm;
  S.z[i] = gz + (sg * (hx * uy - hy * ux)) / bm;
  S.sg[i] = sg;
  S.L[i] = L;
  S.a[i] = a;
  S.want[i] = 0;
  S.tc[i] = 0;
  field(S.x[i], S.y[i], S.z[i], S.k, b);
  S.rh[i] = max(sqrt(b[0] * b[0] + b[1] * b[1] + b[2] * b[2]) / DPHI, 1 / DMAX);
}

// Advances particle i by T of simulated time with the Boris pusher, which
// turns the velocity about the local field by exactly the angle the field
// gives and so keeps the speed fixed to rounding. Steps are short enough for
// about 0.3 rad of gyration and half an LED of travel. A step length read
// straight off the field would break the pusher's symmetry in time, and the
// magnetic moment then drifted by a quarter in 20 s; so the step density
// follows Hairer and Söderlind's reversible rule, the mean of the densities
// either side of a position equal to the one the field there asks for. The
// time a particle runs past its frame is taken off its next one. Every step
// leaves its light on the panel, weighted by the time it took and by depth.
function push(S, i, T) {
  const b = S.b, k = S.k, sg = S.sg[i], A = sg > 0 ? S.tp : S.tn, esc = max(1.6 * LMAX, S.cst);
  let x = S.x[i], y = S.y[i], z = S.z[i], vx = S.vx[i], vy = S.vy[i], vz = S.vz[i], rh = S.rh[i], n = 0;
  T += S.tc[i];
  while (T > 0 && n++ < 6000) {
    field(x, y, z, k, b);
    const bm = sqrt(b[0] * b[0] + b[1] * b[1] + b[2] * b[2]), g = max(bm / DPHI, 1 / DMAX);
    let rn = 2 * g - rh;
    if (rn < 0.5 * g) rn = g;
    const h = 1 / rn, hm = 0.5 * (h + 1 / rh);
    rh = rn;
    const tx = 0.5 * sg * hm * b[0], ty = 0.5 * sg * hm * b[1], tz = 0.5 * sg * hm * b[2], q = 2 / (1 + tx * tx + ty * ty + tz * tz);
    const wx = vx + vy * tz - vz * ty, wy = vy + vz * tx - vx * tz, wz = vz + vx * ty - vy * tx;
    vx += q * (wy * tz - wz * ty);
    vy += q * (wz * tx - wx * tz);
    vz += q * (wx * ty - wy * tx);
    x += vx * h;
    y += vy * h;
    z += vz * h;
    T -= h;
    const r2 = x * x + y * y + z * z;
    const u = CT * x - ST * z, dz = ST * x + CT * z;
    if (r2 < RS * RS) {
      // Into the sphere: a flash where it lands, dimmer on the far side,
      // and a new particle.
      const fw = dz > -2 ? 1 : 0.4;
      splat(S.fx, CX + u, CY - y, 4 * fw);
      for (let j = 0; j < 4; j++) splat(S.fx, CX + u + (j < 2 ? 2 * j - 1 : 0), CY - y + (j < 2 ? 0 : 2 * j - 5), 1.5 * fw);
      S.lost++;
      inject(S, i);
      return;
    }
    if (r2 > esc * esc) {
      S.esc++;
      inject(S, i);
      return;
    }
    if (dz < 0 && u * u + y * y < RS * RS) continue;
    splat(A, CX + u, CY - y, h * (0.45 + 0.55 * cl(0.5 + dz / (1.6 * LMAX), 0, 1)));
  }
  S.tc[i] = min(T, 0);
  S.rh[i] = rh;
  S.x[i] = x;
  S.y[i] = y;
  S.z[i] = z;
  S.vx[i] = vx;
  S.vy[i] = vy;
  S.vz[i] = vz;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  const en = cl(kv[2], 0, 1), pitch = cl(kv[3], 0, 90);
  // Energy: the field strength k sets the Størmer length sqrt(k) against
  // which the outermost shell sits at sOf(Energy). Changing it changes every
  // gyration at once, as a change of energy would.
  S.en = en;
  S.cst = LMAX / sOf(en);
  S.k = S.cst * S.cst;
  if (!S.started || abs(pitch - S.pitch) > 0.5) {
    S.pitch = pitch;
    if (!S.started) for (let i = 0; i < NP; i++) inject(S, i);
    else S.want.fill(1);
    S.started = true;
  }
  // A new pitch reaches the particles four a frame, each put back on its
  // shell with the new pitch angle.
  for (let i = 0, m = 0; i < NP && m < 4; i++) if (S.want[i]) inject(S, i), m++;
  const T = d * S.speed * RATE, f = exp(-d / 0.32), g = exp(-d / 0.25);
  const tp = S.tp, tn = S.tn, fx = S.fx;
  for (let i = 0; i < N; i++) (tp[i] *= f), (tn[i] *= f), (fx[i] *= g);
  for (let i = 0; i < NP; i++) push(S, i, T);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const c = S.c, e = S.d, cp = hsv(0.13 + S.hue, 0.75, 1, [0, 0, 0]), cn = hsv(0.56 + S.hue, 0.8, 1, [0, 0, 0]);
  hsv(0.69 + S.hue * 0.3, 0.55, 1, e);
  const tp = S.tp, tn = S.tn, fx = S.fx, fl = S.fl;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, dx = x - CX, dy = y - CY, r2 = dx * dx + dy * dy;
      const a = 1 - exp(-0.9 * tp[p]), b = 1 - exp(-0.9 * tn[p]), w = max(0, a + b - 1.1) * 0.6 + 0.9 * (1 - exp(-fx[p]));
      let r = a * cp[0] + b * cn[0], gg = a * cp[1] + b * cn[1], bb = a * cp[2] + b * cn[2];
      // Field lines underneath, and the sphere as a dark disc with a dim rim.
      const fv = r2 < RS * RS ? 0 : 0.16 * fl[p] * (1 - min(1, a + b));
      const rim = abs(sqrt(r2) - RS + 0.3) < 0.7 ? 0.14 : 0;
      r += fv * e[0] + rim + w;
      gg += fv * e[1] + rim + w;
      bb += fv * e[2] + rim + w;
      display.setPixel(x, y, min(255, r * 255) | 0, min(255, gg * 255) | 0, min(255, bb * 255) | 0);
    }
}
