// ===== Patternflow pattern =====
// Title:   Art Gallery
// Family:  geometry
// Idea:    A tall random gallery is drawn corner by corner, cut into triangles by clipping its ears one at a time, its corners given three colours so that every triangle has one of each, and then guards step out on the corners of the rarest colour and their light spreads over every LED they can see until the whole gallery is lit, which is Steve Fisk's proof that n/3 guards always suffice.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: art gallery problem (Victor Klee, 1973), art gallery theorem and the comb that needs every guard (Václav Chvátal, 1975), two ears theorem (Gary Meisters, 1975), three-colouring proof (Steve Fisk, 1978), pattern round 61
// Round:   61
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Corners=12..30, Depth=0.6..0.95
//
// Knob 1: Hue. Turns the three corner colours round together, on a wheel that skips orange and yellow. At 0 they are green, azure and pink; at 0.17 cyan, violet and red; at 0.5 violet, red and cyan. The guards' light is a pale version of whichever colour is rarest.
// Knob 2: Speed. At 2 the outline takes 1 s, the ears 2.2 s, the colours 2 s and the guards 0.8 s; the light takes 2.4 s and 0.6 s more for every guard after the first; then the gallery stays lit for 2.4 s and fades in 0.8 s. That is 13.4 s for a gallery with 4 guards and 17 s for one with 10. At 0.2 it is ten times as long, at 3 two thirds as long.
// Knob 3: Corners. n, 12 to 30. At 12 the gallery has 10 triangles, 9 diagonals and at most 4 guards; at 21 it has 19, 18 and 7; at 30 it has 28, 27 and 10. A new value starts a new gallery once the knob has rested for 0.35 s.
// Knob 4: Depth. How far the inner corners cut in from the edge toward the spine down the middle, 0.7 to 1 times this. At 0.6 they reach 42 to 60% of the way and one guard sees 90% of a 12-corner gallery on average, 68% of a 30-corner one; at 0.95 they reach 67 to 95%, and one guard sees 74% and 41%. Every third gallery is Chvátal's comb, n/3 teeth whose tips no point sees two of, so it needs all n/3 guards and the colouring gives it that many; Depth narrows its teeth from 68% to 54% of their spacing.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sqrt, PI, exp, acos } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The acts of one gallery, in seconds at Speed 2, and when each one ends.
// The light act lasts as long as its guards need: they switch on 0.6 s
// apart and each front runs out at 60 LEDs a second.
const T_OUT = 1, T_EAR = 2.2, T_COL = 2, T_GRD = 0.8, T_HOLD = 2.4, T_FADE = 0.8, GAP = 0.6, FRONT = 60;
const A1 = T_OUT, A2 = A1 + T_EAR, A3 = A2 + T_COL, A4 = A3 + T_GRD;
// Rows of visibility worked out per frame. A gallery of 30 corners with
// 10 guards costs up to 2 ms a frame this way for the first 32 frames,
// and the light needs it 6 seconds in.
const VIS_ROWS = 4;

// Hues on a wheel that skips orange through yellow, which read brown and
// olive when dim.
const wheel = (h) => 0.28 + 0.74 * (h - floor(h));
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// A star around a vertical spine from row 32 to row 96. Each corner sits on
// the ray from the spine to an even step round the edge of the panel, and
// the rays never cross, so the polygon is simple whatever the radii. An
// outer corner lies near the edge, an inner one depth x (0.7..1) of the way
// in toward the spine.
function star(n, depth) {
  const X0 = 1.2, X1 = 62.8, Y0 = 1.2, Y1 = 126.8, CX = 32, S0 = 32, S1 = 96;
  const a = X1 - X0, b = Y1 - Y0, per = 2 * (a + b);
  const off = Math.random() * per, P = [];
  let run = 1;
  for (let i = 0; i < n; i++) {
    let s = (off + ((i + 0.5 + (Math.random() - 0.5) * 0.5) * per) / n) % per, qx, qy;
    if (s < a) (qx = X0 + s), (qy = Y0);
    else if ((s -= a) < b) (qx = X1), (qy = Y0 + s);
    else if ((s -= b) < a) (qx = X1 - s), (qy = Y1);
    else (qx = X0), (qy = Y1 - (s - a));
    // An inner corner never follows an inner one and always follows two
    // outer ones; after one outer corner it comes with chance 0.6.
    const inner = run > 0 && i < n - 1 && (run > 1 || Math.random() < 0.6);
    run = inner ? 0 : run + 1;
    const oy = cl(qy, S0, S1), r = inner ? 1 - depth * (0.7 + 0.3 * Math.random()) : 0.92 + 0.08 * Math.random();
    P.push([CX + (qx - CX) * r, oy + (qy - oy) * r]);
  }
  return P;
}

