// ===== Patternflow pattern =====
// Title:   Phantom Jam
// Family:  sim
// Idea:    Cars run round a tall ring road at the panel's edge, each driver easing toward the speed its gap allows, and with no crash or roadworks a stop-and-go jam forms and creeps backward round the ring while every car keeps going forward, as the space-time diagram inside the track shows with car lines slanting one way and red jam stripes the other.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the optimal velocity model of traffic (Masako Bando, Katsuya Hasebe, Akihiro Nakayama, Akihiro Shibata and Yuki Sugiyama, 1995) and the circuit experiment of Yuki Sugiyama and seven others (2008), pattern round 51
// Round:   51
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Cars=22..44, Sensitivity=0.5..2.5
//
// Knob 1: Hue. The colour of free flow, on the moving cars and their lines: cyan green at 0, blue at 0.5, violet at 1. Stopped cars and the jam stripes stay brake red, with amber for the speeds between. One car stays white so its line can be followed through the jams.
// Knob 2: Speed. At 2 a car at full speed laps the ring in 5 seconds, or 11 at the even spacing of 22 cars, and the diagram takes 10 new rows a second, so it holds the last 11.6 seconds; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Cars. How many cars share the ring, from 22, the number in Sugiyama's circuit, to 44. Turning it lets a car join at the widest gap or leave from the tightest, which is a kink of its own. More cars mean shorter gaps and slower flow: at 44 the ring crawls in amber between red queues.
// Knob 4: Sensitivity. How hard each driver chases the speed its gap allows, the model's a. Uniform flow is unstable when a is below twice the slope of the speed law at its gap. At 0.5 every number of cars jams hard and the queues stand still. At 1.5 only 22 to 29 cars are unstable, and a wave takes about a minute to grow. From 2 on every kink heals and the lines run parallel.
// Buttons: K1 tap makes the driver nearest the start line, the white tick at the bottom of the track, brake to a stop.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, abs, sqrt, sin, cos, tanh, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (t) => ((t = cl(t, 0, 1)), t * t * (3 - 2 * t));
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The model. Ring length in model units, the headway where the speed law is
// steepest, and the speed law V(h) = tanh(h - C) + tanh(C), which runs from
// 0 at h = 0 to VMAX for long gaps. Uniform flow at headway h is unstable
// when a < 2 V'(h) = 2 / cosh(h - C)^2.
const L = 39, C = 1.87, VMAX = 2 * tanh(C);
const V = (h) => tanh(h - C) + tanh(C);
// Fixed physics step, the smallest bumper-to-bumper headway (a car is 0.35
// units long), and the model time between two rows of the diagram.
const DT = 0.05, HMIN = 0.47, ROW = 0.4;

// The track's centre line: straights at x = 3 and x = 61 from y = 14 to
// y = 114, joined by half ellipses 29 LEDs across and 11 deep. Arc length s
// starts at the bottom middle and runs right along the bottom, up the right
// straight, over the top and down the left.
const CX = 32, XL = 3, XR = 61, YT = 14, YB = 114, RX = 29, RY = 11;
const PT = [];
{
  const n = 400;
  for (let i = 0; i <= n; i++) {
    const a = ((PI / 2) * i) / n;
    PT.push([CX + RX * sin(a), YB + RY * cos(a)]);
  }
  for (let i = 1; i <= n; i++) PT.push([XR, YB - ((YB - YT) * i) / n]);
  for (let i = 1; i <= 2 * n; i++) {
    const a = (PI * i) / (2 * n);
    PT.push([CX + RX * cos(a), YT - RY * sin(a)]);
  }
  for (let i = 1; i <= n; i++) PT.push([XL, YT + ((YB - YT) * i) / n]);
  for (let i = 1; i <= n; i++) {
    const a = ((PI / 2) * i) / n;
    PT.push([CX - RX * cos(a), YB + RY * sin(a)]);
  }
  let s = 0;
  PT[0].push(0);
  for (let i = 1; i < PT.length; i++) PT[i].push((s += Math.hypot(PT[i][0] - PT[i - 1][0], PT[i][1] - PT[i - 1][1])));
}
const LT = PT[PT.length - 1][2], NB = ceil(LT);
// Where s is on the panel, every half LED of arc.
const SX = new Float32Array(2 * NB + 2), SY = new Float32Array(2 * NB + 2);
for (let i = 0, j = 0; i < SX.length; i++) {
  const s = (i / 2) % LT;
  if (s < PT[j][2]) j = 0;
  while (j < PT.length - 2 && PT[j + 1][2] < s) j++;
  const a = PT[j], b = PT[j + 1], u = (s - a[2]) / (b[2] - a[2] || 1);
  SX[i] = a[0] + (b[0] - a[0]) * u;
  SY[i] = a[1] + (b[1] - a[1]) * u;
}

