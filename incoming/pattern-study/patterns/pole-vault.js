// ===== Patternflow pattern =====
// Title:   Pole Vault
// Family:  sport
// Idea:    A pole vault under night floodlights, seen from the side: the camera runs with the vaulter, the pole bends deep in the box, the vaulter swings up head-down, turns over a bar near the top of the panel and drops onto the blue mat as the judge raises a white or a red flag.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 26, after the pole vault in athletics
// Round:   26
// ===============================
// @matrix 64x128
// @knobs Colour=0..1, Speed=0.2..3, Bar=5..6.2, Wind=-1..1
//
// Knob 1: Colour. The kit, gold with blue shorts at 0 and once round the wheel; the stand lights, seats and boards take the opposite colour.
// Knob 2: Speed. Real time at 2, where the vault from plant to landing takes 2.4 s; ten times slower at 0.2.
// Knob 3: Bar. The opening height, 5.00 to 6.20 m at 14 rows a metre; a higher bar takes a longer pole and a longer run-up. It goes up 10 cm after each clearance and back here after three misses.
// Knob 4: Wind. Headwind to tailwind: the roof flags stream one way or the other, and a tailwind speeds up the run.
// Buttons: K1 tap sends the next vaulter down the runway now.

const W = 64, H = 128, N = W * H;
// The runway (GY), the pole's tip in the box, 14 rows a metre. A point z LEDs
// nearer the camera lands OBX right and OBY down. The standards stand XS past
// the box, ZS either side; the mat starts at MAT0, MZ either side, MH tall.
const GY = 104, BOXY = GY + 2, PXM = 14, OBX = 0.55, OBY = 0.22, XS = 5, ZS = 13, MAT0 = 3, MZ = 11, MH = 9;
// The camera's left edge on the bar, gravity at Speed 2, the body.
const CAMF = -26, G = 170, TORSO = 4.2, ARM = 5, LEG = 3.3, TACC = 0.7, TA = 1.25, PSI1 = 1.64;
const [SET, RUN, POLE, FLY, MAT] = [0, 1, 2, 3, 4];
// The stands texture: CW columns that wrap, rows ST to 83.
const CW = 256, ST = 17, CH = 84 - ST;

