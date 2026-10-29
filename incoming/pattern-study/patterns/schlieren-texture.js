// ===== Patternflow pattern =====
// Title:   Schlieren Texture
// Family:  physics
// Idea:    A nematic liquid crystal film between crossed polarizers, its director a line field relaxing by Ginzburg-Landau dynamics, so that disclinations of strength +1/2 and -1/2 drift together and annihilate while new pairs are let in, each half-strength core sitting on two dark brushes and each whole-strength core on four, the brushes swinging round the cores as the polarizers turn, over Michel-Levy interference colours that band in the second order down the wedge of the film and step down through the first order into every melted core.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: disinclination lines and the elastic theory of nematic liquid crystals (F. C. Frank, "On the theory of liquid crystals", 1958), Ginzburg-Landau relaxation of a complex order parameter (Vitaly Ginzburg and Lev Landau, 1950), interference colour chart (Auguste Michel-Levy, 1888), pattern round 72
// Round:   72
// ===============================
// @matrix 64x128
// @knobs Order=-1..1, Speed=0.2..3, Defects=10..30, Uncross=0..1
//
// Knob 1: Order. The film's retardation at its mean thickness, 850 + 650 Order nm. At the opening 0 it is 850 nm, and the wedge spreads it from about 620 nm at the top of the panel to 1080 nm at the bottom, the whole second order in bands: blue, cyan, green, yellow, orange, red and magenta. At -1 it is 200 nm, first-order grey and white; at -0.5, 525 nm, first-order orange and the violet of the sensitive tint; at 1, 1500 nm, the greens and pinks of the third order.
// Knob 2: Speed. The polarizers turn at 0.03 Speed radians a second, 0.06 at the opening 2, and the brushes of a half-strength core turn twice as fast, a +1/2 core's with the polarizers and a -1/2 core's against them; crossed polarizers look the same after a quarter turn, 26 s at Speed 2, 17 s at 3. The film relaxes 10 Speed time units a second: at Speed 2 a lone pair of opposite cores 20 LEDs apart meets in about 3 s, 30 LEDs apart in about 11 s, 40 apart in 23 s.
// Knob 3: Defects. The film opens with this many cores and keeps at least this many: when annihilation leaves fewer, new pairs are let in, 26 to 34 LEDs apart at the best of 14 spots away from the cores already there, up to three pairs at once and at most every 1.5 s, and the panel dissolves to them over 0.5 s. One pair in five is a +1 and a -1 with four brushes each, which come apart into half-strength cores within a few seconds. 10 at the opening, 30 at the top.
// Knob 4: Uncross. Turns the analyzer away from crossed by 90 Uncross degrees: at 0 the polarizers are crossed and the brushes black, at the opening 0.06 they are 5.4 degrees off, at 0.5 the colours have paled and the brushes gone, and at 1 the polarizers are parallel, the brushes white and the colours turned to their pale complements.

// The director n is a line field: n and -n are the same, so its angle theta
// counts only modulo pi, and a loop round a core may turn it by half a turn,
// a disclination of strength 1/2. The film is held as the complex order
// parameter psi = S e^(2 i theta), whose phase counts modulo 2 pi: a
// half-strength core is a single winding of psi, a whole-strength core a
// double one, which splits because it costs twice the energy of two singles.
// psi relaxes by d psi / dt = lap psi + a psi (1 - |psi|^2) with a = 0.15:
// the order S is below 0.5 over 4 LEDs across a core and below 0.9 over 9.
// Opposite cores attract and annihilate as the texture coarsens.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sqrt, sin, cos, atan2, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = 2 * PI;
const FADE = 0.5, GAIN = 1.4, AGL = 0.15, XI = 1 / sqrt(AGL);

