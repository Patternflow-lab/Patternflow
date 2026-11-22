// ===== Patternflow pattern =====
// Title:   Conus Pigment
// Family:  conus
// Idea:    The panel is the growing lip of a cone shell laid out as a record: 64 cells along the lip form a ring, one row of pigment is laid per moment and the older rows slide up the panel, and the glazed triangles, tents and oblique stripes that come out are the space-time diagram of an activator-inhibitor equation with a depleting substrate.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the activator-inhibitor idea (Alfred Gierer and Hans Meinhardt, 1972) applied to the pigment cells along the growing edge of a mollusc shell, whose finished pattern is the history of the pattern on the edge (Hans Meinhardt, The Algorithmic Beauty of Sea Shells, 1995, with Meinhardt and Klingler, 1987); pattern round 221
// Round:   221
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Growth=0..4, Regime=-2..1, Seeds=-1..1
//
// Knob 1: Hue. Turns the glaze round the wheel; at 0 the ground is deep indigo-umber, the pigment amber with a cream core and a dark umber rim.
// Knob 2: Growth. How many rows of shell the lip lays down each second, 3 at 0, 6.6 at the opening 2 and 24 at 4; the model takes the same steps per row at every speed, so the shapes stay the same and only the scroll changes.
// Knob 3: Regime. Walks the equation through the real shell regimes: -2 stable stripes along the growth direction, -1 the same stripes leaning, 0 where it opens, tents and triangles born at random and run to collision, 1 an irregular crowd of small triangles.
// Knob 4: Seeds. How often the lip seeds a new colony of pigment at a random cell, 4 times rarer at -1 and 4 times more often at 1.

