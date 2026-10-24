// ===== Patternflow pattern =====
// Title:   Dyson Gas
// Family:  particle
// Idea:    The eigenvalues of a random Hermitian matrix whose entries diffuse jiggle along a line and push each other apart, and their world lines scroll down the panel as a rainbow of threads that braid but never cross, crowded in the middle and sparse at the sides as Wigner's semicircle says.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Dyson Brownian motion (Freeman Dyson, 1962), pattern round 29
// Round:   29
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Count=10..28, Beta=1..9
//
// Knob 1: Hue. Turns the rainbow of threads round the colour wheel; the lowest eigenvalue on the left and the highest on the right always sit at the two ends of it.
// Knob 2: Speed. How fast the matrix diffuses and the history scrolls: at 2 about twenty rows a second, and each row is a longer stretch of the process, so the threads shiver harder.
// Knob 3: Count. The size of the matrix, 10 to 28 eigenvalues. The semicircle always spans the panel, so more of them crowd the middle: about four and a half LEDs apart there at 10, under two at 28.
// Knob 4: Beta. The strength of the repulsion against the noise: 1, 2 and 4 are the real, complex and quaternion matrices (GOE, GUE, GSE). Higher, the gaps go stiff and even and the threads run like the bars of a crystal.
// Buttons: K1 tap turns the repulsion off for about three seconds at Speed 2: the eigenvalues walk on their own like the diagonal of a matrix with nothing off it, and the threads sag together and cross; then the repulsion comes back, they spring apart and the colours sort themselves back into a rainbow. K2 tap shrinks the matrix to zero and lets it go: the threads pinch into one point and fan out again.

