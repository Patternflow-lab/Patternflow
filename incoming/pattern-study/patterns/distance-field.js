// ===== Patternflow pattern =====
// Title:   Distance Field
// Family:  type
// Idea:    One glyph fills the panel, kept only as a coarse grid of signed distances whose texel centres show as dim dots, and every LED is drawn by magnifying that grid bilinearly and cutting it at a threshold, so W, S, K, 3, 빛 and ? keep crisp edges at any grid size while their corners round off and thin strokes vanish as the grid coarsens; an outline band and an outer glow come from the same field, and each glyph melts into the next by blending the two fields.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: signed distance fields for alpha-tested magnification (Chris Green, Valve, "Improved Alpha-Tested Magnification for Vector Textures and Special Effects", SIGGRAPH 2007), glyphs drawn for this pattern, pattern round 67
// Round:   67
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Magnify=-1.5..1.8, Weight=-4..5
//
// Knob 1: Hue. Turns all three colours round the wheel together: at 0 a cyan glyph with a pale rim and a magenta glow.
// Knob 2: Speed. How fast the glyphs come: at 2 each holds 2 seconds and melts into the next over 0.5, at 0.2 ten times slower; the glow's ripples move with it.
// Knob 3: Magnify. How far the stored field is blown up, in octaves around 6 LEDs a texel where it opens (12 by 23 texels): at -1.5 a texel is 2 LEDs and the glyph is sharp, at 1 it is 12 LEDs and the corners are round, at 1.8 it is 21 LEDs, 4 by 8 texels, and the thin parts are gone.
// Knob 4: Weight. Where the field is cut, in LEDs off the true outline: -4 thins every stroke by 8 LEDs, 0 is the drawn weight, 5 makes it 10 LEDs bolder and closes the small counters.

const W = 64, H = 128;
const { floor, ceil, round, min, abs, sqrt, exp, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Glyphs, as exact geometry in panel LEDs (x 0..64, y 0..128 down).
// Each glyph is a union of simple polygons that may overlap: rectangles,
// slanted bars cut level at both ends, and bands along an ellipse whose
// arcs are flattened into chords of at most 5 degrees. The box is about
// 56 by 116, x 4..60 and y 6..122. Strokes are 11 to 13 LEDs wide, the
// Hangul ones 9 to 10, so at 12 LEDs a texel the thin ones go first.
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// A bar from a top edge centred on xt, wt wide, to a bottom edge on xb.
const bar = (xt, yt, wt, xb, yb, wb) => [[xt - wt / 2, yt], [xt + wt / 2, yt], [xb + wb / 2, yb], [xb - wb / 2, yb]];
// A band hw either side of an ellipse from angle a0 to a1 in degrees,
// clockwise on the panel (0 is right, 90 down), cut square to the curve.
function arc(cx, cy, rx, ry, hw, a0, a1) {
  const n = ceil(abs(a1 - a0) / 5), out = [], inn = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * PI) / 180, c = cos(a), s = sin(a);
    out.push([cx + (rx + hw) * c, cy + (ry + hw) * s]);
    inn.push([cx + (rx - hw) * c, cy + (ry - hw) * s]);
  }
  return out.concat(inn.reverse());
}
function disc(cx, cy, r) {
  const p = [];
  for (let i = 0; i < 48; i++) p.push([cx + r * cos((i * PI) / 24), cy + r * sin((i * PI) / 24)]);
  return p;
}

// The order alternates straight and round, so every melt turns a corner
// into a curve or back.
const GLYPHS = [
  // W: four bars, the inner two thinner and sharing the top apex.
  [bar(9.5, 6, 11, 20, 122, 11), bar(31, 6, 8, 20, 122, 9), bar(33, 6, 8, 44, 122, 9), bar(54.5, 6, 11, 44, 122, 11)],
  // S: two elliptic bowls meeting in the middle stroke at y 64.
  [arc(32, 38, 22, 26, 6, -25, -280), arc(32, 90, 22, 26, 6, -100, 155)],
  // K: the arm ends inside the stem, the leg starts inside the arm.
  [rect(5, 6, 18, 122), bar(51, 6, 14, 12, 84, 12), bar(26, 56, 10, 51, 122, 15)],
  // 3: a small bowl over a big one, a short tongue to the left where they
  // meet, and a notch on the right between them.
  [arc(30, 37, 22, 25, 6, -155, 100), arc(30, 89, 24, 27, 6, -100, 150), rect(17, 56, 32, 68)],
  // 빛: ㅂ and ㅣ over the final ㅊ, whose top tick is the smallest stroke.
  [
    rect(5, 6, 15, 62), rect(28, 6, 38, 62), rect(5, 29, 38, 38), rect(5, 53, 38, 62), rect(47, 6, 57, 68),
    rect(27, 69, 37, 77), rect(8, 81, 56, 90), bar(31, 88, 11, 10, 122, 12), bar(28, 92, 9, 54, 122, 12),
  ],
  // ?: a hook that turns into the stem, and a round dot.
  [arc(32, 37, 22, 25, 6, -160, 92), rect(26, 58, 38, 92), disc(32, 112, 8.5)],
];

