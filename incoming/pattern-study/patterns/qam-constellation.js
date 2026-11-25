// ===== Patternflow pattern =====
// Title:   QAM Constellation
// Family:  constellation
// Idea:    The two constellation diagrams of a dual-polarization coherent receiver stand one above the other and are drawn the way a phosphor instrument draws them, every received symbol a soft dot that fades in a third of a second, so a clean channel is a square lattice of bright points and each fault has its own shape: noise swells the points into clouds, phase noise bends the outer ones into arcs, a lost carrier lock spins the square into rings, gain and quadrature errors squeeze and lean it, the fibre twists it, and crosstalk turns each point into a small copy of the other square's lattice, while the modulation steps between 4, 16 and 64 points on each polarization's own schedule.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: quadrature amplitude modulation and its square lattices (C. R. Cahn 1960 and the modem work of the 1960s, from memory), the constellation display of a vector signal analyser with its intensity-graded persistence, the impairments as a receiver engineer reads them off that display (additive noise as round clouds, laser phase noise as arcs, carrier frequency offset as rings, IQ gain imbalance as a rectangle, quadrature error as a rhombus, amplifier compression and Kerr phase as a pulled-in and twisted lattice, unevenly spaced modulator levels as rows and columns that bunch), polarization-multiplexed coherent optical receivers of the 2000s where each polarization leaks into the other, rate-adaptive transceivers that change the modulation order, all from memory; the two stacked squares, the colour scheme with warm errors, the slow wandering of every impairment, the drifting bit balance that lights one side of a square more than the other, and the event schedule are original, pattern round 246
// Round:   246
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Noise=0..4, Phase=-1..1, Crosstalk=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the upper square (X polarization) is cyan-teal, the lower (Y polarization) rose-violet, and symbols thrown far from their ideal point by a lost lock or a burst are amber. Each square's own hue also drifts a little by itself.
// Knob 2: Noise. 0 to 4, opening at 2: additive noise, in units of the lattice pitch, the way a link only runs a fine lattice on a clean channel. At 0 every point is a sharp disc, 3 LED across on 16 points and larger on 4. At 2 the points are clear round clouds with dark between them in every order. At 4 the clouds touch and a square of 4 or 16 points is nearly a filled haze, drawn a little smaller so its soft edge stays on its half.
// Knob 3: Phase. -1 to 1, opening at 0: laser phase noise and carrier offset. At -1 the loop is locked solid and the clouds are round. At 0 the outer points are short arcs and each square loses lock about every half minute. At 1 the arcs are long, the square shivers, and lock is lost every few seconds so the squares keep spinning into rings, amber while they turn fast.
// Knob 4: Crosstalk. -1 to 1, opening at 0.06: how much of each polarization leaks into the other. Below 0.2 almost nothing: a faint ghosting, and a transient now and then that the equalizer tracks back down. Above it every point grows into a small tilted copy of the other square's lattice, slowly turning, resolved into its own dots at 1, and both squares shade toward the hue between them. A square on 64 points falls back to 16 once the copies show.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, exp, sqrt, sin, cos, pow, PI } = Math;
const TAU = 2 * PI, QT = PI / 2;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

const PERSIST = 0.28;                 // seconds a symbol's light lasts (1/e)
const NSYM = 700;                     // symbols a frame for each polarization
const XC = 32, YC = [31.5, 96.5];     // centre of each square
const ROW0 = [0, 65], ROW1 = [62, 127];
// The lattice is three levels of plus-or-minus steps: QPSK uses the first, 16-QAM two, 64-QAM three.
const C1 = [15, 14.5, 12.8], C2 = [0, 7.25, 6.4], C3 = [0, 0, 3.2];
const HP = [15, 7.25, 3.2];          // half the pitch of each lattice. Noise, point size and blur follow the finest pitch on the square,
                                     // its own or that of the other lattice's copies: a link only runs a fine lattice on a clean channel
