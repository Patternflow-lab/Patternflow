// ===== Patternflow pattern =====
// Title:   Void and Cluster
// Family:  noise
// Idea:    Clumpy white noise rearranges itself into blue noise as Ulichney's void-and-cluster method moves the dot at the tightest cluster into the largest void, again and again, until the move would put it back; then the settled dots are ranked one by one into a dither array and a threshold falls and rises through the ranks, so the dots leave and return in rank order, coloured by rank.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: blue noise (Robert Ulichney, 1988), the void-and-cluster method for dither arrays (Robert Ulichney, 1993), pattern round 62
// Round:   62
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Density=-1..1, Sigma=1.5..4
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the settling dots are azure, the crowded ones pink and pale, a dot a swap has just put down flashes white, and the ranked dots run from a pale azure at rank 0 through violet to pink at the top of the cycle; at 0.5 the dots are orange-red and the ranks run through yellow to green. The voids glow lavender to violet whatever the knob, as a dim warm glow reads brown.
// Knob 2: Speed. At 2 the white noise stands still for 0.5 s, the swaps start at 36 a second and reach 243 a second, 0.16 of the 1516 dots, 0.8 s later, and the pattern settles after 431 to 464 swaps at 2.6 s; the threshold then falls to 0.45 of the settled count, rises to 1.45 and comes back in 6.3 s, and fresh white noise falls at 8.9 s. At 0.2 everything is ten times slower, settling at 26 s; at 3 it settles at 1.8 s.
// Knob 3: Density. The share of LEDs lit in the settled pattern, 0.185 x 1.7^K: 891 dots at -1, 1516 at the opening 0, 2576 at 1, where the top of the cycle stops at 0.45 of the panel. A new value scatters fresh white noise.
// Knob 4: Sigma. The width in LEDs of the Gaussian that measures clusters and voids. It opens at Ulichney's 1.5, where every threshold of the dither array keeps 7 to 9 percent of white noise's power below half the principal frequency sqrt(g); at 2.5 the settled dots keep 37 percent and at 4 83 percent, as the filter grows too wide to see the dots' own spacing: the swaps stop after 187 instead of 448 and the small clumps stay. A new value scatters fresh white noise.
// Buttons: K1 tap scatters fresh white noise.

