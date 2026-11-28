// ===== Patternflow pattern =====
// Title:   Daisyworld
// Family:  daisyworld
// Idea:    White and black daisies cover a planet whose sun wanders from too cold to too hot, their patches lighten or darken the ground just enough to hold it near their best temperature until the sun gets too far gone, and a strip chart under the planet shows the same sun with the daisies and without them.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Daisyworld, a planet of white and black daisies on bare ground that holds its own temperature as its sun brightens (James Lovelock and Andrew Watson, 1983, from memory), with its parabolic growth rate, its death rate of 0.3, its albedos of 0.75, 0.25 and 0.5 and its offset of q kelvin per unit of albedo as I remember them, spatial versions of it with heat and seed diffusion (Alan Wood, Graeme Ackland and others, 2000s, from memory), the short-range activation and long-range inhibition of a Turing pattern (Alan Turing, 1952, from memory), original code, pattern round 278
// Round:   278
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sun=0..4, Spread=-1..1, Contrast=-1..1
//
// Knob 1: Hue. Added to every hue, ground, daisies and chart together. At 0 the ground is sand, the white daisies cream, the black ones indigo and the chart lime on navy; at 0.25 the whites are mint and the blacks maroon, at 0.5 pale lavender and olive, at 0.75 pink and dark teal. Light stays light and dark stays dark all the way round.
// Knob 2: Sun. A bias on the sun L, which also wanders on its own. L = 1.08 + bias, with bias = 0.07 (K - 2) below 2 and 0.13 (K - 2) above, so the middle of the wander sits at 0.94 at 0, 1.08 at 2 where it opens and 1.34 at 4. @K2@ The planet follows within 5 to 10 s because the daisies grow on a clock of 3 model units a second.
// Knob 3: Spread. How far heat and seeds travel, both together. The heat smoother has a variance of 10.5 x 2.6^K cells squared (sigma 2.0, 3.2 and 5.2 cells, 4, 6.5 and 10.4 LEDs at -1, 0 and 1) and seeds disperse by 0.0035 times that. With the sun held at 1.0, the correlation of white-minus-black falls under 0.5 at 4 LEDs at -1 (fine speckle), 6 at 0 and 10 at 1 (big soft patches).
// Knob 4: Contrast. The albedo offset q: a daisy is hotter or cooler than its heat neighbourhood by q times the difference in albedo, 9 K at -1, 39 K at 0.06 where it opens, 56 K at 1 (the original has 20 K). Low q lets the species blur into each other: in 35 percent of the cells neither leads at -1, 9 percent at the opening, 6 percent at 1, and the step of white-minus-black from one cell to the next is 0.10, 0.22 and 0.25. The warm rim along black patches grows with q.
//
// What the picture is. The top 96 rows are the planet seen from above, 32 x 48 cells of 2 x 2 LEDs that wrap round the edges, drawn with smooth interpolation. Cream is white daisies, indigo is black daisies, and the ground shows through where neither grows, tinted by its temperature: ice blue under 6 C, sand at 22 C, amber at 38 C, orange-red above. The bottom 32 rows are a strip chart, newest at the right and 0.6 s to a column, so 38 s across. The lime line is the planet's mean temperature, the dim coral line what bare ground would reach under the same sun, the lighter band is the 5 to 40 C window in which daisies grow, and a faint ruler scrolls with the lines. Nothing is a label: no digit, no axis.
// The model. Fields a_b, a_w (area fractions, a_b + a_w <= 1) and T on a torus. da_k/dt = a_k (bare beta(T_k) - 0.3) + D laplacian(a_k) + seed rain, beta(T) = max(0, 1 - 0.003265 (22.5 - T)^2), T_k = T + q (A - albedo_k), A the albedo of the cell. T relaxes, at a rate of 10 per model unit, to the radiative balance 295.65 K x (L (1 - A_s) / 0.5)^(1/4), A_s being the albedo smoothed by the heat kernel. Black and white are favoured where they cool or warm their own cell toward 22.5 C while the heat that sets the balance spreads wider than the offset: an activator and an inhibitor, so white and black domains stand and move by themselves. L goes 1.08 + 0.20 sin(t/190 s) + 0.16 sin(t/117 s) + 0.10 sin(t/71 s) + a random walk (sd 0.06, 40 s memory), phases at random; below 0.8 it is squeezed by 0.7.
// What is exact and what is drawn. The growth law, the death rate, the albedos, the optimum, the fourth-power balance and the offset are the model, and so are the domains and the regulation: the mean line sits within 3 K of 22.5 C over most of the wander and leaves it when the sun is too far gone. Added to the model are the Gaussian heat kernel, the sun not being even over the planet (five waves that cross the torus, sd 12.5 percent of L, and without them white-minus-black still has sd 0.46 against 0.52, so they decide where the domains stand, not whether), a growth jitter of 2 percent a step, a seed rain of 0.0002, the squeezing of L, and q beyond the original 20 K. The colours, the interpolation, the rim and the chart are drawing. The bare line leaves out everything but L.

