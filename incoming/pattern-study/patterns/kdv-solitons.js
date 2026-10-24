// ===== Patternflow pattern =====
// Title:   KdV Solitons
// Family:  wave
// Idea:    Zabusky and Kruskal's numerical experiment as a space-time diagram falling down the panel: the top row is the wave now, a cosine that steepens, nearly breaks and splits into a train of solitons, each a bright ridge whose slant is its speed, the tall fast ones passing through the small slow ones with a sideways jog, until the whole train pinches back together into the cosine and fans out again.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: solitons of the Korteweg-de Vries equation (Norman Zabusky and Martin Kruskal, 1965), pattern round 31
// Round:   31
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Dispersion=0..1, Start=0..1
//
// Knob 1: Hue. Turns the crest colour round the wheel; at 0 the crests are cyan over indigo troughs and the tallest go pale.
// Knob 2: Speed. How fast the equation runs and the diagram falls: at 2 the cosine breaks after half a second, the panel holds the last five seconds and the train gathers back into the cosine after sixteen; at 0.2 everything is ten times slower.
// Knob 3: Dispersion. The delta of the equation, 0.022 at 0 as in the 1965 paper, giving eight thin solitons; turned up to 0.06 at 1 the cosine breaks into three wide ones and gathers back almost three times as often.
// Knob 4: Start. The wave each run starts from: the cosine of the paper, two humps of unequal height, a flat plateau whose front edge breaks into a ranked train, or a random sum of five cosines drawn fresh each run.
// Buttons: K1 tap drops a tall sech-squared soliton into the lowest trough of the wave, a pale ridge that races through the whole train.

