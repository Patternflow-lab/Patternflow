// ===== Patternflow pattern =====
// Title:   Crossroads
// Family:  city
// Idea:    A night avenue seen straight down from a drone and crossed by two side streets, where the cars show by their lights, the signals hold and release the queues, and people cross all four zebras at once while every car waits.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 17; the intelligent driver model of Treiber, Hennecke and Helbing (2000) and the all-way pedestrian phase of Seoul junctions
// Round:   17
// ===============================
// @matrix 64x128
// @knobs Lamps=0..1, Pace=0.2..3, Hour=0..1, Rain=0..1
//
// Knob 1: Lamps. At 0 every street lamp is low-pressure sodium and pools the road in orange; turned up, the city swaps them one at a time for white LED heads.
// Knob 2: Pace. The clock of the whole street: at 2 a car crosses the panel in about five seconds and the signals cycle every thirty, at 0.2 it all creeps.
// Knob 3: Hour. At 0 the evening rush, with queues at every red; turned up, traffic and people thin out, after 1 am every other lamp goes out, and past 3 am the signals flash amber on the avenue and red on the side streets.
// Knob 4: Rain. Darkens the asphalt to a mirror: each lamp glares under itself inside a haze of lit drops, signals and tail lights streak across the road, and people open umbrellas.

const W = 64;
const H = 128;
const N = W * H;
// First row of each side street, 12 rows across.
const JY = [30, 90];
// Lane centres. Traffic keeps right: down the panel on the west half of the
// avenue, up it on the east half; west on the north half of a side street.
const [SBO, SBI, NBI, NBO] = [22.5, 27.5, 36.5, 41.5];
const STEP = 0.25;
const cl = (v) => Math.min(1, Math.max(0, v));

// A movement is an approach (from the north, south, west, east) and a turn
// (0 straight on, 1 left, 2 right).
const mv = (a, t) => 1 << (a * 3 + t);
const all = (a) => 7 << (a * 3);
const SR = (a) => mv(a, 0) | mv(a, 2);
// The cycle in seconds at Pace 2: [length, green, amber, walk]. Each avenue
// direction leads with its left arrow, the side streets take turns, then
// every car waits while people cross all four zebras at once.
const PH = [
  [4, all(0), 0, 0], [1, SR(0), mv(0, 1), 0], [5, SR(0) | SR(1), 0, 0], [1.2, SR(1), SR(0), 0], [4, all(1), 0, 0], [1.2, 0, all(1), 0],
  [3, all(2), 0, 0], [1.2, 0, all(2), 0], [3, all(3), 0, 0], [1.2, 0, all(3), 0], [5, 0, 0, 1], [1.5, 0, 0, 2], [0.8, 0, 0, 0],
];
const CYCLE = PH.reduce((a, p) => a + p[0], 0);

