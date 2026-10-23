// ===== Patternflow pattern =====
// Title:   Abyss
// Family:  ocean
// Idea:    One column of open sea, the 128 rows its depth, from god rays and sardines under the waves through the twilight and the black to a vent on the floor, with marine snow falling and a submersible diving.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 16, after the ocean's zones of light
// Round:   16
// ===============================
// @matrix 64x128
// @knobs Night=0..1, Speed=0.2..3, Current=-1..1, Bloom=0..1
//
// Knob 1: Night. Noon to midnight: the sky through the surface goes gold, then silver, and the lanternfish rise from the twilight to feed near the top, as they do every night.
// Knob 2: Speed. How fast the sea runs: at 2 the submersible reaches the floor in 20 seconds and a dive is 50; waves, fish and snow keep pace.
// Knob 3: Current. A current left or right under a wind that roughens the waves: the god rays break up and slide, the snow slants, the siphonophore streams out and the school faces upstream.
// Knob 4: Bloom. From the clear blue of an ocean gyre to a spring plankton bloom: the water greens, the light dies shallower and the snow thickens.
// Buttons: K1 tap drops a dead whale; it sinks the whole column, lighting up the plankton in the dark, and stays on the floor as a skeleton.

const W = 64;
const H = 128;
const N = W * H;
// Depth squeezes going down: the sunlit zone (to 200 m) is rows 0 to 42, the twilight zone
// (to 1000 m) rows 43 to 85, the midnight zone (to 4000 m) the rest down to the floor.
const FLOOR = 118;
const DARK = 90; // 1000 m: no sunlight below
// The vent's chimney: its column, and the row of its mouth.
const VX = 45;
const VTOP = 101;
// God rays are lines from a point RAY_D rows above the surface; RAY_U bins per unit slope.
const RAY_D = 46;
const RAY_U = 150;
// How much of its colour the floor shows with no lamp on it, as a low-light camera sees it.
const AMB = 0.26;
// One dive at Speed 2, in seconds: down, working at the vent, up, then 5 at the surface.
const DOWN = 20;
const WORK = 9;
const UP = 16;
const CYCLE = DOWN + WORK + UP + 5;
const LANT = 14;
const SNOW = 470;
const SPARK = 90;
const STEM = 54;

// The submersible, bow right: w hull, r sail, v viewport, l lamp, t thruster, g belly, k skid.
const SUB = ["......rr", "...wwwwwwww", ".wwwwwwwwwwww", "twwwwwwwwwwwvv", ".wwwwwwwwwwwwl", "..gggggggggg", "...k......k"];
const HULL = { w: [225, 228, 232], r: [230, 70, 30], g: [130, 135, 142], t: [90, 92, 96], k: [55, 56, 60], v: [200, 140, 60] };
// A female deep-sea anglerfish facing right: b body, t teeth, e eye, f fin.
const ANGLER = ["....bbbbb", "..bbbbbbbbb", "fbbbbbbbbbbb", "fbbbbbbbbbet", "fbbbbbbbbb", "fbbbbbbbbbt", "fbbbbbbbbbbbt", "..bbbbbbbbbb", "....bbbbbb"];
// A sperm whale's carcass, flukes on the left, and the skeleton it leaves.
const WHALE = ["..........xxxxxxxxx", "xx...xxxxxxxxxxxxxxx", ".xxxxxxxxxxxxxxxxxxx", "xx...xxxxxxxxxxxxxx", "..........xx"];
const BONES = ["....o.o.o.o.o.o", "....o.o.o.o.o.o.oooo", "oooooooooooooooooooo", "....o.o.o.o.o.o..ooo"];
// The sky seen up through the surface at noon, at sunset and under the moon.
const SKY = [[200, 235, 245], [250, 150, 60], [52, 64, 84]];
const SPINDLE = [1.4, 2.3, 2.5, 1.7];
// A sea pig in two steps.
const PIG = [
  [".o.o", "ooooo", "o.o.o"],
  [".o.o", "ooooo", ".ooo"],
];

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function smooth(a, b, v) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function add(buf, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] += r;
  buf[o + 1] += g;
  buf[o + 2] += b;
}

function set(buf, o, r, g, b) {
  buf[o] = r;
  buf[o + 1] = g;
  buf[o + 2] = b;
}

