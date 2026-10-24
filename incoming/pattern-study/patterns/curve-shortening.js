// ===== Patternflow pattern =====
// Title:   Curve Shortening
// Family:  line
// Idea:    One tangled closed curve at a time, a thick spiral, a folded worm, a many-armed star or a double coil, moves every point along its normal at the speed of its curvature, so it unwinds without ever touching itself, rounds off into a circle and shrinks to a point, losing area at exactly 2 pi per unit of flow time, while the white marks at its inflection points meet and die in pairs.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: curve-shortening flow, Grayson's theorem (Matthew Grayson, 1987), pattern round 36
// Round:   36
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Wind=2..3.5, Trace=0..1
//
// Knob 1: Hue. The colour of the filled curve, once round the wheel. At 0 the fill is azure, with a pale sky rim where the curve bends outward and a gold rim where it bends inward; at 0.2 violet, at 0.3 pink, at 0.4 red, at 0.5 orange, at 0.6 yellow, at 0.75 green, at 0.9 teal. The two rim colours turn with it.
// Knob 2: Speed. At 2 the first curve is drawn round and filled in 1.9 seconds, later ones in 0.95, and each then flows to its point in 5.6 seconds whatever its size, since the area falls at the same rate the whole way; a white ring opens at the point for 0.6 seconds and the next curve starts. At 0.2 all of it takes ten times as long, at 3 two thirds as long.
// Knob 3: Wind. How tangled each new curve is. At 2 the spiral makes 2 turns of a band 6 LEDs wide with 7-LED gaps, the worm folds into 6 runs, the star has 6 arms and the double coil 2 turns each way; at 2.75 the spiral makes 2.75 turns, the worm 8 runs, the star 8 arms and the coils 3 turns; at 3.5 the spiral makes 3.5 turns of a band under 4 LEDs wide with 4-LED gaps, the worm 9 runs, the star 9 arms. Turning it more than 0.2 starts a fresh curve.
// Knob 4: Trace. At 0 the inside is filled to 0.9 of full brightness. Turning it up dims the fill, to a fifth at 1, and keeps the outline as it was at each tenth of the curve's life, so each kept outline holds a tenth of the first area less than the one before. At 1 they nest behind the curve: far apart at the tips of the arms, where the curvature is high and the flow fast, and crossing where a concave arc has pushed outward past an older outline.
// Buttons: K1 tap runs the rest of the flow in 0.6 seconds (at Speed 2), so the curve races to its round point, and the next curve follows.

const W = 64, H = 128, NMAX = 1500, NMIN = 28, SNAPS = 10, SNAPN = 180;
// Flow time is in LEDs squared: the area falls 2 pi of them per unit. A curve
// lives LIFE beats of the clock; a beat is a second at Speed 2.
const LIFE = 5.6, DRAW0 = 1.9, DRAW = 0.95, FLASH = 0.6, DS = 1.3;
const { floor, min, max, abs, sqrt, sin, cos, atan2, round, random, PI, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- Shapes. Each is a centre line with a band width, or a polygon. ----

function seg(out, x0, y0, x1, y1) {
  const k = max(1, ceil(sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2) / 0.5));
  for (let i = 0; i < k; i++) out.push(x0 + ((x1 - x0) * i) / k, y0 + ((y1 - y0) * i) / k);
}

// A spiral on a stadium: half turns over the top and under the bottom, 2h
// apart, joined by straight runs. Each half turn is a true semicircle, the
// top ones centred on cx with radius r0 + k p, the bottom ones half a pitch
// to the right with radius r0 + (k + 1/2) p, so the arcs meet the runs with
// no corner and the band gains p every turn. It uses the tall panel the way
// a round spiral cannot.
function spiral(T) {
  const p = 57 / (2 * T + 0.2), w = 0.45 * p, r0 = w / 2 + 1.5, h = 30, cx = 32, cy = 64, C = [];
  const halves = 2 * T;
  seg(C, cx + r0, cy + h, cx + r0, cy - h);
  for (let k = 0; k < halves; k++) {
    const top = k % 2 === 0, R = r0 + (k * p) / 2, xc = top ? cx : cx + p / 2, yc = top ? cy - h : cy + h;
    const f1 = min(PI, (halves - k) * PI);
    for (let f = 0; f < f1; f += 0.6 / R) C.push(xc + (top ? 1 : -1) * R * cos(f), yc + (top ? -1 : 1) * R * sin(f));
    const x = xc + (top ? 1 : -1) * R * cos(f1);
    if (f1 < PI) C.push(x, yc + (top ? -1 : 1) * R * sin(f1));
    else seg(C, x, yc, x, top ? cy + h : cy - h);
  }
  return { C, w };
}

