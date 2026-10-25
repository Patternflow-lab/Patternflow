// ===== Patternflow pattern =====
// Title:   Orb Weaver
// Family:  halloween
// Idea:    A purple and orange garden spider builds an orb web down the whole panel: bridge line, frame, radii one by one, a temporary spiral, then the sticky spiral from the rim inward with turnbacks in the long lower half, until the finished web shimmers with orange dew and a gust tears it away.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 43; after the orb webs of garden spiders (Araneidae) and the cobwebs of Halloween
// Round:   43
// ===============================
// @matrix 64x128
// @knobs Colour=0..1, Speed=0.2..3, Radii=20..44, Wind=0..1
//
// Knob 1: Colour. Three silks round the knob, all lit brighter and warmer toward the bottom of the panel: at 0 silver-violet, at 0.33 toxic green, at 0.67 the bone white of Halloween cobwebs. Each holds for 0.1 either side of its point and blends into the next in between, and 1 is 0 again. The spider stays purple with an orange cross and the dew stays orange.
// Knob 2: Speed. At 2 a web of 20 radii takes 63 seconds: 2 for the bridge line to float across, 5 for the frame, 22 for the radii, 2.5 for the hub and temporary spiral, 16 for the sticky spiral, 11 shimmering with dew, 3.3 for the gust and 1.5 for the spider to walk back in. At 0.2 everything takes ten times as long, at 3 two thirds as long.
// Knob 3: Radii, 20 to 44 in steps of 2, spaced evenly along the frame so the long lower half gets as many as the rest; at 44 the radii take 44 seconds at Speed 2. Turning it respins the web at the same stage of building.
// Knob 4: Wind. Sways the web sideways, 1 LED at the hub at 0.06 and 6 LEDs at 1, makes the floating bridge line flutter harder, and throws the torn pieces further.
// Buttons: K1 tap sends the gust: the web tears now and a new one starts.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, abs, sin, cos, round, exp, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + (b - a) * Math.random();

// Silks by K1: silver-violet, toxic green, bone white. The spider's body,
// its cross and leg colour, and the dew stay put.
const SILK = [[0.76, 0.62, 1], [0.42, 1, 0.22], [0.92, 0.9, 0.84]];
const BODY = [0.55, 0.14, 1], MARK = [1, 0.55, 0.05], LEG = [0.72, 0.38, 1], DEW = [1, 0.5, 0.04], GLINT = [1, 0.82, 0.45];
// Spider speeds in LEDs per second at Speed 1: walking on laid silk,
// laying a frame line or radius, dropping, laying the sticky spiral.
const WALK = 65, LAY = 50, DROP = 60, STICKY = 40;
// Sticky spiral: spacing, the free zone round the hub, the gap to the frame.
const GAP = 3.3, FREE = 7.5, RIM = 4;
// Seconds at Speed 1: bridge float, dew, tear, walking back in.
const FLOAT = 4, DEWT = 22, TEAR = 6.5, ENTER = 3;

// A thread or path: points subdivided to at most 5 LEDs apart, with the
// length up to each point and, for spirals, the distance from the hub.
function poly(points, rs) {
  const xs = [], ys = [], r = [];
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    if (i) {
      const [px, py] = points[i - 1], n = Math.ceil(sqrt((x - px) ** 2 + (y - py) ** 2) / 5);
      for (let k = 1; k < n; k++) xs.push(mix(px, x, k / n)), ys.push(mix(py, y, k / n)), r.push(rs ? mix(rs[i - 1], rs[i], k / n) : 0);
    }
    xs.push(x), ys.push(y), r.push(rs ? rs[i] : 0);
  }
  const cum = [0];
  for (let i = 1; i < xs.length; i++) cum.push(cum[i - 1] + sqrt((xs[i] - xs[i - 1]) ** 2 + (ys[i] - ys[i - 1]) ** 2));
  return { xs, ys, r, cum, len: cum[cum.length - 1] };
}

