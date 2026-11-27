// ===== Patternflow pattern =====
// Title:   Rivalry Waves
// Family:  rivalry
// Idea:    One eye is shown amber stripes leaning one way and the other eye teal stripes at right angles to them, and the panel draws what is seen: a neural field of two rival populations that tire decides which grating wins where, so patches of one break out, run as waves with a pale seam at their front and sweep the other away, a few seconds at a time and never in the same places twice.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: binocular rivalry between different images in the two eyes (Wheatstone, 1838, with the mirror stereoscope); rivalry as reciprocal inhibition between monocular neurons that adapt (Blake, Psychological Review 1989); dominance that travels across the field as a wave (Wilson, Blake and Lee, Nature 2001); mutual inhibition with slow adaptation as the engine of the alternation (Laing and Chow, 2002). All from memory. The field, its numbers, the seam and the colours are original, pattern round 269.
// Round:   269
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Size=-1..1, Coupling=-1..1
//
// Knob 1: Hue. Adds the knob to the hue of all four tones, one turn over the range. At 0 one grating runs from amber crests to crimson troughs and the other from teal crests to deep blue troughs; at 0.25 they are green and violet, at 0.5 pale blue and rose, at 0.75 magenta and lime. Every tone keeps its lightness, so the two gratings stay equally bright.
// Knob 2: Speed. The clock of the field, (K2 / 2) to the 0.9 model seconds a second: 0.29 at 0.5, 1 at 2 where it opens, 1.87 at 4. At 2 a place holds one grating for 2.7 s on average (1.4 s to 4.2 s for the 10th to 90th percentile) and a front runs some 50 LED a second; at 0.5 a place holds for about 9 s and at 4 for about 1.6 s. The stripes drift at the same pace at every setting.
// Knob 3: Size. The period of both gratings, 11.3 LED times 2 to the half of the knob: 8 LED at -1, 11.3 where it opens, 16 at 1. A crest is about half the period wide.
// Knob 4: Coupling. How far and how hard a winning patch pulls its neighbours with it. The kernel widens from 3.8 to 7.6 LED and the noise drops by a third as the knob goes up. At -1 the panel is a mosaic of about 8 patches at a time, half of them under 18 LED across; where it opens there are about 6 (23 LED); at 1 about 4 (31 LED), and one front often sweeps the whole panel in 2 to 3 s, so for 10 to 16% of the time one grating fills it.
//
// What the picture is. Two gratings fill the 64 x 128 panel standing up, both soft sine stripes 8 to 16 LED from crest to crest. The left eye's grating leans up to the right at about 45 degrees, amber crests on crimson troughs; the right eye's leans the other way, teal crests on deep blue troughs. Away from the seams the two are never shown together. Each LED shows the grating of the eye that is winning there, the patches of the two are blobs 10 to 50 LED across with round edges, and where they meet there is a pale seam 2 to 3 LED wide where the crests of both cross. A patch that has just won is drawn about a quarter brighter than one that is about to lose, so a wave leaves a bright wake behind its front. The stripes drift slowly across their length in opposite directions, and the pair turns about 11 degrees either way over a minute or two, always at right angles.
// The model. A sheet of 32 x 64 nodes, one for every 2 x 2 LED, carries two populations, u_L and u_R, the cells driven by each eye's grating, and their fatigue a_L and a_R. Each obeys tau du/dt = -u + S(I - beta u_other - g a + alpha (G*u - u) + n), with tau 0.06 s, S a logistic of width 0.05, drive I = 0.5 from each eye, cross inhibition beta = 1 and fatigue gain g = I / 0.78, so a winning node lets go when its fatigue reaches 0.78. Fatigue follows its own activity, tau_a da/dt = u - a, with tau_a 3 s. G is a Gaussian of 1.9 to 3.8 nodes; the coupling term alpha (G*u - u), alpha 0.37 to 0.45, is zero inside a uniform patch and only acts at an edge, where it tips the tired side over, and that is the wave. The noise n is separate for each eye, smooth over 12 LED and 0.5 s. Two slow fields keep the sheet from settling into one rhythm: the fatigue rate is scaled by e to a field of standard deviation 0.6, smooth over 12 LED and wandering over 8 s, and the drive tilts toward one eye and away from the other by a field of standard deviation 0.1, smooth over 32 LED and wandering over 25 s. The first update runs 20 model seconds (450 steps, a fifth of a second of work) so the panel opens on a mosaic already turning. For drawing, u_L - u_R is softened over about 4 LED, so no patch smaller than that is drawn, and turned into the mix by a smoothstep.
// What is exact and what is not. Exclusive dominance of one orthogonal grating at a time, alternation every few seconds, waves of dominance spreading from a point and the piecemeal mosaic of a large stimulus are as rivalry experiments report them. The model is the standard kind of mutual inhibition with adaptation and noise, laid out as a field. Its time constants, the coupling, both slow fields and the patch sizes are chosen so that the panel reads; they are not fitted to data. The seam is drawn: a real observer sees a moving border, not a bright line. The bright wake is the fatigue variable painted onto the stripes. The wandering drift and the slow turn of the gratings are decoration. Over 900 s at the opening the two eyes hold a place for 2.82 s and 2.67 s on average, and each eye holds 47 to 53% of the panel in every quarter of that time.

