// ===== Patternflow pattern =====
// Title:   Thue-Morse Moments
// Family:  rhythm
// Idea:    Sixteen to sixty-four beats are dealt to voices A and B in the Thue-Morse order and drawn as bars while a playhead crosses the panel, and under them the running sums D_j(n) of A's beat positions to the power j minus B's, for j = 0 to 4, are drawn as sawtooth walks that land on exactly zero, marked in gold, at every multiple of 2^(j+1) beats, before plain A B A B alternation is drawn over them in grey and, from j = 1 on, never lands.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Thue-Morse sequence (Axel Thue, 1906; Marston Morse, 1921) and its equal sums of powers, the Prouhet-Tarry-Escott problem (Eugene Prouhet, 1851), pattern round 106
// Round:   106
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.25..4, Order=2..5, Block=16..64
//
// Knob 1: Hue. Turns both voices round the wheel together: voice A is at 0.96 + Hue and voice B half a turn from it, so at 0 A is crimson and B aqua. Hues in orange and yellow go to crimson and green, which read brown at the stripes' brightness. The gold marks and the grey alternation never move.
// Knob 2: Speed. How fast the playhead crosses the 64 columns. At 2 it takes 2.5 s at 16 beats, 4 s at 32 and 6 s at 64. The cycle is that pass, a hold of 1.2 s, the alternation pass in three quarters of the time, a hold of 2.2 s and a wipe of 0.8 s: 8.6 s, 11.2 s and 14.7 s. At 0.25 it is eight times slower, at 4 twice as fast. The first frame is 2 s before a pass starts, so at Speed 2 the page is clean at 2 s.
// Knob 3: Order. How many moments are drawn, j = 0 up to Order - 1, one lane each under the beats: 2 gives D_0 and D_1 in lanes 43 LEDs tall, 5 gives D_0 to D_4 in lanes 16 to 17 tall. D_j(n) is the sum over the first n beats of s_i i^j, with s_i = +1 for A, -1 for B and 0^0 = 1, and a lane draws it in units of the last beat's weight, D_j(n) / (n - 1)^j. It is zero at every multiple of 2^(j+1) beats, so at Block 16 the lane for j = 4 ends at 1536 / 15^4, a thirty-third, which the LED rounds onto the line without gold: it needs 32 beats.
// Knob 4: Block. The beats in the sheet, snapped to 16, 32 or 64 (log2 rounded), so a beat is 4, 2 or 1 LED wide. At 16 every moment up to j = 3 is back at zero by the last beat; at 64 all five are, and j = 4 lands at beats 32 and 64. Turning it starts a new sheet.

const W = 64, H = 128;
const { floor, round, min, max, abs, sin, exp, log2 } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The sequence: beat i is voice A (+1) when i has an even number of 1 bits,
// voice B (-1) when odd. D[j][n] is the sum over the first n beats of
// s_i * i^j, with 0^0 = 1, so D[0] counts A minus B and D[1] is the sum of
// A's positions minus the sum of B's. Prouhet (1851) showed D[j][2^(m+1)] is
// 0 for every j up to m. NB beats is the longest sheet; a shorter one is its
// first 16 or 32 beats. The alternation is s_i = +1 for even i, -1 for odd.
const NB = 64, NJ = 5;
const parity = (n) => {
  let c = 0;
  for (; n; n >>= 1) c ^= n & 1;
  return c;
};
function walks(sign) {
  const D = [];
  for (let j = 0; j < NJ; j++) {
    const d = new Float64Array(NB + 1);
    for (let n = 0; n < NB; n++) d[n + 1] = d[n] + sign[n] * n ** j;
    D.push(d);
  }
  return D;
}
// Sum of the positions and count of each voice among the first n beats; the
// centroid of A's beats is sumA / nA.
function centroids(sign) {
  const sa = new Float64Array(NB + 1), sb = new Float64Array(NB + 1), na = new Int32Array(NB + 1), nb = new Int32Array(NB + 1);
  for (let n = 0; n < NB; n++) {
    const a = sign[n] > 0;
    sa[n + 1] = sa[n] + (a ? n : 0);
    sb[n + 1] = sb[n] + (a ? 0 : n);
    na[n + 1] = na[n] + (a ? 1 : 0);
    nb[n + 1] = nb[n] + (a ? 0 : 1);
  }
  return { sa, sb, na, nb };
}

// Seconds the playhead takes over the panel at Speed 2, by log2 of the beats.
const PASS = [0, 0, 0, 0, 2.5, 4, 6];
const HOLD1 = 1.2, GHOST = 0.75, HOLD2 = 2.2, WIPE = 0.8, LEAD = 2;
// Rows: the A lane, the B lane, the centroid strip, then the moment lanes.
const A0 = 2, A1 = 14, B0 = 16, B1 = 28, CY = 34, M0 = 41;
// Levels: a written column's stripe through the moment lanes (by the beat's
// width in LEDs, dimmer as the beats get narrower), the stripe through the
// rhythm section, and the fill under a walk.
const STW = [0, 0.42, 0.52, 0, 0.58], STR = 0.3, FILL0 = 0.75, FILL1 = 1;

