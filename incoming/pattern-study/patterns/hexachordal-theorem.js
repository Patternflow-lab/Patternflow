// ===== Patternflow pattern =====
// Title:   Hexachordal Theorem
// Family:  rhythm
// Idea:    Six onsets in a cycle of twelve pulses play in the upper ring and the other six, the complementary rhythm, in the lower one, so every pulse sounds in exactly one of them; each pair of onsets is a chord across its ring coloured by how many pulses apart they are, and between the rings the pairs are counted into bars, the first rhythm's standing up and the complement's hanging down, and once a cycle an onset steps onto the rest beside it, the chords and bars change and the bars stay mirror images, as the hexachordal theorem says they must.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the hexachordal theorem, that six of the twelve pitch classes and the other six have the same interval content (Milton Babbitt, 1950s; David Lewin, Journal of Music Theory, 1959 and 1960), read as rhythm (Godfried Toussaint, The Geometry of Musical Rhythm, 2013); the opening set is 6-Z44 of Allen Forte's list (1973), the Schoenberg hexachord, whose complement is 6-Z19; pattern round 70
// Round:   70
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Pulses=12..20, Uneven=0..3
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the first rhythm's onsets are pale amber and the complement's pale azure, and the distances 1 to 6 run yellow, green, sea green, azure, violet and pink; at 0.5 the onsets are pale blue and pale peach and the distances run blue, violet, rose, orange, yellow-green and sea green.
// Knob 2: Speed. Pulses a second, twice the knob: 4 at 2, so a cycle of 12 takes 3 s and the rhythm moves once every 3 s; 0.4 at 0.2 (30 s a cycle), 6 at 3 (2 s). An onset that sounds swells, sends out a ring that widens to about 19 LEDs across as it fades, lights its chords and their blocks in the bars, and the light dies away in about 0.2 s.
// Knob 3: Pulses. The length of the cycle in even steps, 12, 14, 16, 18 or 20, with half the pulses in each rhythm, so 6 to 10 columns for the distances 1 to n/2 and 15 to 45 pairs a rhythm. The theorem holds for any even cycle filled half and half: of the 924 ways to choose 6 pulses of 12, 552 have a complement that is no turn or mirror image of them, and the bars still match; of the 12,870 ways to choose 8 of 16, 10,768.
// Knob 4: Uneven. Moves 0 to 3 onsets from the first rhythm to its complement, 5 against 7, 4 against 8 and 3 against 9 on twelve pulses, and the mirror breaks in the plainest way: the complement's bars grow by exactly 2 blocks a column for each onset moved, and the last column, the half cycle, by 1, the extra blocks drawn pale.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [(i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255, (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255, (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255];
}

// The first rhythm plays in the ring at the top, its complement in the ring
// at the bottom, and between them each distance between two onsets of a
// rhythm is a block in a bar: the first rhythm's bars stand up from the
// middle row, the complement's hang down.
const RING = [[32, 20], [32, 108]], R = 15.5, UP = 59, DOWN = 68;

const DIG = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"];

// The interval vector: how many pairs of onsets lie each distance apart
// round the cycle, distance being the shorter way, 1 to n/2. who is 1 for
// the first rhythm, 0 for its complement.
function pairsOf(memb, n, who) {
  const m = n / 2, by = [];
  for (let d = 0; d <= m; d++) by.push([]);
  for (let i = 0; i < n; i++)
    if (memb[i] === who)
      for (let j = i + 1; j < n; j++)
        if (memb[j] === who) {
          const d = min(j - i, n - j + i);
          by[d].push([i, j]);
        }
  return by;
}

