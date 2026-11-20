// ===== Patternflow pattern =====
// Title:   Breath Figure
// Family:  dew
// Idea:    A misted window at night with coloured lights blurred behind it: drops of condensation bead up, grow and swallow their neighbours, and when one grows too heavy it breaks loose and runs down the glass, gathering the drops in its way and leaving a clear stripe through which the lights shine until the mist creeps back.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: breath figures (Lord Rayleigh, Breath Figures, Nature, 1911)
// Round:   198
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Damp=0..3, Hold=-1..1, Clear=0..1
//
// Knob 1: Hue. Turns the lights behind the glass round the wheel together, from amber, rose and teal where the knob opens.
// Knob 2: Damp. How wet the air is: how fast new drops bead and grow and how soon the mist closes a cleared stripe. At the bottom of the knob nothing grows and the glass stands still once the running drops have gone; where it opens a fresh bead would take about a quarter of a minute to grow to a runner on its own, and swallowing its neighbours makes it sooner.
// Knob 3: Hold. How big a drop grows before it lets go, from 3.6 LEDs across at the bottom, where the glass is streaked with small runners, through 6.4 where the knob opens, to 11 at the top, where fat drops hang a long time and fall rarely.
// Knob 4: Clear. How much of the light the mist lets through. Where the knob opens the misted glass is milky and the lights shine clear only through the drops and down the stripes; at the top the mist is a thin veil over them.

const W = 64;
const H = 128;
// Most drops the glass holds, and how many new beads appear each second at Damp 1 on misted glass.
const MOST = 900;
const BEAD = 90;
// How fast a bead grows at Damp 1, and how fast the mist comes back.
const GROW = 0.16;
const MIST = 0.07;
// How fast a running drop falls at most, in LEDs a second.
const FALL = 34;
// The lights behind the glass: their colours and how many there are.
const LIGHTS = [
  [0.08, 1.0],
  [0.95, 0.85],
  [0.5, 0.9],
  [0.11, 0.8],
  [0.58, 0.7],
  [0.02, 0.75],
  [0.13, 0.9],
];
// A grid of this cell size finds drops that touch.
const CELL = 8;
const GX = Math.ceil(W / CELL);
const GY = Math.ceil(H / CELL) + 1;

