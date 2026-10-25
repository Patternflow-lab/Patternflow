// ===== Patternflow pattern =====
// Title:   Double Gyre
// Family:  noise
// Idea:    Two counter-rotating cells of fluid stand one above the other while the line between them sways up and down, and each LED lights by how hard the fluid round it is torn apart over the next twenty units of flow time in amber and over the last twenty in azure, so the thin ridges that fluid never crosses wind round both cells, fold into tongues across the middle and stand the picture on its head every half turn of the forcing.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Lagrangian coherent structures as ridges of the finite-time Lyapunov exponent in the double gyre (Shawn Shadden, Francois Lekien and Jerrold Marsden, 2005), drawn by composing short flow maps (Steven Brunton and Clarence Rowley, 2010), pattern round 48
// Round:   48
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Horizon=-1..1, Epsilon=0..1
//
// Knob 1: Hue. Turns both colours round the wheel together, half a wheel apart. At 0 the forward ridges, which push fluid apart, are amber and the backward ones, which draw it together, azure. Where they cross they add to white. At 0.25 green and magenta, at 0.5 azure and amber, at 0.75 magenta and green.
// Knob 2: Speed. The starting time of the fields moves half a unit of flow time a second for each unit: 1 at the opening 2, so the forcing goes round once in 10 s and the picture stands on its head every 5 s; 0.1 at 0.2, a period in 100 s, and 1.5 at 3, a period in 6.7 s.
// Knob 3: Horizon. How long the fluid is followed, 20 units of flow time times 2 to the knob, to the nearest 2: 10 at -1, one period of the forcing, a few soft ridges round the cells and one across the middle; 14 at -0.5; 20 at the opening 0, two periods, the ridges folded into bundles of thin lines; 28 at 0.5 and 40 at 1, where the folds crowd closer than an LED and the chaotic sea round the cells turns to grain round two dark islands.
// Knob 4: Epsilon. How far the line between the cells sways, epsilon = 0.5 ln(1 + 1000 k) / ln 1001: 0 at 0, steady cells, where at a horizon of 10 the only ridges are the dividing line and the walls, white with the forward and backward ones lying on each other, and longer horizons add rings of shear round each cell; 0.17 at 0.01; 0.30 at the opening 0.06, where the line swings 18 LEDs either way of the middle; 0.40 at a quarter, 0.45 at half and 0.50 at 1, 26 LEDs either way.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, sqrt, log, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The flow, on [0,2] x [0,1]: psi = A sin(pi f) sin(pi y), with
// f = a x^2 + b x, a = eps sin(OM t), b = 1 - 2a. The panel stands the
// box up: row py is x = (py + 0.5) / 64, column px is y = (px + 0.5) / 64.
const A = 0.1, OM = (2 * PI) / 10, PER = 10, PA = PI * A;
// sin(pi u) from a table over one turn, for u above -4.
const TN = 2048, TH = TN / 2, ST = new Float64Array(TN + 1);
for (let i = 0; i <= TN; i++) ST[i] = sin((2 * PI * i) / TN);
const sinpi = (u) => {
  const w = (u + 4) * TH, i = w | 0, j = i & (TN - 1);
  return ST[j] + (ST[j + 1] - ST[j]) * (w - i);
};

// The velocity at (x, y) when a = s, into VU, VV.
let VU = 0, VV = 0;
function vel(x, y, s) {
  const b = 1 - 2 * s, f = s * x * x + b * x, sy = sinpi(y), cy = sinpi(y + 0.5);
  VU = -PA * sinpi(f) * cy;
  VV = PA * sinpi(f + 0.5) * sy * (2 * s * x + b);
}

