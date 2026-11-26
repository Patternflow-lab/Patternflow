// ===== Patternflow pattern =====
// Title:   Rabi Chevrons
// Family:  rabi
// Idea:    Sixty-four copies of one two-level atom, each driven at its own detuning from resonance, are drawn as a scrolling space-time record with brightness for the chance of finding the atom excited and hue for the azimuth of its Bloch vector, so a drive switched on draws Rabi's chevron of nested fringes, pulse-wait-pulse fans out Ramsey's fringes, a spin echo winds a rainbow fan open and shut again, a frequency sweep draws a Landau-Zener front and a sweep to and fro Stueckelberg's feathers, one random experiment after another with a dark reset between.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Rabi oscillations of a spin in a driven field (Isidor Rabi, 1937, from memory); the Bloch vector, the picture of a two-level state as a point on a sphere with a ground pole, an excited pole and an azimuth of coherence (Felix Bloch, 1946, from memory); separated oscillatory fields (Norman Ramsey, 1950, from memory); the spin echo that refocuses a spread of detunings with a pi pulse (Erwin Hahn, 1950, from memory); the passage of a swept two-level system through resonance (Lev Landau, Clarence Zener, Ernst Stueckelberg and Ettore Majorana, all 1932, from memory) and the interference of two passages (Stueckelberg, 1932; reviewed by Shevchenko, Ashhab and Nori, 2010, from memory). Original code, pattern round 262: the Bloch equations integrated by exact rotation steps for each of 64 detunings at once, with a random schedule of experiments. The older rabi-chevron.js draws Rabi's closed formula as a repeating sweep in brightness only, and ramsey-fringes.js draws Ramsey's formula against free time. This one integrates the state in time, so it shows the phase too and the experiments that have no formula in those two.
// Round:   264
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rabi=0.8..3.5, Detune=-1..1, Dephase=0..1
//
// Knob 1: Hue. Turns the whole colouring round the colour wheel by 360 degrees for the knob's travel, so 0 and 1 are the same. At 0 the ground state is near-black indigo (6, 3, 24), the excited state a pale gold (255, 244, 196), and the azimuth of the coherence goes through orange, magenta, violet and teal. At 0.25 the excited state is pale green over a dark maroon ground, at 0.5 pale cyan over a dark olive one and at 0.75 a pink-violet over a dark teal one; the picture is recoloured at once, rows already on the panel included.
// Knob 2: Rabi. How strong the drive is, 0.8 to 3.5, opening at 2: the Rabi frequency is 0.11 radian a row for each unit, and a row is a tenth of a second. At the opening 0.22 radian a row is one flop of the resonant columns every 28.6 rows (2.9 s), 71 rows at 0.8 and 16 rows at 3.5. Each experiment draws its own strength 0.8 to 1.3 times the knob's, and its pulses are as long as the strength needs for a pi/2 (7 rows at the opening) or a pi (14 rows). A strong drive packs more fringes into an experiment and widens the chevron, since the line is Omega wide; a weak one leaves a single flop and a chevron that is nearly a straight stripe.
// Knob 3: Detune. How far the outer columns are off resonance, -1 to 1, opening at 0: the edge columns are 0.36 e^(0.8 K) radian a row off, 0.16 at -1, 0.36 at the opening and 0.80 at 1. At the opening they are 1.6 Rabi frequencies off, flop 1.9 times as fast as the middle and rise 0.28 of the way up. At 1 they are 3.6 off, flop 3.7 times as fast and rise 0.07 of the way (before each experiment's own strength factor): a narrow chevron, many fringes, and a frequency sweep that crosses the panel at a steep angle. At -1 the whole panel is almost resonant and the fringes are close to horizontal stripes. The same number sets the sweeps' range and how long a free wait can be (a free wait is at most 8.6 over the edge detuning, 24 rows at the opening, so the rainbow fan keeps at least 23 columns for a turn of colour).
// Knob 4: Dephase. How fast the coherence is lost, 0 to 1, opening at 0.06: the transverse part of the Bloch vector decays at 0.003 + 0.1 K squared a row (each experiment draws 0.64 to 1.6 times that), on top of the relaxation toward the ground state with a 70 row time constant. The coherence then lasts 98 rows at the opening, 52 at 0.3, 22 at 0.6 and 9 at 1, relaxation included. At the opening the fringes run to the end of an experiment and a spin echo comes back with 0.57 of its colour; at 0.3 with a third; at 0.6 it is a faint blush; at 1 every column settles to a soft glow within a third of a flop, and the panel is the power-broadened line of a strongly dephased atom, a warm band over the middle columns on a dusky rose ground.

