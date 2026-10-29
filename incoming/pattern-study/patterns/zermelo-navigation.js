// ===== Patternflow pattern =====
// Title:   Zermelo Navigation
// Family:  line
// Idea:    A harbour at the foot of the panel sends out, twice a second, the front of every place a boat rowing at one speed could have reached by then, and the fronts climb the whole panel bent by a current of eddies or a wandering jet, fold into corners where two ways round meet, string beads along the thin quickest routes to six places, and stop at hatched shadows where water pours in from beyond the panel faster than any boat can row.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Zermelo's navigation problem (Ernst Zermelo, 1931), arrival times by Dijkstra's algorithm (Edsger Dijkstra, 1959) on a 32-heading stencil, pattern round 66
// Round:   66
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Current=0..2.5, Shape=0..1, Harbour=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel together: at 0 a front leaves the harbour gold, turns green halfway and reaches the far coast blue, and the shadows are rose.
// Knob 2: Current. The fastest water in boat speeds. At 0 the fronts are circles and the routes straight; up to 1 every place can be reached; past 1 shadows open, at Shape 0 on 2.4% of the panel at 1.5, 8.9% at 2 (the opening) and 18.5% at 2.5.
// Knob 3: Shape. Three eddies centred near the panel's sides at 0, a jet leaving the coast at the bottom centre and wandering as it climbs at 1, both at full strength at 0.5. With the harbour inside a jet faster than the boat, the fronts are teardrops carried up and only a cone above the harbour is reached first.
// Knob 4: Harbour. Where the harbour stands along the coast, from column 8 at -1 to column 56 at 1; the shadows stay where they are, since they belong to the current and the panel's edge, not to the harbour.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, exp, sin, cos, round, PI, cosh } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const INF = 1e9;
const HY = 121; // the harbour's row
const RATE = 18; // the boat's speed in LEDs per second
const GAP = 9; // a new front every GAP / RATE seconds
const SOLVE = 20; // frames over which one field of arrival times is solved
const NP = 240; // tracers in the water

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// The stencil: every step (a, b) with |a|, |b| <= 3 and gcd 1, 32 headings.
// The widest gap between headings is 18.4 degrees, so in still water a
// stencil path is at most 1 / cos(9.2 deg) - 1 = 1.3% longer than the
// straight line; measured over the panel it is 0.66% on average.
const SA = [], SB = [], SL = [], SUX = [], SUY = [];
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
for (let a = -3; a <= 3; a++)
  for (let b = -3; b <= 3; b++)
    if ((a || b) && gcd(abs(a), abs(b)) === 1) {
      const l = sqrt(a * a + b * b);
      SA.push(a); SB.push(b); SL.push(l); SUX.push(a / l); SUY.push(b / l);
    }
const ND = SA.length;

// Ground speed along unit heading u in current w, the boat rowing at 1:
// s solves |s u - w| = 1, s = u.w + sqrt(1 - |w|^2 + (u.w)^2). Returns the
// time per unit length, or INF when no heading of the boat makes way along
// u. While |w| < 1 every u makes way; past 1 only a cone around w does.
function slow(wx, wy, ux, uy) {
  const d = ux * wx + uy * wy, disc = 1 - wx * wx - wy * wy + d * d;
  if (disc < 0) return INF;
  const s = d + sqrt(disc);
  return s > 1e-4 ? 1 / s : INF;
}

// The current at (x, y) in LEDs, in boat speeds. Both parts come from a
// stream function psi, w = (dpsi/dy, -dpsi/dx), so no water is made or lost
// inside the panel; it only comes in and goes out through the edges.
function current(F, x, y, out) {
  let wx = 0, wy = 0;
  if (F.ge) {
    // Gaussian eddies, psi = G exp(-r^2 / 2R^2), fastest at r = R. The coast
    // calms them: psi is multiplied by c(y), 1 down to row 92 and 0 at the
    // bottom edge, so the harbour never sits in a strong eddy.
    const R2 = 169, z = (y - 92) / 36;
    const c = z <= 0 ? 1 : z >= 1 ? 0 : 0.5 + 0.5 * cos(PI * z), dc = z <= 0 || z >= 1 ? 0 : (-0.5 * PI * sin(PI * z)) / 36;
    for (let k = 0; k < 9; k += 3) {
      const dx = x - F.E[k], dy = y - F.E[k + 1], p = F.E[k + 2] * F.ge * exp(-(dx * dx + dy * dy) / (2 * R2)), e = p / R2;
      wx += -dy * e * c + p * dc;
      wy += dx * e * c;
    }
  }
  if (F.gj) {
    // A jet leaving the coast at the bottom centre, wandering more as it
    // climbs: psi = J L tanh((x - X(y)) / L), X = 32 + A(y) sin(k y - phase).
    const L = 13, k = (2 * PI) / 52, A = 9 * (1 - y / H), ph = k * y - F.th;
    const X = 32 + A * sin(ph), dX = (-9 / H) * sin(ph) + A * k * cos(ph), c = 1 / cosh((x - X) / L), j = F.gj * c * c;
    wx -= j * dX;
    wy -= j;
  }
  out[0] = wx;
  out[1] = wy;
}

