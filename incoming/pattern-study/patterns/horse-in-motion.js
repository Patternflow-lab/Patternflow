// ===== Patternflow pattern =====
// Title:   Horse in Motion
// Family:  film
// Idea:    A strip of film with sprocket holes down both edges jerks down through a projector gate one frame at a time, and in the bright frame held in the middle Muybridge's racehorse gallops through its twelve photographs while the frames above and below wait dim in the dark.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 27, after Eadweard Muybridge, The Horse in Motion (1878)
// Round:   27
// ===============================
// @matrix 64x128
// @knobs Tint=0..1, Speed=0.2..3, Subject=0..3, Lamp=-1..1
//
// Knob 1: Tint. The film stock: a sepia-toned print at 0, then amber nitrate, rose, blue-toned night stock and green at 1. The perforations always show the lamp's own warm white.
// Knob 2: Speed. Frames a second through the gate: at 2 the claw pulls down three frames a second and the horse takes four seconds over a stride; at 0.2 each frame stands in the gate for over three seconds.
// Knob 3: Subject. Which reel is laced up, one a step: at 0 Sallie Gardner galloping at Palo Alto in 1878, horse and rider dark against the white wall with its ruled lines; at 1 a greyhound at full stretch, at 2 a cockatoo in flight and at 3 a man running, pale on black cloth strung with a white thread grid in the manner of Animal Locomotion (1887). A new reel is spliced on above the panel and comes down through the gate behind a pale splice.
// Knob 4: Lamp. How much of the lamp's light reaches the strip outside the gate: at -1 only the frame in the gate shows and the rest of the reel is dark, at 1 the whole strip glows as if laid on a light box.
// Buttons: K1 tap makes the film catch in the gate. The frame stops and blisters under the lamp until a hole burns through from the middle; then the claw catches again and the burnt frame goes on down the strip with its hole still glowing at the rim.

const W = 64, H = 128;
// The strip: a frame every P rows with a frame line FL rows deep at its top,
// the picture IW by IH between the perforations from column IX, and the gate
// framing the frame whose top is on row GY. Four perforations a frame.
const P = 32, FL = 3, IW = 46, IH = P - FL, IX = 9, GY = 48, NP = 12, NI = IW * IH, NS = 4;
const { min, max, floor, ceil, round, sin, cos, sqrt, abs, atan2, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const fr = (v) => v - floor(v);
function hash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---- The photographs, drawn once into masks: how much of each picture LED
// the subject covers, 1 for its near side and FAR for limbs on the far side.
const MASK = new Float32Array(NS * NP * NI);
const FAR = 0.8;
let MO = 0;
function cap(ax, ay, bx, by, ra, rb, v) {
  const x0 = max(0, floor(min(ax - ra, bx - rb) - 1)), x1 = min(IW - 1, ceil(max(ax + ra, bx + rb)));
  const y0 = max(0, floor(min(ay - ra, by - rb) - 1)), y1 = min(IH - 1, ceil(max(ay + ra, by + rb)));
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-6;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay;
      const t = cl((px * dx + py * dy) / l2, 0, 1);
      const ex = px - t * dx, ey = py - t * dy;
      const c = cl(ra + (rb - ra) * t + 0.5 - sqrt(ex * ex + ey * ey), 0, 1) * v;
      const i = MO + y * IW + x;
      if (c > MASK[i]) MASK[i] = c;
    }
}
const dot = (x, y, r, v) => cap(x, y, x, y, r, r, v);
// The body's own frame: x forward, y down, turned by the pitch.
let BX = 0, BY = 0, BC = 1, BS = 0;
const frame = (x, y, a) => ((BX = x), (BY = y), (BC = cos(a)), (BS = sin(a)));
const wx = (x, y) => BX + x * BC - y * BS;
const wy = (x, y) => BY + x * BS + y * BC;
const bcap = (x1, y1, x2, y2, ra, rb, v) => cap(wx(x1, y1), wy(x1, y1), wx(x2, y2), wy(x2, y2), ra, rb, v);
const bdot = (x, y, r, v) => dot(wx(x, y), wy(x, y), r, v);

