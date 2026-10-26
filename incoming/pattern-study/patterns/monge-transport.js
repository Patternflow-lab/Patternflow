// ===== Patternflow pattern =====
// Title:   Monge Transport
// Family:  algo
// Idea:    Particles filling one abstract shape are paired at random with places in another shape in the other half of the panel, the pairing is untangled by swapping the targets of any two particles whose swap shortens the total of |x - y|^p, so the dim target dots sort into the colours of the particles bound for them and the sample rays stop crossing, and then every particle slides along its ray at once and the pile lands as the new shape with its colour wheel rearranged by the map.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the problem of deblais et remblais and its rays that never cross (Gaspard Monge, 1781), the relaxed problem (Leonid Kantorovich, 1942), the quadratic cost and its monotone map (Yann Brenier, 1987), displacement interpolation (Robert McCann, 1997), pattern round 61
// Round:   61
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Particles=150..400, Exponent=1..2
//
// Knob 1: Hue. Turns the colour wheel each pile carries. A particle's hue is its angle round the middle of the shape it starts in and its saturation its distance out, pale at the middle. At 0 the opening lobes run from green and yellow on the left to pink and violet on the right; at 0.5 the wheel is turned half round, blue and violet on the left, yellow and green on the right.
// Knob 2: Speed. At 2 a round takes 7.5 seconds: 3.5 s of untangling, 2.6 s of travel and 1.4 s at rest while the colours settle into the new shape's own wheel. The opening round untangles in 1.8 s, so the first pile leaves at 1.8 s and lands at 4.4 s. 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Particles. 150 to 400 in steps of 25, on a jittered grid that fills 1500 LEDs of each shape, the grid 3.2 LEDs apart at 150 and 1.9 at 400. A random pairing takes about 5 swaps a particle to untangle, 720 at 150 and 1800 at 400.
// Knob 4: Exponent. p in the cost |x - y|^p. At 1, Monge's own cost, every crossing pair of rays is a swap that shortens the total, so when the untangling ends no two rays cross; many plans cost the same there, and the pile keeps left and right but lands with top and bottom shuffled. Any p above 1, even 1.02, also sorts top to top, and the pile slides over keeping its wheel while about one pair of rays in 60 crosses at a shallow angle. At 2, Brenier's quadratic cost, one pair in 35 crosses, but no two particles are ever in the same place at the same moment.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, atan2, cos, sin, pow, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// LEDs each shape fills, and seconds of each stage at Speed 2.
// The opening round untangles in T_OPEN, so its pile is moving by 2 seconds.
const AREA = 1500, T_U = 3.5, T_M = 2.6, T_R = 1.4, T_OPEN = 1.8;
// Rays drawn through the untangling and the travel, from particles spread
// out over the source.
const WITNESS = 8;
const MAXN = 400;
// Pair checks of planning a frame.
const BUDGET = 50000;

// Filled shapes in a box from -1 to 1 across the half panel.
const SHAPES = [
  (u, v) => u * u + v * v < 0.85, // disk
  (u, v) => {
    const r = u * u + v * v;
    return r > 0.2 && r < 0.85;
  }, // annulus
  (u, v) => (u + 0.45) * (u + 0.45) + v * v < 0.27 || (u - 0.45) * (u - 0.45) + v * v < 0.27, // two lobes
  (u, v) => abs(v) < 0.92 && abs(u) > 0.2 && abs(u) < 0.7, // bar pair
  (u, v) => v < 0.75 && abs(u) < (0.95 * (v + 0.92)) / 1.67, // triangle
  (u, v) => (abs(u) < 0.3 && abs(v) < 0.95) || (abs(v) < 0.3 && abs(u) < 0.95), // cross
  (u, v) => u * u + v * v < 0.92 && (u - 0.5) * (u - 0.5) + v * v > 0.4, // crescent
  (u, v) => abs(u) + abs(v) < 0.95, // diamond
  (u, v) => {
    const m = max(abs(u), abs(v));
    return m > 0.42 && m < 0.92;
  }, // square ring
  (u, v) => sqrt(u * u + v * v) < 0.66 + 0.3 * cos(3 * atan2(v, u)), // trefoil
];

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