// Every LED's arc length and its distance from the centre line (negative
// inside), then its part: 0 dark, 1 outer kerb, 2 lane, 3 inner kerb, 4 the
// gap, 5 the diagram.
const TS = new Float32Array(N), KIND = new Uint8Array(N);
// The diagram: 52 columns for the ring unrolled, 116 rows of time.
const DX0 = 6, DY0 = 6, DCOL = 52, DROWS = 116;
const DIAG = [];
{
  const sR = PT[400][2], sL = PT[1600][2];
  const cap = PT.filter((q) => q[1] < YT || q[1] > YB);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, px = x + 0.5, py = y + 0.5;
      let d, s;
      if (py >= YT && py <= YB) {
        const dl = px - XL, dr = XR - px;
        if (dl < dr) (d = -dl), (s = sL + (py - YT));
        else (d = -dr), (s = sR + (YB - py));
      } else {
        let best = 1e9, q = cap[0];
        for (const c of cap) {
          const e = (c[0] - px) ** 2 + (c[1] - py) ** 2;
          if (e < best) (best = e), (q = c);
        }
        const ey = py < YT ? YT : YB, inside = ((px - CX) / RX) ** 2 + ((py - ey) / RY) ** 2 < 1;
        d = inside ? -sqrt(best) : sqrt(best);
        s = q[2];
      }
      TS[p] = s;
      const k = d > 2 ? 0 : d > 1 ? 1 : d > -1 ? 2 : d > -2 ? 3 : d > -3 ? 4 : 5;
      KIND[p] = k;
      if (k === 5) DIAG.push(p, x - DX0, y - DY0);
    }
}
// Lane LEDs by whole LED of arc, for drawing cars.
const LANE = Array.from({ length: NB }, () => []);
for (let p = 0; p < N; p++) if (KIND[p] === 2) LANE[floor(TS[p]) % NB].push(p);

export function setup(params) {
  params.s = {
    hue: -1, speed: 2, n: 0, a: 0.5, clock: 0, head: 0, cars: [],
    lineA: new Float32Array(DROWS * DCOL), lineF: new Float32Array(DROWS * DCOL), field: new Float32Array(DROWS * DCOL),
    lut: new Float32Array(66 * 6), buf: new Float32Array(N * 3), ready: false,
  };
}

// The colour of a speed, f = v / VMAX: brake red when stopped, amber at an
// eighth of top speed, the free-flow colour from a third of it.
function speedColour(f, mov) {
  if (f < 0.12) {
    const u = sm((f - 0.03) / 0.09);
    return [1, 0.06 + 0.44 * u, 0.03 * (1 - u)];
  }
  const u = sm((f - 0.12) / 0.23), c = [1 + (mov[0] - 1) * u, 0.5 + (mov[1] - 0.5) * u, mov[2] * u], m = max(c[0], c[1], c[2]);
  return [c[0] / m, c[1] / m, c[2] / m];
}

// One physics step of every driver: dv/dt = a (V(h) - v), with a little
// jitter in each driver's foot. A braking driver aims for 0 instead.
function step(S) {
  const cars = S.cars, n = cars.length;
  for (let i = 0; i < n; i++) {
    const c = cars[i], h = (cars[(i + 1) % n].x - c.x + L) % L || L;
    let acc = S.a * (V(h) - c.v);
    if (c.brake > 0) {
      acc = -2.5 * c.v;
      c.brake -= DT;
    }
    c.acc = acc + 0.06 * (Math.random() - 0.5);
  }
  for (const c of cars) {
    c.v = max(0, c.v + c.acc * DT);
    c.x = (c.x + c.v * DT) % L;
  }
  // No one drives into the car ahead.
  for (let i = 0; i < n; i++) {
    const c = cars[i], f = cars[(i + 1) % n], h = (f.x - c.x + L) % L;
    if (n > 1 && h < HMIN) {
      c.x = (f.x - HMIN + L) % L;
      c.v = min(c.v, f.v);
    }
  }
  if ((S.clock += DT) >= ROW - 1e-9) {
    S.clock -= ROW;
    record(S);
  }
}

