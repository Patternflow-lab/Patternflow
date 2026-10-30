// ===== Patternflow pattern =====
// Title:   Franklin's Involution
// Family:  number
// Idea:    Every partition of n into distinct parts stands in turn as a Ferrers diagram of square dots in the top third, coloured by whether it has an even or an odd number of parts, and Franklin's move flies its smallest row onto the slope of its largest rows, or the slope down into a new smallest row, to build its partner of the other colour in the bottom third, while the middle third counts the two colours level and writes Euler's series one coefficient at a time, until at a pentagonal n one staircase-trapezoid has no move to make and stands framed above the sign it gives the series.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Euler's pentagonal number theorem (Leonhard Euler, 1750) and Fabian Franklin's involution on partitions into distinct parts (Sur le développement du produit infini (1 - x)(1 - x^2)(1 - x^3)..., Comptes Rendus, 1881), pattern round 78
// Round:   78
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, N=5..16, Gap=0..1
//
// Knob 1: Hue. Turns both colours round the wheel, always opposite. At 0 partitions with an even number of parts are azure and odd ones amber; at 0.5 the two swap.
// Knob 2: Speed. A partition takes 2.4 / Speed seconds: 1.2 s at the opening 2, 12 s at 0.2, 0.8 s at 3. The moved dots leave one after another, the last 0.3 of that time after the first, and each takes 0.42 of it to land.
// Knob 3: N. The n the walk starts from, 5 to 16; it goes on to n + 1 after the last partition of n and back to N after 16. At the opening 5, (5) and (4, 1) turn into each other and then (3, 2) has no move, which gives x^5 its +1; n = 6 then comes out even, two pairs, and n = 7 ends on (4, 3). At 16 a pass is 32 partitions, 38 s.
// Knob 4: Gap. The gap between dots as a share of their spacing: one LED at the opening 0.06, so the rows read as rows of square dots; at 0.5 the dots are five eighths of the spacing, at 1 a quarter.

// Euler: (1 - x)(1 - x^2)(1 - x^3)... = 1 - x - x^2 + x^5 + x^7 - x^12 -
// x^15 + ..., the exponents the pentagonal numbers k(3k - 1)/2 and
// k(3k + 1)/2 with sign (-1)^k. Multiplied out, the product counts each
// partition of n into distinct parts with +1 if it has an even number of
// parts and -1 if odd, so the theorem says those two counts are equal
// except at a pentagonal n.
//
// Franklin pairs them off. In the Ferrers diagram (largest part on top)
// let s be the smallest part and sigma the slope, the number of top rows
// that each fall short of the one above by exactly one dot. If s <= sigma,
// take the smallest row away and put one of its dots at the end of each of
// the s largest rows; if s > sigma, take the last dot from each of the sigma
// largest rows and lay them down as a new smallest row. The number of parts
// changes by one and doing it twice gives back the partition. It fails only
// when the slope runs down to the smallest row and shares its last dot,
// with s = sigma = k or s = sigma + 1 = k + 1, the partitions (2k - 1, ...,
// k) and (2k, ..., k + 1) of k(3k - 1)/2 and k(3k + 1)/2: (3, 2) for 5,
// (4, 3) for 7, (5, 4, 3) for 12, (6, 5, 4) for 15.
//
// Each partition comes on top once, its partner straight after it, so a
// pair is seen both ways round, and the lone one, if n has one, comes last.
// The pair shares one dot spacing, the largest that fits both in a third
// of the panel, up to 14 LEDs: 12 for (5) and (4, 1), 4 for (13) and (12, 1).

const W = 64, H = 128, TOP = 1, BOT = 85, REG = 42, NMAX = 16;
const { floor, min, max, round, PI, sin } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// Digits and signs, 3 by 5, drawn for this pattern.
const GL = {
  0: "### #.# #.# #.# ###", 1: ".#. ##. .#. .#. ###", 2: "### ..# ### #.. ###", 3: "### ..# .## ..# ###",
  4: "#.# #.# ### ..# ..#", 5: "### #.. ### ..# ###", 6: "### #.. ### #.# ###", 7: "### ..# .#. .#. .#.",
  8: "### #.# ### #.# ###", 9: "### #.# ### ..# ###", "+": "... .#. ### .#. ...", "-": "... ... ### ... ...",
};

function hsv(h, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - i;
  const v = [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][i];
  o[0] = v[0] * 255;
  o[1] = v[1] * 255;
  o[2] = v[2] * 255;
  return o;
}

// ---- Partitions -----------------------------------------------------------

// Partitions of n into distinct parts, largest first, (n) first of all.
function partitions(n) {
  const out = [];
  const rec = (rem, top, cur) => {
    if (!rem) return void out.push(cur.slice());
    for (let a = min(rem, top); a >= 1; a--) {
      cur.push(a);
      rec(rem - a, a - 1, cur);
      cur.pop();
    }
  };
  rec(n, n, []);
  return out;
}

