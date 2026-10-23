// ===== Patternflow pattern =====
// Title:   Gear Train
// Family:  machine
// Idea:    A crank at the foot of the panel turns a train of coloured gears that climbs to the top, every gear meshing tooth for tooth with the one below.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the snap-together plastic gear sets children build on a pegboard
// Round:   8
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Gears=4..9, Tick=0..1
//
// Knob 1: Hue. Turns the colour of every gear together, starting from a blue drive gear under yellow, green and violet.
// Knob 2: Speed. How fast the crank turns: at the bottom of the range the drive gear creeps a tooth every few seconds, at the top it passes three teeth a second.
// Knob 3: Gears. How many gears the train has; fewer gears are bigger, so the train always reaches from the crank to the top of the panel.
// Knob 4: Tick. Smooth turning at 0; turned up, the crank moves a tooth at a time and every gear jumps and settles together, like a ratchet.
// Buttons: K1 tap reverses the crank; the train slows, stops and runs the other way.

const W = 64;
const H = 128;
const N = W * H;
// The module: half a tooth pitch on the pitch circle per tooth, in LEDs.
// Every gear of the set has it, so any two of them mesh.
const MOD = 1.7;
const ADD = MOD;
const DED = 1.2 * MOD;
// How sharply a tooth's flank turns into its tip and root: a trapezoid tooth.
const FLANK = 1.7;
const MAX = 9;
// A big-small rhythm up the train, scaled to fill the panel's height.
const TEETH = [30, 15, 25, 13, 27, 14, 22, 12, 24];
// The set's colours, bottom to top: the drive gear is blue.
const HUES = [0.6, 0.14, 0.34, 0.78, 0.07, 0.5, 0.92, 0.22, 0.68];

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function hsvInto(out, o, h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

// Lay out n gears scaled by s, each one leaning off the gear below by the
// angle the plan gives it: the drive gear at the foot, every next gear
// meshing with the one below. Null when a gear runs too far off the panel's
// sides or into any gear but its neighbours.
function place(n, s, plan) {
  const g = [];
  for (let i = 0; i < n; i++) {
    const z = Math.max(10, Math.round(TEETH[i] * s));
    const rp = (MOD * z) / 2;
    g.push({ z, rp, ro: rp + ADD, x: 0, y: 0, alpha: 0 });
  }
  g[0].x = g[0].ro * 0.55 + (W - g[0].ro * 1.1) * plan[0];
  for (let i = 1; i < n; i++) {
    const a = g[i - 1];
    const b = g[i];
    const d = a.rp + b.rp;
    b.x = a.x + d * Math.sin(plan[i]);
    b.y = a.y - d * Math.cos(plan[i]);
    if (b.x < b.ro * 0.45 || b.x > W - b.ro * 0.45 || b.y + b.ro > g[0].y + g[0].ro) return null;
    for (let j = 0; j < i - 1; j++) {
      const c = g[j];
      if (Math.hypot(b.x - c.x, b.y - c.y) < b.ro + c.ro + 1.5) return null;
    }
    b.alpha = Math.atan2(b.y - a.y, b.x - a.x);
  }
  return g;
}

function span(g) {
  let top = Infinity;
  for (const q of g) top = Math.min(top, q.y - q.ro);
  return g[0].y + g[0].ro - top;
}

function layout(P, n) {
  // Try a few hundred plans and keep the one whose gears can be biggest while
  // the train still fits between the foot of the panel and its top. Links
  // mostly lean to alternate sides and lean between 20 and 75 degrees.
  let best = null;
  let bestS = 0.3;
  const plan = [0];
  for (let c = 0; c < 240; c++) {
    plan[0] = hash(n, c * 16);
    let side = hash(n, c * 16 + 1) < 0.5 ? -1 : 1;
    for (let i = 1; i < n; i++) {
      if (hash(c, i * 7 + n) < 0.75) side = -side;
      plan[i] = side * (0.35 + 0.95 * hash(c * 31 + n, i));
    }
    for (let s = 2.4; s > bestS + 0.01; s -= 0.02) {
      const g = place(n, s, plan);
      if (g && span(g) <= 132) {
        bestS = s;
        best = g;
        break;
      }
    }
  }
  if (!best) {
    for (let i = 0; i < n; i++) plan[i] = i ? (i % 2 ? -0.35 : 0.35) : 0.5;
    best = place(n, 0.3, plan);
  }
  const shift = 64 + span(best) / 2 - (best[0].y + best[0].ro);
  for (const q of best) q.y += shift;
  P.gears = best;
  P.n = n;

  // The pegboard: brown hardboard with a hole every four LEDs, and under each
  // gear a soft shadow cast down and to the right.
  const board = P.board;
  const base = [0, 0, 0];
  hsvInto(base, 0, 0.075, 0.55, 0.21);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const hx = (x % 4) - 1.5;
      const hy = (y % 4) - 1.5;
      const hole = clamp01(1.25 - Math.hypot(hx, hy));
      let shade = 1 - 0.72 * hole;
      for (const q of best) {
        const d = Math.hypot(x - q.x - 1.5, y - q.y - 2.5);
        shade *= 1 - 0.55 * clamp01((q.rp + 1.5 - d) / 1.5);
      }
      const p = y * W + x;
      board[p * 3] = base[0] * shade;
      board[p * 3 + 1] = base[1] * shade;
      board[p * 3 + 2] = base[2] * shade;
    }
  }
}

