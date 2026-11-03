// ===== Patternflow pattern =====
// Title:   Rolling Shutter
// Family:  type
// Idea:    The panel is a camera sensor read one row at a time from the top down while a word spins about the centre like a baton or a propeller, or races sideways past leaning posts, so every row holds the word as it was when a faint scan line last passed it, and the spinning letters bend into arcs and spirals and the racing word leans the way the car leans in Lartigue's 1912 Grand Prix photograph.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: rolling-shutter distortion, a picture read out row by row while the subject moves, as in the forward-leaning car and the spectators leaning the other way in Jacques Henri Lartigue's photograph of a car at the Grand Prix of the Automobile Club de France (1912), taken with a focal-plane shutter; capitals drawn as stroke centre lines for this pattern; pattern round 100
// Round:   100
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Mode=0..2, Readout=0..1
//
// Knob 1: Hue. Turns the ink round the wheel. At 0 a row just read is cyan and a row read a whole sweep ago blue violet, so the colour tells how old each row is; at 0.5 the same runs from red to yellow. The scan line stays grey.
// Knob 2: Speed. At 2 the baton and the propeller turn 0.4 times a second, one turn in 2.5 s (25 s at 0.2, 1.7 s at 3), and the race word crosses the panel at 72 LEDs a second while the posts behind it run the other way at 96.
// Knob 3: Mode. 0 the baton, SHUTTER in 7 capitals 101 LEDs long and 17 tall, spinning about its middle; 1 a propeller of three blades with SPIN on each, tips 61 LEDs from the centre; 2 the race, GRAND over PRIX in 14-LED capitals, repeating every 100 LEDs, over dim upright posts 16 LEDs apart.
// Knob 4: Readout. The time one sweep of the scan line takes, 2.5 s times the square root of the knob: 0 is a global shutter and straight letters, the opening 0.06 a sweep of 0.61 s in which the baton turns 88 degrees, 0.25 a sweep of 1.25 s and 1 a sweep of 2.5 s, a whole turn at Speed 2, where the baton comes back to the same angle on every sweep and stands as a still spiral under the moving scan line.

// A rolling shutter does not take the whole picture at once. The sensor
// resets and reads its rows one after another, top to bottom, and row y
// holds the scene at the moment the readout reached it, y / 128 of a sweep
// after row 0. Anything that moves during the sweep is drawn at a
// different place in every row: a turning bar bends into a curve, and a
// thing crossing the frame shears, its bottom drawn later than its top.
// Jacques Henri Lartigue's 1912 photograph of a racing car is the famous
// case. His focal-plane shutter took the scene from the bottom up and he
// panned after the car, so the car leans forward with oval wheels and the
// spectators, sliding the other way through the frame, lean back. This
// sensor reads from the top, so the race word, moving right, leans back,
// and the posts lean the other way.
//
// The panel is the sensor as it is read. The scan line goes down one row
// at a time and the sweeps follow on with no pause; each row keeps what it
// read until the line comes round again. Row y is therefore
//
//   age = Readout * frac(phase - y / 128)
//
// seconds old, phase being how far the current sweep has gone: 0 just
// above the line and nearly a whole sweep just below it. Each row draws the
// word as it stood that long ago, so the picture tears at the scan line,
// where the newest row meets one a sweep old, and the line repaints the
// word as it passes. When the word comes back to the same place every
// sweep (a whole turn for the baton, a third of a turn for the propeller)
// the tear closes and the picture stands still, the stroboscope's trick.
//
// The capitals are centre lines in a box 4 units wide and 6 tall, drawn as
// a distance field with round ends, so they turn to any angle cleanly: an
// LED is ink where it lies within the stroke radius of a segment of its
// letter, with a one-LED soft edge.

const W = 64, H = 128;
const { floor, round, sqrt, cos, sin, max, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Capitals as centre lines in a box 4 wide and 6 tall, y down; each entry
// is a polyline of x, y pairs.
const FONT = {
  S: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 2, 1, 3, 3, 3, 4, 4, 4, 5, 3, 6, 1, 6, 0, 5]],
  H: [[0, 0, 0, 6], [4, 0, 4, 6], [0, 3, 4, 3]],
  U: [[0, 0, 0, 5, 1, 6, 3, 6, 4, 5, 4, 0]],
  T: [[0, 0, 4, 0], [2, 0, 2, 6]],
  E: [[4, 0, 0, 0, 0, 6, 4, 6], [0, 3, 3, 3]],
  R: [[0, 6, 0, 0, 3, 0, 4, 1, 4, 2, 3, 3, 0, 3], [2, 3, 4, 6]],
  P: [[0, 6, 0, 0, 3, 0, 4, 1, 4, 2, 3, 3, 0, 3]],
  I: [[1, 0, 3, 0], [2, 0, 2, 6], [1, 6, 3, 6]],
  N: [[0, 6, 0, 0, 4, 6, 4, 0]],
  A: [[0, 6, 0, 2, 2, 0, 4, 2, 4, 6], [0, 4, 4, 4]],
  G: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5, 4, 3, 2, 3]],
  D: [[0, 0, 0, 6, 3, 6, 4, 5, 4, 1, 3, 0, 0, 0]],
  X: [[0, 0, 4, 6], [4, 0, 0, 6]],
};

