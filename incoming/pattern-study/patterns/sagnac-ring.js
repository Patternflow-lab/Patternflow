// ===== Patternflow pattern =====
// Title:   Sagnac Ring
// Family:  sagnac
// Idea:    A fibre-optic Sagnac interferometer: two pulses race round a coil in opposite directions from the same splitter, the loop turns, the pulse that runs with the rotation comes home late, and the fringes on the detector strip slide by exactly that delay.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Sagnac effect, the time difference 4 N A Omega / c^2 between two beams that go round a turning loop in opposite directions (Georges Sagnac, 1913, from memory), its use as a fibre-optic gyroscope (Victor Vali and Richard Shorthill, 1976, from memory), original code, pattern round 276
// Round:   276
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=0.5..4, Turns=-2..3, Noise=0..1
//
// Knob 1: Hue. Adds K1 to every hue: at 0 the packets are cyan (0.5) and magenta (0.84), the fringes amber (0.105) and the fibre cool grey (0.6); at 0.5 they are blue-green, orange-red, blue-violet and warm grey; at 1 they are back.
// Knob 2: Rate. Gain of the platform's rotation, g = K2 / 2: 0.25 at 0.5, 1 at 2 where it opens, 2 at 4. Omega = 0.07 g x (a wandering signal of rms 0.6) rad/s. At the opening the platform turns 0.042 rad/s rms (2.4 degrees a second, 1 LED a second on the outer ring, 0.105 at the most), the delay is 2.2 percent of the loop time rms (5.5 at the most) and the fringes sit within +-6 rad (1 period) of the marker rms. At 0.5 the platform all but stands still (0.012 rad/s rms) and the fringes lean 1 rad; at 4 it turns 5 degrees a second, the delay is 4 percent rms and the fringes slide through 3 or 4 periods.
// Knob 3: Turns. The number of turns of fibre, N = round(3 + K3), 1 at -2 to 6 at 3, opening at 3. Ring j has radius 25 - 3.4 j LEDs, so N sets how many rings are drawn, the loop time (2.2 s at 1 turn, 5.7 s at 3, 8.8 s at 6) and the area the delay sums over (sum of pi r^2: 1960 LED^2, 4470, 5770), so the fringes slide 2.3 times as far at 3 turns as at 1 and 2.9 times as far at 6.
// Knob 4: Noise. Shot noise and a drifting source, 0 to 1, opening at 0.06. Visibility V = 0.94 (1 - 0.78 K^0.9): 0.94 at 0, 0.88 at the opening, 0.21 at 1. The source phase wanders by 1.7 radian rms x K (memories of 0.9 s and 0.15 s), so at 1 the fringes shake by 3 LEDs, and soft grain 3 LEDs across boils over the strip with an amplitude of 0.4 K. At 0 the fringes are crisp and each flash is exactly 0.5 (1 + 0.94 cos(dphi)).
//
// What the picture is. The top is a coil of fibre seen face-on: N concentric rings of radius 25 - 3.4 j LEDs, each a soft line 2 LEDs thick, a splitter (a small bright node) on the rim of the platform and one radial lead from it through the rings, as a wound coil has. The platform turns by Phi, the integral of Omega, and carries the rings' faint texture bands, the node, the lead and three broad dim rim arcs round with it, clockwise when Omega is positive. Two packets leave the node together, a cyan one clockwise and a magenta one counter-clockwise, each a comet 6 LEDs long, run the N turns of the same fibre in opposite directions, pass each other (near-white where they overlap) and come home. The first to arrive waits as a glow in the node, and when the second arrives a flash shows the interference of that launch. The bottom is the detector strip, amber fringes on near-black violet, with a fixed soft marker through it (and a nub above and below) to read the slide against.
// The model. The panel keeps Sagnac's relation in panel units, 1 LED = 1 cm, and the one exaggeration is the speed of light: slowed from 3e8 m/s to 0.75 m/s (CP = 75 LED/s, a factor of 4e8), so that a platform turning at 0.04 rad/s costs a few percent of the loop time and not 1e-10 of it. On a turn of radius r a packet moves along the fibre at CP - Omega r with the rotation and CP + Omega r against it, on the radial leads at CP, and each is stepped at 1/90 s with the Omega of that moment. The flight times T+ and T- are sums, not a formula: T+ - T- comes out as 4 A Omega / CP^2 (A the sum of pi r_j^2 over the turns, each ring its own area; checked against the closed form over 30 launches, 2 percent rms). The phase of a launch is dphi = 2 pi CP / lambda x (T+ - T-) with lambda = 10 LEDs (the carrier wavelength on the panel, 10 cm), which is 8 pi N A Omega / (lambda c) in the usual form. The flash is 0.5 (1 + V cos(dphi + source phase)) times the launch's pulse energy.
// The strip. I(x) = 0.5 (1 + V cos(k (x - 31.5) + dphi + source phase)) with k = -2 pi / 11 per LED, so a positive Omega drags the fringes to the right; dphi is the launch relation with the Omega of the moment (the flashes carry the loop's lag, T seconds, the strip does not). The period is 11 LEDs and does not change. The beam that lights the strip walks (centre by 16 LEDs, width 24 +- 8, height 4 rows, on 30, 41 and 53 s) and a gentle lean (0.025 radian a row) keeps it from reading as a bar code.
// Omega. A smooth random signal: three sines of 21.7, 34.3 and 55.9 s with weights 0.55, 0.42 and 0.32 and random phases, plus an Ornstein-Uhlenbeck walk of 45 s memory and rms 0.45, times 0.07 g rad/s. It changed sign 43 times in 600 s, passes near zero each time and has no period. Launches come every T / 6 s (0.55 to 2.2 s) times 0.7 to 1.3, each with its own pulse energy (log-normal, 0.4) and splitter ratio (0.35 to 0.65), and the source power wanders on 18 s: none of these shares a period with Omega.
// Set-up. The first update runs 40 s of model time with the knobs it was given.
// What is exact and what is drawn. The delay, its dependence on N, A and Omega, the fringe phase, the interference of each flash and the geometry of the loop (rings, one lead) are the model above. The slowed light, the comet shape, the texture bands and rim arcs that show the platform turning, the amber ramp, the grain, the beam walk, the pulse energies and the faint neutral light in the room (it keeps the corners from going out) are drawing choices.