// Two round spirals, one over the other, joined through the middle of the
// panel as an S: the outer end of the upper one meets its mirror image there.
function coils(T) {
  const k = T < 2.5 ? 2 : 3, p = 28.5 / (k + 0.55), w = 0.62 * p, r0 = 0.3 * p + 1.5, F = 2 * PI * k + PI / 2;
  const Rm = r0 + (p * F) / (2 * PI), cyA = 64 - Rm, A = [];
  for (let f = 0; f < F; f += 0.03) {
    const r = r0 + (p * f) / (2 * PI);
    A.push(32 + r * cos(f), cyA + r * sin(f));
  }
  const C = A.slice();
  C.push(32, 64);
  for (let i = A.length - 2; i >= 0; i -= 2) C.push(64 - A[i], 128 - A[i + 1]);
  return { C, w };
}

// A worm folded into m runs across the panel, joined by hairpin bends.
function worm(T) {
  const m = 2 + round(2 * T), p = 118 / m, w = 0.6 * p, xl = 3 + p / 2 + w / 2, xr = 61 - p / 2 - w / 2, C = [];
  for (let j = 0; j < m; j++) {
    const y = 5 + p / 2 + j * p, right = j % 2 === 0;
    seg(C, right ? xl : xr, y, right ? xr : xl, y);
    if (j === m - 1) {
      C.push(right ? xr : xl, y);
      break;
    }
    const xc = right ? xr : xl, yc = y + p / 2;
    for (let a = 0; a < PI; a += 0.06) C.push(xc + (right ? 1 : -1) * (p / 2) * sin(a), yc - (p / 2) * cos(a));
  }
  return { C, w };
}

// A star: r(t) = R (0.34 + 0.66 g(k t)), one arm per lobe of g, stretched
// 1.45 times up the panel. Being a graph over the angle, before and after the
// stretch, it cannot cross itself.
function star(T) {
  const k = 2 + round(2 * T), R = 29.5, P = [];
  for (let i = 0; i < 2400; i++) {
    const t = (2 * PI * i) / 2400, g = ((1 + cos(k * t)) / 2) ** 1.7, r = R * (0.34 + 0.66 * g);
    P.push(32 + r * sin(t), 64 - 1.45 * r * cos(t));
  }
  return P;
}

// The outline of a band of width w round a centre line, with round ends.
function band(C, w) {
  const m = C.length >> 1, L = [], Rt = [], hw = w / 2;
  const nrm = (i) => {
    const a = max(0, i - 1), b = min(m - 1, i + 1);
    let tx = C[2 * b] - C[2 * a], ty = C[2 * b + 1] - C[2 * a + 1];
    const l = sqrt(tx * tx + ty * ty) || 1;
    return [tx / l, ty / l];
  };
  for (let i = 0; i < m; i++) {
    const [tx, ty] = nrm(i);
    L.push(C[2 * i] - ty * hw, C[2 * i + 1] + tx * hw);
    Rt.push(C[2 * i] + ty * hw, C[2 * i + 1] - tx * hw);
  }
  const P = L.slice();
  const cap = (i, s) => {
    const [tx, ty] = nrm(i), nx = -ty, ny = tx;
    for (let a = 0.12; a < PI; a += 0.12) {
      const c = cos(a), d = sin(a);
      P.push(C[2 * i] + s * hw * (c * nx + d * tx), C[2 * i + 1] + s * hw * (c * ny + d * ty));
    }
  };
  cap(m - 1, 1);
  for (let i = m - 1; i >= 0; i--) P.push(Rt[2 * i], Rt[2 * i + 1]);
  cap(0, -1);
  return P;
}

function area(X, Y, n) {
  let a = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) a += X[j] * Y[i] - X[i] * Y[j];
  return a / 2;
}

