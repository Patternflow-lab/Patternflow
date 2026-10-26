// ===== Patternflow pattern =====
// Title:   Balanced Rhythms
// Family:  rhythm
// Idea:    A playhead goes round a ring of steps and every onset it strikes adds its own unit vector to a walk drawn below, tip to tail, and when the onsets are perfectly balanced, their roots of unity summing to zero, the walk closes on its starting point at the end of every bar, even for the six onsets of 30 steps that no union of regular polygons can make.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: vanishing sums of roots of unity (László Rédei, 1950s; N. G. de Bruijn, 1953; I. J. Schoenberg, 1964), the sizes a vanishing sum can have (T. Y. Lam and K. H. Leung, 2000), perfectly balanced rhythms and scales (Andrew Milne, David Bulger, Steffen Herff and William Sethares, 2015), pattern round 62
// Round:   62
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Rhythm=0..1, Rotate=0..1
//
// Knob 1: Hue. Turns the components' colours round the wheel together. At 0 pentagons and the clave's three side are azure, triangles and its two side violet, digons green and a second triangle or digon pink; at 0.5 they are red, lime, magenta and cyan. The walk's edges and the wedges it sweeps take the colour of the component their onset came from. Orange is skipped, as it reads brown when dim.
// Knob 2: Speed. One bar, once round the ring, takes 6 / Speed seconds: 3 s at 2, ten steps a second on 30 steps, 30 s at 0.2, 2 s at 3. Each onset flashes, draws its vector from the ring's centre and adds the same vector to the walk below, drawn out over 0.22 s.
// Knob 3: Rhythm. Below 0.2, 6 onsets of 30 steps, 5, 6, 12, 18, 24 and 25: the pentagon from step 0 and the triangle from step 5, less the digon 0 and 15 joining them, dashed, so the walk's tent of two edges at 60 degrees either side of the top stands in for the pentagon's missing edge. It is balanced and no union of polygons; of the 2^30 sets of steps, 146,854 are balanced, 26,640 of them are no union of polygons, and the 30 smallest of those, 6 onsets each, are all turns of this one. To 0.4 a pentagon, a triangle and a digon, one for each prime of 30, 10 onsets; to 0.6 the pentagon with two vertices split by two triangles, 7 onsets; to 0.8 a triangle and two digons on 12 steps, 7 onsets, where with two primes every one of the 100 balanced sets is a union of polygons; then the son clave of 16 steps, 0, 3, 6, 10 and 12, which is not balanced: each bar's walk ends 0.082 of a step from its start, dashed, and the walk runs on four bars before it starts again.
// Knob 4: Rotate. Turns one component round the ring, and a balanced rhythm stays balanced. In the first rhythm the triangle goes two steps a stop, 5 to 13, which moves the split to another vertex of the pentagon and turns the whole rhythm by 12 steps; in the second and fourth a digon goes one step a stop, and where it lands on an onset already there that step counts twice, a bigger dot and a walk edge twice as long; in the third the second triangle splits vertex 6, 18, 12 or 24 in turn. In the clave it turns the two side a step at a time and the miss grows from 0.082 to 0.710, 1.385, 2.009 and 2.556 steps. It opens at 0.06, the rhythms as listed.

