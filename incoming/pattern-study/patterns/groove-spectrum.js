// ===== Patternflow pattern =====
// Title:   Groove Spectrum
// Family:  grating
// Idea:    The data side of a compact disc seen so close that the panel is a few millimetres of it, the grooves running in arcs about a centre far off the panel and one small lamp wandering overhead, so the whole panel is bands of spectrum: it opens on a single first-order rainbow between gaps of dark gunmetal where faint scratches glint, with the second order a violet hint at the edge, and as the lamp and the eye move the bands slide, fan and curve and the second and third orders press up against the first, pastel where they overlap.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Jos Stam, diffraction shaders (1999), on the grating equation of Thomas Young (1801) and Joseph von Fraunhofer (1821), with the colour matching functions of Wyman, Sloan and Shirley (2013), pattern round 212
// Round:   212
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sweep=0.2..3, Pitch=-1..1, Lamp=0.01..0.2
//
// Knob 1: Hue. Turns every colour of the spectrum round the colour wheel together, keeping the white where the orders pile up. At 0 the colours are the physical ones, violet to red in the first order; at 0.25 that order runs from teal to yellow and out to violet; at 0.5 from green to orange and magenta to cyan.
// Knob 2: Sweep. How fast the lamp runs along its path, from 0.2 to 3, opening at 2. The path is sines that never close. One slow swing of it, from the lamp low over the panel to far out to one side, takes about 67 seconds at 2, 47 at 3 and 5 minutes at 0.2. The hand that holds the lamp shakes a little in real time whatever the knob says, so the bands still sway at 0.2.
// Knob 3: Pitch. The spacing of the grooves, 0.74 micrometres at -1, 1.05 at 0 where it opens and 3.2 at 1. At -1 it is a DVD: the first order is the only one in view, a single rainbow that lies from u of 0.51 to 1.0, and the lamp stays where that is, so the panel is never dark. At 0 the first order lies from u of 0.36 to 0.71 as one rainbow with dark gunmetal on either side, and the second order only begins at 0.72, so it shows as a violet hint. Near 0.4 it is the 1.6 micrometres of a CD, and the first, second and third orders lie against each other. At 1 the orders are narrower and there are more of them, and they pile up into pastel.
// Knob 4: Lamp. The radius of the lamp, twice the knob in panel heights, from 0.01 to 0.2 and opening at 0.06. Small, it is nearly a point and each band is a crisp stretch of single wavelengths; large, each LED sees a wide stretch of the spectrum at once and the bands wash out to pastel.

// Concentric grooves of spacing d about a centre c. At a point p let t be the unit
// vector across the grooves, L the unit vector to the lamp and V the unit vector to
// the eye. A groove sends the wavelength lambda in order m to the eye when
//   m lambda = d |(L + V) . t|         (the grating equation, as Stam uses it)
// so u = (L + V) . t picks the colour: lambda_m = d |u| / m for each order m that
// lands in 380 to 750 nm. Turning the disc about its axis changes nothing, since the
// grooves are circles, and so the disc never turns on its axis. The lamp and the eye move,
// and the disc's centre drifts slowly round the panel, which is the same as the lamp and
// the eye going round the disc together.
// A lamp with a size sees a stretch of u, and the LED shows the average colour of
// that stretch. Everything that depends on u alone is made once a frame into a table
// of colours, and the LEDs only look up their u.

