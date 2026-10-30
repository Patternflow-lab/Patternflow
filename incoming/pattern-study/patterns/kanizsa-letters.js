// ===== Patternflow pattern =====
// Title:   Kanizsa Letters
// Family:  type
// Idea:    Thirty-two pac-man discs on a 4 by 8 lattice turn at random over a fine diagonal grating, and only when every one swings its cut into line does a letter of EDGE LIGHT stand out in front of them, a surface the colour of the background whose edges the eye draws between the cuts while the grating inside it slips half a period so its lines end on those edges, though no LED ever draws an edge; then the discs let go, spin, turn about and line up into the next letter.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: illusory contours from notched discs (Gaetano Kanizsa, Margini quasi-percettivi in campi con stimolazione omogenea, 1955) and from line ends (Walter Ehrenstein, 1941); abutting gratings (Rüdiger von der Heydt, Esther Peterhans and Günter Baumgartner, 1984); the support ratio (Thomas Shipley and Philip Kellman, 1992); letters on a 3 by 7 grid of cells drawn here, pattern round 76
// Round:   76
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Gap=0.3..0.8, Period=5..14
//
// Knob 1: Hue. Turns both colours round the wheel. At 0 the discs are golden yellow and the grating slate blue; at 0.5 the discs are sky blue and the grating a muted gold.
// Knob 2: Speed. At 2 a letter takes 7.2 s: the discs swing into line one by one over 2.6 s, each swing 0.45 s, the letter holds 2.4 s, they let go over 1.2 s and spin free for 1 s. A free disc turns at 0.2 to 0.55 turns a second and turns about every 1.7 s on average. At 0.2 it all runs ten times slower.
// Knob 3: Gap. The share of each letter edge left between the discs for the eye to fill in, one minus Shipley and Kellman's support ratio. A disc's radius is 8 (1 - Gap) LEDs on the 16 LED lattice: 5.6 at 0.3, where 70% of every edge is cut and the letter is plain; 3.2 at 0.6; 1.6 at 0.8, where the cuts are too small to see and the letter stands on the grating's line ends alone.
// Knob 4: Period. LEDs along a row between grating lines, 5 to 14; the lines run at 45 degrees, 3.5 to 9.9 LEDs apart. Inside the letter they shift by half a period rounded to a whole LED, 3 LEDs at 5 and 7 at 14, and each LED is lit by its distance to the nearest line so that the shift leaves the grating's mean light as it was.
// Buttons: K1 tap lets the letter go at once and moves on to the next.

// A letter fills cells of the lattice, so every disc sits on a corner of
// four cells and the letter covers 0 to 4 of its quarters. The quarters it
// covers are the disc's cut: one quarter at an outer corner, two side by
// side along an edge, three at an inner corner, two opposite where the
// letter steps diagonally. A disc the letter does not touch is whole. While
// the discs spin free each wears one open quarter, a pac-man, so the lattice
// reads the same whatever letter is coming; as a disc swings into line its
// mouth turns into the cut the letter asks of it. The letter's own surface
// is the grating, shifted, and shows through every cut.

const W = 64, H = 128, N = W * H, TAU = 2 * Math.PI, Q = Math.PI / 2;
const { floor, round, min, max, abs, atan2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const wrap = (a) => a - TAU * floor((a + PI) / TAU);
// The lattice: discs on the corners of 16 LED cells, 4 across and 8 down,
// the first at (8, 8). A letter fills 3 by 7 of the cells.
const CELL = 16, OX = 8, OY = 8, NX = 4, NY = 8;
// Seconds at Speed 2: the discs swing into line one by one, the letter
// holds, they let go, they spin free.
const SETTLE = 2.6, HOLD = 2.4, LETGO = 1.2, FREE = 1, SWING = 0.45, HUE0 = 0.12;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// E D G E L I G H T, rows of 3 cells from the top.
const FONT = {
  E: "### #.. #.. ### #.. #.. ###",
  D: "##. #.# #.# #.# #.# #.# ##.",
  G: "### #.. #.. #.# #.# #.# ###",
  L: "#.. #.. #.. #.. #.. #.. ###",
  I: "### .#. .#. .#. .#. .#. ###",
  H: "#.# #.# #.# ### #.# #.# #.#",
  T: "### .#. .#. .#. .#. .#. .#.",
};
const WORD = "EDGELIGHT";
const cellOf = (g, r, c) => r >= 0 && r < 7 && c >= 0 && c < 3 && g[r * 3 + c] === "#";

// Which quarters of each disc the letter covers: quarter k spans the
// directions k x 90 to (k + 1) x 90 degrees, y down, so 0 is the cell to the
// lower right, 1 lower left, 2 upper left, 3 upper right.
function notches(ch) {
  const g = FONT[ch].replace(/ /g, ""), out = [];
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) out.push([cellOf(g, j, i), cellOf(g, j, i - 1), cellOf(g, j - 1, i - 1), cellOf(g, j - 1, i)]);
  return { g, out };
}

