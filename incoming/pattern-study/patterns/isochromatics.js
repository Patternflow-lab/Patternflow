// ===== Patternflow pattern =====
// Title:   Isochromatics
// Family:  photoelasticity
// Idea:    A clear plastic plate lit from behind between two polarisers fills the panel, and a handful of pins squeeze it from its four edges, so that round every pin nested bands of interference colour stand like rings tangent to the edge, new bands are born at the contact as it presses harder and march outward, they collapse as it lets go, black fans of isoclinic shadow sweep round when the polariser turns, and pins glide along the edges, lift off and land elsewhere without ever setting the same scene twice.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the colours a squeezed sheet of glass shows between polarisers (David Brewster, 1816, from memory), the stress-optic law that makes the fringe order follow the difference of the principal stresses (James Clerk Maxwell, 1853, from memory), the stress in a half-plane under a point load, purely radial (Alfred-Aimé Flamant, 1892, from memory), the contact patch that keeps it finite (Heinrich Hertz, 1881, from memory), the interference colour chart (Auguste Michel-Lévy and Alfred Lacroix, 1888), the multi-lobe fit of the CIE 1931 colour matching functions (Chris Wyman, Peter-Pike Sloan and Peter Shirley, 2013); pattern round 259
// Round:   259
// ===============================
// @matrix 64x128
// @knobs Tint=-1..1, Load=0..4, Pins=-1..1, Analyser=-1..1
//
// Knob 1: Tint.
// Knob 2: Load.
// Knob 3: Pins.
// Knob 4: Analyser.

const W = 64, H = 128, PW = W + 2, PH = H + 2, NC = PW * PH;
const { sin, cos, sqrt, abs, exp, pow, PI, min, max, acos } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (x) => { x = cl(x, 0, 1); return x * x * (3 - 2 * x); };

// ---- colour of a retardation: the Michel-Levy chart summed from 48 wavelengths, as linear sRGB
const NW = 48, LAM = [];
for (let k = 0; k < NW; k++) LAM.push(400 + (300 * (k + 0.5)) / NW);
const WT = new Float64Array(NW * 3);
{
  const g = (l, m, a, b) => exp(-0.5 * pow((l - m) / (l < m ? a : b), 2));
  for (let n = 0; n < NW; n++)
    for (let j = 0; j < 5; j++) {
      const l = LAM[n] + (j - 2) * 1.25;
      const x = 1.056 * g(l, 599.8, 37.9, 31) + 0.362 * g(l, 442, 16, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
      const y = 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
      const z = 1.217 * g(l, 437, 11.8, 36) + 0.681 * g(l, 459, 26, 13.8);
      WT[n * 3] += 3.2406 * x - 1.5372 * y - 0.4986 * z;
      WT[n * 3 + 1] += -0.9689 * x + 1.8758 * y + 0.0415 * z;
      WT[n * 3 + 2] += 0.0557 * x - 0.204 * y + 1.057 * z;
    }
  for (let c = 0; c < 3; c++) {
    let s = 0;
    for (let n = 0; n < NW; n++) s += WT[n * 3 + c];
    for (let n = 0; n < NW; n++) WT[n * 3 + c] /= s;
  }
}
const GSTEP = 2, NG = 4001, GMAX = (NG - 1) * GSTEP; // the table runs from 0 to 8000 nm of retardation in 2 nm steps
const CR = new Float64Array(NG * 3), CC = new Float64Array(NG * 3), CMEAN = new Float64Array(3);
for (let j = 0; j < NG; j++) {
  const G = j * GSTEP;
  let r = 0, g = 0, b = 0;
  for (let n = 0; n < NW; n++) {
    const s = sin((PI * G) / LAM[n]), I = s * s;
    r += WT[n * 3] * I; g += WT[n * 3 + 1] * I; b += WT[n * 3 + 2] * I;
  }
  CR[j * 3] = max(0, r); CR[j * 3 + 1] = max(0, g); CR[j * 3 + 2] = max(0, b);
}
for (let j = 1; j < NG; j++)
  for (let c = 0; c < 3; c++) CC[j * 3 + c] = CC[(j - 1) * 3 + c] + 0.5 * GSTEP * (CR[(j - 1) * 3 + c] + CR[j * 3 + c]);
for (let c = 0; c < 3; c++) CMEAN[c] = (CC[(NG - 1) * 3 + c] - CC[(NG - 1 - 500) * 3 + c]) / (500 * GSTEP);
const ENC = new Uint8Array(4097);
for (let i = 0; i <= 4096; i++) {
  const v = i / 4096;
  ENC[i] = Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055));
}

