// ===== Patternflow pattern =====
// Title:   Grassfire
// Family:  type
// Idea:    A big bold letter is lit all along its outline and the fire burns inward at one speed, painting the letter in bands of burn time, until the fronts meet and leave a bright skeleton whose brightness follows the local radius, then discs as wide as the skeleton's radius roll along it and redraw the letter from circles before it fades and the next letter lights.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: grassfire transform and medial axis (Harry Blum, A transformation for extracting new descriptors of shape, 1967, from memory), exact Euclidean distance transform in two passes (Pedro Felzenszwalb and Daniel Huttenlocher, 2004, from memory), skeleton taken where the nearest outline points of neighbouring cells are far apart; the seven letters are drawn here as strokes thickened into capsules, no font table copied, and Hangul has no font source in this repository so the jamo is drawn as two bars over a ring; pattern round 113
// Round:   113
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Glyph=1..7, Fire=0..1
//
// Knob 1: Hue. Turns the heat ramp round the wheel. At 0 the outline burns gold and the bands darken inward through red and magenta to blue at 10 LEDs deep, 2 LEDs a band, each a little darker toward its inner edge; the front and the skeleton are near white, the letter the discs redraw is cream with blue circles on it. At 0.5 the outline is blue, the bands go through teal and green, and the deep core is orange. The bare letter before the fire reaches it stays dark navy at any hue.
// Knob 2: Speed. The fire burns 3.2 LEDs a second at 2, so a band of 2 LEDs takes 0.6 s. The R is lit for 0.35 s, burns its deepest 13 LEDs in 4.1 s, shows the bare skeleton for 0.7 s, rolls discs along it for 4.2 s, holds the letter drawn from circles for 2 s and fades over 0.7 s, 12.1 s in all; the seven letters take 80 s. 0.2 is ten times slower and 3 is half as fast again.
// Knob 3: Glyph. Which letter to start from, snapping at whole numbers: 1 R (where it opens), 2 S, 3 K, 4 g, 5 8, 6 the Hangul consonant ㅎ (two bars over a ring) and 7 a plain bar I of 20 by 108 LEDs; the next one lights when a letter is done. The longest burn, in LEDs, is 13.0 for R, 9.1 for S, 14.7 for K, 11.7 for g, 10.3 for 8, 7.6 for ㅎ and 10.0 for the bar, always where strokes meet or the stroke is thickest.
// Knob 4: Fire. A hand on the fire. Below 0.1, where it opens at 0.06, the fire runs by itself. From 0.1 to 1 it is a timeline you hold: the front stands at the depth the knob says, and for the R the fire has burned out at 0.51 and the discs start rolling at 0.58, up to the letter drawn from 19 circles at 1. Let go and the fire runs on from where you left it.

const W = 64, H = 128, SS = 4, HW = W * SS, HH = H * SS;
const { floor, min, max, abs, sqrt, sin, cos, exp, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// Strokes: a segment thickened into a capsule (round ends) or a plain bar (square ends), in LEDs, y down.
const seg = (x1, y1, x2, y2, w, rnd = true) => ({ x1, y1, x2, y2, w, rnd });
function arc(cx, cy, rx, ry, a0, a1, w) {
  const n = max(2, Math.ceil(abs(a1 - a0) / 1.5)), out = [];
  let px = cx + rx * cos((a0 * PI) / 180), py = cy + ry * sin((a0 * PI) / 180);
  for (let i = 1; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * PI) / 180, x = cx + rx * cos(a), y = cy + ry * sin(a);
    out.push(seg(px, py, x, y, w));
    px = x;
    py = y;
  }
  return out;
}
const GLYPHS = [
  { name: "R", strokes: [seg(16, 19, 16, 109, 18), seg(16, 19, 38, 19, 18), ...arc(38, 38, 11, 19, -90, 90, 18), seg(38, 57, 16, 57, 18), seg(31, 62, 49, 109, 18)] },
  { name: "S", strokes: [...arc(32, 41, 17, 22, -30, -270, 18), ...arc(32, 85, 17, 22, -90, 150, 18)] },
  { name: "K", strokes: [seg(16, 19, 16, 109, 18), seg(20, 68, 47, 19, 17), seg(26, 57, 48, 109, 17)] },
  { name: "g", strokes: [...arc(27, 46, 17, 20, 0, 360, 17), seg(44, 26, 44, 86, 17), ...arc(30, 86, 14, 18, 0, 150, 17)] },
  { name: "8", strokes: [...arc(32, 38, 14, 18, 0, 360, 17), ...arc(32, 83, 17, 27, 0, 360, 17)] },
  { name: "ㅎ", strokes: [seg(24, 18, 40, 18, 14), seg(10, 41, 54, 41, 14), ...arc(32, 86, 20, 20, 0, 360, 15)] },
  { name: "I", strokes: [seg(32, 10, 32, 118, 20, false)] },
];

