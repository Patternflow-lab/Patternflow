// ===== Patternflow pattern =====
// Title:   Tephra Fall
// Family:  tephra
// Idea:    A map of ash thickness around one volcanic vent, seen from above: eruptions of every size go off at irregular times, the wind turns slowly between them, and coarse grains drop near the vent while fine grains drift downwind and spread, so each blast lays a long lobe of ash that grows over a few seconds, the rain washes the old ones away, and the sum is coloured in half-decade isopach bands from cream through sulphur and coral to deep plum.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: placeholder
// Round:   275
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Wind=1..3.5, Fineness=-1..1, Rain=-1..1
//
// Knob 1: Hue. placeholder
// Knob 2: Wind. placeholder
// Knob 3: Fineness. placeholder
// Knob 4: Rain. placeholder

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
const BMEAN = 2.0;                 // the band the exposure holds the mean of the map at
const BTOP = 15.8;                 // and the band of its thickest point

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
  const fv = pow(1.8, -S.k[2]);
  // each eruption has its own grain mix, coarse rich or fine rich, and the Fineness knob leans on it
  const gm = 0.6 * gauss() - 0.55 * S.k[2], wc = new Float32Array(NCLS);
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
  const fv = pow(1.8, -S.k[2]);
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
  S.ex += (exposure(S) - S.ex) * (1 - exp(-d / 40));
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

// The exposure holds the mean of the map at band BMEAN and its thickest point at band BTOP, half and half, and follows over 40 s. The mean is
// taken over a sparse sample and floored at band -1 so bare ground does not drag it down.
function exposure(S) {
  liveWeights(S);
  const w0 = LW[0], w1 = LW[1], g = log(tauOf(S.k[3]) / S.tauEff) / STEP;
  let s = 0, n = 0, mx = 0;
  for (let i = 0; i < NP; i++) {
    const v = FC[i] * w0 + FF[i] * w1;
    if (v > mx) mx = v;
    if (i % 7 === 3) {
      s += max(log(v + 1e-12) / STEP + OFF + g, -1);
      n++;
    }
  }
  return cl(0.4 * (BMEAN - s / n) + 0.6 * (BTOP - (log(mx + 1e-12) / STEP + OFF + g)), -6, 6);
}

// ---------------------------------------------------------------- colour
const NB = 14;
const NR = 11;                     // colours in the ramp proper; three more fade the ground in under it
const SAW = 0.45;
const COL = new Float32Array((NB + 1) * 3);
const GROUND = [36, 42, 50];
// L, C, hue in degrees: thin to thick
const RAMP = [
  [0.40, 0.02, 85], [0.50, 0.03, 88], [0.60, 0.04, 90], [0.71, 0.05, 94], [0.79, 0.07, 98], [0.85, 0.105, 106],
  [0.80, 0.10, 62], [0.71, 0.13, 38], [0.61, 0.155, 18], [0.50, 0.16, 350], [0.40, 0.13, 326],
];
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
      // a saw inside each band, brightening toward the thicker edge and dropping at the contour
      const mm = j0 < 0 || j0 >= NB ? 1 : 1 + SAW * (0.35 + 0.65 * sm(1, 7, j0)) * (b - j0 - w + 0.5);
      display.setPixel(
        x, y,
        cl((COL[pl] + (COL[ph] - COL[pl]) * w) * mm + 0.5, 0, 255) | 0,
        cl((COL[pl + 1] + (COL[ph + 1] - COL[pl + 1]) * w) * mm + 0.5, 0, 255) | 0,
        cl((COL[pl + 2] + (COL[ph + 2] - COL[pl + 2]) * w) * mm + 0.5, 0, 255) | 0
      );
    }
  }
}
