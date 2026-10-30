// ===== Patternflow pattern =====
// Title:   EKG Sequence
// Family:  data
// Idea:    The EKG sequence is computed term by term and runs down the panel one term to a row with each value plotted across, scaled so the newest n sits two thirds of the way over: most terms hug the line a = n, and each odd prime p arrives as the run 2p, p, 3p, a stroke out to the faint guide a = n/2, where the prime is written in gold, and across to a = 3n/2, so that as the count goes on the opening fan of three rays from the top corner straightens into three upright lines with the primes listed down the left in order.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the EKG sequence (Jeffrey Lagarias, Eric Rains and Neil Sloane, 2002; OEIS A064413), pattern round 79
// Round:   79
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Zoom=1..4, Links=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the trace is azure, the primes gold and the guides a dim azure; at 0.5 the trace is orange and the primes blue.
// Knob 2: Speed. New terms a second, 4 for each unit: 8 at the opening 2, so near n = 1,000 a prime arrives about every 1.5 s; 0.8 at 0.2 and 12 at 3. After 50,000 terms (the last prime to arrive is 25,771) the count starts again.
// Knob 3: Zoom. Terms to a row: 1 at the opening, so the panel holds 128, up to 4 at the end (512). The panel opens full with the first 128 x Zoom terms, and at 1 the run 1, 2, 4, 6, 3, 9, 12, 8, 10, 5, 15 fans out from the top left corner.
// Knob 4: Links. Colours each step of the trace by the smallest prime its two terms share, fully at 1 and hardly at the opening 0.06: 2 azure, 3 magenta, a larger prime below the square root of the term lime, and one above it white. For p of 5 or more the strokes 2p to p to 3p of each spike are white; the lime steps are the short runs through 5, 7, 29 and the like that weave the line near a = n.

// a(1) = 1, a(2) = 2, and a(n) is the smallest number not used yet that
// shares a factor greater than 1 with a(n - 1). Lagarias, Rains and Sloane
// named it for its graph, which looks like an electrocardiogram, and
// proved that every positive integer turns up in it. Most terms sit a
// little above n; they conjectured n (1 + 1/(3 log n)), and near
// n = 10,000 the middle of the terms here runs at 1.037 n. Each odd prime p
// comes as the run 2p, p, 3p: 2p is an even number near n, p is then the
// smallest unused number sharing a factor with it, and 3p the smallest
// unused multiple of p after that, so the graph drops to about n/2 and
// jumps to about 3n/2. They saw this for every prime they computed, and it
// was proved later. In the 50,000 terms here it holds for all 2,837 odd
// primes, and the primes arrive in increasing order.
//
// The code keeps a used flag for every number and, for each prime p, the
// least m with p m unused; m only moves up, since numbers are only ever
// added to the used set. The next term is the least p m over the primes of
// the last term, read off a table of smallest prime factors.
//
// Each row of the panel holds a term (or Zoom terms), the newest at the
// bottom, and the value runs across with 0 on column 2 and the newest n on
// column 42. So the guides a = n/2, n and 3n/2 are rays from the point
// n = 0 above the panel, and they lean less as n grows.

const W = 64, H = 128, N = W * H;
const { floor, max, abs, round, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Terms before the count starts again, and the numbers the code keeps
// track of: in the first 50,000 terms the largest is 77,313 and the largest
// candidate looked at 103,084.
const NMAX = 50000, LIM = 120000;
// Columns: the value 0 sits on column X0 and the newest n on X0 + XS.
const X0 = 2, XS = 40;
const DIG = ["111101101101111", "010110010010111", "111001111100111", "111001011001111", "101101111001001", "111100111001111", "111100111101111", "111001001010010", "111101111101111", "111101111001111"];

function hsv(h, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h);
  const v = [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][i];
  o[0] = v[0];
  o[1] = v[1];
  o[2] = v[2];
  return o;
}

// Smallest prime factor of every number up to LIM.
function sieve() {
  const s = new Int32Array(LIM + 1);
  for (let i = 2; i <= LIM; i++) if (!s[i]) for (let j = i; j <= LIM; j += i) if (!s[j]) s[j] = i;
  return s;
}

export function setup(params) {
  params.s = {
    hue: 0, rate: 8, zoom: 1, links: 0.06, acc: 0, ready: false,
    spf: sieve(), a: new Int32Array(NMAX + 2), link: new Int32Array(NMAX + 2),
    used: new Uint8Array(LIM + 1), ptr: new Int32Array(LIM + 1), n: 0,
    buf: new Float32Array(N * 3), cols: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], c: [0, 0, 0],
  };
}

function restart(S) {
  S.used.fill(0);
  S.ptr.fill(0);
  S.a[1] = 1;
  S.a[2] = 2;
  S.used[1] = S.used[2] = 1;
  S.link[2] = 2;
  S.n = 2;
}