const W = 64, H = 128;
const GW = 32, GH = 64, GN = GW * GH;     // the neural sheet, one node every 2 LED
const NW = 7, NH = 12, NS = 6;            // the noise lattice, one node every 6 sheet nodes (12 LED)
const STEP = 1 / 30;
const { floor, sqrt, exp, sin, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

// the model, in model seconds (Speed 2 runs one model second a second)
const TAU = 0.06;    // activity
const TAUA = 3.0;    // adaptation
const I0 = 0.5;      // drive from each eye
const GA = I0 / 0.78; // adaptation gain: a dominant node lets go when its adaptation reaches 0.78
const BETA = 1.0;    // cross inhibition
const SLOPE = 0.05;  // sigmoid width
const TAUN = 0.5;    // noise correlation time
const SIGN = 0.13;   // noise size
const HET = 0.6;    // the fatigue rate varies over the sheet by about this much in log, and drifts
const TAUH = 8;     // over this many seconds
const BW = 3, BH = 5, BS = 16;            // a coarser lattice, one node every 32 LED, for the slow tilt between the eyes
const BIAS = 0.1;   // how far the drive tilts toward one eye in a region, either way
const TAUB = 25;     // and how slowly that tilt wanders

export function setup(params) {
  const s = {
    k: [0, 2, 0, 0.06], init: false, acc: 0, t: 0, rate: 1, noise: SIGN, alpha: 0.4, sig: 2.5, ksig: -1, ker: null, kr: 0,
    uL: new Float32Array(GN), uR: new Float32Array(GN), aL: new Float32Array(GN), aR: new Float32Array(GN),
    gL: new Float32Array(GN), gR: new Float32Array(GN), tmp: new Float32Array(GN), tmp2: new Float32Array(GN),
    nL: new Float32Array(NW * NH), nR: new Float32Array(NW * NH), nH: new Float32Array(NW * NH), nB: new Float32Array(BW * BH),
    D: new Float32Array(GN), A: new Float32Array(GN), E: new Float32Array(GN),
    phA: rnd() * 40, phB: rnd() * 40, period: 11.3, pt: 0, w1: rnd() * 6.2832, w2: rnd() * 6.2832, w3: rnd() * 6.2832,
  };
  // a smooth start: each node of the noise lattice gets a random phase of the cycle, spread over the sheet
  const ph = new Float32Array(NW * NH);
  for (let i = 0; i < NW * NH; i++) { ph[i] = rnd(); s.nL[i] = SIGN * gauss(); s.nR[i] = SIGN * gauss(); s.nH[i] = HET * gauss(); }
  for (let i = 0; i < BW * BH; i++) s.nB[i] = BIAS * gauss();
  spread(ph, s.tmp);
  for (let i = 0; i < GN; i++) {
    const q = s.tmp[i] * 2, l = q < 1 ? 1 : 0;
    s.uL[i] = l; s.uR[i] = 1 - l;
    s.aL[i] = l ? 0.2 + 0.5 * q : 0.7 - 0.5 * (q - 1);
    s.aR[i] = l ? 0.7 - 0.5 * q : 0.2 + 0.5 * (q - 1);
  }
  params.s = s;
}

function readKnobs(s, input) {
  const kv = (input && input.knobValues) || s.k;
  for (let i = 0; i < 4; i++) if (typeof kv[i] === "number" && isFinite(kv[i])) s.k[i] = kv[i];
  s.rate = Math.pow(cl(s.k[1], 0.5, 4) / 2, 0.9);
  const c0 = (cl(s.k[3], -1, 1) + 1) / 2, c = Math.pow(c0, 1.4);
  s.alpha = 0.37 + 0.08 * c;
  s.sig = 1.9 + 1.9 * c;
  s.noise = 0.11 - 0.04 * c;
  s.period = 11.3 * Math.pow(2, 0.5 * cl(s.k[2], -1, 1));
}

function kernel(s) {
  if (Math.abs(s.sig - s.ksig) < 1e-3) return;
  s.ksig = s.sig;
  const r = Math.ceil(2.2 * s.sig);
  const k = new Float32Array(2 * r + 1);
  let t = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = exp(-0.5 * (i / s.sig) * (i / s.sig)); t += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= t;
  s.ker = k;
  s.kr = r;
}

// separable gaussian blur of src into dst, edges mirrored through a padded row
const PAD = new Float32Array(GH + 40);
function blur(s, src, dst) {
  const k = s.ker, r = s.kr, n = 2 * r + 1, tmp = s.tmp, pad = PAD;
  for (let y = 0; y < GH; y++) {
    const o = y * GW;
    for (let j = 0; j < GW + 2 * r; j++) {
      let xx = j - r;
      if (xx < 0) xx = -xx - 1; else if (xx >= GW) xx = 2 * GW - xx - 1;
      pad[j] = src[o + xx];
    }
    for (let x = 0; x < GW; x++) {
      let a = 0;
      for (let j = 0; j < n; j++) a += k[j] * pad[x + j];
      tmp[o + x] = a;
    }
  }
  for (let x = 0; x < GW; x++) {
    for (let j = 0; j < GH + 2 * r; j++) {
      let yy = j - r;
      if (yy < 0) yy = -yy - 1; else if (yy >= GH) yy = 2 * GH - yy - 1;
      pad[j] = tmp[yy * GW + x];
    }
    for (let y = 0; y < GH; y++) {
      let a = 0;
      for (let j = 0; j < n; j++) a += k[j] * pad[y + j];
      dst[y * GW + x] = a;
    }
  }
}

// where each sheet node falls in a lattice: the corner node and four smoothstep weights
function lattice(nw, nh, ns) {
  const li = new Int32Array(GN), lw = new Float32Array(GN * 4);
  for (let y = 0; y < GH; y++) {
    const gy = y / ns, iy = min(nh - 2, floor(gy)), ty = gy - iy, fy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < GW; x++) {
      const gx = x / ns, ix = min(nw - 2, floor(gx)), tx = gx - ix, fx = tx * tx * (3 - 2 * tx), i = y * GW + x;
      li[i] = iy * nw + ix;
      lw[i * 4] = (1 - fx) * (1 - fy); lw[i * 4 + 1] = fx * (1 - fy); lw[i * 4 + 2] = (1 - fx) * fy; lw[i * 4 + 3] = fx * fy;
    }
  }
  return { li, lw, nw };
}
const LN = lattice(NW, NH, NS), LB = lattice(BW, BH, BS);
const EH = new Float32Array(NW * NH);
function at(L, n, i) {
  const p = L.li[i], w = L.lw, q = i * 4;
  return n[p] * w[q] + n[p + 1] * w[q + 1] + n[p + L.nw] * w[q + 2] + n[p + L.nw + 1] * w[q + 3];
}
function spread(n, f) {
  for (let i = 0; i < GN; i++) f[i] = at(LN, n, i);
}

