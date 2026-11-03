// ===== Patternflow pattern =====
// Title:   Side Radicals
// Family:  type
// Idea:    A character component is written stroke by stroke in the top practice square, 水 or 人, 手, 心, 火, 刀 or 犬, and then a copy of its strokes, each in a colour of its own, slides down the tall panel into the bottom square and changes shape on the way into the narrow form it takes as a side radical, the four strokes of 水 shrinking and turning into the two dots and the rising stroke of 氵 while its vertical hook melts into them, until it docks on the left (灬 at the bottom, 刂 on the right), the other part slides in beside it and 江 stands, then 河.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the side forms of radicals (偏旁), the changed shapes a component takes at the side of a character in regular script, which the Kangxi Dictionary (1716) files under the full radical (氵 under 水, 亻 under 人, 扌 under 手, 忄 under 心, 灬 under 火, 刂 under 刀, 犭 under 犬); the practice square (田字格); strokes and stroke orders written for this pattern after the regular script, with the mainland forms 点 and 杰; pattern round 102
// Round:   102
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Set=0..7, Morph=0..1
//
// Knob 1: Hue. Turns the colours round the wheel. At 0 the component's strokes are gold, sky blue, pink and green in stroke order, the plain ink pale blue-white and the squares a dim blue-grey; at 0.5 they are blue, red-orange, sea green and violet and the plain ink a pale peach.
// Knob 2: Speed. At 2 the pen writes 55 LEDs a second, so 人 takes 2.0 s and 手 3.6 s, then the change takes 3.2 s, the other part slides in in 0.9 s and each character holds 1.8 s: a set of two characters takes 12.3 s (人) to 13.9 s (手) and the seven come round in 92.5 s. Ten times slower at 0.2, half as fast again at 3.
// Knob 3: Set. 0 goes through the seven in turn: 水 to 氵 for 江 and 河, 人 to 亻 for 休 and 他, 手 to 扌 for 打 and 拉, 心 to 忄 for 忙 and 快, 火 to 灬 at the bottom for 杰 and 点, 刀 to 刂 at the right for 刊 and 利, 犬 to 犭 for 狂 and 狗. 1 to 7 keep one of them. The panel opens on 水 just written, about to change.
// Knob 4: Morph. Up to 0.1 the change runs by itself. Past 0.1 the knob holds it by hand: at 0.1 the strokes stand in the full form in the top square, at 0.5 the first of them are halfway down and halfway changed, at 0.86 the radical has docked, and from 0.82 to 1 the other part slides in beside it.

// Every component is a list of strokes on a 16 by 16 square, y down, in
// stroke order, and the radical forms and the other parts sit where they go
// in the finished character. A stroke is h (horizontal), v (vertical), p
// (left-falling), n (right-falling), d (dot), t (rising), hz (horizontal
// then down), hp (horizontal then left-falling), vz (vertical then right),
// vg (vertical with a hook), hzg (horizontal, down, hook), wg (curved hook),
// wo (lying hook) or vwg (vertical, bend, hook up). p, n, d and t with three
// points are quadratic curves through a control point; wg, wo and vwg are
// rounded except at the hook. Every stroke is resampled to 24 points by arc
// length, so any stroke can move point by point into any other.
//
// The changes are this pattern's, as a picture of what the side form keeps:
// 水's short upper stroke becomes the top dot of 氵, its 横撇 the middle dot,
// its right-falling stroke turns end for end into the rising stroke and the
// vertical hook melts into it. 人's right-falling stroke stands up as the
// vertical of 亻. 手's first two strokes merge into the one horizontal of 扌
// and its second horizontal tilts into the rising stroke. 心's lying hook
// stands up as the vertical of 忄 and its two right dots merge into one. 火's
// four strokes each become a dot of 灬. 刀's 横折钩 straightens into the
// hooked vertical of 刂 and its left-falling stroke into the short one. 犬's
// right-falling stroke curls into the curved hook of 犭 and its horizontal
// melts into the dot that becomes the top stroke.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => u * u * (3 - 2 * u);
const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

