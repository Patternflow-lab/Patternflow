// ===== Patternflow pattern =====
// Title:   Decision Boundary
// Family:  learning
// Idea:    A small neural network learns, step after step, to tell two drifting classes of dots apart, and the panel is the plane it is classifying: two dim coloured territories, a bright two-LED contour where the net is torn between them, and dots that flash a pale ring when the net has them on the wrong side, while the data morphs from crescents to rings, spirals and clusters and the frontier keeps tonguing in, pinching off islands and merging again.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the multilayer net trained by back-propagation (David Rumelhart, Geoffrey Hinton and Ronald Williams, 1986) from the perceptron (Frank Rosenblatt, 1958), the optimiser Adam (Diederik Kingma and Jimmy Ba, 2014), the two-moons and two-spirals toy problems and the 2D decision-surface picture of A Neural Network Playground (Daniel Smilkov and Shan Carter, 2016), and concept drift in online learning (Jeffrey Schlimmer and Richard Granger, 1986); from memory; pattern round 217
// Round:   219
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=0..4, Width=-1..1, Drift=-1..1
//
// Knob 1: Hue. Turns the palette along the arc from green through teal, blue, violet and magenta to crimson, which skips the yellows and oranges that go brown when dim. It opens on a teal territory against a rose one, the other colour always 0.58 of the arc on, and the contour and the dots take their tint from the two. The palette also wanders half the arc either way by itself, on sines of 191, 97 and 54 s, so the pair is never the same twice.
// Knob 2: Rate. The learning rate of Adam, 14 steps a frame of 24 dots each: 0.0003 at 0, 0.012 at 2 where it opens and 0.1 at 4. At 0 the boundary is sluggish, it hangs behind the data and about 14 percent of the dots flash as wrong against 7 where it opens; at 4 it keeps overshooting, the frontier shivers and swaps lobes from one frame to the next.
// Knob 3: Width. How much of the net is alive, from 2.5 hidden units a layer at -1 to 16 at 1 (11 where it opens), the last one fading in, with the L2 penalty falling from 0.009 to 0.0012. A narrow net can bend only one smooth frontier through the dots, and a ring can not be cut from its blob by a line at all, and about a quarter of the dots are wrong; a wide one wraps every group, runs fans into the gaps and pinches off islands round the stray dots.
// Knob 4: Drift. How fast the data morphs and how much it is scattered: the morph clock runs at 0.44 at -1, 1.4 where it opens and 3.9 at 1, the scatter of the dots grows from 0.35 to 1.15 of its base, and up to 7 percent of the dots carry the wrong label (2 where it opens), so the classes overlap and the net has to give some dots up.

// What the picture is. A net of 2 -> 16 -> 16 -> 1, tanh in the hidden layers and a sigmoid at the end, takes a point (u, v) of the plane, the
// unit square stretched over the 64 by 128 panel, and answers p, the chance it is class B. It is trained on the dots the panel shows, 14
// steps of Adam a frame (420 a second) on batches of 24 dots, each moved by a small fresh jitter so it is a stream of samples and not the same
// 68 points again; gradients are clipped to a length of 2.5, every weight stays within 5, a unit stuck at one end of its tanh is dealt a
// fresh start, and a weight that ever goes non-finite sends its whole layer back to a fresh start. The data does not hold still. 34 dots of
// each class sit on one of six generators, crescents that slide through each other, a ring round a blob, a two-armed spiral that winds up,
// four clusters on a cross, three wavy bands and a necklace of six clusters, the classes alternating round it. The generator that is showing
// is moved into the next one, picked at random, over 16 to 26 seconds at the opening drift, by sliding every dot along the straight line
// from where it sits in the one to where it sits in the other, each shape's own sizes and angles wandering on sines of 47 to 157 s. Every dot
// keeps its class and its place along its curve, so a morph is a dot going somewhere, and the net has to follow. No two dots sit closer than
// 4.6 LEDs, so each is a clean dot. The first update runs 1600 steps, and again from a fresh net up to twice if the dots are not learned,
// so the picture opens on a learned boundary.
// The picture is p on the panel, evaluated on a grid of every second LED, 33 by 65 nodes, with the logit z = log(p / (1 - p)) and its
// gradient kept and blended up to every LED. The contour is not a threshold: d = |z| / |grad z| is the distance in LEDs to z = 0, so
// the line is 2 LEDs wide however steep or shallow the net is there, and it glows out to about 5. The territory is a dim fill, brighter the
// surer the net is, so each frontier sits in a dark valley, with a faint echo of the contour running out from it.

