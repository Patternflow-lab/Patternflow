// ===== Patternflow pattern =====
// Title:   Jamo Assembly
// Family:  type
// Idea:    A Korean word is built down the tall panel one syllable block at a time: the slots its vowel calls for open as faint outlines, the initial consonant, the vowel and the final fly in from the panel's edges as separate letters in three colours, shrink or stretch into their slots and lock with a flash, and beside each block its code point counts up from U+AC00 as the pieces land, until the word holds in one paler colour and flies apart to be built again.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Hangul syllable blocks, 모아쓰기 of the Hunminjeongeum (King Sejong, created 1443, promulgated 1446), the Unicode Hangul Syllables block at U+AC00 (Unicode 2.0, 1996), pattern round 63
// Round:   63
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Phrase=0..7, Flight=0..1
//
// Knob 1: Hue. Turns the three roles round the wheel together. At 0 initials are cyan, vowels violet-pink and finals yellow, a finished block pales 80% of the way to azure, and the code point is azure grey; at 0.5 the roles are red, green and blue and the finished word salmon.
// Knob 2: Speed. At 2 a syllable starts every 1.15 s with its pieces 0.3 s apart, a flight takes 0.95 s, the word holds 2.6 s after its last piece locks and flies apart in about 1 s: one round is 8.6 s for 모아쓰기, 6.4 s for a two-syllable word and 5.1 s for 빛. At 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Phrase. 0 모아쓰기, 1 훨훨, 2 패턴, 3 흐름, 4 한글, 5 괜찮아, 6 훈민정음, 7 빛. A one- or two-syllable word gets 56-LED blocks, 괜찮아 39, the four-syllable words 28. Between them the initial sits beside a vertical vowel (아 기 패 턴 한 찮 민 정 빛), above a horizontal one (모 쓰 흐 름 글 훈 음) and in the corner of a compound (훨 괜), with a final under them in 13 of the 20 blocks and doubled letters in 쓰 (ㅆ) and 찮 (ㄶ).
// Knob 4: Flight. How the pieces fly in. At 0 they come in on an arc bent by 0.3 of their path, turn 0.3 rad and land in 0.9 s with a small overshoot; at 1 the arc bends by 0.9, they spin through up to 3.2 rad, overshoot further, take 1.8 s and leave trails that fade in 0.16 s instead of 0.06 s. A piece keeps the flight time it set off with, so a turn shows on the next pieces.

