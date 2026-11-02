// ===== Patternflow pattern =====
// Title:   Great Wave
// Family:  print
// Idea:    Hokusai's great wave stood up on the tall panel as a woodblock print in flat colours: the wave rises as a wall up the left edge and curls over at the top, its claws of foam hanging over the trough, a second swell climbs in from the lower right, and small Mount Fuji sits in the V between them under a grey band of sky. The blocks stay put and the water in them runs: white flecks ride up the dark tongues, the pale seams between them sway, the claws open and close, spray drifts down over the mountain like snow, and the boat rides the swell.
// Author:  patternflow-lab
// Date:    2026-11-02
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: after Katsushika Hokusai's Under the Wave off Kanagawa (about 1831), cut again for a tall panel as flat colour blocks with an indigo key line
// Round:   98
// ===============================
// @matrix 64x128
// @knobs Light=0..1, Flow=0..3, Grain=0..1, Break=0..1
//
// Knob 1: Light. The time of day: 0 is the print's own cream daylight, 1/3 a pink dawn, 2/3 an orange dusk with a red mountain, 1 a moonlit night in indigo; between them two neighbouring printings are mixed.
// Knob 2: Flow. How fast the water in the blocks runs, the flecks, the seams, the claws, the spray and the boat on one clock: 2 is as cut, 0 stops it like a print on the wall.
// Knob 3: Grain. How broad the cutter's lines are: 0 keeps the print's fine seams and narrow tongues, 1 widens tongues and stripes into bold gouges.
// Knob 4: Break. How hard the crest breaks: near the bottom the claws keep their grip and spray falls now and then; turned up, they reach further and spray pours over the mountain.
// Buttons: K1 tap is the moment the wave comes down: every claw reaches out at once and a burst of spray falls into the trough, then the sea settles.

const W = 64;
const H = 128;
const N = W * H;

// Blocks. Each is one colour in each printing below.
const SKY = 0;
const SKY2 = 1;
const SKY3 = 2;
const SKY4 = 3;
const DEEP = 4;
const MID = 5;
const PALE = 6;
const FOAM = 7;
const LINE = 8;
const BOAT = 9;
const BOATD = 10;
const ROWER = 11;
const HEAD = 12;
const FUJI = 13;
const SNOW = 14;
const SPRAY = 15;

// Four printings of the same blocks, in block order: day (the print's own),
// dawn, dusk and night. Light walks through them.
const PRINTINGS = [
  [
    [228, 218, 190], [206, 200, 180], [172, 168, 154], [134, 132, 124],
    [24, 50, 108], [62, 108, 164], [158, 190, 204], [242, 240, 228],
    [22, 32, 66], [228, 190, 140], [168, 122, 86], [34, 52, 98],
    [232, 222, 196], [62, 84, 120], [246, 246, 238], [250, 250, 244],
  ],
  [
    [236, 202, 196], [222, 178, 182], [186, 150, 166], [142, 118, 142],
    [34, 46, 112], [84, 104, 172], [178, 182, 216], [246, 234, 236],
    [30, 28, 72], [234, 182, 152], [170, 112, 98], [44, 46, 104],
    [238, 214, 206], [126, 74, 106], [250, 236, 236], [252, 242, 244],
  ],
  [
    [238, 178, 112], [222, 148, 92], [186, 114, 78], [142, 84, 68],
    [24, 42, 92], [72, 92, 142], [192, 172, 170], [250, 228, 198],
    [28, 24, 54], [238, 172, 112], [172, 102, 64], [36, 40, 84],
    [244, 206, 166], [176, 64, 46], [250, 222, 192], [252, 236, 214],
  ],
  [
    [36, 50, 104], [48, 60, 112], [62, 72, 120], [78, 86, 128],
    [16, 30, 76], [42, 72, 132], [112, 142, 172], [204, 216, 232],
    [8, 12, 30], [152, 132, 112], [100, 84, 74], [20, 30, 66],
    [176, 176, 184], [44, 56, 90], [212, 222, 238], [224, 232, 246],
  ],
];