export function setup(params) {
  const tm = new Int8Array(NB), ab = new Int8Array(NB);
  for (let i = 0; i < NB; i++) {
    tm[i] = parity(i) ? -1 : 1;
    ab[i] = i & 1 ? -1 : 1;
  }
  const DT = walks(tm), DA = walks(ab);
  // What a lane draws is the walk in units of the last beat's weight,
  // D_j(n) / (n - 1)^j (1 for n < 2): the raw sums grow like n^j and would
  // leave the first half of every high lane flat. A walk that is fair lands
  // on 0 whatever the unit. The scale of lane j is the largest |value| of
  // either walk in the sheet, found per sheet length.
  const rel = (D) => D.map((d, j) => Float64Array.from(d, (v, n) => v / (n < 2 ? 1 : (n - 1) ** j)));
  const RT = rel(DT), RA = rel(DA), peak = [];
  for (let b = 4; b <= 6; b++) {
    const p = [];
    for (let j = 0; j < NJ; j++) {
      let m = 1;
      for (let n = 0; n <= 1 << b; n++) m = max(m, abs(RT[j][n]), abs(RA[j][n]));
      p.push(m);
    }
    peak[b] = p;
  }
  params.s = {
    tm, ab, DT, DA, RT, RA, peak, cT: centroids(tm), cA: centroids(ab),
    buf: new Float32Array(W * H * 3), pal: new Float32Array(30), palHue: -1,
    hue: 0, speed: 2, order: 2, b: 0, c: 0, lanes: [], laneOrder: 0,
  };
}

// 0-2 voice A, 3-5 voice B, 6-8 A pale, 9-11 B pale, 12-14 gold, 15-17 white.
// A hue that lands in orange or yellow would show as brown at the stripes'
// brightness, so those go to crimson and green.
function palette(S) {
  const t = S.pal;
  const wh = (h) => {
    h -= floor(h);
    return h < 0.17 ? 0.94 + h * 0.3 : h < 0.33 ? 0.33 : h;
  };
  const ha = wh(0.96 + S.hue), hb = wh(0.96 + S.hue + 0.5);
  hsv(ha, 1, 1, t, 0);
  hsv(hb, 1, 1, t, 3);
  hsv(ha, 0.35, 1, t, 6);
  hsv(hb, 0.35, 1, t, 9);
  hsv(0.12, 0.6, 1, t, 12);
  hsv(0.55, 0.1, 1, t, 15);
  S.palHue = S.hue;
}

function layout(S) {
  const n = S.order, avail = H - M0 - (n - 1), base = floor(avail / n);
  S.lanes = [];
  let y = M0;
  for (let l = 0; l < n; l++) {
    const h = base + (l < avail - base * n ? 1 : 0), hh = floor((h - 1) / 2);
    S.lanes.push({ y, h, hh, zy: y + hh });
    y += h + 1;
  }
  S.laneOrder = n;
}

const cycleLen = (b) => PASS[b] * (1 + GHOST) + HOLD1 + HOLD2 + WIPE;

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 2, 16], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.25, 4);
  S.order = cl(round(k[2]), 2, 5);
  const b = cl(round(log2(max(1, k[3]))), 4, 6);
  if (S.order !== S.laneOrder) layout(S);
  if (b !== S.b) {
    // The first sheet opens LEAD seconds before the pass starts, so the
    // frame at 2 s is a clean page. A new Block starts a new sheet.
    S.c = S.b === 0 ? cycleLen(b) - LEAD : 0;
    S.b = b;
  }
  S.c += (d * S.speed) / 2;
  const len = cycleLen(S.b);
  if (S.c >= len) S.c -= len;
}

