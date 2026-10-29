// ===== Patternflow pattern =====
// Title:   Nine-fold Seal
// Family:  type
// Idea:    A tall vermilion seal impression of eight Hangul syllables, read down the right column and then the left, folds every horizontal stroke back and forth into serpentines of one-LED lines until each syllable's box is full, as the nine-fold seal script of official seals did, and every few seconds it unfolds to plain letters and refolds into the next text.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: jiudie zhuan (九疊篆), the nine-fold seal script of official seals from the Song dynasty on and of Joseon official seals, applied to Hangul; texts: the heading of the Hangul Hunminjeongeum in Worin seokbo (1459), its gloss "the right sounds that teach", and two old wishes for long life; pattern round 69
// Round:   69
// ===============================
// @matrix 64x128
// @knobs Ink=0..1, Speed=0.2..3, Plain=0..1, Press=0..1
//
// Knob 1: Ink. Turns the ink round the colour wheel at a fixed brightness. At 0 it is seal vermilion, at 0.5 a blue-green, and the paper stays a warm grey.
// Knob 2: Speed. At 2 a text holds folded for 3.6 s and the whole change, unfold, swap and refold, takes 4 s more; 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Plain. How far the strokes may fold: 0 folds them until every box is full, 0.5 lets them fold seven lines deep, 1 shows the plain letters.
// Knob 4: Press. How unevenly the seal is pressed. The pressure rocks round the seal once in 6 s, and the side it leaves prints with bare patches: almost none at 0, up to three quarters of the ink missing in the far corner at 1.
// Buttons: any button starts the change to the next text at once.

