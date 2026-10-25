// ===== Patternflow pattern =====
// Title:   Web Tremor
// Family:  halloween
// Idea:    A pale moth blunders into a tall orb web under the moon and every time it struggles a pulse of light runs out from it along the silk, fast down the radial threads and slower round the spiral, until the spider at the hub feels it, turns, runs out, wraps the moth into a white bundle and walks back, the web sagging and quivering under them, and then another moth comes.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 47
// Round:   47
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Struggle=0..1, Sag=0..1
//
// Knob 1: Hue. The colour of the pulses: at 0 toxic green, at 0.25 icy cyan, at 0.5 moonlight white, at 0.75 violet, each held for 0.06 either side of its point and blending into the next, and 1 is green again. The silk, the moon, the moth and the spider keep their colours.
// Knob 2: Speed. At 2 one hunt takes about 13 seconds: the moth flutters in for 2, struggles for 3 to 4 while the spider feels it, turns and runs out, is wrapped for 2.8, and the spider walks back for 2 and rests for 1. A pulse crosses the web in about 2 seconds. At 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Struggle. How hard the moth fights: at 0 it heaves in twos about every 1.3 seconds and a pulse has lost half its light 52 LEDs out; at 1 it heaves in threes every 0.6 seconds, the pulses start a quarter brighter and keep half their light to 83 LEDs, and the web round the moth shakes three times as hard.
// Knob 4: Sag. How slack the web hangs: at 0.06 the hub sits 1.4 LEDs low, 3 with the spider on it, and the moth pulls its crossing about 3 down; at 1 the web bellies 7 LEDs at the hub, 11 with the spider, and the moth drags its crossing about 9 down. The frame never moves.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, atan2, round, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const q = (v, n) => round(v * n) / n;
const rnd = (a, b) => a + (b - a) * Math.random();

// Pulse colours round K1: toxic green, icy cyan, moonlight white, violet.
const PULSE = [[0.35, 1, 0.12], [0.2, 0.9, 1], [0.88, 0.94, 1], [0.8, 0.3, 1]];
// Silk in moonlight, the moon, the moth, the spider (a cold violet grey
// with green eyes), the wrapping silk.
const SILK = [0.56, 0.6, 0.92], MOON = [0.86, 0.9, 1], WING = [0.88, 0.85, 0.98], MBODY = [1, 0.96, 0.86];
const SBODY = [0.42, 0.32, 0.66], SLEG = [0.58, 0.54, 0.78], SEYE = [0.4, 1, 0.3], WRAP = [0.97, 0.97, 1];
const SILK_V = 0.34;
// The web: hub, sixteen radials out to a frame just inside the panel, and
// the sticky spiral as rings 4.6 LEDs apart; a ring stops where a radial is
// too short for it, so the long upper and lower parts have more turns.
const HX = 32, HY = 63, K = 16, HUBR = 3, R0 = 7.5, GAP = 4.6;
const BOX = [3, 6, 60, 122];
const MOONX = 46, MOONY = 19, MOONR = 10;
// A pulse runs along the graph of the web at V LEDs a second, the spiral
// costing SPIRAL times its length (vibration carries best down the
// radials, which are stiffer), with a sharp front and a short tail.
const V = 44, SPIRAL = 1.8, FRONT = 3, TAIL = 9;
// Story seconds (one a second at Speed 2): the moth's flight in, the
// spider's turn, the wrap, the rest at the hub; and the spider's pace out
// and back, in LEDs a second.
const FLY = 2, TURN = 0.5, WRAPT = 2.8, REST = 1;
const RUN = 30, BACK = 20;

