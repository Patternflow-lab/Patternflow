// ===== Patternflow pattern =====
// Title:   Spiral Breakup
// Family:  chemistry
// Idea:    An excitable medium on the panel's own torus keeps shedding new spiral tips, so thin bright fronts curve, collide and vanish over dark ground, leaving orange-to-teal refractory tails.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Barkley model of excitable media, Dwight Barkley (1991), and its spiral-turbulence variant of Markus Bar and Markus Eiswirth (1993, with the piecewise recovery source), all names and years from memory
// Round:   117
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..3, Scale=-1..1, Threshold=-1..1
//
// Knob 1: Hue.
// Knob 2: Flow.
// Knob 3: Scale.
// Knob 4: Threshold.

const W = 64, H = 128, N = W * H;
const { floor, ceil, max, min, abs, sqrt, exp, pow, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const CFG = {
  a0: 0.84,
  b0: 0.1, // b at Threshold 0
  bK: 0.035, // b changes by this much from Threshold 0 to 1
  eps: 0.085,
  dx0: 0.8,
  dxK: 1.27, // dx = dx0 * dxK^-Scale
  c0: 1.2, // model time units per panel second per unit of Flow
  hmax: 0.04,
  pre: 30, // model time run before the first frame
  follow: 0.35,
  actMin: 0.05, // activity (fraction with u > 0.5) under which an ectopic beat may fire
  stimR: 2.0, // radius of the stimulus in model units
  foci: 8, // discs per ectopic beat
  s2delay: 3.5, // model time between S1 and S2
};

// ---- the medium -----------------------------------------------------------------------------
function newState() {
  return {
    u: new Float64Array(N), un: new Float64Array(N), v: new Float64Array(N),
    dx: CFG.dx0, a: CFG.a0, b: CFG.b0, acc: 0, act: 0.3, quiet: 0, pending: -1, hue: 0, lutHue: -1,
    lut: new Float32Array(33 * 33 * 3), cand: new Int32Array(N), beats: 0,
  };
}

function step(S, h) {
  const u = S.u, un = S.un, v = S.v, a = CFG.a0, b = S.b;
  const Dd = h / (S.dx * S.dx), dte = h / CFG.eps, ia = 1 / a;
  for (let y = 0; y < H; y++) {
    const y0 = y * W, ym = (y === 0 ? H - 1 : y - 1) * W, yp = (y === H - 1 ? 0 : y + 1) * W;
    for (let x = 0; x < W; x++) {
      const i = y0 + x;
      const xm = x === 0 ? y0 + W - 1 : i - 1, xp = x === W - 1 ? y0 : i + 1;
      const c = u[i], vv = v[i];
      un[i] = c + Dd * (u[xm] + u[xp] + u[ym + x] + u[yp + x] - 4 * c) + dte * c * (1 - c) * (c - (vv + b) * ia);
      const g = c < 0.3333333333 ? 0 : c > 1 ? 1 : 1 - 6.75 * c * (c - 1) * (c - 1);
      v[i] = vv + h * (g - vv);
    }
  }
  S.u = un;
  S.un = u;
}

function disc(S, cx, cy, r) {
  const rl = r / S.dx;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let dx = x - cx, dy = y - cy;
      dx -= W * Math.round(dx / W);
      dy -= H * Math.round(dy / H);
      if (dx * dx + dy * dy < rl * rl) S.u[y * W + x] = 1;
    }
}

// An ectopic beat, the S1-S2 way a physiologist starts a spiral. A quiet medium gets a disc of u at a random place (S1), and a
// ring wave leaves it. A moment later a second disc (S2) goes where the ring's wake has recovered half way (v between 0.3 and
// 0.55, u at rest): the wave it makes runs back into recovered tissue and not forward into the wake, so it is open at one end
// and curls into a spiral pair.
function ectopic(S) {
  const u = S.u, v = S.v, cand = S.cand;
  let m = 0;
  for (let i = 0; i < N; i++) if (u[i] < 0.05 && v[i] > 0.3 && v[i] < 0.55) cand[m++] = i;
  if (m > 0) {
    for (let k = 0; k < CFG.foci; k++) {
      const i = cand[(Math.random() * m) | 0];
      disc(S, i % W, (i / W) | 0, CFG.stimR);
    }
    S.pending = -1;
  } else if (S.pending < 0) {
    for (let k = 0; k < CFG.foci; k++) disc(S, Math.random() * W, Math.random() * H, CFG.stimR);
    S.pending = CFG.s2delay;
  }
}

function seed(S) {
  const { u, v } = S;
  u.fill(0);
  v.fill(0);
  for (let k = 0; k < 10; k++) {
    const cx = Math.random() * W, cy = Math.random() * H, ang = Math.random() * TAU;
    const rr = (6 * (0.6 + 0.8 * Math.random())) / S.dx;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let dx = x - cx, dy = y - cy;
        dx -= W * Math.round(dx / W);
        dy -= H * Math.round(dy / H);
        if (dx * dx + dy * dy < rr * rr) {
          if (dx * cos(ang) + dy * sin(ang) > 0) u[y * W + x] = 1;
          else v[y * W + x] = 0.6;
        }
      }
  }
}

