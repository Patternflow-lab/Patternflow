// ===== Patternflow pattern =====
// Title:   Magnetron Spokes
// Family:  magnetron
// Idea:    A cavity magnetron cut open along its angle and unrolled, with the hot cathode as a violet hub along the bottom edge and the anode along the top: electrons drifting in crossed fields gather into bright curved spokes that rise from the hub, turn sideways in lockstep with the radio-frequency wave, and splash amber flashes on the anode where they land.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the cavity magnetron (John Randall and Harry Boot, 1940, from memory); the Hull cut-off and the Hartree condition for synchronism between the drifting electrons and the wave (Albert Hull, 1921, and Douglas Hartree, 1941, from memory); electron spokes in the hub model of the magnetron (Leon Brillouin, 1945, and John Slater, 1950, from memory); the guiding-centre drift in the frame of the wave is original here, pattern round 249
// Round:   249
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drive=0..4, Spokes=-1..2, Voltage=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel; it opens on electric violet at the hub going to cyan at the spoke tips, with amber flashes on the anode.
// Knob 2: Drive. 0 to 4, opening at 2. How hard the radio-frequency wave pushes the electrons: at 0 there is no wave and only the hub spins with a dim halo of stray electrons, at 2 a spoke is a clear curved streak, at 4 the spokes are fat and the anode flashes run together.
// Knob 3: Spokes. -1 to 2, opening at 0. The number of spokes, 3 at -1, 4 at 0 and 6 at 2; between whole numbers the arms slide and split instead of jumping.
// Knob 4: Voltage. -1 to 1, opening at 0.06. The anode voltage against the Hartree threshold: at -1 the spokes stall part way up and never reach the anode, near 0 they just touch it, and at 1 they fatten into the anode and the flashes become a bright band.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sqrt, exp, log, sin, cos, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TP = 2 * PI;

const RA = 0.28, RB = 1;          // cathode and anode radius
const LN = log(RB / RA);
const RH = 0.5;                   // the hub edge, where the electrons are let out
const NT = 720;                   // tracer electrons
const TS = 4.5;                   // seconds of the panel to one unit of model time at the opening
const LEAN = 0.4;
const YP = 1.45;                  // row = 127 (1 - rho^YP): the hub gets about 23 rows
const SX = 1.25, SY = 1.6;         // footprint of a tracer, in LED
const TD = 0.25;                  // seconds a streak of light takes to fade
const TF = 0.4;                   // seconds an anode flash takes to fade
const KDEP = 3.2;                 // light a tracer drops in a second
const GAIN = 0.75;
const NSEC = 24;                  // sectors round the wave frame for the slow wandering fields
const TFLD = 11;                  // seconds a sector keeps its mood

// ---- state ---------------------------------------------------------------
export function setup(params) {
  const tw = (a, b) => a + (b - a) * rnd();
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, off: tw(0, TP),
    ph: new Float64Array(10).map(() => tw(0, TP)),
    r: new Float32Array(NT), th: new Float32Array(NT), age: new Float32Array(NT), life: new Float32Array(NT),
    x0: new Float32Array(NT), y0: new Float32Array(NT), live: new Uint8Array(NT),
    D: new Float32Array(W * H), E: new Float32Array(W * H),
    F: [0, 1, 2, 3].map(() => new Float32Array(NSEC).map(() => 0.9 * (rnd() + rnd() + rnd() - 1.5))), gn: 1, pm: 0, pm2: 0, pm3: 0, lean: LEAN, P: { V: 1.3, A: 1.5, q: 1.4, wide: 0, m: 4, w: 0, n: 4, p1: 0, p2: 0 },
    o: [0, 0], wx: new Float32Array(16), wy: new Float32Array(8),
  });
  for (let i = 0; i < NT; i++) spawn(st, i, true);
  return st;
}

function spawn(st, i, anywhere) {
  st.r[i] = RH * (1 + 0.1 * (rnd() + rnd() - 1) + (rnd() < 0.2 ? 0.25 * rnd() : 0));
  st.th[i] = rnd() * TP;
  st.life[i] = 0.9 + 1.2 * rnd();
  st.age[i] = anywhere ? rnd() * st.life[i] : 0;
  st.live[i] = 1;
  st.x0[i] = -1;
}