const W = 64, H = 128;
const { floor, round, ceil, min, max, abs, cos, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The seal. A border two LEDs thick runs round the panel's edge, a
// divider two thick splits it into two columns, and every box is 27 by 29
// LEDs. Strokes lie on a lattice of nodes two LEDs apart, 14 across and 15
// down a box, so any two strokes that do not join keep one LED of paper
// between them. That one-LED rhythm of ink and paper is the whole look of
// the nine-fold script.
const NI = 14, NJ = 15, N = NI * NJ;
// The right column is read first, top to bottom, then the left.
const COLX = [34, 3], ROWY = [3, 34, 65, 96];

const TEXTS = ["세종어제훈민정음", "가르치는바른소리", "만수무강하옵소서", "천년만년살고지고"];

// Jamo as strokes [u0, v0, u1, v1] in their region, 0 to 1, every stroke
// level or upright, as seal script draws them. A fifth number marks a
// ring: ㅇ is a ring with its corners cut, so it never reads as ㅁ.
// Initials by their Unicode index; finals are looked up through FIN.
const CONS = {
  0: [[0, 0, 1, 0], [1, 0, 1, 1]], // ㄱ
  2: [[0, 0, 0, 1], [0, 1, 1, 1]], // ㄴ
  3: [[0, 0, 1, 0], [0, 0, 0, 1], [0, 1, 1, 1]], // ㄷ
  5: [[0, 0, 1, 0], [1, 0, 1, 0.5], [0, 0.5, 1, 0.5], [0, 0.5, 0, 1], [0, 1, 1, 1]], // ㄹ
  6: [[0, 0, 1, 0], [0, 0, 0, 1], [1, 0, 1, 1], [0, 1, 1, 1]], // ㅁ
  7: [[0, 0, 0, 1], [1, 0, 1, 1], [0, 0.5, 1, 0.5], [0, 1, 1, 1]], // ㅂ
  // ㅅ squared off the way seal script squares 人: a stem and two legs
  // that step outward twice.
  9: [[0.5, 0, 0.5, 0.3], [0.25, 0.3, 0.75, 0.3], [0.25, 0.3, 0.25, 0.65], [0.75, 0.3, 0.75, 0.65], [0, 0.65, 0.25, 0.65], [0.75, 0.65, 1, 0.65], [0, 0.65, 0, 1], [1, 0.65, 1, 1]], // ㅅ
  11: [[0.1, 0, 0.9, 1, 1]], // ㅇ
  12: [[0, 0, 1, 0], [0.5, 0, 0.5, 0.3], [0.25, 0.3, 0.75, 0.3], [0.25, 0.3, 0.25, 0.65], [0.75, 0.3, 0.75, 0.65], [0, 0.65, 0.25, 0.65], [0.75, 0.65, 1, 0.65], [0, 0.65, 0, 1], [1, 0.65, 1, 1]], // ㅈ
  14: [[0.3, 0, 0.7, 0], [0, 0.22, 1, 0.22], [0.5, 0.22, 0.5, 0.45], [0.25, 0.45, 0.75, 0.45], [0.25, 0.45, 0.25, 0.72], [0.75, 0.45, 0.75, 0.72], [0, 0.72, 0.25, 0.72], [0.75, 0.72, 1, 0.72], [0, 0.72, 0, 1], [1, 0.72, 1, 1]], // ㅊ
  18: [[0.3, 0, 0.7, 0], [0, 0.25, 1, 0.25], [0.15, 0.5, 0.85, 1, 1]], // ㅎ
};
const FIN = { 1: 0, 4: 2, 7: 3, 8: 5, 16: 6, 17: 7, 19: 9, 21: 11, 22: 12, 23: 14, 27: 18 };
const VOW = {
  0: [[0, 0, 0, 1], [0, 0.5, 0.75, 0.5]], // ㅏ
  4: [[0.25, 0.5, 1, 0.5], [1, 0, 1, 1]], // ㅓ
  5: [[0, 0.5, 0.4, 0.5], [0.4, 0, 0.4, 1], [1, 0, 1, 1]], // ㅔ
  6: [[0.25, 0.33, 1, 0.33], [0.25, 0.67, 1, 0.67], [1, 0, 1, 1]], // ㅕ
  8: [[0.5, 0, 0.5, 1], [0, 1, 1, 1]], // ㅗ
  13: [[0, 0, 1, 0], [0.5, 0, 0.5, 1]], // ㅜ
  18: [[0, 0.5, 1, 0.5]], // ㅡ
  20: [[0.5, 0, 0.5, 1]], // ㅣ
};

// Regions [i0, j0, i1, j1] in nodes for the initial, the vowel and the final.
function regions(V, T) {
  if (V === 0 || V === 4 || V === 5 || V === 6 || V === 20) {
    const wide = V === 5, ic = wide ? 6 : 7, iv = wide ? 8 : 9;
    return T ? [[0, 0, ic, 7], [iv, 0, 13, 8], [1, 10, 12, 14]] : [[0, 1, ic, 13], [iv, 0, 13, 14], null];
  }
  return T ? [[1, 0, 12, 4], [0, 6, 13, 8], [1, 10, 12, 14]] : [[1, 0, 12, 7], [0, 9, 13, 13], null];
}

// One syllable: its plain strokes in LEDs, the corner LEDs of its rings, and
// the fold runs. Folding gives every free node of the box to the nearest
// level stroke straight above or below it, and the nodes a stroke gets lie
// in rows 1, 2, 3 ... away from it. Each run of such nodes hangs from the row
// before at one end, the right end and the left end taking turns, so the
// stroke becomes one ribbon folded back and forth. Nodes no level stroke can
// reach, beside an upright with nothing level over it, go the same way to
// the nearest upright stroke left or right of them.
function build(ch) {
  const c = ch.charCodeAt(0) - 0xac00;
  const L = floor(c / 588), V = floor(c / 28) % 21, T = c % 28;
  const reg = regions(V, T);
  const strokes = [], corners = [];
  const busy = new Uint8Array(N), hOwn = new Int16Array(N).fill(-1), vOwn = new Int16Array(N).fill(-1);
  const add = (shape, r) => {
    if (!shape || !r) return;
    const [a, b, c2, d] = r;
    const mi = (u) => a + round(u * (c2 - a)), mj = (v) => b + round(v * (d - b));
    for (const s of shape) {
      const i0 = mi(s[0]), j0 = mj(s[1]), i1 = mi(s[2]), j1 = mj(s[3]);
      if (s[4]) {
        strokes.push({ o: 1, i0: i0 + 1, j0, i1: i1 - 1, j1: j0 });
        strokes.push({ o: 0, i0, j0: j0 + 1, i1: i0, j1: j1 - 1 });
        strokes.push({ o: 0, i0: i1, j0: j0 + 1, i1, j1: j1 - 1 });
        strokes.push({ o: 1, i0: i0 + 1, j0: j1, i1: i1 - 1, j1 });
        for (const [ci, cj, dx, dy] of [[i0, j0, 1, 1], [i1, j0, -1, 1], [i0, j1, 1, -1], [i1, j1, -1, -1]]) {
          busy[ci + cj * NI] = 2;
          corners.push(2 * ci + dx, 2 * cj + dy);
        }
      } else strokes.push({ o: j0 === j1 ? 1 : 0, i0: min(i0, i1), j0: min(j0, j1), i1: max(i0, i1), j1: max(j0, j1) });
    }
  };
  add(CONS[L], reg[0]);
  add(VOW[V], reg[1]);
  if (T) add(CONS[FIN[T]], reg[2]);
  strokes.forEach((s, k) => {
    for (let j = s.j0; j <= s.j1; j++)
      for (let i = s.i0; i <= s.i1; i++) {
        busy[i + j * NI] = 1;
        if (s.o) hOwn[i + j * NI] = k;
        else vOwn[i + j * NI] = k;
      }
  });

  // Claims: stroke, side (+1 below or right of it, -1 above or left) and
  // distance, first for the level strokes, then for the upright ones.
  const own = new Int16Array(N).fill(-1), side = new Int8Array(N), dist = new Int8Array(N), kind = new Uint8Array(N);
  for (let n = 0; n < N; n++) {
    if (busy[n]) continue;
    const i = n % NI, j = floor(n / NI);
    let bd = 99;
    for (let jj = j - 1; jj >= 0; jj--) {
      const m = i + jj * NI;
      if (!busy[m]) continue;
      if (busy[m] === 1 && hOwn[m] >= 0) (own[n] = hOwn[m]), (side[n] = 1), (bd = dist[n] = j - jj);
      break;
    }
    for (let jj = j + 1; jj < NJ; jj++) {
      const m = i + jj * NI;
      if (!busy[m]) continue;
      if (busy[m] === 1 && hOwn[m] >= 0 && jj - j < bd) (own[n] = hOwn[m]), (side[n] = -1), (dist[n] = jj - j);
      break;
    }
    if (own[n] >= 0) kind[n] = 1;
  }
  for (let n = 0; n < N; n++) if (kind[n]) busy[n] = 3;
  for (let n = 0; n < N; n++) {
    if (busy[n]) continue;
    const i = n % NI, j = floor(n / NI);
    let bd = 99;
    for (let ii = i - 1; ii >= 0; ii--) {
      const m = ii + j * NI;
      if (!busy[m]) continue;
      if (busy[m] === 1 && vOwn[m] >= 0) (own[n] = vOwn[m]), (side[n] = 1), (bd = dist[n] = i - ii);
      break;
    }
    for (let ii = i + 1; ii < NI; ii++) {
      const m = ii + j * NI;
      if (!busy[m]) continue;
      if (busy[m] === 1 && vOwn[m] >= 0 && ii - i < bd) (own[n] = vOwn[m]), (side[n] = -1), (dist[n] = ii - i);
      break;
    }
    if (own[n] >= 0) kind[n] = 2;
  }

  // Runs: [level, connector x, y, start x, y, end x, y], all in LEDs.
  const runs = [];
  let deepest = 0;
  for (let n = 0; n < N; n++) {
    if (!kind[n]) continue;
    const i = n % NI, j = floor(n / NI), lv = dist[n], sd = side[n], k = own[n], hz = kind[n] === 1;
    // Only the first node of a run starts it.
    const pi = hz ? i - 1 : i, pj = hz ? j : j - 1;
    if (pi >= 0 && pj >= 0) {
      const m = pi + pj * NI;
      if (kind[m] === kind[n] && own[m] === k && side[m] === sd && dist[m] === lv) continue;
    }
    let e = hz ? i : j;
    for (;;) {
      const m = hz ? e + 1 + j * NI : i + (e + 1) * NI;
      if ((hz ? e + 1 >= NI : e + 1 >= NJ) || kind[m] !== kind[n] || own[m] !== k || side[m] !== sd || dist[m] !== lv) break;
      e++;
    }
    const lo = hz ? i : j;
    // The turn falls at the far end and the near end in turn, row by row.
    const atHi = (lv + (sd > 0 ? 1 : 0)) % 2 === 0;
    const cA = atHi ? e : lo, cB = atHi ? lo : e;
    if (hz) runs.push(lv, 2 * cA, 2 * j - sd, 2 * cA, 2 * j, 2 * cB, 2 * j);
    else runs.push(lv, 2 * i - sd, 2 * cA, 2 * i, 2 * cA, 2 * i, 2 * cB);
    deepest = max(deepest, lv);
  }
  const plain = [];
  for (const s of strokes) plain.push(2 * s.i0, 2 * s.j0, 2 * s.i1, 2 * s.j1);
  return { plain, corners, runs: Int16Array.from(runs), deepest };
}

// Seconds at Speed 2: the hold, the fold rate in rows a second, the lag of
// each syllable behind the one before it, in rows, and the swap.
const HOLD = 3, RATE = 14, STAG = 0.8, FOLD = (NJ + 7 * STAG) / RATE, SWAP = 1;
// Ink and paper levels, and how far the two dimmer channels wander per LED
// (times -128..127). The brightest channel wanders by 3 at most, so two
// neighbours of one kind never differ by more than 6.
const INK_V = 214, PAPER = [58, 40, 32], MOTTLE = 0.45, GRAIN = 0.24;

function impression(S) {
  // A new impression: the paper grain and the ink's mottle per LED, and the
  // patches where ink fails to take, coarse blots with a fine speckle in them.
  for (let p = 0; p < W * H * 3; p++) S.grain[p] = floor(Math.random() * 256);
  const GW = 24, GH = 46, g = new Float32Array(GW * GH);
  for (let q = 0; q < g.length; q++) g[q] = Math.random();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const gx = x / 3, gy = y / 3, ix = floor(gx), iy = floor(gy), fx = gx - ix, fy = gy - iy;
      const a = g[ix + iy * GW], b = g[ix + 1 + iy * GW], c = g[ix + (iy + 1) * GW], d = g[ix + 1 + (iy + 1) * GW];
      const v = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
      S.blot[y * W + x] = 0.6 * v + 0.4 * Math.random();
    }
  // Spread the blot values evenly over 0..1 by rank, so Press means the
  // share of ink that fails.
  const order = Array.from(S.blot, (v, p) => p).sort((a, b) => S.blot[a] - S.blot[b]);
  for (let r = 0; r < order.length; r++) S.rank[order[r]] = r / order.length;
}

