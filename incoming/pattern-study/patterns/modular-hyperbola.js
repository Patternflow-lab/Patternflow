// ===== Patternflow pattern =====
// Title:   Modular Hyperbola
// Family:  number
// Idea:    The multiplication table of the integers mod a prime p fills the panel, column x + 1 times row y, and every LED stands on one sawtooth of the residues, white where the product is a running residue c and falling through a cubehelix ramp to black just before it comes round to c again, so the hard white edges trace the modular hyperbola xy = c (mod p): at p = 127, 32 true hyperbolas nested round the top left corner and their mirror round the bottom left, with checks along the middle row and the last column where x and y are near p/2, and, with the tooth narrowed to two residues, a scatter of points that lands a fair share in every patch of the table.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the modular hyperbola xy = c (mod p), whose points in a box are counted with Kloosterman sums (Hendrik Kloosterman, 1926) and Weil's bound on them (Andre Weil, 1948); cubehelix colour ramp (Dave Green, 2011), pattern round 81
// Round:   81
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Prime=-3..4, Band=0..1
//
// Knob 1: Hue. Where the cubehelix ramp starts its turn round the colour wheel. At 0 a tooth climbs from black through violet, blue, teal and green to pale pink and white; at 0.25 through brown, mauve and sky blue; at 0.5 through moss, rose and lilac; at 0.75 through navy, green and salmon. The top of every tooth is white whatever the hue.
// Knob 2: Speed. c climbs through all p residues in 12 / Speed seconds whatever the prime: 6 s at the opening 2, 60 s at 0.2 and 4 s at 3. At p = 127 and Speed 2 that is 21 residues a second.
// Knob 3: Prime. -3 is 13, -2 is 31, -1 is 61, the opening 0 is 127, 1 is 251, 2 is 509, 3 is 1021 and 4 is 2039, each the largest prime under a power of two. At 127 the 128 rows hold every residue once with the zero row at the top and again at the bottom, and the lower half is the upper half upside down. At 13 the table repeats as a 13 by 13 tile, and at 2039 the product stays under p over 59% of the panel, so the top left is plain hyperbolas.
// Knob 4: Band. How much of each tooth is lit: p - Band^2 (p - 2) residues of the p. The whole tooth at 0 and at the opening 0.06, three quarters at 0.5, and at 1 only the residues c and c + 1, so what is left is the hyperbola itself; at p = 127 that is one LED in every column for each of the two.

// The integers mod a prime p, multiplied. LED (x, y) holds the residue
// (x + 1) y mod p: columns count 1 to 64 and rows 0 to 127, so the top row
// is the row of zeros. A running residue c, a real number, lights every LED
// by how far its residue r has to go back to reach c:
//
//   t = 1 - ((r - c) mod p) / p
//
// t is 1 on the residue just above c and falls to 0 on the one just below,
// so wherever the residue steps from c - 1 to c the picture steps from black
// to white. Those steps are the modular hyperbola xy = c (mod p).
//
// Each tooth is the band between two hyperbolas xy = c + kp and
// xy = c + (k + 1)p. Row y is a sawtooth in x of y/p cycles an LED, and
// column x one of (x + 1)/p cycles down, so at p = 127 the whole upper
// half stays under half a cycle an LED both ways and its 32 teeth are true
// hyperbolas, nested round the top left corner. Near y = p/2 a row is
// almost two LEDs a cycle and reads as a check; near p/3 every third LED
// lines up; and the rows round each fraction a/b with a small b repeat
// every b LEDs, the Farey fractions in order down the panel. The table is the same read
// across, so at p = 127 the last column, x + 1 = 64 = (p + 1) / 2, is a
// check too: 64 is the inverse of 2 mod 127, and the column holds y/2.
//
// Row p - y holds -xy. At p = 127 row 127 - y is row y with the residue
// negated, so the lower half is the upper half upside down, with the ramp
// run backwards and c read as -c.
//
// c climbs through the residues, a full turn in 12 / Speed seconds. Near
// the corner the hyperbolas spread out smoothly; elsewhere every whole step
// of c moves the white set to a new scatter of points. Counting the points
// of xy = c in a box of X columns and Y rows comes down to Kloosterman sums
// (Hendrik Kloosterman, 1926), and Weil's bound on them (Andre Weil, 1948),
// no bigger than 2 sqrt(p), keeps every box within a few sqrt(p) log^2 p of
// its fair share XY / p. Band narrows the lit part of the tooth until only
// that scatter is left.
//
// The ramp is Dave Green's cubehelix (2011): brightness rises from black to
// white while the colour turns round a helix about the grey line, so all
// three channels change along the tooth. A hue wheel scaled by brightness
// was measured too: every LED then has one channel at 0, deflate packs the
// frame in 1.91 bytes a pixel instead of 2.39, and the colour runs to 0.56.

const W = 64, H = 128;
const { floor, round, cos, sin, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The largest prime under 2^k, for k = 4 to 11.
const PRIMES = [13, 31, 61, 127, 251, 509, 1021, 2039];
// Cubehelix: turns of the helix over the ramp, its width, and a gamma that
// keeps the dark third of the tooth short.
const ROT = 1.2, AMP = 1.0, GAMMA = 1.25;

function helix(l, s, o) {
  l = pow(l, GAMMA);
  const phi = 2 * PI * (s / 3 - ROT * l), a = (AMP * l * (1 - l)) / 2, c = cos(phi), sn = sin(phi);
  o[0] = l + a * (-0.14861 * c + 1.78277 * sn);
  o[1] = l + a * (-0.29227 * c - 0.90649 * sn);
  o[2] = l + a * (1.97294 * c);
  return o;
}

export function setup(params) {
  params.s = {
    c: 0, p: 127, hue: 0, speed: 2, band: 0.06,
    lut: new Uint8Array(256 * 3), lh: -1, o: [0, 0, 0],
    m: new Int32Array(W * H), mp: -1,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.p = PRIMES[cl(round(k[2] || 0), -3, 4) + 3];
  S.band = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  S.c += (d * S.speed * S.p) / 12;
  S.c -= floor(S.c / S.p) * S.p;
}

// The 256 steps of the tooth's ramp, rebuilt when Hue turns. The 0.37
// keeps the opening hue off a red start.
function ramp(S) {
  if (S.lh === S.hue) return;
  S.lh = S.hue;
  for (let i = 0; i < 256; i++) {
    helix(i / 255, 3 * (S.hue + 0.37), S.o);
    for (let j = 0; j < 3; j++) S.lut[i * 3 + j] = round(cl(S.o[j], 0, 1) * 255);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  ramp(S);
  const p = S.p, M = S.m, L = S.lut;
  // The table itself changes only with the prime.
  if (S.mp !== p) {
    S.mp = p;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) M[y * W + x] = ((x + 1) * y) % p;
  }
  // The lit part of the tooth, in residues: p at Band 0, 2 at Band 1.
  const fp = (1 - S.band * S.band * (1 - 2 / p)) * p, c = S.c;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r = M[y * W + x] - c;
      if (r < 0) r += p;
      const t = r < fp ? 1 - r / fp : 0;
      const i = round(t * 255) * 3;
      display.setPixel(x, y, L[i], L[i + 1], L[i + 2]);
    }
}
