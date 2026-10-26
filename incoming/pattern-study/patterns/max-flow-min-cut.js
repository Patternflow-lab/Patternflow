// ===== Patternflow pattern =====
// Title:   Max-Flow Min-Cut
// Family:  algo
// Idea:    A triangular network of pipes, the wide ones holding more, runs from a source bar along the bottom to a sink bar along the top; pulses climb it one shortest augmenting path at a time and fill the pipes cyan until the full ones turn gold, then the nodes the source can still reach fill in as a pool that stops at a jagged line, and the full pipes crossing that line flash while the sink bar splits into their capacities, which add up to exactly the flow that got through.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: max-flow min-cut theorem (Lester R. Ford Jr. and Delbert R. Fulkerson, 1956; Peter Elias, Amiel Feinstein and Claude Shannon, 1956), augmenting along shortest paths (Yefim Dinitz, 1970; Jack Edmonds and Richard Karp, 1972), pattern round 53
// Round:   53
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Columns=7..13, Grain=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the empty pipes are steel blue, flow is cyan, a full pipe is gold and the cut flashes between gold and pale pink. The dim colours, the empty pipes and the pool, lose their saturation between red and lime so they never go brown or olive.
// Knob 2: Speed. At 2 a pulse climbs the panel in a second, the augmenting paths start one after another for five seconds, and a whole run from the first pulse to the next network takes eleven; at 0.2 ten times as long, at 3 two thirds as long.
// Knob 3: Columns. The network is 7 to 13 nodes wide in a triangular lattice: 15 rows, 98 nodes and 251 pipes at 7, and 28 rows, 350 nodes and 970 pipes at 13. Turning it builds a new network.
// Knob 4: Grain. How much of each pipe's capacity is its own random draw rather than the smooth terrain with its wavy band of thin pipes. Near 0 neighbouring pipes hold about the same and the cut follows the band; at 1 the capacities scatter pipe by pipe from 1 to 9, a quarter of them 9 and an eighth 1, and the cut wanders. Turning it drains the flow and runs the same network again on the new capacities.
// Buttons: K1 tap draws new capacities now.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// 1 at the middle of the arc of the wheel from red through orange and
// yellow to lime, 0 outside it.
const warm = (h) => ((h -= floor(h)), h < 0.3 ? sin((PI * h) / 0.3) : 0);
// Rows of nodes run from y = BOT up to y = TOP; the source bar is the two
// bottom rows of LEDs and the sink bar the two top rows.
const TOP = 6, BOT = 121, SRC_Y = 126.5, SINK_Y = 0.5;
// Pulse speed in LEDs per unit of time (Speed 2 runs two units a second).
const V = 70;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The lattice: rows of C and C - 1 nodes in turn, each node tied to its
// neighbours in the row and to the two nearest in the rows above and below.
function build(s, C) {
  const sx = W / C, R = max(4, round((BOT - TOP) / (sx * 0.87)) + 1), sy = (BOT - TOP) / (R - 1);
  const X = [], Y = [], rows = [];
  for (let r = 0; r < R; r++) {
    const odd = r & 1, cnt = odd ? C - 1 : C, ids = [];
    for (let i = 0; i < cnt; i++) {
      let x = 31.5 + sx * (i - (cnt - 1) / 2), y = BOT - r * sy;
      if (r > 0 && r < R - 1) y += (Math.random() - 0.5) * 0.34 * sy;
      x += (Math.random() - 0.5) * 0.34 * sx;
      ids.push(X.length);
      X.push(cl(x, 0.5, 62.5));
      Y.push(y);
    }
    rows.push(ids);
  }
  const eu = [], ev = [];
  for (let r = 0; r < R; r++) {
    const a = rows[r];
    for (let i = 0; i + 1 < a.length; i++) eu.push(a[i]), ev.push(a[i + 1]);
    if (r + 1 < R) {
      const b = rows[r + 1];
      for (let i = 0; i < a.length; i++)
        for (const j of r & 1 ? [i, i + 1] : [i - 1, i]) if (j >= 0 && j < b.length) eu.push(a[i]), ev.push(b[j]);
    }
  }
  const n = X.length, m = eu.length;
  const deg = new Int32Array(n + 1);
  for (let k = 0; k < m; k++) deg[eu[k] + 1]++, deg[ev[k] + 1]++;
  for (let i = 0; i < n; i++) deg[i + 1] += deg[i];
  const adjE = new Int32Array(2 * m), fill = deg.slice(0, n);
  for (let k = 0; k < m; k++) (adjE[fill[eu[k]]++] = k), (adjE[fill[ev[k]]++] = k);
  // Each pipe's samples, one per LED along its longer axis: the LED on that
  // axis (sb), where the line crosses the other axis (sm), the step to the
  // next LED across (ss), and the share of the way from eu to ev (tt).
  const sb = [], sm = [], ss = [], tt = [], off = new Int32Array(m + 1);
  for (let k = 0; k < m; k++) {
    const x1 = X[eu[k]], y1 = Y[eu[k]], dx = X[ev[k]] - x1, dy = Y[ev[k]] - y1, flat = abs(dx) >= abs(dy);
    const steps = max(2, Math.ceil(max(abs(dx), abs(dy))));
    for (let j = 1; j < steps; j++) {
      const t = j / steps, px = x1 + dx * t, py = y1 + dy * t;
      sb.push(flat ? round(px) : round(py) * W);
      sm.push(flat ? py : px);
      ss.push(flat ? W : 1);
      tt.push(t);
    }
    off[k + 1] = sb.length;
  }
  // The node nearest each LED, for the pool the source can reach.
  const near = new Int16Array(N);
  for (let p = 0; p < N; p++) {
    const px = p % W, py = (p / W) | 0;
    let best = 1e9, bi = 0;
    for (let i = 0; i < n; i++) {
      const d = (X[i] - px) ** 2 + (Y[i] - py) ** 2;
      if (d < best) (best = d), (bi = i);
    }
    near[p] = bi;
  }
  const isBot = new Uint8Array(n), isTop = new Uint8Array(n);
  for (const i of rows[0]) isBot[i] = 1;
  for (const i of rows[R - 1]) isTop[i] = 1;
  Object.assign(s, {
    C, n, m, X: Float32Array.from(X), Y: Float32Array.from(Y), eu: Int32Array.from(eu), ev: Int32Array.from(ev),
    deg, adjE, sb: Int32Array.from(sb), sm: Float32Array.from(sm), ss: Int32Array.from(ss), tt: Float32Array.from(tt), off, near,
    bottom: Int32Array.from(rows[0]), isBot, isTop,
    g: new Float32Array(m), e: new Float32Array(m), cap: new Int32Array(m), flow: new Int32Array(m), dcap: new Float32Array(m), dcap0: new Float32Array(m),
    dflow: new Float32Array(m), dflow0: new Float32Array(m), inS: new Uint8Array(n), level: new Int32Array(n), vS: new Uint8Array(n), vLevel: new Int32Array(n),
    dist: new Int32Array(n), prevE: new Int32Array(n), queue: new Int32Array(n), cut: new Uint8Array(m),
  });
}

