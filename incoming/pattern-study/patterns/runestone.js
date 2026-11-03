// ===== Patternflow pattern =====
// Title:   Runestone
// Family:  type
// Idea:    A serpent band 16 LEDs wide winds down the whole stone in U-turns from its head at the top left to its tail at the bottom, and Harald Bluetooth's inscription from the larger Jelling stone, in Younger Futhark runes cut across the band, slides along it toward the head, each rune carved stroke by stroke by a white spark where it enters at the tail and then painted, while the serpent swallows the oldest words at its jaws.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the larger Jelling stone (DR 42, raised by Harald Bluetooth about 965), side A to C in its standard transliteration (Samnordisk runtextdatabas); Younger Futhark long-branch and short-twig runes drawn as strokes after the reference glyphs of the Unicode Runic block; the serpent band after the Uppland stones of the eleventh century; pattern round 100
// Round:   100
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Turns=3..6, Twig=0..1
//
// Knob 1: Hue. Turns the paint round the wheel. At 0 the runes and the band's two cut edges are painted yellow ochre on a deep blue serpent; at 0.87 the runes are red ochre on teal, at 0.5 blue on brown.
// Knob 2: Speed. The text slides 2.5 LEDs a second along the band for each unit: 5 at 2, a rune every 1.5 s, so the 153 signs of the inscription come round in 3.5 minutes; 0.5 a second at 0.2 and 7.5 at 3.
// Knob 3: Turns. The U-turns the band makes on its way down, 3 to 6. At 3 the turns are 36 rows across and the band holds about 30 signs; at 6 they are 18 rows across, the straight runs longer, and it holds about 52.
// Knob 4: Twig. Morphs every rune from the long-branch form of the Jelling stone (0 to 0.1) to the short-twig form of the Swedish and Norwegian stones (0.9 to 1): the crossing branches of n, a and ą shrink to one-sided twigs, h and m to a knot on the staff, s and R to half a staff, t loses a branch and the two bows of b open into two twigs, and the signs close up from 7.6 to 6.2 LEDs apart, so about 36 signs fit the band at 3 Turns instead of 30. f, u, þ, r, k, i and l are the same in both.

// The band is a path: a straight neck from the head, then n + 1 level runs
// joined by n half circles of radius b, alternately on the right and the
// left, where b = 54 / n rows, then a tapering tail. Every LED near the path
// is given the arc length u of its nearest point on the path and its signed
// distance v from it (positive to the left of the direction of reading), and
// the text is set in that frame: a rune's staff runs across the band and the
// text runs along it, so on the leftward runs the runes stand on their heads,
// as on the stones, where the reader walks round. The map is rebuilt only
// when Turns changes.
//
// Runes are drawn from straight strokes in a 4 by 8 box, 4.25 by 8.5 LEDs
// on the panel (3.6 wide in the short-twig form), each stroke 1.9 LEDs
// thick, with 1.4 LEDs of dark band between a rune and the painted edges, so
// a rune reads on the LEDs at any angle the band takes. Every rune has the same five strokes in both forms,
// some of them shrunk to a point, so Twig moves each end in a straight line.
//
// The text slides toward the head. Where a sign enters the band at the tail
// end it is carved: a spark runs along its strokes in order, leaving pale
// fresh-cut stone, in the time the sign takes to move one place, and in the
// next two places the paint comes up in it. At the neck the signs go into
// the serpent's open jaws. A two-dot divider follows every word.

