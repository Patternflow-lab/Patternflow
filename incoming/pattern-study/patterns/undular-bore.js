// ===== Patternflow pattern =====
// Title:   Undular Bore
// Family:  tidalbore
// Idea:    placeholder
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: placeholder
// Round:   259
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tide=0..4, Whelps=-2..2, Bend=-1..1
//
// Knob 1: placeholder
// Knob 2: placeholder
// Knob 3: placeholder
// Knob 4: placeholder

const W = 64, H = 128;
const PT = 18, YS = 28, PS = 14; // rows above the panel (a sponge), rows between the panel and the source line, sponge rows below the source
const NY = PT + H + YS + 1 + PS, JS = PT + H + YS; // the grid is 64 wide and NY rows; the source line is row JS
const N = W * NY, OFF = W, NA = N + 2 * W; // one padded row in front and behind, so i - 1 and i - W stay inside the arrays
const DT = 1 / 50;
const { floor, sqrt, abs, exp, sin, cos, pow, min, max, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the medium
const C0 = 7; // LEDs a second over water of depth 1
const B0 = 1.0; // dispersion length squared (h^2 / 3 in the textbooks), LED^2, for depth 1 at K3 = 0
const GN = 3; // amplitude dependence of the speed: c^2 goes as 1 + 6 eta
const HMIN = 0.0002; // depth of the bank: next to none, so the water does not run up it
const SIG0 = 0.04; // the water's own damping, 1/s
const NU0 = 0.08; // viscosity on the water's speed, LED^2/s
const SIG_LAND = 1.4;
const SIG_TOP = 7, SIG_BOT = 8;
const KAPPA = 1.5; // how hard the source line pulls the water at the source back to the level the tide asks for, 1/s

function makeState() {
  const S = {
    ready: false, kn: [0, 2, 0, 0.06], acc: 0, clk: 0, geoT: 9, frameDt: 1 / 30,
    eta: new Float32Array(NA), etp: new Float32Array(NA), rhs: new Float32Array(NA), tmp: new Float32Array(NA),
    cx: new Float32Array(NA), cy: new Float32Array(NA), beta: new Float32Array(NA), bfx: new Float32Array(NA), bfy: new Float32Array(NA),
    cpx: new Float32Array(NA), dnx: new Float32Array(NA), cpy: new Float32Array(NA), dny: new Float32Array(NA),
    sg1: new Float32Array(NA), sg2: new Float32Array(NA), pd: new Float32Array(NA), dwA: new Float32Array(NA), sdA: new Int8Array(NA),
    sw: new Float32Array(W),
    foam: new Float32Array(NA), wet: new Float32Array(NA), etaS: new Float32Array(NA), etaB: new Float32Array(NA), tmp2: new Float32Array(NA),
    pulses: [], plan: 0, base: 0, lastAmp: 0.2, lvl: 0, lvlSm: 0, ebbAt: -1, ebbT: 10, nextAt: 0, bend: 0.06, bendT: 0.06,
    ph: [], o1: 0, o2: 0, g2: C0 * C0, spd: 1, cm: 1, beta0: B0, nu: NU0, sigDt: 0,
    lut: new Float32Array(256 * 3), hueAt: -1, hueMat: new Float32Array(9),
    tg1x: new Float32Array(W * H), tg1y: new Float32Array(W * H), tg2x: new Float32Array(W * H), tg2y: new Float32Array(W * H),
    bt: new Float32Array(64 * H), nt: new Float32Array(W * H),
    baseRow: new Float32Array(H + YS), cloud: new Float32Array(17 * 33), cw: [],
  };
  for (let k = 0; k < 6; k++) S.ph.push(Math.random() * TAU);
  for (let k = 0; k < 5; k++) { // plane waves of the cloud cover: wave vector, drift rate, phase
    const a = Math.random() * TAU, lam = 38 + 55 * Math.random(), kk = TAU / lam, v = 1.2 + 2.2 * Math.random(), d = Math.random() * TAU;
    S.cw.push([kk * cos(a), kk * sin(a), kk * v * (0.9 + 0.2 * Math.random()), Math.random() * TAU, d]);
  }
  makeTiles(S);
  return S;
}

// Periodic noise tiles from sums of plane waves with whole wave numbers.
function planeTile(w, h, comps, fn) {
  const waves = [];
  for (let k = 0; k < comps; k++) {
    const q = fn(k);
    waves.push([TAU * q[0] / w, TAU * q[1] / h, Math.random() * TAU, q[2]]);
  }
  return waves;
}

function makeTiles(S) {
  // current ripples: slopes of a field whose crests lie across the flow (wave number mostly along y)
  const mk = (gxA, gyA, comps, kx, ky) => {
    const ws = planeTile(W, H, comps, () => [floor(kx[0] + Math.random() * (kx[1] - kx[0] + 1)) * (Math.random() < 0.5 ? -1 : 1), floor(ky[0] + Math.random() * (ky[1] - ky[0] + 1)), 0.6 + Math.random() * 0.8]);
    let m = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let gx = 0, gy = 0;
        for (let k = 0; k < comps; k++) {
          const q = ws[k], c = -sin(q[0] * x + q[1] * y + q[2]) * q[3];
          gx += c * q[0];
          gy += c * q[1];
        }
        gxA[y * W + x] = gx;
        gyA[y * W + x] = gy;
        m = max(m, gx * gx + gy * gy);
      }
    }
    const nrm = 1 / sqrt(m / 4); // unit rms is roughly this
    for (let i = 0; i < W * H; i++) {
      gxA[i] *= nrm;
      gyA[i] *= nrm;
    }
  };
  mk(S.tg1x, S.tg1y, 12, [1, 5], [8, 17]); // wavelengths 128/8..128/17 = 7.5 to 16 along y
  mk(S.tg2x, S.tg2y, 10, [1, 4], [4, 10]); // 13 to 32
  // bank and foam noise: smooth fields in [0, 1]
  const field = (arr, w, comps, kx, ky) => {
    const ws = planeTile(64, H, comps, () => [floor(kx[0] + Math.random() * (kx[1] - kx[0] + 1)) * (Math.random() < 0.5 ? -1 : 1), floor(ky[0] + Math.random() * (ky[1] - ky[0] + 1)), 0.6 + Math.random() * 0.8]);
    let tot = 0;
    for (let k = 0; k < comps; k++) tot += ws[k][3] * ws[k][3];
    const sd = sqrt(tot / 2);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < w; x++) {
        let v = 0;
        for (let k = 0; k < comps; k++) v += sin(ws[k][0] * x + ws[k][1] * y + ws[k][2]) * ws[k][3];
        arr[y * w + x] = cl(0.5 + (0.5 * v) / (2 * sd), 0, 1);
      }
    }
  };
  field(S.bt, 64, 12, [2, 9], [3, 14]);
  field(S.nt, W, 12, [4, 14], [6, 22]);
}

