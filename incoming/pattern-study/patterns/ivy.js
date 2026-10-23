// ===== Patternflow pattern =====
// Title:   Ivy
// Family:  growth
// Idea:    Boston ivy climbs a stone wall from the ground to the top of the panel, branching and reaching out tendrils; every year its leaves turn from green through yellow to red, fall down the wall and come back in spring.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 13
// Round:   15
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Vines=2..6, Wind=-1..1
//
// Knob 1: Hue. The leaf colour, starting from green; autumn always turns the leaves a third of the way back round the colour wheel, so green goes through yellow to red.
// Knob 2: Speed. How fast the year turns: at 2 a year is 60 seconds and a new stem climbs the 120 rows of wall in about 16; at 3 a year is 40 seconds, at 0.2 ten minutes. The gusts come and go faster with it.
// Knob 3: Vines. How many stems come out of the ground, 2 to 6; turning it up starts new shoots at the foot of the wall, turning it down cuts stems so they wither.
// Knob 4: Wind. Near 0 a breath of air now and then turns a few leaves silver side up; turned either way the gusts come more often from that side, sweep the wall faster and, past halfway, tear leaves off and blow them away.
// Buttons: K1 tap cuts the oldest stem at the ground: its leaves go brown and drop, the dead wood fades in 5 seconds, and a new shoot starts climbing in its place, or in spring if it is autumn or winter.

const W = 64;
const H = 128;
// The wall is rows 0 to 119, thirty courses of stone four LEDs high; the bed is the eight rows under it.
const GROUND = 120;
const GR = H - GROUND;
// One year in world seconds. Speed 2 runs the world at twice that, so a year is 60 seconds.
const YEAR = 120;
// Shoots grow until GROW_END of the year, leaves start to turn at TURN and are all down by BARE.
const GROW_END = 0.55;
const TURN = 0.56;
const BARE = 0.86;
const MAXS = 500;
const MAXL = 1800;
const MAXF = 260;
const MAXB = 90;
const MAXR = 6;
// A coarse grid of 4 x 4 cells counts stems and leaves, so new growth heads for bare wall.
const GW = 16;
const GH = 30;
// The first update grows the vine for this long, so the panel opens in its third spring with the wall covered.
const PRE = YEAR * 2.22;

// Leaf sprites as dx, dy pairs: a bud, a small leaf, a half-grown one, a full one. shade() lights them from the upper left.
const LEAF = [
  [0, 0],
  [0, -1, -1, 0, 0, 0, 1, 0, 0, 1],
  [0, -1, 1, -1, -1, 0, 0, 0, 1, 0, 2, 0, -1, 1, 0, 1, 1, 1, 2, 1, 0, 2, 1, 2],
  [-1, -2, 0, -2, 1, -2, -2, -1, -1, -1, 0, -1, 1, -1, 2, -1, -2, 0, -1, 0, 0, 0, 1, 0, 2, 0, -1, 1, 0, 1, 1, 1, 0, 2],
];
// A falling leaf seen face on, tipped one way, edge on, tipped the other way.
const FALLS = [
  [-1, 0, 0, 0, 1, 0, 0, -1],
  [-1, -1, 0, 0, 1, 1],
  [0, -1, 0, 0],
  [1, -1, 0, 0, -1, 1],
];
// A tendril curling off the stem to the right; the left mirrors it.
const CURL = [[1, -1], [2, -1], [3, -2], [3, -3], [2, -3]];

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

// From hue a towards hue b the short way round.
function hueTo(a, b, t) {
  return a + (b + Math.round(a - b) - a) * t;
}

function hsv(out, h, s, v) {
  h = (h - Math.floor(h)) * 6;
  for (let i = 0; i < 3; i++) {
    const k = (5 - 2 * i + h) % 6;
    out[i] = 255 * v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)));
  }
  return out;
}

