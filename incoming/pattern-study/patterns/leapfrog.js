// ===== Patternflow pattern =====
// Title:   Leapfrog
// Family:  fountain
// Idea:    A leapfrog fountain seen from the side on a dark ground: glass-smooth rods of water, each cut to a length and lit from inside in its own colour, leap in arcs across the panel from a pad on one wall to a pad on the other, and the pad that catches a rod fires the next one on to a different pad, so each chase runs up and down the panel and never takes the same route twice.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: laminar leaping-jet fountains (leapfrog fountains)
// Round:   200
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tempo=0..3, Length=-1..1, Jets=0..1
//
// Knob 1: Hue. The colour of the first chase, from cyan-blue where the knob opens round the wheel. The other chases keep their distance from it, two sevenths of the wheel each, so three are cyan, magenta and amber and seven are seven colours evenly apart.
// Knob 2: Tempo. How fast time runs for the water: frozen in the air at the bottom of the knob, real time where it opens, and half as fast again at the top.
// Knob 3: Length. How long each rod is, as the time a pad lets water out: 0.08 seconds at the bottom, a slug with a trail of mist; 0.45 seconds where the knob opens, a rod about a third of an arc long; and 1.6 seconds at the top, longer than most flights, so the pad is still pouring when the head lands and whole arcs stand between the walls. Rods already in the air keep their length.
// Knob 4: Jets. How many chases run at once, from two at the bottom through three where the knob opens to seven at the top. A chase that is turned off ends when its rod lands, and a new one starts from the quietest pad, one about every half second.

const W = 64;
const H = 128;
// Gravity, in LEDs a second squared, down the panel.
const G = 100;
// The pads: four on the left wall and four on the right, staggered in height so the arcs zigzag.
const PADS = [
  [4.5, 122.5],
  [4.5, 94.5],
  [4.5, 66.5],
  [4.5, 38.5],
  [59.5, 108.5],
  [59.5, 80.5],
  [59.5, 52.5],
  [59.5, 26.5],
];
// Most chases at once, and how far round the wheel each is from the one before.
const MOST = 7;
const TURN = 2 / 7;
// How long a pad holds the head of a rod before it fires the next one, how long the mist behind a rod's tail lasts
// and how long a pad blooms when it catches, all in seconds of the water's own time.
const WAIT = 0.12;
const MIST = 0.9;
const BLOOM = 0.3;
// How far from its axis a rod still lights the air, in LEDs, and the longest piece of arc drawn as a straight line.
const REACH = 5.5;
const PIECE = 1.25;
// Scratch for choosing among the four pads of a wall.
const WEIGHT = [0, 0, 0, 0];
const COUNT = [0, 0, 0, 0];

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function setup(params) {
  params.started = false;
  params.hops = [];
  params.chases = Array.from({ length: MOST }, () => ({ on: false, ending: false, count: 0, heading: 0 }));
  params.gap = 0;
  params.pads = PADS.map(() => ({ t: 9, hue: 0, glow: 0, flash: 0, lit: 0 }));
  params.hue = 0;
  params.buf = new Float32Array(W * H * 3);
  params.near = new Float32Array(W * H).fill(1e9);
  params.age = new Float32Array(W * H);
  params.col = new Float32Array(3);
}

// How many rods are on their way to a pad or still pouring out of it. One flying between this pad and `other`, either
// way, counts forty times over, so two rods do not share a route.
function busy(params, pad, other) {
  let n = 0;
  for (const h of params.hops) {
    if (h.t >= h.T + h.d) continue;
    if ((h.to === pad && h.from === other) || (h.from === pad && h.to === other)) n += 40;
    else if (h.to === pad || (h.from === pad && h.t < h.d)) n++;
  }
  return n;
}