// Low-pressure sodium burns in one orange line at 589 nm; LED heads are cool white.
const SODIUM = [1, 0.4, 0];
const LED = [0.86, 0.92, 1];
// Lamps [x, y, reach]: over both ends of the school street, two mid-block, and
// on opposite corners of each junction so the zebras stand in light. Between
// them the avenue is dark but for the cars.
const LAMPS = [
  [6, 36, 8], [42, 70, 8], [21, 58, 8], [57, 36, 8],
  ...JY.flatMap((y) => [[21, y - 1, 9], [42, y + 12, 9]]),
];
// The lamp at row 70 is dying and cycles: it goes out, strikes again in the
// red of its neon starter gas and warms back up to orange.
const DYING = 1;
// Red neon crosses on church roofs, as on every Seoul skyline.
const CROSSES = [[7, 9], [56, 63], [9, 115]];
// Lamp, headlight and tail light at their brightest, over albedo.
const [I_LAMP, I_HEAD, I_TAIL] = [10, 1, 7];
const AMBIENT = [0.13, 0.14, 0.18];
const RED = [1, 0.04, 0.03];
const GREEN = [0.05, 1, 0.5];
const SIG = [RED, [1, 0.5, 0], GREEN];
const GLASS = [0.03, 0.034, 0.04];
const AMBER = [255, 150, 0];
const BEAMS = [[1, 0.85, 0.6], [0.9, 0.95, 1]];
// Car paint and its odds: white and silver half the time, as on any Korean
// road, then black, grey, navy, red and orange taxis.
const PAINT = [[0.72, 0.72, 0.72], [0.48, 0.5, 0.53], [0.05, 0.05, 0.06], [0.2, 0.2, 0.22], [0.07, 0.09, 0.24], [0.55, 0.05, 0.04], [0.8, 0.4, 0.06]];
const PAINT_P = [0.3, 0.2, 0.17, 0.1, 0.07, 0.06, 0.1];
// Umbrellas: clear plastic from the convenience store most, then black, red,
// yellow and navy.
const UMBRELLA = [[0.7, 0.72, 0.75], [0.7, 0.72, 0.75], [0.05, 0.05, 0.08], [0.6, 0.05, 0.08], [0.75, 0.6, 0.05], [0.06, 0.12, 0.4]];
const PLUS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
// Walk lights laid in the kerb at both ends of every zebra, as at Seoul
// crossings: first LED and the way the strip runs.
const KERB = [[19, -6, 0, 1], [44, -6, 0, 1], [19, 14, 0, 1], [44, 14, 0, 1], [14, -1, 1, 0], [14, 12, 1, 0], [46, -1, 1, 0], [46, 12, 1, 0]];
// Signal heads by approach, from the junction's first row: first LED of the
// bar (red, amber, left arrow, green), the step along it, the way it faces.
const HEADS = [[23, 12, 1, 0, 0, -1], [40, -1, -1, 0, 0, 1], [44, 7, 0, 1, -1, 0], [19, 4, 0, -1, 1, 0]];

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function pick(list) {
  let r = Math.random();
  for (let i = 0; i < list.length; i++) if ((r -= list[i]) < 0) return i;
  return list.length - 1;
}

// A route: a path sampled every STEP pixels, the speed allowed at each sample,
// stop lines [s, junction, movement] and a turn [s0, s1, side]. Ops: ["t", c]
// on until x or y is c, ["s", j, m] a stop line, ["r", side, radius] a turn.
function route(x, y, hx, hy, ops) {
  const X = [x];
  const Y = [y];
  const C = [99];
  const stops = [];
  let turn = null;
  for (const op of ops) {
    const s = (X.length - 1) * STEP;
    if (op[0] === "s") stops.push([s, op[1], op[2]]);
    else if (op[0] === "t") {
      const n = Math.round((hx ? (op[1] - x) * hx : (op[1] - y) * hy) / STEP);
      for (let i = 1; i <= n; i++) X.push(x + hx * i * STEP), Y.push(y + hy * i * STEP), C.push(99);
      x += hx * n * STEP;
      y += hy * n * STEP;
    } else {
      const [, side, r] = op;
      const nx = side > 0 ? -hy : hy;
      const ny = side > 0 ? hx : -hx;
      const cx = x + r * nx;
      const cy = y + r * ny;
      const n = Math.round((Math.PI / 2) * r / STEP);
      turn = [s, s + n * STEP, side];
      for (let i = 1; i <= n; i++) {
        const a = (i / n) * (Math.PI / 2);
        X.push(cx - r * nx * Math.cos(a) + r * hx * Math.sin(a));
        Y.push(cy - r * ny * Math.cos(a) + r * hy * Math.sin(a));
        C.push(Math.sqrt(40 * r));
      }
      x = cx + r * hx;
      y = cy + r * hy;
      hx = nx;
      hy = ny;
    }
  }
  // Slow for a turn ahead at 25 px/s per second.
  for (let i = C.length - 2; i >= 0; i--) C[i] = Math.min(C[i], Math.sqrt(C[i + 1] * C[i + 1] + 50 * STEP));
  return { X, Y, C, stops, turn, len: (X.length - 1) * STEP };
}

