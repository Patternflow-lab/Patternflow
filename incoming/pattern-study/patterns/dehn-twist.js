// ===== Patternflow pattern =====
// Title:   Dehn Twist
// Family:  topology
// Idea:    A shaded torus turns slowly in the upper half carrying a gold closed curve, and below it the flat square with opposite sides glued shows the same curve as straight segments; a thin green annulus round the tube lights up, its inside is dragged one full turn round the tube while its cut edge lets the curve's ends slide apart and meet again, and the curve relaxes to a straight one of class (p, q + p), so on the square it gains p more slanted segments and on the torus it winds p more times round the tube, until after a few twists it twists back as many times and the next curve takes its place.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Dehn twist (Max Dehn, 1938), and Lickorish's theorem that Dehn twists generate the mapping class group of a closed orientable surface (W. B. R. Lickorish, 1962), pattern round 81
// Round:   81
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Curve=0..5, Twists=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the torus and the square are blue, the curve gold and the annulus green; at 0.25 the torus is magenta, the curve green and the annulus blue, at 0.5 the torus is amber and the curve blue, at 0.75 the torus is green and the curve pink.
// Knob 2: Speed. At 2 a twist takes 2.5 s: 0.3 s for the annulus to light, 1.1 s of drag, 0.15 s to glue, 0.55 s to relax and 0.4 s held; every time goes as 2 / Speed, so 25 s a twist at 0.2 and 1.7 s at 3. The torus turns once in 30 s at 2.
// Knob 3: Curve. The class (p, q) the curve starts from, p times round the long way and q times round the tube: 0 (1, 0), 1 (2, 1), 2 (1, -2), 3 (3, 1), 4 (2, -3), 5 (3, -1). After it has climbed and come back the next one on the list takes its place. Turning the knob starts the new curve at once.
// Knob 4: Twists. How many twists the curve climbs before it twists back, and which way. From 0 to 1 each twist drags the annulus up the square and takes (p, q) to (p, q + p): 2 twists up to a third, 3 up to two thirds and 4 beyond. Below 0 it drags the other way, (p, q) to (p, q - p), with the same counts by the knob's size. A climb also stops early when the next curve would cut the square into more than 10 segments.

// The torus is the square [0,1) x [0,1) with its left edge glued to its
// right and its top to its bottom. U runs across the square and once round
// the long way of the torus; V runs up the square and once round the tube.
// A straight line through the square with slope q/p closes up after going
// p times across and q times up: a simple closed curve of class (p, q)
// whenever p and q have no common factor. On the square it crosses the
// side edges p times and the top edge |q| times, so it is cut into p + |q|
// segments.
//
// A meridian is a circle U = a, once round the tube. The Dehn twist about
// it cuts the torus along that circle, turns one side a full turn and
// glues it back: on the annulus a <= U < a + w it is
//
//   (U, V) -> (U, V + g((U - a) / w)),  g rising smoothly from 0 to 1,
//
// and the identity everywhere else. Each time the curve crosses the
// annulus it is carried once round the tube, so (p, q) becomes (p, q + p);
// the inverse twist gives (p, q - p). The meridian (0, 1) itself is left
// alone, so every curve here has p >= 1. In the matrix picture the twist
// is [[1, 0], [1, 1]] acting on (p, q).
//
// While the twist is under way the drag goes as s from 0 to 1: inside the
// annulus V moves by s g, outside it does not, so the curve stays whole at
// the annulus' left edge and comes apart at its right edge, where the cut
// is, by s of a turn. At s = 1 the ends meet again. The green stripes on
// the annulus are lines of the surface itself, V - s g constant, so they
// shear into helices while it turns.
//
// The twisted curve is then pulled straight. Written as V(tau) over
// tau in [0, 1) with U = p tau + c1, the twisted curve has
// V(tau + k/p) - V(tau) = k q / p + k for k = 1, ..., p - 1, and so has
// the straight line of class (p, q + p). Every mix of the two keeps that,
// and none of those differences is a whole number, so the straight-line
// homotopy between them passes only through simple curves of the class.
//
// The torus is ray marched once, at load: the view is orthographic and
// fixed, so each LED keeps its hit point, normal and (U, V) for good, and
// the turning only shifts U. The curve is drawn as a chain of 1600 dots,
// each tested against the torus' depth; the parts on the far side show
// faintly through.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, sqrt, sin, cos, atan2, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const fr = (x) => x - floor(x);

