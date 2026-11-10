// ===== Patternflow pattern =====
// Title:   Pilot Waves
// Family:  wave
// Idea:    Eight droplets walk on a bath that shakes just under its Faraday threshold, each one pushed down the slope of the standing ring pattern its own bounces keep laying and the others' wakes keep crossing, and the panel shows that wave field and never the droplets: cyan crests and magenta troughs on an ink ground, ribbons of fine interference arcs trailing each walker, running through each other and rubbing each other out, for as long as it runs.
// Author:  patternflow-lab
// Date:    2026-11-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Walking droplets on a vibrating bath (Yves Couder, Sebastien Protiere, Emmanuel Fort and Arezki Boudaoud, 2005, from memory), the Faraday ring pattern each bounce leaves and the path memory it gives the walker (Emmanuel Fort, Antonin Eddi, Arezki Boudaoud, Julien Moukhtar and Yves Couder, 2010, orbits in a turning bath; Antonin Eddi and others, 2011, information stored in Faraday waves; both from memory), the trajectory equation m x'' + D x' = -m g grad h with h a sum of J0(k_F r) rings fading as exp(-t / (T_F Me)) (Anand Oza, Rodolfo Rosales and John Bush, 2013, from memory), J0 from the Abramowitz and Stegun polynomial fits (1964, from memory), colour in OKLab (Bjorn Ottosson, 2020, from memory), pattern round 124
// Round:   126
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=1..3.5, Scale=-1..1, Memory=-1..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the OKLab hue of crest and trough together; the dark ground between them stays blue-grey at every setting. At 0 the crests are cyan (hue 205, pale at the top of the ramp) and the troughs magenta (340); at 0.3 lavender crests on orange troughs, at 0.5 salmon crests on green ones; a full turn comes back. Where a turn lands on orange or olive the dark steps of the ramp give up their chroma and come up in lightness, so those hues stay amber and gold and never turn to brown.
// Knob 2: Pace. A clock: Pace / 2 story seconds pass in each second, and the walkers' speed, drag, the memory time and the growth of a drop all go with it, so the same wanderings play faster or slower. A free walker's top speed is 3.8, 7.65 and 13.4 LEDs a second at Pace 1, 2 and 3.5 (at the opening wavelength); a ring is laid every 1/30 of a story second at most, so the track stays unbroken at every setting.
// Knob 3: Scale. The Faraday wavelength, which is the spacing of the rings: 6.5 LEDs at -1, 8.5 at the opening 0 and 16 at 1, so the panel is 9.8, 7.5 or 4 wavelengths wide. Walkers walk at 0.9 wavelengths a story second and the envelope of their rings is 1.6 wavelengths, so a lone walker's ribbon is about 8 stripes across at every setting, bright in the middle and fading out to the sides. A bath holds as many walkers as fit: 14 at -1, 8 at the opening and 6 at 1 (with Memory at its opening 0.06; 16 at -1 when Memory is also at -1).
// Knob 4: Memory. T_F Me, the time a bounce's rings take to fall to 1/e: 0.8 story seconds at -1, 3.65 at the opening 0.06 and 14 at 1. A walker's wake behind it is about its speed times that long: 5 LEDs at -1, where each walker is a few rings and a short tail and the rest of the bath is calm, 27 at the opening, and 105 at 1, longer than the panel is wide, where every place holds wakes of several walkers laid across each other. It changes the picture within 1 to 3 seconds because the field is made to decay at the new rate at once.

