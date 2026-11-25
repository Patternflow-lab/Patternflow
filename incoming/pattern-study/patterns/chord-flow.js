// ===== Patternflow pattern =====
// Title:   Chord Flow
// Family:  chord
// Idea:    A chord diagram on a tall elliptic ring: eight coloured node arcs round the panel, joined by filled Bezier ribbons whose widths are flows that swell, thin and trade places, so the arcs grow and shrink as the flow through them changes and the whole ring turns slowly.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the chord diagram (Circos, Martin Krzywinski and colleagues, 2009, from memory; the ribbon form comes from earlier flow diagrams); the elliptic ring, the Ornstein-Uhlenbeck flow process with surges, the Bezier ribbon rasteriser and the node-to-node colour gradient are original, pattern round 250
// Round:   250
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tempo=0.5..4, Curl=-1..1, Focus=-1..1
//
// Knob 1: Hue. Turns the eight node colours round the wheel; it opens on pink, violet, blue and teal, and each node's colour also wanders on its own slow beat.
// Knob 2: Tempo. 0.5 to 4, opening at 2. How fast the flows swell and thin, the surges come, the ribbons sway and the ring turns; at 0.5 it all moves at a quarter of the opening pace while the colours keep drifting.
// Knob 3: Curl. -1 to 1, opening at 0. How far the ribbons are pulled toward the middle of the ring: straight bands at -1, deep curled loops through the centre at 1.
// Knob 4: Focus. -1 to 1, opening at about 0.06. How concentrated the flows are: at -1 about twenty ribbons of similar width, at 1 about nine, three of them carrying half of the ring, and the node arcs grow uneven.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, exp, sin, cos, atan2, pow, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rnd = () => Math.random();
const gauss = () => sqrt(-2 * Math.log(1 - rnd())) * cos(TP * rnd());

const CX = 32, CY = 64;       // middle of the panel
const RA = 28.6, RB = 60.6;   // half width and half height of the ring's centre line
const HT = 2;                 // half thickness of the node arcs: 4 LED
const SWAY = 0.34;            // how far a ribbon's control point may move sideways, as a share of its chord
const WFRAC = 0.5;            // the share of its place on the node arc that a ribbon fills
const WMAX = 7;               // and the widest a ribbon is drawn at its ends, however big the flow
const RGAP = 2.0;             // dark seam between the node arc and the ribbons that start there
const N = 8;                  // nodes
const GAP = 3.4;              // empty LED between two node arcs, measured along the ring
const NP = 28;                // pairs
const BASE_HUE = 0.68, HAMP = 0.23;

// ---- the ring, measured along its length -----------------------------------------
const NTAB = 1024;
const thS = new Float64Array(NTAB + 1);   // parametric angle at s = k / NTAB of the perimeter
const sTh = new Float64Array(NTAB + 1);   // arc length at angle k / NTAB of a turn
let PER = 0;
(function table() {
  const M = 8192;
  const cum = new Float64Array(M + 1);
  for (let k = 1; k <= M; k++) {
    const a = (k - 0.5) / M * TP;
    cum[k] = cum[k - 1] + sqrt(RA * RA * sin(a) * sin(a) + RB * RB * cos(a) * cos(a)) * (TP / M);
  }
  PER = cum[M];
  for (let m = 0; m <= NTAB; m++) sTh[m] = cum[m * (M / NTAB)];
  let k = 0;
  for (let m = 0; m <= NTAB; m++) {
    const s = m / NTAB * PER;
    while (k < M && cum[k + 1] < s) k++;
    const f = k >= M ? 1 : (s - cum[k]) / max(1e-9, cum[k + 1] - cum[k]);
    thS[m] = (k + cl(f, 0, 1)) / M * TP;
  }
})();
const wrapS = (s) => s - floor(s / PER) * PER;
function thetaOf(s) {
  const f = wrapS(s) / PER * NTAB, i = min(NTAB - 1, floor(f));
  return thS[i] + (thS[i + 1] - thS[i]) * (f - i);
}
function sOfTheta(a) {
  a -= floor(a / TP) * TP;
  const f = a / TP * NTAB, i = min(NTAB - 1, floor(f));
  return sTh[i] + (sTh[i + 1] - sTh[i]) * (f - i);
}
// a point on the ring at arc length s, pulled inward by `inset` LED along the normal
function ringPt(s, inset, out) {
  const a = thetaOf(s), c = cos(a), n = sin(a);
  let nx = c / RA, ny = n / RB;
  const l = sqrt(nx * nx + ny * ny) || 1;
  out[0] = CX + RA * c - inset * nx / l;
  out[1] = CY + RB * n - inset * ny / l;
}

