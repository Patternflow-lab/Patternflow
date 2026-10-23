// ===== Patternflow pattern =====
// Title:   Moth Lamp
// Family:  insect
// Idea:    An old lantern hangs on its chain under the eaves of a brick house on a summer night; moths spiral in out of the dark, circle it, bump the glass, rest on the panes and the lit bricks and flutter off, and now and then a bat takes one.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 20, after Fabian, Sondhi, Allen, Lin and Lin, Why flying insects gather at artificial light (Nature Communications, 2024)
// Round:   20
// ===============================
// @matrix 64x128
// @knobs Lamp=0..1, Speed=0.2..3, Moths=12..120, Breeze=-1..1
//
// Knob 1: Lamp. Sodium gold at 0, a warm old bulb, mercury blue-white, a cold LED at 1; the bluer lamps burn brighter, reach further and pull the moths in tighter.
// Knob 2: Speed. At 2 a moth flies about twenty LEDs a second and rounds the lamp in two or three, and the lantern swings once in two seconds.
// Knob 3: Moths. Twelve to 120; the damp nights that bring them out also haze the air, so the glow round the lamp grows with them.
// Knob 4: Breeze. A breath of air at 0.06; either way the lantern leans and swings harder, the moths drift downwind, the clouds run faster and the ivy shivers.
// Buttons: K1 tap sends a bat after a moth; the moths that hear it dive. K2 tap makes the old lamp stutter out and strike again.

const W = 64;
const H = 128;
const N = W * H;
// The hook, and how far down the chain the bulb burns.
const PX = 36;
const PY = 22;
const BV = 18.5;
// Rows: the roof, the wall under the gutter, the pavement.
const SKY = 13;
const EAVE = 18;
const GY = 114;
// The moon.
const MX = 52;
const MY = 6;
const MR = 3.6;
const MAXM = 120;
// Where the lamp's reach gives out on the wall.
const E0 = 0.175;

// Sodium gold, an old warm bulb, mercury blue-white, a cold LED.
const LAMPS = [[255, 184, 96], [255, 212, 150], [160, 224, 242], [222, 234, 255]];
// Moths: pale buff, white, straw, tan.
const TINTS = [[1, 0.9, 0.72], [1, 1, 0.96], [1, 0.94, 0.6], [0.86, 0.7, 0.5]];
// Old bricks: red, yellow stocks, a few grey ones, the ghost of limewash.
const BRICKS = [[0.74, 0.4, 0.3], [0.78, 0.62, 0.4], [0.5, 0.48, 0.5], [0.85, 0.8, 0.72]];
// What each LED of the scene is.
const [BRICK, MORTAR, LEAF, STONE, GAP, IRON, AIR, ROOF] = [0, 1, 2, 3, 4, 5, 6, 7];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => (v = clamp((v - a) / (b - a), 0, 1)) * v * (3 - 2 * v);
const wrap = (a) => a - 6.2832 * Math.round(a / 6.2832);
const rnd = () => Math.random();

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = (x - xi) ** 2 * (3 - 2 * (x - xi));
  const v = (y - yi) ** 2 * (3 - 2 * (y - yi));
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + hash(xi + 1, yi + 1)) * u * v;
}

function put(buf, q, r, g, b) {
  buf[q] = r;
  buf[q + 1] = g;
  buf[q + 2] = b;
}

const dim = (buf, q, k) => put(buf, q, buf[q] * k, buf[q + 1] * k, buf[q + 2] * k);