// What the field is. A bath shakes at just under the threshold where it would throw Faraday waves by itself, and droplets bounce on it.
// Each bounce leaves a standing ring pattern J0(k r), k = 2 pi / lambda, that fades with a time T (the knob called Memory), so the
// field is the sum over the recent path of every walker, and a walker is pushed down the slope of that field. In LED units, with
// d_i the drop's size (1 plus or minus 15 percent) and w_i how far it has grown in (0 to 1):
//   h(x, t)  = sum over walkers i and bounces s of  d_i w_i J0(k |x - x_i(s)|) E(|x - x_i(s)|) exp(-(t - s) / T)
//   x_i''    = -x_i' / tau - G d_i grad h(x_i),   then x_i' is turned by omega dt,   plus a small random push
// E(r) = exp(-(r / 1.6 lambda)^2) is the spatial decay a Faraday wave has in the real bath. G = v_max^2 / tau with a deposit of 1 a
// story second, so that a free walker at long memory goes at v_max = 0.9 lambda a story second; tau = 0.9. omega = 0.12 rad a story
// second is the turn of the bath in Fort and others (2010): every velocity rotates at that rate, so a walker's path curves in a
// circle of radius v / omega, 7.5 wavelengths at full speed, and the ribbons bend instead of running straight to the edge.
// The field is stamped, not solved. Each step of at most 1/30 story second the grid decays by exp(-ds / T) and every walker adds its
// ring from a table of J0 (the polynomial fit, 0.0625 LED apart) out to 2.5 envelope radii, never past 60 LEDs. The ring is added
// over every image of the panel it reaches, which is the minimal-image distance on the torus, and the field has no seam. The slope
// at a walker is the central difference of the four nearest cells, bilinear between them, divided by sin(k)/k. 8192 cells and 6 to
// 16 rings a step cost 0.6 to 1.9 ms a frame in node.
// Why an envelope. Plain J0 falls only as r^-1/2. A panel 7.5 wavelengths wide shows a walker its own rings coming round the other
// side, and the whole field settles into one standing pattern; with a minimal-image cut it also has a seam where the image flips.
// With E at 1.0 wavelength a walker's wake looked like a worm with a round head and the panel stayed dark between worms; at 3.0
// six walkers drew one lattice of crossing stripes over all of it. 1.6 gives ribbons that cross and show their crossings.
// How many walkers. A bath of one size holds as many as fit, so the count goes as the area a walker's rings cover, which goes with
// lambda squared and with the length of its wake: N = 9 (lambda / 8.5)^-2 (1 + 0.45 T_open) / (1 + 0.45 T), kept between 6 and 16. At
// all-minimum an early version had 8 walkers on 5.6 LED rings with a 0.55 s memory and the last quarter's quiet came out 0.094 (a
// 16 by 16 block that no walker passed for a minute); with 16 walkers on 6.5 LED rings it is QMIN. A drop comes in over 1.5 story seconds where the
// field is calmest of eight random tries, and goes out over the same, its rings fading after it.
// The picture. h divided by its rms (smoothed over 1.5 s, so Memory and Scale do not act as a brightness knob), tanh(0.7 x), a
// power of 1.15 on the faint end, and a ramp from trough to crest in OKLab: pale rose, magenta, plum, an ink ground (L 0.2, chroma
// 0.035), azure, cyan, pale aqua. Pale ends are reached only where wakes add to more than about 3 times the rms.

