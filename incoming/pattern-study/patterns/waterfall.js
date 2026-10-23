// ===== Patternflow pattern =====
// Title:   Waterfall
// Family:  weather
// Idea:    A river goes over a cliff and falls the whole height of the panel into a plunge pool, glassy where it leaves the lip and white by the time it lands, with spray and mist rising off the pool.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 12
// Round:   14
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Wind=-1..1, Spate=0..1
//
// Knob 1: Hue. The colour of the water, the pool and the mist, starting from glacier turquoise; about halfway round it runs red, like Blood Falls in Antarctica.
// Knob 2: Speed. How fast the world runs: at 2 the water takes 1.6 seconds from the lip to the pool, at the top about 1.1, at the bottom 16, in slow motion.
// Knob 3: Wind. At 0 the water falls straight; turned either way the wind bends the curtain more the further it has fallen and carries the mist off that way, and near the ends a gale catches the water before it lands and blows it back up as spray, as Kinder Downfall does in a westerly.
// Knob 4: Spate. How much water the river brings: from a dry-season fall that breaks into threads to a flood nearly as wide as the panel, with spray and mist to match.
// Buttons: K1 tap sends a log over the lip; it tumbles down, goes under in the pool and comes up drifting away. One also comes by itself now and then.

const W = 64;
const H = 128;
// The lip the river goes over, the far edge of the pool, and the row where the water lands.
const LIP = 21;
const POOL = 110;
const HIT = 115;
// Free fall in panel units: rows per second squared, and the speed water leaves the lip at.
// 94 rows take 1.6 seconds at Speed 2.
const G = 59;
const V0 = 10;
const SPRAY = 220;
// The value-noise lattice wraps every 256 cells.
const LAT = 256;
// exp(-z) for z from 0 to 8 in steps of 1/32, for the mist's bell curve.
const EXP = new Float32Array(257);
for (let i = 0; i <= 256; i++) EXP[i] = Math.exp(-i / 32);

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vn(lat, x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const x0 = ix & 255;
  const x1 = (ix + 1) & 255;
  const y0 = (iy & 255) << 8;
  const y1 = ((iy + 1) & 255) << 8;
  const a = lat[y0 + x0] + (lat[y0 + x1] - lat[y0 + x0]) * ux;
  const b = lat[y1 + x0] + (lat[y1 + x1] - lat[y1 + x0]) * ux;
  return a + (b - a) * uy;
}

function hsv(h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  return [
    (k === 0 ? v : k === 1 ? q : k === 2 ? p : k === 3 ? p : k === 4 ? t : v) * 255,
    (k === 0 ? t : k === 1 ? v : k === 2 ? v : k === 3 ? q : k === 4 ? p : p) * 255,
    (k === 0 ? p : k === 1 ? p : k === 2 ? t : k === 3 ? v : k === 4 ? v : q) * 255,
  ];
}

function put(buf, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] = r;
  buf[o + 1] = g;
  buf[o + 2] = b;
}

// The fall's centre column at the lip.
const CX = 30;

export function setup(params) {
  const lat = new Float32Array(LAT * LAT);
  for (let i = 0; i < lat.length; i++) lat[i] = Math.random();
  params.lat = lat;
  params.bg = new Float32Array(W * H * 3);
  params.buf = new Float32Array(W * H * 3);
  // Boulders in front of the pool: their colour, and 1 where they stand.
  params.front = new Float32Array(W * H * 3);
  params.frontA = new Float32Array(W * H);
  params.px = new Float32Array(SPRAY);
  params.py = new Float32Array(SPRAY);
  params.pvx = new Float32Array(SPRAY);
  params.pvy = new Float32Array(SPRAY);
  params.pfloor = new Float32Array(SPRAY);
  params.pgrav = new Float32Array(SPRAY);
  params.page = new Float32Array(SPRAY).fill(9);
  params.pnext = 0;
  params.ts = 0;
  params.started = false;
  params.spawnDebt = 0;
  params.galeDebt = 0;
  params.log = { on: false, t0: 0, x: 0, y: 0, ang: 0, spin: 0, phase: 0, age: 0, drift: 0 };
  // The first log comes early so the fall shows what it does; then one in a while.
  params.nextLog = 2.4;
  params.pal = new Float32Array(9 * 4 * 3);
  params.dens = new Float32Array(W * H);
  bakeScene(params);
}