const { min, max, floor, ceil, round, sin, cos, abs, sqrt, exp, atan2, asin, acos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const lerp = (a, b, u) => a + (b - a) * u;
const rnd = () => Math.random();
// A camera flash somewhere in the stands.
const flash = (t0) => ({ x: floor(rnd() * W), y: ST + 2 + floor(rnd() * 64), t0 });
const F = (n) => new Float32Array(n);
const hash = (a, b) => ((Math.imul(a * 7919 + b * 104729, 2654435761) >>> 8) & 1023) / 1024;
const hsv = (h, s, v) => [5, 3, 1].map((n) => v - v * s * max(0, min((n + h * 6) % 6, 4 - ((n + h * 6) % 6), 1)));
const md = (a, m) => ((a % m) + m) % m;
const sc3 = (c, k, o = 0) => [c[0] * k + o, c[1] * k + o, c[2] * k + o];
let C = null;
const put = (x, y, c) => x >= 0 && x < W && y >= 0 && y < H && C.set(c, (y * W + x) * 3);

// Poses: [time, body angle, arm, near hip, near knee, far hip, far knee]. On
// the pole the body rocks back to head-down (-PI); after the half turn it
// goes on the other way, face down over the bar and onto the back.
const TAKE = [1.5, 1.6, -0.5, 0.3];
const VAULT = [[0, 0.08, 0.15, 1.5, 1.6, -0.5, 0.3], [0.2, -0.3, 0.25, 1.1, 1.3, 0.6, 0.2], [0.42, -1.25, 0.4, 2.1, 1.8, 2, 1.5], [0.62, -2.4, 0.9, 0.9, 0.5, 0.8, 0.4], [0.82, -3.05, 2.5, 0.2, 0.05, 0.15, 0.05], [1, -3.14, 0.35, 0.1, 0, 0.1, 0]];
const FLYK = [[0, PI, 0.35, 0.1, 0, 0.1, 0], [1, 1.39 * PI, 0.4, 0.7, 0.4, 0.6, 0.5], [1.4, 1.95 * PI, 0.5, 0.6, 0.3, 0.5, 0.4], [2, 2.45 * PI, 1.5, 1.2, 0.6, 1, 0.8]];
const MATK = [[0, 2.45 * PI, 1.5, 1.2, 0.6, 1, 0.8], [0.4, 2.5 * PI, 1.7, 0.8, 0.9, 0.7, 1], [0.95, 2 * PI + 0.15, 2.7, 1.5, 1.8, 1.4, 1.7]];
function key(T, u, out) {
  let j = 0;
  while (j < T.length - 2 && u > T[j + 1][0]) j++;
  const a = T[j], b = T[j + 1], f = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
  for (let i = 1; i < 7; i++) out[i - 1] = a[i] + (b[i] - a[i]) * f;
  return out;
}
// How far below the hip the lower foot is, for a body leaning th.
const drop = (th, L) => LEG * max(cos(th - L[0]) + cos(th - L[0] + L[1]), cos(th - L[2]) + cos(th - L[2] + L[3]));

// Built once: the stands, two LEDs a seat in rows three deep, aisles, empty
// seats in the team colour, the upper tier in the roof's shadow; the glare.
function build(S) {
  const cr = F(CW * CH * 3), seat = F(CW * CH), glare = F(30 * 128);
  for (let y = 0; y < CH; y++) {
    const lo = y + ST >= 52, ty = y + ST - (lo ? 52 : ST), band = ty % 3, tier = floor(ty / 3) + lo * 40;
    const li = lo ? 0.62 + (0.38 * ty) / 31 : 0.3 + (0.42 * ty) / 29;
    for (let x = 0, sn = 0; x < CW; x++, sn = x >> 1) {
      let c = x % 48 < 2 ? [58, 58, 64] : [20, 20, 25];
      if (x % 48 > 1 && band < 2)
        if (hash(sn, tier) > 0.8) (seat[y * CW + x] = (0.24 + 0.08 * band) * li), (c = [3, 3, 4]);
        else c = band ? sc3(hsv(hash(sn * 3, tier), 0.55, 0.2 + 0.14 * hash(tier, sn)), 255) : x & 1 ? [14, 11, 10] : hash(sn, tier + 99) < 0.5 ? [112, 78, 58] : [60, 42, 32];
      cr.set(sc3(c, li), (y * CW + x) * 3);
    }
  }
  for (let i = 0; i < 30 * 128; i++) {
    const dx = (i % 128) - 64, dy = floor(i / 128) - 3.5, d2 = dx * dx + dy * dy;
    glare[i] = 70 * exp(-d2 / 16) + 30 * exp(-d2 / 110) + 30 * exp(-dy * dy / 1.5 - abs(dx) / 12);
  }
  Object.assign(S, { cr, seat, glare });
}

export function setup(params) {
  const S = { t: 0, ph: SET, pt: 0, tset: 1.95, n: 0, notch: 0, miss: 0, base: 5, by: 34, cam: CAMF, wind: 0, hk: 0.13, marks: [], hudF: 0, verdict: 0, done: 0 };
  Object.assign(S, { clear: true, fig: null, free: null, flashes: [], C: F(N * 3), q: F(6) });
  S.bar = { st: 0, t: 0, y: [0, 0], v: [0, 0] };
  build(S);
  params.s = S;
  newVaulter(S);
}

// Each vaulter wears a different kit; the stand lights take the opposite colour.
const newVaulter = (S) => (S.vo = [0, 0.36, 0.62][S.n++ % 3]);
function colours(S) {
  const hue = (S.hk + S.vo) % 1, cols = [sc3(hsv(hue, 0.82, 1), 245), sc3(hsv((hue + 0.5) % 1, 0.75, 0.8), 210), [232, 168, 128], [150, 100, 70]];
  S.cols = cols.concat(cols.map((c) => sc3(c, 0.62)));
  S.acc = hsv((S.hk + 0.5) % 1, 0.75, 1);
  S.tint = sc3(S.acc, 0.5, 0.5);
}

// The cut to the runway: the takeoff spot is where a straight pole reaches
// the box from hands held straight up.
function startRun(S) {
  if (S.ph === MAT) newVaulter(S);
  const h = S.base + 0.1 * S.notch, Lg = 92.5 - GY + PXM * h, th = 0.08, hy = GY - drop(th, TAKE) - 0.8;
  const px = TORSO * sin(th) + ARM * sin(th + 0.15), py = hy - TORSO * cos(th) - ARM * cos(th + 0.15);
  const dx = sqrt(Lg * Lg - (BOXY - py) ** 2), D = 88 + 16 * (h - 5);
  S.R = { Lg, D, dist: 0, Xto: -dx - px, hy, bto: -asin((BOXY - py) / Lg), psi0: atan2(BOXY - py, dx) };
  Object.assign(S, { ph: RUN, pt: 0, clear: rnd() < 0.72 - 0.08 * S.notch, wob: rnd() < 0.5, free: null, verdict: 0, done: 0, cam: S.R.Xto - D - 16 });
  S.bar = { st: 0, t: 0, y: [0, 0], v: [0, 0] };
  runPose(S);
}

function runPose(S) {
  const R = S.R, rem = R.D - R.dist, X = R.Xto - rem, ph = (R.dist / 15) * PI + 0.6, e2 = sm(1 - rem / 15), L = [];
  for (let i = 0; i < 2; i++) L.push(0.2 + 0.7 * sin(ph + i * PI), 0.25 + 1.3 * max(0, cos(ph + i * PI + 0.9)));
  for (let i = 0; i < 4; i++) L[i] = lerp(L[i], TAKE[i], e2);
  const th = lerp(0.16, 0.08, e2), hy = lerp(GY - drop(th, L) - 0.3, R.hy, e2), e = sm(1 - rem / 19);
  // The pole tip drops over the last strides; then the top hand goes up as
  // the tip slides into the box.
  const p1x = lerp(X - 1, X + TORSO * sin(th) + ARM * sin(th + 0.15), e), p1y = lerp(hy - 0.5, hy - TORSO * cos(th) - ARM * cos(th + 0.15), e);
  const beta = lerp(lerp(1.25 + 0.04 * sin(ph * 2), 0.12, sm((70 - rem) / 51)), R.bto, e), dx = cos(beta), dy = -sin(beta);
  S.fig = { x: X, y: hy, th, fc: 1, L, hands: [p1x, p1y, p1x + 4.5 * dx, p1y + 4.5 * dy] };
  S.pole = { x: p1x - 2.5 * dx, y: p1y - 2.5 * dy, x1: p1x + R.Lg * dx, y1: p1y + R.Lg * dy };
}

// The bent pole as an arc of length L from the box to the top hand.
const ARC = F(5);
function arc(px, py, c, L) {
  const r = cl(c / L, 0.3, 1);
  let x = sqrt(6 * (1 - r)) + 1e-4;
  for (let i = 0; i < 5; i++) x = cl(x - (sin(x) - r * x) / (cos(x) - r), 1e-4, 1.56);
  const R = L / (2 * x), d = R * cos(x), cx = px / 2 + ((py - BOXY) / c) * d, cy = (py + BOXY) / 2 - (px / c) * d, a0 = atan2(BOXY - cy, -cx);
  ARC.set([cx, cy, R, a0, md(atan2(py - cy, px - cx) - a0 + PI, 2 * PI) - PI]);
  return ARC;
}

function polePose(S) {
  const R = S.R, u = min(1, S.pt / TA), L = R.Lg;
  const c = L * (1 - 0.25 * sin(PI * min(1, u / 0.78)) ** 1.4), psi = R.psi0 + (PSI1 - R.psi0) * (1 - (1 - u) ** 1.6);
  const p1x = -c * cos(psi), p1y = BOXY - c * sin(psi), q = key(VAULT, u, S.q), th = q[0], a = q[1];
  const fc = cos(PI * sm((u - 0.66) / 0.24)), ux = sin(th), uy = -cos(th);
  // Hang the body from the top hand; the bottom hand is 4.5 LEDs down the arc.
  const ax = ux * cos(a) + cos(th) * fc * sin(a), ay = uy * cos(a) + sin(th) * fc * sin(a);
  const A = arc(p1x, p1y, c, L), b = A[3] + (A[4] * (L - 4.5)) / L;
  S.fig = { x: p1x - ARM * ax - TORSO * ux, y: p1y - ARM * ay - TORSO * uy, th, fc, L: q.slice(2), hands: [p1x, p1y, A[0] + A[2] * cos(b), A[1] + A[2] * sin(b)] };
  S.pole = { c, L, px: p1x, py: p1y };
}

function matPose(S, tau) {
  const q = key(MATK, tau, S.q), c = S.clear, e = sm((tau - (c ? 1.1 : 1.6)) / 0.3), w = max(0, tau - 1.9) * 20, s = sin(w * 0.4);
  let L = q.slice(2).map((v) => v * (1 - e)), arms = [lerp(q[1], c ? 0.25 : 2.9, e), lerp(q[1] + 0.3, c ? 0.45 : 3.1, e)];
  // Up with arms high and a hop if the bar stayed; then off to the right.
  const Y = lerp(GY - MH - 1 + 0.6 * sm((tau - 0.4) / 0.5), GY - MH - 6.6 - 1.5 * c * abs(sin((tau - 1.1) * 9)) * (tau < 1.9), e);
  if (w) [L, arms] = [[0.5 * s, 0.4, -0.5 * s, 0.4], [PI - 0.4 * s, PI + 0.4 * s]];
  S.fig = { x: S.lx + 2 * sm(tau / 0.5) + w, y: w ? GY - MH - 6.6 : Y, th: w ? 0.05 : lerp(q[0], 2 * PI, e), fc: w ? 1 : -1, L, arms };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 5, 0.06];
  const st = (cl(dt || 0, 0, 0.1) * cl(k[1], 0.2, 3)) / 2, first = S.t === 0;
  S.hk = (0.13 + cl(k[0], 0, 1)) % 1;
  S.base = round(cl(k[2], 5, 6.2) * 20) / 20;
  S.wind = cl(k[3], -1, 1);
  S.t += st;
  if (input.btnPressed && input.btnPressed[0] && (S.ph === SET || S.ph === MAT)) startRun(S);
  S.pt += st;
  const R = S.R, b = S.bar, tau = S.pt, tgt = GY - PXM * (S.base + 0.1 * S.notch);
  if (first) S.by = tgt;
  if (b.st !== 1 && b.st !== 3) S.by += (tgt - S.by) * min(1, st * 3);
  if (S.ph > POLE) S.cam = CAMF;

  if (S.ph === SET) {
    [S.cam, S.fig] = [CAMF, null];
    if (tau >= S.tset) startRun(S);
  } else if (S.ph === RUN) {
    R.dist = min(R.D, R.dist + 62 * (1 + 0.12 * S.wind) * min(1, 0.3 + tau / TACC) * st);
    const rem = R.D - R.dist;
    runPose(S);
    S.cam = R.Xto - rem - lerp(16, 6, sm(1 - rem / 40));
    if (rem <= 0) [S.ph, S.pt, R.cam] = [POLE, 0, S.cam];
  } else if (S.ph === POLE) {
    polePose(S);
    S.cam = lerp(R.cam, CAMF, sm(tau / TA / 0.75));
    if (tau >= TA) {
      // Let go: the hips fly on to just over the bar, or into it.
      const f = S.fig, ya = S.by - (S.clear ? 3.5 : 0.3), tap = sqrt((2 * max(3, f.y - ya)) / G);
      S.fl = { x: f.x, y: f.y, vx: cl((XS + 1 - f.x) / tap, 6, 30), vy: G * tap, tap, tf: sqrt((2 * max(10, GY - MH - 1.5 - ya)) / G) };
      S.free = { a: PI / 2 - PSI1, w: 1.4, L: R.Lg + 2.5, amax: acos(2 / (R.Lg + 2.5)) };
      [S.ph, S.pt] = [FLY, 0];
    }
  } else if (S.ph === FLY) {
    const f = S.fl, X = f.x + f.vx * tau, Y = f.y - f.vy * tau + 0.5 * G * tau * tau;
    const q = key(FLYK, tau < f.tap ? tau / f.tap : 1 + (tau - f.tap) / f.tf, S.q);
    S.fig = { x: X, y: Y, th: q[0], fc: -1, L: q.slice(2), arms: [q[1], q[1] + 0.25] };
    // Every camera in the house goes off at the top, the two in the infield first.
    if (!f.fl && (f.fl = tau >= f.tap - 0.05))
      for (let i = 0; i < 18; i++) S.flashes.push(i < 2 ? { x: i * 36 + 20, y: 114 + i * 5, t0: S.t + i * 0.1 } : flash(S.t + rnd() * 0.6));
    if (tau >= f.tap + 0.05 && b.st === 0 && (!S.clear || S.wob)) [b.st, b.t] = [S.clear ? 2 : 1, 0];
    if (tau > f.tap && Y >= GY - MH - 1.5) Object.assign(S, { ph: MAT, pt: 0, lx: X });
  } else if (S.ph === MAT) {
    matPose(S, tau);
    if (tau >= 0.5 && !S.verdict) [S.verdict, S.hudF, S.miss] = [2 - S.clear, 1, S.miss + !S.clear, S.marks.push(S.clear ? "0" : "X")];
    // A clearance puts the bar up a notch; a third miss sends it back.
    if (tau >= 1.6 && !S.done && (S.done = 1) && (S.clear || S.miss >= 3)) [S.marks, S.miss, S.notch] = [[], 0, S.clear && S.notch < 6 ? S.notch + 1 : 0];
    if (tau >= 2.3 && b.st === 3) b.st = 4;
    if (tau >= 2.9) Object.assign(S, { ph: SET, pt: 0, tset: 0.7, free: null }), newVaulter(S), (b.st = 0);
  }

  // The pole, once let go, falls back about the box onto the runway.
  const P = S.free;
  if (P) {
    P.w += ((3 * G) / (2 * P.L)) * sin(P.a) * st;
    P.a += P.w * st;
    if (P.a > P.amax) [P.a, P.w] = [P.amax, P.w > 0.6 ? -0.3 * P.w : 0];
  }
  // The bar shivers, and when it was hit it falls off the pegs onto the mat.
  b.t += st;
  if (b.st === 1 && b.t > 0.3) Object.assign(b, { st: 3, y: [S.by - OBY * ZS, S.by + OBY * ZS], v: [0, 0] });
  for (let i = 0, fl; i < 2 && b.st === 3; i++) {
    if (b.t < 0.3 + i * 0.08) continue;
    b.y[i] += (b.v[i] += G * st) * st;
    if (b.y[i] > (fl = GY - MH + OBY * MZ * (2 * i - 1) - 0.5)) [b.y[i], b.v[i]] = [fl, b.v[i] > 40 ? -0.3 * b.v[i] : 0];
  }
  S.hudF = max(0, S.hudF - st * 1.6);
  S.flashes = S.flashes.filter((f) => S.t - f.t0 < 0.2);
  if (rnd() < st * 0.8) S.flashes.push(flash(S.t));
}