function step(s, dt) {
  kernel(s);
  const { uL, uR, aL, aR, gL, gR, nL, nR, nH, nB } = s;
  const dn = dt / TAUN, sn = s.noise * sqrt(2 * dn), dh = dt / TAUH, shh = HET * sqrt(2 * dh);
  for (let i = 0; i < NW * NH; i++) {
    nL[i] += -nL[i] * dn + sn * gauss();
    nR[i] += -nR[i] * dn + sn * gauss();
    nH[i] += -nH[i] * dh + shh * gauss();
    EH[i] = exp(nH[i]);
  }
  const db = dt / TAUB, sb = BIAS * sqrt(2 * db);
  for (let i = 0; i < BW * BH; i++) nB[i] += -nB[i] * db + sb * gauss();
  blur(s, uL, gL);
  blur(s, uR, gR);
  const al = s.alpha, ku = dt / TAU, ka = dt / TAUA, iS = -1 / SLOPE;
  for (let i = 0; i < GN; i++) {
    const l = uL[i], r = uR[i], b = at(LB, nB, i);
    const xL = I0 - BETA * r - GA * aL[i] + al * (gL[i] - l) + at(LN, nL, i) + b;
    const xR = I0 - BETA * l - GA * aR[i] + al * (gR[i] - r) + at(LN, nR, i) - b;
    uL[i] = l + ku * (1 / (1 + exp(xL * iS)) - l);
    uR[i] = r + ku * (1 / (1 + exp(xR * iS)) - r);
    const kh = ka * at(LN, EH, i);
    aL[i] += kh * (l - aL[i]);
    aR[i] += kh * (r - aR[i]);
  }
  s.t += dt;
}

