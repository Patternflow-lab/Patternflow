// ===== Patternflow pattern =====
// Title:   Hydraulic Jump
// Family:  hydraulics
// Idea:    The bottom of a kitchen sink seen from above: a tap's jet lands at one point and spreads as a thin dark film that deepens at a sharp white ring, the hydraulic jump, whose outline slowly turns from a circle into a rounded triangle, square, pentagon or hexagon and back, with ripples running out over thick steel-grey water that mirrors two soft warm lamps.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the circular hydraulic jump of a jet on a flat plate and the polygonal rings it can take (Ellegaard et al., "Creating corners in kitchen sinks", Nature 1998); pattern round 210
// Round:   210
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..3.5, Corners=0..7, Ripple=-1..1
//
// Knob 1: Hue. Tints the whole scene round the wheel. At 0 the steel is a neutral grey with a faint cool cast and the lamps are warm white; at 0.25 the steel goes rose, at 0.5 brass, at 0.75 green; at 1 it is back where it began. The foam of the ring and the jet stay near white, the lamps near warm white.
// Knob 2: Flow. How hard the tap runs, and so how far out the jump stands. At 0.5 the ring has a mean radius of 13 LEDs and sits small in a lot of calm steel; at the opening 2 it is 24; at 3.5 it is 40 and runs off the left and right edges. The crest widens from about 3 to 4 LEDs, the film's streaks harden, and the fine ripples run out from the jet at 5 LEDs a second at 0.5 and 20 at 3.5. On top of the knob the radius breathes up to about 17 per cent, on periods from half a minute to six.
// Knob 3: Corners. A wheel of shapes, 0 to 7, that ends where it began. At the opening 0 the ring is a rounded pentagon; 1 is a hexagon, 2 a heptagon, 3 an octagon, 4 a circle, 5 a triangle, 6 a square and 7 the pentagon again. Between two stops one shape melts into the next over the middle third of the turn, the ring going soft and nearly round on the way. The ring also goes round and back on its own: its corners swell and sink over a minute or two, it turns slowly and sometimes stands still or backs up, and now and then it takes the shape a step either side of the knob for a while.
// Knob 4: Ripple. How rough the water is. At -1 it is nearly flat: the lamps are clean, bright soft blobs and the rings running out of the jump are faint. At the opening 0.06 the rings are clearly there, 7 and 11 LEDs from crest to crest, and bend each lamp into a wobbling blob. At 1 the rings are strong, the whole sheet chops, and each lamp is torn into dimmer arcs.

const W = 64;
const H = 128;
const { sin, cos, sqrt, exp, floor, min, abs, atan2, PI } = Math;
const TAU = 2 * PI;
const HALF_PI = PI / 2;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const CX = 32; // where the jet lands
const CY = 60;
const NT = 720; // entries in the ring-radius table round one turn
const T0 = 28;
const WHEEL = [5, 6, 7, 8, 9, 3, 4]; // corners at each whole step of Corners; 9 is the circle // where on its slow clock the sink stands when the Lab starts
const HUE0 = 228; // degrees, a cool grey at Hue 0

// ---- the steel ----
// the two lamps: x, y, sigma in LEDs, strength
const LAMPS = [
  [10, 15, 4.6, 0.8],
  [54, 111, 3.8, 0.58],
];

// encode: a soft knee above 0.85 so the white of the ring and the lamps never clips hard
const NLUT = 1024;
const ENC = new Uint8Array(NLUT + 1);
for (let i = 0; i <= NLUT; i++) {
  const x = (i / NLUT) * 2;
  const y = x < 0.85 ? x : 0.85 + 0.15 * (1 - exp(-(x - 0.85) / 0.15));
  ENC[i] = Math.round(255 * y);
}
const SC = NLUT / 2;

