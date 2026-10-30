// ===== Patternflow pattern =====
// Title:   Fox Colorings
// Family:  topology
// Idea:    A knot stands the full height of the panel as a closed braid, its crossings stacked down the middle and its strands coming back up round the right side, each under-strand broken where it passes beneath, and every arc between two undercrossings is coloured by a label mod p so that at each crossing twice the over arc equals the sum of the two under arcs; the colourings are found by Gaussian elimination mod p and walked one basis step at a time, the arcs that change dipping dark and coming back in their new colour, and the count p^d and the knot's determinant stand at the top, so a knot whose determinant p does not divide sits in a single colour.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Fox colourings of knot diagrams (Ralph Fox; Richard H. Crowell and Ralph H. Fox, Introduction to Knot Theory, 1963), Alexander's theorem that every knot is a closed braid (James Waddell Alexander, A lemma on systems of knotted curves, 1923), pattern round 78
// Round:   78
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Knot=0..1, Prime=0..1
//
// Knob 1: Hue. Turns the p label colours round the wheel; label a sits a/p of a turn on from label 0, which is azure at 0.
// Knob 2: Speed. At 2 a colouring lasts 1.9 seconds, the change taking the first 0.55 of them; 0.2 is ten times slower, 3 half as fast again. Three faint bright bands run round the knot the way it is drawn, each going round in 9 seconds at 2.
// Knob 3: Knot. Thirteen stations: the trefoil s1^3 (determinant 3), the figure-eight s1 s2^-1 s1 s2^-1 (5), 5_1 = s1^5 (5), 5_2 (7), 6_1 on four strands (9), 6_2 (11), 6_3 (13), 7_1 = s1^7 (7), the square knot s1^3 s2^-3 (9, and 27 colourings mod 3, one more dimension than any prime knot here), a four-strand knot of determinant 15 = 3 x 5, the torus knot T(3,4) = 8_19 (3), 9_1 = s1^9 (9) and T(3,5) = 10_124 (1, colourable by no prime at all).
// Knob 4: Prime. The modulus p, five stations: 3, 5, 7, 11, 13. The knot has colourings other than the p constant ones exactly when p divides its determinant; then they number p^2 for every knot here but the square knot, which has 3^3 = 27.

// Cut a knot diagram at its undercrossings and it falls into arcs, as many
// as it has crossings. Fox's colouring gives each arc a label in Z/p so that
// at every crossing 2 x (over arc) = (under arc in) + (under arc out) mod p.
// The constant labellings always pass; the knot is p-colourable when some
// other one does, and that happens exactly when p divides the determinant,
// the absolute value of any (n-1) by (n-1) minor of the n by n matrix of
// these equations. The solutions are a vector space over Z/p of dimension
// d >= 1, so there are p^d colourings. Here the equations are solved by
// Gaussian elimination mod p with arc 0 held at 0, which leaves the d - 1
// non-constant directions; the constant vector is the last. The walk runs
// through all p^d colourings in a modular Gray code, adding one basis vector
// at each step, so only the arcs where that vector is not 0 change, and
// every crossing is valid in every colouring it rests on.
//
// Alexander showed in 1923 that every knot is the closure of a braid. The
// braid runs down the panel, one crossing to a band; s_i crosses the
// strands at places i and i + 1, the one moving right in front for s_i and
// behind for its inverse. Each place j then returns up the right side, the
// leftmost on the outside, so the closing arcs never cross.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sqrt, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => u * u * (3 - 2 * u);

const KNOTS = [
  [2, [1, 1, 1]],
  [3, [1, -2, 1, -2]],
  [2, [1, 1, 1, 1, 1]],
  [3, [1, 1, 1, 2, -1, 2]],
  [4, [1, 1, 2, -1, -3, 2, -3]],
  [3, [1, 1, 1, -2, 1, -2]],
  [3, [1, 1, -2, 1, -2, -2]],
  [2, [1, 1, 1, 1, 1, 1, 1]],
  [3, [1, 1, 1, -2, -2, -2]],
  [4, [1, 1, 2, -1, 2, 2, 3, -2, 3]],
  [3, [1, 2, 1, 2, 1, 2, 1, 2]],
  [2, [1, 1, 1, 1, 1, 1, 1, 1, 1]],
  [3, [1, 2, 1, 2, 1, 2, 1, 2, 1, 2]],
];
const PRIMES = [3, 5, 7, 11, 13];
// Strand radius and the dark margin an over-strand cuts round itself.
const RAD = 1.45, GAP = 1.6;
// Seconds a colouring lasts at Speed 1, and the share of it the change takes.
const STEP = 3.8, DIP = 0.29;
const HUE0 = 0.55;