export function setup(params) {
  params.s = makeState();
}

// ---- the channel: its centre line, a pair of banks, and the depth between them

function bars(x, y, ph) {
  return 0.5 * sin(0.21 * x + 0.13 * y + ph[0]) + 0.35 * sin(-0.13 * x + 0.23 * y + ph[1]) + 0.3 * sin(0.31 * x - 0.07 * y + ph[2]);
}

function buildGeometry(S) {
  const t = S.clk, ph = S.ph;
  const a1 = S.bend * 11;
  const p1 = ph[0] - 0.016 * t + 0.5 * sin(TAU * t / 173 + ph[3]), p2 = ph[1] - 0.045 * t + 0.8 * sin(TAU * t / 131 + ph[4]), p3 = ph[2] - 0.075 * t + 1.1 * sin(TAU * t / 97 + ph[5]);
  const barPh = [ph[0] + 0.04 * t, ph[1] - 0.035 * t, ph[2] + 0.05 * t];
  const bm = S.beta0;
  const pd = S.pd, dwA = S.dwA, sdA = S.sdA, cx = S.cx, cy = S.cy, beta = S.beta, c2 = S.tmp2;
  const centre = (y, hw) => {
    const dev = a1 * sin(TAU * y / 120 + p1) + 3.4 * sin(TAU * y / 71 + p2) + 1.8 * sin(TAU * y / 43 + p3);
    const m = 29 - hw - 0.5;
    return 32 + m * tanh(dev / m);
  };
  const half = (y) => 17 + 1.5 * sin(TAU * y / 37 + p2 * 1.3 + 1) + 1.0 * sin(TAU * y / 23 + p3 * 0.7 + 4);
  for (let j = 0; j < NY; j++) {
    const y = j - PT, hw = half(y), xc = centre(y, hw);
    const m = (centre(y + 1, half(y + 1)) - centre(y - 1, half(y - 1))) * 0.5, cs = 1 / sqrt(1 + m * m);
    const xl = xc - hw, xr = xc + hw;
    const g = 0.6 + 0.4 * cl((y + PT) / (H + YS + PT), 0, 1);
    for (let x = 0; x < W; x++) {
      const i = OFF + j * W + x, dl = x - xl, dr = xr - x;
      const dw = (dl < dr ? dl : dr) * cs;
      dwA[i] = dw;
      sdA[i] = dl < dr ? 1 : -1;
      const e1 = sm(-0.4, 2.2, dw), e2 = sm(1, 15, dw);
      let p = 0.66 * e1 + 0.34 * e2;
      p = HMIN + (p - 0) * (1 - HMIN) * g * (1 + 0.14 * bars(x, y, barPh));
      if (p < HMIN) p = HMIN;
      pd[i] = p;
      c2[i] = p;
      beta[i] = bm * p * p;
    }
  }
  for (let j = 0; j < NY; j++) {
    for (let x = 0; x < W; x++) {
      const i = OFF + j * W + x, a = c2[i];
      if (x < W - 1) { const b = c2[i + 1]; cx[i] = (2 * a * b) / (a + b); } else cx[i] = 0;
      if (j < NY - 1) { const b = c2[i + W]; cy[i] = (2 * a * b) / (a + b); } else cy[i] = 0;
    }
  }
  // beta at the faces between cells, harmonic, so the operator (1 - d beta d) keeps the volume of the water
  const bfx = S.bfx, bfy = S.bfy;
  for (let j = 0; j < NY; j++) {
    for (let x = 0; x < W; x++) {
      const i = OFF + j * W + x, a = beta[i];
      if (x < W - 1) { const b = beta[i + 1]; bfx[i] = (2 * a * b) / (a + b + 1e-9); } else bfx[i] = 0;
      if (j < NY - 1) { const b = beta[i + W]; bfy[i] = (2 * a * b) / (a + b + 1e-9); } else bfy[i] = 0;
    }
  }
  // source weights
  for (let x = 0; x < W; x++) S.sw[x] = sqrt(pd[OFF + JS * W + x]);
  // dispersive operator, factored: (1 - beta d_xx)(1 - beta d_yy), each a tridiagonal solve
  const cpx = S.cpx, dnx = S.dnx, cpy = S.cpy, dny = S.dny;
  for (let j = 0; j < NY; j++) {
    let cp = 0;
    for (let x = 0; x < W; x++) {
      const i = OFF + j * W + x, up = bfx[i], lo = bfx[i - 1];
      const dn = 1 / (1 + lo + up + lo * cp);
      dnx[i] = dn;
      cp = -up * dn;
      cpx[i] = cp;
    }
  }
  for (let x = 0; x < W; x++) {
    let cp = 0;
    for (let j = 0; j < NY; j++) {
      const i = OFF + j * W + x, up = bfy[i], lo = bfy[i - W];
      const dn = 1 / (1 + lo + up + lo * cp);
      dny[i] = dn;
      cp = -up * dn;
      cpy[i] = cp;
    }
  }
  S.geoT = 0;
}