function sprite(art, x0, y0, fn) {
  for (let j = 0; j < art.length; j++)
    for (let i = 0; i < art[j].length; i++) {
      const x = x0 + i;
      const y = y0 + j;
      if (art[j][i] !== "." && x >= 0 && x < W && y >= 0 && y < H) fn(x, y, art[j][i], j, (y * W + x) * 3);
    }
}

function shade(P, o, r, g, b) {
  const L = P.lamp;
  set(P.buf, o, r * (AMB + 2.6 * L[o]), g * (AMB + 2.6 * L[o + 1]), b * (AMB + 2.6 * L[o + 2]));
}

const F = (n) => new Float32Array(n);
const rnd = (n, a, b) => F(n).map(() => a + Math.random() * b);

export function setup(params) {
  const P = params;
  Object.assign(P, { t: 0, drift: 0, night: 0, cur: 0, bloom: 0.06, started: false, knext: 0, kdebt: 0, pulse: 0 });
  Object.assign(P, { whale: false, wx: 0, wy: 0, skel: -1, pig: 10, sub: { x: 0, y: 0, on: 0, a: 1 } });
  Object.assign(P, { buf: F(N * 3), lamp: F(N * 3), rows: F(H * 4), sky: F(3), ray: F(256), floorCol: F(N * 3) });
  P.floorOn = new Uint8Array(N);
  P.floorY = new Int16Array(W);
  // The panel opens mid-dive, the submersible halfway down.
  P.subT = DOWN * 0.5;
  // Schooling fish keep about a body length apart, so the sardines sit on a loose lattice.
  const fx = [];
  const fy = [];
  for (let gy = -3; gy <= 3; gy++)
    for (let gx = -5; gx <= 5; gx++) {
      const x = (gx + (gy & 1) * 0.5) * 4.2 + (Math.random() - 0.5) * 1.2;
      const y = gy * 2.3 + (Math.random() - 0.5) * 0.8;
      if ((x / 16) ** 2 + (y / 7.2) ** 2 < 1) fx.push(x), fy.push(y);
    }
  P.fx = Float32Array.from(fx);
  P.fy = Float32Array.from(fy);
  P.fph = P.fx.map(() => Math.random() * 6.283);
  // Lanternfish: each one's depth by day, 400 to 800 m down, and by night near the top.
  P.lx = rnd(LANT, 4, 56);
  P.ly = F(LANT);
  P.ldir = new Int8Array(LANT).map(() => (Math.random() < 0.5 ? -1 : 1));
  P.lv = rnd(LANT, 1.6, 2.2);
  P.lday = rnd(LANT, 0, 2).map((v, i) => v + 50 + ((i * 5) % LANT) * 2.5);
  P.lnight = rnd(LANT, 0, 2).map((v, i) => v + 7 + ((i * 3) % LANT) * 2.4);
  P.lfl = F(LANT).fill(9);
  P.sx = rnd(SNOW, 0, W);
  P.sy = rnd(SNOW, 0, FLOOR);
  P.sv = rnd(SNOW, 0.5, 1.1);
  P.ss = rnd(SNOW, 0, 1).map((v) => (v < 0.22 ? 1 : 0.55 + 0.3 * Math.random()));
  // Flashes of bioluminescence: a copepod's spark lasts under a second, a shrimp's spat cloud two.
  Object.assign(P, { kx: F(SPARK), ky: F(SPARK), kage: F(SPARK).fill(9), klife: F(SPARK).fill(1) });
  bakeFloor(P);
}