const GLYPH = {
  0: "### #.# #.# #.# ###", 1: ".#. ##. .#. .#. ###", 2: "### ..# ### #.. ###", 3: "### ..# .## ..# ###", 4: "#.# #.# ### ..# ..#",
  5: "### #.. ### ..# ###", 6: "### #.. ### #.# ###", 7: "### ..# ..# .#. .#.", 8: "### #.# ### #.# ###", 9: "### #.# ### ..# ###",
  "=": "... ### ... ### ...", d: "..# ..# ### #.# ###", e: "### #.# ### #.. ###", t: ".#. ### .#. .#. .##",
};

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = 255 * (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p);
  o[1] = 255 * (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p);
  o[2] = 255 * (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p);
  return o;
}

// Arcs of the closed braid: piece (l, j) is the strand at place j between
// crossing l - 1 and crossing l, and level n is level 0 again. Pieces are
// joined where a strand passes a crossing untouched or in front.
function arcsOf(k, w) {
  const n = w.length, par = new Int32Array(n * k).map((_, i) => i);
  const find = (a) => (par[a] === a ? a : (par[a] = find(par[a])));
  const id = (l, j) => (l % n) * k + j;
  const eqs = [];
  for (let t = 0; t < n; t++) {
    const g = w[t], i = abs(g) - 1;
    for (let j = 0; j < k; j++) if (j !== i && j !== i + 1) par[find(id(t, j))] = find(id(t + 1, j));
    const oi = g > 0 ? id(t, i) : id(t, i + 1), oo = g > 0 ? id(t + 1, i + 1) : id(t + 1, i);
    par[find(oi)] = find(oo);
    eqs.push([oi, g > 0 ? id(t, i + 1) : id(t, i), g > 0 ? id(t + 1, i) : id(t + 1, i + 1)]);
  }
  const roots = [], arc = new Int32Array(n * k);
  for (let a = 0; a < n * k; a++) {
    const r = find(a);
    if (!roots.includes(r)) roots.push(r);
    arc[a] = roots.indexOf(r);
  }
  // Each crossing as a row: 2 over - under in - under out.
  const M = eqs.map(([o, a, b]) => {
    const row = new Array(roots.length).fill(0);
    row[arc[o]] += 2;
    row[arc[a]] -= 1;
    row[arc[b]] -= 1;
    return row;
  });
  return { arc, M, na: roots.length, id };
}

// The determinant: a minor of the crossing matrix, by Bareiss's fraction-free
// elimination, which keeps every entry a whole number.
function determinant(M) {
  const A = M.slice(1).map((r) => r.slice(1)), n = A.length;
  let prev = 1, sign = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    while (p < n && A[p][c] === 0) p++;
    if (p === n) return 0;
    if (p !== c) {
      [A[p], A[c]] = [A[c], A[p]];
      sign = -sign;
    }
    for (let r = c + 1; r < n; r++) {
      for (let q = c + 1; q < n; q++) A[r][q] = (A[r][q] * A[c][c] - A[r][c] * A[c][q]) / prev;
      A[r][c] = 0;
    }
    prev = A[c][c];
  }
  return abs(sign * (n ? A[n - 1][n - 1] : 1));
}

const mod = (a, p) => ((a % p) + p) % p;
function inverse(a, p) {
  let r = 1;
  for (let e = p - 2, b = a; e > 0; e >>= 1, b = (b * b) % p) if (e & 1) r = (r * b) % p;
  return r;
}

// The colourings mod p as a basis: the non-constant directions found with
// arc 0 held at 0, then the constant vector.
function colourings(M, na, p) {
  const A = M.map((r) => r.map((v) => mod(v, p)));
  A.push(new Array(na).fill(0).map((_, i) => (i === 0 ? 1 : 0)));
  const pivots = [];
  let row = 0;
  for (let c = 0; c < na && row < A.length; c++) {
    let r = row;
    while (r < A.length && A[r][c] === 0) r++;
    if (r === A.length) continue;
    [A[r], A[row]] = [A[row], A[r]];
    const iv = inverse(A[row][c], p);
    for (let q = 0; q < na; q++) A[row][q] = (A[row][q] * iv) % p;
    for (let r2 = 0; r2 < A.length; r2++) {
      if (r2 === row || !A[r2][c]) continue;
      const f = A[r2][c];
      for (let q = 0; q < na; q++) A[r2][q] = mod(A[r2][q] - f * A[row][q], p);
    }
    pivots.push(c);
    row++;
  }
  const basis = [];
  for (let f = 0; f < na; f++) {
    if (pivots.includes(f)) continue;
    const v = new Array(na).fill(0);
    v[f] = 1;
    pivots.forEach((c, r) => (v[c] = mod(-A[r][f], p)));
    basis.push(v);
  }
  basis.push(new Array(na).fill(1));
  return basis;
}

