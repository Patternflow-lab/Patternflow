// ===== Patternflow pattern =====
// Title:   Tephra Fall
// Family:  tephra
// Idea:    A map of the ash a volcano has laid down, seen from above: eruptions of every size go off at uneven intervals while the wind slowly turns, coarse grains land near the vent and fine ones are carried downwind and spread wide, so each blast grows a long lobe over a few seconds, the rain washes the old lobes thin, and the sum is coloured in half-decade isopach bands from dusty cream through sulphur and coral to plum.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: isopach maps of tephra fall, thickness contoured at equal steps of its logarithm (standard in volcanology, from memory), the advection and diffusion model of ash falling out of a rising column, each grain carried by the wind while it falls and spread by turbulence into a Gaussian (Takeshi Suzuki, 1983, from memory), its form as one Gaussian for each grain size and release height, summed on the ground, as run in Tephra2 (Costanza Bonadonna, Charles Connor and colleagues, 2005, from memory), Suzuki's distribution of release along the column, original code, pattern round 275
// Round:   275
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Wind=1.6..3.5, Fineness=-1..1, Rain=-1..1
//
// Knob 1: Hue. Turns the thickness scale round the colour wheel, one turn over the range, by adding 360 x K1 degrees to the hue of every step in OKLCH with its lightness kept and its chroma pulled in by up to 30 percent at the half turn, so the pale steps do not go neon. At 0 the scale is as drawn: olive grey and tan dust, one thin line of mustard sulphur, then salmon, coral and a rose-magenta plum. At 0.25 it is grey-cyan with an ochre core, at 0.5 grey-blue with a green core, at 0.75 mauve with a blue core, and at 1 it is back. The ground, (36, 42, 50), does not turn.
// Knob 2: Wind. How far the wind carries the ash, from 1.6 to 3.5, opening at 2. A grain released at the height s of the column (a fraction of it, 0.1 to 0.9) falls for T = 0.85 H s / v, H the column height and v the grain's fall speed, and is carried 5 x Wind x T x u LEDs, u being the gust of the moment (a log-normal with a spread of 35 percent) and the wind aloft 1.4 times the wind at the ground and turned from it by up to 0.9 rad. For a column of height 1, a grain of speed 0.12 released at mid height lands about 28 LEDs from the vent at Wind 1.6, 34 at 2 and 51 at 3.5, one of speed 0.25 lands 14, 17 and 29 LEDs away. The floor of 1.6 is there so that the lobes stay long enough to point somewhere even with coarse grains: at 1 they came out as one round hill round the vent, which read as a target. Nothing is carried farther than 70 tanh(d / 70). At once, a turn stretches the whole map about the vent by (Wind / the Wind it was built under) ^ 0.45, 1.29 for a jump from 2 to 3.5 and 0.91 for one from 2 to 1.6, and the new eruptions take over as the built-under value follows over 14 s.
// Knob 3: Fineness. How fine the grains are, from -1 to 1, opening at 0. Every fall speed is multiplied by 1.5 ^ -K: at -1 every grain falls 1.5 times faster, lands 1.5 times nearer and has 1.5 times less time to spread; at 1 it is the other way. The mix leans the same way: the four finest of the seven classes carry 43 percent of the mass at -1, 64 at 0 and 82 at 1, before each eruption's own lean (0.6 of a normal deviate) on top. At once, the thickness of the three coarse classes is multiplied by 1.7 ^ -(K - the K it was built under) and that of the four fine ones by 1.7 ^ (K - the K it was built under), so a turn up thins the vent's pile and thickens the haze.
// Knob 4: Rain. How fast the rain takes the ash off, from -1 to 1, opening at 0.06. The thickness is multiplied by exp(-dt / tau) each frame, tau = 26 x 2 ^ (-0.8 K) seconds: 45 s at -1, 25 s at the opening, 15 s at 1. One contour, a factor of 3.16 in thickness, goes in 52, 29 or 17 s. Slow, and several lobes of different ages overlap into one wide hill; fast, and only the last eruption or two are left on the dusty ground. At once, the thickness is scaled by tau now over tau it was built under, so the whole map steps up a few contours or down at the turn and the new eruptions settle it.
//
// What the picture is. A plan view of the ground round one vent at column 32, row 56 of the 128 rows (56 rows above it, 72 below). Each LED shows how thick the ash is there and nothing else is drawn: no cone, no plume, no fire. The vent is only the thickest point. The thickness is a 64 by 128 field of floats that every eruption adds to and the rain takes from, and it is shown on a log scale: a band is a factor of sqrt(10) in thickness, the contour between two bands is a ramp 2.4 LEDs across (or no ramp where the bands are narrower than that and merge into a gradient), so no contour is thinner than 2 LEDs. Fifteen colours carry the scale: the ground (36, 42, 50), three faint tints of dust a quarter, a half and three quarters of the way from the ground to the first ash, and eleven colours of ash in OKLCH (lightness, chroma, hue). Seven are dull dusts from olive grey to tan: (0.40, 0.015, 80), (0.46, 0.02, 82), (0.52, 0.025, 84), (0.59, 0.03, 88), (0.67, 0.04, 91), (0.75, 0.05, 94) and (0.82, 0.06, 96). The bright, saturated ones are the thick ones: salmon (0.80, 0.10, 40), coral (0.72, 0.14, 18), rose (0.64, 0.16, 355) and plum (0.55, 0.17, 335). The dust takes about two thirds of the cells and the four thick colours the rest. The only yellow is a seam of mustard sulphur, (0.84, 0.10, 102), laid along the one contour between the last dust and the salmon, 2.4 LEDs wide like every contour. The panel raises saturation by 1.62, so a yellow drawn broad here comes out as a neon on the LEDs. Each band is its own colour at its thick edge and gets darker toward its thin edge, by up to 80 percent in the dust and the middle steps, 32 percent in the thickest and 28 in the faint tints, so the brightness steps at every contour and nothing is brighter than the scale. The mean brightness is 99 to 115 of 255 over the five places the study measures.
// The model. Suzuki's way, as Tephra2 writes it. One eruption has a mass M, a column height H, a wind and a grain mix. Seven grain classes fall at speeds 1, 0.5, 0.25, 0.12, 0.06, 0.03 and 0.012 and carry 4, 10, 22, 26, 20, 13 and 5 percent of the mass; the mass is released at five heights, 0.1, 0.3, 0.5, 0.7 and 0.9 of the column, in the proportions of Suzuki's curve [(1 - s) exp(3 (s - 1))] ^ 3, 5, 14, 31, 41 and 9 percent. That is 35 layers. A layer falls for T, is carried by the wind to a point d from the vent and, spread by turbulence, lands as a Gaussian of mass M w_class w_height there, thickness M w / (2 pi sigma^2) exp(-r^2 / 2 sigma^2), with sigma^2 = (4.5 H + u)^2 + 3.2 T + (d / (10 s))^2. The u is an umbrella for the three finest classes, 16 s H^2 LEDs of sideways spread of the high release, and 0 for the rest, so the fine ash is wide enough to put a thin cover on the corners the lobes do not reach. The last term is there because the five heights are five points on a line, and left alone they came out as beads: each is smeared by half the spacing of the points. A Gaussian is separable, so a layer costs at most 192 exponentials and 8,192 multiply-adds, and a frame takes under a millisecond. The coarse grains land first and near, close to the vent within a second; the fine ones come up to 10 s later and far, and a layer is laid down over 0.5 + 0.3 x its delay seconds on a smoothstep, delay 0.5 + 0.35 T (3.5 + 0.12 (T - 10) beyond 10), so a lobe is seen to grow outward from the vent over a few seconds. The model's real fall times are far longer than that. The finest class would take 64 time units, and the compression is a drawing choice.
// The eruptions. The wait to the next one is a log-normal around 7 s, 7 exp(0.45 q) exp(0.75 N), q a quiet or busy spell (an Ornstein-Uhlenbeck walk, unit spread, 70 s memory), clipped to 1.2 to 26 s, and three times in ten it is a burst of 1.3 to 3.8 s instead. In 900 s that was 120 to 140 eruptions, with a median gap of 3.7 s and a 90th percentile of 14 to 26 s. The mass is M = exp(0.8 N) x (0.55 + 0.7 min(repose / 40 s, 1)), so a long pause is followed by a bigger blast, and the column height is H = 0.9 + 0.25 ln M, kept between 0.6 and 1.6. Each eruption draws its own grain mix and its own turn of the wind with height.
// The wind. Its direction turns with an angular speed that is itself a random walk (spread 0.2 rad/s, 80 s memory) plus a little diffusion, and about once in 100 s it swings by 0.9 to 2.2 rad one way or the other. Over 900 s the 45 degree sectors got between 73 and 162 s each of the 112 s an even spread would give, on six different runs, and the direction ended 0.7 to 11 turns, either way, from where it began, so the rose does not set into one petal. Each eruption takes the direction of its moment.
// The exposure. A scale that stayed put would saturate after a big blast and empty after a long pause, so the scale follows the map: its offset in bands puts the thickest point of the map at band 12.8, in the upper part of the band between the contours 12 and 13 so that the summit is a patch and not a dot. When the top climbs the scale gives way in 5 s, and when it falls it takes the slack back over 28 s, so in a pause the rain shows as the whole map thinning and the contours drawing in, instead of being scaled away. The log keeps the map from saturating, the exposure keeps the colours in use. A closed contour of 12 cells or fewer, a dot, showed in 2 percent of frames at the opening and at all-min and 7 percent at all-max (where the lobes are long arms with tips). What the knobs do at once (above) sits on top of it, and the exposure does not take the Rain rescale back.
// Set-up. The pattern runs six wash times of its own eruptions with the opening knobs before the first frame (40 to 240 s of model time in steps of 0.4 s), 150 s at the opening, so it opens on a map that is already built under those knobs. That takes 15 to 75 ms in the first update and under 1 ms in every frame after.
// What is exact and what is drawn. The Gaussian lobe of one grain class and one release height, its centre at the wind's displacement over the fall time and its width from the turbulent spread, and the sum of such lobes as the thickness, are Suzuki's model as Tephra2 uses it. A contour of equal thickness is an isopach. The grain classes and their shares, the release curve's exponent, the umbrella, the smear, the cap on the displacement, the compressed fall times, the eruption process, the wind process, the rain's wash time, the exposure and all of the colour are drawing choices. The thickness has no unit.

