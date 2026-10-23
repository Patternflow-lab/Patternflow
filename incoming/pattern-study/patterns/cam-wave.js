// ===== Patternflow pattern =====
// Title:   Cam Wave
// Family:  machine
// Idea:    A camshaft turns at the foot of the panel, every cam on it keyed a little further round than its neighbour; a rod rides on each cam, slides up through two guides and lifts a beaded strip into a wave that travels across the top.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Reuben Margolin's kinetic wave sculptures, where one camshaft and its followers make a wave out of many rods
// Round:   15
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Cams=6..12, Phase=-1..1
//
// Knob 1: Hue. Turns the colours of the cams and the strip together, starting from a row that runs from teal at the near end through blue and violet to magenta at the far end.
// Knob 2: Speed. How fast the shaft turns: at 2 every cam goes round once in two seconds, at the top in 1.3, at the bottom in 20.
// Knob 3: Cams. How many cams and rods the shaft carries, from 6 to 12; the cams stay 38 LEDs tall and crowd closer along the shaft, 7.9 LEDs apart at 6 and 3.6 at 12.
// Knob 4: Phase. How far each cam is keyed past its neighbour: at the left end all alike and the rods pump together, in the middle 60 degrees so six cams make one wave, at the right end 180 degrees so neighbours move opposite and the wave stands still. The cams slide round to their new keying in about half a second.
// Buttons: K1 tap swaps the cam profile, round eccentric, then egg, then a snail drop cam that lifts each rod slowly and lets it fall.

const W = 64;
const H = 128;
const N = W * H;
const MAX = 12;
// Points around a cam's outline, for the follower's contact.
const S = 192;
const TAU = Math.PI * 2;
// The shaft runs left to right and away from us: we look along it from the
// left, so a cam's face shows at this share of its width and the far cams
// stand to the right.
const SB = 0.5;
const CB = Math.sqrt(1 - SB * SB);
// A cam's full reach from the shaft, in LEDs, and the shaft's height.
const R = 19;
const SHAFT = 97;
// The rod's width, in LEDs.
const ROD = 1.5;
// Where the wave's beads sit when every rod is at its lowest.
const WAVE = 20;
// How far the strip hangs below its top edge.
const STRIP = 4;
// Free fall for a rod that drops off a cam, in LEDs per second squared.
const FALL = 900;
const PROFILES = 3;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function hsvInto(out, o, h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

// A cam's radius at angle phi from its nose, as a share of its full reach.
// 0: a round disc bored off centre, 1: an egg, 2: a snail that climbs the
// whole way round and drops back at the nose.
function radius(kind, phi) {
  phi -= Math.floor(phi / TAU) * TAU;
  if (kind === 0) {
    const e = 0.36;
    const r = 0.64;
    const s = Math.sin(phi);
    return e * Math.cos(phi) + Math.sqrt(r * r - e * e * s * s);
  }
  if (kind === 1) {
    const c = (1 + Math.cos(phi)) / 2;
    return 0.42 + 0.58 * c * c * Math.sqrt(c);
  }
  return 0.3 + 0.7 * (1 - phi / TAU);
}

// Cams spread along the shaft so the nearest one's face and the farthest
// one's rim both stay on the panel.
function layout(P, n) {
  P.n = n;
  const span = W - 3 - 2 * SB * R - 2.5;
  P.gap = span / (n - 1);
  P.thick = Math.min(3, (0.7 * P.gap) / CB);
  P.roller = Math.min(1.7, P.gap / 2 - 0.25);
  for (let i = 0; i < n; i++) P.cx[i] = 1.5 + SB * R + i * P.gap;
}

export function setup(params) {
  const P = params;
  P.frame = new Float32Array(N * 3);
  P.alpha = new Float32Array(N);
  P.tops = new Float32Array(MAX);
  P.cx = new Float32Array(MAX);
  P.rodY = new Float32Array(MAX);
  P.rodV = new Float32Array(MAX);
  P.theta = new Float32Array(MAX);
  P.tables = [];
  for (let k = 0; k < PROFILES; k++) {
    const t = new Float32Array(S);
    for (let s = 0; s < S; s++) t[s] = radius(k, (s * TAU) / S);
    P.tables.push(t);
  }
  P.prof = new Float32Array(S);
  P.prof.set(P.tables[0]);
  P.kind = 0;
  P.from = 0;
  P.morph = 1;
  P.shaft = 0;
  P.step = Math.PI / 3;
  P.hue = 0;
  P.col = new Float32Array(MAX * 3);
  P.bead = new Float32Array(3);
  P.started = false;
  layout(P, 6);
}

// How high the roller on cam i rides over the shaft.
function contact(P, i) {
  const prof = P.prof;
  const rr = P.roller;
  const th = P.theta[i];
  let best = 0;
  for (let k = 0; k < S; k++) {
    const a = (k * TAU) / S + th;
    const r = prof[k] * R;
    const x = r * Math.cos(a);
    if (x > -rr && x < rr) {
      const h = r * Math.sin(a) + Math.sqrt(rr * rr - x * x);
      if (h > best) best = h;
    }
  }
  return best;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 6, 0.06];
  dt = Math.min(dt, 0.1);
  P.hue = k[0];
  const speed = Math.max(0.2, Math.min(3, k[1]));
  const n = Math.max(6, Math.min(MAX, Math.round(k[2])));
  const v = Math.max(-1, Math.min(1, k[3]));
  // Degrees between neighbours: 0 at the left end, 60 in the middle, 180 at the right.
  const target = ((v < 0 ? 60 * (1 + v) : 60 + 120 * v) * Math.PI) / 180;
  if (n !== P.n) {
    layout(P, n);
    P.started = false;
  }
  if (input.btnPressed && input.btnPressed[0]) {
    P.from = P.kind;
    P.kind = (P.kind + 1) % PROFILES;
    P.morph = 0;
  }
  // A new profile grows out of the old one over half a second.
  if (P.morph < 1) {
    P.morph = Math.min(1, P.morph + dt * 2);
    const a = P.tables[P.from];
    const b = P.tables[P.kind];
    const m = P.morph * P.morph * (3 - 2 * P.morph);
    for (let s = 0; s < S; s++) P.prof[s] = a[s] + (b[s] - a[s]) * m;
  }
  // Re-keying the cams when Phase turns: each slides round to its new place.
  P.step += (target - P.step) * (P.started ? Math.min(1, dt * 4) : 1);
  P.shaft += speed * Math.PI * 0.5 * dt;
  for (let i = 0; i < P.n; i++) {
    P.theta[i] = P.shaft - i * P.step;
    const h = contact(P, i);
    // A rod is pushed up by its cam at once, but falls no faster than gravity.
    if (!P.started || h >= P.rodY[i]) {
      P.rodY[i] = h;
      P.rodV[i] = 0;
    } else {
      P.rodV[i] += FALL * dt;
      P.rodY[i] = Math.max(h, P.rodY[i] - P.rodV[i] * dt);
      if (P.rodY[i] === h) P.rodV[i] = 0;
    }
  }
  P.started = true;
}


