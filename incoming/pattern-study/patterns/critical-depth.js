// ===== Patternflow pattern =====
// Title:   Critical Depth
// Family:  sverdrup
// Idea:    A time-depth section of the open sea scrolls in from the right, 128 rows from the surface down to 205 m, in which a phytoplankton bloom ignites as a lime-to-gold glow whenever the wind-mixed layer shoals above Sverdrup's critical depth, the depth where the water column's growth balances its loss, and is swept thin when a storm deepens the mixing again, the mixed layer drawn as a crisp pale line and the critical depth as a fainter violet one over blue water that fades with depth.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the critical depth of a mixed layer, above which a bloom can start (Harald Sverdrup, 1953, from memory), the self-shaded light field and the critical turbulence of a plankton column mixed at a finite rate (Jef Huisman, Pascal van Oostveen and Franz Weissing, 1999, from memory), Monod growth on a limiting nutrient (Jacques Monod, 1949, from memory), original code, pattern round 276
// Round:   276
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Light=0..4, Storms=-1..1, Nutrient=-1..1
//
// Knob 1: Hue. Turns the water, the bloom, the mixed layer line and the critical depth line round the colour wheel together by adding K to every hue, one turn over the range, so that 0 is the blue-green sea with a lime-to-gold bloom (water hue 0.63 at depth to 0.52 in the bright top, bloom 0.27 to 0.13 as it thickens). At 0.5 the sea is brown and the bloom blue, at 1 it is back. It acts on the whole section at once, the past included.
// Knob 2: Light. The light at the surface, I0 = 30 x 3.4^(K / 4) W per m2: 30 at 0, 55 at 2 where it opens, 102 at 4, times a slow sun (three swings of 28, 17 and 12 percent on 83.7, 197.3 and 41.9 days) and a drifting cloud. It sets the critical depth. For clear water the depth where the growth summed from the surface falls back to the loss is 84 m at 0, 126 m at 2 and 174 m at 4. As drawn, with the plankton's shade, the line sits at 70 m at 0, 105 m at 2 and 149 m at 4 (medians over 1800 days), and in a bloom it climbs to 40 percent shallower than clear water. At 0 a bloom needs a mixed layer shallower than about 70 m and stays faint, at 4 only the deepest storms can stop one. It reaches the picture through each column as it is made, so the water brightens and the violet line sinks from the right edge.
// Knob 3: Storms. How often the wind mixes deep and how deep, from -1 to 1, opening at 0. A storm arrives on average every 20 x 2^(-0.8 K) days: every 35 days at -1, 20 at 0, 11.5 at 1. It kicks the mixed layer down by (35 + 70 x Exp(1)) x 2^(0.45 K) m, 77 m on average at -1, 105 at 0, 143 at 1 (never past 190 m in all), and the kick dies away over 2 to 6 days. At the opening the mixed layer is 19 m or less a tenth of the time, 41 m at the median and 96 m or more a tenth of the time; at -1 the median is 35 m and the deep tenth starts at 73 m, at 1 they are 61 m and 141 m. Calm, the line stays high and blooms stand long. Stormy, it spikes into the dark every few columns and each spike wipes a bloom out.
// Knob 4: Nutrient. The nutrient held in the deep water, N = 7 x 2^K mmol N per m3: 3.5 at -1, 7.3 at 0.06 where it opens, 14 at 1. From 60 m down, and in full below 120 m, the water is pulled towards that value at 0.06 per day, and a storm that mixes down to it hands the surface a fresh supply. It decides how strong each bloom grows before it is starved: the plankton maximum of a column has a median of 0.14 mmol N per m3 at -1, 0.29 at the opening and 0.61 at 1, and it is over 0.8 for 2 to 4 percent of the time at -1, 13 to 23 percent at the opening and 39 to 47 percent at 1, so at -1 only faint glows come and go.
//
// What the picture is. A section of the sea against time, one column to every 4 s, newest at the right, so the 64 columns are 256 s and each is 1.5 days of the model. Row 0 is the surface and each row 1.6 m, so row 127 is 205 m. Nothing is a label: no axis, no number. Between columns the picture slides smoothly, the rows are never resampled.
// The water. 128 cells of 1.6 m hold plankton P and a dissolved nutrient N in mmol N per m3. Light falls as I(z) = I0 exp(-(0.045 z + 0.025 x the plankton above)), so a bloom shades what lies under it. Growth is 2.0 per day x I / (I + 22) x N / (N + 0.5), loss 0.44 per day with 60 percent of it returned as nutrient, sinking 0.4 m per day. Mixing is diffusion in flux form, solved implicitly so that it keeps mass and stays positive: above the mixed layer depth h it is h^2 / 3.5 m2 per day, below it 1, joined by a logistic step 1.5 m wide. The nutrient is consumed by growth, returned by loss, carried across h by whatever mixing there is, and pulled towards the deep value from 60 m down. A 3 x 10^-3 trickle of plankton per day arrives wherever there is light. The sums run on a quarter-day step, six to a column, and over 900 s the mass budget closes to 10^-9 with no negative cell.
// The weather. h is a random walk and nothing else: a calm depth (an Ornstein-Uhlenbeck walk in log depth, 26 m median, with two slow drifts of 71.3 and 137.9 days), a Poisson train of storms that kick it down, a gust, and a mixed layer that follows the target down in 0.6 days and back up in 2.2. The surface light drifts on three periods that share no factor. Nothing is a function of time modulo a period, so no stretch of the sea comes round again, and a bloom ignites, peaks, crashes and ignites again at uneven spaces: three to six times in 450 days at the opening, 12 to 44 days long (tenth to ninetieth percentile over four runs of 900 days).
// The lines. The pale line is h, drawn 2 LEDs thick with a thin edge and joined from column to column so a storm's drop is one vertical stroke. The violet one is the critical depth of the section as it stands: the depth where the growth the light allows, summed down from the surface for the plankton present, falls back to the loss 0.44 per day. When h lies under it a bloom can start, when h lies over it one cannot. In a bloom the shade of the plankton pulls it up to meet h, which is where the bloom peaks.
// The colour. The plankton goes through a log scale from 0.2 to 2.5 mmol N per m3, so a faint bloom reads, as a glow that goes from lime to gold, fainter where the light has gone, over the blue of the water, which fades with depth by the light but never to black (the darkest 16 x 16 cell keeps 0.41 to 0.64 of the mean over 240 s).
// What is exact and what is drawn. The light field with self-shading, the critical depth, the saturating growth, the nutrient and mass budget, the implicit mixing and the mixed layer as a switch in the mixing are the model. The weather, the parameter values, the trickle of plankton, the log scale, the colours and the scroll are drawing choices.