// The point at distance s along a path, and the heading there.
function along(p, s, out) {
  const { xs, ys, cum } = p;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const f = cl((s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), 0, 1);
  out[0] = mix(xs[i - 1], xs[i], f);
  out[1] = mix(ys[i - 1], ys[i], f);
  out[2] = atan2(ys[i] - ys[i - 1], xs[i] - xs[i - 1]);
}

// The web's plan: hub, bridge, frame, radii anchored evenly along the frame,
// and the moves the spider makes to build it, each tagged with its stage:
// 0 bridge, 1 frame, 2 radii, 3 hub and temporary spiral, 4 sticky, 5 home.
function plan(S, n) {
  // Each web's own wobble, kept while K3 respins it.
  let ji = 0;
  const j = () => S.jit[ji++];
  const hub = [31.5 + 1.5 * j(), 37 + 2 * j()];
  const BL = [0, 6 + 1.5 * j()], BR = [63, 5 + 1.5 * j()];
  const onBridge = (x) => [x, mix(BL[1], BR[1], x / 63)];
  const F0 = onBridge(7 + 2 * j()), F1 = onBridge(56 + 2 * j());
  const F2 = [60 + j(), 47 + 3 * j()], F3 = [51 + 2 * j(), 121 + j()], F4 = [12 + 2 * j(), 122 + j()], F5 = [3 + j(), 49 + 3 * j()];
  const M = onBridge(hub[0]), G = [hub[0], mix(F4[1], F3[1], (hub[0] - F4[0]) / (F3[0] - F4[0]))];
  // The frame as a ring from M: down the right side to G and back up the left.
  const ring = [M, F1, F2, F3, G, F4, F5, F0], R = ring.length, sAt = [0];
  for (let i = 1; i <= R; i++) sAt.push(sAt[i - 1] + sqrt((ring[i % R][0] - ring[i - 1][0]) ** 2 + (ring[i % R][1] - ring[i - 1][1]) ** 2));
  const P = sAt[R], sG = sAt[4], wrap = (s) => ((s % P) + P) % P;
  const ringAt = (s) => {
    s = wrap(s);
    let i = 1;
    while (sAt[i] < s) i++;
    const f = (s - sAt[i - 1]) / (sAt[i] - sAt[i - 1]);
    return [mix(ring[i - 1][0], ring[i % R][0], f), mix(ring[i - 1][1], ring[i % R][1], f)];
  };
  // Along the frame from s0 to s1 the short way, through its corners.
  const frameWalk = (s0, s1) => {
    let d = wrap(s1 - s0);
    if (d > P / 2) d -= P;
    const mid = [];
    for (let k = 0; k < R; k++) {
      const t = d > 0 ? wrap(sAt[k] - s0) : wrap(s0 - sAt[k]);
      if (t > 0 && t < abs(d)) mid.push([t, ring[k]]);
    }
    mid.sort((a, b) => a[0] - b[0]);
    return [ringAt(s0), ...mid.map((m) => m[1]), ringAt(s0 + d)];
  };
  const h = n / 2, rad = [];
  for (let k = 0; k < n; k++) {
    const s = k <= h ? (sG * k) / h : sG + ((P - sG) * (k - h)) / h, a = ringAt(s);
    const dx = a[0] - hub[0], dy = a[1] - hub[1], L = sqrt(dx * dx + dy * dy);
    rad.push({ s, a, L, ux: dx / L, uy: dy / L, th: atan2(dy, dx) });
  }
  const at = (k, r) => [hub[0] + r * rad[k].ux, hub[1] + r * rad[k].uy];

  const threads = [], moves = [];
  const thread = (pts, rs, a) => (threads.push({ p: poly(pts, rs), a, shown: 0 }), threads.length - 1);
  const lay = (t, v, stage) => moves.push({ p: threads[t].p, t, v, stage });
  const walk = (pts, v, stage) => moves.push({ p: poly(pts), t: -1, v, stage });

  // The bridge floats across first (drawn apart); then the spider walks to M.
  const bridge = thread([BL, BR], null, 0.85);
  walk([BL, M], WALK, 0);
  // Drop from M through the hub to G, frame the left side up to the bridge,
  // cross it, frame the right side down, and climb back to the hub.
  lay(thread([M, hub, G], null, 0.85), DROP, 1);
  const left = thread([G, F4, F5, F0], null, 0.8);
  lay(left, LAY, 1);
  walk([F0, M, F1], WALK, 1);
  const right = thread([F1, F2, F3, G], null, 0.8);
  lay(right, LAY, 1);
  walk([G, hub], WALK, 1);
  // Moorings to the panel's edges, each grown once the spider framing that
  // side has passed its corner.
  const d2 = (a, b) => sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
  const moor = [
    [F2, [63, F2[1] - 7], right, d2(F1, F2)],
    [F3, [57, 127], right, d2(F1, F2) + d2(F2, F3)],
    [F4, [6, 127], left, d2(G, F4)],
    [F5, [0, F5[1] + 6], left, d2(G, F4) + d2(F4, F5)],
  ].map(([a, b, f, s]) => ({ t: thread([a, b], null, 0.75), f, s }));
  // Radii: up and down are the drag line. Each new one goes into the widest
  // gap left: out along the nearest laid radius, along the frame, and back
  // to the hub laying the new one.
  const laid = new Set([0, h]);
  while (laid.size < n) {
    let best = -1, gap = -1, nb = 0;
    for (let k = 0; k < n; k++) {
      if (laid.has(k)) continue;
      let g = 1e9, near = 0;
      for (const q of laid) {
        const dd = abs(((rad[k].th - rad[q].th + 3 * PI) % TAU) - PI);
        if (dd < g) (g = dd), (near = q);
      }
      if (g > gap + 1e-6) (gap = g), (best = k), (nb = near);
    }
    walk([hub, rad[nb].a], WALK, 2);
    walk(frameWalk(rad[nb].s, rad[best].s), WALK, 2);
    lay(thread([rad[best].a, hub], null, 0.85), LAY, 2);
    laid.add(best);
  }
  // The hub mesh and the temporary spiral, outward to the shortest radius.
  let Rf = 1e9, Rx = 0;
  for (const r of rad) (Rf = min(Rf, r.L - RIM)), (Rx = max(Rx, r.L - RIM));
  const spiral = (r0, r1, pitch, k0) => {
    const pts = [], rs = [];
    for (let q = 0, r = r0; r <= r1; q++, r = r0 + (pitch * q) / n) pts.push(at((k0 + q) % n, r)), rs.push(r);
    return [pts, rs];
  };
  const [hp, hr] = spiral(1.6, FREE - 1.5, 1.4, 0);
  lay(thread(hp, hr, 1), LAY, 3);
  const [tp, tr] = spiral(FREE - 1.5, Rf + 2, 7, hp.length % n);
  const temp = thread(tp, tr, 0.5);
  lay(temp, 1.4 * LAY, 3);
  // The sticky spiral from the rim inward: an arc round the bottom radius at
  // every level only the long lower radii reach, turning back at each end,
  // then whole turns once every radius is long enough.
  const sp = [], sr = [];
  let dir = 1, kEnd = h, kStart = -1;
  for (let r = Rf + GAP * floor((Rx - Rf) / GAP); r > Rf + 1e-6; r -= GAP) {
    let lo = h, hi = h;
    while (lo > 1 && rad[lo - 1].L - RIM >= r) lo--;
    while (hi < n - 1 && rad[hi + 1].L - RIM >= r) hi++;
    if (hi - lo < 1) continue;
    for (let k = dir > 0 ? lo : hi; dir > 0 ? k <= hi : k >= lo; k += dir) {
      if (kStart < 0) kStart = k;
      sp.push(at(k, r)), sr.push(r);
    }
    kEnd = dir > 0 ? hi : lo;
    dir = -dir;
  }
  if (sp.length) dir = -dir;
  for (let q = 0, r = Rf; r >= FREE; q++, r = Rf - (GAP * q) / n) {
    const k = (((kEnd + dir * q) % n) + n) % n;
    if (kStart < 0) kStart = k;
    sp.push(at(k, r)), sr.push(r);
  }
  const kT = (hp.length + tp.length - 1) % n;
  walk([tp[tp.length - 1], rad[kT].a], WALK, 4);
  walk(frameWalk(rad[kT].s, rad[kStart].s), WALK, 4);
  walk([rad[kStart].a, sp[0]], WALK, 4);
  const sticky = thread(sp, sr, 1);
  lay(sticky, STICKY, 4);
  walk([sp[sp.length - 1], hub], WALK, 5);
  Object.assign(S, { threads, moves, bridge, moor, temp, sticky, hub, BL, BR, mi: 0, ms: 0 });
}

