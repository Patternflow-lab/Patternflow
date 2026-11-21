// ===== Patternflow pattern =====
// Title:   Kikuchi Bands
// Family:  ebsd
// Idea:    The backscatter diffraction pattern of a tumbling nickel-like crystal as an EBSD camera sees it, a dark blue ground crossed edge to edge by luminous bands, pale cyan for the {111} planes, violet for {200} and gold for {220}, with fainter and wider ones for the higher indices, where every band is the strip of directions within the Bragg angle of one set of lattice planes and the bands pile up into bright hubs wherever they meet at a zone axis, so that as the crystal turns the whole net slides, rotates and passes through itself without ever coming back.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kikuchi lines seen in transmission electron diffraction (Seishi Kikuchi, 1928), the Bragg condition for planes of spacing d (William Lawrence Bragg, 1913), wide-angle backscatter patterns photographed on film (Alam, Blackman and Pashley, 1954), the camera in the scanning electron microscope that became EBSD (Venables and Harland, 1973); pattern round 213
// Round:   215
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tumble=0..3, Voltage=-1..1, Stretch=-0.09..0.31
//
// Knob 1: Hue. Added to every hue in the picture, ground and bands together. At 0 the ground is dark blue, the {111} bands pale cyan, the {200} bands violet and the {220} bands gold. At 0.5 the cyan has gone to rose and the gold to blue, and at 1 it is back where it began.
// Knob 2: Tumble. How fast the crystal turns, 0.07 radians a second (4 degrees a second) for each unit of the knob, on average. At 0 the net stands still. At 2, where it opens, a band that crosses the screen straight on moves about 9 LEDs a second and a hub takes 6 to 14 seconds to cross the 64 LEDs of the width. At 3 it is a half faster again.
// Knob 3: Voltage. The wavelength of the electrons, as the beam voltage would set it. The bands are 2 theta_B wide, sin theta_B = lambda |g| / 2, so every band gets narrower as the voltage rises: the {111} band is 4.8 LEDs across at 0, 9 at -1 and 2.6 at 1, and the wider and fainter bands follow it in step. Bands of higher index also come in with the voltage, the highest order shown being {220} at -1, {400} at 0 and {422} at 1. The physical widths would be 1.75 times narrower than these at the same wavelength, which at 20 kV would leave the {111} bands under 3 LEDs, so the knob's zero is set to 0.0149 nm, the wavelength of electrons at about 6.8 kV, and the span of the knob is 1.9 kV to 24 kV.
// Knob 4: Stretch. The lattice is stretched along its c axis, c/a = 0.94 plus the knob, from 0.85 at -0.09 to 1.25 at 0.31 and cubic at the opening 0.06. A plane (h k l) now has the reciprocal vector (h/a, k/a, l/c), so a band whose index has an l in it narrows as c grows and the {200} and {111} families split into bands of different width, and the four-fold hubs lose their four-fold symmetry.

// What the picture is. A point source at the sample and a flat screen seen from it. A LED looks along the direction d,
// and the crystal turns by a rotation R, so that the plane normal n of a set of planes points along R n on the screen.
// The plane sends back a band where |d . n| < sin theta_B, the strip within the Bragg angle of the plane, and the
// strip of one plane family is a great circle on the sphere of directions, seen on the screen as a stripe.
// Planes that are all odd or all even in (h k l) are the ones a face-centred lattice lets through. The 84 of them up to
// order 27 in h2 + k2 + l2 are made once. A plane's band is lit with exp(-(N - 3) / 9) of the strength of {111}, N being
// h2 + k2 + l2, and is shown at all only when N is below a limit that rises with the voltage.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, abs, exp, sin, cos, tan, atan, asin, PI, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the screen
const KAPPA = 0.6; // radius on the screen = tan(KAPPA r) / KAPPA, r the angle from the axis: 1 is gnomonic, 0 is equidistant
const HALF_X = (27.5 * PI) / 180; // the angle from the axis to the middle of the left and right edges
const RHO_X = tan(KAPPA * HALF_X) / KAPPA;
const PPU = 31.5 / RHO_X; // LEDs to a radian near the axis
const DX = new Float32Array(NPX), DY = new Float32Array(NPX), DZ = new Float32Array(NPX);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const X = (x - 31.5) / PPU, Y = (y - 63.5) / PPU, rho = sqrt(X * X + Y * Y);
    const r = rho > 1e-9 ? atan(KAPPA * rho) / KAPPA : 0, s = rho > 1e-9 ? sin(r) / rho : 1;
    const i = y * W + x;
    DX[i] = X * s;
    DY[i] = Y * s;
    DZ[i] = cos(r);
  }

