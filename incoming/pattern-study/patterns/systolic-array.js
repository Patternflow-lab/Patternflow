// ===== Patternflow pattern =====
// Title:   Systolic Array
// Family:  systolic
// Idea:    A weight-stationary systolic array fills the panel as eight columns by sixteen rows of rounded tiles, each holding one weight in its own colour, while amber activations slide right along every row and teal partial sums slide down every column, one tile a beat and skewed so that the lit tiles sweep from top left to bottom right as a diagonal wavefront, each multiply flashing white and each finished sum bursting at the bottom edge, until the batch ends and a new set of weights pours down the columns.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: systolic arrays (H. T. Kung and Charles E. Leiserson, 1978 and 1979, from memory), the weight-stationary matrix unit of the Tensor Processing Unit (Norman Jouppi and colleagues, 2017, from memory); pattern round 234
// Round:   234
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Clock=0.5..3.5, Batch=-1..1, Sparsity=-1..1
//
// Knob 1: Hue. Turns the weight palette and the token pair round the colour wheel together, so the amber activations and teal partial sums stay 135 degrees apart: violet and magenta tiles with amber and teal tokens at 0, crimson and orange tiles at 0.12 and 0.25 (ochre, with green and blue tokens at 0.25), green tiles with blue and red tokens at 0.5, and the opening picture again at 1.
// Knob 2: Clock. Beats a second: 1.5 at 0.5 (a tile every 0.67 s, a token crosses the 64 LED in 5.3 s), 3.7 at the opening 2 (2.2 s), 9 at 3.5 (0.9 s, and the flashes run together into a shimmer).
// Knob 3: Batch. The mean number of input vectors in a batch, and the empty beats between batches: 1 vector at -1 (one thin diagonal line at a time, 3 to 8 empty beats between lines), 8 at the opening 0 (bands of 3 to 16 vectors, 2 to 6 empty beats), 80 at 1 (the whole array lit at once, with 28 to 170 vectors in a batch and 1 to 3 empty beats).
// Knob 4: Sparsity. The share of weights that are zero: none at -1 (every tile flashes), 25 percent at 0, 29 percent at the opening 0.06, 85 percent at 1 (most tiles are dim holes that the tokens pass without a flash, and the teal sums stay thin). A given tile goes dark or comes back about every 10 to 40 s.

const W = 64;
const H = 128;
const NC = 8; // columns of tiles
const NR = 16; // rows of tiles
const N = NC * NR;
const { floor, ceil, exp, sin, abs, min, max, pow, sqrt, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

// ---- colour
function hsv(h, s, v, out, o) {
  const hh = (((h % 360) + 360) % 360) / 60;
  const i = floor(hh);
  const f = hh - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  const c = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][i % 6];
  out[o] = 255 * c[0];
  out[o + 1] = 255 * c[1];
  out[o + 2] = 255 * c[2];
}

const BG = [3, 5, 12]; // near-black blue
const BUS = [17, 26, 52]; // the faint bus between the tiles
const HOLE = [17, 23, 46]; // a tile whose weight is zero
const HG = 0.32; // and it keeps this much of the colour its weight would have had
const FW = [236, 242, 255]; // the white of a multiply
const AMB = 41; // hue of an activation, degrees
const TEA = 176; // hue of a partial sum, 135 degrees round from it
const WLO = 258; // hue of the lightest weight tile, and the heaviest is 66 degrees on

function buildColors(P) {
  const rot = 360 * P.k1;
  const lut = P.lut;
  for (let i = 0; i < 32; i++) {
    const u = i / 31;
    // warm hues go brown on the panel when they are dark, so they run brighter and paler
    const h = WLO + 66 * u + rot;
    const warm = max(0, Math.cos(((h - 40) * PI * 0.75) / 180));
    hsv(h, (0.58 + 0.14 * u) * (1 - 0.35 * warm), (0.22 + 0.34 * u) * (1 + 0.9 * warm), lut, i * 3);
  }
  const tok = P.tok;
  hsv(AMB + rot, 0.82, 1, tok, 0);
  hsv(TEA + rot, 0.9, 0.98, tok, 3);
  // the burst at the bottom edge is the teal with most of the white in it
  for (let k = 0; k < 3; k++) tok[6 + k] = tok[3 + k] + (255 - tok[3 + k]) * 0.62;
  // the light that runs down a column with new weights is the weight palette gone pale
  hsv(WLO + 30 + rot, 0.34, 1, tok, 9);
  P.lutK = P.k1;
}