// ---- the ring ----
// A rounded n-gon's distance from its centre along a ray, scaled so its mean over a
// turn is 1, with a corner at angle 0. Built from the polygon shrunk by the corner
// radius rc, so each corner is an arc of that radius and each side a straight run.
const KAPPA = [0, 0, 0, 0.36, 0.31, 0.28, 0.26, 0.24, 0.23];
// the real polygons are rounder than a regular one; the higher counts are pushed out
// of true so a corner still stands out of the circle at LED scale
const GAIN = [0, 0, 0, 0.92, 1.0, 1.12, 1.25, 1.4, 1.55, 0];
const POLY = [];
function buildPoly(n) {
  const arr = new Float32Array(NT + 2);
  const a = 1;
  const rc = KAPPA[n] * a;
  const a2 = a - rc;
  const sec = TAU / n;
  const tn = Math.tan(PI / n);
  const cr2 = a2 / cos(PI / n);
  let sum = 0;
  for (let i = 0; i < NT + 2; i++) {
    const psi = (i / NT) * TAU;
    const pp = psi - sec * floor(psi / sec) - sec / 2;
    let r;
    if (a * abs(Math.tan(pp)) <= a2 * tn) r = a / cos(pp);
    else {
      const b = cr2 * cos(PI / n - abs(pp));
      const disc = rc * rc - (cr2 * cr2 - b * b);
      r = b + sqrt(disc > 0 ? disc : 0);
    }
    arr[i] = r;
    if (i < NT) sum += r;
  }
  const k = NT / sum;
  for (let i = 0; i < NT + 2; i++) arr[i] *= k;
  return arr;
}
for (let n = 3; n <= 8; n++) POLY[n] = buildPoly(n);
POLY[9] = new Float32Array(NT + 2).fill(1);

// the three slow angular patterns round the film and the crest: whole numbers so they close
const STREAK_K = [6, 11, 17];
const TURB_K = [5, 9, 15];

export function setup(params) {
  const S = {
    t: T0,
    init: false,
    hue: 0,
    flow: 2,
    corners: 0,
    ripple: 0.53,
    q: 0.5, // the flow, smoothed
    // derived each frame by pose()
    r0: 26,
    ee: 1,
    pos: 0,
    phi: 0,
    // phases that run at the speed of the water, kept so a knob turn never jumps them
    pc: 0,
    pr1: 0,
    pr2: 0,
    pa1: 0,
    pa2: 0,
    Rt: new Float32Array(NT + 2),
    Rpt: new Float32Array(NT + 2),
  };
  params.s = S;
  // per-pixel things that never change
  const n = W * H;
  S.pr = new Float32Array(n);
  S.pa = new Float32Array(n);
  S.pcos = new Float32Array(n);
  S.psin = new Float32Array(n);
  S.pool = new Float32Array(n);
  let o = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX;
      const dy = y + 0.5 - CY;
      const r = sqrt(dx * dx + dy * dy);
      S.pr[o] = r;
      S.pa[o] = atan2(dy, dx);
      S.pcos[o] = r > 1e-3 ? dx / r : 1;
      S.psin[o] = r > 1e-3 ? dy / r : 0;
      // the broad sheen the lamps lay on the steel
      let pool = 0;
      for (const L of LAMPS) {
        const ex = x + 0.5 - L[0];
        const ey = y + 0.5 - L[1];
        pool += L[3] * exp(-(ex * ex + ey * ey) / (2 * 24 * 24));
      }
      S.pool[o] = pool;
      o++;
    }
  }
  pose(S, 0);
}

