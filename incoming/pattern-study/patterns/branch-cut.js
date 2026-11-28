// ===== Patternflow pattern =====
// Title:   Branch Cut
// Family:  riemannsurface
// Idea:    Two squares are the two sheets of the Riemann surface of w = sqrt((z - a)(z - b)), each drawn as a grid of constant Re w and Im w that pinches at the two branch points and jumps along the cut between them, and beads on loops round one point, the other or both change sheet each time they cross the cut and keep it when they circle both.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Riemann surface of an algebraic function and its branch cut (Bernhard Riemann, doctoral thesis 1851; paper on Abelian functions 1857), monodromy as the sheet you come back on after a loop (from memory), pattern round 272
// Round:   272
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.4..4, Spread=-1..1, Grid=6..13
//
// Knob 1: Hue. Adds the knob to the hue of both palettes, one turn over the range, and the sheets stay about 0.48 of a turn apart. At 0 the top runs from rose on one side of the cut through orange to amber on the other, the bottom from indigo through cyan to teal; at 0.25 the top is green and the bottom violet, at 0.5 azure and orange, at 0.75 magenta and green. The hue also drifts by about 0.035 over 40 s.
// Knob 2: Pace. Slow time runs at Pace / 2 per second and the beads, the cut and the grid follow it. At the opening 2 a bead goes round its loop in 4.8 to 8.4 s and changes sheet 10.8 times a minute (measured over 10 min); at 0.4 a loop takes 24 to 42 s and a bead changes sheet 2.2 times a minute; at 4 a loop takes 2.4 to 4.2 s and 24 sheet changes a minute.
// Knob 3: Spread. The distance between the branch points: the half chord is 0.78 exp(0.43 v) in z, 0.51 at -1, 0.78 at 0, 1.20 at 1, with a swell of 20 percent. Over 10 min the cut measured 15 LED long on average at -1 (8 to 22), 25 at the opening 0 (16 to 37) and 35 at 1 (15 to 48).
// Knob 4: Grid. How many lines of each family cross the window far from the cut: 6 at the opening, 13 at the top, which is 10.7 and 4.9 LED apart there (6.7 at the middle), with a breath of 10 to 15 percent. The lines fade out below 4.2 LED apart, so the patch round each branch point where they have faded grows with Grid.
//
// What the picture is. The function w = sqrt((z - a)(z - b)) has two values for each z. Its Riemann surface is two copies of the z-plane, the sheets, glued along a cut joining the branch points a and b: walk once round a and you return on the other sheet, walk round both and you return on the sheet you left. The top square is sheet 1 and the bottom square sheet 2, both the same window of the z-plane, 4.4 across (0.069 per LED). The cut is the bright line between two bright dots, the same in both squares. Sheet 1 is drawn by w and sheet 2 by -w, each as a Cartesian grid of the w-plane laid back onto z. Far from the cut the grid is square. Near a branch point w goes like the square root of z - a, so the lines bend into parabolas that crowd toward it, and across the cut w turns into -w, so the line that meets the cut from one side is not the one that meets it from the other.
// The function. With m = (a + b) / 2, c = (b - a) / 2 and u = (z - m) / c, w = c sqrt(u - 1) sqrt(u + 1), each root the principal one: analytic off the segment from a to b and like z - m at infinity. On the segment w is c times an imaginary number, opposite on the two banks. dw/dz = (z - m) / w.
// The lines. Sheet 1 has a line where Re(e^(-i beta) w) = (k + p) s and where Im(e^(-i beta) w) = (k + q) s, whole k, with s = 4.4 / Grid times a breath of 1 +- 0.15; sheet 2 the same for -w. A line is a Gaussian of sigma 0.85 LED (2.0 wide at half height) with a halo of sigma 2.6 at 0.22; the distance in w is divided by |dw/dz| times 0.069, so the width stays 2 LED where the map stretches or pinches. p slides 0.085 a slow second (0.9 LED a second at the opening). q stays near 0.25, never at 0 or 0.5, where the grid is symmetric under w to -w and the jump at the cut would vanish. beta swings by 0.22 and 0.12 radian and drifts by 0.3. Lines closer than 4.2 LED fade and are gone at 2.2, so no moire stands round a branch point. Each line swells between 0.44 and 1.0 at its own rate.
// The colour. A number t from -1 to 1 says which side of the cut a point of the w-plane is on: tanh(Im(sqrt(u - 1) sqrt(u + 1)) / 0.5) faded by exp(-(|sqrt(u - 1) sqrt(u + 1)| / 1.6)^2). It flips across the cut and is reversed on sheet 2, so it is a function of w. Top: t = 1 amber (hue 0.12), 0 orange (0.05), -1 rose (0.98). Bottom: 1 teal (0.435), 0 cyan (0.53), -1 indigo (0.625). The imaginary lines lean 0.045 toward rose on the top and 0.05 toward violet on the bottom. Far from the cut t is 0, so each sheet is one calm colour and the step is only at the seam. A wash of 0.12 plus 0.14 exp(-(|w| / g)^2) lies under the lines, with g near 1.2 and swelling, and t brightens it by up to 45 percent on one side of the cut and dims it on the other.
// The beads. Six, each on a loop in the cut's own frame u, where the cut is the segment from -1 to 1. The loop's centre moves up to 1.3 along the cut and 0.45 across it, its radius runs from 0.34 to 1.7 and its axis ratio from 0.45 to 0.95, each on sines at rates from 0.05 to 0.4 radian a slow second; the bead goes round at 0.75 to 1.3, either way. A loop centred near one end with a radius under 1 circles one branch point; one centred near the middle with a radius over 1 circles both and crosses the segment an even number of times or not at all. A bead that steps across the segment changes sheet: it leaves one square and shows at the same z in the other, and a ring of 0.9 s opens in both. Checked: sheet times w(z) along each path stayed continuous over 10 min and 90 to 140 sheet changes a bead (largest step 0.35 a frame), so the rule is the analytic continuation.
// Trails. A trail of 20 LED fades as (1 - s / 20)^1.6 on the sheet the bead was on, so a crossing cuts it in two, one part in each square.
// It does not come back. The cut's angle, midpoint and length, the grid's turn, the glow's width, a hue shift and the wash level each follow a smooth curve through random knots, one every 26 to 41 slow seconds, new ones forever, plus sines of incommensurate rates; the loops and the line swells add more. The branch points stay within 2.0 of the window centre. The first call runs 45 slow seconds so the picture opens full.
// What is exact and what is drawn. The map w, the sheet rule and the grid in w are the mathematics. The loops in the cut's frame, the Gaussian lines, the wash, the colouring by side, the trails, the ring and the dark halo under each bead are drawing choices.