// Where the quickest routes go: the top corners, two places on the far
// coast and one on each side halfway up.
const TARGETS = [4, 2, 22, 1, 42, 1, 60, 2, 2, 62, 62, 62];

export function setup(params) {
  params.s = {
    WX: new Float32Array(N), WY: new Float32Array(N), Tn: new Float32Array(N), pred: new Int32Array(N),
    done: new Uint8Array(N), pos: new Int32Array(N), hp: new Int32Array(N), hn: 0,
    Ta: new Float32Array(N), Tb: new Float32Array(N), T: new Float32Array(N), DWX: new Float32Array(N), DWY: new Float32Array(N),
    ra: 120, rb: 120, routes: [], fade: 1, solving: false, src: 0, t: 0, tau: 0, started: false,
    px: new Float32Array(NP), py: new Float32Array(NP), pa: new Float32Array(NP),
    rgb: new Float32Array(N * 3), lut: new Float32Array(65 * 3), sh: new Float32Array(3), hue: 0,
    F: { ge: 0, gj: 0, th: 0, hx: 32, E: new Float32Array(9) }, w: [0, 0],
  };
  return params.s;
}

// An indexed binary heap keyed on Tn, so a node's key can drop in place.
function up(S, i, v) {
  const hp = S.hp, pos = S.pos, T = S.Tn, key = T[v];
  while (i > 0) {
    const p = (i - 1) >> 1, pv = hp[p];
    if (T[pv] <= key) break;
    hp[i] = pv;
    pos[pv] = i;
    i = p;
  }
  hp[i] = v;
  pos[v] = i;
}

function pop(S) {
  const hp = S.hp, pos = S.pos, T = S.Tn, top = hp[0];
  pos[top] = -1;
  const n = --S.hn;
  if (n > 0) {
    const last = hp[n], key = T[last];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= n) break;
      if (c + 1 < n && T[hp[c + 1]] < T[hp[c]]) c++;
      if (T[hp[c]] >= key) break;
      hp[i] = hp[c];
      pos[hp[i]] = i;
      i = c;
    }
    hp[i] = last;
    pos[last] = i;
  }
  return top;
}

// Start a solve for the knobs and the clock `at` seconds: the eddies ride
// small circles and the jet's meander travels up it, once in 40 s.
function begin(S, kv, at) {
  const F = S.F, th = (at * 2 * PI) / 40, cur = cl(kv[1] ?? 2, 0, 2.5), m = cl(kv[2] || 0, 0, 1);
  F.th = th;
  F.ge = cur * 13 * 1.6487 * min(1, 2 - 2 * m);
  F.gj = cur * min(1, 2 * m);
  F.hx = 32 + 24 * cl(kv[3] ?? 0.06, -1, 1);
  const E = F.E;
  E[0] = 4 + 3 * sin(th); E[1] = 98 + 4 * cos(th); E[2] = 1;
  E[3] = 60 - 3 * sin(th + 2); E[4] = 62 + 4 * cos(th + 2); E[5] = -1;
  E[6] = 4 + 3 * sin(th + 4); E[7] = 26 + 4 * cos(th + 4); E[8] = 1;
  const w = S.w;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      current(F, x + 0.5, y + 0.5, w);
      S.WX[y * W + x] = w[0];
      S.WY[y * W + x] = w[1];
    }
  S.Tn.fill(INF);
  S.done.fill(0);
  S.pos.fill(-1);
  S.hn = 0;
  const src = (S.src = HY * W + round(F.hx));
  S.Tn[src] = 0;
  S.pred[src] = -1;
  up(S, S.hn++, src);
  S.solving = true;
}

