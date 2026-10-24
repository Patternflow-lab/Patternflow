// ===== Patternflow pattern =====
// Title:   Fortune's Sweep
// Family:  algo
// Idea:    A gold sweep line falls down the panel and above it the Voronoi diagram of a scatter of sites becomes certain behind Fortune's beach line, a necklace of parabolic arcs one per site, where a new arc grows from a spike each time the line passes a site and an arc pinches out at each circle event, the empty circle through three sites flashing as it touches the line and a Voronoi vertex is fixed, while the last diagram waits dimmer below for the next sweep.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Fortune's sweep-line algorithm for Voronoi diagrams (Steven Fortune, 1986), pattern round 37
// Round:   37
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Sites=16..48, Weights=0..1
//
// Knob 1: Hue. Turns the cells, the arcs and the gold of the sweep line round the wheel together. At 0 the cells are sea blue, teal and indigo with gold for the line and the circles; at 0.5 they are coral, peach and sand, lifted so they never read brown, with a blue line, and the waiting diagram leans to wine and green.
// Knob 2: Speed. Rows a second the sweep line falls, 11 per unit: 22 at 2, so one sweep and its 0.6 s hold take about 7.5 s; at 0.2 a sweep takes over a minute, at 3 about 5 s.
// Knob 3: Sites. How many sites each sweep scatters, 16 to 48, spread by best-candidate sampling so cells come out even: about 23 LEDs across at 16 and 13 at 48. Sixteen sites give about 20 circle events a sweep, 48 about 77.
// Knob 4: Weights. Additive weights, the distance to site i being |p - s_i| - w_i, which Fortune's 1987 paper sweeps the same way. At 0 plain Voronoi with straight edges; at 0.06 the weights reach 0.7 LED and the edges bend a hair; at 1 they reach 11 LEDs at 16 sites, the edges are hyperbolas, the heavy sites wear a faint circle of their weight and their arcs are born as soon as the line touches the top of that circle.
// Buttons: K1 tap starts a new sweep at once with new sites, and the diagram so far waits below.

// The picture is drawn per LED with no event queue. For a point p above the
// sweep line at height L (y grows down), let D1(p) be the distance to its
// nearest site, weighted when Weights is up. p is certain when D1(p) <= L - p.y: no site the line has
// not reached yet can come closer to p than the line itself. The beach line
// is D1(p) = L - p.y, and on it the nearest site is always one the line has
// passed, so the global nearest site is the right one and the diagram's
// tables are built once a sweep. Only L changes from frame to frame.
//
// The circle events come from the diagram's vertices: a point v at weighted
// distance r from three sites and no nearer to any other. Its event falls
// at L = v.y + r, when the circle round v touches the sweep line from above.
// Checked in a scratch script against the beach line worked out from the
// parabolas themselves, each site's arc being the parabola with the site
// for focus and y = L + w for directrix: 24 diagrams, four each of 16, 32
// and 48 sites, unweighted and at full weight, 1,176 events. 26 fell within
// 0.002 rows of the third site's own arrival or of a neighbouring event and
// were left out. At each of the other 1,150, just before the event the
// three sites' arcs lie side by side on the beach line, and just after it
// the middle one is gone and the other two meet. Half a row before, the
// arc about to vanish is at most 3 LEDs wide.

