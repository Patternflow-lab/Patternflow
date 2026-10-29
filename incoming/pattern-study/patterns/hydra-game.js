// ===== Patternflow pattern =====
// Title:   Hydra Game
// Family:  algo
// Idea:    Hercules fights Kirby and Paris's hydra, a tree rooted at the bottom of the panel with glowing heads on curved necks: at step n he cuts one head, and unless it grew straight from the root the node two levels down grows n copies of the stump's branch, which sprout from it in gold, so the hydra swells into a dense fan of hundreds or thousands of heads while the ordinal at the top, the sum of omega to the power of each branch's ordinal, falls at every cut, and the cuts come faster and faster until the last head drops and the root stands alone.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the hydra game (Laurie Kirby and Jeff Paris, Accessible independence results for Peano arithmetic, Bulletin of the London Mathematical Society, 1982), the ordinal of a tree in Cantor normal form (Georg Cantor), pattern round 72
// Round:   72
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Hydra=1..5, Strategy=0..3
//
// Knob 1: Hue. Turns the hydra round the wheel. At 0 the necks are green and the heads pale mint, new growth sprouts gold and the ordinal's omegas are green; at 0.25 the necks are sky blue, at 0.5 violet, at 0.75 rose red.
// Knob 2: Speed. Cuts a second, 0.9 Speed (1 + n / 8) at step n, so the cuts speed up as the hydra grows: at the opening 2 the first cut comes 1.6 s after the hydra has grown, step 40 at about 8 s, step 1149 at 23 s and step 5629 at 30 s; at 0.2 everything takes ten times as long.
// Knob 3: Hydra. Five starting hydras, by whole steps. 1: omega^2 + omega + 1, a root with a two-headed neck, a one-headed neck and a head, 7 nodes; cut from the right it dies at step 1149 with 576 nodes at its biggest. 2: omega^omega, a single neck of three, dead at step 37 from either side, 20 nodes at most. 3: omega^2 + omega 2, dead at step 445 from either side, 224 nodes. 4: omega^2 + omega + 2, dead at step 5629 from the right, 2816 nodes. 5: omega^2 + omega 2 + 2, dead at step 2302 from either side, 1153 nodes.
// Knob 4: Strategy. Which head Hercules cuts, by whole steps: 0 the rightmost, 1 the leftmost, 2 a random branch at every fork, 3 the end of the longest neck, the rightmost of the deepest. The order changes the length of the fight a hundredfold: hydra 1 dies at step 1149 cut from the right, at 30 from the left and at 23 from the deepest end, and 2000 random hunts took from 17 to 441 steps. A hunt whose regrowth would pass 8000 nodes is called off; in 2000 random hunts on hydra 5 that happened twice.
// Buttons: K1 tap grows the hydra again from its root.

// Kirby and Paris (1982): a hydra is a finite rooted tree and its heads are
// the leaves. At step n Hercules cuts a head. If its neck grows from the
// root, the head is simply gone; otherwise the node below the stump grows n
// copies of the stump's branch, head removed. Every way of choosing heads
// kills every hydra in finitely many steps, and Peano arithmetic cannot
// prove it. The proof gives each node the ordinal o(v) = the sum of
// omega^o(c) over its children c, written in Cantor normal form with the
// biggest terms first: a cut lowers one term and adds n smaller ones, so
// the root's ordinal falls at every step, and ordinals below epsilon_0 cannot
// fall forever. Arithmetic counts only up to omega^omega^... of finite
// height, short of epsilon_0, so it cannot see the end.
//
// The panel can draw a few thousand heads, which leaves the hydras below
// omega^3 and the single neck of three: the rightmost cut on omega^2 started
// at step m ends near (m + 4) 2^(m + 2), and an omega^2 met at step 40
// would need some 10^13 steps.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sin, cos, exp, sqrt, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The root's children as brackets, each pair a node, an empty pair a head.
const HYDRAS = ["(()())(())()", "((()))", "(())(()())(())", "(()())(())()()", "()(())(()())(())()"];
const CAP = 8000;
const ROOT_X = 31.5, ROOT_Y = 124, TOP_Y = 24;
const HUE0 = 0.36;