// A figure, hip at (hx, hy): th turns the body clockwise from upright, fc
// faces it right (1) or left (-1). Arms reach for the hands, or hang at angles.
const PART = F(96);
function figure(S, hx, hy, th, fc, arms, L, hands, cols, sc) {
  hx -= S.cam;
  const ux = sin(th), uy = -cos(th), fx = cos(th) * fc, fy = sin(th) * fc, nx = hx + ux * TORSO * sc, ny = hy + uy * TORSO * sc;
  let n = 0;
  const part = (ax, ay, bx, by, r, c) => (PART.set([ax, ay, bx, by, r * sc, c], n), (n += 6));
  const limb = (x, y, a, l) => [x + l * sc * (ux * cos(a) + fx * sin(a)), y + l * sc * (uy * cos(a) + fy * sin(a))];
  // Far limbs first and in shade, then the body, then the near limbs.
  for (let side = 1; side >= 0; side--) {
    const [kx, ky] = limb(hx, hy, PI - L[side * 2], LEG), d = side * 4;
    const [ax, ay] = limb(kx, ky, PI - L[side * 2] + L[side * 2 + 1], LEG);
    const [wx, wy] = hands ? [hands[side * 2] - S.cam, hands[side * 2 + 1]] : limb(nx, ny, arms[side], ARM);
    part(hx, hy, kx, ky, 0.85, 1 + d);
    part(kx, ky, ax, ay, 0.62, 2 + d);
    part(nx, ny, wx, wy, 0.55, 2 + d);
    if (side) part(hx, hy, nx, ny, 1.05, 0), part(nx + ux * 1.7 * sc, ny + uy * 1.7 * sc, nx + ux * 1.8 * sc, ny + uy * 1.8 * sc, 1.25, 3);
  }
  let [x0, x1, y0, y1] = [99, -99, 999, -99];
  for (let j = 0; j < n; j += 6) [x0, x1, y0, y1] = [min(x0, PART[j], PART[j + 2]), max(x1, PART[j], PART[j + 2]), min(y0, PART[j + 1], PART[j + 3]), max(y1, PART[j + 1], PART[j + 3])];
  for (let y = max(0, floor(y0 - 2)); y <= min(H - 1, ceil(y1 + 2)); y++)
    for (let x = max(0, floor(x0 - 2)); x <= min(W - 1, ceil(x1 + 2)); x++) {
      const px = x + 0.5, py = y + 0.5, i = y * W + x;
      for (let j = 0; j < n; j += 6) {
        const ax = PART[j], ay = PART[j + 1], dx = PART[j + 2] - ax, dy = PART[j + 3] - ay;
        const tt = cl(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy + 1e-6), 0, 1);
        const a = cl(PART[j + 4] + 0.5 - sqrt((px - ax - dx * tt) ** 2 + (py - ay - dy * tt) ** 2), 0, 1);
        if (a <= 0) continue;
        const col = cols[PART[j + 5]];
        for (let c = 0; c < 3; c++) C[i * 3 + c] += (col[c] - C[i * 3 + c]) * a;
      }
    }
}

