// ===== Patternflow pattern =====
// Title:   Quantum Walk
// Family:  sim
// Idea:    Space runs across the panel, two lattice sites to an LED, and time down it, one step a row, as a Hadamard walk started with its coin on L writes its space-time diagram: the chance of finding the walker at each site with its coin on L fills a cone whose edges, the two ballistic fronts near plus and minus t over root 2, glow white where the walker is most likely found, cut through by nested dark arcs where that half of the wave cancels itself, and once the diagram is written a gold dotted line traces down the middle at the classical walk's square root of t, before the panel fades and the walk starts again.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: discrete-time quantum walk (Yakir Aharonov, Luiz Davidovich and Nicim Zagury, 1993), the Hadamard walk on the line (Andris Ambainis, Eric Bach, Ashwin Nayak, Ashvin Vishwanath and John Watrous, 2001), its limit law (Norio Konno, 2002), the walk with a measured coin (Todd Brun, Hilary Carteret and Andris Ambainis, 2003), pattern round 79
// Round:   79
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Measure=0..1, Coin=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the probability is azure and the classical line gold, at 0.25 violet with green, at 0.5 red-orange with blue.
// Knob 2: Speed. Steps a second, 33 for each unit: 66 at the opening 2, so a diagram of 127 steps is written in 1.9 s, then held 5.5 s, the gold line tracing down in the first 2.5 s of it, faded in 0.3 s and left dark for 0.4 s. At 0.2 a diagram takes 19 s, at 3 it takes 1.3 s.
// Knob 3: Measure. The chance p that the coin is measured after each flip, 10^(3 (knob - 1)): none at 0, 0.0056 at 0.25, 0.032 at 0.5, 0.18 at 0.75 and every step at 1. The arcs fade from about row 1/p on (row 31 at 0.5, row 6 at 0.75) and the cone gives way to a bell; at 1 it is the classical walk, whose standard deviation on the last row is sqrt(127) = 11.3 sites, 5.6 LEDs.
// Knob 4: Coin. The coin is [[cos q, sin q], [sin q, -cos q]] and its fronts run at cos q sites a step. Within 0.12 of the middle (it opens at 0.06) it is Hadamard's, cos q = 0.707, and the fronts leave the panel on row 90; at -1 cos q = 0.96 and they leave on row 67; at -0.5 it is 0.82 (row 78), at 0.5 it is 0.53 (row 120), and at 1 it is 0.3, and the fronts end 19 LEDs either side of the middle.
// Buttons: K1 tap starts the walk again with the next starting coin: L (the opening), (L + iR)/sqrt 2, then R. K2 tap changes what the colour shows: the chance of the walker at a site with its coin on L (the opening), with its coin on R, or at the site at all.

// The walker sits on a site x of the line and carries a coin, a qubit with
// the states L and R. A step flips the coin with the Hadamard matrix
// (1/sqrt 2) [[1, 1], [1, -1]] and then moves the L part one site left and
// the R part one site right. After t steps the walker is only ever on sites
// of the parity of t, so each row here keeps one site of each LED's pair.
//
// A classical walker with a fair coin spreads as sqrt(t). This one spreads
// as t: Ambainis and his coauthors found the chance pile up in two peaks
// near x = -t / sqrt 2 and x = t / sqrt 2, and Konno found the limit law of
// x / t, which lives between -cos q and cos q for the coin of K4. Started
// with its coin on L the walk drifts left; started in (L + iR)/sqrt 2 it is
// symmetric.
//
// Each row is scaled to its own largest value, so the late rows show as
// well as the first. Scaled plainly, the narrow peaks would leave the rest
// of a row dark, so the colour climbs as the square to full at 4% of that
// value, and white shows where the position probability passes 12% of its
// largest. The L part of the wave alone falls nearly to zero along nested
// arcs, where the two travelling waves it is made of cancel. The R part has
// its own arcs between them, and in the sum they fill each other in (K2 tap
// shows all three).
//
// K3 measures the coin after each flip with chance p. The walker is then in
// a mixed state, held here as its density matrix over sites and coin, up
// to 256 by 256. A measurement multiplies every entry between L and R by
// 1 - p, and the rest of a step is the flip and the shift as before. At
// p = 1 nothing quantum is left and the walk is classical: a fair coin for
// Hadamard's, and for other coins a walk that keeps its direction with
// chance cos^2 q, whose standard deviation comes close to sqrt(t) cot q, the
// gold line.

const W = 64, H = 128, N = W * H, K = H + 2, D = 2 * K;
const { floor, max, sqrt, log, round, pow, abs, SQRT1_2 } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Rows a second per unit of Speed, and the hold, fade and dark gap after a
// diagram is written, in seconds.
const RATE = 33, HOLD = 5.5, FADE = 0.3, GAP = 0.4, TRACE = 2.5;
// The brightness ramp: full at KNEE of the row's largest value, as the
// square below it; white from WKNEE of the row's largest probability.
const KNEE = 0.04, GAM = 2, WKNEE = 0.12;
// Weights of the walks started in |L> and in |R> for the three starts.
const STARTS = [[1, 0], [0.5, 0.5], [0, 1]];

