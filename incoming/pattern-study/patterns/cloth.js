// ===== Patternflow pattern =====
// Title:   Cloth
// Family:  physics
// Idea:    A Verlet cloth of 12 by 22 knots hangs from clips on a wooden rod, gusts from behind lift it towards you, and each LED is lit by how far the cloth there tilts from the light.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// Round:   2
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Wind=0..3, Stiffness=0..1, Pins=2..12
//
// Knob 1: Hue. The dye of the cloth; its stripes and its paler wrong side follow.
// Knob 2: Wind. From still air, where it only sways, to gusts that throw the hem up past the rod.
// Knob 3: Stiffness. Silk at 0, light with a sheen and many small folds; canvas at 1, heavy and matt in a few broad ones.
// Knob 4: Pins. How many clips hold it to the rod, from two corners with a swag between them to every knot along the top.
// Buttons: K1 tap opens the clips; the cloth drops to the floor and is lifted back onto the rod.

const W = 64;
const H = 128;
const NX = 12;
const NY = 22;
const N = NX * NY;
const REST = 5;
const ROD_Y = 8;
const PIN_Y = 10.5;
// The clips sit closer together than the cloth is wide, so the top gathers.
const SPAN0 = 12;
const SPAN1 = 52;
const FLOOR = 126.5;
const STEP = 1 / 60;
const ITER = 6;
const G = 420;
// A weak perspective: cloth blown towards you grows a little.
const CAM = 260;
const CX = 32;
const CY = 56;
// Light from the upper left, low enough across the cloth that a fold's two sides differ.
const LX = -0.655;
const LY = -0.453;
const LZ = 0.605;

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy) * (1 - ux) + hash(ix + 1, iy) * ux;
  const b = hash(ix, iy + 1) * (1 - ux) + hash(ix + 1, iy + 1) * ux;
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
  params.px = new Float32Array(N);
  params.py = new Float32Array(N);
  params.pz = new Float32Array(N);
  params.ox = new Float32Array(N);
  params.oy = new Float32Array(N);
  params.oz = new Float32Array(N);
  params.nx = new Float32Array(N);
  params.ny = new Float32Array(N);
  params.nz = new Float32Array(N);
  params.inv = new Float32Array(N);
  // Where each clipped knot is pulled to, and where it was when the pull began.
  params.tx = new Float32Array(NX);
  params.ty = new Float32Array(NX);
  params.tz = new Float32Array(NX);
  params.lx = new Float32Array(NX);
  params.ly = new Float32Array(NX);
  params.lz = new Float32Array(NX);
  params.sx = new Float32Array(N);
  params.sy = new Float32Array(N);
  params.fi = new Float32Array(N);
  params.bi = new Float32Array(N);
  params.fs = new Float32Array(N);
  params.bs = new Float32Array(N);

  // Springs: along the weave, across the diagonals, and over one knot to resist bending.
  const pairs = [];
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const a = j * NX + i;
      if (i + 1 < NX) pairs.push(a, a + 1, 0);
      if (j + 1 < NY) pairs.push(a, a + NX, 0);
    }
  for (let j = 0; j + 1 < NY; j++)
    for (let i = 0; i + 1 < NX; i++) {
      const a = j * NX + i;
      pairs.push(a, a + NX + 1, 1, a + 1, a + NX, 1);
    }
  params.nb = pairs.length / 3;
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const a = j * NX + i;
      if (i + 2 < NX) pairs.push(a, a + 2, 2);
      if (j + 2 < NY) pairs.push(a, a + 2 * NX, 2);
    }
  const count = pairs.length / 3;
  params.nc = count;
  params.ca = new Uint16Array(count);
  params.cb = new Uint16Array(count);
  params.ct = new Uint8Array(count);
  params.cr = new Float32Array(count);
  const len = [REST, REST * Math.SQRT2, REST * 2];
  for (let c = 0; c < count; c++) {
    params.ca[c] = pairs[c * 3];
    params.cb[c] = pairs[c * 3 + 1];
    params.ct[c] = pairs[c * 3 + 2];
    params.cr[c] = len[params.ct[c]];
  }
  params.k = new Float32Array(3);

  params.rgb = new Float32Array(W * H * 3);
  params.zbuf = new Float32Array(W * H);
  params.front = new Float32Array(3);
  params.back = new Float32Array(3);
  params.stripe = new Float32Array(3);
  params.pins = 0;
  params.t = 0;
  params.drop = -1;
  params.lift = 0;
  params.warm = false;
  params.acc = 0;
  hang(params);
}

