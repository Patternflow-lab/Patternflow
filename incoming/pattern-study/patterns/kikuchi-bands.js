// ===== Patternflow pattern =====
// Title:   Kikuchi Bands
// Family:  ebsd
// Idea:    The Kikuchi pattern an EBSD camera sees when an electron beam strikes a tumbling nickel-like crystal, a dark blue screen crossed edge to edge by luminous bands that are the strips of directions within the Bragg angle of each set of lattice planes, pale cyan for the {111} planes and violet for {200}, gold for {220} and fainter and wider for the higher indices, which pile up into bright hubs at the zone axes where four or six bands cross, while the crystal turns about a wandering axis so that the whole net slides, rotates and passes through itself without coming back.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kikuchi lines seen in transmission electron diffraction (Seishi Kikuchi, 1928), the Bragg condition for planes of spacing d (William Lawrence Bragg, 1913), wide-angle backscatter patterns photographed on film (Alam, Blackman and Pashley, 1954), the camera in the scanning electron microscope that became EBSD (Venables and Harland, 1973); pattern round 213
// Round:   215
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tumble=0..3, Voltage=-1..1, Stretch=-0.14..0.38
//
// Knob 1: Hue. Added to every hue in the picture, ground and bands together. At 0 the ground is dark blue, the {111} bands pale cyan, the {200} bands violet and the {220} bands gold. At 0.5 the {111} bands are pale rose, the {200} bands yellow-green, the {220} bands blue and the ground a dark olive, and at 1 it is back where it began.
// Knob 2: Tumble. How fast the crystal turns, 0.045 radians a second (2.6 degrees a second) for each unit of the knob, about an axis that wanders over the sphere, with the speed swelling and ebbing between 0.45 and 1.55 of that over 37 seconds. At 0 the net stands still. At 2, where it opens, the crystal turns 5.1 degrees a second on average, from 2.3 to 8, so the bands near the middle of the screen slide 5.7 LEDs a second on average (2.6 to 8.9) and a hub takes about 11 seconds to cross the 64 LEDs of the width. At 3 it is a half faster again.
// Knob 3: Voltage. The wavelength of the electrons, as the beam voltage sets it, sin theta_B = lambda |g| / 2 for a band of reciprocal vector g, so every band gets narrower as the voltage rises. The screen sees 55 by 103 degrees at 63.8 LEDs to the radian, and at the opening the wavelength is 0.0108 nm, the wavelength of 12.7 kV (20 kV is 0.0086 nm), where the {111} band is 3.4 LEDs across and the {220} band 5.6. At -1 the wavelength is 1.87 times longer (3.7 kV) and the {111} band 6.3 LEDs across. At 1 it is 1.62 times shorter (32.8 kV) and the {111} band 2.1 LEDs, the thinnest band there is. The highest order shown is {220} at -1, {222} at 0 and {420} at 1, and the high orders are lit more at the fine end, the strength of a band of N = h2 + k2 + l2 falling as exp(-(N - 3) / L) with L = 3 at -1, 4.5 at 0 and 6 at 1.
// Knob 4: Stretch. The lattice is stretched along its c axis, c/a = 0.94 plus the knob, so 0.80 at -0.14, 1.32 at 0.38 and cubic at 0.06, where the Lab opens it. A plane (h k l) has the reciprocal vector (h/a, k/a, l/c), so a family splits. The (002) band is 4.9 LEDs wide at c/a 0.80, 3.9 at 1 and 3.0 at 1.32, while (200) stays at 3.9, and the hue of a band moves by 0.6 times the change in its |g| as a fraction, which takes the (002) violet to magenta at 0.80 and to blue at 1.32. The bands still meet at zone axes, but at other angles, so the six-armed star of a [111] hub goes uneven and the four-armed [100] hub loses its four-fold look.

