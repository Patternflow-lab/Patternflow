// ===== Patternflow pattern =====
// Title:   Retinal Waves
// Family:  retinalwaves
// Idea:    A sheet of the retina of a newborn mammal imaged for calcium, a black-green tissue lit in GCaMP green, where a wave of spontaneous firing starts every couple of seconds as a small lime disc at a random place, runs out across the sheet as a soft lime-white band a few LEDs wide at about 3.5 LEDs a second, and stops dead against tissue that fired too recently, so that the panel fills with a mosaic of domains, each tinted by how long ago it fired, from lime through green and teal to the deep teal-green of tissue that has waited longest.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the waves of spontaneous firing that cross the retina of a young mammal before the eye opens (Markus Meister, Rachel Wong, Denis Baylor and Carla Shatz, 1991; Marla Feller, David Wellis, David Stellwagen, Frank Werblin and Carla Shatz, 1996; Rachel Wong, 1999), their stop at tissue still refractory from an earlier wave, which cuts out the domain each one fills (Matthias Butts, Marla Feller, Carla Shatz and Daniel Rokhsar, 1999; Godfrey and Swindale, 2007, both from memory), the bias of their direction (Stafford, Sher, Litke and Feldheim, 2009; Ackman, Burbridge and Crair, 2012, both from memory), the bistable cubic of an excitable medium (Jinichi Nagumo, 1962, from memory); pattern round 258
// Round:   258
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=0..4, Refractory=-1..1, Bias=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel, one turn for the knob's whole travel. At 0 a front is white-lime, the tissue behind it goes through lime, green and deep green to teal, and the oldest tissue is a deep teal-green (7, 70, 60); at 0.17 it is cyan, at 0.5 magenta, at 0.75 amber, and at 1 it is back to green.
// Knob 2: Rate. How fast the sheet runs: the fronts and the starts together, 0.44 times the opening's pace at 0 and 2.3 times it at 4. At 2, where it opens, a front runs 3.6 LEDs a second in rested tissue and a wave starts every 2.4 s on average, with about four alive on the panel at a time. At 0 the front crawls at 1.3 and a wave starts every 10 s; at 4 the fronts run at 6.9 and there are two starts a second. Tissue recovers at the same pace at every setting, so a fast sheet is a crowded one.
// Knob 3: Refractory. How long a fired patch stays deaf. At 0 it is deaf for 31 s on average, and any one wave draws a time between 19 and 52 s (the 10th and 90th percentile); at -1 it is 17 s and at 1 it is 56 s. A short refractory lets a wave run a long way: at -1 the domains are about 30 LEDs across, and one wave can take a third of the panel. At 1 the elders block every wave, the domains are 19 across and the sheet is a crowd of small ones.
// Knob 4: Bias. The way waves prefer to run, down and to the right at 1 and up and to the left at -1, along the diagonal of the panel. At 0 every wave is a ring and starts anywhere. Away from 0 an upwind drift of up to 1.9 LEDs a second carries every front, so the front that runs with it goes at 5.5 and the front that runs against it at 1.7, and a start is 12 times as likely at the upstream end of the sheet as in the middle, so the domains lean into wedges along the diagonal.

