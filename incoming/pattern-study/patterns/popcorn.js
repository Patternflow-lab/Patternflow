// ===== Patternflow pattern =====
// Title:   Popcorn
// Family:  kitchen
// Idea:    A cinema popcorn cart fills the panel: kernels pop in a kettle hung under the heat lamp, the puffs jump, pile up past the rim and spill over, the kettle tips its batch onto the heap on the cabinet floor, and a scoop comes for the heap when it stands too high.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 19, after the glass-cabinet popcorn carts of cinema lobbies
// Round:   19
// ===============================
// @matrix 64x128
// @knobs Lamp=0..1, Heat=0.2..3, Batch=6..16, Heap=0..1
//
// Knob 1: Lamp. The colour of the heat lamp that lights the cabinet, the steel and the corn, from a gold bulb at 0 through amber to the red of an infrared bulb at 1.
// Knob 2: Heat. How hot the kettle runs, so how fast it goes: at 2 a batch pops, tips and starts again every 12 s; at 0.2 the kernels pop one by one.
// Knob 3: Batch. The kettle, from a 6 oz kettle 26 LEDs wide to a 16 oz one 44 wide, and with it how many puffs each batch tips onto the heap.
// Knob 4: Heap. How high the corn may stand before the scoop comes for it, from 22 rows over the deck to 44, about ten rows under the kettle.
// Buttons: K1 tap sends the scoop in now.

const W = 64;
const H = 128;
const N = W * H;
// Inside the glass. The heap stands on the warming deck, row FLOOR.
const XL = 3;
const XR = 60;
const TOPC = 15;
const FLOOR = 103;
// The heat lamp: two tubes on row 16, one each side of the kettle's motor.
const LA = [6, 25, 38, 57];
// The kettle turns about this point when it tips.
const PX = 32;
const PY = 36;
const MAXH = 640;
const MAXF = 360;
const NS = 12;
// Popcorn is light: it falls slower than a ball and drags in the air.
const G = 150;
// How much a puff raises the heap under each of its five columns.
const PROF = [1.2, 0.2, 0, 0.2, 1.2];
// A batch, in batch seconds: pour, heat, pop, settle, tip, empty, back up.
const [POUR, HEAT, POP, REST, TIP, EMPTY] = [0, 1, 2, 3, 4, 5];
const DUR = [2, 2.5, 12, 1, 2, 2.5, 2];
const TIP_MAX = 1.7;
const SCOOP_T = 2.6;
// Lamp colours from gold to the red of an infrared bulb.
const LAMP = [[255, 204, 120], [255, 168, 88], [255, 120, 70], [255, 76, 70]];
const { min, max, round, floor, sin, cos, abs } = Math;
const rnd = () => Math.random();
// POPCORN in a 4x5 font, one hex digit a row.
const SIGN = ["E9E88", "69996", "E9E88", "78887", "69996", "E9EA9", "9DB99"];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (x) => ((x = clamp(x, 0, 1)), x * x * (3 - 2 * x));

// Puffs: three or four lobes pressed together, lit from the top left, with a
// fleck of hull (-1).
function makeSprites(P) {
  const spr = (P.spr = new Float32Array(NS * 25));
  for (let s = 0; s < NS; s++) {
    for (let count = 0; count < 12; ) {
      count = 0;
      const lobes = [[0, 0, 1.4 + rnd() * 0.4]];
      for (let b = 1; b < 3 + (s & 1); b++) {
        const ang = rnd() * 7;
        const dist = 0.9 + rnd() * 0.7;
        lobes.push([cos(ang) * dist, sin(ang) * dist, 0.9 + rnd() * 0.6]);
      }
      for (let j = 0; j < 25; j++) {
        const x = (j % 5) - 2;
        const y = ((j / 5) | 0) - 2;
        const d = lobes.map(([cx, cy, r]) => Math.hypot(x - cx, y - cy) - r).sort((p, q) => p - q);
        let v = 0;
        if (d[0] <= 0.2) {
          v = (0.9 + 0.12 * clamp((-x - y) / 3, -1, 1)) * (d[1] < 0.4 && d[0] > -0.6 ? 0.84 : 1);
          count++;
        }
        spr[s * 25 + j] = v;
      }
    }
    for (let j = 24; j >= 10; j--) {
      if (spr[s * 25 + j] > 0 && (j * 7 + s * 3) % 4 === 0) {
        spr[s * 25 + j] = -1;
        break;
      }
    }
  }
  // The packed body of the heap, under the loose puffs on its surface.
  P.tex = new Float32Array(N).fill(0.6);
  for (let n = 0; n < 1700; n++) {
    const s = floor(rnd() * NS) * 25;
    const cx = floor(rnd() * (W + 4)) - 4;
    const cy = 44 + floor(rnd() * 60);
    const k = 0.86 + rnd() * 0.14;
    for (let j = 0; j < 25; j++) {
      const x = cx + (j % 5);
      if (spr[s + j] !== 0 && x >= 0 && x < W) P.tex[(cy + ((j / 5) | 0)) * W + x] = spr[s + j] < 0 ? -1 : spr[s + j] * k;
    }
  }
}

