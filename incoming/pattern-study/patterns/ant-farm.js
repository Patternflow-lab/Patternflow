// ===== Patternflow pattern =====
// Title:   Ant Farm
// Family:  insect
// Idea:    Harvester ants in a tall ant farm dig tunnels to the floor, carry the sand up or pack it into old dead ends, and tend the queen's eggs while the damp of each watering sinks through.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 17, after the sand-and-glass ant farms sold as toys since the 1950s
// Round:   17
// ===============================
// @matrix 64x128
// @knobs Fill=0..1, Speed=0.2..3, Ants=40..120, Lamp=0..1
//
// Knob 1: Fill. Pale sand at 0, red clay in the middle, and at 1 the blue gel of a gel farm, lit from its base.
// Knob 2: Speed. The time-lapse: at 2 an ant walks ten LEDs a second and a digger cuts five LEDs of tunnel a second.
// Knob 3: Ants. Workers from 40 to 120; a bigger colony digs more faces at once and keeps a bigger nest.
// Knob 4: Lamp. From daylight to the red lamp keepers watch by, because ants do not see red.
// Buttons: K1 tap waters the farm through the lid, as the keeper does every 35 seconds at Speed 2.

const W = 64;
const H = 128;
const N = W * H;
// Inside the green frame: lid rows 0 and 1, base rows 126 and 127, sides columns 0 and 63.
const TOP = 2;
const BASE = 125;
// The sand line as the farm was filled, and the highest a heap may climb.
const SURF = 30;
const PEAK = 20;
const MAXN = 2400;
const MAXA = 120;
// Cells: the room over the sand, sand, hole, heap, frame, and sand packed back into a tunnel.
const [AIR, SAND, HOLE, HEAP, FRAME, PACK] = [0, 1, 2, 3, 4, 5];
// An ant walks the tunnels, walks on the surface, or works in one place.
const [WALK, ON_TOP, WORK] = [0, 1, 2];
const [DIG, DUMP, PACKIT, NURSE, FORAGE, IDLE] = [0, 1, 2, 3, 4, 5];
// Forty ants keep a fifth of the sand hollow, and every forty more another 0.08: below that
// they open new tunnels, near it they pack what they cut into old dead ends.
const HOLLOW = 0.12;
// LEDs a second per unit of Speed, walking and cutting.
const PACE = 5;
const CUT = 2.5;
// Seconds the colony works before the first frame.
const PRE = 6;
// Watering every WATER seconds of colony time; the damp sinks SINK rows a second and spreads.
const WATER = 70;
const SINK = 4;
const SPREAD = 2;
// Sand, red clay and blue gel: colour, grain, then the tones of a hole, a hole's rim, a heap
// and packed sand, and how much the gel's base lights it.
const FILLS = [
  [206, 170, 112, 1, 0.24, 0.8, 1.1, 0.92, 0],
  [186, 66, 38, 0.7, 0.22, 0.76, 1.18, 0.88, 0],
  [30, 112, 232, 0, 0.18, 1.4, 1.45, 1.2, 1],
];
const FRAME_C = [30, 92, 46];
// An ant from gaster to head; eggs, larvae, pupae; the apple.
const ANT = [[108, 36, 20], [138, 50, 24], [158, 62, 28]];
const BROOD = [[238, 234, 218], [226, 212, 172], [204, 182, 130]];
const SKIN = [200, 36, 30];
const FLESH = [238, 226, 168];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const q4 = (v) => clamp(Math.round(v / 4) * 4, 0, 255);

// ---- Tunnels: a tree of nodes a LED apart, each the centre of a disc of hole. Node 0 is the
// surface, its children the entrances. ----

function addNode(P, up, x, y, r) {
  const n = P.free.length ? P.free.pop() : P.nn < MAXN ? P.nn++ : -1;
  if (n < 0) return -1;
  P.nx[n] = x;
  P.ny[n] = y;
  P.par[n] = up;
  P.dep[n] = up < 0 ? 0 : P.dep[up] + 1;
  P.kids[n] = P.perm[n] = 0;
  P.alive[n] = 1;
  P.rad[n] = r;
  P.born[n] = P.t;
  if (up >= 0) P.kids[up]++;
  P.cut = carve(P, n, 1);
  return n;
}

