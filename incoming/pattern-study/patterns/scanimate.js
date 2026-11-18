// ===== Patternflow pattern =====
// Title:   Scanimate
// Family:  light
// Idea:    The word FLOW stands as a title card in four fat capitals, two to a line, and an unseen operator bends it the way a Scanimate did: every scan line of the card is sampled a different distance to the side by a sum of oscillators and every column a different distance up or down by another sum, all of it swelling and falling with a slow envelope, so the letters ripple like a flag and lean into italics, and at full depth break into ribbons of their own strokes, while a one-frame feedback leaves glowing trails and a second copy of the card, delayed a quarter of a second and in a second colour, trails after the first.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Scanimate, the analogue computer-animation machine of Lee Harrison III at Computer Image Corporation (about 1969), which bent a monitor's raster with voltages from oscillators and envelopes set by an operator on knobs and patch cords, so the lettering of a title card was never redrawn; the card, the oscillator chain and the feedback written for this pattern; pattern round 104
// Round:   104
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Depth=0.4..1.6, Shape=0..1
//
// Knob 1: Hue. Turns the card and its ghost round the wheel together, 0.45 of a turn apart. At 0 the card is cyan and the ghost a rose; at 0.25 violet and yellow, at 0.5 red and green, at 0.75 lime and blue. The ghost is drawn under the card, so it shows only where the card is not.
// Knob 2: Speed. The rate every oscillator and the envelope run at. At 2 the slow oscillator turns 0.44 times a second, the fast ones 1.1 and 1.8, the envelope swells and falls every 8 s and the ghost trails 0.25 s behind; at 0.2 everything is ten times slower, at 3 one and a half times faster.
// Knob 3: Depth. How far the envelope's top turns the oscillators up, as the biggest sideways shift of a scan line. At 0.4 that is 10 LEDs, the card ripples and every letter reads; at 0.8 it is 19, and at the top of the envelope the strokes shear into each other and break, then pull back into letters; at 1.6 it is 38 and a third, faster oscillator is let in fully (from 0.7 on it comes up), so the lines tear into ribbons that cross the panel. Columns shift up and down by half as much. The envelope never falls below 15 percent of the knob.
// Knob 4: Shape. The waveform every oscillator puts out. At 0 it is a sine and the card waves like a flag; at 0.5 a triangle, runs of lines each shifted a little more than the one above, so strokes lean and kink; at 1 a ramp, where the shift grows line by line and snaps back, so each cycle leans the letters further and tears them at the snap.

// The chain, after the machine. A card is shown on a monitor; the card is a
// picture and is never drawn again. What moves is the scan. Each line of the
// panel is a scan line y and reads the card a distance dx(y, t) to the side,
// and each column x reads it dy(x, t) up or down, so the sample for the LED
// at (x, y) is the card at (x + dx(y), y + dy(x)). dx is a sum of oscillators
// laid along the lines, each a waveform of y with its own number of cycles
// to the panel and its own phase speed, and dy the same along the columns.
// Both are multiplied by an envelope that rises and falls on its own slow
// clock, the operator's hand on the knob, and the depth knob sets how far it
// can reach. The card is kept as a signed distance field, so the edge of a
// letter stays one LED sharp at whatever fraction of an LED the line has
// moved, and a faint halo falls off outside it like phosphor bloom.
//
// The second camera pass: the ghost is the same card read with the
// oscillators and the envelope as they were a quarter of a second ago, shown
// in the second colour and a little dimmer, laid under the card so it shows
// only where the card is not. The feedback keeps the larger of the new frame
// and the last frame dimmed by 0.8, so wherever a stroke has just been it
// leaves a trail that falls off over five frames. The beam burns hottest
// along the middle of a stroke, so there the colour is pulled toward white.