// ---- the array's clock. Time here is in beats; the tokens sit on a tile for a moment and glide to the next.
const EB = 0.65;
function ease(s) {
  const p = floor(s);
  const f = s - p;
  return p + f + EB * (f * f * (3 - 2 * f) - f);
}

function newVec(P, t0) {
  const a = new Float32Array(NR);
  const lvl = (P.L < 3 ? 0.68 : 0.42) + (P.L < 3 ? 0.32 : 0.58) * Math.random();
  const f1 = 0.3 + 0.5 * Math.random();
  const f2 = 0.9 + 0.8 * Math.random();
  const p1 = Math.random() * TAU;
  const p2 = Math.random() * TAU;
  for (let r = 0; r < NR; r++) a[r] = cl(lvl * (0.64 + 0.36 * (0.6 * sin(f1 * r + p1) + 0.4 * sin(f2 * r + p2))), 0.14, 1);
  // the partial sum down each column, after each tile's multiply
  const acc = new Float32Array(N);
  for (let c = 0; c < NC; c++) {
    let s = 0;
    for (let r = 0; r < NR; r++) {
      const i = r * NC + c;
      if (P.hole[i] < 0.5) s += P.w[i] * a[r];
      acc[c * NR + r] = s;
    }
  }
  return { t0, a, acc };
}

function newMult() {
  return exp(0.7 * gauss()) / 1.28;
}

function gap(P) {
  const u = (P.k3 + 1) / 2;
  const lo = 3 - 2 * u;
  const hi = 8 - 5 * u;
  return round(lo + Math.random() * (hi - lo));
}

function fillWeights(w, z) {
  for (let i = 0; i < N; i++) {
    w[i] = 0.1 + 0.9 * Math.random();
    z[i] = Math.random();
  }
}

// whether tile i holds a zero at time t: its draw z runs round the unit circle once in 19 to 83 s, so the zeros are always a share sp of the tiles and a tile goes dark or comes back every now and then
const isHole = (P, z, i, t) => ((z[i] + t * P.zr[i]) % 1 < P.sp ? 1 : 0);

function startLoad(P) {
  fillWeights(P.wn, P.zn);
  const order = [];
  for (let c = 0; c < NC; c++) order.push(c);
  for (let c = NC - 1; c > 0; c--) {
    const j = floor(Math.random() * (c + 1));
    const t = order[c];
    order[c] = order[j];
    order[j] = t;
  }
  let end = 0;
  for (let c = 0; c < NC; c++) {
    P.ldDelay[c] = order[c] * 0.6 + 0.4 * Math.random();
    P.ldSpeed[c] = 1.6 + 0.8 * Math.random();
    end = max(end, P.ldDelay[c] + 17.4 / P.ldSpeed[c]);
  }
  P.ldT0 = P.T;
  P.loadEnd = P.T + end;
  P.state = 3;
}

function finishLoad(P) {
  P.w.set(P.wn);
  P.z.set(P.zn);
  for (let i = 0; i < N; i++) P.hole[i] = isHole(P, P.z, i, P.t);
  P.workT0 = P.T;
  P.thr = 110 + 150 * Math.random() + 1.2 * P.L;
  P.state = 1;
  P.nextLaunch = ceil(P.T) + 1 + floor(Math.random() * 3);
}

function endBatch(P) {
  const last = P.nextLaunch;
  if (last - P.workT0 >= P.thr) {
    P.state = 2;
    // the new weights start down the columns while the last sums are still on their way out of the bottom; those sums keep the old weights
    P.drainEnd = last + 14;
  } else {
    P.state = 1;
    P.nextLaunch = last + 1 + gap(P);
  }
}