// Opens (s = 1) or packs (s = -1) a node's disc; returns the cells that changed.
function carve(P, n, s) {
  const r = P.rad[n];
  const cx = P.nx[n];
  const cy = P.ny[n];
  let changed = 0;
  for (let y = Math.ceil(cy - r); y <= cy + r; y++)
    for (let x = Math.ceil(cx - r); x <= cx + r; x++) {
      if (x < 1 || x > 62 || y < TOP || y > BASE || (x - cx) ** 2 + (y - cy) ** 2 > r * r + 0.01) continue;
      const p = y * W + x;
      const t = P.type[p];
      if (s > 0) {
        P.own[p]++;
        if (t !== AIR && t !== HOLE) (P.type[p] = HOLE), changed++;
      } else if (--P.own[p] === 0 && t === HOLE) (P.type[p] = PACK), changed++;
    }
  P.holes += s * changed;
  return changed;
}

function route(P, a, b) {
  const { par, dep } = P;
  const up = [];
  const down = [];
  while (dep[a] > dep[b]) up.push(a), (a = par[a]);
  while (dep[b] > dep[a]) down.push(b), (b = par[b]);
  while (a !== b) up.push(a), (a = par[a]), down.push(b), (b = par[b]);
  up.push(a);
  return up.concat(down.reverse());
}

// Sand a face can cut: inside the frame, off the floor, five rows down unless a shaft.
function solid(P, x, y, shaft) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 3 || ix > 60 || iy > BASE - 2 || iy < P.ground[ix] + (shaft ? 0 : 5)) return false;
  const t = P.type[iy * W + ix];
  return t === SAND || t === PACK;
}

// One LED of tunnel at a face. It wanders, leans back to the way it was started and turns
// from a hole or the frame four LEDs ahead; boxed in, it stops.
function grow(P, t) {
  const n = t.n;
  const x = P.nx[n];
  const y = P.ny[n];
  let a = t.a + (Math.random() - 0.5) * 0.5;
  a += (t.pref - a) * 0.12;
  const ok = (g, d) => solid(P, x + Math.cos(g) * d, y + Math.sin(g) * d, t.goal > 0);
  if (!ok(a, 4) || !ok(a, 3)) {
    const l = ok(a - 0.7, 4);
    const r = ok(a + 0.7, 4);
    if (l && (!r || Math.random() < 0.5)) a -= 0.7;
    else if (r) a += 0.7;
    else if (!ok(a, 2.2)) return finish(P, t);
  }
  t.a = a;
  const m = addNode(P, n, x + Math.cos(a), y + Math.sin(a), t.r);
  if (m < 0) return finish(P, t);
  if (t.goal > 0) P.perm[m] = 1;
  t.n = m;
  if (--t.left <= 0 || (t.goal > 0 && P.ny[m] >= t.goal)) finish(P, t);
  return P.cut;
}

function finish(P, t) {
  if (t.role && makeChamber(P, t)) return 0;
  t.dead = true;
  P.tips.splice(P.tips.indexOf(t), 1);
  return 0;
}

// A chamber: a flat-floored oval the tunnel opens into, dug out from its door.
function makeChamber(P, t) {
  const n = t.n;
  for (let rx = t.role === "queen" ? 9 : 7; rx >= 4; rx--) {
    const ry = rx > 6 ? 3.4 : 2.8;
    const cx = P.nx[n] + Math.cos(t.a) * (rx - 1.5);
    const cy = P.ny[n] + Math.sin(t.a) * (ry - 1);
    if (cx - rx < 3 || cx + rx > 60 || cy + ry > BASE - 1 || cy - ry < P.ground[Math.round(cx)] + 5) continue;
    t.room = { n, cx, cy, rx, ry, p: 0, role: t.role, id: P.rooms.length + 1 };
    P.rooms.push(t.room);
    P.perm[n] = P.door[n] = 1;
    t.role = "";
    return true;
  }
  return false;
}

