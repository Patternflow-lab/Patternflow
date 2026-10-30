// ===== Patternflow pattern =====
// Title:   Sitnikov Problem
// Family:  space
// Idea:    Two equal stars swing round each other on ellipses in a plane seen edge-on across the middle of the panel, and 64 massless bodies on the axis through their centre, each drawn in a column of its own, are thrown up together at speeds a hair apart, so they rise and fall through the plane as one smooth wave that bends and then tears into scattered points, each colouring the plane under it with the number of whole turns the stars made between its last two crossings, Moser's symbol, until the next wave goes up; on circles the wave only winds into more crests and never tears.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Sitnikov problem (Kirill Sitnikov, 1960), its symbolic dynamics (Jürgen Moser, Stable and Random Motions in Dynamical Systems, 1973), pattern round 77
// Round:   77
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Ellipse=-1..1, Spread=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 a body that has not yet come back to the plane is cyan, and one whose last half swing took s whole turns of the stars is azure for 0, violet for 1, pink for 2, rose for 3, orange for 4 and lime for 5; at 0.5 the wave goes up red and the symbols run orange, lime and green.
// Knob 2: Speed. Time runs at 2 units a second for each unit of the knob, so at 2 the stars go round once in 1.57 seconds (their period is 2 pi), at 0.2 once in 15.7 seconds and at 3 once in 1.05 seconds.
// Knob 3: Ellipse. The eccentricity e of the stars' orbit, 0.3 (1 + Ellipse): 0 at -1, 0.3 at the opening 0, 0.6 at 1. At 0.3 each star swings between 0.35 and 0.65 from the centre, and a quarter of the opening wave has torn 4.7 seconds after it goes up, half of it by 8.4. At e = 0.15 a quarter has torn by 11.7 seconds and half by 15.7; at 0.6 by 6.4 and 7.8. At e = 0 the wave only winds into more and more crests and never tears in its 20 seconds, and each body's energy holds to 8 decimals.
// Knob 4: Spread. How far apart the 64 launch speeds are, 0.005 to 0.305 of the escape speed 2, centred on 0.86 of it. At the opening 0.06 the speeds run from 1.697 to 1.743, so the wave goes up nearly flat. At 1 they run from 1.415 to 2.025 and the wave is steep from the start: its slow left end keeps a smooth arc, and its right end, at the escape speed and past it, runs off the top and is sent up again and again.
// Buttons: K1 tap sends up a new wave the next time the stars are at r = 1/2, within one turn. A new wave also goes up by itself every 80 units of time (about 13 turns, 20 seconds at the opening Speed) and when Ellipse or Spread has rested 0.3 seconds at a new value.

// Two stars of mass 1/2 each move on Kepler ellipses of eccentricity e about
// their centre of mass, with G = 1, the semi-major axis of their relative
// orbit 1 and so a period of 2 pi. Each is r(t) = (1 - e cos E) / 2 from the
// centre, where E - e sin E = t (Kepler's equation, solved by Newton's
// method each step). A third body of no mass on the line through the centre
// at right angles to the plane feels both stars at the distance
// sqrt(z^2 + r^2), and their pulls along the line add up to
//
//   z'' = -z / (z^2 + r(t)^2)^(3/2).
//
// Kirill Sitnikov used this set-up in 1960 to show that the three-body
// problem has oscillatory motions, swings that go out further and further
// and still come back. For e = 0, r = 1/2 is fixed, the energy
// v^2 / 2 - 1 / sqrt(z^2 + 1/4) is conserved and every bounded body swings
// periodically, the period growing with the amplitude. For e > 0 the pull
// beats with the stars and energy changes at every pass through the plane.
// Jürgen Moser (1973) counted s_k, the whole turns of the stars between the
// k-th and (k+1)-th time a body crosses the plane, and showed that for
// small e > 0 there is a whole number m such that every sequence of
// s_k >= m, chosen like coin tosses, is the record of some orbit: the motion
// is as random as any sequence of symbols.
//
// The picture: 64 bodies, one in each column, leave the plane together at
// the moment the stars are r = 1/2 apart, so a launch speed of 2 is the
// escape speed whatever e is. Their speeds rise from left to right by equal
// steps, so they start as one curve. Height on the panel is
// 62 tanh(z / 2.2) rows from the middle, so a body far out still shows near
// the edge. A body is a small cross with a glow; neighbours within 4 rows of
// each other are joined, and the joined curve leaves a fading trail, so a
// body that has fallen out of step with both neighbours is a lone point. Its
// colour is its last symbol s, and the plane edge-on, rows 63 and 64, shows
// under each column the last symbol written there, flashing as it is
// written. The two stars are drawn at their positions seen from the side,
// 34 LEDs to a unit, the nearer one larger. A body moving out past z = 5
// with positive energy has escaped and is sent up again from the plane.
// RK4 takes steps of at most 0.03 r^(3/2), 0.01 at e = 0, so a body still
// gets several steps across the plane at the stars' closest approach.

