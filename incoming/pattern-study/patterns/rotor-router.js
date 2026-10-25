// ===== Patternflow pattern =====
// Title:   Rotor-Router
// Family:  sim
// Idea:    Chips leave by turns from two sources on the centre column and walk by the arrow at every lit LED, each arrow turning a quarter turn before a chip leaves along it, and each chip stops on the first dark LED it reaches, so the lit set grows into a tall peanut with a smooth rim and a filling waist while the arrows inside, one colour for each direction, set into a lace of triangles and diagonals; when the shape reaches the sides it holds, dissolves from the rim inward and grows again.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: rotor-router walk, the Eulerian walkers of Vyatcheslav Priezzhev, Deepak Dhar, Abhishek Dhar and Supriya Krishnamurthy (1996), with the disk and smash sum of Lionel Levine and Yuval Peres (2009), pattern round 45
// Round:   45
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Join=0..1, Random=0..1
//
// Knob 1: Hue. Turns the four arrow colours round the wheel together: at 0 north is cream, east teal, south deep purple and west pink; at 0.5 east is crimson, south dark green and west aqua. North stays a pale tint.
// Knob 2: Speed. Arrow steps a frame, which grow with the shape so its area grows at a steady rate: at 2 the peanut of about 5,500 LEDs grows in 4.2 seconds, holds 1.3, dissolves in 1 and starts again 0.3 later; at 3 it grows in 2.8 seconds, at 0.2 in 42.
// Knob 3: Join. Slides the two sources together along the centre column: at 0 they sit on rows 40 and 87 and grow two disks that meet and fill in the waist; at 0.5 on rows 52 and 75 and the shape is an oval; at 1 on rows 64 and 63, side by side, and the chips grow one disk of about 2,800 LEDs, 60 across.
// Knob 4: Random. The chance that a step ignores its arrow and goes a random way, which then becomes the arrow, is the square of the knob: one step in 280 at 0.06, one in 16 at 0.25, every step at 1. At 1 the walk is internal DLA, the rim turns ragged and the lace inside turns to noise.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// Arrow directions N, E, S, W as steps on the LED index.
const STEP = [-W, 1, W, -1];
// The four arrow colours: hue at Hue 0, saturation, value. One pale, two
// strong and one dark: four hues alone at one brightness read as confetti on
// a 64 LED wide disk, and the brightness steps are what bring out the
// triangles and diagonals of the arrows.
const ARROW = [
  [0.1, 0.12, 1],
  [0.47, 1, 0.8],
  [0.8, 1, 0.6],
  [0.93, 0.65, 1],
];
// The sources sit on the centre column, mirrored about the middle of the
// panel; how far each one sits from the middle at Join 0.
const SX = 32, HALF = 24;
// How long the shape holds once it reaches a side, how long it takes to
// dissolve, and the dark pause before it grows again, in seconds at Speed 2.
const HOLD = 1.3, MELT = 1, PAUSE = 0.3;
// Steps a frame at Speed 1: A plus B for every lit LED. A chip's walk from
// a source to the rim takes about a sixth as many steps as there are lit
// LEDs, so this lets through about 20 chips a frame at any size and the area
// grows at a steady rate instead of slowing down as the shape gets big.
const A = 500, B = 3.4;

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, join: 0, rand: 0.0036,
    occ: new Uint8Array(N), rot: new Uint8Array(N), born: new Float32Array(N), key: new Float32Array(N),
    lit: 0, t0: 0, grown: 0, chip: -1, next: 0, src: [0, 0], gap: -1,
    phase: 0, clock: 0, cycle: 0, turn: 1,
    pal: null, palHue: NaN,
  };
  for (let i = 0; i < N; i++) params.s.key[i] = Math.random();
}

// Clear the lattice and set the arrows. The top half starts with every arrow
// one way and turns clockwise; the bottom half is its mirror image, its
// arrows reflected and turning the other way, so the two lobes come up as
// mirror images of each other. Each round starts from another direction and
// every fourth round swaps the turning, so the lace comes up new each time.
function start(S) {
  S.cycle++;
  const d0 = S.cycle & 3;
  S.turn = (S.cycle >> 2) & 1 ? 3 : 1;
  S.occ.fill(0);
  S.rot.fill(d0, 0, N / 2);
  S.rot.fill((2 - d0) & 3, N / 2);
  S.lit = 0;
  S.chip = -1;
  S.next = 0;
  S.gap = round(HALF * (1 - S.join));
  S.src = [(64 - S.gap) * W + SX, (63 + S.gap) * W + SX];
  S.phase = 0;
  S.clock = 0;
  S.t0 = S.t;
}

