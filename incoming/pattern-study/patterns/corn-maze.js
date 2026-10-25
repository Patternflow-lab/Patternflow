// ===== Patternflow pattern =====
// Title:   Corn Maze
// Family:  halloween
// Idea:    Seen from above at night, someone with a flashlight steps into a corn maze and walks its dirt paths, the warm beam lighting the corn tops ahead while the corridors behind the corn fall into violet shadow, until at a dead end two green eyes glint back out of the stalks, the beam shakes, and the walker turns and runs.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 45
// Round:   45
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Beam=0..1, Moon=0..1
//
// Knob 1: Hue. The colour of the flashlight: warm amber at 0, orange-gold at 0.95, toxic green at 0.2, cold blue at 0.45 and violet at 0.6; the eyes stay green, or turn yellow while the beam itself is green.
// Knob 2: Speed. How fast the walker goes: at 2 it walks 15 LEDs a second, about two corridors, and runs 36 after the eyes; at 0.2 it creeps ten times slower, at 3 half as fast again. The pauses at the dead ends scale with it.
// Knob 3: Beam. The flashlight's reach and spread: at 0 the cone is 68 LEDs long and 103 degrees wide, so pointed up the aisle it fills the half of the panel ahead of the walker; at 1 it is 94 long and 126 wide and lights most of the panel.
// Knob 4: Moon. Moonlight on the corn tops outside the beam: at 0.06 the brightest stalks reach 20 of 255, just enough to hint at the maze in a dark room; at 1 the whole maze stands out lilac and the beam is a warm patch on it.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, round, sin, cos, atan2, sqrt, ceil, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The maze: 8 by 16 cells of 8 LEDs. Each cell keeps a 4 by 4 patch of path
// in its middle, so corridors are 4 wide and the corn between them 4 thick
// (2 on the outer edge). A stalk row any thinner reads as a drawn line, not
// as a field.
const P = 8, CW = 8, CH = 16;
// The top cell row of the entrance aisle.
const AISLE_TOP = 3;
// Materials: trampled path, a gap between stalks, a leaf, a tassel.
const PATH = 0, GAP = 1, LEAF = 2, TASSEL = 3;
// The torch is held up over the corn, so the tops of the stalks catch the
// beam all over the cone; each row of corn the light has crossed takes this
// share off the tops beyond it.
const CORN_PASS = 0.94;
// How far the beam fades over its last quarter.
const FAR = 0.25;
// The ground behind corn gets only this share of the light over the tops: the
// paths beyond a wall lie in the corn's shadow.
const GROUND_SHADOW = 0.45;
// The shadowed ground takes the night's violet, lifted a little: blue
// carries the least light of the three, and at the same level it reads dimmer.
const SHADOW = hsv(0.765, 0.7, 1), SHADOW_LIFT = 1.3;
// The pool of spill light round the torch, LEDs.
const POOL = 6.5;
// Below this the beam is not drawn at all, so the shadows end hard.
const CUT = 0.36;
// Walking pace at Speed 2, LEDs a second, and how much faster a run is.
const WALK = 15, RUN = 2.4;
// Story seconds (one a second at Speed 2): standing at the entrance, looking
// at a dead end, staring at the eyes, and how long a run lasts.
const ENTER = 2.25, LOOK = 0.7, STARE = 1.25, RUNFOR = 2.2;

const cx0 = (c) => (c % CW) * P + 3.5 + 0.5, cy0 = (c) => floor(c / CW) * P + 3.5 + 0.5;

export function setup(params) {
  const S = (params.s = {
    t: 0, hue: 0, speed: 2, beamK: 0, moon: 0.06,
    east: new Uint8Array(CW * CH), south: new Uint8Array(CW * CH),
    path: new Uint8Array(N), phase: new Float32Array(N), light: new Float32Array(N), shade: new Uint8Array(N),
    aisle: 3, route: [], seg: 0, u: 0, mode: "enter", timer: 0, visits: new Uint16Array(CW * CH),
    wx: 0, wy: 0, ang: -PI / 2, look: -PI / 2, stride: 0, power: 1, jitter: 0,
    eyes: null, seen: 0, flick: 0, nextFlick: 8 + 6 * Math.random(), runLeft: 0, deadAt: -1, sub: new Uint8Array(CW * CH), up: new Int16Array(CW * CH),
  });
  buildMaze(S);
  rootTree(S);
  // The walker starts in the entrance gap at the foot of the aisle, facing in.
  const c = 15 * CW + S.aisle;
  S.wx = cx0(c);
  S.wy = cy0(c) + 2;
  S.route = [];
  for (let cy = 15; cy >= AISLE_TOP; cy--) S.route.push(cy * CW + S.aisle);
  S.seg = 0;
  S.u = -2;
  S.visits[c] = 1;
}

