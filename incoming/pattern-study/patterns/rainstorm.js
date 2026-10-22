// ===== Patternflow pattern =====
// Title:   Rainstorm
// Family:  weather
// Idea:    Rain falls the whole 128 rows into a puddle that rings where the drops land, and now and then a branching bolt splits the cloud and lights the downpour for a moment.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// Round:   2
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rain=0.2..3, Wind=-1..1, Storm=0..1
//
// Knob 1: Hue. The tint of the night, the cloud and the rain, starting from slate blue.
// Knob 2: Rain. From a drizzle of a few slow drops to a downpour.
// Knob 3: Wind. At 0 the rain falls straight; either way it slants and gusts, and the cloud runs with it.
// Knob 4: Storm. How often lightning comes, from one strike in a while to about two a second, and how low and restless the cloud hangs.
// Buttons: K1 tap strikes lightning now.

const W = 64;
const H = 128;
// The puddle's far edge. Below it is water, above it the far bank and the air.
const WATER = 112;
const DROPS = 300;
const RIPPLES = 12;
const SPLASH = 96;
const BOLT = 1600;
// Cloud texture: wraps every 128 columns, one row per panel row of the deck.
const TW = 128;
const TH = 56;

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i, 7) * (1 - u) + hash(i + 1, 7) * u;
}

// Value noise that wraps in x with the given period.
function lattice(x, y, period, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const a = hash(x0 + seed, iy) * (1 - ux) + hash(x1 + seed, iy) * ux;
  const b = hash(x0 + seed, iy + 1) * (1 - ux) + hash(x1 + seed, iy + 1) * ux;
  return a * (1 - uy) + b * uy;
}

function hsvInto(out, o, h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 ? v : k === 1 ? q : k === 2 ? p : k === 3 ? p : k === 4 ? t : v) * 255;
  out[o + 1] = (k === 0 ? t : k === 1 ? v : k === 2 ? v : k === 3 ? q : k === 4 ? p : p) * 255;
  out[o + 2] = (k === 0 ? p : k === 1 ? p : k === 2 ? t : k === 3 ? v : k === 4 ? v : q) * 255;
}

export function setup(params) {
  params.dx = new Float32Array(DROPS);
  params.dy = new Float32Array(DROPS);
  params.dz = new Float32Array(DROPS);
  params.dland = new Float32Array(DROPS);
  params.rx = new Float32Array(RIPPLES);
  params.ry = new Float32Array(RIPPLES);
  params.rage = new Float32Array(RIPPLES).fill(9);
  params.rsize = new Float32Array(RIPPLES);
  params.sx = new Float32Array(SPLASH);
  params.sy = new Float32Array(SPLASH);
  params.svx = new Float32Array(SPLASH);
  params.svy = new Float32Array(SPLASH);
  params.sfloor = new Float32Array(SPLASH);
  params.sage = new Float32Array(SPLASH).fill(9);
  params.snext = 0;
  params.bx = new Int16Array(BOLT);
  params.by = new Int16Array(BOLT);
  params.bl = new Float32Array(BOLT);
  params.bn = 0;
  params.boltX = W / 2;
  params.boltAge = 9;
  params.pulseT = new Float32Array(3);
  params.pulseA = new Float32Array(3);
  params.sheetAge = 9;
  params.sheetX = 0;
  params.buf = new Float32Array(W * H * 3);
  params.col = new Float32Array(12);
  params.t = 0;
  params.cloudA = 0;
  params.cloudB = 0;
  params.slant = 0;
  // The first strike comes a couple of seconds in, so the storm shows itself early.
  params.nextStrike = 2.3 + Math.random() * 0.5;
  params.started = false;
  params.strikes = 0;

  // Two octaves of cloud, baked once and read with a moving offset. No finer octave:
  // fine grain in a dim cloud only reads as noise.
  params.tex = new Float32Array(TW * TH);
  for (let y = 0; y < TH; y++)
    for (let x = 0; x < TW; x++) {
      const n =
        lattice(x / 16, y / 9, TW / 16, 11) * 0.7 +
        lattice(x / 8, y / 6, TW / 8, 53) * 0.3;
      params.tex[y * TW + x] = n;
    }

  // The far bank: a line of trees, two roofs and a few lit windows, all black against the flash.
  params.bank = new Int16Array(W);
  for (let x = 0; x < W; x++) {
    let top = 106 - Math.round(noise1(x * 0.22 + 3) * 5 + noise1(x * 0.7) * 2);
    if (x >= 9 && x <= 20) top = Math.min(top, 99);
    if (x >= 40 && x <= 51) top = Math.min(top, Math.round(101 - Math.max(0, 5 - Math.abs(x - 45.5))));
    params.bank[x] = top;
  }
  params.windows = new Int16Array([12, 102, 16, 102, 12, 106, 43, 105, 48, 105]);
}

