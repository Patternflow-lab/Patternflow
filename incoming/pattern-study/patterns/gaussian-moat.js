// ===== Patternflow pattern =====
// Title:   Gaussian Moat
// Family:  number
// Idea:    Every LED is a Gaussian integer with the origin at the bottom-left corner, the Gaussian primes glow as faint dots, and a breadth-first flood from 1 + i hops from prime to prime in steps no longer than the square root of k, growing a branching coral coloured by its depth until it meets a moat, where its shore pulses and k rises to the next possible step so the flood can cross.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Gaussian moat problem (Basil Gordon, 1962), pattern round 31
// Round:   31
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Step=1.5..4.5, Reach=0..1
//
// Knob 1: Hue. Turns the flood's colours round the wheel; at 0 the coral runs from gold at 1 + i through green to cyan and back over every 72 steps of depth, across pale blue prime dots.
// Knob 2: Speed. At 2 the flood reaches 56 primes a second near 1 + i, faster as its frontier widens, and each moat pulses for 0.7 s; at 0.2 everything runs ten times slower.
// Knob 3: Step. The first step length: at 1.5 the flood starts with k = 2 and meets moats at k = 2, 4, 5, 8, 9 and 13 before the last primes in the window join at 16; at 4.5 it starts at k = 20 and fans across the window in one go.
// Knob 4: Reach. Moves the window out along the diagonal: the corner is 0 + 0i up to 0.1, then from 8 + 8i to 4800 + 4800i at 1, where primes are half as dense and the corner prime stays trapped until k = 20. Each restart moves the corner a further 24, then 140, before coming back.
// Buttons: K1 tap raises k to the next step at once, so the flood jumps the moat it is working along.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, abs, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The squared lengths a step between two Gaussian integers can have: the
// sums of two squares, 1 left out since no two odd primes sit 1 apart.
const KS = [];
for (let n = 2; n <= 50; n++) {
  let ok = false;
  for (let a = 0; a * a <= n && !ok; a++) {
    const b = Math.round(sqrt(n - a * a));
    if (a * a + b * b === n) ok = true;
  }
  if (ok) KS.push(n);
}
const KMAX = 50;

// Every offset with dx^2 + dy^2 <= 50, nearest first. A flood with step k
// scans the first NK[k] of them; the moat line reads the first R49.
const OD = [];
for (let dy = -7; dy <= 7; dy++)
  for (let dx = -7; dx <= 7; dx++) {
    const d = dx * dx + dy * dy;
    if (d <= KMAX) OD.push([d, dx, dy]);
  }
OD.sort((p, q) => p[0] - q[0] || p[2] - q[2] || p[1] - q[1]);
const ODX = new Int8Array(OD.length), ODY = new Int8Array(OD.length), ODD = new Uint8Array(OD.length);
OD.forEach((o, i) => {
  ODD[i] = o[0];
  ODX[i] = o[1];
  ODY[i] = o[2];
});
const NK = new Uint16Array(KMAX + 1);
for (let k = 0; k <= KMAX; k++) {
  let n = 0;
  while (n < OD.length && ODD[n] <= k) n++;
  NK[k] = n;
}
let R49 = 0;
while (R49 < OD.length && ODD[R49] <= 49) R49++;

// Rational primes up to 7300 by a sieve, enough to test norms up to
// 2 * 5072^2 by trial division, the far corner at Reach 1 plus the cycle.
const SP = [];
{
  const M = 7300, c = new Uint8Array(M + 1);
  for (let i = 2; i <= M; i++) {
    if (c[i]) continue;
    SP.push(i);
    for (let j = i * i; j <= M; j += i) c[j] = 1;
  }
}
function isPrime(n) {
  if (n < 2) return false;
  for (let i = 0; i < SP.length; i++) {
    const p = SP[i];
    if (p * p > n) return true;
    if (n % p === 0) return n === p;
  }
  return true;
}
// a + bi with a, b >= 0 is a Gaussian prime when its norm is a prime, or when
// it lies on an axis and is a prime of the form 4n + 3.
function gaussPrime(a, b) {
  if (a === 0) return b % 4 === 3 && isPrime(b);
  if (b === 0) return a % 4 === 3 && isPrime(a);
  return isPrime(a * a + b * b);
}