function bakeScene(params) {
  const bg = params.bg;
  const lat = params.lat;
  // Sky: pale at the top of the gorge, a little deeper towards the far ridge.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = hsv(0.58, 0.28 + y * 0.006, 0.78 - y * 0.012);
      const o = (y * W + x) * 3;
      bg[o] = c[0];
      bg[o + 1] = c[1];
      bg[o + 2] = c[2];
    }
  // The far ridge, blue with distance.
  for (let x = 0; x < W; x++) {
    const top = Math.round(9 + 3 * vn(lat, x / 9, 3.5) + 1.5 * vn(lat, x / 3.5, 9.5));
    for (let y = top; y < LIP; y++) {
      const c = hsv(0.5, 0.45, 0.3 + 0.04 * vn(lat, x / 2, y / 2));
      put(bg, x, y, c[0], c[1], c[2]);
    }
  }
  // The near banks of the river, grass running back to the ridge. The river itself is drawn
  // every frame, as wide as Spate makes it.
  for (let x = 0; x < W; x++)
    for (let y = 13; y < LIP; y++) {
      const g = 0.13 + 0.015 * (y - 13) + 0.09 * vn(lat, x / 2, y / 1.2 + 40);
      const c = hsv(0.28, 0.68, g);
      put(bg, x, y, c[0], c[1], c[2]);
    }

  // The cliff: beds of rock laid flat, each its own shade, lit on the top and undercut below.
  const edges = [LIP];
  while (edges[edges.length - 1] < H + 12) edges.push(edges[edges.length - 1] + 5 + Math.floor(Math.random() * 8));
  const bedV = edges.map(() => 0.12 + Math.random() * 0.09);
  const bedH = edges.map(() => (Math.random() < 0.6 ? 0.07 : 0.58));
  const bedS = edges.map((_, i) => (bedH[i] < 0.3 ? 0.3 : 0.14));
  for (let y = LIP; y < H; y++)
    for (let x = 0; x < W; x++) {
      const yy = y + 2.5 * Math.sin(x * 0.07 + 0.5) + 5 * (vn(lat, x / 11, 3.3 + y / 40) - 0.5);
      let b = 0;
      while (b < edges.length - 2 && yy >= edges[b + 1]) b++;
      const thick = edges[b + 1] - edges[b];
      const frac = (yy - edges[b]) / thick;
      let v = bedV[b] + (vn(lat, x / 2.5 + b * 17, y / 2.5) - 0.5) * 0.07;
      if (frac < 0.18) v += 0.06;
      else if (frac > 0.8) v -= 0.07;
      // Joints: a dark crack here and there through a bed.
      if (hash(x * 7 + b, 91) < 0.012 && frac > 0.2 && frac < 0.8) v *= 0.55;
      // The gorge is lit from above: higher beds catch more sky.
      v *= 1.25 - 0.45 * (y - LIP) / (H - LIP);
      let c = hsv(bedH[b], bedS[b], Math.max(0.05, v));
      // Moss on the tops of the beds, thicker low down where the spray reaches.
      const wet = Math.max(0, (y - 40) / 80);
      if (frac < 0.35 && vn(lat, x / 4 + b * 5, y / 2.5 + 80) > 0.68 - wet * 0.22) c = hsv(0.27, 0.7, 0.2 + 0.12 * vn(lat, x / 1.7, y / 1.7 + 120));
      // The lip overhangs a little, so the rock just under it is in shadow.
      const under = y - LIP < 3 ? 0.5 + 0.17 * (y - LIP) : 1;
      put(bg, x, y, c[0] * under, c[1] * under, c[2] * under);
    }

  // Trees lean over the top of the gorge from both sides.
  const crowns = [
    [3, 4, 9],
    [12, -1, 7],
    [-2, 19, 8],
    [8, 14, 6],
    [57, 3, 8],
    [49, 0, 6],
    [64, 17, 9],
    [55, 13, 6],
  ];
  for (const [cx, cy, r] of crowns)
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const dx = x - cx;
        const dy = (y - cy) * 1.1;
        const d = Math.sqrt(dx * dx + dy * dy) / r;
        if (d > 0.82 + 0.3 * vn(lat, x / 2, y / 2 + 160)) continue;
        // Lit from above: the upper leaves are lighter.
        const leaf = vn(lat, x / 1.6 + 30, y / 1.6 + 30);
        const v = 0.17 + 0.16 * leaf + 0.08 * Math.max(0, -dy / r);
        const c = hsv(0.29 - 0.04 * leaf, 0.72, v);
        put(bg, x, y, c[0], c[1], c[2]);
      }

  // Boulders round the pool, in front of the water.
  const front = params.front;
  const fa = params.frontA;
  const stones = [
    [4, 124, 11, 9],
    [16, 128, 7, 5],
    [59, 125, 10, 8],
    [47, 129, 6, 5],
  ];
  for (const [cx, cy, rx, ry] of stones)
    for (let y = Math.floor(cy - ry); y < H; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        if (x < 0 || x >= W || y < 0) continue;
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d > 1 + 0.25 * (vn(lat, x / 2, y / 2 + 200) - 0.5)) continue;
        const top = -dy;
        let v = 0.12 + 0.12 * Math.max(0, top) + 0.05 * vn(lat, x / 1.8, y / 1.8 + 220);
        let c = hsv(0.08, 0.22, v);
        // Moss on the tops, and the waterline dark and wet.
        if (top > 0.45 && vn(lat, x / 2.5, y / 2.5 + 240) > 0.45) c = hsv(0.27, 0.7, 0.22 + 0.1 * top);
        if (y > cy + ry * 0.55) {
          v *= 0.6;
          c = hsv(0.55, 0.3, v);
        }
        const o = (y * W + x) * 3;
        front[o] = c[0];
        front[o + 1] = c[1];
        front[o + 2] = c[2];
        fa[y * W + x] = 1;
      }
}

