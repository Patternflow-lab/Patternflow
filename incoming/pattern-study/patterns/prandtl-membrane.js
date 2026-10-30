// ===== Patternflow pattern =====
// Title:   Prandtl's Membrane
// Family:  type
// Idea:    A bar whose cross-section is a word is twisted, and each letter is Prandtl's film stretched over a hole of its shape and blown up from below, so the letters breathe as lit pillows and hollow letters rise as plateaus round a flat plate, coloured by the shear stress, which is zero along each crest, runs hot along the rims and hottest in the inside corners.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: torsion of prismatic bars (Adhémar Barré de Saint-Venant, 1855), the membrane analogy (Ludwig Prandtl, 1903), thin-walled tubes (Rudolf Bredt, 1896), the Shortley-Weller boundary stencil (George Shortley and Royal Weller, 1938), successive over-relaxation (David Young, 1950), pattern round 75
// Round:   75
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Twist=0.2..3, Word=0..3, Lamp=0..1
//
// Knob 1: Hue. Turns the stress colours round the wheel: at 0 the crests, where the stress is zero, are blue, the rims run from magenta through red to orange, and the hottest places, inside corners and the outer walls of the hollow letters, burn yellow-orange. The plates in the holes take the blue, dim.
// Knob 2: Twist. How hard the bar is twisted, which is how hard the film is blown up. Each breath, one every 4 s, swings the twist from 40% to 100% of the knob. At 2 the film stands at 56 degrees at the rim of the 14 LED bar of ㅜ at the top of a breath and 31 at the bottom, and the colour reaches its hot end at a stress of 12.7. At 0.2 the film over that bar tilts 9 degrees at most and the colours stay blue and violet; at 3 the same rim stands at 66 degrees and runs yellow.
// Knob 3: Word. The cross-section: the syllable 숨 (breath) the height of the panel, then LIT, AIR and HOT, three capitals 56 by 38 LEDs stacked. A letter with a hole is a hollow section, and the hole is a flat plate the film lifts: at the same twist HOT carries four times the torque of LIT.
// Knob 4: Lamp. How high the lamp stands as it walks round the word once in 12 s: 19 degrees at 0.06, low enough that each stroke is lit on one side and shaded on the other, with a pale glint halfway down the flank that faces the lamp; 75 degrees at 1, where the film is lit almost evenly, the glint rides the crests and mostly the colours move.

