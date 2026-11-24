// ===== Patternflow pattern =====
// Title:   RRT Star
// Family:  motionplanning
// Idea:    A point robot is the root of a tree that grows over the whole panel among a few drifting dark blobs, every new twig picking its cheapest parent and rewiring its neighbours, the branches coloured teal to magenta by their path length from the robot, while the robot runs along the best path in warm white to a pulsing ring and a new ring opens far away each time it arrives.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: RRT, the rapidly-exploring random tree (Steven M. LaValle, 1998) and RRT*, which picks the cheapest parent among the neighbours and rewires them through the new node (Sertac Karaman and Emilio Frazzoli, 2011), both from memory; the obstacles drift as Ornstein-Uhlenbeck walks (Leonard Ornstein and George Uhlenbeck, 1930, from memory); pattern round 234
// Round:   234
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Growth=0.3..3, Clutter=-1..1, Rewire=-1..1
//
// Knob 1: Hue. Turns the colour band that paints the branches by their path length from the robot: at 0 it runs teal at the robot, blue, violet and magenta at 85 LED of path, at 0.25 violet through pink to orange, at 0.5 coral through gold to green, at 0.75 green through teal to blue, and 1 is 0 again.
// Knob 2: Growth. How many samples the tree tries a second: 18 at 0.3 (5 new nodes a second, about 100 nodes standing), 60 at the opening 2 (10 new nodes a second, 125 standing) and 180 at 3 (25 new nodes a second, the 130 node cap, so every new leaf costs the most crowded one), and the existing nodes look for a cheaper parent at twice that rate.
// Knob 3: Clutter. How many blobs drift about and how big they are: 2 blobs about 8 LED across at -1 (1.5 percent of the panel), 5.5 blobs about 13 LED across at the opening 0 (9 percent), 9 blobs about 18 LED across at 1 (32 percent).
// Knob 4: Rewire. How far a new node looks for a better parent and for neighbours to pull through itself: 7.4 LED at -1, hardly more than one step, so it is plain RRT and the branches zigzag (6.4 LED edges, the path 1.20 times the straight line with 300 degrees of bends), 13.9 LED at the opening 0.06 (8.7 LED edges, 1.09 times, 130 degrees), 24.4 LED at 1 (11 LED edges, 1.05 times, 75 degrees, and a node may carry five children instead of three so the branches comb out straight).

const W = 64;
const H = 128;
const { floor, ceil, exp, sin, cos, sqrt, abs, min, max, pow, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

const NOBS = 9;
const CAP = 130; // nodes the tree keeps
const STEP0 = 6.2; // the step of a new node, LED
const STEP1 = 8;
const SPACE2 = 4.6 * 4.6; // no two nodes closer than this
const CLR2 = 1.7 * 1.7; // no edge passes closer than this to a node it does not join
const GOALR = 18; // nodes this near the goal may join it
const SPEED = 9; // the robot, LED a second
const CS = 85; // the path length that reaches the far end of the colour band
const BG = [10, 14, 34];

// ---- colour: OKLCH to sRGB
function oklch(L, C, hDeg, out) {
  const h = (hDeg * PI) / 180;
  const a = C * cos(h);
  const b = C * sin(h);
  const l = pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  for (let i = 0; i < 3; i++) {
    const v = cl(lin[i], 0, 1);
    out[i] = 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055);
  }
}

function buildLut(P, k1) {
  const o = [0, 0, 0];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    oklch(0.76 - 0.06 * t, 0.115 + 0.04 * t, 192 + 360 * k1 + 150 * t, o);
    P.lut[i * 3] = o[0];
    P.lut[i * 3 + 1] = o[1];
    P.lut[i * 3 + 2] = o[2];
  }
}

// ---- the blobs: ellipses that drift as Ornstein-Uhlenbeck walks
function newObs() {
  return { x: 6 + 52 * Math.random(), y: 6 + 116 * Math.random(), vx: 0, vy: 0, ang: Math.random() * PI, w: 0, e0: 0.16 * gauss(), asp: 0, rs: 0.82 + 0.36 * Math.random(), R: 6, s: 0, a: 1, b: 1, co: 1, si: 0 };
}

