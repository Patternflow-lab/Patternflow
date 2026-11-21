// ===== Patternflow pattern =====
// Title:   Lens Ghosts
// Family:  lensflare
// Idea:    The flare of a camera aimed at a strong light, drawn as optics: a bright source wanders slowly round a dark frame and every internal reflection between the lens elements throws one ghost, a copy of the aperture polygon with a rainbow rim, that sits on the line through the source and the lens centre at its own fixed multiple of the source's offset, so some ghosts slide the opposite way to the light, with diffraction spikes round the source, a prismatic ring halo, one long blue-white anamorphic streak and a veil of glare.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the ghost images a multi-element lens throws from internal reflections between its glass surfaces, the reason for anti-reflection coatings (Alexander Smakula, Zeiss, 1935); Fraunhofer diffraction at a straight edge for the spikes (an n-blade iris gives n spikes for even n and 2n for odd n); the polygon aperture as the shape of a ghost and of a bokeh disc; the anamorphic streak of cinema lenses; and screen-space lens flare in real-time graphics (Physically-Based Real-Time Lens Flare Rendering, Matthias Hullin, Elmar Eisemann, Hans-Peter Seidel and Sungkil Lee, 2011); pattern round 209
// Round:   209
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drift=0..3, Blades=5..9, Glare=-1..1
//
// Knob 1: Hue. Turns the tints of the ghosts and of the light round the wheel. At 0 the light is a cool white and the ghosts are teal, amber, violet and magenta; at 0.5 the light is a warm white, teal has gone red and amber blue; at 1 the picture is back where it began. On top of the knob the ghosts' tints wander about 45 degrees each on periods of one to three minutes, and the light's about 100 degrees.
// Knob 2: Drift. How fast the light wanders. At 1 it covers about 2.5 LEDs a second, at the opening 2 about 5, at 3 about 7.5, and a ghost at -0.95 times its offset runs the other way at the same pace. At 0 the light stands still and the picture only breathes, zooms and turns with the lens.
// Knob 3: Blades. The number of blades of the aperture, 5 to 9, which sets the shape of every ghost and the star of spikes. At the opening 5 the ghosts are pentagons and the star has 10 spikes; at 6 they are hexagons with 6 spikes, at 7 heptagons with 14, at 8 octagons with 8 and at 9 nine-sided and nearly round with 18. Between two counts one shape melts into the next over the middle third of the turn.
// Knob 4: Glare. How much light the lens scatters. At -1 the spikes are stubs about 17 LEDs long and there is no ring and next to no veil. At the opening 0.06 they run 30 to 55 LEDs, a ring with a red inner edge and a blue outer one stands 26 LEDs from the light and a faint veil lifts the black. At 1 the spikes, the ring and the veil are at full strength and the whole frame glows.