// What the picture is. Each of the 64 columns is the same qubit with its own detuning from the drive, from -0.98 to +0.98 of the edge detuning across the panel, with the resonant column a little off the middle
// in each experiment (up to 0.45 of the half width). Each pixel row is one moment. The newest row comes in at the top and the record falls down the panel at 10 rows a second, so 128 rows hold 12.8 s,
// and between two whole rows the colours are blended so the fall is smooth. The state in each column is a Bloch vector with a ground pole at the bottom of the sphere. Brightness and colour come from three numbers: the excited-state
// population P = (1 + z) / 2, the length of the transverse part rho = sqrt(x^2 + y^2) and its azimuth. P runs from indigo-black through violet and rose to orange and gold, and the azimuth tints it
// with a wheel of orange, magenta, violet and teal by rho, so a pure superposition on the equator is a vivid wheel colour, a state at the poles is plain black or gold whatever its phase, and a state that has dephased loses its wheel colour and keeps only the warm ramp.
// On resonance a drive of phase 0 turns the vector in the y-z plane, so the middle columns go black, violet or magenta on the way up, gold at the top and teal on the way down: two flanks of different colours, which is the phase of the coherence.
// The detuned columns turn about a tilted axis, so they rise less, flop faster and carry the azimuth round the whole wheel: the nested V's of Rabi's chevron are drawn in brightness and the rainbow in the flanks.
// Time runs up the panel, so the slowest fringe is the middle one and the chevron points up.
// An experiment is a list of segments, each a stretch of drive (amplitude, phase), a detuning of the drive that is constant, a ramp or a sine, or the fast relaxation of a reset, drawn at random when the one before has ended and never the same kind twice running:
//   constant drive, 20 percent: the drive on for 1.7 to 3.6 flops, at a random phase, then free;
//   pulse, wait, pulse, 20 percent: pi/2, a wait of 0.4 to 1 of the longest, pi/2 at a phase 0, pi or plus or minus pi/2 from the first. During the wait every column turns about the vertical axis by its own detuning, so the rainbow is a fan with hyperbolic bands; the second pulse
//   turns that phase into population, Ramsey's fringes, which then hang as vertical stripes while the state decays;
//   spin echo, 22 percent: pi/2, a wait, a pi pulse at 90 degrees from the first, the same wait, and in three runs in five a pi/2 read-out. The pi pulse mirrors every azimuth, so the fan runs back to one colour across the whole panel (an hourglass of bands) and the read-out turns that into a gold stripe across every column at once;
//   sweep, 20 percent: the drive frequency runs linearly through all the columns' resonances in 14 to 84 rows (aimed at a Landau-Zener parameter kappa = pi Omega^2 / (2 rate) of 0.35 to 4, which the 14 and 84 row limits can pull in: the front is bright and complete at 4, with 1 - e^-kappa of the atoms turned, and a faint partial one at 0.35), at 0.65 to 1.3 of the edge detuning, sometimes with a dwell and a sweep back. The front is a diagonal across the panel with ripples behind it,
//   and on the way back the two passages interfere;
//   oscillating detuning, 18 percent: a sine of 18 to 26 radians over the edge detuning in period (24 to 52 rows), amplitude 0.45 to 1.25 of it, two or three cycles under a swelling and fading envelope. Each cycle crosses each column's resonance twice and the crossings interfere: feathers and ferns.
// After the last pulse the state is held for 8 to 34 rows. Then comes a reset of 20 to 34 rows with the relaxation time cut from 70 rows to 9, so the panel goes back near black between experiments.
// The Bloch vector of a column is stepped with an exact rotation about the field vector (Omega cos phi, Omega sin phi, detuning minus the drive's detuning) for each substep, six a row, ten in the sweeps, with the drive averaged over the substep so a pulse's area is right wherever it starts and ends inside one; the relaxation after each. Sixty-four columns at ten rows a second is
// about four thousand rotations a second, and the opening runs the model for at least 300 rows (30 s) in one go so the panel starts with experiments already on it, stopping when the one in progress is between 55 and 90 percent done.
// Never a loop: each experiment draws its kind, its pulse phase, strength, off-centre resonance, coherence, waits and gaps at random, so the record does not come back to a picture it has shown.
// The 70 row relaxation time, the 9 row reset and the 10 rows a second are chosen to look right, not taken from a device.