// Two bones from (tx, ty) towards (fx, fy), the joint bent forward (s = 1)
// or back (s = -1). Leaves the joint in JX, JY and the reached end in FX, FY.
let JX = 0, JY = 0, FX = 0, FY = 0;
function ik(tx, ty, fx, fy, a, b, s) {
  let dx = fx - tx, dy = fy - ty;
  const d = sqrt(dx * dx + dy * dy) || 1e-6;
  const dc = cl(d, abs(a - b) + 0.05, a + b - 0.02);
  (dx /= d), (dy /= d);
  const ca = (a * a + dc * dc - b * b) / (2 * a * dc), sa = sqrt(max(0, 1 - ca * ca));
  JX = tx + a * (ca * dx + s * sa * dy);
  JY = ty + a * (ca * dy - s * sa * dx);
  FX = tx + dx * dc;
  FY = ty + dy * dc;
}

// One leg of a galloping animal. c is the leg's phase from touchdown; for
// the share D of the stride the hoof stands on the ground (row GR) while the
// body passes over it, from G[0] ahead of the top joint to G[1] behind; then
// it lifts by G[2], folding (G[3] pulls it further behind first), and swings
// forward, reaching G[4] past where it lands. The top joint (tx, ty) rides a
// quarter of the sweep, hanging from the shoulder or hip (ux, uy).
// L = bones a and b with their bend, then four radii.
const GR = 26.6;
function leg(c, D, G, tx, ty, ux, uy, L, v) {
  let hx, lift = 0;
  if (c < D) hx = G[0] - ((G[0] + G[1]) * c) / D;
  else {
    const s = (c - D) / (1 - D), w = sin(PI * s);
    hx = -G[1] + (G[0] + G[1]) * ease(s) - G[3] * w * (1 - s) + G[4] * w * s * s;
    lift = G[2] * sin(PI * s ** 0.75);
  }
  const Tx = wx(tx + 0.25 * hx, ty), Ty = wy(tx + 0.25 * hx, ty);
  ik(Tx, Ty, wx(tx, ty) + hx, GR - lift, L[0], L[1], L[2]);
  cap(wx(ux, uy), wy(ux, uy), Tx, Ty, L[3], L[4], v);
  cap(Tx, Ty, JX, JY, L[4], L[5], v);
  dot(JX, JY, L[5], v);
  cap(JX, JY, FX, FY, L[5] * 0.75, L[6] * 0.7, v);
  cap(FX, FY, FX + 0.6, FY + 0.2, L[6], L[6] * 0.9, v);
}

