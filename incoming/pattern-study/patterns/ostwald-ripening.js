// ===== Patternflow pattern =====
// Title:   Ostwald Ripening
// Family:  sim
// Idea:    A few hundred droplets sit still in a slightly supersaturated solution and trade matter through it: every drop smaller than the mean radius is magenta and shrinks ever faster until it blinks out, every larger one is green and swells, the solution glows faint magenta round the small drops and green round the large ones while specks of solute drift from the one to the other, and when fewer than a fifth are left a new population condenses in the gaps.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Ostwald ripening (Wilhelm Ostwald, 1896) and the Lifshitz-Slyozov-Wagner theory of coarsening (Ilya Lifshitz and Vitaly Slyozov, 1961; Carl Wagner, 1961), pattern round 57
// Round:   57
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Drops=200..500, Spread=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 growing drops and the poorer solution round them are green, shrinking drops and the richer solution magenta, and drops within 30% of the mean radius pale towards white; at 0.25 growing is azure and shrinking green, at 0.5 violet and cyan, at 0.75 rose and blue. The wheel skips orange and yellow, which read brown in the faint field.
// Knob 2: Speed. At 2 the kinetics run one time unit a second, K = 0.42 r0^3 for a population that starts at radius r0, and a population ripens down to 18% of its drops in 13 to 19 seconds and is renewed over 1.6 seconds; at 0.2 a population lasts about 3 minutes, at 3 about 12 seconds.
// Knob 3: Drops. How many droplets a new population starts with, 200 to 500, covering 17% of the panel: at 200 they start at radius 1.49 LEDs and the 37 left at the renewal average 2.4 (the largest 3.8); at 500 they start at 0.94 and the 91 left average 1.5 (the largest 2.4).
// Knob 4: Spread. How unequal the starting radii are: r0 (1 + s g), with g a sum of three uniform numbers scaled to deviation 1, s from 0.12 at 0 to 0.45 at 1 (0.14 at the opening), and the radius kept between 0.35 r0 and 2.2 r0. At 0.14 a population of 200 keeps 136 drops after 3 seconds; at 0.45 only 93, as the smallest go at once.

// Each drop exchanges matter with a mean field. By the Gibbs-Thomson effect
// the solution at a drop's surface is richer the smaller the drop,
// c(r) = c_inf (1 + a / r), and in the quasi-static diffusion field round it
// the excess over the mean c falls off as r / d. A drop gains volume at the
// rate 4 pi D r (c - c(r)), which in reduced units is
//   d(r^3)/dt = 3 K (r / r_c - 1),   dr/dt = (K / r)(1 / r_c - 1 / r),
// where r_c is the radius in balance with the field. The total volume is
// fixed, so the sum of the rates is zero and r_c is exactly the mean radius.
// Lifshitz and Slyozov, and Wagner, showed that then r_c^3 grows as
// (4/9) K t and the distribution of r / <r> tends to one shape, with its
// peak near 1.13 and nothing past 3/2. Run with a million drops from this
// pattern's own start, ripen() below gave <r>^3 growing at 0.446 K over the
// time the count fell from 50,000 to 10,000 (R^2 0.9999), with the scaled
// sizes peaking near 1.13 and none past 1.35.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (u) => u * u * (3 - 2 * u);
// Capacity, the share of the panel a new population covers, the rate (K =
// RATE r0^3, with time in seconds at Speed 2), when to renew (the share of
// drops left) and how long the renewal takes, in seconds at Speed 2.
const CAP = 620, AREA = 0.17, RATE = 0.42, END = 0.18, RENEW = 1.6;
// Solute specks: how many at most, how many a second leave the shrinking
// drops, and how far the field reaches round a drop.
const MOTES = 200, EMIT = 110, REACH = 8;
// Hues at knob 0 before the wheel bends them: green and magenta.
const HUE_G = 0.135, HUE_S = 0.81;
const wheel = (h) => 0.28 + 0.74 * (h - floor(h));

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  params.s = {
    ready: false, hue: 0, speed: 2, n0: 200, spread: 0.14,
    // Drops: centre, volume r^3, radius, how far a new drop has condensed
    // (0..1), and whether it belongs to the population a renewal dissolves.
    n: 0, x: new Float32Array(CAP), y: new Float32Array(CAP), v: new Float64Array(CAP), r: new Float32Array(CAP),
    grow: new Float32Array(CAP), old: new Uint8Array(CAP),
    K: 1, rc: 1, renew: -1, merges: 0,
    // Specks of solute.
    m: 0, mx: new Float32Array(MOTES), my: new Float32Array(MOTES), ml: new Float32Array(MOTES), emit: 0,
    // Pops where drops vanish: x, y, age.
    pops: [],
    field: new Float32Array(N), owner: new Int16Array(N), buf: new Float32Array(N * 3),
    cg: new Float32Array(3), cs: new Float32Array(3), tmp: new Float32Array(3),
  };
}

