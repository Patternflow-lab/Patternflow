// ===== Patternflow pattern =====
// Title:   Posterior Ribbon
// Family:  gaussianprocess
// Idea:    Gaussian process regression drawn as a luminous ribbon scrolling up the panel: points arrive at a line near the bottom with the value across the width, an indigo haze whose width is the model's doubt pinches to a pale thread at every point and opens into a trumpet below the line where nothing has been seen, and five coloured paths drawn from the posterior pass through the data and fan out into the forecast.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Gaussian process regression and kriging (Danie Krige, 1951; Georges Matheron, 1960s; Carl Rasmussen and Christopher Williams, Gaussian Processes for Machine Learning, 2006, all from memory), random Fourier features for the hidden function and the five prior draws (Ali Rahimi and Ben Recht, 2007, from memory), and pathwise conditioning, which turns a prior draw into a posterior draw by Matheron's update rule (James Wilson, Viacheslav Borovitskiy, Alexander Terenin, Peter Mostowsky and Marc Deisenroth, 2020, from memory); pattern round 233
// Round:   233
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.5..4, Length=-1..1, Noise=0.03..0.6
//
// Knob 1: Hue. Turns the indigo haze, the pale-blue thread, the five path colours and the white-gold points together round the colour wheel: indigo with amber, mint, rose, sky and lilac paths at 0, the same set turned a quarter of the way round at 0.25, and back where it began at 1.
// Knob 2: Pace. Scroll speed and the arrival of points together: 6 LED a second and 0.75 points a second at 2, 1.5 LED a second and a point every 5 seconds at 0.5, 12 LED a second and 1.5 points a second at 4, so about 11 points are in view at every setting.
// Knob 3: Length. How far a point speaks for its neighbours, the kernel length scale: 5 LED at -1, with points 6.5 LED apart, so the ribbon pinches at every point, balloons between them and the paths shake; 8 LED at 0, points 8 apart; 12 LED at 1, points 10 apart, so the ribbon stays narrow across a gap of 20 rows and the paths lean in slower curves.
// Knob 4: Noise. How far the points scatter from the truth under them and how much the model believes them: 0.03 at the minimum puts every dot on a thread about 3 LED across, 0.6 at the maximum scatters the dots about 7 LED either side and leaves the ribbon about 10 LED across even at a point.

