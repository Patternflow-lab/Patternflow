// ===== Patternflow pattern =====
// Title:   Night Flight
// Family:  city
// Idea:    A city at night seen straight down from an airliner window: a lace of single-LED street lights traces the grid, the boulevards, a highway full of car lights and the bridges over a dark river, all on the sodium glow of the town, sliding slowly past the wingtip and its blinking lights while wisps of cloud drift under the plane.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 22, after night photographs of cities taken from airliner windows
// Round:   22
// ===============================
// @matrix 64x128
// @knobs Lamps=0..1, Speed=0.2..3, Grid=0..1, Haze=0..1
//
// Knob 1: Lamps. The street lights: an old sodium city at 0, orange with the odd green mercury lamp; turned up, the lamps are swapped for white LEDs one by one until the whole town is white at 1.
// Knob 2: Speed. Ground speed: at 2 the city slides about 3.4 LEDs a second toward the lower left, at 0.2 it barely creeps; the cars on the highway keep their own pace on top of it.
// Knob 3: Grid. Street spacing inside the boulevards: blocks eight or nine LEDs apart at 0, twelve or thirteen at 1, with more house lights inside the wider ones.
// Knob 4: Haze. Cloud under the plane: a clear night with the odd wisp at the low end, a broken layer lit from below by the town in the middle, and at 1 an overcast the city only glows through.
// Buttons: K3 tap flies over another city.

const W = 64;
const H = 128;
const N = W * H;
// Boulevards about every 44 LEDs, rivers about every 380 LEDs along the track.
const SB = 44;
const RV = 380;
const HW = 3.3;
// The city carpet: every LED leans this far away from its neighbours.
const AMP = 18.5;
const [RES, DOWN, DIAG, YARD, SUB] = [0, 1, 2, 3, 4];
const [STREET, BLVD, WHITE, HOUSE, FLOOD, HWY, PATH] = [1, 2, 3, 4, 5, 6, 7];
const { min, max, floor, round, sin, cos, abs, sqrt, exp } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const md = (a, m) => ((a % m) + m) % m;
const R2 = 0.70710678;

