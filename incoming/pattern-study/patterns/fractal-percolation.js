// ===== Patternflow pattern =====
// Title:   Fractal Percolation
// Family:  fractal
// Idea:    Two stacked squares split into quarters again and again down to single LEDs, each quarter kept with chance p and the rest going dark, then a front climbs from the bottom row through the kept LEDs, the cluster that reaches the top row lights mint while the rest stays dim, and the view zooms into a kept pair of squares that grows to fill the panel and splits once more.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Fractal percolation (Benoit Mandelbrot, 1974), with the crossing transition of Chayes, Chayes and Durrett (1988), pattern round 48
// Round:   48
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Keep=0.88..0.99, Levels=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the kept LEDs are steel blue, the front is white over a pale blue trail, the crossing cluster is mint and the holes are dark plum; at 0.25 the kept LEDs are purple, the crossing cluster blue and the holes olive; at 0.5 tan, pink and green; at 0.75 green, yellow and navy.
// Knob 2: Speed. At 2 a level splits every 0.45 s, so a build from two squares to single LEDs takes 2.7 s and the first front sets off 3 s in; the front climbs 110 LEDs of path a second (1.2 s to the top row on average), a crossing cluster stays lit 1.4 s and a zoom takes 1.4 s, and after four zooms the holes close and a fresh build begins, about every 23 s. At 0.2 everything is ten times slower; at 3 half as fast again, a fresh build every 16 s.
// Knob 3: Keep. The chance p that each quarter is kept at every split. At the opening 0.88 the front reaches the top row in about half the tests and 47% of the LEDs are kept; at 0.90 in seven of ten, with 53% kept; at 0.93 in nine of ten, with 65% kept; at 0.99 every time, with 94% kept. The kept set is a random Cantor set of dimension log(4p)/log 2, 1.82 at 0.88 and 1.99 at 0.99.
// Knob 4: Levels. How brightly each hole keeps the colour of the level that cut it, magenta for the 32-LED holes and a step on towards blue-violet for each smaller size. At 0 every hole is black and only the set shows; at the opening 0.06 the 32-LED holes glow at 35/255 and the single-LED ones at 16, so the big holes read as dark plum squares; at 0.25 at 71 and 32, and at 1 at 142 and 65, a mosaic of squares inside squares.
// Buttons: K1 tap closes the holes back into two whole squares and carves a fresh set.

const W = 64, H = 128, N = W * H, DEPTH = 6;
const { floor, min, max, exp, pow, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Seconds at Speed 2: one level's split, the fade of a cut square, the time
// a crossing (or its absence) stays lit, and one zoom by two.
const STEP = 0.45, FADE = 0.35, SEAM = 0.4, HOLD = 1.4, MISS = 0.7, ZOOM = 1.4, HEAL = 0.09;
// The front climbs this many LEDs of path a second, and four zooms follow a
// build before a fresh one.
const CLIMB = 110, ZMAX = 4;

// Carves levels a..b into cut on a grid w wide and h tall made of w-by-w
// squares: at level k every square of side w >> k that no earlier level has
// cut is cut whole with chance 1 - p. cut holds the level that removed each
// LED's square, or 0 while it is kept.
function carve(cut, w, h, a, b, p) {
  for (let k = a; k <= b; k++) {
    const s = w >> k;
    for (let y = 0; y < h; y += s)
      for (let x = 0; x < w; x += s) {
        const o = y * w + x;
        if (cut[o] || Math.random() < p) continue;
        for (let j = 0; j < s; j++) cut.fill(k, o + j * w, o + j * w + s);
      }
  }
}

// Path length from the bottom row through kept LEDs that share an edge, into
// dist (-1 where the bottom row cannot be reached). Returns the shortest path
// to the top row, or -1 when no kept path crosses.
function reach(cut, w, h, dist, q) {
  dist.fill(-1);
  let t = 0, top = -1;
  for (let x = 0, o = (h - 1) * w; x < w; x++) if (!cut[o + x]) (dist[o + x] = 0), (q[t++] = o + x);
  for (let i = 0; i < t; i++) {
    const p = q[i], d = dist[p] + 1, x = p % w;
    if (p < w && top < 0) top = d - 1;
    if (x > 0 && !cut[p - 1] && dist[p - 1] < 0) (dist[p - 1] = d), (q[t++] = p - 1);
    if (x < w - 1 && !cut[p + 1] && dist[p + 1] < 0) (dist[p + 1] = d), (q[t++] = p + 1);
    if (p >= w && !cut[p - w] && dist[p - w] < 0) (dist[p - w] = d), (q[t++] = p - w);
    if (p + w < w * h && !cut[p + w] && dist[p + w] < 0) (dist[p + w] = d), (q[t++] = p + w);
  }
  return top;
}

// The crossing cluster: every LED reached from the bottom row that also
// connects to the top row, marked 1 in mark. Returns how many there are.
function spanning(w, h, dist, mark, q) {
  mark.fill(0);
  let t = 0;
  for (let x = 0; x < w; x++) if (dist[x] >= 0) (mark[x] = 1), (q[t++] = x);
  for (let i = 0; i < t; i++) {
    const p = q[i], x = p % w;
    for (const n of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w < w * h ? p + w : -1])
      if (n >= 0 && dist[n] >= 0 && !mark[n]) (mark[n] = 1), (q[t++] = n);
  }
  return t;
}

