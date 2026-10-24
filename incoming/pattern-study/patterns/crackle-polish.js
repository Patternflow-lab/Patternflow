// ===== Patternflow pattern =====
// Title:   Crackle Polish
// Family:  cosmetic
// Idea:    A glossy colour fills the panel, a dark top coat is brushed over it from the top down, and as the coat dries it splits, first in long cracks across the panel and then in shorter and shorter cracks that each start on an older one at a right angle, while the gaps widen and the islands of coat shrink into rounded beads with a gloss on their edges and the colour glowing up through the network, until a fresh coat goes on.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 39, after crackle nail polish, a top coat that shrinks as it dries, and the hierarchical crack patterns that form by successive division of domains (Steffen Bohn, Ludovic Pauchard and Yves Couder, 2005)
// Round:   39
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Craze=0..1, Coat=0..1
//
// Knob 1: Hue. Turns the base colour round the whole wheel: at 0 hot pink, 0.1 red, 0.15 orange, 0.22 yellow, 0.3 lime, 0.4 green, 0.55 aqua, 0.65 azure, 0.75 blue, 0.85 violet, 0.95 magenta. Orange and yellow bases are paled a little, lit to full and shaded less beside the islands, so no gap turns brown.
// Knob 2: Speed. At 2 the coat goes on in 1.2 s, the first crack opens 0.6 s later and runs across the panel in about a second, the last starts about 4.5 s after the first, and when the gaps have finished widening the crackle holds until a new coat goes on, about 11 s after the last. At 0.2 all of it ten times slower, at 3 one and a half times faster.
// Knob 3: Craze. How far the coat keeps splitting. At 0 a domain stops splitting once it is under about 20 LEDs long, which leaves about 50 islands, most of them 9 to 18 LEDs across; at 1 under about 11, about 155 islands of 5 to 10, and the gaps open half as wide.
// Knob 4: Coat. The colour of the top coat: black lacquer at 0, a deep jewel tone opposite the base on the wheel at 0.5, a pale pearl at 1. On the dark coats the gloss is a white rim on the edges facing the light; on the pearl the edges turned away fall into a cool grey-lilac shade, as a pearl pigment shifts with the angle.
// Buttons: K1 tap brushes a fresh coat on now.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, exp, sin, cos, log, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
// The cycle, in seconds at Speed 2: the brush crosses the panel in LAY, the
// first crack opens at T1 and the last near T2, and a new coat comes HOLD
// after the last. The run opens at START, with the first crack running.
const LAY = 1.2, T1 = 1.8, T2 = 6, HOLD = 5, START = 2.4;
// Crack tips run at VTIP LEDs a second; a gap opens with time constant TAU.
const VTIP = 70, TAU = 1.3;
// Towards the light, x right and y down: up and to the left.
const LX = -0.6, LY = -0.8;
// Opening hue: hot pink.
const H0 = 0.93;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// The domains are worked out on a grid of half-LED cells: each cell holds
// the domain it belongs to, or -1 on a crack.
const FW = 2 * W, FH = 2 * H;
// A crack tip moves STEP LEDs at a time, and within BEND LEDs of an older
// crack it turns to meet it square.
const STEP = 0.25, BEND = 3;
// Gap pixels are listed out to REACH LEDs from a crack's line.
const REACH = 7;

