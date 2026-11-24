// ===== Patternflow pattern =====
// Title:   Score Sampler
// Family:  scoremodel
// Idea:    A swarm of points that begin as pure noise far outside the panel and are carried inward, along the probability-flow ODE of a score-based model, to samples of a data distribution that is a mixture of Gaussian lumps whose centres, widths and weights keep wandering, so streaks of cold violet come in from all four edges, turn teal as the noise level falls, and arrive as warm gold-white sparks that flare and fade into a glow that is always being renewed.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: score matching and annealed Langevin sampling with noise-conditional score networks (Yang Song and Stefano Ermon, 2019, from memory), denoising diffusion probabilistic models (Jonathan Ho, Ajay Jain and Pieter Abbeel, 2020, from memory), the reverse-time SDE and the probability-flow ODE (Yang Song and colleagues, 2021, from memory), the sigma parametrisation, the rho noise schedule and the churn of the stochastic sampler (Tero Karras and colleagues, 2022, from memory), and the exact score of a Gaussian mixture, a responsibility-weighted pull towards each centre (from memory), pattern round 227
// Round:   227
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Steps=0..4, Modes=-1..1, Churn=0..1
//
// Knob 1: Hue. Turns the palette once round the colour wheel from 0 to 1 and keeps its order. At 0 the noise is violet-blue, the middle of the flight teal and a finished sample warm gold; at 0.25 the field is green and the samples lilac, at 0.5 orange, at 0.75 purple, and 1 is the same as 0. The palette also drifts by up to 0.07 of the wheel either way over a few minutes, and the exposure by up to 15 percent over about 40 seconds.
// Knob 2: Steps. How long a sample takes from pure noise to clean, in seconds: 4 at 0, where 1800 points make a fast bright rain of long streaks and a sample lingers 2 seconds; 11 at 2, where it opens; 30 at 4, where the streaks are slow and short, a sample lingers 4.6 seconds and the field is a mist drifting inward. The trail time constant goes with it, from 1.0 to 1.6 seconds.
// Knob 3: Modes. How many lumps the data has and how wide they are, as the sigma of each: 2 broad lumps 5.5 LEDs wide at -1, 6 lumps 2.9 wide at 0 where it opens, 10 tight lumps 1.5 wide at +1. They lie on a ring, a line or two clusters that blend into one another, a crescent when the ring is cut short. The count also swells and shrinks by about one around the knob over a minute or so, and a lump the knob has switched off keeps 7 percent of its weight, a faint dust somewhere else.
// Knob 4: Churn. How stochastic the sampler is. At 0 every point follows the smooth probability-flow ODE and the streaks are clean curves. As it rises Langevin noise is added, strongest near noise level 5: at 0.3 a point wanders about 1.5 LEDs per square-root second there, at 1 about 5 in x and 7.6 in y, so the streaks writhe and then dissolve into a mist. The sampler also stops at a higher noise level, 1 LED at 0 and 2.3 at 1, so the settled lumps are 1.2 times wider in x and 1.4 times in y and softer.
// A slow exposure control holds the mean brightness of the picture whatever the knobs say, so a knob changes the picture and not how bright it is.

