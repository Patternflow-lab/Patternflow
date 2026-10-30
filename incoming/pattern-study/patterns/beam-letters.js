// ===== Patternflow pattern =====
// Title:   Beam Letters
// Family:  type
// Idea:    One electron beam writes a few short words stacked down the tall screen the way an oscilloscope in XY mode writes text, along the strokes of a single-stroke font at a limited slew rate and blanked as it jumps from one stroke to the next, so the phosphor glows hottest where the beam slows into corners, turns and stroke ends and stays dimmer along long fast strokes, the glow fades behind the spot, and the writing order shows as a bright sweep running line by line through the words until, with the beam fast enough, the text stands steady with a faint refresh shimmer.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: single-stroke fonts for vector displays and plotters after the Hershey fonts (Allen V. Hershey, U.S. Naval Weapons Laboratory, 1967), with letters drawn for this pattern as lines and arcs; phosphor persistence on a cathode-ray tube driven in XY mode; pattern round 79
// Round:   79
// ===============================
// @matrix 64x128
// @knobs Phosphor=0..1, Speed=0.2..3, Persistence=0..1, Focus=0..1
//
// Knob 1: Phosphor. P31, the green of oscilloscopes, below 0.25; then P7, the radar phosphor whose blue-white flash leaves a long yellow-green afterglow; P11 blue from 0.5; P4, the white of black-and-white television, from 0.75.
// Knob 2: Speed. How many steps of the beam's path go by a second. At 2 the beam's top speed is 3360 LEDs a second and LET THERE BE LIGHT is written 2.25 times a second, so a bright sweep runs line by line through words that stay readable behind it; at 3 the top speed is 66500 LEDs a second, the text is rewritten 44 times a second and stands steady; at 0.2 the beam crawls at 105 LEDs a second and takes 14 s over the four lines. Between those three the rate goes evenly in its logarithm. A message holds for 8 s, or one pass if that is longer.
// Knob 3: Persistence. The phosphor's time constant: 0.1 s at 0, 0.32 s at a quarter, 1 s at a half, 3.2 s at three quarters and 10 s at 1. At the opening the line the beam left 0.3 s ago gives 5% of the light it gave as it was written; at a half the oldest line keeps 64% and the text stands nearly evenly; from three quarters on the light takes seconds to build and the old message stays under the new one, at 1 for longer than a message holds, so two or three lie over each other.
// Knob 4: Focus. The spot's size, a Gaussian 0.55 LEDs wide (one sigma) up to the opening 0.06, growing to 2.4 LEDs at 1, where the lines bloom into soft bars and the letters only just read.