const W = 64, H = 128, NP = W * H;
const { floor, sqrt, exp, log, sin, cos, min, max, abs, pow, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

const VX = 32, VY = 56;            // the vent, in LEDs from the top left corner

// ---------------------------------------------------------------- the model
const NCLS = 7, NH = 5;            // grain classes, release heights
const VS = [1.0, 0.5, 0.25, 0.12, 0.06, 0.03, 0.012];   // fall speed of each class, relative (coarse first)
const WC = [0.04, 0.10, 0.22, 0.26, 0.20, 0.13, 0.05];   // share of the mass in each class
const TSC = 0.85;                  // fall time of a grain of speed 1 released at the top of a column of height 1
const UW = 5.0;                   // LEDs a second of wind for each unit of the Wind knob
const KD = 0.8;                    // eddy diffusivity: sigma^2 grows by 4 KD T
const DCAP = 70;                   // the wind drops with height, so no grain is carried farther than this, LEDs
const UMB = 16;                    // an umbrella cloud spreads the high, fine release sideways by this much, LEDs
const SIG0 = 4.5;                  // width of the column at its foot, LEDs
const STEP = 0.5 * log(10);        // one band is a factor of sqrt(10) in thickness
const OFF = 15.0;                  // band coordinate of a thickness of 1, before the exposure
const BTOP = 12.8;                 // the band the exposure holds the thickest point of the map at

const FC = new Float32Array(NP);   // thickness of the coarse grains (the three fastest classes)
const FF = new Float32Array(NP);   // thickness of the fine grains
const BD = new Float32Array(NP);   // band coordinate
const BZ = new Float32Array(NP);   // the same, stretched about the vent
const WK = new Float32Array(NH);   // Suzuki release weights
{
  let s = 0;
  for (let k = 0; k < NH; k++) {
    const z = (k + 0.5) / NH;
    WK[k] = pow((1 - z) * exp(3 * (z - 1)), 3);
    s += WK[k];
  }
  for (let k = 0; k < NH; k++) WK[k] /= s;
}

function gauss() {
  let u = 0;
  while (u === 0) u = Math.random();
  return sqrt(-2 * log(u)) * cos(TAU * Math.random());
}

let LAY = [];                      // lobes being laid down
let PEND = [];                     // grains still in the air

export function setup(params) {
  FC.fill(0);
  FF.fill(0);
  LAY = [];
  PEND = [];
  params.s = {
    t: 0, k: null,
    th: TAU * Math.random(), om: 0, lu: 0, q: 0, next: 2, lastE: -20,
    tauEff: 0, hue: -9, ex: 0, k2b: 2, k3b: 0,
  };
}

function erupt(S) {
  const rep = S.t - S.lastE;
  S.lastE = S.t;
  const M = exp(0.8 * gauss()) * (0.55 + 0.7 * min(rep / 40, 1));
  const hgt = cl(0.9 + 0.25 * log(M), 0.6, 1.6);
  const veer = (Math.random() * 2 - 1) * 0.9;
  const fv = pow(1.5, -S.k[2]);
  // each eruption has its own grain mix, coarse rich or fine rich, and the Fineness knob leans on it
  const gm = 0.6 * gauss() - 0.8 * S.k[2], wc = new Float32Array(NCLS);
  let ws = 0;
  for (let c = 0; c < NCLS; c++) ws += wc[c] = WC[c] * exp(-gm * (c - 3) * 0.45);
  for (let c = 0; c < NCLS; c++)
    for (let k = 0; k < NH; k++) {
      const s = (k + 0.5) / NH;
      const T = (TSC * hgt * s) / (VS[c] * fv);
      PEND.push({ te: S.t, at: S.t + 0.5 + (T < 10 ? 0.35 * T : 3.5 + 0.12 * (T - 10)), c, s, m: (M * wc[c] * WK[k]) / ws, th: S.th, veer, ug: exp(S.lu), hgt });
    }
}

function lay(S, p) {
  const fv = pow(1.5, -S.k[2]);
  const T = (TSC * p.hgt * p.s) / (VS[p.c] * fv);
  const u0x = p.ug * cos(p.th), u0y = p.ug * sin(p.th);
  const u1x = 1.4 * p.ug * cos(p.th + p.veer), u1y = 1.4 * p.ug * sin(p.th + p.veer);
  const w = UW * S.k[1] * T;
  let dx = w * (u0x + 0.5 * p.s * (u1x - u0x)), dy = w * (u0y + 0.5 * p.s * (u1y - u0y));
  const dl = sqrt(dx * dx + dy * dy);
  if (dl > 1e-6) {
    const sc = (DCAP * tanh(dl / DCAP)) / dl;
    dx *= sc;
    dy *= sc;
  }
  const s0 = SIG0 * p.hgt + (p.c >= 4 ? UMB * p.s * p.hgt * p.hgt : 0);
  // the five release heights are five points on a line: each is smeared by its spacing so the lobe does not come out as beads
  const sd = (0.5 * sqrt(dx * dx + dy * dy)) / (p.s * NH);
  const s2 = s0 * s0 + 4 * KD * T + sd * sd, sg = sqrt(s2);
  const px = VX + dx, py = VY + dy;
  const gx = new Float32Array(W), gy = new Float32Array(H);
  const r = 3.9 * sg;
  const i0 = max(0, floor(px - r)), i1 = min(W - 1, floor(px + r));
  const j0 = max(0, floor(py - r)), j1 = min(H - 1, floor(py + r));
  if (i0 > i1 || j0 > j1) return;
  const iv = 1 / (2 * s2);
  for (let i = i0; i <= i1; i++) gx[i] = exp(-(i + 0.5 - px) * (i + 0.5 - px) * iv);
  for (let j = j0; j <= j1; j++) gy[j] = exp(-(j + 0.5 - py) * (j + 0.5 - py) * iv);
  const dur = 0.5 + 0.3 * (p.at - p.te);
  LAY.push({ gx, gy, i0, i1, j0, j1, amp: p.m / (TAU * s2), a: S.t, dur, p: 0, F: p.c >= 3 ? FF : FC });
}

function step(S, dt) {
  const t = (S.t += dt);
  // wind: the angle turns with a persistent angular speed, now and then it swings
  S.om += -S.om * (dt / 80) + 0.2 * sqrt((2 * dt) / 80) * gauss();
  S.th += S.om * dt + 0.03 * sqrt(dt) * gauss();
  if (Math.random() < dt / 100) S.th += (Math.random() < 0.5 ? -1 : 1) * (0.9 + 1.3 * Math.random());
  S.lu += -S.lu * (dt / 60) + 0.35 * sqrt((2 * dt) / 60) * gauss();
  // eruptions: a quiet or busy spell, plus a little excitement left by the last one
  S.q += -S.q * (dt / 70) + sqrt((2 * dt) / 70) * gauss();
  if (t >= S.next) {
    erupt(S);
    // the wait to the next one: a log-normal around 7 s that stretches in a quiet spell and shrinks in a busy one, and three times in ten a short one, so they come in bursts
    let g = 7 * exp(0.45 * S.q) * exp(0.75 * gauss());
    if (Math.random() < 0.3) g = 1.3 + 2.5 * Math.random();
    S.next = t + cl(g, 1.2, 26);
  }
  // grains arriving
  for (let i = PEND.length - 1; i >= 0; i--)
    if (PEND[i].at <= t) {
      lay(S, PEND[i]);
      PEND.splice(i, 1);
    }
  // deposit
  for (let n = LAY.length - 1; n >= 0; n--) {
    const L = LAY[n];
    const p = sm(0, 1, (t - L.a) / L.dur);
    const inc = (p - L.p) * L.amp;
    L.p = p;
    if (inc > 0)
      for (let j = L.j0; j <= L.j1; j++) {
        const gy = L.gy[j] * inc, row = j * W;
        for (let i = L.i0; i <= L.i1; i++) L.F[row + i] += gy * L.gx[i];
      }
    if (t >= L.a + L.dur) LAY.splice(n, 1);
  }
  // rain
  const wash = exp(-dt / tauOf(S.k[3]));
  for (let i = 0; i < NP; i++) {
    FC[i] *= wash;
    FF[i] *= wash;
  }
}

const tauOf = (k) => 26 * pow(2, -0.8 * k);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
    // run six wash times of eruptions before the first frame, so the map opens already built under these knobs
    for (let i = 0, n = cl(floor((6 * tauOf(S.k[3])) / 0.4), 100, 600); i < n; i++) step(S, 0.4);
    S.tauEff = tauOf(S.k[3]);
    S.k2b = S.k[1];
    S.k3b = S.k[2];
    S.ex = exposure(S);
  } else {
    const al = 1 - exp(-d / 0.2);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  if (d > 0) step(S, d);
  // the knobs the map was built under catch up with the knobs now
  const tn = tauOf(S.k[3]);
  S.tauEff += ((tn - S.tauEff) * d) / tn;
  S.k2b += (S.k[1] - S.k2b) * (1 - exp(-d / 14));
  S.k3b += (S.k[2] - S.k3b) * (1 - exp(-d / 14));
  // the scale gives way fast when the top climbs and takes the slack back slowly, so the rain shows as the map thinning in a pause
  const et = exposure(S);
  S.ex += (et - S.ex) * (1 - exp(-d / (et < S.ex ? 5 : 28)));
}