// The pole, two samples an LED, each shared over four LEDs.
const POLEC = [235, 232, 214];
function splat(x, y) {
  const ix = floor(x - 0.5), iy = floor(y - 0.5), fx = x - 0.5 - ix, fy = y - 0.5 - iy;
  for (let j = 0; j < 4; j++) {
    const xx = ix + (j & 1), yy = iy + (j >> 1), w = (j & 1 ? fx : 1 - fx) * (j >> 1 ? fy : 1 - fy), k = (yy * W + xx) * 3;
    if (xx >= 0 && xx < W && yy >= 0 && yy < H) for (let c = 0; c < 3; c++) C[k + c] += (POLEC[c] - C[k + c]) * w;
  }
}
function seg(x0, y0, x1, y1) {
  for (let i = 0, n = ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1; i <= n; i++) splat(lerp(x0, x1, i / n), lerp(y0, y1, i / n));
}

const FONT = { 0: 0x7b6f, 1: 0x2c97, 2: 0x73e7, 3: 0x73cf, 4: 0x5bc9, 5: 0x79cf, 6: 0x79ef, 7: 0x7249, 8: 0x7bef, 9: 0x7bcf, M: 0x5fed, X: 0x5aad, ".": 4 };
function text(s, x, y, col) {
  for (const ch of s) {
    for (let j = 0; j < 15; j++) if ((FONT[ch] >> (14 - j)) & 1) put(x + (j % 3), y + floor(j / 3), col);
    x += ch === "." ? 2 : 4;
  }
}
// A photographer kneeling in the infield, lens up at the bar.
const SNAP = "..oo.....oo.cc.####c.######..####...###...##.##..";