// integral of the colour from 0 to g (an odd extension below 0), one channel; beyond the table the mean colour carries on
let ci = 0, cf = 0, cx = 0, cs = 1;
function cumSet(g) {
  cs = 1;
  if (g < 0) { g = -g; cs = -1; }
  cx = 0;
  if (g >= GMAX) { cx = (g - GMAX); g = GMAX - 1e-6; }
  const u = g / GSTEP;
  ci = u | 0; cf = u - ci;
}
const cumAt = (c) => {
  const a = CC[ci * 3 + c], b = CC[ci * 3 + 3 + c];
  return cs * (a + (b - a) * cf + cx * CMEAN[c]);
};

// ---- the pins
const IRW2 = 1 / (30 * 30), GLOW = 0.55, DK = 0.9, KAPPA = 0.3, G_START = 525, G_END = 1150;
const NBG = 3, BG_AMP = 55; // the frozen-in stress of the plate: three slow plane waves, up to 165 nm in all
const LOAD_LOW = 0.55; // the load at K2 = 0 as a share of the opening's
const NP = 7;
const EDGE_LEN = [H, H, W, W]; // left, right, top, bottom
const MARGIN = 9; // a pin keeps this far from a corner

// where pin k stands at time t, written to PX and PY (the roam, rho, is the knob's)
let PX = 0, PY = 0, PNX = 0, PNY = 0;
function pinAt(p, t, rho) {
  const L = EDGE_LEN[p.edge], Lr = L - 2 * MARGIN;
  const raw0 = (Lr * acos(1 - 2 * p.uf)) / PI;
  const raw = raw0 + rho * p.amp * (0.62 * sin(p.v1 * t + p.q1) + 0.38 * sin(p.v2 * t + p.q2));
  const u = MARGIN + Lr * (0.5 - 0.5 * cos((PI * raw) / Lr));
  PNX = 0; PNY = 0;
  if (p.edge === 0) { PX = 0; PY = u; PNX = 1; }
  else if (p.edge === 1) { PX = W; PY = u; PNX = -1; }
  else if (p.edge === 2) { PX = u; PY = 0; PNY = 1; }
  else { PX = u; PY = H; PNY = -1; }
}
const slotsOn = (k3) => 4.8 + 1.8 * cl(k3, -1, 1);

// A pin lands where it is farthest from the others: of 14 tries on the four edges, the one whose nearest neighbour is most distant.
function landPin(S, k) {
  const p = S.pins[k], con = S.pins[k], rho = 1 + 0.8 * cl(S.kn[2], -1, 1), nOn = Math.ceil(slotsOn(S.kn[2]));
  let best = -1, be = 0, bu = 0.5;
  for (let c = 0; c < 14; c++) {
    const r = Math.random(), e = r < 0.33 ? 0 : r < 0.66 ? 1 : r < 0.83 ? 2 : 3, uf = 0.1 + 0.8 * Math.random();
    con.edge = e; con.uf = uf; con.amp = 0;
    pinAt(con, S.t, rho);
    const cx = PX, cy = PY;
    let d = 70;
    for (let j = 0; j < NP; j++) {
      const o = S.pins[j];
      if (j === k || o.E < 0.05 || j >= nOn) continue;
      pinAt(o, S.t, rho);
      d = min(d, sqrt((cx - PX) * (cx - PX) + (cy - PY) * (cy - PY)));
    }
    const score = d + 8 * Math.random();
    if (score > best) { best = score; be = e; bu = uf; }
  }
  p.edge = be; p.uf = bu;
  p.life = 24 + 44 * Math.random();
  p.age = 0; p.fall = false; p.fa = 0;
  p.base = 0.75 + 0.5 * Math.random();
  p.w1 = TAU / (6 + 9 * Math.random()); p.p1 = TAU * Math.random();
  p.w2 = TAU / (15 + 26 * Math.random()); p.p2 = TAU * Math.random();
  p.v1 = TAU / (38 + 55 * Math.random()); p.q1 = TAU * Math.random();
  p.v2 = TAU / (83 + 96 * Math.random()); p.q2 = TAU * Math.random();
  p.amp = 10 + 7 * Math.random();
  p.wait = 0;
  p.E = 0;
}

