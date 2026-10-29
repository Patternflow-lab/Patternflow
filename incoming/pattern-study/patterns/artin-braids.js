// ===== Patternflow pattern =====
// Title:   Artin Braids
// Family:  topology
// Idea:    A strip at the top holds three to seven coloured points seen from above, and generators of the braid group swap neighbours by half turns about their midpoints, while below it their history scrolls down the panel as a braid, each crossing drawn with the strand that passed in front whole and the one behind broken.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: braid groups (Emil Artin, 1925), the braid group as the fundamental group of the configuration space of n points in the plane (Ralph Fox and Lee Neuwirth, 1962), pattern round 67
// Round:   67
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Strands=3..7, Word=0..4
//
// Knob 1: Hue. Turns the strands' colours round the wheel. Strand k sits 0.8 k / (n - 1) of a turn on from the first, so first and last never meet; at 0 the first is azure, and three strands are azure, rose and yellow-green.
// Knob 2: Speed. A generator takes 1.25 seconds at 2, 12.5 at 0.2 and 0.83 at 3. The braid keeps its shape at any speed; only the scrolling changes.
// Knob 3: Strands. 3 to 7 points. Turning it starts the braid again with every point at home.
// Knob 4: Word. Which braid word plays, round and round, starting again with every point home when it is turned: 0 random generators and inverses; 1 the full twist (s1 s2 ... s(n-1))^n, a pure braid that brings every colour home after n(n-1) crossings; 2 the Borromean braid (s1 s2^-1)^3 on three neighbouring strands, the three moving along; 3 the braid relation as a loop, s1 s2 s1 followed by the inverse of s2 s1 s2, six crossings that are the trivial braid; 4 a random positive braid, every crossing the same hand.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, exp, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The strip is rows 0 to BAND - 1; below it, one row of the space-time
// picture per DT of braid time, the newest at the top.
const BAND = 30, CY = 14.5, ROWS = H - BAND, KEEP = ROWS + 3;
// One generator takes a unit of braid time: the half turn runs over the
// first 0.9 of it, nearly at an even pace, and the points rest for the rest.
// An even turn makes x a cosine of time, so each crossing is a smooth S.
const TURN = 0.9;
const ease = (p) => 0.7 * cl(p, 0, 1) + 0.3 * smooth(p);
// Seconds a generator takes at Speed 2.
const GEN = 1.25;

// 3 by 5 digits for the generator's index, and a minus for an inverse.
const DIGITS = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111"];

// Convention. Seen from above, the strip's lower edge is the side nearer
// the viewer of the braid below, so a point lower in the strip is in front.
// s_i turns the points at places i and i+1 (counted by x) half a turn
// counterclockwise about their midpoint: the left one goes round by the
// lower side, in front, and the right one by the upper side, behind. So in
// s_i the strand moving right crosses over, and in its inverse, turning
// clockwise, under. Places and generators count from 0 in the code and from
// 1 on the panel.

// The next letter of the word, as [place, +1 or -1].
function nextLetter(S) {
  const n = S.n, c = S.c++;
  switch (S.word) {
    case 1: // the full twist, (s1 s2 ... s(n-1))^n
      return [c % (n - 1), 1];
    case 2: { // the Borromean braid (s1 s2^-1)^3 on places j, j+1, j+2
      const j = floor(c / 6) % (n - 2);
      return c % 2 ? [j + 1, -1] : [j, 1];
    }
    case 3: { // s1 s2 s1 s2^-1 s1^-1 s2^-1 on places j, j+1, j+2
      const j = floor(c / 6) % (n - 2), k = c % 6;
      return [j + [0, 1, 0, 1, 0, 1][k], k < 3 ? 1 : -1];
    }
    case 4: // a random positive braid
      return [floor(Math.random() * (n - 1)), 1];
    default: {
      // Random, but never a letter straight after its own inverse.
      let i, s;
      do {
        i = floor(Math.random() * (n - 1));
        s = Math.random() < 0.5 ? 1 : -1;
      } while (S.last && i === S.last[0] && s === -S.last[1]);
      return [i, s];
    }
  }
}

function reset(S, n, word) {
  S.n = n;
  S.word = word;
  S.sp = W / n;
  S.r = S.sp / 2;
  // Rows a generator takes: the crossings keep about the same slope for any
  // number of strands, about 1.7 LEDs across a row at the steepest.
  S.dt = 1 / cl(round(S.sp * 1.15), 11, 26);
  S.perm = Array.from({ length: n }, (_, k) => k);
  S.c = 0;
  S.last = null;
  S.g0 = 0;
  S.gen = nextLetter(S);
  S.home = 0;
  // Samples of every strand's x and depth, KEEP of them in a ring.
  S.hx = new Float32Array(KEEP * n);
  S.hz = new Float32Array(KEEP * n);
  S.k = 0;
  S.t = 0;
  // Pre-fill: run the braid until the picture reaches the bottom.
  while (S.k < KEEP) push(S);
  S.t = (S.k - 1) * S.dt;
  S.nowX = new Float32Array(n);
  S.nowZ = new Float32Array(n);
}