// ---- Michel-Levy colours: white light through a plate of retardation G
// between crossed polarizers transmits sin^2(pi G / lambda) of each
// wavelength. Summed against the CIE 1931 matching functions (the
// multi-lobe fit of Chris Wyman, Peter-Pike Sloan and Peter Shirley, 2013)
// from 400 to 700 nm and taken to sRGB, each channel divided by white's,
// then saturated SAT times over for the panel and kept in linear light. One
// entry each 2 nm up to 2400 nm. ----
const SAT = 3, GMAX = 2400, GSTEP = 2, GN = GMAX / GSTEP + 1, ML = new Float32Array(GN * 3);
{
  const g = (l, m, a, b) => exp(-0.5 * ((l - m) / (l < m ? a : b)) ** 2);
  const L = [], C = [];
  for (let l = 400; l <= 700; l += 10) {
    L.push(l);
    const x = 1.056 * g(l, 599.8, 37.9, 31) + 0.362 * g(l, 442, 16, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
    const y = 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
    const z = 1.217 * g(l, 437, 11.8, 36) + 0.681 * g(l, 459, 26, 13.8);
    C.push([3.2406 * x - 1.5372 * y - 0.4986 * z, -0.9689 * x + 1.8758 * y + 0.0415 * z, 0.0557 * x - 0.204 * y + 1.057 * z]);
  }
  const wh = [0, 0, 0];
  for (const c of C) for (let k = 0; k < 3; k++) wh[k] += c[k];
  const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  const dec = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  for (let i = 0; i < GN; i++) {
    const G = i * GSTEP, c = [0, 0, 0];
    for (let j = 0; j < L.length; j++) {
      const s = sin((PI * G) / L[j]) ** 2;
      for (let k = 0; k < 3; k++) c[k] += C[j][k] * s;
    }
    for (let k = 0; k < 3; k++) c[k] = enc(cl(c[k] / wh[k], 0, 1));
    // Saturation (max - min) / max times SAT, hue and the brightest channel kept.
    const mx = max(c[0], c[1], c[2]), mn = min(c[0], c[1], c[2]), sa = mx > 0 ? (mx - mn) / mx : 0, k2 = sa > 0 ? min(1, sa * SAT) / sa : 1;
    for (let k = 0; k < 3; k++) ML[i * 3 + k] = dec(mx - (mx - c[k]) * k2);
  }
}
// Back to sRGB for the panel, 1024 steps of linear light.
const ENC = new Uint8Array(1025);
for (let i = 0; i <= 1024; i++) {
  const v = i / 1024;
  ENC[i] = round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
}

// The film's thickness, 1 at its mean: a wedge from 0.725 at the top to
// 1.275 at the bottom and two shallow waves of 0.05 and 0.04 across it, so
// the colours lie in wavy bands.
const D = new Float32Array(N);
for (let y = 0, p = 0; y < H; y++)
  for (let x = 0; x < W; x++, p++)
    D[p] = 1 + 0.55 * ((y - 63.5) / 127) + 0.05 * sin(0.11 * x + 0.035 * y + 1) + 0.04 * sin(0.05 * y - 0.07 * x + 2);

// A core of winding w (+-1 or +-2) at (cx, cy), multiplied into psi: its
// phase, and its order melted to the profile of a relaxed core.
function core(S, cx, cy, w) {
  const { U, V } = S, n = abs(w);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const dx = x - cx, dy = y - cy, r2 = dx * dx + dy * dy;
      const r = sqrt(r2) || 1e-6;
      let c = dx / r, s = (w < 0 ? -dy : dy) / r;
      if (n === 2) (s = 2 * c * s), (c = 2 * c * c - 1);
      // GL core profile, about r / sqrt(r^2 + 2 xi^2), n times over.
      const f = (r / sqrt(r2 + 2 * XI * XI)) ** n;
      const u = U[p], v = V[p];
      U[p] = (u * c - v * s) * f;
      V[p] = (u * s + v * c) * f;
    }
}

// Where the cores are: winding of psi round each 2 by 2 square.
function census(S) {
  const { U, V, A } = S;
  for (let p = 0; p < N; p++) A[p] = atan2(V[p], U[p]);
  const wrap = (d) => (d > PI ? d - TAU : d < -PI ? d + TAU : d);
  const list = [];
  let count = 0;
  for (let y = 0; y < H - 1; y++)
    for (let x = 0; x < W - 1; x++) {
      const p = y * W + x, a = A[p], b = A[p + 1], c = A[p + W + 1], d = A[p + W];
      const w = round((wrap(b - a) + wrap(c - b) + wrap(d - c) + wrap(a - d)) / TAU);
      if (w) {
        list.push(x + 0.5, y + 0.5);
        count += abs(w);
      }
    }
  S.cores = list;
  S.count = count;
}

