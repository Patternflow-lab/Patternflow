// ===== Patternflow pattern =====
// Title:   Fabrik Reach
// Family:  kinematics
// Idea:    Thirteen jointed chains rooted along the left and right edges reach inward for wandering orange targets, each solved by FABRIK with a chase that lags a different amount per chain and a bend limit at every joint, so a chain too short for its target stands straight as a ray and a long one folds into a round coil around it, and a tip that arrives flashes white.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: FABRIK, Forward And Backward Reaching Inverse Kinematics, which pulls the joints from the tip to the root and back, keeping each link's length (Aristidou and Lasenby, 2011, from memory); cyclic coordinate descent for inverse kinematics (Wang and Chen, 1991, from memory); Jacobian inverse kinematics, the matrix method both replace (from memory); a joint limit by clamping each link's turn against the link before it; the targets, the chase and the numbers are original, pattern round 242
// Round:   242
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0..4, Reach=-1..1, Targets=0..1
//
// Knob 1: Hue. Turns the chains round the wheel and opens in navy and sky blue with an ice white tip, the targets orange. The target colour turns with the chains and stays across the wheel from them.
// Knob 2: Pace. 0 to 4, opening at 2. How fast the targets wander and how fast a chain may chase its goal: 0.4 times at the bottom, 1 at the opening and 2.6 times at the top. Slow, the chains settle and hold their coils for a long while. Fast, the fans swing across the panel and the chains lag behind each other.
// Knob 3: Reach. -1 to 1, opening at 0. The length of every link times 0.76 at the bottom, 1 at the opening and 1.32 at the top. Low, most chains are too short for their target and stand straight, a bundle of rays from the edges. Middle, the near chains coil and the far ones stay straight and change over as the targets move. High, every chain is long enough to fold into round coils round its target.
// Knob 4: Targets. 0 to 1, opening at 0.06. Two targets at the bottom and three at the top, the third growing out of nothing over the first part of the turn. It also sets how willingly a chain takes a target that is not its nearest: at 0 a chain keeps the near one, at 1 each chain swaps between targets on a period of its own, 22 to 57 s, so the fans split, cross and merge.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, exp, atan2, hypot, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();

const NCH = 13;            // chains
const SEG_MAX = 12;        // links in the longest chain
const PHI = 0.56;          // widest turn at a joint, radians (32 degrees)
const PHI0 = 1.3;          // widest turn of the first link against the edge's normal
const ITER = 3;            // FABRIK sweeps, tip to root and back, in a step
const STEP = 1 / 30;       // seconds a step of the simulation
const PRE = 6;             // seconds run before the first frame
const TRAIL_TAU = 1.6;     // seconds the trail of a tip takes to fall to a third
const LINK_R = 1.0;        // half the width of a link, LED
const JOINT_R = 1.5;      // radius of a joint dot, LED
const GAP = 0.62;          // radians between the tips round one target
const APART = 26;          // targets are pushed apart when nearer than this, LED

// ---- colour -----------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// u 0..1 against hue, saturation and value; the dim end stays saturated, the end of the chain is nearly white
const CH_KEYS = [
  [0.0, 0.635, 0.92, 0.5],
  [0.3, 0.605, 0.9, 0.82],
  [0.62, 0.57, 0.72, 1.0],
  [0.88, 0.54, 0.38, 1.0],
  [1.0, 0.51, 0.06, 1.0],
];
// the target: a red rim, orange, then pale yellow at the core
const TG_KEYS = [
  [0.0, 0.99, 0.8, 0.0],
  [0.14, 1.0, 0.85, 0.42],
  [0.34, 1.03, 0.86, 0.78],
  [0.6, 1.062, 0.8, 1.0],
  [0.82, 1.1, 0.5, 1.0],
  [1.0, 1.12, 0.16, 1.0],
];
const NL = 64;
function ramp(keys, lut, hue) {
  const c = [0, 0, 0];
  for (let i = 0; i < NL; i++) {
    const u = i / (NL - 1);
    let k = 0;
    while (k < keys.length - 2 && u > keys[k + 1][0]) k++;
    const a = keys[k], b = keys[k + 1], f = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
    const h = mix(a[1], b[1], f) + hue, s = mix(a[2], b[2], f), v = mix(a[3], b[3], f);
    // A dim colour on the red, orange, yellow and olive stretch of the wheel reads brown on the panel: paler and lifted there.
    const cc = h - floor(h);
    const br = (cc > 0.5 ? sstep(0.8, 0.95, cc) : 1 - sstep(0.2, 0.34, cc)) * sstep(0.1, 0.4, s) * sstep(0.03, 0.3, v) * (1 - v);
    hsv(h, s * (1 - 0.45 * br), min(1, v * (1 + 0.7 * br)), c, 0);
    lut[i * 3] = c[0];
    lut[i * 3 + 1] = c[1];
    lut[i * 3 + 2] = c[2];
  }
}
const BG = [5 / 255, 6 / 255, 22 / 255];