function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const h3 = (i, j, k) => hash(i + Math.imul(k, 1013904223), j ^ Math.imul(k, 1664525));
function vn(x, y) {
  const xi = floor(x), yi = floor(y);
  let u = x - xi, v = y - yi;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Boulevard lines, jittered a little each.
const AX = (S, i) => i * SB + floor(h3(i, 0, S + 101) * 9) - 4;
const AY = (S, j) => j * SB + floor(h3(j, 0, S + 202) * 9) - 4;

// River k's centre line across the track (u) and its slope, in LEDs.
function riverAt(S, k, u) {
  const p1 = u / 19 + h3(k, 7, S) * 6.283;
  const p2 = u / 7.3 + h3(k, 8, S) * 6.283;
  const v = k * RV + (h3(k, 9, S) - 0.5) * 50 + 7 * sin(p1) + 2.2 * sin(p2);
  return [v, (7 / 19) * cos(p1) + (2.2 / 7.3) * cos(p2)];
}
function riverDist(S, p, q) {
  const u = p * R2;
  const v = q * R2;
  const [vr, dv] = riverAt(S, round(v / RV), u);
  return abs(v - vr) / sqrt(1 + dv * dv);
}

// One cell of the city, kept in a window-sized ring buffer by world position.
function gen(P, wx, wy) {
  const S = P.seed;
  const p = wx + wy;
  const q = wx - wy;
  const plus = (p & 1) === 0;
  let i = floor(wx / SB);
  if (wx < AX(S, i)) i--;
  else if (wx >= AX(S, i + 1)) i++;
  let j = floor(wy / SB);
  if (wy < AY(S, j)) j--;
  else if (wy >= AY(S, j + 1)) j++;
  const x0 = AX(S, i);
  const y0 = AY(S, j);
  const bw = AX(S, i + 1) - x0;
  const bh = AY(S, j + 1) - y0;
  const dx = wx - x0;
  const dy = wy - y0;
  const ed = cl(min(dx - 1, bw - dx, dy - 1, bh - dy) / 9, 0, 1);
  const hk = h3(i, j, S + 3);
  const kind = hk < 0.1 ? DOWN : hk < 0.2 ? DIAG : hk < 0.28 ? YARD : hk < 0.42 ? SUB : RES;
  const sp = P.sp + (h3(i, j, S + 4) < 0.4 ? 1 : 0);
  const r = h3(wx, wy, S + 5);
  const r2 = h3(wy, wx, S + 6);
  let M = 26 + 10 * vn(wx / 23 + 0.37, wy / 23 + (S & 255));
  if (kind === DOWN) M += 12 * ed;
  else if (kind === YARD) M -= 5 * ed;
  let k = 0;
  let b = 0;
  const blvd = dx < 2 || dy < 2;
  const house = 0.035 + P.grid * 0.05;
  if (plus) {
    if (blvd) [k, b] = [BLVD, 1];
    else if (kind === DOWN) {
      const s = sp - 1;
      if ((dx - 1) % s === 0 || (dy - 1) % s === 0) [k, b] = [WHITE, 0.95];
      else if (r < 0.1) [k, b] = [WHITE, 0.9 + 0.1 * r2];
    } else if (kind === DIAG) {
      const D = 2 * sp + 2;
      if (md(q, D) === 0 || md(p, D) === 0) [k, b] = [STREET, 0.96 + 0.04 * r2];
      else if (r < house) [k, b] = [HOUSE, 0.94];
    } else if (kind === YARD) {
      const s = sp + 3;
      const lx = (dx - 1) % s;
      const ly = (dy - 1) % s;
      const lot = h3(i * 31 + floor((dx - 1) / s), j * 31 + floor((dy - 1) / s), S + 11);
      if ((lx === 0 || ly === 0) && r > 0.25) [k, b] = [FLOOD, 0.92];
      else if (lot < 0.4 && lx > 1 && ly > 1 && lx < s - 1 && ly < s - 1 && (wy & 1) === 0) [k, b] = [FLOOD, 0.92 + 0.08 * r2];
    } else if (kind === SUB) {
      // Curving suburban streets: contour lines of a slow noise.
      const u0 = i * 3.1 + 0.5;
      const v0 = j * 1.7 + 0.5;
      const lv = floor(vn(wx / 15 + u0, wy / 15 + v0) * 3);
      if (lv !== floor(vn((wx + 1) / 15 + u0, wy / 15 + v0) * 3) || lv !== floor(vn(wx / 15 + u0, (wy + 1) / 15 + v0) * 3))
        [k, b] = [STREET, 0.96 + 0.04 * r2];
      else if (r < house * 1.8) [k, b] = [HOUSE, 0.94];
    } else {
      const onX = (dx - 1) % sp === 0 && dx < bw - 2;
      const onY = (dy - 1) % sp === 0 && dy < bh - 2;
      if (onX || onY) {
        if (r > 0.08) [k, b] = [STREET, 0.96 + 0.04 * r2];
      } else if (r < house) [k, b] = [HOUSE, 0.94];
    }
  }
  // A park over a few blocks, dark, with one lit path across it.
  if (kind === RES && h3(i, j, S + 7) < 0.45) {
    const nx = max(1, floor((bw - 3) / sp));
    const ny = max(1, floor((bh - 3) / sp));
    const pw = min(nx, 1 + (h3(i, j, S + 8) < 0.6 ? 1 : 0));
    const ph = min(ny, 2);
    const px0 = 1 + floor(h3(i, j, S + 9) * (nx - pw + 1)) * sp;
    const py0 = 1 + floor(h3(i, j, S + 10) * (ny - ph + 1)) * sp;
    const pd = min(dx - px0, px0 + pw * sp - dx, dy - py0, py0 + ph * sp - dy);
    if (pd > 0) {
      if (!blvd) k = 0;
      M += (21 - M) * cl(pd / 8, 0, 1);
      if (plus && dx - px0 === dy - py0) [k, b] = [PATH, 0.75];
    }
  }
  // The river, its embankment roads and bridges where the boulevards cross.
  const d = riverDist(S, p, q);
  M += (20 - M) * cl((HW + 6 - d) / 9, 0, 1);
  const wt = cl((HW + 0.6 - d) / 1.6, 0, 1);
  if (d < HW + 2.8 && !blvd) k = 0;
  if (plus && d >= HW + 0.9 && d < HW + 2.3) [k, b] = [STREET, 0.92];
  // The highway corridor: boulevards bridge it, the median carries lamps,
  // the two carriageways (dp 0 and 4) carry the cars drawn each frame.
  const dp = p - P.ph;
  if (dp >= -4 && dp <= 8) {
    if (!blvd || abs(dp - 2) <= 3) k = 0;
    M += (21 - M) * cl((7 - abs(dp - 2)) / 7, 0, 1);
    if ((dp === -2 || dp === 6) && md(q + dp * 2, 8) === 0) [k, b] = [HWY, 1];
  }
  const slot = (wx & 63) + md(wy, H) * W;
  P.KD[slot] = k;
  P.LB[slot] = b;
  P.LH[slot] = h3(wx, wy, S + 12);
  P.MS[slot] = M;
  P.WT[slot] = wt;
}

function build(P) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) gen(P, P.ox + x, P.oy + y);
}

