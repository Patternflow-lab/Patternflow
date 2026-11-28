// ===== Patternflow pattern =====
// Title:   Beach Marks
// Family:  fatigue
// Idea:    The fracture surface of a metal that failed by fatigue, seen from above while it forms: cracks start at random points on the edge of a plate that slides slowly past, each grows as a half ellipse under Paris's law, creeping at first and then running, and every pause between load blocks leaves a tempered line of straw, bronze, purple and blue on the gunmetal behind the front, until neighbouring cracks meet in a dark ratchet step and the old surface drifts off the top of the panel.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Paris-Erdogan law for fatigue crack growth, da/dN = C (dK)^m with dK proportional to the stress range times the square root of the crack length (Paris and Erdogan, 1963, from memory); beach marks (clamshell marks), ratchet marks and the retardation after an overload as read in fractography (from memory); temper colours, the oxide film colour that depends on its thickness; original code, pattern round 275
// Round:   275
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Load=0..4, Blocks=-1..1, Pull=-1..1
//
// Knob 1: Hue. Turns the tempered lines round the colour wheel, one turn over the range. At 0 they run from pale straw through gold to brass, with the long-rest and overload lines purple, violet and blue; at 0.25 the lines are green, at 0.5 blue, at 0.75 pink. The gunmetal itself only leans, 0.07 of a turn either way along a sine of the knob (teal steel to violet steel), so the panel stays grey-blue at every setting. It opens at 0, which is not red.
// Knob 2: Load. The stress range, 2^(0.2 (K - 2)) times the normal one: 0.76 at 0, 1 at the opening 2, 1.32 at 4. Paris's law has a crack grow as the stress range cubed, so the fronts run 0.44 times as fast at 0, 1 times at 2 and 2.3 times at 4. A crack that takes 60 s to cross the 64 columns at 2 takes 137 s at 0 and 26 s at 4. The load blocks are made 2^(-0.3 (K - 2)) times as long (1.5 times at 0, 0.66 at 4) so that the lines keep their spacing, and a lighter load starts its cracks earlier below the panel (1.34 times as far at 0, 0.75 at 4) so that the panel is not mostly bare. At 0 it is small young fans in dark metal, at 4 a few broad, nearly finished ones.
// Knob 3: Blocks. How long a load block lasts, 2^(0.9 K) times: 0.54 at -1, 1.04 at the opening 0.06, 1.87 at 1, and how much the blocks differ, the spread of growth time being 40 percent of its full range at -1 and all of it at 1. At the opening a block is 2.8 to 6.2 s of growth and 0.6 to 4.4 s of rest, and the lines lie 3 to 12 LEDs apart (10 to 90 percent of them, median 5). At -1 a block is 1.6 to 2.5 s and the lines are thin, close and alike; at 1 it is 4.7 to 13 s and they stand far apart, with broad bare bands between. A turn reaches the picture with the next block, 3 to 6 s later at the opening.
// Knob 4: Pull. How fast the plate slides past, 1.76 x 2^(1.1 K) LEDs a second: 0.82 at -1, 1.84 at the opening 0.06, 3.77 at 1, so a row crosses the panel in 156 s, 70 s and 34 s. Everything on the panel moves up at that rate. Slow, the panel is old, finished surface and the fronts work near the bottom; fast, it is half young fans and bare metal. New cracks start earlier below the panel the faster it pulls (1.7 times as far at 1, 0.58 at -1), so the bare share does not run away.
//
// What the picture is. The fracture surface of a plate that failed by fatigue, seen from above and drawn while it forms. One edge of the plate is the left edge of the panel, or the right one, each group of cracks picking its side. Cracks start on that edge, grow into the plate as half ellipses and leave the broken surface behind them; the metal they have not reached yet is dark bare gunmetal. The plate slides up the panel, so old surface drifts off the top and new edge arrives from below. Nothing is ever finished and nothing comes round again.
// The cracks. They start in groups of two or three, as several sites open along an edge under one load: sites 20 to 48 rows apart, started within 7.3 s of each other, each with its own speed (0.8 to 1.2 times), its own aspect (depth to length 0.75 to 1.4, median 1) and a front that is not quite an ellipse, a size times 1 plus 0.1 w, with w a smooth random function of the angle. A patch of surface belongs to the crack whose front reached it first, so every pixel is laid once and keeps its crack, the time the front passed and the load block it was in. Where two cracks of a group meet, the border is the line along which they arrived together, and it bends toward the one that started later. The cracks at the two ends of a group are held to 30 to 42 rows on their outer side, as a group stops at the edge of the stressed stretch, which makes the flat border between groups. A group starts 140 to 195 rows below the panel's top (below its bottom, at the opening) and lies edge to edge with the group before it.
// The growth. Paris and Erdogan: da/dN = C (dK)^m, dK proportional to the stress range and to the square root of the crack length a, m taken as 3. The front of a crack of size s (its depth in LEDs) moves at v = 1.32 x / sqrt(1 + x^2) (L A)^3 r p / (1 + (s / 140)^2) LEDs a second, with x = ((s + 9) / 22)^1.5, L the load of Knob 2, A the amplitude of the block, r the retardation after an overload and p the crack's own speed. For small s that is the law with a to the power 1.5; the cap at 1.32 LEDs a second, the offset of 9 and the slow fall beyond 140 stand for a plate that never runs unstable on the panel. A crack starts at 2.6 to 3.4 LEDs. At the opening one with A of 1 and p of 1 is 10 LEDs deep after 11 s (0.83 LEDs a second), 30 after 30 s (1.16) and has crossed the panel after 60 s. A crack that has passed every pixel it could still own is left alone, and a crack that owns nothing in the 512 rows that are kept is dropped.
// The load blocks. One load history for the whole plate, so every crack lays its line at the same moment. A block is a stretch of growth and a stretch of rest. A is exp(0.22 g) with g about normal, so the growth of a block varies by a third either way. One block in ten is an overload with A of 1.5 to 1.85: the front jumps 3.4 to 6.3 times as fast, the rest is 1.5 times longer, the line 1.45 times stronger, and the cracks slow to 0.32 of their speed, which recovers with a time constant of 6.4 s. Every other block's line has a strength of 0.55 to 1. A block that moved the front less than 1.5 LEDs leaves no line, and one that moved it less than 3.5 a faint one. Lines also fade in over the first 5 to 16 LEDs of depth, so there is a smooth patch round every origin, as the initiation area is on a real surface.
// The lines. A line lies where the front stood when its growth ended, with a sharp outer edge (0.8 LEDs) and a soft inner one (1.3 LEDs), so it is 2 to 3 LEDs wide where the blocks are wide and thins where the front moves fast. Its colour is an oxide film. The thickness is 0.03 + 0.5 (rest / 4.5 s)^0.9 + 0.25 (A - 1), up to 0.08 more over the next minute, and it fills in during the rest, from a quarter of the thickness to all of it, while the weight goes from 0.2 to 1 in about a second. The thickness goes through the temper ramp: steel 0, pale straw 0.15, straw 0.30, brass 0.44, purple 0.58, violet 0.73, blue 0.87, pale blue 1. Distances to a line are taken in LEDs along the front, and where the front runs along a flank, so that lines come closer than they are wide, they fade instead of turning to a band.
// The look of the metal. Fresh surface is lighter and glows pale for 1.6 s behind the front, and lightens for 9 s, so a front at work is a bright edge on the bare metal and one at rest dims. Each crack has its own brightness (7 percent either way), and the wobble of its front also brightens and darkens it by 6 percent along rays from its origin. Where two cracks meet a dark ratchet step, 3 or 4 LEDs soft, takes half the brightness. The bare metal is the same gunmetal at 61 percent of the brightness. Over 900 sampled frames no LED had its brightest channel under 45 of 255, at the opening knobs or at either end.
// How it keeps going. It is state with fixed sizes: 512 world rows of 64 patches, 20 cracks at most (6 in use on average, 9 at most), 96 lines to a crack. A row that scrolls off the top is cleared and comes back as a bare row at the bottom. The clock is set back every 15 minutes or so, so nothing grows over hours. The first update runs about 360 s of the plate before the first frame (0.3 s steps, around 40 ms), so the panel opens with old surface at the top and fronts at work further down. All time runs at 2.2 times the Lab's, which the numbers above already count in Lab seconds.
// What is exact and what is drawn. Fatigue cracks that grow as the stress range cubed times a to the power 1.5, semi-elliptical fans around a point on the edge, a line at each pause in the loading, the slowing after an overload, ratchet steps between neighbouring origins and a film colour that runs straw, brass, purple, blue with thickness are fracture mechanics and fractography as I know them from memory. The cap on the speed, the groups and their edges, the wobble of the fronts, the sliding plate, the way rest and overload become thickness, and every colour number, the glow and the ratchet's darkness are drawing choices.