// The cut, on the panel's LEDs. The great wave: its back from the foot of
// the panel up over the crest to the lip, then its face from the lip back
// down into the hollow and out again where its foot swells into the trough. The second swell's crest, from off the right edge down
// to the foot. The small wave in front, shaped like the mountain. The boat.
const HORIZON = 97;
const MOUNT = [31, 87, 1.5, 4];
const BACK = [[-6, 128], [-4, 90], [0, 56], [8, 30], [18, 14], [30, 8], [42, 10], [50, 18], [52, 28], [48, 35]];
const FACE = [[48, 35], [45, 28], [40, 23], [32, 23], [24, 29], [18, 41], [15, 56], [15, 68], [17, 80], [20, 92], [22, 102], [21, 114], [19, 128], [18, 140]];
const CREST = 30;
const SWELL = [[70, 72], [62, 77], [54, 85], [46, 97], [39, 112], [33, 128], [30, 140]];
const FRONT = [[7, 140], [15, 124], [22, 113], [27, 108], [32, 112], [38, 121], [45, 140]];
const HULL = [21, 103, 44, 98];

// Where the pale seams between the dark tongues lie, across the wave from its face.
const SEAMS = [3.2, 6.8, 9.6, 13.4, 16.6, 20.4, 23.6, 27.2, 30.8, 34.4, 38];

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// A curve through the cut's points, sampled every half LED.
const STEP = 0.5;
function spline(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / STEP));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

// The nearest sample of a curve to (x, y): its index and the distance.
const NEAR = [0, 0];
function nearest(curve, x, y) {
  let bi = 0;
  let bd = 1e9;
  for (let i = 0; i < curve.length; i++) {
    const dx = curve[i][0] - x;
    const dy = curve[i][1] - y;
    const d = dx * dx + dy * dy;
    if (d < bd) {
      bd = d;
      bi = i;
    }
  }
  NEAR[0] = bi;
  NEAR[1] = Math.sqrt(bd);
  return NEAR;
}

// Unit normals along a curve, each pointing out of the shape it bounds.
function normals(curve, poly) {
  const out = [];
  for (let i = 0; i < curve.length; i++) {
    const a = curve[Math.max(0, i - 1)];
    const b = curve[Math.min(curve.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let nx = -(b[1] - a[1]) / l;
    let ny = (b[0] - a[0]) / l;
    if (inside(poly, curve[i][0] + nx * 1.5, curve[i][1] + ny * 1.5)) {
      nx = -nx;
      ny = -ny;
    }
    out.push([nx, ny]);
  }
  // At the very end of a curve the test above can land on the wrong side.
  out[0] = out[3].slice();
  out[1] = out[3].slice();
  return out;
}

// Zones of the cut.
const Z_SKY = 0;
const Z_SEA = 1;
const Z_SWELL = 2;
const Z_FRONT = 3;
const Z_WAVE = 4;

export function setup(params) {
  const P = params;
  P.base = new Uint8Array(N);
  P.zone = new Uint8Array(N);
  P.along = new Float32Array(N);
  P.across = new Float32Array(N);
  P.back = new Float32Array(N);
  P.frame = new Uint8Array(N);
  P.lined = new Uint8Array(N);
  P.rgb = new Float32Array(48);
  const back = spline(BACK);
  const face = spline(FACE);
  const wave = back.concat(face.slice(1));
  const swell = spline(SWELL);
  const swellPoly = swell.concat([[SWELL[SWELL.length - 1][0], 200], [80, 200]]);
  const front = spline(FRONT);
  const frontPoly = front.concat([[FRONT[FRONT.length - 1][0], 200], [FRONT[0][0], 200]]);
  P.face = face;
  P.faceN = normals(face, wave);
  P.rim = back;
  P.rimN = normals(back, wave);
  P.swell = swell;
  P.swellN = normals(swell, swellPoly);
  P.front = front;
  P.frontN = normals(front, frontPoly);
  P.peak = nearest(front, FRONT[3][0], FRONT[3][1])[0] * STEP;
  const [fx, fy, fs, snow] = MOUNT;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const cx = x + 0.5;
      const cy = y + 0.5;
      let v;
      let zone = Z_SKY;
      if (y >= HORIZON) {
        // The trough: indigo water with darker streaks lying along it.
        v = hash(Math.floor((x + 0.6 * (y - HORIZON)) / 5), y) < 0.35 || y === HORIZON ? DEEP : MID;
        zone = Z_SEA;
      } else {
        // The bokashi: the sky greys in three steps down to the horizon.
        const d = HORIZON - y;
        v = d <= 3 ? SKY4 : d <= 8 ? SKY3 : d <= 15 ? SKY2 : SKY;
      }
      if (y >= fy && y < HORIZON) {
        const half = (y - fy + 0.5) * fs;
        if (Math.abs(cx - fx) < half) v = y - fy < snow + 1.5 * Math.sin(cx * 1.7) + (Math.abs(cx - fx) < 2 ? 1 : 0) ? SNOW : FUJI;
      }
      if (inside(swellPoly, cx, cy)) {
        zone = Z_SWELL;
        const n = nearest(swell, cx, cy);
        P.along[p] = n[0] * STEP;
        P.across[p] = n[1];
      }
      if (inside(frontPoly, cx, cy)) {
        zone = Z_FRONT;
        const n = nearest(front, cx, cy);
        P.along[p] = n[0] * STEP;
        P.across[p] = n[1];
      }
      if (inside(wave, cx, cy)) {
        zone = Z_WAVE;
        const n = nearest(face, cx, cy);
        P.along[p] = n[0] * STEP;
        P.across[p] = n[1];
        P.back[p] = nearest(back, cx, cy)[1];
      }
      P.base[p] = v;
      P.zone[p] = zone;
    }
  }
  // Claws: four long talons under the great wave's lip, set far enough apart
  // for the sky to show between them, a row of fingers along the crest's
  // outer rim at uneven spacing and lengths, longer towards the lip, short
  // ones along the top of the swell, and three on the small wave's peak, as
  // [curve, sample, length, side]. Rim fingers are placed by their distance
  // back from the lip.
  P.claws = [];
  for (const [s, l] of [[0.5, 12], [8, 10], [17, 9.5], [26, 8]]) P.claws.push([0, Math.round(s / STEP), l, 1]);
  for (const [s, l] of [[6, 3.2], [10, 4.4], [17, 3], [21, 4.8], [29, 3.4], [33, 5], [42, 3.6], [46, 5.2], [53, 4], [58, 5.4]]) P.claws.push([3, P.rim.length - 1 - Math.round((62 - s) / STEP), l, 1]);
  for (let s = 9; s < 24; s += 4) P.claws.push([1, Math.round(s / STEP), 3.2, -1]);
  for (const s of [-3.5, 0, 3.5]) P.claws.push([2, Math.round((P.peak + s) / STEP), 2.6, s < 0 ? -1 : 1]);
  P.spray = [];
  P.t = 0;
  P.flow = 2;
  P.grain = 0;
  P.brk = 0.06;
  P.light = 0;
  P.crash = 0;
  P.debt = 0;
  P.started = false;
}