// A new top row of the diagram: each car's stretch since the last row as a
// line one column wide, coloured by its speed, over the speed field between
// the cars, which shows dark red where the traffic stands.
function record(S) {
  const cars = S.cars, n = cars.length;
  S.head = (S.head + 1) % DROWS;
  const o = S.head * DCOL, A = S.lineA, F = S.lineF, G = S.field;
  A.fill(0, o, o + DCOL);
  G.fill(1, o, o + DCOL);
  for (const c of cars) {
    const c1 = (c.x / L) * DCOL;
    let c0 = c.pc < 0 ? c1 : c.pc;
    if (c0 > c1 + DCOL / 2) c0 -= DCOL;
    const lo = min(c1 - 0.5, c0 + 0.5), hi = c1 + 0.5, f = c.tr ? 2 : c.v / VMAX;
    for (let j = floor(lo); j <= floor(hi); j++) {
      const cov = min(hi, j + 1) - max(lo, j), jj = (j + DCOL) % DCOL;
      if (cov > A[o + jj] || (c.tr && cov > 0.3)) (A[o + jj] = cov), (F[o + jj] = f);
    }
    c.pc = c1;
  }
  for (let i = 0; i < n; i++) {
    const c = cars[i], d = cars[(i + 1) % n], x0 = (c.x / L) * DCOL;
    let x1 = (d.x / L) * DCOL;
    if (x1 <= x0) x1 += DCOL;
    const f0 = c.v / VMAX, f1 = d.v / VMAX;
    for (let j = ceil(x0 - 0.5); j <= floor(x1 - 0.5); j++) {
      const u = (j + 0.5 - x0) / (x1 - x0 || 1);
      G[o + (j % DCOL)] = f0 + (f1 - f0) * u;
    }
  }
}

// Cars evenly spaced at the equilibrium speed, then the diagram's whole
// height of history run at once, one driver lifting off a little at the
// start of it.
function begin(S) {
  const n = S.n, h0 = L / n, v0 = V(h0);
  S.cars = [];
  for (let i = 0; i < n; i++) S.cars.push({ x: i * h0, v: v0, acc: 0, brake: 0, pc: -1 });
  S.cars[0].v = v0 * 0.6;
  S.cars[0].tr = true;
  S.lineA.fill(0);
  S.field.fill(1);
  S.clock = 0;
  const steps = round((DROWS * ROW) / DT);
  for (let i = 0; i < steps; i++) step(S);
}

