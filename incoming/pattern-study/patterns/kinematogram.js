// ===== Patternflow pattern =====
// Title:   Kinematogram
// Family:  type
// Idea:    The whole tall panel is random dots at one even density, and a word of large capitals stacked down it exists only as motion: the dots inside the letters drift up while the dots around them drift down, so any single frame is plain noise, and every few seconds the dots stop for a moment and the word is gone until they move again.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: random-dot kinematogram, a region of random dots displaced against its surround (Oliver Braddick, A short-range process in apparent motion, Vision Research, 1974), with motion coherence, the share of dots that carry the signal (William Newsome and Edmond Paré, 1988); capitals drawn for this pattern, pattern round 80
// Round:   80
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..7, Coherence=0..1
//
// Knob 1: Hue. Turns the three dot colours round the wheel together. At 0 they are pale teal, azure and pale gold; at 0.5 rose, amber and pale blue.
// Knob 2: Speed. At 2 the dots drift 10 LEDs a second, live 1.2 s on average, and the motion runs 3.6 s and stops for 1 s; every time goes as 2 / Speed.
// Knob 3: Word. 0 SEE, 1 MOVE, 2 NOW, 3 GO, 4 HIDE, 5 STOP, 6 LOOK, 7 FLY, stacked one letter above the next down the 128 rows: 56 rows a letter for GO, 37 for three letters and 28 for four.
// Knob 4: Coherence. The share of dots that drift with their sheet; the rest each go their own way at the same speed. The share is the knob to the power 0.25: half at the opening 0.06, where the word still reads, 84% at 0.5, all at 1, and none at 0, where nothing tells the letters from the ground and the word is gone even while the dots move.

// Braddick showed his observers two frames of random dots in which one
// region of the second frame was the first frame's dots moved a little.
// Each frame alone is noise; shown one after the other, the moved region
// stands out as a shape. Here that runs on: two sheets of dots, each
// covering the whole panel at the same density and wrapping round its
// edges, one drifting up and one drifting down. The panel shows the up sheet
// inside the letters and the down sheet everywhere else. A dot that drifts
// out of a letter is no longer shown, and the up sheet's dots that were
// hidden below the letter come in at its lower edge, so the density inside
// and outside stays the same in every frame.
//
// Every dot lives a while and is born again at a random place, so no dot's
// path runs long enough to trace a letter's outline in a still. Coherence
// is the share of dots that drift with their sheet; each of the others
// drifts at the same speed in a direction of its own. Which dots are which
// is drawn once at birth, so the knob changes where the dots go but never
// how many there are.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, cos, sin, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = 2 * PI;

// Dots in each sheet, drift in LEDs per second at Speed 2, mean life,
// and the run and the stop of the motion, in seconds at Speed 2.
const DOTS = 1900, V = 10, LIFE = 1.2, RUN = 3.6, STOP = 1;

const WORDS = ["SEE", "MOVE", "NOW", "GO", "HIDE", "STOP", "LOOK", "FLY"];

// Capitals as polylines on a grid 4 wide and 6 tall, y down.
const STROKES = {
  S: "4,1 3,0 1,0 0,1 0,2 1,3 3,3 4,4 4,5 3,6 1,6 0,5",
  E: "4,0 0,0 0,6 4,6|0,3 3,3",
  M: "0,6 0,0 2,3 4,0 4,6",
  O: "1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0",
  V: "0,0 2,6 4,0",
  N: "0,6 0,0 4,6 4,0",
  W: "0,0 1,6 2,2 3,6 4,0",
  G: "4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,3 2,3",
  H: "0,0 0,6|4,0 4,6|0,3 4,3",
  I: "2,0 2,6|1,0 3,0|1,6 3,6",
  D: "0,0 0,6 2.4,6 4,4.4 4,1.6 2.4,0 0,0",
  T: "0,0 4,0|2,0 2,6",
  P: "0,6 0,0 3,0 4,1 4,2 3,3 0,3",
  L: "0,0 0,6 4,6",
  K: "0,0 0,6|4,0 0,4|1.5,3 4,6",
  F: "4,0 0,0 0,6|0,3 3,3",
  Y: "0,0 2,3 4,0|2,3 2,6",
};