// Eight entries, each a list of [odds, route].
function routes() {
  const [a, b] = JY;
  const st = (j, ap, t) => ["s", j, mv(ap, t)];
  // Along the avenue in lane x, through both junctions or turning t at one.
  const avenue = (x, up, t) => {
    const ap = up ? 1 : 0;
    const order = up ? [1, 0] : [0, 1];
    const ops = (at) => {
      const o = [];
      for (const j of order) {
        const y = JY[j];
        o.push(["t", up ? y + 20 : y - 8], st(j, ap, j === at ? t : 0));
        if (j === at)
          return o.concat(t === 2 ? [["t", up ? y + 13 : y - 1], ["r", 1, 3.5], ["t", up ? 78 : -14]] : [["t", up ? y + 9.5 : y + 2.5], ["r", -1, 7], ["t", up ? -14 : 78]]);
      }
      return o.concat([["t", up ? -14 : 142]]);
    };
    return [[0.7, -1], [0.15, order[0]], [0.15, order[1]]].map(([p, at]) => [p, route(x, up ? 142 : -14, 0, up ? -1 : 1, ops(at))]);
  };
  const E = [avenue(SBO, 0, 2), avenue(SBI, 0, 1), avenue(NBI, 1, 1), avenue(NBO, 1, 2)];
  JY.forEach((y, j) => {
    // Turned onto the avenue, on through the other junction if it is ahead.
    const down = j ? [["t", 142]] : [["t", b - 8], st(1, 0, 0), ["t", 142]];
    const up = j ? [["t", a + 20], st(0, 1, 0), ["t", -14]] : [["t", -14]];
    const side = (x, ly, h, sx, ap, ra, rt, la, lt) => [
      [0.45, route(x, ly, h, 0, [["t", sx], st(j, ap, 0), ["t", 64 - x]])],
      [0.3, route(x, ly, h, 0, [["t", sx], st(j, ap, 2), ["t", ra], ["r", 1, 3.5], ...rt])],
      [0.25, route(x, ly, h, 0, [["t", sx], st(j, ap, 1), ["t", la], ["r", -1, 7], ...lt])],
    ];
    E.push(side(-14, y + 9.5, 1, 12, 2, 19, down, 29.5, up), side(78, y + 2.5, -1, 52, 3, 45, up, 34.5, down));
  });
  return E;
}

// The ground as albedo per channel, and what each LED is: 0 roof, 1 road, 2 pavement.
function ground(S) {
  const { AR, AG, AB, kind } = S;
  const set = (p, r, g, b) => ((AR[p] = r), (AG[p] = g), (AB[p] = b));
  const paint = (p, v, yellow) => set(p, v, yellow ? v * 0.8 : v, yellow ? v * 0.2 : v);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const g = hash(x, y);
      let j = -1;
      let c = -1;
      for (let i = 0; i < 2; i++) if (y >= JY[i] - 20 && y < JY[i] + 32) (j = i), (c = y - JY[i]);
      const cross = c >= 0 && c < 12;
      const av = x >= 20 && x < 44;
      if (av || cross) {
        kind[p] = 1;
        const v = 0.12 * (0.85 + 0.3 * g);
        set(p, v, v, v * 0.95);
        // The first side street runs past a school and is paved red.
        if (j === 0 && cross && (x < 14 || x > 49)) set(p, v * 2.6, v * 0.3, v * 0.3);
        if (av && !cross) {
          if ((c >= -6 && c < -2) || (c >= 14 && c < 18)) !(x & 1) && paint(p, 0.42);
          else if ((c === -8 && x < 31) || (c === 19 && x > 32)) paint(p, 0.42);
          else if (x === 31 || x === 32) paint(p, 0.4, 1);
          else if ((x === 25 || x === 38) && y % 9 < 4) paint(p, 0.36);
        } else if (!av) {
          if ((x >= 14 && x < 18) || (x >= 46 && x < 50)) !(y & 1) && paint(p, 0.42);
          else if ((x === 12 && c > 6) || (x === 51 && c < 5)) paint(p, 0.42);
          else if (c === 5 || c === 6) paint(p, 0.4, 1);
        }
      } else if ((x >= 16 && x < 20) || (x >= 44 && x < 48) || (c >= -4 && c < 0) || (c >= 12 && c < 16)) {
        kind[p] = 2;
        const v = (x % 3 && y % 3 ? 0.15 : 0.12) + g * 0.02;
        set(p, v, v, v * 0.92);
      } else {
        set(p, 0.05, 0.05, 0.05);
      }
    }
}