// ---- state ------------------------------------------------------------------
const wrapPi = (a) => a - TAU * floor((a + PI) / TAU);
// the angle a link may take, within phi of the one before it; a link folded straight back turns the chain's own way
function limit(ref, want, phi, hand) {
  let d = wrapPi(want - ref);
  if (abs(d) > 2.75) d = hand * abs(d);
  return ref + cl(d, -phi, phi);
}

function makeChains() {
  const left = [6, 25, 44, 63, 82, 101, 120], right = [15.5, 34.5, 53.5, 72.5, 91.5, 110.5];
  const out = [];
  for (let i = 0; i < NCH; i++) {
    const side = i < 7 ? 0 : 1;
    const n = 8 + floor(rnd() * 5);
    const d0 = 4 + rnd() * 2.6;
    const c = {
      side, n, d0,
      rx: side === 0 ? -0.5 : W + 0.5, ry: (side === 0 ? left[i] : right[i - 7]) + (rnd() - 0.5) * 3,
      base: side === 0 ? 0 : PI,
      px: new Float64Array(SEG_MAX + 1), py: new Float64Array(SEG_MAX + 1),
      hand: rnd() < 0.5 ? -1 : 1,
      ex: 0, ey: 0, owner: null,
      vmax: 15 + rnd() * 20, lag: 0.12 + rnd() * 0.5,
      ang: 0, rr: 5.5 + rnd() * 3,
      wf: 0.11 + rnd() * 0.17, wp: rnd() * TAU,
      gain: 1, wg: 0.06 + rnd() * 0.16, pg: rnd() * TAU, wl: 0.04 + rnd() * 0.1, pl: rnd() * TAU, wa: 0.05 + rnd() * 0.12, pa: rnd() * TAU,
      k: 0, imp: 0, tipx: 0, tipy: 0, len: 1,
    };
    for (let j = 0; j <= n; j++) {
      c.px[j] = c.rx + (side === 0 ? 1 : -1) * j * d0;
      c.py[j] = c.ry;
    }
    c.ex = c.px[n];
    c.ey = c.py[n];
    c.tipx = c.px[n];
    c.tipy = c.py[n];
    out.push(c);
  }
  return out;
}

// A target's path is the sum of three sines on each axis, at frequencies drawn so that no two share a period.
function newTarget(st, slot, avoidX, avoidY, delay) {
  let best = null, bs = -1;
  for (let tries = 0; tries < 10; tries++) {
    const g = { x: 0, y: 0, slot, life: delay > 0 ? 0 : 1, dying: false, delay, w: 0, ax: [], wx: [], phx: [], ay: [], wy: [], phy: [], cx: 32 + (rnd() - 0.5) * 10, cy: 64 + (rnd() - 0.5) * 16 };
    const AX = [13, 6.5, 3], AY = [30, 15, 7], WX = [0.17, 0.31, 0.53], WY = [0.14, 0.27, 0.47];
    for (let k = 0; k < 3; k++) {
      g.ax.push(AX[k] * (0.8 + 0.4 * rnd()));
      g.ay.push(AY[k] * (0.8 + 0.4 * rnd()));
      g.wx.push(WX[k] * (0.75 + 0.5 * rnd()));
      g.wy.push(WY[k] * (0.75 + 0.5 * rnd()));
      g.phx.push(rnd() * TAU);
      g.phy.push(rnd() * TAU);
    }
    place(g, st.tt);
    // far from where the last one went, and from the others
    let sc = avoidX === undefined ? 99 : hypot(g.x - avoidX, g.y - avoidY);
    for (const o of st.tg) if (!o.dying) sc = min(sc, hypot(g.x - o.x, g.y - o.y) * 1.3);
    if (sc > bs) (bs = sc), (best = g);
  }
  return best;
}
function place(g, t) {
  let x = g.cx, y = g.cy;
  for (let k = 0; k < 3; k++) {
    x += g.ax[k] * sin(g.wx[k] * t + g.phx[k]);
    y += g.ay[k] * sin(g.wy[k] * t + g.phy[k]);
  }
  // a soft wall keeps the target inside the panel, short of the edges
  g.x = 32 + 23 * tanh((x - 32) / 23);
  g.y = 64 + 52 * tanh((y - 64) / 52);
}