// The floor's colours: silt with manganese nodules, the chimney, tube worms, and any skeleton.
function bakeFloor(P) {
  const lay = (x, y, r, g, b) => {
    set(P.floorCol, (y * W + x) * 3, r, g, b);
    P.floorOn[y * W + x] = 1;
  };
  P.floorCol.fill(0);
  P.floorOn.fill(0);
  for (let x = 0; x < W; x++) {
    const top = Math.round(FLOOR + 1.3 * Math.sin(x * 0.17 + 1) + 0.8 * Math.sin(x * 0.53) - (hash(x, 3) < 0.15 ? 1 : 0));
    P.floorY[x] = top;
    for (let y = top; y < H; y++) {
      const g = 0.82 + 0.3 * hash(x, y) - 0.04 * (y - top);
      lay(x, y, 112 * g, 104 * g, 90 * g);
    }
    if (hash(x, 9) < 0.18) lay(x, top, 34, 28, 26);
  }
  // The chimney: sulphide rock streaked with rust and sulphur.
  for (let y = VTOP; y < FLOOR + 2; y++) {
    const h = (y - VTOP) / (FLOOR - VTOP);
    const hw = 1.2 + 3.6 * h * h + (hash(y, 4) - 0.5) * 1.2;
    for (let x = Math.round(VX - hw); x <= Math.round(VX + hw); x++) {
      const s = hash(x, y * 7);
      if (s < 0.12) lay(x, y, 150, 86, 38);
      else if (s < 0.17) lay(x, y, 150, 140, 62);
      else lay(x, y, 80 + 20 * s, 66 + 14 * s, 58);
    }
  }
  [-8, -6, -5, 5, 6, 8, 9].forEach((d, i) => {
    const x = VX + d;
    const top = P.floorY[x] - 3 - Math.floor(hash(i, 5) * 4);
    for (let y = top; y < P.floorY[x]; y++) lay(x, y, 205, 205, 195);
    lay(x, top - 1, 220, 30, 30);
    lay(x + Math.sign(d), top - 1, 180, 20, 24);
  });
  if (P.skel >= 0) sprite(BONES, P.skel, 0, (x, y, c, j) => lay(x, P.floorY[x] - 3 + j, 226, 218, 192));
}

// The water's colour at each row: each channel dies with depth at its own rate, red within a
// few rows, green next, blue last. A bloom's chlorophyll eats the blue, so its water is green.
function bakeRows(P) {
  const n = P.night;
  const b = P.bloom;
  const day = 1 - smooth(0.22, 0.88, n);
  const sun = 0.1 + 0.9 * day * Math.sqrt(day);
  const warm = Math.exp(-(((n - 0.48) / 0.16) ** 2));
  const moon = smooth(0.6, 1, n);
  const dusk = smooth(0.12, 0.48, n);
  for (let c = 0; c < 3; c++) {
    const lit = SKY[0][c] + (SKY[1][c] - SKY[0][c]) * dusk;
    P.sky[c] = lit + (SKY[2][c] - lit) * moon;
  }
  const tr = sun * (1 + 0.5 * warm - 0.3 * moon) * (60 - 20 * b);
  const tg = sun * (1 - 0.08 * warm - 0.1 * moon) * (175 + 55 * b);
  const tb = sun * (1 - 0.15 * warm + 0.1 * moon) * (245 - 125 * b);
  for (let y = 0; y < H; y++) {
    const f = 1 - smooth(62, DARK, y);
    set(P.rows, y * 4, tr * Math.exp(-y / 4.5) * f, tg * Math.exp(-y / (18 - 6 * b)) * f, tb * Math.exp(-y / (44 - 24 * b)) * f);
    P.rows[y * 4 + 3] = 1.25 * Math.exp(-y / 24) * (1 - 0.55 * b) * (0.35 + 0.65 * day);
  }
  P.sun = sun;
}

// The waves focus sunlight into shafts: each bin is one line down from the point above, lit by
// where it crosses the waves. Wind adds short fast waves that break the shafts up.
function bakeRays(P) {
  const t = P.t;
  const rough = 0.8 * Math.abs(P.cur);
  for (let j = 0; j < 256; j++) {
    const s = 34 + ((j - 128) / RAY_U) * RAY_D + P.drift;
    const a =
      Math.sin(0.41 * s + t + 0.9 * Math.sin(0.16 * s - 0.45 * t)) +
      0.75 * Math.sin(0.73 * s - 1.6 * t + 1.3) +
      0.5 * Math.sin(1.21 * s + 2.2 * t + 0.4) +
      rough * (Math.sin(1.93 * s + 3.4 * t) + 0.7 * Math.sin(2.71 * s - 4.1 * t + 2));
    P.ray[j] = clamp((a + 0.3 + 0.4 * rough) / (1.95 + 1.2 * rough), 0, 1) ** 3;
  }
}

function spark(P, x, y, kind) {
  const i = (P.knext = (P.knext + 1) % SPARK);
  P.kx[i] = x;
  P.ky[i] = y;
  P.kage[i] = 0;
  P.klife[i] = kind ? 1.4 + Math.random() * 0.6 : 0.25 + Math.random() * 0.4;
}