// The cart round the glass, painted once: marquee, frame, base and wheels.
function paintCart(P) {
  const S = (P.cart = new Float32Array(N * 3));
  const box = (x0, y0, x1, y1, c) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) S.set(c, (y * W + x) * 3);
  };
  box(0, 0, 63, 11, [84, 8, 12]);
  box(0, 1, 63, 10, [134, 14, 20]);
  for (let i = 0; i < 7; i++)
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 4; x++)
        if ((parseInt(SIGN[i][y], 16) >> (3 - x)) & 1) {
          box(16 + i * 5 + x, y + 4, 16 + i * 5 + x, y + 4, [60, 4, 8]);
          box(15 + i * 5 + x, y + 3, 15 + i * 5 + x, y + 3, [255, 236, 176]);
        }
  box(0, 12, 63, 106, [150, 18, 24]);
  box(0, 13, 63, 13, [176, 30, 34]);
  box(0, 14, 63, 14, [196, 150, 64]);
  box(0, 106, 63, 106, [196, 150, 64]);
  for (const [x, c] of [[0, [84, 8, 12]], [1, [176, 30, 34]], [2, [150, 150, 160]]]) {
    box(x, 15, x, 106, c);
    box(63 - x, 15, 63 - x, 106, c);
  }
  box(0, 107, 63, 118, [124, 14, 20]);
  box(0, 119, 63, 119, [60, 6, 10]);
  for (const x of [5, 34]) {
    box(x, 109, x + 24, 117, [176, 124, 52]);
    box(x + 1, 110, x + 23, 116, [140, 16, 23]);
  }
  box(27, 113, 27, 113, [240, 200, 110]);
  box(36, 113, 36, 113, [240, 200, 110]);
  for (const cx of [13, 51]) {
    box(cx - 3, 120, cx + 3, 120, [70, 70, 76]);
    for (let y = 120; y < H; y++)
      for (let x = cx - 5; x <= cx + 5; x++) {
        const d = Math.hypot(x + 0.5 - cx, y - 123);
        if (d < 4.4) box(x, y, x, y, d < 1.6 ? [170, 170, 182] : y < 121 ? [78, 78, 87] : [52, 52, 58]);
      }
  }
}

function halfW(a, d, v) {
  const r = (v - (d - 5.5)) / 6;
  return r <= 0 ? a : a * Math.sqrt(max(0, 1 - r * r));
}

// The kettle for a batch size, and the places puffs take in it up to a dome.
function resize(P, batch) {
  P.batch = batch;
  const a = (P.a = round(12 + 0.9 * (batch - 6)));
  const d = (P.d = round(13 + 0.6 * (batch - 6)));
  P.pv = round(d * 0.3);
  const su = [];
  const sv = [];
  let row = 0;
  const lay = (v, hw) => {
    for (let u = -hw + (row++ & 1 ? 1.7 : 0); u <= hw + 0.01; u += 3.4) {
      su.push(u + (rnd() - 0.5) * 0.8);
      sv.push(v + (rnd() - 0.5) * 0.6);
    }
  };
  for (let v = d - 4.6; v > 1.2; v -= 2.9) lay(v, halfW(a, d, v + 2) - 4);
  P.C = su.length;
  const dh = (a - 2) * 0.45;
  for (let v = -0.6; v > -dh + 0.5; v -= 2.9) lay(v, (a - 3) * Math.sqrt(max(0, 1 - ((-v + 1.5) / dh) ** 2)) - 1);
  P.D = su.length - P.C;
  P.su = Float32Array.from(su);
  P.sv = Float32Array.from(sv);
  P.ss = Uint8Array.from(su, () => floor(rnd() * NS));
  // A third again as many pops as the kettle holds: those go over the rim.
  P.total = P.C + P.D + round(0.35 * P.C);
  P.KN = round((a - 3) * 1.5);
  P.ku = Float32Array.from({ length: P.KN }, () => (rnd() * 2 - 1) * (a - 4));
  P.kv = Float32Array.from({ length: P.KN }, () => d - 4 + rnd() * 1.4);
  P.landed = min(P.landed, P.C + P.D);
  P.popped = min(P.popped, P.total);
}