export function setup(params) {
  const S = (params.s = newState());
  seed(S);
  buildLut(S, 0);
  for (let n = 0; n < CFG.pre / CFG.hmax; n++) step(S, CFG.hmax);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  if (!params.s) setup(params);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.5, 3);
  S.hue = k[0];
  const f = 1 - exp(-ft / CFG.follow);
  S.dx += (CFG.dx0 * pow(CFG.dxK, -cl(k[2], -1, 1)) - S.dx) * f;
  S.b += (CFG.b0 + CFG.bK * cl(k[3], -1, 1) - S.b) * f;
  S.acc += ft * flow * CFG.c0;
  const hh = min(CFG.hmax, 0.2 * S.dx * S.dx);
  let n = floor(S.acc / hh);
  S.acc -= n * hh;
  while (n-- > 0) step(S, hh);
  let c = 0;
  for (let i = 0; i < N; i++) if (S.u[i] > 0.5) c++;
  S.act = c / N;
  // Ectopic beats only while the medium is nearly quiet, and not twice within a second of panel time.
  S.quiet = max(0, S.quiet - ft);
  if (S.pending >= 0) {
    S.pending -= ft * flow * CFG.c0;
    if (S.pending < 0) {
      S.pending = -1;
      ectopic(S);
      S.beats++;
    }
  } else if (S.act < CFG.actMin && S.quiet <= 0) {
    ectopic(S);
    S.beats++;
    S.quiet = 1;
  }
}

// ---- colour ---------------------------------------------------------------------------------
function okRgb(L, C, h, out) {
  const hr = (h * PI) / 180;
  for (let k = 1; k >= 0; k -= 0.05) {
    const a = C * k * cos(hr), b = C * k * sin(hr);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    if (k < 0.01 || (r > -0.002 && r < 1.002 && g > -0.002 && g < 1.002 && bb > -0.002 && bb < 1.002)) {
      out[0] = r;
      out[1] = g;
      out[2] = bb;
      return;
    }
  }
}
const enc = (v) => {
  v = cl(v, 0, 1);
  return ((v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055) * 255 + 0.5) | 0;
};
const RGB = [0, 0, 0];
// tail colour by v: [v, L, C, h]
const TAIL = [
  [0, 0.0, 0.0, 220],
  [0.03, 0.25, 0.055, 225],
  [0.12, 0.4, 0.085, 205],
  [0.3, 0.52, 0.1, 190],
  [0.5, 0.58, 0.12, 130],
  [0.65, 0.6, 0.14, 70],
  [1, 0.6, 0.14, 55],
];
const CREAM = [0.97, 0.06, 95], AMBER = [0.66, 0.15, 60];

function buildLut(S, hue) {
  S.lutHue = hue;
  const lut = S.lut;
  for (let iv = 0; iv <= 32; iv++) {
    const v = (iv / 32) * 0.9;
    let j = 1;
    while (j < TAIL.length - 1 && v > TAIL[j][0]) j++;
    const A = TAIL[j - 1], B = TAIL[j], t = cl((v - A[0]) / (B[0] - A[0]), 0, 1);
    const tl = A[1] + (B[1] - A[1]) * t, tc = A[2] + (B[2] - A[2]) * t, th = A[3] + (B[3] - A[3]) * t;
    const q = 1 - sm(0.3, 0.8, v);
    for (let iu = 0; iu <= 32; iu++) {
      const s = sm(0.4, 0.9, iu / 32);
      // mix in Oklab (a, b) so the middle does not pass through green
      const ta = tc * cos((th * PI) / 180), tb = tc * sin((th * PI) / 180);
      const fL = AMBER[0] + (CREAM[0] - AMBER[0]) * q, fC = AMBER[1] + (CREAM[1] - AMBER[1]) * q, fH = AMBER[2] + (CREAM[2] - AMBER[2]) * q;
      const fa = fC * cos((fH * PI) / 180), fb = fC * sin((fH * PI) / 180);
      const L = tl + (fL - tl) * s, aa = ta + (fa - ta) * s, bb = tb + (fb - tb) * s;
      const C = sqrt(aa * aa + bb * bb), h = (Math.atan2(bb, aa) * 180) / PI + hue * 360;
      okRgb(L, C, h, RGB);
      const o = (iv * 33 + iu) * 3;
      lut[o] = enc(RGB[0]);
      lut[o + 1] = enc(RGB[1]);
      lut[o + 2] = enc(RGB[2]);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const hue = cl(S.hue, 0, 1);
  if (S.lutHue !== hue) buildLut(S, hue);
  const { u, v, lut } = S;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const fu = cl(u[i], 0, 1) * 32, fv = cl(v[i] / 0.9, 0, 1) * 32;
      const iu = min(31, fu | 0), iv = min(31, fv | 0), tu = fu - iu, tv = fv - iv;
      const o00 = (iv * 33 + iu) * 3, o10 = o00 + 3, o01 = o00 + 99, o11 = o01 + 3;
      const w00 = (1 - tu) * (1 - tv), w10 = tu * (1 - tv), w01 = (1 - tu) * tv, w11 = tu * tv;
      display.setPixel(
        x, y,
        (lut[o00] * w00 + lut[o10] * w10 + lut[o01] * w01 + lut[o11] * w11 + 0.5) | 0,
        (lut[o00 + 1] * w00 + lut[o10 + 1] * w10 + lut[o01 + 1] * w01 + lut[o11 + 1] * w11 + 0.5) | 0,
        (lut[o00 + 2] * w00 + lut[o10 + 2] * w10 + lut[o01 + 2] * w01 + lut[o11 + 2] * w11 + 0.5) | 0,
      );
    }
}