function hsv(h, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h);
  const v = [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][i];
  o[0] = v[0];
  o[1] = v[1];
  o[2] = v[2];
  return o;
}

export function setup(params) {
  params.s = {
    hue: 0, rate: 66, p: 0, c: SQRT1_2, s: SQRT1_2, view: 0, start: 0,
    t: 0, acc: 0, phase: 0, clock: 0,
    a1: new Float64Array(K), b1: new Float64Array(K), a2: new Float64Array(K), b2: new Float64Array(K),
    mixed: false, r: null, r2: null,
    PL: new Float32Array(N), PR: new Float32Array(N), mL: new Float32Array(H), mR: new Float32Array(H),
    mS: new Float32Array(H), cot: new Float32Array(H),
    buf: new Float32Array(N * 3), col: [0, 0, 0], gold: [0, 0, 0],
  };
  begin(params.s);
}

function begin(S) {
  S.t = 0;
  S.acc = 0;
  S.phase = 0;
  S.clock = 0;
  for (const a of [S.a1, S.b1, S.a2, S.b2]) a.fill(0);
  S.a1[0] = 1;
  S.b2[0] = 1;
  S.mixed = false;
  S.PL.fill(0);
  S.PR.fill(0);
  record(S);
}

// Row t of the panel holds the walk after t steps. Its active sites are
// x = 2k - t for k = 0..t; LED j holds the sites 2(j - 32) and 2(j - 32) + 1,
// exactly one of which is active, so k = j - 32 + ceil(t / 2).
function record(S) {
  const t = S.t, o = t * W, sh = (t + 1) >> 1, [w1, w2] = STARTS[S.start];
  let mL = 0, mR = 0, mS = 0;
  for (let k = 0; k <= t; k++) {
    let l, r;
    if (S.mixed) {
      l = S.r[2 * k * D + 2 * k];
      r = S.r[(2 * k + 1) * D + 2 * k + 1];
    } else {
      l = w1 * S.a1[k] * S.a1[k] + w2 * S.a2[k] * S.a2[k];
      r = w1 * S.b1[k] * S.b1[k] + w2 * S.b2[k] * S.b2[k];
    }
    if (l > mL) mL = l;
    if (r > mR) mR = r;
    if (l + r > mS) mS = l + r;
    const j = k - sh + 32;
    if (j >= 0 && j < W) {
      S.PL[o + j] = l;
      S.PR[o + j] = r;
    }
  }
  S.mL[t] = mL;
  S.mR[t] = mR;
  S.mS[t] = mS;
  S.cot[t] = S.c / S.s;
}

// One step of a real walk: the coin [[c, s], [s, -c]] on (L, R), then L
// moves one site left and R one site right.
function walk(a, b, t, c, s) {
  for (let k = t; k >= 0; k--) {
    const A = a[k], B = b[k];
    a[k] = c * A + s * B;
    b[k + 1] = s * A - c * B;
  }
  b[0] = 0;
}

function step(S) {
  const t = S.t, c = S.c, s = S.s, [w1, w2] = STARTS[S.start];
  if (S.p > 0 && !S.mixed) {
    if (!S.r) {
      S.r = new Float64Array(D * D);
      S.r2 = new Float64Array(D * D);
    }
    // The real part of the density matrix; the imaginary part never
    // reaches the diagonal, so it is left out.
    const n = 2 * (t + 1), r = S.r, a1 = S.a1, b1 = S.b1, a2 = S.a2, b2 = S.b2;
    for (let i = 0; i < n; i++) {
      const h = i >> 1, p1 = i & 1 ? b1[h] : a1[h], p2 = i & 1 ? b2[h] : a2[h];
      for (let j = 0; j < n; j++) {
        const g = j >> 1;
        r[i * D + j] = w1 * p1 * (j & 1 ? b1[g] : a1[g]) + w2 * p2 * (j & 1 ? b2[g] : a2[g]);
      }
    }
    S.mixed = true;
  }
  if (!S.mixed) {
    if (w1) walk(S.a1, S.b1, t, c, s);
    if (w2) walk(S.a2, S.b2, t, c, s);
  } else {
    // rho -> (1 - p) C rho C + p (the same with the coin measured), which
    // scales every entry between L and R by 1 - p, then the shift.
    const r = S.r, q = S.r2, e = 1 - S.p, n2 = 2 * (t + 2), z = 2 * (t + 1);
    for (let i = 0; i < n2; i++) {
      q[D + i] = q[i * D + 1] = 0;
      q[z * D + i] = q[i * D + z] = 0;
    }
    for (let k1 = 0; k1 <= t; k1++) {
      const i0 = 2 * k1 * D, i1 = i0 + D, L1 = 2 * k1, R1 = L1 + 3;
      for (let k2 = k1; k2 <= t; k2++) {
        const j0 = 2 * k2, w = r[i0 + j0], x = r[i0 + j0 + 1], y = r[i1 + j0], zz = r[i1 + j0 + 1];
        const u0 = c * w + s * y, u1 = c * x + s * zz, v0 = s * w - c * y, v1 = s * x - c * zz;
        const L2 = j0, R2 = j0 + 3;
        q[L1 * D + L2] = q[L2 * D + L1] = u0 * c + u1 * s;
        q[L1 * D + R2] = q[R2 * D + L1] = (u0 * s - u1 * c) * e;
        q[R1 * D + L2] = q[L2 * D + R1] = (v0 * c + v1 * s) * e;
        q[R1 * D + R2] = q[R2 * D + R1] = v0 * s - v1 * c;
      }
    }
    S.r = q;
    S.r2 = r;
  }
  S.t = t + 1;
}