// Put n points round the closed polygon P at equal steps of arc length,
// wound so that the area comes out positive.
function resample(P, np, X, Y, n) {
  const m = np, len = new Float64Array(m + 1);
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    len[i + 1] = len[i] + sqrt((P[2 * j] - P[2 * i]) ** 2 + (P[2 * j + 1] - P[2 * i + 1]) ** 2);
  }
  const L = len[m];
  let s = 0;
  for (let k = 0; k < n; k++) {
    const target = (L * k) / n;
    while (s < m - 1 && len[s + 1] < target) s++;
    const j = (s + 1) % m, u = (target - len[s]) / (len[s + 1] - len[s] || 1);
    X[k] = P[2 * s] + u * (P[2 * j] - P[2 * s]);
    Y[k] = P[2 * s + 1] + u * (P[2 * j + 1] - P[2 * s + 1]);
  }
  if (area(X, Y, n) < 0)
    for (let a = 0, b = n - 1; a < b; a++, b--) {
      let t = X[a];
      X[a] = X[b];
      X[b] = t;
      t = Y[a];
      Y[a] = Y[b];
      Y[b] = t;
    }
  return L;
}

function perimeter(X, Y, n) {
  let L = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) L += sqrt((X[i] - X[j]) ** 2 + (Y[i] - Y[j]) ** 2);
  return L;
}

// A new curve: the spiral first, then any of the four but the one just
// shown, at 70 to 100% size somewhere on the panel, mirrored at random.
function build(S, wind, first) {
  let kind = 0;
  if (!first) {
    kind = floor(random() * 4);
    if (kind === S.kind) kind = (kind + 1 + floor(random() * 3)) % 4;
  }
  S.kind = kind;
  S.wind = wind;
  let P;
  if (kind === 1) P = star(wind);
  else {
    const { C, w } = kind === 0 ? spiral(wind) : kind === 2 ? worm(wind) : coils(wind);
    P = band(C, w);
  }
  const sc = first ? 1 : 0.7 + 0.3 * random(), fx = random() < 0.5 ? -1 : 1, fy = random() < 0.5 ? -1 : 1;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < P.length; i += 2) {
    P[i] = 32 + fx * sc * (P[i] - 32);
    P[i + 1] = 64 + fy * sc * (P[i + 1] - 64);
    x0 = min(x0, P[i]);
    x1 = max(x1, P[i]);
    y0 = min(y0, P[i + 1]);
    y1 = max(y1, P[i + 1]);
  }
  // The first curve stands in the middle; later ones slide anywhere they
  // still fit between 1.5 and 62.5 across, 1.5 and 126.5 down.
  const dx = first ? 32 - (x0 + x1) / 2 : 1.5 - x0 + random() * max(0, 61 - (x1 - x0));
  const dy = first ? 64 - (y0 + y1) / 2 : 1.5 - y0 + random() * max(0, 125 - (y1 - y0));
  for (let i = 0; i < P.length; i += 2) (P[i] += dx), (P[i + 1] += dy);
  const np = P.length >> 1;
  let L = 0;
  for (let i = 0; i < np; i++) {
    const j = (i + 1) % np;
    L += sqrt((P[2 * j] - P[2 * i]) ** 2 + (P[2 * j + 1] - P[2 * i + 1]) ** 2);
  }
  S.n = min(NMAX, max(NMIN, round(L / DS)));
  resample(P, np, S.X, S.Y, S.n);
  S.A0 = area(S.X, S.Y, S.n);
  S.flowT = 0;
  S.phase = 0;
  S.pt = 0;
  S.dur = first ? DRAW0 : DRAW;
  S.ns = 0;
  S.rush = 0;
  curvature(S);
}