function dig(P, c, p) {
  c.p = Math.min(1, p);
  let changed = 0;
  for (let y = Math.ceil(c.cy - c.ry); y <= c.cy + c.ry * 0.6; y++)
    for (let x = Math.ceil(c.cx - c.rx); x <= c.cx + c.rx; x++) {
      const q = y * W + x;
      if (P.room[q] || ((x - c.cx) / c.rx) ** 2 + ((y - c.cy) / c.ry) ** 2 > c.p) continue;
      P.room[q] = c.id;
      P.own[q]++;
      if (P.type[q] !== HOLE) (P.type[q] = HOLE), changed++;
    }
  P.holes += changed;
  return changed;
}

function cutStep(P, t) {
  const c = t.room;
  if (!c) return grow(P, t);
  const cells = dig(P, c, c.p + 3 / (Math.PI * c.rx * c.ry));
  if (c.p >= 1) finish(P, t);
  return cells;
}

// A side tunnel from a node, sideways and down, not where the sand ahead is a quarter hollow.
function sprout(P, deep) {
  for (let k = 0; k < 16; k++) {
    const n = 3 + Math.floor(Math.random() * (P.nn - 3));
    if (!P.alive[n] || P.door[n] || P.kids[n] > 1 || P.ny[n] < Math.max(SURF + 6, deep) || P.ny[n] > BASE - 6) continue;
    const right = P.nx[n] < 18 ? true : P.nx[n] > 46 ? false : Math.random() < 0.5;
    const a = right ? 0.05 + 0.85 * Math.random() : Math.PI - 0.05 - 0.85 * Math.random();
    const ax = P.nx[n] + Math.cos(a) * 6;
    const ay = P.ny[n] + Math.sin(a) * 6;
    if (!solid(P, P.nx[n] + Math.cos(a) * 3.5, P.ny[n] + Math.sin(a) * 3.5, false)) continue;
    let near = 0;
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) near += P.type[clamp(Math.round(ay) + y, 0, H - 1) * W + clamp(Math.round(ax) + x, 0, W - 1)] === HOLE;
    if (near > 30) continue;
    const role = P.rooms.length < 7 && Math.random() < 0.18 ? "store" : "";
    const t = { n, a, pref: a, left: 10 + Math.floor(Math.random() * 30), r: 1.25, goal: 0, role, room: null, busy: -1, dead: false };
    P.tips.push(t);
    return t;
  }
  return null;
}

function floorCells(P, c) {
  const out = [];
  for (let y = Math.ceil(c.cy - c.ry); y <= c.cy + c.ry; y++)
    for (let x = Math.ceil(c.cx - c.rx); x <= c.cx + c.rx; x++) if (P.room[y * W + x] === c.id && P.type[(y + 1) * W + x] !== HOLE) out.push(x, y);
  return out;
}

function lay(P, c, kind, count) {
  const fl = floorCells(P, c);
  const m = fl.length / 2;
  const s = Math.floor(Math.random() * m);
  for (let i = 0; i < count; i++) {
    const j = ((s + i + Math.floor(Math.random() * 3)) % m) * 2;
    P.brood.push(fl[j], fl[j + 1] - (i % 3 === 2 ? 1 : 0), kind);
  }
}

