// ===== Patternflow pattern =====
// Title:   Meteor Trains
// Family:  meteor
// Idea:    A night sky seen through the tall panel, where meteors flash across in a fraction of a second and each leaves a persistent train, a glowing green column of gas that the one invisible wind of the upper air, blowing a different way at every height, shears into a slow S and then a kinked ribbon, so that several trains alive at once are many threads drawing the same wind profile before they thicken, turn amber and fade.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 210, after the persistent trains of bright meteors at 80 to 100 km, the green of the 557.7 nm oxygen line fading to orange, and the way a train is pulled into an S by the wind that changes with height
// Round:   210
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=0.4..5, Wind=-1..1, Linger=-1..1
//
// Knob 1: Hue. Turns the whole palette round the colour wheel: the sky, the stars, the white-green flash of the head and the ageing of a train. At 0 a train starts white-green, goes green, then yellow, amber and a dim brick red; at 0.25 it starts blue and ends teal; at 0.5 it runs violet to blue; at 0.75 orange to pink; at 1 it is back where it began.
// Knob 2: Rate. How many meteors a minute, four times the knob. At 0.4 one every 37 s and the sky is nearly empty, at the opening 2 eight a minute (seven or eight trains alive, the oldest nearly faded), at 5 twenty a minute, with the sky held to nine trains by letting the oldest fade early. A meteor lasts 0.3 to 0.9 s and draws a 30 to 70 row streak; about every three minutes a fireball lights the whole sky and leaves a thicker train that lasts 2.4 times as long.
// Knob 3: Wind. How hard the upper wind shears the trains, and it acts on every train at once, old ones included. At -1 the wind is 0.15 of the opening and a train 40 s old stays within about 4 LEDs of a straight line; at the opening 0 the same train runs about 25 LEDs from its leftmost row to its rightmost, an S or a kink; at 1 the wind is twice as strong and trains fold into runs nearly flat across the panel.
// Knob 4: Linger. How long a train lasts and how far it spreads. At -1 it lasts 13 to 23 s and stays a thread 2 LEDs across; at the opening 0.06 it lasts 45 to 80 s and thickens from 2 LEDs across to about 3; at 1 it lasts 130 to 230 s and ends 4 or 5 LEDs across and dim, with nine trains in the sky at once.