// the slow life of the sink at the state's clock
function pose(S, dt) {
  const t = S.t;
  const q = S.q;
  // the flow breathes: a few per cent on periods that do not divide
  const fw = 1 + 0.065 * sin(0.0431 * t + 0.6) + 0.045 * sin(0.0897 * t + 2.4) + 0.035 * sin(0.0173 * t + 4.1) + 0.025 * sin(0.2011 * t + 1.7);
  S.r0 = (13 + 27 * Math.pow(q, 1.25)) * fw;
  // how many corners it takes, now and then one more or one less than the knob says
  const X = 0.62 * sin(0.0161 * t + 2.2) + 0.44 * sin(0.0293 * t + 0.4) + 0.3 * sin(0.0071 * t + 4.4);
  const ax = abs(X);
  const stair = floor(ax) + sm(0.35, 0.65, ax - floor(ax));
  let pos = (S.corners + (X < 0 ? -stair : stair)) % 7;
  if (pos < 0) pos += 7;
  S.pos = pos;
  const kk = floor(pos);
  const nA = WHEEL[kk];
  const nB = WHEEL[(kk + 1) % 7];
  const wf = pos - kk;
  // the corners swell and sink over a minute or two, never quite to nothing
  const s1 = sin(0.0537 * t + 1.1) + 0.6 * sin(0.0291 * t + 4.4) + 0.4 * sin(0.0817 * t + 0.2);
  const swell = 0.14 + 0.86 * sm(-1.9, -0.2, s1);
  // and soften between two counts, where the shape is neither
  const crisp = 0.4 + 0.6 * Math.pow(0.5 + 0.5 * cos(TAU * wf), 0.8);
  S.ee = swell * crisp;
  // the polygon turns: slowly, now one way, now the other, sometimes standing still
  S.phi = -0.88 + 1.3 * sin(0.0413 * t + 0.7) + 0.9 * sin(0.0197 * t + 2.1) + 0.5 * sin(0.0097 * t + 5.0) + 0.5 * sin(0.0731 * t + 3.3) + 0.012 * t;
  // phases at the speed of the water
  if (dt > 0) {
    const f = S.q;
    S.pc = (S.pc + dt * (5.9 + 18 * f)) % TAU; // fine ripples in the film: 1.185 rad a LED
    S.pr1 = (S.pr1 + dt * (3.2 + 1.6 * f)) % TAU;
    S.pr2 = (S.pr2 + dt * (1.6 + 0.9 * f)) % TAU;
    S.pa1 = (S.pa1 + dt * 0.8) % TAU;
    S.pa2 = (S.pa2 + dt * 1.1) % TAU;
  }
  // the ring radius round one turn, in the polygon's own frame
  const w = sm(0.32, 0.68, wf);
  const fA = POLY[nA];
  const fB = POLY[nB];
  const gA = GAIN[nA] * (1 - w);
  const gB = GAIN[nB] * w;
  const e = S.ee;
  const r0 = S.r0;
  const Rt = S.Rt;
  for (let k = 0; k < NT + 2; k++) {
    const psi = (k / NT) * TAU;
    // a little wobble that is never the same twice
    const wob = 0.011 * sin(2 * psi + 0.21 * t) + 0.008 * sin(5 * psi - 0.33 * t + 1) + 0.006 * sin(9 * psi + 0.5 * t + 2);
    Rt[k] = r0 * (1 + e * (gA * (fA[k] - 1) + gB * (fB[k] - 1)) + wob);
  }
  const Rpt = S.Rpt;
  const sc = NT / TAU;
  for (let k = 1; k < NT + 1; k++) Rpt[k] = (Rt[k + 1] - Rt[k - 1]) * 0.5 * sc;
  Rpt[0] = Rpt[NT];
  Rpt[NT + 1] = Rpt[1];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const d = cl(dt || 0, 0, 0.1);
  const kn = input.knobValues || [0, 2, 0, 0.06];
  S.hue = cl(kn[0], 0, 1);
  S.flow = cl(kn[1], 0.5, 3.5);
  S.corners = cl(kn[2], 0, 7);
  S.ripple = (cl(kn[3], -1, 1) + 1) / 2;
  const target = (S.flow - 0.5) / 3;
  if (!S.init) {
    S.q = target;
    S.init = true;
  } else {
    S.q += (target - S.q) * (1 - exp(-d / 0.18));
  }
  S.t += d;
  pose(S, d);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const t = S.t;
  const q = S.q;
  const kr = S.ripple;
  const Rt = S.Rt;
  const Rpt = S.Rpt;
  const phi = S.phi;
  const uk = NT / TAU;
  const uShift = HALF_PI - phi;

  // ---- colour: the steel's tint, the warm white of the lamps ----
  // a hue vector that adds nothing to the brightness, so every hue is as light as the grey
  const hh = (HUE0 + 360 * S.hue) * (PI / 180);
  const sat = 0.055 + 0.13 * Math.pow(sin(PI * S.hue), 2);
  const sR = 1 + sat * cos(hh);
  const sG = 1 + sat * cos(hh - 2.0944);
  const sB = 1 + sat * cos(hh + 2.0944);
  // the white of the lamps and the foam keeps a share of the steel's tint
  const wR = 0.8 + 0.2 * sR;
  const wG = 0.67 + 0.2 * sG;
  const wB = 0.5 + 0.2 * sB;
  // the foam of the jump and the jet are plain white, a touch cool
  const fR = 0.9 + 0.1 * sR;
  const fG = 0.93 + 0.1 * sG;
  const fB = 1 + 0.1 * sB;

  // ---- the water ----
  const jetS = 1.15 + 0.6 * q; // sigma of the jet's bright core, LEDs
  const crestIn = 0.7 + 0.3 * q; // crest sigma on the jet side
  const crestOut0 = 1.0 + 0.4 * q; // and on the far side, before turbulence feathers it
  const stK = 0.03 + 0.03 * q; // contrast of the radial streaks in the film
  const capA = (0.02 + 0.016 * q) * (0.5 + kr); // the film's fine ripples
  const rA1 = 0.004 + 0.14 * kr; // the rings running out of the jump, in brightness
  const rA2 = 0.003 + 0.085 * kr;
  const dA1 = 0.3 + 4.8 * kr; // and in how far they push a lamp's reflection, LEDs
  const dA2 = 0.2 + 3 * kr;
  const aA = 0.3 + 2.4 * kr;
  const chop = 0.05 * kr; // and how much the chop lightens and darkens the steel // the little ambient chop
  // the lamps swell and dim a little, and the whole sheet of water sways under them
  const mirror = 1.3 - 0.5 * kr; // calm water holds a lamp's light in one place, rough water spreads it
  const lampPulse1 = mirror * (1 + 0.2 * sin(0.0713 * t + 0.4) + 0.1 * sin(0.173 * t + 1.1));
  const lampPulse2 = mirror * (1 + 0.2 * sin(0.0531 * t + 5.54) + 0.1 * sin(0.131 * t + 0.3));
  const sw1x = 3.5 * sin(0.0811 * t + 1) + 2 * sin(0.0337 * t + 2.2);
  const sw1y = 4 * sin(0.0613 * t + 4) + 2.5 * sin(0.0239 * t + 0.4);
  const sw2x = 3.5 * sin(0.0711 * t + 3) + 2 * sin(0.0297 * t + 5.2);
  const sw2y = 4 * sin(0.0517 * t + 0.7) + 2.5 * sin(0.0269 * t + 1.9);
  const pc = S.pc;
  const pr1 = S.pr1;
  const pr2 = S.pr2;
  const pa1 = S.pa1;
  const pa2 = S.pa2;
  // angular patterns, phase per time
  const stP0 = 0.047 * t + 0.4;
  const stP1 = -0.039 * t + 1.7;
  const stP2 = 0.061 * t + 3.1;
  const tuP0 = 0.31 * t;
  const tuP1 = -0.23 * t + 1.3;
  const tuP2 = 0.43 * t + 2.6;
  const L0 = LAMPS[0];
  const L1 = LAMPS[1];
  const is0 = 1 / (2 * L0[2] * L0[2]);
  const is1 = 1 / (2 * L1[2] * L1[2]);
  const ih0 = 1 / (2 * 2.5 * L0[2] * 2.5 * L0[2]);
  const ih1 = 1 / (2 * 2.5 * L1[2] * 2.5 * L1[2]);
  const reach0 = 3.4 * L0[2]; // beyond this the core of a lamp is nothing
  const reach1 = 3.4 * L1[2];
  const ar0 = reach0 * reach0;
  const ar1 = reach1 * reach1;
  const pr = S.pr;
  const pa = S.pa;
  const pcos = S.pcos;
  const psin = S.psin;
  const pool = S.pool;

  let o = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++, o++) {
      const r = pr[o];
      const th = pa[o];
      const ca = pcos[o];
      const sa = psin[o];
      // the ring's radius along this ray, and how steep it is there
      let u = (th + uShift) * uk;
      u -= NT * floor(u / NT);
      const i0 = u | 0;
      const fr = u - i0;
      const Rr = Rt[i0] + (Rt[i0 + 1] - Rt[i0]) * fr;
      const Rp = Rpt[i0] + (Rpt[i0 + 1] - Rpt[i0]) * fr;
      const sl = Rp / (r + 1);
      // d: LEDs from the jump along its normal, negative on the jet's side
      const d = (r - Rr) / sqrt(1 + sl * sl);

      let bd; // the steel's own brightness
      let sp = 0; // the lamps' warm white laid on top
      let sf = 0; // and the plain white of the jet and the foam
      let dispX = 0;
      let dispY = 0;
      let lampK = 1; // how much of a lamp's reflection this water shows

      if (d < 0) {
        // ---- the thin film ----
        // slightly lighter right at the jet, darker out where it is thinnest, rising to the jump
        bd = 0.225 + 0.1 * exp(-r / 7) + 0.1 * sm(-10, -0.5, d);
        const env = sm(4, 13, r) * (1 - sm(-3, 1.5, d));
        if (env > 0.01) {
          // faint radial streaks
          const th1 =
            sin(STREAK_K[0] * th + stP0) * (0.5 + 0.5 * sin(0.23 * r + 0.8)) +
            sin(STREAK_K[1] * th + stP1) * (0.5 + 0.5 * sin(0.19 * r + 2.9)) * 0.8 +
            sin(STREAK_K[2] * th + stP2) * (0.5 + 0.5 * sin(0.29 * r + 5.0)) * 0.6;
          bd += stK * 0.6 * th1 * env;
          // the fine ripples that run out from the jet, bent a little off round
          const ph = 1.185 * r - pc + 1.4 * sin(3 * th + 0.07 * t) + 0.9 * sin(5 * th - 0.11 * t + 1.0);
          bd += capA * cos(ph) * env * (0.55 + 0.45 * sin(4 * th + 0.09 * t + 0.1 * r));
        }
        lampK = 0.45 + 0.55 * sm(-4, 3, d);
        // the jet itself
        const jc = exp(-(r * r) / (2 * jetS * jetS));
        if (jc > 0.005) sf += 0.85 * jc + 0.12 * exp(-(r * r) / (2 * 3.2 * 3.2 * jetS * jetS));
        // the ripples of the film push the reflection about a little
        const dd = 0.5 * sin(1.185 * r - pc) * env;
        dispX += ca * dd;
        dispY += sa * dd;
      } else {
        // ---- the thick water ----
        bd = 0.325 + 0.07 * exp(-d / 9) - 0.07 * sm(28, 100, r);
        // the rings that run out of the jump, taking its shape and growing rounder as they go
        const wobP = (0.9 * sin(3 * th + 0.17 * t + 1) + 0.6 * sin(5 * th - 0.21 * t)) * (0.5 + d * 0.04) + 0.8 * sin(0.21 * d + 2 * th + 0.05 * t);
        const on = sm(0, 4, d);
        const e1 = exp(-d / 25) * on;
        const e2 = exp(-d / 38) * on;
        const ph1 = 0.873 * d - pr1 + wobP;
        const ph2 = 0.576 * d - pr2 + 0.7 * wobP + 1.9;
        bd += rA1 * cos(ph1) * e1 + rA2 * cos(ph2) * e2;
        const dd = dA1 * sin(ph1) * e1 + dA2 * sin(ph2) * e2;
        dispX += ca * dd;
        dispY += sa * dd;
      }
      // the broad sheen of the lamps on the steel
      bd += 0.075 * pool[o];

      // ---- the crest ----
      if (d > -9 && d < 11) {
        const turb = 0.5 + 0.5 * (0.55 * sin(TURB_K[0] * th + tuP0) + 0.3 * sin(TURB_K[1] * th + tuP1) + 0.15 * sin(TURB_K[2] * th + tuP2));
        const so = crestOut0 + 1.5 * turb;
        const dc = d - 0.3;
        const sg = dc < 0 ? crestIn : so;
        const g = exp(-(dc * dc) / (2 * sg * sg));
        const body = 0.5 + 0.5 * turb;
        sf += 0.9 * g * body;
        // a hint of foam that trails out behind the crest
        if (d > 0) sf += 0.16 * turb * exp(-d / (3.2 + 2 * turb)) * sm(0, 2, d);
      }

      // ---- the lamps, as the ripples bend them ----
      // the chop that does not come from the jump
      const pp1 = 0.52 * (x * 0.765 + y * 0.644) - pa1;
      const pp2 = 0.71 * (-x * 0.666 + y * 0.746) - pa2;
      const s1 = sin(pp1);
      const s2 = sin(pp2);
      bd += chop * (0.6 * s1 + 0.4 * s2) * (lampK > 0.9 ? 1 : 0.5);
      const px = x + 0.5 + dispX + aA * (0.765 * s1 - 0.666 * s2 * 0.7);
      const py = y + 0.5 + dispY + aA * (0.644 * s1 + 0.746 * s2 * 0.7);
      let lamp = 0;
      {
        const ex = px - L0[0] - sw1x;
        const ey = py - L0[1] - sw1y;
        const e2 = ex * ex + ey * ey;
        lamp += L0[3] * lampPulse1 * (e2 < ar0 ? 0.85 * exp(-e2 * is0) : 0) + L0[3] * 0.28 * lampPulse1 * exp(-e2 * ih0);
      }
      {
        const ex = px - L1[0] - sw2x;
        const ey = py - L1[1] - sw2y;
        const e2 = ex * ex + ey * ey;
        lamp += L1[3] * lampPulse2 * (e2 < ar1 ? 0.85 * exp(-e2 * is1) : 0) + L1[3] * 0.28 * lampPulse2 * exp(-e2 * ih1);
      }
      sp += lamp * lampK;

      // ---- out ----
      const cR = bd * sR + sp * wR + sf * fR;
      const cG = bd * sG + sp * wG + sf * fG;
      const cB = bd * sB + sp * wB + sf * fB;
      display.setPixel(x, y, ENC[min(NLUT, (cR * SC) | 0)], ENC[min(NLUT, (cG * SC) | 0)], ENC[min(NLUT, (cB * SC) | 0)]);
    }
  }
}
