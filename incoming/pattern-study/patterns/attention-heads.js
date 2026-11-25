// ===== Patternflow pattern =====
// Title:   Attention Heads
// Family:  attention
// Idea:    Eight causal self-attention heads of a small language model read an endless stream of short repeating phrases and noise, and each draws its softmax matrix as a lower triangle of light, so a previous-token head is one bright line beside the diagonal, an induction head lights stripes only where the stream repeats itself, a sink head is a bar down the first column, a local head a band, a strided head a ladder of stripes, a delimiter head columns that fall from every full stop, a decay head a soft wash and a diffuse head a dim haze, while the whole stream slides up and left one token at a time and the bright spots run along the fixed structures.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the attention maps of causal transformer language models (Vaswani et al. 2017, from memory), the head roles named by interpretability work (previous-token and induction heads, Elhage, Olsson et al. 2021-22; attention sinks, Xiao et al. 2023; all from memory), drawn here as eight synthetic heads whose logits follow each role's rule over a generated token stream; the scrolling window whose exiting key fades out of the softmax, the drifting stride and decay, the phrase library that rewrites itself and the per-head hue are original, pattern round 252
// Round:   254
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Temperature=0..4, Context=-4..4, Flow=0..1
//
// Knob 1: Hue. Turns the eight head colours round the wheel together; at 0 the first head is a cool blue and the others follow it round the wheel, and each head also leans a little either way on its own.
// Knob 2: Temperature. 0 to 4, opening at 2. The temperature of every softmax, from 0.18 where each row keeps one hard bright cell, through 0.84 at the start where the sharp heads are crisp and the diffuse ones soft, to 4 where every row spreads into a wash; it also leans a little either way on its own.
// Knob 3: Context. -4 to 4, opening at 0. How many tokens each matrix shows, 10 at the start, 6 at -4 and 14 at 4; the cells grow or shrink smoothly so the matrix always fills its square.
// Knob 4: Flow. 0 to 1, opening at about 0.06. How fast tokens arrive, 0 holds the stream still while the picture keeps breathing, the start reads about two tokens a second, 1 is eight a second.

