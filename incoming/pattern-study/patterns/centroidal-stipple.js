// ===== Patternflow pattern =====
// Title:   Centroidal Stipple
// Family:  type
// Idea:    A swarm of dots is poured over a three-letter word set as a density, and each frame every dot steps toward the density-weighted centre of mass of the Voronoi cell it owns, so the swarm packs into the heavy strokes at an even blue-noise spacing and the word stands out of the dots alone, until the word changes and the dots stream, white while they hurry, into the next one.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: weighted centroidal Voronoi stippling (Adrian Secord, 2002) by Lloyd's relaxation (Stuart Lloyd, 1957/1982), pattern round 105
// Round:   105
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Relax=0.3..3, Word=0..7, Dots=0..1
//
// Knob 1: Hue. Turns the dots round the wheel, each letter a little further round than the one above it. At 0 the word runs from aqua through blue to violet, at 0.5 from orange through yellow to green.
// Knob 2: Relax. How far each dot steps toward the centroid of its cell every frame, 0.32 of the way at 2 (a new word sorts itself in about 3 s), 0.48 at 3 and 0.05 at 0.3. Below 1.6 the dots are also shaken, by up to 0.39 LED a frame at 0.3, so a lazy swarm stays ragged and glints white with its own jitter.
// Knob 3: Word. Picks the word by number, 0 DOT, 1 LED, 2 HUE, 3 ART, 4 NAM, 5 POP, 6 TAP, 7 RED, and the row of eight pips under the word lights the one that is up. Left alone the list goes on every 8 s; after a turn the chosen word is held for 20 s.
// Knob 4: Dots. The number of dots, 400 at 0, 710 where it opens at 0.06, 1500 at 1. With few the stroke is three dots across and each dot stands alone; with many the dots pack into a lattice that nearly fills the letter.

// The panel stands 64 by 128. Three letters, 36 LEDs tall and 36 wide with a
// stroke 7 LEDs wide, are stacked down it from row 3, 41 rows apart. A letter
// is a few strokes (lines and arcs) drawn in code, and its density is 1
// within 2.3 LEDs of a stroke's centre line and falls to 0 at 4.7, so the
// edge is soft and a dot can sit on it. The density is
// kept on a grid twice as fine as the panel, 128 by 256, because at 1500 dots
// a cell holds under two LEDs and the centroid of so few is noise.
//
// Each frame, from the dots: they are sorted into 4 LED buckets, each sample
// of the density finds its nearest dot through the buckets, and every dot
// takes the density-weighted mean of the samples it owns. That mean is the
// centroid of its Voronoi cell, and the dot moves a fraction of the way to
// it. A dot that owns no density has no centroid, so it also drifts along the
// vector to the nearest stroke, which is what lets a word's dots leave empty
// ground; once a dot owns some density, the centroid alone moves it.
//
// A dot's colour is its speed: white-hot from 28 LEDs a second, a pale tint
// of the hue when it has settled. The letters sway slowly, each on its own
// phase, so the settled dots still follow something and the panel does not
// hold still.