const W = 64, H = 128, N = W * H, NMAX = 28, CX = 31.5;
const { min, max, floor, round, sqrt, abs, asin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();
// A normal sample from four uniforms: bounded, which keeps a substep small.
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

// The process, in Dyson's units with an Ornstein-Uhlenbeck pull:
//   d lambda_i = sum_j 1 / (lambda_i - lambda_j) dt - lambda_i / 2 dt + sqrt(2 / beta) dB_i
// Its resting state is the Gaussian beta ensemble, whose eigenvalues fill
// Wigner's semicircle on [-2 sqrt(n), 2 sqrt(n)] whatever beta is; beta only
// sets how hard the noise shakes them. The semicircle's edge sits RPX LEDs
// either side of the middle.
const RPX = 29.5;
// The longest substep. Near a close pair the step shrinks with the square of
// the gap, so the pair is pushed apart before the noise can carry it across.
// A frame takes at most SUBMAX substeps; right after a pinch, when the gaps
// are tiny, the rest of that frame's time is let go and the fan opens a
// little slower for a few frames.
const DTMAX = 0.004, SUBMAX = 500;
// History rows kept, one more than the panel so the scroll can interpolate.
const HB = H + 2;
// Where the rainbow starts at Hue 0 (sea green) and how much of the wheel it
// spans, so the highest eigenvalue is pink.
const H0 = 0.42, SPAN = 0.52;
// The beads ride on this row; the threads hang from it.
const TOP = 3;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Where the k-th of n eigenvalues sits in the semicircle, as a fraction of
// its radius: the inverse of F(u) = 1/2 + (u sqrt(1 - u^2) + asin u) / pi.
function quantile(q) {
  let a = -1, b = 1;
  for (let it = 0; it < 40; it++) {
    const u = (a + b) / 2;
    if (0.5 + (u * sqrt(1 - u * u) + asin(u)) / PI < q) a = u;
    else b = u;
  }
  return (a + b) / 2;
}

export function setup(params) {
  const P = (params.s = {
    n: 10, beta: 1, sp: 2, hue: -1, started: false,
    lam: new Float64Array(NMAX), sm: new Float64Array(NMAX), f: new Float64Array(NMAX), ord: new Int8Array(NMAX), hc: new Float32Array(NMAX),
    hx: new Float32Array(HB * NMAX), hh: new Float32Array(HB * NMAX), hn: new Uint8Array(HB), he: new Uint16Array(HB),
    head: 0, acc: 0, ep: 0, free: 0, pinch: -1, snap: new Float64Array(NMAX),
    X: new Float32Array((H + 1) * NMAX), XH: new Float32Array((H + 1) * NMAX), Xn: new Uint8Array(H + 1), Xe: new Uint16Array(H + 1),
    buf: new Float32Array(N * 3), lut: new Float32Array(256 * 3),
  });
  paint(P, 0);
  fill(P);
}

// The rainbow for this Hue, 256 steps from the lowest eigenvalue's colour to
// the highest's.
function paint(P, hue) {
  P.hue = hue;
  for (let j = 0; j < 256; j++) hsv(hue + H0 + (SPAN * j) / 255, 0.82, 255, P.lut, j * 3);
}

// A fresh matrix of the current size, already at rest, with a full panel of
// history behind it so the first frame shows the threads.
function fill(P) {
  const n = P.n, R = 2 * sqrt(n);
  P.ep++;
  for (let i = 0; i < n; i++) (P.lam[i] = R * quantile((i + 0.5) / n)), (P.ord[i] = i), (P.hc[i] = n > 1 ? i / (n - 1) : 0.5);
  P.free = 0, P.pinch = -1, P.acc = 0;
  step(P, 2);
  P.sm.set(P.lam);
  const tr = rowTau(P.sp);
  for (let k = 0; k < HB; k++) step(P, tr), look(P, 1), push(P);
}

// The threads are drawn through a short exposure: each one follows its
// eigenvalue with a lag of SMOOTH rows. An average of ordered positions is
// still ordered, so the drawn threads cannot cross where the eigenvalues
// do not.
const SMOOTH = 3;
function look(P, rows) {
  const a = 1 - Math.exp(-rows / SMOOTH);
  for (let i = 0; i < P.n; i++) P.sm[i] += (P.lam[i] - P.sm[i]) * a;
}

// Rows a second and stretch of the process per row, both from Speed.
const rowRate = (s) => 5 + 7.5 * s;
const rowTau = (s) => 0.01 + 0.01 * s;

function push(P) {
  const n = P.n, sc = RPX / (2 * sqrt(n));
  P.head = (P.head + 1) % HB;
  const o = P.head * NMAX;
  for (let i = 0; i < n; i++) (P.hx[o + i] = CX + P.sm[i] * sc), (P.hh[o + i] = P.hc[i]);
  P.hn[P.head] = n, P.he[P.head] = P.ep;
}

// Advance the process by T. With the repulsion on, the eigenvalues keep the
// order they had when it came on: ord lists them left to right, and if a
// substep ever lets a pair overtake, the two swap places rather than cross.
function step(P, T) {
  const n = P.n, lam = P.lam, f = P.f, ord = P.ord, rep = P.free <= 0, sd0 = sqrt(2 / P.beta);
  let left = T;
  for (let it = 0; it < SUBMAX && left > 1e-9; it++) {
    for (let i = 0; i < n; i++) f[i] = -0.5 * lam[i];
    let dt = DTMAX;
    if (rep) {
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          let d = lam[i] - lam[j];
          if (abs(d) < 1e-6) d = d < 0 ? -1e-6 : 1e-6;
          const q = 1 / d;
          (f[i] += q), (f[j] -= q);
        }
      // No eigenvalue may move more than a fifth of the closest gap in one
      // substep, by the push or by the noise.
      let g = 1e9, fm = 1e-9;
      for (let r = 0; r + 1 < n; r++) g = min(g, lam[ord[r + 1]] - lam[ord[r]]);
      for (let i = 0; i < n; i++) fm = max(fm, abs(f[i]));
      g = max(g, 1e-6);
      dt = min(DTMAX, 0.2 * g * g, (0.2 * g) / fm);
    }
    if (dt > left) dt = left;
    const sd = sd0 * sqrt(dt);
    for (let i = 0; i < n; i++) lam[i] += f[i] * dt + sd * gauss();
    if (rep)
      for (let r = 0; r + 1 < n; r++) {
        const a = ord[r], b = ord[r + 1];
        if (lam[b] < lam[a]) {
          const t = lam[a];
          (lam[a] = lam[b]), (lam[b] = t);
        }
      }
    left -= dt;
  }
}