const W = 64;
const H = 128;
const { sin, cos, sqrt, exp, log, floor, ceil, max, min, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hash(i) {
  const h = sin(i * 12.9898 + 4.1414) * 43758.5453;
  return h - floor(h);
}

// ---- the wind ----
// Layers of wind blowing opposite ways, a few tens of rows from crest to crest, and the
// whole pattern of layers sinks slowly, a wavelength in a few minutes (the way an
// atmospheric tide does). Four modes, periods that do not divide, amplitudes that breathe.
const LAM = [98, 61, 38, 25]; // vertical wavelength, in rows
const MAMP = [1.0, 0.64, 0.4, 0.22];
const SINK = [377, 241, 163, 107]; // seconds a mode takes to sink one wavelength
const MPH = [0.7, 2.9, 4.6, 1.9];
const BREATH = [611, 887, 1307, 509]; // seconds for a mode's strength to swell and fall
const U0 = 0.45; // LEDs a second for a mode of amplitude 1, at Wind 0
const MEAN = 0.3; // a steady wind that wanders, in the same unit
const PAD = 20; // rows of wind table above and below the panel
const NR = H + 2 * PAD;
const SY = [];
const CY = [];
for (let k = 0; k < 4; k++) {
  const s = new Float32Array(NR);
  const c = new Float32Array(NR);
  for (let r = 0; r < NR; r++) {
    const a = (TAU * (r - PAD)) / LAM[k];
    s[r] = sin(a);
    c[r] = cos(a);
  }
  SY.push(s);
  CY.push(c);
}
const T0 = 130; // where the wind's clocks stand when the Lab starts

// ---- the trains ----
const MAXT = 9; // live trains at most (a new one asks the oldest to leave early)
const POOL = 12;
const MAXP = 96; // points in a train's polyline: one a row
const PRE_S = 240; // seconds the first update has already run
const BASE_LIFE = 70; // seconds, before the Linger knob and the train's own factor
const SIG0 = 0.7; // a young train's width, LEDs (sigma), so it is 2.5 LEDs across at half height

// ---- colour ----
// OKLCH to linear sRGB, then scaled so the brightest channel is 1.
function tint(hueTurns, L, C, out) {
  const h = hueTurns * TAU;
  const a = C * cos(h);
  const b = C * sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  r = max(r, 0);
  g = max(g, 0);
  bl = max(bl, 0);
  const k = 1 / max(r, g, bl, 1e-6);
  out[0] = r * k;
  out[1] = g * k;
  out[2] = bl * k;
}

// a train's colour by age (0 young .. 1 gone): hue in OKLCH degrees, lightness, chroma
const AGEKEY = [
  [0.0, 165, 0.98, 0.07],
  [0.12, 152, 0.94, 0.16],
  [0.5, 142, 0.9, 0.2],
  [0.68, 110, 0.93, 0.19],
  [0.83, 80, 0.88, 0.17],
  [0.94, 56, 0.78, 0.16],
  [1.0, 36, 0.66, 0.15],
];
const NA = 33;
const RAMP = new Float32Array(NA * 3);
const SKYC = new Float32Array(3);
const STARC = new Float32Array(3);
const HEADC = new Float32Array(3);
const tmp3 = [0, 0, 0];

function buildColours(hue) {
  for (let i = 0; i < NA; i++) {
    const a = i / (NA - 1);
    let k = 0;
    while (k < AGEKEY.length - 2 && a > AGEKEY[k + 1][0]) k++;
    const A = AGEKEY[k];
    const B = AGEKEY[k + 1];
    const u = cl((a - A[0]) / (B[0] - A[0]), 0, 1);
    const h = A[1] + (B[1] - A[1]) * u;
    tint(((((h / 360 + hue) % 1) + 1) % 1), A[2] + (B[2] - A[2]) * u, A[3] + (B[3] - A[3]) * u, tmp3);
    RAMP[i * 3] = tmp3[0];
    RAMP[i * 3 + 1] = tmp3[1];
    RAMP[i * 3 + 2] = tmp3[2];
  }
  tint((((262 / 360 + hue) % 1) + 1) % 1, 0.5, 0.1, tmp3);
  SKYC[0] = tmp3[0];
  SKYC[1] = tmp3[1];
  SKYC[2] = tmp3[2];
  tint((((235 / 360 + hue) % 1) + 1) % 1, 0.95, 0.035, tmp3);
  STARC[0] = tmp3[0];
  STARC[1] = tmp3[1];
  STARC[2] = tmp3[2];
  // the head of a meteor: nearly white, a breath of the young train's green
  HEADC[0] = 0.55 + 0.45 * RAMP[0];
  HEADC[1] = 0.55 + 0.45 * RAMP[1];
  HEADC[2] = 0.55 + 0.45 * RAMP[2];
}

// encode: linear light, soft knee above 0.6, then 1/2.2. The table is indexed by the
// square root of the light so the dark end, where the sky lives, has fine steps.
const NLUT = 1024;
const ENC = new Uint8Array(NLUT + 1);
for (let i = 0; i <= NLUT; i++) {
  const x = 2.5 * (i / NLUT) * (i / NLUT);
  const y = x < 0.6 ? x : 0.6 + 0.4 * (1 - exp(-(x - 0.6) / 0.4));
  ENC[i] = Math.round(255 * Math.pow(y, 0.45));
}

// a Gaussian cut off at three sigma, by squared distance in units of 2 sigma^2
const GN = 192;
const GQ = 4.5;
const GL = new Float32Array(GN + 1);
for (let i = 0; i <= GN; i++) GL[i] = max(0, (exp((-i * GQ) / GN) - exp(-GQ)) / (1 - exp(-GQ)));

// ---- the stars: few, dim, each a soft cross a LED across so none reads as a stray dot ----
const NSTAR = 30;
const STARS = [];
for (let i = 0; i < NSTAR; i++) {
  STARS.push({
    x: 2 + floor(hash(i * 3.7 + 1) * (W - 4)),
    y: 2 + floor(Math.pow(hash(i * 5.3 + 2), 0.8) * (H - 14)),
    b: 0.42 + 0.58 * hash(i * 2.9 + 3) * hash(i * 2.9 + 3),
    p1: hash(i * 7.1 + 4) * TAU,
    f1: 0.5 + 1.4 * hash(i * 1.3 + 5),
    p2: hash(i * 9.7 + 6) * TAU,
    f2: 0.19 + 0.4 * hash(i * 4.1 + 7),
  });
}

export function setup(params) {
  const trains = [];
  for (let i = 0; i < POOL; i++) {
    trains.push({
      on: false,
      fire: false,
      t0: 0,
      dur: 0.5,
      life: 70,
      sig0: SIG0,
      mass: 1,
      y0: 0,
      n: 0,
      kill: -1,
      px0: new Float32Array(MAXP),
      D: new Float32Array(MAXP),
      bk: new Float32Array(MAXP),
    });
  }
  params.s = {
    primed: false,
    t: T0,
    hue: 0,
    rate: 6,
    wind: 1,
    lingT: 0.85,
    ling: 0.85,
    nev: 0, // meteors so far
    credit: 0, // rate integrated since the last meteor
    need: 0.6, // how much credit the next meteor costs
    fireAt: T0 + PRE_S + 55 + 60 * hash(3.3), // when the next fireball is due
    flash: 0, // the sky's glow from a fireball
    trains,
    urow: new Float32Array(NR), // the wind at each row, LEDs a second at Wind 1
    acc: new Float32Array(W * H * 3),
    buf: new Float32Array(W * H),
    xs: new Float32Array(MAXP),
    am: new Float32Array(MAXP),
    cx: new Float32Array(W),
    rowv: new Float32Array(H),
    rowg: new Float32Array(H),
    box: [0, 0],
  };
  nextCost(params.s);
}

function nextCost(S) {
  S.need = -log(1e-3 + 0.999 * hash(S.nev * 1.37 + 0.31));
}

function readKnobs(S, kn) {
  S.hue = cl(kn[0], 0, 1);
  S.rate = 4 * cl(kn[1], 0.4, 5); // meteors a minute
  const w = cl(kn[2], -1, 1);
  S.wind = w < 0 ? 1 + 0.85 * w : 1 + w;
  const l = cl(kn[3], -1, 1);
  S.lingT = 0.25 * Math.pow(10, (l + 1) / 2);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input.knobValues || [0, 2, 0, 0.06];
  readKnobs(S, kn);
  if (!S.primed) {
    S.primed = true;
    S.ling = S.lingT;
    // run the sky for a few minutes with the opening knobs so it is already populated
    for (let i = 0; i < PRE_S / 0.2; i++) advance(S, 0.2);
  }
  advance(S, cl(dt || 0, 0, 0.1));
}

// ---- the wind at row r at the state's clock ----
function windTable(S) {
  const t = S.t;
  const u = S.urow;
  const c = [0, 0, 0, 0];
  const s = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const ph = -(TAU * t) / SINK[k] + MPH[k];
    const amp = MAMP[k] * (0.72 + 0.28 * sin((TAU * t) / BREATH[k] + 2.3 * k + 0.4));
    c[k] = amp * cos(ph);
    s[k] = amp * sin(ph);
  }
  const mean = MEAN * (0.6 * sin((TAU * t) / 613 + 1.0) + 0.4 * sin((TAU * t) / 347 + 2.1));
  for (let r = 0; r < NR; r++) {
    // sin(a + ph) = sin a cos ph + cos a sin ph
    u[r] = U0 * (SY[0][r] * c[0] + CY[0][r] * s[0] + SY[1][r] * c[1] + CY[1][r] * s[1] + SY[2][r] * c[2] + CY[2][r] * s[2] + SY[3][r] * c[3] + CY[3][r] * s[3] + mean);
  }
}