// Pad `from` fires a rod for chase `c` to a pad on the other wall: the quietest one, and among equals mostly one near
// its own height, now and then a far one. A chase keeps heading up or down the panel for a while, and it does not go
// straight back to the pad the rod came from unless every other pad is taken.
function fire(params, c, from, back, len) {
  const chase = params.chases[c];
  const first = from < 4 ? 4 : 0;
  let least = 1e9;
  for (let i = 0; i < 4; i++) {
    COUNT[i] = busy(params, first + i, from) + (first + i === back ? 3 : 0);
    if (COUNT[i] < least) least = COUNT[i];
  }
  let total = 0;
  for (let i = 0; i < 4; i++) {
    const rise = PADS[from][1] - PADS[first + i][1];
    const far = Math.abs(rise) / 34;
    let w = COUNT[i] > least ? 0 : 1 / (1 + far * far);
    if (rise * chase.heading < 0) w *= 0.4;
    WEIGHT[i] = w;
    total += w;
  }
  let pick = 0;
  for (let r = Math.random() * total; pick < 3 && r >= WEIGHT[pick]; pick++) r -= WEIGHT[pick];
  pick += first;
  chase.heading = PADS[from][1] > PADS[pick][1] ? 1 : -1;
  const a = PADS[from];
  const b = PADS[pick];
  // The top of the arc is 8 to 20 LEDs above the higher pad and stays on the panel.
  const top = Math.max(3.5, Math.min(a[1], b[1]) - 8 - 12 * Math.random());
  const up = Math.sqrt(2 * G * (a[1] - top));
  const T = up / G + Math.sqrt((2 * (b[1] - top)) / G);
  chase.count++;
  // The hue steps a little with every hop and never settles into a round.
  const hue = c * TURN + 0.045 * Math.sin(chase.count * 1.13 + c * 2.1);
  params.pads[from].t = 0;
  params.pads[from].hue = hue;
  params.hops.push({
    c,
    from,
    to: pick,
    x: a[0],
    y: a[1],
    vx: (b[0] - a[0]) / T,
    up,
    T,
    d: len,
    t: 0,
    fired: false,
    landed: false,
    hue,
  });
}

function step(params, dt, want, len) {
  const { chases, hops } = params;
  for (const p of params.pads) p.t += dt;
  // Chases are added one at a time and taken away as their rods land.
  let on = 0;
  for (const c of chases) if (c.on && !c.ending) on++;
  params.gap -= dt;
  if (on < want && params.gap <= 0) {
    let c = chases.findIndex((q) => q.on && q.ending);
    if (c >= 0) chases[c].ending = false;
    else {
      c = chases.findIndex((q) => !q.on);
      let best = 1e9;
      let pick = 0;
      let ties = 0;
      for (let i = 0; i < PADS.length; i++) {
        const n = busy(params, i, -1);
        if (n < best) {
          best = n;
          pick = i;
          ties = 1;
        } else if (n === best && Math.random() * ++ties < 1) pick = i;
      }
      chases[c].on = true;
      chases[c].ending = false;
      chases[c].heading = pick % 4 < 2 ? 1 : -1;
      fire(params, c, pick, -1, len);
    }
    // The next one waits a little over half a second, so they do not all leave together.
    params.gap = 0.53;
  } else if (on > want) {
    for (let c = MOST - 1; c >= 0; c--)
      if (chases[c].on && !chases[c].ending) {
        chases[c].ending = true;
        break;
      }
  }
  for (let i = hops.length - 1; i >= 0; i--) {
    const h = hops[i];
    h.t += dt;
    if (!h.landed && h.t >= h.T) {
      h.landed = true;
      params.pads[h.to].t = 0;
      params.pads[h.to].hue = h.hue;
    }
    if (!h.fired && h.t >= h.T + WAIT) {
      h.fired = true;
      if (chases[h.c].ending) {
        chases[h.c].on = false;
        chases[h.c].ending = false;
      } else fire(params, h.c, h.to, h.from, len);
    }
    if (h.t > h.T + h.d + MIST && h.fired) hops.splice(i, 1);
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const tempo = clamp(k[1], 0, 3) / 2;
  const u = clamp(k[2], -1, 1);
  // A rod is the water a pad lets out in this many seconds: 0.08 at the bottom of the knob, 0.45 where it opens and
  // 1.6 at the top.
  const len = 0.45 * Math.pow(u < 0 ? 5.6 : 3.6, u);
  const j = clamp(k[3], 0, 1);
  const want = j < 0.03 ? 2 : 3 + Math.min(4, Math.floor(((j - 0.03) / 0.97) * 5));
  params.hue = k[0] + 0.52;
  // The fountain has been running for a few seconds when the panel opens.
  if (!params.started) {
    params.started = true;
    for (let i = 0; i < 150; i++) step(params, 1 / 30, want, len);
  }
  step(params, Math.min(dt, 0.1) * tempo, want, len);
}

// A soft round glow.
function bloom(buf, cx, cy, size, r, g, b) {
  const reach = size * 2.2;
  const x0 = Math.max(0, Math.floor(cx - reach));
  const x1 = Math.min(W - 1, Math.ceil(cx + reach));
  const y0 = Math.max(0, Math.floor(cy - reach));
  const y1 = Math.min(H - 1, Math.ceil(cy + reach));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const w = Math.exp(-(dx * dx + dy * dy) / (size * size));
      const j = (y * W + x) * 3;
      buf[j] += r * w;
      buf[j + 1] += g * w;
      buf[j + 2] += b * w;
    }
}

