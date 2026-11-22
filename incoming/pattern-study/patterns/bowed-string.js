// ===== Patternflow pattern =====
// Title:   Bowed String
// Family:  bowing
// Idea:    One string stands the full height of the panel and a bow drags it sideways in stick and slip, run so slowly that the bright kink of the Helmholtz motion walks the string in about 2.7 seconds and leaves a leaf of afterimage behind, while the bow force, bow position and bow speed wander through Schelleng's regimes of scratching, clean bowing and raucous slips.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Helmholtz motion of a bowed string (Hermann von Helmholtz, 1863), the playable range of bow force against bow position (John C. Schelleng, 1973), and the friction-curve model of the bow-string contact (McIntyre, Schumacher and Woodhouse, 1983). The string is a digital waveguide with a bow that sticks and slips on a friction curve that falls with slip speed.
// Round:   220
// ===============================
// @matrix 64x128
// @knobs Hue=-0.1..0.5, Speed=0.5..4, Position=0.04..0.3, Force=-1..1
//
// Knob 1: Hue.
// Knob 2: Speed.
// Knob 3: Position.
// Knob 4: Force.

const W = 64, H = 128, NP = W * H;
const { floor, ceil, min, max, abs, sqrt, exp, log, pow, sin, cos } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const F32 = (n) => new Float32Array(n);
const F64 = (n) => new Float64Array(n);
const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.732;

const N = 512; // cells along the string
const PN = 0.4, PB = 0.4; // one-pole smoothing of the reflections at the nut and the bridge
const RD = 0.05; // slip friction as a share of the peak
const V0K = 0.6; // fall-off speed of the friction curve, in slip speeds (v_bow / beta)
const CAP = 0.98; // most of the free relative speed the stick can take up in one step
const T0 = 2.7; // seconds for one round trip of the kink on the full string
const CX = 32; // x of the string at rest
const FINGER_MAX = 127.5, FINGER_MIN = 80; // sounding length, rows

// Bow force that puts the motion in the middle of its window, against bow position: f = F beta / 2 in units of Z v_bow.
const FC_B = [0.03, 0.04, 0.06, 0.08, 0.1, 0.13, 0.17, 0.2, 0.25, 0.3, 0.35];
const FC_V = [7.5, 6, 4.5, 3, 1.8, 0.8, 0.6, 0.6, 0.5, 0.4, 0.35];
function fcAt(b) {
  let i = 0;
  while (i < FC_B.length - 2 && b > FC_B[i + 1]) i++;
  const t = cl((b - FC_B[i]) / (FC_B[i + 1] - FC_B[i]), 0, 1);
  return exp(mix(log(FC_V[i]), log(FC_V[i + 1]), t));
}

// ---- colour
function hsv(h, s, v, out) {
  h -= floor(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  out[0] = f(5);
  out[1] = f(3);
  out[2] = f(1);
}
function rgb2hsv(r, g, b, out) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-9) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  out[0] = h;
  out[1] = mx > 0 ? d / mx : 0;
  out[2] = mx;
}
// brass, heat 0 to 1.25: the colour a lit LED takes as the picture gets brighter
const HEAT_STOPS = [
  [0.0, 20, 9, 3],
  [0.07, 40, 17, 4],
  [0.2, 92, 40, 8],
  [0.38, 164, 82, 14],
  [0.58, 222, 140, 30],
  [0.8, 255, 196, 78],
  [1.0, 255, 226, 138],
  [1.25, 255, 246, 214],
];
const HLUT = 400;

export function setup(params) {
  const S = {
    t: 0, ready: false, carry: 0,
    R: F64(N + 1), L: F64(N + 1), y: F64(N + 1), yd: F32(N + 1),
    ny: 0, by: 0, ib: N - 20, beta: 0.04, Fs: 10, v0: 10, Fd: 1, fb: 0, lastF: 0,
    slipSteps: 0, steps: 0, slipFrac: 0, slipSm: 0, shape: false,
    // knobs and the random walks that wander round them
    k1: 0, k2: 2, k3: 0.04, k4: 0.06,
    wb: 0, wf: 0, wv: 0, wh: 0,
    f: 4, vb: 1,
    // glissando
    Lr: FINGER_MAX, Lv: 0, Lt: FINGER_MAX, Ltime: 18 + 14 * Math.random(),
    G: 0.01, amp: 10, lim: 1,
    A_s: F32(NP), A_k: F32(NP), now: F32(NP), tmp: F32(NP), bl1: F32(NP), bl2: F32(NP), band: F32(NP * 3),
    lut: F32(HLUT * 3), lutKey: -1,
    texPh: 0, bowRow: 100, bowX: 0, kinks: [],
    hw: 1.1,
  };
  S.lutS = [0, 0, 0];
  params.s = S;
}