const W = 64, H = 128, N = W * H;
const { sin, cos, exp, sqrt, abs, min, max, floor, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const NU = 2048, UMAX = 2.0, DU = UMAX / (NU - 1); // the table: |u| from 0 to 2
const MAXO = 14; // orders summed; at the largest pitch the thirteenth still shows up at |u| of 1.6
const ORDER_W = []; // order weights 1, 0.6, 0.36, 0.2, then falling slowly, so many orders together make a pastel and not a dim brown
for (let m = 1; m <= MAXO; m++) ORDER_W.push(m <= 4 ? [1, 0.6, 0.36, 0.2][m - 1] : 0.2 * pow(0.75, m - 4));
const TAPS = 13;
const GAIN = 0.28; // how fast the light of a pixel goes to its full level
const BASE = [0.0075, 0.0085, 0.0125]; // the dim gunmetal, linear light
const LAMP = 2; // the lamp's radius in panel heights per unit of the Lamp knob
const WID0 = 0.035; // the half width of the lamp in u at which its light stops being the light of one wavelength
const ZERO = 0.1; // the zero-order streak, against a first order near 1
const ZERO_W = 0.07; // its width in u

// The disc centre is 1.25 to 2.75 panel heights from the middle of the panel, up and to one side, and it
// wanders slowly round the panel, which is the same as the eye and the lamp together going round the disc.
const SC_N = 2048, SC_R0 = 0.7, SC_R1 = 3.5; // the scratches, as a table over the distance from the centre
const GLINT = 0.45; // how white the scratches' glint gets at most
const GLINT_W = 0.11; // half width in w of the glint, for a point lamp
const PH0 = 464; // where on the lamp's path the pattern opens, in seconds of path

// ---- colour of one wavelength: Wyman, Sloan and Shirley's multi-lobe fit of the CIE 1931 curves
function lobe(l, mu, s1, s2) {
  const d = (l - mu) / (l < mu ? s1 : s2);
  return exp(-0.5 * d * d);
}

const L0 = 340, L1 = 800;
const SPEC = new Float32Array((L1 - L0 + 1) * 3); // linear sRGB of one wavelength, white balanced to an equal-energy lamp
(function () {
  const sum = [0, 0, 0];
  for (let l = L0; l <= L1; l++) {
    const x = 1.056 * lobe(l, 599.8, 37.9, 31.0) + 0.362 * lobe(l, 442.0, 16.0, 26.7) - 0.065 * lobe(l, 501.1, 20.4, 26.2);
    const y = 0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1);
    const z = 1.217 * lobe(l, 437.0, 11.8, 36.0) + 0.681 * lobe(l, 459.0, 26.0, 13.8);
    const i = (l - L0) * 3;
    SPEC[i] = 3.2406 * x - 1.5372 * y - 0.4986 * z;
    SPEC[i + 1] = -0.9689 * x + 1.8758 * y + 0.0415 * z;
    SPEC[i + 2] = 0.0557 * x - 0.204 * y + 1.057 * z;
    if (l >= 380 && l <= 750) for (let c = 0; c < 3; c++) sum[c] += SPEC[i + c];
  }
  // Every wavelength together is white: the mean over 380 to 750 is made (1, 1, 1).
  for (let i = 0; i < SPEC.length; i += 3) for (let c = 0; c < 3; c++) SPEC[i + c] *= 371 / sum[c];
})();

const smooth = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The colour of the wavelength l in nm, with a soft edge at both ends of 380 to 750.
function spectrum(l, out) {
  const w = smooth(372, 392, l) * (1 - smooth(738, 758, l));
  if (w <= 0) return 0;
  const f = cl(l, L0, L1 - 1.001) - L0, i = floor(f), a = f - i, j = i * 3;
  for (let c = 0; c < 3; c++) out[c] = w * (SPEC[j + c] * (1 - a) + SPEC[j + 3 + c] * a);
  return 1;
}

// The pitch knob in micrometres: 0.74 at -1, 1.05 at 0 and 3.2 at 1.
const P0 = 1.05;
function pitchOf(k) {
  return k < 0 ? P0 * pow(0.74 / P0, -k) : P0 * pow(3.2 / P0, k);
}

// All the orders at one pitch, as a function of |u|, in linear light, and the zero order beside them.
function buildRaw(d, raw) {
  const c = [0, 0, 0];
  for (let i = 0; i < NU; i++) {
    const u = i * DU;
    let r = 0, g = 0, b = 0;
    for (let m = 1; m <= MAXO; m++) {
      if (spectrum((d * 1000 * u) / m, c)) {
        r += ORDER_W[m - 1] * c[0];
        g += ORDER_W[m - 1] * c[1];
        b += ORDER_W[m - 1] * c[2];
      }
    }
    const z = ZERO * exp(-0.5 * (u / ZERO_W) * (u / ZERO_W));
    raw[i * 3] = r + z;
    raw[i * 3 + 1] = g + z;
    raw[i * 3 + 2] = b + z;
  }
}

