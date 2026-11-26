// ===== Patternflow pattern =====
// Title:   Oscillatory Zoning
// Family:  zoning
// Idea:    A crystal of zircon seen by cathodoluminescence, its long prism faces at the panel's sides and its pyramid ends running off the top and bottom, nested growth shells glowing indigo, violet, cobalt and teal with thin pale sulphur lines, cut into bright and dim wedges along lines from the centre to the corners, while growth comes in bursts and stalls, older shells shrink inward to fine texture, and now and then the rim is eaten back, its corners rounded, and regrowth follows the new outline.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: growth zoning of zircon, quartz and plagioclase as an electron microscope with a cathodoluminescence detector shows it (zircon zonation patterns in CL and backscattered images, Hanchar and Miller, 1993, from memory); oscillatory zoning as a feedback between crystal growth and diffusion in the melt's boundary layer (Allegre, Provost and Jaupart, 1981, from memory; Ortoleva and co-workers, L'Heureux, around 1990 to 1993, from memory); sector zoning, where each kind of crystal face takes up trace elements by its own rule, the hourglass of augite and the prism and pyramid sectors of zircon (Hollister, around 1970, from memory); resorption surfaces, where the melt dissolves the rim, rounds the corners and growth resumes on the new outline (Pearce and Kolisnik, 1990, from memory); the polygon shells come from inverting each face's own advance, a pixel's birth time being the latest of the times its faces reach it; original code, pattern round 261
// Round:   261
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Growth=0..4, Habit=-1..2, Sectors=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel once over the knob's travel. At 0 the ramp runs black resin, deep indigo, violet, cobalt, teal and pale sulphur, with a rare rust-brown band; at 0.25 it is rose and lilac with a pale cream, at 0.5 olive and amber, at 0.75 green and moss.
// Knob 2: Growth. How fast the crystal grows and how bursty it is. The size grows by 2.2 percent a second at 0, 4.4 at 2 where it opens, 6.6 at 4, so the shells move inward at about 0.7, 1.4 and 2.1 LEDs a second at the rim. Stalls (3 to 9 s) and bursts (2 to 5 s) come about every 110 and 80 s at 0, every 55 and 40 s at 2, every 37 and 27 s at 4, so the high end is also the busiest. A burst is up to 3.5 times the base rate, a stall as low as 0.12 times.
// Knob 3: Habit. How long the crystal is along its axis, 1.7 times the stretch factor exp(K3 / 2): 1.03 at -1, 1.7 at 0 where it opens, 4.6 at 2. At 0 the prism faces stand at the panel's sides, the pyramid ends run off the top and bottom, and the steep faces cross the panel's corners. At -1 the crystal is squat and zoomed in, six-sided shells with a blunt roof, and at 2 it is a needle whose pyramids are far off the panel, so the shells are straight vertical bands that bend only at the very ends. A turn changes the shells grown from then on; the older ones keep their shape.
// Knob 4: Sectors. How strongly each kind of face marks the chemistry it grows, from none at -1 to 1.1 times at the opening 0.06 and 2.3 times at 1. At the top the prism sectors left and right go dark and the pyramid sectors above and below stay bright, an hourglass from the centre to the corners; the bands of the three kinds of sector also lag one another by 0 to 0.4 of a cycle, so a band kinks where it crosses a sector line.

