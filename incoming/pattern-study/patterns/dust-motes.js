// ===== Patternflow pattern =====
// Title:   Dust Motes
// Family:  particle
// Idea:    A shaft of sunlight slants from a high window across a dark room to the floorboards, and the dust drifting on the slow air shows only where it crosses the shaft, glinting as each mote turns, while the curtain sways and the sun edges round.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 19, after Vilhelm Hammershøi's Dust Motes Dancing in the Sunbeams (1900)
// Round:   19
// ===============================
// @matrix 64x128
// @knobs Sun=0..1, Speed=0.2..3, Dust=1..4, Draft=-1..1
//
// Knob 1: Sun. The hour: at 0 a high late-morning sun throws a steep, pale gold shaft; turned up, the sun sinks, the shaft leans further over and turns amber.
// Knob 2: Speed. How fast the air, the curtain and the sun move: at 2 a mote wanders about a LED a second, the curtain swings every five seconds and the foot of the shaft creeps a few LEDs along the floor in ten.
// Knob 3: Dust. How much dust hangs in the room, from about 350 motes at 1 to 1300 at 4; the more dust, the brighter the haze of the shaft itself.
// Knob 4: Draft. Near still air at 0.06; turned either way, a draught carries the dust that way and the curtain swings harder, blown back to open the window wide at -1 and across most of it at 1, so the shaft narrows to a blade.
// Buttons: K1 tap sends someone walking across the room: a dark figure that cuts a shadow out of the shaft as it passes, with dust puffing up from the boards round its feet into the light.

const W = 64;
const H = 128;
const N = W * H;
const MAXM = 1300;
const PUFF = 160;
// The window: its panes, the mullions, and the floor line.
const WX0 = 6;
const WX1 = 20;
const WY0 = 5;
const WY1 = 25;
const CX = (WX0 + WX1) / 2;
const CY = (WY0 + WY1) / 2;
const FY = 112;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function spawn(P, i, x, y) {
  P.x[i] = x;
  P.y[i] = y;
  P.vx[i] = 0;
  P.vy[i] = 0;
  // Each mote turns at its own rate; a flat one flashes as it faces the sun.
  P.ph[i] = Math.random() * Math.PI * 2;
  P.spin[i] = 1.5 + Math.random() * 4;
  P.size[i] = 0.35 + Math.random() * 0.65;
  P.life[i] = -1;
}

export function setup(params) {
  const P = params;
  const M = MAXM + PUFF;
  for (const k of ["x", "y", "vx", "vy", "ph", "spin", "size", "life"]) P[k] = new Float32Array(M);
  for (let i = 0; i < MAXM; i++) spawn(P, i, Math.random() * W, Math.random() * FY);
  for (let i = MAXM; i < M; i++) P.life[i] = 0;
  P.buf = new Float32Array(N * 3);
  P.t = 0;
  P.started = false;
  P.stir = 0;
  P.walk = -1;
  P.wx = -20;
  P.wdir = 1;
  P.stride = 0;
}

// The slow air of the room: three broad eddies drifting, as a stream function
// so the air neither piles up nor empties anywhere.
function air(P, x, y, out) {
  const t = P.t;
  const a1 = 0.09 * x + 0.05 * y + 0.21 * t;
  const a2 = -0.06 * x + 0.08 * y - 0.17 * t + 2;
  const a3 = 0.13 * x - 0.11 * y + 0.13 * t + 4;
  // psi = 14 sin(a1) + 12 sin(a2) + 6 sin(a3)
  const c1 = 14 * Math.cos(a1);
  const c2 = 12 * Math.cos(a2);
  const c3 = 6 * Math.cos(a3) * (1 + P.stir * 3);
  out[0] = (c1 * 0.05 + c2 * 0.08 - c3 * 0.11) * 0.75;
  out[1] = -(c1 * 0.09 - c2 * 0.06 + c3 * 0.13) * 0.75;
}