// Sallie Gardner at a 1:40 gait, ridden by G. Domm, seen from her right.
// A transverse gallop: left hind, right hind, left fore, right fore, then
// all four hooves off the ground with the legs gathered under the belly.
const LFH = [5.2, 5.2, 1, 2.3, 1.3, 0.75, 0.8], LHH = [5.4, 5.6, -1, 3, 1.4, 0.75, 0.8];
const GFH = [6, 5, 6.5, 1.5, 2.5], GHH = [4, 7, 5.5, 0, 1.5];
function horse(c) {
  const pitch = 0.07 * sin(TAU * (c - 0.3));
  frame(21, 13.8 - 0.7 * cos(TAU * (c - 0.9)), pitch);
  const fore = (td, v) => leg(fr(c - td), 0.32, GFH, 5.4, 2.8, 6.6, -0.6, LFH, v);
  const hind = (td, v) => leg(fr(c - td), 0.32, GHH, -5, 2.4, -6.6, -1, LHH, v);
  hind(0, FAR);
  fore(0.33, FAR);
  // Barrel, chest, withers and quarters.
  bcap(-5, 0.4, 4.5, 0.2, 3.2, 3.5, 1);
  bdot(6.6, -0.2, 3.2, 1);
  bcap(3, -2.4, 6.2, -2, 2.4, 2.4, 1);
  bdot(-6.6, -0.8, 3.6, 1);
  bdot(-4.6, -1.6, 2.8, 1);
  // Neck stretched out and nodding, head, jaw and ear.
  const al = 0.6 - 0.1 * sin(TAU * (c - 0.3));
  const nx = wx(6.4, -2), ny = wy(6.4, -2);
  const px = nx + 9.4 * cos(al), py = ny - 9.4 * sin(al);
  cap(nx, ny, px, py, 2.8, 1.5, 1);
  cap(wx(7.8, 0.6), wy(7.8, 0.6), px, py + 1, 2, 1.2, 1);
  const ga = 0.85 + 0.08 * sin(TAU * (c - 0.5));
  const mx = px + 6.2 * cos(ga), my = py + 6.2 * sin(ga);
  cap(px, py, mx, my, 1.6, 0.95, 1);
  dot(px + 1.2 * cos(ga) - 0.8 * sin(ga), py + 1.2 * sin(ga) + 0.8 * cos(ga), 1.55, 1);
  cap(px - 0.3, py - 1.1, px - 1.1, py - 3, 0.55, 0.3, 1);
  // The tail streaming out behind.
  let tx = wx(-9.6, -2.2), ty = wy(-9.6, -2.2);
  const T = [-3, 1.2, 1.1, 1.2, -2.8, 1.5, 1.2, 1.3, -2.4, 2, 1.3, 0.5];
  for (let j = 0; j < 12; j += 4) {
    const ux = tx + T[j], uy = ty + T[j + 1] + (0.5 + 0.15 * j) * sin(TAU * c - j / 4);
    cap(tx, ty, ux, uy, T[j + 2], T[j + 3], 1);
    (tx = ux), (ty = uy);
  }
  hind(0.1, 1);
  fore(0.45, 1);
  // The jockey, crouched forward with short stirrups, hands on the neck.
  const sx = wx(1.5, -4.4), sy = wy(1.5, -4.4), a = 0.62 + 0.05 * sin(TAU * c);
  const hx = sx + 5.6 * sin(a), hy = sy - 5.6 * cos(a);
  cap(sx, sy, hx, hy, 1.6, 1.5, 1);
  dot(hx + 2.1 * sin(a - 0.1), hy - 2.1 * cos(a - 0.1), 1.4, 1);
  cap(hx + 2.1 * sin(a - 0.1), hy - 2.1 * cos(a - 0.1), hx + 3.6 * sin(a - 0.1), hy - 1.9 * cos(a - 0.1), 0.6, 0.4, 1);
  const kx = wx(4.8, -5.2), ky = wy(4.8, -5.2);
  cap(sx, sy, kx, ky, 1.4, 1.1, 1);
  cap(kx, ky, wx(3.6, -1.2), wy(3.6, -1.2), 1, 0.8, 1);
  const ex = hx + 1.8, ey = hy + 2.6, dx = wx(8.6, -4.6), dy = wy(8.6, -4.6);
  cap(hx, hy, ex, ey, 0.8, 0.7, 1);
  cap(ex, ey, dx, dy, 0.7, 0.6, 1);
  cap(dx, dy, mx - 0.5, my - 0.4, 0.3, 0.3, 0.7);
}

