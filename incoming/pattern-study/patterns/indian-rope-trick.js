// ===== Patternflow pattern =====
// Title:   Indian Rope Trick
// Family:  physics
// Idea:    A chain of three rigid links stands upside down the full height of the panel on a pivot that buzzes up and down too fast and too little to see, and every few seconds a tap sets it swaying until the vibration brings it back to vertical; turn the shaking down past the threshold and the chain topples, swings down past the pivot and is lifted upright to topple again.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: inverted pendulum stabilised by a vibrating pivot (Andrew Stephenson, 1908; Pyotr Kapitza, 1951), the Indian rope trick of an n-link inverted pendulum (David Acheson, 1993; David Acheson and Tom Mullin, Nature, 1993), pattern round 64
// Round:   64
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Shake=0..3, Links=3..6, Nudge=0..1
//
// Knob 1: Hue. Turns the links' colour round the wheel: brass at 0, green at 0.25, sky blue at 0.5, violet at 0.75 and brass again at 1, every other link a deeper shade (copper at 0); the joints stay white.
// Knob 2: Shake. The pivot's peak speed A w in units of sqrt(g L), L the whole chain's height. Below about 1.25 nothing holds the chain up: it topples over the side, swings down past the pivot, lies there 1.3 s and is stood up again. From 1.3 every chain stands, at the opening 2 it rides out the taps, and shaken harder still six links shiver and fall again from about 2.15 and five from about 2.7, while three and four still stand at 3. At 2 the three links' pivot moves 0.74 LED each way, 66 times a second.
// Knob 3: Links. Three links, the triple pendulum Acheson and Mullin stood on its head, then four, five and six, always 116 LEDs tall together. More links need a faster shake, so the drive runs at 60 n sqrt(g / l) for n links of length l: 66 Hz for three, 187 Hz for six.
// Knob 4: Nudge. How hard the tap is, every 2.5 to 3.5 s at the top joint or another: at the opening 0.06 the top sways 7 to 17 LEDs, each swing about 0.6 of the one before, so the next tap usually finds it still moving; from about 0.5 most taps knock the chain over.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, sin, cos, sqrt, exp, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The chain stands 116 LEDs tall on a pivot at row 121, centred.
const L_PX = 116, PX = 31.5, PY = 121;
// sqrt(L / g) for the whole chain's height L, in panel seconds; the time a
// chain that tall takes to start falling. The panel runs slower than a bench.
const TAU = 0.75;
// Joint friction, per natural time of one link, and a drag on every bit of
// the chain in proportion to its speed, per panel second.
const DAMP = 0.06, DRAG = 0.7;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  params.s = null;
}

function makeChain(n) {
  const S = {
    n,
    l: L_PX / n,
    th: new Float64Array(n), om: new Float64Array(n),
    k: [0, 1, 2, 3].map(() => [new Float64Array(n), new Float64Array(n)]),
    t1: new Float64Array(n), o1: new Float64Array(n),
    M: new Float64Array(n * n), f: new Float64Array(n), sn: new Float64Array(n), cs: new Float64Array(n),
    t: 0, // physics time, panel seconds
  };
  // A link of length l falls on the time scale sqrt(l / g).
  const tau = TAU / sqrt(n);
  S.G = 1 / (tau * tau); // g / l
  S.w = (60 * n) / tau; // drive, rad per panel second
  S.b = DAMP / tau;
  return S;
}

// The equations of motion of n identical uniform rods hinged end to end, the
// first on a pivot driven up and down as A cos(w t). Angles from the upward
// vertical; in the pivot's frame gravity becomes g - A w^2 cos(w t). With
// mass and length scaled out, for links i, j counted from the bottom,
//   sum_j a_ij th_j'' = - sum_j c_ij sin(th_i - th_j) th_j'^2
//                       + (g_eff / l)(n - i - 1/2) sin th_i + friction,
// where a_ii = n - i - 2/3 (zero-based i), a_ij = c_ij cos(th_i - th_j) and
// c_ij = n - max(i, j) - 1/2: the rods above i and half of the higher of the
// two. The n by n system is solved for th'' at every evaluation.
function accel(S, th, om, t, out) {
  const { n, M, f, sn, cs } = S;
  const geff = S.G - S.Al * S.w * S.w * cos(S.w * t);
  for (let i = 0; i < n; i++) {
    sn[i] = sin(th[i]);
    cs[i] = cos(th[i]);
  }
  for (let i = 0; i < n; i++) {
    let r = geff * (n - i - 0.5) * sn[i];
    for (let j = 0; j < n; j++) {
      if (j === i) {
        M[i * n + j] = n - i - 2 / 3;
        continue;
      }
      const c = n - max(i, j) - 0.5;
      M[i * n + j] = c * (cs[i] * cs[j] + sn[i] * sn[j]);
      r -= c * (sn[i] * cs[j] - cs[i] * sn[j]) * om[j] * om[j];
    }
    r -= S.b * (om[i] - (i > 0 ? om[i - 1] : 0));
    if (i + 1 < n) r += S.b * (om[i + 1] - om[i]);
    f[i] = r;
  }
  solve(n, M, f, out);
  // A drag proportional to the mass matrix adds -DRAG th' to every link.
  for (let i = 0; i < n; i++) out[i] -= DRAG * om[i];
}