function buildWeb(S) {
  const nx = [], ny = [], nu = [], edges = [], th = [], R = [];
  const node = (x, y, u) => (nx.push(x), ny.push(y), nu.push(u), nx.length - 1);
  const hub = node(HX, HY, 0);
  for (let k = 0; k < K; k++) {
    const a = ((k + 0.5) * TAU) / K + rnd(-0.07, 0.07), c = cos(a), s = sin(a);
    // Out to the box, a little short of it.
    let L = 1e9;
    if (c > 0) L = min(L, (BOX[2] - HX) / c);
    if (c < 0) L = min(L, (BOX[0] - HX) / c);
    if (s > 0) L = min(L, (BOX[3] - HY) / s);
    if (s < 0) L = min(L, (BOX[1] - HY) / s);
    th.push(a);
    R.push(L * 0.97);
  }
  // Rings: the hub ring, then the sticky rings while any radial reaches.
  const rings = [HUBR];
  for (let r = R0; r < max(...R) - 3; r += GAP) rings.push(r);
  const id = [];
  for (let k = 0; k < K; k++) {
    id.push([]);
    for (let j = 0; j < rings.length; j++) {
      const r = rings[j];
      id[k].push(r <= R[k] - 2.5 ? node(HX + r * cos(th[k]), HY + r * sin(th[k]), r / R[k]) : -1);
    }
    id[k].frame = node(HX + R[k] * cos(th[k]), HY + R[k] * sin(th[k]), 1);
  }
  // Edges: 0 radial, 1 spiral, 2 frame.
  for (let k = 0; k < K; k++) {
    let prev = hub;
    for (let j = 0; j < rings.length; j++) if (id[k][j] >= 0) edges.push([prev, id[k][j], 0]), (prev = id[k][j]);
    edges.push([prev, id[k].frame, 0]);
    const k2 = (k + 1) % K;
    for (let j = 0; j < rings.length; j++) if (id[k][j] >= 0 && id[k2][j] >= 0) edges.push([id[k][j], id[k2][j], 1]);
    edges.push([id[k].frame, id[k2].frame, 2]);
  }
  // Moorings from the frame to the panel's edges, out of the graph.
  const moor = [];
  for (const [k, ex, ey] of [[1, 63, 127], [6, 0, 127], [9, 0, 0], [14, 63, 0]]) moor.push([id[k].frame, ex, ey]);
  const n = nx.length, cost = edges.map(([a, b, t]) => sqrt((nx[a] - nx[b]) ** 2 + (ny[a] - ny[b]) ** 2) * (t === 1 ? SPIRAL : t === 2 ? 1.3 : 1));
  const adj = Array.from({ length: n }, () => []);
  edges.forEach(([a, b], e) => (adj[a].push([b, e]), adj[b].push([a, e])));
  Object.assign(S, { nx, ny, nu, edges, cost, adj, id, rings, th, R, hub, moor, n, px: new Float32Array(n), py: new Float32Array(n) });
}

// Graph distance of every node from a source node, by Dijkstra.
function dists(S, src) {
  const d = new Float32Array(S.n).fill(1e9), done = new Uint8Array(S.n);
  d[src] = 0;
  for (let it = 0; it < S.n; it++) {
    let u = -1, best = 1e9;
    for (let i = 0; i < S.n; i++) if (!done[i] && d[i] < best) (best = d[i]), (u = i);
    if (u < 0) break;
    done[u] = 1;
    for (const [w, e] of S.adj[u]) if (d[u] + S.cost[e] < d[w]) d[w] = d[u] + S.cost[e];
  }
  return d;
}

export function setup(params) {
  const S = {
    hue: 0, speed: 2, fight: 0, sag: 0.06, t: 0, rt: 0,
    rgb: new Float32Array(N * 3), P: new Float32Array(N), B: new Float32Array(N), T: new Float32Array(N), bg: new Float32Array(N * 3),
    pulses: [], kicks: [], bundles: [],
    phase: "fly", pt: FLY * 0.45, moth: null, sp: { x: HX, y: HY + 1, ox: HX, oy: HY, hd: PI / 2, gait: 0, s: 0, state: "wait", st: 0, feel: 0, heard: 0 },
  };
  buildWeb(S);
  // The sky: violet at the top to blue-black below, in steps of a 64th,
  // and the moon's halo in steps of an eighth.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, v = 1 - y / H, d = sqrt((x + 0.5 - MOONX) ** 2 + (y + 0.5 - MOONY) ** 2);
      const halo = q(cl(1 - (d - MOONR) / 22, 0, 1) ** 2, 8);
      S.bg[i * 3] = q(0.035 + 0.045 * v, 64) + 0.12 * halo;
      S.bg[i * 3 + 1] = q(0.008 + 0.006 * v, 64) + 0.1 * halo;
      S.bg[i * 3 + 2] = q(0.075 + 0.05 * v, 64) + 0.2 * halo;
    }
  params.s = S;
  newMoth(S);
  web(S);
}

