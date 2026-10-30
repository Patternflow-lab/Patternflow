// ===== Patternflow pattern =====
// Title:   Trajan Helix
// Family:  type
// Idea:    A marble column fills the height of the panel and turns slowly under a raking lamp while a helical band winds round it from foot to top, the way the frieze winds round Trajan's Column, but the band carries the column's own base inscription in Roman capitals cut and painted red, full width where the band faces you, squeezed thin toward the column's edges and gone behind it, so as the column turns and the view climbs the line slides along the helix and reads on without end, SENATVS POPVLVSQVE ROMANVS and on to SIT EGESTVS, while the band itself creeps slowly up like a barber's pole and the letters lost from the stone pass as a broken patch with their restoration ghosted in.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the base inscription of Trajan's Column (CIL VI 960, the column dedicated in AD 113 and attributed to Apollodorus of Damascus), the model of the Roman capital, with stroke weights after Edward Catich's flat-brush account in The Origin of the Serif (1968) and the red letters after Pliny's minium for inscriptions (Natural History 33.122); capitals drawn for this pattern as strokes, pattern round 74
// Round:   74
// ===============================
// @matrix 64x128
// @knobs Paint=0..1, Turn=0.2..3, Turns=5..9, Light=0..1
//
// Knob 1: Paint. The colour in the cut letters: at 0 minium, a vermilion red; 0.1 gold, 0.3 green, 0.6 blue, 0.8 purple, and back to red at 1. The marble stays marble and the lost letters stay bare.
// Knob 2: Turn. How fast the column turns: at 2 the front of the column moves 12 LEDs a second, a letter and two thirds, a full turn takes 13.1 s, the band creeps up half a pitch a turn (12.8 rows at the opening 5 turns) and the whole inscription, 172 letters and 34 stops, passes in 1 minute 53 s; at 0.2 a letter goes by every 6 s and the inscription takes 19 minutes, at 3 two and a half letters go by a second.
// Knob 3: Turns. How many turns of the band stand on the panel: 5 at the start, a pitch of 25.6 rows with 13.6 rows of plain marble between the turns; at 9 the pitch is 14.2 rows and the turns almost touch, 2.2 rows apart, so the panel is a screw of text as the real frieze is a screw of figures.
// Knob 4: Light. Where the lamp stands round the column, 30 degrees above it: at the opening 0.06 it rakes in from 57 degrees to the left, so the left of the shaft is lit, the right falls into shadow and every cut letter shows a lit wall and a dark one; at 0.5 the lamp is in front and the column goes flat; at 1 it rakes from 65 degrees to the right and the shading turns over.

