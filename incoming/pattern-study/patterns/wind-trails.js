// ===== Patternflow pattern =====
// Title:   Wind Trails
// Family:  particle
// Idea:    About 3,000 particles ride an incompressible flow of a mean wind, three meandering jets, five Rossby waves and six drifting eddies, each leaving a trail that dims along its length, so the panel is combed by streaks from sky blue through violet to amber that turn white where the air is fastest, and no frame comes round again.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: wind-map particle trails (Fernanda Viegas and Martin Wattenberg, 2012, from memory) in a stream-function flow u = (dpsi/dy, -dpsi/dx), incompressible by construction, with Rossby waves on a beta plane (Carl-Gustaf Rossby, 1939, from memory), Gaussian-stream-function eddies, and an open box fed at the incoming flux with the age law of a steady stock so the density stays even
// Round:   114
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Wind=0.2..3, Scale=-1..1, Trail=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel, and one full turn comes back to where it began; the palette also drifts by up to 0.045 of a turn by itself, so the blue end moves between cyan and blue and the amber end between orange and gold. At 0 air heading east and a little down the panel, the way the mean wind blows, is sky blue, air heading the other way is amber, the turns between are violet, and the fastest air goes white whatever the hue. At 0.25 the blue end is purple and the amber end green, at 0.5 orange and azure, at 0.75 green and magenta.
// Knob 2: Wind. How fast everything runs, particles and waves and jets and eddies together, at Wind over 2 times the speed at the opening. At 2 the median particle moves 5.2 LEDs a second, one in ten moves faster than 9.5, and the fastest spot in ten minutes was 23; at 0.2 it is a tenth of that and at 3 half as much again. Trails are measured in flow time too, so a slower wind is the same picture in slow motion, not a blurred one.
// Knob 3: Scale. Multiplies every wavelength by 2 to the knob. At 0 the five waves are 36 to 78 LEDs long, the three jets 39 to 101 across the panel and the eddies 4.5 to 8 LEDs in radius; at -1 the waves and jets are half that and the eddies 0.6 of it, a crowd of small eddies, and at 1 the waves and jets are twice that and the eddies 1.6, one or two great currents across the panel. Speeds stay put, but long Rossby waves slide west faster: the 78 LED wave at 2.2 LEDs a second, the same wave stretched to 156 LEDs at 13.
// Knob 4: Trail. How long a particle's light lingers, fading with an e-folding time of 0.9 times 3 to the knob, in flow seconds: 0.3 at -1, 0.96 at the opening 0.06 and 2.7 at 1. At the median speed that is a streak of 1.6 LEDs, then 5, then 14. Each particle deposits in proportion to the inverse of that time, so the mean brightness stays and only the grain changes, dust at -1 and silk at 1.