// When the repulsion comes back, the eigenvalues are ranked where they
// stand and each colour starts drifting back to its rank's place in the
// rainbow.
function rank(P) {
  const n = P.n, ord = P.ord, lam = P.lam;
  for (let i = 0; i < n; i++) ord[i] = i;
  for (let i = 1; i < n; i++) {
    const v = ord[i];
    let j = i - 1;
    while (j >= 0 && lam[ord[j]] > lam[v]) (ord[j + 1] = ord[j]), j--;
    ord[j + 1] = v;
  }
}

// A new size keeps the picture: the new eigenvalues take the old ones'
// quantiles, scaled to the new semicircle.
function resize(P, n) {
  const m = P.n, ord = P.ord, lam = P.lam, u = new Float64Array(m);
  rank(P);
  for (let r = 0; r < m; r++) u[r] = lam[ord[r]] / (2 * sqrt(m));
  P.n = n, P.ep++, P.free = 0, P.pinch = -1;
  for (let i = 0; i < n; i++) {
    const q = n > 1 ? (i / (n - 1)) * (m - 1) : (m - 1) / 2, a = floor(q), b = min(m - 1, a + 1);
    lam[i] = (u[a] + (u[b] - u[a]) * (q - a)) * 2 * sqrt(n);
    ord[i] = i, P.hc[i] = n > 1 ? i / (n - 1) : 0.5;
  }
  P.sm.set(lam);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 10, 1], d = cl(dt || 0, 0, 0.1);
  const pr = input.btnPressed || [];
  if (k[0] !== P.hue) paint(P, k[0]);
  P.sp = cl(k[1], 0.2, 3);
  P.beta = cl(k[3], 1, 9);
  const n = round(cl(k[2], 10, NMAX));
  // The first frame's history is made again with the knobs as they stand.
  if (!P.started) (P.started = true), (P.n = n), fill(P);
  else if (n !== P.n) resize(P, n);

  if (pr[0] && P.pinch < 0) P.free = 2;
  if (pr[1] && P.pinch < 0) {
    P.pinch = 0, P.free = 0;
    for (let i = 0; i < P.n; i++) P.snap[i] = P.lam[i];
  }

  const tau = d * rowRate(P.sp) * rowTau(P.sp);
  if (P.pinch >= 0) {
    // The matrix scaled down to nothing: every eigenvalue scales with it, so
    // the threads run straight into the middle. At a thirtieth of its size it
    // is let go and the repulsion fans it out again.
    P.pinch += d;
    const t = cl(P.pinch / 0.55, 0, 1), s = 0.03 + 0.97 * (1 - t * t * (3 - 2 * t));
    for (let i = 0; i < P.n; i++) P.lam[i] = P.snap[i] * s;
    if (t >= 1) (P.pinch = -1), rank(P);
  } else if (P.free > 0) {
    step(P, tau);
    P.free -= tau;
    if (P.free <= 0) rank(P);
  } else step(P, tau);

  // Colours ease back to their rank's place once the order is settled again.
  if (P.free <= 0) {
    const n1 = max(1, P.n - 1), e = min(1, d * 1.2);
    for (let r = 0; r < P.n; r++) P.hc[P.ord[r]] += (r / n1 - P.hc[P.ord[r]]) * e;
  }
  look(P, d * rowRate(P.sp));
  P.acc += d * rowRate(P.sp);
  while (P.acc >= 1) (P.acc -= 1), push(P);
}

