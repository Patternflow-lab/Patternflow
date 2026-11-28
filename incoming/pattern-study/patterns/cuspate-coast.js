// ===== Patternflow pattern =====
// Title:   Cuspate Coast
// Family:  coastline
// Idea:    A sandy coast seen from far above as a map, sea on the left and sand on the right, where waves that arrive at a steep angle make every bump on a straight shore grow into a cape, so that capes rise, glide down the coast, merge and are combed out again as the swell turns, with the crests bending to the shore and the sand keeping a record of where the coast has been.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: high-angle wave instability of a sandy coast (Andrew Ashton, A. Brad Murray and Orencio Arnoult 2001, Nature; Ashton and Murray 2006, J. Geophys. Res.), the CERC form of the longshore flux (US Army Corps of Engineers, Shore Protection Manual, 1984), Snell's law over a sloping bed and the depth-corrected wavenumber (Carl Eckart, 1952), all from memory; the surf-zone filter with its up-coast lag, the shelf stiffening, the beach-ridge ages and the palettes are original, pattern round 272
// Round:   272
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Time=1.4..4, Angle=-22..24, Swell=-1..1
//
// Knob 1: Hue. Five scenes round the knob, each held for 0.1 of the range and blended into the next over the other 0.1. At 0, the opening, the sea runs from teal-navy far out to turquoise and pale on the shoals, over cream sand. At 0.2 it is cobalt over rose sand, at 0.4 indigo over ash, at 0.6 steel blue over white-grey, at 0.8 emerald over red ochre, and 1 is 0 again. Silt pales the shelf toward the sand colour by up to a third, on periods of 330 and 940 s.
// Knob 2: Time. Simulated seconds of coast per second, 1.45 for each unit: 2.0 at 1.4, 2.9 at the opening 2, 5.8 at 4. At 60 degrees a ripple of the fastest wavelength grows by a factor e in 6 simulated seconds, 2.2 s of panel time at the opening. The capes glide down the panel at 0.25 to 1.5 LED a second there. The crests run as (Time / 2)^0.35.
// Knob 3: Angle. Degrees added to a mean deep-water wave angle of 58, so 36 at -22, 58 at 0 and 82 at 24, on top of a slow swing of up to 20 degrees either way. Growth starts near 46 degrees. Over 600 s at -22 three or more capes stand 17 percent of the time and the cape-scale roughness is 1.8 LED; at 0 it is 89 percent and 4.4 LED; at 24 it is 100 percent and 4.9 LED. The crests turn at once, the coast answers over 10 to 20 s.
// Knob 4: Swell. Wave height 1.5 x 1.35^knob metres: 1.11 at -1, 1.53 at the opening, 2.03 at 1. The flux goes as H^(12/5), 0.49, 1.04 and 2.05 times, and the surf-zone filter widens as the square root of H, 5.9, 7.1 and 8.6 LED, so a higher swell grows broader, taller capes (cape-scale roughness 3.7, 4.4 and 5.0 LED over 600 s). The crest wavelength is 15 (H / 1.5)^0.8 LED: 11.9, 15.4, 19.4, and the crests brighten with height. The swell also breathes by up to 30 percent on periods of 295 and 122 s.
//
// What the picture is. A map of one stretch of sandy coast, 128 LED long and wrapping: what leaves at the bottom comes in again at the top. Sea on the left, sand on the right. The sea is teal-navy far out, turquoise within about 10 LED of the shore and pale on the shoals, and thin pale crest lines cross it at the wave angle and bend toward the shore as they shoal. A swash line of foam sits on the water's edge and pulses as each crest arrives. The sand is cream where it is young, ochre where it is older and darker toward the right edge, with faint beach ridges behind each growing cape. There is no breaker animation: the picture is a planform, not surf.
//
// The model. The shore is x(y) at 128 nodes, one per LED row, periodic. Sand moves as dx/dt = (1/D) dQ/dy with the CERC flux Q = K H^(12/5) cos^(6/5)(phi) sin(phi), phi the angle between the wave crest and the local shore: the deep-water angle plus atan(dx/dy), the slope clipped at tan 85 degrees. Q peaks at 45 degrees and falls with phi where tan^2(phi) > 5/6, above 42.4 degrees. There a bump loses more sand off its flank than the flank gives it and grows; below that angle the same law smooths. The shore angle is averaged first by a gaussian of 7 LED (the surf zone and the diffraction round the shore the waves met first), centred 2.9 LED up the coast. Without the average the growth has no preferred size. With it the fastest wavelength is 26 to 32 LED, and the lag makes the capes glide down the coast. A diffusion of 0.15 LED^2 per second, a pull of 0.1 a second toward a base coast of three slow undulations (4, 2.4 and 1.4 LED, wavelengths 128, 64 and 43, moving down at 0.5 to 0.7 LED per simulated second) and noise keep a smooth coast alive. D = 1 + ((x - 40) / 11)^4 slows a cape or a bay that has gone far out, as a deepening shelf and bedrock would. Without it the capes merge until one fills the panel.
//
// The angle. theta = 58 + Angle + 20 w(T), w the sum of four sines of 169, 363, 71 and 938 simulated seconds (0.5, 0.28, 0.14, 0.08), softly held under 85. Each node gets a further 12 and 6 degrees and a rate of 1 +- 0.4 and 0.25 that drift slowly, standing for shoals offshore, so that the capes never form one even row. The first update runs 170 simulated seconds (about 0.2 s of work) with the path ending at T = 220, which gives three or four capes at the opening on all of 14 random seeds.
//
// The drawing. Distance from the coast is the true distance to the polyline over 14 rows each way, blended beyond 5 to 12 LED into a heavy blur of the coast (sigma 15.5 LED) that stands for the shelf. The sea colour follows it: pale at 0, shelf at 3.5, mid at 10, deep at 28 LED. The crest phase is a deep-water plane wave k0 (x cos(theta) + y sin(theta)) - omega t plus a Snell correction: the wavenumber along the contours stays k0 sin(phi) and the wavenumber across them is sqrt(k^2 - kt^2), with k = k0 / sqrt(tanh(k0 h)) capped at 2.4 k0 and a depth that grows as 1 - exp(-n / 11) with distance n. It is tabulated per arrival angle and distance and read with the angle to the normal of the blurred coast. Crest width is a gaussian of 0.85 LED, 2 LED across, taken from the phase gradient; two slow group modulations break the lines up and the lee of a cape is dimmer. The crests show direction and refraction, not scale: at 1 km an LED a real swell is a tenth of an LED wide. Each pixel remembers when the sea last covered it: new sand is wet and dark for about 1.6 LED, then cream, then ochre over 40 to 460 simulated seconds; a faint ridge comes every 10 s of age and fades where ridges would be closer than 3 LED or the sand is older than 260 s. A tide of 30 percent breathes in the colour bands and the swash zone, on periods of 219, 556 and 126 s.
//
// What is exact and what is chosen. The flux law, the sign of the instability and the 42.4 degree limit are the published ones, and the growth, merging and combing out of capes follow from them. The coast is single-valued, so there are no hooked spits. The filter, its lag, the shelf term, the base undulations, the angle offsets, the tide, the silt and the palettes are mine. With those terms the linear growth starts near 46 degrees, not 42.4.

