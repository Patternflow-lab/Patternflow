// ===== Patternflow pattern =====
// Title:   Hex Theorem
// Family:  cells
// Idea:    A Hex board stands on its long diagonal and fills one random cell at a time until one colour's chain joins that colour's two edges and lights up with a pulse running along it; on the full board the loser's cells flood in from both of its edges and stop against the chain, and Gale's walk threads the seam between the colours from the bottom corner out to the corner that names the winner.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Hex theorem (David Gale, 1979), on the game of Hex (Piet Hein, 1942; John Nash, 1948), pattern round 55
// Round:   55
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Size=7..15, Bias=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 player A, who owns the lower right and upper left edges, is azure and player B, who owns the other two, is magenta, on dark slate empty cells; a winning chain brightens, its shortest path runs near white, and the loser's two floods take two pale tints of its colour. At 0.25 A is violet and B lime, at 0.5 A rose and B teal, at 0.75 A green and B blue. The wheel skips the stretch from orange to yellow, which reads brown and olive on the dim cells.
// Knob 2: Speed. At 2 a 7 x 7 board fills at 18 cells a second and is full in 2.7 s; a 15 x 15 board fills at 57 a second and is full in 4 s. The win holds the filling for 0.45 s, then the proof takes 1.9 s, the hold 1.3 s and the clearing wave 0.9 s, so a 7 x 7 board turns over every 7.3 s. 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Size. The board's side, 7 to 15 cells. Cells are about 8 LEDs across at 7 and 4 at 15, stood 18 to 21% taller than regular so the long diagonal runs 116 rows. At even odds the first chain shows when 86% of a 7 x 7 board is filled (median of 2,000 boards) and 91% of a 15 x 15 board, and Gale's walk is 32 and 110 edges long.
// Knob 4: Bias. Each cell goes to A with chance 0.5 + 0.25 x Bias, from 0.25 to 0.75, and 0.515 at the opening 0.06. A then wins 56% of 7 x 7 boards and 59% of 15 x 15; at Bias 0.5 (0.625) 87% and 97%. With a bias the chain shows when the winner holds about half the board, the threshold of site percolation on the triangular lattice: after 80% of the cells at 0.625 and 67% at 0.75.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, exp, round } = Math;
const R3 = sqrt(3);
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The six neighbours in turn round a cell, in axial coordinates (q, r).
const DQ = [1, 1, 0, -1, -1, 0], DR = [0, -1, -1, 0, 1, 1];
// Board seconds at Speed 2: a 7 x 7 board fills in FILL, longer boards as
// the square root of their side; then the pause on the win, the proof
// (flood and walk), the hold and the clearing wave.
const FILL = 2.7, PAUSE = 0.45, PROOF = 1.9, HOLD = 1.3, CLEAR = 0.9;
// The two players' hues at knob 0, before the wheel below bends them.
const HUE_A = 0.324, HUE_B = 0.797;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// The knob's wheel skips the stretch from orange through yellow to lime,
// which reads brown and olive on the dim cells.
const wheel = (h) => 0.28 + 0.74 * (h - floor(h));

export function setup(params) {
  params.s = {
    n: 0, hue: 0, speed: 2, p: 0.5, clock: 0,
    rgb: new Float32Array(N * 3), cc: null, tmp: new Float32Array(3),
  };
}