const W = 64;
const H = 128;
const { sin, cos, tan, sqrt, exp, floor, max, min, abs, atan2, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const CX = 32; // the centre of the frame, where the ghost line crosses
const CY = 64;
const HALO_R = 26; // the ring round the light, in LEDs
const EPS = [0.07, 0, -0.07]; // red, green and blue are drawn at these scales
const SHIFT = 0.3; // and slid along the ghost line by this much of the same
const T0 = 285; // where on its ring the first light stands when the Lab starts
const TT0 = 176; // and where the slow clock of the lens (zoom, roll, tints, strength) stands
const SRC_HUE = 235; // OKLCH degrees of the light's tint at Hue 0: a cool white

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

// encode: linear light, soft knee above 0.6, then 1/2.2
const NLUT = 2048;
const ENC = new Uint8Array(NLUT + 1);
for (let i = 0; i <= NLUT; i++) {
  const x = (i / NLUT) * 2.5;
  const y = x < 0.6 ? x : 0.6 + 0.4 * (1 - exp(-(x - 0.6) / 0.4));
  ENC[i] = Math.round(255 * Math.pow(y, 0.45));
}

function hash(i) {
  const h = sin(i * 12.9898 + 4.1414) * 43758.5453;
  return h - floor(h);
}

// ---- the lens ----
// One row per ghost. m is the multiple of the light's offset from the frame centre
// at which the ghost sits (a negative m puts it on the far side of the centre and
// makes it slide against the light). R is the circumradius of the aperture image in
// LEDs. kind: 0 a soft disc bright in the core, 1 a thin ring, 2 a clear polygon
// with a bright rim. hue is OKLCH degrees at Hue 0; b the brightness; soft the
// blur of its edge in LEDs; flip turns the image through half a turn (a ghost made
// by an odd number of reflections is upside down).
const GHOSTS = [
  { m: 0.2, R: 5.2, kind: 1, hue: 295, L: 0.8, C: 0.15, b: 1.0, soft: 0.9, flip: 0, w: 0.31, p: 0.4 },
  { m: 0.5, R: 8.6, kind: 0, hue: 195, L: 0.82, C: 0.13, b: 0.85, soft: 1.4, flip: 1, w: 0.23, p: 2.0 },
  { m: 0.95, R: 5.8, kind: 2, hue: 60, L: 0.88, C: 0.13, b: 0.85, soft: 1.0, flip: 0, w: 0.47, p: 3.6 },
  { m: -0.28, R: 6.4, kind: 2, hue: 345, L: 0.78, C: 0.16, b: 0.85, soft: 1.0, flip: 1, w: 0.37, p: 4.1 },
  { m: -0.62, R: 9.8, kind: 1, hue: 85, L: 0.9, C: 0.12, b: 1.0, soft: 1.0, flip: 0, w: 0.19, p: 5.3 },
  { m: -0.95, R: 5.6, kind: 1, hue: 185, L: 0.82, C: 0.13, b: 1.0, soft: 0.9, flip: 1, w: 0.43, p: 1.2 },
  { m: -1.3, R: 8.8, kind: 2, hue: 285, L: 0.78, C: 0.15, b: 0.8, soft: 1.2, flip: 0, w: 0.29, p: 3.3 },
  { m: 1.3, R: 5.6, kind: 0, hue: 335, L: 0.8, C: 0.16, b: 0.8, soft: 1.0, flip: 0, w: 0.41, p: 0.9 },
];
const NG = GHOSTS.length;
// interior of each kind: base fill, extra at the core, rim strength, rim width
const KIND = [
  [0.3, 0.7, 0.16, 2.4],
  [0.05, 0.0, 1.0, 2.6],
  [0.36, 0.0, 0.64, 2.6],
];
const TANS = [0, 0, 0, 0, 0, tan(PI / 5), tan(PI / 6), tan(PI / 7), tan(PI / 8), tan(PI / 9)];

// more spikes share the same light, so each is a little dimmer
const SPKGAIN = {};
for (const ns of [6, 8, 10, 14, 18]) SPKGAIN[ns] = Math.sqrt(10 / ns);
// each spike direction has its own length, fixed per blade count
const SPK = {};
for (let n = 5; n <= 9; n++) {
  const ns = n % 2 ? 2 * n : n;
  const a = new Float32Array(ns);
  for (let j = 0; j < ns; j++) a[j] = 0.68 + 0.4 * hash(j * 3 + n * 17);
  SPK[n] = a;
}

export function setup(params) {
  params.s = {
    t: TT0,
    tau: T0,
    hue: 0,
    drift: 2,
    blades: 5,
    glare: 0.53,
    // light 1 and light 2 in LEDs from the frame centre, then their strengths
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
    w2: 0,
    alpha: 0, // the aperture's turn
    lh: 0, // how far the light's tint has drifted, degrees
    kz: 1, // the zoom
    ax: 0, // where the ghost line pivots, off the frame centre
    ay: 0,
    ex: 1, // the light's strength
    src: [1, 1, 1],
    vc: [1, 1, 1],
    gcol: [],
    acc: new Float32Array(W * H * 3),
    tmp: [0, 0, 0],
    vv: new Float32Array(3),
    cxs: new Float32Array(3),
    cys: new Float32Array(3),
  };
  for (let k = 0; k < NG; k++) params.s.gcol.push([0, 0, 0]);
  pose(params.s);
}

// the light's place at the state's clocks
function pose(S) {
  const tau = S.tau;
  const t = S.t;
  // light 1: round the frame centre on a squashed ring whose radius breathes and whose
  // angular speed swells and stalls, all on periods that do not divide
  const th1 = 0.9 + 0.06 * tau + 1.3 * sin(0.037 * tau + 0.4) + 0.7 * sin(0.083 * tau + 1.3) + 0.5 * sin(0.0153 * tau + 5.1);
  const rh1 = 0.98 + 0.28 * sin(0.0531 * tau + 2.2) + 0.12 * sin(0.1117 * tau + 0.6) + 0.12 * sin(0.0197 * tau + 4.0);
  S.x1 = 31 * rh1 * cos(th1);
  S.y1 = 62 * rh1 * sin(th1);
  // light 2: a weaker one on another ring, a little slower, the other way round
  const th2 = 2.6 - 0.047 * tau + 1.1 * sin(0.041 * tau + 2.1) + 0.6 * sin(0.0973 * tau + 0.2);
  const rh2 = 0.98 + 0.4 * sin(0.0467 * tau + 0.5) + 0.12 * sin(0.1291 * tau + 3.0);
  S.x2 = 31 * rh2 * cos(th2);
  S.y2 = 60 * rh2 * sin(th2);
  // light 2 comes and goes over a minute or so
  S.w2 = sm(0.3, 0.6, 0.5 + 0.34 * sin(0.0517 * t + 0.8) + 0.2 * sin(0.0211 * t + 2.0));
  // the lens rolls slowly about its axis, a turn in about eight minutes
  S.alpha = -1.2 + 0.0131 * t + 0.25 * sin(0.0173 * t + 0.5) + 0.12 * sin(0.0431 * t + 2.0);
  S.lh = 75 * sin(0.0283 * t + 1.3) + 30 * sin(0.0617 * t + 0.2);
  // the light itself swells and dims a quarter either way, on two periods that do not divide
  S.ex = 1 + 0.26 * sin(0.0457 * t + 3.1) + 0.1 * sin(0.1033 * t + 1.0);
  // the lens zooms slowly: the whole chain of ghosts spreads and packs by a fifth either way
  S.kz = 1 + 0.26 * sin(0.0337 * t + 0.8) + 0.1 * sin(0.0791 * t + 2.4);
  // and the lens sits a little off true: the line of ghosts pivots about a point that wanders
  S.ax = 12 * sin(0.0229 * t + 2.9) + 5 * sin(0.0571 * t + 0.4);
  S.ay = 20 * sin(0.0191 * t + 0.6) + 7 * sin(0.0663 * t + 3.3);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const d = cl(dt || 0, 0, 0.1);
  const kn = input.knobValues || [0, 2, 5, 0.06];
  S.hue = cl(kn[0], 0, 1);
  S.drift = cl(kn[1], 0, 3);
  S.blades = cl(kn[2], 5, 9);
  S.glare = cl((cl(kn[3], -1, 1) + 1) / 2, 0, 1);
  S.t += d;
  S.tau += d * 0.75 * S.drift;
  pose(S);
}

// signed distance in LEDs to a regular n-gon with rounded corners and bowed edges,
// ap the apothem, rc the corner radius, rot the angle of one edge's normal
function polySd(dx, dy, rot, n, ap, rc, bulge) {
  const sec = TAU / n;
  const rho = sqrt(dx * dx + dy * dy);
  let ph = atan2(dy, dx) - rot;
  ph -= sec * floor(ph / sec + 0.5);
  const a2 = ap - rc;
  const h2 = a2 * TANS[n];
  const u = rho * sin(abs(ph));
  const v = rho * cos(ph) - a2;
  let sd;
  if (v <= 0) sd = v - rc;
  else {
    const du = u > h2 ? u - h2 : 0;
    sd = sqrt(du * du + v * v) - rc;
  }
  const hl = ap * TANS[n];
  if (u < hl) {
    const q = u / hl;
    sd -= bulge * ap * (1 - q * q);
  }
  return sd;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const acc = S.acc;
  const tmp = S.tmp;
  const g = S.glare;
  const t = S.t;

  // ---- colours ----
  const src = S.src;
  tint(((((SRC_HUE + S.lh) / 360 + S.hue) % 1) + 1) % 1, 0.9, 0.11, tmp);
  src[0] = tmp[0];
  src[1] = tmp[1];
  src[2] = tmp[2];
  const vc = S.vc;
  tint(((((SRC_HUE + S.lh) / 360 + S.hue) % 1) + 1) % 1, 0.74, 0.09, tmp);
  vc[0] = tmp[0];
  vc[1] = tmp[1];
  vc[2] = tmp[2];
  for (let k = 0; k < NG; k++) {
    const G = GHOSTS[k];
    // each ghost's tint wanders about 45 degrees either side of its own, on its own period
    const dh = 45 * sin(G.w * 0.31 * t + G.p * 1.7);
    tint(((((G.hue + dh) / 360 + S.hue) % 1) + 1) % 1, G.L, G.C, tmp);
    const c = S.gcol[k];
    // a floor under each channel keeps the rainbow rim alive on a deep tint
    c[0] = 0.2 + 0.8 * tmp[0];
    c[1] = 0.2 + 0.8 * tmp[1];
    c[2] = 0.2 + 0.8 * tmp[2];
  }

  // ---- the aperture: two neighbouring blade counts and how much of the second ----
  const bl = S.blades;
  const nA = min(8, floor(bl));
  const nB = nA + 1;
  const wB = sm(0.32, 0.68, bl - nA);
  const alpha = S.alpha;

  // ---- veil of glare: brighter the nearer the light is to the centre ----
  const s1x = S.x1;
  const s1y = S.y1;
  const s2x = S.x2;
  const s2y = S.y2;
  const w2 = S.w2;
  const near1 = exp(-((s1x / 40) * (s1x / 40) + (s1y / 70) * (s1y / 70)) * 1.6);
  const near2 = exp(-((s2x / 40) * (s2x / 40) + (s2y / 70) * (s2y / 70)) * 1.6);
  const veil = (0.0025 + 0.018 * g * g) * (0.5 + 0.5 * (near1 + 0.3 * w2 * near2));
  const x1 = CX + s1x;
  const y1 = CY + s1y;
  const x2 = CX + s2x;
  const y2 = CY + s2y;
  {
    let o = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        // a little brighter on the side the light is on
        const dd1 = ((x - x1) * (x - x1) + (y - y1) * (y - y1)) / 2600;
        const v = veil * (0.55 + 0.9 * exp(-dd1));
        acc[o] = v * vc[0];
        acc[o + 1] = v * vc[1];
        acc[o + 2] = v * vc[2];
        o += 3;
      }
    }
  }

  // ---- the lights: bloom, spikes, ring, streak ----
  const vis1 = (1 - sm(8, 44, outside(s1x, s1y))) * S.ex;
  lightPass(S, acc, x1, y1, 1.0 * vis1, nA, nB, wB, alpha, g, t, 1);
  if (w2 > 0.01) {
    const vis2 = (1 - sm(8, 44, outside(s2x, s2y))) * S.ex;
    lightPass(S, acc, x2, y2, 0.55 * w2 * vis2, nA, nB, wB, alpha, g, t, 2);
  }

  // ---- ghosts ----
  ghostPass(S, acc, s1x, s1y, vis1, nA, nB, wB, alpha, g, t, 0);
  if (w2 > 0.01) ghostPass(S, acc, s2x, s2y, 0.55 * w2 * (1 - sm(8, 44, outside(s2x, s2y))) * S.ex, nA, nB, wB, alpha, g, t, 1);

  // ---- out ----
  const sc = NLUT / 2.5;
  let i = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = ENC[min(NLUT, (acc[i] * sc) | 0)];
      const gg = ENC[min(NLUT, (acc[i + 1] * sc) | 0)];
      const b = ENC[min(NLUT, (acc[i + 2] * sc) | 0)];
      display.setPixel(x, y, r, gg, b);
      i += 3;
    }
  }
}

