// ===== Patternflow pattern =====
// Title:   Beckett-Gray
// Family:  rhythm
// Idea:    Six performers are six lanes of a score that scrolls down two rows a beat, so the whole 64-beat cycle of a Beckett-Gray code stands on the panel at once, each lane lit while its performer is on stage, dim when it has just come on and a step brighter each time one before it leaves, until it turns white at the head of the queue and is the next to go, with one lane flashing at the now line on every beat, while the reflected Gray code on a knob sends a performer off out of turn at 26 of its 32 exits, each one marked red.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Beckett-Gray codes (Donald Knuth, 2005), after Samuel Beckett's Quad (1981), with the reflected binary Gray code (Frank Gray, 1953), pattern round 58
// Round:   58
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Code=0..3, Rows=2..8
//
// Knob 1: Hue. Turns the six lane colours round the wheel together. At 0 the lanes run cyan, azure, blue, violet, magenta and pink from left to right; at 0.5 magenta, lime, green, aqua, cyan and azure. The lanes' wheel skips orange and yellow, which read brown in the dim cells at the back of the queue, and red, which marks an exit out of turn. The head of the queue is always near white.
// Knob 2: Speed. Beats a second: 2 at the opening, so the score moves 4 rows a second and the 64-beat cycle goes round in 32 s; 0.2 is a beat every 5 s, 3 a cycle in 21 s.
// Knob 3: Code. 0 is a 6-bit Beckett-Gray code: 64 states, one bit a beat, and every one of its 32 exits is the performer on stage longest. 1 is a 5-bit one, 32 beats, so the panel shows two cycles. 2 is four performers, as in Beckett's own Quad: no Beckett-Gray code exists for 4 bits (nor for 3), and this 16-beat cycle is one of the 96 of the 2688 directed cycles through the empty stage that break the rule only once, at the 14th switch, so the panel shows that one red exit four times. 3 is the reflected Gray code on 6 bits, in which 26 of the 32 exits are out of turn: the first lane leaves out of turn at 15 of its 16 exits, the second at 7 of 8, the third at 3 of 4 and the fourth at 1 of 2.
// Knob 4: Rows. Rows a beat on the panel: 2 at the opening, the whole 64-beat cycle in 128 rows; 4 shows 32 beats, 8 shows 16, each as an 8-row block.

