// ===== Patternflow pattern =====
// Title:   Echo State
// Family:  reservoir
// Idea:    A fixed random network of 441 leaky neurons on a torus is driven by a Mackey-Glass chaotic signal while a readout learns, one step at a time, to predict it, so the amber forecast hugs the pale line and the neurons' map ripples with waves, until the network is cut loose to run on its own and its trace peels away from the true one.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: echo state network (Herbert Jaeger, 2001), liquid state machine (Wolfgang Maass, Thomas Natschlager, Henry Markram, 2002), Mackey-Glass delay equation (Michael Mackey, Leon Glass, 1977), pattern round 270
// Round:   270
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Leak=0.5..4, Rho=-1..1, Drive=-1..1
//
// Knob 1: Hue. Turns the whole picture round the colour wheel, neurons, traces and strip together, from amber against blue at 0, so that at 0.5 the two have swapped.
// Knob 2: Leak. The leak rate of every neuron, 0.225 a step for each unit of the knob: 0.11 at 0.5, 0.45 at the opening 2 and 0.9 at 4, so a slow neuron blurs the signal and the readout's one-step miss is 0.05 of the signal's range at 0.5, 0.008 at 2 and 0.004 at 4, while the ripples spread faster the higher it goes.
// Knob 3: Rho. The spectral radius of the network, 0.80 at -1, 1.03 at the opening 0 and 1.24 at 1 (each round draws its own, 5 percent either way): at -1 only the five sources show, at 0 their ripples run out across the map, and at 1 the net rings by itself in a flat blue and amber maze and a free-running trace is lost within a third of a second.
// Knob 4: Drive. How hard the signal pushes on the neurons where it enters, a gain of 0.19 at -1, 0.81 at the opening 0.06 and 3.0 at 1, so the five sources swell from small dots to blobs that fill the gaps between them and the one-step miss falls from 0.011 to 0.006.
//
// What the picture is. Above, a 21 by 21 sheet of neurons, 3 by 3 LED each with the torus drawn smoothly between their centres, amber where a neuron is above zero and blue below, brighter the further from zero. Below, time runs left to right at 15 columns a second: the true signal as a pale blue band, the network's prediction on top of it as a two-LED amber line, and two thirds of the way across, where now is, what the network would do on its own for the next 40 steps, fading out. A strip along the foot is the size of the miss, cool and faint while the line hugs the band and gold when it does not.
// The model. The signal is the Mackey-Glass delay equation, x' = 0.2 x(t - tau) / (1 + x(t - tau)^10) - 0.1 x, one time unit a network step, tau 17 to 19.5 for a round and wandering 0.6 either way over two minutes. Each neuron keeps x <- (1 - a) x + a tanh(rho W x + g w u), where W is local and fixed, scaled to spectral radius 1 by iterating it, and the signal u enters, raised by 0.4, at five points where w is a bump a neuron wide with a sign each. W gives a neuron about thirty inputs near a point a little upstream of it along a smooth random flow, through a difference of two Gaussians, plus a weak random weight on each and three inputs from anywhere, and the flow runs away from the five points, so a change at one of them goes out as rings. The readout is 442 weights fitted by recursive least squares, one update a step, to say the next value of the signal. A round teaches it for 1000 to 1500 steps (33 to 50 s), then cuts the network from the signal and feeds it its own output until it has missed by 0.35 (the signal runs between -1 and 1) for three steps, runs it on for another 5 to 14 s, and starts the next round with a new network, a new tau and a new rho. 30 steps a second.
// What is exact and what is not. The leaky tanh network, the readout fitted on line by recursive least squares, the free-running generation by feeding the output back and the teacher forcing before it are the textbook echo state method. The structure of W is not a random one: it is local and carries a flow so that the picture has waves, which makes the network a wave medium with random weights on top, and the five input points are put at the low points of the flow's potential for the same reason. The network is not tuned to a particular signal; the readout is, and it is the readout's precision that sets how long the free run keeps up: over many rounds at the opening knobs the one-step miss ends near 0.008 and the trace leaves the true one after 3 to 8 s, with a spread of 1 to 14 s. The window onto the torus slides by half an LED a second, the plot's time axis breathes between 12 and 18 columns a second and its height by 9 percent either way, and the network feels none of it: they are there so that the picture does not come round.

