// ===== Patternflow pattern =====
// Title:   Kelp Surge
// Family:  kelp
// Idea:    A tall window into a giant-kelp forest seen from the side, where every stalk is a buoyant chain of 14 nodes fixed to the sea floor and dragged by the orbital water of two swells that never line up, so the forest leans over and rights itself as wave groups pass, stalks of different length and drag falling out of step and the tips bending over in a storm, while slanted shafts of sun drift down through emerald water and light the blades and floats they cross.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: linear wave theory (George Airy, 1841), quadratic drag in an oscillating flow (Morison, O'Brien, Johnson and Schaaf, 1950), the mechanics of wave-swept algae (Mark Denny and Brian Gaylord, 2002), position based dynamics (Matthias Muller, Bruno Heidelberger, Marcus Hennix and John Ratcliff, 2007), pattern round 212
// Round:   212
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Swell=0.3..4.5, Forest=-1..1, Shafts=-1..1
//
// Knob 1: Hue. Turns the water, the kelp, the floats and the light round the colour wheel together, by 190 degrees at 1, a little short of a turn so that the deep water never passes through orange to brown. At 0 the water is emerald and teal going to deep blue, the kelp green going to lime in the sun and the shafts gold. At 0.5 it is a violet sea with blue-violet kelp and green shafts, and at 1 a red sea with pink kelp and blue shafts.
// Knob 2: Swell. The height in metres of the larger of the two swells, from 0.3 to 4.5, opening at 2; the other is four fifths of it. At 0.3 the water moves about a hand's width and the stalks hang and drift with the tide. At 2 the surface flow peaks near 1.3 m/s and the tip of a long stalk swings about 5 LEDs either side with the swell, 13 more with the wave groups and the tide. At 4.5 the swing is 11 LEDs, the stalks are thrown 30 to 50 LEDs over, and the tips bend.
// Knob 3: Forest. How many stalks stand in the back layer: 3 at -1, 8.5 at 0 where it opens, 14 at 1. The middle layer has three quarters of that number and the front layer three fifths, since the front stalks are thick. A stalk fades in or out as the count passes it, so the last one can be half there.
// Knob 4: Shafts. The height of the sun, low at -1 and high at 1. Low, the shafts are faint (0.32 of full strength) and lean 42 degrees from the vertical in the water. Where it opens, at 0.06, they are 0.74 strong and lean 30 degrees. High, they are 1.12 strong and nearly upright at 18 degrees. Every shaft also drifts sideways, swung by the slope of the swell at the surface and by a slow wander of its own.

// Window: the panel is 12.8 m wide and 25.6 m tall, 0.2 m to an LED, y down from the mean
// surface. A stalk is a chain of 13 free nodes with inextensible links, fixed to the floor
// at its holdfast, and every node feels
//   up      a buoyancy B (0.4 to 0.6 m/s^2, twice as much at the float on the top node),
//   drag    cd |r| r on the water's velocity relative to the node, r = u - v, with the part
//           along the stalk a tenth of the part across it, and cd 0.4 to 3.6 per metre,
//           stronger toward the tip where the blades are,
//   bend    a soft pull toward the line through the two nodes below it.
// The water is two Airy trains in a sea 25.6 m deep. A train of period T has the wavenumber
// k that solves w^2 = g k tanh(k h), and at depth y below the surface
//   u = a w cosh(k (h - y)) / sinh(k h) cos(k x - w t)       along the window,
//   v = -a w sinh(k (h - y)) / sinh(k h) sin(k x - w t)      down.
// Deep water theory, a flow that falls as exp(-k y), does not hold here. k h is 1.36 at 9.3 s and
// 0.89 at 12.7 s, waves 118 m and 180 m long, so the cosh form is used: at the floor the flow is
// 48 and 70 percent of the surface's, where exp(-k h) would say 26 and 41.
// The phase is read at the stalk's rest position, not at the node. Read at the node, a stalk
// swung forward meets the wave a little early, and with quadratic drag that small slip parked
// the whole forest on the downwave side at storm swell. The window spans 0.7 and 0.45 rad of
// phase, so neighbours still sway a little out of step.
// The periods 9.3 s and 12.7 s share no whole-number ratio, so the wave groups come and go
// every 35 s and never in the same way twice. A slow tide, three periods that do not divide
// one another, leans the whole forest one way and the other.
// The chain is stepped as position based dynamics: Verlet prediction, then one solve for the
// force in every link that puts every node back at its link length, two rounds a step.

