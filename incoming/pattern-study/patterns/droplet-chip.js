// ===== Patternflow pattern =====
// Title:   Droplet Chip
// Family:  electrowetting
// Idea:    Seen from above, a digital microfluidics chip of square copper electrode pads has its controller write assays without end: it pinches a unit droplet off a reagent tank, walks it pad by pad around dead electrodes and other droplets, merges two reagents so their colours fold into each other as the drop shuttles over three pads, splits it in two by lighting both end pads until the neck snaps, and parks each half over a detector pad where it flashes a fluorescent colour once before it drains into a waste pad.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: digital microfluidics by electrowetting on dielectric, droplets carried, merged, mixed and split over an array of electrodes (Pollack, Fair and Shenderov 2000; Cho, Moon and Kim 2003, from memory); dispensing a unit droplet with a three-electrode finger cut at the middle one (Cho, Moon and Kim 2003, from memory); fluidic constraints that keep droplets a pad apart (from memory); original code, pattern round 265
// Round:   265
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Clock=0.5..3, Droplets=-1..1, Voltage=-1..1
//
// Knob 1: Hue. Turns the five reagent colours round the wheel together. At 0 the tanks hold teal, magenta, amber, lime and indigo, and a droplet of two of them is the colour between, found the short way round the wheel so that opposite pairs stay clear. The dyes also drift by up to 0.13 of the wheel round the knob, on periods of 97 s and 61 s. The copper pads and the dark teal chip do not turn, and no setting is red-biased.
// Knob 2: Clock. 0.5 to 3, opening at 2. The controller's clock. A droplet takes about 0.85 s to move one pad at 2 (0.2 s spreading over the next pad, 0.3 s gathering onto it, then a pause), 1.9 s at 0.5 and 0.65 s at 3. Every droplet has its own tempo, 0.8 to 1.3 times the clock, and some hesitate, so none step together.
// Knob 3: Droplets. -1 to 1, opening at 0. How many droplets the controller keeps on the chip: 4 at -1, 5 at the opening, 8 at 1. It starts an assay whenever there are fewer and never takes one away, so a lowered knob empties the chip as the droplets drain, over about half a minute.
// Knob 4: Voltage. -1 to 1, opening at 0.06. The drive on the electrodes. At -1 a lit pad is a third as bright as at 1, droplets on it shrink by an eighth, steps take 1.7 times as long and stall more often; at 1 the lit pads blaze, droplets swell by a fifth over them and move fast.
//
// The chip is 7 by 14 pads, 8 LED square with 1 LED gaps, in dim copper: three wide reagent tanks on the top edge and one on each side, three waste pads along the bottom, three steel-grey detector pads above them, four dead pads that stand in the way. A lit pad is gold, lit ahead of the droplet that is coming, and a pad that has been lit often stays warmer for a minute. A waste pad keeps a level of what it has drunk, in the colour of it, and gives it up over about 100 s.
// A droplet is a few lobes of liquid, one for each pad it touches, sized by mass and joined by a smooth union and a bridge across each gap. A step lights the next pad and lets mass flow across, so the droplet stretches over both pads and gathers onto the new one. A merged droplet is a rod over three pads, a splitting one a dumbbell whose neck thins away. The controller pinches droplets off the tanks, routes them round dead pads keeping one empty pad between droplets, merges and mixes pairs over a line of three pads, splits some, and sends each to a detector and then to a waste pad. The first update runs 60 s of this, so the chip opens in the middle of its work.

const W = 64, H = 128;
const COLS = 7, ROWS = 14, PITCH = 9, X0 = 1, Y0 = 1, NP = COLS * ROWS, TAU = 6.2831853;
const { floor, ceil, min, max, abs, sqrt, exp, sin, cos, tanh } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const mix = (a, b, t) => a + (b - a) * t;
const smin = (a, b, k) => {
  const h = max(k - abs(a - b), 0) / k;
  return min(a, b) - h * h * k * 0.25;
};
const hn = (a, b) => {
  const v = sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - floor(v);
};
function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- the chip: _ nothing, . pad, # dead pad, T tank, W waste, D detector
const MAP = [
  "_T_T_T_",
  ".......",
  ".......",
  "_...#..",
  "T......",
  "_......",
  "...#...",
  "......_",
  "......T",
  "......_",
  ".D.D.D.",
  "..#.#..",
  ".......",
  "_W_W_W_",
];
const KIND = new Uint8Array(NP);
const TANKS = [];
const RING = new Uint8Array(NP); // pads next to a tank: no droplet waits there
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++) {
    const ch = MAP[r][c], p = r * COLS + c;
    KIND[p] = ch === "." ? 1 : ch === "#" ? 2 : ch === "T" ? 3 : ch === "W" ? 4 : ch === "D" ? 5 : 0;
    if (ch === "T") TANKS.push({ p, dr: r === 0 ? 1 : 0, dc: c === 0 ? 1 : c === COLS - 1 ? -1 : 0, k: TANKS.length });
  }