// A recursive backtracker grown from a straight entrance aisle. The aisle
// runs up from a gap in the bottom edge through 13 of the 16 cell rows, the
// way a field maze is often cut, and ends blind: its top cell takes no
// branch. The backtracker grows the rest of the maze off its other cells.
function buildMaze(S) {
  const { east, south } = S;
  const seen = new Uint8Array(CW * CH);
  S.aisle = Math.random() < 0.5 ? 3 : 4;
  const stack = [];
  for (let cy = AISLE_TOP; cy <= 15; cy++) {
    const c = cy * CW + S.aisle;
    seen[c] = 1;
    if (cy < 15) south[c] = 1;
    if (cy > AISLE_TOP) stack.splice(floor(Math.random() * (stack.length + 1)), 0, c);
  }
  while (stack.length) {
    const c = stack[stack.length - 1], x = c % CW, y = floor(c / CW);
    const opts = [];
    if (x > 0 && !seen[c - 1]) opts.push(c - 1);
    if (x < CW - 1 && !seen[c + 1]) opts.push(c + 1);
    if (y > 0 && !seen[c - CW]) opts.push(c - CW);
    if (y < CH - 1 && !seen[c + CW]) opts.push(c + CW);
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const n = opts[floor(Math.random() * opts.length)];
    if (n === c + 1) east[c] = 1;
    else if (n === c - 1) east[n] = 1;
    else if (n === c + CW) south[c] = 1;
    else south[n] = 1;
    seen[n] = 1;
    stack.push(n);
  }
  // Mark the LEDs: path where a cell or a link between cells is, and the
  // entrance gap; corn everywhere else.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const cx = floor(x / P), cy = floor(y / P), lx = x - cx * P, ly = y - cy * P, c = cy * CW + cx;
      const inX = lx >= 2 && lx <= 5, inY = ly >= 2 && ly <= 5;
      let p = inX && inY;
      if (inY && lx >= 6 && east[c]) p = true;
      if (inY && lx <= 1 && cx > 0 && east[c - 1]) p = true;
      if (inX && ly >= 6 && (south[c] || (cy === 15 && cx === S.aisle))) p = true;
      if (inX && ly <= 1 && cy > 0 && south[c - CW]) p = true;
      const i = y * W + x;
      S.path[i] = p ? 1 : 0;
      S.phase[i] = hash(i * 7 + 3);
    }
}

// How many cells lie beyond the step from c to n: the maze is a tree, so
// rooted at cell 0 this is n's subtree when n hangs below c, and everything
// but c's subtree when n is c's parent. A runner prefers the roomier way.
function rootTree(S) {
  const order = [0], seen = new Uint8Array(CW * CH);
  seen[0] = 1;
  S.up.fill(-1);
  for (let k = 0; k < order.length; k++)
    for (const n of neighbours(S, order[k])) if (!seen[n]) (seen[n] = 1), (S.up[n] = order[k]), order.push(n);
  S.sub.fill(1);
  for (let k = order.length - 1; k > 0; k--) S.sub[S.up[order[k]]] += S.sub[order[k]];
}
const room = (S, c, n) => (S.up[n] === c ? S.sub[n] : CW * CH - S.sub[c]);

const linked = (S, a, b) => {
  if (b === a + 1) return a % CW < CW - 1 && S.east[a];
  if (b === a - 1) return b % CW < CW - 1 && S.east[b];
  if (b === a + CW) return S.south[a];
  if (b === a - CW) return S.south[b];
  return false;
};
const neighbours = (S, c) => [c - 1, c + 1, c - CW, c + CW].filter((n) => n >= 0 && n < CW * CH && linked(S, c, n));

// Decide where the walker goes after the last cell of its route. Walking, it
// prefers corridors it has seen least; running, the ones that lead away from
// the eyes. A cell with no way on but back is a dead end: the route marks
// it, then turns round.
function extend(S) {
  const r = S.route, c = r[r.length - 1], prev = r.length > 1 ? r[r.length - 2] : -1;
  const opts = neighbours(S, c).filter((n) => n !== prev);
  if (!opts.length) {
    S.deadAt = r.length - 1;
    r.push(prev);
    return;
  }
  let best = opts[0], score = -1e9;
  for (const n of opts) {
    let v = Math.random() * 1.5;
    if (S.runLeft > 0 && S.eyes) v += 0.3 * sqrt((cx0(n) - S.eyes.x) ** 2 + (cy0(n) - S.eyes.y) ** 2) + 2 * Math.log(room(S, c, n));
    else v -= 2 * S.visits[n];
    if (v > score) (score = v), (best = n);
  }
  r.push(best);
}

