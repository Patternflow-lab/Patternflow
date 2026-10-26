// ===== Patternflow pattern =====
// Title:   KP Web
// Family:  wave
// Idea:    Exact line-soliton solutions of the Kadomtsev-Petviashvili equation glow as ridges on a dark field, coloured by their height, while time runs through each one: a Y junction whose stem grows up the panel, two kinds of X crossing, and webs from the totally nonnegative Grassmannian whose holes shrink to a single crossing and open again in another shape.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kadomtsev-Petviashvili equation (Boris Kadomtsev and Vladimir Petviashvili, 1970), resonant Y junction (John Miles, 1977), KP web solutions (Yuji Kodama, 2004), their classification by the totally nonnegative Grassmannian (Yuji Kodama and Lauren Williams, 2011), pattern round 58
// Round:   58
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Type=0..6, Angle=0..1
//
// Knob 1: Hue. Turns both ends of the height ramp round the wheel. At 0 the tallest ridges are aqua, the lowest violet and those between lavender blue, and where u rises above the tallest line, as where the two O solitons cross, the light goes white; at 0.5 the tall ones are pink and the low ones green. The wheel skips dim orange, which reads brown.
// Knob 2: Speed. At 2 one sweep of time through a solution lasts 9 seconds, half a second of it fading out and in; at 0.2 it lasts 90, at 3 six. A web is smallest at the middle of its sweep, and its farthest junction is 100 LEDs out at either end; a lone Y or X runs 112 LEDs, bottom to top or top to bottom.
// Knob 3: Type. Below 1 the panel tours the six types, one per sweep: the T web, Gr(2,5), Gr(3,6), Y, O, P. From 1 up it holds one, each sweep on a fresh random point of its cell: 1 the Y junction of Gr(1,3), 2 the O type and 3 the P type of Gr(2,4), each an X, 4 the T web of Gr(2,4), whose box has a tall stem on one side, 5 the Gr(2,5) web and 6 the Gr(3,6) web, with 10 and 20 exponentials in tau and several holes.
// Knob 4: Angle. Scales every k_j by 0.55 at 0 up to 1.25 at 1, the window rescaled so a ridge keeps its width in LEDs, and the slope of the line [i, j] is k_i + k_j: the T web's far lines lean 24 degrees off upright at 0, 25 at the opening 0.06 and 45 at 1. The same solution is rebuilt as it turns.

const W = 64, H = 128;
const { floor, min, max, exp, log, sqrt, abs, round, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// KP-II, (-4u_t + 6uu_x + u_xxx)_x + 3u_yy = 0, has the exact solutions
// u = 2 (ln tau)_xx with tau = sum over k-subsets I of Delta_I(A) E_I, where
// E_I = prod_{i<j in I}(k_j - k_i) * exp(sum_{j in I} theta_j) and
// theta_j = k_j x + k_j^2 y + k_j^3 t. A is a k x N matrix whose maximal
// minors Delta_I are all >= 0; which of them vanish picks the cell of the
// totally nonnegative Grassmannian, and the cell picks the web.
// With softmax weights w_I = Delta_I E_I / tau, (ln tau)_x is the mean of
// kappa_I = sum k_j and (ln tau)_xx its variance, so u = 2 Var_w(kappa)
// and no exponential is ever taken of more than 0: no overflow in tau.

function subsets(n, k) {
  const out = [];
  const rec = (s, cur) => {
    if (cur.length === k) return void out.push(cur.slice());
    for (let i = s; i < n; i++) cur.push(i), rec(i + 1, cur), cur.pop();
  };
  rec(0, []);
  return out;
}

function det(M) {
  const n = M.length, a = M.map((r) => r.slice());
  let d = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (abs(a[r][c]) > abs(a[p][c])) p = r;
    if (abs(a[p][c]) < 1e-300) return 0;
    if (p !== c) [a[p], a[c]] = [a[c], a[p]], (d = -d);
    d *= a[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = a[r][c] / a[c][c];
      for (let j = c; j < n; j++) a[r][j] -= f * a[c][j];
    }
  }
  return d;
}