const W = 64, H = 128;
const NX = 32, NY = 48, N = NX * NY;
const PH = 96;                 // rows of planet; the chart takes the rest
const { floor, round, sqrt, exp, sin, min, max, abs, pow, PI } = Math;
const random = () => Math.random();
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const lerp = (a, b, t) => a + (b - a) * t;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

const SPEED = 3;          // model time units per real second
const DT = 0.05;          // model step
const PRE = 45;           // real seconds run before the first frame
const GAMMA = 0.3;        // daisy death rate
const KB = 0.003265;      // width of the growth parabola
const TOPT = 22.5;        // best temperature, C
const T0K = 295.65;       // K at L = 1 on bare ground
const AW = 0.75, AB = 0.25, AG = 0.5;
const EPS = 2e-4;         // seed rain
const SIGMA = 0.02;       // jitter of the growth, per step
const V0 = 10.5;          // variance of the heat smoother at Spread 0, cells squared
const VK = 2.6;           // and its factor per unit of Spread
const DA = 0.0035;        // seed dispersal per unit of it
const PERIOD = [190, 117, 71, 131, 97];
const AMP = [0.20, 0.16, 0.10];
const LC = 1.08;
const COL = 0.6;          // real seconds per chart column
const NH = 72;
// the sun is not even over the planet: three waves that cross the torus
const GM = [[1, 1], [0, 2], [1, -2], [2, 1], [1, 3]];
const GP = [83, 61, 47, 37, 29];
const GA = [0.13, 0.09, 0.06, 0.045, 0.03];

export function setup(params) {
  const ph = [0, 0, 0, random() * TAU, random() * TAU];
  for (let tries = 0; tries < 40; tries++) {
    for (let i = 0; i < 3; i++) ph[i] = random() * TAU;
    const l0 = LC + AMP[0] * sin(ph[0]) + AMP[1] * sin(ph[1]) + AMP[2] * sin(ph[2]);
    if (l0 > 0.98 && l0 < 1.25) break;
  }
  const s = {
    ab: new Float32Array(N), aw: new Float32Array(N), T: new Float32Array(N),
    A: new Float32Array(N), Ab: new Float32Array(N), tmp: new Float32Array(N), nb: new Float32Array(N), nw: new Float32Array(N),
    gl: new Float32Array(N), ker: new Float32Array(64), kv: -1, R: 0,
    th: ph.slice(), gth: [random() * TAU, random() * TAU, random() * TAU, random() * TAU, random() * TAU], walk: 0, L: LC, k: null, acc: 0, gacc: 0,
    hw: new Float32Array(NH), hb: new Float32Array(NH), hacc: 0,
    stat: { L: 1, Tm: 22, Tb: 22, ab: 0, aw: 0 },
  };
  for (let i = 0; i < N; i++) { s.ab[i] = 0.1 + 0.2 * random(); s.aw[i] = 0.1 + 0.2 * random(); s.T[i] = 22; s.gl[i] = 1; }
  params.s = s;
}

function sunClock(S, dt) {
  for (let i = 0; i < 5; i++) S.th[i] += (TAU * dt) / PERIOD[i];
  for (let i = 0; i < 5; i++) S.gth[i] += (TAU * dt) / GP[i];
  S.walk += (-S.walk / 40) * dt + 0.0135 * sqrt(dt) * (random() + random() + random() - 1.5) * 2;
  const sun = S.k[1] - 2, bias = sun < 0 ? 0.07 * sun : 0.13 * sun;
  S.L = LC + bias + AMP[0] * sin(S.th[0]) + AMP[1] * sin(S.th[1]) + AMP[2] * sin(S.th[2]) + S.walk;
  if (S.L < 0.8) S.L = 0.8 - 0.7 * (0.8 - S.L);
}

function sunField(S) {
  const g = S.gl;
  const c = [0, 0, 0, 0, 0], sx = [0, 0, 0, 0, 0], sy = [0, 0, 0, 0, 0];
  for (let m = 0; m < 5; m++) { c[m] = GA[m]; sx[m] = (TAU * GM[m][0]) / NX; sy[m] = (TAU * GM[m][1]) / NY; }
  for (let y = 0; y < NY; y++) {
    for (let x = 0; x < NX; x++) {
      let v = 0;
      for (let m = 0; m < 5; m++) v += c[m] * sin(sx[m] * x + sy[m] * y + S.gth[m]);
      g[y * NX + x] = 1 + v;
    }
  }
}