function build(P) {
  const { kind, alb, dark, leaf } = P;
  const set = (p, k, r, g, b) => {
    kind[p] = k;
    put(alb, p * 3, r, g, b);
  };
  for (let p = 0; p < N; p++) {
    const x = p % W;
    const y = (p / W) | 0;
    if (y < SKY) set(p, AIR, 0, 0, 0);
    else if (y < EAVE - 1) {
      // Roof tiles, a ridge every four LEDs.
      const s = (x + (y % 2) * 2) % 4 === 0 ? 0.12 : 0.28 + 0.06 * hash(x >> 2, y);
      set(p, ROOF, s * 1.1, s * 0.75, s * 0.65);
    } else if (y === EAVE - 1) set(p, IRON, 0.6, 0.55, 0.5);
    else if (y < GY) {
      // Bricks six LEDs long and two high, each course set over by three.
      // The joints are worn back deep and stay in shadow.
      const course = Math.floor(y / 3);
      const off = course % 2 ? 3 : 0;
      const col = Math.floor((x + off) / 7);
      const kb = hash(col, course + 70);
      const bc = BRICKS[kb < 0.55 ? 0 : kb < 0.78 ? 1 : kb < 0.88 ? 2 : 3];
      const t = (0.7 + 0.3 * hash(col, course + 50) - (hash(col, course + 90) < 0.12 ? 0.25 : 0)) * (0.7 + 0.6 * hash(p, 3));
      if (y % 3 === 2 || (x + off) % 7 === 6) set(p, MORTAR, 0.17, 0.16, 0.15);
      else set(p, BRICK, bc[0] * t, bc[1] * t, bc[2] * t);
    } else {
      // Setts, the rows growing toward us.
      const d = y - GY;
      const rows = [0, 2, 4, 7, 10, 14];
      let r = 0;
      while (r < 4 && d >= rows[r + 1]) r++;
      const v = (d - rows[r]) / (rows[r + 1] - rows[r]);
      const sw = 5 + r;
      const xo = (r % 2) * (sw >> 1);
      const u = ((x + xo) % sw) / sw;
      const s = (0.6 + 0.25 * hash(Math.floor((x + xo) / sw), r + 20)) * clamp(1 - 1.4 * ((u - 0.42) ** 2 + (v - 0.35) ** 2), 0.4, 1);
      if (v > 0.8 || u > 0.84) set(p, GAP, 0.1, 0.1, 0.1);
      else set(p, STONE, 0.66 * s, 0.64 * s, 0.6 * s);
    }
  }
  // Ivy up the wall toward the lamp, a leaf every third row.
  for (const [x0, y0, x1, y1, s] of [[59, GY, 50, 34, 0], [56, 76, 44, 50, 1], [61, 56, 63, 30, 2]]) {
    const len = Math.abs(y1 - y0);
    for (let i = 0; i <= len; i++) {
      const y = Math.round(y0 + ((y1 - y0) * i) / len);
      const x = x0 + ((x1 - x0) * i) / len + 1.6 * Math.sin(i * 0.31 + s);
      if (Math.round(x) < W) set(y * W + Math.round(x), LEAF, 0.22, 0.3, 0.12);
      if (i % 3) continue;
      const lx = x + ((i / 3) % 2 ? 2.2 : -2.2);
      const id = i * 7 + s * 131;
      const big = 1.3 + 0.7 * hash(id, 4);
      const g = 0.75 + 0.25 * hash(id, 5);
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const px = Math.round(lx + dx);
          const py = y - 1 + dy;
          if (px < 0 || px >= W || py < EAVE || py >= GY || (dx / big) ** 2 + ((dy + 0.3) / (big * 0.8)) ** 2 > 1) continue;
          set(py * W + px, LEAF, 0.26 * g, 0.62 * g, 0.2 * g);
          leaf[py * W + px] = 6.28 * hash(id, 6) + 0.01;
        }
    }
  }
  // The bracket: arm, brace, scroll, wall plate.
  const iron = (x, y) => set(y * W + x, IRON, 0.6, 0.55, 0.5);
  for (const [x0, y0, x1, y1] of [[5, 22, 36, 21], [5, 23, 36, 22], [6, 31, 24, 23]]) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) iron(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n));
  }
  for (let a = 0; a < 11; a += 0.15) iron(Math.round(14 + (3.6 - 0.3 * a) * Math.cos(a)), Math.round(26.5 - (3.6 - 0.3 * a) * Math.sin(a)));
  for (let y = 19; y < 34; y++) for (let x = 3; x < 6; x++) iron(x, y);
  // The night: blue, the strongest channel, is a smooth glow with a little
  // grain and the other two scatter under it, never past 24.
  for (let p = 0; p < N; p++) {
    const x = p % W;
    const y = (p / W) | 0;
    const k = kind[p];
    let sky = 17 + 3.5 * Math.sin(x * 0.07 + y * 0.045) + 2.5 * Math.sin(y * 0.031 - x * 0.05 + 1);
    if (k === GAP || k === IRON || k === ROOF) sky -= 5;
    if (k === AIR) sky = 7 + 0.6 * y;
    const b = clamp(Math.round(sky) + Math.floor(7 * hash(p, 33)) - 3, 1, 24);
    for (let c = 0; c < 3; c++) P.jit[p * 3 + c] = hash(p, 40 + c) - 0.1;
    put(dark, p * 3, Math.floor((b + 1) * hash(p, 30) * (k === AIR ? 0.7 : 1)), Math.floor((b + 1) * hash(p, 32) * (k === AIR ? 0.8 : 1)), b);
  }
}