function advance(S, d) {
  S.t += d;
  const t = S.t;
  // the linger knob eases, so turning it never pops a train out of the sky
  S.ling += (S.lingT - S.ling) * (1 - exp(-d / 1.2));
  windTable(S);
  // age the trains and carry every point along the wind at its own row
  const u = S.urow;
  S.flash = 0;
  for (const tr of S.trains) {
    if (!tr.on) continue;
    const y0 = tr.y0 + PAD;
    const D = tr.D;
    for (let i = 0; i < tr.n; i++) D[i] += u[y0 + i] * d;
    const age = t - tr.t0;
    const a = age / (tr.life * S.ling);
    if (a >= 1 || (tr.kill >= 0 && t - tr.kill > 3)) tr.on = false;
    else if (tr.fire) S.flash += sm(-0.1, 0.3, age) * exp(-max(0, age - tr.dur) / 1.1) * 0.5;
  }
  // meteors arrive as a Poisson process whose rate wanders a little
  const mod = max(0.35, 1 + 0.3 * sin(0.0234 * t + 1.0) + 0.2 * sin(0.0617 * t + 0.3));
  S.credit += ((S.rate * mod) / 60) * d;
  while (S.credit >= S.need) {
    S.credit -= S.need;
    spawn(S, t);
    S.nev++;
    nextCost(S);
  }
}

