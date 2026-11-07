// ===== Patternflow pattern =====
// Title:   Apollonian Residues
// Family:  fractal
// Idea:    The integral Apollonian packing (-1, 2, 2, 3) is drawn as two discs, one seen wide and one dived into, with every circle numbered by its whole-number curvature and coloured by that number mod m, while a key between them shows which of the m residues ever occur, only 8 of 24 for m = 24, and a spotlight lights every circle of one residue at once.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Apollonian packing, the Descartes circle theorem (René Descartes, 1643; Frederick Soddy, 1936) and integral packings (Graham, Lagarias, Mallows, Wilks and Yan, 2003), pattern round 105
// Round:   105
// ===============================
// @matrix 64x128
// @knobs Modulus=0..1, Speed=0.2..3, Depth=1..4, Spotlight=0..1
//
// Knob 1: Modulus. The m the curvatures are taken mod, from 24 at 0 down to 3 at 1 in 22 steps. At 24 only eight residues occur (2, 3, 6, 11, 14, 15, 18, 23), because a curvature is never 0 or 1 mod 4 and never 1 mod 3, so the key lights eight tiles and leaves sixteen grey dots; 12, 8 and 6 keep four residues, 4 and 3 keep two, and a modulus with no factor of 4 or 3, such as 23, 19, 11 or 5, keeps every one.
// Knob 2: Speed. How fast the two cameras drift round the packing and the spotlight turns. At 2 the wide camera goes once round in about two minutes and the spotlight rests 20 s and then walks the eight residues of m = 24 in 8 s; 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Depth. How far down the packing goes. At 1 the smallest circle drawn has a radius of 2.2 LEDs and the lower camera sits 0.80 of the way from the centre to the rim, which blows the circle it is over up 2.8 times; at 4 the radius is 0.5 LED, a single lit LED, and the camera 0.92 of the way, 6.5 times.
// Knob 4: Spotlight. Below 0.1, where it opens at 0.06, every residue stays lit for 20 s and then the spotlight walks them one a second, each residue's circles and tile in colour and the rest grey. From 0.1 to 1 it holds the residue the knob points at, in equal steps through the residues that occur, and writes that residue at the right of the key.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, sin, cos, abs, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The packing is built to this curvature.
const KMAX = 1400;
// Two discs one above the other with the key between them: the discs' middle
// column and LEDs to the unit, their middle rows, the key's first row and the
// lower disc's first row.
const DX = 32, SC = 28.4, UY = 28.9, LY = 99.1, KY = 58, KB = 70;

// 3 by 5 digits and a slash, one number a row, bit 2 the left column.
const DIG = [
  [7, 5, 5, 5, 7], [2, 6, 2, 2, 7], [7, 1, 7, 4, 7], [7, 1, 7, 1, 7], [5, 5, 7, 1, 1],
  [7, 4, 7, 1, 7], [7, 4, 7, 5, 7], [7, 1, 1, 1, 1], [7, 5, 7, 5, 7], [7, 5, 7, 1, 7], [1, 1, 2, 4, 4],
];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  // A circle is its curvature k and w = k times its centre (a complex number),
  // and the Descartes theorem for four mutually tangent circles holds for k
  // and for w alike, so a fourth circle k4 = k1 + k2 + k3 +- 2 sqrt(k1 k2 + k2 k3 + k3 k1)
  // comes from the other one as 2 (k1 + k2 + k3) - k4, in whole numbers, and the
  // same for w. The root: the circle of curvature -1 round the origin (its
  // inside is the packing), 2 at +-i/2 and 3 at +-2/3.
  const K = [], WR = [], WI = [];
  const root = [[-1, 0, 0], [2, 0, 1], [2, 0, -1], [3, 2, 0], [3, -2, 0]];
  for (const c of root) { K.push(c[0]); WR.push(c[1]); WI.push(c[2]); }
  // A quadruple q of circle numbers, whose slot `skip` was just filled. Each
  // other slot is swapped for the circle on the far side of the other three.
  // The new circle always has the largest curvature of its quadruple, so a
  // branch can stop at KMAX.
  const walk = (q, skip) => {
    for (let i = 0; i < 4; i++) {
      if (i === skip) continue;
      let sk = 0, sr = 0, si = 0;
      for (let j = 0; j < 4; j++) if (j !== i) { sk += K[q[j]]; sr += WR[q[j]]; si += WI[q[j]]; }
      const nk = 2 * sk - K[q[i]];
      if (nk > KMAX) continue;
      K.push(nk); WR.push(2 * sr - WR[q[i]]); WI.push(2 * si - WI[q[i]]);
      const q2 = q.slice();
      q2[i] = K.length - 1;
      walk(q2, i);
    }
  };
  // The two 3-circles are the two far sides of (-1, 2, 2); each quadruple's
  // fourth slot is the 3-circle, which is already there.
  walk([0, 1, 2, 3], 3);
  walk([0, 1, 2, 4], 3);
  const idx = K.map((_, i) => i).sort((a, b) => K[a] - K[b]);
  const n = idx.length;
  const S = {
    n, k: new Int32Array(n), cr: new Float64Array(n), ci: new Float64Array(n),
    col: new Float32Array(N * 3),
    cls: new Int16Array(n), pal: new Float32Array(32 * 3), lum: new Float32Array(32), nc: 0, m: 0,
    seen: null, res: null, wt: new Float32Array(32).fill(1),
    t: 62, ts: 0, mod: 24, depth: 1, spotKnob: 0.06, spot: -1,
  };
  for (let j = 0; j < n; j++) {
    const i = idx[j];
    S.k[j] = K[i];
    S.cr[j] = WR[i] / K[i];
    S.ci[j] = WI[i] / K[i];
  }
  params.s = S;
}

