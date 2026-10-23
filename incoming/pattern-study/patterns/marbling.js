// ===== Patternflow pattern =====
// Title:   Marbling
// Family:  print
// Idea:    Drops of ink land on a dark bath and spread into rings, a comb is drawn across them one way and back the other and then down through them, dragging the rings into chevrons and feathers, then the paper is lifted and the bath starts again.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Aubrey Jaffer's mathematical marbling, after Turkish ebru and Japanese suminagashi
// Round:   15
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Drops=3..8, Comb=0..1
//
// Knob 1: Hue. Turns the four inks round the colour wheel together, opening on ultramarine, turquoise, gold and rose.
// Knob 2: Speed. How fast the marbler works: one bath, drops to lift, takes 116 s at the bottom of the range, 11.6 s where it opens and 7.7 s at the top.
// Knob 3: Drops. How many places the inks are dropped, from 3 bullseyes about 50 LEDs across to 8 about 30 across; turning it lifts the print and the next bath has the new count.
// Knob 4: Comb. How close the comb's teeth stand, from 3 teeth 43 LEDs apart that drag the rings most of the panel's width to 16 teeth 8 LEDs apart that crimp them; the comb drawn down afterwards goes from 3 teeth to 10.
// Buttons: K1 tap lifts the paper now, whatever is on the bath, and the next bath starts.

const W = 64;
const H = 128;
const GW = W + 1;
const MAXSITES = 8;
// Five drops land on each site: ink, clear water, ink, clear water, ink.
const DROPS = 5;
// The drops of all the sites add up to this share of the panel's area.
const FILL = 0.8;
// A clear drop's radius against an ink drop's: the dark rings between inks.
const CLEAR = 0.8;
// How far a site stands off the panel's middle, in LEDs: OFF and up to 4 more.
const OFF = 5;
// The bath's programme in bath seconds. Speed 2 runs 0.9 of them a second.
const RATE = 0.45;
const DROPS_END = 2.6;
const SPREAD = 0.5;
const ACROSS = 3.0;
const BACK = 4.8;
const PASS = 1.6;
const DOWN = 6.6;
const DOWN_LEN = 1.4;
const LIFT = 9.0;
const LIFT_LEN = 1.0;
const REST = 0.4;
// The first frame finds the last site's drops landing.
const START = 1.6;
// How far a coarse comb drags the ink sideways at a tooth, in LEDs, and how
// far its pull reaches between teeth, as a share of the gap between them.
const ACROSS_PULL = 60;
const REACH = 0.75;
// The sideways pull of the comb, in LEDs, as a function of height, and the
// downward pull as a function of column: tables at a quarter LED, reaching
// 64 LEDs past the panel, since the bath goes on beyond it.
const TQ = 4;
const TY0 = -64;
const TY = (H + 128) * TQ;
const TX0 = -64;
const TX = (W + 128) * TQ;
// Ink hue and saturation, ultramarine, turquoise, gold, rose, before Hue turns them.
const INKS = [
  [0.63, 1],
  [0.48, 0.95],
  [0.12, 1],
  [0.94, 0.9],
];
const NI = INKS.length;

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

function ease(a, len, v) {
  const t = Math.max(0, Math.min(1, (v - a) / len));
  return t * t * (3 - 2 * t);
}

// Distance from d to the nearest tooth of a comb whose teeth stand at
// phase, phase + pitch, phase + 2 pitch and so on.
function toothDistance(d, phase, pitch) {
  d -= phase;
  d -= Math.floor(d / pitch) * pitch;
  return d < pitch - d ? d : pitch - d;
}