const W = 64, H = 128, N = W * H, MAXS = 48;
const { floor, min, max, sqrt, round, abs, exp, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Rows a second per unit of Speed.
const ROWS = 11;
// The finished diagram holds this long before the next sweep, in seconds.
const HOLD = 0.6;
// A circle event flashes this long, in seconds.
const FLASH = 0.6;
// The last diagram fades to this share of its brightness as the next sweep starts.
const DIM = 0.4;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function newSet() {
  return {
    sx: new Float32Array(MAXS), sy: new Float32Array(MAXS), sr: new Float32Array(MAXS), sw: new Float32Array(MAXS),
    pref: new Uint8Array(MAXS), tone: new Uint8Array(MAXS), gh: new Float32Array(MAXS * 3),
    d1: new Float32Array(N), own: new Uint8Array(N), ed: new Float32Array(N), g1: new Float32Array(N),
    adj: new Uint8Array(MAXS * MAXS), col: new Float32Array(MAXS * 3), tint: new Float32Array(MAXS * 3),
    n: 0, wk: -1, hue: NaN, ev: [], evi: 0, lStart: -3, lEnd: 150,
  };
}

// Best-candidate sampling, twelve tries a site: every prefix of the 48 is
// spread about evenly, so Sites can take the first n.
function scatter(S) {
  for (let i = 0; i < MAXS; i++) {
    let bx = 0, by = 0, bd = -1;
    for (let t = 0, tries = i === 0 ? 1 : 12; t < tries; t++) {
      const x = 2 + random() * 60, y = 2 + random() * 124;
      let d = 1e9;
      for (let j = 0; j < i; j++) {
        const dx = x - S.sx[j], dy = y - S.sy[j];
        d = min(d, dx * dx + dy * dy);
      }
      if (d > bd) (bd = d), (bx = x), (by = y);
    }
    S.sx[i] = bx;
    S.sy[i] = by;
    S.sr[i] = random();
    S.pref[i] = floor(random() * 4);
  }
  S.n = 0;
  S.hue = NaN;
}

// The vertices of the additively weighted diagram: |v - s| = r + w for the
// three sites. Subtracting the squared equations pairwise leaves v linear in
// r, and the first one then gives a quadratic in r. With no weights it is
// the circumcircle.
function vertices(S, a, b, c, out) {
  const { sx, sy, sw } = S;
  const ax = sx[a], ay = sy[a], wa = sw[a];
  const m11 = 2 * (ax - sx[b]), m12 = 2 * (ay - sy[b]), m21 = 2 * (ax - sx[c]), m22 = 2 * (ay - sy[c]);
  const det = m11 * m22 - m12 * m21;
  if (abs(det) < 1e-6) return 0;
  const aa = ax * ax + ay * ay;
  const k1 = sw[b] * sw[b] - wa * wa - sx[b] * sx[b] - sy[b] * sy[b] + aa, q1 = 2 * (sw[b] - wa);
  const k2 = sw[c] * sw[c] - wa * wa - sx[c] * sx[c] - sy[c] * sy[c] + aa, q2 = 2 * (sw[c] - wa);
  // v = P + Q r
  const px = (k1 * m22 - m12 * k2) / det, py = (m11 * k2 - k1 * m21) / det;
  const qx = (q1 * m22 - m12 * q2) / det, qy = (m11 * q2 - q1 * m21) / det;
  const dx = px - ax, dy = py - ay;
  const A = qx * qx + qy * qy - 1, B = 2 * (dx * qx + dy * qy - wa), C = dx * dx + dy * dy - wa * wa;
  let k = 0;
  const rs = [];
  if (abs(A) < 1e-9) {
    if (abs(B) > 1e-9) rs.push(-C / B);
  } else {
    const disc = B * B - 4 * A * C;
    if (disc < 0) return 0;
    const sq = sqrt(disc);
    rs.push((-B - sq) / (2 * A), (-B + sq) / (2 * A));
  }
  const wmin = min(wa, sw[b], sw[c]);
  for (const r of rs) {
    if (r + wmin < -1e-6) continue;
    const vx = px + qx * r, vy = py + qy * r;
    let empty = true;
    for (let l = 0; l < S.n && empty; l++) {
      if (l === a || l === b || l === c) continue;
      const ex = vx - sx[l], ey = vy - sy[l];
      if (sqrt(ex * ex + ey * ey) - sw[l] < r - 1e-4) empty = false;
    }
    if (!empty) continue;
    // Only circles that reach the panel.
    if (vx + r < 0 || vx - r > W - 1 || vy + r < 0 || vy - r > H - 1) continue;
    out.push({ t: vy + r, x: vx, y: vy, r, fired: -1e9 });
    k++;
  }
  return k;
}

// The tables of one diagram: nearest weighted distance, its site, the
// distance in LEDs to the nearest edge and the slope of D1(p) - (L - p.y),
// which turns the beach line's level into a distance in LEDs too.
function build(S, n, wk) {
  S.n = n;
  S.wk = wk;
  const wmax = 0.5 * sqrt(N / n) * wk;
  const { sx, sy, sw, d1, own, ed, g1, adj } = S;
  for (let i = 0; i < n; i++) sw[i] = wmax * S.sr[i];
  adj.fill(0);
  let lEnd = 0;
  for (let p = 0; p < N; p++) {
    const x = p % W, y = (p - x) / W;
    let b1 = 1e9, b2 = 1e9, i1 = 0, i2 = 0, r1 = 1, r2 = 1;
    for (let i = 0; i < n; i++) {
      const dx = x - sx[i], dy = y - sy[i], r = sqrt(dx * dx + dy * dy), d = r - sw[i];
      if (d < b1) (b2 = b1), (i2 = i1), (r2 = r1), (b1 = d), (i1 = i), (r1 = r);
      else if (d < b2) (b2 = d), (i2 = i), (r2 = r);
    }
    d1[p] = b1;
    own[p] = i1;
    r1 = max(r1, 1e-3);
    r2 = max(r2, 1e-3);
    const ux = (x - sx[i1]) / r1, uy = (y - sy[i1]) / r1, vx = (x - sx[i2]) / r2, vy = (y - sy[i2]) / r2;
    const ge = sqrt((ux - vx) * (ux - vx) + (uy - vy) * (uy - vy));
    ed[p] = (b2 - b1) / max(0.3, ge);
    g1[p] = sqrt(ux * ux + (uy + 1) * (uy + 1));
    if (ed[p] < 1.5) adj[i1 * MAXS + i2] = adj[i2 * MAXS + i1] = 1;
    if (y + b1 > lEnd) lEnd = y + b1;
  }
  S.lEnd = lEnd + 1.5;
  let ls = -3;
  for (let i = 0; i < n; i++) ls = min(ls, sy[i] - sw[i] - 1);
  S.lStart = ls;
  // Four tones, neighbours apart where the greedy pass manages it.
  for (let i = 0; i < n; i++) {
    let used = 0;
    for (let j = 0; j < i; j++) if (adj[i * MAXS + j]) used |= 1 << S.tone[j];
    let t = S.pref[i];
    for (let k = 0; k < 4; k++) if (!(used & (1 << ((S.pref[i] + k) & 3)))) {
      t = (S.pref[i] + k) & 3;
      break;
    }
    S.tone[i] = t;
  }
  const ev = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) vertices(S, a, b, c, ev);
  // Off-panel vertices whose circle would only touch the line after the
  // last LED is certain never fire: about one in twelve.
  S.ev = ev.filter((e) => e.t <= S.lEnd).sort((u, v) => u.t - v.t);
  S.evi = 0;
  S.hue = NaN;
}