// Gaussian elimination; the matrix is symmetric positive definite, so no pivoting.
function solve(n, M, f, out) {
  for (let k = 0; k < n; k++) {
    const d = M[k * n + k];
    for (let r = k + 1; r < n; r++) {
      const q = M[r * n + k] / d;
      if (!q) continue;
      for (let c = k; c < n; c++) M[r * n + c] -= q * M[k * n + c];
      f[r] -= q * f[k];
    }
  }
  for (let k = n - 1; k >= 0; k--) {
    let s = f[k];
    for (let c = k + 1; c < n; c++) s -= M[k * n + c] * out[c];
    out[k] = s / M[k * n + k];
  }
}

// One classical Runge-Kutta step.
function rk4(S, dt) {
  const { n, th, om, k, t1, o1 } = S;
  const hs = [0, 0.5, 0.5, 1];
  for (let s = 0; s < 4; s++) {
    const h = hs[s] * dt, src = k[s ? s - 1 : 0];
    for (let i = 0; i < n; i++) {
      t1[i] = th[i] + (s ? h * src[0][i] : 0);
      o1[i] = om[i] + (s ? h * src[1][i] : 0);
    }
    k[s][0].set(o1);
    accel(S, t1, o1, S.t + h, k[s][1]);
  }
  for (let i = 0; i < n; i++) {
    th[i] += (dt / 6) * (k[0][0][i] + 2 * k[1][0][i] + 2 * k[2][0][i] + k[3][0][i]);
    om[i] += (dt / 6) * (k[0][1][i] + 2 * k[1][1][i] + 2 * k[2][1][i] + k[3][1][i]);
  }
  S.t += dt;
}

// A tap: a sideways impulse J at the top of link s, passed as P = J / (m l).
// Its generalised impulse is J l cos th_i on every link up to s, and the kick
// in angular velocity is the scaled mass matrix's inverse applied to P cos th_i.
function tap(S, s, P) {
  const { n, M, f, th, om } = S;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) M[i * n + j] = i === j ? n - i - 2 / 3 : (n - max(i, j) - 0.5) * cos(th[i] - th[j]);
    f[i] = i <= s ? P * cos(th[i]) : 0;
  }
  const d = new Float64Array(n);
  solve(n, M, f, d);
  for (let i = 0; i < n; i++) om[i] += d[i];
}

// Joint positions in LEDs for the chain's angles and the pivot's height.
function joints(S, th, lift, out) {
  let x = PX, y = PY - lift;
  out[0] = x;
  out[1] = y;
  for (let i = 0; i < S.n; i++) {
    x += S.l * sin(th[i]);
    y -= S.l * cos(th[i]);
    out[2 * i + 2] = x;
    out[2 * i + 3] = y;
  }
}

const wrap = (a) => a - 2 * PI * round(a / (2 * PI));