const placeX = (S, k) => (k + 0.5) * S.sp;

// Move the braid on to time t, finishing generators on the way.
function advance(S, t) {
  while (t >= S.g0 + 1) {
    const [i] = S.gen;
    const p = S.perm;
    [p[i], p[i + 1]] = [p[i + 1], p[i]];
    S.last = S.gen;
    S.g0 += 1;
    S.gen = nextLetter(S);
    if (p.every((s, k) => s === k)) S.home = 1;
  }
}

// Each strand's x and depth at time t (after advance).
function state(S, t, X, Z) {
  const { n, perm, gen, r } = S;
  for (let k = 0; k < n; k++) {
    X[perm[k]] = placeX(S, k);
    Z[perm[k]] = 0;
  }
  const [i, s] = gen;
  const th = PI * ease((t - S.g0) / TURN);
  const m = (placeX(S, i) + placeX(S, i + 1)) / 2;
  const a = perm[i], b = perm[i + 1];
  X[a] = m - r * cos(th);
  X[b] = m + r * cos(th);
  // Depth is how far below the strip's middle line a point is.
  Z[a] = s * r * sin(th);
  Z[b] = -s * r * sin(th);
}

function push(S) {
  const t = S.k * S.dt, o = (S.k % KEEP) * S.n;
  advance(S, t);
  state(S, t, S.hx.subarray(o, o + S.n), S.hz.subarray(o, o + S.n));
  S.k++;
}

export function setup(params) {
  params.s = { n: 0, word: -1, rowZ: new Float32Array(W), rowS: new Int8Array(W), rowA: new Float32Array(W), px: new Float32Array(8), pz: new Float32Array(8), qx: new Float32Array(8), qz: new Float32Array(8) };
}