// One hop: the rod between its tail and its head, and the mist where the tail has just been.
function rod(params, h, col) {
  const { buf, near, age } = params;
  const head = Math.min(h.T, h.t);
  const tail = h.t - h.d;
  const lo = Math.max(0, tail - MIST);
  if (lo >= head) return;
  let bx0 = W;
  let bx1 = -1;
  let by0 = H;
  let by1 = -1;
  // Walk the arc in short straight pieces and keep, for each LED near it, how far off the arc is and how old the water
  // is at the nearest point of it.
  let a = lo;
  let ax = h.x + h.vx * a;
  let ay = h.y - h.up * a + 0.5 * G * a * a;
  while (a < head) {
    const vy = G * a - h.up;
    const b = Math.min(head, a + PIECE / Math.sqrt(h.vx * h.vx + vy * vy));
    const qx = h.x + h.vx * b;
    const qy = h.y - h.up * b + 0.5 * G * b * b;
    const ex = qx - ax;
    const ey = qy - ay;
    const ee = ex * ex + ey * ey || 1e-9;
    const x0 = Math.max(0, Math.floor(Math.min(ax, qx) - REACH));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(ax, qx) + REACH));
    const y0 = Math.max(0, Math.floor(Math.min(ay, qy) - REACH));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(ay, qy) + REACH));
    if (x0 < bx0) bx0 = x0;
    if (x1 > bx1) bx1 = x1;
    if (y0 < by0) by0 = y0;
    if (y1 > by1) by1 = y1;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - ax;
        const py = y + 0.5 - ay;
        const s = clamp((px * ex + py * ey) / ee, 0, 1);
        const dx = px - ex * s;
        const dy = py - ey * s;
        const dd = dx * dx + dy * dy;
        const i = y * W + x;
        if (dd < near[i]) {
          near[i] = dd;
          age[i] = a + (b - a) * s;
        }
      }
    a = b;
    ax = qx;
    ay = qy;
  }
  const r = col[0];
  const g = col[1];
  const b = col[2];
  for (let y = by0; y <= by1; y++)
    for (let x = bx0; x <= bx1; x++) {
      const i = y * W + x;
      const dd = near[i];
      if (dd > 1e8) continue;
      near[i] = 1e9;
      if (dd >= REACH * REACH) continue;
      const q = Math.sqrt(dd);
      const w = age[i];
      const vy = G * w - h.up;
      const speed = Math.sqrt(h.vx * h.vx + vy * vy);
      // Water between the tail and the head, cut clean at the tail.
      const water = clamp((w - tail) * speed + 0.5, 0, 1);
      let colour = 0;
      let white = 0;
      let hide = 0;
      if (water > 0) {
        // The head is a little brighter than the rest of the rod.
        const lead = clamp(1 - ((head - w) * speed) / 8, 0, 1);
        const body = clamp(2 - q, 0, 1);
        const halo = Math.exp(-Math.max(0, q - 1.5) / 1.5) * clamp(REACH - q, 0, 1);
        colour = water * Math.max((0.92 + 0.08 * lead) * body, (0.62 + 0.12 * lead) * halo);
        white = water * (0.6 + 0.3 * lead) * clamp(1.05 - q, 0, 1);
        // A rod hides the one it passes in front of, and a little to either side, so two that cross stay two colours.
        hide = 0.92 * water * clamp(3.3 - q, 0, 1);
      }
      if (water < 1) {
        // Mist hangs where the tail has passed and thins out.
        const left = clamp(1 - (tail - w) / MIST, 0, 1);
        const soft = clamp(1 - q / 3.8, 0, 1);
        colour += (1 - water) * 0.7 * left * soft * soft;
      }
      const j = i * 3;
      buf[j] = buf[j] * (1 - hide) + r * colour + white;
      buf[j + 1] = buf[j + 1] * (1 - hide) + g * colour + white;
      buf[j + 2] = buf[j + 2] * (1 - hide) + b * colour + white;
    }
}