function hsv(h, s, v, out, o) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[o + 1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[o + 2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function setup(params) {
  params.t = 0;
  params.started = false;
  params.drops = [];
  params.mist = new Float32Array(W * H).fill(1);
  params.bg = new Float32Array(W * H * 3);
  params.col = new Float32Array(LIGHTS.length * 3);
  // Each light drifts on its own slow path.
  params.paths = LIGHTS.map(() => ({
    x: 8 + Math.random() * 48,
    y: 10 + Math.random() * 108,
    ax: 6 + Math.random() * 10,
    ay: 10 + Math.random() * 20,
    fx: 0.03 + Math.random() * 0.05,
    fy: 0.02 + Math.random() * 0.04,
    p: Math.random() * 6.28,
    size: 9 + Math.random() * 9,
  }));
  params.grid = Array.from({ length: GX * GY }, () => []);
}

function bead(params, x, y, r) {
  params.drops.push({ x, y, r, vx: 0, vy: 0, run: false });
}

function step(params, dt, damp, hold) {
  const { drops, mist } = params;
  // Beads appear where the glass is misted.
  if (drops.length < MOST) {
    let n = BEAD * damp * dt;
    while (n > 0) {
      if (Math.random() < n) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        if (mist[(y | 0) * W + (x | 0)] > 0.6) bead(params, x, y, 0.3 + 0.25 * Math.random());
      }
      n -= 1;
    }
  }
  for (const d of drops) {
    if (!d.run) {
      // Water condenses on every drop; a big drop has more surface but more to fill, so it grows more slowly in radius.
      d.r += (dt * GROW * damp) / (0.6 + d.r);
      if (d.r > hold) d.run = true;
    } else {
      d.vy = Math.min(FALL, d.vy + dt * 70);
      d.vx += (Math.random() - 0.5) * dt * 30;
      d.vx *= 0.9;
      d.x = clamp(d.x + d.vx * dt, 0, W);
      d.y += d.vy * dt;
      // It wipes a stripe of mist off where it passes, about as wide as a drop that has just let go, and now and then leaves a little drop behind.
      const r = Math.min(d.r, hold) * 0.85;
      for (let yy = Math.max(0, Math.floor(d.y - r)); yy <= Math.min(H - 1, d.y + r); yy++)
        for (let xx = Math.max(0, Math.floor(d.x - r)); xx <= Math.min(W - 1, d.x + r); xx++) {
          const dx = xx + 0.5 - d.x;
          const dy = yy + 0.5 - d.y;
          if (dx * dx + dy * dy < r * r) mist[yy * W + xx] = 0;
        }
      if (Math.random() < dt * (d.r > hold * 1.3 ? 14 : 5) && d.r > 1.4) {
        const left = 0.35 + 0.3 * Math.random();
        d.r = Math.cbrt(d.r * d.r * d.r - left * left * left);
        bead(params, d.x + (Math.random() - 0.5) * d.r, d.y - d.r * 1.2, left);
      }
    }
  }
  // The mist creeps back.
  const back = dt * MIST * damp;
  for (let i = 0; i < mist.length; i++) mist[i] += (1 - mist[i]) * back;

  // Drops that touch become one, keeping the water of both, at the middle of their weight.
  const grid = params.grid;
  for (const c of grid) c.length = 0;
  for (const d of drops) {
    const gx = clamp(Math.floor(d.x / CELL), 0, GX - 1);
    const gy = clamp(Math.floor(d.y / CELL), 0, GY - 1);
    grid[gy * GX + gx].push(d);
  }
  for (const d of drops) {
    if (d.gone) continue;
    const gx = clamp(Math.floor(d.x / CELL), 0, GX - 1);
    const gy = clamp(Math.floor(d.y / CELL), 0, GY - 1);
    for (let oy = -1; oy <= 1; oy++) {
      const cy = gy + oy;
      if (cy < 0 || cy >= GY) continue;
      for (let ox = -1; ox <= 1; ox++) {
        const cx = gx + ox;
        if (cx < 0 || cx >= GX) continue;
        for (const e of grid[cy * GX + cx]) {
          if (e === d || e.gone || d.gone) continue;
          const dx = e.x - d.x;
          const dy = e.y - d.y;
          const reach = (d.r + e.r) * 0.92;
          if (dx * dx + dy * dy > reach * reach) continue;
          const big = d.r >= e.r ? d : e;
          const small = big === d ? e : d;
          const vb = big.r * big.r * big.r;
          const vs = small.r * small.r * small.r;
          big.x = (big.x * vb + small.x * vs) / (vb + vs);
          big.y = (big.y * vb + small.y * vs) / (vb + vs);
          big.r = Math.cbrt(vb + vs);
          big.run = big.run || small.run || big.r > hold;
          big.vy = Math.max(big.vy, small.vy * 0.5);
          small.gone = true;
        }
      }
    }
  }
  params.drops = drops.filter((d) => !d.gone && d.y - d.r < H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const damp = clamp(k[1], 0, 3);
  const u = clamp(k[2], -1, 1);
  const hold = u < 0 ? 3.2 + 1.4 * u : 3.2 + 2.3 * u;
  params.veil = 0.97 - 0.62 * clamp(k[3], 0, 1);
  params.hue = k[0];
  // The glass has been misting up for a minute when the panel opens.
  if (!params.started) {
    params.started = true;
    for (let i = 0; i < 300; i++) step(params, 0.2, Math.max(damp, 1), hold);
  }
  params.t += dt;
  step(params, dt, damp, hold);
}

export function draw(display, params) {
  const { bg, mist, col, paths, veil } = params;
  const t = params.t;
  for (let i = 0; i < LIGHTS.length; i++) hsv(LIGHTS[i][0] + params.hue, 0.75, LIGHTS[i][1], col, i * 3);
  // The lights behind the glass, already out of focus.
  for (let y = 0, j = 0; y < H; y++) {
    for (let x = 0; x < W; x++, j += 3) {
      let r = 0.02;
      let g = 0.015;
      let b = 0.05;
      for (let i = 0; i < paths.length; i++) {
        const p = paths[i];
        const lx = p.x + p.ax * Math.sin(p.fx * t + p.p);
        const ly = p.y + p.ay * Math.sin(p.fy * t + p.p * 1.7);
        const dx = x - lx;
        const dy = y - ly;
        const w = Math.exp(-(dx * dx + dy * dy) / (p.size * p.size));
        r += col[i * 3] * w;
        g += col[i * 3 + 1] * w;
        b += col[i * 3 + 2] * w;
      }
      bg[j] = Math.min(1, r);
      bg[j + 1] = Math.min(1, g);
      bg[j + 2] = Math.min(1, b);
    }
  }
  const px = new Float32Array(W * H * 3);
  // Misted glass dims the lights and lays a pale veil over them.
  for (let i = 0, j = 0; i < W * H; i++, j += 3) {
    const m = mist[i] * veil;
    const lum = 0.3 * bg[j] + 0.55 * bg[j + 1] + 0.15 * bg[j + 2];
    const haze = 0.025 + 0.26 * lum;
    px[j] = bg[j] * (1 - m) + (bg[j] * 0.14 + haze) * m;
    px[j + 1] = bg[j + 1] * (1 - m) + (bg[j + 1] * 0.14 + haze) * m;
    px[j + 2] = bg[j + 2] * (1 - m) + (bg[j + 2] * 0.14 + haze * 1.1) * m;
  }
  // Each drop is a small lens: clear, a little brighter than the glass, with a dark rim and a glint at its upper left.
  for (const d of params.drops) {
    if (d.r < 0.45) continue;
    const r = d.r;
    for (let y = Math.max(0, Math.floor(d.y - r - 1)); y <= Math.min(H - 1, Math.floor(d.y + r + 1)); y++) {
      for (let x = Math.max(0, Math.floor(d.x - r - 1)); x <= Math.min(W - 1, Math.floor(d.x + r + 1)); x++) {
        const dx = x + 0.5 - d.x;
        const dy = y + 0.5 - d.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const cover = clamp(r + 0.5 - dist, 0, 1);
        if (cover <= 0) continue;
        // The lens shows the lights behind it upside down.
        const sx = clamp(Math.round(d.x - dx * 0.8), 0, W - 1);
        const sy = clamp(Math.round(d.y - dy * 0.8), 0, H - 1);
        const s = (sy * W + sx) * 3;
        const e = dist / Math.max(r, 0.5);
        let k = 1.35 * (e > 0.6 ? 1 - 0.7 * clamp((e - 0.6) / 0.4, 0, 1) : 1);
        let glint = 0;
        if (r >= 1.1) {
          const gx = dx + r * 0.38;
          const gy = dy + r * 0.42;
          if (gx * gx + gy * gy < Math.max(0.5, r * 0.28) ** 2) glint = 0.55;
        } else k *= 0.5 + 0.5 * r;
        const j = (y * W + x) * 3;
        const lift = r >= 1.1 ? 0.04 : 0;
        for (let c = 0; c < 3; c++) px[j + c] += (Math.min(1, bg[s + c] * k + lift + glint) - px[j + c]) * cover;
      }
    }
  }
  for (let y = 0, j = 0; y < H; y++)
    for (let x = 0; x < W; x++, j += 3) display.setPixel(x, y, clamp(px[j] * 255, 0, 255), clamp(px[j + 1] * 255, 0, 255), clamp(px[j + 2] * 255, 0, 255));
}