const G = {
  shui: [["vg", 8.2, 1, 8.2, 14.8, 6.4, 13.2], ["hp", 2, 5.4, 6.6, 5.4, 4.8, 9.4, 1.2, 12.8], ["p", 13.8, 3.2, 12.6, 5.4, 9.6, 7.4], ["n", 9.2, 6.6, 10.8, 11, 15.2, 14.4]],
  shui3: [["d", 1.4, 2.2, 2.6, 2.9, 3.8, 4.4], ["d", 0.8, 6.8, 2.1, 7.5, 3.3, 9], ["t", 1, 14.4, 2.4, 12.4, 4.8, 9.8]],
  gong: [["h", 7.6, 3.4, 14.4, 3.4], ["v", 11, 3.4, 11, 13.8], ["h", 6.6, 13.8, 15.2, 13.8]],
  ke: [["h", 6.4, 2.6, 15.4, 2.6], ["v", 7.8, 5.6, 7.8, 10.8], ["hz", 7.8, 5.6, 11.8, 5.6, 11.8, 10.4], ["h", 7.8, 10.2, 11.8, 10.2], ["vg", 13.9, 2.6, 13.9, 15.2, 12, 13.8]],
  ren: [["p", 8.4, 1, 8, 9.6, 1.2, 15], ["n", 8, 6, 9.8, 11.6, 15, 15]],
  ren2: [["p", 4.6, 1, 3.8, 4.6, 0.8, 8.2], ["v", 3.2, 5.4, 3.2, 15.2]],
  mu: [["h", 6.6, 5.2, 15.4, 5.2], ["v", 11, 1, 11, 15.4], ["p", 10.6, 5.6, 9.6, 10, 6.6, 13.4], ["d", 11.6, 6.4, 12.8, 8.6, 15.2, 11.2]],
  ye: [["hzg", 7, 7.6, 14, 6, 13.8, 10.4, 12.6, 9.6], ["v", 10.2, 2.4, 10.2, 11.2], ["vwg", 7.6, 3.6, 7.6, 13.6, 8.8, 14.9, 14.6, 14.9, 15.2, 12.6]],
  shou: [["p", 12.8, 0.8, 8, 2.8, 3, 3.8], ["h", 3.4, 6.8, 12.6, 6.8], ["h", 1.4, 10.6, 14.6, 10.6], ["vg", 8, 2.6, 8, 15, 6.2, 13.6]],
  shou3: [["h", 0.8, 5.4, 6.2, 5.2], ["vg", 3.6, 1, 3.6, 15, 2, 13.6], ["t", 0.6, 11.6, 3.2, 10.2, 6.2, 8.4]],
  ding: [["h", 7, 3.2, 15.2, 3.2], ["vg", 11.6, 3.2, 11.6, 15, 9.8, 13.6]],
  li: [["d", 10.4, 1, 11.1, 1.9, 11.8, 3.4], ["h", 7.6, 4.8, 14.8, 4.8], ["d", 8.8, 7.2, 9.4, 9.4, 10, 11.6], ["p", 13.8, 7, 13.2, 9.6, 12.2, 11.8], ["h", 7, 14.4, 15.4, 14.4]],
  xin: [["d", 2.4, 6.8, 2.8, 8.4, 2.2, 10.4], ["wo", 4.6, 4.8, 5.2, 11.4, 7.4, 14.2, 12.4, 13.6, 10.8, 10.8], ["d", 7.4, 2.2, 8.6, 3.4, 9.4, 5.4], ["d", 12.2, 5.2, 13.8, 6.8, 15, 9.2]],
  xin3: [["d", 1, 5, 1.4, 6.6, 1.4, 8.4], ["d", 4.8, 4.4, 5.6, 5, 6.2, 6.2], ["v", 3.4, 1, 3.4, 15.2]],
  wang2: [["d", 10.6, 1, 11.4, 2, 12, 3.4], ["h", 7, 4.8, 15.2, 4.8], ["vz", 8.6, 4.8, 8.6, 14, 15.2, 14]],
  guai: [["hz", 8, 4.6, 13.8, 4.6, 13.8, 8.6], ["h", 6.6, 8.6, 15.4, 8.6], ["p", 10.8, 1.4, 10.4, 10.4, 7, 15], ["n", 11.4, 10.2, 12.8, 12.6, 15.2, 15]],
  huo: [["d", 3, 4.6, 3.8, 6.4, 4.8, 7.8], ["p", 12.8, 4, 12.4, 6, 11, 7.8], ["p", 8.2, 1, 8, 10.2, 1.2, 15.2], ["n", 8.4, 8.8, 10, 12.8, 15, 15.2]],
  huo4: [["p", 2.8, 12, 2.4, 13.6, 1.2, 15], ["d", 5.6, 12.2, 6, 13.6, 6.9, 15], ["d", 9.3, 12.2, 9.8, 13.6, 10.7, 15], ["d", 12.8, 12, 13.6, 13.4, 15, 15]],
  mutop: [["h", 1.4, 3.8, 14.6, 3.8], ["v", 8, 0.8, 8, 10.6], ["p", 7.6, 4.2, 6, 7.4, 1.4, 9.8], ["n", 8.4, 4.2, 10, 7.4, 14.6, 9.8]],
  zhan: [["v", 6.4, 0.8, 6.4, 6.6], ["h", 6.4, 3.6, 11.8, 3.6], ["v", 3.2, 6.6, 3.2, 10.8], ["hz", 3.2, 6.6, 12.8, 6.6, 12.8, 10.6], ["h", 3.2, 10.4, 12.8, 10.4]],
  dao: [["hzg", 2.4, 3.6, 13.2, 3.6, 13, 14.8, 10.8, 13.2], ["p", 8.2, 3.8, 7.6, 10.6, 1.4, 15]],
  dao2: [["v", 11, 3.2, 11, 10.6], ["vg", 14.4, 1, 14.4, 15, 12.6, 13.4]],
  gan: [["h", 1.6, 3.4, 8.6, 3.4], ["h", 0.8, 8.2, 9.4, 8.2], ["v", 5.1, 3.4, 5.1, 15.2]],
  he: [["p", 8.4, 0.8, 5.6, 2.2, 1.6, 3.2], ["h", 1, 6.2, 9.4, 6.2], ["v", 5.1, 2.6, 5.1, 15.2], ["p", 4.7, 6.6, 3.6, 9.6, 0.8, 12.8], ["d", 5.6, 7.4, 7, 8.6, 8.9, 10.4]],
  quan: [["h", 1.4, 6, 14.6, 6], ["p", 8, 1, 7.8, 10.2, 1.4, 15.2], ["n", 8.2, 6.6, 9.8, 12, 15, 15], ["d", 11.6, 1.8, 12.6, 2.6, 13.4, 3.8]],
  quan3: [["p", 5, 1, 4, 2.8, 1.6, 4.6], ["wg", 2, 3, 3.8, 4.6, 4.6, 8.4, 4, 14.6, 2.2, 13.2], ["p", 5.6, 7.4, 3.8, 10.4, 0.8, 13.2]],
  wang: [["h", 7.4, 2.8, 14.6, 2.8], ["h", 8, 8.4, 14, 8.4], ["v", 11, 2.8, 11, 14], ["h", 6.8, 14, 15.2, 14]],
  gou: [["p", 9.6, 1, 8.8, 3, 6.8, 5.2], ["hzg", 8.6, 3.6, 14.6, 3.6, 14.2, 14.6, 12.4, 13.4], ["v", 8.9, 6.8, 8.9, 11.6], ["hz", 8.9, 6.8, 12, 6.8, 12, 11.2], ["h", 8.9, 11.2, 12, 11.2]],
};

