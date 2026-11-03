// ===== Patternflow pattern =====
// Title:   Clerical Change
// Family:  type
// Idea:    The standing panel holds three tiers of one character, small seal script on top, Han clerical script in the middle and regular script at the bottom, and each character is written in seal in the tall top box with even, curved strokes, then a copy of its strokes, each piece in the colour of the seal stroke it came from, travels down into the wide middle box and turns into clerical, straightening, breaking at the corners, flattening and gaining the silkworm head and the wild-goose tail, and then travels on into the square bottom box and turns into regular script, so the six characters 木 水 日 山 子 大 each show one way the strokes changed.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: libian (隸變), the change from the small seal script (小篆) that the Qin standardized about 221 BC under Li Si, as preserved in Xu Shen's Shuowen Jiezi (說文解字, AD 100), to the clerical script (隸書) of Han stelae such as the Yiying stele (乙瑛碑, AD 153) and the Cao Quan stele (曹全碑, AD 185), with the silkworm head and wild-goose tail (蠶頭燕尾, literally swallow tail) on one stroke a character, and on to the regular script (楷書); strokes drawn for this pattern in the manner of the three scripts, not traced from any one source; the stroke-to-stroke morph after Side Radicals (pattern round 102); pattern round 103
// Round:   103
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Char=0..6, Era=0..1
//
// Knob 1: Hue. Turns the stroke colours round the wheel. At 0 the seal strokes are azure, yellow, green, pink and violet in writing order, and every clerical and regular stroke carries the colour of the seal stroke it came from, so a clerical stroke made of two seal strokes is two-coloured; at 0.5 they are orange, blue, magenta, green and lime. The last character, waiting dimmed in the tiers below, is a blue grey at 0 and turns with them.
// Knob 2: Speed. At 2 the pen writes seal at 34 LEDs a second, so seal 木 takes 3.3 s, then each change to the next script takes 2.4 s, with 0.4 s between them, and the three tiers hold 2.4 s: a character takes 11.4 s (山) to 12.1 s (日) and the six come round in 71 s. Ten times slower at 0.2, half as fast again at 3.
// Knob 3: Char. 0 goes through the six in turn, 1 to 6 keep one: 木, whose seal roots split into the left-falling and the right-falling stroke; 水, whose two broken seal strokes on the left merge into one; 日, whose round seal outline breaks at its four corners into five clerical strokes that join again into four; 山, whose seal base splits into three; 子, whose head loop opens; 大, whose drooping arms straighten into a horizontal. The panel opens on seal 木 just written, its copy setting off, with 大 still dim below.
// Knob 4: Era. Up to 0.1 the change runs by itself. Past 0.1 the knob holds it by hand: at 0.1 the copy sits on the seal, at 0.55 it has landed as clerical in the middle box, at 1 as regular in the bottom box, and in between it is on its way, part changed.

// Small seal strokes are even in width and curved: a closed outline such as
// 日 is two strokes, the left half and the right half, met at the top and
// the bottom. The clerical script of the Han breaks such curves into straight
// strokes, lifting the brush at the corners, flattens the character into a
// wide box, and gives one stroke a character the silkworm head, a blunt
// round start, and the wild-goose tail, a flared end that lifts; the old
// saying is that the silkworm does not come twice and the goose does not
// fly in pairs. Regular script keeps the straight strokes,
// joins the turning strokes again with a pressed corner, stands the
// character in a square and trades the goose tail for the pressed foot of
// the right-falling stroke.
//
// Every character here is a list of strokes on a 16 by 16 grid for each of
// the three scripts, y down, and a list of threads. A thread is one piece of
// one stroke in each script, [stroke, from, to] three times, where from and
// to are 0, 1 or a grid point the piece ends nearest. A seal stroke that
// becomes two clerical strokes is two threads; two seal strokes that become
// one clerical stroke are two threads on the same clerical stroke, end to
// end. setup() checks that the threads cover every stroke of every script
// from end to end, with no gap or overlap wider than 2 percent of it. A
// thread is resampled to 20 points by arc length in each script and moves
// point by point, turned end for end whenever that is the shorter way.
//
// The grids are mapped to three boxes: the seal into a tall one, 30 LEDs
// wide and 38 high, the clerical into a wide one, 52 by 32, and the regular
// into a square, 40 by 38. Stroke widths are 2.5 LEDs for seal, even; 2.8
// for clerical, the horizontals thinner and the goose tail up to 5.2; 3 for
// regular, pressed at starts, corners and feet. The tiers below the top keep
// the last character that reached them, dimmed, until the new copy lands.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, hypot, abs, PI, sin } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => u * u * (3 - 2 * u);

