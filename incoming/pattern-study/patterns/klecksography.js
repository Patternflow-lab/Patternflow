// ===== Patternflow pattern =====
// Title:   Klecksography
// Family:  blot
// Idea:    One inkblot pressed in a sheet folded down its middle, the left half the mirror of the right, with the ink still wet and creeping: lobes swell, necks pinch off, drops part from the body and join it again, two inks bleed into each other, and the ink pools along the edge and lies thinner and grainy inside.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: klecksography, inkblots pressed in folded paper (Justinus Kerner, 1857)
// Round:   200
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Creep=0..3, Ink=-1..1, Paper=0..1
//
// Knob 1: Hue. The colour of the first ink, from a deep violet-blue where the knob opens round the wheel; the second ink keeps its distance of 0.38 of the wheel from it, so it opens on amber.
// Knob 2: Creep. How fast the wet ink moves. At the bottom of the knob the blot holds still; where it opens an edge creeps about one LED a second.
// Knob 3: Ink. How much ink was dropped on the sheet. The amount is kept while the blot moves: a thin figure on a twelfth of the sheet at the bottom, a body on a third of it where the knob opens, a fat blot on two thirds at the top.
// Knob 4: Paper. From black paper with luminous ink where the knob opens to a warm white sheet with dark ink at the top; in between the sheet is grey and the pooled edge turns from the brightest part of the ink to the darkest.

const W = 64;
const H = 128;
// The fold is the vertical middle line. Only the right half is worked out and the left is its mirror.
const HW = 32;
const N = HW * H;
// How far the lobes and the limbs of the outline reach, in LEDs, and how far the warp bends the sheet.
const ROUGH = 70;
const LIMB = 22;
const WARP = 11;
// Splatter: one drop at most in each cell of this many LEDs, and how long a drop stays, in seconds at Creep 1.
const CELL = 12;
const CX = Math.ceil(HW / CELL);
const CY = Math.ceil(H / CELL);
const STAY = 70;
// The second ink sits this far round the wheel from the first.
const APART = 0.38;

function hash3(i, j, k) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1440662683)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Value noise in three dimensions. The third is time, so the field drifts and never comes round.
function noise3(x, y, z) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const a = hash3(xi, yi, zi);
  const b = hash3(xi + 1, yi, zi);
  const c = hash3(xi, yi + 1, zi);
  const d = hash3(xi + 1, yi + 1, zi);
  const e = hash3(xi, yi, zi + 1);
  const f = hash3(xi + 1, yi, zi + 1);
  const g = hash3(xi, yi + 1, zi + 1);
  const h = hash3(xi + 1, yi + 1, zi + 1);
  const lo = a + (b - a) * u + (c - a + (a - b - c + d) * u) * v;
  const hi = e + (f - e) * u + (g - e + (e - f - g + h) * u) * v;
  return lo + (hi - lo) * w;
}