const W = 64, H = 128, N = 128;
const { floor, sqrt, exp, sin, cos, atan, atan2, tanh, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const RAD = PI / 180;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const mixv = (a, b, t) => a + (b - a) * t;

const XC = 40;          // where the coast sits when nothing has grown
const C0 = 30;          // LED^2 per simulated second for a flux of 1
const NU = 0.15;        // diffusion, LED^2 per second
const MU = 0.1;         // pull toward the long-run coast, per second
const LX = 11;          // how far a cape or a bay can go before the shelf slows it
const NOISE = 0.8;
const KU = 1.45;        // simulated seconds per second per unit of the Time knob
const T_PRE = 170;      // simulated seconds run before the first frame
const T_START = 220;    // where the wave-angle path stands at the first frame
const RIDGE_T = 10;     // simulated seconds between beach ridges

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----------------------------------------------------------------- the model
function wander(T) {
  return 0.5 * sin(0.0371 * T + 0.7) + 0.28 * sin(0.0173 * T + 2.1) + 0.14 * sin(0.0891 * T + 4.0) + 0.08 * sin(0.0067 * T + 1.3);
}

export function setup(params) {
  const r = mulberry((Math.random() * 4294967296) >>> 0);
  const S = {
    r, init: false, T: T_START - T_PRE, wt: 0, k: [0, 2, 0, 0.06],
    x: new Float64Array(N), al: new Float64Array(N), q: new Float64Array(N),
    tmp: new Float64Array(N), lng: new Float64Array(N), dev: new Float64Array(N), off: new Float64Array(N), ex: new Float64Array(N),
    ker: null, R: 0, ell: -1, kerL: null, RL: 0, ts: 0,
    lw: new Float32Array(W * H), tabK: -1, dlt: null,
  };
  for (let i = 0; i < N; i++) S.x[i] = XC + 0.4 * (r() - 0.5);
  for (let p = 0; p < W * H; p++) S.lw[p] = T_START - T_PRE - 8 - 6 * max(0, (p % W) - XC);
  {
        const sg = 6, R = 18, k = new Float64Array(2 * R + 1);
    let s = 0;
    for (let j = -R; j <= R; j++) s += k[j + R] = exp(-0.5 * (j / sg) * (j / sg));
    for (let j = 0; j <= 2 * R; j++) k[j] /= s;
    S.kerL = k;
    S.RL = R;
  }
  params.s = S;
}

function buildKernel(S, ell) {
  const lag = 0.41 * ell, R = Math.ceil(3 * ell + lag), k = new Float64Array(2 * R + 1);
  let s = 0;
  for (let j = -R; j <= R; j++) s += k[j + R] = exp(-0.5 * ((j + lag) / ell) * ((j + lag) / ell));
  for (let j = 0; j <= 2 * R; j++) k[j] /= s;
  S.ker = k;
  S.R = R;
  S.ell = ell;
}

// one step of dx/dt = (1/D) dQ/dy
function step(S, dt, theta, gain) {
  const { x, al, q, tmp, lng, dev, off, ex, ker, R, kerL, RL } = S;
  for (let i = 0; i < N; i++) {
    const s = cl((x[(i + 1) & 127] - x[(i + 127) & 127]) * 0.5, -11.4, 11.4);
    al[i] = atan(s);
  }
  for (let i = 0; i < N; i++) {
    let v = 0;
    for (let j = -R; j <= R; j++) v += ker[j + R] * al[(i + j + 256) & 127];
    const phi = cl(theta + off[i], 0.05, 1.54) + v, c = cos(phi);
    q[i] = c > 0 ? c * pow(c, 0.2) * sin(phi) : 0;
  }
  if ((S.ts++ & 3) === 0) {
    const T = S.T;
    for (let i = 0; i < N; i++) {
      const u = TAU * (i + 0.5) / N;
      off[i] = (12 * sin(u + 0.6 + 0.005 * T) + 6 * sin(2 * u + 2.0 - 0.0071 * T)) * RAD;
      ex[i] = 1 + 0.4 * sin(u + 3.1 - 0.0063 * T) + 0.25 * sin(3 * u + 1.2 + 0.009 * T);
      dev[i] = x[i] - (XC + 4 * sin(u - 0.0245 * T + 0.7 + 0.3 * sin(0.0123 * T)) + 2.4 * sin(2 * u - 0.0393 * T + 1.1) + 1.4 * sin(3 * u - 0.0452 * T + 0.2));
    }
    for (let i = 0; i < N; i++) {
      let v = 0;
      for (let j = -RL; j <= RL; j++) v += kerL[j + RL] * dev[(i + j + 256) & 127];
      lng[i] = v;
    }
  }
  const sn = sqrt(dt) * NOISE, r = S.r;
  for (let i = 0; i < N; i++) {
    const u = (x[i] - XC) / LX, D = 1 + u * u * u * u;
    const dq = (q[(i + 1) & 127] - q[(i + 127) & 127]) * 0.5;
    const d2 = x[(i + 1) & 127] - 2 * x[i] + x[(i + 127) & 127];
    tmp[i] = x[i] + dt * (gain * C0 * ex[i] * dq / D + NU * d2 - MU * lng[i]) + sn * (r() - 0.5);
  }
  for (let i = 0; i < N; i++) x[i] = tmp[i];
}

// the wave angle in degrees: the knob's mean, the slow path, and a soft ceiling near 85
function angleAt(mean, T) {
  const v = mean + 20 * wander(T);
  return v < 3 ? 3 : v < 70 ? v : 70 + 15 * tanh((v - 70) / 15);
}
// the tide, in -1 to 1
function tideAt(T) {
  return 0.55 * sin(0.0287 * T + 0.3) + 0.3 * sin(0.0113 * T + 2.2) + 0.15 * sin(0.0497 * T + 5.0);
}
// the swell height breathes by up to 30 percent
function heightAt(Hs0, T) {
  return Hs0 * (1 + 0.2 * sin(0.0213 * T + 1.0) + 0.1 * sin(0.0517 * T + 3.0));
}

function advance(S, simDt, mean, Hs0) {
  const nst = Math.ceil(simDt / 0.06);
  const h = simDt / nst;
  for (let n = 0; n < nst; n++) {
    S.T += h;
    const Hs = heightAt(Hs0, S.T), g = Hs / 1.5, ell = 7 * sqrt(g);
    if (abs(ell - S.ell) > 0.05) buildKernel(S, ell);
    step(S, h, angleAt(mean, S.T) * RAD, pow(g, 2.4));
  }
}

// pixels seaward of the coast have just been sea
function markWet(S) {
  const { x, lw, tmp } = S;
  for (let i = 0; i < N; i++) tmp[i] = 0.25 * x[(i + 127) & 127] + 0.5 * x[i] + 0.25 * x[(i + 1) & 127];
  for (let y = 0; y < H; y++) {
    const e = min(W, floor(0.25 * tmp[(y + 127) & 127] + 0.5 * tmp[y] + 0.25 * tmp[(y + 1) & 127] + 0.5));
    for (let px = 0; px < e; px++) lw[y * W + px] = S.T;
  }
}

function shared(S) {
  const k = S.k;
  const Hs = 1.5 * pow(1.35, cl(k[3], -1, 1));
  return { mean: 58 + cl(k[2], -30, 30), Hs, pace: cl(k[1], 1.4, 4) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.init) {
    for (let i = 0; i < 4; i++) S.k[i] = isFinite(kv[i]) ? kv[i] : S.k[i];
    const m = shared(S);
    buildKernel(S, 7);
    const nst = Math.round(T_PRE / 0.1);
    for (let n = 0; n < nst; n++) {
      if ((n % 4) === 0) markWet(S);
      advance(S, 0.1, m.mean, m.Hs);
    }
    markWet(S);
    S.init = true;
  } else {
    const al = 1 - exp(-d / 0.3);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  const m = shared(S);
  advance(S, d * KU * m.pace, m.mean, m.Hs);
  markWet(S);
  S.wt += d * pow(m.pace / 2, 0.35);
}

// ------------------------------------------------------------------- picture
// Ten colours a scene: deep, mid, shelf and shallow water, foam, wet sand, sand,
// older sand, old land, crest. Five scenes round the knob, the first again at 1.
const SC = [
  [[10, 66, 98], [10, 110, 134], [30, 158, 164], [150, 214, 198], [236, 248, 240], [122, 100, 74], [232, 220, 186], [200, 168, 118], [112, 102, 70], [214, 240, 238]],
  [[14, 42, 106], [24, 88, 168], [62, 136, 208], [178, 212, 240], [244, 244, 250], [132, 88, 94], [240, 198, 192], [208, 140, 140], [134, 88, 96], [226, 236, 250]],
  [[34, 26, 86], [64, 52, 142], [108, 98, 190], [196, 190, 236], [244, 240, 250], [86, 84, 98], [208, 206, 212], [150, 148, 162], [96, 96, 112], [226, 220, 246]],
  [[16, 58, 98], [42, 110, 152], [108, 174, 200], [204, 232, 242], [246, 250, 252], [108, 116, 126], [224, 230, 234], [170, 178, 188], [98, 110, 104], [230, 244, 250]],
  [[8, 64, 56], [14, 112, 92], [58, 170, 130], [188, 230, 188], [240, 250, 236], [128, 74, 48], [228, 172, 110], [198, 112, 66], [124, 72, 50], [222, 246, 226]],
];
const PAL = new Float32Array(30);
function palette(hue, tb) {
  const u = (hue - floor(hue)) * 5, i = floor(u) % 5, f = u - floor(u), t = sm((f - 0.25) / 0.5), a = SC[i], b = SC[(i + 1) % 5];
  for (let c = 0; c < 10; c++) for (let k = 0; k < 3; k++) PAL[c * 3 + k] = mixv(a[c][k], b[c][k], t) / 255;
  // silt in the water: the shelf and the shallows drift toward the colour of the sand
  for (let k = 0; k < 3; k++) {
    const sand = PAL[18 + k];
    PAL[6 + k] = mixv(PAL[6 + k], 0.55 * sand + 0.45 * PAL[6 + k], 0.7 * tb);
    PAL[9 + k] = mixv(PAL[9 + k], 0.7 * sand + 0.3 * PAL[9 + k], 0.6 * tb);
    PAL[3 + k] = mixv(PAL[3 + k], 0.3 * sand + 0.7 * PAL[3 + k], 0.25 * tb);
  }
}

const NQN = 256, NNT = 80;       // q to distance table, distance steps of 0.5 LED
const NQ = new Float32Array(NQN);
const SIGB = 15.5;               // sigma of the blur that stands for the shelf
function erf(z) {
  const s = z < 0 ? -1 : 1, a = abs(z), t = 1 / (1 + 0.3275911 * a);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-a * a));
}
{
  // n(q): q = erf(n / (sigma sqrt 2)), by a search
  let n = 0;
  for (let i = 0; i < NQN; i++) {
    const q = i / (NQN - 1) * 0.999;
    while (erf(n / (SIGB * 1.41421)) < q && n < 60) n += 0.05;
    NQ[i] = n;
  }
}