// What the picture is. A sheet of 64 x 128 cells, one for each LED, with two fast fields and one slow:
//   u  the activator, 0 at rest and 1 firing:  du/dt = D lap(u) + u (1 - u) (u - theta) / tau_u   (Nagumo's bistable cubic, D = 5.5 LED^2/s, tau_u = 0.1 s)
//   w  a timer that follows u:                 dw/dt = (u - w) / tau_w
//   s  the slow adaptation, the long afterhyperpolarization of the starburst cells: a cell whose w passes 0.3 has fired for good, s jumps to 1,
//      and from then s falls in a straight line to 0 over T = 40 s times 1.8 to the K3, so s is how much of its refractory period a cell has left.
// The threshold theta is 0.1 for tissue with s under 0.16 and climbs in a smooth step to 2.5 at s over 0.7. A front runs at c = sqrt(D / 2 tau_u) (1 - 2 theta), and
// a front goes on through tissue with s under about 0.22 and dies in tissue over that, measured with a straight front, so tissue is rested after 78% of T and a front
// that meets tissue short of that leaves it untouched. That is the border of a domain, sharp because s is a straight line in time and the stop is a step in s.
// Coupling is the nine-point Laplacian, so a front is a ring and not a diamond. No spiral winds: a turn takes longer than the refractory time, so every wave
// ends before the tissue behind it is rested.
// A patch recovers at its own rate, drawn when it fires from a smooth field that drifts through the sheet, so the cells a wave fires in 10 s recover 19 to 52 s later,
// and the next wave finds the borders of the last one in new places. Without that the sheet falls into step and one wave sweeps all of it every T.
// A wave starts at a cell picked in proportion to how rested it is, so the more of the sheet has recovered the oftener one starts, as a disc of u at 0.7 with
// a radius of 2.6 to 3.4 LEDs. A quiet sheet, with no front on it, starts waves 6 times as fast.
// K4 adds an upwind drift to u, and weights the cells for a start by exp(2.5 |K4| x) for x from -1 at the downstream end to 1 at the upstream end.
// The picture is s through a ramp from white-lime (s = 1) to deep teal-green (s = 0), blurred over 3 x 3 cells, with u laid over it as lime light that turns white
// where u is nearly 1: the front is a white-lime band, and the tissue ages behind it, so each domain is a shade that tells when it fired.
// The sheet starts with smooth blotches of every age and runs for 40 s before the first frame, so the picture opens full and a few waves are on it.

const W = 64, H = 128, PW = W + 2, PH = H + 2, NC = PW * PH; // the sheet has a one-cell margin, copied from the edge, so that nothing flows out

const { floor, sqrt, abs, exp, sin, cos, log, pow, PI, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- the medium
const DIFF = 5.5; // coupling, LED^2 a second of fast time
const TAU_U = 0.1; // reaction time of the activator, s
const TH0 = 0.1; // threshold of rested tissue
const HET = 0.03; // unevenness of the threshold from place to place, in blotches 10 to 30 LEDs across
const TH_MAX = 2.5; // threshold of freshly fired tissue: high enough to switch a cell off in half a second, low enough for the reaction to stay stable
const S_READY = 0.16, S_DEAF = 0.7; // the threshold is TH0 for s under S_READY, TH_MAX over S_DEAF, and climbs in a smooth step between
const TAU_W = 2.4, W_STAR = 0.3; // a cell has fired for good after -TAU_W ln(1 - W_STAR) = 0.86 s of fast time with u near 1
const REFRACT = 40, REFRACT_BASE = 1.8; // seconds for s to fall from 1 to 0 at K3 = 0, and the factor for each unit of K3
const RK_SPREAD = 0.5; // a patch recovers at exp(+-0.5) times the mean rate at most, and mostly between 0.6 and 1.65
const NU_PER_KNOB = 0.6; // the fast fields run 2^(0.6 (K2 - 2)) times as fast as at the opening
const SUBSTEP = 0.03; // the longest step of fast time the coupling stays smooth at, s

// ---- the starts
const RHO = 1.1e-4; // starts a second for each LED^2 of rested tissue, at K2 = 2
const Q_FULL = 0.1, Q_NONE = 0.2; // a cell counts fully as a place to start for s under 0.1 and not at all over 0.2
const IDLE_BOOST = 5, IDLE_ACT = 60; // a quiet sheet starts waves 1 + 5 times as fast, and the boost falls off as the sum of u over the sheet passes 60
const SEED_R = 2.6, SEED_PEAK = 0.7; // a start is a disc of u at 0.7, lime and not white until the front it grows into is whole
const BIAS_SHARP = 2.5, DRIFT = 1.9; // K4: the weighting of starts, and LEDs a second of upwind drift, at |K4| = 1
const DIR = [0.5, 0.866]; // the way K4 > 0 runs: right and mostly down
const REACH = 72; // half the length of the panel along DIR, 32 x 0.5 + 64 x 0.866, so that x runs from -1 to 1
const PREROLL = 40, PRE_NU = 1.3; // seconds of the sheet run before the first frame, and the fastest it runs the fronts in doing so

function makeState() {
  const S = {
    ready: false, kn: [0, 2, 0, 0.06], acc: 0, thr: 1, mass: 0, clk: 0, tw: [],
    wt: new Float32Array(NC), g: new Float32Array(NC), bs: new Float32Array(NC), bu: new Float32Array(NC), hot: new Float32Array(6),
    u: new Float32Array(NC), un: new Float32Array(NC), w: new Float32Array(NC), s: new Float32Array(NC),
    th0: new Float32Array(NC), thl: new Float32Array(256), rk: new Float32Array(NC),
    lut: new Float32Array(512 * 3), hueMat: new Float32Array(9), hueAt: -1,
  };
  // two smooth fields, each a sum of seven plane waves: the unevenness of the threshold, and the ages the sheet starts with
  const field = (lo, hi) => {
    const ws = [];
    for (let k = 0; k < 7; k++) {
      const a = Math.random() * 2 * PI, lam = lo + (hi - lo) * Math.random();
      ws.push([(cos(a) * 2 * PI) / lam, (sin(a) * 2 * PI) / lam, Math.random() * 2 * PI]);
    }
    return (x, y) => {
      let h = 0;
      for (let k = 0; k < 7; k++) h += sin(ws[k][0] * x + ws[k][1] * y + ws[k][2]);
      return h / 2.6; // seven unit sines have a spread of sqrt(7/2) = 1.87, so most of the field sits inside +-1
    };
  };
  for (let k = 0; k < 6; k++) {
    const a = Math.random() * 2 * PI, lam = 30 + 30 * Math.random(), per = 25 + 65 * Math.random();
    S.tw.push([(cos(a) * 2 * PI) / lam, (sin(a) * 2 * PI) / lam, (2 * PI) / per, Math.random() * 2 * PI]);
  }
  for (let k = 0; k < 256; k++) {
    const x = cl((k / 255 - S_READY) / (S_DEAF - S_READY), 0, 1);
    S.thl[k] = (TH_MAX - TH0 - HET) * x * x * (3 - 2 * x);
  }
  const fh = field(10, 30), fa = field(22, 45);
  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      const i = y * PW + x, h = fh(x, y);
      S.th0[i] = TH0 + HET * h;
      S.rk[i] = 1;
      S.s[i] = cl(0.5 + 0.8 * fa(x, y), 0, 1); // ages of every stage to start from, in blotches 20 to 45 LEDs across
    }
  }
  return S;
}

