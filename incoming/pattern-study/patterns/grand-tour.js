// ===== Patternflow pattern =====
// Title:   Grand Tour
// Family:  grandtour
// Idea:    The shadow of four hundred and eighty points in eight dimensions, six clusters each in a colour of its own, on a window that turns through every plane at once, so clusters that lie on top of each other in one view pull apart in the next, with a guide that steers the turn toward views where the six stand apart or toward views where they melt into one blob.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the grand tour, a smooth path of 2-D projections through high-dimensional data (Daniel Asimov 1985, from memory); projection pursuit, an index of how interesting a view is that picks the view (Friedman and Tukey 1974, from memory) and its steering of a tour by the index, the guided tour (Cook, Buja, Cabrera and Hurley 1995, from memory); the Bhattacharyya overlap of two Gaussians as the index (Bhattacharyya 1943, from memory); the turn as a product of Givens rotations in all 28 coordinate planes, the Ornstein-Uhlenbeck drift of the clusters, the slides of one cluster through another and the depth discs are original, pattern round 245
// Round:   245
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tour=0..4, Guide=-1..1, Spread=-1..1
//
// Knob 1: Hue. Turns all six cluster colours round the wheel together. At 0 the clusters are an amber, a leaf green, a cyan, a blue violet, a magenta and a coral, spaced unevenly; each also wanders a few degrees about that, so no two minutes have the same colours.
// Knob 2: Tour. 0 to 4, opening at 2. How fast the window turns. At 0 the view nearly stops, and the points still shiver about where they are; at 2 a view gives way to another in about ten seconds; at 4 the cloud turns twice as fast.
// Knob 3: Guide. -1 to 1, opening at 0. Steers the turn by how well the six clusters stand apart in the window. At 0 it is the plain tour. At 1 the window is pushed toward views where the six are separate blobs, and holds one until the clusters drift to where it no longer works; at -1 it is pushed toward views where they pile into one blob, whose colours mix.
// Knob 4: Spread. -1 to 1, opening at about 0.06. How broad each cluster is against the distance between clusters. At -1 six tight points of light with dark between; at 0 six blobs that touch and overlap as the window turns; at 1 broad clouds that overlap in every view.

const W = 64, H = 128;
const D = 8, NC = 6, NP = 80, N = NC * NP;       // dimensions, clusters, points a cluster
const NPL = (D * (D - 1)) / 2;                     // coordinate planes
const { floor, min, max, abs, exp, log, sqrt, sin, cos, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 2;   // variance 1, three draws
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

const MEAN_SD = 1.6;           // spread of the cluster means, per axis
const HOME_TAU = 110;          // seconds the homes of the means take to forget where they were
const MEAN_TAU = 8;            // seconds a mean takes to follow its home
const JIT_SD = 0.07, JIT_TAU = 3;     // the shiver of every coordinate of every point
const SHAPE_TAU = 40;          // seconds a cluster's shape takes to turn over
const WMIN = 0.01, WMAX = 0.12;       // rad/s of the slowest and fastest plane
const GAIN_X = 15, GAIN_Y = 30;         // LED a standard deviation of the cloud takes, across and down
const REF_S = Math.pow(1.7, 0.35);    // the spread of the shadow in a typical window
const LIM_X = 30, LIM_Y = 62;         // where the soft clip stands, LED from the middle
const HUES = [0.108, 0.285, 0.5, 0.675, 0.835, 0.0];   // amber, leaf, cyan, blue violet, magenta, coral
const SATS = [0.82, 0.74, 0.7, 0.62, 0.7, 0.78];

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const m = i % 6;
  out[0] = m === 0 || m === 5 ? v : m === 1 ? q : m === 4 ? t : p;
  out[1] = m === 1 || m === 2 ? v : m === 0 ? t : m === 3 ? q : p;
  out[2] = m === 3 || m === 4 ? v : m === 2 ? t : m === 5 ? q : p;
}