// The cloth straight down from the rod, its top already gathered to the clips' spacing.
function hang(params) {
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const a = j * NX + i;
      const x = SPAN0 + ((SPAN1 - SPAN0) * i) / (NX - 1);
      params.px[a] = params.ox[a] = x;
      params.py[a] = params.oy[a] = PIN_Y + j * REST;
      params.pz[a] = params.oz[a] = (Math.random() - 0.5) * 1.5;
    }
}

function setPins(params, n) {
  params.pins = n;
  for (let i = 0; i < N; i++) params.inv[i] = 1;
  for (let p = 0; p < n; p++) {
    const i = Math.round((p * (NX - 1)) / (n - 1));
    params.inv[i] = 0;
  }
  for (let i = 0; i < NX; i++) {
    params.tx[i] = SPAN0 + ((SPAN1 - SPAN0) * i) / (NX - 1);
    params.ty[i] = PIN_Y;
    params.tz[i] = 0;
  }
}

function normals(params) {
  const { px, py, pz, nx, ny, nz } = params;
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const a = j * NX + i;
      const l = i > 0 ? a - 1 : a;
      const r = i < NX - 1 ? a + 1 : a;
      const u = j > 0 ? a - NX : a;
      const d = j < NY - 1 ? a + NX : a;
      const ax = px[r] - px[l];
      const ay = py[r] - py[l];
      const az = pz[r] - pz[l];
      const bx = px[d] - px[u];
      const by = py[d] - py[u];
      const bz = pz[d] - pz[u];
      // Across the weave crossed with down it: towards the viewer when the cloth hangs flat.
      const cx = ay * bz - az * by;
      const cy = az * bx - ax * bz;
      const cz = ax * by - ay * bx;
      const m = Math.sqrt(cx * cx + cy * cy + cz * cz) + 1e-6;
      nx[a] = cx / m;
      ny[a] = cy / m;
      nz[a] = cz / m;
    }
}