// The whole crackle of one coat, worked out when it goes on. The panel is
// one domain. A domain splits across its long axis: a crack starts on its
// rim, square to the older crack it leaves, runs across, and turns to meet
// the crack on the far side square. Each half splits the same way until it
// is too short; bigger domains crack sooner.
function crackle(craze) {
  const stop = 20 - 9 * craze, span = log((W * H) / (0.45 * stop * stop));
  const lab = new Int32Array(FW * FH), cracks = [];
  const wall = (x, y) => {
    const i = floor(2 * x), j = floor(2 * y);
    return i < 0 || j < 0 || i >= FW || j >= FH || lab[j * FW + i] < 0;
  };
  let ids = 1;
  const todo = [{ id: 0, b: [0, 0, FW - 1, FH - 1], ready: 0 }];
  while (todo.length) {
    const d = todo.pop(), [i0, j0, i1, j1] = d.b;
    let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    const nb = [FW, FH, 0, 0];
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++)
        if (lab[j * FW + i] === d.id) {
          const x = (i + 0.5) / 2, y = (j + 0.5) / 2;
          n++;
          sx += x;
          sy += y;
          sxx += x * x;
          syy += y * y;
          sxy += x * y;
          nb[0] = min(nb[0], i);
          nb[1] = min(nb[1], j);
          nb[2] = max(nb[2], i);
          nb[3] = max(nb[3], j);
        }
    if (n < 8) continue;
    const mx = sx / n, my = sy / n, vxx = sxx / n - mx * mx, vyy = syy / n - my * my, vxy = sxy / n - mx * my;
    const ang = 0.5 * Math.atan2(2 * vxy, vxx - vyy);
    // A bar of length L has variance L^2 / 12 along its axis.
    const long = sqrt(12 * (vxx * cos(ang) ** 2 + 2 * vxy * cos(ang) * sin(ang) + vyy * sin(ang) ** 2));
    // The cut is turned up to 20 degrees off square; its ends bend square anyway.
    const tu = ang + (random() - 0.5) * 0.7, ux = cos(tu), uy = sin(tu);
    if (long < stop * (0.85 + 0.3 * random())) continue;
    // Where the cut line, across the long axis near the middle, meets the rim.
    const off = (random() - 0.5) * 0.36 * long, cx = mx + ux * off, cy = my + uy * off;
    if (wall(cx, cy)) continue;
    const ends = [-1, 1].map((sg) => {
      let x = cx, y = cy;
      while (!wall(x - sg * uy * STEP, y + sg * ux * STEP)) {
        x -= sg * uy * STEP;
        y += sg * ux * STEP;
      }
      return [x, y, sg];
    });
    const [sx0, sy0, sg] = ends[random() < 0.5 ? 0 : 1];
    // Heading: across, toward the other end; it starts square off its rim.
    const hx = sg * uy, hy = -sg * ux;
    let x = sx0, y = sy0, dx = hx, dy = hy, run = 0, ok = false;
    const pts = [[x, y]], cells = [];
    for (let k = 0; k < (4 * long) / STEP; k++) {
      // The nearest older crack (or the panel's edge) within BEND, and the
      // way square off it, from all its cells nearby.
      let best = BEND * BEND, gx = 0, gy = 0;
      const ci = floor(2 * x), cj = floor(2 * y), r = 2 * BEND;
      for (let j = cj - r; j <= cj + r; j++)
        for (let i = ci - r; i <= ci + r; i++) {
          if (i >= 0 && j >= 0 && i < FW && j < FH && lab[j * FW + i] >= 0) continue;
          const ex = x - (cl(i, -1, FW) + 0.5) / 2, ey = y - (cl(j, -1, FH) + 0.5) / 2, e2 = ex * ex + ey * ey;
          best = min(best, e2);
          if (e2 < 4) {
            const wt = exp(-e2);
            gx += ex * wt;
            gy += ey * wt;
          }
        }
      const dist = sqrt(best), gl = sqrt(gx * gx + gy * gy);
      let calm = 1;
      if (best < BEND * BEND && gl > 0) {
        gx /= gl;
        gy /= gl;
        // Leaving its own rim: square off it. Coming up on another: turn square into it.
        const into = run < 1.2 ? -0.5 : dx * gx + dy * gy < 0 ? 0.6 * (1 - dist / BEND) : 0;
        if (into) {
          dx -= into * gx;
          dy -= into * gy;
          calm = dist / BEND;
        }
      }
      const tw = (random() - 0.5) * 0.22 * calm;
      dx += 0.05 * hx * calm - tw * dy;
      dy += 0.05 * hy * calm + tw * dx;
      const dl = sqrt(dx * dx + dy * dy);
      dx /= dl;
      dy /= dl;
      x += dx * STEP;
      y += dy * STEP;
      run += STEP;
      const ci2 = floor(2 * x), cj2 = floor(2 * y), last = cells[cells.length - 1];
      // Cells of the crack, joined edge to edge so nothing leaks past it.
      if (last && last[0] !== ci2 && last[1] !== cj2) cells.push([ci2, last[1]]);
      if (!last || last[0] !== ci2 || last[1] !== cj2) cells.push([ci2, cj2]);
      if (wall(x, y)) {
        pts.push([x, y]);
        ok = run > 2;
        break;
      }
      if (k % 4 === 3) pts.push([x, y]);
    }
    if (!ok) continue;
    for (const [i, j] of cells) if (i >= 0 && j >= 0 && i < FW && j < FH && lab[j * FW + i] === d.id) lab[j * FW + i] = -1;
    // Fill one side with a new domain.
    const m = pts[pts.length >> 1], q = pts[(pts.length >> 1) + 1] || pts[pts.length - 1];
    const tx = q[0] - m[0], ty = q[1] - m[1], tl = Math.hypot(tx, ty) || 1;
    const si = floor(2 * (m[0] - (ty / tl) * 0.8)), sj = floor(2 * (m[1] + (tx / tl) * 0.8));
    if (si < 0 || sj < 0 || si >= FW || sj >= FH || lab[sj * FW + si] !== d.id) continue;
    const nid = ids++, stack = [sj * FW + si];
    lab[sj * FW + si] = nid;
    while (stack.length) {
      const c = stack.pop(), i = c % FW, j = (c - i) / FW;
      for (const e of [i > 0 ? c - 1 : -1, i < FW - 1 ? c + 1 : -1, j > 0 ? c - FW : -1, j < FH - 1 ? c + FW : -1])
        if (e >= 0 && lab[e] === d.id) {
          lab[e] = nid;
          stack.push(e);
        }
    }
    let len = 0;
    for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    const age = cl(log((W * H) / (n / 4)) / span, 0, 1), t = max(d.ready + 0.06, T1 + (T2 - T1) * age);
    // Final half-width: the first cracks open widest.
    cracks.push({ pts, len, t, w: 1.5 - 0.85 * age });
    const ready = t + len / VTIP;
    todo.push({ id: d.id, b: nb, ready }, { id: nid, b: nb, ready });
  }
  return gapLists(cracks);
}