function readKnobs(S, k) {
  S.k1 = cl(k[0], -0.1, 0.5);
  S.k2 = cl(k[1], 0.5, 4);
  S.k3 = cl(k[2], 0.04, 0.3);
  S.k4 = cl(k[3], -1, 1);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.04, 0.06], d = cl(dt || 0, 0, 0.1);
  readKnobs(S, k);
  if (!S.ready) {
    S.ready = true;
    prerun(S);
  }
  advance(S, d, true);
}

// ---- the wandering
// Ornstein-Uhlenbeck walks: tau seconds of memory, sigma of spread.
function ou(x, dt, tau, sigma) {
  const kk = exp(-dt / tau);
  return x * kk + sigma * sqrt(1 - kk * kk) * gauss();
}

function wander(S, dt) {
  S.wb = cl(ou(S.wb, dt, 55, 0.2), -0.35, 0.35);
  S.wf = ou(S.wf, dt, 42, 0.55);
  S.wv = cl(ou(S.wv, dt, 38, 0.2), -0.4, 0.4);
  S.wh = ou(S.wh, dt, 70, 0.02);
  // the finger
  S.Ltime -= dt;
  if (S.Ltime <= 0) {
    const open = Math.random() < 0.35;
    S.Lt = open ? FINGER_MAX - 4 * Math.random() : FINGER_MIN + 40 * Math.random();
    S.Ltime = 13 + 24 * Math.random();
  }
  const w = 1 / 2.4;
  S.Lv += ((S.Lt - S.Lr) * w * w - 2 * w * S.Lv) * dt;
  S.Lr = cl(S.Lr + S.Lv * dt, FINGER_MIN - 2, FINGER_MAX);
  // the bow
  const beta = cl(S.k3 * exp(S.wb), 0.033, 0.34);
  const m = cl(Math.round(beta * N), 14, 170);
  S.ib = N - m;
  S.beta = m / N;
  S.f = fcAt(S.beta) * exp(1.9 * (S.k4 - 0.06) + S.wf);
  S.Fs = (S.f * 2) / S.beta;
  S.Fd = RD * S.Fs;
  S.v0 = V0K / S.beta;
  S.vb = (S.k2 / 2) * exp(S.wv);
}

// ---- the string: right- and left-going velocity waves on N cells, a bow at one cell
function stepSim(S) {
  const R = S.R, L = S.L, ib = S.ib;
  R.copyWithin(1, 0, N);
  L.copyWithin(0, 1, N + 1);
  S.ny = (1 - PN) * L[0] + PN * S.ny;
  R[0] = -S.ny;
  S.by = (1 - PB) * R[N] + PB * S.by;
  L[N] = -S.by;
  if (S.shape) {
    // slope of the string between cells, before this step's push of the bow: y(i+1) - y(i) = L[i] - R[i+1]
    const y = S.y;
    y[0] = 0;
    const h = S.lastF * 0.5;
    for (let i = 0; i < N; i++) {
      let li = L[i], rn = R[i + 1];
      if (i === ib) li -= h;
      if (i + 1 === ib) rn -= h;
      y[i + 1] = y[i] + li - rn;
    }
    S.shape = false;
  }
  const vf = R[ib] + L[ib];
  const u = 1 - vf, au = u < 0 ? -u : u;
  const q = 1 + au / S.v0;
  const fslide = S.Fd + (S.Fs - S.Fd) / (q * q * q);
  const fstick = (CAP * au) / 0.5;
  let F;
  if (fstick <= fslide) F = u < 0 ? -fstick : fstick;
  else {
    F = u < 0 ? -fslide : fslide;
    S.slipSteps++;
  }
  S.steps++;
  S.lastF = F;
  const h = F * 0.5;
  R[ib] += h;
  L[ib] += h;
}

// run the string for dt seconds of the picture, then read its shape
function advance(S, dt, draw) {
  S.t += dt;
  wander(S, dt);
  const ts = T0 * (S.Lr / FINGER_MAX);
  S.carry += ((2 * N + 2) / ts) * dt;
  const n = floor(S.carry);
  S.carry -= n;
  S.slipSteps = 0;
  S.steps = 0;
  for (let i = 0; i < n; i++) {
    if (i === n - 1) S.shape = true;
    stepSim(S);
  }
  // mean bow force, to take the sag under it out of the picture
  S.fb += (S.lastF - S.fb) * (1 - exp(-dt / (2.5 * ts)));
  const frac = S.steps > 0 ? S.slipSteps / S.steps : S.slipFrac;
  S.slipFrac = frac;
  S.slipSm = frac > S.slipSm ? frac : S.slipSm + (frac - S.slipSm) * (1 - exp(-dt / 0.3));
  shapeOut(S);
  if (draw) paint(S, dt);
}