const W = 64, H = 128, NC = 72;
const { floor, sqrt, exp, log, sin, cos, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// ---- the water column: 128 cells of 1.6 m, units are metres, days and mmol N per m3
const NZ = H, DZ = 1.6;
const KW = 0.045;       // light lost to the water itself, per metre
const KP = 0.025;       // light lost to the plankton, m2 per mmol N (self-shading)
const MU = 2.0;         // top growth rate, per day
const KI = 22;          // light at half that rate, W per m2
const KN = 0.5;         // nutrient at half that rate
const M0 = 0.44;        // loss (respiration, grazing, death), per day
const FREC = 0.6;       // share of the loss that goes back to nutrient
const SEED = 3e-3;      // plankton arriving with the water from elsewhere, mmol N per m3 per day, where there is light
const WSINK = 0.4;      // sinking, m per day
const TMIX = 3.5;       // days a mixed layer takes to stir over its own depth: kappa = h^2 / TMIX
const KAP_BG = 1;       // and below it
const DT = 0.25, SUB = 6;   // one substep a quarter day, one column six of them
const COL_SEC = 4;      // panel seconds per column
const PREF = 2.5;       // plankton that reads as full glow, mmol N per m3 (log scale from 0.2)

function gauss() {
  const u = Math.random() + 1e-12, v = Math.random();
  return sqrt(-2 * log(u)) * cos(TAU * v);
}

export function setup(params) {
  const ph = [];
  for (let i = 0; i < 12; i++) ph.push(TAU * Math.random());
  params.s = {
    ph,
    P: new Float64Array(NZ), N: new Float64Array(NZ),
    t: 0, ox: 0, oc: 0, og: 0, storm: 0, tauS: 6, h: 25,
    I0: 40,
    src: 0, exp: 0,   // what has come into the column and left it, for the mass check
    v: new Float32Array(NC * H), w: new Float32Array(NC * H), gn: new Float32Array(NC * H),
    hr: new Float32Array(NC), dr: new Float32Array(NC),
    n: 0, f: 0, k: null, ready: false,
    hueAt: -9, wl: new Uint8Array(256 * 3), bl: new Uint8Array(256 * 3),
    A: new Float64Array(NZ), B: new Float64Array(NZ), C: new Float64Array(NZ), D: new Float64Array(NZ),
    CP: new Float64Array(NZ), DP: new Float64Array(NZ), kap: new Float64Array(NZ + 1), nud: new Float64Array(NZ),
  };
}

// knobs -> model quantities
const lightOf = (k) => 30 * pow(3.4, cl(k, 0, 4) / 4);
const stormOf = (k) => cl(k, -1, 1);
const deepOf = (k) => 7 * pow(2, cl(k, -1, 1));

// ---- the weather: a mixed layer depth h(t) and a surface light I0(t), both random
function weather(S, k, dt) {
  const t = S.t, ph = S.ph;
  const st = stormOf(k[2]);
  // calm depth: an Ornstein-Uhlenbeck walk in log depth plus slow drifts that never share a period
  S.ox += (-S.ox / 10) * dt + sqrt((2 * dt) / 10) * gauss();
  const hb = cl(26 * exp(0.42 * S.ox + 0.26 * sin((TAU * t) / 71.3 + ph[0]) + 0.18 * sin((TAU * t) / 137.9 + ph[1])), 8, 110);
  // storms: a Poisson arrival, a kick in depth with an exponential tail, a decay time of its own
  const lam = (1 / 20) * pow(2, 0.8 * st);
  if (Math.random() < lam * dt) {
    const kick = (35 + 70 * -log(Math.random() + 1e-9)) * pow(2, 0.45 * st);
    S.storm = min(190, S.storm + kick);
    S.tauS = 2 + 4 * Math.random();
  }
  S.storm *= exp(-dt / S.tauS);
  S.og += (-S.og / 8) * dt + sqrt((2 * dt) / 8) * gauss();
  const target = cl((hb + S.storm) * exp(0.07 * S.og), 6, 200);
  const tau = target > S.h ? 0.6 : 2.2;
  S.h += (target - S.h) * (1 - exp(-dt / tau));
  // cloud: a slow OU, and two slow swings of the sun
  S.oc += (-S.oc / 9) * dt + sqrt((2 * dt) / 9) * gauss();
  const sun = 1 + 0.28 * sin((TAU * t) / 83.7 + ph[2]) + 0.17 * sin((TAU * t) / 197.3 + ph[3]) + 0.12 * sin((TAU * t) / 41.9 + ph[4]);
  S.I0 = lightOf(k[1]) * sun * cl(1 - 0.18 * S.oc, 0.5, 1.3);
}

// tridiagonal solve, A below, B on, C above the diagonal, in place into D
function thomas(S) {
  const A = S.A, B = S.B, C = S.C, D = S.D, CP = S.CP, DP = S.DP;
  CP[0] = C[0] / B[0];
  DP[0] = D[0] / B[0];
  for (let i = 1; i < NZ; i++) {
    const m = 1 / (B[i] - A[i] * CP[i - 1]);
    CP[i] = C[i] * m;
    DP[i] = (D[i] - A[i] * DP[i - 1]) * m;
  }
  D[NZ - 1] = DP[NZ - 1];
  for (let i = NZ - 2; i >= 0; i--) D[i] = DP[i] - CP[i] * D[i + 1];
}

function substep(S, k, dt) {
  weather(S, k, dt);
  const P = S.P, N = S.N, h = S.h, I0 = S.I0, nd = deepOf(k[3]);
  // light and growth; below about 1 percent of the light there is no growth to count
  let cum = 0, i = 0;
  for (; i < NZ; i++) {
    const I = I0 * exp(-(KW * (i + 0.5) * DZ + KP * (cum + 0.5 * P[i] * DZ)));
    cum += P[i] * DZ;
    if (I < 0.15) break;
    const g = ((MU * I) / (I + KI)) * (N[i] / (N[i] + KN));
    let dP = P[i] * (exp(g * dt) - 1);
    if (dP > N[i]) dP = N[i];
    P[i] += dP;
    N[i] -= dP;
    P[i] += SEED * dt;
    S.src += SEED * dt * DZ;
  }
  const lf = 1 - exp(-M0 * dt);
  for (let j = 0; j < NZ; j++) {
    const lost = P[j] * lf;
    P[j] -= lost;
    N[j] += FREC * lost;
    S.exp += (1 - FREC) * lost * DZ;
  }
  // diffusion: a smooth step from fast above h to slow below it
  const kap = S.kap, kml = max(150, (h * h) / TMIX);
  kap[0] = 0;
  kap[NZ] = 0;
  for (let i = 1; i < NZ; i++) {
    const x = (i * DZ - h) / 1.5;
    const s = x < -12 ? 0 : x > 12 ? 1 : 1 / (1 + exp(-x));
    kap[i] = kml * (1 - s) + KAP_BG * s;
  }
  const A = S.A, B = S.B, C = S.C, D = S.D, nud = S.nud;
  const wd = (WSINK * dt) / DZ;
  for (let i = 0; i < NZ; i++) {
    const lo = (kap[i] * dt) / (DZ * DZ), hi = (kap[i + 1] * dt) / (DZ * DZ);
    A[i] = -(lo + (i > 0 ? wd : 0));
    C[i] = -hi;
    B[i] = 1 + lo + hi + (i < NZ - 1 ? wd : 0);
    D[i] = P[i];
  }
  thomas(S);
  for (let i = 0; i < NZ; i++) P[i] = D[i];
  // nutrient: the same mixing, no sinking, and a slow pull towards the deep value, from 60 m down and in full below 120 m
  for (let i = 0; i < NZ; i++) {
    const lo = (kap[i] * dt) / (DZ * DZ), hi = (kap[i + 1] * dt) / (DZ * DZ);
    const z = (i + 0.5) * DZ, r = 0.06 * sm(60, 120, z) * dt;
    A[i] = -lo;
    C[i] = -hi;
    B[i] = 1 + lo + hi + r;
    D[i] = N[i] + r * nd;
    nud[i] = r;
  }
  thomas(S);
  for (let i = 0; i < NZ; i++) {
    N[i] = D[i];
    S.src += nud[i] * (nd - N[i]) * DZ;
  }
  S.t += dt;
}

// the critical depth: where the growth the light allows, summed down from the surface, falls back to the loss
function critical(S) {
  const P = S.P;
  let cum = 0, G = 0, pos = false;
  const I0 = S.I0;
  for (let i = 0; i < NZ; i++) {
    const I = I0 * exp(-(KW * (i + 0.5) * DZ + KP * (cum + 0.5 * P[i] * DZ)));
    cum += P[i] * DZ;
    const g = (MU * I) / (I + KI) - M0;
    const G2 = G + g * DZ;
    if (G2 > 0) pos = true;
    if (pos && G2 <= 0) return i * DZ + (DZ * G) / (G - G2);
    G = G2;
  }
  return pos ? 999 : 0;
}

function record(S) {
  const P = S.P, n = S.n, o = (n % NC) * H;
  let cum = 0;
  for (let i = 0; i < NZ; i++) {
    const I = S.I0 * exp(-(KW * (i + 0.5) * DZ + KP * (cum + 0.5 * P[i] * DZ)));
    cum += P[i] * DZ;
    S.w[o + i] = min(1, pow(I / S.I0, 0.19) * pow(S.I0 / 160, 0.2));
    S.gn[o + i] = 0.12 + 0.88 * pow(I / S.I0, 0.55);
    S.v[o + i] = cl(log(P[i] / 0.2) / log(PREF / 0.2), 0, 1);
  }
  S.hr[n % NC] = S.h / DZ;
  S.dr[n % NC] = critical(S) / DZ;
}

function column(S, k) {
  for (let j = 0; j < SUB; j++) substep(S, k, DT);
  S.n++;
  record(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
  } else {
    const al = 1 - exp(-d / 0.3);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  if (!S.ready) {
    S.ready = true;
    const nd = deepOf(S.k[3]);
    for (let i = 0; i < NZ; i++) {
      S.P[i] = 0.02;
      S.N[i] = nd * (0.5 + 0.5 * sm(0, 120, (i + 0.5) * DZ));
    }
    S.h = 40;
    for (let j = 0; j < 400; j++) substep(S, S.k, DT);
    for (let c = 0; c < NC; c++) column(S, S.k);
    S.f = 0;
  }
  S.f += d / COL_SEC;
  let guard = 0;
  while (S.f >= 1 && guard++ < 6) {
    S.f -= 1;
    column(S, S.k);
  }
  if (S.f >= 1) S.f = 0.999;
}

// ---- colour
function hsv(h, s, v, o, j) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[j] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[j + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[j + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}
function buildLut(S, hue) {
  for (let e = 0; e < 256; e++) {
    const t = e / 255;
    hsv(0.63 - 0.11 * t + hue, 0.85, 0.19 + 0.66 * pow(t, 0.9), S.wl, e * 3);
    hsv(0.27 - 0.14 * t + hue, 0.88 - 0.14 * t * t, 0.4 + 0.5 * pow(t, 0.85), S.bl, e * 3);
  }
  S.hueAt = hue;
}

const LC = [0, 0, 0], DC = [0, 0, 0];
const hAt = (S, p) => {
  p = min(p, S.n);
  const i = floor(p), f = p - i, a = ((i % NC) + NC) % NC, b = (a + 1) % NC;
  return [S.hr[a] * (1 - f) + S.hr[b] * f, S.dr[a] * (1 - f) + S.dr[b] * f];
};

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const hue = S.k[0];
  if (abs(hue - S.hueAt) > 0.002) buildLut(S, hue);
  hsv(0.5 + hue, 0.1, 1, LC, 0);
  hsv(0.83 + hue, 0.45, 0.62, DC, 0);
  const wl = S.wl, bl = S.bl, f = S.f, g = 1 - f;
  for (let x = 0; x < W; x++) {
    const k0 = S.n - 1 - (W - 1 - x);
    const i0 = ((k0 % NC) + NC) % NC, i1 = (i0 + 1) % NC;
    const b0 = i0 * H, b1 = i1 * H;
    // the line over this pixel column: the span of h from its left edge to its right edge
    const a = k0 + f - 0.6, m = Math.ceil(a);
    const ha = hAt(S, a), hm = hAt(S, m), hn = hAt(S, m + 1), hb = hAt(S, a + 1.2);
    const lo = min(ha[0], hm[0], hn[0], hb[0]), hi = max(ha[0], hm[0], hn[0], hb[0]);
    const dlo = min(ha[1], hm[1], hn[1], hb[1]), dhi = max(ha[1], hm[1], hn[1], hb[1]);
    for (let y = 0; y < H; y++) {
      const wv = S.w[b0 + y] * g + S.w[b1 + y] * f, vv = S.v[b0 + y] * g + S.v[b1 + y] * f;
      const wi = (wv * 255) | 0, vi = (vv * 255) | 0;
      const gain = S.gn[b0 + y] * g + S.gn[b1 + y] * f;
      let r = wl[wi * 3], gg = wl[wi * 3 + 1], b = wl[wi * 3 + 2];
      const al = sm(0, 0.22, vv) * gain;
      r += (bl[vi * 3] - r) * al;
      gg += (bl[vi * 3 + 1] - gg) * al;
      b += (bl[vi * 3 + 2] - b) * al;
      const yc = y + 0.5;
      // critical depth, faint
      let d = max(0, dlo - yc, yc - dhi);
      if (d < 1.9) {
        const al = 0.45 * (d < 1 ? 1 : (1.9 - d) / 0.9);
        r += (DC[0] - r) * al; gg += (DC[1] - gg) * al; b += (DC[2] - b) * al;
      }
      // mixed layer depth, crisp
      d = max(0, lo - yc, yc - hi);
      if (d < 1.9) {
        const al = d < 1 ? 0.95 : 0.4 * ((1.9 - d) / 0.9);
        r += (LC[0] * 0.92 - r) * al;
        gg += (LC[1] * 0.92 - gg) * al;
        b += (LC[2] * 0.92 - b) * al;
      }
      display.setPixel(x, y, r | 0, gg | 0, b | 0);
    }
  }
}