const W = 64, H = 128;
const { floor, min, max, sqrt, sin, cos, exp, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (p) => p - TAU * floor(p / TAU);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// Coordinates are LEDs, x to the right and y down, with the origin at the panel's centre.
const CX = (W - 1) / 2, CY = (H - 1) / 2;

// ---- the stream function --------------------------------------------------------------------
// psi(x, y, t) is a mean wind, three meandering jets, five Rossby waves and six eddies that
// drift across and fade. The velocity is u = (dpsi/dy, -dpsi/dx), so every term has div u = 0
// by itself and the sum has it too. Speeds are LEDs per model second, and one model second is
// one panel second at Wind 2. No time value is ever wrapped to a period. The slow oscillators
// run on rates picked so that no two come near a small integer ratio (of the 38 rates the
// closest pair is 0.01 % off 9:2, a beat of 17 days), and the eddies draw a new place, size,
// sign and drift for every pass.

// Mean wind: speed U0, heading AL0 (a little below east) plus two slow swings.
const U0 = 2.4, AL0 = 0.3;

// Jets: psi = (A / k) sin(k y + d + b sin(q x + z)). That is a zonal current A cos(k y + ...)
// that meanders by b / k LEDs. The wavelength across the panel and along it, the speed, the
// meander depth in radians, the drift rates of the two phases in turns per second and the two
// rates that modulate the speed.
const JLAM = [101, 62, 39], JLAMX = [131, 83, 57], JA = [3.4, 2.4, 1.6], JB = [1.15, 0.95, 0.8];
const JD = [0.0114, -0.0155, 0.0245], JZ = [-0.0143, -0.0219, -0.0337];
const JM1 = [0.0237, 0.0311, 0.0167], JM2 = [0.0093, 0.0077, 0.0127];

// Rossby waves: psi = B cos(kx x + ky y + phase). The phase runs at the beta-plane relation
// w = UC kx - BETA kx / k^2 (Carl-Gustaf Rossby, 1939, from memory), so long waves slide west
// against the wind and short ones are carried east. UC and BETA are chosen for the picture.
// Wavelength, heading in radians, speed amplitude and two modulation rates in rad/s.
const UC = 1.5, BETA = 0.024;
const WLAM = [78, 58, 66, 41, 36], WANG = [0.5, 2.0, 3.5, 1.2, 2.9], WA = [3.0, 2.4, 2.0, 1.7, 1.4];
const WM1 = [0.0131, 0.0097, 0.0173, 0.0089, 0.0211], WM2 = [0.0047, 0.0061, 0.0029, 0.0071, 0.0043];

// Eddies: psi = G exp(-r^2 / 2 s^2), a vortex whose flow peaks at r = s and is gone by r = 3 s.
// Each of the NV slots lives one pass of TV[v] model seconds, growing and fading as sin^2 while
// it drifts. The radius s grows as Scale to the 0.7, a little slower than the waves.
const NV = 6, TV = [31, 43, 53, 37, 47, 59];

// ---- the particles --------------------------------------------------------------------------
// They live in a box MG LEDs wider than the panel on every side. A particle leaves the box or
// dies of age; both free its slot. Density RHO per LED^2 stays even because (1) births are
// uniform in space at the rate that replaces the stock once per mean lifetime, and (2) air
// enters through the box edge at the incoming flux RHO * max(0, u.n), as particles whose age
// and lifetime are drawn the way a steady stock has them (lifetime weighted by its length,
// age uniform inside it). For an incompressible flow a uniform density then solves the
// continuity equation exactly, so the only unevenness left is the shot noise of the births.
const MG = 2, X0 = -MG, X1 = W - 1 + MG, Y0 = -MG, Y1 = H - 1 + MG;
const AREA = (X1 - X0) * (Y1 - Y0);
const RHO = 0.34;
const L1 = 3.5, L2 = 9; // lifetime, model seconds, uniform between
const FIN = 0.9, FOUT = 1.3; // fade in and out, model seconds
const N0 = Math.round(RHO * AREA), CAP = Math.round(N0 * 1.5) + 64;
const EL = (L1 + L2) / 2;
const SUB = 0.05; // longest model time between two moves of a particle

// Colour: heading picks a place on a ramp from azure through violet to amber, and the fastest
// air goes white. Hue, saturation and value of the three anchors at Hue 0.
const ANCH = [[0.55, 0.8, 1], [0.77, 0.6, 1], [0.09, 0.85, 1]];
// Speed that turns white as a multiple of the panel's rms speed (about 6 LEDs/s, followed with a
// 20 s memory so a swell of the whole flow does not blow the picture out), the light one particle
// deposits, and the tone curve of the buffer. The exposure is nudged so the mean luma of what is
// shown settles at LM0 (of 255) with an EMEM second memory. A spell of calm or of strong air then
// does not dim the panel or wash it out, and it stays between 0.6 and 1.8 times the base.
const VWHITE = 2, VMEM = 20, QK = 2.2, GAIN = 2.4, TOE = 0.22, LM0 = 24, EMEM = 10;
const OPEN = [0, 2, 0, 0.06];
const PRE = 60; // frames run before the first one is shown, so the trails stand at once

function sizeBiasedLife() {
  for (;;) {
    const l = L1 + (L2 - L1) * Math.random();
    if (Math.random() * L2 < l) return l;
  }
}

// ---- field evaluation -----------------------------------------------------------------------
let VU = 0, VV = 0;
function vel(F, x, y) {
  const X = x - CX, Y = y - CY;
  let u = F.wu, v = F.wv;
  for (let m = 0; m < 3; m++) {
    const z = F.jq[m] * X + F.jz[m], a = F.ja[m] * cos(F.jk[m] * Y + F.jd[m] + F.jb[m] * sin(z));
    u += a;
    v -= a * F.jr[m] * cos(z);
  }
  for (let n = 0; n < 5; n++) {
    const s = sin(F.wkx[n] * X + F.wky[n] * Y + F.wp[n]);
    u += F.wax[n] * s;
    v += F.wbx[n] * s;
  }
  for (let n = 0; n < NV; n++) {
    const g = F.eg[n];
    if (g === 0) continue;
    const dx = X - F.ex[n], dy = Y - F.ey[n], e = g * exp(-(dx * dx + dy * dy) * F.eh[n]);
    u -= e * dy;
    v += e * dx;
  }
  VU = u;
  VV = v;
}

function newFlow() {
  const F = { wu: 0, wv: 0 };
  for (const k of ["jk", "jd", "jz", "jq", "ja", "jb", "jr"]) F[k] = new Float64Array(3);
  for (const k of ["wkx", "wky", "wp", "wax", "wbx"]) F[k] = new Float64Array(5);
  for (const k of ["eg", "ex", "ey", "eh"]) F[k] = new Float64Array(NV);
  return F;
}

// A new pass for eddy slot v: most drift roughly with the wind, some against it.
function newPass(S, v) {
  const r = Math.random, dir = r() < 0.7 ? S.al + (r() + r() + r() - 1.5) * 1.2 : r() * TAU, sp = 0.5 + 2 * r();
  S.eq[v] = {
    x: (r() - 0.5) * 50, y: (r() - 0.5) * 110, vx: sp * cos(dir), vy: sp * sin(dir),
    sig: 4.5 + 3.5 * r(), pk: 5 + 3.5 * r(), sg: r() < 0.5 ? -1 : 1,
  };
}

// Fill F for this frame from the state, and the phase rates S.wom.
function prepare(S) {
  const F = S.F, tau = S.tau, s = S.s;
  S.al = AL0 + 0.9 * sin(0.0137 * tau + 1.1) + 0.55 * sin(0.0059 * tau + 4.0);
  F.wu = U0 * cos(S.al);
  F.wv = U0 * sin(S.al);
  for (let m = 0; m < 3; m++) {
    F.jk[m] = TAU / (JLAM[m] * s);
    F.jq[m] = TAU / (JLAMX[m] * s);
    F.jd[m] = S.jd[m];
    F.jz[m] = S.jz[m];
    F.jb[m] = JB[m];
    F.jr[m] = (JB[m] * F.jq[m]) / F.jk[m];
    F.ja[m] = JA[m] * (1 + 0.55 * sin(JM1[m] * tau + 1.7 * m) + 0.3 * sin(JM2[m] * tau + 2.9 * m + 0.5));
  }
  for (let n = 0; n < 5; n++) {
    const k = TAU / (WLAM[n] * s), kx = k * cos(WANG[n]), ky = k * sin(WANG[n]);
    const b = (WA[n] * (1 + 0.55 * sin(WM1[n] * tau + 1.3 * n) + 0.3 * sin(WM2[n] * tau + 2.1 * n + 0.7))) / k;
    F.wkx[n] = kx;
    F.wky[n] = ky;
    F.wp[n] = S.wp[n];
    F.wax[n] = -b * ky;
    F.wbx[n] = b * kx;
    S.wom[n] = UC * kx - (BETA * kx) / (k * k);
  }
  for (let v = 0; v < NV; v++) {
    const q = S.eq[v], ph = S.ep[v], e = sin(PI * ph) ** 2, sg = q.sig * pow(s, 0.7);
    F.ex[v] = q.x + q.vx * (ph - 0.5) * TV[v];
    F.ey[v] = q.y + q.vy * (ph - 0.5) * TV[v];
    F.eh[v] = 1 / (2 * sg * sg);
    // peak speed pk at r = s is G / s * exp(-1/2), so G / s^2 = pk / (0.6065 s)
    F.eg[v] = e < 1e-4 ? 0 : (q.sg * q.pk * e) / (0.6065 * sg);
  }
}

function spawn(S, x, y, age, life) {
  if (!S.nfree) return;
  const j = S.free[--S.nfree];
  S.alive[j] = 1;
  S.px[j] = x;
  S.py[j] = y;
  S.age[j] = age;
  S.life[j] = life;
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const S = {
    tau: 0, s: 1, al: AL0, births: 0, vr: 0, ex: 1, ft: 1 / 30,
    F: newFlow(),
    jd: new Float64Array(3), jz: new Float64Array(3), wp: new Float64Array(5), wom: new Float64Array(5),
    ep: new Float64Array(NV), eq: [],
    px: new Float64Array(CAP), py: new Float64Array(CAP), age: new Float64Array(CAP), life: new Float64Array(CAP),
    alive: new Uint8Array(CAP), free: new Int32Array(CAP), nfree: 0,
    buf: new Float32Array(W * H * 3), ramp: new Float32Array(256 * 3), seg: [],
  };
  for (let m = 0; m < 3; m++) (S.jd[m] = Math.random() * TAU), (S.jz[m] = Math.random() * TAU);
  for (let n = 0; n < 5; n++) S.wp[n] = Math.random() * TAU;
  for (let v = 0; v < NV; v++) (S.ep[v] = Math.random()), newPass(S, v);
  // Inflow segments about two LEDs long along the four edges of the box, with inward normals.
  const edge = (xa, ya, xb, yb, nx, ny) => {
    const len = Math.hypot(xb - xa, yb - ya), n = Math.round(len / 2);
    for (let i = 0; i < n; i++) {
      const c = (i + 0.5) / n;
      S.seg.push({ x: xa + (xb - xa) * c, y: ya + (yb - ya) * c, nx, ny, ds: len / n, tx: (xb - xa) / len, ty: (yb - ya) / len, acc: Math.random() });
    }
  };
  edge(X0, Y0, X0, Y1, 1, 0);
  edge(X1, Y0, X1, Y1, -1, 0);
  edge(X0, Y0, X1, Y0, 0, 1);
  edge(X0, Y1, X1, Y1, 0, -1);
  for (let i = CAP - 1; i >= 0; i--) S.free[S.nfree++] = i;
  // The first stock is a steady one: uniform in space, lifetime weighted by length, age uniform inside it.
  for (let i = 0; i < N0; i++) {
    const l = sizeBiasedLife();
    spawn(S, X0 + (X1 - X0) * Math.random(), Y0 + (Y1 - Y0) * Math.random(), l * Math.random(), l);
  }
  prepare(S);
  for (let i = 0; i < PRE; i++) advance(S, 1 / 30, OPEN);
  params.s = S;
}

// One panel frame of ft seconds with the knobs in k.
function advance(S, ft, k) {
  const wind = cl(k[1], 0.2, 3), h = (ft * wind) / 2;
  S.s += (pow(2, cl(k[2], -1, 1)) - S.s) * (1 - exp(-ft / 0.3));
  S.tau += h;
  const tr = 0.9 * pow(3, cl(k[3], -1, 1)); // trail e-folding time, model seconds
  // The whole palette also drifts up to 0.045 of a turn either way, on two slow swings.
  const hue = cl(k[0], 0, 1) + 0.025 * sin(0.0073 * S.tau + 2) + 0.02 * sin(0.0113 * S.tau + 0.4);
  const A = [];
  for (const a of ANCH) {
    const c = [0, 0, 0];
    hsv(a[0] + hue, a[1], a[2], c, 0);
    A.push(c);
  }
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * 2, j = t < 1 ? 0 : 1, f = t - j;
    for (let c = 0; c < 3; c++) S.ramp[i * 3 + c] = A[j][c] + (A[j + 1][c] - A[j][c]) * f;
  }
  prepare(S);
  // The phases keep their value by summing, so a change of Scale or Wind never makes one jump.
  for (let m = 0; m < 3; m++) {
    S.jd[m] = wrap(S.jd[m] + TAU * JD[m] * h);
    S.jz[m] = wrap(S.jz[m] + TAU * JZ[m] * h);
  }
  for (let n = 0; n < 5; n++) S.wp[n] = wrap(S.wp[n] - S.wom[n] * h);
  for (let v = 0; v < NV; v++) {
    S.ep[v] += h / TV[v];
    if (S.ep[v] >= 1) {
      S.ep[v] -= 1;
      newPass(S, v);
    }
  }
  const F = S.F, buf = S.buf, decay = exp(-h / tr);
  // rms speed over 40 random places, remembered for VMEM seconds
  let e2 = 0;
  for (let i = 0; i < 40; i++) {
    vel(F, (W - 1) * Math.random(), (H - 1) * Math.random());
    e2 += VU * VU + VV * VV;
  }
  const rms = sqrt(e2 / 40);
  S.vr = S.vr ? S.vr + (rms - S.vr) * (1 - exp(-h / VMEM)) : rms;
  for (let i = 0; i < buf.length; i++) buf[i] *= decay;
  S.ft = ft;
  // The field is held for the frame; a particle moves by midpoint steps no longer than SUB.
  const ns = Math.ceil(h / SUB), hh = h / ns, q0 = (QK * hh) / tr, vw = VWHITE * S.vr;
  // The colour ramp is read along a heading that wanders slowly.
  const ref = PI + 0.3 + 0.3 * sin(0.0121 * S.tau + 1), cr = cos(ref), sr = sin(ref);
  for (let j = 0; j < ns; j++) move(S, hh, q0, cr, sr, vw);
  // Births: uniform ones hold the density, the inflow keeps the edges as full as the middle.
  S.births += (RHO * AREA * h) / EL;
  while (S.births >= 1) {
    S.births -= 1;
    spawn(S, X0 + (X1 - X0) * Math.random(), Y0 + (Y1 - Y0) * Math.random(), 0, L1 + (L2 - L1) * Math.random());
  }
  for (const g of S.seg) {
    vel(F, g.x, g.y);
    const un = VU * g.nx + VV * g.ny;
    if (un <= 0) continue;
    g.acc += RHO * un * g.ds * h;
    while (g.acc >= 1) {
      g.acc -= 1;
      const l = sizeBiasedLife(), t = (Math.random() - 0.5) * g.ds, d = Math.random() * un * h;
      spawn(S, g.x + g.tx * t + g.nx * d, g.y + g.ty * t + g.ny * d, l * Math.random(), l);
    }
  }
}

