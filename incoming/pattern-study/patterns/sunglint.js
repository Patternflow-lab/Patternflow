// ===== Patternflow pattern =====
// Title:   Sunglint
// Family:  ocean
// Idea:    From a cliff you look out to sea toward the sun, and below it the glitter path of thousands of tiny glints on choppy water widens toward you until it fills the panel, each glint flashing as its wavelet tilts, while a sailboat or a pair of gulls crosses now and then.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 20
// Round:   20
// ===============================
// @matrix 64x128
// @knobs Sun=0..1, Speed=0.2..3, Chop=0..1, Wind=-1..1
//
// Knob 1: Sun. How high the sun stands. At 0 a high silver sun throws a broad glitter that fills the panel from a third of the way down; turned up, it sinks onto the horizon as a flattened pale gold disc, and the glitter narrows to a gold column with dark slate water either side.
// Knob 2: Speed. How fast the water moves: at 2 a glint holds for about half a second, and the rows of wavelets that carry the glints roll in at two or three LEDs a second near your feet.
// Knob 3: Chop. How rough the sea is. At 0 a light chop of fine wavelets whose rows run three LEDs apart under the horizon and fourteen at the foot of the panel; at 1 the wavelets grow half as big again, their rows twenty-one LEDs apart at the foot, and the path spreads wider.
// Knob 4: Wind. Near calm at 0.06. Turned either way, a breeze from that side sets the wavelets sliding sideways and sends the gusts that thicken the glitter racing across; the cloud bars drift and the grass on the cliff edge bends with it.
// Buttons: K1 tap sends a sloop across the glitter before the wind, its sails dark against the light. One also comes by itself every half minute or so, and gulls cross in ones and twos.

const W = 64;
const H = 128;
const N = W * H;
// The horizon row, and the rows of sea under it.
const HZ = 19;
const SEA = H - HZ;
const TAU = Math.PI * 2;
const LUT = 1024;
const COS = new Float32Array(LUT);
for (let i = 0; i < LUT; i++) COS[i] = Math.cos((i / LUT) * TAU);
const KL = LUT / TAU;
const cos = (a) => COS[(a * KL) & (LUT - 1)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
// Gull wings, raised, gliding and down: seven LEDs across, the body in the
// middle, each entry how far that column sits above or below the body.
const WING = [
  [-2, -2, -1, 0, -1, -2, -2],
  [0, -1, -1, 0, -1, -1, 0],
  [1, 1, 0, 0, 0, 1, 1],
];
const BEAT = [0, 1, 2, 1];

export function setup(params) {
  const P = params;
  P.ph = new Float32Array(N);
  P.om = new Float32Array(N);
  P.sz = new Float32Array(N);
  P.ph2 = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    P.ph[i] = Math.random() * TAU;
    P.om[i] = 3.5 + Math.random() * 3.5;
    P.ph2[i] = Math.random() * TAU;
    const u = Math.random();
    P.sz[i] = 1 - 0.5 * u * u * u * u;
  }
  P.noise = new Float32Array(256);
  for (let i = 0; i < 256; i++) P.noise[i] = Math.random();
  P.buf = new Float32Array(N * 3);
  P.gust = new Float32Array(16 * 32);
  for (const k of ["R1", "R2", "R3", "R4", "R5", "kx"]) P[k] = new Float32Array(H);
  P.t = 0;
  P.gx = 0;
  P.cx = 0;
  P.wx = 0;
  P.boat = -1;
  P.bx = 0;
  P.bdir = 1;
  P.nextBoat = 14 + Math.random() * 20;
  // Grass on the cliff edge in the near left corner: base, height, sway phase.
  P.grass = [];
  for (let j = 0; j < 18; j++) P.grass.push([Math.random() * 25, 4 + Math.random() * 6, Math.random() * TAU]);
  P.gulls = [];
  P.nextGull = 2 + Math.random() * 6;
  P.started = false;
}

