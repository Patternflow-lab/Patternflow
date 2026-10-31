// ===== Patternflow pattern =====
// Title:   Doyle Spiral
// Family:  cells
// Idea:    A Doyle spiral, a packing of discs in which every disc touches six others and each is its neighbour turned and scaled by one of two fixed complex numbers, streams out of a dark pole in the middle of the tall panel and past its edges, every disc coloured by which of its 5 to 10 spiral arms it sits on, so the arms turn round the pole while the discs grow.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Doyle spirals, named for Peter Doyle (Alan F. Beardon, Tomasz Dubejko and Kenneth Stephenson, Spiral hexagonal circle packings in the plane, 1994); H. S. M. Coxeter's loxodromic sequences of tangent spheres (1968), whose plane case is the (2, 3) spiral; pattern round 80
// Round:   80
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Arms=5..10, Poles=0..1
//
// Knob 1: Hue. Turns the arm colours round the wheel together. At 0 the five arms of the opening spiral are azure, violet, rose, gold and green, a fifth of the wheel apart; each disc is pale in the middle, fully coloured at its rim and lit from the side that faces the pole.
// Knob 2: Speed. At 2 every disc takes 4.2 s to move out into the place of its neighbour along one family of arms, 1.41 times as far from the pole and 25 degrees further clockwise in the opening spiral, so the packing is the same again and only the colours have stepped on by one arm. 42 s at 0.2, 2.8 s at 3.
// Knob 3: Arms. How many coloured arms, q - p of the pair (p, q): 5 is (8, 13), 6 (11, 17), 7 (12, 19), 8 (13, 21), 9 (14, 23), 10 (17, 27). The more arms, the smaller the discs: a disc 60 LEDs from the pole has a radius of 16.4 LEDs at 5 and 7.9 at 10, and between 4 and 6 LEDs from the pole 32% of the LEDs are lit at 5 and 4% at 10. Neighbouring arms are 1/5 of the wheel apart at 5, then 2/6, 2/7, 2/8, 2/9 and 3/10, so they stay apart.
// Knob 4: Poles. A Moebius map brings the spiral's second pole, at infinity at 0, in from below. At the opening 0.06 it is 1006 rows under the first, which sits at row 62 and bends the packing only slightly; from 0.59 the second pole is on the panel, and at 1 the two stand at rows 34 and 94, the discs coming out of the upper one and spiralling into the lower.

// Put the pole at 0 in the complex plane. A Doyle spiral has a disc
// centred on A^m B^n for every pair of integers m, n, with radius r times
// the distance of its centre from 0. Multiplying by A or by B maps the
// packing onto itself, so if the disc at 1 touches the discs at A and B
// and those two touch each other,
//
//   |1 - A| = r (1 + |A|),  |1 - B| = r (1 + |B|),  |A - B| = r (|A| + |B|),
//
// then every disc touches six: those at z A, z B, z B/A and back. The
// packing closes on itself in the plane when A^p = B^q, and then the discs
// lie on q arms one way, p arms the other and q - p arms the third. Write
// A = a e^(it) and B = a^(p/q) e^(i(pt + 2 pi)/q), which makes A^p = B^q,
// take r from the first equation and solve the other two for a and t with
// Newton, the way Robin Houston's doyle-spiral code does. Newton starts
// from the hexagonal lattice that log A and log B would make if the discs
// were all one size.
//
// In log z every disc is the same shape, the log of the disc of radius r
// round 1, moved to m log A + n log B. So one table over a single cell of
// that lattice tells every LED which disc it is in and where in it. Disc
// (m, n) and disc (m + p, n - q) are the same disc, and the arm a disc sits
// on among the q - p is (m + n) mod (q - p). Moving every disc out by one
// step of B is the packing again, so the motion runs on without a seam.
//
// The edges stay hard: every LED within 0.55 LED of a rim is off, so two
// discs never light neighbouring LEDs, and inside a disc the brightest
// channel changes by under 6 of 255 an LED, 7 only where rounding meets.
// Hue and saturation change from LED to LED as much as they like, which is
// what keeps the frame from packing small.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, sqrt, sin, cos, atan2, log, exp, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// (p, q) for 5 to 10 coloured arms.
const PAIRS = [[8, 13], [11, 17], [12, 19], [13, 21], [14, 23], [17, 27]];
// The table over one lattice cell is L by L.
const L = 192;
// LEDs kept dark inside every rim.
const RIM = 0.55;

// The two tangencies besides the first, as differences of r, and r.
function tangency(a, t, p, q) {
  const b = pow(a, p / q), s = (p * t + TAU) / q;
  const ax = a * cos(t), ay = a * sin(t), bx = b * cos(s), by = b * sin(s);
  const r = sqrt((1 - ax) ** 2 + ay * ay) / (1 + a);
  return [sqrt((1 - bx) ** 2 + by * by) / (1 + b) - r, sqrt((ax - bx) ** 2 + (ay - by) ** 2) / (a + b) - r, r];
}

function solve(p, q) {
  // log A has length 2 pi / |q e^(i pi/3) - p| in the lattice of equal discs.
  const len = TAU / sqrt(p * p - p * q + q * q);
  const th = PI / 2 - atan2(q * sin(PI / 3), q * cos(PI / 3) - p);
  let a = exp(len * cos(th)), t = len * sin(th);
  for (let it = 0; it < 40; it++) {
    const f = tangency(a, t, p, q), h = 1e-7, fa = tangency(a + h, t, p, q), ft = tangency(a, t + h, p, q);
    const j00 = (fa[0] - f[0]) / h, j01 = (ft[0] - f[0]) / h, j10 = (fa[1] - f[1]) / h, j11 = (ft[1] - f[1]) / h;
    const det = j00 * j11 - j01 * j10, da = (j11 * f[0] - j01 * f[1]) / det, dt = (j00 * f[1] - j10 * f[0]) / det;
    a -= da;
    t -= dt;
    if (da * da + dt * dt < 1e-26) break;
  }
  // log A = ur + i ui, log B = vr + i vi.
  return { p, q, ur: log(a), ui: t, vr: (log(a) * p) / q, vi: (p * t + TAU) / q, r: tangency(a, t, p, q)[2], code: null };
}