// The walker's place on its route, a distance ahead along it, never past a
// dead end it has not reached.
function along(S, ahead) {
  let seg = S.seg, u = S.u + ahead;
  while (u > P) {
    if (seg + 1 === S.deadAt || seg + 2 >= S.route.length) {
      u = P;
      break;
    }
    u -= P;
    seg++;
  }
  const a = S.route[seg], b = S.route[seg + 1];
  const t = u / P;
  return [cx0(a) + (cx0(b) - cx0(a)) * t, cy0(a) + (cy0(b) - cy0(a)) * t];
}

function turnTo(a, target, rate) {
  let d = target - a;
  d -= TAU * round(d / TAU);
  return a + cl(d, -rate, rate);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.beamK = cl(k[2], 0, 1);
  S.moon = cl(k[3], 0, 1);
  const d = cl(dt || 0, 0, 0.1) * (S.speed / 2);
  S.t += d;
  S.timer += d;
  // Keep two cells of route decided ahead, so the beam can look round a
  // corner before the walker gets there.
  while (S.route.length < S.seg + 4 && S.deadAt < S.seg) extend(S);

  let pace = 0, turnRate = 7;
  if (S.mode === "enter") {
    // At the entrance the walker sweeps the beam left and right once, then
    // goes in. The sweep is back on the aisle at 2 seconds.
    const u = cl(S.timer / ENTER, 0, 1);
    S.look = -PI / 2 + 0.55 * sin(TAU * cl(S.timer / 2, 0, 1)) * (1 - u);
    turnRate = 99;
    if (S.timer >= ENTER) (S.mode = "walk"), (S.timer = 0);
  } else if (S.mode === "walk" || S.mode === "run") {
    pace = WALK * (S.mode === "run" ? RUN : 1);
    turnRate = S.mode === "run" ? 14 : 7;
    if (S.mode === "run" && (S.runLeft -= d) <= 0) S.mode = "walk";
  } else if (S.mode === "look") {
    // A dead end with nothing in it: a glance either side, then back.
    S.look = S.deadAng + 0.45 * sin(TAU * S.timer / LOOK);
    if (S.timer >= LOOK) leave(S, false);
  } else if (S.mode === "stare") {
    // Eyes. The walker freezes, the beam shakes more and more, the torch
    // stutters, and then it turns and runs.
    const u = S.timer / STARE;
    S.jitter = 0.04 + 0.16 * u;
    S.look = S.deadAng + S.jitter * (2 * Math.random() - 1);
    S.power = 0.75 + 0.25 * Math.random() - (Math.random() < 0.08 ? 0.6 : 0);
    if (S.eyes) S.eyes.on = S.timer > 0.15 && !(S.timer > 0.7 && S.timer < 0.82);
    if (S.timer >= STARE) leave(S, true);
  }

  if (pace > 0) {
    S.u += pace * d;
    S.stride += pace * d;
    while (S.u >= P) {
      S.u -= P;
      S.seg++;
      const c = S.route[S.seg];
      S.visits[c] = min(65000, S.visits[c] + 1);
      while (S.route.length < S.seg + 4 && S.deadAt < S.seg) extend(S);
      if (S.seg === S.deadAt) {
        // Arrived at a dead end: stand in it facing the corn.
        const a = S.route[S.seg - 1], b = S.route[S.seg];
        S.u = 0;
        S.deadAng = atan2(cy0(b) - cy0(a), cx0(b) - cx0(a));
        S.timer = 0;
        const ran = S.mode === "run";
        S.runLeft = 0;
        // Eyes in the corn beyond, at the first dead end the walker finds and
        // then at three in five; never in the entrance gap, which opens on
        // the field outside. A runner who hits a dead end only looks and
        // turns: the same eyes twice in a row would be one fright too many.
        const entrance = b === 15 * CW + S.aisle && S.deadAng > 0;
        if (!entrance && !ran && (S.seen === 0 || Math.random() < 0.6)) {
          S.seen++;
          const ex = cx0(b) + cos(S.deadAng) * 6.5, ey = cy0(b) + sin(S.deadAng) * 6.5;
          S.eyes = { x: cl(ex, 1, W - 2), y: cl(ey, 1, H - 2), ang: S.deadAng, on: false, fade: 1 };
          S.mode = "stare";
        } else S.mode = "look";
        break;
      }
    }
    S.seg = min(S.seg, S.route.length - 2);
    const [x, y] = along(S, 0);
    S.wx = x;
    S.wy = y;
    if (S.mode === "walk" || S.mode === "run") {
      const [lx, ly] = along(S, 7);
      if (abs(lx - x) + abs(ly - y) > 0.5) S.look = atan2(ly - y, lx - x);
    }
  }
  S.ang = turnTo(S.ang, S.look, turnRate * d + 1e-6);
  if (S.mode !== "stare") S.power = 1;

  // The eyes stay a moment after the walker has run, then blink out.
  if (S.eyes && S.mode !== "stare") {
    S.eyes.fade -= d * 0.8;
    S.eyes.on = S.eyes.fade > 0;
    if (S.eyes.fade <= 0 && S.runLeft <= 0) S.eyes = null;
  }
  // Now and then the old torch flickers: a few fast drops over 0.4 seconds.
  if (S.t >= S.nextFlick) {
    S.flick = 0.4;
    S.nextFlick = S.t + 6 + 10 * Math.random();
  }
  if (S.flick > 0) {
    S.flick -= d;
    const f = floor(S.flick * 20);
    S.power *= [1, 0.15, 1, 0.5, 0, 0.9, 0.2, 1, 0][f % 9];
  }
}

