// ===== Patternflow pattern =====
// Title:   Planetary Shells
// Family:  nebula
// Idea:    The gas a dying star has shed, seen the way the Hubble pictures show it: two limb-brightened lobes of teal doubly ionised oxygen pinched at a dark dust lane round a white-blue star, a thin red skin of hydrogen and nitrogen outside them, knots whose tails point away from the star, and fainter shells running out from the star through the old ones, all summed as light along each sight line while the whole shape precesses so the lobes tip toward and away from you.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: William Huggins's 1864 spectrum of NGC 6543 that showed a planetary nebula is glowing gas, Ira Bowen's 1927 identification of the green [O III] lines, the ionisation stratification of Bengt Strömgren (1939), the interacting stellar winds that blow a bubble and then an hourglass (Kwok, Purton and FitzGerald, 1978), and the Hubble pictures of the Cat's Eye, the Helix and the Egg; the line-of-sight integral of a thin emitting shell and Beer-Lambert absorption by dust, the way a volume ray marcher sums them; pattern round 209
// Round:   209
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Turn=0.2..3, Shape=-1..1, Knots=-1..1
//
// Knob 1: Hue. Turns the whole palette once round the colour wheel. At 0 the inner shell is the teal of [O III] over a deep blue interior, the outer skin is the red of H-alpha and [N II], and a thin violet fringe lies between; at 0.25 the rim is lavender and the skin olive, at 0.5 rose and cyan, at 0.75 amber and violet, and 1 is back to teal and red.
// Knob 2: Turn. How fast the nebula turns and ages. At the opening 2 the axis swings round its cone in 76 seconds and leans up to 28 degrees toward or away from you, the shells run out at 0.3 LEDs a second and a new one leaves the star every 12 to 38 seconds, and the gas turns about the axis once in 3.5 minutes. At 3 everything runs half as fast again; at 0.2 it crawls at a tenth. The pose the picture opens on is the one 78 seconds at the opening speed has reached.
// Knob 3: Shape. From a round bubble at -1, 46 LEDs across and 55 tall, through the opening 0 with a waist 29 LEDs across, to two lobes that meet at a waist 14 LEDs across at 1, a bipolar nebula 71 LEDs from tip to tip. The dust lane across the waist and the red of the skin grow with it, and the lane is faint at -1.
// Knob 4: Knots. How broken the gas is. At -1 the shells are mostly whole skins, with two knots and a faint interior; at the opening 0.06 the rims have gaps, about seventeen knots can stand and about eleven are lit at once, each with a tail 8 LEDs long; at 1 the rims break into short arcs, thirty-eight knots can stand, the tails reach 12 LEDs and the interior fills with rays of blue gas.

