// ===== Patternflow pattern =====
// Title:   Four-Vertex Theorem
// Family:  line
// Idea:    A smooth closed curve slowly changes shape while its evolute, the path of its centres of curvature, turns inside it as a gold star with one cusp for each white vertex where the curvature is greatest or least, and the cusps are born and die in pairs but never number fewer than four.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: four-vertex theorem (Syamadas Mukhopadhyaya, 1909; Adolf Kneser, 1912), with the curve's evolute (Christiaan Huygens, 1673), pattern round 53
// Round:   53
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Terms=2..6, Bend=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the curve runs from azure where it is flattest through violet to magenta where it is sharpest. Its evolute is peach on the arcs that come from flat parts and pale gold on those from sharp parts, over a dark violet glow on the LEDs that four normals of the curve pass through. At 0.25 the curve runs violet through red to orange and the evolute is lime; at 0.5 orange to green with a pale azure evolute; at 0.75 green to blue with a pink one. The dark glow keeps off orange and yellow, which read brown and olive when dim.
// Knob 2: Speed. At 2 each wave of the curve swells and fades every 5 to 10 seconds while it turns, and the vertex count changes about 30 times a minute. The osculating circle rolls once round the curve in 7 seconds; on each lap its radius swells to about 105 LEDs on the flattest stretch (62 to 455) and shrinks to about 17 at the sharpest end. At 0.2 everything is ten times slower, at 3 half as fast again.
// Knob 3: Terms. How many waves bend the curve's radius: at 2 one with 3 lobes and one with 4, and each step adds the next, up to 8 lobes at 6. All of them share one swing of curvature, so the higher ones hardly move the outline while they fold the evolute into small swallowtails. At 2 the curve has 4 vertices 13% of the time, 6 for 52% and 8 for 35%; at 6 it has 4 to 16, mostly 10 or 12, and the count changes 60 times a minute. Every count is even.
// Knob 4: Bend. How far the waves may swing the curvature. Up to 0.06 the curve stays convex and the evolute a closed star. At Terms 2 the curve starts to dent from about 0.1, and at 1 it is dented 84% of the time (53% at Terms 6). The curvature passes through zero at the two ends of each dent and the evolute runs off the panel towards them; a small arc of it opens outside the curve, carrying the cusp of the dent's own vertex. Kneser's theorem covers these curves too, and the count still never falls below 4.
// Buttons: K1 tap swells the next wave up for about two seconds, peaking half a second after the tap, so a burst of swallowtails opens on the evolute and closes again; at the opening the count rises from 6.4 on average to a peak of 9.6.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Samples round the curve, the lowest and highest waves (in lobes), and
// how much taller than wide the curve stands before its waves bend it.
const M = 720, K0 = 3, KMAX = 8, ASP = 1.4;
// The box the curve is scaled to fit, in LEDs.
const BOX_W = 60, BOX_H = 120;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const R = Math.random, K = KMAX + 1;
  const nu = new Float64Array(K), a0 = new Float64Array(K), mu = new Float64Array(K), p0 = new Float64Array(K);
  for (let k = K0; k <= KMAX; k++) {
    nu[k] = 0.5 + 0.4 * R();
    a0[k] = TAU * R();
    mu[k] = (k % 2 ? -1 : 1) * (0.05 + 0.08 * R()) * (3 / k);
    p0[k] = TAU * R();
  }
  params.s = {
    nu, a0, mu, p0, wgt: new Float64Array(K), amp: new Float64Array(K), ph: new Float64Array(K),
    t: 0, u: 0, tap: 99, hue: 0, speed: 2, terms: 2, bend: 0.06, first: true,
    // Per sample: the point, its curvature, its centre of curvature, the sign
    // of the curvature's slope, and the arc length so far.
    x: new Float64Array(M), y: new Float64Array(M), k: new Float64Array(M),
    ex: new Float64Array(M), ey: new Float64Array(M), v: new Float64Array(M), arc: new Float64Array(M + 1),
    sc: 1, ox: 32, oy: 64, kmin: 0, kmax: 1,
    vert: [], prev: [], flash: [], osc: null, pt: new Float64Array(10),
    dx: new Float64Array(M), dy: new Float64Array(M), ga: new Float64Array(M), gx: new Float64Array(M), gb: new Float64Array(M), run: new Int32Array(W + 1), cnt: new Uint8Array(N), q: new Float64Array(M),
    // A running record: frames, how many had each vertex count, the least
    // count seen, and frames where the curve was dented.
    stat: { frames: 0, hist: {}, minCount: 99, concave: 0 },
    rgb: new Float32Array(N * 3), col: new Float64Array(3),
  };
}