// Full form, side form, where each full stroke goes ([side stroke, 1 turned
// end for end, 2 melting into a stroke another one becomes]), the side the
// radical docks on, and the two other parts.
const SETS = [
  ["shui", "shui3", [[2, 2], [1, 0], [0, 0], [2, 1]], "L", ["gong", "ke"]],
  ["ren", "ren2", [[0, 0], [1, 0]], "L", ["mu", "ye"]],
  ["shou", "shou3", [[0, 0], [0, 2], [2, 0], [1, 0]], "L", ["ding", "li"]],
  ["xin", "xin3", [[0, 0], [2, 0], [1, 0], [1, 2]], "L", ["wang2", "guai"]],
  ["huo", "huo4", [[1, 0], [2, 0], [0, 0], [3, 0]], "B", ["mutop", "zhan"]],
  ["dao", "dao2", [[1, 0], [0, 0]], "R", ["gan", "he"]],
  ["quan", "quan3", [[0, 2], [2, 0], [1, 0], [0, 0]], "L", ["wang", "gou"]],
];
const HUES = [0.12, 0.55, 0.9, 0.32];
// The squares: 62 LEDs, at rows 1 and 65; stroke weights in LEDs.
const SQ = 62, SY = [1, 65], WFULL = 3.8, WPART = 3.3, K = 24;
// Seconds at Speed 2.
const PEN = 55, REST = 0.12, T_PAUSE = 0.5, T_MORPH = 3.2, T_SLIDE = 0.9, T_HOLD = 1.8, T_SWAP = 1.3, T_CLEAR = 0.7;

