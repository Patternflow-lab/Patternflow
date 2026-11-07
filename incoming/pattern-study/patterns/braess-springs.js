// ===== Patternflow pattern =====
// Title:   Braess Springs
// Family:  physics
// Idea:    A weight hangs from two springs and two slack strings tied together by a bridge string, scissors cut the bridge and the weight climbs because the springs now share its load side by side instead of one after the other, then a new bridge is tied on and it sinks back.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Braess's paradox (Dietrich Braess, 1968), the spring-and-string version (Joel E. Cohen and Paul Horowitz, 1991), pattern round 105
// Round:   105
// ===============================
// @matrix 64x128
// @knobs Springs=-1..1, Speed=0.3..3, Slack=1.5..18, Weight=0..1
//
// Knob 1: Springs. The stiffness ratio of the two springs, k1/k2 = 2^Springs. At 0 they are equal and the cut lifts the weight 14 LEDs; at either end it lifts it 6, and the stiffer coil is the shorter, thicker one.
// Knob 2: Speed. How fast the cycle runs. At 2 one cut, one climb and one new bridge take 16 s; 0.3 is more than six times slower and 3 half as fast again.
// Knob 3: Slack. How much longer each string is than the span it crosses while the bridge holds, 1.5 LEDs at the left. The cut lifts the weight by half the springs' stretch minus the slack: 14 LEDs at 1.5, none at about 14.5, and past that the weight sinks, 4 LEDs at 18.
// Knob 4: Weight. The load on the springs. The block grows from 11 to 20 LEDs tall, the springs stretch further and every coil runs hotter, gold toward red, and the lift grows from 14 to 16 LEDs.