export function setup(params) {
  const P = params;
  P.leaf = new Float32Array(N);
  for (const k of ["alb", "dark", "buf", "jit"]) P[k] = new Float32Array(N * 3);
  for (const k of ["x", "y", "h", "sp", "t", "ph", "fw", "al", "bias", "u", "v", "wait"]) P[k] = new Float32Array(MAXM);
  for (const k of ["mode", "big", "tint"]) P[k] = new Uint8Array(MAXM);
  P.kind = new Uint8Array(N);
  P.side = new Int8Array(MAXM);
  build(P);
  for (let i = 0; i < MAXM; i++) P.wait[i] = rnd() * 3;
  Object.assign(P, { T: 0, started: false, om: 0, cloud: 0, flick: -1, lamp: 1, gain: 1, reach: E0, damp: 0, breeze: 0, bat: null, lc: [1, 0.7, 0.4] });
  P.nextBat = 16 + 10 * rnd();
  aim(P, 0);
}

// Where the lantern hangs now: the bulb, and the lantern's own axes.
function aim(P, th) {
  P.th = th;
  P.c = Math.cos(th);
  P.s = Math.sin(th);
  P.bx = PX + BV * P.s;
  P.by = PY + BV * P.c;
}

// A point in the lantern's frame (u across, v down from the hook) on the panel.
const lx = (P, u, v) => PX + u * P.c + v * P.s;
const ly = (P, u, v) => PY - u * P.s + v * P.c;

// A moth comes in from an edge, or is near the lamp when the night opens.
function arrive(P, i, near) {
  const { x: X, y: Y, h: A } = P;
  P.mode[i] = 1;
  P.side[i] = rnd() < 0.5 ? -1 : 1;
  P.big[i] = rnd() < 0.25 ? 1 : 0;
  P.tint[i] = Math.floor(rnd() * 4);
  P.al[i] = 0.65 + 0.35 * rnd();
  P.sp[i] = 0.8 + 0.4 * rnd();
  P.fw[i] = 7 + 5 * rnd();
  P.bias[i] = 0.15 + 0.35 * rnd();
  if (near) {
    const a = rnd() * 6.28;
    const r = 7 + 22 * rnd();
    X[i] = P.bx + r * Math.cos(a);
    Y[i] = P.by + r * Math.sin(a) * 1.2;
    A[i] = a + P.side[i] * 1.6;
    return;
  }
  const e = rnd();
  X[i] = e < 0.35 ? -4 : e < 0.7 ? W + 4 : W * rnd();
  Y[i] = e < 0.7 ? 20 + 90 * rnd() : H + 4;
  A[i] = Math.atan2(P.by - Y[i], P.bx - X[i]) + (rnd() - 0.5);
}

function land(P, i, mode) {
  P.mode[i] = mode;
  P.t[i] = mode === 2 ? 2 + 4 * rnd() : 3 + 9 * rnd();
  const dx = P.x[i] - PX;
  const dy = P.y[i] - PY;
  // On the glass it is kept in the lantern's frame, so it swings with it.
  if (mode === 2) {
    P.u[i] = clamp(dx * P.c - dy * P.s, -4, 4);
    P.v[i] = clamp(dx * P.s + dy * P.c, 15, 22);
  } else {
    P.x[i] = Math.round(P.x[i]);
    P.y[i] = Math.round(P.y[i]);
  }
}