for (const T of TANKS) {
  // a wide top tank keeps the pads beside its lane clear too; a side one only the pad in front
  const r = (T.p / COLS) | 0, c = T.p % COLS;
  for (let i = max(0, r - 1); i <= min(ROWS - 1, r + 1); i++)
    for (let j = max(0, c - 1); j <= min(COLS - 1, c + 1); j++) if (T.dr === 1 || (i === r + T.dr && j === c + T.dc)) RING[i * COLS + j] = 1;
}
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const pcx = (p) => X0 + (p % COLS) * PITCH + 4;
const pcy = (p) => Y0 + ((p / COLS) | 0) * PITCH + 4;

// ---- colours
const RH = [0.5, 0.88, 0.11, 0.27, 0.67]; // teal, magenta, amber, lime, indigo
const RS = [0.86, 0.82, 0.84, 0.8, 0.62];
const SUBC = [0.016, 0.07, 0.078], DEAD = [0.07, 0.11, 0.12], TANKP = [0.1, 0.09, 0.07], WASTEP = [0.16, 0.1, 0.19];
const PADD = [0.17, 0.145, 0.075], PADL = [0.95, 0.8, 0.45], DETD = [0.17, 0.23, 0.27], DETL = [0.75, 0.9, 0.97];

// ---- state
function makeState() {
  const S = {
    t: 0, init: false, k: [0, 2, 0, 0.06], hue: 0, hk: 0, ph: [6.28 * rnd(), 6.28 * rnd()], v: 0.5, sc: 1, tA: 0.2, tB: 0.3, tau: 0.08, want: 6, id: 1, cool: 0,
    drops: [], tanks: [], meets: [],
    act: new Float32Array(NP), heat: new Float32Array(NP), pool: new Float32Array(NP), poolc: new Float32Array(NP * 3), tgt: new Uint8Array(NP),
    det: new Int16Array(NP).fill(-1), fb: new Uint8Array(NP),
    dist: new Float32Array(NP), prev: new Int16Array(NP), dn: new Uint8Array(NP), rg: -1,
    R: new Float32Array(W * H), G: new Float32Array(W * H), B: new Float32Array(W * H),
    sd: new Float32Array(W * H), dm: new Float32Array(W * H), lb: new Int16Array(W * H),
  };
  for (const T of TANKS) {
    const wide = T.dr === 1;
    S.tanks.push({
      tank: true, p: T.p, dr: T.dr, dc: T.dc, k: T.k, V: 1, ex: wide ? 6.4 : 4.3, ey: wide ? 4.2 : 4.9,
      lobes: [{ p: T.p, m: 1, tg: 1 }], on: [T.p], job: null, cool: 1 + 4 * rnd(), sl: 1,
      ka: T.k, kb: T.k, con: 0, prod: 0, fl: 0, flT: -1, wob: { t: 9, a: 0 }, lam: 34, th: 0, ax: 1, ay: 0, rat: 0.5,
    });
  }
  return S;
}

function mkDrop(S, p, k) {
  const tempo = 0.8 + 0.5 * rnd();
  return {
    id: S.id++, seed: floor(rnd() * 997), V: 1, lobes: [{ p, m: 0.4, tg: 1 }], pads: [p], on: [p], np: [p],
    ka: k, kb: k, con: 0, conT: 0, lam: 34, lamT: 34, th: 0, thT: 0, ax: 1, ay: 0, mixN: 0,
    plan: [], mode: "rest", timer: 0, sl: 1 / tempo, rr: 0.58 + 0.34 * rnd(), asp: 0.08 * (rnd() - 0.5) * 2, wob: { t: 9, a: 0 },
    fl: 0, flT: -1, prod: 0, rat: 0.5, stuck: 0, split: false, meet: null,
  };
}

// ---- masses
function setTg(D, pads, wt) {
  const s = wt.reduce((a, b) => a + b, 0);
  setAbs(D, pads.map((p, i) => [p, (D.V * wt[i]) / s]));
}
function setAbs(D, list) {
  for (const l of D.lobes) l.tg = 0;
  for (const [p, m] of list) {
    let l = D.lobes.find((q) => q.p === p);
    if (!l) D.lobes.push((l = { p, m: 0, tg: 0 }));
    l.tg = m;
  }
}
function relax(S, D, dt) {
  const k = dt / (S.tau * D.sl);
  for (let i = D.lobes.length - 1; i >= 0; i--) {
    const l = D.lobes[i];
    l.m += (l.tg - l.m) * (1 - exp(-k * (l.tg === 0 ? 1.5 : 1)));
    if (l.tg === 0 && l.m < 0.025) D.lobes.splice(i, 1);
  }
}
function beginMove(S, D, np) {
  const old = D.pads;
  const un = old.concat(np.filter((p) => !old.includes(p)));
  D.np = np;
  D.on = un;
  setTg(D, un, un.map((p) => (np.includes(p) ? 1 : 0.75)));
  D.mode = "spread";
  D.timer = S.tA * D.sl;
  D.stuck = 0;
}