// A vector display draws nothing but lines: the deflection plates steer one
// spot, and the spot lights the phosphor wherever it goes while the beam is
// on. Text on such a screen is a display list, letter after letter of short
// polylines, and the beam is switched off (blanked) while it jumps from the
// end of one stroke to the start of the next. Here each letter is a few
// strokes of lines and arcs on a grid 24 units high, in the spirit of
// Hershey's single-stroke Roman, and each line of a message is scaled to its
// own width, as a stroke font can be.
//
// The deflection cannot move the spot at any speed. The beam has a top speed
// and a top acceleration, so it slows down into every corner, the more the
// sharper the turn, and comes to rest at both ends of a stroke, where it
// waits a moment for the beam to switch. The beam current is constant, so
// the energy a stretch of phosphor takes is the time the spot spends on it:
// long fast strokes are faint, turns and stroke ends glow, and a dot is a
// spot that only waits. The path is sampled once at equal steps of beam
// time, and the Speed knob only says how many of those steps a second take.
//
// The phosphor stores the energy and gives it back as light, its store
// decaying as exp(-t / tau), so the light it gives is the store over tau. A
// short second component flashes for 0.035 s where the beam has just been:
// on most phosphors a hotter, whiter tint, on P7 its blue. When the beam
// writes the whole list many times within tau the screen shows the steady
// average, the same brightness at every speed; when it writes slower than
// tau only the last stretch glows and the writing order is there to read.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, sqrt, exp, cos, sin, acos, hypot, ceil, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- The font. [advance width, strokes] on a grid 24 high, y down. M starts
// a stroke, L draws to a point, A cx,cy,rx,ry,from,to draws an arc in
// degrees (0 at the right, 90 at the bottom) on from the pen.
const GLYPHS = {
  A: [16, "M0,24 L8,0 L16,24 M3,16 L13,16"],
  B: [14, "M0,24 L0,0 L8,0 A8,5.5,5.5,5.5,-90,90 L0,11 M8,11 A8,17.5,6,6.5,-90,90 L0,24"],
  C: [15, "A8,12,8,12,-40,-320"],
  D: [15, "M0,0 L0,24 L4,24 A4,12,11,12,90,-90 L0,0"],
  E: [13, "M13,0 L0,0 L0,24 L13,24 M0,12 L10,12"],
  F: [13, "M13,0 L0,0 L0,24 M0,12 L10,12"],
  G: [16, "A8,12,8,12,-40,-360 L9,12"],
  H: [14, "M0,0 L0,24 M14,0 L14,24 M0,12 L14,12"],
  I: [0, "M0,0 L0,24"],
  J: [11, "M11,0 L11,18 A5.5,18,5.5,6,0,180"],
  K: [14, "M0,0 L0,24 M14,0 L0,16 M4.5,11 L14,24"],
  L: [12, "M0,0 L0,24 L12,24"],
  M: [18, "M0,24 L0,0 L9,24 L18,0 L18,24"],
  N: [15, "M0,24 L0,0 L15,24 L15,0"],
  O: [16, "A8,12,8,12,-90,270"],
  P: [14, "M0,24 L0,0 L8,0 A8,6,6,6,-90,90 L0,12"],
  Q: [16, "A8,12,8,12,-90,270 M10,18 L16,25"],
  R: [14, "M0,24 L0,0 L8,0 A8,6,6,6,-90,90 L0,12 M7,12 L14,24"],
  S: [14, "A7,6,6.5,6,-25,-270 A7,18,7,6,-90,155"],
  T: [14, "M0,0 L14,0 M7,0 L7,24"],
  U: [14, "M0,0 L0,17 A7,17,7,7,180,0 L14,0"],
  V: [16, "M0,0 L8,24 L16,0"],
  W: [20, "M0,0 L5,24 L10,6 L15,24 L20,0"],
  X: [14, "M0,0 L14,24 M14,0 L0,24"],
  Y: [14, "M0,0 L7,12 L14,0 M7,12 L7,24"],
  Z: [14, "M0,0 L14,0 L0,24 L14,24"],
};
const GAP = 6;

// The first words of four new ways to send words: Genesis 1:3, the first
// telegraph line from Washington to Baltimore (Samuel Morse, 24 May 1844),
// Alexander Graham Bell's first call to his assistant (10 March 1876), and
// the first two letters of LOGIN that reached SRI from UCLA over the ARPANET
// (29 October 1969) before the host there crashed.
const MESSAGES = [
  ["LET", "THERE", "BE", "LIGHT"],
  ["WHAT", "HATH", "GOD", "WROUGHT"],
  ["MR", "WATSON", "COME", "HERE"],
  ["LO"],
];
const HOLD = 8;

// Glyph strokes in its own units: an array of flat [x0, y0, x1, y1, ...].
function glyphStrokes(src) {
  const out = [];
  let cur = null;
  for (const tok of src.split(" ")) {
    const op = tok[0], a = tok.slice(1).split(",").map(Number);
    if (op === "M") {
      cur = [a[0], a[1]];
      out.push(cur);
    } else if (op === "L") cur.push(a[0], a[1]);
    else {
      const [cx, cy, rx, ry, a0, a1] = a, n = max(4, ceil(Math.abs(a1 - a0) / 15));
      for (let i = 0; i <= n; i++) {
        const t = ((a0 + ((a1 - a0) * i) / n) * PI) / 180, x = cx + rx * cos(t), y = cy + ry * sin(t);
        if (i === 0 && cur && hypot(cur[cur.length - 2] - x, cur[cur.length - 1] - y) < 0.01) continue;
        if (i === 0 && !cur) {
          cur = [];
          out.push(cur);
        }
        cur.push(x, y);
      }
    }
  }
  return out;
}

// A message laid out on the panel: four lines 22 LEDs tall with 9 between,
// or one line twice that, each line squeezed sideways to fit 60 LEDs.
function layout(lines) {
  const n = lines.length, capH = n === 1 ? 44 : floor((118 - (n - 1) * 9) / n), sy = capH / 24;
  const strokes = [];
  let y0 = (H - (n * capH + (n - 1) * 9)) / 2;
  for (const line of lines) {
    let uw = 0;
    for (const ch of line) uw += GLYPHS[ch][0];
    uw += GAP * (line.length - 1);
    // A line too long for the width is squeezed, but to no less than 0.65
    // of the font's own width; past that it is set smaller instead.
    const sx = min(sy, 58 / uw), ly = min(sy, sx / 0.65), yl = y0 + ((sy - ly) * 24) / 2;
    let ux = 0;
    const x0 = (W - uw * sx) / 2;
    for (const ch of line) {
      for (const st of glyphStrokes(GLYPHS[ch][1])) {
        const p = [];
        for (let i = 0; i < st.length; i += 2) p.push(x0 + (ux + st[i]) * sx, yl + st[i + 1] * ly);
        strokes.push(p);
      }
      ux += GLYPHS[ch][0] + GAP;
    }
    y0 += capH + 9;
  }
  return strokes;
}