// Pixel to cell, once per board size. Cell (q, r) sits at
// x = (q - r) s / 2, y = -(q + r) h, so (0, 0) is the bottom corner,
// (n-1, n-1) the top, and the rows r = 0 and r = n - 1 are the lower right
// and upper left sides.
function layout(S, n) {
  const s = 58 / n;
  const ky = min(1.25, 116 / (s * (R3 * (n - 1) + 2 / R3)));
  const h = (s * R3 / 2) * ky, ox = 32, oy = 64 + (n - 1) * h;
  const cell = new Int16Array(N).fill(-1), shade = new Float32Array(N), side = new Uint8Array(N);
  const hexm = (dq, dr) => max(abs(dq + dr / 2), abs(dr + dq / 2), abs((dq - dr) / 2));
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const u = (x + 0.5 - ox) / (s / 2), v = (oy - y - 0.5) / h;
      const fq = (u + v) / 2, fr = (v - u) / 2, fs = -fq - fr;
      let q = round(fq), r = round(fr);
      const t = round(fs), eq = abs(q - fq), er = abs(r - fr), es = abs(t - fs);
      if (eq > er && eq > es) q = -r - t;
      else if (er > es) r = -q - t;
      if (q >= 0 && q < n && r >= 0 && r < n) {
        cell[p] = r * n + q;
        // A soft seam a pixel wide where two cells meet.
        shade[p] = cl(((0.5 - hexm(fq - q, fr - r)) * s - 0.3) / 0.9, 0, 1);
        continue;
      }
      // Outside: how far to the nearest cell of the board, for the home edges.
      const cq = cl(q, 0, n - 1), cr = cl(r, 0, n - 1);
      let m = 9;
      for (let k = -1; k < 6; k++) {
        const aq = cq + (k < 0 ? 0 : DQ[k]), ar = cr + (k < 0 ? 0 : DR[k]);
        if (aq < 0 || aq >= n || ar < 0 || ar >= n) continue;
        m = min(m, hexm(fq - aq, fr - ar));
      }
      const out = (m - 0.5) * s;
      const a = cl(out - 0.4, 0, 1) * cl(2.8 - out, 0, 1);
      if (a <= 0) continue;
      shade[p] = a;
      side[p] = max(-fr, fr - (n - 1)) > max(-fq, fq - (n - 1)) ? 1 : 2;
    }
  Object.assign(S, { s, h, ox, oy, cell, shade, side });
}

function newBoard(S, n) {
  if (n !== S.n) layout(S, n), (S.cc = new Float32Array(n * n * 3));
  S.n = n;
  const M = n * n;
  S.cells = new Uint8Array(M);
  S.at = new Float32Array(M).fill(-99);
  // Each cell's draw is made as the board is laid and held against Bias
  // when the cell's turn comes, so a turn of the knob recolours only the
  // cells still to come.
  S.u = new Float32Array(M);
  S.order = new Int16Array(M);
  for (let i = 0; i < M; i++) (S.order[i] = i), (S.u[i] = Math.random());
  for (let i = M - 1; i > 0; i--) {
    const j = floor(Math.random() * (i + 1)), t = S.order[i];
    S.order[i] = S.order[j];
    S.order[j] = t;
  }
  // Union-find over the cells and four side nodes: A's rows r = 0 and
  // r = n - 1, then B's columns q = 0 and q = n - 1.
  S.par = new Int16Array(M + 4);
  for (let i = 0; i < M + 4; i++) S.par[i] = i;
  S.k = 0;
  S.acc = 0;
  S.wait = 0;
  S.winner = 0;
  S.winAt = 0;
  S.path = [];
  S.onPath = new Int16Array(M).fill(-1);
  S.club = new Uint8Array(M);
  S.flood = new Int16Array(M);
  S.fmax = 1;
  S.walk = null;
  S.phase = 0;
  S.pt = 0;
}

function find(P, i) {
  while (P[i] !== i) (P[i] = P[P[i]]), (i = P[i]);
  return i;
}
function join(P, a, b) {
  a = find(P, a);
  b = find(P, b);
  if (a !== b) P[a] = b;
}

function place(S) {
  const n = S.n, M = n * n, P = S.par, i = S.order[S.k++], c = S.u[i] < S.p ? 1 : 2;
  S.cells[i] = c;
  S.at[i] = S.clock;
  const q = i % n, r = (i / n) | 0;
  for (let k = 0; k < 6; k++) {
    const aq = q + DQ[k], ar = r + DR[k];
    if (aq >= 0 && aq < n && ar >= 0 && ar < n && S.cells[ar * n + aq] === c) join(P, i, ar * n + aq);
  }
  if (c === 1) {
    if (r === 0) join(P, i, M);
    if (r === n - 1) join(P, i, M + 1);
  } else {
    if (q === 0) join(P, i, M + 2);
    if (q === n - 1) join(P, i, M + 3);
  }
  if (!S.winner) {
    if (find(P, M) === find(P, M + 1)) win(S, 1);
    else if (find(P, M + 2) === find(P, M + 3)) win(S, 2);
  }
  if (S.winner) {
    // The winning chain's whole cluster, which grows as the board fills.
    const root = find(P, S.winner === 1 ? M : M + 2);
    for (let j = 0; j < M; j++) S.club[j] = S.cells[j] === S.winner && find(P, j) === root ? 1 : 0;
  }
}