function profile(type, s) {
  if (type === "p") return 1.05 - 0.65 * s;
  if (type === "n") return s < 0.8 ? 0.55 + (0.85 * s) / 0.8 : 1.4 - 4.5 * (s - 0.8);
  if (type === "d") return 0.75 + 0.6 * s;
  if (type === "t") return 1.25 - 0.85 * s;
  if (type === "h") return 0.95 + 0.15 * s;
  if (type === "hp") return s < 0.45 ? 1 : 1.05 - 0.9 * (s - 0.45);
  if (type[0] === "w" || type.endsWith("g")) return s < 0.85 ? 1 : 1 - 4 * (s - 0.85);
  return 1;
}

// A stroke as K points [x, y, width share] on the 16 by 16 square.
const SHAPES = new Map();
function shape(st) {
  if (SHAPES.has(st)) return SHAPES.get(st);
  const [type, ...c] = st;
  let pts = [];
  if (c.length === 6 && "pndt".includes(type)) {
    for (let i = 0; i <= 16; i++) {
      const s = i / 16, a = (1 - s) * (1 - s), b = 2 * s * (1 - s), d = s * s;
      pts.push([a * c[0] + b * c[2] + d * c[4], a * c[1] + b * c[3] + d * c[5]]);
    }
  } else {
    for (let i = 0; i < c.length; i += 2) pts.push([c[i], c[i + 1]]);
    // Chaikin's corner cutting, three times, rounds a curved stroke.
    if (type[0] === "w" || type === "vwg") {
      const hook = pts.pop();
      for (let it = 0; it < 3; it++) {
        const r = [pts[0]];
        for (let i = 0; i + 1 < pts.length; i++) r.push(mix(pts[i], pts[i + 1], 0.25), mix(pts[i], pts[i + 1], 0.75));
        r.push(pts[pts.length - 1]);
        pts = r;
      }
      pts.push(hook);
    }
  }
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const T = L[L.length - 1], out = [];
  for (let k = 0, j = 0; k < K; k++) {
    const sl = (T * k) / (K - 1);
    while (j < pts.length - 2 && L[j + 1] < sl) j++;
    const u = (sl - L[j]) / (L[j + 1] - L[j] || 1);
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * u, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * u, profile(type, k / (K - 1))]);
  }
  out.len = (T / 16) * (SQ - 2);
  SHAPES.set(st, out);
  return out;
}