// K3 moved: one car joins in the widest gap or leaves the tightest.
function retune(S) {
  const cars = S.cars, n = cars.length;
  let best = -1, at = 0;
  for (let i = 0; i < n; i++) {
    const h = (cars[(i + 1) % n].x - cars[i].x + L) % L;
    if (S.n > n ? h > best : best < 0 || h < best) (best = h), (at = i);
  }
  if (S.n > n) {
    const a = cars[at], b = cars[(at + 1) % n];
    cars.splice(at + 1, 0, { x: (a.x + best / 2) % L, v: (a.v + b.v) / 2, acc: 0, brake: 0, pc: -1 });
  } else {
    if (cars[at].tr) cars[(at + 1) % n].tr = true;
    cars.splice(at, 1);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.speed = cl(k[1], 0.2, 3);
  S.a = cl(k[3], 0.5, 2.5);
  S.n = round(cl(k[2], 22, 44));
  if (!S.ready) {
    S.ready = true;
    begin(S);
  } else if (S.n !== S.cars.length) retune(S);
  if (input.btnPressed && input.btnPressed[0]) {
    let best = 1e9, who = S.cars[0];
    for (const c of S.cars) {
      const e = min(c.x, L - c.x);
      if (e < best) (best = e), (who = c);
    }
    who.brake = 2;
  }
  S.acc = (S.acc || 0) + d * S.speed * 2;
  while (S.acc >= DT) {
    S.acc -= DT;
    step(S);
  }
  // Hue: free flow from cyan green round to violet.
  const hue = cl(k[0], 0, 1);
  if (hue !== S.hue) {
    S.hue = hue;
    S.mov = hsv(0.42 + 0.4 * hue, 0.85, 1);
    // Lines: stopped cars bright, free ones dimmer, so the jams stand out
    // of the hatching; the last entry is the one white car. Under them the
    // speed field, dark red where the traffic stands.
    for (let i = 0; i <= 65; i++) {
      const f = i / 64, c = i > 64 ? [1, 1, 1] : speedColour(f, S.mov), b = i > 64 ? 1 : 0.95 - 0.45 * sm((f - 0.05) / 0.3), o = 6 * i, jam = 0.22 * sm(1 - f / 0.12);
      S.lut[o] = c[0] * b;
      S.lut[o + 1] = c[1] * b;
      S.lut[o + 2] = c[2] * b;
      S.lut[o + 3] = jam;
      S.lut[o + 4] = jam * 0.08;
      S.lut[o + 5] = jam * 0.12;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const buf = S.buf, lut = S.lut, mov = S.mov;
  buf.fill(0);
  // The diagram, newest row at the top.
  const A = S.lineA, F = S.lineF, G = S.field;
  for (let i = 0; i < DIAG.length; i += 3) {
    const p = DIAG[i], r = (S.head - DIAG[i + 2] + DROWS) % DROWS, o = r * DCOL + DIAG[i + 1];
    const g = 6 * round(cl(G[o], 0, 1) * 64), a = A[o] * (0.9 - (0.5 * DIAG[i + 2]) / DROWS), l = 6 * (F[o] > 1.5 ? 65 : round(cl(F[o], 0, 1) * 64)), q = 3 * p;
    buf[q] = lut[g + 3] + lut[l] * a;
    buf[q + 1] = lut[g + 4] + lut[l + 1] * a;
    buf[q + 2] = lut[g + 5] + lut[l + 2] * a;
  }
  // The road: dim kerbs tinted by the free-flow colour, dark lane, a white
  // start line at the bottom middle.
  const kerb = [0.12 + 0.08 * mov[0], 0.12 + 0.08 * mov[1], 0.12 + 0.08 * mov[2]];
  for (let p = 0; p < N; p++) {
    const k = KIND[p], q = 3 * p;
    if (k === 1 || k === 3) (buf[q] = kerb[0]), (buf[q + 1] = kerb[1]), (buf[q + 2] = kerb[2]);
    else if (k === 2) {
      const sl = TS[p] < 1 || TS[p] > LT - 1;
      buf[q] = sl ? 0.5 : 0.04;
      buf[q + 1] = sl ? 0.5 : 0.04;
      buf[q + 2] = sl ? 0.5 : 0.05;
    }
  }
  // Brake lights glow on the road round each braking car's tail.
  for (const c of S.cars) {
    if (c.acc > -0.12 && c.v > 0.08) continue;
    const s = (c.x / L) * LT, gx = SX[round(2 * s) % SX.length], gy = SY[round(2 * s) % SY.length];
    const amp = c.v < 0.08 ? 0.35 : 0.5;
    for (let y = floor(gy - 4); y <= ceil(gy + 4); y++)
      for (let x = floor(gx - 4); x <= ceil(gx + 4); x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const r = Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
        if (r > 4) continue;
        const w = amp * (1 - r / 4) ** 2, q = 3 * (y * W + x);
        buf[q] += w;
        buf[q + 1] += w * 0.06;
        buf[q + 2] += w * 0.04;
      }
  }
  // The cars: dashes three LEDs long, coloured by speed, tail lit red when braking.
  for (const c of S.cars) {
    const sr = (c.x / L) * LT, col = c.tr ? [1, 1, 1] : speedColour(c.v / VMAX, mov), braking = c.acc < -0.12 || c.v < 0.08;
    for (let b = floor(sr) - 1; b <= floor(sr) + 4; b++) {
      for (const p of LANE[((b % NB) + NB) % NB]) {
        let u = TS[p] - sr;
        if (u < -LT / 2) u += LT;
        if (u > LT / 2) u -= LT;
        const cov = min(u + 0.5, 3) - max(u - 0.5, 0);
        if (cov <= 0) continue;
        const q = 3 * p, w = min(1, cov);
        const tail = braking && u < 1, front = u > 2;
        const r = tail ? 1 : front ? 0.6 + 0.4 * col[0] : col[0], g = tail ? 0.05 : front ? 0.6 + 0.4 * col[1] : col[1], bl = tail ? 0.03 : front ? 0.6 + 0.4 * col[2] : col[2];
        buf[q] += (r - buf[q]) * w;
        buf[q + 1] += (g - buf[q + 1]) * w;
        buf[q + 2] += (bl - buf[q + 2]) * w;
      }
    }
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const q = 3 * p;
      display.setPixel(x, y, round(cl(buf[q], 0, 1) * 255), round(cl(buf[q + 1], 0, 1) * 255), round(cl(buf[q + 2], 0, 1) * 255));
    }
}
