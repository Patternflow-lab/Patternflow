// ===== Patternflow pattern =====
// Title:   Persistence Barcode
// Family:  topology
// Idea:    Disks grow round points scattered about a ring until they swallow it while the Delaunay edges and triangles they reach join in, and below them the barcode of that growth, reduced exactly over Z/2, lights up behind a sweeping line: short pale teal bars for points whose disks merge and one long orange bar for the ring's hole, whose loop and shrinking rim glow the same orange until the hole closes.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: persistent homology (Herbert Edelsbrunner, David Letscher and Afra Zomorodian, 2002) of the alpha complex of the points (alpha shapes, Herbert Edelsbrunner, David Kirkpatrick and Raimund Seidel, 1983), drawn as a barcode (Afra Zomorodian and Gunnar Carlsson, 2005), pattern round 51
// Round:   51
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Noise=0..1, Rings=1..3
//
// Knob 1: Hue. Turns the loops' colours round the wheel while the disks swing between violet and green and the merging bars between pale teal and pale violet, so nothing dim goes brown. At 0 violet disks, teal bars and an orange loop (the second and third rings pink and yellow); at 0.25 green loops on teal disks; at 0.5 blue loops on green disks; at 0.75 magenta loops.
// Knob 2: Speed. At 2 the disks grow from nothing to 1.12 times the radius that closes the last hole in 7 seconds, the whole barcode holds for 1.5 s and a fresh sample comes at 9 s; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Noise. How far the points scatter from their circles: a twentieth of the radius at 0, where one ring's bar spans about three quarters of the ruler with one or two short bars beside it; a third at 1, where the ring frays into clusters and its bar spans under half among some 28 short ones. Turning it slides the same points, and the barcode is computed again at once.
// Knob 4: Rings. One, two or three circles sharing 40, 38 or 36 points, so that many long bars stand in the barcode, orange, pink and yellow, each loop drawn in its bar's colour.
// Buttons: K1 tap draws a fresh sample now.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, sin, cos, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The cloud is the square of rows 0..63; the barcode starts at row BT, and
// the bottom row is its ruler of r.
const CH = 64, BT = 68;
// The rings for one, two and three circles, [cx, cy, R] in LEDs, and how
// many points they share.
const LAYOUT = [
  { n: 40, rings: [[31.5, 31.5, 24]] },
  { n: 38, rings: [[21, 21, 15.5], [45, 45, 11]] },
  { n: 36, rings: [[15, 15, 10.5], [33, 33, 9], [50.5, 50.5, 8.5]] },
];
const MAXN = 40;
// Story seconds at Speed 2: the disks grow, the full barcode holds, the
// picture fades and the next sample begins.
const GROW = 7, HOLD = 1.5, FADE = 0.5, CYCLE = GROW + HOLD + FADE;

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, noise: 0, rings: 1, key: "", seed: 0, first: true, btn: false,
    rnd: null, n: 0, X: new Float64Array(MAXN), Y: new Float64Array(MAXN), K: null,
    buf: new Float32Array(W * H * 3), pal: new Float32Array(8 * 3),
  };
  fresh(params.s);
}

// A new sample's randomness: each point's place along its circle and its
// standard normal offset from it, and each ring's turn, size and shift.
function fresh(S) {
  const R = Math.random, gauss = () => cl(sqrt(-2 * log(1 - R())) * cos(TAU * R()), -2.6, 2.6);
  S.rnd = {
    ja: Array.from({ length: MAXN }, () => R() - 0.5),
    z: Array.from({ length: MAXN }, gauss),
    ring: Array.from({ length: 3 }, () => [TAU * R(), 1 + 0.08 * (R() - 0.5), 2 * (R() - 0.5), 2 * (R() - 0.5)]),
    sym: floor(8 * R()),
  };
  S.seed++;
  S.key = "";
}

