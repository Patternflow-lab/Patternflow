// ===== Patternflow pattern =====
// Title:   Noordzij Cube
// Family:  type
// Idea:    A pen writes three lowercase words down the panel stroke by stroke, and the width at every point of every stroke comes from Gerrit Noordzij's two kinds of contrast, the broad nib's translation, thick or thin by the stroke's direction against the nib, and the pointed pen's expansion, swelling on the downstrokes, so turning the knobs moves the whole page across his cube on one unchanged skeleton.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the theory of the stroke and its cube of contrast, translation, expansion and the amount of contrast (Gerrit Noordzij, De streek, 1985; The stroke: theory of writing, 2005); lowercase skeletons drawn for this pattern, pattern round 82
// Round:   82
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Model=0..1, Hairline=0..1
//
// Knob 1: Hue. Turns the ink round the wheel. At 0 every stroke runs from cyan where the pen comes down to violet where it lifts, deep where the ink is thick and pale in a hairline.
// Knob 2: Speed. At 2 the pen moves 44 LEDs a second, a page of three words takes 17 to 19 s and holds for 2.5 s before it fades; at 0.2 the pen is ten times slower.
// Knob 3: Model. Where the page stands between translation at 0, a broad nib held at 30 degrees, thickest across the nib and thinnest along it, and expansion at 1, a pointed pen that swells on every downstroke and runs thin up and across. The skeleton and the order of the strokes never change.
// Knob 4: Hairline. The thinnest stroke as a share of the thickest, which is 4.8 LEDs, the amount of contrast read the other way: at the opening 0.06 a hairline is the floor of 0.8 LED; at 1 every stroke is 4.8 LEDs and translation and expansion give the same letters, the edge of the cube where there is no contrast to tell them apart.

// Noordzij reads every contrast in written letters as the trace of a pen.
// A broad nib moved without turning, translation, leaves its full width
// where it travels across its edge and a hairline where it travels along
// it, so the thick and thin of a letter follow the direction of each stroke
// and the angle of the nib. A pointed flexible nib, expansion, is thin until
// it is pressed, and the hand presses on the way down, so the thick falls on
// the downstrokes and swells in and out. His cube sets these two models on
// one edge, the amount of contrast on another, and interrupted against
// running construction on the third. Here the third stays interrupted: the
// pen lifts between the strokes of a letter and the letters do not join.
//
// Every letter is one centreline, written in order and in one direction.
// Each point of it carries both widths, worked out once: the broad nib's
// |sin(direction - 30 degrees)| and the pointed pen's pressure, the share of
// the stroke's motion that runs down, smoothed forwards and backwards over
// 3.2 LEDs so it comes and goes. Model blends the two, Hairline sets how
// thin the thinnest is, and a round soft-edged pen of that width inks the
// line. Nothing about the letters changes but those two numbers.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, abs, sqrt, sin, cos, atan2, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Skeleton lowercase in a box 7 wide, y down from the x-line at 0 to the
// base line at 10, ascender to -6.5 and descender to 16.5: the strokes in
// the order and direction a hand writes them. M moves, L draws a line, and
// E cx cy rx ry a0 a1 an arc of an ellipse from angle a0 to a1 in degrees
// (0 right, 90 down), so a falling angle runs anticlockwise on the panel.
const GLYPHS = {
  a: "E3.5 5 3.5 5 330 30|M7 0L7 10",
  b: "M0 -6.5L0 10|E3.5 5 3.5 5 205 515",
  e: "M0.2 5L7 5E3.5 5 3.5 5 0 -318",
  g: "E3.5 5 3.5 5 330 30|M7 0L7 12.5E3.5 12.5 3.5 4 0 165",
  n: "M0 0L0 10|E3.5 3.6 3.5 3.6 180 360L7 10",
  o: "E3.5 5 3.5 5 290 -66",
};
const PAGES = [
  ["nano", "bone", "ego"],
  ["oboe", "nag", "eon"],
];
// LEDs per unit across and down, the space between letters in LEDs, the
// thickest stroke, the nib angle and the length over which a pointed pen's
// pressure comes and goes, in LEDs.
const KX = 1.38, KY = 2.1, GAP = 6.5, THICK = 4.8, NIB = (30 * PI) / 180, SWELL = 3.2;