// Someone crossing the room after a K1 tap: whether their body covers the
// point. A head, shoulders narrowing to the hips, and two striding legs.
function body(P, x, y) {
  const dx = x - P.wx;
  if (P.walk < 0 || dx < -6 || dx > 6 || y < FY - 48 || y > FY) return 0;
  const hy = FY - 44;
  if (y < hy + 3) return dx * dx + (y - hy) * (y - hy) < 10 ? 1 : 0;
  if (y < FY - 39) return Math.abs(dx) < 1.4 ? 1 : 0;
  if (y < FY - 20) return Math.abs(dx) < 4.3 - 0.05 * (y - FY + 39) ? 1 : 0;
  const sw = 3 * Math.sin(P.stride) * ((y - FY + 20) / 20);
  return Math.abs(dx - 1.5 - sw) < 1.3 || Math.abs(dx + 1.5 + sw) < 1.3 ? 1 : 0;
}

// The shaft at a point: 0 outside, about 1 at its heart. Lateral w runs across
// it, s along it from the window.
function shaft(P, x, y) {
  const rx = x - CX;
  const ry = y - CY;
  const s = rx * P.dx + ry * P.dy;
  if (s < 0) return 0;
  const w = rx * P.dy - ry * P.dx;
  const e = 1.2 + s * 0.035;
  let v = smooth(P.wL - e, P.wL + e, w) * (1 - smooth(P.wR - e, P.wR + e, w));
  if (v <= 0) return 0;
  // The mullion's shadow runs down the middle as a darker line.
  const m = (w - P.wM) / (0.8 + s * 0.02);
  v *= 1 - 0.45 * Math.exp(-m * m);
  // Someone standing in the light throws a shadow down the shaft behind them.
  if (P.walk >= 0)
    for (const o of [-3.5, 0, 3.5]) {
      const xs = P.wx + o;
      if (x <= xs) continue;
      if (body(P, xs, y - ((x - xs) * P.dy) / P.dx)) return 0;
    }
  return v * smooth(-2, 8, s);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 1, 0.06];
  dt = clamp(dt, 0, 0.1);
  const sun = clamp(k[0], 0, 1);
  const speed = clamp(k[1], 0, 3) / 2;
  P.dust = clamp(k[2], 1, 4);
  const want = Math.round(350 * Math.pow(P.dust, 0.95));
  const draft = clamp(k[3], -1, 1);
  P.sun = sun;
  P.want = Math.min(MAXM, want);
  if (!P.started) {
    P.started = true;
    P.t = 4 + 14 * speed;
  }
  const step = dt * speed;
  P.t += step;
  const t = P.t;

  // The sun: lower in the sky as Sun turns up, and wandering a little as it
  // goes round, so the foot of the shaft creeps across the floor.
  const a = 0.26 + 0.26 * sun + 0.06 * Math.sin(t * 0.16) + 0.03 * Math.sin(t * 0.43 + 1);
  P.dx = Math.sin(a);
  P.dy = Math.cos(a);
  // The curtain hangs at the right of the window and swings in the air, more
  // with a draught; what it covers casts no light.
  const swing = 0.7 + 0.5 * Math.abs(draft);
  P.curtain = clamp(4 + swing * (3.2 * Math.sin(t * 1.25) + 1.6 * Math.sin(t * 2.1 + 1)) + 5 * draft, 0, 12);
  const xr = WX1 - P.curtain;
  P.wR = (xr - CX) * P.dy - (WY0 - CY) * P.dx;
  P.wL = (WX0 - CX) * P.dy - (WY1 - CY) * P.dx;
  P.wM = -0.2 * (WY1 - WY0) * P.dx;

  if (input.btnPressed && input.btnPressed[0]) {
    P.walk = 0;
    P.wdir = Math.random() < 0.5 ? -1 : 1;
  }
  if (P.walk >= 0) {
    // Someone walks across the boards at 18 LEDs a second, and every step
    // kicks dust up from round their feet.
    P.walk += dt;
    P.wx = P.wdir > 0 ? -8 + 18 * P.walk : W + 8 - 18 * P.walk;
    P.stride = P.walk * 8;
    if (P.wx < -9 || P.wx > W + 9) P.walk = -1;
    else if (P.wx > 0 && P.wx < W) {
      let n = Math.round(60 * dt + Math.random() * 0.5);
      for (let i = MAXM; i < MAXM + PUFF && n > 0; i++) {
        if (P.life[i] > 0) continue;
        spawn(P, i, P.wx + (Math.random() - 0.5) * 8, FY - Math.random() * 3);
        P.vx[i] = P.wdir * Math.random() * 8 + (Math.random() - 0.5) * 6;
        P.vy[i] = -5 - Math.random() * 12;
        P.life[i] = 8 + Math.random() * 6;
        n--;
      }
      P.stir = 1;
    }
  }
  P.stir = Math.max(0, P.stir - dt * 0.25);

  const v = [0, 0];
  const wind = draft * 5;
  for (let i = 0; i < MAXM + PUFF; i++) {
    const puff = i >= MAXM;
    if (puff && P.life[i] <= 0) continue;
    if (!puff && i >= P.want) continue;
    air(P, P.x[i], P.y[i], v);
    // Warm air in the sun rises, and the dust in it with it.
    const lift = -1.2 * shaft(P, P.x[i], P.y[i]);
    if (puff) {
      // A kicked-up mote slows in the air and joins the drift.
      const drag = Math.exp(-dt * 1.6);
      P.vx[i] *= drag;
      P.vy[i] = P.vy[i] * drag + dt * 1.5;
      P.life[i] -= dt;
    }
    // The walker's wake drags the air along behind them.
    const wake = P.walk >= 0 && P.y[i] > FY - 50 ? P.wdir * 7 * Math.exp(-((P.x[i] - P.wx) ** 2) / 40) : 0;
    P.x[i] += (v[0] + wind + (Math.random() - 0.5) * 1.5) * step + (P.vx[i] + wake) * dt;
    P.y[i] += (v[1] + lift + 0.25 + (Math.random() - 0.5) * 1.5) * step + P.vy[i] * dt;
    P.ph[i] += P.spin[i] * step;
    if (P.x[i] < -2) P.x[i] += W + 4;
    else if (P.x[i] > W + 2) P.x[i] -= W + 4;
    if (P.y[i] < -2) P.y[i] += FY + 2;
    else if (P.y[i] > FY) {
      if (puff) P.life[i] = 0;
      else P.y[i] -= FY + 2;
    }
  }
}