// ---- state --------------------------------------------------------------------
function planeSpeeds() {
  const om = [];
  // 28 angular speeds, no two of them in a ratio of small whole numbers, so the turn never closes on itself
  for (let k = 0; k < NPL; k++) {
    let best = 0, bestScore = -1;
    for (let tries = 0; tries < 60; tries++) {
      const w = WMIN * Math.pow(WMAX / WMIN, rnd());
      let score = 9;
      for (let j = 0; j < k; j++) {
        const r = w > om[j] ? w / om[j] : om[j] / w;
        for (let q = 1; q <= 6; q++) {
          for (let p = q; p <= 7; p++) score = min(score, abs(r - p / q) / (p / q));
        }
      }
      if (score > bestScore) { bestScore = score; best = w; }
      if (score > 0.04) break;
    }
    om.push(best);
  }
  return om;
}

export function setup(params) {
  const f = (n) => new Float64Array(n);
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, frame: 0,
    ks: [2, 0, 0.06],                       // smoothed Tour, Guide, Spread
    F: f(3 * D), om: planeSpeeds(), pa: [], pb: [], dth: f(NPL), G: f(NPL),
    mean: f(NC * D), home: f(NC * D), sc: f(NC * D), vr: f(NC * D),
    z: f(N * D), jt: f(N * D), cs: f(NC * 5), f16: f(16), g16: f(16),
    slide: 30 + 30 * rnd(), shapeAcc: 0,
    sx: new Float32Array(N), sy: new Float32Array(N), sd: new Float32Array(N), rr: new Float32Array(N), am: new Float32Array(N),
    m: [0, 0, 0], s: [1, 1, 1], ph: [0, 1, 2, 3, 4, 5, 6, 7].map(() => rnd() * TAU),
    col: new Float32Array(NC * 3), gnd: [0, 0, 0],
    fb: new Float32Array(W * H * 3), tr: new Float32Array(W * H * 3),
  });
  for (let a = 0; a < D; a++) for (let b = a + 1; b < D; b++) { st.pa.push(a); st.pb.push(b); }
  for (let i = 0; i < NC * D; i++) {
    st.home[i] = MEAN_SD * gauss();
    st.mean[i] = st.home[i];
    st.sc[i] = 0.25 * Math.pow(0.8 / 0.25, rnd());           // log-uniform, 0.25 to 0.8
  }
  for (let i = 0; i < N * D; i++) { st.z[i] = gauss(); st.jt[i] = JIT_SD * gauss(); }
  // a random orthonormal frame
  for (let i = 0; i < 3 * D; i++) st.F[i] = gauss();
  orthonormalise(st.F);
  return st;
}

function orthonormalise(F) {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < i; j++) {
      let d = 0;
      for (let c = 0; c < D; c++) d += F[i * D + c] * F[j * D + c];
      for (let c = 0; c < D; c++) F[i * D + c] -= d * F[j * D + c];
    }
    let n = 0;
    for (let c = 0; c < D; c++) n += F[i * D + c] * F[i * D + c];
    n = 1 / sqrt(n + 1e-30);
    for (let c = 0; c < D; c++) F[i * D + c] *= n;
  }
}

function givens(F, a, b, th) {
  const c = cos(th), s = sin(th);
  for (let i = 0; i < 3; i++) {
    const xa = F[i * D + a], xb = F[i * D + b];
    F[i * D + a] = c * xa - s * xb;
    F[i * D + b] = s * xa + c * xb;
  }
}