const W = 64, H = 128, N = W * H;
const { min, max, floor, ceil, sqrt, sin, cos, abs, PI, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const lerp = (a, b, t) => a + (b - a) * t;

// The model, in units that are LEDs before the fit. y runs down from the
// support P at 0. Spring 1 hangs P - A, string 1 runs A - Q, string 2 runs
// P - B, spring 2 hangs B - Q, and the bridge ties A to B, tight when B is
// BR below A. Both springs have natural length L and constants k1, k2; the
// weight W = w k pulls Q down. With the bridge on, the load runs through
// spring 1, the bridge and spring 2 in a row: Q = 2L + BR + x1 + x2, with
// x1 = W/k1 and x2 = W/k2. With it cut the strands side by side each take a
// share and each spring stretches x = W/(k1+k2): Q = L + s + x.
const L = 14, BR = 12, GR = 450;
// Stiff strings and light knots, so the strings act as inextensible, plus the
// damping that lets the weight ring about four times.
const KS = 400, MU = 0.0012, CS = 0.2, CD = 0.03, CQ = 0.045;
const TREF = 40;
// The two columns, the beam, the top of the strands under it.
const XL = 16.5, XR = 47.5, YP = 4;
const BOT = 125;

const stops = [
  [0, 70, 110, 255], [0.2, 40, 220, 230], [0.4, 255, 220, 60], [0.75, 255, 90, 30], [1.1, 255, 40, 60],
];
// Colour of a spring under tension t of the reference: blue slack, gold at
// 0.4, red at full load, brighter as it tightens.
function tcol(t, out) {
  t = cl(t, 0, 1.1);
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const a = stops[i], b = stops[i + 1], f = cl((t - a[0]) / (b[0] - a[0]), 0, 1), v = 0.6 + 0.4 * min(1, t);
  out[0] = lerp(a[1], b[1], f) * v;
  out[1] = lerp(a[2], b[2], f) * v;
  out[2] = lerp(a[3], b[3], f) * v;
}

// The knobs settle into a machine: constants, string length, both
// equilibria, and the scale that fits the whole fall onto the panel.
function machine(S) {
  const r = pow(2, 0.5 * S.sk), w = 28 + 16 * S.sw;
  S.k1 = r;
  S.k2 = 1 / r;
  S.w = w;
  S.Wt = w;
  S.M = w / GR;
  const x1 = w / S.k1, x2 = w / S.k2;
  S.s = L + BR + max(x1, x2) + S.slack;
  S.qT = 2 * L + BR + x1 + x2;
  S.aT = L + x1;
  const x = w / (S.k1 + S.k2);
  S.qC = L + S.s + x;
  S.aC = L + x;
  S.hb = 11 + 9 * S.sw;
  S.bw = 20 + 6 * S.sw;
  S.u = min(1.1, (BOT - YP - S.hb) / max(S.qT, S.qC));
}

export function setup(params) {
  const S = {
    col: new Float32Array(N * 3), tc: [0, 0, 0], tc2: [0, 0, 0],
    sk: 0, sw: 0.06, slack: 1.5, rate: 1,
    k1: 1, k2: 1, w: 30, Wt: 30, M: 0.06, s: 60, qT: 0, qC: 0, aT: 0, aC: 0, hb: 12, bw: 22, u: 1,
    yA: 0, yB: 0, yQ: 0, vA: 0, vB: 0, vQ: 0,
    F1: 0, F2: 0, T1: 0, T2: 0, T3: 0, e1: 0, e2: 0, e3: 0, acc: new Float64Array(8),
    bridge: 1, bl: BR, gap0: 0,
    mode: 0, tm: 0, hold: 2.4, cutT: 9, flash: 9, ph: 0, ready: false,
  };
  params.s = S;
}

function init(S) {
  machine(S);
  S.yA = S.aT;
  S.yB = S.aT + BR;
  S.yQ = S.qT;
  S.vA = S.vB = S.vQ = 0;
  S.bridge = 1;
  S.bl = BR;
  S.ready = true;
}

// One step of the three masses A, B, Q. Forces point down. A string pulls
// only when it is longer than its length, springs pull and push.
function step(S, h) {
  const { k1, k2, s, bl } = S;
  const A = S.yA, B = S.yB, Q = S.yQ, vA = S.vA, vB = S.vB, vQ = S.vQ;
  let fA = 0, fB = 0, fQ = S.Wt - CQ * vQ;
  const F1 = k1 * (A - L) + CD * vA;
  fA -= F1;
  const F2 = k2 * (Q - B - L) + CD * (vQ - vB);
  fQ -= F2;
  fB += F2;
  let d = Q - A - s, T1 = 0, T2 = 0, T3 = 0;
  if (d > 0) {
    T1 = max(0, KS * d + CS * (vQ - vA));
    fA += T1;
    fQ -= T1;
  }
  d = B - s;
  if (d > 0) {
    T2 = max(0, KS * d + CS * vB);
    fB -= T2;
  }
  if (S.bridge) {
    d = B - A - bl;
    if (d > 0) {
      T3 = max(0, KS * d + CS * (vB - vA));
      fA += T3;
      fB -= T3;
    }
  }
  const a = S.acc;
  a[0] += T1 * h; a[1] += T2 * h; a[2] += T3 * h; a[3] += F1 * h; a[4] += F2 * h;
  a[5] += max(0, s - (Q - A)) * h;
  a[6] += max(0, s - B) * h;
  a[7] += (S.bridge ? max(0, bl - (B - A)) : 0) * h;
  S.vA += (fA / MU) * h;
  S.vB += (fB / MU) * h;
  S.vQ += (fQ / S.M) * h;
  S.yA += S.vA * h;
  S.yB += S.vB * h;
  S.yQ += S.vQ * h;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const tk = min(1, d * 6);
  if (!S.ready) {
    S.sk = cl(k[0], -1, 1);
    S.sw = cl(k[3], 0, 1);
    S.slack = cl(k[2], 1.5, 18);
    init(S);
  } else {
    S.sk += (cl(k[0], -1, 1) - S.sk) * tk;
    S.sw += (cl(k[3], 0, 1) - S.sw) * tk;
    S.slack += (cl(k[2], 1.5, 18) - S.slack) * tk;
    machine(S);
  }
  S.rate = cl(k[1], 0.3, 3) / 2;
  const sd = d * S.rate;
  S.tm += sd;
  S.ph += sd * 24;
  S.cutT += sd;
  S.flash += sd;
  const n = max(1, ceil(sd / 0.0015)), h = sd / n, a = S.acc;
  a.fill(0);
  for (let i = 0; i < n; i++) step(S, h);
  // The strings and the nodes ring at a high pitch, so what the picture
  // shows is the average over the frame.
  if (sd > 0) {
    S.T1 = a[0] / sd; S.T2 = a[1] / sd; S.T3 = a[2] / sd; S.F1 = a[3] / sd; S.F2 = a[4] / sd;
    S.e1 = a[5] / sd; S.e2 = a[6] / sd; S.e3 = a[7] / sd;
  }

  // The cycle: the bridge holds, scissors come in and close, the weight rings
  // up, a new bridge is drawn, taken up, and the weight comes down.
  if (S.mode === 0 && S.tm >= S.hold) {
    S.mode = 1;
    S.tm = 0;
  } else if (S.mode === 1 && S.tm >= 1.0) {
    S.mode = 2;
    S.tm = 0;
    S.bridge = 0;
    S.cutT = 0;
    S.flash = 0;
  } else if (S.mode === 2 && S.tm >= 7) {
    S.mode = 3;
    S.tm = 0;
  } else if (S.mode === 3 && S.tm >= 0.6) {
    S.mode = 4;
    S.tm = 0;
    S.bridge = 1;
    S.gap0 = S.yB - S.yA;
    S.bl = S.gap0;
  } else if (S.mode === 4) {
    S.bl = lerp(S.gap0, BR, sm(S.tm / 2.8));
    if (S.tm >= 2.8) {
      S.mode = 0;
      S.tm = 0;
      S.hold = 4.6;
      S.bl = BR;
    }
  }
}

// ---- drawing ----

function put(S, px, py, c, a) {
  if (a <= 0) return;
  a = min(1, a);
  const o = (py * W + px) * 3, col = S.col;
  col[o] += (c[0] - col[o]) * a;
  col[o + 1] += (c[1] - col[o + 1]) * a;
  col[o + 2] += (c[2] - col[o + 2]) * a;
}

// An anti-aliased line of width wd, laid over what is there.
function seg(S, x0, y0, x1, y1, wd, c, a) {
  const hw = wd * 0.5 + 0.5;
  const ax = max(0, floor(min(x0, x1) - hw)), bx = min(W - 1, ceil(max(x0, x1) + hw));
  const ay = max(0, floor(min(y0, y1) - hw)), by = min(H - 1, ceil(max(y0, y1) + hw));
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1e-9;
  for (let py = ay; py <= by; py++)
    for (let px = ax; px <= bx; px++) {
      const cx = px + 0.5, cy = py + 0.5;
      const t = cl(((cx - x0) * dx + (cy - y0) * dy) / l2, 0, 1);
      const ex = cx - x0 - t * dx, ey = cy - y0 - t * dy;
      put(S, px, py, c, cl(wd * 0.5 + 0.5 - sqrt(ex * ex + ey * ey), 0, 1) * a);
    }
}

// A string with e of slack between two points. A half wave bows it out to
// at most 9 LEDs and past that an S takes the rest, so the length is right.
function bow(S, x0, y0, x1, y1, e, side, wd, c, a) {
  const dx = x1 - x0, dy = y1 - y0, d = sqrt(dx * dx + dy * dy) || 1;
  if (e < 0.05) return seg(S, x0, y0, x1, y1, wd, c, a);
  const nx = (-dy / d) * side, ny = (dx / d) * side;
  const R = (2 * sqrt(d * e)) / PI, cth = min(1, 9 / R), A1 = R * cth, A2 = (R * sqrt(1 - cth * cth)) / 2;
  let px = x0, py = y0;
  for (let i = 1; i <= 28; i++) {
    const t = i / 28, o = A1 * sin(PI * t) + A2 * sin(TAU * t);
    const qx = x0 + dx * t + nx * o, qy = y0 + dy * t + ny * o;
    seg(S, px, py, qx, qy, wd, c, a);
    px = qx;
    py = qy;
  }
}

// A coil from y0 to y1 down the column xc, nine turns, seen from the side:
// the near half of every turn is bright and the far half dim.
function coil(S, xc, y0, y1, amp, wd, c) {
  const turns = 9, n = turns * 12, back = [c[0] * 0.5, c[1] * 0.5, c[2] * 0.5];
  const px = new Float32Array(n + 1), py = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n, ph = TAU * turns * t, env = min(1, (t * turns) / 0.5, ((1 - t) * turns) / 0.5);
    px[i] = xc + amp * env * cos(ph);
    py[i] = y0 + (y1 - y0) * t + 1.5 * env * sin(ph);
  }
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i < n; i++) {
      const near = sin(TAU * turns * ((i + 0.5) / n)) < 0;
      if (near === (pass === 1)) seg(S, px[i], py[i], px[i + 1], py[i + 1], wd, near ? c : back, 1);
    }
}