// Jump to a share f of the way through a stage, everything before it built.
function seek(S, stage, f) {
  const { moves, threads } = S;
  let total = 0;
  for (const m of moves) if (m.stage === stage) total += m.p.len;
  let left = f * total;
  S.mi = moves.length;
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    if (m.stage < stage || (m.stage === stage && left >= m.p.len && i < moves.length - 1)) {
      if (m.stage === stage) left -= m.p.len;
      if (m.t >= 0) threads[m.t].shown = m.p.len;
      continue;
    }
    S.mi = i;
    S.ms = m.stage === stage ? left : 0;
    if (m.t >= 0) threads[m.t].shown = S.ms;
    break;
  }
  threads[S.bridge].shown = threads[S.bridge].p.len;
  for (const m of S.moor) threads[m.t].shown = stage > 1 ? threads[m.t].p.len : 0;
}

// How far through its stage the build is, 0..1.
function progress(S) {
  const stage = S.moves[S.mi].stage;
  let total = 0, done = 0;
  S.moves.forEach((m, i) => {
    if (m.stage !== stage) return;
    total += m.p.len;
    if (i < S.mi) done += m.p.len;
  });
  return [stage, (done + S.ms) / (total || 1)];
}

export function setup(params) {
  params.s = {
    col: 0, speed: 2, wind: 0.06, rt: 0, phase: "build", clock: 0, builtFor: -1, gust: 1,
    T: new Float32Array(N), rgb: new Float32Array(N * 3), legs: new Float32Array(N), row: new Float32Array(H * 3),
    pos: [0, 0, 0], heading: 0, gait: 0, frags: [], dew: [], fly: null, jit: [],
  };
  newJitter(params.s);
}

