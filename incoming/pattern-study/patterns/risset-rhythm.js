// ===== Patternflow pattern =====
// Title:   Risset Rhythm
// Family:  rhythm
// Idea:    A binary ruler, its ticks longer the coarser their level, lies across five octaves of tempo and zooms out by two every four seconds towards a point just under the panel, so each lane of ticks strikes the playhead ever faster while the lanes slide towards the fast side under a fixed bell of light, and after each doubling the picture is exactly where it began.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Risset's eternal accelerando (Jean-Claude Risset, 1970s), the rhythmic twin of Shepard tones (Roger Shepard, 1964), pattern round 50
// Round:   50
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Spread=-1..1, Ratio=2..4
//
// Knob 1: Hue. Turns the colours across the panel together; the strikes stay white. At 0 the slow lanes on the left are green, the middle azure and the fast lanes on the right violet; at 0.25 cyan, purple and orange; at 0.5 purple, red-orange and green; at 0.75 orange, green and blue.
// Knob 2: Speed. Every tempo doubles in 8 / Speed seconds: 4 at 2, 40 at 0.2 and 2.7 at 3. At 2 the ticks cross the playhead at 11 rows a second, and a lane strikes 0.23 times a second at the left edge, 1.3 at the middle and 7 at the right edge, each lane twice as often one doubling later, by which time it has slid one lane to the right.
// Knob 3: Spread. The width of the bell of light in octaves of tempo, 1.4 times 2 to the knob. At 0 the edge lanes glow at a fifth of the middle; at -1 (0.7 octaves) one lane carries the light and the edges are dark; at 1 (2.8 octaves) the edges keep two thirds and the hand-over from fast to slow shows plainly.
// Knob 4: Ratio. The tempo ratio between neighbouring layers, rounded to 2, 3 or 4: a binary, ternary or base-four ruler. Its lanes are 12.8, 20.3 and 25.6 LEDs wide, a doubling of tempo always being 12.8, and the picture repeats after one ratio's worth of tempo, every 4, 6.3 and 8 seconds at Speed 2.
// Buttons: K1 tap turns the accelerando into a ritardando and back: the zoom runs the other way, the ticks rise through the playhead, the lanes slide towards the slow side and every tempo halves in the time it took to double.

const W = 64, H = 128, NP = W * H;
const { floor, ceil, min, max, exp, pow, log2, round, LN2 } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Across the panel runs log tempo: OCT LEDs to an octave, five octaves from
// the slowest layer on the left to the fastest on the right. The loudness
// bell is centred BELL octaves in from the left.
const OCT = W / 5, BELL = 2.4;
// The ruler's zero, the point the zoom closes on, sits 8 rows below the
// bottom edge; the playhead is row PLAY. The layer at the left edge has its
// ticks SP0 rows apart.
const Y0 = H + 8, PLAY = 72, SP0 = 48;
// Seconds for every tempo to double at Speed 2, and how long a hit glows.
const T2 = 4, GLOW = 0.12;
// The light of a played tick against one to come, the rows the white of a
// tick crossing the playhead takes to fade, the halo of a hit and its reach
// in rows, and the faint light of every other lane.
const PAST = 0.6, FLASH = 3, HALO = 0.45, HR = 12, LANE = 0.12;

export function setup(params) {
  params.s = {
    t: 0, dir: 1, hue: 0, speed: 2, spread: 1.4, r: 2,
    buf: new Float32Array(NP * 3), bell: new Float32Array(W), cr: new Float32Array(W), cg: new Float32Array(W), cb: new Float32Array(W),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 2];
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.spread = 1.4 * pow(2, cl(k[2], -1, 1));
  S.r = round(cl(k[3], 2, 4));
  if (input.btnPressed && input.btnPressed[0]) S.dir = -S.dir;
  // t counts doublings: every tempo is 2^t times what it was at the start.
  S.t += (S.dir * cl(dt || 0, 0, 0.1) * S.speed) / (2 * T2);
}