const W = 64, H = 128;
const N = 64; // cells along the lip, the ring: cell 63 neighbours cell 0
const { floor, sqrt, abs, exp, sin, cos, PI, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the model
// a  activator:    da/dt = rho s a^2 / ((1 + kap a^2) h) - a + Da a_xx + b0
// h  inhibitor:    dh/dt = nu (h0 + hk a - h) + Dh h_xx
// s  substrate:    ds/dt = sig (1 - s) - gam s a
// Each regime is one column of PARAM; Regime -2 .. 1 walks across them.
const SUBS = 20, DT = 0.02; // 20 steps of 0.02 time units make one laid row
const HIST = H + 4;
const PRE_ROWS = 150;
const KEYS = ['rho', 'kap', 'Da', 'b0', 'h0', 'Dh', 'nu', 'hk', 'sig', 'gam', 'drift', 'rate', 'amp', 'aref'];
const PARAM = [
  // stripes
  [1.0, 0.05, 0.35, 0.02, 0.05, 15, 1.5, 1.0, 0.3, 0.0, 0.0, 0.25, 0.5, 2.5],
  // leaning stripes
  [1.0, 0.05, 0.35, 0.02, 0.05, 15, 1.5, 1.0, 0.3, 0.0, 2.0, 0.25, 0.5, 2.5],
  // tents
  [6.0, 0.2, 1.0, 0.01, 1.5, 0.0, 0.4, 1.0, 0.15, 0.25, 0.0, 0.3, 2.2, 2.5],
  // crowd
  [6.0, 0.2, 1.0, 0.01, 1.0, 0.0, 0.5, 1.0, 0.2, 0.4, 0.0, 1.5, 2.2, 2.5],
];

function paramsAt(q, out) {
  const x = cl(q, 0, 1) * 3, k = min(2, floor(x)), u = x - k;
  for (let i = 0; i < KEYS.length; i++) out[KEYS[i]] = PARAM[k][i] + (PARAM[k + 1][i] - PARAM[k][i]) * u;
  return out;
}

function makeState() {
  return {
    ready: false,
    a: new Float32Array(N), h: new Float32Array(N), s: new Float32Array(N),
    na: new Float32Array(N), nh: new Float32Array(N), ns: new Float32Array(N),
    ha: new Float32Array(HIST * N), hh: new Float32Array(HIST * N), hs: new Float32Array(HIST * N),
    head: 0, // index of the newest laid row in the history
    sub: 0, acc: 0, quiet: 0, sites: [],
    P: {}, kn: [0, 2, 0, 0.06],
    hueMat: new Float32Array(9), hueAt: -1,
  };
}

function seedState(S, P) {
  for (let i = 0; i < N; i++) {
    S.a[i] = P.b0 + 0.05 * Math.random();
    S.h[i] = max(0.05, P.h0 + P.hk * S.a[i]);
    S.s[i] = 1;
  }
}

function substep(S, P) {
  const { a, h, s, na, nh, ns } = S;
  const rho = P.rho, kap = P.kap, Da = P.Da, b0 = P.b0, h0 = P.h0, Dh = P.Dh, nu = P.nu, hk = P.hk, sig = P.sig, gam = P.gam;
  for (let i = 0; i < N; i++) {
    const l = i === 0 ? N - 1 : i - 1, r = i === N - 1 ? 0 : i + 1;
    const ai = a[i], hi = h[i], si = s[i];
    const act = (rho * si * ai * ai) / ((1 + kap * ai * ai) * hi);
    let v = ai + DT * (act - ai + Da * (a[l] + a[r] - 2 * ai) + b0);
    na[i] = v < 1e-4 ? 1e-4 : v > 20 ? 20 : v;
    v = hi + DT * (nu * (h0 + hk * ai - hi) + Dh * (h[l] + h[r] - 2 * hi));
    nh[i] = v < 0.03 ? 0.03 : v;
    v = si + DT * (sig * (1 - si) - gam * si * ai);
    ns[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  S.a = na; S.h = nh; S.s = ns; S.na = a; S.nh = h; S.ns = s;
  if (P.drift !== 0) {
    // the whole medium slides along the lip, which leans every stripe
    const f = abs(P.drift) * DT, dir = P.drift > 0 ? -1 : 1;
    for (const [src, dst] of [[S.a, S.na], [S.h, S.nh], [S.s, S.ns]]) {
      for (let i = 0; i < N; i++) {
        const j = (i + dir + N) % N;
        dst[i] = src[i] * (1 - f) + src[j] * f;
      }
    }
    const ta = S.a, th = S.h, ts = S.s;
    S.a = S.na; S.h = S.nh; S.s = S.ns; S.na = ta; S.nh = th; S.ns = ts;
  }
}

function seeds(S, P, mult) {
  // each step has a small chance of a colony starting at a cell; one time in three it is
  // a cell that seeded lately, which puts a second chevron inside the first
  if (Math.random() < P.rate * mult * DT) {
    const a = S.a, big = P.amp > 1, sites = S.sites;
    let c = floor(Math.random() * N);
    if (sites.length > 0 && Math.random() < 0.35) c = (sites[floor(Math.random() * sites.length)] + N + floor(Math.random() * 3) - 1) % N;
    sites.push(c);
    if (sites.length > 4) sites.shift();
    if (big) {
      a[(c + N - 1) % N] += P.amp;
      a[c] += P.amp;
      a[(c + 1) % N] += P.amp;
    } else {
      a[c] += P.amp;
    }
  }
}

function pushRow(S) {
  S.head = (S.head + 1) % HIST;
  const o = S.head * N;
  S.ha.set(S.a, o);
  S.hh.set(S.h, o);
  S.hs.set(S.s, o);
}

function advanceSteps(S, P, mult, steps) {
  for (let t = 0; t < steps; t++) {
    seeds(S, P, mult);
    substep(S, P);
    if (++S.sub === SUBS) {
      S.sub = 0;
      pushRow(S);
      // the lip never stays blank: if nothing has lit for a while, a seed goes in
      let m = 0;
      for (let i = 0; i < N; i++) if (S.a[i] > m) m = S.a[i];
      if (m > 0.4 * P.aref) S.quiet = 0;
      else if (++S.quiet > 45) {
        S.quiet = 0;
        const c = floor(Math.random() * N);
        for (let q = -1; q <= 1; q++) S.a[(c + q + N) % N] += 2.5;
      }
    }
  }
}

export function setup(params) {
  params.s = makeState();
}

const rowRate = (k2) => 3 * Math.pow(2, 3 * Math.pow(cl(k2, 0, 4) / 4, 1.4));

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  const P = paramsAt((cl(kn[2], -2, 1) + 2) / 3, S.P), mult = Math.pow(4, cl(kn[3], -1, 1));
  if (!S.ready) {
    S.ready = true;
    seedState(S, P);
    advanceSteps(S, P, mult, PRE_ROWS * SUBS);
  }
  S.acc += d * rowRate(kn[1]) * SUBS;
  const steps = floor(S.acc);
  S.acc -= steps;
  advanceSteps(S, P, mult, steps);
}

// ---- colour
function hueMatrix(S, hue) {
  if (S.hueAt === hue) return;
  const A = 2 * PI * hue, c = cos(A), s = sin(A), m = S.hueMat;
  m[0] = 0.213 + c * 0.787 - s * 0.213; m[1] = 0.715 - c * 0.715 - s * 0.715; m[2] = 0.072 - c * 0.072 + s * 0.928;
  m[3] = 0.213 - c * 0.213 + s * 0.143; m[4] = 0.715 + c * 0.285 + s * 0.14; m[5] = 0.072 - c * 0.072 - s * 0.283;
  m[6] = 0.213 - c * 0.213 - s * 0.787; m[7] = 0.715 - c * 0.715 + s * 0.715; m[8] = 0.072 + c * 0.928 + s * 0.072;
  S.hueAt = hue;
}

const GROUND = [34, 20, 50], RIM = [90, 34, 24], AMBER = [236, 150, 38], CREAM = [255, 232, 186], TEAL = [26, 96, 110];

function rowAt(S, age, ph, outA, outH) {
  // age in rows from the lip: 0 is the live state, ph is the newest laid row
  if (age <= ph) {
    const f = ph > 0 ? age / ph : 0, o = S.head * N;
    for (let i = 0; i < N; i++) {
      outA[i] = S.a[i] + (S.ha[o + i] - S.a[i]) * f;
      outH[i] = S.h[i] + (S.hh[o + i] - S.h[i]) * f;
    }
    return;
  }
  const k = age - ph, k0 = floor(k), f = k - k0;
  const r0 = ((S.head - k0) % HIST + HIST) % HIST, r1 = ((S.head - k0 - 1) % HIST + HIST) % HIST;
  const o0 = r0 * N, o1 = r1 * N;
  for (let i = 0; i < N; i++) {
    outA[i] = S.ha[o0 + i] + (S.ha[o1 + i] - S.ha[o0 + i]) * f;
    outH[i] = S.hh[o0 + i] + (S.hh[o1 + i] - S.hh[o0 + i]) * f;
  }
}

const rowA = new Float32Array(N), rowH = new Float32Array(N);

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const hue = cl(S.kn[0], 0, 1);
  hueMatrix(S, hue);
  const m = S.hueMat, P = S.P, aref = P.aref;
  const ph = (S.sub + S.acc) / SUBS;
  const t = S.tt = (S.tt || 0) + 1 / 30;
  for (let y = 0; y < H; y++) {
    rowAt(S, H - 1 - y, ph, rowA, rowH);
    for (let x = 0; x < W; x++) {
      const a = rowA[x] / aref, hh = rowH[x] / aref;
      const u = sm(0.12, 0.5, a);
      let r = GROUND[0], g = GROUND[1], b = GROUND[2];
      const halo = sm(0.2, 0.9, hh) * (1 - u);
      r += (TEAL[0] - r) * halo * 0.5; g += (TEAL[1] - g) * halo * 0.5; b += (TEAL[2] - b) * halo * 0.5;
      const rim = sm(0.0, 0.35, u) * (1 - sm(0.35, 0.7, u));
      r += (RIM[0] - r) * rim; g += (RIM[1] - g) * rim; b += (RIM[2] - b) * rim;
      const body = sm(0.3, 0.75, u);
      r += (AMBER[0] - r) * body; g += (AMBER[1] - g) * body; b += (AMBER[2] - b) * body;
      const core = sm(0.75, 1.0, a);
      r += (CREAM[0] - r) * core; g += (CREAM[1] - g) * core; b += (CREAM[2] - b) * core;
      const R = r * m[0] + g * m[1] + b * m[2], G = r * m[3] + g * m[4] + b * m[5], B = r * m[6] + g * m[7] + b * m[8];
      display.setPixel(x, y, cl(R, 0, 255) | 0, cl(G, 0, 255) | 0, cl(B, 0, 255) | 0);
    }
  }
}