function knobs(S, k) {
  S.hue = k[0] || 0;
  S.rate = RATE * cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const m = cl(k[2] || 0, 0, 1);
  S.p = m <= 0 ? 0 : pow(10, 3 * (m - 1));
  // The peak speed |c| = cos(theta): 1/sqrt(2), Hadamard's, within 0.12 of
  // the middle, out to 0.96 at -1 and in to 0.3 at +1.
  const g = cl(k[3] == null ? 0.06 : k[3], -1, 1), u = max(0, abs(g) - 0.12) / 0.88;
  S.c = g < 0 ? SQRT1_2 + u * (0.96 - SQRT1_2) : SQRT1_2 - u * (SQRT1_2 - 0.3);
  S.s = sqrt(1 - S.c * S.c);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, d = cl(dt || 0, 0, 0.1), bp = input.btnPressed || [];
  knobs(S, input.knobValues || [0, 2, 0, 0.06]);
  if (bp[1]) S.view = (S.view + 1) % 3;
  if (bp[0]) {
    S.start = (S.start + 1) % 3;
    begin(S);
  }
  S.clock += d;
  if (S.phase === 0) {
    S.acc += d * S.rate;
    while (S.acc >= 1 && S.t < H - 1) {
      step(S);
      record(S);
      S.acc -= 1;
    }
    if (S.t >= H - 1) {
      S.phase = 1;
      S.clock = 0;
    }
  } else if (S.phase === 1 && S.clock >= HOLD) {
    S.phase = 2;
    S.clock = 0;
  } else if (S.phase === 2 && S.clock >= FADE) {
    S.phase = 3;
    S.clock = 0;
  } else if (S.phase === 3 && S.clock >= GAP) begin(S);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, col = hsv(0.55 + S.hue, S.col), gold = hsv(0.12 + S.hue, S.gold), lw = log(1 / WKNEE);
  buf.fill(0);
  const fade = S.phase === 2 ? 1 - S.clock / FADE : S.phase === 3 ? 0 : 1;
  const traced = S.phase === 0 ? -1 : S.phase === 1 ? (H * S.clock) / TRACE : H;
  if (fade > 0)
    for (let y = 0; y <= S.t; y++) {
      const m = S.view === 0 ? S.mL[y] : S.view === 1 ? S.mR[y] : S.mS[y], ms = S.mS[y];
      if (!(m > 0)) continue;
      const pen = S.phase === 0 && y === S.t ? 0.6 : 0;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, P = S.view === 0 ? S.PL[i] : S.view === 1 ? S.PR[i] : S.PL[i] + S.PR[i], v = P / m;
        const lev = v >= KNEE ? 1 : pow(v / KNEE, GAM);
        // White where the walker is most likely found, from the position
        // probability whatever the view.
        const vs = (S.PL[i] + S.PR[i]) / ms;
        const wh = max(vs > WKNEE ? (0.9 * log(vs / WKNEE)) / lw : 0, pen * lev), o = i * 3;
        buf[o] = (col[0] * lev * (1 - wh) + wh) * fade;
        buf[o + 1] = (col[1] * lev * (1 - wh) + wh) * fade;
        buf[o + 2] = (col[2] * lev * (1 - wh) + wh) * fade;
      }
      // The classical walk's standard deviation, sqrt(t) cot(theta) sites,
      // traced down the diagram once it is written.
      if (y % 2 || y > traced) continue;
      const sd = sqrt(y) * S.cot[y];
      for (const sg of [-1, 1]) {
        const x = 32 + floor((sg * sd) / 2);
        if (x < 0 || x >= W) continue;
        const o = (y * W + x) * 3;
        buf[o] = gold[0] * fade;
        buf[o + 1] = gold[1] * fade;
        buf[o + 2] = gold[2] * fade;
      }
    }
  for (let i = 0; i < N; i++) display.setPixel(i % W, floor(i / W), round(cl(buf[i * 3], 0, 1) * 255), round(cl(buf[i * 3 + 1], 0, 1) * 255), round(cl(buf[i * 3 + 2], 0, 1) * 255));
}