// The points for the current knobs from the sample's randomness, so turning
// Noise slides them instead of drawing new ones.
function place(S) {
  const L = LAYOUT[S.rings - 1], rr = S.rnd, sig = 0.05 + 0.28 * S.noise;
  const tot = L.rings.reduce((a, g) => a + g[2], 0);
  let i = 0;
  L.rings.forEach((g, k) => {
    const m = k === L.rings.length - 1 ? L.n - i : round((L.n * g[2]) / tot), [ph, sz, sx, sy] = rr.ring[k];
    for (let j = 0; j < m; j++, i++) {
      const th = ph + (TAU * (j + 0.7 * rr.ja[i])) / m, rad = g[2] * sz * (1 + sig * rr.z[i]);
      let u = g[0] + sx + rad * cos(th) - 31.5, v = g[1] + sy + rad * sin(th) - 31.5;
      if (rr.sym & 1) u = -u;
      if (rr.sym & 2) v = -v;
      if (rr.sym & 4) [u, v] = [v, u];
      // Points pushed against the edge are nudged apart, so two never meet.
      S.X[i] = cl(31.5 + u, 1, 62.5) + 0.001 * i;
      S.Y[i] = cl(31.5 + v, 1, CH - 1.5) + 0.0007 * i;
    }
  });
  S.n = L.n;
}

// The alpha complex of the points and its persistence. Delaunay triangles
// are the triples whose circumcircle holds no other point, and a triangle
// enters when the disks reach its circumradius. An edge enters at half its
// length, except when a triangle on one side has an obtuse angle facing it
// (its third point lies inside the circle on the edge); then the edge enters
// with that triangle. At radius r this complex has the shape of the union of
// the disks, so the barcode is the barcode of the picture.
// H0 comes from joining components in order; H1 from reducing the
// triangles' boundary columns over Z/2, each surviving column's lowest edge
// giving birth to the hole the triangle kills. The reduced column is that
// hole's loop and the triangles summed into it are what fills it.
function persistence(X, Y, n) {
  const T = [];
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++) {
        const ax = X[a], ay = Y[a], bx = X[b] - ax, by = Y[b] - ay, cx = X[c] - ax, cy = Y[c] - ay;
        const d = 2 * (bx * cy - by * cx);
        if (abs(d) < 1e-9) continue;
        const b2 = bx * bx + by * by, c2 = cx * cx + cy * cy, ux = (cy * b2 - by * c2) / d, uy = (bx * c2 - cx * b2) / d;
        const R2 = ux * ux + uy * uy, ox = ax + ux, oy = ay + uy;
        let ok = true;
        for (let e = 0; e < n && ok; e++) {
          if (e === a || e === b || e === c) continue;
          const dx = X[e] - ox, dy = Y[e] - oy;
          if (dx * dx + dy * dy < R2 * (1 - 1e-9)) ok = false;
        }
        if (ok) T.push({ v: [a, b, c], x: ox, y: oy, R: sqrt(R2), e: [] });
      }
  const emap = new Map(), E = [];
  T.forEach((t) => {
    const [a, b, c] = t.v;
    for (const [p, q, o] of [[a, b, c], [a, c, b], [b, c, a]]) {
      const k = p * 64 + q;
      let e = emap.get(k);
      if (!e) {
        e = { a: p, b: q, v: 0.5 * Math.hypot(X[q] - X[p], Y[q] - Y[p]), att: null, o: 0 };
        emap.set(k, e);
        E.push(e);
      }
      t.e.push(e);
      if ((X[p] - X[o]) * (X[q] - X[o]) + (Y[p] - Y[o]) * (Y[q] - Y[o]) < 0) e.att = t;
    }
  });
  for (const e of E) if (e.att) e.v = e.att.R;
  E.sort((p, q) => p.v - q.v);
  E.forEach((e, i) => (e.o = i));
  T.sort((p, q) => p.R - q.R);
  T.forEach((t, i) => (t.o = i));
  // H0: every point is born at 0; joining two components kills one.
  const up = Array.from({ length: n }, (_, i) => i), find = (i) => (up[i] === i ? i : (up[i] = find(up[i])));
  const h0 = [];
  for (const e of E) {
    const ra = find(e.a), rb = find(e.b);
    if (ra !== rb) {
      up[ra] = rb;
      h0.push(e.v);
    }
  }
  while (h0.length < n) h0.push(Infinity);
  // H1: column reduction.
  const nw = (E.length + 31) >> 5, tw = (T.length + 31) >> 5, owner = new Int32Array(E.length).fill(-1);
  const cols = [], vs = [], h1 = [];
  const top = (c) => {
    for (let w = nw - 1; w >= 0; w--) if (c[w]) return 32 * w + 31 - Math.clz32(c[w]);
    return -1;
  };
  const bits = (c, w) => {
    const out = [];
    for (let i = 0; i < 32 * w; i++) if (c[i >> 5] & (1 << (i & 31))) out.push(i);
    return out;
  };
  let zero = 0;
  T.forEach((t, j) => {
    const col = new Uint32Array(nw), vv = new Uint32Array(tw);
    for (const e of t.e) col[e.o >> 5] ^= 1 << (e.o & 31);
    vv[j >> 5] |= 1 << (j & 31);
    let low = top(col);
    while (low >= 0 && owner[low] >= 0) {
      const k = owner[low];
      for (let w = 0; w < nw; w++) col[w] ^= cols[k][w];
      for (let w = 0; w < tw; w++) vv[w] ^= vs[k][w];
      low = top(col);
    }
    cols.push(col);
    vs.push(vv);
    if (low < 0) return;
    owner[low] = j;
    const b = E[low].v, d = t.R;
    if (d - b > 1e-9) h1.push({ b, d, cyc: bits(col, nw), reg: bits(vv, tw) });
    else zero++;
  });
  let essential = 0;
  E.forEach((e, i) => {
    if (owner[i] < 0) essential++;
  });
  // Edges that joined components are never pivots, so essential counts the
  // n - 1 of them plus any loop that never closed (none in a triangulated
  // disk). zero counts loops filled at the radius they closed.
  return { T, E, h0, h1, zero, essential: essential - (n - 1) };
}

