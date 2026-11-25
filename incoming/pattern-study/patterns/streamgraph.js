// ===== Patternflow pattern =====
// Title:   Streamgraph
// Family:  streamgraph
// Idea:    A river of eleven pastel layers running down the panel, each layer a ribbon whose thickness swells and fades as random bumps arrive in it, with no flat baseline: the whole stream sways sideways so that the centres of its layers change slope as little as they can, now pinching to a thread, now widening to touch both edges, over a deep indigo ground of faint fibres.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the streamgraph and its wiggle baseline, which sets the baseline of a stack of layers so that the slopes of the layers' centres change least (Lee Byron and Martin Wattenberg, "Stacked Graphs - Geometry and Aesthetics", 2008, from memory); layer thicknesses as Poisson-arriving raised-cosine bumps, the symmetric and flat-left baselines to blend to, the sub-LED edges and the hairlines are original, pattern round 243
// Round:   243
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0..4, Churn=-1..1, Baseline=-1..1
//
// Knob 1: Hue. Turns the whole pastel scale and the ground round the wheel. At 0 the eleven layers run from mint through sky, lilac and rose to apricot and sand over an indigo ground; at 0.5 the mint end has become a rose and the sand end a blue-green.
// Knob 2: Flow. 0 to 4, opening at 2. How fast the picture runs down the panel: 6 rows a second at 0, 13 at 2 and 30 at 4. At 0 a swell takes about twenty seconds to cross the panel and the stream is still plainly moving.
// Knob 3: Churn. -1 to 1, opening at 0. How quickly the layers rise and fall along the stream. At -1 a swell is 50 to 100 rows long and a layer rests thin for a while between them. At 1 the bumps are 8 to 20 rows long, a dozen layers pinch and swell in one screen, and the contrast between thick and thin is stronger. New bumps are cut to the knob as they enter at the top and the contrast answers at once.
// Knob 4: Baseline. -1 to 1, opening near 0. Where the stack stands. At -1 the layers are stacked from the left edge on a straight baseline, an ordinary stacked area chart, and the right side shows ground. At 0 the baseline wiggles so the centres of the layers bend least, and the stream sways like a river. At 1 the stream is mirrored about the middle of the panel. In between the positions are blended.

const W = 64, H = 128;
const { floor, min, max, abs, exp, sqrt, sin, cos, log, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

const NL = 11;                    // layers
const NR = 168;                   // samples kept, one per row of travel
const NS = 3;                     // sub-rows per LED row, for the soft edges
const WMIN = 40, WMAX = 62;       // the stream's width, LED
const F0 = 0.85;                  // the thinnest a layer gets, LED
const R0 = 46, RS = 9;            // raw total thickness mapped to the stream width
const A0 = 3.3;                   // size of a bump
const H0 = 14;                    // half-length of a bump at Churn 0, rows
const SPEED0 = 6, SPEED4 = 30;    // rows a second at Flow 0 and 4

// pastel stops along the stack: hue degrees (unwrapped), saturation, value
const STOPS = [
  [156, 0.4, 0.92],  // mint
  [206, 0.42, 0.95], // sky
  [264, 0.38, 0.96], // lilac
  [338, 0.42, 0.97], // rose
  [382, 0.46, 1.0],  // apricot
  [406, 0.38, 0.95], // sand
];

function hsv(h, s, v, out, o) {
  h = h / 360;
  h -= floor(h);
  const hh = h * 6, i = floor(hh) % 6, f = hh - floor(hh), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

const md = (k) => ((k % NR) + NR) % NR;
const hash = (a, b) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---- state ------------------------------------------------------------------
export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0,
    S: 0, G: 0,                              // distance run, newest sample made
    sp: 13, cs: 0, kb: 0.06,                 // smoothed knobs
    ring: new Float32Array(NR * NL),
    bumps: [], rm: [], sz: [], w1: [], p1: [], w2: [], p2: [],
    ph: [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU],
    col: new Float32Array(NL * 3), gcol: new Float32Array(3),
    r: new Float32Array(NL), tt: new Float32Array(NL), bb: new Float32Array(NL + 1),
    aR: new Float32Array(W), aG: new Float32Array(W), aB: new Float32Array(W), aC: new Float32Array(W),
  });
  for (let i = 0; i < NL; i++) {
    st.bumps.push([]);
    st.rm.push(0.75 + 0.55 * rnd());
    st.sz.push(0.8 + 0.45 * rnd());
    st.w1.push(TAU / (70 + 70 * rnd()));
    st.p1.push(rnd() * TAU);
    st.w2.push(TAU / (37 + 24 * rnd()));
    st.p2.push(rnd() * TAU);
  }
  return st;
}

