// ===== Patternflow pattern =====
// Title:   Flock
// Family:  particle
// Idea:    Ninety birds each follow three rules about their nearest neighbours, and the shape the whole flock makes is one nobody is steering.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Scatter=-1..1, Trail=0.3..2.5
//
// Knob 1: Hue. Turns the flock's colours around the wheel; birds flying up and down sit either side of it.
// Knob 2: Speed. How fast the birds fly, and so how long their streaks are.
// Knob 3: Scatter. Below 0 the birds pack into tight schools, above 0 they lose interest in each other and drift apart like gnats.
// Knob 4: Trail. How long a streak lasts; long trails leave the flock's recent path woven across the panel.
// Buttons: K1 tap sends the unseen hawk diving into the flock.

const W = 64;
const H = 128;
const N = 90;
const V0 = 16;

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

function wrapX(x) {
  return x < 0 ? x + W : x >= W ? x - W : x;
}

function wrapY(y) {
  return y < 0 ? y + H : y >= H ? y - H : y;
}

// A soft round dot, brightest at its centre and wrapped round the edges,
// kept as the brighter of what is there and what it brings.
function splat(buf, x, y, c) {
  const x0 = Math.ceil(x - 1.2);
  const y0 = Math.ceil(y - 1.2);
  for (let yy = y0; yy <= y0 + 2; yy++) {
    const dy = yy - y;
    for (let xx = x0; xx <= x0 + 2; xx++) {
      const dx = xx - x;
      const w = 1 - (dx * dx + dy * dy) / 1.44;
      if (w <= 0) continue;
      const i = (((yy + H) % H) * W + ((xx + W) % W)) * 3;
      const r = c[0] * w;
      const g = c[1] * w;
      const b = c[2] * w;
      if (r > buf[i]) buf[i] = r;
      if (g > buf[i + 1]) buf[i + 1] = g;
      if (b > buf[i + 2]) buf[i + 2] = b;
    }
  }
}

export function setup(params) {
  params.x = new Float32Array(N);
  params.y = new Float32Array(N);
  params.vx = new Float32Array(N);
  params.vy = new Float32Array(N);
  params.lx = new Float32Array(N);
  params.ly = new Float32Array(N);
  params.wander = new Float32Array(N);
  params.pace = new Float32Array(N);
  params.tone = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    // Three loose groups heading different ways, so the first seconds already show them meeting.
    const g = i % 3;
    const a = g * 2.1 + (Math.random() - 0.5) * 0.8;
    params.x[i] = (g * 21 + 6 + Math.random() * 18) % W;
    params.y[i] = 14 + g * 38 + Math.random() * 26;
    params.vx[i] = Math.cos(a) * V0;
    params.vy[i] = Math.sin(a) * V0;
    params.lx[i] = params.x[i];
    params.ly[i] = params.y[i];
    params.pace[i] = 0.85 + Math.random() * 0.3;
    params.tone[i] = Math.random() - 0.5;
  }
  params.hx = W / 2;
  params.hy = -20;
  params.hvx = 0;
  params.hvy = V0;
  params.prey = 0;
  params.preyTime = 0;
  params.buf = new Float32Array(W * H * 3);
  params.col = new Float32Array(3);
  params.hue = 0;
}

