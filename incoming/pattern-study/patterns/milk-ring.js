// ===== Patternflow pattern =====
// Title:   Milk Ring
// Family:  cosmetic
// Idea:    Drops of milky cream fall one at a time through the surface of a tall glass of tinted serum, each rolls up into a vortex ring with a bright rim that sinks, slows and swells until its rim breaks into a few smaller drops, and each of those rolls up into a smaller ring and sinks further, so a branching tree of rings hangs down the panel on thin cream threads.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 38, after drops of cream let fall into clear serum, the vortex rings they form and the cascade in which each ring breaks into smaller rings (J. J. Thomson and H. F. Newall, 1885)
// Round:   38
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Drops=3..6, Gel=1..5
//
// Knob 1: Hue. Turns the serum round the whole wheel; the cream stays milk white, tinted with the serum where it is thin. At 0 rose, at 0.05 crimson, 0.1 coral, 0.15 apricot, 0.2 butter, 0.25 pale lime, 0.35 green, 0.5 teal, 0.6 sky blue, 0.75 indigo, 0.85 violet. From 0.03 to 0.37 the bottom of the glass is lifted up to 2.1 times and paled a little, so orange and yellow serum never reads brown or olive.
// Knob 2: Speed. At 2 a drop falls every 7 s; its ring reaches its first break 3.2 s after it goes in, the second 2.8 s later, and the last rings melt into the serum 4 to 7 s after that, so two trees always share the glass. At 0.2 all of it ten times slower, at 3 one and a half times faster.
// Knob 3: Drops. How many drops each ring breaks into, spaced evenly round its rim and thrown a little outward. At 3 a tree of 1, 3 and 9 rings, at most 13 in the glass; at 6 1, 6 and 36, up to 43, and the bottom third fills with small rings. At Gel 1 the first ring swells from 2.4 to 9 LEDs across its radius, an ellipse 18 wide and 7 tall, and breaks about row 47; its rings swell to 4.6 and break about row 76; the last swell to 2.6 and are gone by about row 117.
// Knob 4: Gel. How thick the serum is. At 1 the threads fade with a time constant of 4 s. Turned up, everything runs slower, 2.6 times at 5; the rings stay smaller, 0.72 of their size at 5, so the tree is narrower; and the threads hold longer, about 50 s at 5, so the threads of the last three drops hang together as a curtain.
// Buttons: K1 tap lets a drop fall now; the next comes 7 s after it at Speed 2.

const W = 64, H = 128, N = W * H;
// The serum's surface, rows above it are the air the drop falls through.
const SURF = 5;
// Seen from a little above: a ring of radius R is an ellipse R wide and
// R * TILT tall, its near half lower on the panel.
const TILT = 0.4;
// Per generation: starting radius, the radius it swells to, starting sink
// speed in LEDs a second, how long it sinks before its rim breaks.
const GEN = [
  { r0: 2.4, r1: 10, v0: 24, brk: 3.2 },
  { r0: 1.4, r1: 5.2, v0: 18, brk: 2.8 },
  { r0: 0.9, r1: 2.8, v0: 14, brk: 99 },
];
// Every sink speed falls toward VS with time constant TV; radii swell with TR.
const VS = 3.2, TV = 1.3, TR = 1.6;
// Seconds between drops at Speed 2 and Gel 1, and the run before the first frame.
const PERIOD = 7, PREROLL = 9;
// Opening hue: rose.
const H0 = 0.93;
const { floor, min, max, abs, sqrt, exp, sin, cos, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, n: 3, gel: 1, begun: false, t: 0, next: 0, tk: 1,
    rings: [], falling: [], ripples: [],
    D: new Float32Array(N), F: new Float32Array(N), T: new Float32Array(N), G: new Float32Array(N), tmp: new Float32Array(N),
    deep: [0, 0, 0], light: [0, 0, 0], cream: [0, 0, 0],
  };
}

// Soft dot of cream into a field, a Gaussian of width s.
function splat(A, x, y, s, w) {
  const r = Math.ceil(2.2 * s), xi = round(x), yi = round(y), k = -0.5 / (s * s);
  for (let j = max(0, yi - r); j <= min(H - 1, yi + r); j++) {
    const dy = j - y, ey = dy * dy;
    for (let i = max(0, xi - r); i <= min(W - 1, xi + r); i++) {
      const dx = i - x;
      A[j * W + i] += w * exp((dx * dx + ey) * k);
    }
  }
}