// Rebuild the complex, the per-LED maps of the cloud and the barcode's rows.
function build(S) {
  place(S);
  const { X, Y, n } = S, K = (S.K = persistence(X, Y, n));
  const { T, h0, h1 } = K;
  let far = 0;
  for (const d of h0) if (d < Infinity) far = max(far, d);
  for (const c of h1) far = max(far, c.d);
  K.rMax = max(8, far * 1.12);
  // Each loop's colour: the three most persistent loops, when they are
  // long enough to be the rings' holes, get a colour each, the rest one more.
  const ranked = [...h1].sort((p, q) => q.d - q.b - (p.d - p.b)), top = ranked.length ? ranked[0].d - ranked[0].b : 0;
  ranked.forEach((c, i) => (c.col = i < 3 && c.d - c.b > 0.3 * top ? i : 3));
  // Nearest point and containing triangle for every LED of the cloud.
  const P = CH * W;
  K.dm = new Float32Array(P);
  K.tri = new Int16Array(P).fill(-1);
  for (let p = 0; p < P; p++) {
    const x = (p % W) + 0.5, y = floor(p / W) + 0.5;
    let d = 1e9;
    for (let i = 0; i < n; i++) d = min(d, (X[i] - x) ** 2 + (Y[i] - y) ** 2);
    K.dm[p] = sqrt(d);
  }
  for (const t of T) {
    const [a, b, c] = t.v, x0 = max(0, floor(min(X[a], X[b], X[c]))), x1 = min(W - 1, floor(max(X[a], X[b], X[c])));
    const y0 = max(0, floor(min(Y[a], Y[b], Y[c]))), y1 = min(CH - 1, floor(max(Y[a], Y[b], Y[c])));
    const s = (X[b] - X[a]) * (Y[c] - Y[a]) - (Y[b] - Y[a]) * (X[c] - X[a]);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((X[b] - px) * (Y[c] - py) - (Y[b] - py) * (X[c] - px)) * s;
        const w1 = ((X[c] - px) * (Y[a] - py) - (Y[c] - py) * (X[a] - px)) * s;
        const w2 = ((X[a] - px) * (Y[b] - py) - (Y[a] - py) * (X[b] - px)) * s;
        if (w0 >= 0 && w1 >= 0 && w2 >= 0) K.tri[y * W + x] = t.o;
      }
  }
  // Which loops each triangle lies inside, the soonest to close first.
  K.own = T.map(() => []);
  [...h1].sort((p, q) => p.d - q.d).forEach((c) => c.reg.forEach((j) => K.own[j].push(c)));
  // Barcode rows: H0 from the longest down, then H1 by birth. The rings'
  // bars come first, as thick as the room allows up to 4 rows. The short
  // bars then take one row each from what is left, longest first; those
  // that do not fit are left out. A dark row stands between bars.
  const room = H - 2 - (BT + n + 3), long = ranked.filter((c) => c.col < 3);
  let th = 4;
  while (th > 1 && long.length * (th + 1) > room + 1) th--;
  let left = room + 1 - long.length * (th + 1);
  const shown = [...long];
  for (const c of ranked) if (c.col === 3 && left >= 2) shown.push(c), (left -= 2);
  shown.sort((p, q) => p.b - q.b);
  K.rows = [];
  [...h0].sort((p, q) => q - p).forEach((d, i) => K.rows.push({ y: BT + i, b: 0, d, col: -1, h: 1 }));
  let y = BT + n + 3;
  for (const c of shown) {
    const h = c.col < 3 ? th : 1;
    K.rows.push({ y, b: c.b, d: c.d, col: c.col, h });
    y += h + 1;
  }
}

