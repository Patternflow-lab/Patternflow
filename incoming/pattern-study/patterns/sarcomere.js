// ===== Patternflow pattern =====
// Title:   Sarcomere
// Family:  sarcomere
// Idea:    Striated muscle under two stains: myofibrils run up the panel as chains of green blocks parted by magenta lines, and where a wave of contraction passes the dark spaces close, the pale middle of each block fills in and the stripes crowd together and pull the rest of the fibre toward them.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the sliding filament account of striated muscle, in which the A band keeps its length while the I band and the H zone shorten (A. F. Huxley and Niedergerke 1954, H. E. Huxley and Hanson 1954, from memory); the length-tension relation of a single sarcomere (Gordon, Huxley and Julian 1966, from memory); calcium waves that travel along a muscle cell and a twitch that takes the whole fibre at once (from memory); two-colour fluorescence micrographs with myosin in one channel and the Z disc in the other. Original here: lengths in LED instead of micrometres, waves slowed until an eye can follow them, a floor under the shortest sarcomere, a slow tone that keeps parts of the fibre a little shortened, fibrils that slide against each other and bend, the stain unevenness that travels with the tissue, the colours and the drawing, pattern round 246
// Round:   248
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.5..4, Stretch=-1..1, Slip=-1..1
//
// Knob 1: Hue. Turns both stains round the wheel together. It opens with green A bands and magenta Z discs on black.
// Knob 2: Pace. 0.5 to 4, opening at 2: how often a wave of contraction starts and how fast it travels along the fibre. At 0.5 a wave comes every 4 s or so and crawls. At 4 there is nearly always one on the panel. The tissue creeps along the fibre at its own speed whatever this says.
// Knob 3: Stretch. -1 to 1, opening at 0: the rest length of a sarcomere, 8.6 to 18 LED. At -1 the blocks nearly touch and a wave has little left to close. At 1 the dark I bands are nearly 6 LED wide, each block is pale from end to end, and a wave lights its two ends.
// Knob 4: Slip. -1 to 1, opening at 0.06: how far neighbouring fibrils fall out of register and out of step. At -1 the stripes run straight across the panel and a wave is a level band. At 0 neighbours sit up to a quarter of a sarcomere apart and a wave crosses as a chevron. At 1 they sit up to half apart, like bricks, the chevron is three times steeper and each fibril also fires short waves of its own.