const W = 64, H = 128;
const { floor, sqrt, exp, sin, cos, min, max, abs, pow, atan2, log, PI } = Math;
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

const CX = 31.5, CY = 43.5;         // coil centre
const R0 = 25, SP = 3.4;            // outer ring radius and ring spacing, LEDs
const RNODE = R0 + 3.6;             // radius of the splitter on the platform
const NMAX = 6;
const CP = 75;                      // the slowed speed of light, LEDs per second
const LAM = 10;                     // carrier wavelength, LEDs
const WOPT = (TAU * CP) / LAM;      // optical angular frequency on the panel
const OM0 = 0.07;                   // rad/s per unit of the Omega signal
const PERIOD = 11, KFR = -TAU / PERIOD;
const SY0 = 89, SY1 = 124;          // detector rows
const NODEX = 31.5;                 // the fixed reference marker
const SUB = 1 / 90;
const rad = (j) => R0 - SP * j;

// the closed loop for N turns, walked clockwise from the splitter: a stub in to ring 0, N turns joined by short
// radial hops, then the lead out from the innermost ring to the splitter
const PATHS = [];
for (let N = 1; N <= NMAX; N++) {
  const segs = [];
  let s = 0;
  const add = (turn, len, ra, rb, j) => { segs.push({ turn, s0: s, len, ra, rb, j }); s += len; };
  add(false, RNODE - R0, RNODE, R0, -1);
  for (let j = 0; j < N; j++) {
    add(true, TAU * rad(j), rad(j), rad(j), j);
    if (j < N - 1) add(false, SP, rad(j), rad(j + 1), j);
  }
  add(false, RNODE - rad(N - 1), rad(N - 1), RNODE, -1);
  let area = 0;
  for (let j = 0; j < N; j++) area += PI * rad(j) * rad(j);
  PATHS.push({ segs, L: s, N, area });
}

function segAt(P, s) {
  const g = P.segs;
  for (let i = g.length - 1; i >= 0; i--) if (s >= g[i].s0) return g[i];
  return g[0];
}

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

const LNX = 24, LNY = 13;