export function setup(params) {
  const S = (params.s = { ink: new Uint8Array(W * H), grain: new Uint8Array(W * H * 3), blot: new Float32Array(W * H), rank: new Float32Array(W * H) });
  S.glyphs = TEXTS.map((t) => Array.from(t, build));
  S.text = 0;
  S.ph = 0;
  // The first text holds 2.4 s, so the first change comes soon.
  S.pt = HOLD - 2.4;
  S.tau = 0;
  S.hue = 0;
  S.plain = 0;
  S.press = 0.06;
  S.F = new Float32Array(8);
  S.q = 1;
  impression(S);
}

export function update(dt, input, params) {
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  const sp = cl(k[1], 0.05, 3) / 2;
  S.hue = k[0];
  S.plain = cl(k[2], 0, 1);
  S.press = cl(k[3], 0, 1);
  S.tau += dt * sp;
  S.pt += dt * sp;
  if (S.ph === 0 && input.btnPressed && input.btnPressed.some(Boolean)) S.pt = HOLD;
  if (S.ph === 0 && S.pt >= HOLD) (S.ph = 1), (S.pt = 0);
  if (S.ph === 1 && S.pt >= FOLD) (S.ph = 2), (S.pt = 0);
  if (S.ph === 2 && S.pt >= SWAP / 2 && !S.swapped) {
    S.text = (S.text + 1) % TEXTS.length;
    S.swapped = 1;
    impression(S);
  }
  if (S.ph === 2 && S.pt >= SWAP) (S.ph = 3), (S.pt = 0), (S.swapped = 0);
  if (S.ph === 3 && S.pt >= FOLD) (S.ph = 0), (S.pt = 0);
  const u = S.pt * RATE, cap = (1 - S.plain) * NJ;
  for (let i = 0; i < 8; i++) {
    let f = NJ;
    if (S.ph === 1) f = NJ - max(0, u - i * STAG);
    else if (S.ph === 2) f = 0;
    else if (S.ph === 3) f = max(0, u - i * STAG);
    S.F[i] = min(cl(f, 0, NJ), cap);
  }
  S.q = S.ph === 2 ? abs(1 - (2 * S.pt) / SWAP) : 1;
}