function spawnSpray(params, x, y, vx, vy, grav, floor) {
  const s = params.pnext;
  params.pnext = (s + 1) % SPRAY;
  params.px[s] = x;
  params.py[s] = y;
  params.pvx[s] = vx;
  params.pvy[s] = vy;
  params.pgrav[s] = grav;
  params.pfloor[s] = floor;
  params.page[s] = 0;
}

function stepSpray(params, dts) {
  for (let i = 0; i < SPRAY; i++) {
    if (params.page[i] > 3) continue;
    params.page[i] += dts;
    params.pvy[i] += G * params.pgrav[i] * dts;
    params.px[i] += params.pvx[i] * dts;
    params.py[i] += params.pvy[i] * dts;
    if (params.py[i] > params.pfloor[i] && params.pvy[i] > 0) params.page[i] = 9;
  }
}

// Time for the water to fall d rows from the lip, in world seconds.
function flight(d) {
  return (-V0 + Math.sqrt(V0 * V0 + 2 * G * d)) / G;
}

// How much wider the water is d rows below the lip.
function spreadAt(d) {
  const f = d / 94;
  return 1 + 0.35 * f + 0.35 * f * f * f;
}

// How far the wind has carried water that left the lip at u and has been falling tau seconds.
function blown(params, u, tau) {
  const gust = 1 + 0.9 * (vn(params.lat, u * 0.7, 333.3) - 0.5);
  return 0.5 * params.wind * 24 * gust * tau * tau;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(dt, 0.1);
  const speed = Math.max(0.05, k[1]);
  const dts = (dt * speed) / 2;
  params.ts += dts;
  const ts = params.ts;
  params.hue = k[0] + 0.48;
  const wind = Math.max(-1, Math.min(1, k[2]));
  const spate = Math.max(0, Math.min(1, k[3]));
  params.wind = wind;
  params.spate = spate;
  // Past about half way the wind is a gale and starts tearing the curtain apart.
  const gale = Math.max(0, Math.min(1, (Math.abs(wind) - 0.5) / 0.45));
  params.gale = gale;
  params.breakAt = 94 * (1 - 0.72 * gale);
  params.half0 = 6.5 + 14.5 * Math.pow(spate, 0.6);
  params.hEnd = params.half0 * spreadAt(HIT - LIP);
  // Columns break into separate threads when the river is low.
  const low = Math.max(0, 1 - spate / 0.3);
  params.gap = 0.75 * low * low;
  params.hitX = CX + blown(params, ts - flight(HIT - LIP), flight(HIT - LIP));

  const rate = (70 + 200 * spate) * (1 - 0.7 * gale);
  if (!params.started) {
    params.started = true;
    // Two seconds of spray, so the pool opens already throwing it.
    for (let n = 0; n < 60; n++) {
      spray(params, rate, 1 / 30);
      stepSpray(params, 1 / 30);
    }
  }
  spray(params, rate, dts);
  stepSpray(params, dts);

  const log = params.log;
  params.nextLog -= dts;
  const pressed = input.btnPressed && input.btnPressed[0];
  if ((pressed || params.nextLog <= 0) && !(log.on && log.phase === 0)) {
    log.on = true;
    log.phase = 0;
    log.t0 = ts;
    log.ang = Math.random() * Math.PI;
    log.spin = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 2.5);
    log.off = (Math.random() - 0.5) * params.half0;
    params.nextLog = 20 + Math.random() * 25;
  }
  if (log.on) stepLog(params, log, dts);
}