// Fire and timeline, in seconds at Speed 2.
const V = 3.2, BW = 2, T_IN = 0.35, T_H1 = 0.7, T_R = 4.2, T_H2 = 2, T_F = 0.7;
// The skeleton is where the nearest outline cells of two neighbouring cells are more than SEP cells apart, or more than 0.6 of
// the distance to them, which keeps the hairs a jagged outline throws off from joining it.
const SEP = 6;

// The letter as a bitmap SS times finer than the panel, each cell lit if its centre is inside a stroke.
function raster(strokes) {
  const ins = new Uint8Array(HW * HH);
  for (const s of strokes) {
    const h = s.w / 2, dx = s.x2 - s.x1, dy = s.y2 - s.y1, len2 = dx * dx + dy * dy || 1;
    const x0 = max(0, floor((min(s.x1, s.x2) - h) * SS) - 1), x1 = min(HW - 1, Math.ceil((max(s.x1, s.x2) + h) * SS) + 1);
    const y0 = max(0, floor((min(s.y1, s.y2) - h) * SS) - 1), y1 = min(HH - 1, Math.ceil((max(s.y1, s.y2) + h) * SS) + 1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = (x + 0.5) / SS - s.x1, py = (y + 0.5) / SS - s.y1;
        let t = (px * dx + py * dy) / len2;
        if (s.rnd) t = cl(t, 0, 1);
        else if (t < 0 || t > 1) continue;
        const ex = px - t * dx, ey = py - t * dy;
        if (ex * ex + ey * ey <= h * h) ins[y * HW + x] = 1;
      }
  }
  return ins;
}

// Felzenszwalb and Huttenlocher's distance transform: for every cell, the squared distance to the nearest cell outside the
// letter and which cell that is. One pass down the columns, one along the rows.
function edt(ins) {
  const g = new Float64Array(HW * HH), gy = new Int32Array(HW * HH), d2 = new Float64Array(HW * HH), near = new Int32Array(HW * HH);
  for (let x = 0; x < HW; x++) {
    let last = -1e9;
    for (let y = 0; y < HH; y++) {
      if (!ins[y * HW + x]) last = y;
      g[y * HW + x] = (y - last) * (y - last);
      gy[y * HW + x] = last;
    }
    let next = 1e9;
    for (let y = HH - 1; y >= 0; y--) {
      if (!ins[y * HW + x]) next = y;
      const dn = (next - y) * (next - y);
      if (dn < g[y * HW + x]) (g[y * HW + x] = dn), (gy[y * HW + x] = next);
    }
  }
  const v = new Int32Array(HW), z = new Float64Array(HW + 1), f = new Float64Array(HW);
  for (let y = 0; y < HH; y++) {
    const row = y * HW;
    for (let x = 0; x < HW; x++) f[x] = g[row + x];
    let k = 0;
    v[0] = 0;
    z[0] = -Infinity;
    z[1] = Infinity;
    for (let q = 1; q < HW; q++) {
      let s;
      for (;;) {
        const p = v[k];
        s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
        if (s <= z[k] && k > 0) k--;
        else break;
      }
      if (s <= z[k]) k = 0;
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < HW; q++) {
      while (z[k + 1] < q) k++;
      const p = v[k];
      d2[row + q] = (q - p) * (q - p) + f[p];
      near[row + q] = gy[row + p] * HW + p;
    }
  }
  return { d2, near };
}