function mk(p, x, y, t) {
  return { p, c: [], x, y, tx: x, ty: y, dx: 0, b: t, ph: Math.random() * 2 * PI, k: 1, h: 0 };
}
function clone(v, p, x, y, t) {
  const u = mk(p, x, y, t);
  for (const c of v.c) u.c.push(clone(c, u, x, y, t));
  return u;
}
function size(v) {
  let s = 1;
  for (const c of v.c) s += size(c);
  return s;
}
function height(v) {
  let h = 0;
  for (const c of v.c) h = max(h, height(c) + 1);
  return (v.h = h);
}

// ---- Ordinals below epsilon_0: a list of [exponent, coefficient] terms,
// exponents falling, each exponent an ordinal of the same kind; [] is 0.
function cmpO(a, b) {
  for (let i = 0; i < a.length && i < b.length; i++) {
    const c = cmpO(a[i][0], b[i][0]);
    if (c) return c;
    if (a[i][1] !== b[i][1]) return a[i][1] - b[i][1];
  }
  return a.length - b.length;
}
function ord(v) {
  if (!v.c.length) return [];
  const ex = v.c.map(ord).sort((a, b) => cmpO(b, a)), out = [];
  for (const e of ex) {
    const l = out[out.length - 1];
    if (l && !cmpO(l[0], e)) l[1]++;
    else out.push([e, 1]);
  }
  return out;
}

// ---- The game.
function restart(S, hy) {
  S.hy = hy;
  const root = mk(null, ROOT_X, ROOT_Y, S.t), st = [root];
  for (const ch of HYDRAS[hy]) {
    if (ch === "(") {
      const v = mk(st[st.length - 1], ROOT_X, ROOT_Y, S.t);
      st[st.length - 1].c.push(v);
      st.push(v);
    } else st.pop();
  }
  S.root = root;
  S.nodes = size(root);
  // Levels share the 100 rows above the root: 50 apart for a hydra two
  // necks high, 33 for three.
  S.sp = min(50, floor((ROOT_Y - TOP_Y) / height(root)));
  S.n = 0;
  S.acc = 0;
  S.state = 0;
  S.st = 0;
  S.grow = 1;
  S.dirty = true;
  S.fx = [];
  aim(S);
}

// The head Hercules cuts next, as the branch index taken at each fork.
function aim(S) {
  const path = [];
  let v = S.root;
  if (S.strat === 3) height(S.root);
  while (v.c.length) {
    const n = v.c.length;
    let i = n - 1;
    if (S.strat === 1) i = 0;
    else if (S.strat === 2) i = floor(Math.random() * n);
    else if (S.strat === 3) for (const want = v.h - 1; i > 0 && v.c[i].h !== want; i--);
    path.push(i);
    v = v.c[i];
  }
  S.path = path;
  S.aim = path.length ? v : null;
}

function chop(S) {
  const path = S.path;
  let g = null, p = null, v = S.root;
  for (let d = 0; d < path.length; d++) (g = p), (p = v), (v = v.c[path[d]]);
  const n = ++S.n;
  p.c.splice(path[path.length - 1], 1);
  S.nodes--;
  S.dirty = true;
  if (S.fx.length < 28) S.fx.push({ cx: v.x + v.dx, cy: v.y, x: v.x + v.dx, y: v.y, vx: (Math.random() - 0.5) * 14, vy: -14, a: 0 });
  if (g) {
    const s = size(p);
    if (S.nodes + n * s > CAP) {
      S.state = 2;
      S.st = 0;
      return;
    }
    const at = path[path.length - 2] + 1, copies = [];
    for (let j = 0; j < n; j++) copies.push(clone(p, g, g.x + g.dx, g.y, S.t));
    g.c = g.c.slice(0, at).concat(copies, g.c.slice(at));
    S.nodes += n * s;
  }
  if (!S.root.c.length) {
    S.state = 1;
    S.st = 0;
    S.aim = null;
    return;
  }
  aim(S);
}

// Heads under each node, then a span of the 60 columns for each node in
// proportion to its heads, levels S.sp apart up from the root.
// A node with a head of its own keeps at least 4 heads' width, so a few
// branches stay apart beside a fan of hundreds.
function count(v) {
  if (!v.c.length) return (v.k = v.w = 1);
  let s = 0, w = 0;
  for (const c of v.c) (s += count(c)), (w += c.w);
  v.w = max(4, w);
  return (v.k = s);
}
function place(S, v, a, b, d) {
  v.tx = (a + b) / 2;
  v.ty = ROOT_Y - d * S.sp;
  let x = a, sw = 0;
  for (const c of v.c) sw += c.w;
  for (const c of v.c) {
    const w = ((b - a) * c.w) / sw;
    place(S, c, x, x + w, d + 1);
    x += w;
  }
}
function ease(S, v, e, d) {
  v.x += (v.tx - v.x) * e;
  v.y += (v.ty - v.y) * e;
  // The necks writhe: a head sways up to 0.7 LED a level.
  v.dx = d ? sin(S.t * 1.7 + v.ph) * 0.7 * d : 0;
  for (const c of v.c) ease(S, c, e, d + 1);
}

