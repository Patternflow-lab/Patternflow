// ===== Patternflow pattern =====
// Title:   Lensed Page
// Family:  type
// Idea:    A tall column of Newton's first Query from Opticks, set in 3 by 5 capitals, climbs past an invisible point mass in the middle of the panel, and every LED reads the page through the point-lens equation, so the lines bow into arcs round the mass, letters near it show twice, once outside the Einstein ring and once turned over inside it, and the letters right behind it spread into the ring itself.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the point-mass gravitational lens and its ring (Orest Chwolson, 1924; Albert Einstein, 1936); text from Isaac Newton, Opticks (1704), Query 1, public domain; 3 by 5 capitals drawn for this pattern; pattern round 82
// Round:   82
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Mass=13..29, Drift=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the ink is pale sky blue on dark blue paper, the turned-over images inside the ring are lilac, and the ink pales to white across the ring; at 0.5 the ink is peach and the inner images green.
// Knob 2: Speed. At 2 the page climbs 5 rows a second, a line every 1.4 s and the whole 98-row page, the query and the signature, in 19.6 s, and a Drift swing takes 10 s; every time goes as 2 / Speed.
// Knob 3: Mass. The Einstein radius in LEDs, 13 at the opening and 29 at the top, where the ring is 58 LEDs across. A letter t LEDs off the line of sight shows twice, outside the ring at (t + sqrt(t^2 + 4 E^2)) / 2 and turned over inside it at (sqrt(t^2 + 4 E^2) - t) / 2 on the far side; a line 40 LEDs from the mass is pushed 4.2 LEDs outward at 13 and 21 at 29.
// Knob 4: Drift. Swings the mass sideways across the column, 24 LEDs times Drift each way: 1.4 at the opening 0.06, so the ring stays in the middle, and 24 at 1, where the ring runs off the side of the panel and the dark beyond the page's edge shows inside it, turned over, as a black disc.

// Put the mass at the origin of the sky and the page far behind it. Light
// that reaches the LED at angle theta from the mass passed the page at
//
//   beta = theta - thetaE^2 theta / |theta|^2,
//
// the point-lens equation (Chwolson 1924, Einstein 1936). So each LED
// looks up the page at beta, and nothing is scattered or added up. A page
// point at distance b from the line of sight has two images, both on the
// line through the mass, at (b + sqrt(b^2 + 4 thetaE^2)) / 2 outside the
// Einstein ring and (b - sqrt(b^2 + 4 thetaE^2)) / 2 inside it, on the
// other side and turned over; the point right behind the mass is the whole
// ring. Lensing keeps surface brightness, so the LED takes the page's
// level as it is, bilinear between page LEDs, and a magnified letter is
// bigger, never brighter. Inside the ring the page is shrunk: an LED at r
// from the mass covers 1 + thetaE^2 / r^2 page LEDs radially, so it reads
// a box-blurred copy of the page that wide instead of aliasing.
//
// The page is one LED to the page LED far from the mass: 16 characters of
// 4 LEDs to a line, lines 7 rows apart, centred, the query wrapped by words
// and the signature after it, then the same page again below. Past the
// column's two sides there is no page, and that dark is what shows in the
// middle of the ring, where the inner image reaches far out sideways.

const W = 64, H = 128;
const { floor, abs, sin, log2, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Isaac Newton, Opticks (1704), the first of the Queries.
const TEXT = "QU. 1. DO NOT BODIES ACT UPON LIGHT AT A DISTANCE, AND BY THEIR ACTION BEND ITS RAYS; AND IS NOT THIS ACTION (CAETERIS PARIBUS) STRONGEST AT THE LEAST DISTANCE?";
const SIGN = "NEWTON 1704";

// Capitals, figures and stops, 3 wide and 5 tall, rows top to bottom.
const GLYPHS = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111",
  0: "111101101101111", 1: "010110010010111", 4: "101101111001001", 7: "111001010010010",
  ".": "000000000000010", ",": "000000000010100", ";": "000010000010100", "?": "110001010000010",
  "(": "001010010010001", ")": "100010010010100", " ": "000000000000000",
};

// Characters per line, LEDs per character and per line, page ground level.
const COLS = 16, ADV = 4, PITCH = 7, GROUND = 0.09, LEVELS = 5;

function wrap(text) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + 1 + word.length > COLS) {
      lines.push(line);
      line = word;
    } else line = line ? line + " " + word : word;
  }
  if (line) lines.push(line);
  return lines;
}

// The page: one copy of the query and the signature, PITCH rows a line,
// 64 wide, repeating down. Level 1 is ink, GROUND the paper.
function page() {
  const lines = [...wrap(TEXT), "", SIGN, ""];
  const ph = lines.length * PITCH, p = new Float32Array(W * ph).fill(GROUND);
  lines.forEach((text, li) => {
    const x0 = floor((W - (ADV * text.length - 1)) / 2);
    for (let c = 0; c < text.length; c++) {
      const g = GLYPHS[text[c]] || GLYPHS[" "];
      for (let r = 0; r < 5; r++)
        for (let q = 0; q < 3; q++) if (g[r * 3 + q] === "1") p[(li * PITCH + 1 + r) * W + x0 + c * ADV + q] = 1;
    }
  });
  return { p, ph };
}