// The submersible's place in its dive, and its lamps' angle below the horizon.
function placeSub(P) {
  const S = P.sub;
  const ph = P.subT % CYCLE;
  const ease = (f) => f - (0.4 * Math.sin(6.2832 * f)) / 6.2832;
  let y = 5 + 0.6 * Math.sin(P.t * 1.7);
  let x = 14;
  S.a = 1;
  if (ph < DOWN) {
    const e = ease(ph / DOWN);
    y = 5 + 90 * e;
    x = 14 + 9 * e;
  } else if (ph < DOWN + WORK) {
    const f = (ph - DOWN) / WORK;
    y = 95 + 1.5 * Math.sin(f * 3.14);
    x = 23 + 3 * Math.sin(f * 3.14);
    // The pilot sweeps the lamps over the chimney and back.
    S.a = 0.55 + 0.35 * Math.cos(f * 6.2832);
  } else if (ph < DOWN + WORK + UP) {
    const e = ease((ph - DOWN - WORK) / UP);
    y = 95 - 90 * e;
    x = 23 - 9 * e;
    S.a = 1.35;
  }
  S.x = x + P.cur * 10;
  S.y = y;
  S.on = ph < DOWN + WORK + UP ? smooth(9, 16, y) : 0;
}

export function update(dt, input, params) {
  const P = params;
  dt = Math.min(dt, 0.1);
  const k = input.knobValues || [0, 2, 0, 0.06];
  P.night = clamp(k[0], 0, 1);
  P.cur = clamp(k[2], -1, 1);
  P.bloom = clamp(k[3], 0, 1);
  const s = (dt * clamp(k[1], 0.2, 3)) / 2;
  P.t += s;
  P.drift += s * P.cur * 4;
  P.subT += s;
  placeSub(P);
  const S = P.sub;

  // Lanternfish swim to the depth of the hour at 7 rows a second; males flash a tail gland.
  const up = smooth(0.35, 0.85, P.night);
  for (let i = 0; i < LANT; i++) {
    const want = P.lday[i] + (P.lnight[i] - P.lday[i]) * up;
    P.ly[i] = P.started ? P.ly[i] + clamp(want - P.ly[i], -7 * s, 7 * s) : want;
    P.lx[i] = clamp(P.lx[i] + (P.ldir[i] * P.lv[i] + P.cur * 1.5) * s, 0, 63);
    if ((P.lx[i] - 31.5) * P.ldir[i] > 28.5 || Math.random() < 0.05 * s) P.ldir[i] *= -1;
    P.lfl[i] += s;
    if (P.lfl[i] > 9 && Math.random() < 0.12 * s) P.lfl[i] = 0;
  }
  P.started = true;

  const flakes = Math.round(110 + 360 * P.bloom);
  for (let i = 0; i < flakes; i++) {
    P.sy[i] += P.sv[i] * s;
    P.sx[i] = (P.sx[i] + (P.cur * 4 + 0.7 * Math.sin(P.t * 0.8 + i)) * s + W) % W;
    if (P.sy[i] >= P.floorY[Math.floor(P.sx[i])]) {
      P.sy[i] -= FLOOR;
      P.sx[i] = Math.random() * W;
    }
  }

  // Copepods spark in the dark, now and then a shrimp spits a cloud of light, and at night the
  // surface sparkles too. The submersible trips more as it passes.
  P.kdebt += s * (5 + 5 * up);
  for (; P.kdebt > 1; P.kdebt--) {
    const shallow = Math.random() < 0.45 * up;
    spark(P, Math.random() * W, shallow ? 3 + Math.random() * 40 : 52 + Math.random() * 64, !shallow && Math.random() < 0.13 ? 1 : 0);
  }
  if (S.y > 55 && Math.random() < 6 * s) spark(P, S.x - 7 + Math.random() * 14, S.y - 3 + Math.random() * 7, 0);
  for (let i = 0; i < SPARK; i++) P.kage[i] += s;

  P.pulse = (P.pulse + s) % 4;

  if (input.btnPressed && input.btnPressed[0]) Object.assign(P, { whale: true, wx: 4 + Math.floor(Math.random() * 18), wy: -4 });
  if (P.whale) {
    P.wy += 5 * s;
    if (P.wy > 50 && Math.random() < 30 * s) spark(P, P.wx + Math.random() * 20, P.wy - 3 + Math.random() * 7, 0);
    if (P.wy >= FLOOR - 4) {
      P.whale = false;
      P.skel = P.wx;
      bakeFloor(P);
    }
  }

  P.pig = P.pig > 34 ? -6 : P.pig + 0.35 * s;
}