// What each lamp reaches: the street under it, with its share of the light
// and of the wet glare, and the haze in the rain, brightest round the rim.
function pools(S) {
  S.pools = LAMPS.map(([hx, hy, R]) => {
    const o = { idx: [], w: [], g: [], hi: [], hw: [] };
    const r2 = R * 1.9;
    box(hx - r2, hy - r2, hx + r2, hy + r2, (x, y, p) => {
      const r = Math.hypot(x - hx, y - hy);
      if (r < R && S.kind[p]) o.idx.push(p), o.w.push(Math.min(1, (R - r) / 1.6) * (1 - 0.15 * (r / R) ** 2)), o.g.push(Math.exp((-r * r) / 3));
      if (r < r2) o.hi.push(p), o.hw.push(r < R ? 0.3 + 0.7 * (r / R) ** 2 : ((r2 - r) / (r2 - R)) ** 2);
    });
    return o;
  });
}

function newCar(R, e) {
  return { R, e, s: 0, v: 14, k: 0, wait: 0, brake: 0, vmax: 24 * (0.85 + Math.random() * 0.3), L: [5, 6, 6, 6, 7][Math.floor(Math.random() * 5)], col: PAINT[pick(PAINT_P)], led: +(Math.random() < 0.5), ph: Math.random() };
}

// A car's nose and heading (fx, fy, hx, hy), and its middle (cx, cy, bx, by).
function pose(c) {
  const { X, Y } = c.R;
  for (let k = 0; k < 2; k++) {
    const s = k ? c.s - c.L / 2 : c.s;
    const f = Math.min(Math.max(s / STEP, 0), X.length - 1.001);
    const i = Math.floor(f);
    const dx = X[i + 1] - X[i];
    const dy = Y[i + 1] - Y[i];
    const l = Math.hypot(dx, dy) || 1;
    const u = f - i + (s < 0 ? s / l : 0);
    if (k) (c.cx = X[i] + dx * u), (c.cy = Y[i] + dy * u), (c.bx = dx / l), (c.by = dy / l);
    else (c.fx = X[i] + dx * u), (c.fy = Y[i] + dy * u), (c.hx = dx / l), (c.hy = dy / l);
  }
}

// A signal for a movement: 0 red, 1 amber, 2 green, 3 and 4 flashing amber and red.
function signal(S, j, m) {
  if (S.flash) return m & (all(2) | all(3)) ? 4 : 3;
  const p = PH[S.ph[j]];
  return p[1] & m ? 2 : p[2] & m ? 1 : 0;
}

// Zebra w of junction j: 0 and 1 cross the avenue, 2 and 3 the side street.
// Returns the two ends and the way out, away from the junction.
function zebra(j, w) {
  const y0 = JY[j];
  if (w < 2) return [18, y0 + (w ? 16 : -4), 46, y0 + (w ? 16 : -4), 0, w ? 1 : -1];
  const x = w === 2 ? 16 : 48;
  return [x, y0 - 2, x, y0 + 14, w === 2 ? -1 : 1, 0];
}