function step(params, wind, stiff, clipped) {
  const { px, py, pz, ox, oy, oz, nx, ny, nz, inv } = params;
  const dt = STEP;
  const t = (params.t += dt);
  normals(params);

  // Gusts: a slow swell in strength and a direction that wanders either side of straight at you.
  const swell = noise(t * 0.45, 7.1);
  const gust = 0.3 + 1.52 * swell * swell;
  const turn = (noise(t * 0.09, 2.3) - 0.5) * 2.4;
  // Still air still breathes a little, so the cloth never hangs dead.
  const speed = (wind + 0.2) * 62 * gust;
  const wx = Math.sin(turn) * speed;
  const wz = Math.cos(turn) * speed * 0.85;
  // Silk catches the air; canvas is heavier for the same push.
  const kd = (5.5 - stiff * 3) * dt;
  const keep = 0.994;
  // A falling cloth drops mostly straight; the wind only turns it.
  const air = clipped ? 1 : 0.25;
  for (let a = 0; a < N; a++) {
    if (clipped && inv[a] === 0) continue;
    const vx = px[a] - ox[a];
    const vy = py[a] - oy[a];
    const vz = pz[a] - oz[a];
    // Patches of the gust travel across the cloth, so it ripples rather than swings as one.
    const local = (0.55 + 0.9 * noise(px[a] * 0.06 + t * 1.3, py[a] * 0.05 - t * 0.8)) * air;
    const ux = wx * local * dt - vx;
    const uy = -wind * 8 * local * dt - vy;
    const uz = wz * local * dt - vz;
    const d = (nx[a] * ux + ny[a] * uy + nz[a] * uz) * kd;
    ox[a] = px[a];
    oy[a] = py[a];
    oz[a] = pz[a];
    px[a] += vx * keep + nx[a] * d + ux * 0.002;
    py[a] += vy * keep + ny[a] * d + G * dt * dt + uy * 0.002;
    pz[a] += vz * keep + nz[a] * d + uz * 0.002;
  }

  // Clipped knots are carried, never pushed: straight to the rod, or along the lift after a drop.
  for (let i = 0; i < NX; i++) {
    if (inv[i] !== 0 || !clipped) continue;
    let x = params.tx[i];
    let y = params.ty[i];
    let z = params.tz[i];
    if (params.lift < 1) {
      const e = params.lift * params.lift * (3 - 2 * params.lift);
      x = params.lx[i] + (x - params.lx[i]) * e;
      y = params.ly[i] + (y - params.ly[i]) * e;
      z = params.lz[i] + (z - params.lz[i]) * e;
    }
    ox[i] = px[i];
    oy[i] = py[i];
    oz[i] = pz[i];
    px[i] = x;
    py[i] = y;
    pz[i] = z;
  }

  const k = params.k;
  k[0] = 1;
  k[1] = 0.5;
  k[2] = 0.015 + stiff * stiff * 0.5;
  const { ca, cb, ct, cr } = params;
  const nc = params.nc;
  const free = clipped ? inv : null;
  for (let it = 0; it < ITER; it++) {
    // The bending springs are soft anyway, so every other pass is enough for them.
    const last = it & 1 ? params.nb : nc;
    for (let c = 0; c < last; c++) {
      const a = ca[c];
      const b = cb[c];
      const wa = free ? free[a] : 1;
      const wb = free ? free[b] : 1;
      const ws = wa + wb;
      if (ws === 0) continue;
      const dx = px[b] - px[a];
      const dy = py[b] - py[a];
      const dz = pz[b] - pz[a];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
      const f = ((dist - cr[c]) / dist) * k[ct[c]] / ws;
      px[a] += dx * f * wa;
      py[a] += dy * f * wa;
      pz[a] += dz * f * wa;
      px[b] -= dx * f * wb;
      py[b] -= dy * f * wb;
      pz[b] -= dz * f * wb;
    }
  }
  for (let a = 0; a < N; a++) {
    if (pz[a] > 150) pz[a] = 150;
    // The floor and, while it falls, the walls are where the panel's edges are seen to be,
    // so a cloth nearer the eye still lands on the bottom row and not below it.
    const f = CAM / (CAM - pz[a]);
    const floor = CY + (FLOOR - CY) / f;
    if (py[a] > floor) {
      // The floor holds and drags, so a dropped cloth crumples instead of sliding.
      py[a] = floor;
      ox[a] = px[a] - (px[a] - ox[a]) * 0.4;
      pz[a] *= 0.9;
      oz[a] = pz[a];
    }
    if (!clipped) {
      const wall = 31 / f;
      if (px[a] < CX - wall) px[a] = CX - wall;
      if (px[a] > CX + wall) px[a] = CX + wall;
    }
  }
}