// What the checks showed, with the rotation and noise off unless said. Numbers at lambda 8.5.
// One bounce: the zero crossings of the stamped row are at 3.29, 7.49, 11.71 and 15.95 LEDs against j0,n / k = 3.25, 7.47, 11.71 and
// 15.95 (the row is read at whole LEDs and interpolated); the table is within 1.4e-6 of J0 from the integral.
// A free walker goes straight at the speed the force integral predicts. With F(v) = G k int J1(k v s) E(v s) exp(-s / T) ds, the
// walker settles where v / tau = F(v). Measured against predicted at T = 0.8, 1.42, 2.51, 3.65, 6.84 and 14 s: 6.57 / 6.60,
// 7.08 / 7.11, 7.32 / 7.36, 7.39 / 7.45, 7.45 / 7.55 and 7.49 / 7.60 LEDs a second, within 1.5 percent. Its heading changes by at most
// 9 degrees in 30 s at T = 0.8, and by 5 to 30 degrees at the longer memories, where it meets its own wake come round the torus.
// The walking threshold is where k v_max T = sqrt 2, T = 0.25 s at this wavelength, the same at any envelope. With the memory floor
// lowered to try it, a walker started at 0.3 v_max stops at 0.9 T_c (0.05 LEDs a second after 120 s) and walks at 1.1 T_c (2.65;
// the near-threshold branch gives 2.68). The knob's floor, 0.8 s, is 3.2 times it, so every setting walks.
// The memory: a held bouncer's standing height is deposit times T (3.662 against 3.647 at T = 3.65), and after it is taken away the
// fraction left at 0.5, 1, 2 and 3 T is 0.605, 0.366, 0.135 and 0.049 against exp(-x) 0.607, 0.368, 0.135 and 0.050.
// Two walkers with no rotation and T = 3.65: released 1.1 wavelengths apart they bind into a pair 1.34 +- 0.05 wavelengths apart that
// walks on together at 7.7 LEDs a second; released 1.6 apart, a pair 2.64 +- 0.11 apart. The mean field energy of the first stays
// between 0.77 and 1.24 of its mean for 300 s, of the second between 0.93 and 1.12. At T = 14 pairs do not bind and the field
// energy stays within 0.3 and 1.9 of its mean. A turning bath, one walker (the 2010 measurement): the radius it circles at, over the
// inertial radius v / omega, for inertial radii of 0.5 to 6 wavelengths is 1.12 +- 0.01 at T = 0.8 (the orbit follows the bath
// smoothly) and 0.99 +- 0.17 at T = 14, where the radius jumps between values and is not monotone in omega.
// On the torus. One or two walkers fall into a loop and come back to their own path (position autocorrelation 0.10 to 0.24 beyond 60 s);
// three or more do not (0.03 to 0.08 for three to six, and for eight at the opening 0.03). The floor is 6 anyway. Over 900 s, at six
// places across the knobs and two seeds, the walkers sit as a random set would: nearest-neighbour distance 0.98 to 1.04 of the random
// value, velocities as unaligned as chance (polarisation 0.20 to 0.39 against 0.25 to 0.41), and the worst walker spends 6.6 to 8.8
// percent of its time within 0.1 rad of an axis against 6.4 for a random heading, so nobody runs along an edge. Position
// autocorrelation (2 pi x / width) beyond 60 s stays under 0.06 at six places. The field's rms is the same in the first and last
// quarter of 900 s to within 5 percent.
// Noise. The velocity autocorrelation reaches 1/e at 8.0 to 8.5 s at the opening with the noise off, with the 0.05 it has, and at
// three times that; at Memory 1 at 4.0 to 4.5 s, 4.0 and 3.5 to 4.0. The turn of the bath alone would give 9.9 s; the wakes take
// that circle apart, which is why no revival shows.

const { floor, ceil, sqrt, sin, cos, exp, abs, min, max, PI, pow, log } = Math;
const W = 64, H = 128, NC = W * H;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- tunables. Lengths are LEDs, times are story seconds (Pace sets how many of them pass in a real second).
const NMAX = 18;                         // walker slots
const N_MIN = 6, N_MAX = 16, N_OPEN = 9; // walkers on the panel, at least, at most, and the count the opening wavelength and memory ask for
const LAM_MIN = 6.5, LAM_OPEN = 8.5, LAM_MAX = 16; // Faraday wavelength at Scale -1, 0 and 1, geometric between
const TM_MIN = 0.8, TM_OPEN = 3, TM_MAX = 14;      // memory time T_F Me at Memory -1 and 1 (geometric), and the one N_OPEN is counted at
const NU = 0.9;           // free walking speed at long memory, wavelengths per story second
const TAU_V = 0.9;        // drag time of a walker
const ENV = 1.6;          // radius of the envelope on one bounce's rings, wavelengths
const OMEGA = 0.12;       // the bath turns: every velocity rotates at this rate, rad per story second; inertial circle radius is v / OMEGA
const NOISE = 0.05;       // random push, wavelengths per story second per root story second
const DROP_SPREAD = 0.15; // drops differ in size by this fraction either way
const DT_MAX = 1 / 30;    // longest step of the walkers
const GROW = 1.5;         // a drop grows in, or shrinks away, over this long
const GAIN = 0.7;         // exposure: the rms of the field sits at this many units of tanh before the clip
const GAMMA = 1.15;       // above 1 darkens the faint tails of a wake
const KNOB = [0, 2, 0, 0.06];