// A new moth: it picks a crossing of the spiral and a radial away from the
// hub, not on or next to a radial with a bundle already hanging, and flies
// in from the side it is nearer.
function newMoth(S) {
  let k, j, node, tries = 0;
  do {
    k = floor(Math.random() * K);
    j = 5 + floor(Math.random() * (S.rings.length - 5));
    node = S.id[k][j];
    tries++;
  } while ((node < 0 || S.bundles.some((b) => b.node === node || abs(b.k - k) % (K - 1) < 2)) && tries < 60);
  if (node < 0) (k = 4), (j = 4), (node = S.id[4][4]);
  const left = S.nx[node] > HX ? 0 : 1;
  const d = dists(S, node);
  S.moth = { k, j, node, d, dmax: max(...d), x0: left ? -8 : W + 8, y0: rnd(20, 108), x: 0, y: 0, flap: 0, wrap: 0, next: 0, heave: 0 };
}

// A struggle: a pulse from the moth along the silk, and a kick to the web.
function heave(S, amp) {
  S.pulses.push({ t0: S.t, a: amp, d: S.moth.d });
  S.kicks.push({ t0: S.t, a: amp, x: S.moth.x, y: S.moth.y });
  S.moth.heave = 0.3;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1], 0.2, 3);
  S.fight = cl(k[2], 0, 1);
  S.sag = cl(k[3], 0, 1);
  const g = (d * S.speed) / 2, M = S.moth, sp = S.sp;
  S.t += g;
  S.rt += d;
  S.pt += g;
  M.heave = max(0, M.heave - g);
  M.flap += g * (S.phase === "fly" ? 60 : M.heave > 0 ? 75 : 8);
  // The moth heaves in bouts, two or three heaves a fifth of a second
  // apart, then a rest; Struggle shortens the rest and adds the third.
  const every = mix(1.3, 0.6, S.fight), amp = mix(1.1, 1.375, S.fight);
  if (S.phase === "fly") {
    const u = cl(S.pt / FLY, 0, 1), e = u * u * (3 - 2 * u);
    M.x = mix(M.x0, S.px[M.node], e) + 5 * sin(u * PI * 3) * (1 - u);
    M.y = mix(M.y0, S.py[M.node], e) + 4 * sin(u * PI * 5) * (1 - u) + 1.5 * sin(S.t * 9) * (1 - u);
    if (u >= 1) {
      S.phase = "caught";
      S.pt = 0;
      heave(S, 1.5);
      M.next = 0.2;
      M.bout = 3;
      sp.state = "wait";
      sp.heard = 0;
    }
  } else {
    M.x = S.px[M.node];
    M.y = S.py[M.node];
  }
  if (S.phase === "caught" || S.phase === "wrap") {
    M.next -= g;
    if (M.next <= 0) {
      // While it is being wrapped it fights less and less.
      heave(S, amp * (S.phase === "wrap" ? 0.7 * (1 - M.wrap) : rnd(0.8, 1)));
      if (--M.bout > 0) M.next = 0.2;
      else {
        M.next = every * rnd(0.8, 1.2) * (S.phase === "wrap" ? 1.5 : 1);
        M.bout = 2 + (Math.random() < S.fight ? 1 : 0);
      }
    }
  }
  // The spider: at the hub until the first pulse reaches it, then it turns
  // to the moth's radial, waits for more to be sure (six in all, or four
  // seconds), runs out along the radial, wraps, and walks back.
  const hubT = M.d[S.hub] / V;
  const path = [S.hub];
  for (let j = 0; j <= M.j; j++) if (S.id[M.k][j] >= 0) path.push(S.id[M.k][j]);
  const plen = [0];
  for (let i = 1; i < path.length; i++) plen.push(plen[i - 1] + sqrt((S.px[path[i]] - S.px[path[i - 1]]) ** 2 + (S.py[path[i]] - S.py[path[i - 1]]) ** 2));
  const total = plen[plen.length - 1];
  const at = (s) => {
    let i = 1;
    while (i < path.length - 1 && plen[i] < s) i++;
    const f = cl((s - plen[i - 1]) / (plen[i] - plen[i - 1] || 1), 0, 1);
    return [mix(S.px[path[i - 1]], S.px[path[i]], f), mix(S.py[path[i - 1]], S.py[path[i]], f), atan2(S.py[path[i]] - S.py[path[i - 1]], S.px[path[i]] - S.px[path[i - 1]])];
  };
  sp.st += g;
  sp.feel = max(0, sp.feel - g * 2);
  // Count the pulses that have reached the hub.
  let heard = 0;
  for (const p of S.pulses) if (p.d === M.d && S.t - p.t0 >= hubT) heard++;
  if (heard > sp.heard) (sp.feel = 1), (sp.heard = heard);
  let moving = 0;
  if (sp.state === "wait") {
    sp.s = 0;
    turnTo(sp, PI / 2, g);
    if (S.phase === "caught" && heard >= 1) (sp.state = "turn"), (sp.st = 0);
  } else if (sp.state === "turn") {
    turnTo(sp, S.th[M.k], g * 1.6);
    if (sp.st > TURN && (heard >= 6 || sp.st > 4)) (sp.state = "run"), (sp.st = 0);
  } else if (sp.state === "run") {
    sp.s = min(total - 3, sp.s + RUN * g);
    moving = RUN * g;
    if (sp.s >= total - 3) {
      sp.state = "wrap";
      sp.st = 0;
      S.phase = "wrap";
      S.pt = 0;
      sp.orb = S.th[M.k] + PI;
    }
  } else if (sp.state === "wrap") {
    // Round and round the moth, turning it in silk.
    sp.orb += g * 5.5;
    M.wrap = cl(S.pt / WRAPT, 0, 1);
    moving = g * 18;
    if (M.wrap >= 1) {
      S.bundles.push({ node: M.node, k: M.k, life: 1 });
      if (S.bundles.length > 2) S.bundles[0].fade = 1;
      sp.state = "back";
      sp.st = 0;
      S.phase = "rest";
      S.pt = 0;
      sp.s = total - 3;
    }
  } else if (sp.state === "back") {
    sp.s = max(0, sp.s - BACK * g);
    moving = BACK * g;
    if (sp.s <= 0) (sp.state = "home"), (sp.st = 0);
  } else if (sp.state === "home") {
    turnTo(sp, PI / 2, g * 1.2);
    if (sp.st > REST) {
      sp.state = "wait";
      newMoth(S);
      S.phase = "fly";
      S.pt = 0;
      S.pulses.length = 0;
    }
  }
  if (sp.state === "wrap") {
    const mx = S.px[M.node], my = S.py[M.node];
    sp.x = mx + 4 * cos(sp.orb);
    sp.y = my + 4 * sin(sp.orb);
    sp.hd = sp.orb + PI;
  } else {
    const [x, y, a] = at(sp.s);
    sp.x = x;
    sp.y = y + (sp.s === 0 ? 1 : 0);
    if (sp.state === "run") turnTo(sp, a, g * 3);
    if (sp.state === "back") turnTo(sp, a + PI, g * 3);
  }
  sp.gait += moving * 0.9;
  for (const b of S.bundles) if (b.fade) b.life -= g / 2.5;
  S.bundles = S.bundles.filter((b) => b.life > 0);
  S.pulses = S.pulses.filter((p) => V * (S.t - p.t0) < M.dmax + 4 * TAIL);
  S.kicks = S.kicks.filter((c) => S.t - c.t0 < 2.5);
  web(S);
}