// Move every particle by hh, deposit the light of the step along its path.
function move(S, hh, q0, cr, sr, vw) {
  const F = S.F, { px, py, age, life, alive, free, buf, ramp } = S;
  for (let i = 0; i < CAP; i++) {
    if (!alive[i]) continue;
    const x = px[i], y = py[i];
    vel(F, x, y);
    vel(F, x + 0.5 * hh * VU, y + 0.5 * hh * VV);
    const u = VU, v = VV, nx = x + hh * u, ny = y + hh * v, a = age[i] + hh;
    if (a >= life[i] || nx < X0 || nx > X1 || ny < Y0 || ny > Y1) {
      alive[i] = 0;
      free[S.nfree++] = i;
      continue;
    }
    px[i] = nx;
    py[i] = ny;
    age[i] = a;
    // Light tapers in and out over the particle's life; slow air is dim, fast air bright and white.
    const sp = sqrt(u * u + v * v) + 1e-9, ri = ((0.5 + (0.5 * (u * cr + v * sr)) / sp) * 255) | 0;
    const wm = sm((sp / vw - 0.7) / 0.5) * 0.85;
    const lvl = (0.5 + 0.5 * min(1, sp / vw)) * sm(a / FIN) * sm((life[i] - a) / FOUT) * q0;
    const r0 = ramp[ri * 3], g0 = ramp[ri * 3 + 1], b0 = ramp[ri * 3 + 2];
    const R = (r0 + (1 - r0) * wm) * lvl, G = (g0 + (1 - g0) * wm) * lvl, B = (b0 + (1 - b0) * wm) * lvl;
    const len = sqrt((nx - x) * (nx - x) + (ny - y) * (ny - y)), n = 1 + floor(len / 0.7), inv = 1 / n;
    for (let j = 1; j <= n; j++) {
      const t = j * inv, sx = x + (nx - x) * t, sy = y + (ny - y) * t, ix = floor(sx), iy = floor(sy), fx = sx - ix, fy = sy - iy;
      for (let dy = 0; dy < 2; dy++) {
        const yy = iy + dy;
        if (yy < 0 || yy >= H) continue;
        const wy = dy ? fy : 1 - fy;
        for (let dx = 0; dx < 2; dx++) {
          const xx = ix + dx;
          if (xx < 0 || xx >= W) continue;
          const ww = (dx ? fx : 1 - fx) * wy * inv, o = (yy * W + xx) * 3;
          buf[o] += R * ww;
          buf[o + 1] += G * ww;
          buf[o + 2] += B * ww;
        }
      }
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  advance(params.s, cl(dt || 0, 0, 0.1), input.knobValues || OPEN);
}

// The buffer holds light; one curve takes it to the LED with a toe, so the gaps stay dark.
const LUTN = 2048, LUT = new Uint8Array(LUTN + 1);
for (let i = 0; i <= LUTN; i++) LUT[i] = Math.round(255 * (1 - exp(-GAIN * max(0, (i / LUTN) * 4 - TOE))));

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, sc = (LUTN / 4) * S.ex;
  let lum = 0;
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) {
      const r = buf[o] * sc, g = buf[o + 1] * sc, b = buf[o + 2] * sc;
      const R = LUT[r > LUTN ? LUTN : r | 0], G = LUT[g > LUTN ? LUTN : g | 0], B = LUT[b > LUTN ? LUTN : b | 0];
      lum += 0.299 * R + 0.587 * G + 0.114 * B;
      display.setPixel(x, y, R, G, B);
    }
  S.ex = cl(S.ex * exp((S.ft / EMEM) * Math.log(LM0 / max(1, lum / (W * H)))), 0.6, 1.8);
}
