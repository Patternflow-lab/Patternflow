// ===== Patternflow pattern =====
// Title:   Rich Get Richer
// Family:  attachment
// Idea:    A network grows over the standing panel by preferential attachment, a new node flying in from the edge about once a second to link to the nodes that already hold the most links, so a few swell into glowing hubs with rays of spokes, while old nodes fade out and their links melt, a hub now and then fails and its leaves rewire, and the layout keeps floating into a constellation that does not come back.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: cumulative advantage and the Yule process (Yule 1925, Simon 1955, Price 1965 and 1976), the Matthew effect (Merton 1968), growth by preferential attachment (Barabasi and Albert 1999) with an initial attractiveness (Dorogovtsev, Mendes and Samukhin 2000), a fitness (Bianconi and Barabasi 2001) and an ageing of nodes (Dorogovtsev and Mendes 2000), hubs lost by attack (Albert, Jeong and Barabasi 2000), the spring layout (Eades 1984, Fruchterman and Reingold 1991). All from memory. The turnover, the rewiring, the loop count, the founders of new clusters, the numbers and the colours are original, pattern round 268.
// Round:   268
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.5..4, Preference=-1..1, Links=-1..1
//
// Knob 1: Hue. Added to the hue, so it turns every colour once round the wheel at the same lightness. At 0 young nodes are cyan, old ones indigo and violet, hub halos pink; at 0.5 yellow and green with a salmon halo; at 0.75 green and teal. Oranges and yellows are lifted so that they do not go brown.
// Knob 2: Pace. How fast the network lives. New nodes come 0.25 a second at 0.5, 1 a second at 2 and 2 a second at 4, and the node count is held, so a node lasts about 70 s at 2, 4.5 minutes at 0.5 and 35 s at 4 (a hub longer). The layout settles at the square root of that speed: at the top flights are quick and flashes crowd, at the bottom the picture hangs for seconds between arrivals.
// Knob 3: Preference. How much the rich win: a link goes to a node with weight (links + a) to the power g. g is 0 at -1, so every node is as likely as any other and the picture is a flat web of equal small nodes (no node over 11 links in 600 s). g is 1.6 where it opens, with about 2 nodes of 8 links or more at a time, each lasting a minute or so, and 2.1 at 1, with 3 to 4 of them up to the cap of 18 and 9 fewer nodes. Turned live it takes hold in 20 to 25 s.
// Knob 4: Links. How many links a newcomer makes, a real number whose fraction is a chance: 1 at -1 (a tree, branching sprays), 1.3 where it opens, 1.84 at 0.5, 3 at 1 (triangles and lattices, 10 fewer nodes). Loops are held to 0.9 of (m - 1) a node by adding short links or dropping the longest loop link, so the mesh follows the knob in 15 to 20 s.
//
// What the picture is. A dark ground with a faint vignette and 62 to 78 nodes in a soft ellipse wider than the panel, 50 to 55 of them in view, so links run in from its edges and the picture is a window onto a larger net. A node is a soft disc from 1.8 LED in radius with one link to 5.8 with many, coloured by age from near-white through cyan to indigo; a hub also gets a white core and a pink halo that breathes. A link is 2 LED wide with soft sides, dim at a leaf and brighter toward a hub, so a hub reads as a star and its links as rays. A new node arrives white and cools over a second, its links flashing, and the node it joined flares. A node that goes shrinks and fades over 1.5 s while its links retract into the nodes that stay.
// What is modelled. A newcomer links to 1 to 3 old nodes by weight: a fitness (0.55 to 2) times (links + a) to the g, times (1 + age / 45) to the minus a half, tapering to nothing between 12 and 18 links; age is counted in arrivals. The first link goes by weight alone, later ones also by closeness (weight times 1 / (1 + (d / 20)^2)) and stay in the first one's cluster 78 times in 100. In 4 arrivals in 100 a lone founder comes instead, with 25 times the weight for 30 arrivals, so a second cluster may start. Each arrival is followed by removals while the count is over target: the oldest, least linked of six nodes tried, and in 2.2 removals in 100 the biggest hub if it has 7 links or more. A node left with no link takes a new one (6 in 10) or goes. About 0.6 links an arrival are also moved one end at a time by the same weights. The layout is a spring embedder: every pair repels, big nodes more (size to the 1.6), a link is a spring of rest length 8 LED plus the two radii with a stiffness cut by the links on its ends, a soft elliptic wall and a hard stop keep nodes in, and the centre wanders a few LED on periods from 97 to 363 s. The first update grows a network at 7 arrivals a second, turns it over for about 37 s and settles it for 5 s, at the knobs it is given.
// What is made up. Every rate and weight above, the founders, the loop count, the relative size of a node (links over 0.6 of the mean plus 0.4, so a mesh is not all hubs), the sizes, colours, flashes and halo. It is not a clean Barabasi and Albert graph: closeness, rewiring and the loop count bend the degree distribution away from a power law, and 60 nodes are far too few to measure one. Turnover is not in those models: here a removal follows each arrival to hold the count, which is what lets a hub age out and a new one rise.