function newDisc(i) {
  return {
    x: OX + (i % NX) * CELL, y: OY + floor(i / NX) * CELL, th: Math.random() * TAU,
    om: 1.2 + 2.2 * Math.random(), dir: Math.random() < 0.5 ? -1 : 1, spin: 0,
    o: [0, 0, 0, 0], from: [0, 0, 0, 0], to: [0, 0, 0, 0], on: 0, off: 0, ft: 0, th0: 0, mode: 0,
  };
}

export function setup(params) {
  const S = (params.s = {
    hue: 0, speed: 2, gap: 0.3, per: 5, started: false, btn: false, D: [], li: 0, ph: 0, t: 0, sh: 0,
    g: "", cov: new Uint8Array(N), out: new Float32Array(N * 3), lc: [0, 0, 0], dc: [0, 0, 0],
  });
  for (let i = 0; i < NX * NY; i++) S.D.push(newDisc(i));
  return S;
}

// The mouth a disc wears while it spins free before a letter: one quarter
// open, one of the quarters the letter will cover if it covers any.
function freeMouth(want) {
  const ks = [0, 1, 2, 3].filter((k) => want[k]);
  const k = ks.length ? ks[floor(Math.random() * ks.length)] : floor(Math.random() * 4);
  return [0, 1, 2, 3].map((q) => (q === k ? 1 : 0));
}

function letter(S, k) {
  S.li = ((k % WORD.length) + WORD.length) % WORD.length;
  const { g, out } = notches(WORD[S.li]);
  S.g = g;
  S.want = out;
}
// Where the letter's own grating lies; set as the discs start to swing in,
// when the grating is whole again.
function surface(S) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) S.cov[y * W + x] = cellOf(S.g, floor((y - OY) / CELL), floor((x - OX) / CELL)) ? 1 : 0;
}

// Phases: 0 the discs swing into line one by one, 1 the letter holds, 2 they
// let go, their mouths turning to the next letter's, 3 they spin free.
function phase(S, p) {
  S.ph = p;
  S.t = 0;
  if (p === 0) surface(S);
  S.D.forEach((d, i) => {
    if (p === 0) {
      d.on = 0.2 + Math.random() * (SETTLE - SWING - 0.4);
      d.mode = 0;
      d.from = d.o.slice();
      d.to = S.want[i].map((b) => (b ? 1 : 0));
    }
    if (p === 2) {
      d.off = Math.random() * 0.6;
      d.ft = 0;
      d.from = d.o.slice();
    }
  });
  if (p === 2) {
    // The next letter is chosen as the discs let go.
    letter(S, S.li + 1);
    S.D.forEach((d, i) => (d.to = freeMouth(S.want[i])));
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.3, 5], d0 = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.gap = cl(k[2] == null ? 0.3 : k[2], 0.3, 0.8);
  S.per = cl(k[3] == null ? 5 : k[3], 5, 14);
  const btn = !!(input.btnPressed && input.btnPressed[0]);
  if (!S.started) {
    letter(S, 0);
    S.D.forEach((d, i) => (d.o = freeMouth(S.want[i])));
    phase(S, 0);
    S.started = true;
  } else if (btn && !S.btn && S.ph < 2) phase(S, 2);
  S.btn = btn;
  const d = (d0 * S.speed) / 2;
  S.t += d;
  // A free disc turns at its own pace and now and then turns about.
  for (const c of S.D) {
    if (Math.random() < d * 0.6) c.dir = -c.dir;
    c.spin += cl(c.dir - c.spin, -d * 5, d * 5);
  }
  let lined = 0;
  if (S.ph === 0) {
    for (const c of S.D) {
      if (c.mode === 0) {
        c.th += c.om * c.spin * d;
        if (S.t >= c.on) (c.mode = 1), (c.th0 = wrap(c.th));
      }
      if (c.mode === 1) {
        const u = ease((S.t - c.on) / SWING);
        c.th = c.th0 * (1 - u);
        for (let q = 0; q < 4; q++) c.o[q] = c.from[q] + (c.to[q] - c.from[q]) * u;
        if (S.t - c.on >= SWING) (c.mode = 2), (c.th = 0);
      }
      if (c.mode === 2) lined++;
    }
    if (S.t >= SETTLE) phase(S, 1);
  } else if (S.ph === 1) {
    lined = S.D.length;
    if (S.t >= HOLD) phase(S, 2);
  } else {
    for (const c of S.D) {
      if (S.ph === 2 && S.t < c.off) {
        lined++;
        continue;
      }
      // Let go: the spin picks up over 0.3 s and the mouth turns into the
      // free one over 0.4 s.
      c.ft += d;
      c.th += c.om * c.spin * d * min(1, c.ft / 0.3);
      const e = ease(c.ft / 0.4);
      for (let q = 0; q < 4; q++) c.o[q] = c.from[q] + (c.to[q] - c.from[q]) * e;
    }
    if (S.ph === 2 && S.t >= LETGO) phase(S, 3);
    else if (S.ph === 3 && S.t >= FREE) phase(S, 0);
  }
  // The grating inside the letter slides half a period once more than half
  // the discs are in line, and back as they let go.
  const goal = ease((lined / S.D.length - 0.5) / 0.5);
  S.sh += cl(goal - S.sh, -d / 0.5, d / 0.5);
}