function segs(word) {
  return [...word].map((ch) => {
    const out = [];
    for (const pl of FONT[ch] || []) for (let i = 0; i + 3 < pl.length; i += 2) out.push([pl[i], pl[i + 1], pl[i + 2], pl[i + 3]]);
    return out;
  });
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// A set word: letters, scale in LEDs a unit, stroke radius, advance.
function setWord(word, sc, rad, gap) {
  const adv = 4 * sc + 2 * rad + gap;
  return { g: segs(word), sc, rad, adv, half: (adv * word.length) / 2, top: 3 * sc + rad + 1 };
}

// Ink of a set word at (u, v) LEDs from its centre, 0..1.
function ink(w, u, v) {
  if (v > w.top || v < -w.top) return 0;
  const q = u + w.half;
  if (q < 0 || q >= w.half * 2) return 0;
  const i = floor(q / w.adv);
  const lx = (q - i * w.adv - (w.adv - 4 * w.sc) / 2) / w.sc, ly = v / w.sc + 3;
  let best = 1e9;
  for (const s of w.g[i]) {
    const dx = s[2] - s[0], dy = s[3] - s[1], px = lx - s[0], py = ly - s[1];
    let h = (px * dx + py * dy) / (dx * dx + dy * dy);
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    const ex = px - dx * h, ey = py - dy * h, d = ex * ex + ey * ey;
    if (d < best) best = d;
  }
  return cl(w.rad + 0.5 - sqrt(best) * w.sc, 0, 1);
}

// The three words: SHUTTER for the baton, SPIN for each propeller blade
// (from 8 LEDs out), GRAND over PRIX for the race.
const BATON = setWord("SHUTTER", 2.2, 1.9, 2.2);
const BLADE = setWord("SPIN", 2.0, 1.8, 1.8), HUB = 8;
const RACE = [setWord("GRAND", 1.8, 1.8, 1.6), setWord("PRIX", 1.8, 1.8, 1.6)];
// Turns a second, race word and post speeds in LEDs a second, at Speed 1;
// the race word's repeat and the post spacing in LEDs.
const TURN = 0.2, WORD = 36, POSTS = 48, REPEAT = 100, GAP = 16;

export function setup(params) {
  params.s = { phase: 0, ang: 0, pos: 0, pan: 0, hue: 0, mode: 0, tr: 0.61, speed: 2 };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.mode = round(cl(k[2] == null ? 0 : k[2], 0, 2));
  S.tr = 2.5 * sqrt(cl(k[3] == null ? 0.06 : k[3], 0, 1));
  if (S.tr > 1e-3) S.phase = (S.phase + d / S.tr) % 1;
  S.ang = (S.ang + d * S.speed * TURN * TAU) % TAU;
  S.pos = (S.pos + d * S.speed * WORD) % REPEAT;
  S.pan = (S.pan + d * S.speed * POSTS) % GAP;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const tr = S.tr, mode = S.mode, om = S.speed * TURN * TAU;
  // How much of the readout to show: none at a global shutter, all from a
  // 0.4 s sweep up, so a fast sweep does not flicker.
  const k = cl(tr / 0.4, 0, 1);
  const scan = floor(S.phase * H);
  const post = hsv(S.hue + 0.68, 0.45, 0.22), blades = [];
  for (let y = 0; y < H; y++) {
    let a = S.phase - y / H;
    a -= floor(a);
    const age = tr * a;
    const col = hsv(S.hue + 0.5 + 0.2 * a * k, 0.65, 1);
    const yy = y - 63.5, now = y === scan && k > 0;
    // The scene as this row last saw it.
    const th = S.ang - om * age, c = cos(th), s = sin(th);
    if (mode === 1) for (let j = 0; j < 3; j++) blades[j] = [cos(th + (j * TAU) / 3), sin(th + (j * TAU) / 3)];
    const wx = S.pos - S.speed * WORD * age, px = S.pan - S.speed * POSTS * age;
    for (let x = 0; x < W; x++) {
      const xx = x - 31.5;
      let v = 0, bg = 0;
      if (mode === 0) v = ink(BATON, xx * c + yy * s, -xx * s + yy * c);
      else if (mode === 1) {
        for (let j = 0; j < 3; j++) {
          const u = xx * blades[j][0] + yy * blades[j][1];
          if (u > HUB - 3) v = max(v, ink(BLADE, u - HUB - BLADE.half, -xx * blades[j][1] + yy * blades[j][0]));
        }
      } else {
        let u = (xx - wx) % REPEAT;
        u = (u < 0 ? u + REPEAT : u) - REPEAT / 2;
        v = max(ink(RACE[0], u, yy + 9), ink(RACE[1], u, yy - 9));
        let pp = (x + px) % GAP;
        if (pp < 0) pp += GAP;
        bg = pp < 2 ? 1 : 0;
      }
      let r = max(v * col[0], bg * post[0]), g = max(v * col[1], bg * post[1]), b = max(v * col[2], bg * post[2]);
      // The row being read: a faint grey line, the ink on it near white.
      if (now) {
        const w = 0.3 * k + 0.7 * v;
        r = max(r, w);
        g = max(g, w);
        b = max(b, w);
      }
      display.setPixel(x, y, round(cl(r, 0, 1) * 255), round(cl(g, 0, 1) * 255), round(cl(b, 0, 1) * 255));
    }
  }
}
