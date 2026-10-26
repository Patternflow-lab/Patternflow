// ===== Patternflow pattern =====
// Title:   Hawkes Process
// Family:  rhythm
// Idea:    Four streams of a mutually exciting Hawkes process run down the panel as a scrolling time line, each stream's intensity a filled band that jumps wide at every event and relaxes back, each event a pulse joined by a line to the event that begot it, so a burst shows as a tree growing up from one immigrant through its children and grandchildren, now and then into the next stream.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: self-exciting point process (Alan Hawkes, 1971), its cluster representation (Alan Hawkes and David Oakes, 1974), thinning simulation (Yosihiko Ogata, 1981), each event's parent drawn from the parts of the intensity (Jiancang Zhuang, Yosihiko Ogata and David Vere-Jones, 2002), time rescaling of the compensator (Yosihiko Ogata, 1988), pattern round 59
// Round:   59
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Branching=0.7..0.95, Decay=2..8
//
// Knob 1: Hue. Turns the bands and the events round the wheel together. At 0 the bands are teal, the immigrants pale gold and their descendants gold, yellow, lime and green by generation; at 0.25 violet bands with green trees, at 0.5 pink with blue, at 0.75 green with magenta. The bands skip orange, which reads brown when dim.
// Knob 2: Speed. At 2 the time line moves 16 rows a second, so the panel holds the last 8 seconds of the process, now at the top; at 0.2 it moves 1.6 rows a second and holds 80 seconds, at 3 it moves 24 and holds 5.3.
// Knob 3: Branching. n, the mean number of children of each event, 0.7 to 0.95. Each stream's mean rate is mu / (1 - n): at 0.7 it is 0.83 events a second, 27 on the panel, a cluster has 3.3 events on average and half the clusters are a lone immigrant; at 0.85 it is 1.7 a second and 6.7 to a cluster; at 0.95 it is 5 a second, 20 to a cluster, one cluster in 14 has 50 or more and every ten minutes or so one of several hundred fills the panel.
// Knob 4: Decay. beta, how fast an event's push fades, 2 to 8 a second. At 2 the push lasts 0.5 s on average, 8 rows, so a child comes about 8 rows above its parent and the trees stand tall; at 8 it lasts 2 rows, the bands are thin with sharp spikes and a burst lies almost flat across the streams. The push in a middle stream is n x beta x 0.7 a second, 0.98 at the opening, against 0.25 from the immigrants.

const W = 64, H = 128, LANES = 4, LW = W / LANES, MAXE = 4096;
// Immigrants per second in each stream, and rows the time line moves per second.
const MU = 0.25, V = 16;
// Where a child lands: its own stream 70% of the time, a neighbour the
// rest. The matrix is symmetric with rows summing to 1, so every event has
// Poisson(n) children whatever its stream and each stream's mean rate is
// mu / (1 - n).
const M = [
  [0.85, 0.15, 0, 0],
  [0.15, 0.7, 0.15, 0],
  [0, 0.15, 0.7, 0.15],
  [0, 0, 0.15, 0.85],
];
const { floor, min, max, abs, exp, log } = Math;
// The bands skip orange through lime, which reads brown and olive when dim.
const wheel = (h) => 0.28 + 0.74 * (h - floor(h));
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

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
    n: 0.7, beta: 2, T: 0, s: 0, E: new Float64Array(LANES), id: 0,
    t: new Float64Array(MAXE), x: new Float32Array(MAXE), lane: new Int8Array(MAXE), par: new Int32Array(MAXE), gen: new Int16Array(MAXE),
    rgb: new Float32Array(W * H * 3), lam: new Float32Array(H * LANES), hue: 0, c: [0, 0, 0],
  };
}

// The excitation of each stream at time s from every event kept, used
// when the knobs change n or beta.
function recompute(S) {
  S.E.fill(0);
  const a = S.n * S.beta;
  for (let id = max(0, S.id - MAXE); id < S.id; id++) {
    const i = id % MAXE, e = a * exp(-S.beta * (S.s - S.t[i]));
    for (let k = 0; k < LANES; k++) S.E[k] += e * M[S.lane[i]][k];
  }
}

function decayTo(S, s) {
  const f = exp(-S.beta * (s - S.s));
  for (let k = 0; k < LANES; k++) S.E[k] *= f;
  S.s = s;
}

