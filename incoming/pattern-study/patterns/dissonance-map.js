// ===== Patternflow pattern =====
// Title:   Dissonance Map
// Family:  tuningtimbre
// Idea:    The panel is a map of how rough two notes sound together, the interval between them across and the stretch of their overtones up, so the consonant intervals are bright valleys that bend and split as the spectrum stretches, a bead rides one valley floor, and the whole relief drifts through its parameters without coming back.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Tonal consonance and critical bandwidth (Reinier Plomp and Willem Levelt, JASA 38, 1965); the dissonance of complex tones as a sum over pairs of partials and its dependence on timbre (William Sethares, JASA 94, 1993, and the book Tuning, Timbre, Spectrum, Scale, 1998); the curve constants b1 = 3.5, b2 = 5.75 and s = 0.24 / (0.021 fmin + 19) from memory, and the critical bandwidth formula of Zwicker used to check them from memory too; roughness as the beating of close partials (Hermann von Helmholtz, 1863), recalled; the map, its drift, the rank shading, the bead and the colour wash are original, pattern round 272
// Round:   272
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drift=0.5..4, Partials=-4..4, Register=-1..1
//
// Knob 1: Hue. Turns the colour of every pixel round the colour circle, one turn over the range, by rotating the palette's two chroma axes and leaving its brightness alone. At 0 the ridges are ink violet and the valley floors pale gold, with wine and ember between. At 0.25 the slopes are indigo and magenta over dark teal ridges, at 0.5 dark green with ice blue floors, at 0.75 brown ridges with lime floors, and at 1 it is the opening again. A slow wash of up to 0.1 turn either way crosses the panel on top, so no frame is a single hue.
// Knob 2: Drift. How fast everything drifts. The drift clock runs 4.5 times faster than the wall clock for each unit of the knob: 2.25 times at 0.5, 9 at the opening 2 and 18 at 4. At 2 the window of stretch swings up and down on a main beat of 17 s, which slides the octave valley up to 5 columns a second and the 3:2 valley up to 2; the register swells on 20 s and 8 s, the partial count on 13 s and 6 s, and each partial's level wanders on 5 to 14 s and its tuning on 6 to 16 s. At 0.5 every one of them takes four times as long.
// Knob 3: Partials. How many partials each tone has: 6 plus the knob, so 2 at -4, 6 at the opening 0 and 10 at 4, and a swell of 1.7 and 0.6 partials rides on top. The last partial enters at partial strength, so the count glides. At -4 only the unison and the octave have valleys and the map is two broad bands. At 4 a hundred partial pairs make a lace of thin curves.
// Knob 4: Register. The pitch of the lower tone, 400 Hz times 2.2 to the knob: 182 Hz at -1, 419 at the opening 0.06 and 880 at 1, with a swell of 0.64 to 1.55 times on top. A low note has a wide critical band, so the first partial's rough ridge stands 6.4 columns from the unison and the valleys are broad and shallow. A high note has a narrow one, the ridge stands 2.2 columns out, and the valleys thin to lines about 2 LEDs across.
//
// What the picture is. Two notes of one instrument sound together. Across, the ratio r of the upper pitch to the lower, from 0.95 at the left edge to 2.1 at the right over 64 columns, 0.018 a column: the unison r = 1 stands in column 2.8 and the octave of a harmonic spectrum, r = 2, in column 58.4. Up the panel, the stretch p of the instrument's overtones over 128 rows, larger at the top. The n-th partial of a tone lies at f0 n^p. At p = 1 the tone is harmonic; above 1 the overtones spread, as they do on the bars of a gamelan or the walls of a bell; below 1 they pack. Each pixel is the dissonance D(r, p) of the two tones, and bright is low. The valley floors are where a partial of one note meets a partial of the other, at r = i^p / j^p, so a consonant interval is a valley, and the valley moves when the timbre does. At the window's mean the 3:2 valley runs from column 24.4 at the bottom row (p = 0.81) to column 40 at the top (p = 1.27) and leaves the simple ratio the whole way, and the octave valley runs from column 45 at the bottom to the right edge a little above the middle (p = 1.07).
// The model. A tone has partials at f_i = f0 i^p with amplitudes a_i. The dissonance of two such tones is D = sum over i and j of a_i a_j d(|f_i - r f_j|), every partial of one tone against every partial of the other; the pairs inside one tone do not depend on r and are left out. The pair curve is d = exp(-b1 s df) - exp(-b2 s df), with b1 = 3.5, b2 = 5.75 and s = 0.24 / (0.021 fmin + 19), fmin the lower of the two frequencies. The constants are from memory, so the curve was checked: it is 0 at df = 0 and peaks at s df = ln(b2/b1) / (b2 - b1) = 0.2206 with height 0.1808, which at 125, 500 and 1000 Hz is a spacing of 19.9, 27.1 and 36.8 Hz, or 0.20, 0.23 and 0.23 of the critical bandwidth that Zwicker's formula gives there (101, 117 and 162 Hz, also from memory), about a quarter as Plomp and Levelt found. The amplitudes are a_i = alpha^(i-1) with alpha swelling between 0.79 and 0.97 round 0.88, the even partials cut by 0 to 60 percent, and each partial's level swelling by up to 60 percent on a rate of its own. Each partial's frequency also wanders 2.5 percent, and the upper tone is stretched 0.045 more or less than the lower, so the valleys do not only slide: they split and rejoin. Every column is the mean of four sample ratios, so a valley thinner than a column stays a line, and the map is worked out whole every frame: 4 to 100 pairs at each of 32768 samples, about 8 ms.
// From D to light. D is not shown by its value, since the roughness beside the unison is many times the rest and would flatten everything else. A pixel's brightness is its rank among the frame's 8192 values, u = 0.2 + 0.8 (1 - share of the map with a lower D)^1.45, so the picture keeps its contrast across the whole drift and nothing needs smoothing over time. Then the second difference across the columns, 0.45 (2u - u(x-2) - u(x+2)), lifts a valley floor above the plain it lies on and sinks the ridge line beside it, so thin valleys read as lines and not as faint ones. The palette has ink (20, 6, 34) at 0, violet (84, 20, 118) at 0.36, wine (132, 26, 90) at 0.52, ember (242, 112, 38) at 0.78, gold (255, 190, 90) at 0.88 and ice white (255, 250, 238) at 1, and u never falls below 0.25, so the lowest ridge is a dim indigo of about (50, 13, 85) and not black. Last, five broad pools of light, each a Gaussian with a spread of 12 to 22 columns and 22 to 40 rows, wander over the relief: where one lies the palette is read up to 1.12 times higher, where none does 0.8 times, so a valley is gold under a pool and ember outside it. The rank, the lift, the palette, the hue wash and the light are drawing choices; D itself is the model.
// The bead. A target interval wanders between 1.24 and 2.0 on two rates, and a target row with it. The bead takes the valley floor nearest that point, searching 26 rows either way and 16 columns, where a valley floor is a minimum of D across a row whose brightness stands at least 0.14 above the higher of the two troughs found within five columns on each side. It glides to a new valley with a time constant of 0.35 s and fades out when there is none, which at the opening is about one frame in twenty and with 3 partials one in four. A faint vertical guideline runs down the interval it holds, so the valleys can be seen bending away from the fixed ratio as the stretch changes. The bead has a dark ring so that it shows on a pale floor.
// What does not repeat. Every drift has its own rate and none divides another, and the clock starts at a different time on each opening. The drifts are the window's centre (three rates) and width, the stretch of the upper tone, the register (two), the partial count (two), alpha, the even partials, the level and the tuning of each of ten partials, the bead's target (two), five waves of hue, and the three rates of each of five pools of light. The map is a function of them only, so it holds no state that could die, blow up or lean to one side.