const W = 64, H = 128;
const { floor, ceil, sqrt, sin, cos, exp, abs, min, max, pow, hypot, tanh, sinh, cosh, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const fract = (v) => v - floor(v);

const PPM = 5; // LEDs to the metre
const DEP = H / PPM; // 25.6 m
const G = 9.81;
const NODES = 15; // two fixed nodes below the first free one: a phantom and the holdfast
const NFREE = NODES - 2;
const TAB = 65;
const SUB = 1 / 60; // longest sub-step, seconds
const TRAIN = [
  { T: 9.3, a: 0.5, ph: 1.1 },
  { T: 12.7, a: 0.4, ph: 4.0 },
];
const TIDE = [
  { P: 197.0, a: 0.15, ph: 0.9 },
  { P: 311.0, a: 0.10, ph: 2.6 },
  { P: 83.0, a: 0.05, ph: 4.4 },
];
const CDLO = 0.5, CDHI = 1.6; // drag at the foot and at the tip, as a fraction of the stalk's own
const AXIAL = 0.1; // drag along a stalk against drag across it
const FLOAT = 2.0; // buoyancy of the top node against the others
const TIDEG = 0.7; // gain on the tide
const WARM = 24; // seconds of sea already run when the first frame is drawn

// ---- the waves
function dispersion(T) {
  const w = (2 * PI) / T;
  let k = (w * w) / G;
  for (let i = 0; i < 40; i++) k = (w * w) / (G * tanh(k * DEP));
  return k;
}

function makeWaves() {
  return TRAIN.map((d) => {
    const w = (2 * PI) / d.T, k = dispersion(d.T), cu = new Float32Array(TAB), cw = new Float32Array(TAB);
    for (let j = 0; j < TAB; j++) {
      const y = (j / (TAB - 1)) * DEP;
      cu[j] = cosh(k * (DEP - y)) / sinh(k * DEP);
      cw[j] = sinh(k * (DEP - y)) / sinh(k * DEP);
    }
    return { w, k, cu, cw, a: d.a, ph: d.ph, amp: 0, c: 0, s: 0 };
  });
}

// ---- the stalks
const LENS = [0.9, 0.62, 0.8, 0.5, 0.93, 0.7, 0.56, 0.86, 0.44, 0.75, 0.66, 0.91, 0.52, 0.78];
const LAYERS = [
  // back: thin and dark; middle; front: thick and bright
  { ridge: 114.5, n: 1.0, d0: 1.35, d1: 0.9, blade: 0, bw: 0, fog: 0.5, lsc: 0.62, g0: 0.17, alpha: 0.9, fl: 0.9 },
  { ridge: 120.5, n: 0.75, d0: 1.9, d1: 1.15, blade: 3.1, bw: 1.5, fog: 0.22, lsc: 0.82, g0: 0.52, alpha: 1.0, fl: 1.15 },
  { ridge: 126.0, n: 0.6, d0: 2.7, d1: 1.6, blade: 5.0, bw: 2.2, fog: 0.0, lsc: 1.0, g0: 0.83, alpha: 1.0, fl: 1.5 },
];
const MAXN = 14;

function hashf(i, salt) {
  return fract(sin(i * 12.9898 + salt * 78.233) * 43758.5453);
}

function ridgeAt(l, xLed) {
  const r = LAYERS[l].ridge, q = l * 1.7;
  return r + 1.5 * sin(0.19 * xLed + q) + 0.9 * sin(0.43 * xLed + 2 * q + 1.0) + 0.5 * sin(0.083 * xLed + q * 3);
}

function makeStalk(l, i) {
  const L = LAYERS[l];
  const bxLed = 3 + fract(L.g0 + i * 0.6180339887) * 58, bx = bxLed / PPM, by = ridgeAt(l, bxLed) / PPM + 0.15;
  const frac = LENS[(i + l * 5) % MAXN] * (0.97 + 0.06 * hashf(i, l + 3));
  const len = frac * by;
  const st = {
    l, i, bx, by, len, link: len / (NODES - 2),
    cd: 1.5 * (0.5 + 1.0 * hashf(i, 11 + l)),
    B: 0.5 * (0.8 + 0.4 * hashf(i, 21 + l)),
    kb: 0.4 * (0.6 + 0.8 * hashf(i, 31 + l)),
    presence: 0, target: 0,
    x: new Float64Array(NODES), y: new Float64Array(NODES), px: new Float64Array(NODES), py: new Float64Array(NODES),
    rx: new Float32Array(NODES), ry: new Float32Array(NODES),
    side: hashf(i, 41 + l) < 0.5 ? 1 : -1,
  };
  // At rest and upright.
  for (let n = 0; n < NODES; n++) {
    st.x[n] = st.px[n] = bx;
    st.y[n] = st.py[n] = by - (n - 1) * st.link;
  }
  return st;
}

export function setup(params) {
  const stalks = [];
  for (let l = 0; l < 3; l++) for (let i = 0; i < MAXN; i++) stalks.push(makeStalk(l, i));
  const shafts = [];
  for (let j = 0; j < 5; j++) {
    shafts.push({
      x0: -22 + j * 21 + 6 * (hashf(j, 61) - 0.5),
      w0: 2.3 + 2.4 * hashf(j, 62),
      gain: 0.55 + 0.45 * hashf(j, 63),
      sl: 0.85 + 0.3 * hashf(j, 64),
      p1: 27 + 19 * hashf(j, 65), p2: 61 + 31 * hashf(j, 66), p3: 11 + 6 * hashf(j, 67),
      f1: 6.28 * hashf(j, 68), f2: 6.28 * hashf(j, 69), f3: 6.28 * hashf(j, 70),
    });
  }
  params.s = {
    t: 31.7, hp: 1 / 60, waves: makeWaves(), stalks, shafts, warm: false,
    hs: 2, hsT: 2, forest: 0, sun: 0.06, hue: -1, hueT: 0,
    eta: 0, slope: 0, tideU: 0,
    buf: new Float32Array(W * H * 3), lt: new Float32Array(W * H),
    cov: new Float32Array(W * H), cov2: new Float32Array(W * H),
    t1: new Int32Array(W * H), t2: new Int32Array(W * H), n1: 0, n2: 0,
    sx: new Float32Array(600), sy: new Float32Array(600), sq: new Float32Array(600), sdx: new Float32Array(600), sdy: new Float32Array(600),
    pal: null,
  };
}

// ---- the water at a node
const wv = [0, 0];
function waterAt(S, x, y) {
  const yy = y < 0 ? 0 : y > DEP ? DEP : y;
  const fi = (yy * (TAB - 1)) / DEP, i0 = fi | 0, i1 = i0 < TAB - 1 ? i0 + 1 : i0, fr = fi - i0;
  let u = 0, v = 0;
  for (let n = 0; n < 2; n++) {
    const tr = S.waves[n];
    const ph = tr.k * x;
    // cos(k x - w t + phi) from the sin and cos of (w t - phi), held for the step
    const c = cos(ph) * tr.c + sin(ph) * tr.s, s = sin(ph) * tr.c - cos(ph) * tr.s;
    const A = tr.amp * tr.w;
    u += A * (tr.cu[i0] + (tr.cu[i1] - tr.cu[i0]) * fr) * c;
    v -= A * (tr.cw[i0] + (tr.cw[i1] - tr.cw[i0]) * fr) * s;
  }
  // The tide runs a little slower on the floor.
  u += S.tideU * cl(0.35 + (0.65 * (DEP - y)) / 8, 0.35, 1);
  wv[0] = u;
  wv[1] = v;
}

function tideOf(t) {
  let u = 0.03;
  for (const d of TIDE) u += d.a * sin((2 * PI * t) / d.P + d.ph);
  return u * TIDEG;
}

const LX = new Float64Array(NODES), LY = new Float64Array(NODES), RR = new Float64Array(NODES), DD = new Float64Array(NODES), OFF = new Float64Array(NODES), LM = new Float64Array(NODES);

function stalkStep(S, st, h, hp) {
  const { x, y, px, py } = st, M = NODES, L = st.link, vmax = 3.2 * h, ratio = h / hp;
  for (let n = 2; n < M; n++) {
    const q = (n - 1) / NFREE;
    const vx = (x[n] - px[n]) / hp, vy = (y[n] - py[n]) / hp;
    waterAt(S, st.bx, y[n]);
    let rx = wv[0] - vx, ry = wv[1] - vy;
    const sp = hypot(rx, ry);
    if (sp > 1.6) {
      rx *= 1.6 / sp;
      ry *= 1.6 / sp;
    }
    const cd = st.cd * (CDLO + (CDHI - CDLO) * q);
    const b = st.B * (n === M - 1 ? FLOAT : 1.0);
    // Drag on a slender body goes mostly with the flow across it: along the stalk it is a
    // tenth of that, so water running up or down the stalk barely loads it.
    let tx = (n < M - 1 ? x[n + 1] : x[n]) - x[n - 1], ty = (n < M - 1 ? y[n + 1] : y[n]) - y[n - 1];
    const tl = hypot(tx, ty) + 1e-9;
    tx /= tl;
    ty /= tl;
    const rt = rx * tx + ry * ty, nx = rx - rt * tx, ny = ry - rt * ty, nm = hypot(nx, ny);
    const fx = cd * (nm * nx + AXIAL * abs(rt) * rt * tx), fy = cd * (nm * ny + AXIAL * abs(rt) * rt * ty);
    // Bending: the stalk's own stiffness pulls the node toward the straight line through the two below it.
    const kb = st.kb * (1 - 0.85 * q);
    const gx = kb * (2 * x[n - 1] - x[n - 2] - x[n]), gy = kb * (2 * y[n - 1] - y[n - 2] - y[n]);
    let dx = (x[n] - px[n]) * 0.9985 * ratio + (fx + gx) * h * h;
    let dy = (y[n] - py[n]) * 0.9985 * ratio + (fy + gy - b) * h * h;
    const dm = hypot(dx, dy);
    if (dm > vmax) {
      dx *= vmax / dm;
      dy *= vmax / dm;
    }
    px[n] = x[n];
    py[n] = y[n];
    x[n] += dx;
    y[n] += dy;
    st.rx[n] += (rx - st.rx[n]) * 0.02;
    st.ry[n] += (ry - st.ry[n]) * 0.02;
  }
  // The links: every link back to its length at once, tension carried from node to node by
  // a tridiagonal solve for the force in each link (two rounds, so the lengths come out true).
  for (let round = 0; round < 2; round++) {
    const nl = M - 2;
    for (let i = 0; i < nl; i++) {
      const n = i + 1, dx = x[n + 1] - x[n], dy = y[n + 1] - y[n], d = hypot(dx, dy) + 1e-9;
      LX[i] = dx / d;
      LY[i] = dy / d;
      RR[i] = -(d - L);
      DD[i] = i === 0 ? 1 : 2;
    }
    // A lambda = -C, with A[i][i+1] = A[i+1][i] = -(d_i . d_{i+1}).
    for (let i = 1; i < nl; i++) {
      const off = -(LX[i - 1] * LX[i] + LY[i - 1] * LY[i]), m = off / DD[i - 1];
      DD[i] -= m * off;
      RR[i] -= m * RR[i - 1];
      OFF[i] = off;
    }
    LM[nl - 1] = RR[nl - 1] / DD[nl - 1];
    for (let i = nl - 2; i >= 0; i--) LM[i] = (RR[i] - OFF[i + 1] * LM[i + 1]) / DD[i];
    for (let n = 2; n < M; n++) {
      const i = n - 1;
      let ax = LM[i - 1] * LX[i - 1], ay = LM[i - 1] * LY[i - 1];
      if (i < nl) {
        ax -= LM[i] * LX[i];
        ay -= LM[i] * LY[i];
      }
      x[n] += ax;
      y[n] += ay;
    }
  }
  // Nothing leaves the sea.
  for (let n = 2; n < M; n++) {
    if (y[n] < 0.4) y[n] = 0.4;
  }
}

function physics(S, dt) {
  const n = max(1, ceil(dt / SUB)), h = dt / n;
  for (let s = 0; s < n; s++) {
    S.t += h;
    for (const tr of S.waves) {
      const a = tr.w * S.t - tr.ph;
      tr.c = cos(a);
      tr.s = sin(a);
    }
    S.tideU = tideOf(S.t);
    for (const st of S.stalks) stalkStep(S, st, h, S.hp);
    S.hp = h;
  }
  for (const st of S.stalks) {
    if (!(st.x[NODES - 1] === st.x[NODES - 1]) || !(st.y[NODES - 1] === st.y[NODES - 1])) {
      for (let n = 0; n < NODES; n++) {
        st.x[n] = st.px[n] = st.bx;
        st.y[n] = st.py[n] = st.by - (n - 1) * st.link;
      }
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06];
  S.hueT = cl(kn[0], 0, 1);
  S.hsT = cl(kn[1], 0.3, 4.5);
  S.forest = cl(kn[2], -1, 1);
  S.sun = cl(kn[3], -1, 1);
  if (!S.warm) {
    S.warm = true;
    S.hs = S.hsT;
    for (const tr of S.waves) tr.amp = tr.a * S.hs;
    for (const st of S.stalks) {
      st.target = cl(LAYERS[st.l].n * (8.5 + 5.5 * S.forest) - st.i, 0, 1);
      st.presence = st.target;
    }
    for (let i = 0; i < WARM * 30; i++) physics(S, 1 / 30);
  }
  const d = cl(dt || 0, 0, 0.1);
  S.hs += (S.hsT - S.hs) * (1 - exp(-d / 1.2));
  for (const tr of S.waves) tr.amp = tr.a * S.hs;
  const cnt = 8.5 + 5.5 * S.forest;
  for (const st of S.stalks) {
    st.target = cl(LAYERS[st.l].n * cnt - st.i, 0, 1);
    st.presence += (st.target - st.presence) * (1 - exp(-d / 0.6));
  }
  if (d > 1e-4) physics(S, d);
  if (S.hue < 0 || abs(S.hueT - S.hue) > 0.002) {
    S.hue = S.hueT;
    S.pal = palette(S.hue);
  }
  // The surface heaves and tilts with the swells.
  let eta = 0, sl = 0;
  for (const tr of S.waves) {
    const ph = tr.w * S.t - tr.ph;
    eta += tr.amp * cos(tr.k * 6.4 - ph);
    sl -= tr.amp * tr.k * sin(tr.k * 6.4 - ph);
  }
  S.eta = eta;
  S.slope = sl;
}

// ---- colour
function rgbOf(h, s, v) {
  h = fract(h / 360) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}
const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

function palette(hue) {
  const sh = hue * 190;
  const c = (h, s, v) => rgbOf(h + sh, s, v);
  const P = { water: [], ridge: [], kelp: [], blade: [] };
  // The water goes from teal at the top toward blue at the floor, and that lean fades as the
  // hue turns, so that a turned sea never runs through orange to a brown floor.
  const deep = 62 * (1 - 0.8 * hue);
  for (let y = 0; y < H; y++) {
    const z = y / PPM, A = exp(-0.06 * z), u = pow(z / DEP, 0.8);
    P.water.push(c(166 + deep * u, 0.8 + 0.12 * u, 0.1 + 0.56 * A));
  }
  P.gold = c(48, 0.62, 1.0);
  P.surf = c(172, 0.32, 1.0);
  P.float = c(66, 0.7, 1.0);
  for (let l = 0; l < 3; l++) {
    const k = [], b = [];
    const vs = [0.7, 0.88, 1.0][l];
    const stops = [
      [0.0, c(214, 0.95, 0.2 * vs)],
      [0.5, c(176 - 18 * l, 0.92, 0.5 * vs)],
      [1.0, c(140 - 8 * l, 0.88, 0.85 * vs)],
      [1.5, c(86, 0.78, 1.0 * vs)],
    ];
    const bstops = [
      [0.0, c(212, 0.95, 0.24 * vs)],
      [0.5, c(160, 0.9, 0.6 * vs)],
      [1.0, c(116, 0.86, 0.92 * vs)],
      [1.5, c(70, 0.75, 1.0 * vs)],
    ];
    for (let i = 0; i < 64; i++) {
      const t = (i / 63) * 1.5;
      for (const [arr, st] of [[k, stops], [b, bstops]]) {
        let j = 0;
        while (j < st.length - 2 && t > st[j + 1][0]) j++;
        const u = cl((t - st[j][0]) / (st[j + 1][0] - st[j][0]), 0, 1);
        arr.push(mix(st[j][1], st[j + 1][1], u));
      }
    }
    P.kelp.push(k);
    P.blade.push(b);
    P.ridge.push(c(166 + deep - [10, 20, 30][l] * (1 - hue), 0.85, [0.2, 0.26, 0.3][l]));
  }
  return P;
}

// ---- light
function lightField(S) {
  const lt = S.lt, kS = S.sun;
  const str = 0.72 + 0.4 * kS; // shaft strength
  const sl0 = tanSlant(kS);
  lt.fill(0);
  for (const sh of S.shafts) {
    const drift = 5 * sin((2 * PI * S.t) / sh.p1 + sh.f1) + 3 * sin((2 * PI * S.t) / sh.p2 + sh.f2);
    const sl = sl0 * sh.sl + 0.5 * S.slope;
    const pulse = 0.78 + 0.22 * sin((2 * PI * S.t) / sh.p3 + sh.f3);
    for (let y = 0; y < H; y++) {
      const z = y / PPM, atten = exp(-0.06 * z);
      const xc = sh.x0 + drift + sl * y, w = sh.w0 + 0.05 * y;
      const x0 = max(0, floor(xc - 2.4 * w)), x1 = min(W - 1, ceil(xc + 2.4 * w));
      const g = str * sh.gain * pulse * atten;
      for (let x = x0; x <= x1; x++) {
        const d = (x + 0.5 - xc) / w;
        lt[y * W + x] += g * exp(-d * d);
      }
    }
  }
}

function tanSlant(k) {
  // Sun height to the angle the shafts make with the vertical, after refraction.
  const air = (62 - 19 * (k + 1)) * (PI / 180), water = Math.asin(sin(air) / 1.33);
  return sin(water) / cos(water);
}

// ---- drawing
function brush(S, which, cx, cy, r) {
  const cov = which ? S.cov2 : S.cov, tch = which ? S.t2 : S.t1;
  const x0 = max(0, floor(cx - r - 0.5)), x1 = min(W - 1, ceil(cx + r - 0.5));
  const y0 = max(0, floor(cy - r - 0.5)), y1 = min(H - 1, ceil(cy + r - 0.5));
  let n = which ? S.n2 : S.n1;
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      let c = r + 0.5 - sqrt(dx * dx + dy * dy);
      if (c <= 0) continue;
      if (c > 1) c = 1;
      const i = y * W + x;
      if (c > cov[i]) {
        if (cov[i] === 0) tch[n++] = i;
        cov[i] = c;
      }
    }
  }
  if (which) S.n2 = n;
  else S.n1 = n;
}

