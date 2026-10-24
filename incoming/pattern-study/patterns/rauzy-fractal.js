// ===== Patternflow pattern =====
// Title:   Rauzy Fractal
// Family:  fractal
// Idea:    The self-replicating tiling of the tribonacci fractal, copies of the fractal at three sizes, zooms for ever into its fixed point; each tile grows into the next size up, and a ring running out from the middle splits the biggest into their three pieces.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Rauzy fractal of the tribonacci substitution (Gérard Rauzy, 1982), pattern round 28
// Round:   28
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Depth=1..4, Glow=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the young (smallest) tiles are magenta, the middle ones blue and the old ones cyan, and each tile's three pieces are three shades of its colour.
// Knob 2: Speed. How fast it zooms. At 2 the picture grows by 1/|beta| = 1.356 every five seconds, turning 4.7 degrees, and after three such levels it is the same picture again; at 0.2 a level takes fifty seconds, at 3 a little over three.
// Knob 3: Depth. How many levels of pieces a tile shows. At 1 only its own three pieces; each step up shades the pieces inside those pieces, four levels at 4.
// Knob 4: Glow. At 0 the seams between tiles are dark lines. Turning it up dims the tiles and lights the seams, until at 1 the fractal outlines glow pale on a dark ground.
// Buttons: K1 tap runs the domain exchange. The zoom stops, the three pieces of every tile slide along their own vectors and lock into the same outline in a new order, and a second later they take the colours of the pieces they now lie in.