export function draw(display, params) {
  const { buf, col, hops, pads } = params;
  buf.fill(0);
  // The pads: small marks on the two walls, a dim steel blue until a rod touches them and then its colour for a while.
  for (let n = 0; n < PADS.length; n++) {
    const p = PADS[n];
    const warm = Math.exp(-pads[n].t / 0.8);
    hsv(params.hue + pads[n].hue, 0.9, 0.8 * warm, col);
    col[0] += 0.24 * (1 - warm);
    col[1] += 0.29 * (1 - warm);
    col[2] += 0.36 * (1 - warm);
    for (let y = -1; y <= 1; y++)
      for (let x = -2; x <= 2; x++) {
        // Five LEDs by three, with the corners taken off.
        const cover = Math.abs(x) === 2 && y !== 0 ? 0.5 : 1;
        const j = ((Math.floor(p[1]) + y) * W + Math.floor(p[0]) + x) * 3;
        buf[j] += col[0] * cover;
        buf[j + 1] += col[1] * cover;
        buf[j + 2] += col[2] * cover;
      }
    pads[n].glow = 0;
    pads[n].flash = 0;
  }
  // Each chase flies in its own plane, the first one nearest.
  for (let c = MOST - 1; c >= 0; c--)
    for (const h of hops) {
      if (h.c !== c) continue;
      hsv(params.hue + h.hue, 1, 1, col);
      rod(params, h, col);
      // A pad glows while water leaves it, and blooms when it catches a rod.
      const out = 0.4 * Math.sqrt(clamp(1 - h.t / Math.max(h.d, BLOOM), 0, 1));
      const a = pads[h.from];
      if (out > a.glow) {
        a.glow = out;
        a.lit = h.hue;
      }
      const since = h.t - h.T;
      if (since < 0) continue;
      const flash = clamp(1 - since / BLOOM, 0, 1);
      const held = Math.max(flash * flash, 0.3 * clamp(1 - (since - h.d) / 0.15, 0, 1));
      const b = pads[h.to];
      if (flash > b.flash) b.flash = flash;
      if (held > b.glow) {
        b.glow = held;
        b.lit = h.hue;
      }
    }
  for (let n = 0; n < PADS.length; n++) {
    const p = pads[n];
    if (p.glow <= 0) continue;
    hsv(params.hue + p.lit, 1, 1, col);
    const pale = 0.15 * p.glow + 0.3 * p.flash * p.flash;
    bloom(buf, PADS[n][0], PADS[n][1], 2.4 + 1.9 * p.flash, col[0] * p.glow + pale, col[1] * p.glow + pale, col[2] * p.glow + pale);
  }
  for (let y = 0, j = 0; y < H; y++)
    for (let x = 0; x < W; x++, j += 3) display.setPixel(x, y, clamp(buf[j] * 255, 0, 255), clamp(buf[j + 1] * 255, 0, 255), clamp(buf[j + 2] * 255, 0, 255));
}
