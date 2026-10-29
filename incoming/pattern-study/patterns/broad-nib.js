// ===== Patternflow pattern =====
// Title:   Broad Nib
// Family:  type
// Idea:    A broad-edged pen writes Latin mottoes in capitals down a ruled panel, a word a line, stroke by stroke, and every stroke comes out thick or thin by how its direction meets the angle of the nib, so turning the nib re-inks every letter on the page while the pen is still writing.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: broad-edge pen lettering (Edward Johnston, Writing & Illuminating & Lettering, 1906) and the pen model of METAFONT (Donald Knuth, 1979), pattern round 64, writing mottoes from Pliny the Elder, Suetonius and Seneca
// Round:   64
// ===============================
// @matrix 64x128
// @knobs Angle=30..180, Speed=0.2..3, Weight=-1..1, Slant=0..20
//
// Knob 1: Angle. The angle of the nib edge to the line, in degrees: at 30 the pen of Johnston's capitals, thick downstrokes and lighter cross strokes; at 90 the contrast turns over, the stems go to hairlines and the cross strokes are heavy; at 180 the pen lies flat and the cross strokes thin to hairlines.
// Knob 2: Speed. How fast the pen moves: at 2 a downstroke takes a sixth of a second, a page of four words 9 to 15 seconds and the finished page holds for two and a half; at 0.2 the pen is ten times slower.
// Knob 3: Weight. The nib's width against the height of the capitals: 5.2 nib widths at 0, 8.5 at -1 for a light hand, 3.9 at 1 for a heavy one that closes the counters.
// Knob 4: Slant. Leans the letters to the right like an italic hand, up to 20 degrees, the whole page at once.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, abs, cos, sin, tan, sqrt, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Skeleton capitals in a box ten units high, y down from the cap line to the
// base line: the advance width, then the strokes in the order and direction a
// pen writes them. M moves, L draws a line, E cx cy rx ry a0 a1 an arc of an
// ellipse from angle a0 to a1 in degrees (0 right, 90 down).
const GLYPHS = {
  A: "7|M3.5 0L0 10|M3.5 0L7 10|M1.3 6.6L5.7 6.6",
  B: "5.7|M0 0L0 10|M0 0L2.8 0E2.8 2.4 2.4 2.4 270 450L0 4.8|M0 4.8L3.1 4.8E3.1 7.4 2.6 2.6 270 450L0 10",
  C: "6.1|E3.7 5 3.7 5 305 55",
  D: "7|M0 0L0 10|M0 0L2.2 0E2.2 5 4.8 5 270 450L0 10",
  E: "5.2|M0 0L0 10|M0 0L5 0|M0 4.9L4.2 4.9|M0 10L5.2 10",
  F: "5|M0 0L0 10|M0 0L5 0|M0 4.9L4.2 4.9",
  G: "7.1|E3.7 5 3.7 5 305 25|M4.3 5.7L7.1 5.7L7.1 9.6",
  I: "0|M0 0L0 10",
  L: "5|M0 0L0 10L5 10",
  M: "8.4|M0.5 0L0 10|M0.5 0L4.2 10|M7.9 0L4.2 10|M7.9 0L8.4 10",
  N: "6.6|M0 0L0 10|M0 0L6.6 10|M6.6 0L6.6 10",
  O: "7.4|E3.7 5 3.7 5 270 90|E3.7 5 3.7 5 270 450",
  P: "5.6|M0 0L0 10|M0 0L2.8 0E2.8 2.7 2.8 2.7 270 450L0 5.4",
  R: "6|M0 0L0 10|M0 0L2.6 0E2.6 2.6 2.6 2.6 270 450L0 5.2|M2.4 5.2L6 10",
  S: "5.3|E2.5 2.5 2.4 2.5 335 90E2.6 7.5 2.7 2.5 270 515",
  T: "6.6|M0 0L6.6 0|M3.3 0L3.3 10",
  U: "6.6|M0 0L0 6.6E3.3 6.6 3.3 3.4 180 0|M6.6 0L6.6 10",
  V: "7|M0 0L3.5 10|M7 0L3.5 10",
};
// Four mottoes about writing and time, a word a line: no day without a line
// (Pliny the Elder on Apelles, Natural History, 77), spoken words fly and
// written ones stay (a medieval proverb), make haste slowly (Augustus, after
// Suetonius, 121) and art is long, life is short (Hippocrates, in Seneca's
// Latin, 49).
const PAGES = [
  ["NULLA", "DIES", "SINE", "LINEA"],
  ["VERBA", "VOLANT", "SCRIPTA", "MANENT"],
  ["FESTINA", "LENTE"],
  ["ARS", "LONGA", "VITA", "BREVIS"],
];
// Ink and the red of the first letter, the rubric, for each page in turn.
const INKS = [
  [[255, 228, 178], [255, 70, 38]],
  [[120, 168, 255], [255, 196, 70]],
  [[255, 204, 96], [255, 70, 38]],
  [[90, 226, 176], [255, 120, 60]],
];
// The tallest capitals, and their height in nib widths at Weight 0.
const HMAX = 26, NIBS = 5.2;

