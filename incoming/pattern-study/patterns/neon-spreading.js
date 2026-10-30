// ===== Patternflow pattern =====
// Title:   Neon Spreading
// Family:  type
// Idea:    A lattice of thin white lines turns slowly over the black panel, and wherever its lines pass through the three big round letters of a word stacked down the panel those stretches of line are drawn in a dimmer colour, nothing else, so the eye spreads the colour into a glowing veil filling each letter between the lines, though every LED between them is dark; the letters shrink to their spines and swell into the next word in the next colour.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: neon colour spreading (Harrie van Tuijl, A new visual illusion: neonlike color spreading and complementary color induction between subjective contours, Acta Psychologica, 1975), after the chromatic spreading Dario Varin described in 1971; round-stroke capitals drawn for this pattern, pattern round 79
// Round:   79
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Pitch=4..9, Fill=0..1
//
// Knob 1: Hue. Turns the colours of the words round the wheel, which skips red-orange. At 0 the words go cyan HUE, violet FOG, rose AIR and green SEE; at 0.5 rose, green, cyan and blue. The lines stay white.
// Knob 2: Speed. At 2 the lattice turns 4 degrees a second, so it comes back to itself every 22.5 s, and a word holds 4 s, shrinks to its spines in 0.9 s and the next one swells in 0.9 s. At 0.2 it all runs ten times slower, at 3 half as fast again.
// Knob 3: Pitch. LEDs between the lattice's lines: 4 at the opening, where a stroke 9 LEDs wide holds two or three lines each way and the veil fills it, up to 9, where a stroke holds one line or none and the colour stays on its segments.
// Knob 4: Fill. A real fill of the letters for comparison, painted between the lines in the word's colour: none up to 0.1, so at the opening 0.06 no LED inside a letter is lit but the line segments; 5% of full at 0.25, 13% at 0.5 and 30% at 1.
// Buttons: K1 tap shrinks the word now and brings the next.

// Every LED of the panel is on a line of the lattice or dark, until Fill
// paints the letters. The lattice is two families of parallel lines, at
// angles th and th + 90 degrees through the panel's centre, Pitch apart. An
// LED's light goes by its distance d from the nearest line, 1.3 - 1.6 d:
// full within 0.19 LEDs of the line, half at 0.5, dark from 0.81, a little
// sharper than plain coverage so that a turning line keeps its weight.
// The word is a distance field: the distance from each LED to the spines
// of its letters, round strokes drawn as polylines and elliptic arcs, and a
// letter covers the LEDs nearer its spine than half the stroke.
// Where a line crosses a letter it changes from white at 74% to the word's
// colour at 58% of its brightest channel; a coloured stretch is dimmer than
// the white line and brighter than the black between, which is what the
// spreading needs. The edge of the letter falls across a line within one
// LED, so the colour starts and stops on the letter's outline, and the eye
// carries it across the dark gaps to that outline.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sqrt, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
// Three letters down the panel, each in a box 56 by 36, 4 apart; strokes 9
// LEDs wide.
const BX = 4, BW = 56, BH = 36, BY = [6, 46, 86], WT = 9;
const HOLD = 4, OUT = 0.9, IN = 0.9, HUE0 = 0.427;
const WHITE = 0.74, SEG = 0.58;
const WORDS = ["HUE", "FOG", "AIR", "SEE"], HUES = [0, 0.317, 0.524, 0.732];

// Points of an elliptic arc in the unit box, y down, angles in degrees
// (0 right, 90 down).
function arc(cx, cy, rx, ry, a0, a1, n = 10) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * PI) / 180;
    out.push([cx + rx * cos(a), cy + ry * sin(a)]);
  }
  return out;
}
// The spines, as polylines in the unit box.
const GLYPHS = {
  H: [[[0, 0], [0, 1]], [[1, 0], [1, 1]], [[0, 0.5], [1, 0.5]]],
  U: [[[0, 0], [0, 0.45], ...arc(0.5, 0.45, 0.5, 0.55, 180, 0, 12), [1, 0]]],
  E: [[[1, 0], [0, 0], [0, 1], [1, 1]], [[0, 0.5], [0.82, 0.5]]],
  F: [[[1, 0], [0, 0], [0, 1]], [[0, 0.5], [0.8, 0.5]]],
  O: [arc(0.5, 0.5, 0.5, 0.5, 0, 360, 24)],
  G: [[...arc(0.5, 0.5, 0.5, 0.5, -40, -360, 20), [1, 0.5], [1, 0.62]], [[1, 0.55], [0.58, 0.55]]],
  A: [[[0, 1], [0.5, 0], [1, 1]], [[0.24, 0.62], [0.76, 0.62]]],
  I: [[[0.5, 0], [0.5, 1]], [[0.22, 0], [0.78, 0]], [[0.22, 1], [0.78, 1]]],
  R: [[[0, 1], [0, 0], [0.68, 0], ...arc(0.68, 0.25, 0.32, 0.25, -90, 90, 10), [0, 0.5]], [[0.5, 0.5], [1, 1]]],
  S: [[...arc(0.5, 0.25, 0.5, 0.25, -20, -270, 12), ...arc(0.5, 0.75, 0.5, 0.25, -90, 160, 12)]],
};