// Calm tones round the base hue. Where a tone lands on red, orange or
// yellow it is paled and lifted, as a dark orange cell reads brown and a
// dark yellow one olive on the panel; yellow is lifted most.
const TONES = [[0, 0.72, 0.52], [0.075, 0.6, 0.46], [-0.085, 0.62, 0.5], [0.025, 0.42, 0.6]];
const band = (v, a, b, e) => cl((v - a) / e, 0, 1) * cl((b - v) / e, 0, 1);
function paint(S, hue) {
  for (let i = 0; i < S.n; i++) {
    const tn = TONES[S.tone[i]], h = hue + 0.56 + tn[0], hh = h - floor(h), hw = hh > 0.9 ? hh - 1 : hh;
    const warm = band(hw, -0.06, 0.3, 0.05), yel = band(hw, 0.08, 0.32, 0.05);
    hsv(h, tn[1] * (1 - 0.3 * warm - 0.15 * yel), tn[2] + 0.28 * warm + 0.14 * yel, S.col, i * 3);
    hsv(h, 0.32, 1, S.tint, i * 3);
    // The waiting diagram is the same tone at 40%, except that a dim
    // orange or yellow is brown and a dim lime is olive whatever is done to
    // it, so those ghosts lean to wine below the yellow and to green above.
    // The turn is a jump: a blend of the two goes through olive again.
    const gw = band(hw, -0.07, 0.33, 0.04);
    hsv(h + gw * ((hw < 0.11 ? -0.03 : 0.36) - hw), tn[1] * 0.85, tn[2] * DIM * 1.05, S.gh, i * 3);
  }
  S.hue = hue;
}

function startSweep(st) {
  const t = st.old;
  st.old = st.cur;
  st.cur = t;
  scatter(st.cur);
  build(st.cur, st.n, st.wk);
  st.L = st.cur.lStart;
  st.fade = 1;
  st.hold = 0;
}

