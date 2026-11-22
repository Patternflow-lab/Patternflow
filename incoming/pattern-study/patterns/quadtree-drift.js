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
// Knob 1: Hue. Turns the hue of every colour of the hidden scene round the wheel, the ink of the wedge excepted. At 0 the field is indigo, violet, magenta, coral, amber, lime, teal and azure with a cream disc, ring and hot band, and it opens on magenta, coral and amber; at 0.5 the coral has become cyan, the amber blue and the teal red; at 1 it is back at 0.
// Knob 2: Budget. How much error the coder lets one flat tile have, as the root mean square of the red, green and blue deviations from the tile's mean. The number is 60 at 0, 42 at 1, 29 at 2 (where it opens), 9 at 3 and 2.5 at 4, a tile of 32 LEDs being let off 1.45 times it and a tile of 4 LEDs none. At 0 the panel is eight flat slabs of 32 by 32 LEDs, at 1 about two thirds of it is still slab with 16 and 8 LED tiles on the edges, at 2 the tiles run from 32 to 2 LEDs (a tenth of the area in 32s, a third in 16s, a quarter in 8s, a quarter in 4s and 2s), and at 4 two thirds of the panel is 2 LED tiles. A tile splits above the number and merges again under 0.62 times it.
// Knob 3: Drift. How fast the scene under the tree moves, 2 to the power 1.5 times the knob times 1.8 scene seconds a second: 0.64 at -1, 1.8 at 0 and 5.1 at 1. At 0 the disc's sideways swing takes 24 s and its swing up and down 33 s, the wedge turns once in 13 s, the bar goes down the panel and back in 18 s and the colour field flows once through its palette in 63 s. The periods of the scene (23 to 114 scene seconds) have no common divisor, so the picture does not come back.
// Knob 4: Edges. How hard the moving shapes are. At -1 the edges of the disc, wedge and bar are 22 LEDs wide and half strength and the ring is not there, a cloud the tree cuts into a few middle-sized tiles. At 0.06 (where it opens) the edges are 3.4 LEDs wide at 0.89 strength, and at 1 they are 2 LEDs, the width of the smallest tile, at full strength, with the tree packing 2 LED tiles along every one of them.

// What the picture is. The panel is two root squares of 64 by 64 LEDs, one above the other, and each is cut once and then again and again down to 2 LEDs (32, 16, 8, 4, 2),
// which makes 2048 cells of 2 by 2 LEDs. Every frame the scene is sampled once per cell and three summed-area tables are built (the red, green and blue sums, and the sum of
// squares), so a node of the tree reads its mean colour and its error from four table entries each. The scene is never drawn. Each tile is flat in the mean colour of the scene
// beneath it, pushed 1.25 times out from its grey so that the mean of two colours does not go dull, and that is all that is shown. Tiles of 16 LEDs and up get a seam, a bottom and
// right row 0.32 darker; tiles of 8 get 0.55 of that, and smaller ones none, because a seam on every 4 LED tile was a grid over the whole panel.
// The scene. A field of colour on a palette of eight stops, indigo, violet, magenta, coral, amber, lime, teal and azure, each held flat for over half of its stretch and ramping to the next
// over the rest, so there are bands as well as ramps. It spans 0.56 of the palette from corner to corner, is bent by three sines, and flows through the palette once every 113.7 scene
// seconds. A cream hot band bends across it. Five blobs on Lissajous paths slide the palette position under them by 0.16 to 0.3 either way, so a blob is always a neighbour of the
// colour round it and the mean of the two never goes grey. Over those lie a cream disc (radius 11), a wedge of indigo ink turning on a pivot that drifts (half angle 0.45 rad, 40 LEDs long),
// a bar of the palette's colour 0.2 along from the field (9 LEDs thick, 68 long) that tilts and sweeps, and a thin cream ring (radius 16, 4.4 thick).
// The tree. A node splits when its error passes the budget and merges when it falls under 0.62 of it, and it keeps the new state for 0.4 s. The four children of a node that splits
// start in its colour and take their own over 0.34 to 0.5 s (the smaller the node the faster), and a merge runs the same way backwards, so no tile pops. The tree is read every
// frame, and the whole of it, drawing included, costs about 1 ms a frame.

