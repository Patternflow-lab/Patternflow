// ===== Patternflow pattern =====
// Title:   Bernoulli Convolutions
// Family:  fractal
// Idea:    Each of the 128 rows is the distribution of the random sum ±1 ±λ ±λ² ±… for its own λ, spread across the panel over the sum's whole range, from Cantor dust at λ = 0.32 at the top through a flat row near 1/2 to a smooth bell at 0.89 at the bottom; the sum is built up a term at a time, each term splitting every point of a row in two, and on the 14 rows where λ is the reciprocal of a Pisot number, the golden ratio's 0.618 among them, the splits keep landing on points already there, so those rows burn white-gold, brighter with every term, and brightest at the plastic number's 0.755 where each point holds 36 sign choices on average after 13 terms.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Bernoulli convolutions (Børge Jessen and Aurel Wintner, 1935; Paul Erdős, 1939; Boris Solomyak, 1995), pattern round 38
// Round:   38
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Bias=0.5..0.95, Zoom=0..1
//
// Knob 1: Hue. Turns the rows round the wheel; the Pisot seams stay white-gold, and go nearly white when the rows are warm. At 0 thin parts of a row are violet and thick parts azure; at 0.25 rose and orchid, at 0.5 butter and peach, at 0.75 teal and green. Orange and yellow are lifted and paled so they do not go brown or olive.
// Knob 2: Speed. At 2 a new term comes in every second, each split taking the first two thirds of it: the climb from 6 terms to 13 takes 7 seconds, the 13-term picture holds 2.5, and the terms are taken away again three a second. At 0.2 all of it ten times slower, at 3 one and a half times faster. The pattern opens on the 13-term picture held for 1.2 seconds at any speed.
// Knob 3: Bias. The chance that a sign is plus. At 0.5 a fair coin and every row symmetric; at 0.7 the mass leans right and the bells slide toward the right edge; at 0.95 the bottom bells are narrow bright lumps against the right edge and the dust at the top is a few hot points. The short white ticks at both edges mark λ = p^p (1-p)^(1-p): every row above them is singular, because the signs carry too little entropy to fill the interval. They sit at λ = 0.5 for a fair coin and move down to 0.82 at 0.95.
// Knob 4: Zoom. The range of λ down the rows. At 0 from 0.30 to 0.90, with 14 Pisot seams between rows 46 and 96; at 1 from 0.56 to 0.78, where 11 of them spread over the whole panel and the rows between are 0.0017 apart.
// Buttons: K1 tap takes the terms away down to none, one point in the middle of every row, and builds the sum up again from its first term.

const W = 64, H = 128, M = 512, F = M / W;
// Terms: the cycle falls to NLO and climbs to NHI; stages 0..NHI are kept.
const NLO = 6, NHI = 13;
// Seconds at Speed 2: hold at NHI, per term falling, rest at NLO, per term
// climbing. The first hold, the picture the pattern opens on, lasts OPEN
// seconds at any speed.
const HOLD = 2.5, TF = 0.33, REST = 0.6, TC = 1.0, OPEN = 1.2;
// Opening hue: violet and azure, not red.
const H0 = 0.62;
// Pisot numbers in (1, 2), each the largest root of its polynomial (highest
// power first). Their reciprocals are the lambdas where Erdos (1939) showed
// the measure singular: the sums land on each other again and again.
const PISOT = [
  [1, 0, -1, -1], // 1.3247, the plastic number
  [1, -1, 0, 0, -1], // 1.3803
  [1, -1, -1, 1, 0, -1], // 1.4433
  [1, -1, 0, -1], // 1.4656
  [1, -1, -1, 0, 1, 0, -1], // 1.5016
  [1, 0, -1, -1, -1, -1], // 1.5342
  [1, -1, -1, 0, 0, 1, 0, -1], // 1.5452
  [1, -1, 0, -1, 0, -1], // 1.5701
  [1, -1, -1], // 1.6180, the golden ratio
  [1, -1, -1, 0, 0, -1], // 1.7049
  [1, -2, 1, -1], // 1.7549
  [1, -1, -1, -1], // 1.8393, the tribonacci constant
  [1, -2, 0, 1, -1], // 1.8668
  [1, -1, -1, -1, -1], // 1.9276
];
const { floor, min, abs, exp, log2, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = [v, q, p, p, t, v][i];
  out[o + 1] = [t, v, v, q, p, p][i];
  out[o + 2] = [p, p, t, v, v, q][i];
}