// ---- fluidic constraints and routes
function mark3(f, p) {
  const r = (p / COLS) | 0, c = p % COLS;
  f[p] = 1;
  if (r > 0) f[p - COLS] = 1;
  if (r < ROWS - 1) f[p + COLS] = 1;
  if (c > 0) f[p - 1] = 1;
  if (c < COLS - 1) f[p + 1] = 1;
}
// pads droplet X may not use: those of another droplet, a lit lane or a held merge line, and the pads next to them
function forbid(S, X, ring, ex) {
  const f = S.fb;
  if (ring) f.set(RING);
  else f.fill(0);
  for (const E of S.drops) {
    if (E === X || (ex && ex.includes(E))) continue;
    for (const l of E.lobes) if (l.m > 0.12) mark3(f, l.p);
    for (const p of E.on) mark3(f, p);
  }
  for (const T of S.tanks) if (T.job) for (const p of T.on) mark3(f, p);
  for (const m of S.meets) if (!(X && X.meet === m) && !(ex && ex.some((e) => e.meet === m))) for (const p of m.pads) mark3(f, p);
  return f;
}
function route(S, X, src, goal, f) {
  const dist = S.dist, prev = S.prev, dn = S.dn;
  dist.fill(1e9);
  prev.fill(-1);
  dn.fill(0);
  dist[src] = 0;
  for (;;) {
    let u = -1, best = 1e8;
    for (let i = 0; i < NP; i++) if (!dn[i] && dist[i] < best) (best = dist[i]), (u = i);
    if (u < 0) return -1;
    if (u !== src && goal(u)) {
      let v = u;
      while (prev[v] !== src) v = prev[v];
      S.rg = u;
      return v;
    }
    dn[u] = 1;
    const ur = (u / COLS) | 0, uc = u % COLS, pu = prev[u];
    for (const d of DIRS) {
      const r = ur + d[0], c = uc + d[1];
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      const v = r * COLS + c;
      if (dn[v]) continue;
      const k = KIND[v];
      if (!(k === 1 || k === 5 || (k === 4 && goal(v)))) continue;
      if (f && f[v]) continue;
      const w = 1 + 0.3 * hn(X ? X.seed : 1, v) + (pu >= 0 && u - pu !== v - u ? 0.35 : 0);
      if (dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        prev[v] = u;
      }
    }
  }
}
function staticDist(src) {
  const d = new Float32Array(NP).fill(1e9), q = [src];
  d[src] = 0;
  for (let i = 0; i < q.length; i++) {
    const u = q[i], ur = (u / COLS) | 0, uc = u % COLS;
    for (const e of DIRS) {
      const r = ur + e[0], c = uc + e[1];
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      const v = r * COLS + c;
      if (d[v] < 1e8 || !(KIND[v] === 1 || KIND[v] === 5) || RING[v]) continue;
      d[v] = d[u] + 1;
      q.push(v);
    }
  }
  return d;
}

// ---- assays
const toWaste = () => [{ t: "go", g: "waste" }];
const toDetector = () => [{ t: "go", g: "det" }, { t: "detect" }, { t: "go", g: "waste" }];

function afterMeet() {
  const mx = { t: "mix", n: 3 + floor(rnd() * 3) }, q = rnd();
  if (q < 0.5) return [mx, ...toDetector()];
  return [mx, { t: "split", plans: [toDetector(), rnd() < 0.55 ? toDetector() : toWaste()] }];
}

function canDisp(S, T) {
  if (T.job || T.cool > 0) return false;
  const P1 = T.p + T.dr * COLS + T.dc, P2 = P1 + T.dr * COLS + T.dc, f = forbid(S, null, false);
  return !f[P1] && !f[P2];
}
function startDisp(S, T, plan, m, side) {
  const P1 = T.p + T.dr * COLS + T.dc, P2 = P1 + T.dr * COLS + T.dc;
  T.job = { ph: 0, t: 0.6 * S.sc * (0.7 + 0.4 * S.v), P1, P2, plan, m, side };
  T.on = [T.p, P1, P2];
  setAbs(T, [[T.p, 1], [P1, 0.55], [P2, 0.7]]);
}
function launch(S, need) {
  const free = S.tanks.filter((T) => canDisp(S, T));
  if (!free.length) return false;
  const pair = free.length >= 2 && rnd() < (need >= 2 ? 0.85 : 0.45);
  const T1 = free.splice(floor(rnd() * free.length), 1)[0];
  if (!pair) {
    startDisp(S, T1, toDetector());
    return true;
  }
  const T2 = free[floor(rnd() * free.length)];
  const m = { D: [null, null], stage: [-1, -1], M: -1, pads: [], rdy: [false, false], after: afterMeet(), planned: false, dead: false };
  startDisp(S, T1, [{ t: "meet", m, side: 0 }], m, 0);
  startDisp(S, T2, [{ t: "meet", m, side: 1 }], m, 1);
  return true;
}
function updTank(S, T, dt) {
  relax(S, T, dt);
  const J = T.job;
  if (!J) {
    T.cool -= dt;
    return;
  }
  J.t -= dt;
  if (J.t > 0) return;
  if (J.ph === 0) {
    // the finger is cut at the middle pad; the droplet takes the far lobe
    const i = T.lobes.findIndex((l) => l.p === J.P2), l2 = T.lobes[i];
    T.lobes.splice(i, 1);
    const D = mkDrop(S, J.P2, T.k);
    D.lobes[0].m = l2.m;
    D.plan = J.plan;
    D.timer = 0.55 * S.sc * D.sl;
    S.drops.push(D);
    if (J.m) J.m.D[J.side] = D;
    T.on = [T.p];
    setAbs(T, [[T.p, 1], [J.P1, 0]]);
    J.ph = 1;
    J.t = 0.5 * S.sc;
  } else {
    T.job = null;
    T.cool = 2.5 + 4 * rnd();
  }
}

