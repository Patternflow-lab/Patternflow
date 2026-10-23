// ===== Patternflow pattern =====
// Title:   Warp
// Family:  space
// Idea:    A ship flies through a starfield at warp: stars stream out of a vanishing point and stretch into streaks as they rush past.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the warp and hyperspace starfields of Star Trek and Star Wars, and the 3D starfield of the demoscene
// Round:   15
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Warp=0.2..4, Stars=420..1400, Steer=-1..1
//
// Knob 1: Hue. The tint of the stars: at 0 the light ahead is shifted to ice blue and runs through violet to magenta at the edges; turning it takes the whole scale round the wheel.
// Knob 2: Warp. How fast the ship flies: at the bottom the stars drift out as points, at 2 a star crosses from the vanishing point to the edge in about a second, at the top the streaks run half the panel.
// Knob 3: Stars. How many stars fill the space ahead, from 420, where the streaks still have dark between them, to 1400, a dense blizzard.
// Knob 4: Steer. The ship banks: in the middle it flies straight, turned either way the field rolls and the streaks curl into a spiral, and the vanishing point slides towards the turn.
// Buttons: K1 tap drops the ship out of warp, lets the stars hang still for a moment and jumps back in.

const W = 64;
const H = 128;
const N = W * H;
const MAX = 1400;
// Focal length in LEDs: a star one unit off the axis at depth 1 sits F LEDs
// from the vanishing point.
const F = 34;
const ZFAR = 10;
const ZNEAR = 0.3;
// The stars fill a tube round the line of flight, RIN to ROUT units out and
// stretched 1.8 times up and down to fill the tall panel. Nothing flies
// straight at the ship, so the vanishing point itself stays dark.
const RIN = 0.8;
const ROUT = 4.5;
// How long the shutter stays open, in seconds: a streak is where the star
// has been over this long.
const EXPOSE = 0.1;

function hsvInto(out, h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

// A new star somewhere in the tube at depth z, even over its cross-section.
function place(P, i, z) {
  const r = Math.sqrt(RIN * RIN + Math.random() * (ROUT * ROUT - RIN * RIN));
  const a = Math.random() * Math.PI * 2;
  P.x[i] = r * Math.cos(a);
  P.y[i] = r * Math.sin(a) * 1.8;
  P.z[i] = z;
  const m = Math.random();
  P.b[i] = 0.35 + 0.65 * m * m;
  P.tint[i] = Math.random() - 0.5;
}

export function setup(params) {
  const P = params;
  P.x = new Float32Array(MAX);
  P.y = new Float32Array(MAX);
  P.z = new Float32Array(MAX);
  P.b = new Float32Array(MAX);
  P.tint = new Float32Array(MAX);
  for (let i = 0; i < MAX; i++) place(P, i, ZNEAR + Math.random() * (ZFAR - ZNEAR));
  P.acc = new Float32Array(N * 3);
  P.lut = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) P.lut[i] = 255 * (1 - Math.exp(-((i + 0.5) / 256) * 2.2));
  P.col = [0, 0, 0];
  P.count = 420;
  P.v = 0;
  P.roll = 0;
  P.hue = 0;
  P.vx = W / 2;
  P.vy = H / 2;
  // The jump K1 sends: seconds since the tap, or -1.
  P.jump = -1;
  P.flash = 0;
}