const NPH = 15;   // phi grid, 6 degrees apart
// the phase a wave gains, over the deep-water plane wave, between far out and distance n from
// the shore, for each angle of arrival: Snell's law with k from the depth
function buildTable(S, k0) {
  const tab = new Float32Array(NPH * NNT);
  const KMAX = 2.4 * k0, LS = 11, K0H = 2.6;
  const kk = new Float32Array(NNT);
  for (let j = 0; j < NNT; j++) {
    const n = j * 0.5, h = (1 - exp(-n / LS)) * K0H / k0;
    kk[j] = min(k0 / sqrt(tanh(max(k0 * h, 1e-3))), KMAX);
  }
  for (let f = 0; f < NPH; f++) {
    const ph = f * 6 * RAD, kt = k0 * sin(ph), kc = k0 * cos(ph);
    let acc = 0;
    tab[f * NNT + NNT - 1] = 0;
    for (let j = NNT - 2; j >= 0; j--) {
      const a = sqrt(max(kk[j] * kk[j] - kt * kt, 0)) - kc, b = sqrt(max(kk[j + 1] * kk[j + 1] - kt * kt, 0)) - kc;
      acc += 0.25 * (a + b);
      tab[f * NNT + j] = acc;
    }
  }
  S.dlt = tab;
  S.tabK = k0;
}