const CW = 32, CH = 64, NC = CW * CH; // cells of 2 by 2 LEDs
const NL = 6; // levels: 64, 32, 16, 8, 4 and 2 LEDs
const SZ = [32, 16, 8, 4, 2, 1]; // a node's side in cells
const TAU = 6.283185307179586;
const { floor, sqrt, abs, exp, sin, cos, pow, min, max, atan2, PI, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (t) => t * t * (3 - 2 * t);

// ---- the coder
const BUDGET = [60, 42, 29, 9, 2.5]; // the error a flat tile may have at Budget 0, 1, 2, 3 and 4, between them on a log scale
const MERGE = 0.62; // a tile merges again under this share of the split error
const RATE = 1.8; // scene seconds for each second of the panel, at Drift 0
const SLACK = [1.5, 1.45, 1.3, 1.15, 1.0]; // a big node is let off more error than a small one: the budget is read as the error over this, by level
const SAT = 1.25; // a tile's colour is pushed this far out from its grey
const HOLD = 0.4; // seconds a node keeps a new state
const SETTLE = [0.5, 0.46, 0.42, 0.38, 0.34]; // seconds a split takes, by level
const SEAM = 0.32; // how much darker the bottom and right row of a tile is
const SEAM_W = [1, 1, 1, 0.55, 0]; // how much of the seam a tile of each level gets: 8 LEDs a little, 4 and 2 none

// ---- the hidden scene
// palette stops: position round the cycle, then the colour
const STOPS = [
  [0.0, 46, 30, 168], // indigo
  [0.12, 140, 48, 214], // violet
  [0.25, 234, 44, 150], // magenta
  [0.37, 255, 100, 80], // coral
  [0.48, 255, 182, 44], // amber
  [0.57, 170, 230, 60], // lime
  [0.68, 22, 194, 170], // teal
  [0.82, 38, 122, 232], // azure
  [1.0, 46, 30, 168], // indigo again
];
const HOT = [255, 232, 176];
const DEEP = [34, 18, 120]; // the wedge's ink stays indigo whatever the Hue, since a dark orange would read as brown
const PLATEAU = 0.45; // share of each stretch between stops that is a ramp, the rest is flat
// blobs: period x, period y, phase x, phase y, radius x, radius y, palette shift
const BLOBS = [
  [37.1, 53.7, 0.4, 1.2, 17, 13, 0.2],
  [43.9, 61.3, 2.1, 0.3, 14, 19, -0.24],
  [53.3, 41.9, 4.0, 2.7, 19, 15, 0.3],
  [61.7, 71.9, 5.2, 4.4, 15, 15, -0.18],
  [71.3, 49.7, 1.3, 5.6, 21, 12, 0.16],
];

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
// The hue goes round in HSV, so saturation and value stay where the palette put them.
function turn(c, hue) {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h + hue * 6) % 6;
  const f = (n) => {
    const k = (n + h) % 6;
    return 255 * (mx - d * max(0, min(k, 4 - k, 1)));
  };
  return [f(5), f(3), f(1)];
}

function buildLut(S, hue) {
  if (S.hueAt === hue) return;
  S.hueAt = hue;
  const lut = S.lut;
  let k = 0;
  for (let i = 0; i < 1024; i++) {
    const u = i / 1024;
    while (k < STOPS.length - 2 && u >= STOPS[k + 1][0]) k++;
    const a = STOPS[k], b = STOPS[k + 1], f = (u - a[0]) / (b[0] - a[0]);
    const t = ss(cl((f - (1 - PLATEAU) / 2) / PLATEAU, 0, 1));
    const c = turn([a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t], hue);
    lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2];
  }
  S.hot = turn(HOT, hue);
}

