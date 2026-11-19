// ===== Patternflow pattern =====
// Title:   Arris
// Family:  geometry
// Idea:    A square plate stands in the middle of the dark with a square hole in it, and the four knobs are the colour, how big the plate is, how far the hole has turned and how far it has slid sideways: the hole never changes size and only turns in place, and the knob holds where its four corners break through the four sides at once, so one frame is four corners.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 186
// Round:   188
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Turn=-6..42, Slide=-1..1
//
// Knob 1: Hue. The colour of the plate, all the way round the wheel from green.
// Knob 2: Size. The plate and the hole grow together, 34 LEDs across with a 26 LED hole at 0, 48 with 36 where it opens at 2 and 54 with 40 at 3. Both are kept to whole LEDs.
// Knob 3: Turn. How far the hole has turned, clockwise up and anticlockwise down, counted in clicks. It opens upright, nine clicks short of the break. Each click up turns it 2.8 degrees at the size where it opens, which takes its corners 1.2 LEDs a click, until the corners reach the sides: found from the size by lighting the plate LED by LED, that is 24.65 degrees at 2 and between 20.35 and 26.9 across the sizes. The knob holds there for three clicks, four corners on the panel, then goes on slowly to 40 degrees, short of the hole standing on its corner. Turned down it goes back 6 clicks.
// Knob 4: Slide. How far the hole sits right (up) or left (down) of the middle, 5 LEDs at most each way; where it opens it is dead centre. Slid, the wall on its near side breaks once the hole has turned 3 degrees, a C well before the break, and at the break the frame is three pieces, not four.

const W = 64;
const H = 128;
const DEG = Math.PI / 180;
// The plate stands in the middle of the panel and the hole turns about its middle. Their middle is where four LEDs meet.
const PX = 32;
const PY = 64;
// Half the plate's sides and half the hole's, in LEDs, where Size is 2.
const PA = 24;
const PB = 24;
const HA = 18;
const HB = 18;
// The furthest the last knob slides the hole, in LEDs.
const SHIFT = 5;
// Knob 3 is counted in clicks and the knob has 48 of them. It opens at 0 with the hole upright, OPEN clicks above the bottom of the knob, and the picture breaks nine clicks on: clicks 9, 10 and 11 are the broken picture.
const OPEN = 6;
const HOLD = 9;
const HOLD_END = 11;
// The furthest the hole turns, short of 45 degrees where it would stand on a corner.
const END = 40 * DEG;
// How finely the search for the breaking angle steps, coarsely and then finely.
const COARSE = 1 * DEG;
const FINE = 0.05 * DEG;

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

// The plate and the hole for a Size knob value, in whole LEDs. Their half sides are whole numbers and their middle is where four LEDs meet, so at 0 degrees no LED's middle sits on an edge.
function measure(z, P) {
  const s = z < 2 ? 0.7 + 0.15 * z : 1 + 0.12 * (z - 2);
  P.A = Math.round(PA * s);
  P.B = Math.round(PB * s);
  // The hole keeps the plate's proportions however the sizes round, or a small plate's hole would not reach its sides by the end of the turn.
  P.b = Math.round((P.B * HB) / PB);
  P.a = Math.round((P.A * HA) / PA);
  P.x0 = PX - P.A;
  P.y0 = PY - P.B;
}

// Whether an LED's middle falls in the hole: a rectangle of half sides a and b about (hx, hy), turned clockwise by the angle whose cosine and sine are c and s.
function inHole(x, y, hx, hy, c, s, a, b) {
  const rx = x + 0.5 - hx;
  const ry = y + 0.5 - hy;
  const u = rx * c + ry * s;
  const v = ry * c - rx * s;
  return u > -a && u < a && v > -b && v < b;
}