export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, clock: 0, acc: 0, tt: rnd() * 400, spawn: 14 + rnd() * 8,
    s: 1, m: 1, a: [1, 1, 0.06], share: 0.06, hue: -9,
    ch: makeChains(), tg: [],
    clut: new Float32Array(NL * 3), tlut: new Float32Array(NL * 3),
    tr: new Float32Array(W * H), tmp: new Float32Array(W * H),
    R: new Float32Array(W * H), G: new Float32Array(W * H), B: new Float32Array(W * H),
    // light of a target: its profile by radius, 0..1, 128 steps out to 16 LED
    prof: new Float32Array(129),
  });
  for (let i = 0; i <= 128; i++) {
    const r = i / 8;
    st.prof[i] = cl(0.5 * exp(-(r * r) / 34) + 0.6 * exp(-(r * r) / 7) + 0.4 * exp(-(r * r) / 1.5), 0, 1);
  }
  for (let j = 0; j < 3; j++) st.tg.push(newTarget(st, j, undefined, undefined, 0));
  return st;
}

// ---- inverse kinematics -----------------------------------------------------
// FABRIK with a bend limit. A sweep from the tip puts the last joint on the goal and walks back to the root keeping each link
// its length; a sweep from the root puts the first joint back on the edge and walks out. Out of reach the chain is just
// stretched toward the goal. The warm start is last frame's pose, so the answer moves a little each frame.
function solve(c, tx, ty, d) {
  const n = c.n, px = c.px, py = c.py, rx = c.rx, ry = c.ry, hand = c.hand;
  const reach = n * d;
  const far = hypot(tx - rx, ty - ry) >= reach;
  for (let it = 0; it < ITER; it++) {
    if (far) {
      px[0] = rx;
      py[0] = ry;
      for (let i = 0; i < n; i++) {
        const ex = tx - px[i], ey = ty - py[i], r = hypot(ex, ey) || 1e-6;
        px[i + 1] = px[i] + (ex / r) * d;
        py[i + 1] = py[i] + (ey / r) * d;
      }
    } else {
      px[n] = tx;
      py[n] = ty;
      let ref = 0, have = false;
      for (let i = n - 1; i >= 0; i--) {
        const want = atan2(py[i + 1] - py[i], px[i + 1] - px[i]);
        const a = have ? limit(ref, want, PHI, hand) : want;
        px[i] = px[i + 1] - d * cos(a);
        py[i] = py[i + 1] - d * sin(a);
        ref = a;
        have = true;
      }
    }
    px[0] = rx;
    py[0] = ry;
    let ref = c.base;
    for (let i = 0; i < n; i++) {
      const want = atan2(py[i + 1] - py[i], px[i + 1] - px[i]);
      const a = limit(ref, want, i === 0 ? PHI0 : PHI, hand);
      px[i + 1] = px[i] + d * cos(a);
      py[i + 1] = py[i] + d * sin(a);
      ref = a;
    }
  }
}

function derive(st, dt) {
  const kv = st.k;
  const sT = Math.pow(2, (cl(kv[1], 0, 4) - 2) * 0.68);
  const mT = Math.pow(2, 0.4 * cl(kv[2], -1, 1));
  const n = 2 + cl(kv[3], 0, 1);
  st.share = cl(kv[3], 0, 1);
  const f = 1 - exp(-dt / 0.35);
  st.s += (sT - st.s) * f;
  st.m += (mT - st.m) * f;
  const g = 1 - exp(-dt / 0.6);
  st.a[0] += (1 - st.a[0]) * g;
  st.a[1] += (cl(n - 1, 0, 1) - st.a[1]) * g;
  st.a[2] += (cl(n - 2, 0, 1) - st.a[2]) * g;
}

