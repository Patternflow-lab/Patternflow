// ===== Patternflow pattern =====
// Title:   Bragg Painting
// Family:  protonbeam
// Idea:    A proton pencil beam enters at the top of the panel and stops in a sharp Bragg peak at a depth the machine picks, and layer by layer, deepest first, always at the spot where the moving, breathing target still lacks most dose, it paints a dose map into a smooth isodose colourwash that slowly washes out, so the picture never finishes and the beam keeps chasing the target.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Bragg peak (William Henry Bragg and Richard Kleeman, 1904 and 1905, for alpha particles, from memory), protons for therapy (Robert Wilson, 1946, from memory), the analytical depth-dose curve with range straggling (Thomas Bortfeld, 1997, from memory), pencil-beam scanning in energy layers and the spread-out Bragg peak (Eros Pedroni and colleagues at PSI, 1990s, from memory), original code, pattern round 274
// Round:   274
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=0.5..5, Spot=-1..1, Target=-1..1
//
// Knob 1: Hue. Turns the isodose ladder round the colour wheel, 0.8 of a circle over the range, and leaves the dark end indigo (nothing turns below a dose of 0.08, all of it above 0.55). At 0, the opening, the dose runs from indigo through blue, cyan, green and yellow to amber at the prescription and red-pink above it; at 0.25 the target is green in a violet halo, at 0.5 cyan ringed with magenta, at 0.75 blue in red, at 1 magenta with a yellow rim.
// Knob 2: Rate. How fast the beam delivers spots, 3 spots a second for each unit: 1.5 at 0.5, 6 at the opening 2, 15 at 5 (counted with the pauses, about 7 a second at the opening). A slow beam cannot keep up with the washout and the moving target, so the target is only half painted and the colourwash thin and patchy behind it; a fast one lays the dose down at once and the target is a smooth, hot blob.
// Knob 3: Spot. Range straggling and spot size together, 1.6 to the power of the knob: 0.625 at -1, 1 at 0, 1.6 at 1. The straggling sigma of the Bragg peak at a range of 80 LEDs is 0.84, 1.34 and 2.14 LEDs, so the peak is 3 rows wide at half height at -1, 5 at 0 and 7 at 1, and falls from 80 to 20 percent in 1, 2 and 3 rows. The spot at the peak is 2.5, 3.4 and 5.5 LEDs (sigma, never under 2.5), and the layers lie 2.3 straggling sigmas apart (never under 2 LEDs): 53 layers over the range at -1, 34 at 0, 22 at 1, so a sharp beam needs far more spots and the dose it leaves is grainier.
// Knob 4: Target. How big the target is and how deep it lies, from 62 percent of the size and 12 LEDs higher at -1 to 138 percent and 12 LEDs deeper at 1 (the opening 0.06 is 102 percent and 0.7 LEDs deeper). The main lobe is 12 by 10 LEDs (sigma) at 1, the two small lobes 7 by 6.5 and 5.5 by 5.
//
// What the picture is. Depth is the 128 rows, the beam enters at row 0, the 64 columns are the lateral position. The accumulated dose is a 64 by 128 field that each spot adds one kernel to and that fades with a half-life of 45 seconds, so it is never finished. The colour is that dose, read through a ladder the way a planning screen paints isodoses: indigo at a few percent, blue at 0.15, cyan at 0.4, green at 0.52, yellow at 0.78, amber at 1.0 (the prescription), red at 1.15 and pink from 1.35. A faint glow is added where the dose crosses 0.25, 0.5, 0.75 and 1.0 (found on the dose blurred over 3 by 3 LEDs, so a ripple between two layers draws none).
// The target. It is never drawn. The dose asked for is a field of three Gaussian lobes merged by a threshold: a big one that sways and breathes, and two small ones that orbit it at their own pace, joining and letting go. It is 1.1 times a level for each lobe (the main lobe 0.88 to 1, the others 0.62 to 0.98 and 0.42 to 0.82, drifting), 0 outside, with an edge of about 4 LEDs. The asked level is 1.1 because the greedy fit settles under what it is asked. The centre sways 9, 5 and 2.5 LEDs sideways (periods 76, 42 and 20 s) and 3.5, 2 and 1.5 LEDs in depth (94, 53 and 27 s) and breathes 3 to 4 LEDs in depth with a 4.05 s sine whose strength changes over 146 s. All the sines have their own phases and none of the periods divide.
// The Bragg peak. The dose one proton beam leaves at depth z when it stops at range R is Bortfeld's: (R - z)^(1/p - 1) plus a small linear term (R - z)^(1/p), p = 1.77, convolved with a Gaussian of range straggling sigma_R, which grows as R^0.935. The convolution is done once at load, as two tables (G1 and G2 in the code, by the substitution w = q^p that removes the singularity), and a spot looks its curve up. The curve is scaled to a peak of 1. It rises slowly over the plateau (0.09 of the peak at the entrance for R = 80 and Spot 1), climbs over the last 10 or so rows, peaks one sigma before R and falls to a 1.5 percent tail, a drawing choice, that fades over 9 LEDs. Exact: the form, p, the exponent 0.935. Drawn: the 0.1 in sigma_R = 0.1 (0.2 R)^0.935 Spot and the scale of a LED, the linear term's size (0.0028 per LED), the beam's lateral sigma, 1.2 LEDs at the entrance growing as (z / R)^2.6 to 1.5 + 0.024 R (times Spot) at the peak, and the whole curve raised to 1.5 so the plateau stands lower under the peak. The lateral profile is a Gaussian of height 1, not scaled to its area, so a wide spot is as bright as a narrow one, which a real beam is not.
// The spots. The machine owns a ladder of energy layers, one range for each, working from the deepest layer that can still put its peak in the target to the shallowest that reaches it. In a layer it tries every third column (from an offset that changes each time, so spots do not sit on a grid), and for each asks what weight w of the spot's whole kernel, plateau included, best fits what is still missing: w = the sum of k (asked - dose) over the cells the kernel covers, over the sum of k squared, with each cell weighted by how much it belongs to the target and a cell outside the target counting 0.6 as much (the lack in the target and the harm outside are one least-squares error). A spot whose peak sits outside the target, or whose plateau would pile onto cells already full, gets a small weight or none. The spot goes where the squared error falls most, a little discounted by the distance from the last one (3 percent a column), with a weight of at most 0.6. When no column of a layer asks for more than 0.05, or after 14 spots, the beam moves to the next shallower layer, and after the last returns to the deepest; a layer that asked for nothing is not asked again for 2 s. Dose that landed at the deeper layers already fills the rows above them, so the shallow layers get the small weights a real spread-out Bragg peak gives them. If no layer asks for anything the beam idles at a quarter of its brightness.
// The beam. While a spot delivers it is a bright line from row 0 to its peak: a core of sigma 1 LED (never less, so 2.4 LEDs wide at half height) that brightens along the dose curve, a halo as wide as the beam's own lateral spread, and a hot tip of about 2 by 2.2 LEDs at the peak. The dwell is longer for a heavier spot. Between spots the beam slews at half brightness, longer when the layer changes. A second field, the fresh dose, takes the kernel again weighted by the curve and fades in 0.45 s, a bloom that lights the dose where it was just put. Rates, pauses, slew and the look of the beam are drawing choices.
// The haze. Every part of the panel carries a faint violet-blue floor of 0.095 of a dose at the top to 0.175 at the bottom, with three plane waves of 0.025 on it, 48 to 55 LEDs long and 12 to 22 s round. It stands for the scattered dose and keeps every corner lit and moving. It is a drawing choice and not part of the physics above.
// Set-up. The pattern runs 32 seconds of itself with the opening knobs before the first frame, so it opens part-painted with the beam at work. A knob changes the rules from then on and the picture follows over the next seconds, not at once.

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
const sigP = (R, sp) => max(2.5, sp * (1.5 + 0.024 * R));
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
// the ladder at a hue turn, 0.8 of a circle over the knob. The turn is felt in full from a dose of 0.55 up and not at all below 0.08, so the
// dark end stays indigo, because a dark orange is a brown on the panel. The first call (turn 0) fixes the luma
// of every step and a turned ladder keeps it as far as it can, so yellow-green does not make a bright haze
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
    hsv(h + 0.8 * hue * sm(0.08, 0.55, d), sa, va, LUT, i * 3);
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
    t: 0, k: null, ph: Array.from({ length: 20 }, () => TAU * r()), s3: 1, sz: 1, zc: 76, rate: 6, dl: 3.1,
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
  const rx = 12 * sz * (1 + 0.12 * sin(0.11 * t + ph[4]) + 0.04 * br), rz = 10 * sz * (1 + 0.1 * sin(0.093 * t + ph[7]) + 0.07 * br);
  const th1 = 0.047 * t + ph[8] + 0.6 * sin(0.021 * t + ph[9]), d1 = 14 * sz * (1 + 0.22 * sin(0.071 * t + ph[10]));
  const th2 = -0.031 * t + ph[11] + 0.7 * sin(0.027 * t + ph[12]), d2 = 19 * sz * (1 + 0.2 * sin(0.053 * t + ph[13]));
  LA[0] = cx; LB[0] = cz; LRX[0] = rx; LRZ[0] = rz;
  LA[1] = cx + 1.35 * d1 * cos(th1); LB[1] = cz + 0.36 * d1 * sin(th1); LRX[1] = 7 * sz; LRZ[1] = 6.5 * sz;
  LA[2] = cx + 1.25 * d2 * cos(th2); LB[2] = cz + 0.32 * d2 * sin(th2); LRX[2] = 5.5 * sz; LRZ[2] = 5 * sz;
  // the dose asked of each lobe drifts too: the main one 0.88 to 1, the small ones 0.62 to 0.98 and 0.42 to 0.82
  LAMP[0] = 0.94 + 0.06 * sin(0.021 * t + ph[16]);
  LAMP[1] = 0.8 + 0.18 * sin(0.037 * t + ph[17]);
  LAMP[2] = 0.62 + 0.2 * sin(0.029 * t + ph[18]);
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
  if (amp <= 0) return;
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
    let bg = 0;
    bw = 0;
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
  S.le[L] = -9; // its dose is about to change
  return startSpot(S, L, bx, cl(bw, 0, WMAX), change);
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
      S.bon = 0.55;
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
      S.bon = sp.w > 0 ? 1 : 0.25;
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
  S.s3 = pow(1.6, cl(S.k[2], -1, 1));
  S.sz = 1 + 0.38 * cl(S.k[3], -1, 1);
  S.zc = 76 + 12 * cl(S.k[3], -1, 1);
  S.rate = 3 * cl(S.k[1], 0.5, 5);
  S.dl = max(2, 2.3 * sigR(80, S.s3));
}

// ---------------------------------------------------------------- drawing
const OUT = new Float32Array(WH * 3), TMP = new Float32Array(WH), DS = new Float32Array(WH);
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
  // the dose a little blurred, for the contour lines, so a one-LED ripple between two layers does not draw one
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      TMP[p] = x > 0 && x < W - 1 ? 0.25 * DOSE[p - 1] + 0.5 * DOSE[p] + 0.25 * DOSE[p + 1] : DOSE[p];
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      DS[p] = y > 0 && y < H - 1 ? 0.25 * TMP[p - W] + 0.5 * TMP[p] + 0.25 * TMP[p + W] : TMP[p];
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
        const ds = DS[p], gx = (DS[p + 1] - DS[p - 1]) * 0.5, gy = (DS[p + W] - DS[p - W]) * 0.5, gr = sqrt(gx * gx + gy * gy);
        const wd = 0.8 * gr + 0.012, ff = sm(0.012, 0.05, gr);
        let c = 0;
        for (let l = 0; l < 4; l++) {
          const e = (ds - WL[l]) / wd;
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
