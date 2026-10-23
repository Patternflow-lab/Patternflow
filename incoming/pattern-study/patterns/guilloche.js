// ===== Patternflow pattern =====
// Title:   Guilloché
// Family:  line
// Idea:    An engine-turned silver plate stands the height of the panel, an oval of rose-engine bands inside straight-line corners, and as a lamp circles it each groove flashes or goes dark by the way it was cut.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: guilloché, the rose engine and the straight-line engine, as on Breguet dials and banknotes
// Round:   16
// ===============================
// @matrix 64x128
// @knobs Metal=0..1, Light=0..4, Lobes=12..36, Phasing=0..0.5
//
// Knob 1: Metal. Silver at 0, then champagne, yellow gold and rose gold at the far end.
// Knob 2: Light. How fast the lamp travels round the plate: once in ten seconds at 2, in five at 4; at 0 it stands still and only the rosettes drift.
// Knob 3: Lobes. Bosses on the rosette cam, 12 to 36: the waves, the barleycorn grains, the basketweave cells and the corner waves all grow finer.
// Knob 4: Phasing. How far the rosette is turned between one cut and the next, in lobes: 0 nests the waves, a little twists them into flames, 0.5 trades waves for barleycorn.
// Buttons: K1 tap re-cuts the plate with the next set of patterns, the cutter working in from the corners to the centre.

const W = 64;
const H = 128;
const N = W * H;
const CX = 31.5;
const CY = 63.5;
const TAU = Math.PI * 2;
// The oval chuck. The cutter at radius R traces an ellipse with semi-axes
// R - E across and R + E up, so the axes always differ by 2E: cuts made at an
// even pitch stay evenly spaced all the way round, which scaled ellipses
// would not. At R = 48 the oval is 64 by 128 and meets the panel's sides; at
// R = E it closes to a slot 64 LEDs tall down the middle.
const E = 16;
const RIM = 48;
// One cut every two LEDs: a groove and a gap.
const PITCH = 2;
// How much of an LED's width blurs a groove's edge. A whole LED gave every
// slanting groove a soft grey edge and the bands went to mud; at 0.15 the
// grooves stay crisp, and one that runs between two LEDs still lights both.
const SHARP = 0.15;

const TS = 2048;
const SIN = new Float32Array(TS);
for (let i = 0; i < TS; i++) SIN[i] = Math.sin((i / TS) * TAU);
function sinT(u) {
  return SIN[((u - Math.floor(u)) * TS) & (TS - 1)];
}
function cosT(u) {
  return sinT(u + 0.25);
}

// What lies under an LED.
const POLISH = 0;
const CUT = 1;
const BOSS = 2;

// The patterns a band can carry.
const FLAT = 0; // a polished ring between bands
const WAVE = 1; // vagues: cuts rocked by the rosette, each turned on by the phasing
const BARLEY = 2; // grain d'orge: every other cut turned half a lobe, so neighbours cross
const RAYS = 3; // a sunburst of straight cuts out from the centre
const BASKET = 4; // panier: round and radial cuts taking turns in cells
const CLOUS = 5; // clous de Paris: a field of little pyramids

// The plates K1 steps through. Zones from the centre out, each a pattern
// and the radius it runs to; the corners outside the oval are the
// straight-line engine's: how far the rosette rocks its cuts, how many waves
// it puts in 512 / lobes LEDs, and the turn between one cut and the next.
const PLATES = [
  {
    zones: [CLOUS, 21.5, FLAT, 22.5, BARLEY, 34.5, FLAT, 35.5, WAVE, 47.5, FLAT, 49],
    corner: { amp: 1.8, waves: 2, step: 0.1 },
  },
  {
    zones: [RAYS, 21.5, FLAT, 22.5, BASKET, 34.5, FLAT, 35.5, BARLEY, 47.5, FLAT, 49],
    corner: { amp: 1.6, waves: 2, step: 0.5 },
  },
  {
    zones: [BASKET, 21.5, FLAT, 22.5, WAVE, 34.5, FLAT, 35.5, RAYS, 47.5, FLAT, 49],
    corner: { amp: 2.5, waves: 2, step: 0.25 },
  },
];