// ---- the layers ---------------------------------------------------------------
// One sample per row of travel. A layer's thickness is a slow undulation plus the bumps that have been born in it and not yet gone:
// each bump arrives at random, has a size and a length, and rises and falls as a raised cosine. Bumps are made as the picture
// enters at the top and never repeat.
function gen(st, k) {
  const c = st.cs, hs = H0 * exp(-0.9 * c), rho = 1.7 - 0.2 * c, lam = rho / (2 * hs * 1.06);
  const base = md(k) * NL;
  for (let i = 0; i < NL; i++) {
    const bl = st.bumps[i];
    if (rnd() < lam * st.rm[i]) {
      const h = cl(hs * exp(0.35 * gauss()), 3.5, 52);
      bl.push({ c: k + h, h, a: st.sz[i] * A0 * min(3.6, 0.35 - log(1 - rnd())) });
    }
    let v = 0.9 + 0.5 * sin(k * st.w1[i] + st.p1[i]) + 0.3 * sin(k * st.w2[i] + st.p2[i]);
    for (let j = bl.length - 1; j >= 0; j--) {
      const b = bl[j], d = k - b.c;
      if (d >= b.h) {
        bl[j] = bl[bl.length - 1];
        bl.pop();
      } else if (d > -b.h) v += b.a * 0.5 * (1 + cos((PI * d) / b.h));
    }
    st.ring[base + i] = v;
  }
}

const SPEED_OF = (k) => SPEED0 * pow(SPEED4 / SPEED0, cl(k, 0, 4) / 4);

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || st.k;
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  const sp = SPEED_OF(st.k[1]), cs = cl(st.k[2], -1, 1), kb = cl(st.k[3], -1, 1);
  if (!st.init) {
    st.init = true;
    st.sp = sp; st.cs = cs; st.kb = kb;
    // a stream that has been running a while: samples from well before the top of the panel up to just ahead of it
    st.G = -420;
    while (st.G < 3) gen(st, ++st.G);
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  st.t += dt;
  st.sp += (sp - st.sp) * (1 - exp(-dt / 0.25));
  st.cs += (cs - st.cs) * (1 - exp(-dt / 0.3));
  st.kb += (kb - st.kb) * (1 - exp(-dt / 0.15));
  st.S += st.sp * dt;
  while (st.G < floor(st.S) + 3) gen(st, ++st.G);
}

// ---- the stack at one position along the stream --------------------------------
// Fills st.tt with the layer thicknesses and st.bb with the layer boundaries at s, in LED.
function stack(st, s, ex) {
  const r = st.r, tt = st.tt, bb = st.bb, ring = st.ring;
  const k0 = floor(s), f = s - k0, f2 = f * f, f3 = f2 * f;
  const m1 = md(k0 - 1) * NL, m0 = md(k0) * NL, n1 = md(k0 + 1) * NL, n2 = md(k0 + 2) * NL;
  let R = 0;
  for (let i = 0; i < NL; i++) {
    // Catmull-Rom through four samples
    const a = ring[m1 + i], b = ring[m0 + i], c = ring[n1 + i], d = ring[n2 + i];
    const v = 0.5 * (2 * b + (c - a) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (3 * (b - c) + d - a) * f3);
    r[i] = v < 0.05 ? 0.05 : v;
    R += r[i];
  }
  const T = WMIN + (WMAX - WMIN) / (1 + exp(-(R - R0) / RS));
  let Q = 0;
  for (let i = 0; i < NL; i++) {
    tt[i] = pow(r[i], ex);
    Q += tt[i];
  }
  const sc = (T - NL * F0) / Q;
  let g0 = 0;
  for (let i = 0; i < NL; i++) {
    tt[i] = F0 + tt[i] * sc;
    g0 -= (NL - i - 0.5) * tt[i];
  }
  g0 /= NL;
  // the three baselines: stacked from the left edge, the wiggle (the layers' centres bend least, plus a slow sway of the whole
  // stream), and the silhouette about the middle; the knob blends them
  const kb = st.kb, sway = 6.5 * sin(s * 0.021 + st.ph[0]) + 3 * sin(s * 0.047 + st.ph[1]);
  const Lw = W / 2 + g0 + sway, Ls = W / 2 - T / 2;
  let L = kb < 0 ? Lw * (kb + 1) : Lw + (Ls - Lw) * kb;
  // keep it on the panel, softly: it may just touch an edge at a swell
  const lo = -1.2, hi = W + 1.2 - T;
  let e = L - lo;
  L = lo + 0.5 * (e + sqrt(e * e + 6));
  e = hi - L;
  L = hi - 0.5 * (e + sqrt(e * e + 6));
  bb[0] = L;
  for (let i = 0; i < NL; i++) bb[i + 1] = bb[i] + tt[i];
}

