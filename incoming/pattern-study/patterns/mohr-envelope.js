// ===== Patternflow pattern =====
// Title:   Mohr Envelope
// Family:  mohrcoulomb
// Idea:    Four rock samples hang as Mohr circles inside the Coulomb failure funnel, each swelling as its load climbs until it touches a wall and slips in a flash with a pair of conjugate planes, while pulses of pore fluid slide every circle up the funnel so that the ones nearest the wall break one after another.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Mohr's circle of stress (Christian Otto Mohr, 1882, from memory), the Coulomb failure criterion tau = c + sigma' tan(phi) (Charles-Augustin de Coulomb, 1773, from memory), effective stress sigma' = sigma - p and the part pore fluid pressure plays in making rock slip (Hubbert and Rubey, 1959, from memory), original code, pattern round 277
// Round:   277
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Friction=0..4, Fluid=-1..1, Strain=-1..1
//
// Knob 1: Hue. Turns the rings of the circles round the colour wheel and the slate wash inside the funnel a quarter as far. 0 is teal (hue 0.49) for a safe circle, then slate blue, violet, amber and white as it nears the wall; the wall stays rust amber and the haze outside stays dark red.
// Knob 2: Friction. The angle of internal friction phi = 12 + 6.5 K degrees: 12 at 0, 25 at 2 where it opens, 38 at 4, with a wander of 2.6 and 1.4 degrees on 113 and 71 s. It is the half angle of the funnel and it sets the failure radius R_f = a sin(phi) / (1 - sin(phi)), a being how far below the apex the top of a circle hangs.
// Knob 3: Fluid. How much pore fluid is pumped in, s = (K + 1) / 2. None at -1. At 0 where it opens a pulse comes about every 36 s and slides the circles up by 3.0 LEDs on average (9.5 at most), at 1 one comes every 14 s and the slide averages 7.6. A pulse builds over 2.5 to 6 s and drains away on 9 s and 35 s.
// Knob 4: Strain. The loading rate, a factor exp(1.4 (K - 0.06)): 0.23 at -1, 1 at 0.06 where it opens, 3.7 at 1. Fast loading breaks the circles more often and each break lets go less stress (the circle falls back to 0.62 to 0.84 of its failure radius at 1, 0.38 to 0.56 at -1, 0.5 to 0.7 at the opening), so the quakes are many and small.
//
// What the picture is. The sigma'-tau plane of effective stress, sigma' down the panel (the apex of the funnel near the top, more confinement further down) and the shear stress tau across it, 0 on the middle column, with one LED to one LED so that a circle is a circle. A rock sample is the circle of centre (sigma1' + sigma3') / 2 and radius R = (sigma1' - sigma3') / 2. Its top end hangs from its own sigma3' on the axis and it swells downward as sigma1' climbs. The Coulomb criterion is the pair of walls tau = +-(c + sigma' tan(phi)), a funnel whose apex lies at sigma' = -c / tan(phi). A circle that reaches a wall has failed. There are no figures, no scale and no arrowheads.
// The geometry. Let a be the depth of a circle's top end below the apex, a = sigma3' + c / tan(phi). The circle that just touches both walls has its centre on the axis at a + R and sin(phi) = R / (a + R), so R_f = a sin(phi) / (1 - sin(phi)), which is (sigma3' sin(phi) + c cos(phi)) / (1 - sin(phi)) written out. The two touching points lie at tau = +-R cos(phi), a height R sin(phi) above the centre, in the direction 90 degrees + phi from the sigma1' axis, the 2 theta of the two conjugate planes. All of it is evaluated every frame from phi, c, sigma3' and the pore pressure. A wall leaves the panel by its side below row 18 + 32 / tan(phi) at the opening (row 87), and does not leave at all at phi = 12 degrees.
// The scale. The four samples have sigma3' of 3.6, 5.6, 8.2 and 11.7 times c. One unit of c is Z LEDs, Z = min(3.6, 28 / (kappa (11.7 + c / tan(phi)))) with kappa = sin(phi) / (1 - sin(phi)). Above about 20 degrees of friction the largest circle then fails at a radius of 28 LEDs, small enough that its touching points are on the panel (a hard cap of 30.5 holds it when the drifts below push it); at 12 degrees the cap of 3.6 holds the circles up the funnel and the largest fails at 15.5. That is a zoom with phi and it is the one place where the scale is chosen by eye. At the opening the four failure radii are 11.6, 15.7, 20.9 and 28.0 LEDs and the circles hang 15.9, 21.4, 28.6 and 38.2 LEDs below the apex, which stands at row 18. The apex row is 8 at phi = 12 degrees and 26 at 38 so that a wide funnel does not leave the lower half bare.
// The pore pressure. p is a sum of pumped pulses and a slow ambient swell of 2 s LEDs on 83 s. A pulse of A = (3 + 9 s) x 0.7 to 1.35 LEDs of stress at the opening zoom is delivered at an even rate over 2.5 to 6 s, 80 percent into a part that drains with a time of 9 s and 20 percent into one that drains in 35 s, and pulses arrive at a rate 0.07 s^1.3 a second. The effective stress is sigma' = sigma - p, so every circle slides up the funnel by p and every failure radius shrinks by kappa p. The slide saturates through a tanh at 0.6 of the hang depth of the nearest circle so that none ends in the apex. A circle breaks when R reaches R_f, so the one with the least margin R_f - R goes first, and a pulse runs down the chain from the apex.
// The loading and the slip. Every sample's R grows at m v g LEDs a second, v = 0.11, 0.15, 0.20 and 0.25, m the Strain factor, g = exp(0.3 n) (1 + 0.32 sin(2 pi t / (32 + 11 i)) + 0.2 sin(2 pi t / (67 - 9 i))) and n an Ornstein-Uhlenbeck noise of time 7 s. At the opening a sample breaks every 25 to 36 s (900 s run: 36, 28, 28 and 25 breaks) and R / R_f averages 0.77 to 0.82. When R reaches R_f the sample ruptures: R falls (a time of 0.18 s) to a random fraction r of R_f, both touching points flash with a short stretch of wall lighting on each side, two lines cross through the circle from the touching points to the far side for about 2 s (conjugate shear bands), and 1 to 9 aftershocks follow as small flashes on the wall within 7 LEDs of the touching points, each at 0.7 s plus an exponential of mean 2.2 s. A sample cannot break twice in 1.2 s. Nothing repeats: breaks and pulses are random.
// The drifts. The cohesion c wanders by 40 percent on 137 s and 15 on 61 s, so the apex stands off the circles by more or less. Each sample's sigma3' wanders by 30, 25, 18 and 10 percent (70 percent of it on 89 to 149 s, the rest on 43 to 59 s), so the circles slide on the axis and change their failure radii as the confinement changes. The slate wash drifts in hue by 0.032 and 0.022 on 97 and 151 s and in level by 10 and 7 percent on 61 and 109 s, the rings by 0.03 in hue on 79 s, the haze by 9 and 6 percent on 53 and 131 s, the wall by 10 and 6 percent on 41 and 113 s. A slow cloud of twelve plane waves (24 to 72 LEDs long, periods of 37 to 140 s) lifts and lowers the haze by 24 percent and the wash by 18 (one standard deviation of the cloud). These last two were added to keep the picture from coming round again (before the cloud the closest return was 0.23 of a typical difference at the opening, after it 0.41); they are not mechanics. The first update runs 50 s of the model, about 50 ms, so the picture opens in motion.
// The picture. Outside the funnel and above its apex a haze of dark red, about 24 of 255 on average far from the wall and 34 beside it, with a soft edge. Inside it a slate wash that darkens toward the wall by the margin to failure and with depth, lifted a little by the pore pressure, and 30 percent brighter in a narrow funnel. A circle is a 2 LED ring coloured by its hazard u = R / R_f (teal at 0, slate blue at 0.55, violet at 0.82 to 0.92, amber at 0.965, white at 1), with a soft inner fill that never goes past amber and a halo. The walls are 2 LED lines of rust amber with a glow that lights the haze beside them. The vertical axis is a faint line. Rings add where circles overlap.
// What is exact and what is drawn. The circle, the walls, the failure radius, the touching points and their 2 theta, the slide by the pore pressure and the rule that a circle breaks when it touches are the real mechanics. The zoom with phi, the apex row, the loading noise, the stress drop fractions, the aftershocks, the pulses of pore pressure (the real thing is a diffusion equation), the drifts, the cloud, the colours, the haze, the wash and the conjugate lines are drawing choices.