export function setup(params) {
  const P = params;
  P.board = new Float32Array(N * 3);
  P.frame = new Float32Array(N * 3);
  P.col = new Float32Array(3);
  P.theta = new Float32Array(MAX);
  P.u = 0;
  P.vel = 2;
  P.dir = 1;
  P.speed = 2;
  P.tick = 0.06;
  P.hue = 0;
  layout(P, 4);
}

// The snap of one ratchet step: quick, a little past, and back.
function snap(f) {
  const t = Math.min(1, f / 0.28) - 1;
  return 1 + 2.70158 * t * t * t + 1.70158 * t * t;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 4, 0.06];
  dt = Math.min(dt, 0.1);
  P.hue = k[0];
  P.speed = Math.max(0.2, Math.min(3, k[1]));
  const n = Math.max(4, Math.min(MAX, Math.round(k[2])));
  P.tick = clamp01(k[3]);
  if (n !== P.n) layout(P, n);

  if (input.btnPressed && input.btnPressed[0]) P.dir = -P.dir;
  // The crank speeds up or comes round to the other way in about half a second.
  const target = P.dir * P.speed;
  P.vel += (target - P.vel) * Math.min(1, dt * 5);
  P.u += P.vel * dt;

  // The drive gear's angle, a tooth at a time as Tick turns up.
  const g = P.gears;
  const whole = Math.floor(P.u);
  const stepped = whole + snap(P.u - whole);
  const teeth = P.u * (1 - P.tick) + stepped * P.tick;
  P.theta[0] = (teeth * 2 * Math.PI) / g[0].z;
  // Each gear takes its angle from the one below: where their pitch circles
  // touch, a tooth of one sits in a gap of the other.
  for (let i = 1; i < g.length; i++) {
    const a = g[i - 1];
    const b = g[i];
    P.theta[i] = b.alpha + Math.PI - (Math.PI - a.z * (b.alpha - P.theta[i - 1])) / b.z;
  }
}