// Even-odd test against one simple polygon.
function inPoly(P, x, y) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// The outline of a union. Every polygon edge is split where any other
// polygon's edge crosses it (or runs along it), and a piece is kept when a
// point a hair to one side is in the union and a point to the other side is
// not. Edges buried inside another polygon go, and so do edges where two
// polygons only touch. The distance to the kept pieces is then the exact
// distance to the glyph's outline, inside as well as outside: the plain
// minimum of each polygon's own distance would be wrong inside, wherever
// two strokes join.
function outline(polys) {
  const inside = (x, y) => polys.some((P) => inPoly(P, x, y));
  const segs = [];
  polys.forEach((P, i) => {
    for (let k = 0; k < P.length; k++) {
      const [ax, ay] = P[k], [bx, by] = P[(k + 1) % P.length];
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      if (L2 < 1e-12) continue;
      const ts = [0, 1];
      polys.forEach((Q, j) => {
        if (j === i) return;
        for (let m = 0; m < Q.length; m++) {
          const [cx, cy] = Q[m], [ex, ey] = Q[(m + 1) % Q.length];
          const fx = ex - cx, fy = ey - cy, den = dx * fy - dy * fx;
          if (abs(den) < 1e-12) {
            if (abs((cx - ax) * dy - (cy - ay) * dx) < 1e-9) ts.push(((cx - ax) * dx + (cy - ay) * dy) / L2, ((ex - ax) * dx + (ey - ay) * dy) / L2);
            continue;
          }
          const u = ((cx - ax) * dy - (cy - ay) * dx) / den;
          if (u >= 0 && u <= 1) ts.push(((cx - ax) * fy - (cy - ay) * fx) / den);
        }
      });
      const tt = ts.filter((t) => t >= 0 && t <= 1).sort((a, b) => a - b);
      const L = sqrt(L2), nx = (-dy / L) * 1e-4, ny = (dx / L) * 1e-4;
      for (let q = 1; q < tt.length; q++) {
        if (tt[q] - tt[q - 1] < 1e-9) continue;
        const tm = (tt[q] + tt[q - 1]) / 2, mx = ax + dx * tm, my = ay + dy * tm;
        if (inside(mx + nx, my + ny) !== inside(mx - nx, my - ny))
          segs.push(ax + dx * tt[q - 1], ay + dy * tt[q - 1], ax + dx * tt[q], ay + dy * tt[q]);
      }
    }
  });
  return { segs: Float64Array.from(segs), inside };
}