const W = 64;
const H = 128;
const { sin, cos, sqrt, exp, floor, max, min, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- tunables ----
const CX = 32; // where the star sits on the panel, in LEDs from the left
const CY = 64; // and from the top
const TIP = 31.5; // distance from the star to the tip of the inner shell, along the axis, at Shape 0
const XMIN = -12; // the shell coordinate x is the distance in LEDs outward from the inner shell
const XMAX = 13; // nothing glows beyond this
const BOUND = 14; // how far past the inner shell the bounding ellipsoid reaches
const NL = 256; // bins of the emission table over [XMIN, XMAX]
const IDX = NL / (XMAX - XMIN);
const DZ = 2.4; // step of the ray along the line of sight, in LEDs
const NM = 512; // bins of the shape table over |cos| of the polar angle
const PRE = 78; // seconds of turning already played when the picture opens
const AGE0 = -80; // the first shell left the star this long before the picture opens
const RING_AGE = 60; // a shell older than this has faded out
const BEND = 0.006; // how far the lobes lean sideways: LEDs per LED squared of height
const NK = 40; // knots that can stand at once
// strengths of each part, as light per LED of path
const G_TEAL = 0.042;
const G_HAZE = 0.0022;
const G_EDGE = 0.05;
const G_MAG = 0.0015;
const G_SKIN = 0.013;
const G_PLAT = 0.0003;
const G_RING = 0.024;
const G_KNOT = 0.85;
const G_STAR = 0.7;
const G_WAIST = 0.035;
const G_SKYSTAR = 0.1;
const BLACK = 0.012; // light below this is left off the panel
const GAP_LO = 0.42; // the outer gas shows where the second noise is above this, over a span of 1 / GAP_K
const GAP_K = 6;
const FACE = 0.07; // how bright a shell is where its face turns straight to you, against its rim
const IN_ONLY = -11.5; // deeper inside than this only the faint gas glows
const OUT_FROM = 5.5; // farther out than this the fibre and clump patterns are not read
const RIM = 10; // how narrow the bright rim is: the weight falls as exp(-RIM * cos^2) of the angle to the sight line

// ---- colour ----
// OKLab, to turn a colour round the wheel without changing how light it is
function toLab(c, o) {
  const l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]);
  const m = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]);
  const s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]);
  o[0] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  o[1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  o[2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
}
function fromLab(L, a, b, o) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  o[0] = max(0, 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  o[1] = max(0, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  o[2] = max(0, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
}
const LAB = [0, 0, 0];
function turned(c, turns, o) {
  toLab(c, LAB);
  const h = turns * TAU;
  const ca = cos(h);
  const sa = sin(h);
  fromLab(LAB[0], LAB[1] * ca - LAB[2] * sa, LAB[1] * sa + LAB[2] * ca, o);
}

// the emission lines, as linear light that adds
const C_TEAL = [0.012, 0.62, 0.42]; // [O III] 500.7 nm
const C_RED = [0.86, 0.045, 0.06]; // H-alpha 656.3 nm
const C_NII = [0.5, 0.02, 0.045]; // [N II] 658.3 nm, the deeper red
const C_VIOLET = [0.22, 0.05, 0.62]; // He II and H-beta, the blue end
const C_MAGENTA = [0.62, 0.06, 0.5]; // where red meets violet
const C_STAR = [0.62, 0.78, 1.0]; // the central star
const C_KHEAD = [0.5, 0.95, 0.75]; // a knot's bright head
const NCOL = 7;

// how bright a shell is for the cosine-squared of the angle between its normal and the sight line
const LIMB = new Float64Array(257);
for (let i = 0; i <= 256; i++) LIMB[i] = FACE + (1 - FACE) * exp((-RIM * i) / 256);

// encode: linear light, soft knee above 0.6, then 1/2.2
const NLUT = 2048;
const ENC = new Uint8Array(NLUT + 1);
for (let i = 0; i <= NLUT; i++) {
  const x = (i / NLUT) * 2.5;
  const y = x < 0.6 ? x : 0.6 + 0.4 * (1 - exp(-(x - 0.6) / 0.4));
  ENC[i] = Math.round(255 * Math.pow(y, 0.45));
}

// ---- hash and noise ----
function hash01(i) {
  let h = Math.imul(i | 0, 0x27d4eb2d) ^ 0x165667b1;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// Two channels of value noise on a wrapped lattice, blended smoothly once at setup into a fine
// table of bytes. The ray march then reads the table with one lookup per channel.
const NT = 64; // table cells a side; 8 to a lattice unit, so the table repeats every 8 units
const NTM = NT - 1;
const NTAB = new Uint8Array(NT * NT * NT * 2);
(function buildNoise() {
  const L = 8;
  const lat = new Float64Array(L * L * L * 2);
  for (let i = 0; i < lat.length; i++) lat[i] = hash01(i * 7 + 13);
  const at = (x, y, z, c) => lat[((((z & (L - 1)) * L + (y & (L - 1))) * L + (x & (L - 1))) << 1) + c];
  for (let c = 0; c < 2; c++) {
    for (let k = 0; k < NT; k++) {
      for (let j = 0; j < NT; j++) {
        for (let i = 0; i < NT; i++) {
          const sx = (i + 0.5) / 8;
          const sy = (j + 0.5) / 8;
          const sz = (k + 0.5) / 8;
          const x0 = floor(sx);
          const y0 = floor(sy);
          const z0 = floor(sz);
          let fx = sx - x0;
          let fy = sy - y0;
          let fz = sz - z0;
          fx = fx * fx * (3 - 2 * fx);
          fy = fy * fy * (3 - 2 * fy);
          fz = fz * fz * (3 - 2 * fz);
          const a = at(x0, y0, z0, c) + (at(x0 + 1, y0, z0, c) - at(x0, y0, z0, c)) * fx;
          const b = at(x0, y0 + 1, z0, c) + (at(x0 + 1, y0 + 1, z0, c) - at(x0, y0 + 1, z0, c)) * fx;
          const cc = at(x0, y0, z0 + 1, c) + (at(x0 + 1, y0, z0 + 1, c) - at(x0, y0, z0 + 1, c)) * fx;
          const d = at(x0, y0 + 1, z0 + 1, c) + (at(x0 + 1, y0 + 1, z0 + 1, c) - at(x0, y0 + 1, z0 + 1, c)) * fx;
          const e = a + (b - a) * fy;
          const f = cc + (d - cc) * fy;
          NTAB[(((k * NT + j) * NT + i) << 1) + c] = Math.round(255 * (e + (f - e) * fz));
        }
      }
    }
  }
})();

// faint stars far behind the nebula, each a soft 2 to 3 LED glow, kept off the nebula's own place
const NS = 16;
const STAR_X = new Float64Array(NS);
const STAR_Y = new Float64Array(NS);
(function placeStars() {
  let n = 0;
  for (let i = 0; n < NS && i < 400; i++) {
    const x = 1.5 + 61 * hash01(i * 4 + 91);
    const y = 2 + 124 * hash01(i * 4 + 92);
    const ex = (x - CX) / 28;
    const ey = (y - CY) / 48;
    if (ex * ex + ey * ey < 1.25) continue;
    let ok = true;
    for (let k = 0; k < n; k++) if ((STAR_X[k] - x) * (STAR_X[k] - x) + (STAR_Y[k] - y) * (STAR_Y[k] - y) < 100) ok = false;
    if (!ok) continue;
    STAR_X[n] = x;
    STAR_Y[n] = y;
    n++;
  }
})();

// ---- state ----
export function setup(params) {
  params.s = {
    ph: 0, // the turn clock, seconds at the opening speed
    rate: 1,
    hue: 0,
    shape: 0,
    clump: 0.53,
    first: true,
    // the axis and the frame turned about it
    ax: 0,
    ay: 1,
    az: 0,
    e1: new Float64Array(3),
    e2: new Float64Array(3),
    // the shape of the inner shell
    a: 18,
    waist: 15,
    tip: 29,
    bend: 0,
    wob: new Float64Array(4),
    scUp: 1,
    scDn: 1,
    RL: new Float64Array(NM),
    CL: new Float64Array(NM),
    TC: new Float64Array(NM),
    // the emission along the shell coordinate: two sets of RGB (inner and outer gas)
    LA: new Float64Array(NL * 3),
    LB: new Float64Array(NL * 3),
    LH: new Float64Array(NL * 3),
    col: new Float64Array(NCOL * 3),
    kb: new Float64Array(W * H * 3),
    tmp: [0, 0, 0],
    rings: [],
    nextRing: 0,
    ringIdx: 0,
    bal: 1,
    noff: [0, 0, 0],
    dust: 1,
  };
}

function gapOf(j) {
  // the seconds between one shell leaving the star and the next: 12 to 38, never the same twice
  const h = hash01(j * 3 + 1);
  return 12 + 26 * h * h;
}

function advanceRings(S) {
  // shells leave the star at times that come from a hash of their number
  while (S.nextRing <= S.ph) {
    const j = S.ringIdx;
    S.rings.push({ tb: S.nextRing, amp: 0.55 + 0.9 * hash01(j * 5 + 2), sig: 1.6 + 0.5 * hash01(j * 5 + 4) });
    S.ringIdx = j + 1;
    S.nextRing += gapOf(j + 1);
  }
  while (S.rings.length && S.ph - S.rings[0].tb > RING_AGE) S.rings.shift();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const d = cl(dt || 0, 0, 0.1);
  const kn = input.knobValues || [0, 2, 0, 0.06];
  const hue = cl(kn[0], 0, 1);
  const rate = cl(kn[1], 0.2, 3) / 2;
  const shape = cl(kn[2], -1, 1);
  const clump = 0.5 + 0.5 * cl(kn[3], -1, 1);
  if (S.first) {
    S.first = false;
    S.hue = hue;
    S.rate = rate;
    S.shape = shape;
    S.clump = clump;
    S.ph = PRE * rate;
    S.nextRing = AGE0;
    S.ringIdx = 0;
    advanceRings(S);
  } else {
    const k = 1 - exp(-d / 0.5);
    S.rate += (rate - S.rate) * k;
    S.shape += (shape - S.shape) * k;
    S.clump += (clump - S.clump) * k;
    S.hue = hue;
    S.ph += d * S.rate;
    advanceRings(S);
  }
  pose(S);
  buildShape(S);
  buildLut(S);
  renderKnots(S);
}

// the axis, the frame about it, and the slow drifts
function pose(S) {
  const t = S.ph;
  // the axis swings round a cone and nods; its sideways and toward-you parts have periods that do not divide
  let x = 0.28 + 0.32 * sin(0.0831 * t + 0.7) + 0.13 * sin(0.0377 * t + 2.1);
  let z = 0.1 + 0.3 * cos(0.0831 * t + 0.7) + 0.16 * sin(0.0307 * t + 4.0);
  let y = 1;
  const n = 1 / sqrt(x * x + y * y + z * z);
  x *= n;
  y *= n;
  z *= n;
  S.ax = x;
  S.ay = y;
  S.az = z;
  // a first direction at right angles to the axis, then turned about it
  let px = 1 - x * x;
  let py = -x * y;
  let pz = -x * z;
  const pn = 1 / sqrt(px * px + py * py + pz * pz);
  px *= pn;
  py *= pn;
  pz *= pn;
  const qx = y * pz - z * py;
  const qy = z * px - x * pz;
  const qz = x * py - y * px;
  const psi = 0.03 * t + 0.6 * sin(0.0173 * t + 0.4);
  const cp = cos(psi);
  const sp = sin(psi);
  S.e1[0] = cp * px + sp * qx;
  S.e1[1] = cp * py + sp * qy;
  S.e1[2] = cp * pz + sp * qz;
  S.e2[0] = -sp * px + cp * qx;
  S.e2[1] = -sp * py + cp * qy;
  S.e2[2] = -sp * pz + cp * qz;
  // slow drifts of the gas: its ionisation balance, the dust, the clump pattern
  S.bal = 0.5 + 0.5 * sin(0.0213 * t + 1.3);
  S.dust = 0.5 + 0.5 * sin(0.0151 * t + 0.2);
  S.noff[0] = 0.03 * t;
  S.noff[1] = 0.022 * t + 3.1;
  S.noff[2] = -0.017 * t + 7.7;
}

// the inner shell's outline: two ellipsoids end to end. R(|cos|) is the distance from the star
// to the shell, and CL the factor that turns a radial gap into a gap across the shell
function buildShape(S) {
  const t = S.ph;
  const sh = cl(S.shape + 0.07 * sin(0.0293 * t + 0.9) + 0.04 * sin(0.0677 * t), -1.05, 1.05);
  const q = sh < 0 ? 0.4 * (1 + sh) : 0.4 + 0.08 * sh;
  // a round bubble is wide and short; a bipolar nebula runs further along its axis and is narrower
  const tip = TIP + 4 * sh;
  const c = q * tip;
  const b = tip - c;
  const a = sh < 0 ? 16.5 - 6.5 * sh : 16.5 - 3 * sh;
  S.a = a;
  S.tip = tip;
  const eps = 0.14;
  const RL = S.RL;
  const CL = S.CL;
  const TC = S.TC;
  const ia2 = 1 / (a * a);
  const ib2 = 1 / (b * b);
  const Cq = c * c * ib2 - 1;
  const rr = (mu) => {
    const m = min(1, sqrt(mu * mu + eps * eps));
    const Aq = (1 - m * m) * ia2 + m * m * ib2;
    const Bq = m * c * ib2;
    return (Bq + sqrt(Bq * Bq - Aq * Cq)) / Aq;
  };
  for (let i = 0; i < NM; i++) {
    const mu = (i + 0.5) / NM;
    const r = rr(mu);
    RL[i] = r;
    const dr = (rr(min(1, mu + 0.004)) - rr(max(0, mu - 0.004))) / 0.008;
    const tb = (dr * sqrt(max(0, 1 - mu * mu))) / r;
    TC[i] = tb;
    CL[i] = max(0.55, 1 / sqrt(1 + tb * tb));
  }
  S.waist = RL[0];
  S.bend = BEND * (0.8 + 0.5 * sin(0.0221 * t + 2.0));
  const lean = 0.1 * sin(0.0319 * t + 0.5) + 0.05 * sin(0.0611 * t + 3.4);
  S.scUp = 1 + lean;
  S.scDn = 1 - lean;
  // the outline is never quite round: a slow lean, a squash and a shear, as a sum of low terms of the direction
  S.wob[0] = 0.07 * sin(0.0263 * t + 0.4) + 0.03 * sin(0.0711 * t + 1.9);
  S.wob[1] = 0.07 * sin(0.0347 * t + 2.8) + 0.03 * sin(0.0589 * t + 0.2);
  S.wob[2] = 0.09 * sin(0.0191 * t + 4.1) + 0.04 * sin(0.0523 * t + 2.5);
  S.wob[3] = 0.09 * sin(0.0229 * t + 5.3) + 0.04 * sin(0.0467 * t + 1.1);
}

// the emission along the shell coordinate
function buildLut(S) {
  const t = S.ph;
  const col = S.col;
  const tmp = S.tmp;
  const hue = S.hue;
  const set = (k, c) => {
    turned(c, hue, tmp);
    col[3 * k] = tmp[0];
    col[3 * k + 1] = tmp[1];
    col[3 * k + 2] = tmp[2];
  };
  // the inner gas gets stronger and the outer weaker as the balance swings, by a fifth each way
  const bal = 0.82 + 0.36 * S.bal;
  const skinK = 0.6 + 0.8 * (0.5 + 0.5 * cl(S.shape, -1, 1));
  set(0, C_TEAL);
  set(1, C_RED);
  set(2, C_NII);
  set(3, C_VIOLET);
  set(4, C_MAGENTA);
  set(5, C_STAR);
  set(6, C_KHEAD);
  const LA = S.LA;
  const LB = S.LB;
  const LH = S.LH;
  LA.fill(0);
  LB.fill(0);
  LH.fill(0);
  // the main shell breathes
  const br = 1 + 0.12 * sin(0.0471 * t + 0.3) + 0.07 * sin(0.1137 * t + 2.2);
  const skinAt = 7.8 + 1.2 * sin(0.0337 * t + 1.1) + 0.5 * sin(0.0919 * t);
  for (let i = 0; i < NL; i++) {
    const x = XMIN + (i + 0.5) / IDX;
    const tm = x >= 0 ? exp(-(x * x) / (1.8 * 1.8)) : 0.8 * exp(-(x * x) / (2.3 * 2.3)) + 0.2 * exp(x / 6);
    const hz = x < 0 ? sm(-12, -2, x) : exp(-(x * x) / (2.4 * 2.4));
    const mf = exp(-((x - 3.6) * (x - 3.6)) / (2.2 * 2.2));
    const sk = exp(-((x - skinAt) * (x - skinAt)) / (1.7 * 1.7));
    const pl = exp(-((x - 9) * (x - 9)) / (5 * 5));
    const aT = G_TEAL * bal * br * tm;
    const aE = G_EDGE * bal * br * exp(-((x - 0.4) * (x - 0.4)) / (1.5 * 1.5));
    const aV = G_HAZE * hz;
    const aM = G_MAG * mf;
    const bR = skinK * G_SKIN * (2 - bal) * sk + G_PLAT * pl;
    const o = i * 3;
    LA[o] = col[0] * aT + col[18] * aE + col[12] * aM;
    LA[o + 1] = col[1] * aT + col[19] * aE + col[13] * aM;
    LA[o + 2] = col[2] * aT + col[20] * aE + col[14] * aM;
    LB[o] = col[3] * bR;
    LB[o + 1] = col[4] * bR;
    LB[o + 2] = col[5] * bR;
    LH[o] = col[9] * aV + col[0] * aV * 0.25;
    LH[o + 1] = col[10] * aV + col[1] * aV * 0.25;
    LH[o + 2] = col[11] * aV + col[2] * aV * 0.25;
  }
  // older shells run out from the star, fastest first, and slow as they meet the old wind
  const rings = S.rings;
  for (let j = 0; j < rings.length; j++) {
    const R = rings[j];
    const age = t - R.tb;
    const xk = -12 + 0.32 * age;
    const fade = sm(-11, -4, xk) * (1 - sm(2.5, 6.5, xk)) * (1 - sm(RING_AGE - 10, RING_AGE, age));
    if (fade < 0.01) continue;
    const amp = G_RING * R.amp * fade;
    const sg = R.sig + 0.02 * max(0, xk);
    // the gas cools with distance: teal, then a violet pink
    const wT = 1 - 0.55 * sm(-8, 2, xk);
    const wV = 0.55 * sm(-8, 2, xk);
    const wM = 0;
    const wR = 0;
    const lo = max(0, floor((xk - 4 * sg - XMIN) * IDX));
    const hi = min(NL - 1, floor((xk + 4 * sg - XMIN) * IDX));
    for (let i = lo; i <= hi; i++) {
      const x = XMIN + (i + 0.5) / IDX;
      const g = amp * exp(-((x - xk) * (x - xk)) / (sg * sg));
      const o = i * 3;
      LA[o] += (col[0] * wT + col[9] * wV * 1.2 + col[12] * wM * 1.1) * g;
      LA[o + 1] += (col[1] * wT + col[10] * wV * 1.2 + col[13] * wM * 1.1) * g;
      LA[o + 2] += (col[2] * wT + col[11] * wV * 1.2 + col[14] * wM * 1.1) * g;
      LB[o] += col[3] * g * wR * 1.3;
      LB[o + 1] += col[4] * g * wR * 1.3;
      LB[o + 2] += col[5] * g * wR * 1.3;
    }
  }
}

// Knots: each is a bright head on the inner side and a tail pointing away from the star.
// They are drawn after the gas, as flat splats, from their places in the nebula's frame.
function renderKnots(S) {
  const kb = S.kb;
  kb.fill(0);
  const t = S.ph;
  for (let i = 0; i < NS; i++) {
    const sx = STAR_X[i];
    const sy = STAR_Y[i];
    const tw = 0.7 + 0.3 * sin(0.37 * t * (0.6 + 0.8 * hash01(i + 7)) + 6 * hash01(i + 3));
    const amp = G_SKYSTAR * (0.5 + hash01(i * 3 + 5)) * tw;
    const x0 = floor(sx) - 2;
    const y0 = floor(sy) - 2;
    for (let y = max(0, y0); y <= min(H - 1, y0 + 4); y++) {
      for (let x = max(0, x0); x <= min(W - 1, x0 + 4); x++) {
        const dx = x + 0.5 - sx;
        const dy = y + 0.5 - sy;
        const g = amp * exp(-(dx * dx + dy * dy) / 1.1);
        const o = (y * W + x) * 3;
        kb[o] += 0.8 * g;
        kb[o + 1] += 0.9 * g;
        kb[o + 2] += g;
      }
    }
  }
  const col = S.col;
  const e1x = S.e1[0];
  const e1y = S.e1[1];
  const e2x = S.e2[0];
  const e2y = S.e2[1];
  const axx = S.ax;
  const ayy = S.ay;
  const nAct = 2 + 36 * Math.pow(S.clump, 1.4);
  const RL = S.RL;
  const CL = S.CL;
  for (let i = 0; i < NK; i++) {
    const vis = cl(nAct - i, 0, 1);
    if (vis <= 0) continue;
    const per = 55 + 85 * hash01(i * 11 + 3);
    const xx = t / per + hash01(i * 11 + 5);
    const ep = floor(xx);
    const f = xx - ep;
    const env = sin(PI * f);
    const alpha = env * env * vis;
    if (alpha < 0.02) continue;
    const hb = ep * 37 + i * 101;
    let mu = -1 + 2 * hash01(hb + 1);
    mu = mu < 0 ? mu - 0.16 * (1 + mu) : mu + 0.16 * (1 - mu);
    mu = cl(mu, -0.999, 0.999);
    const ph = TAU * hash01(hb + 2);
    const xh = -1.5 + 9 * hash01(hb + 3) + 0.05 * f * per;
    const len = (4 + 8 * S.clump) * (0.6 + 0.7 * hash01(hb + 4));
    const gain = alpha * (0.65 + 0.7 * hash01(hb + 5));
    const sn = sqrt(1 - mu * mu);
    const nu = sn * cos(ph);
    const nv = sn * sin(ph);
    const nw = mu;
    const mi = (abs(mu) * (NM - 0.001)) | 0;
    const r = RL[mi] * (mu < 0 ? S.scDn : S.scUp) + xh / CL[mi];
    const hw = r * nw;
    const hu = r * nu + S.bend * hw * abs(hw);
    const hv = r * nv;
    const hx = hu * e1x + hv * e2x + hw * axx;
    const hy = hu * e1y + hv * e2y + hw * ayy;
    const tx = (nu * e1x + nv * e2x + nw * axx) * len;
    const ty = (nu * e1y + nv * e2y + nw * ayy) * len;
    const l2 = tx * tx + ty * ty;
    const px0 = CX + hx;
    const py0 = CY - hy;
    const x0 = max(0, floor(min(px0, px0 + tx) - 5));
    const x1 = min(W - 1, floor(max(px0, px0 + tx) + 5));
    const y0 = max(0, floor(min(py0, py0 - ty) - 5));
    const y1 = min(H - 1, floor(max(py0, py0 - ty) + 5));
    for (let y = y0; y <= y1; y++) {
      const dy = CY - (y + 0.5) - hy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - CX - hx;
        const d2 = dx * dx + dy * dy;
        let st = l2 > 1e-4 ? (dx * tx + dy * ty) / l2 : 0;
        st = st < 0 ? 0 : st > 1 ? 1 : st;
        const ex = dx - st * tx;
        const ey = dy - st * ty;
        const e2d = ex * ex + ey * ey;
        const wd = 0.9 + 0.3 * st;
        const head = exp(-d2 / (2 * 0.95 * 0.95));
        const tail = 0.6 * exp(-2.2 * st) * exp(-e2d / (2 * wd * wd)) * (1 - exp(-d2 / 1.5));
        const mix = sm(0, 0.45, st);
        const o = (y * W + x) * 3;
        const hh = head * gain * G_KNOT;
        const tt = tail * gain * G_KNOT;
        kb[o] += col[18] * hh * (1 - mix) + col[3] * (hh * mix + tt);
        kb[o + 1] += col[19] * hh * (1 - mix) + col[4] * (hh * mix + tt);
        kb[o + 2] += col[20] * hh * (1 - mix) + col[5] * (hh * mix + tt);
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const LA = S.LA;
  const LB = S.LB;
  const LH = S.LH;
  const RL = S.RL;
  const CL = S.CL;
  const TC = S.TC;
  const kb = S.kb;
  const e1x = S.e1[0];
  const e1y = S.e1[1];
  const e2x = S.e2[0];
  const e2y = S.e2[1];
  const e1z = S.e1[2];
  const e2z = S.e2[2];
  const axx = S.ax;
  const ayy = S.ay;
  const azz = S.az;
  const clump = S.clump;
  const pinch = 0.5 + 0.5 * cl(S.shape, -1, 1);
  const depth = 0.3 + 0.65 * Math.pow(clump, 0.9);
  const mainDepth = 0.35 + 0.5 * Math.pow(clump, 0.9);
  const hazeK = 0.15 + 3.6 * clump;
  // the more broken the gas, the higher the bar a pattern must clear to show
  const g0 = 0.36 + 0.12 * clump;
  const g1 = GAP_LO - 0.06 + 0.12 * clump;
  const star = S.col;
  const asym = 0.22 * sin(0.0397 * S.ph + 1.9);
  const bend = S.bend;
  const wb0 = S.wob[0];
  const wb1 = S.wob[1];
  const wb2 = S.wob[2];
  const wb3 = S.wob[3];
  const scUp = S.scUp;
  const scDn = S.scDn;
  const FREQ = 5.5;
  const KAP = 0.011;
  // noise coordinates are kept positive so that truncation cuts the table on a regular grid
  const ox8 = (S.noff[0] + 32) * 8;
  const oy8 = (S.noff[1] + 32) * 8;
  const oz8 = (S.noff[2] + 32) * 8;
  const bx8 = 0.8 * KAP * 8;
  const by8 = 0.55 * KAP * 8;
  const bz8 = 0.35 * KAP * 8;
  // the box the gas sits in: a bounding ellipsoid in the nebula's frame
  const La = S.a + BOUND;
  const Lb = S.tip + BOUND;
  const iLa = 1 / (La * La);
  const iLb = 1 / (Lb * Lb);
  const Aq = (e1z * e1z + e2z * e2z) * iLa + azz * azz * iLb;
  const dustOut = S.waist + 12;
  const dustOut2 = dustOut * dustOut;
  const ringAt = S.waist + 3;
  const ringK = G_WAIST * (0.3 + 1.4 * pinch);
  const dustIn = 11;
  const dustIn2 = dustIn * dustIn;
  const tauK = (0.45 + 0.2 * S.dust) * DZ * (0.5 + 1.5 * pinch * pinch);
  const sc = NLUT / 2.5;
  const dOff = (S.noff[0] * 0.5 + 40) * 2;

  let ko = 0;
  for (let y = 0; y < H; y++) {
    const Y = CY - (y + 0.5);
    for (let x = 0; x < W; x++) {
      const X = x + 0.5 - CX;
      const u0 = X * e1x + Y * e1y;
      const v0 = X * e2x + Y * e2y;
      const w0 = X * axx + Y * ayy;
      const Bq = 2 * ((u0 * e1z + v0 * e2z) * iLa + w0 * azz * iLb);
      const Cq = (u0 * u0 + v0 * v0) * iLa + w0 * w0 * iLb - 1;
      const disc = Bq * Bq - 4 * Aq * Cq;
      let cr = 0;
      let cg = 0;
      let cb = 0;
      if (disc > 0) {
        const sq = sqrt(disc);
        const z1 = (-Bq + sq) / (2 * Aq);
        const z0 = (-Bq - sq) / (2 * Aq);
        let z = z1;
        let u = u0 + z * e1z;
        let v = v0 + z * e2z;
        let w = w0 + z * azz;
        const du = -DZ * e1z;
        const dv = -DZ * e2z;
        const dw = -DZ * azz;
        let T = 1;
        let pxs = 1e9;
        for (; z >= z0; z -= DZ, u += du, v += dv, w += dw) {
          const aw = abs(w);
          // the two lobes lean opposite ways (a point-symmetric S) and differ a little in size
          const ub = u - bend * w * aw;
          const r2 = ub * ub + v * v + w * w;
          const r = sqrt(r2);
          const ir = 1 / (r + 1e-6);
          const mi = (aw * ir * (NM - 0.001)) | 0;
          const nu = ub * ir;
          const nv = v * ir;
          const wob = 1 + wb0 * nu + wb1 * nv + wb2 * (nu * nu - nv * nv) + wb3 * nu * nv;
          const xs = (r - RL[mi] * (w < 0 ? scDn : scUp) * wob) * CL[mi];
          // xs is a distance, so its slope along the ray is the shell's normal turned toward you
          const slope = (pxs - xs) * (1 / DZ);
          pxs = xs;
          // the dust lane: a flared disc round the waist, with a hole for the star
          if (aw < 8) {
            const rho2 = u * u + v * v;
            if (rho2 > dustIn2 && rho2 < dustOut2) {
              const rho = sqrt(rho2);
              const q = aw / (2.6 + 0.06 * rho);
              if (q < 2.6) {
                let ring = (rho - dustIn) * 0.12;
                const outer = (dustOut - rho) * 0.11;
                ring = ring > 1 ? 1 : ring;
                ring *= outer > 1 ? 1 : outer;
                const lump = NTAB[((((((w * 2 + dOff) | 0) & NTM) * NT + (((v * 2 + dOff * 0.7) | 0) & NTM)) * NT + (((u * 2 + dOff * 1.3) | 0) & NTM)) << 1) + 1] * (1 / 255);
                let tl = (lump - 0.25) * 2.2;
                tl = tl < 0 ? 0 : tl > 1 ? 1 : tl;
                const tau = tauK * ring * (0.15 + 1.5 * tl * tl * (3 - 2 * tl)) / (1 + q * q + 0.5 * q * q * q * q);
                T *= 1 / (1 + tau + 0.5 * tau * tau + tau * tau * tau * 0.1667);
              }
              // the bright ring of gas that the lane lies across, at the waist
              const tq = (rho - ringAt) * 0.31;
              if (tq > -1 && tq < 1 && aw < 4) {
                const bq = 1 - tq * tq;
                const bz = 1 - aw * aw * 0.0625;
                const em = ringK * bq * bq * bz * bz * T * DZ;
                cr += star[18] * em;
                cg += star[19] * em;
                cb += star[20] * em;
              }
            }
          }
          if (r2 < 150) {
            const sg = exp(-r2 / 3.4) * G_STAR + exp(-r2 / 18) * 0.008;
            cr += T * star[15] * sg;
            cg += T * star[16] * sg;
            cb += T * star[17] * sg;
          }
          if (xs < XMIN || xs >= XMAX) continue;
          const lo = 3 * (((xs - XMIN) * IDX) | 0);
          const f = FREQ * ir * 8;
          const mu = aw * ir;
          const mu2 = mu * mu;
          // the direction from the star, as noise space coordinates, plus a slow slide along the radius
          const ni = (((((w * f + oz8 + r * bz8) | 0) & NTM) * NT + (((v * f + oy8 + r * by8) | 0) & NTM)) * NT + (((ub * f + ox8 + r * bx8) | 0) & NTM)) << 1;
          let m0 = 0.5;
          let fib = 0.5;
          if (xs < OUT_FROM) {
            // a finer pattern for the fibres in the rim and the rays of faint gas inside
            const f2 = f * 2;
            let t2 = (NTAB[(((((w * f2 + oy8 * 1.7 + r * bz8 * 3) | 0) & NTM) * NT + (((v * f2 + oz8 * 1.3 + r * bx8 * 3) | 0) & NTM)) * NT + (((ub * f2 + ox8 * 0.7 + r * by8 * 3) | 0) & NTM)) << 1] * (1 / 255) - 0.25) * 2.2;
            t2 = t2 < 0 ? 0 : t2 > 1 ? 1 : t2;
            fib = t2 * t2 * (3 - 2 * t2);
            if (xs < IN_ONLY) {
              const hz = fib * fib * hazeK * T * DZ;
              cr += LH[lo] * hz;
              cg += LH[lo + 1] * hz;
              cb += LH[lo + 2] * hz;
              continue;
            }
            let t0 = (NTAB[ni] * (1 / 255) - g0) * 4;
            t0 = t0 < 0 ? 0 : t0 > 1 ? 1 : t0;
            m0 = t0 * t0 * (3 - 2 * t0);
          }
          // the outer gas is broken up on a second pattern, with sharper gaps
          let t1 = (NTAB[ni + 1] * (1 / 255) - g1) * GAP_K;
          t1 = t1 < 0 ? 0 : t1 > 1 ? 1 : t1;
          const m1 = t1 * t1 * (3 - 2 * t1);
          // a shell is thinnest and densest in its rim: where its face turns to you it counts for less
          const zr2 = slope * slope;
          const limb = LIMB[zr2 >= 1 ? 256 : (zr2 * 256) | 0];
          const rA = (1 - mainDepth + mainDepth * m0) * (0.5 + 0.9 * fib) * (1 + (w < 0 ? -asym : asym)) * limb;
          const rB = (1 - depth + depth * m1) * (0.5 + 0.9 * fib) * (0.6 + 0.9 * mu2) * limb;
          // the faint gas inside runs in rays from the star, as the fine pattern lets it
          const hz = fib * fib * hazeK;
          cr += T * (LA[lo] * rA + LB[lo] * rB + LH[lo] * hz) * DZ;
          cg += T * (LA[lo + 1] * rA + LB[lo + 1] * rB + LH[lo + 1] * hz) * DZ;
          cb += T * (LA[lo + 2] * rA + LB[lo + 2] * rB + LH[lo + 2] * hz) * DZ;
        }
      }
      cr += kb[ko];
      cg += kb[ko + 1];
      cb += kb[ko + 2];
      ko += 3;
      // a black level, a soft tone map that keeps the hue, then a little white where it is very bright
      cr = cr > BLACK ? cr - BLACK : 0;
      cg = cg > BLACK ? cg - BLACK : 0;
      cb = cb > BLACK ? cb - BLACK : 0;
      const m = max(cr, cg, cb);
      let r8 = 0;
      let g8 = 0;
      let b8 = 0;
      if (m > 1e-5) {
        const kn = m < 0.6 ? m : 0.6 + 0.4 * (1 - exp(-(m - 0.6) / 0.4));
        const k = kn / m;
        const wh = 0.35 * sm(0.55, 1.6, m) * kn;
        const rr = cr * k;
        const gg = cg * k;
        const bb = cb * k;
        r8 = ENC[min(NLUT, ((rr + (kn - rr) * wh) * sc) | 0)];
        g8 = ENC[min(NLUT, ((gg + (kn - gg) * wh) * sc) | 0)];
        b8 = ENC[min(NLUT, ((bb + (kn - bb) * wh) * sc) | 0)];
      }
      display.setPixel(x, y, r8, g8, b8);
    }
  }
}