// Sky, roof, stands, LED ribbon, boards, track and grass, each panning by its depth.
function back(S) {
  const { cr, seat } = S, cam = S.cam, t = S.t, A = S.acc, T = S.tint, s0 = round(cam * 0.4), bx = cam * 0.85;
  for (let y = 0, j = 0; y < H; y++)
    for (let x = 0; x < W; x++, j += 3) {
      let r, g, b, v = -1;
      if (y < 13) (r = 5 + y), (g = 8 + 1.2 * y + 4 * T[1]), (b = 22 + 2 * y);
      else if (y < ST) {
        if (y === 15 && md(s0 + x, 3) === 0) v = 190;
        else r = g = b = y === 13 ? 46 : y === 16 ? 10 : 22;
      } else if (y >= 46 && y < 52) {
        v = y > 46 && y < 51 ? (md(floor((s0 + x + t * 12) / 2) * 7 + y, 11) < 5 ? 210 : 50) : 14;
      } else if (y < 84) {
        const i = (y - ST) * CW + md(s0 + x, CW), sw = seat[i] * 255;
        (r = cr[i * 3] * T[0] + sw * A[0]), (g = cr[i * 3 + 1] * T[1] + sw * A[1]), (b = cr[i * 3 + 2] * T[2] + sw * A[2]);
      } else if (y < 92) {
        const u = x + bx, sg = floor(u / 40), l = u - sg * 40, on = y > 85 && y < 90 && hash(floor((l + t * 9) / 2) + sg * 50, y) < 0.5;
        if (l < 1 || y === 91) r = g = b = 6;
        else if (md(sg, 2) ? on : !on) v = on ? 150 : 55;
        else r = g = b = on ? 150 : 8;
      } else if (y < 107) {
        // The track, then the runway with white edges and metre marks.
        const X = x + cam, li = y > 100 ? 1 : 0.55 + 0.03 * (y - 92), sp = hash(md(floor(X), 997), y) * 14;
        if (y === 96 || y === 101 || y === 106 || (y === 105 && md(floor(X), 14) === 0)) r = g = b = 175 * li;
        else (r = (140 + sp) * li), (g = (58 + sp * 0.4) * li), (b = (40 + sp * 0.3) * li);
      } else {
        // Infield grass in mown stripes.
        const q = (md(floor((x + cam * 1.15 + (y - 107) * 1.3) / 11), 2) ? 0.78 : 1) * (1 - (y - 107) * 0.02);
        (r = 24 * q), (g = 74 * q), (b = 32 * q);
      }
      if (v >= 0) (r = A[0] * v + (y < ST) * 60), (g = A[1] * v + (y < ST) * 60), (b = A[2] * v + (y < ST) * 60);
      C[j] = r;
      C[j + 1] = g;
      C[j + 2] = b;
    }
  // Floodlight towers above the roof, and flags streaming or hanging limp.
  for (let k = -3; k <= 3; k++) {
    const xi = round(k * 48 + 12 - cam * 0.2);
    for (let y = 1; y < 13; y++)
      for (let x = xi - 5; x <= xi + 5; x++)
        if (y < 7) put(x, y, y > 1 && y < 6 && (x - xi) % 2 === 0 && abs(x - xi) < 5 ? [255, 244, 222] : [40, 42, 52]);
        else if (x === xi) put(x, y, [34, 36, 46]);
  }
  const wd = S.wind, e = cl(abs(wd) * 1.4 + 0.25, 0, 1) * (wd < 0 ? -1 : 1), a = abs(e);
  for (let fx = 20 - md(s0, 32) - 32; fx < W + 6; fx += 32)
    for (let i = 0; i < 22; i++)
      if (i < 7) put(fx, 6 + i, [110, 110, 118]);
      else put(round(fx + e * (i % 5 + 1)), 6 + floor((i - 7) / 5) + round((i % 5 + 1) * ((1 - a) * 0.9 + sin(t * (5 + 7 * a) - i) * 0.12 * a)), i > 11 && i < 17 ? [235, 235, 235] : sc3(A, 230));
  // The photographers in the infield, and camera flashes going off.
  for (let k = 0; k < 2; k++) for (let r = 0; r < 49; r++) if (SNAP[r] !== ".") put(round(k * 36 - 16 - cam * 1.15) + (r % 7), 113 + k * 5 + floor(r / 7), SNAP[r] === "#" && r > 6 ? [12, 14, 20] : [48, 48, 56]);
  for (const f of S.flashes) {
    const a = 1 - (t - f.t0) / 0.2;
    for (let i = 0; i < 25 && a <= 1; i++) {
      const dx = (i % 5) - 2, dy = floor(i / 5) - 2, x = f.x + dx, d = abs(dx) + abs(dy), j = ((f.y + dy) * W + x) * 3;
      const v = (d ? (d > 1 ? (f.y > 100 && dx * dy === 0 ? 120 : 0) : 150) : 255) * a;
      if (x >= 0 && x < W && v > 0) for (let c = 0; c < 3; c++) C[j + c] = max(C[j + c], v);
    }
  }
}

