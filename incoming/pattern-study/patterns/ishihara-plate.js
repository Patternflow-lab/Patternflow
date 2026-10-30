// ===== Patternflow pattern =====
// Title:   Ishihara Plate
// Family:  type
// Idea:    Two colour-vision plates stand one above the other, each a disc of about 370 dots on black, from single LEDs to 21-LED blots, where the dots inside a numeral differ from the dots around it only along a line of colours one kind of dichromat cannot tell apart, the protan line in the top plate and the deutan line in the bottom one; every 3 s a plate is repainted dot by dot and a new numeral comes up through the same dots, and turned towards a simulated protan or deutan eye the plate built on that eye's line loses its numeral into a field of yellow and blue.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: pseudo-isochromatic plates (Shinobu Ishihara, Tests for Colour-Blindness, 1917), dichromat simulation (Françoise Viénot, Hans Brettel and John Mollon, 1999), pattern round 77
// Round:   77
// ===============================
// @matrix 64x128
// @knobs Tint=0..1, Speed=0.2..3, Dichromacy=-1..1, Dots=0..1
//
// Knob 1: Tint. Adds the same blue to every dot, 0.55 of full in linear light at 1. At 0 the grounds are green and azure and the numerals yellow, amber, red and magenta; at 1 the greens turn teal, the yellows cream and the reds pink. Blue is kept by both simulations and added to figure and ground alike, so a numeral that vanishes still vanishes.
// Knob 2: Speed. A plate holds its numeral 6 / Speed seconds, 3 s at the opening 2, with the bottom plate half a period behind the top; 30 s at 0.2 and 2 s at 3. When a new numeral comes, every dot of the plate draws a new colour and brightness and takes them at its own moment within the first quarter of the period (0.75 s at the opening), dimming to 15% for 0.1 s either side.
// Knob 3: Dichromacy. 0 is normal vision; towards -1 the colours slide to what a protanope would see, towards +1 a deuteranope, mixed in linear light. At -1 the top numeral has exactly its ground's colours and is gone, while the bottom one is still there as darker olive dots; at +1 the bottom numeral is gone and the top one keeps a slightly brighter yellow that its blue dots mostly hide. At -0.5 the top numeral is half faded and the bottom one still reads.
// Knob 4: Dots. Every dot's radius times 1 at 0 up to 1.9 at 1, in 13 steps, each a new deal of both plates. At 0 a plate holds about 220 single LEDs, 55 five-LED crosses, 36 three-by-three squares and 60 larger dots of 13 and 21 LEDs; at 1 about 270 dots, 200 of them still single LEDs and the rest 9 to 61 LEDs, and the numeral's strokes widen from 7.2 to 9.5 LEDs, about one big dot across, so the numeral starts to break up.

// Shinobu Ishihara's plates hide a numeral in a disc of dots. The dots
// inside it and the dots around it are drawn from colours a colour-normal
// eye sees as different hues, red and orange against green, but that a
// dichromat sees as the same, and their brightness is varied from dot to
// dot so lightness gives nothing away. A protanope lacks the L cones and a
// deuteranope the M cones, so two colours whose cone signals differ only in
// L, or only in M, look alike to them: those differences are the protan and
// deutan confusion lines.
//
// Here every dot draws a ground colour from a palette of five and a
// brightness from 0.8 to 1 (in linear light). A dot inside the numeral
// moves its colour along the plate's confusion line, the change of L alone
// in the top plate and of M alone in the bottom one, until its red reaches
// 0.95 or its green 0.02, so the greens turn yellow, amber or red and the
// azures magenta. Figure and ground then differ in L alone, or in M alone,
// and nowhere else.
//
// The simulation is the single-plane method of Viénot, Brettel and Mollon
// (1999): convert to cone signals, rebuild the missing cone's signal from
// the other two so that black, white and the blue primary keep their
// colour, and convert back. A difference in L alone vanishes under the
// protan rebuild, a difference in M alone under the deutan one, so at the
// knob's end each numeral dot takes exactly the colour of a ground dot with
// the same palette entry and brightness, and the two sets are drawn alike.
// The cone matrix is the RGB-to-LMS matrix the common simulators use, and
// the two rebuilds come out as L = 2.0234 M - 2.5258 S and
// M = 0.4942 L + 1.2483 S.
//
// The dots are thrown at the disc on whole LEDs, largest first, and one
// stays only if none of its LEDs touches another dot's side by side, so a
// dark seam runs between every two and the plate is busy with small edges.