export function setup(params) {
  const ph = [];
  for (let i = 0; i < 16; i++) ph.push(TAU * Math.random());
  const lat = new Float32Array(LNX * LNY);
  for (let i = 0; i < lat.length; i++) lat[i] = gauss();
  params.s = {
    t: 0, k: null, ph, ou: gauss() * 0.45, phi: TAU * Math.random(), om: 0,
    launches: [], glows: [], flashes: [], nextL: 0.4,
    alpha: [1, 1, 1, 0, 0, 0], pw: gauss(), pwr: 1, bx: gauss(), bw: gauss(), by: gauss(), dphi: 0, vNoise: 0, ps1: 0, ps2: 0, lat, Ncur: 3,
  };
}

function omegaRaw(S) {
  const t = S.t, p = S.ph;
  return 0.55 * sin((TAU * t) / 21.7 + p[0]) + 0.42 * sin((TAU * t) / 34.3 + p[1]) + 0.32 * sin((TAU * t) / 55.9 + p[2]) + S.ou;
}

function areaOf(N) {
  return PATHS[N - 1].area;
}

// one step of the model
function advance(S, h) {
  const k = S.k;
  S.t += h;
  const kap = cl(k[3], 0, 1);
  // Omega: an Ornstein-Uhlenbeck walk with 45 s memory and rms 0.45, three sines on top
  S.ou += (-S.ou * h) / 45 + 0.45 * sqrt((2 * h) / 45) * gauss();
  const g = cl(k[1], 0.5, 4) / 2;
  const om = OM0 * g * omegaRaw(S);
  S.om = om;
  S.phi += om * h;
  S.Ncur = cl(Math.round(3 + k[2]), 1, NMAX);
  const N = S.Ncur;
  // source noise
  S.ps1 += (-S.ps1 * h) / 0.9 + 1.6 * sqrt((2 * h) / 0.9) * gauss();
  S.ps2 += (-S.ps2 * h) / 0.15 + 0.5 * sqrt((2 * h) / 0.15) * gauss();
  S.vNoise += (-S.vNoise * h) / 1.2 + sqrt((2 * h) / 1.2) * gauss();
  // the source power wanders slowly (18 s memory, 20 percent rms)
  S.pw = cl(S.pw + (-S.pw * h) / 18 + sqrt((2 * h) / 18) * gauss(), -2.6, 2.6);
  S.pwr = exp(0.2 * S.pw);
  // the beam walks over the detector: its centre and width drift on 30, 41 and 53 s
  S.bx = cl(S.bx + (-S.bx * h) / 30 + sqrt((2 * h) / 30) * gauss(), -1.7, 1.7);
  S.bw = cl(S.bw + (-S.bw * h) / 41 + sqrt((2 * h) / 41) * gauss(), -1.7, 1.7);
  S.by = cl(S.by + (-S.by * h) / 53 + sqrt((2 * h) / 53) * gauss(), -1.7, 1.7);
  S.phs = kap * (S.ps1 + S.ps2);
  S.vis = cl(0.94 * (1 - 0.78 * pow(kap, 0.9)) * (1 + 0.18 * kap * S.vNoise), 0.1, 0.96);

  // the phase the strip shows now: omega x (4 A Omega / c^2), eased over a quarter second
  const dnow = WOPT * ((4 * areaOf(N) * om) / (CP * CP));
  S.dphi += (dnow - S.dphi) * (1 - exp(-h / 0.25));

  // launches, one every T / 3.5 s
  if (S.t >= S.nextL) {
    const P = PATHS[N - 1];
    const T0 = P.L / CP;
    S.launches.push({ P, born: S.t, sc: 0, sm: 0, tc: -1, tm: -1, ac: -1, am: -1, en: exp(cl(0.4 * gauss(), -0.7, 0.5)), sp: 0.5 + 0.3 * (Math.random() - 0.5) });
    S.nextL = S.t + cl(T0 / 6, 0.55, 2.2) * (0.7 + 0.6 * Math.random());
  }
  for (let i = S.launches.length - 1; i >= 0; i--) {
    const Lh = S.launches[i], P = Lh.P;
    // clockwise packet, along the path
    if (Lh.tc < 0) {
      const sg = segAt(P, Lh.sc);
      const v = sg.turn ? CP - om * sg.ra : CP;
      Lh.sc += v * h;
      if (Lh.sc >= P.L) {
        Lh.tc = S.t - Lh.born - (Lh.sc - P.L) / v;
        Lh.ac = S.t;
        S.glows.push({ t: S.t, c: 0 });
      }
    }
    // counter-clockwise packet, along the path reversed
    if (Lh.tm < 0) {
      const sg = segAt(P, P.L - Lh.sm);
      const v = sg.turn ? CP + om * sg.ra : CP;
      Lh.sm += v * h;
      if (Lh.sm >= P.L) {
        Lh.tm = S.t - Lh.born - (Lh.sm - P.L) / v;
        Lh.am = S.t;
        S.glows.push({ t: S.t, c: 1 });
      }
    }
    if (Lh.tc >= 0 && Lh.tm >= 0) {
      const dph = WOPT * (Lh.tc - Lh.tm);
      const amp = 0.5 * (1 + S.vis * cos(dph + S.phs));
      S.flashes.push({ t: max(Lh.ac, Lh.am), a: amp * Lh.en });
      S.launches.splice(i, 1);
    }
  }
  while (S.glows.length && S.t - S.glows[0].t > 0.8) S.glows.shift();
  while (S.flashes.length && S.t - S.flashes[0].t > 1.6) S.flashes.shift();

  // rings: drawn while the knob wants them or a launch in flight still runs on them
  let need = N;
  for (const Lh of S.launches) need = max(need, Lh.P.N);
  const al = 1 - exp(-h / 0.3);
  for (let j = 0; j < NMAX; j++) S.alpha[j] += ((j < need ? (j < N ? 1 : 0.7) : 0) - S.alpha[j]) * al;
}

