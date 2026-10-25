// ===== Patternflow pattern =====
// Title:   Poltergeist
// Family:  halloween
// Idea:    In a dim parlour lit by a hanging oil lamp, an unseen spirit gets restless: books fly off the shelf flapping open like birds, plates spin up off the table and circle the lamp, the chair rises and tilts, the picture swings crooked and the clock hands race backwards, each flying thing trailing green ectoplasm, until everything drops at once with a crash, the lamp gutters, and after a pause it starts again.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 45
// Round:   45
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Fury=1..5, Lamp=0..1
//
// Knob 1: Hue. The colour of the ectoplasm the spirit and the flying things trail, and of the mist it leaves pooled on the floor: toxic green at 0, cyan at 0.2, blue at 0.3, violet at 0.45, pink at 0.55, orange at 0.78 and yellow at 0.86. The lamplight and the room stay orange and purple.
// Knob 2: Speed. At 2 one haunting takes about 10 seconds: 1.2 quiet, 1.2 of rattling, 5 in the air, a crash, and 1.6 while the lamp gutters; the first things lift at 1.8 seconds. At 0.2 it all runs ten times slower, at 3 half as fast again.
// Knob 3: Fury. How many things fly and how wildly. At 1 two books, one plate and the chair, which rocks about 2 LEDs off the floor; at 3 four books, three plates and the chair about 10 LEDs up; at 5 all six books and all four plates, flying half as fast again in loops a third wider, and the chair about 19 LEDs up.
// Knob 4: Lamp. How far the hanging lamp swings, so its pool of light sweeps the walls and the things in the air: at 0 a sway of 4 degrees, at 0.06 6 degrees, at 1 a swing of 30 degrees either way. While things fly the spirit pushes it further, half as far again at Fury 1 and 2.2 times at Fury 5, never past 45 degrees.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, round, sqrt, sin, cos, exp, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => {
  const t = cl(v, 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = (a, b) => a + (b - a) * Math.random();

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The room. The lamp hangs on a chain from a hook above the panel; the
// wall runs down to the chair rail, then panelling, then the floor.
const HOOK_X = 32, CHAIN = 40, RAIL = 84, BASE = 104;
// The table: its top and its two ends.
const TOP = 93, TX0 = 5, TX1 = 37;
// The shelf on the right wall, and the books on it.
const SHELF = 60, SX0 = 40, SX1 = 62;
// The chair's resting place: the middle of its seat.
const CHX = 51, CHY = 98;
// Picture frame on a nail, and the clock.
const NAIL_X = 14, NAIL_Y = 7, FW = 16, FH = 20;
const CLX = 52, CLY = 20, CLR = 8;

// The lamplight on a surface, as a ramp from purple shadow through rose to
// orange and yellow. Light is quantised into eleven steps: the steps do not
// show on the panel and a smooth glow would only add noise.
const RAMP = [
  [0, [0.05, 0.012, 0.09]],
  [0.14, [0.15, 0.04, 0.24]],
  [0.3, [0.36, 0.08, 0.42]],
  [0.46, [0.8, 0.22, 0.36]],
  [0.62, [1, 0.46, 0.1]],
  [0.8, [1, 0.7, 0.22]],
  [1, [1, 0.9, 0.55]],
];
const LUT = [];
for (let n = 0; n <= 10; n++) {
  const f = n / 10;
  let k = 1;
  while (k < RAMP.length - 1 && RAMP[k][0] < f) k++;
  const [f0, c0] = RAMP[k - 1], [f1, c1] = RAMP[k], u = cl((f - f0) / (f1 - f0), 0, 1);
  LUT.push([0, 1, 2].map((i) => c0[i] + (c1[i] - c0[i]) * u));
}
const ramp = (f) => LUT[cl(round(f * 10), 0, 10)];

// Book covers (no dark warm colours: they read brown), and the pages.
const COVERS = [[0.2, 0.75, 0.7], [0.55, 0.3, 1], [0.95, 0.85, 0.6], [0.3, 0.9, 0.35], [1, 0.35, 0.55], [0.35, 0.5, 1]];
const PAGES = [1, 0.95, 0.82];

// One haunting, in story seconds: quiet, rattling, in the air, the drop,
// and the hush while the lamp gutters.
const QUIET = 1.2, STIR = 1.2, FLY = 5, HUSH = 1.6;

function newThing(kind, k) {
  const book = kind === 0;
  return {
    kind, k, x: 0, y: 0, rx: book ? SX0 + 2 + 3.3 * k : 9 + 7.5 * k, ry: book ? SHELF - 4 : TOP - 1,
    // Where it lies: 0 standing on the shelf, 1 flat on the table or floor.
    pose: book ? 0 : 1, state: "rest", lift: 0, vx: 0, vy: 0, tilt: 0,
    // Its own loop through the room: frequencies, phases, size.
    w1: rnd(0.55, 0.85) * (Math.random() < 0.5 ? -1 : 1), w2: rnd(0.9, 1.4), p1: rnd(0, TAU), p2: rnd(0, TAU),
    ax: rnd(16, 24), ay: rnd(16, 28), cy: book ? rnd(44, 60) : rnd(40, 56), flap: rnd(0, TAU), spin: rnd(0, TAU),
    col: COVERS[k % COVERS.length],
  };
}

export function setup(params) {
  const tex = new Float32Array(N);
  // How much lamplight each surface returns: striped wallpaper, a chair rail,
  // panelling and floorboards.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let f = 1;
      if (y < RAIL) f = x % 6 === 0 ? 0.84 : (x + 3) % 6 === 0 && (y >> 2) % 2 ? 0.92 : 1;
      else if (y < RAIL + 2) f = 1.05;
      else if (y < BASE) f = x % 11 === 0 || y === RAIL + 3 || y === BASE - 2 ? 0.45 : 0.72;
      else if (y < BASE + 2) f = 0.4;
      else f = (y - BASE) % 5 === 0 ? 0.35 : 0.58;
      tex[y * W + x] = f;
    }
  const things = [];
  for (let k = 0; k < 6; k++) things.push(newThing(0, k));
  for (let k = 0; k < 4; k++) things.push(newThing(1, k));
  params.s = {
    t: 0, hue: 0, speed: 2, fury: 1, lampK: 0.06,
    phase: "quiet", pt: QUIET - 0.6, age: 0,
    lampA: 0.1, lampP: 0, glow: 1, gutter: 0,
    pic: 0.06, picV: 0, hands: [0.4, 2.2],
    chair: { h: 0, tilt: 0, vh: 0, lift: 0 },
    mist: 0, shake: 0, crashed: false,
    things, dust: [], tex,
    E: new Float32Array(N), F: new Float32Array(N * 3), L: new Float32Array(N),
    lx: HOOK_X, ly: CHAIN,
  };
}