// The lamps' light, warm near and blue-green further out as the water takes the red first;
// the beam lights the water itself faintly.
function lightLamps(P) {
  const L = P.lamp;
  L.fill(0);
  const S = P.sub;
  if (S.on < 0.01) return;
  const ox = S.x + 6.5;
  const oy = S.y + 1.5;
  const ca = Math.cos(S.a);
  const sa = Math.sin(S.a);
  const haze = (105 + 60 * P.bloom) * S.on;
  for (let y = Math.max(0, Math.floor(oy - 4)); y <= Math.min(H - 1, oy + 46); y++) {
    const dy = y + 0.5 - oy;
    for (let x = Math.max(0, Math.floor(ox - 46)); x <= Math.min(W - 1, ox + 46); x++) {
      const dx = x + 0.5 - ox;
      const r2 = dx * dx + dy * dy;
      const r = Math.sqrt(r2) + 0.01;
      const c = (dx * ca + dy * sa) / r;
      if (c < 0.88) continue;
      const I = (smooth(0.88, 0.965, c) * S.on * Math.exp(-r / 38)) / (1 + r2 / 500);
      const o = (y * W + x) * 3;
      set(L, o, I * Math.exp(-r / 16), I * Math.exp(-r / 40), I * Math.exp(-r / 60));
      add(P.buf, x, y, L[o] * haze, L[o + 1] * haze, L[o + 2] * haze);
    }
  }
}