function catmull(a, b, c, d, t, o) {
  const t2 = t * t, t3 = t2 * t;
  o[0] = 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  o[1] = 0.5 * ((-a + c) + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (-a + 3 * b - 3 * c + d) * t2);
}

const o1 = [0, 0], o2 = [0, 0];

function drawStalk(S, st, L, buf) {
  const al = st.presence * L.alpha;
  if (al < 0.01) return;
  const { x, y } = st, M = NODES;
  // Samples along the spline through the free nodes.
  let ns = 0;
  const blades = [];
  for (let n = 1; n < M - 1; n++) {
    const a = x[n - 1] * PPM, b = x[n] * PPM, c = x[n + 1] * PPM, d = x[min(n + 2, M - 1)] * PPM;
    const ay = y[n - 1] * PPM, by = y[n] * PPM, cy = y[n + 1] * PPM, dy = y[min(n + 2, M - 1)] * PPM;
    const len = hypot(c - b, cy - by), m = max(2, ceil(len / 0.8));
    for (let s = 0; s < m; s++) {
      const t = s / m;
      catmull(a, b, c, d, t, o1);
      catmull(ay, by, cy, dy, t, o2);
      const dl = hypot(o1[1], o2[1]) + 1e-9;
      S.sx[ns] = o1[0];
      S.sy[ns] = o2[0];
      S.sdx[ns] = o1[1] / dl;
      S.sdy[ns] = o2[1] / dl;
      S.sq[ns] = ((n - 1) + t) / (M - 2);
      if (s === 0 && n >= 3) blades.push([ns, n]);
      if (s === (m >> 1) && n >= 3) blades.push([ns, -n]);
      ns++;
    }
  }
  S.sx[ns] = x[M - 1] * PPM;
  S.sy[ns] = y[M - 1] * PPM;
  S.sdx[ns] = S.sdx[ns - 1];
  S.sdy[ns] = S.sdy[ns - 1];
  S.sq[ns] = 1;
  ns++;
  // Stalk body.
  S.n1 = 0;
  for (let i = 0; i < ns; i++) {
    const q = S.sq[i], r = 0.5 * (L.d0 + (L.d1 - L.d0) * q);
    brush(S, 0, S.sx[i], S.sy[i], r);
  }
  composite(S, S.cov, S.t1, S.n1, L, st, buf, false, al);
  // Blades.
  if (L.blade > 0) {
    S.n2 = 0;
    for (const [i, nn] of blades) {
      const n = abs(nn), q = S.sq[i], side = (nn > 0 ? 1 : -1) * st.side;
      const hv = hashf(n + st.i * 17, st.l * 5 + 1);
      const ang = 0.95 * side, ca = cos(ang), sa = sin(ang);
      let tx = S.sdx[i], ty = S.sdy[i];
      // The blade leaves the stalk at an angle to it and is swung downstream by the water moving past.
      let dx = tx * ca - ty * sa, dy = tx * sa + ty * ca;
      dx += 1.7 * cl(st.rx[n], -0.5, 0.5);
      dy += 1.7 * cl(st.ry[n], -0.5, 0.5);
      const dl = hypot(dx, dy) + 1e-9;
      dx /= dl;
      dy /= dl;
      const ell = L.blade * (0.72 + 0.4 * hv) * (1 - 0.35 * q), rmax = 0.5 * L.bw * (1 - 0.25 * q);
      const px = -dy * side, py = dx * side;
      const steps = max(2, ceil(ell / 0.7));
      for (let k = 0; k <= steps; k++) {
        const u = k / steps;
        const r = rmax * (0.32 + 0.68 * pow(sin(PI * pow(u, 0.72)), 0.85)) * (1 - 0.8 * u * u * u * u);
        const bow = 0.18 * ell * sin(PI * u);
        brush(S, 1, S.sx[i] + dx * u * ell + px * bow, S.sy[i] + dy * u * ell + py * bow, max(0.42, r));
      }
    }
    composite(S, S.cov2, S.t2, S.n2, L, st, buf, true, al);
  }
  // The float on the top node. The back layer is too dim to show one without it reading as dirt.
  if (st.l === 0) return;
  const fx = x[M - 1] * PPM, fy = y[M - 1] * PPM, fr = 0.5 * L.fl;
  const x0 = max(0, floor(fx - fr - 1)), x1 = min(W - 1, ceil(fx + fr + 1));
  const y0 = max(0, floor(fy - fr * 1.4 - 1)), y1 = min(H - 1, ceil(fy + fr * 1.4 + 1));
  const P = S.pal, lay = L.lay;
  for (let yy = y0; yy <= y1; yy++)
    for (let xx = x0; xx <= x1; xx++) {
      const dx = xx + 0.5 - fx, dy = (yy + 0.5 - fy) / 1.35;
      const c = cl(fr + 0.5 - hypot(dx, dy), 0, 1) * al;
      if (c <= 0) continue;
      const i = yy * W + xx, A = exp(-0.06 * (yy / PPM));
      const hi = cl(0.55 + 0.9 * S.lt[i] + 0.45 * A - 0.35 * (hypot(dx, dy) / fr) * 0, 0, 1.2);
      const f = P.float, w = P.water[yy];
      const sc = [0.62, 0.9, 1.0][lay] * (0.8 + 0.2 * hi);
      buf[i * 3] += (f[0] * sc * 255 - buf[i * 3]) * c;
      buf[i * 3 + 1] += (f[1] * sc * 255 - buf[i * 3 + 1]) * c;
      buf[i * 3 + 2] += (f[2] * sc * 255 - buf[i * 3 + 2]) * c;
    }
}