const W = 64, H = 128, N = W * H, MID = 63.5, NB = 64;
const { floor, ceil, min, max, abs, sqrt, sin, cos, round, PI, atan2, tanh } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const P = { F0: 0.86, RATE: 2, CYCLE: 80, DECAY: 0.76, ZS: 2.2, ZOUT: 5, LINK: 4, BR: 1.8 };

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// Eccentric anomaly of the primaries at time t: E - e sin E = t.
function anomaly(t, e) {
  const M = t - TAU * floor(t / TAU);
  let E = M + (sin(M) >= 0 ? 0.85 : -0.85) * e;
  for (let k = 0; k < 8; k++) E -= (E - e * sin(E) - M) / (1 - e * cos(E));
  return E;
}
const radius = (t, e) => (1 - e * cos(anomaly(t, e))) / 2;

export function setup(params) {
  params.s = {
    t: 0, since: 0, e: 0.3, sp: 0.023, hue: 0, speed: 2, pending: false,
    z: new Float64Array(NB), v: new Float64Array(NB), f: new Float64Array(NB),
    tc: new Float64Array(NB), sym: new Int8Array(NB),
    yy: new Float64Array(NB),
    acc: new Float32Array(N * 3), c: [0, 0, 0], want: [0.3, 0.023], rest: 0,
    flash: new Float32Array(NB), btn: false,
  };
  const S = params.s;
  S.t = PI / 2 - S.e;
  launch(S);
}

// The wave leaves the plane when the primaries are half their mean
// distance apart, r = 1/2, so the launch speed 2f is f of the escape speed
// whatever e is.
function launch(S) {
  for (let i = 0; i < NB; i++) {
    S.f[i] = P.F0 + S.sp * (i / (NB - 1) - 0.5);
    S.z[i] = 0;
    S.v[i] = 2 * S.f[i];
    S.tc[i] = S.t;
    S.sym[i] = -1;
  }
  S.since = 0;
  S.pending = false;
}

function relaunchOne(S, i) {
  S.z[i] = 0;
  S.v[i] = 2 * S.f[i];
  S.tc[i] = S.t;
  S.sym[i] = -1;
}

const acc = (z, r) => -z / ((z * z + r * r) * sqrt(z * z + r * r));