// Where a flying thing wants to be at story time a: a loop of its own
// through the room, wider and faster with Fury.
function path(S, o, a) {
  const g = 0.75 + 0.12 * S.fury, sz = 0.8 + 0.07 * S.fury;
  return [
    cl(32 + o.ax * sz * sin(o.w1 * g * a + o.p1) + 4 * sin(2.3 * o.w2 * g * a), 5, 59),
    cl(o.cy + o.ay * sz * 0.8 * sin(o.w2 * g * a + o.p2), 8, 100),
  ];
}

function flying(S) {
  const f = S.fury;
  const books = round(0.5 + f), plates = round(0.75 * f + 0.25);
  return (o) => (o.kind === 0 ? o.k < min(6, books) : o.k < min(4, plates));
}

function startPhase(S, ph) {
  S.phase = ph;
  S.pt = 0;
  if (ph === "fly") {
    const flies = flying(S);
    let n = 0;
    for (const o of S.things)
      if (flies(o)) {
        o.state = "lift";
        o.lift = -0.18 * n++;
        o.x = o.rx;
        o.y = o.ry;
      }
  }
  if (ph === "drop") {
    // Everything lets go at once: each thing keeps the speed it had.
    for (const o of S.things) {
      // A thing still waiting its turn to lift stays where it is.
      if (o.state === "lift" && o.lift <= 0) o.state = "rest";
      if (o.state === "lift" || o.state === "fly") {
        o.state = "fall";
        const [ax, ay] = path(S, o, S.age), [bx, by] = path(S, o, S.age + 0.05);
        o.vx = ((bx - ax) / 0.05) * 0.5;
        o.vy = ((by - ay) / 0.05) * 0.5;
        o.land = rnd(BASE + 7, 124);
      }
    }
    S.crashed = false;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06];
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.fury = cl(k[2], 1, 5);
  S.lampK = cl(k[3], 0, 1);
  // Story time: one story second a second at Speed 2.
  const d = cl(dt || 0, 0, 0.1) * S.speed * 0.5;
  S.t += d;
  S.age += d;
  S.pt += d;
  if (S.phase === "quiet" && S.pt >= QUIET) startPhase(S, "stir");
  else if (S.phase === "stir" && S.pt >= STIR) startPhase(S, "fly");
  else if (S.phase === "fly" && S.pt >= FLY) startPhase(S, "drop");
  else if (S.phase === "drop" && S.things.every((o) => o.state === "rest") && S.chair.h <= 0 && S.pt > 0.3) startPhase(S, "hush");
  else if (S.phase === "hush" && S.pt >= HUSH) startPhase(S, "quiet");
  const ph = S.phase, active = ph === "stir" ? sm(S.pt / STIR) * 0.4 : ph === "fly" ? 1 : 0;

  // The lamp: a pendulum whose swing grows while the spirit is about.
  const target = min(0.78, (0.07 + 0.45 * S.lampK) * (1 + active * (0.4 + 0.15 * S.fury)));
  S.lampA += (target - S.lampA) * (1 - exp(-d * 1.5));
  S.lampP += (d * TAU) / 2.2;
  const th = S.lampA * sin(S.lampP);
  S.lx = HOOK_X + CHAIN * sin(th);
  S.ly = CHAIN * cos(th) - 2;
  // The flame: a steady flicker, guttering after the crash.
  if (ph === "hush") S.gutter = max(S.gutter, 1 - S.pt / HUSH);
  else S.gutter *= exp(-d * 4);
  const fl = 0.04 * sin(S.t * 23) + 0.03 * sin(S.t * 37);
  S.glow = (1 + fl) * (1 - 0.7 * S.gutter * (0.6 + 0.4 * sin(S.t * 41) * sin(S.t * 17)));

  // The picture on its nail: swings while the spirit pushes it, and when the
  // push stops friction holds it wherever it is, crooked.
  if (active > 0) {
    S.picV += d * (-9 * S.pic + 3.5 * active * sin(S.t * 2.6) * (0.6 + 0.12 * S.fury));
    S.picV *= exp(-d * 0.6);
  } else S.picV *= exp(-d * 6);
  S.pic = cl(S.pic + S.picV * d, -0.6, 0.6);
  // The clock: its hands race backwards while things fly.
  S.hands[0] += d * (active ? -1.2 * active * (0.6 + 0.2 * S.fury) : 0.01);
  S.hands[1] += d * (active ? -9 * active * (0.6 + 0.2 * S.fury) : 0.1);

  // The chair rises and tilts while things fly, and drops with them.
  const C = S.chair;
  if (ph === "fly") {
    C.lift = min(1, C.lift + d / 0.9);
    const hgt = (2 + 4.5 * (S.fury - 1)) * (0.75 + 0.25 * sin(S.age * 1.7)) + 1.5 * sin(S.age * 5.1);
    C.h += (sm(C.lift) * hgt - C.h) * (1 - exp(-d * 6));
    C.tilt = sm(C.lift) * (0.12 + 0.05 * S.fury) * sin(S.age * 1.3 + 0.5) + 0.04 * sin(S.age * 6.7);
  } else if (C.h > 0 || C.vh) {
    C.vh += d * 300;
    C.h -= C.vh * d;
    C.tilt *= exp(-d * 5);
    if (C.h <= 0) {
      // A bounce, then it stands.
      C.vh = C.vh > 40 ? -C.vh * 0.3 : 0;
      C.h = 0;
      if (C.vh === 0) C.lift = 0;
      dustAt(S, CHX, 121, 6);
    }
  } else C.tilt *= exp(-d * 5);
  if (ph === "stir") C.tilt = 0.03 * active * sin(S.t * 31);

  // The flying things.
  for (const o of S.things) {
    if (o.state === "lift" || o.state === "fly") {
      o.lift += d / 0.8;
      if (o.lift < 0) continue;
      o.state = o.lift >= 1 ? "fly" : "lift";
      const [px, py] = path(S, o, S.age), e = sm(o.lift);
      const nx = o.rx + (px - o.rx) * e, ny = o.ry - 5 * sin(PI * e) + (py - o.ry) * e;
      o.tilt = cl((nx - o.x) / max(d, 1e-3) / 60, -0.5, 0.5);
      o.x = nx;
      o.y = ny;
      o.flap += d * (o.kind === 0 ? 13 : 0);
      o.spin += d * (o.kind === 1 ? 9 + S.fury : 0);
      if (e > 0.2) deposit(S, o.x, o.y + (o.kind === 0 ? 0 : 0.5), 0.85, 2);
    } else if (o.state === "fall") {
      o.vy += d * 320;
      o.x = cl(o.x + o.vx * d, 4, 60);
      // It lands on the table if it comes down onto it, or else on the floor.
      if (o.y < TOP - 1 && o.y + o.vy * d >= TOP - 1 && o.x > TX0 + 2 && o.x < TX1 - 2) o.land = TOP - 1;
      o.y += o.vy * d;
      o.spin += d * 6;
      if (o.y >= o.land) {
        o.y = o.land;
        o.state = "rest";
        o.rx = o.x;
        o.ry = o.y;
        o.pose = 1;
        o.flap = 0;
        dustAt(S, o.x, o.y, o.kind === 1 ? 7 : 5);
        if (!S.crashed) {
          S.crashed = true;
          S.shake = 0.45;
        }
      }
    }
  }
  S.shake = max(0, S.shake - d);
  S.mist += ((ph === "fly" || ph === "drop" ? 1 : ph === "stir" ? sm(S.pt / STIR) : 0) - S.mist) * (1 - exp(-d * 1.2));

  // The spirit itself is never seen, only the faint trail it leaves as it
  // drifts round the room, brighter while it stirs things up.
  const wx = 32 + 22 * sin(S.t * 0.83) + 6 * sin(S.t * 2.1), wy = 58 + 34 * sin(S.t * 0.57 + 1) + 5 * cos(S.t * 1.9);
  deposit(S, wx, wy, ph === "quiet" || ph === "hush" ? 0.45 : 0.75, 2.2);
  const fade = exp(-d * 1.7);
  for (let i = 0; i < N; i++) S.E[i] *= fade;

  for (const p of S.dust) {
    p.x += p.vx * d;
    p.y += p.vy * d;
    p.vx *= exp(-d * 2);
    p.vy = p.vy * exp(-d * 2) - d * 2;
    p.life -= d / p.span;
  }
  S.dust = S.dust.filter((p) => p.life > 0);
}