const onSide = (n, c, i, which) => (c === 1 ? ((i / n) | 0) === (which ? n - 1 : 0) : i % n === (which ? n - 1 : 0));

// Breadth-first distances through colour c from one of its sides.
function bfs(S, c, which, dist) {
  const n = S.n, M = n * n, queue = new Int16Array(M);
  dist.fill(-1);
  let head = 0, tail = 0;
  for (let i = 0; i < M; i++) if (S.cells[i] === c && onSide(n, c, i, which)) (dist[i] = 0), (queue[tail++] = i);
  while (head < tail) {
    const i = queue[head++], q = i % n, r = (i / n) | 0;
    for (let k = 0; k < 6; k++) {
      const aq = q + DQ[k], ar = r + DR[k], j = ar * n + aq;
      if (aq < 0 || aq >= n || ar < 0 || ar >= n || S.cells[j] !== c || dist[j] >= 0) continue;
      dist[j] = dist[i] + 1;
      queue[tail++] = j;
    }
  }
}

// The first chain: the shortest path through the winner's cells from one
// home edge to the other, found the moment the two edges join.
function win(S, c) {
  const n = S.n, M = n * n, d0 = new Int16Array(M);
  S.winner = c;
  S.winAt = S.clock;
  S.wait = PAUSE;
  bfs(S, c, 0, d0);
  let end = -1;
  for (let i = 0; i < M; i++) if (d0[i] >= 0 && onSide(n, c, i, 1) && (end < 0 || d0[i] < d0[end])) end = i;
  const path = [end];
  while (d0[path[path.length - 1]] > 0) {
    const i = path[path.length - 1], q = i % n, r = (i / n) | 0;
    for (let k = 0; k < 6; k++) {
      const aq = q + DQ[k], ar = r + DR[k], j = ar * n + aq;
      if (aq >= 0 && aq < n && ar >= 0 && ar < n && d0[j] === d0[i] - 1) {
        path.push(j);
        break;
      }
    }
  }
  path.reverse();
  S.path = path;
  path.forEach((i, k) => (S.onPath[i] = k));
}