function hsv(h, s, v, out, o) {
  const f = (n) => {
    const k = (n + (h - floor(h)) * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  out[o] = f(5) * 255;
  out[o + 1] = f(3) * 255;
  out[o + 2] = f(1) * 255;
}

// Reach: the corner stays at the origin up to 0.1, then moves out along the
// diagonal from 8 + 8i to 4800 + 4800i on a log scale. Each restart adds the
// next of CYCLE, so the window wanders out where primes thin and comes back.
const reachOf = (u) => (u <= 0.1 ? 0 : Math.round(8 * 600 ** ((u - 0.1) / 0.9)));
const CYCLE = [0, 24, 140];
// The first k for a Step: the largest step length squared that fits.
function firstK(step) {
  let k = KS[0];
  for (const q of KS) if (q <= step * step + 1e-9) k = q;
  return k;
}
const nextK = (k) => {
  for (const q of KS) if (q > k) return q;
  return KMAX + 1;
};

const DMAX = 1024;

export function setup(params) {
  params.s = {
    pr: new Uint8Array(N), dep: new Int16Array(N), par: new Int32Array(N), q: new Int32Array(N), born: new Float32Array(N),
    ea: new Float32Array(N), ed: new Uint16Array(N), wa: new Float32Array(N), wash: new Float32Array(3), moat: new Float32Array(N), shore: [], grow: [], tg: 0.3, sp: 2, hueK: 0, startT: -1,
    nPrime: 0, qlen: 0, lastQ: 0, plen: 1, head: 0, scan: 0, k: 2, k0: 2, off: -1, base: -1, stage: 0,
    mode: 0, timer: 0, acc: 0, T: 0, fade: 1, moatA: 0,
    hue: -1, pal: new Float32Array(DMAX * 3), dot: new Float32Array(3), buf: new Float32Array(N * 3),
  };
}

// Lays out the window with its corner at off + off*i and seeds the flood at
// the prime nearest the corner: 1 + i when the corner is the origin.
function build(S, off) {
  S.off = off;
  S.nPrime = 0;
  let seed = -1, best = 1e9;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, b = H - 1 - y, g = gaussPrime(x + off, b + off) ? 1 : 0;
      S.pr[p] = g;
      if (g) {
        S.nPrime++;
        const d = x * x + b * b;
        if (d < best) (best = d), (seed = p);
      }
    }
  S.dep.fill(-1);
  S.born.fill(-10);
  S.ea.fill(0);
  S.wa.fill(0);
  S.moat.fill(0);
  S.grow.length = 0;
  S.shore = [];
  S.qlen = 0;
  S.head = 0;
  S.scan = 0;
  S.k = S.k0;
  S.mode = 0;
  S.timer = 0;
  S.acc = 0;
  S.moatA = 0;
  S.lastQ = 0;
  // A restart fades in over 0.6 s; the first window is there at once.
  S.startT = S.T > 0 ? S.T : -1;
  if (seed >= 0) {
    S.dep[seed] = 0;
    S.par[seed] = seed;
    S.born[seed] = S.T;
    S.q[S.qlen++] = seed;
    soak(S, seed);
  }
}

// The next prime the flood reaches: breadth first over the cluster, each
// prime scanning its neighbours nearest first out to distance sqrt(k).
// Only primes inside the window count, so a moat here is a moat of the
// window: a prime just outside it could bridge one.
function pull(S) {
  const n = NK[min(S.k, KMAX)], pr = S.pr, dep = S.dep;
  while (S.head < S.qlen) {
    const p = S.q[S.head], x = p & 63, y = p >> 6;
    while (S.scan < n) {
      const i = S.scan++, X = x + ODX[i], Y = y + ODY[i];
      if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
      const c = Y * W + X;
      if (pr[c] && dep[c] < 0) {
        dep[c] = min(DMAX - 1, dep[p] + 1);
        S.par[c] = p;
        S.born[c] = S.T;
        S.q[S.qlen++] = c;
        return c;
      }
    }
    S.head++;
    S.scan = 0;
  }
  return -1;
}

// A segment a LED wide, soft at its sides, into the edge layer: each LED keeps
// the strongest cover and the depth of the edge that gave it.
function stamp(S, x0, y0, x1, y1, d, ea, ed) {
  const vx = x1 - x0, vy = y1 - y0, L2 = vx * vx + vy * vy || 1;
  const xa = max(0, floor(min(x0, x1)) - 1), xb = min(W - 1, Math.ceil(max(x0, x1)) + 1);
  const ya = max(0, floor(min(y0, y1)) - 1), yb = min(H - 1, Math.ceil(max(y0, y1)) + 1);
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const t = cl(((x - x0) * vx + (y - y0) * vy) / L2, 0, 1), ex = x0 + vx * t - x, ey = y0 + vy * t - y;
      const a = 1 - sqrt(ex * ex + ey * ey) * 1.1;
      if (a <= 0) continue;
      const p = y * W + x;
      if (a > ea[p]) {
        ea[p] = a;
        if (ed) ed[p] = d;
      }
    }
}

