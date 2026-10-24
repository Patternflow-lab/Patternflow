// ===== Patternflow pattern =====
// Title:   Cat Map
// Family:  noise
// Idea:    The panel is a torus and a bold target of rings is carried by Arnold's cat map, built from two shears that slide the rows and then the columns, so the picture stretches into diagonal stripes, dissolves into what looks like pure static, passes a ghost of itself halfway, and after the map's period comes back exactly.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Arnold's cat map (Vladimir Arnold, 1967), pattern round 31
// Round:   31
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Twist=1..4, Picture=0..3
//
// Knob 1: Hue. Turns the picture's colours round the wheel; at 0 the rings are cyan and rose round a cream disc.
// Knob 2: Speed. At 2 the picture holds whole for a second and a half, a step through static takes about a quarter of a second, the last step into the return about three, and the whole period at Twist 1 takes 30 s; at 0.2 everything takes ten times as long.
// Knob 3: Twist. The shears' size a = b = 1, 2, 3 or 4, where row y slides by a times y and column x by 2b times x; the period is 64, 32, 64 and 16 steps.
// Knob 4: Picture. The image the map carries: rings crossed by a diagonal band, nested diamonds, four quarters round a disc, or twelve rays.
// Buttons: K1 tap jumps to four steps before the return, so the picture can be watched re-forming out of the static.

const W = 64, H = 128, N = W * H;
const { min, max, floor, abs, sqrt, atan2, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mod = (v, m) => ((v % m) + m) % m;

// One full step of the map on a permutation: perm[p] is the source LED whose
// colour now sits at p. The first shear moves what sits at (x, y) to
// (x + a y, y), the second moves (x, y) to (x, y + 2b x), so together
// (x, y) -> (x + a y, 2b x + (1 + 2ab) y), determinant 1, exact on Z64 x Z128.
function shearRows(a, from, to) {
  for (let y = 0; y < H; y++) {
    const s = mod(a * y, W), o = y * W;
    for (let x = 0; x < W; x++) to[o + x] = from[o + ((x - s + W) & 63)];
  }
}
function shearCols(b, from, to) {
  for (let x = 0; x < W; x++) {
    const s = mod(2 * b * x, H);
    for (let y = 0; y < H; y++) to[y * W + x] = from[((y - s + H) & 127) * W + x];
  }
}

// The four pictures as region numbers: 0 and 1 are the two main colours, 2
// the light one. Each fills the whole panel.
const REG = [];
{
  for (let k = 0; k < 4; k++) REG.push(new Uint8Array(N));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, dx = x - 31.5, dy = y - 63.5, r = sqrt(dx * dx + dy * dy);
      // Rings 7 LEDs wide round a disc, and a band corner to corner where
      // the two ring colours trade places.
      let g = r < 9 ? 2 : floor((r - 9) / 7) & 1;
      if (g < 2 && abs(2 * dx + dy) / sqrt(5) < 6) g = 1 - g;
      REG[0][p] = g;
      // Nested diamonds, 8 LEDs a band down the long axis, a light core.
      const dd = abs(dx) + abs(dy) / 2;
      REG[1][p] = dd < 7 ? 2 : floor((dd - 7) / 6) & 1;
      // Four quarters round a disc that swaps them, with a light rim.
      const q = (dx < 0) !== (dy < 0) ? 1 : 0;
      REG[2][p] = r < 21 ? 1 - q : r < 25 ? 2 : q;
      // Twelve rays round a light disc and a light ring.
      const ray = floor(((atan2(dy, dx) + PI) / (2 * PI)) * 12) & 1;
      REG[3][p] = r < 8 || (r > 30 && r < 34) ? 2 : ray;
    }
}

// How much of the picture survives after n steps of each twist, from the
// rings picture: 0 for the whole picture, about 0.5 for static. It slows the
// steps and holds the frames where something can be seen.
function survey(t) {
  let perm = new Int32Array(N), mid = new Int32Array(N), nxt = new Int32Array(N);
  for (let i = 0; i < N; i++) perm[i] = i;
  const g = REG[0], out = [0];
  for (let n = 1; n <= 200; n++) {
    shearRows(t, perm, mid);
    shearCols(t, mid, nxt);
    [perm, nxt] = [nxt, perm];
    let d = 0, id = true;
    for (let p = 0; p < N; p++) {
      const v = g[perm[p]] & 1;
      if ((p & 63) < 63) d += v !== (g[perm[p + 1]] & 1) ? 1 : 0;
      if (p < N - W) d += v !== (g[perm[p + W]] & 1) ? 1 : 0;
      if (perm[p] !== p) id = false;
    }
    if (id) break;
    out.push(d / (2 * N));
  }
  // out has one entry per state 0..P-1.
  return out.map((v) => 1 - cl((v - 0.1) / 0.3, 0, 1));
}
const SURVEY = [null, null, null, null, null];