function chuckR(X, Y) {
  const ax = Math.abs(X);
  const ay = Math.abs(Y);
  let lo = E + ax;
  let hi = E + ax + ay + 1;
  for (let i = 0; i < 30; i++) {
    const m = 0.5 * (lo + hi);
    const a = m - E;
    const b = m + E;
    if ((ax * ax) / (a * a) + (ay * ay) / (b * b) > 1) lo = m;
    else hi = m;
  }
  return 0.5 * (lo + hi);
}

// The angle round the oval in turns, stretched so a lobe of the cam is about
// as long at the sides as at the ends.
function chuckT(X, Y, R) {
  const a = R - E;
  const b = R + E;
  const t = Math.atan2(Y / b, X / a);
  const k = (b * b - a * a) / (b * b + a * a);
  return (t + 0.25 * k * Math.sin(2 * t)) / TAU;
}

function wrapTurn(d) {
  return d - Math.round(d);
}

export function setup(params) {
  const P = params;
  P.R = new Float32Array(N);
  P.T = new Float32Array(N);
  P.rx = new Float32Array(N);
  P.ry = new Float32Array(N);
  P.tx = new Float32Array(N);
  P.ty = new Float32Array(N);
  const h = 0.01;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const X = x - CX;
      const Y = y - CY;
      const R = chuckR(X, Y);
      P.R[p] = R;
      P.T[p] = chuckT(X, Y, R);
      const Rxp = chuckR(X + h, Y);
      const Rxm = chuckR(X - h, Y);
      const Ryp = chuckR(X, Y + h);
      const Rym = chuckR(X, Y - h);
      P.rx[p] = (Rxp - Rxm) / (2 * h);
      P.ry[p] = (Ryp - Rym) / (2 * h);
      P.tx[p] = wrapTurn(chuckT(X + h, Y, Rxp) - chuckT(X - h, Y, Rxm)) / (2 * h);
      P.ty[p] = wrapTurn(chuckT(X, Y + h, Ryp) - chuckT(X, Y - h, Rym)) / (2 * h);
    }
  }
  P.plate = 0;
  P.old = 0;
  P.front = -1;
  P.metal = 0;
  P.speed = 2;
  P.lobes = 12;
  P.phasing = 0.06;
  P.lampA = 2.2;
  P.drift = 0;
  P.t = 0;
  P.frame = 0;
  // The surface under each LED, worked out a third of the rows a frame: the
  // rosettes drift about a LED a second, so a row is never more than a
  // fourteenth of a LED behind.
  P.kind = new Uint8Array(N);
  P.gx = new Float32Array(N);
  P.gy = new Float32Array(N);
  P.cov = new Float32Array(N);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 12, 0.06];
  dt = Math.min(dt, 0.1);
  P.metal = Math.max(0, Math.min(1, k[0]));
  P.speed = Math.max(0, Math.min(4, k[1]));
  P.lobes = Math.round(Math.max(12, Math.min(36, k[2])));
  P.phasing = Math.max(0, Math.min(0.5, k[3]));
  P.t += dt;
  P.lampA += dt * 0.32 * P.speed;
  P.drift += dt * 0.05;
  if (input.btnPressed && input.btnPressed[0] && P.front < 0) {
    P.old = P.plate;
    P.plate = (P.plate + 1) % PLATES.length;
    P.front = 78;
  }
  if (P.front >= 0) {
    P.front -= dt * 20;
    if (P.front < 14) P.front = -1;
  }
}

// The surface under one LED: its kind, the direction across the groove
// there (GX, GY, a unit vector in the plate), and how much of the LED the
// groove covers (COV).
let KIND = POLISH;
let GX = 0;
let GY = 0;
let COV = 0;

function polish() {
  KIND = POLISH;
  GX = 0;
  GY = 0;
  COV = 0;
}

