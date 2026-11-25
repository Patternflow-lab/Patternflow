// ===== Patternflow pattern =====
// Title:   Gravothermal Collapse
// Family:  clusterdynamics
// Idea:    A star cluster of unequal masses pulls itself together under its own gravity: the heavy stars sink into a shrinking core, pair into tight binaries that fling light stars out into a thin halo, and the binaries' heat finally pushes the core to swell again, while three lines below trace the radii holding a tenth, a half and nine tenths of the mass.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the direct N-body integration of a self-gravitating cluster with Plummer softening and a kick-drift-kick leapfrog (Aarseth, from memory; Plummer 1911); mass segregation and the Spitzer instability, where a heavy minority cannot share energy with the light majority and sinks to its own core (Spitzer 1969, from memory); the gravothermal catastrophe, the collapse of the core of a cluster that has a negative heat capacity (Antonov 1962, Lynden-Bell and Wood 1968, from memory); the escape of stars past a tidal radius and the slow mass loss of stellar evolution that makes a core expand again (Henon 1961, from memory); the Lagrangian radii as the way a cluster's structure is followed in time; the unit choice, the rebirth of tidal and dead stars from the spectrum at the tidal radius, the mass-ratio knob that rescales every star live, and the strip drawn under the cluster are original, pattern round 244
// Round:   244
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Time=0..4, Mass ratio=-1..1, Tide=-1..1
//
// Knob 1: Hue. Turns the star colours round the wheel and opens on blue-white heavy stars against amber light ones; the two ends stay half the wheel apart. The three radius lines in the strip are three tints of the heavy-star hue and turn with it.
// Knob 2: Time. 0 to 4, opening at 2: how fast the cluster lives, 0.33 times at 0, 1 times at 2 and 3 times at 4. A crossing of the cluster takes about two seconds at 1 times; turned up, the core collapses and swells in a minute, turned down, the stars drift like slow snow and the strip hardly scrolls.
// Knob 3: Mass ratio. -1 to 1, opening at 0: how much heavier the heaviest star is than the lightest, 2 times at -1, 8 times at 0 and 32 times at 1. Low, the stars are alike and the cluster stays wide and soft; high, a few big blue stars sink into a tight bright knot and the core pulls far in.
// Knob 4: Tide. -1 to 1, opening at 0.06 near the middle: the radius past which a star is stripped, 20 LED at -1, 30 at 0 and 45 at 1. Low, the halo is cut off close and the cluster stays compact with the strip's lines low; high, a wide thin halo of light stars fills the panel and the outer line climbs.

