// ===== Patternflow pattern =====
// Title:   Spider Fans
// Family:  araneiform
// Idea:    Seen straight down on a slowly passing slab of pink-cream frost, branching dark channels pulse inward toward their vents, each vent now and then bursts a pale jet that the wind bends into a dust cloud, and the cloud paints a soft dark fan downwind that the frost slowly buries, so the fans of each earlier wind lie across each other like feathers.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: araneiform terrain and its dark fans on the seasonal carbon dioxide frost of the Martian south pole: sublimation under a translucent slab, Hugh Kieffer (2000, from memory); the radial channels carved by gas rushing to a vent, Piqueux, Byrne and Richardson (2003, from memory); the fans read as a record of the spring wind in HiRISE images, Philip Christensen and the HiRISE team (2007 and after, from memory); original code, pattern round 263
// Round:   263
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Venting=0..4, Wind=30..390, Reach=-1..1
//
// Knob 1: Hue. Six looks held a while each and blended between, the last running into the first: at 0 the frost is pink-cream and the dust copper-brown, then butter and bronze, mint-white and deep green, ice-blue and indigo, lavender and plum, rose-white and wine.
// Knob 2: Venting. How often the vents burst, 0 to 4, opening at 2: a vent bursts about every 27 s at the opening, every 80 s at 0 and every 9 s at 4. The dust a burst lays falls as the bursts come faster, and a feedback on the dust already down holds the panel between bare and black, so at 4 it is busy, with fresh fans over older ones.
// Knob 3: Wind. The way the wind blows, in degrees from straight down the panel toward its right edge, opening at 30 (down and a little right), 90 is toward the right edge, 180 up and 270 toward the left. The wind swings up to 50 degrees round this heading every 30 to 70 s, so the ground keeps fans of several winds, and a turn of the knob re-aims every burst from then on.
// Knob 4: Reach. How far a fan runs, -1 to 1, opening at 0.06: the dust thins to a third every 6.5 LEDs at -1, every 17 at the opening and every 39 at 1, where the fans run across the panel, fainter and overlapping.
//
// What the picture is. The panel is the ground seen from orbit, sliding up the panel at 1.1 LEDs a second as the view moves down its track. A slab of CO2 frost lies on it, pink where it is thick and cream where it is thin, with soft blotches where the slab has thinned and the warm ground shows through.
// Nine vents stand on the ground (about six in view), each opened in a gap away from the rest or, one time in four, a short way from one, each with an araneiform of dark channels, three to seven arms that curve and fork, drawn two LEDs wide round a dark pit. New vents come in from the bottom edge, old ones leave by the top.
// Two seconds before a burst a dark wave runs in along the channels from their tips to the pit (the gas rushing to the vent), then the burst is a white flash on the pit and a pale jet that the wind bends,
// a string of dusty puffs that drift out as a cloud that widens with distance. Under the cloud a fan is laid: a wedge with soft sides, dark where it leaves the vent's channels and fading with the distance,
// feathered with streaks that run out from the vent, its front moving at 15 LEDs a second at first, added to a buffer of dust that is kept in ground coordinates, so a fan slides up the panel with the ground. The dust is buried by new frost with a time constant of 60 to 110 s,
// the rate set per pixel, and each burst adds less when there is more dust down, so the panel settles to a steady dark that depends on how often the vents burst and how far the fans run. The first update runs 150 s of this at the knobs it is given, so the panel opens with fans of several winds already on it.