// How hard the ship flies after a K1 tap, against seconds since the tap: it
// drops out of warp in 0.6 s, hangs nearly still until 2.4 s, leaps in at
// three times the knob's warp and settles back by 4 s.
function jumpGain(t) {
  if (t < 0) return 1;
  if (t < 0.6) return 1 - 0.97 * Math.sin((t / 0.6) * Math.PI * 0.5);
  if (t < 2.4) return 0.03;
  if (t < 2.8) return 0.03 + 2.97 * ((t - 2.4) / 0.4) ** 2;
  if (t < 4) return 1 + 2 * (1 - (t - 2.8) / 1.2) ** 2;
  return 1;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 420, 0.06];
  dt = Math.min(dt, 0.1);
  P.hue = k[0];
  P.count = Math.max(1, Math.min(MAX, Math.round(k[2])));
  const steer = Math.max(-1, Math.min(1, k[3]));

  if (input.btnPressed && input.btnPressed[0] && P.jump < 0) P.jump = 0;
  let gain = 1;
  if (P.jump >= 0) {
    P.jump += dt;
    gain = jumpGain(P.jump);
    if (P.jump > 2.4 && P.jump < 2.6) P.flash = 1;
    if (P.jump >= 4) P.jump = -1;
  }
  P.flash = Math.max(0, P.flash - dt * 2.5);
  // Warp 2 flies 12 units of depth a second.
  P.v = Math.max(0.2, k[1]) * 6 * gain;
  // Banking rolls the field up to 2.6 radians a second, and the vanishing
  // point slides up to 10 LEDs towards the turn.
  P.roll = steer * 2.6;
  P.vx += (W / 2 + steer * 10 - P.vx) * Math.min(1, dt * 2);
  P.vy = H / 2;

  const dz = P.v * dt;
  const ca = Math.cos(P.roll * dt);
  const sa = Math.sin(P.roll * dt);
  for (let i = 0; i < P.count; i++) {
    const z = P.z[i] - dz;
    const x = P.x[i] * ca - P.y[i] * sa;
    const y = P.x[i] * sa + P.y[i] * ca;
    P.x[i] = x;
    P.y[i] = y;
    // A star that passes the ship or leaves the view comes back far ahead.
    const sx = (F * x) / Math.max(z, 1e-3);
    const sy = (F * y) / Math.max(z, 1e-3);
    if (z < ZNEAR || Math.abs(sx) > W * 0.75 + 8 || Math.abs(sy) > H * 0.75 + 8) {
      place(P, i, ZFAR - Math.random() * 2);
      continue;
    }
    P.z[i] = z;
  }
}

function add(acc, c, r, w, cr, cg, cb) {
  if (c < 0 || c >= W || r < 0 || r >= H || w <= 0) return;
  const o = (r * W + c) * 3;
  acc[o] += w * cr;
  acc[o + 1] += w * cg;
  acc[o + 2] += w * cb;
}

// A point spread over its 2x2 neighbours, so it glides between LEDs.
function splat(acc, x, y, w, cr, cg, cb) {
  const fx = x - 0.5;
  const fy = y - 0.5;
  const c = Math.floor(fx);
  const r = Math.floor(fy);
  const u = fx - c;
  const v = fy - r;
  add(acc, c, r, w * (1 - u) * (1 - v), cr, cg, cb);
  add(acc, c + 1, r, w * u * (1 - v), cr, cg, cb);
  add(acc, c, r + 1, w * (1 - u) * v, cr, cg, cb);
  add(acc, c + 1, r + 1, w * u * v, cr, cg, cb);
}

// A streak from (x0, y0) to (x1, y1), its brightness ramping from i0 to i1.
// Each LED along the long axis takes the length of the streak inside it, and
// the light is split between the two LEDs either side of the line across it.
// The streak lies on the star's own path, so the LEDs it lights only change
// at its two ends and along the ramp; nothing is counted from frame time.
function streak(acc, x0, y0, x1, y1, i0, i1, cr, cg, cb) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steep = Math.abs(dy) >= Math.abs(dx);
  let a0 = steep ? y0 : x0;
  let a1 = steep ? y1 : x1;
  let b0 = steep ? x0 : y0;
  let b1 = steep ? x1 : y1;
  let j0 = i0;
  let j1 = i1;
  if (a1 < a0) {
    let s = a0;
    a0 = a1;
    a1 = s;
    s = b0;
    b0 = b1;
    b1 = s;
    s = j0;
    j0 = j1;
    j1 = s;
  }
  const span = a1 - a0;
  if (span < 1e-4) return;
  const slope = (b1 - b0) / span;
  const stretch = Math.sqrt(1 + slope * slope);
  const lim = steep ? H : W;
  const m0 = Math.max(0, Math.floor(a0));
  const m1 = Math.min(lim - 1, Math.floor(a1));
  for (let m = m0; m <= m1; m++) {
    const lo = Math.max(a0, m);
    const hi = Math.min(a1, m + 1);
    if (hi <= lo) continue;
    const mid = (lo + hi) * 0.5;
    const t = (mid - a0) / span;
    const w = (j0 + (j1 - j0) * t) * (hi - lo) * stretch;
    const fb = b0 + slope * (mid - a0) - 0.5;
    const n = Math.floor(fb);
    const u = fb - n;
    if (steep) {
      add(acc, n, m, w * (1 - u), cr, cg, cb);
      add(acc, n + 1, m, w * u, cr, cg, cb);
    } else {
      add(acc, m, n, w * (1 - u), cr, cg, cb);
      add(acc, m, n + 1, w * u, cr, cg, cb);
    }
  }
}