// A greyhound in the rotary gallop: forefeet, the gathered flight
// with the back arched and the hind feet reaching past the fore, hind feet,
// then the long flight stretched out flat.
const LFD = [5.2, 5.6, 1, 1.9, 1, 0.55, 0.65], LHD = [5.6, 6, -1, 2.6, 1.15, 0.55, 0.65];
const GFD = [6, 4.5, 6, 1.6, 2.5], GHD = [4, 6.5, 5, 0, 2];
function dog(c) {
  const f = cos(TAU * (c - 0.38)), hl = 6.6 - 1.4 * f;
  frame(22, 13.2 - 0.6 * f, 0.04 * sin(TAU * (c - 0.1)));
  const fore = (td, v) => leg(fr(c - td), 0.24, GFD, hl - 1.6, 2.4, hl - 0.8, -0.8, LFD, v);
  const hind = (td, v) => leg(fr(c - td), 0.24, GHD, -hl + 2.6, 1.6, -hl + 1.4, -1.2, LHD, v);
  fore(0, FAR);
  hind(0.53, FAR);
  // Deep chest, the waist tucked up high under an arching loin.
  bdot(hl - 1.5, 0.2, 3.2, 1);
  bcap(hl - 1.5, 0, hl - 5.5, -0.7, 3.2, 2.4, 1);
  bcap(hl - 5.5, -1.1, -hl + 2.5, -1.9 - 0.8 * f, 1.8, 1.5, 1);
  bcap(0.5, -2.3 - 1.1 * f, -hl + 2, -2.1 - 0.7 * f, 1.3, 1.3, 1);
  bdot(-hl + 1.5, -1.5 - 0.6 * f, 2.3, 1);
  // Long neck, narrow head with a pointed muzzle, ears folded back.
  const nx = wx(hl, -1.5), ny = wy(hl, -1.5), al = 0.55 + 0.1 * f;
  const px = nx + 5.4 * cos(al), py = ny - 5.4 * sin(al);
  cap(nx, ny, px, py, 2, 1.25, 1);
  cap(px, py, px + 5 * cos(0.42), py + 5 * sin(0.42), 1.45, 0.55, 1);
  cap(px - 0.4, py - 0.8, px - 2, py - 1.2, 0.6, 0.35, 1);
  // A long thin tail, curving down and up again.
  const tx = wx(-hl, -1.8), ty = wy(-hl, -1.8), w = sin(TAU * c);
  cap(tx, ty, tx - 3, ty + 2.2 + w * 0.5, 0.8, 0.6, 1);
  cap(tx - 3, ty + 2.2 + w * 0.5, tx - 6, ty + 3 + w, 0.6, 0.45, 1);
  cap(tx - 6, ty + 3 + w, tx - 8.4, ty + 1.8 + 1.4 * w, 0.45, 0.35, 1);
  fore(0.07, 1);
  hind(0.45, 1);
}

// A sulphur-crested cockatoo flying to the right. Each wing tapers from the
// shoulder to a fan of primaries; seen from the side its span shows only as
// much as it is raised or lowered, and on the upstroke the hand folds back.
function bird(c) {
  const th = 0.12 + 1.07 * cos(TAU * c), up = max(0, sin(TAU * c)), dn = max(0, -sin(TAU * c));
  frame(22, 16 + 1.4 * sin(TAU * c + 0.6), -0.06);
  const wing = (o, v) => {
    const sx = wx(1 + o, -1.6), sy = wy(1 + o, -1.6), e = sin(th);
    const ax = sx + 0.8 * dn - 2.3, ay = sy - 5 * e + 0.3;
    const bx = ax + 1.2 * dn - 3.5 * up + 0.6, by = ay - 5.6 * e;
    cap(sx - 2.3, sy + 0.3, ax, ay, 2.5, 2.1, v);
    cap(ax, ay, bx, by, 2.1, 1.1, v);
    for (let j = 0; j < 4; j++) {
      const a = th + 0.12 - 0.2 * j;
      cap(bx + 0.4 - 0.7 * j, by, bx - 0.8 - 1.1 * j - 1.4 * up, by - 3.6 * sin(a), 0.6, 0.3, v);
    }
  };
  wing(-0.8, FAR);
  bcap(-4, 0.3, 4, -0.4, 2.3, 2.6, 1);
  bdot(6.2, -1.2, 2.1, 1);
  bcap(7.6, -1.6, 9.8, -0.4, 1, 0.4, 1);
  bcap(9.4, -0.8, 9.6, 0.5, 0.45, 0.3, 1);
  // The crest laid back in flight.
  bcap(6, -3, 2.2, -4.6 + 0.4 * sin(TAU * c), 0.9, 0.35, 1);
  const e = MO + round(wy(6.8, -1.6) - 0.5) * IW + round(wx(6.8, -1.6) - 0.5);
  MASK[e] = 0.35;
  bcap(-3.4, 0.5, -12.5, 1.4, 1.5, 0.9, 1);
  bcap(-3.4, 1, -12, 2.9, 1.1, 0.6, FAR);
  wing(0, 1);
}