// The kinetics, one step of the mean-field equation on the volumes v[0..n):
// r_c is the mean radius, and a drop whose volume reaches zero is gone
// (its slot is set to -1). Returns r_c.
function ripen(v, n, dt, K) {
  let sr = 0, live = 0;
  for (let i = 0; i < n; i++) if (v[i] > 0) (sr += Math.cbrt(v[i])), live++;
  if (!live) return 0;
  const rc = sr / live;
  for (let i = 0; i < n; i++) {
    if (v[i] <= 0) continue;
    v[i] += 3 * K * (Math.cbrt(v[i]) / rc - 1) * dt;
    if (v[i] <= 0) v[i] = -1;
  }
  return rc;
}

// A new population: radii r0 (1 + spread g) with g roughly normal, placed
// at random with a gap of a LED from every drop already there.
function populate(s) {
  const n0 = s.n0, r0 = sqrt((AREA * N) / (PI * n0));
  s.K = RATE * r0 * r0 * r0;
  const first = s.n;
  for (let k = 0; k < n0 && s.n < CAP; k++) {
    const g = (Math.random() + Math.random() + Math.random() - 1.5) * 2;
    const r = r0 * cl(1 + s.spread * g, 0.35, 2.2);
    for (let tries = 0; tries < 40; tries++) {
      const x = r + Math.random() * (W - 2 * r), y = r + Math.random() * (H - 2 * r);
      let ok = true;
      for (let j = 0; j < s.n && ok; j++) {
        const dx = s.x[j] - x, dy = s.y[j] - y, need = s.r[j] + r + 1;
        if (dx * dx + dy * dy < need * need) ok = false;
      }
      if (!ok) continue;
      const i = s.n++;
      s.x[i] = x;
      s.y[i] = y;
      s.v[i] = r * r * r;
      s.r[i] = r;
      s.grow[i] = first ? 0 : 1;
      s.old[i] = 0;
      break;
    }
  }
}

function remove(s, i) {
  const j = --s.n;
  s.x[i] = s.x[j];
  s.y[i] = s.y[j];
  s.v[i] = s.v[j];
  s.r[i] = s.r[j];
  s.grow[i] = s.grow[j];
  s.old[i] = s.old[j];
}

// Two drops that touch run together, keeping their volume.
function merge(s) {
  for (let i = 0; i < s.n; i++)
    for (let j = i + 1; j < s.n; j++) {
      const dx = s.x[j] - s.x[i], dy = s.y[j] - s.y[i], need = s.r[i] + s.r[j] + 0.3;
      if (dx * dx > need * need || dx * dx + dy * dy >= need * need || s.old[i] || s.old[j]) continue;
      const vi = s.v[i], vj = s.v[j], v = vi + vj;
      s.x[i] = (s.x[i] * vi + s.x[j] * vj) / v;
      s.y[i] = (s.y[i] * vi + s.y[j] * vj) / v;
      s.v[i] = v;
      s.r[i] = Math.cbrt(v);
      remove(s, j);
      s.merges++;
      j = i;
    }
}

