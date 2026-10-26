// ===== Patternflow pattern =====
// Title:   Seam Carving
// Family:  algo
// Idea:    An image of discs, rings, bands and a stripe fills the panel, its cumulative energy map sweeps down it row by row, and the cheapest eight-connected seam climbs back up from the bottom in white; then seam after seam lights the full height of the panel and is taken out, the columns closing in until the image is nearly a third narrower and the discs are still round, and after a map of the narrow image its cheapest seams are doubled one by one in mint until it is full width again and a new image is drawn.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: seam carving (Shai Avidan and Ariel Shamir, 2007), forward energy (Michael Rubinstein, Ariel Shamir and Shai Avidan, 2008), pattern round 59
// Round:   59
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Carve=20..40, Forward=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the ground runs from dark azure at the top to violet at the bottom with teal bands, the shapes are gold, rose, cyan, magenta and sky blue, and the energy map runs from indigo through magenta to gold; at 0.5 the ground is crimson with magenta bands and the shapes are blue, red, green, sea green and orange. The ground's wheel skips orange to lime, which reads brown when dim.
// Knob 2: Speed. 2 is one unit of the timeline a second: the image fades in for 0.5 s, the map sweeps down in 0.7 s, the first seam climbs in 0.3 s and the map fades in 0.3 s, the carving takes 5.5 s whatever the count, the narrow image's map 1.6 s, the growing 4.5 s, and the full image rests 1.2 s: 14.6 s an image. 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Carve. How many seams come out before the image grows back, 20 to 40 of its 64 columns; no row of a fresh image is more than 26 columns of shape. At 20 the image ends 44 columns wide and the carving takes 24 shape pixels an image, mostly half-lit rim pixels, out of the 2,560 it removes; at 30 it takes 93 and at 40, when some rows have no ground left, 376, and the discs come out oval. The growing doubles at most an eighth of the columns at a time, re-planned on the wider image after each batch: 5, 6, 6 and 3 seams at 20.
// Knob 4: Forward. Mixes the seam cost from Avidan and Shamir's gradient energy at 0 to Rubinstein's forward energy at 1, the cost of the edges a removal creates. The rim light on the image is the energy the knob uses: at 0 every outline glows, at 1 only the edges a removal would join, so the tops and bottoms of the discs and the bands go dark. A seam straight down the flat middle of a disc creates no edge, so at 1 the carving takes 78 shape pixels an image instead of 24, and a disc can grow back as a capsule.