// Newton from 2 down to the largest real root.
function rootOf(c) {
  let x = 2;
  for (let it = 0; it < 60; it++) {
    let f = 0, d = 0;
    for (let k = 0; k < c.length; k++) {
      d = d * x + f;
      f = f * x + c[k];
    }
    x -= f / d;
  }
  return x;
}
const LAMP = PISOT.map((c) => 1 / rootOf(c));

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, bias: 0.5, zoom: 0.06, built: false, bBias: -1, bZoom: -1, since: 0,
    lam: new Float64Array(H), pis: new Int8Array(H).fill(-1),
    h: new Float64Array(M), h2: new Float64Array(M + 1),
    // Per stage, row and column: the mass of the row in the column, and
    // the log2 of how many sign choices share a point there on average.
    I: new Float32Array((NHI + 1) * H * W), G: new Float32Array((NHI + 1) * H * W),
    phase: 0, pt: 0, lo: NLO, x: NHI, open: OPEN,
    lut: new Float32Array(256 * 3), row: new Float32Array(W), gold: [1, 0.86, 0.56],
  };
}

// The lambdas of the rows, the nearest row to each Pisot reciprocal moved
// onto it exactly. Every other row's lambda is a binary fraction, and for
// those no two sign choices ever give the same sum: the highest power that
// differs leaves an odd numerator no lower power can cancel.
function rows(S) {
  const lo = 0.3 + 0.26 * S.zoom, hi = 0.9 - 0.12 * S.zoom, dl = (hi - lo) / (H - 1);
  S.lo0 = lo;
  S.hi0 = hi;
  S.pis.fill(-1);
  for (let r = 0; r < H; r++) S.lam[r] = lo + dl * r;
  LAMP.forEach((l, k) => {
    const r = round((l - lo) / dl);
    if (r >= 0 && r < H && abs(S.lam[r] - l) <= dl / 2 + 1e-12) {
      S.lam[r] = l;
      S.pis[r] = k;
    }
  });
}

// Every stage of every row. The fine histogram (M bins over the row's
// range, u = x (1 - lambda) in [-1, 1]) starts as a point at 0 and is
// pushed through nu -> p S+ nu + (1 - p) S- nu, S+- u = lambda u +- (1 - lambda),
// once per term. On a Pisot row the sums are also kept exactly, as sorted
// points with their mass, and points closer than 1e-9 are one point.
function build(S) {
  rows(S);
  const p = S.bias, q = 1 - p, { h, h2, I, G } = S, c0 = M / 2 - 0.5;
  G.fill(0);
  for (let r = 0; r < H; r++) {
    const lam = S.lam[r], sh = (1 - lam) * (M / 2);
    h.fill(0);
    h[M / 2 - 1] = 0.5;
    h[M / 2] = 0.5;
    for (let n = 0; n <= NHI; n++) {
      const o = (n * H + r) * W;
      for (let c = 0; c < W; c++) {
        let m = 0;
        for (let i = c * F; i < c * F + F; i++) m += h[i];
        I[o + c] = m;
      }
      if (n === NHI) break;
      h2.fill(0);
      for (let i = 0; i < M; i++) {
        const v = h[i];
        if (v === 0) continue;
        const base = c0 + lam * (i - c0);
        for (let sgn = 0; sgn < 2; sgn++) {
          const f = base + (sgn ? sh : -sh), w = v * (sgn ? p : q), j = floor(f), fr = f - j;
          if (j >= 0 && j < M) h2[j] += w * (1 - fr);
          if (j + 1 >= 0 && j + 1 < M) h2[j + 1] += w * fr;
        }
      }
      for (let i = 0; i < M; i++) h[i] = h2[i];
    }
    if (S.pis[r] >= 0) exact(S, r, p);
  }
  S.built = true;
  S.bBias = S.bias;
  S.bZoom = S.zoom;
  S.since = 0;
}