// ---- The beam. Units are LEDs and steps of beam time. The top speed is
// VMAX LEDs a step and the deflection can stop from it within 3.5 LEDs;
// a turn through angle a caps the speed at VMAX (1 - a / pi)^1.5, so a right
// angle at 35% and the apex of the A at 10%. The beam rests DWELL steps on
// at each end of a stroke, and a blanked jump runs at 1.7 VMAX and settles
// for SETTLE steps.
const VMAX = 0.35, ACC = (VMAX * VMAX) / 7, VMIN = 0.02, DWELL = 8, VJUMP = 0.6, SETTLE = 3;

function trace(strokes) {
  const xs = [], ys = [];
  let px = null, py = null;
  const jump = (x1, y1) => {
    const n = ceil(hypot(x1 - px, y1 - py) / VJUMP) + SETTLE;
    for (let i = 0; i < n; i++) {
      xs.push(-1);
      ys.push(-1);
    }
  };
  for (const st of strokes) {
    const n = st.length / 2;
    if (px !== null) jump(st[0], st[1]);
    const v = new Float64Array(n), len = new Float64Array(n);
    for (let i = 0; i < n - 1; i++) len[i] = hypot(st[2 * i + 2] - st[2 * i], st[2 * i + 3] - st[2 * i + 1]);
    for (let i = 1; i < n - 1; i++) {
      const ax = st[2 * i] - st[2 * i - 2], ay = st[2 * i + 1] - st[2 * i - 1], bx = st[2 * i + 2] - st[2 * i], by = st[2 * i + 3] - st[2 * i + 1];
      const c = (ax * bx + ay * by) / max(1e-9, hypot(ax, ay) * hypot(bx, by));
      v[i] = VMAX * (1 - acos(cl(c, -1, 1)) / PI) ** 1.5;
    }
    for (let i = 1; i < n; i++) v[i] = min(v[i], sqrt(v[i - 1] ** 2 + 2 * ACC * len[i - 1]));
    for (let i = n - 2; i >= 0; i--) v[i] = min(v[i], sqrt(v[i + 1] ** 2 + 2 * ACC * len[i]));
    for (let k = 0; k < DWELL; k++) {
      xs.push(st[0]);
      ys.push(st[1]);
    }
    let s = 0;
    for (let i = 0; i < n - 1; i++) {
      const l = len[i], v0 = v[i], v1 = v[i + 1];
      if (l < 1e-6) continue;
      const vat = (q) => min(VMAX, sqrt(v0 * v0 + 2 * ACC * max(0, q)), sqrt(v1 * v1 + 2 * ACC * max(0, l - q)));
      while (s < l) {
        const u = s / l;
        xs.push(st[2 * i] + (st[2 * i + 2] - st[2 * i]) * u);
        ys.push(st[2 * i + 1] + (st[2 * i + 3] - st[2 * i + 1]) * u);
        s += max(VMIN, vat(s + 0.5 * vat(s)));
      }
      s -= l;
    }
    for (let k = 0; k < DWELL; k++) {
      xs.push(st[2 * n - 2]);
      ys.push(st[2 * n - 1]);
    }
    px = st[2 * n - 2];
    py = st[2 * n - 1];
  }
  // The retrace to the first stroke, blanked.
  jump(strokes[0][0], strokes[0][1]);
  return { xs: Float32Array.from(xs), ys: Float32Array.from(ys) };
}

// ---- Phosphors: the main glow's colour, the flash's colour and the flash's
// share of the energy. Light is turned into a colour channel by channel as
// 1 - exp(-light * weight), so a hot spot runs to white.
const PHOSPHORS = [
  { m: [0.3, 1, 0.36], f: [0.75, 1, 0.8], ff: 0.35 }, // P31
  { m: [0.55, 1, 0.12], f: [0.5, 0.72, 1], ff: 1.2 }, // P7
  { m: [0.22, 0.6, 1.8], f: [0.9, 1.1, 1.8], ff: 0.35 }, // P11
  { m: [0.82, 0.88, 1], f: [1, 1, 1], ff: 0.35 }, // P4
];
const TAUF = 0.035, GAIN = 1700, CAP = 30000;
// Steps a second: R0 at Speed 0.2, R2 at 2 and R3 at 3, evenly in the
// logarithm between them.
const R0 = 300, R2 = 9600, R3 = 190000;