function takeOff(P, i, away) {
  if (P.mode[i] === 2) {
    P.x[i] = lx(P, P.u[i], P.v[i]);
    P.y[i] = ly(P, P.u[i], P.v[i]);
  }
  P.mode[i] = away ? 4 : 1;
  P.t[i] = away ? 0.6 + 2 * rnd() : 0;
  P.h[i] = Math.atan2(P.y[i] - P.by, P.x[i] - P.bx) + (rnd() - 0.5) * 1.2;
}

function step(P, dt, want, pull, wind) {
  const { mode: M, x: X, y: Y, h: A, t: T, ph: F, side: D, wait: Q } = P;
  const lit = P.lamp > 0.4;
  let onGlass = 0;
  for (let i = 0; i < MAXM; i++) if (M[i] === 2) onGlass++;
  for (let i = 0; i < MAXM; i++) {
    let m = M[i];
    if (m === 0) {
      if (i < want && (Q[i] -= dt) <= 0) arrive(P, i, false);
      continue;
    }
    if (i >= want && m !== 4) {
      takeOff(P, i, true);
      T[i] = 99;
      m = 4;
    }
    F[i] += P.fw[i] * dt * 6.28;
    if (m === 2 || m === 3) {
      if ((T[i] -= dt) <= 0) takeOff(P, i, rnd() < 0.4);
      continue;
    }
    const dx = P.bx - X[i];
    const dy = P.by - Y[i];
    const r = Math.sqrt(dx * dx + dy * dy) + 0.01;
    let h = A[i];
    // Each moth keeps its back to the light. Far off that steers it straight
    // in; near, it holds the lamp abeam and so circles it, spiralling in by
    // its bias until it bumps the glass.
    if (m === 1 && lit) h += clamp(wrap(Math.atan2(dy, dx) - D[i] * (1.5708 * smooth(46, 12, r) - P.bias[i] * pull) - h), -5 * dt, 5 * dt);
    if (m === 4 && (T[i] -= dt) <= 0) M[i] = m = 1;
    // It jinks, and now and then loops.
    h += (rnd() - 0.5) * 7 * Math.sqrt(dt);
    if (rnd() < dt * 0.25) h += D[i] * 2.5;
    const sp = 20 * P.sp[i] * (0.75 + 0.5 * Math.abs(Math.sin(F[i] * 0.05 + i)));
    X[i] += Math.cos(h) * sp * dt + wind * dt;
    Y[i] += Math.sin(h) * sp * dt;
    A[i] = h;
    if (lit && m === 1 && r < 6) {
      // A bump on the glass: it bounces off, or settles on the pane.
      if (onGlass < 2 && rnd() < 0.2) {
        land(P, i, 2);
        onGlass++;
      } else A[i] = Math.atan2(-dy, -dx) + (rnd() - 0.5) * 2;
    } else if (lit && m === 1 && r > 9 && r < 26 && Y[i] > EAVE + 1 && rnd() < dt * 0.035) land(P, i, 3);
    if (X[i] < -8 || X[i] > W + 8 || Y[i] < -8 || Y[i] > H + 8) {
      M[i] = 0;
      Q[i] = 0.5 + 3 * rnd();
    }
  }
}

// The flying moth nearest a point; one below the lamp counts `low` nearer.
function prey(P, x, y, low, best) {
  let q = -1;
  for (let i = 0; i < MAXM; i++) {
    const d = P.mode[i] === 1 ? Math.hypot(P.x[i] - x, P.y[i] - y) - (P.y[i] > P.by + 4 ? low : 0) : 1e9;
    if (d < best) [best, q] = [d, i];
  }
  return q;
}

// The bat comes in low across the lit wall for a moth, one below the lamp first.
function startBat(P) {
  const x = rnd() < 0.5 ? -8 : W + 8;
  const y = 60 + 20 * rnd();
  P.bat = { x, y, h: Math.atan2(P.by + 22 - y, P.bx - x), t: 0, prey: prey(P, P.bx, P.by, 8, 1e9), ph: 0 };
}

