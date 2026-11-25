// ===== Patternflow pattern =====
// Title:   Critical Slowing
// Family:  tipping
// Idea:    A hundred or so noisy balls sit in the left well of a glowing landscape seen from the side while a slowly wandering control parameter tilts it, so the well flattens until its bottom is a plateau, the swarm swells and its wobble slows to a crawl and warms from teal through violet to amber, and at the fold the well vanishes and the swarm pours white-hot over the ledge into the far well, where it sits, the ground under the landscape keeping a layered record of the climb, until the control parameter has wandered far enough back for that well to vanish in its turn.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: critical slowing down before a saddle-node bifurcation (Wissel 1984; Scheffer et al. 2009, "Early-warning signals for critical transitions": variance and lag-1 autocorrelation rise as the restoring force weakens, from memory), hysteresis of a bistable system in the potential U = x^4/4 + c x^3/3 - x^2/2 - r x under overdamped Langevin noise (Euler-Maruyama substeps of 1/120 s), pattern round 241
// Round:   241
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Noise=0..4, Drift=-1..1, Swarm=-1..1
//
// Knob 1: Hue. Turns the whole colour ramp round the wheel. At 0 a calm swarm and landscape are teal, a well that is flattening goes blue, violet and rose, the plateau and the balls on it amber, and a swarm in free fall white. At 0.25 the calm colour is violet and the warm end green, at 0.5 rose and blue-green, at 0.75 amber and blue.
// Knob 2: Noise. 0 to 4, opening at 2. The strength of the Langevin noise on every ball, 0.05 at 0, 0.2 at 2 and 0.35 at 4. At 0 the swarm is a tight bright knot a column or two wide that holds on until the well is gone. At 2 it is about 4 columns wide in a stiff well and swells to 10 or more on the plateau, and a few balls spill early. At 4 it is a fat cloud that spreads over the hump before the fold, so it tips early and often splits between the two wells.
// Knob 3: Drift. -1 to 1, opening at 0. How fast the control parameter wanders and so the clock of the whole story, 0.4 at -1, 1 at 0 and 2.5 at 1 (the balls themselves only speed up as the cube root of that). At 0 a well vanishes every minute or two, irregularly, and some approaches turn back short of the fold. At 1 the story runs two and a half times as fast and the swarm lags behind its landscape; at -1 the swelling and slowing stay in view for minutes.
// Knob 4: Swarm. -1 to 1, opening near 0. The number of balls, 30 at -1, 115 at 0 and 200 at 1, added one every 25 ms by cloning a ball already there and taken away the same way. At -1 the swarm is a handful of soft dots; at 1 a luminous heap that goes pale at its core.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp, sqrt, sin, cos, tanh, acos, cbrt, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

// ---- the landscape ------------------------------------------------------------
// U(x; r) = x^4/4 + c x^3/3 - x^2/2 - r x. At r = 0 two wells, the left one narrow and stiff, the right one wide. Raising r lifts
// the left well and sinks the right one until the left well's minimum and the hump meet at the fold (r = 0.48), where U'' = 0 and
// the bottom is a plateau. Lowering r does the same to the right well at r = -0.31, so the swarm has to be taken a long way back
// before the old well returns: hysteresis.
let CA = 0.2;                        // the cubic term, wandering between 0.05 and 0.35, so the two folds move about
let XC = -0.1;                       // x at the middle of the panel, drifting a little
const SC = 19.5;                     // columns a unit
let HS = 56;                         // rows a unit of height, breathing by a tenth
const YB = 66, UC = 0.05;            // the row of the mid height, the potential drawn at that row
const SA = 0.55, SB = 0.5;           // heights past SA either side of the middle are squeezed, so the walls stay on the panel
const dU = (x, r) => x * x * x + CA * x * x - x - r;
const d2U = (x) => 3 * x * x + 2 * CA * x - 1;
const Upot = (x, r) => (x * x * x * x) / 4 + (CA * x * x * x) / 3 - (x * x) / 2 - r * x;
function soft(z) {
  const a = abs(z);
  return a <= SA ? z : (z < 0 ? -1 : 1) * (SA + SB * tanh((a - SA) / SB));
}
function dsoft(z) {
  const a = abs(z);
  if (a <= SA) return 1;
  const t = tanh((a - SA) / SB);
  return 1 - t * t;
}