export function setup(params) {
  const px = new Float32Array(N), py = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      px[y * W + x] = (x + 0.5 - W / 2) / H;
      py[y * W + x] = (y + 0.5 - H / 2) / H;
    }
  // Fine scratches in circles about the centre, each at its own radius and strength, laid out by a
  // fixed generator so every run has the same disc. Most are faint and a few are strong.
  let seed = 1234567;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const scr = new Float32Array(SC_N);
  for (let r = SC_R0; r < SC_R1; r += 0.035 + 0.2 * rnd() * rnd()) {
    const amp = rnd() < 0.3 ? 0.7 + 0.3 * rnd() : 0.15 + 0.3 * rnd();
    for (let k = max(0, floor(((r - 0.03 - SC_R0) / (SC_R1 - SC_R0)) * SC_N)); k < min(SC_N, ((r + 0.03 - SC_R0) / (SC_R1 - SC_R0)) * SC_N); k++) {
      const e = (SC_R0 + (k / SC_N) * (SC_R1 - SC_R0) - r) / 0.0075;
      scr[k] = min(1, scr[k] + amp * exp(-0.5 * e * e));
    }
  }
  params.s = {
    px, py, scr, sw: GLINT_W,
    raw: new Float32Array(NU * 3), lut: new Float32Array(NU * 3),
    pitch: -99, hue: -1, cs: 1, sn: 0,
    t: 0, ph: PH0, sf: 1.75, hueT: 0, sfT: 1.75, pk: 0, lk: 0.06,
    lx: 0, ly: 0, lz: 1, ex: 0, ey: 0, ez: 1, cx: 0, cy: -1.9, uc: 0, wid: 0,
  };
}

