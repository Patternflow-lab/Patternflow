// ===== Patternflow pattern =====
// Title:   Sorting
// Family:  algo
// Idea:    Sixty-four bars are put in order by an algorithm you can watch compare and swap them one operation at a time, then a sweep checks the order and they are thrown back into a heap.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// Round:   2
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0..5, Algorithm=0..7, Rows=2..8
//
// Knob 1: Hue. Turns the bars, which run from the shortest to the longest across a third of the colour wheel.
// Knob 2: Speed. Operations per second with 64 bars, from 50 to about 5400, and a quarter of that with 16; a compare, a swap and a write each count as one.
// Knob 3: Algorithm. 0 bubble, 1 insertion, 2 selection, 3 shell, 4 quick, 5 merge, 6 heap, 7 radix; turned mid-sort, the new one takes the bars as they stand.
// Knob 4: Rows. How many LED rows each bar takes: 2 gives 64 bars, 8 gives 16 with a dark row between them.
// Buttons: K1 tap throws the bars back into a heap.

const W = 64;
const H = 128;
const MAXN = 64;
// The worst case is bubble or insertion sort on 64 bars in reverse: 2016
// compares and 2016 swaps.
const OPS = 8192;
const COMPARE = 0;
const SWAP = 1;
const WRITE = 2;

const SORT = 0;
const SWEEP = 1;
const HOLD = 2;
const SHUFFLE = 3;

// Gaps for shell sort, Ciura's sequence cut to what 64 bars can use.
const GAPS = [57, 23, 10, 4, 1];

function hsvInto(out, o, h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = 255 * (k === 0 ? v : k === 1 ? q : k === 2 ? p : k === 3 ? p : k === 4 ? t : v);
  out[o + 1] = 255 * (k === 0 ? t : k === 1 ? v : k === 2 ? v : k === 3 ? q : k === 4 ? p : p);
  out[o + 2] = 255 * (k === 0 ? p : k === 1 ? p : k === 2 ? t : k === 3 ? v : k === 4 ? v : q);
}

export function setup(params) {
  // The bars on screen, and the copy an algorithm runs on ahead of them.
  params.arr = new Int16Array(MAXN);
  params.work = new Int16Array(MAXN);
  params.aux = new Int16Array(MAXN);
  params.bucket = new Int16Array(4);
  params.ops = new Int32Array(OPS);
  params.opN = 0;
  params.opAt = 0;
  params.heatC = new Float32Array(MAXN);
  params.heatS = new Float32Array(MAXN);
  params.glow = new Float32Array(MAXN);
  params.len = new Uint8Array(MAXN);
  params.col = new Float32Array(MAXN * 3);
  params.done = new Float32Array(MAXN * 3);
  params.accent = new Float32Array(3);
  params.n = 0;
  params.rows = 2;
  params.algo = 0;
  params.phase = SORT;
  params.t = 0;
  params.budget = 0;
  params.hueKey = -1;
}

// The algorithms run on params.work in one go and leave their operations in
// params.ops, which update then plays back at the speed the knob asks for.
function cmp(P, i, j) {
  if (P.opN < OPS) P.ops[P.opN++] = (COMPARE << 16) | (i << 8) | j;
  return P.work[i] - P.work[j];
}

function swp(P, i, j) {
  const a = P.work;
  const t = a[i];
  a[i] = a[j];
  a[j] = t;
  if (P.opN < OPS) P.ops[P.opN++] = (SWAP << 16) | (i << 8) | j;
}

function put(P, i, v) {
  P.work[i] = v;
  if (P.opN < OPS) P.ops[P.opN++] = (WRITE << 16) | (i << 8) | v;
}

function bubble(P, n) {
  for (let end = n - 1; end > 0; end--) {
    let swapped = false;
    for (let j = 0; j < end; j++) {
      if (cmp(P, j, j + 1) > 0) {
        swp(P, j, j + 1);
        swapped = true;
      }
    }
    if (!swapped) return;
  }
}

function insertion(P, n, gap) {
  for (let i = gap; i < n; i++) {
    for (let j = i; j >= gap && cmp(P, j - gap, j) > 0; j -= gap) swp(P, j - gap, j);
  }
}

function selection(P, n) {
  for (let i = 0; i < n - 1; i++) {
    let m = i;
    for (let j = i + 1; j < n; j++) if (cmp(P, j, m) < 0) m = j;
    if (m !== i) swp(P, i, m);
  }
}

function quick(P, lo, hi) {
  if (lo >= hi) return;
  // The middle bar is the pivot, parked at the end while the range is split,
  // so a range that is already in order does not take n squared compares.
  swp(P, (lo + hi) >> 1, hi);
  let s = lo;
  for (let j = lo; j < hi; j++) {
    if (cmp(P, j, hi) < 0) {
      if (j !== s) swp(P, s, j);
      s++;
    }
  }
  if (s !== hi) swp(P, s, hi);
  quick(P, lo, s - 1);
  quick(P, s + 1, hi);
}