// What the picture is. A polished section along the axis of a crystal as a cathodoluminescence image shows it. A growing crystal records the changing chemistry of its melt in
// nested shells, so the picture is the history of one growth: the outside is the newest layer, the centre the speck it began from. Nothing is simulated cell by cell; each pixel asks
// when the crystal reached it, and what the melt was like then.
//   Shape      ten faces: two prism faces (normals +-x), four pyramid faces next to them (normals 26 degrees from x, in a frame stretched along the axis by e) and four steeper ones
//              (67 degrees). The crystal at growth time t is the set of points inside every face's advancing line; face f stands at distance e^l G_f(l) from the centre, l being ln of
//              the crystal's size and G_f a slow random walk along l (5 percent) times a fixed 3.5 percent scatter, so no two faces grow alike and the two halves are never mirrors.
//   Birth      a pixel's level l is the size at which the crystal first covered it: the largest over faces of (distance along the face normal) / (the face's G at that level), found
//              in two passes (a rough level from the mirror-symmetric shape at the rim, then the ten faces' G at that level). The face that gives the largest value is the pixel's sector.
//              Where two faces nearly tie, the two sectors blend over 3 percent of the level so the sector lines are not stair-stepped.
//   History    the ring: 2048 entries, 0.004 of a level each, 8.2 levels. When growth passes a level an entry is written once with everything the melt was doing then, so a pixel only
//              reads it. The first update grows the crystal from a speck, 7.3 levels, about 170 s of growth, so the picture opens full of shells.
//   Camera     the camera keeps the rim in frame, 0.7 s late; shells therefore move inward and compress as e^-(l_rim - l), and the pattern is scale-free in the way the real zoning is
//              (bands near the rim 3 to 8 LEDs, old bands shrinking toward a fine core). A band whose period falls under 5.5 LEDs fades to its mean, fully gone under 3, so the core is smooth
//              instead of sampled noise. The prism faces sit at x = +-31 LEDs; a squat crystal is zoomed in so its tips stay at the panel's edge.
//   Chemistry  C(l, sector) is written into the ring as a sum of four rhythms plus a slow walk, thin events and sector terms. The rhythms run in l and in time: at the passing level the
//              phase advances by (cycles per level) l + (cycles per second) t, with 2.6 / 3.2 / 1.5 / 5.5 cycles per level and one cycle per 30 / 20 / 50 / 14 s. So a stalled growth, with much
//              time at one level, lays down thin laminae and a burst lays down thick bands, the way diffusion-limited zoning does. The first rhythm is a sawtooth, sharp on the front, slow to
//              fade. Each has its own amplitude that wanders between 0.55 and 1.75 (a zone is rich or quiet), a phase that wanders by a radian or so, and none repeats: the four periods
//              have no common measure and the random walks do not return. The sector terms add -0.4, 0.1 and 0.42 (prism, near pyramid, steep pyramid) times K4, and give the first two rhythms
//              a lag per sector type. The thin events are a bright line, a dim band, and about one in eight a rust band, one every 1.5 levels or so, scattered in l.
//   Resorption after 2.4 to 4.8 levels of growth the rim is eaten back for 3.6 to 6.2 s: its level falls by 0.07 to 0.17 (7 to 17 percent of the size, the picture zooms in), and the corner
//              between two faces is rounded by a smooth maximum of the top two faces' values, k = 0.5 to 0.95 of the value. Then growth resumes: the shells begin on the rounded outline
//              and the rounding relaxes with an e-fold of 0.09 to 0.17 in level, so the next shells grow back toward the sharp polygon. The truncation surface is real: a pixel is first tested
//              against the newest outline, and if it lies inside the rounded one it keeps its old shell, so the old bands are cut off at the corners and the new ones begin there. A bright
//              line and a dim band mark the surface, and the rim glows brighter while it is eaten. Up to six outlines are kept.
//   Growth     the rate of the log-size is the base times a log-normal wander (time constant 5 s), a slow drift (150 s), stalls and bursts; the base is 0.022 + 0.011 K2 a second.
//   Colour     C is brought to zero mean and unit spread by a running mean and spread taken over the lit pixels with a 25 frame memory, so the picture keeps the same range however the
//              chemistry wanders; then a smoothstep from -1.6 to 2.6 spreads it over the ramp. The rim carries a bright edge. The ramp's colours are pulled in 28 percent toward grey,
//              because the panel raises saturation 1.62 times. Pixels at the outline are covered by their distance from it, with a faint halo of 0.12 outside.
// The pattern's cost is two passes over the lit pixels, ten multiply-adds per face, about 2 ms a frame.

const W = 64, H = 128, NP = W * H;
const { sin, cos, sqrt, exp, log, abs, floor, max, min, PI } = Math;
const TWO_PI = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sst = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
function randn() {
  let u = 0;
  while (u === 0) u = Math.random();
  return sqrt(-2 * log(u)) * cos(TWO_PI * Math.random());
}
// smooth maximum of two numbers a >= b over a width k: the corner between two faces, rounded
function smax(a, b, k) {
  const d = a - b;
  if (d >= k) return a;
  const t = k - d;
  return a + (t * t) / (4 * k);
}