function schedule(P) {
  for (let guard = 0; guard < 400; guard++) {
    const T = P.T;
    if (P.state === 0) {
      if (P.nextLaunch > T + 1) return;
      P.vecs.push(newVec(P, P.nextLaunch));
      P.count++;
      if (P.count >= max(1, round(P.mult * P.L))) endBatch(P);
      else P.nextLaunch += Math.random() < 0.05 ? 2 : 1;
    } else if (P.state === 1) {
      if (T + 1 < P.nextLaunch) return;
      P.state = 0;
      P.count = 0;
      P.mult = newMult();
      P.batchT0 = P.nextLaunch;
    } else if (P.state === 2) {
      if (T < P.drainEnd) return;
      startLoad(P);
    } else {
      if (T < P.loadEnd) return;
      finishLoad(P);
    }
  }
}

function step(P, db) {
  const T0 = P.T;
  const T1 = T0 + db;
  P.T = T1;
  schedule(P);
  // a multiply happens where a token sits on a tile, at the whole beats
  for (let n = floor(T0) + 1; n <= floor(T1); n++)
    for (const v of P.vecs) {
      const d = n - v.t0;
      if (d < 0 || d > NR + NC - 2) continue;
      for (let r = max(0, d - NC + 1); r <= min(NR - 1, d); r++) {
        const i = r * NC + (d - r);
        if (P.hole[i] < 0.5) P.fl[i] = max(P.fl[i], P.w[i] * v.a[r]);
      }
    }
  // a finished sum leaves the bottom edge half a tile past the last row
  for (const v of P.vecs)
    for (let c = 0; c < NC; c++) {
      const te = v.t0 + c + NR - 0.5;
      if (te > T0 && te <= T1) P.op[c] = max(P.op[c], 0.18 + 0.82 * cl(v.acc[c * NR + NR - 1] / 5, 0, 1));
    }
  const kf = exp(-db / P.tauF);
  // a tile's light rises at its own pace, so the tiles of one diagonal do not all strike on the same frame
  for (let i = 0; i < N; i++) {
    P.fl[i] *= kf;
    if (P.fl[i] > P.fa[i]) P.fa[i] += (P.fl[i] - P.fa[i]) * (1 - exp(-db / P.ta[i]));
    else P.fa[i] = P.fl[i];
  }
  const ko = exp(-db / 0.75);
  for (let c = 0; c < NC; c++) P.op[c] *= ko;
  while (P.vecs.length && T1 > P.vecs[0].t0 + NR + NC + 3) P.vecs.shift();
  const dimT = P.state === 3 || (P.state === 2 && T1 > P.drainEnd - 2.5) ? 1 : 0;
  P.dim += (dimT - P.dim) * (1 - exp(-db * (dimT ? 1.2 : 0.9)));
}

export function setup(P) {
  const cov = new Float32Array(W * H);
  const bloom = new Float32Array(W * H);
  const base = new Float32Array(W * H * 3);
  const pe = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const cx = x >> 3;
      const cy = y >> 3;
      const lx = x + 0.5 - (8 * cx + 4);
      const ly = y + 0.5 - (8 * cy + 4);
      // a 6 by 6 tile with rounded corners, 2 LED from the next
      const q0 = abs(lx) - (3 - 1.3);
      const q1 = abs(ly) - (3 - 1.3);
      const d = sqrt(max(q0, 0) * max(q0, 0) + max(q1, 0) * max(q1, 0)) + min(max(q0, q1), 0) - 1.3;
      cov[p] = cl(0.5 - d, 0, 1);
      bloom[p] = d > 0 && d < 2.6 ? exp(-d / 1.1) * (1 - cov[p]) : 0;
      const bus = (abs(ly) < 1 && abs(lx) > 3) || (abs(lx) < 1 && abs(ly) > 3) ? 1 : 0;
      for (let k = 0; k < 3; k++) base[p * 3 + k] = BG[k] + bus * (BUS[k] - BG[k]);
      pe[p] = cy * NC + cx;
    }
  Object.assign(P, {
    ready: true,
    t: 0,
    T: 0,
    rate: 3.7,
    rateT: 3.7,
    k1: 0,
    k3: 0,
    L: 9,
    sp: 0.29,
    cov,
    bloom,
    base,
    pe,
    w: new Float32Array(N),
    z: new Float32Array(N),
    wn: new Float32Array(N),
    zn: new Float32Array(N),
    hole: new Float32Array(N),
    fl: new Float32Array(N),
    fa: new Float32Array(N),
    ta: new Float32Array(N),
    op: new Float32Array(NC),
    bw: new Float32Array(N),
    bp: new Float32Array(N),
    zr: new Float32Array(N),
    dw: new Float32Array(N),
    dp: new Float32Array(N),
    tc: new Float32Array(N * 3),
    cur: new Float32Array(3),
    nxt: new Float32Array(3),
    ldDelay: new Float32Array(NC),
    ldSpeed: new Float32Array(NC),
    lut: new Float32Array(32 * 3),
    tok: new Float32Array(12),
    lutK: -1,
    IA: new Float32Array(W * H),
    IT: new Float32Array(W * H),
    IW: new Float32Array(W * H),
    IO: new Float32Array(W * H),
    gx: new Float32Array(64),
    gy: new Float32Array(64),
    vecs: [],
    state: 1,
    nextLaunch: 0,
    count: 0,
    mult: 1,
    batchT0: 0,
    workT0: 0,
    thr: 130 + 80 * Math.random(),
    drainEnd: 0,
    loadEnd: 0,
    ldT0: 0,
    dim: 0,
    tauF: 0.6,
    warm: false,
  });
  fillWeights(P.w, P.z);
  for (let i = 0; i < N; i++) {
    P.bw[i] = 0.45 + 0.9 * Math.random();
    P.bp[i] = Math.random() * TAU;
    P.ta[i] = 0.05 + 0.45 * Math.random();
    P.zr[i] = 0.012 + 0.04 * Math.random();
    P.dw[i] = 0.09 + 0.17 * Math.random();
    P.dp[i] = Math.random() * TAU;
  }
}