// does the segment come within mg LED of any blob? (a point is a segment of no length)
function segHit(P, ax, ay, bx, by, mg) {
  const os = P.obs;
  for (let i = 0; i < NOBS; i++) {
    const o = os[i];
    if (o.s < 0.04) continue;
    const A = o.a + mg;
    const B = o.b + mg;
    let dx = ax - o.x;
    let dy = ay - o.y;
    const u0 = (dx * o.co + dy * o.si) / A;
    const v0 = (dy * o.co - dx * o.si) / B;
    dx = bx - o.x;
    dy = by - o.y;
    const ex = (dx * o.co + dy * o.si) / A - u0;
    const ey = (dy * o.co - dx * o.si) / B - v0;
    const l2 = ex * ex + ey * ey;
    let t = l2 > 1e-12 ? -(u0 * ex + v0 * ey) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = u0 + ex * t;
    const py = v0 + ey * t;
    if (px * px + py * py < 1) return true;
  }
  return false;
}

function stepObs(P, d, k) {
  const u = cl((k.k3 + 1) / 2, 0, 1);
  const n = 2 + 7 * u;
  const R0 = 4.2 + 5 * u;
  const e = 1 - exp(-d / 0.9);
  const r = P.root;
  const g = P.goal;
  for (let i = 0; i < NOBS; i++) {
    const o = P.obs[i];
    const sT = cl(n - i, 0, 1);
    if (P.snap) {
      o.s = sT;
      o.R = R0 * o.rs;
    } else {
      o.s += (sT - o.s) * e;
      o.R += (R0 * o.rs - o.R) * e;
    }
    o.vx += (-o.vx / 7) * d + 2.4 * sqrt((2 * d) / 7) * gauss();
    o.vy += (-o.vy / 7) * d + 2.4 * sqrt((2 * d) / 7) * gauss();
    o.w += (-o.w / 8) * d + 0.22 * sqrt((2 * d) / 8) * gauss();
    o.asp += ((o.e0 - o.asp) / 9) * d + 0.1 * sqrt((2 * d) / 9) * gauss();
    // soft walls, and a clear patch round the robot and the goal
    if (o.x < 4) o.vx += (4 - o.x) * 1.2 * d;
    if (o.x > 60) o.vx -= (o.x - 60) * 1.2 * d;
    if (o.y < 4) o.vy += (4 - o.y) * 1.2 * d;
    if (o.y > 124) o.vy -= (o.y - 124) * 1.2 * d;
    const reach = o.R * 1.3 + 11;
    let dx = o.x - r.x;
    let dy = o.y - r.y;
    let dd = hypot(dx, dy) || 1;
    if (dd < reach) {
      const f = (1 - dd / reach) * 16 * d;
      o.vx += (dx / dd) * f;
      o.vy += (dy / dd) * f;
    }
    dx = o.x - g.x;
    dy = o.y - g.y;
    dd = hypot(dx, dy) || 1;
    if (dd < reach) {
      const f = (1 - dd / reach) * 10 * d;
      o.vx += (dx / dd) * f;
      o.vy += (dy / dd) * f;
    }
    o.x += o.vx * d;
    o.y += o.vy * d;
    o.ang += o.w * d;
    o.a = o.R * exp(o.asp) * o.s;
    o.b = o.R * exp(-o.asp) * o.s;
    o.co = cos(o.ang);
    o.si = sin(o.ang);
  }
}

// ---- the tree
// an edge keeps clear of every other node: a long edge may not skim past a node, it goes through it
function clear(P, ax, ay, bx, by, na, nb) {
  const ex = bx - ax;
  const ey = by - ay;
  const l2 = ex * ex + ey * ey || 1;
  for (const m of P.nodes) {
    if (m === na || m === nb) continue;
    const t = cl(((m.x - ax) * ex + (m.y - ay) * ey) / l2, 0, 1);
    const dx = m.x - ax - ex * t;
    const dy = m.y - ay - ey * t;
    if (dx * dx + dy * dy < CLR2) return false;
  }
  return true;
}

// a node's children fan out: a new one may not lie within 26 degrees of one it already has (16 at the widest Rewire)
function fanOk(P, u, x, y, skip) {
  const vx = x - u.x;
  const vy = y - u.y;
  const vl = hypot(vx, vy) || 1;
  for (const k of u.kids) {
    if (k === skip) continue;
    const kx = k.x - u.x;
    const ky = k.y - u.y;
    if ((vx * kx + vy * ky) / (vl * (hypot(kx, ky) || 1)) > P.fc) return false;
  }
  return true;
}