function merge(P, lo, hi) {
  if (hi - lo < 2) return;
  const mid = (lo + hi) >> 1;
  merge(P, lo, mid);
  merge(P, mid, hi);
  const a = P.work;
  const aux = P.aux;
  for (let i = lo; i < hi; i++) aux[i] = a[i];
  let i = lo;
  let j = mid;
  for (let k = lo; k < hi; k++) {
    // The compare lights where the two runs were read from; the write lands
    // on the bar being rebuilt.
    if (i < mid && j < hi) {
      if (P.opN < OPS) P.ops[P.opN++] = (COMPARE << 16) | (i << 8) | j;
      if (aux[i] <= aux[j]) put(P, k, aux[i++]);
      else put(P, k, aux[j++]);
    } else if (i < mid) put(P, k, aux[i++]);
    else put(P, k, aux[j++]);
  }
}

function sift(P, start, end) {
  let root = start;
  for (;;) {
    let child = root * 2 + 1;
    if (child > end) return;
    if (child + 1 <= end && cmp(P, child, child + 1) < 0) child++;
    if (cmp(P, root, child) < 0) {
      swp(P, root, child);
      root = child;
    } else return;
  }
}

function heap(P, n) {
  for (let s = (n >> 1) - 1; s >= 0; s--) sift(P, s, n - 1);
  for (let end = n - 1; end > 0; end--) {
    swp(P, 0, end);
    sift(P, 0, end - 1);
  }
}

// Least significant digit first, in base 4: each pass reads every bar once to
// count its digit, then writes them all back grouped by it.
function radix(P, n) {
  const a = P.work;
  const aux = P.aux;
  const b = P.bucket;
  for (let shift = 0; 1 << shift < n; shift += 2) {
    b.fill(0);
    for (let i = 0; i < n; i++) {
      if (P.opN < OPS) P.ops[P.opN++] = (COMPARE << 16) | (i << 8) | i;
      b[(a[i] >> shift) & 3]++;
      aux[i] = a[i];
    }
    let sum = 0;
    for (let d = 0; d < 4; d++) {
      const c = b[d];
      b[d] = sum;
      sum += c;
    }
    // The bars go back in order of their old places, so the pass is stable.
    // Writing them by the place they land on makes the pass run top to bottom.
    for (let i = 0; i < n; i++) a[b[(aux[i] >> shift) & 3]++] = aux[i];
    for (let i = 0; i < n; i++) put(P, i, a[i]);
  }
}

function startSort(P, algo) {
  const n = P.n;
  P.work.set(P.arr);
  P.opN = 0;
  P.opAt = 0;
  P.algo = algo;
  if (algo === 0) bubble(P, n);
  else if (algo === 1) insertion(P, n, 1);
  else if (algo === 2) selection(P, n);
  else if (algo === 3) {
    for (let g = 0; g < GAPS.length; g++) if (GAPS[g] < n) insertion(P, n, GAPS[g]);
  } else if (algo === 4) quick(P, 0, n - 1);
  else if (algo === 5) merge(P, 0, n);
  else if (algo === 6) heap(P, n);
  else radix(P, n);
  P.phase = SORT;
}

function startShuffle(P) {
  const n = P.n;
  P.work.set(P.arr);
  P.opN = 0;
  P.opAt = 0;
  // Fisher and Yates, top to bottom, played back as swaps.
  for (let i = 0; i < n - 1; i++) swp(P, i, i + Math.floor(Math.random() * (n - i)));
  P.phase = SHUFFLE;
}