const W = 64, H = 128;
const SZ = 30;                                  // each matrix is 30 x 30 LED, gutters of 2, margin of 1
const OX = [1, 33], OY = [1, 33, 65, 97];
const NH = 8;
const NV = 40;                                  // vocabulary: token 0 is the full stop, 1 the comma, 2..39 words
const GS = 20;                                  // cells per side of a head's matrix buffer
const DIM = 4;                                  // width of the query and key vectors
const { floor, min, max, sqrt, exp, sin, pow, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const rnd = () => Math.random();

const hv = [0, 0, 0];
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// head roles, in reading order down the two columns
const PREV = 0, INDUCT = 1, SINK = 2, LOCAL = 3, STRIDE = 4, DELIM = 5, DECAY = 6, DIFFUSE = 7;
// where each head sits on the colour wheel when Hue is 0, after the base below
const HOFF = [0.0, 0.11, 0.22, 0.34, 0.47, 0.6, 0.73, 0.86];
const HBASE = 0.56;                             // Hue 0 opens on blue, so the first head is not red
// saturation, target luma, the gamma that lets a sharp cell glow and a diffuse row stay dim, the sharpening and mix of the
// two interpolations, and the faint ground that shows each matrix as a square, a little stronger over the masked half
const HSAT = 0.9, LUMA = 0.6, GAMMA = 0.64, SHARP = 1.25, MIXB = 0.3, GROUND = 0.09;
// saturation by hue: blue and violet give up a quarter of theirs, so that the heads on that side of the wheel reach the
// brightness of the others
const satOf = (h) => { const d = (h - floor(h) - 0.69) / 0.1; return HSAT - 0.26 * exp(-d * d); };
const FH = new Float64Array(256);               // brightness that evens the hues: yellow and green are dimmed toward blue
for (let i = 0; i < 256; i++) {
  const sat = satOf(i / 256), h = (i / 256) * 6, f = h - floor(h), q = 1 - f * sat, t = 1 - (1 - f) * sat, k = floor(h) % 6, p0 = 1 - sat;
  const r = k === 0 || k === 5 ? 1 : k === 1 ? q : k === 4 ? t : p0, g = k === 1 || k === 2 ? 1 : k === 0 ? t : k === 3 ? q : p0, b2 = k === 3 || k === 4 ? 1 : k === 2 ? t : k === 5 ? q : p0;
  FH[i] = min(1, pow(LUMA / (0.299 * r + 0.587 * g + 0.114 * b2), 0.8));
}

function randn() {
  let a = 0;
  for (let i = 0; i < 4; i++) a += rnd();
  return (a - 2) * 1.732;
}

export function setup(params) {
  const Q = [], K = [], cw = [], br = [], hd = [];
  for (let h = 0; h < NH; h++) {
    const q = new Float32Array(NV * DIM), k = new Float32Array(NV * DIM);
    for (let i = 0; i < q.length; i++) { q[i] = randn(); k[i] = randn(); }
    Q.push(q); K.push(k);
    cw.push(0.26 + 0.24 * ((h * 0.618) % 1));        // each head's content logits breathe at a rate of their own
    br.push([0.3 + 0.22 * ((h * 0.381) % 1), rnd() * TP, 0.8 + 0.3 * ((h * 0.236) % 1), rnd() * TP]);
    hd.push([0.011 + 0.006 * ((h * 0.472) % 1), rnd() * TP, 0.026 + 0.01 * ((h * 0.146) % 1), rnd() * TP]);
  }
  const pq = new Float32Array(NV), pk = new Float32Array(NV), gq = new Float32Array(NV);
  for (let i = 0; i < NV; i++) { pq[i] = rnd() * TP; pk[i] = rnd() * TP; gq[i] = rnd(); }
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, T: 0,
    Q, K, cw, br, hd, pq, pk, gq,
    n: 10, tau: 1, rate: 1.4, f: 0,
    hist: [], queue: [], act: [], lib: [], last: -1, prev2: -1,
    G: new Float32Array(NH * GS * GS), M: new Float64Array(GS + 2), row: new Float64Array(GS + 2),
    amp: new Float64Array(NH), sh: new Float64Array(NH), hue: 0, R: 11, wq: new Float64Array(3), wk: new Float64Array(3),
    stridek: 3.4, sw: 2.4, dk: 0.45, ph: [rnd() * TP, rnd() * TP, rnd() * TP, rnd() * TP, rnd() * TP, rnd() * TP],
  });
  // the stream: a few dozen active words, a library of short phrases made from them
  for (let i = 0; i < 12; i++) st.act.push(2 + floor(rnd() * (NV - 2)));
  for (let i = 0; i < 5; i++) st.lib.push(newPhrase(st));
  for (let i = 0; i < 70; i++) st.hist.push(nextToken(st));
  return st;
}

function newPhrase(st) {
  const len = 2 + floor(rnd() * 3), p = [];
  while (p.length < len) {
    const w = st.act[floor(rnd() * st.act.length)];
    if (p.indexOf(w) < 0) p.push(w);
  }
  return p;
}

// Segments of the stream: a phrase from the library with a stop or a comma after it, often the same phrase again,
// sometimes a few words of noise. Each word may be swapped for another, and now and then the library rewrites a phrase
// and the active words lose one, so the same few minutes never come round twice.
function refill(st) {
  const q = st.queue, r = rnd();
  if (rnd() < 0.16) st.act[floor(rnd() * st.act.length)] = 2 + floor(rnd() * (NV - 2));
  if (rnd() < 0.18) st.lib[floor(rnd() * st.lib.length)] = newPhrase(st);
  let seg = null;
  if (st.last >= 0 && r < 0.68) seg = st.lib[st.last];
  else if (r < 0.76) {
    seg = [];
    const m = 1 + floor(rnd() * 3);
    for (let i = 0; i < m; i++) seg.push(rnd() < 0.6 ? st.act[floor(rnd() * st.act.length)] : 2 + floor(rnd() * (NV - 2)));
    st.last = -1;
  } else {
    let pick = floor(rnd() * st.lib.length);
    if (pick === st.last && rnd() < 0.6) pick = (pick + 1 + floor(rnd() * (st.lib.length - 1))) % st.lib.length;
    st.last = pick; seg = st.lib[pick];
  }
  for (let i = 0; i < seg.length; i++) q.push(rnd() < 0.05 ? 2 + floor(rnd() * (NV - 2)) : seg[i]);
  q.push(rnd() < 0.72 ? 0 : 1);
}