function composite(S, cov, tch, n, L, st, buf, isBlade, al) {
  const P = S.pal, lay = L.lay, lut = isBlade ? P.blade[lay] : P.kelp[lay], lt = S.lt;
  for (let k = 0; k < n; k++) {
    const i = tch[k], c = cov[i] * al;
    cov[i] = 0;
    const y = (i / W) | 0, A = exp(-0.06 * (y / PPM));
    const t = L.lsc * (0.12 + 0.62 * A + 1.0 * lt[i]) * (isBlade ? 1.08 : 1.0);
    const idx = (cl(t, 0, 1.5) / 1.5) * 63, i0 = idx | 0, i1 = min(63, i0 + 1), fr = idx - i0;
    const a = lut[i0], b = lut[i1];
    const w = P.water[y], fg = L.fog;
    const r = (a[0] + (b[0] - a[0]) * fr) * (1 - fg) + w[0] * fg;
    const g = (a[1] + (b[1] - a[1]) * fr) * (1 - fg) + w[1] * fg;
    const bl = (a[2] + (b[2] - a[2]) * fr) * (1 - fg) + w[2] * fg;
    buf[i * 3] += (r * 255 - buf[i * 3]) * c;
    buf[i * 3 + 1] += (g * 255 - buf[i * 3 + 1]) * c;
    buf[i * 3 + 2] += (bl * 255 - buf[i * 3 + 2]) * c;
  }
}

