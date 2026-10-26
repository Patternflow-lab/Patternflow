// ===== Patternflow pattern =====
// Title:   Hard Squares
// Family:  particle
// Idea:    Particles that may not touch hop on and off the LEDs as a hard-square lattice gas whose activity grows down the panel like pressure under gravity, so a sparse twinkling gas at the top thickens into a fluid and, below the row where the activity passes its critical 3.796, freezes into the checkerboard crystal, cyan on one sublattice and gold on the other, whose domain walls slowly coarsen.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: hard-square lattice gas (D. S. Gaunt and M. E. Fisher, 1965), its critical activity 3.796 (R. J. Baxter, I. G. Enting and S. K. Tsang, 1980), pattern round 58
// Round:   58
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Gravity=6..16, Activity=-1..1
//
// Knob 1: Hue. Turns both crystal colours round the wheel. At 0 a particle on the even sublattice is cyan and one on the odd sublattice gold; at 0.25 violet and green, at 0.5 red and blue, at 0.75 lime and magenta. The faint checker of empty sites stays slate above the critical row and plum below it.
// Knob 2: Speed. Sweeps a second, every site offered a particle or a vacancy once a sweep on average: 4 at 2, 0.4 at 0.2 and 6 at 3. At 4 a gas particle at the top lives about a quarter of a second, while the crystal's domains grow over minutes: in one run the bottom 20 rows went from half cyan and half gold to 95% one colour in nine minutes.
// Knob 3: Gravity. How fast the activity grows down the panel: at 6 it rises e^6, about 400 times, from 0.028 on the top row to 11 on the bottom row, with the critical 3.796 on row 104, so a gas, a fluid and a crystal stack up over the height. At 16 it rises e^16, the top 56 rows are all but empty and gas turns to crystal over the 40 rows between rows 64 and 104.
// Knob 4: Activity. Multiplies the activity on every row by e^(2.5 x): 1.16 at the opening 0.06. At -1 it is divided by 12, the bottom row only reaches 0.8 and the whole panel stays a gas; at 1 it is multiplied by 12, the critical row rises to row 55 and the crystal takes the lower 73 rows.
// Buttons: K1 tap empties the lattice. The gas comes back within a second and the crystal nucleates anew from the bottom up, in small domains of both colours.

const W = 64, H = 128, N = W * H;
const { floor, round, exp, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The critical activity of hard squares: below it the particles take both
// sublattices alike, above it most of them choose one.
const LC = 3.796;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

// Levels. Every particle has four empty neighbours, since no two touch. An
// empty site shows a faint checker: level 40 where x + y is even, dark
// where it is odd. A particle on an even site sits among dark LEDs and one
// on an odd site among LEDs at 40, so the odd one is drawn 40 brighter and
// both stand 110 above their neighbours: the measured detail does not care
// which sublattice a domain chose. Each pair of LEDs that touches a
// particle is a hard step and every other pair a soft step of 40, so the
// measured edges are about twice the density, 0.40 at the opening's 0.20.
const PE = 150, PO = 190;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, grav: 6, act: 0.06, acc: 0, warm: false, yc: H,
    occ: new Uint8Array(N), pOn: new Float32Array(H),
  };
}

// The activity lambda is exp(G y / 127) up to a constant, the barometric
// law, with lambda_c on row 107 before Activity shifts it. S.yc is the first
// row at or past lambda_c.
function profile(S) {
  const YF = 107;
  S.yc = -1;
  for (let y = 0; y < H; y++) {
    const lam = LC * exp((S.grav * (y - YF)) / (H - 1) + 2.5 * S.act);
    S.pOn[y] = lam / (1 + lam);
    if (lam >= LC && S.yc < 0) S.yc = y;
  }
  if (S.yc < 0) S.yc = H;
}

// Heat-bath (Glauber) moves: a random site whose four neighbours are empty
// is occupied with probability lambda / (1 + lambda), and any other site
// is emptied. The rows wrap round in x; above row 0 and below row 127 there
// is nothing.
function sweep(S, n) {
  const occ = S.occ, pOn = S.pOn;
  for (let i = 0; i < n; i++) {
    const p = floor(random() * N), x = p & 63, y = p >> 6;
    const free =
      !occ[y * W + ((x + 1) & 63)] && !occ[y * W + ((x + 63) & 63)] &&
      (y === 0 || !occ[p - W]) && (y === H - 1 || !occ[p + W]);
    occ[p] = free && random() < pOn[y] ? 1 : 0;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 6, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.grav = cl(k[2], 6, 16);
  S.act = cl(k[3], -1, 1);
  profile(S);
  if (input.btnPressed && input.btnPressed[0]) S.occ.fill(0);
  if (!S.warm) {
    // Open on a panel 150 sweeps after an empty start.
    sweep(S, 150 * N);
    S.warm = true;
  }
  S.acc += d * S.speed * 2 * N;
  const n = floor(S.acc);
  S.acc -= n;
  sweep(S, n);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const occ = S.occ;
  const ce = [0, 0, 0], co = [0, 0, 0], cb = [0, 0, 0], cc = [0, 0, 0];
  hsv(S.hue + 0.5, 1, PE / 255, ce);
  hsv(S.hue + 0.12, 1, PO / 255, co);
  // The faint checker turns from slate to plum on the row where lambda
  // passes lambda_c.
  hsv(0.6, 0.55, 40 / 255, cb);
  hsv(0.8, 0.45, 40 / 255, cc);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const even = ((x + y) & 1) === 0;
      const col = occ[p] ? (even ? ce : co) : even ? (y < S.yc ? cb : cc) : null;
      if (col) display.setPixel(x, y, round(col[0] * 255), round(col[1] * 255), round(col[2] * 255));
      else display.setPixel(x, y, 0, 0, 0);
    }
}