// The frame and its coverage. Things nearer the eye are drawn first and each
// later one only shows where the nearer ones left the LED uncovered.
let OUT = null;
let ALPHA = null;

function under(x, y, a, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const q = y * W + x;
  const left = 1 - ALPHA[q];
  if (left < 0.003) return;
  const w = left * (a > 1 ? 1 : a);
  const o = q * 3;
  OUT[o] += r * w;
  OUT[o + 1] += g * w;
  OUT[o + 2] += b * w;
  ALPHA[q] += w;
}

// A round dot with a soft edge, so it glides between LEDs.
function dot(x, y, rad, r, g, b) {
  for (let yy = Math.floor(y - rad - 1); yy <= Math.ceil(y + rad + 1); yy++)
    for (let xx = Math.floor(x - rad - 1); xx <= Math.ceil(x + rad + 1); xx++) {
      const dx = xx + 0.5 - x;
      const dy = yy + 0.5 - y;
      under(xx, yy, rad + 0.5 - Math.sqrt(dx * dx + dy * dy), r, g, b);
    }
}

// atan2 to about 1e-5 of a radian, which is plenty for an outline on LEDs.
function angle(y, x) {
  const ax = x < 0 ? -x : x;
  const ay = y < 0 ? -y : y;
  const a = (ax < ay ? ax : ay) / ((ax > ay ? ax : ay) + 1e-9);
  const s = a * a;
  let r = ((-0.0464964749 * s + 0.15931422) * s - 0.327622764) * s * a + a;
  if (ay > ax) r = 1.5707963 - r;
  if (x < 0) r = 3.1415927 - r;
  return y < 0 ? -r : r;
}