export function setup(params) {
  params.s = {
    n: 0, p: -1, g: 3, half: 0, src: 2, dst: 4, rot: 0, dRot: 0, phase: 0, t: 0, tu: T_U, tm: T_M, base: 0, job: 0, turn: false,
    X: new Float64Array(2 * MAXN), Y: new Float64Array(2 * MAXN), P: new Float64Array(2 * MAXN), F: new Float64Array(2 * MAXN),
    hue: new Float64Array(MAXN), sat: new Float64Array(MAXN), hue0: new Float64Array(MAXN), sat0: new Float64Array(MAXN),
    hueTo: new Float64Array(MAXN), satTo: new Float64Array(MAXN),
    sig: new Int32Array(MAXN), inv: new Int32Array(MAXN), work: new Int32Array(MAXN), ord: new Int32Array(MAXN),
    C: new Float64Array(MAXN * MAXN),
    sw: new Int16Array(2 * 60 * MAXN), cross: new Uint8Array(60 * MAXN), gain: new Float32Array(60 * MAXN), K: 0, k: 0,
    wit: new Int32Array(WITNESS), flash: [], rgb: new Float32Array(W * H * 3), pc: new Float32Array(W * H * 3), pa: new Float32Array(W * H), c: [0, 0, 0],
  };
}

// N points of shape kind in the given half: a jittered grid of spacing
// sqrt(AREA / N), and the shape scaled about the middle of the half until
// N grid points fall inside it. Extra points from the last step of the
// scale are dropped at random.
function sample(S, kind, half, rot, out) {
  const N = S.n, inside = SHAPES[kind], cr = cos(rot), sr = sin(rot);
  let g = sqrt(AREA / N);
  for (let tries = 0; tries < 12; tries++, g *= 0.96) {
    const m = Math.ceil(64 / g) + 2, pts = [];
    for (let i = 0; i < m; i++)
      for (let j = 0; j < m; j++) pts.push((i - (m - 1) / 2 + (Math.random() - 0.5) * 0.12) * g, (j - (m - 1) / 2 + (Math.random() - 0.5) * 0.12) * g);
    // A point must also stay in its half, whatever the turn of the shape.
    const inAt = (k, s) => {
      if (abs(pts[k]) > 30.6 || abs(pts[k + 1]) > 30.6) return false;
      const x = pts[k] / (31 * s), y = pts[k + 1] / (31 * s);
      return inside(x * cr + y * sr, y * cr - x * sr);
    };
    const count = (s) => {
      let c = 0;
      for (let k = 0; k < pts.length; k += 2) if (inAt(k, s)) c++;
      return c;
    };
    if (count(1.25) < N) continue;
    let lo = 0.2, hi = 1.25;
    for (let it = 0; it < 16; it++) {
      const s = (lo + hi) / 2;
      if (count(s) >= N) hi = s;
      else lo = s;
    }
    const keep = [];
    for (let k = 0; k < pts.length; k += 2) if (inAt(k, hi)) keep.push(k);
    while (keep.length > N) keep.splice(floor(Math.random() * keep.length), 1);
    for (let i = 0; i < N; i++) {
      out[2 * i] = 32 + pts[keep[i]];
      out[2 * i + 1] = 32 + 64 * half + pts[keep[i] + 1];
    }
    S.g = g;
    return;
  }
}

