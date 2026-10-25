// ===== Patternflow pattern =====
// Title:   Glass Patterns
// Family:  noise
// Idea:    A field of random dots is laid over three copies of itself, each moved on once more by the same small linear map T = exp(εA) about a wandering fixed point, so the eye joins every dot to its partners and reads the flow of x' = Ax, concentric circles for a rotation, spirals, rays out of a source and into a sink, hyperbolas for a saddle, while the dots shimmer, die and are dealt again and A travels a slow loop through the trace-determinant plane drawn in a strip at the top, where the axes, the parabola τ² = 4Δ and the tinted regions say which kind of picture the field below is showing.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Glass patterns (Leon Glass, 1969), with the trace-determinant classification of linear systems (Henri Poincaré, 1881), pattern round 46
// Round:   46
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Dots=320..800, Step=0..1
//
// Knob 1: Hue. Turns the dots round the wheel; each chain of four runs from a deep tail to a pale head, the head leading the flow. At 0 ice cyan heads over violet tails, at 0.25 violet over red, at 0.5 rose over lime, at 0.75 lime over cyan. The strip keeps its own colours: magenta for the saddles, amber for the nodes, teal for the spirals.
// Knob 2: Speed. How fast A goes round its loop of four stops (circles, rays out, hyperbolas, rays in): at 2 a stop every 4 s and the whole loop in 16 s, each stop held for about a second, the dots riding the flow at 0.3 of its rate and living 0.9 to 1.8 s; at 0.2 all of it ten times slower, at 3 half as fast again.
// Knob 3: Dots. How many chains of four are dealt over the 64 x 104 field, one to a cell of a grid: 320 at the start (1280 dots), 440 at a quarter, 560 at half, 680 at three quarters and 800 at the end (3200 dots), where the field is so crowded that the flow starts to drown in it.
// Knob 4: Step. The size of the map, ε in T = exp(εA): 0.012 at 0, where the four dots of a chain fall within an LED or two of each other and the flow is hidden; 0.049 at 0.06, where a chain 30 LEDs from the fixed point is about 4 LEDs long; 0.10 at 0.25, long and loose; 0.14 at 0.5, where the chains come apart; 0.21 at 1, where partners land too far apart to pair and the field is noise again.
// Buttons: K1 tap jumps A straight on to the next stop of the loop.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, sin, cos, exp, sinh, cosh, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The strip: rows 0..21 hold the (τ, Δ) plane at 10 LEDs to a unit, τ = 0 on
// column 32 and Δ = 0 on row 15. Row 22 is a faint rule; the dots live on
// rows 24..127.
const IH = 22, FY = 24, FH = H - FY;
const SX = 10, OX = 32, OY = 15;
const toX = (tau) => OX + SX * tau, toY = (det) => OY - SX * det;
// A's loop: an ellipse round the origin of the plane, τ = 2.6 sin φ and
// Δ = 0.425 + 0.925 cos φ. It starts at the top, a pure rotation (τ = 0,
// Δ = 1.35); passes through the spirals; meets the parabola at φs, where A is
// a multiple of the identity, a star node; runs through the nodes into Δ < 0;
// stops at φ = π, a pure saddle; and comes back the other side with τ < 0.
const TA = 2.6, D0 = 0.425, DB = 0.925;
// Where the ellipse meets τ² = 4Δ: 1.69 sin² φ = 0.425 + 0.925 cos φ, a
// quadratic in cos φ.
const PHS = (() => {
  const a = (TA * TA) / 4, c = (-DB + sqrt(DB * DB + 4 * a * (a - D0))) / (2 * a);
  return Math.acos(c);
})();
const STOPS = [0, PHS, PI, 2 * PI - PHS, 2 * PI];
const SEG = 4; // seconds from stop to stop at Speed 2
// Types, as the plane's regions: 0 saddle, 1 node, 2 spiral (3 the centre,
// the positive Δ axis, which the loop only touches).
const typeOf = (tau, det) => (det < 0 ? 0 : tau * tau - 4 * det >= -1e-9 ? 1 : abs(tau) < 1e-6 ? 3 : 2);
// Faint tints for the regions, and the brighter one for the region A is in.
const TINT = [[0.16, 0.03, 0.15], [0.17, 0.09, 0.0], [0.0, 0.1, 0.15], [0.0, 0.1, 0.15]];
const MARK = [[1, 0.35, 0.95], [1, 0.72, 0.2], [0.3, 0.9, 1], [0.3, 0.9, 1]];

