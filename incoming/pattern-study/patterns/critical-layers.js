// ===== Patternflow pattern =====
// Title:   Critical Layers
// Family:  stratosphere
// Idea:    A height section of the equatorial stratosphere, longitude across and altitude up: broad bands of westerly wind in amber and easterly wind in blue slide down the panel and reverse, driven by pale cream phase lines of an eastward and a westward wave that climb from the bottom, lean, crowd together and dissolve exactly where the wind catches up with their speed.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the quasi-biennial oscillation of the tropical stratospheric wind, found by Richard Reed and by Roland Ebdon about 1960 (from memory), explained as waves handing momentum to the mean flow at their critical levels by Richard Lindzen and James Holton (1968) and by Holton and Lindzen (1972) (from memory), solved as a one-dimensional mean-flow model with a wave-flux integral in the manner of R. Alan Plumb (1977) (from memory); original code, pattern round 261
// Round:   261
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flux=1.2..4, Wavenumber=3..7, Asymmetry=-1..1
//
// Knob 1: Hue. Turns both ends of the wind ramp round the colour wheel, once over the knob's travel. At 0 and 1 the easterly wind is blue and the westerly wind amber with a dark neutral between them; at 0.12 it is teal and red, at 0.3 green and magenta, at 0.5 the two swap to orange and blue, at 0.7 crimson and green, at 0.88 violet and lime. Each side also wanders by up to 0.036 of a turn (13 degrees) over a minute or two, and its brightness by about a fifth, so the pair is never quite the same twice. The phase lines stay cream.
// Knob 2: Flux. How hard the waves are fed in at the tropopause, and so how fast the bands sink and reverse. The flux is 0.38 at 1.2, 0.64 at the opening 2 and 1.28 at 4 (in units of the model, where the wind reaches 1). A level changes sign about every 125 s of the whole cycle at 1.2, every 65 s at 2 and every 41 s at 4, and the shear zones sink about 3 LEDs a second at 1.2 and 2, 4 at 4. At 1.2 the winds only reach 1.0 and the bands are paler; at 4 they reach 1.25 and the colours run to the end of the ramp. The phase lines brighten with it, from 0.73 to 1 of their full strength. The model follows the knob over 1.5 s, and the bands take 20 to 40 s to feel a new flux.
// Knob 3: Wavenumber. The number of wavelengths of the eastward and westward waves round the panel's 64 columns: 3 at the opening, 7 at the top. The crests lie 21 LEDs apart at 3, 16 at 4, 12.8 at 5, 10.7 at 6 and 9.1 at 7, and they slide out from the middle of the panel while the knob turns, over 0.8 s. The phase lines keep moving at 3.2 LEDs a second whatever the wavenumber, east waves to the right and west waves to the left. The lean of the lines follows the wavenumber too: a line climbs 0.7 LED sideways for each row at 3 where the wind is calm and 0.3 at 7, and where a wave nears its critical level it lies flat.
// Knob 4: Asymmetry. The ratio of eastward to westward forcing, 1 + 0.62 a to 1 - 0.62 a for a knob value a: 1.04 to 0.96 at the opening 0.06, 1.62 to 0.38 (four to one) at 1 and 0.38 to 1.62 at -1. The favoured wave's lines brighten and the other's dim, at once. A slow wander of 0.3 either way over a minute rides on it. In the middle the wind reverses every 33 s or so at a level; at either end a level keeps one sign for 45 to 70 s at a time and the oscillation all but locks.