const turn = (P) => ((P.cph = cos(P.phi)), (P.sph = sin(P.phi)), P.phi);

// Kettle coordinates (u across, v down from the rim) to the panel, in P.qx, P.qy.
function toScreen(P, u, v) {
  const w = v - P.pv;
  P.qx = PX + P.cph * u - P.sph * w;
  P.qy = PY + P.sph * u + P.cph * w;
}

// Types: 0 falling to the heap, 1 hopping in the kettle, 4 rolling down the heap.
function spawn(P, type, x, y, vx, vy, g, s) {
  if (P.nF >= MAXF) return;
  const v = [type, x, y, vx, vy, g, rnd() * 0.1, s, 0];
  const i = P.nF++;
  P.fl.forEach((A, n) => (A[i] = v[n]));
}

// A kernel bursting: a white star for a tenth of a second.
function flash(P) {
  if (P.flash.length < 48) P.flash.push([P.qx, P.qy, 0.1]);
}

// The row a puff dropped at col rests on.
function support(P, col) {
  const s = P.surf;
  return min(s[max(XL, col - 1)], s[col], s[min(XR, col + 1)]);
}

// How far the heap falls away three columns toward dir.
const fallAway = (P, col, dir) => P.surf[clamp(col + 3 * dir, XL, XR)] - support(P, col);

function place(P, col, s, spr) {
  if (P.nH >= MAXH) return true;
  const n = P.nH++;
  const y = (P.hy[n] = s - 2);
  P.hx[n] = col;
  P.hs[n] = spr;
  for (let c = max(XL, col - 2); c <= min(XR, col + 2); c++) P.surf[c] = min(P.surf[c], y - 2 + PROF[c - col + 2]);
  return true;
}

// A puff rolls down any side steeper than a row a column.
function dropInstant(P, x, spr) {
  for (let n = 0; n < 60; n++) {
    const l = fallAway(P, x, -1);
    const r = fallAway(P, x, 1);
    if (l <= 3 && r <= 3) break;
    x = clamp(x + (r > l ? 1 : r < l ? -1 : rnd() < 0.5 ? -1 : 1), XL + 2, XR - 2);
  }
  place(P, x, support(P, x), spr);
}

const rise = (P) => FLOOR - 1 - min(...P.surf.subarray(XL, XR + 1));

// A kernel bursts. Until the kettle is full the puff jumps and lands back on
// the pile; once it is full every pop throws one over the rim.
function pop(P) {
  P.popped++;
  if (P.kernels > 0) P.kernels--;
  const cap = P.C + P.D;
  const next = P.landed + P.hopping;
  const fill = next / cap;
  if (next < cap && !(fill > 0.55 && rnd() < 0.12)) {
    toScreen(P, P.su[next], P.sv[next]);
    flash(P);
    spawn(P, 1, P.qx, P.qy - 1, (rnd() - 0.5) * 10, -(18 + rnd() * 32), P.qy, P.ss[next]);
    P.hopping++;
  } else {
    const side = rnd() < 0.5 ? -1 : 1;
    toScreen(P, side * P.a * (0.45 + rnd() * 0.4), min(P.sv[min(next, cap - 1)], 1) - 1.5);
    flash(P);
    spawn(P, 0, P.qx, P.qy, side * (12 + rnd() * 14), -(14 + rnd() * 24), 0, floor(rnd() * NS));
  }
}