function spray(params, rate, dts) {
  const wind = params.wind;
  params.spawnDebt += rate * dts;
  while (params.spawnDebt >= 1) {
    params.spawnDebt -= 1;
    const x = params.hitX + (Math.random() - 0.5) * 1.8 * params.hEnd;
    spawnSpray(params, x, HIT - 1, (Math.random() - 0.5) * (40 + 30 * params.spate) + wind * 25, -(12 + Math.random() * 40), 1.6, HIT + 1);
  }
  // In a gale the torn curtain goes up and away downwind as spray.
  const gale = params.gale;
  if (gale > 0) {
    params.galeDebt += gale * (90 + 120 * params.spate) * dts;
    while (params.galeDebt >= 1) {
      params.galeDebt -= 1;
      const d = params.breakAt + Math.random() * (HIT - LIP - params.breakAt);
      const tau = flight(d);
      const x = CX + blown(params, params.ts - tau, tau) + (Math.random() - 0.5) * 2 * params.half0 * spreadAt(d);
      spawnSpray(params, x, LIP + d, wind * (35 + Math.random() * 45), -(8 + Math.random() * 30) * gale, 0.35, H + 4);
    }
  }
}

function stepLog(params, log, dts) {
  if (log.phase === 0) {
    log.ang += log.spin * dts;
    const tau = params.ts - log.t0;
    const d = V0 * tau + 0.5 * G * tau * tau;
    log.x = CX + log.off * spreadAt(d) + blown(params, log.t0, tau);
    log.y = LIP + d;
    if (log.y >= HIT) {
      for (let n = 0; n < 34; n++) spawnSpray(params, log.x + (Math.random() - 0.5) * 6, HIT - 1, (Math.random() - 0.5) * 70, -(12 + Math.random() * 40) * 1.5, 1.6, HIT + 1);
      log.phase = 1;
      log.age = 0;
      log.drift = log.x < W / 2 ? -1 : 1;
      log.y = HIT + 3;
    }
  } else {
    // Under for a moment, then up and away on the current.
    log.age += dts;
    log.ang -= Math.sin(log.ang) * Math.cos(log.ang) * dts * 2;
    log.x += log.drift * (3 + 6 * Math.min(1, log.age / 2)) * dts;
    log.y = HIT + 4 + Math.min(1, log.age / 2) * 5 + Math.sin(log.age * 3) * 0.6;
    if (log.x < -8 || log.x > W + 8) log.on = false;
  }
}