// A man running. Hip and knee follow keyframes eight to a stride and the
// arms swing against the legs. The figure is set down so the lower foot
// stands on the floor, a little above it in the two moments of flight.
const THI = [0.42, 0.12, -0.22, -0.5, -0.35, 0.35, 0.85, 0.75], KNE = [0.12, 0.55, 0.4, 0.35, 1.5, 2.1, 1.3, 0.4];
const key = (K, p) => {
  const q = fr(p) * 8, i = floor(q), f = q - i;
  return K[i] + (K[(i + 1) & 7] - K[i]) * (1 - cos(PI * f)) * 0.5;
};
const RJ = new Float32Array(24);
function runner(c) {
  let low = 0;
  for (let s = 0; s < 2; s++) {
    const ph = c + 0.5 * s, t = key(THI, ph), k = t - key(KNE, ph), o = s * 12;
    const ua = -0.75 * sin(TAU * (ph - 0.55));
    RJ.set([6.4 * sin(t), 6.4 * cos(t)], o);
    RJ.set([RJ[o] + 6.2 * sin(k), RJ[o + 1] + 6.2 * cos(k)], o + 2);
    RJ.set([RJ[o + 2] + 2.2 * sin(k + 1.45), RJ[o + 3] + 2.2 * cos(k + 1.45)], o + 4);
    RJ.set([4.3 * sin(ua), 4.3 * cos(ua)], o + 6);
    RJ.set([RJ[o + 6] + 3.8 * sin(ua + 1.7), RJ[o + 7] + 3.8 * cos(ua + 1.7)], o + 8);
    low = max(low, RJ[o + 3] + 0.5, RJ[o + 5]);
  }
  const fl = fr(c * 2), lift = fl > 0.375 && fl < 0.5 ? 1.2 * sin((PI * (fl - 0.375)) / 0.125) : 0;
  const hx = 21, hy = 26.6 - low - lift, sx = hx + 1.3, sy = hy - 7.1;
  const limb = (s, v) => {
    const o = s * 12;
    cap(hx, hy, hx + RJ[o], hy + RJ[o + 1], 1.7, 1.15, v);
    cap(hx + RJ[o], hy + RJ[o + 1], hx + RJ[o + 2], hy + RJ[o + 3], 1.15, 0.7, v);
    cap(hx + RJ[o + 2], hy + RJ[o + 3], hx + RJ[o + 4], hy + RJ[o + 5], 0.7, 0.5, v);
  };
  const arm = (s, v) => {
    const o = s * 12;
    cap(sx, sy, sx + RJ[o + 6], sy + RJ[o + 7], 0.95, 0.75, v);
    cap(sx + RJ[o + 6], sy + RJ[o + 7], sx + RJ[o + 8], sy + RJ[o + 9], 0.75, 0.6, v);
    dot(sx + RJ[o + 8], sy + RJ[o + 9], 0.75, v);
  };
  arm(1, FAR);
  limb(1, FAR);
  cap(hx, hy, sx, sy, 1.9, 2.2, 1);
  cap(sx, sy, sx + 0.8, sy - 2, 0.9, 0.9, 1);
  dot(sx + 0.9, sy - 2.8, 1.75, 1);
  limb(0, 1);
  arm(0, 1);
}
const FIGS = [horse, dog, bird, runner];