function update1(params, dt, k, pressed) {
  const wind = Math.max(0, k[1]);
  const stiff = Math.max(0, Math.min(1, k[2]));
  const pins = Math.max(2, Math.min(NX, Math.round(k[3])));
  if (pins !== params.pins) setPins(params, pins);

  if (pressed && params.drop < 0) params.drop = 0;
  let clipped = true;
  if (params.drop >= 0) {
    params.drop += dt;
    if (params.drop < 2.2) clipped = false;
    else {
      if (params.lift >= 1) {
        // The lift starts from wherever the top knots lie on the floor.
        params.lift = 0;
        for (let i = 0; i < NX; i++) {
          params.lx[i] = params.px[i];
          params.ly[i] = params.py[i];
          params.lz[i] = params.pz[i];
        }
      }
      params.lift = Math.min(1, (params.drop - 2.2) / 1.4);
      if (params.lift >= 1) params.drop = -1;
    }
  }

  params.acc += dt;
  let n = 0;
  while (params.acc >= STEP && n < 4) {
    params.acc -= STEP;
    step(params, wind, stiff, clipped);
    n++;
  }
  if (n === 4) params.acc = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 2];
  dt = Math.min(dt, 0.1);
  params.hue = k[0] + 0.6;
  params.stiff = Math.max(0, Math.min(1, k[2]));
  if (!params.warm) {
    // Open on a cloth that has been hanging in the wind for a while.
    params.warm = true;
    params.lift = 1;
    setPins(params, Math.max(2, Math.min(NX, Math.round(k[3]))));
    for (let s = 0; s < 90; s++) update1(params, STEP, k, false);
  }
  params.lift = params.drop < 0 ? 1 : params.lift;
  update1(params, dt, k, input.btnPressed && input.btnPressed[0]);
}

// One triangle of the cloth, Gouraud-lit from its three knots, kept where it is nearest.
function tri(params, a, b, c) {
  const { sx, sy, pz, fi, bi, fs, bs, rgb, zbuf, front, back, stripe } = params;
  const x0 = sx[a];
  const y0 = sy[a];
  const x1 = sx[b];
  const y1 = sy[b];
  const x2 = sx[c];
  const y2 = sy[c];
  const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (area > -1e-4 && area < 1e-4) return;
  const facing = area > 0;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
  if (minX > maxX || minY > maxY) return;
  const inv = 1 / area;
  const I0 = facing ? fi[a] : bi[a];
  const I1 = facing ? fi[b] : bi[b];
  const I2 = facing ? fi[c] : bi[c];
  const S0 = facing ? fs[a] : bs[a];
  const S1 = facing ? fs[b] : bs[b];
  const S2 = facing ? fs[c] : bs[c];
  const v0 = Math.floor(a / NX);
  const v1 = Math.floor(b / NX);
  const v2 = Math.floor(c / NX);
  const u0 = a - v0 * NX;
  const u1 = b - v1 * NX;
  const u2 = c - v2 * NX;
  const base = facing ? front : back;
  // Barycentric weights step by a constant from one LED to the next along a row.
  const d0 = (y1 - y2) * inv;
  const d1 = (y2 - y0) * inv;
  const za = pz[a];
  const zb = pz[b];
  const zc = pz[c];
  for (let y = minY; y <= maxY; y++) {
    const py = y + 0.5;
    const px0 = minX + 0.5;
    let l0 = ((x1 - px0) * (y2 - py) - (y1 - py) * (x2 - px0)) * inv - d0;
    let l1 = ((x2 - px0) * (y0 - py) - (y2 - py) * (x0 - px0)) * inv - d1;
    for (let x = minX; x <= maxX; x++) {
      l0 += d0;
      l1 += d1;
      const l2 = 1 - l0 - l1;
      if (l0 < 0 || l1 < 0 || l2 < 0) continue;
      const z = l0 * za + l1 * zb + l2 * zc;
      const o = y * W + x;
      if (z <= zbuf[o]) continue;
      zbuf[o] = z;
      let I = l0 * I0 + l1 * I1 + l2 * I2;
      // The light comes in five steps with short ramps between, so a fold shows as
      // contour lines on the LEDs rather than one long smear.
      const q = I * 5;
      const fl = Math.floor(q);
      let fr = (q - fl - 0.38) / 0.24;
      fr = fr < 0 ? 0 : fr > 1 ? 1 : fr;
      I = (fl + fr * fr * (3 - 2 * fr)) / 5;
      const S = l0 * S0 + l1 * S1 + l2 * S2;
      // A cream border down each side, two stripes near the hem and one under the rod,
      // woven into the front only.
      const v = l0 * v0 + l1 * v1 + l2 * v2;
      const u = l0 * u0 + l1 * u1 + l2 * u2;
      const band =
        facing &&
        ((v > 1.3 && v < 2.1) || (v > 16.4 && v < 17.4) || (v > 18.6 && v < 19.2) || ((u > 0.45 && u < 0.95) || (u > 10.05 && u < 10.55)) && v > 1.3 && v < 19.2);
      const col = band ? stripe : base;
      const qq = o * 3;
      rgb[qq] = col[0] * I + S;
      rgb[qq + 1] = col[1] * I + S;
      rgb[qq + 2] = col[2] * I + S;
    }
  }
}