export function draw(display, params) {
  const P = params;
  const buf = P.buf;
  const rows = P.rows;
  const L = P.lamp;
  const t = P.t;
  bakeRows(P);
  bakeRays(P);

  const xs = 34 + 2 * Math.sin(t * 0.3);
  for (let y = 0; y < H; y++) {
    const A = rows[y * 4 + 3];
    const inv = RAY_U / (y + RAY_D);
    for (let x = 0, o = y * W * 3; x < W; x++, o += 3) {
      const m = A > 0.02 ? 1 + A * (1.5 * P.ray[clamp(((x - xs) * inv + 128) | 0, 0, 255)] - 0.33) : 1;
      set(buf, o, rows[y * 4] * m, rows[y * 4 + 1] * m, rows[y * 4 + 2] * m);
    }
  }
  // The underside of the surface: the sky through Snell's window, and the waves.
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < W; x++) {
      const w = 0.5 + 0.5 * Math.sin(x * 0.45 + P.drift * 0.45 + t * 1.3 + Math.sin(x * 0.19 - t * 0.6) * 1.4);
      const v = (1 - y / 4) * (0.55 + 0.45 * w) + 0.8 * Math.exp(-(((x - xs) / 5) ** 2)) * (1 - y / 3.5);
      add(buf, x, y, v * P.sky[0], v * P.sky[1], v * P.sky[2]);
    }

  lightLamps(P);

  // The floor, and the vent's dull red glow, too faint for an eye but not for a camera.
  const glow = 0.75 + 0.25 * Math.sin(t * 7) * Math.sin(t * 3.1);
  for (let p = (VTOP - 1) * W; p < N; p++) {
    if (!P.floorOn[p]) continue;
    const o = p * 3;
    shade(P, o, P.floorCol[o], P.floorCol[o + 1], P.floorCol[o + 2]);
    const d2 = ((p % W) - VX) ** 2 + (Math.floor(p / W) - VTOP) ** 2;
    const v = d2 < 30 ? 95 * glow * Math.exp(-d2 / 5) : 0;
    set(buf, o, buf[o] + v, buf[o + 1] + v * 0.18, buf[o + 2] + v * 0.05);
  }

  // The black smoke hides the beam behind it, greys where the lamps catch it, reddens at its
  // root, where 350-degree water comes out.
  for (let y = VTOP - 30; y < VTOP; y++) {
    const h = VTOP - y;
    const cx = VX + P.cur * 0.016 * h * h + 1.1 * Math.sin(h * 0.3 - t * 2.1);
    const hw = 1 + h * 0.3;
    const red = 90 * glow * Math.exp(-h / 2.5);
    for (let x = Math.max(0, Math.ceil(cx - hw)); x <= Math.min(W - 1, cx + hw); x++) {
      const q = (x - cx) / hw;
      const d = (1 - q * q) * (0.72 + 0.14 * Math.sin(x * 1.3 + y * 0.9 + t * 3) + 0.14 * Math.sin(x * 0.7 - y * 1.7 + t * 4.1)) * (1 - h / 30);
      const o = (y * W + x) * 3;
      const k = 1 - 0.8 * d;
      set(buf, o, buf[o] * k + d * (62 * (0.08 + 2.2 * L[o]) + red), buf[o + 1] * k + d * (56 * (0.08 + 2.2 * L[o + 1]) + red * 0.15), buf[o + 2] * k + d * 52 * (0.08 + 2.2 * L[o + 2]));
    }
  }

  // A sea pig, the pink deep-sea cucumber, walks the silt on its tube feet.
  const px = Math.round(P.pig);
  sprite(PIG[Math.floor(t * 2) % 2], px, P.floorY[clamp(px + 2, 0, W - 1)] - 3, (x, y, c, j, o) => shade(P, o, 225, 165, 175));

  drawSiphonophore(P, buf);
  drawLanternfish(P, buf);
  drawAngler(P, buf);
  drawSchool(P, buf);

  const flakes = Math.round(110 + 360 * P.bloom);
  for (let i = 0; i < flakes; i++) {
    const y = Math.floor(P.sy[i]);
    if (y < 4) continue;
    const o = (y * W + Math.floor(P.sx[i])) * 3;
    const lit = P.ss[i] * (34 + 0.2 * rows[y * 4 + 2]);
    const k = 330 * P.ss[i];
    set(buf, o, buf[o] + lit * 0.95 + k * L[o], buf[o + 1] + lit + k * L[o + 1], buf[o + 2] + lit * 0.95 + k * L[o + 2]);
  }

  for (let i = 0; i < SPARK; i++) {
    const a = P.kage[i] / P.klife[i];
    if (a >= 1) continue;
    const cloud = P.klife[i] > 1;
    const R = cloud ? 1 + 4 * Math.sqrt(a) : 1.6;
    const v = cloud ? 150 * (1 - a) : (a < 0.15 ? a / 0.15 : (1 - a) / 0.85) * 230;
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -5; dx <= 5; dx++) {
        const q = 1 - (dx * dx + dy * dy) / (R * R);
        if (q > 0) add(buf, Math.round(P.kx[i]) + dx, Math.round(P.ky[i]) + dy, v * 0.25 * q, v * 0.68 * q, v * q);
      }
  }

  drawWhale(P, buf);
  drawSub(P, buf);

  for (let p = 0; p < N; p++) display.setPixel(p % W, (p / W) | 0, Math.min(255, buf[p * 3]), Math.min(255, buf[p * 3 + 1]), Math.min(255, buf[p * 3 + 2]));
}

