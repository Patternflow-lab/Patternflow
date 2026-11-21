// ===== Patternflow pattern =====
// Title:   Butterfly Diagram
// Family:  dynamo
// Idea:    The Sun's magnetic record drawn as a strip chart that scrolls left, solar latitude up the panel with the north pole at the top and the south pole at the bottom and the equator along the middle, time across it with the newest year entering at the right edge, where soft blobs of sunspot groups coloured by their magnetic polarity fall into the two mirrored wings of the butterfly that start near 33 degrees at the beginning of each eleven-year cycle and narrow to the equator as it ends, successive cycles overlapping there, the colours swapping between hemispheres and from cycle to cycle, and dim polar caps at the top and bottom that fade out and come back in the other colour a year or two after each maximum.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the sunspot butterfly diagram (E. Walter Maunder, 1904), Sporer's law of the belt drifting to the equator (Gustav Sporer in the 1860s from Richard Carrington's drawings of 1858), Hale's polarity law (George Ellery Hale, 1919), the Babcock-Leighton dynamo with its polar field reversing near each maximum (Horace Babcock, 1961; Robert Leighton, 1969), the Waldmeier effect of stronger cycles rising faster (Max Waldmeier, 1935), pattern round 213
// Round:   213
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.4..3, Activity=-1..1, Spread=-1..1
//
// Knob 1: Hue. Turns the two polarity colours round the wheel together, 0.535 of a turn apart. At 0 the polarity that leads in the north in even cycles is orange-red (hue 0.055) and the other is steel blue (0.59); at 0.25 they are green and magenta; at 0.5 the two colours have swapped places, sky blue and orange; at 1 it is back at the start.
// Knob 2: Speed. How fast the chart scrolls, 0.25 years of Sun time a second for each unit of Speed, at 2.6 LEDs a year: 0.26 LEDs a second at 0.4, 1.3 where it opens at 2 and 1.95 at 3. At the opening a cycle of 11 years is 29 LEDs wide and crosses the panel in 22 seconds, and the 64 columns hold 24.6 years.
// Knob 3: Activity. How many spots there are and how bright. The Activity is 1 + 0.6 K, so 0.4 at -1, 1 where it opens at 0 and 1.6 at 1, and it shows that share of the spots the Sun is holding, 25, 62 and 100 percent: about 60, 160 and 250 groups in the 24.6 years on the panel. Brightness goes with 0.7 + 0.3 Activity. At -1 it is a grand-minimum sprinkle of small blobs along the thin glow of the belts; at 1 the maximum is crowded and the wings still read. The belt glow follows it more gently, with the 0.3 power.
// Knob 4: Spread. How wide the belts are and how steeply they fall to the equator, with s = (K + 1) / 2. The belt is 1.3 + 2.6 s degrees across (one sigma), starts at 35 - 4 s degrees and ends at 4 + 6 s. At -1 that is 1.3 degrees from 35 to 4, thin and steep; where it opens, at 0.06, 2.7 degrees from 33 to 7; at 1 it is 3.9 degrees and falls only from 31 to 10, so the wings are fat and shallow. The glow and the spots are lifted by 0.85 + 0.6 s and 0.85 + 0.45 s as the belt widens, so fat wings do not go dim. The chart is redrawn from the cycles, so turning it reshapes the history on the panel as well as what arrives.