function hsv(h, s, v, o, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0][o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1][o] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2][o] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { buf, bell, cr, cg, cb } = S;
  buf.fill(0);
  // The bell is fixed in log tempo: each column's loudness, and its colour.
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / OCT - BELL;
    bell[x] = exp((-u * u) / (2 * S.spread * S.spread));
    hsv(S.hue + 0.3 + (0.55 * x) / W, 0.8, 1, x, [cr, cg, cb]);
  }
  // One period of the picture is log2(r) doublings: then every layer has
  // become the next one.
  const r = S.r, per = log2(r), lw = OCT * per;
  const z = S.t / per, n = floor(z), p = z - n;
  // Real seconds per doubling at this speed, for the glow of a hit.
  const Td = (2 * T2) / S.speed;
  // Bars just past the playhead burn white, fading over FLASH rows.
  const sgn = S.dir > 0 ? 1 : -1;
  for (let j = -2; (j + p) * lw < W; j++) {
    const x0 = max(0, floor((j + p) * lw + 0.5)), x1 = min(W, floor((j + 1 + p) * lw + 0.5));
    if (x1 <= x0) continue;
    const sp = SP0 * pow(r, -(j + p)), th = cl(sp / 4, 0.6, 2.2);
    // Ticks: every multiple of sp above the ruler's zero.
    const m0 = max(0, ceil((Y0 - H - 2) / sp)), m1 = floor((Y0 + 2) / sp);
    if (sp >= 1.2) {
      for (let m = m0; m <= m1; m++) {
        // Played ticks, past the playhead, are dimmer than the ones to come.
        const y = Y0 - m * sp, d = sgn * (y - PLAY);
        bar(buf, y, th, x0, x1, d > 0 ? PAST : 1, d > -0.5 ? exp(-max(0, d) / FLASH) : 0, bell, cr, cg, cb);
      }
    } else {
      for (let y = 0; y < H; y++) line(buf, y, x0, x1, min(1, 0.8 / sp) * (sgn * (y - PLAY) > 0 ? PAST : 1), 0, bell, cr, cg, cb);
    }
    // A hit: the playhead stands phi tick spacings above zero, so the layer
    // strikes whenever phi passes a whole number, phi ln2 times a doubling.
    const phi = (Y0 - PLAY) / sp, fr = phi - floor(phi);
    const age = ((S.dir > 0 ? fr : 1 - fr) * Td) / (phi * LN2);
    const g = exp(-age / GLOW);
    for (let dy = -HR; dy <= HR; dy++) {
      const f = 1 - Math.abs(dy) / (HR + 1);
      line(buf, PLAY + dy, x0, x1, HALO * g * f * f, 0.3 * HALO * g * f * f * f, bell, cr, cg, cb);
    }
  }
  // Each lane is faintly lit, with a dark seam at its edges, so the lanes
  // show sliding towards the fast side.
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / lw - p, e = (u - floor(u)) * lw, v = LANE * min(1, e / 1.5, (lw - e) / 1.5);
    for (let y = 0; y < H; y++) line(buf, y, x, x + 1, v, 0, bell, cr, cg, cb);
  }
  // The playhead.
  for (let x = 0, o = 3 * PLAY * W; x < W; x++, o += 3) (buf[o] += 0.16), (buf[o + 1] += 0.16), (buf[o + 2] += 0.16);
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const o = 3 * p;
      display.setPixel(x, y, q4(buf[o]), q4(buf[o + 1]), q4(buf[o + 2]));
    }
}

// A bar th rows thick centred on row y, spread over the rows it covers.
function bar(buf, y, th, x0, x1, v, w, bell, cr, cg, cb) {
  const top = y - th / 2, bot = y + th / 2;
  for (let a = floor(top); a < bot; a++) {
    const c = min(bot, a + 1) - max(top, a);
    if (c > 0) line(buf, a, x0, x1, v * c, w * c, bell, cr, cg, cb);
  }
}

// Adds colour v and white w along row y from x0 to x1, each column weighted
// by the bell.
function line(buf, y, x0, x1, v, w, bell, cr, cg, cb) {
  if (y < 0 || y >= H) return;
  for (let x = x0, o = 3 * (y * W + x0); x < x1; x++, o += 3) {
    const b = bell[x], c = v * b, e = w * b;
    buf[o] += c * cr[x] + e;
    buf[o + 1] += c * cg[x] + e;
    buf[o + 2] += c * cb[x] + e;
  }
}

// Channels in steps of 4 of 255, from 0..1.
const q4 = (v) => (v >= 1 ? 252 : ((v * 63 + 0.5) | 0) << 2);