const W = 64;
const H = 128;
const { floor, sqrt, exp, log, sin, cos, PI, abs, min, max, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the net: 2 -> 16 -> 16 -> 1
const NH = 16;
const O_W1 = 0; // 16 x 2
const O_B1 = 32;
const O_W2 = 48; // 16 x 16, row = output unit
const O_B2 = 304;
const O_W3 = 320;
const O_B3 = 336;
const NP = 337;
const WMAX = 5; // no weight leaves this, so the net can not blow up
const B1 = 0.9;
const B2 = 0.99;
const EPS = 1e-6;
const BATCH = 24;
const STEPS_PER_S = 420;
const CLIP = 2.5; // largest gradient norm

// tanh from a table, the same one for training and for drawing
const TN = 2048;
const TR = 6;
const TAB = new Float64Array(TN + 2);
for (let i = 0; i < TN + 2; i++) TAB[i] = Math.tanh((i / TN) * 2 * TR - TR);
function th(x) {
  if (x >= TR) return 1;
  if (x <= -TR) return -1;
  const f = (x + TR) * (TN / (2 * TR));
  const i = f | 0;
  return TAB[i] + (TAB[i + 1] - TAB[i]) * (f - i);
}

// ---- the data
const N = 68;
const NC = N / 2;
const RMIN = 4.6; // the closest two dots may sit, in LEDs
const NMODE = 6;
const NODES_X = 33;
const NODES_Y = 65;
const NODES = NODES_X * NODES_Y;

function gauss() {
  const a = 1 - Math.random();
  return sqrt(-2 * log(a)) * cos(TAU * Math.random());
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The five generators. Each puts dot i, with its class c, its place u along its curve and its fixed randoms r1, r2, nx, ny, at o[0], o[1]
// in the unit square. S.q holds the wandering sizes, each between -1 and 1, S.ang the angle the whole layout is turned by, S.sc the scatter.
function shape(S, m, i, o) {
  const c = S.cls[i], u = S.U[i], r1 = S.R1[i], r2 = S.R2[i], nx = S.NX[i], ny = S.NY[i], q = S.q, sc = S.sc;
  let x = 0, y = 0;
  if (m === 0) {
    // two crescents, each cupping the tip of the other, sliding and parting as d and g wander
    const R = 0.46 + 0.05 * q[0], d = R * (1.05 + 0.25 * q[1]), g = R * (0.3 + 0.2 * q[2]), a = PI * u;
    if (c === 0) (x = R * cos(a)), (y = R * sin(a));
    else (x = d - R * cos(a)), (y = g - R * sin(a));
    x -= d / 2;
    y -= g / 2;
    x += nx * 0.05 * sc;
    y += ny * 0.05 * sc;
    rot(S.ang, x, y, o);
  } else if (m === 1) {
    // a lobed ring round a blob that swells, drifts off centre and splits in two and runs together again
    const Rr = 0.8 + 0.1 * q[3], e = 0.14 * q[7], sg = 0.13 + 0.02 * q[4];
    if (c === 0) {
      const a = TAU * u, wob = 1 + 0.1 * q[6] * cos(2 * a + 1 + S.ang) + 0.07 * q[2] * cos(3 * a + 2 * S.ang), r = Rr * wob * (1 + 0.035 * sc * nx);
      x = r * (1 + e) * cos(a);
      y = (r / (1 + e)) * sin(a);
    } else {
      const off = 0.15 * q[5], sep = 0.15 * (1 + q[1]), side = r2 < 0.5 ? -1 : 1, ph = 1.57 + 0.5 * q[0];
      x = off + side * sep * 0.6 * cos(ph) + sg * (0.9 + 0.1 * sc) * nx * (1 + e);
      y = 0.5 * off * q[6] + side * sep * sin(ph) + (sg * (0.9 + 0.1 * sc) * ny) / (1 + e);
    }
    rot(S.ang * 0.5, x, y, o);
    return;
  } else if (m === 2) {
    // two arms of a spiral that wind up and unwind
    const T = 0.52 + 0.15 * q[3], r = 0.2 + 0.72 * u, a = c * PI + TAU * T * u;
    x = r * cos(a) + nx * 0.04 * sc;
    y = r * sin(a) + ny * 0.04 * sc;
    rot(S.ang, x, y, o);
    return;
  } else if (m === 3) {
    // four clusters on a cross, the same class on the diagonal, breathing in and out
    const a = 0.4 + 0.1 * (q[4] + 1), b = 0.45 + 0.125 * (q[5] + 1), s = r1 < 0.5 ? -1 : 1, sg = 0.115 * sc;
    x = s * a + nx * sg;
    y = (c === 0 ? s : -s) * b + ny * sg;
    rot(S.ang, x, y, o);
    return;
  } else if (m === 5) {
    // a necklace of six clusters round an ellipse, the same class every other one, turning and breathing, so the two classes alternate
    // round the ring and the frontier has to run between every pair
    const j = r1 < 0.34 ? 0 : r1 < 0.67 ? 1 : 2, k = c + 2 * j, rho = 0.64 + 0.1 * q[5];
    const a = TAU * ((k + 0.2 * sin(S.qw[6] * 2.3 * S.tau + k * 1.7)) / 6) + S.ang * 1.6;
    x = rho * cos(a) + nx * 0.1 * sc;
    y = rho * 1.15 * sin(a) + ny * 0.058 * sc;
    o[0] = x;
    o[1] = y;
    return;
  } else {
    // three wavy bands, the middle one the one class, the two outer ones the other
    const A = 0.08 + 0.07 * (q[6] + 1), k = TAU * (0.7 + 0.25 * q[1]), ph = S.tau * 0.11 + 1.3 * q[2];
    x = 0.8 * (2 * u - 1);
    if (c === 1) y = (r1 - 0.5) * 0.4;
    else y = (r2 < 0.5 ? 1 : -1) * (0.46 + 0.28 * r1);
    y += A * sin(k * x + ph) + ny * 0.03 * sc;
    x += nx * 0.02 * sc;
    rot(S.ang * 0.3, x, y, o);
    return;
  }
}

function rot(a, x, y, o) {
  const ca = cos(a), sa = sin(a);
  o[0] = x * ca - y * sa;
  o[1] = x * sa + y * ca;
}

function makeState() {
  const S = {
    t: 0, tau: 0, ready: false, th: new Float64Array(NP), m: new Float64Array(NP), v: new Float64Array(NP), g: new Float64Array(NP),
    adamT: 0, b1p: 1, b2p: 1, acc: 0,
    n: 9.25, g1: new Float64Array(NH), g2: new Float64Array(NH),
    cls: new Uint8Array(N), lab: new Uint8Array(N), flip: new Float32Array(N),
    U: new Float32Array(N), R1: new Float32Array(N), R2: new Float32Array(N), NX: new Float32Array(N), NY: new Float32Array(N),
    px: new Float32Array(N), py: new Float32Array(N), z: new Float32Array(N), wr: new Float32Array(N),
    q: new Float64Array(8), qw: new Float64Array(8), qp: new Float64Array(8), qs: new Float64Array(8),
    ang: 0, sc: 1, pflip: 0.0,
    modeA: 0, modeB: 1, prog: 0, hold: 8, dur: 28, moving: false, last: -1,
    sp: 1,
    // net scratch
    a1: new Float64Array(NH), t1: new Float64Array(NH), a2: new Float64Array(NH), t2: new Float64Array(NH),
    d2: new Float64Array(NH), d1: new Float64Array(NH), e1: new Float64Array(NH).fill(0.4), e2: new Float64Array(NH).fill(0.4),
    s1: new Float64Array(NH), s2: new Float64Array(NH),
    ax: new Float64Array(NH * NODES_X), ay: new Float64Array(NH * NODES_Y),
    Z: new Float32Array(NODES), GX: new Float32Array(NODES), GY: new Float32Array(NODES),
    cA: new Float64Array(3), cB: new Float64Array(3), dA: new Float64Array(3), dB: new Float64Array(3), buf: new Float32Array(W * H * 3), ring: new Float32Array(W * H),
    po: new Float64Array(2), pq: new Float64Array(2),
    hueA: 0.49, lr: 0.0127, lam: 0.005, jit: 0.03, k4: 0.06,
  };
  // dots: each class spread evenly along its curve, with a little shake
  for (let i = 0; i < N; i++) {
    const c = i < NC ? 0 : 1, k = c === 0 ? i : i - NC;
    S.cls[i] = c;
    S.U[i] = (k + 0.15 + 0.7 * Math.random()) / NC;
    S.R1[i] = Math.random();
    S.R2[i] = Math.random();
    S.NX[i] = gauss();
    S.NY[i] = gauss();
    S.flip[i] = Math.random();
  }
  // wandering sizes: periods 47 to 131 s, none a multiple of another
  const P = [53.1, 71.7, 89.3, 113.9, 47.9, 131.3, 61.3, 97.1];
  const q0 = [0.2, 0.15, 0.1, 0.0, 0.1, -0.2, 0.3, 0.1];
  for (let k = 0; k < 8; k++) {
    S.qw[k] = TAU / P[k];
    S.qp[k] = Math.asin(q0[k]);
  }
  initLayer(S, 0);
  initLayer(S, 1);
  initLayer(S, 2);
  return S;
}

function initLayer(S, L) {
  const th = S.th, m = S.m, v = S.v;
  if (L === 0) {
    for (let k = 0; k < NH; k++) {
      th[O_W1 + 2 * k] = 1.7 * gauss();
      th[O_W1 + 2 * k + 1] = 1.7 * gauss();
      th[O_B1 + k] = 1.4 * (2 * Math.random() - 1);
    }
    for (let j = O_W1; j < O_B1 + NH; j++) (m[j] = 0), (v[j] = 0);
  } else if (L === 1) {
    for (let k = 0; k < NH; k++) {
      for (let j = 0; j < NH; j++) th[O_W2 + k * NH + j] = (1.1 / 4) * gauss();
      th[O_B2 + k] = 0.2 * gauss();
    }
    for (let j = O_W2; j < O_B2 + NH; j++) (m[j] = 0), (v[j] = 0);
  } else {
    for (let k = 0; k < NH; k++) th[O_W3 + k] = 0.7 * gauss();
    th[O_B3] = 0;
    for (let j = O_W3; j < NP; j++) (m[j] = 0), (v[j] = 0);
  }
}

// ---- the data clock: where the dots are
function wander(S) {
  const tau = S.tau;
  for (let k = 0; k < 8; k++) S.q[k] = sin(S.qw[k] * tau + S.qp[k]);
  S.ang = 0.75 * sin((TAU * tau) / 157.3 + 0.05) + 0.45 * sin((TAU * tau) / 61.7 + 0.15);
  S.sc = 0.35 + 0.8 * ((S.k4 + 1) / 2);
}

function advanceModes(S, d) {
  if (!S.moving) {
    S.hold -= d;
    if (S.hold <= 0) {
      let nb;
      do nb = floor(Math.random() * NMODE);
      while (nb === S.modeA || nb === S.last);
      S.modeB = nb;
      S.dur = 22 + 14 * Math.random();
      S.prog = 0;
      S.moving = true;
    }
  } else {
    S.prog += d / S.dur;
    if (S.prog >= 1) {
      S.last = S.modeA;
      S.modeA = S.modeB;
      S.prog = 0;
      S.moving = false;
      S.hold = 4 + 8 * Math.random();
    }
  }
}

function place(S) {
  const o = S.po, p = S.pq, k = S.moving ? sm(0, 1, S.prog) : 0;
  const lim = S.pflip;
  for (let i = 0; i < N; i++) {
    shape(S, S.modeA, i, o);
    let x = o[0], y = o[1];
    if (k > 0) {
      shape(S, S.modeB, i, p);
      x += (p[0] - x) * k;
      y += (p[1] - y) * k;
    }
    S.px[i] = x;
    S.py[i] = y;
    S.lab[i] = S.flip[i] < lim ? 1 - S.cls[i] : S.cls[i];
  }
  // no two dots closer than RMIN LEDs: a few passes of pushing the close pairs apart, so a dot is always a clean dot
  const px = S.px, py = S.py;
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        let dx = (px[j] - px[i]) * 32, dy = (py[j] - py[i]) * 64;
        const d2 = dx * dx + dy * dy;
        if (d2 >= RMIN * RMIN) continue;
        let d = sqrt(d2);
        if (d < 1e-3) (dx = cos(i * 2.4)), (dy = sin(i * 2.4)), (d = 1);
        const push = ((RMIN - d) * 0.5 * 0.75) / d;
        px[i] -= (dx * push) / 32;
        py[i] -= (dy * push) / 64;
        px[j] += (dx * push) / 32;
        py[j] += (dy * push) / 64;
      }
    }
  }
}