// Fresh random capacities. Each pipe gets a share g from a smooth terrain
// of a few broad waves, cut by a wavy band of thin pipes somewhere across
// the middle and thickened near the two bars, and a draw of its own, e.
function drawField(s) {
  const w = [];
  for (let i = 0; i < 3; i++) w.push([TAU * Math.random(), (0.03 + 0.07 * Math.random()) * (Math.random() < 0.5 ? -1 : 1), 0.02 + 0.05 * Math.random()]);
  const yc = 44 + 40 * Math.random(), A = 5 + 11 * Math.random(), fx = (TAU * (0.6 + Math.random())) / W, ph = TAU * Math.random(), bw = 7 + 5 * Math.random();
  for (let k = 0; k < s.m; k++) {
    const x = (s.X[s.eu[k]] + s.X[s.ev[k]]) / 2, y = (s.Y[s.eu[k]] + s.Y[s.ev[k]]) / 2;
    let f = 0;
    for (const [a, ax, ay] of w) f += sin(a + ax * x + ay * y) / 3;
    const band = Math.exp(-(((y - yc - A * sin(fx * x + ph)) / bw) ** 2)), bar = cl(1 - min(y - TOP, BOT - y) / 18, 0, 1);
    s.g[k] = 0.6 + 0.3 * f - 0.5 * band + 0.3 * bar;
    s.e[k] = Math.random() - 0.5;
  }
}