function step(params, dt, u) {
  const { x, y, vx, vy, wander, pace } = params;
  const R = 13 - 6 * u;
  const R2 = R * R;
  const S = 3.5 + 3.5 * u;
  const S2 = S * S;
  const kA = 2.6 - 2.3 * u;
  const kC = 1.1 - 1.1 * u;
  const kS = 26 + 110 * u;
  const kW = 0.5 + 3.5 * u;

  // The hawk chases one bird for a few seconds, then picks another.
  params.preyTime -= dt;
  if (params.preyTime <= 0) {
    params.prey = Math.floor(Math.random() * N);
    params.preyTime = 3 + Math.random() * 4;
  }
  let tx = x[params.prey] - params.hx;
  let ty = y[params.prey] - params.hy;
  if (tx > W / 2) tx -= W;
  if (tx < -W / 2) tx += W;
  if (ty > H / 2) ty -= H;
  if (ty < -H / 2) ty += H;
  const td = Math.hypot(tx, ty) + 0.001;
  params.hvx += ((tx / td) * V0 * 1.15 - params.hvx) * Math.min(1, dt * 1.5);
  params.hvy += ((ty / td) * V0 * 1.15 - params.hvy) * Math.min(1, dt * 1.5);
  params.hx = wrapX(params.hx + params.hvx * dt);
  params.hy = wrapY(params.hy + params.hvy * dt);
  const hx = params.hx;
  const hy = params.hy;

  for (let i = 0; i < N; i++) {
    const xi = x[i];
    const yi = y[i];
    let n = 0;
    let cx = 0;
    let cy = 0;
    let ax = 0;
    let ay = 0;
    let sx = 0;
    let sy = 0;
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      let dx = x[j] - xi;
      let dy = y[j] - yi;
      if (dx > W / 2) dx -= W;
      else if (dx < -W / 2) dx += W;
      if (dy > H / 2) dy -= H;
      else if (dy < -H / 2) dy += H;
      const d2 = dx * dx + dy * dy;
      if (d2 > R2) continue;
      n++;
      cx += dx;
      cy += dy;
      ax += vx[j];
      ay += vy[j];
      if (d2 < S2) {
        sx -= dx / (d2 + 0.4);
        sy -= dy / (d2 + 0.4);
      }
    }
    let fx = sx * kS;
    let fy = sy * kS;
    if (n > 0) {
      fx += (ax / n - vx[i]) * kA + (cx / n) * kC;
      fy += (ay / n - vy[i]) * kA + (cy / n) * kC;
    }
    let ex = xi - hx;
    let ey = yi - hy;
    if (ex > W / 2) ex -= W;
    else if (ex < -W / 2) ex += W;
    if (ey > H / 2) ey -= H;
    else if (ey < -H / 2) ey += H;
    const ed = Math.hypot(ex, ey) + 0.001;
    if (ed < 15) {
      const push = (1 - ed / 15) * 90;
      fx += (ex / ed) * push;
      fy += (ey / ed) * push;
    }
    // Each bird's own wavering: a slow random turn left or right.
    wander[i] = wander[i] * Math.exp(-dt * 1.5) + (Math.random() - 0.5) * Math.sqrt(dt) * 2.4;
    const sp = Math.hypot(vx[i], vy[i]) + 0.001;
    fx += (-vy[i] / sp) * wander[i] * V0 * kW;
    fy += (vx[i] / sp) * wander[i] * V0 * kW;

    let nvx = vx[i] + fx * dt;
    let nvy = vy[i] + fy * dt;
    const ns = Math.hypot(nvx, nvy) + 0.001;
    const target = V0 * pace[i];
    const s = ns + (target - ns) * Math.min(1, dt * 2.5);
    nvx = (nvx / ns) * s;
    nvy = (nvy / ns) * s;
    vx[i] = nvx;
    vy[i] = nvy;
  }
  for (let i = 0; i < N; i++) {
    x[i] = wrapX(x[i] + vx[i] * dt);
    y[i] = wrapY(y[i] + vy[i] * dt);
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.3];
  params.hue = k[0];
  const speed = k[1];
  const u = (Math.max(-1, Math.min(1, k[2])) + 1) / 2;
  // Slow birds keep a longer streak, so they still read as flying.
  const trail = Math.max(0.05, k[3]) * Math.sqrt(2 / Math.max(0.1, speed));
  dt = Math.min(dt, 0.1);

  if (input.btnPressed && input.btnPressed[0]) {
    // Drop the hawk just behind a bird, already flying at it.
    const b = Math.floor(Math.random() * N);
    params.prey = b;
    params.preyTime = 4;
    params.hx = wrapX(params.x[b] - params.vx[b] * 0.5);
    params.hy = wrapY(params.y[b] - params.vy[b] * 0.5);
    params.hvx = params.vx[b] * 1.6;
    params.hvy = params.vy[b] * 1.6;
  }

  // Speed is the simulation's own clock, so the flock keeps its shape and only hurries.
  const simDt = dt * speed;
  const steps = Math.max(1, Math.ceil(simDt / 0.035));
  for (let i = 0; i < N; i++) {
    params.lx[i] = params.x[i];
    params.ly[i] = params.y[i];
  }
  for (let s = 0; s < steps; s++) step(params, simDt / steps, u);

  const buf = params.buf;
  // Mostly a slow exponential fade, with a little taken off as well so old paths reach black.
  const fade = Math.exp(-dt / trail);
  const off = dt * 12;
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i] * fade - off;
    buf[i] = v > 0 ? v : 0;
  }

  const col = params.col;
  for (let i = 0; i < N; i++) {
    const vx = params.vx[i];
    const vy = params.vy[i];
    const sp = Math.hypot(vx, vy) + 0.001;
    // Birds climbing and birds diving lean to either side of the chosen hue.
    hsvInto(col, params.hue + (vy / sp) * 0.09 + params.tone[i] * 0.04, 0.88, 0.82);
    const x0 = params.lx[i];
    const y0 = params.ly[i];
    const x1 = params.x[i];
    const y1 = params.y[i];
    const dx = x1 - x0;
    const dy = y1 - y0;
    if (Math.abs(dx) > W / 2 || Math.abs(dy) > H / 2) {
      splat(buf, x1, y1, col);
      continue;
    }
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.5));
    for (let s = 1; s <= n; s++) splat(buf, x0 + (dx * s) / n, y0 + (dy * s) / n, col);
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
  // Heads: a paler, brighter LED where each bird is now.
  const col = params.col;
  for (let i = 0; i < N; i++) {
    const vy = params.vy[i];
    const sp = Math.hypot(params.vx[i], vy) + 0.001;
    hsvInto(col, params.hue + (vy / sp) * 0.09 + params.tone[i] * 0.04, 0.35, 1);
    const px = Math.round(params.x[i]) % W;
    const py = Math.round(params.y[i]) % H;
    const j = (py * W + px) * 3;
    display.setPixel(px, py, Math.max(buf[j], col[0]), Math.max(buf[j + 1], col[1]), Math.max(buf[j + 2], col[2]));
  }
}