// One explicit step of the flow. Vertex i moves along the normal of the
// chord from i-1 to i+1 by 2 phi / |chord| per unit time, phi the turning
// angle at i: that is the curvature, and it makes the area fall by exactly
// phi, so the whole polygon loses sum(phi) = 2 pi per unit time. A small
// slide along the same chord evens out the spacing and leaves the area alone.
// The step is at most 0.3 of the square of the shortest half chord, under the
// 0.5 where the explicit scheme starts to ring. Returns the time it took.
function step(S, todo) {
  const { X, Y, VX, VY, TX, TY } = S, n = S.n;
  let mc = 1e9, ml = 1e9, Ml = 0, L = 0;
  for (let i = 0; i < n; i++) {
    const a = i ? i - 1 : n - 1, b = i + 1 < n ? i + 1 : 0;
    const ex = X[i] - X[a], ey = Y[i] - Y[a], fx = X[b] - X[i], fy = Y[b] - Y[i];
    const phi = atan2(ex * fy - ey * fx, ex * fx + ey * fy);
    const cx = X[b] - X[a], cy = Y[b] - Y[a], c2 = cx * cx + cy * cy || 1e-12;
    const l1 = sqrt(ex * ex + ey * ey), l2 = sqrt(fx * fx + fy * fy), g = (0.3 * (l2 - l1)) / sqrt(c2);
    VX[i] = (-2 * phi * cy) / c2;
    VY[i] = (2 * phi * cx) / c2;
    TX[i] = g * cx;
    TY[i] = g * cy;
    if (c2 < mc) mc = c2;
    if (l2 < ml) ml = l2;
    if (l2 > Ml) Ml = l2;
    L += l2;
  }
  const h = min(todo, 0.075 * mc);
  for (let i = 0; i < n; i++) {
    X[i] += h * VX[i] + TX[i];
    Y[i] += h * VY[i] + TY[i];
  }
  S.ml = ml;
  S.Ml = Ml;
  S.L = L;
  return h;
}

// Fresh points at even spacing. Points laid on the old edges cut the corners
// and lose a little area, so every point then steps out along its normal by
// the area lost over half the sum of the chords, which puts it back to first
// order: a remesh must not move the area clock. When the curve has shrunk
// there are fewer points, the spacing near DS until the curve is down to NMIN
// points; edges squeezed under 0.45 of the spacing at a retracting tip, or
// stretched past 1.8 along an arc pushing outward, force one.
function remesh(S, force) {
  const { X, Y } = S, L = perimeter(X, Y, S.n), want = max(NMIN, min(NMAX, round(L / DS)));
  if (!force && want >= 0.8 * S.n && want <= 1.25 * S.n) return;
  const A = area(X, Y, S.n), P = S.P, np = S.n;
  for (let i = 0; i < np; i++) (P[2 * i] = X[i]), (P[2 * i + 1] = Y[i]);
  S.n = want;
  resample(P, np, X, Y, want);
  const n = want, VX = S.VX, VY = S.VY;
  let half = 0;
  for (let i = 0; i < n; i++) {
    const a = i ? i - 1 : n - 1, b = i + 1 < n ? i + 1 : 0, cx = X[b] - X[a], cy = Y[b] - Y[a], c = sqrt(cx * cx + cy * cy) || 1e-9;
    VX[i] = cy / c;
    VY[i] = -cx / c;
    half += c / 2;
  }
  const off = (A - area(X, Y, n)) / half;
  for (let i = 0; i < n; i++) (X[i] += off * VX[i]), (Y[i] += off * VY[i]);
  S.ml = S.Ml = L / n;
}