export function setup(params) {
  Object.assign(params, { shoots: [], leaves: [], falls: [], berries: [], queue: [], gusts: [], roots: [], pal: [] });
  for (let r = 0; r < MAXR; r++) params.roots.push({ use: false, wait: false, x: 32, born: 0, dead: -1 });
  // Fallen leaves in the bed: colour, the year they fell and how much is left of them.
  params.gC = new Float32Array(GR * W * 3);
  params.gY = new Int16Array(GR * W).fill(-1);
  params.gA = new Float32Array(GR * W);
  params.occ = new Float32Array(GW * GH);
  params.wall = new Float32Array(W * H * 3);
  params.buf = new Float32Array(W * H * 3);
  for (let k = 0; k <= 16; k++) params.pal.push([0, 0, 0]);
  Object.assign(params, { col: [0, 0, 0], ts: 0, rt: 0, p: 0, year: 0, started: false, nextGust: 0.6, windDir: 1, hue: 0.29, wind: 0.06, want: 2 });
  bakeWall(params);
}

function bakeWall(P) {
  const c = P.col;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (y >= GROUND) {
        // A bed of dark earth with a few pale pebbles; the foot of the wall casts a line of shadow.
        const n = hash(x * 3 + 1, y * 7 + 2);
        if (n < 0.05 && y > GROUND) hsv(c, 0.08, 0.12, 0.27 + 0.08 * hash(x, y));
        else hsv(c, 0.065, 0.5, (y === GROUND ? 0.08 : 0.12) + 0.05 * n);
      } else {
        const course = y >> 2;
        const row = y & 3;
        // Stones five to ten LEDs long, each course laid from its own offset.
        let x0 = -Math.floor(hash(course, 77) * 9);
        let len = 0;
        let id = 0;
        for (;;) {
          len = 5 + Math.floor(hash(course * 31 + id, 5) * 6);
          if (x < x0 + len) break;
          x0 += len;
          id++;
        }
        const col = x - x0;
        if (row === 3 || col === len - 1) hsv(c, 0.6, 0.12, 0.065);
        else {
          const h2 = hash(course * 17 + id, 23);
          let v = 0.135 + 0.05 * hash(course * 131 + id, 9) + 0.012 * (hash(x, y) - 0.5);
          v += row === 0 ? 0.018 : row === 2 ? -0.012 : 0;
          if (col === 0) v += 0.01;
          // Lighter towards the top, where the sky reaches the wall.
          hsv(c, 0.58 + 0.07 * (h2 - 0.5), 0.14 + 0.1 * h2, v * (1.12 - (0.24 * y) / GROUND));
        }
      }
      P.wall.set(c, (y * W + x) * 3);
    }
}

function crowd(P, x, y) {
  if (x < 1 || x > W - 2 || y < 1 || y > GROUND - 2) return 14;
  const cx = Math.floor(x / 4);
  const cy = Math.floor(y / 4);
  const o = P.occ;
  const i = cy * GW + cx;
  return o[i] + 0.3 * ((cx > 0 ? o[i - 1] : 0) + (cx < GW - 1 ? o[i + 1] : 0) + (cy > 0 ? o[i - GW] : 0) + (cy < GH - 1 ? o[i + GW] : 0));
}

function mark(P, x, y, amt) {
  const cx = Math.floor(x / 4);
  const cy = Math.floor(y / 4);
  if (cx >= 0 && cx < GW && cy >= 0 && cy < GH) P.occ[cy * GW + cx] += amt;
}

function newShoot(P, root, gen, x, y, ang, bias, budget) {
  if (P.shoots.length >= MAXS) return null;
  const s = { root, gen, x: [x], y: [y], t: [P.ts], node0: 0, budget, grow: true, top: false, ang, bias, acc: 0, rand: Math.random(), side: Math.random() < 0.5 ? -1 : 1 };
  P.shoots.push(s);
  return s;
}