export function setup(params) {
  params.s = { t: 0, hue: 0, speed: 2, strat: 0, hy: -1, A: new Float32Array(N * 3), O: new Uint8ClampedArray(N * 3), ordv: [], fx: [] };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1], 0.2, 3);
  const hy = cl(round(k[2]), 1, 5) - 1, strat = cl(round(k[3]), 0, 3);
  S.t += d;
  if (hy !== S.hy || (input.btnPressed && input.btnPressed[0])) restart(S, hy);
  if (strat !== S.strat) {
    S.strat = strat;
    if (S.state === 0) aim(S);
  }
  if (S.state === 0) {
    if (S.grow > 0) S.grow -= d;
    else {
      S.acc += d * S.speed * 0.9 * (1 + S.n / 8);
      for (let m = 0; S.acc >= 1 && S.state === 0; m++) {
        if (m === 600) {
          S.acc = 0;
          break;
        }
        chop(S);
        S.acc -= 1;
      }
    }
  } else {
    S.st += d;
    if (S.st > (S.state === 1 ? 3.5 : 2)) restart(S, S.hy);
  }
  count(S.root);
  place(S, S.root, 1.5, 61.5, 0);
  ease(S, S.root, 1 - exp(-d * 7), 0);
  if (S.dirty) {
    S.ordv = ord(S.root);
    S.heads = S.root.c.length ? S.root.k : 0;
    S.dirty = false;
  }
  for (const f of S.fx) {
    f.a += d;
    f.vy += 70 * d;
    f.x += f.vx * d;
    f.y += f.vy * d;
  }
  S.fx = S.fx.filter((f) => f.a < 1.6 && f.y < H + 2);
}

