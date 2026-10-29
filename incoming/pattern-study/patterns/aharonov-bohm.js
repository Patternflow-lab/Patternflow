// ===== Patternflow pattern =====
// Title:   Aharonov-Bohm
// Family:  wave
// Idea:    Plane waves run down the panel past a thin tube of magnetic flux a third of the way down, where no field reaches them, yet behind the tube the crests on the two sides of its shadow line come out shifted against each other by the flux in quanta and end at a torn seam, coloured by how far each crest has slipped behind the wave that would pass with no tube.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Aharonov-Bohm effect (Yakir Aharonov and David Bohm, 1959; Werner Ehrenberg and Raymond Siday, 1949), wavefront dislocations (Michael Berry, Robert Chambers, Mark Large, Colin Upstill and J. C. Walmsley, 1980), pattern round 69
// Round:   69
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Wavelength=7..16, Flux=0.5..1.5
//
// Knob 1: Hue. Turns the colours round the wheel. At 0 a crest that passes as if there were no tube is blue; at the opening flux of half a quantum the crests left of the shadow line come out a quarter wave ahead and turn green, those on the right a quarter wave behind and turn magenta, and a crest a whole wave out would be blue again.
// Knob 2: Speed. How fast the crests run down: 8 LEDs a second at 2, 0.8 at 0.2 and 12 at 3.
// Knob 3: Wavelength. The distance between crests, 7 LEDs at the opening, 16 at the top. A longer wave diffracts more: the band behind the tube where the two sides blend is about the square root of wavelength times distance wide, 25 LEDs across at the bottom row at 7 and 37 at 16.
// Knob 4: Flux. The flux through the tube in flux quanta h/e. At 0.5 the two sides come out half a wave apart and the shadow line is an exact dark seam; at 1 the wave passes as if the tube were not there; at 1.5 it is half a wave again, the mirror image of 0.5. The wave only knows the flux modulo one quantum.