const PK = [3.6, 3, 1.8];              // how bright a clean point's centre is, in units of the tone curve's knee
const MM = [4, 16, 64];
const HDS = [12, 7.25, 3.2];           // half the distance to the next point: beyond it a symbol is an error
const A0 = 0.055, TP = 0.9;           // tone curve of the phosphor
const TLN = 2048, TLMAX = 9, TLUT = new Float32Array(TLN + 1);
for (let i = 0; i <= TLN; i++) TLUT[i] = 1 - exp(-pow((TLMAX * i * i) / (TLN * TLN) / A0, TP));

// slow wanderers, one set for each polarization: [seconds for X, seconds for Y]
const GA = 0, IB = 1, SK = 2, RT = 3, DX = 4, DY = 5, CP = 6, TW = 7, BR = 8, W1 = 9, NZ = 15, PN = 16, HU = 17, KF = 18, RI = 19, RS = 20, JT = 21, LV = 22, SL = 26;
const OUT = [[9, 13], [11, 7.5], [8.5, 12.5], [6.5, 10], [7, 9.5], [12, 5.5], [14, 10.5], [9.5, 15], [11, 15],
  [8, 12], [13, 7], [10, 16], [15, 9], [7.5, 11], [12.5, 17],
  [6, 8.5], [7.5, 5], [14, 19], [8, 11.5], [9, 6.5], [10.5, 14], [0.18, 0.14],
  [10, 7], [6.5, 12], [8.5, 14.5], [13.5, 9], [80, 110], [95, 65], [60, 90], [75, 100], [115, 70], [65, 85], [105, 125]];
const NOU = OUT.length;

function newPol(p) {
  const o = new Float32Array(NOU), s = new Float32Array(NOU);
  for (let j = 0; j < NOU; j++) o[j] = s[j] = (j < CP || j >= SL ? 0.6 : 1) * gauss();
  const m = p ? (rnd() < 0.5 ? 0 : 2) : 1;
  return {
    o, s, m, mt: m, tm: (p ? 16 : 9) + 14 * rnd(),
    c: [0, 0, 0], hp: 7.25, pk: 3, mm: 16, kv: 1.167, hd: 7.5, cnt: floor(rnd() * 4096),
    theta: 0, lock: 0, dth: 0, spinT: 0, spinDur: 1, spinW: 0, spinPh: 0, haz: 0, hazNext: 0.25 + 0.5 * rnd(),
    burst: 0, tb: 5 + 14 * rnd(), wt: new Float32Array(16), sig: 0,
  };
}

export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, seed: 1,
    pol: null, psi: 0, pso: 0, ktr: 0, ktau: 2, tk: 0,
    A: new Float32Array(N), E: new Float32Array(N), C: new Float32Array(N),
    T: new Float32Array(N), A2: new Float32Array(N), E2: new Float32Array(N), C2: new Float32Array(N), B3: new Float32Array(N),
    col: new Float32Array(12),
  });
  return st;
}

function hue3(h, s, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h);
  let r = i === 0 || i === 5 ? 1 : i === 1 ? 1 - f : i === 4 ? f : 0;
  let g = i === 1 || i === 2 ? 1 : i === 0 ? f : i === 3 ? 1 - f : 0;
  let b = i === 3 || i === 4 ? 1 : i === 2 ? f : i === 5 ? 1 - f : 0;
  r = 1 - s * (1 - r); g = 1 - s * (1 - g); b = 1 - s * (1 - b);
  const lift = cl(0.42 - (0.3 * r + 0.59 * g + 0.11 * b), 0, 0.3);
  out[o] = r + (1 - r) * lift;
  out[o + 1] = g + (1 - g) * lift;
  out[o + 2] = b + (1 - b) * lift;
}

