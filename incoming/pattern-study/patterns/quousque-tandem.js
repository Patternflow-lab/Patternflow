// ===== Patternflow pattern =====
// Title:   Quousque Tandem
// Family:  type
// Idea:    The opening line of Cicero's first speech against Catiline, the line Caslon's specimen sets in size after size, runs down the standing panel left aligned in a broad-nib roman, every other line leaning like the specimen's italic and each line a fixed fraction of the size of the one above, so the top lines read and the bottom closes up into a soft grey of type smaller than an LED, while the page zooms without end into its bottom left corner and every line grows into the size of the line above.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: William Caslon's specimen sheet dated 1734, its roman and italic in 14 sizes among 38 founts (Talbot Baines Reed's count, A History of the Old English Letter Foundries, 1887), which sets "Quousque tandem abutere, Catilina, patientia nostra?" from Cicero's first speech against Catiline (63 BC); the face here is drawn new with a broad nib, pattern round 70
// Round:   70
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Ratio=0.7..0.9, Weight=0..1
//
// Knob 1: Hue. Turns the paper round the wheel with a near-black ink opposite it: cream paper (235, 216, 169) and a blue-black ink at 0, mint paper and a plum-black at 0.25, pale blue and a brown-black at 0.5, pink and a green-black at 0.75.
// Knob 2: Speed. At 2 every line takes 2.5 s to grow into the line above, the page zooming 1.43 times at the opening ratio; 25 s at 0.2 and 1.7 s at 3. Roman and leaning lines swap places every period, so the picture comes round every two.
// Knob 3: Ratio. Each line's size over the size of the line above. At the opening 0.7 the top line is 38 rows tall with capitals 24 LEDs high, 8 lines have capitals over 1.5 LEDs and the last 7 rows are the grey; at 0.8 the top line's capitals are 16 LEDs and 11 lines read; at 0.9 the capitals start at 8 LEDs, 17 lines read and the grey takes the last 21 rows.
// Knob 4: Weight. The width of the nib: 0.089 em at the opening 0.06, where a stem is a tenth of an em, 3.5 LEDs in the top line; 0.083 em at 0 and 0.18 em at 1, where the letters go black, the counters close and the grey at the bottom darkens with them.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, sqrt, sin, cos, log, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// ---- The face. Each letter is a skeleton in em units, y up from the
// baseline, x from the letter's left edge, written with a broad nib held at
// 30 degrees, so a stroke is thick across the nib and a hairline along it:
// the slanted stress of an old-style roman, thin at eleven and five o'clock
// in the o. Serifs and bars take a narrower nib (the number after a stroke).
// Only the 19 letters and marks of the line are drawn.
const XH = 0.45, ASC = 0.74, DSC = 0.24, CAP = 0.665;
function arc(cx, cy, rx, ry, a0, a1, n) {
  const out = [];
  n = n || max(6, ceil(abs(a1 - a0) / 9));
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * PI) / 180;
    out.push(cx + rx * cos(a), cy + ry * sin(a));
  }
  return out;
}
const S = 0.4;
const GLYPHS = {
  " ": [0.26],
  o: [0.5, [arc(0.25, 0.225, 0.17, 0.215, 0, 360)]],
  e: [0.45, [[0.08, 0.25, 0.4, 0.25], 0.6], [arc(0.235, 0.225, 0.16, 0.215, 8, 325)]],
  a: [0.46, [[0.37, 0.06, ...arc(0.22, 0.3, 0.15, 0.13, 0, 145), 0.1, 0.34]], [[0.37, 0.26, ...arc(0.22, 0.13, 0.15, 0.13, 90, 300), 0.37, 0.08]], [[0.37, 0.06, 0.4, 0, 0.46, 0.02], S]],
  n: [0.54, [[0.1, 0, 0.1, XH]], [[0.1, 0.33, ...arc(0.27, 0.29, 0.17, 0.15, 150, 0), 0.44, 0]], [[0.02, 0, 0.18, 0], S], [[0.36, 0, 0.52, 0], S], [[0.02, 0.42, 0.1, XH], S]],
  m: [0.82, [[0.1, 0, 0.1, XH]], [[0.1, 0.33, ...arc(0.255, 0.29, 0.155, 0.15, 150, 0), 0.41, 0]], [[0.41, 0.33, ...arc(0.565, 0.29, 0.155, 0.15, 150, 0), 0.72, 0]],
    [[0.02, 0, 0.18, 0], S], [[0.33, 0, 0.49, 0], S], [[0.64, 0, 0.8, 0], S], [[0.02, 0.42, 0.1, XH], S]],
  u: [0.54, [[0.1, XH, ...arc(0.27, 0.16, 0.17, 0.16, 180, 360)]], [[0.44, XH, 0.44, 0]], [[0.44, 0, 0.52, 0], S], [[0.02, 0.42, 0.1, XH], S], [[0.36, 0.42, 0.44, XH], S]],
  i: [0.28, [[0.13, 0, 0.13, XH]], [[0.04, 0, 0.22, 0], S], [[0.05, 0.42, 0.13, XH], S], [[0.12, 0.6, 0.145, 0.635]]],
  l: [0.28, [[0.13, 0, 0.13, 0.72]], [[0.04, 0, 0.22, 0], S], [[0.05, 0.69, 0.13, 0.72], S]],
  t: [0.32, [[0.12, 0.58, 0.12, 0.08, 0.15, 0.01, 0.22, 0, 0.29, 0.04]], [[0.02, 0.43, 0.27, 0.43], 0.6]],
  d: [0.54, [[0.44, 0.37, ...arc(0.25, 0.225, 0.165, 0.215, 60, 300), 0.44, 0.07]], [[0.44, 0.72, 0.44, 0]], [[0.36, 0.69, 0.44, 0.72], S], [[0.44, 0, 0.52, 0], S]],
  b: [0.54, [[0.1, 0.72, 0.1, 0]], [arc(0.29, 0.225, 0.16, 0.215, 120, -120)], [[0.02, 0.69, 0.1, 0.72], S]],
  p: [0.54, [[0.1, XH, 0.1, -0.22]], [arc(0.29, 0.225, 0.16, 0.215, 120, -120)], [[0.02, 0.42, 0.1, XH], S], [[0.02, -0.22, 0.18, -0.22], S]],
  q: [0.54, [[0.44, 0.37, ...arc(0.25, 0.225, 0.165, 0.215, 60, 300), 0.44, 0.07]], [[0.44, XH, 0.44, -0.22]], [[0.36, -0.22, 0.52, -0.22], S]],
  r: [0.38, [[0.1, 0, 0.1, XH]], [[0.1, 0.32, 0.15, 0.4, 0.22, 0.445, 0.3, 0.45, 0.35, 0.42]], [[0.02, 0, 0.2, 0], S], [[0.02, 0.42, 0.1, XH], S]],
  s: [0.4, [[...arc(0.2, 0.34, 0.12, 0.105, 15, 250), ...arc(0.2, 0.115, 0.135, 0.115, 90, -165)]]],
  Q: [0.76, [arc(0.38, 0.33, 0.29, 0.335, 0, 360)], [[0.33, 0.02, 0.45, -0.06, 0.6, -0.13, 0.74, -0.16], 0.9]],
  C: [0.68, [arc(0.38, 0.33, 0.28, 0.335, 42, 318)], [[0.585, 0.55, 0.6, 0.66], S]],
  ",": [0.24, [[0.1, 0.05, 0.09, -0.02, 0.05, -0.12]], [[0.08, 0.06, 0.11, 0.03]]],
  "?": [0.42, [[...arc(0.21, 0.53, 0.13, 0.13, 160, -60), 0.21, 0.33, 0.21, 0.2]], [[0.2, 0.02, 0.225, 0.05]]],
};
const LINE = "Quousque tandem abutere, Catilina, patientia nostra? ";