const W = 64, H = 128, HW = 256; // the ground is kept as a ring of 256 rows
const TOP = 30, BOT = 188;       // rows kept above the top of the panel and below its bottom edge
const NVW = 9;                   // vents on the ground that is kept
const SCROLL = 1.1;              // LEDs a second the ground slides up the panel
const { floor, sqrt, exp, sin, cos, min, max, abs, PI, tan, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();
const wr = (y) => ((y % HW) + HW) % HW;

function hash(i, j, s) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const ix = floor(x), iy = floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

const SS = 33, SC = 16;  // spider sprite, and its centre
const SOFT = 4;          // LEDs over which a fan's front is soft
const KD = 1.5;          // dust to opacity
const FRONT = 15;        // LEDs a second, the speed of a fan's front when it starts

// six looks: frost pink, frost cream, bare ground, then dust light, middle, deep, and the bright of a jet
const LOOKS = [
  { fa: [244, 214, 218], fb: [251, 240, 228], gr: [204, 146, 132], dl: [172, 114, 90], dm: [110, 62, 48], dd: [56, 30, 30], br: [255, 249, 242] },
  { fa: [250, 236, 194], fb: [254, 248, 226], gr: [208, 170, 108], dl: [188, 136, 58], dm: [124, 84, 30], dd: [70, 46, 22], br: [255, 252, 238] },
  { fa: [212, 244, 224], fb: [238, 252, 244], gr: [128, 190, 158], dl: [70, 152, 118], dm: [24, 94, 76], dd: [12, 54, 54], br: [246, 255, 250] },
  { fa: [208, 228, 252], fb: [236, 246, 255], gr: [126, 160, 212], dl: [80, 112, 192], dm: [38, 58, 134], dd: [22, 30, 88], br: [248, 252, 255] },
  { fa: [236, 218, 250], fb: [248, 240, 255], gr: [168, 130, 206], dl: [142, 88, 192], dm: [86, 40, 128], dd: [48, 22, 86], br: [252, 246, 255] },
  { fa: [252, 216, 230], fb: [255, 240, 246], gr: [216, 130, 160], dl: [198, 82, 128], dm: [122, 32, 78], dd: [72, 18, 54], br: [255, 248, 250] },
];
const KEYS = ["fa", "fb", "gr", "dl", "dm", "dd", "br"];

function buildPalette(S, u) {
  const p = u * LOOKS.length, i0 = floor(p) % LOOKS.length, i1 = (i0 + 1) % LOOKS.length;
  const f = sm(0.25, 0.75, p - floor(p));
  for (const k of KEYS) {
    const a = LOOKS[i0][k], b = LOOKS[i1][k], o = S.pal[k];
    for (let c = 0; c < 3; c++) o[c] = mix(a[c], b[c], f);
  }
}

function makeState() {
  const S = {
    t: 0, ready: false, pal0: -1, oy: 0,
    D: new Float32Array(W * HW), DR: new Float32Array(W * HW),
    PD: new Float32Array(W * H), PB: new Float32Array(W * H), SB: new Float32Array(W * H),
    vents: [], fans: [], pal: {}, m: 1, H0: 0.5, Le: 16, sd: 1, dm: 0, gain: 1,
    rt: 0, sw0: 0, sw1: 0.5, rdur: 30,
  };
  for (const k of KEYS) S.pal[k] = [0, 0, 0];
  // each pixel's own time for the frost to bury the dust
  for (let y = 0; y < HW; y++) for (let x = 0; x < W; x++) S.DR[y * W + x] = 1 / (60 + 50 * vnoise(x * 0.04, y * 0.04, 51));
  return S;
}

// ---- the spider: branching dark channels round a pit, drawn into a small sprite
function makeSpider(v) {
  const I = v.spr;
  I.fill(0);
  const segs = [];
  const R = v.R;
  const grow = (x, y, ang, len, gen) => {
    const n = gen === 0 ? 4 : 2;
    const step = len / n;
    let curv = (rnd() - 0.5) * 0.9;
    for (let i = 0; i < n; i++) {
      ang += curv * 0.55 + (rnd() - 0.5) * 0.3;
      curv *= 0.8;
      const x1 = x + cos(ang) * step, y1 = y + sin(ang) * step;
      const rr = min(1, sqrt(x1 * x1 + y1 * y1) / R);
      segs.push([x, y, x1, y1, (1 - 0.32 * rr) * (gen === 0 ? 1 : gen === 1 ? 0.9 : 0.8), 1.1 - 0.25 * rr]);
      if (gen < 2 && (gen === 1 || i >= 1) && i < n - 1 + gen && rnd() < (gen === 0 ? 0.6 : 0.3)) {
        const side = rnd() < 0.5 ? -1 : 1;
        grow(x1, y1, ang + side * (0.35 + 0.35 * rnd()), len * (0.4 + 0.25 * rnd()), gen + 1);
      }
      x = x1; y = y1;
    }
  };
  const nArm = 3 + floor(rnd() * 5), a0 = rnd() * TAU;
  for (let k = 0; k < nArm; k++) grow(0, 0, a0 + (k + (rnd() - 0.5) * 0.9) * TAU / nArm, R * (0.4 + 0.8 * pow(rnd(), 1.3)), 0);
  for (const [x0, y0, x1, y1, amp, sg] of segs) {
    const bx0 = max(0, floor(min(x0, x1) + SC - 3)), bx1 = min(SS - 1, floor(max(x0, x1) + SC + 3));
    const by0 = max(0, floor(min(y0, y1) + SC - 3)), by1 = min(SS - 1, floor(max(y0, y1) + SC + 3));
    const ex = x1 - x0, ey = y1 - y0, l2 = ex * ex + ey * ey + 1e-6, is2 = 1 / (2 * sg * sg);
    for (let yy = by0; yy <= by1; yy++) for (let xx = bx0; xx <= bx1; xx++) {
      const px = xx + 0.5 - SC - x0, py = yy + 0.5 - SC - y0;
      const t = cl((px * ex + py * ey) / l2, 0, 1), dx = px - ex * t, dy = py - ey * t;
      const val = amp * exp(-(dx * dx + dy * dy) * is2);
      if (val > I[yy * SS + xx]) I[yy * SS + xx] = val;
    }
  }
  for (let yy = 0; yy < SS; yy++) for (let xx = 0; xx < SS; xx++) {
    const dx = xx + 0.5 - SC, dy = yy + 0.5 - SC, g = exp(-(dx * dx + dy * dy) / (2 * 2.1 * 2.1));
    if (g > I[yy * SS + xx]) I[yy * SS + xx] = g;
  }
}

// a vent opens at a random gap in the rows y0 to y1 of the ground, or a short way from one that is there, as araneiform fields cluster
function newVent(S, y0, y1) {
  let bx = 32, by = y0, bs = 1e9;
  const want = rnd() < 0.25 ? 24 + 8 * rnd() : 48;
  for (let c = 0; c < 14; c++) {
    const x = 7 + rnd() * 50, y = y0 + rnd() * (y1 - y0);
    let dm = 1e9;
    for (const o of S.vents) dm = min(dm, sqrt((x - o.x) * (x - o.x) + (y - o.y) * (y - o.y)));
    const sc = abs(dm - want) + (dm < 20 ? 40 : 0);
    if (sc < bs) { bs = sc; bx = x; by = y; }
  }
  const v = {
    x: bx, y: by, R: 9 + 3.5 * rnd(), T0: 18 + 18 * rnd(), acc: rnd() * 0.6, thr: 0.8 + 0.6 * rnd(),
    pulse: 0, post: 0, spr: new Float32Array(SS * SS),
  };
  makeSpider(v);
  S.vents.push(v);
}

// ---- the wind
function swing(S) {
  const u = sm(0, 7, S.t - S.rt);
  return S.sw0 + (S.sw1 - S.sw0) * u + 0.11 * sin(S.t * 0.37 + 1) + 0.07 * sin(S.t * 0.91 + 2);
}
function stepWind(S) {
  if (S.t - S.rt > S.rdur) {
    S.rt = S.t; S.sw0 = S.sw1;
    let n = 0;
    do { n = (rnd() * 2 - 1) * 0.85; } while (abs(n - S.sw0) < 0.55);
    S.sw1 = n; S.rdur = 30 + 40 * rnd();
  }
}

// ---- a burst: a fan the wind will lay, and a flash
function erupt(S, v) {
  const phi = S.H0 + swing(S) + (rnd() - 0.5) * 0.14;
  const Le = S.Le * (0.75 + 0.5 * rnd());
  const Rf = 2.6 * Le + SOFT;
  S.fans.push({
    x: v.x, y: v.y, phi, c: (rnd() * 2 - 1) * 0.0045 + 0.004 * (S.sw1 - S.sw0) * (1 - sm(0, 12, S.t - S.rt)),
    h0: 1.5, ta: tan((6 + 6 * rnd()) * PI / 180), L: Le, Rf, Rp: min(0.2 * Rf, 12) + 3,
    tau: min(Rf / FRONT, 5.5), t: 0, A0: 1.6 * S.gain * min(2, 16 / S.Le) * pow(S.m, -0.5) * (0.8 + 0.4 * rnd()), sd: S.sd++,
  });
  v.post = 1;
  // the pit takes a little dust at once
  for (let y = floor(v.y - 7); y <= floor(v.y + 7); y++) for (let x = max(0, floor(v.x - 7)); x <= min(W - 1, floor(v.x + 7)); x++) {
    const dx = x + 0.5 - v.x, dy = y + 0.5 - v.y;
    S.D[wr(y) * W + x] += 0.12 * exp(-(dx * dx + dy * dy) / 8);
  }
}

// lay the part of a fan between the front's old place and its new one, on the ground rows that are kept
function stampFan(S, f, t0, t1, done) {
  const front = (t) => (f.Rf + SOFT) * (1 - exp(-t / f.tau));
  const sf0 = front(t0), sf1 = done ? f.Rf + SOFT + 1 : front(t1);
  if (sf1 <= sf0 + 1e-4) return;
  const dx = sin(f.phi), dy = cos(f.phi), px = dy, py = -dx;
  let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
  const sa = max(0, sf0 - SOFT - 1), sb = min(f.Rf, sf1 + 1);
  for (let s = sa; s <= sb + 4; s += 4) {
    const s2 = min(s, sb), n = f.c * s2 * s2, hh = f.h0 + s2 * f.ta + 3;
    const cx = f.x + dx * s2 + px * n, cy = f.y + dy * s2 + py * n;
    bx0 = min(bx0, cx - hh); bx1 = max(bx1, cx + hh); by0 = min(by0, cy - hh); by1 = max(by1, cy + hh);
  }
  const o = floor(S.oy);
  const x0 = max(0, floor(bx0)), x1 = min(W - 1, floor(bx1)), y0 = max(o - TOP, floor(by0)), y1 = min(o + BOT, floor(by1));
  const D = S.D, sd = f.sd * 1.7;
  for (let y = y0; y <= y1; y++) {
    const row = wr(y) * W;
    for (let x = x0; x <= x1; x++) {
      const ox = x + 0.5 - f.x, oy = y + 0.5 - f.y;
      const s = ox * dx + oy * dy;
      if (s < -1 || s > f.Rf) continue;
      const sc = s > 0 ? s : 0, n = ox * px + oy * py - f.c * sc * sc;
      const h = f.h0 + sc * f.ta, nn = abs(n) / h;
      if (nn > 1.25) continue;
      const w1 = 1 - sm(sf1 - SOFT, sf1, s), w0 = 1 - sm(sf0 - SOFT, sf0, s);
      if (w1 - w0 < 1e-5) continue;
      const prof = (1 - sm(0.5, 1.08, nn)) * (1 - 0.3 * nn);
      const streak = 0.62 + 0.76 * vnoise((n / (sc + 5)) * 9 + sd, sc * 0.045 + sd * 0.37, 3);
      const A = f.A0 * sm(4, 15, s) * exp(-sc / f.L) * sqrt(f.h0 / h) * (1 - sm(0.7 * f.Rf, f.Rf, s));
      D[row + x] += A * prof * streak * (w1 - w0);
    }
  }
}

function step(S, d) {
  S.t += d;
  stepWind(S);
  // the ground slides up; the rows that come in at the bottom are bare
  const o0 = floor(S.oy);
  S.oy += SCROLL * d;
  const o1 = floor(S.oy);
  for (let r = o0 + BOT + 1; r <= o1 + BOT; r++) S.D.fill(0, wr(r) * W, wr(r) * W + W);
  const m = S.m;
  for (let i = S.vents.length - 1; i >= 0; i--) {
    const v = S.vents[i];
    if (v.y < S.oy - TOP - 12) { S.vents.splice(i, 1); continue; }
    v.acc += (d * m) / v.T0;
    if (v.acc >= v.thr) { erupt(S, v); v.acc = 0; v.thr = 0.55 + 0.9 * rnd(); }
    const left = ((v.thr - v.acc) * v.T0) / m;
    v.pulse = left < 2 ? 1 - left / 2 : 0;
    v.post *= exp(-d / 2.4);
  }
  while (S.vents.length < NVW) newVent(S, S.oy + H + 2, S.oy + H + 40);
  for (let i = S.fans.length - 1; i >= 0; i--) {
    const f = S.fans[i], t0 = f.t;
    f.t += d;
    const done = f.t > 5 * f.tau;
    stampFan(S, f, t0, f.t, done);
    if (done) S.fans.splice(i, 1);
  }
  const D = S.D, DR = S.DR;
  for (let p = 0; p < W * HW; p++) D[p] *= 1 - d * DR[p];
  let sum = 0;
  for (let y = 0; y < H; y++) { const row = wr(floor(S.oy) + y) * W; for (let x = 0; x < W; x++) sum += D[row + x]; }
  S.dm = sum / (W * H);
  // the more dust is down, the less each burst adds, so the panel never fills up and never runs bare
  S.gain += (cl(pow(0.1 / (S.dm + 0.004), 0.8), 0.4, 2.4) - S.gain) * min(1, d / 15);
}

export function setup(params) {
  params.s = makeState();
}

function readKnobs(S, kn) {
  S.m = pow(2, (cl(kn[1], 0, 4) - 2) * 0.8);
  S.H0 = (kn[2] * PI) / 180;
  S.Le = 16 * pow(2, 1.3 * cl(kn[3], -1, 1));
  const u1 = cl(kn[0], 0, 1);
  if (abs(u1 - S.pal0) > 0.0005) { S.pal0 = u1; buildPalette(S, u1); }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  readKnobs(S, (input && input.knobValues) || [0, 2, 30, 0.06]);
  if (!S.ready) {
    S.ready = true;
    S.sw0 = (rnd() * 2 - 1) * 0.6; S.sw1 = (rnd() * 2 - 1) * 0.6; S.rt = -rnd() * 20; S.rdur = 30;
    for (let i = 0; i < NVW; i++) newVent(S, -TOP, H + 40);
    for (const v of S.vents) v.acc = rnd() * v.thr;
    for (let i = 0; i < 750; i++) step(S, 0.2);
  }
  step(S, d);
}

// ---- drawing
function blob(a, x, y, sg, amp) {
  const ext = 2.6 * sg, is2 = 1 / (2 * sg * sg);
  const x0 = max(0, floor(x - ext)), x1 = min(W - 1, floor(x + ext)), y0 = max(0, floor(y - ext)), y1 = min(H - 1, floor(y + ext));
  for (let yy = y0; yy <= y1; yy++) {
    const dy = yy + 0.5 - y;
    for (let xx = x0; xx <= x1; xx++) {
      const dx = xx + 0.5 - x, v = amp * exp(-(dx * dx + dy * dy) * is2), p = yy * W + xx;
      a[p] += v - a[p] * v;
    }
  }
}

function drawPlume(S, f) {
  const t = f.t, fy = f.y - S.oy;
  const dx = sin(f.phi), dy = cos(f.phi), px = dy, py = -dx;
  if (t < 1.2) blob(S.PB, f.x, fy, 2.2 + 1.2 * t, 0.9 * exp(-t / 0.45));
  // the jet: a pale column that grows out from the pit and is bent by the wind
  if (t < 3.5) {
    const len = min(1.7 * f.Rp, 24) * (1 - exp(-t / 0.7)), fade = t < 0.4 ? 1 : exp(-(t - 0.4) / 0.9);
    for (let s = 0; s < len; s += 1.5) {
      const n = f.c * s * s * 1.6 + 0.7 * sin(s * 0.35 - t * 3);
      blob(S.PB, f.x + dx * s + px * n, fy + dy * s + py * n, 1.15 + 0.06 * s, 0.85 * fade * pow(1 - s / (len + 2), 0.8));
    }
  }
  // the dust it carries, a thin haze that widens with distance
  for (let i = 0; i < 12; i++) {
    const age = t - 0.1 * i;
    if (age <= 0) continue;
    const life = 3.5 + 2.5 * hash(i, f.sd, 11);
    if (age > life) continue;
    const v = f.Rp * (0.5 + 1.0 * hash(i, f.sd, 13));
    const s = v * 3.5 * (1 - exp(-age / 3.5));
    const nu = hash(i, f.sd, 12) * 2 - 1, hh = f.h0 + s * f.ta;
    const n = f.c * s * s + nu * hh * 0.7 + 0.8 * sin(age * 1.7 + i * 2.1);
    const u = age / life;
    blob(S.PD, f.x + dx * s + px * n, fy + dy * s + py * n, 1.4 + 0.16 * s, 0.24 * (1 - u) * (1 - u) * sm(0.2, 1.0, age));
  }
}

export function draw(display, params) {
  if (!params.s) setup(params);
  const S = params.s;
  if (!S.ready) update(0, { knobValues: [0, 2, 30, 0.06] }, params);
  const P = S.pal, t = S.t, D = S.D, PD = S.PD, PB = S.PB, SB = S.SB, oy = S.oy, oi = floor(oy), of = oy - oi;
  PD.fill(0); PB.fill(0); SB.fill(0);
  for (const f of S.fans) if (f.t < 9) drawPlume(S, f);
  // spiders: the dark wave in toward the pit, then the dust the burst leaves round it
  for (const v of S.vents) {
    const sx = v.x, sy = v.y - oy;
    if (sy < -SC - 2 || sy > H + SC + 2) continue;
    const qf = 1.15 - 1.3 * v.pulse, spr = v.spr;
    const gx0 = max(0, floor(sx - SC)), gx1 = min(W - 1, floor(sx + SC)), gy0 = max(0, floor(sy - SC)), gy1 = min(H - 1, floor(sy + SC));
    for (let gy = gy0; gy <= gy1; gy++) {
      const w = gy - sy + SC, iw = floor(w), fw = w - iw;
      if (iw < 0 || iw >= SS - 1) continue;
      for (let gx = gx0; gx <= gx1; gx++) {
        const u = gx - sx + SC, iu = floor(u), fu = u - iu;
        if (iu < 0 || iu >= SS - 1) continue;
        const k = iw * SS + iu;
        const i = spr[k] * (1 - fu) * (1 - fw) + spr[k + 1] * fu * (1 - fw) + spr[k + SS] * (1 - fu) * fw + spr[k + SS + 1] * fu * fw;
        if (i < 0.02) continue;
        const dx = gx + 0.5 - sx, dy = gy + 0.5 - sy, q = sqrt(dx * dx + dy * dy) / (v.R * 1.15);
        const wave = v.pulse > 0 ? exp(-((q - qf) / 0.2) * ((q - qf) / 0.2)) : 0;
        const e = min(1, i * (0.7 + 0.1 * sin(t * 0.5 + v.x) + 0.5 * wave + 0.5 * v.post * (1 - min(1, q))));
        const p = gy * W + gx;
        if (e > SB[p]) SB[p] = e;
      }
    }
  }
  const fa = P.fa, fb = P.fb, gr = P.gr, dl = P.dl, dm = P.dm, dd = P.dd, br = P.br;
  for (let y = 0; y < H; y++) {
    const r0 = wr(oi + y) * W, r1 = wr(oi + y + 1) * W, yw = y + oy;
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const n1 = vnoise(x * 0.05 + 3 + t * 0.004, yw * 0.045 - t * 0.003, 5);
      const fm = cl(n1 * 1.3 - 0.15, 0, 1);
      let r = mix(fa[0], fb[0], fm), g = mix(fa[1], fb[1], fm), b = mix(fa[2], fb[2], fm);
      const n2 = 0.6 * vnoise(x * 0.032 + 9, yw * 0.028 + t * 0.003, 6) + 0.4 * vnoise(x * 0.07 + 5, yw * 0.06 - t * 0.002, 7);
      const th = sm(0.48, 0.78, n2) * 0.38;
      r = mix(r, gr[0], th); g = mix(g, gr[1], th); b = mix(b, gr[2], th);
      const dust = D[r0 + x] * (1 - of) + D[r1 + x] * of;
      let tn = 0.92 * pow(1 - exp(-KD * dust), 1.35);
      if (SB[p] > 0) tn = 1 - (1 - tn) * (1 - 0.96 * SB[p]);
      if (PD[p] > 0) tn = 1 - (1 - tn) * (1 - PD[p]);
      if (tn > 0.003) {
        if (tn < 0.28) { const u = tn / 0.28; r = mix(r, dl[0], u); g = mix(g, dl[1], u); b = mix(b, dl[2], u); }
        else if (tn < 0.62) { const u = (tn - 0.28) / 0.34; r = mix(dl[0], dm[0], u); g = mix(dl[1], dm[1], u); b = mix(dl[2], dm[2], u); }
        else { const u = (tn - 0.62) / 0.38; r = mix(dm[0], dd[0], u); g = mix(dm[1], dd[1], u); b = mix(dm[2], dd[2], u); }
      }
      const pb = PB[p];
      if (pb > 0.002) { const u = min(pb, 0.95); r = mix(r, br[0], u); g = mix(g, br[1], u); b = mix(b, br[2], u); }
      display.setPixel(x, y, cl(r, 0, 255) | 0, cl(g, 0, 255) | 0, cl(b, 0, 255) | 0);
    }
  }
}
