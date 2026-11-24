// ===== Patternflow pattern =====
// Title:   Langmuir Windrows
// Family:  langmuir
// Idea:    Three thousand specks of foam on deep water seen from above are swept by the wind's paired counter-turning cells into long bright windrows that run with the wind and merge two into one at Y-shaped junctions that slide downwind, with a line splitting now and then and the gusts making every line swell and fade.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Langmuir circulation and its windrows (Irving Langmuir, 1938, from memory), the Craik-Leibovich vortex-force theory of the cells (Alan Craik and Sidney Leibovich, 1976, from memory), dislocations of a stripe pattern, where a line ends and two lines become one (Eric Siggia and Annette Zippelius, 1981; Yves Pomeau, Stephane Zaleski and Paul Manneville, 1983, from memory); pattern round 234
// Round:   234
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Wind=0.4..3, Cells=-1..1, Merging=-1..1
//
// Knob 1: Hue. The colour of the water, turned from teal-blue at 0 (OKLCH hue 208) through ultramarine and indigo to violet at 1 (308); the foam stays white with a trace of it. It stops short of the warm end, where dark water goes brown on the panel.
// Knob 2: Wind. How hard it blows: the foam runs down the lines at 0.8 LED a second at 0.4, 4 at the opening 2 and 6 at 3, and the junctions slide down at 0.4, 1.9 and 2.9. In a calm the cells pull weakly and the lines are broad, faint and dusted with stray foam (2.7 LED wide at half height at 0.4); in a blow they are tight and bright (2.5 at 2 and at 3).
// Knob 3: Cells. The width of one pair of cells, which is the gap between windrows: 6.1 LED at -1 (ten lines across the panel, each 2.2 LED wide at half height), 9.5 at the opening 0 (seven, 2.5 wide), 18.1 at 1 (three and a half, 2.7 wide). The foam is shared among the lines there are, so the fewer they are the heavier each one is.
// Knob 4: Merging. How often the lines tear and how much they wander. At -1 a new junction is born about once in 50 s, the lines wander 0.3 LED and the arms of a merge meet at 8 degrees; at the opening 0.06 once in 26 s, 0.7 LED and 10 degrees; at 1 once in 11 s, 1.8 LED and 15 degrees, and the panel is a braid of merges and forks.

const W = 64;
const H = 128;
const NP = 3000; // specks of foam
const NM = 5; // meander modes
const MAXC = 48; // most junction cores that can be alive at once
const MGX = 25; // the meander is tabulated on a grid 4 LED apart, x from -16 and y from -8
const MGY = 37;
const { floor, sqrt, exp, log, cos, sin, PI, min, max, pow } = Math;
const TAU = 2 * PI;
const HALF_PI = PI / 2;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

// The model. The windrows are the lines of constant phase of a stripe pattern, y running down the panel with the wind:
//   theta(x, y, t) = q (x - 32 - sway) + meander(x, y, t) + sum over cores of s_d * atan2((y - y_d) / eta_d, x - x_d),
// and a line is where theta is a multiple of 2 pi. A core is a dislocation of the stripes, where the phase turns once round:
// s = +1 is a merge, two lines above it and one below as y grows downwind, and s = -1 is a fork. Stretching y by eta makes the
// arms meet at atan(1 / eta). The cores are born above the panel, slide down at about half the wind, each held on a ridge so that
// its arms are symmetric, and their signs are chosen so that the number of lines across the panel stays within two of the one
// the Cells knob asks for. The surface flow is the gradient of cos(theta), u = -U sin(theta) (theta_x / q), so it converges on
// every line and spreads from between them; each speck of foam rides it, runs down the wind and gets its own random shove.

// ---- colour: OKLCH to sRGB
function oklch(L, C, hDeg, out) {
  const h = (hDeg * PI) / 180;
  const a = C * cos(h);
  const b = C * sin(h);
  const l = pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  for (let i = 0; i < 3; i++) {
    const v = cl(lin[i], 0, 1);
    out[i] = 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055);
  }
}