function curveOf(P, c) {
  return c === 0 ? [P.face, P.faceN] : c === 1 ? [P.swell, P.swellN] : c === 2 ? [P.front, P.frontN] : [P.rim, P.rimN];
}

// Where a claw's fingertip is now, for the spray to fall from.
function tip(P, i, out) {
  const [c, j, len] = P.claws[i];
  const [curve, nr] = curveOf(P, c);
  out[0] = curve[j][0] + nr[j][0] * len;
  out[1] = curve[j][1] + nr[j][1] * len + 1;
}

const TIP = [0, 0];
function spawn(P, burst) {
  const n = P.claws.length;
  // Most spray leaves the great wave's lip.
  let i = Math.floor(Math.random() * n);
  if (P.claws[i][0] !== 0 && Math.random() < 0.7) i = Math.floor(Math.random() * 8);
  tip(P, i, TIP);
  const x = Math.floor(TIP[0] + (Math.random() - 0.5) * 2);
  P.spray.push([x, TIP[1], (Math.random() - 0.3) * (burst ? 5 : 2), burst ? 2 + Math.random() * 3 : Math.random(), x + 0.5]);
}

function fall(P, dt) {
  const g = 5;
  const keep = [];
  for (const s of P.spray) {
    // A drop moves a whole LED at a time, and sideways only as it drops a
    // row, so it never cuts the corner of an LED for a single frame.
    s[3] = Math.min(s[3] + g * dt, 8);
    s[4] += s[2] * dt + 1.2 * dt;
    const row = Math.floor(s[1]);
    s[1] += s[3] * dt;
    if (Math.floor(s[1]) !== row) s[0] = Math.floor(s[4]);
    const x = s[0];
    const y = Math.floor(s[1]);
    if (x < 0 || x >= W || y >= H) continue;
    if (y >= 0 && P.zone[y * W + x] !== Z_SKY && s[1] > 40) continue;
    keep.push(s);
  }
  P.spray = keep;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(dt, 0.1);
  P.light = Math.max(0, Math.min(1, k[0]));
  P.flow = Math.max(0, Math.min(3, k[1]));
  P.grain = Math.max(0, Math.min(1, k[2]));
  P.brk = Math.max(0, Math.min(1, k[3]));
  if (input.btnPressed && input.btnPressed[0]) {
    P.crash = 1;
    for (let i = 0; i < 70; i++) spawn(P, true);
  }
  const step = dt * P.flow * 0.5;
  if (!P.started) {
    // The panel opens on a sea already moving: three seconds of spray.
    P.started = true;
    for (let i = 0; i < 90; i++) {
      P.debt += 0.033 * (2 + 14 * P.brk);
      while (P.debt >= 1) {
        P.debt -= 1;
        spawn(P, false);
      }
      fall(P, 0.033);
    }
  }
  P.t += step * 2;
  P.crash = Math.max(0, P.crash - dt * 0.5);
  P.debt += step * (2 + 14 * P.brk + 20 * P.crash);
  while (P.debt >= 1) {
    P.debt -= 1;
    spawn(P, false);
  }
  fall(P, step);
}