const W = 64, H = 128, N = W * H;
const { floor, ceil, sqrt, exp, log, sin, cos, tanh, pow, abs, min, max, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

const NP = 1800;          // particles
const KM = 10;            // most mixture components
const CX = 32, CY = 64;   // the middle of the data, the middle of the panel
const AX = 1.0, AY = 1.5; // the noise is stretched to the panel's shape: its variance at level sigma is (AX sigma)^2 by (AY sigma)^2
const SMAX = 80;          // the noise level a sample starts at, in LEDs
const RHO = 2.5;          // the exponent of the noise schedule
const SAT = 0.07;         // weight of a component the Modes knob has switched off, so a faint lump or two is always somewhere else
const PACE = 1.35;        // how much faster the data's own clocks run than the panel's
const NT = 128;           // colour table size
const GAIN = 1.3;         // exposure before the tone curve
const LEVEL = 0.28;       // the mean lit level, 0 to 1, that a slow exposure control holds
const LS0 = 1.6, LS1 = 0.1; // seconds a sample lingers: LS0 plus LS1 of the flight time
const LAM = 0.7, MU = 0.16; // energy a flying particle paints per LED of path and per second
const ER = 2.0;           // energy a particle puts into the trail buffer each second

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Colour by noise level: u = 1 is pure noise and u = 0 a finished sample. Stops are colour (max channel 1), then the
// ramp is scaled by a brightness that is dim for noise and full for a clean sample.
const STOPS = [
  [1.0, 0.52, 0.26, 1.0],
  [0.84, 0.34, 0.38, 1.0],
  [0.66, 0.12, 0.66, 1.0],
  [0.5, 0.1, 0.88, 0.84],
  [0.34, 0.3, 0.93, 0.56],
  [0.22, 0.85, 0.88, 0.34],
  [0.1, 1.0, 0.72, 0.26],
  [0.0, 1.0, 0.88, 0.6],
];

function buildTable(P, hue) {
  const rot = hue * TAU;
  const cr = cos(rot), sr = sin(rot);
  const tab = P.tab;
  for (let i = 0; i <= NT; i++) {
    const u = i / NT;
    let s = 0;
    while (s < STOPS.length - 2 && u < STOPS[s + 1][0]) s++;
    const a = STOPS[s], b = STOPS[s + 1];
    const f = cl((a[0] - u) / (a[0] - b[0]), 0, 1);
    const r = a[1] + (b[1] - a[1]) * f, g = a[2] + (b[2] - a[2]) * f, bl = a[3] + (b[3] - a[3]) * f;
    // rotate the chroma about the luma axis (YIQ), so the order of the ramp and its brightness stay
    const Y = 0.299 * r + 0.587 * g + 0.114 * bl;
    let I = 0.596 * r - 0.274 * g - 0.322 * bl;
    let Q = 0.211 * r - 0.523 * g + 0.312 * bl;
    const I2 = I * cr - Q * sr, Q2 = I * sr + Q * cr;
    let R = Y + 0.956 * I2 + 0.621 * Q2;
    let G = Y - 0.272 * I2 - 0.647 * Q2;
    let B = Y - 1.106 * I2 + 1.703 * Q2;
    R = max(R, 0); G = max(G, 0); B = max(B, 0);
    // a turn of the hue keeps the brightness: the mean of luma and of the three channels stays what the unturned colour had
    const keep = 0.5 * (Y + (r + g + bl) / 3), now = 0.5 * (0.299 * R + 0.587 * G + 0.114 * B + (R + G + B) / 3);
    const fix = keep / max(now, 1e-3);
    R *= fix; G *= fix; B *= fix;
    const bri = 0.55 + 0.45 * pow(1 - u, 1.5);
    tab[i * 3] = R * bri;
    tab[i * 3 + 1] = G * bri;
    tab[i * 3 + 2] = B * bri;
  }
}

function gauss(rand) {
  return sqrt(-2 * log(1 - rand())) * cos(TAU * rand());
}

// The palette breathes a little (up to 0.07 of the colour wheel either way) and so does the exposure, on clocks of their own.
function level(P) {
  const buf = P.buf, g = GAIN * P.gn;
  let sm = 0, c = 0;
  for (let i = 0; i < N * 3; i += 15) { sm += 1 - exp(-max(buf[i], buf[i + 1], buf[i + 2]) * g); c++; }
  return sm / c;
}

function drift(P) {
  const C = P.C, t = P.t;
  const h = P.hue + 0.045 * sin(C.hdF * t + C.hdP) + 0.025 * sin(C.hdF2 * t + C.hdP2);
  P.expo = 1 + 0.1 * sin(C.exF * t + C.exP) + 0.05 * sin(C.exF2 * t + C.exP2);
  if (abs(h - P.hueDone) > 0.002) { buildTable(P, h); P.hueDone = h; }
}

export function setup(P) {
  const rand = rng(227227);
  P.rand = rand;
  P.ready = false;
  P.t = 0;
  P.rot = TAU * rand();
  P.px = new Float32Array(NP);
  P.py = new Float32Array(NP);
  P.sg = new Float32Array(NP);
  P.ts = new Float32Array(NP);   // < 0 in flight, else seconds since arrival
  P.ls = new Float32Array(NP);   // how long this sample lingers
  P.age = new Float32Array(NP);  // seconds since birth
  P.wait = new Float32Array(NP); // seconds before it is born
  P.buf = new Float32Array(N * 3);
  P.tab = new Float32Array((NT + 1) * 3);
  P.hueDone = -9;
  P.gn = 1;
  P.T = 11; P.churn = 0.06; P.n = 6; P.hue = 0;
  // The mixture: per component, its own slow clocks. None divides another, so the arrangement does not come back.
  const f = (a, b) => a + (b - a) * rand();
  const C = { k: [] };
  for (let k = 0; k < KM; k++) {
    C.k.push({
      wxF: f(0.045, 0.19), wxP: TAU * rand(), wyF: f(0.045, 0.19), wyP: TAU * rand(),
      ax: f(3.5, 7), ay: f(5, 11),
      sF: f(0.05, 0.17), sP: TAU * rand(), wF: f(0.04, 0.15), wP: TAU * rand(), h: rand(),
      zP: TAU * rand(),
    });
  }
  C.gF = [f(0.052, 0.075), f(0.083, 0.12), f(0.036, 0.058)];
  C.gP = [TAU * rand(), TAU * rand(), TAU * rand()];
  C.spF = f(0.036, 0.05); C.spP = TAU * rand();
  C.rxF = f(0.05, 0.07); C.rxP = TAU * rand(); C.ryF = f(0.06, 0.08); C.ryP = TAU * rand();
  C.rotF = f(0.028, 0.034); C.rotP = TAU * rand();
  C.lnF = f(0.03, 0.044); C.lnP = TAU * rand(); C.lhF = f(0.045, 0.06); C.lhP = TAU * rand();
  C.zzF = f(0.09, 0.14);
  C.clF = f(0.024, 0.034); C.clP = TAU * rand(); C.cmF = f(0.04, 0.056); C.cmP = TAU * rand();
  C.ccF = f(0.06, 0.09); C.ccP = TAU * rand();
  C.hdF = f(0.017, 0.025); C.hdP = TAU * rand(); C.hdF2 = f(0.043, 0.057); C.hdP2 = TAU * rand();
  C.exF = f(0.11, 0.15); C.exP = TAU * rand(); C.exF2 = f(0.19, 0.23); C.exP2 = TAU * rand();
  C.nF = f(0.055, 0.075); C.nP = TAU * rand(); C.nF2 = f(0.101, 0.131); C.nP2 = TAU * rand();
  C.gxF = f(0.03, 0.045); C.gxP = TAU * rand(); C.gxF2 = f(0.071, 0.093); C.gxP2 = TAU * rand();
  C.gyF = f(0.025, 0.04); C.gyP = TAU * rand(); C.gyF2 = f(0.061, 0.083); C.gyP2 = TAU * rand();
  P.C = C;
  P.mx = new Float64Array(KM); P.my = new Float64Array(KM); P.ms = new Float64Array(KM); P.lw = new Float64Array(KM);
  P.vx = new Float64Array(KM); P.vy = new Float64Array(KM); P.vs = new Float64Array(KM);
  P.havePrev = false;
  P.nk = KM;
}

// The data distribution at time t: KM Gaussian lumps. Centres are a blend of three layouts, an arc or ring, a line and
// two clusters, whose weights are slow softmaxes of incommensurate sines, plus a wander of every lump of its own.
function mixture(P, dt) {
  const { C, mx, my, ms, lw, vx, vy, vs } = P;
  const t = P.t * PACE;
  // the count of lumps swells and shrinks by about one around what the knob says, on two clocks of its own
  const n = cl(P.n + 0.9 * sin(C.nF * t + C.nP) + 0.5 * sin(C.nF2 * t + C.nP2) - 0.2, 1.8, KM);
  const sBase = 5.5 * pow(0.28, (n - 2) / 8);
  const e0 = exp(3.6 * sin(C.gF[0] * t + C.gP[0])), e1 = exp(3.6 * sin(C.gF[1] * t + C.gP[1])), e2 = exp(3.6 * sin(C.gF[2] * t + C.gP[2]));
  const es = e0 + e1 + e2, g0 = e0 / es, g1 = e1 / es, g2 = e2 / es;
  // arc or ring
  const span = min(TAU, PI * (1.15 + 0.95 * sin(C.spF * t + C.spP)));
  const rx = 24 * (0.92 + 0.16 * sin(C.rxF * t + C.rxP)), ry = 50 * (0.92 + 0.16 * sin(C.ryF * t + C.ryP));
  const rot = P.rot;
  const shx = -0.45 * (1 - span / TAU) * rx * cos(rot), shy = -0.45 * (1 - span / TAU) * ry * sin(rot);
  // line
  const phi = 0.8 * sin(C.lnF * t + C.lnP);
  const dxl = sin(phi), dyl = cos(phi);
  const hl = min(48, 25 / max(abs(dxl), 0.02)) * (0.75 + 0.25 * sin(C.lhF * t + C.lhP));
  // two clusters
  const psi = 0.7 * sin(C.clF * t + C.clP);
  const cm = 30 * (0.7 + 0.3 * sin(C.cmF * t + C.cmP));
  const cdx = -sin(psi) * cm, cdy = cos(psi) * cm;
  const gx = 9 * sin(C.gxF * t + C.gxP) + 4 * sin(C.gxF2 * t + C.gxP2), gy = 14 * sin(C.gyF * t + C.gyP) + 6 * sin(C.gyF2 * t + C.gyP2);
  const few = 1.5 + 0.9 * cl((6 - n) / 4, 0, 1);
  let wsum = 0;
  for (let k = 0; k < KM; k++) {
    const K = C.k[k];
    const u = (k + 0.5) / n;
    const ang = rot + (span / n) * (k + 0.5 - n / 2);
    const ax = CX + rx * cos(ang) + shx, ay = CY + ry * sin(ang) + shy;
    const along = (2 * u - 1) * hl, perp = 5 * sin(6 * u + C.zzF * t + K.zP);
    const lx = CX + dxl * along + dyl * perp, ly = CY + dyl * along - dxl * perp;
    const j = k & 1, idx = k >> 1;
    const cnt = max(1, (n - j) / 2);
    const rcf = 1 - exp(-2 * max(cnt - 1, 0));
    const rc = (0.8 * cnt + 1.5) * sBase * rcf;
    const a2 = TAU * idx / cnt + C.ccP + C.ccF * t;
    const sgn = j ? -1 : 1;
    const qx = CX + sgn * cdx + rc * cos(a2), qy = CY + sgn * cdy + rc * sin(a2);
    let x = g0 * ax + g1 * lx + g2 * qx, y = g0 * ay + g1 * ly + g2 * qy;
    x += gx + few * K.ax * sin(K.wxF * t + K.wxP);
    y += gy + few * K.ay * sin(K.wyF * t + K.wyP);
    x = CX + 27 * tanh((x - CX) / 27);
    y = CY + 57 * tanh((y - CY) / 57);
    const s = sBase * (0.75 + 0.5 * K.h) * (1 + 0.3 * sin(K.sF * t + K.sP));
    const act = cl(n - k, 0, 1) + SAT * (1 - cl(n - k, 0, 1));
    const w = act * (0.1 + 0.9 * pow(0.5 + 0.5 * sin(K.wF * t + K.wP), 1.4));
    if (P.havePrev && dt > 0) {
      vx[k] = (x - mx[k]) / dt; vy[k] = (y - my[k]) / dt; vs[k] = (s - ms[k]) / dt;
    } else { vx[k] = 0; vy[k] = 0; vs[k] = 0; }
    mx[k] = x; my[k] = y; ms[k] = s;
    lw[k] = w;
    wsum += w;
  }
  for (let k = 0; k < KM; k++) lw[k] = log(max(lw[k] / wsum, 1e-7));
  P.nk = KM;
  P.havePrev = true;
}

// One Gaussian splat of total energy 1 times (r, g, b), sigma sp LEDs, into the trail buffer.
function splat(buf, x, y, sp, r, g, b) {
  const R = ceil(2.3 * sp);
  const x0 = floor(x) - R + 1, y0 = floor(y) - R + 1;
  const m = 2 * R;
  const inv = 1 / (2 * sp * sp);
  let sx = 0, sy = 0;
  const wx = P_WX, wy = P_WY;
  for (let i = 0; i < m; i++) {
    const dx = x0 + i + 0.5 - x;
    const dy = y0 + i + 0.5 - y;
    wx[i] = exp(-dx * dx * inv);
    wy[i] = exp(-dy * dy * inv);
    sx += wx[i]; sy += wy[i];
  }
  const k = 1 / (sx * sy);
  for (let j = 0; j < m; j++) {
    const yy = y0 + j;
    if (yy < 0 || yy >= H) continue;
    const wj = wy[j] * k;
    const row = yy * W;
    for (let i = 0; i < m; i++) {
      const xx = x0 + i;
      if (xx < 0 || xx >= W) continue;
      const w = wj * wx[i];
      const o = (row + xx) * 3;
      buf[o] += w * r; buf[o + 1] += w * g; buf[o + 2] += w * b;
    }
  }
}
const P_WX = new Float32Array(16), P_WY = new Float32Array(16);

function birth(P, i) {
  const rand = P.rand;
  P.px[i] = CX + SMAX * AX * gauss(rand);
  P.py[i] = CY + SMAX * AY * gauss(rand);
  P.sg[i] = SMAX;
  P.ts[i] = -1;
  P.age[i] = 0;
  P.wait[i] = 0;
}

// Advance every particle by d seconds. With paint, each also leaves its energy along the path it just took.
function step(P, d, paint) {
  const { px, py, sg, ts, ls, age, wait, buf, tab, mx, my, ms, lw, vx, vy, vs } = P;
  const nk = P.nk;
  const T = P.T;
  const floorS = 1 + 1.3 * P.churn;
  // Karras's rho schedule: sigma^(1/rho) falls linearly, so the flight spends more of its time at high noise than a
  // geometric schedule would. The rate sigma falls at, over sigma, is RHO dz / sigma^(1/RHO), and it is what drives the score term.
  const z1 = pow(SMAX, 1 / RHO), z0 = pow(floorS, 1 / RHO), dz = (z1 - z0) / T;
  const L = log(SMAX / floorS);
  const c0 = 0.5 * P.churn * P.churn;
  const lSet = LS0 + LS1 * T;
  const rand = P.rand;
  if (paint) {
    const dk = exp(-d / P.tau);
    for (let i = 0; i < N * 3; i++) buf[i] *= dk;
  }
  const lr = new Float64Array(nk);
  for (let i = 0; i < NP; i++) {
    if (wait[i] > 0) {
      wait[i] -= d;
      if (wait[i] > 0) continue;
      birth(P, i);
      ls[i] = lSet * (0.6 + 0.8 * rand());
    }
    let x = px[i], y = py[i], s = sg[i];
    const flight = ts[i] < 0;
    const s2 = s * s;
    const vxx = s2 * AX * AX, vyy = s2 * AY * AY;
    // Churn is strongest at middle noise levels and weak at both ends.
    const lnr = log(s / 5) / 0.75;
    const cs = c0 * (0.015 + exp(-0.5 * lnr * lnr));
    const kr = (flight ? RHO * dz / pow(s, 1 / RHO) : 0) + cs;
    let mxl = -1e30;
    for (let k = 0; k < nk; k++) {
      const dx = x - mx[k], dy = y - my[k];
      const sk = ms[k] * ms[k];
      const Vx = sk + vxx, Vy = sk + vyy;
      const l = lw[k] - 0.5 * (dx * dx / Vx + dy * dy / Vy) - 0.5 * log(Vx * Vy);
      lr[k] = l;
      if (l > mxl) mxl = l;
    }
    let zs = 0;
    for (let k = 0; k < nk; k++) { lr[k] = exp(lr[k] - mxl); zs += lr[k]; }
    let ux = 0, uy = 0;
    for (let k = 0; k < nk; k++) {
      const r = lr[k] / zs;
      const dx = x - mx[k], dy = y - my[k];
      const sk = ms[k] * ms[k];
      const Vx = sk + vxx, Vy = sk + vyy;
      const sd = ms[k] * vs[k];
      ux += r * (vx[k] - kr * (vxx / Vx) * dx + (sd / Vx) * dx);
      uy += r * (vy[k] - kr * (vyy / Vy) * dy + (sd / Vy) * dy);
    }
    let nx = x + ux * d, ny = y + uy * d;
    if (cs > 0) {
      const a = sqrt(2 * cs * d) * s;
      nx += a * AX * gauss(rand);
      ny += a * AY * gauss(rand);
    }
    px[i] = nx; py[i] = ny;
    age[i] += d;
    let e;
    let u;
    if (flight) {
      const z = pow(s, 1 / RHO) - dz * d;
      s = z > z0 ? pow(z, RHO) : floorS;
      if (s <= floorS) { s = floorS; ts[i] = 0; }
      sg[i] = s;
      u = cl(log(s / floorS) / L, 0, 1);
      e = 1 - exp(-age[i] / 0.5);
    } else {
      ts[i] += d;
      s = max(s, floorS);
      sg[i] = s;
      const q = ts[i];
      u = 0;
      const f = q / ls[i];
      e = (0.55 + 5 * exp(-q / 0.18)) * (1 - smooth((f - 0.25) / 0.75));
      if (f >= 1) { wait[i] = 1e-9; ts[i] = -1; continue; }
    }
    if (!paint) continue;
    if (nx < -8 && x < -8) continue;
    if (nx > W + 8 && x > W + 8) continue;
    if (ny < -8 && y < -8) continue;
    if (ny > H + 8 && y > H + 8) continue;
    const idx = (u * NT + 0.5) | 0;
    const sp = 0.72 + 0.01 * min(s, 30);
    const ddx = nx - x, ddy = ny - y;
    const len = sqrt(ddx * ddx + ddy * ddy);
    // In flight a particle paints by path length, so a stream is as bright where it runs fast as where it runs slow;
    // a sample that has arrived paints by time.
    const dl = sqrt(ux * ux + uy * uy) * d;
    const E = flight ? e * (0.1 + 0.9 * smooth((u - 0.15) / 0.55)) * (LAM * dl + MU * d) : e * ER * d;
    const ns = min(8, ceil(len / 1.1)) || 1;
    const q = E / ns;
    const cr = tab[idx * 3] * q, cg = tab[idx * 3 + 1] * q, cb = tab[idx * 3 + 2] * q;
    for (let j = 0; j < ns; j++) {
      const f = (j + 0.5) / ns;
      splat(buf, x + ddx * f, y + ddy * f, sp, cr, cg, cb);
    }
  }
}

export function update(dt, input, P) {
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  const hue = cl(kv[0], 0, 1);
  const Tt = 4 * pow(7.5, cl(kv[1], 0, 4) / 4);
  const nt = 6 + 4 * cl(kv[2], -1, 1);
  const ct = cl(kv[3], 0, 1);
  if (!P.ready) {
    P.ready = true;
    P.T = Tt; P.n = nt; P.churn = ct; P.hue = hue;
    P.tau = 1.0 + 0.6 * (P.T - 4) / 26;
    drift(P);
    for (let i = 0; i < NP; i++) { P.wait[i] = P.rand() * (P.T + LS0 + LS1 * P.T); P.ts[i] = -1; P.sg[i] = SMAX; }
    const total = P.T + LS0 + LS1 * P.T + 3.2;
    let rem = total;
    mixture(P, 0.1);
    while (rem > 3.2) {
      P.t += 0.1; P.rot += 0.1 * 0.08 * PACE; rem -= 0.1;
      mixture(P, 0.1);
      step(P, 0.1, false);
    }
    while (rem > 1e-6) {
      const h = 1 / 30;
      P.t += h; P.rot += h * 0.08 * PACE; rem -= h;
      mixture(P, h);
      step(P, h, true);
    }
    for (let i = 0; i < 8; i++) P.gn = cl(P.gn * pow(LEVEL / max(level(P), 0.02), 1.4), 0.5, 2);
    drift(P);
    return;
  }
  const k = 1 - exp(-d / 0.35);
  P.T += (Tt - P.T) * k;
  P.n += (nt - P.n) * k;
  P.churn += (ct - P.churn) * k;
  P.hue = hue;
  P.tau = 1.0 + 0.6 * (P.T - 4) / 26;
  P.t += d;
  P.rot += d * PACE * (0.08 + 0.06 * sin(P.C.rotF * P.t * PACE + P.C.rotP));
  mixture(P, d);
  drift(P);
  step(P, d, true);
  P.gn = cl(P.gn * exp(0.1 * d * log(LEVEL / max(level(P), 0.02))), 0.5, 2);
}

export function draw(display, P) {
  const buf = P.buf;
  const GN = GAIN * P.gn * P.expo;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const r = buf[o], g = buf[o + 1], b = buf[o + 2];
      const m = max(r, g, b, 1e-6);
      // The curve acts on the brightest channel and the other two follow it, so a bright lump keeps its gold; a little
      // of the top end is let through towards white.
      const f = 1 - exp(-m * GN);
      const k = 255 * f / m;
      const wh = f * f * f * 0.35 * 255;
      display.setPixel(x, y, min(255, r * k + wh * (1 - r * k / 255)), min(255, g * k + wh * (1 - g * k / 255)), min(255, b * k + wh * (1 - b * k / 255)));
    }
}