const W = 64, H = 128;
const { floor, ceil, min, max, sqrt, exp, sin, cos, pow, abs, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (t) => {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
};

const NF = 7;                 // fibrils laid across; the outer two hang off the panel so that a bend never bares an edge
const SREST = 12.5, SPAN = 1.45; // rest length at Stretch 0, and the factor one end of the knob changes it by
const ABAND = 6.5, THIN = 4.6;   // the thick filaments, and the thin ones from each Z disc, LED
const SHORT = 0.36;           // the share of its length a fully active sarcomere gives up
const ZS = 2 * 0.8 * 0.8;     // twice the variance of a Z line, LED^2
const GAP = 1.1;              // half the dark gap between two resting fibrils
const NZ = 44, ZC = 22;       // Z discs kept for a fibril, and the index of the one at the anchor
const POFF = [31.3, 43.7, 53.9, 61.1, 73.3, 83.9, 97.3]; // seconds: each fibril slides against the others on its own period
const PDEP = [47.9, 29.3, 71.3, 37.9, 59.3, 33.1, 89.7]; // and rises and sinks through the plane of focus on another

function hsh(i, s) {
  let h = Math.imul(i | 0, 0x9e3779b1) ^ Math.imul(s | 0, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
// smooth noise along the fibre, -1 to 1: it is a function of the sarcomere index, so it travels with the tissue
function vn(x, s) {
  const i = floor(x), f = x - i, a = hsh(i, s);
  return 2 * (a + (hsh(i + 1, s) - a) * f * f * (3 - 2 * f)) - 1;
}
// the same in two directions, 0 to 1: along the fibre and through time
function vn2(x, y, s) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const n = ix + iy * 7919, a = hsh(n, s), b = hsh(n + 1, s), c = hsh(n + 7919, s), d = hsh(n + 7920, s);
  return a + (b - a) * ux + (c - a + (a - b + d - c) * ux) * uy;
}
// three random streams, started from Math.random once: the waves, each fibril's own waves, the twitches
function rnd(st, n) {
  const a = (st.sd[n] = (st.sd[n] + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function setup(params) {
  const f = (n) => new Float32Array(n);
  const st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, sd: [1, 2, 3], ph: [], hs: 1,
    u0: 0, waves: [], tw: [], nextW: 0, nextO: 0, nextT: 0,
    fo: f(NF), bx: f(NF + 1),
    z: f(NZ + 1), zs: f(NZ), za: f(NZ), zr: f(NZ),
    G: f(NF * H), M: f(NF * H), U: f(NF * H), HG: f(NF * H), xb: f(NF + 1),
    A: f(W * H), B: f(W * H),
  };
  params.st = st;
  return st;
}

// what one wave or twitch does at a place, s seconds after it arrives: up in about 0.12 s, down in about 0.5 s
function kick(s, td) {
  return 1.3 * (1 - exp(-s / 0.04)) * exp(-s / td);
}

function knobs(st) {
  const k = st.k, sl = cl(k[3], -1, 1);
  st.pace = cl(k[1], 0.5, 4);
  st.S0 = SREST * pow(SPAN, cl(k[2], -1, 1));
  st.sl = sl;
  st.sa = 0.5 * (sl + 1);                                    // 0 in register, 1 bricks
  st.side = 0.08 * (sl < 0 ? 1 + sl : 1 + 2 * sl);           // seconds a wave takes to reach the next fibril
  st.td = 0.42 / pow(st.pace, 0.3);
}

// ---- one step: the creep, and which waves are on their way -------------------
function step(st, dt) {
  const p = st.ph;
  st.t += dt;
  const t = st.t, pace = st.pace;
  // the specimen creeps along the fibre, 0.8 to 1.6 LED a second, always the same way, whatever the knobs say
  const v = 1.2 + 0.25 * sin((TAU * t) / 23.7 + p[0]) + 0.15 * sin((TAU * t) / 41.3 + p[1]);
  st.u0 += (v * dt) / st.S0;
  const reach = 64 / st.S0 + 6;
  while (t >= st.nextW) {
    const R = () => rnd(st, 0);
    st.waves.push({ t0: st.nextW, k0: st.u0 + (2 * R() - 1) * reach, j0: floor(R() * NF), v: 5.5 * pow(pace, 0.6) * (0.8 + 0.4 * R()), amp: 0.75 + 0.35 * R(), rng: 5 + 22 * R() * R(), jr: R(), own: false });
    st.nextW += (cl(-log(1 - R()), 0.2, 2.6) * 2.2) / pace;
  }
  while (t >= st.nextO) {
    const R = () => rnd(st, 1);
    const w = { t0: st.nextO, k0: st.u0 + (2 * R() - 1) * (reach - 4), j0: floor(R() * NF), v: 4 * pow(pace, 0.6) * (0.7 + 0.6 * R()), amp: 0.6 + 0.4 * R(), rng: 2.5 + 5 * R(), jr: 0, own: true };
    if (st.sl > 0.02) st.waves.push(w);
    st.nextO += (cl(-log(1 - R()), 0.2, 2.6) * 0.75) / (pace * max(0.15, st.sl));
  }
  while (t >= st.nextT) {
    st.tw.push({ t0: st.nextT, amp: 0.8 + 0.3 * rnd(st, 2) });
    st.nextT += 9 + 16 * rnd(st, 2);
  }
  for (let i = st.waves.length - 1; i >= 0; i--) {
    const w = st.waves[i];
    if (t - w.t0 > w.rng / w.v + NF * 0.24 + 3) st.waves.splice(i, 1);
  }
  while (st.tw.length && t - st.tw[0].t0 > 4.5) st.tw.shift();
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  knobs(st);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 3; i++) st.sd[i] = floor(Math.random() * 4294967296) | 0;
    st.hs = floor(Math.random() * 1e6) | 0;
    for (let i = 0; i < 24; i++) st.ph.push(TAU * Math.random());
    // fibril widths, and how far each sits from its neighbours along the fibre when they are out of register
    let x = 0;
    for (let j = 0; j <= NF; j++) {
      st.bx[j] = x;
      x += 9.4 + 3.4 * Math.random();
    }
    const sc = 77 / st.bx[NF];
    for (let j = 0; j <= NF; j++) st.bx[j] = st.bx[j] * sc - 6.5;
    for (let j = 0; j < NF; j++) st.fo[j] = (j & 1 ? 1 : -1) * (0.45 + 0.55 * Math.random());
    st.u0 = 200 + 600 * Math.random();
    // a few seconds before the first frame, so that waves are already under way
    st.t = -6;
    st.nextW = -6;
    st.nextO = -6;
    st.nextT = -6 + 5 + 14 * rnd(st, 2);
    while (st.t < -0.04) step(st, 0.04);
  }
  step(st, cl(dt || 0, 0, 0.1));
}

// ---- one fibril: where its Z discs are, and what each row of it shows -------
function fibril(st, j) {
  const t = st.t, p = st.ph, sa = st.sa, side = st.side, td = st.td, S0 = st.S0, hs = st.hs;
  const { z, zs, za, zr } = st;
  // how far this fibril sits from register, half a sarcomere at the most: it leans to its own side, and slides about that
  const uj = st.u0 + 0.5 * sa * cl(0.3 * st.fo[j] + 0.45 * sin((TAU * t) / POFF[j] + p[8 + j]) + 0.75 * vn(t / 12.7 + 31 * j, hs + 9), -1, 1);
  const kc = floor(uj), fr = uj - kc;
  const twd = side * 2 * hsh(j, hs + 5);
  const psi = (TAU * t) / 47.3 + 2.4 * sin((TAU * t) / 31.9 + p[4]) + 0.7 * sin((TAU * t) / 17.9 + p[5]);
  const one = (i) => {
    const k = kc + i - ZC;
    // a slow tone holds stretches of the fibre partly shortened for some seconds, here and then somewhere else
    let a = 0.5 * sm((vn2(k / 6.3 + 0.9 * j * sa + 0.021 * t, t / 9.7 + 0.37 * j * sa, hs + 7) - 0.45) / 0.32);
    // and one band of it is always somewhere on the panel, wandering along the fibre at a walking pace
    a += 0.8 * sm((cos((TAU * (k - st.u0)) / 8.5 - psi + 0.5 * sa * (j - 3)) - 0.2) / 0.6);
    for (const w of st.waves) {
      const dj = abs(j - w.j0), dk = abs(k + 0.5 - w.k0);
      if (dk > w.rng || (w.own && dj > 0)) continue;
      const s = t - w.t0 - dk / w.v - dj * side;
      if (s <= 0 || s > 4) continue;
      // in register a wave takes every fibril; out of register it dies out a few fibrils from where it began
      const jr = w.own ? 0.5 : 1.5 + 6 * w.jr * (1 - max(0, st.sl)) + 12 * max(0, -st.sl);
      a += w.amp * cl(jr - dj + 0.5, 0, 1) * cl((w.rng - dk) / 3, 0, 1) * kick(s, td);
    }
    for (const w of st.tw) {
      const s = t - w.t0 - twd;
      if (s > 0) a += w.amp * kick(s, td);
    }
    a = a > 1 ? 1 : a;
    // the rest length itself is uneven along the fibre
    const rest = S0 * (1 + 0.05 * vn(k / 27.1, hs + 1) + 0.05 * vn(k / 9.7, hs + 2) + 0.035 * sa * vn(k / 8.3, hs + 20 + j));
    const raw = rest * (1 - SHORT * a);
    // thick filaments cannot be pushed through a Z disc: below 7.5 LED a sarcomere gives way less and less
    zs[i] = raw < 7.5 ? 6 + 1.5 * exp((raw - 7.5) / 1.5) : raw;
    za[i] = a;
    zr[i] = rest;
  };
  // from the anchor at mid panel outward, both ways, until the panel is covered
  one(ZC);
  z[ZC] = 64 - fr * zs[ZC];
  let lo = ZC, hi = ZC;
  while (z[lo] > -3 && lo > 0) {
    lo--;
    one(lo);
    z[lo] = z[lo + 1] - zs[lo];
  }
  z[hi + 1] = z[hi] + zs[hi];
  while (z[hi + 1] < H + 3 && hi < NZ - 1) {
    hi++;
    one(hi);
    z[hi + 1] = z[hi] + zs[hi];
  }
  const { G, M, U, HG } = st, o0 = j * H;
  let i = lo;
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5;
    while (i < hi && z[i + 1] <= yc) i++;
    const S = zs[i], a = za[i], e = yc - z[i];
    const d = e < S - e ? e : S - e, c = abs(e - 0.5 * S), u = kc + i - ZC + e / S;
    const hz = S - 2 * THIN;
    // the two stains took unevenly, each its own way
    const sg = 1 + 0.24 * vn(u / 3.7, hs + 40 + j) + 0.17 * vn(u / 11.9, hs + 60 + j);
    const sz = 1 + 0.2 * vn(u / 5.3, hs + 80 + j);
    const zl = exp((-d * d) / ZS);
    // a living specimen does not lie flat: each fibril drifts a little out of focus and back, and is dimmer there
    const dp = 0.81 + 0.19 * sin(TAU * (yc / (150 + 13 * j) - t / PDEP[j]) + p[16 + j]);
    M[o0 + y] = zl * sz * dp;
    G[o0 + y] = sm(ABAND / 2 - c + 0.5) * (1 - 0.33 * sm(hz / 2 - c + 0.5) * cl(hz / 1.2, 0, 1)) * (1 + 0.16 * a) * sg * dp * (1 - 0.8 * zl);
    U[o0 + y] = u;
    // a shortened sarcomere is fatter, and closes the gap beside it
    HG[o0 + y] = max(0.1, GAP - 3.6 * (sqrt(zr[i] / S) - 1));
  }
}

function tint(h, o, n) {
  for (let i = 0; i < 3; i++) o[n + i] = 255 * cl(0.5 + 0.75 * cos(TAU * (h - i / 3)), 0.03, 1);
}

// ---- drawing ----------------------------------------------------------------
export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const { G, M, U, HG, xb, A, B } = st, t = st.t, p = st.ph, hs = st.hs;
  for (let j = 0; j < NF; j++) fibril(st, j);
  A.fill(0);
  B.fill(0);
  for (let y = 0; y < H; y++) {
    // the whole bundle bends slowly
    const sw = 2.2 * sin(TAU * (y / 230 + t / 67.9) + p[6]) + 1.4 * sin(TAU * (y / 140 - t / 26.9) + p[7]);
    for (let b = 0; b <= NF; b++) xb[b] = st.bx[b] + sw + 1.5 * vn(U[min(b, NF - 1) * H + y] / 6.1, hs + 100 + b);
    for (let j = 0; j < NF; j++) {
      const o = j * H + y, L = xb[j] + HG[o], R = xb[j + 1] - HG[o];
      const xc = 0.5 * (L + R), hw = 0.5 * (R - L), g = G[o], m = M[o];
      const x0 = max(0, floor(L - 0.5)), x1 = min(W - 1, ceil(R - 0.5));
      for (let x = x0; x <= x1; x++) {
        const r = abs(x + 0.5 - xc), cv = cl(hw - r + 0.5, 0, 1);
        if (cv <= 0) continue;
        // a cylinder: brighter along its middle
        const q = r < hw ? r / hw : 1, pr = cv * (0.5 + 0.5 * sqrt(1 - q * q));
        A[y * W + x] += g * pr;
        B[y * W + x] += m * pr;
      }
    }
  }
  const c = st.col || (st.col = new Float32Array(6));
  tint(0.36 + st.k[0], c, 0);
  tint(0.86 + st.k[0], c, 3);
  for (let o = 0; o < W * H; o++) {
    const a = 0.8 * A[o], b = 0.92 * B[o];
    const r = a * c[0] + b * c[3], g = a * c[1] + b * c[4], bl = a * c[2] + b * c[5];
    display.setPixel(o % W, (o / W) | 0, r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, bl > 255 ? 255 : bl | 0);
  }
}