function capacities(s, grain) {
  const a = 0.25 + 1.1 * grain;
  for (let k = 0; k < s.m; k++) s.cap[k] = cl(round(1 + 8 * (s.g[k] + a * s.e[k])), 1, 9);
}

// Residual capacity of pipe k leaving node u.
const resid = (s, k, u) => (s.eu[k] === u ? s.cap[k] - s.flow[k] : s.cap[k] + s.flow[k]);

// Breadth-first search from every bottom node at once over pipes with room
// left. Returns the first top node reached, or -1 once the sink is cut off;
// dist then marks the nodes the source still reaches.
function bfs(s) {
  const { dist, prevE, queue, bottom, adjE, deg, eu, ev, isTop } = s;
  dist.fill(-1);
  let h = 0, t = 0;
  // The bottom nodes enter the queue in a new order each search.
  for (const b of bottom) {
    const j = floor(Math.random() * (t + 1));
    queue[t++] = queue[j];
    queue[j] = b;
  }
  for (let i = 0; i < t; i++) (dist[queue[i]] = 0), (prevE[queue[i]] = -1);
  while (h < t) {
    const u = queue[h++];
    if (isTop[u]) return u;
    for (let j = deg[u]; j < deg[u + 1]; j++) {
      const k = adjE[j], v = eu[k] === u ? ev[k] : eu[k];
      if (dist[v] < 0 && resid(s, k, u) > 0) (dist[v] = dist[u] + 1), (prevE[v] = k), (queue[t++] = v);
    }
  }
  return -1;
}

// Edmonds-Karp: augment along a shortest path until none is left, keeping
// every path for the pulses; then read the cut off the last search.
function solve(s) {
  const { eu, ev, adjE, deg, flow } = s;
  flow.fill(0);
  // Shuffle each node's pipes so ties between shortest paths fall anywhere.
  for (let u = 0; u < s.n; u++)
    for (let j = deg[u + 1] - 1; j > deg[u]; j--) {
      const r = deg[u] + floor(Math.random() * (j - deg[u] + 1)), x = adjE[j];
      (adjE[j] = adjE[r]), (adjE[r] = x);
    }
  s.paths = [];
  s.F = 0;
  for (let top; (top = bfs(s)) >= 0; ) {
    const nodes = [top], ks = [];
    let d = 1e9;
    for (let v = top; s.prevE[v] >= 0; ) {
      const k = s.prevE[v], u = eu[k] === v ? ev[k] : eu[k];
      d = min(d, resid(s, k, u));
      ks.push(k);
      nodes.push(u);
      v = u;
    }
    nodes.reverse();
    ks.reverse();
    const sg = new Int8Array(ks.length);
    ks.forEach((k, i) => {
      sg[i] = eu[k] === nodes[i] ? 1 : -1;
      flow[k] += sg[i] * d;
    });
    // The pulse's way: up from the source bar, along the path, into the sink bar.
    const pts = [s.X[nodes[0]], SRC_Y];
    for (const v of nodes) pts.push(s.X[v], s.Y[v]);
    pts.push(s.X[top], SINK_Y);
    const cum = new Float32Array(pts.length / 2);
    for (let i = 1; i < cum.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]);
    s.paths.push({ pts, cum, ks, sg, d, j: 0 });
    s.F += d;
  }
  // The last search found no top node: what it reached is the source's side.
  let lv = 0;
  for (let i = 0; i < s.n; i++) (s.inS[i] = s.dist[i] >= 0 ? 1 : 0), (s.level[i] = s.dist[i]), (lv = max(lv, s.dist[i]));
  s.maxLevel = lv;
  s.cutCap = 0;
  s.cutList = [];
  for (let k = 0; k < s.m; k++) {
    s.cut[k] = s.inS[eu[k]] !== s.inS[ev[k]] ? 1 : 0;
    if (s.cut[k]) (s.cutCap += s.cap[k]), s.cutList.push(k);
  }
  // Left to right, for the pieces of the sink bar.
  s.cutList.sort((a, b) => s.X[eu[a]] + s.X[ev[a]] - s.X[eu[b]] - s.X[ev[b]]);
  const P = s.paths.length;
  s.gap = cl(10 / max(1, P), 0.15, 0.9);
  s.paths.forEach((p, i) => (p.t0 = i * s.gap));
  s.flowEnd = P ? (P - 1) * s.gap + s.paths[P - 1].cum[s.paths[P - 1].cum.length - 1] / V : 0;
  s.arrived = 0;
}

