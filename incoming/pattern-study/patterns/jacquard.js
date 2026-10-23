// ===== Patternflow pattern =====
// Title:   Jacquard Loom
// Family:  textile
// Idea:    A punched-card loom weaving down the panel: each card lifts its warp ends, the shuttle flies the weft through the shed, the reed beats it in, and the cloth below carries the figure the holes spelled.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Joseph Marie Jacquard's punched-card loom (1804)
// Round:   4
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..5, Card=1..4, Stripes=0..1
//
// Knob 1: Hue. Turns every thread's colour together, starting from an indigo warp over a weft that runs gold, orange, rose, violet, turquoise and green.
// Knob 2: Speed. Picks a second, from half a pick, where the shuttle drifts across, to five, where it is a streak.
// Knob 3: Card. The deck laced on the loom: nested diamonds, eight-pointed stars, chevrons, then a houndstooth that no card draws, only a twill over four ends and four picks of each of two colours. The cards change at once; the cloth changes from the fell down.
// Knob 4: Stripes. How often the shuttle changes colour: broad bands every ten picks at the bottom of the range, a new colour every pick at the top. The houndstooth keeps its four indigo and four cream picks.
// Buttons: K1 tap turns the deck over, so the next picks weave the back of the cloth, figure and ground traded.

const W = 64;
const H = 128;
// Thirty-two warp ends, two LEDs each. A pick of weft is two rows.
const ENDS = 32;
// Five punched cards of four rows above the griffe bar.
const CARD = 4;
const CARDS = 5;
const BAR = CARD * CARDS;
// The heddle eyes: a lifted end's eye rides RISE rows above a lowered one's.
const EYE = 30;
const RISE = 3;
// The reed rests at REED and beats each pick down against the fell.
const REED = 34;
const FELL = 48;
// Picks kept: the cloth shows 41 of them, the cards one more.
const KEEP = 44;
// The weft's colours go up the row and back, so bands grade into each other.
const SEQ = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1];
const INDIGO = 6;
const CREAM = 7;

// Times within one pick, 0..1: the cards drop and the shed opens, the
// shuttle flies, the reed beats, the cloth is taken up.
const SHED = 0.12;
const FLOWN = 0.55;
const BEAT = 0.75;
const BACK = 0.95;

function hsvInto(out, o, h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

function smooth(a, b, v) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Where the figure is, on the pattern's grid of ends and picks.
function figure(design, w, j) {
  if (design === 0) {
    // Nested diamonds, four ends to a ring, one diamond the width of the cloth.
    const x = Math.abs(w - 15.5);
    const y = Math.abs((j % 32) - 15.5);
    return Math.floor((x + y) / 4) % 2 === 0;
  }
  if (design === 1) {
    // An eight-pointed star the width of the cloth, a square and a diamond
    // laid on each other, with a diamond cut from its middle.
    const dx = Math.abs(w - 15.5);
    const dy = Math.abs((j % 32) - 15.5);
    return ((Math.max(dx, dy) < 8 || dx + dy < 14) && dx + dy > 4) || dx + dy > 25;
  }
  // Chevrons six picks deep.
  const tx = w % 16;
  const z = tx < 8 ? tx : 15 - tx;
  return (j + z) % 12 < 6;
}

// Is end w over the weft on pick j? The figure is a warp-faced satin and
// the ground a weft-faced one, each tied down once in eight.
function liftOf(design, flip, w, j) {
  let up;
  if (design === 3) up = (w + j) % 4 < 2;
  else if (figure(design, w, j)) up = (j + 3 * w) % 8 !== 0;
  else up = (j + 5 * w) % 8 === 0;
  return flip ? !up : up;
}

// Houndstooth is four ends and four picks of each colour, and only reads
// when the light warp and the light weft are the same cream.
function warpOf(design, w) {
  if (design === 3) return Math.floor(w / 4) % 2 === 0 ? INDIGO : CREAM;
  // Cream selvedges.
  return w === 0 || w === ENDS - 1 ? CREAM : INDIGO;
}

function weftOf(design, j, band) {
  if (design === 3) return Math.floor(j / 4) % 2 === 0 ? INDIGO : CREAM;
  return SEQ[Math.floor(j / band) % SEQ.length];
}

export function setup(params) {
  params.lift = new Uint8Array(KEEP * ENDS);
  params.weft = new Uint8Array(KEEP);
  params.deck = new Uint8Array(KEEP);
  params.pal = new Float32Array(8 * 3);
  params.pick = 0;
  params.phase = 0;
  params.started = false;
  params.flip = false;
  params.design = 0;
  params.band = 9;
  params.speed = 2;
  params.hue = 0;
}

// The card for pick q comes to the needles: its holes become the shed.
function startPick(params, q) {
  const slot = q % KEEP;
  for (let w = 0; w < ENDS; w++) params.lift[slot * ENDS + w] = liftOf(params.design, params.flip, w, q) ? 1 : 0;
  params.weft[slot] = weftOf(params.design, q, params.band);
  params.deck[slot] = params.design;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 1, 0.06];
  dt = Math.min(dt, 0.1);
  params.hue = k[0];
  params.speed = Math.max(0.1, k[1]);
  params.design = Math.max(0, Math.min(3, Math.round(k[2]) - 1));
  params.band = Math.max(1, Math.round(1 + 9 * (1 - Math.max(0, Math.min(1, k[3])))));
  if (!params.started) {
    params.started = true;
    // A loom that has been weaving a while: the cloth already reaches the floor.
    for (let q = 0; q <= KEEP; q++) startPick(params, q);
    params.pick = KEEP;
    params.phase = 0.3;
  }
  if (input.btnPressed && input.btnPressed[0]) params.flip = !params.flip;
  params.phase += dt * params.speed;
  while (params.phase >= 1) {
    params.phase -= 1;
    params.pick++;
    startPick(params, params.pick);
  }
}