function advance(P, h) {
  P.pt += h;
  const ph = P.phase;
  P.rate = 0;
  if (ph === POUR) {
    const f = min(1, P.pt / (DUR[POUR] * 0.85));
    P.kernels = round((P.total + 3) * f);
    P.oil = f;
  } else if (ph === POP) {
    const x = min(1, P.pt / DUR[POP]);
    P.rate = 6 * x * (1 - x);
    while (P.popped < floor(P.total * smooth(x))) pop(P);
    P.oil = 1 - 0.65 * x;
  } else if (ph === TIP || ph === EMPTY) {
    P.phi = ph === TIP ? TIP_MAX * smooth(P.pt / DUR[TIP]) : TIP_MAX + 0.07 * sin(P.pt * 25) * (1 - P.pt / DUR[EMPTY]);
    if (turn(P) > 0.85) {
      // Empty half a second before the shaking stops, top puff first.
      const left = (ph === TIP ? DUR[TIP] - P.pt + DUR[EMPTY] : DUR[EMPTY] - P.pt) - 0.5;
      P.pourAcc += (P.landed * h) / max(h, left);
      for (; P.pourAcc >= 1 && P.landed > 0; P.pourAcc--) {
        const i = --P.landed;
        toScreen(P, P.su[i], P.sv[i]);
        spawn(P, 0, P.qx, P.qy, P.sph * (8 + rnd() * 12) + 4, -P.cph * (8 + rnd() * 10) + rnd() * 4, 0, P.ss[i]);
      }
    }
  } else if (ph > EMPTY) P.phi = TIP_MAX * (1 - smooth(P.pt / DUR[ph]));
  if (P.pt >= DUR[ph]) {
    P.pt -= DUR[ph];
    P.phase = (ph + 1) % 7;
    if (P.phase === POUR) Object.assign(P, { popped: 0, landed: 0, hopping: 0, kernels: 0, oil: 0, phi: 0 });
    if (P.phase === HEAT) P.oil = 1;
    if (P.phase === TIP) tipNow(P);
    if (ph === EMPTY) P.landed = 0;
  }
}

// Puffs still in the air when it tips fall clear of it.
function tipNow(P) {
  for (let i = 0; i < P.nF; i++) if (P.ft[i] === 1) P.ft[i] = 0;
  P.hopping = P.pourAcc = 0;
}

function moveParticles(P, dt) {
  const { ft, fx, fy, fvx, fvy, fg, fa, fs, fb } = P;
  const drag = Math.exp(-0.8 * dt);
  for (let i = 0; i < P.nF; ) {
    const t = ft[i];
    let dead = false;
    // A puff tumbles as it falls or rolls.
    fa[i] += dt;
    if (fa[i] > 0.1) [fa[i], fs[i]] = [0, (fs[i] + 1 + floor(rnd() * 3)) % NS];
    if (t === 4) {
      const dir = fvx[i] > 0 ? 1 : -1;
      fx[i] += dir * 26 * dt;
      const col = clamp(round(fx[i]), XL + 2, XR - 2);
      const s = support(P, col);
      fy[i] = s - 2;
      if (col !== round(fx[i]) || fallAway(P, col, dir) <= 2.5) dead = place(P, col, s, fs[i]);
    } else {
      fvy[i] = (fvy[i] + G * dt) * drag;
      fvx[i] *= drag;
      fx[i] += fvx[i] * dt;
      fy[i] += fvy[i] * dt;
      if (abs(fx[i] - 31.5) > 26.5) [fvx[i], fx[i]] = [-0.5 * fvx[i], clamp(fx[i], XL + 2, XR - 2)];
      const col = round(fx[i]);
      const s = support(P, col);
      if (t === 1) {
        if (fvy[i] > 0 && fy[i] >= fg[i]) {
          P.landed = min(P.landed + 1, P.C + P.D);
          P.hopping = max(0, P.hopping - 1);
          dead = true;
        }
      } else if (fy[i] + 2 >= s) {
        const l = fallAway(P, col, -1);
        const r = fallAway(P, col, 1);
        // A light bounce first.
        if (fvy[i] > 40 && !fb[i]) [fb[i], fy[i], fvy[i], fvx[i]] = [1, s - 2, fvy[i] * -0.32, fvx[i] + (rnd() - 0.5) * 20];
        else if (l > 3 || r > 3) [ft[i], fx[i], fvx[i]] = [4, col, r > l ? 1 : r < l ? -1 : rnd() - 0.5];
        else dead = place(P, col, s, fs[i]);
      }
    }
    if (dead) {
      const j = --P.nF;
      for (const A of P.fl) A[i] = A[j];
    } else i++;
  }
  P.flash = P.flash.filter((f) => (f[2] -= dt) > 0);
}