// Franklin's move on l: the partner and which dots go where, [row, column]
// in l to [row, column] in the partner; null for the lone partition, with
// the dots that block it.
function franklin(l) {
  const k = l.length, s = l[k - 1];
  let sg = 1;
  while (sg < k && l[sg] === l[sg - 1] - 1) sg++;
  const slope = [], low = [];
  for (let i = 0; i < sg; i++) slope.push([i, l[i] - 1]);
  for (let j = 0; j < s; j++) low.push([k - 1, j]);
  if (s <= sg) {
    if (sg === k && s === k) return { m: null, slope, low };
    const m = l.slice(0, k - 1);
    for (let i = 0; i < s; i++) m[i]++;
    return { m, moves: low.map(([r, c]) => [[r, c], [c, l[c]]]) };
  }
  if (sg === k && s === sg + 1) return { m: null, slope, low };
  const m = l.slice();
  for (let i = 0; i < sg; i++) m[i]--;
  m.push(sg);
  return { m, moves: slope.map(([r, c]) => [[r, c], [k, r]]) };
}

// The walk through n: each pair both ways round, then the lone one.
function walk(n) {
  const seen = new Set(), out = [];
  let lone = null;
  for (const l of partitions(n)) {
    if (seen.has(l.join())) continue;
    const f = franklin(l);
    if (!f.m) {
      lone = { l, f };
      continue;
    }
    seen.add(l.join());
    seen.add(f.m.join());
    out.push({ l, f }, { l: f.m, f: franklin(f.m) });
  }
  if (lone) out.push(lone);
  return out;
}

// Euler's coefficients: (-1)^k at the pentagonal numbers k(3k -+ 1)/2.
const COEF = new Int8Array(NMAX + 1);
for (let k = 1; k < 5; k++) for (const e of [(k * (3 * k - 1)) / 2, (k * (3 * k + 1)) / 2]) if (e <= NMAX) COEF[e] = k % 2 ? -1 : 1;

// ---- State ----------------------------------------------------------------

export function setup(params) {
  params.s = {
    N: -1, n: 0, steps: [], i: 0, u: 0, e: 0, o: 0, lone: -1, hue: 0, speed: 2, gap: 0.06, t: 0,
    buf: new Float32Array(W * H * 3), ca: [0, 0, 0], cb: [0, 0, 0],
  };
}

function begin(S, n) {
  S.n = n;
  S.steps = walk(n);
  S.i = 0;
  S.u = 0;
  S.e = S.o = 0;
  S.lone = -1;
  count(S);
}

// The partition on top is counted as it comes up.
function count(S) {
  const st = S.steps[S.i];
  if (st.l.length % 2) S.o++;
  else S.e++;
  if (!st.f.m) S.lone = st.l.length % 2;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 5, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.gap = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const N = cl(round(k[2] == null ? 5 : k[2]), 5, NMAX);
  if (N !== S.N) {
    S.N = N;
    begin(S, N);
  }
  S.t += d;
  S.u += (d * S.speed) / 2.4;
  while (S.u >= 1) {
    S.u -= 1;
    if (++S.i >= S.steps.length) begin(S, S.n >= max(NMAX, S.N) ? S.N : S.n + 1);
    else count(S);
  }
}

// ---- Drawing --------------------------------------------------------------

function rect(S, x, y, w, h, c, a) {
  const b = S.buf;
  for (let yy = max(0, round(y)); yy < min(H, round(y) + h); yy++)
    for (let xx = max(0, round(x)); xx < min(W, round(x) + w); xx++) {
      const i = (yy * W + xx) * 3;
      b[i] = c[0] * a;
      b[i + 1] = c[1] * a;
      b[i + 2] = c[2] * a;
    }
}

function text(S, s, x, y, sc, c, a) {
  for (const ch of s) {
    const g = GL[ch].split(" ");
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r][q] === "#") rect(S, x + q * sc, y + r * sc, sc, sc, c, a);
    x += 4 * sc;
  }
}

