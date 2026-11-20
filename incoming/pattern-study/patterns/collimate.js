// ===== Patternflow pattern =====
// Title:   Collimate
// Family:  geometry
// Idea:    Two bands from wall to wall, each with a round hole in its middle, lie one on the other, and one knob slides one of them down across the other: the panel is dark inside the bands only where the two holes overlap, a lens between two arcs, and the knob holds where the holes fit and the lens is a whole disc, and at both ends where the holes touch at a point and the lens is gone.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 194
// Round:   196
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Hole=0..3, Slide=-12..36, Unlike=0.06..1
//
// Knob 1: Hue. The colour of both bands, all the way round the wheel from blue. The two are one colour and well under full brightness, since together they light half the panel and more.
// Knob 2: Hole. The width of the holes, 14 LEDs at the bottom of the knob, 24 where it opens at 2 and 25.6 at the top. Each band is three times as tall as its hole is wide, so the rim above and below a hole covers the other band's hole until the two holes part. At the top of the knob the sliding band reaches the ceiling or the floor on the click the holes part.
// Knob 3: Slide. How far the sliding band is off the one that stays put, counted in clicks. On the bottom two clicks it is a hole's width up, the two holes touch at one point and there is no opening. The next click brings it 2 LEDs down and a lens 2 LEDs thick and 10 wide opens; each click from there is 1 LED, and it opens ten clicks on with the lens 12 LEDs thick. Click 23 closes the last 2 LEDs and the two bands are one, the hole a whole disc; the knob holds there for three clicks. Past that the band goes on down the same way and the lens closes from the other side, shut on the top two clicks.
// Knob 4: Unlike. How unlike the two bands are. It opens at the bottom, where they are the same. Turned up, the band that stays put grows to a quarter taller and the sliding one shrinks by a quarter, holes and all. Then no click fits: the small hole is whole for a few clicks either side of the middle, and at the ends the small band has slid off the far side of the big hole and left a cap of it open.

const W = 64;
const H = 128;
// The middle of the band that stays put, and of its hole.
const CX = 32;
const CY = 64;
// Knob 3 has 48 clicks and opens on click OPEN.
const OPEN = 12;
// The clicks where the slide turns a corner: shut, the first sliver, the last 2 LEDs before the holes fit, the fit, and the same again on the way out.
const QS = [0, 1, 2, 22, 23, 25, 26, 46, 47, 48];
// The first click off a hold moves the band this many LEDs, whatever the size, so the sliver that opens is 2 LEDs thick.
const STEP = 2;
// How much bigger the last knob makes one band and smaller the other.
const UNLIKE = 0.25;
// Each LED is looked at in SUB by SUB places, and its light is the share of those that are lit.
const SUB = 6;

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

// How many LEDs the sliding band is off the other on click q, for holes w LEDs wide. At -w and w the two holes touch at one point, at 0 they fit.
function slideAt(D, q, w) {
  D[0] = D[1] = -w;
  D[2] = STEP - w;
  D[3] = -STEP;
  D[4] = D[5] = 0;
  D[6] = STEP;
  D[7] = w - STEP;
  D[8] = D[9] = w;
  if (q <= QS[0]) return D[0];
  for (let i = 1; i < 10; i++) if (q <= QS[i]) return D[i - 1] + ((D[i] - D[i - 1]) * (q - QS[i - 1])) / (QS[i] - QS[i - 1]);
  return D[9];
}

// The lit share of every LED. A band lights what it covers outside its own hole, so an LED is dark inside the two bands only where both holes are, or where one hole has come out from under the other band.
function paint(cover, w, k, d) {
  // The radius of each hole. A band reaches three radii above and below its middle.
  const a = (w * (1 + k)) / 2;
  const b = (w * (1 - k)) / 2;
  const by = CY + d;
  const reach = Math.max(a, b) + 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Away from the holes a row is the same all the way across.
      const plain = x + 1 < CX - reach || x > CX + reach;
      const nx = plain ? 1 : SUB;
      let lit = 0;
      for (let j = 0; j < SUB; j++) {
        const py = y + (j + 0.5) / SUB;
        const ya = py - CY;
        const yb = py - by;
        const inA = ya > -3 * a && ya < 3 * a;
        const inB = yb > -3 * b && yb < 3 * b;
        if (!inA && !inB) continue;
        for (let i = 0; i < nx; i++) {
          const px = x + (i + 0.5) / nx - CX;
          const holeA = px * px + ya * ya < a * a;
          const holeB = px * px + yb * yb < b * b;
          if ((inA && !holeA) || (inB && !holeB)) lit++;
        }
      }
      cover[y * W + x] = lit / (SUB * nx);
    }
  }
}

export function setup(params) {
  params.t = 0;
  params.rgb = new Float32Array(3);
  params.cover = new Float32Array(W * H);
  params.D = new Float32Array(10);
  params.key = "";
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const z = clamp(k[1], 0, 3);
  const w = z < 2 ? 14 + 5 * z : 24 + 1.6 * (z - 2);
  // The last knob opens at 0.06, the bottom of its travel, where the two bands are the same.
  const unlike = UNLIKE * clamp((k[3] - 0.06) / 0.94, 0, 1);
  const d = slideAt(params.D, clamp(k[2], -OPEN, 48 - OPEN) + OPEN, w);
  const key = w + "/" + unlike + "/" + d;
  if (key !== params.key) {
    params.key = key;
    paint(params.cover, w, unlike, d);
  }
  // Nothing on the panel moves on the clock. The light swells and falls a little so the panel is never quite still.
  const breath = 0.9 + 0.1 * Math.sin(t * 0.83 + 1.07);
  hsv(k[0] + 0.585, 0.6, 0.56 * breath, params.rgb);
}

export function draw(display, params, time) {
  const { rgb, cover } = params;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = cover[y * W + x];
      display.setPixel(x, y, rgb[0] * c, rgb[1] * c, rgb[2] * c);
    }
  }
}