// What the chart is. Each LED row is a slice of solar latitude, 1.12 LEDs a degree up to 45 degrees
// and 0.30 a degree above, which gives the spot belts room and keeps the poles on the panel. The equator
// is the line between rows 63 and 64. Time runs along the other axis: the right edge is the present,
// and a column is the year that was at the Sun when its spots were seen. Nothing is kept as pixels. The
// picture is a function of the chart time at each column and the row, summed over the events near it, so
// the scroll is smooth to a fraction of an LED and the model only has to say which events there are.
//
// Cycles. Cycle k has a minimum at m(k), a length L between 9 and 14 years (11 plus 1.35 sigma, clamped),
// an amplitude A between 0.55 and 1.75 (lognormal, sigma 0.34) and a polarity sign, +1 for the even
// cycles and -1 for the odd ones. Its spots exist from 0.18 L before its minimum to 0.18 L after the
// next one, a span of 1.36 L, so that it overlaps each neighbour for about four years in its tails.
// The phase tau runs 0 to 1 across the span. The activity follows a raised cosine up and a raised cosine
// down, peaking at 0.40 - 0.13 (A - 1) of L after the minimum, between 0.30 and 0.48. That is the
// Waldmeier effect: a cycle of 1.75 rises in 3.3 years of 11, one of 0.55 in 5.0. The first five cycles
// are drawn with A between 0.85 and 1.5, so that the opening never shows a weak one.
// The belt of a hemisphere lies at lat = a - (a - b) tau^0.85 degrees, a = 35 - 4 s and b = 4 + 6 s for the
// spread s from 0 to 1, which is 33 - 26 tau^0.85 where the knob opens (Sporer's law). The peak is at tau 0.43
// and 20 degrees. The north and south belts run out of step by a random amount (sigma 4 percent of L,
// at most 8) and have strengths 1 + n and 1 - n, with n a Gaussian of 0.26 clamped to 0.45.
// Spots scatter about the belt with sigma 1.3 + 2.6 s degrees.
//
// Spots are a seeded Poisson stream per cycle and hemisphere, in steps of 0.125 years, with rate
// 6.5 A (1 +- n) activity(tau)^0.75 groups a year when the Activity knob is at its top. Each spot carries a
// threshold, and the Activity knob shows the spots under it, over a band of 0.12, so that a turn of the knob
// fades spots in and out instead of reshuffling them. A spot is a core of 1 to 1.5 LEDs in sigma, stretched along the
// time axis by its life of 0.03 to 0.5 years, and a halo of 0.2 of its weight at 2.2 times the sigma. Its
// polarity is the cycle's sign in the north and the opposite in the south (Hale's law), with 3 percent of
// groups the wrong way round, as in the record. Under the spots lies the toroidal belt glow, the belt's own
// strength to the 0.6 power, so that the wings read as shapes where the spots are few.
//
// Polar caps. The polar field of a hemisphere reverses 1.5 years (plus or minus 0.3) after the peak of the
// activity there. In the interval between two reversals it has the sign that the next cycle's spots in that
// hemisphere will have, which is the following polarity of the cycle that is ending and, by Hale's law, the
// leading polarity of the next. Its size over the interval is u^1.15 (1 - u)^0.75, so it passes through zero
// at the reversal and is greatest near the minimum, and it is scaled by the strength of the cycle that
// built it. The south cap is the north's with the sign swapped. A cap fades in over the 24 rows from the
// pole, with the weight 0.42 at its greatest.
//
// Colour. Each polarity has its own weight at an LED. Their sum is limited to 1 - exp(-1.25 w), so a
// crowd of spots gets brighter up to the colour itself and never white, and the polarity with the larger
// share takes the LED, with the seam between two darkened instead of added.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, sqrt, sin, cos, exp, pow, abs, min, max, PI, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);

const LPY = 2.6; // LEDs a year along the time axis
const YPS = 0.25; // years of Sun time a second, for each unit of the Speed knob
const E0 = 0.18; // a cycle's spots begin this far before its minimum and end this far after the next one, in L
const STEP = 0.125; // years: the step of the Poisson stream
const RATE = 6.5; // spot groups a year in one hemisphere, a cycle of amplitude 1 at its peak, Activity at its top
const GLOW = 0.15; // weight of the belt glow at the peak of a cycle of amplitude 1
const CAPW = 0.42; // weight of the polar cap at its greatest
const GAIN = 1.25; // how fast a polarity weight saturates
const REV = 1.5; // years from the peak of the activity to the reversal of the polar field
const EQ = 64; // the equator, in LED rows from the top
const PX = 1.12, PY = (64 - 45 * 1.12) / 45; // LEDs a degree: up to 45 degrees, and above it (0.30)
const BG = [2, 3, 7];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r) {
  const u = 1 - r(), v = r();
  return sqrt(-2 * log(u)) * cos(2 * PI * v);
}
function poisson(r, lam) {
  const L = exp(-lam);
  let k = 0, p = 1;
  do {
    k++;
    p *= r();
  } while (p > L && k < 40);
  return k - 1;
}
function hsv(h, s, v) {
  h = fr(h) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const r = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  const g = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  const b = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return [r * 255, g * 255, b * 255];
}