// ---- the drift -------------------------------------------------------------
// In the frame that turns with the wave, an electron's guiding centre follows the level sets of
//   psi = V ln(r/a)/ln(b/a) + R(r, th) - r^2/2        (the wave turns at 1)
// dr/dt = -(1/r) dpsi/dth,  dth/dt = (1/r) dpsi/dr. R is the wave, a mix of cos(m th) and cos((m+1) th).
function rhs(r, th, P, out) {
  const rho = r / RB;
  const rm = pow(rho, P.m);
  const a1 = P.m * th + P.p1, a2 = (P.m + 1) * th + P.p2;
  const w1 = (1 - P.w) * P.m * rm, w2 = P.w * (P.m + 1) * rm * rho;
  const S = w1 * sin(a1) + w2 * sin(a2);
  const C = w1 * cos(a1) + w2 * cos(a2);
  out[0] = (P.A * S) / r;
  out[1] = P.V / (r * r * LN) - 1 + (P.A * C) / (r * r);
}

const k1 = [0, 0], k2 = [0, 0], k3 = [0, 0], k4 = [0, 0];
function rk4(st, i, h) {
  const P = st.P;
  let r = st.r[i], th = st.th[i];
  rhs(r, th, P, k1);
  rhs(r + 0.5 * h * k1[0], th + 0.5 * h * k1[1], P, k2);
  rhs(r + 0.5 * h * k2[0], th + 0.5 * h * k2[1], P, k3);
  rhs(r + h * k3[0], th + h * k3[1], P, k4);
  r += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
  th += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  st.r[i] = r;
  st.th[i] = th;
}

// ---- knobs to model --------------------------------------------------------
function setParams(st) {
  const kn = st.k, t = st.t, ph = st.ph, P = st.P;
  const drive = cl(kn[1], 0, 4);
  const spokes = 4 + cl(kn[2], -1, 2);
  const m = min(floor(spokes + 1e-6), 7);
  P.m = m;
  // a trace of the next mode comes and goes, so the spokes are never quite alike and the arms now and then split
  P.w = m >= 7 ? 0 : cl(spokes - m + (0.11 + 0.1 * sin(0.047 * t + ph[6])) * (0.55 + 0.45 * sin(0.0171 * t + ph[2])), 0, 1);
  const vr = exp(0.62 * (cl(kn[3], -1, 1) + 0.2)) * (1 + 0.06 * sin(0.0173 * t + ph[2]) + 0.04 * sin(0.0053 * t + ph[3]));
  P.V = LN * vr;
  P.n = P.m + P.w;
  // How far the wave is above what it takes to lift a hub electron to the anode. The wave grows with the voltage,
  // which is what carries the spokes past the anode above the threshold. A mode with more spokes
  // reaches less far into the cavity, so it needs 1.7 times the push for each extra spoke.
  const gate = 1.03 * pow(vr / 1.17, 1.4) * pow(1.7, P.n - 4);
  P.q = 1.45 * pow(drive / 2, 1.1) * pow(vr / 1.17, 1.2) * (1 + 0.18 * sin(0.083 * t + ph[0]) + 0.12 * sin(0.0293 * t + ph[1]) + 0.08 * sin(0.0113 * t + ph[8]));
  P.q = min(P.q, 3.2);
  P.A = P.q * gate;
  P.wide = sstep(1.8, 6, P.q);
  st.gn = pow(P.n / 4, 1.25);
  // spokes take turns at being the strong ones, on a clock of their own
  st.pm = 2.4 * sin(0.083 * t + ph[9]) + 1.2 * sin(0.0371 * t + ph[0]);
  st.pm2 = 2.2 * sin(0.127 * t + ph[3]) + 1.0 * sin(0.0523 * t + ph[6]);
  st.pm3 = 2.0 * sin(0.171 * t + ph[2]) + 1.0 * sin(0.0613 * t + ph[4]);
  st.lean = LEAN * (1 + 0.35 * sin(0.067 * t + ph[5]) + 0.2 * sin(0.0239 * t + ph[7]));
  P.p1 = 0.8 * sin(0.0191 * t + ph[4]) + 0.4 * sin(0.0067 * t + ph[5]);
  P.p2 = 0.9 * sin(0.0137 * t + ph[6]);
}

// model time to the panel's seconds, wandering a third either way so nothing keeps time with anything else
function rate(st) {
  const t = st.t;
  return (1 / TS) * (1 + 0.3 * sin(0.113 * t + st.ph[7]) + 0.15 * sin(0.0371 * t + st.ph[8]) + 0.1 * sin(0.0113 * t + st.ph[1]));
}