// ---- the same ring, per pixel ------------------------------------------------------
// distance to the centre line (positive outside) and the arc length of the nearest ring point; both fixed
const pxD = new Float32Array(W * H), pxS = new Float32Array(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5 - CX) / RA, v = (y + 0.5 - CY) / RB;
    const rho = sqrt(u * u + v * v) || 1e-6;
    const g = sqrt(u * u / (RA * RA) + v * v / (RB * RB)) / rho;
    pxD[y * W + x] = (rho - 1) / g;
    pxS[y * W + x] = sOfTheta(atan2(v, u));
  }
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- state ---------------------------------------------------------------------------
const PAI = new Uint8Array(NP), PAJ = new Uint8Array(NP);
const PIDX = [];
(function pairs() {
  let k = 0;
  for (let i = 0; i < N; i++) { PIDX.push(new Int16Array(N).fill(-1)); }
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { PAI[k] = i; PAJ[k] = j; PIDX[i][j] = k; PIDX[j][i] = k; k++; }
})();

export function setup(params) {
  const x = new Float64Array(NP), tau = new Float64Array(NP);
  for (let k = 0; k < NP; k++) { x[k] = gauss(); tau[k] = 6 + 8 * rnd(); }
  const wph = new Float64Array(NP * 4);
  for (let i = 0; i < NP * 4; i++) wph[i] = i % 2 ? 0.05 + 0.13 * rnd() : rnd() * TP;
  const hw = new Float64Array(N * 2);
  for (let i = 0; i < N; i++) { hw[i * 2] = 0.025 + 0.05 * rnd(); hw[i * 2 + 1] = 0; }
  const ph = new Float64Array(8);
  for (let i = 0; i < 8; i++) ph[i] = rnd() * TP;
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false,
    t: 0, th: 0, phi: rnd() * PER, nextSurge: 6 + 10 * rnd(), ph,
    am: new Float64Array(N).fill(1), nb: new Float64Array(N).fill(1), hw, y: new Float64Array(N).map(() => gauss()), ytau: new Float64Array(N).map(() => 8 + 8 * rnd()), x, tau, surge: new Float64Array(NP), wph: wph, wob: new Float64Array(NP),
    w: new Float64Array(NP),
    R: new Float64Array(N), L: new Float64Array(N),
    sa0: new Float64Array(NP), sb0: new Float64Array(NP),
    order: new Int16Array(NP), nord: 0,
    col: new Float64Array(N * 3), hue: new Float64Array(N),
    lut: new Float32Array(256 * 3),
    fb: new Float32Array(W * H * 3), rb: new Float32Array(W * H * 3), cov: new Float32Array(W * H), tt: new Float32Array(W * H), sv: new Float32Array(W * H),
    pull: 0.7,
  });
  return st;
}

// ---- the flows -----------------------------------------------------------------------
function layout(st) {
  const ks = st.ks;
  const gam = 1.55 * exp(1.15 * cl(ks[3], -1, 1));
  const w = st.w, x = st.x, sg = st.surge;
  let sum = 0;
  const r = st._r || (st._r = new Float64Array(NP));
  for (let k = 0; k < NP; k++) { r[k] = exp(cl(gam * (x[k] + sg[k]), -30, 30)) * st.am[PAI[k]] * st.am[PAJ[k]]; sum += r[k]; }
  const mean = sum / NP;
  sum = 0;
  for (let k = 0; k < NP; k++) { r[k] += 0.04 * mean; sum += r[k]; }
  const tot = (PER - N * GAP) / 2;               // sum of w over pairs; each ribbon uses w at both ends
  const cap = tot * (0.07 + 0.08 * sstep(-0.6, 1, ks[3]));
  // no ribbon takes much more than its cap of the ring: squash the big ones softly and share out what is freed
  for (let k = 0; k < NP; k++) w[k] = r[k] / sum * tot;
  for (let pass = 0; pass < 3; pass++) {
    let s2 = 0;
    for (let k = 0; k < NP; k++) { w[k] = cap * Math.tanh(w[k] / cap); s2 += w[k]; }
    const f = tot / s2;
    for (let k = 0; k < NP; k++) w[k] *= f;
  }
  // node arcs and the sub-arcs inside them
  let pos = 0;
  for (let i = 0; i < N; i++) {
    st.R[i] = pos;
    let u = 0;
    for (let d = N - 1; d >= 1; d--) {
      const j = (i + d) % N, k = PIDX[i][j];
      if (i < j) st.sa0[k] = pos + u; else st.sb0[k] = pos + u;
      u += w[k];
    }
    st.L[i] = u;
    pos += u + GAP;
  }
  const lm = (PER - N * GAP) / N;
  for (let i = 0; i < N; i++) st.nb[i] = 0.48 + 0.52 * sstep(0.35, 1.5, st.L[i] / lm);
  let n = 0;
  for (let k = 0; k < NP; k++) if (w[k] > 0.8) st.order[n++] = k;
  st.nord = n;
}