export function draw(display, params) {
  const P = params;
  const acc = P.acc;
  acc.fill(0);
  const col = P.col;
  const vx = P.vx;
  const vy = P.vy;
  const back = P.v * EXPOSE;
  // The streak is drawn in pieces when the field rolls, so it curls.
  const turn = P.roll * EXPOSE;
  const pieces = Math.min(6, 3 + Math.ceil(Math.abs(turn) * 8));
  for (let i = 0; i < P.count; i++) {
    const z = P.z[i];
    const x = P.x[i];
    const y = P.y[i];
    const hx = vx + (F * x) / z;
    const hy = vy + (F * y) / z;
    // Brighter as it comes closer; a new star far off fades in.
    const near = Math.min(1.3, (2.6 / z) ** 2);
    const fade = Math.min(1, (ZFAR - z) / 4);
    const bright = P.b[i] * near * fade;
    if (bright < 0.01) continue;
    // Doppler: straight ahead the light is shifted to blue, and it runs
    // through violet to magenta 40 LEDs out; the knob turns the whole scale
    // round the wheel.
    const ox = hx - vx;
    const oy = (hy - vy) * 0.6;
    const off = Math.min(1, Math.sqrt(ox * ox + oy * oy) / 40);
    hsvInto(col, P.hue + 0.56 + 0.32 * off + 0.05 * P.tint[i], 0.62 + 0.35 * off, 1);
    // The streak: where the star was over the last EXPOSE seconds.
    let px = hx;
    let py = hy;
    let pi = bright;
    for (let s = 1; s <= pieces; s++) {
      const tau = s / pieces;
      const zt = z + back * tau;
      const a = -turn * tau;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const tx = vx + (F * (x * c - y * sn)) / zt;
      const ty = vy + (F * (x * sn + y * c)) / zt;
      const ti = bright * (1 - tau) ** 2;
      streak(acc, tx, ty, px, py, ti, pi, col[0], col[1], col[2]);
      px = tx;
      py = ty;
      pi = ti;
    }
    // The star itself, whiter than its streak.
    splat(acc, hx, hy, bright * 0.9, 0.4 + 0.6 * col[0], 0.4 + 0.6 * col[1], 0.4 + 0.6 * col[2]);
  }

  // The flash as the ship leaps back into warp.
  if (P.flash > 0) {
    const f = P.flash;
    for (let r = 0; r < H; r++)
      for (let c = 0; c < W; c++) {
        const d = Math.hypot(c + 0.5 - vx, r + 0.5 - vy);
        const g = f * 1.6 * Math.exp(-d / 9);
        const o = (r * W + c) * 3;
        acc[o] += g * 0.8;
        acc[o + 1] += g * 0.9;
        acc[o + 2] += g;
      }
  }

  // A soft shoulder instead of a hard clip where streaks pile up, read from
  // a table of 1024 steps over 0..4.
  const lut = P.lut;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const o = (r * W + c) * 3;
      display.setPixel(c, r, lut[Math.min(1023, (acc[o] * 256) | 0)], lut[Math.min(1023, (acc[o + 1] * 256) | 0)], lut[Math.min(1023, (acc[o + 2] * 256) | 0)]);
    }
  }
}