// The scoop digs in where the heap stands highest, from the nearer side.
function startScoop(P) {
  let best = XL + 10;
  for (let c = XL + 10; c <= XR - 10; c++) if (P.surf[c] < P.surf[best]) best = c;
  if (P.surf[best] > FLOOR - 8) return false;
  Object.assign(P, { sc: 0, scSide: best >= 32 ? 1 : -1, scX: best, scY: min(FLOOR - 3, P.surf[best] + 8), got: [] });
  return true;
}

// It lifts what lies over its blade, and the puffs it undercut fall again.
function capture(P) {
  const keep = [];
  for (let i = 0; i < P.nH; i++) {
    const dx = P.hx[i] - P.scX;
    const dy = P.hy[i] - P.scY;
    if (abs(dx) <= 9 && dy <= 1 && dy >= -20 && P.got.length < 60) P.got.push([dx, -2 - max(0, -2 - dy) * 0.45, P.hs[i]]);
    else keep.push([P.hx[i], P.hy[i], P.hs[i]]);
  }
  P.scGot = true;
  keep.sort((p, q) => q[1] - p[1]);
  P.surf.fill(FLOOR - 1);
  P.nH = 0;
  for (const [x, y, s] of keep) {
    const top = support(P, x);
    if (top - 2 - y > 3) spawn(P, 0, x, y, 0, 0, 0, s);
    else place(P, x, top, s);
  }
}

function tick(P, dt) {
  P.t += dt;
  advance(P, dt * P.heat);
  turn(P);
  moveParticles(P, dt);
  const high = rise(P) - P.target;
  if (P.sc < 0 && high > 5) P.scNext = min(P.scNext, P.t + 1);
  if (P.sc < 0 && P.t >= P.scNext && !startScoop(P)) P.scNext = P.t + 2;
  if (P.sc >= 0) {
    P.sc += dt;
    if (!P.scGot && P.sc >= SCOOP_T * 0.36) capture(P);
    if (P.sc >= SCOOP_T) {
      P.sc = -1;
      P.scGot = false;
      P.scNext = P.t + (high > 0 ? 1 + rnd() * 1.5 : 6 + rnd() * 4);
    }
  }
}

export function setup(params) {
  const P = params;
  const F = (n) => new Float32Array(n);
  Object.assign(P, { buf: F(N * 3), light: F(N).fill(0.8), surf: F(W), hx: F(MAXH), hy: F(MAXH), hs: new Uint8Array(MAXH), lc: F(3), col: F(6) });
  P.fl = ["ft", "fx", "fy", "fvx", "fvy", "fg", "fa", "fs", "fb"].map((k, i) => (P[k] = i === 0 || i > 6 ? new Uint8Array(MAXF) : F(MAXF)));
  makeSprites(P);
  paintCart(P);
  Object.assign(P, { t: 0, started: false, batch: -1, phase: POP, pt: 0, phi: 0, cph: 1, sph: 0, popped: 0, landed: 0, hopping: 0, kernels: 0 });
  Object.assign(P, { oil: 1, rate: 0, pourAcc: 0, nH: 0, nF: 0, flash: [], got: [], sc: -1, scGot: false, scNext: 1e9, lamp: 0, heat: 2, target: 23 });
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 6, 0.06];
  dt = min(max(dt, 0), 0.1);
  P.lamp = clamp(k[0], 0, 1);
  P.heat = clamp(k[1], 0.2, 3);
  P.target = 22 + 22 * clamp(k[3], 0, 1);
  if (!P.started) {
    // The heap left by earlier batches, the same for every kettle size.
    P.surf.fill(FLOOR - 1);
    for (let i = 0; i < 300 && rise(P) < P.target - 2; i++) {
      const g = (rnd() + rnd() + rnd() - 1.5) * 2;
      dropInstant(P, clamp(round(34 + g * 12), XL + 2, XR - 2), floor(rnd() * NS));
    }
  }
  const batch = round(clamp(k[2], 6, 16) * 2) / 2;
  if (batch !== P.batch) resize(P, batch);
  if (!P.started) {
    P.started = true;
    P.kernels = P.total + 3;
    // Open 3.5 s into popping, at the kettle's own heat.
    for (let i = 0; i < 105; i++) tick(P, 1 / 30);
    P.scNext = P.t + 2;
  }
  if (input.btnPressed && input.btnPressed[0] && P.sc < 0) startScoop(P);
  tick(P, dt);
}