const W = 64, H = 128, F = 8, N = W * H;
const { floor, min, max, abs, sqrt, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
// The timeline, in units of a second at Speed 2.
const T_IN = 0.5, T_MAP = 0.7, T_TRACE = 0.3, T_UNMAP = 0.3, T_CARVE = 5.5, T_GROW = 4.5, T_REST = 1.2;
// The narrow image's map: a pause, the sweep, a hold and the fade.
const H_PAUSE = 0.3, H_MAP = 0.7, H_HOLD = 0.3, H_FADE = 0.3, T_HOLD = H_PAUSE + H_MAP + H_HOLD + H_FADE;
// Within one seam's slot of the carving: it climbs, holds, then closes.
const Q_TRACE = 0.3, Q_CLOSE = 0.5;
// Within one seam's slot of the growing: its pixels light, then the copies open.
const G_OPEN = 0.3, G_FADE = 0.9;
// Every pixel carries a random number; JIT of it is added to the cost so
// that ties across flat ground break at random instead of to the left.
const JIT = 0.004;
// Rim light: the energy shown on the image, at GLOW for an energy of E_REF.
const GLOW = 0.42, E_REF = 0.5;
// Hues at knob 0. The ground goes through a wheel that skips orange to
// lime: 0.62 azure at the top to 0.71 violet at the bottom, bands 0.55 teal.
const BG0 = 0.46, SH0 = 0.12, PALETTE = [0, 0.83, 0.38, 0.79, 0.45];
// Shapes: 0 a shaded disc, 1 a thin ring, 2 a thick ring, 3 a ring round a disc.
const KINDS = [0, 0, 1, 2, 3];
// The ground's hue for knob k and the pixel's offset: the offset is
// folded back at the wheel's ends rather than wrapped, so the gradient
// never jumps from rose to lime halfway down the panel.
function groundHue(k, off) {
  let t = BG0 + k - floor(BG0 + k) + off;
  t = t < 0 ? -t : t > 1 ? 2 - t : t;
  return 0.28 + 0.74 * t;
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// A pixel is F floats: 0..2 its colour at knob 0, which the energy reads;
// 3 its hue offset, 4 saturation, 5 value; 6 its tie-breaking random
// number; 7 is 1 for the ground, whose hue goes through the skipping wheel.
// Rows are W pixels apart in memory and the first S.w of them are the image.
const tmp = [0, 0, 0];
function setRef(img, o) {
  hsv(img[o + 7] ? groundHue(0, img[o + 3]) : SH0 + img[o + 3], img[o + 4], img[o + 5], tmp);
  img[o] = tmp[0];
  img[o + 1] = tmp[1];
  img[o + 2] = tmp[2];
}
// Lay colour (h, s, v) over a pixel with coverage a. Hue is not blended:
// the edge pixel takes the hue of whichever covers more of it.
function lay(img, o, a, h, s, v, ground) {
  if (a <= 0) return;
  a = min(1, a);
  if (a >= 0.5) (img[o + 3] = h), (img[o + 7] = ground);
  img[o + 4] += (s - img[o + 4]) * a;
  img[o + 5] += (v - img[o + 5]) * a;
}

// A fresh image: a vertical gradient for ground, one or two teal bands,
// often a thin diagonal stripe from edge to edge, then discs and rings
// placed so no row is more than 26 columns shape, which leaves the seams
// at least 38 columns of ground in every row.
function paint(S) {
  const img = S.img, R = Math.random;
  S.w = W;
  const h0 = R() * 0.04, h1 = h0 + 0.08 + R() * 0.04;
  for (let y = 0; y < H; y++)
    for (let x = 0, t = y / (H - 1); x < W; x++) {
      const o = (y * W + x) * F;
      img[o + 3] = h0 + (h1 - h0) * t;
      img[o + 4] = 0.78;
      img[o + 5] = 0.36 - 0.1 * t;
      img[o + 6] = R();
      img[o + 7] = 1;
    }
  const nb = 1 + (R() < 0.6 ? 1 : 0);
  for (let b = 0; b < nb; b++) {
    const y0 = 6 + floor(R() * (H - 16)), hb = 3 + floor(R() * 4);
    for (let y = y0; y < y0 + hb; y++) for (let x = 0; x < W; x++) lay(img, (y * W + x) * F, 1, -0.1, 0.72, 0.5, 1);
  }
  if (R() < 0.7) {
    // The stripe: centre line from (0, ya) to (63, yb), 2.4 LEDs across.
    const ya = 10 + R() * (H - 20), dy = (R() < 0.5 ? -1 : 1) * (26 + R() * 30), yb = cl(ya + dy, 4, H - 5);
    const k = (yb - ya) / (W - 1), nrm = 1 / sqrt(1 + k * k), hs = PALETTE[floor(R() * PALETTE.length)];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const d = abs(y - (ya + k * x)) * nrm;
        lay(img, (y * W + x) * F, 1.7 - d, hs, 0.55, 0.78, 0);
      }
  }
  const cov = new Float32Array(H), shapes = [];
  for (let tries = 0; tries < 500 && shapes.length < 9; tries++) {
    const r = 5 + R() * 9, cx = 2.5 + r + R() * (W - 5 - 2 * r), cy = 2.5 + r + R() * (H - 5 - 2 * r);
    let ok = true;
    for (const s of shapes) if ((s.cx - cx) ** 2 + (s.cy - cy) ** 2 < (s.r + r + 3) ** 2) ok = false;
    for (let y = floor(cy - r); ok && y <= cy + r; y++) if (cov[y] + 2 * sqrt(max(0, r * r - (y - cy) ** 2)) > 26) ok = false;
    if (!ok) continue;
    for (let y = floor(cy - r); y <= cy + r; y++) cov[y] += 2 * sqrt(max(0, r * r - (y - cy) ** 2));
    shapes.push({ cx, cy, r, kind: KINDS[floor(R() * KINDS.length)], h: PALETTE[floor(R() * PALETTE.length)], pale: R() < 0.15 });
  }
  for (const s of shapes) {
    const sat = s.pale ? 0.18 : 0.8;
    for (let y = max(0, floor(s.cy - s.r - 1)); y <= min(H - 1, s.cy + s.r + 1); y++)
      for (let x = max(0, floor(s.cx - s.r - 1)); x <= min(W - 1, s.cx + s.r + 1); x++) {
        const d = sqrt((x + 0.5 - s.cx) ** 2 + (y + 0.5 - s.cy) ** 2), o = (y * W + x) * F;
        // Discs are shaded like a ball, half as bright at the rim, which also
        // gives their insides an energy the seams would rather go round.
        if (s.kind === 0) lay(img, o, s.r + 0.5 - d, s.h, sat, 1 - 0.5 * (d / s.r) ** 2, 0);
        else if (s.kind === 1) lay(img, o, 1.8 - abs(d - s.r + 1.3), s.h, sat, 0.95, 0);
        else if (s.kind === 2) lay(img, o, min(s.r + 0.5 - d, d - 0.5 * s.r + 0.5), s.h, sat, 0.92, 0);
        else {
          lay(img, o, 1.6 - abs(d - s.r + 1.1), s.h, sat, 0.95, 0);
          lay(img, o, 0.42 * s.r + 0.5 - d, s.h + 0.5, sat, 1 - 0.45 * (d / (0.42 * s.r)) ** 2, 0);
        }
      }
  }
  for (let o = 0; o < N * F; o += F) setRef(img, o);
}

const d3 = (a, o1, o2) => abs(a[o1] - a[o2]) + abs(a[o1 + 1] - a[o2 + 1]) + abs(a[o1 + 2] - a[o2 + 2]);

// The dynamic programme over rows, on the first w columns of img.
// Backward energy is Avidan and Shamir's e1, |dI/dx| + |dI/dy| summed over
// the colours, central differences with the border pixel repeated. Forward
// energy is the cost of the new neighbours a removal makes: taking (x, y)
// joins x - 1 and x + 1 in row y, CU = |I(x+1,y) - I(x-1,y)|; if the seam
// came from (x - 1, y - 1) the pixel (x, y - 1) also comes to sit over
// (x - 1, y), CL = CU + |I(x,y-1) - I(x-1,y)|, and from (x + 1, y - 1)
// CR = CU + |I(x,y-1) - I(x+1,y)|. With f the knob,
// M(x,y) = (1 - f) e1(x,y) + min over the three of M(x', y-1) + f C.
// back holds the move that won (-1, 0, +1); seam gets the cheapest path,
// one pixel a row, from the least M in the bottom row back up.
function carveDP(img, w, f, M, back, seam) {
  for (let y = 0; y < H; y++) {
    const yu = y > 0 ? y - 1 : 0, yd = y < H - 1 ? y + 1 : y;
    for (let x = 0; x < w; x++) {
      const o = (y * W + x) * F, ol = (y * W + (x > 0 ? x - 1 : 0)) * F, or = (y * W + (x < w - 1 ? x + 1 : x)) * F;
      const cu = d3(img, ol, or);
      const e1 = 0.5 * (cu + d3(img, (yu * W + x) * F, (yd * W + x) * F));
      const base = (1 - f) * e1 + JIT * img[o + 6], i = y * W + x;
      if (y === 0) {
        M[i] = base + f * cu;
        back[i] = 0;
        continue;
      }
      const ou = (yu * W + x) * F, j = i - W;
      let best = M[j] + f * cu, mv = 0;
      if (x > 0) {
        const v = M[j - 1] + f * (cu + d3(img, ou, ol));
        if (v < best) (best = v), (mv = -1);
      }
      if (x < w - 1) {
        const v = M[j + 1] + f * (cu + d3(img, ou, or));
        if (v < best) (best = v), (mv = 1);
      }
      M[i] = base + best;
      back[i] = mv;
    }
  }
  let x = 0;
  for (let c = 1, o = (H - 1) * W; c < w; c++) if (M[o + c] < M[o + x]) x = c;
  for (let y = H - 1; y >= 0; y--) {
    seam[y] = x;
    x += back[y * W + x];
  }
  return M[(H - 1) * W + seam[H - 1]];
}

// Take one pixel out of every row; the rest of the row moves left.
function removeSeam(img, ids, w, seam) {
  for (let y = 0; y < H; y++) {
    const r = y * W, s = seam[y];
    img.copyWithin((r + s) * F, (r + s + 1) * F, (r + w) * F);
    ids.copyWithin(r + s, r + s + 1, r + w);
  }
}

// Each row's M from its least to its greatest, kept for drawing the map. A
// row's span is held to at least a third of the widest, so a row of plain
// ground shows dark instead of its tie-breaking noise stretched to full.
function rowRange(S, w, M) {
  let top = 1e-6;
  for (let y = 0; y < H; y++) {
    let a = Infinity, b = -Infinity;
    for (let x = 0, o = y * W; x < w; x++) (a = min(a, M[o + x])), (b = max(b, M[o + x]));
    S.mlo[y] = a;
    S.mhi[y] = b - a;
    top = max(top, b - a);
  }
  for (let y = 0; y < H; y++) S.mhi[y] = max(S.mhi[y], top / 3);
}

// The rim light: the energy the knob uses, per pixel. Forward energy has no
// cost of its own at a pixel, only at a move; the cheapest move, straight
// down, costs CU, and half of it is shown to match e1's half differences.
// Each pixel's colour with its rim light is kept until the image, the hue
// or the knob changes.
function prepare(S) {
  const img = S.img, w = S.w, f = S.f, hue = S.hue, C = S.C;
  for (let y = 0; y < H; y++) {
    const yu = y > 0 ? y - 1 : 0, yd = y < H - 1 ? y + 1 : y;
    for (let x = 0; x < w; x++) {
      const i = y * W + x, o = i * F, ol = (y * W + (x > 0 ? x - 1 : 0)) * F, or = (y * W + (x < w - 1 ? x + 1 : x)) * F;
      const dx = d3(img, ol, or), dy = d3(img, (yu * W + x) * F, (yd * W + x) * F);
      const e = min(1, (0.5 * (dx + (1 - f) * dy)) / E_REF);
      S.G[i] = e;
      hsv(img[o + 7] ? groundHue(hue, img[o + 3]) : SH0 + hue + img[o + 3], img[o + 4], img[o + 5], tmp);
      C[i * 3] = tmp[0];
      C[i * 3 + 1] = tmp[1];
      C[i * 3 + 2] = tmp[2];
    }
  }
  S.gw = w;
  S.gf = f;
  S.gh = hue;
  S.dirty = false;
}

export function setup(params) {
  const S = (params.s = {
    img: new Float32Array(N * F), ids: new Int16Array(N), w: W,
    M: new Float32Array(N), M2: new Float32Array(N), back: new Int8Array(N), seam: new Int16Array(H), mlo: new Float32Array(H), mhi: new Float32Array(H),
    G: new Float32Array(N), C: new Float32Array(N * 3), gw: -1, gf: -1, gh: -1, dirty: true,
    // The growing's plan: a copy carved down on the side, and the seams it gave.
    T: new Float32Array(N * F), Tids: new Int16Array(N), tw: 0, plan: [], need: 0,
    act: new Int16Array(H),
    ph: 0, pt: 0, q: 0, k: 20, f: 0, hue: 0, removed: 0, grown: 0, inserted: false,
    out: new Float32Array(N * 3), last: new Float32Array(N * 3),
  });
  paint(S);
  S.ph = 0;
}

// Plan b seams to double: carve them out of a copy of the image one after
// another, recording each by the ids of its pixels, which are the columns
// of the image as it stands now. Avidan and Shamir enlarge this way, since
// doubling the one cheapest seam over and over would stretch one column.
function planStart(S, b) {
  for (let y = 0; y < H; y++) for (let x = 0; x < S.w; x++) S.ids[y * W + x] = x;
  S.T.set(S.img);
  S.Tids.set(S.ids);
  S.tw = S.w;
  S.plan = [];
  S.need = b;
}
function planStep(S) {
  if (S.plan.length >= S.need) return;
  // The first plan's map is the one drawn; the rest go to a spare.
  carveDP(S.T, S.tw, S.f, S.plan.length ? S.M2 : S.M, S.back, S.seam);
  const ids = new Int16Array(H);
  for (let y = 0; y < H; y++) ids[y] = S.Tids[y * W + S.seam[y]];
  if (S.plan.length === 0) rowRange(S, S.tw, S.M);
  S.plan.push(ids);
  removeSeam(S.T, S.Tids, S.tw, S.seam);
  S.tw--;
}

// Double planned seam j: after its pixel in every row goes a new one, the
// mean of it and its right neighbour. act holds where the new pixels are.
function insertSeam(S, ids) {
  const img = S.img, w = S.w;
  for (let y = 0; y < H; y++) {
    const r = y * W;
    let c = 0;
    while (c < w - 1 && S.ids[r + c] !== ids[y]) c++;
    img.copyWithin((r + c + 2) * F, (r + c + 1) * F, (r + w) * F);
    S.ids.copyWithin(r + c + 2, r + c + 1, r + w);
    const o = (r + c) * F, n = (r + c + 1) * F, o2 = c + 1 < w ? (r + c + 2) * F : o;
    for (let k = 0; k < 7; k++) img[n + k] = 0.5 * (img[o + k] + img[o2 + k]);
    // Hues average the short way round the wheel; the ground keeps its wheel.
    let dh = img[o2 + 3] - img[o + 3];
    dh -= round(dh);
    img[n + 3] = img[o + 3] + 0.5 * dh;
    img[n + 7] = img[o + 7];
    img[n + 6] = Math.random();
    S.ids[r + c + 1] = -1;
    S.act[y] = c + 1;
  }
  S.w++;
}
// The pixels of a planned seam in the image as it stands.
function locate(S, ids) {
  for (let y = 0; y < H; y++) {
    let c = 0;
    while (c < S.w - 1 && S.ids[y * W + c] !== ids[y]) c++;
    S.act[y] = c;
  }
}

function enter(S, ph) {
  S.ph = ph;
  S.pt = 0;
  if (ph === 1) {
    // The map, and the first seam with it.
    carveDP(S.img, S.w, S.f, S.M, S.back, S.seam);
    rowRange(S, S.w, S.M);
    S.act.set(S.seam);
  } else if (ph === 4) {
    S.removed = 0;
    S.q = Q_TRACE;
  } else if (ph === 5) {
    S.grow = S.removed;
    S.grown = 0;
    planStart(S, min(S.grow, floor(S.w / 8)));
    planStep(S);
  } else if (ph === 6) {
    S.q = 0;
    S.inserted = false;
    S.done = 0;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 20, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  const speed = cl(kv[1], 0.2, 3);
  S.k = round(cl(kv[2], 20, 40));
  S.f = cl(kv[3], 0, 1);
  const g = (d * speed) / 2;
  S.pt += g;
  if (S.ph === 0) {
    if (S.pt >= T_IN) enter(S, 1);
  } else if (S.ph === 1) {
    if (S.pt >= T_MAP) enter(S, 2);
  } else if (S.ph === 2) {
    if (S.pt >= T_TRACE) enter(S, 3);
  } else if (S.ph === 3) {
    if (S.pt >= T_UNMAP) enter(S, 4);
  } else if (S.ph === 4) {
    // The carving: k seams in T_CARVE, each in its slot of q from 0 to 1.
    S.q += (g * S.k) / T_CARVE;
    while (S.q >= 1) {
      removeSeam(S.img, S.ids, S.w, S.act);
      S.w--;
      S.removed++;
      S.dirty = true;
      S.q -= 1;
      if (S.removed >= S.k || S.w <= 8) {
        enter(S, 5);
        break;
      }
      carveDP(S.img, S.w, S.f, S.M, S.back, S.seam);
      S.act.set(S.seam);
    }
  } else if (S.ph === 5) {
    // The narrow image's map, while the plan is carved on the side.
    for (let n = 0; n < 3; n++) planStep(S);
    if (S.pt >= T_HOLD) {
      while (S.plan.length < S.need) planStep(S);
      enter(S, 6);
      locate(S, S.plan[0]);
    }
  } else if (S.ph === 6) {
    // The growing: the planned seams doubled, one slot each.
    S.q += (g * S.grow) / T_GROW;
    for (;;) {
      if (!S.inserted && S.q >= G_OPEN) {
        insertSeam(S, S.plan[S.done]);
        S.inserted = true;
        S.dirty = true;
      }
      if (S.q < 1) break;
      S.q -= 1;
      S.inserted = false;
      S.done++;
      S.grown++;
      if (S.grown >= S.grow) {
        enter(S, 7);
        break;
      }
      if (S.done >= S.plan.length) {
        // A batch is used up: plan the next one on the wider image.
        planStart(S, min(S.grow - S.grown, floor(S.w / 8)));
        while (S.plan.length < S.need) planStep(S);
        S.done = 0;
      }
      locate(S, S.plan[S.done]);
    }
  } else if (S.ph === 7) {
    if (S.pt >= T_REST) {
      S.last.set(S.out);
      paint(S);
      S.dirty = true;
      enter(S, 0);
    }
  }
}

const row = new Float32Array(W * 3), c = [0, 0, 0], h2 = [0, 0, 0];
export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.dirty || S.gf !== S.f || S.gw !== S.w || S.gh !== S.hue) prepare(S);
  const w = S.w, out = S.out, hue = S.hue;
  // What is lit and how: the map's share a, the sweep's front row, the
  // active seam's light and the width of its pixel.
  let mapA = 0, front = -1, light = 0, lightFrom = H, aw = 1, x0 = floor((W - w) / 2), grow = false;
  const off = (n) => floor((W - n) / 2);
  const ph = S.ph;
  if (ph === 1) (mapA = 1), (front = (S.pt / T_MAP) * H);
  else if (ph === 2) (mapA = 1), (light = 1), (lightFrom = H * (1 - S.pt / T_TRACE));
  else if (ph === 3) (mapA = 1 - smooth(S.pt / T_UNMAP)), (light = 1), (lightFrom = 0);
  else if (ph === 4) {
    const q = S.q;
    light = 1;
    lightFrom = q < Q_TRACE ? H * (1 - q / Q_TRACE) : 0;
    const p = smooth((q - Q_CLOSE) / (1 - Q_CLOSE));
    aw = 1 - p;
    x0 = off(w) + p * (off(w - 1) - off(w));
  } else if (ph === 5) {
    const t = S.pt - H_PAUSE;
    if (t > 0 && t < H_MAP) (mapA = 1), (front = (t / H_MAP) * H);
    else if (t >= H_MAP) mapA = 1 - smooth((t - H_MAP - H_HOLD) / H_FADE);
  } else if (ph === 6) {
    const q = S.q;
    grow = true;
    light = q < G_FADE ? 1 : 1 - (q - G_FADE) / (1 - G_FADE);
    lightFrom = q < G_OPEN ? H * (1 - q / G_OPEN) : 0;
    if (S.inserted) {
      const p = smooth((q - G_OPEN) / (G_FADE - G_OPEN));
      aw = p;
      x0 = off(w - 1) + p * (off(w) - off(w - 1));
    }
  }
  // Seam lights: warm white for a carved seam, pale mint for a doubled one.
  const sl = grow ? [0.72, 1, 0.86] : [1, 0.94, 0.8];
  for (let y = 0; y < H; y++) {
    row.fill(0);
    const act = light > 0 || aw !== 1 ? S.act[y] : -1;
    let pos = x0;
    for (let i = 0; i < w; i++) {
      const wd = i === act ? aw : 1;
      if (wd <= 0) continue;
      const gl = GLOW * S.G[y * W + i] * (1 - mapA), oc = (y * W + i) * 3;
      for (let k = 0; k < 3; k++) c[k] = S.C[oc + k] + (1 - S.C[oc + k]) * gl;
      if (mapA > 0 && (front < 0 || y < front)) {
        // The cumulative energy map, each row from its least M to its greatest.
        const m = sqrt((S.M[y * W + i] - S.mlo[y]) / S.mhi[y]);
        hsv(0.72 + hue + 0.4 * m, 0.9 - 0.45 * m * m, 0.16 + 0.84 * m, h2);
        for (let k = 0; k < 3; k++) c[k] += (h2[k] - c[k]) * mapA;
      }
      if (front >= 0 && y === floor(front)) for (let k = 0; k < 3; k++) c[k] += (1 - c[k]) * 0.6;
      if (i === act && light > 0 && y >= lightFrom) {
        const a = light * (grow ? 0.85 : 0.9);
        for (let k = 0; k < 3; k++) c[k] += (sl[k] - c[k]) * a;
      }
      // Lay the pixel over the LEDs it covers, by area.
      const a = pos, b = pos + wd;
      pos = b;
      for (let x = max(0, floor(a)), x1 = min(W - 1, Math.ceil(b) - 1); x <= x1; x++) {
        const cov = min(b, x + 1) - max(a, x);
        if (cov <= 0) continue;
        row[x * 3] += c[0] * cov;
        row[x * 3 + 1] += c[1] * cov;
        row[x * 3 + 2] += c[2] * cov;
      }
    }
    // The first image fades in from black, every later one from the last.
    const fade = ph === 0 ? smooth(S.pt / T_IN) : 1;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      for (let k = 0; k < 3; k++) out[o + k] = S.last[o + k] + (row[x * 3 + k] - S.last[o + k]) * fade;
      display.setPixel(x, y, (255 * cl(out[o], 0, 1)) | 0, (255 * cl(out[o + 1], 0, 1)) | 0, (255 * cl(out[o + 2], 0, 1)) | 0);
    }
  }
}