// Signed curvature, summed over seven neighbours so that straight runs read
// as zero, and the inflection points: where a run of clearly convex points
// meets a run of clearly concave ones. Runs that never pass 0.06 radians of
// turning do not count, so a nearly straight stretch does not flicker.
function curvature(S) {
  const { X, Y, K, PH } = S, n = S.n;
  for (let i = 0; i < n; i++) {
    const a = i ? i - 1 : n - 1, b = i + 1 < n ? i + 1 : 0;
    const ex = X[i] - X[a], ey = Y[i] - Y[a], fx = X[b] - X[i], fy = Y[b] - Y[i];
    PH[i] = atan2(ex * fy - ey * fx, ex * fx + ey * fy);
  }
  let s = 0;
  for (let j = -3; j <= 3; j++) s += PH[(j + n) % n];
  for (let i = 0; i < n; i++) {
    K[i] = s;
    s += PH[(i + 4) % n] - PH[(i - 3 + n) % n];
  }
  // Runs of one sign, starting where the sign changes.
  const sg = (v) => (v > 0.025 ? 1 : v < -0.025 ? -1 : 0);
  let start = -1;
  for (let i = 0; i < n; i++)
    if (sg(K[i]) && sg(K[i]) !== sg(K[(i - 1 + n) % n])) {
      start = i;
      break;
    }
  S.ni = 0;
  if (start < 0) return;
  const runs = [];
  let i = 0;
  while (i < n) {
    const p = (start + i) % n, v = sg(K[p]);
    if (!v) {
      i++;
      continue;
    }
    let j = i, peak = 0;
    while (j < n && sg(K[(start + j) % n]) === v) (peak = max(peak, abs(K[(start + j) % n]))), j++;
    if (peak > 0.06) {
      const last = runs[runs.length - 1];
      if (last && last.v === v) last.e = j - 1;
      else runs.push({ v, b: i, e: j - 1 });
    }
    i = j;
  }
  if (runs.length > 1 && runs[0].v === runs[runs.length - 1].v) {
    runs[0].b = runs[runs.length - 1].b - n;
    runs.pop();
  }
  if (runs.length < 2) return;
  for (let r = 0; r < runs.length && S.ni < 64; r++) {
    const A = runs[r], B = runs[(r + 1) % runs.length];
    let e = A.e, b = B.b;
    if (b <= e) b += n;
    // The zero crossing between the end of one run and the start of the next.
    let q = e;
    for (let t = e; t < b; t++) if (K[(start + t) % n] * A.v > 0 && K[(start + t + 1) % n] * A.v <= 0) q = t;
    const p0 = (start + q + n) % n, p1 = (p0 + 1) % n, k0 = K[p0], k1 = K[p1];
    const u = k0 !== k1 ? cl(k0 / (k0 - k1), 0, 1) : 0.5;
    S.IX[S.ni] = X[p0] + u * (X[p1] - X[p0]);
    S.IY[S.ni] = Y[p0] + u * (Y[p1] - Y[p0]);
    S.IQ[S.ni++] = p0;
  }
}

function snapshot(S) {
  if (S.ns >= SNAPS) return;
  const k = max(1, ceil(S.n / SNAPN)), o = S.ns * SNAPN * 2;
  let m = 0;
  for (let i = 0; i < S.n && m < SNAPN; i += k, m++) (S.SN[o + 2 * m] = S.X[i]), (S.SN[o + 2 * m + 1] = S.Y[i]);
  S.SM[S.ns++] = m;
}

function setup(params) {
  params.s = {
    X: new Float64Array(NMAX), Y: new Float64Array(NMAX), VX: new Float64Array(NMAX), VY: new Float64Array(NMAX),
    TX: new Float64Array(NMAX), TY: new Float64Array(NMAX), P: new Float64Array(2 * NMAX), ml: 1, Ml: 1, L: 1,
    K: new Float64Array(NMAX), PH: new Float64Array(NMAX), IX: new Float64Array(64), IY: new Float64Array(64), IQ: new Int32Array(64), ni: 0,
    SN: new Float64Array(SNAPS * SNAPN * 2), SM: new Int32Array(SNAPS), ns: 0, rush: 0,
    n: 0, A0: 1, flowT: 0, phase: 0, pt: 0, dur: DRAW0, kind: -1, wind: 1.5, fx: 32, fy: 64, warm: false,
    hue: 0, trace: 0.06, speed: 2,
    R: new Float32Array(W * H), G: new Float32Array(W * H), B: new Float32Array(W * H), cov: new Float32Array(W * H),
    xs: new Float32Array(4 * H * 48), xn: new Int32Array(4 * H), col: new Float32Array(12),
  };
}

function finish(S) {
  let cx = 0, cy = 0;
  for (let i = 0; i < S.n; i++) (cx += S.X[i]), (cy += S.Y[i]);
  S.fx = cx / S.n;
  S.fy = cy / S.n;
  S.phase = 2;
  S.pt = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 2, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.trace = cl(k[3], 0, 1);
  const wind = cl(k[2], 2, 3.5);
  if (!S.warm) {
    build(S, wind, true);
    S.warm = true;
  } else if (abs(wind - S.wind) > 0.2 && S.phase !== 2) build(S, wind, false);
  // K1: the rest of the flow in 0.6 beats, at a rate fixed when pressed.
  if (input.btnPressed && input.btnPressed[0] && S.phase !== 2) {
    if (S.phase === 0) (S.phase = 1), (S.pt = 0), snapshot(S);
    S.rush = area(S.X, S.Y, S.n) / (2 * PI * 0.6);
  }
  const beat = (d * S.speed) / 2;
  S.pt += beat;
  if (S.phase === 0 && S.pt >= S.dur) {
    S.phase = 1;
    S.pt = 0;
    snapshot(S);
  }
  if (S.phase === 1) {
    // The area clock: A0 / 2 pi units of flow time spread over LIFE beats.
    let todo = beat * max(S.A0 / (2 * PI * LIFE), S.rush), guard = 0;
    while (todo > 1e-9 && guard++ < 400) {
      const h = step(S, todo), ds = S.L / S.n;
      todo -= h;
      S.flowT += h;
      if (S.ml < 0.45 * ds || S.Ml > 1.8 * ds) remesh(S, true);
      else if (guard % 10 === 0) remesh(S, false);
      if (guard % 4 === 0 && area(S.X, S.Y, S.n) < 1.5) break;
    }
    remesh(S, false);
    while (S.ns < SNAPS && S.flowT >= (S.ns * S.A0) / (2 * PI * SNAPS)) snapshot(S);
    if (area(S.X, S.Y, S.n) < 1.5) finish(S);
  }
  if (S.phase !== 2) curvature(S);
  else if (S.pt >= FLASH) build(S, wind, false);
}

