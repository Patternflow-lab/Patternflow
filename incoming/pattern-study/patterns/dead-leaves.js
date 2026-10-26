// ===== Patternflow pattern =====
// Title:   Dead Leaves
// Family:  noise
// Idea:    Flat discs with radii from half an LED to 20 LEDs come down one after another, each slipping in under the ones already there so it shows only in the gaps, until the last hole closes, a white ring runs out from it and the panel holds an exact sample of the scale-invariant dead leaves picture, where hue gives each leaf's size and every octave of size covers the same share.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: dead leaves model (Georges Matheron, 1968), scale invariant with radii by r^-3 (Ann Lee, David Mumford and Jinggang Huang, 2001), sampled exactly from below (Wilfrid Kendall and Elke Thönnes, 1999), pattern round 56
// Round:   56
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Grain=0.5..4, Law=-1..1
//
// Knob 1: Hue. Turns the size colours round the wheel together. At 0 leaves of radius half an LED are pink-magenta and each doubling of the radius steps 0.072 back round the wheel, through violet and blue to cyan at 16 to 20 LEDs; at 0.25 the small leaves are orange-red and the big ones violet, at 0.5 green down to red, at 0.75 blue down to lime. A leaf whose hue falls between orange and yellow takes only the two bright levels, so it never reads brown or olive.
// Knob 2: Speed. At 2 the leaves come down 3.2 deep a second, about 4,900 leaves a second at the opening Grain: the panel is 95% covered after 0.9 s and the last hole closes after 2.8 s (median of 40 samples, 2.3 to 3.2 s for the middle 80%), and the white ring runs out at 60 LEDs a second while the finished sample holds 2.2 s before the next one starts over it. At 0.2 everything is ten times slower, at 3 half as fast again.
// Knob 3: Grain. The smallest radius, 0.5 to 4 LEDs. At 0.5 a sample takes about 13,500 leaves and the five octaves of radius from half an LED to 16 each cover 19 to 20% of the panel; at 4 only the octaves from 4 up are left, 500 leaves make a sample, and the picture is big overlapping discs in blue and cyan.
// Knob 4: Law. The exponent a of the radius density r^-a, 3 + K4 outside a dead zone of 0.1 either side of 0, so the opening 0.06 is exactly 3, the law under which the picture looks the same at every scale. At -1 (a = 2) the big leaves take over: radii 8 to 16 cover 42% of the panel and those under 1 LED 2.5%. At 1 (a = 4) the smallest octave covers 51% and the panel turns to magenta grain.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, PI, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The largest leaf's radius in LEDs.
const RMAX = 20;
// Leaf depth per second at Speed 1: how many leaves, on average, have come
// down over any one LED. The uncovered share is e^-depth.
const RATE = 1.6;
// Seconds the finished sample holds at Speed 1, and how fast the ring runs
// out, in LEDs a second at Speed 1.
const HOLD = 4.4, RING = 30;
// Every leaf is one of four flat levels, 45 apart, and the holes show the
// sample before at one dim level, so two leaves side by side either match
// in level or differ by 45 or more.
const TIERS = [255, 210, 165, 120], GHOST = 60;
// Hue tells a leaf's size: the smallest, half an LED across in radius, are
// magenta at the opening, and each doubling of the radius steps OCT back
// round the wheel, through violet, blue and cyan to green at 20 LEDs. Each
// leaf strays a little either side, by up to JIT.
const H0 = 0.88, OCT = 0.072, JIT = 0.03;
// Dim orange and yellow read brown and olive: a leaf whose hue falls there
// takes one of the two bright tiers instead.
const warm = (h) => ((h = h - floor(h)), h > 0.03 && h < 0.22);

// hsv with an integer value v: the brightest channel is v exactly.
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = (v * (1 - s) + 0.5) | 0, q = (v * (1 - f * s) + 0.5) | 0, t = (v * (1 - (1 - f) * s) + 0.5) | 0;
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function sample() {
  return {
    id: new Int32Array(N).fill(-1), left: N, n: 0, depth: 0,
    cx: [], cy: [], r: [], hu: [], sa: [], lv: [],
  };
}

export function setup(params) {
  params.s = {
    cur: sample(), old: null, hue: 0, speed: 2, rmin: 0.5, alpha: 3,
    phase: 0, pt: 0, last: [32, 64], rgb: new Uint8Array(N * 3),
  };
}