function setParent(n, p) {
  if (n.par) {
    const k = n.par.kids;
    const i = k.indexOf(n);
    if (i >= 0) {
      k[i] = k[k.length - 1];
      k.pop();
    }
  }
  n.par = p;
  p.kids.push(n);
}

function propagate(n) {
  const st = [n];
  while (st.length) {
    const m = st.pop();
    for (const k of m.kids) {
      k.cost = m.cost + hypot(k.x - m.x, k.y - m.y);
      st.push(k);
    }
  }
}

function recost(P) {
  P.root.cost = 0;
  propagate(P.root);
}

function mkNode(x, y, par, cost) {
  const n = { x, y, par: null, kids: [], cost, dc: cost, g: 0, ea: 1, a: 1, age: 0, dead: false, st: 0 };
  if (par) setParent(n, par);
  return n;
}

function reparent(P, n, p) {
  const o = n.par;
  if (o) {
    P.ghosts.push({ ax: n.x, ay: n.y, bx: o.x, by: o.y, c0: n.dc, c1: o.dc, a: 1 });
    if (P.ghosts.length > 90) P.ghosts.shift();
  }
  setParent(n, p);
  n.cost = p.cost + hypot(n.x - p.x, n.y - p.y);
  n.ea = 0;
  propagate(n);
}

// n and everything that hangs from it fade out
function kill(P, n) {
  if (n.par) {
    const k = n.par.kids;
    const i = k.indexOf(n);
    if (i >= 0) {
      k[i] = k[k.length - 1];
      k.pop();
    }
  }
  const st = [n];
  while (st.length) {
    const m = st.pop();
    m.dead = true;
    P.dying.push(m);
    for (const c of m.kids) st.push(c);
  }
  P.nodes = P.nodes.filter((m) => !m.dead);
}

// a blob has cut the edge above n: a big branch looks round for another way into the tree, a small one just goes
function orphan(P, n) {
  const st = [n];
  const mark = ++P.stamp;
  let size = 0;
  while (st.length) {
    const m = st.pop();
    m.st = mark;
    size++;
    for (const c of m.kids) st.push(c);
  }
  if (size >= 3) {
    let bu = null;
    let bc = 1e9;
    for (const u of P.nodes) {
      if (u.st === mark || u.kids.length >= P.mk || !fanOk(P, u, n.x, n.y, n)) continue;
      const d = hypot(u.x - n.x, u.y - n.y);
      if (d > 18 || u.cost + d >= bc) continue;
      if (!segHit(P, u.x, u.y, n.x, n.y, 1) && clear(P, u.x, u.y, n.x, n.y, u, n)) {
        bc = u.cost + d;
        bu = u;
      }
    }
    if (bu) {
      reparent(P, n, bu);
      return;
    }
  }
  kill(P, n);
}

function cutEdges(P) {
  const ns = P.nodes.slice();
  for (const n of ns) {
    if (n.dead || n === P.root) continue;
    const p = n.par;
    if (segHit(P, n.x, n.y, p.x, p.y, 0.2)) orphan(P, n);
  }
}

// the robot is the root: if a blob drifts onto it, shove it clear
function eject(P) {
  const r = P.root;
  for (let k = 0; k < 14 && segHit(P, r.x, r.y, r.x, r.y, 1.4); k++) {
    let bo = null;
    let bd = 1e9;
    for (const o of P.obs) {
      if (o.s < 0.04) continue;
      const dd = hypot(r.x - o.x, r.y - o.y) - max(o.a, o.b);
      if (dd < bd) {
        bd = dd;
        bo = o;
      }
    }
    if (!bo) break;
    const dd = hypot(r.x - bo.x, r.y - bo.y) || 1;
    r.x += ((r.x - bo.x) / dd) * 0.8;
    r.y += ((r.y - bo.y) / dd) * 0.8;
  }
  r.x = cl(r.x, 1, W - 1);
  r.y = cl(r.y, 1, H - 1);
}