// Chvátal's comb: a bar down one side and k = n / 3 teeth across the panel,
// each tooth a triangle whose tip only a point inside that tooth's own cone
// can see. A tooth w wide at its base and 48 long, in front of a bar 12
// deep, has a cone 1.25 w wide at the back wall, so teeth narrower than 0.8
// of their spacing keep the cones apart. Corners: two at the back, k tips
// and two at every valley, 3k in all, and any left over go on the back wall.
function comb(n, depth) {
  const k = floor(n / 3), extra = n - 3 * k, yT = 1.5, yB = 126.5, xb = 2.2, xs = 14, xt = 62.3;
  const s = (yB - yT) / k, w = s * (0.92 - 0.4 * depth), P = [[xb, yT]];
  for (let e = 1; e <= extra; e++) P.push([xb - 1.2, yT + ((yB - yT) * e) / (extra + 1)]);
  P.push([xb, yB]);
  for (let j = 0; j < k; j++) {
    const yc = yB - (j + 0.5) * s;
    P.push([xt, yc]);
    if (j < k - 1) P.push([xs, yc - w / 2], [xs, yc - s + w / 2]);
  }
  const fx = Math.random() < 0.5, fy = Math.random() < 0.5;
  return P.map(([x, y]) => [fx ? W - x : x, fy ? H - y : y]);
}

function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = cl(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

// Every corner at least 2 LEDs from every edge that does not end at it, so
// no part of the gallery is thinner than the panel can show.
function roomy(P) {
  const n = P.length;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (j === i || (j + 1) % n === i) continue;
      if (segDist(P[i], P[j], P[(j + 1) % n]) < 2) return false;
    }
  return true;
}

function angleAt(a, b, c) {
  const ux = a[0] - b[0], uy = a[1] - b[1], vx = c[0] - b[0], vy = c[1] - b[1];
  return acos(cl((ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) + 1e-9), -1, 1));
}

