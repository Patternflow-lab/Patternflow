// ===== Patternflow pattern =====
// Title:   Steiner Chain
// Family:  geometry
// Idea:    A ring of circles each touching its two neighbours and the two circles that hold it turns in the top square, rigid and equal, while the bottom square shows the same ring inverted in a point outside it, the circles swelling as they pass the wide side and shrinking through the narrow one, each in its own colour in both squares and every touch lit, so wherever the chain starts it always closes.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Steiner's porism (Jakob Steiner, 1826), shown through circle inversion, pattern round 39
// Round:   39
// ===============================
// @matrix 64x128
// @knobs Circles=6..12, Speed=0.2..3, Turns=1..4, Offset=0..1
//
// Knob 1: Circles. How many circles the chain holds, 6 to 12, each in its own colour, hues spaced evenly round the wheel. At 6 the inner circle is a third of the outer one across and the chain circles are 10 LEDs in radius in the top square; at 12 the inner circle is 0.59 of the outer and the circles are beads 6.2 LEDs in radius.
// Knob 2: Speed. At 2 the chain turns once in 30 seconds, and a fresh start lays it circle by circle in 1.5 seconds; at 0.2 all of it ten times slower, at 3 one and a half times faster.
// Knob 3: Turns. How many times the chain winds round before it closes, 1 to 4, at most (Circles - 1) / 2. Neighbours then stand 360 times Turns over Circles degrees apart, sin(180 Turns / Circles) = (1 - inner) / (1 + inner) fixes the inner circle, and the circles overlap in a rosette round it: 7 circles at 2 turns leave it 0.12 of the outer one across, at 3 turns 0.013. Where Turns and Circles share a factor the circles fall into that many chains, each closed: 6 circles at 2 turns are two chains of 3.
// Knob 4: Offset. How near the chain the point of the inversion sits, and with it how far off-centre the inner circle of the bottom square stands: 12 LEDs above the centre at the start, where a circle passing the wide side at the bottom is 3.4 times as wide as one passing the narrow side; 3 times at 0, and 24 times at 1, where the inner circle stands 25 LEDs up, nearly touching the outer one, and the circles squeezing past it are beads 2 LEDs across.
// Buttons: K1 tap lays the chain again from where it stands, one circle at a time, and the last one closes the gap with a flash.

