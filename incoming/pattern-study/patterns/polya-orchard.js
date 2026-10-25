// ===== Patternflow pattern =====
// Title:   Pólya's Orchard
// Family:  space
// Idea:    Seen from above, a lantern at the centre of a round orchard of trunks on the integer lattice throws a shadow wedge behind every trunk, and as the trunks slowly thicken towards Pólya's threshold 1/R the lines of sight that escape between them narrow into thin rays and go out one by one, the last eight towards the lattice points just outside the orchard, until no ray leaves, then the trunks thin and the starburst comes back.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Pólya's orchard problem (George Pólya, 1918), pattern round 45
// Round:   45
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Trunk=0.45..0.95, Walk=0..1
//
// Knob 1: Hue. Turns the lantern light round the colour wheel: aqua at 0, blue at 0.15, violet at 0.3, pink at 0.45, orange at 0.6, yellow at 0.67 and green at 0.83; the escaping rays are a paler tint of it, and the lit faces of the trunks sit about a third of the wheel away (pink when the light is aqua).
// Knob 2: Speed. How fast the trunks breathe: at 2 one breath, thin to thick and back, takes 8 seconds; at 0.2 it takes 80 seconds and at 3 it takes 5.3.
// Knob 3: Trunk. The thinnest the trunks get, as a multiple of the threshold radius 1/R; the thickest is always 1.03, just past it. At 0.45 all 32 rays open and then go out in four groups of eight, at 0.69, 0.74, 0.80 and 0.97; at 0.95 only the last eight ever open, as hairlines.
// Knob 4: Walk. The observer walks a small loop off the lattice point, which breaks the eightfold symmetry so the rays of one group go out one at a time, and sweeps the gaps round. At 0 the observer stands still on the point; at 0.06 the loop is 0.015 of a tree spacing across; at 1 it is a quarter of a spacing and some rays escape past the threshold.

const W = 64, H = 128;
const { floor, min, max, abs, round, sqrt, sin, cos, atan2, asin, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const q = (v, n) => round(v * n) / n;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), qq = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? qq : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? qq : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? qq : p];
}

// The orchard: every lattice point within radius R of the origin but the
// origin itself. R = 4 gives 48 trees and 32 directions in which a thin
// enough line of sight escapes (between Farey neighbours of the visible
// points). The lattice spacing in LEDs puts the circle 30 LEDs across each
// way from the centre, so the orchard fills the panel width and the rows
// above and below it show only the light that gets out.
const R = 4, SP = 7.5, CX = 31.5, CY = 63.5;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const TREES = [];
for (let j = -R; j <= R; j++)
  for (let i = -R; i <= R; i++)
    if ((i || j) && i * i + j * j <= R * R) TREES.push({ i, j, x: CX + SP * i, y: CY + SP * j, seen: gcd(abs(i), abs(j)) === 1 });
const NT = TREES.length;
// Which tree stands at lattice point (i, j), for the trunk lookup per LED.
const AT = new Int16Array((2 * R + 1) * (2 * R + 1)).fill(-1);
TREES.forEach((T, k) => (AT[(T.j + R) * (2 * R + 1) + T.i + R] = k));
// The thickest the trunks get, as a multiple of 1/R: a little past Pólya's
// bound, so at the top of every breath the orchard is closed in every direction.
const TOP = 1.03;
// Shadows are found per LED through a table of angle bins: each bin lists
// the trees whose shadow wedge (padded by an LED's angular size) reaches it.
const NB = 720;