// Each script: [type, x0, y0, x1, y1, ...]. Seal strokes are all "c",
// smoothed curves. Clerical: h horizontal, H horizontal with silkworm head
// and goose tail, v vertical, pc left-falling, N right-falling with goose
// tail, hp horizontal then left-falling, vgc vertical ending in a curve.
// Regular: h, v, p left-falling, n right-falling, hz horizontal then down,
// vz vertical then right, hp, vg vertical with a hook.
const CH = [
  {
    name: "mu",
    seal: [
      ["c", 2.6, 1.4, 3.2, 3.8, 5, 5.6, 8, 6.6, 11, 5.6, 12.8, 3.8, 13.4, 1.4],
      ["c", 8, 0.8, 8, 15.2],
      ["c", 2.4, 15.2, 3.2, 12.4, 5, 10.4, 8, 9.4, 11, 10.4, 12.8, 12.4, 13.6, 15.2],
    ],
    cler: [
      ["h", 1.2, 4.8, 14.8, 4.8],
      ["v", 8, 1, 8, 15],
      ["pc", 7.6, 5.4, 5.8, 8.4, 3, 10.8, 1, 11.4],
      ["N", 8.4, 5.4, 10.4, 8.2, 12.6, 10.6, 14.2, 11.4, 15.6, 11.1],
    ],
    reg: [
      ["h", 2, 5.3, 14, 4.9],
      ["v", 8, 1, 8, 15.4],
      ["p", 7.6, 5.6, 6.2, 9.4, 1.8, 13.2],
      ["n", 8.4, 5.8, 10.6, 9.6, 14.8, 13.4],
    ],
    th: [
      [0, 0, 1, 0, 0, 1, 0, 0, 1],
      [1, 0, 1, 1, 0, 1, 1, 0, 1],
      [2, 0, [8, 9.4], 2, 0, 1, 2, 0, 1],
      [2, [8, 9.4], 1, 3, 0, 1, 3, 0, 1],
    ],
  },
  {
    name: "shui",
    seal: [
      ["c", 8, 0.8, 8.9, 3.2, 7.1, 6.6, 8.9, 10, 7.2, 13.2, 8, 15.2],
      ["c", 5.4, 1.4, 3.6, 3.4, 2.8, 6.6],
      ["c", 2.8, 9.2, 3.6, 12.2, 5.4, 14.6],
      ["c", 10.6, 1.4, 12.4, 3.4, 13.2, 6.6],
      ["c", 13.2, 9.2, 12.4, 12.2, 10.6, 14.6],
    ],
    cler: [
      ["vgc", 8, 1, 8, 13.4, 7.6, 14.4, 6.4, 14.2],
      ["hp", 2.4, 5, 6.4, 5, 4.6, 8.4, 1.6, 11.6],
      ["pc", 13.2, 3, 11.8, 4.8, 9.6, 6.2],
      ["N", 9.4, 6.6, 11.2, 9, 13.2, 11, 14.6, 11.6, 15.6, 11.3],
    ],
    reg: [
      ["vg", 8, 1, 8, 14.8, 6.4, 13.6],
      ["hp", 2.6, 5.6, 6.4, 5.6, 4.8, 9, 1.8, 12.6],
      ["p", 13.2, 3.6, 11.8, 5.6, 9.8, 7.2],
      ["n", 9.2, 7.2, 11.4, 10.6, 15, 14],
    ],
    th: [
      [0, 0, 1, 0, 0, 1, 0, 0, 1],
      [1, 0, 1, 1, 0, [6.4, 5], 1, 0, [6.4, 5.6]],
      [2, 0, 1, 1, [6.4, 5], 1, 1, [6.4, 5.6], 1],
      [3, 0, 1, 2, 0, 1, 2, 0, 1],
      [4, 0, 1, 3, 0, 1, 3, 0, 1],
    ],
  },
  {
    name: "ri",
    seal: [
      ["c", 8, 1, 4.4, 1, 3, 2.4, 3, 13.6, 4.4, 15, 8, 15],
      ["c", 8, 1, 11.6, 1, 13, 2.4, 13, 13.6, 11.6, 15, 8, 15],
      ["c", 3, 8, 13, 8],
    ],
    cler: [
      ["v", 2.6, 2.2, 2.6, 13.8],
      ["h", 2.6, 2.2, 13.4, 2.2],
      ["v", 13.4, 2.2, 13.4, 13.8],
      ["h", 2.6, 8, 13.4, 8],
      ["h", 2, 13.8, 14, 13.8],
    ],
    reg: [
      ["v", 4.6, 1.4, 4.6, 14.6],
      ["hz", 4.6, 1.4, 11.4, 1.4, 11.4, 14.6],
      ["h", 4.6, 8, 11.4, 8],
      ["h", 4.6, 14.6, 11.4, 14.6],
    ],
    th: [
      [0, 0, [3.4, 1.4], 1, [8, 2.2], 0, 1, [8, 1.4], 0],
      [0, [3.4, 1.4], [3.4, 14.6], 0, 0, 1, 0, 0, 1],
      [0, [3.4, 14.6], 1, 4, 0, [8, 13.8], 3, 0, [8, 14.6]],
      [1, 0, [12.6, 1.4], 1, [8, 2.2], 1, 1, [8, 1.4], [11.4, 1.4]],
      [1, [12.6, 1.4], [12.6, 14.6], 2, 0, 1, 1, [11.4, 1.4], 1],
      [1, [12.6, 14.6], 1, 4, [8, 13.8], 1, 3, [8, 14.6], 1],
      [2, 0, 1, 3, 0, 1, 2, 0, 1],
    ],
  },
  {
    name: "shan",
    seal: [
      ["c", 8, 1, 8, 14.6],
      ["c", 2.6, 4.6, 2.6, 12.6, 4.4, 14.6, 11.6, 14.6, 13.4, 12.6, 13.4, 4.6],
    ],
    cler: [
      ["v", 8, 1.6, 8, 13.4],
      ["v", 3, 6, 3, 13.4],
      ["v", 13, 5.2, 13, 13.4],
      ["H", 1.6, 13.6, 9, 13.7, 12.6, 13.5, 14.4, 12.9, 15.6, 12.6],
    ],
    reg: [
      ["v", 8, 1, 8, 14.2],
      ["vz", 3.6, 5.4, 3.6, 14.2, 12.6, 14.2],
      ["v", 12.6, 5, 12.6, 14.6],
    ],
    th: [
      [0, 0, 1, 0, 0, 1, 0, 0, 1],
      [1, 0, [2.9, 13.7], 1, 0, 1, 1, 0, [3.6, 14.2]],
      [1, [2.9, 13.7], [13.1, 13.7], 3, 0, 1, 1, [3.6, 14.2], 1],
      [1, [13.1, 13.7], 1, 2, 0, 1, 2, 0, 1],
    ],
  },
  {
    name: "zi",
    seal: [
      ["c", 8, 5.8, 6.2, 5.4, 5.4, 3.4, 6, 1.6, 8, 0.9, 10, 1.6, 10.6, 3.4, 9.8, 5.4, 8, 5.8],
      ["c", 8, 5.8, 8, 12.6, 7.6, 14.4, 6.4, 15.2, 5.2, 14.8],
      ["c", 1.8, 3.4, 2.8, 6.6, 5.2, 8.4, 8, 8.9, 10.8, 8.4, 13.2, 6.6, 14.2, 3.4],
    ],
    cler: [
      ["hp", 3.2, 2, 11.6, 2, 10, 3.8, 8.4, 5.8],
      ["vgc", 8.4, 5.8, 8.4, 13.2, 7.8, 14.4, 5.8, 14.6],
      ["H", 0.8, 8.6, 9, 8.7, 13, 8.5, 14.6, 7.9, 15.6, 7.6],
    ],
    reg: [
      ["hp", 3.6, 1.8, 11.8, 1.8, 10.2, 3.8, 8.3, 6],
      ["vg", 8.3, 6, 8.3, 14.8, 6.4, 13.6],
      ["h", 1.6, 9.4, 14.4, 8.8],
    ],
    th: [
      [0, 0, 1, 0, 0, 1, 0, 0, 1],
      [1, 0, 1, 1, 0, 1, 1, 0, 1],
      [2, 0, 1, 2, 0, 1, 2, 0, 1],
    ],
  },
  {
    name: "da",
    seal: [
      ["c", 1.4, 11, 2.2, 7.4, 4.6, 5.2, 8, 4.5, 11.4, 5.2, 13.8, 7.4, 14.6, 11],
      ["c", 8, 0.8, 8, 4.5, 7.6, 8.4, 5.8, 12, 3.2, 15.2],
      ["c", 8, 4.6, 8.4, 8.4, 10.2, 12, 12.8, 15.2],
    ],
    cler: [
      ["h", 1, 5.4, 15, 5.4],
      ["pc", 8, 1, 8, 5.6, 6.4, 9.4, 3.4, 12.4, 1.2, 13],
      ["N", 8.4, 6, 10.2, 9, 12.4, 11.6, 14.2, 12.5, 15.6, 12.2],
    ],
    reg: [
      ["h", 2, 5.8, 14, 5.3],
      ["p", 8, 1, 8, 6.4, 6.2, 10.6, 1.8, 15],
      ["n", 8.4, 7.4, 10.8, 11, 15, 15],
    ],
    th: [
      [0, 0, 1, 0, 0, 1, 0, 0, 1],
      [1, 0, 1, 1, 0, 1, 1, 0, 1],
      [2, 0, 1, 2, 0, 1, 2, 0, 1],
    ],
  },
];
const SCRIPTS = ["seal", "cler", "reg"];
// The boxes [left, top, width, height] and base stroke widths in LEDs.
const BOX = [[17, 2, 30, 38], [6, 48, 52, 32], [12, 87, 40, 38]];
const WID = [2.5, 2.8, 3];
const K = 20;
const HUES = [0.56, 0.155, 0.36, 0.9, 0.74];
// Story seconds at Speed 2: the old seal fading, the pen in LEDs a second
// and its rest between strokes, the pause, a change, the rest between the
// changes, the hold, and the light of a tier the new copy has not reached.
const T_CLEAR = 0.5, PEN = 34, REST = 0.12, T_PAUSE = 0.35, T_MORPH = 2.4, T_MID = 0.4, T_HOLD = 2.4, OLD = 0.45, LAG = 0.08;