// Coverage of the inside, anti-aliased: four scanlines per row, each
// crossing interval added to the LEDs it spans in exact fractions.
function fill(S) {
  const { X, Y, xs, xn, cov } = S, n = S.n, SUB = 4, CAP = 48;
  cov.fill(0);
  xn.fill(0);
  for (let i = 0; i < n; i++) {
    const j = i + 1 < n ? i + 1 : 0;
    let x0 = X[i], y0 = Y[i], x1 = X[j], y1 = Y[j];
    if (y0 === y1) continue;
    if (y0 > y1) [x0, y0, x1, y1] = [x1, y1, x0, y0];
    const s0 = max(0, ceil(y0 * SUB - 0.5)), s1 = min(H * SUB - 1, ceil(y1 * SUB - 0.5) - 1);
    for (let s = s0; s <= s1; s++) {
      const ys = (s + 0.5) / SUB, c = xn[s];
      if (c < CAP) {
        xs[s * CAP + c] = x0 + ((ys - y0) * (x1 - x0)) / (y1 - y0);
        xn[s] = c + 1;
      }
    }
  }
  for (let s = 0; s < H * SUB; s++) {
    const c = xn[s], o = s * CAP, row = floor(s / SUB) * W;
    if (c < 2) continue;
    for (let a = 1; a < c; a++) {
      const v = xs[o + a];
      let b = a - 1;
      while (b >= 0 && xs[o + b] > v) (xs[o + b + 1] = xs[o + b]), b--;
      xs[o + b + 1] = v;
    }
    for (let a = 0; a + 1 < c; a += 2) {
      const xa = cl(xs[o + a], 0, W), xb = cl(xs[o + a + 1], 0, W);
      if (xb <= xa) continue;
      const ia = floor(xa), ib = min(W - 1, floor(xb));
      if (ia === ib) cov[row + ia] += (xb - xa) / SUB;
      else {
        cov[row + ia] += (ia + 1 - xa) / SUB;
        for (let x = ia + 1; x < ib; x++) cov[row + x] += 1 / SUB;
        if (ib < W) cov[row + ib] += (xb - ib) / SUB;
      }
    }
  }
}

// A line from (ax, ay) to (bx, by), about 1.6 LEDs wide, kept at the brighter
// of its colour and what is already there.
function line(S, ax, ay, bx, by, cr, cg, cb, wide) {
  const { R, G, B } = S, dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
  const x0 = max(0, floor(min(ax, bx) - 1.5)), x1 = min(W - 1, floor(max(ax, bx) + 1.5));
  const y0 = max(0, floor(min(ay, by) - 1.5)), y1 = min(H - 1, floor(max(ay, by) + 1.5));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay, t = cl((px * dx + py * dy) / l2, 0, 1);
      const qx = px - t * dx, qy = py - t * dy, dd = sqrt(qx * qx + qy * qy);
      const v = cl((wide - dd) / 0.55, 0, 1);
      if (v <= 0) continue;
      const p = y * W + x;
      R[p] = max(R[p], cr * v);
      G[p] = max(G[p], cg * v);
      B[p] = max(B[p], cb * v);
    }
}