function flyBat(P, dt) {
  const { bat: b, mode: M, x: X, y: Y } = P;
  b.t += dt;
  b.ph += dt * 44;
  // If its moth settles it turns for the nearest one still flying.
  if (b.prey >= 0 && M[b.prey] !== 1) b.prey = prey(P, b.x, b.y, 0, 30);
  const q = b.prey;
  if (q >= 0 && b.t > 0.5) {
    b.h += clamp(wrap(Math.atan2(Y[q] - b.y, X[q] - b.x) - b.h), -6 * dt, 6 * dt);
    if (Math.hypot(X[q] - b.x, Y[q] - b.y) < 2.2) {
      M[q] = 0;
      P.wait[q] = 2 + 4 * rnd();
      b.prey = -1;
    }
  } else b.h += 0.8 * dt;
  b.x += Math.cos(b.h) * 45 * dt;
  b.y += Math.sin(b.h) * 45 * dt;
  // Moths with ears hear it coming and drop.
  for (let i = 0; i < MAXM; i++)
    if (M[i] === 1 && i !== b.prey && Math.hypot(X[i] - b.x, Y[i] - b.y) < 12) {
      M[i] = 4;
      P.t[i] = 0.8;
      P.h[i] = 1.07 + rnd();
    }
  if (b.t > 4 || (b.t > 0.4 && (b.x < -12 || b.x > W + 12 || b.y < -12 || b.y > H + 12))) P.bat = null;
}

// The lantern swings on its chain toward where the wandering air leans it.
function swing(P, dt, breeze) {
  const t = P.T;
  const gust = (0.075 + 0.06 * Math.abs(breeze)) * (Math.sin(t * 0.83) + 0.6 * Math.sin(t * 1.37 + 2) + 0.4 * Math.sin(t * 0.29 + 4));
  P.om += (-9 * (P.th - 0.17 * breeze - gust) - 0.8 * P.om) * dt;
  aim(P, P.th + P.om * dt);
  P.cloud += dt * (0.08 + 0.1 * breeze);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 12, 0.06];
  dt = clamp(dt, 0, 0.1);
  const hue = clamp(k[0], 0, 1);
  const speed = clamp(k[1], 0, 3) / 2;
  const want = Math.round(clamp(k[2], 12, MAXM));
  const breeze = (P.breeze = clamp(k[3], -1, 1));
  // The lamp's colour; the bluer ones burn brighter and reach further.
  const j = Math.min(2, Math.floor(hue * 3));
  const f = hue * 3 - j;
  for (let c = 0; c < 3; c++) P.lc[c] = (LAMPS[j][c] * (1 - f) + LAMPS[j + 1][c] * f) / 255;
  const blue = smooth(0.25, 0.8, hue);
  const pull = 0.7 + 0.8 * smooth(0.3, 0.75, hue);
  P.gain = 1 + 0.35 * blue;
  P.reach = E0 * (1 - 0.3 * blue);
  P.damp = (want - 12) / (MAXM - 12);
  const wind = breeze * 7;
  const btn = input.btnPressed || [];
  if (btn[0] && !P.bat) startBat(P);
  if (btn[1] && P.flick < 0) P.flick = 0;
  if (!P.started) {
    // Five seconds of the night run before it opens.
    P.started = true;
    for (let i = 0; i < want; i++) {
      arrive(P, i, rnd() < 0.8);
      if (rnd() < 0.2) land(P, i, 3);
    }
    for (let n = 0; n < 150; n++) {
      P.T += 1 / 30;
      swing(P, 1 / 30, breeze);
      step(P, 1 / 30, want, pull, wind);
    }
  }
  const st = dt * speed;
  P.T += st;
  swing(P, st, breeze);
  // The old lamp wavers; after K2 it stutters out and strikes again.
  let lamp = 1 + 0.07 * Math.sin(P.T * 1.3) + 0.05 * Math.sin(P.T * 3.1 + 1);
  if (P.flick >= 0) {
    const t = (P.flick += dt);
    lamp *= t < 0.1 ? 0.2 : t < 0.2 ? 1 : t < 0.3 ? 0.1 : t < 0.45 ? 0.7 : t < 1.6 ? 0 : smooth(1.6, 3.4, t);
    if (t > 3.4) P.flick = -1;
  }
  P.lamp = lamp;
  if (P.T > P.nextBat && !P.bat) {
    startBat(P);
    P.nextBat = P.T + 18 + 20 * rnd();
  }
  if (P.bat) flyBat(P, st);
  step(P, st, want, pull, wind);
}

