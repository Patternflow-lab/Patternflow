// ===== Patternflow pattern =====
// Title:   Penrose Diagram
// Family:  space
// Idea:    All of flat spacetime folded into one triangle the panel's exact shape, the worldline r = 0 up the left edge and light at 45 degrees, its curves of constant time and radius crowding into the corners at infinity, while a now surface climbs from past to future infinity, gold pulses leave r = 0 once a unit of time, and an observer accelerating away carries a mirror that sends back every pulse sent before t = 0, later and later, while every pulse sent after runs past its horizon to future null infinity.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: conformal compactification of Minkowski spacetime (Roger Penrose, 1963), Penrose-Carter diagrams (Brandon Carter, 1966), hyperbolic motion (Max Born, 1909), the horizon of the uniformly accelerated frame (Wolfgang Rindler, 1966), pattern round 60
// Round:   60
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Grid=0..2, Accel=-2..3
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the curves of constant time are blue, the curves of constant radius green, the pulses gold and the observer magenta; at 0.5 the time curves turn amber, the radius curves rose, the pulses blue and the observer green. The edges and the now surface stay white, the haze of curves along the null infinities slate, the region past the horizon a faint violet and the region behind the mirror a faint plum.
// Knob 2: Speed. How fast the now surface climbs. Its foot runs up the left edge at a constant pace on the panel, so t = tan(theta) in time: at 2 from i- to i+ in 6.3 s, then 0.7 s in which the pulses fade before the next climb; at 0.2 a climb takes 63 s, at 3 it takes 4.2 s. The first climb opens two ninths of the way up, at t = -1.2.
// Knob 3: Grid. The spacing of the grid curves and of the pulses, 2^-Grid: one unit of time and radius at 0, half a unit at 1, a quarter at 2. A pulse leaves r = 0 where a curve of constant time meets the left edge, leaving out any that would start within 4 LEDs of the last, so 11 pulses cross the panel at 0, 17 at 1 and 21 at 2.
// Knob 4: Accel. The observer's proper acceleration a = 2^(Accel - 1), from 1/8 to 4, opening at 0.52. Its worldline r^2 - t^2 = 1/a^2 crosses t = 0 at r = 1/a, 58 LEDs from the left edge at a = 1/8, 44 at the opening, 31.5 at a = 1, where it is the straight column R = pi/2, and 10 at a = 4. A pulse sent at t_k < 0 comes back to r = 0 at t = 1/(a^2 |t_k|): at the opening the one sent at t = -1 returns at 3.68 and the one at -9 at 0.41.

const W = 64, H = 128, N = W * H;
const { floor, round, atan, tan, sqrt, max, min, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The diagram. With u = t - r and v = t + r, U = atan u and V = atan v, the
// coordinates T = U + V and R = V - U fill the triangle R >= 0,
// |T| + R <= pi. One LED is pi/63 in both, so i+ sits on LED (0, 0), i0 on
// (63, 63) and i- on (0, 126): the triangle is the panel's 64 x 127 LEDs,
// and a light ray, T - R or T + R constant, is an exact LED diagonal.
// Future null infinity is the diagonal x = y, past null infinity
// x + y = 126, and the worldline r = 0 is column 0. Row 127 lies outside.
const K = PI / 63;
const IN = new Uint8Array(N), TT = new Float64Array(N), RR = new Float64Array(N);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const p = y * W + x, T = (63 - y) * K, R = x * K;
    if (x + Math.abs(63 - y) >= 63) continue;
    const u = tan((T - R) / 2), v = tan((T + R) / 2);
    IN[p] = 1;
    TT[p] = (u + v) / 2;
    RR[p] = (v - u) / 2;
  }
// An LED's four neighbours that are inside too, so a contour test reads
// only finite fields.
const NB = [];
for (let p = 0; p < N; p++) {
  const x = p & 63, y = p >> 6, l = [];
  if (IN[p]) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const q = p + dy * W + dx;
    if (x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H && IN[q]) l.push(q);
  }
  NB.push(l);
}