// can a droplet still get from the tank rows to detectors and the waste row with these pads held?
function open(blocked) {
  const seen = new Uint8Array(NP), q = [];
  for (let c = 0; c < COLS; c++) if (!blocked[2 * COLS + c] && KIND[2 * COLS + c] === 1) (seen[2 * COLS + c] = 1), q.push(2 * COLS + c);
  let det = 0, out = 0;
  for (let i = 0; i < q.length; i++) {
    const u = q[i], ur = (u / COLS) | 0, uc = u % COLS;
    if (KIND[u] === 5) det++;
    if (ur === 12) out++;
    for (const e of DIRS) {
      const r = ur + e[0], c = uc + e[1];
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      const v = r * COLS + c;
      if (seen[v] || blocked[v] || RING[v] || !(KIND[v] === 1 || KIND[v] === 5)) continue;
      seen[v] = 1;
      q.push(v);
    }
  }
  return det >= 2 && out >= 3;
}
function planMeet(S, m) {
  const A = m.D[0], B = m.D[1], dA = staticDist(A.pads[0]), dB = staticDist(B.pads[0]), f = forbid(S, null, true, [A, B]);
  let best = null, bs = 1e9;
  const held = new Uint8Array(NP), trial = new Uint8Array(NP);
  for (const o of S.meets) for (const p of o.pads) mark3(held, p);
  for (let p = 0; p < NP; p++) {
    if (KIND[p] !== 1 || RING[p]) continue;
    const r = (p / COLS) | 0, c = p % COLS;
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      if (r - dr < 0 || c - dc < 0 || r + dr >= ROWS || c + dc >= COLS) continue;
      const a = p - dr * COLS - dc, e = p + dr * COLS + dc;
      if (KIND[a] !== 1 || KIND[e] !== 1 || RING[a] || RING[e] || f[a] || f[p] || f[e]) continue;
      trial.set(held);
      mark3(trial, a);
      mark3(trial, p);
      mark3(trial, e);
      if (!open(trial)) continue;
      for (const sw of [0, 1]) {
        const x = sw ? e : a, y = sw ? a : e;
        if (dA[x] > 1e8 || dB[y] > 1e8) continue;
        const s = max(dA[x], dB[y]) + 0.35 * (dA[x] + dB[y]) + 3 * rnd();
        if (s < bs) {
          bs = s;
          best = { a: x, c: y, M: p };
        }
      }
    }
  }
  if (!best) return false;
  m.stage = [best.a, best.c];
  m.M = best.M;
  m.pads = [best.a, best.M, best.c];
  m.planned = true;
  m.D[0].meet = m.D[1].meet = m;
  S.meets.push(m);
  return true;
}
function endMeet(S, m) {
  const i = S.meets.indexOf(m);
  if (i >= 0) S.meets.splice(i, 1);
}
function abortMeet(S, m) {
  m.dead = true;
  endMeet(S, m);
  for (const D of m.D) if (D && S.drops.includes(D) && D.plan[0] && D.plan[0].m === m) {
    D.plan = toDetector();
    D.meet = null;
  }
}
// two reagents mix the short way round the wheel, so opposite ones stay clear and never go grey
function arc(S, D, t, o) {
  const ha = RH[D.ka] + S.hue;
  let d = RH[D.kb] - RH[D.ka];
  d -= Math.round(d);
  o[0] = ha + d * t;
  o[1] = mix(RS[D.ka], RS[D.kb], t);
}
function merge(S, m) {
  const A = m.D[0], B = m.D[1], [a, c] = m.stage, M = m.M;
  if (!S.drops.includes(A) || !S.drops.includes(B)) return;
  const N = mkDrop(S, a, 0);
  N.V = A.V + B.V;
  N.lobes = A.lobes.concat(B.lobes, [{ p: M, m: 0, tg: 0 }]);
  N.pads = [a, c];
  N.on = [a, c];
  N.ka = A.ka;
  N.kb = B.ka;
  N.con = N.conT = 1;
  N.rat = 0.12 + 0.76 * rnd();
  const dx = pcx(c) - pcx(a), dy = pcy(c) - pcy(a), n = sqrt(dx * dx + dy * dy);
  N.ax = dx / n;
  N.ay = dy / n;
  N.sl = (A.sl + B.sl) / 2;
  N.meet = m;
  N.plan = m.after;
  S.drops.splice(S.drops.indexOf(A), 1);
  S.drops.splice(S.drops.indexOf(B), 1);
  S.drops.push(N);
  beginMove(S, N, [a, M, c]);
}
function mixStep(D) {
  D.mixN++;
  D.lamT = 34 / (1 + 1.7 * D.mixN);
  D.conT = exp(-0.6 * D.mixN);
  D.thT += D.mixN % 2 ? 0.5 : -0.35;
}
function performSplit(S, D) {
  const m = D.meet, [a, c] = m.stage, plans = D.plan[0].plans, flip = rnd() < 0.5;
  const kids = [a, c].map((p, i) => {
    const K = mkDrop(S, p, 0), l = D.lobes.find((q) => q.p === p);
    K.lobes[0].m = l ? l.m : 0.8;
    K.ka = D.ka;
    K.kb = D.kb;
    for (const key of ["con", "conT", "lam", "lamT", "th", "thT", "ax", "ay", "mixN", "rat"]) K[key] = D[key];
    K.plan = plans[flip ? 1 - i : i];
    K.timer = 0.35 * S.sc * K.sl;
    return K;
  });
  S.drops.splice(S.drops.indexOf(D), 1);
  for (const K of kids) S.drops.push(K);
  endMeet(S, m);
}