function rebuild(S) {
  const n = S.n, m = n / 2, a = m - S.k;
  S.memb = new Int8Array(n);
  if (n === 12 && S.k === 0 && !S.opened) {
    // The opening hexachord, x x x . . x x . . x . . as a rhythm. Its
    // complement is no turn or mirror image of it, and has the same bars.
    for (const s of [0, 1, 2, 5, 6, 9]) S.memb[s] = 1;
    S.opened = true;
  } else {
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    for (let i = 0; i < a; i++) S.memb[idx[i]] = 1;
  }
  S.off = new Float32Array(n);
  S.mt = new Float32Array(n).fill(-9);
  S.flip = new Float32Array(n).fill(-9);
  S.fl = new Float32Array(n);
  S.last = -1;
  count(S);
  S.dA = S.vA.slice();
  S.dB = S.vB.slice();
}

function count(S) {
  S.pA = pairsOf(S.memb, S.n, 1);
  S.pB = pairsOf(S.memb, S.n, 0);
  S.vA = S.pA.map((l) => l.length);
  S.vB = S.pB.map((l) => l.length);
}

// One move a cycle: an onset of the first rhythm and the rest beside it
// change places, so one onset of each rhythm steps one pulse. The move that
// changes the bars is taken where there is one, and never the one that
// would undo the move before.
function move(S) {
  const n = S.n, cand = [];
  for (let i = 0; i < n; i++)
    if (S.memb[i] === 1)
      for (const j of [(i + 1) % n, (i + n - 1) % n])
        if (S.memb[j] === 0 && !(S.last >= 0 && ((S.lastA === j && S.lastB === i) || (S.lastA === i && S.lastB === j)))) cand.push([i, j]);
  if (!cand.length) return;
  const before = S.vA.join();
  const changing = cand.filter(([i, j]) => {
    S.memb[i] = 0, S.memb[j] = 1;
    const v = pairsOf(S.memb, n, 1).map((l) => l.length).join();
    S.memb[i] = 1, S.memb[j] = 0;
    return v !== before;
  });
  const pool = changing.length ? changing : cand;
  const [i, j] = pool[floor(Math.random() * pool.length)];
  S.memb[i] = 0;
  S.memb[j] = 1;
  // The dots slide the short way round, one pulse.
  const dj = (i - j + n) % n === 1 ? 1 : -1;
  S.off[j] = dj;
  S.off[i] = -dj;
  S.mt[i] = S.mt[j] = S.time;
  S.last = 1;
  S.lastA = j;
  S.lastB = i;
  count(S);
}

// Uneven moves onsets from the first rhythm to its complement, one change
// of colour each.
function balance(S) {
  const n = S.n, want = n / 2 - S.k;
  let a = 0;
  for (let i = 0; i < n; i++) a += S.memb[i];
  while (a !== want) {
    const from = a > want ? 1 : 0, opts = [];
    for (let i = 0; i < n; i++) if (S.memb[i] === from) opts.push(i);
    const s = opts[floor(Math.random() * opts.length)];
    S.memb[s] = 1 - from;
    S.flip[s] = S.time;
    a += from ? -1 : 1;
  }
  count(S);
}

export function setup(params) {
  params.hx = { n: 0, k: -1, P: 0, pulse: -1, time: 0, opened: false, buf: new Float32Array(N * 3) };
}

export function update(dt, input, params) {
  if (!params.hx) setup(params);
  const S = params.hx, kv = input.knobValues || [0, 2, 12, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  const n = 2 * round(cl(kv[2], 12, 20) / 2), k = round(cl(kv[3], 0, 3));
  if (n !== S.n) {
    S.n = n;
    S.k = k;
    rebuild(S);
  } else if (k !== S.k) {
    S.k = k;
    balance(S);
  }
  S.time += dt;
  S.P += dt * S.speed * 2;
  const pulse = floor(S.P);
  if (pulse !== S.pulse) {
    S.pulse = pulse;
    const s = pulse % S.n;
    if (s === 0 && pulse > 0) move(S);
    S.fl[s] = 1;
  }
  const decay = exp(-dt / cl(0.85 / (S.speed * 2), 0.14, 0.7)), ease = 1 - exp(-dt / 0.25);
  for (let i = 0; i < S.n; i++) S.fl[i] *= decay;
  for (let d = 0; d < S.vA.length; d++) {
    S.dA[d] += (S.vA[d] - S.dA[d]) * ease;
    S.dB[d] += (S.vB[d] - S.dB[d]) * ease;
  }
}

function plot(buf, x, y, c, a) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const p = (y * W + x) * 3;
  if (c[0] * a > buf[p]) buf[p] = c[0] * a;
  if (c[1] * a > buf[p + 1]) buf[p + 1] = c[1] * a;
  if (c[2] * a > buf[p + 2]) buf[p + 2] = c[2] * a;
}