// ---- draw -------------------------------------------------------------------
export function draw(display, params) {
  let st = params.st;
  if (!st) st = setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const hue = st.k[0] * 360, col = st.col, gc = st.gcol;
  // the scale: eleven positions over six stops
  for (let i = 0; i < NL; i++) {
    const u = (i / (NL - 1)) * (STOPS.length - 1), j = min(STOPS.length - 2, floor(u)), f = u - j, A = STOPS[j], B = STOPS[j + 1];
    const alt = i & 1 ? -0.035 : 0.025;
    hsv(hue + A[0] + (B[0] - A[0]) * f, cl(A[1] + (B[1] - A[1]) * f - alt * 0.6, 0, 1), cl(A[2] + (B[2] - A[2]) * f + alt, 0, 1), col, i * 3);
  }
  hsv(hue + 248, 0.7, 0.2, gc, 0);
  const ex = 1 + 0.36 * st.cs, S = st.S, aR = st.aR, aG = st.aG, aB = st.aB, aC = st.aC, bb = st.bb;
  const gR = gc[0], gG = gc[1], gB = gc[2];
  for (let y = 0; y < H; y++) {
    aR.fill(0); aG.fill(0); aB.fill(0); aC.fill(0);
    let eL = 0, eR = 0;
    for (let sub = 0; sub < NS; sub++) {
      stack(st, S - (y + (sub + 0.5) / NS), ex);
      if (sub === 1) { eL = bb[0]; eR = bb[NL]; }
      for (let i = 0; i < NL; i++) {
        const lo = bb[i], hi = bb[i + 1];
        if (hi <= 0 || lo >= W) continue;
        const w = hi - lo, amp = sstep(1.2, 5, w), ci = i * 3;
        const x0 = max(0, floor(lo)), x1 = min(W - 1, Math.ceil(hi) - 1);
        for (let x = x0; x <= x1; x++) {
          const a = x > lo ? x : lo, z = x + 1 < hi ? x + 1 : hi, cov = z - a;
          if (cov <= 0) continue;
          const xm = (a + z) * 0.5, e = (2 * (xm - lo)) / w - 1, core = 1 - e * e;
          // lighter along the core, darker at the edges
          const mult = 1 - 0.3 * amp * (1 - core), gl = 12 * amp * core;
          // the brighter hairline against a neighbour
          let hl = 0;
          if (i > 0) hl += exp(-((xm - lo) * (xm - lo)) / 0.4);
          if (i < NL - 1) hl += exp(-((hi - xm) * (hi - xm)) / 0.4);
          hl *= 0.34;
          const r = col[ci] * mult + gl, g = col[ci + 1] * mult + gl, b = col[ci + 2] * mult + gl;
          aR[x] += (r + (255 - r) * hl) * cov;
          aG[x] += (g + (255 - g) * hl) * cov;
          aB[x] += (b + (255 - b) * hl) * cov;
          aC[x] += cov;
        }
      }
    }
    // the ground: indigo fibres that run with the stream, a faint tint of the nearest layer, and the stream on top
    const s = S - (y + 0.5);
    for (let x = 0; x < W; x++) {
      const cv = aC[x] / NS;
      let r, g, b;
      if (cv >= 0.999) {
        r = aR[x] / NS; g = aG[x] / NS; b = aB[x] / NS;
      } else {
        const gw = 1 - cv, xc = x + 0.5;
        const fa = xc * 0.9, fs = s * 0.2, ia = floor(fa), is = floor(fs), ua = fa - ia, us = fs - is;
        const n1 = hash(ia, is) * (1 - ua) * (1 - us) + hash(ia + 1, is) * ua * (1 - us) + hash(ia, is + 1) * (1 - ua) * us + hash(ia + 1, is + 1) * ua * us;
        const fb = xc * 0.33, fc = s * 0.06, ib = floor(fb), ic = floor(fc), ub = fb - ib, uc = fc - ic;
        const n2 = hash(ib + 99, ic) * (1 - ub) * (1 - uc) + hash(ib + 100, ic) * ub * (1 - uc) + hash(ib + 99, ic + 1) * (1 - ub) * uc + hash(ib + 100, ic + 1) * ub * uc;
        const gr = 0.72 + 0.34 * n1 + 0.4 * n2;
        const tl = xc < eL ? 0.12 * exp(-(eL - xc) / 7) : 0, tr = xc > eR ? 0.12 * exp(-(xc - eR) / 7) : 0;
        r = gR * gr + tl * col[0] + tr * col[NL * 3 - 3];
        g = gG * gr + tl * col[1] + tr * col[NL * 3 - 2];
        b = gB * gr + tl * col[2] + tr * col[NL * 3 - 1];
        r = r * gw + aR[x] / NS;
        g = g * gw + aG[x] / NS;
        b = b * gw + aB[x] / NS;
      }
      display.setPixel(x, y, cl(r, 0, 255) | 0, cl(g, 0, 255) | 0, cl(b, 0, 255) | 0);
    }
  }
}