export function update(dt, input, params) {
  const P = params;
  const kv = input.knobValues || [0, 2, 3, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  P.hue = kv[0] || 0;
  const shake = cl(kv[1], 0, 3);
  const n = round(cl(kv[2], 3, 6));
  P.nudge = cl(kv[3], 0, 1);
  if (!P.s || P.s.n !== n) {
    const old = P.s;
    P.s = makeChain(n);
    P.R = new Float32Array(N);
    P.Gc = new Float32Array(N);
    P.B = new Float32Array(N);
    P.ghost = new Float32Array(N * 3);
    P.pos = new Float64Array(2 * n + 2);
    P.blur = [];
    P.mode = "stand";
    P.timer = 0;
    P.nextTap = old ? 1.2 : 0.9;
    P.s.th[n - 1] = 0.01;
    P.time = old ? P.time : 0;
  }
  const S = P.s;
  P.time += dt;
  // The pivot's amplitude as a share of a link: A w = shake sqrt(g L) and
  // sqrt(g L) = sqrt(n) l / tau for links of length l.
  S.Al = (shake * sqrt(S.n) * sqrt(S.G)) / S.w;
  P.ampPx = S.Al * S.l;
  // Taps every 2.5 to 3.5 s, at the top joint twice as often as any other.
  if (P.mode === "stand") {
    P.nextTap -= dt;
    if (P.nextTap <= 0) {
      P.nextTap = 2.5 + Math.random();
      const s = Math.random() < 0.5 ? S.n - 1 : floor(Math.random() * S.n);
      const side = Math.random() < 0.5 ? -1 : 1;
      // The impulse in units of m sqrt(g l), m and l one link's mass and length.
      const imp = side * (0.16 + 0.5 * P.nudge + 2.6 * P.nudge * P.nudge) * sqrt(S.n);
      tap(S, s, imp * sqrt(S.G));
      joints(S, S.th, 0, P.pos);
      P.flash = { x: P.pos[2 * s + 2], y: P.pos[2 * s + 3], side, life: 1 };
    }
  }
  if (P.flash) P.flash.life -= dt * 3;
  // Steps of about 0.25 radian of the drive; four snapshots a frame for blur.
  const steps = max(4, Math.ceil((dt * S.w) / 0.25));
  const h = dt / steps;
  P.blur.length = 0;
  for (let i = 1; i <= steps; i++) {
    if (P.mode !== "lift") rk4(S, h);
    else S.t += h;
    if (i % Math.ceil(steps / 4) === 0 || i === steps) {
      const out = new Float64Array(2 * S.n + 2);
      joints(S, S.th, P.ampPx * cos(S.w * S.t), out);
      P.blur.push(out);
    }
  }
  // Fallen: the top has dropped below 60 percent of the chain's height, or a
  // link lies past horizontal. After 1.3 s fallen it is lifted back upright
  // over 0.9 s, every link easing to a small lean.
  joints(S, S.th, 0, P.pos);
  const topH = PY - P.pos[2 * S.n + 1];
  let worst = 0;
  for (let i = 0; i < S.n; i++) worst = max(worst, abs(wrap(S.th[i])));
  if (P.mode === "stand" && (topH < 0.6 * L_PX || worst > 1.7)) {
    P.mode = "fallen";
    P.timer = 0;
  } else if (P.mode === "fallen") {
    P.timer += dt;
    if (P.timer > 1.3) {
      P.mode = "lift";
      P.timer = 0;
      P.from = Array.from(S.th, wrap);
      P.to = P.from.map((a, i) => (i === S.n - 1 ? 0.02 * Math.sign(a || 1) : 0));
    }
  } else if (P.mode === "lift") {
    P.timer += dt / 0.9;
    const u = min(1, P.timer), e = u * u * (3 - 2 * u);
    for (let i = 0; i < S.n; i++) {
      S.th[i] = P.from[i] + (P.to[i] - P.from[i]) * e;
      S.om[i] = 0;
    }
    if (u >= 1) {
      P.mode = "stand";
      P.nextTap = 2.5;
    }
  }
}

// Additive light: a soft disc or a segment's capsule.
function stamp(P, x, y, r, v, c) {
  const x0 = max(0, floor(x - r - 1)), x1 = min(W - 1, Math.ceil(x + r + 1));
  const y0 = max(0, floor(y - r - 1)), y1 = min(H - 1, Math.ceil(y + r + 1));
  for (let Y = y0; Y <= y1; Y++)
    for (let X = x0; X <= x1; X++) {
      const d = Math.hypot(X - x, Y - y);
      const a = cl(r + 0.5 - d, 0, 1) * v;
      if (a <= 0) continue;
      const p = Y * W + X;
      P.R[p] += a * c[0];
      P.Gc[p] += a * c[1];
      P.B[p] += a * c[2];
    }
}

// A rod's cross-section by squared distance from its axis, in eighths of an
// LED squared: a core about 3 LEDs thick and a soft glow either side.
const PROF = new Float32Array(201);
for (let k = 0; k <= 200; k++) {
  const d2 = k / 8;
  PROF[k] = cl(1.85 - sqrt(d2), 0, 1) + 0.35 * exp(-d2 / 4) + 0.15 * exp(-d2 / 16);
}

function rod(P, ax, ay, bx, by, v, c) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
  const pad = 5;
  const x0 = max(0, floor(min(ax, bx) - pad)), x1 = min(W - 1, Math.ceil(max(ax, bx) + pad));
  const y0 = max(0, floor(min(ay, by) - pad)), y1 = min(H - 1, Math.ceil(max(ay, by) + pad));
  for (let Y = y0; Y <= y1; Y++)
    for (let X = x0; X <= x1; X++) {
      const u = cl(((X - ax) * dx + (Y - ay) * dy) / len2, 0, 1);
      const ex = X - ax - u * dx, ey = Y - ay - u * dy;
      const k = ((ex * ex + ey * ey) * 8 + 0.5) | 0;
      if (k > 200) continue;
      const a = PROF[k] * v, p = Y * W + X;
      P.R[p] += a * c[0];
      P.Gc[p] += a * c[1];
      P.B[p] += a * c[2];
    }
}

