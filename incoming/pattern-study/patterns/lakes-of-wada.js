// ===== Patternflow pattern =====
// Title:   Lakes of Wada
// Family:  topology
// Idea:    An island holds two lakes, and lake one, lake two and the sea take turns digging one-LED canals into the dry land until none of it lies farther than 32, then 16, 8, 4, 2 and 1 LEDs from the digging water, no water ever touching another, so the canals interleave until nearly every LED of land left is a one-LED wall between two waters; the finished labyrinth stands three seconds, the sea floods it and a new island rises.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Lakes of Wada (Kunizō Yoneyama, 1917, after Takeo Wada), pattern round 34
// Round:   34
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Lakes=3..5, Wander=0..1
//
// Knob 1: Hue. Turns the waters round the wheel together, each the same step from the next. At 0 the sea is azure, lake one pink and lake two lime; at 0.17 the sea is violet, lake one orange and lake two green; at 0.33 the three colours have moved on by one water and the sea is pink.
// Knob 2: Speed. At 2 three canal heads dig 160 LEDs a second between them, a fresh island is dug in about 15 seconds, the finished labyrinth stands 3 seconds, the flood takes 1.2 and the new island rises in 1; the panel opens on an island 6 seconds into its digging. At 0.2 they dig 16 a second and an island takes two and a half minutes; at 3, 240 a second and about 10 seconds.
// Knob 3: Lakes. How many waters share the shore, the sea counted: at 3 two lakes and the sea, a third of the wheel apart; at 4 three lakes, a quarter apart; at 5 four lakes, a fifth apart. Turning it floods the island and raises a new one with that many waters.
// Knob 4: Wander. How a canal finds the far land. At 0 it takes the shortest way through the land, ties broken toward the target, so canals run straight or in even steps; at 0.06 almost the same; at 1 its heading drifts up to 37 degrees with every LED and the canals wind, so the walls between them become a maze of bends.
// Buttons: K1 tap floods the island now and raises a new one.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, sin, cos, atan2, exp, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

const LAND = -1, BIG = 30000;
// Canal heads digging at once for the water whose turn it is.
const TIPS = 3;
// The first turn's distance; every later turn halves it, down to 1.
const D0 = 32;
// LEDs dug a second for each unit of Speed.
const RATE = 80;
// Distance searches a frame may run, so a late turn full of short canals
// spreads over frames instead of stalling one.
const SEARCHES = 14;
// LEDs a turn digs before it starts no new canal, a third of it once the
// distance is 4 or less, so the water whose turn comes at a fine distance
// cannot take the whole island.
const TURN_CAP = 160;
// Hue of the sea at Hue 0; the lakes follow round the wheel.
const H0 = 0.56;
const NB = [1, -1, W, -W], ANG = [0, PI, PI / 2, -PI / 2];
const wrap = (a) => a - 2 * PI * floor((a + PI) / (2 * PI));

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, n: 3, wander: 0.06, warm: false, clock: 0, acc: 0,
    phase: "dig", pt: 0, stage: 0, turnDug: 0, roundDug: 0, roundTurns: 0, stageSteps: 0, searches: 0, rr: 0,
    wat: new Int8Array(N), born: new Float32Array(N), give: new Uint8Array(N),
    D: new Int16Array(N), C: new Int16Array(N), cw: -1, clr: 2, F: new Float32Array(N), FD: new Int16Array(N), fdMax: 1, fMax: 1,
    Q: new Int32Array(N), tips: [], c: [0, 0, 0], next: null,
  };
  for (let k = 0; k < TIPS; k++) params.s.tips.push({ on: false, sleep: false, pos: 0, tgt: 0, T: new Int16Array(N), steps: 0, cap: 0, h: 0 });
}

// ---------- the island ----------