const W = 64, H = 128;
const { floor, ceil, sqrt, exp, sin, cos, atan2, pow, min, max, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

const CX0 = 32, CY0 = 64;      // the middle of the panel
const RX = 38, RY = 72;        // semi-axes of the soft boundary the node centres stay in, a little wider than the panel
const CAP = 18;                // most links a hub may hold
const KREP = 14, CUT = 40, RM = 2.2, GAP = 4.5, KCOL = 14;  // repulsion, its reach, size offset, gap between discs, contact stiffness
const KS = 9, L0 = 8, LK = 0.95;                           // spring, rest length = L0 + LK * (r1 + r2)
const DAMP = 4.2, VMAX = 30, KW = 140, KG = 3;             // velocity damping, speed cap, wall, gravity
const BRIDGE = 0.22;                                       // how often a link may join two separate clusters
const HUB_FROM = 1.8, HUB_TO = 4.6;                        // links over a share of the mean where a node starts and finishes counting as a hub

export function setup(params) {
  params.s = {
    k: [0, 2, 0, 0.06], kk: [0, 2, 0, 0.06], init: false, t: 0,
    nodes: [], edges: [], gen: 0, arAcc: 0, rgAcc: 0, rewAcc: 0,
    gamma: 1, aoff: 1.2, m: 1.6, lam: 1, S: 1, hue: 0.52, nT: 62, wob: 0, md: 2, mds: 2,
    wt: new Float32Array(256), seen: new Int32Array(256), queue: new Int32Array(256),
    buf: new Float32Array(W * H * 3), hz: new Float32Array(17 * 33 * 3), bg: null,
  };
  const bg = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ex = (x + 0.5 - CX0) / 36, ey = (y + 0.5 - CY0) / 70;
      bg[y * W + x] = 1 - 0.55 * (ex * ex + ey * ey);
    }
  params.s.bg = bg;
}

function readKnobs(s, input, dt, first) {
  const kv = (input && input.knobValues) || s.k;
  for (let i = 0; i < 4; i++) if (typeof kv[i] === "number" && isFinite(kv[i])) s.k[i] = kv[i];
  const a = first ? 1 : min(1, dt / 0.6);
  for (let i = 0; i < 4; i++) s.kk[i] += (s.k[i] - s.kk[i]) * a;
  const kk = s.kk;
  s.hue = 0.52 + kk[0];
  const pace = cl(kk[1], 0.5, 4);
  s.lam = 0.5 * pace;
  s.S = sqrt(pace / 2);
  const p = cl(kk[2], -1, 1);
  s.gamma = p < 0 ? 1.6 + 1.6 * p : 1.6 + 0.5 * p;
  s.aoff = 1.2 - 0.5 * p;
  const u = (cl(kk[3], -1, 1) + 1) / 2;
  s.m = 1 + 2 * pow(u, 3);
  s.nT = 70 - 6 * (s.m - 1.6) - 9 * max(0, p) + s.wob;
}

// ---- the graph
function mkNode(s, x, y, fit) {
  const nd = {
    x, y, vx: 0, vy: 0, fx: 0, fy: 0, r: 0.8, al: 0, dying: false, dieT: 0, deg: 0, dsm: 0, born: s.gen,
    fit: fit || cl(exp(0.45 * gauss()), 0.55, 2), fl: 1, hj: 0.02 * gauss(), ph: rnd() * 6.2832,
    cr: 0, cg: 0, cb: 0, hub: 0, ix: 0, rel: 0, seed: 0, fresh: false,
  };
  nd.fresh = true;
  s.nodes.push(nd);
  return nd;
}

function link(s, a, b, from, grow) {
  s.edges.push({ a, b, from, to: from === a ? b : a, g: grow ? 0.04 : 1, alive: true, fl: 1 });
}

function adjacent(s, a, b) {
  for (const e of s.edges) if (e.alive && ((e.a === a && e.b === b) || (e.a === b && e.b === a))) return true;
  return false;
}