export function setup(params) {
  const P = params;
  for (const k of ["nx", "ny", "rad", "born"]) P[k] = new Float32Array(MAXN);
  for (const k of ["par", "dep"]) P[k] = new Int32Array(MAXN);
  for (const k of ["kids", "alive", "perm", "door"]) P[k] = new Uint8Array(MAXN);
  for (const k of ["type", "own", "room"]) P[k] = new Uint8Array(N);
  for (const k of ["tex", "wet", "wet2"]) P[k] = new Float32Array(N);
  P.ground = new Int16Array(W);
  P.buf = new Float32Array(N * 3);
  Object.assign(P, { nn: 0, free: [], holes: 0, tips: [], rooms: [], brood: [], sproutT: 0, started: false, count: 40, t: 0, drip: 0, dx: 32, water: 4 });
  const ph = Math.random() * 6;
  let soil = 0;
  for (let x = 0; x < W; x++) P.ground[x] = Math.round(SURF + 1.2 * Math.sin(x * 0.13 + ph) + 0.8 * Math.sin(x * 0.41 + 2 * ph));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      P.type[p] = y < TOP || y > BASE || x < 1 || x > 62 ? FRAME : y < P.ground[x] ? AIR : SAND;
      if (P.type[p] === SAND) soil++;
      // Dark mineral grains and a few pale ones.
      const h = Math.random();
      P.tex[p] = h < 0.1 ? -0.2 : h < 0.22 ? -0.08 : h > 0.94 ? 0.12 : 0;
    }
  P.soil = soil;
  P.target = 0.2 * soil;
  addNode(P, -1, -1, -1, 0);
  // Two shafts: the left one to the queen near the floor, the right one to the larder.
  for (const [ex, goal, role] of [
    [13 + Math.floor(Math.random() * 6), BASE - 16, "queen"],
    [42 + Math.floor(Math.random() * 6), 68 + Math.random() * 8, "larder"],
  ]) {
    const e = addNode(P, 0, ex, P.ground[ex], 1.5);
    P.perm[e] = 1;
    P.tips.push({ n: e, a: Math.PI / 2, pref: Math.PI / 2 + (ex < 32 ? -0.12 : 0.12), left: 200, r: 1.5, goal, role, room: null, busy: -1, dead: false });
  }
  // What the colony has dug already: shafts, chambers, a nursery and side tunnels; the seven
  // still growing are the faces the panel opens on.
  for (let i = 0; i < 400 && P.tips.length; i++) for (const t of P.tips.slice()) cutStep(P, t);
  for (let k = 0, t; k < 40 && P.rooms.length < 3; k++)
    if ((t = sprout(P, 76))) for (Object.assign(t, { role: "nursery", left: 12 }); !t.dead; ) cutStep(P, t);
  for (let i = 0; i < 3000 && P.holes < P.target * 0.9; i++) {
    if (P.tips.length < 7 && i % 9 === 0) sprout(P, 0);
    for (const t of P.tips.slice()) cutStep(P, t);
  }
  while (P.tips.length < 7 && sprout(P, 0));
  const role = (r, d) => P.rooms.find((c) => c.role === r) || d;
  P.queen = role("queen", P.rooms[0]);
  P.larder = role("larder", P.rooms[P.rooms.length - 1]);
  P.nursery = role("nursery", P.queen);
  for (const [c, kind, n] of [[P.queen, 0, 10], [P.queen, 1, 4], [P.nursery, 1, 6], [P.nursery, 2, 7]]) lay(P, c, kind, n);
  const qf = floorCells(P, P.queen);
  P.qy = qf.length ? qf[1] : P.queen.cy;
  P.fx = 28 + Math.floor(Math.random() * 3);
  P.ants = [];
  for (let i = 0; i < MAXA; i++) {
    const at = 3 + Math.floor(Math.random() * (P.nn - 3));
    P.ants.push({ i, x: P.nx[at], y: P.ny[at], hx: 1, hy: 0, mode: WORK, path: [at], pi: 0, f: 0, at, task: IDLE, carry: 0, load: 0, t: Math.random() * 2 });
  }
  // A digger at each face and six nurses with the queen.
  P.tips.forEach((t, j) => Object.assign(P.ants[(t.busy = j)], { at: t.n, task: DIG, arg: t, t: 1 + 4 * Math.random() }));
  for (let j = 10; j < 16; j++) Object.assign(P.ants[j], { at: P.queen.n, task: NURSE, arg: P.queen, x: P.queen.cx, y: P.queen.cy });
}

// ---- The ants ----

function goTo(P, a, from, to, task, arg) {
  Object.assign(a, { task, arg, path: route(P, from, to), pi: 0, f: 0, at: from, mode: WALK });
  if (from === 0) toTop(P, a, to === 0 ? -1 : 1);
}