const W = 64, H = 128;
const { floor, round, sin, cos, exp, asin, abs, PI, min, max, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The card is padded so that a line can read well past the panel.
const PX = 36, PY = 32, CW = W + 2 * PX, CH = H + 2 * PY;
// Letters 25 wide and 36 tall, strokes 5.5 thick, two to a line.
const LW = 25, LH = 36, ST = 5.5, GAP = 6;
const X0 = (W - (2 * LW + GAP)) / 2, Y1 = 20, Y2 = 72;
const FAR = -40;

// Distance from (px, py) to the segment a-b.
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = cl(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  const qx = ax + t * dx - px, qy = ay + t * dy - py;
  return Math.sqrt(qx * qx + qy * qy);
}
// Inside is positive. A box from (x, y) to (x + w, y + h).
function box(px, py, x, y, w, h) {
  return min(min(px - x, x + w - px), min(py - y, y + h - py));
}
// A ring along a rounded box, as thick as ST.
function ring(px, py, x, y, w, h, r) {
  const cx = x + w / 2, cy = y + h / 2, hx = w / 2 - ST / 2 - r, hy = h / 2 - ST / 2 - r;
  const qx = max(abs(px - cx) - hx, 0), qy = max(abs(py - cy) - hy, 0);
  const dOut = Math.sqrt(qx * qx + qy * qy) - r;
  const inner = min(max(abs(px - cx) - hx, abs(py - cy) - hy), 0);
  return ST / 2 - abs(dOut + inner);
}

// F, L, O and W as signed distance fields, each in the box that starts at (x, y).
function letterF(px, py, x, y) {
  return max(max(box(px, py, x, y, ST, LH), box(px, py, x, y, LW, ST)), box(px, py, x, y + 0.44 * LH, 0.8 * LW, ST));
}
function letterL(px, py, x, y) {
  return max(box(px, py, x, y, ST, LH), box(px, py, x, y + LH - ST, LW, ST));
}
function letterO(px, py, x, y) {
  return ring(px, py, x, y, LW, LH, 9);
}
function letterW(px, py, x, y) {
  const hw = ST / 2 + 0.4, xs = [x + hw, x + 0.27 * LW, x + 0.5 * LW, x + 0.73 * LW, x + LW - hw];
  const ys = [y, y + LH, y + 0.3 * LH, y + LH, y];
  let d = FAR;
  for (let i = 0; i < 4; i++) d = max(d, ST / 2 + 0.4 - segDist(px, py, xs[i], ys[i], xs[i + 1], ys[i + 1]));
  return min(d, min(py - y, y + LH - py));
}

function buildCard() {
  const card = new Float32Array(CW * CH);
  const x2 = X0 + LW + GAP;
  for (let j = 0; j < CH; j++) {
    const py = j - PY + 0.5;
    for (let i = 0; i < CW; i++) {
      const px = i - PX + 0.5;
      let d = FAR;
      d = max(d, letterF(px, py, X0, Y1));
      d = max(d, letterL(px, py, x2, Y1));
      d = max(d, letterO(px, py, X0, Y2));
      d = max(d, letterW(px, py, x2, Y2));
      card[j * CW + i] = d < FAR ? FAR : d;
    }
  }
  return card;
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// One waveform, phase ph in cycles. Shape 0 is a sine, 0.5 a triangle, 1 a ramp;
// all three cross zero rising at ph = 0 and swing between -1 and 1.
function wave(ph, s) {
  const f = ph - floor(ph);
  const sn = sin(2 * PI * ph);
  if (s < 0.5) {
    const u = s * 2;
    return sn + u * ((2 / PI) * asin(sn) - sn);
  }
  const tri = (2 / PI) * asin(sn), ramp = 2 * (f + 0.5 - floor(f + 0.5)) - 1, u = (s - 0.5) * 2;
  return tri + u * (ramp - tri);
}

// The operator's hand, 0 to 1 and back, with its own clock and phase.
function envelope(t, period, phase) {
  const e = 0.5 - 0.5 * cos(2 * PI * (t / period + phase));
  return 0.15 + 0.85 * e * e * (3 - 2 * e);
}

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, depth: 0.4, shape: 0.06,
    card: buildCard(),
    dxA: new Float32Array(H), dxG: new Float32Array(H), dyA: new Float32Array(W), dyG: new Float32Array(W),
    buf: new Float32Array(W * H * 3),
  };
}

