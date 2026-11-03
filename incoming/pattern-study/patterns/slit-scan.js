// ===== Patternflow pattern =====
// Title:   Slit-Scan
// Family:  type
// Idea:    Two planes of light, a ceiling over the top half of the panel and a floor under the bottom half, recede to a vanishing point in the middle row, each one long exposure of a page of lettering sliding behind a slit while the camera runs in toward it, so the words of a sentence ride out of the far end as radial streaks of their own strokes, gather into whole letters as they come near and leave past the top and bottom edges, and turning a knob shortens the page's travel until every word is streaks.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: slit-scan photography as Douglas Trumbull built it for the Star Gate of 2001: A Space Odyssey (1968), backlit artwork moving behind a slit while the camera tracks toward it with the shutter open; text the first sentence of Edwin A. Abbott, Flatland (1884), public domain; 5 by 7 capitals drawn for this pattern; pattern round 103
// Round:   103
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Smear=0..1, Slide=-1..1
//
// Knob 1: Hue. Turns the ink round the wheel. At 0 the lines of the page take aqua, azure and violet in turn, each over a dim ground of its own colour, so the planes are banded line by line; at 0.5 red, orange and yellow. A ground that lands between orange and yellow is paled, so it does not read brown.
// Knob 2: Speed. At 2 the page slides 3.6 artwork rows a second: a new line comes out of the far end every 2.8 s, a word stays whole for about 7 s on its way out, it leaves the edge row at 5.8 rows a second, and the 19 lines of the sentence come round every 58 s; at 0.2 everything goes ten times slower, at 3 one and a half times faster.
// Knob 3: Smear. How far the page moves while the camera comes in. At 0 it moves exactly as fast as the slit's image grows over the outer 30 rows of each plane, where two and a half lines stand whole, and slows to a tenth of that by 17 rows from the vanishing point, so the line behind them is stretched ten times along its depth into radial streaks of its strokes; at 0.5 the letters at the edge are already drawn out 1.8 times and the streaks start 23 rows from the vanishing point; at 1 the page moves an eighth as far, a whole plane holds less than one line of it and every word is streaks.
// Knob 4: Slide. Moves the page along the slit as well, 0.6 artwork columns for every row it moves across at 1 or -1: the ceiling's letters lean 31 degrees one way and the floor's the other, each line further in sits further to one side, and the streaks at the far end slant; the opening 0.06 leans them 2 degrees, too little to see.

// Trumbull's rig (1968): a long sheet of backlit artwork behind a black
// plate with a narrow slit in it, a camera on a track pointed at the slit,
// the shutter open for one long exposure while the camera runs in toward
// the plate and the artwork slides behind it. At camera distance D the slit,
// h above the lens axis, images f h / D above the vanishing point, so every
// instant of the run lays the strip of artwork then behind the slit on one
// row of the frame, scaled across by 1 / D as well. The rows of one exposure
// are the instants of the run, the far end of the plane the start, the near
// end the finish, and the artwork's travel per row of the frame decides how
// the plane is textured. The next frame starts with the artwork a little
// further on, so the texture flows toward the camera.
//
// Here the run is set in log distance, l = ln(y' / 64), y' a row's distance
// from the vanishing point. Across, an artwork column is y' / HS LEDs wide.
// Along, the page moves HS e(l) artwork rows per unit of l. Where e = 1 the
// page moves just as the slit's image grows, rows and columns are scaled
// alike and a letter keeps its shape, shrinking toward the vanishing point;
// where e is small one artwork row is held over a long stretch of the run,
// and every lit pixel of it draws a streak along the line from it to the
// vanishing point. A second slit below the axis, with a second page whose
// letters are drawn the other way up, makes the floor, so both planes read
// upright and mirror each other about the middle row.
//
// Each LED averages the artwork over the columns it covers, from running
// sums along each artwork row, at three heights inside it, so the
// streaks and the far end do not alias. The two edges of the page are lit
// their whole length and draw the planes' outlines into the vanishing point.
// A row y' from the point is lit (64 / y')^0.4 times, at most 2.6, for the
// light an exposure piles up where the slit's image moves slowest, so the
// streaks glow brighter than the letters.