function fatan2(y, x) {
  const ax = x < 0 ? -x : x;
  const ay = y < 0 ? -y : y;
  const mx = ax > ay ? ax : ay;
  if (mx === 0) return 0;
  const a = (ax < ay ? ax : ay) / mx;
  const s = a * a;
  let r = ((-0.0464964749 * s + 0.15931422) * s - 0.327622764) * s * a + a;
  if (ay > ax) r = 1.57079637 - r;
  if (x < 0) r = 3.14159274 - r;
  return y < 0 ? -r : r;
}

export function setup(P) {
  Object.assign(P, {
    t: 0,
    warm: false,
    k1: 0,
    q: TAU / 9.5,
    lam: 9.5,
    lamT: 9.5,
    wind: 2,
    windT: 2,
    mg: 0.06,
    mgT: 0.06,
    gust: 1,
    cores: [],
    nb: 4,
    nc: 0,
    cxA: new Float64Array(MAXC),
    cyA: new Float64Array(MAXC),
    cwA: new Float64Array(MAXC),
    cieA: new Float64Array(MAXC),
    ccA: new Uint8Array(MAXC),
    mp: new Float64Array(NM),
    mkx: new Float64Array(NM),
    mky: new Float64Array(NM),
    mnu: new Float64Array(NM),
    mb: new Float64Array(NM),
    mq: new Float64Array(NM),
    ma: new Float64Array(NM),
    mth: new Float32Array(MGX * MGY),
    mtx: new Float32Array(MGX * MGY),
    gbr: 1,
    sway: 0,
    px: new Float32Array(NP),
    py: new Float32Array(NP),
    pv: new Float32Array(NP),
    pnx: new Float32Array(NP),
    pny: new Float32Array(NP),
    pw: new Float32Array(NP),
    pf: new Float32Array(NP),
    pp: new Float32Array(NP),
    D: new Float32Array(W * H),
    B1: new Float32Array(W * H),
    G: new Float32Array(W * H),
    tmp: new Float32Array(W * H),
    gph: new Float64Array(3),
    gkx: new Float64Array(3),
    gky: new Float64Array(3),
    gb: new Float64Array(3),
    sxg: new Float32Array(W * 3),
    cxg: new Float32Array(W * 3),
    syg: new Float32Array(H * 3),
    cyg: new Float32Array(H * 3),
    g0: Math.random() * TAU,
  });
  for (let m = 0; m < NM; m++) {
    const lx = 24 + 56 * Math.random();
    const ly = 40 + 80 * Math.random();
    P.mkx[m] = (TAU / lx) * (Math.random() < 0.5 ? -1 : 1);
    P.mky[m] = TAU / ly;
    P.mp[m] = Math.random() * TAU;
    P.mnu[m] = 0.12 * gauss();
    P.mb[m] = 0.75 + 0.5 * Math.random();
    P.mq[m] = Math.random() * TAU;
  }
  for (let k = 0; k < 3; k++) {
    P.gkx[k] = (TAU / (30 + 60 * Math.random())) * (Math.random() < 0.5 ? -1 : 1);
    P.gky[k] = TAU / (45 + 70 * Math.random());
    P.gph[k] = Math.random() * TAU;
    P.gb[k] = 0.5 + 0.5 * Math.random();
    for (let x = 0; x < W; x++) {
      P.sxg[k * W + x] = sin(P.gkx[k] * x);
      P.cxg[k * W + x] = cos(P.gkx[k] * x);
    }
  }
}

// ---- the stripe phase at a point: P.q, the meander and the live cores
let TH = 0;
let TX = 0;
const RC2 = 1.5;
function phaseAt(P, x, y) {
  let gx = (x + 16) * 0.25;
  let gy = (y + 8) * 0.25;
  if (gx < 0) gx = 0;
  else if (gx > MGX - 1.001) gx = MGX - 1.001;
  if (gy < 0) gy = 0;
  else if (gy > MGY - 1.001) gy = MGY - 1.001;
  const ix = gx | 0;
  const iy = gy | 0;
  const fx = gx - ix;
  const fy = gy - iy;
  const o = iy * MGX + ix;
  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;
  let th = P.q * (x - 32 - P.sway) + w00 * P.mth[o] + w10 * P.mth[o + 1] + w01 * P.mth[o + MGX] + w11 * P.mth[o + MGX + 1];
  let tx = P.q + w00 * P.mtx[o] + w10 * P.mtx[o + 1] + w01 * P.mtx[o + MGX] + w11 * P.mtx[o + MGX + 1];
  const n = P.nc;
  for (let c = 0; c < n; c++) {
    const dx = x - P.cxA[c];
    const dy = (y - P.cyA[c]) * P.cieA[c];
    let al = fatan2(dy, dx);
    if (P.ccA[c]) {
      if (al > HALF_PI) al -= TAU;
    } else if (al < -HALF_PI) al += TAU;
    const sw = P.cwA[c];
    th += sw * al;
    tx -= (sw * dy) / (dx * dx + dy * dy + RC2);
  }
  TH = th;
  TX = tx;
}