// The column is a cylinder of radius 25 LEDs seen from far off, so the LED
// x across the shaft is R sin(beta) for the angle beta round from the front,
// and a stroke on the stone shrinks by cos(beta) as it turns toward the edge.
// The band is a helix: its top edge stands at Y0 - P beta / 2 pi, P the
// pitch, and the text coordinate along it is the arc R (beta - 2 pi m) for
// the m-th turn counted up from the panel's foot. Turning the column by phi
// slides the text along the band by R phi. Turning alone would make the
// band climb a whole pitch a turn, the barber's pole, and the panel would
// show the same stretch of stone for ever; so the view climbs too, half a
// pitch a turn, new stone and the next words come in at the top, and the
// band still creeps up by the other half. Every letter is fixed to the
// stone.
//
// The capitals are strokes (straight or elliptic arcs) in a box 8 LEDs tall.
// Their weights follow a flat brush held with its edge 20 degrees above the
// horizontal, Catich's account of how the letters were laid out before the
// cutting: uprights and down-right strokes come out thick (1.8 LEDs), the
// horizontals and down-left strokes thin (0.85), and the N's uprights are
// set thin by hand as on the stone. Each LED's coverage comes from its
// distance to the strokes, measured on the stone and turned into LEDs
// through the squeeze cos(beta), so letters thin out smoothly at the edges.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, sin, cos, asin, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
function hsv(h, s, v) {
  h = frac(h) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

const CX = 32, R = 25;
// The band: 12 rows, a shadowed seam on top, the letters 8 rows tall from
// row 2, a lit lip at the bottom.
const BAND = 12, CAP = 8, TOP = 2, Y0 = 118;
const HAIR = 0.85, THICK = 1.8, GAP = 1.7;
const ELEV = (30 * PI) / 180, FOLLOW = 0.5;

// ---- The capitals, in units of the cap height, y down. ["l", x0, y0, x1,
// y1, wt] a straight stroke, ["a", cx, cy, rx, ry, from, to, wt] an
// elliptic arc between two angles in degrees (0 right, 90 down), ["d", x,
// y] the stop between words. wt left out takes the brush's weight for the
// stroke's direction; 0 is a hairline. Serifs are short hairlines at the
// ends of the stems. Only the 19 letters the inscription uses are drawn.
const s0 = (x, y, a = 0.11) => ["l", x - a, y, x + a, y, 0];
const GLYPHS = {
  A: [0.86, [["l", 0.43, 0, 0.05, 1], ["l", 0.43, 0, 0.82, 1], ["l", 0.21, 0.64, 0.66, 0.64, 0], s0(0.05, 1), s0(0.82, 1)]],
  B: [0.58, [["l", 0.1, 0, 0.1, 1], ["l", 0.1, 0, 0.32, 0, 0], ["a", 0.32, 0.24, 0.2, 0.24, -90, 90], ["l", 0.1, 0.48, 0.34, 0.48, 0],
    ["a", 0.34, 0.74, 0.22, 0.26, -90, 90], ["l", 0.1, 1, 0.34, 1, 0], s0(0.04, 0, 0.06), s0(0.04, 1, 0.06)]],
  C: [0.82, [["a", 0.46, 0.5, 0.44, 0.5, -48, -312], ["l", 0.76, 0.06, 0.76, 0.2, 0]]],
  D: [0.88, [["l", 0.1, 0, 0.1, 1], ["l", 0.1, 0, 0.42, 0, 0], ["l", 0.1, 1, 0.42, 1, 0], ["a", 0.42, 0.5, 0.42, 0.5, -90, 90], s0(0.04, 0, 0.06), s0(0.04, 1, 0.06)]],
  E: [0.5, [["l", 0.1, 0, 0.1, 1], ["l", 0.1, 0, 0.47, 0, 0], ["l", 0.1, 0.5, 0.42, 0.5, 0], ["l", 0.1, 1, 0.5, 1, 0],
    ["l", 0.47, 0, 0.47, 0.12, 0], ["l", 0.5, 1, 0.5, 0.86, 0], s0(0.04, 0, 0.06), s0(0.04, 1, 0.06)]],
  F: [0.5, [["l", 0.1, 0, 0.1, 1], ["l", 0.1, 0, 0.48, 0, 0], ["l", 0.1, 0.5, 0.42, 0.5, 0], ["l", 0.48, 0, 0.48, 0.12, 0], s0(0.04, 0, 0.06), s0(0.12, 1, 0.14)]],
  G: [0.86, [["a", 0.46, 0.5, 0.44, 0.5, -48, -340], ["l", 0.84, 0.56, 0.84, 0.96], ["l", 0.76, 0.06, 0.76, 0.2, 0]]],
  I: [0.24, [["l", 0.12, 0, 0.12, 1], s0(0.12, 0), s0(0.12, 1)]],
  L: [0.5, [["l", 0.1, 0, 0.1, 1], ["l", 0.1, 1, 0.5, 1, 0], ["l", 0.5, 1, 0.5, 0.86, 0], s0(0.12, 0, 0.14), s0(0.04, 1, 0.06)]],
  M: [1.0, [["l", 0.15, 0, 0.05, 1], ["l", 0.15, 0, 0.5, 1], ["l", 0.85, 0, 0.5, 1], ["l", 0.85, 0, 0.95, 1], s0(0.05, 1), s0(0.95, 1)]],
  N: [0.82, [["l", 0.08, 0, 0.08, 1, 0], ["l", 0.74, 0, 0.74, 1, 0], ["l", 0.08, 0, 0.74, 1], s0(0.08, 1), s0(0.74, 0)]],
  O: [0.94, [["a", 0.47, 0.5, 0.46, 0.5, 0, 360]]],
  P: [0.56, [["l", 0.1, 0, 0.1, 1], ["l", 0.1, 0, 0.32, 0, 0], ["a", 0.32, 0.26, 0.22, 0.26, -90, 90], ["l", 0.1, 0.52, 0.32, 0.52, 0], s0(0.04, 0, 0.06), s0(0.12, 1, 0.14)]],
  Q: [0.94, [["a", 0.47, 0.5, 0.46, 0.5, 0, 360], ["l", 0.52, 0.94, 1.1, 1.1]]],
  R: [0.66, [["l", 0.1, 0, 0.1, 1], ["l", 0.1, 0, 0.32, 0, 0], ["a", 0.32, 0.25, 0.22, 0.25, -90, 90], ["l", 0.1, 0.5, 0.32, 0.5, 0],
    ["l", 0.3, 0.5, 0.62, 1], s0(0.04, 0, 0.06), s0(0.12, 1, 0.14), s0(0.66, 1, 0.06)]],
  S: [0.5, [["l", 0.44, 0.06, 0.44, 0.18, 0], ["a", 0.26, 0.25, 0.2, 0.25, -30, -270], ["a", 0.24, 0.75, 0.22, 0.25, -90, 90], ["l", 0.06, 0.82, 0.06, 0.94, 0]]],
  T: [0.72, [["l", 0, 0, 0.72, 0, 0], ["l", 0.36, 0, 0.36, 1], ["l", 0, 0, 0, 0.12, 0], ["l", 0.72, 0, 0.72, 0.12, 0], s0(0.36, 1, 0.14)]],
  V: [0.84, [["l", 0.04, 0, 0.42, 1], ["l", 0.8, 0, 0.42, 1], s0(0.04, 0), s0(0.8, 0)]],
  X: [0.74, [["l", 0.06, 0, 0.68, 1], ["l", 0.66, 0, 0.08, 1], s0(0.06, 0), s0(0.66, 0), s0(0.08, 1), s0(0.68, 1)]],
  "·": [0.2, [["d", 0.1, 0.55]]],
};

// The inscription, its six lines run together, stops between the words as
// on the stone. Square brackets mark the letters lost with a piece of the
// last line, read here TANT[IS OPER]IBVS; editions differ by a letter at
// either end of the gap (TAN[TIS OPE]RIBVS in one).
const TEXT =
  "SENATVS·POPVLVSQVE·ROMANVS·IMP·CAESARI·DIVI·NERVAE·F·NERVAE·TRAIANO·AVG·GERM·DACICO·PONTIF·MAXIMO·TRIB·POT·XVII·IMP·VI·COS·VI·P·P·" +
  "AD·DECLARANDVM·QVANTAE·ALTITVDINIS·MONS·ET·LOCVS·TANT[IS·OPER]IBVS·SIT·EGESTVS";

// The brush: weight 1 for an upright, about 0.95 down-right, 0.13
// down-left, 0 across.
const NIB = (-20 * PI) / 180;
const brush = (dx, dy) => cl((abs(sin(atan2(dy, dx) - NIB)) - 0.34) / 0.6, 0, 1);

// Each glyph as segments in LEDs: x0, y0, x1, y1, half width.
function build(parts) {
  const seg = [];
  const push = (x0, y0, x1, y1, wt) => {
    const w = wt == null ? brush(x1 - x0, y1 - y0) : wt;
    seg.push(x0 * CAP, y0 * CAP, x1 * CAP, y1 * CAP, (HAIR + (THICK - HAIR) * w) / 2);
  };
  for (const p of parts) {
    if (p[0] === "l") push(p[1], p[2], p[3], p[4], p[5]);
    else if (p[0] === "d") seg.push(p[1] * CAP, p[2] * CAP, p[1] * CAP, p[2] * CAP, 0.7);
    else {
      const [, cx, cy, rx, ry, a0, a1, wt] = p, n = max(3, round(abs(a1 - a0) / 20));
      for (let i = 0; i < n; i++) {
        const t0 = ((a0 + ((a1 - a0) * i) / n) * PI) / 180, t1 = ((a0 + ((a1 - a0) * (i + 1)) / n) * PI) / 180;
        push(cx + rx * cos(t0), cy + ry * sin(t0), cx + rx * cos(t1), cy + ry * sin(t1), wt);
      }
    }
  }
  return new Float32Array(seg);
}

// Lay the text out along the band: each letter's start, width, segments and
// whether it is lost. A wider gap closes the round before it starts again.
function layout() {
  const shapes = {};
  for (const ch in GLYPHS) shapes[ch] = build(GLYPHS[ch][1]);
  const letters = [];
  let x = 0, lost = false;
  for (const ch of TEXT) {
    if (ch === "[" || ch === "]") {
      lost = ch === "[";
      continue;
    }
    const w = GLYPHS[ch][0] * CAP;
    letters.push({ x, w, seg: shapes[ch], lost });
    x += w + GAP;
  }
  const len = x + 14;
  // at[i]: the first letter whose right edge passes arc i, for a quick find.
  const at = new Int16Array(floor(len) + 1);
  for (let i = 0, k = 0; i <= floor(len); i++) {
    while (k < letters.length && letters[k].x + letters[k].w < i) k++;
    at[i] = min(k, letters.length - 1);
  }
  // The lost stretch, a little wider than its letters.
  let lost0 = Infinity, lost1 = -Infinity;
  for (const g of letters) if (g.lost) (lost0 = min(lost0, g.x - 1.2)), (lost1 = max(lost1, g.x + g.w + 1.2));
  return { letters, len, at, lost0, lost1 };
}

// Marble: a vein field on the stone, 160 columns round by 256 rows,
// periodic both ways, from wrapped value noise and a sine through it.
const TW = 160, TH = 256;
function marble() {
  const tex = new Float32Array(TW * TH);
  const oct = [[10, 16, 1], [20, 32, 0.5], [40, 64, 0.25]].map(([nx, ny, a]) => {
    const g = new Float32Array(nx * ny);
    for (let i = 0; i < g.length; i++) g[i] = Math.random();
    return { nx, ny, a, g };
  });
  const sm = (u) => u * u * (3 - 2 * u);
  for (let y = 0; y < TH; y++)
    for (let x = 0; x < TW; x++) {
      let n = 0;
      for (const o of oct) {
        const fx = (x / TW) * o.nx, fy = (y / TH) * o.ny, ix = floor(fx), iy = floor(fy), ux = sm(fx - ix), uy = sm(fy - iy);
        const a = o.g[(iy % o.ny) * o.nx + (ix % o.nx)], b = o.g[(iy % o.ny) * o.nx + ((ix + 1) % o.nx)];
        const c = o.g[((iy + 1) % o.ny) * o.nx + (ix % o.nx)], d = o.g[((iy + 1) % o.ny) * o.nx + ((ix + 1) % o.nx)];
        n += o.a * (a + (b - a) * ux + (c - a + (d - c - b + a) * ux) * uy);
      }
      const m = abs(sin(TAU * (2 * x / TW + y / TH) + 5 * n));
      tex[y * TW + x] = (1 - m) ** 6 * 0.55 + n * 0.12;
    }
  return tex;
}

export function setup(params) {
  const L = layout();
  params.s = { L, tex: marble(), phi: 0, shift: 0, band: 0, climb: 0, paint: 0, turn: 2, turns: 5, light: 0.06, rough: new Float32Array(64) };
  for (let i = 0; i < 64; i++) params.s.rough[i] = Math.random();
  return params.s;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 5, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  s.paint = cl(k[0] || 0, 0, 1);
  s.turn = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  s.turns = cl(k[2] == null ? 5 : k[2], 5, 9);
  s.light = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  // 6 LEDs a second of arc at the front for each unit of Turn. The turn
  // slides the text along the band; the view climbs FOLLOW of the band's
  // rise, so the band itself creeps up the rest, a barber pole slowed down.
  const dphi = (6 * s.turn * dt) / R, P = H / s.turns;
  s.phi = (s.phi + dphi) % TAU;
  s.shift = (s.shift + R * dphi) % s.L.len;
  s.band += ((1 - FOLLOW) * P * dphi) / TAU;
  s.climb = (s.climb + (FOLLOW * P * dphi) / TAU) % TH;
}

// Coverage of the letters at one LED: (u, v) its place on the band in LEDs,
// sq the squeeze cos(beta). Returns coverage and the outward direction of
// the nearest stroke edge (for the walls of the cut) in out.
function ink(L, u, v, sq, out) {
  const { letters, at } = L;
  const pad = 2 / sq + 1;
  let best = 0, nx = 0, ny = 0;
  const i0 = at[cl(floor(u - pad), 0, at.length - 1)], i1 = at[cl(floor(u + pad), 0, at.length - 1)];
  for (let i = i0; i <= i1; i++) {
    const g = letters[i], seg = g.seg, lu = u - g.x, lv = v;
    for (let j = 0; j < seg.length; j += 5) {
      const ax = seg[j], ay = seg[j + 1], bx = seg[j + 2] - ax, by = seg[j + 3] - ay, hw = seg[j + 4];
      const bb = bx * bx + by * by, t = bb > 0 ? cl(((lu - ax) * bx + (lv - ay) * by) / bb, 0, 1) : 0;
      let dx = lu - ax - t * bx, dy = lv - ay - t * by;
      const d = sqrt(dx * dx + dy * dy);
      if (d - hw > pad) continue;
      if (d > 1e-4) (dx /= d), (dy /= d);
      else (dx = 0), (dy = 0);
      // The gradient of the distance in LEDs on the panel: across the
      // squeeze an arc step is sq LEDs wide.
      const gx = dx / sq, gl = sqrt(gx * gx + dy * dy) || 1;
      const c = min(0.5 - (d - hw) / gl, (2 * hw) / gl, 1);
      if (c > best) (best = c), (nx = dx), (ny = dy), (out[2] = g.lost ? 1 : 0), (out[3] = d / hw);
    }
  }
  out[0] = nx;
  out[1] = ny;
  return best;
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  const L = s.L, tex = s.tex, P = H / s.turns, phi = s.phi;
  const al = ((-65 + 130 * s.light) * PI) / 180, ce = cos(ELEV), se = sin(ELEV);
  // The light and the half vector for a little sheen.
  const lx = sin(al) * ce, lz = cos(al) * ce, hx = lx, hy = -se, hz = lz + 1, hl = sqrt(hx * hx + hy * hy + hz * hz);
  const paint = hsv(0.02 + s.paint, 0.86, 1);
  const out = [0, 0, 0, 0];
  const climb = s.climb, band = s.band, shift = s.shift;
  for (let x = 0; x < W; x++) {
    const sx = (x + 0.5 - CX) / R, edge = cl(R - abs(x + 0.5 - CX) + 0.5, 0, 1);
    const beta = asin(cl(sx, -1, 1)), sq = max(0.05, cos(beta));
    const nX = sin(beta), nZ = cos(beta);
    const lam = max(0, nX * lx + nZ * lz), spec = max(0, (nX * hx + nZ * hz) / hl) ** 30;
    const shade = 0.13 + 0.92 * lam;
    // The lamp's pull along the surface, for the walls of the cuts.
    const tu = sin(al - beta) * ce, tv = -se;
    const us = frac((beta + phi) / TAU) * TW;
    const qb = (P * beta) / TAU + band;
    for (let y = 0; y < H; y++) {
      const sb = 14 + (y / H) * 8;
      if (edge <= 0) {
        display.setPixel(x, y, 5, 7, round(sb));
        continue;
      }
      // The stone under this LED.
      const ys = y - climb, vy = ((floor(ys) % TH) + TH) % TH;
      const vein = tex[vy * TW + (floor(us) % TW)];
      let r = 236 - 70 * vein, gr = 230 - 66 * vein, b = 218 - 50 * vein;
      // Which turn of the band, and where in it.
      const q = y + 0.5 - Y0 + qb, m = floor(q / P), v = q - m * P;
      let k = shade, lr = 0, lg = 0, lb = 0, c = 0;
      if (v < BAND) {
        // The band is a shallow sunk ribbon: shadow under its top edge, a
        // lit lip at its foot.
        k *= v < 1 ? 0.5 + 0.2 * (1 - se) : v >= BAND - 1 ? 1.18 : 0.86;
        let u = R * (beta - TAU * m) + shift;
        u = ((u % L.len) + L.len) % L.len;
        // The broken patch where the piece is lost: rough, darker stone.
        if (u > L.lost0 && u < L.lost1) k *= 0.5 + 0.22 * s.rough[(floor(u * 0.7) + 7 * floor(v * 0.6)) & 63];
        c = ink(L, u, v - TOP, sq, out);
        if (c > 0) {
          // A wall of the cut facing the lamp is lit, the one facing away
          // dark; the stroke's middle is the floor of the V. A lost letter
          // is only the restorer's pale outline on the broken patch.
          const kk = shade * (1 - 0.55 * (out[0] * tu + out[1] * tv) * cl(out[3], 0, 1));
          if (out[2]) (lr = r * 1.05 * shade), (lg = gr * 1.05 * shade), (lb = b * 1.08 * shade), (c *= 0.75);
          else (lr = 255 * paint[0] * kk), (lg = 255 * paint[1] * kk), (lb = 255 * paint[2] * kk);
        }
      }
      r = r * k + 120 * spec;
      gr = gr * k + 118 * spec;
      b = b * k + 112 * spec;
      if (c > 0) (r += (lr - r) * c), (gr += (lg - gr) * c), (b += (lb - b) * c);
      const sky = 1 - edge;
      display.setPixel(x, y, round(cl(r * edge + 5 * sky, 0, 255)), round(cl(gr * edge + 7 * sky, 0, 255)), round(cl(b * edge + sb * sky, 0, 255)));
    }
  }
}