// Short flow maps on a grid of nodes 1/64 apart, Brunton and Rowley's way:
// a drop is carried by looking up where the node grid round it goes, and
// a long flight is a chain of lookups. The quarter-unit maps that start at
// each of the 40 quarter units of a period are one RK4 step each; maps of
// a half, one and two units are each two of the level below.
const G = 0.25, NP = PER / G, NX = 129, NY = 65, NN = NX * NY, STEP = 8;
function buildMaps(eps) {
  let lv = [];
  for (let k = 0; k < NP / 2; k++) {
    const m = new Float32Array(NN * 2), t = k * G;
    const s0 = eps * sin(OM * t), s1 = eps * sin(OM * (t + G / 2)), s2 = eps * sin(OM * (t + G));
    for (let n = 0, j = 0; j < NX; j++)
      for (let i = 0; i < NY; i++, n += 2) {
        const x = j / 64, y = i / 64;
        vel(x, y, s0);
        const k1u = VU, k1v = VV;
        vel(x + 0.5 * G * k1u, y + 0.5 * G * k1v, s1);
        const k2u = VU, k2v = VV;
        vel(x + 0.5 * G * k2u, y + 0.5 * G * k2v, s1);
        const k3u = VU, k3v = VV;
        vel(x + G * k3u, y + G * k3v, s2);
        m[n] = cl(x + (G / 6) * (k1u + 2 * k2u + 2 * k3u + VU), 0, 2);
        m[n + 1] = cl(y + (G / 6) * (k1v + 2 * k2v + 2 * k3v + VV), 0, 1);
      }
    lv.push(m);
  }
  // Half a period on, the flow is the same turned upside down: psi(2 - x,
  // y, t + 5) = -psi(x, y, t). So the maps of the second half are those of
  // the first mirrored, node for node, at every length.
  const mirror = () => {
    for (let k = 0; k < NP / 2; k++) {
      const a = lv[k], m = new Float32Array(NN * 2);
      for (let j = 0; j < NX; j++)
        for (let i = 0; i < NY; i++) {
          const n = (j * NY + i) * 2, q = ((NX - 1 - j) * NY + i) * 2;
          m[n] = 2 - a[q];
          m[n + 1] = a[q + 1];
        }
      lv[k + NP / 2] = m;
    }
  };
  mirror();
  // Doubling: a map of 2L is the map of L from where the first L ends.
  for (let L = 1; L < STEP; L *= 2) {
    const up = [];
    for (let k = 0; k < NP / 2; k++) {
      const a = lv[k], m = new Float32Array(NN * 2);
      chain(a, lv[(k + L) % NP], m, NN);
      up.push(m);
    }
    lv = up;
    mirror();
  }
  return lv;
}
// Bilinear lookup of map b at each point of a, into out.
function chain(a, b, out, n2) {
  for (let n = 0; n < n2 * 2; n += 2) {
    let u = a[n] * 64, v = a[n + 1] * 64;
    if (u > 127.9999) u = 127.9999;
    if (v > 63.9999) v = 63.9999;
    const j = u | 0, i = v | 0, fu = u - j, fv = v - i, q = (j * NY + i) * 2, e = q + 2 * NY;
    const x0 = b[q] + (b[q + 2] - b[q]) * fv, x1 = b[e] + (b[e + 2] - b[e]) * fv;
    const y0 = b[q + 1] + (b[q + 3] - b[q + 1]) * fv, y1 = b[e + 1] + (b[e + 3] - b[e + 1]) * fv;
    out[n] = x0 + (x1 - x0) * fu;
    out[n + 1] = y0 + (y1 - y0) * fu;
  }
}

// The forward field for the node time k G: each LED's drop carried T units
// on through a chain of two-unit maps, rows r0..r1 of it.
function carry(S, J, r0, r1) {
  const { X, Y } = J, nm = S.T / 2;
  // Every drop of the band goes through the same maps in the same order, so
  // the band is carried map by map.
  for (let p = r0 * W; p < r1 * W; p++) {
    X[p] = (floor(p / W) + 0.5) / 64;
    Y[p] = ((p % W) + 0.5) / 64;
  }
  for (let q = 0, k = J.k; q < nm; q++, k = (k + STEP) % NP) {
    const b = S.maps[k];
    for (let p = r0 * W; p < r1 * W; p++) {
      let u = X[p] * 64, v = Y[p] * 64;
      if (u > 127.9999) u = 127.9999;
      if (v > 63.9999) v = 63.9999;
      const j = u | 0, i = v | 0, fu = u - j, fv = v - i, n = (j * NY + i) * 2, e = n + 2 * NY;
      const x0 = b[n] + (b[n + 2] - b[n]) * fv, x1 = b[e] + (b[e + 2] - b[e]) * fv;
      const y0 = b[n + 1] + (b[n + 3] - b[n + 1]) * fv, y1 = b[e + 1] + (b[e + 3] - b[e + 1]) * fv;
      X[p] = x0 + (x1 - x0) * fu;
      Y[p] = y0 + (y1 - y0) * fu;
    }
  }
}