export function setup(params) {
  params.s = makeState();
}

// Copy the edge cells outward so that nothing flows through the border of the sheet.
function edges(a) {
  for (let x = 0; x < PW; x++) {
    a[x] = a[PW + x];
    a[(PH - 1) * PW + x] = a[(PH - 2) * PW + x];
  }
  for (let y = 0; y < PH; y++) {
    a[y * PW] = a[y * PW + 1];
    a[y * PW + PW - 1] = a[y * PW + PW - 2];
  }
}

// How fast a patch will recover from the wave that is firing it now: a smooth field of seven drifting plane waves, so the cells one wave
// fires in a few seconds recover alike, and the next wave, a few seconds on, may draw a very different time.
function rkAt(S, x, y) {
  let h = 0;
  for (let k = 0; k < 6; k++) { const q = S.tw[k]; h += sin(q[0] * x + q[1] * y + q[2] * S.clk + q[3]); }
  return exp(-RK_SPREAD * cl(h / 2.2, -1.6, 1.6));
}

// One step of the sheet: sdt is real time, nu the speed of the fast fields (K2), ts the straight-line recovery time of s, b the signed drift of K4.
function stepField(S, sdt, nu, ts, b) {
  const dtf = sdt * nu;
  const kd = (DIFF * dtf) / 6, kr = dtf / TAU_U, kw = dtf / TAU_W, ks = sdt / ts;
  const vx = b * DRIFT * DIR[0] * dtf, vy = b * DRIFT * DIR[1] * dtf;
  const cx = abs(vx), cy = abs(vy), ox = vx > 0 ? -1 : 1, oy = vy > 0 ? -PW : PW;
  const u = S.u, un = S.un, w = S.w, s = S.s, th0 = S.th0, thl = S.thl, rk = S.rk;
  edges(u);
  for (let y = 1; y <= H; y++) {
    for (let i = y * PW + 1, e = i + W; i < e; i++) {
      const a = u[i];
      const lap = 4 * (u[i - 1] + u[i + 1] + u[i - PW] + u[i + PW]) + u[i - PW - 1] + u[i - PW + 1] + u[i + PW - 1] + u[i + PW + 1] - 20 * a;
      let sv = s[i], wv = w[i];
      const th = th0[i] + thl[(sv * 255) | 0];
      let v = a + kd * lap + kr * a * (1 - a) * (a - th) - cx * (a - u[i + ox]) - cy * (a - u[i + oy]);
      un[i] = v < 0 ? 0 : v > 1 ? 1 : v;
      wv += (a - wv) * kw;
      if (wv > W_STAR && sv < 0.9) {
        sv = 1;
        rk[i] = rkAt(S, i % PW, (i / PW) | 0);
      }
      sv -= ks * rk[i];
      w[i] = wv;
      s[i] = sv < 0 ? 0 : sv;
    }
  }
  S.u = un;
  S.un = u;
}