function put(P, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  P.buf.set([r, g, b], (y * W + x) * 3);
}

function stamp(P, x, y, s, k) {
  const xi = round(x) - 2;
  const yi = round(y) - 2;
  for (let j = 0; j < 25; j++) {
    const v = P.spr[s * 25 + j];
    const px = xi + (j % 5);
    const py = yi + ((j / 5) | 0);
    if (v === 0 || px < XL || px > XR || py < 0 || py >= H) continue;
    const p = py * W + px;
    const l = (0.95 + 0.25 * P.light[p]) * k * (v < 0 ? 1 : v);
    const c = v < 0 ? 3 : 0;
    for (let i = 0; i < 3; i++) P.buf[p * 3 + i] = P.col[c + i] * l;
  }
}

function line(P, x0, y0, x1, y1, v) {
  const n = Math.ceil(max(abs(x1 - x0), abs(y1 - y0)) * 1.5) + 1;
  for (let i = 0; i <= n; i++) {
    const x = round(x0 + ((x1 - x0) * i) / n);
    const y = round(y0 + ((y1 - y0) * i) / n);
    if (x < XL || x > XR || y < TOPC || y > FLOOR + 1) continue;
    const l = (0.5 + 0.5 * P.light[y * W + x]) * v;
    put(P, x, y, 210 * l, 212 * l, 222 * l);
  }
}

// Inside the glass: the back wall in the lamp's light, shaded by how much of
// the lamp tubes each LED sees past the kettle's bottom. Then the deck.
function cabinet(P) {
  const { buf, light, lc } = P;
  let x1 = 99;
  let x2 = -99;
  let yo = 0;
  for (let c = 0; c < 4; c++) {
    toScreen(P, c & 1 ? P.a : -P.a, c & 2 ? P.d : -1);
    x1 = min(x1, P.qx);
    x2 = max(x2, P.qx);
    yo = max(yo, P.qy - 1);
  }
  for (let y = TOPC; y < FLOOR + 2; y++) {
    const dl = (y - 16) / 55;
    const fall = 1 / (1 + dl * dl);
    const k = y > yo ? (y - 16) / (y - yo) : 0;
    for (let x = XL; x <= XR; x++) {
      const p = y * W + x;
      let w;
      let l = fall;
      if (y >= FLOOR) w = (y > FLOOR ? 0.55 : x % 3 ? 0.75 : 0.25) * 0.3;
      else {
        if (k > 0) {
          const xa = x + 0.5 + (x1 - x - 0.5) * k;
          const xb = x + 0.5 + (x2 - x - 0.5) * k;
          l *= 1 - (0.6 * (max(0, min(xb, LA[1]) - max(xa, LA[0])) + max(0, min(xb, LA[3]) - max(xa, LA[2])))) / 38;
        }
        w = 0.04 + 0.36 * l;
      }
      for (let i = 0; i < 3; i++) buf[p * 3 + i] = lc[i] * w + (y >= FLOOR ? w * 300 : 5);
      light[p] = l;
    }
  }
  // Lamp tubes, the kettle's motor, the chase of bulbs round the marquee.
  for (let x = LA[0]; x <= LA[3]; x++) {
    if (x > LA[1] && x < LA[2]) continue;
    put(P, x, 15, 58, 58, 64);
    put(P, x, 16, lc[0] * 1.1, lc[1] * 1.1, lc[2] * 1.1);
    for (let i = 0; i < 3; i++) buf[(17 * W + x) * 3 + i] += lc[i] * 0.25;
  }
  for (let y = 15; y <= 20; y++)
    for (let x = 28; x <= 35; x++) {
      const v = y === 15 ? 0.5 : x === 34 ? 1.2 : 0.85;
      put(P, x, y, 96 * v, 98 * v, 108 * v);
    }
  const chase = floor(P.t * 6);
  for (let i = 0; i < 32; i++) {
    const on = ((i < 16 ? i : 47 - i) + chase) % 3;
    put(P, 2 + 4 * (i & 15), i < 16 ? 1 : 10, on ? 255 : 120, on ? 214 : 60, on ? 120 : 30);
  }
}