// ---- the net
function gates(S) {
  for (let k = 0; k < NH; k++) {
    const g = cl(S.n - k, 0, 1);
    S.g1[k] = g;
    S.g2[k] = g;
  }
}

function trainStep(S, lr, lam, jit) {
  const w0 = S.th, g = S.g, a1 = S.a1, t1 = S.t1, a2 = S.a2, t2 = S.t2, d2 = S.d2, d1 = S.d1, g1 = S.g1, g2 = S.g2;
  const live = min(NH, Math.ceil(S.n));
  g.fill(0);
  S.s1.fill(0);
  S.s2.fill(0);
  const inv = 1 / BATCH;
  for (let b = 0; b < BATCH; b++) {
    const i = (Math.random() * N) | 0;
    const u = S.px[i] + jit * gauss(), v = S.py[i] + jit * gauss();
    const y = S.lab[i] ? 0.975 : 0.025;
    for (let k = 0; k < live; k++) {
      const t = th(w0[O_W1 + 2 * k] * u + w0[O_W1 + 2 * k + 1] * v + w0[O_B1 + k]);
      t1[k] = t;
      a1[k] = g1[k] * t;
    }
    let z = w0[O_B3];
    for (let j = 0; j < live; j++) {
      let h = w0[O_B2 + j];
      const row = O_W2 + j * NH;
      for (let k = 0; k < live; k++) h += w0[row + k] * a1[k];
      const t = th(h);
      t2[j] = t;
      a2[j] = g2[j] * t;
      z += w0[O_W3 + j] * a2[j];
    }
    for (let k = 0; k < live; k++) {
      S.s1[k] += 1 - t1[k] * t1[k];
      S.s2[k] += 1 - t2[k] * t2[k];
    }
    const dz = ((1 / (1 + exp(-z))) - y) * inv;
    g[O_B3] += dz;
    for (let k = 0; k < live; k++) d1[k] = 0;
    for (let j = 0; j < live; j++) {
      g[O_W3 + j] += dz * a2[j];
      const dh = dz * w0[O_W3 + j] * g2[j] * (1 - t2[j] * t2[j]);
      d2[j] = dh;
      g[O_B2 + j] += dh;
      const row = O_W2 + j * NH;
      for (let k = 0; k < live; k++) {
        g[row + k] += dh * a1[k];
        d1[k] += dh * w0[row + k];
      }
    }
    for (let k = 0; k < live; k++) {
      const dh = d1[k] * g1[k] * (1 - t1[k] * t1[k]);
      g[O_W1 + 2 * k] += dh * u;
      g[O_W1 + 2 * k + 1] += dh * v;
      g[O_B1 + k] += dh;
    }
  }
  // a unit whose slope has been near zero on every dot for a while is stuck at one end of its tanh and can not learn: deal it a fresh start
  for (let k = 0; k < live; k++) {
    S.e1[k] += (S.s1[k] * inv - S.e1[k]) * 0.02;
    S.e2[k] += (S.s2[k] * inv - S.e2[k]) * 0.02;
    if (S.e1[k] < 0.04) {
      w0[O_W1 + 2 * k] = 1.7 * gauss();
      w0[O_W1 + 2 * k + 1] = 1.7 * gauss();
      w0[O_B1 + k] = 1.4 * (2 * Math.random() - 1);
      S.m[O_W1 + 2 * k] = S.m[O_W1 + 2 * k + 1] = S.m[O_B1 + k] = 0;
      S.v[O_W1 + 2 * k] = S.v[O_W1 + 2 * k + 1] = S.v[O_B1 + k] = 0;
      S.e1[k] = 0.4;
    }
    if (S.e2[k] < 0.04) {
      for (let j = 0; j < NH; j++) (w0[O_W2 + k * NH + j] = 0.28 * gauss()), (S.m[O_W2 + k * NH + j] = 0), (S.v[O_W2 + k * NH + j] = 0);
      w0[O_B2 + k] = 0.2 * gauss();
      w0[O_W3 + k] = 0.2 * gauss();
      S.m[O_B2 + k] = S.v[O_B2 + k] = S.m[O_W3 + k] = S.v[O_W3 + k] = 0;
      S.e2[k] = 0.4;
    }
  }
  // L2 on the weights of live units
  for (let k = 0; k < live; k++) {
    g[O_W1 + 2 * k] += lam * w0[O_W1 + 2 * k] * g1[k];
    g[O_W1 + 2 * k + 1] += lam * w0[O_W1 + 2 * k + 1] * g1[k];
    g[O_W3 + k] += lam * w0[O_W3 + k] * g2[k];
    for (let j = 0; j < live; j++) g[O_W2 + k * NH + j] += lam * w0[O_W2 + k * NH + j] * g2[k] * g1[j];
  }
  // clip the gradient's length
  let nn = 0;
  for (let j = 0; j < NP; j++) nn += g[j] * g[j];
  nn = sqrt(nn);
  const sc = nn > CLIP ? CLIP / nn : 1;
  S.adamT++;
  S.b1p *= B1;
  S.b2p *= B2;
  const c1 = 1 / (1 - S.b1p), c2 = 1 / (1 - S.b2p);
  const m = S.m, vv = S.v;
  let bad0 = false, bad1 = false, bad2 = false;
  for (let j = 0; j < NP; j++) {
    const gj = g[j] * sc;
    const mj = (m[j] = B1 * m[j] + (1 - B1) * gj);
    const vj = (vv[j] = B2 * vv[j] + (1 - B2) * gj * gj);
    let w = w0[j] - (lr * (mj * c1)) / (sqrt(vj * c2) + EPS);
    if (!(abs(w) <= WMAX)) {
      if (w !== w || abs(w) === Infinity) {
        if (j < O_W2) bad0 = true;
        else if (j < O_W3) bad1 = true;
        else bad2 = true;
        w = 0;
      } else w = w > 0 ? WMAX : -WMAX;
    }
    w0[j] = w;
  }
  if (bad0) initLayer(S, 0);
  if (bad1) initLayer(S, 1);
  if (bad2) initLayer(S, 2);
}