function dot(S, x, y, r, cr, cg, cb) {
  const { R, G, B } = S;
  for (let yy = max(0, floor(y - r - 1)); yy <= min(H - 1, floor(y + r + 1)); yy++)
    for (let xx = max(0, floor(x - r - 1)); xx <= min(W - 1, floor(x + r + 1)); xx++) {
      const dd = sqrt((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2), v = cl((r + 0.5 - dd) / 0.7, 0, 1);
      if (v <= 0) continue;
      const p = yy * W + xx;
      R[p] = R[p] * (1 - v) + cr * v;
      G[p] = G[p] * (1 - v) + cg * v;
      B[p] = B[p] * (1 - v) + cb * v;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { R, G, B, cov, col, X, Y, K } = S, n = S.n;
  R.fill(0);
  G.fill(0);
  B.fill(0);
  // Fill, convex rim, concave rim. Orange to lime fills are kept bright so
  // they read as colour and not brown or olive.
  const h = S.hue + 0.58;
  hsv(h, 0.88, 0.9, col, 0);
  hsv(h - 0.03, 0.3, 1, col, 3);
  hsv(h + 0.55, 0.85, 1, col, 6);
  const tr = S.trace, fillLv = 255 * (1 - 0.82 * tr);
  if (S.phase === 2) {
    // The round point: a white ring that opens and fades.
    const u = S.pt / FLASH, r = 1 + 9 * sm(u), a = 255 * (1 - u) * (1 - u);
    for (let i = 0; i < 48; i++) {
      const t0 = (2 * PI * i) / 48, t1 = (2 * PI * (i + 1)) / 48;
      line(S, S.fx + r * cos(t0), S.fy + r * sin(t0), S.fx + r * cos(t1), S.fy + r * sin(t1), a, a, a * 0.95, 0.9);
    }
    if (u < 0.3) dot(S, S.fx, S.fy, 1.2, 255, 255, 255);
  } else {
    const drawing = S.phase === 0, u = drawing ? S.pt / S.dur : 1;
    const shown = drawing ? floor(n * sm(u / 0.72)) : n, fa = drawing ? sm((u - 0.55) / 0.4) : 1;
    // Earlier outlines, the chronophotograph that Trace keeps.
    if (tr > 0.1 && S.phase === 1) {
      const lv = 255 * 0.75 * sm((tr - 0.1) / 0.5);
      for (let s = 0; s < S.ns; s++) {
        const m = S.SM[s], o = s * SNAPN * 2, f = 0.3 + (0.7 * (s + 1)) / S.ns;
        for (let i = 0; i < m; i++) {
          const j = (i + 1) % m;
          line(S, S.SN[o + 2 * i], S.SN[o + 2 * i + 1], S.SN[o + 2 * j], S.SN[o + 2 * j + 1], col[3] * lv * f * 0.75, col[4] * lv * f * 0.75, col[5] * lv * f * 0.75, 0.75);
        }
      }
    }
    if (fa > 0) {
      fill(S);
      for (let p = 0; p < W * H; p++) {
        const c = min(1, cov[p]) * fa * fillLv;
        if (c <= 0) continue;
        R[p] += col[0] * c;
        G[p] += col[1] * c;
        B[p] += col[2] * c;
      }
    }
    // The rim: pale where the curve bends outward, the second colour where
    // it bends inward. The inflection points sit where the two meet.
    for (let i = 0; i < shown; i++) {
      const j = i + 1 < n ? i + 1 : 0, t = cl((K[i] + K[j]) * 6, -1, 1), a = (1 + t) / 2;
      const cr = 255 * (col[3] * a + col[6] * (1 - a)), cg = 255 * (col[4] * a + col[7] * (1 - a)), cb = 255 * (col[5] * a + col[8] * (1 - a));
      line(S, X[i], Y[i], X[j], Y[j], cr, cg, cb, drawing && i > shown - 6 ? 1.2 : 0.9);
    }
    // White marks at the inflection points: a dark ring round a white core.
    for (let q = 0; q < S.ni; q++) {
      if (S.IQ[q] >= shown) continue;
      dot(S, S.IX[q], S.IY[q], 1.6, 0, 0, 0);
      dot(S, S.IX[q], S.IY[q], 0.8, 255, 255, 255);
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      display.setPixel(x, y, round(min(255, R[p])), round(min(255, G[p])), round(min(255, B[p])));
    }
}