// Ear clipping. Meisters: a polygon with more than three corners has two
// ears, corners whose triangle with their neighbours lies inside it, so
// clipping one always leaves a smaller polygon to clip. Of the ears on
// offer this takes the one with the widest smallest angle, which keeps the
// triangles fat enough to read on 64 columns.
function triangulate(P, sgn) {
  const idx = P.map((_, i) => i), tris = [];
  while (idx.length > 3) {
    let best = 0, bq = -1;
    const m = idx.length;
    for (let t = 0; t < m; t++) {
      const a = idx[(t + m - 1) % m], b = idx[t], c = idx[(t + 1) % m];
      if (cross(P[a], P[b], P[c]) * sgn <= 1e-9) continue;
      let ok = true;
      for (const v of idx) {
        if (v === a || v === b || v === c) continue;
        const p = P[v];
        if (cross(P[a], P[b], p) * sgn >= -1e-9 && cross(P[b], P[c], p) * sgn >= -1e-9 && cross(P[c], P[a], p) * sgn >= -1e-9) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const q = min(angleAt(P[c], P[a], P[b]), angleAt(P[a], P[b], P[c]), angleAt(P[b], P[c], P[a]));
      if (q > bq) (bq = q), (best = t);
    }
    tris.push([idx[(best + m - 1) % m], idx[best], idx[(best + 1) % m]]);
    idx.splice(best, 1);
  }
  tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

function newGallery(S) {
  const n = S.nWant, depth = S.dWant, isComb = S.count % 3 === 2;
  let P = null;
  for (let tries = 0; tries < 40 && !P; tries++) {
    const Q = isComb ? comb(n, depth) : star(n, depth * (1 - tries * 0.012));
    if (isComb || roomy(Q)) P = Q;
  }
  let area = 0;
  for (let i = 0; i < n; i++) area += cross([0, 0], P[i], P[(i + 1) % n]);
  const sgn = area > 0 ? 1 : -1, tris = triangulate(P, sgn), T = tris.length;
  // Fisk: walk the dual tree from the triangle nearest the middle. Its three
  // corners take the three colours; every triangle after it shares a
  // diagonal, so two corners already have colours and the third takes the
  // colour left over.
  let start = 0, bd = 1e9;
  tris.forEach((t, i) => {
    const d = Math.hypot((P[t[0]][0] + P[t[1]][0] + P[t[2]][0]) / 3 - 32, (P[t[0]][1] + P[t[1]][1] + P[t[2]][1]) / 3 - 64);
    if (d < bd) (bd = d), (start = i);
  });
  const col = new Int8Array(n).fill(-1), step = new Int16Array(n), done = new Int16Array(T), seen = new Uint8Array(T), queue = [start];
  let k = 0;
  seen[start] = 1;
  while (queue.length) {
    const ti = queue.shift(), t = tris[ti];
    if (ti === start) for (let c = 0; c < 3; c++) (col[t[c]] = c), (step[t[c]] = k++);
    else
      for (const v of t)
        if (col[v] < 0) {
          let used = 0;
          for (const u of t) if (col[u] >= 0) used += col[u];
          col[v] = 3 - used;
          step[v] = k++;
        }
    done[ti] = max(step[t[0]], step[t[1]], step[t[2]]);
    for (let j = 0; j < T; j++) {
      if (seen[j]) continue;
      let shared = 0;
      for (const v of tris[j]) if (v === t[0] || v === t[1] || v === t[2]) shared++;
      if (shared === 2) (seen[j] = 1), queue.push(j);
    }
  }
  const cnt = [0, 0, 0];
  for (let i = 0; i < n; i++) cnt[col[i]]++;
  let rare = 0;
  for (let c = 1; c < 3; c++) if (cnt[c] < cnt[rare]) rare = c;
  const guards = [];
  for (let i = 0; i < n; i++) if (col[i] === rare) guards.push(i);
  // Which triangle holds each LED centre, and where in it.
  const tri = S.tri.fill(-1), bary = S.bary, vis = S.vis.fill(0);
  tris.forEach((t, ti) => {
    const a = P[t[0]], b = P[t[1]], c = P[t[2]], d = cross(a, b, c);
    const x0 = max(0, floor(min(a[0], b[0], c[0]))), x1 = min(W - 1, ceil(max(a[0], b[0], c[0])));
    const y0 = max(0, floor(min(a[1], b[1], c[1]))), y1 = min(H - 1, ceil(max(a[1], b[1], c[1])));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const p = [x + 0.5, y + 0.5], l0 = cross(b, c, p) / d, l1 = cross(c, a, p) / d, l2 = 1 - l0 - l1, o = y * W + x;
        if (l0 < -1e-6 || l1 < -1e-6 || l2 < -1e-6 || tri[o] >= 0) continue;
        tri[o] = ti;
        // How much of each corner's colour this LED takes: e^(9 l) for
        // barycentric l, so each corner's colour holds the third of the
        // triangle nearest it and they blend where the thirds meet.
        const e0 = exp(9 * l0), e1 = exp(9 * l1), e2 = exp(9 * l2), es = e0 + e1 + e2;
        bary[o * 3] = e0 / es;
        bary[o * 3 + 1] = e1 / es;
        bary[o * 3 + 2] = e2 / es;
      }
  });
  let nIn = 0;
  for (let o = 0; o < W * H; o++) if (tri[o] >= 0) S.ins[nIn++] = o;
  S.nIn = nIn;
  const A5 = A4 + (guards.length - 1) * GAP + 2.4;
  Object.assign(S, { P, n, tris, col, step, done, guards, sgn, t: 0, visRow: 0, isComb, dirty: -1, nNow: n, dNow: depth, A5, A6: A5 + T_HOLD, A7: A5 + T_HOLD + T_FADE });
  S.count++;
}

// A guard at corner G sees the LED centre p when p is in the gallery and
// the segment from G to p crosses no edge. On its own this test left 3 of
// 2.5 million LEDs dark over 630 galleries, centres lying on a line
// through a corner, which the triangle below takes care of. Edges ending at G cannot cross
// it; if the segment leaves through G's own corner it has to come back in
// across some other edge, so those are the only ones to test.
function visRows(S, rows) {
  const { P, n, guards, tri, vis } = S;
  for (let r = 0; r < rows && S.visRow < H; r++, S.visRow++) {
    const y = S.visRow + 0.5;
    for (let x = 0; x < W; x++) {
      const o = S.visRow * W + x;
      if (tri[o] < 0) continue;
      const px = x + 0.5, own = S.tris[tri[o]];
      for (let g = 0; g < guards.length; g++) {
        // Fisk: every triangle has one corner of each colour, so one guard
        // stands on a corner of the triangle this LED is in, and a triangle
        // is convex, so that guard sees it without a test.
        if (own.indexOf(guards[g]) >= 0) vis[o] |= 1 << g;
        if (vis[o] & (1 << g)) continue;
        const gi = guards[g], G = P[gi];
        let clear = true;
        for (let j = 0; j < n && clear; j++) {
          const j1 = (j + 1) % n;
          if (j === gi || j1 === gi) continue;
          const A = P[j], B = P[j1];
          const d1 = (B[0] - A[0]) * (G[1] - A[1]) - (B[1] - A[1]) * (G[0] - A[0]);
          const d2 = (B[0] - A[0]) * (y - A[1]) - (B[1] - A[1]) * (px - A[0]);
          if (d1 * d2 >= 0) continue;
          const d3 = (px - G[0]) * (A[1] - G[1]) - (y - G[1]) * (A[0] - G[0]);
          const d4 = (px - G[0]) * (B[1] - G[1]) - (y - G[1]) * (B[0] - G[0]);
          if (d3 * d4 < 0) clear = false;
        }
        if (clear) vis[o] |= 1 << g;
      }
    }
  }
}

export function setup(params) {
  params.s = {
    count: 0, nWant: 12, dWant: 0.6, tri: new Int16Array(W * H), bary: new Float32Array(W * H * 3), vis: new Uint16Array(W * H), ins: new Int32Array(W * H), nIn: 0, gx: new Float32Array(16), gy: new Float32Array(16), gr: new Float32Array(16), dc: [0, 0, 0], ec: [0, 0, 0],
    buf: new Float32Array(W * H * 3), lifts: new Float32Array(32), tc: new Float32Array(32 * 9), hue: 0, C: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], L: [0, 0, 0], c: [0, 0, 0], P: null,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 12, 0.6], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.nWant = round(cl(kv[2], 12, 30));
  S.dWant = cl(kv[3], 0.6, 0.95);
  if (!S.P) newGallery(S);
  // A turned knob starts a new gallery once it has rested for 0.35 s.
  if (S.nWant !== S.nNow || abs(S.dWant - S.dNow) > 0.02) {
    if (S.dirty < 0) S.dirty = 0;
    if ((S.dirty += d) > 0.35) S.count--, newGallery(S);
  } else S.dirty = -1;
  S.t += (d * cl(kv[1], 0.2, 3)) / 2;
  if (S.visRow < H) visRows(S, VIS_ROWS);
  if (S.t >= S.A7) newGallery(S);
}