// Each particle's colour from where it sits: hue by angle round the
// centre of the pile, saturation by distance out.
function wheelOf(S, pos, hue, sat) {
  const N = S.n;
  let cx = 0, cy = 0, rm = 0;
  for (let i = 0; i < N; i++) {
    cx += pos[2 * i] / N;
    cy += pos[2 * i + 1] / N;
  }
  for (let i = 0; i < N; i++) rm = max(rm, Math.hypot(pos[2 * i] - cx, pos[2 * i + 1] - cy));
  for (let i = 0; i < N; i++) {
    const dx = pos[2 * i] - cx, dy = pos[2 * i + 1] - cy;
    hue[i] = atan2(-dx, -dy) / (2 * PI) + 0.5;
    sat[i] = 0.25 + 0.75 * pow(Math.hypot(dx, dy) / max(1, rm), 0.8);
  }
}

// Untangling. From the pairing now in sig, try pairs of particles and
// swap the targets of i and j whenever |x_i - y_b|^p + |x_j - y_a|^p is
// shorter than |x_i - y_a|^p + |x_j - y_b|^p. At p = 1 two crossing rays
// always qualify, by the triangle inequality at the point where they
// cross, so the plan that comes out has none. The work runs ahead of what
// is shown, a budget of pair checks a frame, and the swaps it finds are
// played back over the stage.
function startPlan(S) {
  S.work.set(S.sig.subarray(0, S.n));
  S.K = 0;
  S.k = 0;
  S.job = 1;
  S.jr = 0;
  S.jpass = 0;
  S.rng = (Math.random() * 2147483647) | 1;
}

function record(S, i, j, a, b, d) {
  if (S.K < S.cross.length) {
    S.sw[2 * S.K] = i;
    S.sw[2 * S.K + 1] = j;
    S.gain[S.K] = d;
    S.cross[S.K] = crosses(S.X, S.Y, i, a, j, b) ? 1 : 0;
    S.K++;
  }
  S.work[i] = b;
  S.work[j] = a;
}

function newPass(S) {
  const ord = S.ord;
  for (let i = 0; i < S.n; i++) ord[i] = i;
  for (let i = S.n - 1; i > 0; i--) {
    const j = floor(Math.random() * (i + 1)), t = ord[i];
    ord[i] = ord[j];
    ord[j] = t;
  }
  S.jx = 0;
  S.jany = false;
}

function work(S, budget) {
  const N = S.n, C = S.C, X = S.X, Y = S.Y, w = S.work, ord = S.ord, h = S.p / 2;
  while (budget > 0 && S.job) {
    if (S.job === 1) {
      // The costs, a row a step.
      const i = S.jr;
      for (let j = 0; j < N; j++) {
        const dx = X[2 * i] - Y[2 * j], dy = X[2 * i + 1] - Y[2 * j + 1];
        C[i * N + j] = pow(dx * dx + dy * dy, h);
      }
      budget -= N;
      if (++S.jr === N) {
        S.job = 2;
        S.jr = N * N;
      }
    } else if (S.job === 2) {
      // N^2 pairs at random from a xorshift stream, so the swaps play back
      // spread over the whole pile.
      let t = min(S.jr, budget), r = S.rng;
      S.jr -= t;
      budget -= t;
      for (; t > 0; t--) {
        r ^= r << 13;
        r ^= r >>> 17;
        r ^= r << 5;
        const i = ((r >>> 16) * N) >>> 16, j = ((r & 0xffff) * N) >>> 16;
        if (i === j) continue;
        const a = w[i], b = w[j], d = C[i * N + a] + C[j * N + b] - C[i * N + b] - C[j * N + a];
        if (d > 1e-9) record(S, i, j, a, b, d);
      }
      S.rng = r;
      if (!S.jr) {
        S.job = 3;
        newPass(S);
      }
    } else {
      // Then whole passes over every pair, in a fresh order each time,
      // until one finds nothing.
      const x = S.jx, i = ord[x];
      for (let y = x + 1; y < N; y++) {
        const j = ord[y], a = w[i], b = w[j], d = C[i * N + a] + C[j * N + b] - C[i * N + b] - C[j * N + a];
        if (d > 1e-9) {
          record(S, i, j, a, b, d);
          S.jany = true;
        }
      }
      budget -= N - x;
      if (++S.jx >= N - 1) {
        if (!S.jany || ++S.jpass >= 40) S.job = 0;
        else newPass(S);
      }
    }
  }
}