function line(buf, x0, y0, x1, y1, c, a) {
  const n = max(1, Math.ceil(max(abs(x1 - x0), abs(y1 - y0)) * 1.5));
  for (let i = 0; i <= n; i++) plot(buf, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c, a);
}

function disc(buf, cx, cy, r, c, a) {
  for (let y = floor(cy - r - 1); y <= cy + r + 1; y++)
    for (let x = floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = sqrt((x - cx) ** 2 + (y - cy) ** 2);
      plot(buf, x, y, c, a * cl(r + 0.5 - d, 0, 1));
    }
}

function ring(buf, cx, cy, r, c, a) {
  const n = max(24, floor(r * 7));
  for (let i = 0; i < n; i++) plot(buf, cx + r * cos((2 * PI * i) / n), cy + r * sin((2 * PI * i) / n), c, a);
}

function digit(buf, x, y, v, c, a) {
  const s = String(v);
  let w = 0;
  for (const ch of s) w += ch === "1" && s.length > 1 ? 2 : 4;
  let cx = x - floor((w - 1) / 2);
  for (const ch of s) {
    const g = DIG[+ch], narrow = ch === "1" && s.length > 1;
    for (let r = 0; r < 5; r++)
      for (let q = 0; q < 3; q++) if (g[r * 3 + q] === "1" && !(narrow && q !== 1)) plot(buf, cx + q - (narrow ? 1 : 0), y + r, c, a);
    cx += narrow ? 2 : 4;
  }
}

