// ===== Patternflow pattern =====
// Title:   Newton's Rings
// Family:  wave
// Idea:    A convex lens rests on a glass plate and the top of the panel looks down on the rings of colour the air gap makes, each LED summing twenty wavelengths of reflected light, while below it a side view draws the lens above the plate with the wedge of air coloured by its thickness and a plot of the squared radius of each dark ring against its number lays the dots on a straight line whose slope is the wavelength times the lens radius.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Newton's rings (Robert Hooke saw them in 1665, Isaac Newton measured them in his Opticks, 1704, and Thomas Young explained them by interference in 1801, all from memory); reflected intensity sin^2(2 pi d / lambda) of an air gap d = r^2 / 2R, with the half-wave flip at one reflection; colour from a 20-wavelength sum over the multi-lobe fit of the CIE 1931 colour-matching functions (Chris Wyman, Peter-Pike Sloan and Peter Shirley, 2013, from memory); the 3 by 5 letters R, M and 2 of the plot's axes copied from edit-distance.js; pattern round 113
// Round:   113
// ===============================
// @matrix 64x128
// @knobs Light=0..1, Speed=0.2..3, Lens=-1..1, Tilt=-1..1
//
// Knob 1: Light. At 0 white light of an even spectrum from 400 to 700 nm, so the rings are Newton's colour series, from a black centre out to pale green and pink by the sixth ring. To 0.14 the blue end is filtered away until 14 nm of deep red is left, then 0.14 to 1 sweeps that one wavelength from 693 nm to 430 nm (0.608 is 550 nm green). Rings of one colour sit at sqrt(m lambda R), so the first ring is 27% wider in 693 nm red than in 430 nm violet, 12.9 LEDs out against 10.2.
// Knob 2: Speed. The lens is pressed down and let up. The gap at its centre swings between -0.4 and +0.9 wavelengths of 550 nm. Pressed, the lens flattens against the plate into a black contact disc up to 20 LEDs wide and the rings rush outward; let up, they shrink into the centre and vanish there, the second ring at up to 3.7 LEDs a second. One breath is 24 / Speed seconds: 12 s at 2, 120 s at 0.2, 8 s at 3. It opens pressed, a 20 LED disc, and the lens touches at 2 s.
// Knob 3: Lens. The radius of curvature R on a log scale, 1.45 to the power of the knob times 11.5 for the first ring. At 0 the first dark ring of 550 nm light is 11.5 LEDs out and the rings come at sqrt(m) times that: 11.5, 16.3, 19.9, 23.0, 25.7, 28.2. At -1 the lens is more curved (R 0.48 times) and the first ring is 7.9 LEDs out; at 1 it is flatter (R 2.1 times) and the first ring is 16.7 out. The side view draws that sag and the plot's slope follows R.
// Knob 4: Tilt. Tilting the plate against the lens moves the point where they are closest, and the rings stay circles about it: the centre moves 12 LEDs left at -1 and 12 right at 1, and the side view shears the lens as one block. The gap grows with the square of the distance from the centre, so the rings crowd on the far side and widen on the near one. The plot does not change, because the rings are measured from their own centre. It opens at 0.06, 0.7 LED off centre.

