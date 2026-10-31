// ===== Patternflow pattern =====
// Title:   Fork Hologram
// Family:  wave
// Idea:    DRAFT
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: DRAFT; pattern round 82
// Round:   82
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Charge=3..7, Carrier=0..1
//
// Knob 1: Hue. DRAFT
// Knob 2: Speed. DRAFT
// Knob 3: Charge. DRAFT
// Knob 4: Carrier. DRAFT

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, atan2, exp, pow, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Pairs kept on the panel, the box the vortices may wander in (a margin
// past every edge), the carrier tilt, the gain that flattens the fringe tops.
const PAIRS = 5, MARGIN = 6, KY = 0.04, BEND = 0.6, P0 = 3.0;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

function vortex(x, y, l, vx, vy) {
  return { x, y, l, vx, vy, wx: 0, wy: 0, kick: 1, age: 0 };
}

function charge(top) {
  // Half the pairs carry the top charge, the rest anything from 1 up.
  return Math.random() < 0.5 ? top : 1 + floor(Math.random() * top);
}

function birth(S, x, y, top) {
  const l = charge(top), a = Math.random() * TAU, v = 7;
  S.v.push(vortex(x + cos(a) * 0.4, y + sin(a) * 0.4, l, cos(a) * v, sin(a) * v));
  S.v.push(vortex(x - cos(a) * 0.4, y - sin(a) * 0.4, -l, -cos(a) * v, -sin(a) * v));
}

function seed(S, top) {
  S.v = [];
  for (let i = 0; i < PAIRS; i++) {
    const l = charge(top);
    S.v.push(vortex(6 + Math.random() * 52, 6 + Math.random() * 116, l, 0, 0));
    S.v.push(vortex(6 + Math.random() * 52, 6 + Math.random() * 116, -l, 0, 0));
  }
  for (const p of S.v) p.kick = 0;
}

export function setup(params) {
  params.s = { v: null, t: 0, hue: 0, top: 3, f: 0.31, wait: 0, slide: 0 };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.top = round(cl(k[2] == null ? 3 : k[2], 3, 7));
  S.f = 1 / (P0 * pow(2, 1.6 * cl(k[3] == null ? 0.06 : k[3], 0, 1)));
  if (!S.v) seed(S, S.top);
  const h = (d * speed) / 2;
  S.t += h;
  S.slide += h * 0.12;
  const V = S.v;
  // Overdamped motion: opposite charges pull together, like charges push
  // apart, both as 1/r, and every vortex wanders on a slow random heading.
  for (const p of V) {
    let fx = 0, fy = 0;
    for (const q of V) {
      if (q === p) continue;
      const dx = p.x - q.x, dy = p.y - q.y, r2 = dx * dx + dy * dy + 4;
      const s = Math.sign(p.l * q.l) * sqrt(abs(p.l * q.l));
      fx += (s * dx) / r2;
      fy += (s * dy) / r2;
    }
    p.wx += (Math.random() - 0.5) * 6 * h - p.wx * 0.4 * h;
    p.wy += (Math.random() - 0.5) * 6 * h - p.wy * 0.4 * h;
    p.kick *= exp(-h * 1.6);
    const ux = 9 * fx + p.wx + p.vx * p.kick, uy = 9 * fy + p.wy + p.vy * p.kick;
    const sp = sqrt(ux * ux + uy * uy), cap = 9 / max(9, sp);
    p.x += ux * cap * h;
    p.y += uy * cap * h;
    if (p.x < -MARGIN) { p.x = -MARGIN; p.wx = abs(p.wx); }
    if (p.x > W + MARGIN) { p.x = W + MARGIN; p.wx = -abs(p.wx); }
    if (p.y < -MARGIN) { p.y = -MARGIN; p.wy = abs(p.wy); }
    if (p.y > H + MARGIN) { p.y = H + MARGIN; p.wy = -abs(p.wy); }
    p.age += h;
  }
  // Opposite charges that meet add up: equal ones annihilate, unequal ones
  // leave one vortex with the difference.
  for (let i = 0; i < V.length; i++)
    for (let j = i + 1; j < V.length; j++) {
      const a = V[i], b = V[j];
      if (a.l * b.l >= 0) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx * dx + dy * dy > 1.2) continue;
      const l = a.l + b.l;
      if (l === 0) {
        V.splice(j, 1);
        V.splice(i, 1);
      } else {
        const keep = abs(a.l) > abs(b.l) ? a : b;
        keep.l = l;
        V.splice(keep === a ? j : i, 1);
      }
      i = -1;
      break;
    }
  // A vortex of charge 2 or more is unstable and now and then sheds a unit one.
  for (let i = V.length - 1; i >= 0; i--) {
    const p = V[i];
    if (abs(p.l) > 1 && p.age > 2 && Math.random() < h * 0.08 * (abs(p.l) - 1)) {
      const s = Math.sign(p.l), a = Math.random() * TAU;
      p.l -= s;
      p.age = 0;
      const q = vortex(p.x, p.y, s, cos(a) * 6, sin(a) * 6);
      p.vx = -cos(a) * 6 / abs(p.l);
      p.vy = -sin(a) * 6 / abs(p.l);
      p.kick = 1;
      V.push(q);
    }
  }
  // New pairs are born out of nothing, a pair at a time.
  S.wait -= h;
  if (V.length < 2 * PAIRS && S.wait <= 0) {
    birth(S, 8 + Math.random() * 48, 10 + Math.random() * 108, S.top);
    S.wait = 0.6 + Math.random() * 1.2;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.v) return;
  const V = S.v, n = V.length, f = S.f;
  const ky = KY * f * 3.2, kx = sqrt(f * f - ky * ky), k0 = f;
  const base = S.hue + 0.5;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // The vortex phases multiplied as unit complex numbers, one atan2 at the end.
      let re = 1, im = 0, gx = kx, gy = ky, c = 1;
      for (let j = 0; j < n; j++) {
        const p = V[j], dx = x - p.x, dy = y - p.y, r2 = dx * dx + dy * dy + 1e-6, ir = 1 / sqrt(r2);
        const ux = dx * ir, uy = (p.l > 0 ? dy : -dy) * ir;
        for (let m = abs(p.l); m > 0; m--) {
          const t = re * ux - im * uy;
          im = re * uy + im * ux;
          re = t;
        }
        const w = p.l / (TAU * r2);
        gx -= dy * w;
        gy += dx * w;
        const r0 = 1.1 * abs(p.l);
        c *= r2 / (r2 + r0);
      }
      let u = kx * x + ky * y + S.slide + atan2(im, re) / TAU;
      u -= floor(u);
      const tri = 1 - abs(2 * u - 1);
      const v = 0.5 + (tri - BEND * sin(TAU * tri) / TAU - 0.5) * c;
      const g = sqrt(gx * gx + gy * gy) / k0 - 1;
      const hue = base + 0.14 * (g / (1 + abs(g)));
      const rgb = hsv(hue, 0.55 - 0.2 * (1 - c), v);
      display.setPixel(x, y, round(rgb[0] * 255), round(rgb[1] * 255), round(rgb[2] * 255));
    }
  }
}