// A level curve f = c drawn as LEDs one wide: an LED on the high side with
// a neighbour on the low side. Where two or more curves pass between an
// LED and its neighbour, toward the corners and along the null
// infinities, the curves crowd closer than the LEDs and the LED is marked
// haze (val + 2) instead: drawn dim, as the infinitely many curves there.
function contour(F, step, off, out, val) {
  for (let p = 0; p < N; p++) {
    if (!IN[p]) continue;
    const f = floor((F[p] - off) / step);
    let lo = 0, g = 0;
    for (const q of NB[p]) {
      lo = max(lo, f - floor((F[q] - off) / step));
      g = max(g, Math.abs(F[p] - F[q]) / step);
    }
    if (g > HAZE) {
      if (out[p] === 0 || out[p] > 2) out[p] = val + 2;
    } else if (lo === 1) out[p] = val;
  }
}
const HAZE = 0.5;

// Map an event (t, r) to its LED.
function led(t, r) {
  const U = atan(t - r), V = atan(t + r);
  return [round((V - U) / K), round(63 - (U + V) / K)];
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, grid: -1, acc: 99, phase: 0.2, tn: -1e9,
    G: new Uint8Array(N), O: new Uint8Array(N), now: new Uint8Array(N), sim: new Uint8Array(N), F: new Float64Array(N), gO: new Float64Array(N), ox: 0, oy: 0,
    pulses: [], R: new Uint8Array(N), Gc: new Uint8Array(N), B: new Uint8Array(N), c: [0, 0, 0],
  };
}

// The grid: 1 marks a curve of constant t, 2 of constant r, 3 and 4 their
// haze, all at the spacing d, and a pulse at each t = k d.
function buildGrid(S, d) {
  S.G.fill(0);
  contour(RR, d, 0, S.G, 2);
  contour(TT, d, 0, S.G, 1);
  S.pulses = [];
  // Toward i+ and i- the rays crowd closer than an LED. Counting out from
  // t = 0 both ways, a pulse whose ray would start within 4 LEDs of the
  // last one kept is left out, so each ray drawn stands on its own.
  for (const dir of [1, -1]) {
    let last = 63;
    for (let k = dir > 0 ? 0 : -1; Math.abs(k) <= 400; k += dir) {
      const tk = k * d, c = round(63 - (2 * atan(tk)) / K);
      if (k !== 0 && Math.abs(c - last) < 4) continue;
      if (c < 2 || c > 124) break;
      S.pulses.push({ tk, c });
      last = c;
    }
  }
}