function addLeaf(P, s, x, y) {
  if (x < 0.5 || x > W - 1.5 || y < 1 || y > GROUND - 3 || P.leaves.length >= MAXL) return;
  // Whole branches turn together, so autumn comes in patches.
  const turn = TURN + 0.07 * s.rand + 0.06 * Math.random();
  const size = s.gen === 0 ? 3 : s.gen === 1 && Math.random() < 0.6 ? 3 : 2;
  P.leaves.push({ x, y, t: P.ts, root: s.root, size, gone: -1, r1: Math.random(), r2: Math.random(), r3: Math.random(), sus: Math.random(), flip: 0, turn, drop: turn + 0.06 + 0.09 * Math.random() });
  mark(P, x, y, 0.8);
}

function branch(P, s, x, y, a, gen, budget) {
  const cA = crowd(P, x + Math.sin(a + 1.1) * 5, y - Math.cos(a + 1.1) * 5);
  const cB = crowd(P, x + Math.sin(a - 1.1) * 5, y - Math.cos(a - 1.1) * 5);
  if (Math.min(cA, cB) > 7) return;
  const side = cA < cB ? 1 : -1;
  const c = newShoot(P, s.root, gen + 1, x, y, a + side * (0.9 + Math.random() * 0.4), side * (0.35 + Math.random() * 0.35), budget);
  if (c) c.node0 = 1;
}

function addPoint(P, s) {
  const n = s.x.length;
  const x = s.x[n - 1];
  const y = s.y[n - 1];
  const gen = s.gen;
  if (s.budget <= 0) {
    s.grow = false;
    return;
  }
  let a = s.ang + (Math.random() - 0.5) * 0.55;
  // A main stem keeps to its own lane up the wall; side shoots set off sideways and curve up as they go.
  const lane = gen === 0 && !s.top ? clamp((P.roots[s.root].x - x) * 0.04, -0.5, 0.5) : 0;
  a += (s.bias + lane - a) * (gen === 0 ? 0.15 : 0.1);
  if (gen > 0 && !s.top) s.bias *= 0.98;
  // Of three headings, the one into the barest wall, with a little chance.
  let best = a;
  let bestScore = 1e9;
  for (let c = -1; c <= 1; c++) {
    const ca = a + c * 0.45;
    const score = crowd(P, x + Math.sin(ca) * 4, y - Math.cos(ca) * 4) * 0.3 + Math.abs(c) * 0.3 + Math.random() * 0.35;
    if (score < bestScore) [bestScore, best] = [score, ca];
  }
  a = clamp(best, -2, 2);
  if (y - Math.cos(a) < 1.5 && !s.top) {
    // At the top of the wall a shoot turns and runs along the coping for a little way.
    s.top = true;
    const side = (x < W / 2) === Math.random() < 0.7 ? 1 : -1;
    s.bias = side * 1.5;
    a = side * 1.3;
    s.budget = Math.min(s.budget, 8 + Math.random() * 12);
  }
  const nx = x + Math.sin(a);
  const ny = y - Math.cos(a);
  if (ny < 0.5 || nx < 0.5 || nx > W - 1.5 || ny > GROUND - 1.5) {
    s.grow = false;
    return;
  }
  s.ang = a;
  s.budget--;
  s.x.push(nx);
  s.y.push(ny);
  s.t.push(P.ts);
  mark(P, nx, ny, 1);
  if ((s.node0 + n) % 3 === 0) {
    s.side = -s.side;
    addLeaf(P, s, nx - Math.cos(a) * s.side * 2.2, ny - Math.sin(a) * s.side * 2.2 - 0.7);
  }
  // Low on the wall a main stem is bushier.
  if (gen < 2 && Math.random() < (gen === 0 ? (ny > 70 ? 0.12 : 0.07) : 0.035)) branch(P, s, nx, ny, a, gen, gen === 0 ? 18 + Math.random() * 34 : 6 + Math.random() * 12);
  if (gen > 0 && Math.random() < 0.025 && P.berries.length < MAXB) P.berries.push({ x: nx, y: ny, root: s.root, r: Math.random(), t: P.ts });
}

