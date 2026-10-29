// ===== Patternflow pattern =====
// Title:   Anamorphosis
// Family:  type
// Idea:    A word is painted across slabs, boxes and pillars floating at many depths, as if thrown on them by a projector at one point of view, and the camera swings round the cluster so the coloured fragments scatter and slide past one another, closing up into the word only in the moment it passes that point.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: anamorphic painting from one point of view (Hans Holbein the Younger, The Ambassadors, 1533; Felice Varini's wall paintings), pattern round 65
// Round:   65
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..4, Flatten=0..1
//
// Knob 1: Hue. Turns the letter colours round the wheel together. Each letter keeps its own colour, evenly spaced, so the letters of a word are as far apart in hue as they can be: at 0 HERE is sky blue, violet, orange and green.
// Knob 2: Speed. The camera flies a figure eight round the cluster, out to 52 degrees either side and 17 degrees up and down, and crosses the point of view at its middle. At 2 it crosses at 4 s and then every 8 s, slowing there to a quarter of its pace, so the word stands whole for about a second. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Word. HERE, NOW, LOOK, 여기 (here) and 지금 (now), stacked down the panel a letter or a syllable at a time.
// Knob 4: Flatten. At 0 the thirteen pieces of the first cut (eight slabs, four boxes and a pillar) stand from 5.4 to 14.6 units from the point of view, each scaled by its distance so it fills its own rectangle of the picture there, and every fragment slides its own way once the camera leaves. Turned up they gather onto one plane 10 units away, the middle of the cluster, and at 1 the word is a flat sign that reads, foreshortened, from anywhere.
// Buttons: K1 tap cuts the picture into a new set of pieces.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, sin, cos, PI, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const F = 116; // focal length in LEDs, the same for the camera and the point of view
const DV = 10; // the point of view V stands at (0, 0, DV) and looks down -z at the origin
const YF = -8.6; // the floor
const MW = 128, MH = 256; // the word is drawn into V's picture at twice the panel's resolution

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Glyphs as strokes in a unit box, y down: L a line, A an elliptic arc
// (centre, radii, start and end angle in degrees, clockwise on screen).
const GLYPHS = {
  H: [["L", 0, 0, 0, 1], ["L", 1, 0, 1, 1], ["L", 0, 0.5, 1, 0.5]],
  E: [["L", 0, 0, 0, 1], ["L", 0, 0, 1, 0], ["L", 0, 0.5, 0.82, 0.5], ["L", 0, 1, 1, 1]],
  R: [["L", 0, 0, 0, 1], ["L", 0, 0, 0.66, 0], ["A", 0.66, 0.27, 0.34, 0.27, -90, 90], ["L", 0, 0.54, 0.66, 0.54], ["L", 0.5, 0.54, 1, 1]],
  N: [["L", 0, 1, 0, 0], ["L", 0, 0, 1, 1], ["L", 1, 1, 1, 0]],
  O: [["A", 0.5, 0.5, 0.5, 0.5, 0, 360]],
  W: [["L", 0, 0, 0.22, 1], ["L", 0.22, 1, 0.5, 0.25], ["L", 0.5, 0.25, 0.78, 1], ["L", 0.78, 1, 1, 0]],
  L: [["L", 0, 0, 0, 1], ["L", 0, 1, 1, 1]],
  K: [["L", 0, 0, 0, 1], ["L", 1, 0, 0.08, 0.6], ["L", 0.36, 0.42, 1, 1]],
  // Hangul syllables drawn whole, each in a square box.
  "여": [["A", 0.27, 0.5, 0.25, 0.3, 0, 360], ["L", 0.86, 0, 0.86, 1], ["L", 0.6, 0.33, 0.86, 0.33], ["L", 0.6, 0.67, 0.86, 0.67]],
  "기": [["L", 0.02, 0.1, 0.56, 0.1], ["L", 0.56, 0.1, 0.5, 0.92], ["L", 0.88, 0, 0.88, 1]],
  "지": [["L", 0.04, 0.1, 0.62, 0.1], ["L", 0.36, 0.1, 0.04, 0.9], ["L", 0.36, 0.4, 0.64, 0.9], ["L", 0.9, 0, 0.9, 1]],
  "금": [["L", 0.12, 0, 0.86, 0], ["L", 0.86, 0, 0.86, 0.3], ["L", 0, 0.48, 1, 0.48], ["L", 0.16, 0.68, 0.84, 0.68], ["L", 0.16, 0.68, 0.16, 1], ["L", 0.84, 0.68, 0.84, 1], ["L", 0.16, 1, 0.84, 1]],
};
const WORDS = [["H", "E", "R", "E"], ["N", "O", "W"], ["L", "O", "O", "K"], ["여", "기"], ["지", "금"]];