// The vertices where a stroke turns sharply instead of bending.
function sharpAt(type, n) {
  if (type === "hz" || type === "vz" || type === "hp") return [1];
  if (type === "vg") return [n - 2];
  return [];
}

// Chaikin's corner cutting, three times, keeping the ends.
function chaikin(pts) {
  for (let it = 0; it < 3 && pts.length > 2; it++) {
    const r = [pts[0]];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      if (i > 0) r.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      if (i + 2 < pts.length) r.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    r.push(pts[pts.length - 1]);
    pts = r;
  }
  return pts;
}

// A stroke as a dense polyline with its arc lengths and the arc-length
// share of each sharp corner. Straight strokes and sharp corners stay as
// drawn; every other run between corners is smoothed.
function build(st) {
  const [type, ...c] = st, raw = [];
  for (let i = 0; i < c.length; i += 2) raw.push([c[i], c[i + 1]]);
  const sharp = sharpAt(type, raw.length), smooth = !["h", "v", "hz", "vz"].includes(type);
  let pts = [], cut = [0, ...sharp, raw.length - 1];
  const corners = [];
  for (let k = 0; k + 1 < cut.length; k++) {
    const run = raw.slice(cut[k], cut[k + 1] + 1), sm = smooth ? chaikin(run) : run;
    if (k > 0) corners.push(pts.length - 1);
    pts = pts.concat(k > 0 ? sm.slice(1) : sm);
  }
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const T = L[L.length - 1];
  return { type, pts, L, T, ks: corners.map((i) => L[i] / T) };
}