// The lamp and the eye, each a direction and a distance. U is u at the middle of the panel, and the
// lamp's tilt from the panel's normal is the one that gives it, so it runs from 0.3 to 1.2 as the lamp
// goes from overhead to far out to the side. Every period is its own, none a multiple of another, so
// the path does not close.
function place(S, ph, t) {
  const tau = 2 * PI;
  // x swings between 0 and 1 on four periods that never meet. U is 0.33 at 0 and 1.15 at 1,
  // and bent so that the lamp spends most of its time where the first and second orders are.
  const x = cl(0.5 + 0.27 * sin((tau * ph) / 233.7 + 0.3) + 0.15 * sin((tau * ph) / 83.1 + 2.1) + 0.08 * sin((tau * ph) / 29.7 + 4.2), 0, 1);
  // The hand holding the lamp is never quite still, whatever the Sweep knob says: it shakes in real time.
  const hand = 0.012 * sin((tau * t) / 5.3 + 0.7) + 0.008 * sin((tau * t) / 3.1 + 2.2);
  const U0 = 0.33 + 0.82 * pow(x, 1.7) + 0.03 * sin((tau * ph) / 14.3 + 1.0) + 0.02 * sin((tau * ph) / 6.1 + 4.4);
  // A finer pitch pushes its first order out to larger u and narrows it, and the lamp follows: at 0.74 the
  // panel stays within u of 0.6 to 0.93, where the first order of a DVD lies, and so is never dark.
  const fine = cl((P0 - pitchOf(S.pk)) / (P0 - 0.74), 0, 1);
  const U = U0 * (1 - fine) + fine * (0.76 + 0.33 * (U0 - 0.78)) + hand;
  const fi = 0.45 * sin((tau * ph) / 97.3 + 1.0) + 0.25 * sin((tau * ph) / 41.1 + 3.0) + 0.08 * sin((tau * ph) / 17.3 + 5.1);
  const D = 2.7 + 0.8 * sin((tau * ph) / 53.9 + 0.6) + 0.4 * sin((tau * ph) / 19.7 + 2.0);
  const te = 0.32 + 0.14 * sin((tau * ph) / 311.3 + 1.7) + 0.07 * sin((tau * ph) / 131.1 + 0.2);
  const fe = 0.5 + 1.2 * sin((tau * ph) / 421.7 + 0.9) + 0.5 * sin((tau * ph) / 163.9 + 2.5);
  const De = 5.5 + 1.3 * sin((tau * ph) / 251.3 + 1.2) + 0.6 * sin((tau * ph) / 71.9 + 3.3);
  // The disc: the direction across its grooves at the middle of the panel, and how far off the centre is.
  const al = 0.3 + 0.55 * sin((tau * ph) / 251.7 + 1.1) + 0.4 * sin((tau * ph) / 107.3 + 4.0) + 0.15 * sin((tau * ph) / 37.9 + 0.4);
  const rc = 2.0 + 0.5 * sin((tau * ph) / 191.3 + 2.0) + 0.25 * sin((tau * ph) / 73.1 + 5.0);
  const t0x = sin(al), t0y = cos(al), s0x = -t0y, s0y = t0x;
  S.cx = -rc * t0x;
  S.cy = -rc * t0y;
  const ae = sin(te) * cos(fe), be = sin(te) * sin(fe);
  // The lamp's tilt is the one that puts u at the middle of the panel at U.
  const sth = cl((U - ae) / cos(fi), -0.99, 0.99), th = Math.asin(sth);
  const a = sth * cos(fi), b = sth * sin(fi), c = cos(th);
  S.lx = D * (a * t0x + b * s0x);
  S.ly = D * (a * t0y + b * s0y);
  S.lz = D * c;
  S.ex = De * (ae * t0x + be * s0x);
  S.ey = De * (ae * t0y + be * s0y);
  S.ez = De * cos(te);
  S.uc = a + ae;
  // Half the width of the lamp in u at the middle of the panel: its radius over its distance,
  // foreshortened by how far along the grooves' crossing it lies.
  S.wid = ((LAMP * S.lk) / D) * sqrt(max(0, 1 - a * a));
  S.sw = sqrt(GLINT_W * GLINT_W + S.wid * S.wid);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hueT = cl(kn[0], 0, 1);
  S.sfT = 0.25 + 0.75 * cl(kn[1], 0.2, 3);
  S.pk = cl(kn[2], -1, 1);
  S.lk = cl(kn[3], 0.01, 0.2);
  S.sf += (S.sfT - S.sf) * (1 - exp(-d / 0.4));
  S.ph += d * S.sf;
  S.t += d;
  place(S, S.ph, S.t);

  const pitch = pitchOf(S.pk);
  if (abs(pitch - S.pitch) > 1e-4) {
    S.pitch = pitch;
    buildRaw(pitch, S.raw);
  }
  if (abs(S.hueT - S.hue) > 0.002) {
    S.hue = S.hueT;
    S.cs = cos(2 * PI * S.hue);
    S.sn = sin(2 * PI * S.hue);
  }
  makeTable(S);
}