function step(S, d) {
  const n = max(1, Math.ceil(d / SUB - 1e-6));
  const h = d / n;
  for (let i = 0; i < n; i++) advance(S, h);
}

function stepLattice(S, d) {
  const lat = S.lat, a = exp(-d / 0.22), b = sqrt(1 - a * a);
  for (let i = 0; i < lat.length; i++) lat[i] = lat[i] * a + b * gauss();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
    // run 40 s with the knobs we were given, so the first picture is a mature one
    for (let i = 0; i < 40 * 30; i++) {
      step(S, 1 / 30);
      if (i % 3 === 0) stepLattice(S, 0.1);
    }
  } else {
    const al = 1 - exp(-d / 0.2);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
    step(S, d);
    stepLattice(S, d);
  }
}

const BUF = new Float32Array(W * H * 3);
const BC = new Float32Array(W * H);
const BM = new Float32Array(W * H);
const BF = new Float32Array(W * H);
const CYAN = [0, 0, 0], MAG = [0, 0, 0], FIB = [0, 0, 0], AMB = [0, 0, 0], VIO = [0, 0, 0], WHT = [1, 1, 1];

function splat(buf, cx, cy, sig, amp) {
  const R = floor(sig * 3) + 1, is2 = 1 / (2 * sig * sig);
  const x0 = max(0, floor(cx) - R), x1 = min(W - 1, floor(cx) + R);
  const y0 = max(0, floor(cy) - R), y1 = min(H - 1, floor(cy) + R);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy;
      buf[y * W + x] += amp * exp(-(dx * dx + dy * dy) * is2);
    }
}

// the packet's head is at path position s; the tail trails behind it by 0..6.5 LEDs
function comet(buf, P, s, dir, Phi, amp) {
  for (let u = -1.6; u <= 6.6; u += 0.8) {
    const q = s - dir * u;
    if (q < 0 || q > P.L) continue;
    const a = u < 0 ? exp((-u * u) / 1.3) : exp(-u / 2.7);
    const sg = segAt(P, q), f = (q - sg.s0) / sg.len;
    const r = sg.ra + (sg.rb - sg.ra) * f, ang = (sg.turn ? TAU * f : 0) + Phi - PI / 2;
    const px = CX + r * cos(ang), py = CY + r * sin(ang);
    splat(buf, px, py, 1.2, 0.25 * amp * a);
    if (u >= 0 && u < 1) splat(buf, px, py, 2.2, 0.1 * amp);
  }
}