function trailStep(st, dt) {
  const T = st.tr, tmp = st.tmp, A = 0.17, dec = exp(-dt / TRAIL_TAU);
  const k0 = (1 - 2 * A) * dec, k1 = A * dec;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      const l = x > 0 ? T[o + x - 1] : 0, r = x < W - 1 ? T[o + x + 1] : 0;
      tmp[o + x] = T[o + x] * k0 + (l + r) * k1;
    }
  }
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      const u = y > 0 ? tmp[o - W + x] : 0, v = y < H - 1 ? tmp[o + W + x] : 0;
      T[o + x] = tmp[o + x] * (1 - 2 * A) + (u + v) * A;
    }
  }
}
function stamp(st, x, y, v) {
  const T = st.tr, r = 1.7;
  const x0 = max(0, floor(x - r - 1)), x1 = min(W - 1, floor(x + r + 1)), y0 = max(0, floor(y - r - 1)), y1 = min(H - 1, floor(y + r + 1));
  for (let j = y0; j <= y1; j++)
    for (let i = x0; i <= x1; i++) {
      const dd = hypot(i + 0.5 - x, j + 0.5 - y);
      const a = v * sstep(r + 0.5, r - 0.6, dd);
      if (a > T[j * W + i]) T[j * W + i] = a;
    }
}