// Everything the picture needs about one letter, built once.
function build(gi) {
  const ins = raster(GLYPHS[gi].strokes), { d2, near } = edt(ins);
  const cells = [];
  for (let i = 0; i < HW * HH; i++) if (ins[i]) cells.push(i);
  const nc = cells.length, D = new Float32Array(HW * HH);
  let dmax = 0;
  for (let n = 0; n < nc; n++) {
    const i = cells[n];
    D[i] = sqrt(d2[i]) / SS;
    if (D[i] > dmax) dmax = D[i];
  }
  // Ridge cells: where two neighbours' nearest outline cells are far apart, the one deeper in is on the skeleton.
  const ridge = new Uint8Array(HW * HH);
  const nb = [1, HW, HW + 1, HW - 1];
  for (let n = 0; n < nc; n++) {
    const i = cells[n], fx = near[i] % HW, fy = (near[i] / HW) | 0;
    for (const o of nb) {
      const j = i + o;
      if (j >= HW * HH || !ins[j]) continue;
      const gx = near[j] % HW - fx, gyy = ((near[j] / HW) | 0) - fy;
      const thr = max(SEP, 0.6 * sqrt(d2[i]));
      if (gx * gx + gyy * gyy > thr * thr) ridge[D[i] >= D[j] ? i : j] = 1;
    }
  }
  const sk = [];
  for (let n = 0; n < nc; n++) if (ridge[cells[n]]) sk.push(cells[n]);
  // Nodes for the roll: one ridge cell, the deepest, for each half-LED block.
  const blocks = new Map();
  for (const i of sk) {
    const key = ((i >> 9) << 10) | ((i & (HW - 1)) >> 1);
    const cur = blocks.get(key);
    if (cur === undefined || D[i] > D[cur]) blocks.set(key, i);
  }
  const nodes = [];
  const grid = new Map();
  for (const [key, i] of blocks) {
    const bx = key & 1023, by = key >> 10;
    grid.set(by * 1024 + bx, nodes.length);
    nodes.push({ x: ((i & (HW - 1)) + 0.5) / SS, y: (((i / HW) | 0) + 0.5) / SS, r: D[i], bx, by, adj: [], g: Infinity, comp: -1, cell: i });
  }
  for (const nd of nodes)
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        if (!dx && !dy) continue;
        const o = grid.get((nd.by + dy) * 1024 + nd.bx + dx);
        if (o !== undefined) nd.adj.push(o);
      }
  // Components, then the thickest node of each is where its discs start, and the distance along the skeleton from there orders the roll.
  let nComp = 0;
  const roots = [];
  for (let s = 0; s < nodes.length; s++) {
    if (nodes[s].comp >= 0) continue;
    const stack = [s], members = [];
    nodes[s].comp = nComp;
    while (stack.length) {
      const a = stack.pop();
      members.push(a);
      for (const o of nodes[a].adj) if (nodes[o].comp < 0) (nodes[o].comp = nComp), stack.push(o);
    }
    let best = members[0];
    for (const m of members) if (nodes[m].r > nodes[best].r) best = m;
    roots.push({ node: best, size: members.length });
    nComp++;
  }
  const open = [];
  for (const r of roots) {
    if (r.size < 6) continue;
    nodes[r.node].g = 0;
    open.push(r.node);
  }
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (nodes[open[k]].g < nodes[open[bi]].g) bi = k;
    const a = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    for (const o of nodes[a].adj) {
      const gg = nodes[a].g + sqrt((nodes[a].x - nodes[o].x) ** 2 + (nodes[a].y - nodes[o].y) ** 2);
      if (gg < nodes[o].g - 1e-9) {
        if (nodes[o].g === Infinity) open.push(o);
        nodes[o].g = gg;
      }
    }
  }
  const live = nodes.filter((n) => n.g < Infinity);
  let gmax = 0;
  for (const n of live) gmax = max(gmax, n.g);
  // When each cell is first inside a rolling disc.
  const cover = new Float32Array(HW * HH).fill(1e9);
  for (const n of live) {
    const rc = n.r * SS + 1, cx = n.x * SS, cy = n.y * SS;
    for (let y = max(0, floor(cy - rc)); y <= min(HH - 1, Math.ceil(cy + rc)); y++)
      for (let x = max(0, floor(cx - rc)); x <= min(HW - 1, Math.ceil(cx + rc)); x++) {
        const i = y * HW + x;
        if (ins[i] && (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= rc * rc && n.g < cover[i]) cover[i] = n.g;
      }
  }
  let covered = 0;
  for (let n = 0; n < nc; n++) if (cover[cells[n]] < 1e9) covered++;
  // Cells no disc reached join the letter at the very end.
  for (let n = 0; n < nc; n++) if (cover[cells[n]] >= 1e9) cover[cells[n]] = gmax + 2.5;
  // The discs that stay drawn as circles once the rolling disc has gone by: each centre a little more than a radius from the last.
  const chain = [];
  for (const n of live.slice().sort((a, b) => a.g - b.g)) {
    if (n.r < 2) continue;
    if (chain.every((c) => (n.x - c.x) ** 2 + (n.y - c.y) ** 2 >= (1.15 * max(n.r, c.r)) ** 2)) chain.push(n);
  }
  const tB = (dmax * 1.03) / V;
  return {
    name: GLYPHS[gi].name, ins, D, cells: Uint32Array.from(cells), cover, dmax, gmax, live, chain, covered: covered / nc,
    sk: Uint32Array.from(sk), tB, tH1: T_H1, tR: T_R, total: T_IN + tB + T_H1 + T_R + T_H2 + T_F, area: nc / (SS * SS),
  };
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, pk: -1, gi: 0, P: 0, G: null, acc: new Float32Array(W * H * 3), sk: new Float32Array(W * H), cache: [] };
}
const glyph = (S, gi) => S.cache[gi] || (S.cache[gi] = build(gi));

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  const pk = cl(round(kv[2]), 1, GLYPHS.length) - 1;
  if (pk !== S.pk) {
    S.pk = pk;
    S.gi = pk;
    S.G = glyph(S, pk);
    S.P = 0;
  }
  const hand = cl(kv[3], 0, 1);
  if (hand >= 0.1) S.P = T_IN + ((hand - 0.1) / 0.9) * (S.G.tB + S.G.tH1 + S.G.tR);
  else {
    S.P += (d * S.speed) / 2;
    if (S.P >= S.G.total) {
      S.gi = (S.gi + 1) % GLYPHS.length;
      S.G = glyph(S, S.gi);
      S.P = 0;
    }
  }
}