// The torus: radii, centre on the panel, the view's elevation above its
// equator, and the camera's up and toward-viewer axes in torus space.
const RB = 21, RS = 9, CX = 32, CY = 28.5, EL = (56 * PI) / 180, TOP = 58;
const EY = [0, sin(EL), cos(EL)], EZ = [0, -cos(EL), sin(EL)];
// The square: side, left and top edge.
const SQ = 56, SX = 4, SY = 67;
// The annulus' width in U, the samples along the curve, and the most
// segments a climb may cut the square into.
const AW = 0.1, NS = 1600, MAXSEG = 10;
const CURVES = [[1, 0], [2, 1], [1, -2], [3, 1], [2, -3], [3, -1]];
// Seconds at Speed 2.
const PRE = 0.3, DRAG = 1.1, GLUE = 0.15, RELAX = 0.55, POST = 0.4, FADE = 0.35, SPIN = 1 / 30;

// Light from the upper left, toward the viewer, in torus space.
const LIGHT = (() => {
  const c = [-0.45, 0.62, 0.64], n = sqrt(c[0] * c[0] + c[1] * c[1] + c[2] * c[2]);
  return [c[0] / n, (c[1] * EY[1] + c[2] * EZ[1]) / n, (c[1] * EY[2] + c[2] * EZ[2]) / n];
})();
const HALF = (() => {
  const h = [LIGHT[0] + EZ[0], LIGHT[1] + EZ[1], LIGHT[2] + EZ[2]], n = sqrt(h[0] * h[0] + h[1] * h[1] + h[2] * h[2]);
  return [h[0] / n, h[1] / n, h[2] / n];
})();

// Ray march the torus once: for each LED of the upper part, whether it
// sees the torus, and where.
const TH = new Uint8Array(W * TOP), TU = new Float32Array(W * TOP), TV = new Float32Array(W * TOP);
const TZ = new Float32Array(W * TOP), TL = new Float32Array(W * TOP);
for (let py = 0; py < TOP; py++)
  for (let px = 0; px < W; px++) {
    const X = px + 0.5 - CX, Y = CY - (py + 0.5), i = py * W + px;
    let t = 45;
    for (let k = 0; k < 200 && t > -45; k++) {
      const x = X, y = Y * EY[1] + t * EZ[1], z = Y * EY[2] + t * EZ[2];
      const rho = sqrt(x * x + y * y), q = rho - RB, d = sqrt(q * q + z * z) - RS;
      if (d < 0.002) {
        const nx = (x - (RB * x) / rho) / RS, ny = (y - (RB * y) / rho) / RS, nz = z / RS;
        const lam = max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
        const sp = max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]);
        TH[i] = 1;
        TU[i] = atan2(y, x) / TAU;
        TV[i] = fr((atan2(z, q) + PI / 2) / TAU);
        TZ[i] = y * EZ[1] + z * EZ[2];
        TL[i] = 0.2 + 0.68 * lam + 0.32 * sp ** 24;
        break;
      }
      t -= d;
    }
  }

// Small figures for the class label, rows of three bits, top first.
const GLYPH = {
  0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001011001111", 4: "101101111001001",
  5: "111100111001111", 6: "111100111101111", 7: "111001010010010", 8: "111101111101111", 9: "111101111001111",
  "-": "000000111000000", "(": "010100100100010", ")": "010001001001010", ",": "000000000010100",
};