// ---- the ring of growth levels. A level is l = ln of the size of the crystal; entry i holds what was grown at l = i DL.
const N = 2048, MASK = N - 1, DL = 0.004, IDL = 1 / DL;
const CHS = 18; // channels: 4 oscillations, slow walk, sector gain, event, rust, seconds per level, growth speed, the prism sectors' left-right difference, fast walk, the first two oscillations again for the pyramid sectors, the two pyramid differences
const SHS = 11; // face tables: 10 inverse face distances, 1 inverse elongation
const NF = 10;

// ---- the faces: two prism faces, four pyramid faces next to them, four steeper ones at the tips
const A1 = (26 * PI) / 180, A2 = (67 * PI) / 180;
const C1 = cos(A1), S1 = sin(A1), C2 = cos(A2), S2 = sin(A2);
const ANG0 = [0, PI, A1, PI - A1, -A1, PI + A1, A2, PI - A2, -A2, PI + A2];
const FTY = [0, 0, 1, 1, 1, 1, 2, 2, 2, 2];
const GB = [1, 1, 1.217, 1.217, 1.217, 1.217, 1.269, 1.269, 1.269, 1.269];
const TIPY = 1.269 / S2; // the tip of the crystal in units of the prism face, before the stretch
const EL0 = 1.7;
const SEC_OFF = [-0.4, 0.08, 0.42];
const ASC = [10, 10, 16, 16, 16, 16, 17, 17, 17, 17]; // which difference channel each face reads
const OSA = [0, 12, 13], OSB = [1, 14, 15]; // channels of the first two oscillations by face type
const PS1 = [0, 0.2, 0.42], PS2 = [0, 0.3, 0.6]; // the bands of the pyramid sectors lag those of the prism sectors
const MT = [
  [1.0, 0.7, 0.9, 0.6],
  [0.6, 1.0, 0.7, 0.9],
  [0.45, 0.75, 1.0, 0.5],
];

// ---- the rhythms of the chemistry: cycles per unit of level, period in seconds of the melt's own rhythm, amplitude
const AK = [2.2, 2.8, 1.5, 5.0];
const IT = [1 / 14, 1 / 10, 1 / 40, 1 / 9];
const AMP = [1.4, 0.85, 0.9, 0.3];

// ---- the colour ramp, from black resin to sulphur: value, r, g, b
const STOPS = [
  [0.0, 18, 10, 60],
  [0.12, 40, 24, 112],
  [0.3, 98, 58, 190],
  [0.46, 46, 94, 222],
  [0.6, 50, 140, 224],
  [0.74, 44, 188, 184],
  [0.88, 190, 230, 214],
  [1.0, 246, 234, 160],
];
const RUST = [150, 70, 30];
const SATF = 0.72; // the panel raises saturation 1.62 times, so the colours are pulled in before it does

function hueMat(a) {
  const c = cos(a), s = sin(a);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
}
function rot(m, r, g, b) {
  const lu = 0.299 * r + 0.587 * g + 0.114 * b;
  r = lu + (r - lu) * SATF; g = lu + (g - lu) * SATF; b = lu + (b - lu) * SATF;
  return [
    cl(m[0] * r + m[1] * g + m[2] * b, 0, 255),
    cl(m[3] * r + m[4] * g + m[5] * b, 0, 255),
    cl(m[6] * r + m[7] * g + m[8] * b, 0, 255),
  ];
}
function buildRamp(S, k1) {
  const m = hueMat(k1 * TWO_PI);
  const st = STOPS.map((s) => [s[0], ...rot(m, s[1], s[2], s[3])]);
  const R = S.ramp;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    while (j < st.length - 2 && v > st[j + 1][0]) j++;
    const a = st[j], b = st[j + 1];
    const t = cl((v - a[0]) / (b[0] - a[0]), 0, 1);
    R[i * 3] = a[1] + (b[1] - a[1]) * t;
    R[i * 3 + 1] = a[2] + (b[2] - a[2]) * t;
    R[i * 3 + 2] = a[3] + (b[3] - a[3]) * t;
  }
  const ru = rot(m, RUST[0], RUST[1], RUST[2]);
  S.rust[0] = ru[0]; S.rust[1] = ru[1]; S.rust[2] = ru[2];
  S.hueAt = k1;
}