// ---- a meteor and the train it leaves ----
function spawn(S, t0) {
  const n = S.nev;
  const h = (k) => hash(n * 7.31 + k * 3.17 + 0.5);
  // a free slot, or the oldest train asked to go early
  let slot = null;
  let live = 0;
  let oldest = null;
  for (const tr of S.trains) {
    if (!tr.on) {
      if (!slot) slot = tr;
    } else {
      live++;
      if (tr.kill < 0 && (!oldest || tr.t0 < oldest.t0)) oldest = tr;
    }
  }
  if (live >= MAXT && oldest) oldest.kill = t0;
  if (!slot) return;
  const fire = t0 >= S.fireAt;
  if (fire) S.fireAt = t0 + 130 + 110 * h(9);
  const len = fire ? 68 + 16 * h(1) : 30 + 40 * h(1);
  const npts = min(MAXP - 1, floor(len) + 1);
  // three places to try; keep the one farthest from every train already in the sky, so
  // the threads spread over the panel and no part of the window stays empty for long
  let ytop = 0;
  let xm = 0;
  let best = -1;
  for (let c = 0; c < 3; c++) {
    const cy = floor(-6 + (H - len + 12) * h(2 + 20 * c));
    const cx = 7 + 50 * h(3 + 20 * c);
    let near = 9;
    for (const tr of S.trains) {
      if (!tr.on) continue;
      const mi = tr.n >> 1;
      const dx = (tr.px0[mi] + S.wind * tr.D[mi] - cx) / 64;
      const dy = (tr.y0 + mi - (cy + len / 2)) / 128;
      near = min(near, dx * dx + dy * dy);
    }
    if (near > best) {
      best = near;
      ytop = cy;
      xm = cx;
    }
  }
  // the radiant stands above the panel and drifts a little through the night, so every
  // meteor leans away from it: within about 25 degrees of straight down
  const xr = 32 + 20 * sin(0.0191 * t0 + 0.7);
  const yr = -55;
  const ym = ytop + len / 2;
  const slope = cl((xm - xr) / (ym - yr) + 0.05 * (h(4) - 0.5), -0.46, 0.46);
  slot.on = true;
  slot.fire = fire;
  slot.t0 = t0;
  slot.dur = fire ? 1.0 + 0.4 * h(5) : 0.3 + 0.6 * h(5);
  slot.life = BASE_LIFE * (0.75 + 0.55 * h(6)) * (fire ? 2.4 : 1);
  slot.sig0 = fire ? 1.4 : SIG0;
  slot.mass = fire ? 1.5 : 0.8 + 0.45 * h(7);
  slot.y0 = ytop;
  slot.n = npts;
  slot.kill = -1;
  const ph1 = h(10) * TAU;
  const ph2 = h(11) * TAU;
  const ph3 = h(12) * TAU;
  for (let i = 0; i < npts; i++) {
    slot.px0[i] = xm + slope * (i - len / 2);
    slot.D[i] = 0;
    // the gas is thicker in knots along the burn, and thin toward both ends
    const knots = 0.62 + 0.38 * (0.5 + 0.5 * sin(0.23 * i + ph1)) * (0.6 + 0.4 * sin(0.071 * i + ph2));
    const end = sm(0, 7, i) * sm(0, 7, npts - 1 - i);
    slot.bk[i] = knots * (0.25 + 0.75 * end) * (0.88 + 0.12 * sin(0.9 * i + ph3));
  }
}

