// ===== Patternflow pattern =====
// Title:   Steiner Deltoid
// Family:  line
// Idea:    A point runs round the circumcircle of a slowly changing triangle, the feet of its perpendiculars to the three side lines stand on one straight line drawn the full height of the panel, and the fading trace of those Simson lines piles up into a bright three-cusped deltoid that turns and slides as the triangle changes.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Simson line (William Wallace, 1799), Steiner's deltoid as the envelope of the Simson lines (Jakob Steiner, 1856), pattern round 73
// Round:   73
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Shape=0..1, Trail=0.5..4
//
// Knob 1: Hue. Turns every colour together: at 0 the traces run teal to blue round the deltoid, the triangle and its circle are pale gold, its feet gold, and the point and the current Simson line near white.
// Knob 2: Speed. How fast the point runs round the circle: one turn in 5 s at 2, 3.3 s at 3 and 50 s at 0.2. The triangle changes shape on the same clock.
// Knob 3: Shape. How far the triangle strays from equilateral. At 0 its corners swing up to 14 degrees each way round the circle and the deltoid barely leaves the middle; at 1 they swing up to 46, the triangle goes obtuse, the orthocentre leaves it, and the deltoid rides up to 13.5 LEDs up and down the panel.
// Knob 4: Trail. How long the earlier Simson lines stay, in turns of the point: at 0.5 a line fades to 37% in half a turn and the deltoid is one bright edge among separate rays; at 4 the lines stay for 20 s at Speed 2, each laid fainter, and the inside of the deltoid, crossed by three lines a turn, glows over the outside, crossed by one.