export function draw(display, params) {
  const P = params;
  const S = P.s;
  if (!S) return;
  const { R, Gc, B, ghost } = P;
  R.fill(0);
  Gc.fill(0);
  B.fill(0);
  const col = [0, 0, 0];
  // Brass at Hue 0.
  hsv(P.hue + 0.11, 0.62, 1, col);
  const deep = [0, 0, 0];
  hsv(P.hue + 0.06, 0.8, 0.88, deep);
  const n = S.n;
  // The plumb line the chain should stand on, dotted.
  for (let y = PY - L_PX; y < PY; y += 3) stamp(P, PX, y, 0.3, 0.16, [0.6, 0.7, 0.9]);
  // The chain at four moments of the frame, so the shake and the sway blur.
  const wgt = 1 / P.blur.length;
  for (const J of P.blur) {
    for (let i = 0; i < n; i++) {
      // Links alternate bright and deeper brass, so each reads as its own rod.
      const c = i & 1 ? deep : col;
      rod(P, J[2 * i], J[2 * i + 1], J[2 * i + 2], J[2 * i + 3], wgt * (i & 1 ? 0.8 : 1), c);
    }
    for (let i = 0; i <= n; i++) stamp(P, J[2 * i], J[2 * i + 1], i === 0 ? 2.1 : 1.8, wgt * 1.1, [1, 0.96, 0.9]);
  }
  // The tap: a white spark at the struck joint, thrown out on the side it came from.
  if (P.flash && P.flash.life > 0) {
    const f = P.flash;
    for (let k = 0; k < 4; k++) stamp(P, f.x - f.side * (2 + 2.2 * k * (1 - f.life)), f.y, 1.2 - 0.2 * k, f.life * 0.8, [1, 1, 1]);
  }
  // The shaker under the pivot: a block whose top plate rides with the pivot,
  // drawn where it is this frame.
  const lift = P.ampPx * cos(S.w * S.t);
  const top = PY + 2 - lift;
  for (let y = floor(top); y < H; y++)
    for (let x = 18; x < 46; x++) {
      const cover = cl(y + 1 - top, 0, 1);
      const p = y * W + x;
      const plate = y - top < 2;
      const edge = x === 18 || x === 45;
      const v = cover * (plate ? 0.62 : edge ? 0.3 : 0.17);
      R[p] += v * 0.75;
      Gc[p] += v * 0.82;
      B[p] += v * 0.95;
    }
  // The coil's hum: a glow in the block, brighter for a harder shake.
  const hum = min(1, P.ampPx * 0.9) * (0.75 + 0.25 * sin(P.time * 40));
  for (let x = 24; x < 40; x++) stamp(P, x, 125.5, 0.6, 0.18 * hum, [1, 0.25, 0.5]);
  // A short afterglow, so a fast swing leaves a fan behind it.
  const keep = exp(-1 / 30 / 0.3);
  for (let p = 0, q = 0; p < N; p++, q += 3) {
    ghost[q] = max(ghost[q] * keep, R[p] * 0.55);
    ghost[q + 1] = max(ghost[q + 1] * keep, Gc[p] * 0.55);
    ghost[q + 2] = max(ghost[q + 2] * keep, B[p] * 0.55);
    const r = max(R[p], ghost[q]), g = max(Gc[p], ghost[q + 1]), b = max(B[p], ghost[q + 2]);
    display.setPixel(p % W, (p / W) | 0, round(min(1, r) * 255), round(min(1, g) * 255), round(min(1, b) * 255));
  }
}