const W = 64, H = 128, S2 = 2, W2 = W * S2, H2 = H * S2, MAXN = 1500;
const { floor, min, max, abs, sqrt, hypot, sin, cos, PI, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const HW = 3.5, EDGE = 1.2, TOPS = [3, 44, 85], X0 = 18, XW = 28;
const DUR = 8, HOLD_MANUAL = 20, SWAY = 2.5, SWAY_T = 9, DRIFT = 11, CAP = 14;
const WORDS = ["DOT", "LED", "HUE", "ART", "NAM", "POP", "TAP", "RED"];

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// Blue and red carry a third of green's light, so near them the colour is
// lifted; near orange and yellow it is paled so it never reads as brown.
function tone(h, v) {
  const f = h - floor(h), b = exp(-(((f - 0.11) / 0.08) ** 2)), u = exp(-(((f - 0.66) / 0.08) ** 2)), r = exp(-(((f - 1) / 0.06) ** 2)) + exp(-((f / 0.06) ** 2));
  const c = hsv(h, 0.72 - 0.3 * b - 0.18 * u - 0.15 * r, 1);
  const g = cl(0.62 / (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114), 1, 1.9);
  return [min(1, c[0] * g * v), min(1, c[1] * g * v), min(1, c[2] * g * v)];
}

// ---- The letters. Each is a few polylines in a unit box, u across and v down;
// the box maps onto the stroke centre lines of a 36 LED letter.
const arc = (cx, cy, rx, ry, a0, a1, n = 10) => {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    p.push([cx + rx * cos(a), cy + ry * sin(a)]);
  }
  return p;
};
const oval = [];
for (let i = 0; i <= 28; i++) {
  const a = (2 * PI * i) / 28, c = cos(a), s = sin(a);
  oval.push([0.5 + 0.5 * Math.sign(c) * abs(c) ** (2 / 2.7), 0.5 + 0.5 * Math.sign(s) * abs(s) ** (2 / 2.7)]);
}
const bowl = (ry, y1) => [[0, 1], [0, 0], [0.6, 0], ...arc(0.6, ry, 0.4, ry, -PI / 2, PI / 2), [0, y1]];
const LET = {
  D: [[[0, 0], [0.42, 0], ...arc(0.42, 0.5, 0.58, 0.5, -PI / 2, PI / 2), [0, 1], [0, 0]]],
  O: [oval],
  T: [[[0, 0], [1, 0]], [[0.5, 0], [0.5, 1]]],
  L: [[[0, 0], [0, 1], [1, 1]]],
  E: [[[1, 0], [0, 0], [0, 1], [1, 1]], [[0, 0.5], [0.78, 0.5]]],
  H: [[[0, 0], [0, 1]], [[1, 0], [1, 1]], [[0, 0.5], [1, 0.5]]],
  U: [[[0, 0], [0, 0.62], ...arc(0.5, 0.62, 0.5, 0.38, PI, 0), [1, 0]]],
  A: [[[0, 1], [0.5, 0], [1, 1]], [[0.2, 0.74], [0.8, 0.74]]],
  R: [bowl(0.27, 0.54), [[0.5, 0.54], [1, 1]]],
  N: [[[0, 1], [0, 0], [1, 1], [1, 0]]],
  M: [[[0, 1], [0, 0], [0.5, 0.62], [1, 0], [1, 1]]],
  P: [bowl(0.3, 0.6)],
};

// Distance from a point to the nearest of a letter's segments, the nearest
// point left in NX, NY.
let NX = 0, NY = 0;
function nearSeg(arr, px, py) {
  let best = 1e18;
  for (let k = 0; k < arr.length; k += 4) {
    const ax = arr[k], ay = arr[k + 1], dx = arr[k + 2] - ax, dy = arr[k + 3] - ay, l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + t * dx, qy = ay + t * dy, ex = px - qx, ey = py - qy, d = ex * ex + ey * ey;
    if (d < best) {
      best = d;
      NX = qx;
      NY = qy;
    }
  }
  return best;
}