function countDeg(s) {
  const nodes = s.nodes;
  for (let i = 0; i < nodes.length; i++) nodes[i].deg = 0;
  let tot = 0, live = 0;
  for (const e of s.edges)
    if (e.alive) {
      e.a.deg++;
      e.b.deg++;
      tot += 2;
    }
  for (let i = 0; i < nodes.length; i++) if (!nodes[i].dying) live++;
  s.md = tot / max(1, live);
}

function liveCount(s) {
  let n = 0;
  for (const nd of s.nodes) if (!nd.dying) n++;
  return n;
}

// the weight of a node as a target: (links + a) to the gamma, a fitness, a slow loss with age, a taper to the cap
function weight(s, nd) {
  const d = nd.deg;
  if (nd.dying || d >= CAP) return 0;
  const age = s.gen - nd.born;
  const tap = d <= CAP - 6 ? 1 : sm(CAP, CAP - 6, d);
  const founder = nd.seed ? 1 + 24 * min(1, s.gamma) * max(0, 1 - age / 30) : 1;
  return nd.fit * founder * pow(d + s.aoff, s.gamma) * pow(1 + age / 45, -0.5) * tap * (0.3 + 0.7 * nd.al);
}

// a target by those weights times a closeness to (px, py) when lc > 0; skip is a node or null, adj a node whose neighbours are out, comp a component label or -1 (components() must have run)
function pickTarget(s, px, py, lc, skip, adj, comp) {
  const nodes = s.nodes, wt = s.wt;
  let tot = 0;
  for (let i = 0; i < nodes.length; i++) {
    const nd = nodes[i];
    let w = nd === skip || (comp >= 0 && s.seen[i] !== comp) ? 0 : weight(s, nd);
    if (w > 0 && adj && adjacent(s, adj, nd)) w = 0;
    if (w > 0 && lc > 0) {
      const dx = nd.x - px, dy = nd.y - py;
      w *= 1 / (1 + (dx * dx + dy * dy) / (lc * lc)) + 0.03;
    }
    wt[i] = w;
    tot += w;
  }
  if (tot <= 0) return null;
  let r = rnd() * tot;
  for (let i = 0; i < nodes.length; i++) {
    r -= wt[i];
    if (r <= 0 && wt[i] > 0) return nodes[i];
  }
  return null;
}

function ctr(s) {
  return [CX0 + 3.2 * sin(0.0647 * s.t + 1.1) + 1.6 * sin(0.0291 * s.t), CY0 + 5 * sin(0.0413 * s.t + 0.4) + 2.5 * sin(0.0173 * s.t + 2)];
}

// components of the live graph: fills s.seen with a label, returns how many
function components(s, skipEdge) {
  const nodes = s.nodes, seen = s.seen, q = s.queue;
  for (let i = 0; i < nodes.length; i++) {
    seen[i] = -1;
    nodes[i].ix = i;
  }
  let c = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (seen[i] >= 0 || nodes[i].dying) continue;
    let h = 0, t = 0;
    q[t++] = i;
    seen[i] = c;
    while (h < t) {
      const nd = nodes[q[h++]];
      for (const e of s.edges) {
        if (!e.alive || e === skipEdge) continue;
        const o = e.a === nd ? e.b : e.b === nd ? e.a : null;
        if (o && seen[o.ix] < 0 && !o.dying) {
          seen[o.ix] = c;
          q[t++] = o.ix;
        }
      }
    }
    c++;
  }
  return c;
}