const W = 64, H = 128, N = W * H, HALF = W / 2;
const { floor, ceil, min, max, abs, sqrt, sin, cos, exp, pow, cbrt, atan2, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The tube sits on the corner between four LEDs, on the middle line, a third
// of the way down.
const TX = 32, TY = 42;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// Gamma on [1, 2] by Lanczos (g = 7, nine terms), good to about 1e-15.
const LZ = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
function gamma(x) {
  x -= 1;
  let a = LZ[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LZ[i] / (x + i);
  return sqrt(2 * PI) * pow(t, x + 0.5) * exp(-t) * a;
}

// Bessel functions J of orders nu0, nu0 + 1, ..., nu0 + M at z, for one
// fractional part nu0 in [0, 1), by Miller's backward recurrence
//   J(v - 1) = (2 v / z) J(v) - J(v + 1)
// started from nothing well above z, then scaled by Neumann's sum
//   (z / 2)^nu0 = sum over k of (nu0 + 2k) Gamma(nu0 + k) / k! J(nu0 + 2k),
// whose weights w[k] depend on nu0 only.
function weights(nu0, K) {
  const w = new Float64Array(K + 1);
  w[0] = gamma(nu0 + 1);
  let g = w[0];
  for (let k = 1; k <= K; k++) {
    w[k] = (nu0 + 2 * k) * g;
    g = (g * (nu0 + k)) / (k + 1);
  }
  return w;
}
function besselRun(nu0, z, M, w, out) {
  let fp = 0, f = 1e-30, sum = (M & 1) === 0 ? w[M >> 1] * f : 0;
  out[M] = f;
  for (let n = M; n >= 1; n--) {
    const fm = ((2 * (nu0 + n)) / z) * f - fp;
    fp = f;
    f = fm;
    out[n - 1] = f;
    if (((n - 1) & 1) === 0) sum += w[(n - 1) >> 1] * f;
    if (abs(f) > 1e200) {
      for (let j = n - 1; j <= M; j++) out[j] *= 1e-200;
      (sum *= 1e-200), (fp *= 1e-200), (f *= 1e-200);
    }
  }
  const sc = pow(z / 2, nu0) / sum;
  for (let n = 0; n <= M; n++) out[n] *= sc;
}

// The Aharonov-Bohm wave. Round the tube the vector potential circles with
// A = a / r in units of the flux quantum, and the wave equation splits into
// angular orders m, each with the radial Bessel function of order |m - a|.
// With theta measured from the way the wave runs (down the panel), the
// solution that is regular at the tube and whose incoming part is the plane
// wave exp(i k x) is
//   psi = sum over m of (-1)^m (-i)^|m - a| J_|m - a|(k r) exp(i m theta),
// Aharonov and Bohm's series turned to face down the panel. At a = 0 it is
// the plane wave to 1e-14; at a = 1/2 the orders m and 1 - m pair off and
// cancel on theta = 0, so the shadow line is an exact zero.
//
// Which a? The flux F in quanta enters only as exp(2 pi i F) round a loop,
// so F and F + 1 are the same physics, and a whole quantum can be taken out
// by a gauge change. The picture takes one out, a = F - 1, so F = 1 is the
// bare plane wave exactly, as F = 0 would be. Over the knob's range a runs
// from -1/2 to 1/2: the two ends are both half a quantum, drawn in gauges a
// quantum apart, and come out as mirror images, the same seam with the
// colours of its sides swapped. The orders' sum is done for an LED and its
// mirror across the shadow line at once, since they share r and differ only
// in the sign of theta.
const MM = 260, ROWS = 32;

// A field is worked out in a buffer of its own, ROWS rows a frame, while the
// last finished one stays on the panel; the first appears after 4 frames.
function newField() {
  return { amp: new Float32Array(N), ph: new Float32Array(N), lag: new Float32Array(N), lam: 0, flux: 0, row: 0, a: 0, k: 0, nuP: 0, nuQ: 0, wP: null, wQ: null };
}
function begin(S, G, F, lam) {
  const a = F - 1, fr = (x) => x - floor(x);
  Object.assign(G, { lam, flux: F, row: 0, a, k: (2 * PI) / lam, nuP: fr(-a), nuQ: fr(a) });
  G.wP = weights(G.nuP, MM);
  G.wQ = weights(G.nuQ, MM);
  const { fam, nn, cr, ci } = S;
  for (let m = -MM; m <= MM; m++) {
    const d = m - a, j = m + MM, sg = m & 1 ? -1 : 1, nu = abs(d);
    if (d >= 0) (fam[j] = 0), (nn[j] = round(d - G.nuP));
    else (fam[j] = 1), (nn[j] = round(-d - G.nuQ));
    cr[j] = sg * cos((PI * nu) / 2);
    ci[j] = -sg * sin((PI * nu) / 2);
  }
}
function rows(S, G, y0, y1) {
  const { JP, JQ, fam, nn, cr, ci } = S, { amp, ph, lag, k, nuP, nuQ, wP, wQ } = G;
  const put = (p, re, im, ox) => {
    amp[p] = sqrt(re * re + im * im);
    ph[p] = atan2(im, re);
    // The slip behind the bare wave exp(i k x), in turns, -1/2 to 1/2.
    const l = (ph[p] - ox) / (2 * PI);
    lag[p] = l - round(l);
  };
  for (let y = y0; y < y1; y++) {
    const X = y + 0.5 - TY;
    for (let x = HALF; x < W; x++) {
      const Y = x + 0.5 - TX, r = sqrt(X * X + Y * Y), th = atan2(Y, X), z = k * r;
      let M = ceil(z + 8 * cbrt(z) + 16);
      M = min(MM - 2, M + (M & 1));
      besselRun(nuP, z, M + 1, wP, JP);
      besselRun(nuQ, z, M + 1, wQ, JQ);
      // A = sum c_m J cos(m theta), B = sum c_m J sin(m theta), both complex;
      // psi(theta) = A + iB and psi(-theta) = A - iB.
      let Ar = 0, Ai = 0, Br = 0, Bi = 0, cm = 1, sm = 0;
      const c1 = cos(th), s1 = sin(th);
      for (let m = 0; m <= M; m++) {
        let j = m + MM, J = fam[j] ? JQ[nn[j]] : JP[nn[j]];
        (Ar += cr[j] * J * cm), (Ai += ci[j] * J * cm), (Br += cr[j] * J * sm), (Bi += ci[j] * J * sm);
        if (m > 0) {
          (j = MM - m), (J = fam[j] ? JQ[nn[j]] : JP[nn[j]]);
          (Ar += cr[j] * J * cm), (Ai += ci[j] * J * cm), (Br -= cr[j] * J * sm), (Bi -= ci[j] * J * sm);
        }
        const t = cm * c1 - sm * s1;
        sm = sm * c1 + cm * s1;
        cm = t;
      }
      put(y * W + x, Ar - Bi, Ai + Br, k * X);
      put(y * W + W - 1 - x, Ar + Bi, Ai - Br, k * X);
    }
  }
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, t: 0, cur: null, job: null, spare: [newField(), newField()],
    JP: new Float64Array(MM + 2), JQ: new Float64Array(MM + 2),
    fam: new Int8Array(2 * MM + 1), nn: new Int32Array(2 * MM + 1), cr: new Float64Array(2 * MM + 1), ci: new Float64Array(2 * MM + 1),
    c: [0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 7, 0.5], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  // A new field starts only when the wavelength or the flux has moved by a
  // visible step; turning the knob again restarts it.
  const lam = round(cl(k[2], 7, 16) * 20) / 20, flux = round(cl(k[3], 0.5, 1.5) * 200) / 200;
  const aim = S.job || S.cur;
  if (!aim || aim.lam !== lam || aim.flux !== flux) {
    S.job = S.spare.find((G) => G !== S.cur);
    begin(S, S.job, flux, lam);
  }
  if (S.job) {
    const G = S.job, y1 = min(H, G.row + ROWS);
    rows(S, G, G.row, y1);
    G.row = y1;
    if (y1 >= H) (S.cur = G), (S.job = null);
  }
  S.t += d;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.cur) return;
  const { amp, ph, lag, lam } = S.cur, c = S.c;
  // Crests run down at 4 * Speed LEDs a second: the phase turns by k v t.
  const wt = ((2 * PI) / lam) * 4 * S.speed * S.t, h0 = 0.62 + S.hue;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, A = amp[p];
      const re = A * cos(ph[p] - wt);
      const crest = re > 0 ? pow(re, 1.6) : 0;
      const v = min(1, 0.07 * A + 0.93 * crest);
      hsv(h0 + lag[p], 0.85 - 0.35 * crest * crest, v, c);
      display.setPixel(x, y, (255 * c[0]) | 0, (255 * c[1]) | 0, (255 * c[2]) | 0);
    }
  // The tube itself, end on: a small white core.
  for (let p = 0; p < 4; p++) display.setPixel(31 + (p & 1), 41 + (p >> 1), 235, 235, 245);
}