const W = 64, H = 128;
const { floor, sqrt, exp, sin, cos, min, max, abs, pow, hypot, tanh, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const lerp = (a, b, f) => a + (b - a) * f;
const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
const expo = (m) => -log(1 - Math.random()) * m;
const rnd = (a, b) => a + (b - a) * Math.random();

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

const AX = 31.5;                    // the sigma' axis, tau = 0
const NS = 4;                       // samples
const SIG = [3.6, 5.6, 8.2, 11.7];  // sigma3' of each sample, in units of c
const C0 = 1;                       // the cohesion c, the unit
const SW = [0.3, 0.25, 0.18, 0.1];  // how far each sample's confinement wanders, as a fraction of it
const SP1 = [89, 103, 127, 149];    // and on which two clocks, in seconds
const SP2 = [47, 53, 59, 43];
const VLOAD = [0.11, 0.15, 0.2, 0.25];   // LEDs of radius a second at the opening, per sample
const RT = 28;                      // where the largest circle fails, in LEDs, before the wanders
const RMAX = 30.5;                  // no circle fails wider than this, so its touching points stay on the panel
const ZMAX = 3.6;                   // the zoom of a narrow funnel, LEDs to one unit of c
const ZREF = 2.76;                  // the zoom at the opening, which pore pressure is counted in LEDs of
const PRE = 50;                     // seconds of the model run before the first frame
const NW = 16;                      // plane waves in the slow cloud that lifts and lowers the haze and the wash
const GP = 4, GX = 17, GY = 33;     // the cloud is computed on a grid 4 LEDs apart and interpolated
const CLOUD = new Float32Array(GX * GY);

// hazard u = R / R_f -> ring colour
const RST = [0, 0.55, 0.82, 0.92, 0.965, 1];
const RH = [0.49, 0.535, 0.61, 0.73, 1.08, 1.12];
const RSAT = [0.76, 0.66, 0.56, 0.48, 0.8, 0.1];
const RVAL = [0.74, 0.84, 0.92, 0.98, 1, 1];
function ringCol(u, h0, o) {
  let i = 0;
  while (i < 4 && u > RST[i + 1]) i++;
  const f = sm(RST[i], RST[i + 1], u);
  hsv(lerp(RH[i], RH[i + 1], f) + h0, lerp(RSAT[i], RSAT[i + 1], f), lerp(RVAL[i], RVAL[i + 1], f), o);
}

export function setup(params) {
  const ph = [];
  for (let i = 0; i < 28; i++) ph.push(TAU * Math.random());
  const cs = [];
  for (let i = 0; i < NS; i++) cs.push({ R: 0, Rt: 0, drop: false, cool: 0, ou: 0.8 * gauss() });
  const pw = [];
  for (let i = 0; i < NW; i++) {
    const lam = rnd(24, 72), an = TAU * Math.random(), per = rnd(37, 140);
    pw.push({ kx: (TAU / lam) * cos(an), ky: (TAU / lam) * sin(an), w: TAU / per, ph: TAU * Math.random() });
  }
  params.s = {
    t: 0, k: null, ph, pw, cs, pf: 0, ps: 0, pump: [], fl: [], fan: [], after: [], ready: false,
    G: { sg: [0, 0, 0, 0], phi: 0, sn: 0, cs: 1, tn: 0, kap: 0, Z: 1, C: 1, ya: 5, pe: 0, a3: [0, 0, 0, 0], Rf: [0, 0, 0, 0] },
  };
}

// the funnel and the circles for the knobs and the clock as they stand
function geom(S) {
  const G = S.G, k = S.k, t = S.t, ph = S.ph;
  const phi = ((12 + 6.5 * cl(k[1], 0, 4) + 2.6 * sin((TAU * t) / 113 + ph[12]) + 1.4 * sin((TAU * t) / 71 + ph[13])) * PI) / 180;
  const sn = sin(phi), cs = cos(phi), tn = sn / cs, kap = sn / (1 - sn);
  const Z = min(ZMAX, RT / (kap * (SIG[NS - 1] + C0 / tn)));
  const C = C0 * (1 + 0.4 * sin((TAU * t) / 137 + ph[0]) + 0.15 * sin((TAU * t) / 61 + ph[1]));
  const sa = (cl(k[2], -1, 1) + 1) / 2;
  const amb = 2 * sa * (1 + 0.5 * sin((TAU * t) / 83 + ph[2]));
  const sg = G.sg;
  for (let i = 0; i < NS; i++) sg[i] = SIG[i] * (1 + SW[i] * (0.7 * sin((TAU * t) / SP1[i] + ph[14 + i]) + 0.3 * sin((TAU * t) / SP2[i] + ph[24 + i])));
  const a1 = Z * (sg[0] + C / tn);
  const pcap = 0.6 * a1;
  const pe = pcap * tanh((((S.pf + S.ps + amb) * Z) / ZREF) / pcap);
  G.phi = phi; G.sn = sn; G.cs = cs; G.tn = tn; G.kap = kap; G.Z = Z; G.C = C; G.pe = pe;
  G.ya = 8 + 10 * sm(0.209, 0.436, phi) + 8 * sm(0.436, 0.663, phi);
  for (let i = 0; i < NS; i++) {
    G.a3[i] = cl(Z * (sg[i] + C / tn) - pe, 2.5, RMAX / kap);
    G.Rf[i] = kap * G.a3[i];
  }
  return G;
}

function rupture(S, i, G) {
  const s = S.cs[i], Rf = G.Rf[i], K4 = cl(S.k[3], -1, 1);
  const r = rnd(0.5 + 0.12 * K4, 0.7 + 0.14 * K4);
  s.Rt = max(r * Rf, min(0.9 * Rf, 3.5));
  s.drop = true;
  s.cool = 1.2;
  const big = cl((1 - r) / 0.4, 0.5, 1.3);
  const D = G.a3[i] + Rf;                  // the centre's distance from the apex
  const cy = G.ya + D;
  const along = D * G.cs;                  // down the wall to the foot of the perpendicular
  for (let sd = -1; sd <= 1; sd += 2) {
    const wx = AX + sd * along * G.sn, wy = G.ya + along * G.cs;
    S.fl.push({ x: wx, y: wy, t0: S.t, amp: 1.0 * big, sig: 2.2 * (0.8 + 0.3 * big), tau: 0.5 * big });
    // a short stretch of the wall lights with the slip
    for (let j = -2; j <= 2; j += 4)
      S.fl.push({ x: wx + sd * j * G.sn * 0.2 * Rf, y: wy + j * G.cs * 0.2 * Rf, t0: S.t, amp: 0.55 * big, sig: 1.7, tau: 0.4 * big });
  }
  S.fan.push({ t0: S.t, cx: AX, cy, R: Rf, th: 0.5 * PI + G.phi, big });
  const n = 1 + floor(rnd(0, 3 + 6 * (1 - r)));
  for (let j = 0; j < n; j++) {
    S.after.push({
      t: S.t + 0.7 + expo(2.2), along: along + rnd(1.5, 7) * (Math.random() < 0.5 ? -1 : 1),
      sd: Math.random() < 0.5 ? -1 : 1, amp: rnd(0.3, 0.65) * big,
    });
  }
}

function step(S, d) {
  const G = geom(S), k = S.k, t = S.t;
  const sa = (cl(k[2], -1, 1) + 1) / 2;
  // pore fluid: pulses pumped in, two drains
  if (sa > 0.01 && Math.random() < 0.07 * pow(sa, 1.3) * d) {
    const A = (3 + 9 * sa) * rnd(0.7, 1.35), dur = rnd(2.5, 6);
    S.pump.push({ left: dur, rate: A / dur });
  }
  for (let j = S.pump.length - 1; j >= 0; j--) {
    const pm = S.pump[j];
    S.pf += 0.8 * pm.rate * d;
    S.ps += 0.2 * pm.rate * d;
    pm.left -= d;
    if (pm.left <= 0) S.pump.splice(j, 1);
  }
  S.pf *= exp(-d / 9);
  S.ps *= exp(-d / 35);
  const m = exp(1.4 * (cl(k[3], -1, 1) - 0.06));
  for (let i = 0; i < NS; i++) {
    const s = S.cs[i];
    s.ou += (-s.ou / 7) * d + sqrt((2 * d) / 7) * 0.8 * gauss();
    const g = exp(0.3 * s.ou) * (1 + 0.32 * sin((TAU * t) / (32 + 11 * i) + S.ph[3 + i]) + 0.2 * sin((TAU * t) / (67 - 9 * i) + S.ph[8 + i]));
    s.cool -= d;
    if (s.drop) {
      s.R += (s.Rt - s.R) * (1 - exp(-d / 0.18));
      if (abs(s.R - s.Rt) < 0.2) s.drop = false;
    } else {
      s.R += m * VLOAD[i] * g * d;
    }
    const Rf = G.Rf[i];
    if (!s.drop && s.cool <= 0 && s.R >= Rf * 0.999) rupture(S, i, G);
  }
  // aftershocks
  for (let j = S.after.length - 1; j >= 0; j--) {
    const a = S.after[j];
    if (t >= a.t) {
      const al = max(2, a.along);
      S.fl.push({ x: AX + a.sd * al * G.sn, y: G.ya + al * G.cs, t0: t, amp: a.amp, sig: 1.4, tau: 0.28 });
      S.after.splice(j, 1);
    }
  }
  for (let j = S.fl.length - 1; j >= 0; j--) if ((t - S.fl[j].t0) / S.fl[j].tau > 4.5) S.fl.splice(j, 1);
  for (let j = S.fan.length - 1; j >= 0; j--) if (t - S.fan[j].t0 > 2.6) S.fan.splice(j, 1);
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
    const G = geom(S);
    for (let i = 0; i < NS; i++) S.cs[i].R = rnd(0.45, 0.95) * G.Rf[i];
    for (let n = 0; n < PRE * 30; n++) {
      S.t += 1 / 30;
      step(S, 1 / 30);
    }
  } else if (d > 0) {
    S.t += d;
    step(S, d);
  }
}

