// ===== Patternflow pattern =====
// Title:   Kirkwood Gaps
// Family:  kirkwood
// Idea:    Fifteen hundred test asteroids, a Hilda group and a Trojan cloud are stepped round a Sun and a heavy Jupiter on a circular orbit, seen from above in the frame that turns with Jupiter and counted by semi-major axis underneath, so the particles that sit in a mean-motion resonance have their eccentricity pumped up and are thrown out, and gaps open in the histogram at 3:1, 5:2, 7:3 and 2:1 while the 3:2 and 1:1 resonances hold their crowds.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the gaps in the distribution of asteroid semi-major axes at the 3:1, 5:2, 7:3 and 2:1 commensurabilities with Jupiter (Kirkwood 1866, from memory); the chaotic growth of eccentricity at the 3:1 resonance that clears its gap, found by integrating a map of the planar restricted three-body problem (Wisdom 1982, from memory); the Hilda group in the 3:2 resonance, a triangle in the rotating frame, and the Trojans at the 1:1, librating round the Lagrange points L4 and L5 (from memory); the Kepler drift and a kick from Jupiter, a symplectic leapfrog of the kind Wisdom and Holman made standard (1991, from memory); Jupiter is several times too heavy and the clock runs a few orbits a second so that the gaps open while you look, and every particle that is thrown out is sown again as a new one, so the picture is a steady state, pattern round 242
// Round:   242
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Jupiter=0..4, Spread=-1..1, Speed=-1..1
//
// Knob 1: Hue. Turns the particles and the bars round the wheel and opens in amber and gold, the hot particles going pale and then violet. Jupiter stays cream, the sky stays indigo.
// Knob 2: Jupiter. 0 to 4, opening at 2: the mass of the planet, 0.003 of the Sun's at 0, 0.009 at 2 and 0.027 at the top (a real Jupiter is 0.001), and the size of its disc follows the cube root. The gaps in the histogram deepen and widen with it, the outer belt and the 2:1 side are swept out, and the Hildas and the Trojans keep their places. At 0 the gaps are only dents.
// Knob 3: Spread. -1 to 1, opening at 0: how eccentric the particles are when they are sown, about 0.15 at -1, 0.22 at 0 and 0.33 at 1, which is how thick the belt stands in the top view and how many particles are in the resonant zones with enough eccentricity to be pumped. Turning it sows the belt again as the knob moves.
// Knob 4: Speed. -1 to 1, opening near 0: the clock, a quarter of a Jupiter orbit a second at -1 and four a second at 1, 1 at the opening. Slow, the particles are beads that circle the Sun in the rotating frame; fast, the belt is a ring of light with the Hildas and Trojans standing still in it.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();

// ---- the system -------------------------------------------------------------
// Units: Jupiter's orbit has radius 1 and the Sun's GM is 1, so a Jupiter orbit takes 2 pi. The particles are heliocentric and
// do not pull on each other. A step is the Kepler drift of every particle and then a kick from Jupiter, direct plus the Sun's
// reflex, with Jupiter placed on its circle at the new time.
const AUJ = 5.2;                        // AU, for talking about semi-major axes
const NB = 1500, NH = 260, NT = 240, N = NB + NH + NT;   // belt, Hildas, Trojans
const A_LO = 2.0, A_HI = 3.6;           // where a belt particle is sown, AU
const HSTEP = 0.32;                     // radians of Jupiter's orbit a step
const PRE_ORB = 105;                    // orbits run before the first frame
const KAPPA = 1 / 170;                  // belt particles sown again a Jupiter orbit, as a fraction of the belt
const EMEAN = 6;                        // radians over which the mean semi-major axis is averaged

// ---- the picture ------------------------------------------------------------
const TOPH = 70;                        // rows of the view from above
const CX = 31.5, CY = 34.5, SC = 5.7 * AUJ;   // the Sun, and LEDs to a Jupiter radius (5.7 an AU)
const HB = 128, HMAX = 49;              // the bars stand on the bottom edge and rise at most this many rows
const HA0 = 2.0, HA1 = 4.2;             // the axis of the histogram, AU
const REF = 30;                         // particles in a column that stand 0.6 of the way up
const RES = [[3, 1], [5, 2], [7, 3], [2, 1], [3, 2]];
const NL = 64;