function noise(P, fx, fy) {
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  let tx = fx - ix;
  let ty = fy - iy;
  tx = tx * tx * (3 - 2 * tx);
  ty = ty * ty * (3 - 2 * ty);
  const n = P.noise;
  const r0 = (iy & 15) * 16;
  const r1 = ((iy + 1) & 15) * 16;
  const a = n[r0 + (ix & 15)];
  const b = n[r0 + ((ix + 1) & 15)];
  return mix(mix(a, b, tx), mix(n[r1 + (ix & 15)], n[r1 + ((ix + 1) & 15)], tx), ty);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = clamp(dt, 0, 0.1);
  P.sun = clamp(k[0], 0, 1);
  P.speed = clamp(k[1], 0, 3) / 2;
  P.chop = clamp(k[2], 0, 1);
  P.wind = clamp(k[3], -1, 1);
  P.started = true;
  const step = dt * P.speed;
  P.t += step;
  const dir = P.wind < 0 ? -1 : 1;
  // Gusts run over the water and the cloud bars drift, both with the wind.
  P.gx += (dir * 3 + 12 * P.wind) * step;
  P.cx += (dir * 0.6 + 2.5 * P.wind) * step;
  P.wx += 4 * P.wind * step;
  if (input.btnPressed && input.btnPressed[0] && P.boat < 0) {
    P.boat = 0;
    P.bdir = dir;
  }
  P.nextBoat -= dt;
  if (P.nextBoat < 0) {
    if (P.boat < 0) {
      P.boat = 0;
      P.bdir = dir;
    }
    P.nextBoat = 35 + Math.random() * 30;
  }
  if (P.boat >= 0) {
    // A sloop runs before the wind, about five LEDs a second at Speed 2.
    P.boat += step * (1 + 0.5 * Math.abs(P.wind));
    P.bx = P.bdir > 0 ? -10 + 5 * P.boat : W + 10 - 5 * P.boat;
    if (P.bx < -12 || P.bx > W + 12) P.boat = -1;
  }
  P.nextGull -= dt;
  if (P.nextGull < 0) {
    P.nextGull = 9 + Math.random() * 14;
    const gd = Math.random() < 0.5 ? -1 : 1;
    const y = 6 + Math.random() * 34;
    const n = Math.random() < 0.5 ? 1 : 2;
    for (let j = 0; j < n; j++)
      P.gulls.push({ x: gd > 0 ? -4 - 7 * j : W + 3 + 7 * j, y: y + 3 * j, d: gd, f: Math.random() * TAU, v: 7 + Math.random() * 3 });
  }
  for (const g of P.gulls) {
    g.x += g.d * g.v * step;
    g.y += Math.sin(g.f * 0.21) * 0.6 * step;
    g.f += step * 7;
  }
  P.gulls = P.gulls.filter((g) => g.x > -12 && g.x < W + 12);
}

// The sloop's silhouette: hull, mast, mainsail aft and jib forward.
function boat(P, x, y, by) {
  const d = (x - P.bx) * P.bdir;
  const u = by - y;
  if (u < 0 || u > 13 || d < -6 || d > 6) return 0;
  if (u === 0) return d >= -3 && d <= 3 ? 1 : 0;
  if (u === 1) return d >= -4 && d <= 5 ? 1 : 0;
  if (d === 0) return 1;
  if (u >= 2 && u <= 12 && d < 0 && -d <= (12.5 - u) * 0.48) return 2;
  if (u >= 2 && u <= 11 && d > 0 && d <= (11 - u) * 0.42) return 2;
  return 0;
}

// The top row of the cliff edge in the near left corner.
function cliff(x) {
  return x >= 26 ? H : H - Math.round(11 * (1 - x / 26) ** 1.3 + 0.8 * Math.sin(x * 0.9));
}