// One step along the track: the ground moves one LED left and one down.
function step(P) {
  P.ox += 1;
  P.oy -= 1;
  for (let y = 0; y < H; y++) gen(P, P.ox + W - 1, P.oy + y);
  for (let x = 0; x < W; x++) gen(P, P.ox + x, P.oy);
}

function place(P) {
  P.seed = floor(rnd() * 4096);
  let ox = 20000 + floor(rnd() * 4000);
  let oy = 20000 + floor(rnd() * 4000);
  // Put a river across the middle of the window.
  const u = (ox + oy + 96) * R2;
  const qc = ox - oy - 32;
  const [vr] = riverAt(P.seed, round((qc * R2) / RV), u);
  const dl = round((vr / R2 - qc + (rnd() - 0.5) * 30) / 2);
  ox += dl;
  oy -= dl;
  P.ox = ox;
  P.oy = oy;
  P.p0 = ox + oy;
  const ph = P.p0 + 80 + floor(rnd() * 12);
  P.ph = ph + (ph & 1);
}

// The wingtip, fixed in the window: a swept wing in from the left edge.
const WING = [
  [-1, 92],
  [30, 110.5],
  [31, 113],
  [27.5, 116.5],
  [-1, 131],
];
function inPoly(px, py, poly) {
  let c = false;
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const [xa, ya] = poly[a];
    const [xb, yb] = poly[b];
    if (ya > py !== yb > py && px < ((xb - xa) * (py - ya)) / (yb - ya) + xa) c = !c;
  }
  return c;
}

export function setup(params) {
  const P = params;
  Object.assign(P, {
    KD: new Uint8Array(N),
    LB: new Float32Array(N),
    LH: new Float32Array(N),
    MS: new Float32Array(N),
    WT: new Float32Array(N),
    wing: new Float32Array(N),
    CL: new Float32Array(33 * 65),
    GA: new Float32Array(N),
    GB: new Float32Array(N),
    glowDirty: true,
    acc: 0,
    cs: 0,
    t: 0,
    sp: 0,
    built: false,
  });
  place(P);
  // Wing shading: darker toward the root, a faint sheen along the leading edge.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inPoly(x + 0.5, y + 0.5, WING)) continue;
      const lead = abs((y + 0.5 - 92) * 31 - (x + 1.5) * 18.5) / 36.1;
      P.wing[x + y * W] = 26 + 8 * (x / 30) + 40 * cl(1 - lead / 1.6, 0, 1) ** 1.5;
    }
  // The lights at the tip sit on cells the carpet pushes up.
  P.nav = (P.p0 + 29 + 111) & 1 ? [30, 111] : [29, 111];
  P.strobe = (P.p0 + 27 + 115) & 1 ? [28, 115] : [27, 115];
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt, 0, 0.1);
  P.k1 = cl(k[0], 0, 1);
  P.spd = cl(k[1], 0.2, 3);
  P.grid = cl(k[2], 0, 1);
  P.haze = cl(k[3], 0, 1);
  const sp = 8 + round(P.grid * 4);
  if (input.btnPressed && input.btnPressed[2]) {
    place(P);
    P.built = false;
  }
  if (!P.built || sp !== P.sp) {
    P.sp = sp;
    P.built = true;
    P.glowDirty = true;
    build(P);
  }
  P.acc += dt * P.spd * 1.2;
  let n = 0;
  while (P.acc >= 1) {
    P.acc -= 1;
    n++;
  }
  if (n > 24) {
    P.ox += n;
    P.oy -= n;
    build(P);
  } else for (let s = 0; s < n; s++) step(P);
  // Cloud is nearer than the ground, so it slides past faster.
  P.cs += dt * P.spd * 1.2 * 1.414 * 1.7;
  P.t += dt;
  if (n || P.glowDirty) glow(P);
  // Cloud cover on a 2-LED lattice.
  const th = 0.8 - 0.78 * P.haze;
  const veil = 0.25 * P.haze * P.haze;
  const thick = 0.45 + 0.4 * P.haze;
  for (let gy = 0; gy < 65; gy++)
    for (let gx = 0; gx < 33; gx++) {
      const x = gx * 2;
      const y = gy * 2;
      const a = (y - x) * R2 - P.cs;
      const bb = (x + y) * R2;
      const nz = 0.65 * vn(a / 30 + 40, bb / 16 + 5.3 + P.t * 0.02) + 0.35 * vn(a / 11 + 70, bb / 7 + 11 - P.t * 0.03);
      let dn = cl((nz - th) / 0.28, 0, 1);
      dn = dn * dn * (3 - 2 * dn);
      P.CL[gx + gy * 33] = min(0.88, dn * thick + veil);
    }
}