// ---- one droplet
function wait(D, t) {
  D.timer = t;
  D.stuck += t;
}
function stepTo(S, D, goal) {
  const f = forbid(S, D, true);
  return route(S, D, D.pads[0], goal, f);
}
function release(S, D) {
  for (let p = 0; p < NP; p++) if (S.det[p] === D.id) S.det[p] = -1;
}
// a droplet that has waited a while steps to any free pad, to loosen a jam
function nudge(S, D) {
  const f = forbid(S, D, true), p = D.pads[0], r = (p / COLS) | 0, c = p % COLS, opts = [];
  for (const d of DIRS) {
    const rr = r + d[0], cc = c + d[1];
    if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
    const v = rr * COLS + cc;
    if ((KIND[v] === 1 || KIND[v] === 5) && !f[v] && !RING[v]) opts.push(v);
  }
  if (!opts.length) return false;
  beginMove(S, D, [opts[floor(rnd() * opts.length)]]);
  return true;
}
function think(S, D) {
  const op = D.plan[0];
  if (!op) {
    D.plan = toWaste();
    return;
  }
  const p = D.pads[0], one = D.pads.length === 1;
  if (D.stuck > 18 && !D.meet && op.t !== "absorb") {
    D.plan = [{ t: "absorb" }];
    return;
  }
  if (op.t === "go") {
    if (one && op.pad === p) {
      D.plan.shift();
      if (op.g === "waste") D.plan.unshift({ t: "absorb" });
      return;
    }
    if (op.pad == null) {
      const goal = op.g === "det" ? (v) => KIND[v] === 5 && S.det[v] < 0 : (v) => KIND[v] === 4;
      const q = stepTo(S, D, goal);
      if (q < 0) {
        op.w = (op.w || 0) + 0.4;
        if (op.w > 7 && op.g === "det") (D.plan = toWaste()), release(S, D);
        if (D.stuck > 4 && rnd() < 0.4 && nudge(S, D)) return;
        return wait(D, 0.3 + 0.4 * rnd());
      }
      op.pad = S.rg;
      if (op.g === "det") S.det[S.rg] = D.id;
      return beginMove(S, D, [q]);
    }
    const q = stepTo(S, D, (v) => v === op.pad);
    if (q < 0) {
      if (D.stuck > 4 && rnd() < 0.4 && nudge(S, D)) return;
      return wait(D, 0.3 + 0.4 * rnd());
    }
    return beginMove(S, D, [q]);
  }
  if (op.t === "meet") {
    const m = op.m;
    if (m.dead) {
      D.plan = toDetector();
      D.meet = null;
      return;
    }
    if (!m.planned) {
      if (m.D[0] && m.D[1] && S.drops.includes(m.D[0]) && S.drops.includes(m.D[1])) return planMeet(S, m) ? undefined : wait(D, 0.4 + 0.4 * rnd());
      return wait(D, 0.3);
    }
    const st = m.stage[op.side];
    if (one && p === st) {
      m.rdy[op.side] = true;
      const o = m.D[1 - op.side];
      if (m.rdy[1 - op.side] && o && o.mode === "rest" && o.pads[0] === m.stage[1 - op.side]) return merge(S, m);
      D.stuck = 0;
      return wait(D, 0.25);
    }
    m.rdy[op.side] = false;
    const q = stepTo(S, D, (v) => v === st);
    if (q < 0) {
      if (D.stuck > 4 && rnd() < 0.4 && nudge(S, D)) return;
      wait(D, 0.3 + 0.4 * rnd());
      if (D.stuck > 11) abortMeet(S, m);
      return;
    }
    return beginMove(S, D, [q]);
  }
  if (op.t === "mix") {
    const m = D.meet, [a, c] = m.stage, M = m.M;
    if (!op.h) {
      op.h = 1;
      op.k = 0;
      D.timer = 0.55 * S.sc * D.sl;
      return;
    }
    if (op.k < op.n) {
      mixStep(D);
      return beginMove(S, D, op.k++ % 2 === 0 ? [a, M] : [M, c]);
    }
    if (!one) return beginMove(S, D, [M]);
    D.plan.shift();
    if (!(D.plan[0] && D.plan[0].t === "split")) endMeet(S, m), (D.meet = null);
    return;
  }
  if (op.t === "split") {
    const m = D.meet;
    D.split = true;
    return beginMove(S, D, [m.stage[0], m.stage[1]]);
  }
  if (op.t === "detect") {
    if (!op.on) {
      op.on = true;
      D.flT = 0;
      D.timer = (1.8 + 0.6 * rnd()) * min(2, S.sc) * D.sl;
      return;
    }
    release(S, D);
    D.plan.shift();
    return;
  }
  if (op.t === "absorb") {
    D.mode = "absorb";
    setAbs(D, []);
    D.on = [p];
    const rgb = [0, 0, 0], hs = [0, 0];
    arc(S, D, 0.5, hs);
    hsv(hs[0], hs[1], 0.9, rgb);
    // the waste pad keeps a level of what it drank
    const L = S.pool[p], q = (0.3 * D.V) / (L + 0.3 * D.V);
    for (let i = 0; i < 3; i++) S.poolc[p * 3 + i] = mix(S.poolc[p * 3 + i], rgb[i], q);
    S.pool[p] = min(1, L + 0.3 * D.V);
  }
}
function updDrop(S, D, dt) {
  relax(S, D, dt);
  D.wob.t += dt;
  const k1 = 1 - exp(-dt / 0.5);
  D.lam += (D.lamT - D.lam) * k1;
  D.con += (D.conT - D.con) * k1;
  D.th += (D.thT - D.th) * k1;
  if (D.flT >= 0) {
    D.flT += dt;
    const t = D.flT;
    D.fl = t < 0.12 ? t / 0.12 : exp(-(t - 0.12) / 0.75);
    D.prod = sm(0, 0.45, t);
  }
  if (D.mode === "absorb") {
    D.timer = 0;
    if (!D.lobes.length) S.drops.splice(S.drops.indexOf(D), 1), release(S, D);
    return;
  }
  D.timer -= dt;
  if (D.timer > 0) return;
  if (D.mode === "spread") {
    D.on = D.np.slice();
    setTg(D, D.np, D.np.map(() => 1));
    D.mode = "gather";
    D.timer = S.tB * D.sl;
  } else if (D.mode === "gather") {
    if (D.split) {
      const M = D.meet.M, l = D.lobes.find((q) => q.p === M);
      if (l && l.m > 0.13) return void (D.timer = 0.02);
      return performSplit(S, D);
    }
    const mv = D.np.length === 1 && D.pads.length === 1 ? D.np[0] - D.pads[0] : 0;
    D.pads = D.np;
    D.on = D.pads.slice();
    D.mode = "rest";
    D.wob.t = 0;
    D.wob.a = (abs(mv) === 1 ? 1 : -1) * 0.1;
    D.timer = (0.12 + 0.5 * rnd() + (rnd() < 0.08 + 0.2 * (1 - S.v) ? 0.6 + 0.8 * rnd() : 0)) * S.sc * D.sl;
  } else think(S, D);
}