// Dijkstra over the stencil, settling at most `budget` LEDs. A step's time
// is its length times the mean slowness at its two ends; a step with an end
// where no heading makes way along it is not taken.
function work(S, budget) {
  const T = S.Tn, WX = S.WX, WY = S.WY, done = S.done, pred = S.pred, pos = S.pos;
  while (S.hn > 0 && budget-- > 0) {
    const u = pop(S);
    done[u] = 1;
    const ux = u % W, uy = (u - ux) / W, tu = T[u], wx = WX[u], wy = WY[u];
    for (let k = 0; k < ND; k++) {
      const vx = ux + SA[k], vy = uy + SB[k];
      if (vx < 0 || vx >= W || vy < 0 || vy >= H) continue;
      const v = vy * W + vx;
      if (done[v]) continue;
      const a = slow(wx, wy, SUX[k], SUY[k]);
      if (a >= INF) continue;
      const b = slow(WX[v], WY[v], SUX[k], SUY[k]);
      if (b >= INF) continue;
      const tv = tu + SL[k] * 0.5 * (a + b);
      if (tv < T[v]) {
        T[v] = tv;
        pred[v] = u;
        up(S, pos[v] >= 0 ? pos[v] : S.hn++, v);
      }
    }
  }
  return S.hn === 0;
}

// A solved field becomes the one faded in; the routes are traced back from
// each target along the steps that reached it, and the colour scale is set
// by the mean time to the far coast.
function finish(S) {
  S.Ta.set(S.Tb);
  S.Tb.set(S.Tn);
  S.DWX.set(S.WX);
  S.DWY.set(S.WY);
  S.fade = 0;
  S.solving = false;
  S.routes = [];
  for (let k = 0; k < TARGETS.length; k += 2) {
    let v = TARGETS[k + 1] * W + TARGETS[k];
    if (S.Tn[v] >= INF) continue;
    const path = [];
    for (; v >= 0 && path.length < N; v = S.pred[v]) path.push(v);
    S.routes.push(path);
  }
  let sum = 0, n = 0;
  for (let x = 0; x < W; x++)
    if (S.Tn[x] < INF) {
      sum += S.Tn[x];
      n++;
    }
  S.ra = S.rb;
  S.rb = n ? max(40, sum / n) : 120;
}

function spawn(S, i) {
  S.px[i] = Math.random() * W;
  S.py[i] = Math.random() * H;
  S.pa[i] = 0;
}

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  S.t += d;
  S.tau += d * RATE;
  if (!S.started) {
    // The first field is solved whole, and fronts have been leaving the
    // harbour for ever, so the panel opens full.
    S.started = true;
    begin(S, kv, S.t);
    work(S, N);
    finish(S);
    S.Ta.set(S.Tb);
    S.ra = S.rb;
    S.fade = 1;
    for (let i = 0; i < NP; i++) {
      spawn(S, i);
      S.pa[i] = Math.random() * 3;
    }
  }
  // Then one field is solved every SOLVE frames, a slice per frame, for the
  // knobs as they are and the clock when it will be shown, and fades in.
  if (!S.solving) begin(S, kv, S.t + SOLVE / 30);
  if (work(S, Math.ceil(N / SOLVE))) finish(S);
  S.fade = min(1, S.fade + 1 / SOLVE);
  for (let i = 0; i < NP; i++) {
    const c = (S.py[i] | 0) * W + (S.px[i] | 0);
    S.px[i] += S.DWX[c] * RATE * d;
    S.py[i] += S.DWY[c] * RATE * d;
    S.pa[i] += d;
    if (S.px[i] < 0 || S.px[i] >= W || S.py[i] < 0 || S.py[i] >= H || S.pa[i] > 3) spawn(S, i);
  }
}