// Where a new stem comes out of the ground: as far from the others as the bed allows.
function freeSpot(P, r) {
  let best = 32;
  let bestD = -1;
  for (let x = 5; x <= 58; x++) {
    const d = Math.min(99, ...P.roots.map((q, i) => (i !== r && q.use ? Math.abs(q.x - x) : 99))) + Math.random() * 2;
    if (d > bestD) [bestD, best] = [d, x];
  }
  return best;
}

function cut(P, r) {
  const R = P.roots[r];
  if (R.use && !R.wait && R.dead < 0) R.dead = P.rt;
}

// Cut the oldest living stem, if it has lived at least this many years.
function cutOldest(P, years) {
  let old = -1;
  P.roots.forEach((R, r) => {
    if (R.use && !R.wait && R.dead < 0 && P.year - Math.floor(R.born / YEAR) >= years && (old < 0 || R.born < P.roots[old].born)) old = r;
  });
  if (old >= 0) cut(P, old);
}

// The dead wood has faded: clear it away and let a new stem come up there, if the Vines knob still wants one.
function freeRoot(P, r) {
  const R = P.roots[r];
  P.shoots = P.shoots.filter((s) => s.root !== r);
  P.leaves = P.leaves.filter((l) => l.root !== r);
  P.berries = P.berries.filter((b) => b.root !== r);
  P.queue = P.queue.filter((q) => q.s.root !== r);
  R.dead = -1;
  if (r < P.want) {
    R.wait = true;
    R.x = clamp(R.x + (Math.random() - 0.5) * 8, 5, 58);
  } else R.use = false;
  P.occ.fill(0);
  for (const s of P.shoots) for (let i = 0; i < s.x.length; i++) mark(P, s.x[i], s.y[i], 1);
  for (const l of P.leaves) mark(P, l.x, l.y, 0.8);
}

// Each spring the old wood puts out new side shoots, spread through the growing season.
function springSchedule(P) {
  P.roots.forEach((R, r) => {
    if (!R.use || R.wait || R.dead >= 0) return;
    const cand = P.shoots.filter((s) => s.root === r && s.gen < 2 && s.x.length > 4);
    if (!cand.length) return;
    const count = 8 + Math.floor(Math.random() * 5);
    for (let k = 0; k < count && P.queue.length < 64; k++) {
      const s = cand[Math.floor(Math.random() * cand.length)];
      P.queue.push({ s, i: 1 + Math.floor(Math.random() * (s.x.length - 2)), at: P.year * YEAR + YEAR * (0.06 + 0.34 * Math.random()) });
    }
  });
}

// The world clock: seasons, growth and the year's events, in world seconds.
function stepWorld(P, dts, pre) {
  const prevP = P.p;
  const ts = (P.ts += dts);
  const Y = Math.floor(ts / YEAR);
  const p = (P.p = ts / YEAR - Y);
  if (Y !== P.year) {
    P.year = Y;
    springSchedule(P);
  }
  // In the pre-run last autumn's leaves land in the bed, so the panel opens with them rotting there.
  if (pre && prevP < BARE && p >= BARE)
    for (const l of P.leaves) if (Math.random() < 0.5) stamp(P, l.x + (Math.random() - 0.5) * 14, GROUND + 1 + Math.random() * (GR - 1.5), leafColour(P, l, 1, l.drop));
  // Early in winter a stem three years old is cut back, and a new one comes up in spring.
  if (!pre && prevP < BARE + 0.03 && p >= BARE + 0.03) cutOldest(P, 3);
  P.roots.forEach((R, r) => {
    if (R.use && R.wait && R.dead < 0 && p < 0.42) {
      R.wait = false;
      R.born = ts;
      newShoot(P, r, 0, R.x + (Math.random() - 0.5) * 2, GROUND - 1.6, (Math.random() - 0.5) * 0.4, 0, 9999);
    }
  });

  const f = p < 0.45 ? 1 : p < GROW_END ? (GROW_END - p) / (GROW_END - 0.45) : 0;
  if (f <= 0) return;
  P.queue = P.queue.filter((q) => {
    if (ts < q.at) return true;
    const s = q.s;
    const i = Math.min(q.i, s.x.length - 1);
    if (P.roots[s.root].dead < 0) branch(P, s, s.x[i], s.y[i], 0, Math.min(1, s.gen), 12 + Math.random() * 26);
    return false;
  });
  const shoots = P.shoots;
  for (let k = 0; k < shoots.length; k++) {
    const s = shoots[k];
    if (!s.grow || P.roots[s.root].dead >= 0) continue;
    s.acc += (s.gen === 0 ? 4 : 3) * f * dts;
    while (s.acc >= 1 && s.grow) {
      s.acc -= 1;
      addPoint(P, s);
    }
  }
}