// one sample: steer the nearest node a step toward it, choose the cheapest parent, rewire
function grow(P, rad) {
  const ns = P.nodes;
  const goal = P.goal;
  const rr = Math.random();
  let sx;
  let sy;
  if (rr < 0.08) {
    sx = goal.x;
    sy = goal.y;
  } else if (rr < 0.16 && P.pp.length > 1) {
    const q = P.pp[floor(Math.random() * P.pp.length)];
    sx = q[0] + gauss() * 7;
    sy = q[1] + gauss() * 7;
  } else {
    sx = Math.random() * W;
    sy = Math.random() * H;
  }
  let q = null;
  let qd = 1e9;
  for (const n of ns) {
    const dx = n.x - sx;
    const dy = n.y - sy;
    const d2 = dx * dx + dy * dy;
    if (d2 < qd) {
      qd = d2;
      q = n;
    }
  }
  const d = sqrt(qd);
  if (d < 2) return;
  const st = min(d, STEP0 + (STEP1 - STEP0) * Math.random());
  const nx = cl(q.x + ((sx - q.x) / d) * st, 2.5, W - 2.5);
  const ny = cl(q.y + ((sy - q.y) / d) * st, 2.5, H - 2.5);
  if (segHit(P, q.x, q.y, nx, ny, 1.6)) return;
  const r2 = rad * rad;
  const nb = P.nb;
  nb.length = 0;
  for (const n of ns) {
    const dx = n.x - nx;
    const dy = n.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < SPACE2) return;
    if (d2 <= r2 || n === q) nb.push({ n, d: sqrt(d2), fr: -1 });
  }
  let par = null;
  let bc = 1e9;
  for (const e of nb) {
    const c = e.n.cost + e.d;
    if (c < bc && e.n.kids.length < P.mk && fanOk(P, e.n, nx, ny, null)) {
      e.fr = segHit(P, e.n.x, e.n.y, nx, ny, 1.6) || !clear(P, e.n.x, e.n.y, nx, ny, e.n, null) ? 0 : 1;
      if (e.fr) {
        bc = c;
        par = e.n;
      }
    }
  }
  if (!par) return;
  const nn = mkNode(nx, ny, par, bc);
  ns.push(nn);
  for (const e of nb) {
    if (e.n === par || e.n === P.root || nn.kids.length >= P.mk) continue;
    if (bc + e.d < e.n.cost - 0.05 && fanOk(P, nn, e.n.x, e.n.y, null)) {
      if (e.fr < 0) e.fr = segHit(P, e.n.x, e.n.y, nx, ny, 1.6) || !clear(P, e.n.x, e.n.y, nx, ny, e.n, nn) ? 0 : 1;
      if (e.fr) reparent(P, e.n, nn);
    }
  }
}

// a node already in the tree looks round for a cheaper parent
function relax(P, rad) {
  const ns = P.nodes;
  const v = ns[floor(Math.random() * ns.length)];
  if (v === P.root) return;
  const r2 = rad * rad;
  let bc = v.cost - 0.4;
  let bp = null;
  for (const u of ns) {
    if (u === v || u === v.par) continue;
    const dx = u.x - v.x;
    const dy = u.y - v.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    const c = u.cost + sqrt(d2);
    if (c < bc && u.kids.length < P.mk && fanOk(P, u, v.x, v.y, v) && !segHit(P, u.x, u.y, v.x, v.y, 1.2) && clear(P, u.x, u.y, v.x, v.y, u, v)) {
      bc = c;
      bp = u;
    }
  }
  if (bp) reparent(P, v, bp);
}

function distPath(pp, x, y) {
  let best = 1e9;
  for (let i = 0; i + 1 < pp.length; i++) {
    const ax = pp[i][0];
    const ay = pp[i][1];
    const ex = pp[i + 1][0] - ax;
    const ey = pp[i + 1][1] - ay;
    const l2 = ex * ex + ey * ey;
    let t = l2 > 1e-9 ? ((x - ax) * ex + (y - ay) * ey) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = hypot(x - ax - ex * t, y - ay - ey * t);
    if (d < best) best = d;
  }
  return best;
}

// over the cap, the most crowded leaf goes first, the ones far from the best path a little sooner;
// young leaves and the ones along the path are spared
function prune(P) {
  while (P.nodes.length > CAP) {
    let wn = null;
    let ws = 1e9;
    for (let pass = 0; pass < 2 && !wn; pass++)
      for (const n of P.nodes) {
        if (n.kids.length || n === P.root) continue;
        const dp = P.pp.length > 1 ? distPath(P.pp, n.x, n.y) : 30;
        if (pass === 0 && (n.age < 3 || dp < 5)) continue;
        let nd = 1e9;
        for (const m of P.nodes) {
          if (m === n) continue;
          const dx = m.x - n.x;
          const dy = m.y - n.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < nd) nd = d2;
        }
        const s = sqrt(nd) - 0.04 * dp;
        if (s < ws) {
          ws = s;
          wn = n;
        }
      }
    if (!wn) break;
    kill(P, wn);
  }
}