// A new run: capacities from the current field, the flow drained from what
// the panel shows over DRAIN units while the pipes take their new widths.
const DRAIN = 2, REVEAL = 2.5, HOLD = 5;
function restart(s, fresh) {
  if (fresh) drawField(s);
  capacities(s, s.k4);
  solve(s);
  s.dcap0.set(s.dcap);
  s.dflow0.set(s.dflow);
  s.glow0 = s.glow;
  s.phase = 1;
  s.pt = 0;
}

export function setup(params) {
  // The network itself is built on the first update, from the knobs.
  params.s = { C: 0, t: 0, hue: 0, k4: 0.06, glow: 0, glow0: 0, phase: 2, pt: 0, rgb: new Float32Array(N * 3), col: new Float32Array(15) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 7, 0.06], d = cl(dt || 0, 0, 0.1) * cl(k[1], 0.2, 3);
  s.hue = cl(k[0], 0, 1);
  const C = round(cl(k[2], 7, 13)), k4 = cl(k[3], 0, 1);
  if (C !== s.C) {
    build(s, C);
    s.k4 = k4;
    drawField(s);
    capacities(s, s.k4);
    solve(s);
    s.dcap.set(s.cap);
    s.glow = 0;
    s.phase = 2;
    s.pt = 0;
  } else if (abs(k4 - s.k4) > 0.004) {
    s.k4 = k4;
    restart(s, false);
  }
  if (input.btnPressed && input.btnPressed[0]) restart(s, true);
  s.t += d;
  s.pt += d;
  if (s.phase === 1) {
    // Drain: flow and pool fade, capacities ease to the new ones.
    const e = cl(s.pt / DRAIN, 0, 1), q = e * e * (3 - 2 * e);
    for (let i = 0; i < s.m; i++) (s.dcap[i] = s.dcap0[i] + (s.cap[i] - s.dcap0[i]) * q), (s.dflow[i] = s.dflow0[i] * (1 - q));
    s.glow = s.glow0 * (1 - q);
    if (e >= 1) (s.phase = 2), (s.pt = 0), s.dflow.fill(0), s.dcap.set(s.cap);
  } else if (s.phase === 2) {
    // Augment: as a pulse's head passes the end of a pipe, the pipe takes its flow.
    for (const p of s.paths) {
      const dist = (s.pt - p.t0) * V;
      while (p.j < p.ks.length && dist >= p.cum[p.j + 2]) {
        s.dflow[p.ks[p.j]] += p.sg[p.j] * p.d;
        p.j++;
      }
      if (!p.done && dist >= p.cum[p.cum.length - 1]) (p.done = 1), (s.arrived += p.d);
    }
    // Every path is in: show the side the source still reaches, kept apart
    // so the next run's search does not move the pool while it fades.
    if (s.pt > s.flowEnd + 0.4) (s.phase = 3), (s.pt = 0), s.vS.set(s.inS), s.vLevel.set(s.level);
  } else if (s.phase === 3) {
    s.glow = 1;
    if (s.pt > REVEAL + HOLD) restart(s, true);
  }
}