// Each glyph's strokes as polylines in its unit box.
function parse(src) {
  const [w, ...strokes] = src.split("|");
  return {
    w: +w,
    strokes: strokes.map((s) => {
      const tk = s.match(/[MLE]|-?[\d.]+/g), pts = [];
      for (let i = 0; i < tk.length; ) {
        const c = tk[i++];
        if (c === "M" || c === "L") pts.push([+tk[i++], +tk[i++]]);
        else {
          const [cx, cy, rx, ry, a0, a1] = tk.slice(i, i + 6).map(Number);
          i += 6;
          const n = ceil(abs(a1 - a0) / 6);
          for (let j = 0; j <= n; j++) {
            const a = ((a0 + ((a1 - a0) * j) / n) * PI) / 180;
            pts.push([cx + rx * cos(a), cy + ry * sin(a)]);
          }
        }
      }
      return pts;
    }),
  };
}
const FONT = {};
for (const c in GLYPHS) FONT[c] = parse(GLYPHS[c]);

// Lays out one page: each word on its own line as large as the width lets
// it be, condensed by up to a third before it shrinks, the lines spread
// evenly down the panel. Strokes come out in LEDs, cut into pieces no
// longer than an LED and a half so the pen can stop anywhere along them.
function layout(words) {
  const lines = words.map((word) => {
    const gl = [...word].map((c) => FONT[c]), sw = gl.reduce((s, g) => s + g.w, 0);
    let ky = HMAX / 10, kx = ky;
    for (; ky > 0.6; ky -= 0.05) {
      const nib = (ky * 10) / NIBS, gap = nib + 1.2 * ky;
      kx = (W - 3 - (gl.length - 1) * gap - nib * 0.9) / sw;
      if (kx >= 0.7 * ky) break;
    }
    return { gl, ky, kx: min(kx, ky), gap: (ky * 10) / NIBS + 1.2 * ky };
  });
  let total = lines.reduce((s, l) => s + l.ky * 10, 0), room = H - total;
  if (room < 6 * (lines.length + 1)) {
    const f = (H - 6 * (lines.length + 1)) / total;
    for (const l of lines) (l.ky *= f), (l.kx *= f), (l.gap *= f);
    total *= f;
    room = H - total;
  }
  const strokes = [];
  strokes.rules = [];
  let y = room / (lines.length + 1);
  lines.forEach((l, li) => {
    const hgt = l.ky * 10, wid = l.gl.reduce((s, g) => s + g.w * l.kx, 0) + (l.gl.length - 1) * l.gap;
    let x = (W - 1 - wid) / 2;
    l.gl.forEach((g, gi) => {
      for (const pts of g.strokes) {
        const out = [];
        for (let i = 0; i < pts.length; i++) {
          const px = x + pts[i][0] * l.kx, py = y + pts[i][1] * l.ky;
          if (i) {
            const [qx, qy] = out[out.length - 1], n = ceil(sqrt((px - qx) ** 2 + (py - qy) ** 2) / 1.5);
            for (let j = 1; j <= n; j++) out.push([qx + ((px - qx) * j) / n, qy + ((py - qy) * j) / n]);
          } else out.push([px, py]);
        }
        const xy = new Float32Array(out.flat()), cum = new Float32Array(out.length);
        for (let i = 1; i < out.length; i++) cum[i] = cum[i - 1] + sqrt((xy[2 * i] - xy[2 * i - 2]) ** 2 + (xy[2 * i + 1] - xy[2 * i - 1]) ** 2);
        strokes.push({ xy, cum, len: cum[out.length - 1], hgt, mid: y + hgt / 2, rubric: li === 0 && gi === 0, laid: new Float32Array(out.length).fill(-1) });
      }
      x += g.w * l.kx + l.gap;
    });
    strokes.rules.push(Math.round(y), Math.round(y + hgt));
    y += hgt + room / (lines.length + 1);
  });
  return strokes;
}