function arrive(s) {
  if (s.nodes.length > 200) return;
  const [cx, cy] = ctr(s);
  s.gen++;
  const live = liveCount(s);
  countDeg(s);
  const spawn = (th) => [cx + 1.08 * RX * cos(th), cy + 1.08 * RY * sin(th)];
  if (live < 2 || rnd() < 0.04) {
    // a new seed: a lone node out at an edge, with the weight of a young hub for a while so that a second cluster may start
    let th = rnd() * 6.2832;
    if (live > 0) {
      let best = -1;
      for (let q = 0; q < 8; q++) {
        const t2 = rnd() * 6.2832, p = spawn(t2);
        let dm = 1e9;
        for (const nd of s.nodes) dm = min(dm, (nd.x - p[0]) * (nd.x - p[0]) + (nd.y - p[1]) * (nd.y - p[1]));
        if (dm > best) { best = dm; th = t2; }
      }
    }
    const p = spawn(th);
    const nd = mkNode(s, p[0], p[1], 1);
    nd.seed = 1;
    if (live === 0) {
      nd.x = cx; nd.y = cy; nd.al = 1; nd.r = 2;
    }
    return;
  }
  let nl = floor(s.m) + (rnd() < s.m - floor(s.m) ? 1 : 0);
  nl = cl(nl, 1, 3);
  const t1 = pickTarget(s, 0, 0, 0, null, null, -1);
  if (!t1) return;
  components(s, null);
  let th = atan2((t1.y - cy) / RY, (t1.x - cx) / RX);
  if (abs(t1.x - cx) + abs(t1.y - cy) < 6) th = rnd() * 6.2832;
  th += 0.4 * gauss();
  const p = spawn(th);
  const nd = mkNode(s, p[0], p[1]);
  link(s, nd, t1, nd, false);
  t1.fl = max(t1.fl, 0.55);
  for (let k = 1; k < nl; k++) {
    nd.deg = 0;
    const t = pickTarget(s, p[0] * 0.6 + t1.x * 0.4, p[1] * 0.6 + t1.y * 0.4, 20, nd, nd, rnd() < BRIDGE ? -1 : s.seen[t1.ix]);
    if (!t || t === t1) continue;
    let dup = false;
    for (const e of s.edges) if (e.alive && e.a === nd && e.b === t) dup = true;
    if (dup) continue;
    link(s, nd, t, nd, false);
    t.fl = max(t.fl, 0.55);
    nd.deg++;
  }
}

function startRemove(s, nd) {
  if (nd.dying) return;
  nd.dying = true;
  nd.dieT = 1.5;
  const nb = [];
  for (const e of s.edges)
    if (e.alive && (e.a === nd || e.b === nd)) {
      e.alive = false;
      e.from = e.a === nd ? e.b : e.a;
      e.to = nd;
      nb.push(e.from);
    }
  countDeg(s);
  // a node left with no link either reaches for a new one or goes with it
  for (const o of nb) {
    if (o.deg > 0 || o.dying) continue;
    if (rnd() < 0.6) {
      const t = pickTarget(s, o.x, o.y, 34, o, null, -1);
      if (t) {
        link(s, o, t, o, true);
        t.fl = max(t.fl, 0.5);
        o.fl = 0.8;
        o.deg = 1;
        t.deg++;
      } else startRemove(s, o);
    } else startRemove(s, o);
  }
}

// the oldest, least linked node out of a handful; now and then the biggest hub (a failure)
function trim(s) {
  countDeg(s);
  let live = 0;
  for (const nd of s.nodes) if (!nd.dying) live++;
  let guard = 0;
  while (live > s.nT && guard++ < 4) {
    let victim = null;
    if (rnd() < 0.022) {
      let dm = 0;
      for (const nd of s.nodes) if (!nd.dying && nd.deg > dm) { dm = nd.deg; victim = nd; }
      if (dm < 7) victim = null;
    }
    if (!victim) {
      let best = -1;
      for (let q = 0; q < 6; q++) {
        const nd = s.nodes[floor(rnd() * s.nodes.length)];
        if (nd.dying || s.gen - nd.born < 6) continue;
        const sc = (s.gen - nd.born) / pow(nd.deg + 0.7, 0.9) * (0.7 + 0.6 * rnd());
        if (sc > best) { best = sc; victim = nd; }
      }
    }
    if (!victim) break;
    startRemove(s, victim);
    countDeg(s);
    live = liveCount(s);
  }
}

// move one end of one link: the less linked end keeps it and reaches for a new target; the graph stays in one piece where it was
function rewire(s) {
  const es = s.edges;
  if (es.length < 6) return;
  countDeg(s);
  for (let q = 0; q < 8; q++) {
    const e = es[floor(rnd() * es.length)];
    if (!e.alive || e.g < 1) continue;
    const u = e.a.deg <= e.b.deg ? e.a : e.b, v = u === e.a ? e.b : e.a;
    if (u.deg < 2 || u.dying || v.dying) continue;
    components(s, e);
    const t = pickTarget(s, u.x, u.y, 30, u, u, rnd() < BRIDGE ? -1 : s.seen[v.ix]);
    if (!t || t === v) continue;
    e.alive = false;
    e.from = u;
    e.to = v;
    link(s, u, t, u, true);
    t.fl = max(t.fl, 0.5);
    return;
  }
}

