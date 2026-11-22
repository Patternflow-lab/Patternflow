// ===== Patternflow pattern =====
// Title:   Isogyres
// Family:  conoscopy
// Idea:    The interference figure of a thin crystal plate in convergent light between crossed polarizers, each LED one direction through the plate, so that rings of Michel-Lévy colour close round the points where an optic axis comes out and a dark brush crosses them, while the plate turns on its stage and its axes tilt and spread, the brush splitting from a cross into two hyperbolas and closing again on slow cycles that share no common period.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: chromatic polarization of thin plates of mica and quartz (François Arago, 1811), rings crossed by a black bar in topaz and the laws for two-axis crystals (David Brewster, 1813 and 1818), the interference colour chart (Auguste Michel-Lévy and Alfred Lacroix, 1888), the optical indicatrix (Lazarus Fletcher, 1892), the multi-lobe fit of the CIE 1931 colour matching functions (Chris Wyman, Peter-Pike Sloan and Peter Shirley, 2013); pattern round 215
// Round:   217
// ===============================
// @matrix 64x128
// @knobs Tint=0..1, Stage=0..4, Optic=0..1, Aperture=0.72..0.96
//
// Knob 1: Tint. A retarder plate behind the crystal, its slow axis at 45 degrees to the polarizers, Tint x 900 nm thick in retardation. At 0 there is no plate and the brush is black. As it grows the colour of the brush walks along the interference series: 0.2 pale blue-white, 0.3 white, 0.4 pale yellow, 0.5 amber, 0.6 purple (540 nm, the sensitive tint), 0.67 blue, 0.75 sky blue, 0.9 pale yellow-green and 1 yellow (900 nm). The rings go with it, because where the crystal's slow axis lies along the plate's the two add and where it lies across them they subtract, so opposite quadrants of the figure are two plate retardations apart.
// Knob 2: Stage. How fast the stage turns the crystal about the plate's normal, 0.07 radians a second (4 degrees a second) for each unit of the knob, times a swell of 1 plus 0.45 sin plus 0.25 sin that ebbs to 0.3 and rises to 1.7 on periods of 43.7 and 17.9 s. At 0 the stage stands, and the figure still changes, because the tilt, the optic angle, the thickness, the lamp and the focus keep wandering. At 2, where it opens, the turn is 8 degrees a second on average, 2.4 to 13.6, so a turn takes 45 s and a melatope 36 LEDs from the middle (the tilt's average at an aperture of 0.72) moves 5 LEDs a second, 1.5 to 8.5. At 4 it is twice that.
// Knob 3: Optic. The half optic angle V of the crystal, the angle between the bisectrix and each optic axis, 9 plus 8 x Optic degrees, with a wander of 6 plus 3 x Optic degrees either way on periods of 53.7, 21.9 and 11.3 s. At 0 V runs between 3 and 15 degrees, so the angle between the axes, 2V, between 6 and 30 degrees, and the two melatopes lie 7 to 36 LEDs either side of the point where the bisectrix comes out (99.2 sin V / NA LEDs, at an aperture of 0.72). The brush is then a cross that opens into two hyperbolas as the stage turns the optic plane off the polarizers and shuts again. At 1 V runs from 8 to 26 degrees, the melatopes 19 to 60 LEDs out, so one or both of them leave the panel for part of each turn and the brush crosses it as a single curved band. The angle is 8 percent wider in blue light than in red, so the edge of the brush has a blue and an orange fringe about 1 to 3 LEDs wide.
// Knob 4: Aperture. The numerical aperture of the objective. The 64 LEDs from the middle to the top edge take sin of the angle in air from 0 to this number, 0.72 to 0.96, so the 128 rows hold 92 degrees of rays at 0.72 and 147 at 0.96, and the 64 columns 42 and 57. Inside the crystal (index 1.55) the top edge is 27.7 to 38.3 degrees off the normal. The retardation grows with sin squared of the angle from the axis over the cosine, so the rings pack tighter outward and with the aperture: for a plate 4000 nm thick the LED of highest order has 4.0 orders at 0.72 (median over 5 minutes, 6.2 at most) and 6.6 at 0.96 (9.5 at most), and the narrowest order is 8.3 LEDs wide at 0.72 and 3.2 at 0.96. The melatopes slide in toward the middle as the aperture opens, by 25 percent over the knob.