// A spot for a pair: of 14 tries, the one furthest from the cores there.
function spot(S, sep) {
  let best = null, bd = -1;
  for (let t = 0; t < 14; t++) {
    const an = Math.random() * PI, hx = 0.5 * sep * cos(an), hy = 0.5 * sep * sin(an);
    const cx = 8 + abs(hx) + Math.random() * (48 - 2 * abs(hx)), cy = 8 + abs(hy) + Math.random() * (112 - 2 * abs(hy));
    let d = 1e9;
    for (let i = 0; i < S.cores.length; i += 2)
      for (const e of [-1, 1]) d = min(d, (S.cores[i] - cx - e * hx) ** 2 + (S.cores[i + 1] - cy - e * hy) ** 2);
    if (d > bd) (bd = d), (best = [cx - hx, cy - hy, cx + hx, cy + hy]);
  }
  return best;
}

function pair(S) {
  const w = Math.random() < 0.2 ? 2 : 1, q = spot(S, 26 + Math.random() * 8);
  core(S, q[0], q[1], w);
  core(S, q[2], q[3], -w);
}

// Relax psi by time t in Euler steps of at most 0.2 (stable below 0.25),
// walls with no flux through them.
function relax(S, t) {
  const n = Math.ceil(t / 0.2 - 1e-9);
  if (n <= 0) return;
  const h = t / n;
  let { U, V, U2, V2 } = S;
  for (let k = 0; k < n; k++) {
    for (let y = 0, p = 0; y < H; y++) {
      const up = y > 0 ? -W : 0, dn = y < H - 1 ? W : 0;
      for (let x = 0; x < W; x++, p++) {
        const lf = x > 0 ? -1 : 0, rt = x < W - 1 ? 1 : 0, u = U[p], v = V[p];
        const lu = U[p + lf] + U[p + rt] + U[p + up] + U[p + dn] - 4 * u;
        const lv = V[p + lf] + V[p + rt] + V[p + up] + V[p + dn] - 4 * v;
        const g = AGL * (1 - u * u - v * v);
        U2[p] = u + h * (lu + g * u);
        V2[p] = v + h * (lv + g * v);
      }
    }
    const tu = U, tv = V;
    (U = U2), (V = V2), (U2 = tu), (V2 = tv);
  }
  S.U = U;
  S.V = V;
  S.U2 = U2;
  S.V2 = V2;
}

// The opening film: n cores of alternating sign, no two closer than the
// spacing allows, on a gently twisted background, relaxed 8 time units.
function seed(S, n) {
  const { U, V } = S;
  const k1 = Math.random() * TAU, k2 = Math.random() * TAU;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const ph = 0.15 * sin(0.045 * x + 0.03 * y + k1) + 0.1 * sin(0.02 * x - 0.04 * y + k2);
      U[p] = cos(ph);
      V[p] = sin(ph);
    }
  const pts = [];
  let dmin = 0.75 * sqrt(N / n), tries = 0;
  while (pts.length < 2 * n) {
    const x = 6 + Math.random() * 52, y = 6 + Math.random() * 116;
    if (++tries > 400) (dmin *= 0.9), (tries = 0);
    let ok = true;
    for (let i = 0; i < pts.length && ok; i += 2) ok = (pts[i] - x) ** 2 + (pts[i + 1] - y) ** 2 >= dmin * dmin;
    if (ok) pts.push(x, y);
  }
  for (let i = 0; i < n; i++) core(S, pts[2 * i], pts[2 * i + 1], i & 1 ? -1 : 1);
  relax(S, 8);
  census(S);
}