// The exact sums on a Pisot row, term by term in the order they shrink:
// each point x splits into x + lambda^n (mass p) and x - lambda^n (mass 1 - p).
// m is a point's mass; w the sum of its sign choices' squared masses, so
// m^2 / w is how many choices it holds, weighted, and 1 when it holds one.
function exact(S, r, p) {
  const lam = S.lam[r], q = 1 - p, G = S.G, k1 = 1 - lam;
  let X = new Float64Array([0]), Mm = new Float64Array([1]), Q = new Float64Array([1]);
  const sm2 = new Float64Array(W), sq = new Float64Array(W);
  for (let n = 1; n <= NHI; n++) {
    const a = lam ** (n - 1), L = X.length;
    const X2 = new Float64Array(2 * L), M2 = new Float64Array(2 * L), Q2 = new Float64Array(2 * L);
    let i = 0, j = 0, k = -1;
    while (i < L || j < L) {
      // Merge the two shifted copies, both already sorted.
      let x, m, w;
      if (j >= L || (i < L && X[i] - a <= X[j] + a)) {
        x = X[i] - a;
        m = Mm[i] * q;
        w = Q[i] * q * q;
        i++;
      } else {
        x = X[j] + a;
        m = Mm[j] * p;
        w = Q[j] * p * p;
        j++;
      }
      if (k >= 0 && x - X2[k] < 1e-9) {
        M2[k] += m;
        Q2[k] += w;
      } else {
        k++;
        X2[k] = x;
        M2[k] = m;
        Q2[k] = w;
      }
    }
    X = X2.subarray(0, k + 1);
    Mm = M2.subarray(0, k + 1);
    Q = Q2.subarray(0, k + 1);
    sm2.fill(0);
    sq.fill(0);
    for (let t = 0; t <= k; t++) {
      const c = cl(floor((X[t] * k1 + 1) * (W / 2)), 0, W - 1);
      sm2[c] += Mm[t] * Mm[t];
      sq[c] += Q[t];
    }
    const o = (n * H + r) * W;
    for (let c = 0; c < W; c++) G[o + c] = sq[c] > 0 ? log2(sm2[c] / sq[c]) : 0;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.5, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.bias = cl(k[2], 0.5, 0.95);
  S.zoom = cl(k[3], 0, 1);
  S.since += d;
  // Rebuilding takes a few milliseconds: at most ten times a second while a knob turns.
  if (!S.built || ((abs(S.bias - S.bBias) > 1e-4 || abs(S.zoom - S.bZoom) > 1e-4) && S.since > 0.1)) build(S);
  if (input.btnPressed && input.btnPressed[0]) {
    S.lo = 0;
    if (S.phase !== 1) {
      S.phase = 1;
      S.pt = (NHI - S.x) * TF;
    }
  }
  // The term count x runs hold, fall, rest, climb.
  if (S.open > 0) {
    // The opening hold, in plain seconds; it ends straight into the fall.
    S.open -= d;
    if (S.open <= 0) S.pt = HOLD;
  } else S.pt += (d * S.speed) / 2;
  const span = NHI - S.lo;
  if (S.phase === 0 && S.pt >= HOLD) {
    S.phase = 1;
    S.pt -= HOLD;
  }
  if (S.phase === 1 && S.pt >= span * TF) {
    S.phase = 2;
    S.pt -= span * TF;
  }
  if (S.phase === 2 && S.pt >= REST) {
    S.phase = 3;
    S.pt -= REST;
  }
  if (S.phase === 3 && S.pt >= span * TC) {
    S.phase = 0;
    S.pt -= span * TC;
    S.lo = NLO;
  }
  if (S.phase === 0) S.x = NHI;
  else if (S.phase === 1) {
    const u = S.pt / TF, j = floor(u);
    S.x = NHI - j - sm(0, 1, u - j);
  } else if (S.phase === 2) S.x = S.lo;
  else {
    const u = S.pt / TC, j = floor(u);
    S.x = S.lo + j + sm(0, 0.65, u - j);
  }
  S.x = cl(S.x, 0, NHI);
}

// Density levels: violet where a row is thin, azure where it is thick. A
// hue that comes round to orange or yellow is paled and lifted, so thin
// parts read peach or butter and not brown or olive.
function palette(S) {
  const lut = S.lut;
  for (let i = 0; i < 256; i++) {
    const L = i / 255, h = S.hue + H0 + 0.16 * (1 - L) - 0.06, hh = h - floor(h);
    const warm = cl(1 - abs(hh - 0.13) / 0.13, 0, 1);
    hsv(h, 0.9 - 0.45 * L - 0.3 * warm, min(1, 0.92 * L ** (0.7 - 0.2 * warm) * (1 + 0.35 * warm)), lut, i * 3);
  }
  // The seams: white-gold, nearly white where the rows themselves are warm.
  const hh = S.hue + H0 - 0.06 - floor(S.hue + H0 - 0.06), warm = cl(1 - abs(hh - 0.13) / 0.2, 0, 1);
  S.gold[0] = 1;
  S.gold[1] = 0.86 + 0.12 * warm;
  S.gold[2] = 0.56 + 0.36 * warm;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.built) return;
  palette(S);
  const { I, G, lut, row } = S, p = S.bias, q = 1 - p;
  const n = min(NHI - 1, floor(S.x)), s = S.x - n;
  // The new term splits every point by +- (1 - lambda) lambda^n of the range,
  // and in the last third of the split the exact next stage takes over.
  const wNext = sm(0.55, 1, s);
  const gold = S.gold;
  // The entropy bound p^p (1 - p)^(1 - p), as a row.
  const lstar = p ** p * q ** q, rstar = round(((lstar - S.lo0) / (S.hi0 - S.lo0)) * (H - 1));
  for (let r = 0; r < H; r++) {
    const lam = S.lam[r], dsh = s * (1 - lam) * lam ** n * (W / 2);
    const o0 = (n * H + r) * W, o1 = o0 + H * W;
    for (let c = 0; c < W; c++) {
      // p of the row moved right by dsh, 1 - p moved left.
      const a = c - dsh, b = c + dsh, ia = floor(a), ib = floor(b), fa = a - ia, fb = b - ib;
      const va = (ia >= 0 && ia < W ? I[o0 + ia] * (1 - fa) : 0) + (ia + 1 >= 0 && ia + 1 < W ? I[o0 + ia + 1] * fa : 0);
      const vb = (ib >= 0 && ib < W ? I[o0 + ib] * (1 - fb) : 0) + (ib + 1 >= 0 && ib + 1 < W ? I[o0 + ib + 1] * fb : 0);
      row[c] = (p * va + q * vb) * (1 - wNext) + I[o1 + c] * wNext;
    }
    const seam = S.pis[r] >= 0;
    for (let c = 0; c < W; c++) {
      // 64 times the mass is 1 where the row is flat; 1 - e^(-rho / 1.2)
      // keeps thin rows readable and the dust and the bells from burning out.
      const L = 1 - exp((-W * row[c]) / 1.2), li = round(L * 255) * 3;
      let R = lut[li], Gc = lut[li + 1], B = lut[li + 2];
      if (seam) {
        const g = G[o0 + c] * (1 - s) + G[o1 + c] * s, k = sm(0.2, 5.5, g) * (0.35 + 0.65 * sm(0, 0.5, L));
        R += (gold[0] - R) * k;
        Gc += (gold[1] - Gc) * k;
        B += (gold[2] - B) * k;
      }
      if (r === rstar && (c < 2 || c > W - 3)) R = Gc = B = 0.85;
      display.setPixel(c, r, round(255 * min(1, R)), round(255 * min(1, Gc)), round(255 * min(1, B)));
    }
  }
}
