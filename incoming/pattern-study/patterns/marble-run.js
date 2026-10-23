// ===== Patternflow pattern =====
// Title:   Marble Run
// Family:  toy
// Idea:    Glass marbles roll down a marble run as tall as the panel, round a funnel, along three zigzag tracks, down a spiral and over a row of chimes, while an Archimedes screw at the side carries them back up, and each piece of clear coloured plastic lights up while a marble runs on it.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 17, after the zigzag marble runs, funnels and screw lifts of the toy shop
// Round:   17
// ===============================
// @matrix 64x128
// @knobs Paint=0..1, Speed=0.2..3, Marbles=6..28, Tilt=0..1
//
// Knob 1: Paint. Turns the plastic parts and the marbles' swirls round the colour wheel together, starting from a blue funnel over green, yellow and red tracks.
// Knob 2: Speed. How fast the film runs: at 2 a marble takes about 30 s round the loop, 6 s of it up the screw; at 0.2 it drifts down in slow motion, at 3 it runs half as fast again.
// Knob 3: Marbles. How many marbles are in the run, from 6 to 28; the screw lets them on at an even spacing, so they stay spread round the loop.
// Knob 4: Tilt. How steep the three zigzag tracks, the chimes and the trough hang, from a drop of 2 LEDs along each track to 8, and so how fast the marbles run down them.
// Buttons: K1 tap tips a handful of six marbles into the funnel from above; they run one lap and leave at the foot of the screw.

const W = 64;
const H = 128;
const N = W * H;
// Marble radius and the film's gravity, in LEDs and seconds. A rolling ball
// takes five sevenths of the pull along a slope.
const RM = 3.4;
const G = 420;
const ROLL = 5 / 7;
const DRAG = 0.6;
// The two wooden posts of the stand (x 0..1 and 52..53) and the top of each
// zigzag track's high end, 16 rows apart so a marble clears the track above.
const POST = 52;
const TRACK_Y = [34, 50, 66];
// The funnel: centre, rim and throat rows, rim and throat radius, and how
// round its rim looks from just above.
const FUN = { cx: 26, rim: 12, throat: 25, R: 20, r0: 2.5, e: 3 };
// The spiral: centre, radius, top, rows per turn, turns, how round.
const HEL = { cx: 27, R: 21.5, y0: 80, pitch: 9, turns: 2, e: 2.5 };
// The screw lift: centre column, top and bottom rows, rows per turn, where a
// marble gets on and where it gets off.
const SCR = { cx: 58, top: 2, bot: 123, pitch: 10, inlet: 119.6, out: 6.3 };
// Marble modes.
const RAIL = 0;
const FALL = 1;
const FUNNEL = 2;
const LIFT = 3;
// Paths, by index: the chute from the screw, three tracks, the spiral, the
// chimes and the trough back to the screw. Index 7 is the funnel's light.
const CHUTE = 0;
const HELIX = 4;
const CHIMES = 5;
const TROUGH = 6;
const BARS = 8;
const WOOD = [190, 138, 82];
// Hues of the plastic at Paint 0: chute, the three tracks, spiral, funnel;
// and of the marbles' swirls.
const HUE = [0.62, 0.36, 0.14, 0.97, 0.47, 0, 0, 0.56];
const SWIRL = [0.6, 0.0, 0.33, 0.13, 0.8, 0.5];