function gblur(src, dst, tmp, ker, R) {
  // separable Gaussian smoother on the torus; ker holds 2R + 1 weights
  for (let y = 0; y < NY; y++) {
    const r = y * NX;
    for (let x = 0; x < NX; x++) {
      let acc = 0;
      for (let d = -R; d <= R; d++) acc += ker[d + R] * src[r + ((x + d + NX * 8) % NX)];
      tmp[r + x] = acc;
    }
  }
  for (let y = 0; y < NY; y++) {
    for (let x = 0; x < NX; x++) {
      let acc = 0;
      for (let d = -R; d <= R; d++) acc += ker[d + R] * tmp[((y + d + NY * 8) % NY) * NX + x];
      dst[y * NX + x] = acc;
    }
  }
}

function setKernel(S, v) {
  if (abs(v - S.kv) < 0.01 * v) return;
  S.kv = v;
  const R = min(NX / 2 - 1, Math.ceil(3 * sqrt(v)));
  let sum = 0;
  for (let d = -R; d <= R; d++) { const w = exp(-(d * d) / (2 * v)); S.ker[d + R] = w; sum += w; }
  for (let d = -R; d <= R; d++) S.ker[d + R] /= sum;
  S.R = R;
}

function push(S) {
  S.hw.copyWithin(1, 0, NH - 1); S.hb.copyWithin(1, 0, NH - 1);
  S.hw[0] = S.stat.Tm; S.hb[0] = S.stat.Tb;
}

function step(S, dt) {
  const { ab, aw, T, A, Ab, tmp, nb, nw, gl } = S, k = S.k;
  sunClock(S, dt / SPEED);
  S.gacc += dt;
  if (S.gacc >= 0.5) { S.gacc = 0; sunField(S); }
  const L = S.L;
  const kc = cl(k[3], -1, 1), q = 38 * exp(kc * (kc < 0 ? 1.44 : 0.388)) * (1 + 0.12 * sin(S.th[3]));
  S.q = q;
  const vT = V0 * pow(VK, cl(k[2], -1, 1)) * (1 + 0.3 * sin(S.th[4]));
  setKernel(S, vT);
  for (let i = 0; i < N; i++) A[i] = aw[i] * AW + ab[i] * AB + (1 - aw[i] - ab[i]) * AG;
  gblur(A, Ab, tmp, S.ker, S.R);
  const rt = 1 - exp(-10 * dt);
  const dd = DA * vT * dt;
  let sb = 0, sw = 0, sT = 0;
  for (let y = 0; y < NY; y++) {
    const yu = ((y + NY - 1) % NY) * NX, yd = ((y + 1) % NY) * NX, r = y * NX;
    for (let x = 0; x < NX; x++) {
      const i = r + x, xl = r + ((x + NX - 1) % NX), xr = r + ((x + 1) % NX);
      const f = L * gl[i] * (1 - Ab[i]) * 2;
      const Te = T0K * sqrt(sqrt(f)) - 273.15;
      T[i] += (Te - T[i]) * rt;
      const Tc = T[i], Ai = A[i];
      const eb = Tc + q * (Ai - AB) - TOPT, ew = Tc + q * (Ai - AW) - TOPT;
      const bb = max(0, 1 - KB * eb * eb), bw = max(0, 1 - KB * ew * ew);
      const b = ab[i], w = aw[i], bare = max(0, 1 - b - w);
      const lb = ab[xl] + ab[xr] + ab[yu + x] + ab[yd + x] - 4 * b;
      const lw = aw[xl] + aw[xr] + aw[yu + x] + aw[yd + x] - 4 * w;
      let vb = b + dt * b * (bare * bb - GAMMA) + dd * lb + EPS * dt;
      let vw = w + dt * w * (bare * bw - GAMMA) + dd * lw + EPS * dt;
      if (vb < 0) vb = 0; if (vw < 0) vw = 0;
      vb *= exp(SIGMA * (random() + random() + random() - 1.5));
      vw *= exp(SIGMA * (random() + random() + random() - 1.5));
      const tot = vb + vw;
      if (tot > 1) { vb /= tot; vw /= tot; }
      nb[i] = vb; nw[i] = vw;
      sb += vb; sw += vw; sT += Tc;
    }
  }
  ab.set(nb); aw.set(nw);
  const st = S.stat;
  st.L = L; st.Tm = sT / N; st.ab = sb / N; st.aw = sw / N;
  st.Tb = T0K * sqrt(sqrt(L)) - 273.15;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  let first = false;
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
    first = true;
  } else {
    const al = 1 - exp(-d / 0.2);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  if (first) {
    // the sun clocks are set back so that the pre-run ends where they were drawn
    for (let i = 0; i < 5; i++) S.th[i] -= (TAU * PRE) / PERIOD[i];
    for (let i = 0; i < 5; i++) S.gth[i] -= (TAU * PRE) / GP[i];
    sunField(S);
    const n = floor((PRE * SPEED) / 0.1), every = round((COL * SPEED) / 0.1);
    for (let i = 0; i < n; i++) { step(S, 0.1); if (i % every === every - 1) push(S); }
  } else {
    S.acc += d * SPEED;
    while (S.acc >= DT) { S.acc -= DT; step(S, DT); }
    S.hacc += d;
    while (S.hacc >= COL) { S.hacc -= COL; push(S); }
  }
}