export function draw(display, params, time) {
  const { px, py, pz, nx, ny, nz, sx, sy, fi, bi, fs, bs, rgb, zbuf } = params;
  normals(params);
  const stiff = params.stiff;
  const sheen = 70 * (1 - stiff) * (1 - stiff);
  // Halfway between the light and the eye, for the sheen.
  let hx = LX;
  let hy = LY;
  let hz = LZ + 1;
  const hm = Math.sqrt(hx * hx + hy * hy + hz * hz);
  hx /= hm;
  hy /= hm;
  hz /= hm;
  const shine = 10 + stiff * 8;
  for (let a = 0; a < N; a++) {
    const f = CAM / (CAM - pz[a]);
    sx[a] = CX + (px[a] - CX) * f;
    sy[a] = CY + (py[a] - CY) * f;
    const d = nx[a] * LX + ny[a] * LY + nz[a] * LZ;
    const h = nx[a] * hx + ny[a] * hy + nz[a] * hz;
    fi[a] = 0.12 + 0.88 * Math.max(0, d);
    bi[a] = 0.12 + 0.75 * Math.max(0, -d);
    fs[a] = h > 0 ? sheen * Math.pow(h, shine) : 0;
    bs[a] = h < 0 ? sheen * 0.6 * Math.pow(-h, shine) : 0;
  }
  hsvInto(params.front, 0, params.hue, 0.85, 0.95);
  hsvInto(params.back, 0, params.hue + 0.04, 0.42, 0.85);
  hsvInto(params.stripe, 0, params.hue + 0.1, 0.16, 0.92);

  rgb.fill(0);
  zbuf.fill(-1e9);
  // The rod, a dowel lit from above, with a knob at each end.
  for (let x = 3; x <= 60; x++) {
    const end = x < 5 || x > 58;
    for (let y = ROD_Y - (end ? 2 : 1); y <= ROD_Y + (end ? 1 : 0); y++) {
      const o = y * W + x;
      const top = y < ROD_Y;
      rgb[o * 3] = top ? 150 : 105;
      rgb[o * 3 + 1] = top ? 96 : 62;
      rgb[o * 3 + 2] = top ? 52 : 30;
      zbuf[o] = 0;
    }
  }
  for (let j = 0; j + 1 < NY; j++)
    for (let i = 0; i + 1 < NX; i++) {
      const a = j * NX + i;
      tri(params, a, a + 1, a + NX);
      tri(params, a + 1, a + NX + 1, a + NX);
    }
  // The clips, drawn last so they always show.
  const clipped = params.drop < 0 || params.drop >= 2.2;
  if (clipped) {
    for (let i = 0; i < NX; i++) {
      if (params.inv[i] !== 0) continue;
      const cx = Math.round(sx[i] - 1);
      const cy = Math.round(sy[i] - 3);
      for (let y = cy; y < cy + 3; y++)
        for (let x = cx; x < cx + 2; x++) {
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const o = (y * W + x) * 3;
          const lit = y === cy ? 215 : 160;
          rgb[o] = lit;
          rgb[o + 1] = lit;
          rgb[o + 2] = lit + 10;
        }
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, Math.min(235, rgb[o]), Math.min(235, rgb[o + 1]), Math.min(235, rgb[o + 2]));
    }
}
