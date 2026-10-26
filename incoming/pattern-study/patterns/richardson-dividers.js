// ===== Patternflow pattern =====
// Title:   Richardson Dividers
// Family:  fractal
// Idea:    A random self-similar curve of dimension D runs corner to corner across the top of the panel while a pair of dividers walks along it at a fixed opening, swinging from point to point and laying down a polygon of equal chords that cuts off the curve's bays, and each finished walk drops the point (log s, log L) onto a log-log plot below, so as the opening shrinks from 23 LEDs to under one in ten steps of 0.7 the points climb a straight line of slope 1 - D.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Richardson's divider method (Lewis Fry Richardson, 1961), fractal dimension of a coastline (Benoit Mandelbrot, 1967), dimension of random recursive constructions (R. Daniel Mauldin and S. C. Williams, 1986), pattern round 60
// Round:   60
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Roughness=-1..1, Cutoff=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the curve is lilac, the dividers' polygon, its bays and the measured points sea green and the dividers white; at 0.25 the curve pink and the polygon blue, at 0.5 lime and pink, at 0.75 teal and yellow. The curve skips the orange part of the wheel, which reads brown when dim.
// Knob 2: Speed. At 2 each opening takes 1.45 s, a walk of 1.1 s and a pause of 0.35 s with the polygon complete, so the ten openings of one curve take 14.5 s before a fresh curve fades in; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Roughness. Sets the dimension D = 1.27 + 0.25 x K3: 1.02 at -1, about the coast of South Africa in Richardson's table, 1.27 at 0, a little above the west coast of Britain, and 1.52 at 1. The curve grows from 109 LEDs long, a gentle wobble, through 501 to 2,185, a crumpled line that is shrunk to fit, and the slope of the line on the plot goes from -0.02 to -0.52; over 60 curves each the fitted slope of the ten points averaged -0.019, -0.137, -0.261, -0.371 and -0.496 at the five stops, a little shallower than 1 - D. The curve keeps its random choices, so turning the knob bends the same curve.
// Knob 4: Cutoff. The curve stops dividing once a piece is no longer than 0.3 x 100^K4 LEDs: 0.40 at the opening 0.06, where the pieces average 0.19 LEDs, far under the smallest opening of 0.93, so the points keep to the line; 3 at 0.5, pieces of 1.3, and 30 at 1, where the curve is a polygon of 10 to 16 pieces averaging 12.5 LEDs. The plot's dotted mark stands at the mean piece, and to the left of it the points go flat: dividers shorter than a piece measure the polygon's own length.
// Buttons: K1 tap draws a fresh curve and starts again from the widest opening.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, acos, atan2, pow, hypot, log10, round, ceil, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
const wheel = (h) => 0.17 + (h - floor(h)) * 0.86;

// A 32-bit hash for the curve's random choices: each piece's choices come
// from its own id, and its four children's ids from it, so a change of D
// or of the cutoff redraws the same tree of choices.
function hash(a) {
  a = Math.imul(a ^ (a >>> 16), 0x7feb352d);
  a = Math.imul(a ^ (a >>> 15), 0x846ca68b);
  return (a ^ (a >>> 16)) >>> 0;
}