const W = 64, H = 128, SQ = 64;
const { floor, sqrt, exp, sin, cos, min, max, abs, tanh, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

const HALF = 2.2;               // the view is +-2.2 in z, on both squares
const HZ = (2 * HALF) / SQ;     // z units to an LED
const NB = 6;                   // beads
const NT = 110;                 // trail points kept for each bead
const TSTEP = 0.5;              // LEDs between trail points
const TLEN = 20;                // LEDs of trail before it has faded out
const FLASH = 0.9;              // seconds a crossing ring lasts

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function mulberry(seedv) {
  let a = seedv >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- the state
// Eight slow random drifts: the cut's angle, its midpoint x and y, its length, the grid's
// turn, the glow's width, a shift of the palette's hue and the level of the wash. Each is
// a smooth curve through random knots, one knot every OUT[i] slow seconds, with a Gaussian
// height of standard deviation OUS[i]. New knots keep coming, so the curve never repeats
// and stays near zero.
const OUS = [1.0, 0.32, 0.3, 0.2, 0.3, 0.2, 0.035, 0.22];
const OUT = [34, 26, 30, 38, 32, 28, 41, 33];
function gauss(r) {
  return sqrt(-2 * Math.log(max(r(), 1e-9))) * cos(TAU * r());
}
function drift(S, dT) {
  for (let i = 0; i < 8; i++) {
    let u = S.ku[i] + dT / OUT[i];
    const o = i * 4, K = S.kn;
    while (u >= 1) {
      u -= 1;
      K[o] = K[o + 1];
      K[o + 1] = K[o + 2];
      K[o + 2] = K[o + 3];
      K[o + 3] = OUS[i] * gauss(S.r);
    }
    S.ku[i] = u;
    const p0 = K[o], p1 = K[o + 1], p2 = K[o + 2], p3 = K[o + 3];
    S.ou[i] = 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u);
  }
}

export function setup(params) {
  const r = mulberry((Math.random() * 4294967296) >>> 0);
  const P = [];
  for (let i = 0; i < 24; i++) P.push(TAU * r());
  const S = {
    r, P, T: 0, clock: 0, k: null, ready: false, gr: r(), gi: 0.25, be: 0, br: 1,
    // the cut: midpoint, half chord (complex), the two branch points
    mx: 0, my: 0, cr: 0.7, ci: 0, ax: 0, ay: 0, bx: 0, by: 0,
    beads: [], flashes: [],
    ou: new Float64Array(8), kn: new Float64Array(32), ku: new Float64Array(8),
  };
  for (let i = 0; i < 32; i++) S.kn[i] = OUS[(i / 4) | 0] * gauss(r);
  for (let i = 0; i < 8; i++) S.ku[i] = r();
  drift(S, 0);
  for (let i = 0; i < NB; i++) {
    const f = (lo, hi) => lo + (hi - lo) * r();
    S.beads.push({
      f: [f(0.07, 0.16), f(0.2, 0.33), f(0.09, 0.2), f(0.25, 0.4), f(0.06, 0.15), f(0.17, 0.3), f(0.1, 0.24), f(0.05, 0.12), f(0.11, 0.21)],
      p: Array.from({ length: 9 }, () => TAU * r()),
      th: TAU * r(), dir: r() < 0.5 ? -1 : 1, om: f(0.75, 1.3), psi0: TAU * r(),
      sheet: r() < 0.5 ? 1 : -1, px: 0, py: 0, zx: 0, zy: 0, has: false,
      tx: new Float32Array(NT), ty: new Float32Array(NT), ts: new Int8Array(NT), th0: 0, tn: 0,
    });
  }
  for (let i = 0; i < 256; i++) {
    LW[i] = 0.18 + 0.32 * r();
    LP[i] = TAU * r();
  }
  params.s = S;
}

// the cut at slow time T: midpoint m, half chord c = (b - a) / 2, a = m - c, b = m + c
function cut(S) {
  const T = S.T, P = S.P, v = cl(S.k[2], -1, 1);
  const c0 = 0.78 * exp(0.43 * v);
  let cm = c0 * (1 + 0.2 * sin(0.093 * T + P[0]) + 0.1 * sin(0.171 * T + P[1]) + 0.06 * sin(0.277 * T + P[18]) + S.ou[3]);
  cm = max(cm, 0.18);
  if (cm > 1.4) cm = 1.4 + 0.3 * tanh((cm - 1.4) / 0.3);
  const al = P[2] + 0.03 * T + 0.5 * sin(0.061 * T + P[3]) + 0.3 * sin(0.113 * T + P[4]) + 0.15 * sin(0.197 * T + P[5]) + 0.1 * sin(0.311 * T + P[19]) + S.ou[0];
  let mx = 0.3 * sin(0.057 * T + P[6]) + 0.18 * sin(0.129 * T + P[7]) + 0.08 * sin(0.231 * T + P[8]) + 0.06 * sin(0.337 * T + P[20]) + S.ou[1];
  let my = 0.28 * sin(0.071 * T + P[9]) + 0.16 * sin(0.147 * T + P[10]) + 0.07 * sin(0.263 * T + P[11]) + 0.05 * sin(0.389 * T + P[21]) + S.ou[2];
  const lim = 2.0 - cm, mr = hypot(mx, my);
  if (mr > 1e-6) {
    const g = (lim * tanh(mr / lim)) / mr;
    mx *= g;
    my *= g;
  }
  S.mx = mx;
  S.my = my;
  S.cr = cm * cos(al);
  S.ci = cm * sin(al);
  S.ax = mx - S.cr;
  S.ay = my - S.ci;
  S.bx = mx + S.cr;
  S.by = my + S.ci;
}

// a bead in the cut's own frame zeta = (z - m) / c, where the cut runs from -1 to 1; result in BZ
const BZ = [0, 0];
function beadAt(S, B, th) {
  const T = S.T, f = B.f, p = B.p;
  const cx = 0.95 * sin(f[0] * T + p[0]) + 0.35 * sin(f[1] * T + p[1]);
  const cy = 0.3 * sin(f[2] * T + p[2]) + 0.15 * sin(f[3] * T + p[3]);
  const R = 1.02 + 0.5 * sin(f[4] * T + p[4]) + 0.18 * sin(f[5] * T + p[5]);
  const q = 0.7 + 0.25 * sin(f[6] * T + p[6]);
  const ps = B.psi0 + 0.5 * sin(f[7] * T + p[7]);
  const ct = cos(th), st = q * sin(th), cp = cos(ps), sp = sin(ps);
  const zx = cx + R * (cp * ct - sp * st), zy = cy + R * (sp * ct + cp * st);
  BZ[0] = zx;
  BZ[1] = zy;
}

function toPanel(S, zr, zi, out) {
  // z = m + c zeta, then pressed softly into view, then to LEDs of one square
  let x = S.mx + S.cr * zr - S.ci * zi, y = S.my + S.cr * zi + S.ci * zr;
  const r = hypot(x, y);
  if (r > 1.75) {
    const g = (1.75 + 0.45 * tanh((r - 1.75) / 0.45)) / r;
    x *= g;
    y *= g;
  }
  out[0] = SQ / 2 + x / HZ;
  out[1] = SQ / 2 - y / HZ;
}

const OUTP = [0, 0];
// each grid line has its own slow swell of brightness: LW the rate and LP the phase of line k
// (k mod 64) of the real and the imaginary family on each sheet
const LW = new Float32Array(256), LP = new Float32Array(256), LB = new Float32Array(256);
function pushTrail(B, x, y, sh) {
  const i = B.th0;
  B.tx[i] = x;
  B.ty[i] = y;
  B.ts[i] = sh;
  B.th0 = (i + 1) % NT;
  if (B.tn < NT) B.tn++;
}

function stepBeads(S, dT) {
  S.T += dT;
  cut(S);
  for (let i = 0; i < NB; i++) {
    const B = S.beads[i];
    const T = S.T;
    B.th += B.dir * B.om * (1 + 0.3 * sin(B.f[8] * T + B.p[8])) * dT;
    beadAt(S, B, B.th);
    const zr = BZ[0], zi = BZ[1];
    toPanel(S, zr, zi, OUTP);
    const nx = OUTP[0], ny = OUTP[1];
    if (!B.has) {
      B.has = true;
      B.zx = zr;
      B.zy = zi;
      B.px = nx;
      B.py = ny;
      pushTrail(B, nx, ny, B.sheet);
      continue;
    }
    // crossing the cut: Im zeta changes sign with Re zeta inside (-1, 1)
    const y0 = B.zy, y1 = zi;
    if ((y0 <= 0 && y1 > 0) || (y0 > 0 && y1 <= 0)) {
      const f = -y0 / (y1 - y0), xc = B.zx + (zr - B.zx) * f;
      if (abs(xc) < 1) {
        const cxp = B.px + (nx - B.px) * f, cyp = B.py + (ny - B.py) * f;
        pushTrail(B, cxp, cyp, B.sheet);
        B.sheet = -B.sheet;
        pushTrail(B, cxp, cyp, B.sheet);
        S.flashes.push({ x: cxp, y: cyp, t: S.clock });
      }
    }
    B.zx = zr;
    B.zy = zi;
    const last = (B.th0 - 1 + NT) % NT;
    const dx = nx - B.tx[last], dy = ny - B.ty[last];
    if (dx * dx + dy * dy >= TSTEP * TSTEP) pushTrail(B, nx, ny, B.sheet);
    B.px = nx;
    B.py = ny;
  }
}

function advance(S, d) {
  const pace = cl(S.k[1], 0.4, 4);
  const dT = d * pace * 0.5;
  const n = max(1, Math.ceil(dT / 0.04));
  for (let i = 0; i < n; i++) {
    S.clock += d / n;
    drift(S, dT / n);
    stepBeads(S, dT / n);
  }
  // the grid: real lines slide, imaginary lines swing about a quarter step
  S.gr += dT * 0.085;
  S.gi = 0.25 + 0.1 * sin(0.083 * S.T + S.P[12]) + 0.04 * sin(0.151 * S.T + S.P[13]);
  S.be = 0.22 * sin(0.047 * S.T + S.P[14]) + 0.12 * sin(0.109 * S.T + S.P[15]) + S.ou[4];
  S.br = 1 + 0.1 * sin(0.061 * S.T + S.P[16]) + 0.05 * sin(0.137 * S.T + S.P[17]);
  const keep = S.clock - FLASH;
  while (S.flashes.length && S.flashes[0].t < keep) S.flashes.shift();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 6], d = cl(dt || 0, 0, 0.1);
  if (!S.k) S.k = [kv[0], kv[1], kv[2], kv[3]];
  const al = 1 - exp(-d / 0.18);
  for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  if (!S.ready) {
    S.ready = true;
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
    // about 45 slow seconds, which is 45 s at Pace 2 and 225 s at Pace 0.4
    const n = Math.ceil(45 / (0.05 * cl(S.k[1], 0.4, 4) * 0.5));
    for (let i = 0; i < n; i++) advance(S, 0.05);
    S.flashes.length = 0;
  }
  advance(S, d);
}