const W = 64, H = 128;
const { floor, round, min, max, abs, sin, cos, exp, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// DR 42, the larger Jelling stone: "King Harald ordered this monument made
// in memory of Gorm, his father, and in memory of Thyre, his mother; that
// Harald who won for himself all of Denmark and Norway and made the Danes
// Christian." Read as one line across its three sides.
const TEXT =
  "haraltr kunukR baþ kaurua kubl þausi aft kurm faþur sin auk aft þąurui muþur sina sa haraltr ias sąR uan tanmaurk ala auk nuruiak auk tani karþi kristną";

// Each rune as five strokes [x0, y0, x1, y1] in a 4 by 8 box (y down), the
// long-branch form first and then the short-twig form; a stroke with both
// ends on one point is a stroke that is not there in that form.
const P = (x, y) => [x, y, x, y];
const RUNES = {
  f: [[[0.6, 0, 0.6, 8], [0.6, 2.4, 3.2, 0], [0.6, 5.6, 3.8, 2.4]]],
  u: [[[0.6, 8, 0.6, 0], [0.6, 0, 3.6, 3], [3.6, 3, 3.6, 8]]],
  þ: [[[0.6, 0, 0.6, 8], [0.6, 1.8, 3.5, 4], [3.5, 4, 0.6, 6.2]]],
  ą: [[[2, 0, 2, 8], [0, 0.8, 4, 3.6], [0, 4, 4, 6.8]], [[1.4, 0, 1.4, 8], [1.4, 2, 3.6, 3.8], [1.4, 5, 3.6, 6.8]]],
  r: [[[0.6, 0, 0.6, 8], [0.6, 0, 3.4, 2.1], [3.4, 2.1, 0.6, 4.2], [0.6, 4.2, 3.6, 8]]],
  k: [[[0.6, 0, 0.6, 8], [0.6, 3.6, 3.6, 0.2]]],
  h: [[[2, 0, 2, 8], [0, 1.8, 4, 6.2], [4, 1.8, 0, 6.2]], [[2, 0, 2, 8], [1, 3.4, 3, 4.6], [3, 3.4, 1, 4.6]]],
  n: [[[2, 0, 2, 8], [0, 2, 4, 6]], [[2, 0, 2, 8], [2, 3, 3.9, 5]]],
  i: [[[2, 0, 2, 8]]],
  a: [[[2, 0, 2, 8], [4, 2, 0, 6]], [[2, 0, 2, 8], [2, 3, 0.1, 5]]],
  s: [[[0.4, 0, 0.4, 4.8], [0.4, 4.8, 3.6, 2.6], [3.6, 2.6, 3.6, 8]], [[2, 0, 2, 3.8], P(2, 3.8), P(2, 3.8)]],
  t: [[[2, 0, 2, 8], [0, 2.6, 2, 0], [2, 0, 4, 2.6]], [[2.4, 0, 2.4, 8], [0.2, 2.6, 2.4, 0], P(2.4, 0)]],
  b: [
    [[0.6, 0, 0.6, 8], [0.6, 0, 3.4, 2], [3.4, 2, 0.6, 4], [0.6, 4, 3.4, 6], [3.4, 6, 0.6, 8]],
    [[0.6, 0, 0.6, 8], P(0.6, 3.2), [2.9, 0.9, 0.6, 3.2], P(0.6, 6.4), [2.9, 4.1, 0.6, 6.4]],
  ],
  m: [[[2, 0, 2, 8], [0, 0, 2, 2.8], [4, 0, 2, 2.8]], [[2, 0, 2, 8], [1.1, 0.3, 2, 1.3], [2.9, 0.3, 2, 1.3]]],
  l: [[[0.6, 0, 0.6, 8], [0.6, 0, 3.6, 3]]],
  R: [[[2, 0, 2, 8], [2, 5.2, 0, 8], [2, 5.2, 4, 8]], [[2, 4.2, 2, 8], P(2, 8), P(2, 8)]],
};
const STROKES = 5;

// Box to LEDs across the band, and along it at the long-branch and the
// short-twig end of Twig; the stroke radius in LEDs; a rune's advance along
// the band in LEDs at the two ends; a divider's advance as a share of a
// rune's; the divider's dot radius.
const SC = 1.0625, SCX0 = 1.0625, SCX1 = 0.9, RAD = 0.95, ADV0 = 7.6, ADV1 = 6.2, DIVU = 0.55, DOT = 1.15;
// The band: half width, the cut edge's width, the rows of the top and
// bottom runs, the head's and tail's lengths along the path.
const HW = 8, EDGE = 1.4, TOP = 11, BOTTOM = 119, HEAD = 15, TAIL = 15, DS = 0.25;
// LEDs a second for each unit of Speed, and how many places a sign moves
// while it is carved and while it is painted.
const RATE = 2.5, CARVE = 1, PAINT = 2;

// Glyph table: 16 runes and the divider; each holds both forms' strokes.
const KEYS = Object.keys(RUNES);
const FORMS = KEYS.map((key) => {
  const [L, Sh = L] = RUNES[key];
  const pad = (list) => {
    const out = list.map((s) => s.slice());
    while (out.length < STROKES) out.push(P(list[0][2], list[0][3]));
    return out;
  };
  return [pad(L), pad(Sh)];
});

// The text as a list of signs: a rune index, or -1 for a divider, with the
// start of each sign along the text and its advance, counted in runes.
const SIGNS = [], START = [], WIDE = [];
{
  let x = 0;
  for (const word of TEXT.split(" ")) {
    for (const ch of word) {
      SIGNS.push(KEYS.indexOf(ch));
      START.push(x);
      WIDE.push(1);
      x += 1;
    }
    SIGNS.push(-1);
    START.push(x);
    WIDE.push(DIVU);
    x += DIVU;
  }
  START.push(x);
}
const TOTAL = START[SIGNS.length];

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// The path for n turns: samples every DS LEDs of arc length, starting at
// the snout (u = -HEAD), with position and unit tangent.
function path(n) {
  const b = (BOTTOM - TOP) / (2 * n), xl = HW + b, xr = W - 1 - HW - b;
  const X = [], Y = [], TX = [], TY = [];
  let carry = 0;
  const line = (x0, y0, x1, y1) => {
    const L = hypot(x1 - x0, y1 - y0), tx = (x1 - x0) / L, ty = (y1 - y0) / L;
    let s = carry;
    for (; s < L; s += DS) X.push(x0 + tx * s), Y.push(y0 + ty * s), TX.push(tx), TY.push(ty);
    carry = s - L;
  };
  const arc = (cx, cy, side) => {
    const L = PI * b;
    let s = carry;
    for (; s < L; s += DS) {
      const th = -PI / 2 + s / b;
      X.push(cx + side * b * cos(th)), Y.push(cy + b * sin(th)), TX.push(-side * sin(th)), TY.push(cos(th));
    }
    carry = s - L;
  };
  line(xl - HEAD, TOP, xl, TOP);
  for (let j = 0; j <= n; j++) {
    const y = TOP + 2 * b * j, right = j % 2 === 0;
    line(right ? xl : xr, y, right ? xr : xl, y);
    if (j < n) arc(right ? xr : xl, y + b, right ? 1 : -1);
  }
  const end = (X.length - 1) * DS - HEAD, last = n % 2 === 0 ? 1 : -1, xe = n % 2 === 0 ? xr : xl;
  line(xe, BOTTOM, xe + last * (TAIL + 1), BOTTOM);
  return { X, Y, TX, TY, end };
}

// Every LED's (u, v) in the band's frame, from its nearest path sample.
function map(n) {
  const p = path(n), N = W * H, best = new Float32Array(N).fill(1e9), idx = new Int32Array(N).fill(-1);
  const R = 12;
  for (let i = 0; i < p.X.length; i++) {
    const px = p.X[i], py = p.Y[i];
    for (let y = max(0, floor(py - R)); y <= min(H - 1, Math.ceil(py + R)); y++)
      for (let x = max(0, floor(px - R)); x <= min(W - 1, Math.ceil(px + R)); x++) {
        const d = (x - px) * (x - px) + (y - py) * (y - py), o = y * W + x;
        if (d < best[o]) (best[o] = d), (idx[o] = i);
      }
  }
  const U = new Float32Array(N), V = new Float32Array(N), IN = new Uint8Array(N);
  for (let o = 0; o < N; o++) {
    const i = idx[o];
    if (i < 0) continue;
    const dx = (o % W) - p.X[i], dy = floor(o / W) - p.Y[i];
    U[o] = i * DS - HEAD + dx * p.TX[i] + dy * p.TY[i];
    V[o] = dx * p.TY[i] - dy * p.TX[i];
    IN[o] = 1;
  }
  return { n, path: p, U, V, IN, end: p.end };
}

// The band's half width at u: the head swells to an almond 1.3 times as
// wide and closes at the snout, the tail tapers to nothing.
function halfWidth(u, end) {
  if (u < 0) {
    const t = -u / HEAD;
    return t >= 1 ? 0 : HW * 1.3 * sin(PI * (0.25 + 0.75 * t)) ** 0.7;
  }
  if (u > end) return HW * max(0, 1 - (u - end) / TAIL);
  return HW;
}

export function setup(params) {
  const stone = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // Granite: a grey that wanders slowly, grains and the odd bright crystal.
      const g = 0.5 * hash(x >> 2, y >> 2) + 0.5 * hash((x + 2) >> 2, (y + 1) >> 2), r = hash(x, y);
      stone[y * W + x] = 0.075 + 0.035 * g + 0.04 * r + (r > 0.97 ? 0.08 : 0);
    }
  params.s = { scroll: 0, hue: 0, speed: 2, twig: 0.06, turns: 3, e: 0, adv: ADV0, scx: SCX0, m: null, stone, chips: [], since: 0, seg: new Float32Array(KEYS.length * STROKES * 4), first: true };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.turns = round(cl(k[2] == null ? 3 : k[2], 3, 6));
  S.twig = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  // Long-branch up to 0.1, short-twig from 0.9, eased between.
  const f = cl((S.twig - 0.1) / 0.8, 0, 1);
  S.e = f * f * (3 - 2 * f);
  S.adv = ADV0 + (ADV1 - ADV0) * S.e;
  S.scx = SCX0 + (SCX1 - SCX0) * S.e;
  if (!S.m || S.m.n !== S.turns) S.m = map(S.turns);
  if (S.first) {
    // Open with the first word just inside the jaws and the band full.
    S.scroll = -2 / S.adv;
    S.first = false;
  }
  // scroll counts runes, so the text keeps its speed in LEDs whatever Twig.
  S.scroll += (d * S.speed * RATE) / S.adv;
  // Chips fly from the spark.
  S.since += d;
  for (const c of S.chips) (c.x += c.vx * d), (c.y += c.vy * d), (c.vy += 40 * d), (c.life -= d);
  S.chips = S.chips.filter((c) => c.life > 0);
  if (S.spark && S.since > 0.06) {
    S.since = 0;
    const a = Math.random() * 2 * PI, v = 10 + 14 * Math.random();
    S.chips.push({ x: S.spark[0], y: S.spark[1], vx: v * cos(a), vy: v * sin(a) - 6, life: 0.25 + 0.25 * Math.random() });
  }
}