// Light on the wall at a point, after the eye. A reflector under the cap
// throws most of it down, the cap shades the wall above, less to the sides,
// and there is a steep shoulder where the lamp's reach gives out.
function wallLight(P, x, y, G) {
  const dx = x - P.bx;
  const dy = y - P.by;
  const a = dx * P.c - dy * P.s;
  const b = dx * P.s + dy * P.c;
  const r2 = a * a + b * b;
  const cd = b > 0 ? (b * b) / (r2 + 1) : 0;
  const q = 1 + r2 / 256;
  const l = (0.06 + 0.94 * cd * cd) / (q * Math.sqrt(q));
  if (l <= P.reach * P.reach) return 0;
  const s = Math.sqrt(l * (0.12 + 0.88 * clamp(0.5 + (b + 6 + 0.45 * Math.abs(a)) / (2 + 0.08 * Math.sqrt(r2)), 0, 1))) - P.reach;
  return s > 0 ? Math.pow(s, 0.7) * G : 0;
}

// Light on a moth or the iron at r from the bulb.
const near = (P, r) => (1.5 * P.lamp) / (1 + (r * r) / 121);

function splat(buf, x, y, k, col) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const px = x0 + i;
      const py = y0 + j;
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const w = k * (i ? x - x0 : 1 - x + x0) * (j ? y - y0 : 1 - y + y0);
      const q = (py * W + px) * 3;
      put(buf, q, buf[q] + col[0] * w, buf[q + 1] + col[1] * w, buf[q + 2] + col[2] * w);
    }
}

export function draw(display, params) {
  const P = params;
  if (!P.started) return;
  const { buf, alb, dark, kind, leaf, lc, lamp, jit } = P;
  const G = 2.5 * lamp * P.gain;
  // The lantern's place, in a small object the loops read fast.
  const L = (P.L = { bx: P.bx, by: P.by, c: P.c, s: P.s, reach: P.reach });
  // The damp air glows round the glass.
  const hk = lamp * P.gain * (26 + 60 * P.damp);
  const hr = 1 / (30 + 140 * P.damp);
  const gfar = (hk / 1.5 - 1) / hr;
  // Clouds run past the moon, lit by it.
  const cloud = (x, y) => smooth(0.45, 0.75, 0.6 * noise(x * 0.06 + P.cloud, y * 0.25 + 3) + 0.4 * noise((x * 0.06 + P.cloud) * 2.3 + 7, (y * 0.25 + 3) * 2.1 + 5));
  const veil = cloud(MX, MY);
  // The pool of light on the setts, under the lantern's axis.
  const pcx = P.bx + ((GY - P.by) * P.s) / P.c;
  const flut = 0.15 + 0.5 * Math.abs(P.breeze);
  const T5 = P.T * 5;
  const [lc0, lc1, lc2] = lc;
  for (let p = 0; p < N; p++) {
    const x = p % W;
    const y = (p / W) | 0;
    const q = p * 3;
    if (y < SKY) {
      const dm = (x - MX) ** 2 + (y - MY) ** 2;
      let s = cloud(x, y) * (8 + 80 / (1 + dm / 70)) + (36 * (1 - 0.6 * veil)) / (1 + dm / 12);
      if (dm < MR * MR) s += 200 * (1 - 0.75 * veil) * (1 - (0.15 * Math.sqrt(dm)) / MR);
      put(buf, q, dark[q] + 0.8 * s, dark[q + 1] + 0.86 * s, dark[q + 2] + s);
      continue;
    }
    const k = kind[p];
    let v;
    if (y < GY) {
      v = wallLight(L, x + 0.5, y + 0.5, G);
      if (k === LEAF) v *= leaf[p] ? 1.5 + flut * Math.sin(T5 + leaf[p]) : 1.5;
      else if (k === IRON) v = kind[p + W] !== IRON ? 0.45 * near(P, Math.hypot(x - P.bx, y - P.by)) : 0;
    } else {
      const ex = (x - pcx) / 13;
      const ez = (y - GY - 6) / 6;
      v = lamp * Math.max(0, 0.75 * Math.exp(-ex * ex - ez * ez) - 0.02) * (0.7 + 0.3 * smooth(GY, GY + 4, y));
    }
    const d2 = (x + 0.5 - L.bx) ** 2 + (y + 0.5 - L.by) ** 2;
    const glow = d2 < gfar ? hk / (1 + d2 * hr) - 1.5 : 0;
    v *= 255;
    buf[q] = dark[q] + (alb[q] * v + glow) * lc0;
    buf[q + 1] = dark[q + 1] + (alb[q + 1] * v + glow) * lc1;
    buf[q + 2] = dark[q + 2] + (alb[q + 2] * v + glow) * lc2;
  }
  drawLantern(P);
  drawMoths(P);
  if (P.bat) drawBat(P);
  // The weaker channels scatter up a little, under the strongest.
  for (let p = 0; p < N; p++) {
    const q = p * 3;
    let r = knee(buf[q]);
    let g = knee(buf[q + 1]);
    let b = knee(buf[q + 2]);
    const m = Math.max(r, g, b);
    const j = Math.min(50, 0.5 * m);
    if (r < m) r = Math.min(m - 1, r + j * jit[q]);
    if (g < m) g = Math.min(m - 1, g + j * jit[q + 1]);
    if (b < m) b = Math.min(m - 1, b + j * jit[q + 2]);
    display.setPixel(p % W, (p / W) | 0, r, g, b);
  }
}