// One radius from the density r^-alpha on [rmin, RMAX], by inverting its
// distribution function.
function radius(a, alpha) {
  const u = Math.random();
  if (abs(alpha - 1) < 1e-6) return a * (RMAX / a) ** u;
  const e = 1 - alpha, lo = a ** e, hi = RMAX ** e;
  return (lo + u * (hi - lo)) ** (1 / e);
}

// The leaves are a Poisson process of discs. Only those that reach the
// panel matter: a leaf of radius r reaches it when its centre lies in the
// panel grown by r on every side, so radii are drawn from r^-alpha times
// that box's area (by rejection) and the centre is uniform in the box. A
// leaf then adds pi r^2 / box to the mean depth over every LED.
function leaf(S, D) {
  const big = (W + 2 * RMAX) * (H + 2 * RMAX);
  let r, box;
  do {
    r = radius(S.rmin, S.alpha);
    box = (W + 2 * r) * (H + 2 * r);
  } while (Math.random() * big > box);
  const cx = -r + Math.random() * (W + 2 * r), cy = -r + Math.random() * (H + 2 * r);
  D.depth += (PI * r * r) / box;
  // Seen from below: the leaf shows only on LEDs no earlier leaf covers.
  const k = D.n++;
  D.cx.push(cx);
  D.cy.push(cy);
  D.r.push(r);
  D.hu.push(-OCT * Math.log2(r / 0.5) + (Math.random() - 0.5) * 2 * JIT);
  D.sa.push(0.55 + 0.35 * Math.random());
  D.lv.push(floor(Math.random() * TIERS.length));
  const x0 = max(0, ceil(cx - r - 0.5)), x1 = min(W - 1, floor(cx + r - 0.5));
  const y0 = max(0, ceil(cy - r - 0.5)), y1 = min(H - 1, floor(cy + r - 0.5));
  const r2 = r * r, id = D.id;
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const p = y * W + x;
      if (id[p] >= 0) continue;
      const dx = x + 0.5 - cx;
      if (dx * dx + dy * dy > r2) continue;
      id[p] = k;
      if (--D.left === 0) S.last = [x, y];
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0.5, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.rmin = cl(kv[2], 0.5, 4);
  // Law: a dead zone of 0.1 round the middle keeps the exponent at 3.
  const k4 = cl(kv[3], -1, 1), e = abs(k4) > 0.1 ? (Math.sign(k4) * (abs(k4) - 0.1)) / 0.9 : 0;
  S.alpha = 3 + e;
  const g = d * S.speed;
  if (S.phase === 1) {
    S.pt += g;
    if (S.pt > HOLD) {
      // The held sample sinks to one dim level and shows through the holes
      // of the next one until they close.
      S.old = S.cur;
      S.cur = sample();
      S.phase = 0;
    }
  }
  if (S.phase === 0) {
    const D = S.cur, goal = D.depth + g * RATE;
    while (D.left > 0 && D.depth < goal) leaf(S, D);
    if (D.left === 0) (S.phase = 1), (S.pt = 0);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, D = S.cur, O = S.old, hb = H0 + S.hue;
  const ring = S.phase === 1 ? S.pt * RING : -1, [lx, ly] = S.last;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const o = p * 3;
      let k = D.id[p], L = D;
      if (k < 0 && O) (L = O), (k = O.id[p]);
      if (k < 0) {
        rgb[o] = rgb[o + 1] = rgb[o + 2] = 0;
        continue;
      }
      const h = hb + L.hu[k], t = L.lv[k], v = L === D ? TIERS[warm(h) ? t & 1 : t] : GHOST;
      // Each leaf pales toward its centre, so a disc reads as a disc even
      // where only a sliver of it shows. Only the weaker channels change.
      const dx = x + 0.5 - L.cx[k], dy = y + 0.5 - L.cy[k], f = min(1, sqrt(dx * dx + dy * dy) / L.r[k]);
      hsv(h, L.sa[k] * (0.6 + 0.4 * f), v, rgb, o);
    }
  // The moment the last hole closes the sample is exact: a white ring runs
  // out from where that hole was.
  if (ring >= 0) {
    for (let y = 0, p = 0; y < H; y++)
      for (let x = 0; x < W; x++, p++) {
        const dd = sqrt((x - lx) ** 2 + (y - ly) ** 2);
        if (dd <= ring && dd > ring - 1.5) rgb[p * 3] = rgb[p * 3 + 1] = rgb[p * 3 + 2] = 255;
      }
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, rgb[o], rgb[o + 1], rgb[o + 2]);
}