function parse(src) {
  return src.split("|").map((s) => {
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
  });
}
const FONT = {};
for (const c in GLYPHS) FONT[c] = parse(GLYPHS[c]);

// A stroke in LEDs, cut into steps of at most an LED. For each point:
// tr, the width a broad nib at NIB leaves, |sin(direction - nib)|, and ex,
// the pressure on a pointed pen: how much the stroke runs down, smoothed
// along it forwards and backwards so it swells in and out.
function stroke(pts) {
  const P = [];
  for (let i = 0; i < pts.length; i++) {
    if (!i) {
      P.push(pts[0]);
      continue;
    }
    const [qx, qy] = P[P.length - 1], [px, py] = pts[i], n = ceil(sqrt((px - qx) ** 2 + (py - qy) ** 2));
    for (let j = 1; j <= n; j++) P.push([qx + ((px - qx) * j) / n, qy + ((py - qy) * j) / n]);
  }
  const n = P.length, xy = new Float32Array(2 * n), cum = new Float32Array(n), tr = new Float32Array(n), ex = new Float32Array(n);
  const raw = new Float32Array(n), fw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    xy[2 * i] = P[i][0];
    xy[2 * i + 1] = P[i][1];
    if (i) cum[i] = cum[i - 1] + sqrt((P[i][0] - P[i - 1][0]) ** 2 + (P[i][1] - P[i - 1][1]) ** 2);
    const a = P[max(0, i - 1)], b = P[min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = sqrt(dx * dx + dy * dy) || 1;
    // The direction with y up, as the nib angle is measured.
    tr[i] = abs(sin(atan2(-dy, dx) - NIB));
    raw[i] = max(0, dy / L);
  }
  for (let i = 0, f = 0; i < n; i++) {
    const k = 1 - exp(-(i ? cum[i] - cum[i - 1] : 1) / SWELL);
    f += (raw[i] - f) * k;
    fw[i] = f;
  }
  for (let i = n - 1, f = 0; i >= 0; i--) {
    const k = 1 - exp(-(i < n - 1 ? cum[i + 1] - cum[i] : 1) / SWELL);
    f += (raw[i] - f) * k;
    ex[i] = min(fw[i], f) ** 0.8;
  }
  return { xy, cum, tr, ex, len: cum[n - 1] };
}