export function setup(params) {
  params.s = {
    paths: MESSAGES.map((m) => trace(layout(m))),
    msg: 0, pos: 0, acc: 0, held: 0, sigma: 0.45,
    E: new Float32Array(N), F: new Float32Array(N),
    tm: new Float32Array(N), tf: new Float32Array(N), tmp: new Float32Array(N),
    tau: 0.12, ph: PHOSPHORS[0],
  };
}

// Separable Gaussian blur of a buffer in place: the spot.
function blur(b, tmp, sigma) {
  const r = max(1, ceil(sigma * 2.5)), k = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const w = exp(-(i * i) / (2 * sigma * sigma));
    k.push(w);
    sum += w;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) {
        const xx = x + i;
        if (xx >= 0 && xx < W) a += b[y * W + xx] * k[i + r];
      }
      tmp[y * W + x] = a;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) {
        const yy = y + i;
        if (yy >= 0 && yy < H) a += tmp[yy * W + x] * k[i + r];
      }
      b[y * W + x] = a;
    }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.ph = PHOSPHORS[min(3, floor(cl(k[0] || 0, 0, 1) * 4))];
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.tau = 0.1 * 100 ** cl(k[2] || 0, 0, 1);
  // The spot is 0.55 LEDs up to the opening 0.06 and 2.4 LEDs at 1.
  S.sigma = 0.55 + 1.85 * max(0, (cl(k[3] == null ? 0.06 : k[3], 0, 1) - 0.06) / 0.94) ** 1.3;
  const R = speed <= 2 ? R2 * (R0 / R2) ** ((2 - speed) / 1.8) : R2 * (R3 / R2) ** (speed - 2), tau = S.tau;
  S.acc += d * R;
  let n = floor(S.acc);
  S.acc -= n;
  S.held += d;
  const tm = S.tm, tf = S.tf;
  tm.fill(0);
  tf.fill(0);
  // Steps older than CAP are too faded to show: skip them unseen.
  let skip = max(0, n - CAP);
  n -= skip;
  const q = 1 / R, rm = exp(1 / (R * tau)), rf = exp(1 / (R * TAUF)), ff = S.ph.ff;
  let wm = q * exp(-(n - 1) / (R * tau)), wf = q * ff * exp(-(n - 1) / (R * TAUF));
  let path = S.paths[S.msg];
  const step = () => {
    S.pos++;
    if (S.pos >= path.xs.length) {
      S.pos = 0;
      if (S.held >= HOLD) {
        S.held = 0;
        S.msg = (S.msg + 1) % MESSAGES.length;
        path = S.paths[S.msg];
      }
    }
  };
  while (skip-- > 0) step();
  for (let i = 0; i < n; i++) {
    const x = path.xs[S.pos], y = path.ys[S.pos];
    if (x >= 0) {
      const x0 = floor(x), y0 = floor(y), fx = x - x0, fy = y - y0;
      for (let j = 0; j < 4; j++) {
        const xx = x0 + (j & 1), yy = y0 + (j >> 1);
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        const w = (j & 1 ? fx : 1 - fx) * (j >> 1 ? fy : 1 - fy), p = yy * W + xx;
        tm[p] += wm * w;
        tf[p] += wf * w;
      }
    }
    wm *= rm;
    wf *= rf;
    step();
  }
  blur(tm, S.tmp, S.sigma);
  blur(tf, S.tmp, S.sigma);
  const dm = exp(-d / tau), df = exp(-d / TAUF), E = S.E, F = S.F;
  for (let p = 0; p < N; p++) {
    E[p] = E[p] * dm + tm[p];
    F[p] = F[p] * df + tf[p];
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const E = S.E, F = S.F, m = S.ph.m, f = S.ph.f, gm = GAIN / S.tau, gf = GAIN / TAUF;
  for (let p = 0; p < N; p++) {
    const a = E[p] * gm, b = F[p] * gf;
    display.setPixel(p % W, floor(p / W),
      round(255 * (1 - exp(-(a * m[0] + b * f[0])))),
      round(255 * (1 - exp(-(a * m[1] + b * f[1])))),
      round(255 * (1 - exp(-(a * m[2] + b * f[2])))));
  }
}