function turnTo(sp, a, rate) {
  const dh = ((a - sp.hd + 3 * PI) % TAU) - PI;
  sp.hd += dh * min(1, rate * 6);
}

// Where every node of the web hangs now: the web's own belly, deepest at
// the hub and nothing at the frame; the pull of the moth, the spider and
// the bundles where they hang; and the quiver each heave sets going.
function web(S) {
  const G = 1 + 6 * S.sag, load = 3 + 5 * S.sag, M = S.moth, sp = S.sp;
  const loads = [];
  if (S.phase !== "fly") loads.push([S.nx[M.node], S.ny[M.node], load]);
  loads.push([sp.ox, sp.oy, load * 0.5]);
  for (const b of S.bundles) loads.push([S.nx[b.node], S.ny[b.node], load * 0.6 * b.life]);
  let qy = 0;
  const kx = [], ky = [], ka = [];
  for (const c of S.kicks) {
    const tau = S.t - c.t0, a = c.a * mix(1, 3, S.fight) * exp(-tau / 0.45) * sin(TAU * 5 * tau);
    qy += 0.6 * a;
    kx.push(c.x), ky.push(c.y), ka.push(a);
  }
  for (let i = 0; i < S.n; i++) {
    const x = S.nx[i], y = S.ny[i], u = S.nu[i], taper = 1 - u * u;
    let dy = G, dx = 0;
    for (const [lx, ly, w] of loads) dy += w * exp(-((x - lx) ** 2 + (y - ly) ** 2) / (2 * 14 * 14));
    let jig = qy;
    for (let c = 0; c < kx.length; c++) {
      const f = exp(-((x - kx[c]) ** 2 + (y - ky[c]) ** 2) / (2 * 16 * 16));
      jig += 1.4 * ka[c] * f;
      dx += 0.8 * ka[c] * f * sin(i * 2.3);
    }
    S.px[i] = x + dx * taper;
    S.py[i] = y + (dy + jig) * taper;
  }
  // The spider's own weight follows it out along the radial.
  sp.ox = sp.x;
  sp.oy = sp.y;
}