// The square's grid point (gx, gy) on the panel.
const px = (gx) => 2 + (gx / 16) * (SQ - 2);
const py = (gy, row) => SY[row] + 1 + (gy / 16) * (SQ - 2);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// A stroke from panel points [x, y, width]: coverage of the capsules
// between them, laid over what is there.
const COV = new Float32Array(N);
function ink(buf, P, col, alpha, y0) {
  const touched = [];
  for (let i = 0; i + 1 < P.length; i++) {
    const [ax, ay, aw] = P[i], [bx, by, bw] = P[i + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, r = max(aw, bw) / 2 + 1;
    for (let y = max(y0, floor(min(ay, by) - r)); y <= min(H - 1, floor(max(ay, by) + r)); y++)
      for (let x = max(0, floor(min(ax, bx) - r)); x <= min(W - 1, floor(max(ax, bx) + r)); x++) {
        const qx = x + 0.5 - ax, qy = y + 0.5 - ay, u = l2 > 0 ? cl((qx * dx + qy * dy) / l2, 0, 1) : 0;
        const c = cl((aw + (bw - aw) * u) / 2 + 0.5 - hypot(qx - u * dx, qy - u * dy), 0, 1), p = y * W + x;
        if (c <= 0) continue;
        if (COV[p] === 0) touched.push(p);
        if (c > COV[p]) COV[p] = c;
      }
  }
  for (const p of touched) {
    const a = COV[p] * alpha;
    for (let q = 0; q < 3; q++) buf[p * 3 + q] += (col[q] - buf[p * 3 + q]) * a;
    COV[p] = 0;
  }
}

// One set's clock: writing, pause, change, slide, hold, swap, hold, clear.
function plan(si) {
  const full = G[SETS[si][0]];
  let t = 0;
  const strokes = full.map((st) => {
    const s = { t0: t, t1: t + shape(st).len / PEN };
    t = s.t1 + REST;
    return s;
  });
  const m0 = t + T_PAUSE, m1 = m0 + T_MORPH, s1 = m1 + T_SLIDE, h1 = s1 + T_HOLD, w1 = h1 + T_SWAP, h2 = w1 + T_HOLD;
  return { strokes, m0, m1, s1, h1, w1, h2, total: h2 + T_CLEAR };
}

export function setup(params) {
  params.s = { si: 0, setKnob: -1, t: 0, P: null, hue: 0, hand: -1, buf: new Float32Array(N * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3), setKnob = cl(floor(k[2] || 0), 0, 7), morph = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  if (setKnob !== S.setKnob) {
    // The panel opens on the component just written, about to change.
    S.setKnob = setKnob;
    S.si = setKnob ? setKnob - 1 : 0;
    S.P = plan(S.si);
    S.t = S.P.m0 - 0.3;
  }
  S.hand = morph > 0.1 ? (morph - 0.1) / 0.9 : -1;
  if (S.hand >= 0) return;
  S.t += (d * speed) / 2;
  if (S.t >= S.P.total) {
    S.si = setKnob ? setKnob - 1 : (S.si + 1) % SETS.length;
    S.P = plan(S.si);
    S.t = 0;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.P) return;
  const buf = S.buf, P = S.P, [fullName, sideName, map, side, parts] = SETS[S.si];
  const full = G[fullName], rad = G[sideName], hue = S.hue;
  buf.fill(0);
  // Where the set stands: a = 0 the full form, 1 the radical docked, then
  // the first part in, the swap to the second, and the clearing.
  let t = S.t, a, slide = 0, which = 0, out = 0, fade = 1;
  if (S.hand >= 0) {
    t = P.m0;
    a = cl(S.hand / 0.85, 0, 1);
    slide = cl((S.hand - 0.8) / 0.2, 0, 1);
  } else {
    a = cl((t - P.m0) / T_MORPH, 0, 1);
    slide = cl((t - P.m1) / T_SLIDE, 0, 1);
    if (t > P.h1) {
      const u = (t - P.h1) / T_SWAP;
      out = cl(u / 0.4, 0, 1);
      if (u > 0.4) [which, out, slide] = [1, 0, cl((u - 0.4) / 0.6, 0, 1)];
    }
    if (t > P.h2) fade = 1 - cl((t - P.h2) / T_CLEAR, 0, 1);
  }
  const plain = hsv(hue + 0.58, 0.16, 0.95), grid = hsv(hue + 0.6, 0.3, 0.22);
  const tint = (i) => hsv(hue + HUES[i % 4], 0.8, 1);
  // Practice squares: dashed edges and a dashed cross.
  for (const row of [0, 1])
    for (let i = 0; i < SQ; i += 2) {
      const y0 = SY[row];
      for (const [x, y] of [[1 + i, y0], [1 + i, y0 + SQ - 1], [1, y0 + i], [SQ, y0 + i], [1 + i, y0 + SQ / 2], [1 + SQ / 2, y0 + i]]) for (let q = 0; q < 3; q++) buf[(y * W + x) * 3 + q] = grid[q];
    }
  const toPanel = (sh, row, wgt, dx, dy) => sh.map(([x, y, w]) => [px(x) + dx, py(y, row) + dy, w * wgt]);
  // The full form in the top square: written by the pen, then left behind in
  // its stroke colours, dimmed, once its copy has gone.
  const leave = cl(a / 0.15, 0, 1);
  full.forEach((st, i) => {
    const sh = shape(st), s = P.strokes[i];
    const r = S.hand >= 0 ? 1 : cl((t - s.t0) / (s.t1 - s.t0), 0, 1);
    if (r <= 0) return;
    const n = max(2, Math.ceil(r * (K - 1)) + 1), pts = toPanel(sh.slice(0, n), 0, WFULL, 0, 0);
    // The last point stops where the pen is.
    const f = r * (K - 1) - (n - 2), q = sh[n - 1], p0 = sh[n - 2];
    pts[n - 1] = [px(p0[0] + (q[0] - p0[0]) * f), py(p0[1] + (q[1] - p0[1]) * f, 0), (p0[2] + (q[2] - p0[2]) * f) * WFULL];
    ink(buf, pts, mix(plain, mix(mix(tint(i), [1, 1, 1], 0.2), [0, 0, 0], 0.36), leave), fade, 0);
    if (r < 1) {
      const [hx, hy] = pts[n - 1];
      for (let y = floor(hy) - 2; y <= floor(hy) + 2; y++)
        for (let x = floor(hx) - 2; x <= floor(hx) + 2; x++) {
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const w = cl(1.3 - ((x + 0.5 - hx) ** 2 + (y + 0.5 - hy) ** 2) / 3, 0, 1);
          for (let c = 0; c < 3; c++) buf[(y * W + x) * 3 + c] += (1 - buf[(y * W + x) * 3 + c]) * w;
        }
    }
  });
  // The copy on its way down, each stroke a little after the one before,
  // moving point by point from its full shape to its radical shape.
  if (a > 0) {
    const n = full.length, lag = 0.1;
    full.forEach((st, i) => {
      const [j, how] = map[i], e = ease(cl((a - lag * i) / (1 - lag * (n - 1)), 0, 1));
      const from = shape(st), to = how === 1 ? [...shape(rad[j])].reverse() : shape(rad[j]);
      // A stroke that melts thins away at full colour; faded, gold goes brown.
      const thin = how === 2 ? 1 - cl((e - 0.7) / 0.3, 0, 1) : 1;
      const pts = from.map((p, k) => {
        const q = to[k];
        return [px(p[0] + (q[0] - p[0]) * e), py(p[1], 0) + (py(q[1], 1) - py(p[1], 0)) * e, (p[2] * WFULL + (q[2] * WPART - p[2] * WFULL) * e) * thin];
      });
      if (thin > 0.05) ink(buf, pts, tint(i), fade * cl(a / 0.05, 0, 1), 0);
    });
  }
  // The other part slides in from the side the radical leaves open.
  if (slide > 0 || out > 0) {
    const part = G[parts[which]], u = out > 0 ? 1 - ease(out) : ease(slide), off = (1 - u) * 46;
    const dx = side === "L" ? off : side === "R" ? -off : 0, dy = side === "B" ? -off : 0;
    for (const st of part) ink(buf, toPanel(shape(st), 1, WPART, dx, dy), plain, u * fade, SY[1]);
  }
  for (let p = 0; p < N; p++) display.setPixel(p % W, floor(p / W), round(min(1, buf[p * 3]) * 255), round(min(1, buf[p * 3 + 1]) * 255), round(min(1, buf[p * 3 + 2]) * 255));
}