// damping per cell: the water's own, the bank's, and a sponge above the panel and below the source line
function buildDamping(S, dt) {
  const hs = 0.5 * dt;
  for (let j = 0; j < NY; j++) {
    const y = j - PT;
    let sg = SIG0;
    if (y < 0) { const u = -y / PT; sg += SIG_TOP * u * u; }
    if (j > JS) { const u = (j - JS) / PS; sg += SIG_BOT * u * u; }
    for (let x = 0; x < W; x++) {
      const i = OFF + j * W + x, s = sg + (S.pd[i] <= 0.06 ? SIG_LAND : 0);
      S.sg1[i] = 1 / (1 + hs * s);
      S.sg2[i] = 1 - hs * s;
    }
  }
  S.sigDt = dt;
}

// ---- the tide: pulses of the water level at the source line, each a raised cosine
function addPulse(S, t0, T, amp) {
  S.pulses.push([t0, T, amp]);
  S.plan += amp;
}

function srcValue(S, t) {
  let v = 0;
  const ps = S.pulses;
  for (let k = ps.length - 1; k >= 0; k--) {
    const p = ps[k], u = (t - p[0]) / p[1];
    if (u >= 1) { S.base += p[2]; ps.splice(k, 1); continue; }
    if (u > 0) v += (p[2] * 0.5 * PI * sin(PI * u)) / p[1];
  }
  return v;
}

