// ===== Patternflow pattern =====
// Title:   Zeta Loops
// Family:  line
// Idea:    A bright head draws the Riemann zeta function along the critical line as t climbs, looping round the plane and passing exactly through the origin at every nontrivial zero, where the origin flashes and a ring opens from it.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Riemann zeta function on the critical line (Bernhard Riemann, 1859), pattern round 29
// Round:   29
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Sigma=-0.25..0.25, Trail=0..1
//
// Knob 1: Hue. Turns the colour of the curve round the colour wheel; at 0 it is cyan with a blue tail.
// Knob 2: Speed. How fast t climbs: at 2 the head reaches a new zero every two seconds or so, at 0.2 ten times slower.
// Knob 3: Sigma. How far the line runs from the critical line Re s = 1/2: at 0 every loop hits the origin, and off it the loops miss it to one side, wider the further you turn.
// Knob 4: Trail. How long the drawn curve stays lit: under a second at 0, about ten at the opening 0.06, half a minute at 1, when the loops stack into a rosette round the origin.
// Buttons: K1 tap sends the head racing ahead to the next zero. K2 tap starts t again from 0.

const W = 64, H = 128, N = W * H;
const { min, max, floor, exp, log, cos, sin, sqrt, hypot, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The plane turned a quarter turn: the real axis runs up the panel through
// column OX, the imaginary axis runs left, the origin sits OY rows down.
const OX = 32, OY = 92;
// LEDs to one unit at t. The loops widen with t faster than the panel does,
// so the view backs off a little as t climbs: 26 at the start, 15 by
// t = 118, which keeps most of each loop inside the side walls and still
// lets the later loops come out bigger.
const scaleAt = (t) => 26 / (1 + t / 70) ** 0.55;
// t runs from 0 to TEND and starts again. Samples are DT apart in t.
const TEND = 118, DT = 0.008, CAP = 16384;

// Euler-Maclaurin summation: the first N-1 terms of the Dirichlet series,
// the integral of the tail, and six Bernoulli corrections. With N past
// t / 2 pi the corrections shrink fast, and ten more terms make it good to
// many digits at the t this pattern reaches.
const NMAX = 64;
const LN = new Float64Array(NMAX + 1).map((_, n) => (n ? log(n) : 0));
const BF = [1 / 12, -1 / 720, 1 / 30240, -1 / 1209600, 1 / 47900160, -691 / 1307674368000];
function zeta(sr, si, out) {
  const n0 = min(NMAX - 1, floor(abs(si) / (2 * PI)) + 10);
  let zr = 0, zi = 0;
  for (let n = 1; n < n0; n++) {
    const m = exp(-sr * LN[n]), a = -si * LN[n];
    zr += m * cos(a);
    zi += m * sin(a);
  }
  // N^-s, then N^(1-s) / (s - 1) and half of N^-s.
  const L = LN[n0], m = exp(-sr * L), a = -si * L, pr = m * cos(a), pi = m * sin(a);
  const dr = sr - 1, d2 = dr * dr + si * si, nr = n0 * pr, ni = n0 * pi;
  zr += (nr * dr + ni * si) / d2 + pr / 2;
  zi += (ni * dr - nr * si) / d2 + pi / 2;
  // B2k / (2k)! times s(s+1)...(s+2k-2) times N^(-s-2k+1).
  let cr = pr / n0, ci = pi / n0, fr = sr, fi = si;
  for (let k = 0; k < 6; k++) {
    const c = BF[k];
    zr += c * (fr * cr - fi * ci);
    zi += c * (fr * ci + fi * cr);
    const a1 = sr + 2 * k + 1, a2 = sr + 2 * k + 2;
    const gr = fr * a1 - fi * si, gi = fr * si + fi * a1;
    fr = gr * a2 - gi * si;
    fi = gr * si + gi * a2;
    cr /= n0 * n0;
    ci /= n0 * n0;
  }
  out[0] = zr;
  out[1] = zi;
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const P = (params.s = {
    t: 0, acc: 0, clock: 0, sc: 26, sig: 0, n: 0, head: -1, race: 0,
    // Each sample: t, the point, sigma it was taken at, the clock, and 1 when
    // the curve breaks before it (a restart).
    T: new Float64Array(CAP), X: new Float32Array(CAP), Y: new Float32Array(CAP), S: new Float64Array(CAP),
    C: new Float32Array(CAP), B: new Uint8Array(CAP),
    fix: -1, fixN: 0, dPrev: 9, falling: 0, flashes: [], hue: 0, life: 3, z: new Float64Array(2),
    R: new Float32Array(N), G: new Float32Array(N), Bl: new Float32Array(N), col: new Float32Array(3),
    sR: new Float32Array(N), sG: new Float32Array(N), sB: new Float32Array(N), tmp: new Float32Array(N),
  });
  // The first frame already shows the curve on its way to the first zero at
  // t = 14.13: eight seconds of drawing at half the opening speed.
  for (let i = 0; i < 240; i++) step(P, 1 / 30, 1, 0, 0.06);
}

function push(P, brk) {
  zeta(0.5 + P.sig, P.t, P.z);
  const i = (P.head = (P.head + 1) % CAP);
  P.T[i] = P.t;
  P.X[i] = P.z[0];
  P.Y[i] = P.z[1];
  P.S[i] = P.sig;
  P.C[i] = P.clock;
  P.B[i] = brk;
  P.n = min(P.n + 1, CAP);
  // A pass by the origin is the moment the distance stops falling. Its
  // flash is as bright as the pass is close: full on the critical line, a
  // glimmer a few LEDs off it.
  const d = hypot(P.z[0], P.z[1]);
  if (!brk && d > P.dPrev && P.falling && P.dPrev < 0.6) {
    const j = (i + CAP - 1) % CAP, k = (i + CAP - 2) % CAP;
    const miss = segDist(P.X[k], P.Y[k], P.X[j], P.Y[j], P.X[i], P.Y[i]) * P.sc;
    const s = exp(-(miss * miss) / 3);
    if (s > 0.05) P.flashes.push([P.clock, s]);
    if (P.race && P.t > P.race) P.race = 0;
  }
  P.falling = d < P.dPrev ? 1 : 0;
  P.dPrev = brk ? 9 : d;
}

// How close the two segments a-b-c come to the origin.
function segDist(ax, ay, bx, by, cx, cy) {
  const one = (px, py, qx, qy) => {
    const dx = qx - px, dy = qy - py, l = dx * dx + dy * dy, u = l > 0 ? cl(-(px * dx + py * dy) / l, 0, 1) : 0;
    return hypot(px + u * dx, py + u * dy);
  };
  return min(one(ax, ay, bx, by), one(bx, by, cx, cy));
}

function step(P, d, speed, sig, trail) {
  P.clock += d;
  P.life = 0.8 + 29.2 * trail ** 0.4;
  P.sc += (scaleAt(P.t) - P.sc) * min(1, d * 1.5);
  if (abs(sig - P.sig) > 0.002) (P.sig = sig), (P.fix = P.head), (P.fixN = P.n);
  // t climbs a little slower as it rises, so the head's speed on the panel
  // grows only slowly while the loops widen and the zeros crowd closer.
  const rate = (speed * 1.55 * (P.race ? 10 : 1)) / (1 + P.t / 90);
  P.acc += rate * d;
  let brk = P.head < 0 ? 1 : 0;
  for (; P.acc >= DT; P.acc -= DT) {
    P.t += DT;
    if (P.t > TEND) (P.t = 0), (brk = 1), (P.race = 0);
    push(P, brk);
    brk = 0;
  }
  // The trail redraws itself at a new Sigma, newest first, a few hundred
  // samples a frame.
  if (P.fix >= 0) {
    for (let c = 0; c < 500 && P.fix >= 0; c++) {
      const i = P.fix;
      if (P.S[i] !== P.sig) {
        zeta(0.5 + P.sig, P.T[i], P.z);
        P.X[i] = P.z[0];
        P.Y[i] = P.z[1];
        P.S[i] = P.sig;
      }
      const j = (i + CAP - 1) % CAP;
      P.fix = --P.fixN > 0 && P.clock - P.C[j] < P.life ? j : -1;
    }
  }
  P.flashes = P.flashes.filter((f) => P.clock - f[0] < 1.6);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  const b = input.btnPressed || [];
  // The race runs past a zero the head is about to reach anyway and stops
  // at the one after.
  if (b[0]) P.race = P.t + 1;
  if (b[1]) (P.t = TEND + 1), (P.race = 0);
  step(P, d, cl(k[1], 0.2, 3), cl(k[2], -0.25, 0.25), cl(k[3], 0, 1));
}

// A soft dot of light, kept to the brightest of what is already there: full
// on the LED under it, fading to nothing 1.3 LEDs out, so the curve draws
// as a line a little under two LEDs wide.
function dot(P, x, y, r, g, b) {
  const cx = floor(x), cy = floor(y);
  for (let yy = cy - 1; yy <= cy + 1; yy++) {
    if (yy < 0 || yy >= H) continue;
    const dy = yy + 0.5 - y;
    for (let xx = cx - 1; xx <= cx + 1; xx++) {
      if (xx < 0 || xx >= W) continue;
      const dx = xx + 0.5 - x, w = 1.3 - sqrt(dx * dx + dy * dy);
      if (w <= 0) continue;
      const p = yy * W + xx, v = w > 1 ? 1 : w;
      if (P.R[p] < r * v) P.R[p] = r * v;
      if (P.G[p] < g * v) P.G[p] = g * v;
      if (P.Bl[p] < b * v) P.Bl[p] = b * v;
    }
  }
}
// Light added on top of the curve and its glow.
const add = (P, x, y, r, g, b) => {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = y * W + x;
  P.sR[p] += r;
  P.sG[p] += g;
  P.sB[p] += b;
};

// Two passes of a five-wide box along rows, then along columns, each a
// running sum; the panel's edges count as dark.
const GLOW = 0.6;
function box(a, o, step, n, out) {
  let v = a[o] + a[o + step] + a[o + 2 * step];
  for (let i = 0; i < n; i++) {
    out[o + i * step] = v / 5;
    if (i + 3 < n) v += a[o + (i + 3) * step];
    if (i >= 2) v -= a[o + (i - 2) * step];
  }
}
function blur(src, tmp, dst) {
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) box(pass ? dst : src, y * W, 1, W, tmp);
    for (let x = 0; x < W; x++) box(tmp, x, W, H, dst);
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const R = P.R, G = P.G, B = P.Bl, col = P.col;
  R.fill(0);
  G.fill(0);
  B.fill(0);
  // The curve, oldest first, each segment walked in steps under half an LED.
  const life = P.life;
  let n = 0;
  while (n < P.n && P.clock - P.C[(P.head + CAP - n) % CAP] < life) n++;
  let i = (P.head + CAP - n + 1) % CAP;
  for (let c = 0, px = 0, py = 0, ok = 0; c < n; c++, i = (i + 1) % CAP) {
    const age = P.clock - P.C[i];
    const x = OX + 0.5 - P.Y[i] * P.sc, y = OY + 0.5 - P.X[i] * P.sc;
    const f = 1 - age / life, v = sqrt(f);
    // Young curve is pale, then the hue, then a deeper tail.
    hsv(P.hue + 0.5 + 0.18 * (1 - f), 0.6 + 0.35 * min(1, (1 - f) * 4), v, col);
    if (ok && !P.B[i]) {
      const L = hypot(x - px, y - py), m = max(1, Math.ceil(L / 0.5));
      for (let s = 1; s <= m; s++) dot(P, px + ((x - px) * s) / m, py + ((y - py) * s) / m, col[0] * 255, col[1] * 255, col[2] * 255);
    } else dot(P, x, y, col[0] * 255, col[1] * 255, col[2] * 255);
    ok = 1;
    px = x;
    py = y;
  }
  // The curve glows: a soft blur of its own light, two box passes each
  // way, laid under it. On the panel a bare 1-LED line looks thin.
  const sR = P.sR, sG = P.sG, sB = P.sB;
  blur(R, P.tmp, sR);
  blur(G, P.tmp, sG);
  blur(B, P.tmp, sB);
  for (let p = 0; p < N; p++) (sR[p] = R[p] + sR[p] * GLOW), (sG[p] = G[p] + sG[p] * GLOW), (sB[p] = B[p] + sB[p] * GLOW);
  // The axes, dim: the real axis up the panel with a tick at each whole
  // number, and a short stub of the imaginary axis through the origin.
  for (let y = 0; y < H; y++) {
    const re = (OY - y) / P.sc, tick = abs(re - Math.round(re)) * P.sc < 0.5;
    add(P, OX, y, 14, 14, 18);
    if (tick) for (let x = -2; x <= 2; x++) if (x) add(P, OX + x, y, 16, 16, 20);
  }
  for (let x = OX - 6; x <= OX + 6; x++) if (x !== OX) add(P, x, OY, 12, 12, 16);
  // Each pass through the origin: the origin flares and a ring opens, in a
  // pale rose that stays clear of the curve's colour and never browns.
  hsv(P.hue + 0.92, 0.45, 1, col);
  const fr = col[0] * 255, fg = col[1] * 255, fb = col[2] * 255;
  for (const [c0, s] of P.flashes) {
    const a = P.clock - c0, rad = 1.5 + a * 34, v = s * exp(-a * 2);
    for (let y = max(0, floor(OY - rad - 2)); y <= min(H - 1, OY + rad + 2); y++)
      for (let x = max(0, floor(OX - rad - 2)); x <= min(W - 1, OX + rad + 2); x++) {
        const d = hypot(x - OX, y - OY), w = max(0, 1 - abs(d - rad) / 1.1) + max(0, 1 - d / 3.5) * exp(-a * 3) * 1.6;
        if (w > 0) add(P, x, y, fr * v * w, fg * v * w, fb * v * w);
      }
  }
  add(P, OX, OY, 40, 40, 44);
  // The head: white with a small glow.
  if (P.n) {
    const h = P.head, hx = OX + 0.5 - P.Y[h] * P.sc, hy = OY + 0.5 - P.X[h] * P.sc;
    for (let y = floor(hy) - 2; y <= floor(hy) + 2; y++)
      for (let x = floor(hx) - 2; x <= floor(hx) + 2; x++) {
        const d = hypot(x + 0.5 - hx, y + 0.5 - hy), w = exp(-d * d * 0.9);
        add(P, x, y, 255 * w, 250 * w, 235 * w);
      }
  }
  for (let y = 0, p = 0; y < H; y++) for (let x = 0; x < W; x++, p++) display.setPixel(x, y, min(255, sR[p]), min(255, sG[p]), min(255, sB[p]));
}