const mix = (c, w, o) => ((o[0] = c[0] + (255 - c[0]) * w), (o[1] = c[1] + (255 - c[1]) * w), (o[2] = c[2] + (255 - c[2]) * w), o);

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.steps.length) return;
  S.buf.fill(0);
  const st = S.steps[S.i], l = st.l, f = st.f, m = f.m, u = S.u;
  const ca = hsv(S.hue + 0.58, S.ca), cb = hsv(S.hue + 0.08, S.cb);
  const col = (p) => (p.length % 2 ? cb : ca);
  const fade = ease(u / 0.1) * (1 - ease((u - 0.94) / 0.06));

  // One spacing for the pair, so the moved dots keep their size.
  const wide = max(l[0], m ? m[0] : 0), tall = max(l.length, m ? m.length : 0);
  const p = max(2, min(14, floor(62 / wide), floor((REG - 2) / tall)));
  const ds = p <= 2 ? 1 : cl(round(p * (1 - 0.75 * S.gap)), 1, p - 1);
  const left = round((W - (wide * p - (p - ds))) / 2);
  const ytop = (rows, y0) => y0 + round((REG - (rows * p - (p - ds))) / 2);
  const yl = ytop(l.length, TOP), ym = m ? ytop(m.length, BOT) : 0;
  const at = (y0, r, c) => [left + c * p, y0 + r * p];

  // The middle third. Along the top, Euler's series so far: a cell for
  // each m up to n, in the even colour for +x^m, the odd one for -x^m, grey
  // for none, the cell for n blinking until its walk is done. Below, n on
  // the left and even minus odd so far on the right, then a pip for each
  // partition counted, even above, odd below.
  const white = [210, 210, 210], grey = [55, 55, 55];
  for (let j = 1; j <= S.n; j++) {
    const c = j < S.n || S.i === S.steps.length - 1 ? COEF[j] : 2;
    if (c === 2 && sin(S.t * 6) < 0) continue;
    rect(S, (j - 1) * 4, 46, 3, 3, c > 0 && c < 2 ? ca : c < 0 ? cb : c === 2 ? white : grey, 1);
  }
  text(S, String(S.n), 1, 53, 3, white, 1);
  const dif = S.e - S.o, ds2 = dif > 0 ? "+" + dif : String(dif);
  text(S, ds2, W - (4 * ds2.length - 1) * 3, 53, 3, dif > 0 ? ca : dif < 0 ? cb : white, 1);
  const pip = min(6, floor(W / Math.ceil(S.steps.length / 2)));
  for (let j = 0; j < S.e; j++) rect(S, j * pip, 71, pip - 1, pip - 1, ca, 1);
  for (let j = 0; j < S.o; j++) rect(S, j * pip, 78, pip - 1, pip - 1, cb, 1);
  if (S.lone >= 0) {
    // The pip with no partner flashes white.
    const j = (S.lone ? S.o : S.e) - 1, w = 0.5 + 0.5 * sin(S.t * 6);
    rect(S, j * pip, S.lone ? 78 : 71, pip - 1, pip - 1, mix(S.lone ? cb : ca, w, [0, 0, 0]), 1);
  }

  const hl = [0, 0, 0];
  if (!m) {
    // The lone partition: its smallest row and its slope lit, the dot they
    // share flashing, a frame round it, and the sign it gives below.
    const mark = new Set([...f.slope, ...f.low].map(([r, c]) => r * 64 + c));
    const shared = (l.length - 1) * 64 + l[l.length - 1] - 1;
    for (let r = 0; r < l.length; r++)
      for (let c = 0; c < l[r]; c++) {
        const [x, y] = at(yl, r, c), key = r * 64 + c;
        const w = key === shared ? 0.5 + 0.5 * sin(S.t * 6) : mark.has(key) ? 0.45 : 0;
        rect(S, x, y, ds, ds, mix(col(l), w, hl), fade);
      }
    const fx0 = left - 3, fy0 = yl - 3, fw = l[0] * p - (p - ds) + 6, fh = l.length * p - (p - ds) + 6;
    for (const [x, y, w, h] of [[fx0, fy0, fw, 1], [fx0, fy0 + fh - 1, fw, 1], [fx0, fy0, 1, fh], [fx0 + fw - 1, fy0, 1, fh]]) rect(S, x, y, w, h, white, fade);
    const sg = l.length % 2 ? "-1" : "+1", a = ease((u - 0.25) / 0.2) * fade;
    text(S, sg, round((W - 7 * 6) / 2), BOT + 10, 6, col(l), a);
  } else {
    // Dots that stay, top and bottom.
    const from = new Set(f.moves.map(([a]) => a[0] * 64 + a[1])), to = new Set(f.moves.map(([, b]) => b[0] * 64 + b[1]));
    const n = f.moves.length;
    const v = f.moves.map((_, j) => ease((u - 0.14 - (n > 1 ? (0.3 * j) / (n - 1) : 0)) / 0.42));
    for (let r = 0; r < l.length; r++)
      for (let c = 0; c < l[r]; c++) {
        const [x, y] = at(yl, r, c);
        if (!from.has(r * 64 + c)) rect(S, x, y, ds, ds, col(l), fade);
        // A dot about to move is lit; once gone it leaves a dim ghost.
        else rect(S, x, y, ds, ds, mix(col(l), 0.45, hl), fade * (v[f.moves.findIndex(([a]) => a[0] === r && a[1] === c)] > 0 ? 0.22 : 1));
      }
    for (let r = 0; r < m.length; r++)
      for (let c = 0; c < m[r]; c++) if (!to.has(r * 64 + c)) rect(S, ...at(ym, r, c), ds, ds, col(m), fade);
    // The moved dots in flight, bowing out to the right on the way down.
    f.moves.forEach(([a, b], j) => {
      const [x0, y0] = at(yl, a[0], a[1]), [x1, y1] = at(ym, b[0], b[1]), w = v[j];
      if (w <= 0) return;
      const x = x0 + (x1 - x0) * w + sin(PI * w) * (6 + 2 * j), y = y0 + (y1 - y0) * w;
      rect(S, x, y, ds, ds, mix(col(m), 0.45, hl), fade);
    });
  }

  const b = S.buf;
  for (let i = 0; i < W * H; i++) display.setPixel(i % W, floor(i / W), round(b[i * 3]), round(b[i * 3 + 1]), round(b[i * 3 + 2]));
}