function newJitter(S) {
  S.jit = Array.from({ length: 16 }, () => rnd(-1, 1));
}

// The gust: the web bellies out downwind, then breaks piece by piece from
// the windward side, each piece flying off, tumbling, falling and fading.
function gustOn(S, f, x) {
  const side = S.gust > 0 ? x / 63 : 1 - x / 63, w = 1 + 1.5 * S.wind;
  return Object.assign(f, { tb: 0.5 + 2.2 * side + rnd(0, 0.6), vx: S.gust * rnd(8, 22) * w, vy: rnd(-8, 2), om: rnd(-3, 3) });
}

// Where a piece is now: offset, turn and how much is left of it.
function blown(S, f, x, y) {
  const tau = S.clock - f.tb, belly = S.gust * (2 + 3 * S.wind) * sin(PI * cl(x / 63, 0, 1)) * sin(PI * cl(y / 127, 0, 1));
  if (tau < 0) return [belly * (S.clock / f.tb) ** 2, 0, 0, 1];
  return [belly + f.vx * tau, f.vy * tau + 6 * tau * tau, f.om * tau, max(0, 1 - tau / 2.6)];
}

function startTear(S) {
  S.dewOn = S.phase === "dew" ? 1 : 0;
  S.phase = "tear";
  S.clock = 0;
  S.gust = Math.random() < 0.5 ? -1 : 1;
  const frags = [], cut = S.rCut;
  for (const th of S.threads) {
    const { xs, ys, r, cum } = th.p;
    for (let i = 1; i < xs.length && cum[i] <= th.shown + 1e-6; i++) {
      if (th === S.threads[S.temp] && r[i] > cut) continue;
      const [ax, ay] = sway(S, xs[i - 1], ys[i - 1]), [bx, by] = sway(S, xs[i], ys[i]);
      const cx = (ax + bx) / 2, cy = (ay + by) / 2;
      frags.push(gustOn(S, { cx, cy, hx: (bx - ax) / 2, hy: (by - ay) / 2, a: th.a }, cx));
    }
  }
  S.frags = frags;
  for (const d of S.dew) gustOn(S, d, d.x);
  S.fly = gustOn(S, { x: S.pos[0], y: S.pos[1] }, S.pos[0]);
  S.fly.om = 5 * S.gust;
}