// Each inset LED: its region and how much of the axes or the parabola it holds.
const IREG = new Uint8Array(W * IH), ILINE = new Float32Array(W * IH), IAX = new Float32Array(W * IH), IPATH = new Float32Array(W * IH);
for (let y = 0; y < IH; y++)
  for (let x = 0; x < W; x++) {
    const tau = (x + 0.5 - OX) / SX, det = (OY - (y + 0.5)) / SX, i = y * W + x;
    IREG[i] = det < 0 ? 0 : tau * tau > 4 * det ? 1 : 2;
    // Distance to the parabola, in LEDs, from the gradient of Δ - τ²/4.
    const f = det - (tau * tau) / 4, dp = (SX * abs(f)) / sqrt(1 + (tau * tau) / 4);
    ILINE[i] = cl(1.1 - dp, 0, 1);
    IAX[i] = y === OY || x === OX ? 1 : 0;
  }
// The loop's path, dotted every 3 LEDs of its length.
for (let k = 0, run = 0, px = toX(0), py = toY(D0 + DB); k <= 720; k++) {
  const ph = (k / 720) * 2 * PI, x = toX(TA * sin(ph)), y = toY(D0 + DB * cos(ph));
  run += sqrt((x - px) ** 2 + (y - py) ** 2);
  px = x;
  py = y;
  const ix = floor(x), iy = floor(y);
  if (ix >= 0 && ix < W && iy >= 0 && iy < IH && run % 3 < 1.2) IPATH[iy * W + ix] = 1;
}

const MAXD = 800, CH = 4, FLOW = 0.3;
export function setup(params) {
  params.s = {
    begun: false, t: 0, u: 0, hue: 0, speed: 2, n: 0, eps: 0.05,
    // Each chain: its cell, its first dot (anywhere a little beyond the field), its age and its life.
    cell: new Int32Array(MAXD), gx: 1, gy: 1,
    ax: new Float32Array(MAXD), ay: new Float32Array(MAXD), age: new Float32Array(MAXD), life: new Float32Array(MAXD),
    // A now (row by row), its trace and determinant on the loop, its type,
    // the fixed point and the strain's axis.
    A: new Float64Array(4), T1: new Float64Array(4), E: new Float64Array(4), s: 0, k2: 0, M: [0, 0, 0, 0], TP: new Float64Array(4 * 8),
    tau: 0, det: 1, type: 3, cx: 32, cy: 76, psi: 0,
    buf: new Float32Array(W * H * 3), col: new Float32Array(24),
  };
}

// The first dots are dealt one to a cell of a grid laid over the field and a
// margin of 5 LEDs round it, at a random place in the cell. Pure random dots
// clump and leave holes, and on 64 columns the clumps read as structure of
// their own; one to a cell keeps the only structure the one the map makes.
const MG = 5, AW = W + 2 * MG, AH = FH + 2 * MG;
function layout(S, n) {
  const gx = max(1, round(sqrt((n * AW) / AH))), gy = Math.ceil(n / gx);
  S.gx = gx;
  S.gy = gy;
  // Which cells are used when n is short of gx * gy: a shuffle.
  const all = Array.from({ length: gx * gy }, (_, i) => i);
  for (let i = all.length - 1; i > 0; i--) {
    const j = floor(Math.random() * (i + 1)), t = all[i];
    all[i] = all[j];
    all[j] = t;
  }
  for (let i = 0; i < n; i++) S.cell[i] = all[i];
  for (let i = 0; i < n; i++) spawn(S, i), (S.age[i] = Math.random() * S.life[i]);
}
function spawn(S, i) {
  const c = S.cell[i], cx = c % S.gx, cy = floor(c / S.gx);
  S.ax[i] = -MG + ((cx + Math.random()) * AW) / S.gx;
  S.ay[i] = FY - MG + ((cy + Math.random()) * AH) / S.gy;
  S.life[i] = 0.9 + 0.9 * Math.random();
  S.age[i] = 0;
}