// From the flow map to the picture: the log of the largest stretch of the
// Cauchy-Green tensor by central differences (sigma is this over T), then
// each LED pushed away from the mean of the nine round it, so thin ridges
// stand out of the broad glow round them.
const SHARP = 5;
function finish(J) {
  const { X, Y, L } = J, d = 1 / 64, out = new Float32Array(N);
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const p = py * W + px, u = py > 0 ? p - W : p, dn = py < H - 1 ? p + W : p, l = px > 0 ? p - 1 : p, r = px < W - 1 ? p + 1 : p;
      const hx = ((dn - u) / W) * d, hy = (r - l) * d;
      const a = (X[dn] - X[u]) / hx, b = (X[r] - X[l]) / hy, c = (Y[dn] - Y[u]) / hx, e = (Y[r] - Y[l]) / hy;
      const c11 = a * a + c * c, c12 = a * b + c * e, c22 = b * b + e * e, m = 0.5 * (c11 + c22);
      L[p] = 0.5 * log(max(1e-9, m + sqrt(max(0, m * m - (c11 * c22 - c12 * c12)))));
    }
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      let s = 0, n = 0;
      for (let j = max(0, py - 1); j <= min(H - 1, py + 1); j++)
        for (let i = max(0, px - 1); i <= min(W - 1, px + 1); i++) (s += L[j * W + i]), n++;
      const p = py * W + px;
      out[p] = L[p] + SHARP * (L[p] - s / n);
    }
  return out;
}

export function setup(params) {
  params.s = {
    hue: 0, rate: 1, T: 20, eps: -1, t0: 0, maps: null,
    // The sharpened log stretch at each node time of the period, worked out
    // once for each epsilon and horizon, and the one being worked on.
    field: [], job: null, cf: [0, 0, 0], cb: [0, 0, 0],
    X: new Float32Array(N), Y: new Float32Array(N), L: new Float32Array(N),
  };
}

const node = (n) => ((n % NP) + NP) % NP;

// Finishes any field the picture needs this frame, then works up to rows
// rows on the ones it will need next.
function work(S, rows) {
  const n = floor(S.t0 / G), need = [n, n + 1, -n - 1, -n, n + 2, -n - 2, n + 3, -n - 3].map(node);
  for (let q = 0; q < need.length; q++) {
    const k = need[q];
    if (S.field[k]) continue;
    if (q >= 4 && rows <= 0) return;
    if (!S.job || S.job.k !== k) S.job = { k, row: 0, X: S.X, Y: S.Y, L: S.L };
    const J = S.job, r1 = q < 4 ? H : min(H, J.row + rows);
    carry(S, J, J.row, r1);
    rows -= r1 - J.row;
    J.row = r1;
    if (r1 === H) {
      S.field[k] = finish(J);
      S.job = null;
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.rate = 0.5 * cl(k[1], 0.2, 3);
  const T = 2 * round(10 * 2 ** cl(k[2], -1, 1));
  const eps = round(500 * ((0.5 * log(1 + 1000 * cl(k[3], 0, 1))) / log(1001))) / 500;
  if (eps !== S.eps) {
    S.eps = eps;
    S.maps = buildMaps(eps);
    S.field = [];
    S.job = null;
  }
  if (T !== S.T) {
    S.T = T;
    S.field = [];
    S.job = null;
  }
  S.t0 = (S.t0 + d * S.rate) % PER;
  // Two fields for each quarter unit the start time moves, a little ahead.
  work(S, Math.ceil(((2.4 * H * d * S.rate) / G) * (S.T / 20)) + 8);
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// An LED lights from a stretch of e^2.4 = 11 times to full at e^3.6 = 37.
const STRETCH = 2.4, SPAN = 1.2;

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.maps) return;
  const cf = S.cf, cb = S.cb, n = floor(S.t0 / G), w = S.t0 / G - n;
  // Running time backward is the same flow turned half round: the fluid
  // carried back from t0 lands where fluid carried on from -t0 lands, with
  // the panel turned 180 degrees (psi(x, y, -t) = psi(x, y, t + 5) and
  // psi(x, 1 - y, t) = psi(x, y, t)). So the backward field at t0 is the
  // forward field at -t0 upside down and back to front.
  const f0 = S.field[node(n)], f1 = S.field[node(n + 1)], b0 = S.field[node(-n)], b1 = S.field[node(-n - 1)];
  if (!f0 || !f1 || !b0 || !b1) return;
  hsv(0.1 + S.hue, 0.86, 1, cf);
  hsv(0.6 + S.hue, 0.8, 1, cb);
  for (let py = 0, p = 0; py < H; py++) {
    for (let px = 0; px < W; px++, p++) {
      const q = N - 1 - p;
      const vf = cl((f0[p] + (f1[p] - f0[p]) * w - STRETCH) / SPAN, 0, 1);
      const vb = cl((b0[q] + (b1[q] - b0[q]) * w - STRETCH) / SPAN, 0, 1);
      if (vf + vb < 0.02) continue;
      // Steps of 4 of 255.
      const r = min(255, cf[0] * vf + cb[0] * vb), g = min(255, cf[1] * vf + cb[1] * vb), b = min(255, cf[2] * vf + cb[2] * vb);
      display.setPixel(px, py, (r >> 2) << 2, (g >> 2) << 2, (b >> 2) << 2);
    }
  }
}