function makeState() {
  const S = {
    ready: false, t: 0, lrim: -7.3, lcam: -7.3, scam: 31.5, ecur: EL0, iprev: 0, lbot: -7.3,
    ch: new Float32Array(N * CHS), sh: new Float32Array(N * SHS),
    rgb: new Uint8ClampedArray(NP * 3),
    ramp: new Float32Array(256 * 3), rust: new Float32Array(3), hueAt: -1,
    // growth in time
    xr: 0, wr: 0, rho: 0.04, kap: 25, spd: 0, stall: null, burst: null,
    // dissolution, and the epochs it leaves
    diss: null, pend: null, eps: [{ ls: -1e9, c0: 0.04, il: 0 }], sinceT: 0, gapT: 1.6 + Math.random() * 1.2,
    // the random processes along the level
    rwA: 0, rwB: 0, scv: 0, asy: [0, 0, 0], amv: [0, 0, 0, 0], phn: [0, 0, 0, 0], wf: new Float64Array(NF),
    PH0: [0, 1, 2, 3].map(() => Math.random() * TWO_PI),
    JS: new Float64Array(NF), NX: new Float64Array(NF), NY: new Float64Array(NF), OFFF: new Float64Array(NF),
    GM: new Float64Array(NF),
    evs: [], nextEv: -7,
    kn: [0, 2, 0, 0.06], cm: 0, cs: 1.2, statsFresh: true,
  };
  for (let f = 0; f < NF; f++) {
    S.JS[f] = 1 + (Math.random() - 0.5) * 0.07;
    const a = ANG0[f] + (Math.random() - 0.5) * (FTY[f] === 0 ? 0.04 : 0.07);
    S.NX[f] = cos(a); S.NY[f] = sin(a);
    S.OFFF[f] = SEC_OFF[FTY[f]] + (Math.random() - 0.5) * 0.24;
  }
  S.ASG = new Float64Array(NF);
  for (let f = 0; f < NF; f++) S.ASG[f] = FTY[f] === 0 ? (S.NX[f] > 0 ? 1 : -1) : FTY[f] === 1 ? (S.NY[f] > 0 ? 1 : -1) : S.NX[f] > 0 ? 1 : -1;
  S.nextEv = S.lrim + 0.3;
  buildRamp(S, 0);
  return S;
}

export function setup(params) {
  params.s = makeState();
}