// Where the wind has pushed a point of the web: anchored at the panel's
// edges, freest in the middle.
function sway(S, x, y) {
  const f = sin(PI * cl(x / 63, 0, 1)) ** 0.7 * sin(PI * cl(y / 127, 0, 1)) ** 0.7;
  return [x + S.dx * f, y + S.dy * f];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 20, 0.06], d = cl(dt || 0, 0, 0.1);
  S.col = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.wind = cl(k[3], 0, 1);
  const n = 20 + 2 * round((cl(k[2], 20, 44) - 20) / 2), sp = d * S.speed;
  S.rt += d;
  const A = 0.6 + 6 * S.wind;
  S.dx = A * (0.65 * sin(0.8 * S.rt) + 0.35 * sin(2.1 * S.rt + 1.3));
  S.dy = 0.3 * A * sin(1.3 * S.rt + 0.4);
  if (S.builtFor !== n) {
    // The first web opens with the spider at the rim, about to lay the
    // sticky spiral; a new count respins the web at the same stage.
    if (S.builtFor < 0) {
      plan(S, n);
      seek(S, 4, 0);
      while (S.moves[S.mi].t !== S.sticky) S.mi++;
    } else if (S.phase === "build") {
      const [stage, f] = progress(S);
      plan(S, n);
      seek(S, stage, f);
    } else if (S.phase === "dew") plan(S, n), seek(S, 6, 0), makeDew(S);
    else if (S.phase !== "tear") plan(S, n);
    S.builtFor = n;
  }
  if (input.btnPressed && input.btnPressed[0] && (S.phase === "build" || S.phase === "dew" || S.phase === "float")) startTear(S);
  S.clock += sp;
  const pos = S.pos;
  let moved = 0;
  if (S.phase === "float") {
    (pos[0] = S.BL[0] + 1.5), (pos[1] = S.BL[1] + 1), (pos[2] = 0);
    if (S.clock >= FLOAT) (S.phase = "build"), (S.mi = 0), (S.ms = 0), (S.threads[S.bridge].shown = S.threads[S.bridge].p.len);
  } else if (S.phase === "build") {
    let m = S.moves[S.mi];
    S.ms += m.v * sp;
    moved = m.v * sp;
    while (S.ms >= m.p.len) {
      if (m.t >= 0) S.threads[m.t].shown = m.p.len;
      S.ms -= m.p.len;
      if (++S.mi >= S.moves.length) break;
      m = S.moves[S.mi];
    }
    if (S.mi >= S.moves.length) {
      S.phase = "dew";
      S.clock = 0;
      S.mi = S.moves.length - 1;
      S.ms = m.p.len;
      makeDew(S);
    } else if (m.t >= 0) S.threads[m.t].shown = S.ms;
    along(S.moves[S.mi].p, S.ms, pos);
    for (const mo of S.moor) if (S.threads[mo.f].shown >= mo.s) S.threads[mo.t].shown = min(S.threads[mo.t].p.len, S.threads[mo.t].shown + 2 * LAY * sp);
  } else if (S.phase === "dew") {
    (pos[0] = S.hub[0]), (pos[1] = S.hub[1] + 1), (pos[2] = PI / 2);
    if (S.clock >= DEWT) startTear(S);
  } else if (S.phase === "tear") {
    if (S.clock >= TEAR) {
      newJitter(S);
      plan(S, n);
      S.phase = "enter";
      S.clock = 0;
      S.fly = null;
    }
  } else if (S.phase === "enter") {
    const u = cl(S.clock / ENTER, 0, 1);
    moved = (sp * 12) / ENTER;
    (pos[0] = mix(-8, S.BL[0] + 1.5, u)), (pos[1] = S.BL[1] + 1), (pos[2] = 0);
    if (u >= 1) (S.phase = "float"), (S.clock = 0);
  }
  // The temporary spiral is taken up as the sticky one passes over it.
  const st = S.threads[S.sticky];
  S.rCut = 1e9;
  if (st.shown > 0) {
    const { cum, r } = st.p;
    let i = 0;
    while (i < cum.length - 1 && cum[i + 1] <= st.shown) i++;
    S.rCut = st.shown >= st.p.len ? 0 : r[i] - 0.5 * GAP;
  }
  // Heading eases round to the way the spider is going; the legs step with
  // the distance it covers.
  let dh = ((pos[2] - S.heading + 3 * PI) % TAU) - PI;
  S.heading += dh * min(1, d * 14);
  S.gait += moved * 0.9;
}