// The share of an LED's footprint [d - hw, d + hw] that a groove one LED
// wide centred at c covers.
function overlap(d, hw, c) {
  const lo = Math.max(d - hw, c - 0.5);
  const hi = Math.min(d + hw, c + 0.5);
  return hi > lo ? (hi - lo) / (2 * hw) : 0;
}

// d is the LED's distance from the nearest cut's centre line, along the
// direction (gx, gy) / g across it.
function cut(d, gx, gy, g, pitch) {
  KIND = CUT;
  GX = gx / g;
  GY = gy / g;
  const hw = SHARP * (Math.abs(GX) + Math.abs(GY));
  COV = Math.min(1, overlap(d, hw, 0) + overlap(d, hw, d > 0 ? pitch : -pitch));
}

// Rose-engine cuts round the oval: cut k sits at r0 + PITCH (k + 1/2) and the
// cam rocks it in and out by amp, n lobes a turn, turned on by step lobes
// for each cut and by rot for the whole band.
function rose(P, p, r0, r1, n, amp, step, rot) {
  const R = P.R[p];
  const T = P.T[p];
  const cuts = Math.max(1, Math.floor((r1 - r0) / PITCH));
  const kc = (R - r0) / PITCH - 0.5;
  const reach = amp / PITCH + 1;
  const k0 = Math.max(0, Math.floor(kc - reach));
  const k1 = Math.min(cuts - 1, Math.ceil(kc + reach));
  const rx = P.rx[p];
  const ry = P.ry[p];
  const tx = P.tx[p] * TAU * n * amp;
  const ty = P.ty[p] * TAU * n * amp;
  let best = 1e9;
  let bx = 0;
  let by = 0;
  let bg = 1;
  let bd = 0;
  // The nearest cut, compared by squared distance d^2 / |grad|^2.
  for (let c = k0; c <= k1; c++) {
    const u = n * T + step * c + rot;
    const d = R - (r0 + PITCH * (c + 0.5)) - amp * sinT(u);
    const w = cosT(u);
    const gx = rx - w * tx;
    const gy = ry - w * ty;
    const g2 = gx * gx + gy * gy + 1e-9;
    const q = (d * d) / g2;
    if (q < best) {
      best = q;
      bx = gx;
      by = gy;
      bg = g2;
      bd = d;
    }
  }
  const g = Math.sqrt(bg);
  cut(bd / g, bx, by, g, PITCH);
}

// Sunburst: straight cuts out from the centre, count of them set so they
// are a pitch apart at the band's middle, twisted by the phasing.
function rays(P, p, r0, r1, phasing) {
  const R = P.R[p];
  const mid = 0.5 * (r0 + r1);
  const around = Math.PI * (3 * 2 * mid - Math.sqrt((3 * (mid - E) + mid + E) * (mid - E + 3 * (mid + E))));
  const m = Math.round(around / PITCH);
  const tw = phasing * 0.6;
  const q = m * P.T[p] + tw * (R - r0);
  const gx = m * P.tx[p] + tw * P.rx[p];
  const gy = m * P.ty[p] + tw * P.ry[p];
  const g = Math.sqrt(gx * gx + gy * gy) + 1e-6;
  cut((q - Math.round(q)) / g, gx, gy, g, PITCH);
}

// Basketweave: cells two cuts deep, round cuts and radial cuts taking turns
// like the over and under of a weave.
function basket(P, p, r0, r1, lobes) {
  const R = P.R[p];
  const T = P.T[p];
  const cellR = 2 * PITCH;
  const i = Math.floor((R - r0) / cellR);
  const cells = lobes * 2;
  const j = Math.floor((T + 1) * cells);
  if ((i + j) & 1) {
    const m = (cells * 2.5) | 0;
    const q = m * T;
    const gx = m * P.tx[p];
    const gy = m * P.ty[p];
    const g = Math.sqrt(gx * gx + gy * gy) + 1e-6;
    cut((q - Math.round(q)) / g, gx, gy, g, PITCH);
  } else {
    const q = (R - r0) / PITCH - 0.5;
    const g = Math.sqrt(P.rx[p] * P.rx[p] + P.ry[p] * P.ry[p]) + 1e-6;
    cut(((q - Math.round(q)) * PITCH) / g, P.rx[p], P.ry[p], g, PITCH);
  }
}