const W = 64, H = 128, NP = W * H;
const { floor, min, max, sqrt, cos, sin, exp, round, ceil, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// The wheel without its orange, 0.03 to 0.15, which reads brown when dim.
const wheel = (h) => 0.15 + (h - floor(h)) * 0.88;

// The ring: centre (31.5, 31.5), radius 27, step k at 2 pi k / N clockwise
// from the top. The walk below: centred on (31.5, 96.5) in a 58 x 54 box.
const CX = 31.5, CY = 31.5, RING = 27, WX = 31.5, WY = 96.5, WW = 58, WH = 54;
// A component is a regular m-gon from step `off`, or a set of steps; `turn`
// lists where Rotate puts it. `links` are digons taken away: the antipodal
// pair with one end in each of the two components named.
const RHYTHMS = [
  // A pentagon and a triangle, less the digon joining them: 6 onsets of 30,
  // balanced and no union of polygons.
  { N: 30, comps: [{ m: 5, off: 0, c: 0 }, { m: 3, off: 5, c: 1, turn: [5, 7, 9, 11, 13] }], links: [[0, 1]] },
  // A pentagon, a triangle and a digon, one for each prime of 30: 10 onsets.
  { N: 30, comps: [{ m: 5, off: 1, c: 0 }, { m: 3, off: 0, c: 1 }, { m: 2, off: 2, c: 2, turn: [2, 3, 4, 5, 6] }], links: [] },
  // The pentagon with two of its vertices split by two triangles: 7 onsets.
  { N: 30, comps: [{ m: 5, off: 0, c: 0 }, { m: 3, off: 5, c: 1 }, { m: 3, off: 11, c: 3, turn: [11, 13, 17, 19] }], links: [[0, 1], [0, 2]] },
  // 12 steps, two primes: a triangle and two digons, 7 onsets.
  { N: 12, comps: [{ m: 3, off: 0, c: 1 }, { m: 2, off: 1, c: 2, turn: [1, 2, 3, 4, 5] }, { m: 2, off: 5, c: 3 }], links: [] },
  // The son clave of 16 steps, which is not balanced, its two side turned.
  { N: 16, comps: [{ set: [0, 3, 6], c: 0 }, { set: [10, 12], c: 1, turn: [0, 1, 2, 3, 4] }], links: [] },
];

// An unbalanced walk keeps four bars, then starts again.
const KEEP = 4;

function build(S, which, j) {
  const R = RHYTHMS[which], N = R.N;
  const pts = R.comps.map((c) => {
    const t = c.turn ? c.turn[min(c.turn.length - 1, round(j * (c.turn.length - 1)))] : c.off ?? 0;
    if (c.set) return c.set.map((k) => (k + t) % N);
    const out = [];
    for (let i = 0; i < c.m; i++) out.push((t + (i * N) / c.m) % N);
    return out;
  });
  const coef = new Int32Array(N), owner = new Int32Array(N).fill(-1);
  pts.forEach((p, ci) =>
    p.forEach((k) => {
      coef[k]++;
      if (owner[k] < 0) owner[k] = R.comps[ci].c;
    }),
  );
  const links = [];
  for (const [a, b] of R.links) {
    const k = pts[a].find((p) => pts[b].includes((p + N / 2) % N));
    links.push(k);
    coef[k]--;
    coef[(k + N / 2) % N]--;
  }
  // The onsets in time order, each with its vector (sin, -cos) on the
  // screen, as long as its weight.
  const on = [];
  for (let k = 0; k < N; k++) if (coef[k] > 0) on.push(k);
  const vx = new Float64Array(N), vy = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    const a = (2 * PI * k) / N;
    vx[k] = coef[k] * sin(a);
    vy[k] = -coef[k] * cos(a);
  }
  let x = 0, y = 0;
  const P = [[0, 0]];
  for (const k of on) P.push([(x += vx[k]), (y += vy[k])]);
  const fx = x, fy = y, balanced = sqrt(fx * fx + fy * fy) < 1e-9;
  // Fit the walk, one bar when it closes, four when it does not.
  const fit = balanced ? 1 : KEEP;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let b = 0; b < fit; b++)
    for (const [px, py] of P) {
      x0 = min(x0, px + b * fx);
      x1 = max(x1, px + b * fx);
      y0 = min(y0, py + b * fy);
      y1 = max(y1, py + b * fy);
    }
  const e = min(WW / max(1e-6, x1 - x0), WH / max(1e-6, y1 - y0), 24);
  Object.assign(S, {
    which, j, N, pts, coef, owner, links, on, vx, vy, P, fx, fy, balanced, e,
    ox: WX - ((x0 + x1) / 2) * e, oy: WY - ((y0 + y1) / 2) * e,
    phase: -1e-6, pos: [0, 0], start: [0, 0], verts: [[0, 0]], hist: [], kept: 0,
    fire: new Float64Array(N).fill(-99), edgeAt: -99, closeAt: -99,
  });
}