// A strictly totally positive k x N matrix: the kernel exp(alpha_i beta_j)
// with both sequences increasing, its columns scaled by random weights.
// Every maximal minor is positive, so this is the top cell.
function topCell(r, N) {
  const beta = [];
  let b = 0;
  for (let j = 0; j < N; j++) beta.push((b += 0.6 + 0.5 * random()));
  const d = beta.map(() => exp(2 * (random() - 0.5)));
  return Array.from({ length: r }, (_, i) => beta.map((bj, j) => d[j] * exp(i * 0.9 * bj)));
}
const rnd = () => exp(2.4 * (random() - 0.5));

// The six types. k is the base set of k_j; follow 'x' keeps the window at
// one height so the junction travels up or down, 'xy' follows the web.
const TYPES = [
  // Gr(1,3): one soliton [1,3] below, two above, meeting in Miles' resonant
  // Y. k_1 + k_3 = 0 stands the stem upright; the sum of the k climbs the
  // junction up the panel, so the stem grows.
  { k: [-1, 0.3, 1], cell: () => [[1, rnd(), rnd()]], follow: "x", s0: 1.0 },
  // Gr(2,4) O type, Delta_12 = Delta_34 = 0: the solitons [1,2] and [3,4]
  // cross in an X, and where they cross u rises above the sum of their
  // heights (0.26 against 0.24 at the opening Angle).
  { k: [-1.3, -0.45, 0.25, 1.05], cell: () => [[1, rnd(), 0, 0], [0, 0, 1, rnd()]], follow: "x", s0: 1.0 },
  // P type, Delta_14 = Delta_23 = 0: [1,4] and [2,3] cross, and the tall
  // one's crest dips where they do (from 1.10 to 0.92).
  { k: [-1.3, 0.1, 0.9, 1.2], cell: () => [[1, 0, 0, -rnd()], [0, 1, rnd(), 0]], follow: "x", s0: 1.0 },
  // T type, every minor positive: [1,3] and [2,4] far away, four resonant
  // Y junctions round a box in the middle.
  { k: [-1.2, -0.4, 0.4, 1.2], cell: () => topCell(2, 4), follow: "xy", s0: 0.85 },
  { k: [-1.2, -0.6, 0, 0.6, 1.2], cell: () => topCell(2, 5), follow: "xy", s0: 0.76 },
  { k: [-1.25, -0.75, -0.25, 0.25, 0.75, 1.25], cell: () => topCell(3, 6), follow: "xy", s0: 0.68 },
];
const TOUR = [3, 4, 5, 0, 1, 2];

// At the ends of a sweep the farthest junction sits this many LEDs from the
// window's middle: a lone junction or crossing runs the panel's height, a
// web grows past the panel's edges so its holes fill it.
const REACH = { x: 56, xy: 100 };

function build(type, a, A) {
  const T = TYPES[type], k = T.k.map((v) => v * a), N = k.length, r = A.length;
  const terms = [];
  for (const I of subsets(N, r)) {
    const D = det(A.map((row) => I.map((j) => row[j])));
    if (D <= 1e-9) continue;
    let V = 1, p = 0, q = 0, c3 = 0;
    for (let x = 0; x < I.length; x++) for (let y = x + 1; y < I.length; y++) V *= k[I[y]] - k[I[x]];
    for (const j of I) (p += k[j]), (q += k[j] * k[j]), (c3 += k[j] ** 3);
    terms.push({ I, c: log(D * V), p, q, c3 });
  }
  // The tallest line soliton that can appear: two terms whose index sets
  // differ in one place balance along the line [i, j], height (k_i - k_j)^2 / 2.
  let umax = 0;
  for (const A of terms) for (const B of terms) if (A.I.filter((j) => !B.I.includes(j)).length === 1) umax = max(umax, (A.p - B.p) ** 2 / 2);
  // s0 is LEDs per unit of x and y for the base set; scaled with the spread
  // so a ridge of a given k_i - k_j keeps its width in LEDs.
  return { terms, umax, follow: T.follow, S: T.s0 * a, A };
}