// One thread's light on one row: a 1-LED core across the span it moves
// through between this row and the next, and a soft halo either side.
function span(buf, y, a, b, r, g, bl) {
  const x0 = max(0, floor(a - 2.5)), x1 = min(W - 1, floor(b + 2.5)), o = y * W;
  for (let x = x0; x <= x1; x++) {
    const c = x + 0.5, dd = c < a ? a - c : c > b ? c - b : 0;
    let w = 1 - dd;
    const h = 0.3 / (1 + dd * dd * 1.6);
    if (w < h) w = h;
    const q = (o + x) * 3;
    buf[q] += r * w, buf[q + 1] += g * w, buf[q + 2] += bl * w;
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const n = P.n, sc = RPX / (2 * sqrt(n)), X = P.X, XH = P.XH, Xn = P.Xn, Xe = P.Xe, buf = P.buf, lut = P.lut, L = H - TOP;
  // History row 0 is now, on the beads; the newest stored row is acc rows
  // down, the next one a row further. Each drawn row interpolates between
  // the two stored rows it falls between, so the scroll glides.
  for (let y = 0; y <= L; y++) {
    const o = y * NMAX;
    let ia, ib, t;
    if (y < P.acc) (ia = -1), (ib = P.head), (t = y / P.acc);
    else {
      const u = y - P.acc, kk = floor(u);
      (ia = (P.head - kk + HB * 2) % HB), (ib = (ia - 1 + HB) % HB), (t = u - kk);
    }
    const ea = ia < 0 ? P.ep : P.he[ia], eb = P.he[ib], na = ia < 0 ? n : P.hn[ia], nb = P.hn[ib];
    if (ea === eb && na === nb) {
      for (let i = 0; i < na; i++) {
        const xa = ia < 0 ? CX + P.sm[i] * sc : P.hx[ia * NMAX + i], ha = ia < 0 ? P.hc[i] : P.hh[ia * NMAX + i];
        X[o + i] = xa + (P.hx[ib * NMAX + i] - xa) * t;
        XH[o + i] = ha + (P.hh[ib * NMAX + i] - ha) * t;
      }
      (Xn[y] = na), (Xe[y] = ea);
    } else {
      // A row from before Count was turned: no thread joins across it.
      const s = t < 0.5 && ia >= 0 ? ia : ib;
      for (let i = 0; i < P.hn[s]; i++) (X[o + i] = P.hx[s * NMAX + i]), (XH[o + i] = P.hh[s * NMAX + i]);
      (Xn[y] = P.hn[s]), (Xe[y] = P.he[s]);
    }
  }
  buf.fill(0);
  for (let y = 0; y < L; y++) {
    const o = y * NMAX, m = Xn[y];
    const okU = y > 0 && Xe[y - 1] === Xe[y] && Xn[y - 1] === m, okD = Xe[y + 1] === Xe[y] && Xn[y + 1] === m;
    // The past dims a little toward the bottom; the newest rows burn
    // brighter and whiter.
    const fade = 1 - 0.42 * (y / L), hot = y < 5 ? 0.35 * (1 - y / 5) : 0, f1 = fade * (1 + hot), wh = 90 * hot;
    for (let i = 0; i < m; i++) {
      const x = X[o + i], xu = okU ? (X[o - NMAX + i] + x) / 2 : x, xd = okD ? (X[o + NMAX + i] + x) / 2 : x;
      const q = round(cl(XH[o + i], 0, 1) * 255) * 3;
      span(buf, y + TOP, min(x, xu, xd), max(x, xu, xd), lut[q] * f1 + wh, lut[q + 1] * f1 + wh, lut[q + 2] * f1 + wh);
    }
  }
  // The eigenvalues themselves: a bead on the top of each thread, white at
  // the heart and its own colour round the rim.
  for (let i = 0; i < n; i++) {
    const x = X[i], q = round(cl(P.hc[i], 0, 1) * 255) * 3;
    const r = lut[q] * 0.7 + 76, g = lut[q + 1] * 0.7 + 76, b = lut[q + 2] * 0.7 + 76;
    for (let yy = 0; yy < TOP + 4; yy++)
      for (let xx = max(0, floor(x - 2.5)); xx <= min(W - 1, floor(x + 2.5)); xx++) {
        const dx = xx + 0.5 - x, dy = yy - TOP, r2 = dx * dx + dy * dy * 1.2, w = 1.35 / (1 + r2 * 0.9) - 0.14, p = (yy * W + xx) * 3;
        if (w <= 0) continue;
        const wc = 140 * w * w;
        (buf[p] += r * w + wc), (buf[p + 1] += g * w + wc), (buf[p + 2] += b * w + wc);
      }
  }
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, min(255, buf[p]), min(255, buf[p + 1]), min(255, buf[p + 2]));
}
