// ===== Patternflow pattern =====
// Title:   Burrows-Wheeler
// Family:  algo
// Idea:    The 128 rotations of a text stand as 128 rows of coloured letters and glide into sorted order, so the last column at the right edge gathers into runs; then the rows fade to their first and last letters and come back one at a time as the LF walk rebuilds them from the last column alone.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Burrows-Wheeler transform (Michael Burrows and David Wheeler, 1994), with its perfect clustering on Sturmian words (Sabrina Mantaci, Antonio Restivo and Marinella Sciortino, 2003) and on interval exchange words (Sebastien Ferenczi and Luca Zamboni, 2013), pattern round 55
// Round:   55
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Order=0..3, Letters=2..6
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the first letter is bright gold and the last a dim violet at a sixth of its brightness, with green, cyan and blue between them when there are more letters. The run marks, the walk and the mark beside the text's own row are white.
// Knob 2: Speed. At 2 one text takes 6.6 seconds: 0.4 in rotation order, 1 gliding into sorted order, 1.2 sorted, 1.2 with the shared prefixes lit, 0.3 fading to the first and last columns, 2 for the LF walk at 64 rows a second, and 0.5 for a last look. 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Order. How much structure the text has. At 0 every letter is drawn at random; with 2 letters the last column breaks into 64 runs on average and a row needs 8 letters to tell it from its neighbours. At 1 each letter follows a fixed rule on the two before it four times in five, and at 2 the text strings together copies of three short words; for 2 letters both bring the last column down to 25 to 28 runs, and the rows need 17 or 18 letters. At 3 the text is perfectly clustering and the last column is one run per letter in falling order: for 2 letters a Sturmian word, the first one of slope 49/128 next to the Fibonacci word's 0.382, and for more letters the coding of an interval exchange that turns the order of its intervals round. 95% of the rows of the Sturmian word share all 53 letters on the panel with a neighbour.
// Knob 4: Letters. The size of the alphabet, 2 to 6. Each letter is a step dimmer than the one before, from full brightness down to a sixth of it, so two different letters side by side always differ in brightness as well as colour.