function hsv(h, s, v, out) {
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

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(a, b, v) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function setup(params) {
  params.tau = 0;
  params.started = false;
  params.hue = 0;
  params.paper = 0;
  // The height of the ink over the sheet, the distance from each LED to the outline and the ink in the LEDs round it.
  params.field = new Float32Array(N);
  params.sorted = new Float32Array(N);
  params.dist = new Float32Array(N);
  params.sum = new Float32Array(N);
  params.far = new Float32Array(N);
  params.cov = new Float32Array(N);
  params.wet = new Float32Array(CX * CY);
  params.shown = new Uint8Array(CX * CY);
  // The ink each LED shows. It follows the outline a moment behind, so a drop that appears or a hole that closes fades and does not jump.
  params.ink = new Float32Array(N);
  params.a = new Float32Array(3);
  params.b = new Float32Array(3);
}

// The height of the ink at every LED of the right half at time tau. With little ink the body draws in and the limbs carry the figure.
function press(params, tau, thin) {
  const field = params.field;
  const z0 = tau * 0.014;
  const z1 = tau * 0.021 + 17;
  const z2 = tau * 0.033 + 31;
  const z3 = tau * 0.047 + 53;
  const z4 = tau * 0.061 + 71;
  const rough = ROUGH * (1 - 0.55 * thin);
  const limb = LIMB * (1 + thin);
  const sharp = 3 + 6 * thin;
  // The whole mass breathes slowly up and down the sheet.
  const cy = 63.5 + 6 * Math.sin(tau * 0.0173) + 3.5 * Math.sin(tau * 0.0291 + 1.3);
  for (let y = 0, i = 0; y < H; y++) {
    const yy = y + 0.5;
    // How far the body reaches out from the fold at this height: a silhouette that swells and narrows down the sheet.
    const my = smooth(42, 62, Math.abs(yy - 64));
    const reach = 1 + 27 * (1 - my) * (0.45 * noise3(7.7, (yy - cy) / 27, z1) + 0.55 * noise3(3.1, (yy - cy) / 9, z2));
    for (let j = 0; j < HW; j++, i++) {
      const xm = j + 0.5;
      const ax = xm * 0.043;
      const ay = yy * 0.043;
      const px = xm + (noise3(ax + 13.7, ay + 2.1, z0) - 0.5) * WARP;
      const py = yy + (noise3(ax + 71.3, ay + 55.9, z0 + 9) - 0.5) * WARP;
      const n =
        0.42 * noise3(px / 29, py / 29, z1) +
        0.27 * noise3(px / 13.7 + 31.4, py / 13.7 + 7.7, z2) +
        0.2 * noise3(px / 6.9 + 5.2, py / 6.9 + 91, z3) +
        0.11 * noise3(px / 3.7 + 47, py / 3.7 + 13, z4);
      // Limbs: the ink runs out along the lines where a second field crosses its middle.
      const ridge = 1 - Math.abs(2 * noise3(px / 19 + 80, py / 19 + 33, z2 + 100) - 1);
      // Bare paper is left round the blot: the ink thins out towards the edges of the sheet.
      const mx = smooth(24, 32, xm);
      field[i] = reach - xm + rough * (n - 0.5) + limb * Math.pow(ridge, sharp) - (34 + 30 * thin) * mx * mx - 44 * my * my;
    }
  }
}

function outline(params, tau, share, follow) {
  const { field, sorted, dist, sum, far, wet, shown, cov, ink } = params;
  // The level is the one that leaves the asked share of the sheet inked, so the ink is neither made nor lost as it creeps.
  sorted.set(field);
  sorted.sort();
  const at = clamp((1 - share) * (N - 1), 0, N - 2);
  const lo = Math.floor(at);
  const level = sorted[lo] + (sorted[lo + 1] - sorted[lo]) * (at - lo);
  // The distance to the outline in LEDs, from the height over the level and the slope there.
  for (let y = 0, i = 0; y < H; y++) {
    const up = y > 0 ? -HW : 0;
    const down = y < H - 1 ? HW : 0;
    for (let j = 0; j < HW; j++, i++) {
      // Across the fold the neighbour is the LED's own mirror.
      const gx = (field[j < HW - 1 ? i + 1 : i] - field[j > 0 ? i - 1 : i]) * (j > 0 && j < HW - 1 ? 0.5 : 1);
      const gy = (field[i + down] - field[i + up]) * (up && down ? 0.5 : 1);
      const slope = Math.sqrt(gx * gx + gy * gy);
      dist[i] = clamp((field[i] - level) / Math.max(slope, 0.7), -9, 9);
    }
  }
  // How far each bare LED is from the ink, by one sweep down the sheet and one back up.
  for (let i = 0; i < N; i++) far[i] = dist[i] >= 0 ? 0 : dist[i] > -1.5 ? -dist[i] : 99;
  for (let y = 0, i = 0; y < H; y++)
    for (let j = 0; j < HW; j++, i++) {
      let v = far[i];
      if (j > 0) v = Math.min(v, far[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, far[i - HW] + 1);
        if (j > 0) v = Math.min(v, far[i - HW - 1] + 1.414);
        if (j < HW - 1) v = Math.min(v, far[i - HW + 1] + 1.414);
      }
      far[i] = v;
    }
  for (let y = H - 1, i = N - 1; y >= 0; y--)
    for (let j = HW - 1; j >= 0; j--, i--) {
      let v = far[i];
      if (j < HW - 1) v = Math.min(v, far[i + 1] + 1);
      if (y < H - 1) {
        v = Math.min(v, far[i + HW] + 1);
        if (j < HW - 1) v = Math.min(v, far[i + HW + 1] + 1.414);
        if (j > 0) v = Math.min(v, far[i + HW - 1] + 1.414);
      }
      far[i] = v;
    }
  // Splatter: round drops that lie only just outside the body, grow as it comes near and are taken up when it reaches them.
  const clock = tau / STAY;
  for (let pass = 0; pass < 2; pass++)
    for (let cy = 0, n = 0; cy < CY; cy++)
      for (let cx = 0; cx < CX; cx++, n++) {
        const e = clock + hash3(cx, cy, 1);
        const turn = Math.floor(e);
        const k = turn * 7;
        if (hash3(cx, cy, k + 2) < 0.66) continue;
        const r0 = 2.3 + 1.2 * hash3(cx, cy, k + 5);
        const x = clamp((cx + 0.15 + 0.7 * hash3(cx, cy, k + 3)) * CELL, r0 + 1.5, HW - 6);
        const y = clamp((cy + 0.15 + 0.7 * hash3(cx, cy, k + 4)) * CELL, 4, H - 4);
        if (pass === 0) {
          // How near the body is, read before any drop is laid down.
          wet[n] = smooth(0, 0.18, e - turn) * smooth(1, 0.82, e - turn) * smooth(8, 4.5, far[Math.floor(y) * HW + Math.floor(x)]);
          continue;
        }
        // A drop is there or it is not: it comes at a size that can be seen and grows from that to its own.
        shown[n] = wet[n] > 0.3 || (shown[n] && wet[n] > 0.12) ? 1 : 0;
        if (!shown[n]) continue;
        const r = Math.max(2.2, r0 * wet[n]);
        for (let yy = Math.max(0, Math.floor(y - r - 1)); yy <= Math.min(H - 1, Math.floor(y + r + 1)); yy++)
          for (let xx = Math.max(0, Math.floor(x - r - 1)); xx <= Math.min(HW - 1, Math.floor(x + r + 1)); xx++) {
            const dx = xx + 0.5 - x;
            const dy = yy + 0.5 - y;
            const d = r - Math.sqrt(dx * dx + dy * dy);
            const q = yy * HW + xx;
            if (d > dist[q]) dist[q] = d;
          }
      }
  // A speck or a hair one LED thick is no blot. The ink in the five by five LEDs round each LED is added up, and where there is too little the LED is left bare.
  for (let i = 0; i < N; i++) cov[i] = clamp(dist[i] + 0.5, 0, 1);
  for (let y = 0, i = 0; y < H; y++)
    for (let j = 0; j < HW; j++, i++) {
      let s = 0;
      for (let o = -2; o <= 2; o++) s += inked(cov, j + o, y);
      sum[i] = s;
    }
  for (let y = 0, i = 0; y < H; y++)
    for (let j = 0; j < HW; j++, i++) {
      let s = 0;
      for (let o = -2; o <= 2; o++) s += sum[clamp(y + o, 0, H - 1) * HW + j];
      // A hole of a few LEDs in the body fills in the same way.
      if (cov[i] < 1) dist[i] = Math.max(dist[i], (s - 20.5) * 0.8);
      if (dist[i] > -0.5) {
        // And how thick the ink is here across its thinnest way: the ink along five LEDs up, across and along both diagonals.
        let up = 0;
        let fall = 0;
        let rise = 0;
        for (let o = -2; o <= 2; o++) {
          up += inked(cov, j, y + o);
          fall += inked(cov, j + o, y + o);
          rise += inked(cov, j + o, y - o);
        }
        const thick = Math.min(sum[i], up, 1.414 * fall, 1.414 * rise);
        dist[i] = Math.min(dist[i], (s - 7.5) * 0.8, (thick - 1.65) * 1.6);
      }
      ink[i] += (clamp(dist[i] + 0.5, 0, 1) - ink[i]) * follow;
    }
}

// The ink in one LED of the right half; over the fold it is the mirror's, and off the sheet there is none.
function inked(cov, j, y) {
  if (y < 0 || y >= H || j >= HW) return 0;
  return cov[y * HW + (j < 0 ? -1 - j : j)];
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const creep = clamp(k[1], 0, 3);
  const ink = clamp(k[2], -1, 1);
  params.hue = k[0];
  params.paper = clamp(k[3], 0, 1);
  // The ink has been creeping for a quarter of a minute when the panel opens.
  let follow = 1 - Math.exp(-dt / 0.15);
  if (!params.started) {
    params.started = true;
    params.tau = 15 * creep;
    follow = 1;
  }
  params.tau += dt * creep;
  press(params, params.tau, Math.max(0, -ink));
  outline(params, params.tau, ink < 0 ? 0.33 + 0.24 * ink : 0.33 + 0.34 * ink, follow);
}

export function draw(display, params) {
  const { dist, ink, a, b, tau, paper } = params;
  const hueA = params.hue + 0.73;
  // The sheet: black where the knob opens, a warm white at the top, a little darker towards its corners.
  const sheet = Math.pow(Math.max(0, paper - 0.06) / 0.94, 1.5);
  const warm = paper * paper;
  // How far the ink has turned from luminous to dark.
  const turn = smooth(0.25, 0.85, paper);
  const zg = tau * 0.05;
  const zm = tau * 0.017 + 200;
  for (let y = 0, i = 0; y < H; y++) {
    const yy = y + 0.5;
    const vy = (yy - 64) / 64;
    for (let j = 0; j < HW; j++, i++) {
      const xm = j + 0.5;
      const vx = xm / 32;
      const shade = sheet * (1 - 0.12 * (vx * vx + vy * vy));
      let r = 0.8 * shade;
      let g = (0.8 - 0.04 * warm) * shade;
      let bl = (0.8 - 0.13 * warm) * shade;
      const d = dist[i];
      const c = ink[i];
      if (c > 0.004) {
        // Ink pooled along the outline, a couple of LEDs wide, and lies thinner inside with a slow grain.
        const rim = Math.exp(-Math.max(d - 0.3, 0) / 1.4);
        const grain = 0.6 * (noise3(xm / 3.1 + 9, yy / 3.1, zg) - 0.5) + (noise3(xm / 8 + 3, yy / 8 + 40, zg * 0.6) - 0.5);
        const dense = clamp(0.2 + 0.7 * grain + 0.8 * rim, 0, 1);
        // Which ink is here. Where the two meet they run into each other over a few LEDs.
        const which = 0.7 * noise3(xm / 21 + 60, yy / 25 + 5, zm) + 0.3 * noise3(xm / 9 + 20, yy / 9 + 77, zm * 1.7) + 0.1 * grain;
        const m = smooth(0.39, 0.57, which);
        // Luminous ink on dark paper: the pooled edge is the brightest and the purest.
        hsv(hueA, 0.42 + 0.58 * dense, 0.74 + 0.26 * dense, a);
        hsv(hueA + APART, 0.42 + 0.58 * dense, 0.74 + 0.26 * dense, b);
        let ir = a[0] + (b[0] - a[0]) * m;
        let ig = a[1] + (b[1] - a[1]) * m;
        let ib = a[2] + (b[2] - a[2]) * m;
        if (turn > 0) {
          // Dark ink on white paper takes light away: the more ink, the less of the other colours comes back.
          hsv(hueA, 0.86, 1, a);
          hsv(hueA + APART, 0.86, 1, b);
          const e = 0.7 + 1.5 * dense;
          const k = 1 - 0.3 * dense;
          const dr = 0.8 * k * Math.pow(a[0] + (b[0] - a[0]) * m, e);
          const dg = 0.76 * k * Math.pow(a[1] + (b[1] - a[1]) * m, e);
          const db = 0.67 * k * Math.pow(a[2] + (b[2] - a[2]) * m, e);
          ir += (dr - ir) * turn;
          ig += (dg - ig) * turn;
          ib += (db - ib) * turn;
        }
        r += (ir - r) * c;
        g += (ig - g) * c;
        bl += (ib - bl) * c;
      }
      const R = clamp(r * 255, 0, 255);
      const G = clamp(g * 255, 0, 255);
      const B = clamp(bl * 255, 0, 255);
      display.setPixel(HW + j, y, R, G, B);
      display.setPixel(HW - 1 - j, y, R, G, B);
    }
  }
}