// Clous de Paris: two sets of straight cuts crossing at right angles, set
// diagonal on the plate, leave a field of little square pyramids. Each face
// of a pyramid leans towards the cut beside it.
function clous(x, y, size) {
  const X = x - CX;
  const Y = y - CY;
  const q1 = (X + Y) / (size * Math.SQRT2);
  const q2 = (X - Y) / (size * Math.SQRT2);
  const d1 = (q1 - Math.round(q1)) * size;
  const d2 = (q2 - Math.round(q2)) * size;
  const one = Math.abs(d1) < Math.abs(d2);
  const d = one ? d1 : d2;
  cut(d, 1, one ? 1 : -1, Math.SQRT2, size);
  KIND = BOSS;
  // The face leans down towards the cut it slopes into.
  if (d > 0) {
    GX = -GX;
    GY = -GY;
  }
}

// The straight-line engine fills the corners: the work slides past the
// cutter instead of turning, so the cuts run straight across the plate,
// rocked up and down by the same rosette.
function straight(x, y, c, lobes, phasing, rot) {
  const X = x - CX;
  const Y = y - CY;
  const f = (c.waves * lobes) / 512;
  const slope = c.amp * TAU * f;
  const kc = Math.round(Y / PITCH);
  const reach = Math.ceil(c.amp / PITCH) + 1;
  let best = 1e9;
  let bd = 0;
  let bx = 0;
  let bg = 1;
  for (let k = kc - reach; k <= kc + reach; k++) {
    const u = f * X + (c.step + phasing) * k + rot;
    const d = Y - PITCH * k - c.amp * sinT(u);
    const gx = -slope * cosT(u);
    const g2 = gx * gx + 1;
    const q = (d * d) / g2;
    if (q < best) {
      best = q;
      bd = d;
      bx = gx;
      bg = g2;
    }
  }
  const g = Math.sqrt(bg);
  cut(bd / g, bx, 1, g, PITCH);
}

function surface(P, p, x, y, plate) {
  const R = P.R[p];
  if (R > RIM + 1) return straight(x, y, plate.corner, P.lobes, P.phasing, P.drift);
  const zones = plate.zones;
  let r0 = 0;
  for (let i = 0; i < zones.length; i += 2) {
    const r1 = zones[i + 1];
    if (R < r1 || i === zones.length - 2) {
      const kind = zones[i];
      // Neighbouring bands drift opposite ways.
      const rot = i & 4 ? -P.drift : P.drift;
      if (kind === WAVE) return rose(P, p, r0, r1, P.lobes, 3, P.phasing, rot);
      if (kind === BARLEY) return rose(P, p, r0, r1, P.lobes, 2.2, 0.5 + P.phasing, rot);
      if (kind === RAYS) return rays(P, p, r0, r1, P.phasing);
      if (kind === BASKET) return basket(P, p, r0, r1, P.lobes);
      if (kind === CLOUS) return clous(x, y, 4);
      return polish();
    }
    r0 = r1;
  }
}

const METALS = [
  [0.97, 0.98, 1.0],
  [1.0, 0.93, 0.78],
  [1.0, 0.8, 0.42],
  [1.0, 0.68, 0.56],
];

// The land between grooves, a groove in shadow, and how much more a groove
// gives back when it faces the lamp.
const LAND = 0.64;
const GROOVE = 0.12;
const GLINT = 1.3;