// y in sim units, minus the static triangle that the mean bow force pulls, scaled to LEDs
function shapeOut(S) {
  const y = S.y, yd = S.yd, ib = S.ib, fb = S.fb;
  const yN = y[N];
  const gOff = fb * 0; // the sag under the mean force
  let mx = 0;
  for (let i = 0; i <= N; i++) {
    const tri = i <= ib ? (i * (N - ib)) / N : (ib * (N - i)) / N;
    const v = y[i] - fb * tri - (yN * i) / N + gOff;
    yd[i] = v;
    const a = v < 0 ? -v : v;
    if (a > mx) mx = a;
  }
  // gain: the Helmholtz amplitude is v_bow N / (4 beta); show it compressed so a wide range of speeds and positions stays on the panel
  const ypred = (S.vb * N) / (4 * S.beta), yref = N / (4 * 0.04);
  const A = 16 * pow(ypred / yref, 0.55) * (S.Lr / FINGER_MAX);
  let G = A / (ypred * 1.0);
  const ex = mx * G;
  const want = ex > 22 ? 22 / ex : 1;
  S.lim = want < S.lim ? want : S.lim + (want - S.lim) * 0.02;
  S.G = G * S.lim;
  S.amp = mx * S.G;
}

// ---- the picture
function lutBuild(S) {
  const key = S.k1 + S.wh;
  if (abs(key - S.lutKey) < 1e-4) return;
  S.lutKey = key;
  const tmp = [0, 0, 0], hv = [0, 0, 0], out = [0, 0, 0];
  const lut = S.lut;
  const base = 0;
  for (let i = 0; i < HLUT; i++) {
    const h = (i / (HLUT - 1)) * 1.25;
    let j = 0;
    while (j < HEAT_STOPS.length - 2 && h > HEAT_STOPS[j + 1][0]) j++;
    const a = HEAT_STOPS[j], b = HEAT_STOPS[j + 1], t = cl((h - a[0]) / (b[0] - a[0]), 0, 1);
    tmp[0] = mix(a[1], b[1], t) / 255;
    tmp[1] = mix(a[2], b[2], t) / 255;
    tmp[2] = mix(a[3], b[3], t) / 255;
    rgb2hsv(tmp[0], tmp[1], tmp[2], hv);
    hsv(hv[0] + key + base, hv[1], hv[2], out);
    lut[i * 3] = out[0] * 255;
    lut[i * 3 + 1] = out[1] * 255;
    lut[i * 3 + 2] = out[2] * 255;
  }
}