const W = 64, H = 128;
const { floor, min, max, abs, sin, cos, exp, sqrt, round, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// Top view: the aperture of the lens, a disc 29 LEDs in radius. Side view: the plate's upper face is the line YP, the
// vertical scale is SC LEDs to a wavelength of 550 nm of gap, and the rigid lens is T0 LEDs thick on its axis.
const CX = 32, CY = 31, RA = 29;
const YP = 96, SC = 6.5, T0 = 26, YWIN = 62;
// The plot of squared radius against ring number.
const PX0 = 8, PXM = 6.6, PY0 = 124, PYR = 19 / (RA * RA);

// Spectrum: NS wavelengths across the band. For each, the phase of the gap in units of one 550 nm wavelength of gap,
// FK = 4 pi 550 / lambda, and the weight of its colour in linear RGB, Q.
const NS = 20;
const LAMBDA_REF = 550;
const A_REF = 11.5;

// Multi-lobe fit of the CIE 1931 colour-matching functions.
const lobe = (l, mu, s1, s2) => {
  const t = (l - mu) / (l < mu ? s1 : s2);
  return exp(-0.5 * t * t);
};
function rgbOf(l, out) {
  const x = 1.056 * lobe(l, 599.8, 37.9, 31.0) + 0.362 * lobe(l, 442.0, 16.0, 26.7) - 0.065 * lobe(l, 501.1, 20.4, 26.2);
  const y = 0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1);
  const z = 1.217 * lobe(l, 437.0, 11.8, 36.0) + 0.681 * lobe(l, 459.0, 26.0, 13.8);
  out[0] = 3.2406 * x - 1.5372 * y - 0.4986 * z;
  out[1] = -0.9689 * x + 1.8758 * y + 0.0415 * z;
  out[2] = 0.0557 * x - 0.204 * y + 1.057 * z;
  return out;
}
const enc = (v) => pow(cl(v, 0, 1), 0.4545);

// The even-spectrum white: what the whole 400 to 700 nm band adds up to, so that a gap that reflects everything is neutral.
function whiteOf() {
  const w = [0, 0, 0], t = [0, 0, 0], dl = 300 / NS;
  for (let k = 0; k < NS; k++) {
    rgbOf(400 + (k + 0.5) * dl, t);
    w[0] += t[0] * dl, w[1] += t[1] * dl, w[2] += t[2] * dl;
  }
  return w;
}

// The light of knob 1 as a band lo..hi: white, then a long-pass filter closing on the red, then 14 nm of one colour.
function bandOf(k) {
  if (k < 0.14) {
    const u = sm(k / 0.14);
    return [400 + 286 * u, 700];
  }
  const c = 693 - ((k - 0.14) / 0.86) * 263;
  return [c - 7, c + 7];
}

function setBand(S, lo, hi) {
  const dl = (hi - lo) / NS, t = [0, 0, 0], sum = [0, 0, 0];
  for (let k = 0; k < NS; k++) {
    const l = lo + (k + 0.5) * dl;
    S.fk[k] = (4 * PI * LAMBDA_REF) / l;
    rgbOf(l, t);
    for (let c = 0; c < 3; c++) {
      S.q[3 * k + c] = (t[c] * dl) / S.wb[c];
      sum[c] += S.q[3 * k + c];
    }
  }
  // Colour of the band at full reflectance goes to full brightness in its brightest channel, so one wavelength reads as a lit colour.
  const g = 1 / max(sum[0], sum[1], sum[2], 1e-6);
  for (let i = 0; i < NS * 3; i++) S.q[i] *= g;
  S.lo = lo;
  S.hi = hi;
}

// Reflected colour (linear RGB into out) of a gap of D wavelengths of 550 nm, one LED wide: d D / dx = gx, d D / dy = gy per LED.
// The LED averages the fringes under it, which takes the contrast of each wavelength down by sinc(gx) sinc(gy).
function shade(S, D, gx, gy, out) {
  const fk = S.fk, q = S.q;
  let r = 0, g = 0, b = 0;
  for (let k = 0; k < NS; k++) {
    const f = fk[k], ax = f * gx * 0.5, ay = f * gy * 0.5;
    const sx = ax * ax < 1e-4 ? 1 - (ax * ax) / 6 : sin(ax) / ax;
    const sy = ay * ay < 1e-4 ? 1 - (ay * ay) / 6 : sin(ay) / ay;
    const I = 0.5 * (1 - cos(f * D) * sx * sy);
    r += I * q[3 * k], g += I * q[3 * k + 1], b += I * q[3 * k + 2];
  }
  out[0] = r, out[1] = g, out[2] = b;
  return out;
}

