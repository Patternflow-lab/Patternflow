// ===== Patternflow pattern =====
// Title:   Infinity Series
// Family:  rhythm
// Idea:    Per Nørgård's infinity series falls down four piano-roll lanes onto a strike line, the same melody in each at one, two, four and eight notes to the beat, and on every beat the four lanes land together: the four-to-the-beat lane on the very note the one-to-the-beat lane plays, the two- and eight-to-the-beat lanes on its mirror image, because every fourth note of the series plays the series again and every second note plays it upside down.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Per Nørgård's infinity series (1959), pattern round 38
// Round:   38
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Beat=8..40, Start=0..1
//
// Knob 1: Hue. Turns the two colours of the notes on the beat round the wheel together: the lanes of 1 and 4, whose notes on the beat are the melody, in one; the lanes of 2 and 8, whose notes on the beat are the melody upside down, in the other. At 0 azure and rose; at 0.25 magenta and butter yellow; at 0.5 orange and mint; at 0.75 green and violet. The notes between the beats are the lane's colour paled 55% toward white.
// Knob 2: Speed. The tempo, 60 times Speed beats a minute: 120 at 2, so the lane of 8 plays 16 notes a second and the panel scrolls 16 rows a second at Beat 8; 12 at 0.2, 180 at 3. After 512 beats the roll goes back to Start.
// Knob 3: Beat. Rows to a beat, 8 to 40 in steps of 8. At 8 thirteen beats stand above the strike line, lane 1's notes are 7 rows long and the lane of 8's one row; at 16 six and a half beats; at 40 two and a half, lane 1's notes 39 rows long and the lane of 8's five.
// Knob 4: Start. Where in the series the roll starts. Up to 0.06 at note 0, so it opens on 0, 1, -1, 2, 1, 0, -2, 3; above that at beat 16 to beat 496 in steps of 16. Further in, the melody wanders further from the middle: at most one note in 30 lies past seven steps, and it is drawn dimmer on the lane's edge.