const W = 64, H = 128, N = 128;
const { floor, round, min, max, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The first letter of each rotation stands 3 LEDs wide at the left edge
// and the last 5 wide at the right, the two columns the transform keeps.
// Between them the next 52 letters, and a gutter for the run marks.
const FW = 3, BX = 4, MC = 52, GX = 56, LX = 59;
// Hue of the first letter at knob 0, and how far round the wheel the
// alphabet spreads.
const HUE0 = 0.13, SPREAD = 0.7;
// The phases of one text, in seconds at Speed 2: rotation order, the glide,
// the sorted hold, the shared prefixes, the fade to the first and last
// columns, the LF walk, and a last look at the whole sorted matrix.
const PH = [0.4, 1.0, 1.2, 1.2, 0.3, 2.0, 0.5];
const END = PH.reduce((a, b) => a + b, 0);
const at = (k) => PH.slice(0, k).reduce((a, b) => a + b, 0);
// A letter whose row is not known yet is drawn on every other LED of a
// checkerboard, at this brightness.
const GHOST = 0.75;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

const rnd = (k) => floor(Math.random() * k);

// The coding of a discrete interval exchange with the order of its
// intervals turned round: point x in interval k moves to x - s_k + t_k, with
// t_k the length of the intervals after k. When the map is one cycle of all
// 128 points, its coding is perfectly clustering: the last column of the
// sorted rotations is the letters in falling order, one run each.
function exchange(lens) {
  const m = lens.length, s = [], t = [];
  let acc = 0;
  for (let k = 0; k < m; k++) s.push(acc), (acc += lens[k]);
  for (let k = 0; k < m; k++) t.push(N - s[k] - lens[k]);
  const lab = (x) => {
    let k = m - 1;
    while (x < s[k]) k--;
    return k;
  };
  const w = new Uint8Array(N);
  let x = rnd(N), c = 0;
  const x0 = x;
  do {
    const k = lab(x);
    w[c++] = k;
    x = x - s[k] + t[k];
  } while (x !== x0 && c < N);
  return c === N ? w : null;
}

// Two letters open on the Sturmian word of slope 49/128, the nearest to the
// Fibonacci word's 1/phi^2 that 128 allows; later texts cut 128 at random.
function clustering(m, first) {
  if (m === 2 && first) return exchange([79, 49]);
  for (;;) {
    // Cut 128 into m pieces of at least 8.
    const cuts = [];
    while (cuts.length < m - 1) {
      const c = 8 + rnd(N - 15);
      if (cuts.every((d) => abs(d - c) >= 8)) cuts.push(c);
    }
    cuts.sort((a, b) => a - b);
    const lens = [];
    let prev = 0;
    for (const c of cuts) lens.push(c - prev), (prev = c);
    lens.push(N - prev);
    if (lens[0] < 8) continue;
    const w = exchange(lens);
    if (w) return w;
  }
}

function makeText(order, m, first) {
  const T = new Uint8Array(N);
  if (order === 0) for (let i = 0; i < N; i++) T[i] = rnd(m);
  else if (order === 1) {
    // Each letter follows a fixed rule on the two before it, four times in
    // five.
    const rule = Array.from({ length: m * m }, () => rnd(m));
    T[0] = rnd(m);
    T[1] = rnd(m);
    for (let i = 2; i < N; i++) T[i] = Math.random() < 0.8 ? rule[T[i - 2] * m + T[i - 1]] : rnd(m);
  } else if (order === 2) {
    const words = Array.from({ length: 3 }, () => Array.from({ length: 5 + rnd(7) }, () => rnd(m)));
    let i = 0;
    while (i < N) for (const c of words[rnd(3)]) if (i < N) T[i++] = c;
  } else return clustering(m, first);
  return T;
}

export function setup(params) {
  params.s = {
    hue: 0, sp: 2, ord: -1, m: -1, tau: 0,
    T: null, rank: new Int32Array(N), L: new Uint8Array(N), walk: new Int32Array(N),
    keep: new Int32Array(N), seen: new Int32Array(N), rowRot: new Int32Array(H),
    pos: new Float64Array(N), ord128: Array.from({ length: N }, (_, i) => i),
    buf: new Float32Array(W * H * 3), pal: new Float32Array(6 * 3), palKey: "",
  };
}

// Sort the rotations, read off the last column, and take the LF walk from
// the row that holds the text itself.
function build(s, first) {
  const T = makeText(s.ord, s.m, first);
  s.T = T;
  const idx = Array.from({ length: N }, (_, i) => i);
  idx.sort((a, b) => {
    for (let k = 0; k < N; k++) {
      const d = T[(a + k) % N] - T[(b + k) % N];
      if (d) return d;
    }
    return a - b;
  });
  for (let r = 0; r < N; r++) (s.rank[idx[r]] = r), (s.L[r] = T[(idx[r] + N - 1) % N]);
  // LF(r): the row of the rotation one letter earlier, found from the last
  // column alone as the count of smaller letters plus the count of the
  // same letter above row r.
  const C = new Int32Array(8), occ = new Int32Array(8), lf = new Int32Array(N);
  for (let r = 0; r < N; r++) C[s.L[r] + 1]++;
  for (let c = 1; c < 8; c++) C[c] += C[c - 1];
  for (let r = 0; r < N; r++) lf[r] = C[s.L[r]] + occ[s.L[r]]++;
  let r = s.rank[0];
  for (let k = 0; k < N; k++) (s.walk[k] = r), (r = lf[r]);
  // The prefix each sorted row shares with a neighbour, plus the letter
  // that tells them apart.
  const lcp = (a, b) => {
    let k = 0;
    while (k < N && T[(a + k) % N] === T[(b + k) % N]) k++;
    return k;
  };
  for (let q = 0; q < N; q++) {
    const up = q > 0 ? lcp(idx[q - 1], idx[q]) : 0, dn = q < N - 1 ? lcp(idx[q], idx[q + 1]) : 0;
    s.keep[q] = max(up, dn) + 1;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(kv[0], 0, 1);
  s.sp = cl(kv[1], 0.2, 3);
  const ord = round(cl(kv[2], 0, 3)), m = round(cl(kv[3], 2, 6));
  // A turn of Order or Letters starts over at once with a new text, so the
  // knob shows in the first sort.
  if (ord !== s.ord || m !== s.m) {
    s.ord = ord;
    s.m = m;
    s.tau = 0;
    build(s, true);
  }
  s.tau += d * (s.sp / 2);
  if (s.tau >= END) {
    s.tau -= END;
    build(s, false);
  }
}

function palette(s) {
  const P = s.pal, m = s.m;
  for (let k = 0; k < m; k++) {
    const u = k / (m - 1);
    hsv(HUE0 + s.hue + SPREAD * u, 0.7 + 0.2 * u, 1 - 0.84 * u, P, k * 3);
  }
  s.palKey = s.hue + ":" + m;
}

const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

export function draw(display, params) {
  const s = params.s;
  if (!s || !s.T) return;
  if (s.palKey !== s.hue + ":" + s.m) palette(s);
  const { buf: B, pal: P, T, rank, keep, tau } = s;
  B.fill(0);
  const put = (x, y, o, k) => {
    const i = (y * W + x) * 3;
    B[i] += P[o] * k;
    B[i + 1] += P[o + 1] * k;
    B[i + 2] += P[o + 2] * k;
  };
  const white = (x, y, k) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 3;
    B[i] += k;
    B[i + 1] += k;
    B[i + 2] += k;
  };

  // Which rotation sits on each row: rotation i glides from row i to its
  // sorted row, all of them at once, and the rows are dealt out in the
  // order of where they have got to, so two rows crossing swap places
  // and no row is ever empty.
  const g = ease((tau - at(1)) / PH[1]), pos = s.pos, ord = s.ord128;
  for (let i = 0; i < N; i++) (pos[i] = i + (rank[i] - i) * g), (ord[i] = i);
  ord.sort((a, b) => pos[a] - pos[b] || a - b);
  for (let y = 0; y < H; y++) s.rowRot[y] = ord[y];

  // How far each sorted row stays solid. In the prefix phase the ghost
  // sweeps in from the right and stops at the shared prefix; then it goes
  // on to column 1, leaving the first column, which is the last column
  // sorted. The walk makes each row it reaches solid again.
  const pref = ease((tau - at(3)) / 0.5), drop = ease((tau - at(4)) / PH[4]);
  const inWalk = tau >= at(5) && tau < at(6);
  const step = inWalk ? min(N - 1, floor(((tau - at(5)) / PH[5]) * N)) : -1;
  s.seen.fill(0);
  if (inWalk) for (let k = 0; k <= step; k++) s.seen[s.walk[k]] = 1;
  const ghostAll = tau >= at(4) && tau < at(6);

  for (let y = 0; y < H; y++) {
    const i = s.rowRot[y], q = rank[i];
    // Letters 0..solid-1 are solid; letter 0 is the first column.
    let solid = MC + 1;
    if (tau >= at(3) && tau < at(4)) solid = round(MC + 1 + (keep[q] - MC - 1) * pref);
    if (ghostAll) solid = round(keep[q] + (1 - keep[q]) * drop);
    if (inWalk && s.seen[q]) solid = MC + 1;
    const fo = T[i] * 3;
    for (let x = 0; x < FW; x++) put(x, y, fo, 1);
    for (let c = 1; c <= MC; c++) {
      const o = T[(i + c) % N] * 3, x = BX + c - 1;
      if (c < solid) put(x, y, o, 1);
      else if (((x + y) & 1) === 0) put(x, y, o, GHOST);
    }
    // The letter that tells the row from its neighbours, lit white while
    // the prefixes show, so the sorted contexts draw their own outline.
    if (tau >= at(3) && tau < at(4) && keep[q] <= MC + 1) {
      const c = keep[q] - 1;
      if (c === 0) for (let x = 0; x < FW; x++) white(x, y, 0.6 * pref);
      else white(BX + c - 1, y, 0.6 * pref);
    }
    // The last letter of the rotation.
    const lo = T[(i + N - 1) % N] * 3;
    for (let x = LX; x < W; x++) put(x, y, lo, 1);
  }

  // Run marks in the gutter, once the rows are sorted: one at the top of
  // each run of the last column.
  const sorted = ease((tau - at(2)) / 0.4);
  if (sorted > 0)
    for (let q = 1; q < N; q++)
      if (s.L[q] !== s.L[q - 1]) for (let x = GX; x < LX; x++) white(x, q, 0.55 * sorted);

  // The walk: the row it stands on flashes, and a line runs from its last
  // letter to the same letter's place in the first column, the next row.
  if (inWalk) {
    for (let back = 0; back < 3; back++) {
      const k = step - back;
      if (k < 0 || k >= N - 1) continue;
      const r0 = s.walk[k], r1 = s.walk[k + 1], a = (0.7 * (3 - back)) / 3;
      if (back === 0) for (let x = BX; x < GX; x++) white(x, r0, 0.35);
      for (let x = FW; x < LX; x++) white(x, round(r0 + ((r1 - r0) * (LX - 1 - x)) / (LX - 1 - FW)), a * 0.6);
      if (back === 0) for (let x = 0; x < FW; x++) white(x, r1, 0.6);
    }
  }
  // The text itself: a white mark beside the row it is on.
  const home = s.rowRot.indexOf(0);
  if (home >= 0) for (let x = GX; x < LX; x++) white(x, home, x === GX ? 1 : 0.6);

  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3)
      display.setPixel(x, y, min(255, round(B[p] * 255)), min(255, round(B[p + 1] * 255)), min(255, round(B[p + 2] * 255)));
}