// For each crack, every pixel within REACH of its line: how far from it,
// and how far along the crack the nearest point lies.
function gapLists(cracks) {
  const dist = new Float32Array(N), along = new Float32Array(N), seen = new Int32Array(N).fill(-1);
  cracks.forEach((c, ci) => {
    const idx = [];
    let u0 = 0;
    for (let k = 1; k < c.pts.length; k++) {
      const [ax, ay] = c.pts[k - 1], [bx, by] = c.pts[k], ex = bx - ax, ey = by - ay, el = sqrt(ex * ex + ey * ey) || 1e-6;
      for (let y = max(0, floor(min(ay, by) - REACH)); y <= min(H - 1, floor(max(ay, by) + REACH)); y++)
        for (let x = max(0, floor(min(ax, bx) - REACH)); x <= min(W - 1, floor(max(ax, bx) + REACH)); x++) {
          const px = x + 0.5 - ax, py = y + 0.5 - ay, f = cl((px * ex + py * ey) / (el * el), 0, 1);
          const qx = px - f * ex, qy = py - f * ey, dd = sqrt(qx * qx + qy * qy), p = y * W + x;
          if (dd > REACH) continue;
          if (seen[p] !== ci) {
            seen[p] = ci;
            idx.push(p);
            dist[p] = 1e9;
          }
          if (dd < dist[p]) {
            dist[p] = dd;
            along[p] = u0 + f * el;
          }
        }
      u0 += el;
    }
    c.idx = Int32Array.from(idx);
    c.d = Float32Array.from(idx, (p) => dist[p]);
    c.u = Float32Array.from(idx, (p) => along[p]);
    c.pts = null;
  });
  return cracks;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, craze: 0, coat: 0.06, begun: false, t: START, end: 0, cracks: [], old: null, brush: new Float32Array(W),
    G: new Float32Array(N),
    base: [0, 0, 0], ink: [0, 0, 0], a: [0, 0, 0], b: [0, 0, 0], cool: [0, 0, 0],
  };
}