function openAt(P, l, Y) {
  if (l.t >= Y * YEAR) return l.t + 1.5;
  // Old wood comes into leaf low down first.
  return Y * YEAR + YEAR * (0.015 + 0.06 * l.r1 + 0.04 * (1 - l.y / H));
}

// A leaf's colour at year phase p: young lime, deep green, the autumn turn, withering, and the pale underside a gust shows.
function leafColour(P, l, m, p) {
  const lift = 0.86 + 0.28 * l.r1;
  let h = P.hue - 0.055 + 0.065 * m + (l.r2 - 0.5) * 0.04;
  let s = 0.7 + 0.18 * m;
  let v = (0.82 - 0.28 * m) * lift;
  const c = clamp((p - l.turn) / 0.09, 0, 1);
  if (c > 0) {
    h -= (0.31 + (l.r3 > 0.7 ? 0.035 : 0)) * c;
    s += (0.93 - s) * c;
    v = (0.54 + 0.36 * Math.sin(Math.PI * c) + 0.1 * c) * lift;
  }
  const dead = P.roots[l.root].dead;
  if (dead >= 0) {
    const w = clamp((P.rt - dead) / 1.2, 0, 1);
    h = hueTo(h, 0.075, w);
    s += (0.6 - s) * w;
    v += (0.34 - v) * w;
  }
  const f = l.flip;
  if (f > 0) {
    h -= 0.02 * f;
    s *= 1 - 0.62 * f;
    v += (0.95 - v) * 0.55 * f;
  }
  return hsv(P.col, h, s, Math.min(1, v));
}

function stamp(P, x, y, c) {
  const cx = Math.round(x);
  const cy = Math.floor(y) - GROUND;
  const sp = FALLS[0];
  for (let k = 0; k < sp.length; k += 2) {
    const px = cx + sp[k];
    const py = cy + sp[k + 1];
    if (px < 0 || px >= W || py < 0 || py >= GR) continue;
    const g = py * W + px;
    for (let j = 0; j < 3; j++) P.gC[g * 3 + j] = c[j] * 0.8 * shade(sp[k], sp[k + 1]);
    P.gY[g] = P.year;
    P.gA[g] = 1;
  }
}