// What turning a knob does at once, before the next eruption has laid anything: Fineness weighs the fine ash against the coarse by
// 1.7 to the power of how far the knob is from where the map was built, Wind stretches the map about the vent, Rain rescales the thickness
// by the ratio of the wash times, now and when it was built.
const LW = [1, 1];
function liveWeights(S) {
  const d = S.k[2] - S.k3b;
  LW[0] = pow(1.7, -d);
  LW[1] = pow(1.7, d);
}

// The exposure holds the thickest point of the map at band BTOP and follows over 40 s, so a big blast does not saturate the scale and a long pause
// does not empty it.
function exposure(S) {
  liveWeights(S);
  const w0 = LW[0], w1 = LW[1];
  let mx = 0;
  for (let i = 0; i < NP; i++) {
    const v = FC[i] * w0 + FF[i] * w1;
    if (v > mx) mx = v;
  }
  return cl(BTOP - (log(mx + 1e-12) / STEP + OFF), -8, 8);
}

// ---------------------------------------------------------------- colour
const NB = 14;
const NR = 11;                     // colours in the ramp proper; three more fade the ground in under it
const SAW = 0.8;
const COL = new Float32Array((NB + 2) * 3);
const GROUND = [36, 42, 50];
// L, C, hue in degrees: thin to thick
const RAMP = [
  [0.40, 0.015, 80], [0.46, 0.02, 82], [0.52, 0.025, 84], [0.59, 0.03, 88], [0.67, 0.04, 91], [0.75, 0.05, 94],
  [0.82, 0.06, 96], [0.80, 0.10, 40], [0.72, 0.14, 18], [0.64, 0.16, 355], [0.55, 0.17, 335],
];
const SEAMC = [0.84, 0.10, 102];     // mustard sulphur, laid along one contour only
const SEAM = 10;                     // the contour between the last dust and the first salmon
function oklch(L, C, h, o, k) {
  const a = C * cos(h * (PI / 180)), b = C * sin(h * (PI / 180));
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const ga = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055);
  o[k] = 255 * ga(r);
  o[k + 1] = 255 * ga(g);
  o[k + 2] = 255 * ga(bl);
}
function buildColors(hue) {
  const o = [0, 0, 0];
  COL[0] = GROUND[0]; COL[1] = GROUND[1]; COL[2] = GROUND[2];
  for (let n = 0; n < NR; n++) {
    const R = RAMP[n];
    let C = R[1] * (1 - 0.3 * sin(PI * hue) * sin(PI * hue));
    for (let it = 0; it < 8; it++) {
      oklch(R[0], C, R[2] + 360 * hue, o, 0);
      if (o[0] >= -0.5 && o[0] <= 255.5 && o[1] >= -0.5 && o[1] <= 255.5 && o[2] >= -0.5 && o[2] <= 255.5) break;
      C *= 0.85;
    }
    for (let q = 0; q < 3; q++) COL[(n + 4) * 3 + q] = cl(o[q], 0, 255);
  }
  oklch(SEAMC[0], SEAMC[1] * (1 - 0.3 * sin(PI * hue) * sin(PI * hue)), SEAMC[2] + 360 * hue, o, 0);
  for (let q = 0; q < 3; q++) COL[(NB + 1) * 3 + q] = cl(o[q], 0, 255);
  // the thinnest ash is a faint tint on the ground, in three steps
  for (let n = 1; n <= 3; n++) for (let q = 0; q < 3; q++) COL[n * 3 + q] = GROUND[q] + (COL[12 + q] - GROUND[q]) * (n / 4);
}