// A word's density on the fine grid (rho), and for every LED the vector to the
// nearest stroke centre line (vx, vy).
function buildWord(idx) {
  const segs = [0, 1, 2].map((i) => {
    const a = [];
    for (const pl of LET[WORDS[idx][i]])
      for (let k = 0; k + 1 < pl.length; k++)
        a.push(X0 + XW * pl[k][0], TOPS[i] + HW + XW * pl[k][1], X0 + XW * pl[k + 1][0], TOPS[i] + HW + XW * pl[k + 1][1]);
    return Float32Array.from(a);
  });
  const rho = new Float32Array(W2 * H2), vx = new Float32Array(W * H), vy = new Float32Array(W * H);
  for (let y2 = 0; y2 < H2; y2++) {
    const y = (y2 + 0.5) / S2;
    for (let i = 0; i < 3; i++) {
      if (y < TOPS[i] - 6 || y > TOPS[i] + 42) continue;
      for (let x2 = 0; x2 < W2; x2++) {
        const x = (x2 + 0.5) / S2;
        if (x < X0 - HW - 6 || x > X0 + XW + HW + 6) continue;
        const d = sqrt(nearSeg(segs[i], x, y)), t = cl((d - (HW - EDGE)) / (2 * EDGE), 0, 1), v = 1 - t * t * (3 - 2 * t);
        if (v > rho[y2 * W2 + x2]) rho[y2 * W2 + x2] = v;
      }
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let best = 1e18, bx = 0, by = 0;
      for (let i = 0; i < 3; i++) {
        const d = nearSeg(segs[i], x + 0.5, y + 0.5);
        if (d < best) {
          best = d;
          bx = NX;
          by = NY;
        }
      }
      vx[y * W + x] = bx - x - 0.5;
      vy[y * W + x] = by - y - 0.5;
    }
  return { idx, rho, vx, vy };
}

// ---- The relaxation.
const BS = 4, BW = W / BS, BH = H / BS;

function laneOf(y) {
  return y < 41.5 ? 0 : y < 82.5 ? 1 : 2;
}

// Every sample of the swayed density above 0.02, as positions and weights.
function samples(S) {
  const rho = S.word.rho;
  let na = 0, tot = 0;
  for (let y2 = 0; y2 < H2; y2++) {
    const sh = S.dx[laneOf((y2 + 0.5) / S2)] * S2, row = y2 * W2, y = (y2 + 0.5) / S2;
    for (let x2 = 0; x2 < W2; x2++) {
      const s = x2 - sh, i0 = floor(s), f = s - i0;
      const a = i0 >= 0 && i0 < W2 ? rho[row + i0] : 0, b = i0 + 1 >= 0 && i0 + 1 < W2 ? rho[row + i0 + 1] : 0;
      const v = a + (b - a) * f;
      if (v > 0.02) {
        S.ax[na] = (x2 + 0.5) / S2;
        S.ay[na] = y;
        S.aw[na] = v;
        na++;
        tot += v;
      }
    }
  }
  S.na = na;
  S.tot = tot;
}

function sortDots(S) {
  const n = S.n, { px, py, bc, bi, bk } = S;
  bc.fill(0);
  for (let i = 0; i < n; i++) {
    const b = min(BH - 1, floor(py[i] / BS)) * BW + min(BW - 1, floor(px[i] / BS));
    bk[i] = b;
    bc[b + 1]++;
  }
  for (let b = 0; b < BW * BH; b++) bc[b + 1] += bc[b];
  const fill = S.bf;
  for (let b = 0; b < BW * BH; b++) fill[b] = bc[b];
  for (let i = 0; i < n; i++) bi[fill[bk[i]]++] = i;
}

function nearest(S, x, y) {
  const { px, py, bc, bi } = S;
  const bx = min(BW - 1, floor(x / BS)), by = min(BH - 1, floor(y / BS));
  let best = 1e18, who = -1;
  for (let r = 0; r < 40; r++) {
    for (let cy = by - r; cy <= by + r; cy++) {
      if (cy < 0 || cy >= BH) continue;
      const stp = cy === by - r || cy === by + r || r === 0 ? 1 : 2 * r;
      for (let cx = bx - r; cx <= bx + r; cx += stp) {
        if (cx < 0 || cx >= BW) continue;
        const b = cy * BW + cx;
        for (let k = bc[b]; k < bc[b + 1]; k++) {
          const i = bi[k], ex = px[i] - x, ey = py[i] - y, d = ex * ex + ey * ey;
          if (d < best) {
            best = d;
            who = i;
          }
        }
      }
    }
    if (who >= 0 && best <= r * BS * r * BS) break;
  }
  return who;
}

// One Lloyd sweep: every dot moves the fraction w of the way to the centroid
// of the density in its cell. drift also lets a dot with no density to own
// follow the vector to the nearest stroke. Returns nothing; S.mc is the mean
// distance the dots were from their centroids before the step, over the dots
// that own density, and S.owned how many of those there were.
function relax(S, w, dt, drift) {
  samples(S);
  sortDots(S);
  const n = S.n, { px, py, ax, ay, aw, sx, sy, sw } = S;
  sx.fill(0, 0, n);
  sy.fill(0, 0, n);
  sw.fill(0, 0, n);
  for (let k = 0; k < S.na; k++) {
    const i = nearest(S, ax[k], ay[k]), v = aw[k];
    sx[i] += v * ax[k];
    sy[i] += v * ay[k];
    sw[i] += v;
  }
  const avg = S.tot / n, cap = CAP * dt, vxf = S.word.vx, vyf = S.word.vy;
  let mc = 0, owned = 0;
  for (let i = 0; i < n; i++) {
    const m = sw[i], x = px[i], y = py[i];
    let mx = 0, my = 0;
    if (m > 1e-6) {
      mx = sx[i] / m - x;
      my = sy[i] / m - y;
      mc += hypot(mx, my);
      owned++;
      mx *= w;
      my *= w;
    } else {
      mx = (Math.random() - 0.5) * 0.5;
      my = (Math.random() - 0.5) * 0.5;
    }
    const poor = 0.3 * avg;
    if (drift && m < poor) {
      const g = 1 - m / poor, lx = cl(floor(x - S.dx[laneOf(y)]), 0, W - 1), ly = cl(floor(y), 0, H - 1);
      const ux = vxf[ly * W + lx], uy = vyf[ly * W + lx], d = hypot(ux, uy);
      if (d > HW * 0.6) {
        const st = min(g * DRIFT * dt, d - HW * 0.6);
        mx += (ux / d) * st;
        my += (uy / d) * st;
      }
    }
    // Below Relax 1.6 the dots are also shaken a little each frame, the less
    // they relax the more, so a lazy swarm is a ragged one.
    mx += (Math.random() - 0.5) * S.shake * dt * 30;
    my += (Math.random() - 0.5) * S.shake * dt * 30;
    const l = hypot(mx, my);
    if (l > cap) {
      mx *= cap / l;
      my *= cap / l;
    }
    px[i] = cl(x + mx, 0.3, W - 0.3);
    py[i] = cl(y + my, 0.3, H - 0.3);
    S.sp[i] += (hypot(mx, my) / dt - S.sp[i]) * min(1, dt * 8);
  }
  S.mc = owned ? mc / owned : 0;
  S.owned = owned;
}

function addDots(S, count, speed) {
  for (let c = 0; c < count && S.n < MAXN; c++) {
    let k = 0;
    for (let tries = 0; tries < 40; tries++) {
      k = floor(Math.random() * S.na);
      if (Math.random() < S.aw[k]) break;
    }
    const i = S.n++;
    S.px[i] = cl(S.ax[k] + (Math.random() - 0.5) * 0.6, 0.3, W - 0.3);
    S.py[i] = cl(S.ay[k] + (Math.random() - 0.5) * 0.6, 0.3, H - 0.3);
    S.sp[i] = speed;
    S.br[i] = 0.8 + 0.2 * Math.random();
  }
}

function sway(S) {
  for (let i = 0; i < 3; i++) S.dx[i] = S.swayAmp * sin((2 * PI * S.t) / SWAY_T + i * 2.1);
}

export function setup(params) {
  params.s = {
    t: 0, n: 0, na: 0, tot: 0, mc: 0, owned: 0, cur: 0, since: 0, last: -1, rest: 99, swayAmp: SWAY,
    word: null, cache: {}, dx: [0, 0, 0], hue: 0, relax: 2, shake: 0,
    px: new Float32Array(MAXN), py: new Float32Array(MAXN), sp: new Float32Array(MAXN), br: new Float32Array(MAXN),
    sx: new Float32Array(MAXN), sy: new Float32Array(MAXN), sw: new Float32Array(MAXN),
    bc: new Int32Array(BW * BH + 1), bf: new Int32Array(BW * BH), bi: new Int32Array(MAXN), bk: new Int32Array(MAXN),
    ax: new Float32Array(W2 * H2), ay: new Float32Array(W2 * H2), aw: new Float32Array(W2 * H2),
    R: new Float32Array(W * H), G: new Float32Array(W * H), B: new Float32Array(W * H),
  };
}

function wordOf(S, idx) {
  return S.cache[idx] || (S.cache[idx] = buildWord(idx));
}

const dotsOf = (k) => Math.round(400 + 1100 * k ** 0.45);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 1e-4, 0.1);
  S.hue = k[0];
  S.relax = cl(k[1], 0.3, 3);
  S.shake = 0.3 * max(0, 1.6 - S.relax);
  const want = cl(floor(k[2] + 0.5), 0, WORDS.length - 1), target = min(MAXN, round10(dotsOf(cl(k[3], 0, 1))));
  S.t += dt;
  S.since += dt;
  S.rest += dt;
  sway(S);
  if (S.last < 0) {
    // First frame: pour dots over the first word and let them settle a few
    // sweeps before the panel is drawn, so a word already stands.
    S.last = want;
    S.cur = want;
    S.word = wordOf(S, want);
    S.since = 0;
    samples(S);
    addDots(S, target, 0);
    for (let i = 0, n = Math.round(3 + 5 * cl(k[1], 0.3, 3)); i < n; i++) relax(S, 1, 1 / 30, true);
    S.sp.fill(0);
    return;
  }
  if (want !== S.last) {
    // A turn of the knob: the word changes now and is held for 20 s.
    S.last = want;
    S.cur = want;
    S.word = wordOf(S, want);
    S.since = 0;
    S.rest = 0;
  } else if (S.since > (S.rest < HOLD_MANUAL ? HOLD_MANUAL : DUR)) {
    S.cur = (S.cur + 1) % WORDS.length;
    S.word = wordOf(S, S.cur);
    S.since = 0;
  } else if (S.since > DUR * 0.5) {
    // The next word's density is drawn ahead, in a frame of its own.
    wordOf(S, (S.cur + 1) % WORDS.length);
  }
  if (target < S.n - 12) S.n = target;
  else if (target > S.n + 12) {
    samples(S);
    addDots(S, target - S.n, 30);
  }
  const wb = 0.16 * S.relax, wf = wb < 1 ? 1 - (1 - wb) ** (dt * 30) : wb * dt * 30;
  relax(S, wf, dt, true);
}