export function setup(params) {
  params.s = null;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  let S = params.s;
  if (!S) S = params.s = { clock: 0, maxClose: 0, barCount: 0, col: new Float32Array(15), R: new Float32Array(NP), G: new Float32Array(NP), B: new Float32Array(NP) };
  const which = min(RHYTHMS.length - 1, floor(cl(k[2], 0, 1) * RHYTHMS.length)), j = cl(k[3], 0, 1);
  const R = RHYTHMS[which], turns = R.comps.find((c) => c.turn)?.turn.length ?? 1;
  const jj = round(j * (turns - 1)) / max(1, turns - 1);
  if (S.which !== which || S.j !== jj) build(S, which, jj);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.clock += d;
  // One bar takes 6 / Speed seconds.
  const old = S.phase * S.N;
  S.phase += d / (6 / S.speed);
  const now = S.phase * S.N;
  for (let a = floor(old) + 1; a <= floor(now); a++) {
    const step = ((a % S.N) + S.N) % S.N;
    if (step === 0) {
      // A new bar. The walk should be back where the bar began.
      const ex = S.pos[0] - S.start[0], ey = S.pos[1] - S.start[1];
      if (S.balanced && a > 0) S.maxClose = max(S.maxClose, sqrt(ex * ex + ey * ey));
      if (a > 0) S.barCount++;
      if (!S.balanced) {
        S.hist.push(S.verts);
        if (++S.kept >= KEEP) (S.kept = 0), (S.hist = []), (S.pos = [0, 0]);
      }
      S.start = [S.pos[0], S.pos[1]];
      S.verts = [[S.pos[0], S.pos[1]]];
    }
    if (S.coef[step] > 0) {
      S.pos = [S.pos[0] + S.vx[step], S.pos[1] + S.vy[step]];
      S.verts.push(S.pos);
      S.fire[step] = S.clock;
      S.edgeAt = S.clock;
      const cx = S.pos[0] - S.start[0], cy = S.pos[1] - S.start[1];
      if (S.balanced && S.verts.length > 2 && sqrt(cx * cx + cy * cy) < 1e-9) S.closeAt = S.clock;
    }
  }
}

// Light into the float frame: a bilinear dot, and lines of them.
function dot(S, x, y, v, c, o) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  put(S, ix, iy, (1 - fx) * (1 - fy) * v, c, o);
  put(S, ix + 1, iy, fx * (1 - fy) * v, c, o);
  put(S, ix, iy + 1, (1 - fx) * fy * v, c, o);
  put(S, ix + 1, iy + 1, fx * fy * v, c, o);
}
function put(S, x, y, v, c, o) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = y * W + x;
  S.R[p] += v * c[o];
  S.G[p] += v * c[o + 1];
  S.B[p] += v * c[o + 2];
}
function line(S, x0, y0, x1, y1, v, c, o, dash) {
  const len = sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2), n = max(1, ceil(len * 2.5)), w = (v * len) / n;
  for (let i = 0; i <= n; i++) {
    if (dash && floor((i / n) * len / 2) % 2) continue;
    dot(S, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, w, c, o);
  }
}
// A line two LEDs wide: two lines half an LED either side.
function thick(S, x0, y0, x1, y1, v, c, o) {
  const len = sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2) || 1, nx = (-(y1 - y0) / len) * 0.45, ny = ((x1 - x0) / len) * 0.45;
  line(S, x0 + nx, y0 + ny, x1 + nx, y1 + ny, v * 0.75, c, o);
  line(S, x0 - nx, y0 - ny, x1 - nx, y1 - ny, v * 0.75, c, o);
}
// A round dot of radius r, its rim soft.
function disc(S, x, y, r, v, c, o) {
  for (let iy = floor(y - r - 1); iy <= ceil(y + r + 1); iy++)
    for (let ix = floor(x - r - 1); ix <= ceil(x + r + 1); ix++) {
      const d = sqrt((ix + 0.5 - x) ** 2 + (iy + 0.5 - y) ** 2), f = cl(r + 0.5 - d, 0, 1);
      if (f > 0) put(S, ix, iy, f * v, c, o);
    }
}
const WHITE = [1, 1, 1, 0.35, 0.35, 0.35, 1, 0.25, 0.3];