// On the full board: the loser's cells reached from each of its edges, by
// distance, and Gale's walk. The walk starts at the bottom corner on the
// seam between the two border rows, and at every corner of a cell it meets
// it turns so that A stays on one hand and B on the other. It cannot close
// or stop, so it leaves at another corner, and which one says who won.
function proof(S) {
  const n = S.n, M = n * n, lose = 3 - S.winner, d = new Int16Array(M);
  S.flood.fill(-1);
  for (const which of [0, 1]) {
    bfs(S, lose, which, d);
    for (let i = 0; i < M; i++) if (d[i] >= 0) S.flood[i] = which * 1000 + d[i];
  }
  S.fmax = 1;
  for (let i = 0; i < M; i++) if (S.flood[i] >= 0) S.fmax = max(S.fmax, S.flood[i] % 1000);
  const col = (q, r) => {
    const qi = q >= 0 && q < n, ri = r >= 0 && r < n;
    if (qi && ri) return S.cells[r * n + q];
    if (!qi && !ri) return 0;
    return ri ? 2 : 1;
  };
  const px = (q, r) => S.ox + ((q - r) * S.s) / 2, py = (q, r) => S.oy - (q + r) * S.h;
  const vert = (a, b, c) => [(px(a[0], a[1]) + px(b[0], b[1]) + px(c[0], c[1])) / 3, (py(a[0], a[1]) + py(b[0], b[1]) + py(c[0], c[1])) / 3];
  // The cell beside both a and b that is not x.
  const other = (a, b, x) => {
    const dq = b[0] - a[0], dr = b[1] - a[1];
    let k = 0;
    while (DQ[k] !== dq || DR[k] !== dr) k++;
    const u = [a[0] + DQ[(k + 5) % 6], a[1] + DR[(k + 5) % 6]];
    return u[0] === x[0] && u[1] === x[1] ? [a[0] + DQ[(k + 1) % 6], a[1] + DR[(k + 1) % 6]] : u;
  };
  let a = [0, -1], b = [-1, 0], back = [-1, -1], ahead = [0, 0];
  const pts = [vert(a, b, back)];
  for (let guard = 0; guard < 4 * M + 20; guard++) {
    pts.push(vert(a, b, ahead));
    const c = col(ahead[0], ahead[1]);
    if (c === 0) break;
    let dropped;
    if (c === 1) (dropped = a), (a = ahead);
    else (dropped = b), (b = ahead);
    ahead = other(a, b, dropped);
  }
  S.walk = pts;
  S.walkEnd = ahead[0] === n ? 2 : 1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 7, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  const n = cl(floor(kv[2] + 0.5), 7, 15);
  S.p = 0.5 + 0.25 * cl(kv[3], -1, 1);
  if (n !== S.n) newBoard(S, n);
  const g = (d * S.speed) / 2;
  S.clock += g;
  const M = n * n;
  if (S.phase === 0) {
    if (S.wait > 0) S.wait -= g;
    else {
      S.acc += (g * M) / (FILL * sqrt(n / 7));
      while (S.acc >= 1 && S.k < M) {
        S.acc -= 1;
        const had = S.winner;
        place(S);
        if (!had && S.winner) break;
      }
      if (S.k >= M) (S.phase = 1), (S.pt = 0), proof(S);
    }
  } else {
    S.pt += g;
    if (S.phase === 1 && S.pt >= PROOF + HOLD) (S.phase = 2), (S.pt = 0);
    else if (S.phase === 2 && S.pt >= CLEAR) newBoard(S, n);
  }
}