function segDist(px, py, s) {
  const dx = s[2] - s[0], dy = s[3] - s[1], l = dx * dx + dy * dy;
  const t = l > 0 ? cl(((px - s[0]) * dx + (py - s[1]) * dy) / l, 0, 1) : 0;
  const ex = s[0] + t * dx - px, ey = s[1] + t * dy - py;
  return sqrt(ex * ex + ey * ey);
}

// The word in V's picture: coverage 0..1 and the letter each texel belongs to.
const hitS = new Uint8Array(MW * MH * 4);
function buildWord(wi) {
  const word = WORDS[wi], n = word.length, hangul = wi >= 3;
  const S = MW / W; // texels per LED
  const margin = 3, gap = hangul ? 5 : n === 4 ? 4 : 5;
  const ch = (H - 2 * margin - (n - 1) * gap) / n, cw = 60;
  const pen = hangul ? 7.4 : n === 4 ? 7.2 : 8.4;
  const mask = new Float32Array(MW * MH), id = new Uint8Array(MW * MH);
  for (let k = 0; k < n; k++) {
    const x0 = (W - cw) / 2, y0 = margin + k * (ch + gap), hw = pen / 2;
    const sx = cw - pen, sy = ch - pen;
    const segs = [];
    for (const st of GLYPHS[word[k]]) {
      const P = (u, v) => [(x0 + hw + u * sx) * S, (y0 + hw + v * sy) * S];
      if (st[0] === "L") segs.push([...P(st[1], st[2]), ...P(st[3], st[4])]);
      else {
        const [, cx, cy, rx, ry, a0, a1] = st, m = max(4, Math.ceil(abs(a1 - a0) / 10));
        for (let i = 0; i < m; i++) {
          const b0 = ((a0 + ((a1 - a0) * i) / m) * PI) / 180, b1 = ((a0 + ((a1 - a0) * (i + 1)) / m) * PI) / 180;
          segs.push([...P(cx + rx * cos(b0), cy + ry * sin(b0)), ...P(cx + rx * cos(b1), cy + ry * sin(b1))]);
        }
      }
    }
    // Each stroke marks the samples within half a pen of it, two by two to a
    // texel, then the texels count their marked samples.
    const r = hw * S, SW = MW * 2;
    const ty0 = max(0, floor((y0 - 1) * S)), ty1 = min(MH, Math.ceil((y0 + ch + 1) * S));
    hitS.fill(0, ty0 * 2 * SW, ty1 * 2 * SW);
    for (const sg of segs) {
      const xa = max(0, floor((min(sg[0], sg[2]) - r) * 2)), xb = min(SW - 1, Math.ceil((max(sg[0], sg[2]) + r) * 2));
      const ya = max(0, floor((min(sg[1], sg[3]) - r) * 2)), yb = min(MH * 2 - 1, Math.ceil((max(sg[1], sg[3]) + r) * 2));
      for (let y = ya; y <= yb; y++)
        for (let x = xa; x <= xb; x++) if (!hitS[y * SW + x] && segDist((x + 0.5) / 2, (y + 0.5) / 2, sg) <= r) hitS[y * SW + x] = 1;
    }
    for (let y = ty0; y < ty1; y++)
      for (let x = 0; x < MW; x++) {
        const o = y * 2 * SW + x * 2, hit = hitS[o] + hitS[o + 1] + hitS[o + SW] + hitS[o + SW + 1];
        if (hit) {
          mask[y * MW + x] = hit / 4;
          id[y * MW + x] = k;
        }
      }
  }
  return { mask, id, n };
}