// ---- the crystal
const LAMBDA0 = 0.0149 / 0.352; // wavelength in units of the lattice constant a (nickel, a = 0.352 nm)
const NMAX_AT = (k3) => 15 + 8 * k3; // the highest h2 + k2 + l2 shown, at the voltage knob k3
const PLANES = [];
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
for (let h = 0; h <= 5; h++)
  for (let k = -5; k <= 5; k++)
    for (let l = -5; l <= 5; l++) {
      const n2 = h * h + k * k + l * l;
      if (n2 === 0 || n2 > 27) continue;
      if (h === 0 && (k < 0 || (k === 0 && l < 0))) continue;
      if (((h ^ k ^ l) & 1) !== 0 || ((h + 1) & 1) !== ((k + 1) & 1) || ((k + 1) & 1) !== ((l + 1) & 1)) continue;
      const g = gcd(gcd(h, abs(k)), abs(l)), p = [h / g, abs(k) / g, abs(l) / g].sort((a, b) => b - a).join("");
      PLANES.push({ h, k, l, n2, fam: p, w: exp(-(n2 - 3) / 9) });
    }
// Colour of a family, as hue, saturation and a gain. The orders of one set of planes, {222} of {111} and {400} of {200}, share it.
const FAMILY = {
  111: [0.5, 0.3, 1.0],
  100: [0.74, 0.62, 1.0],
  110: [0.115, 0.7, 1.0],
  311: [0.93, 0.5, 1.0],
  331: [0.4, 0.45, 1.0],
  210: [0.6, 0.5, 1.0],
  211: [0.84, 0.4, 1.0],
};
for (const p of PLANES) p.col = FAMILY[p.fam] || [0.55, 0.15, 1.0];

// zone axes [u v w], up to sign: where the bands whose planes contain the axis cross
const ZONES = [];
for (let u = 0; u <= 2; u++)
  for (let v = -2; v <= 2; v++)
    for (let w = -2; w <= 2; w++) {
      const n2 = u * u + v * v + w * w;
      if (n2 === 0 || n2 > 9) continue;
      if (u === 0 && (v < 0 || (v === 0 && w < 0))) continue;
      if (gcd(gcd(u, abs(v)), abs(w)) !== 1) continue;
      ZONES.push({ u, v, w, n2, wt: n2 <= 1 ? 1 : n2 <= 2 ? 0.85 : n2 <= 3 ? 0.75 : n2 <= 6 ? 0.4 : 0.22 });
    }

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- the tumble: an angular velocity that is a constant plus three sines on each axis, every one with its own period
const BIAS = [0.5, -0.12, 0.2];
const WAVES = [
  [[0.9, 23.7, 0.4], [0.55, 41.3, 2.1], [0.35, 67.9, 4.4]],
  [[0.8, 29.9, 1.2], [0.5, 47.1, 3.3], [0.3, 83.3, 0.2]],
  [[0.7, 19.1, 5.0], [0.45, 37.7, 1.9], [0.3, 59.3, 3.7]],
];
const OMEGA = 0.045; // radians a second for each unit of Tumble, per unit of the sum above

function omegaAt(tau, out) {
  for (let a = 0; a < 3; a++) {
    let s = BIAS[a];
    for (const [amp, per, ph] of WAVES[a]) s += amp * sin((2 * PI * tau) / per + ph);
    out[a] = s * OMEGA;
  }
}

function makeState() {
  return {
    q: [0.8, 0.3, -0.2, 0.5], tau: 0, omega: [0, 0, 0],
    kn: [0, 2, 0, 0.06],
    R: new Float64Array(9),
    ar: new Float32Array(NPX), ag: new Float32Array(NPX), ab: new Float32Array(NPX),
  };
}

function normalise(q) {
  const n = 1 / sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
  q[0] *= n; q[1] *= n; q[2] *= n; q[3] *= n;
}

function matrixOf(q, R) {
  const [w, x, y, z] = q;
  R[0] = 1 - 2 * (y * y + z * z); R[1] = 2 * (x * y - w * z); R[2] = 2 * (x * z + w * y);
  R[3] = 2 * (x * y + w * z); R[4] = 1 - 2 * (x * x + z * z); R[5] = 2 * (y * z - w * x);
  R[6] = 2 * (x * z - w * y); R[7] = 2 * (y * z + w * x); R[8] = 1 - 2 * (x * x + y * y);
}