// Zoom targets: a column of the level-1 grid (32 LEDs wide) and a pair of
// its rows, so 32 by 64 LEDs, the panel's shape at half its size. Only pairs
// whose two squares survived level 1 can be chosen, and the choice looks at
// nothing else, so the view after a zoom is a fresh sample of the
// construction one level down.
function target(cut) {
  const ok = [];
  for (let c = 0; c < 2; c++)
    for (let r = 0; r < 3; r++) if (cut[r * 32 * W + c * 32] !== 1 && cut[(r + 1) * 32 * W + c * 32] !== 1) ok.push([c * 32, r * 32]);
  return ok.length ? ok[floor(Math.random() * ok.length)] : null;
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, p: 0.88, lev: 0.06, t: 0,
    ph: "build", pt: 0, L: 0, maxd: 0, revT: new Float64Array(DEPTH + 1).fill(-9), R: 0, top: -1, crossed: false, zooms: 0, tgt: null, zs: 1,
    cut: new Uint8Array(N), dist: new Int32Array(N), mark: new Uint8Array(N), q: new Int32Array(N),
    lit: new Float32Array(N), glow: new Float32Array(N),
    tmp: new Uint8Array(N), tmpF: new Float32Array(N), tmpL: new Float32Array(N),
    pal: new Float32Array(32 * 3), palKey: "",
    // Fronts sent and crossings found, kept for checking the rates above.
    tests: 0, hits: 0,
  };
  fresh(params.s);
}

function fresh(S) {
  S.cut.fill(0);
  S.ph = "build";
  S.pt = 0;
  S.L = 0;
  S.revT.fill(-9);
  S.zooms = 0;
  S.R = 0;
  S.crossed = false;
}

// After a zoom: every LED of the chosen pair becomes a 2-by-2 block and each
// level moves up one; the build then carves the single LEDs anew.
function settle(S) {
  const [ox, oy] = S.tgt, { cut, lit, glow, tmp, tmpF, tmpL } = S;
  tmp.set(cut);
  tmpF.set(lit);
  tmpL.set(glow);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = (oy + (y >> 1)) * W + ox + (x >> 1), c = tmp[o];
      cut[p] = c > 1 ? c - 1 : 0;
      lit[p] = tmpF[o];
      glow[p] = tmpL[o];
    }
  for (let k = 1; k < DEPTH; k++) S.revT[k] = -9;
  S.L = DEPTH - 1;
  S.ph = "build";
  S.pt = STEP * (DEPTH - 1) + 0.2;
  S.zooms++;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.88, 0.06];
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.p = cl(k[2], 0.88, 0.99);
  S.lev = cl(k[3], 0, 1);
  const d = (cl(dt || 0, 0, 0.1) * S.speed) / 2;
  S.t += d;
  S.pt += d;
  if (input.btnPressed && input.btnPressed[0] && S.ph !== "heal") (S.ph = "heal"), (S.pt = 0), (S.crossed = false);
  if (S.ph === "build") {
    // Level L + 1 splits every STEP; the front sets off 0.3 s after the last.
    const L = min(DEPTH, floor(S.pt / STEP));
    // Each level is carved as it splits, so turning Keep acts on the next.
    while (S.L < L) {
      S.L++;
      carve(S.cut, W, H, S.L, S.L, S.p);
      S.revT[S.L] = S.t;
    }
    if (S.L === DEPTH && S.pt > STEP * DEPTH + 0.3) {
      S.top = reach(S.cut, W, H, S.dist, S.q);
      // The longest path, for when nothing crosses.
      let m = 0;
      for (let p = 0; p < N; p++) if (S.dist[p] > m) m = S.dist[p];
      S.maxd = m;
      S.ph = "burn";
      S.pt = 0;
      S.R = 0;
      S.crossed = false;
    }
  } else if (S.ph === "burn") {
    S.R += CLIMB * d;
    if (S.top >= 0 && S.R >= S.top) {
      spanning(W, H, S.dist, S.mark, S.q);
      S.crossed = true;
      S.ph = "hold";
      S.pt = 0;
      S.tests++;
      S.hits++;
    } else if (S.top < 0 && S.R > S.maxd + 8) {
      // The front has run out of path: no crossing this time.
      S.ph = "hold";
      S.pt = HOLD - MISS;
      S.tests++;
    }
  } else if (S.ph === "hold") {
    if (S.pt > HOLD) {
      S.tgt = S.zooms < ZMAX ? target(S.cut) : null;
      S.ph = S.tgt ? "zoom" : "heal";
      S.pt = 0;
    }
  } else if (S.ph === "zoom") {
    const u = cl(S.pt / ZOOM, 0, 1);
    // Eased in and out, scaled exponentially so it looks like a steady fall.
    S.zs = pow(2, u * u * (3 - 2 * u));
    if (S.pt >= ZOOM) {
      S.zs = 1;
      S.crossed = false;
      settle(S);
    }
  } else if (S.ph === "heal") {
    // The holes close from the smallest up, then a fresh set is carved.
    S.crossed = false;
    const L = DEPTH - floor(S.pt / HEAL);
    if (L < S.L) S.L = max(0, L);
    if (S.pt > HEAL * (DEPTH + 1) + 0.25) fresh(S);
  }
  // Light: the front and its trail brighten the kept LEDs it has reached;
  // once it crosses, the crossing cluster turns to the accent and the rest
  // falls back.
  const burning = S.ph === "burn" || S.ph === "hold", kf = 1 - exp(-d * 7), kg = 1 - exp(-d * 4);
  const { dist, lit, glow, mark } = S;
  for (let p = 0; p < N; p++) {
    let tl = 0, tg = 0;
    if (burning && dist[p] >= 0 && dist[p] <= S.R) {
      if (S.crossed) tg = mark[p];
      else tl = 0.55;
    }
    lit[p] += (tl - lit[p]) * kf;
    if (S.ph !== "zoom") glow[p] += (tg - glow[p]) * (tg > glow[p] ? kf * 1.5 : kg);
  }
}