// keep the number of loops where Links says: add a short link between near nodes, or drop the longest loop edge of a few tried
function regulate(s) {
  countDeg(s);
  const n = liveCount(s);
  let E = 0;
  for (const e of s.edges) if (e.alive) E++;
  const c = components(s, null);
  const cyc = E - (n - c), want = (s.m - 1) * n * 0.9;
  if (cyc > want * 1.1 + 2) {
    let best = null, bl = -1;
    for (let q = 0; q < 6; q++) {
      const e = s.edges[floor(rnd() * s.edges.length)];
      if (!e.alive || e.g < 1) continue;
      components(s, e);
      if (s.seen[e.a.ix] !== s.seen[e.b.ix]) continue;
      const l = (e.a.x - e.b.x) * (e.a.x - e.b.x) + (e.a.y - e.b.y) * (e.a.y - e.b.y);
      if (l > bl) { bl = l; best = e; }
    }
    if (best) {
      best.alive = false;
      best.from = best.a.deg <= best.b.deg ? best.a : best.b;
      best.to = best.from === best.a ? best.b : best.a;
    }
  } else if (cyc < want * 0.9 - 2) {
    for (let q = 0; q < 5; q++) {
      const u = pickTarget(s, 0, 0, 0, null, null, -1);
      if (!u) return;
      const t = pickTarget(s, u.x, u.y, 15, u, u, rnd() < BRIDGE ? -1 : s.seen[u.ix]);
      if (!t) continue;
      const dx = t.x - u.x, dy = t.y - u.y;
      if (dx * dx + dy * dy > 26 * 26) continue;
      link(s, u, t, u, true);
      u.fl = max(u.fl, 0.4);
      t.fl = max(t.fl, 0.4);
      return;
    }
  }
}

// ---- the layout
function physics(s, h) {
  const nodes = s.nodes, n = nodes.length, edges = s.edges;
  const kr = KREP * (1 + 0.35 * max(0, s.mds - 2.5)), dl = 1.6 * max(0, s.mds - 3);
  const [cx, cy] = ctr(s);
  for (let i = 0; i < n; i++) nodes[i].fx = nodes[i].fy = 0;
  for (let i = 0; i < n; i++) {
    const a = nodes[i];
    const ma = (a.r + RM) * (0.25 + 0.75 * a.al);
    for (let j = i + 1; j < n; j++) {
      const b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 > CUT * CUT) continue;
      const d = sqrt(d2) + 0.01;
      const mb = (b.r + RM) * (0.25 + 0.75 * b.al);
      let f = kr * pow(ma * mb / 18, 1.6) * 18 / (d + 3) * (1 - sm(0.55 * CUT, CUT, d));
      const ov = a.r + b.r + GAP - d;
      if (ov > 0) f += KCOL * ov * min(a.al, b.al);
      const ux = dx / d, uy = dy / d;
      a.fx -= f * ux; a.fy -= f * uy;
      b.fx += f * ux; b.fy += f * uy;
    }
  }
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const g = e.alive ? e.g : e.g * e.g;
    if (g < 0.02) continue;
    const a = e.a, b = e.b;
    const dx = b.x - a.x, dy = b.y - a.y, d = sqrt(dx * dx + dy * dy) + 0.01;
    const f = KS * g / pow(0.5 * (a.deg + b.deg) + 0.5, 0.85) * (d - (L0 + LK * (a.r + b.r)) - dl);
    const ux = dx / d, uy = dy / d;
    a.fx += f * ux; a.fy += f * uy;
    b.fx -= f * ux; b.fy -= f * uy;
  }
  const damp = exp(-DAMP * h);
  for (let i = 0; i < n; i++) {
    const a = nodes[i];
    const dx = a.x - cx, dy = a.y - cy;
    a.fx += 7 * sin(0.37 * s.t + a.ph * 3.1);
    a.fy += 7 * cos(0.29 * s.t + a.ph * 1.7);
    const rx = RX - 0.5 * a.r, ry = RY - 0.5 * a.r;
    const gx = dx / (rx * rx), gy = dy / (ry * ry), e = sqrt(dx * dx / (rx * rx) + dy * dy / (ry * ry)) + 1e-6;
    const gl = sqrt(gx * gx + gy * gy) + 1e-9, ov = max(0, e - 0.8), wf = KW * ov + 900 * ov * ov, kg = KG * (1 + 0.05 * a.deg);
    a.fx -= wf * gx / gl + kg * dx / rx;
    a.fy -= wf * gy / gl + kg * dy / ry;
    let vx = a.vx * damp + a.fx * h, vy = a.vy * damp + a.fy * h;
    const v = sqrt(vx * vx + vy * vy);
    if (v > VMAX) { vx *= VMAX / v; vy *= VMAX / v; }
    a.vx = vx; a.vy = vy;
    a.x += vx * h; a.y += vy * h;
    // a hard stop a little outside the soft wall, not for a newcomer on its way in
    const ex = a.x - cx, ey = a.y - cy, q = sqrt(ex * ex / (rx * rx) + ey * ey / (ry * ry));
    if (a.fresh) {
      if (q < 1) a.fresh = false;
    } else if (q > 1.25) {
      a.x = cx + ex * 1.25 / q;
      a.y = cy + ey * 1.25 / q;
      if (a.vx * ex / (rx * rx) + a.vy * ey / (ry * ry) > 0) { a.vx *= 0.3; a.vy *= 0.3; }
    }
  }
}