const W = 64;
const H = 128;
const { floor, sqrt, exp, log, cos, abs, min, max, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => sqrt(-2 * log(Math.random() || 1e-9)) * cos(TAU * Math.random());

const R0 = 92; // the present line: points arrive here, the past is above it
const SC = 13.5; // LED across for one unit of the function, so plus or minus 2.4 sd fits the width
const CX = 32; // value 0
const ELL0 = 8; // LED, the kernel length scale at the opening
const SPEED0 = 3; // LED a second for one unit of Pace
const D = 80; // random Fourier features in one draw
const NS = 5; // posterior paths
const MAXN = 28; // most points held, the ones leaving included
const EXIT = -3; // row where a point is dropped, above the top edge
const SDMIN = 1.15 / SC; // the thread is never thinner than about 2.7 LED across
const BLOOM = 4; // LED, the bloom's sd across a thread
const BLOOMA = 0.2; // its brightness at the thread
const SD0 = 0.2; // posterior sd up to which the haze is at full brightness
const NROW = H + 2; // rows -1 to H, so the slope at the edges is known

// the haze, from dark to the thread's core
const STOPS = [
  [0, 0, 0, 0],
  [0.1, 17, 12, 58],
  [0.25, 46, 34, 130],
  [0.45, 80, 66, 206],
  [0.7, 128, 154, 250],
  [0.9, 198, 228, 255],
  [1, 236, 246, 255],
];
const PATHS = [
  [255, 178, 62], // amber
  [112, 238, 184], // mint
  [255, 124, 170], // rose
  [112, 206, 255], // sky
  [194, 154, 255], // lilac
];
const DOT = [255, 242, 198];
const LUTN = 512;

// ---- colour: Hue turns the hue and keeps each colour's saturation and brightest channel, so a turned haze is never a dim brown
function turn(c, hue) {
  const r = c[0] / 255;
  const g = c[1] / 255;
  const b = c[2] / 255;
  const mx = max(r, g, b);
  const d = mx - min(r, g, b);
  let h = 0;
  if (d > 0) {
    h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  h = (h + hue) % 1;
  const s = mx > 0 ? d / mx : 0;
  const i = floor(h * 6);
  const f = h * 6 - i;
  const p = mx * (1 - s);
  const q = mx * (1 - f * s);
  const t = mx * (1 - (1 - f) * s);
  const rgb = [[mx, t, p], [q, mx, p], [p, mx, t], [p, q, mx], [t, p, mx], [mx, p, q]][i % 6];
  return [rgb[0] * 255, rgb[1] * 255, rgb[2] * 255];
}

function buildPalette(P, hue) {
  const ang = hue;
  const lut = new Float32Array(LUTN * 3);
  const st = STOPS.map((s) => [s[0], ...turn([s[1], s[2], s[3]], ang)]);
  for (let i = 0; i < LUTN; i++) {
    const v = i / (LUTN - 1);
    let a = 0;
    while (a < st.length - 2 && v > st[a + 1][0]) a++;
    const f = (v - st[a][0]) / (st[a + 1][0] - st[a][0]);
    for (let ch = 0; ch < 3; ch++) lut[i * 3 + ch] = st[a][1 + ch] + (st[a + 1][1 + ch] - st[a][1 + ch]) * f;
  }
  P.lut = lut;
  P.paths = PATHS.map((c) => turn(c, ang));
  P.dot = turn(DOT, ang);
  P.palHue = hue;
}

// ---- random Fourier features: a draw of a Gaussian process with the unit-length RBF kernel, g(a) = sum w cos(z a + b)
function makeDraw() {
  const z = new Float64Array(D);
  const b = new Float64Array(D);
  const w = new Float64Array(D);
  const amp = sqrt(2 / D);
  for (let i = 0; i < D; i++) {
    z[i] = gauss();
    b[i] = TAU * Math.random();
    w[i] = amp * gauss();
  }
  return { z, b, w };
}

function evalDraw(g, a) {
  let s = 0;
  for (let i = 0; i < D; i++) s += g.w[i] * cos(g.z[i] * a + g.b[i]);
  return s;
}

// ---- setup
export function setup(P) {
  Object.assign(P, {
    obs: [],
    T: 0, // where the present line sits in the unit-length coordinate the draws are written in
    wait: 0,
    warm: false,
    pace: 2,
    ell: ELL0,
    sig: 0.06,
    hue: 0,
    truth: makeDraw(),
    pri: [0, 1, 2, 3, 4].map(() => makeDraw()),
    K: new Float64Array(MAXN * MAXN),
    yv: new Float64Array(MAXN),
    nv: new Float64Array(MAXN),
    w0: new Float64Array(MAXN),
    wj: [0, 1, 2, 3, 4].map(() => new Float64Array(MAXN)),
    rr: new Float64Array(MAXN),
    hv: new Float32Array(W * H),
    tmp: new Float64Array(MAXN),
    kv: new Float64Array(MAXN),
    vv: new Float64Array(MAXN),
    mean: new Float32Array(NROW),
    sd: new Float32Array(NROW),
    path: [0, 1, 2, 3, 4].map(() => new Float32Array(NROW)),
    buf: new Float32Array(W * H * 3),
    lut: null,
    palHue: -1,
  });
  buildPalette(P, 0);
}

// ---- the stream of points
function ramp(P, d, speed) {
  const dur = cl(5 / speed, 0.35, 1.6);
  const fall = speed * dur;
  const obs = P.obs;
  for (let i = obs.length - 1; i >= 0; i--) {
    const o = obs[i];
    o.yc -= speed * d;
    o.age += d;
    if (o.yc < EXIT) {
      obs.splice(i, 1);
      continue;
    }
    // Rising when it arrives and falling away before it leaves, so the posterior changes smoothly and never snaps.
    o.u = min(sm(0, dur, o.age), sm(0, fall, o.yc - EXIT));
  }
}

function step(P, d) {
  const speed = SPEED0 * P.pace;
  // Points come about 4 LED plus half a length scale apart: a longer length scale needs fewer of them, so the gaps between them show.
  const rate = speed / (4 + 0.5 * P.ell);
  P.T += (speed * d) / P.ell;
  P.wait -= d;
  while (P.wait <= 0) {
    const ago = -P.wait;
    if (P.obs.length < MAXN - 2) {
      const ta = P.T - (speed * ago) / P.ell;
      P.obs.push({ yc: R0 - speed * ago, age: ago, u: 0, f: evalDraw(P.truth, ta), e: gauss(), xi: [gauss(), gauss(), gauss(), gauss(), gauss()] });
    }
    // Two exponential waits in a row: still random, but without the 40-row gaps a plain Poisson stream leaves now and then.
    P.wait += -log((Math.random() || 1e-9) * (Math.random() || 1e-9)) / (2 * rate);
  }
  ramp(P, d, speed);
}

export function update(dt, input, P) {
  if (!P.obs) setup(P);
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.pace = cl(k[1], 0.5, 4);
  const kl = cl(k[2], -1, 1);
  P.ell = ELL0 * Math.pow(kl < 0 ? 1.6 : 1.5, kl);
  P.sig = cl(k[3], 0.03, 0.6);
  if (!P.warm) {
    P.warm = true;
    // Open on a ribbon that has been running for a while: the whole panel of past, and a few seconds more.
    const speed = SPEED0 * P.pace;
    const n = Math.round(((R0 + 8) / speed + 4) / 0.1);
    for (let i = 0; i < n; i++) step(P, 0.1);
  }
  step(P, d);
  solve(P);
}

// ---- the posterior: exact Gaussian process formulas on at most 28 points, and Matheron's rule for the paths
function chol(A, n) {
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = A[i * n + j];
      for (let q = 0; q < j; q++) s -= A[i * n + q] * A[j * n + q];
      if (i === j) A[i * n + i] = sqrt(s > 1e-12 ? s : 1e-12);
      else A[i * n + j] = s / A[j * n + j];
    }
}

function fwd(L, n, b, out) {
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let q = 0; q < i; q++) s -= L[i * n + q] * out[q];
    out[i] = s / L[i * n + i];
  }
}