// ---- drawing ----
const C = { wh: [0, 0, 0], bk: [0, 0, 0], rim: [0, 0, 0], bg0: [0, 0, 0], bg1: [0, 0, 0], band: [0, 0, 0], l1: [0, 0, 0], l2: [0, 0, 0] };
const ix0 = new Int16Array(W), ix1 = new Int16Array(W), fx = new Float32Array(W);
const iy0 = new Int16Array(PH), iy1 = new Int16Array(PH), fy = new Float32Array(PH);
for (let x = 0; x < W; x++) { const u = (x + 0.5) / 2 - 0.5, i = floor(u); fx[x] = u - i; ix0[x] = (i + NX) % NX; ix1[x] = (i + 1 + NX) % NX; }
for (let y = 0; y < PH; y++) { const u = (y + 0.5) / 2 - 0.5, i = floor(u); fy[y] = u - i; iy0[y] = ((i + NY) % NY) * NX; iy1[y] = ((i + 1 + NY) % NY) * NX; }

const GT = [[-30, 0.60, 0.65, 0.40], [-8, 0.58, 0.60, 0.62], [6, 0.54, 0.48, 0.74], [22.5, 0.085, 0.50, 0.66], [38, 0.065, 0.80, 0.90], [60, 0.035, 0.85, 0.80]];
const NL = 64, TL0 = -30, TL1 = 70;
const GLUT = new Float32Array(NL * 3);

function colours(h) {
  const t = [0, 0, 0];
  const set = (o, hh, s, v) => { hsv(hh + h, s, v, t); o[0] = t[0] * 255; o[1] = t[1] * 255; o[2] = t[2] * 255; };
  const st = GT.map((g) => { hsv(g[1] + h, g[2], g[3], t); return [g[0], t[0] * 255, t[1] * 255, t[2] * 255]; });
  for (let i = 0; i < NL; i++) {
    const T = TL0 + ((TL1 - TL0) * i) / (NL - 1);
    let j = 0;
    while (j < st.length - 2 && T > st[j + 1][0]) j++;
    const f = cl((T - st[j][0]) / (st[j + 1][0] - st[j][0]), 0, 1);
    for (let c = 0; c < 3; c++) GLUT[i * 3 + c] = lerp(st[j][c + 1], st[j + 1][c + 1], f);
  }
  set(C.wh, 0.11, 0.06, 0.80);
  set(C.bk, 0.71, 0.85, 0.34);
  set(C.rim, 0.06, 0.85, 0.85);
  set(C.bg0, 0.67, 0.55, 0.30);
  set(C.bg1, 0.63, 0.50, 0.40);
  set(C.band, 0.52, 0.45, 0.60);
  set(C.l1, 0.24, 0.80, 1.0);
  set(C.l2, 0.02, 0.65, 0.72);
}