// Out on the sand, to the next entrance on the path or to the job up here.
function toTop(P, a, next) {
  if (a.at > 0) a.x = P.nx[a.at];
  a.mode = ON_TOP;
  a.sn = next;
  a.sg = next >= 0 ? P.nx[a.path[next]] : a.arg;
  a.at = 0;
}

function fillable(P, k) {
  return k > 2 && P.alive[k] && !P.kids[k] && !P.perm[k] && !P.tips.some((t) => t.n === k);
}

// The nearest dead end four seconds old or more.
function nearLeaf(P, a) {
  let best = -1;
  let bd = 1e9;
  for (let k = 3; k < P.nn; k++) {
    if (P.born[k] > P.t - 4 || !fillable(P, k)) continue;
    const d = route(P, a.at, k).length;
    if (d < bd) (bd = d), (best = k);
  }
  return best;
}

// Whether another ant is cutting this face or on its way to.
const taken = (P, t, i) => t.busy >= 0 && t.busy !== i && t.busy < P.count && P.ants[t.busy].arg === t && P.ants[t.busy].task === DIG;

const idle = (a, s) => Object.assign(a, { mode: WORK, task: IDLE, t: s });

function plan(P, a) {
  const from = a.at;
  if (a.carry === 1) {
    // A load of sand: into a dead end near by, or up to a heap by the entrance.
    const leaf = P.holes > P.target - 40 ? nearLeaf(P, a) : -1;
    if (leaf > 0) return goTo(P, a, from, leaf, PACKIT, leaf);
    let e = from > 0 ? from : a.x < 32 ? 1 : 2;
    while (P.dep[e] > 1) e = P.par[e];
    return goTo(P, a, from, 0, DUMP, clamp(Math.round(P.nx[e] + (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 7)), 3, 60));
  }
  if (a.carry === 2) return goTo(P, a, from, P.larder.n, NURSE, P.larder);
  const r = Math.random();
  if (r < 0.6) {
    // The nearest face nobody is cutting.
    let open = null;
    let bo = 1e9;
    for (const t of P.tips) {
      const d = route(P, from, t.n).length;
      if (!taken(P, t, a.i) && d < bo) (bo = d), (open = t);
    }
    if (open) return (open.busy = a.i), goTo(P, a, from, open.n, DIG, open);
  }
  // Otherwise up to the apple, or down to the brood or another chamber.
  const q = Math.random();
  if (q < 0.25) return goTo(P, a, from, 0, FORAGE, P.fx + (Math.random() < 0.5 ? -1 : 6));
  const c = q < 0.5 ? P.queen : q < 0.7 ? P.nursery : P.rooms[Math.floor(Math.random() * P.rooms.length)];
  goTo(P, a, from, c.n, NURSE, c);
}

function arrive(P, a) {
  const t = a.arg;
  if (a.task === DIG) {
    if (t.dead || taken(P, t, a.i)) return plan(P, a);
    if (t.n !== a.at) return goTo(P, a, a.at, t.n, DIG, t);
    Object.assign(a, { mode: WORK, t: 2 + 4 * Math.random(), acc: 0, load: 0 });
  } else if (a.task === DUMP) {
    heap(P, a.arg, 1 + Math.min(3, Math.floor(a.load / 12)));
    a.carry = a.load = 0;
    idle(a, 0.3);
  } else if (a.task === PACKIT) Object.assign(a, { mode: WORK, acc: 0 });
  else if (a.task === NURSE) {
    Object.assign(a, { carry: 0, mode: WORK, t: 2 + 5 * Math.random(), x: P.nx[a.at], y: P.ny[a.at] });
    pick(P, a);
  } else if (a.task === FORAGE) {
    a.carry = 2;
    plan(P, a);
  } else idle(a, 0.3 + Math.random());
}

function pick(P, a) {
  const c = a.arg;
  a.wx = P.nx[c.n];
  a.wy = P.ny[c.n];
  for (let k = 0; k < 8; k++) {
    const x = Math.round(c.cx + (Math.random() * 2 - 1) * c.rx);
    const y = Math.round(c.cy + (Math.random() * 2 - 1) * c.ry);
    if (P.room[y * W + x] === c.id) return (a.wx = x), (a.wy = y);
  }
}