export function setup(params) {
  const bins = [];
  for (let b = 0; b < NB; b++) bins.push([]);
  params.s = {
    t: 0, hue: 0, speed: 2, thin: 0.45, walk: 0.06, rR: 0.3, ox: CX, oy: CY,
    bins, ta: new Float32Array(NT), td: new Float32Array(NT), tw: new Float32Array(NT), lit: new Float32Array(NT),
    lo: new Float32Array(64), hi: new Float32Array(64),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.thin = cl(k[2], 0.45, 0.95);
  S.walk = cl(k[3], 0, 1);
  S.t += d * S.speed;
  // One breath is 16 story seconds (8 s at Speed 2). It starts thin, so the
  // picture opens on the full starburst, and runs at an even pace through
  // the middle, where the rays narrow and go out, easing only at its ends.
  const p = (S.t / 16) % 1, tri = 1 - abs(2 * p - 1);
  S.rR = S.thin + (TOP - S.thin) * (0.5 * tri + 0.5 * tri * tri * (3 - 2 * tri));
  // The walk: a small loop round the lattice point, two lobes so it never
  // repeats the breath. A quarter of a spacing across at Walk 1.
  const w = S.walk * 0.125 * SP, u = (TAU * S.t) / 11.3;
  S.ox = CX + w * cos(u) + 0.35 * w * sin(2 * u);
  S.oy = CY + w * sin(u);
}

// Length of the union of the intervals [lo[i], hi[i]], i < n (already clipped
// to the LED's window). n is small, so an insertion sort is the cheap way.
function union(lo, hi, n) {
  for (let i = 1; i < n; i++) {
    const a = lo[i], bb = hi[i];
    let j = i - 1;
    while (j >= 0 && lo[j] > a) {
      lo[j + 1] = lo[j];
      hi[j + 1] = hi[j];
      j--;
    }
    lo[j + 1] = a;
    hi[j + 1] = bb;
  }
  let sum = 0, a = lo[0], e = hi[0];
  for (let i = 1; i < n; i++) {
    if (lo[i] > e) {
      sum += e - a;
      a = lo[i];
      e = hi[i];
    } else if (hi[i] > e) e = hi[i];
  }
  return sum + e - a;
}

const wrap = (a) => (a > PI ? a - TAU : a < -PI ? a + TAU : a);

// The share of the angular window [phi - hw, phi + hw] that the shadows of
// the trees nearer than rho leave in the light. Exact for the wedges, so a
// ray narrower than an LED dims in proportion instead of flickering.
function lightAt(S, phi, hw, rho, skip) {
  const list = S.bins[min(NB - 1, floor(((phi + PI) / TAU) * NB))];
  let n = 0;
  for (let m = 0; m < list.length; m++) {
    const k = list[m];
    if (k === skip || S.td[k] >= rho) continue;
    const rel = wrap(S.ta[k] - phi), w = S.tw[k];
    const lo = max(-hw, rel - w), hi = min(hw, rel + w);
    if (lo < hi) {
      S.lo[n] = lo;
      S.hi[n] = hi;
      n++;
    }
  }
  return n ? max(0, 1 - union(S.lo, S.hi, n) / (2 * hw)) : 1;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rr = (S.rR / R) * SP, ox = S.ox, oy = S.oy;
  // Each tree's direction, distance and the half angle of its shadow wedge,
  // then the bins its padded wedge covers.
  for (const list of S.bins) list.length = 0;
  for (let k = 0; k < NT; k++) {
    const T = TREES[k], dx = T.x - ox, dy = T.y - oy, dd = sqrt(dx * dx + dy * dy);
    S.ta[k] = atan2(dy, dx);
    S.td[k] = dd;
    S.tw[k] = asin(min(1, rr / dd));
    const pad = S.tw[k] + 0.6 / max(1, dd - rr);
    const b0 = floor(((S.ta[k] - pad + PI) / TAU) * NB), b1 = floor(((S.ta[k] + pad + PI) / TAU) * NB);
    for (let b = b0; b <= b1; b++) S.bins[((b % NB) + NB) % NB].push(k);
  }
  // How much of each trunk's near face the lantern reaches: the visible trees
  // are the ones with coprime coordinates, Euclid's orchard.
  for (let k = 0; k < NT; k++) S.lit[k] = lightAt(S, S.ta[k], max(0.004, S.tw[k] * 0.8), S.td[k] - 0.01, k);

  const h = 0.5 + S.hue;
  const LAMP = hsv(h, 0.72, 1), RAY = hsv(h + 0.05, 0.36, 1), FACE = hsv(h + 0.36, 0.55, 1);
  const SHADE = [0.035, 0.02, 0.075], CORE = [0.16, 0.1, 0.3], RIM = [0.01, 0, 0.02];
  const RING = (R + 0.5) * SP;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - ox, dy = y - oy, rho = sqrt(dx * dx + dy * dy);
      const cx = x - CX, cy = y - CY, rc = sqrt(cx * cx + cy * cy);
      let r, g, b;
      if (rho < 2.2) {
        // The lantern: a white core in a small halo of its own light.
        const v = rho < 1.1 ? 1 : 0.55;
        r = v + (1 - v) * LAMP[0];
        g = v + (1 - v) * LAMP[1];
        b = v + (1 - v) * LAMP[2];
      } else {
        const phi = atan2(dy, dx), hw = min(0.4, 0.55 / rho);
        const L = lightAt(S, phi, hw, rho, -1);
        // The light fades with distance in steps, gently, so a ray reads as
        // one line from the lantern to the panel's edge; past the circle the
        // escaping light turns a paler tint.
        const out = cl((rc - RING + 1.5) / 3, 0, 1);
        const fall = q(1 - 0.0065 * rho, 20);
        const col = out ? RAY : LAMP, v = L * fall;
        r = SHADE[0] + (col[0] - SHADE[0]) * v;
        g = SHADE[1] + (col[1] - SHADE[1]) * v;
        b = SHADE[2] + (col[2] - SHADE[2]) * v;
        // The edge of the orchard, a faint dotted circle where it runs in shadow.
        if (abs(rc - RING) < 0.5 && ((x + y) & 1) === 0 && v < 0.2) (r = CORE[0] * 1.3), (g = CORE[1] * 1.3), (b = CORE[2] * 1.3);
      }
      // A trunk on this LED: the nearest lattice point within the orchard.
      const ti = round(cx / SP), tj = round(cy / SP);
      if ((ti || tj) && ti * ti + tj * tj <= R * R) {
        const tx = cx - SP * ti, ty = cy - SP * tj, dt = sqrt(tx * tx + ty * ty);
        const cov = cl(rr + 0.5 - dt, 0, 1);
        if (cov > 0) {
          const k = AT[(tj + R) * (2 * R + 1) + ti + R];
          // The face turned to the lantern catches its light, if the lantern
          // reaches the trunk; the rest of the disk is a dark rim.
          const fx = ox - (CX + SP * ti), fy = oy - (CY + SP * tj), fd = sqrt(fx * fx + fy * fy) || 1;
          const facing = dt < 0.01 ? 1 : (tx * fx + ty * fy) / (dt * fd);
          const inner = cl(rr - 0.35 - dt, 0, 1);
          const lit = S.lit[k] * cl(0.45 + facing, 0, 1);
          const cr = RIM[0] + (CORE[0] + (FACE[0] - CORE[0]) * lit - RIM[0]) * inner;
          const cg = RIM[1] + (CORE[1] + (FACE[1] - CORE[1]) * lit - RIM[1]) * inner;
          const cb = RIM[2] + (CORE[2] + (FACE[2] - CORE[2]) * lit - RIM[2]) * inner;
          r += (cr - r) * cov;
          g += (cg - g) * cov;
          b += (cb - b) * cov;
        }
      }
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, b)));
    }
  }
}