function crosses(X, Y, i, a, j, b) {
  const ax = X[2 * i], ay = X[2 * i + 1], bx = Y[2 * a], by = Y[2 * a + 1];
  const cx = X[2 * j], cy = X[2 * j + 1], dx = Y[2 * b], dy = Y[2 * b + 1];
  const o = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  return o(ax, ay, bx, by, cx, cy) * o(ax, ay, bx, by, dx, dy) < 0 && o(cx, cy, dx, dy, ax, ay) * o(cx, cy, dx, dy, bx, by) < 0;
}

function shuffle(S) {
  const N = S.n, sig = S.sig;
  for (let i = 0; i < N; i++) sig[i] = i;
  for (let i = N - 1; i > 0; i--) {
    const j = floor(Math.random() * (i + 1)), t = sig[i];
    sig[i] = sig[j];
    sig[j] = t;
  }
  for (let i = 0; i < N; i++) S.inv[sig[i]] = i;
}

// Rays to draw all the time: particles spread over the source, each the
// one farthest from those already picked.
function pickWitnesses(S) {
  const N = S.n, X = S.X, d = new Float64Array(N).fill(1e9);
  let pick = floor(Math.random() * N);
  for (let w = 0; w < WITNESS; w++) {
    S.wit[w] = pick;
    let best = 0;
    for (let i = 0; i < N; i++) {
      d[i] = min(d[i], Math.hypot(X[2 * i] - X[2 * pick], X[2 * i + 1] - X[2 * pick + 1]));
      if (d[i] > d[best]) best = i;
    }
    pick = best;
  }
}

// A new round: the pile sits in S.X, the next shape is dealt in the other half.
function deal(S, fresh) {
  const N = S.n;
  if (fresh) {
    sample(S, S.src, S.half, S.rot, S.X);
    wheelOf(S, S.X, S.hue, S.sat);
  }
  sample(S, S.dst, 1 - S.half, S.dRot, S.Y);
  S.P.set(S.X.subarray(0, 2 * N));
  shuffle(S);
  pickWitnesses(S);
  startPlan(S);
  S.phase = 0;
  S.t = 0;
  S.tu = T_U;
  S.base = 0;
  S.flash = [];
}