function makeState() {
  const S = {
    ready: false, t: 0, kn: [0, 2, 0, 0.06],
    pins: [], px: new Float64Array(NP), py: new Float64Array(NP), nx: new Float64Array(NP), ny: new Float64Array(NP),
    q: new Float64Array(NP), a2: new Float64Array(NP), np: 0,
    G: new Float32Array(NC), X: new Float32Array(NC),
    bg: [], bgc: new Float64Array(NBG * 2 * PW), bgr: new Float64Array(NBG * 2 * PH),
  };
  for (let j = 0; j < NBG; j++) {
    const a = TAU * Math.random(), lam = 40 + 55 * Math.random(), per = (35 + 60 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
    S.bg.push({ kx: (TAU * cos(a)) / lam, ky: (TAU * sin(a)) / lam, w: TAU / per, p: TAU * Math.random() });
  }
  for (let k = 0; k < NP; k++) {
    S.pins.push({ edge: k % 4, uf: 0.5, E: 0, life: 30, age: 0, base: 1, w1: 1, p1: 0, w2: 1, p2: 0, v1: 1, q1: 0, v2: 1, q2: 0, amp: 12, wait: 0, fall: false, fa: 0 });
  }
  for (let k = 0; k < NP; k++) {
    landPin(S, k);
    S.pins[k].E = 1;
    S.pins[k].age = 25 * Math.random(); // the pins are at different points of their lives
  }
  return S;
}

export function setup(params) {
  params.s = makeState();
}

// A pin is in transition while it is landing, lifting off or waiting to land; only one pin is at a time, so the panel always carries several loaded contacts.
function moving(S, k) {
  for (let j = 0; j < NP; j++) {
    const p = S.pins[j];
    if (j !== k && (p.wait > 0 || p.fall || p.age < 4)) return true;
  }
  return false;
}

function stepPins(S, dt) {
  S.t += dt;
  for (let k = 0; k < NP; k++) {
    const p = S.pins[k];
    if (p.wait > 0) {
      p.wait -= dt;
      if (p.wait <= 0) landPin(S, k);
      continue;
    }
    p.age += dt;
    if (!p.fall && p.age >= p.life && !moving(S, k)) { p.fall = true; p.fa = 0; }
    if (p.fall) {
      p.fa += dt;
      p.E = 1 - sstep(p.fa / 5);
      if (p.fa >= 5) { p.E = 0; p.fall = false; p.wait = 0.4 + 2 * Math.random(); }
    } else p.E = sstep(p.age / 4);
  }
}

// the pins as the field wants them: place, inward normal, strength and contact radius
function layPins(S, kn) {
  const k2 = cl(kn[1], 0, 4), lfac = k2 < 2 ? pow(LOAD_LOW, (2 - k2) / 2) : exp((k2 - 2) * 0.42);
  const k3 = cl(kn[2], -1, 1);
  const npins = slotsOn(k3), rho = 1 + 0.8 * k3;
  const t = S.t;
  let n = 0;
  for (let k = 0; k < NP; k++) {
    const p = S.pins[k];
    const wk = cl(npins - k, 0, 1) * p.E;
    if (wk < 0.01) continue;
    pinAt(p, t, rho);
    const pulse = 0.72 + 0.28 * (0.6 * sin(p.w1 * t + p.p1) + 0.4 * sin(p.w2 * t + p.p2));
    const P = wk * p.base * pulse * lfac;
    S.px[n] = PX; S.py[n] = PY; S.nx[n] = PNX; S.ny[n] = PNY;
    S.q[n] = 26000 * P;
    const a = cl(3.0 * pow(P, 0.4), 2.4, 6.5);
    S.a2[n] = a * a;
    n++;
  }
  S.np = n;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  if (!S.ready) {
    S.ready = true;
    for (let t = 0; t < 30; t += 0.1) stepPins(S, 0.1);
  }
  stepPins(S, d);
}

// the polariser wanders: a slow turn and two swings that share no period
const wobAngle = (t) => 0.05 * t + 0.55 * sin((TAU * t) / 37.3 + 1.1) + 0.35 * sin((TAU * t) / 61.7 + 4.2);

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const kn = S.kn, t = S.t;
  layPins(S, kn);
  const k1 = cl(kn[0], -1, 1);
  const G0 = k1 < 0 ? G_START * (1 + 0.9 * k1) : G_START + (G_END - G_START) * k1;
  const m = pow(0.5 * (cl(kn[3], -1, 1) + 1), 0.6);
  const al = wobAngle(t), ca = cos(2 * al), sa = sin(2 * al);
  const { G, X, np, px, py, nx, ny, q, a2, bg, bgc, bgr } = S;
  for (let j = 0; j < NBG; j++) {
    const b = bg[j];
    for (let x = 0; x < PW; x++) { const a = b.kx * (x - 0.5); bgc[(j * PW + x) * 2] = cos(a); bgc[(j * PW + x) * 2 + 1] = sin(a); }
    for (let y = 0; y < PH; y++) { const a = b.ky * (y - 0.5) + b.w * t + b.p; bgr[(j * PH + y) * 2] = BG_AMP * cos(a); bgr[(j * PH + y) * 2 + 1] = BG_AMP * sin(a); }
  }
  for (let y = 0; y < PH; y++) {
    const yy = y - 0.5;
    for (let x = 0; x < PW; x++) {
      const xx = x - 0.5;
      let zr = 0, zi = 0;
      for (let j = 0; j < NBG; j++) {
        const cr = bgc[(j * PW + x) * 2], cim = bgc[(j * PW + x) * 2 + 1], rr = bgr[(j * PH + y) * 2], ri = bgr[(j * PH + y) * 2 + 1];
        zr += cr * rr - cim * ri;
        zi += cr * ri + cim * rr;
      }
      for (let k = 0; k < np; k++) {
        const wx = xx - px[k], wy = yy - py[k];
        const r2 = wx * wx + wy * wy;
        let yn = wx * nx[k] + wy * ny[k];
        if (yn < 0) yn = 0;
        const f = (-q[k] * yn) / ((r2 + a2[k]) * (r2 + 1) * (1 + r2 * IRW2));
        zr += f * (wx * wx - wy * wy);
        zi += f * 2 * wx * wy;
      }
      const D = sqrt(zr * zr + zi * zi);
      let cz = 1, sz = 0;
      if (D > 1e-3) { cz = zr / D; sz = zi / D; }
      const iso = cz * ca + sz * sa, st = sz * ca - cz * sa;
      const s = 1 - KAPPA + (KAPPA * st * 1.2) / (abs(st) + 0.2);
      const i = y * PW + x;
      G[i] = G0 + D * s;
      X[i] = m * iso * iso * (D / (D + 90));
    }
  }
  // the colour of the plate with no stress in it, read from the table itself
  const gi = min(NG - 2, (G0 / GSTEP) | 0), gf = G0 / GSTEP - gi;
  const c0r = CR[gi * 3] * (1 - gf) + CR[gi * 3 + 3] * gf, c0g = CR[gi * 3 + 1] * (1 - gf) + CR[gi * 3 + 4] * gf, c0b = CR[gi * 3 + 2] * (1 - gf) + CR[gi * 3 + 5] * gf;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y + 1) * PW + x + 1;
      const gx = 0.5 * (G[i + 1] - G[i - 1]), gy = 0.5 * (G[i + PW] - G[i - PW]);
      let h = 0.55 * (abs(gx) + abs(gy));
      if (h < 1) h = 1;
      const g = G[i];
      cumSet(g + h); const a0 = cumAt(0), a1 = cumAt(1), a2_ = cumAt(2);
      cumSet(g - h); const b0 = cumAt(0), b1 = cumAt(1), b2 = cumAt(2);
      const inv = 1 / (2 * h), xm = X[i], mg = 1 - xm, dk = 1 - DK * xm;
      // where the fringes are finer than the LEDs the average of the colours is what the eye gets, and it is lifted toward white: the contact glows
      const wh = GLOW * sstep((h - 120) / 500);
      let r = (c0r + mg * ((a0 - b0) * inv - c0r)) * dk, gr = (c0g + mg * ((a1 - b1) * inv - c0g)) * dk, bl = (c0b + mg * ((a2_ - b2) * inv - c0b)) * dk;
      r += (1 - r) * wh; gr += (1 - gr) * wh; bl += (1 - bl) * wh;
      display.setPixel(x, y, ENC[(cl(r, 0, 1) * 4096) | 0], ENC[(cl(gr, 0, 1) * 4096) | 0], ENC[(cl(bl, 0, 1) * 4096) | 0]);
    }
  }
}