const W = 64, H = 128, NP = W * H;
const { floor, ceil, round, cos, sin, exp, min, max, abs, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The geometry, checked in Node for 200 random triangles with the point
// at 2000 places round the circle each: the three feet are collinear (the
// area they span stays under 1e-15 of R^2); the Simson line turns 180 degrees
// the other way while the point goes once round; the line for the point
// diametrically opposite a vertex is the opposite side; and the envelope's
// nearest and farthest points lie R/2 and 3R/2 from the nine-point centre N
// (to 1e-6), so the nine-point circle is the deltoid's incircle and its
// cusps sit 1.5 R out. For one triangle, counting sign changes over 20,000
// places of the point, each of 36 test points within R/2 of N lay on three
// Simson lines a turn and each of 36 beyond 1.5 R on one. With the
// circumcentre at 0 and R = 1, in complex numbers, N = (a + b + c) / 2 and
// the line for p touches the deltoid at (a + b + c + 2p + abc / p^2) / 2,
// which the code uses for the spark; that formula matched the intersection
// of neighbouring lines to 1e-6.
//
// R is 18 LEDs, so the cusps lie 27 from N and the deltoid fits the 64
// columns when N stands on the middle one. The view slides sideways to keep
// it there: the circumcentre sits on row 64 at x = 32 - Hx / 2, where H is
// the orthocentre's offset from it, and N rides up and down the panel with
// Hy / 2. Over 5000 s at Shape 1 the circle reaches column 63.5 at most and
// N stays within 13.5 rows of row 64.
const R = 18;
// One turn of the point takes TURN seconds at Speed 2.
const TURN = 5;

// The triangle at clock u (seconds at Speed 2). Three corners spaced a third
// of a turn, each swinging round the circle on its own slow beat (47, 59 and
// 71 s), and the whole triangle turning once in 200 s against the point, so
// over the 2.5 s a trace lasts at the start the deltoid hardly moves and its
// edge stays sharp. amp is the swing in radians: 0.25 at Shape 0, 0.8 at
// Shape 1. A corner can never pass the next one: two neighbours close by at
// most 2 * 0.8 rad, short of 2.09, and over 5000 s they never come closer
// than 28 degrees.
const BEAT = [47, 59, 71], PH = [0.9, 2.6, 4.4];
function triangle(u, amp, out) {
  const rho = (-TAU * u) / 200;
  let hx = 0, hy = 0;
  for (let i = 0; i < 3; i++) {
    const a = rho + PI / 2 + (TAU * i) / 3 + amp * sin((TAU * u) / BEAT[i] + PH[i]);
    out.ca[i] = cos(a);
    out.sa[i] = sin(a);
    hx += out.ca[i];
    hy += out.sa[i];
  }
  // Orthocentre H = O + R (a + b + c); the circumcentre O keeps the
  // nine-point centre N = O + R (a + b + c) / 2 on column 32.
  out.ox = 32 - (R * hx) / 2;
  out.oy = 64;
  out.hx = hx;
  out.hy = hy;
  for (let i = 0; i < 3; i++) (out.x[i] = out.ox + R * out.ca[i]), (out.y[i] = out.oy + R * out.sa[i]);
  return out;
}
const newTri = () => ({ ca: [0, 0, 0], sa: [0, 0, 0], x: [0, 0, 0], y: [0, 0, 0], ox: 0, oy: 0, hx: 0, hy: 0 });

// Foot of the perpendicular from (px, py) to the line through corners i, j.
function foot(T, i, j, px, py, o, k) {
  const ux = T.x[i], uy = T.y[i], dx = T.x[j] - ux, dy = T.y[j] - uy;
  const t = ((px - ux) * dx + (py - uy) * dy) / (dx * dx + dy * dy);
  o[k] = ux + t * dx;
  o[k + 1] = uy + t * dy;
}

// The Simson line of the point at angle th: the three feet into F (on BC,
// CA, AB), and the line through the two farthest apart as n . q = c with n
// a unit normal, into L.
function simson(T, th, F, L) {
  const px = T.ox + R * cos(th), py = T.oy + R * sin(th);
  foot(T, 1, 2, px, py, F, 0);
  foot(T, 2, 0, px, py, F, 2);
  foot(T, 0, 1, px, py, F, 4);
  let bi = 0, bj = 2, bd = -1;
  for (const [i, j] of [[0, 2], [2, 4], [0, 4]]) {
    const d = hypot(F[j] - F[i], F[j + 1] - F[i + 1]);
    if (d > bd) (bd = d), (bi = i), (bj = j);
  }
  const dx = (F[bj] - F[bi]) / bd, dy = (F[bj + 1] - F[bi + 1]) / bd;
  L[0] = -dy;
  L[1] = dx;
  L[2] = -dy * F[bi] + dx * F[bi + 1];
  L[3] = px;
  L[4] = py;
}

// Add a soft line n . q = c, w LEDs to each side, into a float RGB buffer.
// It walks rows for a steep line and columns for a flat one, so a line
// costs about 400 pixel visits, not 8192.
function addLine(buf, nx, ny, c, w, amt, col) {
  if (abs(nx) >= abs(ny)) {
    const sp = w / abs(nx);
    for (let y = 0; y < H; y++) {
      const xc = (c - ny * (y + 0.5)) / nx - 0.5;
      for (let x = max(0, ceil(xc - sp)); x <= min(W - 1, floor(xc + sp)); x++) {
        const f = 1 - abs(nx * (x + 0.5) + ny * (y + 0.5) - c) / w;
        if (f > 0) {
          const o = (y * W + x) * 3;
          buf[o] += amt * f * col[0], buf[o + 1] += amt * f * col[1], buf[o + 2] += amt * f * col[2];
        }
      }
    }
  } else {
    const sp = w / abs(ny);
    for (let x = 0; x < W; x++) {
      const yc = (c - nx * (x + 0.5)) / ny - 0.5;
      for (let y = max(0, ceil(yc - sp)); y <= min(H - 1, floor(yc + sp)); y++) {
        const f = 1 - abs(nx * (x + 0.5) + ny * (y + 0.5) - c) / w;
        if (f > 0) {
          const o = (y * W + x) * 3;
          buf[o] += amt * f * col[0], buf[o + 1] += amt * f * col[1], buf[o + 2] += amt * f * col[2];
        }
      }
    }
  }
}

// Soft segment and dot, brightest-wins, into the 0..255 frame.
function seg(rgb, x0, y0, x1, y1, w, col) {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1e-9;
  const xa = max(0, floor(min(x0, x1) - w)), xb = min(W - 1, ceil(max(x0, x1) + w));
  const ya = max(0, floor(min(y0, y1) - w)), yb = min(H - 1, ceil(max(y0, y1) + w));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const qx = x + 0.5 - x0, qy = y + 0.5 - y0, t = cl((qx * dx + qy * dy) / l2, 0, 1);
      const f = 1 - hypot(qx - t * dx, qy - t * dy) / w;
      if (f > 0) put(rgb, y * W + x, f, col);
    }
}
function dot(rgb, cx, cy, r, col) {
  for (let y = max(0, floor(cy - r)); y <= min(H - 1, ceil(cy + r)); y++)
    for (let x = max(0, floor(cx - r)); x <= min(W - 1, ceil(cx + r)); x++) {
      const f = 1 - hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (f > 0) put(rgb, y * W + x, min(1, 1.6 * f), col);
    }
}
function ring(rgb, cx, cy, rad, w, col) {
  for (let y = max(0, floor(cy - rad - w)); y <= min(H - 1, ceil(cy + rad + w)); y++)
    for (let x = max(0, floor(cx - rad - w)); x <= min(W - 1, ceil(cx + rad + w)); x++) {
      const f = 1 - abs(hypot(x + 0.5 - cx, y + 0.5 - cy) - rad) / w;
      if (f > 0) put(rgb, y * W + x, f, col);
    }
}
function put(rgb, p, f, col) {
  const o = p * 3;
  rgb[o] = max(rgb[o], f * col[0]);
  rgb[o + 1] = max(rgb[o + 1], f * col[1]);
  rgb[o + 2] = max(rgb[o + 2], f * col[2]);
}