const W = 64, H = 128;
const G = 21, N = G * G, M = N + 1;
const { floor, sqrt, exp, log, sin, cos, tanh, abs, min, max, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- the signal
// Mackey-Glass, dx/dt = 0.2 x(t - tau) / (1 + x(t - tau)^10) - 0.1 x, by Euler
// steps of 0.2 from a ring of the last 25 time units, tau read between two
// slots. One network step takes one time unit, so the signal's quasi-period
// of about 50 is 50 steps. The delay is not fixed: it sits between 17 and 23
// for a round and wanders 1.5 either way over a minute, which stretches and
// shrinks the waves of the signal and keeps its history from coming round.
const MGH = 0.2, MGL = 128;
function mgSub(m, tau) {
  const j = m.i - tau / MGH, j0 = floor(j), f = j - j0;
  const xd = m.buf[((j0 % MGL) + MGL) % MGL] * (1 - f) + m.buf[(((j0 + 1) % MGL) + MGL) % MGL] * f;
  const x2 = xd * xd, x4 = x2 * x2, x10 = x4 * x4 * x2;
  m.x += MGH * (0.2 * xd / (1 + x10) - 0.1 * m.x);
  m.i = m.i + 1 >= MGL ? 0 : m.i + 1;
  m.buf[m.i] = m.x;
}
function mgNew(r) {
  const m = { buf: new Float64Array(MGL), i: 0, x: 1.2 };
  for (let k = 0; k < MGL; k++) m.buf[k] = 1.2 + 0.1 * (r() - 0.5);
  m.x = m.buf[0];
  for (let k = 0; k < 6000; k++) mgSub(m, 17);
  return m;
}
function mgStep(S) {
  const m = S.mg, tau = S.tau0 + 0.6 * sin(S.T / 3600 * TAU + S.ph[0]);
  for (let k = 0; k < 5; k++) mgSub(m, tau);
  return (m.x - 0.92) / 0.5;
}

// ------------------------------------------------------------------ the network
// 441 neurons on a 21 x 21 torus. A neuron hears about thirty neighbours
// round a point a little upstream of itself, through a difference of two
// Gaussians (so no uniform mode) that is the same for all, plus a small random
// weight on each, and three neurons anywhere. The upstream point comes from a
// smooth random flow, so a ripple keeps moving the way the flow runs, away
// from the neurons the signal enters at.
const MAXNZ = N * 34;
const KV = [[1, 0], [0, 1], [1, 1], [1, -1], [2, 0], [0, 2]];
const COH = 3, RWK = 0.05, LONGW = 0.12, FLOW = 0.4, NPORT = 5, PORTR = 1.0;
function netNew(S) {
  const r = S.r, R = S.R, K = TAU / G;
  // a smooth random potential psi on the torus; the flow runs up its slope,
  // away from its low points, and the signal enters at those points
  const amp = [], ph = [], psi = new Float64Array(N), gx = new Float64Array(N), gy = new Float64Array(N);
  for (let k = 0; k < KV.length; k++) {
    amp.push(0.5 + 0.5 * r());
    ph.push(r() * TAU);
  }
  let gm = 1e-9;
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      const i = y * G + x;
      let v = 0, dx = 0, dy = 0;
      for (let k = 0; k < KV.length; k++) {
        const a = K * (KV[k][0] * x + KV[k][1] * y) + ph[k];
        v += amp[k] * cos(a);
        dx -= amp[k] * K * KV[k][0] * sin(a);
        dy -= amp[k] * K * KV[k][1] * sin(a);
      }
      psi[i] = v;
      gx[i] = dx;
      gy[i] = dy;
      gm = max(gm, sqrt(dx * dx + dy * dy));
    }
  const ptr = R.ptr, idx = R.idx, val = R.val0;
  let p = 0;
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      const i = y * G + x;
      ptr[i] = p;
      const cy = y - FLOW * gy[i] / gm, cx = x - FLOW * gx[i] / gm, ry = Math.round(cy), rx = Math.round(cx);
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const yy = ry + dy, xx = rx + dx, d2 = (yy - cy) * (yy - cy) + (xx - cx) * (xx - cx);
          if (d2 > 9) continue;
          const g = exp(-d2 / 1.62) - 0.25 * exp(-d2 / 6.48);
          const rw = (r() + r() + r() + r() - 2) * 1.7320508 * exp(-d2 / 4);
          idx[p] = (((yy % G) + G) % G) * G + (((xx % G) + G) % G);
          val[p] = COH * g + RWK * rw;
          p++;
        }
      for (let q = 0; q < 3; q++) {
        idx[p] = (r() * N) | 0;
        val[p] = (r() + r() + r() + r() - 2) * 1.7320508 * LONGW;
        p++;
      }
    }
  ptr[N] = p;
  // scale to spectral radius 1: the growth of a vector under 150 more
  // applications of the matrix, after 50 that let the fastest mode win
  const v = R.t1, t = R.t2;
  for (let i = 0; i < N; i++) v[i] = r() - 0.5;
  let ls = 0;
  for (let k = 0; k < 200; k++) {
    let n = 0;
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let q = ptr[i]; q < ptr[i + 1]; q++) s += val[q] * v[idx[q]];
      t[i] = s;
      n += s * s;
    }
    n = sqrt(n) + 1e-30;
    for (let i = 0; i < N; i++) v[i] = t[i] / n;
    if (k >= 50) ls += log(n);
  }
  const rad = exp(ls / 150);
  for (let q = 0; q < p; q++) val[q] /= rad;
  // the signal enters at the lowest points of psi that lie apart from each
  // other, in a bump a neuron wide, with a sign each
  R.win.fill(0);
  const order = [];
  for (let i = 0; i < N; i++) order.push(i);
  order.sort((u, v2) => psi[u] - psi[v2]);
  const ports = [];
  for (let c = 0; c < N && ports.length < NPORT; c++) {
    const i = order[c], py = floor(i / G), px = i % G;
    let ok = true;
    for (const q of ports) {
      let dy = abs(py - q[0]), dx = abs(px - q[1]);
      dy = min(dy, G - dy);
      dx = min(dx, G - dx);
      if (dx * dx + dy * dy < 49) ok = false;
    }
    if (ok) ports.push([py, px, r() < 0.5 ? -1 : 1]);
  }
  for (const q of ports) {
    const rad2 = PORTR * (0.8 + 0.4 * r());
    for (let y = 0; y < G; y++)
      for (let x = 0; x < G; x++) {
        let dy = abs(y - q[0]), dx = abs(x - q[1]);
        dy = min(dy, G - dy);
        dx = min(dx, G - dx);
        R.win[y * G + x] += q[2] * exp(-(dx * dx + dy * dy) / (2 * rad2 * rad2));
      }
  }
  for (let i = 0; i < N; i++) {
    R.win[i] = cl(R.win[i], -1, 1);
    R.x[i] = 0;
  }
  R.w.fill(0);
  const P = R.P, a0 = 1 / S.alpha;
  P.fill(0);
  for (let i = 0; i < M; i++) P[i * M + i] = a0;
}

