// ===== Patternflow pattern =====
// Title:   Trivision
// Family:  type
// Idea:    A three-message prism sign: a row of upright triangular prisms side by side, each face printed with one vertical slice of one of three posters, ALL, FOR and ONE, big hand-drawn letters stacked down the panel, and the prisms turn a third of a turn one after another, so mid-change the sign shows the new word on one side and the old on the other with the turning prisms between, each showing two foreshortened faces lit differently by a lamp at the left.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: three-sided rotating prism billboard (trivision); letters drawn for this pattern; pattern round 102
// Round:   102
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Slats=0..2, Wave=0..1
//
// Knob 1: Hue. Turns the three posters round the wheel together. At 0 ALL is pale yellow on deep blue, FOR navy on yellow and ONE white on magenta; at 0.5 ALL is on amber, FOR on blue and ONE on green.
// Knob 2: Speed. At 2 a word holds 2.4 s and each prism takes 1 s to turn; at 0.2 everything takes ten times as long, at 3 two thirds as long.
// Knob 3: Slats. The number of prisms: 8 at 0, each face 8 LEDs wide; 16 at 1, 4 LEDs; 32 at 2, 2 LEDs.
// Knob 4: Wave. How long the turn takes to cross the sign, 6 s for each unit at Speed 2. At the opening 0.06 it is 0.36 s: the eight prisms start 0.05 s apart, so the leftmost is a third of the way round when the last one starts. At 0 they all turn together; at 1 the sweep takes 6 s, each of the eight starts 0.86 s after its left neighbour and hardly two turn at once.

// The prisms. Each is an equilateral triangle in plan with side w, the slat
// width, turning about its own vertical axis; at rest one face lies flat to
// the viewer and the faces of neighbours meet edge to edge. Seen from the
// front (an orthographic view), face j of a prism at angle phi has its
// outward normal at psi = (phi - j) 120 degrees from the viewer, and it is
// seen when cos psi > 0. Its two edges stand at psi - 60 and psi + 60 on the
// circle of radius w/sqrt(3) round the axis, so the face covers x from
// R sin(psi - 60) to R sin(psi + 60) across the slat and runs from depth
// R cos(psi - 60) to R cos(psi + 60). Every quarter LED across the panel
// takes the nearest face of its own prism and both neighbours (a turning
// prism's edge reaches 0.08 w past its slot). The face carries slice i of
// poster j mod 3, stretched to its foreshortened width, and the slice is
// read at that quarter LED. Between turning prisms the dark inside of the
// sign shows: the outline of a prism is only 0.87 w wide at 30 and 90
// degrees.
//
// The light. A lamp at the left front, 40 degrees off the viewer: a face is
// lit by 0.32 + 0.68 cos(psi + 40), scaled so a flat face is 1, so the face
// coming in from the left turns toward the lamp and brightens to 1.19 while
// the face going away to the right falls to 0.38. Where the normal halves
// the angle between lamp and viewer, at psi = -20, the face gives a white
// glint.