function blurPass(src, dst, r, tmp) {
  // box blur, horizontal then vertical, edges clamped
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[o + cl(x, 0, W - 1)];
    for (let x = 0; x < W; x++) {
      tmp[o + x] = acc * inv;
      acc += src[o + min(W - 1, x + r + 1)] - src[o + max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[cl(y, 0, H - 1) * W + x];
    for (let y = 0; y < H; y++) {
      dst[y * W + x] = acc * inv;
      acc += tmp[min(H - 1, y + r + 1) * W + x] - tmp[max(0, y - r) * W + x];
    }
  }
}

function paint(S, dt) {
  const { yd, now, A_s, A_k } = S;
  const Lr = S.Lr, top = FINGER_MAX - Lr + 0.0, cell = Lr / N;
  const G = S.G, hw = S.hw;
  now.fill(0);
  // where the string is, row by row: the string is drawn from its position at three heights inside the row
  const xs = S.xrow || (S.xrow = F32(H * 2));
  for (let r = 0; r < H; r++) {
    let lo = 0, hi = 0;
    for (let s = 0; s < 3; s++) {
      const yy = r + 0.17 + 0.33 * s;
      let d = 0;
      if (yy > top) {
        const fi = cl(((yy - top) / Lr) * N, 0, N - 1e-6), i0 = floor(fi), tt = fi - i0;
        d = (yd[i0] * (1 - tt) + yd[i0 + 1] * tt) * G;
      }
      if (s === 0 || d < lo) lo = d;
      if (s === 0 || d > hi) hi = d;
    }
    xs[r * 2] = CX + lo;
    xs[r * 2 + 1] = CX + hi;
    const dead = r + 0.5 < top;
    const o = r * W;
    const x0 = max(0, floor(CX + lo - hw - 1.5)), x1 = min(W - 1, ceil(CX + hi + hw + 1.5));
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const dist = max(0, CX + lo - px, px - (CX + hi));
      const a = sm(0, 1, hw + 0.5 - dist), c = sm(0, 1, 0.55 + 0.5 - dist);
      let v = 0.72 * a + 0.5 * c;
      if (dead) v *= 0.16;
      now[o + x] = v;
    }
  }
  // sparks at the kinks: where the slope changes fastest
  kinksOut(S, cell);
  const sparks = S.kinks;
  for (const kk of sparks) {
    const q = kk.q;
    const cx = CX + kk.x, cy = kk.y;
    const rr = 6;
    const xa = max(0, floor(cx - rr)), xb = min(W - 1, ceil(cx + rr)), ya = max(0, floor(cy - rr)), yb = min(H - 1, ceil(cy + rr));
    for (let y = ya; y <= yb; y++)
      for (let x = xa; x <= xb; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d2 = dx * dx + dy * dy;
        const v = q * (0.95 * exp(-d2 / 2.4) + 0.28 * exp(-d2 / 14));
        const p = y * W + x;
        if (v > tmpK[p]) tmpK[p] = v;
      }
  }
  // afterimages: the string and the kink, each held and fading
  const ds = exp(-dt / 2.6), dk = exp(-dt / 4.4);
  for (let p = 0; p < NP; p++) {
    const sv = now[p] * 0.34;
    A_s[p] = max(A_s[p] * ds, sv);
    const kv = tmpK[p];
    A_k[p] = max(A_k[p] * dk, kv * 0.85);
    tmpK[p] = 0;
    now[p] = max(now[p], kv);
  }
}

const tmpK = F32(NP);

function kinksOut(S, cell) {
  const yd = S.yd, G = S.G, Lr = S.Lr, top = FINGER_MAX - Lr;
  // slope in LEDs sideways per row, and its change over 3 cells either side
  const span = 3, sl = S.slope || (S.slope = F32(N + 1)), cv = S.curv || (S.curv = F32(N + 1));
  for (let i = 0; i < N; i++) sl[i] = ((yd[i + 1] - yd[i]) * G) / cell;
  sl[N] = sl[N - 1];
  let best = 0;
  for (let i = span; i <= N - span; i++) {
    const c = abs(sl[min(N, i + span - 1)] - sl[max(0, i - span)]);
    cv[i] = c;
  }
  const out = [];
  const sep = max(10, floor(5 / cell));
  for (let i = span + 2; i <= N - span - 2; i++) {
    const c = cv[i];
    if (c < 0.05) continue;
    let isMax = true;
    for (let j = max(span, i - sep); j <= min(N - span, i + sep); j++) if (cv[j] > c || (cv[j] === c && j < i)) { isMax = false; break; }
    if (!isMax) continue;
    out.push({ x: yd[i] * G, y: top + (i / N) * Lr, q: pow(cl(c / 0.22, 0, 1), 0.7) });
  }
  out.sort((a, b) => b.q - a.q);
  S.kinks = out.slice(0, 7);
}

function prerun(S) {
  // let the string settle into its motion at the opening knobs, then let the afterimages fill
  const dt = 1 / 30;
  S.wb = 0;
  S.wf = 0;
  S.wv = 0;
  S.Lt = FINGER_MAX;
  S.Ltime = 20 + 12 * Math.random();
  const hold = { wb: 0, wf: 0, wv: 0 };
  const total = 50, fill = 14;
  for (let t = 0; t < total; t += dt) {
    advance(S, dt, t > total - fill);
    if (t < 12) {
      S.wb *= 0.2;
      S.wf *= 0.2;
      S.wv *= 0.2;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  lutBuild(S);
  const { now, A_s, A_k, bl1, bl2, tmp, lut } = S;
  // soft light round everything lit
  for (let p = 0; p < NP; p++) tmp[p] = max(now[p], A_s[p], A_k[p]);
  const src = S.src || (S.src = F32(NP));
  blurPass(tmp, bl1, 3, src);
  blurPass(tmp, bl2, 9, src);
  const hs = HLUT - 1;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const heat = max(now[p], A_s[p], A_k[p] * 1.0) + 0.2 * bl1[p] + 0.3 * bl2[p];
      const i = cl(heat, 0, 1.25) * (hs / 1.25) | 0;
      display.setPixel(x, y, lut[i * 3], lut[i * 3 + 1], lut[i * 3 + 2]);
    }
}