const W = 64, H = 128, R = 32;
const { floor, round, min, max, abs, sqrt, pow, cos, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Linear RGB to cone signals L, M, S, and back.
const A = [17.8824, 43.5161, 4.11935, 3.45565, 27.1554, 3.86714, 0.0299566, 0.184309, 1.46709];
function inv3(m) {
  const [a, b, c, d, e, f, g, h, i] = m, x = e * i - f * h, y = f * g - d * i, z = d * h - e * g, det = a * x + b * y + c * z;
  return [x / det, (c * h - b * i) / det, (b * f - c * e) / det, y / det, (a * i - c * g) / det, (c * d - a * f) / det, z / det, (b * g - a * h) / det, (a * e - b * d) / det];
}
const AI = inv3(A);
const mul = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
// The missing cone's signal rebuilt from the other two so that white and
// the blue primary keep their colour.
function plane(miss) {
  const w = mul(A, [1, 1, 1]), b = mul(A, [0, 0, 1]), o = miss === 0 ? 1 : 0;
  // u w[o] + v w[2] = w[miss], u b[o] + v b[2] = b[miss]
  const det = w[o] * b[2] - w[2] * b[o];
  return [(w[miss] * b[2] - w[2] * b[miss]) / det, (w[o] * b[miss] - w[miss] * b[o]) / det];
}
const PROT = plane(0), DEUT = plane(1);
// Confusion directions: a change of L alone (protan) or M alone (deutan).
const DL = mul(AI, [1, 0, 0]), DM = mul(AI, [0, -1, 0]);

function simulate(c, kind, amt, o) {
  if (amt <= 0) {
    o[0] = c[0], o[1] = c[1], o[2] = c[2];
    return o;
  }
  const lms = mul(A, c);
  if (kind < 0) lms[0] = PROT[0] * lms[1] + PROT[1] * lms[2];
  else lms[1] = DEUT[0] * lms[0] + DEUT[1] * lms[2];
  const s = mul(AI, lms);
  for (let k = 0; k < 3; k++) o[k] = c[k] + (s[k] - c[k]) * amt;
  return o;
}

// The ground colours of each plate in linear RGB, greens and azures. The
// protan line raises red and barely lowers green, so the top plate's
// greens turn yellow and amber; the deutan line takes 0.41 of green away
// for each unit of red, so the bottom plate's turn red and orange.
const GROUND = [
  [[0, 1, 0.005], [0, 0.5, 0.005], [0, 0.13, 1], [0, 0.75, 0.005], [0, 0.2, 1]],
  [[0, 0.42, 0.005], [0, 0.6, 0.005], [0, 0.42, 1], [0, 0.45, 0.8], [0, 0.55, 0.005]],
];
const FR = 0.95, DIP = 0.1;

// Numerals as strokes in a 6 by 10 box, drawn for this pattern.
const arc = (cx, cy, rx, ry, a0, a1, n) => {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * PI) / 180;
    o.push([cx + rx * cos(a), cy + ry * sin(a)]);
  }
  return o;
};
const DIGITS = [
  [arc(3, 5, 3, 5, 0, 360, 24)],
  [[[1, 2.2], [3.2, 0], [3.2, 10]]],
  [[...arc(3, 3, 3, 3, 195, 375, 10), [0, 10], [6, 10]]],
  [[...arc(3, 2.6, 2.8, 2.6, 200, 450, 10), ...arc(3, 7.3, 3, 2.7, -90, 160, 10)]],
  [[[4.4, 10], [4.4, 0], [0, 7], [6, 7]]],
  [[[5.6, 0], [1, 0], [0.5, 4.3], ...arc(3, 6.8, 3, 3.2, -125, 150, 12)]],
  [[...arc(3.5, 5.5, 2.8, 5.5, -55, -175, 7), ...arc(3, 7, 3, 3, 180, 540, 16)]],
  [[[0, 0], [6, 0], [2.2, 10]]],
  [arc(3, 2.5, 2.6, 2.5, 90, 450, 16), arc(3, 7.3, 3, 2.7, -90, 270, 18)],
  [[...arc(3, 3, 3, 3, 0, 360, 16), ...arc(2.5, 4.5, 3.5, 5.5, 0, 100, 6)]],
];

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? cl(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
  const x = ax + t * dx - px, y = ay + t * dy - py;
  return sqrt(x * x + y * y);
}

// Is the point (x, y), relative to the plate's centre, inside digit d?
function inDigit(d, x, y, hw) {
  const sx = 5, sy = 4.5, ox = -3 * sx, oy = -5 * sy;
  let best = 1e9;
  for (const pl of DIGITS[d])
    for (let i = 0; i + 1 < pl.length; i++) {
      const a = pl[i], b = pl[i + 1];
      best = min(best, segDist(x, y, ox + a[0] * sx, oy + a[1] * sy, ox + b[0] * sx, oy + b[1] * sy));
    }
  return best <= hw;
}