// People walk to a corner, wait, cross on the walk phase, hurrying when it
// blinks, and walk off along the far pavement.
function stepPeople(S, dt, rate) {
  for (let i = 0; i < 16; i++)
    if (S.people.length < 60 && Math.random() < rate * dt) {
      const j = i >> 3;
      const w = (i >> 1) & 3;
      const e = i & 1;
      const z = zebra(j, w);
      const o = (Math.random() - 0.5) * 3;
      const tx = z[e * 2] + (z[4] ? o : 0);
      const ty = z[e * 2 + 1] + (z[5] ? o : 0);
      const d = 8 + Math.random() * 10;
      S.people.push({
        j, w, e, o, tx, ty, st: 0, life: 1, x: tx + z[4] * d, y: ty + z[5] * d,
        v: 3.5 + Math.random() * 2, delay: Math.random() * 1.2,
        umb: Math.floor(Math.random() * 6),
      });
    }
  for (const p of S.people) {
    const walk = PH[S.ph[p.j]][3];
    const z = zebra(p.j, p.w);
    if (p.st === 1) {
      if (walk !== 1 || (p.delay -= dt) > 0) continue;
      p.st = 2;
      p.tx = z[2 - p.e * 2] + (z[4] ? p.o : 0);
      p.ty = z[3 - p.e * 2] + (z[5] ? p.o : 0);
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const v = p.v * (p.st === 2 && walk === 2 ? 1.5 : 1) * dt;
    if (d > v) (p.x += (dx / d) * v), (p.y += (dy / d) * v);
    else if (p.st === 2) (p.st = 3), (p.tx = p.x + z[4] * 14), (p.ty = p.y + z[5] * 14);
    else if (p.st === 0) p.st = 1;
    else p.life = 0;
    if (p.st === 3) p.life = Math.min(p.life, d / 6);
  }
  S.people = S.people.filter((p) => p.life > 0);
}

function stepCars(S, dt, rate) {
  const cars = S.cars;
  for (let e = 0; e < 8; e++) {
    S.due[e] = Math.min(2, S.due[e] + dt * rate * (e < 4 ? 0.16 : 0.07));
    if (S.due[e] < 1) continue;
    const list = S.E[e];
    const R = list[pick(list.map((r) => r[0]))][1];
    if (cars.some((c) => c.e === e && c.s < c.L + 3)) continue;
    const c = newCar(R, e);
    pose(c);
    cars.push(c);
    S.due[e]--;
  }
  for (const c of cars) pose(c);
  for (const c of cars) {
    // The nearest thing ahead in the lane: a car, or someone on a zebra.
    let gap = 60;
    let lv = 0;
    const { fx, fy, hx, hy } = c;
    const see = (ox, oy, half, ov) => {
      const rx = ox - fx;
      const ry = oy - fy;
      const d = rx * hx + ry * hy - half;
      if (d > -2 * half && d < gap && Math.abs(rx * hy - ry * hx) < 2.6) (gap = d), (lv = ov);
    };
    for (const o of cars) if (o !== c) see(o.cx, o.cy, o.L / 2, o.v * (o.hx * hx + o.hy * hy));
    for (const p of S.people) if (p.st === 2) see(p.x, p.y, 0.5, 0);
    const st = c.R.stops[c.k];
    if (st) {
      const g = st[0] - c.s;
      if (g < -0.3) {
        c.k++;
        c.wait = 0;
      } else {
        const sg = signal(S, st[1], st[2]);
        // Stop for red, for amber with room to, a moment at a flashing red, and
        // on green when there is no room on the far side.
        const stop = !sg || (sg === 1 && g > (c.v * c.v) / 70 + 0.5) || (sg === 4 && c.wait < 1.2) || ((sg === 2 || sg === 3) && gap < g + 24 && lv < 3);
        if (stop && g < gap) (gap = g), (lv = 0);
        if (sg === 4 && g < 1.5 && c.v < 0.5) c.wait += dt;
      }
    }
    // The intelligent driver model in pixels and seconds.
    const v0 = Math.min(c.vmax * (S.flash ? 1.2 : 1), c.R.C[Math.min(c.R.C.length - 1, Math.max(0, Math.round(c.s / STEP)))]);
    const ss = 1.2 + Math.max(0, c.v * 0.5 + (c.v * (c.v - lv)) / 70);
    const acc = Math.max(-160, 30 * (1 - (c.v / v0) ** 4 - (ss / Math.max(gap, 0.05)) ** 2));
    c.v = Math.max(0, c.v + acc * dt);
    c.s += Math.min(c.v * dt, Math.max(0, gap - 0.4));
    c.brake = acc < -6 || c.v < 1;
  }
  S.cars = cars.filter((c) => c.s < c.R.len);
}

function step(S, dt, k) {
  S.clk += dt;
  S.flash = k[2] > 0.8;
  for (let j = 0; j < 2; j++) {
    let c = (S.clk + j * 5) % CYCLE;
    let i = 0;
    while (c >= PH[i][0]) c -= PH[i++][0];
    S.ph[j] = i;
  }
  stepCars(S, dt, (1 - 0.94 * k[2]) ** 1.5);
  stepPeople(S, dt, 0.06 * (1 - k[2]) ** 2);
}

export function setup(params) {
  Object.assign(params, {
    AR: new Float32Array(N), AG: new Float32Array(N), AB: new Float32Array(N), kind: new Uint8Array(N),
    L: new Float32Array(N * 3), buf: new Float32Array(N * 3), amb: new Float32Array(N * 3).map((_, i) => AMBIENT[i % 3]),
    E: routes(), cars: [], people: [], due: new Float32Array(8), ph: [0, 0], clk: 0, t: 0, k: null,
    // Which lamp the city replaces first.
    order: LAMPS.map((_, i) => i).sort(() => Math.random() - 0.5),
  });
  ground(params);
  pools(params);
}

export function update(dt, input, params) {
  const S = params;
  dt = Math.min(Math.max(dt || 0, 0), 0.1);
  const kv = input.knobValues || [];
  const k = [kv[0] ?? 0, kv[1] ?? 2, kv[2] ?? 0, kv[3] ?? 0.06];
  const m = k[1] / 2;
  // Twenty seconds to fill the street, then ten at the knobs' pace, so the
  // knobs have placed the queues and the signals by the first frame.
  if (!S.k) for (let i = 0; i < 350; i++) step(S, i < 200 ? 0.1 : m / 15, k);
  S.k = k;
  S.t += dt;
  step(S, dt * m, k);
}

// Add colour c times v to the buffer A at LED p.
const add = (A, p, c, v) => ((A[(p *= 3)] += c[0] * v), (A[p + 1] += c[1] * v), (A[p + 2] += c[2] * v));

// Call f(x, y, p) for each LED of a box, clipped to the panel.
function box(x0, y0, x1, y1, f) {
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, x1); x++) f(x, y, y * W + x);
}