export function setup(params) {
  const S = (params.s = makeState());
  normalise(S.q);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  S.tau += d;
  const k2 = cl(kn[1], 0, 3), om = S.omega;
  omegaAt(S.tau, om);
  const wx = om[0] * k2, wy = om[1] * k2, wz = om[2] * k2, q = S.q;
  const [a, b, c, e] = q, h = 0.5 * d;
  q[0] = a + h * (-wx * b - wy * c - wz * e);
  q[1] = b + h * (wx * a + wy * e - wz * c);
  q[2] = c + h * (wy * a + wz * b - wx * e);
  q[3] = e + h * (wz * a + wx * c - wy * b);
  normalise(q);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const kn = S.kn, hue = cl(kn[0], 0, 1), k3 = cl(kn[2], -1, 1), ca = 0.94 + cl(kn[3], -0.09, 0.31);
  const { ar, ag, ab, R } = S;
  matrixOf(S.q, R);
  ar.fill(0); ag.fill(0); ab.fill(0);
  const lam = LAMBDA0 * Math.pow(3.5, -0.5 * k3) * 1.0, nmax = NMAX_AT(k3), rgb = [0, 0, 0];

  for (let pi = 0; pi < PLANES.length; pi++) {
    const P = PLANES[pi];
    const vis = 1 - sm(nmax - 3, nmax + 3, P.n2);
    if (vis <= 0.004) continue;
    const gx = P.h, gy = P.k, gz = P.l / ca, gl = sqrt(gx * gx + gy * gy + gz * gz);
    const nx = (R[0] * gx + R[1] * gy + R[2] * gz) / gl, ny = (R[3] * gx + R[4] * gy + R[5] * gz) / gl, nz = (R[6] * gx + R[7] * gy + R[8] * gz) / gl;
    const hw = min(0.5 * lam * gl, 0.45), cut = hw * 1.5, inv = 1 / hw;
    hsv(hue + P.col[0], P.col[1], 1, rgb);
    const amp = P.w * vis, cr = rgb[0] * amp, cg = rgb[1] * amp, cb = rgb[2] * amp;
    for (let i = 0; i < NPX; i++) {
      const a = abs(DX[i] * nx + DY[i] * ny + DZ[i] * nz);
      if (a > cut) continue;
      const u = a * inv;
      const fill = 1 - sm(0.8, 1.2, u);
      const e = (u - 1) / 0.45, ridge = exp(-e * e);
      const f = 0.55 * fill + 0.45 * ridge;
      ar[i] += cr * f; ag[i] += cg * f; ab[i] += cb * f;
    }
  }

  // zone axes: a soft glow where the bands cross
  for (let zi = 0; zi < ZONES.length; zi++) {
    const Z = ZONES[zi];
    const ux = Z.u, uy = Z.v, uz = Z.w * ca, ul = sqrt(ux * ux + uy * uy + uz * uz);
    const tx = (R[0] * ux + R[1] * uy + R[2] * uz) / ul, ty = (R[3] * ux + R[4] * uy + R[5] * uz) / ul, tz = (R[6] * ux + R[7] * uy + R[8] * uz) / ul;
    for (let sgn = -1; sgn <= 1; sgn += 2) {
      const sx = tx * sgn, sy = ty * sgn, sz = tz * sgn;
      if (sz < 0.3) continue;
      const r = Math.acos(cl(sz, -1, 1)), sr = sin(r), rho = tan(KAPPA * r) / KAPPA;
      const cx = 31.5 + (sr > 1e-6 ? (rho * sx) / sr : 0) * PPU, cy = 63.5 + (sr > 1e-6 ? (rho * sy) / sr : 0) * PPU;
      const rad = 7, x0 = max(0, floor(cx - rad)), x1 = min(W - 1, floor(cx + rad) + 1), y0 = max(0, floor(cy - rad)), y1 = min(H - 1, floor(cy + rad) + 1);
      const sig = 3.2 / PPU;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const i = y * W + x;
          const dd = 2 * (1 - (DX[i] * sx + DY[i] * sy + DZ[i] * sz)), q = dd / (sig * sig);
          if (q > 4) continue;
          const g = Z.wt * 0.55 * exp(-q);
          ar[i] += g; ag[i] += g * 0.92; ab[i] += g * 0.8;
        }
    }
  }

  // ground and tone
  const g0 = [0, 0, 0];
  hsv(hue + 0.64, 0.8, 1, g0);
  for (let i = 0; i < NPX; i++) {
    const env = 0.7 + 0.3 * DZ[i];
    const base = 0.07 * env;
    const r = base * g0[0] * 0.5 + (1 - base * g0[0] * 0.5) * tone(ar[i]);
    const g = base * g0[1] * 0.5 + (1 - base * g0[1] * 0.5) * tone(ag[i]);
    const b = base * g0[2] * 0.9 + (1 - base * g0[2] * 0.9) * tone(ab[i]);
    display.setPixel(i % W, (i / W) | 0, (r * 255 + 0.5) | 0, (g * 255 + 0.5) | 0, (b * 255 + 0.5) | 0);
  }
}

function tone(c) {
  return c <= 0 ? 0 : 1 - 1 / (1 + 1.4 * c + 0.7 * c * c);
}