function hsv2rgb(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}
function rgb2hsv(r, g, b, out) {
  r /= 255; g /= 255; b /= 255;
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  out[0] = h / 6;
  out[1] = mx > 0 ? d / mx : 0;
  out[2] = mx;
}
// The colour of a particle by its eccentricity: amber, gold, a pale cream where it is hot and then lavender and violet. The path
// goes through the pale end, not through pink, which is another pattern's.
const STOPS = [
  [0.0, 255, 146, 38],
  [0.3, 255, 188, 66],
  [0.5, 255, 222, 124],
  [0.68, 255, 240, 214],
  [0.84, 206, 182, 255],
  [1.0, 140, 100, 255],
];
function buildLut(lut, hue) {
  const hv = [0, 0, 0], c = [0, 0, 0];
  for (let i = 0; i < NL; i++) {
    const u = i / (NL - 1);
    let k = 0;
    while (k < STOPS.length - 2 && u > STOPS[k + 1][0]) k++;
    const a = STOPS[k], b = STOPS[k + 1], f = (u - a[0]) / (b[0] - a[0]);
    rgb2hsv(mix(a[1], b[1], f), mix(a[2], b[2], f), mix(a[3], b[3], f), hv);
    hsv2rgb(hv[0] + hue, hv[1], hv[2], c, 0);
    lut[i * 3] = c[0];
    lut[i * 3 + 1] = c[1];
    lut[i * 3 + 2] = c[2];
  }
}

// ---- seeding ----------------------------------------------------------------
// A particle from its elements: semi-major axis a (Jupiter radii), eccentricity e, the longitude of perihelion w and the mean anomaly M.
function put(st, i, a, e, w, M) {
  let E = M + e * sin(M);
  for (let k = 0; k < 6; k++) E -= (E - e * sin(E) - M) / (1 - e * cos(E));
  const cE = cos(E), sE = sin(E), b = sqrt(1 - e * e), n = 1 / (a * sqrt(a)), q = 1 / (1 - e * cE);
  const xp = a * (cE - e), yp = a * b * sE, vxp = -a * n * sE * q, vyp = a * n * b * cE * q;
  const cw = cos(w), sw = sin(w);
  st.X[i] = xp * cw - yp * sw;
  st.Y[i] = xp * sw + yp * cw;
  st.VX[i] = vxp * cw - vyp * sw;
  st.VY[i] = vxp * sw + vyp * cw;
  st.AM[i] = a * AUJ;
}
function seedBelt(st, i) {
  put(st, i, (A_LO + (A_HI - A_LO) * rnd()) / AUJ, st.eLo + (st.eHi - st.eLo) * rnd(), rnd() * TAU, rnd() * TAU);
}
// A Hilda sits in the 3:2 resonance whose angle sigma = 3 L(Jupiter) - 2 L - w librates about 0: the aphelion is then 60 degrees
// ahead of Jupiter, 60 behind or opposite it, so in the rotating frame the orbit is a rounded triangle.
function seedHilda(st, i) {
  const a = (3.968 + (rnd() - 0.5) * 0.16) / AUJ, e = st.eHi * (0.5 + 0.5 * rnd());
  const M = rnd() * TAU, sg = (rnd() - 0.5) * 2 * (0.3 + 0.8 * rnd());
  put(st, i, a, e, st.t - (2 * M + sg) / 3 + floor(rnd() * 3) * (TAU / 3), M);
}
// A Trojan is a particle near L4 or L5 on a circular orbit, with a spread in longitude that sets how wide its tadpole is.
function seedTroj(st, i) {
  const side = rnd() < 0.5 ? 1 : -1, amp = 0.42 * (st.eHi / 0.22);
  const lam = st.t + side * (PI / 3) + (rnd() - 0.5) * 2 * amp * (0.25 + 0.75 * rnd()), w = rnd() * TAU;
  put(st, i, 1 + (rnd() - 0.5) * 0.04, 0.03 * rnd(), w, lam - w);
}
function reseed(st, i) {
  if (i < NB) seedBelt(st, i);
  else if (i < NB + NH) seedHilda(st, i);
  else seedTroj(st, i);
}