// Leave a dead end: turn round, the route already heads back.
function leave(S, ran) {
  S.mode = ran ? "run" : "walk";
  S.runLeft = ran ? RUNFOR : 0;
  S.jitter = 0;
  S.timer = 0;
  // Drop the decided cells after the turn: a runner picks its way afresh.
  S.route.length = S.seg + 2;
  S.deadAt = -1;
  S.look = S.deadAng + PI;
}

// The light is cast from just ahead of the walker's head, not from the torch
// held out in front: at a dead end the torch is already in the corn, and a
// beam starting inside a wall would light nothing.
const torch = (S) => [S.wx + 0.8 * cos(S.ang), S.wy + 0.8 * sin(S.ang)];

// Cast the beam: rays fanned over the cone from the torch, each one dimmed
// by the corn it passes through. The tops of the stalks catch what is left;
// the ground behind any corn lies in shadow.
function castBeam(S) {
  const L = S.light, Sh = S.shade;
  L.fill(0);
  const pw = S.power;
  if (pw <= 0.02) return;
  const len = 68 + 26 * S.beamK, half = 0.9 + 0.2 * S.beamK;
  const [ox, oy] = torch(S);
  const rays = ceil((2 * half * len) / 0.55);
  for (let r = 0; r <= rays; r++) {
    const phi = -half + (2 * half * r) / rays, a = S.ang + phi, dx = cos(a), dy = sin(a);
    const edge = abs(phi) / half;
    const prof = pw * (edge < 0.6 ? 1 : 1 - 0.35 * (edge - 0.6) / 0.4);
    let T = 1, walls = 0, inCorn = false;
    for (let s = 0.5; s < len; s += 0.5) {
      const x = ox + dx * s, y = oy + dy * s;
      if (x < 0 || y < 0 || x >= W || y >= H) break;
      const p = (y | 0) * W + (x | 0);
      const fall = s < 0.72 * len ? 1 : 1 - FAR * (s - 0.72 * len) / (0.28 * len);
      let v, sh = 0;
      if (S.path[p]) {
        inCorn = false;
        v = walls ? T * GROUND_SHADOW : 1;
        sh = walls ? 1 : 0;
      } else {
        if (!inCorn) (walls++), (T *= CORN_PASS), (inCorn = true);
        v = T;
      }
      v *= prof * fall;
      if (v > L[p]) (L[p] = v), (Sh[p] = sh);
    }
  }
  // Spill: the torch also lights the ground round the walker, as far as it
  // can see along the path, so the walker stands in a small pool of light
  // even facing a wall at the panel's edge.
  for (let y = floor(oy - POOL); y <= oy + POOL; y++)
    for (let x = floor(ox - POOL); x <= ox + POOL; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const ex = x + 0.5 - ox, ey = y + 0.5 - oy, dd = sqrt(ex * ex + ey * ey);
      if (dd >= POOL) continue;
      let clear = true;
      for (let t = 0.5; t < dd - 0.5 && clear; t += 0.5) clear = S.path[floor(oy + (ey * t) / dd) * W + floor(ox + (ex * t) / dd)] === 1;
      const p = y * W + x, v = pw * (0.95 - (0.3 * dd) / POOL);
      if (clear && v > L[p]) (L[p] = v), (Sh[p] = 0);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  castBeam(S);
  const L = S.light;
  // The beam's colours: the hue knob turns the torch round the wheel from
  // amber. Leaves take the full colour, tassels a paler one, the dirt path a
  // cream between.
  const h0 = 0.115 + S.hue;
  const cols = [hsv(h0, 0.5, 0.92), null, hsv(h0, 0.86, 1), hsv(h0 + 0.02, 0.35, 1)];
  // Moonlight on the corn tops, lilac, faint at the start.
  const m = 0.045 + 0.55 * S.moon;
  const moon = [0.62 * m, 0.5 * m, m];
  const wind = S.t * 0.9;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // Corn rustles: each stalk LED rolls a new look about once a second.
      let mat = PATH;
      if (!S.path[i]) {
        const roll = hash(i * 131 + floor(wind + S.phase[i] * 7));
        mat = roll < 0.14 ? GAP : roll < 0.68 ? LEAF : TASSEL;
      }
      let r = 0, g = 0, b = 0;
      if (mat === TASSEL) (r = moon[0]), (g = moon[1]), (b = moon[2]);
      else if (mat === LEAF) (r = moon[0] * 0.55), (g = moon[1] * 0.55), (b = moon[2] * 0.55);
      else if (mat === PATH) (r = moon[0] * 0.12), (g = moon[1] * 0.12), (b = moon[2] * 0.12);
      let v = L[i];
      if (v >= CUT && mat === PATH && S.shade[i]) {
        // Ground in the corn's shadow, inside the cone: a violet channel.
        v = min(1, round(v * 8) / 8 * SHADOW_LIFT);
        (r = SHADOW[0] * v), (g = SHADOW[1] * v), (b = SHADOW[2] * v);
      } else if (v >= CUT && mat !== GAP) {
        // The lit corn and path never go below 60% brightness: a warm
        // colour any dimmer reads brown on the panel. The edge of the beam
        // is a step, the way a torch's edge is.
        v = round((0.6 + (0.4 * (v - CUT)) / (1 - CUT)) * 10) / 10;
        const c = cols[mat];
        r = max(r, c[0] * v);
        g = max(g, c[1] * v);
        b = max(b, c[2] * v);
      }
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, b)));
    }
  drawEyes(display, S);
  drawWalker(display, S);
}