function plot(buf, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= CH) return;
  const o = 3 * (y * W + x);
  buf[o] = max(buf[o], c[0] * a);
  buf[o + 1] = max(buf[o + 1], c[1] * a);
  buf[o + 2] = max(buf[o + 2], c[2] * a);
}
function line(buf, x0, y0, x1, y1, c, a) {
  const n = max(1, Math.ceil(max(abs(x1 - x0), abs(y1 - y0))));
  for (let i = 0; i <= n; i++) plot(buf, floor(x0 + ((x1 - x0) * i) / n), floor(y0 + ((y1 - y0) * i) / n), c, a);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.noise = cl(k[2], 0, 1);
  S.rings = round(cl(k[3], 1, 3));
  const btn = !!(input.btnPressed && input.btnPressed[0]);
  if (btn && !S.btn) {
    fresh(S);
    S.t = 0;
    S.first = false;
  }
  S.btn = btn;
  S.t += (d * S.speed) / 2;
  if (S.t >= CYCLE) {
    S.t -= CYCLE;
    S.first = false;
    fresh(S);
  }
  const key = `${S.seed} ${S.rings} ${S.noise.toFixed(2)}`;
  if (key !== S.key) {
    S.key = key;
    build(S);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.K) return;
  const K = S.K, buf = S.buf, pal = S.pal, X = S.X, Y = S.Y;
  const r = K.rMax * cl(S.t / GROW, 0, 1);
  const fade = cl((CYCLE - S.t) / FADE, 0, 1) * (S.first ? 1 : cl(S.t / 0.3, 0, 1));
  // Palette: 0..3 the loops, 4 merging (H0), 5 disks, 6 triangles, 7
  // points. The dim colours stay in the cool half of the wheel and the
  // merging colour is pale, so neither goes brown; only the bright loop
  // colours turn the whole way round.
  const u = S.hue, sw = sin(PI * u) ** 2, cool = 0.72 - 0.38 * sw, pale = 0.52 + 0.3 * sw;
  hsv(u + 0.07, 0.92, 1, pal, 0);
  hsv(u + 0.9, 0.72, 1, pal, 3);
  hsv(u + 0.15, 0.85, 1, pal, 6);
  hsv(u + 0.98, 0.4, 0.85, pal, 9);
  hsv(pale, 0.55, 0.95, pal, 12);
  hsv(cool, 0.7, 1, pal, 15);
  hsv(cool - 0.05, 0.55, 1, pal, 18);
  hsv(pale, 0.12, 1, pal, 21);
  const C = (i) => [pal[3 * i], pal[3 * i + 1], pal[3 * i + 2]];
  const cLoop = [C(0), C(1), C(2), C(3)], cH0 = C(4), cDisk = C(5), cTri = C(6), cPt = C(7);
  buf.fill(0);
  // The union of disks with its scalloped edge, the triangles in it, each
  // open hole lined with its loop's colour, and the hole that just closed
  // flashing.
  const flashR = 0.06 * K.rMax;
  for (let p = 0, P = CH * W; p < P; p++) {
    const dm = K.dm[p], t = K.tri[p], o = 3 * p;
    let a = 0;
    if (dm <= r + 0.5) a = 0.17 * cl(r + 0.5 - dm, 0, 1) + (r - dm < 1.2 && r > 0.8 ? 0.2 : 0);
    let rr = cDisk[0] * a, gg = cDisk[1] * a, bb = cDisk[2] * a;
    if (t >= 0) {
      if (K.T[t].R <= r) (rr += cTri[0] * 0.12), (gg += cTri[1] * 0.12), (bb += cTri[2] * 0.12);
      for (const cy of K.own[t]) {
        if (cy.b <= r && r < cy.d) {
          const e = dm - r;
          if (e > 0) {
            const L = cLoop[cy.col], q = e < 1 ? 0.9 : e < 2 ? 0.38 : 0;
            (rr = L[0] * q), (gg = L[1] * q), (bb = L[2] * q);
          }
          break;
        }
        if (r >= cy.d && r - cy.d < flashR) {
          const L = cLoop[cy.col], q = 0.7 * (1 - (r - cy.d) / flashR);
          (rr += L[0] * q), (gg += L[1] * q), (bb += L[2] * q);
          break;
        }
      }
    }
    buf[o] = rr;
    buf[o + 1] = gg;
    buf[o + 2] = bb;
  }
  // Edges that have entered, bright as they arrive and dimmer after.
  for (const e of K.E) {
    if (e.v > r) break;
    const a = 0.32 + 0.5 * Math.exp(-(r - e.v) / (0.05 * K.rMax));
    line(buf, X[e.a], Y[e.a], X[e.b], Y[e.b], cH0, a);
  }
  // The loops that are alive, each in its bar's colour.
  for (const c of K.h1)
    if (c.b <= r && r < c.d) for (const i of c.cyc) line(buf, X[K.E[i].a], Y[K.E[i].a], X[K.E[i].b], Y[K.E[i].b], cLoop[c.col], 1);
  for (let i = 0; i < S.n; i++) {
    const x = floor(X[i]), y = floor(Y[i]);
    plot(buf, x, y, cPt, 1);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) plot(buf, x + dx, y + dy, cPt, 0.3);
  }
  // The ruler: a tick every 4 LEDs of radius, the sweep's place bright.
  const span = W - 2, col = (v) => 1 + round((min(v, K.rMax) / K.rMax) * span), xs = col(r);
  const set = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = 3 * (y * W + x);
    buf[o] = max(buf[o], c[0] * a);
    buf[o + 1] = max(buf[o + 1], c[1] * a);
    buf[o + 2] = max(buf[o + 2], c[2] * a);
  };
  for (let v = 0; v <= K.rMax; v += 4) set(col(v), H - 1, cPt, 0.35);
  for (let x = 0; x < W; x += 2) set(x, BT - 2, cH0, 0.2);
  set(xs, H - 1, cPt, 1);
  // Bars: solid up to the sweep, brightest while alive; dotted beyond it,
  // where the sweep has yet to go. The sweep line runs down between them
  // to the ruler on the bottom row.
  for (let y = BT - 1; y < H - 1; y++) set(xs, y, cPt, 0.2);
  for (const row of K.rows) {
    const c = row.col < 0 ? cH0 : cLoop[row.col], x0 = col(row.b), x1 = max(x0, row.d === Infinity ? W - 1 : col(row.d) - 1);
    const alive = row.b <= r && r < row.d, h = row.h;
    for (let j = 0; j < h; j++) {
      const y = row.y + j, rim = j === 0 || j === h - 1;
      for (let x = x0; x <= x1; x++) {
        if (x <= xs) set(x, y, c, alive ? 1 : row.col < 0 ? 0.62 : 0.8);
        else if ((rim && (x - x0) % 2 === 0) || x === x1) set(x, y, c, 0.4);
      }
      if (alive) set(xs, y, cPt, 1);
    }
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const o = 3 * p;
      display.setPixel(x, y, round(cl(buf[o] * fade, 0, 1) * 255), round(cl(buf[o + 1] * fade, 0, 1) * 255), round(cl(buf[o + 2] * fade, 0, 1) * 255));
    }
}