// ---- the map ----------------------------------------------------------------
function step(st, h) {
  const X = st.X, Y = st.Y, VX = st.VX, VY = st.VY, AM = st.AM;
  const hm = h * st.mu, t1 = st.t + h, cj = cos(t1), sj = sin(t1), ke = h / EMEAN, EL2 = st.eLoss * st.eLoss;
  st.t = t1;
  for (let i = 0; i < N; i++) {
    let x = X[i], y = Y[i], vx = VX[i], vy = VY[i];
    const r0 = sqrt(x * x + y * y), ia0 = 2 / r0 - (vx * vx + vy * vy);
    if (ia0 < 0.1) {
      st.t = t1 - h;
      reseed(st, i);
      st.t = t1;
      continue;
    }
    // Kepler drift: the eccentric anomaly step dE solves dE - ec sin dE + es (1 - cos dE) = n h
    const a = 1 / ia0, n = 1 / (a * sqrt(a)), ec = 1 - r0 / a, es = (x * vx + y * vy) / (n * a * a), dM = n * h;
    let E = dM, s = sin(E), c = cos(E);
    for (let k = 0; k < 3; k++) {
      const d = (E - ec * s + es * (1 - c) - dM) / (1 - ec * c + es * s);
      const s2 = s + c * d - 0.5 * s * d * d, c2 = c - s * d - 0.5 * c * d * d;
      E -= d;
      s = k < 2 ? sin(E) : s2;
      c = k < 2 ? cos(E) : c2;
    }
    const r1 = a * (1 - ec * c + es * s);
    const f = 1 - (a / r0) * (1 - c), g = h + (s - E) / n, fd = -((a * a * n) / (r0 * r1)) * s, gd = 1 - (a / r1) * (1 - c);
    x = f * X[i] + g * vx;
    y = f * Y[i] + g * vy;
    const nvx = fd * X[i] + gd * vx, nvy = fd * Y[i] + gd * vy;
    // the kick, Jupiter's pull on the particle less its pull on the Sun
    const dx = cj - x, dy = sj - y, d2 = dx * dx + dy * dy, ds = d2 + 1e-4, inv = 1 / (ds * sqrt(ds));
    vx = nvx + hm * (dx * inv - cj);
    vy = nvy + hm * (dy * inv - sj);
    X[i] = x;
    Y[i] = y;
    VX[i] = vx;
    VY[i] = vy;
    const r = sqrt(x * x + y * y), ia = 2 / r - (vx * vx + vy * vy), L = x * vy - y * vx, e2 = 1 - L * L * ia;
    let lost = r < 0.1 || ia < 0.8;
    if (!lost) {
      if (i < NB) lost = ia < 1.111 || ia > 3.03 || e2 > EL2 || d2 < 0.0049;
      else if (i < NB + NH) lost = ia < 1.111 || ia > 1.667 || e2 > 0.16 || d2 < 0.0049;
      else lost = ia < 0.833 || ia > 1.25 || e2 > 0.09 || d2 < 0.0016;
    }
    if (lost) {
      st.t = t1;
      reseed(st, i);
    } else AM[i] += (AUJ / ia - AM[i]) * ke;
  }
  // belt particles come and go: a few are sown again each orbit, so the gaps keep being fed and keep emptying
  st.rc += (KAPPA * NB * h) / TAU;
  while (st.rc >= 1) {
    st.rc -= 1;
    seedBelt(st, floor(rnd() * NB));
  }
}