// J0 from the Abramowitz and Stegun polynomial fits (9.4.1 and 9.4.3, from memory)
function j0(x) {
  x = abs(x);
  if (x <= 3) {
    const t = (x / 3) * (x / 3);
    return 1 + t * (-2.2499997 + t * (1.2656208 + t * (-0.3163866 + t * (0.0444479 + t * (-0.0039444 + t * 0.00021)))));
  }
  const u = 3 / x;
  const f = 0.79788456 + u * (-0.00000077 + u * (-0.0055274 + u * (-0.00009512 + u * (0.00137237 + u * (-0.00072805 + u * 0.00014476)))));
  const th = x - 0.78539816 + u * (-0.04166397 + u * (-0.00003954 + u * (0.00262573 + u * (-0.00054125 + u * (-0.00029333 + u * 0.00013558)))));
  return (f * cos(th)) / sqrt(x);
}

const DR = 0.0625;

function buildTable(S) {
  const k = (2 * PI) / S.lam, L = S.env * S.lam;
  const rc = 2.5 * L;
  S.rc = cl(rc, 8, 60);
  const n = ceil(S.rc / DR) + 3;
  const tab = S.tab.length >= n ? S.tab : (S.tab = new Float32Array(2048));
  for (let i = 0; i < n; i++) {
    const r = i * DR;
    const q = r / L;
    tab[i] = i * DR > S.rc ? 0 : j0(k * r) * exp(-q * q);
  }
  S.tabLam = S.lam;
}

function stamp(S, px, py, amp) {
  const h = S.h, tab = S.tab, rc = S.rc, ird = 1 / DR, rc2 = rc * rc;
  const y0 = ceil(py - rc), y1 = floor(py + rc);
  for (let iy = y0; iy <= y1; iy++) {
    const dy = iy - py, dy2 = dy * dy;
    if (dy2 >= rc2) continue;
    const half = sqrt(rc2 - dy2);
    const x0 = ceil(px - half), x1 = floor(px + half);
    const row = (iy & 127) * W;
    for (let ix = x0; ix <= x1; ix++) {
      const dx = ix - px;
      h[row + (ix & 63)] += amp * tab[(sqrt(dx * dx + dy2) * ird + 0.5) | 0];
    }
  }
}

const GR = [0, 0];
function gradient(S, px, py) {
  const h = S.h;
  const fx = floor(px), fy = floor(py), ax = px - fx, ay = py - fy;
  let gx = 0, gy = 0;
  for (let j = 0; j < 2; j++) {
    const wy = j ? ay : 1 - ay;
    const r0 = ((fy + j) & 127) * W, rm = ((fy + j - 1) & 127) * W, rp = ((fy + j + 1) & 127) * W;
    for (let i = 0; i < 2; i++) {
      const w = wy * (i ? ax : 1 - ax), xi = (fx + i) & 63;
      gx += w * (h[r0 + ((xi + 1) & 63)] - h[r0 + ((xi - 1) & 63)]);
      gy += w * (h[rp + xi] - h[rm + xi]);
    }
  }
  GR[0] = gx * 0.5;
  GR[1] = gy * 0.5;
}