// Lines for the walk: points every third of a pixel, each laid over its
// four nearest LEDs by how close it falls, so the thread stays white
// across the small cells of a big board.
function plot(rgb, x, y, c, a) {
  const fx = x - 0.5, fy = y - 0.5, ix = floor(fx), iy = floor(fy), tx = fx - ix, ty = fy - iy;
  for (let dy = 0; dy < 2; dy++) {
    const yy = iy + dy;
    if (yy < 0 || yy >= H) continue;
    const wy = dy ? ty : 1 - ty;
    for (let dx = 0; dx < 2; dx++) {
      const xx = ix + dx;
      if (xx < 0 || xx >= W) continue;
      const w = min(1, (dx ? tx : 1 - tx) * wy * 2.5) * a, p = (yy * W + xx) * 3;
      for (let k = 0; k < 3; k++) rgb[p + k] += (c[k] - rgb[p + k]) * w;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.cells) return;
  const n = S.n, M = n * n, cc = S.cc, rgb = S.rgb, T = S.tmp;
  const hA = wheel(HUE_A + S.hue), hB = wheel(HUE_B + S.hue);
  const end = S.phase >= 1, pt = S.pt;
  const pulse = (S.clock - S.winAt) / 1.3;
  for (let i = 0, o = 0; i < M; i++, o += 3) {
    const c = S.cells[i];
    if (!c) {
      (cc[o] = 0.1), (cc[o + 1] = 0.1), (cc[o + 2] = 0.15);
      continue;
    }
    const hc = c === 1 ? hA : hB;
    // Once a chain has won, the other cells step back.
    let s = 0.85, v = S.winner ? 0.5 : 0.62;
    if (S.club[i]) (s = 0.72), (v = 1);
    if (end && !S.club[i]) {
      // The full board: the loser's cells light up from each of its edges,
      // a little apart on the wheel, and stop against the chain.
      const f = S.flood[i];
      const at = f >= 0 ? (f % 1000) / S.fmax : 2;
      const lit = S.phase === 2 ? (f >= 0 ? 1 : 0) : cl((pt / (PROOF * 0.6) - at) * 3, 0, 1);
      hsv(hc + lit * (f >= 1000 ? 0.035 : -0.035), 0.62 - 0.17 * lit, 0.3 + 0.5 * lit, cc, o);
    } else hsv(hc, s, v, cc, o);
    const k = S.onPath[i];
    if (k >= 0) {
      // The chain lights from end to end at 30 cells a second, then a pulse runs along it.
      const shown = (S.clock - S.winAt) * 30 - k;
      if (shown > 0) {
        const ph = pulse - floor(pulse) - k / S.path.length;
        const w = 0.4 + 0.55 * exp(-((ph - round(ph)) ** 2) * 60) + 0.4 * exp(-shown / 6);
        for (let e = 0; e < 3; e++) cc[o + e] += (1 - cc[o + e]) * min(1, w);
      }
    }
    // A fresh cell flashes white.
    const age = S.clock - S.at[i];
    if (age < 0.4) {
      const f = 0.85 * exp(-age / 0.1);
      for (let e = 0; e < 3; e++) cc[o + e] += (1 - cc[o + e]) * f;
    }
  }
  // The clearing wave runs down the board.
  let cut = -1;
  if (S.phase === 2) cut = (pt / CLEAR) * (H + 30) - 15;
  hsv(hA, 0.9, 1, T, 0);
  const eA = [T[0], T[1], T[2]];
  hsv(hB, 0.9, 1, T, 0);
  const eB = [T[0], T[1], T[2]];
  const { cell, shade, side } = S;
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    const i = cell[p];
    if (i >= 0) {
      let a = shade[p];
      if (cut > -2) a *= cl((floor(p / W) - cut) / 12, 0, 1);
      (rgb[o] = cc[i * 3] * a), (rgb[o + 1] = cc[i * 3 + 1] * a), (rgb[o + 2] = cc[i * 3 + 2] * a);
    } else if (side[p]) {
      const e = side[p] === 1 ? eA : eB, a = shade[p];
      (rgb[o] = e[0] * a), (rgb[o + 1] = e[1] * a), (rgb[o + 2] = e[2] * a);
    } else rgb[o] = rgb[o + 1] = rgb[o + 2] = 0;
  }
  // Gale's walk, drawn in along the seams after the flood has started,
  // with a spark at its head; once it is out, the spark runs it again
  // from the bottom corner every 1.2 seconds.
  if (S.phase >= 1 && S.walk) {
    const pts = S.walk, L = pts.length - 1, drawn = S.phase === 1 && pt < PROOF;
    const f = drawn ? cl((pt - PROOF * 0.25) / (PROOF * 0.75), 0, 1) * L : L;
    const head = drawn ? f : (((S.phase === 1 ? pt - PROOF : pt + HOLD) / 1.2) % 1) * L;
    const col = [0.95, 0.95, 0.86], hot = [1, 1, 1];
    for (let k = 0; k < L && k < f; k++) {
      const [xa, ya] = pts[k], [xb, yb] = pts[k + 1], u = min(1, f - k);
      const len = Math.hypot(xb - xa, yb - ya), m = Math.ceil(len * 3 * u) || 1;
      for (let e = 0; e <= m; e++) {
        const y = ya + ((yb - ya) * u * e) / m, a = cut > -2 ? cl((y - cut) / 12, 0, 1) : 1;
        if (a <= 0) continue;
        const x = xa + ((xb - xa) * u * e) / m, near = cl(1 - abs(k + (u * e) / m - head) / 3, 0, 1);
        plot(rgb, x, y, near > 0 ? hot : col, (0.8 + 0.2 * near) * a);
        if (near > 0.5) for (const [dx, dy] of [[-0.6, 0], [0.6, 0], [0, -0.6], [0, 0.6]]) plot(rgb, x + dx, y + dy, hot, near * a);
      }
    }
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