function simStep(st, dt) {
  derive(st, dt);
  st.clock += dt;
  st.tt += dt * st.s;
  const tg = st.tg;
  for (const g of tg) {
    if (g.delay > 0) g.delay -= dt;
    else if (g.dying) g.life -= dt / 1.1;
    else g.life = min(1, g.life + dt / 1.5);
    place(g, st.tt);
    g.w = st.a[g.slot] * sstep(0, 1, g.life);
  }
  for (let i = tg.length - 1; i >= 0; i--) if (tg[i].dying && tg[i].life <= 0) tg.splice(i, 1);
  // two that are alive and near each other lean apart, so the fans stay separate
  for (let i = 0; i < tg.length; i++)
    for (let j = i + 1; j < tg.length; j++) {
      const a = tg[i], b = tg[j];
      if (a.dying || b.dying || a.w < 0.22 || b.w < 0.22) continue;
      const dx = b.x - a.x, dy = b.y - a.y, dd = hypot(dx, dy);
      if (dd >= APART) continue;
      const push = (APART - dd) * 0.5, ux = dd > 1e-3 ? dx / dd : 0, uy = dd > 1e-3 ? dy / dd : 1;
      a.x -= ux * push;
      a.y -= uy * push;
      b.x += ux * push;
      b.y += uy * push;
    }
  // now and then one target goes and another appears far from it
  st.spawn -= dt * (0.6 + 0.4 * st.s);
  if (st.spawn <= 0) {
    st.spawn = 12 + rnd() * 16;
    const slots = [];
    for (let j = 0; j < 3; j++) if (st.a[j] > 0.5 && tg.some((g) => g.slot === j && !g.dying)) slots.push(j);
    if (slots.length) {
      const j = slots[floor(rnd() * slots.length)];
      const old = tg.find((g) => g.slot === j && !g.dying);
      old.dying = true;
      tg.push(newTarget(st, j, old.x, old.y, 0.5));
    }
  }
  const m = st.m;
  // each chain takes the nearest target, a little biased by a slow wobble of its own, and keeps it unless another is clearly nearer
  for (const c of st.ch) {
    let best = null, bc = 1e9;
    for (const g of tg) {
      if (g.w < 0.22 || g.delay > 0) continue;
      const cost = (hypot(c.rx - g.x, c.ry - g.y) * (1 + (0.45 + 0.4 * st.share) * sin(c.wf * st.clock + c.wp + 2.4 * (g.slot + 1)))) / (0.6 + 0.4 * g.w) * (c.owner === g ? 0.8 : 1);
      if (cost < bc) (bc = cost), (best = g);
    }
    if (best) c.owner = best;
  }
  // the chains of one target take places round it in the order of their roots, at least GAP radians apart
  for (const g of tg) {
    const grp = st.ch.filter((c) => c.owner === g);
    if (!grp.length) continue;
    for (const c of grp) c.ang = (atan2(c.ry - g.y, c.rx - g.x) + TAU) % TAU;
    grp.sort((a, b) => a.ang - b.ang);
    const k = grp.length, gap = min(GAP, TAU / k);
    for (let pass = 0; pass < 8; pass++)
      for (let i = 0; i < k; i++) {
        const a = grp[i], b = grp[(i + 1) % k];
        const d = b.ang + (i === k - 1 ? TAU : 0) - a.ang;
        if (k > 1 && d < gap) {
          const push = (gap - d) * 0.5;
          a.ang -= push;
          b.ang += push;
        }
      }
  }
  for (const c of st.ch) {
    const o = c.owner;
    if (!o) continue;
    // each chain's brightness, link length and place round the target drift on a slow period of its own
    c.gain = 0.48 + 0.52 * (0.5 + 0.5 * sin(c.wg * st.clock + c.pg));
    c.len = 1 + 0.26 * sin(c.wl * st.clock + c.pl);
    const an = c.ang + 1.0 * sin(c.wa * st.clock + c.pa), rr = c.rr * (1 + 0.35 * sin(c.wa * 1.7 * st.clock + c.pg));
    const gx = o.x + cos(an) * rr, gy = o.y + sin(an) * rr;
    // the chain's own goal chases the real one: a lag and a speed limit
    const ddx = gx - c.ex, ddy = gy - c.ey, dd = hypot(ddx, ddy);
    if (dd > 1e-6) {
      const lag = c.lag / sqrt(st.s);
      const step = min(dd * (1 - exp(-dt / lag)), c.vmax * (0.55 + 0.45 * st.s) * dt);
      c.ex += (ddx / dd) * step;
      c.ey += (ddy / dd) * step;
    }
    solve(c, c.ex, c.ey, c.d0 * m * c.len);
    // arrival
    const tx = c.px[c.n], ty = c.py[c.n];
    const rt = hypot(tx - o.x, ty - o.y);
    const kc = sstep(c.rr * 1.2 + 3.6, c.rr * 1.2 + 1.4, rt) * sstep(0.3, 0.8, o.w);
    const was = c.k;
    c.k += (kc - c.k) * (1 - exp(-dt / 0.12));
    if (was < 0.5 && c.k >= 0.5) c.imp = 1;
    c.imp *= exp(-dt / 0.4);
    // the trail of the tip
    const sx = c.tipx, sy = c.tipy, sd = hypot(tx - sx, ty - sy), ns = max(1, floor(sd / 0.8));
    for (let q = 1; q <= ns; q++) stamp(st, mix(sx, tx, q / ns), mix(sy, ty, q / ns), 0.5 * c.gain);
    c.tipx = tx;
    c.tipy = ty;
  }
  trailStep(st, dt);
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  if (!st.init) {
    st.init = true;
    // the knobs are taken as they are at once, then the targets and the chains are let settle
    const sT = Math.pow(2, (cl(kv[1], 0, 4) - 2) * 0.68), mT = Math.pow(2, 0.4 * cl(kv[2], -1, 1)), n = 2 + cl(kv[3], 0, 1);
    st.share = cl(kv[3], 0, 1);
    st.s = sT;
    st.m = mT;
    st.a = [1, cl(n - 1, 0, 1), cl(n - 2, 0, 1)];
    for (let i = 0; i < PRE / STEP; i++) simStep(st, STEP);
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  st.acc += dt;
  let guard = 0;
  while (st.acc >= STEP && guard++ < 4) {
    st.acc -= STEP;
    simStep(st, STEP);
  }
  if (st.acc > STEP) st.acc = STEP;
}

// ---- drawing ----------------------------------------------------------------
let R, G, B;
function put(p, cr, cg, cb, a) {
  R[p] += (1 - R[p]) * cr * a;
  G[p] += (1 - G[p]) * cg * a;
  B[p] += (1 - B[p]) * cb * a;
}
function capsule(ax, ay, bx, by, r, cr, cg, cb) {
  const pad = r + 1;
  const x0 = max(0, floor(min(ax, bx) - pad)), x1 = min(W - 1, floor(max(ax, bx) + pad));
  const y0 = max(0, floor(min(ay, by) - pad)), y1 = min(H - 1, floor(max(ay, by) + pad));
  const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1e-6;
  for (let y = y0; y <= y1; y++) {
    const qy = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5;
      const t = cl(((qx - ax) * vx + (qy - ay) * vy) / l2, 0, 1);
      const dd = hypot(qx - ax - vx * t, qy - ay - vy * t);
      const a = cl((r + 0.35 - dd) / 0.7, 0, 1);
      if (a > 0) put(y * W + x, cr, cg, cb, a);
    }
  }
}
function dot(cx, cy, r, cr, cg, cb) {
  const pad = r + 1.2;
  const x0 = max(0, floor(cx - pad)), x1 = min(W - 1, floor(cx + pad)), y0 = max(0, floor(cy - pad)), y1 = min(H - 1, floor(cy + pad));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dd = hypot(x + 0.5 - cx, y + 0.5 - cy);
      const a = sstep(r + 0.6, r - 0.6, dd);
      if (a > 0) put(y * W + x, cr, cg, cb, a);
    }
}
function glow(st, cx, cy, scale, amp) {
  const lut = st.tlut, prof = st.prof;
  const rad = 16 * scale;
  const x0 = max(0, floor(cx - rad)), x1 = min(W - 1, floor(cx + rad)), y0 = max(0, floor(cy - rad)), y1 = min(H - 1, floor(cy + rad));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dd = hypot(x + 0.5 - cx, y + 0.5 - cy) / scale;
      if (dd >= 16) continue;
      const f = dd * 8, i = floor(f), u = f - i;
      const v = cl(mix(prof[i], prof[i + 1], u) * amp, 0, 1);
      if (v < 0.004) continue;
      const li = floor(v * (NL - 1) + 0.5) * 3;
      const p = y * W + x;
      R[p] += (1 - R[p]) * lut[li];
      G[p] += (1 - G[p]) * lut[li + 1];
      B[p] += (1 - B[p]) * lut[li + 2];
    }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const hue = st.k[0];
  if (abs(hue - st.hue) > 1e-4) {
    st.hue = hue;
    ramp(CH_KEYS, st.clut, hue);
    ramp(TG_KEYS, st.tlut, hue);
  }
  R = st.R;
  G = st.G;
  B = st.B;
  const cl3 = st.clut, T = st.tr;
  // ground, then the faint long exposure of the tips
  const ti = floor((NL - 1) * 0.86) * 3;
  const tr0 = cl3[ti], tg0 = cl3[ti + 1], tb0 = cl3[ti + 2];
  for (let p = 0; p < W * H; p++) {
    R[p] = BG[0];
    G[p] = BG[1];
    B[p] = BG[2];
    const v = T[p] * 0.55;
    if (v > 0.004) put(p, tr0, tg0, tb0, v > 1 ? 1 : v);
  }
  // targets
  for (const g of st.tg) {
    if (g.delay > 0) continue;
    const w = sstep(0.04, 0.8, g.w);
    if (w < 0.01) continue;
    const br = 0.94 + 0.06 * sin(st.clock * 1.7 + g.cx);
    glow(st, g.x, g.y, 0.55 + 0.45 * w, w * br);
  }
  const lut = cl3;
  for (const c of st.ch) {
    const n = c.n, gn = c.gain;
    // links, dimmer than the joints
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, li = floor(u * (NL - 1) + 0.5) * 3, g = 0.5 * gn;
      capsule(c.px[i], c.py[i], c.px[i + 1], c.py[i + 1], LINK_R, lut[li] * g, lut[li + 1] * g, lut[li + 2] * g);
    }
    for (let i = 0; i <= n; i++) {
      const u = i / n, li = floor(u * (NL - 1) + 0.5) * 3;
      const r = lut[li] * gn, g = lut[li + 1] * gn, b = lut[li + 2] * gn;
      if (i === 0) dot(c.px[0], c.py[0], 2.3, lut[0] * 0.8, lut[1] * 0.8, lut[2] * 0.8);
      else dot(c.px[i], c.py[i], i === n ? JOINT_R + 0.35 : JOINT_R, mix(r, 1, 0.26), mix(g, 1, 0.26), mix(b, 1, 0.26));
    }
    // the white of a tip that has arrived
    const f = 0.2 * c.k + 0.8 * c.imp;
    if (f > 0.02) {
      const li = (NL - 1) * 3;
      const rad = 2.2 + 1.6 * c.imp;
      const x = c.px[n], y = c.py[n];
      const x0 = max(0, floor(x - rad - 1)), x1 = min(W - 1, floor(x + rad + 1)), y0 = max(0, floor(y - rad - 1)), y1 = min(H - 1, floor(y + rad + 1));
      for (let j = y0; j <= y1; j++)
        for (let i = x0; i <= x1; i++) {
          const dd = hypot(i + 0.5 - x, j + 0.5 - y) / rad;
          if (dd >= 1) continue;
          put(j * W + i, lut[li], lut[li + 1], lut[li + 2], f * (1 - dd) * (1 - dd) * 1.2);
        }
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      display.setPixel(x, y, (R[p] * 255 + 0.5) | 0, (G[p] * 255 + 0.5) | 0, (B[p] * 255 + 0.5) | 0);
    }
}
