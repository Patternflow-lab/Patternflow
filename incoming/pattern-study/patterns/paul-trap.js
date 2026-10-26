// ===== Patternflow pattern =====
// Title:   Paul Trap
// Family:  particle
// Idea:    Ions in a linear Paul trap whose axis runs the length of the panel repel each other into a Coulomb crystal, a zigzag when the RF is weak, a string of round dots when it is strong and a twisted three-dimensional crystal when more ions crowd in, each ion off the RF null smeared across the axis by its micromotion as a camera sees it, until past q = 0.908 the Mathieu equation has no stable solution and the ions boil out sideways while new ones load at the ends.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Mathieu equation (Émile Mathieu, 1868), the Paul trap (Wolfgang Paul, 1953), structural transitions of ion Coulomb crystals (Daniel Dubin, 1993; John Schiffer, 1993), the critical ratio of the zigzag (Daniel Enzer and others, 2000), pattern round 61
// Round:   61
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Ions=16..40, RF q=0.3..0.95
//
// Knob 1: Hue. Turns the fluorescence round the wheel. At 0 the ions are azure with pale cores, the near side of a 3D crystal cyan and the far side blue; at 0.25 violet, at 0.5 rose, at 0.75 green, then cyan back to azure. Orange and yellow are skipped, since they read brown and olive when dim.
// Knob 2: Speed. At 2 the simulation runs 38 RF periods a second: the oven fills an empty trap with 16 ions in half a second, they settle into a crystal by 1 s, and a knock from the background gas every 4 s or so melts part of it for a moment. At 0.2 ten times slower, so the first seconds show the load; at 3 half as fast again.
// Knob 3: Ions. 16 to 40 ions, two of them dark impurities that leave gaps. The end caps are set so that a string of that many ions would be 122 rows long. At q = 0.3, 16 ions make a flat zigzag and 20 a zigzag that twists toward the camera; from 28 up the crystal is a spindle of shells, 32 LEDs across and 79 rows tall at 40 ions, with the outer ions drawn as dashes by their micromotion. Enzer's ratio puts the string at q = 0.54 for 16 ions, 0.72 for 20 and 0.86 for 24, but above about 0.7 a crystal with ions off the axis heats itself in the RF and melts in patches, so from 24 up it never lines up cleanly.
// Knob 4: RF q. The Mathieu q of the drive, 0.3 to 0.95. At 0.3 sixteen ions make a zigzag 10 LEDs across; it narrows as q rises and lines up into a string of round dots between 0.50 and 0.54, which holds to 0.9 with a shiver near the end. At a = 0 nothing is stable past 0.908; the small static field that lays the zigzag flat splits that edge, so past 0.903 the ions fly out toward the camera and past 0.915 sideways, at 0.95 swinging 1.8 times wider every RF period, and the new ions the oven loads at the ends race inward and burst into smears. Turned back, the trap refills and cools into a crystal again, and a quick turn from string to zigzag can freeze in a kink where the zigzag changes sides.