const W = 64, H = 128;
const { floor, round, sqrt, cos, sin, min, max, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, o, k) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[k] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[k + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[k + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- Letters, as unions of convex polygons in LEDs. The capitals sit in a
// box 56 wide and 38 tall, stems 13 thick and bars 7 to 11, at rows 3, 46
// and 89; the syllable 숨 fills the panel, ㅅ in rows 2 to 46, ㅜ in 51 to
// 81 and ㅁ, a hollow box with walls 14 to 15 thick, in 85 to 126. Corners
// are left sharp: the film is flat at an outside corner and infinitely steep
// at an inside one, and both should show.
const R = (a, b, c, d) => [[a, b], [c, b], [c, d], [a, d]];
const TOP = [[0, 9], [9, 0], [47, 0], [56, 9], [56, 11], [0, 11]];
const LAT = {
  L: [R(0, 0, 13, 38), R(13, 27, 56, 38)],
  I: [R(6, 0, 50, 11), R(21, 11, 35, 27), R(6, 27, 50, 38)],
  T: [R(0, 0, 56, 11), R(21, 11, 35, 38)],
  A: [TOP, R(0, 11, 13, 38), R(43, 11, 56, 38), R(13, 20, 43, 29)],
  R: [R(0, 0, 13, 38), [[13, 0], [47, 0], [56, 9], [56, 11], [13, 11]], R(43, 11, 56, 18), [[13, 18], [56, 18], [56, 21], [49, 28], [13, 28]], [[30, 28], [43, 28], [56, 36], [56, 38], [43, 38]]],
  H: [R(0, 0, 13, 38), R(43, 0, 56, 38), R(13, 14, 43, 24)],
  O: [TOP, [[0, 27], [56, 27], [56, 29], [47, 38], [9, 38], [0, 29]], R(0, 11, 13, 27), R(43, 11, 56, 27)],
};
const SUM = [
  [[23, 2], [41, 2], [18, 46], [0.5, 46]], // ㅅ, left stroke
  [[19, 30], [27, 17], [63.5, 38], [63.5, 46], [46, 46]], // ㅅ, right stroke
  R(0.5, 51, 63.5, 65), R(24, 65, 40, 81), // ㅜ
  R(3, 85, 61, 99), R(3, 112, 61, 126), R(3, 99, 18, 112), R(46, 99, 61, 112), // ㅁ
];
const WORDS = ["숨", "LIT", "AIR", "HOT"];

function wordPolys(word) {
  if (word === "숨") return SUM;
  const out = [];
  [...word].forEach((ch, i) => {
    for (const poly of LAT[ch]) out.push(poly.map(([x, y]) => [x + 4, y + 3 + 43 * i]));
  });
  return out;
}

// Each convex polygon as its edge lines, outward normal (nx, ny) and offset,
// so the largest n.p - c over the edges is negative inside and positive out.
function edgesOf(poly) {
  let cx = 0, cy = 0;
  for (const [x, y] of poly) (cx += x / poly.length), (cy += y / poly.length);
  return poly.map(([x0, y0], i) => {
    const [x1, y1] = poly[(i + 1) % poly.length];
    let nx = y1 - y0, ny = x0 - x1;
    const l = sqrt(nx * nx + ny * ny);
    (nx /= l), (ny /= l);
    if (nx * (cx - x0) + ny * (cy - y0) > 0) (nx = -nx), (ny = -ny);
    return [nx, ny, nx * x0 + ny * y0];
  });
}

// ---- The film. Saint-Venant's stress function phi solves lap(phi) = -2
// (twist and shear modulus taken as 1) inside the section with phi = 0 on
// its outline, the shear stress is |grad phi| and the torque is twice the
// volume under phi. Prandtl saw the same equation in a film stretched over a
// hole of that shape and blown up from below. It is solved on a grid of half
// LEDs, 128 by 256 nodes at ((i + 1/2)/2, (j + 1/2)/2), by successive
// over-relaxation, ten sweeps a frame until no node moves by more than 0.01,
// so a new word inflates as the solver relaxes: 116 to 144 sweeps, half a
// second. Next to the outline a node uses the Shortley-Weller stencil with
// its true distance to the edge along each grid line, so a slanted outline is
// not a staircase. A hole makes a hollow section: phi is constant round the
// hole, a weightless flat plate the film lifts, and the plate settles where
// the pressure on its area balances the film's pull round its rim. That is
// the condition that the stress circulates round the hole twice the hole's
// area, the one Bredt's formula for thin tubes rests on.
//
// Checked in Node with this solver: on a circle of radius 20 the film peaks
// at 199.79 against a^2/2 = 200, phi is within 0.18 of (a^2 - r^2)/2
// everywhere, and the largest stress is 19.98 against a = 20, at the rim. On
// a 40 by 8 strip the largest stress is at the middle of a long side, 7.50
// at the node a quarter LED in from the edge, where the strip's 2y gives 7.5.
// In a square tube 40 across with walls 6 the plate stands at 108.7 against
// 102 from Bredt's thin-wall formula, and the stress in the middle of a wall
// is 17.6 against Bredt's 17.0. The walls of 숨's ㅁ are too thick for Bredt:
// its plate stands at 268, and across the bottom wall the stress climbs from
// 6 at the plate to 31 at the outline.
const FW = 128, FH = 256, NN = FW * FH, HS = 0.5;
function buildFilm(word) {
  // Each polygon is measured only over its own box and 2 LEDs round it;
  // everywhere else is plainly outside.
  const d = new Float32Array(NN).fill(2);
  for (const poly of wordPolys(word)) {
    const e = edgesOf(poly).flat(), ne = e.length, xs = poly.map((q) => q[0]), ys = poly.map((q) => q[1]);
    const i0 = max(0, floor((min(...xs) - 2) / HS)), i1 = min(FW - 1, floor((max(...xs) + 2) / HS));
    const j0 = max(0, floor((min(...ys) - 2) / HS)), j1 = min(FH - 1, floor((max(...ys) + 2) / HS));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const x = (i + 0.5) * HS, y = (j + 0.5) * HS;
        let m = -1e9;
        for (let k = 0; k < ne; k += 3) {
          const v = e[k] * x + e[k + 1] * y - e[k + 2];
          if (v > m) m = v;
        }
        if (m < d[j * FW + i]) d[j * FW + i] = m;
      }
  }
  // 0 outside, 1 film, 2 + k hole k: a gap no path from the panel's edge reaches.
  const type = new Int16Array(NN), seen = new Uint8Array(NN), stack = new Int32Array(4 * NN + 8);
  for (let p = 0; p < NN; p++) if (d[p] < 0) type[p] = 1;
  const fill = (starts, mark) => {
    let top = 0, n = 0;
    for (const p of starts) stack[top++] = p;
    while (top) {
      const p = stack[--top];
      if (seen[p] || type[p] === 1) continue;
      seen[p] = 1;
      type[p] = mark;
      n++;
      const x = p % FW;
      if (x > 0) stack[top++] = p - 1;
      if (x < FW - 1) stack[top++] = p + 1;
      if (p >= FW) stack[top++] = p - FW;
      if (p < NN - FW) stack[top++] = p + FW;
    }
    return n;
  };
  const rim = [];
  for (let i = 0; i < FW; i++) rim.push(i, NN - FW + i);
  for (let j = 0; j < FH; j++) rim.push(j * FW, j * FW + FW - 1);
  fill(rim, 0);
  const area = [];
  for (let p = 0; p < NN; p++) if (!seen[p] && type[p] !== 1) area.push(fill([p], 2 + area.length) * HS * HS);
  const holes = area.length;
  // Film nodes and their stencils. A neighbour slot points into V: a film
  // node's own index, NN for the outline (0), or NN + 1 + k for hole k's rim.
  const cells = [];
  for (let p = 0; p < NN; p++) if (type[p] === 1) cells.push(p);
  const n = cells.length, idx = new Int32Array(n * 4), cof = new Float32Array(n * 5), th = new Float32Array(n * 4);
  const links = Array.from({ length: holes }, () => []);
  const OFF = [-1, 1, -FW, FW];
  for (let c = 0; c < cells.length; c++) {
    const p = cells[c];
    for (let k = 0; k < 4; k++) {
      const q = p + OFF[k];
      if (type[q] === 1) (idx[c * 4 + k] = q), (th[c * 4 + k] = 1);
      else {
        const t = cl(d[p] / (d[p] - d[q]), 0.08, 1);
        th[c * 4 + k] = t;
        if (type[q] >= 2) (idx[c * 4 + k] = NN + 1 + type[q] - 2), links[type[q] - 2].push(c, t);
        else idx[c * 4 + k] = NN;
      }
    }
    // Shortley-Weller: d2/dx2 ~ 2/(a b (a+b)) (b uL + a uR - (a+b) u), a, b the arms.
    for (let ax = 0; ax < 2; ax++) {
      const a = th[c * 4 + ax * 2], b = th[c * 4 + ax * 2 + 1];
      cof[c * 5 + ax * 2] = 2 / (a * (a + b));
      cof[c * 5 + ax * 2 + 1] = 2 / (b * (a + b));
      cof[c * 5 + 4] += 2 / (a * b);
    }
  }
  for (let k = 0; k < holes; k++) {
    let corr = 0;
    for (let i = 1; i < links[k].length; i += 2) corr += 0.5 - links[k][i];
    area[k] += corr * HS * HS;
  }
  return { cells: Int32Array.from(cells), idx, cof, th, links, area, holes, type, V: new Float32Array(NN + 1 + holes), n, settled: false, sweeps: 0, gx: new Float32Array(NN), gy: new Float32Array(NN), lgx: new Float32Array(W * H), lgy: new Float32Array(W * H), lin: new Uint8Array(W * H), lplate: new Uint8Array(W * H) };
}

// One sweep. The node update is the stencil solved for its centre, with the
// -2 on the right scaled by h^2. Each hole's plate then moves to the height
// where the film's pull round its rim, sum (K - phi)/theta over the links,
// balances twice its area.
function sweep(F, w) {
  const { cells, idx, cof, V, n } = F, src = 2 * HS * HS;
  let change = 0;
  for (let c = 0; c < n; c++) {
    const p = cells[c], i4 = c * 4, i5 = c * 5;
    const g = (cof[i5] * V[idx[i4]] + cof[i5 + 1] * V[idx[i4 + 1]] + cof[i5 + 2] * V[idx[i4 + 2]] + cof[i5 + 3] * V[idx[i4 + 3]] + src) / cof[i5 + 4];
    const dv = w * (g - V[p]);
    V[p] += dv;
    if (abs(dv) > change) change = abs(dv);
  }
  for (let k = 0; k < F.holes; k++) {
    const L = F.links[k];
    let s = 0, inv = 0;
    for (let i = 0; i < L.length; i += 2) (s += V[cells[L[i]]] / L[i + 1]), (inv += 1 / L[i + 1]);
    const K = (2 * F.area[k] + s) / inv, dv = w * (K - V[NN + 1 + k]);
    V[NN + 1 + k] += dv;
    if (abs(dv) > change) change = abs(dv);
  }
  return change;
}

// Slope of the film at each node, from the parabola through the node and its
// two neighbours on each axis at their true distances (the outline or the
// plate counting as a neighbour at its crossing).
function slopes(F) {
  const { cells, idx, th, V, n, gx, gy } = F;
  for (let c = 0; c < n; c++) {
    const p = cells[c], u = V[p];
    for (let ax = 0; ax < 2; ax++) {
      const a = th[c * 4 + ax * 2] * HS, b = th[c * 4 + ax * 2 + 1] * HS, uL = V[idx[c * 4 + ax * 2]], uR = V[idx[c * 4 + ax * 2 + 1]];
      const g = (a * a * uR - b * b * uL + (b * b - a * a) * u) / (a * b * (a + b));
      if (ax) gy[p] = g;
      else gx[p] = g;
    }
  }
  // Each LED takes the mean slope of the film nodes among its four.
  const { type, lgx, lgy, lin, lplate } = F;
  for (let q = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, q++) {
      let sx = 0, sy = 0, m = 0, pl = 0;
      for (let s = 0; s < 4; s++) {
        const p = (2 * y + (s >> 1)) * FW + 2 * x + (s & 1);
        if (type[p] === 1) (sx += gx[p]), (sy += gy[p]), m++;
        else if (type[p] >= 2) pl++;
      }
      (lgx[q] = m ? sx / m : 0), (lgy[q] = m ? sy / m : 0), (lin[q] = m), (lplate[q] = pl);
    }
}

const BREATH = 4; // seconds a breath, fifteen a minute at rest
const LAMP_TURN = 12;
export function setup(params) {
  params.s = { t: 0, hue: 0, twist: 2, word: -1, lamp: 0.06, film: null, films: [], rgb: new Float32Array(3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.t += d;
  S.hue = k[0];
  S.twist = cl(k[1], 0.2, 3);
  S.lamp = cl(k[3], 0, 1);
  const word = cl(round(k[2]), 0, 3);
  if (word !== S.word) {
    S.word = word;
    if (!S.films[word]) S.films[word] = buildFilm(WORDS[word]);
    S.film = S.films[word];
  }
  const F = S.film;
  if (!F.settled) {
    let ch = 0;
    for (let i = 0; i < 10; i++) ch = sweep(F, 1.92);
    F.sweeps += 10;
    slopes(F);
    if (ch < 1e-2 || F.sweeps > 1500) F.settled = true;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.film) return;
  const F = S.film, { lgx, lgy, lin, lplate } = F, rgb = S.rgb;
  // The twist swings between 40% and 100% of the knob's on every breath.
  const breath = 0.5 - 0.5 * cos((2 * PI * S.t) / BREATH);
  const P = (S.twist / 2) * (0.4 + 0.6 * breath);
  const Z = 0.12 * P; // film height per unit of phi
  const az = (2 * PI * S.t) / LAMP_TURN + 0.6, el = ((15 + 60 * S.lamp) * PI) / 180;
  const lx = cos(el) * cos(az), ly = cos(el) * sin(az), lz = sin(el);
  let hx = lx, hy = ly, hz = lz + 1;
  const hl = sqrt(hx * hx + hy * hy + hz * hz);
  (hx /= hl), (hy /= hl), (hz /= hl);
  const kt = P / 11; // the stress at which the colour reaches the hot end is 11 / P
  const plate = 0.6 * (0.5 + 0.5 * lz);
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const n = lin[p];
      if (n) {
        const gx = lgx[p], gy = lgy[p], ax = -Z * gx, ay = -Z * gy, inv = 1 / sqrt(ax * ax + ay * ay + 1);
        const dif = (ax * lx + ay * ly + lz) * inv, nh = (ax * hx + ay * hy + hz) * inv;
        let spec = nh > 0.6 ? nh * nh : 0;
        spec *= spec * spec * spec;
        spec *= spec * spec; // nh^24
        const tau = min(1.2, sqrt(gx * gx + gy * gy) * kt);
        const v = (0.4 + 0.3 * (1 + dif)) * (0.6 + 0.6 * tau) + 0.7 * spec * n * 0.25;
        hsv(0.62 + S.hue + 0.45 * min(1.15, tau), 1 - 0.3 * spec, v > 1 ? 1 : v, rgb, 0);
        display.setPixel(x, y, round(255 * rgb[0]), round(255 * rgb[1]), round(255 * rgb[2]));
      } else if (lplate[p]) {
        hsv(0.62 + S.hue, 1, plate * lplate[p] * 0.25, rgb, 0);
        display.setPixel(x, y, round(255 * rgb[0]), round(255 * rgb[1]), round(255 * rgb[2]));
      } else display.setPixel(x, y, 0, 0, 0);
    }
}
