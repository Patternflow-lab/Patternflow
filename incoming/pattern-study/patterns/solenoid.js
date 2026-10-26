// ===== Patternflow pattern =====
// Title:   Solenoid
// Family:  fractal
// Idea:    A solid torus stands on the panel as a dim glass ring and turns about its upright axis every 12 seconds, and inside it runs one closed strand that the Smale-Williams map has wound 16 times round, two bundles of eight that each split in two and again down to pairs, so any slice across the tube cuts it in a Cantor set; each strand wears a dark collar that cuts the strands passing behind it.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Smale-Williams solenoid (Stephen Smale, 1967; Robert F. Williams, 1967), the dyadic solenoid (Leopold Vietoris, 1927; David van Dantzig, 1930), pattern round 57
// Round:   57
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Level=-3..3, Lambda=0..1
//
// Knob 1: Hue. Turns the strand colours round the wheel together. At 0 they run from green through cyan to violet-blue: the colour follows the turning of the first term e^(is/2)/2, so where the two bundles of f(T) are green and violet, half a circuit on they are both cyan, and a whole circuit on they have swapped, because the two bundles are one tube going round twice. At 0.5 the same runs from magenta through red to yellow. The body of T stays slate.
// Knob 2: Speed. The ring turns once in 24 / Speed seconds: 12 s at 2, so it goes from face-on (two tall arcs of cable at the sides, black in the hole) to edge-on (one column of cable down the middle) in 3 s. 120 s at 0.2, 8 s at 3.
// Knob 3: Level. The level k is 4 plus the knob, 1 to 7: f^k(T) is one tube wound 2^k times round, so 2 strands at -3 (a double helix), 16 at 0 and 128 at 3. Between whole numbers the newest term of z grows in, so turning the knob up splits every strand in two inside its own tube; the picture follows the knob within a second.
// Knob 4: Lambda. The contraction of f(th, z) = (2 th, lambda z + e^(i th)/2), 0.49 at 0 down to 0.22 at 1 (0.474 at the opening). The Cantor set in a slice has dimension log 2 / log(1/lambda), 0.97 down to 0.46, and the two halves of a finest bundle sit lambda^(k-1) R apart: at level 4, 1.6 LEDs at the opening and 0.16 at 0.22, where each pair fuses into one line.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, cos, sin, sqrt, PI, round, abs } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The solid torus T = S1 x D2. Its centre line is a stadium in the plane
// of the panel: straight sides of half length HS joined by half circles of
// radius A, run at constant speed. The disc has radius R.
const A = 24, HS = 30, R = 15;
const PER = 4 * HS + TAU * A;
// The disc coordinate z is read in a frame that turns TWIST times round
// the tube per circuit: another way of putting S1 x D2 into space, with
// the same map in (th, z). In space it winds the strands round the tube
// like a cable, so they cross the panel slanted instead of running in
// parallel lines up its sides.
//
// The map is f(th, z) = (2 th, lambda z + e^(i th)/2). It sends the unit
// disc bundle into itself (|f| <= lambda + 1/2 < 1), and the slice of f(T)
// over 2 th is two discs of radius lambda round +-e^(i th)/2, apart while
// lambda < 1/2, so f is one to one. f^k(T) is a tube of radius lambda^k
// round the curve z(s) = 1/2 sum_{m=1..k} lambda^(m-1) e^(i s / 2^m) over
// th = s mod 2 pi, which closes after s = 2 pi 2^k: 2^k turns.
const TWIST = 10;
// Steps of the circle per turn of a strand (under 0.9 LED a step), and the
// dark collar: a strand blacks out what lies more than COLLAR LEDs behind
// it, one LED round, so a strand passing in front reads as in front.
const NT = 1000, COLLAR = 3;
// Brightness of the body of T, the glass the strands lie in. Over black
// the collars would vanish; over the body every strand shows its edge.
const BODY = 0.55;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Centre point and outward normal at torus angle th.
function centre(th, o, out) {
  let u = (th / TAU) * PER;
  if (u < 2 * HS) return (out[o] = A), (out[o + 1] = -HS + u), (out[o + 2] = 1), (out[o + 3] = 0);
  u -= 2 * HS;
  if (u < PI * A) {
    const al = u / A;
    return (out[o] = A * cos(al)), (out[o + 1] = HS + A * sin(al)), (out[o + 2] = cos(al)), (out[o + 3] = sin(al));
  }
  u -= PI * A;
  if (u < 2 * HS) return (out[o] = -A), (out[o + 1] = HS - u), (out[o + 2] = -1), (out[o + 3] = 0);
  u -= 2 * HS;
  const al = PI + u / A;
  return (out[o] = A * cos(al)), (out[o + 1] = -HS + A * sin(al)), (out[o + 2] = cos(al)), (out[o + 3] = sin(al));
}