export function update(dt, input, P) {
  if (!P.ready) setup(P);
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  const d = min(max(dt || 0, 0), 0.1);
  P.k1 = k[0];
  P.rateT = 1.5 * pow(6, (cl(k[1], 0.5, 3.5) - 0.5) / 3);
  P.k3 = cl(k[2], -1, 1);
  P.L = 8 * pow(10, P.k3);
  const k4 = cl(k[3], -1, 1);
  P.sp = k4 < 0 ? 0.25 * (1 + k4) : 0.25 + 0.6 * k4;
  if (!P.warm) {
    P.warm = true;
    P.rate = P.rateT;
    for (let i = 0; i < N; i++) P.hole[i] = isHole(P, P.z, i, 0);
    P.tauF = max(0.7, 0.14 * P.rate);
    // open on an array that has been working for a while
    for (let i = 0; i < 400; i++) step(P, 0.2);
  }
  P.rate += (P.rateT - P.rate) * (1 - exp(-d / 0.35));
  P.t += d;
  P.tauF = max(0.7, 0.14 * P.rate);
  const kh = 1 - exp(-d / 0.6);
  for (let i = 0; i < N; i++) P.hole[i] += (isHole(P, P.z, i, P.t) - P.hole[i]) * kh;
  const db = P.rate * d;
  const ns = max(1, ceil(db / 0.25));
  for (let i = 0; i < ns; i++) step(P, db / ns);
}

// ---- the tokens
// A blob is a gaussian across and a gaussian head along, with a tail behind it that fades more slowly.
function blobX(P, buf, x, y, sx, sy, amp, tl, ta) {
  const gx = P.gx;
  const gy = P.gy;
  const xa = max(0, floor(x - 2.6 * tl));
  const xb = min(W - 1, ceil(x + 3 * sx));
  const ya = max(0, floor(y - 3 * sy));
  const yb = min(H - 1, ceil(y + 3 * sy));
  if (xa > xb || ya > yb) return;
  for (let i = xa; i <= xb; i++) {
    const dx = i + 0.5 - x;
    const head = exp(-(dx * dx) / (2 * sx * sx));
    gx[i - xa] = dx < 0 ? max(head, ta * exp(dx / tl)) : head;
  }
  for (let j = ya; j <= yb; j++) {
    const dy = j + 0.5 - y;
    gy[j - ya] = exp(-(dy * dy) / (2 * sy * sy)) * amp;
  }
  for (let j = ya; j <= yb; j++) {
    const o = j * W;
    const g = gy[j - ya];
    for (let i = xa; i <= xb; i++) buf[o + i] += g * gx[i - xa];
  }
}