function back(L, n, b, out) {
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let q = i + 1; q < n; q++) s -= L[q * n + i] * out[q];
    out[i] = s / L[i * n + i];
  }
}

function solve(P) {
  const obs = P.obs;
  const n = obs.length;
  const ell = P.ell;
  const sig = P.sig;
  const s2 = sig * sig;
  const inv = 0.5 / (ell * ell);
  const K = P.K;
  const tmp = P.tmp;
  const T = P.T;
  // The data: y = truth + noise at the current Noise; the noise variance climbs to infinity as a point's ramp falls to 0.
  for (let i = 0; i < n; i++) {
    const o = obs[i];
    o.y = o.f + sig * o.e;
    P.yv[i] = o.y;
    const uu = max(o.u, 0.001);
    P.nv[i] = s2 / (uu * uu * uu);
    for (let j = 0; j <= i; j++) {
      const dy = o.yc - obs[j].yc;
      const v = exp(-dy * dy * inv) + (i === j ? P.nv[i] : 0);
      K[i * n + j] = v;
      K[j * n + i] = v;
    }
  }
  chol(K, n);
  fwd(K, n, P.yv, tmp);
  const w0 = P.w0;
  back(K, n, tmp, w0);
  // Weights of the five paths: (K + noise)^-1 (y - prior(X) - noise draw)
  const wj = P.wj;
  const rr = P.rr;
  for (let j = 0; j < NS; j++) {
    const g = P.pri[j];
    for (let i = 0; i < n; i++) rr[i] = P.yv[i] - evalDraw(g, T + (obs[i].yc - R0) / ell) - sqrt(P.nv[i]) * obs[i].xi[j];
    fwd(K, n, rr, tmp);
    back(K, n, tmp, wj[j]);
  }
  const kv = P.kv;
  const vv = P.vv;
  for (let r = 0; r < NROW; r++) {
    const yc = r - 1 + 0.5;
    let m = 0;
    for (let i = 0; i < n; i++) {
      const dy = yc - obs[i].yc;
      kv[i] = exp(-dy * dy * inv);
      m += kv[i] * w0[i];
    }
    fwd(K, n, kv, vv);
    let q = 0;
    for (let i = 0; i < n; i++) q += vv[i] * vv[i];
    P.mean[r] = m;
    P.sd[r] = sqrt(max(1 - q, 1e-4));
    const a = T + (yc - R0) / ell;
    for (let j = 0; j < NS; j++) {
      let s = evalDraw(P.pri[j], a);
      const w = wj[j];
      for (let i = 0; i < n; i++) s += kv[i] * w[i];
      P.path[j][r] = s;
    }
  }
}