// How many separate pieces of lit LEDs the plate is in at this angle, joined by LEDs side by side. Lit LEDs are all the same brightness, so this is the count a picture of the panel shows.
function pieces(P, th, ox, oy) {
  const g = P.grid;
  const stack = P.stack;
  const gw = 2 * P.A;
  const gh = 2 * P.B;
  const c = Math.cos(th);
  const s = Math.sin(th);
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) g[j * gw + i] = inHole(P.x0 + i, P.y0 + j, PX + ox, PY + oy, c, s, P.a, P.b) ? 0 : 1;
  let n = 0;
  for (let k = 0; k < gw * gh; k++) {
    if (g[k] !== 1) continue;
    n++;
    let top = 0;
    stack[top++] = k;
    g[k] = 2;
    while (top > 0) {
      const q = stack[--top];
      const qi = q % gw;
      if (qi > 0 && g[q - 1] === 1) {
        g[q - 1] = 2;
        stack[top++] = q - 1;
      }
      if (qi < gw - 1 && g[q + 1] === 1) {
        g[q + 1] = 2;
        stack[top++] = q + 1;
      }
      if (q >= gw && g[q - gw] === 1) {
        g[q - gw] = 2;
        stack[top++] = q - gw;
      }
      if (q < gw * (gh - 1) && g[q + gw] === 1) {
        g[q + gw] = 2;
        stack[top++] = q + gw;
      }
    }
  }
  return n;
}

// The smallest angle from which the plate is in pieces all the way up to END. The search walks down from the top, because the edges of the hole are steps of LEDs and can cut a piece off a degree or two before they cut it for good.
function firstSplit(P, ox, oy) {
  let a = END;
  if (pieces(P, a, ox, oy) < 2) return END;
  while (a - COARSE > 0 && pieces(P, a - COARSE, ox, oy) >= 2) a -= COARSE;
  if (a - COARSE <= 0 && pieces(P, 0, ox, oy) >= 2) return 0;
  while (a - FINE > 0 && pieces(P, a - FINE, ox, oy) >= 2) a -= FINE;
  return a;
}

// How far the hole has turned at a click of the Turn knob, counted from where it opens: corners (click, angle) joined by straight lines.
function turnAt(P, q) {
  // Where a slid hole never breaks the plate in two, there is no hold: the knob just turns it steadily.
  if (!P.split) return (q * P.end) / (48 - OPEN);
  const hold = P.hold;
  if (q <= 0) return (q * hold) / HOLD;
  if (q <= HOLD - 1) return (P.last * q) / (HOLD - 1);
  if (q <= HOLD) return P.last + (hold - P.last) * (q - (HOLD - 1));
  if (q <= HOLD_END) return hold;
  return hold + ((P.end - hold) * (q - HOLD_END)) / (48 - OPEN - HOLD_END);
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.P = { A: 0, B: 0, a: 0, b: 0, x0: 0, y0: 0, hold: 0, last: 0, end: END, split: true, grid: new Uint8Array(64 * 96), stack: new Int32Array(64 * 96) };
  params.key = "";
  params.th = 0;
  params.ox = 0;
  params.oy = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const P = params.P;
  measure(clamp(k[1], 0, 3), P);
  // The last knob opens at 0.06, so 0.06 is the middle of its travel and the hole sits dead centre there.
  const u = clamp(k[3], -1, 1) - 0.06;
  const off = Math.round((SHIFT * u * 10) / (u > 0 ? 0.94 : 1.06)) / 10;
  const ox = off;
  const oy = 0;
  const key = P.A + "/" + P.B + "/" + P.a + "/" + P.b + "/" + off;
  if (key !== params.key) {
    params.key = key;
    const first = firstSplit(P, ox, oy);
    // The picture is held a little past the first LED cut, so that every corner that is going to break through has.
    P.hold = Math.min(END, first + 0.6 * DEG);
    // One click before the hold the plate is still whole and the corners of the hole are a whole LED or more from where they are at the hold.
    P.last = Math.max(0, P.hold - 1.1 / Math.hypot(P.a, P.b));
    P.end = Math.max(END, P.hold);
    P.split = first < END;
  }
  params.th = turnAt(P, clamp(k[2], -OPEN, 48 - OPEN));
  params.ox = ox;
  params.oy = oy;
  // Nothing on the panel moves on the clock. The light swells and falls, so the panel is never quite still.
  hsv(k[0] + 0.3, 0.4, 0.88 + 0.12 * Math.sin(t * 0.83 + 0.9), params.c);
}

export function draw(display, params, time) {
  const { P, c, th, ox, oy } = params;
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  const x1 = P.x0 + 2 * P.A;
  const y1 = P.y0 + 2 * P.B;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 0;
      if (x >= P.x0 && x < x1 && y >= P.y0 && y < y1) m = inHole(x, y, PX + ox, PY + oy, cs, sn, P.a, P.b) ? 0 : 1;
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