export function draw(display, params, time) {
  const buf = params.buf;
  const lat = params.lat;
  const ts = params.ts;
  const hue = params.hue;
  const spate = params.spate;
  const wind = params.wind;
  const gale = params.gale;
  buf.set(params.bg);

  // Water colours: nine levels of brightness by four of saturation.
  const pal = params.pal;
  const sats = [0.05, 0.22, 0.42, 0.62];
  for (let l = 0; l <= 8; l++)
    for (let s = 0; s < 4; s++) {
      const c = hsv(hue + (s === 3 ? 0.02 : 0), sats[s], l / 8);
      const o = (l * 4 + s) * 3;
      pal[o] = c[0];
      pal[o + 1] = c[1];
      pal[o + 2] = c[2];
    }

  const half0 = params.half0;
  const gap = params.gap;

  // The river upstream, flowing towards the lip.
  for (let y = 13; y < LIP; y++) {
    // Narrower as it runs back towards the ridge.
    const z = 1 / (0.72 + (0.28 * (y - 13)) / (LIP - 13));
    const wide = (half0 + 1) / z;
    for (let x = Math.ceil(CX - wide); x < CX + wide; x++) {
      const n = vn(lat, ((x - CX) * z) / 2.2 + 300, (y - 13) * z * 0.5 - ts * 2.2);
      const far = y < 16 ? 1 : 0;
      const l = (n > 0.7 ? 6 : n > 0.42 ? 4 : 3) - far;
      const o = (l * 4 + 2) * 3;
      put(buf, x, y, pal[o], pal[o + 1], pal[o + 2]);
    }
  }

  // The falling water. Each pixel reads its texture at the moment that water left the lip,
  // so a clump keeps its place in the texture and stretches as it speeds up.
  const breakAt = params.breakAt;
  for (let y = LIP; y <= HIT; y++) {
    const d = y - LIP + 0.5;
    const dn = d / 94;
    const tau = flight(d);
    const u = ts - tau;
    const half = half0 * spreadAt(d);
    const c = CX + Math.sin(u * 0.9) * 0.8 * dn + blown(params, u, tau);
    const aer = Math.min(1, d / 75);
    // Below the break a gale has torn this much of the water away.
    const torn = d > breakAt ? Math.min(1, (d - breakAt) / 26) * gale * 0.85 : 0;
    const reach = half + 3 + 6 * dn;
    const lo = Math.max(0, Math.floor(c - reach));
    const hi = Math.min(W - 1, Math.ceil(c + reach));
    // Ragged edges: lumps of water bulge out of each side and travel down with it.
    const eL = (vn(lat, u * 5 + 17, 11) - 0.5) * (1.5 + 7 * dn);
    const eR = (vn(lat, u * 5 + 83, 29) - 0.5) * (1.5 + 7 * dn);
    for (let x = lo; x <= hi; x++) {
      const off = x + 0.5 - c;
      const inside = half + (off < 0 ? eL : eR) - Math.abs(off);
      const o = (y * W + x) * 3;
      // The rock behind and beside the water is wet and dark.
      if (inside > -2.5) {
        buf[o] *= 0.62;
        buf[o + 1] *= 0.66;
        buf[o + 2] *= 0.75;
      }
      const xr = off / half;
      const s = xr * half0;
      if (inside <= 0) {
        // Drops flung off the edge.
        if (inside > -2 - 5 * dn && vn(lat, x * 1.37 + 500, u * 13) > 0.8 - 0.1 * dn) {
          const p = (5 * 4 + 1) * 3;
          buf[o] = pal[p];
          buf[o + 1] = pal[p + 1];
          buf[o + 2] = pal[p + 2];
        }
        continue;
      }
      const thr = gap * (0.3 + 0.75 * Math.abs(xr));
      if (thr > 0 && vn(lat, s * 0.45 + 100.5, u * 0.5) < thr) continue;
      const n1 = vn(lat, s * 0.62 + 3.1, u * 8);
      const n2 = vn(lat, s * 0.22 + 51.7, u * 2.6);
      if (torn > 0 && vn(lat, s * 0.8 + 610, u * 4) < torn) continue;
      let l;
      let sat;
      if (n1 * 0.55 + n2 * 0.45 > 0.8 - 0.24 * aer - 0.3 * torn) {
        l = 7 + (n1 > 0.7 ? 1 : 0);
        sat = 0;
      } else {
        let v = 0.34 + 0.34 * aer + (n1 - 0.5) * (0.35 + 0.2 * aer) + (n2 - 0.5) * 0.5;
        if (inside < 1) v *= 0.8;
        l = Math.max(1, Math.min(7, Math.round(v * 8)));
        // Ragged, so the water pales without a seam across it.
        const a = aer + (n1 - 0.5) * 0.5;
        sat = a < 0.35 ? 3 : a < 0.7 ? 2 : 1;
      }
      // The curl over the lip catches the sky.
      if (d < 1.2) {
        l = 7;
        sat = 1;
      } else if (d < 3) {
        l = Math.max(l, 6);
        sat = 2;
      }
      const p = (l * 4 + sat) * 3;
      buf[o] = pal[p];
      buf[o + 1] = pal[p + 1];
      buf[o + 2] = pal[p + 2];
    }
  }

  // The plunge pool: rings running out from where the water lands, foam boiling over it.
  // What a gale lets through still lands, and churns less.
  const ci = Math.max(4, Math.min(W - 4, params.hitX));
  const hEnd = params.hEnd;
  const boil = 1 - 0.6 * gale;
  for (let y = POOL; y < H; y++) {
    const q = (y - POOL) / (H - 1 - POOL);
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - ci;
      const dy = (y - HIT) * 2.6;
      const rho = Math.sqrt(dx * dx + dy * dy);
      let l = 1 + (q > 0.5 ? 1 : 0);
      let sat = 3;
      const w = Math.sin(rho * 0.55 - ts * 6 + vn(lat, x / 6 + 900, y / 2) * 2.5);
      if (w > 0.7 && vn(lat, x / 3 + 950, y + ts * 0.5) > 0.35) l += rho < 40 ? 2 : 1;
      const churn = Math.exp(-rho / (hEnd * 0.9 + 5)) * (0.5 + 0.9 * vn(lat, dx / 2.5 + 7, ts * 3 + y * 0.7));
      const scum = Math.exp(-rho / 34) * vn(lat, rho / 3 - ts * 2.2, (dx / (rho + 1)) * 5 + (dy < 0 ? 20 : 40)) * 0.75;
      const f = (churn + scum) * boil;
      if (f > 0.62) {
        l = 8;
        sat = 0;
      } else if (f > 0.47) {
        l = 5;
        sat = 1;
      }
      const p = (l * 4 + sat) * 3;
      const o = (y * W + x) * 3;
      buf[o] = pal[p];
      buf[o + 1] = pal[p + 1];
      buf[o + 2] = pal[p + 2];
    }
  }

  // The log goes in front of the water and behind the boulders and the mist.
  const log = params.log;
  if (log.on && !(log.phase === 1 && log.age < 0.7)) drawLog(buf, log);

  const front = params.front;
  const fa = params.frontA;
  for (let p = 0; p < W * H; p++) {
    if (fa[p] === 0) continue;
    const o = p * 3;
    buf[o] = front[o];
    buf[o + 1] = front[o + 1];
    buf[o + 2] = front[o + 2];
  }

  {
    const p = (8 * 4 + 1) * 3;
    for (let i = 0; i < SPRAY; i++) {
      if (params.page[i] > 3) continue;
      put(buf, Math.round(params.px[i]), Math.round(params.py[i]), pal[p], pal[p + 1], pal[p + 2]);
    }
  }

  // Mist rises off the pool and leans downwind. The sun is behind us, so a piece of
  // rainbow stands in it.
  const dens = params.dens;
  const yTop = HIT - 80;
  dens.fill(0, yTop * W);
  const hs = 24 + 24 * spate + 20 * gale;
  for (let y = Math.max(yTop, Math.floor(HIT - 4.6 * hs)); y < H; y++) {
    const h = HIT - y;
    const fh = h > 0 ? Math.exp(-h / hs) : Math.exp(h / 5);
    const sig = hEnd + 4 + Math.max(0, h) * 0.5;
    const inv = 1 / (2 * sig * sig);
    const mx = ci + wind * Math.max(0, h) * 0.9;
    const xr = Math.ceil(sig * 2.6);
    const row = y * W;
    for (let x = Math.max(0, Math.floor(mx - xr)); x <= Math.min(W - 1, Math.ceil(mx + xr)); x++) {
      const dx = x + 0.5 - mx;
      const z = dx * dx * inv * 32;
      if (z < 256) dens[row + x] += fh * EXP[z | 0];
    }
  }
  const mist = hsv(hue, 0.1, 0.9);
  const amt = 0.75 + 0.8 * spate;
  const rcx = ci - 4;
  const rcy = HIT + 36;
  const R = 48;
  for (let y = yTop; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ds = dens[y * W + x];
      if (ds < 0.02) continue;
      const n = vn(lat, x / 11 + 40 - ts * wind * 3, (y + ts * 7) / 11);
      let d = ds * (0.25 + 1.3 * (n - 0.3)) * amt;
      if (d <= 0.06) continue;
      // Four steps of mist: finer steps flicker as it rises.
      d = Math.min(0.75, Math.round(d * 4) / 4);
      const o = (y * W + x) * 3;
      let mr = mist[0];
      let mg = mist[1];
      let mb = mist[2];
      const rx = x + 0.5 - rcx;
      const ry = y + 0.5 - rcy;
      const rr = Math.sqrt(rx * rx + ry * ry) - R;
      if (rr > -4 && rr < 4 && ry < 0) {
        // Violet inside, red outside, as the primary bow has it.
        const band = hsv(0.76 * (1 - (rr + 4) / 8), 0.85, 1);
        mr = band[0];
        mg = band[1];
        mb = band[2];
        d = Math.min(0.5, d);
      }
      buf[o] += (mr - buf[o]) * d;
      buf[o + 1] += (mg - buf[o + 1]) * d;
      buf[o + 2] += (mb - buf[o + 2]) * d;
    }
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, Math.min(255, buf[o]), Math.min(255, buf[o + 1]), Math.min(255, buf[o + 2]));
    }
}

function drawLog(buf, log) {
  const ca = Math.cos(log.ang);
  const sa = Math.sin(log.ang);
  const len = 5;
  for (let s = -len; s <= len; s += 0.5) {
    const x = log.x + ca * s;
    const y = log.y + sa * s;
    const end = Math.abs(s) > len - 0.6;
    for (let w = 0; w <= 1; w++) {
      const px = Math.round(x - sa * w);
      const py = Math.round(y + ca * w);
      if (end) put(buf, px, py, 215, 170, 105);
      else put(buf, px, py, w === 0 ? 120 : 82, w === 0 ? 72 : 48, w === 0 ? 34 : 22);
    }
  }
}