// Blend colour over the LED sums at weight a.
function put(acc, x, y, r, g, b, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3, k = min(1, a);
  acc[o] += (r - acc[o]) * k;
  acc[o + 1] += (g - acc[o + 1]) * k;
  acc[o + 2] += (b - acc[o + 2]) * k;
}
function ring(acc, cx, cy, r, c, a) {
  for (let y = floor(cy - r - 1.5); y <= Math.ceil(cy + r + 1.5); y++)
    for (let x = floor(cx - r - 1.5); x <= Math.ceil(cx + r + 1.5); x++) {
      const dd = sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2);
      put(acc, x, y, c[0], c[1], c[2], a * cl(1.15 - abs(dd - r) * 1.1, 0, 1));
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.G) return;
  const G = S.G, P = S.P, acc = S.acc, sk = S.sk, { D, cells, cover } = G;
  acc.fill(0);
  sk.fill(0);

  // Where the fire stands and how far the discs have rolled.
  const tFire = P - T_IN, Fr = cl(tFire * V, 0, G.dmax * 1.03);
  const roll = cl((P - T_IN - G.tB - G.tH1) / G.tR, 0, 1), gT = roll * (G.gmax + 3) - 0.01;
  const fadeIn = sm(P / T_IN), fadeOut = P > G.total - T_F ? sm((G.total - P) / T_F) : 1;
  const alpha = fadeIn * fadeOut;

  // The heat ramp: a band of BW LEDs of burn time each, the outside first.
  const h0 = S.hue, band = [], t3 = [0, 0, 0];
  for (let b = 0; b < 8; b++) {
    const u = cl((b * BW + BW / 2) / 11, 0, 1);
    hsv(h0 + 0.14 - 0.5 * u, 0.5 + 0.5 * u, 1 - 0.45 * u, t3);
    band.push([t3[0], t3[1], t3[2]]);
  }
  const unburnt = hsv(0.64, 0.5, 0.21, [0, 0, 0]);
  const solid = hsv(h0 + 0.12, 0.3, 0.95, [0, 0, 0]), skC = hsv(h0 + 0.12, 0.1, 1, [0, 0, 0]);
  const hot = hsv(h0 + 0.14, 0.12, 1, [0, 0, 0]), chainC = hsv(h0 - 0.38, 0.85, 0.62, [0, 0, 0]);

  for (let n = 0; n < cells.length; n++) {
    const i = cells[n], d = D[i];
    let r, g, b;
    if (d <= Fr) {
      const bi = min(7, (d / BW) | 0), k = 1 - 0.32 * (d / BW - bi), c = band[bi];
      r = c[0] * k;
      g = c[1] * k;
      b = c[2] * k;
      const e = Fr - d;
      if (e < 0.8 && Fr < G.dmax * 1.02) {
        const w = (1 - e / 0.8) * 0.8;
        r += (hot[0] - r) * w;
        g += (hot[1] - g) * w;
        b += (hot[2] - b) * w;
      }
    } else (r = unburnt[0]), (g = unburnt[1]), (b = unburnt[2]);
    const cv = cover[i];
    if (cv <= gT) {
      const w = min(1, gT - cv + 0.2) * 0.96;
      r += (solid[0] - r) * w;
      g += (solid[1] - g) * w;
      b += (solid[2] - b) * w;
    }
    const o = ((((i / HW) | 0) >> 2) * W + ((i & (HW - 1)) >> 2)) * 3;
    acc[o] += r;
    acc[o + 1] += g;
    acc[o + 2] += b;
  }
  for (let o = 0; o < W * H * 3; o++) acc[o] *= 1 / (SS * SS);

  // The discs: a circle left every 4.5 LEDs, and the ones rolling now.
  for (const n of G.chain) if (n.g < gT - 0.6) ring(acc, n.x, n.y, n.r, chainC, 0.7);
  if (roll > 0 && roll < 1) for (const n of G.live) if (n.g <= gT && n.g > gT - 0.6) ring(acc, n.x, n.y, n.r, [1, 1, 1], 0.95);

  // The skeleton, lit where the fire has been and brightest where the letter is thick.
  const skA = sk;
  for (const i of G.sk) {
    const d = D[i];
    if (d > Fr) continue;
    const base = 0.4 + 0.6 * (d / G.dmax), flash = 0.7 * exp(-(Fr - d) / 1.1), a = min(1, base + flash) * sm((Fr - d) / 0.25 + 0.2);
    const cx = ((i & (HW - 1)) + 0.5) / SS, cy = (((i / HW) | 0) + 0.5) / SS;
    for (let y = floor(cy - 1.4); y <= floor(cy + 1.4); y++)
      for (let x = floor(cx - 1.4); x <= floor(cx + 1.4); x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const w = a * cl(1 - sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) / 1.4, 0, 1);
        if (w > skA[y * W + x]) skA[y * W + x] = w;
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const w = skA[y * W + x];
      if (w > 0) put(acc, x, y, skC[0], skC[1], skC[2], min(1, w * 1.15));
    }

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(acc[o] * alpha, 0, 1)) | 0, (255 * cl(acc[o + 1] * alpha, 0, 1)) | 0, (255 * cl(acc[o + 2] * alpha, 0, 1)) | 0);
}
