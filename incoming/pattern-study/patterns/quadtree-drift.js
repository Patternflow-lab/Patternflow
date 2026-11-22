// ===== Patternflow pattern =====
// Title:   Quadtree Drift
// Family:  quadtree
// Idea:    A quadtree image coder looks at a colourful drifting scene it never shows, keeps one flat colour for every square it can, and splits a square into four only where the scene under it is too uneven, so big flat tiles sit on the smooth colour and small ones gather along the edges of a disc, a wedge and a bar, splitting and merging as they move.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the quadtree (Raphael Finkel and Jon Bentley, 1974) used as an image coder that splits a square while one flat colour fits it badly, with each square's error read from summed-area tables (Franklin Crow, 1984); pattern round 221
// Round:   221
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Budget=0..4, Drift=-1..1, Edges=-1..1
//
// Knob 1: Hue. Turns every colour of the hidden scene round the wheel at once. At 0 the field runs indigo, magenta, coral, amber and lime with a pale hot band across it, at 0.33 it is teal, blue and violet, at 0.66 magenta and gold, and 1 is 0 again.
// Knob 2: Budget. How much error the coder lets one flat tile have, as the root mean square of the three channels. At 0 it is 90, so the panel is a handful of tiles 16 to 32 LEDs across, at 2 (where it opens) it is 14, so smooth colour sits in tiles of 8 to 16 and the edges are cut down to 2 LEDs, and at 4 it is 2.2 and the whole panel is a mosaic of 2 and 4 LED tiles. A tile splits above the number and merges again below 0.62 times it.
// Knob 3: Drift. How fast the scene under the tree moves, 2 to the power 1.5 times the knob: 0.35 times the opening speed at -1 and 2.8 times at 1. At 0 the disc takes 43 s and 59 s for one swing across and down, the wedge turns once in 23 s and the bar sweeps in 32 s, and the blobs and the colour field have periods that do not divide these, so the picture does not come back.
// Knob 4: Edges. How hard the moving shapes are. At -1 they are 22 LEDs of soft edge and half strength, a cloud of colour that the tree cuts into a few middle-sized tiles. At 1 the disc, the wedge and the bar have 2 LED edges at full strength, and the tree packs small tiles along every one of them.

// What the picture is. The panel is two root squares of 64 by 64 LEDs, one above the other. Each is cut into four squares again and again down to 2 LEDs (32, 16, 8, 4, 2),
// which makes 2048 cells of 2 by 2 LEDs. Every frame the scene is sampled once per cell, three summed-area tables are built (the red, green and blue sums and the sum
// of squares), and each node of the tree reads its mean colour and its error from four table entries. The scene is never drawn. Each tile is flat in the mean colour of
// the scene beneath it, and that is all that is shown.
// The scene. A field of colour on a palette of eight stops (indigo, azure, teal, lime, amber, coral, magenta, violet, each held for a stretch before it moves to the next, so that
// there are flat bands as well as ramps), warped by two slow sines and flowing through the palette once every 157 s. A pale hot band bends across it. Six soft blobs
// drift on Lissajous paths with periods of 37 to 79 s, each in the colour half a turn or so away from the field under it. Over those a disc (radius 11), a wedge
// turning on a pivot that drifts (half angle 0.45 rad, 40 LEDs long) and a bar 9 LEDs thick and 68 long that tilts and sweeps. The shapes take the colour opposite the field under them.
// The tree. A node splits when its error passes the budget and merges when it falls under 0.62 of it, and it holds the new state for 0.4 s before it may change again. The
// four children of a node that splits start in its colour and take their own over 0.3 to 0.5 s, and a merge runs the same way backwards, so no tile pops.