// ---- knobs ------------------------------------------------------------------
function derive(st) {
  const k = st.k;
  st.mu = 0.0065 * exp(0.38 * cl(k[1], 0, 4));
  const em = 0.3 * exp(0.28 * cl(k[2], -1, 1));
  st.eHi = em;
  st.eLo = 0.55 * em;
  st.eLoss = 0.4;
  st.speed = Math.pow(8, cl(k[3], -1, 1));      // Jupiter orbits a second
  st.jr = 11 * Math.pow(st.mu, 1 / 3);
}

export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, acc: 0, clock: 0, rc: 0, spill: 0, k3p: null, dtS: 0,
    X: new Float64Array(N), Y: new Float64Array(N), VX: new Float64Array(N), VY: new Float64Array(N), AM: new Float64Array(N),
    mu: 0.009, eHi: 0.22, eLo: 0.1, eLoss: 0.4, speed: 1, jr: 2.3,
    cnt: new Float32Array(64), esm: new Float32Array(64), hv: new Float32Array(64), he: new Float32Array(64), hinit: false,
    ec: new Float32Array(N), lut: new Float32Array(NL * 3), hue: -9,
    buf: new Float32Array(W * TOPH * 3),
  });
  return st;
}

function histogram(st, dt) {
  const cnt = st.cnt, esm = st.esm, AM = st.AM, X = st.X, Y = st.Y, VX = st.VX, VY = st.VY, ec = st.ec;
  cnt.fill(0);
  esm.fill(0);
  const sc = 64 / (HA1 - HA0);
  for (let i = 0; i < N; i++) {
    const x = X[i], y = Y[i], vx = VX[i], vy = VY[i];
    const r = sqrt(x * x + y * y), ia = 2 / r - (vx * vx + vy * vy), L = x * vy - y * vx;
    const e = sqrt(max(0, 1 - L * L * ia));
    ec[i] = e;
    const p = (AM[i] - HA0) * sc, b = floor(p);
    if (b >= 0 && b < 64) {
      // a half column either side takes a share, so a bar does not step as a particle crosses a boundary
      const f = p - b, w1 = f < 0.5 ? 0.5 + f : 1.5 - f;
      cnt[b] += w1;
      esm[b] += w1 * e;
      const nb = f < 0.5 ? b - 1 : b + 1;
      if (nb >= 0 && nb < 64) {
        cnt[nb] += 1 - w1;
        esm[nb] += (1 - w1) * e;
      }
    }
  }
  const K = [0.0297, 0.2352, 0.4703, 0.2352, 0.0297];
  const al = st.hinit ? 1 - exp(-dt / 0.3) : 1;
  for (let x = 0; x < 64; x++) {
    let c = 0, es = 0;
    for (let d = -2; d <= 2; d++) {
      const j = cl(x + d, 0, 63);
      c += K[d + 2] * cnt[j];
      es += K[d + 2] * esm[j];
    }
    st.hv[x] += (c - st.hv[x]) * al;
    st.he[x] += ((c > 0.3 ? es / c : 0.15) - st.he[x]) * al;
  }
  st.hinit = true;
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  derive(st);
  if (!st.init) {
    st.init = true;
    st.k3p = st.k[2];
    for (let i = 0; i < N; i++) reseed(st, i);
    const steps = ceil((PRE_ORB * TAU) / HSTEP);
    for (let s = 0; s < steps; s++) step(st, HSTEP);
    histogram(st, 0);
  }
  dt = cl(dt || 0, 0, 0.1);
  st.clock += dt;
  // Turning Spread sows the belt again while the knob moves, so the new thickness is not waited for.
  const d3 = abs(st.k[2] - st.k3p);
  st.k3p = st.k[2];
  st.spill += d3 * 0.5 * NB * 1.3;
  while (st.spill >= 1) {
    st.spill -= 1;
    seedBelt(st, floor(rnd() * NB));
  }
  st.dtS = dt * st.speed * TAU;
  st.acc += st.dtS;
  let guard = 0;
  while (st.acc >= HSTEP && guard++ < 30) {
    st.acc -= HSTEP;
    step(st, HSTEP);
  }
  if (st.acc > HSTEP) st.acc = HSTEP;
  histogram(st, dt);
}