export function draw(display, params) {
  const S = params.hx;
  if (!S || !S.memb) return;
  const buf = S.buf, n = S.n, m = n / 2, h0 = S.hue, t = S.time;
  buf.fill(0);
  const cA = hsv(h0 + 0.11, 0.5, 1), cB = hsv(h0 + 0.58, 0.5, 1), grey = hsv(h0 + 0.6, 0.25, 0.32);
  const cls = [];
  for (let d = 0; d <= m; d++) cls.push(hsv(h0 + 0.15 + (0.77 * (d - 1)) / max(1, m - 1), 0.78, 1));
  // Where each step's dot is drawn: a dot that has just moved slides there
  // over 0.35 s.
  const pos = (s, which) => {
    const u = cl((t - S.mt[s]) / 0.35, 0, 1), e = u * u * (3 - 2 * u), q = s + S.off[s] * (1 - e);
    const a = -PI / 2 + (2 * PI * q) / n, C = RING[which];
    return [C[0] + R * cos(a), C[1] + R * sin(a)];
  };
  const head = S.P - floor(S.P / n) * n;
  for (let w = 0; w < 2; w++) {
    const who = w === 0 ? 1 : 0, C = RING[w], P = w === 0 ? S.pA : S.pB, col = w === 0 ? cA : cB;
    // A soft light spreads from an onset as it sounds, so the beat answers
    // between the two rings from across the room.
    for (let s = 0; s < n; s++)
      if (S.memb[s] === who && S.fl[s] > 0.04) {
        const [x, y] = pos(s, w), f = S.fl[s];
        for (let yy = max(0, floor(y - 13)); yy <= min(H - 1, y + 13); yy++)
          for (let xx = max(0, floor(x - 13)); xx < min(W, x + 13); xx++) {
            const d2 = (xx - x) ** 2 + (yy - y) ** 2;
            if (d2 < 169) plot(buf, xx, yy, col, 0.3 * f * exp(-d2 / 45));
          }
      }
    ring(buf, C[0], C[1], R, grey, 1);
    // Every pair of onsets is a chord, coloured by its distance, and lights
    // when either end of it sounds; the rest of the ring's chords brighten a
    // little with it, so the ring that is playing reads at a glance.
    let rf = 0;
    for (let s = 0; s < n; s++) if (S.memb[s] === who && S.fl[s] > rf) rf = S.fl[s];
    for (let d = 1; d <= m; d++)
      for (const [i, j] of P[d]) {
        const [x0, y0] = pos(i, w), [x1, y1] = pos(j, w), f = max(S.fl[i], S.fl[j]);
        line(buf, x0, y0, x1, y1, cls[d], 0.26 + 0.2 * rf + 0.54 * f);
      }
    for (let s = 0; s < n; s++) {
      const [x, y] = pos(s, w), fu = cl((t - S.flip[s]) / 0.4, 0, 1);
      if (S.memb[s] === who) {
        const f = S.fl[s];
        disc(buf, x, y, 2.1 + 1.2 * f, col, (0.62 + 0.38 * f) * (0.3 + 0.7 * fu));
        if (f > 0.05) ring(buf, x, y, 3 + 7 * (1 - f), col, 0.8 * f);
      } else plot(buf, x, y, grey, 1.6);
    }
    // The beat, going round both rings at once with a tail one pulse long.
    for (let j = 0; j <= 16; j++) {
      const a = -PI / 2 + (2 * PI * (head - j / 16)) / n;
      plot(buf, C[0] + (R + 3) * cos(a), C[1] + (R + 3) * sin(a), [255, 255, 255], 0.9 * (1 - j / 17));
    }
    {
      const a = -PI / 2 + (2 * PI * head) / n;
      disc(buf, C[0] + (R + 3) * cos(a), C[1] + (R + 3) * sin(a), 0.9, [255, 255, 255], 0.9);
    }
  }
  // The bars. Each block is one pair of onsets, the pairs of a distance
  // stacked in order of their first onset; a block lights with its chord.
  const slot = floor(62 / m), bw = slot - 2, x00 = floor((W - slot * m) / 2) + floor((slot - bw) / 2);
  const hu = max(1, min(3, floor(19 / (m + S.k))));
  for (let d = 1; d <= m; d++) {
    const x0 = x00 + (d - 1) * slot;
    digit(buf, x0 + floor((bw - 1) / 2), 61, d, grey, 1.9);
    for (let w = 0; w < 2; w++) {
      const v = w === 0 ? S.dA[d] : S.dB[d], P = w === 0 ? S.pA[d] : S.pB[d], other = w === 0 ? S.dB[d] : S.dA[d];
      for (let b = 0; b < Math.ceil(v - 0.02); b++) {
        const part = min(1, v - b), pr = P[b], f = pr ? max(S.fl[pr[0]], S.fl[pr[1]]) : 0;
        // Where one rhythm has more pairs than the other, the extra blocks
        // are drawn pale: with Uneven at k they come to 2k in every column
        // but the last, where they are k.
        const extra = b >= other - 0.02, c = extra ? hsv(h0 + 0.6, 0.12, 1) : cls[d];
        const rows = hu >= 2 ? hu - 1 : 1;
        for (let r = 0; r < rows * part; r++) {
          const y = w === 0 ? UP - b * hu - r : DOWN + b * hu + r;
          for (let x = x0; x < x0 + bw; x++) plot(buf, x, y, c, (extra ? 0.55 : 0.5) + 0.5 * f);
        }
      }
      // The count itself at the end of the bar, the interval vector read
      // off one digit a column.
      const tip = max(0, v) * hu, cnt = w === 0 ? S.vA[d] : S.vB[d];
      digit(buf, x0 + floor((bw - 1) / 2), w === 0 ? round(UP - tip - 5) : round(DOWN + tip + 1), cnt, cls[d], 0.55);
    }
  }
  for (let p = 0, i = 0; p < N; p++, i += 3) display.setPixel(p % W, (p / W) | 0, 3 + buf[i], 4 + buf[i + 1], 10 + buf[i + 2]);
}