const W = 64, H = 128, N = W * H, CX = 32, CY = 64;
const { min, floor, ceil, sqrt, cos, sin, atan2, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The tribonacci constant TH, the real root of x^3 = x^2 + x + 1, and beta,
// one of the other two roots, |beta| = 1/sqrt(TH) = 0.7374.
let TH = 2;
for (let i = 0; i < 40; i++) TH -= (TH ** 3 - TH * TH - TH - 1) / (3 * TH * TH - 2 * TH - 1);
const BR = (1 - TH) / 2, BI = sqrt(1 / TH - BR * BR), BM = sqrt(BR * BR + BI * BI), BA = atan2(BI, BR);
// The substitution 1 -> 12, 2 -> 13, 3 -> 1 counts letters with the matrix
// M = [[1,1,1],[1,0,0],[0,1,0]]. A vector v of letter counts lands in the
// contracting plane as z(v) = v1 + v2 (beta - 1) + v3 / beta, and z(M v) is
// beta z(v). ZX, ZY are z of one letter 1, 2 or 3.
const ZX = [1, BR - 1, BR * TH], ZY = [0, BI, -BI * TH];
// The lattice of z(v) with v1 + v2 + v3 = 0, spanned by z(e2 - e3), z(e3 - e1).
const AX = ZX[1] - ZX[2], AY = ZY[1] - ZY[2], BX = ZX[2] - 1, BY = ZY[2], DET = AX * BY - AY * BX;
// The height along the expanding direction, h(v) = TH v1 + (TH^2 - TH) v2 + v3,
// written as AL (v1 + v2 + v3) + HX Re z(v) + HY Im z(v).
const LH = [TH, TH * TH - TH, 1];
const [AL, HX, HY] = (() => {
  const m = [0, 1, 2].map((j) => [1, ZX[j], ZY[j]]);
  const d3 = (a, b, c) => a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  const D = d3(m[0], m[1], m[2]), col = (k) => m.map((r, j) => r.map((v, q) => (q === k ? LH[j] : v)));
  return [0, 1, 2].map((k) => { const c = col(k); return d3(c[0], c[1], c[2]) / D; });
})();

// The fixed word 1213121121312... and where each prefix lands. A torus cell
// (the plane modulo the lattice, G x G cells) remembers the letter after a
// prefix landing in it and, two bits a letter, the letters of its ancestors
// under the substitution: the piece, then the piece of the piece, sixteen
// deep. KA, KB say which copy of the fractal the prefix fell in.
const G = 256, GM = G - 1, NW = 160000;
const CH = new Int32Array(G * G), KA = new Int8Array(G * G), KB = new Int8Array(G * G);
let HR0 = 1e9, HR1 = -1e9, MX = 0, MY = 0;
{
  const ch = new Int32Array(NW);
  let n = 0;
  for (let m = 0; n < NW; m++) {
    const a = ch[m] & 3, up = ch[m] << 2;
    ch[n++] = up;
    if (a < 2 && n < NW) ch[n++] = up | (a + 1);
  }
  let x = 0, y = 0;
  for (let i = 0; i < NW; i++) {
    const a = (x * BY - y * BX) / DET, b = (AX * y - AY * x) / DET, fa = floor(a), fb = floor(b);
    const c = min(GM, floor((a - fa) * G)) + min(GM, floor((b - fb) * G)) * G;
    CH[c] = ch[i];
    KA[c] = fa;
    KB[c] = fb;
    const hr = HX * x + HY * y;
    if (hr < HR0) HR0 = hr;
    if (hr > HR1) HR1 = hr;
    const l = ch[i] & 3;
    MX += x / NW;
    MY += y / NW;
    x += ZX[l];
    y += ZY[l];
  }
}

// The middle of R is MX, MY; R_1 = beta R, R_2 = beta^2 R + 1 and
// R_3 = beta^3 R + beta + 1, and CEN holds their middles.
const CEN = [];
{
  let x = MX, y = MY;
  for (let i = 0; i < 3; i++) {
    [x, y] = [BR * x - BI * y, BI * x + BR * y];
    CEN.push(x + (i > 0 ? 1 : 0) + (i > 1 ? BR : 0), y + (i > 1 ? BI : 0));
  }
}

// The self-replicating tiling: a copy z(v) + R_i of piece i for every
// v in Z^3 with 0 <= h(v) < h(e_i). The pieces are R scaled by beta, beta^2
// and beta^3, so every tile is the fractal itself at one of three sizes.
// For a point p, the copy of piece i holding it has z(v) = p - r with r in
// R, and only two or three counts v1 + v2 + v3 = k can pass the height test.
let TCH = 0, TID = 0, TX = 0, TY = 0;
function tile(px, py) {
  const cp = HX * px + HY * py, k1 = (HR1 - cp + LH[0]) / AL;
  for (let k = ceil((HR0 - cp) / AL - 1e-6); k <= k1; k++) {
    const qx = px - k, a = (qx * BY - py * BX) / DET, b = (AX * py - AY * qx) / DET;
    const fa = floor(a), fb = floor(b), c = (floor((a - fa) * G) & GM) + (floor((b - fb) * G) & GM) * G;
    const ta = fa - KA[c], tb = fb - KB[c], ch = CH[c], t = ch & 3;
    const v1 = k - tb, v2 = ta, v3 = tb - ta, h = LH[0] * v1 + LH[1] * v2 + v3;
    if (h >= 0 && h < LH[t]) {
      TCH = ch;
      TID = ((v1 * 1024 + v2) * 1024 + v3) * 4 + t;
      TX = v1 * ZX[0] + v2 * ZX[1] + v3 * ZX[2] + CEN[t * 2];
      TY = v1 * ZY[0] + v2 * ZY[1] + v3 * ZY[2] + CEN[t * 2 + 1];
      return t;
    }
  }
  return -1;
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  for (let c = 0; c < 3; c++) out[o + c] = rgb[c] * 255;
}

// A tile's colour follows its age. The smallest tiles (copies of piece 3)
// are young, piece 2 middle-aged, piece 1 old; a level of zoom later each
// has grown into the next, and the old ones have split into three. Hue,
// saturation and value at ages 0, 1 and 2; LUT holds them from age -1 to 2.5
// for each of a tile's own three pieces, which turn the hue by PH and light
// it by PV.
const AGE = [
  [0.86, 0.8, 0.85],
  [0.68, 0.85, 0.95],
  [0.5, 0.9, 1],
];
const PH = [0, 0.035, -0.03], PV = [1, 0.7, 0.48];
const LN = 71, LA = -1, LS = 0.05;

// The domain exchange: piece j of R moves by z(e_j), and the three land in
// R again. A tile of type t is R scaled by beta^(t+1), so its pieces move by
// beta^(t+1) z(e_j), EV[t*6 + j*2].
const EV = [];
{
  let x = 1, y = 0;
  for (let t = 0; t < 3; t++) {
    [x, y] = [BR * x - BI * y, BI * x + BR * y];
    for (let j = 0; j < 3; j++) EV.push(x * ZX[j] - y * ZY[j], x * ZY[j] + y * ZX[j]);
  }
}

// LEDs a unit of the plane at the start of a level, the turn of the view per
// level (a turn of beta less a third of a full turn, so three levels close
// the loop), how far the splitting ring runs in a level, and the exchange's
// slide, hold and settle in seconds.
const S0 = 24, ROT = BA - (2 * PI) / 3, RING = 140, EX1 = 1.5, EX2 = 2.3, EXT = 3.3;

export function setup(params) {
  params.s = { m: 0, f: 0, ex: -1, hue: 0, depth: 1, glow: 0.06, id: new Float64Array(N), buf: new Float32Array(N * 3), lut: new Float32Array(3 * LN * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.depth = cl(k[2], 1, 4);
  P.glow = cl(k[3], 0, 1);
  if (P.ex >= 0) {
    P.ex += d;
    if (P.ex > EXT) P.ex = -1;
  } else {
    P.f += d * cl(k[1], 0.2, 3) * 0.1;
    if (P.f >= 1) (P.f -= 1), (P.m = (P.m + 1) % 3);
    if (input.btnPressed && input.btnPressed[0]) P.ex = 0;
  }
}

// The light of a point from the pieces it lies in, level by level from
// letter kk down; a piece of type s splits again s + 1 letters lower.
function tone(ch, kk, D) {
  let v = 1;
  for (let n = 2; n <= 5 && kk < 16; n++) {
    const s = (ch >> (2 * kk)) & 3, w = cl(D + 1 - n, 0, 1) * 0.5;
    v *= 1 - w * (1 - PV[s]);
    kk += 1 + s;
  }
  return v;
}

// The colour of the plane point (px, py) into CR, CG, CB, and its tile (and
// once split, its piece) into CID. Returns the tile's type, or -1 on the
// rare point the table cannot place.
let CR = 0, CG = 0, CB = 0, CID = 0;
function shade(px, py, f, ring, sc, D, lut) {
  const t = tile(px, py);
  if (t < 0) return -1;
  const ch = TCH, s1 = (ch >> (2 * t + 2)) & 3;
  let a = t ? 2 - t + f : 2, v = tone(ch, t + 2 + s1, D), li = (s1 * LN + round((a - LA) / LS)) * 3;
  CID = TID * 4;
  if (t === 0) {
    // An old tile splits as the ring passes its middle: each piece takes
    // the colour of the young tile it becomes, with a flash.
    const sp = cl((ring - sqrt(TX * TX + TY * TY) / sc) / 16, 0, 1);
    if (sp > 0) {
      const s2 = (ch >> (4 + 2 * s1)) & 3, a2 = 1 - s1 + f, v2 = tone(ch, 3 + s1 + s2, D) * (1 + 1.4 * sp * (1 - sp));
      const l2 = (s2 * LN + cl(round((a2 - LA) / LS), 0, LN - 1)) * 3, u = 1 - sp;
      CR = (lut[li] * v * u + lut[l2] * v2 * sp);
      CG = (lut[li + 1] * v * u + lut[l2 + 1] * v2 * sp);
      CB = (lut[li + 2] * v * u + lut[l2 + 2] * v2 * sp);
      if (sp > 0.5) CID += s1 + 1;
      return 0;
    }
  }
  CR = lut[li] * v;
  CG = lut[li + 1] * v;
  CB = lut[li + 2] * v;
  return t;
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const f = P.f, sc = BM ** f / S0, an = ROT * f - ((2 * PI) / 3) * P.m, co = cos(an) * sc, si = sin(an) * sc;
  const ID = P.id, buf = P.buf, lut = P.lut, D = P.depth, ring = (f - 0.04) * RING;
  for (let s = 0; s < 3; s++)
    for (let i = 0; i < LN; i++) {
      const a = cl(LA + i * LS, 0, 2), j = min(1, floor(a)), u = a - j, A = AGE[j], B = AGE[j + 1], young = cl(1 + (LA + i * LS) * 0.4, 0.6, 1);
      hsv(P.hue + A[0] + (B[0] - A[0]) * u + PH[s], A[1] + (B[1] - A[1]) * u, (A[2] + (B[2] - A[2]) * u) * young * PV[s], lut, (s * LN + i) * 3);
    }
  // While the pieces slide, each LED looks for a piece that has arrived on
  // it: a point q of a type-t tile in piece j with q + slide = p.
  const ex = P.ex, sl = ex < 0 ? 0 : sstep(0, EX1, ex), back = ex < 0 ? 1 : sstep(EX2, EXT, ex);
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const X = x + 0.5 - CX, Y = y + 0.5 - CY, px = co * X - si * Y, py = si * X + co * Y, o = p * 3;
      let r = 0, g = 0, b = 0, id = -1;
      if (back < 1)
        for (let e = 0; e < 18 && id < 0; e += 2) {
          const t = (e / 6) | 0;
          if (shade(px - sl * EV[e], py - sl * EV[e + 1], f, ring, sc, D, lut) === t && ((TCH >> (2 * t + 2)) & 3) === (e % 6) / 2)
            (r = CR), (g = CG), (b = CB), (id = TID * 32 + 1 + e);
        }
      if (back > 0 && (shade(px, py, f, ring, sc, D, lut) >= 0 || shade(px + 0.3 * sc, py, f, ring, sc, D, lut) >= 0)) {
        r += (CR - r) * back;
        g += (CG - g) * back;
        b += (CB - b) * back;
        if (back > 0.5) id = CID;
      }
      ID[p] = id;
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
    }
  // A seam between tiles: dark at Glow 0, pale light at 1.
  const gl = P.glow, dim = 1 - 0.55 * gl;
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const s = (x < W - 1 && ID[p + 1] !== ID[p]) || (y < H - 1 && ID[p + W] !== ID[p]), o = p * 3;
      for (let c = 0; c < 3; c++) {
        const v = min(255, buf[o + c]) * dim;
        buf[o + c] = s ? v * (0.12 + 0.3 * gl) + 170 * gl : v;
      }
    }
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, buf[p], buf[p + 1], buf[p + 2]);
}