// The ground the flood holds: a faint wash out to 2 LEDs round each reached
// prime, so a moat shows as the dark band between the wash and the dots.
function soak(S, p) {
  const x0 = p & 63, y0 = p >> 6, wa = S.wa;
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const x = x0 + dx, y = y0 + dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const a = cl(1.15 - sqrt(dx * dx + dy * dy) * 0.38, 0, 1), q = y * W + x;
      if (a > wa[q]) wa[q] = a;
    }
}

// The flood has run out. The shore is every reached prime with an unreached
// one within the next step; the moat line runs where the nearest reached
// prime and the nearest unreached one are equally far.
function meetMoat(S) {
  const kn = min(nextK(S.k), KMAX), nk = NK[kn], pr = S.pr, dep = S.dep;
  S.shore = [];
  for (let h = 0; h < S.qlen; h++) {
    const p = S.q[h], x = p & 63, y = p >> 6;
    for (let i = 1; i < nk; i++) {
      const X = x + ODX[i], Y = y + ODY[i];
      if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
      const c = Y * W + X;
      if (pr[c] && dep[c] < 0) {
        S.shore.push(p);
        break;
      }
    }
  }
  const m = S.moat;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let dr = -1, du = -1;
      for (let i = 0; i < R49 && (dr < 0 || du < 0); i++) {
        const X = x + ODX[i], Y = y + ODY[i];
        if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
        const c = Y * W + X;
        if (!pr[c]) continue;
        if (dep[c] >= 0) {
          if (dr < 0) dr = ODD[i];
        } else if (du < 0) du = ODD[i];
      }
      m[y * W + x] = dr > 0 && du > 0 ? max(0, 1 - abs(sqrt(dr) - sqrt(du)) * 0.8) : 0;
    }
  // A step that crossed nothing pulses for a third as long, so a prime
  // trapped in a corner runs through its empty steps quickly.
  S.plen = S.qlen > S.lastQ ? 1 : 0.35;
  S.lastQ = S.qlen;
}

function raise(S) {
  S.k = nextK(S.k);
  S.head = 0;
  S.scan = 0;
  S.mode = S.k > KMAX ? 2 : 0;
  S.timer = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 1.5, 0.06], d = cl(dt || 0, 0, 0.1);
  const sp = cl(kv[1], 0.2, 3), k0 = firstK(cl(kv[2], 1.5, 4.5)), base = reachOf(cl(kv[3], 0, 1));
  S.T += d;
  S.hueK = kv[0] || 0;
  if (base !== S.base) {
    S.base = base;
    S.stage = 0;
    S.k0 = k0;
    build(S, base);
  } else if (k0 !== S.k0) {
    // A longer first step carries on from here; a shorter one starts over.
    const up = k0 > S.k0;
    S.k0 = k0;
    if (!up) build(S, S.off);
    else if (S.mode < 2 && k0 > S.k) {
      S.k = k0;
      S.head = 0;
      S.scan = 0;
      S.mode = 0;
    }
  }
  const b = input.btnPressed || [];
  if (b[0] && S.mode < 2) raise(S);

  // Each new edge grows from its parent for 0.3 s at Speed 2.
  const tg = 0.6 / sp;
  for (let i = S.grow.length - 1; i >= 0; i--) {
    const c = S.grow[i];
    if (S.T - S.born[c] >= tg) {
      const p = S.par[c];
      stamp(S, p & 63, p >> 6, c & 63, c >> 6, S.dep[c], S.ea, S.ed);
      soak(S, c);
      S.grow[i] = S.grow[S.grow.length - 1];
      S.grow.pop();
    }
  }
  S.tg = tg;

  if (S.mode === 0) {
    // A few dozen primes a second, more as the frontier (the primes queued
    // but not yet scanned) widens: 56 a second at Speed 2 near 1 + i.
    S.acc += d * sp * min(90, 28 + (S.qlen - S.head));
    while (S.acc >= 1) {
      S.acc -= 1;
      const c = pull(S);
      if (c >= 0) {
        S.grow.push(c);
        continue;
      }
      S.acc = 0;
      if (S.qlen >= S.nPrime) {
        S.mode = 2;
        S.timer = 0;
      } else {
        meetMoat(S);
        S.mode = 1;
        S.timer = 0;
      }
      break;
    }
  } else if (S.mode === 1) {
    // The moat: 0.7 s at Speed 2 of the shore pulsing, then k goes up.
    S.timer += (d * sp * 0.72) / S.plen;
    if (S.timer >= 1) raise(S);
  } else {
    // Filled: the coral holds for 3 s, fades for 1.5 s, and the next window
    // in the cycle starts.
    S.timer += d * sp * 0.5;
    if (S.timer >= 4.5) {
      S.stage = (S.stage + 1) % CYCLE.length;
      build(S, S.base + CYCLE[S.stage]);
    }
  }
  S.fade = S.mode === 2 ? cl((4.5 - S.timer) / 1.5, 0, 1) : cl((S.T - S.startT) / 0.6, 0, 1);
  S.moatA = S.mode === 1 ? sin(PI * S.timer) : max(0, S.moatA - d * sp * 1.2);
  S.sp = sp;
}