// ---- the Sun
// row distance from the equator of a latitude in degrees, and back
const dOf = (lat) => (lat <= 45 ? lat * PX : 45 * PX + (lat - 45) * PY);
const latOfD = (d) => (d <= 45 * PX ? d / PX : 45 + (d - 45 * PX) / PY);
const sigmaDeg = (s) => 1.3 + 2.6 * s;
const latStart = (s) => 35 - 4 * s;
const latEnd = (s) => 4 + 6 * s;
const beltLat = (tau, s) => latStart(s) - (latStart(s) - latEnd(s)) * pow(cl(tau, 0, 1), 0.85);

// the activity of a cycle by its phase, peaking at wp: a raised cosine each way
function env(w, wp) {
  if (w <= 0 || w >= 1) return 0;
  if (w < wp) return 0.5 - 0.5 * cos((PI * w) / wp);
  return 0.5 + 0.5 * cos((PI * (w - wp)) / (1 - wp));
}

function makeCycle(S, prev) {
  const r = S.r;
  const k = prev ? prev.k + 1 : 0;
  const L = cl(11 + 1.35 * gauss(r), 9, 14);
  let A = cl(exp(0.34 * gauss(r)), 0.55, 1.75);
  if (k < 5) A = cl(A, 0.85, 1.5); // the cycles the opening shows are not the weak ones
  const rho = cl(0.4 - 0.13 * (A - 1), 0.3, 0.48);
  const n = cl(0.26 * gauss(r), -0.45, 0.45);
  const m = prev ? prev.m + prev.L : 0;
  const c = {
    k, m, L, A, rho,
    sgn: k % 2 === 0 ? 1 : -1,
    sN: 1 + n, sS: 1 - n,
    dN: cl(0.04 * L * gauss(r), -0.08 * L, 0.08 * L),
    dS: cl(0.04 * L * gauss(r), -0.08 * L, 0.08 * L),
    t0: m - E0 * L, span: L * (1 + 2 * E0),
    wp: (E0 + rho) / (1 + 2 * E0),
    rN: 0, rS: 0,
  };
  c.rN = m + rho * L + c.dN + REV + 0.3 * gauss(r);
  c.rS = m + rho * L + c.dS + REV + 0.3 * gauss(r);
  return c;
}
function growCycles(S, upto) {
  while (S.cyc.length === 0 || S.cyc[S.cyc.length - 1].m + S.cyc[S.cyc.length - 1].L < upto) S.cyc.push(makeCycle(S, S.cyc[S.cyc.length - 1]));
}

// one step of the Poisson stream, from t to t + STEP, for every cycle and both hemispheres
function genStep(S, t) {
  const r = S.r;
  for (const c of S.cyc) {
    if (t + STEP < c.t0 || t > c.t0 + c.span) continue;
    for (let h = 1; h >= -1; h -= 2) {
      const dh = h > 0 ? c.dN : c.dS, sH = h > 0 ? c.sN : c.sS;
      const tau = (t + STEP / 2 - c.t0 - dh) / c.span;
      if (tau <= 0 || tau >= 1) continue;
      const n = poisson(r, RATE * c.A * sH * pow(env(tau, c.wp), 0.75) * STEP);
      for (let i = 0; i < n; i++) {
        const te = t + r() * STEP;
        const tu = (te - c.t0 - dh) / c.span;
        if (tu <= 0 || tu >= 1) continue;
        const life = 0.03 + 0.5 * pow(r(), 2);
        const u = r();
        const sx = sqrt(pow(1 + 0.5 * u * u, 2) + pow(0.45 * life * LPY, 2));
        const sy = (1 + 0.5 * u * u) * (0.9 + 0.2 * r());
        let pol = c.sgn * h;
        if (r() < 0.03) pol = -pol;
        S.ev.push({
          t: te, h, tau: tu, g: gauss(r), f: r(), q: r(), pol,
          sx, sy, gain: (0.4 + 0.7 * r() * r()) * (0.8 + 0.2 * min(c.A, 1.5)),
        });
      }
    }
  }
}