export function setup(params) {
  params.s = {
    light: -1, lens: 99, tilt: 99, speed: 2, ph: asinPhase(), d0: 0.25 + 0.65 * sin(asinPhase()), a: A_REF, x0: 0.7,
    wb: whiteOf(), fk: new Float32Array(NS), q: new Float32Array(NS * 3), lo: 0, hi: 0,
    rgb: new Float32Array(W * H * 3), row: new Float32Array(H * 3),
  };
  setBand(params.s, 400, 700);
}
// The breath is 0.25 + 0.65 sin(phase) wavelengths of gap. It opens pressed, at -0.39, and the lens touches (0) 2 s later at Speed 2.
function asinPhase() {
  return -1.44;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const light = cl(kv[0], 0, 1);
  if (light !== S.light) {
    S.light = light;
    const [lo, hi] = bandOf(light);
    setBand(S, lo, hi);
  }
  S.speed = cl(kv[1], 0.2, 3);
  S.ph += (d * S.speed * 2 * PI) / 24;
  S.d0 = 0.25 + 0.65 * sin(S.ph);
  S.a = A_REF * pow(1.45, cl(kv[2], -1, 1));
  S.x0 = 12 * cl(kv[3], -1, 1);
}

// Blend colour c (display values 0..1) over the frame at weight a.
function put(rgb, x, y, c0, c1, c2, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3, k = min(1, a);
  rgb[o] += (c0 - rgb[o]) * k;
  rgb[o + 1] += (c1 - rgb[o + 1]) * k;
  rgb[o + 2] += (c2 - rgb[o + 2]) * k;
}
// A soft dot at a sub-pixel position, radius about 1.1 LEDs.
function dot(rgb, fx, fy, c0, c1, c2, a) {
  const x0 = floor(fx - 1.6), y0 = floor(fy - 1.6);
  for (let y = y0; y <= y0 + 3; y++)
    for (let x = x0; x <= x0 + 3; x++) {
      const dd = sqrt((x + 0.5 - fx) * (x + 0.5 - fx) + (y + 0.5 - fy) * (y + 0.5 - fy));
      put(rgb, x, y, c0, c1, c2, a * cl(1.45 - dd, 0, 1));
    }
}

// Three letters of the 3 by 5 face copied from edit-distance.js, for the plot's axes.
const FACE = { R: "##.|#.#|##.|#.#|#.#", M: "#.#|###|###|#.#|#.#", 2: "###|..#|###|#..|###" };
function label(rgb, ch, x, y) {
  const g = FACE[ch].replace(/\|/g, "");
  for (let i = 0; i < 15; i++) if (g[i] === "#") put(rgb, x + (i % 3), y + floor(i / 3), 0.5, 0.64, 0.8, 0.9);
}