const ease = (u) => 1 - pow(1 - cl(u, 0, 1), 2.2);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 150, 1];
  const d = cl(dt || 0, 0, 0.1) * (cl(kv[1], 0.2, 3) / 2);
  S.hueK = cl(kv[0], 0, 1);
  const n = cl(round(cl(kv[2], 150, 400) / 25) * 25, 150, 400), p = cl(kv[3], 1, 2);
  if (n !== S.n) {
    // A new count deals the same two shapes again, with the short
    // untangling of the opening.
    S.n = n;
    S.p = p;
    deal(S, true);
    S.tu = T_OPEN;
  } else if (abs(p - S.p) > 1e-4) {
    S.p = p;
    if (S.phase === 0) {
      // Plan again from the pairing played so far and play the new plan
      // over what is left of the stage.
      startPlan(S);
      S.base = ease(S.t / S.tu);
    } else if (S.phase === 1) {
      // Mid flight: plan from where the particles are now, and turn them
      // towards their new targets once the plan is done.
      S.X.set(S.P.subarray(0, 2 * S.n));
      startPlan(S);
      S.turn = true;
    }
  }
  S.t += d;
  for (const f of S.flash) f.life -= d;
  S.flash = S.flash.filter((f) => f.life > 0);
  const N = S.n;
  if (S.job) work(S, S.phase === 0 && S.t >= S.tu ? 1e9 : BUDGET);
  if (S.phase === 0) {
    // Until the work is done its length is a guess, and nothing it has
    // not found yet is played.
    const e = ease(S.t / S.tu), base = S.base || 0, total = S.job ? S.K * 1.15 : S.K;
    const want = min(S.K, S.t >= S.tu ? S.K : floor((total * (e - base)) / max(1e-6, 1 - base)));
    const k0 = S.k;
    applyTo(S, want);
    // Flash the swap of this frame that took the most off the total,
    // a crossing one if there is one.
    let best = -1;
    for (let k = k0; k < S.k; k++) if (best < 0 || S.cross[k] > S.cross[best] || (S.cross[k] === S.cross[best] && S.gain[k] > S.gain[best])) best = k;
    if (best >= 0 && S.flash.length < 3) S.flash.push({ i: S.sw[2 * best], j: S.sw[2 * best + 1], life: 0.2 });
    if (S.t >= S.tu) {
      S.phase = 1;
      S.t = 0;
      S.tm = T_M;
      S.turn = false;
      S.F.set(S.X.subarray(0, 2 * N));
    }
  } else if (S.phase === 1 && S.turn && !S.job) {
    applyTo(S, S.K);
    S.F.set(S.P.subarray(0, 2 * N));
    S.tm = max(0.8, S.tm - S.t);
    S.t = 0;
    S.turn = false;
  }
  if (S.phase === 1) {
    const u = cl(S.t / S.tm, 0, 1), e = u * u * (3 - 2 * u);
    for (let i = 0; i < N; i++) {
      const a = S.sig[i];
      S.P[2 * i] = S.F[2 * i] + (S.Y[2 * a] - S.F[2 * i]) * e;
      S.P[2 * i + 1] = S.F[2 * i + 1] + (S.Y[2 * a + 1] - S.F[2 * i + 1]) * e;
    }
    if (S.t >= S.tm) {
      S.phase = 2;
      S.t = 0;
      // The pile now sits in the new shape; its colours drift to that
      // shape's own wheel while it rests.
      for (let i = 0; i < N; i++) {
        S.X[2 * i] = S.P[2 * i];
        S.X[2 * i + 1] = S.P[2 * i + 1];
      }
      wheelOf(S, S.X, S.hueTo, S.satTo);
      S.hue0.set(S.hue.subarray(0, N));
      S.sat0.set(S.sat.subarray(0, N));
    }
  } else if (S.phase === 2) {
    const u = cl(S.t / (T_R * 0.8), 0, 1), e = u * u * (3 - 2 * u);
    for (let i = 0; i < N; i++) {
      const dh = S.hueTo[i] - S.hue0[i] - round(S.hueTo[i] - S.hue0[i]);
      S.hue[i] = S.hue0[i] + dh * e;
      S.sat[i] = S.sat0[i] + (S.satTo[i] - S.sat0[i]) * e;
    }
    if (S.t >= T_R) {
      // The pile becomes the source; a new shape in the half it left.
      S.half = 1 - S.half;
      S.src = S.dst;
      S.rot = S.dRot;
      let k = floor(Math.random() * (SHAPES.length - 1));
      if (k >= S.src) k++;
      S.dst = k;
      S.dRot = floor(Math.random() * 8) * (PI / 4);
      S.base = 0;
      deal(S, false);
    }
  }
}