// The siphonophore: one glassy stem, polyps every four LEDs trailing fishing tentacles.
function drawSiphonophore(P, buf) {
  const t = P.t;
  const cur = P.cur;
  const tx = 52 + 4 * Math.sin(t * 0.05);
  const ty = 46 + 1.5 * Math.sin(t * 0.13);
  const pp = P.pulse * 16;
  for (let i = 0; i < STEM; i++) {
    const s = i / STEM;
    const x = tx + cur * 15 * s * Math.sqrt(s) + 3 * s * Math.sin(i * 0.15 - t * 0.8);
    const iy = Math.round(ty + 8.5 + i * (0.95 - 0.3 * Math.abs(cur) * s));
    const v = 0.24 + 0.85 * Math.exp(-(((i - pp) / 2.5) ** 2));
    const ix = Math.round(x);
    add(buf, ix, iy, 70 * v, 120 * v, 230 * v);
    for (const e of [-1, 1]) add(buf, ix + e, iy, 21 * v, 36 * v, 70 * v);
    if (i % 4 === 2) {
      add(buf, ix, iy, 120 * v, 150 * v, 200 * v);
      for (let j = 1; j <= 4; j++)
        add(buf, Math.round(x + (cur >= 0 ? j : -j) * (0.3 + Math.abs(cur) * 0.7) + 0.5 * Math.sin(t + i)), iy + j, 26 * v, 40 * v, 80 * v);
    }
  }
  // On top a gas float, then four pairs of swimming bells, each pair beating after the last.
  const lit = 1 + 1.5 * Math.exp(-pp / 3);
  const cx = Math.round(tx);
  add(buf, cx, Math.round(ty) - 1, 95, 45, 34);
  for (let k = 0; k < 4; k++) {
    const sq = Math.max(0, Math.sin(t * 4.2 - k * 0.9)) ** 4;
    for (let r = 0; r < 2; r++) {
      const n = Math.round(SPINDLE[k] * (1 - 0.3 * sq) - r * 0.5);
      for (let d = -n; d <= n; d++) {
        const v = (Math.abs(d) === n ? 0.4 : 0.12) * lit;
        add(buf, cx + d, Math.round(ty + 0.5 + k * 2) + r, 90 * v, 150 * v, 255 * v);
      }
    }
  }
}

// Lanternfish show little but their photophores, belly lights that match the faint light from
// above and hide the fish's shadow.
function drawLanternfish(P, buf) {
  const D = [0, 0, -1, 1, -3, 1, -5, 1];
  for (let i = 0; i < LANT; i++) {
    const x = Math.round(P.lx[i]);
    const y = Math.round(P.ly[i] + 0.6 * Math.sin(P.t * 1.3 + i));
    const d = P.ldir[i];
    for (let j = 0; j < 11; j++) add(buf, x - d * (j >> 1), y + (j & 1), 10, 16, 24);
    const v = 0.75 + 0.25 * Math.sin(P.t * 2 + i * 1.7);
    for (let j = 0; j < D.length; j += 2) add(buf, x + d * D[j], y + D[j + 1], 50 * v, 150 * v, 240 * v);
    if (P.lfl[i] < 0.25) add(buf, x - d * 6, y, 200, 230, 255);
  }
}

// The anglerfish is black and shows only where its lure lights it: the jaw and needle teeth.
function drawAngler(P, buf) {
  const t = P.t;
  const ax = Math.round(5 + 3 * Math.sin(t * 0.07));
  const ay = Math.round(103 + 2 * Math.sin(t * 0.11));
  const lx = ax + 15 + 0.6 * Math.sin(t * 1.9);
  const ly = ay + 1 + 0.8 * Math.sin(t * 2.6);
  const pulse = 0.6 + 0.4 * Math.max(0, Math.sin(t * 1.3)) + (Math.sin(t * 9) > 0.97 ? 0.3 : 0);
  sprite(ANGLER, ax, ay, (x, y, c) => {
    const g = pulse / (1 + ((x - lx) ** 2 + (y - ly) ** 2) / 14);
    const k = c === "t" ? [250, 255, 245] : c === "e" ? [90, 170, 160] : [120, 96, 92];
    add(buf, x, y, k[0] * g, k[1] * g, k[2] * g);
  });
  for (let s = 0.1; s < 0.95; s += 0.12) {
    const u = 1 - s;
    const x = u * u * (ax + 8) + 2 * u * s * (ax + 15) + s * s * lx;
    const y = u * u * ay + 2 * u * s * (ay - 7) + s * s * (ly - 1);
    add(buf, Math.round(x), Math.round(y), 24 * pulse, 60 * pulse, 54 * pulse);
  }
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      const q = dx * dx + dy * dy;
      const g = q ? (pulse * 0.5) / (1 + q) : pulse * 1.3;
      add(buf, Math.round(lx) + dx, Math.round(ly) + dy, 70 * g, 235 * g, 205 * g);
    }
}