// Colours by depth: the hue runs out and back along a band of the wheel
// every 72 steps of depth, so each breadth-first layer reads as a ring.
function palette(S) {
  const h0 = S.hueK + 0.13;
  for (let i = 0; i < DMAX; i++) {
    let u = (i % 72) / 36;
    if (u > 1) u = 2 - u;
    hsv(h0 + 0.42 * u * u * (3 - 2 * u), 0.78, 1, S.pal, i * 3);
  }
  hsv(h0 + 0.5, 0.6, 0.3, S.dot, 0);
  hsv(h0 + 0.47, 0.9, 0.26, S.wash, 0);
  S.hue = S.hueK;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.hue !== S.hueK) palette(S);
  const buf = S.buf, pal = S.pal, dot = S.dot, pr = S.pr, dep = S.dep, ea = S.ea, ed = S.ed, wa = S.wa, wash = S.wash, born = S.born, T = S.T;
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    const w = wa[p];
    let r = wash[0] * w, g = wash[1] * w, b = wash[2] * w;
    const a = ea[p];
    if (a > 0) {
      const c = ed[p] * 3, v = a * 0.62;
      r = max(r, pal[c] * v);
      g = max(g, pal[c + 1] * v);
      b = max(b, pal[c + 2] * v);
    }
    if (pr[p]) {
      const dd = dep[p];
      if (dd < 0) {
        r = max(r, dot[0]);
        g = max(g, dot[1]);
        b = max(b, dot[2]);
      } else {
        // A new node flashes white and settles into its colour.
        const c = dd * 3, fl = cl(1 - (T - born[p]) * 2.5, 0, 1);
        r = pal[c] + (255 - pal[c]) * fl;
        g = pal[c + 1] + (255 - pal[c + 1]) * fl;
        b = pal[c + 2] + (255 - pal[c + 2]) * fl;
      }
    }
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
  }
  // Edges still growing, from the parent toward the new prime.
  if (S.grow.length) {
    const tmp = S.tmp || (S.tmp = new Float32Array(N));
    for (const c of S.grow) {
      const p = S.par[c], t = cl((T - born[c]) / S.tg, 0, 1), x0 = p & 63, y0 = p >> 6, x1 = c & 63, y1 = c >> 6;
      const xe = x0 + (x1 - x0) * t, ye = y0 + (y1 - y0) * t;
      stamp(S, x0, y0, xe, ye, 0, tmp, null);
      const xa = max(0, min(x0, x1) - 1), xb = min(W - 1, max(x0, x1) + 1), ya = max(0, min(y0, y1) - 1), yb = min(H - 1, max(y0, y1) + 1);
      const cc = dep[c] * 3;
      for (let y = ya; y <= yb; y++)
        for (let x = xa; x <= xb; x++) {
          const q = y * W + x, v = tmp[q] * 0.8;
          if (v <= 0) continue;
          tmp[q] = 0;
          const o = q * 3;
          buf[o] = max(buf[o], pal[cc] * v + 60 * v);
          buf[o + 1] = max(buf[o + 1], pal[cc + 1] * v + 60 * v);
          buf[o + 2] = max(buf[o + 2], pal[cc + 2] * v + 60 * v);
        }
    }
  }
  // The moat: its middle line glows pale and the shore primes pulse white.
  if (S.moatA > 0.01) {
    const m = S.moat, A = S.moatA;
    for (let p = 0, o = 0; p < N; p++, o += 3) {
      const v = m[p] * A * 0.9;
      if (v <= 0) continue;
      buf[o] += (170 - buf[o]) * v;
      buf[o + 1] += (215 - buf[o + 1]) * v;
      buf[o + 2] += (255 - buf[o + 2]) * v;
    }
    const pulse = 0.5 + 0.5 * sin(T * S.sp * 9);
    for (const p of S.shore) {
      const x = p & 63, y = p >> 6;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
          const o = (Y * W + X) * 3, v = A * (dx || dy ? 0.35 * pulse : 0.5 + 0.5 * pulse);
          buf[o] += (255 - buf[o]) * v;
          buf[o + 1] += (255 - buf[o + 1]) * v;
          buf[o + 2] += (255 - buf[o + 2]) * v;
        }
    }
  }
  const f = S.fade;
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, buf[p] * f, buf[p + 1] * f, buf[p + 2] * f);
}