function strike(params, ground) {
  params.bn = 0;
  const x0 = 10 + Math.random() * (W - 20);
  params.boltX = x0;
  const y0 = params.cloudBase - 10 - Math.random() * 6;
  // Most bolts reach the ground; some die out in the air.
  const end = ground ? WATER - 1 : 62 + Math.random() * 36;
  walk(params, x0, y0, end, (Math.random() - 0.5) * 0.5, 1, 0);
  params.boltAge = 0;
  params.pulseT[0] = 0;
  params.pulseA[0] = 1;
  params.pulseT[1] = 0.07 + Math.random() * 0.06;
  params.pulseA[1] = 0.55 + Math.random() * 0.3;
  params.pulseT[2] = 0.2 + Math.random() * 0.12;
  params.pulseA[2] = Math.random() < 0.6 ? 0.4 + Math.random() * 0.3 : 0;
}

// A jagged walk downward, forking now and then. Each branch is thinner and gives up sooner.
function walk(params, x, y, end, drift, level, depth) {
  while (y < end && params.bn < BOLT - 8) {
    const dy = 1 + Math.random() * 3;
    let nx = x + drift * dy + (Math.random() - 0.5) * 3.2;
    if (Math.random() < 0.12) nx += (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3);
    const ny = Math.min(end, y + dy);
    line(params, x, y, nx, ny, level);
    if (depth < 2 && Math.random() < (depth === 0 ? 0.15 : 0.08)) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const reach = ny + (depth === 0 ? 12 + Math.random() * 34 : 5 + Math.random() * 12);
      walk(params, nx, ny, Math.min(end, reach), side * (0.5 + Math.random() * 0.8), level * 0.55, depth + 1);
    }
    x = nx;
    y = ny;
  }
}

function line(params, x0, y0, x1, y1, level) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 1; i <= n && params.bn < BOLT; i++) {
    const u = i / n;
    params.bx[params.bn] = Math.round(x0 + (x1 - x0) * u);
    params.by[params.bn] = Math.round(y0 + (y1 - y0) * u);
    params.bl[params.bn] = level;
    params.bn++;
  }
}

function spawnDrop(params, i, anywhere) {
  // Near drops are faster, longer and brighter, and land nearer the bottom of the puddle.
  const z = Math.random();
  params.dz[i] = z;
  params.dland[i] = WATER + 1 + Math.floor(z * 14.9);
  params.dy[i] = anywhere ? Math.random() * params.dland[i] : 20 - Math.random() * 50;
  // Drops wrap round the sides, so slanted rain still fills the panel from the top.
  params.dx[i] = Math.random() * W;
}