// The path of the knot, sampled every quarter LED or so, in the order it is
// drawn: down the braid, round the closing arc on the right, down again
// from the next place, until it comes back to place 0.
function layout(k, w) {
  const n = w.length;
  const yt = [], yb = [];
  for (let j = 0; j < k; j++) {
    yt.push(10 + 4 * j);
    yb.push(124 - 4 * j);
  }
  const y0 = yt[k - 1] + 5, y1 = yb[k - 1] - 5, band = (y1 - y0) / n;
  // Wide crossings where there is height for them, narrower where many share it.
  const sp = min([0, 0, 22, 13, 9][k], max(9, round(band * 1.25))), rs = [0, 0, 11, 8, 6][k], gap = [0, 0, 12, 11, 9][k];
  const width = (k - 1) * sp + gap + (k - 1) * rs, x0 = round(2 + (59 - width) / 2);
  const xb = [], xr = [];
  for (let j = 0; j < k; j++) {
    xb.push(x0 + j * sp);
    xr.push(x0 + (k - 1) * sp + gap + (k - 1 - j) * rs);
  }
  return { xb, xr, yt, yb, y0, y1, band };
}

function build(S, ki) {
  const [k, w] = KNOTS[ki], n = w.length;
  const { arc, M, na, id } = arcsOf(k, w);
  S.ki = ki;
  S.M = M;
  S.na = na;
  S.det = determinant(M);
  const L = layout(k, w), xs = [], ys = [], as = [], fl = [];
  const add = (x, y, a, f) => {
    xs.push(x);
    ys.push(y);
    as.push(a);
    fl.push(f);
  };
  const line = (xa, ya, xb, yb, a) => {
    const m = max(1, Math.ceil(Math.hypot(xb - xa, yb - ya) * 3));
    for (let i = 0; i < m; i++) add(xa + ((xb - xa) * i) / m, ya + ((yb - ya) * i) / m, a, 0);
  };
  const turn = (cx, cy, r, a0, a1, a) => {
    for (let i = 0; i < 12; i++) {
      const t = a0 + ((a1 - a0) * i) / 12;
      add(cx + r * cos(t), cy + r * sin(t), a, 0);
    }
  };
  const R = 3;
  let j = 0;
  do {
    for (let t = 0; t < n; t++) {
      const g = w[t], i = abs(g) - 1, ya = L.y0 + t * L.band;
      if (j !== i && j !== i + 1) {
        line(L.xb[j], ya, L.xb[j], ya + L.band, arc[id(t, j)]);
        continue;
      }
      const jj = j === i ? i + 1 : i, over = g > 0 ? j === i : j === i + 1;
      const m = Math.ceil(L.band * 5);
      for (let s = 0; s < m; s++) {
        const u = s / m;
        // 1: in front through this crossing; 2: in front near its middle, where it cuts the gap.
        const f = over ? (abs(u - 0.5) < 0.3 ? 2 : 1) : 0;
        add(L.xb[j] + (L.xb[jj] - L.xb[j]) * ease(u), ya + u * L.band, over || u < 0.5 ? arc[id(t, j)] : arc[id(t + 1, jj)], f);
      }
      j = jj;
    }
    // Round the right side and back to the top of the braid at place j.
    const a = arc[id(0, j)], xl = L.xb[j], xr = L.xr[j], yt = L.yt[j], yb = L.yb[j];
    line(xl, L.y1, xl, yb - R, a);
    turn(xl + R, yb - R, R, PI, PI / 2, a);
    line(xl + R, yb, xr - R, yb, a);
    turn(xr - R, yb - R, R, PI / 2, 0, a);
    line(xr, yb - R, xr, yt + R, a);
    turn(xr - R, yt + R, R, 0, -PI / 2, a);
    line(xr - R, yt, xl + R, yt, a);
    turn(xl + R, yt + R, R, -PI / 2, -PI, a);
    line(xl, yt + R, xl, L.y0, a);
  } while (j !== 0);
  // Distance along the knot, for the brightening that runs round it.
  const ss = [0];
  for (let i = 1; i < xs.length; i++) ss.push(ss[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
  S.len = ss[ss.length - 1];
  // Rasterise: every sample, then a dark margin round each over-strand near
  // its crossing, then the over-strands again on top.
  const { pa, pd, ps } = S;
  pa.fill(-1);
  pd.fill(9);
  const stamp = (i, r, dark) => {
    const fx = xs[i], fy = ys[i];
    for (let y = Math.ceil(fy - r); y <= floor(fy + r); y++)
      for (let x = Math.ceil(fx - r); x <= floor(fx + r); x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const dd = (x - fx) * (x - fx) + (y - fy) * (y - fy);
        if (dd > r * r) continue;
        const p = y * W + x;
        if (dark) {
          pa[p] = -1;
          pd[p] = 9;
        } else if (pa[p] !== as[i] || dd < pd[p]) {
          pa[p] = as[i];
          pd[p] = dd;
          ps[p] = ss[i];
        }
      }
  };
  for (let i = 0; i < xs.length; i++) stamp(i, RAD, false);
  for (let i = 0; i < xs.length; i++) if (fl[i] === 2) stamp(i, RAD + GAP, true);
  for (let i = 0; i < xs.length; i++) if (fl[i]) stamp(i, RAD, false);
}

// Label of each arc in colouring m of the walk: the digits of m in base p
// turned into a modular Gray code, digit i the coefficient of basis vector i.
function labels(S, m, out) {
  const { basis, p } = S, d = basis.length;
  out.fill(0);
  let rest = mod(m, S.count);
  const dig = [];
  for (let i = 0; i < d; i++) {
    dig.push(rest % p);
    rest = floor(rest / p);
  }
  for (let i = 0; i < d; i++) {
    const g = mod(dig[i] - (i + 1 < d ? dig[i + 1] : 0), p);
    if (g) for (let a = 0; a < S.na; a++) out[a] = (out[a] + g * basis[i][a]) % p;
  }
  return out;
}

function text(S) {
  const tx = S.tx;
  tx.fill(0);
  const put = (s, x, y, v) => {
    for (const ch of s) {
      const g = GLYPH[ch].split(" ");
      for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r][q] === "#" && x + q < W) tx[(y + r) * W + x + q] = v;
      x += 4;
    }
    return x;
  };
  // p, raised d, "=", the count; the determinant at the right.
  let x = put(String(S.p), 1, 2, 2);
  x = put(String(S.basis.length), x, 0, 1);
  x = put("=", x, 2, 1);
  put(String(S.count), x, 2, 2);
  const ds = "det" + S.det;
  put(ds, W - 4 * ds.length, 2, 1);
}