export function setup(params) {
  params.bn = {
    t: 0, page: -1, strokes: [], si: 0, d: 0, mode: "lift", lift: 1, from: [32, -10], to: [32, -10], timer: 0, fadeOut: 1, pen: [32, -10], started: false,
    angle: PI / 6, speed: 2, weight: 0, slant: 0,
    cov: new Float32Array(N), covR: new Float32Array(N), wet: new Float32Array(N),
  };
}

function nextPage(B) {
  B.page = (B.page + 1) % PAGES.length;
  B.strokes = layout(PAGES[B.page]);
  // The page is ruled in faint pencil at the cap line and base line of each
  // line of writing, as a scribe rules it before the pen comes.
  B.rule = new Uint8Array(H);
  for (const r of B.strokes.rules) if (r >= 0 && r < H) B.rule[r] = 1;
  B.si = 0;
  B.d = 0;
  B.fadeOut = 1;
  startLift(B, B.pen, B.strokes[0]);
}

function startLift(B, from, s) {
  B.mode = "lift";
  B.from = [from[0], from[1]];
  B.to = [s.xy[0], s.xy[1]];
  const dist = sqrt((B.to[0] - from[0]) ** 2 + (B.to[1] - from[1]) ** 2);
  B.lift = 0;
  B.liftT = max(0.06, dist / (5 * rate(B, s)));
}

// The pen's speed on a stroke in LEDs a second, in proportion to the height
// of its letters, so big and small words take the same time a stroke.
const rate = (B, s) => B.speed * 3 * s.hgt;

// The pen, as a little machine: write a stroke, lift and move to the next,
// and when the page is done hold it, let it fade and turn to the next.
function step(B, dt) {
  B.t += dt;
  if (B.mode === "write") {
    const s = B.strokes[B.si];
    B.d += rate(B, s) * dt;
    for (let i = 0; i < s.cum.length && s.cum[i] <= B.d; i++) if (s.laid[i] < 0) s.laid[i] = B.t;
    B.pen = at(s, B.d);
    if (B.d >= s.len) {
      B.si++;
      if (B.si < B.strokes.length) startLift(B, B.pen, B.strokes[B.si]);
      else (B.mode = "hold"), (B.timer = 1.2 + 2.6 / B.speed);
    }
  } else if (B.mode === "lift") {
    B.lift = min(1, B.lift + dt / B.liftT);
    const e = B.lift * B.lift * (3 - 2 * B.lift);
    B.pen = [B.from[0] + (B.to[0] - B.from[0]) * e, B.from[1] + (B.to[1] - B.from[1]) * e];
    if (B.lift >= 1) {
      B.mode = "write";
      B.d = 0;
      B.strokes[B.si].laid[0] = B.t;
    }
  } else if (B.mode === "hold") {
    B.timer -= dt;
    if (B.timer <= 0) (B.mode = "fade"), (B.timer = 0.8);
  } else {
    B.timer -= dt;
    B.fadeOut = max(0, B.timer / 0.8);
    if (B.timer <= 0) nextPage(B);
  }
}

// The point at distance d along a stroke.
function at(s, d) {
  const n = s.cum.length;
  if (d >= s.len) return [s.xy[2 * n - 2], s.xy[2 * n - 1]];
  let i = 0;
  while (i < n - 2 && s.cum[i + 1] < d) i++;
  const f = (d - s.cum[i]) / max(1e-6, s.cum[i + 1] - s.cum[i]);
  return [s.xy[2 * i] + (s.xy[2 * i + 2] - s.xy[2 * i]) * f, s.xy[2 * i + 1] + (s.xy[2 * i + 3] - s.xy[2 * i + 1]) * f];
}