function dots(S, x0, y0, x1, y1, f, c) {
  // Pale beads run down a member in proportion to the load it carries.
  const a = cl(f * 1.6, 0, 1);
  if (a < 0.08) return;
  const l = sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
  if (l < 3) return;
  for (let p = S.ph % 9; p < l; p += 9) {
    const t = p / l;
    seg(S, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 0.01, 2.2, c, a);
  }
}

const mix = (a, b, t, o) => {
  o[0] = lerp(a[0], b[0], t);
  o[1] = lerp(a[1], b[1], t);
  o[2] = lerp(a[2], b[2], t);
};

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const col = S.col, u = S.u, Wt = S.Wt;
  col.fill(0);
  const Y = (m) => YP + u * m;
  const yA = Y(S.yA), yB = Y(S.yB), yQ = Y(S.yQ);
  const tmp = [0, 0, 0], tmp2 = [0, 0, 0];

  // The two heights the closed forms give, as dashed guides across the panel,
  // the bridge-on level in teal, the cut level in amber, and an arrow between.
  const gT = Y(S.qT), gC = Y(S.qC);
  for (let x = 0; x < W; x++)
    if ((x >> 1) % 2 === 0) {
      for (const [g, c] of [[gT, [30, 150, 170]], [gC, [190, 130, 30]]]) {
        const py = floor(g);
        put(S, x, py, c, 0.55 * (1 - (g - py)));
        put(S, x, py + 1, c, 0.55 * (g - py));
      }
    }
  {
    const hot = S.mode >= 2 && S.mode <= 3 ? 1 : 0.4, up = gC < gT, ax = 60.5;
    const c = up ? [255, 215, 70] : [255, 90, 190];
    if (abs(gT - gC) > 1.2) {
      seg(S, ax, gT, ax, gC, 1, c, hot);
      const dir = up ? 1 : -1;
      seg(S, ax, gC, ax - 2, gC + 2.4 * dir, 1, c, hot);
      seg(S, ax, gC, ax + 2, gC + 2.4 * dir, 1, c, hot);
    }
  }

  // The beam.
  for (let y = 1; y <= 3; y++)
    for (let x = 7; x <= 57; x++) {
      const v = y === 1 ? 1 : y === 2 ? 0.7 : 0.45;
      put(S, x, y, [150 * v + 20, 170 * v + 25, 210 * v + 30], 1);
    }

  // Strings: slack ones are dim and bowed out, taut ones white by the load.
  const strCol = (T, o) => mix([55, 80, 140], [255, 248, 225], cl((T / Wt) * 2, 0, 1), o);
  // A string that carries any load is taut; what rings at the knots is not slack.
  const slk = (e, T) => max(0, e - 0.4) * u * (1 - cl(T / (0.08 * Wt), 0, 1));
  strCol(S.T1, tmp);
  bow(S, XL, yA, XL, yQ, slk(S.e1, S.T1), 1, 1.5, tmp, 1);
  strCol(S.T2, tmp);
  bow(S, XR, YP, XR, yB, slk(S.e2, S.T2), -1, 1.5, tmp, 1);

  // Springs: spring 1 above A on the left, spring 2 below B on the right.
  const a1 = 5.6 * pow(S.k1, -0.12), a2 = 5.6 * pow(S.k2, -0.12);
  tcol(S.F1 / TREF, tmp);
  coil(S, XL, YP, yA, a1, 1.2 * pow(S.k1, 0.6) + 0.2, tmp);
  tcol(S.F2 / TREF, tmp);
  coil(S, XR, yB, yQ, a2, 1.2 * pow(S.k2, 0.6) + 0.2, tmp);

  // The bridge: drawn on, taut and bright, or the two cut ends springing back.
  const cy = [60, 255, 215];
  if (S.mode === 3) {
    const f = sm(S.tm / 0.6);
    seg(S, XL, yA, lerp(XL, XR, f), lerp(yA, yB, f), 1.6, cy, 0.9);
    seg(S, lerp(XL, XR, f), lerp(yA, yB, f), lerp(XL, XR, f), lerp(yA, yB, f) + 0.01, 3.5, [255, 255, 255], 1 - f * 0.5);
  } else if (S.bridge) {
    mix([20, 110, 130], [200, 255, 250], cl((S.T3 / Wt) * 1.5, 0, 1), tmp);
    seg(S, XL, yA, XR, yB, 5, [20, 150, 160], 0.2 * cl(S.T3 / Wt, 0, 1));
    bow(S, XL, yA, XR, yB, slk(S.e3, S.T3), 1, 1.8, tmp, 1);
  } else if (S.cutT < 0.7) {
    const rec = sm(S.cutT / 0.6), al = 1 - rec;
    mix([60, 255, 215], [255, 255, 255], 0.3, tmp);
    seg(S, XL, yA, lerp(XL, 32, 0.8 * (1 - rec)), lerp(yA, (yA + yB) / 2, 0.8 * (1 - rec)), 1.6, tmp, al);
    seg(S, XR, yB, lerp(XR, 32, 0.8 * (1 - rec)), lerp(yB, (yA + yB) / 2, 0.8 * (1 - rec)), 1.6, tmp, al);
  }

  // Flow: beads down every member in proportion to its tension.
  const bc = [255, 250, 210];
  dots(S, XL, YP, XL, yA, S.F1 / Wt, bc);
  dots(S, XL, yA, XL, yQ, S.T1 / Wt, bc);
  dots(S, XR, YP, XR, yB, S.T2 / Wt, bc);
  dots(S, XR, yB, XR, yQ, S.F2 / Wt, bc);
  if (S.bridge && S.mode !== 3) dots(S, XL, yA, XR, yB, S.T3 / Wt, bc);

  // Knots at A and B.
  for (const [x, y] of [[XL, yA], [XR, yB]]) seg(S, x, y, x, y + 0.01, 3.4, [255, 255, 255], 1);

  // The weight: a pale block with a lit top and a darker foot, hung by an
  // eyelet at each corner.
  const x0 = 32 - S.bw, x1 = 32 + S.bw, top = yQ, bot = yQ + S.hb;
  for (let py = max(0, floor(top)); py < min(H, ceil(bot)); py++) {
    const cv = cl(min(py + 1, bot) - max(py, top), 0, 1), v = cl((py + 0.5 - top) / S.hb, 0, 1);
    for (let px = floor(x0); px < ceil(x1); px++) {
      const edge = px < x0 + 1 || px >= x1 - 1, rim = py + 1 > bot - 1.2 || edge;
      const k = rim ? 0.55 : 1 - 0.5 * v;
      const hi = py + 0.5 - top < 1.6 ? 1 : 0;
      const gl = abs(px + 0.5 - (x0 + 4)) < 1.6 ? 0.18 : 0;
      put(S, px, py, [min(255, (205 + 50 * hi) * k + 255 * gl), min(255, (212 + 43 * hi) * k + 255 * gl), min(255, (240 + 15 * hi) * k + 255 * gl)], cv);
    }
  }
  for (const x of [XL, XR]) seg(S, x, top + 0.5, x, top + 0.5, 3, [255, 255, 255], 1);

  // Scissors come in from above the bridge and close on it after opening.
  if (S.mode === 1) {
    const t = S.tm, mx = (XL + XR) / 2, my = (yA + yB) / 2;
    let dx = XR - XL, dy = yB - yA;
    const dl = sqrt(dx * dx + dy * dy);
    dx /= dl;
    dy /= dl;
    const nx = dy, ny = -dx, away = 18 * (1 - sm(t / 0.5)), th = lerp(0.5, 0.02, sm((t - 0.5) / 0.5));
    const px = mx + nx * (13 + away), py = my + ny * (13 + away), steel = [235, 240, 255], grip = [255, 150, 40];
    for (const sgn of [-1, 1]) {
      const ph = th * sgn, bxd = -nx * cos(ph) + ny * sin(ph), byd = -nx * sin(ph) - ny * cos(ph);
      seg(S, px, py, px + bxd * 14, py + byd * 14, 1.8, steel, 1);
      seg(S, px, py, px - bxd * 6, py - byd * 6, 1.6, grip, 1);
      // a finger ring on each handle
      const hx = px - bxd * 8, hy = py - byd * 8;
      for (let i = 0; i < 8; i++) {
        const a0 = (TAU * i) / 8, a1 = (TAU * (i + 1)) / 8;
        seg(S, hx + 2.2 * cos(a0), hy + 2.2 * sin(a0), hx + 2.2 * cos(a1), hy + 2.2 * sin(a1), 1.2, grip, 1);
      }
    }
  }
  // The snap.
  if (S.flash < 0.35) {
    const f = S.flash / 0.35, mx = (XL + XR) / 2, my = (yA + yB) / 2;
    for (let i = 0; i < 8; i++) {
      const a = (TAU * i) / 8 + 0.4, r0 = 1 + 7 * f, r1 = 3 + 9 * f;
      seg(S, mx + cos(a) * r0, my + sin(a) * r0, mx + cos(a) * r1, my + sin(a) * r1, 1.3, [255, 255, 255], 1 - f);
    }
  }

  for (let q = 0, o = 0; q < N; q++, o += 3) display.setPixel(q % W, (q / W) | 0, min(255, col[o]), min(255, col[o + 1]), min(255, col[o + 2]));
}