const W = 64, H = 128, N = W * H;
const { floor, exp, ceil, min, max, round, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The rank cycle after the dots settle, in seconds at Speed 2: hold, fall to
// LO of the settled count, rise to HI, fall back, hold.
const HOLD0 = 0.4, FALL = 1.4, RISE = 2.8, BACK = 1.2, HOLD1 = 0.5;
const LO = 0.45, HI = 1.45;
// Swaps a second at Speed 2, as a share of the dots.
const RATE = 0.16;
const STILL = 0.5, RAMP = 0.8, FLASH = 0.45, GHOST = 0.35;

export function setup(params) {
  params.s = {
    B: new Uint8Array(N), E: new Float64Array(N), ones: new Int32Array(N), at: new Int32Array(N), n: 0,
    B2: new Uint8Array(N), E2: new Float64Array(N),
    rank: new Int32Array(N), top: 0, np: 0,
    flash: new Float32Array(N), ghost: new Float32Array(N),
    K: null, R: 0, KW: 0, Ks: 0, sigma: 0, rho: 0,
    mode: 0, t: 0, budget: 0, swaps: 0, thr: 0, dir: 0,
    hue: 0, c: [0, 0, 0], fresh: true,
  };
}

function kernel(S, sigma) {
  S.sigma = sigma;
  S.R = min(15, ceil(3 * sigma));
  S.KW = 2 * S.R + 1;
  S.K = new Float64Array(S.KW * S.KW);
  S.Ks = 0;
  for (let dy = -S.R; dy <= S.R; dy++)
    for (let dx = -S.R; dx <= S.R; dx++) {
      const v = exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      S.K[(dy + S.R) * S.KW + dx + S.R] = v;
      S.Ks += v;
    }
}

// Add (s = 1) or take away (s = -1) one dot's Gaussian from the energy E,
// on the torus 64 x 128 the panel wraps into.
function splat(S, E, p, s) {
  const x = p & 63, y = p >> 6, R = S.R, KW = S.KW, K = S.K;
  for (let dy = -R; dy <= R; dy++) {
    const row = (((y + dy) % H) + H) % H * W, k = (dy + R) * KW + R;
    for (let dx = -R; dx <= R; dx++) E[row + ((x + dx) & 63)] += s * K[k + dx];
  }
}

function addOne(S, p) {
  S.B[p] = 1;
  S.at[p] = S.n;
  S.ones[S.n++] = p;
  splat(S, S.E, p, 1);
}
function removeOne(S, p) {
  S.B[p] = 0;
  const i = S.at[p], last = S.ones[--S.n];
  S.ones[i] = last;
  S.at[last] = i;
  splat(S, S.E, p, -1);
}

// White noise: exactly rho N dots, every LED as likely as every other.
function scatter(S) {
  S.B.fill(0);
  S.E.fill(0);
  S.n = 0;
  const want = round(S.rho * N);
  const idx = new Int32Array(N);
  for (let i = 0; i < N; i++) idx[i] = i;
  for (let i = 0; i < want; i++) {
    const j = i + floor(random() * (N - i)), t = idx[i];
    idx[i] = idx[j];
    idx[j] = t;
    addOne(S, idx[i]);
  }
  S.rank.fill(-1);
  S.flash.fill(0);
  S.ghost.fill(0);
  S.mode = 0;
  S.t = 0;
  S.budget = 0;
  S.swaps = 0;
}

const tightest = (S) => {
  let c = -1, m = -1;
  for (let i = 0; i < S.n; i++) {
    const p = S.ones[i];
    if (S.E[p] > m) {
      m = S.E[p];
      c = p;
    }
  }
  return c;
};
const largestVoid = (B, E) => {
  let v = -1, m = 1e30;
  for (let p = 0; p < N; p++)
    if (!B[p] && E[p] < m) {
      m = E[p];
      v = p;
    }
  return v;
};

// One swap of the initial pattern. Returns false once the dot taken from
// the tightest cluster would go straight back into the largest void.
function swap(S) {
  const c = tightest(S);
  removeOne(S, c);
  const v = largestVoid(S.B, S.E);
  if (v === c) {
    addOne(S, c);
    return false;
  }
  addOne(S, v);
  S.flash[v] = 1;
  S.ghost[c] = 1;
  S.swaps++;
  return true;
}

// The settled pattern is the prototype. Phase 1 takes its dots away, tightest
// cluster first, ranking them from np - 1 down to 0; phase 2 starts again
// from the prototype and fills the largest void, ranking from np up.
function rankPrototype(S) {
  S.np = S.n;
  S.B2.set(S.B);
  S.E2.set(S.E);
  for (let r = S.n - 1; r >= 0; r--) {
    const c = tightest(S);
    S.rank[c] = r;
    removeOne(S, c);
  }
  S.top = S.np;
}
function rankUpTo(S, n) {
  while (S.top < n) {
    const v = largestVoid(S.B2, S.E2);
    S.rank[v] = S.top++;
    S.B2[v] = 1;
    splat(S, S.E2, v, 1);
  }
}

const ease = (u) => u * u * (3 - 2 * u);
function threshold(S, t) {
  const np = S.np;
  if (t < HOLD0) return np;
  t -= HOLD0;
  if (t < FALL) return np + (LO - 1) * np * ease(t / FALL);
  t -= FALL;
  if (t < RISE) return LO * np + (HI - LO) * np * ease(t / RISE);
  t -= RISE;
  if (t < BACK) return HI * np + (1 - HI) * np * ease(t / BACK);
  return np;
}
const CYCLE = HOLD0 + FALL + RISE + BACK + HOLD1;

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  const speed = cl(k[1], 0.2, 3), tau = (d * speed) / 2;
  const rho = 0.185 * Math.pow(1.7, cl(k[2], -1, 1)), sigma = cl(k[3], 1.5, 4);
  const press = input.btnPressed && input.btnPressed[0];
  if (S.fresh || press || Math.abs(rho - S.rho) > 0.004 || Math.abs(sigma - S.sigma) > 0.05) {
    S.fresh = false;
    S.rho = rho;
    kernel(S, sigma);
    scatter(S);
  }
  for (let p = 0; p < N; p++) {
    if (S.flash[p] > 0) S.flash[p] = max(0, S.flash[p] - tau / FLASH);
    if (S.ghost[p] > 0) S.ghost[p] = max(0, S.ghost[p] - tau / GHOST);
  }
  S.t += tau;
  if (S.mode === 0) {
    // The white noise stands still for STILL, then the swaps start slowly,
    // one at a time to the eye, and reach RATE in RAMP more.
    if (S.t > STILL) S.budget += tau * RATE * S.n * min(1, 0.15 + (S.t - STILL) / RAMP);
    while (S.budget >= 1) {
      S.budget -= 1;
      if (!swap(S)) {
        rankPrototype(S);
        S.mode = 1;
        S.t = 0;
        break;
      }
    }
  } else {
    if (S.t >= CYCLE) {
      scatter(S);
      return;
    }
    const thr = min(0.45 * N, threshold(S, S.t));
    S.dir = thr > S.thr + 1e-9 ? 1 : thr < S.thr - 1e-9 ? -1 : 0;
    S.thr = thr;
    rankUpTo(S, ceil(S.thr) + 1);
  }
}