function hsv(h, s, v) {
  h -= Math.floor(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return 255 * v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return [f(5), f(3), f(1)];
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

// A path of marble centres, sampled every half LED of its length in space:
// screen x and y, depth z (1 nearest), and true height h for the slope.
function sample(fn, steps) {
  const X = [];
  const Y = [];
  const Z = [];
  const Hh = [];
  let last = null;
  let acc = 0.5;
  for (let i = 0; i <= steps; i++) {
    const q = fn(i / steps);
    if (last) acc += Math.hypot(q[0] - last[0], q[3] - last[3], q[4] - last[4]);
    last = q;
    if (acc >= 0.5 || i === steps) {
      acc = 0;
      X.push(q[0]);
      Y.push(q[1]);
      Z.push(q[2]);
      Hh.push(q[3]);
    }
  }
  return { X, Y, Z, Hh, n: X.length, L: (X.length - 1) * 0.5 };
}

// A straight rail whose top runs from (x0, y0) to (x1, y1); the marble rides
// RM + 0.5 above it.
function rail(x0, y0, x1, y1) {
  const p = sample((t) => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - RM - 0.5, 0, y0 + (y1 - y0) * t, 0], 400);
  return Object.assign(p, { x0, y0, x1, y1 });
}

// Position, depth, slope and sideways run of a path at length u.
function at(p, u) {
  const i = clamp(u * 2, 0, p.n - 1.001);
  const i0 = Math.floor(i);
  const f = i - i0;
  const g = (A) => A[i0] + (A[i0 + 1] - A[i0]) * f;
  return [g(p.X), g(p.Y), g(p.Z), (p.Hh[i0 + 1] - p.Hh[i0]) * 2, (p.X[i0 + 1] - p.X[i0]) * 2];
}

// The tracks, chimes and trough hang by the tilt; the rest is built once.
function buildPaths(P) {
  const d = 2 + 6 * P.tilt;
  if (!P.paths) {
    const { cx, R, y0, pitch, turns, e } = HEL;
    const helix = sample((t) => {
      const a = t * turns * 2 * Math.PI;
      const h = y0 + t * turns * pitch;
      return [cx + R * Math.cos(a), h + e * Math.sin(a), Math.sin(a), h, R * Math.sin(a)];
    }, 3000);
    P.paths = [rail(57, 10, 47, 15), 0, 0, 0, helix];
  }
  P.paths[CHIMES] = rail(48, 104, 6, 107 + 4 * P.tilt);
  P.paths[TROUGH] = rail(6, 120 - 4 * P.tilt, 57, 123);
  for (let k = 0; k < 3; k++) {
    const y = TRACK_Y[k];
    P.paths[k + 1] = k % 2 ? rail(51, y, 10, y + d) : rail(2, y, 44, y + d);
  }
  // Marbles on a track keep their place along it when the tilt changes.
  for (const m of P.marbles) if (m.mode === RAIL) m.u = Math.min(m.u, P.paths[m.p].L);
}

function newMarble(hue) {
  return { mode: RAIL, p: TROUGH, u: 0, v: 6, roll: hue * 2.3, hue, x: 0, y: 0, z: 0, extra: false };
}

export function setup(params) {
  const P = params;
  P.tilt = 0.06;
  P.paint = 0;
  P.marbles = [];
  P.paths = null;
  buildPaths(P);
  for (const k of ["base", "buf"]) P[k] = new Float32Array(N * 3);
  for (const k of ["baseZ", "zb", "mask", "tmp"]) P[k] = new Float32Array(N);
  P.ring = new Float32Array(BARS);
  P.light = new Float32Array(8);
  Object.assign(P, { screw: 0, slot: 0, t: 0, lastPick: -99, lastAdd: -99, builtAt: "", started: false, hueNext: 0 });
}

// Leaves a rail at its far end: into the funnel, off the end of a track, the
// spiral or the chimes and down, or into the queue at the screw.
function leave(P, m) {
  const p = P.paths[m.p];
  if (m.p === CHUTE) return Object.assign(m, { mode: FUNNEL, r: FUN.R, ph: 0 });
  if (m.p === TROUGH) return Object.assign(m, { u: p.L, v: 0 });
  const q = at(p, p.L);
  const right = q[4] > 0;
  let lo = right ? 44 : 2 + RM;
  let hi = right ? POST - RM - 0.3 : 10;
  if (m.p === HELIX) [lo, hi] = [45.5, 49.5];
  if (m.p === CHIMES) [lo, hi] = [2 + RM, 8];
  fall(m, q[0], q[1], m.v * q[4] * 0.6, m.v * q[3] * 0.5, m.p + 1, lo, hi);
}

function fall(m, x, y, vx, vy, target, lo, hi) {
  Object.assign(m, { mode: FALL, x, y, vx, vy, tp: target, lo, hi });
}

function stepMarble(P, m, dt) {
  if (m.mode === RAIL) {
    const p = P.paths[m.p];
    const q = at(p, m.u);
    m.v = Math.max(3, m.v + (G * ROLL * q[3] - DRAG * m.v) * dt);
    m.u += m.v * dt;
    m.roll += (m.v * dt * (q[4] || 0.3)) / RM;
    if (m.u >= p.L) leave(P, m);
  } else if (m.mode === FALL) {
    m.vy += G * dt;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    if (m.tp < 0) {
      // A tipped marble lands in the funnel bowl where it hits it.
      const r = Math.abs(m.x - FUN.cx);
      if (m.y >= FUN.rim - 2 + (FUN.R - r) * 0.3) Object.assign(m, { mode: FUNNEL, r: clamp(r, 4, FUN.R), ph: m.x > FUN.cx ? 0.3 : Math.PI + 0.3 });
      return;
    }
    if (m.x > m.hi) {
      m.x = m.hi;
      m.vx = -0.35 * Math.abs(m.vx);
    }
    if (m.x < m.lo) {
      m.x = m.lo;
      m.vx = 0.35 * Math.abs(m.vx);
    }
    // It lands where it meets the rail it drops onto, or at the spiral's top.
    const p = P.paths[m.tp];
    const u = p.x0 === undefined ? 0 : clamp((m.x - p.x0) / (p.x1 - p.x0), 0, 1) * p.L;
    if (m.y >= at(p, u)[1]) Object.assign(m, { mode: RAIL, p: m.tp, u, v: 3 + 0.08 * m.vy });
  } else if (m.mode === FUNNEL) {
    // Round and round the funnel, faster as it closes in on the throat.
    const w = 1.3 * (FUN.R / m.r) ** 1.5;
    m.ph += w * dt;
    m.roll += (w * m.r * dt) / RM;
    m.r -= (1.5 + 5 * (1 - m.r / FUN.R)) * dt;
    if (m.r <= FUN.r0) fall(m, FUN.cx, FUN.throat, 0, 15, 1, FUN.cx - 0.5, FUN.cx + 0.5);
  } else if (P.screw - m.s0 >= SCR.inlet - SCR.out) Object.assign(m, { mode: RAIL, p: CHUTE, u: 0, v: 6 });
}

// Where each marble shows, from its mode.
function place(P, m) {
  if (m.mode === RAIL) {
    const q = at(P.paths[m.p], m.u);
    m.x = q[0];
    m.y = q[1];
    m.z = q[2] + 0.1;
  } else if (m.mode === FALL) m.z = 0.1;
  else if (m.mode === FUNNEL) {
    const s = Math.sin(m.ph);
    m.x = FUN.cx + m.r * Math.cos(m.ph);
    m.y = FUN.rim + ((FUN.R - m.r) / (FUN.R - FUN.r0)) * (FUN.throat - FUN.rim) + FUN.e * (m.r / FUN.R) * s - 2.2;
    m.z = 2 * s;
  } else {
    m.x = SCR.cx;
    m.y = SCR.inlet - (P.screw - m.s0);
    m.z = 0;
  }
}

function step(P, dt, count) {
  P.t += dt;
  // The screw turns twice a second at Speed 2 and each turn brings a slot past
  // the inlet; a gate lets marbles on 30 / Marbles seconds apart, so they
  // spread evenly round the lap of about 30 s.
  P.screw += 2 * SCR.pitch * dt;
  const slot = Math.floor(P.screw / SCR.pitch);
  const ms = P.marbles;
  const extra = ms.filter((m) => !m.extra).length - count;
  let head = null;
  for (const m of ms) if (m.mode === RAIL && m.p === TROUGH && m.u >= P.paths[TROUGH].L - 0.6) head = m;
  if (head && (head.extra || extra > 0)) ms.splice(ms.indexOf(head), 1);
  else if (slot > P.slot && head && P.t - P.lastPick >= clamp(30 / count, 0.5, 5)) {
    Object.assign(head, { mode: LIFT, s0: slot * SCR.pitch });
    P.lastPick = P.t;
  }
  P.slot = slot;
  // A new marble rolls in at the far end of the trough while the run is short.
  if (extra < 0 && P.t - P.lastAdd > 0.4 && !ms.some((m) => m.mode === RAIL && m.p === TROUGH && m.u < 2 * RM + 1)) {
    ms.push(newMarble(P.hueNext++));
    P.lastAdd = P.t;
  }
  for (const m of ms) stepMarble(P, m, dt);
  // Marbles on one rail keep a marble's width apart, the one behind waiting.
  const busy = new Uint8Array(8);
  for (let k = 0; k < P.paths.length; k++) {
    const on = ms.filter((m) => m.mode === RAIL && m.p === k).sort((a, b) => b.u - a.u);
    busy[k] = on.length;
    for (let i = 1; i < on.length; i++)
      if (on[i].u > on[i - 1].u - 2 * RM) {
        on[i].u = on[i - 1].u - 2 * RM;
        on[i].v = Math.min(on[i].v, on[i - 1].v);
      }
  }
  // A plastic piece lights while marbles are on it, brighter for each up to
  // three, and fades in 0.7 s after.
  busy[7] = ms.filter((m) => m.mode === FUNNEL).length;
  for (let k = 0; k < 8; k++) {
    const to = busy[k] ? 0.5 + 0.25 * Math.min(3, busy[k]) : 0;
    P.light[k] = P.light[k] < to ? Math.min(to, P.light[k] + dt * 6) : to + (P.light[k] - to) * Math.exp(-dt / 0.7);
  }
  // A chime rings as a marble rolls over the middle of its bar.
  for (let b = 0; b < BARS; b++) P.ring[b] *= Math.exp(-dt / 0.45);
  const len = P.paths[CHIMES].L;
  for (const m of ms) {
    const u0 = m.uLast === undefined ? -1 : m.uLast;
    m.uLast = undefined;
    if (m.mode === RAIL && m.p === CHIMES) {
      for (let b = 0; b < BARS; b++) if (u0 < ((b + 0.5) / BARS) * len && m.u >= ((b + 0.5) / BARS) * len) P.ring[b] = 1;
      m.uLast = m.u;
    }
    place(P, m);
  }
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 6, 0.06];
  dt = Math.min(Math.max(dt, 0), 0.1);
  P.paint = clamp(k[0], 0, 1);
  const speed = clamp(k[1], 0, 3);
  const count = Math.round(clamp(k[2], 1, 28));
  const tilt = clamp(k[3], 0, 1);
  if (Math.abs(tilt - P.tilt) > 0.002) {
    P.tilt = tilt;
    buildPaths(P);
  }
  if (!P.started) {
    P.started = true;
    // The run has been going for a lap when the panel opens, so the marbles
    // are spread round it, and for three more seconds at the knob's speed.
    for (let i = 0; i < 840; i++) step(P, i < 750 ? 1 / 30 : speed / 60, count);
  }
  if (input.btnPressed && input.btnPressed[0])
    for (let i = 0; i < 6; i++) {
      const m = newMarble(P.hueNext++);
      m.extra = true;
      const x = FUN.cx + (Math.random() - 0.5) * 30;
      fall(m, x, -4 - 7 * i, 0, 0, -1, x, x);
      P.marbles.push(m);
    }
  step(P, (dt * speed) / 2, count);
}