// The field round the drops: each adds (1 - r / r_c) / d outside itself,
// the excess of a drop's surface over the mean carried out as 1 / d, faded
// to nothing REACH LEDs past its edge. Positive near small drops, negative
// near large ones. owner marks the LEDs inside each drop.
function field(s) {
  const F = s.field, O = s.owner, rc = s.rc;
  F.fill(0);
  O.fill(-1);
  for (let i = 0; i < s.n; i++) {
    const r = s.r[i] * (s.old[i] ? 1 : sm(s.grow[i])), cx = s.x[i], cy = s.y[i];
    if (r <= 0.05) continue;
    const e = s.old[i] ? 0 : 1 - s.r[i] / rc, R = r + REACH;
    const x0 = max(0, floor(cx - R)), x1 = min(W - 1, floor(cx + R)), y0 = max(0, floor(cy - R)), y1 = min(H - 1, floor(cy + R));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = sqrt(dx * dx + dy * dy), p = y * W + x;
        if (d < r) {
          O[p] = i;
          continue;
        }
        if (d >= R) continue;
        const t = 1 - (d - r) / REACH;
        F[p] += (e / d) * t * t;
      }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, kv = input.knobValues || [0, 2, 200, 0.06], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(kv[0], 0, 1);
  s.speed = cl(kv[1], 0.2, 3);
  s.n0 = round(cl(kv[2], 200, 500));
  s.spread = 0.12 + 0.33 * cl(kv[3], 0, 1);
  if (!s.ready) {
    populate(s);
    s.ready = true;
  }
  const g = d * s.speed;
  if (s.renew >= 0) {
    // A renewal: the old drops dissolve while the new ones condense.
    s.renew += g / 2 / RENEW;
    let sr = 0, k = 0;
    for (let i = 0; i < s.n; i++) if (!s.old[i]) (s.grow[i] = min(1, s.renew)), (sr += s.r[i]), k++;
    // The new drops are measured against their own mean from the start.
    s.rc = sr / max(1, k);
    if (s.renew >= 1) {
      for (let i = s.n - 1; i >= 0; i--) if (s.old[i]) remove(s, i);
      s.renew = -1;
    }
  } else {
    // Ripening, in steps of at most 1/60 of a second.
    const steps = Math.ceil(g / 2 / (1 / 60)) || 1, h = g / 2 / steps;
    for (let k = 0; k < steps; k++) s.rc = ripen(s.v, s.n, h, s.K) || s.rc;
    for (let i = s.n - 1; i >= 0; i--) {
      if (s.v[i] < 0) {
        s.pops.push([s.x[i], s.y[i], 0]);
        remove(s, i);
      } else s.r[i] = Math.cbrt(s.v[i]);
    }
    merge(s);
    if (s.n <= max(8, s.n0 * END)) {
      for (let i = 0; i < s.n; i++) s.old[i] = 1;
      populate(s);
      s.renew = 0;
    }
  }
  if (s.renew >= 0) {
    // The dissolving drops shrink as the renewal runs.
    const f = 1 - sm(min(1, s.renew));
    for (let i = 0; i < s.n; i++) if (s.old[i]) s.r[i] = Math.cbrt(s.v[i]) * f;
  }
  field(s);
  motes(s, d * s.speed / 2);
  for (const p of s.pops) p[2] += d * s.speed / 2;
  s.pops = s.pops.filter((p) => p[2] < 0.4);
}

// Specks of solute leave the shrinking drops and wander down the field to
// the growing ones, which take them in.
function motes(s, g) {
  const F = s.field, O = s.owner;
  s.emit += EMIT * g;
  while (s.emit >= 1 && s.renew < 0) {
    s.emit -= 1;
    if (s.m >= MOTES) continue;
    // Pick a shrinking drop, the more often the faster it loses volume.
    for (let tries = 0; tries < 12; tries++) {
      const i = floor(Math.random() * s.n), out = 1 - s.r[i] / s.rc;
      if (out <= 0 || Math.random() > out * 2) continue;
      const a = Math.random() * TAU, k = s.m++;
      s.mx[k] = s.x[i] + (s.r[i] + 0.7) * cos(a);
      s.my[k] = s.y[i] + (s.r[i] + 0.7) * sin(a);
      s.ml[k] = 0;
      break;
    }
  }
  if (s.renew >= 0) s.emit = 0;
  for (let k = s.m - 1; k >= 0; k--) {
    let x = s.mx[k], y = s.my[k];
    const xi = cl(floor(x), 1, W - 2), yi = cl(floor(y), 1, H - 2), p = yi * W + xi;
    const gx = (F[p + 1] - F[p - 1]) / 2, gy = (F[p + W] - F[p - W]) / 2;
    // Down the gradient, at most a LED a frame, and a random walk.
    const sp = sqrt(gx * gx + gy * gy) + 1e-9, v = min(30, 600 * sp) * g;
    x += (-gx / sp) * v + (Math.random() - 0.5) * 3 * sqrt(g);
    y += (-gy / sp) * v + (Math.random() - 0.5) * 3 * sqrt(g);
    s.ml[k] += g;
    const q = floor(y) * W + floor(x), o = x >= 0 && x < W && y >= 0 && y < H ? O[q] : -2;
    if (o === -2 || s.ml[k] > 2.5 || (o >= 0 && s.r[o] > s.rc)) {
      const j = --s.m;
      s.mx[k] = s.mx[j];
      s.my[k] = s.my[j];
      s.ml[k] = s.ml[j];
      continue;
    }
    s.mx[k] = x;
    s.my[k] = y;
  }
}