function dropLeaf(P, l, fall) {
  l.gone = P.year;
  if (!fall || P.falls.length >= MAXF) return;
  const flip = l.flip;
  l.flip = 0;
  const c = leafColour(P, l, clamp((P.ts - openAt(P, l, P.year)) / (YEAR * 0.1), 0, 1), P.p);
  l.flip = flip;
  const s = Math.random() < 0.5 ? -1 : 1;
  P.falls.push({ x: l.x, y: l.y, vy: 1 + Math.random() * 2, ph: Math.random() * 6.283, spin: s * (3 + Math.random() * 4), term: 8 + Math.random() * 7, land: GROUND + 1 + Math.random() * (GR - 1.5), c: c.slice() });
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 2, 0.06];
  dt = Math.min(dt, 0.1);
  P.hue = 0.29 + k[0];
  const speed = clamp(k[1], 0.05, 3);
  const n = clamp(Math.round(k[2]), 2, MAXR);
  P.wind = clamp(k[3], -1, 1);
  if (!P.started) {
    P.started = true;
    P.want = n;
    for (let r = 0; r < n; r++) Object.assign(P.roots[r], { use: true, wait: r < n - 1, x: clamp(((r + 0.5) * W) / n + (Math.random() - 0.5) * 6, 5, 58) });
    // The youngest stem comes up in the third spring, so the panel opens with it climbing.
    const late = P.roots[n - 1];
    while (P.ts < PRE) {
      if (P.ts >= YEAR * 2.1 && !late.born) late.wait = true;
      stepWorld(P, 0.1, true);
    }
  }
  P.rt += dt;
  // Follow the Vines knob: new stems where there are too few, cut ones where there are too many.
  P.want = n;
  P.roots.forEach((R, r) => {
    if (r < n && !R.use) Object.assign(R, { use: true, dead: -1, wait: true, x: freeSpot(P, r) });
    else if (r >= n && R.use && R.dead < 0) {
      if (R.wait) R.use = R.wait = false;
      else cut(P, r);
    }
  });
  if (input.btnPressed && input.btnPressed[0]) cutOldest(P, -9);
  stepWorld(P, dt * speed, false);
  P.roots.forEach((R, r) => {
    if (R.dead >= 0 && P.rt - R.dead > 5.2) freeRoot(P, r);
  });
  stepGusts(P, dt, speed / 2);
  stepLeaves(P, dt);
  stepFalling(P, dt);
  // Last year's leaves rot away in the bed through the spring.
  for (let g = 0; g < GR * W; g++) {
    if (P.gY[g] < 0 || P.gY[g] >= P.year) continue;
    P.gA[g] = 1 - clamp((P.p - 0.03 - 0.3 * hash(g, 3)) / 0.012, 0, 1);
    if (P.gA[g] <= 0) P.gY[g] = -1;
  }
}

// Gusts run in the panel's own time, but a faster world brings them more often and sends them across quicker.
function stepGusts(P, dt, quick) {
  const aw = Math.abs(P.wind);
  P.nextGust -= dt;
  if (P.nextGust <= 0) {
    P.nextGust = ((3.2 - 2.4 * aw) * (0.6 + 0.8 * Math.random())) / quick;
    if (P.gusts.length < 6) {
      const dir = aw > 0.12 ? Math.sign(P.wind) : Math.random() < 0.5 ? -1 : 1;
      const w = 5 + 7 * aw + 3 * Math.random();
      P.gusts.push({ dir, w, s: Math.min(1, 0.5 + 0.5 * aw + 0.15 * Math.random()), v: (26 + 40 * aw + 10 * Math.random()) * quick, x: dir > 0 ? -2 * w - 8 : W + 2 * w + 8, tilt: (Math.random() - 0.5) * 0.5, seed: Math.random() * 100, row: new Float32Array(H) });
      P.windDir = dir;
    }
  }
  P.gusts = P.gusts.filter((g) => {
    g.x += g.dir * g.v * dt;
    // The front of a gust is a slanted, wavy line across the wall.
    for (let y = 0; y < H; y++) g.row[y] = g.x + g.tilt * (y - 64) + 4 * Math.sin(y * 0.06 + g.seed);
    return g.x > -2 * g.w - 50 && g.x < W + 2 * g.w + 50;
  });
}

// How hard the gusts press on a point, signed by their direction.
function gustAt(P, x, y) {
  let push = 0;
  const yi = clamp(Math.round(y), 0, H - 1);
  for (const g of P.gusts) {
    const d = (x - g.row[yi]) / g.w;
    if (d > -1 && d < 1) push += g.dir * g.s * (1 - d * d);
  }
  return push;
}