function gauss() {
  let s = 0;
  for (let i = 0; i < 4; i++) s += Math.random();
  return (s - 2) * 1.7320508;
}

function newState() {
  const S = {
    h: new Float32Array(NC),
    tab: new Float32Array(2048), rc: 30, tabLam: -1,
    lam: LAM_OPEN, tm: TM_OPEN, pace: 1,
    px: new Float64Array(NMAX), py: new Float64Array(NMAX), vx: new Float64Array(NMAX), vy: new Float64Array(NMAX),
    dr: new Float64Array(NMAX), w: new Float64Array(NMAX), on: new Uint8Array(NMAX),
    rms: 0.3, lut: new Uint8Array(3 * 512), hueDone: -999,
    acc: 0, hold: -1, want: N_OPEN, noise: NOISE, env: ENV, rot: OMEGA,
  };
  return S;
}

function seedWalkers(S) {
  const nx = 3, ny = 6;
  for (let i = 0; i < NMAX; i++) {
    const c = (i * 7) % NMAX, cx = (c % nx) + 0.5, cy = floor(c / nx) + 0.5; // 7 and 18 share no factor, so the first few land all over the panel
    S.px[i] = ((cx + (Math.random() - 0.5) * 0.6) / nx) * W;
    S.py[i] = ((cy + (Math.random() - 0.5) * 0.6) / ny) * H;
    const a = Math.random() * 2 * PI;
    S.vx[i] = cos(a) * 0.5 * NU * S.lam;
    S.vy[i] = sin(a) * 0.5 * NU * S.lam;
    S.dr[i] = 1 + DROP_SPREAD * (2 * Math.random() - 1);
    S.on[i] = i < S.want ? 1 : 0;
    S.w[i] = S.on[i];
  }
}

// How many walkers the bath holds. A bath of fixed size holds as many as fit:
// the area a walker rings over goes with lambda squared, and with its wake,
// which goes with the memory.
function wanted(lam, tm) {
  const a = ((lam / LAM_OPEN) * (lam / LAM_OPEN) * (1 + 0.45 * tm)) / (1 + 0.45 * TM_OPEN);
  return cl(Math.round(N_OPEN / a), N_MIN, N_MAX);
}

// Drops come and go with the count: a new one lands where the wave field is
// calmest of eight tries, an old one shrinks away and its rings decay.
function crowd(S) {
  let have = 0;
  for (let i = 0; i < NMAX; i++) if (S.on[i]) have++;
  while (have < S.want) {
    let j = -1;
    for (let i = 0; i < NMAX; i++) if (!S.on[i] && S.w[i] < 0.02) { j = i; break; }
    if (j < 0) break;
    let bx = 0, by = 0, bq = 1e30;
    for (let c = 0; c < 8; c++) {
      const x = Math.random() * W, y = Math.random() * H;
      const q = abs(S.h[(floor(y) & 127) * W + (floor(x) & 63)]);
      if (q < bq) { bq = q; bx = x; by = y; }
    }
    const a = Math.random() * 2 * PI;
    S.px[j] = bx; S.py[j] = by;
    S.vx[j] = cos(a) * 0.5 * NU * S.lam; S.vy[j] = sin(a) * 0.5 * NU * S.lam;
    S.dr[j] = 1 + DROP_SPREAD * (2 * Math.random() - 1);
    S.on[j] = 1; S.w[j] = 0;
    have++;
  }
  while (have > S.want) {
    let j = -1;
    for (let i = NMAX - 1; i >= 0; i--) if (S.on[i]) { j = i; break; }
    if (j < 0) break;
    S.on[j] = 0;
    have--;
  }
}