// The sardines wheel as one. Broadside a fish is a silver dash, darker to the tail; turning,
// it is seen end on and its flank throws the sun back, so a flash runs through the school.
function drawSchool(P, buf) {
  const t = P.t;
  const cur = P.cur;
  // Into a current the school holds station, facing upstream.
  const hold = Math.min(1, Math.abs(cur) * 1.4);
  const amp = 16 * (1 - 0.6 * hold);
  const cx = 32 - 12 * cur * hold + amp * Math.sin(t * 0.23);
  const cy = 22 + 6 * Math.sin(t * 0.29 + 1);
  const sun = P.sun;
  for (let i = 0; i < P.fx.length; i++) {
    const ox = P.fx[i];
    const oy = P.fy[i];
    // The leading side turns first; the turn reaches the far side 0.8 s later.
    const lag = (ox / 16) * 0.4 * Math.sign(Math.cos(t * 0.23)) + 0.4;
    const hx = Math.tanh(amp * 0.32 * Math.cos((t - lag) * 0.23)) * (1 - hold) - Math.sign(cur) * hold;
    const x = Math.round(cx + ox + 1.8 * Math.sin(oy * 0.45 + t * 0.7) + 0.5 * Math.sin(t * 1.7 + P.fph[i]));
    const y = Math.round(cy + oy + 1.1 * Math.sin(ox * 0.22 + t * 0.9));
    if (y < 4 || y > 44) continue;
    const dir = hx >= 0 ? 1 : -1;
    const len = Math.abs(hx) > 0.6 ? 3 : Math.abs(hx) > 0.25 ? 2 : 1;
    const g = Math.min(1, (1 - Math.abs(hx)) ** 3 * 1.3 + Math.max(0, Math.sin(t * 2.3 + P.fph[i] * 7)) ** 40);
    const light = sun * (0.35 + 0.65 * Math.min(1, P.rows[y * 4 + 2] / 170));
    for (let j = 0; j < len; j++) {
      const xx = x - dir * j;
      if (xx < 0 || xx >= W) continue;
      const o = (y * W + xx) * 3;
      const body = (j === 2 ? 0.45 : j === 1 ? 0.8 : 1) * light;
      const f = 1 - g;
      set(buf, o, (buf[o] * 0.25 + 120 * body) * f + 235 * g * sun, (buf[o + 1] * 0.25 + 160 * body) * f + 242 * g * sun, (buf[o + 2] * 0.25 + 190 * body) * f + 250 * g * sun);
    }
  }
}

// The carcass is lit as the water round it is; in the dark the plankton it hits lights its edges.
function drawWhale(P, buf) {
  if (!P.whale) return;
  const tick = Math.floor(P.t * 12);
  sprite(WHALE, P.wx, Math.round(P.wy), (x, y, c, j, o) => {
    const day = P.rows[clamp(y - 3, 0, H - 1) * 4 + 2] / 255;
    const sh = (j ? 0.8 : 1.4) * day;
    const i = x - P.wx;
    const edge = !j || j === 4 || [WHALE[j - 1][i], WHALE[j + 1][i], WHALE[j][i - 1], WHALE[j][i + 1]].some((n) => n !== "x");
    const g = edge ? clamp(1 - day * 4, 0, 1) * (hash(x * 31 + tick, y) < 0.35 ? 1 : 0.22) : 0;
    set(buf, o, 70 * sh + 260 * P.lamp[o] + 40 * g, 80 * sh + 250 * P.lamp[o + 1] + 120 * g, 95 * sh + 240 * P.lamp[o + 2] + 210 * g);
  });
}

function drawSub(P, buf) {
  const S = P.sub;
  const x0 = Math.round(S.x) - 7;
  const y0 = Math.round(S.y) - 3;
  sprite(SUB, x0, y0, (x, y, c, j, o) => {
    const lit = "kvl".includes(c) ? 1 : 0.78 + 0.22 * Math.min(1, (P.rows[y * 4 + 2] / 255) * 1.3) + (j < 2 ? 0.1 : 0) - (j > 4 ? 0.25 : 0);
    const h = HULL[c] || (S.on > 0.1 ? [255, 250, 225] : [110, 110, 110]);
    set(buf, o, h[0] * lit, h[1] * lit, h[2] * lit);
  });
  if (S.y > 7 && P.t % 2 < 0.1) add(buf, x0 + 6, y0, 255, 255, 255);
  if (S.on > 0.1)
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const g = dx || dy ? (S.on * 120) / (1 + dx * dx + dy * dy) : 0;
        add(buf, x0 + 13 + dx, y0 + 4 + dy, g, g, g * 0.9);
      }
}