// The town's light blurred, for cloud to glow with: two box passes each way.
function glow(P) {
  P.glowDirty = false;
  const A = P.GA;
  const B = P.GB;
  for (let y = 0; y < H; y++) {
    const row = md(P.oy + y, H) * W;
    for (let x = 0; x < W; x++) {
      const slot = ((P.ox + x) & 63) + row;
      A[x + y * W] = P.KD[slot] ? P.LB[slot] : 0;
    }
  }
  for (let pass = 0; pass < 4; pass++) {
    const [src, dst] = pass & 1 ? [B, A] : [A, B];
    const horiz = pass < 2;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let sum = 0;
        for (let d = -2; d <= 2; d++) {
          const u = horiz ? cl(x + d, 0, W - 1) : x;
          const v = horiz ? y : cl(y + d, 0, H - 1);
          sum += src[u + v * W];
        }
        dst[x + y * W] = sum / 5;
      }
  }
}

const SOD = [255, 132, 26];
const LEDW = [[255, 214, 168], [226, 236, 255]];
const MERC = [150, 255, 196];
const HOUSEC = [255, 176, 92];
const FLOODC = [214, 230, 255];
const HEAD = [255, 250, 232];
const TAIL = [255, 30, 20];
const C = [0, 0, 0];
const NB = [0.5, 0.62, 1];
const NIGHT = 0.7;

// A lamp's colour into C, from its kind, its dice and the Lamps knob.
function lampColour(kind, h, k1) {
  const h2 = (h * 7.31) % 1;
  const h3c = (h * 13.7) % 1;
  if (kind === STREET || kind === BLVD || kind === HWY || kind === PATH) {
    const base = kind === BLVD ? 0.3 : kind === PATH ? 0.6 : 0.06;
    if (h < base + k1 * (1 - base)) {
      for (let c = 0; c < 3; c++) C[c] = LEDW[0][c] + (LEDW[1][c] - LEDW[0][c]) * h3c;
    } else if (h2 > 0.94 && kind === STREET) {
      for (let c = 0; c < 3; c++) C[c] = MERC[c];
    } else {
      C[0] = SOD[0];
      C[1] = SOD[1] + 24 * h3c;
      C[2] = SOD[2] + 14 * h3c;
    }
  } else if (kind === WHITE) {
    for (let c = 0; c < 3; c++) C[c] = LEDW[0][c] + (LEDW[1][c] - LEDW[0][c]) * h2;
  } else if (kind === HOUSE) {
    for (let c = 0; c < 3; c++) C[c] = HOUSEC[c];
  } else {
    for (let c = 0; c < 3; c++) C[c] = FLOODC[c];
  }
  // Every lamp burns at full strength in its brightest channel.
  const m = 255 / max(C[0], C[1], C[2]);
  for (let c = 0; c < 3; c++) C[c] *= m;
}