// The residues mod m that occur get a class each, in order, and a colour each
// a golden-ratio step round the hue wheel, so neighbours in the key differ.
function recolour(S, m) {
  const seen = new Int16Array(m).fill(-1), has = new Uint8Array(m), res = [];
  for (let j = 0; j < S.n; j++) has[((S.k[j] % m) + m) % m] = 1;
  let c = 0;
  for (let r = 0; r < m; r++) if (has[r]) (seen[r] = c++), res.push(r);
  for (let j = 0; j < S.n; j++) S.cls[j] = seen[((S.k[j] % m) + m) % m];
  S.nc = c;
  S.m = m;
  S.seen = seen;
  S.res = res;
  const tmp = [0, 0, 0];
  for (let q = 0; q < c; q++) {
    const h = 0.07 + q * 0.618034, f = h - floor(h);
    hsv(h, f > 0.55 && f < 0.8 ? 0.55 : 0.8, 1, tmp, 0);
    for (let e = 0; e < 3; e++) S.pal[q * 3 + e] = tmp[e];
    S.lum[q] = 0.3 * tmp[0] + 0.59 * tmp[1] + 0.11 * tmp[2];
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  const step = d * cl(k[1], 0.2, 3) * 0.5;
  S.t += step * 1.6;
  S.mod = 24 - floor(cl(k[0], 0, 1) * 21.999);
  S.depth = cl(k[2], 1, 4);
  S.spotKnob = cl(k[3], 0, 1);
  if (S.m !== S.mod) recolour(S, S.mod);
  // Which residue the spotlight is on: the one the knob picks, or below 0.1 a
  // pause with every colour lit and then a walk through the residues.
  let spot = -1;
  if (S.spotKnob >= 0.1) spot = min(S.nc - 1, floor(((S.spotKnob - 0.1) / 0.9) * S.nc));
  else {
    S.ts += step;
    const u = S.ts % (20 + S.nc);
    spot = u < 20 ? -1 : floor(u - 20);
  }
  S.spot = spot;
  for (let c = 0; c < S.nc; c++) S.wt[c] += ((spot < 0 || spot === c ? 1 : 0) - S.wt[c]) * min(1, d * 4);
}

// A run of digits into the colour buffer, top left at (x, y), each dot of the
// 3 by 5 hand a z by z block.
function text(S, str, x, y, r, g, b, a, z) {
  const col = S.col;
  z = z || 1;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i), gl = DIG[ch === 47 ? 10 : ch - 48];
    for (let ry = 0; ry < 5; ry++)
      for (let cx = 0; cx < 3; cx++) {
        if (!(gl[ry] & (4 >> cx))) continue;
        for (let by = 0; by < z; by++)
          for (let bx = 0; bx < z; bx++) {
            const px = x + (i * 4 + cx) * z + bx, py = y + ry * z + by;
            if (px < 0 || px >= W || py < 0 || py >= H) continue;
            const q = (py * W + px) * 3;
            col[q] += (r - col[q]) * a;
            col[q + 1] += (g - col[q + 1]) * a;
            col[q + 2] += (b - col[q + 2]) * a;
          }
      }
  }
}