// How far an LED centre at (px, py) is inside the outline of a cam face
// whose axle shows at screen x ax, measured in LEDs on the panel. Leaves the
// in-plane position in hit.
const hit = { u: 0, v: 0, r: 0, a: 0 };
function inside(prof, th, ax, px, py, low) {
  const u = (px - ax) / SB;
  const v = SHAFT - py;
  const r = Math.sqrt(u * u + v * v);
  hit.u = u;
  hit.v = v;
  hit.r = r;
  if (r > R + 2) return -2;
  if (r < low - 3) return 2;
  const a = angle(v, u);
  hit.a = a;
  let f = ((a - th) * S) / TAU;
  f -= Math.floor(f / S) * S;
  const k0 = f | 0;
  const k1 = k0 + 1 === S ? 0 : k0 + 1;
  const ca = r > 0 ? u / r : 1;
  const sa = r > 0 ? v / r : 0;
  const radial = Math.sqrt(ca * ca * SB * SB + sa * sa);
  // A snail's drop is a straight edge out from the axle: near it, blend the
  // high side and the low side by how far the LED sits from the edge.
  const jump = prof[0] - prof[S - 1];
  if (jump > 0.02) {
    const side = (f > S / 2 ? f - S : f) * (TAU / S) * r;
    if (side > -2.5 && side < 2.5) {
      const w = clamp01(0.5 + side * Math.sqrt(sa * sa * SB * SB + ca * ca));
      return w * clamp01((prof[0] * R - r) * radial + 0.5) + (1 - w) * clamp01((prof[S - 1] * R - r) * radial + 0.5) - 0.5;
    }
  }
  const edge = (prof[k0] + (prof[k1] - prof[k0]) * (f - k0)) * R;
  return (edge - r) * radial;
}