// ---- drawing ----
// the distance field of a polyline, taken as the brightest of its segments, so a bend
// neither doubles up nor leaves a gap
function seg(buf, xa, ya, xb, yb, aa, ab, sg, box) {
  const R = 3 * sg;
  const dx = xb - xa;
  const dy = yb - ya;
  const l2 = dx * dx + dy * dy;
  const il2 = l2 > 1e-6 ? 1 / l2 : 0;
  const x0 = max(0, floor(min(xa, xb) - R));
  const x1 = min(W - 1, ceil(max(xa, xb) + R));
  const y0 = max(0, floor(min(ya, yb) - R));
  const y1 = min(H - 1, ceil(max(ya, yb) + R));
  if (x1 < x0 || y1 < y0) return;
  if (y0 < box[0]) box[0] = y0;
  if (y1 > box[1]) box[1] = y1;
  const iq = GN / (GQ * 2 * sg * sg);
  const da = ab - aa;
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5 - ya;
    let o = y * W + x0;
    for (let x = x0; x <= x1; x++, o++) {
      const px = x + 0.5 - xa;
      let tt = (px * dx + py * dy) * il2;
      tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
      const ex = px - tt * dx;
      const ey = py - tt * dy;
      const q = ((ex * ex + ey * ey) * iq) | 0;
      if (q >= GN) continue;
      const v = GL[q] * (aa + tt * da);
      if (v > buf[o]) buf[o] = v;
    }
  }
}

// add the buffer into the light, in one colour, and clear it
function merge(S, c0, c1, c2, box) {
  const buf = S.buf;
  const acc = S.acc;
  for (let y = box[0]; y <= box[1]; y++) {
    let o = y * W;
    for (let x = 0; x < W; x++, o++) {
      const v = buf[o];
      if (v > 0) {
        acc[o * 3] += v * c0;
        acc[o * 3 + 1] += v * c1;
        acc[o * 3 + 2] += v * c2;
        buf[o] = 0;
      }
    }
  }
  box[0] = H;
  box[1] = -1;
}