// the real roots of U' = 0, smallest first
function roots(r) {
  const p = -1 - (CA * CA) / 3, q = (2 * CA * CA * CA) / 27 + CA / 3 - r;
  const disc = 4 * p * p * p + 27 * q * q;
  if (disc < 0) {
    const m = 2 * sqrt(-p / 3), th = acos(cl(((3 * q) / (2 * p)) * sqrt(-3 / p), -1, 1)) / 3;
    const out = [0, 1, 2].map((k) => m * cos(th - (TAU * k) / 3) - CA / 3);
    return out.sort((a, b) => a - b);
  }
  const s = sqrt(q * q / 4 + (p * p * p) / 27);
  return [cbrt(-q / 2 + s) + cbrt(-q / 2 - s) - CA / 3];
}

// ---- colours --------------------------------------------------------------------
// Heat u 0..1: teal when the well is stiff, then blue, violet and rose as it flattens, amber at the fold. White is added on top for
// a swarm that is falling. The hue knob turns the wheel under all of it.
const LUTN = 96;
function hsv2(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
function rgb2hsv(r, g, b, out) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-9) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  out[0] = h;
  out[1] = mx > 0 ? d / mx : 0;
  out[2] = mx;
}
function buildLut(lut, hue) {
  const c = [0, 0, 0];
  for (let i = 0; i < LUTN; i++) {
    const u = i / (LUTN - 1);
    // the base hue 0.53 is teal, so a knob of 0 leaves it there and 1 brings it round again; the warm end is 0.56 further on
    hsv2(0.53 + hue + 0.56 * sstep(0.2, 0.92, u), 0.85 - 0.25 * sin(PI * u), 1, c, 0);
    lut[i * 3] = c[0];
    lut[i * 3 + 1] = c[1];
    lut[i * 3 + 2] = c[2];
  }
}
// How far a hue h is on the red-orange-yellow-olive stretch of the wheel, where a dim colour reads brown on the panel.
function brownish(h) {
  const c = h - floor(h);
  return c > 0.5 ? sstep(0.8, 0.95, c) : 1 - sstep(0.2, 0.36, c);
}

// ---- state ----------------------------------------------------------------------
const NMAX = 280;
// The ground is a core sample: the layer d rows under the curve is the swarm as it was d / VS seconds ago, so a swelling that came
// before a tip sinks away under the landscape as a band of its colour, and the tip itself as a pale line.
const HN = 600, HD = 0.2, VS = 1.1, NF = 110, FSTEP = 1.5;
const TS0 = 3.0;                     // model time a second
const R_MEAN = 0.085;
const T1 = 127, T2 = 51.7, A1 = 0.30, A2 = 0.20, TOU = 16, SOU = 0.13;