function put(P, x, y, v) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x >= 0 && x < W && y >= 0 && y < H) P.frame[y * W + x] = v;
}

// The great wave: a foam rim along its back at the crest, then dark tongues
// with pale seams that sway along their length, and white flecks riding up
// the upper wave towards the crest, more of them the harder it breaks; its face is pale low down and darker under the lip.
function wave(P, p) {
  const s = P.along[p];
  const d = P.across[p];
  const g = 1 + P.grain * 0.9;
  if (s < CREST + 6 && P.back[p] < 2.6 - s * 0.03) return FOAM;
  if (d < 1.2) return s < CREST ? MID : PALE;
  const w = d / g + 0.9 * Math.sin(s * 0.16 - P.t * 0.7);
  for (let i = 0; i < SEAMS.length; i++) if (Math.abs(w - SEAMS[i]) < 0.55) return s > CREST * 2.2 && i < 2 ? PALE : MID;
  if (hash(Math.floor((s + P.t * 3) / (1.1 * g)), Math.floor(d / (1.2 * g))) < (0.045 + 0.2 * P.brk) * Math.min(1, Math.max(0, (90 - s) / 30))) return FOAM;
  return DEEP;
}

// The swell and the small wave: pale water banded with dark stripes that
// run along them, a foam line on the crest, and a cap of foam on the small
// wave's peak like the mountain's snow.
function swell(P, p, front) {
  const s = P.along[p];
  const d = P.across[p];
  if (d < 1.3 + 1.6 * P.brk) return FOAM;
  if (front && d < 3.6 && Math.abs(s - P.peak) < 4 - d * 0.6) return FOAM;
  const g = 1 + P.grain * 0.9;
  const q = d / (5 * g) + 0.15 * Math.sin(s * 0.2 - P.t * 0.8);
  const f = q - Math.floor(q);
  return f < 0.3 ? DEEP : f < 0.45 ? MID : PALE;
}

// The boat, a column at a time: a long hull whose prow sweeps up into a
// point, a key line under its keel, and the rowers hunched over their oars
// in a row of dark backs and pale heads.
function boat(P) {
  const [x0, y0, x1, y1] = HULL;
  const bob = Math.round(0.9 * Math.sin(P.t * 0.6));
  const k = (y1 - y0) / (x1 - x0);
  for (let x = x0; x <= x1; x++) {
    const top = Math.round(y0 + (x - x0) * k) + bob;
    // The stern slips behind the great wave's foot.
    if (P.zone[top * W + x] === Z_WAVE) continue;
    const bow = x1 - x;
    const rise = bow < 3 ? 3 - bow : x === x0 ? 1 : 0;
    const keel = top + 2 - Math.max(0, rise - 1);
    for (let y = top - rise; y <= keel; y++) put(P, x, y, y === keel && rise < 2 ? BOATD : BOAT);
    put(P, x, keel + 1, LINE);
    const r = x - x0;
    if (r >= 4 && bow >= 5 && r % 3 !== 2) {
      put(P, x, top - 1, ROWER);
      if (r % 3 === 0) put(P, x, top - 2, HEAD);
    }
  }
}