// A thin thread point, bilinear into the trail.
function dab(T, x, y, w) {
  const i = floor(x), j = floor(y), fx = x - i, fy = y - j;
  for (let b = 0; b < 2; b++)
    for (let a = 0; a < 2; a++) {
      const xx = i + a, yy = j + b;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      T[yy * W + xx] += w * (a ? fx : 1 - fx) * (b ? fy : 1 - fy);
    }
}

function newRing(S, g, x, y, z, vx, vz) {
  const G0 = GEN[g];
  S.rings.push({ g, x, y, z, vx, vz, age: 0, R: G0.r0, amp: 1, broken: false, spin: random() * 2 * PI, v0: G0.v0 * (0.85 + 0.3 * random()) });
}

function drop(S) {
  S.falling.push({ x: 18 + random() * 28, y: -4, z: (random() - 0.5) * 6 });
}

// Sim time, in seconds at Speed 2 and Gel 1; the gel stretches it.
function step(S, dt) {
  // A thicker gel slows everything, keeps the rings smaller and holds the
  // threads longer.
  const ts = S.gel ** 0.6, d = dt / ts, rs = S.gel ** -0.2;
  S.t += d;
  if (S.t >= S.next) {
    drop(S);
    S.next = S.t + PERIOD;
  }
  // The drop falls through the air and goes in at the surface.
  for (let i = S.falling.length - 1; i >= 0; i--) {
    const f = S.falling[i];
    f.y += 34 * d;
    if (f.y >= SURF + 1) {
      newRing(S, 0, f.x, SURF + 2.5, f.z, 0, 0);
      S.ripples.push({ x: f.x, age: 0 });
      S.falling.splice(i, 1);
    }
  }
  for (const rp of S.ripples) rp.age += d;
  S.ripples = S.ripples.filter((rp) => rp.age < 3);
  const T = S.T, born = [];
  for (const r of S.rings) {
    const G0 = GEN[r.g];
    r.age += d;
    r.R = (G0.r0 + (G0.r1 - G0.r0) * (1 - exp(-r.age / TR))) * rs;
    const vy = r.v0 * exp(-r.age / TV) + VS, k = exp(-d / 0.8);
    const x0 = r.x, y0 = r.y + r.z * TILT;
    r.y += vy * d;
    r.x += r.vx * d;
    r.z += r.vz * d;
    r.vx *= k;
    r.vz *= k;
    // The thread: the ring leaves cream behind it, the same for every LED
    // of the way it goes.
    const y1 = r.y + r.z * TILT, len = sqrt((r.x - x0) ** 2 + (y1 - y0) ** 2);
    dab(T, r.x, y1, (r.g === 0 ? 0.75 : 0.55) * len * r.amp);
    if (!r.broken && r.age > G0.brk) {
      // The rim breaks into n drops round the ring, each thrown a little
      // outward and down, and the ring itself is spent into them.
      r.broken = true;
      const n = S.n, ph = r.spin;
      for (let j = 0; j < n; j++) {
        const a = ph + (2 * PI * j) / n, c = cos(a), s = sin(a);
        born.push([r.g + 1, r.x + r.R * c, r.y + 0.5, r.z + r.R * s, 7 * c, 7 * s]);
      }
    }
    if (r.broken) r.amp -= d / 0.7;
    // The last generation dissolves into the serum after 4 s.
    if (r.g === GEN.length - 1 && r.age > 4) r.amp -= d / 3;
  }
  for (const b of born) newRing(S, b[0], b[1], b[2], b[3], b[4], b[5]);
  S.rings = S.rings.filter((r) => r.amp > 0.01 && r.y < H + 12);
  // Threads fade, the fade gathered up and laid on every few frames.
  S.tk *= exp(-d / (4 * S.gel));
  if (S.tk < 0.98) {
    for (let p = 0; p < N; p++) T[p] *= S.tk;
    S.tk = 1;
  }
}

// Draw every ring into the cream field.
function render(S) {
  const D = S.D, F = S.F;
  D.fill(0);
  F.fill(0);
  for (const r of S.rings) {
    const form = cl(r.age / 0.6, 0, 1), R = r.R, amp = r.amp;
    const cy = r.y + r.z * TILT;
    // A fresh drop is a round blob that opens into the ring.
    if (form < 1) splat(D, r.x, cy, 0.55 * R + 0.5, 1.3 * (1 - form) * amp);
    // The ring: its core is an eighth of its radius thick, at least 0.55
    // LED, laid as dots along it so that a line of them peaks at the weight.
    const core = max(0.55, 0.12 * R), m = max(10, round(2 * PI * R * 1.6)), ds = (2 * PI * R) / m;
    for (let j = 0; j < m; j++) {
      const a = (2 * PI * j) / m, c = cos(a), s = sin(a);
      // The near half (s > 0) lower on the panel and brighter than the far
      // half seen through the ring.
      const w = (0.85 + 0.45 * s) * form * amp * (ds / (core * 2.5066));
      splat(D, r.x + R * c, cy + R * s * TILT, core, w);
    }
    // The bell of milky serum the ring carries above it.
    splat(F, r.x, cy - 0.45 * R, 0.6 * R + 0.5, 0.4 * form * amp);
  }
  for (const f of S.falling) {
    splat(D, f.x, f.y, 1.1, 1.4);
    splat(D, f.x, f.y - 1.6, 0.7, 0.5);
  }
}