// The still parts: wall, stand, tracks, funnel, spiral, chimes, trough and
// base, with the depth each LED stands at; and for each lit piece its LEDs
// and the glow it throws on the wall.
function paintStill(P) {
  const B = P.base;
  const Z = P.baseZ;
  const h0 = P.paint;
  for (let p = 0; p < N; p++) {
    const v = 7 + (7 * Math.floor(p / W)) / H;
    B[p * 3] = v * 0.8;
    B[p * 3 + 1] = v * 0.85;
    B[p * 3 + 2] = v * 1.3;
  }
  Z.fill(-9);
  P.lit = [];
  let mine = null;
  const dot = (x, y, c, z) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const p = y * W + x;
    if (z < Z[p]) return;
    B[p * 3] = c[0];
    B[p * 3 + 1] = c[1];
    B[p * 3 + 2] = c[2];
    Z[p] = z;
    if (mine) mine.add(p);
  };
  const shade = (c, f) => c.map((v) => v * f);
  // The base board and the two posts, with their grain.
  for (let y = 124; y < H; y++) for (let x = 0; x < W; x++) dot(x, y, shade(WOOD, y === 124 ? 1.05 : 0.8 - 0.06 * (y - 125) + 0.05 * Math.sin(x * 0.7 + y)), 0);
  for (let y = 30; y < 124; y++) for (const x of [0, 1, POST, POST + 1]) dot(x, y, shade(WOOD, (x % 2 ? 0.62 : 0.85) * (0.92 + 0.08 * Math.sin(y * 0.9 + x))), -0.5);
  for (let y = HEL.y0 - 6; y < 124; y++) for (let x = HEL.cx - 2; x <= HEL.cx + 2; x++) dot(x, y, shade(WOOD, 0.95 - 0.12 * Math.abs(x - HEL.cx)), 0);
  const col = HUE.map((h) => hsv(h0 + h, 0.6, 0.85));
  // Each lit piece remembers its LEDs.
  const piece = (k, draw) => {
    mine = new Set();
    draw(col[k]);
    P.lit[k] = [...mine];
    mine = null;
  };
  // Rails: a bright top edge over a darker side; the spiral's far half is
  // dimmer and passes behind the dowel.
  for (let k = 0; k <= HELIX; k++)
    piece(k, (c) => {
      const p = P.paths[k];
      for (let i = 0; i < p.n; i++) {
        const z = p.Z[i];
        const f = z > 0 ? 0.6 + 0.4 * z : z < 0 ? 0.4 + 0.15 * z : 1;
        dot(p.X[i], p.Y[i] + RM + 0.5, shade(c, f), z);
        dot(p.X[i], p.Y[i] + RM + 1.5, shade(c, f * 0.55), z);
      }
    });
  for (let k = 0; k < 3; k++) dot(k % 2 ? POST - 1 : 2, TRACK_Y[k] + 2, shade(WOOD, 0.5), 0.2);
  // The funnel: a cone of tinted plastic seen from the side, its rim an
  // ellipse whose near half stands in front of the marbles.
  const { cx, rim, throat, R, r0, e } = FUN;
  piece(7, (c) => {
    for (let y = rim; y <= throat; y++) {
      const r = R + ((r0 - R) * (y - rim)) / (throat - rim);
      for (let x = Math.ceil(cx - r); x <= Math.floor(cx + r); x++) dot(x, y, shade(c, 0.22 + 0.25 * Math.abs((x - cx) / r) ** 3), -3);
      dot(cx - r, y, shade(c, 0.8), 3);
      dot(cx + r, y, shade(c, 0.8), 3);
    }
    for (let y = throat; y <= throat + 3; y++) for (const x of [cx - 3, cx + 3]) dot(x, y, shade(c, 0.7), 3);
    for (let a = 0; a < 6.283; a += 0.02) {
      const s = Math.sin(a);
      dot(cx + R * Math.cos(a), rim + e * s, shade(c, s > 0 ? 1 : 0.55), s > 0 ? 3 : -3);
    }
  });
  // The chimes: eight bars of a toy xylophone on a dark frame.
  const cp = P.paths[CHIMES];
  for (let b = 0; b < BARS; b++) {
    const c = hsv(h0 + b / BARS, 0.55, 0.95);
    for (let i = 0; i < 4.6; i += 0.5) {
      const q = at(cp, ((b + 0.08) / BARS) * cp.L + i);
      dot(q[0], q[1] + RM + 0.5, c, 0);
      dot(q[0], q[1] + RM + 1.5, shade(c, 0.6), 0);
    }
  }
  for (let i = 0; i < cp.n; i++) dot(cp.X[i], cp.Y[i] + RM + 2.5, [40, 34, 30], 0);
  const tp = P.paths[TROUGH];
  for (let i = 0; i < tp.n; i++) {
    dot(tp.X[i], tp.Y[i] + RM + 0.5, shade(WOOD, 0.95), 0);
    dot(tp.X[i], tp.Y[i] + RM + 1.5, shade(WOOD, 0.55), 0);
  }
  // The glow of each lit piece: its LEDs blurred over the wall round it,
  // worked out again only for the tracks, and only when they move.
  P.litCol = col;
  P.builtAt = P.paint + ":" + P.tilt;
  if (!P.glow) P.glow = [];
  for (const k of [0, 1, 2, 3, 4, 7]) {
    if (P.glow[k] && (P.glowAt === P.tilt || k === 0 || k > 3)) continue;
    const M = P.mask;
    M.fill(0);
    for (const p of P.lit[k]) M[p] = 1;
    // Two box blurs of 7 LEDs along rows and columns, by running sums.
    for (let pass = 0; pass < 4; pass++) {
      const by = pass % 2;
      const src = by ? P.tmp : M;
      const dst = by ? M : P.tmp;
      const len = by ? H : W;
      const st = by ? W : 1;
      for (let line = 0; line < (by ? W : H); line++) {
        const o = by ? line : line * W;
        let acc = 0;
        for (let i = 0; i <= 3; i++) acc += src[o + i * st];
        for (let i = 0; i < len; i++) {
          dst[o + i * st] = acc / 7;
          if (i + 4 < len) acc += src[o + (i + 4) * st];
          if (i >= 3) acc -= src[o + (i - 3) * st];
        }
      }
    }
    const g = [];
    for (let p = 0; p < N; p++) if (M[p] > 0.02) g.push(p, M[p]);
    P.glow[k] = g;
  }
  P.glowAt = P.tilt;
}