// The grounds behind them. At Palo Alto a white wall ruled with upright lines
// stands behind the track, and the horse's shadow lies on the track under
// her. In Philadelphia black cloth strung with a white thread grid hangs
// behind a pale floor.
const BD = new Float32Array(2 * NI);
const FIG = [0.04, 0.9, 0.9, 0.9];
for (let y = 0; y < IH; y++)
  for (let x = 0; x < IW; x++) {
    const i = y * IW + x;
    let t = y < 22 ? (x % 4 === 1 ? 0.6 : 0.9) : y < 23 ? 0.32 : y < 24 ? 0.55 : 0.8 - 0.02 * (y - 24);
    const sx = (x + 0.5 - 21) / 10, sy = (y + 0.5 - 27.3) / 1.4;
    if (sx * sx + sy * sy < 1) t *= 0.6;
    BD[i] = t;
    BD[NI + i] = y > 26 ? 0.3 : x % 6 === 2 || y % 6 === 3 ? 0.34 : 0.05;
  }
// Old lenses: the corners of every plate fall off.
const VG = new Float32Array(NI);
for (let y = 0; y < IH; y++)
  for (let x = 0; x < IW; x++) {
    const u = (x + 0.5) / IW - 0.5, v = (y + 0.5) / IH - 0.5;
    VG[y * IW + x] = (1 - 0.5 * u * u) * (1 - 0.4 * v * v);
  }

// Film stocks: a curve from each stock's black to its clear base, bent
// through the grey in the middle of the row.
const STOCK = [
  [0.05, 0.025, 0.012, 0.62, 0.38, 0.18, 1, 0.9, 0.7],
  [0.05, 0.022, 0, 0.75, 0.42, 0.08, 1, 0.74, 0.3],
  [0.05, 0.01, 0.02, 0.72, 0.26, 0.36, 1, 0.7, 0.76],
  [0.01, 0.025, 0.07, 0.16, 0.36, 0.72, 0.72, 0.86, 1],
  [0.01, 0.04, 0.02, 0.2, 0.52, 0.3, 0.62, 1, 0.68],
];
const LAMP = [1, 0.94, 0.82];

// Columns: -1 the gate's rails, -2 black film edge, -3 perforation, -4 the
// corner column of a perforation, 0.. the picture.
const COL = new Int8Array(W);
for (let x = 0; x < W; x++) {
  const e = min(x, W - 1 - x);
  COL[x] = e === 0 ? -1 : e >= IX ? x - IX : e >= 2 && e <= 6 ? (e === 2 || e === 6 ? -4 : -3) : -2;
}

export function setup(params) {
  for (let s = 0; s < NS; s++)
    for (let p = 0; p < NP; p++) {
      MO = (s * NP + p) * NI;
      FIGS[s](p / NP);
    }
  // Dust and a stray hair on sixteen frames that repeat along the reel, and
  // grain on the film's own rows.
  const DU = new Float32Array(16 * NI).fill(1);
  for (let f = 0; f < 16; f++) {
    for (let j = 0; j < 4; j++) {
      const x = floor(Math.random() * IW), y = floor(Math.random() * IH);
      DU[f * NI + y * IW + x] = 0.25;
      if (Math.random() < 0.4 && x + 1 < IW) DU[f * NI + y * IW + x + 1] = 0.55;
    }
    if (f % 7 === 3) {
      let x = 5 + Math.random() * 36, y = 4 + Math.random() * 20, a = Math.random() * TAU;
      for (let j = 0; j < 9; j++) {
        DU[f * NI + floor(y) * IW + floor(x)] = 0.35;
        a += Math.random() - 0.5;
        x = cl(x + cos(a), 0, IW - 1);
        y = cl(y + sin(a), 0, IH - 1);
      }
    }
  }
  const GN = new Float32Array(W * 256);
  for (let i = 0; i < GN.length; i++) GN[i] = 0.95 + 0.1 * Math.random();
  params.s = {
    DU, GN, n: 0, cyc: 0.5, pos: 1, shut: 1, fps: 3, sub: -1, base: 0, sp: [], tint: -1, lamp: -9,
    lut: new Float32Array(3 * 65), LY: new Float32Array(H), SP: new Float32Array(H), LX: new Float32Array(W), burns: [], ask: false,
  };
  const S = params.s;
  for (let x = 0; x < W; x++) {
    const c = COL[x];
    S.LX[x] = c >= 0 ? 1 - 0.1 * ((c - 22.5) / 23) ** 2 : c === -1 ? 0.1 : c === -2 ? 0.35 : 0.5;
  }
  for (let y = 0; y < H; y++) {
    const d = y < GY + FL ? GY + FL - y : y > GY + P - 1 ? y - GY - P + 1 : 0;
    S.LY[y] = d === 0 ? 1 - 0.08 * ((y - GY - FL - IH / 2) / (IH / 2)) ** 2 : 0.5 * exp(-d * 0.9);
  }
}