// The observer: r^2 - t^2 = 1/a^2, that is u v = -1/a^2, with u < 0. Read
// the triangle as the half x >= 0 of 1+1 Minkowski spacetime, x for r, and
// the observer, its mirror, its horizon u = 0 and its line of simultaneity
// are exact; read as the radial diagram of 3+1 spacetime, each LED is a
// sphere of radius r and each pulse a spherical shell. A pulse sent at
// t_k < 0 runs out along u = t_k, meets the observer at v = -1/(a^2 t_k)
// and comes back along that v; a pulse sent at t_k >= 0 never meets it.
// gO > 1 is the side of the worldline away from r = 0.
function buildObserver(S, a) {
  S.O.fill(0);
  const g = S.gO;
  for (let p = 0; p < N; p++) if (IN[p]) g[p] = a * a * (RR[p] * RR[p] - TT[p] * TT[p]);
  for (let p = 0; p < N; p++) {
    if (!IN[p] || g[p] < 1) continue;
    for (const q of NB[p])
      if (g[q] < 1) {
        S.O[p] = 1;
        break;
      }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const grid = cl(k[2], 0, 2), acc = cl(k[3], -2, 3);
  if (grid !== S.grid) {
    S.grid = grid;
    buildGrid(S, 2 ** -grid);
  }
  if (acc !== S.acc) {
    S.acc = acc;
    S.a = 2 ** (acc - 1);
    buildObserver(S, S.a);
  }
  // One cycle is 14/speed seconds: 90% climbing, 10% fading.
  S.phase += (d * S.speed) / 14;
  if (S.phase >= 1) S.phase -= 1;
  const climb = min(1, S.phase / 0.9);
  const th = cl(-PI / 2 + PI * climb, -PI / 2 + 1e-4, PI / 2 - 1e-4);
  S.tn = tan(th);
  S.fade = S.phase < 0.9 ? 1 : 1 - (S.phase - 0.9) / 0.1;
  S.now.fill(0);
  contour(TT, 1e9, S.tn, S.now, 1);
  // The observer's own now: its line of simultaneity at this event is
  // t = r tanh(eta), eta its rapidity, a line through the origin event
  // (0, 63) that runs to i0 and tips toward the horizon as eta grows.
  const ro = sqrt(1 / (S.a * S.a) + S.tn * S.tn), beta = S.tn / ro, F = S.F;
  for (let p = 0; p < N; p++) F[p] = IN[p] ? TT[p] - beta * RR[p] : 0;
  S.sim.fill(0);
  contour(F, 1e9, 0, S.sim, 1);
  [S.ox, S.oy] = led(S.tn, ro);
}

function put(S, p, h, s, v) {
  const c = S.c;
  hsv(h, s, v / 255, c);
  S.R[p] = round(c[0] * 255);
  S.Gc[p] = round(c[1] * 255);
  S.B[p] = round(c[2] * 255);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const hu = S.hue, G = S.G, O = S.O, tn = S.tn, f = S.fade, ox = S.ox, oy = S.oy;
  S.R.fill(0);
  S.Gc.fill(0);
  S.B.fill(0);
  for (let p = 0; p < N; p++) {
    if (!IN[p]) continue;
    const x = p & 63, y = p >> 6;
    // Above the horizon u = 0 lie the events the observer never sees, and
    // behind the mirror, r^2 - t^2 > 1/a^2, those no pulse reaches.
    if (x + y < 63) put(S, p, 0.78, 0.5, 34);
    else if (S.gO[p] > 1) put(S, p, 0.9, 0.55, 30);
    const g = G[p];
    if (g === 2) put(S, p, hu + 0.4, 0.8, 150);
    else if (g === 1) put(S, p, hu + 0.6, 0.7, 170);
    else if (g) put(S, p, 0.62, 0.35, 50);
    if (O[p]) put(S, p, hu + 0.86, 0.75, 230);
    else if (x + y === 63 && y >= 32 && (y & 1)) put(S, p, hu + 0.86, 0.6, 170);
  }
  // Pulses: each ray runs from (0, c) up the diagonal x + y = c, drawn as
  // far as the now surface has come. The observer carries a mirror: a
  // pulse sent before t = 0 meets it and comes back in along the diagonal
  // x - y = constant to r = 0, arriving at t = v = -1/(a^2 t_k), later the
  // closer t_k is to 0. A pulse sent after t = 0 never meets it and runs on
  // to future null infinity at x = c / 2.
  if (f > 0)
    for (const P of S.pulses) {
      if (P.tk > tn) continue;
      let head = -1, x = 0, y = P.c;
      for (; x <= 63; x++, y--) {
        const p = y * W + x;
        if (y < 0 || !IN[p] || TT[p] > tn || S.gO[p] >= 1) break;
        put(S, p, hu + 0.13, 0.85, 215 * f);
        head = p;
      }
      if (P.tk < 0 && x <= 63 && S.gO[y * W + x] >= 1 && TT[y * W + x] <= tn) {
        // The echo turns at the last LED before the mirror and runs back up
        // to r = 0.
        for (x -= 2; x >= 0; x--, y--) {
          const p = y * W + x;
          if (TT[p] > tn) break;
          put(S, p, hu + 0.11, 0.7, 215 * f);
          head = p;
        }
      }
      if (head >= 0 && f === 1) put(S, head, 0, 0, 255);
    }
  for (let p = 0; p < N; p++) if (S.now[p]) put(S, p, hu + 0.55, 0.12, 255);
  // The edges: the worldline r = 0 and the two null infinities.
  for (let y = 1; y < 126; y++) put(S, y * W, 0, 0, 190);
  for (let x = 1; x < 63; x++) {
    put(S, x * W + x, hu + 0.75, 0.55, 200);
    put(S, (126 - x) * W + x, hu + 0.75, 0.55, 200);
  }
  for (const p of [0, 63 * W + 63, 126 * W]) put(S, p, 0, 0, 255);
  if (f < 1) return out(display, S);
  // The observer's own now: its line of simultaneity.
  for (let p = 0; p < N; p++) if (S.sim[p] && !S.now[p]) put(S, p, hu + 0.86, 0.5, 230);
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = ox + dx, y = oy + dy;
    if (x >= 0 && x < W && y >= 0 && y < H) put(S, y * W + x, 0, 0, 255);
  }
  out(display, S);
}

function out(display, S) {
  for (let p = 0; p < N; p++) display.setPixel(p & 63, p >> 6, S.R[p], S.Gc[p], S.B[p]);
}