// ---- Drawing into a light buffer, then 1 - exp(-light) per channel.
function splat(A, x, y, r, g, b) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  for (let j = 0; j < 2; j++) {
    const yy = iy + j;
    if (yy < 0 || yy >= H) continue;
    const wy = j ? fy : 1 - fy;
    for (let i = 0; i < 2; i++) {
      const xx = ix + i;
      if (xx < 0 || xx >= W) continue;
      const w = wy * (i ? fx : 1 - fx), o = (yy * W + xx) * 3;
      A[o] += r * w;
      A[o + 1] += g * w;
      A[o + 2] += b * w;
    }
  }
}
// A neck: it leaves its node straight up and bends over to the child,
// 2.8 LEDs thick at the node and 1.4 at the head, in a faint glow, and a
// wave of up to 1.1 LEDs runs up it at phase ph.
function neck(A, x0, y0, x1, y1, col, w, thick, ph) {
  const ky = y0 + (y1 - y0) * 0.6, n = 2 + floor(max(abs(x1 - x0), abs(y1 - y0)) * 1.25);
  const r = col[0] * w, g = col[1] * w, b = col[2] * w;
  for (let i = 1; i < n; i++) {
    const t = i / n, u = 1 - t, y = u * u * y0 + 2 * u * t * ky + t * t * y1;
    let x = u * u * x0 + 2 * u * t * x0 + t * t * x1;
    if (!thick) {
      splat(A, x, y, r, g, b);
      continue;
    }
    x += 1.1 * sin(PI * t) * sin(ph - 5 * t);
    // Across the neck: the normal to the curve's tangent.
    let tx = 2 * t * (x1 - x0), ty = 2 * u * (ky - y0) + 2 * t * (y1 - ky);
    const l = sqrt(tx * tx + ty * ty) || 1, half = (2.8 - 1.4 * t) / 2;
    tx /= l;
    ty /= l;
    for (let j = -1; j <= 1; j++) {
      const q = j ? 0.45 : 0.8;
      splat(A, x - ty * half * j, y + tx * half * j, r * q, g * q, b * q);
    }
    // and its glow, 1.5 LEDs further out each side.
    for (let j = -1; j <= 1; j += 2) splat(A, x - ty * (half + 1.5) * j, y + tx * (half + 1.5) * j, r * 0.16, g * 0.16, b * 0.16);
  }
}
function headDot(A, x, y, col, w) {
  splat(A, x, y - 0.5, col[0] * w * 1.6, col[1] * w * 1.6, col[2] * w * 1.6);
  const q = w * 0.45;
  for (const [i, j] of [[-1.2, 0], [1.2, 0], [0, -1.6], [-0.9, -1.2], [0.9, -1.2]]) splat(A, x + i, y + j, col[0] * q, col[1] * q, col[2] * q);
}
// The neck colour, gold for a branch just grown and back to the hydra's in
// a second.
const MIX = [0, 0, 0];
function tint(C, age) {
  const f = age < 1 ? (1 - age) * (1 - age) : 0;
  for (let i = 0; i < 3; i++) MIX[i] = C.neck[i] + (C.gold[i] - C.neck[i]) * f;
  return MIX;
}
const BN = new Float32Array(64), BX = new Float32Array(64), BY = new Float32Array(64), BA = new Float32Array(64), BL = new Float32Array(64);
function drawNode(S, A, C, v) {
  const n = v.c.length;
  if (!n) return;
  const px = v.x + v.dx, py = v.y;
  if (n <= 48) {
    for (const c of v.c) {
      const cx = c.x + c.dx;
      neck(A, px, py, cx, c.y, tint(C, S.t - c.b), 0.85, true, S.t * 2.3 + c.ph);
      if (c.c.length) {
        // A joint where the neck meets the next ones.
        splat(A, cx, c.y, C.neck[0] * 0.7, C.neck[1] * 0.7, C.neck[2] * 0.7);
        drawNode(S, A, C, c);
      } else headDot(A, cx, c.y, C.head, 1);
    }
    return;
  }
  // Hundreds of necks from one node: one neck a column, as bright as the
  // square root of the necks it stands for.
  BN.fill(0);
  BX.fill(0);
  BY.fill(0);
  BA.fill(0);
  BL.fill(0);
  for (const c of v.c) {
    const cx = c.x + c.dx, j = cl(round(cx), 0, 63);
    BN[j]++;
    BX[j] += cx;
    BY[j] += c.y;
    BA[j] += S.t - c.b;
    if (c.c.length) drawNode(S, A, C, c);
    else BL[j]++;
  }
  for (let j = 0; j < 64; j++) {
    if (!BN[j]) continue;
    const cx = BX[j] / BN[j], cy = BY[j] / BN[j], w = sqrt(BN[j]);
    neck(A, px, py, cx, cy, tint(C, BA[j] / BN[j]), 0.55 * w, false, 0);
    if (BL[j]) headDot(A, cx, cy, C.head, sqrt(BL[j]));
  }
}

