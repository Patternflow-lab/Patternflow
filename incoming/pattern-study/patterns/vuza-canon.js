// ===== Patternflow pattern =====
// Title:   Vuza Canon
// Family:  rhythm
// Idea:    Twelve voices play the same six-note rhythm from twelve different entries in a cycle of 72 beats, scrolling up the panel one beat a row, and every row holds exactly one note, so the voices tile time with no beat doubled or missed while neither the rhythm nor the entries repeat inside the cycle.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: rhythmic tiling canons (Dan Tudor Vuza, 1991), the non-periodic factorisations of cyclic groups (Gyorgy Hajos, 1950; N. G. de Bruijn, 1953), pattern round 55
// Round:   55
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Canon=0..3, Focus=0..12
//
// Knob 1: Hue. Turns the six note colours round the wheel together. At 0 the six notes of the rhythm run gold, green, cyan, azure, violet and magenta in the order each voice plays them; at 0.5 they run blue, violet, red, orange, lime and cyan.
// Knob 2: Speed. Beats a second, 4.5 times the knob: 9 at 2, so a cycle of 72 passes the now line in 8 seconds; 0.9 at 0.2 (80 seconds) and 13.5 at 3 (5.3 seconds).
// Knob 3: Canon. 0 is Vuza's canon of Z72: the rhythm A = {0, 8, 16, 18, 26, 34}, gaps 8, 8, 2, 8, 8, 38, in 12 voices entering at B = {0, 1, 5, 6, 12, 25, 29, 36, 42, 48, 49, 53}. 1 swaps the roles: 6 voices entering at A play B, the same 72 notes in the same colours regrouped so each column is one colour. 2 is a tiling with the rhythm {0, 1, 8, 9, 16, 17} whose entries {0, 2, 4, 6} + {0, 24, 48} repeat every 24 beats, so the picture comes round three times a cycle. 3 is the plainest tiling, 6 consecutive beats in 12 voices 6 apart: one staircase.
// Knob 4: Focus. 0 lights every voice alike. 1 to 12 pick one voice: it is drawn white-cored with a stem joining its notes, and each of its notes rules a faint line across the panel, so its rhythm lies over the roll as a ruler (for Vuza's A, lines 8, 8, 2, 8 and 8 rows apart, then 38 rows of nothing), while the other voices narrow to two LEDs. With 6 voices, 1 and 2 pick the first, 3 and 4 the second, and so on.