function levelNow(S, t) {
  let L = 0;
  const ps = S.pulses;
  for (let k = 0; k < ps.length; k++) {
    const p = ps[k], u = cl((t - p[0]) / p[1], 0, 1);
    L += p[2] * 0.5 * (1 - cos(PI * u));
  }
  return L + S.base;
}

function launch(S, kn, t) {
  const u2 = cl(kn[1] / 4, 0, 1);
  const amp = (0.12 + 0.5 * u2) * (0.8 + 0.4 * Math.random());
  const T = (0.28 + 1.6 * pow(1 - u2, 2.5)) * (0.85 + 0.3 * Math.random());
  addPulse(S, t, T, amp);
  S.ebbAt = t + 9 + 6 * Math.random();
  S.ebbT = 6 + 4 * Math.random();
  S.nextAt = t + (Math.random() < 0.22 ? 11 + 4 * Math.random() : 22 + 14 * Math.random()); // now and then a second bore follows the first
  S.lastAmp = amp;
}

function schedule(S, kn) {
  if (S.ebbAt >= 0 && S.clk >= S.ebbAt) {
    addPulse(S, S.ebbAt, S.ebbT, -S.plan);
    S.ebbAt = -1;
  }
  if (S.clk >= S.nextAt) launch(S, kn, S.clk);
}

// ---- the solver

const nl = (v) => { const f = 1 + GN * v; return f < 0.4 ? 0.4 : f > 2.4 ? 2.4 : f; };

function step(S) {
  const e = S.eta, ep = S.etp, a = S.rhs, tm = S.tmp, cx = S.cx, cy = S.cy, g2 = S.g2;
  const iN = OFF + N, nuD = S.nu / DT;
  for (let i = OFF; i < iN; i++) {
    const e0 = e[i], eR = e[i + 1], eL = e[i - 1], eD = e[i + W], eU = e[i - W];
    a[i] = g2 * (cx[i] * (eR - e0) * nl(e0 + eR) - cx[i - 1] * (e0 - eL) * nl(e0 + eL) + cy[i] * (eD - e0) * nl(e0 + eD) - cy[i - W] * (e0 - eU) * nl(e0 + eU))
      + nuD * (e[i + 1] - ep[i + 1] + e[i - 1] - ep[i - 1] + e[i + W] - ep[i + W] + e[i - W] - ep[i - W] - 4 * (e0 - ep[i]));
  }
  const b = OFF + JS * W;
  let ms = 0, sw2 = 0;
  for (let x = 0; x < W; x++) { const w = S.sw[x]; ms += w * w * e[b + x]; sw2 += w * w; }
  const sv = srcValue(S, S.clk) + KAPPA * (levelNow(S, S.clk) - ms / sw2);
  if (sv !== 0) {
    const k = 2 * sqrt(g2) * sv;
    for (let x = 0; x < W; x++) a[b + x] += k * S.sw[x];
  }
  // (1 - beta d_xx) b = a
  const bfx = S.bfx, bfy = S.bfy, cpx = S.cpx, dnx = S.dnx, cpy = S.cpy, dny = S.dny;
  for (let j = 0; j < NY; j++) {
    const b0 = OFF + j * W;
    let dp = 0;
    for (let i = b0; i < b0 + W; i++) {
      dp = (a[i] + bfx[i - 1] * dp) * dnx[i];
      tm[i] = dp;
    }
    let v = 0;
    for (let i = b0 + W - 1; i >= b0; i--) {
      v = tm[i] - cpx[i] * v;
      a[i] = v;
    }
  }
  // (1 - beta d_yy) a = b
  for (let j = 0; j < NY; j++) {
    const b0 = OFF + j * W;
    for (let i = b0; i < b0 + W; i++) tm[i] = (a[i] + bfy[i - W] * tm[i - W]) * dny[i];
  }
  for (let j = NY - 1; j >= 0; j--) {
    const b0 = OFF + j * W;
    for (let i = b0; i < b0 + W; i++) a[i] = tm[i] - cpy[i] * a[i + W];
  }
  const sg1 = S.sg1, sg2 = S.sg2, dt2 = DT * DT;
  for (let i = OFF; i < iN; i++) {
    const v = (2 * e[i] - sg2[i] * ep[i] + dt2 * a[i]) * sg1[i];
    ep[i] = v < -3 ? -3 : v > 3 ? 3 : v;
  }
  S.eta = ep;
  S.etp = e;
  S.clk += DT;
}