function fillMeander(P) {
  for (let j = 0; j < MGY; j++)
    for (let i = 0; i < MGX; i++) {
      const x = -16 + 4 * i;
      const y = -8 + 4 * j;
      let th = 0;
      let tx = 0;
      for (let m = 0; m < NM; m++) {
        const a = P.ma[m];
        const arg = P.mkx[m] * x + P.mky[m] * y - P.mp[m];
        th += a * cos(arg);
        tx -= a * P.mkx[m] * sin(arg);
      }
      P.mth[j * MGX + i] = th;
      P.mtx[j * MGX + i] = tx;
    }
}

// ---- the cores
const CORE_Y0 = -80;
function prepCores(P) {
  const cs = P.cores;
  const etaM = 7.2 - 1.7 * (P.mg + 1);
  P.nc = cs.length;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    P.cxA[i] = c.x + P.sway;
    P.cyA[i] = c.y;
    P.cwA[i] = c.s * sm(CORE_Y0, -25, c.y) * (1 - sm(H + 25, H + 80, c.y));
    P.cieA[i] = 1 / (etaM * c.er);
    P.ccA[i] = c.y > H * 0.5 ? 1 : 0;
  }
}

const wrap = (v) => v - TAU * Math.round(v / TAU);
const weightOf = (c) => c.s * sm(CORE_Y0, -25, c.y) * (1 - sm(H + 25, H + 80, c.y));

// the phase at (x, y) with core number skip left out: what the stripes would be without it
function phaseSkip(P, x, y, skip) {
  let gx = (x + 16) * 0.25;
  let gy = (y + 8) * 0.25;
  gx = cl(gx, 0, MGX - 1.001);
  gy = cl(gy, 0, MGY - 1.001);
  const ix = gx | 0;
  const iy = gy | 0;
  const fx = gx - ix;
  const fy = gy - iy;
  const o = iy * MGX + ix;
  let th = P.q * (x - 32 - P.sway) + (1 - fx) * (1 - fy) * P.mth[o] + fx * (1 - fy) * P.mth[o + 1] + (1 - fx) * fy * P.mth[o + MGX] + fx * fy * P.mth[o + MGX + 1];
  const cs = P.cores;
  const etaM = 7.2 - 1.7 * (P.mg + 1);
  for (let k = 0; k < cs.length; k++) {
    if (k === skip) continue;
    const c = cs[k];
    const dx = x - c.x - P.sway;
    const dy = (y - c.y) / (etaM * c.er);
    let al = Math.atan2(dy, dx);
    if (c.y > H * 0.5) {
      if (al > HALF_PI) al -= TAU;
    } else if (al < -HALF_PI) al += TAU;
    th += weightOf(c) * al;
  }
  return th;
}

// A dislocation looks like a clean Y, two lines running into one, when the stripes without it have a ridge
// a quarter turn off its centre. Each core is held there, so it rides one line as the lines move.
const SEAT = -HALF_PI;
function seatCore(P, i, k) {
  const c = P.cores[i];
  const e = wrap(phaseSkip(P, c.x + P.sway, c.y, i) - SEAT - c.dl);
  c.x -= cl(e / P.q, -P.lam * 0.5, P.lam * 0.5) * k;
}

function levelAt(cs, y) {
  let s = 0;
  for (let i = 0; i < cs.length && cs[i].y < y; i++) s += cs[i].s;
  return s;
}