const RADII = [2.3, 2.0, 1.5, 1.0, 1.0, 0.5];
const TRIES = [60, 200, 1500, 9000, 9000, 9000];
function newPlate(cy, kind, sc) {
  const own = new Int16Array(W * 64).fill(-1), dots = [];
  for (let c = 0; c < RADII.length; c++) {
    const r = RADII[c] * sc, rr = r * r, ri = floor(r), cells = [];
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) if (dx * dx + dy * dy <= rr) cells.push(dx, dy);
    for (let k = 0; k < TRIES[c]; k++) {
      const cx = floor(Math.random() * 64), cyy = floor(Math.random() * 64);
      let ok = true;
      for (let i = 0; i < cells.length && ok; i += 2) {
        const x = cx + cells[i], y = cyy + cells[i + 1], ex = x + 0.5 - 32, ey = y + 0.5 - 32;
        if (ex * ex + ey * ey > R * R) ok = false;
        else
          for (const [ax, ay] of NB) {
            const u = x + ax, v = y + ay;
            if (u >= 0 && u < 64 && v >= 0 && v < 64 && own[v * W + u] >= 0) {
              ok = false;
              break;
            }
          }
      }
      if (!ok) continue;
      const n = dots.length;
      for (let i = 0; i < cells.length; i += 2) own[(cyy + cells[i + 1]) * W + cx + cells[i]] = n;
      dots.push({ x: cx + 0.5 - 32, y: cyy + 0.5 - 32, now: [0, 0, 1], old: [0, 0, 1], at: 0 });
    }
  }
  return { dots, own, cy, kind, digit: -1, clock: 0, hw: 3.6 + 1.3 * (sc - 1) };
}
const NB = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];

// A new numeral: every dot draws a new colour from the palette and a new
// brightness, inside the numeral or not, and takes them at its own moment
// in the first quarter of the period.
function setNumeral(P, digit, spread) {
  P.digit = digit;
  for (const d of P.dots) {
    const t = d.old;
    d.old = d.now;
    d.now = t;
    t[0] = inDigit(digit, d.x, d.y, P.hw) ? 1 : 0;
    t[1] = floor(Math.random() * 5);
    t[2] = 0.8 + 0.2 * Math.random();
    d.at = Math.random() * spread;
  }
  P.clock = 0;
}

export function setup(params) {
  params.s = { plates: null, size: -1, period: 3, tint: 0, dich: 0, c: [0, 0, 0], o: [0, 0, 0] };
}

function build(S, size) {
  S.size = size;
  const sc = 1 + 0.9 * size;
  S.plates = [newPlate(0, -1, sc), newPlate(64, 1, sc)];
  for (const P of S.plates) {
    setNumeral(P, floor(Math.random() * 10), 0);
    setNumeral(P, P.digit, 0);
  }
  S.plates[1].clock = -S.period / 2;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.tint = cl(k[0] || 0, 0, 1);
  S.period = 6 / cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.dich = cl(k[2] || 0, -1, 1);
  const size = floor(cl(k[3] == null ? 0.06 : k[3], 0, 1) * 12.99) / 12;
  if (size !== S.size) build(S, size);
  for (const P of S.plates) {
    P.clock += d;
    if (P.clock >= S.period) {
      let n = floor(Math.random() * 9);
      if (n >= P.digit) n++;
      setNumeral(P, n, min(0.8, S.period * 0.25));
    }
  }
}

const toByte = (v) => round(255 * pow(cl(v, 0, 1), 1 / 2.2));

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.plates) return;
  const c = S.c, o = S.o, amt = abs(S.dich), kind = S.dich < 0 ? -1 : 1;
  for (const P of S.plates) {
    const dir = P.kind < 0 ? DL : DM, cols = [];
    for (const d of P.dots) {
      // A dot being repainted dims to 15% and comes back in its new colour.
      const u = abs(P.clock - d.at) / DIP, [fig, gi, l0] = P.clock >= d.at ? d.now : d.old, g = GROUND[P.kind < 0 ? 0 : 1][gi];
      const lum = u < 1 ? l0 * (0.15 + 0.85 * u * u) : l0;
      // As far along the line as the red target, or as the green allows.
      const t = fig ? min((FR - g[0]) / dir[0], (g[1] - 0.02) / -dir[1]) : 0;
      c[0] = (g[0] + t * dir[0]) * lum;
      c[1] = (g[1] + t * dir[1]) * lum;
      c[2] = (g[2] + t * dir[2] + 0.55 * S.tint) * lum;
      simulate(c, kind, amt, o);
      cols.push(toByte(o[0]), toByte(o[1]), toByte(o[2]));
    }
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < W; x++) {
        const n = P.own[y * W + x];
        if (n < 0) display.setPixel(x, P.cy + y, 0, 0, 0);
        else display.setPixel(x, P.cy + y, cols[n * 3], cols[n * 3 + 1], cols[n * 3 + 2]);
      }
  }
}