// The word's distance field: each LED's distance to the nearest spine.
function field(word, out) {
  const segs = [];
  const r = WT / 2, sx = BW - 2 * r, sy = BH - 2 * r;
  for (let c = 0; c < word.length; c++)
    for (const line of GLYPHS[word[c]]) {
      const pts = line.map(([x, y]) => [BX + r + x * sx, BY[c] + r + y * sy]);
      for (let i = 0; i + 1 < pts.length; i++) segs.push([...pts[i], ...pts[i + 1]]);
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, py = y + 0.5;
      let best = 1e9;
      for (const [x0, y0, x1, y1] of segs) {
        const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
        const t = l2 > 0 ? cl(((px - x0) * dx + (py - y0) * dy) / l2, 0, 1) : 0;
        const ex = px - x0 - t * dx, ey = py - y0 - t * dy, d2 = ex * ex + ey * ey;
        if (d2 < best) best = d2;
      }
      out[y * W + x] = sqrt(best);
    }
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}
// The wheel without red-orange, which reads brown when dim: 0 to 1 runs from
// yellow through green, cyan, blue and violet to rose.
const wheel = (h) => 0.15 + 0.82 * (h - floor(h));

export function setup(params) {
  const S = (params.s = {
    hue: 0, speed: 2, pitch: 4, fill: 0.06, th: 0.21, t: 0, ph: 1, wi: 0, btn: false,
    dist: new Float32Array(N), col: [0, 0, 0],
  });
  field(WORDS[0], S.dist);
  return S;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 4, 0.06], d0 = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.pitch = cl(k[2] == null ? 4 : k[2], 4, 9);
  S.fill = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const btn = !!(input.btnPressed && input.btnPressed[0]);
  if (btn && !S.btn && S.ph !== 2) (S.ph = 2), (S.t = 0);
  S.btn = btn;
  const d = (d0 * S.speed) / 2;
  S.th += (d * 4 * PI) / 180;
  S.t += d;
  // Phases: 1 the word holds, 2 it shrinks to its spines, 0 the next swells.
  if (S.ph === 1 && S.t >= HOLD) (S.ph = 2), (S.t = 0);
  if (S.ph === 2 && S.t >= OUT) {
    S.wi = (S.wi + 1) % WORDS.length;
    field(WORDS[S.wi], S.dist);
    S.ph = 0;
    S.t = 0;
  }
  if (S.ph === 0 && S.t >= IN) (S.ph = 1), (S.t = 0);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const dist = S.dist, col = hsv(wheel(S.hue + HUE0 + HUES[S.wi]), 1, 1, S.col);
  // Half the stroke: whole while the word holds, down to nothing at its
  // spines between words.
  const r = (WT / 2) * (S.ph === 1 ? 1 : S.ph === 2 ? 1 - ease(S.t / OUT) : ease(S.t / IN));
  const c = cos(S.th), s = sin(S.th), pt = S.pitch, fill = (0.3 * max(0, S.fill - 0.1)) / 0.9;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const px = x - 32, py = y - 64;
      const u = (px * c + py * s) / pt, v = (py * c - px * s) / pt;
      const du = abs(u - round(u)) * pt, dv = abs(v - round(v)) * pt;
      const line = cl(1.3 - 1.6 * min(du, dv), 0, 1);
      // How much of this LED the letter covers, with a one-LED edge.
      const m = r > 0 ? cl(r - dist[y * W + x] + 0.5, 0, 1) : 0;
      const wl = line * WHITE * (1 - m), cs = line * SEG * m, f = fill * m * (1 - line);
      display.setPixel(x, y, round(cl(wl + col[0] * (cs + f), 0, 1) * 255), round(cl(wl + col[1] * (cs + f), 0, 1) * 255), round(cl(wl + col[2] * (cs + f), 0, 1) * 255));
    }
}