function tryBirth(P) {
  const cs = P.cores;
  if (cs.length >= MAXC - 2) return false;
  if (cs.length && cs[0].y < CORE_Y0 + 24 * (1 - 0.55 * ((P.mg + 1) / 2))) return false;
  let run = 0;
  let lo = 0;
  let hi = 0;
  for (const c of cs) {
    run += c.s;
    lo = min(lo, run);
    hi = max(hi, run);
  }
  const B = 2;
  const m = (levelAt(cs, H * 0.25) + levelAt(cs, H * 0.5) + levelAt(cs, H * 0.75)) / 3;
  let s = m > 0.3 ? -1 : m < -0.3 ? 1 : Math.random() < 0.5 ? 1 : -1;
  if (Math.random() < 0.2) s = -s;
  const ok = (v) => lo + v >= -B && hi + v <= B;
  if (!ok(s)) s = -s;
  if (!ok(s)) return false;
  const er = (s > 0 ? 1 : 0.55) * (0.85 + 0.3 * Math.random());
  const x = 8 + 48 * Math.random();
  cs.unshift({ x, y: CORE_Y0, s, er, dl: 0.5 * gauss(), sp: 0.9 + 0.2 * Math.random() });
  for (let it = 0; it < 5; it++) seatCore(P, 0, 1);
  return true;
}

function stepCores(P, d) {
  const cs = P.cores;
  const mgN = (P.mg + 1) / 2;
  const cc = 0.95 * P.wind;
  const k = 1 - exp(-d / 1.1);
  const dk = sqrt((2 * d) / 20) * 0.5;
  for (const c of cs) {
    c.dl += (-c.dl / 20) * d + dk * gauss();
    c.y += cc * c.sp * d;
  }
  for (let i = cs.length - 2; i >= 0; i--) if (cs[i].y > cs[i + 1].y - 6) cs[i].y = cs[i + 1].y - 6;
  while (cs.length && cs[cs.length - 1].y > H + 85) cs.pop();
  for (let i = 0; i < cs.length; i++) seatCore(P, i, k);
  P.nb -= d;
  if (P.nb <= 0) {
    const rate = (1 / 60) * pow(6, mgN) * (P.wind / 2);
    if (tryBirth(P)) P.nb = -log(1 - Math.random() * 0.999) / rate;
    else P.nb = 1;
  }
}

// ---- the foam
function seedSpeck(P, i, top) {
  let y = top ? -1 - Math.random() * 4 : Math.random() * H;
  let x = -12 + Math.random() * 88;
  if (Math.random() < 0.96) {
    for (let k = 0; k < 3; k++) {
      phaseAt(P, x, y);
      const w = TH - TAU * Math.round(TH / TAU);
      const tx = max(TX, 0.35 * P.q);
      x -= cl(w / tx, -P.lam * 0.5, P.lam * 0.5);
    }
  }
  P.px[i] = x + (top ? 0.5 * gauss() : 0);
  P.py[i] = y;
  if (top) return;
  P.pv[i] = 0.82 + 0.36 * Math.random();
  P.pnx[i] = (1.3 - 0.2 * P.wind) * gauss();
  P.pny[i] = 0.3 * gauss();
  const r = Math.random();
  P.pw[i] = (0.75 + 0.5 * Math.random()) * (r < 0.03 ? 1.9 : 1);
  P.pf[i] = 0.6 + 1.6 * Math.random();
  P.pp[i] = Math.random() * TAU;
}

function advanceModes(P, d) {
  const cphi = 0.55 * 2 * P.wind;
  const mgN = (P.mg + 1) / 2;
  const tot = 0.3 + 1.3 * mgN * mgN;
  for (let m = 0; m < NM; m++) {
    P.mp[m] += (P.mky[m] * cphi + P.mnu[m]) * d;
    P.ma[m] = (tot / sqrt(NM)) * P.mb[m] * (0.8 + 0.2 * sin(0.07 * P.t * (1 + 0.37 * m) + P.mq[m]));
  }
}