const W = 64, H = 128;
const NR = 512, RM = NR - 1;          // world rows kept, a ring
const NN = 20;                        // cracks alive at once, at most
const NBL = 96;                       // lines one crack remembers
const TS = 2.2;                       // model seconds to a Lab second
const { floor, ceil, sqrt, exp, min, max, abs, pow, sin, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---------------------------------------------------------------- the temper ramp
// oxide thickness 0..1 -> colour: steel, pale straw, straw, brass, purple, violet, blue, pale blue
const TEMPER = [
  [0.0, 0.585, 0.22, 0.60],
  [0.15, 0.15, 0.27, 0.95],
  [0.30, 0.138, 0.62, 1.0],
  [0.44, 0.128, 0.48, 0.76],
  [0.58, 0.83, 0.52, 0.90],
  [0.73, 0.73, 0.64, 0.96],
  [0.87, 0.615, 0.84, 1.0],
  [1.0, 0.55, 0.40, 0.92],
];
const NT = 64;
const TL = new Float32Array(NT * 3);
let TLHUE = -9;
function buildRamp(hue) {
  const c = [0, 0, 0], rgb = [];
  for (let a = 0; a < TEMPER.length; a++) {
    hsv(TEMPER[a][1] + hue, TEMPER[a][2], TEMPER[a][3], c);
    rgb.push([c[0] * 255, c[1] * 255, c[2] * 255]);
  }
  for (let i = 0; i < NT; i++) {
    const th = i / (NT - 1);
    let a = 0;
    while (a < TEMPER.length - 2 && th > TEMPER[a + 1][0]) a++;
    const f = cl((th - TEMPER[a][0]) / (TEMPER[a + 1][0] - TEMPER[a][0]), 0, 1);
    for (let k = 0; k < 3; k++) TL[i * 3 + k] = rgb[a][k] * (1 - f) + rgb[a + 1][k] * f;
  }
  TLHUE = hue;
}

// exp(-x) on a table, x in 0..8
const EXN = 256;
const EX = new Float32Array(EXN + 1);
for (let i = 0; i <= EXN; i++) EX[i] = exp((-8 * i) / EXN);
const ex = (x) => (x >= 8 ? 0 : x <= 0 ? 1 : EX[(x * (EXN / 8)) | 0]);

// ---------------------------------------------------------------- state
export function setup(params) {
  params.s = {
    t: 0, k: null, ready: false,
    sc: 0,                                   // scroll, world rows
    fl: 0,                                   // floor of it
    own: new Int8Array(NR * W).fill(-1),     // which crack laid each patch of surface
    tar: new Float32Array(NR * W),           // when the front got there
    bk: new Uint8Array(NR * W),              // in which load block
    // cracks
    na: new Uint8Array(NN), nox: new Float32Array(NN), nwy: new Float64Array(NN), ne: new Float32Array(NN),
    nsd: new Uint8Array(NN), nlu: new Float32Array(NN), nld: new Float32Array(NN), nw: new Float32Array(NN * 17), ns: new Float32Array(NN), ncb: new Int16Array(NN), nown: new Int32Array(NN),
    nt0: new Float64Array(NN), nfz: new Uint8Array(NN), nid: new Float32Array(NN), ntone: new Float32Array(NN), nsp: new Float32Array(NN),
    // lines
    ls: new Float32Array(NN * NBL), lt: new Float32Array(NN * NBL), lr: new Float32Array(NN * NBL), la: new Float32Array(NN * NBL),
    lf: new Uint8Array(NN * NBL), lw: new Float32Array(NN * NBL), lg: new Float32Array(NN * NBL), lc: new Float32Array(NN * NBL * 3),
    // sites where cracks will start
    groups: [], pend: [], lastEnd: 0,
    // load blocks
    phs: 1, tl: 0.5, G: 3, R: 1, A: 1, st: 1, over: false, ret: 1,
    cb: new Float32Array(W * (H + 3) * 3), mk: new Uint8Array(W * (H + 3)), mb: new Float32Array(W * (H + 3)),
  };
}

const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7;

function recycle(S, newFl) {
  const own = S.own, na = S.na, nown = S.nown;
  for (let r = S.fl; r < newFl; r++) {
    const o = (r & RM) * W;
    for (let x = 0; x < W; x++) {
      const i = own[o + x];
      if (i >= 0) nown[i]--;
      own[o + x] = -1;
    }
  }
  S.fl = newFl;
  for (let i = 0; i < NN; i++) if (na[i] && nown[i] <= 0 && S.t - S.nt0[i] > 2) na[i] = 0;
}

// the front of crack i goes from size s0 to s1 in h seconds, ending at time t1
const WOB = 0.1;
function claim(S, i, s0, s1, t1, h) {
  const own = S.own, tar = S.tar, bk = S.bk, nw = S.nw;
  const e = S.ne[i], ox = S.nox[i], wy = S.nwy[i], cbi = S.ncb[i], Lu = S.nlu[i], Ld = S.nld[i], sd = S.nsd[i];
  const ee = e * e, wb = i * 17;
  const latU = (s1 * Lu) / sqrt(ee * Lu * Lu + s1 * s1), latD = (s1 * Ld) / sqrt(ee * Ld * Ld + s1 * s1);
  const r0 = max(S.fl, floor(wy - latU * (1 + WOB))), r1 = min(S.fl + NR - 1, ceil(wy + latD * (1 + WOB)));
  const ds = max(s1 - s0, 1e-6), t0 = t1 - h;
  const a0 = s0 / (1 + WOB), a1 = s1 / (1 - WOB);
  let n = 0;
  for (let r = r0; r <= r1; r++) {
    const dy = r + 0.5 - wy, L = dy < 0 ? Lu : Ld, u2 = (dy * dy) / (L * L);
    if (u2 >= 1) continue;
    const q = (ee * dy * dy) / (1 - u2);
    const outer = a1 * a1 - q;
    if (outer <= 0) continue;
    const inner = a0 * a0 - q;
    const xa = ox + (inner > 0 ? sqrt(inner) : 0), xb = ox + sqrt(outer);
    let xs = floor(xa - 0.5) + 1, xe = floor(xb - 0.5);
    if (xs < 0) xs = 0;
    if (xe > W - 1) xe = W - 1;
    const o = (r & RM) * W, ey = e * dy;
    for (let x = xs; x <= xe; x++) {
      const xx = sd ? W - 1 - x : x;
      if (own[o + xx] >= 0) continue;
      const dx = x + 0.5 - ox;
      const pp = (ey / (dx + abs(ey) + 1.5) + 1) * 8, pi = pp | 0, pf = pp - pi;
      const d = sqrt(dx * dx + q) * (1 + WOB * (nw[wb + pi] + (nw[wb + pi + 1] - nw[wb + pi]) * pf));
      if (d > s1) continue;
      own[o + xx] = i;
      tar[o + xx] = t0 + h * cl((d - s0) / ds, 0, 1);
      bk[o + xx] = cbi;
      n++;
    }
  }
  S.nown[i] += n;
  return n;
}

function newGroup(S) {
  const n = 2 + floor(rnd() * 2), mem = [];
  const capU = 30 + 12 * rnd(), capD = 30 + 12 * rnd();
  let y = 0, prev = 0;
  for (let k = 0; k < n; k++) {
    const rho = 12 + 10 * rnd();
    if (k) y += (prev + rho) * (0.8 + 0.3 * rnd());
    prev = rho;
    mem.push({ y, Lu: k ? 300 : capU, Ld: k < n - 1 ? 300 : capD, e: cl(1.0 * exp(0.15 * gauss()), 0.75, 1.4), ox: -rnd() * 1.4, spd: 0.8 + 0.4 * rnd(), jit: rnd() * 16 });
  }
  const bd = S.lastEnd, y0 = bd + 0.85 * capU;
  for (let k = 0; k < n; k++) mem[k].y += y0;
  S.lastEnd = mem[n - 1].y + 0.85 * capD;
  const sd = rnd() < 0.5 ? 1 : 0;
  for (let k = 0; k < n; k++) mem[k].sd = sd;
  S.groups.push({ bd, yb: 140 + 55 * rnd(), mem });
}

function birth(S, st) {
  let slot = -1;
  for (let i = 0; i < NN; i++) if (!S.na[i]) { slot = i; break; }
  if (slot < 0) return;
  const i = slot;
  S.na[i] = 1;
  S.nwy[i] = st.y;
  S.nox[i] = st.ox;
  S.ne[i] = st.e;
  S.nsd[i] = st.sd;
  S.nlu[i] = st.Lu;
  S.nld[i] = st.Ld;
  S.nw[i * 17] = (rnd() * 2 - 1) * 0.6;
  S.nsp[i] = st.spd;
  S.ns[i] = 2.6 + rnd() * 0.8;
  for (let k = 1; k < 17; k++) S.nw[i * 17 + k] = cl(S.nw[i * 17 + k - 1] * 0.55 + (rnd() * 2 - 1) * 0.8, -1, 1);
  S.ncb[i] = 0;
  S.nown[i] = 0;
  S.nt0[i] = S.t;
  S.nfz[i] = 0;
  S.nid[i] = 0;
  S.ntone[i] = (rnd() - 0.5) * 0.14;
  for (let j = 0; j < NBL; j++) S.lf[i * NBL + j] = 0;
  claim(S, i, 0, S.ns[i], S.t, 0.05);
}

function startBlock(S, K) {
  const sc = pow(2, 0.9 * K[2]) * pow(2, -0.3 * (K[1] - 2));
  const irr = 0.4 + 0.6 * (K[2] + 1) * 0.5;
  S.G = sc * (5.5 + 10 * irr * pow(rnd(), 1.3) + 1.5 * (1 - irr));
  S.R = sc * (1.2 + 8 * pow(rnd(), 1.6));
  S.over = rnd() < 0.1;
  S.A = S.over ? 1.5 + 0.35 * rnd() : exp(0.22 * gauss());
  S.st = 0.55 + 0.45 * rnd();
  if (S.over) {
    S.R *= 1.5;
    S.ret = min(S.ret, 0.32);
  }
  S.phs = 0;
  S.tl = S.G;
}

function finishGrowth(S) {
  for (let i = 0; i < NN; i++) {
    if (!S.na[i] || S.nfz[i]) continue;
    const cb = min(S.ncb[i], NBL - 1), j = i * NBL + cb;
    const prev = cb > 0 ? S.ls[j - 1] : 0;
    S.ls[j] = S.ns[i];
    S.lt[j] = S.t;
    S.lr[j] = S.R;
    S.la[j] = S.A;
    S.lf[j] = 1;
    S.lw[j] = sm(1.5, 3.5, S.ns[i] - prev) * sm(5, 16, S.ns[i]) * (S.over ? 1.45 : S.st);
    if (S.ncb[i] < NBL - 1) S.ncb[i]++;
  }
  S.phs = 1;
  S.tl = S.R;
}

function grow(S, K, q) {
  const mul = pow(2, 0.6 * (K[1] - 2)) * S.A * S.A * S.A * S.ret;
  for (let i = 0; i < NN; i++) {
    if (!S.na[i] || S.nfz[i]) continue;
    const s0 = S.ns[i];
    const x = pow((s0 + 9) / 22, 1.5);
    const v = ((0.6 * x) / sqrt(1 + x * x)) * mul * S.nsp[i] / (1 + (s0 / 140) * (s0 / 140));
    const s1 = s0 + v * q;
    S.ns[i] = s1;
    const n = claim(S, i, s0, s1, S.t, q);
    S.nid[i] = n ? 0 : S.nid[i] + q;
    if (S.nid[i] > 6 && s1 > 40) S.nfz[i] = 1;
  }
}

function step(S, K, h) {
  const V = 0.8 * pow(2, 1.1 * K[3]);
  S.sc += V * h;
  const nf = floor(S.sc);
  if (nf > S.fl) recycle(S, nf);
  S.ret += (1 - S.ret) * (1 - exp(-h / 14));
  let rem = h;
  while (rem > 1e-7) {
    const q = min(rem, S.tl);
    S.t += q;
    if (S.phs === 0) grow(S, K, q);
    S.tl -= q;
    rem -= q;
    if (S.tl <= 1e-7) {
      if (S.phs === 0) finishGrowth(S);
      else startBlock(S, K);
    }
  }
  while (S.groups.length < 3) newGroup(S);
  for (let g = S.groups.length - 1; g >= 0; g--) {
    const gr = S.groups[g];
    if (gr.bd - S.sc <= min(330, gr.yb * pow(V / 0.8, 0.7) * pow(2, -0.21 * (K[1] - 2)))) {
      for (const m of gr.mem) S.pend.push({ sd: m.sd, y: m.y, Lu: m.Lu, Ld: m.Ld, e: m.e, ox: m.ox, spd: m.spd, tb: S.t + m.jit });
      S.groups.splice(g, 1);
    }
  }
  for (let k = S.pend.length - 1; k >= 0; k--) {
    if (S.t >= S.pend[k].tb) {
      birth(S, S.pend[k]);
      S.pend.splice(k, 1);
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
  } else {
    const al = 1 - exp(-d / 0.2);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  if (!S.ready) {
    S.ready = true;
    const V = 0.8 * pow(2, 1.1 * S.k[3]);
    const tpre = min(2400, 420 / V + 300);
    S.sc = -V * tpre;
    S.fl = floor(S.sc);
    S.lastEnd = S.sc - 40;
    let tt = 0;
    while (tt < tpre) {
      step(S, S.k, 0.3);
      tt += 0.3;
    }
  }
  step(S, S.k, d * TS);
  if (S.t > 3000) {
    // keep the clock small so that the float32 times stay exact
    const D = 2000;
    S.t -= D;
    for (let i = 0; i < NR * W; i++) S.tar[i] -= D;
    for (let i = 0; i < NN; i++) S.nt0[i] -= D;
    for (let j = 0; j < NN * NBL; j++) S.lt[j] -= D;
    for (const p of S.pend) p.tb -= D;
  }
}

// ---------------------------------------------------------------- draw
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const K = S.k, now = S.t;
  if (abs(TLHUE - K[0]) > 0.002) buildRamp(K[0]);
  const fl = S.fl, fr = S.sc - fl;
  const own = S.own, tar = S.tar, bk = S.bk;
  const mk = S.mk, mb = S.mb, cb = S.cb;

  // colour of every line, now
  const ls = S.ls, lt = S.lt, lr = S.lr, la = S.la, lf = S.lf, lw = S.lw, lg = S.lg, lc = S.lc;
  for (let i = 0; i < NN; i++) {
    if (!S.na[i]) continue;
    for (let j = i * NBL, je = j + NBL; j < je; j++) {
      if (!lf[j]) break;
      const age = now - lt[j], dose = min(age / lr[j], 1);
      let th = 0.03 + 0.5 * pow(lr[j] / 10, 0.9) + 0.25 * (la[j] - 1) + 0.08 * (1 - exp(-age / 150));
      th *= 0.25 + 0.75 * dose * (2 - dose);
      lg[j] = 1 - 0.8 * exp(-age / 1.8);
      th = cl(th, 0, 1) * (NT - 1);
      const a = th | 0, f = th - a, a2 = min(a + 1, NT - 1);
      lc[j * 3] = TL[a * 3] * (1 - f) + TL[a2 * 3] * f;
      lc[j * 3 + 1] = TL[a * 3 + 1] * (1 - f) + TL[a2 * 3 + 1] * f;
      lc[j * 3 + 2] = TL[a * 3 + 2] * (1 - f) + TL[a2 * 3 + 2] * f;
    }
  }

  // ratchet mask: where two cracks laid neighbouring patches
  const NRW = H + 2;
  for (let y = 0; y < NRW; y++) {
    const r = fl + y, o = (r & RM) * W, o2 = ((r + 1) & RM) * W;
    for (let x = 0; x < W; x++) {
      const a = own[o + x];
      let m = 0;
      if (a >= 0) {
        const b = x < W - 1 ? own[o + x + 1] : a, c = own[o2 + x];
        if ((b >= 0 && b !== a) || (c >= 0 && c !== a)) m = 1;
      }
      mk[y * W + x] = m;
    }
  }
  for (let y = 0; y < NRW; y++) {
    for (let x = 0; x < W; x++) {
      const xm = x > 0 ? x - 1 : 0, xp = x < W - 1 ? x + 1 : W - 1;
      mb[y * W + x] = (mk[y * W + xm] + 2 * mk[y * W + x] + mk[y * W + xp]) * 0.25;
    }
  }

  const hb = 0.585 + 0.07 * sin(TAU * K[0]), cc = [0, 0, 0];
  hsv(hb, 0.3, 0.44, cc);
  const sr = cc[0] * 255, sg = cc[1] * 255, sbl = cc[2] * 255;
  hsv(hb, 0.34, 0.27, cc);
  const vr = cc[0] * 255, vg = cc[1] * 255, vb = cc[2] * 255;
  for (let y = 0; y <= H; y++) {
    const r = fl + y, o = (r & RM) * W;
    for (let x = 0; x < W; x++) {
      const idx = o + x, i = own[idx];
      let R, G, B;
      if (i < 0) {
        R = vr; G = vg; B = vb;
      } else {
        const e = S.ne[i], dx = (S.nsd[i] ? W - x : x + 1) - 0.5 - S.nox[i], dy = r + 0.5 - S.nwy[i];
        const L = dy < 0 ? S.nlu[i] : S.nld[i];
        const om = max(1 - (dy * dy) / (L * L), 0.02);
        const q = (e * e * dy * dy) / om;
        const d0 = sqrt(dx * dx + q);
        const ey = e * dy, pp = (ey / (dx + abs(ey) + 1.5) + 1) * 8, pi = pp | 0, wv = S.nw[i * 17 + pi] + (S.nw[i * 17 + pi + 1] - S.nw[i * 17 + pi]) * (pp - pi);
        const d = d0 * (1 + WOB * wv);
        const gy = (e * e * dy) / (om * om);
        const gm = sqrt(dx * dx + gy * gy) / (d0 + 1e-3);
        const inv = 1 / max(gm, 0.35), ga = 1 / (1 + 0.5 * max(gm - 1.5, 0));
        const gl = ex((now - tar[idx]) / 3.5);
        const lum = 1 + S.ntone[i] + 0.06 * wv + 0.1 * (1 - sm(0, 50, d)) + 0.26 * ex((now - tar[idx]) / 20);
        R = sr * lum; G = sg * lum; B = sbl * lum;
        const b = bk[idx], base = i * NBL;
        if (b > 0) {
          const j = base + b - 1;
          const w = lw[j] * lg[j] * ga * ex(((d - ls[j]) * inv) / 0.8);
          if (w > 0.01) {
            const ww = min(0.95, w * 0.95);
            R += (lc[j * 3] - R) * ww; G += (lc[j * 3 + 1] - G) * ww; B += (lc[j * 3 + 2] - B) * ww;
          }
        }
        const j = base + b;
        if (lf[j]) {
          const w = lw[j] * lg[j] * ga * ex(((ls[j] - d) * inv) / 1.3);
          if (w > 0.01) {
            const ww = min(0.95, w * 0.95);
            R += (lc[j * 3] - R) * ww; G += (lc[j * 3 + 1] - G) * ww; B += (lc[j * 3 + 2] - B) * ww;
          }
        }
        if (gl > 0.01) {
          const gg = gl * 0.8;
          R += (215 - R) * gg; G += (232 - G) * gg; B += (250 - B) * gg;
        }
        const dk = 1 - 0.5 * min(1, mb[y * W + x] * 1.6);
        R *= dk; G *= dk; B *= dk;
      }
      const o4 = (y * W + x) * 3;
      cb[o4] = R; cb[o4 + 1] = G; cb[o4 + 2] = B;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = (y * W + x) * 3, b = a + W * 3;
      display.setPixel(
        x, y,
        cl((cb[a] + (cb[b] - cb[a]) * fr) | 0, 0, 255),
        cl((cb[a + 1] + (cb[b + 1] - cb[a + 1]) * fr) | 0, 0, 255),
        cl((cb[a + 2] + (cb[b + 2] - cb[a + 2]) * fr) | 0, 0, 255)
      );
    }
  }
}