// ---- The strip: the line set once at E texels to the em, each texel an
// ink count of 0..16 from a 4 by 4 supersample, kept as a summed-area table
// two periods long. The ink over any box of the line, at any size, is then
// four lookups, so a line a tenth of an LED high is as exact as a big one.
const E = 40, SS = 4, SH = Math.round((ASC + DSC) * E), BASE = ASC * E, K = E * SS;
const NIB = 0.088, NIB_A = (30 * PI) / 180, HAIR = 0.009, PAD = 0.08;
const DX = cos(NIB_A), DY = sin(NIB_A);

// One letter at the 4x supersample, the nib stamped every eighth of a texel along
// each stroke: a bar nib long and two hairlines wide, laid at 30 degrees.
function glyphTile(ch, nib, hair) {
  const g = GLYPHS[ch], TW = ceil((g[0] + 2 * PAD) * K), TH = SH * SS;
  const t = new Uint8Array(TW * TH);
  const stamp = (px, py, n) => {
    const ex = DX * n + hair, ey = DY * n + hair;
    const i0 = max(0, floor((px - ex + PAD) * K)), i1 = min(TW - 1, ceil((px + ex + PAD) * K));
    const j0 = max(0, floor((ASC - py - ey) * K)), j1 = min(TH - 1, ceil((ASC - py + ey) * K));
    for (let j = j0; j <= j1; j++) {
      const qy = ASC - (j + 0.5) / K - py;
      for (let i = i0; i <= i1; i++) {
        const qx = (i + 0.5) / K - PAD - px;
        if (abs(qx * DX + qy * DY) <= n && abs(qx * DY - qy * DX) <= hair) t[j * TW + i] = 1;
      }
    }
  };
  for (let s = 1; s < g.length; s++) {
    const pts = g[s][0], n = (nib / 2) * (g[s][1] || 1);
    for (let p = 0; p + 3 < pts.length; p += 2) {
      const ax = pts[p], ay = pts[p + 1], bx = pts[p + 2], by = pts[p + 3];
      const steps = max(1, ceil(sqrt((bx - ax) ** 2 + (by - ay) ** 2) * K * 2));
      for (let q = 0; q <= steps; q++) stamp(ax + ((bx - ax) * q) / steps, ay + ((by - ay) * q) / steps, n);
    }
  }
  return { t, TW };
}