const W = 64, H = 128;
const CW = 32, CH = 64, NC = CW * CH; // cells of 2 by 2 LEDs
const NL = 6; // levels: 64, 32, 16, 8, 4 and 2 LEDs
const SZ = [32, 16, 8, 4, 2, 1]; // a node's side in cells
const TAU = 6.283185307179586;
const { floor, sqrt, abs, exp, sin, cos, pow, min, max, atan2, PI, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (t) => t * t * (3 - 2 * t);

// ---- the coder
const BUDGET_HI = 90, BUDGET_LO = 2.2; // the error a flat tile may have, at Budget 0 and 4
const MERGE = 0.62; // a tile merges again under this share of the split error
const HOLD = 0.4; // seconds a node keeps a new state
const SETTLE = [0.5, 0.46, 0.42, 0.38, 0.34]; // seconds a split takes, by level
const SEAM = 0.0; // how much darker the bottom and right row of a tile is
const SEAM_MIN = 3; // the smallest tile with a seam, as a level (3 is 8 LEDs)

// ---- the hidden scene
const STOPS = [
  [40, 28, 170], // indigo
  [34, 120, 236], // azure
  [10, 196, 168], // teal
  [168, 236, 44], // lime
  [255, 176, 28], // amber
  [255, 92, 72], // coral
  [236, 30, 146], // magenta
  [142, 42, 212], // violet
];
const HOT = [255, 232, 176];
const PLATEAU = 0.5; // share of each palette stop that is flat
// blobs: period x, period y, phase x, phase y, radius x, radius y, colour offset, strength
const BLOBS = [
  [37.1, 53.7, 0.4, 1.2, 15, 11, 0.42, 0.9],
  [43.9, 61.3, 2.1, 0.3, 12, 17, 0.58, 0.85],
  [53.3, 41.9, 4.0, 2.7, 17, 13, 0.34, 0.85],
  [61.7, 71.9, 5.2, 4.4, 13, 13, 0.66, 0.9],
  [71.3, 47.3, 1.3, 5.6, 19, 10, 0.5, 0.8],
  [79.1, 67.1, 3.3, 3.1, 11, 19, 0.28, 0.85],
];
const HUE_MAT = new Float32Array(9);

function makeState() {
  const lv = [];
  for (let L = 0; L < NL; L++) {
    const gx = 1 << L, gy = 2 << L, n = gx * gy;
    lv.push({
      gx, gy, n,
      mr: new Float32Array(n), mg: new Float32Array(n), mb: new Float32Array(n),
      err: new Float32Array(n), st: new Uint8Array(n),
      hold: new Float32Array(n), a: new Float32Array(n), ea: new Float32Array(n),
    });
  }
  const sn = (CW + 1) * (CH + 1);
  return {
    ready: false, tt: 0, kn: [0, 2, 0, 0.06],
    lv,
    cr: new Float32Array(NC), cg: new Float32Array(NC), cb: new Float32Array(NC),
    sr: new Float64Array(sn), sg: new Float64Array(sn), sb: new Float64Array(sn), sq: new Float64Array(sn),
    lut: new Float32Array(1024 * 3), hot: [255, 232, 176], hueAt: -1,
  };
}

export function setup(params) {
  params.s = makeState();
}

// ---- colour: the palette as a table of 1024, turned by the Hue knob
function hueMatrix(hue) {
  const A = TAU * hue, c = cos(A), s = sin(A), m = HUE_MAT;
  m[0] = 0.213 + c * 0.787 - s * 0.213; m[1] = 0.715 - c * 0.715 - s * 0.715; m[2] = 0.072 - c * 0.072 + s * 0.928;
  m[3] = 0.213 - c * 0.213 + s * 0.143; m[4] = 0.715 + c * 0.285 + s * 0.14; m[5] = 0.072 - c * 0.072 - s * 0.283;
  m[6] = 0.213 - c * 0.213 - s * 0.787; m[7] = 0.715 - c * 0.715 + s * 0.715; m[8] = 0.072 + c * 0.928 + s * 0.072;
}

function buildLut(S, hue) {
  if (S.hueAt === hue) return;
  S.hueAt = hue;
  hueMatrix(hue);
  const m = HUE_MAT, lut = S.lut, n = STOPS.length;
  for (let i = 0; i < 1024; i++) {
    const u = (i / 1024) * n, k = floor(u), f = u - k;
    const a = STOPS[k % n], b = STOPS[(k + 1) % n];
    const t = ss(cl((f - (0.5 - (1 - PLATEAU) / 2)) / (1 - PLATEAU), 0, 1));
    const r = a[0] + (b[0] - a[0]) * t, g = a[1] + (b[1] - a[1]) * t, bl = a[2] + (b[2] - a[2]) * t;
    lut[i * 3] = cl(r * m[0] + g * m[1] + bl * m[2], 0, 255);
    lut[i * 3 + 1] = cl(r * m[3] + g * m[4] + bl * m[5], 0, 255);
    lut[i * 3 + 2] = cl(r * m[6] + g * m[7] + bl * m[8], 0, 255);
  }
  S.hot = [
    cl(HOT[0] * m[0] + HOT[1] * m[1] + HOT[2] * m[2], 0, 255),
    cl(HOT[0] * m[3] + HOT[1] * m[4] + HOT[2] * m[5], 0, 255),
    cl(HOT[0] * m[6] + HOT[1] * m[7] + HOT[2] * m[8], 0, 255),
  ];
}

// ---- the scene, sampled at the centre of every cell
function sceneStep(S, edges) {
  const t = S.tt, lut = S.lut, hot = S.hot, cr = S.cr, cg = S.cg, cb = S.cb;
  const e = (edges + 1) / 2; // 0 soft, 1 hard
  const E = 2 * pow(11, 1 - e); // width of a shape's edge, LEDs
  const al = 0.5 + 0.5 * e;
  const A1 = (TAU * t) / 47.3, A2 = (TAU * t) / 71.9 + 1.3, A3 = (TAU * t) / 29.3 + 4.1;
  const flow = t / 157.3;
  // the hot band
  const bc = 0.62, bs = 0.78;
  const bOff = 78 + 36 * sin((TAU * t) / 61.1), bAmp = 9 * sin((TAU * t) / 33.7 + 0.6);
  // the blobs
  const nb = BLOBS.length, bx = new Float32Array(nb), by = new Float32Array(nb);
  for (let i = 0; i < nb; i++) {
    const B = BLOBS[i];
    bx[i] = 32 + 28 * sin((TAU * t) / B[0] + B[2]);
    by[i] = 64 + 54 * sin((TAU * t) / B[1] + B[3]);
  }
  // the disc, the wedge and the bar
  const dX = 32 + 22 * sin((TAU * t) / 43.1 + 0.4), dY = 64 + 52 * sin((TAU * t) / 59.3 + 1.9), dR = 11 + 1.5 * sin((TAU * t) / 27.7);
  const wX = 32 + 20 * sin((TAU * t) / 67.7 + 2.2), wY = 64 + 42 * sin((TAU * t) / 37.9 + 0.7), wA = (TAU * t) / 23.3, wH = 0.45, wR = 40;
  const barA = 0.5 + 0.8 * sin((TAU * t) / 89.3 + 0.9), bcx = cos(barA), bsy = sin(barA);
  const barX = 32 + 12 * sin((TAU * t) / 53.9), barY = 64 + 56 * sin((TAU * t) / 31.9 + 3.1);
  const barHW = 4.5, barL = 34;
  for (let cy = 0; cy < CH; cy++) {
    const y = 2 * cy + 1;
    for (let cx = 0; cx < CW; cx++) {
      const x = 2 * cx + 1;
      const u = 0.55 * (y / 128) + 0.22 * (x / 64) + 0.15 * sin(0.1 * x + 0.05 * y + A1) + 0.11 * sin(0.065 * y - 0.12 * x + A2) + 0.05 * sin(0.17 * x + 0.11 * y + A3) + flow;
      let k = ((u * 1024) | 0) & 1023;
      let r = lut[k * 3], g = lut[k * 3 + 1], b = lut[k * 3 + 2];
      // hot band
      const d = (x * bc + y * bs) - bOff + bAmp * sin(0.09 * (-bs * x + bc * y) + A2);
      const hb = exp(-(d * d) / 110) * 0.7;
      r += (hot[0] - r) * hb; g += (hot[1] - g) * hb; b += (hot[2] - b) * hb;
      // blobs
      for (let i = 0; i < nb; i++) {
        const B = BLOBS[i], dx = (x - bx[i]) / B[4], dy = (y - by[i]) / B[5], q = dx * dx + dy * dy;
        if (q > 5) continue;
        k = (((u + B[6]) * 1024) | 0) & 1023;
        const w = exp(-q) * B[7];
        r += (lut[k * 3] - r) * w; g += (lut[k * 3 + 1] - g) * w; b += (lut[k * 3 + 2] - b) * w;
      }
      // the disc
      let dx = x - dX, dy = y - dY;
      let cov = cl(0.5 - (sqrt(dx * dx + dy * dy) - dR) / E, 0, 1);
      if (cov > 0) {
        k = (((u + 0.5) * 1024) | 0) & 1023;
        const w = ss(cov) * al;
        r += (min(255, lut[k * 3] * 1.1 + 20) - r) * w; g += (min(255, lut[k * 3 + 1] * 1.1 + 20) - g) * w; b += (min(255, lut[k * 3 + 2] * 1.1 + 20) - b) * w;
      }
      // the wedge
      dx = x - wX; dy = y - wY;
      const rr = sqrt(dx * dx + dy * dy);
      if (rr < wR + E) {
        let da = abs(atan2(dy, dx) - wA) % TAU;
        if (da > PI) da = TAU - da;
        const o = da - wH;
        const sdA = o < 0 ? rr * sin(o) : o < 1.5 ? rr * sin(o) : rr;
        cov = cl(0.5 - max(sdA, rr - wR) / E, 0, 1);
        if (cov > 0) {
          k = (((u + 0.33) * 1024) | 0) & 1023;
          const w = ss(cov) * al;
          r += (lut[k * 3] - r) * w; g += (lut[k * 3 + 1] - g) * w; b += (lut[k * 3 + 2] - b) * w;
        }
      }
      // the bar
      dx = x - barX; dy = y - barY;
      const along = dx * bcx + dy * bsy, across = -dx * bsy + dy * bcx;
      cov = cl(0.5 - max(abs(across) - barHW, abs(along) - barL) / E, 0, 1);
      if (cov > 0) {
        const w = ss(cov) * al;
        r += (hot[0] - r) * w; g += (hot[1] - g) * w; b += (hot[2] - b) * w;
      }
      const i = cy * CW + cx;
      cr[i] = r; cg[i] = g; cb[i] = b;
    }
  }
}

// ---- the summed-area tables and the tree
function buildTables(S) {
  const st = CW + 1, { sr, sg, sb, sq, cr, cg, cb } = S;
  for (let y = 0; y < CH; y++) {
    let ar = 0, ag = 0, ab = 0, aq = 0;
    for (let x = 0; x < CW; x++) {
      const i = y * CW + x, r = cr[i], g = cg[i], b = cb[i];
      ar += r; ag += g; ab += b; aq += r * r + g * g + b * b;
      const o = (y + 1) * st + x + 1, p = y * st + x + 1;
      sr[o] = sr[p] + ar; sg[o] = sg[p] + ag; sb[o] = sb[p] + ab; sq[o] = sq[p] + aq;
    }
  }
}

function nodeStats(S) {
  const st = CW + 1, { sr, sg, sb, sq } = S;
  for (let L = 0; L < NL; L++) {
    const V = S.lv[L], s = SZ[L], inv = 1 / (s * s);
    for (let j = 0; j < V.gy; j++) {
      for (let i = 0; i < V.gx; i++) {
        const x0 = i * s, y0 = j * s, x1 = x0 + s, y1 = y0 + s;
        const a = y1 * st + x1, b = y0 * st + x1, c = y1 * st + x0, d = y0 * st + x0;
        const mr = (sr[a] - sr[b] - sr[c] + sr[d]) * inv, mg = (sg[a] - sg[b] - sg[c] + sg[d]) * inv, mb = (sb[a] - sb[b] - sb[c] + sb[d]) * inv;
        const n = j * V.gx + i;
        V.mr[n] = mr; V.mg[n] = mg; V.mb[n] = mb;
        if (L < NL - 1) {
          const v = (sq[a] - sq[b] - sq[c] + sq[d]) * inv - (mr * mr + mg * mg + mb * mb);
          V.err[n] = sqrt(max(v, 0) / 3);
        }
      }
    }
  }
}

function treeStep(S, dt, ts, tm) {
  for (let L = 0; L < NL - 1; L++) {
    const V = S.lv[L], P = L ? S.lv[L - 1] : null;
    for (let j = 0; j < V.gy; j++) {
      for (let i = 0; i < V.gx; i++) {
        const n = j * V.gx + i;
        if (P && !P.st[(j >> 1) * P.gx + (i >> 1)]) { V.st[n] = 0; V.hold[n] = 0; continue; }
        if (V.hold[n] > 0) V.hold[n] -= dt;
        const e = V.err[n];
        if (V.st[n]) {
          if (e < tm && V.hold[n] <= 0) { V.st[n] = 0; V.hold[n] = HOLD; }
        } else if (e > ts && V.hold[n] <= 0) {
          V.st[n] = 1; V.hold[n] = HOLD;
        }
      }
    }
  }
}

function settle(S, dt, snap) {
  for (let L = 0; L < NL - 1; L++) {
    const V = S.lv[L], rate = dt / SETTLE[L];
    for (let n = 0; n < V.n; n++) {
      const tgt = V.st[n];
      let a = V.a[n];
      if (snap) a = tgt;
      else if (a < tgt) a = min(tgt, a + rate);
      else if (a > tgt) a = max(tgt, a - rate);
      V.a[n] = a;
      V.ea[n] = ss(a);
    }
  }
}

function frame(S, dt, snap) {
  const kn = S.kn;
  buildLut(S, cl(kn[0], 0, 1));
  sceneStep(S, cl(kn[3], -1, 1));
  buildTables(S);
  nodeStats(S);
  const b = cl(kn[1] / 4, 0, 1), ts = exp(log(BUDGET_HI) + (log(BUDGET_LO) - log(BUDGET_HI)) * b);
  treeStep(S, dt, ts, ts * MERGE);
  settle(S, dt, snap);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  S.tt += d * pow(2, 1.5 * cl(kn[2], -1, 1));
  if (!S.ready) {
    S.ready = true;
    S.tt = 11;
    frame(S, 0, true);
    return;
  }
  frame(S, d, false);
}

// ---- drawing: every cell is its level 0 colour plus the steps the finer levels have grown
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const lv = S.lv, lf = [0, 0, 0, 0, 0];
  for (let cy = 0; cy < CH; cy++) {
    for (let cx = 0; cx < CW; cx++) {
      let n = (cy >> 5) * 1 + (cx >> 5), V = lv[0];
      let r = V.mr[n], g = V.mg[n], b = V.mb[n], w = 1;
      let L = 0;
      for (; L < NL - 1; L++) {
        V = lv[L];
        n = (cy >> (5 - L)) * V.gx + (cx >> (5 - L));
        const s = V.ea[n];
        lf[L] = w * (1 - s);
        w *= s;
        if (w < 0.002) { for (let q = L + 1; q < NL - 1; q++) lf[q] = 0; break; }
        const C = lv[L + 1], c = (cy >> (4 - L)) * C.gx + (cx >> (4 - L));
        r += w * (C.mr[c] - V.mr[n]); g += w * (C.mg[c] - V.mg[n]); b += w * (C.mb[c] - V.mb[n]);
      }
      let sx = 0, sy = 0;
      if (SEAM > 0) {
        for (let q = 0; q <= SEAM_MIN; q++) {
          const z = SZ[q];
          if ((cx + 1) % z === 0 && cx < CW - 1 && lf[q] > sx) sx = lf[q];
          if ((cy + 1) % z === 0 && cy < CH - 1 && lf[q] > sy) sy = lf[q];
        }
      }
      const X = cx * 2, Y = cy * 2;
      const r0 = cl(r, 0, 255), g0 = cl(g, 0, 255), b0 = cl(b, 0, 255);
      if (sx === 0 && sy === 0) {
        const ri = r0 | 0, gi = g0 | 0, bi = b0 | 0;
        display.setPixel(X, Y, ri, gi, bi); display.setPixel(X + 1, Y, ri, gi, bi);
        display.setPixel(X, Y + 1, ri, gi, bi); display.setPixel(X + 1, Y + 1, ri, gi, bi);
      } else {
        const fx = 1 - SEAM * sx, fy = 1 - SEAM * sy, fb = min(fx, fy);
        display.setPixel(X, Y, r0 | 0, g0 | 0, b0 | 0);
        display.setPixel(X + 1, Y, (r0 * fx) | 0, (g0 * fx) | 0, (b0 * fx) | 0);
        display.setPixel(X, Y + 1, (r0 * fy) | 0, (g0 * fy) | 0, (b0 * fy) | 0);
        display.setPixel(X + 1, Y + 1, (r0 * fb) | 0, (g0 * fb) | 0, (b0 * fb) | 0);
      }
    }
  }
}