// The curve runs from one corner of rows 0 to 85 to the other, (4, 4) to
// (60, 82) or (60, 4) to (4, 82), 96 LEDs. Every piece P -> Q is replaced
// by four: P -> P1 and P3 -> Q along the piece, each r long, and two up to
// an apex off to one side, a coin flip deciding which. r is the Koch-type
// ratio for D, 1 / (2 + 2 cos theta) with 2 + 2 cos theta = 4^(1/D), times
// a random factor in 0.85..1.15; the apex sits at 0.5 + delta along the
// piece, delta random in -0.07..0.07, and at the height h that makes
// 2 r^D + r2^D + r3^D = 1, to 1e-15 after four Newton steps. Every
// generator then has similarity dimension D, so by Mauldin and Williams
// the curve has dimension D, and the random ratios smear the log-periodic
// staircase one fixed ratio puts into L(s).
const TOP = 86;
function makeCurve(seed, D, cut) {
  const c = pow(4, 1 / D) / 2 - 1, rK = 1 / (2 + 2 * c), hK = rK * sin(acos(c));
  const right = seed & 1, sx = right ? 4 : 60, ex = right ? 60 : 4;
  const X = [sx], Y = [4];
  const emit = (ax, ay, bx, by, id, depth) => {
    const dx = bx - ax, dy = by - ay, len = hypot(dx, dy);
    if (len <= cut || depth > 9) {
      X.push(bx);
      Y.push(by);
      return;
    }
    const z = hash(id), f = z & 2 ? 1 : -1;
    const de = 0.07 * ((((z >>> 2) & 1023) / 1023) * 2 - 1);
    const r = min(rK * (1 + 0.15 * ((((z >>> 12) & 1023) / 1023) * 2 - 1)), 0.48 - abs(de));
    const a1 = 0.5 + de - r, a2 = 0.5 - de - r, rd = 2 * pow(r, D);
    let h = hK;
    for (let it = 0; it < 4; it++) {
      const q2 = a1 * a1 + h * h, q3 = a2 * a2 + h * h;
      const g = rd + pow(q2, D / 2) + pow(q3, D / 2) - 1, gp = D * h * (pow(q2, D / 2 - 1) + pow(q3, D / 2 - 1));
      h = max(1e-4, h - g / max(gp, 1e-6));
    }
    const nx = -dy * f, ny = dx * f;
    const p1x = ax + r * dx, p1y = ay + r * dy, p3x = bx - r * dx, p3y = by - r * dy;
    const p2x = ax + (0.5 + de) * dx + h * nx, p2y = ay + (0.5 + de) * dy + h * ny;
    const k = Math.imul(id, 4) + 0x9e37;
    emit(ax, ay, p1x, p1y, hash(k), depth + 1);
    emit(p1x, p1y, p2x, p2y, hash(k + 1), depth + 1);
    emit(p2x, p2y, p3x, p3y, hash(k + 2), depth + 1);
    emit(p3x, p3y, bx, by, hash(k + 3), depth + 1);
  };
  emit(sx, 4, ex, 82, hash(seed), 0);
  // Shrink it about its middle into columns 1 to 62 and rows 1 to 84 if it
  // came out bigger; the plot divides L by the end-to-end length.
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < X.length; i++) (x0 = min(x0, X[i])), (x1 = max(x1, X[i])), (y0 = min(y0, Y[i])), (y1 = max(y1, Y[i]));
  const sc = min(1, 61 / (x1 - x0), 83 / (y1 - y0)), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const n = X.length - 1, PX = new Float32Array(n + 1), PY = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) (PX[i] = 31.5 + (X[i] - mx) * sc), (PY[i] = 42.5 + (Y[i] - my) * sc);
  let len = 0;
  for (let i = 0; i < n; i++) len += hypot(PX[i + 1] - PX[i], PY[i + 1] - PY[i]);
  const C = { seed, D, cut, n, X: PX, Y: PY, l0: hypot(PX[n] - PX[0], PY[n] - PY[0]), piece: len / n, walks: [], rows: null, ras: null };
  for (let k = 0; k < NO; k++) C.walks.push(walk(C, OPEN[k]));
  return C;
}

// The openings, 23 LEDs down to 0.93 in ten steps of 0.7.
const NO = 10, OPEN = [];
for (let k = 0; k < NO; k++) OPEN.push(23 * pow(0.7, k));

// Richardson's walk: from the tip on the curve, the next tip is the first
// point further along the curve at distance s, found on the piece that
// first leaves the circle of radius s; the walk ends when the rest of the
// curve stays inside the circle, and the length is n s plus that last gap.
function walk(C, s) {
  const { X, Y, n } = C, tx = [X[0]], ty = [Y[0]], tj = [0];
  let cx = X[0], cy = Y[0], ax = cx, ay = cy, i = 0;
  const s2 = s * s;
  for (;;) {
    let hit = false;
    for (; i < n; i++) {
      const bx = X[i + 1], by = Y[i + 1];
      if ((bx - cx) * (bx - cx) + (by - cy) * (by - cy) >= s2) {
        const dx = bx - ax, dy = by - ay, fx = ax - cx, fy = ay - cy, A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy);
        const Cq = fx * fx + fy * fy - s2, t = (-B + sqrt(max(0, B * B - 4 * A * Cq))) / (2 * A);
        cx = ax = ax + t * dx;
        cy = ay = ay + t * dy;
        tx.push(cx);
        ty.push(cy);
        tj.push(i);
        hit = true;
        break;
      }
      ax = bx;
      ay = by;
    }
    if (!hit) break;
  }
  const steps = tx.length - 1, gap = hypot(X[n] - cx, Y[n] - cy);
  return { s, tx, ty, tj, steps, gap, L: steps * s + gap };
}