export function draw(display, params) {
  const P = params;
  const out = P.frame;
  out.set(P.board);
  const col = P.col;
  const g = P.gears;

  for (let i = 0; i < g.length; i++) {
    const q = g[i];
    const th = P.theta[i];
    const z = q.z;
    const rp = q.rp;
    const ro = q.ro;
    const root = rp - DED;
    const groove = root - 1.6;
    const hub = Math.max(2.6, rp * 0.26);
    const holes = rp >= 18 ? 6 : rp >= 13 ? 5 : rp >= 9 ? 3 : 0;
    const ringR = (hub + groove) / 2;
    const holeR = holes ? Math.min(0.3 * (groove - hub), ringR * Math.sin(Math.PI / holes) * 0.55) : 0;
    const step = holes ? (2 * Math.PI) / holes : 1;
    hsvInto(col, 0, HUES[i] + P.hue, 0.82, 0.93);
    const crank = i === 0;
    const ct = Math.cos(th + step / 2);
    const st = Math.sin(th + step / 2);
    const arm = ringR + 1;

    const x0 = Math.max(0, Math.floor(q.x - ro - 1));
    const x1 = Math.min(W - 1, Math.ceil(q.x + ro + 1));
    const y0 = Math.max(0, Math.floor(q.y - ro - 1));
    const y1 = Math.min(H - 1, Math.ceil(q.y + ro + 1));
    for (let y = y0; y <= y1; y++) {
      const dy = y - q.y;
      for (let x = x0; x <= x1; x++) {
        const dx = x - q.x;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r > ro + 1) continue;
        const beta = Math.atan2(dy, dx);
        // The tooth outline: radius as a trapezoid wave around the rim.
        const phi = z * (beta - th);
        const c = Math.cos(phi);
        const f = Math.max(-1, Math.min(1, FLANK * c));
        const depth = f > 0 ? ADD : DED;
        let dist = rp + depth * f - r;
        if (Math.abs(FLANK * c) < 1 && r > 0.5) {
          const slope = (depth * FLANK * Math.sin(phi) * z) / r;
          dist /= Math.sqrt(1 + slope * slope);
        }
        let cover = clamp01(dist + 0.5);
        if (cover <= 0) continue;

        // The crank handle on the drive gear: an arm out from the hub between
        // two holes, and a cream knob at its end. It stands on the gear's face.
        let handle = 0;
        let knob = 0;
        if (crank) {
          const along = dx * ct + dy * st;
          const across = -dx * st + dy * ct;
          const armC = along > 0 && along < arm ? clamp01(1.9 - Math.abs(across)) : 0;
          knob = clamp01(3.6 - Math.hypot(along - arm, across));
          handle = Math.max(armC, knob);
        }

        // Lightening holes, turning with the gear: the board shows through.
        if (holes) {
          const k = Math.round((beta - th) / step);
          const a = th + k * step;
          const hd = Math.hypot(dx - ringR * Math.cos(a), dy - ringR * Math.sin(a));
          cover *= 1 - clamp01(holeR - hd + 0.5);
          cover = Math.max(cover, handle);
          if (cover <= 0) continue;
        }

        // Light from the top left, a groove inside the teeth, a raised hub.
        // The outline catches the light on its top left and falls into shade
        // on its bottom right, so the teeth stand up off the face.
        const face = -(dx * 0.6 + dy * 0.8) / Math.max(1, r);
        const rim = clamp01(1 - dist / 1.6);
        let v = 1;
        v *= 1 - 0.16 * clamp01(1 - Math.abs(r - groove) * 1.1);
        if (r < hub + 0.5) v *= 1.08 - 0.22 * clamp01(1 - Math.abs(r - hub) * 1.2);
        if (face < 0) v *= 1 + 0.32 * rim * face;
        let R = col[0] * v;
        let G = col[1] * v;
        let B = col[2] * v;
        if (face > 0) {
          const w = 0.4 * rim * face;
          R += (255 - R) * w;
          G += (255 - G) * w;
          B += (255 - B) * w;
        }
        // The axle peg in the middle, steel grey and still.
        const peg = clamp01(1.9 - r);
        if (peg > 0) {
          R += (190 - R) * peg;
          G += (192 - G) * peg;
          B += (200 - B) * peg;
        }
        if (handle > 0) {
          const lit = knob >= handle ? 1 : 0.8;
          R += (245 * lit - R) * handle;
          G += (232 * lit - G) * handle;
          B += (205 * lit - B) * handle;
        }
        const p = (y * W + x) * 3;
        out[p] += (R - out[p]) * cover;
        out[p + 1] += (G - out[p + 1]) * cover;
        out[p + 2] += (B - out[p + 2]) * cover;
      }
    }
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      display.setPixel(x, y, Math.min(255, out[p]), Math.min(255, out[p + 1]), Math.min(255, out[p + 2]));
    }
  }
}