// Signed distance in LEDs, negative inside.
function sdf(G, x, y) {
  const s = G.segs;
  let d2 = Infinity;
  for (let i = 0; i < s.length; i += 4) {
    const ax = s[i], ay = s[i + 1], dx = s[i + 2] - ax, dy = s[i + 3] - ay;
    const t = cl(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    const ex = x - ax - t * dx, ey = y - ay - t * dy, e = ex * ex + ey * ey;
    if (e < d2) d2 = e;
  }
  return G.inside(x, y) ? -sqrt(d2) : sqrt(d2);
}

// The texel grid for a texel size of s LEDs: centres on LED centres, s
// apart, the first at or left of the panel's first LED and the last at or
// right of its last, so the reconstruction never runs off the field.
function grid(s) {
  const nx = ceil((W - 1) / s) + 1, ny = ceil((H - 1) / s) + 1;
  const ox = -floor(((nx - 1) * s - (W - 1)) / 2), oy = -floor(((ny - 1) * s - (H - 1)) / 2);
  // For each LED column and row: the texel to its left (above) and how far
  // along to the next one, for the bilinear weights.
  const xi = new Int16Array(W), xf = new Float32Array(W), yi = new Int16Array(H), yf = new Float32Array(H);
  for (let x = 0; x < W; x++) {
    const g = (x - ox) / s, i = min(nx - 2, floor(g));
    xi[x] = i;
    xf[x] = g - i;
  }
  for (let y = 0; y < H; y++) {
    const g = (y - oy) / s, j = min(ny - 2, floor(g));
    yi[y] = j;
    yf[y] = g - j;
  }
  return { s, nx, ny, ox, oy, xi, xf, yi, yf, fields: [] };
}

// Sample a glyph's exact distance at every texel centre (LED centres sit at
// x + 0.5). This is the whole texture: nothing else of the glyph survives.
function field(G, glyph) {
  if (G.fields[glyph]) return G.fields[glyph];
  const F = new Float32Array(G.nx * G.ny), O = OUTLINES[glyph];
  for (let j = 0; j < G.ny; j++)
    for (let i = 0; i < G.nx; i++) F[j * G.nx + i] = sdf(O, G.ox + i * G.s + 0.5, G.oy + j * G.s + 0.5);
  return (G.fields[glyph] = F);
}

const OUTLINES = GLYPHS.map(outline);
const NG = GLYPHS.length;
// Seconds at Speed 2: a glyph holds HOLD, then melts into the next over MELT.
const HOLD = 2, MELT = 0.5, BEAT = HOLD + MELT;
// The rim: a band this many LEDs wide just inside the cut.
const RIM = 1.3;

export function setup(params) {
  params.s = { T: 0, ripple: 0, G: grid(6), F: null, hue: 0, weight: 0 };
}

export function update(dt, input, params) {
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  const sp = cl(k[1], 0.05, 3) / 2;
  S.T += dt * sp;
  S.ripple += dt * sp * 0.55;
  S.hue = k[0];
  S.weight = cl(k[3], -6, 8);
  const s = cl(round(6 * 2 ** cl(k[2], -2, 2)), 2, 21);
  if (s !== S.G.s) S.G = grid(s);
  // The texture of the moment: one glyph's field, or two blended while it
  // melts. A blend of two distance fields is not itself a distance field,
  // but its zero set slides from one outline to the other.
  const n = floor(S.T / BEAT), u = smooth((S.T - n * BEAT - HOLD) / MELT);
  const A = field(S.G, n % NG);
  if (u <= 0) S.F = A;
  else {
    const B = field(S.G, (n + 1) % NG);
    if (!S.F || S.F === A || S.F === B || S.F.length !== A.length) S.F = new Float32Array(A.length);
    for (let i = 0; i < A.length; i++) S.F[i] = A[i] + (B[i] - A[i]) * u;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S.F) return;
  const { G, F, weight } = S;
  const { nx, xi, xf, yi, yf } = G;
  const buf = S.buf || (S.buf = new Float32Array(W * H * 3));
  const [fr, fg, fb] = hsv(0.5 + S.hue, 0.78, 1);
  const [rr, rg, rb] = hsv(0.47 + S.hue, 0.22, 1);
  const [gr, gg, gb] = hsv(0.87 + S.hue, 0.72, 1);
  const ph = S.ripple;
  for (let y = 0, p = 0; y < H; y++) {
    const r0 = yi[y] * nx, r1 = r0 + nx, v = yf[y];
    for (let x = 0; x < W; x++, p += 3) {
      // Bilinear magnification, what the texture unit does for free.
      const i = xi[x], h = xf[x];
      const top = F[r0 + i] + (F[r0 + i + 1] - F[r0 + i]) * h;
      const bot = F[r1 + i] + (F[r1 + i + 1] - F[r1 + i]) * h;
      const e = top + (bot - top) * v - weight;
      // Alpha test, softened over one LED so the cut edge is crisp but not
      // stair-stepped.
      const a = cl(0.5 - e, 0, 1);
      let R = 0, Gc = 0, B = 0;
      if (a > 0) {
        // Deeper inside is brighter, so the spine of each stroke shows.
        const lv = 0.5 + 0.5 * smooth(-e / 6), rim = cl(e + RIM + 0.5, 0, 1);
        R = a * (fr * lv + (rr - fr * lv) * rim);
        Gc = a * (fg * lv + (rg - fg * lv) * rim);
        B = a * (fb * lv + (rb - fb * lv) * rim);
      }
      if (a < 1) {
        // Outer glow from the same field: falls off with distance, with
        // slow rings at fixed distances running outward.
        const d = e > 0 ? e : 0;
        const g = (1 - a) * 0.8 * exp(-d / 4.2) * (0.6 + 0.4 * cos(2 * PI * (d / 7 - ph)));
        R += gr * g;
        Gc += gg * g;
        B += gb * g;
      }
      buf[p] = R;
      buf[p + 1] = Gc;
      buf[p + 2] = B;
    }
  }
  // The texel centres, dim dots: dark holes where they fall in the glyph,
  // faint light where they fall outside. Too dense to read below 4 LEDs.
  const fade = cl((G.s - 2) / 3, 0, 1);
  if (fade > 0) {
    const [dr, dg, db] = hsv(0.6 + S.hue, 0.25, 0.28 * fade);
    for (let j = 0; j < G.ny; j++) {
      const y = G.oy + j * G.s;
      if (y < 0 || y >= H) continue;
      for (let i = 0; i < nx; i++) {
        const x = G.ox + i * G.s;
        if (x < 0 || x >= W) continue;
        const e = F[j * nx + i] - weight, p = (y * W + x) * 3;
        if (e < 0) {
          const k = 1 - 0.55 * fade;
          buf[p] *= k;
          buf[p + 1] *= k;
          buf[p + 2] *= k;
        } else {
          buf[p] += dr;
          buf[p + 1] += dg;
          buf[p + 2] += db;
        }
      }
    }
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, min(255, buf[p] * 255), min(255, buf[p + 1] * 255), min(255, buf[p + 2] * 255));
}