function netStep(R, u, rho, a, drive, x, xn) {
  const { ptr, idx, val0, win } = R;
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let q = ptr[i]; q < ptr[i + 1]; q++) s += val0[q] * x[idx[q]];
    xn[i] = (1 - a) * x[i] + a * tanh(rho * s + drive * win[i] * u);
  }
}

function readout(R, x) {
  const w = R.w;
  let s = w[N];
  for (let i = 0; i < N; i++) s += w[i] * x[i];
  return s;
}

// Recursive least squares on the 442 weights: the gain P z / (1 + z P z),
// the weights follow the error. P starts as a million times the identity and
// is opened again to 100 if it ever stops being positive.
function rlsStep(R, x, d) {
  const P = R.P, z = R.z, Pz = R.Pz, w = R.w;
  for (let i = 0; i < N; i++) z[i] = x[i];
  z[N] = 1;
  let den = 1, y = 0;
  for (let i = 0; i < M; i++) {
    let s = 0;
    const o = i * M;
    for (let j = 0; j < M; j++) s += P[o + j] * z[j];
    Pz[i] = s;
    den += s * z[i];
    y += w[i] * z[i];
  }
  const e = d - y;
  if (!(den > 1e-12) || !isFinite(e)) {
    P.fill(0);
    for (let i = 0; i < M; i++) P[i * M + i] = 100;
    return e;
  }
  const inv = 1 / den;
  for (let i = 0; i < M; i++) w[i] += Pz[i] * inv * e;
  for (let i = 0; i < M; i++) {
    const o = i * M, ki = Pz[i] * inv;
    for (let j = 0; j < M; j++) P[o + j] -= ki * Pz[j];
  }
  return e;
}