function put(rgb, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  if (rgb[o] < r) rgb[o] = r;
  if (rgb[o + 1] < g) rgb[o + 1] = g;
  if (rgb[o + 2] < b) rgb[o + 2] = b;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  const rgb = S.rgb, Ta = S.Ta, Tb = S.Tb, a = S.fade, tau = S.tau, T = S.T, lut = S.lut, sh = S.sh;
  rgb.fill(0);
  for (let i = 0; i < N; i++) {
    const p = Ta[i], q = Tb[i];
    T[i] = p >= INF || q >= INF ? (a < 0.5 ? p : q) : p + (q - p) * a;
  }
  // Front colours by arrival time over the time to the far coast.
  for (let k = 0; k <= 64; k++) hsv(S.hue + 0.13 + (0.55 * k) / 64, 1, 1, lut, k * 3);
  const sc = 64 / (S.ra + (S.rb - S.ra) * a);
  hsv(S.hue + 0.92, 0.75, 1, sh, 0);
  // The current: short pale streaks drifting with the water.
  for (let i = 0; i < NP; i++) {
    const x = S.px[i], y = S.py[i], o = (y | 0) * W + (x | 0), wx = S.DWX[o], wy = S.DWY[o];
    const f = min(1, S.pa[i] * 2, (3 - S.pa[i]) * 2), n = wx * wx + wy * wy < 0.09 ? 1 : 3;
    for (let k = 0; k < n; k++) {
      const v = f * (75 - 20 * k);
      put(rgb, floor(x - wx * k * 0.9), floor(y - wy * k * 0.9), v * 0.6, v * 0.75, v);
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, t = T[i], o = i * 3;
      const l = x > 0 ? T[i - 1] : INF, r = x < W - 1 ? T[i + 1] : INF, u = y > 0 ? T[i - W] : INF, dn = y < H - 1 ? T[i + W] : INF;
      if (t >= INF) {
        // The shadow: no heading of the boat ever gets here. Hatched, with
        // its rim lit.
        const v = l < INF || r < INF || u < INF || dn < INF ? 0.55 : (x + y) % 4 === 0 ? 0.32 : 0;
        if (v) {
          rgb[o] = max(rgb[o], sh[0] * v);
          rgb[o + 1] = max(rgb[o + 1], sh[1] * v);
          rgb[o + 2] = max(rgb[o + 2], sh[2] * v);
        }
        continue;
      }
      // Distance to the nearest front in LEDs from the slope of T, taken
      // as the steeper side so a fold does not smear.
      const gx = max(l < INF ? t - l : 0, r < INF ? r - t : 0, l < INF ? l - t : 0, r < INF ? t - r : 0);
      const gy = max(u < INF ? t - u : 0, dn < INF ? dn - t : 0, u < INF ? u - t : 0, dn < INF ? t - dn : 0);
      const g = max(0.25, sqrt(gx * gx + gy * gy));
      const q = (tau - t) / GAP, f = q - floor(q), dl = (min(f, 1 - f) * GAP) / g, behind = (f * GAP) / g;
      // A line on the front, a short glow on the harbour side of it, and
      // where fronts crowd closer than two LEDs they fade rather than merge.
      const line = dl < 1.1 ? 1 - dl / 1.1 : 0, tail = behind < 9 ? 0.16 * exp(-behind / 2.5) : 0;
      const v = max(line, tail) * cl((GAP / g - 1.5) / 2, 0, 1);
      if (v <= 0.01) continue;
      const c = min(64, (t * sc) | 0) * 3;
      rgb[o] = max(rgb[o], lut[c] * v);
      rgb[o + 1] = max(rgb[o + 1], lut[c + 1] * v);
      rgb[o + 2] = max(rgb[o + 2], lut[c + 2] * v);
    }
  // The quickest routes, and a bead where each front crosses one: the
  // place on the front that route's boat has got to.
  for (const path of S.routes)
    for (let k = 1; k < path.length; k++) {
      const p0 = path[k - 1], p1 = path[k];
      const x0 = p0 % W, y0 = (p0 / W) | 0, x1 = p1 % W, y1 = (p1 / W) | 0, n = max(abs(x1 - x0), abs(y1 - y0));
      for (let j = 0; j < n; j++) put(rgb, round(x0 + ((x1 - x0) * j) / n), round(y0 + ((y1 - y0) * j) / n), 95, 95, 105);
      const t0 = T[p0], t1 = T[p1], lv = tau - GAP * Math.ceil((tau - t0) / GAP);
      if (t0 > t1 && lv >= t1) {
        const s = (lv - t1) / (t0 - t1);
        put(rgb, round(x1 + (x0 - x1) * s), round(y1 + (y0 - y1) * s), 255, 255, 255);
      }
    }
  const hx = S.src % W;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const v = dx || dy ? 120 : 255;
      put(rgb, hx + dx, HY + dy, v, v, v);
    }
  for (let i = 0; i < N; i++) {
    const o = i * 3;
    display.setPixel(i % W, (i / W) | 0, min(255, rgb[o]) | 0, min(255, rgb[o + 1]) | 0, min(255, rgb[o + 2]) | 0);
  }
}