function knobs(k) {
  const n = cl(k[1], 0, 4), u = cl((k[2] + 1) / 2, 0, 1), v = cl((k[3] + 1) / 2, 0, 1);
  return {
    hue: cl(k[0], 0, 1),
    sig: 0.3 * n + 0.125 * n * n,                       // LED, for 16-QAM
    sp: 0.2 * pow(u, 1.9),                             // radians of phase noise a symbol
    u,
    slipT: u < 0.04 ? 0 : 3.2 * pow(35 / 3.2, 2 * (1 - u)), // seconds between losses of lock
    kap: 0.04 * v * v + 0.18 * pow(cl((k[3] - 0.1) / 0.9, 0, 1), 1.6),   // almost nothing below 0.2
  };
}

function stepPol(st, P, Q, p, dt, kn) {
  const { o, s } = P, ks = 1 - exp(-dt / 0.7);
  for (let j = 0; j < NOU; j++) {
    const tau = OUT[j][p];
    o[j] += (-o[j] / tau) * dt + sqrt((2 * dt) / tau) * gauss();
    s[j] += (o[j] - s[j]) * (j === JT ? 1 : ks);
  }
  // modulation order
  P.tm -= dt;
  if (P.tm <= 0) {
    // never both polarizations on four points: the link keeps one of them carrying more
    const old = P.mt;
    P.mt = (old + 1 + floor(rnd() * 2)) % 3;
    if (P.mt === 0 && Q.mt === 0) P.mt = 3 - old;
    P.tm = P.mt ? 15 + 30 * rnd() : 15 + 9 * rnd();
  }
  // a link does not run 64 points through crosstalk: it falls back to 16
  if (kn.kap > 0.05 && P.mt === 2) P.mt = 1;
  P.m += cl(P.mt - P.m, -0.9 * dt, 0.9 * dt);
  const f = min(1, floor(P.m)), t = sstep(0, 1, P.m - f);
  P.c[0] = mix(C1[f], C1[f + 1], t);
  P.c[1] = mix(C2[f], C2[f + 1], t);
  P.c[2] = mix(C3[f], C3[f + 1], t);
  P.hp = mix(HP[f], HP[f + 1], t);
  P.pk = mix(PK[f], PK[f + 1], t);
  P.mm = mix(MM[f], MM[f + 1], t);
  P.hd = mix(HDS[f], HDS[f + 1], t);
  // carrier lock
  const th0 = P.theta;
  if (P.spinT > 0) {
    P.spinT -= dt;
    const q = 1 - max(0, P.spinT) / P.spinDur;
    const env = sstep(0, 0.3, q) * (1 - 0.65 * sstep(0.55, 1, q));
    P.theta += P.spinW * env * (1 + 0.45 * sin(TAU * 0.7 * q * P.spinDur + P.spinPh)) * dt;
    P.dth = P.theta - th0;
    if (P.spinT <= 0) {
      const w = round(P.theta / TAU) * TAU;
      P.theta -= w;
      P.lock = round(P.theta / QT) * QT;
    }
  } else {
    P.theta += (P.lock - P.theta) * (1 - exp(-dt / 0.07));
    P.dth = P.theta - th0;
    if (kn.slipT > 0) {
      P.haz += dt / kn.slipT;
      if (P.haz >= P.hazNext) {
        P.haz = 0;
        P.hazNext = 0.5 + rnd();
        P.spinDur = P.spinT = 1.3 + 1.3 * rnd();
        P.spinW = (rnd() < 0.5 ? -1 : 1) * (4 + 11 * rnd());
        P.spinPh = TAU * rnd();
      }
    }
  }
  // noise bursts
  P.burst *= exp(-dt / 0.45);
  P.tb -= dt;
  if (P.tb <= 0) {
    P.burst = 1.2 + 1.3 * rnd();
    P.tb = 9 + 20 * rnd();
  }
}