// Brightest-wins write, so pipes meeting at a node do not pile up.
function put(rgb, p, r, g, b) {
  const o = p * 3;
  if (r > rgb[o]) rgb[o] = r;
  if (g > rgb[o + 1]) rgb[o + 1] = g;
  if (b > rgb[o + 2]) rgb[o + 2] = b;
}
function add(rgb, x, y, r, g, b, w) {
  const xi = round(x), yi = round(y);
  if (xi < 0 || xi >= W || yi < 0 || yi >= H) return;
  const o = (yi * W + xi) * 3;
  rgb[o] += r * w;
  rgb[o + 1] += g * w;
  rgb[o + 2] += b * w;
}

export function draw(display, params) {
  const s = params.s;
  if (!s || !s.C) return;
  const { rgb, col, n, m, eu, ev, sb, sm, ss, tt, off, dcap, dflow, near, vS, vLevel } = s;
  rgb.fill(0);
  const hb = s.hue + 0.5;
  // The dim colours lose their saturation near orange and yellow, which
  // read brown and olive on the panel when dim.
  hsv(hb + 0.08, 0.45 * (1 - 0.85 * warm(hb + 0.08)), 1, col, 0); // empty pipe
  hsv(hb, 0.8, 1, col, 3); // flow
  hsv(hb + 0.62, 0.78, 1, col, 6); // full pipe
  hsv(hb + 0.4, 0.45, 1, col, 9); // cut flash
  hsv(hb, 0.8 * (1 - 0.8 * warm(hb)), 1, col, 12); // pool
  // The pool: LEDs whose nearest node the source still reaches, rising by
  // search level, with its rim (the cut line, a path in the dual) brighter.
  const reveal = s.phase === 3 ? (s.pt / REVEAL) * (s.maxLevel + 2) : s.phase === 1 ? 1e9 : -1;
  if (s.glow > 0.01 && reveal >= 0) {
    for (let p = 0; p < N; p++) {
      const i = near[p];
      if (!vS[i]) continue;
      const a = cl(reveal - vLevel[i], 0, 1) * s.glow;
      if (a <= 0) continue;
      const x = p % W, y = (p / W) | 0;
      const rim = (y > 0 && !vS[near[p - W]]) || (x > 0 && !vS[near[p - 1]]) || (x < W - 1 && !vS[near[p + 1]]);
      const v = (rim ? 110 : 34) * a;
      put(rgb, p, col[12] * v, col[13] * v, col[14] * v);
    }
  }
  const hold = s.phase === 3 ? cl((s.pt - REVEAL) / 0.4, 0, 1) : 0;
  const flash = 0.5 + 0.5 * sin(s.t * 7), wf = warm(hb);
  for (let k = 0; k < m; k++) {
    const cap = max(dcap[k], 0.01), r = min(1, abs(dflow[k]) / cap), cf = cap / 9;
    // A pipe's width and brightness both grow with its capacity.
    let wd = 0.6 + cf;
    const v0 = 0.1 + 0.36 * cf * sqrt(cf);
    let cr = col[0] * v0, cg = col[1] * v0, cb = col[2] * v0;
    if (r > 0.999) {
      cr = col[6];
      cg = col[7];
      cb = col[8];
      // Once the cut is found, full pipes off it go back to the flow colour.
      if (!s.cut[k] && hold > 0) {
        cr += (col[3] * 0.8 - cr) * hold;
        cg += (col[4] * 0.8 - cg) * hold;
        cb += (col[5] * 0.8 - cb) * hold;
      } else if (hold > 0) {
        const f = hold * flash;
        cr += (col[9] - cr) * f;
        cg += (col[10] - cg) * f;
        cb += (col[11] - cb) * f;
        wd += hold * (0.6 + 0.6 * flash);
      }
    } else if (r > 0) {
      // Part full: brighter with its share, and lifted near yellow.
      const v = 0.45 + 0.4 * r + 0.25 * (1 - r) * wf, a = 0.4 + 0.6 * r;
      cr += (col[3] * v - cr) * a;
      cg += (col[4] * v - cg) * a;
      cb += (col[5] * v - cb) * a;
    }
    // Flow runs along the pipe as faint ripples from the side it comes from.
    const dir = dflow[k] > 0 ? 1 : -1, wave = r > 0 && r < 0.999 ? 0.25 : 0, hw = wd / 2;
    const len = Math.hypot(s.X[ev[k]] - s.X[eu[k]], s.Y[ev[k]] - s.Y[eu[k]]);
    for (let j = off[k]; j < off[k + 1]; j++) {
      const w0 = (1 - wave + wave * sin(TAU * ((dir * tt[j] * len) / 5 - s.t * 0.9))) * 255;
      const c = sm[j], top = ss[j] === W ? H : W;
      for (let i = max(0, Math.ceil(c - hw - 0.5)); i <= min(top - 1, floor(c + hw + 0.5)); i++) {
        const cover = min(i + 0.5, c + hw) - max(i - 0.5, c - hw);
        if (cover > 0) put(rgb, sb[j] + i * ss[j], cr * cover * w0, cg * cover * w0, cb * cover * w0);
      }
    }
  }
  // Nodes.
  for (let i = 0; i < n; i++) {
    const p = round(s.Y[i]) * W + round(s.X[i]);
    const v = vS[i] && s.glow > 0 && reveal > vLevel[i] ? 200 : 120;
    put(rgb, p, v * 0.9, v * 0.95, v);
  }
  // Pulses: a white head and a tail in the flow colour.
  if (s.phase === 2)
    for (const p of s.paths) {
      const dist = (s.pt - p.t0) * V, L = p.cum[p.cum.length - 1];
      if (dist < 0 || dist > L + 12) continue;
      let seg = 0;
      for (let j = 0; j < 14; j++) {
        const dd = dist - j;
        if (dd < 0) break;
        if (dd > L) continue;
        while (seg + 1 < p.cum.length - 1 && p.cum[seg + 1] < dd) seg++;
        while (seg > 0 && p.cum[seg] > dd) seg--;
        const f = (dd - p.cum[seg]) / max(1e-6, p.cum[seg + 1] - p.cum[seg]);
        const x = p.pts[2 * seg] + (p.pts[2 * seg + 2] - p.pts[2 * seg]) * f, y = p.pts[2 * seg + 1] + (p.pts[2 * seg + 3] - p.pts[2 * seg + 1]) * f;
        if (j === 0) {
          add(rgb, x, y, 255, 255, 255, 1);
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) add(rgb, x + ox, y + oy, col[3], col[4], col[5], 140);
        } else {
          const w = (1 - j / 14) ** 2 * 230;
          add(rgb, x, y, col[3], col[4], col[5], w);
        }
      }
    }
  // Source bar along the bottom, sink bar along the top. The sink bar lights
  // from the middle out as the flow arrives; once the cut is found it splits
  // into one piece per cut pipe, as wide as its share of the flow, and the
  // pieces fill the bar exactly.
  for (let x = 0; x < W; x++) for (const y of [126, 127]) put(rgb, y * W + x, col[3] * 200, col[4] * 200, col[5] * 200);
  const fill = s.phase === 2 ? s.arrived / max(1, s.F) : s.phase === 3 ? 1 : s.glow;
  if (hold > 0) {
    let x0 = 0;
    s.cutList.forEach((k, i) => {
      const x1 = x0 + (W * s.cap[k]) / s.F, c = i & 1 ? 6 : 9, a = i & 1 ? 0.9 : 0.55 + 0.45 * flash;
      for (let x = round(x0); x < round(x1); x++) for (const y of [0, 1]) put(rgb, y * W + x, col[c] * 230 * a, col[c + 1] * 230 * a, col[c + 2] * 230 * a);
      x0 = x1;
    });
  } else
    for (let x = 0; x < W; x++) {
      const v = abs(x - 31.5) < fill * 32 ? 200 : 60;
      for (const y of [0, 1]) put(rgb, y * W + x, col[3] * v, col[4] * v, col[5] * v);
    }
  for (let p = 0; p < N; p++) display.setPixel(p % W, (p / W) | 0, min(255, rgb[p * 3]), min(255, rgb[p * 3 + 1]), min(255, rgb[p * 3 + 2]));
}