const W = 64, H = 128;
const { floor, min, max, sqrt, sin, cos, exp, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Each square's centre and the outer circle's radius, in LEDs; pixel centres at x + 0.5.
const CX = 32, CY = [32, 96], RPX = 30.4;
// The inversion point lies on this ray from the centre of the concentric
// picture, above it. A point near the inversion point images far away, so
// the wide side of the bottom square is at the bottom.
const PSI = -PI / 2;
// Seconds per turn of the chain at Speed 2, and to lay it.
const TURN = 30, LAY = 1.5;
// Opening hue of circle 0.
const H0 = 0.55;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

export function setup(params) {
  params.s = {
    n: 6, m: 1, q: 3.4, phi: 0, lay: 0, flash: [], begun: false,
    // Per square: circles as x, y, r (the outer, the inner, then the chain in
    // the order it is laid); the touches as x, y, and which two circles meet.
    C: [new Float64Array(3 * 14), new Float64Array(3 * 14)],
    T: [new Float64Array(2 * 40), new Float64Array(2 * 40)], nt: 0, tri: [],
    A: new Float32Array(3 * W * H), col: [0, 0, 0], fil: [0, 0, 0],
  };
}

// The inversion point's distance a > 1 from the centre, in units of the
// outer radius, at which a chain circle passing the near side images q times
// as wide as one passing the far side: the gaps between the two circles on
// the line through the point image to (1 - rho) / ((a - 1)(a - rho)) and
// (1 - rho) / ((a + 1)(a + rho)), and their ratio is q.
function dist(q, rho) {
  const A = q - 1, B = (q + 1) * (1 + rho), C = (q - 1) * rho;
  return (B + sqrt(B * B - 4 * A * C)) / (2 * A);
}

// The chain at start angle phi: circle i of sub-chain j, step k, centred on
// the ring at angle phi + 2 pi (k m + j) / n. Square 0 is the concentric
// picture; square 1 its image in the unit circle about the point a, scaled
// so the outer circle's image is RPX across and centred.
function geometry(S) {
  const { n, m } = S, s = sin((PI * m) / n), rho = (1 - s) / (1 + s), r = (1 - rho) / 2, d = (1 + rho) / 2;
  const g = gcd(n, m), len = n / g, a = dist(S.q, rho), ax = a * cos(PSI), ay = a * sin(PSI);
  const inv = (x, y) => {
    const u = x - ax, v = y - ay, k = 1 / (u * u + v * v);
    return [ax + u * k, ay + v * k];
  };
  const invC = (x, y, rr) => {
    const u = x - ax, v = y - ay, D = u * u + v * v - rr * rr;
    return [ax + u / D, ay + v / D, rr / Math.abs(D)];
  };
  // Model circles: 0 the outer, 1 the inner, then the chain.
  const M = [[0, 0, 1], [0, 0, rho]];
  for (let j = 0; j < g; j++)
    for (let k = 0; k < len; k++) {
      const t = S.phi + (TAU * (k * m + j)) / n;
      M.push([d * cos(t), d * sin(t), r]);
    }
  const O = invC(0, 0, 1), sc = RPX / O[2];
  const C0 = S.C[0], C1 = S.C[1];
  for (let i = 0; i < M.length; i++) {
    const [x, y, rr] = M[i], [X, Y, R] = invC(x, y, rr);
    C0[3 * i] = CX + RPX * x;
    C0[3 * i + 1] = CY[0] + RPX * y;
    C0[3 * i + 2] = RPX * rr;
    C1[3 * i] = CX + sc * (X - O[0]);
    C1[3 * i + 1] = CY[1] + sc * (Y - O[1]);
    C1[3 * i + 2] = sc * R;
  }
  // The touches: each circle with the outer and the inner, and each with
  // the next in its sub-chain, the last with the first.
  let nt = 0;
  const T0 = S.T[0], T1 = S.T[1], tri = [];
  const put = (x, y, a, b) => {
    const [X, Y] = inv(x, y);
    T0[2 * nt] = CX + RPX * x;
    T0[2 * nt + 1] = CY[0] + RPX * y;
    T1[2 * nt] = CX + sc * (X - O[0]);
    T1[2 * nt + 1] = CY[1] + sc * (Y - O[1]);
    tri.push([a, b]);
    nt++;
  };
  for (let j = 0; j < g; j++)
    for (let k = 0; k < len; k++) {
      const i = 2 + j * len + k, nx = 2 + j * len + ((k + 1) % len);
      const [x, y] = M[i], [x2, y2] = M[nx], ux = x / d, uy = y / d;
      put(ux, uy, i, 0);
      put(rho * ux, rho * uy, i, 1);
      put((x + x2) / 2, (y + y2) / 2, i, nx);
    }
  S.nt = nt;
  S.tri = tri;
  S.model = M;
  S.rho = rho;
  S.a = a;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [6, 2, 1, 0.06], dd = cl(dt || 0, 0, 0.1);
  const n = round(cl(k[0], 6, 12)), rate = cl(k[1], 0.2, 3) / 2;
  const m = max(1, min(round(cl(k[2], 1, 4)), floor((n - 1) / 2)));
  S.q = 3 * 8 ** cl(k[3], 0, 1);
  if (n !== S.n || m !== S.m) {
    S.n = n;
    S.m = m;
    S.flash = [];
  }
  if (!S.begun) {
    S.begun = true;
    S.lay = 0;
  }
  if (input.btnPressed && input.btnPressed[0]) {
    S.lay = 0;
    S.flash = [];
  }
  const wasLaid = S.lay >= LAY;
  S.lay += dd * rate;
  S.phi += (dd * rate * TAU) / TURN;
  if (!wasLaid && S.lay >= LAY) S.flash.push(0);
  for (let i = 0; i < S.flash.length; i++) S.flash[i] += dd * rate;
  S.flash = S.flash.filter((f) => f < 0.8);
  geometry(S);
}

// How far circle i is laid, 0..1: they go down one after another.
function shown(S, i) {
  if (i < 2) return 1;
  return cl(((S.lay / LAY) * S.n - (i - 2)) * 1.5, 0, 1);
}

// Orange and yellow go brown and olive dimmed, so their discs are lit
// brighter inside and paler.
const warm = (h) => {
  const u = (h - floor(h) - 0.13) / 0.14;
  return u * u < 1 ? (1 - u * u) ** 2 : 0;
};

function disc(A, x0, y0, r, w, c, f, lift, lo, hi) {
  const ext = r + 2, rr = max(r, 0.35);
  for (let y = max(lo, floor(y0 - ext)); y <= min(hi, floor(y0 + ext)); y++) {
    const dy = y + 0.5 - y0;
    for (let x = max(0, floor(x0 - ext)); x <= min(W - 1, floor(x0 + ext)); x++) {
      const dx = x + 0.5 - x0, D = sqrt(dx * dx + dy * dy);
      if (D > ext) continue;
      const u = min(1, D / rr), fill = cl(rr - D + 0.5, 0, 1), e = (D - rr) / 0.7;
      // A soft lit disc: dim in the middle, rising toward a bright rim, a
      // glow on the upper left where the light comes from.
      const hx = dx + 0.42 * rr, hy = dy + 0.42 * rr, glow = exp(-(hx * hx + hy * hy) / (0.22 * rr * rr + 0.6));
      const vf = w * fill * (0.2 + 0.28 * u * u + 0.32 * glow) * lift;
      let v = 0.85 * exp(-e * e);
      if (r < 1.5) v += (1.5 - r) * 0.5 * fill;
      v *= w;
      // Screen blend, so where wound chains overlap the lenses show without
      // washing out to white.
      const p = 3 * (y * W + x);
      A[p] = 1 - (1 - A[p]) * (1 - min(1, c[0] * v + f[0] * vf));
      A[p + 1] = 1 - (1 - A[p + 1]) * (1 - min(1, c[1] * v + f[1] * vf));
      A[p + 2] = 1 - (1 - A[p + 2]) * (1 - min(1, c[2] * v + f[2] * vf));
    }
  }
}

function ring(A, x0, y0, r, lv, lo, hi) {
  const ext = r + 2;
  for (let y = max(lo, floor(y0 - ext)); y <= min(hi, floor(y0 + ext)); y++) {
    const dy = y + 0.5 - y0;
    for (let x = max(0, floor(x0 - ext)); x <= min(W - 1, floor(x0 + ext)); x++) {
      const dx = x + 0.5 - x0, e = (sqrt(dx * dx + dy * dy) - r) / 0.6;
      if (e > 4 || e < -4) continue;
      const v = lv * exp(-e * e), p = 3 * (y * W + x);
      A[p] += v;
      A[p + 1] += v;
      A[p + 2] += v;
    }
  }
}

function dot(A, x0, y0, s, lv, lo, hi) {
  const ext = 3 * s;
  for (let y = max(lo, floor(y0 - ext)); y <= min(hi, floor(y0 + ext)); y++) {
    const dy = y + 0.5 - y0;
    for (let x = max(0, floor(x0 - ext)); x <= min(W - 1, floor(x0 + ext)); x++) {
      const dx = x + 0.5 - x0, v = lv * exp(-(dx * dx + dy * dy) / (2 * s * s)), p = 3 * (y * W + x);
      A[p] += v;
      A[p + 1] += v;
      A[p + 2] += v;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.begun) return;
  const { A, col, fil, n } = S;
  A.fill(0);
  for (let sq = 0; sq < 2; sq++) {
    const C = S.C[sq], T = S.T[sq], lo = sq * 64, hi = lo + 63;
    ring(A, C[0], C[1], C[2], 0.5, lo, hi);
    ring(A, C[3], C[4], C[5], 0.5, lo, hi);
    for (let i = 2; i < n + 2; i++) {
      const w = shown(S, i);
      if (w <= 0) continue;
      const h = H0 + (i - 2) / n, wm = warm(h);
      hsv(h, 0.8, 1, col);
      hsv(h, 0.74 - 0.3 * wm, 1, fil);
      // A wound chain stacks its discs Turns deep, so each is filled fainter.
      disc(A, C[3 * i], C[3 * i + 1], C[3 * i + 2], w, col, fil, (1 + 0.9 * wm) * S.m ** -0.7, lo, hi);
    }
    // Every touch, lit once both its circles are laid; small ones smaller.
    for (let t = 0; t < S.nt; t++) {
      const [a, b] = S.tri[t], w = min(shown(S, a), shown(S, b));
      if (w < 1) continue;
      const rr = min(C[3 * a + 2], b > 1 ? C[3 * b + 2] : 99);
      dot(A, T[2 * t], T[2 * t + 1], cl(0.25 * rr, 0.45, 0.8), 0.75 / S.m, lo, hi);
    }
    // The closing: the touch between the last circle laid and the first.
    for (const f of S.flash) {
      const len = n / gcd(n, S.m), i = 2 + len - 1, t = 3 * (i - 2) + 2, e = 1 - f / 0.8;
      dot(A, T[2 * t], T[2 * t + 1], 1.4 + 2.5 * f, 1.6 * e * e, lo, hi);
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = 3 * (y * W + x);
      display.setPixel(x, y, round(255 * min(1, A[p])), round(255 * min(1, A[p + 1])), round(255 * min(1, A[p + 2])));
    }
}