// ---- the best path to the goal, and the robot on it
function findPath(P) {
  const g = P.goal;
  let best = null;
  let bc = 1e9;
  const R2 = GOALR * GOALR;
  for (const n of P.nodes) {
    const dx = g.x - n.x;
    const dy = g.y - n.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > R2) continue;
    const c = n.cost + sqrt(d2);
    if (c < bc && !segHit(P, n.x, n.y, g.x, g.y, 0.9)) {
      bc = c;
      best = n;
    }
  }
  P.conn = !!best;
  const pb = P.pbest;
  if (best && best !== P.root && pb && !pb.dead && pb !== best && pb !== P.root) {
    const dx = g.x - pb.x;
    const dy = g.y - pb.y;
    const c = pb.cost + hypot(dx, dy);
    if (c < bc + 0.8 && dx * dx + dy * dy <= R2 && !segHit(P, pb.x, pb.y, g.x, g.y, 0.9)) best = pb;
  }
  if (!best) {
    let bd = 1e9;
    for (const n of P.nodes) {
      const dx = g.x - n.x;
      const dy = g.y - n.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) {
        bd = d2;
        best = n;
      }
    }
  }
  P.pbest = best;
  const path = [];
  for (let m = best, i = 0; m && m !== P.root && i < 400; m = m.par, i++) path.push(m);
  path.reverse();
  P.path = path;
  const pp = [[P.root.x, P.root.y]];
  for (const m of path) pp.push([m.x, m.y]);
  if (P.conn) pp.push([g.x, g.y]);
  P.pp = pp;
}

// the robot stands on the edge between the node it left and the next one on the path, so it is the root
// and holds those two; reaching a node, it hands everything else that hung from it to that node
function hop(P, c, c2) {
  const r = P.root;
  for (const k of r.kids.slice()) if (k !== c) setParent(k, c);
  if (c2 && c2.par === c) setParent(c2, r);
}

function newGoal(P) {
  const r = P.root;
  let bx = 32;
  let by = 64;
  let bs = -1;
  for (let i = 0; i < 16; i++) {
    const x = 6 + 52 * Math.random();
    const y = 6 + 116 * Math.random();
    if (segHit(P, x, y, x, y, 7)) continue;
    const s = min(hypot(x - r.x, y - r.y), 80) + 14 * Math.random();
    if (s > bs) {
      bs = s;
      bx = x;
      by = y;
    }
  }
  P.goal = { x: bx, y: by };
  P.ga = 0;
  P.pbest = null;
}

function moveRobot(P, d) {
  let left = SPEED * d;
  for (let it = 0; it < 12 && left > 1e-6; it++) {
    const r = P.root;
    const nxt = P.path.length ? P.path[0] : null;
    const tx = nxt ? nxt.x : P.goal.x;
    const ty = nxt ? nxt.y : P.goal.y;
    const dx = tx - r.x;
    const dy = ty - r.y;
    const dist = hypot(dx, dy);
    if (dist <= left) {
      r.x = tx;
      r.y = ty;
      left -= dist;
      if (nxt) {
        hop(P, nxt, P.path[1]);
        P.path.shift();
      } else {
        P.pings.push({ x: P.goal.x, y: P.goal.y, age: 0 });
        newGoal(P);
        break;
      }
    } else {
      r.x += (dx / dist) * left;
      r.y += (dy / dist) * left;
      left = 0;
    }
  }
}

function setup(P) {
  Object.assign(P, {
    t: 0,
    nodes: [],
    dying: [],
    ghosts: [],
    pings: [],
    trail: [],
    obs: [],
    path: [],
    pp: [],
    nb: [],
    conn: false,
    pbest: null,
    root: null,
    goal: { x: 32, y: 64 },
    ga: 0,
    acc: 0,
    acr: 0,
    stamp: 0,
    mk: 3,
    fc: 0.9,
    k1: 0,
    snap: true,
    warm: false,
    lut: new Float32Array(256 * 3),
    buf: new Float32Array(W * H * 3),
  });
  for (let i = 0; i < NOBS; i++) P.obs.push(newObs());
}