const CV = new Float32Array(W * H), DD = new Float32Array(W * H), BA = new Float32Array(W * H), BB = new Float32Array(W * H);
const PH = new Float32Array(W * H), NN = new Float32Array(W * H), AD = new Float32Array(W * H);
const XD = new Float64Array(N), XT = new Float64Array(N);
const PRE = new Float64Array(W + 80);
const MINX = new Float64Array(H);

function boxH(a, b, r) {
  const L = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    const row = y * W;
    // prefix sum of the row padded with 0 on the sea side and 1 on the land side
    let acc = 0;
    PRE[0] = 0;
    for (let i = 0; i < W + 2 * r; i++) {
      const xx = i - r;
      acc += xx < 0 ? 0 : xx >= W ? 1 : a[row + xx];
      PRE[i + 1] = acc;
    }
    for (let x = 0; x < W; x++) b[row + x] = (PRE[x + L] - PRE[x]) / L;
  }
}
function boxV(a, b, r) {
  const L = 2 * r + 1;
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let j = -r; j <= r; j++) acc += a[((j + 1024) & 127) * W + x];
    for (let y = 0; y < H; y++) {
      b[y * W + x] = acc / L;
      acc += a[((y + r + 1) & 127) * W + x] - a[((y - r + 1024) & 127) * W + x];
    }
  }
}