const W = 64, H = 128;
const { floor, exp, max, min, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The now line: rows above it are the beats to come, rows below the beats
// just gone, and both scroll down through it.
const NOW = 96;

// The codes as the bit each beat switches, the last switch closing the
// cycle back to the empty stage. The two Beckett-Gray codes were found by a
// depth-first search that lets a performer leave only from the front of the
// queue; the same search over every 3- and 4-bit cycle finds none. The 4-bit
// cycle was the first of the fewest-violation ones in a search over all
// 2688 directed Hamiltonian cycles of the 4-cube through 0.
const CODES = [
  { n: 6, t: "0102101320102430232415323141502354310402535240415350241314505145" },
  { n: 5, t: "01020132010432104342132340412304" },
  { n: 4, t: "0102131202313203" },
  // Frank Gray's reflected code: switch k switches the lowest bit set in
  // k + 1, and the last one the top bit, back to the empty stage.
  { n: 6, t: null },
];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// Dim orange and yellow read brown, and red is kept for the exits out of
// turn, so the lanes' wheel runs from lime to pink and skips the rest.
const wheel = (h) => 0.25 + 0.69 * (h - floor(h));

// Play a code from the empty stage. For every beat: the state, the lane that
// switched as the beat began and how (1 enters, 2 leaves from the front of
// the queue, 3 leaves out of turn), and each lane's place in the queue, 0 for
// the one on stage longest, -1 for off stage. The checks a code must pass are
// counted on the way and kept with it: each state once, one bit a switch,
// back to the empty stage after the last switch, and the exits out of turn,
// none for the two Beckett-Gray codes.
function play(code) {
  const n = code.n, L = 1 << n;
  const t = new Int8Array(L);
  for (let k = 0; k < L; k++) t[k] = code.t ? code.t.charCodeAt(k) - 48 : k < L - 1 ? 31 - Math.clz32((k + 1) & -(k + 1)) : n - 1;
  const state = new Int32Array(L), ev = new Int8Array(L), kind = new Int8Array(L), rank = new Int8Array(L * n).fill(-1);
  const seen = new Uint8Array(L);
  let s = 0, repeats = 0, multi = 0, out = 0;
  const queue = [];
  for (let k = 0; k <= L; k++) {
    if (k > 0) {
      const b = t[k - 1];
      s ^= 1 << b;
      const kk = k % L;
      ev[kk] = b;
      if (s >> b & 1) (queue.push(b), (kind[kk] = 1));
      else {
        const at = queue.indexOf(b);
        kind[kk] = at === 0 ? 2 : 3;
        if (at !== 0) out++;
        queue.splice(at, 1);
      }
    }
    if (k === L) break;
    state[k] = s;
    if (seen[s]++) repeats++;
    for (let r = 0; r < queue.length; r++) rank[k * n + queue[r]] = r;
  }
  for (let k = 0; k < L; k++) {
    const x = state[k] ^ state[(k + 1) % L];
    if (!x || x & (x - 1)) multi++;
  }
  return { n, L, state, ev, kind, rank, out, ok: repeats === 0 && multi === 0 && s === 0 };
}

export function setup(params) {
  params.s = {
    hue: -1, code: -1, rows: 2, beat: 0, speed: 2,
    codes: CODES.map(play),
    col: new Float32Array(64 * 6 * 3), red: new Uint8Array(64 * 6), img: new Float32Array(W * H * 3),
  };
}

// Lane colours, one a performer, and the colour of a cell by its place in
// the queue: the newest on stage dimmest and most saturated, a step brighter
// each place it moves up, near white at the head.
function laneColour(S, C, k, i, out, o) {
  const r = C.rank[k * C.n + i];
  if (r < 0) return (out[o] = out[o + 1] = out[o + 2] = 0);
  const h = wheel(0.38 + 0.12 * i * (6 / C.n) + S.hue);
  if (r === 0) {
    hsv(h, 0.22, 1, out, o);
    return;
  }
  hsv(h, min(1, 0.62 + 0.07 * r), max(0.4, 0.92 - 0.12 * (r - 1)), out, o);
}

function colours(S) {
  const C = S.codes[S.code];
  for (let k = 0; k < C.L; k++)
    for (let i = 0; i < C.n; i++) {
      laneColour(S, C, k, i, S.col, (k * C.n + i) * 3);
      // The last beat on stage of a performer who leaves out of turn is red.
      const nx = (k + 1) % C.L;
      S.red[k * C.n + i] = C.ev[nx] === i && C.kind[nx] === 3 ? 1 : 0;
    }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 2], d = cl(dt || 0, 0, 0.1);
  const hue = cl(kv[0], 0, 1), code = cl(floor(cl(kv[2], 0, 3) + 0.5), 0, 3);
  S.speed = cl(kv[1], 0.2, 3);
  S.rows = cl(kv[3], 2, 8);
  if (hue !== S.hue || code !== S.code) {
    S.hue = hue;
    S.code = code;
    colours(S);
  }
  S.beat += d * S.speed;
  if (S.beat > 1e6) S.beat -= 64 * 4096;
}