const W = 64, H = 128;
const { floor, sqrt, exp, sin, cos, min, max, pow, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------ the dissonance
const B1 = 3.5, B2 = 5.75;       // the Plomp-Levelt curve as Sethares fits it, from memory
const SA = 0.24, SB = 0.021, SC = 19; // s = 0.24 / (0.021 fmin + 19)
const NPMAX = 10;                // most partials
const R0 = 0.95, R1 = 2.1;       // interval ratio at the left and right edge of the panel
const LUTN = 512, LUTX = 3.0;    // d(x) as a table on 0..3, where it has fallen to 3e-5
const LUT = new Float32Array(LUTN + 2);
for (let i = 0; i < LUTN + 2; i++) {
  const x = (i / LUTN) * LUTX;
  LUT[i] = exp(-B1 * x) - exp(-B2 * x);
}
const LUTK = LUTN / LUTX;

const RATE = 4.5; // drift seconds a second at Drift 1
const EQG = 1.45, FLOOR = 0.25, KCURV = 0.45; // rank shading: exponent, brightness of the lowest ridge, valley lift
const D = new Float32Array(W * H);
const PW = new Float64Array(H * NPMAX), PW2 = new Float64Array(H * NPMAX); // i^p for each row, and for the second tone
const EP = new Float64Array(NPMAX), FA = new Float64Array(NPMAX), FB2 = new Float64Array(NPMAX), AM = new Float64Array(NPMAX);
const SS = 4; // sub-samples across each column, averaged: a valley thinner than a column stays a line
const RV = new Float64Array(W * SS);
const T01 = new Float32Array(W * H);
const FR = new Float32Array(W * H), FG = new Float32Array(W * H), FB = new Float32Array(W * H);

// ---------------------------------------------------------------- palette
// stops from ridge (0) to valley floor (1)
const PS = [0, 0.16, 0.36, 0.52, 0.66, 0.78, 0.88, 0.95, 1];
const PR = [20, 38, 84, 132, 196, 242, 255, 255, 255];
const PG = [6, 10, 20, 26, 46, 112, 190, 228, 250];
const PB = [34, 70, 118, 90, 56, 38, 90, 160, 238];
// the palette as luma and two chroma axes, so a hue turn is one rotation of the pair
const LUY = new Float32Array(256), LUI = new Float32Array(256), LUQ = new Float32Array(256);
for (let k = 0; k < 256; k++) {
  const t = k / 255;
  let i = 0;
  while (i < PS.length - 2 && t > PS[i + 1]) i++;
  const f = (t - PS[i]) / (PS[i + 1] - PS[i]);
  const r = (PR[i] + (PR[i + 1] - PR[i]) * f) / 255, g = (PG[i] + (PG[i + 1] - PG[i]) * f) / 255, b = (PB[i] + (PB[i + 1] - PB[i]) * f) / 255;
  LUY[k] = 0.299 * r + 0.587 * g + 0.114 * b;
  LUI[k] = 0.596 * r - 0.274 * g - 0.322 * b;
  LUQ[k] = 0.211 * r - 0.523 * g + 0.312 * b;
}
// into o: the palette at u, turned by hue turns
function colour(u, hue, o) {
  const k = (cl(u, 0, 1) * 255) | 0, th = hue * TAU, c = cos(th), s = sin(th);
  const Y = LUY[k], I = LUI[k] * c - LUQ[k] * s, Q = LUI[k] * s + LUQ[k] * c;
  o[0] = cl(Y + 0.956 * I + 0.621 * Q, 0, 1) * 255;
  o[1] = cl(Y - 0.272 * I - 0.647 * Q, 0, 1) * 255;
  o[2] = cl(Y - 1.106 * I + 1.703 * Q, 0, 1) * 255;
}
const CO = [0, 0, 0];

// a slow colour wash: five plane waves of hue across the panel, each on a rate of its own
const HK = [[0.071, 0.026], [-0.036, 0.05], [0.021, -0.043], [0.113, -0.067], [-0.052, -0.118]], HW = [0.071, 0.043, 0.097, 0.059, 0.083], HA = [0.03, 0.026, 0.018, 0.018, 0.014];

function mulberry(seedv) {
  let a = seedv >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function setup(params) {
  const r = mulberry((Math.random() * 4294967296) >>> 0);
  const ph = [];
  for (let i = 0; i < 40; i++) ph.push(TAU * r());
  const pa = [], pe = [];
  for (let i = 0; i < NPMAX; i++) {
    pa.push(TAU * r());
    pe.push(TAU * r());
  }
  params.s = { ph, pa, pe, T: 200 * r(), k: null, dt: 1 / 30, first: true, bx: 0, by: 0, ba: 0, P: null };
}

// each partial's level and its small detuning wander on rates of their own
const NUA = [0.057, 0.083, 0.049, 0.101, 0.067, 0.127, 0.073, 0.093, 0.113, 0.061];
const NUE = [0.043, 0.071, 0.059, 0.089, 0.047, 0.107, 0.079, 0.053, 0.097, 0.069];

// every drifting quantity has its own rate, none divides another
function drifts(S) {
  const T = S.T, ph = S.ph, k = S.k;
  const P = S.P || (S.P = {});
  P.T = T;
  P.pa = S.pa;
  P.pe = S.pe;
  P.ph = ph;
  P.pc = 1.04 + 0.09 * sin(0.0411 * T + ph[0]) + 0.045 * sin(0.0173 * T + ph[1]) + 0.025 * sin(0.0937 * T + ph[2]);
  P.w = 0.46 + 0.1 * sin(0.0293 * T + ph[3]);
  P.dq = 0.03 * sin(0.0337 * T + ph[15]) + 0.015 * sin(0.0871 * T + ph[16]);
  P.f0 = 400 * pow(2.2, cl(k[3], -1, 1)) * exp(0.3 * sin(0.0357 * T + ph[4]) + 0.14 * sin(0.0829 * T + ph[5]));
  P.N = cl(6 + cl(k[2], -4, 4) + 1.7 * sin(0.0521 * T + ph[6]) + 0.6 * sin(0.1117 * T + ph[7]), 2, NPMAX);
  P.alpha = 0.88 + 0.06 * sin(0.0617 * T + ph[8]) + 0.03 * sin(0.1303 * T + ph[9]);
  P.ev = 0.3 + 0.3 * sin(0.0239 * T + ph[10]);
  P.yb = 64 + 48 * sin(0.0273 * T + ph[11]) + 12 * sin(0.0911 * T + ph[12]);
  P.rt = 1.62 + 0.3 * sin(0.0197 * T + ph[13]) + 0.08 * sin(0.0617 * T + ph[14]);
  return P;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) S.k = [kv[0], kv[1], kv[2], kv[3]];
  const al = 1 - exp(-d / 0.15);
  for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  S.dt = d;
  S.T += d * cl(S.k[1], 0.5, 4) * RATE;
}

// the whole map for the current parameters, into D
function computeMap(P) {
  const N = P.N, n = min(NPMAX, Math.ceil(N)), alpha = P.alpha, ev = P.ev;
  let asum = 0;
  for (let i = 0; i < n; i++) {
    AM[i] = pow(alpha, i) * (i % 2 === 1 ? 1 - ev : 1) * cl(N - i, 0, 1) * (1 + 0.6 * sin(NUA[i] * P.T + P.pa[i]));
    EP[i] = 1 + 0.025 * sin(NUE[i] * P.T + P.pe[i]);
    asum += AM[i];
  }
  const norm = 1 / (asum * asum);
  const pc = P.pc, w = P.w, f0 = P.f0;
  for (let y = 0; y < H; y++) {
    const p = pc + w * (0.5 - (y + 0.5) / H);
    for (let i = 0; i < n; i++) {
      PW[y * NPMAX + i] = pow(i + 1, p) * EP[i];
      PW2[y * NPMAX + i] = pow(i + 1, p + P.dq) * EP[i];
    }
  }
  for (let x = 0; x < W * SS; x++) RV[x] = R0 + (R1 - R0) * (x + 0.5) / (W * SS);
  for (let y = 0; y < H; y++) {
    for (let i = 0; i < n; i++) {
      FA[i] = f0 * PW[y * NPMAX + i];
      FB2[i] = f0 * PW2[y * NPMAX + i];
    }
    for (let x = 0; x < W; x++) {
      let tot = 0;
      for (let q = 0; q < SS; q++) {
        const r = RV[x * SS + q];
        let sum = 0;
        for (let j = 0; j < n; j++) {
          const fb = r * FB2[j], aj = AM[j];
          for (let i = 0; i < n; i++) {
            const fa = FA[i];
            let df = fa - fb, fm = fb;
            if (df < 0) {
              df = -df;
              fm = fa;
            }
            const xx = (df * SA) / (SB * fm + SC);
            if (xx < LUTX) {
              const kk = xx * LUTK, i0 = kk | 0, fr = kk - i0;
              sum += AM[i] * aj * (LUT[i0] + (LUT[i0 + 1] - LUT[i0]) * fr);
            }
          }
        }
        tot += sum;
      }
      D[y * W + x] = (tot * norm) / SS;
    }
  }
}

const DB = new Float32Array(W * H);
function blurD() {
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      const l = D[o + (x > 0 ? x - 1 : 0)], r = D[o + (x < W - 1 ? x + 1 : x)];
      DB[o + x] = 0.2 * l + 0.6 * D[o + x] + 0.2 * r;
    }
  }
  D.set(DB);
}