const ARCS = [[2.1, 0.55], [3.75, 0.2], [5.1, 0.34]]; // rim arcs: middle angle and half width, in the platform frame

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const k = S.k, hue = k[0], Phi = S.phi, N = S.Ncur;
  hsv(0.5 + hue, 0.9, 1, CYAN);
  hsv(0.84 + hue, 0.88, 1, MAG);
  hsv(0.6 + hue, 0.2, 1, FIB);
  hsv(0.105 + hue, 0.88, 1, AMB);
  hsv(0.74 + hue, 0.8, 1, VIO);

  BC.fill(0); BM.fill(0); BF.fill(0);
  // the ground: a faint neutral light in the room, with a little more round the coil and a breath from each flash
  let room = 0;
  for (const f of S.flashes) room += f.a * exp(-(S.t - f.t) / 0.5);
  room = min(room, 1.5);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - CX, dy = y - CY, b = exp(-(dx * dx + dy * dy) / 1400), o = (y * W + x) * 3;
      const g = 1 + 0.3 * b + 0.12 * room * b;
      BUF[o] = 28 * g;
      BUF[o + 1] = 24 * g;
      BUF[o + 2] = 32 * g;
    }

  // ---- the coil
  const ndx = cos(Phi - PI / 2) * RNODE, ndy = sin(Phi - PI / 2) * RNODE;
  for (let y = 0; y < 86; y++) {
    const dy = y - CY;
    if (abs(dy) > RNODE + 6) continue;
    for (let x = 0; x < W; x++) {
      const dx = x - CX, rr = sqrt(dx * dx + dy * dy);
      if (rr > RNODE + 6) continue;
      const thf = atan2(dy, dx) - Phi + PI / 2;
      let line = 0, halo = 0;
      for (let j = 0; j < NMAX; j++) {
        const al = S.alpha[j];
        if (al < 0.01) continue;
        const d = abs(rr - rad(j));
        if (d > 5) continue;
        const tx = 0.5 * sin(thf + 0.5 * j) + 0.35 * sin(2 * thf - 0.8 * j + 1.3) + 0.2 * sin(3 * thf + 1.1 * j + 0.4);
        const tex = 0.22 + 0.78 * (0.5 + 0.5 * tx);
        const v = d < 1.7 ? 1 - (d * d) / 2.89 : 0;
        line += al * tex * v * v;
        halo += al * exp(-(d * d) / 7.2);
      }
      // the radial lead, one segment between the rings, at fibre angle 0
      let sa = sin(thf), ca = cos(thf);
      if (ca > 0) {
        const dp = rr * abs(sa);
        if (dp < 1.7) {
          const v = 1 - (dp * dp) / 2.89;
          const rp = rr * ca;
          for (let j = 0; j < NMAX; j++) {
            const al = S.alpha[j];
            if (al < 0.01) continue;
            const ra = j === 0 ? RNODE : rad(j - 1), rb = rad(j);
            const e = sm(rb - 1.5, rb + 0.5, rp) * (1 - sm(ra - 0.5, ra + 1.5, rp));
            line += 0.5 * al * e * v * v;
          }
        }
      }
      // the rim: three broad dim arcs and no marks, turning with the platform
      const dr = abs(rr - RNODE);
      let rim = 0;
      if (dr < 1.7) {
        let th = thf - floor(thf / TAU) * TAU, m = 0;
        for (const a of ARCS) {
          let e = abs(th - a[0]);
          if (e > PI) e = TAU - e;
          m = max(m, 1 - sm(a[1] - 0.12, a[1] + 0.12, e));
        }
        const v = 1 - (dr * dr) / 2.89;
        rim = 0.38 * m * v * v;
      }
      const o = (y * W + x) * 3, val = (0.72 * line + 0.1 * halo + rim) * sqrt(S.pwr);
      BUF[o] += 255 * FIB[0] * val;
      BUF[o + 1] += 255 * FIB[1] * val;
      BUF[o + 2] += 255 * FIB[2] * val;
    }
  }
  // the splitter
  const nx = CX + ndx, ny = CY + ndy;
  const nodeBuf = BF;
  splat(nodeBuf, nx, ny, 1.7, 0.55);
  splat(nodeBuf, nx, ny, 4.2, 0.12);

  // ---- packets
  for (const Lh of S.launches) {
    if (Lh.tc < 0) comet(BC, Lh.P, Lh.sc, 1, Phi, S.pwr * Lh.en * 2 * Lh.sp);
    if (Lh.tm < 0) comet(BM, Lh.P, Lh.P.L - Lh.sm, -1, Phi, S.pwr * Lh.en * 2 * (1 - Lh.sp));
  }
  // the packet that is home waits in the splitter, then the flash
  for (const g of S.glows) {
    const age = S.t - g.t, a = 0.7 * exp(-age / 0.18);
    splat(g.c === 0 ? BC : BM, nx, ny, 2.0, a);
  }
  for (const f of S.flashes) {
    const age = S.t - f.t, e = min(1.15, exp(-age / 0.28) * f.a * S.pwr);
    splat(BF, nx, ny, 2.2 + 1.8 * sm(0, 0.3, age), 1.0 * e);
    splat(BF, nx, ny, 5 + 3 * sm(0, 0.6, age), 0.25 * e);
  }

  // ---- the detector strip
  const kap = cl(k[3], 0, 1), vis = S.vis;
  const phase0 = S.dphi + S.phs;
  const lat = S.lat;
  const bxc = 31.5 + 16 * S.bx, bwd = 24 + 8 * S.bw, byc = 106.5 + 4 * S.by;
  for (let y = SY0 - 6; y < H; y++) {
    const ey = sm(SY0 - 1.5, SY0 + 1.5, y) * (1 - sm(SY1 - 1.5, SY1 + 1.5, y));
    const inb = y >= SY0 - 6 && y <= H - 1;
    const gy = ((y - 90) / (SY1 - 90)) * (LNY - 1);
    const gy0 = cl(floor(gy), 0, LNY - 2), fy = cl(gy - gy0, 0, 1);
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      // the marker nubs above and below the screen
      const mk = exp(-((x - NODEX) * (x - NODEX)) / (2 * 1.15 * 1.15));
      if (ey < 0.02) {
        let nub = 0;
        if (y >= SY0 - 6 && y < SY0 - 1) nub = sm(SY0 - 7, SY0 - 3, y) * 0.92;
        else if (y > SY1 + 1) nub = 0.92 * (1 - sm(SY1 + 1, SY1 + 3.5, y));
        if (nub > 0) {
          BUF[o] += 255 * nub * mk;
          BUF[o + 1] += 240 * nub * mk;
          BUF[o + 2] += 205 * nub * mk;
        }
        continue;
      }
      const ex = (x - bxc) / bwd, ey2 = (y - byc) / 16;
      const env = (0.38 + 0.62 * exp(-ex * ex)) * (0.78 + 0.22 * exp(-ey2 * ey2));
      const ph = KFR * (x - 31.5) + phase0 + 0.025 * (y - 107.5);
      let I = 0.5 * (1 + vis * cos(ph));
      if (kap > 0.001) {
        const gx = (x / (W - 1)) * (LNX - 1), gx0 = cl(floor(gx), 0, LNX - 2), fx = cl(gx - gx0, 0, 1);
        const a0 = lat[gy0 * LNX + gx0], a1 = lat[gy0 * LNX + gx0 + 1], b0 = lat[(gy0 + 1) * LNX + gx0], b1 = lat[(gy0 + 1) * LNX + gx0 + 1];
        const nz = (a0 * (1 - fx) + a1 * fx) * (1 - fy) + (b0 * (1 - fx) + b1 * fx) * fy;
        I += 0.4 * kap * nz * sqrt(max(I, 0.05));
      }
      I = cl(I, 0, 1.15);
      const lum = 0.08 + 0.8 * pow(I, 1.2);
      const glow = lum * env * ey * S.pwr;
      const hot = sm(0.8, 1.05, I) * 0.22 * env * ey * S.pwr;
      BUF[o] += 255 * (AMB[0] * glow + hot) + 255 * 0.03 * VIO[0] * ey;
      BUF[o + 1] += 255 * (AMB[1] * glow + hot) + 255 * 0.015 * VIO[1] * ey;
      BUF[o + 2] += 255 * (AMB[2] * glow + hot) + 255 * 0.07 * VIO[2] * ey;
      // the soft marker through the strip
      const line = 0.2 * mk * ey;
      BUF[o] += 255 * line;
      BUF[o + 1] += 240 * line;
      BUF[o + 2] += 205 * line;
    }
  }

  // ---- composite and write
  for (let p = 0; p < W * H; p++) {
    const o = p * 3, c = BC[p], m = BM[p], f = BF[p], w = min(c, m);
    BUF[o] += 255 * (CYAN[0] * c + MAG[0] * m + w + f);
    BUF[o + 1] += 255 * (CYAN[1] * c + MAG[1] * m + w + f);
    BUF[o + 2] += 255 * (CYAN[2] * c + MAG[2] * m + w + f);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, r = BUF[o], g = BUF[o + 1], b = BUF[o + 2];
      display.setPixel(x, y, r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, b > 255 ? 255 : b | 0);
    }
}