function stepLeaves(P, dt) {
  const Y = P.year;
  const p = P.p;
  const aw = Math.abs(P.wind);
  for (const l of P.leaves) {
    if (l.gone === Y) continue;
    const dead = P.roots[l.root].dead;
    const open = P.ts > openAt(P, l, Y);
    if (dead >= 0) {
      if (P.rt - dead > 0.8 + 2.6 * l.r3) dropLeaf(P, l, open && p < l.drop);
      continue;
    }
    if (p >= l.drop) {
      dropLeaf(P, l, p - l.drop < 0.03);
      continue;
    }
    if (!open) continue;
    // A gust lifts the leaves it passes over and shows their pale undersides; stiffer leaves need a stronger gust.
    let t = 0;
    const yi = clamp(Math.round(l.y), 0, H - 1);
    for (const g of P.gusts) {
      const d = (l.x - g.row[yi]) / g.w;
      if (d > -1 && d < 1) t = Math.max(t, (1 - d * d) * clamp((g.s - l.sus * 0.8) * 3, 0, 1));
    }
    l.flip += (t - l.flip) * Math.min(1, dt * (t > l.flip ? 12 : 3));
    if (aw > 0.45 && l.flip > 0.55 && Math.random() < dt * (aw - 0.45) * 0.12 * (1 + 30 * clamp((p - l.turn) / 0.09, 0, 1))) dropLeaf(P, l, true);
  }
}

function stepFalling(P, dt) {
  P.falls = P.falls.filter((f) => {
    f.ph += f.spin * dt;
    f.vy += (f.term - f.vy) * Math.min(1, dt * 1.5);
    f.x += (P.wind * 18 + gustAt(P, f.x, f.y) * 22 + Math.sin(f.ph) * 6) * dt;
    f.y += f.vy * (0.65 + 0.35 * Math.abs(Math.cos(f.ph))) * dt;
    if (f.x < -3 || f.x > W + 2) return false;
    if (f.y < f.land) return true;
    stamp(P, f.x, f.land, f.c);
    return false;
  });
}

// Lighter up and to the left, with a darker midrib down the middle.
function shade(dx, dy) {
  return 1 - 0.06 * dx - 0.08 * dy - (dx === 0 && dy > -2 ? 0.06 : 0);
}

function put(buf, x, y, c, sh, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] += (c[0] * sh - buf[o]) * a;
  buf[o + 1] += (c[1] * sh - buf[o + 1]) * a;
  buf[o + 2] += (c[2] * sh - buf[o + 2]) * a;
}