export function setup(params) {
  params.s = {
    U: new Float32Array(N), V: new Float32Array(N), U2: new Float32Array(N), V2: new Float32Array(N), A: new Float32Array(N),
    LAST: new Uint8Array(N * 3), OLD: new Uint8Array(N * 3), fade: 9,
    order: 0, speed: 2, want: 10, uncross: 0.06, phi: 0.3, t: 0, frame: 0, lastPair: -9, cores: [], count: 0, seeded: false,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 10, 0.06], d = cl(dt || 0, 0, 0.1);
  S.order = cl(k[0], -1, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.want = round(cl(k[2], 10, 30));
  S.uncross = cl(k[3], 0, 1);
  if (!S.seeded) {
    seed(S, S.want + (S.want & 1));
    S.seeded = true;
  }
  S.t += d;
  S.fade += d;
  S.phi += d * 0.03 * S.speed;
  relax(S, d * 10 * S.speed);
  if (++S.frame % 6 === 0) census(S);
  if (S.count < S.want && S.t - S.lastPair > 1.5) {
    // Enough pairs at once to make up the count, three at most, and the
    // panel dissolves from the last frame to the film with them over FADE
    // seconds.
    for (let m = min(3, Math.ceil((S.want - S.count) / 2)); m > 0; m--) {
      pair(S);
      census(S);
    }
    S.lastPair = S.t;
    S.OLD.set(S.LAST);
    S.fade = 0;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.seeded) {
    for (let p = 0; p < N; p++) display.setPixel(p & 63, p >> 6, 0, 0, 0);
    return;
  }
  const { U, V, OLD, LAST } = S, G0 = 850 + 650 * S.order, w0 = min(1, S.fade / FADE), w = w0 * w0 * (3 - 2 * w0);
  // Polarizer at phi, analyzer at phi + 90 (1 - Uncross) degrees. A plate
  // with its axis at theta passes cos^2(A - P) - sin 2(theta - P)
  // sin 2(theta - A) times sin^2(pi G / lambda) of the light: with the
  // polarizers crossed, sin^2 2(theta - P) of the colour, black where the
  // director lies along either polarizer. Mixed in linear light, then
  // encoded for the panel.
  const P = S.phi, A = P + (PI / 2) * (1 - S.uncross);
  const c2p = cos(2 * P), s2p = sin(2 * P), c2a = cos(2 * A), s2a = sin(2 * A), base = cos(A - P) ** 2;
  for (let p = 0; p < N; p++) {
    const u = U[p], v = V[p], r = sqrt(u * u + v * v), Sq = min(1, r), iv = r > 1e-9 ? 1 / r : 0;
    const c = u * iv, s = v * iv; // cos and sin of 2 theta
    const kP = s * c2p - c * s2p, kA = s * c2a - c * s2a;
    // Retardation d S: toward a core the colours step down through the
    // orders to first-order grey, and the light fades as S^3 into it.
    const G = G0 * D[p] * Sq;
    const gi = min(GN - 2, G / GSTEP), i0 = floor(gi), f = gi - i0, o = i0 * 3;
    const m = Sq * Sq * Sq * 1024 * GAIN, t = -kP * kA;
    const R = (base + t * (ML[o] + f * (ML[o + 3] - ML[o]))) * m;
    const Gc = (base + t * (ML[o + 1] + f * (ML[o + 4] - ML[o + 1]))) * m;
    const B = (base + t * (ML[o + 2] + f * (ML[o + 5] - ML[o + 2]))) * m;
    // Exposed GAIN times over: a channel past full scales the three down
    // together, so the hue holds.
    const q = max(1024, R, Gc, B) / 1024, o3 = p * 3;
    let r8 = ENC[cl((R / q) | 0, 0, 1024)], g8 = ENC[cl((Gc / q) | 0, 0, 1024)], b8 = ENC[cl((B / q) | 0, 0, 1024)];
    if (w < 1) {
      r8 = round(OLD[o3] + (r8 - OLD[o3]) * w);
      g8 = round(OLD[o3 + 1] + (g8 - OLD[o3 + 1]) * w);
      b8 = round(OLD[o3 + 2] + (b8 - OLD[o3 + 2]) * w);
    }
    LAST[o3] = r8;
    LAST[o3 + 1] = g8;
    LAST[o3 + 2] = b8;
    display.setPixel(p & 63, p >> 6, r8, g8, b8);
  }
}