// ---- one entry of the ring: the chemistry and the faces at level l, grown at time t
function fillEntry(S, i, l, t) {
  const ch = S.ch, sh = S.sh;
  const o = (i & MASK) * CHS, p = (i & MASK) * SHS;
  const g = (L, s) => s * sqrt((2 * DL) / L) * randn();
  S.rwA = S.rwA * (1 - DL / 0.7) + g(0.7, 0.32);
  S.rwB = S.rwB * (1 - DL / 0.22) + g(0.22, 0.2);
  S.scv = S.scv * (1 - DL / 0.5) + g(0.5, 0.7);
  for (let k = 0; k < 3; k++) S.asy[k] = S.asy[k] * (1 - DL / 0.5) + g(0.5, 0.5);
  for (let k = 0; k < 4; k++) {
    S.amv[k] = S.amv[k] * (1 - DL / 0.9) + g(0.9, 1);
    S.phn[k] = S.phn[k] * (1 - DL / 0.5) + g(0.5, 1.3);
  }
  for (let f = 0; f < NF; f++) S.wf[f] = S.wf[f] * (1 - DL / 1.0) + g(0.7, 0.03);
  // events: thin bright lines, dim bands, a rare rust band
  if (l >= S.nextEv) {
    const r = Math.random();
    let e;
    if (r < 0.56) e = { w: 0.045 + 0.03 * Math.random(), a: 1.0 + 0.8 * Math.random(), kind: 0 };
    else if (r < 0.88) e = { w: 0.055 + 0.05 * Math.random(), a: -(0.9 + 0.5 * Math.random()), kind: 1 };
    else e = { w: 0.05 + 0.03 * Math.random(), a: 0.8 + 0.2 * Math.random(), kind: 2 };
    e.l = l + 3.2 * e.w;
    S.evs = S.evs.filter((q) => q.l > l - 9);
    S.evs.push(e);
    S.nextEv = e.l + 0.35 - 1.3 * log(1 - Math.random());
  }
  let ev = 0, ru = 0;
  for (let q = 0; q < S.evs.length; q++) {
    const e = S.evs[q], z = (l - e.l) / e.w;
    if (z > -4 && z < 4) {
      const gg = exp(-0.5 * z * z);
      if (e.kind === 2) { ru += e.a * gg; ev -= 0.9 * gg; } else ev += e.a * gg;
    }
  }
  const am = (k) => 0.85 + 0.9 * sst(-1.0, 1.2, S.amv[k]);
  const psi0 = TWO_PI * (AK[0] * l + t * IT[0]) + S.PH0[0] + S.phn[0];
  const saw = (ps) => {
    const q = psi0 / TWO_PI + ps;
    const fr = q - floor(q);
    return AMP[0] * 0.9 * am(0) * (3.4 * sst(0, 0.25, fr) * Math.pow(1 - fr, 1.5) - 0.97);
  };
  const psi1 = TWO_PI * (AK[1] * l + t * IT[1]) + S.PH0[1] + S.phn[1];
  ch[o] = saw(0);
  ch[o + 12] = saw(PS1[1]);
  ch[o + 13] = saw(PS1[2]);
  ch[o + 1] = AMP[1] * am(1) * sin(psi1);
  ch[o + 14] = AMP[1] * am(1) * sin(psi1 + TWO_PI * PS2[1]);
  ch[o + 15] = AMP[1] * am(1) * sin(psi1 + TWO_PI * PS2[2]);
  ch[o + 2] = AMP[2] * am(2) * sin(TWO_PI * (AK[2] * l + t * IT[2]) + S.PH0[2] + S.phn[2]);
  ch[o + 3] = AMP[3] * am(3) * sin(TWO_PI * (AK[3] * l + t * IT[3]) + S.PH0[3] + S.phn[3]);
  ch[o + 4] = S.rwA;
  ch[o + 11] = S.rwB;
  ch[o + 10] = S.asy[0];
  ch[o + 16] = S.asy[1];
  ch[o + 17] = S.asy[2];
  ch[o + 5] = cl(1.1 + 0.55 * S.scv, 0.3, 2.0);
  ch[o + 6] = ev;
  ch[o + 7] = cl(ru, 0, 1);
  ch[o + 8] = S.kap;
  ch[o + 9] = S.spd;
  for (let f = 0; f < NF; f++) sh[p + f] = 1 / (GB[f] * S.JS[f] * exp(S.wf[f]));
  sh[p + 10] = 1 / S.ecur;
}