// Lane i spans [x0, x0 + w).
function lanes(n) {
  const p = floor(60 / n), w = p - 2, m = (W - n * p) / 2 + 1;
  return { p, w, m };
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.code < 0) return;
  const C = S.codes[S.code], n = C.n, L = C.L, R = S.rows, b = S.beat, img = S.img;
  const { p, w, m } = lanes(n);
  img.fill(0);
  const mod = (k) => ((k % L) + L) % L;
  for (let y = 0; y < H; y++) {
    // Row y covers the beats from lo to hi; a row across a switch mixes the
    // two beats by how much of the row each takes, so the score slides
    // smoothly instead of jumping a row at a time.
    const hi = b + (NOW - y) / R, lo = hi - 1 / R;
    const k1 = floor(hi), k0 = floor(lo), f = k1 > k0 ? (hi - k1) * R : 1;
    const a0 = mod(k0), a1 = mod(k1);
    // The beats gone are dimmer, and the two rows at the now line show the
    // stage as it stands: performers on it brighter, empty places grey.
    const past = y >= NOW ? 0.55 : 1, line = y === NOW - 1 || y === NOW;
    let redRow = 0;
    for (let i = 0; i < n; i++) {
      const o0 = (a0 * n + i) * 3, o1 = (a1 * n + i) * 3;
      let cr = S.col[o1] * f + S.col[o0] * (1 - f), cg = S.col[o1 + 1] * f + S.col[o0 + 1] * (1 - f), cb = S.col[o1 + 2] * f + S.col[o0 + 2] * (1 - f);
      const red = S.red[a1 * n + i] * f + S.red[a0 * n + i] * (1 - f);
      if (red > 0) (cr += (1 - cr) * red), (cg -= (cg - 0.12) * red), (cb -= (cb - 0.08) * red);
      redRow = max(redRow, red);
      if (line) {
        if (cr + cg + cb > 0.05) (cr = cr * 0.75 + 0.25), (cg = cg * 0.75 + 0.25), (cb = cb * 0.75 + 0.25);
        else cr = cg = cb = 0.16;
      }
      const x0 = m + i * p;
      for (let x = x0; x < x0 + w; x++) {
        const q = (y * W + x) * 3;
        img[q] = cr * past;
        img[q + 1] = cg * past;
        img[q + 2] = cb * past;
      }
    }
    // Exits out of turn are marked in both margins as well.
    if (redRow > 0) for (const x of [0, 1, W - 2, W - 1]) (img[(y * W + x) * 3] = redRow * past), (img[(y * W + x) * 3 + 1] = 0.1 * redRow * past);
  }
  // The pulse: the lane that switched as this beat began flashes at the now
  // line, white for an entry, its own colour for an exit from the front of
  // the queue, red for an exit out of turn, and the flash runs out along the
  // now line to both edges.
  const kn = mod(floor(b + 1e-9)), ph = b + 1e-9 - floor(b + 1e-9), A = exp(-ph * 2.6);
  const i = C.ev[kn], kd = C.kind[kn], x0 = m + i * p, xc = x0 + (w - 1) / 2;
  const pc = [1, 1, 1];
  if (kd === 2) hsv(wheel(0.38 + 0.12 * i * (6 / n) + S.hue), 0.55, 1, pc, 0);
  else if (kd === 3) (pc[1] = 0.15), (pc[2] = 0.08);
  for (let y = NOW - 14; y < NOW + 12; y++)
    for (let x = 0; x < W; x++) {
      const dx = max(0, abs(x - xc) - w / 2), dy = y < NOW ? NOW - 1 - y : y - NOW;
      const g = A * (dx > 0 ? exp(-dx * dx / 8 - dy * dy / 3) + (dy === 0 ? 0.7 * exp(-dx / 12) : 0) : exp(-dy * dy / 40));
      if (g < 0.01) continue;
      const q = (y * W + x) * 3;
      for (let e = 0; e < 3; e++) img[q + e] += (pc[e] - img[q + e]) * min(1, g);
    }
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q += 3) display.setPixel(x, y, (255 * cl(img[q], 0, 1)) | 0, (255 * cl(img[q + 1], 0, 1)) | 0, (255 * cl(img[q + 2], 0, 1)) | 0);
}