function play(P, op) {
  const type = op >> 16;
  const i = (op >> 8) & 255;
  const j = op & 255;
  if (type === COMPARE) {
    P.heatC[i] = 1;
    P.heatC[j] = 1;
  } else if (type === SWAP) {
    const t = P.arr[i];
    P.arr[i] = P.arr[j];
    P.arr[j] = t;
    P.heatS[i] = 1;
    P.heatS[j] = 1;
  } else {
    P.arr[i] = j;
    P.heatS[i] = 1;
  }
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 2];
  const rows = Math.max(2, Math.min(8, Math.round(k[3])));
  const algo = Math.max(0, Math.min(7, Math.round(k[2])));
  const ops = 50 * Math.pow(2, 1.35 * k[1]);
  // Fewer bars go slower in step, so a chunky bar can be followed by eye and
  // sixteen of them do not spend most of their time sorted.
  const rate = ops * (Math.floor(H / rows) / MAXN);
  // At the fast end the check, the pause and the shuffle shorten too.
  const pace = Math.max(0.45, Math.min(1, Math.pow(320 / ops, 0.4)));

  if (rows !== P.rows || P.n === 0) {
    P.rows = rows;
    P.n = Math.floor(H / rows);
    const n = P.n;
    for (let v = 0; v < n; v++) P.len[v] = Math.max(1, Math.round(((v + 1) * W) / n));
    for (let i = 0; i < n; i++) P.arr[i] = i;
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = P.arr[i];
      P.arr[i] = P.arr[j];
      P.arr[j] = t;
    }
    P.heatC.fill(0);
    P.heatS.fill(0);
    P.glow.fill(0);
    P.hueKey = -1;
    startSort(P, algo);
  } else if (algo !== P.algo) {
    if (P.phase === SORT) startSort(P, algo);
    else P.algo = algo;
  }
  if (input.btnPressed && input.btnPressed[0]) startShuffle(P);

  const n = P.n;
  // A lit bar fades over about the last ten operations with 64 bars and the
  // last three with 16, so a slow sort shows each step and a fast one a tail.
  const life = Math.max(0.035, Math.min(0.2, 11 / ops));
  const fadeC = Math.exp(-dt / (life * 0.7));
  const fadeS = Math.exp(-dt / life);
  for (let i = 0; i < n; i++) {
    P.heatC[i] *= fadeC;
    P.heatS[i] *= fadeS;
  }

  if (P.phase === SORT || P.phase === SHUFFLE) {
    // The heap is thrown in about two thirds of a second, less at the fast end.
    P.budget += dt * (P.phase === SORT ? rate : n / (0.65 * pace));
    while (P.budget >= 1 && P.opAt < P.opN) {
      play(P, P.ops[P.opAt++]);
      P.budget -= 1;
    }
    if (P.phase === SHUFFLE) for (let i = 0; i < n; i++) P.glow[i] = Math.max(0, P.glow[i] - dt * 4);
    if (P.opAt >= P.opN) {
      P.budget = 0;
      if (P.phase === SORT) {
        P.phase = SWEEP;
        P.t = 0;
      } else startSort(P, P.algo);
    }
  } else if (P.phase === SWEEP) {
    // The check runs down the bars in 0.8 s and leaves them lit behind it.
    P.t += dt;
    const s = Math.min(n, (P.t / (0.8 * pace)) * n);
    for (let i = 0; i < s; i++) P.glow[i] = 1;
    if (s < n) P.heatC[Math.floor(s)] = 1;
    else {
      P.phase = HOLD;
      P.t = 0;
    }
  } else {
    P.t += dt;
    if (P.t > 0.9 * pace) startShuffle(P);
  }

  // Colours change only with the hue knob or the number of bars. K1 at 0
  // opens on cyan running to violet.
  const hue = k[0] + 0.45;
  if (hue !== P.hueKey) {
    P.hueKey = hue;
    for (let v = 0; v < n; v++) {
      const h = hue + (0.33 * v) / Math.max(1, n - 1);
      hsvInto(P.col, v * 3, h, 0.82, 0.62);
      hsvInto(P.done, v * 3, h, 0.5, 0.82);
    }
    hsvInto(P.accent, 0, hue + 0.58, 0.95, 1);
  }
}

export function draw(display, params, time) {
  const P = params;
  const n = P.n;
  const rows = P.rows;
  // Bars thicker than two rows keep a dark row under them so they stay apart.
  const thick = rows > 2 ? rows - 1 : rows;
  const top = (H - n * rows) >> 1;
  const col = P.col;
  const done = P.done;
  const ac = P.accent;
  for (let y = 0; y < H; y++) {
    const off = y - top;
    const i = Math.floor(off / rows);
    if (off < 0 || i >= n || off - i * rows >= thick) {
      for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);
      continue;
    }
    const v = P.arr[i];
    const g = P.glow[i];
    const hc = P.heatC[i];
    const hs = P.heatS[i];
    let r = col[v * 3] + (done[v * 3] - col[v * 3]) * g;
    let gr = col[v * 3 + 1] + (done[v * 3 + 1] - col[v * 3 + 1]) * g;
    let b = col[v * 3 + 2] + (done[v * 3 + 2] - col[v * 3 + 2]) * g;
    r += (225 - r) * hc;
    gr += (225 - gr) * hc;
    b += (225 - b) * hc;
    r += (ac[0] - r) * hs;
    gr += (ac[1] - gr) * hs;
    b += (ac[2] - b) * hs;
    const L = P.len[v];
    for (let x = 0; x < W; x++) {
      if (x < L) display.setPixel(x, y, r, gr, b);
      else display.setPixel(x, y, 0, 0, 0);
    }
  }
}