// ---- one step of time: the growth rate, the dissolution, the camera, the ring
function step(S, h, kn) {
  S.t += h;
  const K2 = cl(kn[1], 0, 4), K3 = kn[2];
  const eT = EL0 * exp(0.5 * K3);
  S.ecur += (eT - S.ecur) * (1 - exp(-h / 1.3));
  // the rate: a log-normal wander, slow drift of the base, stalls and bursts at random
  const base = 0.022 + 0.011 * K2;
  const sx = 0.26 + 0.09 * K2;
  S.xr += (-S.xr * h) / 5 + sx * sqrt((2 * h) / 5) * randn();
  S.wr += (-S.wr * h) / 150 + 0.2 * sqrt((2 * h) / 150) * randn();
  let fac = exp(S.xr + S.wr);
  const pe = 0.5 + 0.25 * K2;
  if (!S.stall && Math.random() < (h * pe) / 55) S.stall = { t0: S.t, dur: 3 + 6 * Math.random(), d: 0.6 + 0.2 * Math.random() };
  if (S.stall) {
    const u = (S.t - S.stall.t0) / S.stall.dur;
    if (u >= 1) S.stall = null;
    else { const s = sin(PI * u); fac *= 1 - S.stall.d * s * s; }
  }
  if (!S.burst && Math.random() < (h * pe) / 40) S.burst = { t0: S.t, dur: 2 + 3 * Math.random(), g: (1.0 + 0.35 * K2) * (0.6 + 0.8 * Math.random()) };
  if (S.burst) {
    const u = (S.t - S.burst.t0) / S.burst.dur;
    if (u >= 1) S.burst = null;
    else { const s = sin(PI * u); fac *= 1 + S.burst.g * s * s; }
  }
  S.rho = cl(base * fac, base * 0.12, base * 3.5);
  S.spd = cl(log(S.rho / 0.04), -1.5, 1.2);
  S.kap += (cl(1 / S.rho, 5, 150) - S.kap) * (1 - exp(-h / 0.8));
  const lOld = S.lrim;
  if (S.diss) {
    const D = S.diss, u = (S.t - D.t0) / D.dur;
    if (u >= 1) {
      S.lrim = D.lpeak - D.depth;
      S.pend = null;
      S.diss = null;
      S.eps.push({ ls: S.lrim, c0: D.c0, il: 1 / D.lam });
      if (S.eps.length > 6) { S.eps.shift(); S.eps[0].ls = -1e9; S.eps[0].c0 = 0.04; }
      S.evs = S.evs.filter((q) => q.l < S.lrim - 0.05);
      S.evs.push({ l: S.lrim + 0.04, w: 0.04, a: 1.7, kind: 0 }, { l: S.lrim + 0.12, w: 0.055, a: -1.2, kind: 1 });
      S.nextEv = S.lrim + 0.55 + 0.8 * Math.random();
      S.sinceT = 0;
      S.gapT = 2.4 + Math.random() * 2.4;
      S.iprev = floor(S.lrim * IDL);
    } else {
      const s = sst(0, 1, u);
      S.lrim = D.lpeak - D.depth * s;
      S.pend = { c: D.c0 * s };
      S.iprev = floor(S.lrim * IDL);
    }
  } else {
    const dl = S.rho * h;
    S.lrim += dl;
    S.sinceT += dl;
    const iNew = floor(S.lrim * IDL);
    for (let i = S.iprev + 1; i <= iNew; i++) {
      const li = i * DL;
      fillEntry(S, i, li, S.t - h + (h * (li - lOld)) / dl);
    }
    S.iprev = iNew;
    if (S.sinceT >= S.gapT && S.lrim > S.lbot + 1) {
      const dur = 3.6 + 2.6 * Math.random();
      S.diss = { t0: S.t, dur, depth: 0.07 + 0.1 * Math.random(), lpeak: S.lrim, c0: 0.5 + 0.45 * Math.random(), lam: 0.09 + 0.08 * Math.random() };
    }
  }
  // the camera keeps the rim in frame, a little late
  S.lcam += (S.lrim - S.lcam) * (1 - exp(-h / 0.7));
  S.scam += (camTarget(S.ecur) - S.scam) * (1 - exp(-h / 0.9));
}

// the camera: the prism faces sit at the panel's sides; a squat crystal is zoomed in so that its tips stay near the top and bottom
function camTarget(e) {
  return max(31.2, (68 + 4 * sst(1.0, 1.5, e)) / (TIPY * e));
}

function advance(S, dt, kn) {
  const n = max(1, Math.ceil(dt / 0.04));
  const h = dt / n;
  for (let i = 0; i < n; i++) step(S, h, kn);
}