// the logit at one point
function logit(S, u, v) {
  const th_w = S.th, live = min(NH, Math.ceil(S.n)), a1 = S.a1, g1 = S.g1, g2 = S.g2;
  for (let k = 0; k < live; k++) a1[k] = g1[k] * th(th_w[O_W1 + 2 * k] * u + th_w[O_W1 + 2 * k + 1] * v + th_w[O_B1 + k]);
  let z = th_w[O_B3];
  for (let j = 0; j < live; j++) {
    let h = th_w[O_B2 + j];
    const row = O_W2 + j * NH;
    for (let k = 0; k < live; k++) h += th_w[row + k] * a1[k];
    z += th_w[O_W3 + j] * g2[j] * th(h);
  }
  return z;
}

// the logit on the grid of every second LED, 33 x 65 nodes, and its gradient in logit per LED
function evalGrid(S) {
  const t = S.th, live = min(NH, Math.ceil(S.n)), a1 = S.a1, g1 = S.g1, g2 = S.g2, ax = S.ax, ay = S.ay, Z = S.Z;
  for (let k = 0; k < live; k++) {
    const wx = t[O_W1 + 2 * k], wy = t[O_W1 + 2 * k + 1], b = t[O_B1 + k];
    for (let i = 0; i < NODES_X; i++) ax[k * NODES_X + i] = wx * ((2 * i - 31.5) / 32) + b;
    for (let j = 0; j < NODES_Y; j++) ay[k * NODES_Y + j] = wy * ((2 * j - 63.5) / 64);
  }
  const b3 = t[O_B3];
  for (let j = 0; j < NODES_Y; j++) {
    for (let i = 0; i < NODES_X; i++) {
      for (let k = 0; k < live; k++) a1[k] = g1[k] * th(ax[k * NODES_X + i] + ay[k * NODES_Y + j]);
      let z = b3;
      for (let m = 0; m < live; m++) {
        let h = t[O_B2 + m];
        const row = O_W2 + m * NH;
        for (let k = 0; k < live; k++) h += t[row + k] * a1[k];
        z += t[O_W3 + m] * g2[m] * th(h);
      }
      Z[j * NODES_X + i] = z;
    }
  }
  // central differences, in logit per LED (nodes are 2 LEDs apart)
  const GX = S.GX, GY = S.GY;
  for (let j = 0; j < NODES_Y; j++) {
    const j0 = j > 0 ? j - 1 : j, j1 = j < NODES_Y - 1 ? j + 1 : j;
    for (let i = 0; i < NODES_X; i++) {
      const i0 = i > 0 ? i - 1 : i, i1 = i < NODES_X - 1 ? i + 1 : i;
      GX[j * NODES_X + i] = (Z[j * NODES_X + i1] - Z[j * NODES_X + i0]) / (2 * (i1 - i0));
      GY[j * NODES_X + i] = (Z[j1 * NODES_X + i] - Z[j0 * NODES_X + i]) / (2 * (j1 - j0));
    }
  }
}