const W = 64, H = 128, N = 72;
const { floor, min, max, exp, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The now line, with 104 beats of the past above it and 23 to come below.
const NOW = 104;
// The six note colours at knob 0, a sixth of the wheel apart from gold to
// magenta, skipping red and orange.
const HUES = [0.14, 0.3, 0.46, 0.6, 0.74, 0.88];

// Each canon as a rhythm played by voices at a set of entries, and which of
// the two the colours follow. A tiling has |A| x |B| = 72 and every sum
// a + b distinct mod 72; build() checks it and keeps the voice and colour
// of each beat.
const CANONS = [
  { rhythm: [0, 8, 16, 18, 26, 34], entries: [0, 1, 5, 6, 12, 25, 29, 36, 42, 48, 49, 53], colourBy: "rhythm" },
  { rhythm: [0, 1, 5, 6, 12, 25, 29, 36, 42, 48, 49, 53], entries: [0, 8, 16, 18, 26, 34], colourBy: "entries" },
  { rhythm: [0, 1, 8, 9, 16, 17], entries: [0, 2, 4, 6, 24, 26, 28, 30, 48, 50, 52, 54], colourBy: "rhythm" },
  { rhythm: [0, 1, 2, 3, 4, 5], entries: [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66], colourBy: "rhythm" },
];

function build(c) {
  const voice = new Int8Array(N).fill(-1), colour = new Int8Array(N), note = new Int8Array(N);
  c.rhythm.forEach((a, i) =>
    c.entries.forEach((b, j) => {
      const t = (a + b) % N;
      if (voice[t] >= 0) throw new Error("not a tiling");
      voice[t] = j;
      note[t] = i;
      colour[t] = c.colourBy === "rhythm" ? i : j;
    }),
  );
  return { voices: c.entries.length, voice, colour, note, entries: c.entries };
}
const TABLES = CANONS.map(build);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  params.s = {
    // p is the beat on the now line, counted from the start.
    p: 0, bps: 9, hue: 0, canon: 0, focus: 0, since: 0, last: 0,
    buf: new Float32Array(W * H * 3), pal: new Float32Array(18), palHue: -1,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(kv[0], 0, 1);
  s.bps = 4.5 * cl(kv[1], 0.2, 3);
  s.canon = round(cl(kv[2], 0, 3));
  s.focus = round(cl(kv[3], 0, 12));
  s.p += d * s.bps;
  const b = floor(s.p);
  if (b !== s.last) (s.last = b), (s.since = 0);
  else s.since += d;
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  const B = s.buf, P = s.pal;
  if (s.palHue !== s.hue) {
    for (let i = 0; i < 6; i++) hsv(HUES[i] + s.hue, 0.8, 1, P, i * 3);
    s.palHue = s.hue;
  }
  B.fill(0);
  const set = (x, y, r, g, b) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    B[o] = max(B[o], r);
    B[o + 1] = max(B[o + 1], g);
    B[o + 2] = max(B[o + 2], b);
  };
  const T = TABLES[s.canon], nv = T.voices, pitch = floor(60 / nv), lit = nv > 6 ? pitch - 1 : pitch - 2;
  const x0 = (W - pitch * nv + (pitch - lit)) >> 1;
  // With 6 voices, focus 1 and 2 pick the first, 3 and 4 the second.
  const fv = s.focus ? floor(((s.focus - 1) * nv) / 12) : -1;
  const now = floor(s.p), flash = exp(-s.since * 9);
  const mod = (b) => ((b % N) + N) % N;

  // The scale on the left: a tick every 8 beats, and a dotted line across
  // where a cycle of 72 begins.
  for (let y = 0; y < H; y++) {
    const b = now - (NOW - y), t = mod(b);
    if (t % 8 === 0) set(0, y, 0.3, 0.32, 0.38);
    if (t === 0) for (let x = 0; x < W; x += 2) set(x, y, 0.32, 0.34, 0.42);
  }
  // A dim lane down the middle of each voice's column, so the voices read as
  // columns between their notes. It also keeps a fifth of the panel lit:
  // with the notes alone the picture lit 7% and stretched the study map's
  // fill axis past its end.
  for (let v = 0; v < nv; v++) {
    const cx = x0 + v * pitch + (lit >> 1);
    for (let y = 0; y < H; y++) set(cx, y, 0.11, 0.115, 0.13);
  }
  // The focused voice rules a faint line across the panel at each of its
  // notes, so its rhythm reads as a ruler laid over the others, and a stem
  // joins its notes down its own column.
  if (fv >= 0) {
    const cx = x0 + fv * pitch + (lit >> 1);
    let prev = -1;
    for (let y = 0; y < H; y++) {
      const t = mod(now - (NOW - y));
      if (T.voice[t] !== fv) continue;
      for (let x = 2; x < W; x++) set(x, y, 0.2, 0.2, 0.24);
      if (prev >= 0) for (let yy = prev + 1; yy < y; yy++) set(cx, yy, 0.45, 0.45, 0.5);
      prev = y;
    }
  }
  // The notes: one a row, since the voices tile time.
  for (let y = 0; y < H; y++) {
    const b = now - (NOW - y), t = mod(b), v = T.voice[t], c = T.colour[t] * 3;
    const r = P[c], g = P[c + 1], bl = P[c + 2], xl = x0 + v * pitch;
    const future = y > NOW, hit = y === NOW;
    let a = xl, z = xl + lit;
    // Others narrow to their middle two LEDs while one voice is in focus,
    // and the beats still to come are drawn the same way.
    if ((fv >= 0 && v !== fv) || future) (a = xl + (lit >> 1) - 1), (z = a + 2);
    for (let x = a; x < z; x++) {
      if (fv === v && !future) {
        // White-cored: the middle LEDs whitened, the ends in the note colour.
        const core = x > xl && x < xl + lit - 1 ? 0.55 : 0;
        set(x, y, r + (1 - r) * core, g + (1 - g) * core, bl + (1 - bl) * core);
      } else set(x, y, r, g, bl);
    }
    if (hit) {
      // The note that sounds flashes white and throws a glow along the now
      // line in its colour.
      for (let x = xl - 2; x < xl + lit + 2; x++) {
        const k = x < xl || x >= xl + lit ? 0.6 * flash : flash;
        set(x, y, r + (1 - r) * k, g + (1 - g) * k, bl + (1 - bl) * k);
        set(x, y - 1, r * k, g * k, bl * k);
        set(x, y + 1, r * k, g * k, bl * k);
      }
      // The line itself is grey, coloured only near the note: a dim gold
      // line across the panel would read brown.
      for (let x = 0; x < W; x++) {
        const dd = x < xl ? xl - x : x >= xl + lit ? x - xl - lit + 1 : 0, k = 0.7 * flash * exp(-dd / 8);
        set(x, y, 0.26 + r * k, 0.27 + g * k, 0.3 + bl * k);
      }
    }
  }

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, min(255, round(B[o] * 255)), min(255, round(B[o + 1] * 255)), min(255, round(B[o + 2] * 255)));
}