// The lantern in its own frame: chain, knob, cap with its rim lit from inside,
// glass brightest round the bulb, base and finial.
function drawLantern(P) {
  const { buf, lc, lamp } = P;
  for (let y = PY - 1; y < PY + 32; y++)
    for (let x = PX - 14; x < PX + 14; x++) {
      const dx = x + 0.5 - PX;
      const dy = y + 0.5 - PY;
      const u = dx * P.c - dy * P.s;
      const v = dx * P.s + dy * P.c;
      const au = Math.abs(u);
      const q = (y * W + x) * 3;
      let e = -1;
      if (v >= 0 && v < 6 && au < 0.6) e = 6 + near(P, BV - v) * (Math.floor(v) % 2 ? 40 : 18);
      else if (v >= 6 && v < 8 && au < 1.3) e = 12;
      else if (v >= 8 && v < 12.5 && au < 1.5 + (v - 8) * 1.25) {
        const rim = v > 11.5 ? 0.5 * lamp : 0.03;
        put(buf, q, 18 + 255 * lc[0] * rim, 16 + 255 * lc[1] * rim, 14 + 255 * lc[2] * rim);
      } else if (v >= 12.5 && v < 24 && au < 6 - (v - 12.5) * 0.15) {
        if (au > 5.1 - (v - 12.5) * 0.15 || au < 0.45 || v > 22.8) e = 20;
        else {
          const gl = Math.exp(-(u * u) / 14 - ((v - BV) * (v - BV)) / 20);
          const s = lamp * (0.62 + 0.45 * gl);
          const t = gl * lamp;
          put(buf, q, 255 * Math.min(1.2, lc[0] * s + 0.25 * t), 255 * Math.min(1.2, lc[1] * s + 0.2 * t), 255 * Math.min(1.2, lc[2] * s + 0.15 * t));
        }
      } else if (v >= 24 && v < 25.5 && au < 3.8) e = 16;
      else if (v >= 25.5 && v < 27.5 && au < 1) e = 13;
      if (e >= 0) put(buf, q, e, e, e);
    }
}

