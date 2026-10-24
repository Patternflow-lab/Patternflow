// ===== Patternflow pattern =====
// Title:   Brownian Frontier
// Family:  line
// Idea:    A fine random walk scribbles outward on a lattice; the sites it has visited stay dim blue, brighter where it has stood many times, the pockets it has closed off glow faint indigo, and its frontier, the visited sites that touch the unbounded outside, is a bright gold crinkled curve that the walk keeps eating, leaving a brief orange ring where it was, and redrawing further out, while the view pulls back so the path always fills the panel and the frontier looks just as crinkled at every scale.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: frontier of planar Brownian motion, dimension 4/3 (conjectured by Benoit Mandelbrot, 1982; proved by Gregory Lawler, Oded Schramm and Wendelin Werner, 2001), pattern round 40
// Round:   40
// ===============================
// @matrix 64x128
// @knobs Trail=0..1, Speed=0.2..3, Fine=1..3, Rings=0..1
//
// Knob 1: Trail. How long a visited site stays lit cyan after the walk last stood on it, as a time constant. At 0 0.7 seconds, a short bright tangle behind the head; at 0.5 4.4 seconds; at 1 28 seconds, so the whole scribble is lit and shades from old to new.
// Knob 2: Speed. At 2 the walk takes 500 steps a second while one LED holds one site, and that times the square of the sites an LED holds as the view pulls back, so the head crosses the panel at the same pace at every scale; a path lasts about 20 seconds. At 0.2 all of it ten times slower, at 3 one and a half times faster.
// Knob 3: Fine. The fewest lattice sites across one LED. At 1 the walk starts one site an LED and the view pulls back to about four and a half by the time the path nears the lattice's edge; at 2 it starts two sites an LED; at 3 three, and the view pulls back only to six. A new value starts a new path once the knob rests.
// Knob 4: Rings. Every 0.3 seconds the frontier is stamped, and a stamped site the walk has since shut in glows orange, fading with a time constant of 0.6 seconds at 0, 0.7 at 0.06 and 15 at 1. Above 0.06 the scribble and its pockets dim too, to a tenth at 1, so the old frontiers stand inside the path as nested orange lines on black.
// Buttons: K1 tap starts a new path.