export function update(dt, input, params) {
  if (!params.bn) setup(params);
  const B = params.bn, k = input.knobValues || [30, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  B.angle = (cl(k[0], 30, 180) * PI) / 180;
  B.speed = cl(k[1], 0.2, 3);
  B.weight = cl(k[2], -1, 1);
  B.slant = (cl(k[3], 0, 20) * PI) / 180;
  if (!B.started) {
    // The panel opens on a page already a third written.
    B.started = true;
    nextPage(B);
    for (let i = 0; i < 100; i++) step(B, 1 / 30);
  }
  step(B, dt);
}

// Ink one piece of a stroke: the nib, a segment of half length h along
// (nx, ny), swept from (ax, ay) to (bx, by), covers a parallelogram, as the
// pen of METAFONT does. Each LED takes its distance to the nearest edge,
// softened over one LED, so where the pen runs along its own edge it still
// leaves a hairline one LED wide. wet is how fresh the ink is.
function sweep(B, buf, ax, ay, bx, by, nx, ny, h, wet) {
  const sx = bx - ax, sy = by - ay, L = sqrt(sx * sx + sy * sy), mx = (ax + bx) / 2, my = (ay + by) / 2;
  const ux = L > 1e-4 ? sx / L : 0, uy = L > 1e-4 ? sy / L : 0;
  const sn = abs(ux * nx + uy * ny), cr = abs(ux * ny - uy * nx);
  const eA = h * cr, eB = (L * cr) / 2, eC = h + (L * sn) / 2, eD = L / 2 + h * sn;
  const r = h + 1.5;
  const x0 = max(0, floor(min(ax, bx) - r)), x1 = min(W - 1, ceil(max(ax, bx) + r));
  const y0 = max(0, floor(min(ay, by) - r)), y1 = min(H - 1, ceil(max(ay, by) + r));
  const W2 = B.wet;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const qx = x - mx, qy = y - my;
      let d = max(abs(qx * ny - qy * nx) - eB, abs(qx * nx + qy * ny) - eC);
      if (L > 1e-4) d = max(d, abs(qx * uy - qy * ux) - eA, abs(qx * ux + qy * uy) - eD);
      const c = 0.85 - d;
      if (c <= 0) continue;
      const p = y * W + x, v = c > 1 ? 1 : c;
      if (v > buf[p]) buf[p] = v;
      const w = v * wet;
      if (w > W2[p]) W2[p] = w;
    }
}

export function draw(display, params) {
  const B = params.bn;
  if (!B || !B.started) return;
  const { cov, covR, wet } = B;
  cov.fill(0);
  covR.fill(0);
  wet.fill(0);
  const nx = cos(B.angle), ny = -sin(B.angle), sh = tan(B.slant), wf = NIBS - (B.weight < 0 ? 3.3 : 1.3) * B.weight;
  const done = B.mode === "write" ? B.si + 1 : B.si;
  for (let k = 0; k < done && k < B.strokes.length; k++) {
    const s = B.strokes[k], lim = k === B.si && B.mode === "write" ? B.d : 1e9, h = s.hgt / wf / 2, buf = s.rubric ? covR : cov;
    const X = (i) => s.xy[2 * i] + (s.mid - s.xy[2 * i + 1]) * sh;
    for (let i = 0; i + 1 < s.cum.length && s.cum[i] < lim; i++) {
      let bx = X(i + 1), by = s.xy[2 * i + 3];
      if (s.cum[i + 1] > lim) {
        const f = (lim - s.cum[i]) / (s.cum[i + 1] - s.cum[i]);
        by = s.xy[2 * i + 1] + (by - s.xy[2 * i + 1]) * f;
        bx = X(i) + (bx - X(i)) * f;
      }
      const age = s.laid[i] < 0 ? 9 : B.t - s.laid[i];
      sweep(B, buf, X(i), s.xy[2 * i + 1], bx, by, nx, ny, h, exp(-age / 0.5));
    }
  }
  const [ink, rub] = INKS[B.page], f = B.fadeOut;
  const rule = B.rule;
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const a = cov[p], b = covR[p], c = max(a, b);
      if (c <= 0) {
        const r = rule[y] * f;
        display.setPixel(x, y, 30 * r, 34 * r, 54 * r);
        continue;
      }
      const wa = a / (a + b), w = wet[p] * 0.6;
      let r = (ink[0] * wa + rub[0] * (1 - wa)) * c, g = (ink[1] * wa + rub[1] * (1 - wa)) * c, bl = (ink[2] * wa + rub[2] * (1 - wa)) * c;
      r += (255 * c - r) * w;
      g += (255 * c - g) * w;
      bl += (255 * c - bl) * w;
      display.setPixel(x, y, r * f, g * f, bl * f);
    }
  // The nib itself, a short bar of light at the pen's point, dark round its
  // edge so it reads on the ink; dimmer while the pen is lifted.
  if (B.mode === "write" || B.mode === "lift") {
    const s = B.strokes[min(B.si, B.strokes.length - 1)], h = s.hgt / wf / 2;
    const px = B.pen[0] + (s.mid - B.pen[1]) * sh, py = B.pen[1], v = B.mode === "write" ? 1 : 0.55;
    for (let y = max(0, floor(py - h - 2)); y <= min(H - 1, ceil(py + h + 2)); y++)
      for (let x = max(0, floor(px - h - 2)); x <= min(W - 1, ceil(px + h + 2)); x++) {
        const qx = x - px, qy = y - py, d = max(abs(qx * ny - qy * nx), abs(qx * nx + qy * ny) - h);
        if (d < 0.6) display.setPixel(x, y, 255 * v, 255 * v, 255 * v);
        else if (d < 1.5) display.setPixel(x, y, 0, 0, 0);
      }
  }
}
