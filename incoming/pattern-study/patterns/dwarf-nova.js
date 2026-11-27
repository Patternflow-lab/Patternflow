// ===== Patternflow pattern =====
// Title:   Dwarf Nova
// Family:  cataclysmic
// Idea:    A red dwarf fills its Roche lobe at the top of the panel and spills gas through the inner Lagrange point in an amber stream that bends round a white dwarf below and lands on its disk in a hot spot; the disk fills for a minute or two, then a heating front runs across it, the whole disk flares blue-white out to its tidal edge and pours gas onto the white dwarf, and it goes dark again from the rim inward.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Roche potential and its teardrop lobes (Edouard Roche, 1849, from memory); the gas stream from L1 and its circularisation radius (Lubow and Shu, 1975, from memory); dwarf nova outbursts as a thermal-viscous limit cycle of the disk (Yoji Osaki, 1974, from memory) and the disk instability model as Brian Warner's Cataclysmic Variable Stars (1995) lays it out, from memory; tidal truncation of the disk near 0.6 a / (1 + q) (Paczynski, from memory); two-armed spirals in a disk in outburst (Steeghs, Harlaftis and Horne, from memory); starspots under L1 that cut the transfer (Livio and Pringle, from memory). The particle disk, the front rule, the numbers and the colours are original, pattern round 269.
// Round:   269
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Transfer=0.5..4, Ratio=-1..1, Alpha=0.02..0.3
//
// Knob 1: Hue. Turns the temperature ramp of the disk, the stream and the donor once round the wheel. At 0 the cold disk is red outside and amber-yellow inside, the disk in outburst sky blue to blue-white and the donor orange-red; at 0.33 the donor and the cold disk are green. The navy background and its contours stay as they are.
// Knob 2: Transfer. The rate gas leaves L1, 8 disk particles a second times the knob. At 2 an outburst comes every 50 to 160 s, at 4 every 30 to 70 s, at 0.5 about every seven minutes. The stream thickens with it, the hot spot goes as the 0.7 power and the cold disk as the square root.
// Knob 3: Ratio. The mass ratio q = M2 / M1 as 0.35 times 2 to the 1.2 k: 0.15 at -1, 0.35 where it opens, 0.8 at 1. At 0.15 the donor is small, L1 sits on row 44 and the disk reaches 21 LED from the white dwarf in quiescence and 27 in outburst; at 0.8 the donor fills the top half, L1 is on row 61 and the disk reaches 15 and 18 LED. The lobes are rebuilt as the knob turns.
// Knob 4: Alpha. The viscosity of the hot disk. An outburst lasts about 43 s at 0.02, 15 to 19 s where it opens at 0.06 and 5 s at 0.3, and the heating front crosses the disk in about 1.5 s at 0.06. The cold disk has its own alpha, 0.0015 times the square root of the knob over 0.06, and glows brighter with it.
//
// What the picture is. Two stars seen from above in the frame that turns with them, 64 x 128 LED standing up, on a navy field crossed by the equipotentials of the Roche potential: the figure eight through L1, one between it and L2, the surfaces through L2 and L3 and two beyond, each 2 to 3 LED wide and faint, with dim gas clouds turning backwards round the middle of the panel once in 300 s. At the opening the separation is 60 LED. The donor is an orange-red teardrop 34 LED wide whose centre is on row 28, darker at the limb and toward its point at L1 on row 52, mottled by granulation and by five starspots that grow and fade over half a minute to two minutes. From the point an amber stream 2 to 4 LED wide falls and bends right to the rim of the disk round the white dwarf on row 88, lands in a yellow hot spot, and runs on round the rim as a fading thread. The quiet disk reaches 19 LED: red at the edge, amber-yellow inside, a blue-white point at the middle, with knots of light that flare and ride round it. When the outburst comes a blue ring opens from the inner disk and sweeps out in about 1.5 s, the disk flares sky blue and white out to 24 LED with two faint spiral arms, the face of the donor toward it warms to orange, and then a cooling front eats the blue disk from the rim inward and the disk drops back to a dim red ring.
// The model. The circular restricted three-body problem in units of the separation a, G(M1 + M2) = 1 and the frame's angular speed 1, run at 0.35 units a second, so the binary period would be 18 s (the frame turns with the binary, so it does not show). L1, L2 and L3 are found by bisection on the axis, and the donor's surface is the L1 equipotential along 96 rays from its centre. Up to 320 stream particles leave from just inside L1 at about 0.02 a Omega with a sideways scatter of 0.01 a, and are stepped three times a frame by a kick, an exact Coriolis turn, a drift and a kick, until they come inside the disk's edge; the circularisation radius, 0.138 a or 8 LED at q = 0.35, comes from the angular momentum at the closest approach of one mean stream particle. The disk holds up to 3000 particles. Each carries s = sqrt(r / a), which stands for its angular momentum, and viscosity moves s by a random walk with a diffusion of 0.11 alpha a second; the walk keeps the mean of s, so gas that goes in pushes other gas out. New gas starts with the mean of the rim's s and the circularisation radius's s, so it sinks from the hot spot. Beyond 0.78 of the tidal edge in s the donor's tide pulls s in by 1.2 u^2 a second, and the edge reflects. The inner edge, 0.045 a, swallows gas when hot and reflects it when cold. Each particle goes round at its Kepler rate less the frame's. The disk is cut into 40 bins in s. After at least 6 s of quiet, an outburst starts when the disk holds 1900 particles times a random 0.85 to 1.15; the heating front starts in the bin where the count over area over r^1.1 is largest and runs both ways at 0.25 sqrt(alpha / 0.06) in s a second, the hot bins take the knob's alpha, and the plateau ends when the disk is down to 55% of its peak or after 12 (0.06 / alpha)^0.7 s. The cooling front then runs in from the rim at 0.06 (alpha / 0.06)^0.6. The transfer rate has a 5 s flicker and a 40 s drift, both log-normal, and a starspot over L1 cuts it by up to 75%. The first update runs the disk from 88% of a threshold through one outburst and the refill after it, in 0.5 s steps when quiet and 0.1 s steps when hot, and stops 3 to 6% short of the next one; that costs 80 to 130 ms once. Particles are splatted bilinearly, blurred 1-4-6-4-1 both ways, kept for 0.06 s and toned as 1 - exp(-1.6 E).
// What is exact and what is not. The potential, the Lagrange points, the lobe shapes, the stream's path and its circularisation radius are computed for two point masses and test particles. The tidal edge 0.6 a / (1 + q) is a fit quoted from memory. The random walk in sqrt(r) stands in for the viscous diffusion equation, and the trigger and fronts count particles instead of following the S-curve of surface density; a real disk's hot alpha is about four times its cold one, here it is 20 to 90 times so that the quiet disk keeps its gas, and a quiet inner edge that reflects means no accretion in quiescence. Time is squeezed: real outbursts come every few weeks and last days. The spiral arms are a brightness pattern, the knots, the gas clouds and the spots are decoration, and the colours are a ramp, not a black body.
//
// Size: 35 KB, over the 25 KB asked, because one file holds the Roche geometry and its contour field, the stream, the particle disk with its fronts, the pre-run and the renderer.