export function setup(params) {
  const S = {
    r: rng((Math.random() * 4294967296) >>> 0),
    cyc: [], ev: [], T: 0, gen: 0, since: 0,
    hue: 0, speed: 2, mult: 1, sp: 0.53,
    wP: new Float32Array(NPX), wN: new Float32Array(NPX),
  };
  params.s = S;
  growCycles(S, 70);
  const c = S.cyc[3];
  S.T = c.m + c.rho * c.L + REV + 2.2; // a minute in: the opening is two years past a reversal, with two cycles behind it
  S.gen = S.cyc[0].t0;
  while (S.gen < S.T + 3.6) {
    genStep(S, S.gen);
    S.gen += STEP;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = (input && input.knobValues) || [0, 2, 0, 0.06];
  S.hue = cl(kn[0], 0, 1);
  S.speed = cl(kn[1], 0.4, 3);
  S.mult = 1 + 0.6 * cl(kn[2], -1, 1); // 0.4 .. 1.6, 1 at the opening
  S.sp = (cl(kn[3], -1, 1) + 1) / 2;
  const d = cl(dt || 0, 0, 0.1);
  S.T += d * YPS * S.speed;
  growCycles(S, S.T + 12);
  while (S.gen < S.T + 3.6) {
    genStep(S, S.gen);
    S.gen += STEP;
  }
  S.since += d;
  if (S.since > 2) {
    S.since = 0;
    const lo = S.T - 30;
    S.ev = S.ev.filter((e) => e.t > lo);
    while (S.cyc.length > 4 && S.cyc[1].m + S.cyc[1].L * 1.2 + 3 < S.T - 40) S.cyc.shift();
  }
}

// ---- drawing
function belts(S, t, x) {
  const { wP, wN, sp } = S;
  const sg = max(2.0, sigmaDeg(sp) * PX * 1.25 + 0.6);
  const act = pow(S.mult, 0.3) * (0.85 + 0.6 * sp); // wide belts are thinner in spots, so their glow is lifted
  for (const c of S.cyc) {
    if (t < c.t0 - 1 || t > c.t0 + c.span + 1.5) continue;
    for (let h = 1; h >= -1; h -= 2) {
      const tau = (t - c.t0 - (h > 0 ? c.dN : c.dS)) / c.span;
      const e = env(tau, c.wp);
      if (e < 0.003) continue;
      const amp = GLOW * act * sqrt(c.A * (h > 0 ? c.sN : c.sS)) * pow(e, 0.6);
      const Y = EQ - h * dOf(beltLat(tau, sp));
      const tgt = c.sgn * h > 0 ? wP : wN;
      for (let y = max(0, floor(Y - 3 * sg)); y <= min(H - 1, ceil(Y + 3 * sg)); y++) {
        const dy = y + 0.5 - Y;
        tgt[y * W + x] += amp * exp(-(dy * dy) / (2 * sg * sg));
      }
    }
  }
}

function polar(S, t, h) {
  const c0 = S.cyc;
  let k = -1;
  for (let i = 0; i + 1 < c0.length; i++) {
    const a = h > 0 ? c0[i].rN : c0[i].rS, b = h > 0 ? c0[i + 1].rN : c0[i + 1].rS;
    if (t >= a && t < b) {
      k = i;
      break;
    }
  }
  if (k < 0) return 0;
  const a = h > 0 ? c0[k].rN : c0[k].rS, b = h > 0 ? c0[k + 1].rN : c0[k + 1].rS;
  const u = (t - a) / (b - a);
  const hump = (pow(u, 1.15) * pow(1 - u, 0.75)) / 0.279;
  const strength = 0.5 + 0.5 * cl(c0[k].A / 1.4, 0.4, 1.2);
  return c0[k + 1].sgn * h * hump * strength; // + warm, - cool
}

function caps(S, t, x) {
  for (let h = 1; h >= -1; h -= 2) {
    const P = polar(S, t, h);
    if (abs(P) < 0.004) continue;
    const tgt = P > 0 ? S.wP : S.wN;
    for (let j = 0; j < 28; j++) {
      const y = h > 0 ? j : H - 1 - j;
      const d = abs(y + 0.5 - EQ);
      const c = pow(sm((d - 40) / 24), 1.4);
      if (c <= 0) continue;
      tgt[y * W + x] += abs(P) * CAPW * c;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { wP, wN, sp, T } = S;
  wP.fill(0);
  wN.fill(0);
  for (let x = 0; x < W; x++) {
    const t = T - (W - (x + 0.5)) / LPY;
    belts(S, t, x);
    caps(S, t, x);
  }

  // the spots
  const sd = sigmaDeg(sp);
  const acc = S.mult / 1.6;
  const bright = (0.7 + 0.3 * S.mult) * (0.85 + 0.45 * sp);
  for (const e of S.ev) {
    const X = W - (S.T - e.t) * LPY;
    if (X < -9 || X > W + 9) continue;
    const vis = cl((acc - e.q) / 0.12, 0, 1);
    if (vis <= 0) continue;
    let lat = abs(beltLat(e.tau, sp) + sd * e.g);
    if (lat < 2.2) lat = 2.2 + 1.4 * e.f;
    const Y = EQ - e.h * dOf(lat);
    const tgt = e.pol > 0 ? wP : wN;
    const g = e.gain * vis * bright;
    const ix = 1 / (2 * e.sx * e.sx), iy = 1 / (2 * e.sy * e.sy);
    const rx = 5 * e.sx, ry = 5 * e.sy;
    for (let y = max(0, floor(Y - ry)); y <= min(H - 1, ceil(Y + ry)); y++) {
      const dy = y + 0.5 - Y;
      const qy = dy * dy * iy;
      for (let xx = max(0, floor(X - rx)); xx <= min(W - 1, ceil(X + rx)); xx++) {
        const dx = xx + 0.5 - X;
        const q = dx * dx * ix + qy;
        if (q > 12) continue;
        tgt[y * W + xx] += g * (exp(-q) + 0.2 * exp(-q * 0.2));
      }
    }
  }

  // the colours of the two polarities
  const cP = hsv(0.055 + S.hue, 0.92, 1);
  const cN = hsv(0.59 + S.hue, 0.75, 1);
  for (let y = 0; y < H; y++) {
    const hair = y === EQ - 1 || y === EQ ? 1 : 0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const tot = wP[i] + wN[i];
      let f = 1 - exp(-GAIN * tot), m = 0.5;
      if (tot > 1e-5) {
        // where the polarities meet, the stronger takes the LED and the seam goes dark rather than white
        m = sm((wP[i] / tot - 0.35) / 0.3);
        f *= 1 - 1.4 * m * (1 - m);
      }
      display.setPixel(
        x, y,
        Math.round(min(255, BG[0] + 6 * hair + (cN[0] + (cP[0] - cN[0]) * m) * f)),
        Math.round(min(255, BG[1] + 8 * hair + (cN[1] + (cP[1] - cN[1]) * m) * f)),
        Math.round(min(255, BG[2] + 14 * hair + (cN[2] + (cP[2] - cN[2]) * m) * f)),
      );
    }
  }
}