export function update(dt, input, params) {
  const S = params.s;
  const k = input.knobValues || [0, 2, 3, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  const n = cl(round(k[2]), 3, 7), word = cl(round(k[3]), 0, 4);
  if (n !== S.n || word !== S.word) reset(S, n, word);
  S.t += (dt * cl(k[1], 0.05, 3)) / 2 / GEN;
  while (S.k * S.dt <= S.t) push(S);
  advance(S, S.t);
  state(S, S.t, S.nowX, S.nowZ);
  S.home = max(0, S.home - dt * 1.2);
}

function setDisc(display, cx, cy, rad, rgb, lv) {
  for (let y = max(0, floor(cy - rad - 1)); y <= min(BAND - 1, floor(cy + rad + 1)); y++)
    for (let x = max(0, floor(cx - rad - 1)); x <= min(W - 1, floor(cx + rad + 1)); x++) {
      const d = sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2);
      const a = cl(rad - d + 0.5, 0, 1);
      if (a <= 0) continue;
      // A little white in the middle, like a bead lit from above.
      const w = 0.45 * max(0, 1 - d / (rad * 0.7));
      const v = a * lv;
      display.setPixel(x, y, (rgb[0] * (1 - w) + w) * v * 255, (rgb[1] * (1 - w) + w) * v * 255, (rgb[2] * (1 - w) + w) * v * 255);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S.n) return;
  const { n, sp, r, dt, rowZ, rowS, rowA } = S;
  const cols = [];
  for (let s = 0; s < n; s++) cols.push(hsv(0.55 + S.hue + (0.8 * s) / (n - 1), 0.78, 1));

  // ---- The space-time picture. Row y shows the braid u = y + 0.5 - BAND
  // rows ago. The newest sample sits frac of a row below the strip.
  const last = S.k - 1, frac = (S.t - last * dt) / dt;
  const hw = 0.15 * sp, gw = 0.07 * sp + 0.8, eps = 0.2 * r;
  const { px, pz, qx, qz } = S;
  for (let y = BAND; y < H; y++) {
    const u = y + 0.5 - BAND, mm = u - frac;
    let w;
    if (mm < 0) {
      // Between now and the newest sample.
      const o = (last % KEEP) * n;
      for (let s = 0; s < n; s++) (px[s] = S.nowX[s]), (pz[s] = S.nowZ[s]), (qx[s] = S.hx[o + s]), (qz[s] = S.hz[o + s]);
      w = (mm + frac) / max(frac, 1e-6);
    } else {
      const j = floor(mm);
      if (last - j - 1 < 0) break;
      const o0 = ((last - j) % KEEP) * n, o1 = ((last - j - 1) % KEEP) * n;
      for (let s = 0; s < n; s++) (px[s] = S.hx[o0 + s]), (pz[s] = S.hz[o0 + s]), (qx[s] = S.hx[o1 + s]), (qz[s] = S.hz[o1 + s]);
      w = mm - j;
    }
    rowS.fill(-1);
    for (let s = 0; s < n; s++) {
      const xc = px[s] + (qx[s] - px[s]) * w, z = pz[s] + (qz[s] - pz[s]) * w;
      // Across a sloped strand a row cuts a wider piece.
      const sec = sqrt(1 + (qx[s] - px[s]) ** 2);
      const reach = (hw + gw) * sec + 1;
      for (let x = max(0, floor(xc - reach)); x <= min(W - 1, floor(xc + reach)); x++) {
        const d = abs(x + 0.5 - xc) / sec;
        if (d >= hw + gw) continue;
        const a = cl(hw - d + 0.5, 0, 1) * (1 - 0.4 * (d / hw) ** 2);
        const held = rowS[x];
        if (held < 0 || (held !== s && z > rowZ[x] + eps)) {
          // In front: its core, or the dark gap round it, covers what is behind.
          rowS[x] = s;
          rowZ[x] = z;
          rowA[x] = max(0, a);
        } else if (held === s) rowA[x] = max(rowA[x], a);
        else if (z >= rowZ[x] - eps && a > rowA[x]) {
          // Level with it: the brighter wins, and no gap is cut.
          rowS[x] = s;
          rowZ[x] = z;
          rowA[x] = a;
        }
      }
    }
    // Older rows dim a little, and a strand behind is a little darker.
    const fade = 1 - (0.4 * u) / ROWS;
    for (let x = 0; x < W; x++) {
      const s = rowS[x];
      if (s < 0 || rowA[x] <= 0) continue;
      const v = rowA[x] * fade * (0.86 + (0.14 * rowZ[x]) / r);
      const c = cols[s];
      display.setPixel(x, y, c[0] * v * 255, c[1] * v * 255, c[2] * v * 255);
    }
  }

  // ---- The strip. A faint floor, the home of each colour as a tick on the
  // near edge (bright when its own strand stands on it), and a flash of the
  // edges when every strand is home.
  const home = S.home;
  for (let x = 0; x < W; x++) {
    const e = 34 + 150 * home;
    display.setPixel(x, 0, e, e, e * 1.1);
    display.setPixel(x, BAND - 1, e, e, e * 1.1);
    for (let y = 1; y < BAND - 1; y++) display.setPixel(x, y, 5, 6, 12);
  }
  for (let k = 0; k < n; k++) {
    const c = cols[k], x0 = placeX(S, k), lv = S.perm[k] === k ? 0.9 : 0.3;
    for (let x = floor(x0 - 2); x < x0 + 2; x++) display.setPixel(x, BAND - 2, c[0] * lv * 255, c[1] * lv * 255, c[2] * lv * 255);
  }
  // The circle the turning pair runs on, while it turns.
  const [gi, gs] = S.gen, p = (S.t - S.g0) / TURN;
  if (p < 1) {
    const m = (placeX(S, gi) + placeX(S, gi + 1)) / 2, lv = 70 * sin(PI * cl(p, 0, 1)) ** 0.5;
    for (let y = 1; y < BAND - 1; y++)
      for (let x = max(0, floor(m - r - 1)); x <= min(W - 1, floor(m + r + 1)); x++) {
        const d = abs(sqrt((x + 0.5 - m) ** 2 + (y + 0.5 - CY) ** 2) - r);
        if (d < 0.7) display.setPixel(x, y, lv, lv, lv * 1.15);
      }
  }
  // The points.
  const pr = cl(0.3 * sp, 2.3, 3.6);
  for (let s = 0; s < n; s++) setDisc(display, S.nowX[s], CY + S.nowZ[s], pr, cols[s], 1);
  // The generator playing, as its index with a minus for an inverse.
  const dg = DIGITS[gi + 1] || DIGITS[0];
  for (let b = 0; b < 15; b++) if (dg[b] === "1") display.setPixel(5 + (b % 3), 2 + floor(b / 3), 150, 150, 165);
  if (gs < 0) for (let x = 1; x < 4; x++) display.setPixel(x, 4, 150, 150, 165);
}