const W = 64, H = 128, NPX = W * H;
const POOL = 3000, NT = 320, NF = 600;
const { floor, sqrt, exp, sin, cos, atan2, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

const TS = 0.35;                       // binary time units (1 / Omega) per second
const S0 = 0.2, S1 = 0.78, NB = 40, BW = (S1 - S0) / NB; // bins in s = sqrt(r / a)
const RIN = 0.045, SIN = sqrt(RIN);    // inner edge of the disk, r = 0.045 a
const KD = 0.11;                        // diffusion of s per second per unit alpha
const MTRIG = 1900;                     // disk particles at which an outburst starts, times a random 0.85 to 1.15
const FLOW = 0.55;                      // an outburst ends when the disk is down to this share of its peak
const KT = 1.2;                         // tidal pull on the outer disk, s per second at the tidal edge

// ---- colour
function hsv2rgb(h, s, v, o, i) {
  h = (h - floor(h)) * 6;
  const k = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[i] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  o[i + 1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  o[i + 2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}
function rotHue(r, g, b, dh, o, i) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d) / 6;
    else if (mx === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  hsv2rgb(h + dh, mx > 0 ? d / mx : 0, mx, o, i);
}
// the temperature ramp, cold to hot
const RAMP = [
  [0.0, 1.0, 0.1, 0.04], [0.2, 1.0, 0.28, 0.05], [0.4, 1.0, 0.55, 0.1], [0.6, 1.0, 0.82, 0.45],
  [0.74, 0.95, 0.95, 0.92], [0.86, 0.38, 0.6, 1.0], [1.0, 0.8, 0.9, 1.0],
];
function rampAt(t, o, i) {
  let j = 0;
  while (j < RAMP.length - 2 && t > RAMP[j + 1][0]) j++;
  const a = RAMP[j], b = RAMP[j + 1], u = cl((t - a[0]) / (b[0] - a[0]), 0, 1);
  o[i] = a[1] + (b[1] - a[1]) * u;
  o[i + 1] = a[2] + (b[2] - a[2]) * u;
  o[i + 2] = a[3] + (b[3] - a[3]) * u;
}

// ---- the Roche geometry for a mass ratio q, in units of the separation a, origin at the centre of mass,
// x up the panel toward the donor, y to the right; the frame turns once in 2 pi
function makeGeo(q) {
  const mu = q / (1 + q), m1 = 1 - mu, m2 = mu, x1 = -mu, x2 = 1 - mu;
  const phi = (x, y) => {
    const a = x - x1, b = x - x2;
    return -m1 / sqrt(a * a + y * y) - m2 / sqrt(b * b + y * y) - 0.5 * (x * x + y * y);
  };
  const fx = (x) => {
    const a = x - x1, b = x - x2;
    return (m1 * a) / abs(a * a * a) + (m2 * b) / abs(b * b * b) - x;
  };
  const bis = (f, lo, hi) => {
    const flo = f(lo);
    for (let i = 0; i < 60; i++) {
      const m = 0.5 * (lo + hi), fm = f(m);
      if (fm > 0 === flo > 0) lo = m; else hi = m;
    }
    return 0.5 * (lo + hi);
  };
  const xL1 = bis(fx, x1 + 1e-3, x2 - 1e-3), xL2 = bis(fx, x2 + 1e-3, 2.5), xL3 = bis(fx, -2.5, x1 - 1e-3);
  const P1 = phi(xL1, 0), P2 = phi(xL2, 0), P3 = phi(xL3, 0);
  const back2 = bis((x) => phi(x, 0) - P1, x2 + 1e-4, xL2), back1 = bis((x) => phi(x, 0) - P1, xL3, x1 - 1e-4);
  const rt = 0.6 / (1 + q);                       // tidal edge of the disk
  const xmid = 0.5 * (back1 + back2);
  const S = min(60, 116 / (back2 - back1), 29 / rt);
  const g = { q, mu, m1, m2, x1, x2, xL1, xL2, xL3, P1, P2, P3, rt, S, xmid };
  // the donor's surface along rays from its centre: 96 angles from +x
  const NA = 96, R = new Float32Array(NA);
  for (let k = 0; k < NA; k++) {
    const th = (k / NA) * TAU, c = cos(th), sn = sin(th);
    let lo = 1e-3, hi = 0, pm = -9, rm = 0.5;
    for (let rr = 0.005; rr < 0.9; rr += 0.005) {
      const v = phi(x2 + rr * c, rr * sn);
      if (v >= P1) { hi = rr; break; }
      if (v > pm) { pm = v; rm = rr; }
      lo = rr;
    }
    // along the axis the surface only touches L1, where the potential has its top
    R[k] = hi ? bis((rr) => phi(x2 + rr * c, rr * sn) - P1, lo, hi) : rm;
  }
  g.R = R;
  // per LED: the contours behind everything, and the donor's coverage, limb and angle
  g.con = new Float32Array(NPX);
  g.dcov = new Float32Array(NPX);
  g.dmu = new Float32Array(NPX);
  g.dth = new Float32Array(NPX);
  const lv = [P1, 0.5 * (P1 + P2), P2, P3, P3 + 0.6 * (P3 - P1), P3 + 1.4 * (P3 - P1)];
  const lw = [1, 0.45, 0.6, 0.6, 0.4, 0.3];
  for (let py = 0; py < H; py++) {
    const x = xmid + (63.5 - py) / S;
    for (let px = 0; px < W; px++) {
      const y = (px - 31.5) / S, p = py * W + px;
      const a = x - x1, b = x - x2, r1 = sqrt(a * a + y * y), r2 = sqrt(b * b + y * y);
      const i1 = m1 / (r1 * r1 * r1), i2 = m2 / (r2 * r2 * r2);
      const gx = i1 * a + i2 * b - x, gy = i1 * y + i2 * y - y;
      const gr = max(sqrt(gx * gx + gy * gy), 0.08);
      const P = -m1 / r1 - m2 / r2 - 0.5 * (x * x + y * y);
      let c = 0;
      for (let l = 0; l < lv.length; l++) {
        const d = (abs(P - lv[l]) / gr) * S;
        if (d < 1.6) c += lw[l] * (1 - (d / 1.6) * (d / 1.6));
      }
      g.con[p] = min(c, 1);
      // donor
      let th = atan2(y, b);
      if (th < 0) th += TAU;
      const fk = (th / TAU) * NA, k0 = floor(fk) % NA, k1 = (k0 + 1) % NA, u = fk - floor(fk);
      const Rs = R[k0] * (1 - u) + R[k1] * u;
      const cov = cl((Rs - r2) * S + 0.5, 0, 1);
      g.dcov[p] = cov;
      if (cov > 0) {
        const t = min(r2 / Rs, 1);
        g.dmu[p] = sqrt(1 - t * t);
        g.dth[p] = th;
      }
    }
  }
  // the mean stream: one particle from L1, to its closest approach to the white dwarf
  const path = [];
  let x = xL1 - 0.003, y = 0, vx = -0.02, vy = 0, rmin = 9, jmin = 0;
  const h = 0.002;
  for (let i = 0; i < 4000; i++) {
    const st = stepOne(g, x, y, vx, vy, h);
    x = st[0]; y = st[1]; vx = st[2]; vy = st[3];
    const dx = x - x1, r = sqrt(dx * dx + y * y);
    path.push(x, y);
    if (r < rmin) {
      rmin = r;
      jmin = dx * vy - y * vx + dx * dx + y * y;
    } else if (r > rmin * 1.02 && i > 50) break;
  }
  g.path = path;
  g.rcirc = (jmin * jmin) / m1;
  return g;
}

const ST = new Float64Array(4);
function accel(g, x, y, out) {
  const a = x - g.x1, b = x - g.x2;
  const r1 = sqrt(a * a + y * y), r2 = sqrt(b * b + y * y);
  const i1 = g.m1 / (r1 * r1 * r1), i2 = g.m2 / (r2 * r2 * r2);
  out[0] = x - i1 * a - i2 * b;
  out[1] = y - i1 * y - i2 * y;
}
const AC = new Float64Array(2);
// kick, Coriolis turn, drift, kick
function stepOne(g, x, y, vx, vy, h) {
  accel(g, x, y, AC);
  vx += 0.5 * h * AC[0];
  vy += 0.5 * h * AC[1];
  const c = cos(2 * h), s = sin(2 * h), ux = vx * c + vy * s, uy = -vx * s + vy * c;
  vx = ux; vy = uy;
  x += h * vx;
  y += h * vy;
  accel(g, x, y, AC);
  vx += 0.5 * h * AC[0];
  vy += 0.5 * h * AC[1];
  ST[0] = x; ST[1] = y; ST[2] = vx; ST[3] = vy;
  return ST;
}

// where the mean stream first comes within r of the white dwarf
function hitOf(g, r, out) {
  const p = g.path;
  for (let i = 0; i < p.length; i += 2) {
    const dx = p[i] - g.x1, dy = p[i + 1];
    if (dx * dx + dy * dy <= r * r) { out[0] = atan2(dy, dx); out[1] = r; return out; }
  }
  const n = p.length - 2, dx = p[n] - g.x1, dy = p[n + 1];
  out[0] = atan2(dy, dx);
  out[1] = sqrt(dx * dx + dy * dy);
  return out;
}

export function setup(params) {
  const s = {
    k: [0, 2, 0, 0.06], init: false, g: null, q: 0.35,
    nD: 0, ds: new Float32Array(POOL), dr: new Float32Array(POOL), dp: new Float32Array(POOL), dg: new Float32Array(POOL),
    nF: 0, fr: new Float32Array(NF), fp: new Float32Array(NF), fa: new Float32Array(NF), ft: new Float32Array(NF),
    nT: 0, tx: new Float32Array(NT), ty: new Float32Array(NT), tvx: new Float32Array(NT), tvy: new Float32Array(NT), ta: new Float32Array(NT),
    cnt: new Float32Array(NB), hot: new Uint8Array(NB), hv: new Float32Array(NB),
    phase: 0, fIn: 0, fOut: 0, fC: 0, tp: 0, tq: 9, thr: 1, mpk: 0, sEdge: 0.5, rcap: 0.2,
    inj: 0, emit: 0, lm: 0, lf: 0, ls: 0, choke: 0, accR: 0, spotX: 0, spotY: 0, lum: 0,
    hue: -1, lut: new Float32Array(256 * 3),
    E: new Float32Array(NPX), ET: new Float32Array(NPX), B: new Float32Array(NPX),
    PE: new Float32Array(NPX), PT: new Float32Array(NPX), last: -1,
    spots: [], hit: [0, 0], fls: [], fq: 0,
  };
  for (let i = 0; i < 5; i++) {
    const o = {};
    newSpot(o);
    o.age = rnd() * o.life;
    s.spots.push(o);
  }
  params.s = s;
}

// starspots on the donor: each grows, drifts and fades over half a minute to two minutes
function newSpot(o) {
  o.th = rnd() * TAU;
  o.w = (0.01 + 0.03 * rnd()) * (rnd() < 0.5 ? -1 : 1);
  o.t = 0.15 + 0.7 * rnd();
  o.vt = 0.012 * (rnd() - 0.5);
  o.sz = 0.4 + 0.35 * rnd();
  o.dk = 0.35 + 0.35 * rnd();
  o.life = 30 + 90 * rnd();
  o.age = 0;
}
function spotStep(s, dt) {
  let l1 = 0;
  for (const o of s.spots) {
    o.age += dt;
    if (o.age > o.life) newSpot(o);
    o.th += o.w * dt;
    o.t = cl(o.t + o.vt * dt, 0.05, 0.92);
    o.am = o.dk * pow(sin((PI * o.age) / o.life), 0.6);
    // a spot over the inner Lagrange point chokes the stream
    const d = cos(o.th - PI);
    if (d > 0) l1 += o.am * pow(d, 8) * cl((o.t - 0.5) * 3, 0, 1) * (o.sz / 0.55);
  }
  s.choke = cl(l1, 0, 1);
}

function knobs(s, input) {
  const kv = (input && input.knobValues) || s.k;
  for (let i = 0; i < 4; i++) if (typeof kv[i] === "number" && isFinite(kv[i])) s.k[i] = kv[i];
}
const qOf = (k) => 0.35 * pow(2, 1.2 * cl(k, -1, 1));
const mdotOf = (s) => 8 * cl(s.k[1], 0.5, 4);
const alphaOf = (s) => cl(s.k[3], 0.02, 0.3);
const alphaCold = (s) => 0.0015 * pow(alphaOf(s) / 0.06, 0.5);

// ---- the disk
function binsAndFronts(s, dt) {
  const g = s.g, cnt = s.cnt;
  cnt.fill(0);
  for (let i = 0; i < s.nD; i++) {
    const b = floor((s.ds[i] - S0) / BW);
    cnt[b < 0 ? 0 : b >= NB ? NB - 1 : b]++;
  }
  let cum = 0, edge = S0;
  const lim = 0.95 * s.nD;
  for (let b = 0; b < NB; b++) {
    if (cum + cnt[b] >= lim) { edge = S0 + (b + (lim - cum) / cnt[b]) * BW; break; }
    cum += cnt[b];
  }
  s.sEdge = s.nD > 20 ? edge : sqrt(g.rcirc);
  const aH = alphaOf(s), vh = 0.25 * sqrt(aH / 0.06), vc = 0.06 * pow(aH / 0.06, 0.6);
  if (s.phase === 0) {
    s.tq += dt;
    if (s.nD >= MTRIG * s.thr && s.tq > 6) {
      let best = -1, bb = NB >> 1;
      for (let b = 0; b < NB; b++) {
        if (cnt[b] < 4) continue;
        const sa = S0 + b * BW, sb = sa + BW, ra = sa * sa, rb = sb * sb;
        const v = cnt[b] / (PI * (rb * rb - ra * ra)) / pow(0.5 * (ra + rb), 1.1);
        if (v > best) { best = v; bb = b; }
      }
      s.phase = 1;
      s.fIn = s.fOut = S0 + (bb + 0.5) * BW;
      s.mpk = s.nD;
    }
  } else if (s.phase === 1) {
    s.fIn -= vh * dt;
    s.fOut += vh * dt;
    s.mpk = max(s.mpk, s.nD);
    if (s.fIn <= SIN && s.fOut >= s.sEdge) { s.phase = 2; s.fOut = max(s.fOut, s.sEdge); s.tp = 0; }
  } else if (s.phase === 2) {
    s.fOut = max(s.fOut, s.sEdge + BW);
    s.mpk = max(s.mpk, s.nD);
    s.tp += dt;
    // the cooling front starts when the disk has given up enough gas, or when the plateau has run its course
    if (s.nD < s.mpk * FLOW || s.tp > 12 * pow(0.06 / aH, 0.7)) { s.phase = 3; s.fC = s.fOut; }
  } else {
    s.fC -= vc * dt;
    if (s.fC <= SIN) { s.phase = 0; s.tq = 0; s.thr = 0.85 + 0.3 * rnd(); }
  }
  const kk = 1 - exp(-dt / 0.25);
  for (let b = 0; b < NB; b++) {
    const sc = S0 + (b + 0.5) * BW;
    let h = 0;
    if (s.phase === 1) h = sc >= s.fIn && sc <= s.fOut ? 1 : 0;
    else if (s.phase === 2) h = 1;
    else if (s.phase === 3) h = sc < s.fC ? 1 : 0;
    s.hot[b] = h;
    s.hv[b] += (h - s.hv[b]) * kk;
  }
}

function diskStep(s, dt, moveAngles) {
  const g = s.g, aH = alphaOf(s), aC = alphaCold(s);
  const sT = sqrt(g.rt), m1 = g.m1;
  const kr = 1 - exp(-dt / 0.5);
  let n = s.nD, acc = 0;
  for (let i = 0; i < n; i++) {
    let sv = s.ds[i];
    const b = floor((sv - S0) / BW), hb = s.hot[b < 0 ? 0 : b >= NB ? NB - 1 : b];
    const D = (hb ? aH : aC) * KD;
    sv += sqrt(24 * D * dt) * (rnd() - 0.5);
    // the donor's tide takes angular momentum from the outer disk
    const u = sv / sT - 0.78;
    if (u > 0) sv -= KT * u * u * dt;
    if (sv > sT) sv = 2 * sT - sv;
    // a cold disk hands almost nothing to the white dwarf: what reaches the inner edge stays
    if (sv < SIN && !hb) sv = 2 * SIN - sv;
    if (sv < SIN) {
      n--;
      s.ds[i] = s.ds[n]; s.dr[i] = s.dr[n]; s.dp[i] = s.dp[n]; s.dg[i] = s.dg[n];
      i--;
      acc++;
      continue;
    }
    s.ds[i] = sv;
    s.dg[i] += dt;
    let r = s.dr[i];
    r += (sv * sv - r) * kr;
    s.dr[i] = r;
    if (moveAngles) {
      const rr = max(r, 0.03);
      s.dp[i] += (sqrt(m1 / (rr * rr * rr)) - 1) * TS * dt;
    }
  }
  s.nD = n;
  return acc;
}

function inject(s, dt) {
  const g = s.g;
  s.inj += mdotOf(s) * exp(s.lm) * dt;
  if (s.inj < 1) return;
  hitOf(g, s.rcap, s.hit);
  while (s.inj >= 1) {
    s.inj -= 1;
    if (s.nD >= POOL) continue;
    const i = s.nD++;
    // stream gas carries the angular momentum of the circularisation radius and shares it with the rim it lands on
    const r = s.hit[1] * (1 + 0.04 * gauss());
    s.dr[i] = r;
    s.ds[i] = (0.5 * sqrt(r) + 0.5 * sqrt(g.rcirc)) * (1 + 0.03 * gauss());
    s.dp[i] = s.hit[0] + 0.08 * gauss();
    s.dg[i] = 0;
  }
}

function capRadius(s) {
  const g = s.g;
  const rd = s.sEdge * s.sEdge;
  return min(max(g.rcirc, rd), g.rt);
}

// ---- the stream
function emitTracers(s, dt) {
  const g = s.g;
  s.emit += 80 * pow(mdotOf(s) / 16, 0.8) * exp(s.lm) * dt;
  while (s.emit >= 1) {
    s.emit -= 1;
    if (s.nT >= NT) continue;
    const i = s.nT++;
    const wd = pow(mdotOf(s) / 16, 0.3);
    s.tx[i] = g.xL1 - 0.004 - 0.004 * abs(gauss());
    s.ty[i] = 0.01 * wd * gauss();
    s.tvx[i] = -0.02 - 0.01 * abs(gauss());
    s.tvy[i] = 0.012 * gauss();
    s.ta[i] = 0;
  }
}

function tracerStep(s, dt) {
  const g = s.g, nsub = 3, h = (TS * dt) / nsub, rc = s.rcap;
  let n = s.nT, cx = 0, cy = 0, cn = 0;
  for (let i = 0; i < n; i++) {
    let x = s.tx[i], y = s.ty[i], vx = s.tvx[i], vy = s.tvy[i];
    let dead = false;
    for (let k = 0; k < nsub; k++) {
      const st = stepOne(g, x, y, vx, vy, h);
      x = st[0]; y = st[1]; vx = st[2]; vy = st[3];
      const dx = x - g.x1;
      if (dx * dx + y * y < rc * rc) {
        cx += x; cy += y; cn++; dead = true;
        // the gas goes on round the disk as a fading thread
        if (s.nF < NF) {
          const j = s.nF++, r = sqrt(dx * dx + y * y), sj = 0.5 * sqrt(r) + 0.5 * sqrt(g.rcirc);
          s.fr[j] = r; s.fp[j] = atan2(y, dx); s.fa[j] = 0; s.ft[j] = sj * sj * (1 + 0.06 * gauss());
        }
        break;
      }
    }
    s.ta[i] += dt;
    if (dead || s.ta[i] > 12 || x > g.xL1 + 0.05 || abs(y) > 0.8) {
      n--;
      s.tx[i] = s.tx[n]; s.ty[i] = s.ty[n]; s.tvx[i] = s.tvx[n]; s.tvy[i] = s.tvy[n]; s.ta[i] = s.ta[n];
      i--;
      continue;
    }
    s.tx[i] = x; s.ty[i] = y; s.tvx[i] = vx; s.tvy[i] = vy;
  }
  s.nT = n;
  if (cn > 0) {
    const k = min(1, cn * 0.08);
    s.spotX += (cx / cn - s.spotX) * k;
    s.spotY += (cy / cn - s.spotY) * k;
  }
}

// flickering: knots of heated gas that light up somewhere in the disk, ride round with it and fade
function flareStep(s, dt) {
  const g = s.g, m1 = g.m1, md = (mdotOf(s) * exp(s.lm)) / 16;
  s.fq += dt * (4 + 4 * md) * (s.phase ? 1.6 : 1);
  while (s.fq >= 1) {
    s.fq -= rnd() * 2;
    const re = s.sEdge * s.sEdge;
    s.fls.push({ r: RIN + (re - RIN) * pow(rnd(), 1.3) + 0.02, a: rnd() * TAU, age: 0, life: 0.8 + 1.6 * rnd(), am: 0.5 + 0.8 * rnd() });
  }
  const fl = s.fls;
  for (let i = fl.length - 1; i >= 0; i--) {
    const o = fl[i];
    o.age += dt;
    if (o.age > o.life || fl.length > 24) { fl.splice(i, 1); continue; }
    o.a += (sqrt(m1 / (o.r * o.r * o.r)) - 1) * TS * dt;
  }
}

function freshStep(s, dt) {
  const m1 = s.g.m1, kr = 1 - exp(-dt / 0.7);
  let n = s.nF;
  for (let i = 0; i < n; i++) {
    s.fa[i] += dt;
    if (s.fa[i] > 4) {
      n--;
      s.fr[i] = s.fr[n]; s.fp[i] = s.fp[n]; s.fa[i] = s.fa[n]; s.ft[i] = s.ft[n];
      i--;
      continue;
    }
    const r = (s.fr[i] += (s.ft[i] - s.fr[i]) * kr);
    s.fp[i] += (sqrt(m1 / (r * r * r)) - 1) * TS * dt;
  }
  s.nF = n;
}

function begin(s) {
  s.q = qOf(s.k[2]);
  s.g = makeGeo(s.q);
  const g = s.g;
  s.thr = 0.85 + 0.3 * rnd();
  // a disk most of the way to an outburst; then one whole outburst and the refill after it,
  // in coarse steps, stopping a few seconds short of the next one
  const sT = sqrt(g.rt);
  const n0 = floor(MTRIG * s.thr * 0.88);
  for (let i = 0; i < n0; i++) {
    const sv = SIN + (sT - SIN) * (0.25 + 0.6 * pow(rnd(), 0.8));
    s.ds[i] = sv; s.dr[i] = sv * sv; s.dp[i] = rnd() * TAU; s.dg[i] = 99;
  }
  s.nD = n0;
  const lead = 0.94 + 0.03 * rnd();
  let went = false;
  for (let k = 0; k < 1500; k++) {
    const h = s.phase ? 0.1 : 0.5;
    binsAndFronts(s, h);
    if (s.phase) went = true;
    else if (went && s.nD >= MTRIG * s.thr * lead) break;
    s.rcap = capRadius(s);
    diskStep(s, h, false);
    inject(s, h);
  }
  for (let i = 0; i < s.nD; i++) s.dp[i] = rnd() * TAU;
  binsAndFronts(s, 0.25);
  s.rcap = capRadius(s);
  hitOf(g, s.rcap, s.hit);
  s.spotX = g.x1 + s.hit[1] * cos(s.hit[0]);
  s.spotY = s.hit[1] * sin(s.hit[0]);
  for (let k = 0; k < 90; k++) {
    emitTracers(s, 1 / 30);
    freshStep(s, 1 / 30);
    tracerStep(s, 1 / 30);
  }
  s.init = true;
}

export function update(dt, input, params) {
  const s = params.s;
  knobs(s, input);
  if (!s.init) begin(s);
  dt = cl(dt || 0, 0, 0.1);
  // the mass ratio follows its knob; the lobes are rebuilt when it has moved
  const qT = qOf(s.k[2]);
  s.q += (qT - s.q) * (1 - exp(-dt / 0.4));
  if (abs(s.q - s.g.q) > 0.004 * s.q) s.g = makeGeo(s.q);
  // the transfer rate flickers on a few seconds
  s.lf += (-s.lf / 5) * dt + 0.25 * sqrt((2 * dt) / 5) * gauss();
  s.ls += (-s.ls / 40) * dt + 0.45 * sqrt((2 * dt) / 40) * gauss();
  spotStep(s, dt);
  s.lm = s.lf + s.ls + Math.log(1 - 0.75 * s.choke);
  binsAndFronts(s, dt);
  s.rcap += (capRadius(s) - s.rcap) * (1 - exp(-dt / 1.2));
  const acc = diskStep(s, dt, true);
  s.accR += (acc / max(dt, 1e-3) - s.accR) * (1 - exp(-dt / 0.4));
  inject(s, dt);
  emitTracers(s, dt);
  freshStep(s, dt);
  flareStep(s, dt);
  tracerStep(s, dt);
}

// ---- drawing
function splat(E, ET, px, py, e, t) {
  const ix = floor(px), iy = floor(py);
  if (ix < -1 || iy < -1 || ix >= W || iy >= H) return;
  const fx = px - ix, fy = py - iy;
  const w00 = (1 - fx) * (1 - fy) * e, w10 = fx * (1 - fy) * e, w01 = (1 - fx) * fy * e, w11 = fx * fy * e;
  if (iy >= 0) {
    if (ix >= 0) { E[iy * W + ix] += w00; ET[iy * W + ix] += w00 * t; }
    if (ix + 1 < W) { E[iy * W + ix + 1] += w10; ET[iy * W + ix + 1] += w10 * t; }
  }
  if (iy + 1 < H) {
    if (ix >= 0) { E[(iy + 1) * W + ix] += w01; ET[(iy + 1) * W + ix] += w01 * t; }
    if (ix + 1 < W) { E[(iy + 1) * W + ix + 1] += w11; ET[(iy + 1) * W + ix + 1] += w11 * t; }
  }
}
function blob(E, ET, cx, cy, sig, e, t) {
  const R = Math.ceil(sig * 2.5), i2 = 1 / (2 * sig * sig);
  const x0 = max(0, floor(cx - R)), x1 = min(W - 1, floor(cx + R) + 1), y0 = max(0, floor(cy - R)), y1 = min(H - 1, floor(cy + R) + 1);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy, w = e * exp(-(dx * dx + dy * dy) * i2);
      E[y * W + x] += w;
      ET[y * W + x] += w * t;
    }
}
function blur(A, T) {
  // 1 4 6 4 1 across, then down
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      const a = A[o + (x > 1 ? x - 2 : 0)], b = A[o + (x > 0 ? x - 1 : 0)], c = A[o + x], d = A[o + (x < W - 1 ? x + 1 : W - 1)], e = A[o + (x < W - 2 ? x + 2 : W - 1)];
      T[o + x] = (a + 4 * b + 6 * c + 4 * d + e) * 0.0625;
    }
  }
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const a = T[(y > 1 ? y - 2 : 0) * W + x], b = T[(y > 0 ? y - 1 : 0) * W + x], c = T[y * W + x], d = T[(y < H - 1 ? y + 1 : H - 1) * W + x], e = T[(y < H - 2 ? y + 2 : H - 1) * W + x];
      A[y * W + x] = (a + 4 * b + 6 * c + 4 * d + e) * 0.0625;
    }
  }
}