function blobY(P, buf, x, y, sx, sy, amp, tl, ta) {
  const gx = P.gx;
  const gy = P.gy;
  const xa = max(0, floor(x - 3 * sx));
  const xb = min(W - 1, ceil(x + 3 * sx));
  const ya = max(0, floor(y - 2.6 * tl));
  const yb = min(H - 1, ceil(y + 3 * sy));
  if (xa > xb || ya > yb) return;
  for (let i = xa; i <= xb; i++) {
    const dx = i + 0.5 - x;
    gx[i - xa] = exp(-(dx * dx) / (2 * sx * sx)) * amp;
  }
  for (let j = ya; j <= yb; j++) {
    const dy = j + 0.5 - y;
    const head = exp(-(dy * dy) / (2 * sy * sy));
    gy[j - ya] = dy < 0 ? max(head, ta * exp(dy / tl)) : head;
  }
  for (let j = ya; j <= yb; j++) {
    const o = j * W;
    const g = gy[j - ya];
    for (let i = xa; i <= xb; i++) buf[o + i] += g * gx[i - xa];
  }
}

function drawTokens(P) {
  const T = P.T;
  P.IA.fill(0);
  P.IT.fill(0);
  P.IW.fill(0);
  P.IO.fill(0);
  for (const v of P.vecs) {
    const d = T - v.t0;
    if (d < -1 || d > NR + NC + 2) continue;
    // activations run right along each row
    for (let r = max(0, ceil(d - 8.4)); r <= min(NR - 1, floor(d + 0.7)); r++) {
      const pos = ease(d - r);
      if (pos < -0.75 || pos > 7.8) continue;
      const a = v.a[r];
      blobX(P, P.IA, 8 * pos + 4, 8 * r + 4, 1.0 + 0.4 * a, 0.78 + 0.3 * a, 0.52 + 0.48 * a, 3 + 2 * a, 0.3);
    }
    // partial sums run down each column and thicken as they gather
    for (let c = max(0, ceil(d - 17.2)); c <= min(NC - 1, floor(d + 0.7)); c++) {
      const pos = ease(d - c);
      if (pos < -0.75 || pos > 17.2) continue;
      const i0 = floor(pos);
      const va = i0 < 0 ? 0 : v.acc[c * NR + min(i0, NR - 1)];
      const vb = i0 + 1 > NR - 1 ? va : v.acc[c * NR + i0 + 1];
      const sv = cl((va + (vb - va) * sm(0, 1, pos - i0)) / 5, 0, 1);
      blobY(P, P.IT, 8 * c + 4, 8 * pos + 4, 0.6 + 0.6 * sv, 1.0, 0.4 + 0.6 * sv, 4.5 + 3 * sv, 0.3);
    }
  }
  // a finished sum bursts at the bottom edge and smears along it
  for (let c = 0; c < NC; c++) {
    const o = P.op[c];
    if (o < 0.02) continue;
    const x = 8 * c + 4;
    for (let j = H - 9; j < H; j++) {
      const dy = j + 0.5 - H;
      const gp = exp(-(dy * dy) / (2 * 2.1 * 2.1));
      const gs = exp(-(dy * dy) / (2 * 3.6 * 3.6));
      for (let i = max(0, x - 18); i < min(W, x + 18); i++) {
        const dx = i + 0.5 - x;
        P.IO[j * W + i] += o * (gp * exp(-(dx * dx) / (2 * 3.0 * 3.0)) + 0.2 * gs * exp(-(dx * dx) / (2 * 8 * 8)));
      }
    }
  }
  // the new weights come down a column as a pale light with a tail
  if (P.state === 3)
    for (let c = 0; c < NC; c++) {
      const yf = (T - P.ldT0 - P.ldDelay[c]) * P.ldSpeed[c] - 0.5;
      if (yf < -0.6 || yf > NR + 1.2) continue;
      blobY(P, P.IW, 8 * c + 4, 8 * yf + 4, 1.1, 1.5, 1.0, 11, 0.55);
    }
}

// a tile's colour from its weight, in out[0..2]: the weights are fixed for a batch but tuned a little all the time, so the colour drifts; a zero keeps a trace of it
function tileRGB(P, w, i, hole, m, out) {
  const wi = (cl((w + 0.25 * sin(P.t * P.dw[i] + P.dp[i]) - 0.1) / 0.9, 0, 1) * 31 + 0.5) | 0;
  const lut = P.lut;
  for (let k = 0; k < 3; k++) {
    const live = lut[wi * 3 + k];
    out[k] = (live + (HOLE[k] + (live - HOLE[k]) * HG - live) * hole) * m;
  }
}

