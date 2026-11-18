// ===== Patternflow pattern =====
// Title:   Bouba Kiki
// Family:  type
// Idea:    Kiki stands over bouba in tall letters built from stroke skeletons, each word's roundness breathing between a needle and a pillow on its own slow period, kiki as thin cool metal and bouba as fat warm pink the way nearly everyone pairs them, until the Swap knob turns the pairing over and the round kiki and the spiky bouba shiver and glow in each other's colours.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the bouba/kiki effect (Wolfgang Kohler, 1929, takete and maluma, later baluba; Vilayanur Ramachandran and Edward Hubbard, 2001, bouba and kiki; years and names from memory), signed distance fields joined by a polynomial smooth minimum (Inigo Quilez, year from memory), letters drawn for this pattern as stroke skeletons, pattern round 112
// Round:   112
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Swap=0..1, Round=-0.5..0.5
//
// Knob 1: Hue. Turns both words round the wheel together. At 0 a sharp letter is white with a cyan edge and a round one pink with an orange rim, a half round one lilac; at 0.25 kiki is violet and bouba lime, at 0.5 kiki is red and bouba cyan, at 0.75 kiki is green and bouba magenta.
// Knob 2: Speed. The clock of everything that moves. At 2 kiki's roundness goes through one period in 6.3 s and bouba's in 8.7 s, a highlight band crosses the sharp letters in 6 s and the jitter of a wrong pairing steps 12 times a second; every time goes as 2 / Speed, so kiki's period is 63 s at 0.2 and 4.2 s at 3.
// Knob 3: Swap. 0 is the pairing people pick and 1 is its mirror. The two words' mean roundness sit 0.5 either side of the Round setting: at 0 and the opening Round, kiki's mean is 0.06 and bouba's 1, at 0.5 both are 0.56, at 1 kiki's is 1 and bouba's 0.06. Each word breathes 0.45 either side of its mean and is held to 0..1, so at 0 kiki is a needle for 2.9 s of its 6.3 and bouba a full pillow for 4.4 s of its 8.7. The rounder kiki is than bouba, up to 1, the more each letter shakes, to 0.55 LED either way, and the more each word's glow takes the other word's colour: at 1, for most of each breath, kiki is a fat pink sausage with a teal glow and bouba a cyan blade with an orange one.
// Knob 4: Round. The pair's mean roundness, 0.5 plus the knob: 0 at -0.5, 0.56 at the opening 0.06, 1 at 0.5. With Swap at 0, -0.5 leaves kiki a needle and bouba half round (0.5), and 0.5 leaves bouba a pillow and kiki half round (0.5), so both words are sharp at one end and soft at the other.

// A letter is a few polylines in a box, u across and v up from the baseline
// with the x-height 1. Kiki's letters are 21 LEDs wide for k and 11 for i,
// with an x-height of 37 LEDs and ascenders 1.45 times that; bouba's five
// are 12.8 wide, 35 LEDs high and 1.75 for the b. Every LED is lit by its
// signed distance to the nearest stroke, the strokes of a letter joined by
// a smooth minimum, so one number per word, the roundness r from 0 (needle)
// to 1 (pillow), moves several things together:
//   the width at a stroke's ends, 0 LEDs at r 0 and the full width, with
//     round caps, from r 0.8; the full width is 5.6 LEDs mid-stroke for
//     kiki at r 0 and 5.2 at r 1, and 6 and 4.1 for bouba;
//   the softness of the join, 0.25 LED at r 0 and 2 LEDs at r 1;
//   the bowls of b, o, u and a, the curve |x|^p + |y|^p = 1 with p from 0.8
//     (a four pointed star) to 2 (an ellipse), and the diagonals of k,
//     which bow;
//   the dot of the i, an 11.6 LED needle at r 0 and a disc 5.2 across at 1;
//   the height of the letters, 5% over the drawn height at r 0 and 5% under
//     it at r 1; and the colour, white and cyan to pink and orange.
// The glow outside the edge falls off in 1.5 LEDs at r 0 and 1.3 at r 1.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sqrt, exp, sin, cos, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;
const sm = (x) => ((x = cl(x, 0, 1)), x * x * (3 - 2 * x));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Letters as skeletons. A letter lives in a box u 0..1 across and v up
// from the baseline, x-height 1 and ascender 1.45. A stroke is a polyline
// in that box; r, 0 for kiki and 1 for bouba, bends the skeleton itself:
// a bowl is the superellipse |x|^p + |y|^p = 1 with p from 0.8 (four
// slightly concave points, a star) to 2 (the ellipse), and the diagonals of k bow.
function line(a, b, bow, n) {
  const o = [], dx = b[0] - a[0], dy = b[1] - a[1], L = sqrt(dx * dx + dy * dy) || 1;
  for (let i = 0; i <= n; i++) {
    const s = i / n, k = bow * sin(PI * s);
    o.push([a[0] + dx * s - (dy / L) * k, a[1] + dy * s + (dx / L) * k]);
  }
  return o;
}
// The superellipse from angle t0 to t1, in turns of pi.
function bowl(cx, cy, rx, ry, p, t0, t1, n) {
  const o = [], e = 2 / p;
  for (let i = 0; i <= n; i++) {
    const t = PI * lerp(t0, t1, i / n), c = cos(t), s = sin(t);
    o.push([cx + rx * Math.sign(c) * pow(abs(c), e), cy + ry * Math.sign(s) * pow(abs(s), e)]);
  }
  return o;
}
const ring = (cx, cy, rx, ry, p) => [bowl(cx, cy, rx, ry, p, 1, 0, 12), bowl(cx, cy, rx, ry, p, 0, -1, 12)];
const GLYPHS = {
  k: (r, a) => [line([0.1, 0], [0.1, a], 0.04 * r, 6), line([0.94, 1], [0.1, 0.4], 0.12 * r, 6), line([0.4, 0.62], [0.96, 0], -0.1 * r, 6)],
  i: (r) => {
    const h = lerp(0.17, 0.004, r);
    return [line([0.5, 0], [0.5, 1], 0.04 * r, 6), line([0.5, 1.3 - h], [0.5, 1.3 + h], 0, 2)];
  },
  b: (r, a) => [line([0.12, 0], [0.12, a], 0.03 * r, 6), ...ring(0.5, 0.5, 0.38, 0.5, lerp(0.8, 2, r))],
  o: (r) => ring(0.5, 0.5, 0.42, 0.5, lerp(0.8, 2, r)),
  u: (r) => [line([0.1, 1], [0.1, 0.5], 0, 3), bowl(0.5, 0.5, 0.4, 0.5, lerp(0.8, 2, r), 1, 2, 12), line([0.9, 1], [0.9, 0], 0.02 * r, 6)],
  a: (r) => [...ring(0.45, 0.5, 0.36, 0.5, lerp(0.8, 2, r)), line([0.86, 1], [0.86, 0], 0.03 * r, 6)],
};
// Each word: its letters with their widths across the panel, its baseline,
// and its x-height in LEDs.
const WORDS = [
  { s: 'kiki', w: [21, 11, 21, 11], base: 60, xh: 37, asc: 1.45, wr: 5.2, ws: 5.6, pad: 2.4 },
  { s: 'bouba', w: [12.8, 12.8, 12.8, 12.8, 12.8], base: 125, xh: 35, asc: 1.75, wr: 4.1, ws: 6, pad: 2.1 },
];