// A glass marble: a clear body tinted by its swirl, the swirl turning as the
// marble rolls, a darker rim and a fixed highlight up to the left.
function marble(P, m) {
  const buf = P.buf;
  const zb = P.zb;
  const col = hsv(P.paint + SWIRL[m.hue % 6] + 0.07 * Math.floor(m.hue / 6), 0.8, 1);
  const dim = m.mode === FUNNEL && m.z < 0 ? 0.55 : 1;
  const c = Math.cos(m.roll);
  const s = Math.sin(m.roll);
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const x = Math.round(m.x) + dx;
      const y = Math.round(m.y) + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const u = (x - m.x) / RM;
      const v = (y - m.y) / RM;
      const d = Math.hypot(u, v);
      const a = clamp((1 - d) * RM + 0.5, 0, 1);
      const p = y * W + x;
      if (a <= 0 || m.z < zb[p]) continue;
      const zz = Math.sqrt(Math.max(0, 1 - d * d));
      const ru = u * c + v * s;
      const rv = v * c - u * s;
      // A cat's eye: four twisted blades of colour in clear glass, which
      // catches the light round its edge.
      const sw = Math.abs(Math.sin(2 * Math.atan2(rv, ru) + 2.5 * Math.hypot(ru, rv)));
      const vane = sw < 0.5 ? 1 - sw / 0.5 : 0;
      const hl = Math.exp(-((u + 0.38) ** 2 + (v + 0.42) ** 2) / 0.05);
      const rim = 80 * (1 - zz) ** 2;
      for (let i = 0; i < 3; i++) {
        const L = 40 + col[i] * (0.3 + vane * (0.65 + 0.35 * zz)) + rim + 255 * hl;
        buf[p * 3 + i] = buf[p * 3 + i] * (1 - a) + L * dim * a;
      }
      if (a > 0.5) zb[p] = m.z;
    }
}