// Packs the node the ant stands in and steps back one; false once the load is spent.
function packOne(P, a) {
  const k = a.at;
  if (a.load <= 0 || !fillable(P, k) || P.ants.some((b) => b !== a && (b.at === k || (b.mode === WALK && b.path[b.pi + 1] === k)))) return false;
  a.load -= Math.max(1, carve(P, k, -1));
  P.alive[k] = 0;
  a.at = P.par[k];
  P.kids[a.at]--;
  for (const b of P.ants) {
    if (b === a || (b.mode !== WALK && b.mode !== ON_TOP) || !b.path.slice(b.pi).some((n) => !P.alive[n])) continue;
    if (b.mode === ON_TOP) b.at = 0;
    plan(P, b);
  }
  P.free.push(k);
  return true;
}

// Dropped sand rolls to the lower side while it is two grains higher, never into an entrance.
function heap(P, x, n) {
  for (let k = 0; k < n; k++) {
    let gx = x;
    for (let s = 0; s < 12; s++) {
      const c = gx + (P.ground[gx - 1] > P.ground[gx + 1] ? -1 : 1);
      if (c < 2 || c > 61 || P.ground[c] <= P.ground[gx] + 1 || Math.abs(c - P.nx[1]) < 3 || Math.abs(c - P.nx[2]) < 3) break;
      gx = c;
    }
    const y = P.ground[gx] - 1;
    if (y >= PEAK) (P.type[y * W + gx] = HEAP), (P.ground[gx] = y);
  }
}

// The damp sinks, spreads, passes through the tunnels, stops at the floor and dries.
function soak(P, ds) {
  const { wet, type } = P;
  const out = P.wet2;
  const g = SINK * ds;
  const d = SPREAD * ds;
  const dry = 1 - ds / 40;
  const damp = (q) => type[q] !== AIR && type[q] !== FRAME;
  for (let p = TOP * W; p < (BASE + 1) * W; p++) {
    if (!damp(p)) {
      out[p] = 0;
      continue;
    }
    const w = wet[p];
    const u = damp(p - W);
    const f = damp(p + W);
    const up = u ? wet[p - W] : w;
    const dn = f ? wet[p + W] : w;
    const l = damp(p - 1) ? wet[p - 1] : w;
    const r = damp(p + 1) ? wet[p + 1] : w;
    out[p] = (w + g * ((u ? up : 0) - (f ? w : 0)) + d * (l + r - 2 * w + 0.3 * (up + dn - 2 * w))) * dry;
  }
  P.wet2 = wet;
  P.wet = out;
}