function line(ink, x0, y0, x1, y1, count) {
  const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
  for (let s = 0; s < count; s++) {
    const x = x0 + dx * s, y = y0 + dy * s;
    ink[y * W + x] = 1;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S.glyphs) return;
  const ink = S.ink;
  ink.fill(0);
  for (let x = 0; x < W; x++) ink[x] = ink[W + x] = ink[(H - 2) * W + x] = ink[(H - 1) * W + x] = 1;
  for (let y = 0; y < H; y++) ink[y * W] = ink[y * W + 1] = ink[y * W + W - 2] = ink[y * W + W - 1] = 1;
  for (let y = 2; y < H - 2; y++) ink[y * W + 31] = ink[y * W + 32] = 1;

  const text = S.glyphs[S.text], q = S.q;
  for (let k = 0; k < 8; k++) {
    const g = text[k], ox = COLX[k >> 2], oy = ROWY[k & 3], F = S.F[k];
    const pl = g.plain;
    for (let s = 0; s < pl.length; s += 4) {
      const len = abs(pl[s + 2] - pl[s]) + abs(pl[s + 3] - pl[s + 1]) + 1;
      line(ink, ox + pl[s], oy + pl[s + 1], ox + pl[s + 2], oy + pl[s + 3], round(q * len));
    }
    if (q > 0.6) for (let s = 0; s < g.corners.length; s += 2) ink[(oy + g.corners[s + 1]) * W + ox + g.corners[s]] = 1;
    const r = g.runs;
    for (let s = 0; s < r.length; s += 7) {
      const u = F - (r[s] - 1);
      if (u <= 0) continue;
      const len = abs(r[s + 5] - r[s + 3]) + abs(r[s + 6] - r[s + 4]) + 1;
      const shown = min(len + 1, ceil(u * (len + 1)));
      ink[(oy + r[s + 2]) * W + ox + r[s + 1]] = 1;
      if (shown > 1) line(ink, ox + r[s + 3], oy + r[s + 4], ox + r[s + 5], oy + r[s + 6], shown - 1);
    }
  }

  // Colour. Every ink LED has the same brightest channel and every paper LED
  // the same level, so the picture has only hard steps; the sheen and the
  // mottle move the other two channels only.
  const hue = 0.025 + S.hue, full = hsv(hue, 0.8, 1), pale = hsv(hue, 0.38, 1);
  let mi = 0;
  for (let c = 1; c < 3; c++) if (full[c] > full[mi]) mi = c;
  const c1 = (mi + 1) % 3, c2 = (mi + 2) % 3;
  const f1 = full[c1] * INK_V, f2 = full[c2] * INK_V, p1 = pale[c1] * INK_V - f1, p2 = pale[c2] * INK_V - f2;
  // The pressure rocks round the seal; the side it has left prints thin.
  const ang = (S.tau * 2 * PI) / 6, ca = cos(ang), sa = sin(ang), press = S.press;
  // A sheen of pressure sweeps down the seal once every 5 s at Speed 2.
  const band = ((S.tau / 5) % 1) * 230 - 40;
  const rgb = [0, 0, 0];
  const grain = S.grain, blot = S.rank;
  for (let y = 0; y < H; y++) {
    const ny = (y - 63.5) / 64;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, j1 = grain[3 * p] - 128, j2 = grain[3 * p + 1] - 128, j3 = (grain[3 * p + 2] % 7) - 3;
      let on = ink[p];
      if (on) {
        const t = 0.5 + 0.5 * (((x - 31.5) / 32) * ca + ny * sa);
        if (blot[p] < press * (0.15 + 0.85 * t * t)) on = 0;
      }
      if (on) {
        const sh = max(0, 1 - abs(x * 0.5 + y - band) / 10);
        const v = INK_V + j3;
        rgb[mi] = v;
        rgb[c1] = cl(f1 + p1 * sh + j1 * MOTTLE, 0, v) | 0;
        rgb[c2] = cl(f2 + p2 * sh + (0.6 * j1 + 0.3 * j2) * MOTTLE, 0, v) | 0;
        display.setPixel(x, y, rgb[0], rgb[1], rgb[2]);
      } else {
        const v = PAPER[0] + j3;
        display.setPixel(x, y, v, cl(PAPER[1] + j1 * GRAIN, 0, v) | 0, cl(PAPER[2] + (0.6 * j1 + 0.3 * j2) * GRAIN, 0, v) | 0);
      }
    }
  }
}