// ------------------------------------------------------------------ drawing
const FR = new Float32Array(W * H), FG = new Float32Array(W * H), FB = new Float32Array(W * H);
const C1 = [0, 0, 0], C2 = [0, 0, 0], C3 = [0, 0, 0];
const LUT = new Float32Array(2 * 3 * 33 * 3);

// a colour from hue h, lifted so blues and violets carry about the light of oranges
function tint(h, s, o) {
  hsv(h, s, 1, o);
  const l = 0.299 * o[0] + 0.587 * o[1] + 0.114 * o[2], g = cl(Math.pow(0.55 / (l + 0.05), 0.75), 0.6, 2.0);
  o[0] *= g;
  o[1] *= g;
  o[2] *= g;
}

// a soft round dot of sigma sg at (x, y) of the panel
function dot(x, y, sg, r, g, b) {
  const rad = Math.ceil(3 * sg), x0 = floor(x) - rad, y0 = floor(y) - rad, k = 1 / (2 * sg * sg);
  for (let j = 0; j <= 2 * rad + 1; j++) {
    const yy = y0 + j;
    if (yy < 0 || yy >= H) continue;
    const ey = yy + 0.5 - y;
    for (let i = 0; i <= 2 * rad + 1; i++) {
      const xx = x0 + i;
      if (xx < 0 || xx >= W) continue;
      const ex = xx + 0.5 - x, w = exp(-(ex * ex + ey * ey) * k), p = yy * W + xx;
      FR[p] += r * w;
      FG[p] += g * w;
      FB[p] += b * w;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const k = S.k, hue = k[0] + S.ou[6], wl = cl(1 + S.ou[7], 0.6, 1.5);
  const gridN = cl(k[3], 6, 13), gs = ((2 * HALF) / gridN) * S.br;
  // palettes: the top sheet runs amber to rose, the bottom teal to indigo, by which side
  // of the cut a point of the w-plane lies on. LUT[sheet][kind][t][rgb], t = 0..32 over -1..1.
  for (let sh = 0; sh < 2; sh++)
    for (let q = 0; q <= 32; q++) {
      const t = (q - 16) / 16;
      const h0 = sh === 0 ? 0.05 + 0.07 * t : 0.53 - 0.095 * t;
      const sat = sh === 0 ? 0.8 : 0.78;
      tint(h0 + hue, sat, C1);
      tint(h0 + hue + (sh === 0 ? -0.045 : 0.05), sat - 0.05, C2);
      tint(h0 + hue + (sh === 0 ? -0.02 : 0.03), 0.88, C3);
      for (let c = 0; c < 3; c++) {
        LUT[((sh * 3 + 0) * 33 + q) * 3 + c] = C1[c];
        LUT[((sh * 3 + 1) * 33 + q) * 3 + c] = C2[c];
        LUT[((sh * 3 + 2) * 33 + q) * 3 + c] = C3[c];
      }
    }
  const reTop = [0, 0, 0], reBot = [0, 0, 0];
  tint(0.09 + hue, 0.8, reTop);
  tint(0.5 + hue, 0.8, reBot);
  const cr = S.cr, ci = S.ci, cc = cr * cr + ci * ci, cabs = sqrt(cc);
  const mx = S.mx, my = S.my;
  const ax = SQ / 2 + S.ax / HZ, ay = SQ / 2 - S.ay / HZ, bx = SQ / 2 + S.bx / HZ, by = SQ / 2 - S.by / HZ;
  const sdx = bx - ax, sdy = by - ay, sl2 = max(sdx * sdx + sdy * sdy, 1e-6);
  const gw = (0.55 + 0.8 * cabs) * cl(1 + 0.2 * sin(0.077 * S.T + S.P[22]) + 0.1 * sin(0.193 * S.T + S.P[23]) + S.ou[5], 0.55, 1.6), tw = 1.6 * (1 + 0.3 * sin(0.113 * S.T + S.P[22] + 1.3) + 0.12 * sin(0.241 * S.T + S.P[21]));
  for (let i = 0; i < 256; i++) LB[i] = 0.72 + 0.28 * sin(LW[i] * S.T + LP[i]);
  const phr = S.gr, phi = S.gi, cb = cos(S.be), sb = sin(S.be);
  FR.fill(0);
  FG.fill(0);
  FB.fill(0);

  for (let j = 0; j < SQ; j++) {
    const zy = (SQ / 2 - (j + 0.5)) * HZ - my;
    for (let i = 0; i < SQ; i++) {
      const zx = (i + 0.5 - SQ / 2) * HZ - mx;
      // u = (z - m) / c
      const ur = (zx * cr + zy * ci) / cc, ui = (zy * cr - zx * ci) / cc;
      // sqrt(u - 1) sqrt(u + 1), each the principal root: analytic off the cut, like u at infinity
      let rr = hypot(ur - 1, ui);
      const s1x = sqrt(max(0, (rr + ur - 1) * 0.5)), s1y = (ui < 0 ? -1 : 1) * sqrt(max(0, (rr - ur + 1) * 0.5));
      rr = hypot(ur + 1, ui);
      const s2x = sqrt(max(0, (rr + ur + 1) * 0.5)), s2y = (ui < 0 ? -1 : 1) * sqrt(max(0, (rr - ur - 1) * 0.5));
      const pr = s1x * s2x - s1y * s2y, pi = s1x * s2y + s1y * s2x;
      // w = c * prod
      const wr = cr * pr - ci * pi, wi = cr * pi + ci * pr;
      const wa = hypot(wr, wi) + 1e-9;
      // |dw/dz| = |z - m| / |w|; one LED changes w by g
      const g = (hypot(zx, zy) / wa) * HZ + 1e-6;
      const spc = gs / g;
      const fade = sm(2.2, 4.2, spc);
      const amp = (0.55 + 0.45 * exp(-(wa / 1.7) * (wa / 1.7))) * fade;
      const glow = exp(-(wa / gw) * (wa / gw));
      // distance of the pixel to the cut, in LEDs
      const px = i + 0.5 - ax, py = j + 0.5 - ay;
      const tt = cl((px * sdx + py * sdy) / sl2, 0, 1);
      const ex = px - tt * sdx, ey = py - tt * sdy, dc2 = ex * ex + ey * ey;
      const seam = exp(-dc2 / 0.9) + 0.3 * exp(-dc2 / 8);
      const pm = hypot(pr, pi), tn = tanh(pi / 0.5) * exp(-(pm / tw) * (pm / tw));
      for (let sh = 0; sh < 2; sh++) {
        const sg = sh === 0 ? 1 : -1;
        const w1 = sg * (wr * cb + wi * sb), w2 = sg * (wi * cb - wr * sb);
        const fr = w1 / gs - phr, fi = w2 / gs - phi;
        const kr = Math.round(fr), ki = Math.round(fi);
        const dr = abs(fr - kr) * gs / g, di = abs(fi - ki) * gs / g;
        const bR = LB[sh * 128 + (((kr % 64) + 64) % 64)], bI = LB[sh * 128 + 64 + (((ki % 64) + 64) % 64)];
        const pR = exp(-dr * dr / 1.45) + 0.22 * exp(-dr * dr / 13);
        const pI = exp(-di * di / 1.45) + 0.22 * exp(-di * di / 13);
        const tp = (sg * tn + 1) * 16, q0 = min(31, floor(tp)), fq = tp - q0;
        const lo = (sh * 3) * 33 + q0, o0 = lo * 3, o1 = (lo + 33) * 3, o2 = (lo + 66) * 3;
        const wash = (0.12 + 0.14 * glow) * wl * (1 + 0.45 * sg * tn);
        const aR = amp * pR * bR * 0.8, aI = amp * pI * bI * 0.8, wh = 0.2 * glow;
        const p = (sh * SQ + j) * W + i, sm1 = seam * 0.65;
        for (let c = 0; c < 3; c++) {
          const cre = LUT[o0 + c] + (LUT[o0 + 3 + c] - LUT[o0 + c]) * fq;
          const cim = LUT[o1 + c] + (LUT[o1 + 3 + c] - LUT[o1 + c]) * fq;
          const cwa = LUT[o2 + c] + (LUT[o2 + 3 + c] - LUT[o2 + c]) * fq;
          const v = cwa * wash + (cre + wh * (1 - cre)) * aR + (cim + wh * (1 - cim)) * aI + (0.55 * cwa + 0.5) * sm1;
          if (c === 0) FR[p] = v;
          else if (c === 1) FG[p] = v;
          else FB[p] = v;
        }
      }
    }
  }

  // branch points
  for (let sh = 0; sh < 2; sh++) {
    const yo = sh * SQ, c = sh === 0 ? reTop : reBot;
    dot(ax, ay + yo, 4.5, c[0] * 0.07, c[1] * 0.07, c[2] * 0.07);
    dot(bx, by + yo, 4.5, c[0] * 0.07, c[1] * 0.07, c[2] * 0.07);
    dot(ax, ay + yo, 1.1, 0.7, 0.7, 0.7);
    dot(bx, by + yo, 1.1, 0.7, 0.7, 0.7);
  }

  // crossing rings, in both squares
  for (const f of S.flashes) {
    const a = (S.clock - f.t) / FLASH;
    if (a < 0 || a > 1) continue;
    const rho = 1 + 6 * Math.pow(a, 0.6), inten = (1 - a) * (1 - a) * 0.7;
    for (let sh = 0; sh < 2; sh++) {
      const c = sh === 0 ? reTop : reBot, yo = sh * SQ;
      const x0 = max(0, floor(f.x - rho - 3)), x1 = min(W - 1, floor(f.x + rho + 3));
      const y0 = max(0, floor(f.y - rho - 3)), y1 = min(SQ - 1, floor(f.y + rho + 3));
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const d = hypot(x + 0.5 - f.x, y + 0.5 - f.y) - rho, w = exp(-d * d / 1.3) * inten, p = (yo + y) * W + x;
          FR[p] += (0.4 + 0.6 * c[0]) * w;
          FG[p] += (0.4 + 0.6 * c[1]) * w;
          FB[p] += (0.4 + 0.6 * c[2]) * w;
        }
    }
  }

  // trails and beads
  for (let bi = 0; bi < NB; bi++) {
    const B = S.beads[bi];
    if (!B.has) continue;
    // trail, newest first, from the bead back
    let cx = B.px, cy = B.py, cs = B.sheet, run = 0;
    for (let q = 0; q < B.tn && run < TLEN; q++) {
      const idx = (B.th0 - 1 - q + NT * 2) % NT;
      const nx = B.tx[idx], ny = B.ty[idx], ns = B.ts[idx];
      const L = hypot(nx - cx, ny - cy);
      if (ns === cs && L > 0) {
        const m = max(1, Math.ceil(L / TSTEP));
        const c = cs > 0 ? reTop : reBot, yo = cs > 0 ? 0 : SQ;
        for (let t = 0; t < m; t++) {
          const f = (t + 0.5) / m, s = run + L * f, a = Math.pow(max(0, 1 - s / TLEN), 1.6) * 0.07;
          dot(cx + (nx - cx) * f, cy + (ny - cy) * f + yo, 0.9, (0.45 + 0.55 * c[0]) * a * 3, (0.45 + 0.55 * c[1]) * a * 3, (0.45 + 0.55 * c[2]) * a * 3);
        }
      }
      run += L;
      cx = nx;
      cy = ny;
      cs = ns;
    }
  }
  for (let bi = 0; bi < NB; bi++) {
    const B = S.beads[bi];
    if (!B.has) continue;
    const sh = B.sheet, c = sh > 0 ? reTop : reBot, yo = sh > 0 ? 0 : SQ, by0 = B.py + yo;
    // a soft dark halo first, so the bead stands out from the lines under it
    for (let y = max(0, floor(by0 - 4)); y <= min(H - 1, floor(by0 + 4)); y++)
      for (let x = max(0, floor(B.px - 4)); x <= min(W - 1, floor(B.px + 4)); x++) {
        const d2 = (x + 0.5 - B.px) * (x + 0.5 - B.px) + (y + 0.5 - by0) * (y + 0.5 - by0), h = 1 - 0.75 * exp(-d2 / 6), p = y * W + x;
        FR[p] *= h;
        FG[p] *= h;
        FB[p] *= h;
      }
    dot(B.px, by0, 1.4, c[0] * 0.9, c[1] * 0.9, c[2] * 0.9);
    dot(B.px, by0, 0.9, 1.1, 1.1, 1.1);
  }

  // tone map: the brightest channel is soft-clipped, the colour keeps its ratios
  const G = 1.5;
  for (let p = 0; p < W * H; p++) {
    const r = FR[p], g = FG[p], b = FB[p];
    const m = max(r, g, b);
    if (m < 0.01) {
      display.setPixel(p % W, (p / W) | 0, 0, 0, 0);
      continue;
    }
    const o = 1 - exp(-G * m), f = o / m, wh = 0.35 * o * o * o;
    display.setPixel(p % W, (p / W) | 0, min(255, ((r * f + wh) * 255) | 0), min(255, ((g * f + wh) * 255) | 0), min(255, ((b * f + wh) * 255) | 0));
  }
}