function knobs(P, input) {
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  const k2 = cl(k[1], 0.3, 3);
  const g = k2 <= 2 ? 0.3 * pow(1 / 0.3, (k2 - 0.3) / 1.7) : pow(3, k2 - 2);
  const k4 = cl(k[3], -1, 1);
  P.k1 = k[0];
  // the wider the Rewire, the more children a node may carry and the closer together they may leave it
  const w = sm(0.2, 1, k4);
  P.mk = 3 + 2 * w;
  P.fc = 0.9 + 0.06 * w;
  return { g, k3: cl(k[2], -1, 1), rad: 7.4 * pow(3.3, (k4 + 1) / 2) };
}

function advance(P, d, k) {
  P.t += d;
  stepObs(P, d, k);
  P.snap = false;
  const g = P.goal;
  if (segHit(P, g.x, g.y, g.x, g.y, 3)) newGoal(P);
  eject(P);
  cutEdges(P);
  recost(P);
  findPath(P);
  moveRobot(P, d);
  recost(P);
  // the tree
  P.acc += 60 * k.g * d;
  P.acr += 120 * k.g * d;
  while (P.acc >= 1) {
    P.acc -= 1;
    grow(P, k.rad);
  }
  while (P.acr >= 1) {
    P.acr -= 1;
    relax(P, k.rad);
  }
  findPath(P);
  prune(P);
  // what the eye follows
  const rt = P.root;
  const tr = P.trail;
  if (!tr.length || hypot(tr[tr.length - 1].x - rt.x, tr[tr.length - 1].y - rt.y) > 0.5) tr.push({ x: rt.x, y: rt.y, age: 0 });
  for (const q of tr) q.age += d;
  while (tr.length && tr[0].age > 1.6) tr.shift();
  const ek = 1 - exp(-d / 0.3);
  for (const n of P.nodes) {
    n.age += d;
    n.g = min(1, n.g + d / 0.22);
    n.ea = min(1, n.ea + d / 0.3);
    n.dc += (n.cost - n.dc) * ek;
  }
  for (const n of P.dying) n.a -= d / 0.4;
  P.dying = P.dying.filter((n) => n.a > 0);
  for (const q of P.ghosts) q.a -= d / 0.3;
  P.ghosts = P.ghosts.filter((q) => q.a > 0);
  for (const q of P.pings) q.age += d;
  P.pings = P.pings.filter((q) => q.age < 1);
  P.ga = min(1, P.ga + d / 0.6);
}

export function update(dt, input, P) {
  if (!P.nodes) setup(P);
  const k = knobs(P, input);
  if (!P.warm) {
    P.warm = true;
    P.root = mkNode(32, 64, null, 0);
    P.root.g = 1;
    P.nodes.push(P.root);
    stepObs(P, 0, k);
    // a root clear of the blobs
    for (let i = 0; i < 40; i++) {
      P.root.x = 8 + 48 * Math.random();
      P.root.y = 8 + 112 * Math.random();
      if (!segHit(P, P.root.x, P.root.y, P.root.x, P.root.y, 8)) break;
    }
    newGoal(P);
    // open on a tree that has been growing for a while
    const T = cl(700 / (60 * k.g), 10, 60);
    const n = ceil(T * 30);
    for (let i = 0; i < n; i++) advance(P, 1 / 30, k);
    for (let i = 0; i < 3000 && P.nodes.length < 0.85 * CAP; i++) advance(P, 1 / 30, k);
    for (const nd of P.nodes) {
      nd.age = 9;
      nd.dc = nd.cost;
    }
    P.trail.length = 0;
  }
  const d = min(max(dt || 0, 0), 0.1);
  const sub = ceil(d / (1 / 30));
  for (let i = 0; i < sub; i++) advance(P, d / sub, k);
}

// ---- drawing
function over(buf, p, r, g, b, a) {
  buf[p] += (r - buf[p]) * a;
  buf[p + 1] += (g - buf[p + 1]) * a;
  buf[p + 2] += (b - buf[p + 2]) * a;
}