function pointAt(sk, s) {
  const { pts, L, T } = sk, sl = cl(s, 0, 1) * T;
  let lo = 0, hi = L.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (L[m] <= sl) lo = m;
    else hi = m;
  }
  const u = (sl - L[lo]) / (L[hi] - L[lo] || 1);
  return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * u, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * u];
}

// The arc-length share of the stroke's point nearest (x, y).
function nearest(sk, x, y) {
  let best = 0, bd = 1e9;
  for (let i = 0; i <= 400; i++) {
    const p = pointAt(sk, i / 400), d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
    if (d < bd) [bd, best] = [d, i / 400];
  }
  return best;
}

const bump = (s, c, w) => max(0, 1 - abs((s - c) / w));
// Width as a share of the script's base width at share s along the stroke.
function profile(script, type, s, ks) {
  if (script === 0) return 1;
  const k = ks[0] ?? 0.5;
  if (script === 1) {
    if (type === "h") return s < 0.08 ? 1.3 - 5 * s : s > 0.92 ? 0.9 + (s - 0.92) * 2 : 0.9;
    if (type === "H") return s < 0.12 ? 1.55 - 6.2 * s : s < 0.72 ? 0.81 : s < 0.9 ? 0.81 + (s - 0.72) * 5.3 : 1.76 - (s - 0.9) * 13;
    if (type === "N") return s < 0.7 ? 0.55 + 0.7 * s : s < 0.88 ? 1.04 + (s - 0.7) * 4.6 : 1.87 - (s - 0.88) * 12;
    if (type === "pc") return s < 0.85 ? 1 + 0.18 * s : 1.15 - (s - 0.85) * 2;
    if (type === "hp") return s < k ? 0.9 : 1 + 0.15 * (s - k);
    if (type === "vgc") return s < 0.85 ? 1.05 : 1.05 - (s - 0.85) * 2.4;
    return 1.05;
  }
  if (type === "h") return s < 0.07 ? 1.22 - 5 * s : s > 0.9 ? 0.87 + (s - 0.9) * 3 : 0.87;
  if (type === "v") return s < 0.05 ? 1.2 - 4 * s : 1 - 0.1 * s;
  if (type === "p") return s < 0.3 ? 1.1 : 1.1 - (s - 0.3) * 1.3;
  if (type === "n") return s < 0.6 ? 0.45 + 0.9 * s : s < 0.86 ? 1 + (s - 0.6) * 2.3 : 1.6 - (s - 0.86) * 10;
  if (type === "hz") return (s < k ? (s < 0.05 ? 1.15 : 0.86) : 1) + 0.4 * bump(s, k, 0.06);
  if (type === "vz") return (s < k ? 1 : s > 0.92 ? 1.12 : 0.88) + 0.15 * bump(s, k, 0.06);
  if (type === "hp") return s < k ? (s < 0.05 ? 1.15 : 0.86) + 0.4 * bump(s, k, 0.08) : 1.2 - (s - k) / (1 - k);
  if (type === "vg") return s < k ? 1.05 : 1.25 - ((s - k) / (1 - k)) * 1.05;
  return 1;
}