// Fill a convex polygon with v of colour c, row by row: a pixel is in when
// its centre is. Two wedges that share an edge share no pixel.
function fill(S, poly, v, c, o) {
  const n = poly.length;
  if (n < 3) return;
  let y0 = 1e9, y1 = -1e9;
  for (const q of poly) (y0 = min(y0, q[1])), (y1 = max(y1, q[1]));
  for (let y = max(0, ceil(y0 - 0.5)); y <= min(H - 1, floor(y1 - 0.5)); y++) {
    const py = y + 0.5 + 6.1e-5;
    let xa = 1e9, xb = -1e9;
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      if ((a[1] <= py && b[1] > py) || (b[1] <= py && a[1] > py)) {
        const x = a[0] + ((py - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
        xa = min(xa, x);
        xb = max(xb, x);
      }
    }
    // Centres x + 0.5 in [xa, xb).
    for (let x = max(0, ceil(xa - 0.5 - 3.7e-5)); x <= min(W - 1, ceil(xb - 0.5 - 3.7e-5) - 1); x++) {
      const p = y * W + x;
      S.R[p] += v * c[o];
      S.G[p] += v * c[o + 1];
      S.B[p] += v * c[o + 2];
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { R, G, B, col, N, coef, owner } = S;
  R.fill(0);
  G.fill(0);
  B.fill(0);
  // Component colours: azure, violet, green, pink at Hue 0.
  for (let c = 0; c < 4; c++) hsv(wheel(0.49 + S.hue + [0, 0.19, 0.77, 0.4][c]), 0.75, 1, col, c * 3);
  const t = S.clock;
  const ang = (k) => (2 * PI * k) / N;
  const rx = (k, r) => CX + r * sin(ang(k)), ry = (k, r) => CY - r * cos(ang(k));

  // The ring, faint, and the playhead with its arc trailing behind and a
  // faint hand from the centre.
  const u = S.phase - floor(S.phase);
  for (let i = 0; i < 160; i++) dot(S, CX + RING * sin((2 * PI * i) / 160), CY - RING * cos((2 * PI * i) / 160), 0.16, WHITE, 3);
  for (let i = 0; i < 48; i++) {
    const a = 2 * PI * u - (i / 48) * 1.1;
    dot(S, CX + (RING + 3.5) * sin(a), CY - (RING + 3.5) * cos(a), 0.6 * (1 - i / 48), WHITE, 0);
  }
  disc(S, CX + (RING + 3.5) * sin(2 * PI * u), CY - (RING + 3.5) * cos(2 * PI * u), 1.2, 1, WHITE, 0);
  line(S, CX, CY, CX + (RING - 3) * sin(2 * PI * u), CY - (RING - 3) * cos(2 * PI * u), 0.22, WHITE, 0);
  // The polygons inside, each lit up a moment when one of its onsets is struck.
  const comps = RHYTHMS[S.which].comps;
  S.pts.forEach((p, ci) => {
    const c = comps[ci].c, sorted = [...p].sort((a, b) => a - b);
    let f = 0;
    for (const k of p) f = max(f, exp(-(t - S.fire[k]) / 0.3));
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i], b = sorted[(i + 1) % sorted.length];
      if (sorted.length === 2 && i === 1) break;
      line(S, rx(a, RING - 2), ry(a, RING - 2), rx(b, RING - 2), ry(b, RING - 2), 0.4 + 0.5 * f, col, c * 3);
    }
  });
  // The digons taken away, dashed.
  for (const k of S.links) {
    line(S, rx(k, RING - 2), ry(k, RING - 2), rx(k + N / 2, RING - 2), ry(k + N / 2, RING - 2), 0.55, WHITE, 3, true);
    // Its ends, emptied: a hollow ring where each polygon lost a vertex.
    for (const q of [k, k + N / 2])
      for (let i = 0; i < 16; i++) dot(S, rx(q, RING) + 2.2 * cos((PI * i) / 8), ry(q, RING) + 2.2 * sin((PI * i) / 8), 0.16, WHITE, 0);
  }
  // The steps: onsets in their colours, flashing white as they are struck,
  // with their vectors from the centre; rests a dim grey.
  for (let k = 0; k < N; k++) {
    const x = rx(k, RING), y = ry(k, RING);
    if (coef[k] > 0) {
      const f = exp(-(t - S.fire[k]) / 0.35), c = owner[k] * 3;
      const tmp = [col[c] + (1 - col[c]) * f, col[c + 1] + (1 - col[c + 1]) * f, col[c + 2] + (1 - col[c + 2]) * f];
      disc(S, x, y, (coef[k] > 1 ? 2.3 : 1.6) + 0.6 * f, 0.75 + 0.25 * f, tmp, 0);
      const fv = exp(-(t - S.fire[k]) / 0.4);
      if (fv > 0.02) thick(S, CX, CY, rx(k, RING - 2.5), ry(k, RING - 2.5), fv, col, c);
    } else dot(S, x, y, 0.7, WHITE, 3);
  }

  // The walk.
  const e = S.e, X = (p) => S.ox + p[0] * e, Y = (p) => S.oy + p[1] * e;
  const verts = S.verts, last = verts.length - 1;
  // The edge struck last is drawn out over 0.22 s.
  const ease = min(1, (t - S.edgeAt) / 0.22), ee = 1 - (1 - ease) ** 3;
  let tipx = verts[last][0], tipy = verts[last][1];
  if (last > 0 && ease < 1) {
    tipx = verts[last - 1][0] + (verts[last][0] - verts[last - 1][0]) * ee;
    tipy = verts[last - 1][1] + (verts[last][1] - verts[last - 1][1]) * ee;
  }
  const tip = [X([tipx, tipy]), Y([tipx, tipy])];
  const own = (i) => owner[S.on[i % S.on.length]] * 3;
  const sx = X(S.start), sy = Y(S.start);
  if (S.balanced) {
    // The whole bar's polygon, faint, from where this bar began.
    const poly = S.P.slice(0, -1).map((p) => [X([p[0] + S.start[0], p[1] + S.start[1]]), Y([p[0] + S.start[0], p[1] + S.start[1]])]);
    fill(S, poly, 0.12, col, 0);
    for (let i = 0; i < S.on.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      line(S, a[0], a[1], b[0], b[1], 0.35, col, own(i));
    }
    // The part swept so far this bar, a wedge from the start to each edge in
    // the edge's colour.
    for (let i = 1; i <= last; i++) {
      const a = [X(verts[i - 1]), Y(verts[i - 1])], b = i === last ? tip : [X(verts[i]), Y(verts[i])];
      fill(S, [[sx, sy], a, b], 0.22, col, own(i - 1));
    }
  } else {
    // Earlier bars of the walk, dimmer, each with its miss dashed in red.
    for (const h of S.hist) {
      for (let i = 1; i < h.length; i++) line(S, X(h[i - 1]), Y(h[i - 1]), X(h[i]), Y(h[i]), 0.45, col, own(i - 1));
      line(S, X(h[h.length - 1]), Y(h[h.length - 1]), X(h[0]), Y(h[0]), 0.8, WHITE, 6, true);
      disc(S, X(h[h.length - 1]), Y(h[h.length - 1]), 1, 0.8, WHITE, 6);
    }
  }
  for (let i = 1; i < last; i++) thick(S, X(verts[i - 1]), Y(verts[i - 1]), X(verts[i]), Y(verts[i]), 0.9, col, own(i - 1));
  if (last > 0) thick(S, X(verts[last - 1]), Y(verts[last - 1]), tip[0], tip[1], 1.1, col, own(last - 1));
  if (!S.balanced && last > 0) line(S, tip[0], tip[1], sx, sy, 0.6, WHITE, 6, true);
  // The start, ringing when the walk comes back to it, and the tip.
  const fc = exp(-(t - S.closeAt) / 0.45);
  disc(S, sx, sy, 1.3 + fc, 0.7 + 0.3 * fc, WHITE, 0);
  if (fc > 0.02) for (let i = 0; i < 32; i++) dot(S, sx + (2.5 + 6 * (1 - fc)) * cos((2 * PI * i) / 32), sy + (2.5 + 6 * (1 - fc)) * sin((2 * PI * i) / 32), 0.6 * fc, WHITE, 0);
  disc(S, tip[0], tip[1], 1.2, 1, WHITE, 0);

  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++)
      display.setPixel(x, y, round(min(1, R[p]) * 255), round(min(1, G[p]) * 255), round(min(1, B[p]) * 255));
}