// Where the front of the last bore is: the row where the level across the middle of the channel rises most steeply going down the panel, if
// that rise is steeper than a gentle swell's. An ebb draws the level down the other way, and a whelp is not as steep as the front.
function frontRow(S) {
  const e = S.eta, m = S.baseRow;
  for (let y = 0; y < H + YS; y++) {
    const row = OFF + (y + PT) * W;
    let a = 0, n = 0;
    for (let x = 20; x < 44; x++) if (S.pd[row + x] > 0.5) { a += e[row + x + 2 * W] - e[row + x - 2 * W]; n++; }
    m[y] = n > 6 ? a / n : 0;
  }
  let best = 0, at = 999;
  for (let y = 12; y < H + YS - 8; y++) {
    const g = (m[y - 1] + m[y] + m[y + 1]) / 3;
    if (g > best) { best = g; at = y; }
  }
  return best > 0.08 * S.lastAmp ? at : 999;
}

function control(S, kn) {
  const u2 = cl(kn[1] / 4, 0, 1), k3 = cl(kn[2], -2, 2);
  S.spd = 0.8 + 0.55 * u2;
  S.cm = 1 + 0.1 * sin(TAU * S.clk / 197 + S.ph[3]) + 0.06 * sin(TAU * S.clk / 113 + S.ph[4]);
  const c = C0 * S.spd * S.cm;
  S.g2 = c * c;
  const b0 = B0 * pow(2, k3);
  if (b0 !== S.beta0) { S.beta0 = b0; S.geoT = 9; }
  S.bendT = cl(kn[3], -1, 1);
}