// The panel point of grid point (x, y) in tier t.
const toPanel = (t, x, y) => [BOX[t][0] + (x / 16) * BOX[t][2], BOX[t][1] + (y / 16) * BOX[t][3]];

// Every character's threads as K panel points [x, y, width] per tier,
// each turned for the shorter way to the next tier, and the check that the
// threads cover every stroke.
function prepare(ch) {
  const sk = SCRIPTS.map((sc) => ch[sc].map(build));
  const at = (t, i, v) => (Array.isArray(v) ? nearest(sk[t][i], v[0], v[1]) : v);
  const cover = SCRIPTS.map((sc) => ch[sc].map(() => []));
  const threads = ch.th.map((th) => {
    const tiers = [0, 1, 2].map((t) => {
      const i = th[3 * t], a = at(t, i, th[3 * t + 1]), b = at(t, i, th[3 * t + 2]), s = sk[t][i];
      cover[t][i].push([min(a, b), max(a, b)]);
      const P = [];
      for (let k = 0; k < K; k++) {
        const u = a + ((b - a) * k) / (K - 1), [x, y] = pointAt(s, u), [px, py] = toPanel(t, x, y);
        P.push([px, py, WID[t] * profile(t, s.type, u, s.ks), x, y]);
      }
      return P;
    });
    // Turn each later tier's points so the move to them is the shorter way.
    for (let t = 1; t < 3; t++) {
      let same = 0, back = 0;
      for (let k = 0; k < K; k++) {
        const p = tiers[t - 1][k], q = tiers[t][k], r = tiers[t][K - 1 - k];
        same += (p[3] - q[3]) ** 2 + (p[4] - q[4]) ** 2;
        back += (p[3] - r[3]) ** 2 + (p[4] - r[4]) ** 2;
      }
      tiers[t].flip = back < same;
    }
    return { seal: th[0], tiers };
  });
  let ok = true;
  for (const strokes of cover)
    for (const ranges of strokes) {
      ranges.sort((a, b) => a[0] - b[0]);
      let end = 0;
      for (const [a, b] of ranges) {
        if (abs(a - end) > 0.02) ok = false;
        end = b;
      }
      if (abs(end - 1) > 0.02) ok = false;
    }
  return { sk, threads, ok };
}