// how far a light at (sx, sy) from the centre stands outside the frame, in LEDs
function outside(sx, sy) {
  const ox = max(abs(sx) - 32, 0);
  const oy = max(abs(sy) - 64, 0);
  return sqrt(ox * ox + oy * oy);
}

// bloom, diffraction spikes, the dispersing ring and the streak of one light
function lightPass(S, acc, lx, ly, amp, nA, nB, wB, alpha, g, t, id) {
  if (amp < 0.01) return;
  const src = S.src;
  const sA = SPK[nA];
  const sB = SPK[nB];
  const nsA = nA % 2 ? 2 * nA : nA;
  const nsB = nB % 2 ? 2 * nB : nB;
  const dA = TAU / nsA;
  const dB = TAU / nsB;
  const wA = 1 - wB;
  const Ls = (14 + 42 * g) * (id === 2 ? 0.62 : 1); // spike length in LEDs
  const spA = amp * (0.95 + 0.4 * g) * (0.92 + 0.08 * sin(0.7 * t + id));
  const sig = 0.95;
  const inv2s = 1 / (2 * sig * sig);
  const wideA = 0.022 * (0.35 + g);
  // the ring: three radii, red inside and blue outside, the way a prism lays it out
  const ringA = amp * 0.55 * g * g * (0.4 + 0.6 * g);
  const rr0 = HALO_R * 0.95;
  const rr1 = HALO_R;
  const rr2 = HALO_R * 1.05;
  const ringW = 1.5;
  const inv2r = 1 / (2 * ringW * ringW);
  // the streak
  const stA = amp * (0.24 + 0.44 * g);
  const stL = 12 + 34 * g;
  const stS = 1.0;
  const inv2t = 1 / (2 * stS * stS);
  const LR = [0.97, 1.0, 1.06]; // the spike is a little longer in blue than in red
  const cr = src[0];
  const cg = src[1];
  const cb = src[2];
  let o = 0;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - ly;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - lx;
      const r2 = dx * dx + dy * dy;
      const r = sqrt(r2);
      // bloom: a white core and two tinted shoulders
      const q0 = 1 + r2 / 1.3;
      const q1 = 1 + r2 / 16;
      const q2 = 1 + r2 / 190;
      const core = (2.3 * amp) / (q0 * sqrt(q0));
      const mid = (0.22 * amp) / (q1 * sqrt(q1));
      const wide = wideA * amp / (q2 * sqrt(q2));
      let R = core + (mid + wide) * (0.72 + 0.28 * cr);
      let G = core + (mid + wide) * (0.72 + 0.28 * cg) * 0.97;
      let B = core + (mid + wide) * (0.72 + 0.28 * cb) * 0.9;
      // spikes
      if (r > 0.8 && r < Ls * 1.9) {
        const ang = atan2(dy, dx);
        let sp0 = 0;
        let sp1 = 0;
        let sp2 = 0;
        for (let pass = 0; pass < 2; pass++) {
          const wt = pass === 0 ? wA : wB;
          if (wt < 0.01) continue;
          const dl = pass === 0 ? dA : dB;
          const ns = pass === 0 ? nsA : nsB;
          const tab = pass === 0 ? sA : sB;
          const u = (ang - alpha) / dl;
          const j = round(u);
          const fr = u - j;
          for (let side = 0; side < 2; side++) {
            const dd = side === 0 ? abs(fr) * dl : dl - abs(fr) * dl;
            const jj = side === 0 ? j : j + (fr > 0 ? 1 : -1);
            const perp = r * sin(dd < 1.5 ? dd : 1.5);
            const gw = perp * perp * inv2s;
            if (gw > 6) continue;
            const idx = ((jj % ns) + ns) % ns;
            const len = Ls * tab[idx];
            const f = wt * SPKGAIN[ns] * (exp(-gw) + 0.06 * exp(-gw / 9));
            sp0 += f * exp(-r / (0.5 * len * LR[0])) * (1 - sm(len * LR[0], 1.7 * len * LR[0], r));
            sp1 += f * exp(-r / (0.5 * len * LR[1])) * (1 - sm(len * LR[1], 1.7 * len * LR[1], r));
            sp2 += f * exp(-r / (0.5 * len * LR[2])) * (1 - sm(len * LR[2], 1.7 * len * LR[2], r));
          }
        }
        // fade the spike in over the first LEDs so it grows out of the core
        const ff = sm(1.5, 6, r) * spA;
        R += sp0 * ff * (0.5 * cr + 0.45);
        G += sp1 * ff * (0.5 * cg + 0.45);
        B += sp2 * ff * (0.5 * cb + 0.47);
      }
      // ring
      if (ringA > 0.004 && abs(r - HALO_R) < 9) {
        const d0 = r - rr0;
        const d1 = r - rr1;
        const d2 = r - rr2;
        // brighter on the side that looks toward the frame centre
        const ca = (-lx + CX) * dx + (-ly + CY) * dy;
        const nrm = sqrt((CX - lx) * (CX - lx) + (CY - ly) * (CY - ly)) * r + 1e-3;
        const face = 0.55 + 0.45 * (ca / nrm);
        const ra = ringA * face;
        R += ra * exp(-d0 * d0 * inv2r) * 1.0;
        G += ra * exp(-d1 * d1 * inv2r) * 0.8;
        B += ra * exp(-d2 * d2 * inv2r) * 1.0;
      }
      // streak
      if (abs(dy) < 6) {
        const e = exp(-dy * dy * inv2t);
        const f = stA * e * (exp(-abs(dx) / stL) * 0.8 + 0.2 * exp(-abs(dx) / (stL * 2.5)));
        R += f * 0.5;
        G += f * 0.72;
        B += f * 1.0;
      }
      acc[o] += R;
      acc[o + 1] += G;
      acc[o + 2] += B;
      o += 3;
    }
  }
}