function step(st, dt) {
  const ks = st.ks, k = st.k;
  const a = 1 - exp(-dt / 0.25);
  for (let i = 0; i < 4; i++) ks[i] += (k[i] - ks[i]) * a;
  const tempo = cl(ks[1], 0.5, 4) * 0.5;
  const h = dt * tempo;
  st.t += dt;
  st.th += h;
  const p = st.ph;
  // the ring turns, a little faster and slower, now and then backwards
  const sp = 1.9 * (0.8 + 0.5 * sin(0.0173 * st.th + p[0]) + 0.3 * sin(0.0071 * st.th + p[1]) + 0.2 * sin(0.0293 * st.th + p[2]));
  st.phi = wrapS(st.phi + sp * h);
  const x = st.x, tau = st.tau, sg = st.surge;
  const dec = exp(-h / 11);
  for (let i = 0; i < NP; i++) {
    const e = exp(-h / tau[i]);
    x[i] = x[i] * e + sqrt(max(0, 1 - e * e)) * gauss();
    sg[i] *= dec;
  }
  for (let i = 0; i < N; i++) {
    const e = exp(-h / st.ytau[i]);
    st.y[i] = st.y[i] * e + sqrt(max(0, 1 - e * e)) * gauss();
    st.am[i] = exp(0.7 * st.y[i]);
  }
  st.nextSurge -= h;
  while (st.nextSurge <= 0) {
    st.nextSurge += 7 + 14 * rnd();
    // a surge goes to a pair that is small just now, so that dominance changes hands
    let best = -1, bv = 1e9;
    for (let q = 0; q < 4; q++) {
      const c = floor(rnd() * NP);
      if (st.w[c] < bv) { bv = st.w[c]; best = c; }
    }
    sg[best] += 1.1;
  }
  const k3 = cl(ks[2], -1, 1);
  for (let i = 0; i < NP; i++) {
    const q = i * 4;
    st.wob[i] = 0.6 * sin(st.wph[q + 1] * st.th + st.wph[q]) + 0.4 * sin(st.wph[q + 3] * st.th * 0.618 + st.wph[q + 2]);
  }
  st.pull = k3 < 0 ? 0.7 * (1 + k3) : 0.7 + 0.3 * k3;
  const psi = 0.03 * st.t + 0.7 * sin(0.0143 * st.t);
  const hue0 = ks[0] + BASE_HUE + 0.04 * sin(0.021 * st.t) + 0.025 * sin(0.0521 * st.t);
  for (let i = 0; i < N; i++) {
    // the palette slides round the nodes, and each node's hue also wanders a little on its own beat
    st.hue[i] = hue0 + HAMP * cos(TP * i / N + 0.2 + psi) + 0.14 * sin(st.hw[i * 2] * st.t + st.hw[i * 2 + 1]);
    hsv(st.hue[i], 0.86, 1, tmp3);
    // blue and violet are dark on an LED, so they lift a little
    const Y = 0.299 * tmp3[0] + 0.587 * tmp3[1] + 0.114 * tmp3[2];
    const lift = max(0, 0.5 - Y) * 0.8;
    st.col[i * 3] = min(1, tmp3[0] + lift); st.col[i * 3 + 1] = min(1, tmp3[1] + lift); st.col[i * 3 + 2] = min(1, tmp3[2] + lift);
  }
  layout(st);
}
const tmp3 = [0, 0, 0];

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    step(st, 0);
  }
  if (dt > 0) step(st, dt);
}

// ---- drawing -------------------------------------------------------------------------
const PA = [0, 0], PB = [0, 0];
const ax = new Float64Array(80), ay = new Float64Array(80), bx = new Float64Array(80), by = new Float64Array(80);