const TLO = -20, THI = 68, YT = PH + 2, YB = H - 3;
const yOf = (T) => YB - ((T - TLO) / (THI - TLO)) * (YB - YT);
const HV = new Float32Array(2 * W + 2), HB2 = new Float32Array(2 * W + 2);

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.k) return;
  colours(S.k[0]);
  const { ab, aw, T } = S;
  const rimg = 0.16 * pow(S.q / 38, 0.9);
  for (let y = 0; y < PH; y++) {
    const ra = iy0[y], rb = iy1[y], wy = fy[y];
    for (let x = 0; x < W; x++) {
      const a = ra + ix0[x], b = ra + ix1[x], c = rb + ix0[x], d = rb + ix1[x], wx = fx[x];
      const w00 = (1 - wx) * (1 - wy), w10 = wx * (1 - wy), w01 = (1 - wx) * wy, w11 = wx * wy;
      const vb = ab[a] * w00 + ab[b] * w10 + ab[c] * w01 + ab[d] * w11;
      const vw = aw[a] * w00 + aw[b] * w10 + aw[c] * w01 + aw[d] * w11;
      const tc = T[a] * w00 + T[b] * w10 + T[c] * w01 + T[d] * w11;
      let cb = 0.94 * sm(0.03, 0.6, vb), cw = 0.96 * sm(0.03, 0.8, vw);
      const sc = cb + cw;
      if (sc > 1) { cb /= sc; cw /= sc; }
      const g = 1 - cb - cw;
      const gi = cl(((tc - TL0) / (TL1 - TL0)) * (NL - 1), 0, NL - 1.001), gj = floor(gi), gf = gi - gj, g3 = gj * 3;
      const gr = lerp(GLUT[g3], GLUT[g3 + 3], gf), gg0 = lerp(GLUT[g3 + 1], GLUT[g3 + 4], gf), gb = lerp(GLUT[g3 + 2], GLUT[g3 + 5], gf);
      const rimk = cb * (1 - cb) * 4 * rimg;
      const r = g * gr + cw * C.wh[0] + cb * C.bk[0] + rimk * C.rim[0];
      const gg = g * gg0 + cw * C.wh[1] + cb * C.bk[1] + rimk * C.rim[1];
      const bl = g * gb + cw * C.wh[2] + cb * C.bk[2] + rimk * C.rim[2];
      display.setPixel(x, y, r > 255 ? 255 : r | 0, gg > 255 ? 255 : gg | 0, bl > 255 ? 255 : bl | 0);
    }
  }
  // chart
  const phase = S.hacc / COL;
  const val = (arr, live, j) => {
    if (j <= 0) return phase < 1e-6 ? arr[0] : lerp(live, arr[0], cl((j + phase) / phase, 0, 1));
    const i = floor(j), f = j - i;
    return arr[i] + (arr[i + 1] - arr[i]) * f;
  };
  for (let x = 0; x <= W; x++) {
    HV[x] = yOf(val(S.hw, S.stat.Tm, W - x - phase));
    HB2[x] = yOf(val(S.hb, S.stat.Tb, W - x - phase));
  }
  const y5 = yOf(5), y40 = yOf(40);
  for (let y = PH; y < H; y++) {
    const yy = y + 0.5;
    const vgrad = (y - PH) / (H - PH);
    const bandk = sm(y40 - 1.2, y40 + 0.8, yy) * (1 - sm(y5 - 0.8, y5 + 1.2, yy));
    for (let x = 0; x < W; x++) {
      // bg
      let r = lerp(C.bg0[0], C.bg1[0], vgrad), g = lerp(C.bg0[1], C.bg1[1], vgrad), b = lerp(C.bg0[2], C.bg1[2], vgrad);
      r += (C.band[0] - r) * bandk * 0.45; g += (C.band[1] - g) * bandk * 0.45; b += (C.band[2] - b) * bandk * 0.45;
      if (y < PH + 2) { r *= 0.3; g *= 0.3; b *= 0.3; }
      else {
        // a faint time ruler that scrolls with the lines: a lighter column every 8 columns
        let u = (W - x - 0.5 - phase) % 8;
        if (u < 0) u += 8;
        const tk = max(0, 1 - abs(u - 0.5)) * 0.14;
        r += (255 - r) * tk; g += (255 - g) * tk; b += (255 - b) * tk;
      }
      // lines (sample at x+1 and x as the two ends of this column)
      const l2lo = min(HB2[x], HB2[x + 1]), l2hi = max(HB2[x], HB2[x + 1]);
      let d = yy < l2lo ? l2lo - yy : yy > l2hi ? yy - l2hi : 0;
      let cv = cl(1.5 - d, 0, 1) * 0.8;
      r += (C.l2[0] - r) * cv; g += (C.l2[1] - g) * cv; b += (C.l2[2] - b) * cv;
      const l1lo = min(HV[x], HV[x + 1]), l1hi = max(HV[x], HV[x + 1]);
      d = yy < l1lo ? l1lo - yy : yy > l1hi ? yy - l1hi : 0;
      cv = cl(1.5 - d, 0, 1);
      r += (C.l1[0] - r) * cv; g += (C.l1[1] - g) * cv; b += (C.l1[2] - b) * cv;
      display.setPixel(x, y, r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, b > 255 ? 255 : b | 0);
    }
  }
}