function step(P, dt, s) {
  const v = PACE * s * dt;
  const ds = dt * s;
  P.t += ds;
  P.target = P.soil * (HOLLOW + P.count / 500);
  if (P.holes < P.target && P.tips.length < 3 + P.count / 10 && (P.sproutT -= ds) <= 0) {
    sprout(P, 0);
    P.sproutT = 0.5;
  }
  if (P.t >= P.water) {
    P.water = P.t + WATER;
    P.drip = 3;
    P.dx = 6 + Math.floor(Math.random() * 52);
  }
  if (P.drip > 0) {
    P.drip -= ds;
    for (let x = P.dx - 1; x <= P.dx + 1; x++) P.wet[P.ground[x] * W + x] += 120 * ds;
  }
  soak(P, ds);
  for (let i = 0; i < P.count; i++) {
    const a = P.ants[i];
    const t = a.arg;
    if (a.mode === WALK) {
      // Node by node; at node 0 the path climbs out onto the sand.
      for (a.f += v; ; a.f--, (a.at = a.path[++a.pi])) {
        if (a.pi >= a.path.length - 1) arrive(P, a);
        else if (a.path[a.pi + 1] === 0) toTop(P, a, a.pi + 2 < a.path.length ? a.pi + 2 : -1);
        else if (a.f >= 1) continue;
        break;
      }
    } else if (a.mode === ON_TOP) {
      const d = a.sg - a.x;
      if (Math.abs(d) > v) (a.x += Math.sign(d) * v), (a.hx = Math.sign(d)), (a.hy = 0);
      else if (a.sn < 0) arrive(P, a);
      else Object.assign(a, { x: a.sg, pi: a.sn, f: 0, at: a.path[a.sn], mode: WALK });
    } else if (a.mode === WORK) {
      a.t -= ds;
      if (a.task === DIG) {
        for (a.acc += CUT * ds; a.acc >= 1 && !t.dead; a.acc--) a.load += cutStep(P, t);
        a.at = t.n;
        if (a.t <= 0 || t.dead) {
          t.busy = -1;
          a.carry = a.load > 0 ? 1 : 0;
          plan(P, a);
        }
      } else if (a.task === PACKIT) {
        for (a.acc += 2 * CUT * ds; a.acc >= 1; a.acc--)
          if (!packOne(P, a)) {
            a.carry = a.load = 0;
            plan(P, a);
            break;
          }
      } else if (a.task === NURSE) {
        const dx = a.wx - a.x;
        const dy = a.wy - a.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.6) {
          if (a.t > 0) pick(P, a);
          else if (Math.abs(a.wx - P.nx[a.at]) + Math.abs(a.wy - P.ny[a.at]) < 0.1) plan(P, a);
          else (a.wx = P.nx[a.at]), (a.wy = P.ny[a.at]);
        } else {
          const g = Math.min(d, v * 0.6) / d;
          a.x += dx * g;
          a.y += dy * g;
          a.hx = dx / d;
          a.hy = dy / d;
        }
      } else if (a.t <= 0) plan(P, a);
    }
  }
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 40, 0.06];
  dt = Math.min(dt, 0.1);
  const s = clamp(k[1], 0.05, 3);
  P.count = clamp(Math.round(k[2]), 0, MAXA);
  P.fill = clamp(k[0], 0, 1);
  P.lamp = clamp(k[3], 0, 1);
  if (input.btnPressed && input.btnPressed[0]) P.water = P.t;
  if (!P.started) {
    P.started = true;
    for (let i = 0; i < PRE * 30; i++) step(P, 1 / 30, s);
  }
  step(P, dt, s);
}

// ---- Drawing ----

function put(buf, x, y, c, m) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 1 || x > 62 || y < TOP || y > BASE) return;
  for (let j = 0; j < 3; j++) buf[(y * W + x) * 3 + j] = c[j] * m;
}

// Where an ant is and which way it faces.
function where(P, a) {
  if (a.mode === WALK && a.pi < a.path.length - 1) {
    const na = a.path[a.pi];
    const nb = a.path[a.pi + 1];
    a.hx = P.nx[nb] - P.nx[na];
    a.hy = P.ny[nb] - P.ny[na];
    a.x = P.nx[na] + a.hx * a.f;
    a.y = P.ny[na] + a.hy * a.f;
  } else if (a.at === 0) a.y = P.ground[clamp(Math.round(a.x), 1, 62)] - 1;
  else if (a.mode === WORK && a.task !== NURSE) {
    a.x = P.nx[a.at];
    a.y = P.ny[a.at];
    if (a.task === DIG) (a.hx = Math.cos(a.arg.a)), (a.hy = Math.sin(a.arg.a));
  }
}

