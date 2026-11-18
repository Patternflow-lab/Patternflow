// ===== Patternflow pattern =====
// Title:   Annulet
// Family:  geometry
// Idea:    A ring in the lower part of a bare dark panel is broken into four arcs by four gaps, and the four knobs are the colour, the size of the ring, how wide the gaps are and how far round the ring they have turned: the gaps narrow until the arcs meet end to end, and four arcs are one ring.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 170
// Round:   172
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=1..3, Close=-36..12, Turn=0.06..1
//
// Knob 1: Hue. The colour of the ring, all the way round the wheel from green.
// Knob 2: Size. How big the ring is, 25.5 LEDs in outside radius at 1, 28.5 where it opens at 2 and 31.5 at 3, where it just fits between the side walls. The ring is 12 LEDs thick whatever the size.
// Knob 3: Close. How wide the four gaps are, counted in clicks; turn it up and they narrow. Where it opens, 0, each gap is 24 LEDs wide along the middle of the ring and the four arcs are short. Ten clicks on the gaps have shut: the arcs meet end to end, the ring is whole, and the knob holds for three clicks to the top end. The eight clicks before that each shut the gaps by more than a LED.
// Knob 4: Turn. How far the four gaps have turned round the ring, up to an eighth of a turn. At its bottom, where it opens, the gaps stand straight up, down, left and right; at the top they stand on the diagonals.

const W = 64;
const H = 128;
const THICK = 12;
const CX = 32;
const CY = 88;
// Knob 3 is counted in clicks and the knob has 48 of them, 36 below where it opens and 12 above.
const OPEN = 36;
// Half the width of a gap, in LEDs along the middle of the ring, where Close opens, and at its bottom, where the arcs are down to a few degrees.
const R_OPEN = 12;
const R_END = 16;

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Half the width of a gap for every point of the Close knob, as corners (clicks, LEDs) joined by straight lines. The gaps shut on the knob's top three clicks. The eight clicks before that move them more than a LED, and the click right before moves them 2.1 LEDs, so the last picture before the shut still has a column of LEDs dark across each gap.
const QS = [0, OPEN, 38, 45, 46, 48];
const RS = [R_END, R_OPEN, 9.8, 2.1, 0, 0];

function halfAt(q) {
  if (q <= QS[0]) return RS[0];
  for (let i = 1; i < QS.length; i++) {
    if (q <= QS[i]) return RS[i - 1] + ((RS[i] - RS[i - 1]) * (q - QS[i - 1])) / (QS[i] - QS[i - 1]);
  }
  return RS[RS.length - 1];
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.cov = new Float32Array(W * H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const outer = 22.5 + 3 * clamp(k[1], 1, 3);
  const inner = outer - THICK;
  const mid = outer - THICK / 2;
  // The gaps are as wide as an angle: half a gap is this many radians, so the arcs keep their ends square to the ring at every size.
  const half = halfAt(clamp(k[2], -OPEN, 48 - OPEN) + OPEN) / mid;
  const turn = (Math.PI / 4) * clamp((k[3] - 0.06) / 0.94, 0, 1);
  const cov = params.cov;
  cov.fill(0);
  const y0 = Math.max(0, Math.floor(CY - outer - 1));
  const y1 = Math.min(H - 1, Math.ceil(CY + outer + 1));
  const x0 = Math.max(0, Math.floor(CX - outer - 1));
  const x1 = Math.min(W - 1, Math.ceil(CX + outer + 1));
  const quarter = Math.PI / 2;
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - CY;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - CX;
      const d = Math.sqrt(dx * dx + dy * dy);
      const edge = Math.min(outer - d, d - inner) + 0.5;
      if (edge <= 0) continue;
      const ring = edge > 1 ? 1 : edge;
      // How far this LED is along the ring from the nearest gap's middle, in LEDs, and how much of the LED the gap covers.
      const a = Math.atan2(dy, dx) - turn;
      const off = (a - quarter * Math.round(a / quarter)) * d;
      const h = half * d;
      const lo = off - 0.5 > -h ? off - 0.5 : -h;
      const hi = off + 0.5 < h ? off + 0.5 : h;
      const gap = hi > lo ? hi - lo : 0;
      cov[y * W + x] = ring * (1 - gap);
    }
  }
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.36 + 0.02 * Math.sin(t * 0.37), 0.86, 0.92 * (0.8 + 0.2 * Math.sin(t * 0.59 + 1.3)), params.col);
}

export function draw(display, params, time) {
  const { cov, col } = params;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = cov[y * W + x];
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