// ---- the index ----------------------------------------------------------------
// How much the six clusters overlap in the window f (two rows of eight): the mean over the 15 pairs of the Bhattacharyya
// coefficient of the two projected Gaussians. 1 is every pair on top of each other, 0 is every pair apart.
function overlap(st, f) {
  const m = st.mean, vr = st.vr, cs = st.cs;
  for (let c = 0; c < NC; c++) {
    const o = c * D, q = c * 5;
    let mu = 0, mv = 0, a = 0, b = 0, d2 = 0;
    for (let d = 0; d < D; d++) {
      const u = f[d], v = f[8 + d], s = vr[o + d];
      mu += u * m[o + d];
      mv += v * m[o + d];
      a += u * u * s;
      b += u * v * s;
      d2 += v * v * s;
    }
    cs[q] = mu; cs[q + 1] = mv; cs[q + 2] = a; cs[q + 3] = b; cs[q + 4] = d2;
  }
  let sum = 0;
  for (let c = 0; c < NC; c++) {
    const q = c * 5, dc = cs[q + 2] * cs[q + 4] - cs[q + 3] * cs[q + 3];
    for (let e = c + 1; e < NC; e++) {
      const r = e * 5;
      const sxx = 0.5 * (cs[q + 2] + cs[r + 2]), sxy = 0.5 * (cs[q + 3] + cs[r + 3]), syy = 0.5 * (cs[q + 4] + cs[r + 4]);
      const det = sxx * syy - sxy * sxy, de = cs[r + 2] * cs[r + 4] - cs[r + 3] * cs[r + 3];
      const dx = cs[q] - cs[r], dy = cs[q + 1] - cs[r + 1];
      const qf = (syy * dx * dx - 2 * sxy * dx * dy + sxx * dy * dy) / det;
      sum += exp(-(qf / 8 + 0.25 * log(det * det / (dc * de))));
    }
  }
  return sum / 15;
}

// d overlap / d angle in each of the 28 coordinate planes, by central differences
function gradient(st) {
  const F = st.F, f = st.f16, g = st.g16, G = st.G, e = 0.04;
  for (let i = 0; i < D; i++) { f[i] = F[i]; f[8 + i] = F[D + i]; }
  for (let k = 0; k < NPL; k++) {
    const a = st.pa[k], b = st.pb[k];
    let r = 0;
    for (let sg = -1; sg <= 1; sg += 2) {
      const c = cos(sg * e), s = sin(sg * e);
      for (let i = 0; i < 16; i++) g[i] = f[i];
      for (let row = 0; row < 2; row++) {
        const xa = f[row * 8 + a], xb = f[row * 8 + b];
        g[row * 8 + a] = c * xa - s * xb;
        g[row * 8 + b] = s * xa + c * xb;
      }
      r += sg * overlap(st, g);
    }
    G[k] = r / (2 * e);
  }
}

