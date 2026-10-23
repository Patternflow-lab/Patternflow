// ===== Patternflow pattern =====
// Title:   Bismuth
// Family:  mineral
// Idea:    Stepped square hopper crystals of bismuth grow up out of a glowing melt pool to the top of the panel, each terrace turning through the oxide film's silver, gold, purple, blue and green as it ages, until the melt rises and takes them back.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 18, after lab-grown bismuth hopper crystals and the interference colours of their oxide skin
// Round:   18
// ===============================
// @matrix 64x128
// @knobs Tint=0..1, Speed=0.2..3, Steps=3..8, Heat=0..1
//
// Knob 1: Tint. Moves every terrace along the oxide sequence: at 0 fresh growth is silver and gold, at 0.5 it starts out purple and blue, at 1 in the second order's gold and pink.
// Knob 2: Speed. How fast the crystals grow and their oxide thickens: at 2 the cluster climbs the 113 rows to the top in about 40 s, at 0.2 it barely moves.
// Knob 3: Steps. How wide each terrace of a hopper is, from fine 3 LED steps to deep 8 LED steps, so how many rings each square shows.
// Knob 4: Heat. How hot the pool burns, from dull cherry red to yellow; a hotter pool lights the lower crystals, thickens their oxide faster and rises sooner to take the cluster back.
// Buttons: K1 tap heats the pool now: the melt rises up the panel, takes the cluster back and drains, and growth starts again.