// a(n + 1): for each prime p of a(n), the smallest multiple of p not yet
// used (ptr[p] only ever moves up, since used only fills), and the least
// of these. link is the smallest prime the two terms share.
function next(S) {
  const spf = S.spf, used = S.used, ptr = S.ptr, prev = S.a[S.n];
  let x = prev, best = Infinity;
  while (x > 1) {
    const p = spf[x];
    while (x % p === 0) x /= p;
    let m = ptr[p] || 1;
    while (p * m <= LIM && used[p * m]) m++;
    ptr[p] = m;
    if (p * m < best) best = p * m;
  }
  if (best > LIM || S.n >= NMAX) {
    S.ready = false;
    return;
  }
  x = prev;
  let lk = 0;
  while (x > 1 && !lk) {
    const p = spf[x];
    while (x % p === 0) x /= p;
    if (best % p === 0) lk = p;
  }
  S.n++;
  S.a[S.n] = best;
  S.link[S.n] = lk;
  used[best] = 1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.rate = 4 * cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.zoom = cl(k[2] == null ? 1 : k[2], 1, 4);
  S.links = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  if (!S.ready) fill(S);
  S.acc += d * S.rate;
  while (S.acc >= 1) {
    next(S);
    if (!S.ready) fill(S);
    S.acc -= 1;
  }
}

// Open, and start again, with the panel full: the first 128 x Zoom terms.
function fill(S) {
  restart(S);
  while (S.n < round(H * S.zoom)) next(S);
  S.ready = true;
}

function put(buf, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] = max(buf[o], c[0] * a);
  buf[o + 1] = max(buf[o + 1], c[1] * a);
  buf[o + 2] = max(buf[o + 2], c[2] * a);
}

function line(buf, x0, y0, x1, y1, c, a) {
  const n = max(abs(x1 - x0), abs(y1 - y0), 1);
  for (let s = 0; s <= n; s++) put(buf, round(x0 + ((x1 - x0) * s) / n), round(y0 + ((y1 - y0) * s) / n), c, a);
}

function digits(buf, v, x, y, c, a) {
  const t = String(v);
  for (let i = 0; i < t.length; i++) {
    const g = DIG[t.charCodeAt(i) - 48];
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === "1") put(buf, x + i * 4 + q, y + r, c, a);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const buf = S.buf, n = S.n, z = S.zoom, A = S.a, spf = S.spf;
  const [base, three, lime, gold, white] = S.cols;
  hsv(0.58 + S.hue, base);
  hsv(0.86 + S.hue, three);
  hsv(0.3 + S.hue, lime);
  hsv(0.13 + S.hue, gold);
  white[0] = white[1] = white[2] = 1;
  buf.fill(0);
  const X = (v) => X0 + (XS * v) / n, Y = (i) => H - 1 - (n - i) / z;
  // The guides a = n/2, n, 3n/2, dotted on every other term.
  for (let y = 0; y < H; y++) {
    const m = n - (H - 1 - y) * z;
    if (m < 1 || floor(m / z) % 2) continue;
    for (const f of [0.5, 1, 1.5]) put(buf, round(X(f * m)), y, base, 0.3);
  }
  const first = max(1, ceil(n - (H - 1) * z) - 1), c = S.c;
  for (let i = first + 1; i <= n; i++) {
    const lk = S.link[i], u = S.links, tint = lk === 2 ? base : lk === 3 ? three : lk * lk > A[i] ? white : lime;
    for (let q = 0; q < 3; q++) c[q] = base[q] * (1 - u) + tint[q] * u;
    line(buf, round(X(A[i - 1])), round(Y(i - 1)), round(X(A[i])), round(Y(i)), c, 0.8 + 0.2 * u);
  }
  // Each prime: a gold tip and its value beside it.
  let lastRow = -99;
  for (let i = max(1, first); i <= n; i++) {
    const v = A[i];
    if (v < 2 || spf[v] !== v) continue;
    const x = round(X(v)), y = round(Y(i));
    put(buf, x, y, white, 1);
    put(buf, x - 1, y, gold, 1);
    put(buf, x + 1, y, gold, 1);
    // A label that would touch the one above moves down, by 3 rows at most.
    const w = String(v).length * 4 - 1, ly = max(y - 2, lastRow + 6);
    if (x - 3 - w < 0 || ly > y + 1) continue;
    digits(buf, v, x - 3 - w, ly, gold, 0.9);
    lastRow = ly;
  }
  put(buf, round(X(A[n])), H - 1, white, 1);
  for (let i = 0; i < N; i++) display.setPixel(i % W, floor(i / W), round(cl(buf[i * 3], 0, 1) * 255), round(cl(buf[i * 3 + 1], 0, 1) * 255), round(cl(buf[i * 3 + 2], 0, 1) * 255));
}