// A tapered stroke's distance: along each segment the width is read at the
// nearest point's place along the whole stroke, s from 0 to 1. At r = 0 the
// width is 0 at both ends and swells to the middle; at r = 1 it is the same
// everywhere, so the ends are round caps. The width curve is cut into 33
// steps once a frame.
const NW = 32;
function build(word, r, hs) {
  const out = [], pad = word.pad;
  let x0 = 0;
  const wm = lerp(word.ws, word.wr, r), ef = sm(r * 1.25), q = lerp(0.85, 1.6, r), lut = new Float32Array(NW + 1);
  for (let i = 0; i <= NW; i++) lut[i] = wm * (ef + (1 - ef) * pow(sin((PI * i) / NW), q));
  word.s.split('').forEach((ch, li) => {
    const wl = word.w[li], strokes = GLYPHS[ch](r, word.asc), segs = [];
    const mapx = (u) => x0 + pad + u * (wl - 2 * pad);
    const mapy = (v) => word.base - pad - v * (word.xh * hs - 2 * pad);
    let bx0 = W, bx1 = 0, by0 = H, by1 = 0;
    for (const st of strokes) {
      const pts = st.map(([u, v]) => [mapx(u), mapy(v)]);
      let tot = 0;
      for (let i = 1; i < pts.length; i++) tot += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      let acc = 0;
      const one = { g: [], x0: W, x1: 0, y0: H, y1: 0 };
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay);
        one.g.push({ ax, ay, dx: bx - ax, dy: by - ay, il: len > 1e-6 ? 1 / (len * len) : 0, s0: tot ? acc / tot : 0.5, ds: tot ? len / tot : 0 });
        acc += len;
        one.x0 = min(one.x0, ax, bx);
        one.x1 = max(one.x1, ax, bx);
        one.y0 = min(one.y0, ay, by);
        one.y1 = max(one.y1, ay, by);
      }
      // Beyond this box a stroke is further than 9 LEDs off and is skipped.
      const m = wm / 2 + 9;
      (one.x0 -= m), (one.x1 += m), (one.y0 -= m), (one.y1 += m);
      bx0 = min(bx0, one.x0);
      bx1 = max(bx1, one.x1);
      by0 = min(by0, one.y0);
      by1 = max(by1, one.y1);
      segs.push(one);
    }
    out.push({ segs, lut, box: [max(0, floor(bx0)), min(W, ceil(bx1)), max(0, floor(by0)), min(H, ceil(by1))] });
    x0 += wl;
  });
  return out;
}

// Polynomial smooth minimum: the union of two shapes with the corner where
// they meet rounded off over k LEDs.
function smin(a, b, k) {
  if (a === Infinity) return b;
  const h = max(k - abs(a - b), 0) / k;
  return min(a, b) - h * h * k * 0.25;
}