// A smooth random field on a coarse lattice, eased between lattice points.
function field(gx, gy) {
  const g = new Float32Array((gx + 1) * (gy + 1));
  for (let i = 0; i < g.length; i++) g[i] = random() * 2 - 1;
  const out = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = (x / (W - 1)) * gx, v = (y / (H - 1)) * gy;
      const i = min(gx - 1, floor(u)), j = min(gy - 1, floor(v));
      const fu = sm(0, 1, u - i), fv = sm(0, 1, v - j);
      const a = g[j * (gx + 1) + i], b = g[j * (gx + 1) + i + 1], c = g[(j + 1) * (gx + 1) + i], d = g[(j + 1) * (gx + 1) + i + 1];
      out[y * W + x] = (a + (b - a) * fu) * (1 - fv) + (c + (d - c) * fu) * fv;
    }
  return out;
}

// A new island with n - 1 lakes: water 0 is the sea, 1..n-1 the lakes.
// Every water is kept at least two LEDs from every other, so no two touch
// even at a corner.
function makeIsland(n) {
  const wat = new Int8Array(N), f = new Float32Array(N), Q = new Int32Array(N);
  const a = field(5, 9), b = field(11, 21);
  const rx = 29.5 + random() * 2, ry = 59 + random() * 3, cx = 31.5 + (random() - 0.5) * 3, cy = 63.5 + (random() - 0.5) * 6;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, dx = (x - cx) / rx, dy = (y - cy) / ry;
      // The coast bends away from the panel's rim instead of running along it.
      const rim = min(x, W - 1 - x, y, H - 1 - y);
      f[p] = 0.6 * (1 - dx * dx - dy * dy) + 0.32 * a[p] + 0.12 * b[p] - 0.5 * (1 - sm(1.5, 6, rim));
      const edge = rim < 2;
      wat[p] = f[p] > 0 && !edge ? LAND : 0;
    }
  // Keep the largest piece of land, and fill any pond the field left in it.
  const lab = new Int32Array(N).fill(-1);
  let best = -1, bestSize = 0;
  for (let s = 0; s < N; s++) {
    if (wat[s] !== LAND || lab[s] >= 0) continue;
    let qh = 0, qt = 0;
    Q[qt++] = s;
    lab[s] = s;
    while (qh < qt) {
      const p = Q[qh++], x = p % W;
      for (let k = 0; k < 4; k++) {
        const q = p + NB[k];
        if ((k === 0 && x === W - 1) || (k === 1 && x === 0) || q < 0 || q >= N) continue;
        if (wat[q] === LAND && lab[q] < 0) (lab[q] = s), (Q[qt++] = q);
      }
    }
    if (qt > bestSize) (bestSize = qt), (best = s);
  }
  for (let p = 0; p < N; p++) if (wat[p] === LAND && lab[p] !== best) wat[p] = 0;
  const sea = new Uint8Array(N);
  let qh = 0, qt = 0;
  for (let p = 0; p < N; p++) {
    const x = p % W, y = (p / W) | 0;
    if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && wat[p] !== LAND) (sea[p] = 1), (Q[qt++] = p);
  }
  while (qh < qt) {
    const p = Q[qh++], x = p % W;
    for (let k = 0; k < 4; k++) {
      const q = p + NB[k];
      if ((k === 0 && x === W - 1) || (k === 1 && x === 0) || q < 0 || q >= N) continue;
      if (!sea[q] && wat[q] !== LAND) (sea[q] = 1), (Q[qt++] = q);
    }
  }
  for (let p = 0; p < N; p++) if (!sea[p]) wat[p] = LAND;
  // Distance from the coast, through the land.
  const cd = new Int16Array(N).fill(BIG);
  qh = qt = 0;
  for (let p = 0; p < N; p++) if (wat[p] === 0) (cd[p] = 0), (Q[qt++] = p);
  while (qh < qt) {
    const p = Q[qh++], x = p % W;
    for (let k = 0; k < 4; k++) {
      const q = p + NB[k];
      if ((k === 0 && x === W - 1) || (k === 1 && x === 0) || q < 0 || q >= N) continue;
      if (wat[q] === LAND && cd[q] === BIG) (cd[q] = cd[p] + 1), (Q[qt++] = q);
    }
  }
  // The lakes, spread over the island: each the best of 60 tries, as far as
  // it can be from the lakes already placed.
  const lakes = [];
  for (let w = 1; w < n; w++) {
    const r = 4 + random() * 2;
    let bx = -1, by = -1, bs = -1;
    for (let k = 0; k < 60; k++) {
      const p = floor(random() * N);
      if (wat[p] !== LAND || cd[p] < r + 9) continue;
      const x = p % W, y = (p / W) | 0;
      let s = 200 + random();
      for (const l of lakes) s = min(s, sqrt((x - l.x) ** 2 + (y - l.y) ** 2) - l.r - r);
      if (s > bs) (bs = s), (bx = x), (by = y);
    }
    if (bx < 0) continue;
    lakes.push({ x: bx, y: by, r });
    const ph = random() * 6.28;
    for (let y = max(2, floor(by - r - 2)); y <= min(H - 3, by + r + 2); y++)
      for (let x = max(2, floor(bx - r - 2)); x <= min(W - 3, bx + r + 2); x++) {
        const p = y * W + x, dx = x - bx, dy = y - by;
        if (wat[p] !== LAND || cd[p] < 3) continue;
        const th = atan2(dy, dx);
        if (sqrt(dx * dx + dy * dy) > r * (1 + 0.12 * sin(2 * th + ph) + 0.1 * sin(3 * th + 2 * ph))) continue;
        let ok = true;
        for (let v = -2; v <= 2 && ok; v++) for (let u = -2; u <= 2; u++) if (wat[p + v * W + u] > 0 && wat[p + v * W + u] !== w) ok = false;
        if (ok) wat[p] = w;
      }
  }
  let fMax = 0;
  for (let p = 0; p < N; p++) fMax = max(fMax, f[p]);
  return { wat, f, fMax };
}