// A fresh bath. Each site is a spot where five drops land one after another.
// The sites stand one above the other near the middle of their bands, every
// other one 5 to 9 LEDs left of the panel's middle and the rest as far right,
// and land in a shuffled order. All sites take the same size of drop.
function newBath(P) {
  P.tau = 0;
  P.lift = -1;
  const sites = P.sites;
  const order = [];
  for (let i = 0; i < sites; i++) order.push(i);
  for (let i = sites - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = order[i];
    order[i] = order[j];
    order[j] = t;
  }
  const each = (DROPS_END - 0.1) / sites;
  const R = Math.sqrt((FILL * W * H) / (sites * (DROPS - 0.5) * Math.PI));
  let ink = Math.floor(Math.random() * NI);
  const flip = Math.random() < 0.5 ? 1 : -1;
  for (let s = 0; s < sites; s++) {
    const band = order[s];
    P.cx[s] = W / 2 + (band % 2 === 0 ? flip : -flip) * (OFF + Math.random() * 4);
    P.cy[s] = ((band + 0.35 + Math.random() * 0.3) * H) / sites;
    for (let d = 0; d < DROPS; d++) {
      const o = s * DROPS + d;
      // Ink and clear water take turns, ink first and last, so the rings
      // come out ink, dark, ink round an ink centre. The inks come round in
      // turn, so every bath carries all four.
      const clear = d % 2 === 1;
      P.ink[o] = clear ? -1 : ink++ % NI;
      P.rad[o] = R * (clear ? CLEAR : 1);
      P.t0[o] = 0.1 + s * each + (d * each * 0.8) / DROPS;
    }
  }
  // The first pass is drawn towards the side the even bands stand on (the
  // top and bottom sites at Drops 3), so it drags the odd ones across the
  // middle and folds the even ones back off the edge. Left to a coin, some
  // baths came out of the first pass looking much as they went in.
  P.dir = flip;
}

export function setup(params) {
  params.cx = new Float64Array(MAXSITES);
  params.cy = new Float64Array(MAXSITES);
  params.ink = new Int8Array(MAXSITES * DROPS);
  params.rad = new Float64Array(MAXSITES * DROPS);
  params.t0 = new Float64Array(MAXSITES * DROPS);
  params.r2 = new Float64Array(MAXSITES * DROPS);
  params.rowShift = new Float64Array(TY + 1);
  params.colShift = new Float64Array(TX + 1);
  params.tau = 0;
  params.lift = -1;
  params.dir = 1;
  params.sites = 3;
  params.live = 0;
  params.hue = 0;
  params.started = false;
  params.idx = new Int8Array(GW * (H + 1));
  params.px = new Float64Array(GW);
  params.py = new Float64Array(GW);
  params.hit = new Int8Array(GW);
  params.rgb = new Float32Array(NI * 3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 3, 0.06];
  dt = Math.min(dt, 0.1);
  const P = params;
  P.hue = k[0];
  const comb = Math.max(0, Math.min(1, k[3]));
  const sites = Math.max(3, Math.min(MAXSITES, Math.round(k[2])));
  const step = dt * Math.max(0.05, k[1]) * RATE;
  if (!P.started) {
    P.started = true;
    P.sites = sites;
    newBath(P);
    P.tau = START;
  }
  // The paper goes down on the bath and comes up with the print; then the
  // bath is skimmed and the next drops fall. A tap, or a new Drops count,
  // lifts whatever is on the bath now.
  const tap = input.btnPressed && input.btnPressed[0];
  if (P.lift < 0 && (P.tau >= LIFT || tap || sites !== P.sites)) P.lift = 0;
  if (P.lift >= 0) {
    P.lift += step;
    if (P.lift >= LIFT_LEN + REST) {
      P.sites = sites;
      newBath(P);
    }
  } else P.tau += step;
  const tau = P.tau;

  // Every drop's radius squared as it stands now. A drop spreads fast and
  // slows as it meets the bath.
  let live = 0;
  for (let o = 0; o < P.sites * DROPS; o++) {
    const u = Math.max(0, Math.min(1, (tau - P.t0[o]) / SPREAD));
    const r = P.rad[o] * (1 - (1 - u) * (1 - u) * (1 - u));
    P.r2[o] = r * r;
    if (u > 0) live = Math.floor(o / DROPS) + 1;
  }
  P.live = live;

  // The comb is drawn across, then back the other way with its teeth
  // between the first pass's, then a finer comb is drawn down. A tooth drags
  // the bath along with it, less the further from the tooth: Jaffer's tine
  // line, a pull of size * lam / (d + lam) at distance d.
  const teeth = 3 + Math.round(comb * 13);
  const pitch = H / teeth;
  const lam = 2 + pitch * REACH;
  // A fine comb drags the ink less far than a coarse one.
  const pull = ACROSS_PULL * Math.min(1, pitch / 30);
  const a1 = pull * ease(ACROSS, PASS, tau) * P.dir;
  const a2 = -pull * ease(BACK, PASS, tau) * P.dir;
  const rows = P.rowShift;
  for (let i = 0; i <= TY; i++) {
    const y = TY0 + i / TQ;
    let sh = 0;
    if (a1 !== 0) sh += (a1 * lam) / (toothDistance(y, pitch * 0.5, pitch) + lam);
    if (a2 !== 0) sh += (a2 * lam) / (toothDistance(y, 0, pitch) + lam);
    rows[i] = sh;
  }
  const down = 3 + Math.round(comb * 7);
  const dpitch = W / down;
  const a3 = 14 * Math.min(1, dpitch / 16) * ease(DOWN, DOWN_LEN, tau);
  const cols = P.colShift;
  for (let i = 0; i <= TX; i++) cols[i] = a3 === 0 ? 0 : (a3 * 2.5) / (toothDistance(TX0 + i / TQ, dpitch * 0.5, dpitch) + 2.5);
}