const W = 64, H = 128, SS = 4, WS = W * SS;
const { floor, min, max, round, sin, cos, sqrt, PI, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEG = PI / 180, LAMP = -40 * DEG;
const HOLD = 2.4, TURN = 1.0;

// Letters on a unit box, x right and y down: rectangles [x0, y0, x1, y1],
// polygons {p: [x, y, ...]}, and rings {o: [cx, cy, rx, ry, tx, ty, side]}
// (a superellipse band, side -1 left half only, 1 right half only, 0 whole).
const GLYPH = {
  A: [{ p: [0, 1, 0.37, 0, 0.63, 0, 1, 1, 0.75, 1, 0.5, 0.3, 0.25, 1] }, [0.2, 0.6, 0.8, 0.8]],
  L: [[0.06, 0, 0.3, 1], [0.06, 0.77, 0.94, 1]],
  F: [[0.06, 0, 0.3, 1], [0.06, 0, 0.94, 0.23], [0.06, 0.4, 0.8, 0.62]],
  O: [{ o: [0.5, 0.5, 0.5, 0.5, 0.24, 0.26, 0] }],
  R: [[0, 0, 0.24, 1], [0, 0, 0.6, 0.22], [0, 0.42, 0.6, 0.63], { o: [0.6, 0.315, 0.4, 0.315, 0.24, 0.21, 1] }, { p: [0.38, 0.55, 0.66, 0.55, 1, 1, 0.72, 1] }],
  N: [[0, 0, 0.23, 1], [0.77, 0, 1, 1], { p: [0, 0, 0.3, 0, 1, 1, 0.7, 1] }],
  E: [[0.06, 0, 0.3, 1], [0.06, 0, 0.94, 0.22], [0.06, 0.39, 0.84, 0.61], [0.06, 0.78, 0.94, 1]],
};
// Three posters: the word and, as [hue, saturation, value], the ink and
// the ground.
const POSTERS = [
  { word: "ALL", ink: [0.14, 0.4, 1], ground: [0.62, 1, 0.72] },
  { word: "FOR", ink: [0.66, 1, 0.38], ground: [0.14, 1, 1] },
  { word: "ONE", ink: [0, 0, 1], ground: [0.9, 1, 0.8] },
];
// Letter boxes: 50 x 34 LEDs at x 7, rows 5, 47 and 89.
const LX = 7, LW = 50, LH = 34, LY = [5, 47, 89];

function inPoly(p, x, y) {
  let c = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function inGlyph(g, x, y) {
  if (x < 0 || x > 1 || y < 0 || y > 1) return false;
  for (const s of g) {
    if (Array.isArray(s)) {
      if (x >= s[0] && x < s[2] && y >= s[1] && y < s[3]) return true;
    } else if (s.p) {
      if (inPoly(s.p, x, y)) return true;
    } else {
      const [cx, cy, rx, ry, tx, ty, side] = s.o;
      if ((side < 0 && x > cx) || (side > 0 && x < cx)) continue;
      const e = 2.6, dx = abs1(x - cx), dy = abs1(y - cy);
      const out = pow(dx / rx, e) + pow(dy / ry, e), inn = pow(dx / (rx - tx), e) + pow(dy / (ry - ty), e);
      if (out <= 1 && inn > 1) return true;
    }
  }
  return false;
}
const abs1 = (v) => (v < 0 ? -v : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

export function setup(params) {
  // Each poster's ink coverage at a quarter LED across and four samples down.
  const cov = POSTERS.map((P) => {
    const a = new Float32Array(WS * H);
    for (let y = 0; y < H; y++)
      for (let t = 0; t < WS; t++) {
        let n = 0;
        for (let sy = 0; sy < 4; sy++) {
          const py = y + (sy + 0.5) / 4, px = (t + 0.5) / SS;
          for (let l = 0; l < 3; l++) {
            const gx = (px - LX) / LW, gy = (py - LY[l]) / LH;
            if (inGlyph(GLYPH[P.word[l]], gx, gy)) {
              n++;
              break;
            }
          }
        }
        a[y * WS + t] = n / 4;
      }
    return a;
  });
  params.s = {
    cov, T: 1.0, hue: 0, S: 8, wave: 0.06,
    face: new Int8Array(WS), tex: new Int32Array(WS), shade: new Float32Array(WS), glint: new Float32Array(WS),
    pal: [], phi: new Float32Array(32),
  };
}

// Prism i's angle in turns of 120 degrees: whole numbers at rest.
function angle(S, i) {
  const sweep = S.wave * 6, step = S.S > 1 ? sweep / (S.S - 1) : 0, cyc = HOLD + TURN + sweep;
  const c = floor(S.T / cyc), tau = S.T - c * cyc - HOLD - i * step;
  const u = cl(tau / TURN, 0, 1);
  // The motor eases in and out, and the prism settles with a small overshoot.
  const e = u * u * (3 - 2 * u), o = tau > TURN ? 0.025 * sin(((tau - TURN) / 0.35) * PI) * max(0, 1 - (tau - TURN) / 0.7) : 0;
  return c + e + o;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.S = [8, 16, 32][cl(round(k[2] || 0), 0, 2)];
  S.wave = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  S.T += (cl(dt || 0, 0, 0.1) * speed) / 2;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const n = S.S, w = W / n, R = w / sqrt(3), flat = 0.32 + 0.68 * cos(LAMP);
  for (let i = 0; i < n; i++) S.phi[i] = angle(S, i);
  // Every quarter LED across: which face is nearest, where on its poster,
  // and how it is lit.
  for (let t = 0; t < WS; t++) {
    const x = (t + 0.5) / SS, i0 = floor(x / w);
    let best = -1e9;
    S.face[t] = -1;
    for (let i = max(0, i0 - 1); i <= min(n - 1, i0 + 1); i++) {
      const phi = S.phi[i], xc = (i + 0.5) * w, j0 = floor(phi);
      for (let j = j0 - 1; j <= j0 + 1; j++) {
        const psi = (phi - j) * 120 * DEG;
        if (cos(psi) <= 0) continue;
        const xa = xc + R * sin(psi - PI / 3), xb = xc + R * sin(psi + PI / 3);
        if (x < xa || x >= xb) continue;
        const u = (x - xa) / (xb - xa), z = R * cos(psi - PI / 3) + u * (R * cos(psi + PI / 3) - R * cos(psi - PI / 3));
        if (z <= best) continue;
        best = z;
        S.face[t] = ((j % 3) + 3) % 3;
        S.tex[t] = min(WS - 1, floor((i + u) * w * SS));
        // A dark seam where faces meet, half an LED wide (a quarter on 2-LED slats).
        const seam = min(u, 1 - u) * w < min(0.5, w / 8) ? 0.62 : 1;
        S.shade[t] = (seam * (0.32 + 0.68 * max(0, cos(psi - LAMP)))) / flat;
        S.glint[t] = 0.4 * pow(max(0, cos(psi - LAMP / 2)), 60);
      }
    }
  }
  const pal = POSTERS.map((P) => [hsv(S.hue + P.ink[0], P.ink[1], P.ink[2]), hsv(S.hue + P.ground[0], P.ground[1], P.ground[2])]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (let q = 0; q < SS; q++) {
        const t = x * SS + q, f = S.face[t];
        if (f < 0) continue;
        const c = S.cov[f][y * WS + S.tex[t]], [ink, gr] = pal[f], sh = S.shade[t], gl = S.glint[t];
        r += (gr[0] + (ink[0] - gr[0]) * c) * sh + gl;
        g += (gr[1] + (ink[1] - gr[1]) * c) * sh + gl;
        b += (gr[2] + (ink[2] - gr[2]) * c) * sh + gl;
      }
      display.setPixel(x, y, round(min(1, r / SS) * 255), round(min(1, g / SS) * 255), round(min(1, b / SS) * 255));
    }
}