const W = 64, H = 128;
const { floor, round, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => {
  const u = cl((v - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

// The vanishing point sits between rows 63 and 64; y' is a row's distance
// from it, 0.5 to 63.5. At distance y' one artwork column is y' / HS LEDs
// wide. A text line is LH artwork rows: a blank, seven glyph rows, two
// blanks. The artwork strip is 2 XW columns wide.
const VP = 64, HS = 40, LH = 10, XW = 40, CW = 2 * XW;
// Story artwork rows a second at Speed 1.
const FLOW = 1.8;

const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  ",": ["00000", "00000", "00000", "00000", "00110", "00100", "01000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
};
// Flatland, Part I, section 1, broken into lines of at most ten letters.
const LINES = [
  "I CALL", "OUR", "WORLD", "FLATLAND,", "NOT", "BECAUSE", "WE CALL", "IT SO,", "BUT TO", "MAKE ITS",
  "NATURE", "CLEARER", "TO YOU,", "MY HAPPY", "READERS,", "WHO ARE", "PRIVILEGED", "TO LIVE", "IN SPACE.", "", "",
];
const ROWS = LINES.length * LH;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// The artwork: per artwork row the running sum of ink along it, so a
// stretch of columns of any width averages in two lookups. Row 0 is the
// one that reaches the camera last; the lines run from the far end of the
// strip in reading order. The ceiling's glyphs have their tops toward the
// near end, the floor's toward the far end, so both read upright.
function artwork() {
  const sums = [new Float32Array(ROWS * (CW + 1)), new Float32Array(ROWS * (CW + 1))];
  const line = new Int16Array(ROWS);
  for (let ri = 0; ri < ROWS; ri++) {
    const m = ROWS - 1 - ri, k = floor(m / LH), q = m % LH;
    line[ri] = k;
    const text = LINES[k], x0 = XW - (text.length * 6 - 1) / 2;
    for (let pl = 0; pl < 2; pl++) {
      const r = pl === 0 ? q - 1 : 7 - q, o = ri * (CW + 1), S = sums[pl];
      let acc = 0;
      for (let c = 0; c < CW; c++) {
        S[o + c] = acc;
        // The strip's two edges, lit their whole length.
        if (c === 0 || c === CW - 1) acc += 0.55;
        const u = c + 0.5 - x0, j = floor(u / 6), col = floor(u - 6 * j);
        if (r >= 0 && r < 7 && j >= 0 && j < text.length && col < 5) {
          const g = FONT[text[j]];
          if (g && g[r][col] === "1") acc += 1;
        }
      }
      S[o + CW] = acc;
    }
  }
  return { sums, line };
}

export function setup(params) {
  const art = artwork();
  params.s = {
    t: 0, hue: 0, smear: 0, slide: 0.06, art,
    // Per sub-row (three to a panel row, for one half): its distance from
    // the vanishing point, the artwork row it shows and the sideways shift.
    yd: new Float64Array(64 * 3), arow: new Float64Array(64 * 3), xoff: new Float64Array(64 * 3),
    buf: new Float32Array(W * H * 3),
  };
  const S = params.s;
  for (let i = 0; i < 64 * 3; i++) S.yd[i] = (i + 0.5) / 3;
}

// How many artwork rows go by per unit of log distance, as a share of HS:
// 1 near the camera, where the letters keep their shape, falling to near
// nothing at the far end, where each artwork row is held over a long run of
// the camera's travel and stretches into a streak.
function rate(S, l) {
  const s = S.smear;
  const near = 1 - 0.88 * s, far = 0.1 - 0.04 * s;
  const lL = log(34 / 64) * (1 - s), lS = lL - 0.7;
  return far + (near - far) * smooth(lS, lL, l);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.smear = cl(k[2] || 0, 0, 1);
  S.slide = cl(k[3] == null ? 0.06 : k[3], -1, 1);
  S.t += d * speed;
  // The artwork row at the near end, falling as the page flows; at 2 s
  // into the opening the first line is leaving and the next three are whole.
  const u0 = ROWS + 6 - FLOW * (S.t + 2);
  // Walk in from the near end, integrating the rate in log distance.
  const n = 64 * 3;
  let l = 0, a = u0;
  const STEP = 0.02;
  for (let i = n - 1; i >= 0; i--) {
    const lt = log(S.yd[i] / 64);
    while (l - STEP > lt) {
      const e = rate(S, l - STEP / 2);
      a -= HS * e * STEP;
      l -= STEP;
    }
    const e = rate(S, (l + lt) / 2), dl = l - lt;
    S.arow[i] = a - HS * e * dl;
    S.xoff[i] = 0.6 * S.slide * (u0 - S.arow[i]);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, { sums, line } = S.art;
  buf.fill(0);
  const cols = [0, 1, 2].map((j) => hsv(S.hue + 0.48 + 0.11 * j, 0.6, 1));
  // The grounds, paled between orange and yellow.
  const grounds = [0, 1, 2].map((j) => {
    const h = S.hue + 0.48 + 0.11 * j, u = h - floor(h);
    return hsv(h, u > 0.02 && u < 0.23 ? 0.25 : 0.6, 1);
  });
  for (let y = 0; y < H; y++) {
    const top = y < VP, S0 = sums[top ? 0 : 1];
    for (let j = 0; j < 3; j++) {
      // The sub-row's index into the half's table.
      const yy = top ? VP - 1 - y : y - VP;
      const i = yy * 3 + (top ? 2 - j : j);
      const yd = S.yd[i];
      if (yd <= 0.05) continue;
      let ri = floor(S.arow[i]) % ROWS;
      if (ri < 0) ri += ROWS;
      const c = cols[line[ri] % 3], gc = grounds[line[ri] % 3], o = ri * (CW + 1);
      const per = HS / yd, xo = S.xoff[i];
      // The slit's image lingers longer on the rows near the vanishing point,
      // so they gather more light, up to 2.6 times; and it falls off over
      // the last two rows before the point.
      const fade = (smooth(0.3, 2.5, yd) * Math.min(2.6, (64 / yd) ** 0.4)) / 3;
      for (let x = 0; x < W; x++) {
        const X0 = (x - 32) * per + xo + XW, X1 = X0 + per;
        const span = X1 - X0;
        // The part of the LED's stretch inside the strip, its dim ground.
        const g0 = cl(X0, 0, CW), g1 = cl(X1, 0, CW);
        if (g1 <= g0) continue;
        const ground = (g1 - g0) / span;
        const p0 = floor(g0), p1 = floor(g1);
        const s0 = S0[o + p0] + (p0 < CW ? (g0 - p0) * (S0[o + p0 + 1] - S0[o + p0]) : 0);
        const s1 = S0[o + p1] + (p1 < CW ? (g1 - p1) * (S0[o + p1 + 1] - S0[o + p1]) : 0);
        const ink = (s1 - s0) / span;
        const v = 230 * ink * fade, w = 30 * ground * fade, q = (y * W + x) * 3;
        buf[q] += c[0] * v + gc[0] * w;
        buf[q + 1] += c[1] * v + gc[1] * w;
        buf[q + 2] += c[2] * v + gc[2] * w;
      }
    }
  }
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i += 3) display.setPixel(x, y, round(cl(buf[i], 0, 255)), round(cl(buf[i + 1], 0, 255)), round(cl(buf[i + 2], 0, 255)));
}