// The line shift at time t, written into dx (per line) and dy (per column).
function deflect(S, t, dx, dy) {
  const s = S.shape, depth = S.depth;
  const hand = envelope(t, 16, 0.55), handY = envelope(t, 22, 0.1);
  const ax = 24 * depth * hand, ay = 12 * depth * handY;
  const wide = cl((depth - 0.7) / 0.9, 0, 1);
  for (let y = 0; y < H; y++) {
    const u = y / H;
    const a = wave(1.35 * u + 0.22 * t, s), b = wave(4.6 * u - 0.55 * t + 0.3, s), c = wave(11 * u + 0.9 * t + 0.6, s);
    dx[y] = ax * (0.6 * a + 0.4 * b + 0.3 * wide * c);
  }
  for (let x = 0; x < W; x++) {
    const u = x / W;
    const a = wave(1.7 * u + 0.31 * t, s), b = wave(4.2 * u - 0.5 * t + 0.2, s);
    dy[x] = ay * (0.65 * a + 0.35 * b);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.4, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.depth = cl(k[2] == null ? 0.4 : k[2], 0.4, 1.6);
  S.shape = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  S.t += d * S.speed;
  deflect(S, S.t + 3, S.dxA, S.dyA);
  // The ghost is the same chain a quarter of a second ago at Speed 2.
  deflect(S, S.t + 3 - 0.5, S.dxG, S.dyG);

  const hue = S.hue + 0.5;
  const cm = hsv(hue, 0.85, 1), cg = hsv(hue + 0.45, 0.85, 1);
  const card = S.card, buf = S.buf;
  const decay = pow(0.8, d * 30);
  const sample = (u, v) => {
    // Bilinear read of the field at card position (u, v) in panel LEDs.
    const fu = u + PX - 0.5, fv = v + PY - 0.5;
    const i = floor(fu), j = floor(fv);
    if (i < 0 || j < 0 || i >= CW - 1 || j >= CH - 1) return FAR;
    const a = fu - i, b = fv - j, o = j * CW + i;
    return (card[o] * (1 - a) + card[o + 1] * a) * (1 - b) + (card[o + CW] * (1 - a) + card[o + CW + 1] * a) * b;
  };
  const cover = (dd) => {
    // One LED of edge, and a halo outside.
    const edge = cl(dd + 0.5, 0, 1);
    return edge + (dd < 0.5 ? 0.22 * exp(min(dd, 0) / 2.4) * (1 - edge) : 0);
  };
  // The beam is hottest along the middle of a stroke: toward white there.
  const core = (dd) => 0.4 * cl((dd - 0.8) / 2.2, 0, 1);
  for (let y = 0; y < H; y++) {
    const sx = S.dxA[y], gx = S.dxG[y];
    for (let x = 0; x < W; x++) {
      const dm = sample(x + 0.5 + sx, y + 0.5 + S.dyA[x]);
      const m = cover(dm), w = core(dm);
      const g = 0.75 * cover(sample(x + 0.5 + gx, y + 0.5 + S.dyG[x]));
      const q = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) {
        const v = 255 * ((cm[c] + (1 - cm[c]) * w) * m + cg[c] * g * (1 - min(m, 1)));
        const prev = buf[q + c] * decay;
        buf[q + c] = v > prev ? v : prev;
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf;
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i += 3) display.setPixel(x, y, round(cl(buf[i], 0, 255)), round(cl(buf[i + 1], 0, 255)), round(cl(buf[i + 2], 0, 255)));
}