function life(s, dt) {
  const nodes = s.nodes, edges = s.edges;
  s.mds += (s.md - s.mds) * min(1, 0.5 * dt);
  for (let i = nodes.length - 1; i >= 0; i--) {
    const nd = nodes[i];
    nd.fl *= exp(-dt / 1.0);
    nd.dsm += (nd.deg - nd.dsm) * min(1, 1.8 * dt);
    nd.rel = nd.dsm / (0.6 * s.mds + 0.4);
    const rt = 1.8 + 4 * pow(sm(0, 5.2, nd.rel), 1.15);
    if (nd.dying) {
      nd.dieT -= dt;
      nd.al = max(0, nd.dieT / 1.5);
      nd.r += (0.3 - nd.r) * min(1, 2.2 * dt);
      if (nd.dieT <= 0) nodes.splice(i, 1);
    } else {
      nd.al = min(1, nd.al + dt / 0.4);
      nd.r += (rt - nd.r) * min(1, 2.2 * dt);
    }
  }
  for (let i = edges.length - 1; i >= 0; i--) {
    const e = edges[i];
    e.fl *= exp(-dt / 0.9);
    if (e.alive) e.g = min(1, e.g + dt * 2.2);
    else {
      e.g -= dt / 1.5;
      if (e.g <= 0 || (e.a.dying && e.b.dying && e.a.dieT <= 0)) edges.splice(i, 1);
    }
  }
}

function step(s, h) {
  s.t += h;
  s.arAcc += h * s.lam;
  let guard = 0;
  while (s.arAcc >= 1 && guard++ < 3) {
    s.arAcc -= 1;
    arrive(s);
    trim(s);
    s.rewAcc += 0.45 + 0.4 * (s.gamma - 1) * (s.gamma - 1);
    while (s.rewAcc >= 1) {
      s.rewAcc -= 1;
      rewire(s);
    }
  }
  s.rgAcc += h;
  if (s.rgAcc > 0.35) {
    s.rgAcc = 0;
    regulate(s);
    countDeg(s);
    s.wob = 4 * sin(0.033 * s.t + 0.7) + 3 * sin(0.0197 * s.t + 2.1);
  }
  life(s, h);
  physics(s, h);
}

function init(s, input) {
  s.init = true;
  readKnobs(s, input, 0, true);
  const saveLam = s.lam;
  // grow a young network, let it turn over for a few lifetimes, then settle
  s.lam = 7;
  for (let n = 0; n < 1100; n++) step(s, 1 / 30);
  s.lam = 0;
  for (let n = 0; n < 150; n++) step(s, 1 / 30);
  s.lam = saveLam;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s;
  if (!s.init) init(s, input);
  readKnobs(s, input, dt, false);
  let left = cl(dt || 0, 0, 0.1) * s.S;
  let guard = 0;
  while (left > 1e-4 && guard++ < 6) {
    const h = min(left, 1 / 40);
    left -= h;
    step(s, h);
  }
}

// ---- drawing
function hsv(h, sat, v, o) {
  h -= floor(h);
  const i = floor(h * 6), f = h * 6 - i, p = v * (1 - sat), q = v * (1 - sat * f), t = v * (1 - sat * (1 - f));
  switch (i % 6) {
    case 0: o[0] = v; o[1] = t; o[2] = p; break;
    case 1: o[0] = q; o[1] = v; o[2] = p; break;
    case 2: o[0] = p; o[1] = v; o[2] = t; break;
    case 3: o[0] = p; o[1] = q; o[2] = v; break;
    case 4: o[0] = t; o[1] = p; o[2] = v; break;
    default: o[0] = v; o[1] = p; o[2] = q;
  }
}