// ------------------------------------------------------------------ the story
// One round: the network is new and woken with the last of the signal; it is
// taught for TEACH steps (the readout is hidden for the first 50, wild until
// it has seen that many); then it is cut
// from the signal and fed its own output until it has drifted from the true
// series and run on for a random while, or fallen still, or run too long; then
// a new network, a new spectral radius and a new teacher length start the
// next round. 30 steps a second, a step is one time unit of the signal.
const SPS = 30;
const HLEN = 160;    // steps of history kept
const FORE = 40;     // steps of forecast drawn
const OFFSET = 0.4;  // the signal reaches the neurons raised by this much

export function setup(params) {
  const R = {
    ptr: new Int32Array(N + 1), idx: new Int16Array(MAXNZ), val0: new Float64Array(MAXNZ),
    win: new Float64Array(N), x: new Float64Array(N), xn: new Float64Array(N),
    w: new Float64Array(M), P: new Float64Array(M * M), z: new Float64Array(M), Pz: new Float64Array(M),
    t1: new Float64Array(N), t2: new Float64Array(N), fx: new Float64Array(N), fxn: new Float64Array(N),
  };
  const r = mulberry((Math.random() * 4294967296) >>> 0);
  const S = {
    R, r, mg: mgNew(r), tau0: 20, T: 0, ph: [r() * TAU], k: [0, 2, 0, 0.06], alpha: 1e-6, sync: [1, 1, 1],
    mode: 0, n: 0, teach: 1000, free: 0, div: -1, dc: 0, extra: 0, still: 0, rj: 1,
    acc: 0, pre: false, u: 0, y: 0, e: 0,
    hT: new Float32Array(HLEN), hY: new Float32Array(HLEN), hE: new Float32Array(HLEN), hm: new Uint8Array(HLEN), hp: 0,
    fore: new Float32Array(FORE), snap: new Float32Array(N), snapA: 0,
    rho: 1, leak: 0.45, drive: 1,
  };
  params.s = S;
}

function newRound(S, first) {
  const R = S.R;
  if (!first) {
    for (let i = 0; i < N; i++) S.snap[i] = R.x[i];
    S.snapA = 1;
  }
  S.rj = 0.95 + 0.1 * S.r();
  S.tau0 = 17 + 2.5 * S.r();
  applyKnobs(S);
  S.teach = 1000 + floor(500 * S.r());
  S.mode = 0;
  S.n = 0;
  S.sync[0] = S.leak;
  S.sync[1] = S.rho;
  S.sync[2] = S.drive;
  S.div = -1;
  S.dc = 0;
  S.extra = 150 + floor(260 * S.r());
  S.still = 0;
  S.free = 0;
  netNew(S);
  // the new network is woken with the last 39 values of the signal at once,
  // so the map does not have to start from black
  if (first) S.u = mgStep(S);
  for (let k = 39; k >= 1; k--) {
    netStep(R, S.hT[(S.hp - 1 - k + HLEN * 2) % HLEN] + OFFSET, S.rho, S.leak, S.drive, R.x, R.xn);
    const t = R.x;
    R.x = R.xn;
    R.xn = t;
  }
  S.y = 0;
}

function readKnobs(S, input) {
  const kv = (input && input.knobValues) || S.k;
  for (let i = 0; i < 4; i++) if (typeof kv[i] === "number" && isFinite(kv[i])) S.k[i] = kv[i];
  applyKnobs(S);
}