// What the picture is. A plate of a biaxial crystal 4000 nm thick in retardation (a quartz-like 0.44 mm at a birefringence of 0.009)
// sits between a polarizer along the panel's x axis and an analyzer along y. A condenser sends a cone of light through the spot,
// so one LED is one ray, and the panel is a window on directions: a LED at distance r from the middle has sin(angle in air) =
// NA r / 64, and the angle theta inside the crystal is sin theta = NA r / (64 x 1.55). At the corners r is 71.5, so their
// rays are 12 percent further out than the top edge's.
// For the ray along n the polarizer lets through light vibrating along e1, the projection of x on the wavefront, and the analyzer
// takes e2 = n x e1. The crystal is the index ellipsoid, 1/n^2 = (1, cos^2 V, 0) in units of the full birefringence along its
// axes u1, u2 and u3, where u3 is the acute bisectrix and V half the optic angle. The two waves along n vibrate along the axes of
// the ellipse the wavefront cuts from it, the eigenvectors of the 2 x 2 matrix M_ij = e_i (u1 u1 + cos^2 V u2 u2) e_j, and the
// retardation is
//   gamma = (4000 nm / cos theta) sqrt((M11 - M22)^2 + 4 M12^2).
// For V = 0 that is 4000 nm sin^2(psi) / cos theta, psi the angle between the ray and the one optic axis. The slow axis lies at the
// angle a to e1 with cos 2a = -(M11 - M22) / D and sin 2a = -2 M12 / D, D the square root. At the melatopes, where an optic
// axis comes out, D is 0 and so is gamma. The brush is where sin 2a is 0, the slow axis along e1 or e2.
// With the tint plate (retardation Tint x 900 nm at 45 degrees) behind the crystal the light is turned twice on the Poincare
// sphere, and at the wavelength l the intensity is
//   I = 1/2 [1 - (cos^2 2a + sin^2 2a cos d) cos dt + sin 2a sin d sin dt],  d = 2 pi gamma / l, dt = 2 pi Tint 900 / l.
// With no plate dt is 0 and this is sin^2 2a sin^2(pi gamma / l). I is summed over 24 wavelengths, 405 to 692.5 nm in 12.5 nm
// steps, each weighted by its share of red, green and blue from the multi-lobe fit of the CIE 1931 matching functions, normalised
// so that all of them let through at once make white. The series of interference colours is not stored anywhere. It is what that
// sum gives as gamma grows: black, grey, white, yellow, amber, purple, blue, green and so on, paling to pink and green from about
// 4 orders. The oscillating terms are cut by sinc(pi 1.2 |grad gamma| / l), the average over a LED 1.2 wide, so that a ring
// 3 LEDs wide does not alias.
// The optic angle disperses. The 24 wavelengths are in three bands of eight, and the figure of each is made with V times 1.08,
// 1 and 0.92 for blue, green and red.
// The crystal's axes come from the stage angle b, the tilt t of the bisectrix from the normal, and the angle z of the optic
// plane about the bisectrix. The bisectrix is u3 = (sin t cos b, sin t sin b, cos t) and the stage turns b. All of them
// wander on sums of sines with periods that share no factor, so no picture comes back unless six numbers do at once:
//   tilt   30 degrees x (0.5 + 0.46 w), 1.2 to 28.8 degrees, on 67.1, 29.3 and 13.7 s
//   z      once round in 83.7 s, swinging up to 1.7 radians on 61.7 and 17.9 s
//   V      as Knob 3 says
//   thickness, 4000 nm x (1 + w) with w up to 0.30 on 311.7, 71.3 and 33.7 s, which is a wedge the stage slides under the spot
//   focus  the aperture times 1 + 0.07 w on 47.9 and 19.7 s
// and the lamp's colour temperature tilts the weight of each wavelength by up to 15 percent per 150 nm, on 97.3 and 41.1 s,
// while its brightness swells 7 percent on 53.3 and 23.1 s. w is a sum of sines of weights adding to 1 and so lies in -1 to 1.