// The mat from a little above: the top, the end facing the runway and the side
// facing us. Then the box and its stop board.
function mat(S) {
  const cam = S.cam, top = GY - MH, xe = round(-cam);
  for (let y = 89; y < 108; y++)
    for (let x = 0; x < W; x++) {
      const py = y + 0.5, X0 = x + 0.5 + cam, z = (py - top) / OBY, X = X0 - OBX * z, Xf = X0 - OBX * MZ, zl = (X0 - MAT0) / OBX, v = 0.86 + 0.012 * z;
      if (abs(z) <= MZ && X >= MAT0) put(x, y, md(X, 16) < 1 || z > MZ - 1 ? [110, 150, 250] : [44 * v, 98 * v, 232 * v]);
      else if (Xf >= MAT0 && py >= top + OBY * MZ && py <= GY + OBY * MZ) put(x, y, abs(py - GY + 0.6) < 0.6 && md(Xf, 9) > 3 ? [215, 220, 235] : md(Xf, 18) < 1 ? [18, 40, 120] : [30, 66, 176]);
      else if (abs(zl) <= MZ && py >= top + OBY * zl && py <= GY + OBY * zl) put(x, y, [22, 50, 140]);
    }
  for (let x = xe - 7; x <= xe; x++) for (let y = GY - 1; y <= GY + 1; y++) put(x, y, x === xe ? [200, 200, 212] : y < GY ? [90, 90, 100] : [10, 10, 14]);
}