function step(S, h) {
  const e = S.e, t = S.t, r0 = radius(t, e), r1 = radius(t + h / 2, e), r2 = radius(t + h, e);
  const z = S.z, v = S.v;
  for (let i = 0; i < NB; i++) {
    const Z = z[i], V = v[i];
    const a1 = acc(Z, r0);
    const z2 = Z + (h / 2) * V, v2 = V + (h / 2) * a1, a2 = acc(z2, r1);
    const z3 = Z + (h / 2) * v2, v3 = V + (h / 2) * a2, a3 = acc(z3, r1);
    const z4 = Z + h * v3, v4 = V + h * a3, a4 = acc(z4, r2);
    const zn = Z + (h / 6) * (V + 2 * v2 + 2 * v3 + v4);
    const vn = V + (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
    if ((Z < 0 && zn >= 0) || (Z > 0 && zn <= 0)) {
      const tx = t + (h * abs(Z)) / max(1e-12, abs(Z) + abs(zn));
      S.sym[i] = min(9, floor((tx - S.tc[i]) / TAU));
      S.tc[i] = tx;
      S.flash[i] = 1;
    }
    z[i] = zn;
    v[i] = vn;
  }
  S.t += h;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const e = 0.3 * (1 + cl(k[2] || 0, -1, 1)), sp = 0.005 + 0.3 * cl(k[3] == null ? 0.06 : k[3], 0, 1);
  if (abs(e - S.want[0]) > 1e-6 || abs(sp - S.want[1]) > 1e-6) {
    S.want = [e, sp];
    S.rest = 0;
  } else S.rest += d;
  if ((abs(e - S.e) > 1e-6 || abs(sp - S.sp) > 1e-6) && (S.rest > 0.3 || S.since === 0)) {
    S.e = e;
    S.sp = sp;
    S.t = PI / 2 - e;
    launch(S);
  }
  const b = !!(input.btnPressed && input.btnPressed[0]);
  if (b && !S.btn) S.pending = true;
  S.btn = b;
  for (let i = 0; i < NB; i++) S.flash[i] *= 0.88;
  let T = d * S.speed * P.RATE;
  while (T > 1e-9) {
    const r = radius(S.t, S.e);
    let h = min(0.01, 0.03 * r * sqrt(r), T);
    if (S.pending) {
      // The next wave goes as the primaries come round to r = 1/2.
      const ph = PI / 2 - S.e, nxt = ph + TAU * ceil((S.t - ph) / TAU + 1e-9);
      if (S.t + h >= nxt) {
        h = nxt - S.t;
        if (h > 1e-9) step(S, h);
        S.t = nxt;
        T -= h;
        launch(S);
        continue;
      }
    }
    step(S, h);
    T -= h;
  }
  S.since += d * S.speed * P.RATE;
  if (S.since > P.CYCLE) S.pending = true;
  const r = radius(S.t, S.e);
  for (let i = 0; i < NB; i++) {
    const z = S.z[i], vz = S.v[i];
    // Past the edge of the panel, moving out with positive energy: gone.
    if (abs(z) > P.ZOUT && z * vz > 0 && (vz * vz) / 2 - 1 / sqrt(z * z + r * r) > 0) relaunchOne(S, i);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const A = S.acc, c = S.c, y = S.yy;
  for (let p = 0; p < N * 3; p++) A[p] *= P.DECAY;
  const put = (x, yy, r, g, b) => {
    if (yy < 0 || yy >= H || x < 0 || x >= W) return;
    const p = (yy * W + x) * 3;
    if (A[p] < r) A[p] = r;
    if (A[p + 1] < g) A[p + 1] = g;
    if (A[p + 2] < b) A[p + 2] = b;
  };
  for (let i = 0; i < NB; i++) y[i] = MID - 62 * tanh(S.z[i] / P.ZS);
  for (let i = 0; i < NB; i++) {
    const s = S.sym[i];
    hsv(S.hue + 0.5 + (s < 0 ? 0 : 0.12 * (s + 1)), 0.8, 1, c);
    const R = P.BR, y0 = y[i];
    if (y0 < -R || y0 > H + R) continue;
    // A body still in step with a neighbour leaves its glow behind; one on
    // its own leaves only a short tail.
    const linked = (i > 0 && abs(y0 - y[i - 1]) <= P.LINK) || (i < NB - 1 && abs(y0 - y[i + 1]) <= P.LINK);
    const g = linked ? 1 : 0.4;
    for (let yy = floor(y0 - R); yy <= ceil(y0 + R); yy++)
      for (let x = i - 2; x <= i + 2; x++) {
        const q = ((x - i) * (x - i) + (yy - y0) * (yy - y0)) / (R * R);
        if (q < 1) {
          const w = (0.6 - q * 0.45) * g;
          put(x, yy, c[0] * w, c[1] * w, c[2] * w);
        }
      }
    if (i < NB - 1 && abs(y0 - y[i + 1]) <= P.LINK) {
      const m = (y0 + y[i + 1]) / 2;
      for (let yy = round(min(y0, m)); yy <= round(max(y0, m)); yy++) put(i, yy, c[0], c[1], c[2]);
      for (let yy = round(min(y[i + 1], m)); yy <= round(max(y[i + 1], m)); yy++) put(i + 1, yy, c[0], c[1], c[2]);
    }
  }
  const E = anomaly(S.t, S.e), e = S.e;
  const r = (1 - e * cos(E)) / 2;
  const nu = 2 * atan2(sqrt(1 + e) * sin(E / 2), sqrt(1 - e) * cos(E / 2));
  const px = [32 + 34 * r * cos(nu), 32 - 34 * r * cos(nu)], depth = [sin(nu), -sin(nu)];
  for (let yy = 0; yy < H; yy++)
    for (let x = 0; x < W; x++) {
      const p = (yy * W + x) * 3;
      let R = A[p], G = A[p + 1], B = A[p + 2];
      if (yy === 63 || yy === 64) {
        // The plane edge-on: under each body the last symbol it wrote.
        const s = S.sym[x];
        if (s < 0) {
          R = max(R, 0.12);
          G = max(G, 0.12);
          B = max(B, 0.16);
        } else {
          hsv(S.hue + 0.5 + 0.12 * (s + 1), 0.8, 0.3 + 0.7 * S.flash[x], c);
          R = max(R, c[0]);
          G = max(G, c[1]);
          B = max(B, c[2]);
        }
      }
      for (let j = 0; j < 2; j++) {
        const rad = 1.6 + 0.7 * depth[j], dx = x + 0.5 - px[j], dy = yy - MID;
        const q = dx * dx + dy * dy;
        if (q < rad * rad) {
          const w = 1 - (q / (rad * rad)) * 0.5;
          R = max(R, w);
          G = max(G, w * 0.92);
          B = max(B, w * 0.75);
        }
      }
      display.setPixel(x, yy, min(255, round(R * 255)), min(255, round(G * 255)), min(255, round(B * 255)));
    }
  for (let i = 0; i < NB; i++) {
    const yy = round(y[i]);
    if (yy < 0 || yy >= H) continue;
    hsv(S.hue + 0.5 + (S.sym[i] < 0 ? 0 : 0.12 * (S.sym[i] + 1)), 0.45, 1, c);
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const X = i + dx, Y = yy + dy;
      if (X >= 0 && X < W && Y >= 0 && Y < H) display.setPixel(X, Y, round(c[0] * 255), round(c[1] * 255), round(c[2] * 255));
    }
    display.setPixel(i, yy, 255, 255, 255);
  }
}