export function setup(params) {
  const st = (params.s = {
    cur: newSet(), old: newSet(), n: 16, wk: 0.06, hue: 0, speed: 2, L: 0, fade: 0, hold: 0, clock: 0,
    buf: new Float32Array(N * 3), acc: new Float32Array(3), edge: new Float32Array(3), pale: new Float32Array(3),
  });
  scatter(st.cur);
  build(st.cur, st.n, st.wk);
  startSweep(st);
  // Open a third of the way down a sweep, with the first diagram waiting below.
  st.L = 36;
  st.fade = 0;
  for (const e of st.cur.ev) if (e.t <= st.L) e.fired = -1e9;
  while (st.cur.evi < st.cur.ev.length && st.cur.ev[st.cur.evi].t <= st.L) st.cur.evi++;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const st = params.s, k = input.knobValues || [0, 2, 16, 0.06], d = cl(dt || 0, 0, 0.1);
  st.hue = k[0];
  st.speed = cl(k[1], 0.2, 3);
  st.clock += d;
  const n = round(cl(k[2], 16, 48)), wk = cl(k[3], 0, 1);
  if (n !== st.n || abs(wk - st.wk) > 0.002) {
    st.n = n;
    st.wk = wk;
    // The diagram changes under the sweep: rebuild both, and treat the
    // events the line has already passed as fixed, without a flash.
    for (const S of [st.cur, st.old]) build(S, n, wk);
    const C = st.cur;
    while (C.evi < C.ev.length && C.ev[C.evi].t <= st.L) C.evi++;
    st.L = max(st.L, C.lStart);
  }
  if (input.btnPressed && input.btnPressed[0]) startSweep(st);
  const C = st.cur;
  if (st.fade > 0) st.fade = max(0, st.fade - d / 0.9);
  if (st.L < C.lEnd) {
    st.L = min(C.lEnd, st.L + d * st.speed * ROWS);
    while (C.evi < C.ev.length && C.ev[C.evi].t <= st.L) C.ev[C.evi++].fired = st.clock;
  } else if ((st.hold += d) >= HOLD) startSweep(st);
}