// What the picture is. A height section of the equatorial stratosphere: the panel's 64 columns are longitude, its 128 rows are height, the tropopause on the bottom row and the top of the model on the top row.
// The colour is the wind U(z, t), one value for each row. The model is run in four columns across the panel, each with its own flux noise and its own top, pulled together by 0.045 a second, so the band edges tilt and curve a few tens of rows from one side to the other and differently every time; between columns the wind is laid smoothly across. Westerly wind is amber, easterly wind blue, calm wind a dark navy that is the zero line of the wind. The bands slide down the panel and the sign of the wind
// at every row reverses again and again, never on the same beat. That is the quasi-biennial oscillation of the real stratosphere, 28 months a cycle, with a month taken as about 2.3 s so that a cycle lasts a minute or two.
//
// The engine is solved for real, on 128 levels, one for each row, at 30 steps a second: dU/dt = nu U_zz - sum over waves of (1/rho) dF/dz, with nu = 8 rows^2/s and the air thinning as rho = exp(-z/40 rows) so the same flux pushes harder higher up.
// Six waves climb from the tropopause, three eastward and three westward, at phase speeds c = +-1, +-0.45 and +-2.2 in units where the winds reach 1. A wave of speed c carries a flux F that dies
// away row by row as exp(-a / (c - U)^2) with a = 0.03 |c|: the nearer the wind comes to c the less of the wave is left, and what is lost goes into the wind as a push toward c (an eastward wave pushes the wind east where it dies). Where the
// wind has reached c the wave is gone: that is its critical level, and the bands cannot pass it. An eastward wave drives the wind toward c where it dies, which is the lower edge of the westerly layer, so the shear zone moves down; when the
// westerly layer reaches a row the eastward wave is cut off there and the westward wave takes over and reverses it. The flux of each wave wanders with a memory of 10 s and by up to 0.7 either way, and the whole flux wanders again over 229, 131 and 67 s, so no two reversals are alike.
// The top of the model is pulled toward a wind that wanders between easterly and westerly every 10 s or so (the semi-annual oscillation, faster than the QBO below it, and everything else the upper stratosphere does) and takes a 17 s semi-annual push of its
// own; new bands are born there and sink. The wind at the tropopause is held to a slow wobble of up to 0.26. The first update runs the model for 100 to 167 s before the first frame, so the panel opens in the middle of a cycle.
//
// The phase lines are the waves themselves, the eastward and the westward wave of phase speed 1, drawn from the wind averaged across the panel so that they stay straight, and faded where each column's own wind has reached their speed. A wave has phase theta = k x + integral of m dz - k c t with m = -N / (c - U): the vertical wavenumber grows as the wind approaches the wave's speed,
// so the crests lie along lines that lean more and more, become horizontal and crowd together (a vertical wavelength of 30 rows in calm air falls under 4 rows near the critical level) while the amplitude, the square root of the flux left in the wave,
// falls away. A line is drawn as a ridge 2 LEDs thick with a soft glow round it, brightest where cos(theta) = 1, and it is faded out before its wavelength falls under 4 rows, so nothing aliases into noise. East waves move right at 3.2 LEDs a second,
// west waves left. The waves also bend the colour a little: their wind perturbation tints the bands in soft diagonal stripes, their vertical displacement wiggles the band edges by up to 1.7 LEDs, and two slow planetary waves, up to 3.2 and 2.4 LEDs high and 54 to 140
// columns long, bend the layers a few LEDs more. Where a wave dies the momentum goes into the wind, and a cream glow lies along that row. The slow and the very fast waves push on the wind but are not drawn.