const W = 64, H = 128;
// The lattice, at most six sites an LED; each path starts in the middle and
// ends when it comes within two sites of the lattice's edge.
const NX = 384, NY = 768, N = NX * NY, CX = 192, CY = 384;
// Steps a second at Speed 2 while one LED holds one site.
const RATE = 500;
// Seconds of the hold at the end of a path and of the fade of the old path
// behind a new one; a new path is first shown once its box is OPEN LEDs
// across. A snapshot of the frontier is kept every RING seconds.
const HOLD = 1.6, GHOST = 2.4, OPEN = 50, RING = 0.3;
const { floor, min, max, abs, exp, round, random, sqrt, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Colours, 0..255: visited sites (dim and bright end), closed-off pockets
// (the bounded parts of the complement), the frontier, the trail, rings.
const VIS0 = [28, 52, 110], VIS1 = [64, 112, 180], LAKE = [30, 20, 76], FRONT = [255, 226, 146], TRAIL = [150, 232, 255], RINGC = [255, 118, 36];

export function setup(params) {
  params.s = {
    vis: new Uint8Array(N), ext: new Uint8Array(N), front: new Uint8Array(N), hits: new Uint8Array(N),
    lastT: new Float32Array(N), ring: new Float32Array(N), stack: new Int32Array(N),
    mapX: new Int16Array(NX), mapY: new Int16Array(NY), cntX: new Int16Array(W), cntY: new Int16Array(H),
    cV: new Float32Array(W * H), cL: new Float32Array(W * H), cH: new Float32Array(W * H), aF: new Uint8Array(W * H),
    aT: new Float32Array(W * H), aR: new Float32Array(W * H), rgb: new Float32Array(W * H * 3),
    ghost: new Float32Array(W * H * 3), ghostT: 99,
    fine: -1, vs: 1, vx: CX, vy: CY,
    x: CX, y: CY, x0: CX, x1: CX, y0: CY, y1: CY,
    now: 0, acc: 0, done: false, holdT: 0, steps: 0, F: 0, V: 0, snap: 0,
    trail: 0.7, rings: 0.7, dim: 1, kf: -1, wait: 0,
  };
}

// The view: sites an LED and the lattice point at the panel's middle. It
// eases toward the path's box with a margin, never pulls in again during a
// path, and always keeps the whole path on the panel.
function frame(S, w) {
  const bw = S.x1 - S.x0 + 1, bh = S.y1 - S.y0 + 1, mx = (S.x0 + S.x1 + 1) / 2, my = (S.y0 + S.y1 + 1) / 2;
  const a = w > 0 ? min(1, w * 2.5) : 1;
  S.vx += (mx - S.vx) * a;
  S.vy += (my - S.vy) * a;
  const want = max(S.fine, (bw * 1.06) / W, (bh * 1.06) / H);
  S.vs = max(S.vs, S.vs + (want - S.vs) * a);
  // Hard bound: every visited site inside the panel with one LED to spare.
  const need = max((S.vx - S.x0 + 0.5) / (W / 2 - 1), (S.x1 + 0.5 - S.vx) / (W / 2 - 1), (S.vy - S.y0 + 0.5) / (H / 2 - 1), (S.y1 + 0.5 - S.vy) / (H / 2 - 1));
  S.vs = max(S.vs, need);
}

// A new path: the old picture is kept to fade out behind it, and the new one
// runs until its box is OPEN LEDs across before it is shown.
function restart(S, keep) {
  if (keep) {
    S.ghost.set(S.rgb);
    S.ghostT = 0;
  }
  S.vis.fill(0);
  S.front.fill(0);
  S.hits.fill(0);
  S.ring.fill(-1e9);
  S.x = S.x0 = S.x1 = CX;
  S.y = S.y0 = S.y1 = CY;
  S.vis[CY * NX + CX] = 1;
  S.vx = CX;
  S.vy = CY;
  S.vs = S.fine;
  S.done = false;
  S.holdT = 0;
  S.steps = 0;
  S.acc = 0;
  S.snap = S.now;
  for (let i = 0; i < 1800 && !S.done && max(S.x1 - S.x0, S.y1 - S.y0) < OPEN * S.vs; i++) advance(S, 1 / 30);
}

// n steps of the simple random walk, until the path comes within two sites
// of the lattice's edge.
function walk(S, n) {
  const { vis, lastT, hits } = S, now = S.now;
  let { x, y, x0, x1, y0, y1 } = S;
  for (let i = 0; i < n; i++) {
    const r = (random() * 4) | 0;
    if (r === 0) x++;
    else if (r === 1) x--;
    else if (r === 2) y++;
    else y--;
    const p = y * NX + x;
    vis[p] = 1;
    lastT[p] = now;
    if (hits[p] < 255) hits[p]++;
    S.steps++;
    if (x < x0) x0 = x;
    else if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    else if (y > y1) y1 = y;
    if (x < 3 || x > NX - 4 || y < 3 || y > NY - 4) {
      S.done = true;
      break;
    }
  }
  Object.assign(S, { x, y, x0, x1, y0, y1 });
}

// The unbounded component of the complement: a 4-connected flood from the
// border of the path's box, one site wider than the path all round. A visited
// site with an outside site next to it is on the frontier. The outside only
// shrinks as the path grows, so a site that leaves the frontier never comes
// back to it. Every RING seconds the frontier is stamped into ring, so the
// sites of each past frontier remember when it was there.
function frontier(S) {
  const { vis, ext, front, ring, stack } = S;
  const x0 = S.x0 - 1, x1 = S.x1 + 1, y0 = S.y0 - 1, y1 = S.y1 + 1;
  for (let y = y0; y <= y1; y++) ext.fill(0, y * NX + x0, y * NX + x1 + 1);
  // A guard ring just outside the box, marked so the flood stops at it.
  ext.fill(1, (y0 - 1) * NX + x0 - 1, (y0 - 1) * NX + x1 + 2);
  ext.fill(1, (y1 + 1) * NX + x0 - 1, (y1 + 1) * NX + x1 + 2);
  for (let y = y0; y <= y1; y++) ext[y * NX + x0 - 1] = ext[y * NX + x1 + 1] = 1;
  let sp = 0;
  for (let x = x0; x <= x1; x++) {
    ext[y0 * NX + x] = ext[y1 * NX + x] = 1;
    stack[sp++] = y0 * NX + x;
    stack[sp++] = y1 * NX + x;
  }
  for (let y = y0 + 1; y < y1; y++) {
    ext[y * NX + x0] = ext[y * NX + x1] = 1;
    stack[sp++] = y * NX + x0;
    stack[sp++] = y * NX + x1;
  }
  while (sp) {
    const p = stack[--sp];
    let q = p - 1;
    if (!vis[q] && !ext[q]) (ext[q] = 1), (stack[sp++] = q);
    q = p + 1;
    if (!vis[q] && !ext[q]) (ext[q] = 1), (stack[sp++] = q);
    q = p - NX;
    if (!vis[q] && !ext[q]) (ext[q] = 1), (stack[sp++] = q);
    q = p + NX;
    if (!vis[q] && !ext[q]) (ext[q] = 1), (stack[sp++] = q);
  }
  let F = 0, V = 0;
  const stamp = S.now >= S.snap;
  if (stamp) S.snap += RING;
  for (let y = y0 + 1; y < y1; y++)
    for (let p = y * NX + x0 + 1, e = y * NX + x1; p < e; p++) {
      if (!vis[p]) continue;
      V++;
      const f = ext[p - 1] | ext[p + 1] | ext[p - NX] | ext[p + NX];
      if (f) {
        F++;
        if (stamp) ring[p] = S.now;
      }
      front[p] = f;
    }
  S.F = F;
  S.V = V;
}

// One frame of w seconds (at Speed 2): the walk, the frontier, the view.
function advance(S, w) {
  S.now += w;
  if (!S.done) {
    S.acc += RATE * w * S.vs * S.vs;
    const n = floor(S.acc);
    S.acc -= n;
    walk(S, n);
  }
  frontier(S);
  frame(S, w);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.trail = 0.7 * 40 ** cl(k[0], 0, 1);
  const speed = cl(k[1], 0.2, 3), fine = cl(k[2], 1, 3);
  S.rings = 0.6 * 25 ** cl(k[3], 0, 1);
  // Above 0.06 the scribble and the pockets also dim, to 0.1 at 1, so the
  // rings show as lines on black.
  S.dim = 1 - (0.9 * max(0, cl(k[3], 0, 1) - 0.06)) / 0.94;
  const w = (d * speed) / 2;
  // A new Fine starts a new path once the knob has rested a quarter second.
  let fresh = S.fine < 0 || (input.btnPressed && input.btnPressed[0]);
  if (!fresh && abs(fine - S.fine) > 0.02) {
    if (fine !== S.kf) (S.kf = fine), (S.wait = 0.25);
    else fresh = (S.wait -= d) <= 0;
  }
  if (fresh) {
    const keep = S.fine > 0;
    S.fine = fine;
    restart(S, keep);
  }
  S.ghostT += w;
  if (S.done && (S.holdT += w) > HOLD) restart(S, true);
  else advance(S, w);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.fine < 0) return;
  const { vis, ext, front, lastT, ring, hits, mapX, mapY, cntX, cntY, cV, cL, cH, aF, aT, aR, rgb, ghost } = S;
  // Which LED each lattice column and row falls in.
  const s = S.vs;
  cntX.fill(0);
  cntY.fill(0);
  for (let i = 0; i < NX; i++) {
    const lx = floor((i + 0.5 - S.vx) / s + W / 2);
    mapX[i] = lx >= 0 && lx < W ? lx : -1;
    if (mapX[i] >= 0) cntX[lx]++;
  }
  for (let j = 0; j < NY; j++) {
    const ly = floor((j + 0.5 - S.vy) / s + H / 2);
    mapY[j] = ly >= 0 && ly < H ? ly : -1;
    if (mapY[j] >= 0) cntY[ly]++;
  }
  cV.fill(0);
  cL.fill(0);
  cH.fill(0);
  aF.fill(0);
  aT.fill(0);
  aR.fill(0);
  const now = S.now, it = 1 / S.trail, ir = 1 / S.rings, dim = S.dim;
  for (let y = S.y0; y <= S.y1; y++) {
    const ly = mapY[y];
    if (ly < 0) continue;
    const row = ly * W;
    for (let x = S.x0, p = y * NX + x; x <= S.x1; x++, p++) {
      const lx = mapX[x];
      if (lx < 0) continue;
      const q = row + lx;
      if (vis[p]) {
        cV[q]++;
        cH[q] += hits[p];
        const t = exp((lastT[p] - now) * it);
        if (t > aT[q]) aT[q] = t;
        if (front[p]) aF[q] = 1;
        else {
          const e = exp((ring[p] - now) * ir);
          if (e > aR[q]) aR[q] = e;
        }
      } else if (!ext[p]) cL[q]++;
    }
  }
  const hx = mapX[S.x], hy = mapY[S.y], head = !S.done && hx >= 0 && hy >= 0 ? hy * W + hx : -1;
  const gk = S.ghostT < GHOST ? 1 - S.ghostT / GHOST : 0, g2 = gk * gk;
  for (let ly = 0, q = 0; ly < H; ly++)
    for (let lx = 0; lx < W; lx++, q++) {
      const tot = cntX[lx] * cntY[ly] || 1, v = cV[q] / tot, l = cL[q] / tot;
      const ld = l * dim;
      let r = LAKE[0] * ld, g = LAKE[1] * ld, b = LAKE[2] * ld;
      if (v > 0) {
        // How often the walk stood here: its local time, on a log scale.
        // Sparse scribble in a coarse LED is lifted so it does not vanish.
        const m = cl(log(cH[q] / cV[q]) / log(40), 0, 1), vv = (0.4 + 0.6 * sqrt(v)) * dim;
        r += (VIS0[0] + (VIS1[0] - VIS0[0]) * m) * vv;
        g += (VIS0[1] + (VIS1[1] - VIS0[1]) * m) * vv;
        b += (VIS0[2] + (VIS1[2] - VIS0[2]) * m) * vv;
      }
      const t = aT[q] * (0.3 + 0.7 * sqrt(v));
      if (t > 0.004) {
        const a = min(1, t * 1.1);
        r += (TRAIL[0] - r) * a;
        g += (TRAIL[1] - g) * a;
        b += (TRAIL[2] - b) * a;
      }
      const e = aR[q];
      if (e > 0.004) {
        // A fresh ring is orange; it turns rose and dims as it ages.
        const a = min(1, e * 1.5), o = 1 - e;
        r += (RINGC[0] - 40 * o - r) * a;
        g += (RINGC[1] - 80 * o - g) * a;
        b += (RINGC[2] + 70 * o - b) * a;
      }
      if (aF[q]) {
        r = FRONT[0];
        g = FRONT[1];
        b = FRONT[2];
      }
      if (q === head) r = g = b = 255;
      const o = q * 3;
      rgb[o] = r;
      rgb[o + 1] = g;
      rgb[o + 2] = b;
      if (g2 > 0) {
        r = max(r, ghost[o] * g2);
        g = max(g, ghost[o + 1] * g2);
        b = max(b, ghost[o + 2] * g2);
      }
      display.setPixel(lx, ly, round(min(255, r)), round(min(255, g)), round(min(255, b)));
    }
}