// Box blur of radius r, horizontal then vertical, A into B.
function blur(A, B, tmp, r) {
  const k = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += A[y * W + cl(x + i, 0, W - 1)];
      tmp[y * W + x] = s * k;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += tmp[cl(y + i, 0, H - 1) * W + x];
      B[y * W + x] = s * k;
    }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.n = round(cl(k[2], 3, 6));
  S.gel = cl(k[3], 1, 5);
  if (!S.begun) {
    // The gel stretches the run before as it stretches everything.
    const n = round(PREROLL * 30 * S.gel ** 0.6);
    for (let i = 0; i < n; i++) step(S, 1 / 30);
    S.begun = true;
  }
  if (input.btnPressed && input.btnPressed[0]) {
    drop(S);
    S.next = S.t + PERIOD;
  }
  step(S, (d * S.speed) / 2);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  render(S);
  const { D, F, T, G, tmp, deep, light, cream } = S;
  blur(D, G, tmp, 2);
  const h = S.hue + H0, hh = h - floor(h);
  // Orange, yellow and lime serum goes brown or olive when deep: there it
  // is lifted, so the bottom of the glass is as bright as the top elsewhere.
  const warm = cl(1.3 - abs(hh - 0.13) / 0.13, 0, 1);
  hsv(h, 0.7 - 0.2 * warm, 0.3 + 0.34 * warm, deep);
  hsv(h + 0.03, 0.5 - 0.1 * warm, 0.62 + 0.14 * warm, light);
  hsv(h + 0.02, 0.4, 1, cream);
  const t = S.t;
  for (let y = 0; y < H; y++) {
    const u = y / (H - 1), lg = (1 - u) ** 1.6;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, vig = 0.8 + 0.2 * sin((PI * (x + 0.5)) / W);
      // The serum: light from above, and a slow shimmer of caustics.
      const sh = 0.07 * sin(x * 0.31 + y * 0.07 + t * 0.6 + 1.7 * sin(x * 0.11 - y * 0.05 - t * 0.4)) * lg;
      let r = deep[0] + (light[0] - deep[0]) * lg, g = deep[1] + (light[1] - deep[1]) * lg, b = deep[2] + (light[2] - deep[2]) * lg;
      r *= (1 + sh) * vig;
      g *= (1 + sh) * vig;
      b *= (1 + sh) * vig;
      if (y < SURF) {
        r *= 0.25;
        g *= 0.25;
        b *= 0.25;
      }
      // Cream: the rings, a soft glow round them, the bell and the threads,
      // tinted where it is thin and white where it is thick.
      const C = D[p] + 0.5 * G[p] + F[p] + T[p];
      const c = 1 - exp(-1.2 * C), wh = c * sqrt(c);
      const cr = cream[0] + (1 - cream[0]) * wh, cg = cream[1] + (1 - cream[1]) * wh, cb = cream[2] + (1 - cream[2]) * wh;
      r = r * (1 - 0.85 * c) + cr * c;
      g = g * (1 - 0.85 * c) + cg * c;
      b = b * (1 - 0.85 * c) + cb * c;
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, b)));
    }
  }
  // The surface: a bright line, rippled where a drop went in.
  for (let x = 0; x < W; x++) {
    let off = 0;
    for (const rp of S.ripples) {
      const dx = abs(x - rp.x), front = rp.age * 14;
      off += 1.2 * exp(-rp.age / 0.8) * sin(dx * 0.9 - rp.age * 12) * exp(-((dx - front) ** 2) / 30);
    }
    const y = cl(round(SURF + off), 0, H - 1);
    display.setPixel(x, y, round(255 * min(1, light[0] * 0.5 + 0.5)), round(255 * min(1, light[1] * 0.5 + 0.5)), round(255 * min(1, light[2] * 0.5 + 0.5)));
  }
}
