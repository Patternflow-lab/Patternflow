// ===== Patternflow pattern =====
// Title:   Replica Exchange
// Family:  tempering
// Idea:    Six copies of one sampler walk the same drifting energy landscape at six temperatures, one band each, and neighbours swap places in bright streaks, so a state a hot copy finds walks down the ladder into the cold one.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: replica Monte Carlo (Robert Swendsen and Jian-Sheng Wang, 1986, from memory), the exchange form with a ladder of temperatures (Charles Geyer, 1991, from memory), parallel tempering as used now (Koji Hukushima and Koji Nemoto, 1996, from memory), original code, pattern round 278
// Round:   278
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Ladder=0..4, Rugged=-1..1, Swap=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel. At 0 the coldest band is blue, then violet, magenta and salmon, and the hottest is amber; at 0.5 the bottom is yellow and the top cyan. The walkers and the streaks turn with it.
// Knob 2: Ladder. How hot the hottest copy is, 0 to 4. The temperature of the top band over the bottom one is 1.3 x (400 / 1.3)^(K / 4): 1.3 at 0, 23 at 2 where it opens, 400 at 4. The colours follow the real temperatures, so at 0 all six bands are blue and violet, every walker sits in a well and 92 percent of the swap tries are accepted. At 2 the three colder pairs accept 62 to 70 percent and the two hotter 79 and 88. At 4 the top three bands wander over the whole panel in coral and amber, the two coldest pairs accept 41 and 45 percent and the hotter three 80, 94 and 99.
// Knob 3: Rugged. How deep the wells are and how many there are, -1 to 1, opening at 0. The depth scale is 0.7 + 0.7 s with s = (K + 1) / 2, and a well or hump joins the landscape only above its own s, so of the eight that come and go there are 3.5 strong ones (depth over 0.35) at -1, 6.5 at 0 and 7.4 at 1, with two broad swells always there. The line is a smooth bump at -1 and a row of sharp wells and teeth at 1, at once.
// Knob 4: Swap. How often neighbouring copies try to trade, -1 to 1, opening at 0.06. Rounds of tries come every 0.34 s / 2.4^K, 0.32 s at the opening and 0.14 s at 1, and thin out below -0.6. Accepted swaps a second: 12.8 at 1, 5.6 at the opening, 1.3 at -0.8, none at -1. With none the cold walker stood in the deepest well 24 percent of the time (landscape drift moved it now and then); at the opening 78 percent.
//
// What the picture is. Six bands of about 20 rows, coldest at the bottom, the dark gap between them 2 rows. Each shows the same energy U(x) over the 64 columns as a bright line, wells down and humps up, with the area under it shaded in the band's temperature colour. Light pools in the wells that copy has visited in the last 30 s, a white 3 x 3 walker sits on the line with a trail of half a second, and a swap is a 3 LED streak down each of the two columns the exchanged states stood in, fading in 0.45 s. A refused try is a dim stub in the gap. Wells deepen and fade on clocks of 37 to 127 s that share no factor, so the deepest well moves about every 15 s and a hot copy has to find the new one before the cold copy can follow.
// What is exact and what is drawn. The model is exact: U is ten Gaussians (eight wells and humps, two broad swells) with depths, centres and widths on clocks; six Metropolis walkers make 70 moves a second with step widths that grow as T^0.65 (0.5 column cold, 2.6 at most); beta runs geometrically from 10; the swap test is min(1, exp((beta_i - beta_j)(U_i - U_j))), tried on the even then the odd pairs. With the landscape held still for 1200 s the cold copy's visit counts came to within 0.2 to 0.34 (of 2) of the Boltzmann weights, in three runs. The tanh that squeezes U into rows, the shading, the blur of the visit counts, the walker's smoothing (0.04 s cold, 0.16 s hot), the trail and the palette are drawing choices. Nothing is a label.