export function draw(display, params, time) {
  const P = params;
  // Sand to clay as Fill passes 0.25, clay to gel as it passes 0.75.
  const ramp = (a) => clamp((P.fill * 2 - a) / 0.3, 0, 1);
  const wg = ramp(1.35);
  const wc = ramp(0.35) - wg;
  const [r0, g0, b0, grain, hole, rim, loose, pack, glow] = FILLS[0].map((v, j) => v * (1 - wc - wg) + FILLS[1][j] * wc + FILLS[2][j] * wg);
  const fc = [r0, g0, b0];
  const lamp = P.lamp;
  const room = 1 - 0.8 * lamp;
  const { buf, type } = P;
  for (let y = 0; y < H; y++) {
    const dep = clamp((y - SURF) / (BASE - SURF), 0, 1);
    const shade = (1 - glow) * (1.04 - 0.1 * dep) + glow * (0.62 + 0.5 * dep * dep);
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const t = type[p];
      let c = fc;
      let m;
      if (t === FRAME) (c = FRAME_C), (m = y < TOP || y > BASE ? 1 : 0.8);
      else if (t === AIR) {
        const u = (y - TOP) / (SURF - TOP);
        c = [46 - 12 * u, 52 - 12 * u, 64 - 14 * u];
        m = room;
      } else {
        m = (1 + grain * P.tex[p]) * shade * (1 - 0.5 * (1 - glow) * Math.min(1, 2 * P.wet[p]));
        if (t === HOLE) {
          // The far side of the tunnel: dark under the roof, lighter on the floor.
          m *= hole;
          if (type[p - W] !== HOLE && type[p - W] !== AIR) m *= 0.7;
          if (type[p + W] !== HOLE) m *= 1.4;
        } else {
          if (t === HEAP) m *= loose;
          else if (t === PACK) m *= pack;
          if (type[p - 1] === HOLE || type[p + 1] === HOLE || type[p - W] === HOLE || type[p + W] === HOLE) m *= rim;
        }
      }
      for (let j = 0; j < 3; j++) buf[p * 3 + j] = c[j] * m;
    }
  }
  // Grass in the top corners.
  for (let k = 0; k < 10; k++) {
    const x0 = k < 5 ? 3 + k : 51 + k;
    const h = 5 + ((k * 7) % 5) + (k % 3) * 2;
    for (let j = 0; j < h; j++) {
      const u = j / h;
      put(buf, x0 + ((k % 5) - 2) * 0.18 * j + Math.sin(time * 1.3 + k) * u * u * 1.2, P.ground[x0] - 1 - j, [52 + 70 * u, 140 + 56 * u, 44 + 26 * u], room);
    }
  }
  // The apple, skin up, and the drops while it is watered.
  let gy = BASE;
  for (let dx = 0; dx < 6; dx++) gy = Math.min(gy, P.ground[P.fx + dx]);
  for (let dy = 0; dy < 4; dy++) for (let dx = dy > 2 ? 1 : 0; dx < (dy > 2 ? 5 : 6); dx++) put(buf, P.fx + dx, gy - 1 - dy, dy > 2 ? SKIN : FLESH, 1);
  if (P.drip > 0) put(buf, P.dx, TOP + ((P.t * 2.5) % 1) * (P.ground[P.dx] - TOP), [150, 190, 235], room);
  for (let j = 0; j < P.brood.length; j += 3) put(buf, P.brood[j], P.brood[j + 1], BROOD[P.brood[j + 2]], 1);
  // The queen, twice a worker's length.
  const qx = P.queen.cx + Math.sin(P.t * 0.15) * (P.queen.rx - 3);
  const qd = Math.cos(P.t * 0.15) < 0 ? -1 : 1;
  for (let j = -2; j < 3; j++) {
    put(buf, qx + j * qd, P.qy - 1, ANT[j < 1 ? 0 : j], 1);
    if (j < 1) put(buf, qx + j * qd, P.qy, ANT[0], 0.85);
  }
  for (let i = 0; i < P.count; i++) {
    const a = P.ants[i];
    where(P, a);
    for (let j = 0; j < 3; j++) put(buf, a.x + (j - 1) * a.hx, a.y + (j - 1) * a.hy, ANT[j], 1);
    if (a.carry) put(buf, a.x + 2 * a.hx, a.y + 2 * a.hy, a.carry === 1 ? fc : FLESH, a.carry === 1 ? 1.25 * loose : 1);
  }
  // By the red lamp each colour is seen as the light it sends back, in red.
  for (let p = 0; p < N; p++) {
    let r = buf[p * 3];
    let g = buf[p * 3 + 1];
    let b = buf[p * 3 + 2];
    if (lamp > 0) {
      const lum = 0.42 * r + 0.43 * g + 0.15 * b;
      r += lamp * (lum - r);
      g += lamp * (lum * 0.08 - g);
      b += lamp * (lum * 0.05 - b);
    }
    display.setPixel(p % W, (p / W) | 0, q4(r), q4(g), q4(b));
  }
}
