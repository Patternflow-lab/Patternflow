// ===== Patternflow pattern =====
// Title:   Sparks
// Family:  particle
// Idea:    Each spark's colour is a clock counting down from white heat, so a whole shell shows its own age at a glance.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 128x64
// @knobs Spread=0..1, Rate=0.6..5, Gravity=-1..1, Trail=0.3..1.8
//
// Knob 1: Spread. At 0 every shell is the same colour, slowly turning over the minutes; higher spreads the shells round the wheel, and past halfway each shell carries a second colour.
// Knob 2: Rate. How often a rocket goes up; the beat stays loose, with doubles and the odd rest.
// Knob 3: Gravity. At 0 the sparks hang where the drag stops them; above 0 they droop like willows, below 0 they rise like embers.
// Knob 4: Trail. Seconds a spark's streak takes to fade.
// Buttons: K1 tap fires a shell straight away.

const W = 128;
const H = 64;
const P = 900;
const R = 8;

function hsvInto(out, h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = (k === 0 ? v : k === 1 ? q : k === 2 ? p : k === 3 ? p : k === 4 ? t : v) * 255;
  out[1] = (k === 0 ? t : k === 1 ? v : k === 2 ? v : k === 3 ? q : k === 4 ? p : p) * 255;
  out[2] = (k === 0 ? p : k === 1 ? p : k === 2 ? t : k === 3 ? v : k === 4 ? v : q) * 255;
}

// A cheap repeatable 0..1 from two integers, for the glitter.
function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function splat(buf, x, y, c) {
  const x0 = Math.ceil(x - 1.2);
  const y0 = Math.ceil(y - 1.2);
  for (let yy = y0; yy <= y0 + 2; yy++) {
    if (yy < 0 || yy >= H) continue;
    const dy = yy - y;
    for (let xx = x0; xx <= x0 + 2; xx++) {
      if (xx < 0 || xx >= W) continue;
      const dx = xx - x;
      const w = 1 - (dx * dx + dy * dy) / 1.44;
      if (w <= 0) continue;
      const i = (yy * W + xx) * 3;
      // The brighter spark takes the LED whole, so a fading white flash never greys a coloured one.
      if ((c[0] + c[1] + c[2]) * w > buf[i] + buf[i + 1] + buf[i + 2]) {
        buf[i] = c[0] * w;
        buf[i + 1] = c[1] * w;
        buf[i + 2] = c[2] * w;
      }
    }
  }
}

function line(buf, x0, y0, x1, y1, c) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const m = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.6));
  for (let j = 1; j <= m; j++) splat(buf, x0 + (dx * j) / m, y0 + (dy * j) / m, c);
}

export function setup(params) {
  params.x = new Float32Array(P);
  params.y = new Float32Array(P);
  params.vx = new Float32Array(P);
  params.vy = new Float32Array(P);
  params.age = new Float32Array(P);
  params.life = new Float32Array(P);
  params.hue = new Float32Array(P);
  params.drag = new Float32Array(P);
  params.glitter = new Uint8Array(P);
  params.next = 0;
  // Rockets on their way up: launch x, target, time in flight, flight time, last position.
  params.rx = new Float32Array(R);
  params.rtx = new Float32Array(R);
  params.rty = new Float32Array(R);
  params.rt = new Float32Array(R);
  params.rf = new Float32Array(R);
  params.rpx = new Float32Array(R);
  params.rpy = new Float32Array(R);
  params.rOn = new Uint8Array(R);
  params.buf = new Float32Array(W * H * 3);
  params.col = new Float32Array(3);
  params.t = 0;
  params.beat = 0.15;
  params.spread = 0;
  params.gravity = 0;
}

function emit(params, x, y, vx, vy, life, hue, drag, glitter) {
  const i = params.next;
  params.next = (i + 1) % P;
  params.x[i] = x;
  params.y[i] = y;
  params.vx[i] = vx;
  params.vy[i] = vy;
  params.age[i] = 0;
  params.life[i] = life;
  params.hue[i] = hue;
  params.drag[i] = drag;
  params.glitter[i] = glitter;
}

function launch(params, late) {
  let r = 0;
  while (r < R && params.rOn[r]) r++;
  if (r === R) return;
  // Shells that will fall burst high, shells that will rise burst low.
  const top = 12 + Math.max(0, -params.gravity) * 18;
  params.rtx[r] = 18 + Math.random() * 92;
  params.rty[r] = top + Math.random() * 20;
  params.rx[r] = params.rtx[r] + (Math.random() - 0.5) * 12;
  params.rt[r] = 0;
  params.rf[r] = 0.45 + Math.random() * 0.3 + late;
  params.rpx[r] = params.rx[r];
  params.rpy[r] = H + 1;
  params.rOn[r] = 1;
}