const W = 64, H = 128;
const NR = 140; // rows of history kept in a ring
const RATE = 10; // rows a second the record scrolls
const { floor, sqrt, exp, log, sin, cos, atan2, pow, min, max, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const rr = (a, b) => a + (b - a) * rnd();

// column detuning in units of the edge detuning, -0.98 .. +0.98
const DX = new Float64Array(W);
for (let x = 0; x < W; x++) DX[x] = (x - 31.5) / 32;

// ---- colour. The azimuth of the Bloch vector goes round a wheel of five anchors,
// the population goes from indigo through dusky rose to gold, and the length of the
// transverse part of the vector says how much of the wheel colour the pixel carries.
const WHEEL = [
  [0.0, 255, 150, 64], // orange
  [0.25, 236, 64, 168], // magenta
  [0.5, 132, 84, 255], // violet
  [0.75, 40, 200, 204], // teal
];
const BASE = [
  [0.0, 6, 3, 24],
  [0.18, 34, 12, 78],
  [0.42, 140, 44, 112],
  [0.66, 250, 128, 78],
  [0.85, 255, 202, 112],
  [1.0, 255, 244, 196],
];
function rampAt(T, v, o, cyc) {
  let k = 0;
  while (k < T.length - 1 && v >= T[k + 1][0]) k++;
  if (!cyc && k === T.length - 1) { o[0] = T[k][1]; o[1] = T[k][2]; o[2] = T[k][3]; return; }
  const a = T[k], b = T[(k + 1) % T.length];
  const span = (k + 1 < T.length ? b[0] : 1) - a[0];
  const t = ss(0, 1, (v - a[0]) / span);
  o[0] = a[1] + (b[1] - a[1]) * t;
  o[1] = a[2] + (b[2] - a[2]) * t;
  o[2] = a[3] + (b[3] - a[3]) * t;
}

function buildLuts(S) {
  const a = TAU * S.hue, c = cos(a), s = sin(a);
  const m = [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
  const t = [0, 0, 0];
  const put = (lut, i) => {
    for (let q = 0; q < 3; q++) lut[i * 3 + q] = cl(m[q * 3] * t[0] + m[q * 3 + 1] * t[1] + m[q * 3 + 2] * t[2], 0, 255);
  };
  for (let i = 0; i < 256; i++) {
    rampAt(WHEEL, i / 256, t, true);
    put(S.wheel, i);
    rampAt(BASE, i / 255, t, false);
    put(S.base, i);
  }
  S.lutHue = S.hue;
}

function paint(S, P, rho, az, o) {
  const L = cl(P, 0, 1);
  const bi = ((pow(L, 0.85) * 255 + 0.5) | 0) * 3;
  const wi = (((az * 256) | 0) & 255) * 3;
  const b = 0.08 + 0.92 * ss(0, 0.62, L);
  const tint = 0.9 * pow(cl(rho, 0, 1), 1.15);
  const k = tint * b, j = 1 - tint;
  o[0] = S.base[bi] * j + S.wheel[wi] * k;
  o[1] = S.base[bi + 1] * j + S.wheel[wi + 1] * k;
  o[2] = S.base[bi + 2] * j + S.wheel[wi + 2] * k;
}

// ---- the experiment schedule. A segment is a stretch of time with a drive (amplitude d,
// phase ph), a detuning of the drive that is linear (m 1, f0 to f1) or a sine (m 2), in
// units of the edge detuning, and a flag for the fast relaxation that resets the qubit.
function seg(ex, dur, o) {
  const g = { a: ex.len, b: ex.len + dur, d: 0, ph: 0, m: 0, f0: 0, f1: 0, A: 0, per: 1, p2: 0, q: 1, rs: 0 };
  Object.assign(g, o);
  ex.segs.push(g);
  ex.len += dur;
  return g;
}

function planNext(S) {
  const de = S.de;
  // each experiment has its own drive strength, its own off-centre resonance and its own coherence
  const omf = rr(0.8, 1.3), Om = S.Om * omf;
  const ex = { segs: [], len: 0, kind: 0, nsub: 6, omf, off: rr(-0.45, 0.45) * (rnd() < 0.3 ? 0.25 : 1), gf: exp(rr(-0.45, 0.45)) };
  const w = [0.2, 0.2, 0.22, 0.2, 0.18];
  let kind = 0;
  for (let tries = 0; tries < 3; tries++) {
    let r = rnd() * 1;
    kind = 0;
    for (let i = 0; i < w.length; i++) {
      if (r < w[i]) { kind = i; break; }
      r -= w[i];
      kind = i;
    }
    if (kind !== S.lastKind) break;
  }
  S.lastKind = kind;
  ex.kind = kind;
  const ph0 = rnd() * TAU;
  const piHalf = (PI / 2) / Om, piDur = PI / Om;
  const waitMax = min(8.6 / de, 56);
  if (kind === 0) { // constant drive: the chevron
    const per = TAU / Om;
    const L = cl(rr(1.7, 3.6) * per, 40, 112);
    seg(ex, L, { d: rr(0.85, 1.2), ph: ph0 });
    seg(ex, rr(8, 22), {});
  } else if (kind === 1) { // pulse, wait, pulse
    const T = rr(0.4, 1) * waitMax;
    seg(ex, piHalf, { d: 1, ph: ph0 });
    seg(ex, max(T, 12), {});
    const q = rnd();
    seg(ex, piHalf, { d: 1, ph: ph0 + (q < 0.45 ? 0 : q < 0.6 ? PI : q < 0.8 ? PI / 2 : -PI / 2) });
    seg(ex, rr(14, 34), {});
  } else if (kind === 2) { // spin echo
    const T = max(rr(0.45, 1) * waitMax, 14);
    seg(ex, piHalf, { d: 1, ph: ph0 });
    seg(ex, T, {});
    seg(ex, piDur, { d: 1, ph: ph0 + PI / 2 });
    seg(ex, T, {});
    if (rnd() < 0.62) seg(ex, piHalf, { d: 1, ph: ph0 });
    seg(ex, rr(10, 26), {});
  } else if (kind === 3) { // chirped sweep through resonance, once or there and back
    ex.nsub = 10;
    const dir = rnd() < 0.5 ? 1 : -1;
    const amp = rr(0.85, 1.2);
    const fr = rr(0.65, 1.3);
    const f0 = fr * dir;
    // Landau-Zener parameter kappa = pi Om^2 / (2 rate): the chance the passage is adiabatic is 1 - exp(-kappa)
    const kappa = exp(rr(log(0.35), log(4)));
    const Ts = cl((1.27 * fr * kappa * de) / ((amp * Om) * (amp * Om)), 14, 84);
    seg(ex, Ts, { d: amp, ph: ph0, m: 1, f0: -f0, f1: f0 });
    if (rnd() < 0.45) {
      const dwell = rr(0, 12);
      if (dwell > 1) seg(ex, dwell, { d: amp, ph: ph0, m: 1, f0: f0, f1: f0 });
      seg(ex, Ts * rr(0.8, 1.2), { d: amp, ph: ph0, m: 1, f0: f0, f1: -f0 });
    }
    seg(ex, rr(8, 22), {});
  } else { // strong oscillating detuning: Stueckelberg
    ex.nsub = 10;
    const per = cl(rr(18, 26) / de, 24, 52);
    const n = per > 40 ? 2 : floor(rr(2.4, 3.6));
    seg(ex, n * per, { d: rr(0.9, 1.25), ph: ph0, m: 2, A: rr(0.45, 1.25), per, p2: rnd() * TAU, q: rr(0.5, 1.6) });
    seg(ex, rr(8, 22), {});
  }
  seg(ex, rr(20, 34), { rs: 1 });
  S.ex = ex;
}

function ctl(ex, ta, tb, o) {
  let ox = 0, oy = 0, c = 0, rs = 0;
  const h = tb - ta;
  for (let i = 0; i < ex.segs.length; i++) {
    const g = ex.segs[i];
    const lo = ta > g.a ? ta : g.a, hi = tb < g.b ? tb : g.b;
    if (hi <= lo) continue;
    const f = (hi - lo) / h, tm = 0.5 * (lo + hi);
    if (g.d) { ox += f * g.d * cos(g.ph); oy += f * g.d * sin(g.ph); }
    if (g.m === 1) c += f * (g.f0 + ((g.f1 - g.f0) * (tm - g.a)) / (g.b - g.a));
    else if (g.m === 2) {
      const u = (tm - g.a) / (g.b - g.a);
      c += f * g.A * pow(sin(PI * u), g.q) * sin(TAU * (tm - g.a) / g.per + g.p2);
    }
    if (g.rs) rs += f;
  }
  o.ox = ox; o.oy = oy; o.c = c; o.rs = rs;
}

const T1RUN = 70, T1RESET = 9;

function stepRow(S) {
  if (!S.ex || S.tau >= S.ex.len) {
    const carry = S.ex ? S.tau - S.ex.len : 0;
    planNext(S);
    S.tau = carry;
  }
  const ex = S.ex, N = ex.nsub, h = 1 / N, o = S.o;
  const Om = S.Om, de = S.de, gp = S.gp;
  const U = S.u, V = S.v, Z = S.z;
  for (let s = 0; s < N; s++) {
    const ta = S.tau + s * h, tb = ta + h;
    ctl(ex, ta, tb, o);
    const wx = o.ox * Om * ex.omf, wy = o.oy * Om * ex.omf, cc = o.c * de;
    const r1 = (1 - o.rs) / T1RUN + o.rs / T1RESET;
    const ez = exp(-r1 * h), ep = exp(-(gp * ex.gf + 0.5 * r1) * h);
    for (let x = 0; x < W; x++) {
      const wz = de * (DX[x] - ex.off) - cc;
      const w2 = wx * wx + wy * wy + wz * wz;
      let bx = U[x], by = V[x], bz = Z[x];
      if (w2 > 1e-14) {
        const wn = sqrt(w2), th = wn * h, ct = cos(th), st = sin(th) / wn;
        const dot = (wx * bx + wy * by + wz * bz) * (1 - ct) / w2;
        const nx = bx * ct + (wy * bz - wz * by) * st + wx * dot;
        const ny = by * ct + (wz * bx - wx * bz) * st + wy * dot;
        const nz = bz * ct + (wx * by - wy * bx) * st + wz * dot;
        bx = nx; by = ny; bz = nz;
      }
      U[x] = bx * ep; V[x] = by * ep; Z[x] = -1 + (bz + 1) * ez;
    }
  }
  S.tau += 1;
  // one finished row of the record
  const row = (S.rowN % NR) * W, tmp = S.tmp;
  for (let x = 0; x < W; x++) {
    const P = 0.5 * (1 + Z[x]), rho = sqrt(U[x] * U[x] + V[x] * V[x]);
    let az = atan2(V[x], U[x]) / TAU;
    az -= floor(az);
    S.hp[row + x] = P; S.hr[row + x] = rho; S.ha[row + x] = az;
    paint(S, P, rho, az, tmp);
    const i = (row + x) * 3;
    S.rgb[i] = tmp[0]; S.rgb[i + 1] = tmp[1]; S.rgb[i + 2] = tmp[2];
  }
  S.rowN++;
}

function repaint(S) {
  buildLuts(S);
  const tmp = S.tmp;
  const n0 = max(0, S.rowN - NR);
  for (let n = n0; n < S.rowN; n++) {
    const row = (n % NR) * W;
    for (let x = 0; x < W; x++) {
      paint(S, S.hp[row + x], S.hr[row + x], S.ha[row + x], tmp);
      const i = (row + x) * 3;
      S.rgb[i] = tmp[0]; S.rgb[i + 1] = tmp[1]; S.rgb[i + 2] = tmp[2];
    }
  }
}

export function setup(params) {
  const S = {
    ready: false, rowN: 0, th: 0, tau: 0, ex: null, lastKind: -1,
    u: new Float64Array(W), v: new Float64Array(W), z: new Float64Array(W).fill(-1),
    hp: new Float32Array(NR * W), hr: new Float32Array(NR * W), ha: new Float32Array(NR * W),
    rgb: new Float32Array(NR * W * 3),
    wheel: new Float32Array(256 * 3), base: new Float32Array(256 * 3), lutHue: -1,
    tmp: [0, 0, 0], o: { ox: 0, oy: 0, c: 0, rs: 0 },
    hue: 0, Om: 0.22, de: 0.36, gp: 0.0041,
  };
  params.s = S;
}

function knobs(S, k) {
  S.hue = cl(k[0] || 0, 0, 1);
  S.Om = 0.11 * cl(k[1] == null ? 2 : k[1], 0.8, 3.5);
  S.de = 0.36 * exp(0.8 * cl(k[2] || 0, -1, 1));
  const d = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  S.gp = 0.003 + 0.1 * d * d;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  knobs(S, input.knobValues || [0, 2, 0, 0.06]);
  if (!S.ready) {
    buildLuts(S);
    S.ready = true;
    // run a few experiments already: stop when the one in progress is well on its way
    let guard = 0;
    while (guard < 700 && (S.rowN < 300 || !S.ex || S.tau / S.ex.len < 0.55 || S.tau / S.ex.len > 0.9)) { stepRow(S); guard++; }
    S.th = S.rowN - 2;
  }
  const d = cl(dt || 0, 0, 0.1);
  if (S.lutHue !== S.hue) repaint(S);
  S.th += d * RATE;
  while (S.rowN <= floor(S.th) + 1) stepRow(S);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const C = S.rgb;
  for (let y = 0; y < H; y++) {
    const s = S.th - y, n0 = floor(s), f = s - n0;
    const a = (n0 % NR) * W * 3, b = ((n0 + 1) % NR) * W * 3, g = 1 - f;
    for (let x = 0; x < W; x++) {
      const i = x * 3;
      display.setPixel(
        x, y,
        (C[a + i] * g + C[b + i] * f + 0.5) | 0,
        (C[a + i + 1] * g + C[b + i + 1] * f + 0.5) | 0,
        (C[a + i + 2] * g + C[b + i + 2] * f + 0.5) | 0,
      );
    }
  }
}