export function setup(params) {
  // Centre line, normal and the turning frame, per step of th.
  const C = new Float64Array(NT * 6);
  for (let j = 0; j < NT; j++) {
    centre((TAU * j) / NT, j * 6, C);
    C[j * 6 + 4] = cos((TWIST * TAU * j) / NT);
    C[j * 6 + 5] = sin((TWIST * TAU * j) / NT);
  }
  params.s = {
    C, hue: 0, speed: 2, level: 4, shown: 4, lam: 0.47, phi: -PI / 3,
    zb: new Float32Array(N), hb: new Float32Array(N), vb: new Float32Array(N), rgb: new Float32Array(3),
    er: new Float64Array(10), ei: new Float64Array(10), sr: new Float64Array(10), si: new Float64Array(10),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(kv[0], 0, 1);
  s.speed = cl(kv[1], 0.2, 3);
  s.level = 4 + cl(kv[2], -3, 3);
  s.lam = 0.49 - 0.27 * cl(kv[3], 0, 1);
  // The level eases to the knob, so strands split in two or merge. The
  // view opens 60 degrees short of face-on and turns about the upright.
  s.shown += (s.level - s.shown) * min(1, d * 3);
  s.phi += d * s.speed * (TAU / 24);
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  const { C, zb, hb, vb, rgb, er, ei, sr, si } = s;
  zb.fill(-1e9);
  // Per LED: the depth that holds it, and what it shows: a strand's hue,
  // or -1 a collar, -2 the body, -3 nothing.
  hb.fill(-3);
  const L = s.shown, k = floor(L + 1e-6), w = L - k, K = w > 1e-3 ? k + 1 : k, M = 1 << K, lam = s.lam;
  const cp = cos(s.phi), sp = sin(s.phi), F = 220, Dm = A + R, hue0 = 0.5 + s.hue;

  // The body of T: every LED within R of the projected centre line, since
  // the shadow of a tube is the union of the shadows of its spheres.
  for (let j = 0; j < NT; j += 15) {
    const o = j * 6, x = C[o], y = C[o + 1];
    const Z = -x * sp, f = F / (F - Z), qx = 31.5 + x * cp * f, qy = 63.5 - y * f, rr = R * f;
    const y0 = max(0, ceil(qy - rr)), y1 = min(H - 1, floor(qy + rr));
    for (let yy = y0; yy <= y1; yy++) {
      const hw = sqrt(max(0, rr * rr - (yy - qy) * (yy - qy)));
      const x0 = max(0, ceil(qx - hw)), x1 = min(W - 1, floor(qx + hw));
      for (let xx = x0, p = yy * W + x0; xx <= x1; xx++, p++) (zb[p] = -1e8), (hb[p] = -2);
    }
  }

  // z(s) = 1/2 sum_{m=1..K} lam^(m-1) e^(i s / 2^m); the last term grows in
  // while the level rises from K - 1 to K.
  const amp = [];
  for (let m = 1, a = 0.5; m <= K; m++, a *= lam) amp.push(m === K && w > 1e-3 ? a * w : a);
  // From 64 strands on, every second or fourth step: the strands of a
  // bundle lie closer than an LED there and fill each other's gaps.
  const step = K > 5 ? 1 << (K - 5) : 1, ds = (TAU * step) / NT;
  for (let m = 0; m < K; m++) (sr[m] = cos(ds / (2 << m))), (si[m] = sin(ds / (2 << m)));

  const write = (p, Z, h, v) => {
    const zh = Z - COLLAR, px = p % W;
    if (px > 0 && zh > zb[p - 1]) (zb[p - 1] = zh), (hb[p - 1] = -1);
    if (px < W - 1 && zh > zb[p + 1]) (zb[p + 1] = zh), (hb[p + 1] = -1);
    if (p >= W && zh > zb[p - W]) (zb[p - W] = zh), (hb[p - W] = -1);
    if (p < N - W && zh > zb[p + W]) (zb[p + W] = zh), (hb[p + W] = -1);
    if (Z <= zb[p]) return;
    zb[p] = Z;
    hb[p] = h;
    vb[p] = v;
  };

  // The strand of level K is one closed curve, s from 0 to 2 pi 2^K, over
  // the angle th = s mod 2 pi. It is plotted as a thin 8-connected line: a
  // pixel that only turns the corner between two diagonal neighbours is
  // dropped.
  let ap = -1, aZ = 0, ah = 0, av = 0, bp = -1, bZ = 0, bh = 0, bv = 0;
  const total = NT * M;
  for (let i = 0; i < total; i += step) {
    const j = i % NT;
    if (j === 0) {
      // Exact phases at the start of every turn, so rounding never builds up.
      const sv = (TAU * i) / NT;
      for (let m = 0; m < K; m++) (er[m] = cos(sv / (2 << m))), (ei[m] = sin(sv / (2 << m)));
    }
    let zr = 0, zi = 0;
    for (let m = 0; m < K; m++) {
      zr += amp[m] * er[m];
      zi += amp[m] * ei[m];
      const r2 = er[m] * sr[m] - ei[m] * si[m];
      ei[m] = er[m] * si[m] + ei[m] * sr[m];
      er[m] = r2;
    }
    const o = j * 6, cq = C[o + 4], sq = C[o + 5];
    const ur = zr * cq - zi * sq, ui = zr * sq + zi * cq;
    const x = C[o] + R * ur * C[o + 2], y = C[o + 1] + R * ur * C[o + 3], z = R * ui;
    const X = x * cp + z * sp, Z = -x * sp + z * cp;
    const f = F / (F - Z);
    const px = round(31.5 + X * f), py = round(63.5 - y * f);
    if (px < 0 || px >= W || py < 0 || py >= H) {
      if (ap >= 0) write(ap, aZ, ah, av);
      if (bp >= 0) write(bp, bZ, bh, bv);
      ap = bp = -1;
      continue;
    }
    const p = py * W + px;
    if (p === bp) {
      if (Z > bZ) bZ = Z;
      continue;
    }
    const sv = (TAU * i) / NT;
    const h = hue0 + 0.16 * cos(sv / 2) + 0.07 * cos(sv / 4);
    const v = cl((Z + Dm) / (2 * Dm), 0, 1);
    if (ap >= 0 && bp >= 0) {
      const ax = ap % W, ay = (ap / W) | 0, bx = bp % W, by = (bp / W) | 0;
      if (abs(ax - px) === 1 && abs(ay - py) === 1 && abs(bx - ax) + abs(by - ay) === 1 && abs(bx - px) + abs(by - py) === 1) {
        (bp = p), (bZ = Z), (bh = h), (bv = v);
        continue;
      }
    }
    if (ap >= 0) write(ap, aZ, ah, av);
    (ap = bp), (aZ = bZ), (ah = bh), (av = bv);
    (bp = p), (bZ = Z), (bh = h), (bv = v);
  }
  if (ap >= 0) write(ap, aZ, ah, av);
  if (bp >= 0) write(bp, bZ, bh, bv);

  const body = [0, 0, 0];
  hsv(0.68, 0.4, BODY, body, 0);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const h = hb[p];
      if (h >= 0) {
        // Near strands pale, far ones deep, all at full level.
        hsv(h, 0.95 - 0.5 * vb[p], 1, rgb, 0);
        display.setPixel(x, y, (255 * rgb[0]) | 0, (255 * rgb[1]) | 0, (255 * rgb[2]) | 0);
      } else if (h === -2) display.setPixel(x, y, (255 * body[0]) | 0, (255 * body[1]) | 0, (255 * body[2]) | 0);
      else display.setPixel(x, y, 0, 0, 0);
    }
}