export function setup(params) {
  params.s = {
    ki: -1, pi: -1, p: 3, hue: 0, speed: 2, w: 0, wave: 0, basis: [], count: 1, det: 1, M: [], na: 0, len: 1,
    pa: new Int16Array(N), pd: new Float32Array(N), ps: new Float32Array(N), tx: new Uint8Array(N),
    la: new Int32Array(16), lb: new Int32Array(16), col: new Float32Array(48), tmp: [0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const ki = min(KNOTS.length - 1, floor(cl(k[2] || 0, 0, 1) * KNOTS.length));
  const pi = min(PRIMES.length - 1, floor(cl(k[3] == null ? 0.06 : k[3], 0, 1) * PRIMES.length));
  if (ki !== S.ki || pi !== S.pi) {
    if (ki !== S.ki) build(S, ki);
    S.pi = pi;
    S.p = PRIMES[pi];
    S.basis = colourings(S.M, S.na, S.p);
    S.count = S.p ** S.basis.length;
    // Open on a colouring that is not constant when there is one, settled.
    S.w = (S.basis.length > 1 ? 1 : 0) + DIP;
    text(S);
  }
  S.w += (d * S.speed) / STEP;
  S.wave += (d * S.speed) / 18;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.ki < 0) return;
  const { pa, pd, ps, tx, col, la, lb, p } = S;
  const m = floor(S.w), fr = S.w - m, u = fr / DIP;
  labels(S, m, la);
  labels(S, m - 1, lb);
  // Colour of each arc: its label's hue, and while the colouring changes,
  // the arcs that change dip dark and turn at the bottom of the dip.
  for (let a = 0; a < S.na; a++) {
    let lab = la[a], v = 1;
    if (u < 1 && la[a] !== lb[a]) {
      v = 1 - 0.85 * sin(PI * u);
      if (u < 0.5) lab = lb[a];
    }
    const c = hsv(S.hue + HUE0 + lab / p, 0.85, v, S.tmp);
    col[a * 3] = c[0];
    col[a * 3 + 1] = c[1];
    col[a * 3 + 2] = c[2];
  }
  const ph = S.wave - floor(S.wave), L = S.len;
  for (let i = 0; i < N; i++) {
    const a = pa[i], x = i % W, y = (i - x) / W;
    if (a >= 0) {
      // Brighter down the middle of a strand, and a little brighter where the
      // slow wave round the knot is passing.
      const wv = 0.82 + 0.18 * cos(2 * PI * (ps[i] / L - ph) * 3);
      const b = (1 - 0.45 * (pd[i] / (RAD * RAD))) * wv;
      display.setPixel(x, y, round(col[a * 3] * b), round(col[a * 3 + 1] * b), round(col[a * 3 + 2] * b));
    } else if (tx[i]) {
      const v = tx[i] === 2 ? 235 : 150;
      display.setPixel(x, y, v, v, v);
    } else display.setPixel(x, y, 0, 0, 0);
  }
}
