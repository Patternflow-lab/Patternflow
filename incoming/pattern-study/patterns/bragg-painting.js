// ===== Patternflow pattern =====
// Title:   Bragg Painting
// Family:  protonbeam
// Idea:    A proton pencil beam enters at the top of the panel and stops in a sharp Bragg peak at a depth the machine chooses, and layer by layer, deepest first, spot by spot, wherever the dose a moving, breathing target still lacks is greatest, it paints the dose map into a smooth isodose colourwash that slowly washes out, so the picture never finishes and the beam keeps chasing the target.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Bragg peak (William Henry Bragg and Richard Kleeman, 1904, for alpha particles, from memory), protons for therapy (Robert Wilson, 1946, from memory), the analytical depth-dose curve with range straggling (Thomas Bortfeld, 1997, from memory), pencil-beam scanning in energy layers and the spread-out Bragg peak (Eros Pedroni, 1990s, from memory), original code, pattern round 274
// Round:   274
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=0.5..5, Spot=-1..1, Target=-1..1
//
// Knob 1: Hue. Turns the whole isodose palette round the colour wheel, one turn over the range. At 0 (the opening) the dose runs from indigo through blue, cyan, green and yellow to amber at the prescription and red-pink above it; at 0.5 the same ladder starts in yellow-green and ends in blue-violet.
// Knob 2: Rate. How fast the beam delivers spots, 3 spots a second for each unit of the knob: 1.5 at 0.5, 6 at the opening 2, 15 at 5. A slower beam cannot keep up with the washout and the moving target, so the colourwash goes patchy and cold behind the target; a fast one lays the dose down at once and the picture is a crisp, hot target.
// Knob 3: Spot. Range straggling and spot size together, 1.8 to the power of the knob: 0.56 at -1, 1 at 0, 1.8 at 1. The straggling sigma of the Bragg peak at a range of 80 LEDs is 0.75, 1.34 and 2.4 LEDs, so the peak is a thin bright seam at -1 and a fat soft band at 1, the lateral spot at the peak is 1.9, 3.4 and 6.1 LEDs (sigma), and the layers keep a spacing of 2.3 straggling sigmas (never under 2 LEDs), so the beam needs far more layers and spots when it is sharp.
// Knob 4: Target. How big the target is and how deep it lies, from a small blob 62 percent of the size, 12 LEDs higher at -1 to a large one 138 percent of the size, 12 LEDs deeper at 1. The target is three overlapping lobes that wander on their own slow sines, and it breathes about 3 LEDs in depth every 4 seconds.
//
// What the picture is. Depth is the 128 rows, the beam enters at row 0 and the lateral position is the 64 columns. The accumulated dose is a 64 by 128 field that each spot adds one kernel to, and that fades with a half-life of 55 seconds, so nothing is ever finished. The colour is that dose, mapped through a ladder of colours the way a treatment planning screen paints isodoses: indigo for a few percent, blue, cyan, green, yellow, amber at the prescription (1.0) and red-pink above it. There are two fixed isodose lines in the ladder's bright glow, drawn as a soft brightening where the dose crosses 0.25, 0.5, 0.75 and 1.0.
// The target. The prescription is a field of three Gaussian lobes, a big one that sways and breathes and two small ones that orbit it at their own pace, so the region merges, pinches and lets lobes go. It is never drawn. It exists only as the dose the beam is told to aim at: 1.0 inside, 0 outside with an edge of about 4 LEDs. Its centre sits in the lower middle of the panel and drifts about 12 LEDs sideways and 8 in depth on sines of 75, 42, 94 and 53 seconds and the like, and breathes with a 4.05 s sine whose strength slowly changes.
// The Bragg peak. The dose a single proton beam leaves at depth z when it stops at range R is the one Bortfeld wrote down: (R - z)^(1/p - 1) plus a small linear term, p = 1.77, convolved with a Gaussian of range straggling sigma_R, which is proportional to R^0.935. The convolution is done once, at load, as two tables (G1 and G2 in the code) and a spot looks its curve up. It rises slowly over the plateau, climbs steeply over the last 10 LEDs, peaks about one sigma before R and falls to the tail, a 1.5 percent shelf that fades over 9 LEDs, within two or three rows. The curve is scaled so its peak is 1. The exponent 0.935 and p are Bortfeld's, the 0.1 coefficient of sigma_R, the 1.2 LED beam sigma at the entrance and its growth to 1.5 + 0.024 R (times Spot) at the peak by (z / R)^2.6 are drawing choices. The lateral profile is a unit Gaussian of that sigma, not normalised to its area, so a spot is as bright where it is wide as where it is narrow, which a real beam is not.
// The spots. The machine owns a ladder of energy layers, ranges 16 to 120 LEDs apart by 2.3 straggling sigmas. It works from the deepest layer to the shallowest. In a layer it looks at every second column and for each asks how much the spot's kernel, weighted by the Bragg peak's rows and the spot's lateral Gaussian, would reduce the squared deficit, deficit being max(0, prescription - dose) over the 6 to 14 rows around the peak. The spot goes where that gain is greatest, a little discounted by the distance from the last spot, and its weight is the least-squares amplitude, never over 0.6 of the prescription. When no column of a layer needs more than 0.05, or after 14 spots, the beam moves to the next shallower layer and, after the last, goes back to the deepest. Dose that landed at the deeper layers has already filled the rows above them, so the shallow layers get the small weights a real spread-out Bragg peak gives them. If no layer needs anything it fires the least needy spot anyway, so the beam is never idle. Dwell is longer for a heavier spot; the time between spots, the slew and the layer change are drawing choices.
// The beam. While a spot delivers it is a bright line from row 0 to its peak, a core of sigma 1 LED that gets brighter along the curve of the dose and a halo as wide as the beam's own lateral spread, ending in a hot tip about 2 by 2.2 LEDs. Between spots the beam is off and drawn at a fifth of that. A second field, the fresh dose, takes a squared copy of each kernel and fades in 0.45 s, a bloom that trails the beam and lights the dose where it was just put.
// The haze. A slow mix of three plane waves, 40 to 110 LEDs long, each at its own pace, adds 0.01 to 0.1 of a dose everywhere, a low violet haze that stands for the scattered dose. It keeps every corner lit and every part of the panel moving. It is a drawing choice and not part of the physics above.
// What is exact and what is drawn. The shape of the depth-dose curve and the growth of the straggling with range are physics. The beam's lateral growth, the layer rules, the greedy choice and the washout are an honest, simplified planning loop. The colours, the haze, the glow, the beam rate and the beam's own picture are drawing choices. The pattern runs 40 seconds of itself, with the opening knobs, before the first frame, so it opens already painted.