// What a frame needs of a curve beyond its points: the light it leaves on
// each LED, and where it crosses the middle of each row, for the bays.
function prepare(C) {
  const { X, Y, n } = C, ras = new Float32Array(W * TOP), rx = [], ri = [];
  for (let y = 0; y < TOP; y++) rx.push([]), ri.push([]);
  for (let i = 0; i < n; i++) {
    const x0 = X[i], y0 = Y[i], x1 = X[i + 1], y1 = Y[i + 1], len = hypot(x1 - x0, y1 - y0), m = max(1, ceil(len * 3));
    for (let j = 0; j < m; j++) {
      const t = (j + 0.5) / m, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy, w = len / m;
      if (ix >= 0 && ix < W - 1 && iy >= 0 && iy < TOP - 1) {
        const p = iy * W + ix;
        ras[p] += (1 - fx) * (1 - fy) * w;
        ras[p + 1] += fx * (1 - fy) * w;
        ras[p + W] += (1 - fx) * fy * w;
        ras[p + W + 1] += fx * fy * w;
      }
    }
    const ya = min(y0, y1), yb = max(y0, y1);
    for (let y = max(0, ceil(ya - 0.5)); y < TOP && y + 0.5 < yb; y++) {
      rx[y].push(x0 + ((x1 - x0) * (y + 0.5 - y0)) / (y1 - y0));
      ri[y].push(i);
    }
  }
  for (let p = 0; p < ras.length; p++) ras[p] = min(1, ras[p]) ** 0.6;
  C.ras = ras;
  C.rows = rx.map((a) => Float32Array.from(a));
  C.rowi = ri.map((a) => Int32Array.from(a));
}

const T_WALK = 1.1, T_HOLD = 0.35, T_OPEN = T_WALK + T_HOLD, T_FADE = 0.5;
const points = (C) => C.walks.map((w) => [log10(w.s), log10(w.L / C.l0)]);

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, D: 1.27, cut: 0.39, warm: false, k: 0, t: 0, fade: 1, ay: null,
    cur: null, old: null, ghosts: [],
    R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N), c: new Float32Array(18), xs: new Float32Array(4096),
  };
}

const newSeed = () => (Math.random() * 4294967296) >>> 0;

function fresh(S) {
  if (S.cur) {
    // The finished curve's points stay on the plot, dimmer, for two curves.
    S.ghosts.unshift({ D: S.cur.D, cut: S.cur.cut, pts: points(S.cur) });
    S.ghosts.length = min(S.ghosts.length, 2);
    S.old = S.cur;
  }
  S.cur = makeCurve(newSeed(), S.D, S.cut);
  prepare(S.cur);
  S.k = 0;
  S.t = 0;
  S.fade = S.old ? 0 : 1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const D = 1.27 + 0.25 * cl(k[2], -1, 1), cut = 0.3 * pow(100, cl(k[3], 0, 1));
  if (!S.warm) {
    // Open with two curves already measured, so the plot shows the line.
    S.D = D;
    S.cut = cut;
    for (let g = 0; g < 2; g++) S.ghosts.push({ D, cut, pts: points(makeCurve(newSeed(), D, cut)) });
    fresh(S);
    S.warm = true;
  }
  if (abs(D - S.D) > 0.002 || abs(cut - S.cut) / S.cut > 0.01) {
    // The same choices bent to the new D or cut at the new length; points
    // measured on another curve leave the plot.
    S.D = D;
    S.cut = cut;
    S.cur = makeCurve(S.cur.seed, D, cut);
    prepare(S.cur);
    S.ghosts = S.ghosts.filter((g) => abs(g.D - D) < 0.002 && abs(g.cut - cut) / cut < 0.01);
  }
  if (input.btnPressed && input.btnPressed[0]) fresh(S);
  const ds = (d * S.speed) / 2;
  // Where the plot's middle sits: the mean of the ghost points and of all
  // ten points of the curve being walked, known before it is walked.
  let sum = 0, cnt = 0;
  for (const g of S.ghosts) for (const p of g.pts) (sum += p[1]), cnt++;
  for (const p of points(S.cur)) (sum += p[1]), cnt++;
  const want = sum / cnt;
  S.ay = S.ay === null ? want : S.ay + (want - S.ay) * min(1, ds * 6);
  S.fade = min(1, S.fade + ds / T_FADE);
  S.t += ds;
  while (S.t >= T_OPEN) {
    S.t -= T_OPEN;
    if (++S.k >= NO) fresh(S);
  }
}