// Display colour of one wavelength, brightest channel at 1.
function pureColour(l, out) {
  rgbOf(l, out);
  const m = max(out[0], out[1], out[2], 1e-6);
  for (let c = 0; c < 3; c++) out[c] = enc(out[c] / m);
  return out;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, a = S.a, a2 = a * a, d0 = S.d0, x0 = S.x0, t = [0, 0, 0];
  rgb.fill(0);
  const GAIN = 0.82;

  // The top view: the rings the air gap makes, seen down through the lens. D is the gap in 550 nm wavelengths.
  for (let y = 0; y < 63; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, r = sqrt(dx * dx + dy * dy);
      if (r > RA + 1.6) continue;
      if (r > RA + 0.5) {
        const e = cl(1.6 - (r - RA - 0.5) * 1.4, 0, 1) * 0.3;
        put(rgb, x, y, 0.28, 0.4, 0.58, e);
        continue;
      }
      const ex = dx - x0;
      let D = d0 + (ex * ex + dy * dy) / (2 * a2), gx = ex / a2, gy = dy / a2;
      if (D < 0) (D = 0), (gx = 0), (gy = 0);
      shade(S, D, gx, gy, t);
      const cov = cl(RA + 0.5 - r, 0, 1) * GAIN;
      put(rgb, x, y, enc(t[0]), enc(t[1]), enc(t[2]), cov);
      // The rim of the glass, a thin steel line just inside the aperture's edge.
      if (r > RA - 0.6) put(rgb, x, y, 0.28, 0.4, 0.58, 0.28 * cl((r - RA + 0.6) * 1.6, 0, 1));
    }

  // The side view. The lens is one rigid block that is sheared by the tilt: its top face and its curved face tilt together.
  const sig = -x0 / a2, dAx = d0 + (x0 * x0) / (2 * a2);
  const slopeT = SC * sig;
  for (let y = YWIN; y < YP; y++) {
    // Wedge colour at this height above the plate: the Newton scale laid out upward.
    const h = YP - (y + 0.5);
    shade(S, h / SC, 0, 1 / SC, t);
    S.row[3 * y] = enc(t[0]), S.row[3 * y + 1] = enc(t[1]), S.row[3 * y + 2] = enc(t[2]);
  }
  for (let x = CX - RA - 1; x <= CX + RA; x++) {
    const xx = x + 0.5 - CX, ae = cl(RA + 0.5 - abs(xx), 0, 1);
    if (ae <= 0) continue;
    const ex = xx - x0, Dr = d0 + (ex * ex) / (2 * a2), D = max(0, Dr);
    const yc = YP - SC * D, slopeC = Dr > 0 ? (SC * ex) / a2 : 0;
    const ytop = YP - SC * (dAx + sig * xx) - T0, yb = max(yc, ytop);
    // The colour of the ring at this column, the wedge's top edge.
    shade(S, D, Dr > 0 ? ex / a2 : 0, 0, t);
    const rim0 = enc(t[0]) * 0.8 + 0.2, rim1 = enc(t[1]) * 0.8 + 0.2, rim2 = enc(t[2]) * 0.8 + 0.2;
    const nc = 1 / sqrt(1 + slopeC * slopeC), nt = 1 / sqrt(1 + slopeT * slopeT);
    for (let y = YWIN; y < YP; y++) {
      const yy = y + 0.5;
      const glass = cl(min(yy + 0.5, yb) - max(yy - 0.5, ytop, YWIN), 0, 1);
      const wedge = cl(yy + 0.5 - max(yb, yy - 0.5), 0, 1);
      if (glass > 0) put(rgb, x, y, 0.085, 0.15, 0.24, glass * ae);
      if (wedge > 0) put(rgb, x, y, S.row[3 * y] * 0.62, S.row[3 * y + 1] * 0.62, S.row[3 * y + 2] * 0.62, wedge * ae);
      // The lens's two faces as lines.
      const dc = abs(yy - yc) * nc, dt = abs(yy - ytop) * nt;
      if (dc < 1.2 && yb - 0.5 < yy + 1.2 && yy < yc + 1.2) put(rgb, x, y, rim0, rim1, rim2, cl(1.1 - dc * 0.85, 0, 1) * ae * 0.95);
      if (ytop < yc && dt < 1.2) put(rgb, x, y, 0.4, 0.55, 0.75, cl(1 - dt * 0.8, 0, 1) * ae * 0.8);
    }
    // The plate's upper face, bright where the lens touches it.
    const touch = Dr <= 0 ? 1 : cl(1.4 - Dr * SC, 0, 1);
    put(rgb, x, YP, 0.55 + 0.4 * touch, 0.7 + 0.28 * touch, 0.85 + 0.15 * touch, ae * (0.55 + 0.45 * touch));
  }
  // The plate: three rows of glass.
  for (let y = YP + 1; y < YP + 3; y++)
    for (let x = CX - RA - 1; x <= CX + RA; x++) put(rgb, x, y, 0.07, 0.12, 0.19, cl(RA + 0.5 - abs(x + 0.5 - CX), 0, 1));

  // The wavelength the rings are marked for: the middle of the band, and the three lines the plot draws.
  const lc = (S.lo + S.hi) / 2, ls = (S.hi - S.lo) / 3;
  const lamC = [lc - ls, lc, lc + ls];
  // Dark rings at gap m lambda / 2: marked on the lens's curve, and as ticks on the plate right below.
  for (let m = 0; m < 16; m++) {
    const r2 = a2 * ((lc * m) / LAMBDA_REF - 2 * d0);
    if (r2 < 0) continue;
    const r = sqrt(r2), Dm = (lc * m) / (2 * LAMBDA_REF);
    for (let side = -1; side <= 1; side += 2) {
      const px = CX + x0 + side * r;
      if (side > 0 && r === 0) continue;
      const al = cl((RA - abs(px - CX)) * 0.7 + 0.5, 0, 1) * cl(r * 0.5, 0.45, 1);
      if (al <= 0) continue;
      const ytick = YP - SC * Dm, yt = YP - SC * (dAx + sig * (px - CX)) - T0;
      if (ytick > YWIN && ytick > yt + 0.5) dot(rgb, px, ytick, 1, 1, 1, al * cl(ytick - yt - 0.5, 0, 1));
      for (let k = 0; k < 2; k++) {
        const fx = px - 0.5, ix = floor(fx), fr = fx - ix;
        put(rgb, ix, YP + 1 + k, 1, 1, 1, (1 - fr) * al * 0.9);
        put(rgb, ix + 1, YP + 1 + k, 1, 1, 1, fr * al * 0.9);
      }
    }
  }

  // The plot: squared radius of the dark ring against its number m. A straight line of slope lambda R,
  // and with a y-intercept only when the lens is pressed.
  for (let y = PY0 - 20; y <= PY0; y += 1) put(rgb, PX0, y, 0.34, 0.45, 0.58, 0.9);
  for (let x = PX0; x <= 62; x++) put(rgb, x, PY0, 0.34, 0.45, 0.58, 0.9);
  for (let m = 1; m <= 8; m++) put(rgb, round(PX0 + PXM * m - 0.5), PY0 + 1, 0.34, 0.45, 0.58, 0.9);
  // The two axes' names, R squared up the side and M along the foot.
  label(rgb, "R", 0, 104);
  label(rgb, "2", 4, 104);
  label(rgb, "M", 58, 117);
  // The edge of the lens: rings beyond it are not there.
  const ylim = PY0 - RA * RA * PYR;
  for (let x = PX0 + 2; x <= 62; x += 3) put(rgb, x, round(ylim - 0.5), 0.3, 0.4, 0.5, 0.8);
  const pc = [0, 0, 0];
  for (let j = 0; j < 3; j++) {
    pureColour(lamC[j], pc);
    // Lines: m from the axis out.
    const slope = a2 * (lamC[j] / LAMBDA_REF), icpt = -2 * a2 * d0;
    for (let x = PX0 + 1; x <= 62; x++) {
      const m = (x + 0.5 - PX0) / PXM, r2 = icpt + slope * m;
      if (r2 < 0 || r2 > RA * RA * 1.05) continue;
      const fy = PY0 - r2 * PYR - 0.5, iy = floor(fy), fr = fy - iy;
      put(rgb, x, iy, pc[0], pc[1], pc[2], (1 - fr) * 0.3);
      put(rgb, x, iy + 1, pc[0], pc[1], pc[2], fr * 0.3);
    }
    for (let m = 0; m < 16; m++) {
      const r2 = icpt + slope * m;
      if (r2 < 0 || m > 8) continue;
      const al = cl((RA * RA - r2) * PYR * 1.5 + 0.2, 0, 1) * cl(r2 * 0.05, 0, 1);
      if (al > 0) dot(rgb, PX0 + PXM * m, PY0 - r2 * PYR, pc[0], pc[1], pc[2], al);
    }
  }

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