function drawRibbon(st, k, fb) {
  const i = PAI[k], j = PAJ[k], w = st.w[k];
  const cov = st.cov, tt = st.tt, sv = st.sv;
  // a ribbon fills the middle of its place on the node arc, so that ribbons side by side keep a dark seam
  const wv = max(WMAX * Math.tanh(w * WFRAC / WMAX), min(w, 2.6));
  const a0 = st.sa0[k] + st.phi + (w - wv) * 0.5, b0 = st.sb0[k] + st.phi + (w - wv) * 0.5;
  const ns = min(79, max(2, Math.ceil(wv / 0.75) + 1));
  const inset = HT + RGAP;
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  const e = min(0.5, 0.5 / max(wv, 0.5));          // keep the soft rim of the splats inside the true edge
  for (let q = 0; q < ns; q++) {
    const s = e + (1 - 2 * e) * q / (ns - 1);
    ringPt(a0 + s * wv, inset, PA);
    ringPt(b0 + (1 - s) * wv, inset, PB);
    ax[q] = PA[0]; ay[q] = PA[1]; bx[q] = PB[0]; by[q] = PB[1];
  }
  const pull = st.pull;
  // the control point sways to one side and the other, by a different slow beat for each ribbon
  const chx = bx[0] - ax[0], chy = by[0] - ay[0], chl = sqrt(chx * chx + chy * chy) || 1;
  const sway = st.wob[k] * SWAY * chl * pull;
  const swx = -chy / chl * sway, swy = chx / chl * sway;
  // length of the curve, about
  const mx = (ax[0] + bx[0]) * 0.5, my = (ay[0] + by[0]) * 0.5;
  const cx0 = CX + (mx - CX) * (1 - pull) + swx, cy0 = CY + (my - CY) * (1 - pull) + swy;
  const len = sqrt((ax[0] - cx0) ** 2 + (ay[0] - cy0) ** 2) + sqrt((bx[0] - cx0) ** 2 + (by[0] - cy0) ** 2);
  const nt = min(400, max(8, Math.ceil(len / 0.55)));
  const R = 1.55, R2 = R * R;
  for (let q = 0; q < ns; q++) {
    const sq = q / (ns - 1);
    const Ax = ax[q], Ay = ay[q], Bx = bx[q], By = by[q];
    const Mx = (Ax + Bx) * 0.5, My = (Ay + By) * 0.5;
    const Cx = CX + (Mx - CX) * (1 - pull) + swx, Cy = CY + (My - CY) * (1 - pull) + swy;
    for (let m = 0; m <= nt; m++) {
      const t = m / nt, u = 1 - t;
      const x = u * u * Ax + 2 * u * t * Cx + t * t * Bx, y = u * u * Ay + 2 * u * t * Cy + t * t * By;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      const x0 = max(0, floor(x - R)), x1 = min(W - 1, floor(x + R));
      const y0 = max(0, floor(y - R)), y1 = min(H - 1, floor(y + R));
      for (let yy = y0; yy <= y1; yy++) {
        const dy = yy + 0.5 - y, o = yy * W;
        for (let xx = x0; xx <= x1; xx++) {
          const dx = xx + 0.5 - x, q2 = dx * dx + dy * dy;
          if (q2 >= R2) continue;
          const c = cl(1.7 * (1 - sqrt(q2) / R), 0, 1);
          if (c > cov[o + xx]) { cov[o + xx] = c; tt[o + xx] = t; sv[o + xx] = sq; }
        }
      }
    }
  }
  // composite
  const X0 = max(0, floor(minx - R - 1)), X1 = min(W - 1, floor(maxx + R + 1));
  const Y0 = max(0, floor(miny - R - 1)), Y1 = min(H - 1, floor(maxy + R + 1));
  const hA = st.hue[i], hB = st.hue[j];
  const dh = hB - hA;                  // hues are kept unwrapped, so the gradient never flips to the other way round the wheel
  const alpha = 0.9 * sstep(0.9, 3.4, w);
  const bw = 0.68 + 0.32 * sstep(2, 9, w);
  for (let yy = Y0; yy <= Y1; yy++) {
    for (let xx = X0; xx <= X1; xx++) {
      const o = yy * W + xx, c = cov[o];
      if (c <= 0) continue;
      cov[o] = 0;
      const t = tt[o];
      const ee = sstep(0.12, 0.88, t);
      hsv(hA + dh * ee, 0.88, 1, tmp3);
      const ends = 1 - 4 * t * (1 - t);
      const sa = 2 * sv[o] - 1;
      const rim = sstep(0.55, 1, abs(sa));
      const br = bw * (0.55 + 0.45 * ends) * (0.42 + 0.6 * (1 - sa * sa) + 0.15 * rim);
      const al = alpha * c * (0.7 + 0.3 * ends);
      const f = o * 3;
      fb[f] += tmp3[0] * br * al;
      fb[f + 1] += tmp3[1] * br * al;
      fb[f + 2] += tmp3[2] * br * al;
    }
  }
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const fb = st.fb, lut = st.lut, rb = st.rb;
  // colour of the ring at each arc length, soft between the nodes: the glow takes it
  for (let q = 0; q < 256; q++) {
    const s = q / 256 * PER;
    let r = 0, g = 0, b = 0, ws = 0;
    for (let i = 0; i < N; i++) {
      let ds = s - (st.R[i] + st.L[i] * 0.5);
      ds -= PER * Math.round(ds / PER);
      const sg = st.L[i] * 0.5 + 5;
      const wt = exp(-(ds * ds) / (sg * sg));
      r += st.col[i * 3] * st.nb[i] * wt; g += st.col[i * 3 + 1] * st.nb[i] * wt; b += st.col[i * 3 + 2] * st.nb[i] * wt; ws += wt;
    }
    ws = ws > 1e-6 ? 1 / ws : 0;
    lut[q * 3] = r * ws; lut[q * 3 + 1] = g * ws; lut[q * 3 + 2] = b * ws;
  }
  const phi = st.phi;
  // background: near black blue, with a glow just inside and outside the ring in the colour of the node there
  for (let o = 0; o < W * H; o++) {
    const d = pxD[o];
    const sr = wrapS(pxS[o] - phi);
    const li = (floor(sr / PER * 256) & 255) * 3;
    const dn = d < 0 ? -d - HT : d - HT;
    const gw = d < 0 ? 0.28 * exp(-(dn * dn) / 90) : 0.3 * exp(-(dn * dn) / 70);
    const f = o * 3;
    fb[f] = 0.012 + lut[li] * gw * 0.9;
    fb[f + 1] = 0.018 + lut[li + 1] * gw * 0.9;
    fb[f + 2] = 0.045 + lut[li + 2] * gw * 0.9;
  }
  // ribbons, added up as light, so that crossings brighten and the order does not matter
  st.cov.fill(0);
  rb.fill(0);
  for (let a = 0; a < st.nord; a++) drawRibbon(st, st.order[a], rb);
  for (let f = 0; f < W * H * 3; f++) fb[f] = 1 - (1 - fb[f]) * exp(-1.5 * rb[f]);
  // node arcs
  const R = st.R, L = st.L, col = st.col;
  for (let o = 0; o < W * H; o++) {
    const d = pxD[o];
    if (d > HT + 1 || d < -HT - 1) continue;
    const sr = wrapS(pxS[o] - phi);
    let best = 0, bi = -1;
    for (let i = 0; i < N; i++) {
      let ds = sr - (R[i] + L[i] * 0.5);
      ds -= PER * Math.round(ds / PER);
      const hl = max(0, L[i] * 0.5 - HT);
      const dx = max(0, abs(ds) - hl);
      const dist = sqrt(dx * dx + d * d) - HT;
      const c = cl(0.5 - dist, 0, 1);
      if (c > best) { best = c; bi = i; }
    }
    if (bi < 0) continue;
    const f = o * 3;
    // a slightly lighter core along the middle of the arc
    const core = 0.4 * sstep(1.5, 0, abs(d));
    const nb = st.nb[bi];
    const r = min(1, col[bi * 3] * nb + core), g = min(1, col[bi * 3 + 1] * nb + core), b = min(1, col[bi * 3 + 2] * nb + core);
    fb[f] += (r - fb[f]) * best;
    fb[f + 1] += (g - fb[f + 1]) * best;
    fb[f + 2] += (b - fb[f + 2]) * best;
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const f = (y * W + x) * 3;
      const r = fb[f];
      let g = fb[f + 1];
      const b = fb[f + 2];
      // dim orange and yellow read as brown on the panel, so as they dim they slide toward red
      const m = r > g ? r : g;
      if (m < 0.8 && b < 0.5 * g) g *= 1 - 0.75 * pow(1 - m / 0.8, 0.7);
      display.setPixel(x, y, cl(r * 255 + 0.5, 0, 255) | 0, cl(g * 255 + 0.5, 0, 255) | 0, cl(b * 255 + 0.5, 0, 255) | 0);
    }
  }
}