// An event in stream k at time S.s. Its parent is drawn the way the
// intensity is made up: an immigrant with chance mu / lambda_k, else the
// child of event i with chance a M[lane_i][k] e^(-beta (s - t_i)) /
// lambda_k. That is the cluster process of Hawkes and Oakes read
// backwards, and it gives the trees their true law.
function addEvent(S, k) {
  const lam = MU + S.E[k], a = S.n * S.beta;
  let u = Math.random() * lam, par = -1;
  if (u >= MU) {
    u -= MU;
    for (let id = S.id - 1; id >= max(0, S.id - MAXE); id--) {
      const i = id % MAXE, c = a * M[S.lane[i]][k] * exp(-S.beta * (S.s - S.t[i]));
      par = id;
      u -= c;
      if (u < 0) break;
    }
  }
  const i = S.id % MAXE;
  S.t[i] = S.s;
  S.lane[i] = k;
  S.par[i] = par;
  S.gen[i] = par >= 0 && par > S.id - MAXE ? S.gen[par % MAXE] + 1 : 0;
  // Across its stream: near the parent if the parent shares the stream,
  // anywhere in it otherwise.
  const c = k * LW + LW / 2;
  let x = c + (Math.random() - 0.5) * (LW - 5);
  if (S.gen[i] > 0 && S.lane[par % MAXE] === k) x = cl(S.x[par % MAXE] + (Math.random() - 0.5) * 5, c - LW / 2 + 2.5, c + LW / 2 - 2.5);
  S.x[i] = x;
  S.id++;
  for (let j = 0; j < LANES; j++) S.E[j] += a * M[k][j];
}