// the ghosts of one light
function ghostPass(S, acc, px, py, amp, nA, nB, wB, alpha, g, t, id) {
  if (amp < 0.01) return;
  // the light's offset from the lens's own centre, which sits a little off the frame's
  const sx = px - S.ax;
  const sy = py - S.ay;
  const rho = sqrt((sx / 32) * (sx / 32) + (sy / 64) * (sy / 64));
  // ghosts bunch near the centre; hold them back a little when they do
  const crowd = 0.72 + 0.28 * sm(0.25, 0.9, rho);
  for (let k = 0; k < NG; k++) {
    const G = GHOSTS[k];
    const mm = G.m * S.kz;
    const gx = CX + S.ax + mm * sx;
    const gy = CY + S.ay + mm * sy;
    // the aperture image grows a little as the light goes out toward the edge
    const R = G.R * (0.9 + 0.2 * rho) * (1 + 0.05 * sin(G.w * 1.9 * t + G.p)) * (1 + 0.2 * sin(G.w * 0.23 * t + G.p * 3.1));
    // dim toward the corners of the frame, the way a lens vignettes its ghosts
    const gdn = sqrt(((gx - CX) / 38) * ((gx - CX) / 38) + ((gy - CY) / 78) * ((gy - CY) / 78));
    const vig = 1 - 0.6 * sm(0.8, 1.5, gdn);
    // how squarely this reflection catches the light changes slowly, so a ghost fades out for a minute and comes back
    const env = 0.08 + 0.92 * sm(-1.3, -0.1, sin(G.w * 0.27 * t + G.p * 2.3 + id * 1.7));
    const b = G.b * amp * crowd * vig * env * (0.85 + 0.15 * sin(G.w * t + G.p));
    if (b < 0.02) continue;
    const reach = R * (1 + EPS[0]) + G.soft + 2.5 + abs(SHIFT * EPS[0] * mm * sqrt(sx * sx + sy * sy));
    if (gx + reach < 0 || gx - reach > W || gy + reach < 0 || gy - reach > H) continue;
    const kd = KIND[G.kind];
    const col = S.gcol[k];
    const rot = alpha + G.flip * PI;
    // each colour channel has its own centre, slid along the ghost line, and its own size
    const cxs = S.cxs;
    const cys = S.cys;
    for (let c = 0; c < 3; c++) {
      cxs[c] = gx + mm * sx * SHIFT * EPS[c];
      cys[c] = gy + mm * sy * SHIFT * EPS[c];
    }
    const vv = S.vv;
    // lumps inside: slow, large, a fixed pattern in the ghost's own frame
    const lx1 = 0.31 + 0.1 * hash(k + 1);
    const lx2 = 0.27 + 0.1 * hash(k + 9);
    const x0 = max(0, floor(gx - reach));
    const x1 = min(W - 1, floor(gx + reach));
    const y0 = max(0, floor(gy - reach));
    const y1 = min(H - 1, floor(gy + reach));
    const bulge = 0.03;
    const wsd = kd[3] * (R / 8);
    const soft = G.soft;
    // direction of the frame centre as seen from this ghost, for the gradient across it
    const toCx = -mm * sx;
    const toCy = -mm * sy;
    const tcl = sqrt(toCx * toCx + toCy * toCy) + 1e-3;
    const gdx = toCx / tcl;
    const gdy = toCy / tcl;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let any = false;
        vv[0] = 0;
        vv[1] = 0;
        vv[2] = 0;
        for (let c = 0; c < 3; c++) {
          const dx = x + 0.5 - cxs[c];
          const dy = y + 0.5 - cys[c];
          const Rc = R * (1 + EPS[c]);
          let sd;
          const rc = 0.13 * Rc;
          if (wB < 0.005) sd = polySd(dx, dy, rot, nA, Rc * cos(PI / nA), rc, bulge);
          else if (wB > 0.995) sd = polySd(dx, dy, rot, nB, Rc * cos(PI / nB), rc, bulge);
          else {
            const sa = polySd(dx, dy, rot, nA, Rc * cos(PI / nA), rc, bulge);
            const sb = polySd(dx, dy, rot, nB, Rc * cos(PI / nB), rc, bulge);
            sd = sa + (sb - sa) * wB;
          }
          if (sd > soft + 0.2) continue;
          const e = sd <= -soft ? 1 : sm(soft, -soft, sd);
          const depth = cl(-sd / (Rc * 0.85), 0, 1);
          const rg = (sd + 0.5 * wsd) / (0.42 * wsd);
          const rim = exp(-0.5 * rg * rg);
          const lump = 1 + 0.16 * sin(lx1 * dx + G.p) * sin(lx2 * dy + 2 * G.p);
          const grad = 1 + 0.26 * ((dx * gdx + dy * gdy) / Rc);
          let v = e * (kd[0] + kd[1] * depth * depth) * lump + kd[2] * rim * e;
          v *= grad;
          vv[c] = v;
          any = true;
        }
        if (!any) continue;
        const o = (y * W + x) * 3;
        acc[o] += b * col[0] * vv[0];
        acc[o + 1] += b * col[1] * vv[1];
        acc[o + 2] += b * col[2] * vv[2];
      }
    }
  }
}