function render(S, kn) {
  const ch = S.ch, sh = S.sh, rgb = S.rgb, ramp = S.ramp;
  if (abs(kn[0] - S.hueAt) > 0.002) buildRamp(S, kn[0]);
  const s4 = max(0, 1.1 + 1.3 * (kn[3] - 0.06));
  const Sc = S.scam, iSc = 1 / Sc, lcam = S.lcam, lrim = S.lrim;
  const NX = S.NX, NY = S.NY, OFFF = S.OFFF, GM = S.GM, ASG = S.ASG;
  const eps = S.eps, nEp = eps.length, pend = S.pend;
  // the faces at the rim
  const so0 = (S.iprev & MASK) * SHS;
  const ie0 = sh[so0 + 10];
  const igV0 = (sh[so0] + sh[so0 + 1]) * 0.5;
  const igP10 = (sh[so0 + 2] + sh[so0 + 3] + sh[so0 + 4] + sh[so0 + 5]) * 0.25;
  const igP20 = (sh[so0 + 6] + sh[so0 + 7] + sh[so0 + 8] + sh[so0 + 9]) * 0.25;
  for (let f = 0; f < NF; f++) GM[f] = sh[so0 + f] * sqrt(NX[f] * NX[f] + NY[f] * NY[f] * ie0 * ie0);
  const Rrim = exp(lrim - lcam);
  const rA = ramp, ru0 = S.rust[0], ru1 = S.rust[1], ru2 = S.rust[2];
  const lbot = S.lbot + 0.01;
  const cm = S.cm, ics = 1 / S.cs;
  let sumC = 0, sumC2 = 0, nC = 0;
  const rimBoost = pend ? 0.9 : 0;
  for (let y = 0; y < H; y++) {
    const uy = (y + 0.5 - 64) * iSc;
    for (let x = 0; x < W; x++) {
      const ux = (x + 0.5 - 32) * iSc;
      const o3 = (y * W + x) * 3;
      // stage 0: where, roughly, in level, from the mirror-symmetric shape at the rim
      const ax = abs(ux), ay = abs(uy) * ie0;
      let a0 = ax * igV0;
      const t1 = (C1 * ax + S1 * ay) * igP10;
      if (t1 > a0) a0 = t1;
      const t2 = (C2 * ax + S2 * ay) * igP20;
      if (t2 > a0) a0 = t2;
      if ((a0 - Rrim) * Sc > 7) { rgb[o3] = 0; rgb[o3 + 1] = 0; rgb[o3 + 2] = 0; continue; }
      let ls0 = lcam + log(a0);
      if (ls0 > lrim) ls0 = lrim;
      if (ls0 < lbot) ls0 = lbot;
      const so = (floor(ls0 * IDL) & MASK) * SHS;
      // stage 1: the faces at that level
      const yp = uy * sh[so + 10];
      let a = -1e9, b = -1e9, fa = 0, fb = 0;
      for (let f = 0; f < NF; f++) {
        const w = (NX[f] * ux + NY[f] * yp) * sh[so + f];
        if (w > a) { b = a; fb = fa; a = w; fa = f; } else if (w > b) { b = w; fb = f; }
      }
      // which epoch the pixel belongs to: newest first
      let outside = false, lv = 0, Rf = 0;
      if (pend && lcam + log(smax(a, b, pend.c * a)) >= lrim) {
        outside = true;
        Rf = smax(a, b, pend.c * a);
        lv = lrim + 1e-3;
      } else {
        let lim = 1e9;
        for (let j = nEp - 1; j >= 0; j--) {
          const E = eps[j];
          if (j > 0) {
            const lt = lcam + log(smax(a, b, E.c0 * a));
            if (lt < E.ls) { lim = E.ls - 1e-4; continue; }
            const c1 = E.c0 * exp(-(lt - E.ls) * E.il);
            const l1 = lcam + log(smax(a, b, c1 * a));
            const c2 = E.c0 * exp(-max(l1 - E.ls, 0) * E.il);
            Rf = smax(a, b, c2 * a);
            lv = lcam + log(Rf);
            if (lv < E.ls) lv = E.ls + 1e-4;
          } else {
            Rf = smax(a, b, E.c0 * a);
            lv = lcam + log(Rf);
          }
          if (lv > lim) lv = lim;
          break;
        }
        outside = lv > lrim;
      }
      // distance from the outline in LEDs, positive outside
      const dL = ((Rf - Rrim) * Sc) / GM[fa];
      if (dL > 5) { rgb[o3] = 0; rgb[o3 + 1] = 0; rgb[o3 + 2] = 0; continue; }
      const cov1 = dL < -0.5;
      if (lv > lrim) lv = lrim;
      if (lv < lbot) lv = lbot;
      const io = (floor(lv * IDL) & MASK) * CHS;
      // chemistry
      const r = Sc * Rf;
      const kap = ch[io + 8];
      const q0 = sst(3.0, 5.5, r / (AK[0] + kap * IT[0]));
      const q1 = sst(3.0, 5.5, r / (AK[1] + kap * IT[1]));
      const q2 = sst(3.0, 5.5, r / (AK[2] + kap * IT[2]));
      const q3 = sst(3.0, 5.5, r / (AK[3] + kap * IT[3]));
      const o2 = ch[io + 2] * q2, oo3 = ch[io + 3] * q3;
      const common = ch[io + 4] + ch[io + 11] * sst(2.4, 5, r * 0.5) + ch[io + 6] * sst(6, 16, r) + 0.12 * ch[io + 9];
      const sg = s4 * ch[io + 5];
      const ta = FTY[fa];
      let m = MT[ta];
      let C = common + m[0] * ch[io + OSA[ta]] * q0 + m[1] * ch[io + OSB[ta]] * q1 + m[2] * o2 + m[3] * oo3 + sg * (OFFF[fa] + 0.6 * ASG[fa] * ch[io + ASC[fa]]);
      const wb = 0.03 * a;
      const dd = a - b;
      if (dd < wb && b > -1e8) {
        const tb = FTY[fb];
        m = MT[tb];
        const C2b = common + m[0] * ch[io + OSA[tb]] * q0 + m[1] * ch[io + OSB[tb]] * q1 + m[2] * o2 + m[3] * oo3 + sg * (OFFF[fb] + 0.6 * ASG[fb] * ch[io + ASC[fb]]);
        const wt = 0.5 + 0.5 * (dd / wb);
        C = C2b + (C - C2b) * wt;
      }
      const Ce = C + (0.8 + rimBoost) * exp((lv - lrim) * 14);
      if (cov1) { sumC += Ce; sumC2 += Ce * Ce; nC++; }
      const vv = sst(-1.35, 2.3, (Ce - cm) * ics);
      const ri = ((vv * 255) | 0) * 3;
      let cr = rA[ri], cg = rA[ri + 1], cb = rA[ri + 2];
      const rs = ch[io + 7];
      if (rs > 0.01) {
        const k = rs * 0.85, dk = 0.55 + 0.45 * vv;
        cr += (ru0 * dk - cr) * k; cg += (ru1 * dk - cg) * k; cb += (ru2 * dk - cb) * k;
      }
      // the edge: coverage inside, a faint halo outside
      let cov = 0.5 - dL;
      if (cov > 1) cov = 1;
      if (cov >= 1) {
        rgb[o3] = cr; rgb[o3 + 1] = cg; rgb[o3 + 2] = cb;
      } else {
        const hI = 0.12 * exp(-max(dL, 0) / 1.3);
        const hr = rA[(70 * 3)] * hI, hg = rA[70 * 3 + 1] * hI, hb = rA[70 * 3 + 2] * hI;
        if (cov < 0) cov = 0;
        rgb[o3] = hr + (cr - hr) * cov; rgb[o3 + 1] = hg + (cg - hg) * cov; rgb[o3 + 2] = hb + (cb - hb) * cov;
      }
    }
  }
  if (nC > 200) {
    const m = sumC / nC, sd = sqrt(max(sumC2 / nC - m * m, 0.05));
    const k = S.statsFresh ? 1 : 0.04;
    S.cm += (m - S.cm) * k;
    S.cs += (sd - S.cs) * k;
    S.statsFresh = false;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  const kn = (input && input.knobValues) || [0, 2, 0, 0.06];
  S.kn = kn;
  if (!S.ready) {
    S.ready = true;
    S.ecur = EL0 * exp(0.5 * kn[2]);
    S.scam = camTarget(S.ecur);
    S.iprev = floor(S.lrim * IDL) - 1;
    // the history: grow the crystal from a speck, 7 levels, so that the picture opens full of shells
    let guard = 0;
    while (S.lrim < -0.02 && guard++ < 20000) advance(S, 0.05, kn);
    S.lcam = S.lrim;
    S.scam = camTarget(S.ecur);
  }
  if (S.statsFresh) { S.lcam = S.lrim; render(S, kn); S.statsFresh = true; }
  advance(S, d, kn);
  render(S, kn);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const rgb = S.rgb;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, rgb[o], rgb[o + 1], rgb[o + 2]);
    }
  }
}