// Light c from (x0, y0) along (hx, hy) out to len: strength I falling as
// (1 - t) ** q, or 1 - t ** -q for negative q, from w0 to w1 wide. With len 0,
// a disc of radius w0 + 1.
function beam(L, x0, y0, hx, hy, len, w0, w1, I, q, c) {
  const r = Math.max(w0, w1) + 1;
  box(Math.min(x0, x0 + hx * len) - r, Math.min(y0, y0 + hy * len) - r, Math.max(x0, x0 + hx * len) + r, Math.max(y0, y0 + hy * len) + r, (x, y, p) => {
    const rx = x + 0.5 - x0;
    const ry = y + 0.5 - y0;
    const t = len && (rx * hx + ry * hy) / len;
    const e = w0 + (w1 - w0) * t + 1 - Math.abs(rx * hy - ry * hx);
    const v = !len ? I * (1 - Math.hypot(rx, ry) / r) : t > 0 && t < 1 && e > 0 ? I * (q >= 0 ? (1 - t) ** q : 1 - t ** -q) * Math.min(1, e) : 0;
    if (v > 0) add(L, p, c, v);
  });
}

export function draw(display, params) {
  const S = params;
  if (!S.k) return;
  const { L, buf, AR, AG, AB, kind } = S;
  const [k0, , hour, rain] = S.k;
  const wet = cl((rain - 0.08) / 0.5);
  L.set(S.amb);
  // After 1 am every other lamp goes out and the rest dim.
  const dim = cl((hour - 0.4) / 0.2);
  const lamps = LAMPS.map((_, i) => {
    const led = (S.order.indexOf(i) + 0.5) / LAMPS.length < k0;
    let c = led ? LED : SODIUM;
    let lv = 1 - (i & 1 ? 0.9 : 0.25) * dim;
    if (i === DYING && !led) {
      const t = (S.clk + 8.9) % 16;
      const u = cl((t - 12.3) / 3.7);
      lv *= t < 9 ? 1 : t < 9.4 ? (9.4 - t) / 0.4 : t < 12 ? 0 : t < 12.3 ? 0.2 : 0.2 + 0.8 * u;
      if (t > 12) c = [1, 0.12 + 0.38 * u, 0.15 * (1 - u)];
    }
    const { idx, w, g } = S.pools[i];
    for (let n = 0; n < idx.length; n++) add(L, idx[n], c, I_LAMP * lv * (w[n] + wet * 4 * g[n]));
    return [c, lv];
  });
  const blink = S.t % 1 > 0.5;
  const lit = [];
  for (let j = 0; j < 2; j++) {
    const y0 = JY[j];
    for (let a = 0; a < 4; a++) {
      const [x, y, sx, sy, fx, fy] = HEADS[a];
      const s0 = signal(S, j, mv(a, 0));
      const on = [!s0 || (s0 === 4 && blink), s0 === 1 || (s0 === 3 && blink), signal(S, j, mv(a, 1)) === 2, s0 === 2];
      // A lit lamp hazes the road under it, and on wet asphalt streaks toward
      // the drivers.
      for (let i = 0; i < 4; i++)
        if (on[i]) {
          const c = SIG[Math.min(i, 2)];
          const lx = x + sx * i + 0.5;
          const ly = y0 + y + sy * i + 0.5;
          lit.push([lx, ly, c, 0, 0, 1]);
          beam(L, lx, ly, 0, 0, 0, 1.2, 0, 6, 0, c);
          if (wet) beam(L, lx, ly, fx, fy, 2.2 + wet * 6, 0, 0, 4 * wet, 1, c);
        }
    }
    const walk = PH[S.ph[j]][3];
    const g = walk === 1 || (walk === 2 && S.t % 0.6 < 0.3);
    if (!S.flash && (g || walk !== 2))
      for (const [x, y, dx, dy] of KERB) {
        const c = g ? GREEN : RED;
        lit.push([x, y0 + y, c, dx, dy, 4]);
        beam(L, x + 0.5 - dx, y0 + y + 0.5 - dy, dx, dy, 5, 0.8, 0.8, 2.6, 0, c);
      }
  }
  for (const c of S.cars) {
    beam(L, c.fx, c.fy, c.hx, c.hy, 8, 1.3, 4.5, I_HEAD * (1 - wet * 0.4), 2, BEAMS[c.led]);
    beam(L, c.cx - c.bx * c.L * 0.5, c.cy - c.by * c.L * 0.5, -c.bx, -c.by, 5.5 + wet * 5, 1.2, 1.2, I_TAIL * (c.brake ? 1 : 0.35), -3, RED);
  }
  // Each channel rolls off on its own, as film does, so paint too bright for
  // the orange light burns through to yellow.
  const roll = (v) => (v < 200 ? v : 255 - 55 * Math.exp((200 - v) / 55));
  const shade = (q, r, g, b) => ((buf[q] = roll(r)), (buf[q + 1] = roll(g)), (buf[q + 2] = roll(b)));
  const aw = 255 * (1 - wet * 0.7);
  for (let p = 0, q = 0; p < N; p++, q += 3) {
    const a = kind[p] ? aw : 255;
    shade(q, AR[p] * L[q] * a, AG[p] * L[q + 1] * a, AB[p] * L[q + 2] * a);
  }
  // Cars: the body in the light where it stands, dark glass fore and aft.
  for (const c of S.cars) {
    const h = c.L / 2;
    box(c.cx - h - 1, c.cy - h - 1, c.cx + h + 1, c.cy + h + 1, (x, y, p) => {
      const rx = x + 0.5 - c.cx;
      const ry = y + 0.5 - c.cy;
      const u = rx * c.bx + ry * c.by;
      if (Math.abs(u) >= h || Math.abs(ry * c.bx - rx * c.by) >= 1.5) return;
      const f = (h - u) / c.L;
      const glass = (f > 0.22 && f < 0.4) || (f > 0.74 && f < 0.88);
      const [r, g, b] = glass ? GLASS : c.col;
      const sh = glass ? 255 : 166;
      shade(p * 3, r * L[p * 3] * sh, g * L[p * 3 + 1] * sh, b * L[p * 3 + 2] * sh);
    });
  }
  const put = (x, y, r, g, b, more) => {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const q = (y * W + x) * 3;
    buf[q] = r + (more ? buf[q] : 0);
    buf[q + 1] = g + (more ? buf[q + 1] : 0);
    buf[q + 2] = b + (more ? buf[q + 2] : 0);
  };
  // People: a dark speck and its shadow in the light, a coat the shop
  // windows catch out of it, a phone in some hands, umbrellas in the rain.
  for (const p of S.people) {
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
    const q = (y * W + x) * 3;
    const f = p.life;
    if (rain > 0.25) {
      const u = UMBRELLA[p.umb];
      for (const [dx, dy] of PLUS) put(x + dx, y + dy, Math.max(24, u[0] * L[q] * 200) * f, u[1] * L[q + 1] * 200 * f, u[2] * L[q + 2] * 200 * f);
      continue;
    }
    if (Math.max(buf[q], buf[q + 1]) > 70)
      for (let c = 0; c < 3; c++) {
        buf[q + c] *= 1 - 0.88 * f;
        buf[q + (W + 1) * 3 + c] *= 1 - 0.65 * f;
      }
    else put(x, y, 52 * f, 46 * f, 40 * f);
    if (p.o > 0.6) put(x + 1, y, 80 * f, 100 * f, 150 * f);
  }
  // Car lights: headlamps, tail lamps and the brake light between them, and
  // the indicator on the side a car turns to.
  for (const c of S.cars) {
    const h = c.L / 2 - 0.5;
    const t = c.R.turn;
    const ind = t && c.s > t[0] - 30 && c.s < t[1] + 2 && (S.clk * 1.5 + c.ph) % 1 < 0.5 ? t[2] : 0;
    for (let sd = -1; sd < 2; sd += 2) {
      const ax = c.cx - c.by * sd;
      const ay = c.cy + c.bx * sd;
      put(ax + c.bx * h, ay + c.by * h, ...(ind === sd ? AMBER : c.led ? [235, 242, 255] : [255, 225, 170]));
      put(ax - c.bx * h, ay - c.by * h, ...(ind === sd ? AMBER : c.brake ? [255, 18, 8] : [200, 8, 5]));
    }
    if (c.brake) put(c.cx - c.bx * h, c.cy - c.by * h, 200, 10, 5);
  }
  // Signal and walk lights, lamp heads, church crosses.
  for (const [x, y, c, dx, dy, n] of lit) for (let i = 0; i < n; i++) put(x + dx * i, y + dy * i, c[0] * 255, c[1] * 255, c[2] * 255);
  LAMPS.forEach(([x, y], i) => put(x, y, ...lamps[i][0].map((v) => v * 255 * lamps[i][1])));
  for (const [x, y] of CROSSES) for (let i = 0; i < 7; i++) put(x, y + i, 255, 20, 30), i < 5 && put(x - 2 + i, y + 2, 255, 20, 30);
  // Rain round each lamp: a haze in its colour, and drops flashing through it.
  if (wet)
    lamps.forEach(([c, lv], i) => {
      const { hi, hw } = S.pools[i];
      for (let n = 0; n < hi.length; n++) add(buf, hi[n], c, 120 * wet * lv * hw[n] * (Math.random() < 0.04 * wet ? 3 : 1));
    });
  // Below 3 of 255 an LED is off.
  for (let p = 0, q = 0; p < N; p++, q += 3)
    if (buf[q] > 3 || buf[q + 1] > 3 || buf[q + 2] > 3) display.setPixel(p % W, (p / W) | 0, Math.min(255, buf[q]) | 0, Math.min(255, buf[q + 1]) | 0, Math.min(255, buf[q + 2]) | 0);
}