export function draw(display, params) {
  const P = params;
  if (!P.started) return;
  const sun = P.sun;
  const chop = P.chop;
  const T = P.t;
  const buf = P.buf;
  const sx = 29.5;
  const sy = mix(7, HZ - 3.5, sun);
  // How far under the horizon the sun's reflection falls.
  const r0 = Math.max(2.5, HZ - sy);

  // Per row: wavelets shrink toward the horizon, so their phase runs faster.
  let a1 = 0;
  let a2 = 0;
  let a3 = 0;
  let a4 = 0;
  let a5 = 0;
  for (let y = HZ; y < H; y++) {
    const p = (y - HZ + 1) / SEA;
    const ly = 2 + 6 * p * (1 + chop);
    a1 += TAU / ly;
    a2 += TAU / (ly * 1.3);
    a3 += TAU / (ly * 0.6);
    a4 += TAU / Math.max(10, 2 * ly);
    a5 += TAU / (3 + 11 * p * (1 + 0.6 * chop));
    P.R1[y] = a1;
    P.R2[y] = a2;
    P.R3[y] = a3;
    P.R4[y] = a4;
    P.R5[y] = a5;
    P.kx[y] = TAU / (4 + 10 * p * (1 + chop));
  }
  // Gusts: patches of rougher water, 4x4 LEDs a cell.
  const gust = P.gust;
  for (let j = 0; j < 32; j++) for (let i = 0; i < 16; i++) gust[j * 16 + i] = noise(P, (i * 4 - P.gx) / 7, (j * 4) / 9);

  // Water colours: slate outside the path, silver in it; glints from white to pale gold.
  const gt = [1, mix(0.94, 0.85, sun), mix(0.8, 0.56, sun)];
  const wf = (1.8 - 0.9 * sun) * (0.85 + 0.4 * chop);
  const L = 30 + 50 * (1 - sun);
  const by = HZ + 30;
  const boatOn = P.boat >= 0;
  const PH = P.ph;
  const OM = P.om;
  const SZ = P.sz;
  const PH2 = P.ph2;
  const wx = P.wx;
  // With the sun low the water off the path gets fewer glints, and dimmer ones.
  const q0 = mix(0.12, 0.04, sun);
  const g0 = mix(100, 60, sun);
  for (let y = HZ; y < H; y++) {
    const r = y - HZ + 1;
    const p = r / SEA;
    const w = (2.5 + 0.55 * r) * wf;
    const v = Math.exp(-(((r - r0) / L) ** 2));
    const amp = 3 + 8 * Math.min(1, r / 30);
    const kx = P.kx[y];
    const R1 = P.R1[y];
    const R2 = P.R2[y];
    const R3 = P.R3[y];
    const R4 = P.R4[y];
    const R5 = P.R5[y];
    const grow = (y >> 2) * 16;
    // Toward the foot of the panel the wavelets are nearer: fewer glints, and brighter.
    const near = 1 - 0.3 * clamp((r - 60) / 45, 0, 1);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const q3 = i * 3;
      const cx = (x - sx - wx) * kx;
      const p1 = R1 + 0.35 * cx - 1.3 * T;
      const s = 0.5 * cos(p1) + 0.35 * cos(R2 - 0.9 * cx - T) + 0.25 * cos(R3 + 1.4 * cx - 2.1 * T);
      const dx = (x - sx) / w;
      const I = (0.25 + 0.75 * v) / (1 + dx * dx * dx * dx);
      const sI = Math.sqrt(I);
      const g = gust[grow + (x >> 2)];
      // The water between the facets: slate outside the path, dark inside it.
      const b = mix(44 + 10 * (1 - p) - 6 * g, 20, I) + amp * s * (1 - 0.4 * I);
      const sv = Math.min(1, I * 1.3);
      let rr = b * mix(0.46, 0.88, sv);
      let gg = b * mix(0.66, 0.93, sv);
      let bb = b;
      // Facets sit on the band's checkerboard, so no two glints touch. Each
      // one mirrors a little silver sky until it tilts to the sun and flashes.
      const band = Math.floor((R4 + 0.35 * cx - 1.3 * T) * 0.3183);
      if ((x + y + band) & 1) {
        const m = 11 + 20 * (0.5 + 0.5 * cos(PH2[i] + 0.5 * p1));
        rr += m * 0.86;
        gg += m * 0.94;
        bb += m;
        // Rows of wavelets roll in; their faces toward the sun carry the glints.
        const sw = 0.5 + 0.5 * cos(R5 + 0.2 * cx + 0.8 * cos(0.11 * x + 0.3 * R5) - 1.1 * T);
        const face = clamp(0.3 + 0.95 * sw + 0.3 * s, 0, 1.25);
        const q = clamp((q0 + 0.75 * sI) * face * (0.63 + 0.84 * g) * near, 0, 0.95);
        const c = cos(Math.PI * q);
        const f = cos(PH[i] + OM[i] * T + 0.9 * p1);
        if (f > c) {
          const lit = SZ[i] * Math.min(1, (f - c) / 0.08) * (g0 + (255 - g0) * sI);
          rr += lit * gt[0];
          gg += lit * gt[1];
          bb += lit * gt[2];
        }
      }
      if (boatOn && y <= by + 3 && y > by - 14) {
        const m = boat(P, x, y, by);
        if (m) {
          rr = m === 1 ? 8 : 22;
          gg = m === 1 ? 10 : 24;
          bb = m === 1 ? 14 : 32;
        } else if (y > by && Math.abs(x - P.bx) < 4) {
          // The hull's shadow on the water under it.
          rr *= 0.3;
          gg *= 0.3;
          bb *= 0.3;
        }
      }
      buf[q3] = rr;
      buf[q3 + 1] = gg;
      buf[q3 + 2] = bb;
    }
  }

  // Sky: a steady fall of light from the haze on the horizon to the top
  // row, the glow round the sun, and thin cloud bars drifting with the wind.
  const tTop = [mix(0.58, 0.66, sun), mix(0.72, 0.68, sun), 1];
  const tLow = [mix(0.9, 1, sun), mix(0.94, 0.85, sun), mix(1, 0.64, sun)];
  const sc = [255, mix(250, 222, sun), mix(236, 150, sun)];
  const sr = mix(2.4, 3.8, sun);
  const cn = P.cn || (P.cn = new Float32Array(W * 2));
  for (let c = 0; c < 2; c++) for (let x = 0; x < W; x++) cn[c * W + x] = clamp(noise(P, (x - P.cx * (1 + 0.4 * c)) / 9 + c * 5, c * 3.3) * 2.4 - 1, 0, 1);
  for (let y = 0; y < HZ; y++) {
    const vv = y / (HZ - 1);
    const lv = 80 + 7.4 * y;
    const tr = mix(tTop[0], tLow[0], vv);
    const tg = mix(tTop[1], tLow[1], vv);
    const tb = mix(tTop[2], tLow[2], vv);
    for (let x = 0; x < W; x++) {
      const q3 = (y * W + x) * 3;
      const dx = x - sx;
      const dy = (y - sy) * 1.15;
      const d = Math.sqrt(dx * dx + dy * dy);
      const glow = 150 * Math.exp(-d / 4.5) + 60 * Math.exp(-d / 14);
      let cl = 0;
      for (let c = 0; c < 2; c++) {
        const e = (y - 4 - c * 6.5) / 1.2;
        if (e > -2.5 && e < 2.5) cl += Math.exp(-e * e) * cn[c * W + x];
      }
      cl = Math.min(1, cl);
      // A cloud is grey against the haze, its edges silvered near the sun.
      const lit = lv + glow * (1 - 0.5 * cl + 1.2 * cl * (1 - cl)) - 26 * cl;
      if (d < sr) {
        buf[q3] = sc[0];
        buf[q3 + 1] = sc[1];
        buf[q3 + 2] = sc[2];
      } else {
        buf[q3] = lit * tr;
        buf[q3 + 1] = lit * tg;
        buf[q3 + 2] = lit * tb;
      }
    }
  }
  // A headland runs out from the left into the haze on the horizon.
  for (let x = 0; x < 15; x++) {
    const top = HZ - Math.round(4.2 * (1 - x / 15) ** 0.8 + 0.6 * Math.sin(x * 1.3));
    for (let y = Math.max(0, top); y < HZ; y++) {
      const q3 = (y * W + x) * 3;
      buf[q3] = 40;
      buf[q3 + 1] = 46;
      buf[q3 + 2] = 58;
    }
  }
  // The cliff edge you stand on, and its grass bending in the wind.
  const lean = 1.6 * P.wind + 0.4;
  for (let x = 0; x < 26; x++) {
    for (let y = cliff(x); y < H; y++) {
      const q3 = (y * W + x) * 3;
      buf[q3] = 9;
      buf[q3 + 1] = 12;
      buf[q3 + 2] = 10;
    }
  }
  for (const [gb, gh, gp] of P.grass) {
    const x0 = Math.floor(gb);
    const y0 = cliff(x0);
    const sway = lean + 0.5 * Math.sin(T * 1.9 + gp) + 0.6 * gust[(y0 >> 2) * 16 + (x0 >> 2)];
    for (let k = 1; k <= gh; k++) {
      const u = k / gh;
      const x = Math.round(gb + sway * u * u * gh * 0.5);
      const y = y0 - k;
      if (x < 0 || x >= W || y < HZ) continue;
      const q3 = (y * W + x) * 3;
      // The tips catch the sun.
      const tip = k === Math.ceil(gh) ? 30 : 0;
      buf[q3] = 10 + tip * 1.4;
      buf[q3 + 1] = 14 + tip * 1.2;
      buf[q3 + 2] = 10 + tip * 0.7;
    }
  }
  // Gulls, dark against the light.
  for (const g of P.gulls) {
    const wing = WING[BEAT[Math.floor(((g.f % TAU) / TAU) * 4)]];
    for (let j = 0; j < 7; j++) {
      const x = Math.round(g.x) + j - 3;
      const y = Math.round(g.y) + wing[j];
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const q3 = (y * W + x) * 3;
      buf[q3] = 16;
      buf[q3 + 1] = 18;
      buf[q3 + 2] = 24;
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q3 = (y * W + x) * 3;
      display.setPixel(x, y, clamp(buf[q3], 0, 255), clamp(buf[q3 + 1], 0, 255), clamp(buf[q3 + 2], 0, 255));
    }
}