function nextToken(st) {
  if (st.queue.length === 0) refill(st);
  return st.queue.shift();
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
  } else {
    const a = 1 - exp(-dt / 0.14);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  }
  st.T += dt;
  const T = st.T;
  const k2 = cl(st.ks[1], 0, 4), k3 = cl(st.ks[2], -4, 4), k4 = cl(st.ks[3], 0, 1);
  // temperature 0.25 .. 4, on a log scale, and it leans a little either way by itself
  st.tau = 0.18 * pow(22, k2 / 4) * exp(0.16 * sin(0.0613 * T + st.ph[0]) + 0.1 * sin(0.0291 * T + st.ph[1]));
  st.n = 10 + k3;
  // token rate: a square root so the first part of the knob is not all of the travel, nothing at 0
  const want = 8 * sqrt(k4) * sstep(0, 0.02, k4);
  st.rate += (want - st.rate) * (1 - exp(-dt / 0.35));
  st.f += st.rate * dt;
  while (st.f >= 1) { st.f -= 1; st.hist.push(nextToken(st)); if (st.hist.length > 80) st.hist.shift(); }
  // the stride and the decay wander, each on its own slow beat
  st.stridek = 3.75 + 1.05 * sin(0.0431 * T + st.ph[2]) + 0.45 * sin(0.0173 * T + st.ph[3]);
  st.sw = 2.5 + 0.8 * sin(0.0337 * T + st.ph[4]);
  st.dk = 0.46 + 0.14 * sin(0.0223 * T + st.ph[5]) + 0.06 * sin(0.0541 * T + st.ph[0]);
  st.hue = fin(st.ks[0], 0) + HBASE;
  st.R = min(GS - 3, Math.ceil(st.n) + 1);
  for (let h = 0; h < NH; h++) {
    const b = st.br[h];
    st.amp[h] = 0.97 + 0.18 * sin(b[0] * T + b[1]) + 0.07 * sin(b[2] * T + b[3]);
    st.sh[h] = 1 + 0.2 * sin(0.037 * (1 + 0.31 * h) * T + b[3]) + 0.1 * sin(0.0113 * (1 + 0.47 * h) * T + b[1]);
  }
  build(st);
}

// the token at distance r behind the newest one; r = -1 is the one that is sliding in
function tokAt(st, r) {
  const i = st.hist.length - 2 - r;
  return st.hist[i < 0 ? 0 : i];
}

function content(st, h, a, b) {
  const Q = st.Q[h], K = st.K[h], ia = a * DIM, ib = b * DIM;
  let s = 0;
  for (let i = 0; i < DIM; i++) s += Q[ia + i] * K[ib + i];
  return 0.5 * s + 0.5 * sin(st.cw[h] * st.T + st.pq[a] + 1.7 * st.pk[b]);
}

// pre-softmax logit of head h for the query at distance rq and the key rk behind it (rk >= rq)
function logit(st, h, rq, rk, tq, tkk) {
  const d = rk - rq;
  const c = content(st, h, tq, tkk);
  switch (h) {
    case PREV: return (3.1 + 3.0 * st.gq[tq]) * (d === 1 ? 1 : 0) + (d === 0 ? 0.6 : 0) + 1.1 * c;
    case INDUCT: {
      const hit = d >= 1 && tokAt(st, rk + 1) === tq ? 1 : 0;
      return 5.6 * hit - (hit ? 0.1 * d : 0) + (d === 0 ? 0.9 : 0) + (d === 1 ? 0.5 : 0) + 1.0 * c;
    }
    case SINK: {
      const col = st.n - 1 - st.f - rk;              // which column from the left the key stands in
      return (3.2 + 2.4 * st.gq[tq]) * exp(-max(0, col) / 0.55) + (d === 0 ? 0.5 : 0) + 1.5 * c;
    }
    case LOCAL: {
      const u = d / st.sw;
      return 4.6 * exp(-u * u) + 1.5 * c;
    }
    case STRIDE: {
      const k = st.stridek, m = d / k, e = (m - Math.round(m)) * k;
      return 4.8 * exp(-(e * e) / (2 * 0.32 * 0.32)) + 1.2 * c;
    }
    case DELIM: return 5 * (tkk < 2 ? 1 : 0) - 0.1 * d + (d === 0 ? 0.8 : 0) + 1.1 * c;
    case DECAY: return -d * st.dk * 2.2 + 0.9 * c;
    default: return 1.7 * c + (d === 0 ? 0.3 : 0);
  }
}