function distance(L, x, y, k) {
  let d = Infinity;
  for (const one of L.segs) {
    if (x < one.x0 || x > one.x1 || y < one.y0 || y > one.y1) continue;
    let m = Infinity;
    for (const g of one.g) {
      let t = g.il ? ((x - g.ax) * g.dx + (y - g.ay) * g.dy) * g.il : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x - g.ax - t * g.dx, ey = y - g.ay - t * g.dy;
      const f = (g.s0 + t * g.ds) * NW, i = f | 0, w = L.lut[i] + (L.lut[min(NW, i + 1)] - L.lut[i]) * (f - i);
      const e = sqrt(ex * ex + ey * ey) - w / 2;
      if (e < m) m = e;
    }
    d = smin(d, m, k);
  }
  return d;
}

export function setup(params) {
  params.s = { clock: 0, hue: 0, speed: 2, swap: 0, R: 0.56, rgb: new Float32Array(W * H * 3), fld: new Float32Array(W * H) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06];
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.swap = cl(kv[2], 0, 1);
  S.R = cl(0.5 + kv[3], 0, 1);
  S.clock += (cl(dt || 0, 0, 0.1) * S.speed) / 2;
}

const noise = (a, b) => {
  const v = sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - floor(v) - 0.5;
};

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const c = S.clock, rgb = S.rgb, F = S.fld;
  // The two words' roundness: the pair's mean, pushed apart by Swap (0 the
  // natural pairing, kiki sharp and bouba round; 1 the pairing turned over),
  // and each breathing on its own slow period.
  const p = 1 - 2 * S.swap;
  const base = [cl(S.R - 0.5 * p, 0, 1), cl(S.R + 0.5 * p, 0, 1)];
  const r = [cl(base[0] + 0.45 * sin((c * 2 * PI) / 6.3 - 1.27), 0, 1), cl(base[1] + 0.45 * sin((c * 2 * PI) / 8.7 + 1.57), 0, 1)];
  // How wrong the pairing is: how much rounder kiki is than bouba.
  const wrong = cl(r[0] - r[1], 0, 1);
  rgb.fill(0);
  WORDS.forEach((word, wi) => {
    const rr = r[wi], hs = lerp(1.05, 0.95, rr), letters = build(word, rr, hs), k = lerp(0.25, 2, rr);
    const step = floor(c * 12), jit = 1.1 * wrong;
    F.fill(Infinity);
    letters.forEach((L, li) => {
      const jx = jit * noise(li + wi * 7, step), jy = jit * noise(li + 3 + wi * 7, step + 5), [xa, xb, ya, yb] = L.box;
      for (let y = ya; y < yb; y++)
        for (let x = xa; x < xb; x++) {
          const d = distance(L, x + 0.5 - jx, y + 0.5 - jy, k);
          if (d < F[y * W + x]) F[y * W + x] = d;
        }
    });
    // Colour. Sharp letters are cool metal, white along the stroke and
    // cyan at the edge; round ones warm, pale pink with an orange rim. In
    // between the hue climbs from cyan through violet to pink, so a half
    // round letter is lilac, never grey.
    const m = sm(rr * 1.4 - 0.2);
    const tint = (d, x, y) => {
      const tube = cl(-d / 2.4, 0, 1), edge = 1 - tube, rim = 1 - cl(-d / 1.5, 0, 1);
      const band = exp(-(((x * 0.8 - y * 0.5 + 30 - 110 * (c / 6 - floor(c / 6))) / 7) ** 2));
      const sc = cl(0.1 + 0.6 * edge ** 1.5 - 0.5 * band, 0, 1), vc = min(1, 0.8 + 0.2 * tube + 0.25 * band);
      const sw = 0.28 + 0.5 * rim, vw = 0.92 + 0.08 * sin(c * 1.7 + y * 0.12);
      return hsv(S.hue + lerp(0.52, 0.95 + 0.12 * rim, m), lerp(sc, sw, m), lerp(vc, vw, m));
    };
    const glowCool = hsv(0.5 + S.hue, 0.95, 1), glowWarm = hsv(0.08 + S.hue, 0.85, 1);
    // The wrong pairing rings in the other word's colour.
    const gOwn = rr < 0.5 ? glowCool : glowWarm, gOther = rr < 0.5 ? glowWarm : glowCool, clash = sm(wrong * 2);
    const top = word.base - word.asc * word.xh * 1.05 - 12, bot = word.base + 12;
    for (let y = max(0, floor(top)); y < min(H, bot); y++)
      for (let x = 0; x < W; x++) {
        const d = F[y * W + x];
        if (d > 9) continue;
        const o = (y * W + x) * 3, inn = cl(0.5 - d, 0, 1);
        const a = tint(d, x, y);
        const gl = exp(-max(d, 0) / lerp(1.5, 1.3, rr)) * lerp(0.55, 0.45, rr) * (1 - inn);
        for (let e = 0; e < 3; e++) rgb[o + e] = min(1, rgb[o + e] + a[e] * inn + lerp(gOwn[e], gOther[e], clash) * gl);
      }
  });
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