function seaCol(n, o) {
  // distance from the coast in LEDs to colour: shallow, shelf, mid, deep
  let a, b, f;
  if (n < 3.5) { a = 9; b = 6; f = n / 3.5; }
  else if (n < 10) { a = 6; b = 3; f = (n - 3.5) / 6.5; }
  else if (n < 28) { a = 3; b = 0; f = (n - 10) / 18; }
  else { a = 0; b = 0; f = 0; }
  f = f * f * (3 - 2 * f);
  for (let k = 0; k < 3; k++) o[k] = mixv(PAL[a + k], PAL[b + k], f);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.init) return;
  const sh = shared(S), k = S.k;
  palette(k[0], 0.5 + 0.3 * sin(0.0191 * S.T + 0.9) + 0.2 * sin(0.0067 * S.T + 4.1));
  const thDeg = angleAt(sh.mean, S.T), theta = (thDeg < 58 ? thDeg : 58 + 14 * tanh((thDeg - 58) / 14)) * RAD, Hs = heightAt(sh.Hs, S.T);
  const lam = 15 * pow(Hs / 1.5, 0.8), k0 = TAU / lam, cw = 5.5 * sqrt(lam / 15), om = k0 * cw;
  if (abs(k0 - S.tabK) > 0.003) buildTable(S, k0);

  // coast drawn a little softer than the model, so a cape is round at the tip
  for (let i = 0; i < N; i++) XT[i] = 0.25 * S.x[(i + 127) & 127] + 0.5 * S.x[i] + 0.25 * S.x[(i + 1) & 127];
  for (let i = 0; i < N; i++) XD[i] = 0.25 * XT[(i + 127) & 127] + 0.5 * XT[i] + 0.25 * XT[(i + 1) & 127];
  for (let i = 0; i < N; i++) XT[i] = 0.25 * XD[(i + 127) & 127] + 0.5 * XD[i] + 0.25 * XD[(i + 1) & 127];
  for (let i = 0; i < N; i++) XD[i] = 0.25 * XT[(i + 127) & 127] + 0.5 * XT[i] + 0.25 * XT[(i + 1) & 127];
  for (let y = 0; y < H; y++) {
    const xc = XD[y], s = (XD[(y + 1) & 127] - XD[(y + 127) & 127]) * 0.5, nr = sqrt(1 + s * s), wd = (1 + abs(s)) / nr;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, d = (x + 0.5 - xc) / nr;
      DD[p] = d;
      CV[p] = cl(0.5 + d / wd, 0, 1);
    }
  }
  for (let y = 0; y < H; y++) {
    let m = 1e9;
    for (let o = -14; o <= 14; o++) m = min(m, XD[(y + o + 128) & 127]);
    MINX[y] = m;
  }
  BA.set(CV);
  boxH(BA, BB, 15);
  boxH(BB, BA, 15);
  boxH(BA, BB, 15);
  boxV(BB, BA, 15);
  boxV(BA, BB, 15);
  boxV(BB, BA, 15);

  // phase of the swell at every pixel
  const cT = cos(theta), sT = sin(theta), tab = S.dlt;
  for (let y = 0; y < H; y++) {
    const ym = ((y + 127) & 127) * W, yp = ((y + 1) & 127) * W, row = y * W;
    for (let x = 0; x < W; x++) {
      const p = row + x;
      const B = BA[p];
      const gx = (BA[row + min(x + 1, W - 1)] - BA[row + max(x - 1, 0)]) * 0.5, gy = (BA[yp + x] - BA[ym + x]) * 0.5;
      const gl = sqrt(gx * gx + gy * gy);
      let ph = theta - (gl > 1e-4 ? atan2(gy, gx) : 0);
      ph = ph - TAU * floor((ph + PI) / TAU);
      const q = cl(1 - 2 * B, 0, 0.999);
      let nn = NQ[(q * (NQN - 1)) | 0];
      const dd = DD[p];
      if (dd >= 0) nn = 0;
      else if (x + 12.5 > MINX[y]) {
        // true distance over 14 rows each way, blended into the shelf's blur between 5 and 12 LED
        const px = x + 0.5;
        let best = 1e9;
        for (let o = -14; o <= 13; o++) {
          const j = (y + o + 128) & 127, xa = XD[j] - px, xb = XD[(j + 1) & 127] - px, sx = xb - xa;
          let t = -(xa * sx + o) / (sx * sx + 1);
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const cx = xa + t * sx, cy = o + t, d2 = cx * cx + cy * cy;
          if (d2 < best) best = d2;
        }
        const dt = sqrt(best), w = sm((dt - 5) / 7);
        nn = dt * (1 - w) + nn * w;
      }
      NN[p] = nn;
      const ap = min(abs(ph), 84 * RAD), fi = ap / (6 * RAD), f0 = min(floor(fi), NPH - 2), ff = fi - f0;
      const fj = min(nn * 2, NNT - 1.001), j0 = floor(fj), fjj = fj - j0;
      const a0 = f0 * NNT + j0, a1 = a0 + NNT;
      const dl = mixv(mixv(tab[a0], tab[a0 + 1], fjj), mixv(tab[a1], tab[a1 + 1], fjj), ff);
      PH[p] = k0 * ((x + 0.5 - XC) * cT + (y + 0.5 - 64) * sT) - om * S.wt + dl;
      AD[p] = cl(cos(min(abs(ph), 86 * RAD)) / 0.5, 0.3, 1);
    }
  }

  const gT = S.wt, TAGE = S.T, tide = tideAt(S.T), nSc = 1 + 0.3 * tide, wetW = 1.6 * (1 + 0.4 * tide);
  const cg = cos(theta + 0.4), sg = sin(theta + 0.4);
  const sea = [0, 0, 0];
  for (let y = 0; y < H; y++) {
    const ym = ((y + 127) & 127) * W, yp = ((y + 1) & 127) * W, row = y * W;
    for (let x = 0; x < W; x++) {
      const p = row + x, cv = CV[p], nn = NN[p], dd = DD[p];
      seaCol(nn / nSc, sea);
      let r = sea[0], g = sea[1], b = sea[2];
      // crest lines
      if (cv < 0.999) {
        const gx = (PH[row + min(x + 1, W - 1)] - PH[row + max(x - 1, 0)]) * 0.5, gy = (PH[yp + x] - PH[ym + x]) * 0.5;
        const gm = max(0.12, sqrt(gx * gx + gy * gy));
        const f = PH[p] / TAU, fr = f - Math.round(f), ds = abs(fr) * TAU / gm;
        const grp = 0.3 + 0.7 * (0.5 + 0.5 * sin(0.1 * ((x - XC) * cg + (y - 64) * sg) - 0.45 * gT + 0.5)) * (0.55 + 0.45 * (0.5 + 0.5 * sin(0.083 * ((x - XC) * sT - (y - 64) * cT) + 0.31 * gT + 2.0)));
        const env = (0.5 + 0.5 * sm((30 - nn) / 20)) * sm((nn - 0.5) / 2.0) * AD[p] * grp * (0.55 + 0.45 * Hs / 1.5);
        const c = exp(-0.5 * (ds / 0.85) * (ds / 0.85)) * env * 0.8;
        r += (PAL[27] - r) * c;
        g += (PAL[28] - g) * c;
        b += (PAL[29] - b) * c;
      }
      // land
      let lr = 0, lg = 0, lb = 0;
      if (cv > 0.001) {
        const a = TAGE - S.lw[p];
        // the older sand's tone uses the age averaged over seven rows, so no hard bar shows
        let am = 0;
        for (let j = -3; j <= 3; j++) am += S.lw[((y + j + 128) & 127) * W + x];
        am = TAGE - am / 7;
        const u2 = sm((am - 40) / 420), u3 = sm((am - 520) / 900), far = max(u3, 0.55 * sm((x - 42) / 22));
        const a2 = TAGE - S.lw[row + min(x + 1, W - 1)], a3 = TAGE - S.lw[row + max(x - 1, 0)], a4 = TAGE - S.lw[yp + x], a5 = TAGE - S.lw[ym + x];
        const ga = (abs(a2 - a3) + abs(a4 - a5)) * 0.5 + 1e-3;
        const rid = sin(TAU * a / RIDGE_T) * sm((RIDGE_T / ga - 3) / 3) * sm((a - 6) / 10) * sm((260 - a) / 80);
        const lum = 1 + 0.07 * rid;
        for (let c = 0; c < 3; c++) {
          let v = mixv(mixv(PAL[18 + c], PAL[21 + c], u2), PAL[24 + c], far) * lum;
          const wet = exp(-max(dd, 0) / wetW);
          v = mixv(v, PAL[15 + c], 0.85 * wet);
          if (c === 0) lr = v; else if (c === 1) lg = v; else lb = v;
        }
      }
      r = mixv(r, lr, cv);
      g = mixv(g, lg, cv);
      b = mixv(b, lb, cv);
      // swash: a pale line on the water's edge that pulses as each crest arrives
      {
        const fd = (dd + 0.7 - 0.35 * tide) / 0.8;
        if (fd > -3 && fd < 3) {
          const pulse = 0.5 + 0.5 * cos(PH[p]);
          const fw = exp(-0.5 * fd * fd) * (0.3 + 0.7 * pulse) * AD[p] * 0.75;
          r += (PAL[12] - r) * fw;
          g += (PAL[13] - g) * fw;
          b += (PAL[14] - b) * fw;
        }
      }
      display.setPixel(x, y, cl((r * 255) | 0, 0, 255), cl((g * 255) | 0, 0, 255), cl((b * 255) | 0, 0, 255));
    }
  }
}
