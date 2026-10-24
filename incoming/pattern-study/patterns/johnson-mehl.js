// ===== Patternflow pattern =====
// Title:   Johnson-Mehl
// Family:  cells
// Idea:    Crystal grains are born at random places and random times, each grows as a disc at one speed with a bright rim on its front, and every LED belongs to the grain that reaches it first, so grains born late meet the early ones along curved hyperbola arcs rather than the straight edges of a Voronoi diagram; when a phase has filled the panel the next one nucleates and grows over it, and a strip along the top plots the share already turned against Avrami's curve.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Johnson-Mehl tessellation (William Johnson and Robert Mehl, 1939), with Avrami's law (Melvin Avrami, 1939), pattern round 37
// Round:   37
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Rate=4..80, Mode=0..1
//
// Knob 1: Hue. Turns the three phases round the wheel together. At 0 they come in blue, gold and rose, each grain a shade of its phase picked at random, as a crystal's orientation would be; at 0.4 red, cyan and green; at 0.6 yellow, indigo and cyan.
// Knob 2: Speed. The fronts move 2 LEDs a second times the knob, 4 at 2, and at the start a phase fills the field in about 7.7 s; at 0.2 it takes 77 s.
// Knob 3: Rate. The nucleation rate in nuclei per 10,000 LEDs a second at Speed 1, on the ground the phase has not yet taken. At 4 a filled field holds about 32 grains, 25 to 41, counting those the edges cut; at 80 about 180, and at Speed 2 a phase fills in 3.0 s instead of 7.7, as Avrami's time goes as the rate to the power -1/3.
// Knob 4: Mode. How the nuclei are born. At 0 at a steady rate while the phase grows, pure Johnson-Mehl: a grain born late stays small and round, and its border with an older one is the hyperbola arc where the distances to the two nuclei differ by as far as a front grows between their two births. At 1 they are all born at once and the grains make a Voronoi diagram with straight edges. Between, that share of them is born at once. The grain count stays about the same over the whole knob, and Avrami's exponent goes from 3 to 2.
// Buttons: K1 tap starts the next phase at once, over whatever has turned so far.

// Johnson and Mehl, and Avrami in the same year, asked how much of a sample
// has turned by time t when nuclei appear at random, at rate I on the ground
// not yet turned, and every grain grows at speed V. In the plane the answer
// is X(t) = 1 - exp(-(pi / 3) I V^2 t^3). The exponent counts the nuclei, real
// or phantom, whose discs would have reached a point by t; the chance that
// none has is its exponential. A nucleus that falls on turned ground is a
// phantom and is dropped: nucleate() looks at its cell first.
//
// Checked on this field, 64 by 115 LEDs, averaged over 120 phases at the
// start knobs: the share turned stays within 0.015 of Avrami's curve all the
// way; in Mode 1 within 0.013, at Rate 80 within 0.009. One phase alone
// strays more, a median of 0.094 at Rate 4 and 0.034 at Rate 80, and the
// strip shows one phase. Without the margin below the edges of the field
// starve, as no grain can come in from outside: the share lagged the curve
// by up to 0.063, and a phase took 2.14 Avrami times to fill instead of 1.82.

// The plot takes the top 12 rows, a dark row parts it from the field, and
// the field is the other 115.
const W = 64, H = 128, TOP = 12, FY = TOP + 1, FH = H - FY, FN = W * FH;
// The grains grow on a grid 24 LEDs wider than the field on every side, and
// nuclei are born there too, so the field is a window on a larger sample.
const M = 24, GW = W + 2 * M, GH = FH + 2 * M, GN = GW * GH;
// Growth speed in LEDs a second at Speed 1; rate in nuclei per 10,000 LEDs
// a second at Speed 1. The rim is the last 0.8 s of growth, 1.6 LEDs.
const V = 2, RATE_UNIT = 1e-4, RIM = 0.8, CACHE = 4096;
const { floor, sqrt, exp, log, random, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const G43 = 0.89298; // Gamma(4/3)
// The phases take turns in three hues, blue, gold and rose at Hue 0, so a
// phase never grows over one of its own colour, not even after a tap has
// left two phases showing underneath it.
const PHASE = [0.56, 0.1, 0.88];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = 255 * (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p);
  out[o + 1] = 255 * (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p);
  out[o + 2] = 255 * (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p);
}