// ---- The 3 by 5 face for the counters, and a 5-wide omega.
const G = {
  0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001011001111", 4: "101101111001001",
  5: "111100111001111", 6: "111100111101111", 7: "111001010010010", 8: "111101111101111", 9: "111101111001111",
  n: "000110101101101", "=": "000111000111000", "+": "000010111010000", D: "110101101101110", E: "111100110100111",
  A: "010101111101101", M: "101111111101101", X: "101101010101101",
};
// rows 00000 10001 10101 10101 01010
const OMEGA = "0000010001101011010101010";
function put(O, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  O[o] = r;
  O[o + 1] = g;
  O[o + 2] = b;
}
function glyph(O, ch, x, y, col) {
  const g = G[ch];
  for (let i = 0; i < 15; i++) if (g[i] === "1") put(O, x + (i % 3), y + floor(i / 3), col[0], col[1], col[2]);
  return x + 4;
}
function text(O, s, x, y, col) {
  for (const ch of s) x = glyph(O, ch, x, y, col);
  return x;
}
function omega(O, x, y, col) {
  for (let i = 0; i < 25; i++) if (OMEGA[i] === "1") put(O, x + (i % 5), y + floor(i / 5), col[0], col[1], col[2]);
  return x + 6;
}
// An ordinal in Cantor normal form, exponents raised 4 rows; returns the
// end column, or 99 when the next term would pass the edge.
function ordText(O, o, x, y, C) {
  if (!o.length) return text(O, "0", x, y, C.txt);
  for (let i = 0; i < o.length; i++) {
    const [e, c] = o[i];
    if (i) {
      if (x > 54) return 99;
      x = glyph(O, "+", x, y, C.dim);
    }
    if (!e.length) {
      x = text(O, String(c), x, y, C.txt);
      continue;
    }
    x = omega(O, x, y, C.om);
    if (!(e.length === 1 && !e[0][0].length && e[0][1] === 1)) x = ordText(O, e, x, y - 4, C);
    if (c > 1) {
      put(O, x, y + 2, C.dim[0], C.dim[1], C.dim[2]);
      x = text(O, String(c), x + 2, y, C.txt);
    }
  }
  return x;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.root) return;
  const A = S.A, O = S.O, h = S.hue + HUE0;
  const C = {
    neck: hsv(h, 0.85, 0.9),
    head: hsv(h + 0.04, 0.3, 1),
    gold: hsv(h - 0.22, 0.55, 1.1),
    txt: [200, 200, 196],
    dim: [120, 120, 120],
    om: hsv(h, 0.6, 1).map((c) => round(c * 255)),
  };
  A.fill(0);
  // The ground the root stands on.
  for (let x = 0; x < W; x++) {
    const o = (127 * W + x) * 3, f = 0.1 * exp(-(((x - ROOT_X) / 22) ** 2));
    A[o] += C.neck[0] * f;
    A[o + 1] += C.neck[1] * f;
    A[o + 2] += C.neck[2] * f;
  }
  // Called off for size: the hydra fades out.
  const fade = S.state === 2 ? max(0, 1 - S.st / 1.5) : 1;
  drawNode(S, A, C, S.root);
  // The root, pulsing while it stands alone.
  const rw = S.state === 1 ? 1.4 + 0.8 * sin(S.st * 5) : 1;
  // Dead: a ring goes out from the root, 30 LEDs in 1.5 s.
  if (S.state === 1 && S.st < 1.5) {
    const r = 3 + S.st * 20, q = 1.6 * (1 - S.st / 1.5);
    for (let i = 0; i < 80; i++) {
      const a = (i / 80) * PI;
      splat(A, S.root.x + r * cos(a), ROOT_Y - r * sin(a), C.head[0] * q, C.head[1] * q, C.head[2] * q);
    }
  }
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) splat(A, S.root.x + i, ROOT_Y + j, C.neck[0] * rw * (i || j ? 0.5 : 1.2), C.neck[1] * rw * (i || j ? 0.5 : 1.2), C.neck[2] * rw * (i || j ? 0.5 : 1.2));
  // The next head, ringed while the cuts are slow enough to follow.
  if (S.aim && S.state === 0 && S.grow <= 0 && S.speed * 0.9 * (1 + S.n / 8) < 6) {
    const a = S.aim, ax = a.x + a.dx, w = 0.35 + 0.25 * sin(S.t * 14);
    for (let i = 0; i < 12; i++) splat(A, ax + 2.7 * cos((i * PI) / 6), a.y + 2.7 * sin((i * PI) / 6), w, w, w * 0.9);
  }
  // Each cut: a white flash where the neck was, and the head falling.
  for (const f of S.fx) {
    if (f.a < 0.3) {
      const q = (1 - f.a / 0.3) * 1.4, r = 1 + f.a * 9;
      for (let i = 0; i < 10; i++) splat(A, f.cx + r * cos(i * 0.63), f.cy + r * sin(i * 0.63), q * 0.5, q * 0.5, q * 0.42);
    }
    const q = max(0, 1 - f.a / 1.6) * 1.3;
    splat(A, f.x, f.y, C.head[0] * q, C.head[1] * q, C.head[2] * q);
  }
  for (let p = 0; p < N * 3; p++) O[p] = 255 * fade * (1 - exp(-1.25 * A[p]));
  // Step and heads, the ordinal under them.
  let x = text(O, "n=", 1, 1, C.dim);
  text(O, String(S.n), x, 1, C.txt);
  const right = S.state === 1 ? "DEAD" : S.state === 2 ? "MAX" : String(S.heads);
  x = 64 - right.length * 4;
  if (S.state === 0) {
    const hc = C.head.map((c) => round(c * 230));
    for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(O, x - 4 + i, 2 + j, hc[0], hc[1], hc[2]);
  }
  text(O, right, x, 1, C.txt);
  if (ordText(O, S.ordv, 1, 11, C) === 99) for (let i = 0; i < 3; i++) put(O, 58 + i * 2, 15, C.dim[0], C.dim[1], C.dim[2]);
  for (let p = 0, y = 0; y < H; y++) for (let xx = 0; xx < W; xx++, p += 3) display.setPixel(xx, y, O[p], O[p + 1], O[p + 2]);
}