function begin(S, isl) {
  S.wat.set(isl.wat);
  S.F.set(isl.f);
  S.fMax = isl.fMax;
  S.born.fill(-99);
  S.give.fill(0);
  S.stage = 0;
  S.cw = -1;
  S.turnDug = 0;
  S.roundDug = 0;
  S.roundTurns = 0;
  S.stageSteps = 0;
  for (const t of S.tips) (t.on = false), (t.sleep = false);
}

// ---------- digging ----------

const turnWater = (S) => (S.stage + 1) % S.n;
const turnDist = (S) => max(1, floor(D0 / 2 ** S.stage));
// How far a canal keeps from the other waters: a quarter of the turn's
// distance, and never closer than one LED of land between. A long early
// canal that ran up to another water's shore would close the way past it.
const turnClear = (S) => max(2, floor(turnDist(S) / 4));

// Chebyshev distance from every cell to the nearest water other than w,
// into S.C. The others hold still during w's turn, so once a turn is enough.
function clearance(S, w) {
  const { wat, C, Q } = S;
  C.fill(BIG);
  let qh = 0, qt = 0;
  for (let p = 0; p < N; p++) if (wat[p] !== LAND && wat[p] !== w) (C[p] = 0), (Q[qt++] = p);
  while (qh < qt) {
    const p = Q[qh++], x = p % W, y = (p / W) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const u = x + dx, v = y + dy;
        if (u < 0 || u >= W || v < 0 || v >= H) continue;
        const q = v * W + u;
        if (C[q] === BIG) (C[q] = C[p] + 1), (Q[qt++] = q);
      }
  }
  S.cw = w;
}

// Land a canal of w may take at all: inside the panel's rim and clear of
// the other waters.
const free = (S, c) => S.wat[c] === LAND && S.C[c] >= S.clr && c % W > 0 && c % W < W - 1 && c >= W && c < N - W;