// Run up to `budget` steps of the walk. A chip on a lit LED turns that LED's
// arrow a quarter turn and steps where it now points; a chip on a dark LED
// stops and lights it, and the next chip leaves from the other source. The
// growth stops once a chip lights an LED one in from any side.
function walk(S, budget) {
  const occ = S.occ, rot = S.rot, p = S.rand, top = S.turn, bottom = 4 - S.turn, half = N / 2;
  let chip = S.chip;
  while (budget > 0) {
    if (chip < 0) {
      chip = S.src[S.next];
      S.next ^= 1;
    }
    if (!occ[chip]) {
      occ[chip] = 1;
      S.born[chip] = S.t;
      S.lit++;
      const x = chip % W, y = (chip / W) | 0;
      chip = -1;
      if (x <= 1 || x >= W - 2 || y <= 1 || y >= H - 2) {
        S.phase = 1;
        S.clock = 0;
        S.grown = S.t;
        break;
      }
      continue;
    }
    let d;
    if (p > 0 && Math.random() < p) d = (Math.random() * 4) | 0;
    else d = (rot[chip] + (chip < half ? top : bottom)) & 3;
    rot[chip] = d;
    chip += STEP[d];
    budget--;
  }
  S.chip = chip;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.join = cl(k[2], 0, 1);
  const r = cl(k[3], 0, 1);
  S.rand = r * r;
  S.t += d;
  if (S.cycle === 0) start(S);
  // Moving the sources by two LEDs or more sends the shape off to dissolve,
  // and the next one grows from the new places.
  if (S.phase < 2 && abs(round(HALF * (1 - S.join)) - S.gap) >= 2) {
    S.phase = 2;
    S.clock = 0;
    S.grown = S.t;
  }
  S.clock += (d * S.speed) / 2;
  if (S.phase === 0) walk(S, round(S.speed * (A + B * S.lit)));
  else if (S.phase === 1 && S.clock >= HOLD) (S.phase = 2), (S.clock = 0);
  else if (S.phase === 2 && S.clock >= MELT + PAUSE) start(S);
}

function palette(S) {
  S.pal = ARROW.map(([h0, s, v]) => {
    const h = h0 + S.hue - floor(h0 + S.hue);
    // A dark orange reads brown on LEDs, so a colour near orange is lifted
    // toward full brightness.
    const warm = max(0, 1 - abs(h - 0.08) / 0.1);
    return hsv(h, s, v + (1 - v) * warm);
  });
  S.palHue = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.cycle) return;
  if (S.palHue !== S.hue) palette(S);
  const pal = S.pal, occ = S.occ, rot = S.rot, born = S.born, key = S.key, t = S.t;
  // While it dissolves the rim goes first: an LED goes dark when its share of
  // the way from the first lit to the last lit, roughened by a fixed random
  // key, passes the melt.
  const melt = S.phase === 2 ? min(1, S.clock / MELT) : -1;
  const t0 = S.t0, span = max(0.01, S.grown - t0), fade = S.speed;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!occ[i]) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      if (melt >= 0 && 0.65 * cl((born[i] - t0) / span, 0, 1) + 0.35 * key[i] > 1 - melt) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const c = pal[rot[i]];
      // LEDs lit in the last half second (at Speed 2) are lifted toward
      // white, so the growing rim reads as a bright edge.
      const fresh = cl(1 - (t - born[i]) * fade, 0, 1) * 0.5;
      display.setPixel(x, y, round(255 * (c[0] + (1 - c[0]) * fresh)), round(255 * (c[1] + (1 - c[1]) * fresh)), round(255 * (c[2] + (1 - c[2]) * fresh)));
    }
  // The sources, white.
  for (const s of S.src) if (occ[s] && melt < 0) display.setPixel(s % W, (s / W) | 0, 255, 255, 255);
}