export function draw(display, params) {
  const st = params.s;
  if (!st) return;
  const C = st.cur, O = st.old, L = st.L, buf = st.buf, acc = st.acc, edge = st.edge, pale = st.pale;
  if (C.hue !== st.hue) paint(C, st.hue);
  if (O.hue !== st.hue) paint(O, st.hue);
  // Gold for the line and the circles at Hue 0, opposite the cells.
  const ah = st.hue + 0.125, ahh = ah - floor(ah);
  hsv(ah, 0.62 - 0.2 * cl((ahh - 0.2) / 0.1, 0, 1) * cl((0.4 - ahh) / 0.1, 0, 1), 1, acc, 0);
  hsv(st.hue + 0.56, 0.18, 1, edge, 0);
  hsv(st.hue + 0.56, 0.1, 1, pale, 0);
  const fd = st.fade, ok = DIM + (1 - DIM) * fd;
  const Cc = C.col, Ct = C.tint, Oc = O.col, Og = O.gh;
  for (let y = 0, p = 0; y < H; y++) {
    // Between the beach line and the sweep line nothing is known yet: the
    // old diagram shows there at two thirds of its waiting level.
    const zone = y < L ? 0.62 : 1;
    // The line is a full row at any L, with a soft second row as it moves.
    const sw = cl(1 - (abs(y - L) - 0.5) / 0.6, 0, 1);
    for (let x = 0; x < W; x++, p++) {
      const oo = O.own[p] * 3, oe = cl(1 - O.ed[p] / 0.9, 0, 1) * 0.75;
      let r = ((Og[oo] + (Oc[oo] - Og[oo]) * fd) * (1 - oe) + edge[0] * oe * ok) * zone;
      let g = ((Og[oo + 1] + (Oc[oo + 1] - Og[oo + 1]) * fd) * (1 - oe) + edge[1] * oe * ok) * zone;
      let b = ((Og[oo + 2] + (Oc[oo + 2] - Og[oo + 2]) * fd) * (1 - oe) + edge[2] * oe * ok) * zone;
      const f = C.d1[p] - (L - y), dist = f / max(0.5, C.g1[p]);
      if (dist < 1.2) {
        const co = C.own[p] * 3, m = cl(0.5 - dist, 0, 1);
        // Fresh ground just behind the beach line glows and settles over
        // about four rows.
        const glow = 0.5 * exp(-max(0, -dist) / 3.5);
        let nr = Cc[co] + (Ct[co] - Cc[co]) * glow, ng = Cc[co + 1] + (Ct[co + 1] - Cc[co + 1]) * glow, nb = Cc[co + 2] + (Ct[co + 2] - Cc[co + 2]) * glow;
        const e = cl(1 - C.ed[p] / 0.9, 0, 1) * 0.92;
        nr += (edge[0] - nr) * e;
        ng += (edge[1] - ng) * e;
        nb += (edge[2] - nb) * e;
        r += (nr - r) * m;
        g += (ng - g) * m;
        b += (nb - b) * m;
        // The arc itself, a pale bright tint of its own site, whitening where
        // an edge meets it: those meeting points are the breakpoints that
        // trace the edges down.
        const a = cl(1 - abs(dist) / 0.8, 0, 1);
        if (a > 0) {
          const wh = e * 0.8;
          r += (Ct[co] + (pale[0] - Ct[co]) * wh - r) * a;
          g += (Ct[co + 1] + (pale[1] - Ct[co + 1]) * wh - g) * a;
          b += (Ct[co + 2] + (pale[2] - Ct[co + 2]) * wh - b) * a;
        }
      }
      if (sw > 0) {
        r += (acc[0] - r) * sw;
        g += (acc[1] - g) * sw;
        b += (acc[2] - b) * sw;
      }
      buf[p * 3] = r;
      buf[p * 3 + 1] = g;
      buf[p * 3 + 2] = b;
    }
  }
  const put = (x, y, r, g, b, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3;
    buf[o] += (r - buf[o]) * a;
    buf[o + 1] += (g - buf[o + 1]) * a;
    buf[o + 2] += (b - buf[o + 2]) * a;
  };
  // Weight circles, faint, for sites that carry more than 1.5 LEDs.
  for (let i = 0; i < C.n; i++) {
    const w = C.sw[i];
    if (w < 1.5) continue;
    const seen = C.sy[i] - w <= L, a = seen ? 0.3 : 0.22;
    for (let y = max(0, floor(C.sy[i] - w - 1)); y <= min(H - 1, C.sy[i] + w + 1); y++)
      for (let x = max(0, floor(C.sx[i] - w - 1)); x <= min(W - 1, C.sx[i] + w + 1); x++) {
        const dx = x - C.sx[i], dy = y - C.sy[i], q = 1 - abs(sqrt(dx * dx + dy * dy) - w) / 0.6;
        if (q > 0) put(x, y, pale[0], pale[1], pale[2], a * q);
      }
  }
  // Circle events: the empty circle flashes in the line's colour, touching
  // the line at its foot, and the vertex it fixes keeps a gold point.
  for (let j = 0; j < C.evi; j++) {
    const e = C.ev[j], age = st.clock - e.fired;
    put(round(e.x), round(e.y), acc[0], acc[1], acc[2], 0.85);
    if (age >= FLASH) continue;
    const fa = (1 - age / FLASH) * (1 - age / FLASH), R = e.r;
    put(round(e.x), round(e.y), 1, 1, 1, fa);
    for (let y = max(0, floor(e.y - R - 1)); y <= min(H - 1, e.y + R + 1); y++)
      for (let x = max(0, floor(e.x - R - 1)); x <= min(W - 1, e.x + R + 1); x++) {
        const dx = x - e.x, dy = y - e.y, q = 1 - abs(sqrt(dx * dx + dy * dy) - R) / 0.65;
        if (q > 0) put(x, y, acc[0], acc[1], acc[2], q * fa * 0.9);
      }
  }
  // Sites: white once the line has reached them, a dim grey point before.
  for (let i = 0; i < C.n; i++) {
    const x = round(C.sx[i]), y = round(C.sy[i]);
    if (C.sy[i] - C.sw[i] <= L) {
      put(x, y, 1, 1, 1, 1);
      put(x - 1, y, 1, 1, 1, 0.35);
      put(x + 1, y, 1, 1, 1, 0.35);
      put(x, y - 1, 1, 1, 1, 0.35);
      put(x, y + 1, 1, 1, 1, 0.35);
    } else put(x, y, 0.5, 0.5, 0.5, 1);
  }
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) display.setPixel(x, y, round(255 * min(1, buf[p * 3])), round(255 * min(1, buf[p * 3 + 1])), round(255 * min(1, buf[p * 3 + 2])));
}