// One step of story time ds. The walkers feel the slope of the wave field, then
// the field decays and every walker adds a ring to it where it now is.
function stepSim(S, ds) {
  const { px, py, vx, vy, dr } = S;
  const k = (2 * PI) / S.lam;
  // the central difference sees sin(k)/k of the true slope
  const corr = k / sin(min(k, 1.5));
  const vmax = NU * S.lam;
  const G = (vmax * vmax) / TAU_V; // force per unit of field slope for a walker of drop size 1: v_max^2 = tau_v G (deposit 1 per second)
  const sn = S.noise * S.lam * sqrt(ds);
  const damp = exp(-ds / TAU_V);
  const rc = cos(S.rot * ds), rs = sin(S.rot * ds);
  const gw = 1 - exp(-ds / GROW);
  for (let i = 0; i < NMAX; i++) {
    S.w[i] += (S.on[i] - S.w[i]) * gw;
    if (!S.on[i] && S.w[i] < 0.02) S.w[i] = 0;
    if (S.w[i] === 0) continue;
    gradient(S, px[i], py[i]);
    const a = -G * dr[i] * corr;
    vx[i] = vx[i] * damp + (1 - damp) * TAU_V * a * GR[0] + sn * gauss();
    vy[i] = vy[i] * damp + (1 - damp) * TAU_V * a * GR[1] + sn * gauss();
    if (rc !== 1) {
      const ux = vx[i];
      vx[i] = ux * rc - vy[i] * rs;
      vy[i] = ux * rs + vy[i] * rc;
    }
    const sp = sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
    if (sp > 2.5 * vmax) {
      vx[i] *= (2.5 * vmax) / sp;
      vy[i] *= (2.5 * vmax) / sp;
    }
    px[i] += vx[i] * ds;
    py[i] += vy[i] * ds;
    px[i] -= W * floor(px[i] / W);
    py[i] -= H * floor(py[i] / H);
  }
  const f = exp(-ds / S.tm), h = S.h;
  for (let i = 0; i < NC; i++) h[i] *= f;
  for (let i = 0; i < NMAX; i++) if (S.w[i] > 0) stamp(S, px[i], py[i], dr[i] * S.w[i] * ds);
}

function fieldRms(S) {
  const h = S.h;
  let ss = 0;
  for (let i = 0; i < NC; i++) ss += h[i] * h[i];
  return sqrt(ss / NC);
}

function targets(k) {
  return {
    pace: cl(k[1], 1, 3.5) / 2,
    lam: LAM_OPEN * pow(k[2] < 0 ? LAM_MIN / LAM_OPEN : LAM_MAX / LAM_OPEN, abs(cl(k[2], -1, 1))),
    tm: TM_MIN * pow(TM_MAX / TM_MIN, (cl(k[3], -1, 1) + 1) / 2),
  };
}