function fillSky(S, t) {
  const acc = S.acc;
  const fl = S.flash;
  // a faint band of airglow low down that drifts a little, and a slow wave across it
  for (let y = 0; y < H; y++) {
    const yy = y / (H - 1);
    const band = exp(-((y - 108 + 5 * sin(0.013 * t)) * (y - 108 + 5 * sin(0.013 * t))) / (2 * 20 * 20));
    S.rowv[y] = 0.00035 + 0.0007 * yy + 0.0045 * band;
    S.rowg[y] = 0.0025 * band;
  }
  for (let x = 0; x < W; x++) S.cx[x] = 0.9 + 0.1 * sin(0.11 * x + 0.021 * t) + 0.05 * sin(0.23 * x - 0.013 * t);
  const sky = SKYC;
  let o = 0;
  for (let y = 0; y < H; y++) {
    const rv = S.rowv[y] + fl * (0.012 + 0.03 * (1 - y / H));
    const rg = S.rowg[y];
    for (let x = 0; x < W; x++) {
      const cxv = S.cx[x];
      const v = rv * cxv;
      const g = rg * cxv;
      acc[o] = v * sky[0] + g * 0.5;
      acc[o + 1] = v * sky[1] + g * 1.0;
      acc[o + 2] = v * sky[2] + g * 0.7;
      o += 3;
    }
  }
}

function stars(S, t) {
  const acc = S.acc;
  const c = STARC;
  const dim = 1 - 0.8 * min(1, S.flash * 4);
  for (const st of STARS) {
    const tw = 0.62 + 0.26 * sin(st.f1 * t + st.p1) + 0.12 * sin(st.f2 * t + st.p2);
    const v = 0.11 * st.b * tw * dim;
    const o = (st.y * W + st.x) * 3;
    for (let k = 0; k < 3; k++) acc[o + k] += v * c[k];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const o2 = o + (dy * W + dx) * 3;
      for (let k = 0; k < 3; k++) acc[o2 + k] += v * 0.2 * c[k];
    }
  }
}