function background(S, buf) {
  const P = S.pal, lt = S.lt;
  // The surface, a bright ceiling. It heaves with the swells at its own size up to 2.4 LEDs and
  // no further, so a storm never runs the window dry.
  const heave = 2.4 * tanh((S.eta * PPM) / 7);
  for (let y = 0; y < H; y++) {
    const w = P.water[y];
    for (let x = 0; x < W; x++) {
      const i = y * W + x, L = lt[i];
      const m = min(1, 1.15 * L);
      const gl = P.gold, A = exp(-0.06 * (y / PPM));
      const lit = [w[0] * (1 + 0.5 * L), w[1] * (1 + 0.5 * L), w[2] * (1 + 0.35 * L)];
      const gcol = [gl[0] * (0.5 + 0.5 * A), gl[1] * (0.5 + 0.5 * A), gl[2] * (0.5 + 0.5 * A)];
      buf[i * 3] = (lit[0] + (gcol[0] - lit[0]) * m * 0.78) * 255;
      buf[i * 3 + 1] = (lit[1] + (gcol[1] - lit[1]) * m * 0.78) * 255;
      buf[i * 3 + 2] = (lit[2] + (gcol[2] - lit[2]) * m * 0.78) * 255;
    }
  }
  const sf = P.surf;
  for (let x = 0; x < W; x++) {
    const ys = 2.4 + heave + 0.35 * sin(0.9 * x - 2.3 * S.t) + 0.3 * sin(0.37 * x + 1.7 * S.t + 1) - 0.7 * (x - 32) * S.slope;
    for (let y = 0; y < 8; y++) {
      const c = cl(ys + 0.5 - y, 0, 1), i = y * W + x;
      if (c <= 0) continue;
      for (let ch = 0; ch < 3; ch++) buf[i * 3 + ch] += (sf[ch] * 255 * (0.75 + 0.25 * (1 - y / 8)) - buf[i * 3 + ch]) * c;
    }
  }
}

function ridge(S, l, buf) {
  const P = S.pal, col = P.ridge[l], lt = S.lt;
  for (let x = 0; x < W; x++) {
    const yr = ridgeAt(l, x + 0.5);
    for (let y = max(0, floor(yr - 1)); y < H; y++) {
      const c = cl(y + 0.5 - yr + 0.5, 0, 1);
      if (c <= 0) continue;
      const i = y * W + x, g = 1 + 0.9 * lt[i];
      buf[i * 3] += (col[0] * g * 255 - buf[i * 3]) * c;
      buf[i * 3 + 1] += (col[1] * g * 255 - buf[i * 3 + 1]) * c;
      buf[i * 3 + 2] += (col[2] * g * 255 - buf[i * 3 + 2]) * c;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.pal) return;
  const buf = S.buf;
  lightField(S);
  background(S, buf);
  for (let l = 0; l < 3; l++) {
    const L = LAYERS[l];
    L.lay = l;
    ridge(S, l, buf);
    for (const st of S.stalks) if (st.l === l) drawStalk(S, st, L, buf);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(x, y, cl(buf[i], 0, 255), cl(buf[i + 1], 0, 255), cl(buf[i + 2], 0, 255));
    }
}