// V's picture cut into rectangles, each the front face of one piece.
function cutCells(random) {
  const cells = [];
  const cut = (x0, y0, x1, y1, d) => {
    const w = x1 - x0, h = y1 - y0;
    if (d > 0 && (w * h < 700 || (w * h < 1300 && random() < 0.4) || d > 5)) {
      cells.push([x0, y0, x1, y1]);
      return;
    }
    const vert = h > 1.7 * w ? false : w > 1.4 * h ? true : random() < 0.5;
    const u = 0.32 + 0.36 * random();
    if (vert) {
      const xm = round(x0 + w * u);
      cut(x0, y0, xm, y1, d + 1);
      cut(xm, y0, x1, y1, d + 1);
    } else {
      const ym = round(y0 + h * u);
      cut(x0, y0, x1, ym, d + 1);
      cut(x0, ym, x1, y1, d + 1);
    }
  };
  cut(0, 0, W, H, 0);
  // Depths evenly spread, then shuffled, so near and far pieces mix.
  const n = cells.length, rank = [];
  for (let i = 0; i < n; i++) rank.push(-1 + (2 * (i + 0.5)) / n);
  for (let i = n - 1; i > 0; i--) {
    const j = floor(random() * (i + 1)), t = rank[i];
    rank[i] = rank[j];
    rank[j] = t;
  }
  return cells.map((c, i) => ({ c, r: rank[i], kind: c[3] - c[1] > 2.2 * (c[2] - c[0]) ? 2 : random() < 0.45 ? 0 : 1 }));
}

// World boxes from the cells for a given flatness: a piece at distance d
// from V is scaled by d so its front face fills its cell exactly from V.
function buildBoxes(S) {
  const spread = 0.5 * (1 - S.flat);
  S.boxes = S.cells.map(({ c, r, kind }) => {
    const d = DV * (1 + spread * r);
    const x0 = ((c[0] - 32) * d) / F, x1 = ((c[2] - 32) * d) / F;
    const y0 = ((64 - c[3]) * d) / F, y1 = ((64 - c[1]) * d) / F;
    const zf = DV - d, w = x1 - x0, h = y1 - y0;
    // 0 a slab, 1 a box as deep as its short side, 2 a pillar as deep as it is wide.
    const th = kind === 0 ? 0.14 : kind === 1 ? min(w, h) : w;
    return [x0, y0, zf - th, x1, y1, zf];
  });
  S.vr = new Float32Array(S.boxes.length * 4);
  S.cr = new Float32Array(S.boxes.length * 4);
  rects(S.boxes, 0, 0, DV, [0, 0, -1], [1, 0, 0], [0, 1, 0], S.vr);
}

// Each box's bounding rectangle on the screen of a camera, so a ray only
// tests the boxes whose rectangle holds its LED.
function rects(boxes, ox, oy, oz, fw, rt, up, out) {
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let c = 0; c < 8; c++) {
      const X = b[c & 1 ? 3 : 0] - ox, Y = b[c & 2 ? 4 : 1] - oy, Z = b[c & 4 ? 5 : 2] - oz;
      const z = X * fw[0] + Y * fw[1] + Z * fw[2];
      if (z < 0.05) { x0 = y0 = -1e9; x1 = y1 = 1e9; break; }
      const sx = 32 + (F * (X * rt[0] + Y * rt[1] + Z * rt[2])) / z, sy = 64 - (F * (X * up[0] + Y * up[1] + Z * up[2])) / z;
      x0 = min(x0, sx); x1 = max(x1, sx); y0 = min(y0, sy); y1 = max(y1, sy);
    }
    out[i * 4] = x0 - 1; out[i * 4 + 1] = x1 + 1; out[i * 4 + 2] = y0 - 1; out[i * 4 + 3] = y1 + 1;
  }
}