function standard(S, z) {
  const x = round(XS + OBX * z - S.cam), yb = round(GY + OBY * z), yt = round(S.by + OBY * z - 5), near = z > 0;
  for (let y = yt; y <= yb; y++) for (let w = 0; w < 1 + near; w++) put(x + w, y, sc3([1, 1.02, 1.12], (near ? (w ? 120 : 175) : 100) * (y === yt ? 1.25 : 1)));
  for (let w = -2; w <= 2; w++) put(x + w, yb, [60, 60, 66]);
  put(x + (near ? -1 : 1), round(S.by + OBY * z), [220, 220, 225]);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const cam = S.cam, P = S.pole, b = S.bar;
  C = S.C;
  colours(S);
  back(S);
  standard(S, -ZS);
  mat(S);

  // The pole: carried, bent into an arc in the box, then let go.
  if (S.ph === RUN) seg(P.x - cam, P.y, P.x1 - cam, P.y1);
  else if (S.ph === POLE) {
    const A = arc(P.px, P.py, P.c, P.L), n = ceil(P.L * 2), a = A[3] + A[4], s = A[4] > 0 ? 2.5 : -2.5, ex = A[0] + A[2] * cos(a) - cam, ey = A[1] + A[2] * sin(a);
    for (let i = 0; i <= n; i++) splat(A[0] + A[2] * cos(A[3] + (A[4] * i) / n) - cam, A[1] + A[2] * sin(A[3] + (A[4] * i) / n));
    seg(ex, ey, ex - s * sin(a), ey + s * cos(a));
  } else if (S.free) seg(-cam, BOXY, -cam - S.free.L * sin(S.free.a), BOXY - S.free.L * cos(S.free.a));

  // The bar, striped, on its pegs or on its way down.
  let [y0, y1] = [S.by - OBY * ZS, S.by + OBY * ZS];
  const w = b.st === 1 || b.st === 2 ? sin(b.t * 48) * exp(-b.t * (b.st === 2 ? 5 : 2)) * 1.3 : 0;
  if (b.st >= 3) [y0, y1] = b.y;
  for (let i = 0; i <= 36 && b.st !== 4; i++) put(floor(lerp(XS - OBX * ZS, XS + OBX * ZS, i / 36) - cam), floor(lerp(y0 + w, y1 + w * 0.6, i / 36)), floor(i / 5.2) % 2 ? [240, 240, 236] : sc3(S.acc, 120, 60));

  // The vaulter, then the near upright in front.
  const f = S.fig;
  if (f) figure(S, f.x, f.y, f.th, f.fc, f.arms, f.L, f.hands, S.cols, 1);
  standard(S, ZS);

  // The judge by the box, a flag up once the bar has settled.
  const up = S.ph === MAT && S.verdict && S.pt < 2.6, jc = [[34, 50, 120], [70, 70, 82], [225, 165, 125], [40, 40, 44]];
  figure(S, -13.2, 101.6, 0, 1, [up ? 0.2 : 2.9, 2.95], [0, 0, 0, 0], null, jc.concat(jc), 0.85);
  for (let r = 0; r < 9 && up; r++) put(round(-12.3 - cam) + (r % 3), 91 + floor(r / 3), S.verdict === 1 ? [245, 245, 245] : [235, 25, 25]);

  // Glare from the lamp banks, over everything.
  for (let k = -3; k <= 3; k++) {
    const xi = round(k * 48 + 12 - cam * 0.2);
    for (let y = 0; y < 30; y++)
      for (let x = max(0, xi - 60), j = (y * W + x) * 3; x < min(W, xi + 60); x++, j += 3) {
        const v = S.glare[y * 128 + x - xi + 64];
        C[j] += v;
        C[j + 1] += v * 0.96;
        C[j + 2] += v * 0.88;
      }
  }

  // The results board: height, marks at it, the vaulter's colours.
  const hc = S.verdict === 1 ? [255, 255, 255] : [255, 40, 40];
  for (let y = 1; y < 13; y++) for (let x = 39; x < 63; x++) for (let c = 0, j = (y * W + x) * 3; c < 3; c++) C[j + c] = y === 1 ? S.acc[c] * 230 : C[j + c] * 0.2 + [6, 10, 26][c] * 0.8 + hc[c] * S.hudF * 0.75;
  text((S.base + 0.1 * S.notch).toFixed(2) + "M", 41, 3, [255, 180, 40]);
  S.marks.slice(-3).forEach((m, i) => text(m, 41 + i * 4, 8, m === "X" ? [255, 50, 40] : [240, 240, 240]));
  for (let r = 0; r < 30; r++) put(55 + (r % 6), 8 + floor(r / 6), r < 12 ? S.cols[0] : S.cols[1]);

  for (let i = 0; i < N; i++) display.setPixel(i % W, (i / W) | 0, min(255, C[i * 3]), min(255, C[i * 3 + 1]), min(255, C[i * 3 + 2]));
}