const W = 64, H = 128;
const { min, max, floor, abs, sqrt, cos, sin, exp, tanh, cosh, atan2, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The equation u_t + u u_x + delta^2 u_xxx = 0 on a ring of length 2, held on
// 256 points, four to an LED column.
const NX = 256, MK = NX - 1, DX = 2 / NX, SUB = NX / W;
// Rows of the diagram per unit of time, and history rows kept.
const RPT = 40, HR = H + 2;
// Robert-Asselin filter on the leapfrog's middle level: it damps the
// odd-even mode that otherwise grows to overflow after about five time units,
// and takes under one percent off a soliton over a whole run.
const NU = 0.001;
// Colour table over the height above the troughs, from UL to UH.
const NL = 512, UL = -0.5, UH = 5;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// Dark troughs, the crest hue at the top of a soliton, pale at the very top.
// Below the crest the hue leans away round the wheel, so the small solitons
// and the ripples between read as deeper water rather than a dim copy of the
// crests. A dim orange or yellow reads brown or olive, so for crests from
// pink round to yellow the lean runs the other way, through violet,
// magenta and red, and only the brightest tones reach the crest hue; the two
// leans meet at a yellow green, where the middle tones change side.
const LH = [0, 0.08, 0.17, 0.27, 0.27, 0.33, 0.5, 0.67, 0.83, 0.92, 1];
const LL = [-0.3, -0.36, -0.42, -0.47, 0.53, 0.15, 0.12, 0.12, 0, -0.2, -0.3];
function lean(h) {
  h -= floor(h);
  for (let i = 1; i < LH.length; i++) if (h <= LH[i] && LH[i] > LH[i - 1]) return LL[i - 1] + ((LL[i] - LL[i - 1]) * (h - LH[i - 1])) / (LH[i] - LH[i - 1]);
  return LL[0];
}
function palette(P) {
  const t = P.lut, h0 = P.hue + 0.5, L = lean(h0);
  for (let i = 0; i < NL; i++) {
    const e = UL + ((UH - UL) * i) / (NL - 1);
    const v = cl(e / 2.5, 0, 1), w = cl((e - 2.1) / 1.4, 0, 1), q = cl((e - 0.3) / 1.9, 0, 1);
    hsv(h0 + L * (1 - q) ** 0.6, 0.9 - 0.8 * w * w, 0.04 + 0.96 * v ** 1.15, t, i * 3);
  }
  P.lutHue = P.hue;
}

// du/dt at point i in the scheme's own differences.
function rhs(u, i, d2) {
  const m2 = u[(i - 2) & MK], m1 = u[(i - 1) & MK], z = u[i], p1 = u[(i + 1) & MK], p2 = u[(i + 2) & MK];
  return -((p1 + z + m1) * (p1 - m1)) / (6 * DX) - (d2 * (p2 - 2 * p1 + 2 * m1 - m2)) / (2 * DX * DX * DX);
}

// Leapfrog is stable while dt times the largest rate of the linear scheme
// stays under 1: |u|/dx for the u u_x term and 2.6 delta^2/dx^3 for the
// third derivative (its worst wave is three grid cells long). A new dt, or a
// new wave, starts the leapfrog again with one step back by Euler.
function restartLeap(P) {
  const d2 = P.delta * P.delta;
  P.dt = 0.85 / (P.umax / DX + (2.6 * d2) / (DX * DX * DX));
  const a = P.ua, b = P.ub;
  for (let i = 0; i < NX; i++) a[i] = b[i] - P.dt * rhs(b, i, d2);
}

// A starting wave into out, mean zero. Places and heights for the humps,
// the plateau and the random sum are drawn fresh each run.
function makeWave(P, kind, phase, out) {
  const R = P.rnd;
  if (kind) {
    R[0] = Math.random() * 2;
    R[1] = R[0] + 0.7 + Math.random() * 0.6;
    R[2] = 1.05 + Math.random() * 0.3;
    R[3] = 0.6 + Math.random() * 0.3;
    for (let k = 1; k <= 5; k++) (R[3 + k] = (0.3 + Math.random()) / k), (R[8 + k] = Math.random() * 2 * PI);
  }
  for (let i = 0; i < NX; i++) {
    const x = i * DX;
    let v = 0;
    if (kind === 0) v = cos(PI * (x - phase));
    else if (kind === 1) {
      // Two humps, about 1.2 and 0.75 high.
      const d1 = ((x - R[0] + 3) % 2) - 1, d2 = ((x - R[1] + 3) % 2) - 1;
      v = R[2] * exp(-((d1 / 0.3) ** 2)) + R[3] * exp(-((d2 / 0.22) ** 2));
    } else if (kind === 2) {
      // A plateau 1.1 high and 0.8 wide with soft edges.
      const d = ((x - R[0] + 3) % 2) - 1;
      v = 0.55 * (tanh((d + 0.4) / 0.05) - tanh((d - 0.4) / 0.05));
    } else for (let k = 1; k <= 5; k++) v += R[3 + k] * cos(PI * k * x + R[8 + k]);
    out[i] = v;
  }
  let s = 0, mx = 0;
  for (let i = 0; i < NX; i++) s += out[i];
  s /= NX;
  for (let i = 0; i < NX; i++) mx = max(mx, abs((out[i] -= s)));
  // The random sum peaks at 1, like the cosine.
  if (kind === 3) for (let i = 0; i < NX; i++) out[i] /= mx;
}

function begin(P, kind) {
  P.ub.set(P.tg);
  P.kind = kind;
  P.tau = 0;
  P.rec = 0;
  P.drops = 0;
  P.umax = 3;
  restartLeap(P);
}

// The wave into one row of 64 columns as height above the troughs: a
// little more than half the brightest of a column's four points and the
// rest their mean, so a thin crest keeps its peak. The trough level follows
// the lowest point of the wave over about a quarter time unit; it is -1 for
// the cosine and sinks to about -0.7 once the solitons have taken their mass.
function sample(P, out, o) {
  const u = P.ub, bg = P.bg;
  for (let c = 0, i = 0; c < W; c++) {
    let mx = -9, s = 0;
    for (let k = 0; k < SUB; k++, i++) {
      const v = u[i];
      s += v;
      if (v > mx) mx = v;
    }
    out[o + c] = 0.55 * mx + (0.45 * s) / SUB - bg;
  }
}

// The share of the wave's energy in the first cosine mode, 1 for the cosine
// itself, and where that mode's crest stands.
function mode1(P) {
  const u = P.ub;
  let c1 = 0, s1 = 0, e = 0;
  for (let i = 0; i < NX; i++) {
    const a = PI * i * DX;
    c1 += u[i] * cos(a);
    s1 += u[i] * sin(a);
    e += u[i] * u[i];
  }
  P.phase = atan2(s1, c1) / PI;
  return (2 * (c1 * c1 + s1 * s1)) / (NX * e + 1e-9);
}

// A soliton 4.4 high over the trough, in the lowest stretch of the wave. Its
// mass is taken evenly off the rest so the mean stays zero, and the older
// leapfrog level gets it one step back along its path.
function drop(P) {
  const u = P.ub, a = P.ua;
  let best = 99, at = 0;
  for (let i = 0; i < NX; i += 4) {
    let s = 0;
    for (let k = -12; k <= 12; k++) s += u[(i + k) & MK];
    if (s < best) (best = s), (at = i);
  }
  const A = 4.4, w = P.delta * sqrt(12 / A), c = best / 25 + A / 3;
  for (let pass = 0; pass < 2; pass++) {
    const tgt = pass ? a : u, back = pass ? c * P.dt : 0;
    let m = 0;
    for (let i = 0; i < NX; i++) {
      const d = ((((i - at) * DX + back + 3) % 2) - 1) / w;
      m += P.uc[i] = A / cosh(d) ** 2;
    }
    for (let i = 0; i < NX; i++) tgt[i] += P.uc[i] - m / NX;
    if (!pass) P.bg -= m / NX;
  }
}

function step(P, n) {
  const d2 = P.delta * P.delta, k1 = P.dt / (3 * DX), k2 = (d2 * P.dt) / (DX * DX * DX);
  for (let s = 0; s < n; s++) {
    const a = P.ua, b = P.ub, c = P.uc;
    for (let i = 0; i < NX; i++) {
      const m2 = b[(i - 2) & MK], m1 = b[(i - 1) & MK], z = b[i], p1 = b[(i + 1) & MK], p2 = b[(i + 2) & MK];
      c[i] = a[i] - k1 * (p1 + z + m1) * (p1 - m1) - k2 * (p2 - 2 * p1 + 2 * m1 - m2);
    }
    for (let i = 0; i < NX; i++) b[i] += NU * (a[i] - 2 * b[i] + c[i]);
    P.ua = b;
    P.ub = c;
    P.uc = a;
  }
}

export function setup(params) {
  params.s = {
    ua: new Float64Array(NX), ub: new Float64Array(NX), uc: new Float64Array(NX), tg: new Float64Array(NX),
    hist: new Float32Array(HR * W), now: new Float32Array(W), head: 0, frac: 0,
    lut: new Float32Array(NL * 3), lutHue: -1, hue: 0, speed: 2, delta: 0.022,
    dt: 1e-4, umax: 3, tau: 0, kind: -1, want: 0, wantT: 0, rnd: new Float64Array(14),
    f1: 0, rising: 0, rec: 0, phase: 1, reform: -1, toKind: 0, rem: 1, rlen: 1, bg: -1, drops: 0,
  };
}

// One row of time has passed: store it, keep dt safe, and watch for the
// moment to start a new run.
function row(P) {
  const u = P.ub;
  let um = 0, lo = 9, bad = false;
  for (let i = 0; i < NX; i++) {
    const v = u[i];
    if (!(v === v) || abs(v) > 40) bad = true;
    else if (abs(v) > um) um = abs(v);
    if (v < lo) lo = v;
  }
  if (bad) return makeWave(P, P.kind, 1, P.tg), begin(P, P.kind);
  P.bg += (lo - P.bg) * 0.1;
  P.head = (P.head + HR - 1) % HR;
  sample(P, P.hist, P.head * W);
  // A taller wave than dt was set for: a smaller dt, from here.
  if (um > 0.9 * P.umax) (P.umax = um * 1.4), restartLeap(P);
  const f = mode1(P), Tr = 0.21 / P.delta, rowT = 1 / RPT;
  // Each time the train gathers back, the energy flows into the first mode
  // and out again; a peak of that share over 0.6 is one return.
  if (f > P.f1) P.rising = 1;
  else if (P.rising && P.f1 > 0.6 && P.tau > 0.5 * Tr) (P.rising = 0), P.rec++;
  else P.rising = 0;
  P.f1 = f;
  if (P.reform < 0) {
    // The cosine runs through one return and is drawn back onto an exact
    // cosine at the second, where the returning one stands; other starts,
    // and runs a dropped soliton keeps from returning, start a fresh wave
    // after about as long.
    if (P.kind === 0 ? P.rec >= 1 && P.rising && f > 0.55 : P.tau > 1.2 * Tr) newRun(P, P.kind, P.kind ? 1 : 0.4);
    else if (P.tau > 2.6 * Tr) newRun(P, P.kind, 1);
  }
  if (P.reform >= 0) {
    // Both leapfrog levels are drawn over to the new wave, the cosine target
    // following the returning crest, so that what is left of the old wave
    // falls along a smoothstep; then the run starts from the new one exactly.
    const r = (P.reform = min(1, P.reform + rowT / P.rlen)), rem = 1 - r * r * (3 - 2 * r), g = P.rem > 0 ? 1 - rem / P.rem : 1;
    P.rem = rem;
    if (P.toKind === 0) for (let i = 0; i < NX; i++) P.tg[i] = cos(PI * (i * DX - P.phase));
    for (let i = 0; i < NX; i++) (u[i] += (P.tg[i] - u[i]) * g), (P.ua[i] += (P.tg[i] - P.ua[i]) * g);
    if (r >= 1) (P.reform = -1), begin(P, P.toKind);
  }
}

// A new run toward a wave of this kind, drawn over in len time units: 0.4
// for the cosine coming back to itself, a whole unit for a different wave.
function newRun(P, kind, len) {
  P.reform = 0;
  P.rem = 1;
  P.rlen = len;
  P.toKind = kind;
  makeWave(P, kind, P.phase, P.tg);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = cl(k[0], 0, 1);
  P.speed = cl(k[1], 0.2, 3);
  // Delta from 0.022 to 0.06 on a log scale.
  const delta = 0.022 * (0.06 / 0.022) ** cl(k[2], 0, 1);
  const kind = min(3, floor(cl(k[3], 0, 1) * 4));
  if (abs(delta - P.delta) > 1e-6) (P.delta = delta), restartLeap(P);
  if (P.kind < 0) {
    // Before the first frame the panel shows the starting wave as if it had
    // been held still, so the diagram falls out of it.
    makeWave(P, kind, 1, P.tg);
    begin(P, kind);
    P.bg = 9;
    for (let i = 0; i < NX; i++) P.bg = min(P.bg, P.ub[i]);
    sample(P, P.hist, 0);
    for (let r = 1; r < HR; r++) P.hist.copyWithin(r * W, 0, W);
  }
  // A new Start is taken once the knob has rested on it a quarter second,
  // and the wave is drawn over into it like any new run.
  if (kind === (P.reform >= 0 ? P.toKind : P.kind)) P.wantT = 0;
  else {
    if (kind !== P.want) (P.want = kind), (P.wantT = 0);
    if ((P.wantT += d) > 0.25) newRun(P, kind, 1);
  }
  const b = input.btnPressed || [];
  // Four drops a run at most; past that the train is lost in white.
  if (b[0] && P.drops < 4) P.drops++, drop(P);

  // 0.6 time units a second at Speed 2; the cosine breaks at 1/pi.
  let left = d * P.speed * 0.3;
  const rowT = 1 / RPT;
  while (left > 1e-12) {
    const run = min(left, (1 - P.frac) * rowT);
    step(P, min(4000, max(1, round(run / P.dt))));
    P.tau += run;
    left -= run;
    P.frac += run / rowT;
    if (P.frac >= 1 - 1e-9) (P.frac = 0), row(P);
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P || P.kind < 0) return;
  if (P.lutHue !== P.hue) palette(P);
  const now = P.now, hist = P.hist, lut = P.lut, f = P.frac, sc = (NL - 1) / (UH - UL);
  sample(P, now, 0);
  for (let y = 0; y < H; y++) {
    // Row y is the wave y rows of time ago. The newest stored row is f rows
    // old; the top row is the wave now.
    let ra = hist, ia, ib, w;
    if (y <= f) (ra = now), (ia = 0), (ib = P.head * W), (w = f > 0 ? y / f : 0);
    else {
      const kk = floor(y - f);
      ia = ((P.head + kk) % HR) * W;
      ib = ((P.head + kk + 1) % HR) * W;
      w = y - f - kk;
    }
    for (let x = 0; x < W; x++) {
      const u = ra[ia + x] + (hist[ib + x] - ra[ia + x]) * w;
      const o = cl(round((u - UL) * sc), 0, NL - 1) * 3;
      display.setPixel(x, y, lut[o], lut[o + 1], lut[o + 2]);
    }
  }
}