// Colours: 0 kept, 1 lit trail, 2 crossing, 3 front, 4 cut flash, 8 + k the
// hole of level k.
function palette(S) {
  const key = S.hue + ":" + S.lev;
  if (key === S.palKey) return;
  S.palKey = key;
  const h = S.hue + 0.6, P = S.pal;
  hsv(h, 0.5, 0.5, P, 0);
  hsv(h, 0.35, 0.9, P, 3);
  hsv(h + 0.82, 0.62, 0.9, P, 6);
  hsv(h + 0.82, 0.1, 1, P, 9);
  hsv(h, 0.2, 1, P, 12);
  for (let k = 1; k <= DEPTH; k++) {
    // Each level its own hue, 0.055 of the wheel on from the last; the
    // larger the hole, the brighter its glow.
    const v = 0.55 * pow(S.lev, 0.5) * (1.12 - 0.11 * k);
    hsv(h + 0.33 - 0.055 * (k - 1), 0.7, v, P, (8 + k) * 3);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  const { cut, lit, glow, dist, pal: P, revT } = S;
  const zoom = S.ph === "zoom", s = S.zs, fx = zoom ? S.tgt[0] * 2 : 0, fy = zoom ? S.tgt[1] * 2 : 0;
  const front = S.ph === "burn";
  // While a level splits, the edges of its new squares show as dark seams
  // for a moment; before the first split, the edge between the two squares.
  const L = S.L, age = L ? S.t - revT[L] : 0, ss = 64 >> (L ? L : 0);
  const seam = S.ph === "build" && L <= 3 && age < SEAM ? 0.35 + 0.65 * (L ? age / SEAM : 0) : 0;
  for (let y = 0; y < H; y++) {
    const sy = zoom ? floor(fy + (y + 0.5 - fy) / s) : y;
    for (let x = 0; x < W; x++) {
      const sx = zoom ? floor(fx + (x + 0.5 - fx) / s) : x;
      if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue;
      const p = sy * W + sx, c = cut[p];
      let r, g, b;
      if (c && c <= S.L) {
        // A cut square: a flash, then the glow of its level.
        const a = min(1, (S.t - revT[c]) / FADE), o = (8 + c) * 3;
        const f = (1 - a) * (1 - a);
        r = P[o] + (P[12] - P[o]) * f;
        g = P[o + 1] + (P[13] - P[o + 1]) * f;
        b = P[o + 2] + (P[14] - P[o + 2]) * f;
      } else {
        const l = lit[p], gg = glow[p];
        r = P[0] + (P[3] - P[0]) * l;
        g = P[1] + (P[4] - P[1]) * l;
        b = P[2] + (P[5] - P[2]) * l;
        r += (P[6] - r) * gg;
        g += (P[7] - g) * gg;
        b += (P[8] - b) * gg;
        if (front && dist[p] >= 0 && dist[p] <= S.R && S.R - dist[p] < 5) {
          const f = 1 - (S.R - dist[p]) / 5;
          r += (P[9] - r) * f;
          g += (P[10] - g) * f;
          b += (P[11] - b) * f;
        }
      }
      if (seam && !(c && c <= S.L) && (sx % ss === 0 || sy % ss === 0)) (r *= seam), (g *= seam), (b *= seam);
      // Channels in steps of 4 of 255: too fine to see, and a frame packs smaller.
      display.setPixel(x, y, min(255, round(r / 4) * 4), min(255, round(g / 4) * 4), min(255, round(b / 4) * 4));
    }
  }
}