// Is end w up on pick q, for a pick the loom has read or is about to?
function cardLift(params, q, w) {
  if (q <= params.pick) return params.lift[(q % KEEP) * ENDS + w] === 1;
  return liftOf(params.design, params.flip, w, q);
}

export function draw(display, params, time) {
  const pal = params.pal;
  const hue = params.hue;
  // The weft's gold, orange, rose, violet, turquoise and green, then the warp's indigo and cream.
  hsvInto(pal, 0, hue + 0.12, 0.95, 1);
  hsvInto(pal, 3, hue + 0.06, 0.95, 1);
  hsvInto(pal, 6, hue + 0.96, 0.85, 1);
  hsvInto(pal, 9, hue + 0.8, 0.75, 1);
  hsvInto(pal, 12, hue + 0.48, 0.95, 1);
  hsvInto(pal, 15, hue + 0.3, 0.9, 0.95);
  // The warp is lit brighter and paler where the hue turns it yellow, since dim yellow reads as olive.
  const warm = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * (hue + 0.63 - 0.14)), 3);
  hsvInto(pal, 18, hue + 0.63, 0.9 - 0.2 * warm, 0.8 + 0.2 * warm);
  hsvInto(pal, 21, hue + 0.11, 0.16, 0.95);

  const lift = params.lift;
  const weft = params.weft;
  const deck = params.deck;
  const pick = params.pick;
  const phase = params.phase;
  const set = (x, y, r, g, b) => display.setPixel(x, y, Math.min(255, r), Math.min(255, g), Math.min(255, b));

  // The punched cards, dropping one card a pick onto the needles.
  const drop = Math.round(smooth(0, SHED, phase) * CARD);
  for (let y = 0; y < BAR; y++) for (let x = 0; x < W; x++) set(x, y, 10, 9, 8);
  for (let c = -1; c <= CARDS; c++) {
    const q = pick + c;
    const top = BAR - CARD * (c + 1) - (CARD - drop);
    for (let r = 0; r < CARD; r++) {
      const y = top + r;
      if (y < 0 || y >= BAR) continue;
      for (let x = 0; x < W; x++) {
        if (r === 3) {
          // The lacing between cards.
          if (x === 4 || x === 59) set(x, y, 120, 100, 70);
          continue;
        }
        const shade = r === 0 ? 0.8 : 1;
        if (r > 0 && x % 2 === 0 && cardLift(params, q, x >> 1)) set(x, y, 12, 10, 8);
        else set(x, y, 228 * shade, 204 * shade, 156 * shade);
      }
    }
  }
  // The griffe bar the hooks hang from.
  for (let x = 0; x < W; x++) {
    set(x, BAR, 150, 152, 162);
    set(x, BAR + 1, 64, 66, 76);
  }

  // The shed: cords down to the heddle eyes, then each end on to the fell.
  const shedPick = phase < SHED ? pick - 1 : pick;
  const shedSlot = (shedPick % KEEP) * ENDS;
  const woven = phase >= BEAT ? pick : pick - 1;
  const take = phase >= BEAT ? (phase < 0.82 ? 0 : phase < 0.88 ? 1 : 2) : 2;
  const clothTop = FELL - 2 + take;
  for (let y = BAR + 2; y < clothTop; y++) for (let x = 0; x < W; x++) set(x, y, 8, 8, 10);
  for (let w = 0; w < ENDS; w++) {
    const up = lift[shedSlot + w] === 1;
    const eye = up ? EYE - RISE : EYE;
    const c = warpOf(deck[shedPick % KEEP], w) * 3;
    const x = 2 * w;
    for (let y = BAR + 2; y < clothTop; y++) {
      if (y < eye) {
        const v = up ? 92 : 52;
        set(x, y, v, v, v + 6);
      } else if (y === eye) set(x, y, 214, 214, 224);
      else {
        const v = up ? 1 : 0.5;
        set(x, y, pal[c] * v, pal[c + 1] * v, pal[c + 2] * v);
      }
    }
  }

  // The reed swings in after the shuttle and back.
  let swing = 0;
  if (phase >= FLOWN && phase < BEAT) {
    const u = (phase - FLOWN) / (BEAT - FLOWN);
    swing = u * u;
  } else if (phase >= BEAT && phase < BACK) swing = 1 - smooth(BEAT, BACK, phase);
  const reedY = Math.round(REED + (FELL - 4 - REED) * swing);
  const pickY = phase < BEAT ? reedY + 2 : FELL - 2;

  // The weft the shuttle has laid so far, under every lifted end.
  if (phase >= SHED && phase < BEAT) {
    const dir = pick % 2 === 0 ? 1 : -1;
    const u = smooth(SHED, FLOWN, phase);
    const sx = dir > 0 ? -6 + 76 * u : 69 - 76 * u;
    const from = dir > 0 ? 0 : Math.max(0, Math.round(sx));
    const to = dir > 0 ? Math.min(W - 1, Math.round(sx)) : W - 1;
    const wc = weft[pick % KEEP] * 3;
    for (let x = from; x <= to; x++) {
      if (x % 2 === 0 && lift[(pick % KEEP) * ENDS + (x >> 1)] === 1) continue;
      for (let dy = 0; dy < 2; dy++) {
        const v = dy === 0 ? 1 : 0.7;
        set(x, pickY + dy, pal[wc] * v, pal[wc + 1] * v, pal[wc + 2] * v);
      }
    }
    if (phase < FLOWN) {
      // The shuttle: a wooden boat with steel tips, the pirn showing in its middle.
      const cx = Math.round(sx);
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        if (x < 0 || x >= W) continue;
        const ax = Math.abs(dx);
        if (ax <= 3) set(x, pickY - 1, 205, 142, 74);
        if (ax === 4) set(x, pickY, 200, 200, 212);
        else if (ax <= 1) set(x, pickY, pal[wc], pal[wc + 1], pal[wc + 2]);
        else set(x, pickY, 176, 116, 58);
        if (ax <= 3) set(x, pickY + 1, 120, 76, 38);
      }
    }
  }
  for (let x = 0; x < W; x++) {
    set(x, reedY, 196, 146, 84);
    const d = x % 2 === 1 ? 176 : 70;
    set(x, reedY + 1, d, d, d + 10);
  }

  // The cloth, newest pick at the fell. Each float is lit on one side and
  // dips where it goes under its neighbour.
  for (let y = clothTop; y < H; y++) {
    const age = (y - clothTop) >> 1;
    const dy = (y - clothTop) & 1;
    const p = woven - age;
    const slot = (p % KEEP) * ENDS;
    const above = p < woven ? ((p + 1) % KEEP) * ENDS : -1;
    const below = ((p - 1 + KEEP) % KEEP) * ENDS;
    const wc = weft[p % KEEP] * 3;
    const d = deck[p % KEEP];
    for (let x = 0; x < W; x++) {
      const w = x >> 1;
      const dx = x & 1;
      let v;
      let c;
      if (lift[slot + w] === 1) {
        c = warpOf(d, w) * 3;
        v = dx === 0 ? 1 : 0.72;
        const next = dy === 0 ? above : below;
        if (next >= 0 && lift[next + w] === 0) v *= 0.78;
      } else {
        c = wc;
        v = dy === 0 ? 1 : 0.7;
        const n = dx === 0 ? w - 1 : w + 1;
        if (n >= 0 && n < ENDS && lift[slot + n] === 1) v *= 0.78;
      }
      set(x, y, pal[c] * v, pal[c + 1] * v, pal[c + 2] * v);
    }
  }
}