const W = 64, H = 128, CX = 31.5, CY = 63.5, NMAX = 40;
const { floor, min, max, abs, sqrt, exp, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Units: lengths in LEDs, time tau = Omega t / 2, mass 1. In tau the radial
// equation is the Mathieu equation x'' + (a - 2 q cos 2 tau) x = F, and one
// RF period is pi. The step is a fortieth of it; velocity Verlet at that
// step puts the edge of stability at q = 0.9074 instead of 0.9081. With a
// twentieth the edge was 0.905 and a string of 16 ions melted at q = 0.9.
// RATE is tau per second at Speed 1.
const DT = PI / 40, RATE = 60;
// Half the length of a string of N ions in a harmonic well, for a Coulomb
// constant and an axial frequency of 1, from a relaxation run at N = 12, 16
// ... 48. The axial frequency for N ions is then chosen so that the string
// would reach SPAN LEDs either side of the centre.
const HALF = [3.2187, 3.8175, 4.3281, 4.7778, 5.1825, 5.5522, 5.8939, 6.2125, 6.5141, 6.7941];
const SPAN = 61;
// The Coulomb constant, in LED^3 / tau^2. With it the axial frequency for
// 16 ions is 0.050, and Enzer's critical ratio of radial to axial frequency,
// 0.73 N^0.86 = 7.9, asks for a radial frequency of 0.40, which the RF gives
// at q = 0.54. The simulated crystal straightens between 0.50 and 0.54.
const KC = 10.2;
// A small static quadrupole, a = -0.007 across the panel and +0.007 toward
// the camera, makes the picture plane the weaker radial direction, so the
// zigzag lies flat across the panel. At 0.005 it twisted out of the plane.
const AS = 0.007;
// Doppler cooling damps every bright ion's velocity at GAMMA per tau, and
// the recoil of the scattered photons heats it toward TEMP. The dark ions
// scatter nothing and are cooled only through their neighbours.
const GAMMA = 0.05, TEMP = 0.0012;
// Background gas: one ion takes a hard knock every COLL tau on average, 4.2 s
// at Speed 2, and the crystal melts round it and freezes again. An ion
// RLOST from the axis has reached an electrode. While the trap holds fewer
// ions than it should, the oven loads one every LOAD tau, at alternate ends.
const COLL = 500, KICK = 5, RLOST = 38, LOAD = 4;

// A gamma of 0.75 on the way out lifts the faint smears of hot ions.
const GAMMA_LUT = new Uint8Array(1024);
for (let i = 0; i < 1024; i++) GAMMA_LUT[i] = Math.round(255 * (i / 1023) ** 0.75);

function halfOf(n) {
  const f = cl((n - 12) / 4, 0, HALF.length - 1.001), i = floor(f);
  return HALF[i] + (HALF[i + 1] - HALF[i]) * (f - i);
}

// The fluorescence colour, hue h in turns, with orange and yellow (0.03
// to 0.2) skipped since they read brown and olive when dim.
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 0.83;
  if (h >= 0.03) h += 0.17;
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

const gauss = () => {
  let u = 1 - Math.random();
  return sqrt(-2 * Math.log(u)) * cos(2 * PI * Math.random());
};

export function setup(params) {
  const S = (params.s = {
    n: 0, target: 16, q: 0.3, tau: 0, wz: 0.047, ws: 0.047, nextColl: COLL, loadAt: 0, end: 1,
    x: new Float64Array(NMAX), y: new Float64Array(NMAX), z: new Float64Array(NMAX),
    vx: new Float64Array(NMAX), vy: new Float64Array(NMAX), vz: new Float64Array(NMAX),
    ax: new Float64Array(NMAX), ay: new Float64Array(NMAX), az: new Float64Array(NMAX),
    dark: new Uint8Array(NMAX),
    // Per frame sums of each ion's position, the camera's exposure.
    sx: new Float64Array(NMAX), sxx: new Float64Array(NMAX), sy: new Float64Array(NMAX), syy: new Float64Array(NMAX),
    sz: new Float64Array(NMAX), sn: new Float64Array(NMAX),
    rgb: new Float32Array(W * H * 3), gx: new Float32Array(W), hx: new Float32Array(W), gy: new Float32Array(H), hy: new Float32Array(H),
    hue: 0, c: [0, 0, 0], w: [0, 0, 0], started: false, loaded: 0, darkSet: false,
  });
  return S;
}

function axialFor(n) {
  return sqrt(KC) * (halfOf(n) / SPAN) ** 1.5;
}

function addIon(S, y, hot, dark) {
  const i = S.n++;
  S.x[i] = gauss() * hot;
  S.z[i] = gauss() * hot;
  S.y[i] = y;
  const v = hot * 0.06;
  S.vx[i] = gauss() * v;
  S.vz[i] = gauss() * v;
  S.vy[i] = gauss() * v;
  S.dark[i] = dark ? 1 : 0;
  S.sx[i] = S.sxx[i] = S.sy[i] = S.syy[i] = S.sz[i] = S.sn[i] = 0;
  return i;
}

function removeIon(S, i) {
  const j = --S.n;
  if (i === j) return;
  for (const a of [S.x, S.y, S.z, S.vx, S.vy, S.vz, S.ax, S.ay, S.az, S.dark, S.sx, S.sxx, S.sy, S.syy, S.sz, S.sn]) a[i] = a[j];
}

function darkCount(S) {
  let d = 0;
  for (let i = 0; i < S.n; i++) d += S.dark[i];
  return d;
}

// The acceleration of every ion at phase tau.
function forces(S, tau) {
  const n = S.n, x = S.x, y = S.y, z = S.z, ax = S.ax, ay = S.ay, az = S.az;
  const rf = 2 * S.q * cos(2 * tau), w2 = S.wz * S.wz;
  const kx = -w2 / 2 - AS - rf, kz = -w2 / 2 + AS + rf;
  for (let i = 0; i < n; i++) {
    ax[i] = -kx * x[i];
    az[i] = -kz * z[i];
    ay[i] = -w2 * y[i];
  }
  for (let i = 0; i < n; i++) {
    const xi = x[i], yi = y[i], zi = z[i];
    let fx = 0, fy = 0, fz = 0;
    for (let j = i + 1; j < n; j++) {
      const dx = xi - x[j], dy = yi - y[j], dz = zi - z[j];
      const r2 = dx * dx + dy * dy + dz * dz + 0.05, f = KC / (r2 * sqrt(r2));
      fx += f * dx;
      fy += f * dy;
      fz += f * dz;
      ax[j] -= f * dx;
      ay[j] -= f * dy;
      az[j] -= f * dz;
    }
    ax[i] += fx;
    ay[i] += fy;
    az[i] += fz;
  }
}

function step(S) {
  const n = S.n, h = DT;
  for (let i = 0; i < n; i++) {
    S.vx[i] += 0.5 * h * S.ax[i];
    S.vy[i] += 0.5 * h * S.ay[i];
    S.vz[i] += 0.5 * h * S.az[i];
    S.x[i] += h * S.vx[i];
    S.y[i] += h * S.vy[i];
    S.z[i] += h * S.vz[i];
  }
  S.tau += h;
  forces(S, S.tau);
  const kick = sqrt(2 * GAMMA * TEMP * h);
  for (let i = 0; i < n; i++) {
    S.vx[i] += 0.5 * h * S.ax[i];
    S.vy[i] += 0.5 * h * S.ay[i];
    S.vz[i] += 0.5 * h * S.az[i];
    if (S.dark[i]) continue;
    // Doppler cooling and the recoil of the scattered photons.
    const g = 1 - GAMMA * h;
    S.vx[i] = S.vx[i] * g + kick * (Math.random() - 0.5) * 3.46;
    S.vy[i] = S.vy[i] * g + kick * (Math.random() - 0.5) * 3.46;
    S.vz[i] = S.vz[i] * g + kick * (Math.random() - 0.5) * 3.46;
  }
  for (let i = 0; i < S.n; i++) {
    S.sx[i] += S.x[i];
    S.sxx[i] += S.x[i] * S.x[i];
    S.sy[i] += S.y[i];
    S.syy[i] += S.y[i] * S.y[i];
    S.sz[i] += S.z[i];
    S.sn[i]++;
  }
}

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const kv = input.knobValues || [0, 2, 16, 0.3], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  const speed = cl(kv[1], 0.2, 3);
  S.target = cl(Math.round(kv[2]), 16, NMAX);
  S.q = cl(kv[3], 0.3, 0.95);
  if (!S.started) {
    // The trap opens empty and the oven fills it from the ends.
    S.started = true;
    S.wz = S.ws = axialFor(S.target);
  }
  // The end caps follow the ion count with a time constant of 40 tau.
  S.ws = axialFor(S.target);
  for (let i = 0; i < S.n; i++) S.sx[i] = S.sxx[i] = S.sy[i] = S.syy[i] = S.sz[i] = S.sn[i] = 0;
  const steps = min(120, Math.round((d * speed * RATE) / DT));
  for (let k = 0; k < steps; k++) {
    S.wz += (S.ws - S.wz) * 0.002;
    step(S);
    // Losses: an ion that has reached an electrode or left past an end cap.
    for (let i = S.n - 1; i >= 0; i--)
      if (S.x[i] * S.x[i] + S.z[i] * S.z[i] > RLOST * RLOST || abs(S.y[i]) > 90 || !(abs(S.x[i]) < 1e6)) {
        removeIon(S, i);
        if (S.loadAt < S.tau) S.loadAt = S.tau + LOAD;
      }
    if (S.n > S.target && S.tau > S.loadAt) {
      // Fewer ions wanted: the end cap opens for the outermost one.
      let o = 0;
      for (let i = 1; i < S.n; i++) if (abs(S.y[i]) > abs(S.y[o])) o = i;
      removeIon(S, o);
      S.loadAt = S.tau + LOAD * 0.5;
    } else if (S.n < S.target && S.tau > S.loadAt) {
      // An atom is ionised on the axis at one end and comes in at 0.6 LEDs
      // per tau. After a loss a new ion is dark one time in ten while the
      // crystal holds fewer than two.
      S.end = -S.end;
      const dk = S.loaded >= S.target && darkCount(S) < 2 && Math.random() < 0.1;
      S.loaded++;
      const i = addIon(S, S.end * (SPAN * 0.95), 0.1, dk);
      S.vy[i] = -S.end * 0.6;
      S.loadAt = S.tau + LOAD;
    }
    // When the first load is in, the two ions nearest two fifths of the way
    // up and two fifths of the way down go dark, as after a reaction with the
    // background gas, so the gaps open inside the crystal.
    if (!S.darkSet && S.n === S.target) {
      S.darkSet = true;
      for (const yd of [-0.4 * SPAN, 0.4 * SPAN]) {
        let b = 0;
        for (let i = 1; i < S.n; i++) if (abs(S.y[i] - yd) < abs(S.y[b] - yd)) b = i;
        S.dark[b] = 1;
      }
    }
    if (S.tau > S.nextColl) {
      S.nextColl = S.tau - COLL * Math.log(1 - Math.random());
      if (S.n) {
        const i = floor(Math.random() * S.n);
        const ux = gauss(), uy = gauss(), uz = gauss(), u = sqrt(ux * ux + uy * uy + uz * uz) || 1;
        S.vx[i] += (KICK * ux) / u;
        S.vy[i] += (KICK * uy) / u;
        S.vz[i] += (KICK * uz) / u;
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, gx = S.gx, hx = S.hx, gy = S.gy, hy = S.hy, c = S.c, w = S.w, q = S.q;
  // Each frame keeps 40% of the last one, an exposure a little longer than a frame.
  for (let o = 0; o < rgb.length; o++) rgb[o] *= 0.4;
  for (let i = 0; i < S.n; i++) {
    if (S.dark[i] || !S.sn[i]) continue;
    const n = S.sn[i], mx = S.sx[i] / n, my = S.sy[i] / n, mz = S.sz[i] / n;
    // The spread over the exposure: secular motion as measured, and at
    // least the micromotion an ion at mx has, amplitude q mx / 2.
    const mm = (q * mx) / 2;
    const vxx = max(S.sxx[i] / n - mx * mx, (mm * mm) / 2), vyy = max(0, S.syy[i] / n - my * my);
    // Depth: toward the camera is brighter, bigger and paler.
    const dz = cl(mz / 10, -1, 1);
    const s0 = 0.8 + 0.18 * dz, sh = 3.3 + 0.5 * dz;
    const sx = sqrt(s0 * s0 + vxx), sy = sqrt(s0 * s0 + vyy), tx = sqrt(sh * sh + vxx), ty = sqrt(sh * sh + vyy);
    const spread = (s0 * s0) / (sx * sy);
    const lum = (0.72 + 0.28 * dz) * spread ** 0.25;
    hsv(0.46 + S.hue - 0.05 * dz, 0.85, 1, c);
    hsv(0.46 + S.hue - 0.05 * dz, 0.3 - 0.15 * dz, 1, w);
    const px = mx + CX, py = my + CY;
    const x0 = max(0, floor(px - 3 * tx)), x1 = min(W - 1, Math.ceil(px + 3 * tx));
    const y0 = max(0, floor(py - 3 * ty)), y1 = min(H - 1, Math.ceil(py + 3 * ty));
    if (x0 > x1 || y0 > y1) continue;
    for (let X = x0; X <= x1; X++) {
      const e = X - px;
      gx[X] = exp((-e * e) / (2 * sx * sx));
      hx[X] = exp((-e * e) / (2 * tx * tx));
    }
    for (let Y = y0; Y <= y1; Y++) {
      const e = Y - py;
      gy[Y] = exp((-e * e) / (2 * sy * sy));
      hy[Y] = exp((-e * e) / (2 * ty * ty));
    }
    const A = 0.75 * lum, B = 0.21 * lum;
    for (let Y = y0; Y <= y1; Y++)
      for (let X = x0; X <= x1; X++) {
        const core = A * gx[X] * gy[Y], halo = B * hx[X] * hy[Y], o = (Y * W + X) * 3;
        rgb[o] += core * w[0] + halo * c[0];
        rgb[o + 1] += core * w[1] + halo * c[1];
        rgb[o + 2] += core * w[2] + halo * c[2];
      }
  }
  for (let p = 0, o = 0; p < W * H; p++, o += 3)
    display.setPixel(p % W, (p / W) | 0, GAMMA_LUT[min(1023, (rgb[o] * 1023) | 0)], GAMMA_LUT[min(1023, (rgb[o + 1] * 1023) | 0)], GAMMA_LUT[min(1023, (rgb[o + 2] * 1023) | 0)]);
}