// add this frame's symbols of polarization p to the phosphor
function emit(st, p, dt, kn) {
  const P = st.pol[p], Q = st.pol[1 - p], s = P.s, { A, E, C } = st;
  const c1 = P.c[0], c2 = P.c[1], c3 = P.c[2], o1 = Q.c[0], o2 = Q.c[1], o3 = Q.c[2];
  const R2 = 2 * (c1 * c1 + c2 * c2 + c3 * c3), iR2 = 1 / R2;
  const kap = min(0.26, kn.kap * (exp(0.2 * cl(s[KF], -2, 2)) + st.ktr));
  const psi = p ? PI - st.psi : st.psi, kc = kap * cos(psi), kq = kap * sin(psi);
  // the finest half-pitch on this square: its own, or the copies' once crosstalk shows
  const wx = sstep(0.06, 0.16, kap), hE = P.hd + (min(P.hd, kap * Q.hp) - P.hd) * wx, hr = hE / 7.25, psc = min(1.3, pow(hr, 1.25));
  const jit = hE > 7.25 ? 0.8 + (hE - 7.25) * 0.337 : max(0, (hE - 3.2) * 0.2);   // the size of a clean point
  const KV = (P.kv = 0.667 + 0.5 * sstep(3.6, 6, hE));   // variance of a clean dot: the splat and two passes of blur, one pass on a fine lattice
  const sn = kn.sig * pow(hr, 1.25) * exp(0.25 * cl(s[NZ], -2, 2)) * (1 + P.burst), sig = sqrt(sn * sn + jit * jit);
  // how soft the square is drawn: by its noise, and by the other lattice's copies once noise has blurred them together
  P.sig = sqrt(sig * sig + pow(0.5 * kap * (o1 + o2 + o3) * min(1, sn / 0.7), 2));
  // a cloud that noise has filled in shows its shape more than its points: it is squeezed and leaned further
  const hz = 1 + 0.6 * sstep(1.5, 3, sig);
  const ib = hz * cl(0.08 * s[IB] + 0.07 * s[SL + 5], -0.2, 0.2), eps = hz * cl(0.09 * s[SK] + 0.07 * s[SL + 6], -0.22, 0.22), skS = sin(eps), skC = cos(eps);
  const ri = 0.07 * hz * cl(s[RI], -2, 2), rs = 0.07 * hz * cl(s[RS], -2, 2);
  const fine = min(1, P.hd / 7.25), cmp = 0.08 * fine * cl(s[CP] + 0.5, -1, 2), tw = 0.11 * fine * cl(s[TW], -2, 2);
  // the modulator's levels are not evenly spaced: each axis has its inner and outer levels pushed apart or to one side
  const lk = (c2 / 7.25) * (1 - c3 / 5), aI = lk * cl(s[LV], -1.8, 1.8), bI = lk * cl(s[LV + 1], -1.8, 1.8), aQ = lk * cl(s[LV + 2], -1.8, 1.8), bQ = lk * cl(s[LV + 3], -1.8, 1.8);
  const c2i = c2 + aI, c2q = c2 + aQ;
  const res = (0.07 + 0.06 * kn.u) * cl(s[RT], -2.2, 2.2);
  const jitA = 0.45 * kn.sp * psc * s[JT];
  const th = res + P.theta, dth = P.dth;
  const sp = kn.sp * psc * exp(0.3 * cl(s[PN], -2, 2));
  // the gain control holds the total power: under heavy noise and crosstalk the lattice itself is smaller
  const ext = c1 + c2 + c3, gfit = min(1, 25.5 / (ext + 0.85 * kap * (o1 + o2 + o3) + 2 * (sig - jit)));
  // a small lattice has room to wander
  const room = cl((29 - gfit * ext) / 7.25, 1, 1.7);
  const g0 = gfit * (1 + room * cl(0.1 * s[GA] + 0.07 * s[SL + 2], -0.21, 0.21)), dcm = max(0.5, 26.5 - g0 * ext * (1 + abs(ib) + abs(ri) + abs(rs) + 0.5 * abs(eps)));
  const cx = XC + cl(room * (1.8 * s[DX] + 1.7 * s[SL + 3]), -dcm, dcm), cy = YC[p] + cl(room * (1.8 * s[DY] + 1.7 * s[SL + 4]), -dcm, dcm), g = g0;
  // the data's bit balance drifts: halves, quadrants, inner and outer rows of the lattice carry unequal light
  const wt = P.wt, wa = 0.12 + 0.16 * sstep(1, 3, sig) + 0.02 * c3;
  for (let i = 0; i < 16; i++) {
    const a = i & 1 ? 1 : -1, b = i & 4 ? 1 : -1, a2 = i & 2 ? a : -a, b2 = i & 8 ? b : -b;
    const f = (j, v) => 1 + wa * cl(s[W1 + j], -2, 2) * v;
    wt[i] = f(0, a) * f(1, b) * f(2, a * b) * f(3, a2) * f(4, b2) * f(5, a2 * b2);
  }
  const spinning = P.spinT > 0, eOff = P.theta - P.lock;
  // errors show warm while something is wrong: lock lost or being pulled in, or a burst of noise
  // and less so where noise has buried the points already
  const alarm = (0.2 + 0.8 * (spinning ? 1 : cl(max(abs(eOff) * 4, P.burst * 0.9), 0, 1))) * (1 - 0.85 * sstep(1.4, 3, sig / (1 + P.burst)));
  const daMin = cl(abs(dth) * 30 * 0.07, 0.15, 0.6);
  const n = round(NSYM * dt * 30), ihd = 1 / P.hd;
  // the instrument scales its intensity to the densest spot: a point's own peak, or the mean of a filled square,
  // and lets a spread cloud be dimmer than a clean point
  const s0 = g * g * sig * sig + KV, s1 = s0 + g * g * kap * kap * (o1 * o1 + o2 * o2 + o3 * o3), tg = g * g * sp * sp * R2;
  const ar = sqrt(s1 * (s1 + tg)), ar0 = sqrt(s0 * (s0 + tg));
  const xt = g * ext + 1.2 * sqrt(s1), dpk = max(1 / (TAU * ar), 1 / (Q.mm * TAU * ar0), P.mm / (4 * xt * xt));
  const e0 = (P.pk * (1 - 0.45 * wx) * A0 * max(0.36, pow(KV / ar0, 0.33)) * (1 - exp(-dt / PERSIST)) * P.mm) / (dpk * max(1, n));
  const r0 = ROW0[p], r1 = ROW1[p];
  const wc = min(1, kap * 3.3);
  let z = st.seed, cnt = P.cnt;
  for (let k = 0; k < n; k++) {
    // which point, and which point of the other square: a sequence that visits all 4096 pairs evenly, so no point flickers
    cnt = (cnt + 1) | 0;
    const b = Math.imul(cnt, -1640531535) >>> 20;
    const sI = (b & 1 ? c1 : -c1) + (b & 2 ? c2i : -c2i) + (b & 4 ? c3 : -c3) + ((b & 3) === 1 || (b & 3) === 2 ? -bI : bI);
    const sQ = (b & 8 ? c1 : -c1) + (b & 16 ? c2q : -c2q) + (b & 32 ? c3 : -c3) + ((b & 24) === 8 || (b & 24) === 16 ? -bQ : bQ);
    const oI = (b & 64 ? o1 : -o1) + (b & 128 ? o2 : -o2) + (b & 256 ? o3 : -o3);
    const oQ = (b & 512 ? o1 : -o1) + (b & 1024 ? o2 : -o2) + (b & 2048 ? o3 : -o3);
    const wi = (b & 3) | ((b >> 1) & 12);
    z ^= z << 13; z ^= z >>> 17; z ^= z << 5;
    const sm = (z >>> 8) / 16777216;
    const rr = (sI * sI + sQ * sQ) * iR2 - 1;
    // transmitter: compression, gain imbalance, quadrature error
    const cf = 1 - cmp * rr;
    let qv = sQ * cf * (1 - ib), iv = sI * cf * (1 + ib) + qv * skS;
    qv *= skC;
    // the other polarization leaks in
    const xI = kc * oI - kq * oQ, xQ = kq * oI + kc * oQ;
    iv += xI; qv += xQ;
    // phase: residual, Kerr twist, the loop's jitter, this symbol's own phase noise, and the turn made during this frame
    z ^= z << 13; z ^= z >>> 17; z ^= z << 5;
    const dp = sp * (((z & 255) + ((z >>> 8) & 255) + ((z >>> 16) & 255) + (z >>> 24) - 510) / 147.8) + jitA - dth * sm;
    const ang = th + tw * rr + dp, cs = cos(ang), sn = sin(ang);
    z ^= z << 13; z ^= z >>> 17; z ^= z << 5;
    const nI = sig * (((z & 255) + ((z >>> 8) & 255) + ((z >>> 16) & 255) + (z >>> 24) - 510) / 147.8);
    z ^= z << 13; z ^= z >>> 17; z ^= z << 5;
    const nQ = sig * (((z & 255) + ((z >>> 8) & 255) + ((z >>> 16) & 255) + (z >>> 24) - 510) / 147.8);
    const uI = iv * cs - qv * sn + nI, uQ = iv * sn + qv * cs + nQ;
    const rI = uI * (1 + ri) + uQ * rs, rQ = uQ * (1 - ri) + uI * rs;
    // how far from its ideal point, in half-spacings
    let da = dp + eOff;
    if (spinning && abs(da) < daMin) da = daMin;
    const d = sqrt(nI * nI + nQ * nQ + (sI * sI + sQ * sQ) * min(da * da, 2)) * ihd;
    const we = alarm * (d < 0.5 ? 0 : d > 1.15 ? 1 : (d - 0.5) / 0.65);
    const en = e0 * wt[wi] * (1 + 0.5 * we);
    const fx = cx + g * rI - 0.5, fy = cy - g * rQ - 0.5;
    const x0 = floor(fx), y0 = floor(fy), ax = fx - x0, ay = fy - y0;
    for (let j = 0; j < 2; j++) {
      const y = y0 + j;
      if (y < r0 || y > r1) continue;
      const wy = (j ? ay : 1 - ay) * en;
      for (let i = 0; i < 2; i++) {
        const x = x0 + i;
        if (x < 0 || x >= W) continue;
        const w = (i ? ax : 1 - ax) * wy, q = y * W + x;
        A[q] += w; E[q] += w * we; C[q] += w * wc;
      }
    }
  }
  st.seed = z;
  P.cnt = cnt;
}