export function draw(display, params) {
  const P = params;
  if (P.builtAt !== P.paint + ":" + P.tilt) paintStill(P);
  const buf = P.buf;
  const zb = P.zb;
  buf.set(P.base);
  zb.set(P.baseZ);
  // Lit pieces brighten and throw their colour on the wall round them.
  for (const k of [0, 1, 2, 3, 4, 7]) {
    const L = P.light[k];
    if (L < 0.01) continue;
    const c = P.litCol[k];
    for (const p of P.lit[k]) for (let i = 0; i < 3; i++) buf[p * 3 + i] += (c[i] * 0.5 + 40) * L;
    const g = P.glow[k];
    for (let j = 0; j < g.length; j += 2) for (let i = 0; i < 3; i++) buf[g[j] * 3 + i] += c[i] * g[j + 1] * L * 0.45;
  }
  // The screw: a clear tube, a shaft, and a painted thread whose near half
  // passes in front of the marbles it carries.
  const tc = hsv(P.paint + 0.08, 0.6, 0.95);
  for (let y = SCR.top; y <= SCR.bot; y++)
    for (let x = SCR.cx - 4; x <= SCR.cx + 4; x++) {
      const p = y * W + x;
      const u = (x - SCR.cx) / 3.6;
      let c;
      let z = -1;
      if (Math.abs(u) > 1) c = [62, 74, 86];
      else {
        const th = Math.asin(u) / (2 * Math.PI);
        const q = (y + P.screw - SCR.inlet) / SCR.pitch + 0.5;
        const fr = q - th - Math.floor(q - th);
        const bk = q + th - 0.5 - Math.floor(q + th - 0.5);
        if (fr < 0.24) {
          c = tc.map((v) => v * (0.45 + 0.5 * Math.sqrt(1 - u * u)));
          z = 1;
        } else if (bk < 0.24) c = tc.map((v) => v * 0.26);
        else c = Math.abs(x - SCR.cx) <= 1 ? [66, 62, 56] : [14, 17, 24];
      }
      buf.set(c, p * 3);
      zb[p] = z;
    }
  for (const m of P.marbles) marble(P, m);
  // A ringing bar flashes and lights the air over it.
  const cp = P.paths[CHIMES];
  for (let b = 0; b < BARS; b++) {
    const r = P.ring[b];
    if (r < 0.02) continue;
    const col = hsv(P.paint + b / BARS, 0.4, 1);
    const q = at(cp, ((b + 0.5) / BARS) * cp.L);
    for (let dy = -6; dy <= 3; dy++)
      for (let dx = -6; dx <= 6; dx++) {
        const x = Math.round(q[0]) + dx;
        const y = Math.round(q[1] + RM + 1) + dy;
        if (x < 0 || x >= W || y >= H) continue;
        const w = r * Math.max(0, 1 - Math.hypot(dx / 6.5, dy / 5)) * (0.6 + 0.4 * Math.sin(P.t * 40 + b));
        for (let i = 0; i < 3; i++) buf[(y * W + x) * 3 + i] += col[i] * w * 0.8;
      }
  }
  for (let p = 0; p < N; p++) {
    const o = p * 3;
    display.setPixel(p % W, Math.floor(p / W), Math.min(255, buf[o]), Math.min(255, buf[o + 1]), Math.min(255, buf[o + 2]));
  }
}