// For each point (al, be) of the cell, al log A + be log B in log z: which
// corner's disc it is in (0..15 for m, n offsets -1..2), how far out in
// that disc as a share of its radius, the disc's distance from the pole
// over the point's, and the direction from the disc's centre, measured
// from the line out of the pole.
function build(P) {
  const n = L * L;
  P.code = new Uint8Array(n);
  P.s = new Float32Array(n);
  P.e = new Float32Array(n);
  P.cs = new Float32Array(n);
  P.sn = new Float32Array(n);
  for (let j = 0; j < L; j++)
    for (let i = 0; i < L; i++) {
      const al = (i + 0.5) / L, be = (j + 0.5) / L, k = j * L + i;
      let best = 1e9;
      for (let dn = -1; dn <= 2; dn++)
        for (let dm = -1; dm <= 2; dm++) {
          const dr = (al - dm) * P.ur + (be - dn) * P.vr, di = (al - dm) * P.ui + (be - dn) * P.vi;
          if (dr < -2 || dr > 2) continue;
          // z over the disc's centre is e^(dr + i di); the disc is |that - 1| < r.
          const ex = exp(dr), x = ex * cos(di) - 1, y = ex * sin(di), h = sqrt(x * x + y * y) || 1e-9, s = h / P.r;
          if (s >= best) continue;
          best = s;
          P.code[k] = (dn + 1) * 4 + dm + 1;
          P.e[k] = 1 / ex;
          P.cs[k] = x / h;
          P.sn[k] = y / h;
        }
      P.s[k] = best;
    }
}

function hsv(h, s, v, o, k) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[k] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[k + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[k + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  params.s = {
    pairs: PAIRS.map(([p, q]) => solve(p, q)), pi: -1, kappa: -1,
    fa: new Int32Array(N), col: new Int32Array(N), B0: new Float32Array(N), G: new Float32Array(N),
    tb: 0, on: 0, hue: 0, out: new Float32Array(N * 3),
  };
}

// Per LED: where it falls in the lattice, and how many LEDs one unit of
// relative distance is there. With poles P1 and P2 the map is
// z = (w - P1)(P2 - P1) / (P2 - w), which is w - P1 when P2 is at infinity.
function tables(S, P, kappa) {
  const px = 32, p1 = 64 - 30 * kappa, p2 = kappa < 1e-4 ? 0 : 64 + 30 * kappa + (64 * (1 - kappa)) / kappa;
  const det = P.ur * P.vi - P.ui * P.vr;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, wx = x + 0.5 - px, wy = y + 0.5 - p1, d1 = sqrt(wx * wx + wy * wy) + 1e-6;
      let lr = log(d1), th = atan2(wy, wx), g = d1;
      if (kappa >= 1e-4) {
        const ex = px - x - 0.5, ey = p2 - y - 0.5, d2 = sqrt(ex * ex + ey * ey) + 1e-6, D = p2 - p1;
        lr += log(D / d2);
        th += PI / 2 - atan2(ey, ex);
        g = (d1 * d2) / D;
      }
      const a = (lr * P.vi - th * P.vr) / det, fa = floor(a);
      S.fa[i] = fa;
      S.col[i] = min(L - 1, floor((a - fa) * L));
      S.B0[i] = (P.ur * th - P.ui * lr) / det;
      S.G[i] = g;
    }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const pi = round(cl(k[2] == null ? 5 : k[2], 5, 10)) - 5, kappa = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const P = S.pairs[pi];
  if (!P.code) build(P);
  if (pi !== S.pi || kappa !== S.kappa) {
    S.pi = pi;
    S.kappa = kappa;
    tables(S, P, kappa);
  }
  // One step of B every 4.2 s at Speed 2. A whole step is the same
  // packing with every disc one further along, so the count moves instead.
  S.tb += d * speed * 0.12;
  while (S.tb >= 1) {
    S.tb -= 1;
    S.on -= 1;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.pi < 0) return;
  const P = S.pairs[S.pi], out = S.out, arms = P.q - P.p, r = P.r;
  // Neighbouring arms are this many steps of 1/arms apart on the wheel.
  const stride = max(1, round(arms / 4)) / arms;
  out.fill(0);
  for (let i = 0; i < N; i++) {
    const b = S.B0[i] - S.tb, fb = floor(b), li = min(L - 1, floor((b - fb) * L)) * L + S.col[i], s = P.s[li];
    if (s >= 1) continue;
    // The disc's radius in LEDs, and how far this LED is inside its rim.
    const R = S.G[i] * P.e[li] * r, dd = R * (1 - s);
    if (dd < RIM) continue;
    const c = P.code[li], m = S.fa[i] + (c & 3) - 1, n = fb + (c >> 2) - 1 + S.on;
    const arm = (((m + n) % arms) + arms) % arms;
    const lean = cl(R * s * P.cs[li], -12, 12);
    const v = 0.9 - 0.017 * (7 - min(dd, 7)) - 0.006 * lean;
    hsv(S.hue + 0.55 + arm * stride + 0.04 * s * P.sn[li], 0.35 + 0.6 * s, v, out, i * 3);
  }
  for (let i = 0; i < N; i++) display.setPixel(i % W, floor(i / W), round(out[i * 3] * 255), round(out[i * 3 + 1] * 255), round(out[i * 3 + 2] * 255));
}