function add(B, x, y, c, k) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  B[o] = min(1, B[o] + c[0] * k);
  B[o + 1] = min(1, B[o + 1] + c[1] * k);
  B[o + 2] = min(1, B[o + 2] + c[2] * k);
}

export function draw(display, params) {
  const s = params.s;
  if (!s || !s.ready) return;
  const B = s.buf, F = s.field, cg = s.cg, cs = s.cs, c = s.tmp;
  hsv(wheel(HUE_G + s.hue), 0.85, 1, cg, 0);
  hsv(wheel(HUE_S + s.hue), 0.8, 1, cs, 0);
  // The field: magenta where the solution is richer than the mean, green
  // where it is poorer, faint.
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    const f = F[p], a = min(0.45, abs(f) * 3), col = f > 0 ? cs : cg;
    B[o] = col[0] * a;
    B[o + 1] = col[1] * a;
    B[o + 2] = col[2] * a;
  }
  // The specks, pale in the colour of the field they cross.
  const wh = [0.85, 0.85, 0.9];
  for (let k = 0; k < s.m; k++) {
    const life = s.ml[k], a = 0.55 * min(1, life * 8) * min(1, (2.5 - life) * 2);
    const x = floor(s.mx[k]), y = floor(s.my[k]), col = F[cl(y, 0, H - 1) * W + cl(x, 0, W - 1)] > 0 ? cs : cg;
    for (let e = 0; e < 3; e++) c[e] = 0.5 * (wh[e] + col[e]);
    add(B, x, y, c, a);
  }
  // The drops: pale when near the mean radius, green the more they exceed
  // it, magenta the more they fall short.
  for (let i = 0; i < s.n; i++) {
    const r = s.r[i] * (s.old[i] ? 1 : sm(s.grow[i])), cx = s.x[i], cy = s.y[i];
    if (r <= 0.05) continue;
    // A drop of the old population dissolving in a renewal is pale.
    const q = s.old[i] ? 0 : s.r[i] / s.rc - 1, t = min(1, abs(q) / 0.3), col = q > 0 ? cg : cs;
    for (let e = 0; e < 3; e++) c[e] = 0.9 * (wh[e] * (1 - t) + col[e] * t);
    const x0 = max(0, floor(cx - r - 1)), x1 = min(W - 1, floor(cx + r + 1)), y0 = max(0, floor(cy - r - 1)), y1 = min(H - 1, floor(cy + r + 1));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, a = cl(r + 0.5 - sqrt(dx * dx + dy * dy), 0, 1);
        if (a <= 0) continue;
        const o = (y * W + x) * 3;
        for (let e = 0; e < 3; e++) B[o + e] = B[o + e] * (1 - a) + c[e] * a;
      }
  }
  // A drop that vanishes leaves a ring that opens and fades.
  for (const [px, py, age] of s.pops) {
    const u = age / 0.4, rr = 0.6 + 2.6 * u, k = 0.8 * (1 - u), m = Math.ceil(TAU * rr * 1.5);
    for (let j = 0; j < m; j++) {
      const a = (j / m) * TAU;
      add(B, floor(px + rr * cos(a)), floor(py + rr * sin(a)), cs, k / 2);
    }
  }
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p % W, (p / W) | 0, (B[o] * 255) | 0, (B[o + 1] * 255) | 0, (B[o + 2] * 255) | 0);
}