// ---- one step -----------------------------------------------------------------
function sim(st, dt) {
  const kv = st.k, ks = st.ks;
  st.t += dt;
  st.frame++;
  const ka = 1 - exp(-dt / 0.35);
  ks[0] += (cl(kv[1], 0, 4) - ks[0]) * ka;
  ks[1] += (cl(kv[2], -1, 1) - ks[1]) * ka;
  ks[2] += (cl(kv[3], -1, 1) - ks[2]) * ka;
  const guide = ks[1], rad = exp(1.05 * ks[2]);

  // the clusters: homes wander (Ornstein-Uhlenbeck), means follow their homes
  const hs = MEAN_SD * sqrt((2 * dt) / HOME_TAU), kh = dt / HOME_TAU, km = 1 - exp(-dt / MEAN_TAU);
  const { home, mean, sc, vr } = st;
  for (let i = 0; i < NC * D; i++) {
    home[i] += -home[i] * kh + hs * gauss();
    mean[i] += (home[i] - mean[i]) * km;
  }
  st.slide -= dt;
  if (st.slide <= 0) {
    // one cluster is sent through another: its home becomes the mirror image of where it is, across the other's mean
    st.slide = 35 + 40 * rnd();
    const a = floor(rnd() * NC);
    const b = (a + 1 + floor(rnd() * (NC - 1))) % NC;
    for (let d = 0; d < D; d++) home[a * D + d] = 2 * mean[b * D + d] - mean[a * D + d];
  }
  for (let i = 0; i < NC * D; i++) vr[i] = (rad * sc[i]) * (rad * sc[i]) + JIT_SD * JIT_SD;

  // the shiver of each coordinate, every frame; the shapes of the clusters turn over more slowly, every fourth
  const { jt, z } = st;
  const js = JIT_SD * sqrt((2 * dt) / JIT_TAU), jk = dt / JIT_TAU;
  for (let i = 0; i < N * D; i++) jt[i] += -jt[i] * jk + js * gauss();
  st.shapeAcc += dt;
  if (st.frame % 4 === 0) {
    const sa = st.shapeAcc, zs = sqrt((2 * sa) / SHAPE_TAU), zk = sa / SHAPE_TAU;
    st.shapeAcc = 0;
    for (let i = 0; i < N * D; i++) z[i] += -z[i] * zk + zs * gauss();
  }

  // the window turns: the tour plus, when Guide is not zero, a push along the gradient of the overlap
  const F = st.F, om = st.om, dth = st.dth, G = st.G;
  const tour = (0.03 + 0.97 * (ks[0] / 2)) * (1 - 0.55 * abs(guide));
  for (let k = 0; k < NPL; k++) dth[k] = om[k] * tour;
  if (abs(guide) > 0.01) {
    gradient(st);
    let n2 = 0;
    for (let k = 0; k < NPL; k++) n2 += G[k] * G[k];
    const push = (-guide * 0.55) / sqrt(0.1 + n2);   // toward less overlap for Guide > 0, rad/s at most 0.55 in all
    for (let k = 0; k < NPL; k++) dth[k] += push * G[k];
  }
  for (let k = 0; k < NPL; k++) givens(F, st.pa[k], st.pb[k], dth[k] * dt);
  orthonormalise(F);

  // the shadow of the cloud on the window, and its depth
  const { sx, sy, sd } = st;
  let mu = 0, mv = 0, mw = 0, uu = 0, vv = 0, ww = 0;
  for (let c = 0; c < NC; c++) {
    const o = c * D;
    for (let p = 0; p < NP; p++) {
      const i = c * NP + p, q = i * D;
      let pu = 0, pv = 0, pw = 0;
      for (let d = 0; d < D; d++) {
        const x = mean[o + d] + rad * sc[o + d] * z[q + d] + jt[q + d];
        pu += F[d] * x;
        pv += F[D + d] * x;
        pw += F[2 * D + d] * x;
      }
      sx[i] = pu; sy[i] = pv; sd[i] = pw;
      mu += pu; mv += pv; mw += pw;
      uu += pu * pu; vv += pv * pv; ww += pw * pw;
    }
  }
  mu /= N; mv /= N; mw /= N;
  const su = sqrt(max(1e-6, uu / N - mu * mu)), sv = sqrt(max(1e-6, vv / N - mv * mv)), sw = sqrt(max(1e-6, ww / N - mw * mw));
  // a view that comes out thin is never stretched past three to one against the other axis
  const fl = 0.34 * max(su, sv);
  const tu = max(su, fl), tv = max(sv, fl);
  const m = st.m, s = st.s;
  if (!st.init) {
    m[0] = mu; m[1] = mv; m[2] = mw; s[0] = tu; s[1] = tv; s[2] = sw;
  } else {
    const kg = 1 - exp(-dt / 1.6);
    m[0] += (mu - m[0]) * kg; m[1] += (mv - m[1]) * kg; m[2] += (mw - m[2]) * kg;
    s[0] += (tu - s[0]) * kg; s[1] += (tv - s[1]) * kg; s[2] += (sw - s[2]) * kg;
  }
  // the gain follows the spread of the shadow, but only most of the way: a window where the six pile into one blob stays a blob
  const gx = GAIN_X / (Math.pow(s[0], 0.65) * REF_S), gy = GAIN_Y / (Math.pow(s[1], 0.65) * REF_S), gz = 1 / s[2];
  const { rr, am } = st;
  for (let i = 0; i < N; i++) {
    sx[i] = W / 2 + LIM_X * tanh(((sx[i] - m[0]) * gx) / LIM_X);
    sy[i] = H / 2 + LIM_Y * tanh(((sy[i] - m[1]) * gy) / LIM_Y);
    const dz = 0.5 + 0.5 * tanh(0.75 * (sd[i] - m[2]) * gz);       // 0 far, 1 near
    rr[i] = 2.4 + 1.4 * dz;
    am[i] = 0.3 + 0.7 * dz * dz;
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || st.k;
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  if (!st.init) {
    st.ks = [cl(st.k[1], 0, 4), cl(st.k[2], -1, 1), cl(st.k[3], -1, 1)];
    for (let i = 0; i < 6; i++) sim(st, 1 / 30);
    st.init = true;
    for (let i = 0; i < 24; i++) sim(st, 1 / 30);
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  if (dt > 0) sim(st, dt);
}

// ---- the picture --------------------------------------------------------------
function colours(st) {
  const t = st.t, ph = st.ph, tmp = [0, 0, 0], col = st.col;
  const h0 = st.k[0] + 0.02 + 0.02 * sin(TAU * t / 97 + ph[0]);
  for (let c = 0; c < NC; c++) {
    hsv(h0 + HUES[c] + 0.022 * sin(TAU * t / (61 + 13 * c) + ph[1] + c), SATS[c], 1, tmp);
    // equal weight in light for every hue: a blue needs several times the red
    const lum = 0.3 * tmp[0] + 0.59 * tmp[1] + 0.11 * tmp[2], g = cl(0.62 / lum, 0.8, 2.6);
    col[c * 3] = tmp[0] * g;
    col[c * 3 + 1] = tmp[1] * g;
    col[c * 3 + 2] = tmp[2] * g;
  }
  hsv(h0 + 0.64, 0.9, 0.03, st.gnd);
}

export function draw(display, params) {
  let st = params.st;
  if (!st) st = setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  colours(st);
  const { fb, tr, sx, sy, rr, am, col, gnd } = st;
  const A0 = 0.25;
  fb.fill(0);
  for (let i = 0; i < N; i++) {
    const cx = sx[i], cy = sy[i], R = rr[i], R2 = R * R, a = A0 * am[i], c = floor(i / NP) * 3;
    const cr = col[c] * a, cg = col[c + 1] * a, cb = col[c + 2] * a;
    const x0 = max(0, floor(cx - R)), x1 = min(W - 1, floor(cx + R)), y0 = max(0, floor(cy - R)), y1 = min(H - 1, floor(cy + R));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, r2 = dx * dx + dy * dy;
        if (r2 >= R2) continue;
        const u = 1 - r2 / R2, w = u * u, p = (y * W + x) * 3;
        fb[p] += cr * w;
        fb[p + 1] += cg * w;
        fb[p + 2] += cb * w;
      }
    }
  }
  const TRAIL = 0.0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, p = i * 3, d = BAYER[((y & 3) << 2) | (x & 3)];
      let r = fb[p], g = fb[p + 1], b = fb[p + 2];
      if (TRAIL > 0) {
        r += TRAIL * tr[p]; g += TRAIL * tr[p + 1]; b += TRAIL * tr[p + 2];
        tr[p] = fb[p] + tr[p] * 0.5; tr[p + 1] = fb[p + 1] + tr[p + 1] * 0.5; tr[p + 2] = fb[p + 2] + tr[p + 2] * 0.5;
      }
      const v = max(r, g, b);
      if (v > 0.002) {
        const k = (1 - exp(-1.3 * Math.pow(v, 0.7))) / v;
        r *= k; g *= k; b *= k;
      }
      display.setPixel(
        x, y,
        cl(floor(255 * (gnd[0] + r * (1 - gnd[0])) + d), 0, 255),
        cl(floor(255 * (gnd[1] + g * (1 - gnd[1])) + d), 0, 255),
        cl(floor(255 * (gnd[2] + b * (1 - gnd[2])) + d), 0, 255),
      );
    }
  }
}