// A fixed generator, so the pieces stand where they were looked at; a K1 tap
// gives it a new seed.
function generator(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED = 7;

export function setup(params) {
  params.s = {
    cells: cutCells(generator(SEED)), boxes: [], vr: null, cr: null, flat: -1, word: -1, words: {}, w: null,
    p: -0.25, hue: 0, cam: [0, 0, DV], fw: [0, 0, -1], rt: [1, 0, 0], up: [0, 1, 0],
    hit: { t: 0, b: -1, ax: 0 }, col: [0, 0, 0], pal: new Float32Array(12),
  };
}

const T_LOOP = 16; // seconds for the whole figure eight at Speed 2

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  const speed = cl(kv[1], 0.2, 3);
  const wi = cl(round(kv[2]), 0, WORDS.length - 1);
  if (wi !== S.word) {
    S.word = wi;
    S.w = S.words[wi] || (S.words[wi] = buildWord(wi));
  }
  const flat = cl(kv[3], 0, 1);
  if (input.btnPressed && input.btnPressed[0]) {
    S.cells = cutCells(generator(floor(random() * 4294967296)));
    S.flat = -1;
  }
  if (abs(flat - S.flat) > 1e-4) {
    S.flat = flat;
    buildBoxes(S);
  }
  S.p += (d * speed) / 2 / T_LOOP;
  // A figure eight through V, slowed to a quarter of its pace there.
  const tau = 2 * PI * S.p, ts = tau - 0.375 * sin(2 * tau);
  const th = (52 * PI * sin(ts)) / 180, ph = (17 * PI * sin(2 * ts)) / 180;
  const r = DV * (1 - 0.16 * sin(ts) * sin(ts));
  const cam = S.cam;
  cam[0] = r * cos(ph) * sin(th);
  cam[1] = r * sin(ph);
  cam[2] = r * cos(ph) * cos(th);
  const l = sqrt(cam[0] * cam[0] + cam[1] * cam[1] + cam[2] * cam[2]);
  const fw = S.fw, rt = S.rt, up = S.up;
  fw[0] = -cam[0] / l; fw[1] = -cam[1] / l; fw[2] = -cam[2] / l;
  // right = forward x world up, up = right x forward
  const rl = sqrt(fw[2] * fw[2] + fw[0] * fw[0]);
  rt[0] = -fw[2] / rl; rt[1] = 0; rt[2] = fw[0] / rl;
  up[0] = rt[1] * fw[2] - rt[2] * fw[1];
  up[1] = rt[2] * fw[0] - rt[0] * fw[2];
  up[2] = rt[0] * fw[1] - rt[1] * fw[0];
  rects(S.boxes, cam[0], cam[1], cam[2], fw, rt, up, S.cr);
}

// The nearest box along o + t d for 0 < t < tmax, testing only the boxes
// whose screen rectangle in rc holds (sx, sy); fills h.
function trace(boxes, rc, sx, sy, ox, oy, oz, dx, dy, dz, tmax, h) {
  const ix = 1 / (abs(dx) < 1e-9 ? 1e-9 : dx), iy = 1 / (abs(dy) < 1e-9 ? 1e-9 : dy), iz = 1 / (abs(dz) < 1e-9 ? 1e-9 : dz);
  let best = tmax, bi = -1, bax = 0;
  for (let i = 0; i < boxes.length; i++) {
    if (sx < rc[i * 4] || sx > rc[i * 4 + 1] || sy < rc[i * 4 + 2] || sy > rc[i * 4 + 3]) continue;
    const b = boxes[i];
    let t0 = (b[0] - ox) * ix, t1 = (b[3] - ox) * ix;
    if (t0 > t1) { const q = t0; t0 = t1; t1 = q; }
    let a0 = (b[1] - oy) * iy, a1 = (b[4] - oy) * iy;
    if (a0 > a1) { const q = a0; a0 = a1; a1 = q; }
    let c0 = (b[2] - oz) * iz, c1 = (b[5] - oz) * iz;
    if (c0 > c1) { const q = c0; c0 = c1; c1 = q; }
    let tn = t0, ax = 0;
    if (a0 > tn) { tn = a0; ax = 1; }
    if (c0 > tn) { tn = c0; ax = 2; }
    const tf = min(t1, a1, c1);
    if (tn > 1e-6 && tn <= tf && tn < best) { best = tn; bi = i; bax = ax; }
  }
  h.t = best; h.b = bi; h.ax = bax;
  return bi;
}