// 3 x 5 digits for the lanes' j.
const DIG = [
  ["###", "#.#", "#.#", "#.#", "###"],
  [".#.", "##.", ".#.", ".#.", "###"],
  ["###", "..#", "###", "#..", "###"],
  ["###", "..#", "###", "..#", "###"],
  ["#.#", "#.#", "###", "..#", "..#"],
];

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.b) return;
  if (S.palHue !== S.hue) palette(S);
  const buf = S.buf, pal = S.pal, b = S.b, B = 1 << b, w = W / B, c = S.c;
  buf.fill(0);
  const put = (x, y, r, g, bl) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    if (r > buf[o]) buf[o] = r;
    if (g > buf[o + 1]) buf[o + 1] = g;
    if (bl > buf[o + 2]) buf[o + 2] = bl;
  };
  // A palette slot at a level, lifted toward white by lift.
  const col = (o, lv, lift, x, y) => {
    const r = pal[o], g = pal[o + 1], bl = pal[o + 2];
    put(x, y, (r + (1 - r) * lift) * lv, (g + (1 - g) * lift) * lv, (bl + (1 - bl) * lift) * lv);
  };

  // The cycle: pass 1 writes the Thue-Morse sheet left to right, then a
  // hold, pass 2 draws the alternation over it, a hold and a wipe.
  const dp = PASS[b], dg = dp * GHOST, t2 = dp + HOLD1, t3 = t2 + dg, t4 = t3 + HOLD2;
  const xh = c < dp ? (W * c) / dp : W;
  const xg = c < t2 ? 0 : min(W, (W * (c - t2)) / dg);
  const xw = c < t4 ? 0 : min(W, (W * (c - t4)) / WIPE);
  const x0 = floor(xw), head = c < dp ? floor(xh) : -1, ghead = c >= t2 && c < t3 ? floor(xg) : -1;

  const { tm, ab, DT, DA, RT, RA, cT, cA } = S;
  const sheet = S.peak[b];
  const breath = 0.88 + 0.12 * sin(c * 3.2);

  // ---- the beats: voice A in the upper lane, voice B in the lower ----
  for (let x = x0; x < xh; x++) {
    const i = floor(x / w), k = x - i * w, a = tm[i] > 0, gap = w > 1 && k === w - 1;
    const age = c - ((x + 1) * dp) / W, fresh = exp(-age / 0.3);
    if (gap) {
      for (let y = A0; y < M0 - 1; y++) col(a ? 0 : 3, STR * 0.6, 0, x, y);
      continue;
    }
    const [ya, yb] = a ? [A0, A1] : [B0, B1];
    // The voice's colour runs through the rest of the column too, dimmer.
    for (let y = A0; y < M0 - 1; y++) col(a ? 0 : 3, STR + 0.15 * fresh, 0, x, y);
    for (let y = ya; y <= yb; y++) col(a ? 0 : 3, 0.7 + 0.2 * (a ? (A1 - y) / (A1 - A0) : (y - B0) / (B1 - B0)), 0.1 + 0.7 * fresh, x, y);
  }
  // The alternation's beats: a pale cap on the inner edge of each lane.
  for (let x = x0; x < xg; x++) {
    const i = floor(x / w), k = x - i * w, a = ab[i] > 0;
    if (w > 1 && k === w - 1) continue;
    if (a) {
      col(6, 0.8, 0.3, x, A1);
      col(6, 0.8, 0.3, x, A1 - 1);
    } else {
      col(9, 0.8, 0.3, x, B0);
      col(9, 0.8, 0.3, x, B0 + 1);
    }
  }

  // ---- the moment lanes ----
  for (let l = 0; l < S.lanes.length; l++) {
    const L = S.lanes[l], j = l, scale = sheet[j], D = RT[j], E = RA[j], Dz = DT[j], Ez = DA[j];
    const yOf = (v) => L.zy - round((v / scale) * L.hh);
    let prev = L.zy, prevG = L.zy;
    // The zero line, always there.
    for (let x = 0; x < W; x++) col(15, 0.2, 0, x, L.zy);
    for (let x = x0; x < W; x++) {
      const i = floor(x / w), k = x - i * w, a = tm[i] > 0, vo = a ? 0 : 3;
      const wr = x < xh;
      if (wr) {
        // A column of the sheet: the voice's stripe, the area from zero up
        // to the walk, and the walk itself.
        const f = w === 1 ? 1 : (k + 1) / w;
        const v = D[i] + (D[i + 1] - D[i]) * f, y = yOf(v);
        const age = c - ((x + 1) * dp) / W, fresh = exp(-age / 0.3);
        const gap = w > 1 && k === w - 1, st = STW[w] * (gap ? 0.62 : 1);
        for (let y2 = L.y; y2 < L.y + L.h; y2++) col(vo, st + 0.2 * fresh, 0.1 * fresh, x, y2);
        const lo = min(y, L.zy), hi = max(y, L.zy), span = max(1, hi - lo);
        for (let y2 = lo; y2 <= hi; y2++) col(vo, FILL0 + (FILL1 - FILL0) * (abs(y2 - L.zy) / span), 0.28 + 0.3 * fresh, x, y2);
        // the walk, joined to the one before it
        const ya = w === 1 ? y : min(prev, y), yb = w === 1 ? y : max(prev, y);
        for (let y2 = ya; y2 <= yb; y2++) col(vo, 1, 0.7 + 0.25 * fresh, x, y2);
        prev = y;
      }
      if (x < xg) {
        const f = w === 1 ? 1 : (k + 1) / w;
        const v = E[i] + (E[i + 1] - E[i]) * f, y = yOf(v);
        const ya = w === 1 ? y : min(prevG, y), yb = w === 1 ? y : max(prevG, y);
        for (let y2 = ya; y2 <= yb; y2++) col(15, 0.62, 0, x, y2);
        prevG = y;
      }
    }
    // Where the walk is exactly zero after a beat n >= 2: a gold tick.
    for (let n = 2; n <= B; n++) {
      const x = n * w - 1;
      if (x < x0 || x >= xh) continue;
      if (Dz[n] !== 0) continue;
      const age = c - ((x + 1) * dp) / W, g = breath + 0.6 * exp(-age / 0.5);
      for (let dx = -1; dx <= 1; dx++) col(12, min(1, 0.95 * g), 0.25, x + dx, L.zy);
      const tk = min(w === 1 ? 3 : max(3, round(L.hh * 0.5)), L.hh - 1);
      for (let dy = 1; dy <= tk; dy++) {
        col(12, min(1, 0.95 * g), 0.25, x, L.zy - dy);
        col(12, min(1, 0.95 * g), 0.25, x, L.zy + dy);
      }
    }
    // The alternation's own zeros, which only j = 0 has.
    for (let n = 2; n <= B; n++) {
      const x = n * w - 1;
      if (x < x0 || x >= xg || Ez[n] !== 0) continue;
      col(12, 0.5, 0.3, x, L.zy);
    }
    // The lane's exponent, with a dark ring so the walk does not eat it.
    const gl = DIG[j];
    for (let y = -1; y < 6; y++) for (let x = -1; x < 4; x++) if (x + 1 >= 0 && y + L.y + 1 < H) buf.fill(0, ((L.y + 1 + y) * W + 1 + x) * 3, ((L.y + 1 + y) * W + 1 + x) * 3 + 3);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (gl[y][x] === "#") col(15, 0.8, 0, 1 + x, L.y + 1 + y);
  }

  // ---- the centroid strip: where the middle of A's beats and of B's beats lie ----
  const nT = floor(min(xh, W) / w), nG = floor(min(xg, W) / w);
  for (let x = x0; x < W; x++) if (x < xh) col(15, 0.14, 0, x, CY);
  const mark = (cx, y, o, lv) => {
    const x = round(cx);
    if (x < x0) return;
    col(o, lv, 0.2, x, y);
    col(o, lv * 0.75, 0.2, x - 1, y);
    col(o, lv * 0.75, 0.2, x + 1, y);
    col(o, lv * 0.75, 0.2, x, y - 1);
    col(o, lv * 0.75, 0.2, x, y + 1);
  };
  if (nT >= 1) {
    const { sa, sb, na, nb } = cT;
    for (let n = 2; n <= nT; n++)
      if (na[n] > 0 && nb[n] > 0 && sa[n] * nb[n] === sb[n] * na[n] && n * w - 1 >= x0) col(12, 0.95, 0.1, n * w - 1, CY);
    {
      const n = nT, xa = (sa[n] / max(1, na[n]) + 0.5) * w - 0.5, xb = (sb[n] / max(1, nb[n]) + 0.5) * w - 0.5;
      const same = na[n] > 0 && nb[n] > 0 && sa[n] * nb[n] === sb[n] * na[n];
      if (same) mark(xa, CY, 12, 1);
      else {
        if (nb[n] > 0) {
          const lo = round(min(xa, xb)), hi = round(max(xa, xb));
          for (let x = max(lo, x0); x <= hi; x++) col(15, 0.3, 0, x, CY);
          mark(xb, CY, 3, 0.9);
        }
        mark(xa, CY, 0, 0.9);
      }
    }
  }
  if (nG >= 1) {
    const { sa, sb, na, nb } = cA, n = nG;
    const xa = (sa[n] / max(1, na[n]) + 0.5) * w - 0.5, xb = (sb[n] / max(1, nb[n]) + 0.5) * w - 0.5;
    if (nb[n] > 0) {
      if (round(xa) >= x0) col(15, 0.7, 0, round(xa), CY - 4);
      if (round(xb) >= x0) col(15, 0.7, 0, round(xb), CY + 4);
    }
  }

  // ---- the playheads and the wipe ----
  const rail = (x, lv, lift) => {
    for (let y = 0; y < H; y++) {
      const o = (y * W + x) * 3;
      if (buf[o] + buf[o + 1] + buf[o + 2] > 0 || y < M0) col(15, lv, lift, x, y);
    }
  };
  if (head >= 0 && head < W) rail(head, 0.55, 0);
  if (ghead >= 0 && ghead < W) rail(ghead, 0.3, 0);
  if (xw > 0 && xw < W) rail(floor(xw), 0.6, 0);

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, min(255, buf[p * 3] * 255), min(255, buf[p * 3 + 1] * 255), min(255, buf[p * 3 + 2] * 255));
}