// Ogata's thinning: between events every intensity only decays, so the
// total intensity now bounds it until the next event. Draw a gap from that
// bound, then keep the point with chance lambda(s) / bound.
function simulate(S, T, most) {
  for (let guard = 0; guard < most; guard++) {
    let bound = 0;
    for (let k = 0; k < LANES; k++) bound += MU + S.E[k];
    const w = -log(1 - Math.random()) / bound;
    if (S.s + w > T) {
      decayTo(S, T);
      return;
    }
    decayTo(S, S.s + w);
    let lam = 0;
    for (let k = 0; k < LANES; k++) lam += MU + S.E[k];
    if (Math.random() * bound > lam) continue;
    let u = Math.random() * lam, k = 0;
    for (; k < LANES - 1; k++) if ((u -= MU + S.E[k]) < 0) break;
    addEvent(S, k);
  }
  decayTo(S, T);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0.7, 2], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  const speed = cl(kv[1], 0.2, 3), n = cl(kv[2], 0.7, 0.95), beta = cl(kv[3], 2, 8);
  if (abs(n - S.n) > 1e-6 || abs(beta - S.beta) > 1e-6) {
    S.n = n;
    S.beta = beta;
    recompute(S);
  }
  // The first frame runs 30 seconds of the process at once, so the time
  // line opens full.
  S.T += S.T ? (d * speed) / 2 : 30;
  simulate(S, S.T, S.id ? 2000 : 40000);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, lam = S.lam, T = S.T, a = S.n * S.beta, b = S.beta;
  rgb.fill(0);
  // Row r is time T - r / V. The intensity of each stream at every row,
  // from the bottom row up, decaying and adding the events as it passes them.
  const t0 = T - (H - 0.5) / V, E = [0, 0, 0, 0];
  let id = max(0, S.id - MAXE);
  for (; id < S.id && S.t[id % MAXE] <= t0; id++) {
    const i = id % MAXE, e = a * exp(-b * (t0 - S.t[i]));
    for (let k = 0; k < LANES; k++) E[k] += e * M[S.lane[i]][k];
  }
  const first = id;
  let tp = t0;
  for (let r = H - 1; r >= 0; r--) {
    const tr = T - (r + 0.5) / V, f = exp(-b * (tr - tp));
    for (let k = 0; k < LANES; k++) E[k] *= f;
    for (; id < S.id && S.t[id % MAXE] <= tr; id++) {
      const i = id % MAXE, e = a * exp(-b * (tr - S.t[i]));
      for (let k = 0; k < LANES; k++) E[k] += e * M[S.lane[i]][k];
    }
    for (let k = 0; k < LANES; k++) lam[r * LANES + k] = MU + E[k];
    tp = tr;
  }
  // The bands: half-width 7.4 (1 - e^(-lambda / 0.8 beta)) LEDs, which
  // saturates at the edge of the stream. At the opening knobs the
  // immigrants alone keep it 2 LEDs wide and one event in a middle stream
  // widens it to 8.
  const band = hsv(wheel(0.36 + S.hue), 0.7, 1, S.c);
  const add = (x, y, c, v) => {
    if (x < 0 || x >= W || y < 0 || y >= H || v <= 0) return;
    const o = (y * W + x) * 3;
    rgb[o] += c[0] * v;
    rgb[o + 1] += c[1] * v;
    rgb[o + 2] += c[2] * v;
  };
  for (let r = 0; r < H; r++)
    for (let k = 0; k < LANES; k++) {
      // lam now holds the half-width, for the strokes below.
      const w = (lam[r * LANES + k] = (LW / 2 - 0.6) * (1 - exp(-lam[r * LANES + k] / (0.8 * b)))), c = k * LW + LW / 2;
      for (let x = k * LW; x < (k + 1) * LW; x++) {
        const dd = abs(x + 0.5 - c), cov = cl(w - dd + 0.5, 0, 1);
        if (cov <= 0) continue;
        const q = dd / max(0.5, w), g = w / (LW / 2);
        add(x, r, band, cov * (0.07 + 0.22 * g + 0.3 * q * q * q * q));
      }
    }
  // Each event is a jump in its stream's intensity: a bright stroke across
  // the band on the row where it happened.
  for (let j = first; j < S.id; j++) {
    const i = j % MAXE, y = floor((T - S.t[i]) * V), k = S.lane[i], c = k * LW + LW / 2;
    if (y < 0 || y >= H) continue;
    const w = lam[min(H - 1, y + 1) * LANES + k] * 0.5 + lam[y * LANES + k] * 0.5;
    for (let x = k * LW; x < (k + 1) * LW; x++) add(x, y, band, 0.35 * cl(w - abs(x + 0.5 - c) + 0.5, 0, 1));
  }
  // Parent to child, a line from row to row.
  const col = [0, 0, 0];
  for (let j = first; j < S.id; j++) {
    const i = j % MAXE, p = S.par[i];
    if (p < 0 || p <= S.id - MAXE) continue;
    const q = p % MAXE, y1 = (T - S.t[i]) * V, y0 = (T - S.t[q]) * V, x1 = S.x[i], x0 = S.x[q];
    const steps = max(1, Math.ceil(max(abs(y1 - y0), abs(x1 - x0))));
    hsv(0.08 + S.hue + 0.07 * S.gen[i], 0.6, 1, col);
    for (let s = 0; s <= steps; s++) {
      const f = s / steps, x = x0 + (x1 - x0) * f - 0.5, y = floor(y0 + (y1 - y0) * f), xi = floor(x), fx = x - xi;
      add(xi, y, col, 0.45 * (1 - fx));
      add(xi + 1, y, col, 0.45 * fx);
    }
  }
  // The events: pulses that flash as they happen.
  for (let j = first; j < S.id; j++) {
    const i = j % MAXE, y = (T - S.t[i]) * V, x = S.x[i], age = T - S.t[i];
    hsv(0.08 + S.hue + 0.07 * S.gen[i], S.gen[i] ? 0.55 : 0.2, 1, col);
    const rad = (S.gen[i] ? 1.3 : 1.9) + 1.5 * exp(-age * 4), pk = 0.9 + exp(-age * 4);
    for (let yy = floor(y - rad); yy <= y + rad; yy++)
      for (let xx = floor(x - rad); xx <= x + rad; xx++) {
        const dx = xx + 0.5 - x, dy = yy + 0.5 - y, d2 = (dx * dx + dy * dy) / (rad * rad);
        if (d2 < 1) add(xx, yy, col, pk * (1 - d2));
      }
  }
  for (let p = 0, o = 0; p < W * H; p++, o += 3)
    display.setPixel(p % W, (p / W) | 0, min(255, rgb[o] * 255) | 0, min(255, rgb[o + 1] * 255) | 0, min(255, rgb[o + 2] * 255) | 0);
}