// ---- colour. OKLab ramp from trough to crest.
function lin(L, a, b, o) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  o[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  o[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  o[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const GAM = new Float32Array(4097);
for (let k = 0; k <= 4096; k++) {
  const x = k / 4096;
  GAM[k] = 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
}
const gam = (x) => GAM[x <= 0 ? 0 : x >= 1 ? 4096 : (x * 4096 + 0.5) | 0];
// t, lightness, chroma, hue in degrees: trough at 0, crest at 1
const STOPS = [
  [0.0, 0.88, 0.07, 335],
  [0.1, 0.68, 0.2, 342],
  [0.28, 0.44, 0.19, 335],
  [0.5, 0.2, 0.035, 280],
  [0.72, 0.46, 0.12, 225],
  [0.9, 0.78, 0.14, 205],
  [1.0, 0.96, 0.05, 190],
];
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const TMP = [0, 0, 0];
function buildLut(S, shift) {
  const lut = S.lut;
  for (let q = 0; q < 512; q++) {
    const t = q / 511;
    let n = 1;
    while (n < STOPS.length - 1 && STOPS[n][0] < t) n++;
    const A = STOPS[n - 1], B = STOPS[n], u = (t - A[0]) / (B[0] - A[0]), w = u * u * (3 - 2 * u);
    let L = A[1] + (B[1] - A[1]) * w, C = A[2] + (B[2] - A[2]) * w;
    // the dark middle keeps its own hue whatever Hue says, so the ground never turns brown or olive
    const hd = A[3] + (B[3] - A[3]) * w + shift * sm(0.04, 0.26, abs(t - 0.5)), h = (hd * PI) / 180;
    // dark orange and olive read as mud on the panel: for those hues the dark steps give up their chroma and come up in lightness
    let dh = (((hd - 75) % 360) + 360) % 360;
    if (dh > 180) dh -= 360;
    const warm = exp(-(dh * dh) / 4000);
    L += 0.28 * warm * (1 - sm(0.45, 0.8, L));
    C *= 1 - 0.8 * warm * (1 - sm(0.3, 0.62, L));
    for (let it = 0; it < 8; it++) {
      lin(L, C * cos(h), C * sin(h), TMP);
      if (TMP[0] >= -0.002 && TMP[1] >= -0.002 && TMP[2] >= -0.002 && TMP[0] <= 1.002 && TMP[1] <= 1.002 && TMP[2] <= 1.002) break;
      C *= 0.9;
    }
    lin(L, C * cos(h), C * sin(h), TMP);
    lut[3 * q] = gam(TMP[0]);
    lut[3 * q + 1] = gam(TMP[1]);
    lut[3 * q + 2] = gam(TMP[2]);
  }
  S.hueDone = shift;
}

export function setup(params, knobValues) {
  const S = (params.s = newState());
  const tg = targets(knobValues || KNOB);
  S.pace = tg.pace;
  S.lam = tg.lam;
  S.tm = tg.tm;
  S.want = wanted(S.lam, S.tm);
  buildTable(S);
  buildLut(S, 0);
  seedWalkers(S);
  // Before the first frame, three and a bit memory times (24 to 48 story seconds) so that the wakes already stand.
  const n = ceil(cl(3.2 * S.tm, 24, 48) / DT_MAX);
  for (let i = 0; i < n; i++) stepSim(S, DT_MAX);
  S.rms = fieldRms(S);
}

export function update(dt, input, params) {
  const k = input.knobValues || KNOB;
  if (!params.s) setup(params, k);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  const hue = cl(k[0], 0, 1) * 360;
  if (abs(hue - S.hueDone) > 0.5) buildLut(S, hue);
  if (d <= 0) return;
  const tg = targets(k), f = 1 - exp(-4 * d);
  S.pace += (tg.pace - S.pace) * f;
  S.lam += (tg.lam - S.lam) * f;
  S.tm += (tg.tm - S.tm) * f;
  if (abs(S.lam - S.tabLam) > 0.02) buildTable(S);
  S.want = S.hold >= 0 ? S.hold : wanted(S.lam, S.tm);
  crowd(S);
  S.acc += d * S.pace;
  const n = max(0, ceil(S.acc / DT_MAX - 1e-6));
  if (n > 0) {
    const ds = S.acc / n;
    for (let i = 0; i < n; i++) stepSim(S, ds);
    S.acc = 0;
  }
  // Exposure follows the rms of the field, over 1.5 s. A field that went bad would stay dark, so it is cleared and the drops start over.
  const r = fieldRms(S);
  if (!(r < 1e4)) {
    S.h.fill(0);
    seedWalkers(S);
    return;
  }
  S.rms += (r - S.rms) * (1 - exp(-d / 1.5));
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const h = S.h, lut = S.lut, g = GAIN / max(1e-6, S.rms);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = h[y * W + x] * g;
      let t = Math.tanh(v);
      if (GAMMA !== 1) t = t < 0 ? -pow(-t, GAMMA) : pow(t, GAMMA);
      const q = ((0.5 + 0.5 * t) * 511 + 0.5) | 0;
      display.setPixel(x, y, lut[3 * q], lut[3 * q + 1], lut[3 * q + 2]);
    }
}