function tune(S, k) {
  const tint = cl(k[0], 0, 1);
  if (tint !== S.tint) {
    S.tint = tint;
    const q = tint * (STOCK.length - 1), i = min(STOCK.length - 2, floor(q)), f = q - i;
    for (let j = 0; j <= 64; j++) {
      const t = j / 64, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t;
      for (let ch = 0; ch < 3; ch++) {
        const A = STOCK[i], B = STOCK[i + 1];
        const g = (s) => a * s[ch] + b * s[ch + 3] + c * s[ch + 6];
        S.lut[j * 3 + ch] = g(A) + (g(B) - g(A)) * f;
      }
    }
  }
  const lamp = cl(k[3], -1, 1);
  if (lamp !== S.lamp) {
    S.lamp = lamp;
    const b = 0.05 + 0.36 * (lamp + 1);
    for (let y = 0; y < H; y++) S.SP[y] = b * (0.6 + 0.4 * exp(-(((y - 65) / 34) ** 2)));
  }
}

// Where the strip stands: sI rows pulled since the start; frame k holds rows
// GY + sI + k P onwards.
const rows = (S) => round(S.pos * P);
const frameAt = (S, y) => floor((y - GY - rows(S)) / P);
function subOf(S, k) {
  let s = S.base;
  for (const sp of S.sp) if (k <= sp.k) s = sp.s;
  return s;
}