function step(st, dt) {
  const kn = knobs(st.k);
  st.t += dt;
  for (let p = 0; p < 2; p++) stepPol(st, st.pol[p], st.pol[1 - p], p, dt, kn);
  // the crosstalk's angle turns slowly; a polarization transient jumps it and the equalizer tracks it back
  st.pso += (-st.pso / 6) * dt + sqrt((2 * dt) / 6) * gauss();
  st.psi += (0.28 + 0.2 * st.pso) * dt;
  if (st.psi > TAU) st.psi -= TAU;
  st.ktr *= exp(-dt / st.ktau);
  st.tk -= dt;
  if (st.tk <= 0) {
    st.ktr = 0.8 + 1 * rnd();
    st.ktau = 1.2 + 1.8 * rnd();
    st.psi += TAU * rnd();
    st.tk = 14 + 26 * rnd();
  }
  const dec = exp(-dt / PERSIST), { A, E, C } = st;
  for (let i = 0; i < N; i++) { A[i] *= dec; E[i] *= dec; C[i] *= dec; }
  for (let p = 0; p < 2; p++) emit(st, p, dt, kn);
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || st.k;
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  if (!st.init) {
    st.init = true;
    st.seed = (floor(rnd() * 4294967295) | 1) >>> 0;
    st.pol = [newPol(0), newPol(1)];
    st.psi = TAU * rnd();
    st.tk = 10 + 14 * rnd();
    for (let i = 0; i < 30; i++) step(st, 1 / 30);
  }
  dt = cl(dt || 0, 0, 0.1);
  if (dt > 0) step(st, dt);
}