const HB = 512;
const hist = new Float64Array(HB);
const CDF = new Float32Array(HB + 1);
// the share of the map that lies below each D, as a table over the map's own range
function equalise(out) {
  let mn = 1e9, mx = -1e9;
  for (let p = 0; p < W * H; p++) {
    const v = D[p];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  hist.fill(0);
  const sc = (HB - 1e-3) / max(mx - mn, 1e-9);
  for (let p = 0; p < W * H; p++) hist[((D[p] - mn) * sc) | 0]++;
  let c = 0;
  CDF[0] = 0;
  for (let b = 0; b < HB; b++) {
    c += hist[b];
    CDF[b + 1] = c / (W * H);
  }
  out[0] = mn;
  out[1] = sc;
}
const QQ = [0, 1];

// the second difference across the interval axis lifts a valley floor above the plain
// it lies on and sinks a ridge line below it, so thin valleys stay thin lines
const TS = new Float32Array(W * H);
function lift() {
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      const a = T01[o + (x > 1 ? x - 2 : 0)], b = T01[o + (x < W - 2 ? x + 2 : W - 1)], c = T01[o + x];
      TS[o + x] = cl(c + KCURV * (2 * c - a - b), 0, 1);
    }
  }
  T01.set(TS);
}

// a few broad pools of light wander over the relief: where one lies the palette is read
// up to 1.12 times higher, and 0.8 times where none does
const NL = 5, LIT0 = 0.8, LIT1 = 0.32;
const LA = [0.047, 0.031, 0.067, 0.023, 0.083], LB = [0.029, 0.053, 0.037, 0.071, 0.019], LC = [0.043, 0.061, 0.027, 0.079, 0.035];
const LSX = [15, 20, 12, 18, 22], LSY = [34, 26, 40, 30, 22];
const LX = new Float32Array(NL * W), LY = new Float32Array(NL * H), LW = new Float32Array(NL);
function lightPools(P) {
  const T = P.T, ph = P.ph;
  for (let k = 0; k < NL; k++) {
    const cx = 32 + 36 * sin(LA[k] * T + ph[22 + k * 3]), cy = 64 + 74 * sin(LB[k] * T + ph[23 + k * 3]);
    LW[k] = 0.55 + 0.45 * sin(LC[k] * T + ph[24 + k * 3]);
    for (let x = 0; x < W; x++) LX[k * W + x] = exp(-((x + 0.5 - cx) * (x + 0.5 - cx)) / (2 * LSX[k] * LSX[k]));
    for (let y = 0; y < H; y++) LY[k * H + y] = exp(-((y + 0.5 - cy) * (y + 0.5 - cy)) / (2 * LSY[k] * LSY[k]));
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let sum = 0;
      for (let k = 0; k < NL; k++) sum += LW[k] * LX[k * W + x] * LY[k * H + y];
      const p = y * W + x;
      T01[p] = cl(T01[p] * (LIT0 + LIT1 * (1 - exp(-1.4 * sum))), 0, 1);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const P = drifts(S);
  computeMap(P);
  blurD();
  equalise(QQ);
  for (let p = 0; p < W * H; p++) {
    const kk = (D[p] - QQ[0]) * QQ[1], i0 = kk | 0, fr = kk - i0;
    const cdf = CDF[i0] + (CDF[i0 + 1] - CDF[i0]) * fr; // 0 at the lowest D, 1 at the highest
    T01[p] = FLOOR + (1 - FLOOR) * pow(1 - cdf, EQG);
  }
  lift();
  lightPools(P);

  // ---- the bead: the valley floor nearest the point (interval, row) it follows
  const tx = ((P.rt - R0) / (R1 - R0)) * W - 0.5, ty = P.yb - 0.5;
  let best = 1e9, bxx = 0, byy = 0, bprom = 0;
  for (let y = cl(Math.round(ty) - 26, 2, H - 3); y <= cl(Math.round(ty) + 26, 2, H - 3); y += 2) {
    const o = y * W;
    for (let x = 1; x < W - 1; x++) {
      const c = D[o + x];
      if (c > D[o + x - 1] || c >= D[o + x + 1] || T01[o + x] < 0.55) continue;
      let ml = 1, mr = 1;
      for (let q = 1; q <= 5; q++) {
        if (x - q >= 0) ml = min(ml, T01[o + x - q]);
        if (x + q < W) mr = min(mr, T01[o + x + q]);
      }
      const prom = T01[o + x] - max(ml, mr);
      if (prom < 0.14) continue;
      const ex = (x - tx) / 10, ey = (y - ty) / 22, sc = ex * ex + ey * ey - 2 * prom;
      if (sc < best) {
        best = sc;
        bprom = prom;
        byy = y;
        const a = D[o + x - 1], cc = D[o + x + 1], den = a - 2 * c + cc;
        bxx = x + (den > 1e-12 ? 0.5 * (a - cc) / den : 0);
      }
    }
  }
  const found = best < 1e8 && abs(bxx - tx) < 16;
  const want = found ? sstep(0.14, 0.3, bprom) : 0;
  if (S.first) {
    S.bx = found ? bxx : tx;
    S.by = found ? byy : ty;
    S.ba = want;
  } else {
    if (found) {
      const a = 1 - exp(-S.dt / 0.35);
      S.bx += (bxx - S.bx) * a;
      S.by += (byy - S.by) * a;
    }
    S.ba += (want - S.ba) * (1 - exp(-S.dt / 0.4));
  }
  S.first = false;

  // ---- paint
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let hf = 0;
      for (let q = 0; q < 5; q++) hf += HA[q] * sin(HK[q][0] * x + HK[q][1] * y + HW[q] * P.T + P.ph[17 + q]);
      colour(T01[p], S.k[0] + hf, CO);
      FR[p] = CO[0];
      FG[p] = CO[1];
      FB[p] = CO[2];
    }
  if (S.ba > 0.01) {
    const bx = S.bx + 0.5, by = S.by + 0.5, ba = S.ba;
    // the faint guideline: the interval the bead holds, straight down the map
    for (let y = 0; y < H; y++) {
      const gw = 0.14 * ba * (0.5 + 0.5 * exp(-abs(y + 0.5 - by) / 28));
      for (let x = max(0, floor(bx) - 3); x <= min(W - 1, floor(bx) + 3); x++) {
        const ex = x + 0.5 - bx, g = gw * exp(-ex * ex / 1.4), p = y * W + x;
        FR[p] += (255 - FR[p]) * g;
        FG[p] += (255 - FG[p]) * g;
        FB[p] += (255 - FB[p]) * g;
      }
    }
    // the bead: a dark moat round a white core, so it reads on a pale valley floor as well
    for (let j = -7; j <= 7; j++) {
      const yy = floor(by) + j;
      if (yy < 0 || yy >= H) continue;
      for (let i = -7; i <= 7; i++) {
        const xx = floor(bx) + i;
        if (xx < 0 || xx >= W) continue;
        const ex = xx + 0.5 - bx, ey = yy + 0.5 - by, d2 = ex * ex + ey * ey, d = sqrt(d2), p = yy * W + xx;
        const moat = 1 - 0.6 * ba * exp(-(d - 3.4) * (d - 3.4) / 1.6);
        FR[p] *= moat;
        FG[p] *= moat;
        FB[p] *= moat;
        const w = cl((exp(-d2 / 2.0) + 0.3 * exp(-d2 / 8)) * ba, 0, 1);
        FR[p] += (255 - FR[p]) * w;
        FG[p] += (255 - FG[p]) * w;
        FB[p] += (255 - FB[p]) * w;
      }
    }
  }
  for (let p = 0; p < W * H; p++) display.setPixel(p % W, (p / W) | 0, FR[p] | 0, FG[p] | 0, FB[p] | 0);
}