const W = 64, H = 128, NZ = 128, NZ1 = NZ + 1;
const { floor, sqrt, abs, exp, sin, cos, min, max, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the model: a wind U(z, t) on 128 levels, a level for each row of the panel, in G columns across the panel
const G = 4; // columns of the model: the panel's width is covered by G winds that pull weakly on each other
const XG = (W - 1) / (G - 1); // columns of the panel between two model columns
const KAP = 0.045; // how hard neighbouring model columns pull each other's wind together, 1/s
const NU = 8; // eddy diffusion of the wind, rows^2 per second
const HS = 40; // density scale height in rows
const A0 = 0.03; // wave damping, per row, at calm wind and phase speed 1
const EPS = 1e-3;
const STEP = 1 / 30;
const WAVES = [
  { c: 1, w: 1, vis: 0.95, kf: 1 },
  { c: -1, w: 1, vis: 0.95, kf: 1 },
  { c: 0.45, w: 1, vis: 0, kf: 0.7 },
  { c: -0.45, w: 1, vis: 0, kf: 0.7 },
  { c: 2.2, w: 0.35, vis: 0, kf: 0.7 },
  { c: -2.2, w: 0.35, vis: 0, kf: 0.7 },
];
const NW = WAVES.length;
const AF = 0.62; // how far K4 tilts the forcing toward one direction
const CX = 3.2; // columns a second a phase line of speed 1 travels
const NB = 0.2094; // buoyancy frequency, rad per row at speed 1: a vertical wavelength of 30 rows
const UC = 1.2; // the wind that reaches the end of the colour ramp

function randn() {
  return (Math.random() + Math.random() + Math.random() + Math.random() + Math.random() + Math.random() - 3) * 1.4142;
}

function makeState() {
  const S = {
    ready: false, t: 0, acc: 0, kn: [0, 2, 3, 0.06],
    Ug: [], Uo: [], F: [], ab: [], nz: [], top: new Float64Array(G),
    Fn: [], nc: new Float64Array(NW), acc1: new Float64Array(NZ), rho: new Float64Array(NZ), topW: new Float64Array(NZ),
    f0: 0.76, cs: 1, asym: 0, aw: 0, fw: 1, kS: (3 * TAU) / W, ub: 0,
    sb: new Float64Array(NZ), sc: new Float64Array(NZ), sd: new Float64Array(NZ),
    phase: [], ep: [], etaP: new Float32Array(W), rowF: new Float32Array(NZ), etaF: new Float32Array(NZ), pw: [],
    // what the pixel loop reads: for each drawn wave a phase, an amplitude and a sharpness for every (column, level), and the wind and the glow
    CosX: [], SinX: [], AmpX: [], IgX: [], UX: new Float32Array(W * NZ1), GlowX: new Float32Array(W * NZ1),
    PhiM: new Float64Array(NZ), MM: new Float64Array(NZ), PhiG: new Float64Array(G * NZ), MG: new Float64Array(G * NZ), ArG: new Float64Array(G * NZ), GlowG: new Float32Array(G * NZ),
    env: new Float32Array(W * NW),
    lut: new Float32Array(3 * 521), hue: [0, 0, 1, 1], seed: [],
  };
  for (let g = 0; g < G; g++) {
    S.Ug.push(new Float64Array(NZ));
    S.Uo.push(new Float64Array(NZ));
    S.F.push([]);
    S.ab.push([]);
    S.nz.push(new Float64Array(NW));
    for (let i = 0; i < NW; i++) {
      S.F[g].push(new Float64Array(NZ));
      S.ab[g].push(new Float64Array(NZ));
    }
  }
  for (let i = 0; i < NW; i++) {
    S.Fn.push(new Float64Array(NZ));
    S.phase.push(Math.random() * TAU);
    S.ep.push(Math.random() * TAU);
    const vis = WAVES[i].vis > 0;
    S.CosX.push(vis ? new Float32Array(W * NZ1) : null);
    S.SinX.push(vis ? new Float32Array(W * NZ1) : null);
    S.AmpX.push(vis ? new Float32Array(W * NZ1) : null);
    S.IgX.push(vis ? new Float32Array(W * NZ1) : null);
  }
  for (let j = 0; j < NZ; j++) {
    S.rho[j] = exp(-j / HS);
    S.rowF[j] = 0.4 + 0.6 * (j / (NZ - 1));
    S.etaF[j] = sm(0, 18, j) * sm(0, 10, NZ - 1 - j);
    S.topW[j] = 0.25 * exp(-(NZ - 1 - j) / 30);
  }
  for (let k = 0; k < 24; k++) S.seed.push(Math.random() * TAU);
  for (let c = 0; c < 2; c++) S.pw.push({ psi: Math.random() * TAU });
  for (let g = 0; g < G; g++) for (let j = 0; j < NZ; j++) S.Ug[g][j] = 0.02 * sin(j / 9 + S.seed[0] + g);
  // the implicit diffusion matrix never changes: factor it once
  const r = NU * STEP;
  for (let j = 0; j < NZ; j++) {
    S.sb[j] = 1 + 2 * r;
    S.sc[j] = -r;
  }
  S.sb[0] = 1;
  S.sc[0] = 0;
  for (let j = 1; j < NZ; j++) {
    const m = (j === NZ - 1 ? -2 * r : -r) / S.sb[j - 1];
    S.sb[j] -= m * S.sc[j - 1];
    S.sd[j] = m;
  }
  return S;
}

export function setup(params) {
  params.s = makeState();
}

// One step of the mean-flow equation in every column: dU/dt = nu U_zz - sum over waves of (1/rho) dF/dz.
// Each wave of phase speed c enters at the bottom with flux F and loses it layer by layer as exp(-a / (c - U)^2) per row:
// the nearer the wind gets to c, the sooner the wave is gone, and what it loses goes into the wind as a push toward c.
function step(S) {
  const rho = S.rho, t = S.t, acc = S.acc1;
  const TC = 10;
  const asym = cl(S.asym + S.aw, -1.2, 1.2);
  S.aw += (-S.aw * STEP) / 60 + sqrt((2 * STEP) / 60) * 0.32 * randn();
  for (let i = 0; i < NW; i++) {
    S.nc[i] += (-S.nc[i] * STEP) / TC + sqrt((2 * STEP) / TC) * 0.5 * randn();
    const wv = WAVES[i], c = wv.c * S.cs, a = A0 * abs(c);
    const dirf = c > 0 ? 1 + AF * asym : 1 - AF * asym;
    const base = S.f0 * S.fw * wv.w * dirf, calm = exp(-a / (c * c)), Fn = S.Fn[i];
    Fn[0] = base;
    for (let j = 0; j < NZ - 1; j++) Fn[j + 1] = Fn[j] * calm;
  }
  for (let g = 0; g < G; g++) S.Uo[g].set(S.Ug[g]);
  const sao = 0.1 * (1 + 0.2 * sin((TAU * t) / 257 + S.seed[23])) * sin((TAU * t) / 17 + S.seed[1]) * (0.7 + 0.3 * sin((TAU * t) / 53 + S.seed[2]));
  S.ub = 0.2 * (0.6 * sin((TAU * t) / 53 + S.seed[3]) + 0.4 * sin((TAU * t) / 31 + S.seed[4]));
  for (let g = 0; g < G; g++) {
    const U = S.Ug[g], Ul = S.Uo[max(0, g - 1)], Ur = S.Uo[min(G - 1, g + 1)];
    acc.fill(0);
    for (let i = 0; i < NW; i++) {
      const wv = WAVES[i], c = wv.c * S.cs, a = A0 * abs(c);
      S.nz[g][i] += (-S.nz[g][i] * STEP) / TC + sqrt((2 * STEP) / TC) * 0.6 * randn();
      const fac = 1 + 0.7 * tanh((S.nc[i] + S.nz[g][i]) / 0.8);
      let f = S.Fn[i][0] * fac;
      const F = S.F[g][i], ab = S.ab[g][i];
      const sg = c > 0 ? 1 : -1;
      for (let j = 0; j < NZ - 1; j++) {
        F[j] = f;
        const d = c - 0.5 * (U[j] + U[j + 1]);
        let tau = a / (d * d + EPS);
        if (tau > 30) tau = 30;
        const e = exp(-tau);
        ab[j] = 1 - e;
        const fo = f * e;
        acc[j] += (sg * (f - fo)) / (0.5 * (rho[j] + rho[j + 1]));
        f = fo;
      }
      F[NZ - 1] = f;
      ab[NZ - 1] = 0;
    }
    // the top of the model: a wind pulled toward a target that wanders between easterly and westerly every ten seconds or so, a stand-in for the
    // semi-annual oscillation and for all the upper stratosphere does that the waves above do not; each column has its own, and new bands start here and sink
    S.top[g] += (-S.top[g] * STEP) / 6 + sqrt((2 * STEP) / 6) * 1.0 * randn();
    const tg = cl(S.top[g], -1, 1);
    for (let j = NZ - 91; j < NZ; j++) acc[j] += S.topW[j] * (tg - U[j]);
    for (let j = 0; j < NZ; j++) acc[j] += sao * exp(-(NZ - 1 - j) / 12) + KAP * (Ul[j] + Ur[j] - 2 * U[j]);
    // implicit diffusion, a tridiagonal solve; the tropopause wind is held and not quite still
    for (let j = 0; j < NZ; j++) acc[j] = U[j] + STEP * acc[j];
    acc[0] = S.ub;
    for (let j = 1; j < NZ; j++) acc[j] -= S.sd[j] * acc[j - 1];
    U[NZ - 1] = acc[NZ - 1] / S.sb[NZ - 1];
    for (let j = NZ - 2; j >= 0; j--) U[j] = (acc[j] - S.sc[j] * U[j + 1]) / S.sb[j];
    for (let j = 0; j < NZ; j++) U[j] = cl(U[j], -1.3, 1.3);
  }
  S.t += STEP;
}

// slow drivers that never share a period: the flux wanders, the hue of each side of the ramp wanders, two planetary waves bend the layers
function fluxWander(t, sd) {
  return 1 + 0.5 * (0.5 * sin((TAU * t) / 229 + sd[5]) + 0.3 * sin((TAU * t) / 131 + sd[6]) + 0.2 * sin((TAU * t) / 67 + sd[22]));
}

function drivers(S, d) {
  const t = S.t, sd = S.seed;
  S.fw = fluxWander(t, sd);
  S.cs = 1 + 0.2 * (0.6 * sin((TAU * t) / 211 + sd[20]) + 0.4 * sin((TAU * t) / 163 + sd[21]));
  S.hue[0] = 0.006 + 0.04 * (0.6 * sin((TAU * t) / 97 + sd[7]) + 0.4 * sin((TAU * t) / 173 + sd[8])); // easterly side
  S.hue[1] = -0.01 + 0.04 * (0.6 * sin((TAU * t) / 113 + sd[9]) + 0.4 * sin((TAU * t) / 151 + sd[10])); // westerly side
  S.hue[2] = 0.8 + 0.13 * sin((TAU * t) / 79 + sd[11]) + 0.07 * sin((TAU * t) / 43 + sd[12]);
  S.hue[3] = 0.8 + 0.13 * sin((TAU * t) / 101 + sd[13]) + 0.07 * sin((TAU * t) / 59 + sd[14]);
  const PA = [211, 157], PP = [97, 173], AM0 = [3, 2], AM1 = [9, 6], LB = [64, 96];
  const eta = S.etaP;
  eta.fill(0);
  for (let c = 0; c < 2; c++) {
    const A = AM0[c] + (AM1[c] - AM0[c]) * sm(-0.6, 0.8, sin((TAU * t) / PA[c] + sd[16 + c]));
    const L = LB[c] * (1 + 0.12 * sin((TAU * t) / (PP[c] * 1.37) + sd[18 + c]));
    S.pw[c].psi += ((TAU * d) / PP[c]) * (c ? -1 : 1);
    const psi = S.pw[c].psi;
    for (let x = 0; x < W; x++) eta[x] += A * sin((TAU * (x - 31.5)) / L + psi);
  }
}

function control(S, kn, d) {
  const k = 1 - exp(-d / 1.5);
  S.f0 += (0.32 * cl(kn[1], 1.2, 4) - S.f0) * k;
  S.asym += (cl(kn[3], -1, 1) - S.asym) * k;
}

function preroll(S, kn) {
  S.f0 = 0.32 * cl(kn[1], 1.2, 4);
  S.asym = cl(kn[3], -1, 1);
  S.kS = (cl(kn[2], 3, 7) * TAU) / W;
  const n = 2400 + floor(Math.random() * 1200);
  for (let k = 0; k < n; k++) {
    if ((k & 31) === 0) S.cs = 1 + 0.2 * (0.6 * sin((TAU * S.t) / 211 + S.seed[20]) + 0.4 * sin((TAU * S.t) / 163 + S.seed[21]));
    if ((k & 31) === 0) S.fw = fluxWander(S.t, S.seed);
    step(S);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  if (!S.ready) {
    S.ready = true;
    preroll(S, kn);
  }
  control(S, kn, d);
  S.kS += ((cl(kn[2], 3, 7) * TAU) / W - S.kS) * (1 - exp(-d / 0.8));
  S.acc += d;
  while (S.acc >= STEP) {
    S.acc -= STEP;
    step(S);
  }
  drivers(S, d);
  for (let i = 0; i < NW; i++) {
    S.phase[i] += S.kS * WAVES[i].kf * WAVES[i].c * S.cs * CX * d;
    S.ep[i] += d * (0.55 + 0.4 * i) * (i & 1 ? -1 : 1); // the zonal envelope of each wave drifts at its own pace
  }
}

// ---- the picture: the wind as a diverging ramp, blue where it blows from the east, amber where it blows from the west
const RAMP = [
  [-1.0, 80, 158, 255],
  [-0.75, 40, 112, 240],
  [-0.5, 30, 80, 196],
  [-0.25, 26, 52, 130],
  [-0.08, 26, 36, 76],
  [0.0, 30, 32, 58],
  [0.08, 56, 44, 50],
  [0.2, 112, 76, 46],
  [0.4, 206, 130, 42],
  [0.65, 244, 168, 48],
  [1.0, 255, 204, 96],
];
const CREAM = [255, 246, 224];

// the ramp with K1 added to its hue, each side nudged by its own slow wander, in a matrix that turns the colour wheel
function buildLut(S, hue) {
  const lut = S.lut;
  const mats = [];
  for (let s = 0; s < 2; s++) {
    const A = -TAU * (hue + S.hue[s]), c = cos(A), sn = sin(A);
    mats.push([
      0.213 + c * 0.787 - sn * 0.213, 0.715 - c * 0.715 - sn * 0.715, 0.072 - c * 0.072 + sn * 0.928,
      0.213 - c * 0.213 + sn * 0.143, 0.715 + c * 0.285 + sn * 0.14, 0.072 - c * 0.072 - sn * 0.283,
      0.213 - c * 0.213 - sn * 0.787, 0.715 - c * 0.715 + sn * 0.715, 0.072 + c * 0.928 + sn * 0.072,
    ]);
  }
  let k = 0;
  for (let n = 0; n <= 520; n++) {
    const u = -1.3 + (n / 520) * 2.6;
    const uc = cl(u < 0 ? -Math.pow(-u, 0.85) : Math.pow(u, 0.85), -1, 1); // weak winds get a little more colour than a straight ramp gives them
    while (k < RAMP.length - 2 && uc > RAMP[k + 1][0]) k++;
    const a = RAMP[k], b = RAMP[k + 1], tt = cl((uc - a[0]) / (b[0] - a[0]), 0, 1);
    const side = u < 0 ? 0 : 1, m = mats[side], gain = S.hue[2 + side];
    const r = (a[1] + (b[1] - a[1]) * tt) * gain, g = (a[2] + (b[2] - a[2]) * tt) * gain, bl = (a[3] + (b[3] - a[3]) * tt) * gain;
    lut[n * 3] = cl(r * m[0] + g * m[1] + bl * m[2], 0, 255);
    lut[n * 3 + 1] = cl(r * m[3] + g * m[4] + bl * m[5], 0, 255);
    lut[n * 3 + 2] = cl(r * m[6] + g * m[7] + bl * m[8], 0, 255);
  }
}

// for every drawn wave, a phase, an amplitude and a sharpness at each (column, level), made from the winds of the two model columns either side
function prepare(S) {
  const sig = 1.0;
  const u2 = cl(S.kn[1], 1.2, 4) / 4;
  const asym = cl(S.asym + S.aw, -1.2, 1.2);
  const PhiG = S.PhiG, MG = S.MG, ArG = S.ArG, GlowG = S.GlowG;
  GlowG.fill(0);
  for (let i = 0; i < NW; i++) {
    const wv = WAVES[i], c = wv.c * S.cs, k = S.kS * wv.kf;
    const dirf = c > 0 ? 1 + AF * asym : 1 - AF * asym;
    const bright = wv.vis * sqrt(cl(dirf, 0.05, 2)) * (0.62 + 0.38 * u2);
    for (let g = 0; g < G; g++) {
      const U = S.Ug[g], F = S.F[g][i], Fn = S.Fn[i], ab = S.ab[g][i], o = g * NZ;
      let phi = S.phase[i], mPrev = 0;
      for (let j = 0; j < NZ; j++) {
        let d = c - U[j];
        if (abs(d) < 0.05) d = d < 0 ? -0.05 : 0.05;
        const m = -NB / d; // vertical wavenumber, rad per row; the wavelength 2 pi / |m| shrinks as the wind nears c
        if (j > 0) phi += 0.5 * (m + mPrev);
        mPrev = m;
        PhiG[o + j] = phi;
        MG[o + j] = m;
        const ar = sqrt(cl(F[j] / (Fn[j] + 1e-9), 0, 1));
        ArG[o + j] = bright * ar;
        GlowG[o + j] += ar * sm(0.12, 0.6, ab[j]) * (0.5 + 0.5 * bright);
      }
    }
    if (wv.vis === 0) continue;
    // the lines follow the wind averaged across the panel, so they stay straight; where they fade follows each column's own wind
    {
      let phi = S.phase[i], mPrev = 0;
      for (let j = 0; j < NZ; j++) {
        let um = 0;
        for (let g = 0; g < G; g++) um += S.Ug[g][j];
        let d = c - um / G;
        if (abs(d) < 0.05) d = d < 0 ? -0.05 : 0.05;
        const m = -NB / d;
        if (j > 0) phi += 0.5 * (m + mPrev);
        mPrev = m;
        S.PhiM[j] = phi;
        S.MM[j] = m;
      }
    }
    const CosX = S.CosX[i], SinX = S.SinX[i], AmpX = S.AmpX[i], IgX = S.IgX[i];
    for (let x = 0; x < W; x++) {
      const gx = x / XG, g0 = min(G - 2, floor(gx)), f = gx - g0, b = x * NZ1, o0 = g0 * NZ, o1 = o0 + NZ;
      const kx0 = k * (x - 31.5);
      for (let j = 0; j < NZ; j++) {
        const ml = MG[o0 + j] + (MG[o1 + j] - MG[o0 + j]) * f; // this column's own vertical wavenumber
        const mm = S.MM[j], g2 = k * k + mm * mm;
        const am = (ArG[o0 + j] + (ArG[o1 + j] - ArG[o0 + j]) * f) * sm(1.55, 0.85, sqrt(k * k + ml * ml)); // gone before the wavelength falls under 4 rows
        AmpX[b + j] = am;
        IgX[b + j] = 1 / (g2 * sig * sig);
        if (am > 0.01) {
          const th = kx0 + S.PhiM[j];
          CosX[b + j] = cos(th);
          SinX[b + j] = sin(th);
        } else {
          CosX[b + j] = 1;
          SinX[b + j] = 0;
        }
      }
      AmpX[b + NZ] = AmpX[b + NZ - 1];
      IgX[b + NZ] = IgX[b + NZ - 1];
      CosX[b + NZ] = CosX[b + NZ - 1];
      SinX[b + NZ] = SinX[b + NZ - 1];
    }
  }
  // the glow where waves die, blurred so it is a seam and not a hair, and the wind, each laid across the columns
  const GX = S.GlowX, UX = S.UX;
  for (let x = 0; x < W; x++) {
    const gx = x / XG, g0 = min(G - 2, floor(gx)), f = gx - g0, b = x * NZ1, o0 = g0 * NZ, o1 = o0 + NZ;
    const U0 = S.Ug[g0], U1 = S.Ug[g0 + 1];
    for (let j = 0; j < NZ; j++) {
      const ja = max(0, j - 2), jb = max(0, j - 1), jc = min(NZ - 1, j + 1), jd = min(NZ - 1, j + 2);
      const s0 = GlowG[o0 + ja] + 2 * GlowG[o0 + jb] + 3 * GlowG[o0 + j] + 2 * GlowG[o0 + jc] + GlowG[o0 + jd];
      const s1 = GlowG[o1 + ja] + 2 * GlowG[o1 + jb] + 3 * GlowG[o1 + j] + 2 * GlowG[o1 + jc] + GlowG[o1 + jd];
      GX[b + j] = ((s0 + (s1 - s0) * f) / 9);
      UX[b + j] = U0[j] + (U1[j] - U0[j]) * f;
    }
    GX[b + NZ] = GX[b + NZ - 1];
    UX[b + NZ] = UX[b + NZ - 1];
  }
  for (let i = 0; i < NW; i++) {
    for (let x = 0; x < W; x++) {
      const dx = ((((x - S.ep[i] + 48) % 96) + 96) % 96) - 48;
      S.env[i * W + x] = 0.22 + 0.78 * exp(-(dx * dx) / (2 * 17 * 17)); // a packet of the wave about 40 columns wide, drifting across the panel at its own speed
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  buildLut(S, cl(S.kn[0], 0, 1));
  prepare(S);
  const lut = S.lut, GX = S.GlowX, UX = S.UX, etaP = S.etaP, rowF = S.rowF, etaF = S.etaF, env = S.env;
  const k3 = cl(S.kn[2], 3, 7);
  const ETA = 1.7 * cl(3 / k3, 0.45, 1), USTRIPE = 0.05;
  const TOP = NZ - 1.001;
  for (let y = 0; y < H; y++) {
    const j = H - 1 - y, rf = rowF[j];
    for (let x = 0; x < W; x++) {
      const bx = x * NZ1;
      // the planetary waves lift and lower the layers a few rows, more toward the top
      let jd = j + etaP[x] * rf;
      jd = jd < 0 ? -jd : jd > TOP ? 2 * TOP - jd : jd;
      jd = jd < 0 ? 0 : jd > TOP ? TOP : jd;
      const j0 = jd | 0, fj = jd - j0, gj = 1 - fj, i0 = bx + j0, i1 = i0 + 1;
      let L = 0, du = 0, eta = 0;
      for (let i = 0; i < NW; i++) {
        const Am = S.AmpX[i];
        if (Am === null) continue;
        const A = Am[i0] * gj + Am[i1] * fj;
        if (A < 0.01) continue;
        const Cx = S.CosX[i], Sx = S.SinX[i], Ig = S.IgX[i];
        const cth = Cx[i0] * gj + Cx[i1] * fj, sth = Sx[i0] * gj + Sx[i1] * fj;
        du += USTRIPE * A * cth;
        eta += ETA * etaF[j0] * A * sth;
        const q = (1 - cth) * (Ig[i0] * gj + Ig[i1] * fj);
        if (q < 30) {
          const v = A * env[i * W + x] * (exp(-q) + 0.25 * exp(-0.1 * q));
          L = L + v - L * v;
        }
      }
      let jj = jd + eta;
      jj = jj < 0 ? -jj : jj > TOP ? 2 * TOP - jj : jj;
      jj = jj < 0 ? 0 : jj > TOP ? TOP : jj;
      const k0 = jj | 0, fk = jj - k0;
      const u = (UX[bx + k0] * (1 - fk) + UX[bx + k0 + 1] * fk + du) / UC;
      const li = ((cl(u, -1.3, 1.3) + 1.3) * 200 + 0.5) | 0;
      let r = lut[li * 3], g = lut[li * 3 + 1], b = lut[li * 3 + 2];
      const gv = min(0.4, (GX[i0] * gj + GX[i1] * fj) * 0.3);
      if (gv > 0.01) { r += (CREAM[0] - r) * gv; g += (CREAM[1] - g) * gv; b += (CREAM[2] - b) * gv; }
      if (L > 0.01) { const a = L > 1 ? 1 : L; r += (CREAM[0] - r) * a; g += (CREAM[1] - g) * a; b += (CREAM[2] - b) * a; }
      display.setPixel(x, y, r | 0, g | 0, b | 0);
    }
  }
}