// May water w dig land cell c, coming from its own cell t? Of c's eight
// neighbours only t and the two cells beside t may be water, so a canal
// never runs alongside itself or another canal of its own water.
function canDig(S, c, t, w) {
  if (!free(S, c)) return false;
  const wat = S.wat, cx = c % W, cy = (c / W) | 0, ex = (t % W) - cx, ey = ((t / W) | 0) - cy;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || wat[c + dy * W + dx] === LAND) continue;
      // t itself, or a cell beside t across the canal's line.
      if ((ex !== 0 && dx === ex) || (ey !== 0 && dy === ey)) continue;
      return false;
    }
  return true;
}

// Land with no water at all among its eight neighbours: a canal can pass.
function open(S, c) {
  if (!free(S, c)) return false;
  const wat = S.wat;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (wat[c + dy * W + dx] !== LAND) return false;
  return true;
}

// Distance through the land from water w (and from the targets the other
// heads are already digging toward), into S.D.
function distances(S, w, mine) {
  const { wat, D, Q } = S;
  D.fill(BIG);
  let qh = 0, qt = 0;
  for (let p = 0; p < N; p++) if (wat[p] === w) (D[p] = 0), (Q[qt++] = p);
  for (const t of S.tips) if (t !== mine && t.on && D[t.tgt] === BIG) (D[t.tgt] = 0), (Q[qt++] = t.tgt);
  while (qh < qt) {
    const p = Q[qh++], x = p % W;
    for (let k = 0; k < 4; k++) {
      const q = p + NB[k];
      if ((k === 0 && x === W - 1) || (k === 1 && x === 0) || q < 0 || q >= N) continue;
      if (wat[q] === LAND && D[q] === BIG) (D[q] = D[p] + 1), (Q[qt++] = q);
    }
  }
}

function dig(S, c, w) {
  S.wat[c] = w;
  S.born[c] = S.clock;
  S.turnDug++;
}

function finish(S, tip) {
  tip.on = false;
  S.give[tip.tgt] = 1;
  for (const t of S.tips) t.sleep = false;
}

// A new canal for this head: the land farthest from the water whose turn it
// is, and the nearest place on that water's shore to set out from.
// Returns 1 if it dug, 0 if this turn has nothing left for it, -1 to retry.
function startCanal(S, tip) {
  const w = turnWater(S), d = turnDist(S), { D, give, Q } = S;
  S.searches++;
  if (S.cw !== w) clearance(S, w);
  S.clr = turnClear(S);
  distances(S, w, tip);
  let m = d + 1, cnt = 0, X = -1;
  for (let p = 0; p < N; p++) {
    const v = D[p];
    if (v < m || v === BIG || give[p] || !free(S, p)) continue;
    if (v > m) (m = v), (cnt = 0);
    if (random() * ++cnt < 1) X = p;
  }
  if (X < 0) return 0;
  // Distance to X through land a canal can cross; the first cells reached
  // that w can dig from its shore are where the canal may start.
  const T = tip.T;
  T.fill(BIG);
  let qh = 0, qt = 0, start = -1, from = -1, tmin = BIG, seen = 0;
  T[X] = 0;
  Q[qt++] = X;
  const tryStart = (c) => {
    for (let k = 0; k < 4; k++) {
      const t = c + NB[k];
      if (S.wat[t] === w && canDig(S, c, t, w) && random() * ++seen < 1) (start = c), (from = t), (tmin = T[c]);
    }
  };
  tryStart(X);
  while (qh < qt && T[Q[qh]] <= tmin) {
    const p = Q[qh++], x = p % W;
    for (let k = 0; k < 4; k++) {
      const q = p + NB[k];
      if ((k === 0 && x === W - 1) || (k === 1 && x === 0) || T[q] !== BIG) continue;
      if (open(S, q)) {
        T[q] = T[p] + 1;
        Q[qt++] = q;
      } else if (S.wat[q] === LAND) {
        T[q] = T[p] + 1;
        if (T[q] <= tmin) tryStart(q);
      }
    }
  }
  if (start < 0) {
    // No way in from w's shore: none of this land counts for the turn.
    for (let i = 0; i < qt; i++) give[Q[i]] = 1;
    give[X] = 1;
    return -1;
  }
  // Finish the map past the start, so a wandering head still knows its way.
  while (qh < qt) {
    const p = Q[qh++], x = p % W;
    for (let k = 0; k < 4; k++) {
      const q = p + NB[k];
      if ((k === 0 && x === W - 1) || (k === 1 && x === 0) || T[q] !== BIG || !open(S, q)) continue;
      T[q] = T[p] + 1;
      Q[qt++] = q;
    }
  }
  dig(S, start, w);
  Object.assign(tip, { on: true, pos: start, tgt: X, steps: 1, cap: 2 * T[start] + 12 });
  tip.h = atan2(((start / W) | 0) - ((from / W) | 0), (start % W) - (from % W));
  if (T[start] === 0) finish(S, tip);
  return 1;
}