// One page: each word on a line of its own, centred, the lines spread
// evenly down the panel by their ascenders and descenders.
function layout(words) {
  const lines = words.map((w) => ({
    w,
    up: /b/.test(w) ? 6.5 : 0,
    down: /g/.test(w) ? 6.5 : 0,
    width: w.length * 7 * KX + (w.length - 1) * GAP,
  }));
  const tall = lines.reduce((s, l) => s + (10 + l.up + l.down) * KY, 0), gap = (H - tall) / (lines.length + 1);
  const strokes = [], guides = [];
  let y = gap;
  for (const l of lines) {
    const top = y + l.up * KY;
    let x = (W - 1 - l.width) / 2;
    for (const c of l.w) {
      for (const pts of FONT[c]) strokes.push(stroke(pts.map(([u, v]) => [x + u * KX, top + v * KY])));
      x += 7 * KX + GAP;
    }
    guides.push(Math.round(top), Math.round(top + 10 * KY));
    y += (10 + l.up + l.down) * KY + gap;
  }
  return { strokes, guides };
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

export function setup(params) {
  params.nc = {
    page: -1, strokes: [], guides: [], si: 0, d: 0, mode: "lift", lift: 0, liftT: 0.1, from: [32, -6], to: [32, -6], pen: [32, -6], timer: 0, fade: 1, started: false,
    hue: 0, speed: 2, model: 0, hair: 0.06,
    cov: new Float32Array(N), fat: new Float32Array(N), pos: new Float32Array(N), out: new Float32Array(N * 3),
  };
}

function nextPage(B) {
  B.page = (B.page + 1) % PAGES.length;
  const L = layout(PAGES[B.page]);
  B.strokes = L.strokes;
  B.guides = L.guides;
  B.si = 0;
  B.d = 0;
  B.fade = 1;
  startLift(B);
}

function startLift(B) {
  const s = B.strokes[B.si];
  B.mode = "lift";
  B.from = [B.pen[0], B.pen[1]];
  B.to = [s.xy[0], s.xy[1]];
  B.lift = 0;
  B.liftT = max(0.08, sqrt((B.to[0] - B.from[0]) ** 2 + (B.to[1] - B.from[1]) ** 2) / (3 * rate(B)));
}

const rate = (B) => 22 * B.speed;

// The point at distance d along a stroke.
function at(s, d) {
  const n = s.cum.length;
  if (d >= s.len) return [s.xy[2 * n - 2], s.xy[2 * n - 1]];
  let i = 0;
  while (i < n - 2 && s.cum[i + 1] < d) i++;
  const f = (d - s.cum[i]) / max(1e-6, s.cum[i + 1] - s.cum[i]);
  return [s.xy[2 * i] + (s.xy[2 * i + 2] - s.xy[2 * i]) * f, s.xy[2 * i + 1] + (s.xy[2 * i + 3] - s.xy[2 * i + 1]) * f];
}

function step(B, dt) {
  if (B.mode === "write") {
    const s = B.strokes[B.si];
    B.d += rate(B) * dt;
    B.pen = at(s, B.d);
    if (B.d >= s.len) {
      B.si++;
      if (B.si < B.strokes.length) startLift(B);
      else (B.mode = "hold"), (B.timer = 2.5);
    }
  } else if (B.mode === "lift") {
    B.lift = min(1, B.lift + dt / B.liftT);
    const e = B.lift * B.lift * (3 - 2 * B.lift);
    B.pen = [B.from[0] + (B.to[0] - B.from[0]) * e, B.from[1] + (B.to[1] - B.from[1]) * e];
    if (B.lift >= 1) (B.mode = "write"), (B.d = 0);
  } else if (B.mode === "hold") {
    B.timer -= (dt * B.speed) / 2;
    if (B.timer <= 0) (B.mode = "fade"), (B.timer = 0.8);
  } else {
    B.timer -= dt;
    B.fade = max(0, B.timer / 0.8);
    if (B.timer <= 0) nextPage(B);
  }
}

export function update(dt, input, params) {
  if (!params.nc) setup(params);
  const B = params.nc, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  B.hue = k[0] || 0;
  B.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  B.model = cl(k[2] || 0, 0, 1);
  B.hair = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  if (!B.started) {
    // The panel opens 13.5 s into the page: at Speed 2 the pen has written
    // all but the last word.
    B.started = true;
    nextPage(B);
    for (let i = 0; i < 405; i++) step(B, 1 / 30);
  }
  step(B, dt);
}

// The width of a stroke at a point: the two models blended by Model, the
// result laid between the hairline and the thickest stroke.
function width(B, s, i) {
  const f = (1 - B.model) * s.tr[i] + B.model * s.ex[i], w = max(0.8, THICK * (B.hair + (1 - B.hair) * f));
  return [w, w / THICK];
}

// Ink one piece of a stroke with a round pen whose radius runs from ra to
// rb along it, its edge softened over one LED. fat keeps how thick the
// stroke is there and pos how far along it, from 0 to 1, for the colour.
function piece(B, ax, ay, bx, by, ra, rb, fa, fb, ua, ub) {
  const r = max(ra, rb) + 1;
  const x0 = max(0, floor(min(ax, bx) - r)), x1 = min(W - 1, ceil(max(ax, bx) + r));
  const y0 = max(0, floor(min(ay, by) - r)), y1 = min(H - 1, ceil(max(ay, by) + r));
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9, { cov, fat, pos } = B;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const t = cl(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1), ex = x - ax - t * dx, ey = y - ay - t * dy;
      const c = cl(ra + (rb - ra) * t - sqrt(ex * ex + ey * ey) + 0.5, 0, 1);
      const p = y * W + x;
      if (c > cov[p]) {
        cov[p] = c;
        fat[p] = fa + (fb - fa) * t;
        pos[p] = ua + (ub - ua) * t;
      }
    }
}