// ---- drawing a tracer into the light buffer --------------------------------
function stamp(st, x, y, amp, buf, sx) {
  const hw = ceil(2.6 * sx), nc = 2 * hw;
  const cx = floor(x - 0.5) - hw + 1, cy = floor(y - 0.5) - 3;
  const wx = st.wx, wy = st.wy;
  const nrm = sqrt(SX / sx);
  for (let j = 0; j < nc; j++) { const d = cx + j + 0.5 - x; wx[j] = exp(-(d * d) / (2 * sx * sx)) * nrm; }
  for (let j = 0; j < 8; j++) { const d = cy + j + 0.5 - y; wy[j] = exp(-(d * d) / (2 * SY * SY)); }
  for (let j = 0; j < 8; j++) {
    const yy = cy + j;
    if (yy < 0 || yy >= H) continue;
    const a = amp * wy[j], row = yy * W;
    for (let i = 0; i < nc; i++) {
      const xx = (((cx + i) % W) + W) % W;
      buf[row + xx] += a * wx[i];
    }
  }
}

// the spokes trail like a pinwheel: the higher up, the further the wave lags, by about 0.4 of a spoke's spacing at the anode
const lean = (st, f) => st.lean * (W / st.P.n) * pow(f, 1.3);
// each spoke also wanders sideways on its own, up to a third of the spacing, so the spokes are never evenly spread
const warp = (st, th) => (0.42 + 0.12 * st.P.wide) * (W / st.P.n) * fld(st.F[3], th);
function toXY(st, r, th) {
  const f = cl((r - RA) / (RB - RA), 0, 1);
  let x = ((th + st.off) / TP) * W - lean(st, f) + warp(st, th);
  x -= W * floor(x / W);
  return [x, (H - 1) * (1 - pow(f, YP))];
}

// one tracer for a stretch of frame time
function advance(st, i, dtau, dt) {
  const subs = max(1, ceil(dtau / 0.02));
  const h = dtau / subs;
  let hit = 0;
  for (let s = 0; s < subs; s++) {
    rk4(st, i, h);
    if (st.P.wide > 0) st.th[i] += 0.5 * st.P.wide * sqrt(h) * (rnd() + rnd() + rnd() - 1.5) * 2;
    if (st.r[i] >= RB) { hit = 1; break; }
    if (st.r[i] <= RA) { hit = -1; break; }
  }
  st.age[i] += dtau;
  const dead = hit !== 0 || st.age[i] > st.life[i];
  const r = hit > 0 ? RB : st.r[i];
  const [x1, y1] = toXY(st, r, st.th[i]);
  // fade in and out so a tracer neither pops in nor out
  const al = sstep(0, 0.2, st.age[i]) * (dead && hit === 0 ? 0 : sstep(0, 0.25, st.life[i] - st.age[i]));
  const al2 = hit !== 0 ? sstep(0, 0.2, st.age[i]) : al;
  if (st.x0[i] >= 0) {
    let dx = x1 - st.x0[i];
    dx -= W * Math.round(dx / W);
    const dy = y1 - st.y0[i];
    const n = cl(ceil(max(abs(dx), abs(dy)) / 1.0), 1, 10);
    const amp = (KDEP * st.gn * (1 + 6 * st.P.wide * sstep(0.55, 0.85, st.r[i])) * al2 * dt * (0.3 + 0.7 * sstep(0.5, 0.72, st.r[i])) * (1 + 0.3 * cos(st.th[i] + st.pm) + 0.22 * cos(2 * st.th[i] + st.pm2) + 0.15 * cos(3 * st.th[i] + st.pm3) + (0.65 + 0.5 * st.P.wide) * fld(st.F[0], st.th[i]))) / n;
    for (let q = 1; q <= n; q++) stamp(st, st.x0[i] + (dx * q) / n, st.y0[i] + (dy * q) / n, amp, st.D, SX * (1 + 0.9 * st.P.wide));
  }
  if (hit > 0) stamp(st, x1, 0.5, 0.16, st.E, SX * (1 + 1.2 * st.P.wide));
  st.x0[i] = x1;
  st.y0[i] = y1;
  if (dead) spawn(st, i, false);
}

// each sector of the wave frame wanders on its own, so frames far apart never quite match
function wander(st, dt) {
  const k = exp(-dt / TFLD), sg = 0.5 * sqrt(1 - k * k) * 2.3;
  for (const F of st.F) for (let j = 0; j < NSEC; j++) F[j] = F[j] * k + sg * (rnd() + rnd() + rnd() - 1.5);
}
function fld(F, th) {
  let u = (th / TP) * NSEC;
  u -= NSEC * floor(u / NSEC);
  const j = floor(u), f = u - j, g = f * f * (3 - 2 * f);
  const a = F[j], b = F[j + 1 >= NSEC ? 0 : j + 1];
  return Math.tanh(a + (b - a) * g);
}