function buildStrip(weight) {
  const nib = NIB * (0.94 + 1.1 * weight), hair = HAIR * (0.9 + 0.8 * weight);
  let adv = 0;
  const xs = [];
  for (const ch of LINE) xs.push(adv), (adv += GLYPHS[ch][0]);
  const P = round(adv * E), HW = P * SS, HH = SH * SS, hi = new Uint8Array(HW * HH), tiles = {};
  LINE.split("").forEach((ch, c) => {
    if (ch === " ") return;
    const { t, TW } = tiles[ch] || (tiles[ch] = glyphTile(ch, nib, hair));
    const o = round((xs[c] - PAD) * K);
    for (let j = 0; j < HH; j++)
      for (let i = 0; i < TW; i++) if (t[j * TW + i]) hi[j * HW + ((o + i + HW) % HW)] = 1;
  });
  const SW = 2 * P, SW1 = SW + 1, sat = new Int32Array((SH + 1) * SW1);
  for (let r = 0; r < SH; r++) {
    let run = 0;
    for (let c = 0; c < SW; c++) {
      const cc = c % P;
      let n = 0;
      for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) n += hi[(r * SS + j) * HW + cc * SS + i];
      run += n;
      sat[(r + 1) * SW1 + c + 1] = sat[r * SW1 + c + 1] + run;
    }
  }
  return { P, SW, sat };
}

// The ink above row v and left of column u, bilinear between the corners,
// which is the exact area integral of ink that is constant over a texel.
function satAt(st, u, v) {
  const SW1 = st.SW + 1, sat = st.sat;
  let iu = floor(u), iv = floor(v), fu = u - iu, fv = v - iv;
  if (iu >= st.SW) (iu = st.SW - 1), (fu = 1);
  if (iv >= SH) (iv = SH - 1), (fv = 1);
  const o = iv * SW1 + iu, a = sat[o], b = sat[o + 1], c = sat[o + SW1], d = sat[o + SW1 + 1];
  return (a + (b - a) * fu) * (1 - fv) + (c + (d - c) * fu) * fv;
}

// ---- The sheet. Line v (v = 0 the top line) fills rows 128 (1 - r^v) to
// 128 (1 - r^(v+1)), its em that height over LEAD, its left edge 0.06 em in.
// That is the picture of one page scaled by r about its bottom left corner
// again and again, so moving every v down by one over a period zooms the
// page by 1/r and each line takes the place and size of the line above.
const LEAD = 1.05, PERIOD = 2.5;
// The grain: a checker of LEDs G levels lighter and darker over the whole
// sheet, eased off where a soft step of the ink's own is already there so
// the two never add up past a step of 40.
const G = 19.5, HARD = 60;

export function setup(params) {
  params.s = {
    t: 0, w: -1, st: null, cache: {}, hue: 0, ratio: 0.7,
    cov: new Float32Array(W * H), emRow: new Float32Array(H), F: new Float32Array(W + 1),
    pc: [0, 0, 0], ic: [0, 0, 0],
  };
  return params.s;
}