const W = 64, H = 128, WH = W * H;
const { floor, ceil, sqrt, exp, sin, cos, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// ---------------------------------------------------------------- Bragg curve tables
// Bortfeld: D(z) ~ (R - z)^(a - 1) + c (R - z)^a, a = 1 / p, convolved with a Gaussian of sigma.
// With s = (R - z) / sigma the convolution reduces to G1(s) and G2(s) (the substitution w = q^p
// removes the singularity of w^(a - 1)).
const PB = 1.77, AB = 1 / PB, CB = 0.0028;
const SMIN = -5, SSTEP = 1 / 16, SMAXT = 12, NS = ((SMAXT - SMIN) / SSTEP) | 0;
const T1 = new Float32Array(NS + 2), T2 = new Float32Array(NS + 2);
let G1MAX = 1, S1MAX = 1;
(function buildTables() {
  const phi = (x) => exp(-0.5 * x * x) / sqrt(TAU);
  const N = 240;
  for (let i = 0; i <= NS + 1; i++) {
    const s = SMIN + i * SSTEP, Q = pow(max(s, 0) + 7, AB);
    let a1 = 0, a2 = 0;
    for (let j = 0; j <= N; j++) {
      const q = (Q * j) / N, wq = j === 0 || j === N ? 1 : j % 2 ? 4 : 2, qp = pow(q, PB), f = phi(s - qp);
      a1 += wq * f;
      a2 += wq * qp * f;
    }
    T1[i] = (a1 * (Q / N / 3)) / AB;
    T2[i] = a2 * (Q / N / 3) * PB;
    if (T1[i] > G1MAX) {
      G1MAX = T1[i];
      S1MAX = s;
    }
  }
})();
function g12(s, out) {
  if (s >= SMAXT) {
    out[0] = pow(s, AB - 1);
    out[1] = pow(s, AB);
    return;
  }
  const f = (max(s, SMIN) - SMIN) / SSTEP, i = f | 0, u = f - i;
  out[0] = T1[i] + (T1[i + 1] - T1[i]) * u;
  out[1] = T2[i] + (T2[i + 1] - T2[i]) * u;
}
const GG = [0, 0];
// range straggling sigma and spot widths, in LEDs; sp is the Spot knob's scale
const sigR = (R, sp) => max(0.6, 0.1 * pow(0.2 * R, 0.935) * sp);
const sigP = (R, sp) => sp * (1.5 + 0.024 * R);
const sig0 = (sp) => 1.2 * pow(sp, 0.35);
const TAILH = 0.015, TAILL = 9, PEX = 1.5;
// the peak-normalised depth dose at row z for range R
let PNORM_S = -1, PNORM_R = -1, PNORM = 1;
function profAt(z, R, sR) {
  if (sR !== PNORM_S || R !== PNORM_R) {
    g12(S1MAX, GG);
    PNORM = pow(sR, AB - 1) * (G1MAX + CB * sR * GG[1]);
    PNORM_S = sR;
    PNORM_R = R;
  }
  g12((R - z) / sR, GG);
  const e = z - R;
  let d = (pow(sR, AB - 1) * GG[0] + CB * pow(sR, AB) * GG[1]) / PNORM;
  d = d > 0 ? pow(d, PEX) : 0;
  if (e > 0) d += TAILH * exp(-e / TAILL);
  return d;
}

// ---------------------------------------------------------------- colour ladder
// dose, hue (degrees, falling), saturation, value
const LD = [0, 0.06, 0.15, 0.28, 0.4, 0.52, 0.65, 0.78, 0.9, 1.02, 1.15, 1.35, 1.6];
const LH = [262, 256, 243, 223, 193, 160, 110, 68, 47, 29, 9, -22, -35];
const LS = [0.9, 0.88, 0.85, 0.9, 0.95, 0.9, 0.85, 0.9, 0.95, 0.95, 0.85, 0.7, 0.6];
const LV = [0.22, 0.38, 0.58, 0.8, 0.88, 0.85, 0.9, 0.97, 1, 1, 1, 1, 1];
const DMAX = 1.5, NL = 384;
const LUT = new Float32Array((NL + 1) * 3);
function hsv(h, s, v, o, k) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[k] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[k + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[k + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
const LREF = new Float32Array(NL + 1);
const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
// the ladder at a hue turn; the first call (turn 0) fixes the luma of every step, and a turned ladder keeps
// it as far as it can, so yellow-green does not make a bright haze where indigo made a dark one
function buildLut(hue, first) {
  let seg = 0;
  for (let i = 0; i <= NL; i++) {
    const d = (i / NL) * DMAX;
    while (seg < LD.length - 2 && d > LD[seg + 1]) seg++;
    const u = cl((d - LD[seg]) / (LD[seg + 1] - LD[seg]), 0, 1), us = u * u * (3 - 2 * u) * 0.5 + u * 0.5;
    const h = (LH[seg] + (LH[seg + 1] - LH[seg]) * us) / 360, sa = LS[seg] + (LS[seg + 1] - LS[seg]) * us, va = LV[seg] + (LV[seg + 1] - LV[seg]) * us;
    if (first) {
      hsv(h, sa, va, LUT, i * 3);
      LREF[i] = luma(LUT[i * 3], LUT[i * 3 + 1], LUT[i * 3 + 2]);
    }
    hsv(h + hue, sa, va, LUT, i * 3);
    const l = luma(LUT[i * 3], LUT[i * 3 + 1], LUT[i * 3 + 2]);
    let k = cl(pow(LREF[i] / max(l, 0.02), 0.8), 0.45, 1.6);
    const m = max(LUT[i * 3], LUT[i * 3 + 1], LUT[i * 3 + 2]) * k;
    if (m > 1) k /= m;
    LUT[i * 3] *= k;
    LUT[i * 3 + 1] *= k;
    LUT[i * 3 + 2] *= k;
  }
}

// ---------------------------------------------------------------- state
const RMAX = 120, RMIN = 16, WMAX = 0.6, WMIN = 0.05, NMAX = 14;
const KW = 48;                         // lateral kernel width in columns, kept per row
const DOSE = new Float32Array(WH), FRESH = new Float32Array(WH);
const KER = new Float32Array(H * KW);  // the current spot's lateral kernel, row by row
const KX0 = new Int16Array(H), KN = new Int16Array(H);
const PROF = new Float32Array(H);      // the current spot's depth dose
const HALF = 45;                       // washout half-life, seconds
const LA = new Float32Array(3), LB = new Float32Array(3), LC = new Float32Array(3), LE = new Float32Array(3); // lobe centre x, z and inverse squared radii
const LRX = new Float32Array(3), LRZ = new Float32Array(3);
const LUTK = [NaN], LREFSET = [0];

export function setup(params) {
  const r = () => Math.random();
  params.s = {
    t: 0, k: null, ph: Array.from({ length: 16 }, () => TAU * r()), s3: 1, sz: 1, zc: 76, rate: 6, dl: 3.1,
    nstep: 0, mstep: -1, lx: new Float32Array(64), lw: new Float32Array(64), lg: new Float32Array(64), le: new Float32Array(64).fill(-9), zlo: 0, zhi: 0, layer: 0, inLayer: 0, spot: null, bx: 32, bR: 60, bon: 0, px: 32, pR: 60, lastLayerChange: false,
    hazeph: Array.from({ length: 6 }, () => TAU * r()),
  };
  DOSE.fill(0);
  FRESH.fill(0);
  MM.fill(0);
  PD.fill(0);
}

function setLobes(S) {
  const t = S.t, ph = S.ph, sz = S.sz;
  const br = sin(1.55 * t + ph[5]), ba = 0.8 + 0.2 * sin(0.043 * t + ph[6]);
  const cx = 32 + 9 * sin(0.083 * t + ph[0]) + 5 * sin(0.151 * t + ph[1]) + 2.5 * sin(0.307 * t + ph[14]);
  const cz = S.zc + 3.5 * sin(0.067 * t + ph[2]) + 2 * sin(0.119 * t + ph[3]) + 1.5 * sin(0.233 * t + ph[15]) + 4 * ba * br;
  const rx = 13 * sz * (1 + 0.12 * sin(0.11 * t + ph[4]) + 0.04 * br), rz = 11 * sz * (1 + 0.1 * sin(0.093 * t + ph[7]) + 0.07 * br);
  const th1 = 0.047 * t + ph[8] + 0.6 * sin(0.021 * t + ph[9]), d1 = 17 * sz * (1 + 0.22 * sin(0.071 * t + ph[10]));
  const th2 = -0.031 * t + ph[11] + 0.7 * sin(0.027 * t + ph[12]), d2 = 23 * sz * (1 + 0.2 * sin(0.053 * t + ph[13]));
  LA[0] = cx; LB[0] = cz; LRX[0] = rx; LRZ[0] = rz;
  LA[1] = cx + 1.35 * d1 * cos(th1); LB[1] = cz + 0.36 * d1 * sin(th1); LRX[1] = 8 * sz; LRZ[1] = 7.5 * sz;
  LA[2] = cx + 1.25 * d2 * cos(th2); LB[2] = cz + 0.32 * d2 * sin(th2); LRX[2] = 6.5 * sz; LRZ[2] = 6 * sz;
  for (let i = 0; i < 3; i++) {
    LA[i] = cl(LA[i], 6, 58);
    LB[i] = cl(LB[i], 30, 112);
    LC[i] = 1 / (LRX[i] * LRX[i]);
    LE[i] = 1 / (LRZ[i] * LRZ[i]);
  }
}
// the prescription: 1 inside the main lobe, less in the small ones, 0 outside, an edge of about 4 LEDs.
// MM is how much a cell belongs to the target, PD the dose asked of it.
const MM = new Float32Array(WH), PD = new Float32Array(WH), CT = new Int16Array(W + 1); // CT: running count of the columns that hold target
const LAMP = [1, 0.8, 0.62], LOUT = 0.6, PSC = 1.1;
function ensureMask(S) {
  if (S.mstep === S.nstep) return;
  S.mstep = S.nstep;
  let zlo = H, zhi = 0;
  for (let i = 0; i < 3; i++) {
    zlo = min(zlo, LB[i] - 3.05 * LRZ[i]);
    zhi = max(zhi, LB[i] + 3.05 * LRZ[i]);
  }
  const nz0 = max(0, floor(zlo)), nz1 = min(H - 1, ceil(zhi));
  // rows that left the target's extent are cleared
  for (let z = min(S.zlo, nz0); z < nz0; z++) for (let x = 0; x < W; x++) { MM[z * W + x] = 0; PD[z * W + x] = 0; }
  for (let z = nz1 + 1; z <= max(S.zhi, nz1); z++) for (let x = 0; x < W; x++) { MM[z * W + x] = 0; PD[z * W + x] = 0; }
  S.zlo = nz0;
  S.zhi = nz1;
  for (let z = S.zlo; z <= S.zhi; z++) {
    for (let x = 0; x < W; x++) {
      let F = 0, Fa = 0;
      for (let i = 0; i < 3; i++) {
        const dx = x - LA[i], dz = z - LB[i], q = dx * dx * LC[i] + dz * dz * LE[i];
        if (q < 9.6) {
          const e = exp(-0.5 * q);
          F += e;
          Fa += e * LAMP[i];
        }
      }
      const m = F <= 0.42 ? 0 : F >= 0.62 ? 1 : sm(0.42, 0.62, F), p = z * W + x;
      MM[p] = m;
      PD[p] = m > 0 ? PSC * m * (Fa / F) : 0;
    }
  }
  for (let x = 0; x < W; x++) {
    let any = 0;
    for (let z = S.zlo; z <= S.zhi && !any; z++) if (MM[z * W + x] > 0.05) any = 1;
    CT[x + 1] = CT[x] + any;
  }
}

// the best spot of one layer: [x, weight, gain], or gain 0. The spot's whole kernel counts, plateau
// included: the weight is the least-squares amplitude of (prescription - dose) over the target cells
// the kernel covers, so a layer whose plateau would pile dose onto cells already full gets a small one.
const BEST = [0, 0, 0];
// what one layer looks like for the current Spot setting, worked out once and kept: its range, its depth dose, its lateral sigma
const LCACHE = [];
function layerData(S, L) {
  const key = Math.round(Math.log(S.s3) * 400);
  let c = LCACHE[L];
  if (c && c.key === key) return c;
  if (!c) c = LCACHE[L] = { key: 0, R: 0, sR: 0, sp: 0, s0: 0, zmax: 0, pr: new Float32Array(H), sx: new Float32Array(H), hw: new Int16Array(H), gk: new Float32Array(H * 40) };
  const R = RMAX - L * S.dl, sR = sigR(R, S.s3), sp = sigP(R, S.s3), s0 = sig0(S.s3), zmax = min(H - 1, floor(R + 3 * sR + 22));
  c.key = key; c.R = R; c.sR = sR; c.sp = sp; c.s0 = s0; c.zmax = zmax;
  for (let z = 0; z < H; z++) {
    const pr = z <= zmax ? profAt(z, R, sR) : 0;
    c.pr[z] = pr;
    if (pr < 0.02) {
      c.hw[z] = -1;
      continue;
    }
    const zz = z > R ? R : z, sx = sqrt(s0 * s0 + (sp * sp - s0 * s0) * pow(zz / R, 2.6));
    c.sx[z] = sx;
    c.hw[z] = min(39, ceil(2.6 * sx));
    for (let d = 0; d <= c.hw[z]; d++) c.gk[z * 40 + d] = exp(-0.5 * (d / sx) * (d / sx));
  }
  return c;
}
function evalLayer(S, L, xcur) {
  const c = layerData(S, L), R = c.R, pr = c.pr, hwr = c.hw, gk = c.gk;
  const z1 = min(H - 1, ceil(R + 0.9 * c.sR));
  BEST[0] = xcur; BEST[1] = 0; BEST[2] = 0;
  let bestScore = 0;
  const reach = ceil(2.2 * c.sp), x0 = (Math.random() * 3) | 0;
  for (let x = x0; x < W; x += 3) {
    // a spot that does not reach the target at all is never the best one
    if (CT[min(W, x + reach + 1)] - CT[max(0, x - reach)] <= 0) continue;
    let kd = 0, kk = 0;
    for (let z = 0; z <= z1; z++) {
      const hw = hwr[z];
      if (hw < 0) continue;
      const p = pr[z], base = z * W, go = z * 40;
      for (let xp = max(0, x - hw); xp <= min(W - 1, x + hw); xp++) {
        const m = MM[base + xp], om = m + LOUT * (1 - m);
        const k = p * gk[go + abs(xp - x)];
        kd += om * k * (PD[base + xp] - DOSE[base + xp]);
        kk += om * k * k;
      }
    }
    if (kk <= 0 || kd <= 0) continue;
    const w = kd / kk, gain = kd * w, score = gain / (1 + 0.03 * abs(x - xcur));
    if (score > bestScore) {
      bestScore = score;
      BEST[0] = x; BEST[1] = w; BEST[2] = gain;
    }
  }
}

// lay out the kernel of a new spot at lateral position x, layer L
function startSpot(S, L, x, w, change) {
  const c = layerData(S, L), R = c.R;
  const sps = {
    L, x, w, R, phase: 0,
    slew: (0.14 + (change ? 0.3 : 0)) / S.rate, dwell: (0.55 + 0.45 * min(1, w / WMAX)) * 0.8 / S.rate, left: 0, z1: c.zmax,
  };
  sps.left = sps.slew;
  for (let z = 0; z <= c.zmax; z++) {
    const pr = c.pr[z];
    PROF[z] = pr;
    if (c.hw[z] < 0 || pr < 0.004) {
      KN[z] = 0;
      continue;
    }
    const sx = c.sx[z], rr = 2.8 * sx;
    const x0 = max(0, floor(x - rr)), x1 = min(W - 1, ceil(x + rr));
    KX0[z] = x0;
    KN[z] = x1 - x0 + 1;
    for (let j = 0; j < KN[z]; j++) {
      const dx = (x0 + j - x) / sx;
      KER[z * KW + j] = exp(-0.5 * dx * dx);
    }
  }
  return sps;
}
function deposit(sps, f) {
  const amp = sps.w * f;
  for (let z = 0; z <= sps.z1; z++) {
    const n = KN[z];
    if (!n) continue;
    const a = amp * PROF[z], af = a * PROF[z], base = z * W + KX0[z], ko = z * KW;
    for (let j = 0; j < n; j++) {
      const kv = KER[ko + j];
      DOSE[base + j] += a * kv;
      FRESH[base + j] += af * kv;
    }
  }
}

function chooseSpot(S) {
  ensureMask(S);
  // the layers that matter: the deepest whose peak can still sit in the target, down to the shallowest that reaches it
  const sRm = sigR(0.5 * (S.zlo + S.zhi), S.s3);
  const Lmin = max(0, ceil((RMAX - (S.zhi + 1.2 * sRm)) / S.dl)), Lmax = max(Lmin, floor((RMAX - (S.zlo + 0.5 * sRm)) / S.dl));
  const nL = Lmax + 1;
  let L = S.layer, change = false;
  if (L < Lmin || L >= nL) L = Lmin;
  let found = false, bx = S.px, bw = 0;
  // a layer that needed nothing is not asked again for 2 s
  for (let tried = 0; tried <= nL - Lmin; tried++) {
    if (!(S.lw[L] < WMIN && S.t - S.le[L] < 2)) {
      evalLayer(S, L, S.px);
      S.lx[L] = BEST[0]; S.lw[L] = BEST[1]; S.lg[L] = BEST[2]; S.le[L] = S.t;
      if (BEST[1] >= WMIN && S.inLayer < NMAX) {
        found = true;
        bx = BEST[0]; bw = BEST[1];
        break;
      }
    }
    L = L + 1 >= nL ? Lmin : L + 1;
    S.inLayer = 0;
    change = true;
  }
  if (!found) {
    // nothing needs a spot above the floor: fire the most useful one anyway
    let bg = -1;
    for (let l = Lmin; l < nL; l++) {
      if (S.t - S.le[l] > 0.6) {
        evalLayer(S, l, S.px);
        S.lx[l] = BEST[0]; S.lw[l] = BEST[1]; S.lg[l] = BEST[2]; S.le[l] = S.t;
      }
      if (S.lg[l] > bg) {
        bg = S.lg[l]; L = l; bx = S.lx[l]; bw = S.lw[l];
      }
    }
    change = change || L !== S.layer;
  }
  if (L !== S.layer) change = true;
  S.layer = L;
  S.inLayer++;
  if (change) S.inLayer = 1;
  return startSpot(S, L, bx, cl(bw, 0.03, WMAX), change);
}

function step(S, dt) {
  S.t += dt;
  S.nstep++;
  setLobes(S);
  const dec = exp((-dt * 0.6931) / HALF), df = exp(-dt / 0.45);
  for (let i = 0; i < WH; i++) {
    DOSE[i] *= dec;
    FRESH[i] *= df;
  }
  let rem = dt, guard = 0;
  while (rem > 1e-6 && guard++ < 64) {
    if (!S.spot) {
      S.spot = chooseSpot(S);
      S.px = S.spot.x;
      S.pR = S.spot.R;
    }
    const sp = S.spot;
    const use = min(rem, sp.left);
    if (sp.phase === 0) {
      sp.left -= use;
      rem -= use;
      const u = 1 - sp.left / sp.slew;
      const e = u * u * (3 - 2 * u);
      S.bx = S.fx + (sp.x - S.fx) * e;
      S.bR = S.fR + (sp.R - S.fR) * e;
      S.bon = 0.3;
      if (sp.left <= 1e-6) {
        sp.phase = 1;
        sp.left = sp.dwell;
        S.bx = sp.x;
        S.bR = sp.R;
      }
    } else {
      deposit(sp, use / sp.dwell);
      sp.left -= use;
      rem -= use;
      S.bx = sp.x;
      S.bR = sp.R;
      S.bon = 1;
      if (sp.left <= 1e-6) {
        S.fx = sp.x;
        S.fR = sp.R;
        S.spot = null;
      }
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [kv[0], kv[1], kv[2], kv[3]];
    S.fx = 32;
    S.fR = 60;
    knobs(S);
    for (let i = 0; i < 400; i++) step(S, 0.08);
  }
  const al = 1 - exp(-d / 0.2);
  for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  knobs(S);
  if (d > 0) step(S, d);
}
function knobs(S) {
  S.s3 = pow(1.8, cl(S.k[2], -1, 1));
  S.sz = 1 + 0.38 * cl(S.k[3], -1, 1);
  S.zc = 76 + 12 * cl(S.k[3], -1, 1);
  S.rate = 3 * cl(S.k[1], 0.5, 5);
  S.dl = max(2, 2.3 * sigR(80, S.s3));
}

// ---------------------------------------------------------------- drawing
const OUT = new Float32Array(WH * 3);
const WL = [0.25, 0.5, 0.75, 1.0];
const HX = new Float32Array(W * 6), HY = new Float32Array(H * 6);
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.k) return;
  const hue = S.k[0];
  if (!LUTK.length || LUTK[0] !== hue) {
    if (!LREFSET[0]) {
      buildLut(0, true);
      LREFSET[0] = 1;
    }
    buildLut(hue, false);
    LUTK[0] = hue;
  }
  const t = S.t, hp = S.hazeph;
  // the haze: three plane waves, each split into column and row factors
  const HK = [[0.11, 0.045, 0.52], [-0.07, 0.09, -0.37], [0.05, -0.12, 0.29]];
  for (let w = 0; w < 3; w++) {
    const [kx, ky, om] = HK[w];
    for (let x = 0; x < W; x++) {
      HX[x * 6 + w * 2] = sin(kx * x + hp[w]);
      HX[x * 6 + w * 2 + 1] = cos(kx * x + hp[w]);
    }
    for (let y = 0; y < H; y++) {
      HY[y * 6 + w * 2] = sin(ky * y + om * t);
      HY[y * 6 + w * 2 + 1] = cos(ky * y + om * t);
    }
  }
  const sgrid = NL / DMAX;
  for (let y = 0; y < H; y++) {
    const hb = 0.095 + 0.08 * (y / 127) * (y / 127);
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let hz = hb;
      for (let w = 0; w < 6; w += 2) hz += 0.025 * (HX[x * 6 + w] * HY[y * 6 + w + 1] + HX[x * 6 + w + 1] * HY[y * 6 + w]);
      const dose = DOSE[p], d = dose + hz;
      const f = cl(d, 0, DMAX - 0.001) * sgrid, i = f | 0, u = f - i, o = i * 3;
      let r = LUT[o] + (LUT[o + 3] - LUT[o]) * u, g = LUT[o + 1] + (LUT[o + 4] - LUT[o + 1]) * u, b = LUT[o + 2] + (LUT[o + 5] - LUT[o + 2]) * u;
      // contour glow
      if (x > 0 && x < W - 1 && y > 0 && y < H - 1 && dose > 0.12) {
        const gx = (DOSE[p + 1] - DOSE[p - 1]) * 0.5, gy = (DOSE[p + W] - DOSE[p - W]) * 0.5, gr = sqrt(gx * gx + gy * gy);
        const wd = 0.8 * gr + 0.012, ff = sm(0.012, 0.05, gr);
        let c = 0;
        for (let l = 0; l < 4; l++) {
          const e = (dose - WL[l]) / wd;
          if (e < 2.5 && e > -2.5) c += exp(-e * e);
        }
        c *= ff * 0.55;
        r = r * (1 + c) + c * 0.3;
        g = g * (1 + c) + c * 0.3;
        b = b * (1 + c) + c * 0.3;
      }
      const fr = FRESH[p];
      if (fr > 0.005) {
        const k = min(1, fr) * 0.55;
        r += k * 0.8;
        g += k * 0.95;
        b += k;
      }
      OUT[p * 3] = r;
      OUT[p * 3 + 1] = g;
      OUT[p * 3 + 2] = b;
    }
  }
  // the beam
  const bx = S.bx, bR = S.bR, on = S.bon;
  if (on > 0.01) {
    const sR = sigR(bR, S.s3), sp = sigP(bR, S.s3), s0 = sig0(S.s3), zpk = bR - 1.0 * sR;
    const zmax = min(H - 1, floor(bR));
    for (let z = 0; z <= zmax; z++) {
      const pr = profAt(z, bR, sR), sx = sqrt(s0 * s0 + (sp * sp - s0 * s0) * pow(z / bR, 2.6)), sc = 1 + 0.08 * sx;
      const ac = on * (0.5 + 0.5 * pr) * 0.9, ah = on * (0.1 + 0.4 * pr) * 0.28;
      const x0 = max(0, floor(bx - 3 * sx)), x1 = min(W - 1, ceil(bx + 3 * sx));
      for (let x = x0; x <= x1; x++) {
        const dx = x - bx, a = ac * exp(-0.5 * dx * dx / (sc * sc)) + ah * exp(-0.5 * dx * dx / (sx * sx)), o = (z * W + x) * 3;
        OUT[o] += a * 0.85;
        OUT[o + 1] += a * 0.97;
        OUT[o + 2] += a;
      }
    }
    const tz0 = max(0, floor(zpk - 8)), tz1 = min(H - 1, ceil(zpk + 8)), tx0 = max(0, floor(bx - 9)), tx1 = min(W - 1, ceil(bx + 9));
    for (let z = tz0; z <= tz1; z++) {
      for (let x = tx0; x <= tx1; x++) {
        const dx = x - bx, dz = z - zpk;
        const a = on * (1.1 * exp(-0.5 * (dx * dx / 3.6 + dz * dz / 4.8)) + 0.35 * exp(-0.5 * (dx * dx + dz * dz) / 20)), o = (z * W + x) * 3;
        OUT[o] += a * 0.9;
        OUT[o + 1] += a;
        OUT[o + 2] += a;
      }
    }
  }
  for (let p = 0; p < WH; p++) {
    const o = p * 3;
    display.setPixel(p % W, (p / W) | 0, (cl(OUT[o], 0, 1) * 255) | 0, (cl(OUT[o + 1], 0, 1) * 255) | 0, (cl(OUT[o + 2], 0, 1) * 255) | 0);
  }
}