const hsh = (a, b) => {
  let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1103515245);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
function gran(x, y) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hsh(ix, iy), b = hsh(ix + 1, iy), c = hsh(ix, iy + 1), d = hsh(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const CO = new Float32Array(3);
export function draw(display, params, time) {
  const s = params.s;
  if (!s.init) return;
  const g = s.g, S = g.S, xm = g.xmid;
  const rowOf = (x) => 63.5 - (x - xm) * S;
  const hue = s.k[0];
  if (abs(hue - s.hue) > 1e-4) {
    s.hue = hue;
    for (let i = 0; i < 256; i++) {
      rampAt(i / 255, CO, 0);
      rotHue(CO[0], CO[1], CO[2], hue, s.lut, i * 3);
    }
  }
  const E = s.E, ET = s.ET;
  E.fill(0);
  ET.fill(0);
  // disk particles
  const x1 = g.x1;
  // the cold disk glows by viscous heating, which goes with alpha, and by the gas the stream brings
  const md = (mdotOf(s) * exp(s.lm)) / 16, kc = pow(md, 0.5) * pow(alphaOf(s) / 0.06, 0.5), tk = 0.1 * Math.log2(md);
  let lum = 0;
  for (let i = 0; i < s.nD; i++) {
    const r = s.dr[i], a = s.dp[i];
    const b = floor((s.ds[i] - S0) / BW), hv = s.hv[b < 0 ? 0 : b >= NB ? NB - 1 : b];
    const rr = max(r, 0.04);
    const fr = 1 + exp(-s.dg[i] / 2);
    const eh = 1.5 * pow(0.12 / rr, 1.1), ec = 0.42 * kc * fr * pow(0.1 / max(rr, 0.085), 1.1);
    const th = cl(1.04 - 0.9 * (rr - 0.045), 0.86, 1), tc = cl(0.66 + tk - 3.2 * (rr - 0.045), 0.02, 0.62);
    // two tidal spiral arms in the outer disk while it is hot
    const ca = 0.5 + 0.5 * cos(2 * (a - 2.2 * Math.log(rr / g.rt)) - 1.2);
    const arm = hv * cl((rr / g.rt - 0.35) * 2.5, 0, 1) * (2.4 * ca * ca * ca - 0.7);
    const e = (ec + (eh - ec) * hv) * (1 + arm), t = tc + (th - tc) * hv;
    lum += e;
    splat(E, ET, 31.5 + r * sin(a) * S, rowOf(x1 + r * cos(a)), e, t);
  }
  s.lum += (lum / 1500 - s.lum) * 0.1;
  // the stream
  for (let i = 0; i < s.nT; i++) splat(E, ET, 31.5 + s.ty[i] * S, rowOf(s.tx[i]), 0.55, 0.36);
  for (let i = 0; i < s.nF; i++) {
    const r = s.fr[i], a = s.fp[i], u = s.fa[i];
    splat(E, ET, 31.5 + r * sin(a) * S, rowOf(x1 + r * cos(a)), 0.5 * exp(-u / 1.3), 0.42 - 0.06 * u);
  }
  // hot spot and white dwarf
  for (const o of s.fls) {
    const u = o.age / o.life, w = o.am * sin(PI * u) * (1 + 1.5 * s.lum);
    const b = floor((sqrt(o.r) - S0) / BW), hv = s.hv[b < 0 ? 0 : b >= NB ? NB - 1 : b];
    const t = (1 - hv) * cl(0.8 - 3.2 * (o.r - 0.045), 0.15, 0.7) + hv * 0.95;
    // sheared along the orbit as it ages
    for (let k = -1; k <= 1; k++) {
      const a = o.a + k * (0.08 + 0.35 * u) * (0.2 / o.r);
      blob(E, ET, 31.5 + o.r * sin(a) * S, rowOf(x1 + o.r * cos(a)), 1.1, w * (k ? 0.6 : 1), t);
    }
  }
  // the hot spot, and the rim it heats downstream
  const sa = atan2(s.spotY, s.spotX - x1), sr = sqrt((s.spotX - x1) * (s.spotX - x1) + s.spotY * s.spotY);
  const fl = 0.75 + 0.5 * rnd(), arc = 0.9 * pow(md, 0.5);
  blob(E, ET, 31.5 + s.spotY * S, rowOf(s.spotX), 1.3, 1.6 * pow(md, 0.7) * fl, 0.6);
  for (let k = 1; k <= 5; k++) {
    const a = sa + (k * arc) / 5, w = exp(-k / 2.2) * 0.7 * pow(md, 0.7) * fl, rk = sr * (1 - 0.02 * k);
    blob(E, ET, 31.5 + rk * sin(a) * S, rowOf(x1 + rk * cos(a)), 1.2, w, 0.5);
  }
  blob(E, ET, 31.5, rowOf(x1), 0.9, 1.2, 1);
  // the inner disk and boundary layer, as bright as the white dwarf is being fed
  blob(E, ET, 31.5, rowOf(x1), 2.4, 0.02 * s.accR, 0.97);
  blob(E, ET, 31.5, rowOf(x1), 5.5, 0.005 * s.accR, 0.94);
  blur(E, s.B);
  blur(ET, s.B);
  // a little persistence to smooth the particles
  const dtf = s.last < 0 ? 1 : cl(time - s.last, 0, 0.2);
  s.last = time;
  const d = exp(-dtf / 0.06), PE = s.PE, PT = s.PT;
  for (let p = 0; p < NPX; p++) {
    PE[p] = d * PE[p] + (1 - d) * E[p];
    PT[p] = d * PT[p] + (1 - d) * ET[p];
  }
  // donor colours
  const dc = s.dcol || (s.dcol = new Float32Array(9));
  rotHue(0.62, 0.05, 0.03, hue, dc, 0);   // limb
  rotHue(1.0, 0.36, 0.1, hue, dc, 3);     // centre
  rotHue(1.0, 0.78, 0.42, hue, dc, 6);    // irradiated
  const irr = cl((s.lum - 0.35) * 0.8, 0, 1);
  const sp = s.spots, R = g.R, NA = R.length;
  for (const o of sp) {
    const th = o.th, kk = floor(((((th % TAU) + TAU) % TAU) / TAU) * NA) % NA;
    const rs = R[kk] * o.t, sz = o.sz * R[kk] * 0.5;
    o.cx = rs * cos(th);
    o.cy = rs * sin(th);
    o.i2 = 1 / (sz * sz);
  }
  const lut = s.lut;
  // faint gas lost from the system, turning slowly backwards round the centre of mass
  const dw = -0.021 * time, dcw = cos(dw), dsw = sin(dw), ev = time * 0.031;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const p = py * W + px;
      // background: deep navy with the equipotentials and the drifting gas
      const cn = g.con[p];
      const ux = px - 31.5, uy = py - 63.5, rx = ux * dcw - uy * dsw, ry = ux * dsw + uy * dcw;
      const n1 = gran(rx * 0.07 + 50, ry * 0.07 + ev), n2 = gran(rx * 0.16 - ev, ry * 0.16 + 20);
      const du = cl(2.4 * (0.62 * n1 + 0.38 * n2) - 1.05, 0, 1);
      let r = 4 + 16 * cn + 14 * du, gg = 6 + 22 * cn + 8 * du, bb = 20 + 50 * cn + 30 * du;
      const cov = g.dcov[p];
      if (cov > 0) {
        const mu = g.dmu[p], th = g.dth[p], tl = cos(th - PI);
        // limb darkening, gravity darkening toward L1, granulation and spots
        let v = (0.42 + 0.58 * mu) * (1 - 0.35 * pow(max(0, tl), 6));
        v *= 0.88 + 0.24 * gran(px * 0.42 + time * 0.23, py * 0.42 - time * 0.17);
        const y = (px - 31.5) / S, x = xm + (63.5 - py) / S, bx = x - g.x2;
        for (let k = 0; k < sp.length; k++) {
          const o = sp[k], ex = bx - o.cx, ey = y - o.cy;
          v *= 1 - o.am * exp(-(ex * ex + ey * ey) * o.i2);
        }
        // the face toward the white dwarf lights up while the disk is bright
        const ir = min(1, irr * max(0, tl + 0.2) * (0.4 + 0.6 * mu));
        const w = pow(mu, 0.8);
        let cr = dc[0] + (dc[3] - dc[0]) * w, cg = dc[1] + (dc[4] - dc[1]) * w, cb = dc[2] + (dc[5] - dc[2]) * w;
        cr += (dc[6] - cr) * ir; cg += (dc[7] - cg) * ir; cb += (dc[8] - cb) * ir;
        v *= 1 + 0.5 * ir;
        r = r * (1 - cov) + 255 * min(1, cr * v) * cov;
        gg = gg * (1 - cov) + 255 * min(1, cg * v) * cov;
        bb = bb * (1 - cov) + 255 * min(1, cb * v) * cov;
      }
      const e = PE[p];
      if (e > 0.002) {
        const f = 255 * (1 - exp(-e * 1.6));
        let t = cl(PT[p] / e, 0, 1);
        // dim warm light reads brown on the panel, so it is drawn redder
        if (t < 0.72) t *= 0.45 + 0.55 * min(1, f / 170);
        const li = floor(t * 255) * 3;
        r += lut[li] * f;
        gg += lut[li + 1] * f;
        bb += lut[li + 2] * f;
      }
      display.setPixel(px, py, min(255, r), min(255, gg), min(255, bb));
    }
  }
}