// One LED more for an active head: toward X along the land map, with the
// heading drifting as Wander allows.
function extend(S, tip) {
  const w = turnWater(S), t = tip.pos, T = tip.T, u = S.wander;
  const beta = 3.2 - 2.4 * u, kap = 0.5 + 2.0 * u, noise = 0.12 + 1.1 * u;
  let best = -1, bs = -1e9;
  for (let k = 0; k < 4; k++) {
    const c = t + NB[k];
    if (!canDig(S, c, t, w)) continue;
    const dT = T[c] === BIG ? 3 : T[c] - T[t];
    const s = -beta * dT + kap * cos(ANG[k] - tip.h) + noise * random();
    if (s > bs) (bs = s), (best = k);
  }
  if (best < 0) {
    finish(S, tip);
    return false;
  }
  const c = t + NB[best];
  dig(S, c, w);
  tip.pos = c;
  tip.steps++;
  const tx = tip.tgt % W, ty = (tip.tgt / W) | 0, cx = c % W, cy = (c / W) | 0;
  tip.h += 0.25 * wrap(ANG[best] - tip.h) + 0.12 * (1 - u) * wrap(atan2(ty - cy, tx - cx) - tip.h) + (random() - 0.5) * 1.3 * u;
  if (T[c] === 0 || tip.steps >= tip.cap) finish(S, tip);
  return true;
}

function nextTurn(S) {
  for (const t of S.tips) (t.on = false), (t.sleep = false);
  S.give.fill(0);
  S.cw = -1;
  // A whole round of turns at distance 1 that found almost nothing to dig:
  // the labyrinth is finished.
  if (turnDist(S) === 1) {
    S.roundDug += S.turnDug;
    if (++S.roundTurns >= S.n) {
      if (S.roundDug < 4) {
        S.phase = "hold";
        S.pt = 0;
      }
      S.roundDug = 0;
      S.roundTurns = 0;
    }
  }
  S.stage++;
  S.turnDug = 0;
  S.stageSteps = 0;
}

// One step of digging: one LED for one head, round robin. Once the turn has
// dug its share no new canal starts, but the heads finish the ones they are
// on, so a long canal into the far land is not left half dug.
function step(S, limited) {
  if (++S.stageSteps > 1400) {
    nextTurn(S);
    return;
  }
  const full = S.turnDug >= (turnDist(S) > 4 ? TURN_CAP : TURN_CAP / 3);
  for (let tries = 0; tries < TIPS * 2; tries++) {
    const tip = S.tips[(S.rr = (S.rr + 1) % TIPS)];
    if (tip.on) {
      if (extend(S, tip)) return;
      continue;
    }
    if (tip.sleep || full) continue;
    if (limited && S.searches >= SEARCHES) return;
    const r = startCanal(S, tip);
    if (r === 1) return;
    if (r === 0) tip.sleep = true;
  }
  if (S.tips.every((t) => !t.on && (t.sleep || full))) nextTurn(S);
}