function stepSpecks(P, d) {
  const V = 2 * P.wind;
  const U = (2 + 0.9 * P.wind) * P.gust;
  const qr = P.q;
  const tau = 0.6;
  const ou = sqrt((2 * d) / tau);
  const sx = (1.3 - 0.2 * P.wind) * ou;
  const sy = 0.3 * ou;
  const dec = 1 - d / tau;
  for (let i = 0; i < NP; i++) {
    const x = P.px[i];
    const y = P.py[i];
    phaseAt(P, x, y);
    const sc = cl(TX / qr, -1.5, 1.8);
    P.pnx[i] = P.pnx[i] * dec + sx * gauss();
    P.pny[i] = P.pny[i] * dec + sy * gauss();
    P.px[i] = x + (-U * sin(TH) * sc + P.pnx[i]) * d;
    P.py[i] = y + (V * P.pv[i] * P.gust + P.pny[i]) * d;
    if (!(P.py[i] <= H + 3 && P.px[i] >= -14 && P.px[i] <= 78)) seedSpeck(P, i, true);
  }
}

// the slow things that belong to the whole panel: the gusts, and the sway of the whole pattern sideways
function clock(P, d) {
  P.t += d;
  const t = P.t;
  const gs = 0.42 * sin(1.9 * t + P.g0) + 0.33 * sin(1.1 * t + 2.1 * P.g0) + 0.25 * sin(0.69 * t + 4.3 * P.g0);
  P.gust = 1 + 0.2 * gs;
  P.gbr = 1 + 0.3 * gs;
  P.sway = 3.2 * sin(0.093 * t + P.g0 * 1.7) + 2.1 * sin(0.057 * t + P.g0 * 0.6) + 1.3 * sin(0.151 * t + P.g0 * 3.1);
  const cgust = 2 * P.wind;
  for (let k = 0; k < 3; k++) P.gph[k] += P.gky[k] * cgust * d;
}

function step(P, d) {
  P.lam += (P.lamT - P.lam) * (1 - exp(-d / 1.2));
  P.wind += (P.windT - P.wind) * (1 - exp(-d / 0.8));
  P.mg += (P.mgT - P.mg) * (1 - exp(-d / 2));
  P.q = TAU / P.lam;
  clock(P, d);
  advanceModes(P, d);
  fillMeander(P);
  stepCores(P, d);
  prepCores(P);
  stepSpecks(P, d);
}

export function update(dt, input, P) {
  if (!P.cores) setup(P);
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  const d = min(max(dt || 0, 0), 0.1);
  P.k1 = cl(k[0], 0, 1);
  P.windT = cl(k[1], 0.4, 3);
  const k3 = cl(k[2], -1, 1);
  P.lamT = k3 < 0 ? 9.5 * pow(1.55, k3) : 9.5 * pow(1.9, k3);
  P.mgT = cl(k[3], -1, 1);
  if (!P.warm) {
    P.warm = true;
    P.lam = P.lamT;
    P.wind = P.windT;
    P.mg = P.mgT;
    P.q = TAU / P.lam;
    // The cores are older than the picture: let enough of them come and go to fill the panel with junctions.
    const tFill = (H + 165) / (0.95 * P.wind);
    const n = floor(tFill / 0.5);
    for (let i = 0; i < n; i++) {
      clock(P, 0.5);
      advanceModes(P, 0.5);
      fillMeander(P);
      stepCores(P, 0.5);
    }
    fillMeander(P);
    prepCores(P);
    for (let i = 0; i < NP; i++) seedSpeck(P, i, false);
    for (let i = 0; i < 30; i++) stepSettle(P, 0.1);
  }
  step(P, d);
}

// the opening settles the foam onto the lines without moving it down the panel
function stepSettle(P, d) {
  const U = 2 + 0.9 * P.wind;
  const qr = P.q;
  for (let i = 0; i < NP; i++) {
    phaseAt(P, P.px[i], P.py[i]);
    const sc = cl(TX / qr, -1.5, 1.8);
    P.px[i] += (-U * sin(TH) * sc + P.pnx[i]) * d;
  }
}