function sim(S, dt) {
  S.t += dt;
  // the dyes drift a little round the knob's hue, on two periods that do not divide
  S.hue = S.hk + 0.08 * sin((TAU * S.t) / 97 + S.ph[0]) + 0.05 * sin((TAU * S.t) / 61 + S.ph[1]);
  S.cool -= dt;
  for (const T of S.tanks) updTank(S, T, dt);
  for (const D of S.drops.slice()) if (S.drops.includes(D)) updDrop(S, D, dt);
  let n = S.drops.length;
  for (const T of S.tanks) if (T.job && T.job.ph === 0) n++;
  let jam = 0;
  for (const D of S.drops) if (D.stuck > 2) jam++;
  if (S.cool <= 0 && n < S.want && jam < 2) S.cool = launch(S, S.want - n) ? 1.2 + 2.6 * rnd() : 0.6;
  S.tgt.fill(0);
  for (const D of S.drops) for (const p of D.on) S.tgt[p] = 1;
  for (const T of S.tanks) for (const p of T.on) S.tgt[p] = 1;
  for (let p = 0; p < NP; p++) {
    S.act[p] += (S.tgt[p] - S.act[p]) * (1 - exp(-dt / (S.tgt[p] ? 0.07 : 0.3)));
    S.pool[p] = max(0, S.pool[p] - dt / 100);
    S.heat[p] += (S.act[p] * (1 - S.heat[p]) * 0.2 - S.heat[p] / 40) * dt;
  }
}

function knobs(S, kv) {
  S.k = [cl(kv[0], 0, 1), cl(kv[1], 0.5, 3), cl(kv[2], -1, 1), cl(kv[3], -1, 1)];
  S.hk = S.k[0];
  S.v = (S.k[3] + 1) / 2;
  const sc = Math.pow(2 / S.k[1], 0.6), vf = 1.25 - 0.5 * S.v;
  S.sc = sc;
  S.tA = 0.2 * sc * vf;
  S.tB = 0.28 * sc * vf;
  S.tau = 0.075 * vf * Math.pow(sc, 0.6);
  S.want = Math.round(S.k[2] < 0 ? 5 + S.k[2] : 5 + 3 * S.k[2]);
}

export function setup(params) {
  params.s = makeState();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  knobs(S, (input && input.knobValues) || [0, 2, 0, 0.06]);
  if (!S.init) {
    S.init = true;
    for (let i = 0; i < 960; i++) sim(S, 1 / 16);
    return;
  }
  let d = cl(dt || 0, 0, 0.1);
  while (d > 1e-6) {
    const s = min(d, 1 / 30);
    sim(S, s);
    d -= s;
  }
}