const W = 64;
const H = 128;
const N = W * H;
// The pool's surface row when it is at rest.
const POOL = 116;
// Growth phases.
const GROW = 0;
const HOLD = 1;
const MELT = 2;
const DRAIN = 3;
// Oxide film colours by thickness: bare silver, then the first order's straw,
// gold, bronze, magenta, purple and blue, the second order's sky, teal, gold
// and pink. Old metal slows toward the second order's teal, and Tint wraps
// what goes past it back round to gold.
const FILM = [
  [0.0, 200, 204, 214],
  [0.08, 218, 208, 168],
  [0.17, 240, 190, 78],
  [0.26, 226, 130, 64],
  [0.34, 206, 64, 126],
  [0.42, 150, 54, 200],
  [0.5, 70, 84, 236],
  [0.59, 50, 160, 230],
  [0.68, 44, 210, 170],
  [0.78, 150, 216, 80],
  [0.86, 238, 198, 70],
  [0.96, 240, 108, 150],
  [1.06, 168, 92, 210],
  [1.18, 70, 172, 196],
  [1.25, 96, 190, 176],
];
const LUT = 600;
// The longest the opening runs ahead, in seconds, waiting for the cluster to
// reach row 20.
const PRE = 60;
const TH_MAX = 1.25;

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function buildLut(P) {
  P.lut = new Float32Array(LUT * 3);
  for (let i = 0; i < LUT; i++) {
    const th = (i / (LUT - 1)) * TH_MAX;
    let j = 0;
    while (j < FILM.length - 2 && FILM[j + 1][0] < th) j++;
    const a = FILM[j];
    const b = FILM[j + 1];
    const f = clamp((th - a[0]) / (b[0] - a[0]), 0, 1);
    const s = f * f * (3 - 2 * f);
    for (let c = 0; c < 3; c++) P.lut[i * 3 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * s;
  }
}

export function setup(params) {
  const P = params;
  P.owner = new Int16Array(N);
  P.dist = new Uint8Array(N);
  P.phase = new Uint8Array(N);
  P.buf = new Float32Array(N * 3);
  // Per LED: when its terrace started, and how far across the terrace it sits.
  P.tStart = new Float32Array(N);
  P.frac = new Float32Array(N);
  P.wAt = 3;
  buildLut(P);
  // Oxide thickness grows as age to the power 0.82, here in tenths of a second.
  P.ageLut = new Float32Array(4001);
  for (let i = 0; i <= 4000; i++) P.ageLut[i] = Math.pow(i / 10, 0.82);
  P.glint = new Float32Array(513);
  for (let i = 0; i <= 512; i++) P.glint[i] = Math.exp(-(((i - 256) / 4 / 16) ** 2));
  Object.assign(P, { T: 0, t: 0, tint: 0, w: 3, heat: 0.06, started: false });
  restart(P);
}

// A clean pool: no crystals, and three seeds on its surface spread across the width.
function restart(P) {
  P.owner.fill(0);
  P.crystals = [];
  P.mode = GROW;
  P.modeT = 0;
  P.melt = POOL;
  P.fill = 0;
  P.quiet = 0;
  for (let i = 0; i < 3; i++) addCrystal(P, Math.round(10 + 22 * i + (Math.random() - 0.5) * 6), POOL - 3, null, false);
}

function addCrystal(P, x, y, parent, small) {
  // A big crystal keeps growing round its neighbours where a small one stops.
  const big = !small && (!parent || Math.random() < 0.3);
  const c = {
    id: P.crystals.length + 1,
    x,
    y,
    parent: parent ? parent.id : 0,
    gen: parent ? parent.gen + 1 : 0,
    tb: P.T,
    // Half-size r grows as rmax * (1 - exp(-age / tau)): fast at first, then
    // slower as the melt round it runs out.
    rmax: small ? 3 + Math.floor(Math.random() * 3) : parent ? (big ? 10 + Math.floor(Math.random() * 6) : 5 + Math.floor(Math.random() * 6)) : 13 + Math.floor(Math.random() * 5),
    tau: small ? 4 : parent ? 6 + Math.random() * 3 : 14,
    r: 0,
    // Branch slots: 0 and 1 the upper corners, 2 the top, 3 and 4 the sides.
    slots: small ? [] : shuffle(parent && parent.gen > 1 ? [0, 1] : parent ? [0, 1, Math.random() < 0.5 ? 3 : 4] : [0, 1, 2, 3, 4]),
    // Each crystal's own oxide rate: the melt is not the same heat everywhere.
    ox: 0.8 + 0.45 * Math.random(),
    nextKid: parent ? 2 : 3,
    // The side the square spiral starts its turn on, and which way it turns.
    spin: Math.floor(Math.random() * 4),
    hand: Math.random() < 0.5 ? 1 : 3,
    big,
    done: false,
  };
  P.crystals.push(c);
  claimRing(P, c, 0, true);
  return c;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The quarter turn of a square spiral an LED of a crystal sits on.
function sideOf(c, dx, dy) {
  const s = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
  return ((s * c.hand + c.spin) % 4) * 64;
}

const family = (P, c, q) => q === c.id || q === c.parent || P.crystals[q - 1].parent === c.id;

// Looks at ring r of a crystal, a square. With claim set, takes the LEDs no crystal has reached;
// without it, returns the share of the ring's LEDs inside the panel that
// another crystal, not a parent or a branch, already holds.
function claimRing(P, c, r, claim) {
  let taken = 0;
  let total = 0;
  const own = P.owner;
  const take = (dx, dy) => {
    const x = c.x + dx;
    const y = c.y + dy;
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const p = y * W + x;
    if (y >= P.melt - 0.5) return;
    const q = own[p];
    if (claim) {
      if (q) return;
      own[p] = c.id;
      P.dist[p] = r;
      P.phase[p] = sideOf(c, dx, dy);
      terrace(P, c, p);
      return;
    }
    if (q && family(P, c, q)) return;
    total++;
    if (q) taken++;
  };
  if (r === 0) take(0, 0);
  else {
    for (let i = -r; i <= r; i++) {
      take(i, -r);
      take(i, r);
    }
    for (let i = -r + 1; i < r; i++) {
      take(-r, i);
      take(r, i);
    }
  }
  return total ? taken / total : 1;
}

// Which terrace of the square spiral an LED is on at the current step width,
// and when the growing edge passed that terrace's inner border.
function terrace(P, c, p) {
  const w = P.wAt;
  const ph = P.phase[p] / 256;
  const u = P.dist[p] / w + ph;
  const k = Math.floor(u);
  P.frac[p] = u - k;
  const start = Math.min(0.97, Math.max(0, (k - ph) * w) / c.rmax);
  P.tStart[p] = c.tb - c.tau * Math.log(1 - start);
}

function isFree(P, x, y, m) {
  if (x < 1 || x >= W - 1 || y < 1 || y >= P.melt - 3) return false;
  const o = P.owner;
  for (let j = -m; j <= m; j++)
    for (let i = -m; i <= m; i++) {
      const xx = x + i;
      const yy = y + j;
      if (xx >= 0 && xx < W && yy >= 0 && yy < H && o[yy * W + xx]) return false;
    }
  return true;
}

// A branch starts just past an upper corner of its parent, or over its top.
function branch(P, c) {
  const slot = c.slots.pop();
  const R = c.r + 2 + Math.floor(Math.random() * 3);
  const sx = slot === 0 || slot === 3 ? -1 : slot === 1 || slot === 4 ? 1 : 0;
  const x = Math.round(c.x + sx * R + (sx ? 0 : (Math.random() - 0.5) * 6));
  const y = c.y - (slot > 2 ? Math.floor(R / 3) : R);
  if (isFree(P, x, y, 1)) addCrystal(P, x, y, c, false);
}

function grow(P, h) {
  let grew = false;
  for (const c of P.crystals) {
    if (c.done) continue;
    const target = Math.floor(c.rmax * (1 - Math.exp(-(P.T - c.tb) / c.tau)) + 0.5);
    while (c.r < target && !c.done) {
      // Stop a ring short of any crystal that is not kin, so a dark gap stays.
      const near = claimRing(P, c, c.r + 1, false);
      if (c.big ? near > 0.4 : near > 0.15 || claimRing(P, c, c.r + 2, false) > 0.3) {
        c.done = true;
        break;
      }
      c.r++;
      claimRing(P, c, c.r, true);
      grew = true;
      if (c.r >= c.rmax) c.done = true;
      if (c.slots.length && c.r >= c.nextKid) {
        c.nextKid += 3 + Math.floor(Math.random() * 3);
        branch(P, c);
      }
    }
  }
  // Small crystals start on the faces of old ones wherever there is room.
  const tries = Math.floor(h * 4 + Math.random());
  for (let i = 0; i < tries; i++) {
    const x = 1 + Math.floor(Math.random() * (W - 2));
    const y = 1 + Math.floor(Math.random() * (P.melt - 10));
    if (!isFree(P, x, y, 2)) continue;
    const o = P.owner;
    const p = y * W + x;
    if ((x > 2 && o[p - 3]) || (x < W - 3 && o[p + 3]) || (y > 3 && o[p - 3 * W]) || o[p + 3 * W]) {
      addCrystal(P, x, y, null, true);
      grew = true;
    }
  }
  return grew;
}

function step(P, h) {
  P.T += h;
  P.modeT += h;
  const heat = P.heat;
  if (P.mode === GROW || P.mode === HOLD) {
    const grew = grow(P, h);
    P.quiet = grew ? 0 : P.quiet + h;
    // A cluster that has stopped short of the top sends a new branch up from
    // its highest crystal.
    if (P.mode === GROW && P.quiet > 1.5 && top(P) > 6) {
      let hi = null;
      for (const c of P.crystals) if (c.r >= 2 && (!hi || c.y - c.r < hi.y - hi.r)) hi = c;
      if (hi) {
        hi.slots = [0, 1, 2];
        while (hi.slots.length) branch(P, hi);
      }
      P.quiet = 0;
    }
    if (P.mode === GROW && ((P.quiet > 4 && top(P) <= 6) || P.modeT > 60)) {
      P.mode = HOLD;
      P.modeT = 0;
    }
    if (P.mode === HOLD && P.modeT > 3 + 9 * (1 - heat)) {
      P.mode = MELT;
      P.modeT = 0;
    }
  } else if (P.mode === MELT) {
    // The pool rises and every crystal under its surface goes back into it.
    const from = Math.ceil(P.melt);
    P.melt -= h * (9 + 26 * heat);
    for (let y = Math.max(0, Math.ceil(P.melt)); y < from && y < H; y++) P.owner.fill(0, y * W, y * W + W);
    if (P.melt < -4) {
      P.mode = DRAIN;
      P.modeT = 0;
      P.owner.fill(0);
      P.crystals = [];
    }
  } else {
    P.melt += h * 70;
    if (P.melt >= POOL) restart(P);
  }
}

// The highest row the cluster reaches.
function top(P) {
  let t = H;
  for (const c of P.crystals) t = Math.min(t, c.y - c.r);
  return t;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 3, 0.06];
  dt = clamp(dt, 0, 0.1);
  P.tint = clamp(k[0], 0, 1);
  const rate = clamp(k[1], 0, 3) / 2;
  P.w = clamp(k[2], 3, 8);
  P.heat = clamp(k[3], 0, 1);
  if (!P.started) {
    P.started = true;
    // The pour cooled some time ago: the cluster already stands the height of
    // the panel when it opens, still growing into its gaps.
    for (let i = 0; i < PRE * 30 && top(P) > 20; i++) {
      step(P, 1 / 30);
      P.modeT = Math.min(P.modeT, 20);
    }
    for (let i = 0; i < 90; i++) step(P, rate / 30);
  }
  if (input.btnPressed && input.btnPressed[0] && P.mode < MELT) {
    P.mode = MELT;
    P.modeT = 0;
  }
  P.t += dt;
  step(P, dt * rate);
}

export function draw(display, params) {
  const P = params;
  const buf = P.buf;
  const own = P.owner;
  const cs = P.crystals;
  const lut = P.lut;
  const w = P.w;
  const heat = P.heat;
  const T = P.T;
  const melt = P.melt;
  // Oxide grows faster on hot metal.
  const ox = 0.06 * (0.8 + 0.5 * heat);
  const tint = P.tint * 0.95;
  // The pool's glow: cherry red when cool, yellow when hot.
  const gr = 170 + 85 * heat;
  const gg = 28 + 140 * heat * heat;
  const gb = 12 + 40 * heat * heat * heat;
  const reach = 10 + 22 * heat;
  // A broad band of light that sweeps down the cluster every 26 s and
  // catches the rims as it passes.
  const band = ((T * 7) % 180) - 30;
  if (P.wAt !== w) {
    P.wAt = w;
    for (let p = 0; p < N; p++) if (own[p]) terrace(P, cs[own[p] - 1], p);
  }
  const ageLut = P.ageLut;
  const glint = P.glint;
  for (let y = 0; y < H; y++) {
    const above = melt - y;
    const warm = above > 0 ? Math.exp(-above / reach) * (0.35 + 0.4 * heat) : 0;
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const o = p * 3;
      let r;
      let g;
      let b;
      if (above <= 0) {
        // Molten bismuth seen from a little above: slow ripples under the
        // glow, and the bar of light they throw back.
        const depth = -above;
        const ripple = Math.sin(depth * 1.1 - P.t * 1.6 + 1.3 * Math.sin(x * 0.13 + P.t * 0.5));
        const sheen = Math.max(0, ripple - 0.55) * 2.2 * (0.6 + 0.4 * Math.sin(x * 0.4 - P.t * 0.8 + depth));
        const dim = 0.72 + 0.12 * ripple - 0.2 * Math.min(1, depth / 12);
        const edge = depth < 1 ? 0.6 : 0;
        r = gr * dim + 120 * sheen + 120 * edge;
        g = gg * dim + 120 * sheen + 110 * edge;
        b = gb * dim + 130 * sheen + 100 * edge;
      } else if (own[p]) {
        const c = cs[own[p] - 1];
        const d = P.dist[p];
        const f = P.frac[p];
        const age = T - P.tStart[p];
        const rim = (1 - f) * w <= 1.001;
        let th = ox * c.ox * ageLut[age <= 0 ? 0 : age >= 400 ? 4000 : (age * 10) | 0] + (rim ? 0.07 : 0);
        if (th > 1) th = 1.2 - 0.2 * Math.exp((1 - th) / 0.2);
        th += tint;
        if (th > TH_MAX) th -= 1.05;
        const li = Math.floor((th / TH_MAX) * (LUT - 1)) * 3;
        // Which side of the square this LED is on, for the light.
        const dx = x - c.x;
        const dy = y - c.y;
        const lit = Math.abs(dx) >= Math.abs(dy) ? dx > 0 : dy > 0;
        // Terraces step down into the hollow, so the inner ones sit darker.
        let m = (0.72 + 0.2 * f) * (0.7 + (0.3 * d) / Math.max(4, c.r));
        // The rim of each step: the riser on the far side of the hollow faces
        // the light from the upper left, the near side is in shadow.
        if (rim) m = lit ? 1.05 : 0.36;
        // The crystal's outer walls: lit at the top and left, in shade at the
        // bottom and right, silver where it is still growing; and a dark seam
        // where it meets an older crystal.
        const up = y > 0 ? own[p - W] : 0;
        const left = x > 0 ? own[p - 1] : 0;
        const down = own[p + W];
        const right = x < W - 1 ? own[p + 1] : 0;
        const o0 = own[p];
        if (!up || !left) m = d === c.r && !c.done ? 1.3 : 1.12;
        else if (!down || !right) m = d === c.r && !c.done ? 1.1 : 0.42;
        if ((up && up !== o0) || (left && left !== o0)) m *= 0.3;
        else if ((down && down < o0) || (right && right < o0)) m *= 0.6;
        const go = ((x * 0.5 + y - band) * 4 + 256) | 0;
        const gl = go < 0 || go > 512 ? 0 : glint[go];
        const shine = (m > 0.95 ? 0.4 : 0.06) * gl;
        m *= 1 + 0.45 * gl;
        r = lut[li] * m + 255 * shine + gr * warm;
        g = lut[li + 1] * m + 255 * shine + gg * warm;
        b = lut[li + 2] * m + 255 * shine + gb * warm;
      } else {
        r = 5 + gr * warm * 0.35;
        g = 6 + gg * warm * 0.35;
        b = 10 + gb * warm * 0.35;
      }
      // Crystals just above a rising pool glow red hot.
      if (P.mode === MELT && above > 0 && above < 7) {
        const hot = 1 - above / 7;
        r += 200 * hot;
        g += 50 * hot;
      }
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
    }
  }
  for (let p = 0; p < N; p++) {
    const o = p * 3;
    display.setPixel(p % W, (p / W) | 0, Math.min(255, buf[o]), Math.min(255, buf[o + 1]), Math.min(255, buf[o + 2]));
  }
}