// Triple points: where three exponentials tie and none is bigger. These
// are the junctions of the web.
function vertices(terms, t) {
  const out = [], n = terms.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++) {
        const A = terms[a], B = terms[b], C = terms[c];
        const a11 = A.p - B.p, a12 = A.q - B.q, r1 = B.c - A.c + (B.c3 - A.c3) * t;
        const a21 = B.p - C.p, a22 = B.q - C.q, r2 = C.c - B.c + (C.c3 - B.c3) * t;
        const d = a11 * a22 - a12 * a21;
        if (abs(d) < 1e-9) continue;
        const x = (r1 * a22 - a12 * r2) / d, y = (a11 * r2 - a21 * r1) / d;
        const f = A.c + A.p * x + A.q * y + A.c3 * t;
        let top = true;
        for (const M of terms) if (M.c + M.p * x + M.q * y + M.c3 * t > f + 1e-7) { top = false; break; }
        if (top) out.push([x, y]);
      }
  return out;
}
const centroid = (v) => {
  let x = 0, y = 0;
  for (const p of v) (x += p[0]), (y += p[1]);
  return [x / max(1, v.length), y / max(1, v.length)];
};

// One sweep: a fresh point of the cell (or the same one, when only Angle
// turned), the moment its web is smallest, and a window moving at constant
// speed with the junctions' middle.
function newSweep(S, keep) {
  const type = keep ? S.type : S.typeKnob < 1 ? TOUR[S.tour++ % 6] : min(5, floor(S.typeKnob) - 1);
  const B = build(type, S.a, keep ? S.B.A : TYPES[type].cell());
  let tm = 0, best = 1e9;
  if (B.follow === "xy")
    for (let t = -24; t <= 24; t += 1) {
      const v = vertices(B.terms, t);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const p of v) (x0 = min(x0, p[0])), (x1 = max(x1, p[0])), (y0 = min(y0, p[1])), (y1 = max(y1, p[1]));
      if (x1 - x0 + y1 - y0 < best) (best = x1 - x0 + y1 - y0), (tm = t);
    }
  const c0 = centroid(vertices(B.terms, tm)), c1 = centroid(vertices(B.terms, tm + 1));
  const vx = c1[0] - c0[0], vy = B.follow === "xy" ? c1[1] - c0[1] : 0;
  // How far each junction strays from the window per unit of t, in LEDs.
  const v2 = vertices(B.terms, tm + 10);
  let spread = 1e-6;
  for (const p of v2) {
    const dx = (p[0] - c0[0] - 10 * vx) * B.S, dy = (p[1] - c0[1] - 10 * vy) * B.S;
    spread = max(spread, sqrt(dx * dx + dy * dy) / 10);
  }
  Object.assign(S, { B, type, tm, T: REACH[B.follow] / spread, cx: c0[0], cy: c0[1], vx, vy });
}