// What the picture is. A point source at the sample and a flat screen seen from it. A LED looks along the direction d, and
// the crystal turns by a rotation R, so that the normal n of a set of planes points along R n on the screen. The planes send
// back a band where |d . n| < sin theta_B, the strip within the Bragg angle of the planes. That strip is a great circle on
// the sphere of directions, seen on the screen as a stripe. The screen is the sphere laid out with radius tan(0.6 r) / 0.6 for
// an angle r from the axis (1 would be gnomonic, which keeps every band straight and stretches it near the edge, and 0
// equidistant), 63.8 LEDs to the radian at the middle, 27.5 degrees to the side edges and 51.4 to the top and bottom. The
// bands bend a little at the corners, and a band grows to at most 1.45 times its width at the middle.
// Planes whose (h k l) are all odd or all even are the ones a face-centred lattice lets through. The 84 of them up to 27 in
// h2 + k2 + l2 are made once. A band is drawn as a flat strip of 45 percent strength with soft shoulders and a ridge of 62
// percent along each edge, 0.85 LEDs in sigma at least, so that a band reads as a lit strip with bright edges, which is how the
// lines of a Kikuchi pattern show. The strength falls with N and the bands add, so that a crossing is brighter than
// either band and a zone axis, where several cross, is the brightest place. A soft glow, 2.6 LEDs in sigma, sits on each zone
// axis [u v w] with u2 + v2 + w2 up to 9 (49 of them, each with its opposite), at strength 1 for [100], 0.85 for [110], 0.75 for
// [111], 0.4 for the next 24 and 0.22 for the last 12. The ground is a dark blue of about (5, 8, 32), a little brighter at the middle.
// The opening orientation was picked from 6000 random ones for a [111], a [100] and a [110] hub inside the panel at once.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, abs, exp, sin, cos, tan, atan, PI, min, max } = Math;
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
const LAMBDA0 = 0.01083 / 0.352; // wavelength in units of the lattice constant a (nickel, a = 0.352 nm)
const NMAX_AT = (k3) => (k3 < 0 ? 13 + 4 * k3 : 13 + 9 * k3); // the highest h2 + k2 + l2 shown, at the voltage knob k3
const PLANES = [];
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
for (let h = 0; h <= 5; h++)
  for (let k = -5; k <= 5; k++)
    for (let l = -5; l <= 5; l++) {
      const n2 = h * h + k * k + l * l;
      if (n2 === 0 || n2 > 27) continue;
      if (h === 0 && (k < 0 || (k === 0 && l < 0))) continue;
      if ((h & 1) !== (abs(k) & 1) || (abs(k) & 1) !== (abs(l) & 1)) continue;
      const g = gcd(gcd(h, abs(k)), abs(l)), p = [h / g, abs(k) / g, abs(l) / g].sort((a, b) => b - a).join("");
      PLANES.push({ h, k, l, n2, fam: p, w: n2 - 3 });
    }