function makeDew(S) {
  const p = S.threads[S.sticky].p, out = [0, 0, 0];
  S.dew = [];
  for (let s = rnd(1, 4); s < p.len; s += rnd(3, 7)) {
    along(p, s, out);
    S.dew.push({ x: out[0], y: out[1], ph: rnd(0, TAU), w: rnd(1.2, 3.2), on: rnd(0, 6) });
  }
}

// --- drawing ---

function plot(buf, x, y, c) {
  if (x < 0 || x >= W || y < 0 || y >= H || c <= 0) return;
  const o = y * W + x;
  if (c > buf[o]) buf[o] = c;
}

// Xiaolin Wu's antialiased line, one LED wide, keeping the most at each LED.
function wu(buf, x0, y0, x1, y1, a) {
  const steep = abs(y1 - y0) > abs(x1 - x0);
  if (steep) [x0, y0, x1, y1] = [y0, x0, y1, x1];
  if (x0 > x1) [x0, y0, x1, y1] = [x1, y1, x0, y0];
  const dx = x1 - x0, g = dx < 1e-9 ? 0 : (y1 - y0) / dx;
  const xs = round(x0), xe = round(x1);
  let yy = y0 + g * (xs - x0);
  for (let x = xs; x <= xe; x++, yy += g) {
    const yi = floor(yy), f = yy - yi;
    if (steep) plot(buf, yi, x, (1 - f) * a), plot(buf, yi + 1, x, f * a);
    else plot(buf, x, yi, (1 - f) * a), plot(buf, x, yi + 1, f * a);
  }
}

function silk(S) {
  const h = (S.col - floor(S.col)) * 3, i = floor(h) % 3, f = h - floor(h), j = (i + 1) % 3;
  const g = cl((f - 0.3) / 0.4, 0, 1), s = g * g * (3 - 2 * g);
  return [0, 1, 2].map((c) => mix(SILK[i][c], SILK[j][c], s));
}