const W = 64, H = 128;
const { floor, round, min, max, sqrt, exp, cos, sin, PI, random, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

const PHRASES = ["모아쓰기", "훨훨", "패턴", "흐름", "한글", "괜찮아", "훈민정음", "빛"];

// The basic letters as strokes on a 20 x 20 grid, y down. A stroke is a
// polyline of x, y pairs; one that starts with O is an ellipse cx, cy, rx, ry.
const O = -1;
const BASE = {
  "ㄱ": [[3, 3, 17, 3, 17, 18]],
  "ㄴ": [[3, 2, 3, 17, 18, 17]],
  "ㄷ": [[17, 3, 3, 3, 3, 17, 18, 17]],
  "ㄹ": [[3, 2, 17, 2, 17, 10, 3, 10, 3, 18, 18, 18]],
  "ㅁ": [[3, 3, 17, 3, 17, 17, 3, 17, 3, 3]],
  "ㅂ": [[3, 2, 3, 18, 17, 18, 17, 2], [3, 10, 17, 10]],
  "ㅅ": [[10, 2, 2, 18], [10, 2, 18, 18]],
  "ㅇ": [[O, 10, 10, 7.5, 7.5]],
  "ㅈ": [[3, 3, 17, 3], [10, 3, 3, 18], [10, 3, 17, 18]],
  "ㅊ": [[10, 0, 10, 4], [3, 5, 17, 5], [10, 5, 3, 19], [10, 5, 17, 19]],
  "ㅋ": [[3, 3, 17, 3, 17, 18], [3, 10, 17, 10]],
  "ㅌ": [[17, 2, 3, 2, 3, 18, 18, 18], [3, 10, 17, 10]],
  "ㅍ": [[2, 3, 18, 3], [2, 17, 18, 17], [7, 3, 7, 17], [13, 3, 13, 17]],
  "ㅎ": [[10, 0, 10, 3], [3, 5, 17, 5], [O, 10, 13, 5.5, 5]],
  "ㅣ": [[10, 1, 10, 19]],
  "ㅏ": [[7, 1, 7, 19], [7, 10, 17, 10]],
  "ㅑ": [[7, 1, 7, 19], [7, 7, 17, 7], [7, 13, 17, 13]],
  "ㅓ": [[13, 1, 13, 19], [3, 10, 13, 10]],
  "ㅕ": [[13, 1, 13, 19], [3, 7, 13, 7], [3, 13, 13, 13]],
  "ㅐ": [[5, 1, 5, 19], [5, 10, 13, 10], [15, 0, 15, 20]],
  "ㅒ": [[5, 1, 5, 19], [5, 7, 13, 7], [5, 13, 13, 13], [15, 0, 15, 20]],
  "ㅔ": [[2, 10, 9, 10], [9, 1, 9, 19], [16, 0, 16, 20]],
  "ㅖ": [[2, 7, 9, 7], [2, 13, 9, 13], [9, 1, 9, 19], [16, 0, 16, 20]],
  "ㅡ": [[1, 10, 19, 10]],
  "ㅗ": [[10, 4, 10, 13], [1, 13, 19, 13]],
  "ㅛ": [[7, 4, 7, 13], [13, 4, 13, 13], [1, 13, 19, 13]],
  "ㅜ": [[1, 7, 19, 7], [10, 7, 10, 16]],
  "ㅠ": [[1, 7, 19, 7], [7, 7, 7, 16], [13, 7, 13, 16]],
};
// The 19 initials, 21 vowels and 27 finals in Unicode's order, each spelled
// with the basic letters it is built from.
const INIT = ["ㄱ", "ㄱㄱ", "ㄴ", "ㄷ", "ㄷㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅂㅂ", "ㅅ", "ㅅㅅ", "ㅇ", "ㅈ", "ㅈㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const MED = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅗㅏ", "ㅗㅐ", "ㅗㅣ", "ㅛ", "ㅜ", "ㅜㅓ", "ㅜㅔ", "ㅜㅣ", "ㅠ", "ㅡ", "ㅡㅣ", "ㅣ"];
const FIN = ["", "ㄱ", "ㄱㄱ", "ㄱㅅ", "ㄴ", "ㄴㅈ", "ㄴㅎ", "ㄷ", "ㄹ", "ㄹㄱ", "ㄹㅁ", "ㄹㅂ", "ㄹㅅ", "ㄹㅌ", "ㄹㅍ", "ㄹㅎ", "ㅁ", "ㅂ", "ㅂㅅ", "ㅅ", "ㅅㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const HORIZONTAL = "ㅗㅛㅜㅠㅡ";

// The slots on a 20 x 20 block, [x, y, w, h]: the initial, the vowel (two
// rects for a compound: its horizontal part and its vertical part) and the
// final, by the vowel's shape and whether there is a final.
const SLOTS = {
  V: [[1, 3, 11, 14], [[12, 0, 7, 20]]],
  VF: [[1, 1, 11, 10], [[12, 0, 7, 12]], [3, 13, 14, 7]],
  H: [[3, 1, 14, 10], [[0, 10, 20, 9]]],
  HF: [[3, 0, 14, 7], [[0, 6, 20, 6]], [3, 13, 14, 7]],
  C: [[1, 1, 11, 9], [[0, 9, 14, 8], [13, 0, 7, 20]]],
  CF: [[1, 0, 11, 6], [[0, 5, 14, 6], [13, 0, 7, 13]], [3, 13, 14, 7]],
};

// 3 x 5 hex digits for the code point, top row first, 4 is the left column.
const HEX = [[7, 5, 5, 5, 7], [2, 6, 2, 2, 7], [7, 1, 7, 4, 7], [7, 1, 3, 1, 7], [5, 5, 7, 1, 1], [7, 4, 7, 1, 7], [7, 4, 7, 5, 7], [7, 1, 1, 2, 2],
  [7, 5, 7, 5, 7], [7, 5, 7, 1, 7], [2, 5, 7, 5, 5], [6, 5, 6, 5, 6], [3, 4, 4, 4, 3], [6, 5, 5, 5, 6], [7, 4, 6, 4, 7], [7, 4, 6, 4, 4]];

// The timeline, in seconds at Speed 2.
// A flight takes 0.9 s with Flight at 0 and 1.8 s at 1; a piece keeps the
// time it set off with.
const STEP = 1.15, LAG = 0.3, HOLD = 2.6, OUT = 0.9, REST = 0.1;
const flyTime = (F) => 0.9 + 0.9 * F;

export function setup(params) {
  params.s = { phrase: -1, t: 0, syl: [], pieces: [], end: 0, hue: 0, flight: 0, buf: new Float32Array(W * H * 3), c: [0, 0, 0], c2: [0, 0, 0] };
}

// Lay a letter group (one to two basic letters side by side) into a rect.
function split(letters, r) {
  if (letters.length === 1) return [{ ch: letters, r }];
  const w = r[2] * 0.47;
  return [{ ch: letters[0], r: [r[0], r[1], w, r[3]] }, { ch: letters[1], r: [r[0] + r[2] - w, r[1], w, r[3]] }];
}

// Where a piece enters: out from its slot along (dx, dy) until its centre is
// past the panel's edge by half.
function edgeStart(tx, ty, dx, dy, half) {
  let t = 1e9;
  if (dx > 1e-6) t = min(t, (W + half - tx) / dx);
  if (dx < -1e-6) t = min(t, (-half - tx) / dx);
  if (dy > 1e-6) t = min(t, (H + half - ty) / dy);
  if (dy < -1e-6) t = min(t, (-half - ty) / dy);
  return [tx + dx * t, ty + dy * t];
}

function build(S, idx) {
  S.phrase = idx;
  const word = PHRASES[idx], n = word.length;
  const B = n <= 2 ? 56 : floor((124 - (n - 1) * 3) / n), gap = n <= 2 ? 4 : 3;
  const x0 = (W - B) / 2, y0 = (H - (n * B + (n - 1) * gap)) / 2;
  S.B = B;
  S.syl = [];
  S.pieces = [];
  for (let s = 0; s < n; s++) {
    const code = word.charCodeAt(s) - 0xac00;
    const L = floor(code / 588), V = floor((code % 588) / 28), T = code % 28;
    const shape = MED[V].length === 2 ? "C" : HORIZONTAL.includes(MED[V]) ? "H" : "V";
    const slots = SLOTS[shape + (T ? "F" : "")];
    const bx = x0, by = y0 + s * (B + gap);
    const syl = { L, V, T, bx, by, B, pieces: [], t0: 0.15 + s * STEP };
    const groups = [split(INIT[L], slots[0])];
    groups.push(MED[V].length === 2 ? [{ ch: MED[V][0], r: slots[1][0] }, { ch: MED[V][1], r: slots[1][1] }] : [{ ch: MED[V], r: slots[1][0] }]);
    if (T) groups.push(split(FIN[T], slots[2]));
    groups.forEach((subs, role) => {
      // The piece's box is the union of its sub-rects, in block units.
      let ux0 = 20, uy0 = 20, ux1 = 0, uy1 = 0;
      for (const u of subs) {
        ux0 = min(ux0, u.r[0]); uy0 = min(uy0, u.r[1]);
        ux1 = max(ux1, u.r[0] + u.r[2]); uy1 = max(uy1, u.r[1] + u.r[3]);
      }
      const k = B / 20;
      const p = {
        role, syl: s,
        subs: subs.map((u) => ({ g: BASE[u.ch], rel: [(u.r[0] - ux0) / (ux1 - ux0), (u.r[1] - uy0) / (uy1 - uy0), u.r[2] / (ux1 - ux0), u.r[3] / (uy1 - uy0)] })),
        slot: subs.map((u) => [bx + u.r[0] * k, by + u.r[1] * k, u.r[2] * k, u.r[3] * k]),
        tx: bx + ((ux0 + ux1) / 2) * k, ty: by + ((uy0 + uy1) / 2) * k, tw: (ux1 - ux0) * k, th: (uy1 - uy0) * k,
        launch: syl.t0 + role * LAG,
      };
      // Enter from the side the slot faces, give or take 75 degrees.
      let ax = p.tx - (bx + B / 2), ay = p.ty - (by + B / 2);
      const a = Math.atan2(ay, ax) + (random() - 0.5) * 2.6;
      ax = cos(a); ay = sin(a);
      const SZ = B * 0.8;
      [p.sx, p.sy] = edgeStart(p.tx, p.ty, ax, ay, SZ * 0.35);
      // Leave outward from the block's centre, give or take 30 degrees.
      const b = Math.atan2(p.ty - (by + B / 2), p.tx - (bx + B / 2)) + (random() - 0.5) * 1.05;
      p.ex = cos(b); p.ey = sin(b);
      p.bend = random() < 0.5 ? -1 : 1;
      p.spin = random() < 0.5 ? -1 : 1;
      p.SZ = SZ;
      syl.pieces.push(p);
      S.pieces.push(p);
    });
    S.syl.push(syl);
  }
}

// Lock, hold and leave times from the flights as they stand: a piece in the
// air keeps its own flight time, one still waiting takes the knob's.
function schedule(S) {
  const fly = flyTime(S.flight);
  let last = 0;
  for (const p of S.pieces) {
    if (p.fly === undefined && S.t >= p.launch) p.fly = fly;
    p.lock = p.launch + (p.fly === undefined ? fly : p.fly);
    last = max(last, p.lock);
  }
  const hold = last + HOLD;
  S.syl.forEach((syl, s) => {
    syl.done = 0;
    for (const p of syl.pieces) {
      syl.done = max(syl.done, p.lock);
      p.out = hold + s * 0.12 + (2 - p.role) * 0.05;
    }
  });
  S.end = hold + (S.syl.length - 1) * 0.12 + 0.1 + 0.7 * OUT + REST;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.flight = cl(k[3], 0, 1);
  const speed = cl(k[1], 0.2, 3), tau = (d * speed) / 2;
  S.tau = tau;
  const idx = round(cl(k[2], 0, PHRASES.length - 1));
  if (idx !== S.phrase) {
    build(S, idx);
    // The very first build opens with the first pieces already in the air.
    S.t = S.started ? 0 : 0.55;
    S.started = true;
  }
  S.t += tau;
  schedule(S);
  if (S.t > S.end) {
    build(S, idx);
    S.t = 0;
    schedule(S);
  }
}

// Ease in and out, overshooting the slot by more as s grows.
function easeBack(u, s) {
  const c = s * 1.525;
  return u < 0.5 ? ((2 * u) ** 2 * ((c + 1) * 2 * u - c)) / 2 : ((2 * u - 2) ** 2 * ((c + 1) * (2 * u - 2) + c) + 2) / 2;
}
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// Where a piece is at time t: box centre, size, rotation, and visibility.
function pose(S, p, t) {
  const F = S.flight;
  if (t < p.launch) return null;
  if (t < p.lock) {
    const u = (t - p.launch) / (p.lock - p.launch), q = easeBack(u, 0.4 + 1.6 * F), m = smooth(u * 1.15);
    // A quadratic curve bent sideways by 0.3 to 0.9 of its length.
    const mx = (p.sx + p.tx) / 2, my = (p.sy + p.ty) / 2, dx = p.tx - p.sx, dy = p.ty - p.sy;
    const bend = (0.3 + 0.6 * F) * p.bend;
    const cx = mx - dy * bend, cy = my + dx * bend;
    const a = (1 - q) * (1 - q), b = 2 * (1 - q) * q, c = q * q;
    return { x: a * p.sx + b * cx + c * p.tx, y: a * p.sy + b * cy + c * p.ty, w: p.SZ + (p.tw - p.SZ) * m, h: p.SZ + (p.th - p.SZ) * m, r: p.spin * (0.3 + 2.9 * F) * (1 - m) ** 2, a: 1 };
  }
  if (t < p.out) return { x: p.tx, y: p.ty, w: p.tw, h: p.th, r: 0, a: 1 };
  const u = (t - p.out) / OUT;
  if (u >= 1) return null;
  const e = u * u, dist = 90 * e;
  return { x: p.tx + p.ex * dist, y: p.ty + p.ey * dist, w: p.tw + (p.SZ - p.tw) * e, h: p.th + (p.SZ - p.th) * e, r: p.spin * (0.3 + 2.9 * F) * e, a: 1 - u * u };
}

// Max-blend a stroke segment of width w into the buffer.
function seg(buf, x0, y0, x1, y1, w, c) {
  const r = w / 2 + 0.5;
  const lx = max(0, floor(min(x0, x1) - r)), hx = min(W - 1, ceil(max(x0, x1) + r));
  const ly = max(0, floor(min(y0, y1) - r)), hy = min(H - 1, ceil(max(y0, y1) + r));
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9;
  for (let y = ly; y <= hy; y++)
    for (let x = lx; x <= hx; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0;
      const u = cl((px * dx + py * dy) / L2, 0, 1), ex = px - u * dx, ey = py - u * dy;
      const f = cl(r - sqrt(ex * ex + ey * ey), 0, 1);
      if (f <= 0) continue;
      const i = (y * W + x) * 3;
      if (buf[i] < c[0] * f) buf[i] = c[0] * f;
      if (buf[i + 1] < c[1] * f) buf[i + 1] = c[1] * f;
      if (buf[i + 2] < c[2] * f) buf[i + 2] = c[2] * f;
    }
}

function drawPiece(buf, p, ps, w, c) {
  const co = cos(ps.r), si = sin(ps.r);
  const map = (rel, gx, gy) => {
    const lx = (rel[0] + (rel[2] * gx) / 20 - 0.5) * ps.w, ly = (rel[1] + (rel[3] * gy) / 20 - 0.5) * ps.h;
    return [ps.x + lx * co - ly * si, ps.y + lx * si + ly * co];
  };
  for (const sub of p.subs)
    for (const st of sub.g) {
      const pts = [];
      if (st[0] === O) {
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * 2 * PI;
          pts.push(map(sub.rel, st[1] + st[3] * cos(a), st[2] + st[4] * sin(a)));
        }
      } else for (let i = 0; i < st.length; i += 2) pts.push(map(sub.rel, st[i], st[i + 1]));
      for (let i = 1; i < pts.length; i++) seg(buf, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w, c);
    }
}

function rectOutline(buf, r, c) {
  const x0 = round(r[0]), y0 = round(r[1]), x1 = round(r[0] + r[2]) - 1, y1 = round(r[1] + r[3]) - 1;
  const put = (x, y) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 3;
    for (let j = 0; j < 3; j++) buf[i + j] = max(buf[i + j], c[j]);
  };
  for (let x = x0; x <= x1; x++) { put(x, y0); put(x, y1); }
  for (let y = y0 + 1; y < y1; y++) { put(x0, y); put(x1, y); }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.phrase < 0) return;
  const buf = S.buf, c = S.c, c2 = S.c2, t = S.t, h0 = S.hue + 0.5;
  // Trails: what was drawn fades in 0.06 s at Speed 2 with Flight at 0, in
  // 0.16 s at 1.
  const fade = exp(-(S.tau || 0) / (0.06 + 0.1 * S.flight));
  for (let i = 0; i < buf.length; i++) buf[i] *= fade;
  const w = cl(S.B * 0.08, 1.5, 4.2);
  // Slot outlines while a piece is on its way, fading once it locks.
  for (const p of S.pieces) {
    const g = t < p.launch - 0.15 ? 0 : t < p.lock ? 1 : max(0, 1 - (t - p.lock) / 0.4);
    if (g <= 0) continue;
    hsv(h0 + p.role / 3, 0.7, 0.22 * g, c);
    for (const r of p.slot) rectOutline(buf, r, c);
  }
  for (const syl of S.syl) {
    // The block's square from its first launch until it is whole.
    const g = t < syl.t0 - 0.1 ? 0 : t < syl.done ? 1 : max(0, 1 - (t - syl.done) / 0.6);
    if (g > 0) {
      c[0] = c[1] = c[2] = 0.1 * g;
      rectOutline(buf, [syl.bx - 1, syl.by - 1, syl.B + 2, syl.B + 2], c);
    }
  }
  for (const p of S.pieces) {
    const ps = pose(S, p, t);
    if (!ps) continue;
    const syl = S.syl[p.syl];
    hsv(h0 + p.role / 3, 0.75, 1, c);
    // A whole block pales toward one colour; a piece flashes white as it locks.
    const one = smooth((t - syl.done - 0.25) / 0.6) * (t < p.out ? 1 : 1 - smooth((t - p.out) / 0.3));
    hsv(h0 + 0.08, 0.5, 1, c2);
    const fl = t >= p.lock && t < p.out ? exp(-(t - p.lock) / 0.18) : 0;
    for (let j = 0; j < 3; j++) c[j] = ((c[j] + (c2[j] - c[j]) * one * 0.8) * (1 - fl) + fl) * ps.a;
    drawPiece(buf, p, ps, w * (t < p.lock ? 1 + 0.3 * (1 - (t - p.launch) / (p.lock - p.launch)) : 1), c);
  }
  // Beside each block, its code point as the pieces land: U+AC00, then
  // + initial x 588, + vowel x 28, + final.
  const out = S.out || (S.out = new Float32Array(buf.length));
  out.set(buf);
  for (const syl of S.syl) {
    if (t < syl.t0) continue;
    const [pi, pv, pf] = syl.pieces;
    let v = 0xac00, lastLock = syl.t0;
    if (t >= pi.lock) { v += syl.L * 588; lastLock = pi.lock; }
    if (t >= pv.lock) { v += syl.V * 28; lastLock = pv.lock; }
    if (pf && t >= pf.lock) { v += syl.T; lastLock = pf.lock; }
    const gone = t < pi.out ? 1 : max(0, 1 - (t - pi.out) / 0.4), fl = exp(-(t - lastLock) / 0.25);
    hsv(h0 + 0.08, 0.4, (0.5 + 0.5 * fl) * gone, c);
    const xd = round(syl.bx + syl.B + (syl.bx - 3) / 2), yd = round(syl.by + syl.B / 2 - 11.5);
    for (let d = 0; d < 4; d++) {
      const g = HEX[(v >> (12 - 4 * d)) & 15];
      for (let ry = 0; ry < 5; ry++)
        for (let rx = 0; rx < 3; rx++)
          if (g[ry] & (4 >> rx)) {
            const x = xd + rx, y = yd + d * 6 + ry;
            if (x < 0 || x >= W || y < 0 || y >= H) continue;
            const i = (y * W + x) * 3;
            for (let j = 0; j < 3; j++) out[i + j] = max(out[i + j], c[j]);
          }
    }
  }
  for (let p = 0, i = 0; p < W * H; p++, i += 3)
    display.setPixel(p & 63, p >> 6, round(cl(out[i], 0, 1) * 255), round(cl(out[i + 1], 0, 1) * 255), round(cl(out[i + 2], 0, 1) * 255));
}