const W = 64, H = 128;
// Lanes: four, 16 columns each; pitches -7..7 on columns 0..14 of the lane,
// pitch 0 on column 7, column 15 dark between lanes.
const LANES = 4, LW = 16, PMAX = 7, RATE = [1, 2, 4, 8];
// The strike line: notes fall onto row SY and fade out below it.
const SY = 104;
// Brightness of the held note on the beat behind the faster lanes.
const HOLD = 0.34;
const NA = 1 << 16;
const { floor, min, max, abs, round, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The series: a(0) = 0, a(2n) = -a(n), a(2n + 1) = a(n) + 1.
const A = new Int8Array(NA);
for (let n = 1; n < NA; n++) A[n] = n & 1 ? A[n >> 1] + 1 : -A[n >> 1];
const ser = (n) => A[((n % NA) + NA) % NA];

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

export function setup(params) {
  params.s = {
    init: false, beat: 0, start: 0, speed: 2, rpb: 8, hue: 0,
    R: new Float32Array(W * H), G: new Float32Array(W * H), B: new Float32Array(W * H),
    up: [0, 0, 0], dn: [0, 0, 0], upOff: [0, 0, 0], dnOff: [0, 0, 0], upHold: [0, 0, 0], dnHold: [0, 0, 0], warm: [0, 0],
  };
}

function startBeat(k) {
  // Up to 0.06 note 0; above, beat 16 to 496 in steps of 16.
  const u = cl(k, 0, 1);
  return u <= 0.06 ? 0 : 16 * max(1, round(((u - 0.06) / 0.94) * 31));
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 8, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.rpb = 8 * cl(round(cl(k[2], 8, 40) / 8), 1, 5);
  const st = startBeat(k[3]);
  // The roll opens with the start beat 1.5 beats above the strike line; a
  // new Start jumps there.
  if (!S.init || st !== S.start) {
    S.start = st;
    S.beat = st - 1.5;
    S.init = true;
  }
  S.beat += d * S.speed;
  // After 512 beats the roll goes back to its start, so the fastest lane
  // reads no further than note 8 x 1008 = 8064, and no more than one note in
  // 30 lies past seven steps from the middle.
  if (S.beat > S.start + 512) S.beat -= 512 + 1.5;
}

// Adds light to one LED; the dark column between lanes stays dark.
function add(S, x, y, c, v) {
  if (x < 0 || x >= W || y < 0 || y >= H || v <= 0 || (x & 15) === 15) return;
  const p = y * W + x;
  S.R[p] += c[0] * v;
  S.G[p] += c[1] * v;
  S.B[p] += c[2] * v;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.init) return;
  const { R, G, B, up, dn, upOff, dnOff, upHold, dnHold, warm } = S;
  R.fill(0);
  G.fill(0);
  B.fill(0);
  // The melody as it is, the melody upside down, and the notes between beats.
  hsv(S.hue + 0.57, 0.8, 1, up);
  hsv(S.hue + 0.93, 0.62, 1, dn);
  // How far each colour is into orange or yellow, 0 to 1. Those are lifted
  // toward white so they read amber or butter, not brown or olive, most of
  // all in the dim held notes.
  [up, dn].forEach((c, i) => {
    const w = cl(2.5 * (min(c[0], c[1]) - c[2]), 0, 1);
    warm[i] = w;
    for (let j = 0; j < 3; j++) c[j] = c[j] + (1 - c[j]) * 0.3 * w;
  });
  for (let j = 0; j < 3; j++) {
    // The notes between the beats: the lane's colour taken 55% toward white.
    upOff[j] = 0.55 + 0.45 * up[j];
    dnOff[j] = 0.55 + 0.45 * dn[j];
    // The held notes: the colour itself, or up to 45% toward white and 1.6
    // times as bright in orange and yellow.
    upHold[j] = (up[j] + (1 - up[j]) * 0.45 * warm[0]) * HOLD * (1 + 0.6 * warm[0]);
    dnHold[j] = (dn[j] + (1 - dn[j]) * 0.45 * warm[1]) * HOLD * (1 + 0.6 * warm[1]);
  }
  const T = S.beat, rpb = S.rpb, white = [1, 1, 1];

  // Guides: each lane's pitch 0, the mirror line, and a line on every beat.
  const grey = [0.55, 0.6, 0.75];
  for (let l = 0; l < LANES; l++) for (let y = 0; y < H; y++) add(S, l * LW + PMAX, y, grey, 0.1);
  const b0 = floor(T - (H - SY) / rpb) - 1, b1 = floor(T + SY / rpb) + 1;
  for (let b = b0; b <= b1; b++) {
    const y = round(SY - (b - T) * rpb);
    for (let x = 0; x < W; x++) if ((x & 15) !== 15) add(S, x, y, grey, 0.13);
  }

  for (let l = 0; l < LANES; l++) {
    const s = RATE[l], x0 = l * LW, len = rpb / s;
    // Notes on the beat in this lane play +a(m) (rates 1, 4) or -a(m) (2, 8).
    const onC = l & 1 ? dn : up, offC = l & 1 ? dnOff : upOff, holdC = l & 1 ? dnHold : upHold, lw = warm[l & 1];
    // Behind the lane's own notes, each note on the beat is held dim for the
    // whole beat: the series read at the lane's step, which lands on lane
    // 1's note in the lanes of 4 and on its mirror image in the lanes of 2
    // and 8.
    if (s > 1)
      for (let m = max(0, b0); m <= b1; m++) {
        const a = ser(s * m), px = x0 + PMAX + cl(a, -PMAX, PMAX), yb = SY - (m - T) * rpb;
        const ye = round(yb);
        for (let y = ye - rpb + 1; y < ye; y++) {
          if (y < 0 || y >= H) continue;
          const fade = y > SY ? 1 - (0.85 * (y - SY)) / (H - SY) : 1;
          add(S, px, y, holdC, fade);
          add(S, px - 1, y, holdC, 0.75 * fade);
          add(S, px + 1, y, holdC, 0.75 * fade);
        }
      }
    const n0 = floor((T - (H - SY) / rpb) * s) - 1, n1 = floor((T + SY / rpb) * s) + 1;
    for (let n = max(0, n0); n <= n1; n++) {
      const a = ser(n), px = x0 + PMAX + cl(a, -PMAX, PMAX), on = n % s === 0;
      // Rows the note covers: its onset at the bottom, the next onset at the top.
      const yb = SY - (n / s - T) * rpb, yt = yb - len;
      const gap = len >= 3 ? 1 : 0;
      const c = on ? onC : offC, core = on ? 0.95 : 0.42 * (1 + 0.4 * lw), side = on ? 0.7 : 0.2 * (1 + 0.4 * lw);
      const clip = abs(a) > PMAX ? 0.55 : 1;
      // How long since this note struck, in beats: a flash that dies in about
      // a sixth of a beat, longer for a downbeat.
      const age = T - n / s, flash = age >= 0 && age < 1 ? exp(-age * (on ? 9 : 16)) : 0;
      // Rows are rounded at both ends, so a note of one row never drops out.
      const ye = round(yb);
      for (let y = round(yt) + gap; y < ye; y++) {
        if (y < 0 || y >= H) continue;
        // Below the strike line the note has sounded and fades out.
        const fade = y > SY ? 1 - (0.85 * (y - SY)) / (H - SY) : 1;
        const lit = (y >= SY - 2 ? 1 + 1.6 * flash : 1) * fade * clip;
        add(S, px, y, c, core * lit);
        add(S, px - 1, y, c, side * lit);
        add(S, px + 1, y, c, side * lit);
        if (y >= SY - 2 && flash > 0) add(S, px, y, white, 0.5 * flash * fade);
      }
      // The struck key on the strike line, and its glow on either side.
      if (flash > 0) {
        for (let dx = -2; dx <= 2; dx++) {
          const g = (on ? 1 : 0.5) * flash * (dx === 0 ? 1 : abs(dx) === 1 ? 0.55 : 0.2);
          add(S, px + dx, SY, white, 0.5 * g);
          add(S, px + dx, SY, c, 0.8 * g);
          add(S, px + dx, SY + 1, c, 0.35 * g);
        }
      }
    }
  }

  // The strike line itself, a dim rule across each lane.
  for (let x = 0; x < W; x++) if ((x & 15) !== 15) add(S, x, SY, grey, 0.16);

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      display.setPixel(x, y, round(255 * min(1, R[p])), round(255 * min(1, G[p])), round(255 * min(1, B[p])));
    }
}