// ---- the scene, sampled at the centre of every cell
function sceneStep(S, edges) {
  const t = S.tt, lut = S.lut, hot = S.hot, cr = S.cr, cg = S.cg, cb = S.cb;
  const e = 1 - pow(1 - (edges + 1) / 2, 2); // 0 soft, 1 hard, and 0.78 where the knob opens
  const E = 2 * pow(11, 1 - e); // width of a shape's edge, LEDs
  const al = 0.5 + 0.5 * e;
  const A1 = (TAU * t) / 47.3, A2 = (TAU * t) / 71.9 + 1.3, A3 = (TAU * t) / 29.3 + 4.1;
  const flow = t / 113.7;
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
  const rgX = 32 + 24 * sin((TAU * t) / 73.3 + 5.1), rgY = 64 + 50 * sin((TAU * t) / 47.9 + 2.6), rgR = 16 + 3 * sin((TAU * t) / 35.3), rgT = 2.2;
  const ringAl = ss(cl((e - 0.3) / 0.5, 0, 1));
  for (let cy = 0; cy < CH; cy++) {
    const y = 2 * cy + 1;
    for (let cx = 0; cx < CW; cx++) {
      const x = 2 * cx + 1;
      let u = 0.42 * (y / 128) + 0.14 * (x / 64) + 0.08 * sin(0.08 * x + 0.04 * y + A1) + 0.06 * sin(0.05 * y - 0.1 * x + A2) + 0.025 * sin(0.17 * x + 0.11 * y + A3) + flow;
      // a blob slides the palette position under it, so its colour is always a neighbour of the field's
      for (let i = 0; i < nb; i++) {
        const B = BLOBS[i], dx = (x - bx[i]) / B[4], dy = (y - by[i]) / B[5], q = dx * dx + dy * dy;
        if (q < 5) u += B[6] * exp(-q);
      }
      let k = ((u * 1024) | 0) & 1023;
      let r = lut[k * 3], g = lut[k * 3 + 1], b = lut[k * 3 + 2];
      // the hot band lifts the colour toward a warm white
      const d = (x * bc + y * bs) - bOff + bAmp * sin(0.09 * (-bs * x + bc * y) + A2);
      const hb = exp(-(d * d) / 160) * 0.5;
      r += (hot[0] - r) * hb; g += (hot[1] - g) * hb; b += (hot[2] - b) * hb;
      // the disc
      let dx = x - dX, dy = y - dY;
      let cov = cl(0.5 - (sqrt(dx * dx + dy * dy) - dR) / E, 0, 1);
      if (cov > 0) {
        const w = ss(cov) * al;
        r += (hot[0] - r) * w; g += (hot[1] - g) * w; b += (hot[2] - b) * w;
      }
      // the wedge
      dx = x - wX; dy = y - wY;
      const rr = sqrt(dx * dx + dy * dy);
      if (rr < wR + E) {
        let da = abs(atan2(dy, dx) - wA) % TAU;
        if (da > PI) da = TAU - da;
        const o = da - wH;
        const sdA = o < 1.5 ? rr * sin(o) : rr;
        cov = cl(0.5 - max(sdA, rr - wR) / E, 0, 1);
        if (cov > 0) {
          k = (((u - 0.2) * 1024) | 0) & 1023;
          const w = ss(cov) * al;
          r += (DEEP[0] * 0.8 + lut[k * 3] * 0.12 - r) * w; g += (DEEP[1] * 0.8 + lut[k * 3 + 1] * 0.12 - g) * w; b += (DEEP[2] * 0.8 + lut[k * 3 + 2] * 0.12 - b) * w;
        }
      }
      // the bar
      dx = x - barX; dy = y - barY;
      const along = dx * bcx + dy * bsy, across = -dx * bsy + dy * bcx;
      cov = cl(0.5 - max(abs(across) - barHW, abs(along) - barL) / E, 0, 1);
      if (cov > 0) {
        k = (((u + 0.2) * 1024) | 0) & 1023;
        const w = ss(cov) * al;
        r += (min(255, lut[k * 3] * 1.12) - r) * w; g += (min(255, lut[k * 3 + 1] * 1.12) - g) * w; b += (min(255, lut[k * 3 + 2] * 1.12) - b) * w;
      }
      // the ring
      dx = x - rgX; dy = y - rgY;
      cov = cl(0.5 - (abs(sqrt(dx * dx + dy * dy) - rgR) - rgT) / E, 0, 1);
      if (cov > 0) {
        const w = ss(cov) * al * ringAl;
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
        if (!L) { V.st[n] = 1; continue; } // the two roots are always cut once
        if (P && !P.st[(j >> 1) * P.gx + (i >> 1)]) { V.st[n] = 0; V.hold[n] = 0; continue; }
        if (V.hold[n] > 0) V.hold[n] -= dt;
        const e = V.err[n] / SLACK[L];
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
  const bq = cl(kn[1], 0, 3.9999), bi = bq | 0, ts = exp(log(BUDGET[bi]) + (log(BUDGET[bi + 1]) - log(BUDGET[bi])) * (bq - bi));
  treeStep(S, dt, ts, ts * MERGE);
  settle(S, dt, snap);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  S.tt += d * RATE * pow(2, 1.5 * cl(kn[2], -1, 1));
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
      let n = cy >> 5, V = lv[0];
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
        for (let q = 0; q < NL - 1; q++) {
          const z = SZ[q], v = lf[q] * SEAM_W[q];
          if ((cx + 1) % z === 0 && cx < CW - 1 && v > sx) sx = v;
          if ((cy + 1) % z === 0 && cy < CH - 1 && v > sy) sy = v;
        }
      }
      const X = cx * 2, Y = cy * 2;
      // a mean of two colours is greyer than either, so the tile is pushed back out from its grey
      const yl = 0.299 * r + 0.587 * g + 0.114 * b;
      const r0 = cl(yl + (r - yl) * SAT, 0, 255), g0 = cl(yl + (g - yl) * SAT, 0, 255), b0 = cl(yl + (b - yl) * SAT, 0, 255);
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