// Distance in LEDs from box point (gx, gy) to sign g's strokes, the strokes
// cut only as far as `cut` of their total length when it is under 1. With
// `spark`, returns the point the cut has reached instead.
function strokes(S, g, gx, gy, cut, spark) {
  const sx = S.scx, sy = SC;
  if (g < 0) {
    const a = cut < 1 ? cut * 2 : 2;
    if (spark) return a < 1 ? [0.5, 2.2] : [0.5, 5.8];
    let dd = 1e9;
    if (a > 0) dd = hypot((gx - 0.5) * sx, (gy - 2.2) * sy);
    if (a > 1) dd = min(dd, hypot((gx - 0.5) * sx, (gy - 5.8) * sy));
    return dd - (DOT - RAD);
  }
  const seg = S.seg, o = g * STROKES * 4;
  let left = cut < 1 ? cut * S.len[g] : 1e9, dd = 1e9, ex = seg[o], ey = seg[o + 1];
  for (let i = 0; i < STROKES && left > 0; i++) {
    const ax = seg[o + i * 4], ay = seg[o + i * 4 + 1], bx = seg[o + i * 4 + 2], by = seg[o + i * 4 + 3];
    const L = hypot(bx - ax, by - ay), f = L > 0.01 ? min(1, left / L) : 1;
    ex = ax + (bx - ax) * f;
    ey = ay + (by - ay) * f;
    left -= L;
    if (spark) continue;
    const vx = (ex - ax) * sx, vy = (ey - ay) * sy, px = (gx - ax) * sx, py = (gy - ay) * sy, l2 = vx * vx + vy * vy;
    const t = l2 > 0 ? cl((px * vx + py * vy) / l2, 0, 1) : 0;
    dd = min(dd, hypot(px - vx * t, py - vy * t));
  }
  return spark ? [ex, ey] : dd;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.m) return;
  const M = S.m, U = M.U, V = M.V, IN = M.IN, end = M.end;
  // Strokes for this Twig.
  const e = S.e, A = S.adv;
  S.len = S.len || new Float32Array(KEYS.length);
  for (let g = 0; g < KEYS.length; g++) {
    let L = 0;
    for (let i = 0; i < STROKES; i++)
      for (let c = 0; c < 4; c++) {
        const a = FORMS[g][0][i][c], b = FORMS[g][1][i][c];
        S.seg[(g * STROKES + i) * 4 + c] = a + (b - a) * e;
      }
    for (let i = 0; i < STROKES; i++) {
      const o = (g * STROKES + i) * 4;
      L += hypot(S.seg[o + 2] - S.seg[o], S.seg[o + 3] - S.seg[o + 1]);
    }
    S.len[g] = L;
  }
  const paint = hsv(S.hue + 0.13, 0.78, 1), body = hsv(S.hue + 0.6, 0.78, 0.34), groove = [0.86, 0.84, 0.78];
  // The carving point: a sign is cut while its head-side edge moves from
  // U1 to one sign's width past it, so the signs are cut one after another.
  const U1 = end - ADV0 - 1;

  // Where the sign being carved has got to, for the spark and its light.
  let spark = null;
  {
    const X = U1 / A + S.scroll, k = floor(X / TOTAL), xm = X - k * TOTAL;
    let j = 0;
    while (j + 1 < SIGNS.length && START[j + 1] <= xm) j++;
    const sj = (k * TOTAL + START[j] - S.scroll) * A, c = (U1 - sj) / (CARVE * WIDE[j] * A);
    const pt = strokes(S, SIGNS[j], 0, 0, c, true);
    const cx = SIGNS[j] < 0 ? 0.5 : 2, su = sj + (WIDE[j] * A) / 2 + (pt[0] - cx) * S.scx, sv = (4 - pt[1]) * SC;
    const pth = M.path, i = cl(round((su + HEAD) / DS), 0, pth.X.length - 1), du = su - (i * DS - HEAD);
    spark = [pth.X[i] + pth.TX[i] * du + sv * pth.TY[i], pth.Y[i] + pth.TY[i] * du - sv * pth.TX[i]];
  }
  S.spark = spark;
  const flick = 0.8 + 0.2 * Math.random();

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x, st = S.stone[o];
      let r = st, g = st * 1.02, b = st * 1.1;
      if (IN[o]) {
        const u = U[o], v = V[o], av = abs(v), hw = halfWidth(u, end);
        let a = hw > 0 ? cl(hw + 0.5 - av, 0, 1) : 0;
        if (a > 0) {
          // The band: painted body and its two cut, painted edges.
          const edge = cl(av - (hw - EDGE) + 0.5, 0, 1);
          let cr = body[0] + (paint[0] * 0.85 - body[0]) * edge, cg = body[1] + (paint[1] * 0.85 - body[1]) * edge, cb = body[2] + (paint[2] * 0.85 - body[2]) * edge;
          if (u < 0) {
            // The head: an eye on the upper side, and the jaws open in a
            // wedge from the neck's middle, rimmed with the edge paint.
            const ex = u + HEAD * 0.16, ey = v - HW * 0.45, eye = cl(1.9 - hypot(ex, ey), 0, 1);
            const mw = (-u - HEAD * 0.45) * 0.5, rim = mw > -1 ? cl(mw + EDGE + 0.5 - av, 0, 1) : 0;
            const lip = max(eye, rim) * (rim > eye ? 0.85 : 1);
            cr += (paint[0] - cr) * lip;
            cg += (paint[1] - cg) * lip;
            cb += (paint[2] - cb) * lip;
            a *= 1 - cl(mw + 0.5 - av, 0, 1);
          } else if (u < U1 + ADV0 && av < hw - EDGE) {
            // The text.
            const X = u / A + S.scroll, k = floor(X / TOTAL), xm = X - k * TOTAL;
            let lo = 0, hi = SIGNS.length - 1;
            while (lo < hi) {
              const mid = (lo + hi + 1) >> 1;
              if (START[mid] <= xm) lo = mid;
              else hi = mid - 1;
            }
            const j = lo, gsign = SIGNS[j], centre = START[j] + WIDE[j] / 2;
            const c = (U1 - (k * TOTAL + START[j] - S.scroll) * A) / (CARVE * WIDE[j] * A);
            if (c > 0) {
              const gx = ((xm - centre) * A) / S.scx + (gsign < 0 ? 0.5 : 2), gy = 4 - v / SC;
              const dd = strokes(S, gsign, gx, gy, c, false), ink = cl(RAD + 0.55 - dd, 0, 1);
              if (ink > 0) {
                const pt = cl((c - CARVE) / PAINT, 0, 1), fresh = c < 1 ? 1 : 0;
                const ir = (groove[0] + (paint[0] - groove[0]) * pt) * (1 + 0.15 * fresh);
                const ig = (groove[1] + (paint[1] - groove[1]) * pt) * (1 + 0.1 * fresh);
                const ib = groove[2] + (paint[2] - groove[2]) * pt;
                cr += (ir - cr) * ink;
                cg += (ig - cg) * ink;
                cb += (ib - cb) * ink;
              }
            }
          }
          r += (cr - r) * a;
          g += (cg - g) * a;
          b += (cb - b) * a;
        }
      }
      if (spark) {
        // A white core and a warm light round it that reaches the stone.
        const dx = x - spark[0], dy = y - spark[1], d2 = dx * dx + dy * dy;
        const q = flick * (exp(-d2 / 2.4) + 0.35 * exp(-d2 / 18));
        r += q;
        g += q * 0.9;
        b += q * 0.65;
      }
      display.setPixel(x, y, round(cl(r, 0, 1) * 255), round(cl(g, 0, 1) * 255), round(cl(b, 0, 1) * 255));
    }
  for (const c of S.chips) {
    const x = round(c.x), y = round(c.y);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const l = cl(c.life * 3, 0, 1);
    display.setPixel(x, y, round(255 * l), round(225 * l), round(160 * l));
  }
}