// ---------- flood ----------

// Distance from the sea through everything else, for the flood front.
function floodMap(S) {
  const { wat, FD, Q } = S;
  FD.fill(BIG);
  let qh = 0, qt = 0;
  for (let p = 0; p < N; p++) if (wat[p] === 0) (FD[p] = 0), (Q[qt++] = p);
  let m = 1;
  while (qh < qt) {
    const p = Q[qh++], x = p % W;
    for (let k = 0; k < 4; k++) {
      const q = p + NB[k];
      if ((k === 0 && x === W - 1) || (k === 1 && x === 0) || q < 0 || q >= N || FD[q] !== BIG) continue;
      FD[q] = FD[p] + 1;
      m = max(m, FD[q]);
      Q[qt++] = q;
    }
  }
  S.fdMax = m;
}

function startFlood(S) {
  floodMap(S);
  for (const t of S.tips) t.on = false;
  S.phase = "flood";
  S.pt = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.wander = cl(k[3], 0, 1);
  const n = round(cl(k[2], 3, 5));
  if (!S.warm) {
    S.n = n;
    begin(S, makeIsland(n));
    // Open on an island the waters have been digging for six seconds at
    // this Speed: at 2, the first two turns done and the sea into its own.
    const pre = round(6 * S.speed * RATE);
    for (let i = 0; i < pre; i++) step(S, false);
    S.clock = 10;
    S.warm = true;
  } else if (n !== S.n && S.phase !== "flood" && S.phase !== "rise") {
    S.next = n;
    startFlood(S);
  }
  if (input.btnPressed && input.btnPressed[0] && S.phase !== "flood" && S.phase !== "rise") startFlood(S);
  const ds = (d * S.speed) / 2;
  S.clock += ds;
  S.pt += ds;
  if (S.phase === "dig") {
    S.acc += d * S.speed * RATE;
    S.searches = 0;
    let steps = 0;
    while (S.acc >= 1 && steps < 200 && S.phase === "dig") {
      step(S, true);
      S.acc -= 1;
      steps++;
      if (S.searches >= SEARCHES) {
        S.acc = min(S.acc, 2);
        break;
      }
    }
  } else if (S.phase === "hold" && S.pt > 3) startFlood(S);
  else if (S.phase === "flood" && S.pt > 1.2) {
    if (S.next) (S.n = S.next), (S.next = null);
    begin(S, makeIsland(S.n));
    S.phase = "rise";
    S.pt = 0;
  } else if (S.phase === "rise" && S.pt > 1) {
    S.phase = "dig";
    S.pt = 0;
    S.acc = 0;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { wat, born, c, n } = S;
  const front = S.phase === "flood" ? S.fdMax * sm(0, 1.1, S.pt) : -1;
  const level = S.phase === "rise" ? S.fMax * (1 - sm(0, 0.95, S.pt)) : -1;
  const tipAt = new Set();
  for (const t of S.tips) if (t.on) tipAt.add(t.pos);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let w = wat[p], glow = 0;
      if (front >= 0 && S.FD[p] <= front) {
        w = 0;
        if (S.FD[p] > 0) glow = 0.7 * sm(4, 0, front - S.FD[p]);
      } else if (level >= 0 && S.F[p] <= level) {
        w = 0;
        glow = 0.6 * sm(0.06, 0, level - S.F[p]) * (S.F[p] > 0 ? 1 : 0);
      }
      if (w === LAND) {
        display.setPixel(x, y, 14, 12, 10);
        continue;
      }
      if (front < 0 && level < 0) glow = tipAt.has(p) ? 1 : exp(-(S.clock - born[p]) / 0.22);
      hsv(S.hue + H0 + w / n, 1, 1, c);
      const v = 255, s = 1 - 0.85 * glow;
      display.setPixel(x, y, round(v * (c[0] * s + 1 - s)), round(v * (c[1] * s + 1 - s)), round(v * (c[2] * s + 1 - s)));
    }
}