export function update(dt, input, params) {
  const S0 = params.s || setup(params);
  const kv = input.knobValues || [0, 2, 0.7, 0.06], d = cl(dt || 0, 0, 0.1);
  S0.hue = kv[0] || 0;
  const speed = cl(kv[1] ?? 2, 0.2, 3);
  S0.ratio = cl(kv[2] ?? 0.7, 0.7, 0.9);
  // The weight in sixteenths. A strip takes about 40 ms to build, so the
  // last few are kept while the knob turns.
  const w = round(cl(kv[3] ?? 0.06, 0, 1) * 16) / 16;
  if (w !== S0.w) {
    if (!S0.cache[w] && Object.keys(S0.cache).length >= 6) S0.cache = {};
    S0.w = w;
    S0.st = S0.cache[w] || (S0.cache[w] = buildStrip(w));
  }
  S0.t += (d * speed) / 2;
}

export function draw(display, params) {
  const S0 = params.s;
  if (!S0 || !S0.st) return;
  const st = S0.st, cov = S0.cov, emRow = S0.emRow, F = S0.F, P = st.P;
  cov.fill(0);
  emRow.fill(0);
  const lr = log(S0.ratio), cyc = S0.t / PERIOD, ph = cyc % 1, n0 = floor(cyc);
  const Y = (v) => H - H * exp(v * lr);
  for (let k = 0; k < 200; k++) {
    const v = k - ph, top = Y(v), bot = Y(v + 1);
    if (H - top < 0.04) break;
    if (bot <= 0) continue;
    const em = (bot - top) / LEAD, y0 = top + ((LEAD - 1) / 2) * em, sc = E / em, xl = 0.06 * em;
    for (let y = max(0, floor(top)); y < min(H, ceil(bot)); y++) {
      const va = cl((y - y0) * sc, 0, SH), vb = cl((y + 1 - y0) * sc, 0, SH);
      if (vb <= va) continue;
      if (em > emRow[y]) emRow[y] = em;
      // Every other line leans 12 degrees for the italic: a texel row h
      // above the baseline is read 0.21 h further left.
      const sl = (k + n0) & 1 ? 0.21 * (BASE - (va + vb) / 2) : 0;
      for (let x = 0; x <= W; x++) F[x] = max(0, (x - xl) * sc - sl);
      for (let x = 0, o = y * W; x < W; x++) {
        let u0 = F[x], u1 = F[x + 1];
        if (u1 <= u0) continue;
        const wrap = floor(u0 / P) * P;
        u0 -= wrap;
        u1 -= wrap;
        cov[o + x] += (satAt(st, u1, vb) - satAt(st, u0, vb) - satAt(st, u1, va) + satAt(st, u0, va)) / (16 * sc * sc);
      }
    }
  }
  // Type over 4 LEDs to the cap is drawn crisp, its coverage pushed toward
  // ink or paper with a soft edge a quarter of an LED wide; under 1.5 LEDs
  // it keeps its exact area, the grey of the small sizes.
  for (let y = 0; y < H; y++) {
    const m = 1 + 3 * cl((emRow[y] * CAP - 1.5) / 2.5, 0, 1);
    for (let x = 0, o = y * W; x < W; x++) cov[o + x] = cl((min(1, cov[o + x]) - 0.5) * m + 0.5, 0, 1);
  }
  const pc = hsv(0.12 + S0.hue, 0.28, 0.92, S0.pc), ic = hsv(0.62 + S0.hue, 0.85, 0.075, S0.ic);
  const con = 255 * (max(pc[0], pc[1], pc[2]) - max(ic[0], ic[1], ic[2])), hc = HARD / con;
  const p0 = 255 * pc[0], p1 = 255 * pc[1], p2 = 255 * pc[2];
  const d0 = 255 * ic[0] - p0, d1 = 255 * ic[1] - p1, d2 = 255 * ic[2] - p2;
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) {
      const c = cov[o];
      let gd = 0;
      const nb = (e) => (e = abs(c - e)) < hc && e > gd && (gd = e);
      if (x > 0) nb(cov[o - 1]);
      if (x < W - 1) nb(cov[o + 1]);
      if (y > 0) nb(cov[o - W]);
      if (y < H - 1) nb(cov[o + W]);
      const a = G * max(0, 1 - (gd * con) / (2 * G)), g = (x + y) & 1 ? a : -a;
      display.setPixel(x, y, cl(p0 + d0 * c + g, 0, 255) | 0, cl(p1 + d1 * c + g, 0, 255) | 0, cl(p2 + d2 * c + g, 0, 255) | 0);
    }
}