export function draw(display, params) {
  const P = params;
  if (!P.built) return;
  const t = P.t;
  const k1 = P.k1;
  const haze = [1 - 0.18 * k1, 0.64 + 0.24 * k1, 0.36 + 0.64 * k1];
  const cloudT = [1 - 0.12 * k1, 0.8 + 0.12 * k1, 0.64 + 0.36 * k1];
  const water = [0.32, 0.5, 1];
  const wingT = [0.78, 0.84, 1];
  // Strobe: a double flash every 1.25 s.
  const ph = t % 1.25;
  const flash = ph < 0.05 || (ph > 0.15 && ph < 0.2) ? 1 : 0;
  // Cars: lane A runs with the ground, lane B against it, in cells along the lane.
  const vA = 0.9 * t;
  const vB = -0.9 * t;
  for (let y = 0; y < H; y++) {
    const wy = P.oy + y;
    const row = md(wy, H) * W;
    const gy = y >> 1;
    const fy = (y & 1) * 0.5;
    for (let x = 0; x < W; x++) {
      const wx = P.ox + x;
      const slot = (wx & 63) + row;
      const plus = ((x + y + P.p0) & 1) === 0;
      const gx = x >> 1;
      const fx = (x & 1) * 0.5;
      const ci = gx + gy * 33;
      const c0 = P.CL[ci] + (P.CL[ci + 1] - P.CL[ci]) * fx;
      const c1 = P.CL[ci + 33] + (P.CL[ci + 34] - P.CL[ci + 33]) * fx;
      const al = c0 + (c1 - c0) * fy;
      const wg = P.wing[x + y * W];
      let M;
      let tr;
      let tg;
      let tb;
      if (wg > 0) {
        const nd = (x - P.nav[0]) ** 2 + (y - P.nav[1]) ** 2;
        const sd = (x - P.strobe[0]) ** 2 + (y - P.strobe[1]) ** 2;
        M = wg + 80 * flash * exp(-sd / 60);
        const gl = 0.5 * exp(-nd / 10);
        tr = wingT[0] * (1 - gl);
        tg = wingT[1];
        tb = wingT[2] * (1 - gl * 0.6);
        let v = max(0, M + (plus ? 10 : -10));
        let r = tr * v;
        let g = tg * v;
        let b = tb * v;
        if (x === P.nav[0] && y === P.nav[1]) [r, g, b] = [40, 255, 90];
        else if (x === P.strobe[0] && y === P.strobe[1]) {
          if (flash) [r, g, b] = [255, 255, 255];
          else [r, g, b] = [70, 74, 86];
        }
        display.setPixel(x, y, min(255, r), min(255, g), min(255, b));
        continue;
      }
      const wt = P.WT[slot];
      M = P.MS[slot];
      // Ground, water and cloud tints mix, and the brightest channel is put
      // back to 1 so the mix never dims a step.
      tr = haze[0] + (water[0] - haze[0]) * wt;
      tg = haze[1] + (water[1] - haze[1]) * wt;
      tb = haze[2] + (water[2] - haze[2]) * wt;
      tr += (cloudT[0] - tr) * al;
      tg += (cloudT[1] - tg) * al;
      tb += (cloudT[2] - tb) * al;
      // The cells between the carpet's dots fall toward blue-black.
      if (!plus) {
        const nb = NIGHT * (1 - al);
        tr += (NB[0] - tr) * nb;
        tg += (NB[1] - tg) * nb;
        tb += (NB[2] - tb) * nb;
      }
      // Cloud lit from below by the town.
      const Lc = 0.55 * M + 14 + 210 * P.GA[x + y * W] + 24 * al;
      const G = M + (Lc - M) * al;
      const v = max(0, G + (plus ? AMP : -AMP)) / max(tr, tg, tb);
      let r = v * tr;
      let g = v * tg;
      let b = v * tb;
      if (plus) {
        let kind = P.KD[slot];
        let lb = P.LB[slot];
        let col = null;
        const dp = x + y + P.p0 - P.ph;
        if (dp === 0 || dp === 4) {
          // Carriageways: m counts cells along the lane.
          const m = (x - y + P.ox - P.oy) >> 1;
          const lane = dp === 0 ? 0 : 1;
          const slotK = floor(m + (lane ? vB : vA) + 0.5);
          if (h3(slotK, lane, P.seed + 21) < 0.45) {
            col = lane ? TAIL : HEAD;
            lb = 1;
          }
        }
        if (col || kind) {
          if (!col) {
            lampColour(kind, P.LH[slot], k1);
            col = C;
          }
          const h = P.LH[slot];
          const tw = lb * (0.97 + 0.03 * sin(t * (2.5 + 4 * h) + h * 40));
          const keep = 1 - 0.85 * al;
          r = col[0] * tw * keep + r * (1 - keep);
          g = col[1] * tw * keep + g * (1 - keep);
          b = col[2] * tw * keep + b * (1 - keep);
        }
      }
      display.setPixel(x, y, min(255, r), min(255, g), min(255, b));
    }
  }
}