// Two numbers in [0, 1) from a grain's id: its orientation and its shade.
function hash(id, salt) {
  let h = Math.imul(id ^ salt, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

export function setup(params) {
  params.s = {
    ready: false, hue: 0, speed: 2, rate: 4, mode: 0.06,
    clock: 0, gen: 0, nextId: 1, nextBirth: Infinity, lambda: 0, ns: 0,
    T: new Float32Array(GN), O: new Int32Array(GN), U: new Int32Array(FN), UP: new Uint8Array(FN),
    meas: new Float32Array(W), filled: 0, X: 0, tEnd: 1,
    cId: new Int32Array(CACHE).fill(-1), cRGB: new Float32Array(CACHE * 3), cHue: NaN, rgb: new Float32Array(3),
  };
}

// The rate of the continuous part and the density of the nuclei all born
// at once. A pure Johnson-Mehl run with rate I ends with I Gamma(4/3) tau
// grains per LED, tau = (3 / (pi I V^2))^(1/3) the time at which Avrami's
// exponent reaches 1. Mode m moves that share m of them to time 0, so the
// grain count stays about the same from one end of the knob to the other.
function rates(S) {
  const I = S.rate * RATE_UNIT, tau = Math.cbrt(3 / (PI * I * V * V));
  return { I, cont: (1 - S.mode) * I, sat: S.mode * I * G43 * tau };
}

function nucleate(S, x, y, t) {
  const { T, O } = S;
  const cx = floor(x), cy = floor(y);
  if (T[cy * GW + cx] <= t) return false;
  const id = S.nextId++;
  // T_i(p) = t_i + |p - x_i| / V, kept where it is the earliest. Only as
  // far as the front can get by 2.5 plot spans, five times Avrami's time;
  // by then a cell is still open with odds of exp(-25) or less. At Rate 80
  // in Mode 1 that cut the 400 nuclei born on one frame from 18 ms to 3.
  const R = V * max(0, 2.5 * S.tEnd - t);
  const i0 = max(0, floor(x - R)), i1 = min(GW - 1, floor(x + R)), j0 = max(0, floor(y - R)), j1 = min(GH - 1, floor(y + R));
  for (let j = j0; j <= j1; j++) {
    const dy = j + 0.5 - y, dy2 = dy * dy;
    for (let i = i0, c = j * GW + i0; i <= i1; i++, c++) {
      const dx = i + 0.5 - x, a = t + sqrt(dx * dx + dy2) / V;
      if (a < T[c]) {
        T[c] = a;
        O[c] = id;
      }
    }
  }
  return true;
}

function drawWait(S) {
  S.nextBirth = S.lambda > 0 ? S.clock - log(1 - random()) / S.lambda : Infinity;
}

// A new phase: what shows now becomes the layer underneath, the grid is
// cleared, and the site-saturated share is born at once.
function nextPhase(S) {
  const { T, O, U, UP } = S, par = S.gen % 3;
  for (let y = 0; y < FH; y++)
    for (let x = 0; x < W; x++) {
      const c = (y + M) * GW + x + M, p = y * W + x;
      if (T[c] <= S.clock && O[c] > 0) {
        U[p] = O[c];
        UP[p] = par;
      }
    }
  S.gen++;
  S.clock = 0;
  T.fill(Infinity);
  O.fill(0);
  const r = rates(S);
  S.ns = r.sat;
  S.lambda = r.cont * GN;
  // The span first: it sets how far each nucleus below is drawn.
  theoryEnd(S);
  // A Poisson count of nuclei at time 0, by inversion.
  const mean = r.sat * GN;
  let n = 0;
  if (mean > 0) {
    let L = exp(-min(mean, 600)), p = 1, u = random();
    if (mean > 600) n = floor(mean);
    else {
      let acc = L;
      while (u > acc && n < 4000) {
        n++;
        p *= mean / n;
        acc += L * p;
      }
    }
  }
  for (let i = 0; i < n; i++) nucleate(S, random() * GW, random() * GH, 0);
  drawWait(S);
  S.meas.fill(0);
  S.filled = 0;
  S.X = 0;
}

// Avrami: X(t) = 1 - exp(-pi V^2 (Ns t^2 + (1 - m) I t^3 / 3)). The plot
// runs to twice the time at which the exponent is 1.
function avramiExp(S, t) {
  const r = rates(S);
  return PI * V * V * (S.ns * t * t + (r.cont * t * t * t) / 3);
}
function theoryEnd(S) {
  let lo = 0, hi = 1;
  while (avramiExp(S, hi) < 1) hi *= 2;
  for (let k = 0; k < 40; k++) {
    const mid = 0.5 * (lo + hi);
    if (avramiExp(S, mid) < 1) lo = mid;
    else hi = mid;
  }
  S.tEnd = 2 * hi;
}

// Advance the clock by d, birthing the continuous nuclei in order, and
// measure the share of the field turned.
function advance(S, d) {
  const target = S.clock + d;
  while (S.nextBirth <= target) {
    S.clock = S.nextBirth;
    nucleate(S, random() * GW, random() * GH, S.clock);
    drawWait(S);
  }
  S.clock = target;
  let n = 0;
  const T = S.T;
  for (let y = 0; y < FH; y++) for (let c = (y + M) * GW + M, e = c + W; c < e; c++) if (T[c] <= target) n++;
  S.X = n / FN;
  return n === FN;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 4, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.rate = cl(k[2], 4, 80);
  S.mode = cl(k[3], 0, 1);
  const lam = rates(S).cont * GN;
  if (lam !== S.lambda) {
    S.lambda = lam;
    drawWait(S);
    theoryEnd(S);
  }
  if (!S.ready) {
    // The first phase grows to the end before the first frame, so the
    // panel opens full and the second phase starts over it.
    S.gen = 2;
    nextPhase(S);
    while (!advance(S, 0.25) && S.clock < 3 * S.tEnd);
    nextPhase(S);
    S.ready = true;
  }
  const tap = input.btnPressed && input.btnPressed[0];
  const full = advance(S, d * S.speed);
  // The plot takes one column per 64th of its time span.
  while (S.filled < W && S.clock >= ((S.filled + 1) / W) * S.tEnd) S.meas[S.filled++] = S.X;
  if (full || tap || S.clock > 3 * S.tEnd) nextPhase(S);
}

function grainRGB(S, id, par, out) {
  const slot = id & (CACHE - 1), o = slot * 3;
  if (S.cId[slot] === id * 3 + par) {
    out[0] = S.cRGB[o];
    out[1] = S.cRGB[o + 1];
    out[2] = S.cRGB[o + 2];
    return;
  }
  const th = hash(id, 0x51ed), q = hash(id, 0x2c1b);
  let h = S.hue + PHASE[par] + (th - 0.5) * 0.1;
  h -= floor(h);
  // Red, orange, gold and yellow keep their brightness and change shade by
  // saturation; a darker gold reads olive and a darker orange brown. The
  // lift fades out over lime and over rose.
  const warm = h < 0.2 ? 1 : h < 0.27 ? (0.27 - h) / 0.07 : h > 0.95 ? 1 : h > 0.89 ? (h - 0.89) / 0.06 : 0;
  const s = 0.5 + 0.4 * q - 0.05 * warm, v = 0.6 + 0.4 * (1 - q) + warm * (0.32 - 0.32 * (1 - q));
  hsv(h, s, v, S.cRGB, o);
  S.cId[slot] = id * 3 + par;
  out[0] = S.cRGB[o];
  out[1] = S.cRGB[o + 1];
  out[2] = S.cRGB[o + 2];
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.cHue !== S.hue) {
    S.cId.fill(-1);
    S.cHue = S.hue;
  }
  const { T, O, U, UP, clock, rgb } = S, par = S.gen % 3;
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < W; x++) {
      const c = (y + M) * GW + x + M, p = y * W + x;
      let r, g, b;
      if (T[c] <= clock) {
        const id = O[c];
        grainRGB(S, id, par, rgb);
        r = rgb[0];
        g = rgb[1];
        b = rgb[2];
        const edge = (x + 1 < W && T[c + 1] <= clock && O[c + 1] !== id) || (y + 1 < FH && T[c + GW] <= clock && O[c + GW] !== id);
        if (edge) (r *= 0.15), (g *= 0.15), (b *= 0.15);
        else {
          const age = clock - T[c];
          if (age < RIM) {
            const w = 0.8 * (1 - age / RIM);
            r += (255 - r) * w;
            g += (255 - g) * w;
            b += (255 - b) * w;
          }
        }
      } else {
        const id = U[p];
        grainRGB(S, id, UP[p], rgb);
        r = rgb[0];
        g = rgb[1];
        b = rgb[2];
        const edge = (x + 1 < W && T[c + 1] > clock && U[p + 1] !== id) || (y + 1 < FH && T[c + GW] > clock && U[p + W] !== id);
        if (edge) (r *= 0.15), (g *= 0.15), (b *= 0.15);
      }
      display.setPixel(x, y + FY, r, g, b);
    }
  }
  // The plot: the share of the field turned so far, one column per 64th of
  // the span, filled in the new phase's colour on black, and Avrami's curve
  // as a pale line across the whole width. A dim fill read brown in gold.
  const newC = [0, 0, 0];
  hsv(S.hue + PHASE[par], 0.75, 1, newC, 0);
  let prev = -1;
  for (let x = 0; x < W; x++) {
    const hgt = x < S.filled ? S.meas[x] * TOP : 0;
    for (let yy = 0; yy < TOP; yy++) {
      const f = cl(hgt - (TOP - 1 - yy), 0, 1);
      if (f > 0) display.setPixel(x, yy, newC[0] * f, newC[1] * f, newC[2] * f);
    }
    const t = ((x + 1) / W) * S.tEnd, X = 1 - exp(-avramiExp(S, t)), row = cl(floor((1 - X) * TOP - 0.001), 0, TOP - 1);
    const a = prev < 0 ? row : min(prev, row), bnd = prev < 0 ? row : max(prev, row);
    for (let yy = a; yy <= bnd; yy++) display.setPixel(x, yy, 235, 235, 235);
    prev = row;
  }
}