// the two territory colours at full value: hue h for class A and hue h + 0.58 round the allowed arc for class B. The arc runs from green
// through teal, blue, violet and magenta to a crimson, 0.34 to 1.0 of the wheel, because dim yellows, oranges and light greens go
// brown or olive on the panel
function colours(S, k1) {
  const x = (((k1 + 0.227) % 1) + 1) % 1;
  S.hueA = 0.34 + 0.66 * x;
  S.hueB = 0.34 + 0.66 * ((x + 0.58) % 1);
  hsv(S.hueA, 0.64, 1, S.cA);
  hsv(S.hueB, 0.64, 1, S.cB);
  hsv(S.hueA, 0.8, 1, S.dA);
  hsv(S.hueB, 0.8, 1, S.dB);
}

export function setup(params) {
  params.s = makeState();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const k1 = cl(kn[0], 0, 1), k2 = cl(kn[1], 0, 4), k3 = cl(kn[2], -1, 1), k4 = cl(kn[3], -1, 1);
  const wn = (k3 + 1) / 2;
  S.k4 = k4;
  // the palette also drifts round its arc on its own, half of it either way, from where the knob has it
  colours(S, k1 + 0.26 * sin((TAU * S.t) / 191.3) + 0.16 * sin((TAU * S.t) / 97.1) + 0.1 * sin((TAU * S.t) / 53.9));
  S.lr = k2 <= 2 ? 0.0003 * pow(0.012 / 0.0003, k2 / 2) : 0.012 * pow(0.1 / 0.012, (k2 - 2) / 2);
  S.lam = 0.0012 + 0.008 * pow(1 - wn, 2);
  S.jit = 0.02 + 0.03 * pow(1 - wn, 1.5);
  S.pflip = 0.07 * pow((k4 + 1) / 2, 2);
  const target = 2.5 + 13.5 * pow(wn, 0.65);
  if (!S.ready) S.n = target;
  else S.n += (target - S.n) * (1 - exp(-d / 0.25));
  gates(S);
  S.sp = 1.4 * pow(3, k4 - 0.06);
  S.t += d;
  S.tau += d * S.sp;
  advanceModes(S, d * S.sp);
  wander(S);
  place(S);
  if (!S.ready) {
    // warm start: a few hundred quick steps so the first frame already shows a learned boundary
    // a net can settle on a straight line where the dots want a bend, so a start that has not learned them is thrown away and tried again, up to three times, and the best is kept
    let flipped = 0;
    for (let i = 0; i < N; i++) if (S.lab[i] !== S.cls[i]) flipped++;
    const best = new Float64Array(NP);
    let bestAcc = -1;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        for (let L = 0; L < 3; L++) initLayer(S, L);
        S.adamT = 0;
        S.b1p = S.b2p = 1;
      }
      for (let i = 0; i < 1600; i++) trainStep(S, i < 600 ? 0.04 : i < 1200 ? 0.02 : 0.01, S.lam, S.jit);
      let ok = 0;
      for (let i = 0; i < N; i++) if ((logit(S, S.px[i], S.py[i]) > 0 ? 1 : 0) === S.lab[i]) ok++;
      if (ok > bestAcc) (bestAcc = ok), best.set(S.th);
      if (ok >= N - flipped - 3) break;
    }
    S.th.set(best);
    S.m.fill(0);
    S.v.fill(0);
    S.adamT = 0;
    S.b1p = S.b2p = 1;
    S.ready = true;
  } else {
    S.acc += d * STEPS_PER_S;
    let n = floor(S.acc);
    S.acc -= n;
    if (n > 40) n = 40;
    for (let i = 0; i < n; i++) trainStep(S, S.lr, S.lam, S.jit);
  }
  evalGrid(S);
  // each dot's logit, and its flash if the net has it on the wrong side
  const a = 1 - exp(-d / 0.07), r = 1 - exp(-d / 0.5);
  for (let i = 0; i < N; i++) {
    const z = logit(S, S.px[i], S.py[i]);
    S.z[i] = z;
    const wrong = (z > 0 ? 1 : 0) !== S.lab[i] ? 1 : 0;
    S.wr[i] += (wrong - S.wr[i]) * (wrong > S.wr[i] ? a : r);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const Z = S.Z, GX = S.GX, GY = S.GY, buf = S.buf, cA = S.cA, cB = S.cB;
  const FL0 = 0.12, FL1 = 0.44;
  for (let y = 0; y < H; y++) {
    const j0 = y >> 1, fy = y & 1;
    for (let x = 0; x < W; x++) {
      const i0 = x >> 1, fx = x & 1, a = j0 * NODES_X + i0;
      let z, gx, gy;
      if (!fx && !fy) (z = Z[a]), (gx = GX[a]), (gy = GY[a]);
      else if (fx && !fy) (z = 0.5 * (Z[a] + Z[a + 1])), (gx = 0.5 * (GX[a] + GX[a + 1])), (gy = 0.5 * (GY[a] + GY[a + 1]));
      else if (!fx && fy) (z = 0.5 * (Z[a] + Z[a + NODES_X])), (gx = 0.5 * (GX[a] + GX[a + NODES_X])), (gy = 0.5 * (GY[a] + GY[a + NODES_X]));
      else {
        z = 0.25 * (Z[a] + Z[a + 1] + Z[a + NODES_X] + Z[a + NODES_X + 1]);
        gx = 0.25 * (GX[a] + GX[a + 1] + GX[a + NODES_X] + GX[a + NODES_X + 1]);
        gy = 0.25 * (GY[a] + GY[a + 1] + GY[a + NODES_X] + GY[a + NODES_X + 1]);
      }
      const side = z > 0 ? cB : cA;
      const az = z < 0 ? -z : z;
      const gm = sqrt(gx * gx + gy * gy), dist = az / (gm + 0.06), gate = sm(0.012, 0.09, gm);
      const c = 1 - exp(-az * 0.2);
      let lvl = FL0 + (FL1 - FL0) * c;
      if (dist < 36) lvl *= 1 + 0.26 * exp(-dist / 12) * cos((dist * TAU) / 17 - S.t * 1.1);
      let r = side[0] * lvl, g = side[1] * lvl, b = side[2] * lvl;
      if (dist < 9) {
        const glow = 0.5 * exp(-dist * 0.42) * gate;
        r += (side[0] * 0.75 + 0.25) * glow;
        g += (side[1] * 0.75 + 0.25) * glow;
        b += (side[2] * 0.75 + 0.25) * glow;
        const line = (1 - sm(0.8, 1.75, dist)) * gate;
        if (line > 0) {
          const lr = side[0] * 0.3 + 0.7, lg = side[1] * 0.3 + 0.7, lb = side[2] * 0.3 + 0.7;
          r += (lr - r) * line;
          g += (lg - g) * line;
          b += (lb - b) * line;
        }
      }
      const p = (y * W + x) * 3;
      buf[p] = r;
      buf[p + 1] = g;
      buf[p + 2] = b;
    }
  }
  // the rings of the dots the net has wrong, taken at their strongest where two meet, then the dots over everything with a pale heart
  const ring = S.ring;
  ring.fill(0);
  const pulse = 0.65 + 0.35 * sin(S.t * 10);
  for (let i = 0; i < N; i++) {
    const wr = S.wr[i];
    if (wr < 0.04) continue;
    const cx = S.px[i] * 32 + 31.5, cy = S.py[i] * 64 + 63.5;
    const x0 = max(0, floor(cx - 5)), x1 = min(W - 1, Math.ceil(cx + 5)), y0 = max(0, floor(cy - 5)), y1 = min(H - 1, Math.ceil(cy + 5));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy, cov = (1 - sm(0.5, 1.5, abs(sqrt(dx * dx + dy * dy) - 3.2))) * wr * pulse * 0.72;
        if (cov > ring[y * W + x]) ring[y * W + x] = cov;
      }
    }
  }
  for (let p = 0; p < W * H; p++) {
    const cov = ring[p];
    if (cov > 0) {
      buf[p * 3] += (0.95 - buf[p * 3]) * cov;
      buf[p * 3 + 1] += (0.93 - buf[p * 3 + 1]) * cov;
      buf[p * 3 + 2] += (0.88 - buf[p * 3 + 2]) * cov;
    }
  }
  for (let i = 0; i < N; i++) {
    const cx = S.px[i] * 32 + 31.5, cy = S.py[i] * 64 + 63.5, wr = S.wr[i];
    const x0 = max(0, floor(cx - 3)), x1 = min(W - 1, Math.ceil(cx + 3)), y0 = max(0, floor(cy - 3)), y1 = min(H - 1, Math.ceil(cy + 3));
    const col = S.lab[i] ? S.dB : S.dA, tint = 0.35 + 0.5 * wr;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy, dd = sqrt(dx * dx + dy * dy), p = (y * W + x) * 3;
        const cov = cl((1.75 - dd) / 0.8 + 0.5, 0, 1);
        if (cov > 0) {
          const heart = sm(1.0, 0.4, dd);
          const rr = (col[0] * 0.85 + 0.15) * (1 - heart) + 0.97 * heart * tint + col[0] * heart * (1 - tint);
          const gg = (col[1] * 0.85 + 0.15) * (1 - heart) + 0.97 * heart * tint + col[1] * heart * (1 - tint);
          const bb = (col[2] * 0.85 + 0.15) * (1 - heart) + 0.97 * heart * tint + col[2] * heart * (1 - tint);
          buf[p] += (rr - buf[p]) * cov;
          buf[p + 1] += (gg - buf[p + 1]) * cov;
          buf[p + 2] += (bb - buf[p + 2]) * cov;
        }
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      display.setPixel(x, y, (cl(buf[p], 0, 1) * 255 + 0.5) | 0, (cl(buf[p + 1], 0, 1) * 255 + 0.5) | 0, (cl(buf[p + 2], 0, 1) * 255 + 0.5) | 0);
    }
  }
}