function drawHeap(P) {
  const { surf, buf, light, tex, col } = P;
  for (let x = XL; x <= XR; x++) {
    const top = Math.ceil(surf[x] + 2.5);
    for (let y = max(top, 44); y < FLOOR; y++) {
      const p = y * W + x;
      const v = tex[p];
      const l = (0.95 + 0.25 * light[p]) * (1 - min(0.36, (y - top) * 0.012)) * (v < 0 ? 1 : v);
      for (let i = 0; i < 3; i++) buf[p * 3 + i] = col[(v < 0 ? 3 : 0) + i] * l;
    }
  }
  for (let i = 0; i < P.nH; i++) stamp(P, P.hx[i], P.hy[i], P.hs[i], 1 - min(0.3, max(0, P.hy[i] - surf[P.hx[i]] - 3) * 0.016));
}

function drawScoop(P) {
  if (P.sc < 0) return;
  const u = P.sc / SCOOP_T;
  const side = P.scSide;
  // In along the heap with the blade down, a turn to lift, then up and out.
  const e = u < 0.36 ? (1 - u / 0.36) ** 2 : u > 0.5 ? ((u - 0.5) / 0.5) ** 2 : 0;
  const x = P.scX + side * 72 * e;
  const y = P.scY - (u < 0.36 ? 26 * e : 2 + 38 * e);
  const tilt = side * (-0.22 + 0.52 * smooth((u - 0.36) / 0.14));
  const cb = cos(tilt);
  const sb = sin(tilt);
  const tx = (lx, ly) => x + lx * side * cb - ly * sb;
  const ty = (lx, ly) => y + lx * side * sb + ly * cb;
  for (const [dx, dy, s] of P.got) stamp(P, tx(dx * side, dy), ty(dx * side, dy), s, 0.95);
  const seg = (ax, ay, bx, by, v) => line(P, tx(ax, ay), ty(ax, ay), tx(bx, by), ty(bx, by), v);
  seg(-9, 0, 9, 0, 1);
  seg(-9, 1, 9, 1, 0.7);
  seg(-9, 0, -10, -1.5, 1);
  seg(9, 0, 9.5, -6, 0.85);
  seg(9.5, -6, 18, -11, 0.75);
}