function burst(params, x, y) {
  const spread = params.spread;
  // At spread 0 one colour drifts round the wheel over three minutes.
  const base = 0.08 + params.t * 0.0055;
  const hue = base + (Math.random() - 0.5) * spread;
  // Past halfway a shell carries a second colour as well.
  const second = hue + 0.22 + Math.random() * 0.2;
  const mix = Math.max(0, spread - 0.4) * 0.8;
  const kind = Math.random();
  const size = 0.6 + Math.random() * 0.5;
  const glitter = Math.random() < 0.5 ? 1 : 0;
  if (kind < 0.22) {
    // Ring: one even hoop, tipped so it reads as seen at an angle.
    const n = 52;
    const tilt = 0.4 + Math.random() * 0.6;
    const r0 = Math.random() * Math.PI * 2;
    const v = 78 * size;
    for (let i = 0; i < n; i++) {
      const a = r0 + (i / n) * Math.PI * 2;
      const h = Math.random() < mix ? second : hue;
      emit(params, x, y, Math.cos(a) * v, Math.sin(a) * v * tilt, 1.4 + Math.random() * 0.3, h, 2.8, glitter);
    }
  } else if (kind < 0.4) {
    // Willow: slower sparks that live long and hang.
    const n = 64;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const c = Math.random() * 2 - 1;
      const v = 60 * size * Math.sqrt(1 - c * c) * (0.9 + 0.1 * Math.random());
      const h = Math.random() < mix ? second : hue;
      emit(params, x, y, Math.cos(a) * v, Math.sin(a) * v, 2.6 + Math.random() * 0.8, h, 2.4, 1);
    }
  } else {
    // Peony: a sphere of sparks seen flat, so they crowd towards its rim.
    const n = 80 + Math.floor(Math.random() * 24);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const c = Math.random() * 2 - 1;
      const v = 82 * size * Math.sqrt(1 - c * c) * (0.9 + 0.1 * Math.random());
      const h = Math.random() < mix ? second : hue;
      emit(params, x, y, Math.cos(a) * v, Math.sin(a) * v, 1.3 + Math.random() * 0.6, h, 2.8, glitter);
    }
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.3];
  params.spread = Math.max(0, Math.min(1, k[0]));
  const rate = 0.25 + k[1] * 0.5;
  params.gravity = Math.max(-1, Math.min(1, k[2]));
  const trail = Math.max(0.05, k[3]);
  dt = Math.min(dt, 0.1);
  params.t += dt;

  // The beat: mostly one rocket a beat, sometimes a quick second, now and then a rest.
  params.beat -= dt;
  if (params.beat <= 0) {
    const r = Math.random();
    if (r < 0.1 && rate > 0.8) {
      params.beat = 0.6 / rate;
    } else {
      launch(params, 0);
      if (r > 0.8) launch(params, 0.12 + Math.random() * 0.18);
      params.beat = (0.75 + Math.random() * 0.5) / rate;
    }
  }
  if (input.btnPressed && input.btnPressed[0]) burst(params, 20 + Math.random() * 88, 16 + Math.random() * 26);

  const buf = params.buf;
  const fade = Math.exp(-dt / trail);
  for (let i = 0; i < buf.length; i++) buf[i] *= fade;

  const col = params.col;
  hsvInto(col, 0.09, 0.5, 0.5);
  for (let r = 0; r < R; r++) {
    if (!params.rOn[r]) continue;
    params.rt[r] += dt;
    const u = Math.min(1, params.rt[r] / params.rf[r]);
    // Eases out as it climbs, the way a rocket slows near the top.
    const e = 1 - (1 - u) * (1 - u);
    const nx = params.rx[r] + (params.rtx[r] - params.rx[r]) * e;
    const ny = H + 1 + (params.rty[r] - H - 1) * e;
    line(buf, params.rpx[r], params.rpy[r], nx, ny, col);
    params.rpx[r] = nx;
    params.rpy[r] = ny;
    if (u >= 1) {
      params.rOn[r] = 0;
      burst(params, nx, ny);
    }
  }

  const g = params.gravity * 44;
  const tick = Math.floor(params.t * 24);
  const { x, y, vx, vy, age, life, hue, drag, glitter } = params;
  for (let i = 0; i < P; i++) {
    if (age[i] >= life[i]) continue;
    age[i] += dt;
    const ox = x[i];
    const oy = y[i];
    const f = Math.exp(-drag[i] * dt);
    vx[i] *= f;
    vy[i] = vy[i] * f + g * dt;
    x[i] += vx[i] * dt;
    y[i] += vy[i] * dt;
    if (age[i] >= life[i]) continue;
    const T = 1 - age[i] / life[i];
    // White for the first frames, in the shell's full colour a seventh of a second later.
    let s = 0.95 * Math.min(1, (age[i] + 0.01) / 0.14);
    let v = Math.min(1, T * 1.8);
    if (glitter[i] && T < 0.5) {
      const h = hash(i, tick);
      if (h < 0.12) {
        s *= 0.5;
        v = 1;
      } else v *= h < 0.55 ? 0.3 : 0.8;
    }
    if (v < 0.04) continue;
    hsvInto(col, hue[i] - (1 - T) * 0.04, s, v);
    line(buf, ox, oy, x[i], y[i], col);
  }
}

export function draw(display, params, time) {
  const buf = params.buf;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(x, y, buf[i], buf[i + 1], buf[i + 2]);
    }
  }
}