function frameStep(st, dt) {
  wander(st, dt);
  const dtau = dt * rate(st);
  st.t += dt;
  st.off += dtau;
  setParams(st);
  const fd = exp(-dt / TD), fe = exp(-dt / TF);
  const { D, E } = st;
  for (let i = 0; i < W * H; i++) { D[i] *= fd; E[i] *= fe; }
  for (let i = 0; i < NT; i++) advance(st, i, dtau, dt);
}

// ---- frame -----------------------------------------------------------------
export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  if (!st.init) {
    st.init = true;
    // ten units of model time at once, so the first picture already has its spokes
    setParams(st);
    for (let n = 0; n < 250; n++) {
      const dtau = 0.04;
      st.t += dtau / rate(st);
      st.off += dtau;
      setParams(st);
      for (let i = 0; i < NT; i++) {
        const subs = 2, h = dtau / subs;
        for (let s = 0; s < subs; s++) { rk4(st, i, h); if (st.r[i] >= RB || st.r[i] <= RA) break; }
        st.age[i] += dtau;
        if (st.r[i] >= RB || st.r[i] <= RA || st.age[i] > st.life[i]) spawn(st, i, false);
      }
    }
    for (let i = 0; i < NT; i++) st.x0[i] = -1;
    for (let f = 0; f < 15; f++) frameStep(st, 1 / 30);
    return;
  }
  frameStep(st, dt);
}

export function draw(display, params) {
  const st = params.st || setup(params);
  const kn = st.k, P = st.P;
  // palette: hue turns the colour space about the grey axis
  const ang = cl(kn[0], 0, 1) * TP, ca = cos(ang), sa = sin(ang) / sqrt(3), q = (1 - ca) / 3;
  const m00 = ca + q, m01 = q - sa, m02 = q + sa;
  const { D, E } = st;
  const t = st.t;
  const mod = 1 + 0.04 * sin(0.9 * t) + 0.1 * sin(0.21 * t + st.ph[5]) + 0.06 * sin(0.073 * t + st.ph[4]);
  const depth = cl(P.q / 1.2, 0, 1);
  for (let y = 0; y < H; y++) {
    const f = pow(1 - (y + 0.5) / H, 1 / YP);
    const up = f;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const th0 = ((x + 0.5 + lean(st, f)) / W) * TP - st.off;
      const th = th0 - (warp(st, th0) / W) * TP;
      // hub: a soft dense band over the cathode, modulated at the spoke count
      const hubTop = 0.3 * (1 + 0.14 * fld(st.F[2], th));
      const wave = (1 - P.w) * cos(P.m * th + P.p1) + P.w * cos((P.m + 1) * th + P.p2);
      const hub = (1 - sstep(0.12, hubTop + 0.08, f)) * (0.75 + 0.18 * depth * wave) * mod * (1 + 0.4 * fld(st.F[1], th));
      const v = 1 - exp(-(D[i] * GAIN + hub));
      // violet to cyan up the panel, white where it is dense
      const hh = sstep(0.05, 0.75, up);
      let r = 110 + (30 - 110) * hh, g = 60 + (190 - 60) * hh, b = 255;
      const wh = sstep(0.55, 1, v) * 0.85;
      r += (255 - r) * wh; g += (255 - g) * wh; b += (255 - b) * wh;
      const e = 1 - exp(-0.7 * E[i]);
      r *= v * (1 - 0.8 * e); g *= v * (1 - 0.8 * e); b *= v * (1 - 0.8 * e);
      // the cathode's thin orange glow
      const cg = exp(-((H - 1 - y) * (H - 1 - y)) / 3) * 0.6;
      r *= 1 - 0.8 * cg; g *= 1 - 0.8 * cg; b *= 1 - 0.8 * cg;
      r += 255 * cg; g += 110 * cg; b += 5 * cg;
      // the anode flash
      r += 255 * e; g += 175 * e + 60 * e * e * e; b += 60 * e + 120 * e * e * e;
      r += 3; g += 4; b += 12;
      const r2 = m00 * r + m01 * g + m02 * b, g2 = m02 * r + m00 * g + m01 * b, b2 = m01 * r + m02 * g + m00 * b;
      display.setPixel(x, y, cl(r2, 0, 255) | 0, cl(g2, 0, 255) | 0, cl(b2, 0, 255) | 0);
    }
  }
}