function lookup(table, v, v0, n) {
  let f = (v - v0) * TQ;
  if (f <= 0) return table[0];
  if (f >= n) return table[n];
  const i = Math.floor(f);
  f -= i;
  return table[i] + (table[i + 1] - table[i]) * f;
}

// Finds whose ink lies under each corner of LEDs along the row at height y:
// follows each point backwards through the comb strokes and then every site,
// newest first, and writes 0..3 into hit, or -1 for the dark bath. The whole
// row goes through one site before the next, so the processor can work on
// many points while each waits on its square root.
function inkRow(P, y) {
  const cx = P.cx;
  const cy = P.cy;
  const r2 = P.r2;
  const inks = P.ink;
  const px = P.px;
  const py = P.py;
  const hit = P.hit;
  const rows = P.rowShift;
  const cols = P.colShift;
  for (let j = 0; j < GW; j++) {
    const yy = y - lookup(cols, j, TX0, TX);
    let x = j - lookup(rows, yy, TY0, TY);
    // The bath past the panel's sides mirrors the panel, so a comb pulls
    // ink in from beyond the edge.
    x -= Math.floor(x / (2 * W)) * 2 * W;
    px[j] = x < W ? x : 2 * W - x;
    py[j] = yy;
    hit[j] = -2;
  }
  for (let s = P.live - 1; s >= 0; s--) {
    const ox = cx[s];
    const oy = cy[s];
    const base = s * DROPS;
    for (let j = 0; j < GW; j++) {
      if (hit[j] !== -2) continue;
      const dx = px[j] - ox;
      const dy = py[j] - oy;
      const d2 = dx * dx + dy * dy;
      // Drops on one spot push straight outward, so their areas add up: a
      // point is in the newest drop, or in the ring of the one before, and so
      // on, and past them all it comes in by their total area.
      let rest = d2;
      let o = base + DROPS - 1;
      for (; o >= base; o--) {
        if (rest < r2[o]) break;
        rest -= r2[o];
      }
      if (o >= base) hit[j] = inks[o];
      else if (rest < d2) {
        const f = Math.sqrt(rest / d2);
        px[j] = ox + dx * f;
        py[j] = oy + dy * f;
      }
    }
  }
}

export function draw(display, params, time) {
  const P = params;
  const idx = P.idx;
  const rgb = P.rgb;
  const hit = P.hit;
  for (let i = 0; i < NI; i++) hsvInto(rgb, i * 3, INKS[i][0] + P.hue, INKS[i][1], 1);
  // The bath is sampled at the LEDs' corners, and each LED shows the mean of
  // its four corners: one sample an LED, and edges come out soft by a step.
  for (let y = 0; y <= H; y++) {
    inkRow(P, y);
    for (let j = 0; j < GW; j++) idx[y * GW + j] = hit[j] === -2 ? -1 : hit[j];
  }
  for (let y = 0; y < H; y++) {
    // The paper peels off from the top and takes the print with it.
    const fade = P.lift < 0 ? 1 : 1 - ease((y / H) * 0.4, 0.6, P.lift);
    if (fade <= 0) continue;
    for (let x = 0; x < W; x++) {
      const p = y * GW + x;
      const a = idx[p];
      const b2 = idx[p + 1];
      const c = idx[p + GW];
      const d = idx[p + GW + 1];
      let r = 0;
      let g = 0;
      let b = 0;
      if (a === b2 && a === c && a === d) {
        if (a < 0) continue;
        r = rgb[a * 3];
        g = rgb[a * 3 + 1];
        b = rgb[a * 3 + 2];
      } else {
        for (let n = 0; n < 4; n++) {
          const e = n === 0 ? a : n === 1 ? b2 : n === 2 ? c : d;
          if (e < 0) continue;
          r += rgb[e * 3] * 0.25;
          g += rgb[e * 3 + 1] * 0.25;
          b += rgb[e * 3 + 2] * 0.25;
        }
      }
      display.setPixel(x, y, r * fade, g * fade, b * fade);
    }
  }
}