// The table the LEDs read: the colours smoothed over the lamp's width, clipped to the
// gamut, turned round the colour wheel, added to the gunmetal and put through a soft
// shoulder and a gamma of 2.
function makeTable(S) {
  const raw = S.raw, lut = S.lut;
  const a = S.wid / DU; // half width in table steps
  const nt = a < 0.6 ? 1 : TAPS;
  const off = new Int32Array(nt), wt = new Float32Array(nt);
  let ws = 0;
  for (let k = 0; k < nt; k++) {
    const s = nt === 1 ? 0 : -1 + (2 * k + 1) / nt;
    off[k] = Math.round(s * a);
    wt[k] = nt === 1 ? 1 : sqrt(1 - s * s);
    ws += wt[k];
  }
  const cs = S.cs, sn = S.sn;
  // A lamp wider than WID0 puts more light on the LED, in proportion to its width, and so does a
  // coarser pitch, which has more orders to share it with. Without that the pastels go grey.
  const gain = pow(max(1, S.wid / WID0), 0.4) * max(1, S.pitch / 1.6);
  for (let i = 0; i < NU; i++) {
    let r = 0, g = 0, b = 0;
    for (let k = 0; k < nt; k++) {
      let j = i + off[k];
      if (j < 0) j = -j;
      if (j > NU - 1) j = NU - 1;
      const w = wt[k];
      r += w * raw[j * 3];
      g += w * raw[j * 3 + 1];
      b += w * raw[j * 3 + 2];
    }
    const sc = gain / ws;
    r *= sc;
    g *= sc;
    b *= sc;
    // A colour outside the screen's gamut is brought in by adding white until nothing is negative.
    const lo = min(r, g, b, 0);
    r = max(0, r - lo) + BASE[0];
    g = max(0, g - lo) + BASE[1];
    b = max(0, b - lo) + BASE[2];
    const m = max(r, g, b);
    const k = (1 - exp(-GAIN * m)) / m;
    r = sqrt(r * k);
    g = sqrt(g * k);
    b = sqrt(b * k);
    // The turn round the colour wheel is on the YIQ chroma plane of the colour as shown, which keeps
    // the white white, and the colour keeps the level it had.
    const top = max(r, g, b);
    const y = 0.299 * r + 0.587 * g + 0.114 * b, I = 0.596 * r - 0.274 * g - 0.322 * b, Q = 0.211 * r - 0.523 * g + 0.312 * b;
    const I2 = I * cs - Q * sn, Q2 = I * sn + Q * cs;
    const r2 = max(0, y + 0.956 * I2 + 0.621 * Q2), g2 = max(0, y - 0.272 * I2 - 0.647 * Q2), b2 = max(0, y - 1.106 * I2 + 1.703 * Q2);
    const f = (255 * top) / max(r2, g2, b2, 1e-4);
    lut[i * 3] = r2 * f;
    lut[i * 3 + 1] = g2 * f;
    lut[i * 3 + 2] = b2 * f;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { px, py, scr, lut } = S;
  const lx = S.lx, ly = S.ly, lz = S.lz, ex = S.ex, ey = S.ey, ez = S.ez, cx = S.cx, cy = S.cy;
  const sc = (NU - 1) / UMAX, iw = -0.5 / (S.sw * S.sw), rs = SC_N / (SC_R1 - SC_R0);
  for (let i = 0; i < N; i++) {
    const X = px[i], Y = py[i];
    const ax = lx - X, ay = ly - Y, bx = ex - X, by = ey - Y;
    const il = 1 / sqrt(ax * ax + ay * ay + lz * lz), ie = 1 / sqrt(bx * bx + by * by + ez * ez);
    const hx = ax * il + bx * ie, hy = ay * il + by * ie;
    // t is the unit vector from the centre of the disc, across the grooves.
    const dx = X - cx, dy = Y - cy, rho = sqrt(dx * dx + dy * dy), tx = dx / rho, ty = dy / rho;
    const u = hx * tx + hy * ty;
    const f = min(abs(u) * sc, NU - 1.001), j = floor(f), q = f - j, o = j * 3;
    let r = lut[o] * (1 - q) + lut[o + 3] * q, g = lut[o + 1] * (1 - q) + lut[o + 4] * q, b = lut[o + 2] * (1 - q) + lut[o + 5] * q;
    // A scratch is a line along the grooves' circle, and it throws light back where the half vector
    // has no part along that line: w = (L + V) . s = 0, s being across t. Every scratch flares on that
    // one line of the panel, and so a dim glow of the finest ones does.
    const w = hy * tx - hx * ty;
    const k = floor((rho - SC_R0) * rs);
    const gl = GLINT * exp(w * w * iw) * (0.3 + 0.7 * (k >= 0 && k < SC_N ? scr[k] : 0));
    r += (255 - r) * gl;
    g += (255 - g) * gl;
    b += (255 - b) * gl;
    display.setPixel(i % W, (i / W) | 0, r, g, b);
  }
}