export function draw(display, params) {
  const P = params;
  const buf = P.buf;
  buf.set(P.wall);
  const ts = P.ts;
  const Y = P.year;
  const p = P.p;
  const hb = P.hue;
  const col = P.col;

  // Fallen leaves in the bed, browner after the turn of the year.
  const brown = [70, 38, 18];
  for (let g = 0; g < GR * W; g++) {
    if (P.gY[g] < 0) continue;
    const age = P.gY[g] < Y ? 0.6 : 0;
    const o = (GROUND * W + g) * 3;
    for (let k = 0; k < 3; k++) buf[o + k] += (P.gC[g * 3 + k] + (brown[k] - P.gC[g * 3 + k]) * age - buf[o + k]) * P.gA[g];
  }

  // Stems: green and supple when new, brown wood after a third of a year, thicker low on the old stems.
  for (let k = 0; k <= 16; k++) hsv(P.pal[k], hueTo(hb - 0.05, 0.04, k / 16), 0.6 - (0.1 * k) / 16, 0.62 - (0.28 * k) / 16);
  const grey = [72, 64, 58];
  const c = [0, 0, 0];
  for (const s of P.shoots) {
    const dead = P.roots[s.root].dead;
    const e = dead >= 0 ? P.rt - dead : 0;
    const fade = clamp(e / 2.5, 0, 1);
    const alpha = 1 - clamp((e - 2.5) / 2.5, 0, 1);
    const len = s.x.length;
    for (let i = 0; i < len; i++) {
      const x = Math.round(s.x[i]);
      const y = Math.round(s.y[i]);
      const age = ts - s.t[i];
      const pc = P.pal[Math.round(clamp(age / (YEAR * 0.33), 0, 1) * 16)];
      for (let k = 0; k < 3; k++) c[k] = pc[k] + (grey[k] - pc[k]) * fade;
      put(buf, x, y, c, 1, alpha);
      if (s.gen === 0 && age > YEAR * 0.5) {
        put(buf, x + 1, y, c, 0.7, alpha);
        if (age > YEAR * 1.1 && y > GROUND - 45) put(buf, x - 1, y, c, 0.85, alpha);
      }
      // Young tendrils reach off the stem between the leaves and fade into it as the wood hardens.
      if (s.gen < 2 && age < YEAR * 0.15 && (s.node0 + i) % 9 === 4) {
        const ta = clamp((YEAR * 0.15 - age) / (YEAR * 0.05), 0, 1) * alpha;
        const sd = (s.node0 + i) & 8 ? 1 : -1;
        hsv(col, hb - 0.08, 0.5, 0.72);
        CURL.forEach(([dx, dy], q) => put(buf, x + sd * dx, y + dy, col, 1, ta * (1 - q * 0.12)));
      }
    }
    // A growing tip glows pale and feels ahead with a tendril, which circles slowly the way climbing shoots do.
    if (s.grow && p < GROW_END && dead < 0) {
      const x = s.x[len - 1];
      const y = s.y[len - 1];
      const sn = Math.sin(s.ang);
      const cs = Math.cos(s.ang);
      hsv(col, hb - 0.09, 0.45, 0.95);
      const nut = 1.4 * Math.sin(ts * 0.8 + s.rand * 40);
      for (let d = 0; d <= 3; d++) {
        const curl = [0, 0.3, 1, 1.8][d] * nut;
        put(buf, Math.round(x + sn * d + cs * curl), Math.round(y - cs * d + sn * curl), col, 1, d ? 0.85 - d * 0.15 : 1);
      }
    }
  }

  // Berries: green under the leaves in late summer, blue-black on red stalks once the leaves are down, eaten by spring.
  for (const b of P.berries) {
    if (p < 0.42 && !(Y * YEAR > b.t && p < 0.05 + 0.12 * b.r)) continue;
    const ripe = p < 0.42 ? 1 : clamp((p - 0.42) / 0.25, 0, 1);
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    if (ripe > 0.5) put(buf, x, y - 1, hsv(col, 0.98, 0.7, 0.5), 1, 1);
    hsv(col, hueTo(hb - 0.03, 0.68, ripe), 0.6 - 0.1 * ripe, 0.5 - 0.06 * ripe);
    for (let k = 0; k < 8; k += 2) put(buf, x + FALLS[0][k], y - FALLS[0][k + 1], col, shade(FALLS[0][k], 0), 1);
  }

  // Leaves, unfurling from a bud through two sizes to full.
  const dir = P.windDir;
  for (const l of P.leaves) {
    if (l.gone === Y || p >= l.drop) continue;
    const tO = openAt(P, l, Y);
    const u = (ts - tO) / 6;
    if (u <= 0) continue;
    const spr = LEAF[u < 0.2 ? 0 : u < 0.45 ? 1 : u < 0.75 ? Math.min(2, l.size) : l.size];
    const lc = leafColour(P, l, clamp((ts - tO) / (YEAR * 0.1), 0, 1), p);
    const cx = Math.round(l.x) + (l.flip > 0.6 ? dir : 0);
    const cy = Math.round(l.y);
    for (let k = 0; k < spr.length; k += 2) put(buf, cx + spr[k], cy + spr[k + 1], lc, shade(spr[k], spr[k + 1]), 1);
  }

  // Leaves on their way down, tumbling.
  for (const f of P.falls) {
    const ph = f.ph / 6.283;
    const q = Math.floor((ph - Math.floor(ph)) * 4);
    const face = (q === 2 ? 0.8 : 1) * (0.85 + 0.3 * Math.abs(Math.cos(f.ph * 0.5)));
    const x = Math.round(f.x);
    const y = Math.round(f.y);
    const sp = FALLS[q];
    for (let k = 0; k < sp.length; k += 2) put(buf, x + sp[k], y + sp[k + 1], f.c, shade(sp[k], sp[k + 1]) * face, 1);
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, Math.min(255, buf[o]), Math.min(255, buf[o + 1]), Math.min(255, buf[o + 2]));
    }
}