const BUF = new Float32Array(W * H * 3);
const HZ = [39 / 255, 15 / 255, 21 / 255];
const WC = [0, 0, 0], WL = [0, 0, 0], FC = [1, 0.9, 0.72];
const RC = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
const FILL = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];

// a soft lump of light, sigma in LEDs, amplitude amp (0..1) in colour c
function lump(cx, cy, sig, amp, c) {
  const R = floor(sig * 3.2) + 1, is2 = 1 / (2 * sig * sig);
  const x0 = max(0, floor(cx) - R), x1 = min(W - 1, floor(cx) + R);
  const y0 = max(0, floor(cy) - R), y1 = min(H - 1, floor(cy) + R);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy, a = 255 * amp * exp(-(dx * dx + dy * dy) * is2);
      const o = (y * W + x) * 3;
      BUF[o] += c[0] * a; BUF[o + 1] += c[1] * a; BUF[o + 2] += c[2] * a;
    }
}

// the two conjugate directions: a line from each touching point through the centre to the far side of the circle,
// which cross at 2 theta = 90 degrees + phi from the sigma1' axis
function fan(f, T) {
  const age = T - f.t0;
  const fade = exp(-age / 1.0) * sm(2.6, 1.6, age) * f.big;
  const sw = sm(0, 0.3, age);
  if (fade < 0.02) return;
  const cx = f.cx, cy = f.cy, R = f.R, ca = cos(f.th - 0.5 * PI), sa = sin(f.th - 0.5 * PI);
  // touching point (right) is (cx + R ca, cy - R sa); the far end of its line is (cx - R ca, cy + R sa)
  const x0 = max(0, floor(cx - R) - 1), x1 = min(W - 1, floor(cx + R) + 1);
  const y0 = max(0, floor(cy - R) - 1), y1 = min(H - 1, floor(cy + R) + 1);
  const L = 2 * R;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      let v = 0;
      for (let sd = -1; sd <= 1; sd += 2) {
        const tx = cx + sd * R * ca, ty = cy - R * sa;   // the touching point of this side
        const ux = -sd * ca, uy = sa;                    // unit vector from it through the centre
        const px = x - tx, py = y - ty;
        const along = (px * ux + py * uy) / L, perp = abs(px * uy - py * ux);
        if (along < -0.02 || along > sw || perp > 1.6) continue;
        const e = sm(0, 0.06, along) * (1 - sm(0.9, 1.0, along));
        v = max(v, e * sm(1.6, 0.6, perp));
      }
      if (v > 0) {
        const o = (y * W + x) * 3, w = 255 * 0.85 * fade * v;
        BUF[o] += FC[0] * w; BUF[o + 1] += FC[1] * w; BUF[o + 2] += FC[2] * w;
      }
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const G = geom(S), T = S.t, k1 = S.k[0];
  const sn = G.sn, cs = G.cs, ya = G.ya;
  const pn = cl(G.pe / (0.6 * (G.a3[0] + G.pe) + 1e-6), 0, 1);
  const tube = 1 + 0.5 * (1 - sm(0.21, 0.45, G.phi));

  hsv(0.075, 0.86, 0.9, WC);       // the wall, rust amber, and its glow
  hsv(0.05, 0.9, 0.5, WL);
  // slate wash inside the funnel
  const wash = [0, 0, 0], washLo = [0, 0, 0];
  // the wash drifts a little in hue and level on clocks of its own
  const sw = (per, i) => sin((TAU * T) / per + S.ph[i]);
  const wh = 0.615 + 0.25 * k1 - 0.025 * pn + 0.032 * sw(97, 20) + 0.022 * sw(151, 21);
  const wl = 1 + 0.1 * sw(61, 22) + 0.07 * sw(109, 23);
  hsv(wh, 0.6, (0.46 + 0.05 * pn) * wl * tube, wash);
  hsv(wh + 0.015, 0.7, 0.14 * wl * tube, washLo);
  const msc = 14 + 16 * sm(0.21, 0.45, G.phi);
  const rh = k1 + 0.03 * sw(79, 19);
  const hzl = 1 + 0.09 * sw(53, 0) + 0.06 * sw(131, 3);
  const wlk = 1 + 0.1 * sw(41, 1) + 0.06 * sw(113, 2);

  const amp = sqrt(2 / NW);
  for (let gy = 0; gy < GY; gy++)
    for (let gx = 0; gx < GX; gx++) {
      let f = 0;
      for (let j = 0; j < NW; j++) {
        const q = S.pw[j];
        f += sin(q.kx * gx * GP + q.ky * gy * GP - q.w * T + q.ph);
      }
      CLOUD[gy * GX + gx] = f * amp;
    }

  const Rd = [0, 0, 0, 0], cyc = [0, 0, 0, 0], uh = [0, 0, 0, 0];
  for (let i = 0; i < NS; i++) {
    const R = min(S.cs[i].R, G.Rf[i]);
    Rd[i] = R;
    cyc[i] = ya + G.a3[i] + R;
    uh[i] = cl(R / G.Rf[i], 0, 1);
    ringCol(uh[i], rh, RC[i]);
    ringCol(min(uh[i], 0.92), rh, FILL[i]);
  }

  for (let y = 0; y < H; y++) {
    const dy = y - ya;
    for (let x = 0; x < W; x++) {
      const dx = abs(x - AX);
      const nrm = dx * cs - dy * sn, tt = dx * sn + dy * cs;
      const mg = tt <= 0 ? -hypot(dx, dy) : -nrm;        // margin to the wall, positive inside the funnel
      const win = sm(-2.5, 2.5, mg);
      // the haze outside and the wash inside
      const hz = 0.95 + 0.4 * exp(min(0, mg) / 7);
      const wf = 1 - exp(-max(0, mg) / msc);
      const ax = 1 + 0.1 * exp(-dx * dx / 800);
      const gxf = x / GP, gyf = y / GP, ix = min(GX - 2, floor(gxf)), iy = min(GY - 2, floor(gyf)), fx = gxf - ix, fy = gyf - iy;
      const c00 = CLOUD[iy * GX + ix], c10 = CLOUD[iy * GX + ix + 1], c01 = CLOUD[(iy + 1) * GX + ix], c11 = CLOUD[(iy + 1) * GX + ix + 1];
      const cf = lerp(lerp(c00, c10, fx), lerp(c01, c11, fx), fy);
      const hzc = hzl * (1 + 0.24 * cf);
      const dk = (1 - 0.42 * sm(10, 118, dy)) * (1 + 0.18 * cf);
      let r = HZ[0] * hz * hzc * (1 - win) + (lerp(washLo[0], wash[0], wf) * ax * dk) * win;
      let g = HZ[1] * hz * hzc * (1 - win) + (lerp(washLo[1], wash[1], wf) * ax * dk) * win;
      let b = HZ[2] * hz * hzc * (1 - win) + (lerp(washLo[2], wash[2], wf) * ax * dk) * win;
      r *= 255; g *= 255; b *= 255;

      // the wall and its glow
      const ad = abs(mg);
      if (tt > 0 || ad < 6) {
        const line = ad < 1.5 ? sm(1.5, 0.5, ad) : 0;
        const glow = 0.5 * exp(-ad / 2.6) * (mg < 0 ? 1 : 0.55);
        r += 255 * wlk * (WC[0] * 0.82 * line + WL[0] * glow);
        g += 255 * wlk * (WC[1] * 0.82 * line + WL[1] * glow);
        b += 255 * wlk * (WC[2] * 0.82 * line + WL[2] * glow);
      }

      // the sigma' axis, faint
      if (dx < 1.5 && dy > 0) {
        const a = 0.1 * sm(1.5, 0.3, dx);
        r += 255 * a * 0.6; g += 255 * a * 0.8; b += 255 * a;
      }

      // the circles
      for (let i = 0; i < NS; i++) {
        const R = Rd[i], u = uh[i], c = RC[i];
        const ex = x - AX, ey = y - cyc[i];
        const dist = hypot(ex, ey), de = dist - R;
        let ring = 0, add = 0;
        if (de < 1.5 && de > -1.5) ring = sm(1.5, 0.5, abs(de)) * (0.82 + 0.18 * u);
        if (de > 0) add = de < 9 ? 0.15 * exp(-de / 2.6) : 0;
        else add = (0.03 + 0.08 * u * u) + 0.12 * exp(de / 3.2);
        const f = FILL[i], w = 255 * ring, wa = 255 * add;
        r += c[0] * w + f[0] * wa; g += c[1] * w + f[1] * wa; b += c[2] * w + f[2] * wa;
      }
      const o = (y * W + x) * 3;
      BUF[o] = r; BUF[o + 1] = g; BUF[o + 2] = b;
    }
  }

  for (let j = 0; j < S.fan.length; j++) fan(S.fan[j], T);
  for (let j = 0; j < S.fl.length; j++) {
    const f = S.fl[j], age = T - f.t0;
    const a = f.amp * exp(-age / f.tau) * sm(0, 0.04, age + 0.02);
    if (a > 0.02) lump(f.x, f.y, f.sig, a, FC);
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, r = BUF[o], g = BUF[o + 1], b = BUF[o + 2];
      display.setPixel(x, y, r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, b > 255 ? 255 : b | 0);
    }
}