// The letters of a word as a mask over the panel, 1 inside a stroke.
function maskOf(word, out) {
  out.fill(0);
  const n = word.length, ch = H / n;
  const gap = n <= 2 ? 8 : n === 3 ? 6 : 4, lh = ch - gap, lw = n <= 2 ? 50 : 54, T = n <= 2 ? 11 : n === 3 ? 9 : 7;
  for (let k = 0; k < n; k++) {
    const x0 = (W - lw) / 2 + T / 2, y0 = k * ch + gap / 2 + T / 2, ux = (lw - T) / 4, uy = (lh - T) / 6;
    const segs = [];
    for (const line of STROKES[word[k]].split("|")) {
      const p = line.split(" ").map((t) => t.split(",").map(Number)).map(([gx, gy]) => [x0 + gx * ux, y0 + gy * uy]);
      for (let i = 1; i < p.length; i++) segs.push([p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]]);
    }
    const r2 = (T / 2) * (T / 2);
    for (let y = max(0, floor(k * ch)); y < min(H, floor((k + 1) * ch) + 1); y++)
      for (let x = 0; x < W; x++) {
        const px = x + 0.5, py = y + 0.5;
        for (const s of segs) {
          const dx = s[2] - s[0], dy = s[3] - s[1], L2 = dx * dx + dy * dy || 1e-9;
          const t = cl(((px - s[0]) * dx + (py - s[1]) * dy) / L2, 0, 1), ex = px - s[0] - t * dx, ey = py - s[1] - t * dy;
          if (ex * ex + ey * ey <= r2) {
            out[y * W + x] = 1;
            break;
          }
        }
      }
  }
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

function sheet() {
  const s = {
    x: new Float32Array(DOTS), y: new Float32Array(DOTS), age: new Float32Array(DOTS), life: new Float32Array(DOTS),
    u: new Float32Array(DOTS), dx: new Float32Array(DOTS), dy: new Float32Array(DOTS), c: new Uint8Array(DOTS),
  };
  for (let i = 0; i < DOTS; i++) {
    born(s, i);
    s.age[i] = Math.random() * s.life[i];
  }
  return s;
}

function born(s, i) {
  s.x[i] = Math.random() * W;
  s.y[i] = Math.random() * H;
  s.age[i] = 0;
  s.life[i] = LIFE * (0.4 + 1.2 * Math.random());
  s.u[i] = Math.random();
  const a = Math.random() * TAU;
  s.dx[i] = cos(a);
  s.dy[i] = sin(a);
  s.c[i] = floor(Math.random() * 3);
}

// Move a sheet on by d seconds at Speed 2, its signal going (vx, vy).
function drift(s, d, vx, vy, share) {
  for (let i = 0; i < DOTS; i++) {
    if (s.age[i] >= s.life[i]) born(s, i);
    let x = s.x[i], y = s.y[i];
    if (s.u[i] < share) {
      x += vx * d;
      y += vy * d;
    } else {
      x += s.dx[i] * V * d;
      y += s.dy[i] * V * d;
    }
    s.x[i] = x - floor(x / W) * W;
    s.y[i] = y - floor(y / H) * H;
    s.age[i] += d;
  }
}

export function setup(params) {
  params.s = { up: sheet(), down: sheet(), mask: new Uint8Array(N), ink: new Uint8Array(N), word: -1, clock: 0, share: 0.5, hue: 0 };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const w = round(cl(k[2] || 0, 0, 7));
  if (w !== S.word) {
    S.word = w;
    maskOf(WORDS[w], S.mask);
  }
  S.share = pow(cl(k[3] == null ? 0.06 : k[3], 0, 1), 0.25);
  const step = (d * speed) / 2;
  // The motion runs, then stops dead: nothing moves and nothing ages.
  const was = S.clock % (RUN + STOP);
  S.clock = (S.clock + step) % ((RUN + STOP) * 1000);
  const run = min(step, max(0, RUN - was));
  if (run > 0) {
    drift(S.up, run, 0, -V, S.share);
    drift(S.down, run, 0, V, S.share);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const ink = S.ink, mask = S.mask;
  ink.fill(0);
  // The down sheet shows outside the letters, the up sheet inside them.
  for (const [s, inside] of [[S.down, 0], [S.up, 1]]) {
    for (let i = 0; i < DOTS; i++) {
      const p = (floor(s.y[i]) % H) * W + (floor(s.x[i]) % W);
      if (mask[p] === inside) ink[p] = s.c[i] + 1;
    }
  }
  const pal = [[0, 0, 0], hsv(S.hue + 0.47, 0.5, 0.8), hsv(S.hue + 0.6, 0.6, 0.82), hsv(S.hue + 0.13, 0.4, 0.82)].map((c) => c.map((v) => round(v * 255)));
  for (let i = 0; i < N; i++) {
    const c = pal[ink[i]];
    display.setPixel(i % W, floor(i / W), c[0], c[1], c[2]);
  }
}