// Two eyes in the corn, side by side across the corridor: each 2 LEDs wide
// with a 2 LED gap, the narrowest pair that still reads as a face. Round
// them a dark head blots out the lit stalks, so the eyes do not drown in
// the gold of the beam.
function drawEyes(display, S) {
  const e = S.eyes;
  if (!e || !e.on) return;
  const c = abs(((0.115 + S.hue) % 1) - 0.3) < 0.08 ? [255, 235, 40] : [90, 255, 70];
  const ca = cos(e.ang), sa = sin(e.ang);
  for (let y = floor(e.y - 4); y <= e.y + 4; y++)
    for (let x = floor(e.x - 4); x <= e.x + 4; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const dx = x + 0.5 - e.x, dy = y + 0.5 - e.y, f = dx * ca + dy * sa - 0.6, s = -dx * sa + dy * ca;
      if ((f / 2.1) ** 2 + (s / 3.9) ** 2 < 1) display.setPixel(x, y, 8, 3, 14);
    }
  for (const o of [-2.5, -1.5, 1.5, 2.5]) {
    const x = floor(e.x - sa * o), y = floor(e.y + ca * o);
    if (x >= 0 && x < W && y >= 0 && y < H) display.setPixel(x, y, c[0], c[1], c[2]);
  }
}

// The walker from above: a pale head over shoulders in a violet coat that
// rock with each step, one arm out in front holding the torch. About 5 LEDs
// across, so it fills the corridor and reads as someone, not a spark.
function drawWalker(display, S) {
  const ca = cos(S.ang), sa = sin(S.ang);
  const rock = 0.22 * sin(S.stride * 0.8);
  for (let y = floor(S.wy - 5); y <= S.wy + 5; y++)
    for (let x = floor(S.wx - 5); x <= S.wx + 5; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const dx = x + 0.5 - S.wx, dy = y + 0.5 - S.wy;
      const f = dx * ca + dy * sa, s = -dx * sa + dy * ca, fs = f + rock * s;
      if (f > 2.3 && f < 3.5 && s > 0.2 && s < 1.6) display.setPixel(x, y, 255, 250, 225);
      else if ((f - 0.15) ** 2 + s * s < 1.5) display.setPixel(x, y, 255, 208, 165);
      else if (f > 0.4 && f <= 2.3 && s > 0.3 && s < 1.5) display.setPixel(x, y, 175, 95, 255);
      else if (((fs + 0.45) / 1.45) ** 2 + (s / 2.6) ** 2 < 1) display.setPixel(x, y, 140, 55, 255);
    }
}