const W = 64, H = 128, NPX = W * H;
const { sqrt, sin, cos, PI, max, exp, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- the light: NW wavelengths with their share of red, green and blue
const NW = 24;
const LAM = [];
for (let n = 0; n < NW; n++) LAM.push(405 + 12.5 * n);
const WT = new Float64Array(NW * 3);
{
  const g = (l, m, a, b) => exp(-0.5 * pow((l - m) / (l < m ? a : b), 2));
  for (let n = 0; n < NW; n++)
    for (let j = 0; j < 5; j++) {
      const l = LAM[n] + (j - 2) * 2.5;
      const x = 1.056 * g(l, 599.8, 37.9, 31) + 0.362 * g(l, 442, 16, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
      const y = 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
      const z = 1.217 * g(l, 437, 11.8, 36) + 0.681 * g(l, 459, 26, 13.8);
      WT[n * 3] += 3.2406 * x - 1.5372 * y - 0.4986 * z;
      WT[n * 3 + 1] += -0.9689 * x + 1.8758 * y + 0.0415 * z;
      WT[n * 3 + 2] += 0.0557 * x - 0.204 * y + 1.057 * z;
    }
  for (let c = 0; c < 3; c++) {
    let s = 0;
    for (let n = 0; n < NW; n++) s += WT[n * 3 + c];
    for (let n = 0; n < NW; n++) WT[n * 3 + c] /= s;
  }
}
const C2 = new Float32Array(NW), S2 = new Float32Array(NW), WN = new Float32Array(NW * 3);
const TS = 4096;
const COS = new Float32Array(TS), SIN = new Float32Array(TS);
for (let i = 0; i < TS; i++) {
  COS[i] = cos((i * TAU) / TS);
  SIN[i] = sin((i * TAU) / TS);
}
const KI = LAM.map((l) => TS / l); // a retardation in nm to a step of the circle
const ENC = new Uint8Array(1025);
for (let i = 0; i <= 1024; i++) {
  const v = i / 1024;
  ENC[i] = Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055));
}

// ---- the panel as directions through the plate
const NBAR = 1.55; // mean index of the crystal
const DISP = 0.08; // how much the optic angle differs between blue and red light, as a share of it
const RHALF = 64; // LEDs from the middle to the top and bottom edge
const RR = new Float32Array(NPX), CP = new Float32Array(NPX), SP = new Float32Array(NPX);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const dx = x - 31.5, dy = y - 63.5, r = sqrt(dx * dx + dy * dy), i = y * W + x;
    RR[i] = r / RHALF;
    CP[i] = r > 1e-6 ? dx / r : 1;
    SP[i] = r > 1e-6 ? dy / r : 0;
  }

// Slow wanderers: a sum of sines, each [weight, period in s, phase]. The periods share no common factor.
const wob = (t, a) => {
  let v = 0;
  for (let i = 0; i < a.length; i++) v += a[i][0] * sin((TAU * t) / a[i][1] + a[i][2]);
  return v;
};
const W_TILT = [[0.4, 67.1, 5.57], [0.35, 29.3, 5.41], [0.25, 13.7, 0.62]];
const W_OPT = [[0.4, 53.7, 3.62], [0.35, 21.9, 0.28], [0.25, 11.3, 3.24]];
const W_ZETA = [[1.2, 61.7, 2.65], [0.5, 17.9, 3.96]];
const W_THICK = [[0.14, 311.7, 3.57], [0.1, 71.3, 4.56], [0.06, 33.7, 1.28]];
const W_SWELL = [[0.45, 43.7, 5.65], [0.25, 17.9, 2.97]];
const W_KAP = [[0.6, 97.3, 5.35], [0.4, 41.1, 0.85]];
const W_LAMP = [[0.6, 53.3, 1.17], [0.4, 23.1, 3.70]];
const W_FOCUS = [[0.55, 47.9, 3.88], [0.45, 19.7, 2.06]];

function makeState() {
  return {
    tau: 0, phi: 0.4,
    kn: [0, 2, 0, 0.72],
    gam: new Float32Array(3 * NPX), cc: new Float32Array(3 * NPX), ss: new Float32Array(3 * NPX),
  };
}