function add(S, x, y, v, c, o) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = y * W + x;
  S.R[p] += v * c[o];
  S.G[p] += v * c[o + 1];
  S.B[p] += v * c[o + 2];
}
function splat(S, x, y, v, c, o) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  add(S, ix, iy, (1 - fx) * (1 - fy) * v, c, o);
  add(S, ix + 1, iy, fx * (1 - fy) * v, c, o);
  add(S, ix, iy + 1, (1 - fx) * fy * v, c, o);
  add(S, ix + 1, iy + 1, fx * fy * v, c, o);
}
function line(S, x0, y0, x1, y1, v, c, o) {
  const L = hypot(x1 - x0, y1 - y0), n = max(1, ceil(L * 3)), w = (v * L) / n;
  for (let i = 1; i <= n; i++) splat(S, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, w, c, o);
}

// The plot: log10 s across, 37.4 LEDs a decade, from -0.1 at column 3 to
// 1.45 at column 61, and log10 (L / L0) up at 44 rows a decade on rows 87
// to 124. Only the slope means anything on a log-log plot, so the plot
// holds the middle of all its points, which falls at the openings' mean
// log10 s = 0.665, on row 105.5, and the points spread up and down from it.
const KX = 58 / 1.55, KY = 44, PB = 124, PT = 87, PC = 105.5, MLS = log10(23) + 4.5 * log10(0.7);
const plx = (ls) => 3 + (ls + 0.1) * KX;

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.cur) return;
  const { R, G, B, c, cur } = S;
  R.fill(0);
  G.fill(0);
  B.fill(0);
  // 0 the curve, 3 the polygon and points, 6 the bays, 9 white, 12 grey,
  // 15 the dim points of earlier curves.
  hsv(wheel(0.65 + S.hue), 0.62, 0.7, c, 0);
  hsv(0.42 + S.hue, 0.8, 1, c, 3);
  hsv(0.42 + S.hue, 0.8, 0.38, c, 6);
  c[9] = c[10] = c[11] = 1;
  c[12] = c[13] = c[14] = 0.3;
  hsv(0.42 + S.hue, 0.45, 0.6, c, 15);

  const w = cur.walks[S.k], done = S.t >= T_WALK, prog = done ? w.steps : (S.t / T_WALK) * w.steps;
  const m = min(w.steps, floor(prog)), fr = done ? 0 : prog - m;
  // Bays: the curve up to the tip and the polygon back to the start bound
  // them, filled by the even-odd rule along the middle of each row.
  const jt = done ? cur.n : w.tj[m], tipx = w.tx[m], tipy = w.ty[m], xs = S.xs;
  for (let y = 0; y < TOP; y++) {
    const rx = cur.rows[y], ri = cur.rowi[y], yc = y + 0.5;
    let n = 0;
    for (let q = 0; q < rx.length && n < 4000; q++) if (ri[q] < jt) xs[n++] = rx[q];
    const cross = (x0, y0, x1, y1) => {
      if (y0 <= yc !== y1 <= yc && n < 4096) xs[n++] = x0 + ((x1 - x0) * (yc - y0)) / (y1 - y0);
    };
    if (!done) cross(cur.X[jt], cur.Y[jt], tipx, tipy);
    for (let q = 0; q < m; q++) cross(w.tx[q], w.ty[q], w.tx[q + 1], w.ty[q + 1]);
    if (done) cross(tipx, tipy, cur.X[cur.n], cur.Y[cur.n]);
    if (n < 2) continue;
    const a = xs.subarray(0, n).sort();
    for (let q = 0; q + 1 < n; q += 2)
      for (let x = max(0, ceil(a[q] - 0.5)); x <= min(W - 1, floor(a[q + 1] - 0.5)); x++) add(S, x, y, 1, c, 6);
  }
  // The curve, the one it replaces fading out.
  const f = S.fade, ease = f * f * (3 - 2 * f);
  for (let p = 0; p < W * TOP; p++) {
    let v = cur.ras[p] * ease;
    if (S.old && f < 1) v += S.old.ras[p] * (1 - ease);
    if (v > 0) (R[p] += v * c[0]), (G[p] += v * c[1]), (B[p] += v * c[2]);
  }
  // The polygons of the openings already walked on this curve stay, dim,
  // each finer one closer to the curve, down to 7.9 LEDs; finer ones lie on
  // the curve. The one under way is bright, less so the finer it is, so a
  // fine polygon does not bury the curve under it.
  for (let o = 0; o < min(S.k, 4); o++) {
    const v = cur.walks[o];
    for (let q = 0; q < v.steps; q++) line(S, v.tx[q], v.ty[q], v.tx[q + 1], v.ty[q + 1], 0.6, c, 15);
    line(S, v.tx[v.steps], v.ty[v.steps], cur.X[cur.n], cur.Y[cur.n], 0.6, c, 15);
  }
  // The polygon so far, and the gap to the curve's end once it is done.
  const pv = 0.2 + 0.75 * min(1, w.s / 8);
  for (let q = 0; q < m; q++) line(S, w.tx[q], w.ty[q], w.tx[q + 1], w.ty[q + 1], pv, c, 3);
  if (done) line(S, tipx, tipy, cur.X[cur.n], cur.Y[cur.n], pv, c, 3);
  // The dividers: standing on the last two tips, or pivoting on the last
  // tip while the other leg swings over to the next one, the hinge 0.45 s
  // off the chord.
  const px = tipx, py = tipy;
  let qx, qy;
  if (!done && m < w.steps) {
    const a0 = m > 0 ? atan2(w.ty[m - 1] - py, w.tx[m - 1] - px) : atan2(w.ty[1] - py, w.tx[1] - px) - PI;
    let a1 = atan2(w.ty[m + 1] - py, w.tx[m + 1] - px);
    while (a1 < a0) a1 += 2 * PI;
    const a = a0 + (a1 - a0) * fr;
    qx = px + w.s * cos(a);
    qy = py + w.s * sin(a);
  } else if (m > 0) (qx = w.tx[m - 1]), (qy = w.ty[m - 1]);
  else (qx = px + w.s * 0.6), (qy = py + w.s * 0.8);
  const ex = qx - px, ey = qy - py, el = hypot(ex, ey) || 1;
  const hx = (px + qx) / 2 + (ey / el) * 0.45 * w.s, hy = (py + qy) / 2 - (ex / el) * 0.45 * w.s;
  line(S, px, py, hx, hy, 0.9, c, 9);
  line(S, qx, qy, hx, hy, 0.9, c, 9);
  splat(S, px, py, 1.4, c, 9);
  splat(S, qx, qy, 1.4, c, 9);

  // The plot. The line has slope 1 - D through the middle of the points.
  const ay = S.ay, ply = (ll) => PC - (ll - ay) * KY;
  const mine = points(cur).slice(0, S.k + (done ? 1 : 0));
  for (let x = 1; x < W - 1; x += 0.5) {
    const yy = ply(ay + (1 - S.D) * ((x - 3) / KX - 0.1 - MLS));
    if (yy >= PT - 1 && yy <= PB + 1) splat(S, x, yy, 0.5, c, 12);
  }
  // The openings: a faint column each, evenly spaced in log s, and a tick
  // under each along the bottom, the one being walked white.
  for (let q = 0; q < NO; q++) {
    const x = round(plx(log10(OPEN[q])) - 0.5);
    for (let y = PT + (q & 1); y <= PB; y += 2) add(S, x, y, 0.55, c, 12);
    add(S, x, 126, q === S.k ? 1 : 0.8, c, q === S.k ? 9 : 12);
    add(S, x, 127, q === S.k ? 1 : 0.8, c, q === S.k ? 9 : 12);
  }
  // The curve's mean piece, where the line has to stop.
  const lf = plx(log10(cur.piece));
  if (lf > 1 && lf < W - 1) for (let y = PT; y <= PB; y += 3) splat(S, lf, y, 1, c, 12);
  for (let g = S.ghosts.length - 1; g >= 0; g--)
    for (const p of S.ghosts[g].pts) {
      const x = plx(p[0]), y = ply(p[1]);
      if (y > PT - 3 && y < PB + 2) for (let q = 0; q < 4; q++) add(S, round(x - 0.5) + (q & 1), round(y - 0.5) + (q >> 1), g ? 0.5 : 0.75, c, 15);
    }
  for (const p of mine) {
    const x = round(plx(p[0]) - 0.5), y = round(ply(p[1]) - 0.5);
    if (y > PT - 3 && y < PB + 2) for (let q = 0; q < 4; q++) add(S, x + (q & 1), y + (q >> 1), 1, c, 3);
  }
  // The walk under way: its length so far rising as a bar at its opening.
  const xo = plx(log10(w.s)), sofar = log10(max(1e-6, (m + fr) * w.s + (done ? w.gap : 0)) / cur.l0);
  for (let y = PB; y >= max(PT - 3, ply(sofar)); y -= 1) splat(S, xo, y, 0.4, c, 9);

  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++)
      display.setPixel(x, y, round(min(1, R[p]) * 255), round(min(1, G[p]) * 255), round(min(1, B[p]) * 255));
}