// One character's clock: the old seal fading, the strokes written, the
// pause, the two changes with a rest between, and the hold.
function plan(G) {
  let t = T_CLEAR;
  const strokes = G.sk[0].map((s, i) => {
    const a = t, b = t + G.lenPx[i] / PEN;
    t = b + REST;
    return [a, b];
  });
  const m1 = t + T_PAUSE, m2 = m1 + T_MORPH + T_MID;
  return { strokes, m1, m2, total: m2 + T_MORPH + T_HOLD };
}

function strokeLen(sk) {
  let L = 0;
  for (let i = 1; i < sk.pts.length; i++) {
    const [ax, ay] = toPanel(0, ...sk.pts[i - 1]), [bx, by] = toPanel(0, ...sk.pts[i]);
    L += hypot(bx - ax, by - ay);
  }
  return L;
}

export function setup(params) {
  const G = CH.map(prepare);
  for (const g of G) g.lenPx = g.sk[0].map(strokeLen);
  params.s = { G, ok: G.every((g) => g.ok), ci: 0, prev: CH.length - 1, charKnob: -1, t: 0, P: null, hue: 0, hand: -1, buf: new Float32Array(N * 3), cov: new Float32Array(N) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3), ck = cl(floor(k[2] || 0), 0, 6), era = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  if (ck !== S.charKnob) {
    // The panel opens as the pen finishes the seal, 1.2 s before the copy
    // sets off, with the last character still in the tiers below.
    S.charKnob = ck;
    S.ci = ck ? ck - 1 : 0;
    S.prev = ck ? ck - 1 : CH.length - 1;
    S.P = plan(S.G[S.ci]);
    S.t = S.P.m1 - 1.2;
  }
  S.hand = era > 0.1 ? ((era - 0.1) / 0.9) * 2 : -1;
  if (S.hand >= 0) return;
  S.t += (d * speed) / 2;
  if (S.t >= S.P.total) {
    S.prev = S.ci;
    // The cycle passes over a character whose threads failed the check.
    let n = ck ? ck - 1 : (S.ci + 1) % CH.length;
    for (let i = 0; !ck && i < CH.length && !S.G[n].ok; i++) n = (n + 1) % CH.length;
    S.ci = n;
    S.P = plan(S.G[S.ci]);
    S.t = 0;
  }
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// A run of panel points [x, y, width]: the cover of the capsules between
// them, laid over what is there in colour col at strength alpha.
function ink(S, P, col, alpha) {
  if (alpha <= 0.01 || P.length < 2) return;
  const { buf, cov } = S, touched = [];
  for (let i = 0; i + 1 < P.length; i++) {
    const [ax, ay, aw] = P[i], [bx, by, bw] = P[i + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, r = max(aw, bw) / 2 + 1;
    for (let y = max(0, floor(min(ay, by) - r)); y <= min(H - 1, floor(max(ay, by) + r)); y++)
      for (let x = max(0, floor(min(ax, bx) - r)); x <= min(W - 1, floor(max(ax, bx) + r)); x++) {
        const qx = x + 0.5 - ax, qy = y + 0.5 - ay, u = l2 > 0 ? cl((qx * dx + qy * dy) / l2, 0, 1) : 0;
        const c = cl((aw + (bw - aw) * u) / 2 + 0.5 - hypot(qx - u * dx, qy - u * dy), 0, 1), p = y * W + x;
        if (c <= 0) continue;
        if (cov[p] === 0) touched.push(p);
        if (c > cov[p]) cov[p] = c;
      }
  }
  for (const p of touched) {
    const a = cov[p] * alpha;
    for (let q = 0; q < 3; q++) buf[p * 3 + q] += (col[q] - buf[p * 3 + q]) * a;
    cov[p] = 0;
  }
}

// A thread's points in tier t, in the order of the move to them from
// tier t - 1.
function pts(th, t) {
  const P = th.tiers[t];
  return P.flip ? [...P].reverse() : P;
}

// A whole glyph as it stands in tier t, at light v.
function stand(S, G, t, v, colours) {
  for (const th of G.threads) ink(S, th.tiers[t], colours[th.seal].map((c) => c * v), 1);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.P) return;
  const { buf } = S, G = S.G[S.ci], Gp = S.G[S.prev], P = S.P;
  buf.fill(0);
  const colours = HUES.map((h) => hsv(S.hue + h, 0.85, 1)), grey = hsv(S.hue + 0.6, 0.35, 1);
  // Where the character stands: a runs 0 to 1 over the change to clerical
  // and 1 to 2 over the change to regular.
  let t = S.t, a;
  if (S.hand >= 0) {
    a = S.hand;
    t = P.m1;
  } else a = t < P.m1 ? 0 : t < P.m1 + T_MORPH ? (t - P.m1) / T_MORPH : t < P.m2 ? 1 : min(2, 1 + (t - P.m2) / T_MORPH);
  // A tier dims a little while the copy it sent is on its way, and every
  // tier stands at the same light again once the regular form has landed.
  const away = (from) => cl((a - from) / 0.12, 0, 1) * cl((2 - a) / 0.15, 0, 1);
  const lit = [0.95 - 0.25 * away(0), 0.95 - 0.2 * away(1), 0.95];
  // Faint rules between the tiers.
  for (let x = 2; x < W - 2; x += 3)
    for (const y of [44, 84]) for (let q = 0; q < 3; q++) buf[(y * W + x) * 3 + q] = grey[q] * 0.16;
  // Top: the old seal fading, then the new one written stroke by stroke.
  if (S.hand < 0 && t < T_CLEAR) stand(S, S.G[S.prev], 0, 0.85 * (1 - t / T_CLEAR), colours);
  G.sk[0].forEach((sk, i) => {
    const [t0, t1] = P.strokes[i], r = S.hand >= 0 ? 1 : cl((t - t0) / (t1 - t0), 0, 1);
    if (r <= 0) return;
    const n = max(2, Math.ceil(r * 40) + 1), run = [];
    for (let k = 0; k < n; k++) {
      const [x, y] = pointAt(sk, (r * k) / (n - 1)), [px, py] = toPanel(0, x, y);
      run.push([px, py, WID[0]]);
    }
    ink(S, run, colours[i].map((c) => c * lit[0]), 1);
    if (r < 1) {
      const [hx, hy] = run[n - 1];
      for (let y = floor(hy) - 2; y <= floor(hy) + 2; y++)
        for (let x = floor(hx) - 2; x <= floor(hx) + 2; x++) {
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const w = cl(1.3 - ((x + 0.5 - hx) ** 2 + (y + 0.5 - hy) ** 2) / 3, 0, 1), o = (y * W + x) * 3;
          for (let c = 0; c < 3; c++) buf[o + c] += (1 - buf[o + c]) * w;
        }
    }
  });
  // The lower tiers: the last character until the new copy lands, then the
  // new one; the tier the copy is on its way to dims its old glyph as it
  // comes.
  for (const tier of [1, 2]) {
    if (a >= tier) stand(S, G, tier, lit[tier], colours);
    else {
      // The last character turns from its colours to a dim blue grey while
      // the old seal clears, and fades as the new copy comes.
      const going = a > tier - 1 ? cl((a - (tier - 1) - 0.45) / 0.45, 0, 1) : 0, k = S.hand < 0 ? cl(t / T_CLEAR, 0, 1) : 1;
      const old = colours.map((c) => c.map((v, q) => v * lit[tier] * (1 - k) + grey[q] * OLD * k));
      stand(S, Gp, tier, 1 - going, old);
    }
  }
  // The copy on its way, each thread a little after the one before.
  if (a > 0 && a < 2 && a !== 1) {
    const from = a < 1 ? 0 : 1, u = a - from, n = G.threads.length;
    G.threads.forEach((th, i) => {
      const e = ease(cl((u - LAG * i) / (1 - LAG * (n - 1)), 0, 1));
      // Not left yet: it is still in the tier it comes from. Landed: it
      // stands in the tier it went to.
      if (e <= 0) return;
      if (e >= 1) return ink(S, th.tiers[from + 1], colours[th.seal].map((c) => c * lit[from + 1]), 1);
      const A = th.tiers[from], B = pts(th, from + 1);
      const Q = A.map((p, k) => {
        const q = B[k];
        return [p[0] + (q[0] - p[0]) * e, p[1] + (q[1] - p[1]) * e, p[2] + (q[2] - p[2]) * e];
      });
      const lift = sin(PI * e), col = colours[th.seal].map((c) => (c + (1 - c) * 0.25 * lift) * (0.88 + 0.12 * lift));
      ink(S, Q, col, 1);
    });
  }
  for (let p = 0; p < N; p++) display.setPixel(p % W, floor(p / W), round(min(1, buf[p * 3]) * 255), round(min(1, buf[p * 3 + 1]) * 255), round(min(1, buf[p * 3 + 2]) * 255));
}