// ---- The trace. Every time the point passes a multiple of STEP (6 degrees,
// 60 lines a turn) that place's Simson line is laid into ACC, LINE strong,
// and the buffer fades by exp(-u / tau), tau the Trail knob in turns. The
// lines are kept apart like threads in string art: near the deltoid
// neighbours overlap and add up to a bright edge, farther out they part, 3
// degrees apart, and run as separate rays to the panel's ends. Being tied
// to the point's angle, not to frames, the trace is the same at any frame
// rate and speed.
const STEP = (6 * PI) / 180, LINE = 0.5, LW = 0.75;
function deposit(S, T, th0, th1) {
  const F = S.F, L = S.L;
  for (let k = floor(th0 / STEP) + 1; k * STEP <= th1; k++) {
    const th = k * STEP;
    simson(T, th, F, L);
    // The trace's colour runs from its hue to 0.16 past it and back once a
    // turn, so each arc of the deltoid keeps its own tint.
    const col = hsv(0.47 + S.hue + 0.08 * (1 - cos(th)), 0.75, 1);
    addLine(S.acc, L[0], L[1], L[2], LW, LINE * (0.5 / S.trail) ** 0.7, col);
  }
}

function advance(S, du) {
  const T = triangle(S.u, S.amp, S.T);
  const th1 = S.th + (TAU * du) / TURN;
  const fade = exp(-du / (S.trail * TURN)), acc = S.acc;
  for (let i = 0; i < NP * 3; i++) acc[i] *= fade;
  deposit(S, T, S.th, th1);
  S.th = th1;
  S.u += du;
}