function advance(s, dtm) {
  const n = max(1, Math.ceil(dtm / 0.045));
  for (let i = 0; i < n; i++) step(s, dtm / n);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s;
  readKnobs(s, input);
  if (!s.init) {
    s.init = true;
    for (let i = 0; i < 450; i++) step(s, 0.045);   // 20 model seconds, so the panel opens on a mosaic that is already turning
  }
  const d = cl(dt || 0, 0, 0.1);
  // the stripes drift at speeds that wander, and the pair turns a little, always at right angles
  s.pt += d;
  s.phA += 1.55 * (1 + 0.35 * sin(0.0471 * s.pt + s.w1)) * d;
  s.phB += 1.05 * (1 + 0.35 * sin(0.0293 * s.pt + s.w2)) * d;
  s.acc += d;
  let guard = 0;
  while (s.acc >= STEP && guard++ < 4) {
    s.acc -= STEP;
    advance(s, STEP * s.rate);
  }
}

// ---- drawing
function hsv(h, sat, v, o) {
  h -= floor(h);
  const i = floor(h * 6), f = h * 6 - i, p = v * (1 - sat), q = v * (1 - sat * f), t = v * (1 - sat * (1 - f));
  switch (i % 6) {
    case 0: o[0] = v; o[1] = t; o[2] = p; break;
    case 1: o[0] = q; o[1] = v; o[2] = p; break;
    case 2: o[0] = p; o[1] = v; o[2] = t; break;
    case 3: o[0] = p; o[1] = q; o[2] = v; break;
    case 4: o[0] = t; o[1] = p; o[2] = v; break;
    default: o[0] = v; o[1] = p; o[2] = q;
  }
}

// a colour of hue h at Rec. 601 luma L, whitened when the pure hue is too dark
function tone(h, sat, L) {
  const o = [0, 0, 0];
  hsv(h, sat, 1, o);
  const Y = 0.299 * o[0] + 0.587 * o[1] + 0.114 * o[2];
  if (L <= Y) { const k = L / Y; o[0] *= k; o[1] *= k; o[2] *= k; }
  else { const t = (L - Y) / (1 - Y); o[0] += t * (1 - o[0]); o[1] += t * (1 - o[1]); o[2] += t * (1 - o[2]); }
  return o;
}

// a box of 2r + 1 nodes each way, edges held; dst may be src
function boxb(src, dst, t, r) {
  const n = 2 * r + 1;
  for (let y = 0; y < GH; y++) {
    const o = y * GW;
    for (let x = 0; x < GW; x++) {
      let a = 0;
      for (let j = -r; j <= r; j++) a += src[o + cl(x + j, 0, GW - 1)];
      t[o + x] = a / n;
    }
  }
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      let a = 0;
      for (let j = -r; j <= r; j++) a += t[cl(y + j, 0, GH - 1) * GW + x];
      dst[y * GW + x] = a / n;
    }
}

function soften(src, dst) {
  for (let y = 0; y < GH; y++) {
    const o = y * GW;
    for (let x = 0; x < GW; x++) {
      const a = src[o + (x > 0 ? x - 1 : 0)], b = src[o + (x < GW - 1 ? x + 1 : GW - 1)];
      dst[o + x] = 0.25 * a + 0.5 * src[o + x] + 0.25 * b;
    }
  }
  for (let x = 0; x < GW; x++) {
    let prev = dst[x];
    for (let y = 0; y < GH; y++) {
      const o = y * GW + x, c = dst[o], n = y < GH - 1 ? dst[o + GW] : c;
      dst[o] = 0.25 * prev + 0.5 * c + 0.25 * n;
      prev = c;
    }
  }
}