function newCoat(S, t0) {
  S.old = S.cracks;
  // The brush's bristles: a mark per column, softened.
  let m = random();
  for (let x = 0; x < W; x++) S.brush[x] = 0.07 * (m = 0.55 * m + 0.45 * random());
  S.cracks = crackle(S.craze);
  let last = 0;
  for (const c of S.cracks) last = max(last, c.t);
  S.end = last + HOLD;
  S.t = t0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.craze = cl(k[2], 0, 1);
  S.coat = cl(k[3], 0, 1);
  if (!S.begun) {
    newCoat(S, START);
    S.old = null;
    S.begun = true;
  }
  S.t += (cl(dt || 0, 0, 0.1) * S.speed) / 2;
  if (S.t > S.end || (input.btnPressed && input.btnPressed[0])) newCoat(S, 0);
}

// Polynomial smooth minimum: where two gaps come within k of each other
// they merge in a fillet, which rounds the island's corner between them.
function smin(a, b, k) {
  const h = max(k - abs(a - b), 0) / k;
  return min(a, b) - h * h * k * 0.25;
}

// G: signed distance to the open gaps, in LEDs, positive on the coat. Each
// crack is a gap round its line as far as its tip, its half-width growing
// from a hairline as it opens, and the corners it makes with older cracks
// rounding as the coat dries.
function field(S, list, t) {
  const G = S.G;
  G.fill(9);
  const narrow = 1 - 0.5 * S.craze;
  for (const c of list) {
    const age = t - c.t;
    if (age <= 0) continue;
    const reach = min(c.len, age * VTIP), open = 1 - exp(-age / TAU), run = reach < c.len;
    const hw = 0.42 + (c.w * narrow - 0.42) * open, k = (0.5 + 2.3 * open) * narrow, { idx, d, u } = c;
    for (let e = 0; e < idx.length; e++) {
      const over = u[e] - reach;
      if (over > REACH) continue;
      const dd = over > 0 ? sqrt(d[e] * d[e] + over * over) : d[e];
      // A running tip is sharp.
      const tip = run ? min(1, 0.35 + max(0, -over) / 5) : 1;
      G[idx[e]] = smin(G[idx[e]], dd - hw * tip, k);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const t = S.t, h = S.hue + H0, hh = h - floor(h), cz = S.coat;
  // While the brush is on its way down, the old crackle shows below it.
  const laying = t < LAY && S.old, front = -6 + ((H + 12) * t) / LAY;
  field(S, laying ? S.old : S.cracks, laying ? 1e9 : t);
  const G = S.G, { base, ink, a, b } = S;
  // Orange and yellow bases go brown at the dim edge of a gap: paled a
  // little and lit to full.
  const warm = cl(1.5 - abs(hh - 0.13) / 0.07, 0, 1);
  hsv(h, 0.82 - 0.2 * warm, 0.9 + 0.1 * warm, base);
  // The coat: black lacquer, a jewel tone opposite the base, pearl.
  const hc = h + 0.5, wc = cl(1.5 - abs(hc - floor(hc) - 0.13) / 0.07, 0, 1);
  if (cz < 0.5) {
    hsv(hc, 0.5, 0.05, a);
    hsv(hc, 0.72 - 0.2 * wc, 0.5 + 0.3 * wc, b);
  } else {
    hsv(hc, 0.72 - 0.2 * wc, 0.5 + 0.3 * wc, a);
    hsv(h + 0.04, 0.12, 0.9, b);
  }
  const f = sm(0, 1, cz < 0.5 ? cz * 2 : cz * 2 - 1);
  for (let c = 0; c < 3; c++) ink[c] = a[c] + (b[c] - a[c]) * f;
  const pearl = sm(0.5, 1, cz), dark = 1 - sm(0, 0.6, cz), cool = S.cool;
  hsv(h + 0.55, 0.28, 0.72, cool);
  // A strip light reflected in the gloss, sliding down the panel once a
  // coat, starting as the brush leaves it.
  const sheen = (((t - LAY) * 24 + 280) % 280) - 5;
  // The fresh coat is wet: a stronger reflection, brush marks running down
  // it and the base colour faintly through it, all gone a second after it is on.
  const dry = laying ? 0 : exp(-(t - LAY) / 0.9);
  // Above the brush's front the coat is fresh and whole.
  const at = (x, y) => {
    const v = G[cl(y, 0, H - 1) * W + cl(x, 0, W - 1)];
    return laying ? max(v, (front - y) * 3) : v;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = at(x, y);
      const gx = min(at(x + 1, y), 3) - min(at(x - 1, y), 3), gy = min(at(x, y + 1), 3) - min(at(x, y - 1), 3);
      const gl = sqrt(gx * gx + gy * gy) + 1e-6, face = -(gx * LX + gy * LY) / gl;
      const band = exp(-(((x * 0.5 + y - sheen) / 13) ** 2));
      // The base through the gaps, in the shade of the island on its lit side.
      const shade = 1 - (0.45 - 0.3 * warm) * sm(-0.5, 0.8, at(x - 1, y - 2));
      const bl = 0.3 * band;
      let r = (base[0] + (1 - base[0]) * bl) * shade, g = (base[1] + (1 - base[1]) * bl) * shade, bb = (base[2] + (1 - base[2]) * bl) * shade;
      // The island: how far inside its edge, as the height of a bead. Its
      // cover falls off as a square root at the edge, so the base glows up
      // through a hairline crack near full instead of as a dim line.
      const cov = 1 - (1 - sm(-0.55, 0.55, v)) ** 0.5, hgt = cl(v / 2.5, 0, 1);
      if (cov > 0) {
        const edge = 1 - sm(0.15, 0.75, hgt), lit = max(0, face) * edge, away = max(0, -face) * edge;
        // Dark coats: a white gloss on the lit rim and the strip light on
        // the top.
        const wet = laying ? 1 - sm(front - 2, front, y) : dry;
        const brush = wet * S.brush[x] * (0.8 + 0.2 * sin(y * 0.09 + x));
        const gloss = (dark * 0.75 + 0.35 * (1 - dark)) * lit * lit + (0.12 + 0.18 * dark + 0.3 * wet) * band * sm(0.3, 0.9, hgt) + brush;
        const tint = 0.14 * wet * dark;
        // Pearl shifts toward a cool interference tint on the rim turned away.
        const dim = 1 - 0.3 * pearl * away - 0.08 * pearl * (1 - hgt), sh = 0.6 * pearl * away;
        const ir = (ink[0] + (cool[0] - ink[0]) * sh) * dim + (1 - ink[0]) * gloss + base[0] * tint;
        const ig = (ink[1] + (cool[1] - ink[1]) * sh) * dim + (1 - ink[1]) * gloss + base[1] * tint;
        const ib = (ink[2] + (cool[2] - ink[2]) * sh) * dim + (1 - ink[2]) * gloss + base[2] * tint;
        r += (ir - r) * cov;
        g += (ig - g) * cov;
        bb += (ib - bb) * cov;
      }
      if (laying) {
        // The wet bead along the brush's edge.
        const bead = 0.55 * exp(-(((y - front - 0.6 * sin(x * 0.4 + t * 3)) / 1.1) ** 2));
        r += (1 - r) * bead;
        g += (1 - g) * bead;
        bb += (1 - bb) * bead;
      }
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, bb)));
    }
}