// One camera on the packing: the Möbius map z -> e^(i th) (z - a) / (1 - conj(a) z)
// takes the unit disc onto itself and a to its centre, and takes circles to
// circles, so the packing stays a packing. 1 / conj(a) is where the map blows
// up, and mag bounds how much it can enlarge a circle.
function camera(ar, ai, th) {
  const ct = cos(th), st = sin(th), a2 = ar * ar + ai * ai;
  return { ar, ai, ct, st, pr: ar / a2, pi: ai / a2, mag: (1 + sqrt(a2)) / (1 - sqrt(a2)) };
}
function mob(c, zr, zi, out) {
  const nr = zr - c.ar, ni = zi - c.ai, dr = 1 - (c.ar * zr + c.ai * zi), di = -(c.ar * zi - c.ai * zr), den = dr * dr + di * di;
  const qr = (nr * dr + ni * di) / den, qi = (ni * dr - nr * di) / den;
  out[0] = qr * c.ct - qi * c.st;
  out[1] = qr * c.st + qi * c.ct;
}

function ring(S, cx, cy, r, g, a) {
  const col = S.col;
  for (let py = max(0, floor(cy - r - 2)); py <= min(H - 1, floor(cy + r + 2)); py++)
    for (let px = max(0, floor(cx - r - 2)); px <= min(W - 1, floor(cx + r + 2)); px++) {
      const cov = cl(1 - abs(hypot(px + 0.5 - cx, py + 0.5 - cy) - r), 0, 1) * a;
      if (cov <= 0) continue;
      const q = (py * W + px) * 3;
      col[q] += (g - col[q]) * cov;
      col[q + 1] += (g - col[q + 1]) * cov;
      col[q + 2] += (g - col[q + 2]) * cov;
    }
}

// One disc: every circle seen through the camera, drawn down to the smallest
// radius the Depth knob allows. The image of a circle is the circle whose
// centre is the image of the mirror image of the pole in it, and whose radius
// is the distance from there to the image of any point on it.
function disc(S, cam, cy, y0, y1) {
  const col = S.col, pal = S.pal, wt = S.wt;
  const o = [0, 0], o2 = [0, 0];
  const rf = 2.2 * 0.227 ** ((S.depth - 1) / 3);
  for (let j = 1; j < S.n; j++) {
    const rho = 1 / S.k[j];
    if (SC * rho * cam.mag < rf) break;
    const cr = S.cr[j], ci = S.ci[j];
    const dx = cam.pr - cr, dy = cam.pi - ci, rr = (rho * rho) / (dx * dx + dy * dy);
    mob(cam, cr + dx * rr, ci + dy * rr, o);
    mob(cam, cr + rho, ci, o2);
    const x = DX + SC * o[0], y = cy - SC * o[1], r = SC * hypot(o2[0] - o[0], o2[1] - o[1]);
    if (r < rf) continue;
    const c = S.cls[j], q0 = c * 3, w = wt[c], gw = 50 * (1 - w);
    const R = pal[q0] * 255 * w + gw, G = pal[q0 + 1] * 255 * w + gw, B = pal[q0 + 2] * 255 * w + gw * 1.15;
    const xa = max(0, floor(x - r - 1)), xb = min(W - 1, floor(x + r + 1)), ya = max(y0, floor(y - r - 1)), yb = min(y1, floor(y + r + 1));
    for (let py = ya; py <= yb; py++)
      for (let px = xa; px <= xb; px++) {
        const dist = hypot(px + 0.5 - x, py + 0.5 - y);
        let cov = cl(r - dist + 0.5, 0, 1);
        if (r < 1) cov *= r * r;
        if (cov <= 0) continue;
        // A darker rim, and a pale glint high on the left of the big ones.
        const sh = 0.6 + 0.4 * cl((r - dist) / 1.4, 0, 1);
        let hl = 0;
        if (r > 5) {
          const hd = hypot(px + 0.5 - x + 0.4 * r, py + 0.5 - y + 0.4 * r) / (0.7 * r);
          if (hd < 1) hl = (1 - hd) * (1 - hd) * 62 * w;
        }
        const q = (py * W + px) * 3;
        col[q] += (min(255, R * sh + hl) - col[q]) * cov;
        col[q + 1] += (min(255, G * sh + hl) - col[q + 1]) * cov;
        col[q + 2] += (min(255, B * sh + hl) - col[q + 2]) * cov;
      }
    // The circle's curvature, as large as the circle will hold.
    const str = String(S.k[j]), nd = str.length;
    let z = 0;
    for (let u = 4; u >= 1; u--) if (hypot(((4 * nd - 1) * u) / 2, 2.5 * u) + 1.4 < r * (u > 1 ? 0.9 : 1)) { z = u; break; }
    if (z) {
      const a = (z > 1 ? 1 : cl((r - hypot((4 * nd - 1) / 2, 2.5) - 1.4) / 1.5, 0, 1)) * (0.5 + 0.5 * w), dark = S.lum[c] > 0.45 && w > 0.5 ? 14 : 255;
      text(S, str, floor(x - ((4 * nd - 1) * z) / 2 + 0.5), floor(y - 2.5 * z + 0.5), dark, dark, dark, a, z);
    }
  }
  ring(S, DX, cy, SC, 90, 0.5);
}