// A claw: a finger of foam that reaches out from the crest and hooks back at
// the tip, with a shorter finger beside it. The great wave's own talons stay
// two LEDs wide for longer, stand alone, and split into a fan of three small
// fingers instead of hooking back.
function claw(P, i) {
  const [c, j, len0, side] = P.claws[i];
  const [curve, nr] = curveOf(P, c);
  const [ax, ay] = curve[j];
  const [nx, ny] = nr[j];
  // Each claw opens and closes on its own beat, in steps of a fifth of a second.
  const beat = Math.floor(P.t * 5) / 5;
  const grow = 0.85 + 0.2 * Math.sin(beat * 0.6 + i * 1.7) + P.brk * 0.6 + P.crash * 0.6;
  if (c === 3) {
    // A finger on the crest's outer rim: two LEDs wide at the root, leaning towards the
    // lip and curling over at the tip.
    const len = len0 * grow;
    let ang = Math.atan2(ny, nx) + 0.4;
    let x = ax + nx * 0.4;
    let y = ay + ny * 0.4;
    for (let s = 0; s < len; s += 0.4) {
      put(P, x, y, FOAM);
      if (s < 1.2) put(P, x - Math.sin(ang), y + Math.cos(ang), FOAM);
      ang += 0.28;
      x += Math.cos(ang) * 0.4;
      y += Math.sin(ang) * 0.4;
    }
    return;
  }
  // The finger: two LEDs wide at the root, one at the end, hooking back.
  const len = len0 * grow;
  let ang = Math.atan2(ny, nx) - side * 0.5;
  let x = ax - nx * 0.6;
  let y = ay - ny * 0.6;
  const end = c === 0 ? len * 0.6 : len + 0.6;
  for (let s = 0; s < end; s += 0.4) {
    put(P, x, y, FOAM);
    if (s < len * (c === 0 ? 0.6 : 0.45)) put(P, x - Math.sin(ang) * side, y + Math.cos(ang) * side, FOAM);
    ang += side * (s < len * 0.5 ? 0.02 : 0.17);
    x += Math.cos(ang) * 0.4;
    y += Math.sin(ang) * 0.4;
  }
  if (c === 0) {
    for (const turn of [-0.75, 0, 0.75]) {
      let a = ang + turn;
      let fx = x + Math.cos(a) * 0.6;
      let fy = y + Math.sin(a) * 0.6;
      for (let s = 0; s < 3.2; s += 0.4) {
        put(P, fx, fy, FOAM);
        a += 0.12;
        fx += Math.cos(a) * 0.4;
        fy += Math.sin(a) * 0.4;
      }
    }
  }
  // A short finger on its far side, but not on the great wave's own talons.
  if (c === 0) return;
  ang = Math.atan2(ny, nx) - side * 1.3;
  x = ax - nx * 0.3 - Math.sin(ang) * side;
  y = ay - ny * 0.3 + Math.cos(ang) * side;
  for (let s = 0; s < len * 0.4; s += 0.4) {
    put(P, x, y, FOAM);
    ang += side * 0.2;
    x += Math.cos(ang) * 0.4;
    y += Math.sin(ang) * 0.4;
  }
}

const LIGHT = (v) => v === FOAM || v === SNOW || v === BOAT || v === PALE || v === HEAD;

export function draw(display, params) {
  const P = params;
  const fr = P.frame;
  const zone = P.zone;
  for (let p = 0; p < N; p++) {
    const z = zone[p];
    fr[p] = z === Z_WAVE ? wave(P, p) : z === Z_SWELL ? swell(P, p, false) : z === Z_FRONT ? -1 : P.base[p];
  }
  boat(P);
  for (let p = 0; p < N; p++) if (zone[p] === Z_FRONT) fr[p] = swell(P, p, true);
  for (let i = 0; i < P.claws.length; i++) claw(P, i);
  // The key line: one LED of indigo round every light shape that meets the sky.
  const out = P.lined;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const v = fr[p];
      out[p] = v;
      if (v > SKY4) continue;
      if ((x > 0 && LIGHT(fr[p - 1])) || (x < W - 1 && LIGHT(fr[p + 1])) || (y > 0 && LIGHT(fr[p - W])) || (y < H - 1 && LIGHT(fr[p + W]))) out[p] = LINE;
    }
  }
  // Spray falls in front of the sky and the mountain, unlined.
  for (const s of P.spray) {
    const x = Math.floor(s[0]);
    const y = Math.floor(s[1]);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const p = y * W + x;
    if (zone[p] === Z_SKY && out[p] !== LINE) out[p] = SPRAY;
  }
  // The printing: Light walks from one set of colours to the next.
  const l = P.light * 3;
  const a = Math.min(2, Math.floor(l));
  const m = l - a;
  const A = PRINTINGS[a];
  const B = PRINTINGS[a + 1];
  const rgb = P.rgb;
  for (let i = 0; i < 16; i++)
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = A[i][c] + (B[i][c] - A[i][c]) * m;
  for (let p = 0; p < N; p++) {
    const v = out[p] * 3;
    display.setPixel(p % W, (p / W) | 0, rgb[v], rgb[v + 1], rgb[v + 2]);
  }
}