function tileColors(P) {
  const tc = P.tc;
  const t = P.t;
  const loading = P.state === 3;
  const dimOld = 1 - 0.3 * P.dim;
  const dimNew = 1 - 0.05 * P.dim;
  const wl = P.tok;
  const cur = P.cur;
  const nxt = P.nxt;
  for (let r = 0; r < NR; r++)
    for (let c = 0; c < NC; c++) {
      const i = r * NC + c;
      const br = 1 + 0.22 * sin(t * P.bw[i] + P.bp[i]) + 0.1 * sin(0.9 * t - 0.31 * c - 0.23 * r);
      tileRGB(P, P.w[i], i, P.hole[i], br * dimOld, cur);
      let rr = cur[0];
      let gg = cur[1];
      let bb = cur[2];
      if (loading) {
        // the column's front: the tile turns to its new weight as the light passes its middle
        const yf = (P.T - P.ldT0 - P.ldDelay[c]) * P.ldSpeed[c] - 0.5;
        const q = yf - r;
        const nb = sm(-0.5, 0.5, q);
        const hn = isHole(P, P.zn, i, t);
        tileRGB(P, P.wn[i], i, hn, br * dimNew, nxt);
        rr += (nxt[0] - rr) * nb;
        gg += (nxt[1] - gg) * nb;
        bb += (nxt[2] - bb) * nb;
        const lf = (exp(-((q - 0.1) * (q - 0.1)) / (2 * 0.55 * 0.55)) + (q > 0.1 ? 0.45 * exp(-(q - 0.1) / 3.5) : 0)) * (1 - 0.55 * hn) * 0.85;
        if (lf > 0.01) {
          rr += wl[9] * lf;
          gg += wl[10] * lf;
          bb += wl[11] * lf;
        }
      }
      // a multiply lights the tile in its own colour first and then whitens it
      const F = min(1, P.fa[i]);
      if (F > 0.004) {
        const lift = 1 + 2 * F;
        const f = F * 0.5;
        rr = rr * lift + (FW[0] - rr * lift) * f;
        gg = gg * lift + (FW[1] - gg * lift) * f;
        bb = bb * lift + (FW[2] - bb * lift) * f;
      }
      tc[i * 3] = rr;
      tc[i * 3 + 1] = gg;
      tc[i * 3 + 2] = bb;
    }
}

export function draw(display, P) {
  if (!P.ready) return;
  if (P.lutK !== P.k1) buildColors(P);
  tileColors(P);
  drawTokens(P);
  const { cov, bloom, base, pe, tc, fa, tok, IA, IT, IW, IO } = P;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const i = pe[p];
      const cv = cov[p];
      let r = base[p * 3];
      let g = base[p * 3 + 1];
      let b = base[p * 3 + 2];
      if (cv > 0) {
        r += (tc[i * 3] - r) * cv;
        g += (tc[i * 3 + 1] - g) * cv;
        b += (tc[i * 3 + 2] - b) * cv;
      }
      const bl = bloom[p];
      if (bl > 0) {
        const f = min(1, fa[i]) * bl * 0.5;
        r += (FW[0] - r) * f;
        g += (FW[1] - g) * f;
        b += (FW[2] - b) * f;
      }
      const ia = min(1, IA[p]);
      const it = min(1, IT[p]);
      const iw = min(1, IW[p]);
      const io = min(1, IO[p]);
      if (ia > 0.004 || it > 0.004 || iw > 0.004 || io > 0.004) {
        const k = 1 - 0.55 * min(1, ia + it + iw);
        r = r * k + tok[0] * ia + tok[3] * it + tok[9] * iw + tok[6] * io;
        g = g * k + tok[1] * ia + tok[4] * it + tok[10] * iw + tok[7] * io;
        b = b * k + tok[2] * ia + tok[5] * it + tok[11] * iw + tok[8] * io;
      }
      display.setPixel(x, y, min(255, r) | 0, min(255, g) | 0, min(255, b) | 0);
    }
}