// The key: how many of the m residues ever occur, the spotlit residue, and a
// tile for each residue, in colour where it occurs and a grey dot where never.
function key(S) {
  const col = S.col, pal = S.pal, m = S.m, spot = S.spot;
  text(S, S.nc + "/" + m, 2, KY + 3, 220, 220, 220, 1);
  if (spot >= 0) {
    const str = String(S.res[spot]);
    text(S, str, W - 2 - str.length * 4 + 1, KY + 3, 255, 255, 255, 1);
  }
  for (let r = 0; r < m; r++) {
    const xa = floor((r * W) / m), xb = floor(((r + 1) * W) / m), c = S.seen[r];
    for (let x = xa; x < xb; x++) {
      if (c < 0) {
        const q = ((KY + 10) * W + x) * 3;
        col[q] = col[q + 1] = col[q + 2] = 70;
        continue;
      }
      const w = S.wt[c], gw = 50 * (1 - w);
      for (let y = KY + 8; y < KY + 12; y++) {
        const q = (y * W + x) * 3;
        col[q] = pal[c * 3] * 255 * w + gw;
        col[q + 1] = pal[c * 3 + 1] * 255 * w + gw;
        col[q + 2] = pal[c * 3 + 2] * 255 * w + gw * 1.15;
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const col = S.col;
  col.fill(0);
  const t = S.t;
  // The upper camera wanders the middle of the disc. The lower one keeps to the
  // far side of it, near the rim, where the packing is enlarged; Depth takes
  // it nearer the rim.
  const am1 = 0.42 + 0.22 * sin(t * 0.04 + 1), ph1 = 0.035 * t + 0.7 * sin(t * 0.02), th1 = 0.2 * sin(t * 0.017);
  const am2 = 0.8 + 0.12 * ((S.depth - 1) / 3) + 0.02 * sin(t * 0.03 + 2), ph2 = ph1 + 3.14159 + 1.4 * sin(t * 0.025 + 1), th2 = 0.3 * sin(t * 0.013);
  const cam1 = camera(am1 * cos(ph1), am1 * sin(ph1), th1), cam2 = camera(am2 * cos(ph2), am2 * sin(ph2), th2);
  disc(S, cam1, UY, 0, KY - 1);
  disc(S, cam2, LY, KB, H - 1);
  // Where the lower camera is looking, in the upper disc.
  const mk = [0, 0];
  mob(cam1, cam2.ar, cam2.ai, mk);
  ring(S, DX + SC * mk[0], UY - SC * mk[1], 2.6, 255, 0.9);
  key(S);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = (y * W + x) * 3;
      display.setPixel(x, y, col[q] | 0, col[q + 1] | 0, col[q + 2] | 0);
    }
}