function applyTo(S, want) {
  for (; S.k < want; S.k++) {
    const i = S.sw[2 * S.k], j = S.sw[2 * S.k + 1], a = S.sig[i], b = S.sig[j];
    S.sig[i] = b;
    S.sig[j] = a;
    S.inv[b] = i;
    S.inv[a] = j;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.n) return;
  const rgb = S.rgb, N = S.n, c = S.c, hk = 0.55 + S.hueK;
  rgb.fill(0);
  const add = (x, y, r, g, b) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    rgb[o] += r;
    rgb[o + 1] += g;
    rgb[o + 2] += b;
  };
  const line = (x0, y0, x1, y1, r, g, b) => {
    const n = Math.ceil(max(abs(x1 - x0), abs(y1 - y0)));
    if (n < 1) return;
    const steep = abs(y1 - y0) > abs(x1 - x0);
    for (let s = 0; s <= n; s++) {
      const f = s / n, x = x0 + (x1 - x0) * f - 0.5, y = y0 + (y1 - y0) * f - 0.5;
      if (steep) {
        const xi = floor(x), fx = x - xi, yi = round(y);
        add(xi, yi, r * (1 - fx), g * (1 - fx), b * (1 - fx));
        add(xi + 1, yi, r * fx, g * fx, b * fx);
      } else {
        const yi = floor(y), fy = y - yi, xi = round(x);
        add(xi, yi, r * (1 - fy), g * (1 - fy), b * (1 - fy));
        add(xi, yi + 1, r * fy, g * fy, b * fy);
      }
    }
  };
  // The targets not yet reached: one dim dot each, in the colour of the
  // particle meant for it.
  if (S.phase < 2)
    for (let j = 0; j < N; j++) {
      const i = S.inv[j];
      hsv(S.hue[i] + hk, S.sat[i], 0.55, c);
      add(floor(S.Y[2 * j]), floor(S.Y[2 * j + 1]), c[0], c[1], c[2]);
    }
  // The sample rays, from where each particle is to where it is going.
  if (S.phase < 2)
    for (let w = 0; w < WITNESS; w++) {
      const i = S.wit[w], a = S.sig[i];
      hsv(S.hue[i] + hk, S.sat[i] * 0.7, 0.26, c);
      line(S.P[2 * i], S.P[2 * i + 1], S.Y[2 * a], S.Y[2 * a + 1], c[0], c[1], c[2]);
    }
  for (const f of S.flash) {
    const v = 0.75 * (f.life / 0.2);
    for (const i of [f.i, f.j]) {
      const a = S.sig[i];
      line(S.P[2 * i], S.P[2 * i + 1], S.Y[2 * a], S.Y[2 * a + 1], v, v, v);
      add(floor(S.Y[2 * a]), floor(S.Y[2 * a + 1]), v, v, v);
    }
  }
  // The particles: squares a little wider than the grid. Their colour and
  // cover add up apart from the rest, so two half-covered LEDs on a seam
  // make a whole one, and then lie over the dots and rays.
  const q = (S.g * 1.14) / 2, pc = S.pc, pa = S.pa;
  pc.fill(0);
  pa.fill(0);
  for (let i = 0; i < N; i++) {
    hsv(S.hue[i] + hk, S.sat[i], 1, c);
    const px = S.P[2 * i], py = S.P[2 * i + 1];
    for (let y = floor(py - q); y < py + q; y++) {
      if (y < 0 || y >= H) continue;
      const cy = min(y + 1, py + q) - max(y, py - q);
      if (cy <= 0) continue;
      for (let x = floor(px - q); x < px + q; x++) {
        if (x < 0 || x >= W) continue;
        const a = cy * (min(x + 1, px + q) - max(x, px - q));
        if (a <= 0) continue;
        const o = (y * W + x) * 3;
        pa[y * W + x] += a;
        pc[o] += c[0] * a;
        pc[o + 1] += c[1] * a;
        pc[o + 2] += c[2] * a;
      }
    }
  }
  for (let p = 0, o = 0; p < W * H; p++, o += 3) {
    const a = pa[p];
    if (a <= 0) continue;
    const k = 1 / max(1, a), b = 1 - min(1, a);
    rgb[o] = rgb[o] * b + pc[o] * k;
    rgb[o + 1] = rgb[o + 1] * b + pc[o + 1] * k;
    rgb[o + 2] = rgb[o + 2] * b + pc[o + 2] * k;
  }
  for (let p = 0, o = 0; p < W * H; p++, o += 3)
    display.setPixel(p % W, (p / W) | 0, min(255, rgb[o] * 255) | 0, min(255, rgb[o + 1] * 255) | 0, min(255, rgb[o + 2] * 255) | 0);
}