function line(P, x0, y0, x1, y1, hw, c0, c1, a, bright) {
  if (a <= 0.003) return;
  const buf = P.buf;
  const lut = P.lut;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  const xa = max(0, floor(min(x0, x1) - hw - 1));
  const xb = min(W - 1, ceil(max(x0, x1) + hw + 1));
  const ya = max(0, floor(min(y0, y1) - hw - 1));
  const yb = min(H - 1, ceil(max(y0, y1) + hw + 1));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - x0;
      const py = y + 0.5 - y0;
      let t = l2 > 1e-9 ? (px * dx + py * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = px - dx * t;
      const ey = py - dy * t;
      const cov = hw + 0.5 - sqrt(ex * ex + ey * ey);
      if (cov <= 0) continue;
      const c = c0 + (c1 - c0) * t;
      const i = cl(floor(c * (255 / CS)), 0, 255) * 3;
      const w = 0.5 + 0.5 * sin(TAU * (c / 32 - P.t * 0.45));
      const sh = bright * (0.8 + 0.42 * w * w);
      over(buf, (y * W + x) * 3, lut[i] * sh, lut[i + 1] * sh, lut[i + 2] * sh, a * (cov > 1 ? 1 : cov));
    }
}

function disc(P, cx, cy, r, cr, cg, cb, a) {
  const buf = P.buf;
  const xa = max(0, floor(cx - r - 1));
  const xb = min(W - 1, ceil(cx + r + 1));
  const ya = max(0, floor(cy - r - 1));
  const yb = min(H - 1, ceil(cy + r + 1));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const cov = r + 0.5 - hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (cov > 0) over(buf, (y * W + x) * 3, cr, cg, cb, a * (cov > 1 ? 1 : cov));
    }
}

function glow(P, cx, cy, r, cr, cg, cb, a) {
  const buf = P.buf;
  const s2 = r * r * 0.5;
  const xa = max(0, floor(cx - 2.6 * r));
  const xb = min(W - 1, ceil(cx + 2.6 * r));
  const ya = max(0, floor(cy - 2.6 * r));
  const yb = min(H - 1, ceil(cy + 2.6 * r));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      over(buf, (y * W + x) * 3, cr, cg, cb, a * exp(-(dx * dx + dy * dy) / s2));
    }
}

function ring(P, cx, cy, R, hw, cr, cg, cb, a) {
  const buf = P.buf;
  const m = R + hw + 2;
  const xa = max(0, floor(cx - m));
  const xb = min(W - 1, ceil(cx + m));
  const ya = max(0, floor(cy - m));
  const yb = min(H - 1, ceil(cy + m));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const cov = hw + 0.5 - abs(hypot(x + 0.5 - cx, y + 0.5 - cy) - R);
      if (cov > 0) over(buf, (y * W + x) * 3, cr, cg, cb, a * (cov > 1 ? 1 : cov));
    }
}

function drawObs(P) {
  const buf = P.buf;
  for (const o of P.obs) {
    if (o.s < 0.04) continue;
    const m = max(o.a, o.b) + 5;
    const xa = max(0, floor(o.x - m));
    const xb = min(W - 1, ceil(o.x + m));
    const ya = max(0, floor(o.y - m));
    const yb = min(H - 1, ceil(o.y + m));
    const A2 = o.a * o.a;
    const B2 = o.b * o.b;
    for (let y = ya; y <= yb; y++)
      for (let x = xa; x <= xb; x++) {
        const dx = x + 0.5 - o.x;
        const dy = y + 0.5 - o.y;
        const u = dx * o.co + dy * o.si;
        const v = dy * o.co - dx * o.si;
        const gg = sqrt((u * u) / A2 + (v * v) / B2);
        const gr = sqrt((u * u) / (A2 * A2) + (v * v) / (B2 * B2));
        const sd = gr > 1e-9 ? ((gg - 1) * gg) / gr : -1; // distance to the rim, LED, minus inside
        const p = (y * W + x) * 3;
        const fill = cl(0.5 - sd, 0, 1);
        if (fill > 0) over(buf, p, 3, 4, 11, fill);
        const rim = cl(1 - abs(sd) / 0.95, 0, 1);
        const halo = sd > 0 ? exp(-sd / 2.4) * 0.16 : 0;
        const ra = rim * 0.78 + halo;
        if (ra > 0.004) over(buf, p, 92, 118, 205, min(1, ra));
      }
  }
}