// Colour of a family, as hue, saturation and a gain. The orders of one set of planes, {222} of {111} and {400} of {200}, share it.
const FAMILY = {
  111: [0.5, 0.32, 1.0],
  100: [0.72, 0.7, 1.0],
  110: [0.12, 0.68, 1.5],
  311: [0.93, 0.5, 0.38],
  331: [0.4, 0.45, 0.8],
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

// ---- the tumble: the axis the crystal turns about wanders over the sphere and the speed swells and ebbs, each on its own period
const AXIS = [[0.9, 31.7, 0.7], [0.45, 52.9, 2.4]]; // amplitude in radians, period in seconds, phase: the polar angle of the axis
const SPIN = [2 * PI / 77.3, 0.8, 3.1, 0.9, 43.1]; // the azimuth runs 2 pi in 77.3 s and swings 0.8 rad every 43.1 s
const SWELL = [0.55, 37.3, 1.9]; // the speed is 1 plus 0.55 sin(...) of the nominal
const OMEGA = 0.045; // radians a second for each unit of Tumble, at the nominal speed

function omegaAt(tau, out) {
  const pol = 0.5 * PI + AXIS[0][0] * sin((2 * PI * tau) / AXIS[0][1] + AXIS[0][2]) + AXIS[1][0] * sin((2 * PI * tau) / AXIS[1][1] + AXIS[1][2]);
  const azi = SPIN[0] * tau + SPIN[1] * sin((2 * PI * tau) / SPIN[4] + SPIN[2]) + SPIN[3];
  const m = OMEGA * (1 + SWELL[0] * sin((2 * PI * tau) / SWELL[1] + SWELL[2])), sp = sin(pol);
  out[0] = m * sp * cos(azi);
  out[1] = m * sp * sin(azi);
  out[2] = m * cos(pol);
}

function makeState() {
  return {
    q: [0.151, 0.208, -0.358, 0.898], tau: 0, omega: [0, 0, 0],
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
  const kn = S.kn, hue = cl(kn[0], 0, 1), k3 = cl(kn[2], -1, 1), ca = 0.94 + cl(kn[3], -0.14, 0.38);
  const { ar, ag, ab, R } = S;
  matrixOf(S.q, R);
  ar.fill(0); ag.fill(0); ab.fill(0);
  const lam = LAMBDA0 * Math.pow(2, k3 < 0 ? -0.9 * k3 : -0.7 * k3), nmax = NMAX_AT(k3), rgb = [0, 0, 0], decay = 3 + 1.5 * (k3 + 1);

  for (let pi = 0; pi < PLANES.length; pi++) {
    const P = PLANES[pi];
    const vis = 1 - sm(nmax - 2, nmax + 2, P.n2);
    if (vis <= 0.004) continue;
    const gx = P.h, gy = P.k, gz = P.l / ca, gl = sqrt(gx * gx + gy * gy + gz * gz);
    const nx = (R[0] * gx + R[1] * gy + R[2] * gz) / gl, ny = (R[3] * gx + R[4] * gy + R[5] * gz) / gl, nz = (R[6] * gx + R[7] * gy + R[8] * gz) / gl;
    const hw = min(0.5 * lam * gl, 0.45), sg = max(0.3 * hw, 0.85 / PPU), cut = max(1.15 * hw, hw + 1.7 * sg), inv = 1 / hw, isg = 1 / sg;
    hsv(hue + P.col[0] + 0.6 * (gl / sqrt(P.n2) - 1), P.col[1], 1, rgb);
    const amp = exp(-P.w / decay) * vis * P.col[2], cr = rgb[0] * amp, cg = rgb[1] * amp, cb = rgb[2] * amp;
    for (let i = 0; i < NPX; i++) {
      const a = abs(DX[i] * nx + DY[i] * ny + DZ[i] * nz);
      if (a > cut) continue;
      const fill = 1 - sm(0.85, 1.15, a * inv);
      const e = (a - hw) * isg, ridge = exp(-e * e);
      const f = 0.45 * fill + 0.62 * ridge;
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
      const sig = 2.6 / PPU;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const i = y * W + x;
          const dd = 2 * (1 - (DX[i] * sx + DY[i] * sy + DZ[i] * sz)), q = dd / (sig * sig);
          if (q > 4) continue;
          const g = Z.wt * 0.4 * exp(-q);
          ar[i] += g; ag[i] += g * 0.92; ab[i] += g * 0.8;
        }
    }
  }

  // ground and tone
  const g0 = [0, 0, 0];
  hsv(hue + 0.645, 0.85, 0.125, g0);
  for (let i = 0; i < NPX; i++) {
    const env = 0.7 + 0.3 * DZ[i];
    const r0 = g0[0] * env, g1 = g0[1] * env, b0 = g0[2] * env;
    const r = r0 + (1 - r0) * tone(ar[i]);
    const g = g1 + (1 - g1) * tone(ag[i]);
    const b = b0 + (1 - b0) * tone(ab[i]);
    display.setPixel(i % W, (i / W) | 0, (r * 255 + 0.5) | 0, (g * 255 + 0.5) | 0, (b * 255 + 0.5) | 0);
  }
}

function tone(c) {
  return c <= 0 ? 0 : 1 - 1 / (1 + 1.8 * c + 1.2 * c * c);
}