// The pulse colour for K1, holding near each of the four stops.
function pulseColour(h) {
  h = (h - floor(h)) * 4;
  const i = floor(h) % 4, j = (i + 1) % 4, f = h - floor(h), g = cl((f - 0.25) / 0.5, 0, 1), s = g * g * (3 - 2 * g);
  return [0, 1, 2].map((c) => mix(PULSE[i][c], PULSE[j][c], s));
}

// The light a pulse puts on a point d along the silk from the moth: a
// sharp front running out at V, a short tail behind it, fading with the
// distance it has run.
function glow(S, d) {
  const fr = S.fr, am = S.am;
  let v = 0;
  for (let i = 0; i < fr.length; i++) {
    const x = fr[i] - d;
    if (x < -FRONT * 3 || x > TAIL * 4) continue;
    v += am[i] * (x < 0 ? exp(-((x / FRONT) ** 2)) : exp(-x / TAIL));
  }
  return v > 0 ? v * exp(-d / S.reach) : 0;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, P, bg } = S;
  rgb.set(bg);
  P.fill(0);
  // The moon: pale, with darker seas in steps.
  for (let y = MOONY - MOONR - 1; y <= MOONY + MOONR + 1; y++)
    for (let x = MOONX - MOONR - 1; x <= MOONX + MOONR + 1; x++) {
      if (x < 0 || x >= W || y < 0) continue;
      const dx = x + 0.5 - MOONX, dy = y + 0.5 - MOONY, r = sqrt(dx * dx + dy * dy);
      if (r > MOONR) continue;
      const sea = exp(-((dx + 3) ** 2 + (dy + 2) ** 2) / 14) * 0.5 + exp(-((dx - 4) ** 2 + (dy - 4) ** 2) / 8) * 0.4 + exp(-((dx - 2) ** 2 + (dy + 5) ** 2) / 5) * 0.3;
      const v = q(0.95 - 0.35 * sea - 0.12 * (r / MOONR) ** 4, 10), o = (y * W + x) * 3;
      rgb[o] = MOON[0] * v;
      rgb[o + 1] = MOON[1] * v;
      rgb[o + 2] = MOON[2] * v;
    }
  // Silk: each thread from node to node, and on it the pulses, with the
  // distance along the silk from the moth taken the short way round.
  const pc = pulseColour(S.hue), M = S.moth, D = M.d;
  // Where each pulse's front has got to, once a frame.
  S.fr = S.pulses.map((p) => V * (S.t - p.t0));
  S.am = S.pulses.map((p) => p.a);
  S.reach = mix(75, 120, S.fight);
  const plot = (x, y, base, pv) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = y * W + x, o = i * 3;
    // Over the moon the silk is a dark line against it.
    const onMoon = (x + 0.5 - MOONX) ** 2 + (y + 0.5 - MOONY) ** 2 < MOONR * MOONR;
    if (onMoon) (rgb[o] *= 0.55), (rgb[o + 1] *= 0.55), (rgb[o + 2] *= 0.6);
    else (rgb[o] = max(rgb[o], SILK[0] * base)), (rgb[o + 1] = max(rgb[o + 1], SILK[1] * base)), (rgb[o + 2] = max(rgb[o + 2], SILK[2] * base));
    if (pv > P[i]) P[i] = pv;
  };
  const seg = (a, b, ca, cb, cost, base) => {
    const x0 = S.px[a], y0 = S.py[a], x1 = S.px[b], y1 = S.py[b];
    const n = Math.ceil(max(abs(x1 - x0), abs(y1 - y0)));
    for (let s = 0; s <= n; s++) {
      const t = n ? s / n : 0, dd = min(ca + t * cost, cb + (1 - t) * cost);
      plot(floor(mix(x0, x1, t) + 0.5), floor(mix(y0, y1, t) + 0.5), base, glow(S, dd));
    }
  };
  S.edges.forEach(([a, b, t], e) => seg(a, b, D[a], D[b], S.cost[e], t === 1 ? SILK_V * 0.85 : SILK_V));
  for (const [a, ex, ey] of S.moor) {
    const x0 = S.px[a], y0 = S.py[a], n = Math.ceil(max(abs(ex - x0), abs(ey - y0)));
    for (let s = 0; s <= n; s++) plot(floor(mix(x0, ex, s / n) + 0.5), floor(mix(y0, ey, s / n) + 0.5), SILK_V * 0.7, 0);
  }
  // The pulse on the silk, and a soft glow round it so it reads from
  // across a room: a blur two LEDs wide, across then down.
  const B = S.B, T = S.T;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let s = 3 * P[i];
      if (x > 0) s += 2 * P[i - 1];
      if (x > 1) s += P[i - 2];
      if (x < W - 1) s += 2 * P[i + 1];
      if (x < W - 2) s += P[i + 2];
      T[i] = s / 9;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let s = 3 * T[i];
      if (y > 0) s += 2 * T[i - W];
      if (y > 1) s += T[i - 2 * W];
      if (y < H - 1) s += 2 * T[i + W];
      if (y < H - 2) s += T[i + 2 * W];
      B[i] = s / 9;
    }
  for (let i = 0; i < N; i++) {
    const p = P[i], b = B[i], o = i * 3;
    if (p <= 0.02 && b <= 0.02) continue;
    const v = max(min(1.2, p), q(min(0.6, 1.4 * b), 6));
    rgb[o] = max(rgb[o], pc[0] * v);
    rgb[o + 1] = max(rgb[o + 1], pc[1] * v);
    rgb[o + 2] = max(rgb[o + 2], pc[2] * v);
  }
  // Each heave flashes round the moth, the light the pulses start from.
  if (M.heave > 0 && S.phase !== "fly") {
    const a = M.heave / 0.3, R = 9;
    for (let y = floor(M.y - R); y <= M.y + R; y++)
      for (let x = floor(M.x - R); x <= M.x + R; x++) {
        const r = sqrt((x + 0.5 - M.x) ** 2 + (y + 0.5 - M.y) ** 2) / R;
        if (r < 1) put(S, x, y, pc, q(a * 0.7 * (1 - r) ** 1.5, 6));
      }
  }
  // Bundles of silk left in the web.
  for (const b of S.bundles) drawBundle(S, S.px[b.node], S.py[b.node], 1, b.life);
  // The moth: wings flapping as it flies, heaving in the web, folding away
  // into the bundle as it is wrapped.
  drawMoth(S, M);
  drawSpider(S, S.sp);
  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, round(255 * cl(rgb[o], 0, 1)), round(255 * cl(rgb[o + 1], 0, 1)), round(255 * cl(rgb[o + 2], 0, 1)));
}