function round10(v) {
  return Math.round(v / 10) * 10;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.word) return;
  const { R, G, B } = S;
  // Last frame's light fades to half instead of vanishing, so a dot in a hurry
  // leaves a short streak behind it.
  for (let i = 0; i < W * H; i++) {
    R[i] *= 0.5;
    G[i] *= 0.5;
    B[i] *= 0.5;
  }
  for (let i = 0; i < S.n; i++) {
    const x = S.px[i] - 0.5, y = S.py[i] - 0.5, ix = floor(x), iy = floor(y), tx = cl((x - ix - 0.3) / 0.4, 0, 1), ty = cl((y - iy - 0.3) / 0.4, 0, 1);
    const hot = cl((S.sp[i] - 4) / 10, 0, 1);
    const h = S.hue + 0.52 + 0.1 * laneOf(S.py[i]) + 0.06 * (S.py[i] / H);
    const c = tone(h, S.br[i]);
    const r = c[0] + (1 - c[0]) * hot, g = c[1] + (1 - c[1]) * hot, b = c[2] + (1 - c[2]) * hot;
    for (let q = 0; q < 4; q++) {
      const xx = ix + (q & 1), yy = iy + (q >> 1);
      if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
      const wt = min(1, 2.4 * ((q & 1 ? tx : 1 - tx) * (q >> 1 ? ty : 1 - ty))), o = yy * W + xx;
      if (r * wt > R[o]) R[o] = r * wt;
      if (g * wt > G[o]) G[o] = g * wt;
      if (b * wt > B[o]) B[o] = b * wt;
    }
  }
  // Eight pips under the word, the one that is picked bright.
  for (let p = 0; p < WORDS.length; p++) {
    const c = tone(S.hue + 0.52, p === S.cur ? 0.95 : 0.22);
    for (let x = 5 + p * 7; x < 9 + p * 7; x++)
      for (let y = 125; y < 127; y++) {
        const o = y * W + x;
        R[o] = max(R[o], c[0]);
        G[o] = max(G[o], c[1]);
        B[o] = max(B[o], c[2]);
      }
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) {
      const r = R[o], g = G[o], b = B[o];
      if (r + g + b > 0.004) display.setPixel(x, y, min(255, r * 255), min(255, g * 255), min(255, b * 255));
    }
}