// φ from the loop clock u (one unit a stop): each stop is held while the
// smoothstep is flat, the first and last 12% of every leg.
function phiOf(u) {
  const i = floor(u) % 4, f = u - floor(u);
  return STOPS[i] + (STOPS[i + 1] - STOPS[i]) * sm(0.12, 0.88, f);
}

// A from its trace and determinant, as the plainest matrix with them: a
// dilation τ/2 plus a rotation w when τ² < 4Δ, plus a strain e along the
// axis ψ when τ² > 4Δ. Scaled to unit size (τ²/4 + w² + e² = 1), which
// keeps its type: (τ, Δ) -> (cτ, c²Δ) leaves the axes and the parabola where
// they are. exp(tA) comes in closed form, since the traceless part M has
// M² = (e² - w²) I: cosh and sinh of t k for a node or saddle, cos and sin
// for a spiral or centre.
function expA(S, t, out) {
  const k2 = S.k2, M = S.M;
  let a, b;
  if (k2 > 1e-12) {
    const k = sqrt(k2);
    a = cosh(t * k);
    b = sinh(t * k) / k;
  } else if (k2 < -1e-12) {
    const k = sqrt(-k2);
    a = cos(t * k);
    b = sin(t * k) / k;
  } else {
    a = 1;
    b = t;
  }
  const g = exp(t * S.s);
  out[0] = g * (a + b * M[0]);
  out[1] = g * b * M[1];
  out[2] = g * b * M[2];
  out[3] = g * (a + b * M[3]);
}
function build(S) {
  const tau = S.tau, det = S.det, disc = (tau * tau) / 4 - det;
  let w = 0, e = 0;
  if (disc < 0) w = sqrt(-disc);
  else e = sqrt(disc);
  const m = sqrt((tau * tau) / 4 + w * w + e * e) || 1, s = tau / 2 / m;
  w /= m;
  e /= m;
  const c2 = cos(2 * S.psi), s2 = sin(2 * S.psi);
  // M = w J + e S(ψ), J the quarter turn, S(ψ) the reflection-like strain.
  const M = [e * c2, e * s2 - w, e * s2 + w, -e * c2];
  const A = S.A;
  A[0] = s + M[0];
  A[1] = M[1];
  A[2] = M[2];
  A[3] = s + M[3];
  S.s = s;
  S.k2 = e * e - w * w;
  S.M = M;
  expA(S, S.eps, S.T1);
  const T1 = S.T1, TP = S.TP;
  // TP holds T^k for k = 0 .. CH - 1.
  TP[0] = TP[3] = 1;
  TP[1] = TP[2] = 0;
  for (let k = 1; k < CH; k++) {
    const o = 4 * k, q = o - 4;
    TP[o] = T1[0] * TP[q] + T1[1] * TP[q + 2];
    TP[o + 1] = T1[0] * TP[q + 1] + T1[1] * TP[q + 3];
    TP[o + 2] = T1[2] * TP[q] + T1[3] * TP[q + 2];
    TP[o + 3] = T1[2] * TP[q + 1] + T1[3] * TP[q + 3];
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 320, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  const n = round(cl(kv[2], 320, MAXD));
  S.eps = 0.012 + 0.2 * Math.pow(cl(kv[3], 0, 1), 0.6);
  // A new count lays a new grid and deals every dot again.
  if (!S.begun || n !== S.n) {
    layout(S, n);
    S.n = n;
    S.begun = true;
  }
  const ds = (d * S.speed) / 2;
  S.t += ds;
  S.u = (S.u + ds / SEG) % 4;
  if (input.btnPressed && input.btnPressed[0]) S.u = (floor(S.u + 0.12) + 1) % 4;
  const ph = phiOf(S.u);
  S.tau = TA * sin(ph);
  S.det = D0 + DB * cos(ph);
  S.type = typeOf(S.tau, S.det);
  // The fixed point wanders over the middle of the field, and the strain's
  // axis turns slowly, so the nodes and the saddle do not always line up
  // with the LED grid.
  S.cx = 32 + 7 * sin(0.21 * S.t + 0.4);
  S.cy = FY + FH / 2 + 14 * sin(0.13 * S.t + 1.1);
  S.psi = 0.5 * sin(0.07 * S.t);
  build(S);
  // The dynamic Glass pattern: dots die and are dealt again somewhere new,
  // so the texture never holds still while the flow it shows stays put.
  // The dots also ride the flow itself, at FLOW times the field's speed, so
  // the circles turn, the rays stream and the saddle pours in along one axis
  // and out along the other.
  expA(S, FLOW * ds, S.E);
  const E = S.E, cx = S.cx, cy = S.cy;
  for (let i = 0; i < S.n; i++) {
    const rx = S.ax[i] - cx, ry = S.ay[i] - cy;
    S.ax[i] = cx + E[0] * rx + E[1] * ry;
    S.ay[i] = cy + E[2] * rx + E[3] * ry;
    S.age[i] += ds;
    if (S.age[i] >= S.life[i]) spawn(S, i);
  }
}

function addDot(buf, x, y, c, o, v) {
  const ix = floor(x), iy = floor(y);
  if (ix < 0 || ix >= W || iy < FY || iy >= H) return;
  const p = (iy * W + ix) * 3;
  buf[p] += c[o] * v;
  buf[p + 1] += c[o + 1] * v;
  buf[p + 2] += c[o + 2] * v;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, C = S.col, TP = S.TP;
  buf.fill(0);
  // Tail to head of each chain: the head leads, so the brightness says which
  // way the flow runs.
  const h0 = 0.5 + S.hue;
  for (let k = 0; k < CH; k++) {
    const u = k / (CH - 1);
    hsv(h0 + 0.27 * (1 - u), 0.9 - 0.3 * u, 0.65 + 0.35 * u, C, 3 * k);
  }
  const cx = S.cx, cy = S.cy;
  for (let i = 0; i < S.n; i++) {
    const a = S.age[i], l = S.life[i];
    // Fade in over 0.12 s and out over 0.2 s in three steps, so a chain comes and goes softly.
    const f = min(1, a / 0.12, (l - a) / 0.2), v = f > 0.66 ? 1 : f > 0.33 ? 0.6 : 0.3;
    const rx = S.ax[i] - cx, ry = S.ay[i] - cy;
    for (let k = 0, o = 0; k < CH; k++, o += 4) addDot(buf, cx + TP[o] * rx + TP[o + 1] * ry, cy + TP[o + 2] * rx + TP[o + 3] * ry, C, 3 * k, v);
  }
  // The strip: tinted regions, the one A is in lit more, axes, the parabola,
  // the loop dotted, and A as a bright dot with a cross in its region's colour.
  const reg = S.type === 3 ? 2 : S.type, mk = MARK[S.type];
  for (let y = 0; y < IH; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, tn = TINT[IREG[i]], k = IREG[i] === reg ? 1.6 : 0.8;
      let R = tn[0] * k, G = tn[1] * k, B = tn[2] * k;
      if (IPATH[i]) (R += 0.12), (G += 0.12), (B += 0.12);
      if (IAX[i]) (R = max(R, 0.24)), (G = max(G, 0.24)), (B = max(B, 0.3));
      const pl = ILINE[i] * 0.55;
      R = max(R, pl);
      G = max(G, pl * 0.9);
      B = max(B, pl * 0.6);
      const p = i * 3;
      buf[p] = R;
      buf[p + 1] = G;
      buf[p + 2] = B;
    }
  const mx = floor(toX(S.tau)), my = floor(toY(S.det));
  for (const [dx, dy, v] of [[0, 0, 2], [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1]]) {
    const x = mx + dx, y = my + dy;
    if (x < 0 || x >= W || y < 0 || y >= IH) continue;
    const p = (y * W + x) * 3;
    if (v === 2) buf[p] = buf[p + 1] = buf[p + 2] = 1;
    else (buf[p] = mk[0]), (buf[p + 1] = mk[1]), (buf[p + 2] = mk[2]);
  }
  // The rule under the strip, in the colour of A's region.
  for (let x = 0; x < W; x++) {
    const p = (IH * W + x) * 3;
    buf[p] = mk[0] * 0.22;
    buf[p + 1] = mk[1] * 0.22;
    buf[p + 2] = mk[2] * 0.22;
  }
  for (let p = 0, q = 0; p < W * H; p++, q += 3)
    display.setPixel(p % W, floor(p / W), round(255 * min(1, buf[q])), round(255 * min(1, buf[q + 1])), round(255 * min(1, buf[q + 2])));
}