function put(S, x, y, c, a) {
  x = floor(x);
  y = floor(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  S.rgb[o] = mix(S.rgb[o], c[0], a);
  S.rgb[o + 1] = mix(S.rgb[o + 1], c[1], a);
  S.rgb[o + 2] = mix(S.rgb[o + 2], c[2], a);
}

function drawBundle(S, cx, cy, size, life) {
  for (let y = floor(cy - 6); y <= cy + 6; y++)
    for (let x = floor(cx - 4); x <= cx + 4; x++) {
      const u = (x + 0.5 - cx) / (3 * size), v = (y + 0.5 - cy) / (4.6 * size), r = u * u + v * v;
      if (r > 1) continue;
      // Wound round: bands of brighter and dimmer silk across it.
      const band = ((y + x * 0.6 + 40) % 2.4) < 1.2 ? 1 : 0.78;
      put(S, x, y, WRAP.map((c) => c * band), min(1, life * 1.5));
    }
}

function drawMoth(S, M) {
  const wrap = M.wrap, open = 1 - wrap;
  if (wrap > 0) drawBundle(S, M.x, M.y, 0.25 + 0.75 * wrap, 1);
  if (open <= 0.05) return;
  // Wing span: the flap swings it between full and a sliver.
  const f = 0.35 + 0.65 * abs(cos(M.flap)), span = 7 * f * open;
  for (let side = -1; side <= 1; side += 2)
    for (let y = -5; y <= 5; y++)
      for (let x = 1; x <= 8; x++) {
        const wx = x / max(0.6, span), wy = y / 5;
        // Forewing above, smaller hindwing below.
        const fore = wy < 0.2 && wx < 1 && wy > -1 + 0.6 * wx;
        const hind = wy >= 0.2 && wx < 0.75 && wy < 0.95 - 0.5 * wx;
        if (!fore && !hind) continue;
        // A grey eye-spot on each forewing, a darker leading edge.
        const spot = fore && abs(wx - 0.5) < 0.17 && abs(wy + 0.35) < 0.15;
        const shade = spot ? 0.58 : hind ? 0.75 : x === 1 || wy < -0.6 ? 0.85 : 1;
        put(S, M.x + side * (x - 0.5), M.y + y, WING.map((c) => c * shade * (0.6 + 0.4 * open)), 1);
      }
  for (let y = -4; y <= 4; y++) put(S, M.x, M.y + y, MBODY, 1);
  put(S, M.x - 1, M.y - 5, MBODY, 0.7);
  put(S, M.x + 1, M.y - 5, MBODY, 0.7);
}

// The spider: abdomen behind, head in front, eight legs that step as it
// walks and twitch when a pulse reaches it.
function drawSpider(S, sp) {
  const fx = cos(sp.hd), fy = sin(sp.hd), sx = -fy, sy = fx, x = sp.x, y = sp.y;
  const line = (x0, y0, x1, y1, c) => {
    const n = Math.ceil(max(abs(x1 - x0), abs(y1 - y0)));
    for (let s = 0; s <= n; s++) put(S, mix(x0, x1, s / (n || 1)) + 0.5, mix(y0, y1, s / (n || 1)) + 0.5, c, 1);
  };
  const tw = 0.25 * sp.feel * sin(S.rt * 40);
  for (let side = -1; side <= 1; side += 2)
    for (let k = 0; k < 4; k++) {
      const a = [0.5, 1.1, 1.9, 2.5][k] + 0.25 * sin(sp.gait + k * 1.7 + (side > 0 ? PI : 0)) + tw;
      const ca = cos(a), sa = side * sin(a), r = 3.2;
      const kx = x + (ca * fx + sa * sx) * r, ky = y + (ca * fy + sa * sy) * r;
      // The lower leg bends forward for the front pair, back for the rear.
      const ex = kx + (ca * fx + sa * sx) * 2.8 + (k < 2 ? fx : -fx) * 1.2, ey = ky + (ca * fy + sa * sy) * 2.8 + (k < 2 ? fy : -fy) * 1.2;
      line(x, y, kx, ky, SLEG);
      line(kx, ky, ex, ey, SLEG);
    }
  const blob = (cx, cy, ra, rb, c) => {
    for (let yy = floor(cy - 4); yy <= cy + 4; yy++)
      for (let xx = floor(cx - 4); xx <= cx + 4; xx++) {
        const px = xx + 0.5 - cx, py = yy + 0.5 - cy, u = px * fx + py * fy, v = px * sx + py * sy;
        if ((u / ra) ** 2 + (v / rb) ** 2 <= 1) put(S, xx, yy, c, 1);
      }
  };
  blob(x - 2.2 * fx, y - 2.2 * fy, 2.8, 2.2, SBODY);
  blob(x + 0.8 * fx, y + 0.8 * fy, 1.5, 1.3, SBODY.map((c) => c * 1.2));
  put(S, x + 1.6 * fx + 0.7 * sx, y + 1.6 * fy + 0.7 * sy, SEYE, 1);
  put(S, x + 1.6 * fx - 0.7 * sx, y + 1.6 * fy - 0.7 * sy, SEYE, 1);
}