function splash(params, x, y, z) {
  // Only a few rings at a time, mostly from the near drops: more than that and the puddle reads as noise.
  let r = -1;
  if (Math.random() < 0.25 + 0.6 * z) {
    for (let j = 0; j < params.ringLimit; j++) {
      if (params.rage[j] >= 0.5 + params.rsize[j] * 0.35) {
        r = j;
        break;
      }
    }
  }
  if (r >= 0) {
    params.rx[r] = x;
    params.ry[r] = y;
    params.rage[r] = 0;
    params.rsize[r] = 0.45 + z * 0.9;
  }
  const n = z > 0.7 ? 2 : z > 0.35 ? 1 : 0;
  for (let k = 0; k < n; k++) {
    const s = params.snext;
    params.snext = (s + 1) % SPLASH;
    params.sx[s] = x;
    params.sy[s] = y - 1;
    params.svx[s] = (Math.random() - 0.5) * 22 + params.slant * 8;
    params.svy[s] = -(14 + Math.random() * 22) * (0.6 + z * 0.6);
    params.sfloor[s] = y;
    params.sage[s] = 0;
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(dt, 0.1);
  params.t += dt;
  const t = params.t;
  params.hue = k[0] + 0.6;
  const rain = Math.max(0.05, k[1]);
  const wind = Math.max(-1, Math.min(1, k[2]));
  const storm = Math.max(0, Math.min(1, k[3]));
  params.storm = storm;
  params.cloudBase = 30 + storm * 12;

  // Gusts swing the slant a little even in still air, and a lot in a gale.
  const gust = (noise1(t * 0.45) - 0.5) * 2;
  params.slant = wind * 0.85 + gust * (0.08 + 0.28 * Math.abs(wind));
  params.cloudA += dt * (1.2 + wind * 7 + gust * 1.5) * (1 + storm);
  params.cloudB += dt * (0.5 + wind * 4) * (1 + storm * 1.6);

  const active = Math.min(DROPS, Math.round(rain * 72));
  params.ringLimit = Math.min(RIPPLES, Math.round(3 + rain * 2.5));
  params.active = active;
  if (!params.started) {
    params.started = true;
    for (let i = 0; i < DROPS; i++) spawnDrop(params, i, true);
  }
  const fall = 0.7 + 0.18 * rain;
  for (let i = 0; i < active; i++) {
    const z = params.dz[i];
    const v = (72 + 80 * z) * fall;
    params.dy[i] += v * dt;
    let x = params.dx[i] + v * params.slant * dt;
    if (x < 0) x += W;
    else if (x >= W) x -= W;
    params.dx[i] = x;
    if (params.dy[i] >= params.dland[i]) {
      splash(params, Math.round(x) % W, params.dland[i], z);
      spawnDrop(params, i, false);
    }
  }
  for (let r = 0; r < RIPPLES; r++) params.rage[r] += dt;
  for (let s = 0; s < SPLASH; s++) {
    if (params.sage[s] > 1) continue;
    params.sage[s] += dt;
    params.svy[s] += 260 * dt;
    params.sx[s] += params.svx[s] * dt;
    params.sy[s] += params.svy[s] * dt;
    if (params.sy[s] > params.sfloor[s]) params.sage[s] = 9;
  }

  // Lightning: more often with Storm, and the odd one stays in the cloud.
  params.nextStrike -= dt;
  const pressed = input.btnPressed && input.btnPressed[0];
  if (pressed || params.nextStrike <= 0) {
    strike(params, pressed || params.strikes === 0 || Math.random() < 0.8);
    params.strikes++;
    const mean = 7 * (1 - storm) * (1 - storm) + 0.55;
    params.nextStrike = mean * (0.4 + Math.random() * 1.2);
  }
  params.boltAge += dt;
  // Sheet lightning flickers inside the cloud between strikes when the storm is up.
  params.sheetAge += dt;
  if (storm > 0.3 && params.sheetAge > 0.5 && Math.random() < dt * (storm - 0.3) * 2.5) {
    params.sheetAge = 0;
    params.sheetX = Math.random() * W;
  }

  // The flash: two or three return strokes down the same channel, then an afterglow.
  let f = 0;
  const a = params.boltAge;
  for (let p = 0; p < 3; p++) {
    const d = a - params.pulseT[p];
    if (d >= 0) f += params.pulseA[p] * Math.exp(-d / 0.07);
  }
  params.flash = Math.min(1.2, f + 0.22 * Math.exp(-a / 0.35));
  // The channel stays lit between strokes, dimmer, and goes out about half a second on.
  params.boltOn = a < 0.7 ? Math.min(1, f * 1.4 + 0.6 * Math.exp(-a / 0.22)) : 0;
  const s = params.sheetAge;
  params.sheet = s < 0.4 ? Math.exp(-s / 0.08) * (0.6 + 0.4 * Math.sin(s * 60)) * 0.7 : 0;
}

export function draw(display, params, time) {
  const buf = params.buf;
  const col = params.col;
  const hue = params.hue;
  const flash = params.flash;
  const t = params.t;
  // col: 0 air, 3 cloud, 6 rain, 9 flash light.
  hsvInto(col, 0, hue, 0.55, 1);
  hsvInto(col, 3, hue + 0.02, 0.4, 1);
  hsvInto(col, 6, hue - 0.02, 0.28, 1);
  hsvInto(col, 9, hue + 0.08, 0.18, 1);
  const fr = col[9];
  const fg = col[10];
  const fb = col[11];

  // Air: darkest under the cloud, lit by the flash. The town's glow sits low, so the far bank
  // stands out against it even between flashes.
  for (let y = 0; y < WATER; y++) {
    const glow = 0.045 + 0.15 * Math.exp(-Math.max(0, 100 - y) / 9);
    const lit = flash * (0.18 + 0.2 * (1 - y / WATER));
    const o0 = y * W * 3;
    const r = col[0] * glow + fr * lit;
    const g = col[1] * glow + fg * lit;
    const b = col[2] * glow + fb * lit;
    for (let x = 0; x < W; x++) {
      const o = o0 + x * 3;
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
    }
  }
  // The far bank stays black, so the flash shows it as a silhouette.
  const bank = params.bank;
  for (let x = 0; x < W; x++) {
    for (let y = bank[x]; y < WATER; y++) {
      const o = (y * W + x) * 3;
      buf[o] = 3;
      buf[o + 1] = 3;
      buf[o + 2] = 5;
    }
  }
  const win = params.windows;
  for (let i = 0; i < win.length; i += 2) {
    const o = (win[i + 1] * W + win[i]) * 3;
    buf[o] = 240;
    buf[o + 1] = 160;
    buf[o + 2] = 60;
  }
  // Water: the sky at the horizon, mirrored and darker, with slow streaks across it.
  for (let y = WATER; y < H; y++) {
    const depth = (y - WATER) / (H - WATER);
    for (let x = 0; x < W; x++) {
      const streak = 0.88 + 0.12 * Math.sin(x * 0.17 + y * 0.6 + t * 1.3 + Math.sin(y * 0.5 + t) * 2);
      const v = (0.15 - depth * 0.08) * streak;
      const lit = flash * (0.32 - depth * 0.14) * streak;
      const o = (y * W + x) * 3;
      buf[o] = col[0] * v + fr * lit;
      buf[o + 1] = col[1] * v + fg * lit;
      buf[o + 2] = col[2] * v + fb * lit;
    }
    // The lit windows break up in the water below them.
    for (let i = 0; i < win.length; i += 2) {
      if (y - WATER > 8 || Math.sin(y * 2.1 + t * 6 + i * 1.7) < -0.2) continue;
      const wx = Math.round(win[i] + Math.sin(y * 0.7 + t * 3 + i) * 0.45);
      if (wx < 0 || wx >= W) continue;
      const o = (y * W + wx) * 3;
      // Kept bright and yellow: a dim orange reflection reads as brown.
      const k = 0.8 - (y - WATER) * 0.06;
      buf[o] = Math.max(buf[o], 240 * k);
      buf[o + 1] = Math.max(buf[o + 1], 170 * k);
      buf[o + 2] = Math.max(buf[o + 2], 70 * k);
    }
  }

  // The cloud deck. The rain is drawn in front of it, as it falls between us and the cloud.
  const tex = params.tex;
  const base = params.cloudBase;
  const storm = params.storm;
  const ca = params.cloudA;
  const cb = params.cloudB;
  const ia = Math.floor(ca);
  const fa = ca - ia;
  const ib = Math.floor(cb);
  const fbx = cb - ib;
  const bx = params.boltX;
  const sheet = params.sheet;
  const sheetX = params.sheetX;
  const bottom = Math.min(TH - 1, Math.ceil(base + 10));
  for (let y = 0; y <= bottom; y++) {
    const rowA = y * TW;
    const rowB = ((y + 23) % TH) * TW;
    // Thick at the top and thinning to a ragged hem at the cloud base.
    const thin = Math.max(0, (y - (base - 16)) / 20);
    for (let x = 0; x < W; x++) {
      const xa = ((x + ia) % TW + TW) % TW;
      const xb = ((x - ib) % TW + TW) % TW;
      const na = tex[rowA + xa] * (1 - fa) + tex[rowA + ((xa + 1) % TW)] * fa;
      const nb = tex[rowB + xb] * (1 - fbx) + tex[rowB + ((xb + 1) % TW)] * fbx;
      const n = na * 0.65 + nb * 0.35;
      // A long ramp into the cloud, so its hem shades off instead of drawing a line.
      let d = (n - 0.24 - thin * 0.6) * 2;
      if (d <= 0) continue;
      if (d > 1) d = 1;
      const dxb = (x - bx) / 20;
      const dxs = (x - sheetX) / 14;
      const light = flash * (0.35 + 0.65 / (1 + dxb * dxb)) * (0.5 + n) + sheet / (1 + dxs * dxs) * n;
      const shade = (0.1 + 0.36 * n * n + storm * 0.03) * (1 - thin * 0.4);
      const o = (y * W + x) * 3;
      buf[o] = buf[o] * (1 - d) + (col[3] * shade + fr * light * 0.8) * d;
      buf[o + 1] = buf[o + 1] * (1 - d) + (col[4] * shade + fg * light * 0.8) * d;
      buf[o + 2] = buf[o + 2] * (1 - d) + (col[5] * shade + fb * light * 0.8) * d;
    }
  }

  // Ripples: a flat ellipse for the puddle seen from the side, plotted a column at a time so
  // it stays a clean ring; the far ones are only two dots moving apart.
  const rainR = col[6];
  const rainG = col[7];
  const rainB = col[8];
  for (let r = 0; r < RIPPLES; r++) {
    const age = params.rage[r];
    const size = params.rsize[r];
    const life = 0.5 + size * 0.35;
    if (age >= life) continue;
    const rad = size * (1 + 4.5 * Math.sqrt(age / life));
    const ryr = rad * 0.38;
    const level = (0.3 + 0.32 * size) * (1 + flash * 0.6);
    const cr = rainR * level;
    const cg = rainG * level;
    const cbl = rainB * level;
    const cx = params.rx[r];
    const cy = params.ry[r];
    const x0 = Math.ceil(cx - rad);
    const x1 = Math.floor(cx + rad);
    for (let x = x0; x <= x1; x++) {
      const u = (x - cx) / rad;
      const e = ryr * Math.sqrt(Math.max(0, 1 - u * u));
      const flat = ryr < 0.75;
      // A flat ring shows only its two ends.
      if (flat && x !== x0 && x !== x1) continue;
      const xw = ((x % W) + W) % W;
      const ya = Math.round(cy - e);
      const yb = Math.round(cy + e);
      for (let y = ya; y <= yb; y += Math.max(1, yb - ya)) {
        if (y < WATER || y >= H) continue;
        const o = (y * W + xw) * 3;
        buf[o] = Math.max(buf[o], cr);
        buf[o + 1] = Math.max(buf[o + 1], cg);
        buf[o + 2] = Math.max(buf[o + 2], cbl);
      }
    }
  }

  // Rain: hard one-LED streaks, as long as a drop falls in a frame.
  const slant = params.slant;
  for (let i = 0; i < params.active; i++) {
    const z = params.dz[i];
    const hx = params.dx[i];
    const hy = params.dy[i];
    const len = 2 + z * 4.5;
    const level = (0.4 + 0.42 * z) * (1 + flash * 0.9);
    const steps = Math.ceil(len * Math.max(1, Math.abs(slant)));
    const sx = (slant * len) / steps;
    const sy = len / steps;
    for (let s = 0; s <= steps; s++) {
      let x = Math.round(hx - sx * s);
      if (x < 0) x += W;
      else if (x >= W) x -= W;
      const y = Math.round(hy - sy * s);
      if (y < 0 || y >= H) continue;
      const v = s === 0 ? Math.min(1, level + 0.2) : level;
      const o = (y * W + x) * 3;
      buf[o] = Math.max(buf[o], rainR * v);
      buf[o + 1] = Math.max(buf[o + 1], rainG * v);
      buf[o + 2] = Math.max(buf[o + 2], rainB * v);
    }
  }
  for (let s = 0; s < SPLASH; s++) {
    if (params.sage[s] > 1) continue;
    const x = Math.round(params.sx[s]);
    const y = Math.round(params.sy[s]);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const v = 0.55 * (1 + flash * 0.5);
    const o = (y * W + x) * 3;
    buf[o] = Math.max(buf[o], rainR * v);
    buf[o + 1] = Math.max(buf[o + 1], rainG * v);
    buf[o + 2] = Math.max(buf[o + 2], rainB * v);
  }

  // The bolt itself, crisp, and its broken reflection in the puddle.
  const on = params.boltOn;
  if (on > 0.02) {
    for (let i = 0; i < params.bn; i++) {
      const x = params.bx[i];
      const y = params.by[i];
      const v = Math.min(1, on * (0.45 + 0.55 * params.bl[i]));
      // White while it strikes, cooling to violet as the channel goes out.
      const br = 140 + 100 * v;
      const bgc = 120 + 120 * v;
      if (x >= 0 && x < W && y >= 0 && y < H) {
        const o = (y * W + x) * 3;
        buf[o] = Math.max(buf[o], br * v);
        buf[o + 1] = Math.max(buf[o + 1], bgc * v);
        buf[o + 2] = Math.max(buf[o + 2], 255 * v);
        // The main channel is two LEDs wide, so it reads as the trunk and the forks as twigs.
        if (params.bl[i] === 1 && x + 1 < W) {
          const q = o + 3;
          const m = v * 0.7;
          buf[q] = Math.max(buf[q], br * m);
          buf[q + 1] = Math.max(buf[q + 1], bgc * m);
          buf[q + 2] = Math.max(buf[q + 2], 255 * m);
        }
      }
      const ry = 2 * WATER - 1 - y;
      if (ry >= WATER && ry < H) {
        const rx = Math.round(x + Math.sin(ry * 1.1 + t * 9) * 0.9);
        if (rx >= 0 && rx < W) {
          const o = (ry * W + rx) * 3;
          const k = v * 0.45 * (1 - (ry - WATER) / (H - WATER));
          buf[o] = Math.max(buf[o], br * k);
          buf[o + 1] = Math.max(buf[o + 1], bgc * k);
          buf[o + 2] = Math.max(buf[o + 2], 255 * k);
        }
      }
    }
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, Math.min(255, buf[o]), Math.min(255, buf[o + 1]), Math.min(255, buf[o + 2]));
    }
  }
}