const BURN = 1.9;
export function update(dt, input, params) {
  const S = params.s;
  if (!S) return;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  tune(S, k);
  const sub = cl(round(k[2]), 0, NS - 1);
  if (S.sub < 0) S.base = sub;
  else if (sub !== S.sub) S.sp.push({ k: frameAt(S, 0) - 1, s: sub });
  S.sub = sub;
  while (S.sp.length && frameAt(S, H - 1) <= S.sp[0].k) S.base = S.sp.shift().s;
  S.fps = 1.5 * cl(k[1], 0.2, 3);
  if (input.btnPressed && input.btnPressed[0] && !S.burns.some((b) => b.t < BURN + 0.5)) S.ask = true;
  const tp = min(0.16, 0.32 / S.fps);
  // The film stands still while a frame burns, and a burnt frame is
  // forgotten once it has gone off the bottom of the panel.
  let held = false;
  for (const b of S.burns) if ((b.t += dt) < BURN) held = true;
  if (S.burns.length) S.burns = S.burns.filter((b) => frameAt(S, H - 1) >= b.k && b.t < 60);
  if (!held) {
    S.cyc += dt * S.fps;
    if (S.cyc >= 1) (S.cyc -= 1), S.n++;
  }
  const tau = S.cyc / S.fps;
  if (tau < tp) {
    const u = tau / tp;
    S.pos = S.n + (1 - cos(PI * u)) / 2;
    S.shut = 1 - 0.45 * sin(PI * u);
  } else {
    S.pos = S.n + 1;
    S.shut = 1;
    if (S.ask) {
      S.ask = false;
      const h = [0, 1, 2].map(() => Math.random() * TAU), kg = frameAt(S, GY + FL);
      S.burns = S.burns.filter((b) => b.k !== kg);
      S.burns.push({ k: kg, t: 0, x: 14 + 18 * Math.random(), y: 9 + 10 * Math.random(), h });
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const sI = rows(S), { lut, DU, GN, LX, LY, SP, burns } = S;
  // A burn: first a blister, then a hole opening in it with a glowing rim
  // that cools once the film moves on.
  for (const b of burns) {
    b.rh = 9.5 * ease((b.t - 0.35) / 1.3);
    b.rb = b.rh + 1.2 + 2.6 * ease(b.t / 0.5);
    b.gl = b.t < BURN ? 1 : max(0, 1 - (b.t - BURN) / 1.4);
  }
  for (let y = 0; y < H; y++) {
    const v = y - GY - sI, k = floor(v / P), r = v - k * P, iy = r - FL;
    const sub = subOf(S, k), mo = (sub * NP + (((-k % NP) + NP) % NP)) * NI, bo = sub ? NI : 0, fg = FIG[sub];
    const pr = r & 7, hole = pr >= 3 && pr <= 6, hedge = pr === 3 || pr === 6;
    const ex = 0.93 + 0.1 * hash(k, 7), du = (k & 15) * NI, gn = (v & 255) * W;
    let splice = false;
    if (iy < 0) for (const sp of S.sp) if (sp.k === k - 1) splice = true;
    // A scratch down the emulsion, one every few frames, fixed to the film.
    const seg = floor(k / 5), hs = hash(seg, 11);
    const scx = hs < 0.55 ? floor(hash(seg, 12) * 40) + 3 + (((v >> 3) & 3) === 1 ? 1 : 0) : -9;
    const sc0 = hash(seg, 13) * 5 * P, sc1 = sc0 + (0.3 + hash(seg, 14)) * 3 * P, vs = v - seg * 5 * P;
    const scr = vs > sc0 && vs < sc1 ? scx : -9;
    const ly = LY[y] * S.shut, sp = SP[y];
    let burn = null;
    for (const b of burns) if (b.k === k) burn = b;
    for (let x = 0; x < W; x++) {
      const c = COL[x];
      const a = ly * LX[x], L = 0.95 * a + sp * (1 - 0.95 * a);
      let R, G, Bl;
      if (c < -2 && hole) {
        // A perforation: the lamp straight through, its corners rounded.
        const e = c === -4 && hedge ? 0.45 : 1;
        R = LAMP[0] * L * e;
        G = LAMP[1] * L * e;
        Bl = LAMP[2] * L * e;
      } else if (c === -1) {
        R = G = Bl = 0.12 * L;
      } else {
        let t = 0.03;
        let br = 0;
        if (c >= 0 && iy >= 0) {
          const i = iy * IW + c;
          t = (BD[bo + i] + (fg - BD[bo + i]) * MASK[mo + i]) * VG[i] * ex * DU[du + i];
          if (c === scr) t = min(1, t + 0.22);
          if (burn) {
            const dx = c + 0.5 - burn.x, dy = iy + 0.5 - burn.y, an = atan2(dy, dx), h = burn.h;
            const d = sqrt(dx * dx + dy * dy) / (1 + 0.18 * sin(3 * an + h[0]) + 0.1 * sin(5 * an + h[1]) + 0.06 * sin(11 * an + h[2]));
            if (d < burn.rh) br = 1;
            else if (d < burn.rh + 1.4 && burn.rh > 0) br = 2;
            else if (d < burn.rb) {
              t *= 0.3 + 0.5 * hash(c >> 1, (iy >> 1) + k * 31);
              br = 3;
            }
          }
        } else if (splice && c >= 0) t = r === 1 ? 0.55 : 0.2;
        if (br === 1) {
          R = LAMP[0] * L;
          G = LAMP[1] * L;
          Bl = LAMP[2] * L;
        } else {
          const j = round(cl(t, 0, 1) * 64) * 3, g = L * GN[gn + x];
          R = lut[j] * g;
          G = lut[j + 1] * g;
          Bl = lut[j + 2] * g;
          if (br === 3) (R = R * 0.8 + 0.1 * L), (G *= 0.6), (Bl *= 0.4);
          if (br === 2) (R += burn.gl), (G += 0.42 * burn.gl), (Bl += 0.06 * burn.gl);
        }
      }
      display.setPixel(x, y, min(255, 255 * R), min(255, 255 * G), min(255, 255 * Bl));
    }
  }
}