const LX = 0.42, LY = 0.78, LZ = 0.46; // light from above, right and in front

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.w) return;
  const { boxes, cam, fw, rt, up, hit, col, pal } = S, wd = S.w, mask = wd.mask, ids = wd.id;
  for (let k = 0; k < wd.n; k++) {
    hsv(S.hue + 0.55 + k / wd.n, 1, 1, col);
    pal[k * 3] = col[0]; pal[k * 3 + 1] = col[1]; pal[k * 3 + 2] = col[2];
  }
  const ox = cam[0], oy = cam[1], oz = cam[2];
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const sx = px + 0.5 - 32, sy = 64 - py - 0.5;
      const dx = fw[0] * F + rt[0] * sx + up[0] * sy;
      const dy = fw[1] * F + rt[1] * sx + up[1] * sy;
      const dz = fw[2] * F + rt[2] * sx + up[2] * sy;
      let r = 0, g = 0, b = 0;
      const tf = dy < 0 ? (YF - oy) / dy : 1e9;
      trace(boxes, S.cr, px + 0.5, py + 0.5, ox, oy, oz, dx, dy, dz, tf, hit);
      const dl = sqrt(dx * dx + dy * dy + dz * dz), foot = (hit.t * dl) / F; // world size of one LED there
      if (hit.b >= 0) {
        const B = boxes[hit.b], t = hit.t, ax = hit.ax;
        const X = ox + t * dx, Y = oy + t * dy, Z = oz + t * dz;
        const dd = ax === 0 ? dx : ax === 1 ? dy : dz, sg = dd > 0 ? -1 : 1;
        const lam = max(0, sg * (ax === 0 ? LX : ax === 1 ? LY : LZ));
        // Where V sees this point: its place in V's picture, and whether
        // anything stands between it and V.
        let paint = 0, pk = 0;
        const depth = DV - Z;
        if (depth > 0.1) {
          const u = 32 + (F * X) / depth, v = 64 - (F * Y) / depth;
          const mx = u * 2 - 0.5, my = v * 2 - 0.5;
          if (mx >= 0 && my >= 0 && mx < MW - 1 && my < MH - 1) {
            const ix = floor(mx), iy = floor(my), fx = mx - ix, fy = my - iy, o = iy * MW + ix;
            const m = (mask[o] * (1 - fx) + mask[o + 1] * fx) * (1 - fy) + (mask[o + MW] * (1 - fx) + mask[o + MW + 1] * fx) * fy;
            if (m > 0.02) {
              pk = ids[mask[o] > 0 ? o : mask[o + 1] > 0 ? o + 1 : mask[o + MW] > 0 ? o + MW : o + MW + 1];
              const vx = X, vy = Y, vz = Z - DV;
              if (trace(boxes, S.vr, u, v, 0, 0, DV, vx, vy, vz, 1 - 1e-3, hit) < 0) paint = m;
            }
          }
        }
        // The surface: dim slate, lit from one side, its edges drawn faintly.
        let e;
        if (ax === 0) e = min(Y - B[1], B[4] - Y, Z - B[2], B[5] - Z);
        else if (ax === 1) e = min(X - B[0], B[3] - X, Z - B[2], B[5] - Z);
        else e = min(X - B[0], B[3] - X, Y - B[1], B[4] - Y);
        const edge = cl(1 - e / (0.9 * foot), 0, 1);
        const base = 0.13 + 0.17 * lam + 0.2 * edge * (1 - paint);
        r = base * 0.86; g = base * 0.93; b = base * 1.12;
        if (paint > 0) {
          const pv = min(1, 0.8 + 0.45 * lam);
          r += (pal[pk * 3] * pv - r) * paint;
          g += (pal[pk * 3 + 1] * pv - g) * paint;
          b += (pal[pk * 3 + 2] * pv - b) * paint;
        }
      } else if (tf < 1e9) {
        // The floor: a faint grid one unit square.
        const X = ox + tf * dx, Z = oz + tf * dz, fo = (tf * dl) / F;
        const gx = abs(X - round(X)), gz = abs(Z - round(Z));
        const ln = cl(1 - min(gx, gz) / max(0.02, 0.8 * fo), 0, 1) * cl(1.6 - fo * 5, 0, 1);
        const fade = cl(1 - (X * X + Z * Z) / 260, 0, 1);
        r = g = b = (0.03 + 0.14 * ln) * fade;
        b *= 1.25;
      }
      display.setPixel(px, py, floor(cl(r, 0, 1) * 255), floor(cl(g, 0, 1) * 255), floor(cl(b, 0, 1) * 255));
    }
}