export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, hue: -9,
    n: 115, x: new Float32Array(NMAX), lane: new Float32Array(NMAX), tw: new Float32Array(NMAX), twf: new Float32Array(NMAX),
    heat: new Float32Array(NMAX), lp: new Float32Array(NMAX), gl: new Float32Array(NMAX),
    s: 0, ou: 0, r: 0, ph: [0, 0], ph2: [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU], c: 0.2, xc: -0.1, hs: 54, sig: 0.2, m: 1, Nt: 150, nacc: 0,
    heatM: 0, hotM: 0, F: 0,
    lut: new Float32Array(LUTN * 3),
    bR: new Float32Array(W * H), bG: new Float32Array(W * H), bB: new Float32Array(W * H),
    colE: new Float32Array((W + 8) * 3), colT: new Float32Array((W + 8) * 3),
    yc: new Float32Array(W + 2), nv: new Float32Array(W), fillL: new Float32Array(NF * 3), skyL: new Float32Array(64 * 3),
    hHeat: new Float32Array(HN), hF: new Float32Array(HN), hR: new Float32Array(HN), hp: 0, hacc: 0,
  });
  for (let j = 0; j < NMAX; j++) newBall(st, j, 0);
  return st;
}
function newBall(st, j, x) {
  st.x[j] = x;
  st.lane[j] = rnd();
  st.tw[j] = rnd() * TAU;
  st.twf[j] = 0.6 + rnd() * 1.4;
  st.heat[j] = 0;
  st.lp[j] = 0;
  st.gl[j] = 0;
}
// Three more slow wanderers shape the landscape itself (the cubic term, the stretch of its height, its sideways drift), each with two
// periods that do not divide one another, so no two minutes of the story share a landscape.
const T3 = [173.0, 89.3, 211.7, 97.1, 131.9, 61.7];
function shape(st) {
  const s = st.s, p = st.ph2;
  st.c = 0.2 + 0.09 * sin((TAU * s) / T3[0] + p[0]) + 0.06 * sin((TAU * s) / T3[1] + p[1]);
  st.hs = 54 * (1 + 0.09 * sin((TAU * s) / T3[2] + p[2]) + 0.05 * sin((TAU * s) / T3[3] + p[3]));
  st.xc = -0.1 + 0.1 * sin((TAU * s) / T3[4] + p[4]) + 0.06 * sin((TAU * s) / T3[5] + p[5]);
  CA = st.c;
  XC = st.xc;
  HS = st.hs;
}
const rOf = (st) => R_MEAN + A1 * sin((TAU * st.s) / T1 + st.ph[0]) + A2 * sin((TAU * st.s) / T2 + st.ph[1]) + st.ou;

function knobsToState(st) {
  const k = st.k;
  st.sig = 0.05 + 0.075 * cl(k[1], 0, 4);
  st.m = Math.pow(2, 1.3 * cl(k[2], -1, 1));
  st.Nt = round(115 + 85 * cl(k[3], -1, 1));
}