function blur(src, tmp, dst) {
  for (let y = 0; y < H; y++) {
    const r = y * W;
    tmp[r] = (2 * src[r] + src[r + 1]) * 0.25;
    for (let x = 1; x < W - 1; x++) tmp[r + x] = (src[r + x - 1] + 2 * src[r + x] + src[r + x + 1]) * 0.25;
    tmp[r + W - 1] = (2 * src[r + W - 1] + src[r + W - 2]) * 0.25;
  }
  for (let i = 0; i < N; i++) {
    const up = i >= W ? tmp[i - W] : 0, dn = i < N - W ? tmp[i + W] : 0;
    dst[i] = (up + 2 * tmp[i] + dn) * 0.25;
  }
}

export function draw(display, params) {
  if (!params.st) setup(params);
  const st = params.st;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const kn = knobs(st.k), col = st.col, { A2, E2, C2 } = st;
  const hd = (P) => cl(0.04 * P.s[HU] + 0.05 * P.s[SL], -0.1, 0.1);
  hue3(0.49 + kn.hue + hd(st.pol[0]), 0.92, col, 0);
  hue3(0.87 + kn.hue + hd(st.pol[1]), 0.9, col, 3);
  hue3(0.105 + kn.hue, 0.85, col, 6);
  hue3(0.68 + kn.hue, 0.9, col, 9);
  // a noisy square is drawn softer, so its cloud is a haze and not a scatter of single LEDs
  const w0 = sstep(1.7, 3.2, st.pol[0].sig), w1 = sstep(1.7, 3.2, st.pol[1].sig), B3 = st.B3;
  const u0 = max(w0, (st.pol[0].kv - 0.667) * 2), u1 = max(w1, (st.pol[1].kv - 0.667) * 2), HN = 64 * W;
  for (const [src, dst] of [[st.A, A2], [st.E, E2], [st.C, C2]]) {
    blur(src, st.T, dst);
    blur(dst, st.T, B3);
    for (let i = 0; i < N; i++) dst[i] += (B3[i] - dst[i]) * (i < HN ? u0 : u1);
    if (w0 < 0.01 && w1 < 0.01) continue;
    blur(dst, st.T, B3);
    blur(B3, st.T, B3);
    for (let i = 0; i < N; i++) dst[i] += (B3[i] - dst[i]) * (i < HN ? w0 : w1);
  }
  const wr = col[6], wg = col[7], wb = col[8];
  for (let y = 0; y < H; y++) {
    const m = y < 64 ? 0 : 3, ps = st.pol[m ? 1 : 0].s, bv = 255 * cl(0.82 + 0.06 * ps[BR] + 0.07 * ps[SL + 1], 0.62, 1);
    const mr = col[m], mg = col[m + 1], mb = col[m + 2];
    const dr = (col[9] - mr) * 0.6, dg = (col[10] - mg) * 0.6, db = (col[11] - mb) * 0.6;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, a = A2[i];
      if (a < 2e-5) { display.setPixel(x, y, 0, 0, 0); continue; }
      const t = a >= TLMAX ? 1 : TLUT[(sqrt(a / TLMAX) * TLN + 0.5) | 0];
      const ea = E2[i], te = ea >= TLMAX ? 1 : TLUT[(sqrt(ea / TLMAX) * TLN + 0.5) | 0];
      const e = min(1, ea / a) * sstep(0.2, 0.6, te), c = min(1, C2[i] / a);
      let r = mr + dr * c, g = mg + dg * c, b = mb + db * c;
      r += (wr - r) * e; g += (wg - g) * e; b += (wb - b) * e;
      const hot = 0.8 * sstep(0.7, 1, t), v = bv * t;
      display.setPixel(x, y, round(v * (r + (1 - r) * hot)), round(v * (g + (1 - g) * hot)), round(v * (b + (1 - b) * hot)));
    }
  }
}