// ---- drawing
export function draw(display, P) {
  if (!P.mean) return;
  if (P.palHue !== P.hue) buildPalette(P, P.hue);
  const buf = P.buf;
  const lut = P.lut;
  buf.fill(0);
  P.hv.fill(0);
  // The haze: for every row a gaussian in the value, centred on the posterior mean, as wide as the doubt.
  for (let y = 0; y < H; y++) {
    const r = y + 1;
    const m = P.mean[r];
    const sdr = P.sd[r];
    const sde = sqrt(sdr * sdr + SDMIN * SDMIN);
    const amp = min(1, Math.pow(SD0 / sde, 0.8));
    const slope = cl((P.mean[r + 1] - P.mean[r - 1]) * 0.5 * SC, -8, 8);
    const thin = sm(0.45, 0.12, sdr);
    // On a steep stretch the thread widens along the row so it stays as thick across itself and does not break into steps.
    const sx = sqrt(sdr * sdr * SC * SC + SDMIN * SDMIN * SC * SC * (1 + slope * slope));
    // A faint wide bloom round a thin thread, so it glows instead of sitting on black.
    const sb = sqrt(sdr * sdr * SC * SC + BLOOM * BLOOM * (1 + slope * slope));
    const xc = CX + m * SC;
    const x0 = max(0, floor(xc - 3.6 * sb));
    const x1 = min(W - 1, floor(xc + 3.6 * sb));
    for (let x = x0; x <= x1; x++) {
      const z = (x + 0.5 - xc) / sx;
      const zb = (x + 0.5 - xc) / sb;
      const gz = exp(-0.5 * z * z);
      const bl = BLOOMA * thin * exp(-0.5 * zb * zb);
      const v = amp * gz + (1 - amp * gz) * bl;
      P.hv[y * W + x] = thin * gz;
      const li = ((v * (LUTN - 1)) | 0) * 3;
      const o = (y * W + x) * 3;
      buf[o] = lut[li];
      buf[o + 1] = lut[li + 1];
      buf[o + 2] = lut[li + 2];
    }
  }
  // The five paths: soft lines about 2 LED across, thicker along the row where the path is steep.
  for (let j = 0; j < NS; j++) {
    const c = P.paths[j];
    const pj = P.path[j];
    for (let y = 0; y < H; y++) {
      const r = y + 1;
      const xc = CX + pj[r] * SC;
      const slope = cl((pj[r + 1] - pj[r - 1]) * 0.5 * SC, -12, 12);
      const k = sqrt(1 + slope * slope);
      const ext = 2.6 * k + 1;
      const x0 = max(0, floor(xc - ext));
      const x1 = min(W - 1, floor(xc + ext));
      for (let x = x0; x <= x1; x++) {
        const dd = abs(x + 0.5 - xc) / k;
        const core = sm(1.9, 0.5, dd);
        const halo = 0.12 * exp(-(dd * dd) / (2 * 2.2 * 2.2));
        // Where the ribbon is a thread its core hides the paths under it, so they show where the doubt opens.
        const a = min(1, core + halo * (1 - core)) * (1 - sm(0.5, 0.9, P.hv[y * W + x]));
        const o = (y * W + x) * 3;
        for (let ch = 0; ch < 3; ch++) buf[o + ch] += (c[ch] - buf[o + ch]) * a;
      }
    }
  }
  // The present line, marked only at the two edges: a short soft tick each side at the row where the points arrive.
  const tk = ((0.85 * (LUTN - 1)) | 0) * 3;
  for (let y = R0 - 3; y <= R0 + 2; y++) {
    const a = 0.6 * sm(2.2, 0.7, abs(y + 0.5 - R0));
    for (let x = 0; x < 7; x++) {
      const t = a * sm(7, 3, x + 0.5);
      for (const xx of [x, W - 1 - x]) {
        const o = (y * W + xx) * 3;
        for (let ch = 0; ch < 3; ch++) buf[o + ch] += (lut[tk + ch] - buf[o + ch]) * t;
      }
    }
  }
  // The points: a bright dot about 3 LED across with a dark rim so it reads against the thread, and a bar of one noise sd when it is wide enough to see.
  const dc = P.dot;
  for (const o of P.obs) {
    const u = o.u;
    if (u < 0.02) continue;
    const xc = CX + o.y * SC;
    const yc = o.yc;
    const half = P.sig * SC;
    const reach = max(half, 0) + 4;
    const x0 = max(0, floor(xc - reach));
    const x1 = min(W - 1, floor(xc + reach));
    const y0 = max(0, floor(yc - 4));
    const y1 = min(H - 1, floor(yc + 4));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - xc;
        const dy = y + 0.5 - yc;
        const dist = sqrt(dx * dx + dy * dy);
        const o3 = (y * W + x) * 3;
        const rim = sm(3.2, 1.9, dist) * 0.35 * u;
        if (rim > 0) for (let ch = 0; ch < 3; ch++) buf[o3 + ch] *= 1 - rim;
        let a = sm(2.1, 0.9, dist);
        if (half > 2.4) {
          const bar = sm(1.5, 0.4, abs(dy)) * sm(half + 1, half - 0.5, abs(dx)) * 0.38;
          a = max(a, bar);
        }
        a *= u;
        if (a > 0) for (let ch = 0; ch < 3; ch++) buf[o3 + ch] += (dc[ch] - buf[o3 + ch]) * a;
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, min(255, buf[o]) | 0, min(255, buf[o + 1]) | 0, min(255, buf[o + 2]) | 0);
    }
}