// ---- drawing ----------------------------------------------------------------
const GROUND = [6, 5, 24];
const CREAM = [255, 238, 200];
const E0C = 0.08, ECOLD = 0.34;           // eccentricity at the amber end of the ramp, and the span of the ramp
const eu = (e) => cl((e - E0C) / ECOLD, 0, 1);

function splat(buf, px, py, r, g, b) {
  // a soft dot about 2 LED across: weight (1 - d2 / 2.6) squared out to a radius of 1.6
  const ix = floor(px - 0.5), iy = floor(py - 0.5);
  for (let yy = iy; yy <= iy + 2; yy++) {
    if (yy < 0 || yy >= TOPH) continue;
    const dy = yy + 0.5 - py;
    for (let xx = ix; xx <= ix + 2; xx++) {
      if (xx < 0 || xx >= W) continue;
      const dx = xx + 0.5 - px, q = 1 - (dx * dx + dy * dy) / 2.6;
      if (q <= 0) continue;
      const w = q * q, o = (yy * W + xx) * 3;
      buf[o] += w * r;
      buf[o + 1] += w * g;
      buf[o + 2] += w * b;
    }
  }
}

function drawTop(st) {
  const buf = st.buf, lut = st.lut, X = st.X, Y = st.Y, VX = st.VX, VY = st.VY, ec = st.ec;
  buf.fill(0);
  const ct = cos(st.t), sn = sin(st.t), acc = st.acc, dtS = st.dtS;
  const ENERGY = 0.2;
  for (let i = 0; i < N; i++) {
    const x = X[i], y = Y[i], vx = VX[i], vy = VY[i];
    // the rotating frame, Jupiter on +X
    let px = x * ct + y * sn, py = -x * sn + y * ct;
    const r = sqrt(px * px + py * py);
    if (r < 1e-3) continue;
    const vr = (x * vx + y * vy) / r, om = (x * vy - y * vx) / (r * r) - 1;
    // where the particle is part way into the next step, and the arc it has just come along
    const th0 = om * acc, c0 = cos(th0), s0 = sin(th0), rs = 1 + (vr * acc) / r;
    const qx = (px * c0 - py * s0) * rs, qy = (px * s0 + py * c0) * rs;
    let tau = dtS;
    const lenPx = (abs(om) * r + abs(vr)) * SC;
    // a short exposure never shorter than a LED and a bit, and an arc never longer than a radian and a half
    if (lenPx * tau < 1.2) tau = lenPx > 1e-4 ? 1.2 / lenPx : 0;
    if (abs(om) * tau > 1.5) tau = 1.5 / abs(om);
    const arc = lenPx * tau;
    const K = cl(ceil(arc / 1.4), 1, 12), dl = tau / K;
    const ca = cos(-om * dl), sa = sin(-om * dl), rr = 1 - (vr * dl) / r;
    const li = floor(eu(ec[i]) * (NL - 1) + 0.5) * 3, en = ENERGY / K;
    const cr = (lut[li] / 255) * en, cg = (lut[li + 1] / 255) * en, cb = (lut[li + 2] / 255) * en;
    let ux = qx, uy = qy;
    for (let k = 0; k < K; k++) {
      // the screen: Jupiter at the top, motion anticlockwise
      splat(buf, CX - uy * SC, CY - ux * SC, cr, cg, cb);
      const nx = (ux * ca - uy * sa) * rr, ny = (ux * sa + uy * ca) * rr;
      ux = nx;
      uy = ny;
    }
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  if (abs(st.k[0] - st.hue) > 1e-4) {
    st.hue = st.k[0];
    buildLut(st.lut, st.hue);
  }
  drawTop(st);
  const buf = st.buf, lut = st.lut;
  // ---- the view from above
  const jx = CX, jy = CY - SC, jr = st.jr;
  for (let y = 0; y < TOPH; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, dxs = x + 0.5 - CX, dys = y + 0.5 - CY;
      const gl = exp(-(dxs * dxs + dys * dys) / 700);
      let r = GROUND[0] + 7 * gl, g = GROUND[1] + 4 * gl, b = GROUND[2] + 16 * gl;
      const m = max(buf[o], buf[o + 1], buf[o + 2]);
      if (m > 1e-4) {
        // the colour keeps its direction and the light is squeezed into 0..1; where it is dim it is paled and lifted, since a dim
        // amber on the panel is brown
        const v = 1 - exp(-1.7 * m), k = 255 / m, pl = 0.38 * (1 - v) * (1 - v), vv = min(1, v * (1 + 0.55 * (1 - v)));
        r = r * (1 - vv) + mix(buf[o] * k, 255, pl) * vv;
        g = g * (1 - vv) + mix(buf[o + 1] * k, 238, pl) * vv;
        b = b * (1 - vv) + mix(buf[o + 2] * k, 190, pl) * vv;
      }
      // the Sun, a small pale gold dot
      const ds = sqrt(dxs * dxs + dys * dys), sw = 1 - sstep(1.2, 2.3, ds);
      if (sw > 0) {
        r = mix(r, 255, sw);
        g = mix(g, 226, sw);
        b = mix(b, 150, sw);
      }
      // Jupiter, a cream disc with a soft edge and a faint halo
      const dj = sqrt((x + 0.5 - jx) * (x + 0.5 - jx) + (y + 0.5 - jy) * (y + 0.5 - jy));
      const hw = 0.16 * (1 - sstep(jr, jr * 2.6, dj)), jw = 1 - sstep(jr - 0.6, jr + 0.7, dj);
      r = mix(r, CREAM[0], hw);
      g = mix(g, CREAM[1], hw);
      b = mix(b, CREAM[2], hw);
      r = mix(r, CREAM[0], jw);
      g = mix(g, CREAM[1], jw);
      b = mix(b, CREAM[2], jw);
      display.setPixel(x, y, cl(r + 0.5, 0, 255) | 0, cl(g + 0.5, 0, 255) | 0, cl(b + 0.5, 0, 255) | 0);
    }
  }
  // ---- the histogram
  const hv = st.hv, he = st.he;
  const rc = [0, 0, 0];
  for (let y = TOPH; y < H; y++) {
    const rowTop = HB - y, rowBot = rowTop - 1;
    for (let x = 0; x < W; x++) {
      const h = HMAX * (1 - exp(-hv[x] / REF)) * 1.0;
      let r = GROUND[0] + 2, g = GROUND[1] + 1, b = GROUND[2] + 2;
      // a faint column where each resonance sits
      let rs = 0;
      for (let q = 0; q < RES.length; q++) {
        const ar = AUJ * Math.pow(RES[q][1] / RES[q][0], 2 / 3), cx = ((ar - HA0) / (HA1 - HA0)) * 64, d = x + 0.5 - cx;
        rs += exp(-(d * d) / 1.1);
      }
      r += 14 * rs;
      g += 9 * rs;
      b += 28 * rs;
      const cov = cl(h - rowBot, 0, 1);
      if (cov > 0) {
        const f = cl(rowTop / max(h, 1), 0, 1), edge = exp(-(h - rowTop) / 2.4);
        const li = floor(eu(he[x]) * (NL - 1) + 0.5) * 3;
        const base = mix(0.45, 0.8, f) + 0.3 * edge, hot = sstep(0.12, 0.3, he[x]) * 0.8;
        // the bars are warm: amber at the foot, gold at the top, with the colour of the eccentricity coming in as it gets high
        rc[0] = mix(lut[3 * 8], lut[li], hot * f);
        rc[1] = mix(lut[3 * 8 + 1], lut[li + 1], hot * f);
        rc[2] = mix(lut[3 * 8 + 2], lut[li + 2], hot * f);
        const v = min(1, base);
        r = mix(r, rc[0] * v, cov);
        g = mix(g, rc[1] * v, cov);
        b = mix(b, rc[2] * v, cov);
      }
      display.setPixel(x, y, cl(r + 0.5, 0, 255) | 0, cl(g + 0.5, 0, 255) | 0, cl(b + 0.5, 0, 255) | 0);
    }
  }
}