export function draw(display, params) {
  const B = params.nc;
  if (!B || !B.started) return;
  const { cov, fat } = B;
  cov.fill(0);
  const done = B.mode === "write" ? B.si + 1 : B.si;
  for (let k = 0; k < done && k < B.strokes.length; k++) {
    const s = B.strokes[k], lim = k === B.si && B.mode === "write" ? B.d : 1e9;
    let [wa, fa] = width(B, s, 0);
    for (let i = 0; i + 1 < s.cum.length && s.cum[i] < lim; i++) {
      let [wb, fb] = width(B, s, i + 1), bx = s.xy[2 * i + 2], by = s.xy[2 * i + 3];
      if (s.cum[i + 1] > lim) {
        const f = (lim - s.cum[i]) / (s.cum[i + 1] - s.cum[i]);
        bx = s.xy[2 * i] + (bx - s.xy[2 * i]) * f;
        by = s.xy[2 * i + 1] + (by - s.xy[2 * i + 1]) * f;
      }
      piece(B, s.xy[2 * i], s.xy[2 * i + 1], bx, by, wa / 2, wb / 2, fa, fb, s.cum[i] / s.len, min(lim, s.cum[i + 1]) / s.len);
      wa = wb;
      fa = fb;
    }
  }
  // Each stroke runs from cyan where the pen comes down to violet where it
  // lifts, so the colour shows the way it was written; thick ink is deep,
  // a hairline pale.
  const { out, pos } = B, F = B.fade, rule = new Uint8Array(H);
  for (const g of B.guides) if (g >= 0 && g < H) rule[g] = 1;
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const c = cov[p] * F, bg = rule[y] && x % 3 === 0 ? (34 / 255) * F : 0;
      let r = bg * 0.7, g = bg * 0.8, b = bg;
      if (c > 0) {
        const [ir, ig, ib] = hsv(B.hue + 0.48 + 0.24 * pos[p], 0.2 + 0.7 * fat[p], 1);
        r += (ir - r) * c;
        g += (ig - g) * c;
        b += (ib - b) * c;
      }
      out[p * 3] = r;
      out[p * 3 + 1] = g;
      out[p * 3 + 2] = b;
    }
  // The pen: a white point as wide as the stroke it is writing, dim and
  // small while it is lifted between strokes.
  if (B.mode === "write" || B.mode === "lift") {
    const s = B.strokes[min(B.si, B.strokes.length - 1)];
    let i = 0;
    while (i < s.cum.length - 1 && s.cum[i + 1] <= B.d) i++;
    const rr = B.mode === "write" ? width(B, s, i)[0] / 2 + 0.4 : 1;
    const v = B.mode === "write" ? 1 : 0.6, [px, py] = B.pen;
    for (let y = max(0, floor(py - rr - 1)); y <= min(H - 1, ceil(py + rr + 1)); y++)
      for (let x = max(0, floor(px - rr - 1)); x <= min(W - 1, ceil(px + rr + 1)); x++) {
        const c = cl(rr - sqrt((x - px) ** 2 + (y - py) ** 2) + 0.5, 0, 1), p = (y * W + x) * 3;
        for (let j = 0; j < 3; j++) out[p + j] += (v - out[p + j]) * c;
      }
  }
  for (let p = 0; p < N; p++) display.setPixel(p % W, floor(p / W), out[p * 3] * 255, out[p * 3 + 1] * 255, out[p * 3 + 2] * 255);
}