// Where a wave may start: a rested cell weighs 1, falling to 0 as s climbs from Q_FULL to Q_NONE. Waves start in proportion to the weight, so the more of the
// sheet has recovered the oftener one starts, and with K4 off zero the upstream end weighs more. mass is the weight with no bias, which sets the rate.
function weigh(S, bias) {
  const s = S.s, wt = S.wt, k = BIAS_SHARP * abs(bias), sg = bias > 0 ? -1 : 1;
  const norm = k < 1e-3 ? 1 : k / Math.sinh(k);
  let tot = 0, mass = 0, act = 0;
  const u = S.u;
  for (let y = 1; y <= H; y++) {
    const rowUp = (sg * (y - H / 2) * DIR[1]) / REACH;
    for (let x = 1; x <= W; x++) {
      const i = y * PW + x, q = cl(1 - (s[i] - Q_FULL) * (1 / (Q_NONE - Q_FULL)), 0, 1);
      let v = 0;
      mass += q;
      act += u[i];
      if (q > 0) v = q * (k < 1e-3 ? 1 : exp(k * (rowUp + (sg * (x - W / 2) * DIR[0]) / REACH)) * norm);
      wt[i] = v;
      tot += v;
    }
  }
  S.mass = mass * (1 + IDLE_BOOST * exp(-act / IDLE_ACT)); // a sheet with no wave on it starts one sooner
  return tot;
}

function ignite(S, tot) {
  if (tot <= 0) return false;
  let r = Math.random() * tot, bi = -1;
  const wt = S.wt;
  for (let i = PW + 1; i < NC - PW - 1; i++) {
    r -= wt[i];
    if (r <= 0 && wt[i] > 0) { bi = i; break; }
  }
  if (bi < 0) return false;
  const cx = bi % PW, cy = floor(bi / PW), r0 = SEED_R + 0.8 * Math.random(), R = floor(r0 + 2), u = S.u;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 1 || x > W || y < 1 || y > H) continue;
      const v = SEED_PEAK * cl((r0 + 1 - sqrt(dx * dx + dy * dy)) / 2, 0, 1), i = y * PW + x;
      if (v > u[i]) u[i] = v;
    }
  }
  return true;
}

function rates(kn) {
  const nu = pow(2, (cl(kn[1], 0, 4) - 2) * NU_PER_KNOB);
  return { nu, rho: RHO * pow(nu, 1.4), ts: REFRACT * pow(REFRACT_BASE, cl(kn[2], -1, 1)), b: cl(kn[3], -1, 1) };
}

function advance(S, dt, kn, subs, nuCap) {
  const r = rates(kn);
  if (nuCap && r.nu > nuCap) r.nu = nuCap; // the pre-run takes bigger steps, so it runs the fast fields no faster than this
  S.clk += dt;
  const tot = weigh(S, r.b);
  S.acc += r.rho * S.mass * dt;
  while (S.acc >= S.thr) {
    S.acc -= S.thr;
    S.thr = -log(1 - Math.random());
    ignite(S, tot);
  }
  for (let k = 0; k < subs; k++) stepField(S, dt / subs, r.nu, r.ts, r.b);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  if (!S.ready) {
    S.ready = true;
    const pdt = min(0.05, 0.035 / min(rates(kn).nu, PRE_NU));
    for (let t = 0; t < PREROLL; t += pdt) advance(S, pdt, kn, 1, PRE_NU);
  }
  advance(S, d, kn, min(8, max(2, Math.ceil((d * rates(kn).nu) / SUBSTEP)))); // two sub-steps at a normal frame, more when the fronts run fast or a frame runs long
}