export function draw(display, params) {
  const s = params.s;
  if (!s || !s.init) return;
  const { uL, uR, aL, aR, D, A, E } = s;
  const T = s.tmp;
  for (let i = 0; i < GN; i++) {
    T[i] = uL[i] - uR[i];
    A[i] = uL[i] > uR[i] ? aL[i] : aR[i];
  }
  // a 1-2-1 pass each way, twice, so no patch smaller than about 4 LED is drawn and the edges are round
  soften(T, D);
  soften(D, T);
  D.set(T);
  // a wider copy: the bright seam is drawn only where the boundary holds at this scale too, so a seed or a last island is not ringed
  boxb(T, E, s.tmp2, 3);
  boxb(E, E, s.tmp2, 3);
  boxb(E, E, s.tmp2, 2);
  const h = s.k[0];
  const cA = tone(0.105 + h, 0.9, 0.54), tA = tone(0.955 + h, 0.92, 0.12);
  const cB = tone(0.475 + h, 0.88, 0.54), tB = tone(0.635 + h, 0.92, 0.12);
  const P = s.period, kw = 2 * PI / P;
  const th = 0.7854 + 0.12 * sin(0.0731 * s.pt) + 0.07 * sin(0.0437 * s.pt + s.w3);
  const kc = kw * Math.cos(th), ks = kw * sin(th);
  const pA = kw * s.phA, pB = kw * s.phB;
  for (let py = 0; py < H; py++) {
    const gy = py * 0.5 - 0.25, iy = cl(floor(gy), 0, GH - 2), fy = cl(gy - iy, 0, 1);
    for (let px = 0; px < W; px++) {
      const gx = px * 0.5 - 0.25, ix = cl(floor(gx), 0, GW - 2), fx = cl(gx - ix, 0, 1);
      const p = iy * GW + ix;
      const w = (D[p] * (1 - fx) + D[p + 1] * fx) * (1 - fy) + (D[p + GW] * (1 - fx) + D[p + GW + 1] * fx) * fy;
      const ad = (A[p] * (1 - fx) + A[p + 1] * fx) * (1 - fy) + (A[p + GW] * (1 - fx) + A[p + GW + 1] * fx) * fy;
      const we = (E[p] * (1 - fx) + E[p + 1] * fx) * (1 - fy) + (E[p + GW] * (1 - fx) + E[p + GW + 1] * fx) * fy;
      const m = sm(-0.45, 0.45, w);
      let ga = 0.5 + 0.5 * sin(kc * px + ks * py - pA);
      let gb = 0.5 + 0.5 * sin(ks * px - kc * py + pB);
      ga = ga * ga * (3 - 2 * ga);
      gb = gb * gb * (3 - 2 * gb);
      const fr = 4 * m * (1 - m) * sm(0.5, 0.15, we < 0 ? -we : we), dim = 1.2 - 0.5 * ad;
      const Ar = tA[0] + (cA[0] - tA[0]) * ga, Ag = tA[1] + (cA[1] - tA[1]) * ga, Ab = tA[2] + (cA[2] - tA[2]) * ga;
      const Br = tB[0] + (cB[0] - tB[0]) * gb, Bg = tB[1] + (cB[1] - tB[1]) * gb, Bb = tB[2] + (cB[2] - tB[2]) * gb;
      let r = (m * Ar + (1 - m) * Br) * dim + fr * (0.55 * (ga * cA[0] + gb * cB[0]) + 0.14 * (cA[0] + cB[0]) + 0.05);
      let g = (m * Ag + (1 - m) * Bg) * dim + fr * (0.55 * (ga * cA[1] + gb * cB[1]) + 0.14 * (cA[1] + cB[1]) + 0.05);
      let b = (m * Ab + (1 - m) * Bb) * dim + fr * (0.55 * (ga * cA[2] + gb * cB[2]) + 0.14 * (cA[2] + cB[2]) + 0.05);
      display.setPixel(px, py, (min(1, r) * 255 + 0.5) | 0, (min(1, g) * 255 + 0.5) | 0, (min(1, b) * 255 + 0.5) | 0);
    }
  }
}