// The curve in its own frame: r(phi) = 1 + sum c_k cos(k phi - p_k), drawn
// as (r cos phi, ASP r sin phi), with r and its first three derivatives
// summed exactly. Fills o with the point (0, 1), its centre of curvature
// (2, 3), the curvature (4), a number with the sign of the curvature's
// slope (5) and the velocity (6, 7), all in the curve's own units. With
// cross = x'y'' - y'x'' and D = x'^2 + y'^2 the curvature is cross / D^1.5,
// its slope has the sign of cross' D - 1.5 cross D', and the centre is the
// point plus D / cross times the velocity turned a quarter.
function at(S, phi, o) {
  let r = 1, r1 = 0, r2 = 0, r3 = 0;
  for (let k = K0; k <= KMAX; k++) {
    const a = S.amp[k];
    if (a === 0) continue;
    const q = k * phi - S.ph[k], c = a * cos(q), s = a * sin(q);
    r += c;
    r1 -= k * s;
    r2 -= k * k * c;
    r3 += k * k * k * s;
  }
  const cp = cos(phi), sp = sin(phi);
  const x = r * cp, y = ASP * r * sp;
  const x1 = r1 * cp - r * sp, y1 = ASP * (r1 * sp + r * cp);
  const x2 = r2 * cp - 2 * r1 * sp - r * cp, y2 = ASP * (r2 * sp + 2 * r1 * cp - r * sp);
  const cross = x1 * y2 - y1 * x2, D = x1 * x1 + y1 * y1;
  const dcross = ASP * (2 * r * r1 + 3 * r1 * r2 - r * r3), dD = 2 * (x1 * x2 + y1 * y2);
  o[0] = x;
  o[1] = y;
  const f = D / cross;
  o[2] = x - f * y1;
  o[3] = y + f * x1;
  o[4] = cross / (D * sqrt(D));
  o[5] = dcross * D - 1.5 * cross * dD;
  o[6] = x1;
  o[7] = y1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 2, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.terms = cl(floor(kv[2] + 0.5), 2, 6);
  S.bend = cl(kv[3], 0, 1);
  S.t += d * S.speed * 0.65;
  const t = S.t;
  // Each wave fades in or out over about a second when Terms moves.
  let wsum = 0;
  for (let k = K0; k <= KMAX; k++) {
    const target = k < K0 + S.terms ? 1 : 0;
    S.wgt[k] = S.first ? target : S.wgt[k] + (target - S.wgt[k]) * min(1, d * 2.5);
    wsum += S.wgt[k];
  }
  // How far the waves together may swing the curvature, as a share of the
  // circle's. The waves split it evenly, each scaled by 1 / (k^2 - 1) since
  // a wave of k lobes swings the curvature k^2 - 1 times its own height.
  // At 0.7 the curve stays convex; from about 0.86 (Bend 0.1) it dents.
  const budget = 0.7 + 1.6 * S.bend;
  if (input.btnPressed && input.btnPressed[0]) S.tap = 0;
  S.tap += d;
  // A tap swells the next wave up (or the top one when all are in). The
  // swell peaks 0.5 seconds after the tap and is gone in about 3.
  const kick = (S.tap / 0.5) * Math.exp(1 - S.tap / 0.5);
  const kicked = min(KMAX, K0 + S.terms);
  for (let k = K0; k <= KMAX; k++) {
    const e = 0.6 + 0.4 * sin(S.nu[k] * t + S.a0[k]);
    S.amp[k] = (budget * (S.wgt[k] * e / wsum + (k === kicked ? 0.6 * kick : 0))) / (k * k - 1);
    S.ph[k] = S.p0[k] + S.mu[k] * t;
  }
  // Sample, fit to the box, and find where the curvature's slope changes sign.
  const o = S.pt, X = S.x, Y = S.y, K = S.k, EX = S.ex, EY = S.ey, V = S.v;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, kmin = 1e9, kmax = -1e9, concave = false;
  // kmin is the least positive curvature.
  for (let i = 0; i < M; i++) {
    at(S, (TAU * i) / M, o);
    (X[i] = o[0]), (Y[i] = o[1]), (EX[i] = o[2]), (EY[i] = o[3]), (K[i] = o[4]), (V[i] = o[5]), (S.dx[i] = o[6]), (S.dy[i] = o[7]);
    x0 = min(x0, o[0]), x1 = max(x1, o[0]), y0 = min(y0, o[1]), y1 = max(y1, o[1]);
    kmax = max(kmax, o[4]);
    if (o[4] <= 0) concave = true;
    else kmin = min(kmin, o[4]);
  }
  // The scale fits the curve to the box.
  const fit = min(BOX_W / (x1 - x0), BOX_H / (y1 - y0));
  S.sc = S.first ? fit : S.sc + (fit - S.sc) * min(1, d * 2);
  const sc = S.sc;
  // Centred on the curve's box.
  S.ox = W / 2 - (sc * (x0 + x1)) / 2;
  S.oy = H / 2 + (sc * (y0 + y1)) / 2;
  S.kmin = kmin;
  S.kmax = kmax;
  // Arc length, for the osculating circle's even roll.
  S.arc[0] = 0;
  for (let i = 0; i < M; i++) {
    const j = (i + 1) % M;
    S.arc[i + 1] = S.arc[i] + Math.hypot(X[j] - X[i], Y[j] - Y[i]);
  }
  // Vertices: each sign change of the slope, placed by one secant step.
  S.prev = S.vert;
  const vert = [];
  for (let i = 0; i < M; i++) {
    const j = (i + 1) % M, a = V[i], b = V[j];
    if ((a < 0) !== (b < 0)) {
      const f = a / (a - b), phi = (TAU * (i + f)) / M;
      at(S, phi, o);
      vert.push({ phi, x: o[0], y: o[1], cx: o[2], cy: o[3], kap: o[4], max: a > 0 });
    }
  }
  S.vert = vert;
  // Vertices born or gone this frame start a flash, drawn as a ring.
  if (!S.first) {
    const near = (a, b) => a.max === b.max && angDist(a.phi, b.phi) < 0.15;
    if (vert.length !== S.prev.length) {
      for (const v of vert) if (!S.prev.some((p) => near(p, v))) S.flash.push({ v, age: 0, born: true });
      for (const p of S.prev) if (!vert.some((v) => near(p, v))) S.flash.push({ v: p, age: 0, born: false });
    }
  }
  for (const f of S.flash) f.age += d;
  S.flash = S.flash.filter((f) => f.age < 0.8);
  // The osculating circle rolls once round in 7 seconds at Speed 2.
  S.u = (S.u + (d * S.speed) / 14) % 1;
  const L = S.arc[M], goal = S.u * L;
  let lo = 0, hi = M;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (S.arc[mid] <= goal) lo = mid;
    else hi = mid;
  }
  const f = (goal - S.arc[lo]) / (S.arc[lo + 1] - S.arc[lo] || 1);
  at(S, (TAU * (lo + f)) / M, o);
  S.osc = { x: o[0], y: o[1], cx: o[2], cy: o[3], kap: o[4] };
  const st = S.stat;
  st.frames++;
  st.hist[vert.length] = (st.hist[vert.length] || 0) + 1;
  st.minCount = min(st.minCount, vert.length);
  if (concave) st.concave++;
  S.first = false;
}