// ---------------------------------------------------------------- draw
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.k) return;
  if (abs(S.hue - S.k[0]) > 0.0005) {
    buildColors(S.k[0]);
    S.hue = S.k[0];
  }
  liveWeights(S);
  const w0 = LW[0], w1 = LW[1];
  const lg = log(tauOf(S.k[3]) / S.tauEff) / STEP + OFF + S.ex;
  const inv = 1 / STEP;
  for (let i = 0; i < NP; i++) BD[i] = log(FC[i] * w0 + FF[i] * w1 + 1e-12) * inv + lg;
  // Wind: the map is stretched about the vent by (Wind now / Wind it was built under) ^ 0.45
  const zm = pow(S.k[1] / S.k2b, 0.45);
  let B = BD;
  if (abs(zm - 1) > 0.003) {
    B = BZ;
    const iz = 1 / zm;
    for (let y = 0; y < H; y++) {
      const fy = cl(VY + (y + 0.5 - VY) * iz - 0.5, 0, H - 1.001), y0 = fy | 0, ty = fy - y0;
      for (let x = 0; x < W; x++) {
        const fx = cl(VX + (x + 0.5 - VX) * iz - 0.5, 0, W - 1.001), x0 = fx | 0, tx = fx - x0;
        const a = y0 * W + x0;
        BZ[y * W + x] = (BD[a] * (1 - tx) + BD[a + 1] * tx) * (1 - ty) + (BD[a + W] * (1 - tx) + BD[a + W + 1] * tx) * ty;
      }
    }
  }
  for (let y = 0; y < H; y++) {
    const ym = y > 0 ? -W : 0, yp = y < H - 1 ? W : 0;
    for (let x = 0; x < W; x++) {
      const a = y * W + x;
      const xm = x > 0 ? -1 : 0, xp = x < W - 1 ? 1 : 0;
      const b = B[a];
      const gx = 0.5 * (B[a + xp] - B[a + xm]), gy = 0.5 * (B[a + yp] - B[a + ym]);
      const e = cl(1.2 * sqrt(gx * gx + gy * gy), 0.03, 0.5);
      const j0 = Math.round(b);
      const f = b - j0;
      const lo = cl(j0, 0, NB), hi = cl(j0 + 1, 0, NB);
      const w = sm(-e, e, f);
      const pl = lo * 3, ph = hi * 3;
      // a saw inside each band: the band's own colour at its thick edge, darker toward its thin edge, so the brightness steps at every contour
      const mm = j0 < 0 || j0 >= NB ? 1 : 1 - SAW * (0.35 + 0.65 * sm(1, 7, j0)) * (1 - 0.6 * sm(10, 13, j0)) * (j0 + w - b);
      // the one yellow: a seam of mustard sulphur laid along the contour between the dust and the salmon, as wide as the ramp across it
      const sw = j0 === SEAM ? 0.85 * 4 * w * (1 - w) : 0, sq = (NB + 1) * 3;
      display.setPixel(
        x, y,
        cl((COL[pl] + (COL[ph] - COL[pl]) * w + (COL[sq] - COL[pl] - (COL[ph] - COL[pl]) * w) * sw) * mm + 0.5, 0, 255) | 0,
        cl((COL[pl + 1] + (COL[ph + 1] - COL[pl + 1]) * w + (COL[sq + 1] - COL[pl + 1] - (COL[ph + 1] - COL[pl + 1]) * w) * sw) * mm + 0.5, 0, 255) | 0,
        cl((COL[pl + 2] + (COL[ph + 2] - COL[pl + 2]) * w + (COL[sq + 2] - COL[pl + 2] - (COL[ph + 2] - COL[pl + 2]) * w) * sw) * mm + 0.5, 0, 255) | 0
      );
    }
  }
}