function round(v) {
  return floor(v + 0.5);
}

// Xiaolin Wu's line, mixed over what is there, so a grey diagonal is a
// bright seam on the dark gallery and a dark one on the lit gallery.
function line(B, x0, y0, x1, y1, c, a) {
  const steep = abs(y1 - y0) > abs(x1 - x0);
  let t;
  if (steep) (t = x0), (x0 = y0), (y0 = t), (t = x1), (x1 = y1), (y1 = t);
  if (x0 > x1) (t = x0), (x0 = x1), (x1 = t), (t = y0), (y0 = y1), (y1 = t);
  const k = (y1 - y0) / (x1 - x0 || 1e-9);
  for (let u = ceil(x0 - 0.5); u <= floor(x1 - 0.5); u++) {
    const v = y0 + k * (u + 0.5 - x0) - 0.5, vi = floor(v), f = v - vi;
    plot(B, steep ? vi : u, steep ? u : vi, c, a * (1 - f));
    plot(B, steep ? vi + 1 : u, steep ? u : vi + 1, c, a * f);
  }
}

function plot(B, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3;
  a = min(1, a);
  B[o] += (c[0] - B[o]) * a;
  B[o + 1] += (c[1] - B[o + 1]) * a;
  B[o + 2] += (c[2] - B[o + 2]) * a;
}