// Box-blurred copies of the page, 2^L LEDs wide, for LEDs that see a wide
// patch of it (the demagnified image inside the ring).
function mips(p, ph) {
  const out = [p];
  for (let L = 1; L < LEVELS; L++) {
    const s = 1 << L, a = new Float32Array(W * ph), b = new Float32Array(W * ph);
    for (let y = 0; y < ph; y++)
      for (let x = 0; x < W; x++) {
        let t = 0;
        for (let i = 0; i < s; i++) {
          const xx = x + i - (s >> 1);
          t += xx >= 0 && xx < W ? p[y * W + xx] : 0;
        }
        a[y * W + x] = t / s;
      }
    for (let y = 0; y < ph; y++)
      for (let x = 0; x < W; x++) {
        let t = 0;
        for (let i = 0; i < s; i++) t += a[(((y + i - (s >> 1)) % ph) + ph) % ph * W + x];
        b[y * W + x] = t / s;
      }
    out.push(b);
  }
  return out;
}

// Bilinear sample: x off the page is dark, y wraps.
function sample(p, ph, x, y) {
  const x0 = floor(x), y0 = floor(y), fx = x - x0, fy = y - y0;
  const ya = ((y0 % ph) + ph) % ph, yb = ya + 1 === ph ? 0 : ya + 1;
  const a0 = x0 >= 0 && x0 < W ? p[ya * W + x0] : 0, a1 = x0 + 1 >= 0 && x0 + 1 < W ? p[ya * W + x0 + 1] : 0;
  const b0 = x0 >= 0 && x0 < W ? p[yb * W + x0] : 0, b1 = x0 + 1 >= 0 && x0 + 1 < W ? p[yb * W + x0 + 1] : 0;
  return (a0 + (a1 - a0) * fx) * (1 - fy) + (b0 + (b1 - b0) * fx) * fy;
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

export function setup(params) {
  const { p, ph } = page();
  params.s = { mip: mips(p, ph), ph, scroll: 20, swing: 0, hue: 0, mass: 13, drift: 0.06 };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 13, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.mass = cl(k[2] == null ? 13 : k[2], 13, 29);
  S.drift = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  S.scroll = (S.scroll + d * speed * 2.5) % S.ph;
  S.swing = (S.swing + (d * speed * TAU) / 20) % TAU;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { mip, ph } = S, e2 = S.mass * S.mass;
  const lx = W / 2 + S.drift * 24 * sin(S.swing), ly = H / 2;
  // Ink is the page colour outside the ring and turned inside it, paling to
  // white at the ring; the paper keeps the page colour everywhere.
  const out = hsv(S.hue + 0.56, 0.5, 1), inn = hsv(S.hue + 0.86, 0.5, 1), paper = hsv(S.hue + 0.56, 0.65, 1);
  const rim = [], inner = [];
  for (let i = 0; i <= 10; i++) {
    rim.push(hsv(S.hue + 0.56, 0.05 * i, 1));
    inner.push(hsv(S.hue + 0.86, 0.05 * i, 1));
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Point lens: the LED at theta from the mass sees the page at
      // beta = theta (1 - thetaE^2 / |theta|^2).
      const tx = x - lx, ty = y - ly, r2 = tx * tx + ty * ty + 1e-6, k = 1 - e2 / r2;
      const sx = lx + tx * k, sy = ly + ty * k + S.scroll;
      // How many LEDs of page the LED spans radially: 1 + thetaE^2 / r^2.
      const span = 1 + e2 / r2, lev = cl(log2(span) - 1, 0, LEVELS - 1.001), L0 = floor(lev), fl = lev - L0;
      let v = sample(mip[L0], ph, sx, sy);
      if (fl > 0) v += (sample(mip[L0 + 1], ph, sx, sy) - v) * fl;
      // Outer images keep the page colour, the inverted inner images turn,
      // and the ring between them goes white.
      const t = (r2 - e2) / (r2 + e2), ink = cl((v - GROUND) / (1 - GROUND), 0, 1);
      const c = t > 0 ? (abs(t) < 0.2 ? rim[round(abs(t) * 50)] : out) : abs(t) < 0.2 ? inner[round(abs(t) * 50)] : inn;
      const s = 255 * v;
      display.setPixel(x, y, round((paper[0] + (c[0] - paper[0]) * ink) * s), round((paper[1] + (c[1] - paper[1]) * ink) * s), round((paper[2] + (c[2] - paper[2]) * ink) * s));
    }
  }
}