function angDist(a, b) {
  const d = abs(a - b) % TAU;
  return d > PI ? TAU - d : d;
}

// Drawing: lines are laid as points every third of an LED, each lighting
// its four nearest LEDs by how close it falls, and an LED keeps the
// brightest colour laid on it.
function plot(S, x, y, c, a) {
  const fx = x - 0.5, fy = y - 0.5, ix = floor(fx), iy = floor(fy), tx = fx - ix, ty = fy - iy, rgb = S.rgb;
  for (let dy = 0; dy < 2; dy++) {
    const yy = iy + dy;
    if (yy < 0 || yy >= H) continue;
    const wy = dy ? ty : 1 - ty;
    for (let dx = 0; dx < 2; dx++) {
      const xx = ix + dx;
      if (xx < 0 || xx >= W) continue;
      const w = min(1, (dx ? tx : 1 - tx) * wy * 1.7) * a, p = (yy * W + xx) * 3;
      if (rgb[p] < c[0] * w) rgb[p] = c[0] * w;
      if (rgb[p + 1] < c[1] * w) rgb[p + 1] = c[1] * w;
      if (rgb[p + 2] < c[2] * w) rgb[p + 2] = c[2] * w;
    }
  }
}
// A segment, cut to the panel first: a radius of curvature can run
// thousands of LEDs off it.
function line(S, xa, ya, xb, yb, c, a, gap) {
  const dx = xb - xa, dy = yb - ya;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, xa + 1], [dx, W + 1 - xa], [-dy, ya + 1], [dy, H + 1 - ya]]) {
    if (p === 0) {
      if (q < 0) return;
    } else if (p < 0) t0 = max(t0, q / p);
    else t1 = min(t1, q / p);
  }
  if (t0 > t1) return;
  const len = Math.hypot(dx, dy), n = Math.ceil(len * (t1 - t0) * 3) || 1;
  for (let e = 0; e <= n; e++) {
    const u = t0 + ((t1 - t0) * e) / n;
    if (gap && floor((u * len) / gap) % 2) continue;
    plot(S, xa + dx * u, ya + dy * u, c, a);
  }
}
function dot(S, x, y, c, a, rad) {
  for (let yy = floor(y - rad); yy <= floor(y + rad); yy++)
    for (let xx = floor(x - rad); xx <= floor(x + rad); xx++) {
      if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
      const dd = Math.hypot(xx + 0.5 - x, yy + 0.5 - y), w = cl(rad + 0.5 - dd, 0, 1) * a, p = (yy * W + xx) * 3;
      if (w <= 0) continue;
      S.rgb[p] = max(S.rgb[p], c[0] * w);
      S.rgb[p + 1] = max(S.rgb[p + 1], c[1] * w);
      S.rgb[p + 2] = max(S.rgb[p + 2], c[2] * w);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, col, sc, ox, oy, x: X, y: Y, ex: EX, ey: EY, k: K } = S;
  const px = (u) => ox + sc * u, py = (v) => oy - sc * v;
  const h0 = S.hue + 0.55;
  rgb.fill(0);
  // How many normals of the curve pass through each LED: the sign changes
  // round the curve of g(phi) = (curve - LED) . tangent. Along a row, the
  // sign at one sample flips at a single column, so each pair of
  // neighbouring samples disagrees on one run of columns (or outside it),
  // added into the row's tally as a difference.
  const DX = S.dx, DY = S.dy, A = S.ga, B = S.gb, T = S.gx, run = S.run, cnt = S.cnt;
  for (let i = 0; i < M; i++) A[i] = X[i] * DX[i] + Y[i] * DY[i];
  for (let yy = 0; yy < H; yy++) {
    const my = (oy - yy - 0.5) / sc;
    run.fill(0);
    for (let i = 0; i < M; i++) {
      B[i] = A[i] - my * DY[i];
      // The column (in LED units) where this sample's sign flips.
      const tx = DX[i] || 1e-12;
      T[i] = (B[i] / tx) * sc + ox - 0.5;
    }
    for (let i = 0; i < M; i++) {
      const j = i + 1 < M ? i + 1 : 0;
      let c1 = T[i], c2 = T[j];
      if (c1 > c2) (c1 = T[j]), (c2 = T[i]);
      const lo = cl(Math.ceil(c1), 0, W), hi = cl(floor(c2) + 1, 0, W);
      if ((DX[i] || 1e-12) * (DX[j] || 1e-12) > 0) {
        if (hi > lo) run[lo]++, run[hi]--;
      } else {
        run[0]++, run[W]--;
        if (hi > lo) run[lo]--, run[hi]++;
      }
    }
    for (let xx = 0, c = 0, p = yy * W; xx < W; xx++, p++) {
      c += run[xx];
      cnt[p] = c;
    }
  }
  // The dim fill keeps off the orange and yellow part of the wheel, which
  // reads brown and olive when dark: its hue runs from green round to red.
  const fills = [];
  for (let c = 0; c < 4; c++) {
    const fh = h0 + 0.16 + 0.07 * c;
    hsv(0.22 + 0.8 * (fh - floor(fh)), 0.75, 0.24 + 0.12 * c, col);
    fills.push([col[0], col[1], col[2]]);
  }
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    const c = cnt[p];
    if (c <= 2) continue;
    const f = fills[min(3, (c - 4) >> 1)];
    (rgb[o] = f[0]), (rgb[o + 1] = f[1]), (rgb[o + 2] = f[2]);
  }
  // Each sample's place between the flattest and the sharpest of the
  // curve, on a log scale.
  const lk0 = log(S.kmin), lk1 = log(S.kmax), Q = S.q;
  for (let i = 0; i < M; i++) Q[i] = K[i] > 0 ? cl((log(K[i]) - lk0) / (lk1 - lk0 || 1), 0, 1) : 0;
  // The evolute, pale and opposite the curve on the wheel, a little nearer
  // the curve's own hue where its arc comes from a sharp part, and broken
  // where it runs off towards an inflection.
  for (let i = 0; i < M; i++) {
    const j = (i + 1) % M;
    if (K[i] > 0 !== K[j] > 0) continue;
    const xa = px(EX[i]), ya = py(EY[i]), xb = px(EX[j]), yb = py(EY[j]);
    if (abs(xb - xa) + abs(yb - ya) > 24) continue;
    hsv(h0 + 0.5 + 0.12 * Q[i], 0.5, 1, col);
    line(S, xa, ya, xb, yb, col, 0.9);
  }
  // Each vertex joined to its cusp by a dotted radius.
  const join = [0.5, 0.5, 0.55];
  for (const v of S.vert) line(S, px(v.x), py(v.y), px(v.cx), py(v.cy), join, 0.45, 1);
  // The osculating circle, in the colour of the curve where it touches.
  const oc = S.osc;
  if (oc && abs(oc.kap) > 1e-6) {
    const R = sc / abs(oc.kap), cx = px(oc.cx), cy = py(oc.cy);
    hsv(h0 + 0.35 * (oc.kap > 0 ? cl((log(oc.kap) - lk0) / (lk1 - lk0 || 1), 0, 1) : 0), 0.35, 0.8, col);
    const n = Math.ceil(min(TAU, 300 / R) * R * 2.5);
    const a0 = Math.atan2(py(oc.y) - cy, px(oc.x) - cx), span = min(PI, 150 / R);
    for (let e = 0; e <= n; e++) {
      const a = a0 - span + (2 * span * e) / n;
      plot(S, cx + R * cos(a), cy + R * sin(a), col, 0.7);
    }
  }
  // The curve, coloured by curvature: flat parts at the base hue, the
  // sharpest a third of the wheel on.
  for (let i = 0; i < M; i++) {
    const j = (i + 1) % M;
    hsv(h0 + 0.35 * Q[i], 0.85, 1, col);
    line(S, px(X[i]), py(Y[i]), px(X[j]), py(Y[j]), col, 1);
  }
  // Vertices on the curve, their cusps on the evolute.
  const cusp = [1, 0.92, 0.8];
  for (const v of S.vert) {
    dot(S, px(v.x), py(v.y), [1, 1, 1], 1, 1.1);
    dot(S, px(v.cx), py(v.cy), cusp, 1, 0.9);
  }
  if (oc) {
    dot(S, px(oc.x), py(oc.y), [1, 1, 1], 1, 0.9);
    dot(S, px(oc.cx), py(oc.cy), cusp, 1, 1);
  }
  const evo = [0.7, 0.7, 0.75];
  // A ring opens where a vertex was born or died: at its cusp, or at the
  // vertex itself when the cusp is off the panel.
  for (const f of S.flash) {
    let fx = px(f.v.cx), fy = py(f.v.cy);
    if (fx < 0 || fx >= W || fy < 0 || fy >= H) (fx = px(f.v.x)), (fy = py(f.v.y));
    const r = 1.5 + 6 * f.age, a = 1 - f.age / 0.8, n = 40;
    for (let e = 0; e < n; e++) plot(S, fx + r * cos((TAU * e) / n), fy + r * sin((TAU * e) / n), f.born ? [1, 1, 1] : evo, a);
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, (255 * cl(rgb[p], 0, 1)) | 0, (255 * cl(rgb[p + 1], 0, 1)) | 0, (255 * cl(rgb[p + 2], 0, 1)) | 0);
}