function add(buf, x, y, r, g, b) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const px = x0 + i;
      const py = y0 + j;
      if (px < 0 || px >= W || py < 0 || py >= FY) continue;
      const wgt = (i ? fx : 1 - fx) * (j ? fy : 1 - fy);
      const q = (py * W + px) * 3;
      buf[q] += r * wgt;
      buf[q + 1] += g * wgt;
      buf[q + 2] += b * wgt;
    }
}

export function draw(display, params) {
  const P = params;
  if (!P.started) return;
  const buf = P.buf;
  const sun = P.sun;
  // Sunlight from pale gold to amber, and the shaft's haze a little denser
  // as the sun gets low.
  const lc = [255, 228 - 62 * sun, 172 - 100 * sun];
  const haze = (30 + 26 * P.dust) * (1 + 0.2 * sun);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = (y * W + x) * 3;
      let r;
      let g;
      let b;
      if (y >= FY) {
        // Floorboards, seen low: their joins come closer toward the back.
        const d = y - FY;
        const seam = d === 0 || d === 2 || d === 5 || d === 9 || d === 14;
        const lit = shaft(P, x + 0.5, y + 0.5);
        const pane = d === 7 ? 0.55 : 1;
        const base = seam ? 0.35 : 1;
        r = 26 * base + lit * pane * base * lc[0] * 0.78;
        g = 16 * base + lit * pane * base * lc[1] * 0.62;
        b = 10 * base + lit * pane * base * lc[2] * 0.45;
      } else {
        // The wall, dark, warmed a little by light bouncing off the floor
        // under the shaft.
        const foot = CX + (FY - CY) * (P.dx / P.dy);
        const bounce = 18 * Math.exp(-((x - foot) ** 2) / 300 - ((FY - y) ** 2) / 500);
        const fall = 1 - 0.4 * clamp((y - WY1) / 90, 0, 1);
        const s = shaft(P, x + 0.5, y + 0.5) * haze * fall;
        r = 13 + bounce + s * lc[0] / 255;
        g = 11 + bounce * 0.75 + s * lc[1] / 255;
        b = 15 + bounce * 0.5 + s * lc[2] / 255;
        if (y === FY - 1) {
          r = 20;
          g = 13;
          b = 9;
        }
      }
      buf[q] = r;
      buf[q + 1] = g;
      buf[q + 2] = b;
    }
  // The window: bright panes behind a cross of mullions, the curtain over its
  // right side glowing where the sun comes through the cloth.
  const cut = WX1 - P.curtain;
  for (let y = WY0 - 1; y <= WY1; y++)
    for (let x = WX0 - 1; x <= WX1; x++) {
      const q = (y * W + x) * 3;
      const frame = x === WX0 - 1 || x === WX1 || y === WY0 - 1 || y === WY1;
      const mull = x === Math.floor(CX) || y === Math.floor(CY);
      let r;
      let g;
      let b;
      if (frame || mull) {
        r = 44;
        g = 32;
        b = 26;
      } else {
        const glare = Math.exp(-((x - CX + 3) ** 2 + (y - CY + 4) ** 2) / 40);
        r = 210 + 45 * glare;
        g = 222 + 30 * glare - 30 * sun;
        b = 228 + 20 * glare - 70 * sun;
      }
      if (x + 0.5 > cut + 0.6 * Math.sin(y * 0.7 + P.t * 2) && !frame) {
        const fold = 0.75 + 0.25 * Math.sin(x * 1.9 + Math.sin(y * 0.3));
        r = 150 * fold;
        g = (86 - 20 * sun) * fold;
        b = 46 * fold;
      }
      buf[q] = r;
      buf[q + 1] = g;
      buf[q + 2] = b;
    }
  // The motes: each shows only in the light, brightest near the window, and
  // flashes as it turns.
  for (let i = 0; i < MAXM + PUFF; i++) {
    if (i >= MAXM ? P.life[i] <= 0 : i >= P.want) continue;
    const x = P.x[i];
    const y = P.y[i];
    const s = shaft(P, x, y);
    if (s < 0.02) continue;
    const near = 1.4 - 0.7 * clamp((y - WY1) / 80, 0, 1);
    const turn = Math.cos(P.ph[i]);
    const glint = 0.45 + 1.6 * Math.pow(turn * turn, 6);
    const fade = i >= MAXM ? clamp(P.life[i] / 3, 0, 1) : 1;
    const v = s * near * glint * P.size[i] * fade * 1.3;
    add(buf, x - 0.5, y - 0.5, lc[0] * v, lc[1] * v, lc[2] * v);
  }
  // The walker is a dark shape against the lit haze, with a thin warm rim on
  // the side the light comes from.
  if (P.walk >= 0)
    for (let y = FY - 48; y <= FY; y++)
      for (let x = Math.max(0, Math.floor(P.wx - 6)); x <= Math.min(W - 1, P.wx + 6); x++) {
        if (!body(P, x + 0.5, y + 0.5)) continue;
        const q = (y * W + x) * 3;
        const rim = body(P, x - 0.5, y - 0.5) ? 0 : 0.35 * shaft(P, x - 0.5, y - 0.5);
        buf[q] = 5 + lc[0] * rim;
        buf[q + 1] = 4 + lc[1] * rim;
        buf[q + 2] = 5 + lc[2] * rim;
      }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = (y * W + x) * 3;
      display.setPixel(x, y, knee(buf[q]), knee(buf[q + 1]), knee(buf[q + 2]));
    }
}

// Where motes pile up the light rolls off instead of clipping flat.
function knee(c) {
  if (c < 170) return c;
  return 170 + 85 * (1 - Math.exp(-(c - 170) / 85));
}