function dot(B, x, y, r, c, a) {
  for (let yy = floor(y - r); yy <= y + r; yy++)
    for (let xx = floor(x - r); xx <= x + r; xx++) {
      const q = Math.hypot(xx + 0.5 - x, yy + 0.5 - y) / r;
      if (q < 1) plot(B, xx, yy, c, a * min(1, 1.6 * (1 - q)));
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.P) return;
  const { P, n, tris, col, step, done, guards, tri, bary, vis, buf: B, C, L } = S, t = S.t, nt = tris.length;
  const earAt = (k) => A1 + (T_EAR * (k + 0.5)) / nt, colAt = (s) => A2 + (T_COL * (s + 0.5)) / n;
  for (let c = 0; c < 3; c++) hsv(wheel(0.1 + S.hue + c / 3), 1, 1, C[c]);
  const rare = col[guards[0]], G = C[rare];
  for (let c = 0; c < 3; c++) L[c] = 0.35 * G[c] + 0.65;
  const fade = 1 - ss(S.A6, S.A7, t), base = hsv(wheel(0.46 + S.hue), 0.45, 0.12 * ss(0.3, A1, t), S.c);
  // The light: guard k's front is FRONT x (t - A4 - k GAP) LEDs out.
  const gx = S.gx, gy = S.gy, gr = S.gr;
  for (let k = 0; k < guards.length; k++) (gx[k] = P[guards[k]][0]), (gy[k] = P[guards[k]][1]), (gr[k] = FRONT * (t - A4 - k * GAP));
  // Per triangle: the ear flashes as it is clipped and stays a shade
  // lighter after; once its three corners have colours it takes a soft
  // tint from them, each corner's colour strongest near that corner.
  const lifts = S.lifts, tc = S.tc;
  for (let i = 0; i < nt; i++) {
    const ea = t - earAt(i), ta = 0.3 * ss(colAt(done[i]), colAt(done[i]) + 0.4, t);
    lifts[i] = ea > 0 ? 1.7 + 2.5 * exp(-ea / 0.3) : 1;
    for (let k = 0; k < 9; k++) tc[i * 9 + k] = C[col[tris[i][(k / 3) | 0]]][k % 3] * ta;
  }
  // What no guard sees yet sinks into shadow.
  const sh = 1 - 0.4 * ss(A4, A4 + 1, t), ng = guards.length, lightOn = t > A4;
  B.fill(0);
  for (let j = 0; j < S.nIn; j++) {
      const o = S.ins[j], x = o % W, y = (o / W) | 0, ti = tri[o];
      const lift = lifts[ti], w0 = bary[o * 3], w1 = bary[o * 3 + 1], w2 = bary[o * 3 + 2], q = ti * 9;
      let r = base[0] * lift + w0 * tc[q] + w1 * tc[q + 3] + w2 * tc[q + 6];
      let g = base[1] * lift + w0 * tc[q + 1] + w1 * tc[q + 4] + w2 * tc[q + 7];
      let b = base[2] * lift + w0 * tc[q + 2] + w1 * tc[q + 5] + w2 * tc[q + 8];
      if (lightOn) {
        let lit = 0, rim = 0;
        const m = vis[o];
        for (let k = 0; k < ng; k++) {
          if (!(m & (1 << k)) || gr[k] <= 0) continue;
          const ddx = x + 0.5 - gx[k], ddy = y + 0.5 - gy[k], d2 = ddx * ddx + ddy * ddy, R = gr[k];
          if (R > 8 && d2 < (R - 8) * (R - 8)) {
            lit++;
            continue;
          }
          const e = R - sqrt(d2);
          if (e > -3) (lit += cl(e / 4, 0, 1)), (rim += exp(-e * e / 8));
        }
        if (lit > 0 || rim > 0) {
          // A lit LED shows its colours at 1.2 times their strength where
          // one guard sees it, 1.5 where two do and up to 1.8 where many
          // do, with a little of the guards' light.
          const l = 1 - Math.pow(0.5, lit), gain = 0.6 + 1.2 * l, v = 0.32 * l + 0.3 * min(1, rim);
          (r = r * gain + L[0] * v), (g = g * gain + L[1] * v), (b = b * gain + L[2] * v);
        } else (r *= sh), (g *= sh), (b *= sh);
      }
      B[o * 3] = r;
      B[o * 3 + 1] = g;
      B[o * 3 + 2] = b;
    }
  // Diagonals, each drawn from one end to the other as its ear goes.
  const dc = hsv(wheel(0.37 + S.hue), 0.15, 0.62, S.dc);
  for (let k = 0; k < nt - 1; k++) {
    const u = cl((t - earAt(k) + 0.06) / 0.2, 0, 1);
    if (u <= 0) continue;
    const a = P[tris[k][0]], c = P[tris[k][2]];
    line(B, a[0], a[1], a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u, dc, 1);
  }
  // The outline, drawn round from corner 0 during the first act.
  const ec = hsv(wheel(0.37 + S.hue), 0.3, 1, S.ec), drawn = (t / T_OUT) * n;
  for (let i = 0; i < n; i++) {
    const u = cl(drawn - i, 0, 1);
    if (u <= 0) break;
    const a = P[i], b = P[(i + 1) % n];
    line(B, a[0], a[1], a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, ec, 1);
  }
  // Corners: white until coloured, then their colour; the guards' corners
  // grow a ring once the colouring is done and the others step back.
  const white = [1, 1, 1];
  const gOn = ss(A3, A3 + 0.5, t), pulse = 0.75 + 0.25 * Math.sin(t * 6);
  for (let i = 0; i < n; i++) {
    if (drawn < i) break;
    const cs = ss(colAt(step[i]) - 0.05, colAt(step[i]) + 0.15, t), isG = col[i] === rare;
    const cc = cs > 0 ? C[col[i]] : white, back = isG ? 1 : 1 - 0.5 * gOn;
    dot(B, P[i][0], P[i][1], 1.3 + 0.6 * cs, cc, back);
    if (isG && gOn > 0) {
      const rr = 2.4 + 1.6 * gOn;
      for (let k = 0; k < 28; k++) {
        const an = (k / 28) * 2 * PI;
        plot(B, floor(P[i][0] + rr * Math.cos(an)), floor(P[i][1] + rr * Math.sin(an)), G, gOn * pulse);
      }
      dot(B, P[i][0], P[i][1], 1.2, white, gOn);
    }
  }
  const f255 = fade * 255;
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, min(255, B[o] * f255) | 0, min(255, B[o + 1] * f255) | 0, min(255, B[o + 2] * f255) | 0);
}