// Dim orange reads brown on the panel, so the wheel skips 0.03 to 0.16.
function hsv(h) {
  h = 0.16 + 0.87 * (h - 0.16 - floor(h - 0.16));
  const q = (h - floor(h)) * 6, i = floor(q), f = q - i;
  return [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][i % 6];
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, typeKnob: 0, a: 0.6, tour: 0, B: null, phase: 0,
    ph: new Float64Array(0), dp: new Float64Array(0), rgb: [0, 0, 0],
    edge: new Float64Array(W + 1), evar: new Float64Array(W + 1), epair: new Float64Array(W + 1),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const a = 0.55 + 0.7 * cl(k[3], 0, 1), tk = cl(k[2], 0, 6);
  const typeNow = (x) => (x < 1 ? -1 : min(5, floor(x) - 1));
  if (!S.B || typeNow(tk) !== typeNow(S.typeKnob)) {
    S.typeKnob = tk;
    S.a = a;
    newSweep(S, false);
    // A new type opens just after its sweep has faded in.
    S.phase = 0.06;
  } else if (abs(a - S.a) > 0.01) {
    // Angle rebuilds the same solution with the new k and keeps its time.
    S.a = a;
    newSweep(S, true);
  }
  S.phase += (d * S.speed) / 18;
  if (S.phase >= 1) newSweep(S, false), (S.phase -= 1);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.B) return;
  const { terms, umax, S: sc } = S.B, n = terms.length;
  const t = S.tm + (2 * S.phase - 1) * S.T;
  const cx = S.cx + S.vx * (t - S.tm), cy = S.cy + S.vy * (t - S.tm);
  // Fade in and out at the ends of the sweep.
  const fade = min(1, S.phase / 0.06, (1 - S.phase) / 0.06);
  const ph = S.ph.length === n ? S.ph : (S.ph = new Float64Array(n)), dp = S.dp.length === n ? S.dp : (S.dp = new Float64Array(n));
  for (let i = 0; i < n; i++) dp[i] = terms[i].p / sc;
  const cHi = hsv(S.hue + 0.49), cLo = hsv(S.hue + 0.86);
  const M = S.edge, V = S.evar, P = S.epair;
  for (let Y = 0; Y < H; Y++) {
    // The softmax is taken at the 65 edges between the LEDs of a row. The
    // mean of kappa there is (ln tau)_x, so u averaged over an LED's width
    // is exactly 2 (mean_right - mean_left) / width: a box filter in x for
    // the price of one more point a row.
    const y = cy + (Y - 63.5) / sc, x0 = cx - 32 / sc;
    for (let i = 0; i < n; i++) {
      const T = terms[i];
      ph[i] = T.c + T.p * x0 + T.q * y + T.c3 * t;
    }
    for (let X = 0; X <= W; X++) {
      let m = -1e300;
      for (let i = 0; i < n; i++) if (ph[i] > m) m = ph[i];
      let s = 0, s1 = 0, s2 = 0, sw = 0;
      for (let i = 0; i < n; i++) {
        const e = ph[i] - m;
        if (e > -24) {
          const w = exp(e), p = terms[i].p;
          s += w;
          s1 += w * p;
          s2 += w * p * p;
          sw += w * w;
        }
        ph[i] += dp[i];
      }
      const mu = s1 / s;
      M[X] = mu;
      V[X] = s2 / s - mu * mu;
      // u = sum over pairs of w_I w_J (kappa_I - kappa_J)^2, and on a line
      // where two terms balance 1 - sum w^2 = 2 w (1 - w), so Var / that is
      // the local soliton's height, smooth through the junctions.
      P[X] = 1 - sw / (s * s);
    }
    for (let X = 0; X < W; X++) {
      const u = 2 * (M[X + 1] - M[X]) * sc, pr = P[X] + P[X + 1];
      const amp = pr > 1e-6 ? (V[X] + V[X + 1]) / pr : 0;
      const ar = cl(amp / umax, 0.02, 1), r = u / umax;
      // Brightness: the ridge's profile u / height, a little sharpened, times
      // the 0.3 power of its height, so a low ridge still shows. Colour: the
      // local soliton's height, cLo for the lowest, cHi for the tallest.
      // Where u rises above the tallest line, as where two O solitons cross,
      // the light goes white.
      const prof = cl(u / (umax * ar), 0, 1.5), g = sqrt(ar), wh = cl((r - 1) / 1.5, 0, 0.7);
      const v = min(1, prof ** 0.7 * ar ** 0.3) * fade;
      const rgb = S.rgb;
      for (let c = 0; c < 3; c++) rgb[c] = v * ((cHi[c] * g + cLo[c] * (1 - g)) * (1 - wh) + wh);
      display.setPixel(X, Y, round(rgb[0] * 255), round(rgb[1] * 255), round(rgb[2] * 255));
    }
  }
}