function hsv(h, s, v, out, o) {
  const f = (n) => {
    const k = (n + (h - floor(h)) * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  out[o] = f(5) * 255;
  out[o + 1] = f(3) * 255;
  out[o + 2] = f(1) * 255;
}

export function setup(params) {
  const I = () => new Int32Array(N);
  params.s = {
    perm: I(), mid: I(), nxt: I(), twist: 0, P: 64, st: null, n: 0, mode: 0, t: 0, first: true,
    hue: -1, pic: -1, pal: new Float32Array(9), src: new Float32Array(N * 3), sh1: new Int32Array(H), sh2: new Int32Array(W), sp: 2,
  };
}

function reset(S) {
  for (let i = 0; i < N; i++) S.perm[i] = i;
  S.n = 0;
  S.mode = 0;
  S.t = 0;
}

// Seconds for the step out of state n, and for the hold at state n.
function stepTime(S, n) {
  const st = S.st, P = S.P, base = 1.2 / S.sp;
  const s = max(st[n], st[(n + 1) % P]);
  return base * (0.45 + 1.6 * s) * (1 + 1.5 * Math.exp(-(P - 1 - n) / 1.5));
}
function holdTime(S, n) {
  const base = 1.2 / S.sp, s = S.st[n];
  if (n === 0) return base * (S.first ? 2.3 : 4);
  // The stretched stripes after one step and the ghost halfway hold for
  // about half a second at Speed 2; frames of static do not hold at all.
  return base * 3 * s * sqrt(s);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.sp = cl(k[1], 0.2, 3);
  S.hueK = k[0] || 0;
  S.picK = cl(round(k[3]), 0, 3);
  const tw = cl(round(k[2]), 1, 4);
  if (tw !== S.twist) {
    // A new twist is a new map: the picture comes back whole and starts over.
    S.twist = tw;
    S.st = SURVEY[tw] || (SURVEY[tw] = survey(tw));
    S.P = S.st.length;
    for (let y = 0; y < H; y++) S.sh1[y] = tw * (y - 64);
    for (let x = 0; x < W; x++) S.sh2[x] = mod(2 * tw * x + 64, H) - 64;
    reset(S);
  }
  const b = input.btnPressed || [];
  if (b[0]) {
    // Four steps short of the return, by running the map from the picture.
    reset(S);
    for (let n = 0; n < S.P - 4; n++) {
      shearRows(tw, S.perm, S.mid);
      shearCols(tw, S.mid, S.perm);
    }
    S.n = S.P - 4;
    S.first = false;
  }
  S.t += d;
  if (S.mode === 0) {
    if (S.t >= holdTime(S, S.n)) {
      S.t = 0;
      S.mode = 1;
      shearRows(tw, S.perm, S.mid);
    }
  } else if (S.t >= stepTime(S, S.n)) {
    shearCols(tw, S.mid, S.nxt);
    [S.perm, S.nxt] = [S.nxt, S.perm];
    S.n = (S.n + 1) % S.P;
    if (S.n === 0) {
      reset(S);
      S.first = false;
    }
    S.t = 0;
    S.mode = 0;
  }
}

// Three colours: two strong ones half a turn apart and a light cream, the
// strong pair kept close in brightness so the static stays soft.
function paint(S) {
  const h = S.hueK + 0.5, pal = S.pal;
  hsv(h, 0.66, 1, pal, 0);
  // A dark orange or yellow reads brown or olive, so the second colour
  // lifts its light where its hue passes through them.
  let h2 = h + 0.4;
  h2 -= floor(h2);
  hsv(h2, 0.6, 0.72 + 0.26 * max(0, 1 - abs(h2 - 0.13) / 0.11), pal, 3);
  hsv(h + 0.62, 0.2, 1, pal, 6);
  const g = REG[S.picK], src = S.src;
  for (let p = 0; p < N; p++) {
    const c = g[p] * 3;
    src[p * 3] = pal[c];
    src[p * 3 + 1] = pal[c + 1];
    src[p * 3 + 2] = pal[c + 2];
  }
  S.hue = S.hueK;
  S.pic = S.picK;
}

const ease = (u) => u * u * (3 - 2 * u);

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.st) return;
  if (S.hue !== S.hueK || S.pic !== S.picK) paint(S);
  const src = S.src;
  if (S.mode === 0) {
    const perm = S.perm;
    for (let y = 0, p = 0; y < H; y++)
      for (let x = 0; x < W; x++, p++) {
        const o = perm[p] * 3;
        display.setPixel(x, y, src[o], src[o + 1], src[o + 2]);
      }
    return;
  }
  const u = S.t / stepTime(S, S.n);
  if (u < 0.5) {
    // The rows slide: row y by a (y - 64), pivoting on the middle row, so the
    // picture leans; each LED reads between the two it lies between.
    const s = ease(u * 2), perm = S.perm;
    for (let y = 0; y < H; y++) {
      const sh = s * S.sh1[y], o = y * W;
      for (let x = 0; x < W; x++) {
        const pos = x - sh, i0 = floor(pos), f = pos - i0;
        const A = perm[o + (i0 & 63)] * 3, B = perm[o + ((i0 + 1) & 63)] * 3;
        display.setPixel(x, y, src[A] + (src[B] - src[A]) * f, src[A + 1] + (src[B + 1] - src[A + 1]) * f, src[A + 2] + (src[B + 2] - src[A + 2]) * f);
      }
    }
  } else {
    // The columns slide: column x by 2b x, wrapped to the nearer way round.
    const s = ease(u * 2 - 1), mid = S.mid;
    for (let x = 0; x < W; x++) {
      const sh = s * S.sh2[x];
      for (let y = 0; y < H; y++) {
        const pos = y - sh, i0 = floor(pos), f = pos - i0;
        const A = mid[(i0 & 127) * W + x] * 3, B = mid[((i0 + 1) & 127) * W + x] * 3;
        display.setPixel(x, y, src[A] + (src[B] - src[A]) * f, src[A + 1] + (src[B + 1] - src[A + 1]) * f, src[A + 2] + (src[B + 2] - src[A + 2]) * f);
      }
    }
  }
}