function drawMoths(P) {
  const { buf, lc, mode: M, x: X, y: Y, u: U, v: V, ph: F, big: B } = P;
  for (let i = 0; i < MAXM; i++) {
    const m = M[i];
    if (!m) continue;
    const x = m === 2 ? lx(P, U[i], V[i]) : X[i];
    const y = m === 2 ? ly(P, U[i], V[i]) : Y[i];
    const r = Math.hypot(x - P.bx, y - P.by);
    const tn = TINTS[P.tint[i]];
    // In flight it is nearer the bulb than the wall and shines brighter; at
    // rest it is lit as the wall is.
    const L = (m === 3 ? 1.25 * wallLight(P.L, x, y, 2.5 * P.lamp * P.gain) : 1.8 * near(P, r)) * P.al[i] * 255;
    const col = [L * tn[0] * lc[0], L * tn[1] * lc[1], L * tn[2] * lc[2]];
    if (m === 2 || m === 3) {
      // At rest: dark on the glass; on the wall lit as the bricks, with a
      // shadow a step out from the lamp.
      const xi = Math.round(x);
      const yi = Math.round(y);
      const flick = Math.sin(F[i] * 0.3) > 0.97 ? 0.6 : 1;
      // The wings swept back in a triangle from the head, the body dimmer.
      const R = 1 + B[i];
      for (let oy = -R; oy < 2; oy++)
        for (let ox = -oy - R; ox <= oy + R; ox++) {
          const px = xi + ox;
          const py = yi + oy;
          if ((oy === 1 && !ox) || px < 0 || px >= W || py < 0 || py >= H) continue;
          const q = (py * W + px) * 3;
          const a = (ox ? 1 - 0.06 * Math.abs(ox) : 0.72) * flick;
          if (m === 2) dim(buf, q, ox ? 0.35 : 0.15);
          else put(buf, q, Math.max(buf[q] * 0.85, col[0] * a), Math.max(buf[q + 1] * 0.85, col[1] * a), Math.max(buf[q + 2] * 0.85, col[2] * a));
        }
      const sx = xi + Math.round(((x - P.bx) / (r + 0.01)) * 1.4);
      const sy = yi + Math.round(((y - P.by) / (r + 0.01)) * 1.4) + 1;
      if (m === 3 && sx >= 0 && sx < W && sy >= EAVE && sy < GY) dim(buf, (sy * W + sx) * 3, 0.5);
      continue;
    }
    // In flight: the body and two wings beating, fore and hind.
    const o = Math.abs(Math.sin(F[i]));
    const nx = -Math.sin(P.h[i]);
    const ny = Math.cos(P.h[i]);
    const span = (1.3 + 0.6 * B[i]) * (0.4 + 0.6 * o);
    const wv = 0.3 + 0.7 * o;
    splat(buf, x - 0.5, y - 0.5, 0.6, col);
    for (const sd of [1, -1]) {
      const ax = x - 0.5 + sd * nx * span;
      const ay = y - 0.5 + sd * ny * span;
      splat(buf, ax + ny * 0.4, ay - nx * 0.4, wv, col);
      splat(buf, ax * 0.6 + (x - 0.5) * 0.4 - ny * 0.5, ay * 0.6 + (y - 0.5) * 0.4 + nx * 0.5, wv * 0.6, col);
    }
  }
}

// The bat: dark, wings beating, the light glowing through them near the lamp.
function drawBat(P) {
  const { buf, lc } = P;
  const b = P.bat;
  const lit = near(P, Math.hypot(b.x - P.bx, b.y - P.by)) * 0.6 * 255;
  for (let dx = -5; dx <= 5; dx++) {
    const ad = Math.abs(dx);
    const lift = Math.sin(b.ph) * (ad - 1) * 0.7;
    const y1 = ad > 1 ? Math.round(-lift + (ad < 4 ? 1 : 0.4) - (ad % 2 ? 0 : 0.5)) : 1;
    for (let dy = ad > 1 ? Math.round(-lift - 0.3) : ad === 1 ? -2 : -1; dy <= y1; dy++) {
      const px = Math.round(b.x + dx);
      const py = Math.round(b.y + dy);
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const q = (py * W + px) * 3;
      const k = ad > 1 ? lit : lit * 0.3;
      put(buf, q, buf[q] * 0.1 + k * lc[0] * 0.85, buf[q + 1] * 0.1 + k * lc[1] * 0.42, buf[q + 2] * 0.1 + k * lc[2] * 0.25);
    }
  }
}

// Where the light piles up it rolls off instead of clipping flat.
const knee = (c) => (c < 180 ? c : 180 + 75 * (1 - Math.exp(-(c - 180) / 75)));