function hsv(h, s, v) {
  h = fr(h) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// A soft dot of radius r into a coverage buffer, kept to rows y0..y1 and
// columns x0..x1.
function dot(A, x, y, r, a, x0, x1, y0, y1) {
  const ax = max(x0, floor(x - r - 0.5)), bx = min(x1, floor(x + r + 0.5));
  const ay = max(y0, floor(y - r - 0.5)), by = min(y1, floor(y + r + 0.5));
  for (let yy = ay; yy <= by; yy++)
    for (let xx = ax; xx <= bx; xx++) {
      const dx = xx + 0.5 - x, dy = yy + 0.5 - y, c = cl(r + 0.5 - sqrt(dx * dx + dy * dy), 0, 1) * a, j = yy * W + xx;
      if (c > A[j]) A[j] = c;
    }
}

function begin(S, ci) {
  S.ci = ((ci % CURVES.length) + CURVES.length) % CURVES.length;
  S.p = CURVES[S.ci][0];
  S.q = CURVES[S.ci][1];
  S.c1 = 0.1;
  S.c2 = 0.5 / S.p;
  S.m = 0;
  S.up = true;
}

// What comes after a twist: another the same way, the way back, or the
// next curve.
function plan(S) {
  if (S.up) {
    const d = S.n >= 0 ? 1 : -1, q2 = S.q + d * S.p;
    if ((S.m === 0 || Math.sign(S.m) === d) && abs(S.m) < abs(S.n) && S.p + abs(q2) <= MAXSEG) return go(S, d);
    S.up = false;
  }
  if (S.m !== 0) return go(S, -Math.sign(S.m));
  S.mode = "out";
  S.tm = 0;
}

function go(S, d) {
  S.dir = d;
  S.mode = "pre";
  S.tm = 0;
  // The annulus goes where the torus' left side will be halfway through
  // the drag. Seen from the front a meridian is a vertical line and a turn
  // round it hides; seen from the side it is an ellipse 18 LEDs wide.
  S.a = fr(0.5 - (S.spin + SPIN * (PRE + DRAG / 2)) - AW / 2);
}

export function setup(params) {
  params.s = {
    hue: 0, spin: 0.08, ci: -1, knob: -1, n: 2, mode: "pre", tm: 0, s: 0, lam: 0, hl: 0, fade: 1, glow: 0,
    p: 1, q: 0, c1: 0, c2: 0, a: 0, dir: 1, m: 0, up: true, c2n: 0, c2a: 0, c2b: 0,
    buf: new Float32Array(N * 3), A: new Float32Array(N), B: new Float32Array(N),
    cu: new Float32Array(NS), cv: new Float32Array(NS), P: [0, 0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3), t4 = cl(k[3] == null ? 0.06 : k[3], -1, 1);
  S.n = (t4 < 0 ? -1 : 1) * min(4, 2 + floor(abs(t4) * 3));
  const kc = round(cl(k[2] || 0, 0, 5));
  if (kc !== S.knob) {
    S.knob = kc;
    S.fade = 1;
    S.glow = 0;
    begin(S, kc);
    plan(S);
  }
  const h = (d * speed) / 2;
  S.spin = fr(S.spin + SPIN * h);
  S.tm += h;
  S.glow = max(0, S.glow - h * 3);
  if (S.mode === "pre") {
    S.hl = smooth(S.tm / PRE);
    if (S.tm >= PRE) (S.mode = "drag"), (S.tm -= PRE);
  }
  if (S.mode === "drag") {
    S.s = smooth(S.tm / DRAG);
    if (S.tm >= DRAG) (S.mode = "glue"), (S.tm -= DRAG), (S.s = 1), (S.glow = 1);
  }
  if (S.mode === "glue" && S.tm >= GLUE) {
    S.mode = "relax";
    S.tm -= GLUE;
    // The straight line the twisted curve relaxes to: same class plus the
    // twist, at the offset that matches the twisted curve on average.
    let mean = 0;
    for (let i = 0; i < NS; i++) {
      const x = S.p * (i / NS) + S.c1 - S.a, kk = floor(x), f = x - kk;
      mean += kk + (f < AW ? smooth(f / AW) : 1);
    }
    S.c2n = S.c2 + S.dir * (mean / NS - S.p / 2);
  }
  if (S.mode === "relax") {
    S.lam = smooth(S.tm / RELAX);
    if (S.tm >= RELAX) {
      S.q += S.dir * S.p;
      S.c2 = S.c2a = fr(S.c2n);
      // The held line then slides round the tube back to its home offset,
      // 0.5 / p up to a multiple of 1 / p, which leaves the curve's set of
      // strands the same: a pure translation, so the class does not move.
      let e = (0.5 - S.c2a * S.p) % 1;
      if (e > 0.5) e -= 1;
      if (e < -0.5) e += 1;
      S.c2b = S.c2a + e / S.p;
      S.m += S.dir;
      S.mode = "post";
      S.tm -= RELAX;
      S.s = 0;
      S.lam = 0;
    }
  }
  if (S.mode === "post") {
    S.hl = 1 - smooth(S.tm / POST);
    S.c2 = S.c2a + (S.c2b - S.c2a) * smooth(S.tm / POST);
    if (S.tm >= POST) {
      S.hl = 0;
      plan(S);
    }
  }
  if (S.mode === "out") {
    S.fade = 1 - smooth(S.tm / FADE);
    if (S.tm >= FADE) {
      begin(S, S.ci + 1);
      S.mode = "in";
      S.tm = 0;
    }
  }
  if (S.mode === "in") {
    S.fade = smooth(S.tm / FADE);
    if (S.tm >= FADE) {
      S.fade = 1;
      plan(S);
    }
  }
}

// The curve as NS points (U, V), U unwrapped.
function trace(S) {
  const { p, q, c1, c2, a, dir } = S, cu = S.cu, cv = S.cv;
  const drag = S.mode === "drag" || S.mode === "glue", relax = S.mode === "relax";
  for (let i = 0; i < NS; i++) {
    const tau = i / NS, U = p * tau + c1;
    let V = q * tau + c2;
    const x = U - a, kk = floor(x), f = x - kk, g = f < AW ? smooth(f / AW) : 1;
    if (drag) V += dir * S.s * (f < AW ? g : 0);
    else if (relax) {
      const vt = V + dir * (kk + g), vn = (q + dir * p) * tau + S.c2n;
      V = vt + (vn - vt) * S.lam;
    }
    cu[i] = U;
    cv[i] = V;
  }
}

function label(buf, text, cy, c) {
  let w = 0;
  for (const ch of text) w += (ch === "(" || ch === ")" || ch === "," ? 3 : 4);
  let x = round(32 - (w - 1) / 2);
  for (const ch of text) {
    const g = GLYPH[ch], gw = ch === "(" || ch === ")" || ch === "," ? 2 : 3;
    // Narrow glyphs keep the middle and one side of their three columns.
    const cols = ch === "(" || ch === "," ? [0, 1] : ch === ")" ? [1, 2] : [0, 1, 2];
    for (let r = 0; r < 5; r++)
      for (let j = 0; j < gw; j++)
        if (g[r * 3 + cols[j]] === "1") {
          const p = ((cy + r) * W + x + j) * 3;
          buf[p] = c[0];
          buf[p + 1] = c[1];
          buf[p + 2] = c[2];
        }
    x += gw + 1;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, A = S.A, B = S.B, P = S.P, h = S.hue;
  buf.fill(0);
  A.fill(0);
  B.fill(0);
  trace(S);
  const torus = hsv(h + 0.6, 0.6, 0.78), curve = hsv(h + 0.13, 0.55, 1), ann = hsv(h + 0.36, 0.7, 1);
  const lng = hsv(h + 0.83, 0.35, 0.62), mer = hsv(h + 0.36, 0.55, 0.62);
  const spin = S.spin;

  // The curve on the torus, front and back, and on the square. A dot
  // within 0.4 LED of the last one drawn adds nothing and is skipped.
  let lx = -9, ly = -9, lf = -1, mx0 = -9, my0 = -9;
  for (let i = 0; i < NS; i++) {
    const U = S.cu[i], V = S.cv[i];
    const t = TAU * (U + spin), ph = TAU * V - PI / 2, rr = RB + RS * cos(ph);
    const x = rr * cos(t), y = rr * sin(t), z = RS * sin(ph);
    P[0] = CX + x;
    P[1] = CY - (y * EY[1] + z * EY[2]);
    P[2] = y * EZ[1] + z * EZ[2];
    const facing = cos(ph) * sin(t) * EZ[1] + sin(ph) * EZ[2];
    const ix = floor(P[0]), iy = floor(P[1]), j = iy * W + ix;
    const front = ix >= 0 && ix < W && iy >= 0 && iy < TOP && TH[j] ? P[2] >= TZ[j] - 1.6 : facing > 0;
    const fb = front ? 1 : 0;
    if (fb !== lf || (P[0] - lx) ** 2 + (P[1] - ly) ** 2 > 0.16) {
      dot(front ? A : B, P[0], P[1], front ? 1.25 : 0.9, 1, 0, W - 1, 0, TOP - 1);
      lx = P[0];
      ly = P[1];
      lf = fb;
    }
    const qx = SX + fr(U) * SQ, qy = SY + SQ - fr(V) * SQ;
    if ((qx - mx0) ** 2 + (qy - my0) ** 2 > 0.16) {
      dot(A, qx, qy, 1.15, 1, SX, SX + SQ - 1, SY, SY + SQ - 1);
      mx0 = qx;
      my0 = qy;
    }
  }

  // The torus.
  const drag = S.mode === "drag" || S.mode === "glue" ? S.s : S.mode === "relax" || S.mode === "post" ? 1 : 0;
  for (let i = 0; i < W * TOP; i++) {
    if (!TH[i]) continue;
    const l = TL[i], o = i * 3;
    let r = torus[0] * l, g = torus[1] * l, b = torus[2] * l;
    if (S.hl > 0) {
      const f = fr(TU[i] - spin - S.a);
      if (f < AW) {
        const vm = TV[i] - S.dir * drag * smooth(f / AW), e = fr(vm * 6), st = cl(1.3 - min(e, 1 - e) * 9.4, 0, 1);
        const edge = cl(1.4 - min(f, AW - f) * 2 * PI * RB * 1.2, 0, 1);
        const m = S.hl * (0.3 + 0.7 * max(st, edge)), lv = 0.35 + 0.65 * l;
        r += (ann[0] * lv - r) * m;
        g += (ann[1] * lv - g) * m;
        b += (ann[2] * lv - b) * m;
      }
    }
    const back = B[i] * (1 - A[i]) * 0.3 * S.fade, a = A[i] * S.fade, lc = 0.55 + 0.45 * min(1, l);
    r += (curve[0] - r) * back;
    g += (curve[1] - g) * back;
    b += (curve[2] - b) * back;
    r += (curve[0] * lc - r) * a;
    g += (curve[1] * lc - g) * a;
    b += (curve[2] * lc - b) * a;
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
  }

  // The square: its ground, the annulus as a strip, the curve, and the
  // glued edges, side edges in the meridian's colour with one arrow each,
  // top and bottom in the longitude's colour with two.
  for (let y = SY; y < SY + SQ; y++)
    for (let x = SX; x < SX + SQ; x++) {
      const i = y * W + x, o = i * 3, U = (x + 0.5 - SX) / SQ, V = (SY + SQ - y - 0.5) / SQ;
      let r = torus[0] * 0.2, g = torus[1] * 0.2, b = torus[2] * 0.2;
      if (S.hl > 0) {
        const f = fr(U - S.a);
        if (f < AW) {
          const vm = V - S.dir * drag * smooth(f / AW), e = fr(vm * 6), st = cl(1.2 - min(e, 1 - e) * 9.3, 0, 1);
          const edge = cl(1.3 - min(f, AW - f) * SQ, 0, 1);
          const m = S.hl * (0.3 + 0.7 * max(st, edge));
          r += (ann[0] * 0.55 - r) * m;
          g += (ann[1] * 0.55 - g) * m;
          b += (ann[2] * 0.55 - b) * m;
        }
      }
      const a = A[i] * S.fade;
      r += (curve[0] - r) * a;
      g += (curve[1] - g) * a;
      b += (curve[2] - b) * a;
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
    }
  const put = (x, y, c) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    buf[o] = c[0];
    buf[o + 1] = c[1];
    buf[o + 2] = c[2];
  };
  for (let y = SY - 1; y <= SY + SQ; y++) put(SX - 1, y, mer), put(SX + SQ, y, mer);
  for (let x = SX; x < SX + SQ; x++) put(x, SY - 1, lng), put(x, SY + SQ, lng);
  const my = SY + SQ / 2 - 2, mx = SX + SQ / 2 - 2;
  for (const ex of [SX - 1, SX + SQ])
    for (let k = 1; k <= 2; k++) put(ex - k, my + k, mer), put(ex + k, my + k, mer);
  for (const ey of [SY - 1, SY + SQ])
    for (const dx of [0, 3])
      for (let k = 1; k <= 2; k++) put(mx + dx - k, ey - k, lng), put(mx + dx - k, ey + k, lng);

  // Where the cut closes, a flash on each meeting point.
  if (S.glow > 0 && S.mode !== "out") {
    for (let k = 0; k < S.p; k++) {
      const U = S.a + AW + k, tau = (U - S.c1 - floor((U - S.c1) / S.p) * S.p) / S.p, ii = floor(tau * NS) % NS;
      const V = S.cv[ii];
      const t = TAU * (U + spin), ph = TAU * V - PI / 2, rr = RB + RS * cos(ph);
      const x = rr * cos(t), y = rr * sin(t), z = RS * sin(ph);
      const facing = cos(ph) * sin(t) * EZ[1] + sin(ph) * EZ[2];
      const pts = [[SX + fr(U) * SQ, SY + SQ - fr(V) * SQ]];
      if (facing > 0) pts.push([CX + x, CY - (y * EY[1] + z * EY[2])]);
      for (const [px, py] of pts)
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const X = floor(px) + dx, Y = floor(py) + dy;
            if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
            const o = (Y * W + X) * 3, m = S.glow * cl(2.4 - sqrt(dx * dx + dy * dy), 0, 1);
            buf[o] += (1 - buf[o]) * m;
            buf[o + 1] += (1 - buf[o + 1]) * m;
            buf[o + 2] += (1 - buf[o + 2]) * m;
          }
    }
  }

  // The class: the new one from the moment the ends meet.
  const shown = S.mode === "glue" || S.mode === "relax" ? S.q + S.dir * S.p : S.q;
  const lc = hsv(h + 0.13, 0.25, 0.75 + 0.25 * S.glow);
  label(buf, "(" + S.p + "," + shown + ")", 58, [lc[0] * S.fade, lc[1] * S.fade, lc[2] * S.fade]);

  for (let i = 0; i < N; i++)
    display.setPixel(i % W, floor(i / W), round(cl(buf[i * 3], 0, 1) * 255), round(cl(buf[i * 3 + 1], 0, 1) * 255), round(cl(buf[i * 3 + 2], 0, 1) * 255));
}