function deposit(S, x, y, v, r = 1.6) {
  const x0 = round(x), y0 = round(y), R = Math.ceil(r);
  for (let j = -R; j <= R; j++)
    for (let i = -R; i <= R; i++) {
      const xx = x0 + i, yy = y0 + j, dd = sqrt(i * i + j * j);
      if (xx < 0 || xx >= W || yy < 0 || yy >= H || dd > r + 0.4) continue;
      const n = yy * W + xx;
      S.E[n] = max(S.E[n], v * (dd > r - 0.6 ? 0.55 : 1));
    }
}

function dustAt(S, x, y, n) {
  for (let k = 0; k < n; k++) S.dust.push({ x: x + rnd(-3, 3), y: y - rnd(0, 2), vx: rnd(-14, 14), vy: rnd(-16, -4), life: 1, span: rnd(0.7, 1.4) });
}

// Painting into the frame buffer.
function put(S, x, y, c, a = 1) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const n = (y * W + x) * 3;
  S.F[n] += (c[0] - S.F[n]) * a;
  S.F[n + 1] += (c[1] - S.F[n + 1]) * a;
  S.F[n + 2] += (c[2] - S.F[n + 2]) * a;
}
// An object's colour in the lamplight where it stands.
function lit(S, c, x, y, lo = 0.3) {
  const f = S.L[cl(round(y), 0, H - 1) * W + cl(round(x), 0, W - 1)], v = lo + (1.15 - lo) * f;
  return [min(1, c[0] * v), min(1, c[1] * v), min(1, c[2] * v)];
}
// A thick segment: every LED within r of the line from a to b.
function seg(S, ax, ay, bx, by, r, c) {
  const x0 = floor(min(ax, bx) - r), x1 = Math.ceil(max(ax, bx) + r), y0 = floor(min(ay, by) - r), y1 = Math.ceil(max(ay, by) + r);
  const dx = bx - ax, dy = by - ay, ll = dx * dx + dy * dy || 1;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const u = cl(((x - ax) * dx + (y - ay) * dy) / ll, 0, 1), ex = ax + dx * u - x, ey = ay + dy * u - y;
      if (ex * ex + ey * ey <= r * r) put(S, x, y, c);
    }
}
// A box in a frame turned by angle a about (ox, oy): local x from x0 to x1,
// local y from y0 to y1.
function box(S, ox, oy, a, x0, y0, x1, y1, c) {
  const ca = cos(a), sa = sin(a);
  const rad = sqrt(max(x0 * x0, x1 * x1) + max(y0 * y0, y1 * y1)) + 1;
  for (let y = floor(oy - rad); y <= oy + rad; y++)
    for (let x = floor(ox - rad); x <= ox + rad; x++) {
      const dx = x - ox, dy = y - oy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      if (u >= x0 - 0.5 && u <= x1 + 0.5 && v >= y0 - 0.5 && v <= y1 + 0.5) put(S, x, y, typeof c === "function" ? c(u, v, x, y) : c);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const F = S.F, L = S.L, lx = S.lx, ly = S.ly - 1, g = S.glow;
  // The room in the lamplight.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - lx, dy = (y - ly) * 0.85, n = y * W + x;
      const f = (g * 1.1) / (1 + (dx * dx + dy * dy) / 380);
      L[n] = f;
      const c = ramp(f * S.tex[n]);
      F[n * 3] = c[0];
      F[n * 3 + 1] = c[1];
      F[n * 3 + 2] = c[2];
    }
  const DARK = [0.03, 0.008, 0.05];

  // The picture: a gilt frame round a dim portrait, hanging on a nail.
  const pc = cos(S.pic), ps = sin(S.pic), cord = lit(S, [0.6, 0.5, 0.4], NAIL_X, NAIL_Y);
  for (const u of [-6, 6]) seg(S, NAIL_X, NAIL_Y, NAIL_X + u * pc - 4 * ps, NAIL_Y + u * ps + 4 * pc, 0.45, cord);
  const gold = lit(S, [1, 0.72, 0.2], NAIL_X, NAIL_Y + 12, 0.45), canvas = lit(S, [0.16, 0.12, 0.3], NAIL_X, NAIL_Y + 12);
  const face = lit(S, [0.75, 0.62, 0.7], NAIL_X, NAIL_Y + 12, 0.25);
  box(S, NAIL_X, NAIL_Y, S.pic, -FW / 2, 3, FW / 2, 3 + FH, (u, v) => {
    if (abs(u) > FW / 2 - 2 || v < 5 || v > FH + 1) return gold;
    // The sitter: a pale oval head over dark shoulders.
    const hu = u / 2.6, hv = (v - 11) / 3.4;
    if (hu * hu + hv * hv < 1) return face;
    if (v > 16 && abs(u) < 5 - (v - 16) * -0.4) return DARK;
    return canvas;
  });

  // The clock: a pale face with a dark rim and two hands.
  const cface = lit(S, [0.95, 0.9, 0.75], CLX, CLY, 0.3), rim = lit(S, [0.35, 0.18, 0.45], CLX, CLY, 0.3);
  for (let y = CLY - CLR; y <= CLY + CLR; y++)
    for (let x = CLX - CLR; x <= CLX + CLR; x++) {
      const r = sqrt((x - CLX) ** 2 + (y - CLY) ** 2);
      if (r <= CLR) put(S, x, y, r > CLR - 1.5 ? rim : cface);
    }
  seg(S, CLX, CLY, CLX + 3.5 * sin(S.hands[0]), CLY - 3.5 * cos(S.hands[0]), 0.6, DARK);
  seg(S, CLX, CLY, CLX + 5.5 * sin(S.hands[1]), CLY - 5.5 * cos(S.hands[1]), 0.5, DARK);

  // The shelf and the table.
  seg(S, SX0, SHELF, SX1, SHELF, 0.6, lit(S, [0.45, 0.25, 0.55], 51, SHELF));
  const cloth = lit(S, [0.75, 0.6, 1], 20, TOP + 3, 0.25);
  for (let y = TOP; y <= TOP + 7; y++)
    for (let x = TX0; x <= TX1; x++) put(S, x, y, y === TOP || (y === TOP + 7 && (x & 3) === 0) ? lit(S, [1, 0.9, 1], x, y, 0.3) : (x - TX0) % 5 === 2 ? lit(S, [0.55, 0.42, 0.8], x, y, 0.25) : cloth);
  for (const lxg of [TX0 + 3, TX1 - 3]) seg(S, lxg, TOP + 8, lxg, 121, 0.7, DARK);
  seg(S, TX0 + 3, 113, TX1 - 3, 113, 0.5, DARK);

  // Ectoplasm: added light in the trail colour, in steps of a twelfth, under
  // the things that leave it.
  // It also pools on the floor as a low mist that rolls and thickens while
  // the spirit is about.
  const ec = hsv(0.31 + S.hue, 0.85, 1), E = S.E, M = 0.2 + 0.16 * S.mist;
  for (let x = 0; x < W; x++) {
    // Its top rolls along in two slow waves going opposite ways.
    const top = BASE + 2 - 8 * S.mist + 2.5 * sin(x * 0.13 + S.t * 0.7) + 1.5 * sin(x * 0.31 - S.t * 1.1);
    for (let y = max(0, floor(top)); y < H; y++) {
      const n = y * W + x;
      E[n] = max(E[n], cl((y - top) / 22, 0, 1) * M * (0.8 + 0.2 * sin(x * 0.07 - S.t * 0.5 + y * 0.05)));
    }
  }
  for (let n = 0; n < N; n++) {
    const e = round(E[n] * 12) / 12;
    if (e <= 0) continue;
    F[n * 3] = min(1, F[n * 3] * (1 - 0.5 * e) + ec[0] * e);
    F[n * 3 + 1] = min(1, F[n * 3 + 1] * (1 - 0.5 * e) + ec[1] * e);
    F[n * 3 + 2] = min(1, F[n * 3 + 2] * (1 - 0.5 * e) + ec[2] * e);
  }
  // The chair: a dark shape against the lit wall, with a rim of lamplight.
  const C = S.chair, cx = CHX, cy = CHY - C.h;
  const rimC = lit(S, [1, 0.6, 0.3], cx, cy - 12, 0.15);
  // Seen from the side: the back leg runs on up into the back, the front leg
  // stops at the seat, so it reads as a chair and not a ladder.
  const chairCol = (u, v) => (v < -21.5 || (v < -1.2 && u < 3) ? rimC : DARK);
  const parts = [[-8, -2, 7, 1], [4, -23, 7, 22], [-8, 2, -6, 22], [-6, 13, 4, 14], [3, -12, 7, -10]];
  for (const [x0, y0, x1, y1] of parts) box(S, cx, cy, C.tilt, x0, y0, x1, y1, chairCol);

  // Books on the shelf stand upright; books on the table or the floor lie
  // closed; books in the air open into a V and flap like wings.
  const tremble = S.phase === "stir" ? 0.6 * sm(S.pt / STIR) : S.phase === "fly" ? 0.4 : 0;
  for (const o of S.things) {
    const air = o.state === "fly" || o.state === "fall" || (o.state === "lift" && o.lift > 0);
    const jx = !air && tremble ? (Math.random() - 0.5) * 2 * tremble : 0, jy = !air && tremble && Math.random() < tremble * 0.5 ? -1 : 0;
    const x = (air ? o.x : o.rx) + jx, y = (air ? o.y : o.ry) + jy;
    if (o.kind === 0) {
      const col = lit(S, o.col, x, y, 0.35), pg = lit(S, PAGES, x, y, 0.4);
      if (o.state === "fall" || (air && o.lift < 0.15)) box(S, x, y, o.spin * 0.5, -3, -1, 3, 0, (u, v) => (v < -0.5 ? col : pg));
      else if (air) {
        // Wings: each cover from the spine out to a tip that beats up and down.
        const beat = 0.85 * sin(o.flap), L5 = 6.5;
        for (const s of [-1, 1]) {
          const a = o.tilt * s + beat, tx = x + s * L5 * cos(a), ty = y - L5 * sin(a);
          seg(S, x, y, tx, ty, 0.9, col);
          seg(S, x, y - 1, x + s * 3.8 * cos(a), y - 1 - 3.8 * sin(a), 0.45, pg);
        }
      } else if (o.pose === 0) box(S, x, y, 0, -1, -3, 0, 3, (u, v) => (v < -2.5 ? pg : col));
      else box(S, x, y, 0, -3, -1, 3, 0, (u, v) => (v < -0.5 ? col : pg));
    } else {
      // A plate: a cream disc with a blue rim, seen flat on the table and
      // tumbling edge over edge in the air.
      const a = 3.1, b = air ? 0.6 + 2.5 * abs(sin(o.spin)) : 0.9, rot = air ? 0.4 * sin(o.spin * 0.37) : 0;
      const cream = lit(S, [1, 0.96, 0.85], x, y, 0.62), blue = lit(S, [0.35, 0.45, 1], x, y, 0.62);
      const ca = cos(rot), sa = sin(rot);
      for (let yy = floor(y - 4); yy <= y + 4; yy++)
        for (let xx = floor(x - 4); xx <= x + 4; xx++) {
          const dx = xx - x, dy = yy - y, u = (dx * ca + dy * sa) / a, v = (-dx * sa + dy * ca) / b, r = u * u + v * v;
          if (r <= 1.15) put(S, xx, yy, r > 0.55 ? blue : cream);
        }
    }
  }

  // The lamp: chain, brass cap, the glass chimney with the flame, the oil font.
  const th = atan2(S.lx - HOOK_X, S.ly + 2);
  for (let s = 0; s < CHAIN - 6; s += 2) put(S, HOOK_X + s * sin(th), s * cos(th), lit(S, [0.75, 0.6, 0.5], HOOK_X, s, 0.2));
  // Its iron cap and font are dark against its own pool of light.
  const iron = [0.1, 0.03, 0.12], edge = [1, 0.6, 0.15], glass = [1, 0.95 * min(1, g), 0.55 * min(1, g)];
  box(S, S.lx, S.ly, -th, -4, -7, 4, -5, (u, v) => (v > -5.5 ? edge : iron));
  box(S, S.lx, S.ly, -th, -2, -4, 2, 2, (u, v) => (abs(u) < 1 && v > -2 ? [1, 1, 0.85] : glass));
  box(S, S.lx, S.ly, -th, -4, 3, 4, 6, (u, v) => (v < 3.5 ? edge : iron));

  for (const p of S.dust) put(S, p.x, p.y, [0.8, 0.72, 0.85], 0.7 * p.life);

  // The crash shakes the whole room for a moment.
  const sx = S.shake > 0 ? round((Math.random() - 0.5) * 3) : 0, sy = S.shake > 0 ? round((Math.random() - 0.5) * 3) : 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const xx = cl(x + sx, 0, W - 1), yy = cl(y + sy, 0, H - 1), n = (yy * W + xx) * 3;
      display.setPixel(x, y, round(255 * F[n]), round(255 * F[n + 1]), round(255 * F[n + 2]));
    }
}