// A grating of lines x - y = 0 mod P, one LED wide, each LED lit by its
// distance along x - y from the nearest line, so that a shift by any amount
// leaves the mean light of the grating the same.
function line(x, y, P, s) {
  const g = x - y + s, m = ((g % P) + P) % P;
  return cl(1 - min(m, P - m), 0, 1);
}

// Is the direction b (radians, y down) in a disc's open mouth?
function inMouth(o, b) {
  b = ((b % TAU) + TAU) % TAU;
  const k = floor(b / Q), f = b / Q - k;
  // Quarter k is open over the middle o of its width.
  return o[k] > 0 && abs(f - 0.5) <= o[k] / 2;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  const o = S.out, P = S.per, sh = round((S.sh * P) / 2), cov = S.cov, lc = S.lc, dc = S.dc;
  hsv(S.hue + HUE0 + 0.5, 0.45, 0.55, lc);
  hsv(S.hue + HUE0, 0.75, 1, dc);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, v = line(x, y, P, cov[i] ? sh : 0);
      o[i * 3] = v * lc[0];
      o[i * 3 + 1] = v * lc[1];
      o[i * 3 + 2] = v * lc[2];
    }
  const R = (CELL / 2) * (1 - S.gap), R2 = R * R;
  for (const c of S.D) {
    const x0 = max(0, floor(c.x - R - 1)), x1 = min(W - 1, floor(c.x + R)), y0 = max(0, floor(c.y - R - 1)), y1 = min(H - 1, floor(c.y + R));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        // 3 x 3 samples: on the disc and outside its mouth is disc colour,
        // in the mouth the letter's own grating shows through.
        let body = 0, mouth = 0;
        for (let sy = 0; sy < 3; sy++)
          for (let sx = 0; sx < 3; sx++) {
            const px = x + (sx + 0.5) / 3 - c.x, py = y + (sy + 0.5) / 3 - c.y;
            if (px * px + py * py > R2) continue;
            body++;
            if (inMouth(c.o, atan2(py, px) - c.th)) mouth++;
          }
        if (!body) continue;
        const i = (y * W + x) * 3, g = line(x, y, P, sh), a = body / 9, m = mouth / body;
        for (let q = 0; q < 3; q++) o[i + q] = a * (m * g * lc[q] + (1 - m) * dc[q]) + (1 - a) * o[i + q];
      }
  }
  for (let i = 0; i < N; i++) display.setPixel(i % W, floor(i / W), round(cl(o[i * 3], 0, 1) * 255), round(cl(o[i * 3 + 1], 0, 1) * 255), round(cl(o[i * 3 + 2], 0, 1) * 255));
}