// ---- drawing
function blurH(src, dst) {
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      const l = src[o + (x > 0 ? x - 1 : 0)];
      const r = src[o + (x < W - 1 ? x + 1 : W - 1)];
      dst[o + x] = 0.1 * l + 0.8 * src[o + x] + 0.1 * r;
    }
  }
}
function blurV(src, dst) {
  for (let y = 0; y < H; y++) {
    const a = (y > 0 ? y - 1 : 0) * W;
    const b = y * W;
    const c = (y < H - 1 ? y + 1 : H - 1) * W;
    for (let x = 0; x < W; x++) dst[b + x] = 0.25 * src[a + x] + 0.5 * src[b + x] + 0.25 * src[c + x];
  }
}
function boxH(src, dst, r) {
  const n = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let s = 0;
    for (let k = -r; k <= r; k++) s += src[o + cl(k, 0, W - 1)];
    for (let x = 0; x < W; x++) {
      dst[o + x] = s / n;
      s += src[o + min(x + r + 1, W - 1)] - src[o + max(x - r, 0)];
    }
  }
}
function boxV(src, dst, r) {
  const n = 2 * r + 1;
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += src[cl(k, 0, H - 1) * W + x];
    for (let y = 0; y < H; y++) {
      dst[y * W + x] = s / n;
      s += src[min(y + r + 1, H - 1) * W + x] - src[max(y - r, 0) * W + x];
    }
  }
}

export function draw(display, P) {
  if (!P.cores || !P.warm) return;
  const D = P.D;
  D.fill(0);
  const t = P.t;
  for (let i = 0; i < NP; i++) {
    const fx = P.px[i] - 0.5;
    const fy = P.py[i] - 0.5;
    if (fx < -1 || fx >= W || fy < -1 || fy >= H) continue;
    const ix = floor(fx);
    const iy = floor(fy);
    const ax = fx - ix;
    const ay = fy - iy;
    const w = P.pw[i] * (1 + 0.3 * sin(t * P.pf[i] * 2.4 + P.pp[i]));
    const x1 = ix + 1;
    const y1 = iy + 1;
    if (iy >= 0) {
      if (ix >= 0) D[iy * W + ix] += w * (1 - ax) * (1 - ay);
      if (x1 < W) D[iy * W + x1] += w * ax * (1 - ay);
    }
    if (y1 < H) {
      if (ix >= 0) D[y1 * W + ix] += w * (1 - ax) * ay;
      if (x1 < W) D[y1 * W + x1] += w * ax * ay;
    }
  }
  // the foam as a density, a line of light 2 to 3 LED wide: a short blur across, a longer one along, and a wide glow for the paler water
  const B1 = P.B1;
  const tmp = P.tmp;
  blurH(D, B1);
  blurV(B1, tmp);
  blurV(tmp, B1);
  if (P.lam < 7.5) {
    blurV(B1, tmp);
    B1.set(tmp);
  }
  const G = P.G;
  boxH(B1, tmp, 2);
  boxV(tmp, G, 3);

  // colours: deep water, the paler water the foam lies in, and the foam
  const hue = 208 + 100 * P.k1;
  const o = [0, 0, 0];
  oklch(0.3, 0.075, hue, o);
  const dr = o[0];
  const dg = o[1];
  const db = o[2];
  oklch(0.5, 0.09, hue - 4, o);
  const gr = o[0];
  const gg = o[1];
  const gb = o[2];
  oklch(0.97, 0.03, hue - 6, o);
  const fr = o[0];
  const fg = o[1];
  const fb = o[2];

  const gain = P.gbr * pow(9.5 / P.lam, 0.85) * (0.8 + 0.15 * P.wind);
  // gust field
  for (let k = 0; k < 3; k++)
    for (let y = 0; y < H; y++) {
      const a = P.gky[k] * y - P.gph[k];
      P.syg[k * H + y] = sin(a);
      P.cyg[k * H + y] = cos(a);
    }
  const gamp = 0.18;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let gf = 1;
      for (let k = 0; k < 3; k++) gf += gamp * P.gb[k] * (P.sxg[k * W + x] * P.cyg[k * H + y] + P.cxg[k * W + x] * P.syg[k * H + y]);
      const f = 1 - exp(-1.25 * gain * gf * B1[i]);
      const a = 1 - exp(-2 * gain * gf * G[i]);
      let r = dr + (gr - dr) * a;
      let g = dg + (gg - dg) * a;
      let b = db + (gb - db) * a;
      r += (fr - r) * f;
      g += (fg - g) * f;
      b += (fb - b) * f;
      display.setPixel(x, y, min(255, r) | 0, min(255, g) | 0, min(255, b) | 0);
    }
  }
}