// The cutter's point, white hot where it bites, as it runs round the front.
function drawCutter(display, P) {
  const f = P.front;
  if (f < E + 1) return;
  const a = P.t * TAU * 2;
  const cx = CX + (f - E) * Math.cos(a);
  const cy = CY + (f + E) * Math.sin(a);
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const x = Math.round(cx) + i;
      const y = Math.round(cy) + j;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const v = i === 0 && j === 0 ? 255 : 200;
      display.setPixel(x, y, v, v, i === 0 && j === 0 ? 240 : 150);
    }
  }
}

export function draw(display, params, time) {
  const P = params;
  const mu = P.metal * (METALS.length - 1);
  const mi = Math.min(METALS.length - 2, Math.floor(mu));
  const mf = mu - mi;
  const mr = METALS[mi][0] + (METALS[mi + 1][0] - METALS[mi][0]) * mf;
  const mg = METALS[mi][1] + (METALS[mi + 1][1] - METALS[mi][1]) * mf;
  const mb = METALS[mi][2] + (METALS[mi + 1][2] - METALS[mi][2]) * mf;
  // The lamp circles the plate on a tall ellipse, 46 LEDs out from the
  // middle at the sides and 72 at the ends, just off the panel.
  const LX = CX + 46 * Math.cos(P.lampA);
  const LY = CY + 72 * Math.sin(P.lampA);
  const cur = PLATES[P.plate];
  const old = PLATES[P.old];
  const front = P.front;
  const all = P.frame === 0;
  const third = P.frame % 3;
  P.frame++;
  for (let y = all ? 0 : third; y < H; y += all ? 1 : 3) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      surface(P, p, x, y, front >= 0 && P.R[p] < front ? old : cur);
      P.kind[p] = KIND;
      P.gx[p] = GX;
      P.gy[p] = GY;
      P.cov[p] = COV;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const dx = LX - x;
      const dy = LY - y;
      const dd = dx * dx + dy * dy;
      const id = 1 / Math.sqrt(dd + 1);
      const fall = 1 / (1 + dd * 0.00016);
      const kind = P.kind[p];
      const cov = P.cov[p];
      // Two lights: the cool room, and the warm lamp.
      let room;
      let lamp;
      if (kind === CUT) {
        // A groove throws the lamp back when it runs across the lamp's
        // direction: the streak every engine-turned dial has, running from
        // the lamp over the cuts that face it.
        let a = (P.gx[p] * dx + P.gy[p] * dy) * id;
        a *= a;
        const g8 = a * a * a * a;
        // The window above lights the land between grooves that run across
        // the plate a little more than the land between grooves that run up it.
        const gy = P.gy[p];
        room = LAND * (0.86 + 0.28 * gy * gy) * (1 - cov) + GROOVE * cov;
        lamp = fall * (0.5 * a * (1 - cov) + GLINT * g8 * cov);
      } else if (kind === BOSS) {
        const a = (P.gx[p] * dx + P.gy[p] * dy) * id;
        const lit = a > 0 ? a * a : 0;
        room = (0.55 - 0.2 * P.gy[p]) * (1 - cov) + GROOVE * cov;
        lamp = fall * 0.8 * lit * (1 - cov);
      } else {
        // Polished: bright where it shows the window, brighter by the lamp.
        room = 0.8;
        lamp = 0.5 / (1 + dd * 0.0005);
      }
      let r = (room * 0.83 + lamp) * mr;
      let g = (room * 0.91 + lamp * 0.85) * mg;
      let b = (room * 1.0 + lamp * 0.6) * mb;
      if (front >= 0) {
        // Just behind the cutter the metal is fresh and bright, and it dulls
        // over the next four LEDs.
        const e = P.R[p] - front;
        if (e > -0.6 && e < 4) {
          const glow = e < 0.6 ? 0.9 : 0.45 * (1 - (e - 0.6) / 3.4);
          r += glow;
          g += glow * 0.94;
          b += glow * 0.82;
        }
      }
      display.setPixel(x, y, Math.min(255, r * 255), Math.min(255, g * 255), Math.min(255, b * 255));
    }
  }
  if (front >= 0) drawCutter(display, P);
}