const W = 64, H = 128, NB = 6, GAP = 2, NC = 10, NG = 257;
const { floor, exp, log, sin, tanh, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

const PITCH = (H + GAP) / NB;
const BTOP = [], BBOT = [];
for (let i = 0; i < NB; i++) { BTOP.push(Math.round(i * PITCH)); BBOT.push(Math.round(i * PITCH + PITCH - GAP)); }

const BETA_C = 10;          // 1 / temperature of the coldest copy
const LAD0 = 1.3, LAD1 = 400; // hottest / coldest temperature at Ladder 0 and 4
const SIG0 = 0.0085;        // cold step width, as a fraction of the panel width
const MPS = 70;             // Metropolis moves a second for each copy
const TH = 30;              // memory of the visit counts, s
const TRAIL = 0.4;          // fade of the walker's trail, s
const SWT = 0.34;           // seconds between rounds of swap tries at Swap = 0
const EVLIFE = 0.45;        // life of a streak, s
const PRE = 70;             // model seconds run before the first frame
const HMIN = 3, HRNG = 14.5; // lowest the line goes above the band floor, and how far it climbs
// centre, width, depth (negative is a well), the s at which it joins the landscape
const COMP = [
  [0.13, 0.034, -1.00, -0.5, 0], [0.38, 0.028, -0.80, -0.35, 0], [0.62, 0.042, -1.10, -0.2, 0], [0.84, 0.026, -0.70, 0.15, 0],
  [0.50, 0.024, 0.90, -0.05, 0], [0.26, 0.022, 0.80, 0.3, 1], [0.74, 0.022, 0.85, 0.45, 1], [0.96, 0.024, -0.60, 0.6, 1],
  [0.30, 0.110, 0.28, -1, 0, 2.5], [0.72, 0.130, -0.32, -1, 0, 2.5],
];
const AP = [37, 47, 59, 67, 79, 43, 53, 71, 41, 73];            // depth clocks, s
const XP = [83, 97, 89, 103, 113, 79, 67, 107, 61, 127];     // position clocks
const GP = [191, 157, 211, 173, 139, 229, 197, 167, 181, 223];    // appear and vanish clocks
const PAL = [ // temperature 0..1, hue, saturation
  [0.00, 0.640, 0.70], [0.25, 0.730, 0.78], [0.50, 0.860, 0.70], [0.74, 0.995, 0.52], [1.00, 1.085, 0.85],
];

export function setup(params) {
  const ph = (n) => { const a = new Float64Array(n); for (let i = 0; i < n; i++) a[i] = TAU * Math.random(); return a; };
  const arr = (n, m) => { const a = []; for (let i = 0; i < n; i++) a.push(new Float32Array(m)); return a; };
  const x = new Float64Array(NB);
  for (let r = 0; r < NB; r++) x[r] = Math.random();
  params.s = {
    k: null, thA: ph(NC), thX: ph(NC), thG: ph(NC), cc: new Float64Array(NC), ww: new Float64Array(NC), aa: new Float64Array(NC),
    U: new Float64Array(NG), x, xd: Float64Array.from(x), beta: new Float64Array(NB), sig: new Float64Array(NB), tc: new Float64Array(NB),
    mc: new Float64Array(NB), hist: arr(NB, W), g: arr(NB, W), tr: arr(NB, W), sw: Math.random() * SWT, par: 0, ev: [],
    hc: new Float64Array(W + 2), hmin: new Float64Array(W), hmax: new Float64Array(W),
    col: [0, 1, 2, 3, 4, 5].map(() => [0, 0, 0]), sk: [0, 1, 2, 3, 4, 5].map(() => [0, 0, 0]), lit: [0, 1, 2, 3, 4, 5].map(() => [0, 0, 0]),
  };
  for (let r = 0; r < NB; r++) for (let i = 0; i < W; i++) params.s.hist[r][i] = MPS * TH / W;
}

function buildLandscape(S) {
  const s = (cl(S.k[2], -1, 1) + 1) / 2;
  const AS = 0.7 + 0.7 * s;
  const { cc, ww, aa, U } = S;
  for (let i = 0; i < NC; i++) {
    const c = COMP[i];
    const pres = sm(c[3] - 0.22, c[3] + 0.22, s), gate = c[4] ? sm(-0.95, -0.5, sin(S.thG[i])) : 1;
    aa[i] = AS * c[2] * exp(0.55 * sin(S.thA[i])) * pres * gate;
    cc[i] = c[0] + (c[5] || 1) * (0.06 * sin(S.thX[i]) + 0.025 * sin(1.7 * S.thX[i] + 1.3));
    ww[i] = c[1] * (1 + 0.18 * sin(0.6 * S.thA[i] + 2));
  }
  for (let j = 0; j < NG; j++) {
    const x = j / (NG - 1);
    let u = 0;
    for (let i = 0; i < NC; i++) {
      if (aa[i] === 0) continue;
      const d = (x - cc[i]) / ww[i];
      if (d > -4.5 && d < 4.5) u += aa[i] * exp(-0.5 * d * d);
    }
    U[j] = u;
  }
  // zero of energy at the panel's mean, so the line stays in the middle of the band whatever the wells do
  let m = 0;
  for (let j = 0; j < NG; j++) m += U[j];
  m /= NG;
  for (let j = 0; j < NG; j++) U[j] -= m;
}

function uAt(S, x) {
  const j = cl(x, 0, 1) * (NG - 1), i = min(NG - 2, j | 0), f = j - i;
  return S.U[i] + (S.U[i + 1] - S.U[i]) * f;
}

const heightOf = (u) => HMIN + HRNG * (0.5 + 0.5 * tanh(u / 1.4));

function deposit(hs, x) {
  const p = x * W - 0.5, i = floor(p), f = p - i;
  if (i < 0) hs[0] += 1;
  else if (i >= W - 1) hs[W - 1] += 1;
  else { hs[i] += 1 - f; hs[i + 1] += f; }
}

function simStep(S, h, live) {
  const k = S.k;
  for (let i = 0; i < NC; i++) {
    S.thA[i] += TAU * h / AP[i]; S.thX[i] += TAU * h / XP[i]; S.thG[i] += TAU * h / GP[i];
  }
  buildLandscape(S);
  const lr = log(LAD0 * pow(LAD1 / LAD0, cl(k[1], 0, 4) / 4));
  for (let r = 0; r < NB; r++) {
    const q = r / (NB - 1);
    S.beta[r] = BETA_C * exp(-lr * q);
    S.sig[r] = min(0.04, SIG0 * exp(0.65 * lr * q));
    S.tc[r] = min(1, 1.1 * (1 - exp(-lr * q / 1.8)));
  }
  const dec = exp(-h / TH);
  for (let r = 0; r < NB; r++) {
    const hs = S.hist[r];
    for (let i = 0; i < W; i++) hs[i] *= dec;
    S.mc[r] += MPS * h;
    let n = S.mc[r] | 0;
    S.mc[r] -= n;
    let x = S.x[r], u = uAt(S, x);
    const b = S.beta[r], sg = S.sig[r] * 2;
    while (n-- > 0) {
      let xn = x + sg * (Math.random() + Math.random() + Math.random() - 1.5);
      if (xn < 0) xn = -xn;
      if (xn > 1) xn = 2 - xn;
      xn = cl(xn, 0, 1);
      const un = uAt(S, xn), du = un - u;
      if (du <= 0 || Math.random() < exp(-b * du)) { x = xn; u = un; }
      deposit(hs, x);
    }
    S.x[r] = x;
  }
  const kv = cl(k[3], -1, 1);
  S.sw += h * pow(2.4, kv) * sm(-1, -0.6, kv);
  if (S.sw >= SWT) {
    S.sw -= SWT;
    if (S.sw > SWT) S.sw = 0;
    S.par ^= 1;
    for (let i = S.par; i + 1 < NB; i += 2) {
      const j = i + 1;
      const a = (S.beta[i] - S.beta[j]) * (uAt(S, S.x[i]) - uAt(S, S.x[j]));
      const ok = a >= 0 || Math.random() < exp(a);
      if (live && S.ev.length < 40) S.ev.push({ xa: S.x[i], xb: S.x[j], i, j, age: 0, ok });
      if (ok) {
        let t = S.x[i]; S.x[i] = S.x[j]; S.x[j] = t;
        t = S.xd[i]; S.xd[i] = S.xd[j]; S.xd[j] = t;
      }
    }
  }
  const td = exp(-h / TRAIL);
  for (let r = 0; r < NB; r++) {
    const tr = S.tr[r], xo = S.xd[r];
    for (let i = 0; i < W; i++) tr[i] *= td;
    const xn = xo + (S.x[r] - xo) * (1 - exp(-h / (0.04 + 0.12 * r / (NB - 1))));
    S.xd[r] = xn;
    const c0 = cl(floor(min(xo, xn) * W - 0.5), 0, W - 1), c1 = cl(floor(max(xo, xn) * W + 0.5), 0, W - 1);
    for (let c = c0; c <= c1; c++) if (tr[c] < 1) tr[c] = 1;
  }
  for (let e = S.ev.length - 1; e >= 0; e--) {
    S.ev[e].age += h;
    if (S.ev[e].age > EVLIFE) S.ev.splice(e, 1);
  }
}

function palette(tc, hue, o) {
  let a = PAL[0], b = PAL[1];
  for (let i = 0; i + 1 < PAL.length; i++) if (tc >= PAL[i][0]) { a = PAL[i]; b = PAL[i + 1]; }
  const f = cl((tc - a[0]) / (b[0] - a[0]), 0, 1);
  hsv(a[1] + (b[1] - a[1]) * f + hue, a[2] + (b[2] - a[2]) * f, 1, o);
}

function prepare(S) {
  const { hc, hmin, hmax } = S;
  for (let x = -1; x <= W; x++) hc[x + 1] = heightOf(uAt(S, (x + 0.5) / W));
  for (let x = 0; x < W; x++) {
    const hl = 0.5 * (hc[x] + hc[x + 1]), hr = 0.5 * (hc[x + 1] + hc[x + 2]);
    hmin[x] = min(hl, hc[x + 1], hr); hmax[x] = max(hl, hc[x + 1], hr);
  }
  for (let r = 0; r < NB; r++) {
    const hs = S.hist[r], g = S.g[r];
    let tot = 0;
    for (let i = 0; i < W; i++) tot += hs[i];
    const nrm = W / max(1e-9, tot);
    for (let i = 0; i < W; i++) {
      const a = hs[max(0, i - 1)], b = hs[i], c = hs[min(W - 1, i + 1)];
      g[i] = 1 - exp(-(0.25 * a + 0.5 * b + 0.25 * c) * nrm / 2.2);
    }
    palette(S.tc[r], S.k[0], S.col[r]);
    const c = S.col[r], l = S.lit[r], k = S.sk[r];
    for (let m = 0; m < 3; m++) { l[m] = c[m] + (1 - c[m]) * 0.45; k[m] = c[m] * 0.8 + 0.2 * l[m]; }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
    const n = PRE / 0.05;
    for (let i = 0; i < n; i++) simStep(S, 0.05, false);
    for (let r = 0; r < NB; r++) { S.xd[r] = S.x[r]; S.tr[r].fill(0); }
    S.ev.length = 0;
  } else {
    const al = 1 - exp(-d / 0.2);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
    const n = max(1, Math.ceil(d / (1 / 30)));
    for (let i = 0; i < n; i++) simStep(S, d / n, true);
  }
  prepare(S);
}

const BUF = new Float32Array(W * H * 3);
const WH = [1, 1, 1];

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.k) return;
  const { hmin, hmax } = S;
  BUF.fill(0);
  for (let i = 0; i < NB; i++) {
    const r = NB - 1 - i, top = BTOP[i], bot = BBOT[i];
    const c = S.col[r], l = S.lit[r], g = S.g[r], tr = S.tr[r];
    for (let y = top; y < bot; y++) {
      const yc = y + 0.5;
      for (let x = 0; x < W; x++) {
        const yT = bot - hmax[x], yB = bot - hmin[x];
        let v, gl;
        if (yc >= yB) {
          const dB = yc - yB;
          v = 0.25 + 0.28 * exp(-dB / 9);
          gl = 1.7 * g[x] * (0.3 + 0.7 * exp(-dB / 7));
        } else if (yc <= yT) {
          const dA = yT - yc;
          v = 0.16 + 0.14 * exp(-dA / 4);
          gl = 0.5 * g[x] * g[x] * exp(-dA / (0.8 + 3 * g[x]));
        } else { v = 0.35; gl = 0.5 * g[x]; }
        const dist = max(yT - yc, yc - yB, 0);
        const lw = cl(1.5 - dist, 0, 1), ln = lw * 0.9, wt = lw * tr[x] * 0.5;
        const p = (y * W + x) * 3, vg = v + gl;
        BUF[p] = c[0] * vg + l[0] * ln + wt;
        BUF[p + 1] = c[1] * vg + l[1] * ln + wt;
        BUF[p + 2] = c[2] * vg + l[2] * ln + wt;
      }
    }
  }
  // swap streaks: each state keeps its column and drops to the other band
  for (const e of S.ev) {
    const env = pow(1 - e.age / EVLIFE, 1.5) * (e.ok ? 1 : 0.28);
    const ci = S.sk[e.i], cj = S.sk[e.j];
    const bi = NB - 1 - e.i, bj = NB - 1 - e.j;
    for (let n = 0; n < 2; n++) {
      const x = n === 0 ? e.xa : e.xb;
      const y0 = BBOT[bi] - heightOf(uAt(S, x)), y1 = BBOT[bj] - heightOf(uAt(S, x));
      // n = 0: the state from the colder copy goes up; n = 1: the state from the hotter copy comes down
      const ys = n === 0 ? y0 : y1, ye = n === 0 ? y1 : y0;
      const cs = n === 0 ? ci : cj, ce = n === 0 ? cj : ci;
      const lo = min(ys, ye) - 1.5, hi = max(ys, ye) + 1.5;
      const xc = x * W;
      const xa = max(0, floor(xc - 2)), xb = min(W - 1, floor(xc + 2));
      for (let yy = max(0, floor(lo)); yy <= min(H - 1, floor(hi)); yy++) {
        let f = cl((yy + 0.5 - ys) / (ye - ys), 0, 1);
        if (e.ok === false) {
          const gy = (BBOT[min(bi, bj)] + BTOP[max(bi, bj)]) * 0.5;
          if (abs(yy + 0.5 - gy) > 2.2) continue;
        }
        const edge = cl((yy + 0.5 - lo) / 1.5, 0, 1) * cl((hi - yy - 0.5) / 1.5, 0, 1);
        for (let xx = xa; xx <= xb; xx++) {
          const wx = cl(1.75 - abs(xx + 0.5 - xc), 0, 1) * edge * env;
          if (wx <= 0) continue;
          const p = (yy * W + xx) * 3;
          BUF[p] += (cs[0] + (ce[0] - cs[0]) * f) * wx * 1.5;
          BUF[p + 1] += (cs[1] + (ce[1] - cs[1]) * f) * wx * 1.5;
          BUF[p + 2] += (cs[2] + (ce[2] - cs[2]) * f) * wx * 1.5;
        }
      }
    }
  }
  // walkers
  for (let r = 0; r < NB; r++) {
    const i = NB - 1 - r, l = S.lit[r];
    const xw = S.xd[r] * W, yw = BBOT[i] - heightOf(uAt(S, S.xd[r]));
    const wr = l[0] * 0.4 + WH[0] * 0.6, wg = l[1] * 0.4 + WH[1] * 0.6, wb = l[2] * 0.4 + WH[2] * 0.6;
    for (let yy = max(0, floor(yw - 4)); yy <= min(H - 1, floor(yw + 4)); yy++) {
      const dy = yy + 0.5 - yw, wy = cl(1.8 - abs(dy), 0, 1);
      for (let xx = max(0, floor(xw - 4)); xx <= min(W - 1, floor(xw + 4)); xx++) {
        const dx = xx + 0.5 - xw;
        const hl = 0.38 * exp(-(dx * dx + dy * dy) / 5);
        const w = max(wy * cl(1.8 - abs(dx), 0, 1), hl);
        if (w <= 0.01) continue;
        const p = (yy * W + xx) * 3, a = min(1, w * 0.95);
        BUF[p] += (wr - BUF[p]) * a; BUF[p + 1] += (wg - BUF[p + 1]) * a; BUF[p + 2] += (wb - BUF[p + 2]) * a;
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      const r = BUF[p] * 255, g = BUF[p + 1] * 255, b = BUF[p + 2] * 255;
      display.setPixel(x, y, r > 255 ? 255 : r < 0 ? 0 : r | 0, g > 255 ? 255 : g < 0 ? 0 : g | 0, b > 255 ? 255 : b < 0 ? 0 : b | 0);
    }
  }
}