function drawTrain(S, tr, t) {
  const age = t - tr.t0;
  const flying = age < tr.dur;
  const f = flying ? age / tr.dur : 1;
  const n = tr.n;
  const nv = flying ? min(n, floor(f * (n - 1)) + 1) : n;
  const a = cl(age / (tr.life * S.ling), 0, 1);
  let gone = 1;
  if (tr.kill >= 0) gone = 1 - cl((t - tr.kill) / 3, 0, 1);
  const wind = S.wind;
  const xs = S.xs;
  const am = S.am;
  // thickening: the width squared grows with age, faster the longer the train is let to live
  const dd = 0.014 * (0.5 + S.ling) * (tr.fire ? 1.3 : 1);
  const sg = min(tr.fire ? 2.2 : 1.9, sqrt(tr.sig0 * tr.sig0 + dd * max(0, age)));
  // mass in the line is kept, so it dims as it spreads; and it fades out over its life
  const fade = exp(-1.3 * a) * (1 - sm(0.7, 1, a));
  const base = 0.95 * tr.mass * Math.pow(tr.sig0 / sg, 0.7) * fade * gone;
  for (let i = 0; i < nv; i++) xs[i] = tr.px0[i] + wind * tr.D[i];
  for (let i = 0; i < nv; i++) {
    const nb = i + 1 < nv ? i + 1 : i - 1;
    const sx = nb >= 0 ? xs[nb] - xs[i] : 0;
    // gas stretched along a slanting run is thinner per LED of line
    const stretch = 1 / sqrt(sqrt(1 + sx * sx));
    const tb = tr.t0 + (tr.dur * i) / (n - 1);
    const wake = 0.85 * exp(-(t - tb) / 0.9) * (tr.fire ? 1.4 : 1) * gone;
    am[i] = (base * tr.bk[i] + wake * (0.4 + 0.6 * tr.bk[i])) * stretch;
  }
  const box = S.box;
  box[0] = H;
  box[1] = -1;
  const y0 = tr.y0;
  for (let i = 0; i + 1 < nv; i++) {
    if (am[i] < 0.004 && am[i + 1] < 0.004) continue;
    seg(S.buf, xs[i], y0 + i, xs[i + 1], y0 + i + 1, am[i], am[i + 1], sg, box);
  }
  const ci = round3(a);
  merge(S, RAMP[ci], RAMP[ci + 1], RAMP[ci + 2], box);

  // the meteor itself: a bright head and a tapering streak, white-green
  if (age < tr.dur + 0.25 && nv >= 1) {
    const hf = flying ? f : 1;
    const hi = hf * (n - 1);
    const tail = tr.fire ? 14 : 7 + 3 * hash(tr.t0 * 3.1);
    const fl = flying ? sin(PI * min(1, hf)) : 0;
    const env = flying ? 0.35 + 0.65 * Math.pow(sin(PI * min(0.999, hf)), 0.5) : exp(-(age - tr.dur) / 0.07);
    const hs = tr.fire ? 2.1 : 1.15;
    // streak: the points just behind the head
    const i0 = max(0, floor(hi - tail * 2.4));
    const i1 = min(n - 1, floor(hi));
    let m = 0;
    for (let i = i0; i <= i1; i++, m++) {
      xs[m] = tr.px0[i] + wind * tr.D[i];
      am[m] = (tr.fire ? 1.35 : 1.0) * exp(-(hi - i) / tail) * env * (0.7 + 0.3 * tr.bk[i]);
    }
    const hx = tr.px0[i1] + wind * tr.D[i1] + (hi - i1) * (tr.px0[min(n - 1, i1 + 1)] - tr.px0[i1]);
    const hy = y0 + hi;
    xs[m] = hx;
    am[m] = (tr.fire ? 1.4 : 1.05) * env;
    m++;
    box[0] = H;
    box[1] = -1;
    const ssg = tr.fire ? 1.5 : 1.0;
    for (let i = 0; i + 1 < m; i++) {
      const ya = y0 + i0 + i;
      const yb = i + 2 < m ? ya + 1 : hy;
      seg(S.buf, xs[i], ya, xs[i + 1], yb, am[i], am[i + 1], ssg, box);
    }
    merge(S, HEADC[0], HEADC[1], HEADC[2], box);
    // the head: a hot core and a halo
    blob(S.acc, hx, hy, hs, (tr.fire ? 3.0 : 1.5) * env, HEADC);
    blob(S.acc, hx, hy, hs * 2.6, (tr.fire ? 0.4 : 0.07) * env, HEADC);
    if (tr.fire) blob(S.acc, hx, hy, 9, 0.1 * env * fl, HEADC);
  }
}

function round3(a) {
  return floor(a * (NA - 1) + 0.5) * 3;
}

function blob(acc, cx, cy, sg, amp, col) {
  const R = 3 * sg;
  const x0 = max(0, floor(cx - R));
  const x1 = min(W - 1, ceil(cx + R));
  const y0 = max(0, floor(cy - R));
  const y1 = min(H - 1, ceil(cy + R));
  const iq = 1 / (2 * sg * sg);
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const q = (dx * dx + dy * dy) * iq;
      if (q > 4.5) continue;
      const v = amp * (exp(-q) - 0.011);
      if (v <= 0) continue;
      const o = (y * W + x) * 3;
      acc[o] += v * col[0];
      acc[o + 1] += v * col[1];
      acc[o + 2] += v * col[2];
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const t = S.t;
  buildColours(S.hue);
  fillSky(S, t);
  stars(S, t);
  for (const tr of S.trains) if (tr.on) drawTrain(S, tr, t);

  const acc = S.acc;
  const sc = 0.4;
  let i = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = ENC[min(NLUT, (sqrt(acc[i] * sc) * NLUT) | 0)];
      const g = ENC[min(NLUT, (sqrt(acc[i + 1] * sc) * NLUT) | 0)];
      const b = ENC[min(NLUT, (sqrt(acc[i + 2] * sc) * NLUT) | 0)];
      display.setPixel(x, y, r, g, b);
      i += 3;
    }
  }
}