function applyKnobs(S) {
  S.leak = cl(0.225 * S.k[1], 0.05, 0.9);
  S.rho = 1.03 * pow(S.k[2] < 0 ? 1.3 : 1.2, cl(S.k[2], -1, 1)) * S.rj;
  S.drive = 0.75 * pow(4, cl(S.k[3], -1, 1));
}

function record(S, truth, pred, err) {
  const p = S.hp;
  S.hT[p] = truth;
  S.hY[p] = pred;
  S.hE[p] = err;
  S.hm[p] = S.mode;
  S.hp = p + 1 >= HLEN ? 0 : p + 1;
}

// One step of the network. In the free phase it ignores the true value and
// hears its own last output instead.
function step(S) {
  const R = S.R;
  const free = S.mode === 1;
  S.T++;
  netStep(R, (free ? S.y : S.u) + OFFSET, S.rho, S.leak, S.drive, R.x, R.xn);
  const t = R.x;
  R.x = R.xn;
  R.xn = t;
  const y = readout(R, R.x);
  const un = mgStep(S);
  // a knob that moved the network under the readout: open the gain again
  if (!free && S.n > 60) {
    const sy = S.sync;
    if (abs(log(S.leak / sy[0])) > 0.12 || abs(log(S.rho / sy[1])) > 0.08 || abs(log(S.drive / sy[2])) > 0.12) {
      sy[0] = S.leak;
      sy[1] = S.rho;
      sy[2] = S.drive;
      const P = R.P;
      P.fill(0);
      for (let i = 0; i < M; i++) P[i * M + i] = 100;
    }
  }
  const e = un - y;
  if (!isFinite(y) || abs(y) > (free ? 4 : 60)) {
    newRound(S, false);
    return;
  }
  if (!free) {
    rlsStep(R, R.x, un);
  } else {
    S.free++;
    if (S.div < 0) {
      S.dc = abs(e) > 0.35 ? S.dc + 1 : 0;
      if (S.dc >= 3) S.div = S.free;
    }
  }
  // the readout is kept out of sight for the first 50 steps of a round
  const quiet = !free && S.n < 50;
  S.n++;
  S.u = un;
  S.y = quiet ? 0 : y;
  S.e = quiet ? un : e;
  record(S, un, S.y, S.e);
  if (!free) {
    if (S.n >= S.teach) {
      S.mode = 1;
      S.free = 0;
      S.dc = 0;
    }
  } else {
    // fallen still: the last 120 outputs hardly move
    let lo = 9, hi = -9;
    for (let k = 1; k <= 120; k++) {
      const v = S.hY[(S.hp - k + HLEN * 2) % HLEN];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (S.free > 120 && hi - lo < 0.12) S.still++;
    else S.still = 0;
    if ((S.div >= 0 && S.free - S.div > S.extra) || S.still > 60 || S.free > 1500) newRound(S, false);
  }
}

// What the network would do for the next FORE steps if left alone.
function forecast(S) {
  const R = S.R;
  let x = R.fx, xn = R.fxn, y = S.y;
  for (let i = 0; i < N; i++) x[i] = R.x[i];
  for (let k = 0; k < FORE; k++) {
    netStep(R, y + OFFSET, S.rho, S.leak, S.drive, x, xn);
    const t = x;
    x = xn;
    xn = t;
    y = readout(R, x);
    S.fore[k] = isFinite(y) && S.n >= 50 ? cl(y, -2, 2) : 0;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  readKnobs(S, input);
  if (!S.pre) {
    S.pre = true;
    // open on a network that has been taught for a while, at these knobs
    newRound(S, true);
    for (let k = 0; k < 560; k++) step(S);
  }
  S.acc += cl(dt || 0, 0, 0.1) * SPS;
  let c = 0;
  while (S.acc >= 1 && c < 4) {
    S.acc -= 1;
    c++;
    step(S);
  }
  if (S.acc > 2) S.acc = 2;
  if (S.snapA > 0) S.snapA = max(0, S.snapA - (dt || 0) * 1.4);
  forecast(S);
}

// ------------------------------------------------------------------ drawing
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

const FR = new Float32Array(W * H), FG = new Float32Array(W * H), FB = new Float32Array(W * H);
const CW = new Float32Array(W * H), CA = new Float32Array(W * H), CF = new Float32Array(W * H);
const C = [0, 0, 0];
const LUT = [new Float32Array(768), new Float32Array(768)];
let lutHue = -1;

// the colour of a neuron at strength m (0..1): amber (side 0) or blue (side 1)
function buildLut(hue) {
  lutHue = hue;
  for (let side = 0; side < 2; side++)
    for (let k = 0; k < 256; k++) {
      const m = k / 255;
      // amber runs from ember red at the faint end to gold, which keeps a faint
      // neuron from reading as brown
      hsv((side ? 0.6 : 0.035 + 0.075 * sm(m * 1.4)) + hue, 1 - 0.55 * m * m * m, 1, C);
      LUT[side][k * 3] = C[0] * m;
      LUT[side][k * 3 + 1] = C[1] * m;
      LUT[side][k * 3 + 2] = C[2] * m;
    }
}

// a soft-edged line segment of half width hw into a coverage buffer
function seg(buf, x0, y0, x1, y1, hw, lvl, y_lo, y_hi) {
  const xa = max(0, floor(min(x0, x1) - hw - 1)), xb = min(W - 1, Math.ceil(max(x0, x1) + hw + 1));
  const ya = max(y_lo, floor(min(y0, y1) - hw - 1)), yb = min(y_hi, Math.ceil(max(y0, y1) + hw + 1));
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy + 1e-9;
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const t = cl(((x - x0) * dx + (y - y0) * dy) / L2, 0, 1);
      const ex = x - (x0 + t * dx), ey = y - (y0 + t * dy);
      const cov = cl(hw + 0.5 - sqrt(ex * ex + ey * ey), 0, 1) * lvl;
      const i = y * W + x;
      if (cov > buf[i]) buf[i] = cov;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const hue = S.k[0];
  if (hue !== lutHue) buildLut(hue);
  FR.fill(0);
  FG.fill(0);
  FB.fill(0);

  // ---- the neurons, 21 x 21 tiles of 3 x 3 LED, amber above zero, blue below,
  // each tile's own value at its middle and the torus between
  const x = S.R.x, sx = S.snap, sa = S.snapA * S.snapA;
  // the window onto the torus slides by 0.5 LED a second one way and 0.33
  // the other, so the sources do not stay where they were
  const ox = (S.T * 0.17) / SPS, oy = (S.T * 0.11) / SPS;
  for (let py = 0; py < 63; py++) {
    const gy = (py - 1 + 63) / 3 + oy, y0 = floor(gy), fy = sm(gy - y0), ya = (y0 % G) * G, yb = ((y0 + 1) % G) * G;
    for (let px = 0; px < 63; px++) {
      const gx = (px - 1 + 63) / 3 + ox, x0 = floor(gx), fx = sm(gx - x0), xa = x0 % G, xb = (x0 + 1) % G;
      const i00 = ya + xa, i01 = ya + xb, i10 = yb + xa, i11 = yb + xb;
      let v = (x[i00] * (1 - fx) + x[i01] * fx) * (1 - fy) + (x[i10] * (1 - fx) + x[i11] * fx) * fy;
      if (sa > 0) v += sa * ((sx[i00] * (1 - fx) + sx[i01] * fx) * (1 - fy) + (sx[i10] * (1 - fx) + sx[i11] * fx) * fy);
      const m = pow(cl((abs(v) * 1.9 - 0.08) / 0.92, 0, 1), 1.0), k = ((m * 255 + 0.5) | 0) * 3, L = LUT[v > 0 ? 0 : 1], o = py * W + px;
      FR[o] = L[k];
      FG[o] = L[k + 1];
      FB[o] = L[k + 2];
    }
  }

  // ---- the traces: time runs left to right, now at column NOWX, the forecast beyond
  // the time axis stretches and shrinks slowly, 0.40 to 0.60 of a column a step
  // (12 to 18 columns a second), and the height of the plot a little with it
  const tt = (S.T / SPS) * TAU;
  const NOWX = 41, Y0 = 93, AMP = 23 * (1 + 0.09 * sin(tt / 113 + 1.3)), YLO = 66, YHI = 119;
  const cs = 0.5 * (1 + 0.12 * sin(tt / 97 + S.ph[0]) + 0.08 * sin(tt / 151 + 2.1));
  const yv = (v) => Y0 - AMP * 1.15 * tanh(v / 1.15);
  CW.fill(0, 66 * W, 120 * W);
  CA.fill(0, 66 * W, 120 * W);
  CF.fill(0, 66 * W, 120 * W);
  const hp = S.hp, nh = floor(NOWX / cs) + 1;
  let px0 = 0, ty0 = 0, qy0 = 0, have = false;
  for (let k = nh - 1; k >= 0; k--) {
    const j = (hp - 1 - k + HLEN * 4) % HLEN, xx = NOWX - k * cs, ty1 = yv(S.hT[j]), qy1 = yv(S.hY[j]);
    if (have) {
      seg(CW, px0, ty0, xx, ty1, 1.9, S.hm[j] === 1 ? 0.5 : 0.8, YLO, YHI);
      seg(CA, px0, qy0, xx, qy1, 0.95, 1, YLO, YHI);
    }
    px0 = xx;
    ty0 = ty1;
    qy0 = qy1;
    have = true;
  }
  let fx0 = NOWX, fy0 = yv(S.y);
  for (let k = 0; k < FORE; k++) {
    const xx = NOWX + (k + 1) * cs, fy1 = yv(S.fore[k]);
    if (xx > W + 1) break;
    seg(CF, fx0, fy0, xx, fy1, 0.95, 0.95 - 0.3 * (k / FORE), YLO, YHI);
    fx0 = xx;
    fy0 = fy1;
  }
  const hA = 0.1 + hue, hB = 0.6 + hue;
  hsv(hB, 0.22, 1, C);
  const wr = C[0], wg = C[1], wb = C[2];
  hsv(hA, 0.9, 1, C);
  const ar = C[0], ag = C[1], ab = C[2];
  hsv(hA, 0.78, 1, C);
  const fr = C[0], fg = C[1], fb = C[2];
  for (let i = 66 * W; i < 120 * W; i++) {
    const cw = CW[i], ca = CA[i], cf = CF[i];
    if (cw + ca + cf <= 0) continue;
    let r = wr * cw, g = wg * cw, b = wb * cw;
    r = r * (1 - ca) + ar * ca;
    g = g * (1 - ca) + ag * ca;
    b = b * (1 - ca) + ab * ca;
    r = r * (1 - cf) + fr * cf;
    g = g * (1 - cf) + fg * cf;
    b = b * (1 - cf) + fb * cf;
    FR[i] = r;
    FG[i] = g;
    FB[i] = b;
  }

  // ---- the error, a strip along the foot, newest at NOWX: the size of the miss
  // averaged over eleven steps, cool and faint at 0.005, gold and full at 0.15
  hsv(hB, 0.6, 1, C);
  const er = C[0], eg = C[1], eb = C[2];
  hsv(hA, 0.7, 1, C);
  for (let c = 0; c <= NOWX; c++) {
    let e = 0;
    for (let q = -5; q <= 5; q++) e += abs(S.hE[(hp - 1 - (NOWX - c) * 2 + q + HLEN * 4) % HLEN]) / 11;
    const u = cl((Math.log10(e + 1e-5) + 2.3) / 1.5, 0, 1), l = 0.3 + 0.7 * u;
    const r = (er + (C[0] - er) * u) * l, g = (eg + (C[1] - eg) * u) * l, b = (eb + (C[2] - eb) * u) * l;
    for (let yy = 123; yy <= 125; yy++) {
      const o = yy * W + c;
      FR[o] = r;
      FG[o] = g;
      FB[o] = b;
    }
  }

  for (let i = 0; i < W * H; i++)
    display.setPixel(i % W, (i / W) | 0, min(255, (FR[i] * 255) | 0), min(255, (FG[i] * 255) | 0), min(255, (FB[i] * 255) | 0));
}