// The spider: abdomen behind, head in front, four legs a side that step as
// it walks. Heading hd points the way the head faces.
function drawSpider(S, x, y, hd) {
  const { rgb, legs } = S, fx = cos(hd), fy = sin(hd), sx = -fy, sy = fx;
  const x0 = max(0, floor(x - 9)), x1 = min(W - 1, floor(x + 9)), y0 = max(0, floor(y - 9)), y1 = min(H - 1, floor(y + 9));
  for (let yy = y0; yy <= y1; yy++) legs.fill(0, yy * W + x0, yy * W + x1 + 1);
  const hx = x + 1.3 * fx, hy = y + 1.3 * fy;
  const base = [0.55, 1.15, 1.95, 2.55];
  for (let side = -1; side <= 1; side += 2)
    for (let k = 0; k < 4; k++) {
      const a = base[k] + 0.22 * sin(S.gait + k * 1.7 + (side > 0 ? PI : 0));
      const ca = cos(a), sa = side * sin(a), cb = 2.6 * cos(a * 0.9) + (k < 2 ? 0.8 : -0.8), sb = 2.6 * side * sin(a * 0.9);
      const rx = hx - 0.3 * k * fx, ry = hy - 0.3 * k * fy;
      const kx = rx + (ca * fx + sa * sx) * 3, ky = ry + (ca * fy + sa * sy) * 3, lx = kx + cb * fx + sb * sx, ly = ky + cb * fy + sb * sy;
      wu(legs, rx, ry, kx, ky, 1);
      wu(legs, kx, ky, lx, ly, 0.9);
    }
  for (let yy = y0; yy <= y1; yy++)
    for (let xx = x0; xx <= x1; xx++) {
      const o = yy * W + xx, a = legs[o];
      if (a > 0.08) for (let c = 0; c < 3; c++) rgb[o * 3 + c] = mix(rgb[o * 3 + c], LEG[c], min(1, a * 1.3));
    }
  // Abdomen with the orange cross, head orange.
  const blob = (cx, cy, ra, rb, cross) => {
    for (let yy = max(0, floor(cy - 4)); yy <= min(H - 1, floor(cy + 4)); yy++)
      for (let xx = max(0, floor(cx - 4)); xx <= min(W - 1, floor(cx + 4)); xx++) {
        const px = xx - cx, py = yy - cy, u = px * fx + py * fy, v = px * sx + py * sy;
        const q = sqrt((u / ra) ** 2 + (v / rb) ** 2), a = cl((1 - q) * min(ra, rb) + 0.6, 0, 1);
        if (a <= 0) continue;
        const o = (yy * W + xx) * 3, mark = cross === 2 || (cross === 1 && q < 0.75 && (abs(v) < 0.6 || abs(u + 0.3) < 0.6));
        const col = mark ? MARK : BODY, sh = 1 - 0.3 * cl(q, 0, 1);
        for (let c = 0; c < 3; c++) rgb[o + c] = mix(rgb[o + c], col[c] * sh, a);
      }
  };
  blob(x - 1.9 * fx, y - 1.9 * fy, 2.7, 2.2, 1);
  blob(hx, hy, 1.4, 1.2, 2);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.threads) return;
  const { T, rgb, row } = S;
  T.fill(0);
  rgb.fill(0);
  const tear = S.phase === "tear", dew = S.phase === "dew" ? cl(S.clock / 3, 0, 1) : 0;
  if (tear) {
    for (const f of S.frags) {
      const [ox, oy, an, left] = blown(S, f, f.cx, f.cy), c = cos(an), s = sin(an);
      const cx = f.cx + ox, cy = f.cy + oy, hx = f.hx * c - f.hy * s, hy = f.hx * s + f.hy * c;
      if (left > 0.02) wu(T, cx - hx, cy - hy, cx + hx, cy + hy, f.a * left);
    }
  } else if (S.phase !== "enter") {
    for (let ti = 0; ti < S.threads.length; ti++) {
      const th = S.threads[ti];
      if (th.shown <= 0) continue;
      if (ti === S.bridge && S.phase === "float") continue;
      // Silk just laid shines, fading over the 60 LEDs behind the spider.
      const { xs, ys, r, cum } = th.p, temp = ti === S.temp, fresh = S.phase === "build" && S.moves[S.mi].t === ti;
      let [ax, ay] = sway(S, xs[0], ys[0]);
      for (let i = 1; i < xs.length; i++) {
        if (cum[i - 1] >= th.shown) break;
        let bx = xs[i], by = ys[i];
        if (cum[i] > th.shown) {
          const f = (th.shown - cum[i - 1]) / (cum[i] - cum[i - 1]);
          bx = mix(xs[i - 1], xs[i], f);
          by = mix(ys[i - 1], ys[i], f);
        }
        const [px, py] = sway(S, bx, by);
        const glow = fresh ? 1 + 0.9 * cl(1 - (th.shown - cum[i]) / 60, 0, 1) : 1;
        if (!temp || r[i] <= S.rCut) wu(T, ax, ay, px, py, th.a * glow);
        ax = px;
        ay = py;
      }
    }
    if (S.phase === "float") {
      // The bridge line drifting out on the breeze from the left anchor, its
      // free end fluttering, until it snags on the far side.
      const u = cl(S.clock / FLOAT, 0, 1), e = u * u * (3 - 2 * u), A = 1.5 + 5 * S.wind;
      const ex = mix(S.BL[0], S.BR[0], e), ey = mix(S.BL[1], S.BR[1], e) + A * sin(S.rt * 5) * (1 - e) + 4 * (1 - e) * e;
      let px = S.BL[0], py = S.BL[1];
      for (let k = 1; k <= 16; k++) {
        const t = k / 16, qx = mix(S.BL[0], ex, t), qy = mix(S.BL[1], ey, t) + (6 * (1 - e) + 1) * sin(PI * t) * (0.7 + 0.3 * sin(S.rt * 3 + t * 4));
        wu(T, px, py, qx, qy, 0.85);
        (px = qx), (py = qy);
      }
    }
  }
  // Silk lit from below: brighter and warmer toward the bottom row. When
  // the web is done a band of light climbs it, catching the dew.
  const sk = silk(S), band = 135 - ((S.clock * 20) % 180);
  for (let y = 0; y < H; y++) {
    const v = y / 127, lit = 0.42 + 0.58 * v ** 1.2, warm = 0.3 * v * v;
    const sh = 1 + 0.8 * dew * exp(-(((y - band) / 9) ** 2));
    row[y * 3] = mix(sk[0], 1, warm) * lit * sh;
    row[y * 3 + 1] = mix(sk[1], 0.72, warm) * lit * sh;
    row[y * 3 + 2] = mix(sk[2], 0.42, warm) * lit * sh;
  }
  for (let o = 0; o < N; o++) {
    const t = T[o];
    if (t <= 0) continue;
    const y3 = floor(o / W) * 3;
    rgb[o * 3] = row[y3] * t;
    rgb[o * 3 + 1] = row[y3 + 1] * t;
    rgb[o * 3 + 2] = row[y3 + 2] * t;
  }
  // Dew: orange beads along the sticky spiral that gather over the first
  // three seconds, each glinting now and then and all flaring pale gold as
  // the band of light climbs past.
  if (dew > 0)
    for (const dd of S.dew) {
      const [x, y] = sway(S, dd.x, dd.y), xi = round(x), yi = round(y);
      if (xi < 0 || xi >= W || yi < 0 || yi >= H) continue;
      const on = cl((S.clock - dd.on) / 1.5, 0, 1);
      if (on <= 0) continue;
      const tw = (0.5 + 0.5 * sin(S.rt * dd.w + dd.ph)) ** 8, b = min(1, max(tw, exp(-(((y - band) / 7) ** 2))));
      const v = on * (0.62 + 0.38 * b), o = yi * W + xi;
      for (let c = 0; c < 3; c++) rgb[o * 3 + c] = mix(DEW[c], GLINT[c], b * b) * v;
      if (b > 0.4)
        for (const q of [o - 1, o + 1, o - W, o + W])
          if (q >= 0 && q < N && abs((q % W) - xi) <= 1) for (let c = 0; c < 3; c++) rgb[q * 3 + c] = max(rgb[q * 3 + c], DEW[c] * on * (b - 0.4));
    }
  if (tear && S.dewOn)
    for (const dd of S.dew) {
      const [ox, oy, , left] = blown(S, dd, dd.x, dd.y), xi = round(dd.x + ox), yi = round(dd.y + oy);
      if (left > 0.05 && xi >= 0 && xi < W && yi >= 0 && yi < H) for (let c = 0; c < 3; c++) rgb[(yi * W + xi) * 3 + c] = DEW[c] * left;
    }
  if (!tear) drawSpider(S, ...sway(S, S.pos[0], S.pos[1]), S.heading);
  else if (S.fly) {
    const f = S.fly, [ox, oy, an] = blown(S, f, f.x, f.y);
    drawSpider(S, f.x + ox, f.y + oy, S.heading + an);
  }
  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) display.setPixel(x, y, round(255 * min(1, rgb[o * 3])), round(255 * min(1, rgb[o * 3 + 1])), round(255 * min(1, rgb[o * 3 + 2])));
}