function preroll(S, kn) {
  S.base = 0;
  control(S, kn);
  S.bend = S.bendT;
  buildGeometry(S);
  buildDamping(S, DT);
  S.clk = 0;
  launch(S, kn, 0.3);
  const tB = 0.3 + 21;
  S.nextAt = tB;
  // The first bore climbs clean water: time it past row 100 to learn the speed this panel runs at, and aim the second at row 74
  let c = 0, tEnd = 0;
  for (let n = 0; n < 6000; n++) {
    schedule(S, kn);
    step(S);
    if (c === 0 && (n & 15) === 0 && S.clk > 3) {
      const y = frontRow(S);
      if (y < 110 && y > 20) c = (H + YS - y) / (S.clk - 0.3);
      else if (S.clk > 16) c = 6;
      if (c > 0) tEnd = tB + (H + YS - 74) / c;
    }
    if (c > 0 && S.clk >= tEnd) break;
    if ((n & 15) === 0) {
      S.geoT += 16 * DT;
      if (S.geoT > 1.5) { control(S, kn); S.bend = S.bendT; buildGeometry(S); }
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  S.frameDt = d;
  if (!S.ready) {
    S.ready = true;
    preroll(S, kn);
    for (let k = 0; k < 4; k++) foamStep(S, 0.3);
  }
  control(S, kn);
  S.bend += (S.bendT - S.bend) * (1 - exp(-d / 1.2));
  S.geoT += d;
  if (S.geoT > 0.12) buildGeometry(S);
  S.acc += d;
  while (S.acc >= DT) {
    S.acc -= DT;
    schedule(S, kn);
    step(S);
  }
  const lv = cl(levelNow(S, S.clk) / 0.3, 0, 1);
  S.lvlSm += (lv - S.lvlSm) * (1 - exp(-d / 3));
  const u = 1.6 * S.lvlSm - 1.1 * (1 - S.lvlSm);
  S.o1 += u * d;
  S.o2 += 0.55 * u * d + 0.15 * d;
  foamStep(S, d);
}

// ---- the picture

const SUN = [-0.42, -0.908]; // the way the sun lies from a point of water, on the panel: up and a little left
const TEX1 = 0.13, TEX2 = 0.09; // slope of the ripples the current drags over the water
const CLOUD = 0.34; // how much a cloud's shadow takes off the light
const SG = 30; // slope gain: the surface slopes are drawn 30 times steeper than the solver has them
const WATER = [
  [0.0, 11, 28, 38],
  [0.22, 16, 44, 60],
  [0.42, 25, 70, 90],
  [0.60, 50, 108, 124],
  [0.78, 100, 152, 158],
  [0.92, 172, 200, 188],
  [1.0, 226, 232, 210],
];
const SAND_UNDER = [154, 130, 88], SILT = [118, 120, 74], SUNC = [255, 232, 178], FOAMC = [238, 242, 232];
const MUD = [54, 42, 30], SAND = [176, 156, 118], SANDM = [150, 126, 86], GRASS = [60, 100, 44], GRASSD = [36, 72, 36], BUSH = [26, 54, 30];

function hueLut(S, hue) {
  if (S.hueAt === hue) return;
  const A = -TAU * hue, c = cos(A), s = sin(A), m = S.hueMat;
  m[0] = 0.213 + c * 0.787 - s * 0.213; m[1] = 0.715 - c * 0.715 - s * 0.715; m[2] = 0.072 - c * 0.072 + s * 0.928;
  m[3] = 0.213 - c * 0.213 + s * 0.143; m[4] = 0.715 + c * 0.285 + s * 0.14; m[5] = 0.072 - c * 0.072 - s * 0.283;
  m[6] = 0.213 - c * 0.213 - s * 0.787; m[7] = 0.715 - c * 0.715 + s * 0.715; m[8] = 0.072 + c * 0.928 + s * 0.072;
  const lut = S.lut;
  let k = 0;
  for (let n = 0; n < 256; n++) {
    const f = n / 255;
    while (k < WATER.length - 2 && f > WATER[k + 1][0]) k++;
    const a = WATER[k], b = WATER[k + 1], t = cl((f - a[0]) / (b[0] - a[0]), 0, 1);
    const r = a[1] + (b[1] - a[1]) * t, g = a[2] + (b[2] - a[2]) * t, bl = a[3] + (b[3] - a[3]) * t;
    lut[n * 3] = cl(r * m[0] + g * m[1] + bl * m[2], 0, 255);
    lut[n * 3 + 1] = cl(r * m[3] + g * m[4] + bl * m[5], 0, 255);
    lut[n * 3 + 2] = cl(r * m[6] + g * m[7] + bl * m[8], 0, 255);
  }
  S.hueAt = hue;
}

// a box mean of the level across 13 LEDs each way, for the tide's tint
function smoothLevel(S) {
  const e = S.eta, t = S.tmp2, o = S.etaS, R = 6, inv = 1 / (2 * R + 1);
  for (let j = 0; j < NY; j++) {
    const b = OFF + j * W;
    let acc = 0;
    for (let x = -R; x <= R; x++) acc += e[b + cl(x, 0, W - 1)];
    for (let x = 0; x < W; x++) {
      t[b + x] = acc * inv;
      acc += e[b + min(W - 1, x + R + 1)] - e[b + max(0, x - R)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -R; y <= R; y++) acc += t[OFF + cl(y + PT, 0, NY - 1) * W + x];
    for (let y = 0; y < H; y++) {
      const j = y + PT;
      o[OFF + j * W + x] = acc * inv;
      acc += t[OFF + min(NY - 1, j + R + 1) * W + x] - t[OFF + max(0, j - R) * W + x];
    }
  }
}

// the level, binomially blurred over a pixel each way, so the shading does not pick out the shortest waves
function blurEta(S) {
  const e = S.eta, t = S.tmp2, o = S.etaB;
  const j0 = PT - 3, j1 = PT + H + 3;
  for (let j = j0; j < j1; j++) {
    const b = OFF + j * W;
    for (let x = 1; x < W - 1; x++) t[b + x] = 0.25 * e[b + x - 1] + 0.5 * e[b + x] + 0.25 * e[b + x + 1];
    t[b] = e[b]; t[b + W - 1] = e[b + W - 1];
  }
  for (let j = j0 + 1; j < j1 - 1; j++) {
    const b = OFF + j * W;
    for (let x = 0; x < W; x++) o[b + x] = 0.25 * t[b + x - W] + 0.5 * t[b + x] + 0.25 * t[b + x + W];
  }
  for (let j = j0 + 1; j < j1 - 1; j++) {
    const b = OFF + j * W;
    for (let x = 1; x < W - 1; x++) t[b + x] = 0.25 * o[b + x - 1] + 0.5 * o[b + x] + 0.25 * o[b + x + 1];
  }
  for (let j = j0 + 2; j < j1 - 2; j++) {
    const b = OFF + j * W;
    for (let x = 1; x < W - 1; x++) o[b + x] = 0.25 * t[b + x - W] + 0.5 * t[b + x] + 0.25 * t[b + x + W];
  }
}

function foamStep(S, dt) {
  const e = S.eta, f = S.foam, pd = S.pd, dec = exp(-dt / 0.55);
  for (let y = 0; y < H; y++) {
    const b = OFF + (y + PT) * W;
    for (let i = b; i < b + W; i++) {
      const p = pd[i];
      if (p < 0.08) { f[i] = 0; continue; }
      const gx = 0.5 * (e[i + 1] - e[i - 1]), gy = 0.5 * (e[i + W] - e[i - W]);
      const sl = SG * sqrt(gx * gx + gy * gy), r = e[i] / (0.15 + p);
      const v = max(sm(0.6, 1.0, sl), 0.9 * sm(0.5, 0.9, r));
      const o = f[i] * dec;
      f[i] = v > o ? v : o;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const kn = S.kn;
  hueLut(S, cl(kn[0], 0, 1) + 0.03 * sin(TAU * S.clk / 151 + S.ph[0]) + 0.02 * sin(TAU * S.clk / 89 + S.ph[1]));
  smoothLevel(S);
  blurEta(S);
  const e = S.etaB, e0 = S.eta, es = S.etaS, pd = S.pd, dwA = S.dwA, foam = S.foam, lut = S.lut, bt = S.bt;
  const o1 = S.o1, o2 = S.o2, cloud = S.cloud, tk = S.clk;
  for (let gy = 0; gy < 33; gy++) {
    for (let gx = 0; gx < 17; gx++) {
      let v = 0;
      for (let k = 0; k < 5; k++) { const w = S.cw[k]; v += sin(w[0] * gx * 4 + w[1] * gy * 4 - w[2] * tk + w[3]); }
      cloud[gy * 17 + gx] = sm(0.25, 1.6, v * 0.5 + 0.8);
    }
  }
  for (let y = 0; y < H; y++) {
    const cyi = floor(y / 4), cyf = (y - cyi * 4) / 4;
    const j = y + PT, b = OFF + j * W;
    // rows of the two ripple tiles at this y: the ripples drift with the current
    let y1 = (y - o1) % H; if (y1 < 0) y1 += H;
    let y2 = (y - o2) % H; if (y2 < 0) y2 += H;
    const r10 = floor(y1), f1 = y1 - r10, r11 = (r10 + 1) % H, r20 = floor(y2), f2 = y2 - r20, r21 = (r20 + 1) % H;
    for (let x = 0; x < W; x++) {
      const i = b + x, dw = dwA[i];
      let R, G, B;
      // ---- land
      let wl = 0;
      if (dw < 2.5) {
        const ob = -dw, c0 = cl(floor(ob), 0, 62), fb = cl(ob - c0, 0, 1);
        const n1 = bt[y * 64 + c0] * (1 - fb) + bt[y * 64 + c0 + 1] * fb, n2 = bt[((y + 57) % H) * 64 + ((c0 + 23) & 63)];
        const wm = sm(0.4, 2.4, ob), ws = sm(2.5 + 6 * n1, 5 + 6 * n1, ob);
        let r = MUD[0] + (SAND[0] - MUD[0]) * wm, g = MUD[1] + (SAND[1] - MUD[1]) * wm, bl = MUD[2] + (SAND[2] - MUD[2]) * wm;
        const gm = n2 > 0.62 ? sm(0.62, 0.8, n2) : 0;
        const gr = GRASS[0] + (GRASSD[0] - GRASS[0]) * n1 + (BUSH[0] - GRASSD[0]) * gm, gg = GRASS[1] + (GRASSD[1] - GRASS[1]) * n1 + (BUSH[1] - GRASSD[1]) * gm, gb = GRASS[2] + (GRASSD[2] - GRASS[2]) * n1 + (BUSH[2] - GRASSD[2]) * gm;
        r += (gr - r) * ws; g += (gg - g) * ws; bl += (gb - bl) * ws;
        const k = 0.8 + 0.4 * n1;
        R = r * k; G = g * k; B = bl * k;
        wl = dw > -1 ? sm(1.0, -1.0, dw) : 1;
      } else wl = 0;
      if (dw > -1.2) {
        // ---- water
                const gx = 0.5 * (e[i + 1] - e[i - 1]), gy = 0.5 * (e[i + W] - e[i - W]);
        const t1 = (S.tg1y[r10 * W + x] * (1 - f1) + S.tg1y[r11 * W + x] * f1), t1x = (S.tg1x[r10 * W + x] * (1 - f1) + S.tg1x[r11 * W + x] * f1);
        const t2 = (S.tg2y[r20 * W + x] * (1 - f2) + S.tg2y[r21 * W + x] * f2), t2x = (S.tg2x[r20 * W + x] * (1 - f2) + S.tg2x[r21 * W + x] * f2);
        const sx = SG * gx + TEX1 * t1x + TEX2 * t2x, sy = SG * gy + TEX1 * t1 + TEX2 * t2;
        const q = -(sx * SUN[0] + sy * SUN[1]), cr = -(sx * SUN[1]) + sy * SUN[0];
        const lv = cl(es[i] / 0.28, 0, 1.2);
        let sh = 0.44 + 0.62 * q + 6 * (e[i] - es[i]) + 0.10 * lv;
        sh = cl(sh, 0, 1);
        const n = (sh * 255) | 0;
        let r = lut[n * 3], g = lut[n * 3 + 1], bl = lut[n * 3 + 2];
        const ws = (1 - sm(0.1, 0.8, pd[i])) * 0.85;
        if (ws > 0) { const k = 0.3 + 0.7 * sh; r += (SAND_UNDER[0] * k - r) * ws; g += (SAND_UNDER[1] * k - g) * ws; bl += (SAND_UNDER[2] * k - bl) * ws; }
        const wsl = 0.32 * lv;
        if (wsl > 0) { const k = 0.3 + 0.8 * sh; r += (SILT[0] * k - r) * wsl; g += (SILT[1] * k - g) * wsl; bl += (SILT[2] * k - bl) * wsl; }
        const d0 = q - 0.42, sp = exp(-(d0 * d0) / 0.018 - (cr * cr) / 0.12) * 0.62;
        r += SUNC[0] * sp; g += SUNC[1] * sp; bl += SUNC[2] * sp;
        let fm = 0.5 * foam[i] + 0.125 * (foam[i - 1] + foam[i + 1] + foam[i - W] + foam[i + W]);
        fm *= 0.7 + 0.5 * S.nt[y * W + x];
        if (fm > 0.02) { const fk = cl(fm, 0, 1) * 0.92, k = 0.8 + 0.2 * sh; r += (FOAMC[0] * k - r) * fk; g += (FOAMC[1] * k - g) * fk; bl += (FOAMC[2] * k - bl) * fk; }
        if (wl > 0) { R = R + (r - R) * (1 - wl); G = G + (g - G) * (1 - wl); B = B + (bl - B) * (1 - wl); } else { R = r; G = g; B = bl; }
      }
      const cxi = x >> 2, cxf = (x & 3) / 4, c0 = cyi * 17 + cxi;
      const cv = (cloud[c0] * (1 - cxf) + cloud[c0 + 1] * cxf) * (1 - cyf) + (cloud[c0 + 17] * (1 - cxf) + cloud[c0 + 18] * cxf) * cyf;
      const cs = 1 - CLOUD * cv;
      display.setPixel(x, y, cl(R * cs, 0, 255) | 0, cl(G * cs, 0, 255) | 0, cl(B * cs, 0, 255) | 0);
    }
  }
}