// ---- colour: freshness 1 is white-lime, 0 is the deep teal of tissue that has waited longest
const RAMP = [
  [0.0, 7, 70, 60],
  [0.3, 7, 92, 78],
  [0.6, 9, 128, 76],
  [0.85, 14, 160, 50],
  [0.95, 40, 215, 60],
  [0.985, 140, 250, 60],
  [1.0, 225, 255, 150],
];
// A front is light added to the tissue under it: lime as u rises, and a white core where u is nearly 1. u^1.5 and u^4 weight them.
const GLOW = [150, 205, 40], CORE = [70, 30, 110];
const LUTN = 512;
const BLUR = 0.2; // weight of each side of the 3-tap blur that takes the single-LED stairs off the borders

function hueMatrix(S, hue) {
  if (S.hueAt === hue) return;
  const A = 2 * PI * hue, c = cos(A), s = sin(A), m = S.hueMat;
  m[0] = 0.213 + c * 0.787 - s * 0.213; m[1] = 0.715 - c * 0.715 - s * 0.715; m[2] = 0.072 - c * 0.072 + s * 0.928;
  m[3] = 0.213 - c * 0.213 + s * 0.143; m[4] = 0.715 + c * 0.285 + s * 0.14; m[5] = 0.072 - c * 0.072 - s * 0.283;
  m[6] = 0.213 - c * 0.213 - s * 0.787; m[7] = 0.715 - c * 0.715 + s * 0.715; m[8] = 0.072 + c * 0.928 + s * 0.072;
  const lut = S.lut;
  let k = 0;
  for (let n = 0; n < LUTN; n++) {
    const f = n / (LUTN - 1);
    while (k < RAMP.length - 2 && f > RAMP[k + 1][0]) k++;
    const a = RAMP[k], b = RAMP[k + 1], t = cl((f - a[0]) / (b[0] - a[0]), 0, 1);
    const r = a[1] + (b[1] - a[1]) * t, g = a[2] + (b[2] - a[2]) * t, bl = a[3] + (b[3] - a[3]) * t;
    lut[n * 3] = cl(r * m[0] + g * m[1] + bl * m[2], 0, 255);
    lut[n * 3 + 1] = cl(r * m[3] + g * m[4] + bl * m[5], 0, 255);
    lut[n * 3 + 2] = cl(r * m[6] + g * m[7] + bl * m[8], 0, 255);
  }
  for (let q = 0; q < 2; q++) {
    const v = q ? CORE : GLOW;
    S.hot[q * 3] = v[0] * m[0] + v[1] * m[1] + v[2] * m[2];
    S.hot[q * 3 + 1] = v[0] * m[3] + v[1] * m[4] + v[2] * m[5];
    S.hot[q * 3 + 2] = v[0] * m[6] + v[1] * m[7] + v[2] * m[8];
  }
  S.hueAt = hue;
}

// A 3 x 3 blur of a padded field into out, centre weight 1 - 2 BLUR on each axis.
function blur(a, tmp, out) {
  const c = 1 - 2 * BLUR;
  edges(a);
  for (let y = 0; y < PH; y++) for (let i = y * PW + 1, e = y * PW + PW - 1; i < e; i++) tmp[i] = BLUR * a[i - 1] + c * a[i] + BLUR * a[i + 1];
  for (let y = 1; y <= H; y++) for (let i = y * PW + 1, e = i + W; i < e; i++) out[i] = BLUR * tmp[i - PW] + c * tmp[i] + BLUR * tmp[i + PW];
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  hueMatrix(S, cl(S.kn[0], 0, 1));
  const lut = S.lut, hot = S.hot, bs = S.bs, bu = S.bu;
  blur(S.s, S.g, bs);
  blur(S.u, S.g, bu);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y + 1) * PW + x + 1, n = ((cl(bs[i], 0, 1) * (LUTN - 1)) | 0) * 3, uu = cl(bu[i], 0, 1), u2 = uu * uu, g1 = uu * Math.sqrt(uu), g4 = u2 * u2;
      display.setPixel(x, y, cl(lut[n] + hot[0] * g1 + hot[3] * g4, 0, 255) | 0, cl(lut[n + 1] + hot[1] * g1 + hot[4] * g4, 0, 255) | 0, cl(lut[n + 2] + hot[2] * g1 + hot[5] * g4, 0, 255) | 0);
    }
  }
}