function drawKettle(P) {
  const { light, lc, a, d, pv, cph: c, sph: s } = P;
  const R = a + d + 3;
  const steel = (x, y, r, k) => {
    if (x >= XL && x <= XR && y >= TOPC) put(P, x, y, r * k * (0.7 + lc[0] / 850), r * k * (0.7 + lc[1] / 850), (r + 12) * k * (0.7 + lc[2] / 850));
  };
  const oilTop = d - 2 - 2.6 * P.oil;
  const hot = P.phase === HEAT || P.phase === POP ? 0.55 + 0.15 * P.heat : P.phase === POUR ? 0.4 : 0.25;
  // The hanger from the motor down to the axle the kettle turns on.
  for (let y = 21; y <= PY; y++) for (let x = 31; x < 33; x++) steel(x, y, x * 50 - 1480, 1);
  // The back wall and the oil, then the kernels and puffs, then the steel
  // over them: walls, rolled rim and the heater band below.
  for (let pass = 0; pass < 2; pass++) {
    for (let y = max(TOPC, PY - R); y <= min(FLOOR - 1, PY + R); y++) {
      for (let x = max(XL, PX - R); x <= min(XR, PX + R); x++) {
        const dx = x + 0.5 - PX;
        const dy = y + 0.5 - PY;
        const u = c * dx + s * dy;
        const v = -s * dx + c * dy + pv;
        const l = 0.55 + 0.45 * light[y * W + x];
        const hw = halfW(a, d, v);
        if (pass === 0) {
          if (v < 0 || v > d - 2 || abs(u) >= hw - 2) continue;
          const gl = (0.5 + 0.5 * hot) * (0.85 + 0.15 * sin(u * 0.9 + P.t * 7));
          if (v > oilTop && P.oil > 0.02) put(P, x, y, 240 * gl, 150 * gl, 30 * gl);
          else steel(x, y, 44, l);
        } else if (v >= -1.4 && v <= 0.3 && abs(u) <= a + 0.9) steel(x, y, 170, 1.25 * l);
        else if (v > 0.3 && v <= d && abs(u) <= hw && (abs(u) >= hw - 2 || v >= d - 2)) steel(x, y, 170, (v >= d - 2 ? 0.7 : u > 0 ? 1 : 0.62) * l);
        else if (v > d && v <= d + 2.5 && abs(u) <= a * 0.38) {
          // The heater band glows while the kettle is on.
          const glow = v > d + 1.5 ? hot : 0;
          put(P, x, y, 50 * l + 200 * glow, 50 * l + 50 * glow, 56 * l + 10 * glow);
        }
      }
    }
    if (pass === 1) break;
    const shown = round(P.KN * min(1, P.kernels / (P.total + 3)));
    const jig = P.phase === HEAT ? 0.3 + P.pt * 0.2 : P.phase === POP ? 0.8 : 0;
    for (let i = 0; i < shown; i++) {
      toScreen(P, P.ku[i] + jig * sin(P.t * 23 + i * 2.1), P.kv[i] + jig * 0.5 * sin(P.t * 19 + i));
      if (P.qx >= XL + 0.5 && P.qx < XR + 0.5) put(P, round(P.qx - 0.5), round(P.qy - 0.5), 246, 190, 60);
    }
    for (let i = 0; i < P.landed; i++) {
      toScreen(P, P.su[i], P.sv[i]);
      stamp(P, P.qx - 0.5, P.qy - 0.5, P.ss[i], 1);
    }
  }
  // Lids pushed up by the corn; tipped, they fold flat.
  const cap = P.C + P.D;
  let th = clamp((P.landed - P.C * 0.75) / max(1, cap - P.C * 0.75), 0, 1) * 0.85 + 0.08 * P.rate * max(0, sin(P.t * 37));
  if (P.phase === POUR) th = 0.5;
  for (let side = -1; side <= 1 && P.phi < 0.3; side += 2)
    for (let t = 0; t <= a - 1; t += 0.5)
      for (let e = 0; e < 2; e++) {
        toScreen(P, side * (t * cos(th) + e * 0.9 * sin(th)), -1.8 + e * 0.9 - t * sin(th));
        steel(floor(P.qx), floor(P.qy), 198, e ? 0.56 : 1);
      }
  // The axle boss.
  for (let i = 0; i < 4; i++) steel(PX - 1 + (i & 1), PY - 1 + (i >> 1), [100, 200, 64, 120][i], 1);
}

export function draw(display, params) {
  const P = params;
  const { buf, lc, col } = P;
  const f = clamp(P.lamp, 0, 1) * 3;
  const li = min(2, floor(f));
  for (let c = 0; c < 3; c++) {
    lc[c] = LAMP[li][c] + (LAMP[li + 1][c] - LAMP[li][c]) * (f - li);
    // Corn is cream white with a fleck of hull, in the lamp's light.
    const tl = 0.6 + (0.4 * lc[c]) / 255;
    col[c] = [252, 246, 228][c] * tl;
    col[c + 3] = [214, 160, 84][c] * tl;
  }
  buf.set(P.cart);
  cabinet(P);
  drawHeap(P);
  drawScoop(P);
  drawKettle(P);
  for (let i = 0; i < P.nF; i++) stamp(P, P.fx[i] - 0.5, P.fy[i] - 0.5, P.fs[i], 1.05);
  for (const [fx, fy, life] of P.flash)
    for (let n = 0; n < 5; n++) {
      const a = n < 4 ? 150 + 1050 * life : 255;
      put(P, round(fx - 0.5) + ((n & 1) * 2 - 1) * (n < 2), round(fy - 0.5) + ((n & 1) * 2 - 1) * (n === 2 || n === 3), a, a, a * 0.92);
    }
  // Two streaks of reflection on the front glass.
  for (let y = 20; y < 92; y++) for (let i = 0; i < 6; i++) buf[(y * W + round(57 - (y - 20) * 0.38) + (i > 2) * 3) * 3 + (i % 3)] += i > 2 ? 12 : 20;
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    display.setPixel(p % W, (p / W) | 0, min(255, buf[o]), min(255, buf[o + 1]), min(255, buf[o + 2]));
  }
}