// ---- drawing
function paintBase(S) {
  const { R, G, B, act, heat, pool, poolc } = S;
  const vk = 0.35 + 0.65 * S.v;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, lx = x - X0, ly = y - Y0;
      let r = SUBC[0] + 0.012 * (y / H), g = SUBC[1] + 0.02 * (y / H), b = SUBC[2] + 0.02 * (y / H);
      const c = floor(lx / PITCH), rw = floor(ly / PITCH);
      if (lx >= 0 && ly >= 0 && c < COLS && rw < ROWS) {
        const ox = lx - c * PITCH, oy = ly - rw * PITCH, p = rw * COLS + c, K = KIND[p];
        if (ox < 8 && oy < 8 && K) {
          const a = act[p] * vk, edge = ox === 0 || ox === 7 || oy === 0 || oy === 7;
          const cor = (ox === 0 || ox === 7) && (oy === 0 || oy === 7) ? 0.5 : 1;
          const bev = 1 + 0.1 * ((3.5 - ox) / 3.5 + (3.5 - oy) / 3.5) * 0.5;
          let lo, hi;
          if (K === 1) (lo = PADD), (hi = PADL);
          else if (K === 5) (lo = DETD), (hi = DETL);
          else if (K === 2) (lo = DEAD), (hi = DEAD);
          else if (K === 3) (lo = TANKP), (hi = TANKP);
          else (lo = WASTEP), (hi = WASTEP);
          const e = K === 2 ? 0 : edge ? 0.14 * a : 0, w = cl(a + 0.3 * heat[p], 0, 1);
          r = (mix(lo[0], hi[0], w) + e) * cor * (K === 2 ? 1 : bev);
          g = (mix(lo[1], hi[1], w) + e) * cor * (K === 2 ? 1 : bev);
          b = (mix(lo[2], hi[2], w) + e) * cor * (K === 2 ? 1 : bev);
          if (K === 4 && pool[p] > 0.02 && 7 - oy < 7.5 * pool[p]) {
                    const top = 7 - oy > 7.5 * pool[p] - 1 ? 0.55 : 0.34;
            r = r * 0.4 + poolc[p * 3] * top;
            g = g * 0.4 + poolc[p * 3 + 1] * top;
            b = b * 0.4 + poolc[p * 3 + 2] * top;
          }
        } else if (ox === 8 || oy === 8) {
          // the gap takes light from lit pads beside it
          let a = 0;
          for (let dr = 0; dr <= (oy === 8 ? 1 : 0); dr++)
            for (let dc = 0; dc <= (ox === 8 ? 1 : 0); dc++) {
              const rr = rw + dr, cc = c + dc;
              if (rr < ROWS && cc < COLS && KIND[rr * COLS + cc] === 1) a = max(a, act[rr * COLS + cc]);
            }
          if (a > 0.01) {
            r += PADL[0] * 0.24 * a * vk;
            g += PADL[1] * 0.24 * a * vk;
            b += PADL[2] * 0.24 * a * vk;
          }
        }
      }
      R[i] = r;
      G[i] = g;
      B[i] = b;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (!S.init) update(0, { knobValues: S.k }, params);
  paintBase(S);
  const { R, G, B, sd, dm, lb, act } = S;
  const hs = [0, 0], tc = [0, 0, 0];
  sd.fill(99);
  dm.fill(99);
  const shapes = [], byPad = new Map(), all = S.drops.concat(S.tanks), volt = S.v - 0.35;
  // lobes of every droplet, then bridges across the gaps between lobes that touch
  for (const D of all) {
    let cx = 0, cy = 0, ms = 0;
    for (const l of D.lobes) {
      cx += pcx(l.p) * l.m;
      cy += pcy(l.p) * l.m;
      ms += l.m;
    }
    D.cx = ms > 0 ? cx / ms : 0;
    D.cy = ms > 0 ? cy / ms : 0;
    const w = D.wob.a * cos(16 * D.wob.t) * exp(-D.wob.t / 0.4);
    hsv(S.hue + 0.3 + 0.6 * D.rat, 0.72, 1, (D.fcol = D.fcol || [0, 0, 0]));
    D.ux = cos(D.th) * D.ax - sin(D.th) * D.ay;
    D.uy = sin(D.th) * D.ax + cos(D.th) * D.ay;
    D.bx0 = D.by0 = 999;
    D.bx1 = D.by1 = -999;
    for (const l of D.lobes) {
      if (l.m < 0.03) continue;
      const big = D.tank && l.p === D.p;
      const sw = 1 + 0.35 * volt * act[l.p];
      const h = 3.85 * sqrt(l.m) * sw;
      const asp = D.asp || 0, hx = big ? D.ex : h * (1 + w + asp), hy = big ? D.ey : h * (1 - w - asp);
      const rc = big ? 2.6 : min(min(hx, hy) * 0.97, h * (D.rr ? D.rr + 0.14 * cl(l.m - 1, 0, 1) : 0.7));
      const s = { x: pcx(l.p), y: pcy(l.p), hx, hy, rc, d: D, m: l.m, lobe: true };
      shapes.push(s);
      byPad.set(l.p, s);
      D.bx0 = min(D.bx0, s.x - hx);
      D.bx1 = max(D.bx1, s.x + hx);
      D.by0 = min(D.by0, s.y - hy);
      D.by1 = max(D.by1, s.y + hy);
    }
  }
  for (const [p, s] of byPad) {
    for (const q of [p + 1, p + COLS]) {
      const t = byPad.get(q);
      if (!t || (q === p + 1 && q % COLS === 0)) continue;
      const hz = q === p + 1;
      if (min(s.m, t.m) < 0.07) continue;
      const th = 0.92 * (hz ? min(s.hy, t.hy) : min(s.hx, t.hx));
      if (th < 0.6) continue;
      shapes.push({ x: (s.x + t.x) / 2, y: (s.y + t.y) / 2, hx: hz ? PITCH / 2 + 0.5 : th, hy: hz ? th : PITCH / 2 + 0.5, rc: min(th, 1.5), d: s.m >= t.m ? s.d : t.d, m: 0, lobe: false });
    }
  }
  // the bloom of a flashing droplet, under the droplets
  for (const D of S.drops) {
    if (D.flT < 0 || D.fl < 0.02) continue;
    const fc = D.fcol, x0 = max(0, floor(D.cx - 14)), x1 = min(W - 1, ceil(D.cx + 14)), y0 = max(0, floor(D.cy - 14)), y1 = min(H - 1, ceil(D.cy + 14));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - D.cx, dy = y + 0.5 - D.cy, g = 0.8 * D.fl * exp(-(dx * dx + dy * dy) / 55), i = y * W + x;
        R[i] += fc[0] * g;
        G[i] += fc[1] * g;
        B[i] += fc[2] * g;
      }
  }
  shapes.forEach((s, si) => {
    const x0 = max(0, floor(s.x - s.hx - 3)), x1 = min(W - 1, ceil(s.x + s.hx + 3)), y0 = max(0, floor(s.y - s.hy - 3)), y1 = min(H - 1, ceil(s.y + s.hy + 3));
    const ix = s.hx - s.rc, iy = s.hy - s.rc;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const qx = abs(x + 0.5 - s.x) - ix, qy = abs(y + 0.5 - s.y) - iy, ox = max(qx, 0), oy = max(qy, 0);
        const d = sqrt(ox * ox + oy * oy) + min(max(qx, qy), 0) - s.rc, i = y * W + x;
        sd[i] = smin(sd[i], d, 2.2);
        if (d < dm[i]) {
          dm[i] = d;
          lb[i] = si;
        }
      }
  });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, s = sd[i];
      if (s > 1.5) continue;
      let r = R[i], g = G[i], b = B[i];
      if (s > 0) {
        const k = 1 - 0.6 * (1 - s / 1.5) * (1 - s / 1.5);
        r *= k;
        g *= k;
        b *= k;
      }
      const cov = cl(0.5 - s, 0, 1);
      if (cov > 0) {
        const sh = shapes[lb[i]], D = sh.d, e = max(-s, 0), px = x + 0.5, py = y + 0.5;
        const u = (px - D.cx) * D.ux + (py - D.cy) * D.uy;
        const q = 0.5 + 0.5 * tanh(3 * sin((TAU * u) / D.lam));
        const t = 0.5 + (q - 0.5) * D.con;
        arc(S, D, t, hs);
        const hh = hs[0] - floor(hs[0]), wl = max(sm(0.9, 0.97, hh), 1 - sm(0.1, 0.2, hh)); // red to yellow goes brown when dim: lifted and paled
        hsv(hs[0], hs[1] * (1 - 0.25 * wl), 1, tc);
        let cr = tc[0], cg = tc[1], cb = tc[2];
        if (D.prod > 0) {
          cr = mix(cr, D.fcol[0], D.prod);
          cg = mix(cg, D.fcol[1], D.prod);
          cb = mix(cb, D.fcol[2], D.prod);
        }
        const lens = sm(0, 3.5, e), rim = exp(-(e * e) / 1.2), f = (1 + 1.2 * D.fl);
        // a spot near the top left of the whole droplet, and a streak along its long edge
        const bw = D.bx1 - D.bx0, bh = D.by1 - D.by0, sx = D.bx0 + 0.34 * min(bw, 8.5), sy = D.by0 + 0.32 * min(bh, 8.5);
        let hl = 0.55 * exp(-((px - sx) * (px - sx) + (py - sy) * (py - sy)) / 1.7);
        if (bw > 9.5) {
          const dy = py - (D.by0 + 1.6), dxo = max(0, px - (D.bx1 - 2.6), sx - px);
          hl += 0.2 * exp(-(dy * dy) / 0.9 - (dxo * dxo) / 8);
        } else if (bh > 9.5) {
          const dx = px - (D.bx0 + 1.6), dyo = max(0, py - (D.by1 - 2.6), sy - py);
          hl += 0.2 * exp(-(dx * dx) / 0.9 - (dyo * dyo) / 8);
        }
        hl *= min(1, (D.bx1 - D.bx0) * 0.3);
        const body = (0.42 + 0.24 * lens) * f * (1 + 0.5 * wl), rk = 0.34 * rim * (1 + D.fl);
        const pr = cr * body + (cr + (1 - cr) * 0.3) * rk + hl + r * 0.22;
        const pg = cg * body + (cg + (1 - cg) * 0.3) * rk + hl + g * 0.22;
        const pb = cb * body + (cb + (1 - cb) * 0.3) * rk + hl + b * 0.22;
        r += (pr - r) * cov;
        g += (pg - g) * cov;
        b += (pb - b) * cov;
      }
      R[i] = r;
      G[i] = g;
      B[i] = b;
    }
  }
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) display.setPixel(x, y, min(255, R[i] * 255) | 0, min(255, G[i] * 255) | 0, min(255, B[i] * 255) | 0);
}