export function draw(display, P) {
  if (!P.nodes || !P.root) return;
  buildLut(P, P.k1);
  const buf = P.buf;
  for (let i = 0; i < W * H; i++) {
    buf[i * 3] = BG[0];
    buf[i * 3 + 1] = BG[1];
    buf[i * 3 + 2] = BG[2];
  }
  drawObs(P);
  for (const q of P.ghosts) line(P, q.ax, q.ay, q.bx, q.by, 0.85, q.c0, q.c1, q.a * 0.55, 0.9);
  const all = P.dying.concat(P.nodes);
  for (const n of all) {
    const p = n.par;
    if (!p) continue;
    const g = sm(0, 1, n.g);
    const ex = p.x + (n.x - p.x) * g;
    const ey = p.y + (n.y - p.y) * g;
    line(P, p.x, p.y, ex, ey, 0.85, p.dc, p.dc + (n.dc - p.dc) * g, n.a * n.ea, 1);
  }
  const lut = P.lut;
  for (const n of all) {
    const leaf = n.kids.length === 0;
    const i = cl(floor(n.dc * (255 / CS)), 0, 255) * 3;
    const w = leaf ? 0.6 : 0.3;
    const g = n.g * n.g;
    disc(P, n.x, n.y, leaf ? 1.35 : 1.1, lut[i] + (255 - lut[i]) * w, lut[i + 1] + (255 - lut[i + 1]) * w, lut[i + 2] + (255 - lut[i + 2]) * w, 0.95 * g * n.a);
  }
  // a dark clearing round the robot, where the branches meet, and the best path across it
  const rb0 = P.root;
  disc(P, rb0.x, rb0.y, 4, 4, 6, 18, 0.55);
  const pp = P.pp;
  for (let i = 0; i + 1 < pp.length; i++) glowLine(P, pp[i][0], pp[i][1], pp[i + 1][0], pp[i + 1][1], 2, 255, 226, 190, 0.11);
  for (let i = 0; i + 1 < pp.length; i++) glowLine(P, pp[i][0], pp[i][1], pp[i + 1][0], pp[i + 1][1], 1.1, 255, 238, 212, 0.97);
  // the goal
  const gl = P.goal;
  const pulse = 0.5 + 0.5 * sin(P.t * 2.9);
  glow(P, gl.x, gl.y, 5, 255, 214, 130, 0.13 * P.ga);
  ring(P, gl.x, gl.y, 4.2 + 1.3 * pulse, 0.85, 255, 222, 150, (0.62 + 0.3 * pulse) * P.ga);
  for (const q of P.pings) {
    const u = q.age;
    ring(P, q.x, q.y, 4.5 + 10 * u, 0.8, 255, 222, 150, 0.7 * (1 - u) * (1 - u));
  }
  // the robot and its tail
  const tr = P.trail;
  for (let i = 0; i + 1 < tr.length; i++) {
    const f = 1 - tr[i].age / 1.6;
    glowLine(P, tr[i].x, tr[i].y, tr[i + 1].x, tr[i + 1].y, 0.5 + 0.8 * f, 255, 244, 225, 0.55 * f * f);
  }
  const rb = P.root;
  glow(P, rb.x, rb.y, 2.6, 255, 244, 224, 0.4);
  disc(P, rb.x, rb.y, 2.3, 255, 252, 244, 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      display.setPixel(x, y, min(255, buf[p]) | 0, min(255, buf[p + 1]) | 0, min(255, buf[p + 2]) | 0);
    }
}

// a flat-coloured line
function glowLine(P, x0, y0, x1, y1, hw, cr, cg, cb, a) {
  if (a <= 0.003) return;
  const buf = P.buf;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  const xa = max(0, floor(min(x0, x1) - hw - 1));
  const xb = min(W - 1, ceil(max(x0, x1) + hw + 1));
  const ya = max(0, floor(min(y0, y1) - hw - 1));
  const yb = min(H - 1, ceil(max(y0, y1) + hw + 1));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - x0;
      const py = y + 0.5 - y0;
      let t = l2 > 1e-9 ? (px * dx + py * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = px - dx * t;
      const ey = py - dy * t;
      const cov = hw + 0.5 - sqrt(ex * ex + ey * ey);
      if (cov > 0) over(buf, (y * W + x) * 3, cr, cg, cb, a * (cov > 1 ? 1 : cov));
    }
}