const W = 64, H = 128;
const { floor, min, max, abs, sin, cos, sqrt, exp, log, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

// ---- the cluster ------------------------------------------------------------
// LED for length and second for time. GM is chosen so a star crosses the half-mass radius (14 LED) in about two seconds.
const N = 190;            // stars, always: a star that leaves is born again at the tidal radius
const GM = 686;           // G times the cluster mass, LED^3 / s^2
const SOFT2 = 0.5 * 0.5;  // Plummer softening, squared, in LED^2
const SUB = 1 / 120;      // one leapfrog step, seconds
const SUB_PRE = 1 / 60;   // the coarser step of the run before the first frame
const HK = 0.1;           // housekeeping every 0.1 s: ages, tide, the centre of mass, the radii
const PRE = 104;          // seconds run before the first frame
const A_SP = 3.4;         // steepness of the mass spectrum in the log-mass fraction e
const LIFE0 = 2000;       // seconds a star of e = 0 would live
const SAMP = 1.5;         // seconds between samples of the radii strip
const NS = 68;            // samples kept
const VH = 96;            // rows the cluster has; the strip takes the rest
const CX = 32, CY = 48;   // the centre of the cluster on the panel
const ZOOM = 1.5;         // LED on the panel per unit of length in the model

function newMass() {
  return -log(1 - rnd() * (1 - exp(-A_SP))) / A_SP;
}

// the mean of ratio^e over the spectrum, so G stays put when the mass ratio knob is turned
function meanMass(lnR) {
  let s = 0, w = 0;
  for (let i = 0; i < 64; i++) {
    const e = (i + 0.5) / 64, p = exp(-A_SP * e);
    s += p * exp(lnR * e);
    w += p;
  }
  return s / w;
}

function derive(st) {
  const k = st.k;
  st.speed = pow(3, (k[1] - 2) / 2);
  st.ratio = 16 * pow(3, k[2]);
  st.rt = 28 * pow(1.5, k[3]);
  st.lnR = log(st.ratio);
  if (abs(st.lnR - st.lnRm) > 1e-4) {
    st.lnRm = st.lnR;
    st.gv = GM / (N * meanMass(st.lnR));
  }
}

function spawn(st, i, atTide) {
  const e = newMass();
  st.e[i] = e;
  st.life[i] = LIFE0 * exp(-3.5 * e) * (0.6 + 0.8 * rnd());
  st.age[i] = atTide ? 0 : rnd() * st.life[i] * 0.8;
  st.sinceSpawn[i] = 0;
  st.m[i] = exp(st.lnR * e);
  st.gm[i] = st.gv * st.m[i];
  if (!atTide) return;
  const r = st.rt * (0.7 + 0.12 * rnd()), a = rnd() * 2 * PI;
  let gmt = 0;
  for (let j = 0; j < N; j++) gmt += st.gm[j];
  const vc = sqrt(gmt / r), vt = vc * (0.35 + 0.45 * rnd()) * (rnd() < 0.5 ? -1 : 1), vr = -vc * 0.25 * rnd();
  st.px[i] = r * cos(a);
  st.py[i] = r * sin(a);
  st.vx[i] = vr * cos(a) - vt * sin(a);
  st.vy[i] = vr * sin(a) + vt * cos(a);
}

function force(st) {
  const { px, py, ax, ay, gm } = st;
  ax.fill(0);
  ay.fill(0);
  for (let i = 0; i < N; i++) {
    const xi = px[i], yi = py[i], mi = gm[i];
    let fx = 0, fy = 0;
    for (let j = i + 1; j < N; j++) {
      const dx = px[j] - xi, dy = py[j] - yi;
      const r2 = dx * dx + dy * dy + SOFT2, inv = 1 / (r2 * sqrt(r2));
      const a = gm[j] * inv, b = mi * inv;
      fx += dx * a;
      fy += dy * a;
      ax[j] -= dx * b;
      ay[j] -= dy * b;
    }
    ax[i] += fx;
    ay[i] += fy;
  }
}

function step(st) {
  const { px, py, vx, vy, ax, ay } = st, dt = st.sub, h = dt * 0.5;
  for (let i = 0; i < N; i++) {
    vx[i] += ax[i] * h;
    vy[i] += ay[i] * h;
    px[i] += vx[i] * dt;
    py[i] += vy[i] * dt;
  }
  force(st);
  for (let i = 0; i < N; i++) {
    vx[i] += ax[i] * h;
    vy[i] += ay[i] * h;
  }
}

// every 0.1 s: stars age, the dead and the stripped are born again at the tide, the cluster is brought back to the centre,
// and the Lagrangian radii are read
function keep(st) {
  const { px, py, vx, vy, e, age, life, m, gm } = st;
  const lnR = st.lnR, gv = st.gv;
  let again = 0;
  for (let i = 0; i < N; i++) {
    age[i] += HK;
    st.sinceSpawn[i] += HK;
    const q = age[i] / life[i];
    if (q >= 1) {
      if (e[i] > 0.4 && st.live) st.fl.push({ x: px[i], y: py[i], t: st.clock, a: 0.35 + 0.5 * e[i] });
      spawn(st, i, true);
      st.nDeath++;
      again++;
      continue;
    }
    m[i] = exp(lnR * e[i]) * (1 - 0.55 * q * q);
    gm[i] = gv * m[i];
  }
  const rt2 = st.rt * st.rt;
  let cap = 3;
  for (let i = 0; i < N && cap > 0; i++) {
    if (px[i] * px[i] + py[i] * py[i] > rt2) {
      if (st.sinceSpawn[i] < 8) st.nYoung++;
      spawn(st, i, true);
      st.nTide++;
      again++;
      cap--;
    }
  }
  // the centre of mass
  let mt = 0, cx = 0, cy = 0, cvx = 0, cvy = 0;
  for (let i = 0; i < N; i++) {
    const w = gm[i];
    mt += w;
    cx += w * px[i];
    cy += w * py[i];
    cvx += w * vx[i];
    cvy += w * vy[i];
  }
  cx /= mt;
  cy /= mt;
  cvx /= mt;
  cvy /= mt;
  for (let i = 0; i < N; i++) {
    px[i] -= cx;
    py[i] -= cy;
    vx[i] -= cvx;
    vy[i] -= cvy;
  }
  if (again) force(st);
  // the radii holding a tenth, a half and nine tenths of the mass
  const rr = st.rr, ix = st.ix;
  for (let i = 0; i < N; i++) {
    rr[i] = sqrt(px[i] * px[i] + py[i] * py[i]);
    ix[i] = i;
  }
  ix.sort((a, b) => rr[a] - rr[b]);
  let c = 0, f = 0;
  const lv = st.lv, tg = [0.1, 0.5, 0.9];
  let prevR = 0, prevC = 0;
  for (let n = 0; n < N && f < 3; n++) {
    const j = ix[n], c1 = c + gm[j] / mt;
    while (f < 3 && c1 >= tg[f]) {
      const u = (tg[f] - c) / max(1e-9, c1 - c);
      lv[f] = mix(prevR, rr[j], u);
      f++;
    }
    c = c1;
    prevR = rr[j];
    prevC = c;
  }
  void prevC;
  for (let q = 0; q < 3; q++) st.acc3[q] += log(max(0.3, lv[q]));
  st.n3++;
  st.sT += HK;
  if (st.sT >= SAMP - 1e-9) {
    st.sT -= SAMP;
    for (let q = 0; q < 3; q++) {
      const v = st.acc3[q] / st.n3;
      const first = st.sm[q] < -90;
      st.sm[q] = first ? v : mix(st.sm[q], v, 0.55);
      const h = st.hist[q];
      if (first) h.fill(st.sm[q]);
      h.copyWithin(0, 1);
      h[NS - 1] = st.sm[q];
      st.acc3[q] = 0;
    }
    st.n3 = 0;
  }
}

export function setup(params) {
  const f64 = () => new Float64Array(N);
  params.st = {
    nDeath: 0, nTide: 0, nYoung: 0, sinceSpawn: f64(), sub: SUB, keep: Math.round(HK / SUB), k: [0, 2, 0, 0.06], init: false, live: false, t: 0, acc: 0, clock: 0, subs: 0, lnRm: -9, hue: -9,
    px: f64(), py: f64(), vx: f64(), vy: f64(), ax: f64(), ay: f64(),
    e: f64(), age: f64(), life: f64(), m: f64(), gm: f64(), rr: f64(), ix: new Int32Array(N),
    lv: [1, 1, 1], acc3: [0, 0, 0], n3: 0, sT: 0, sm: [-99, -99, -99],
    hist: [new Float64Array(NS), new Float64Array(NS), new Float64Array(NS)],
    fl: [],
  };
}

function advance(st, n) {
  for (let s = 0; s < n; s++) {
    step(st);
    if (++st.subs >= st.keep) {
      st.subs = 0;
      keep(st);
    }
  }
}

function begin(st) {
  st.init = true;
  derive(st);
  const a = 11, vir = 0.9;
  for (let i = 0; i < N; i++) spawn(st, i, false);
  for (let i = 0; i < N; i++) {
    let r;
    do {
      const u = rnd();
      r = a * sqrt(u / (1 - u));
    } while (r > 0.8 * st.rt);
    const th = rnd() * 2 * PI;
    st.px[i] = r * cos(th);
    st.py[i] = r * sin(th);
    const sg = sqrt((vir * GM) / (6 * sqrt(r * r + a * a)));
    st.vx[i] = sg * gauss();
    st.vy[i] = sg * gauss();
  }
  force(st);
  st.sub = SUB_PRE;
  st.keep = Math.round(HK / SUB_PRE);
  advance(st, Math.round(PRE / SUB_PRE));
  st.sub = SUB;
  st.keep = Math.round(HK / SUB);
  st.subs = 0;
  st.fl.length = 0;
  st.live = true;
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  if (!st.init) begin(st);
  derive(st);
  const d = cl(dt || 0, 0, 0.1);
  st.clock += d;
  st.acc += d * st.speed;
  let n = 0;
  while (st.acc >= SUB) {
    st.acc -= SUB;
    n++;
  }
  advance(st, n);
}

// ---- colour -----------------------------------------------------------------
function hsv(h, sa, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - sa), q = v * (1 - f * sa), t = v * (1 - (1 - f) * sa);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A star's colour by c, its mass on a log scale from 0 (the lightest) to 1 (ten times that or more):
// orange, amber, a pale white, then blue-white.
const STOPS = [
  [0.0, 0.07, 0.82, 1.0],
  [0.3, 0.1, 0.72, 1.0],
  [0.55, 0.13, 0.26, 1.0],
  [0.75, 0.57, 0.16, 1.0],
  [1.0, 0.6, 0.5, 1.0],
];
const NC = 48;
function buildColours(st, hue) {
  const a = [0, 0, 0], b = [0, 0, 0];
  for (let i = 0; i < NC; i++) {
    const c = i / (NC - 1);
    let k = 0;
    while (k < STOPS.length - 2 && c > STOPS[k + 1][0]) k++;
    const A = STOPS[k], B = STOPS[k + 1], f = cl((c - A[0]) / (B[0] - A[0]), 0, 1);
    hsv(A[1] + hue, A[2], A[3], a, 0);
    hsv(B[1] + hue, B[2], B[3], b, 0);
    for (let q = 0; q < 3; q++) st.cols[i * 3 + q] = mix(a[q], b[q], f);
  }
  const hh = 0.6 + hue;
  hsv(hh, 0.82, 1, st.gnd, 0);
  hsv(hh, 0.55, 1, st.hazeC, 0);
  hsv(hh - 0.04, 0.35, 1, st.ln[0], 0);
  hsv(hh, 0.78, 0.95, st.ln[1], 0);
  hsv(hh + 0.05, 0.92, 0.85, st.ln[2], 0);
}

// ---- drawing ----------------------------------------------------------------
const GW = 17, GH = 25;      // the haze grid, one node every 4 LED
const LOG_LO = log(1.2), LOG_SPAN = log(55 / 1.2);
const yOf = (lr) => 125.6 - 27.5 * cl((lr - LOG_LO) / LOG_SPAN, 0, 1.05);

// a soft round spot of light, a gaussian of width sg, added to the three planes
function glow(R, G, B, px, py, sg, amp, cr, cg, cb, wx, wy) {
  const rad = 2.6 * sg + 0.5;
  const x0 = max(0, floor(px - rad)), x1 = min(W - 1, floor(px + rad));
  const y0 = max(0, floor(py - rad)), y1 = min(VH - 1, floor(py + rad));
  if (x1 < x0 || y1 < y0) return;
  const k = -0.5 / (sg * sg);
  for (let x = x0; x <= x1; x++) wx[x - x0] = exp(k * (x + 0.5 - px) * (x + 0.5 - px));
  for (let y = y0; y <= y1; y++) {
    const gy = amp * exp(k * (y + 0.5 - py) * (y + 0.5 - py));
    if (gy < 0.002) continue;
    let p = y * W + x0;
    for (let x = x0; x <= x1; x++, p++) {
      const v = gy * wx[x - x0];
      R[p] += v * cr;
      G[p] += v * cg;
      B[p] += v * cb;
    }
  }
}

// the radius curve of the strip at column x, Catmull-Rom between the samples
function curve(P, u) {
  const k = floor(u), t = u - k;
  const n = P.length - 1;
  const a = P[cl(k - 1, 0, n)], b = P[cl(k, 0, n)], c = P[cl(k + 1, 0, n)], d = P[cl(k + 2, 0, n)];
  return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  if (!st.R) {
    st.R = new Float32Array(W * VH);
    st.G = new Float32Array(W * VH);
    st.B = new Float32Array(W * VH);
    st.cols = new Float32Array(NC * 3);
    st.gnd = [0, 0, 0];
    st.hazeC = [0, 0, 0];
    st.ln = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    st.hz = new Float32Array(GW * GH);
    st.hz2 = new Float32Array(GW * GH);
    st.wx = new Float32Array(40);
    st.P = [new Float64Array(NS + 1), new Float64Array(NS + 1), new Float64Array(NS + 1)];
    st.yl = [new Float64Array(W), new Float64Array(W), new Float64Array(W)];
  }
  const hue = st.k[0];
  if (abs(hue - st.hue) > 1e-4) (st.hue = hue), buildColours(st, hue);
  const { R, G, B, cols, wx, hz, hz2 } = st, gnd = st.gnd, hc = st.hazeC;
  R.fill(0);
  G.fill(0);
  B.fill(0);
  hz.fill(0);
  const { px, py, vx, vy, m, sinceSpawn } = st, rt = st.rt, sp = st.speed;
  const LNC = 1 / log(10);
  // the stars
  for (let i = 0; i < N; i++) {
    const x = CX + px[i] * ZOOM, y = CY + py[i] * ZOOM;
    const r = sqrt(px[i] * px[i] + py[i] * py[i]);
    const fade = sstep(0, 2.5, sinceSpawn[i]) * (1 - sstep(0.94 * rt, rt, r));
    if (fade < 0.01) continue;
    const c = cl(log(m[i]) * LNC, 0, 1), ci = floor(c * (NC - 1) + 0.5) * 3;
    const amp = (0.95 + 0.25 * c) * fade, sg = 0.55 + 0.42 * c;
    const cr = cols[ci], cg = cols[ci + 1], cb = cols[ci + 2];
    glow(R, G, B, x, y, sg, amp, cr, cg, cb, wx, wx);
    // a short fading tail behind a fast star
    const v = sqrt(vx[i] * vx[i] + vy[i] * vy[i]) * sp * ZOOM, Lt = min(6, v * 0.35), tw = sstep(1.4, 3.8, Lt) * 0.34 * amp;
    if (tw > 0.01) {
      const ux = -vx[i] * sp * ZOOM / v, uy = -vy[i] * sp * ZOOM / v;
      for (let q = 1; q <= 3; q++) glow(R, G, B, x + ux * Lt * q / 3, y + uy * Lt * q / 3, sg * 0.9, tw * (1 - q / 4), cr, cg, cb, wx, wx);
    }
    // the unresolved light, onto the coarse grid
    const gx = x * 0.25, gy = y * 0.25, hw = pow(m[i], 0.45) * fade;
    const ix = floor(gx), iy = floor(gy), fx = gx - ix, fy = gy - iy;
    if (ix >= 0 && ix < GW - 1 && iy >= 0 && iy < GH - 1) {
      const o = iy * GW + ix;
      hz[o] += hw * (1 - fx) * (1 - fy);
      hz[o + 1] += hw * fx * (1 - fy);
      hz[o + GW] += hw * (1 - fx) * fy;
      hz[o + GW + 1] += hw * fx * fy;
    }
  }
  // flashes where a heavy star has died
  const fl = st.fl;
  for (let i = fl.length - 1; i >= 0; i--) {
    const a = st.clock - fl[i].t;
    if (a > 1.1) {
      fl.splice(i, 1);
      continue;
    }
    const q = a / 1.1, ci = (NC - 1) * 3;
    glow(R, G, B, CX + fl[i].x * ZOOM, CY + fl[i].y * ZOOM, 1.4 + 2.6 * sqrt(q), 0.55 * fl[i].a * (1 - q) * (1 - q), cols[ci] * 0.6 + 0.4, cols[ci + 1] * 0.6 + 0.4, cols[ci + 2] * 0.6 + 0.4, wx, wx);
  }
  // blur the haze once
  for (let j = 0; j < GH; j++) {
    for (let i = 0; i < GW; i++) {
      let s = hz[j * GW + i] * 2, w = 2;
      if (i > 0) (s += hz[j * GW + i - 1]), w++;
      if (i < GW - 1) (s += hz[j * GW + i + 1]), w++;
      if (j > 0) (s += hz[(j - 1) * GW + i]), w++;
      if (j < GH - 1) (s += hz[(j + 1) * GW + i]), w++;
      hz2[j * GW + i] = s / w;
    }
  }
  // the strip: three smooth lines of the radii
  const frac = st.sT / SAMP;
  const x0 = 63.5 - frac - (NS - 1), ylv = st.yl;
  for (let q = 0; q < 3; q++) {
    const P = st.P[q], h = st.hist[q];
    for (let k = 0; k < NS; k++) P[k] = h[k];
    const cur = st.n3 > 0 ? mix(st.sm[q], st.acc3[q] / st.n3, 0.5) : st.sm[q];
    P[NS] = cur;
    for (let x = 0; x < W; x++) ylv[q][x] = yOf(curve(P, x + 0.5 - x0));
  }
  const yt = yOf(log(rt));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r, g, b;
      if (y < VH) {
        const p = y * W + x;
        r = R[p];
        g = G[p];
        b = B[p];
        // the haze, bilinear from the coarse grid
        const gx = (x + 0.5) * 0.25, gy = (y + 0.5) * 0.25;
        const ix = min(GW - 2, floor(gx)), iy = min(GH - 2, floor(gy)), fx = gx - ix, fy = gy - iy, o = iy * GW + ix;
        const hv = 0.07 * (hz2[o] * (1 - fx) * (1 - fy) + hz2[o + 1] * fx * (1 - fy) + hz2[o + GW] * (1 - fx) * fy + hz2[o + GW + 1] * fx * fy);
        r += hv * hc[0];
        g += hv * hc[1];
        b += hv * hc[2];
        // a soft knee on the sum, then a little white where several stars overlap
        const mx = max(r, g, b);
        if (mx > 0.002) {
          const o2 = 1.1 * (1 - exp(-1.0 * mx)), s = o2 / mx, wh = 0.3 * sstep(0.9, 2.0, mx);
          r = r * s * (1 - wh) + o2 * wh;
          g = g * s * (1 - wh) + o2 * wh;
          b = b * s * (1 - wh) + o2 * wh;
        }
        const vg = 1 + 0.5 * exp(-((x - 32) * (x - 32) + (y - 48) * (y - 48)) / 700);
        r = (gnd[0] * 0.05 * vg + r) * 255;
        g = (gnd[1] * 0.05 * vg + g) * 255;
        b = (gnd[2] * 0.12 * vg + b) * 255;
      } else {
        const wash = sstep(yt + 3, yt - 3, y + 0.5) * 0.05;
        r = gnd[0] * (0.03 + wash * 0.5);
        g = gnd[1] * (0.03 + wash * 0.5);
        b = gnd[2] * (0.1 + wash);
        for (let q = 0; q < 3; q++) {
          const yc = ylv[q][x], sl = (ylv[q][min(W - 1, x + 1)] - ylv[q][max(0, x - 1)]) * 0.5;
          const d = (y + 0.5 - yc) / sqrt(1 + sl * sl);
          if (abs(d) > 3.4) continue;
          const v = (q === 0 ? 0.8 : q === 1 ? 0.62 : 0.5) * exp(-d * d / (2 * 1.05 * 1.05)), c = st.ln[q];
          r += v * c[0];
          g += v * c[1];
          b += v * c[2];
        }
        r *= 255;
        g *= 255;
        b *= 255;
      }
      display.setPixel(x, y, cl(r + 0.5, 0, 255) | 0, cl(g + 0.5, 0, 255) | 0, cl(b + 0.5, 0, 255) | 0);
    }
  }
}