// a colour of hue h and saturation sat at luma L
function col(h, sat, L, o) {
  hsv(h, sat, 1, o);
  const dh = abs(h - floor(h) - 0.09), wm = min(dh, 1 - dh) / 0.1;      // oranges and yellows go brown first, so lift them
  L = min(0.95, L * (1 + 0.45 * exp(-wm * wm)));
  const Y = 0.299 * o[0] + 0.587 * o[1] + 0.114 * o[2];
  if (L <= Y) {
    const k = L / Y;
    o[0] *= k; o[1] *= k; o[2] *= k;
  } else {
    const t = (L - Y) / (1 - Y);
    o[0] += t * (1 - o[0]); o[1] += t * (1 - o[1]); o[2] += t * (1 - o[2]);
  }
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  if (!s.init) init(s, null);
  const { buf, hz, bg, nodes, edges } = s;
  const n = nodes.length;
  const o = [0, 0, 0], ac = [0, 0, 0], dens = 1 / (1 + 0.18 * max(0, s.mds - 3));
  col(s.hue + 0.36, 0.7, 0.62, ac);
  // node colours
  for (let i = 0; i < n; i++) {
    const nd = nodes[i];
    const age = cl((s.gen - nd.born) / (1.0 * s.nT), 0, 1.2);
    const f = sm(0, 1, age);
    nd.hub = sm(HUB_FROM, HUB_TO, nd.rel);
    col(s.hue + 0.16 * f + nd.hj, 0.5 + 0.4 * f, 0.76 - 0.34 * f + 0.1 * nd.hub, o);
    const w = 0.3 * nd.hub;
    const fl = pow(nd.fl, 1.3);
    nd.cr = cl(o[0] + w * (ac[0] * 0.5 + 0.5 - o[0]) + fl * (1 - o[0]), 0, 1);
    nd.cg = cl(o[1] + w * (ac[1] * 0.5 + 0.5 - o[1]) + fl * (1 - o[1]), 0, 1);
    nd.cb = cl(o[2] + w * (ac[2] * 0.5 + 0.5 - o[2]) + fl * (1 - o[2]), 0, 1);
  }
  // ground with a faint vignette, tinted by the hue
  col(s.hue + 0.08, 0.7, 0.055, o);
  const br = o[0], bgc = o[1], bb = o[2];
  // haze: a soft glow of every node on a 4 LED grid
  hz.fill(0);
  for (let i = 0; i < n; i++) {
    const nd = nodes[i];
    const amp = 0.075 * dens * nd.al * (0.5 + nd.hub * 1.2 + nd.r * 0.08);
    const gx = nd.x / 4, gy = nd.y / 4;
    const x0 = max(0, floor(gx - 4)), x1 = min(16, ceil(gx + 4)), y0 = max(0, floor(gy - 4)), y1 = min(32, ceil(gy + 4));
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const d2 = (xx - gx) * (xx - gx) + (yy - gy) * (yy - gy);
        const a = amp * exp(-d2 / 5);
        const q = (yy * 17 + xx) * 3;
        hz[q] += a * nd.cr; hz[q + 1] += a * nd.cg; hz[q + 2] += a * nd.cb;
      }
  }
  for (let y = 0; y < H; y++) {
    const gy = (y + 0.5) / 4 - 0.5, y0 = max(0, floor(gy)), ty = gy - y0;
    for (let x = 0; x < W; x++) {
      const gx = (x + 0.5) / 4 - 0.5, x0 = max(0, floor(gx)), tx = gx - x0;
      const q00 = (y0 * 17 + x0) * 3, q10 = q00 + 3, q01 = q00 + 51, q11 = q01 + 3;
      const v = bg[y * W + x], p = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) {
        const hv = (hz[q00 + c] * (1 - tx) + hz[q10 + c] * tx) * (1 - ty) + (hz[q01 + c] * (1 - tx) + hz[q11 + c] * tx) * ty;
        buf[p + c] = (c === 0 ? br : c === 1 ? bgc : bb) * v + hv;
      }
    }
  }
  // edges, each two LED wide with soft sides, brighter toward a hub end
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    if (e.g < 0.02) continue;
    const f = e.from, t = e.to;
    const x0 = f.x, y0 = f.y, x1 = f.x + (t.x - f.x) * e.g, y1 = f.y + (t.y - f.y) * e.g;
    const vx = x1 - x0, vy = y1 - y0, l2 = vx * vx + vy * vy + 1e-6;
    const al = dens / (1 + l2 / 2600) * pow(e.g, 0.7) * min(1, 0.3 + 0.7 * min(f.al, t.al));
    const ef = pow(e.fl, 1.2);
    const bx0 = max(0, floor(min(x0, x1) - 2)), bx1 = min(W - 1, ceil(max(x0, x1) + 2));
    const by0 = max(0, floor(min(y0, y1) - 2)), by1 = min(H - 1, ceil(max(y0, y1) + 2));
    for (let py = by0; py <= by1; py++) {
      const dy = py + 0.5 - y0;
      for (let px = bx0; px <= bx1; px++) {
        const dx = px + 0.5 - x0;
        let u = (dx * vx + dy * vy) / l2;
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        const ex = dx - u * vx, ey = dy - u * vy;
        const d = sqrt(ex * ex + ey * ey);
        if (d > 1.5) continue;
        const c = sm(1.45, 0.4, d) * al;
        const tf = u * e.g;
        const hb = f.hub + (t.hub - f.hub) * tf;
        const bright = 0.3 + 0.5 * pow(hb, 0.8) + 0.9 * ef;
        const cr = f.cr + (t.cr - f.cr) * tf, cg = f.cg + (t.cg - f.cg) * tf, cb = f.cb + (t.cb - f.cb) * tf;
        const wm = min(0.8, ef);
        const q = (py * W + px) * 3;
        const kr = c * min(1, (cr + (1 - cr) * wm) * bright), kg = c * min(1, (cg + (1 - cg) * wm) * bright), kb = c * min(1, (cb + (1 - cb) * wm) * bright);
        buf[q] = 1 - (1 - buf[q]) * (1 - kr);
        buf[q + 1] = 1 - (1 - buf[q + 1]) * (1 - kg);
        buf[q + 2] = 1 - (1 - buf[q + 2]) * (1 - kb);
      }
    }
  }
  // halos of the hubs, in the second colour
  for (let i = 0; i < n; i++) {
    const nd = nodes[i];
    const gl = nd.hub * nd.al;
    if (gl < 0.02) continue;
    const R = nd.r + 6 + nd.dsm * 0.6, sc = 0.42 * R;
    const breath = 0.88 + 0.12 * sin(0.9 * s.t + nd.ph);
    const x0 = max(0, floor(nd.x - R - 4)), x1 = min(W - 1, ceil(nd.x + R + 4)), y0 = max(0, floor(nd.y - R - 4)), y1 = min(H - 1, ceil(nd.y + R + 4));
    for (let py = y0; py <= y1; py++) {
      const dy = py + 0.5 - nd.y;
      for (let px = x0; px <= x1; px++) {
        const dx = px + 0.5 - nd.x, d = sqrt(dx * dx + dy * dy);
        if (d < nd.r - 0.5) continue;
        const a = 0.34 * gl * breath * exp(-max(0, d - nd.r) / sc) * (1 - sm(R * 0.8, R + 4, d));
        const q = (py * W + px) * 3;
        buf[q] = 1 - (1 - buf[q]) * (1 - a * ac[0]);
        buf[q + 1] = 1 - (1 - buf[q + 1]) * (1 - a * ac[1]);
        buf[q + 2] = 1 - (1 - buf[q + 2]) * (1 - a * ac[2]);
      }
    }
  }
  // nodes as soft discs, over the edges
  for (let i = 0; i < n; i++) {
    const nd = nodes[i];
    const r = nd.r;
    if (r < 0.25 || nd.al < 0.01) continue;
    const x0 = max(0, floor(nd.x - r - 2)), x1 = min(W - 1, ceil(nd.x + r + 2)), y0 = max(0, floor(nd.y - r - 2)), y1 = min(H - 1, ceil(nd.y + r + 2));
    for (let py = y0; py <= y1; py++) {
      const dy = py + 0.5 - nd.y;
      for (let px = x0; px <= x1; px++) {
        const dx = px + 0.5 - nd.x, d = sqrt(dx * dx + dy * dy);
        const cov = sm(r + 0.6, r - 0.5, d) * nd.al;
        if (cov <= 0) continue;
        const q2 = d / (r + 0.3), cq = 1 - q2 * q2 > 0 ? 1 - q2 * q2 : 0, lum = 0.78 + 0.25 * cq, wc = 0.62 * nd.hub * cq * cq;
        const q = (py * W + px) * 3;
        buf[q] += (min(1, nd.cr * lum + wc * (1 - nd.cr)) - buf[q]) * cov;
        buf[q + 1] += (min(1, nd.cg * lum + wc * (1 - nd.cg)) - buf[q + 1]) * cov;
        buf[q + 2] += (min(1, nd.cb * lum + wc * (1 - nd.cb)) - buf[q + 2]) * cov;
      }
    }
  }
  for (let p = 0; p < W * H; p++) {
    const q = p * 3;
    display.setPixel(p % W, (p / W) | 0, (min(1, buf[q]) * 255 + 0.5) | 0, (min(1, buf[q + 1]) * 255 + 0.5) | 0, (min(1, buf[q + 2]) * 255 + 0.5) | 0);
  }
}