export function setup(params) {
  params.s = makeState();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.72], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  S.tau += d;
  const t = S.tau;
  const sw = 1 + wob(t, W_SWELL);
  S.phi += 0.07 * cl(kn[1], 0, 4) * sw * d;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const kn = S.kn, t = S.tau;
  const tint = cl(kn[0], 0, 1) * 900;
  const na = cl(kn[3], 0.72, 0.96);
  const opt = cl(kn[2], 0, 1);
  // the crystal
  const tilt = 30 * (0.5 + 0.46 * wob(t, W_TILT)) * (PI / 180);
  const V = max(0.026, (9 + 8 * opt + (6 + 3 * opt) * wob(t, W_OPT)) * (PI / 180));
  const zeta = (TAU * t) / 83.7 + wob(t, W_ZETA);
  const G0 = 4000 * (1 + wob(t, W_THICK));
  // the optic angle disperses: wider for blue light than for red, so each of three bands of the spectrum has its own figure
  const kk0 = cos(V * (1 + DISP)) ** 2, kk1 = cos(V) ** 2, kk2 = cos(V * (1 - DISP)) ** 2;
  // axes of the crystal in the frame of the plate
  const st = sin(tilt), ct = cos(tilt), b = S.phi, cb = cos(b), sb = sin(b);
  const tx = cb, ty = sb; // tilt direction
  const r1x = ct * tx, r1y = ct * ty, r1z = -st;
  const r2x = -sb, r2y = cb;
  const cz = cos(zeta), sz = sin(zeta);
  const u1x = cz * r1x + sz * r2x, u1y = cz * r1y + sz * r2y, u1z = cz * r1z;
  const u2x = -sz * r1x + cz * r2x, u2y = -sz * r1y + cz * r2y, u2z = -sz * r1z;
  const { gam, cc, ss } = S;
  const sna = (na * (1 + 0.07 * wob(t, W_FOCUS))) / NBAR;
  for (let i = 0; i < NPX; i++) {
    const sn = RR[i] * sna; // sin of the angle inside
    const nx = sn * CP[i], ny = sn * SP[i], nz = sqrt(1 - sn * sn);
    // e1: the polarizer direction seen along n, e2 across it
    const q = 1 / sqrt(1 - nx * nx);
    const e1x = (1 - nx * nx) * q, e1y = -nx * ny * q, e1z = -nx * nz * q;
    const e2x = ny * e1z - nz * e1y, e2y = nz * e1x - nx * e1z, e2z = nx * e1y - ny * e1x;
    const p1 = e1x * u1x + e1y * u1y + e1z * u1z, q1 = e2x * u1x + e2y * u1y + e2z * u1z;
    const p2 = e1x * u2x + e1y * u2y + e1z * u2z, q2 = e2x * u2x + e2y * u2y + e2z * u2z;
    const a11 = p1 * p1, a22 = q1 * q1, a12 = p1 * q1, b11 = p2 * p2, b22 = q2 * q2, b12 = p2 * q2;
    for (let k = 0; k < 3; k++) {
      const kk = k === 0 ? kk0 : k === 1 ? kk1 : kk2, j = k * NPX + i;
      const dd = a11 + kk * b11 - a22 - kk * b22, m12 = a12 + kk * b12, D = sqrt(dd * dd + 4 * m12 * m12);
      gam[j] = (G0 * D) / nz;
      if (D > 1e-9) {
        cc[j] = -dd / D;
        ss[j] = (-2 * m12) / D;
      } else {
        cc[j] = 1;
        ss[j] = 0;
      }
    }
  }
  // the lamp: its colour temperature and its brightness drift a little
  const kap = 0.15 * wob(t, W_KAP);
  const lamp = 0.88 * (1 + 0.07 * wob(t, W_LAMP));
  for (let n = 0; n < NW; n++) {
    const a = (TAU * tint) / LAM[n];
    C2[n] = cos(a);
    S2[n] = sin(a);
    const w = lamp * (1 + (kap * (LAM[n] - 550)) / 150);
    WN[n * 3] = WT[n * 3] * w;
    WN[n * 3 + 1] = WT[n * 3 + 1] * w;
    WN[n * 3 + 2] = WT[n * 3 + 2] * w;
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let r = 0, gr = 0, bl = 0;
      for (let k = 0; k < 3; k++) {
        const j = k * NPX + i;
        const gx = x < W - 1 ? gam[j + 1] - gam[j] : gam[j] - gam[j - 1];
        const gy = y < H - 1 ? gam[j + W] - gam[j] : gam[j] - gam[j - W];
        const gg = PI * 1.2 * sqrt(gx * gx + gy * gy);
        const g = gam[j], c = cc[j], s = ss[j], c2 = c * c, s2 = s * s;
        for (let n = k * 8; n < k * 8 + 8; n++) {
          const idx = ((g * KI[n]) | 0) & (TS - 1);
          const u = gg / LAM[n];
          const u2 = u * u;
          const at = u > 3.1 ? 0 : 1 - u2 / 6 + (u2 * u2) / 120 - (u2 * u2 * u2) / 5040;
          const I = 0.5 * (1 - c2 * C2[n]) + at * (-0.5 * s2 * C2[n] * COS[idx] + 0.5 * s * S2[n] * SIN[idx]);
          r += WN[n * 3] * I;
          gr += WN[n * 3 + 1] * I;
          bl += WN[n * 3 + 2] * I;
        }
      }
      display.setPixel(x, y, ENC[cl(r, 0, 1) * 1024 | 0], ENC[cl(gr, 0, 1) * 1024 | 0], ENC[cl(bl, 0, 1) * 1024 | 0]);
    }
}