// One frame's worth of Euler-Maruyama steps, none longer than 1/120 of a second.
function swarm(st, dt) {
  const nsub = max(1, Math.ceil(dt * 120)), h = dt / nsub, hm = h * TS0 * Math.pow(st.m, 0.33), nz = st.sig * sqrt(hm), r = st.r, n = st.n, x = st.x;
  for (let i = 0; i < nsub; i++) {
    for (let j = 0; j < n; j++) {
      let v = x[j] - dU(x[j], r) * hm + nz * gauss();
      if (v < -1.7) v = -1.7 + (-1.7 - v) * 0.3;
      else if (v > 1.5) v = 1.5 - (v - 1.5) * 0.3;
      x[j] = v;
    }
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  knobsToState(st);
  if (!st.init) {
    st.init = true;
    // The control parameter starts as if the story were already forty-five clock-seconds old, so the knob has had time to matter, and
    // it starts on its way up to the fold: the first minute is the approach.
    st.s = 45 * st.m;
    let best = 9;
    for (let tries = 0; tries < 200; tries++) {
      st.ph = [rnd() * TAU, rnd() * TAU];
      st.ou = 0.5 * SOU * gauss();
      const r = rOf(st), sl = (TAU * A1 * cos((TAU * st.s) / T1 + st.ph[0])) / T1 + (TAU * A2 * cos((TAU * st.s) / T2 + st.ph[1])) / T2;
      const bad = abs(r - 0.14) + 12 * max(0, 0.004 - sl) + 12 * max(0, sl - 0.011);
      if (bad < best) {
        best = bad;
        st.bph = st.ph.slice();
        st.bou = st.ou;
      }
      if (bad < 0.04) break;
    }
    st.ph = st.bph;
    st.ou = st.bou;
    st.r = rOf(st);
    shape(st);
    st.n = st.Nt;
    const rt = roots(st.r), x0 = rt[0];
    for (let j = 0; j < st.n; j++) newBall(st, j, x0 + 0.05 * gauss());
    // let the swarm find the shape of its well before the first frame
    for (let i = 0; i < 420; i++) {
      const hm = 0.02, nz = st.sig * sqrt(hm);
      for (let j = 0; j < st.n; j++) st.x[j] = cl(st.x[j] - dU(st.x[j], st.r) * hm + nz * gauss(), -1.7, 1.5);
    }
    for (let j = 0; j < st.n; j++) {
      st.heat[j] = heatTarget(st.x[j]);
      st.lp[j] = dU(st.x[j], st.r);
    }
    st.heatM = st.heat[0];
    // a history to sink under the ground: the control parameter as the two sines had it, and the heat of the left well under it
    for (let i = 0; i < HN; i++) {
      const sp = st.s - i * HD * st.m;
      const rp = R_MEAN + A1 * sin((TAU * sp) / T1 + st.ph[0]) + A2 * sin((TAU * sp) / T2 + st.ph[1]) + st.ou * exp(-i * HD / 40);
      const q = HN - 1 - i;
      st.hR[q] = rp;
      st.hHeat[q] = heatTarget(roots(rp)[0]) * 0.9;
      st.hF[q] = 0;
    }
    st.hp = 0;
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  st.t += dt;
  // the control parameter: two slow sines that do not share a period, and an Ornstein-Uhlenbeck wander on top
  const ds = dt * st.m;
  st.s += ds;
  shape(st);
  st.ou += -(st.ou / TOU) * ds + SOU * sqrt((2 * ds) / TOU) * gauss();
  st.r = rOf(st);
  swarm(st, dt);
  // balls come and go one at a time, a ball cloned from the swarm and put a hair to one side
  st.nacc += dt;
  while (st.nacc > 0.025) {
    st.nacc -= 0.025;
    if (st.n < st.Nt) {
      const src = floor(rnd() * st.n);
      newBall(st, st.n, st.x[src] + 0.02 * gauss());
      st.heat[st.n] = st.heat[src];
      st.lp[st.n] = st.lp[src];
      st.n++;
    } else if (st.n > st.Nt) {
      const j = floor(rnd() * st.n), l = st.n - 1;
      st.x[j] = st.x[l];
      st.lane[j] = st.lane[l];
      st.tw[j] = st.tw[l];
      st.twf[j] = st.twf[l];
      st.heat[j] = st.heat[l];
      st.lp[j] = st.lp[l];
      st.gl[j] = st.gl[l];
      st.n--;
    }
  }
  // per ball: how flat the ground is under it (heat), the drift it has been feeling for a fifth of a second (a fall is a drift
  // that does not change sign, noise is one that does), and a glint now and then
  const n = st.n, r = st.r, a1 = 1 - exp(-dt / 0.45), a2 = 1 - exp(-dt / 0.2), dec = exp(-dt / 0.25), pg = dt * 0.05;
  let hs = 0, ho = 0;
  for (let j = 0; j < n; j++) {
    st.heat[j] += (heatTarget(st.x[j]) - st.heat[j]) * a1;
    st.lp[j] += (dU(st.x[j], r) - st.lp[j]) * a2;
    st.gl[j] *= dec;
    if (rnd() < pg) st.gl[j] = 1;
    hs += st.heat[j];
    ho += sstep(0.3, 0.65, abs(st.lp[j]));
  }
  st.heatM += (hs / n - st.heatM) * (1 - exp(-dt / 0.8));
  st.hotM = ho / n;
  st.F += (st.hotM - st.F) * (1 - exp(-dt / 0.3));
  st.hacc += dt;
  while (st.hacc >= HD) {
    st.hacc -= HD;
    st.hHeat[st.hp] = st.heatM;
    st.hF[st.hp] = st.F;
    st.hR[st.hp] = st.r;
    st.hp = (st.hp + 1) % HN;
  }
}
function heatTarget(x) {
  return Math.pow(cl(1 - d2U(x) / 1.7, 0, 1), 1.3);
}

// ---- drawing --------------------------------------------------------------------
export function draw(display, params) {
  if (!params.st) setup(params);
  const st = params.st;
  if (!st.init) update(0, { knobValues: st.k }, params);
  if (abs(st.k[0] - st.hue) > 1e-4) {
    st.hue = st.k[0];
    buildLut(st.lut, st.hue);
  }
  CA = st.c;
  XC = st.xc;
  HS = st.hs;
  const r = st.r, lut = st.lut, n = st.n, F = st.F;
  const yc = st.yc, nv = st.nv;
  // the curve, a column at a time (yc[c + 1] is column c, so the slope can look a column either side)
  for (let c = -1; c <= W; c++) {
    const x = XC + (c + 0.5 - 32) / SC;
    yc[c + 1] = YB - HS * soft(Upot(x, r) - UC);
  }
  for (let c = 0; c < W; c++) {
    const sl = (yc[c + 2] - yc[c]) * 0.5;
    nv[c] = 1 / sqrt(1 + sl * sl);
  }
  // colours of the landscape: the swarm's heat, and white as it falls
  const hu = cl(st.heatM * 1.55, 0, 1), li = hu * (LUTN - 1), li0 = floor(li), li1 = min(LUTN - 1, li0 + 1), lf = li - li0;
  const tr = lut[li0 * 3] * (1 - lf) + lut[li1 * 3] * lf, tg = lut[li0 * 3 + 1] * (1 - lf) + lut[li1 * 3 + 1] * lf, tb = lut[li0 * 3 + 2] * (1 - lf) + lut[li1 * 3 + 2] * lf;
  const fw = 0.65 * F;
  const lr = (tr * (1 - fw) + fw) * 190, lg = (tg * (1 - fw) + fw) * 190, lb = (tb * (1 - fw) + fw) * 190;
  // The ground under the curve: layer by layer, the swarm's colour at the time it was laid down, darker with depth, a pale line where
  // the swarm fell. It keeps to the cool half of the ramp, so the amber stays on the curve and the balls where it is bright, and a dim
  // warm tint is lifted and paled so it does not go brown.
  const FL = st.fillL, c3 = [0, 0, 0], hue0 = 0.53 + st.k[0];
  for (let i = 0; i < NF; i++) {
    const d = (i + 0.5) * FSTEP, back = min(HN - 1, floor(d / VS / HD)), q = (((st.hp - 1 - back) % HN) + HN) % HN;
    const hh = st.hHeat[q], ff = st.hF[q], rr = cl(st.hR[q], -0.6, 0.6);
    const ug = min(cl(hh * 1.55, 0, 1), 0.55), h = hue0 + 0.56 * sstep(0.2, 0.92, ug), sa = 0.85 - 0.25 * sin(PI * ug);
    const v = (0.1 + 0.3 * exp(-d / 12)) * (0.85 + 0.5 * hh) * (1 + 0.5 * rr) * (1 + 1.2 * ff), br = brownish(h);
    const vv = min(1, v * (1 + 1.1 * br * (1 - v))), ss = sa * (1 - 0.45 * br * (1 - v)) * (1 - 0.5 * ff);
    hsv2(h, ss, vv, c3, 0);
    FL[i * 3] = c3[0] * 255;
    FL[i * 3 + 1] = c3[1] * 255;
    FL[i * 3 + 2] = c3[2] * 255;
  }
  // a faint haze over the curve, the colour of the ground's newest layer
  const SK = st.skyL, ug0 = min(hu, 0.55), hs0 = hue0 + 0.56 * sstep(0.2, 0.92, ug0), ss0 = 0.85 - 0.25 * sin(PI * ug0);
  for (let i = 0; i < 64; i++) {
    hsv2(hs0, ss0, 0.045 + 0.075 * exp(-(i * 2.2) / 26), c3, 0);
    SK[i * 3] = c3[0] * 255;
    SK[i * 3 + 1] = c3[1] * 255;
    SK[i * 3 + 2] = c3[2] * 255;
  }
  // the balls
  const bR = st.bR, bG = st.bG, bB = st.bB;
  bR.fill(0);
  bG.fill(0);
  bB.fill(0);
  const colE = st.colE, colT = st.colT;
  colE.fill(0);
  const wsc = 0.62 * Math.pow(115 / max(n, 30), 0.4), wg = 0.9 / (1 + n / 70);
  for (let j = 0; j < n; j++) {
    const x = st.x[j];
    const px = 32 + (x - XC) * SC, z = Upot(x, r) - UC;
    const y = YB - HS * soft(z), sl = (-HS * dsoft(z) * dU(x, r)) / SC, nn = 1 / sqrt(1 + sl * sl);
    const off = 1.6 + 5.4 * Math.pow(st.lane[j], 1.7);
    const bx = px + off * sl * nn, by = y - off * nn;
    // colour: the heat of the ground it stands on, going to white in a fall or a glint
    const hu2 = cl(st.heat[j], 0, 1) * (LUTN - 1), i0 = floor(hu2), i1 = min(LUTN - 1, i0 + 1), f = hu2 - i0;
    const w = max(sstep(0.3, 0.65, abs(st.lp[j])), st.gl[j]) * 0.85;
    const cr = (lut[i0 * 3] * (1 - f) + lut[i1 * 3] * f) * (1 - w) + w, cg = (lut[i0 * 3 + 1] * (1 - f) + lut[i1 * 3 + 1] * f) * (1 - w) + w, cb = (lut[i0 * 3 + 2] * (1 - f) + lut[i1 * 3 + 2] * f) * (1 - w) + w;
    const tw = 0.78 + 0.22 * sin(st.tw[j] + st.twf[j] * st.t * 2.3);
    const b = tw * (1 + 0.6 * w) * wsc;
    const x0 = floor(bx - 3), y0 = floor(by - 3);
    for (let yy = max(0, y0); yy <= min(H - 1, y0 + 6); yy++) {
      const dy = yy + 0.5 - by;
      for (let xx = max(0, x0); xx <= min(W - 1, x0 + 6); xx++) {
        const dx = xx + 0.5 - bx, d2 = dx * dx + dy * dy;
        const a = b * (exp(-d2 / 0.98) + 0.22 * exp(-d2 / 7.2));
        const o = yy * W + xx;
        bR[o] += a * cr;
        bG[o] += a * cg;
        bB[o] += a * cb;
      }
    }
    // the light the swarm throws up over the ground it stands on, by column
    const cx = bx - 0.5, ci = floor(cx), cf = cx - ci, e = b * wg;
    if (ci >= -3 && ci < W + 3) {
      const o = (ci + 4) * 3;
      colE[o] += e * (1 - cf) * cr;
      colE[o + 1] += e * (1 - cf) * cg;
      colE[o + 2] += e * (1 - cf) * cb;
      colE[o + 3] += e * cf * cr;
      colE[o + 4] += e * cf * cg;
      colE[o + 5] += e * cf * cb;
    }
  }
  // blur the column light a few times
  for (let pass = 0; pass < 5; pass++) {
    for (let c = 0; c < W + 8; c++) {
      for (let k = 0; k < 3; k++) {
        const a = c > 0 ? colE[(c - 1) * 3 + k] : 0, bb = c < W + 7 ? colE[(c + 1) * 3 + k] : 0;
        colT[c * 3 + k] = 0.25 * a + 0.5 * colE[c * 3 + k] + 0.25 * bb;
      }
    }
    colE.set(colT);
  }
  // compose
  for (let c = 0; c < W; c++) {
    const yct = yc[c + 1], inv = nv[c];
    const gr = colE[(c + 4) * 3], gg = colE[(c + 4) * 3 + 1], gb = colE[(c + 4) * 3 + 2];
    for (let row = 0; row < H; row++) {
      const dy = row + 0.5 - yct, d = dy * inv, ad = abs(d);
      let R = 0, G = 0, B = 0;
      if (dy > 0) {
        const fi = min(NF - 1, floor(d / FSTEP)), o = fi * 3;
        R = FL[o];
        G = FL[o + 1];
        B = FL[o + 2];
      } else {
        const si = min(63, floor(ad / 2.2)) * 3;
        R = SK[si];
        G = SK[si + 1];
        B = SK[si + 2];
      }
      const line = sstep(1.6, 0.6, ad), glow = 0.2 * exp(-ad / 2.4);
      const lk = line + glow;
      R += lr * lk;
      G += lg * lk;
      B += lb * lk;
      if (d < 0) {
        const sk = exp(-ad / 7) * 70;
        R += gr * sk;
        G += gg * sk;
        B += gb * sk;
      }
      const o = row * W + c;
      R += bR[o] * 255;
      G += bG[o] * 255;
      B += bB[o] * 255;
      // soft shoulder so a crowd of balls goes pale and bright, not clipped
      const m = max(R, G, B);
      if (m > 140) {
        const k = (140 + 115 * (1 - exp(-(m - 140) / 120))) / m;
        R *= k;
        G *= k;
        B *= k;
      }
      display.setPixel(c, row, R | 0, G | 0, B | 0);
    }
  }
}