export function setup(params) {
  params.s = {
    u: 0, th: 0, hue: 0, amp: 0.25, trail: 0.5, warm: false,
    acc: new Float32Array(NP * 3), rgb: new Float32Array(NP * 3), tmp: new Float32Array(NP * 3),
    T: newTri(), F: new Float64Array(6), L: new Float64Array(5),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.5], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.amp = 0.25 + 0.55 * cl(k[2], 0, 1);
  S.trail = cl(k[3], 0.5, 4);
  if (!S.warm) {
    // First frame: run the last three trail lengths (at most 60 s) at 30
    // steps a second, so the deltoid is already built when the panel opens.
    // 90 lines and 10 to 20 ms in Node at Trail 0.5; 720 lines and about
    // 60 ms at 4, most of it fading the buffer 1800 times.
    const back = min(60, 3 * S.trail * TURN);
    S.u = -back;
    S.th = (-TAU * back) / TURN;
    for (let i = 0, n = round(back * 30); i < n; i++) advance(S, 1 / 30);
    S.u = 0;
    S.th = 0;
    S.warm = true;
  }
  advance(S, (d * cl(k[1], 0.2, 3)) / 2);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  const T = triangle(S.u, S.amp, S.T), F = S.F, L = S.L, rgb = S.rgb, acc = S.acc;
  // The trace, through 1 - exp(-acc) per channel, so where lines pile up the
  // colour runs to white.
  for (let i = 0; i < NP * 3; i++) rgb[i] = 255 * (1 - exp(-acc[i]));

  const gold = hsv(0.12 + S.hue, 0.38, 1), grey = hsv(0.12 + S.hue, 0.2, 1), pale = hsv(0.47 + S.hue, 0.18, 1);
  const sc = (c, v) => [c[0] * v, c[1] * v, c[2] * v];
  // The three side lines, run off the panel both ways: the feet often land
  // on them outside the triangle.
  const side = [], dim = sc(grey, 50);
  for (const [i, j] of [[1, 2], [2, 0], [0, 1]]) {
    const dx = T.x[j] - T.x[i], dy = T.y[j] - T.y[i], l = hypot(dx, dy);
    side.push([-dy / l, dx / l, (-dy * T.x[i] + dx * T.y[i]) / l]);
  }
  const lines = S.tmp.fill(0);
  for (const [nx, ny, c] of side) addLine(lines, nx, ny, c, 0.9, 1, dim);
  for (let i = 0; i < NP * 3; i++) rgb[i] = max(rgb[i], min(dim[i % 3], lines[i]));
  ring(rgb, T.ox, T.oy, R, 0.9, sc(gold, 95));
  for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) seg(rgb, T.x[i], T.y[i], T.x[j], T.y[j], 1, sc(gold, 210));

  // The point, its perpendiculars, the feet and its Simson line.
  simson(T, S.th, F, L);
  const px = L[3], py = L[4];
  for (let k = 0; k < 3; k++) seg(rgb, px, py, F[2 * k], F[2 * k + 1], 0.8, sc(gold, 95));
  const line = S.tmp.fill(0);
  addLine(line, L[0], L[1], L[2], 1.1, 1, sc(pale, 235));
  for (let i = 0; i < NP * 3; i++) if (line[i] > rgb[i]) rgb[i] = line[i];
  for (let k = 0; k < 3; k++) dot(rgb, F[2 * k], F[2 * k + 1], 1.8, sc(gold, 255));
  dot(rgb, px, py, 2.4, [255, 255, 255]);
  // Where the line touches the deltoid: (a + b + c + 2p + abc / p^2) / 2.
  const ar = T.ca[0] * T.ca[1] - T.sa[0] * T.sa[1], ai = T.ca[0] * T.sa[1] + T.sa[0] * T.ca[1];
  const br = ar * T.ca[2] - ai * T.sa[2], bi = ar * T.sa[2] + ai * T.ca[2];
  const tr = br * cos(-2 * S.th) - bi * sin(-2 * S.th), ti = br * sin(-2 * S.th) + bi * cos(-2 * S.th);
  const tx = T.ox + (R * (T.hx + 2 * cos(S.th) + tr)) / 2, ty = T.oy + (R * (T.hy + 2 * sin(S.th) + ti)) / 2;
  dot(rgb, tx, ty, 1.6, [255, 255, 255]);

  for (let p = 0; p < NP; p++) display.setPixel(p % W, (p / W) | 0, min(255, rgb[p * 3]) | 0, min(255, rgb[p * 3 + 1]) | 0, min(255, rgb[p * 3 + 2]) | 0);
}