// each head's softmax over the keys in view: the oldest key fades out of the sum as it slides off the edge, so
// the rows do not jump when a token leaves
function build(st) {
  const n = st.n, f = st.f, R = st.R, G = st.G, M = st.M, row = st.row, tau = st.tau;
  for (let r = -1; r <= R; r++) M[r + 1] = sstep(0, 1, n - f - r);
  for (let h = 0; h < NH; h++) {
    const inv = st.sh[h] / (tau * (h === DIFFUSE ? 1.25 : h === DECAY ? 1.05 : 1));
    const base = h * GS * GS;
    for (let rq = -1; rq <= R; rq++) {
      const tq = tokAt(st, rq);
      let mx = -1e9;
      for (let rk = rq; rk <= R; rk++) {
        const L = logit(st, h, rq, rk, tq, tokAt(st, rk)) * inv;
        row[rk + 1] = L;
        if (L > mx) mx = L;
      }
      let z = 0;
      for (let rk = rq; rk <= R; rk++) { const w = M[rk + 1] * exp(row[rk + 1] - mx); row[rk + 1] = w; z += w; }
      const o = base + (rq + 1) * GS;
      for (let rk = rq; rk <= R; rk++) G[o + rk + 1] = row[rk + 1] / (z + 1e-9);
    }
  }
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const n = st.n, f = st.f, R = st.R, G = st.G, T = st.T;
  const cs = SZ / n, wq = st.wq, wk = st.wk;
  const tauEx = 1 + 0.16 * (st.tau - 1);
  for (let h = 0; h < NH; h++) {
    const ox = OX[h & 1], oy = OY[h >> 1], base = h * GS * GS;
    const hu = st.hue + HOFF[h] + 0.03 * sin(st.hd[h][0] * T + st.hd[h][1]) + 0.02 * sin(st.hd[h][2] * T + st.hd[h][3]);
    const gain = st.amp[h] * tauEx;
    for (let y = 0; y < SZ; y++) {
      const vc = (y + 0.5) / cs;
      const rq = cl(n - 0.5 - f - vc, -1, R - 0.001);
      const qb = Math.round(rq), tq = rq - qb;
      wq[0] = 0.5 * (0.5 - tq) * (0.5 - tq); wq[1] = 0.75 - tq * tq; wq[2] = 0.5 * (0.5 + tq) * (0.5 + tq);
      const q0 = floor(rq), fq = rq - q0;
      for (let x = 0; x < SZ; x++) {
        const uc = (x + 0.5) / cs;
        const mask = sstep(-1.3, -0.5, vc - uc);
        let v = 0;
        if (mask > 0) {
          const rk = cl(n - 0.5 - f - uc, -1, R - 0.001);
          const kb = Math.round(rk), tk = rk - kb;
          wk[0] = 0.5 * (0.5 - tk) * (0.5 - tk); wk[1] = 0.75 - tk * tk; wk[2] = 0.5 * (0.5 + tk) * (0.5 + tk);
          // two readings of the cells that touch the pixel, over the cells on the lit side of the diagonal only:
          // bilinear, which keeps a sharp cell sharp, and a quadratic B-spline, which straightens a diagonal line
          let sw = 0, sv = 0;
          for (let a = 0; a < 3; a++) {
            const qi = qb + a - 1;
            if (qi < -1 || qi > R) continue;
            for (let b = 0; b < 3; b++) {
              const ki = kb + b - 1;
              if (ki < qi || ki > R) continue;
              const wgt = wq[a] * wk[b];
              sw += wgt; sv += wgt * G[base + (qi + 1) * GS + ki + 1];
            }
          }
          const k0 = floor(rk), fk = rk - k0;
          let bw = 0, bv = 0;
          for (let a = 0; a < 2; a++) {
            const qi = q0 + a, wy = a ? fq : 1 - fq;
            for (let b = 0; b < 2; b++) {
              const ki = k0 + b;
              if (ki < qi) continue;
              const wgt = wy * (b ? fk : 1 - fk);
              bw += wgt; bv += wgt * G[base + (qi + 1) * GS + ki + 1];
            }
          }
          const vs = sw > 1e-6 ? min(1, SHARP * sv / sw) : 0, vb = bw > 1e-6 ? bv / bw : 0;
          v = (vb + (vs - vb) * MIXB) * mask;
        }
        const vv = cl(max(pow(v, GAMMA) * gain, GROUND * (0.6 + 0.4 * (1 - mask))), 0, 1);
        hsv(hu + 0.04 * (vv - 0.4), cl(satOf(hu) - 0.5 * vv * vv, 0, 1), vv * FH[(((hu - floor(hu)) * 256) | 0) & 255], hv);
        display.setPixel(ox + x, oy + y, floor(hv[0] * 255), floor(hv[1] * 255), floor(hv[2] * 255));
      }
    }
  }
}