// A dot of the pattern being settled: the azure of the opening hue, going
// pink and pale the more crowded it is against white noise of the same
// density, and white for an instant where a swap has just put it.
function dotColour(S, E, p, h0, out) {
  const z = (E[p] - 1) / (S.rho * (S.Ks - 1)), w = cl((z - 1.05) / 0.8, 0, 1), f = S.flash[p];
  hsv(h0 + 0.43 * w, (0.8 - 0.4 * w) * (1 - f), 1, out);
}
// A ranked dot: from the opening azure at rank 0 down the wheel through
// green to yellow at the top of the cycle.
function rankColour(S, r, h0, sat, out) {
  const u = r / (HI * S.np);
  hsv(h0 + 0.38 * u, (0.25 + 0.6 * u) * sat, 1, out);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const c = S.c, c2 = [0, 0, 0], h0 = S.hue + 0.55;
  const put = (p, r, g, b) => display.setPixel(p & 63, p >> 6, round(r * 255), round(g * 255), round(b * 255));
  if (S.mode === 0) {
    const mean = S.rho * S.Ks, vh = 0.74 + 0.12 * (S.hue - floor(S.hue));
    for (let p = 0; p < N; p++) {
      if (S.B[p]) dotColour(S, S.E, p, h0, c);
      else if (S.ghost[p] > 0) hsv(h0 + 0.43, 0.5, 0.6 * S.ghost[p], c);
      else {
        // The voids glow where the energy falls below half its mean, in a
        // cool hue whatever the knob, since a dim warm one reads brown.
        const g = cl(1 - S.E[p] / (0.5 * mean), 0, 1);
        hsv(vh, 0.4, 0.5 * g, c);
      }
      put(p, c[0], c[1], c[2]);
    }
    return;
  }
  const thr = S.thr, mix = cl(S.t / HOLD0, 0, 1);
  for (let p = 0; p < N; p++) {
    const r = S.rank[p];
    if (r < 0 || r >= thr + 1) {
      display.setPixel(p & 63, p >> 6, 0, 0, 0);
      continue;
    }
    // The dots within 2% of the ranks below the threshold are arriving, white
    // as they come, or leaving, fading as they go.
    const a = cl((thr - r) / (0.02 * S.np), 0, 1);
    rankColour(S, r, h0, S.dir > 0 ? a : 1, c);
    if (mix < 1 && r < S.np) {
      dotColour(S, S.E2, p, h0, c2);
      for (let i = 0; i < 3; i++) c[i] = c2[i] + (c[i] - c2[i]) * mix;
    }
    const v = S.dir < 0 ? 0.25 + 0.75 * a : 1;
    put(p, c[0] * v, c[1] * v, c[2] * v);
  }
}