export function draw(display, params) {
  const P = params;
  OUT = P.frame;
  ALPHA = P.alpha;
  OUT.fill(0);
  ALPHA.fill(0);
  const n = P.n;
  const prof = P.prof;
  const col = P.col;
  const rr = P.roller;
  const thick = P.thick * CB;
  const gap = P.gap;
  // Hues run along the shaft; the far cams sit a little deeper in shadow.
  for (let i = 0; i < n; i++) hsvInto(col, i * 3, 0.47 + P.hue + (0.36 * i) / (n - 1), 0.8, 0.97 - (0.22 * i) / (n - 1));

  let low = Infinity;
  for (let s = 0; s < S; s++) low = Math.min(low, prof[s]);
  const rest = low * R + rr;
  const lowR = low * R;
  const tops = P.tops;
  for (let i = 0; i < n; i++) tops[i] = WAVE - (P.rodY[i] - rest);
  const guide1 = Math.round(SHAFT - R - rr * 2 - 6);
  const guide2 = Math.round((guide1 + WAVE) / 2 + 4);

  // The beads on the rod tops, and the strip they carry. The strip's height
  // is worked out once per column, so it only ever moves up and down.
  for (let i = 0; i < n; i++) dot(P.cx[i], tops[i], 1.7, 255, 246, 228);
  const first = P.cx[0];
  const last = P.cx[n - 1];
  const bead = P.bead;
  let seg = 0;
  for (let x = Math.floor(first); x <= Math.ceil(last); x++) {
    const px = Math.max(first, Math.min(last, x + 0.5));
    while (seg < n - 2 && px > P.cx[seg + 1]) seg++;
    const t = (px - P.cx[seg]) / (P.cx[seg + 1] - P.cx[seg]);
    const y1 = tops[seg];
    const y2 = tops[seg + 1];
    const y0 = seg > 0 ? tops[seg - 1] : 2 * y1 - y2;
    const y3 = seg + 2 < n ? tops[seg + 2] : 2 * y2 - y1;
    // Catmull-Rom through the bead heights.
    const y = 0.5 * (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t * t + (-y0 + 3 * y1 - 3 * y2 + y3) * t * t * t);
    hsvInto(bead, 0, 0.47 + P.hue + 0.36 * clamp01((px - first) / (last - first)), 0.75, 1);
    const top = y - 1;
    const bot = y + STRIP;
    for (let yy = Math.floor(top); yy <= Math.ceil(bot); yy++) {
      const a = Math.min(bot, yy + 1) - Math.max(top, yy);
      if (a <= 0) continue;
      // Bright along the top edge, deeper underneath.
      const k = (yy + 0.5 - top) / (bot - top);
      const s = k < 0.25 ? 1 : 1 - 0.55 * (k - 0.25);
      const wv = k < 0.25 ? 0.35 : 0;
      under(x, yy, a, (bead[0] + (255 - bead[0]) * wv) * s, (bead[1] + (255 - bead[1]) * wv) * s, (bead[2] + (255 - bead[2]) * wv) * s);
    }
  }

  // Brass bushings where each rod passes a guide, then the guides.
  const bw = Math.min(2, gap / 2 - 0.7);
  for (let i = 0; i < n; i++) {
    const x = P.cx[i];
    for (const g of [guide1, guide2])
      for (let y = g - 1; y <= g + 3; y++)
        for (let xx = Math.floor(x - bw - 1); xx <= Math.floor(x + bw + 1); xx++) {
          const s = y === g - 1 ? 1.15 : y === g + 3 ? 0.7 : 1;
          under(xx, y, bw + 0.5 - Math.abs(xx + 0.5 - x), 212 * s, 166 * s, 74 * s);
        }
  }
  for (const g of [guide1, guide2])
    for (let x = 0; x < W; x++) {
      under(x, g, 1, 78, 90, 120);
      under(x, g + 1, 1, 52, 60, 86);
      under(x, g + 2, 1, 34, 40, 58);
    }

  // Cams from the nearest to the farthest, each after its own roller and rod.
  for (let i = 0; i < n; i++) {
    const ax = P.cx[i];
    const th = P.theta[i];
    const cr = col[i * 3];
    const cg = col[i * 3 + 1];
    const cb = col[i * 3 + 2];
    const yb = SHAFT - P.rodY[i];
    dot(ax, yb, rr - 0.1, 240, 192, 96);
    const yt = tops[i];
    const xa = ax - ROD / 2;
    const xb = ax + ROD / 2;
    for (let xx = Math.floor(xa); xx <= Math.floor(xb); xx++) {
      const a = Math.min(xb, xx + 1) - Math.max(xa, xx);
      if (a <= 0) continue;
      const shine = xx + 0.5 < ax ? 1.15 : 0.8;
      for (let y = Math.floor(yt); y <= Math.ceil(yb); y++) under(xx, y, a * clamp01(Math.min(yb, y + 1) - Math.max(yt, y)), 160 * shine, 168 * shine, 186 * shine);
    }

    const hole = 0.14 * R;
    const hu = Math.cos(th) * R * 0.56;
    const hv = Math.sin(th) * R * 0.56;
    for (let y = Math.floor(SHAFT - R - 1); y <= Math.ceil(SHAFT + R + 1); y++) {
      const py = y + 0.5;
      const vv = SHAFT - py;
      const half = Math.sqrt(Math.max(0, (R + 1.5) * (R + 1.5) - vv * vv)) * SB;
      const x0 = Math.max(0, Math.floor(ax - half - 1));
      const x1 = Math.min(W - 1, Math.ceil(ax + half + thick + 1));
      for (let x = x0; x <= x1; x++) {
        if (ALPHA[y * W + x] > 0.997) continue;
        const px = x + 0.5;
        const d = inside(prof, th, ax, px, py, lowR);
        const face = clamp01(d + 0.5);
        if (face > 0) {
          const u = hit.u;
          const v = hit.v;
          const r = hit.r;
          // Light from the top left: the face's edge catches it there.
          const lit = clamp01(1 - d / 1.4) * clamp01((v - u * 0.4) / Math.max(1, r));
          let fr = cr + (255 - cr) * 0.45 * lit;
          let fg = cg + (255 - cg) * 0.45 * lit;
          let fb = cb + (255 - cb) * 0.45 * lit;
          let cover = face;
          // A lightening hole toward the nose: what is behind shows through.
          const hx = (u - hu) * SB;
          const hy = v - hv;
          cover *= 1 - clamp01(hole * 0.75 + 0.5 - Math.sqrt(hx * hx + hy * hy));
          // The hub and the shaft's end, steel.
          const hub = clamp01(2.6 - r * 0.75);
          if (hub > 0) {
            const s = r < 1.6 ? 0.7 : 1;
            fr += (180 * s - fr) * hub;
            fg += (186 * s - fg) * hub;
            fb += (200 * s - fb) * hub;
            cover = Math.max(cover, hub * face);
          }
          under(x, y, cover, fr, fg, fb);
          if (face >= 1 && cover >= 1) continue;
        }
        // The rim: the outline swept back along the shaft to the far face,
        // lit on top and in shade underneath.
        const rim = clamp01(inside(prof, th, ax + thick, px, py, lowR) + 0.5);
        if (rim > 0) {
          const s = 0.38 + 0.35 * clamp01(0.5 + (0.6 * hit.v) / Math.max(1, hit.r));
          under(x, y, rim, cr * s, cg * s, cb * s);
        }
      }
    }
  }

  // The shaft, seen between the cams, and the frame that carries it.
  for (let y = SHAFT - 2; y <= SHAFT + 1; y++)
    for (let x = 2; x < W - 2; x++) {
      const s = y === SHAFT - 2 ? 1.2 : y === SHAFT + 1 ? 0.55 : 0.85;
      under(x, y, 1, 150 * s, 156 * s, 172 * s);
    }
  for (let y = guide2; y < H; y++) {
    for (const x of [0, W - 2]) {
      under(x, y, 1, 84, 94, 124);
      under(x + 1, y, 1, 54, 62, 86);
    }
  }
  for (let y = H - 4; y < H; y++)
    for (let x = 0; x < W; x++) {
      const s = y === H - 4 ? 1.25 : 0.8;
      under(x, y, 1, 60 * s, 68 * s, 94 * s);
    }

  const out = OUT;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      display.setPixel(x, y, Math.min(255, out[p]), Math.min(255, out[p + 1]), Math.min(255, out[p + 2]));
    }
}
