// ===== Patternflow pattern =====
// Title:   Magnetopause
// Family:  magnetosphere
// Idea:    The Earth's magnetosphere seen from the side with the Sun at the top, its dipole field lines squeezed on the day side and drawn into a long tail on the night side, breathing under gusts of solar wind while a southward field opens the day side and a substorm pinches a plasmoid off down the tail.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the magnetopause as the boundary where the solar wind holds off the dipole field (Sydney Chapman and Vincenzo Ferraro, 1931), the open magnetosphere and the loading and unloading tail (James Dungey, 1961), the substorm (Syun-Ichi Akasofu, 1964) and the plasmoid pinched off the tail (Hones, 1977), the shape r = r0 (2 / (1 + cos theta)) to the alpha with r0 as pressure to the minus one sixth (Shue and colleagues, 1998), the bow shock (Spreiter, Summers and Alksne, 1966), the sheath as the flow round a Rankine half-body, pattern round 239
// Round:   239
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pressure=0..2.5, Field=-1..1, Gusts=0..1
//
// Knob 1: Hue. Turns every colour round the wheel. At 0 the closed lines are blue-violet, the open ones gold by the planet and magenta down the tail, the wind cyan, the sheath violet and the plasma sheet pink.
// Knob 2: Pressure. 0 to 2.5, opening at 2. The solar wind's dynamic pressure before the gusts. The nose stands off as pressure to the minus one sixth, about 15 LEDs from the planet at 0 and 10 at 2.5, and the bow shock and the tail follow it.
// Knob 3: Field. -1 to 1, opening at 0. The interplanetary field from northward to southward. At -1 the day side stays shut, nearly every line is blue and no substorm comes. At 1 the day side opens, more lines turn gold, and a substorm sends a plasmoid down the tail every 20 s or so.
// Knob 4: Gusts. 0 to 1, opening near 0.06. How stormy the wind is. Bands of dense and thin wind come down the panel and bend round the boundary, and each presses or frees the nose as it passes. High, the nose swings by several LEDs, shock fronts come every minute or so, and the tail flaps and the picture leans.

const W = 64, H = 128, NPX = W * H, CX = 32, CY = 58, A = 2.4, V = 22, NG = 20, NI = 8, NW = 3, NR = 5, NPUL = 44, NP = 170, NL = 4, NT = 521;
const { floor, min, max, abs, exp, log, pow, sqrt, sin, cos, asin, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = (a, b) => a + (b - a) * Math.random();
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
const rc = (u) => (u * u < 1 ? (1 - u * u) * (1 - u * u) : 0);
// the dipole lines: L is the equatorial distance in planet radii; FRAC is how far across the tail an open line lies
const LAB = [2.3, 3.8, 5.8, 9], FRAC = [0.2, 0.3, 0.5, 0.78];

// ---- colour ---------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A dim colour on the red-orange-yellow stretch of the wheel reads brown, so it is lifted and paled there.
function dim(h, s, v, out, o) {
  const c = h - floor(h), b = c > 0.9 ? sstep(0.9, 0.97, c) : 1 - sstep(0.12, 0.2, c);
  hsv(h, s * (1 - 0.5 * b), min(1, v * (1 + 1.1 * b * (1 - v))), out, o);
}
const LN = 48;
function mkLut(lut, h, s, vmax) {
  const c = [0, 0, 0];
  for (let i = 0; i < LN; i++) {
    dim(h, s, (vmax * i) / (LN - 1), c, 0);
    for (let j = 0; j < 3; j++) lut[i * 3 + j] = c[j] * 255;
  }
}
function buildPal(st, k1, hw) {
  const p = st.pal;
  mkLut(p.w, 0.575 + k1 + hw, 0.6, 0.75);
  mkLut(p.s, 0.72 + k1 - hw, 0.7, 0.9);
  mkLut(p.i, 0.68 + k1, 0.75, 0.6);
  mkLut(p.p, 0.93 + k1, 0.45, 1);
  for (const [n, h, s] of [["cl", 0.64, 0.58], ["o1", 0.115, 0.55], ["o2", 0.92, 0.62], ["mp", 0.72, 0.32], ["bs", 0.5, 0.22], ["pl", 0.12, 0.4], ["wn", 0.575 + hw, 0.6], ["sn", 0.8 - hw, 0.5]]) hsv(h + k1, s, 1, p[n], 0);
}

// ---- value noise that wraps ----------------------------------------------
const NX = 16, NY = 32, LAT = new Float32Array(NX * NY);
function tex(u, v) {
  const i = floor(u), j = floor(v), fu = u - i, fv = v - j, wu = fu * fu * (3 - 2 * fu), wv = fv * fv * (3 - 2 * fv);
  const i0 = ((i % NX) + NX) % NX, i1 = (i0 + 1) % NX, j0 = ((j % NY) + NY) % NY, j1 = (j0 + 1) % NY;
  const a = LAT[j0 * NX + i0] + (LAT[j0 * NX + i1] - LAT[j0 * NX + i0]) * wu, b = LAT[j1 * NX + i0] + (LAT[j1 * NX + i1] - LAT[j1 * NX + i0]) * wu;
  return a + (b - a) * wv;
}

// ---- a soft round stamp with a 2 LED core, added or maxed into three buffers ----
const PROF = new Float32Array(170);
for (let i = 0; i < 170; i++) PROF[i] = exp(-i / 16 / 1.28);
function stamp(bR, bG, bB, x, y, r, g, b, mx, wid) {
  const x0 = max(0, floor(x - 3.2)), x1 = min(W - 1, floor(x + 3.2)), y0 = max(0, floor(y - 3.2)), y1 = min(H - 1, floor(y + 3.2)), iw = 16 / ((wid || 1) * (wid || 1));
  for (let py = y0; py <= y1; py++) {
    const dy = py + 0.5 - y;
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - x, d2 = dx * dx + dy * dy;
      const ix = (d2 * iw) | 0;
      if (ix >= 169) continue;
      const w = PROF[ix], o = py * W + px;
      if (mx) {
        if (r * w > bR[o]) bR[o] = r * w;
        if (g * w > bG[o]) bG[o] = g * w;
        if (b * w > bB[o]) bB[o] = b * w;
      } else {
        bR[o] += r * w;
        bG[o] += g * w;
        bB[o] += b * w;
      }
    }
  }
}
function glow(st, x, y, s, c, k) {
  const x0 = max(0, floor(x - 3 * s)), x1 = min(W - 1, floor(x + 3 * s)), y0 = max(0, floor(y - 3 * s)), y1 = min(H - 1, floor(y + 3 * s));
  for (let py = y0; py <= y1; py++)
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - x, dy = py + 0.5 - y, w = exp((-0.5 * (dx * dx + dy * dy)) / (s * s)) * k * 255, o = py * W + px;
      st.lr[o] += c[0] * w;
      st.lg[o] += c[1] * w;
      st.lb[o] += c[2] * w;
    }
}

// ---- state ----------------------------------------------------------------
// A slow random walk between targets: it eases to a target and picks a new one, over its own time scale, when it gets there.
const wn = (lo, hi, t0, t1) => ({ v: rnd(lo, hi), g: rnd(lo, hi), lo, hi, t0, t1, tau: rnd(t0, t1) });
function wst(w, d) {
  w.v += (w.g - w.v) * (1 - exp(-d / w.tau));
  if (abs(w.g - w.v) < 0.1 * (w.hi - w.lo)) {
    w.g = rnd(w.lo, w.hi);
    w.tau = rnd(w.t0, w.t1);
  }
  return w.v;
}
function newGust(g, fresh) {
  g.w = rnd(9, 38);
  g.a = gauss();
  g.pc = rnd(-34, 34);
  g.pl = rnd(14, 60);
  g.f = rnd(0.85, 1.15);
  g.c = fresh ? rnd(19 - CY - 10, 125) : 15 - CY - 2.2 * g.w - rnd(0, 45);
  return g;
}
function newImf(m, t) {
  m.ts = t + rnd(0, 18);
  m.te = m.ts + rnd(8, 30);
  m.a = (Math.random() < 0.5 ? -1 : 1) * rnd(0.4, 1);
  return m;
}
function newWave(w, t) {
  w.t0 = t;
  w.dur = rnd(14, 36);
  w.A = rnd(0.5, 3);
  w.k = TAU / rnd(28, 70);
  w.om = (TAU / rnd(3, 8)) * (Math.random() < 0.8 ? 1 : -1);
  w.ph = rnd(0, TAU);
  return w;
}
function newRope(r) {
  r.T = rnd(8, 70);
  r.v = rnd(-16, 30);
  r.a = rnd(0.4, 1);
  r.w = rnd(1.6, 2.6);
  r.life = rnd(2, 6);
  return r;
}
function newPulse(p, fresh) {
  p.p = floor(Math.random() * NL * 4);
  p.v = rnd(16, 46) * (Math.random() < 0.8 ? 1 : -1);
  p.s = fresh ? rnd(-20, 150) : p.v > 0 ? -rnd(0, 70) : 200 + rnd(0, 70);
  p.a = rnd(0.7, 1.5);
  p.sg = rnd(2.2, 5);
  return p;
}
function newBlob(b, fresh) {
  b.x = rnd(0, W);
  b.y = rnd(-10, H);
  b.s = rnd(6, 12);
  b.a = rnd(0.08, 0.24);
  b.life = rnd(2.5, 8);
  b.age = fresh ? rnd(0, b.life) : 0;
  b.m = Math.random();
  return b;
}
function newPart(st, i, fresh) {
  st.pz[i] = rnd(-58, 58);
  st.pt[i] = fresh ? rnd(-CY - 14, 135) : -rnd(CY + 18, CY + 32);
  st.pv[i] = rnd(0.8, 1.25);
  st.pn[i] = rnd(7, 18);
  st.pa[i] = Math.random() < 0.2 ? rnd(0.6, 0.9) : rnd(0.25, 0.5);
}
const newPath = () => ({ T: new Float32Array(300), Z: new Float32Array(300), X: new Float32Array(300), Y: new Float32Array(300), S: new Float32Array(300), n: 0, len: 0, o: 0 });

export function setup(params) {
  for (let i = 0; i < NX * NY; i++) LAT[i] = Math.random();
  const buf = () => new Float32Array(NPX), f3 = () => new Float32Array(LN * 3), v3 = () => [0, 0, 0];
  const st = {
    t: 0, k: [0, 2, 0, 0.06], init: false, hue: -9,
    gust: Array.from({ length: NG }, () => newGust({}, true)),
    cme: [], nextCme: rnd(12, 60),
    imf: Array.from({ length: NI }, () => newImf({}, -10)),
    F: 0.4, Fon: 0.7, tOn: -99, rel: 0, rel0: 1, aur: 0, flash: 0, Dx: 40, Lc: 4, lc: 0.45, lnPg: 0, bs: 0,
    blobs: Array.from({ length: 26 }, () => newBlob({}, 1)), pls: [], waves: Array.from({ length: NW }, () => newWave({}, -rnd(0, 20))), ph: [rnd(0, TAU), rnd(0, TAU), rnd(0, TAU), rnd(0, TAU)],
    tiltA: 0, flapK: 1, rot: 0, c: 1, s: 0, r0: 10, rb: 15, sw: 0, hw: 0, hwc: 9, hz: 1, sh: 1, ia: 1, sk: 1, bend: 0, ck: 0, fs: 1, wv: 1, wa: 1, dxw: 1, tw: 1,
    wd: { lean: wn(-0.3, 0.3, 8, 25), bend: wn(-9, 9, 10, 30), p: wn(-1.4, 1.4, 10, 30), dx: wn(0.65, 1.45, 12, 35), tw: wn(0.8, 1.3, 15, 40), ck: wn(-1, 1, 10, 30), fk: wn(0.3, 2.2, 8, 25), fs: wn(0.65, 1.3, 12, 35), wv: wn(0.65, 1.5, 10, 30), wa: wn(0.5, 1.5, 8, 25), gate: Array.from({ length: NL }, () => wn(0.1, 1, 6, 18)), hz: wn(0.7, 2.2, 8, 24), sh: wn(0.4, 2, 8, 24), ia: wn(0.5, 2, 10, 30), sk: wn(0, 3, 8, 25), hw: wn(-0.07, 0.07, 10, 30) },
    ropes: Array.from({ length: NR }, () => newRope({})),
    pul: Array.from({ length: NPUL }, () => newPulse({}, 1)),
    pt: new Float32Array(NP), pz: new Float32Array(NP), pv: new Float32Array(NP), pn: new Float32Array(NP), pa: new Float32Array(NP),
    paths: Array.from({ length: NL * 4 }, newPath), mpN: newPath(), mpS: newPath(), bsN: newPath(), bsS: newPath(),
    pal: { w: f3(), s: f3(), i: f3(), p: f3(), cl: v3(), o1: v3(), o2: v3(), mp: v3(), bs: v3(), pl: v3(), wn: v3(), sn: v3() },
    r: buf(), g: buf(), b: buf(), lr: buf(), lg: buf(), lb: buf(), tr: buf(), hr: buf(), hg: buf(), hb: buf(),
    FT: new Float32Array(NT), FB: new Float32Array(NT), PT: new Float32Array(NT), geo: null,
  };
  for (let i = 0; i < NP; i++) newPart(st, i, true);
  st.geo = geom(st);
  params.st = st;
}

// ---- geometry --------------------------------------------------------------
// The magnetopause is the dividing flow line of a Rankine half-body (a uniform wind plus a source), its
// lateral axis stretched down the tail so that it flares. The sheath flow is the half-body's and carries
// the draped lines. The bow shock is a second half-body.
const FL = (T) => 1 + 0.013 * (0.5 * (T + sqrt(T * T + 144)) - 6);
const FLB = (T) => 1 + 0.7 * (FL(T) - 1);
const DFL = (T) => 0.0065 * (1 + T / sqrt(T * T + 144));
function geom(st) {
  const r0 = st.r0, zi = 1.25 * r0 * st.tw, d = zi / PI, rb = st.rb, db = (zi + 5 + 0.2 * r0) / PI;
  return { r0, zi, d, xs: d - r0, rb, db, xsb: db - rb };
}
// Signed distance from the body, positive outside, a little off where the wind is slow.
function sdOf(T, Z, d, xs, fb) {
  const f = fb ? FLB(T) : FL(T), y = Z / f, x = T - xs, r2 = x * x + y * y + 1e-3, th = atan2(y, x), sg = y >= 0 ? 1 : -1;
  return (sg * f * (y + d * (th - PI * sg))) / cl(sqrt(1 + (2 * d * x + d * d) / r2), 0.5, 1.4);
}
let DT = 0, DZ = 0;
function dirAt(T, Z, d, xs) {
  const f = FL(T), y = Z / f, x = T - xs, r2 = x * x + y * y + 1e-3, ux = 1 + (d * x) / r2, vz = f * ((d * y) / r2) + y * DFL(T) * ux, n = sqrt(ux * ux + vz * vz) + 1e-6;
  DT = ux / n;
  DZ = vz / n;
}
function flap(st, T) {
  if (T <= 0) return st.ck * 4.5 * sstep(-2, -12, T);
  let f = (st.bend * T * T) / 3600;
  for (const w of st.waves) {
    const e = (st.t - w.t0) / w.dur;
    if (e > 0 && e < 1) f += w.A * sin(PI * e) ** 2 * sin(w.k * T - w.om * st.t + w.ph);
  }
  return (f - (st.bend * T * T) / 3600) * sstep(0, 45, T) * st.flapK + (st.bend * T * T) / 3600;
}
// From the picture's own frame (T down the tail, Z toward the north pole) to the panel: flap, then the lean.
let XX = 0, YY = 0;
function scr(st, T, Z) {
  const z = Z + flap(st, T);
  XX = CX + z * st.c - T * st.s;
  YY = CY + z * st.s + T * st.c;
}
// the dipole is tilted about the planet, by less and less with distance
function scrd(st, T, Z) {
  const b = st.tiltA * exp(-(T * T + Z * Z) / 72), c = cos(b), s = sin(b);
  scr(st, T * c + Z * s, Z * c - T * s);
}
function wob(st, k, T) {
  return sstep(8, 50, T) * st.flapK * (1.1 * sin(0.11 * T - 1.3 * st.t + k * 2.1) + 0.7 * sin(0.07 * T + 0.8 * st.t + k * 4.3));
}
function finish(st, p, dip) {
  let s = 0;
  for (let i = 0; i < p.n; i++) {
    if (dip) scrd(st, p.T[i], p.Z[i]);
    else scr(st, p.T[i], p.Z[i]);
    p.X[i] = XX;
    p.Y[i] = YY;
    if (i) s += sqrt((XX - p.X[i - 1]) ** 2 + (YY - p.Y[i - 1]) ** 2);
    p.S[i] = s;
  }
  p.len = s;
}
function bodyPts(d, xs, p, mirror, fb) {
  let n = 0;
  for (let i = 0; i <= 90; i++) {
    const th = PI - (PI - 0.03) * pow(i / 90, 1.5), s = sin(th), rho = th > PI - 1e-3 ? d : (d * (PI - th)) / s, T = xs + rho * cos(th);
    p.T[n] = T;
    p.Z[n++] = mirror * rho * s * (fb ? FLB(T) : FL(T));
    if (T > 118) break;
  }
  p.n = n;
}

// Field lines. A label L is the dipole line r = L A sin^2 (colatitude), squeezed on the day side so that
// L = Lc just reaches the magnetopause. On the night side it runs on down the tail, closing in a round tip
// if closed, spreading to its place in the lobes if open. An open line leaves the magnetopause on the day
// side and goes on as a flow line of the sheath flow, found with RK4.
function buildPaths(st, G) {
  const Lc = st.Lc, g0 = (G.r0 - A) / ((Lc - 1) * A), zt = (T) => (1 - 0.3 * exp(-max(T, 0) / 30)) * FL(T);
  for (let k = 0; k < NL; k++) {
    const L = LAB[k], lf = asin(1 / sqrt(L)), o = sstep(0.93, 1.08, L / Lc), pD = st.paths[k * 4], pN = st.paths[k * 4 + 2];
    for (let q = 0; q < 4; q++) st.paths[k * 4 + q].o = o;
    let n = 0, exit = false;
    for (let i = 0; i <= 28; i++) {
      const lam = lf + ((PI / 2 - lf) * i) / 28, s = sin(lam), rr = A + (L * A * s * s - A) * (1 + (g0 - 1) * s * s * s), T = -rr * s, Z = rr * cos(lam);
      if (o > 0.5 && i > 0) {
        const sd = sdOf(T, Z, G.d, G.xs);
        if (sd >= 0) {
          const sd0 = sdOf(pD.T[n - 1], pD.Z[n - 1], G.d, G.xs), f = sd0 / (sd0 - sd), T0 = pD.T[n - 1], Z0 = pD.Z[n - 1];
          pD.T[n] = T0 + (T - T0) * f;
          pD.Z[n++] = Z0 + (Z - Z0) * f;
          exit = true;
          break;
        }
      }
      pD.T[n] = T;
      pD.Z[n++] = Z;
    }
    if (exit) {
      let T = pD.T[n - 1], Z = pD.Z[n - 1];
      dirAt(T, Z, G.d, G.xs);
      const eps = (0.1 + 0.25 * cl((k - 1) / 2, 0, 1)) * (G.rb - G.r0);
      T -= DZ * eps;
      Z += DT * eps;
      pD.T[n] = T;
      pD.Z[n++] = Z;
      for (let i = 0; i < 80 && T < 118 && n < 299; i++) {
        const h = 1.5;
        dirAt(T, Z, G.d, G.xs);
        const a1 = DT, b1 = DZ;
        dirAt(T + (a1 * h) / 2, Z + (b1 * h) / 2, G.d, G.xs);
        const a2 = DT, b2 = DZ;
        dirAt(T + (a2 * h) / 2, Z + (b2 * h) / 2, G.d, G.xs);
        const a3 = DT, b3 = DZ;
        dirAt(T + a3 * h, Z + b3 * h, G.d, G.xs);
        T += (h / 6) * (a1 + 2 * a2 + 2 * a3 + DT);
        Z += (h / 6) * (b1 + 2 * b2 + 2 * b3 + DZ);
        if (sdOf(T, Z, G.d, G.xs) < 0.3) break;
        pD.T[n] = T;
        pD.Z[n++] = Z;
      }
    }
    pD.n = n;
    n = 0;
    const l1 = max(lf, 0.9553);
    for (let i = 0; i <= 14; i++) {
      const lam = lf + ((l1 - lf) * i) / 14, s = sin(lam);
      pN.T[n] = L * A * s * s * s;
      pN.Z[n++] = L * A * s * s * cos(lam);
    }
    const Tm = pN.T[n - 1], zm = min(pN.Z[n - 1], 0.66 * G.zi * zt(Tm)) * (0.5 + 0.5 * o);
    const Dc = max(Tm + 5, st.Dx * pow(L / Lc, 1.6)), Dk = exp(log(Dc) * (1 - o) + log(400) * o), Tend = min(Dk, 116);
    for (let T = Tm + 1.6; n < 299; T += 1.6) {
      const x = (T - Tm) / (Dk - Tm);
      if (x >= 1) break;
      const zc = zm * (zt(T) / zt(Tm)), zo = G.zi * zt(T) * min(0.92, FRAC[k] * st.fs);
      pN.T[n] = T;
      pN.Z[n++] = (zc + (zo - zc) * o * sstep(Tm, Tm + 30, T)) * pow(1 - pow(x, 1.8), 0.7) + wob(st, k, T);
      if (T > Tend) break;
    }
    if (o < 0.5) {
      pN.T[n] = Dc;
      pN.Z[n++] = 0;
    }
    pN.n = n;
    for (const a of [0, 2]) {
      const pa = st.paths[k * 4 + a], pb = st.paths[k * 4 + a + 1];
      pb.n = pa.n;
      for (let i = 0; i < pa.n; i++) {
        pb.T[i] = pa.T[i];
        pb.Z[i] = -pa.Z[i];
      }
    }
    for (let q = 0; q < 4; q++) finish(st, st.paths[k * 4 + q], 1);
  }
  bodyPts(G.d, G.xs, st.mpN, 1);
  bodyPts(G.d, G.xs, st.mpS, -1);
  bodyPts(G.db, G.xsb, st.bsN, 1, 1);
  bodyPts(G.db, G.xsb, st.bsS, -1, 1);
  for (const p of [st.mpN, st.mpS, st.bsN, st.bsS]) finish(st, p, 0);
}
// points every 0.9 LED along a path
function walk(p, fn) {
  let j = 0;
  for (let s = 0; s <= p.len; s += 0.9) {
    while (j < p.n - 2 && p.S[j + 1] < s) j++;
    const f = cl((s - p.S[j]) / (p.S[j + 1] - p.S[j] + 1e-6), 0, 1);
    fn(p.X[j] + (p.X[j + 1] - p.X[j]) * f, p.Y[j] + (p.Y[j + 1] - p.Y[j]) * f, s);
  }
}

// ---- update ----------------------------------------------------------------
export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], cl(kv[1], 0, 2.5), cl(kv[2], -1, 1), cl(kv[3], 0, 1)];
  if (!st.init) {
    st.init = true;
    st.F = cl(0.32 + 0.3 * st.k[2], 0.1, 0.8);
    // run 45 s before the first frame, so the field has settled to the knobs
    for (let i = 0; i < 450; i++) step(st, 0.1);
  }
  step(st, cl(dt || 0, 0, 0.1));
}

function step(st, d) {
  st.t += d;
  const t = st.t, k = st.k, k4 = k[3], G = st.geo, sgK = 0.6 + 1.1 * k4, phin = G.d * (log(G.d) - 1);
  // Bands of dense and thin wind come down the panel and are put back above it; what reaches the nose is the pressure.
  let gs = 0;
  for (const g of st.gust) {
    g.c += V * g.f * d;
    if (g.c - 2.2 * g.w > 130) newGust(g, false);
    gs += g.a * rc((phin - g.c) / (2.2 * g.w)) * rc(g.pc / (1.9 * g.pl));
  }
  st.lnPg = cl(sgK * gs, -1.4, 2.2);
  const wd = st.wd;
  st.bend = wst(wd.bend, d);
  st.ck = wst(wd.ck, d);
  st.fs = wst(wd.fs, d);
  st.wv = wst(wd.wv, d);
  st.wa = wst(wd.wa, d);
  st.dxw = wst(wd.dx, d);
  st.tw = wst(wd.tw, d);
  for (const w of wd.gate) wst(w, d);
  st.sw += V * st.wv * d;
  for (const n of ['hz', 'sh', 'ia', 'sk', 'hw']) st[n] = wst(wd[n], d);
  if (t >= st.nextCme) {
    st.cme.push({ c: 4 - CY, s: rnd(0.85, 1.6), curv: rnd(-0.012, 0.012), L: rnd(260, 420), v: rnd(1.3, 1.8) });
    st.nextCme = t + 22 + (130 - 100 * k4) * -log(1 - Math.random());
  }
  let lnPc = 0;
  for (let i = st.cme.length - 1; i >= 0; i--) {
    const c = st.cme[i], dd = (c.c += V * c.v * d) - phin;
    if (dd > 0) lnPc += c.s * sstep(0, 5, dd) * exp(-dd / c.L);
    if (dd > 3 * c.L) st.cme.splice(i, 1);
  }
  // The interplanetary field: the knob, and independent turnings that come and go.
  let imf = 0;
  for (const m of st.imf) {
    if (t > m.te) newImf(m, t);
    if (t > m.ts) imf += m.a * sin((PI * (t - m.ts)) / (m.te - m.ts)) ** 2;
  }
  const bs = (st.bs = cl(0.1 + 0.85 * k[2] + (0.35 + 0.8 * k4) * imf * 0.6, -1, 1));
  // Open flux: the day side opens it while the field points south, the tail closes it, and a substorm is the tail letting go.
  let F = st.F + d * (0.034 * pow(max(0, bs), 1.2) - 0.05 * max(0, -bs) * (st.F - 0.08) - 0.006 * (st.F - 0.1));
  if (st.rel > 0) {
    const dr = min(st.rel, (st.rel0 * d) / 7);
    F -= dr;
    st.rel -= dr;
  }
  if (F > st.Fon && t > st.tOn + 9) {
    st.tOn = t;
    st.rel0 = st.rel = min(F - 0.14, rnd(0.28, 0.5));
    st.Fon = rnd(0.55, 0.82);
    st.flash = 1;
    st.aur = min(1.2, st.aur + 0.9);
    st.pls.push({ t0: t, T0: st.Dx, a: rnd(14, 26), v0: rnd(3, 8), amp: rnd(0.75, 1) });
  }
  st.F = cl(F, 0.06, 1);
  st.flash *= exp(-d / 0.9);
  st.aur *= exp(-d / 5);
  st.Dx = (38 + 36 * st.F) * st.dxw - 14 * exp(-(t - st.tOn) / 3.5);
  st.lc = ((21 + 14 * st.F) * PI) / 180;
  st.Lc = 1 / sin(st.lc) ** 2;
  // the boundary: pressure to the minus one sixth, eroded a little by open flux; the bow shock follows more slowly
  const r0t = cl(14 * exp(-(-1.35 + 1.05 * k[1] + st.lnPg + lnPc + wst(wd.p, d)) / 6) * (1 - 0.22 * st.F), 7.5, 17.5);
  st.r0 += (r0t - st.r0) * (1 - exp(-d / 0.45));
  st.rb += (1.38 * r0t + 2 - st.rb) * (1 - exp(-d / 0.9));
  st.geo = geom(st);
  st.flapK = wst(wd.fk, d) * (0.7 + 0.6 * k4);
  st.tiltA = 0.28 * sin(0.067 * t + st.ph[0]) + 0.16 * sin(0.0213 * t + st.ph[1]);
  st.rot = wst(wd.lean, d) * (0.75 + 0.5 * k4);
  st.c = cos(st.rot);
  st.s = sin(st.rot);
  for (const b of st.blobs) {
    b.y += 9 * d;
    if ((b.age += d) > b.life) newBlob(b);
  }
  for (const w of st.waves) if (t > w.t0 + w.dur) newWave(w, t);
  for (const r of st.ropes) {
    r.T += r.v * d;
    if ((r.life -= d) < 0 || r.T > 135 || r.T < 6) newRope(r);
  }
  for (const p of st.pul) {
    p.s += p.v * d;
    const len = st.paths[p.p].len;
    if (len > 0 && ((p.v > 0 && p.s > len + 8) || (p.v < 0 && p.s < -8))) newPulse(p);
  }
  for (let i = st.pls.length - 1; i >= 0; i--) {
    const p = st.pls[i], tau = t - p.t0;
    if (p.T0 + p.v0 * tau + 0.5 * p.a * tau * tau - 16 > 125) st.pls.splice(i, 1);
  }
  // wind particles follow the flow of the half-body
  const g = st.geo;
  for (let i = 0; i < NP; i++) {
    const T = st.pt[i], Z = st.pz[i], x = T - g.xs, y = Z / FL(T), sp = sqrt(1 + (2 * g.d * x + g.d * g.d) / (x * x + y * y + 1e-3)), v = V * st.wv * st.pv[i] * max(0.22, sp) * d;
    dirAt(T, Z, g.d, g.xs);
    st.pt[i] += DT * v;
    st.pz[i] += DZ * v;
    if (st.pt[i] > 140 || abs(st.pz[i]) > 62 || sdOf(T, Z, g.d, g.xs) < 0.2) newPart(st, i, false);
  }
}

// ---- draw ------------------------------------------------------------------
function background(st, G) {
  const { r, g, b, pal } = st, t = st.t, sgK = 0.6 + 1.1 * st.k[3], sw = st.sw, hs = 1.4 - 0.5 * st.F, sheetK = 0.2 + 0.4 * st.F, c = st.c, s = st.s;
  const act = st.gust.filter((q) => q.c + 2.2 * q.w > -25 && q.c - 2.2 * q.w < 130), cm = st.cme, d = G.d, xs = G.xs, db = G.db, xsb = G.xsb;
  const lw = pal.w, ls = pal.s, li = pal.i, lp = pal.p, fc = pal.pl;
  for (let i = 0; i < NT; i++) {
    const X = -90 + i * 0.5;
    st.FT[i] = FL(X);
    st.FB[i] = FLB(X);
    st.PT[i] = flap(st, X);
  }
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const dx = px + 0.5 - CX, dy = py + 0.5 - CY, X = dy * c - dx * s, ti = cl(floor((X + 90) * 2), 0, NT - 1), ff = st.FT[ti], fb = st.FB[ti], Y = (dx * c + dy * s - st.PT[ti]) / ff, o = py * W + px;
      const x = X - xs, r2 = x * x + Y * Y + 1e-3, th = atan2(Y, x), sg = Y >= 0 ? 1 : -1;
      const q = Y + d * (th - PI * sg), sdm = (sg * q * ff) / cl(sqrt(1 + (2 * d * x + d * d) / r2), 0.5, 1.4);
      const Yb = (Y * ff) / fb, xb = X - xsb, r2b = xb * xb + Yb * Yb + 1e-3;
      const sdb = (sg * (Yb + db * (atan2(Yb, xb) - PI * sg)) * fb) / cl(sqrt(1 + (2 * db * xb + db * db) / r2b), 0.5, 1.4);
      const phi = x + d * 0.5 * log(r2), wBS = 1 - sstep(-1.2, 1.8, sdb), wMP = sstep(-1.8, 1, sdm), wOut = 1 - wBS, wSh = wBS * wMP, wIn = 1 - wMP;
      let R = 0, Gc = 0, B = 0;
      if (wMP > 0.01) {
        let gs = 0;
        for (const a of act) {
          const u = (phi - a.c) / (2.2 * a.w);
          if (u * u < 1) gs += a.a * rc(u) * rc((q - a.pc) / (1.9 * a.pl));
        }
        const gain = cl(exp(0.55 * sgK * gs), 0.45, 2.6), n1 = 0.62 * tex(q / 10 + 3, (phi - 0.75 * sw) / 30) + 0.38 * tex(q / 4.6 + 7.3, (phi - 0.95 * sw) / 12 + 3.1);
        let iw = (0.1 + 0.2 * n1 * n1) * gain * st.hz, fr = 0;
        for (const e of cm) {
          const dd = phi - (e.c + e.curv * q * q);
          if (dd < 0) iw += 0.2 * e.s * sstep(0, 5, -dd) * exp(dd / e.L);
          else if (dd < 14) fr += exp(-0.5 * (dd / 1.5) * (dd / 1.5)) * e.s;
        }
        if (wOut > 0.01) {
          const i0 = floor(cl(iw, 0, 1) * (LN - 1) * 0.999) * 3, sun = 0.07 * exp(-(py + 0.5) / 9) * (0.6 + 0.4 * min(gain, 1.8)) * st.sk * 255 * wOut;
          R += wOut * lw[i0] + fc[0] * sun;
          Gc += wOut * lw[i0 + 1] + fc[1] * sun;
          B += wOut * lw[i0 + 2] + fc[2] * sun;
        }
        if (wSh > 0.01) {
          const n3 = tex(q / 3.2 + 3.7, (phi - 0.5 * sw) / 8 + 9), is = ((0.01 + 0.2 * n3 * n3 * n3) * (0.7 + 0.3 * gain) + 0.06 * iw + 0.08 * (1 - sstep(0, 5, sdb + 5)) * sstep(-4, -1, sdm)) * st.sh;
          const i0 = floor(cl(is, 0, 1) * (LN - 1) * 0.999) * 3;
          R += wSh * ls[i0];
          Gc += wSh * ls[i0 + 1];
          B += wSh * ls[i0 + 2];
        }
        if (fr > 0.01) {
          const k = wMP * min(1, fr) * 0.5 * 255;
          R += fc[0] * k;
          Gc += fc[1] * k;
          B += fc[2] * k;
        }
      }
      if (wIn > 0.01) {
        const ii = 0.1 + 0.05 * exp(-sqrt(X * X + Y * Y * ff * ff) / 10) + 0.05 * tex(Y * ff / 8 + 4, X / 14 - 0.12 * t), Yf = Y * ff;
        const ip = ((exp(-0.5 * (Yf / hs) * (Yf / hs)) * (0.35 + 1.1 * tex(X / 9 + 5 - 1.3 * t, 0.7)) + 0.22 * exp(-0.5 * (Yf / 5) * (Yf / 5))) * sstep(0.5, 9, X) * sheetK) / (1 + X / 70);
        const i0 = floor(cl(ii * st.ia, 0, 1) * (LN - 1) * 0.999) * 3, j0 = floor(cl(ip * st.ia, 0, 1) * (LN - 1) * 0.999) * 3;
        R += wIn * (li[i0] + lp[j0]);
        Gc += wIn * (li[i0 + 1] + lp[j0 + 1]);
        B += wIn * (li[i0 + 2] + lp[j0 + 2]);
      }
      r[o] = R;
      g[o] = Gc;
      b[o] = B;
    }
}

function drawStreaks(st, G) {
  const { pt, pz, pn, pa, pal } = st, wc = pal.wn, sc = pal.sn, d = G.d, xs = G.xs, sgK = 0.6 + 1.1 * st.k[3];
  for (let i = 0; i < NP; i++) {
    let T = pt[i], Z = pz[i];
    const sh = 1 - sstep(-1.5, 1.5, sdOf(T, Z, G.db, G.xsb, 1)), x = T - xs, y = Z / FL(T), q = y + d * (atan2(y, x) - PI * (y >= 0 ? 1 : -1)), phi = x + d * 0.5 * log(x * x + y * y + 1e-3);
    let gs = 0;
    for (const a of st.gust) {
      const u = (phi - a.c) / (2.2 * a.w);
      if (u * u < 1) gs += a.a * rc(u) * rc((q - a.pc) / (1.9 * a.pl));
    }
    const k = pa[i] * (1 + 0.9 * sh) * cl(exp(0.55 * sgK * gs), 0.5, 2.2) * st.wa * 255 * 0.42, n = floor(pn[i] / 0.9);
    for (let j = 0; j < n; j++) {
      const f = pow(1 - j / n, 1.4) * k;
      scr(st, T, Z);
      stamp(st.r, st.g, st.b, XX, YY, (wc[0] * (1 - sh) + sc[0] * sh) * f, (wc[1] * (1 - sh) + sc[1] * sh) * f, (wc[2] * (1 - sh) + sc[2] * sh) * f, 0);
      dirAt(T, Z, d, xs);
      Z -= DZ * 0.9;
      T -= DT * 0.9;
    }
  }
}

// loose clouds of denser wind, each its own place, size and life, that come and go
function drawBlobs(st) {
  const wn = st.pal.wn, pl = st.pal.pl;
  for (const b of st.blobs) {
    const R = 2.2 * b.s, k = b.a * sin((PI * b.age) / b.life) ** 2 * 255, x0 = max(0, floor(b.x - R)), x1 = min(W - 1, floor(b.x + R)), y0 = max(0, floor(b.y - R)), y1 = min(H - 1, floor(b.y + R));
    for (let py = y0; py <= y1; py++)
      for (let px = x0; px <= x1; px++) {
        const dx = px + 0.5 - b.x, dy = py + 0.5 - b.y, u = (dx * dx + dy * dy) / (R * R);
        if (u >= 1) continue;
        const w = (1 - u) * (1 - u) * k, o = py * W + px;
        st.r[o] += (wn[0] * (1 - b.m) + pl[0] * b.m) * w;
        st.g[o] += (wn[1] * (1 - b.m) + pl[1] * b.m) * w;
        st.b[o] += (wn[2] * (1 - b.m) + pl[2] * b.m) * w;
      }
  }
}
function drawCurve(st, p, col, k, nose) {
  const t = st.t;
  walk(p, (x, y, s) => {
    const f = 255 * max(0, k * (1 + 0.5 * (0.5 * sin(0.4 * s - 3.1 * t + nose) + 0.3 * sin(0.23 * s - 1.7 * t + 2 * nose)) * sstep(6, 40, s)) * (1 - 0.5 * sstep(30, 110, s)));
    stamp(st.lr, st.lg, st.lb, x, y, col[0] * f, col[1] * f, col[2] * f, 1);
  });
}

function drawLines(st) {
  const { pal, t } = st, by = Array.from({ length: NL * 4 }, () => []), c = [0, 0, 0];
  for (const u of st.pul) by[u.p].push(u);
  for (let k = 0; k < NL; k++) {
    const o = st.paths[k * 4].o, bc = 0.9 * (0.55 + 0.45 * pow(1.45 / LAB[k], 0.5));
    for (let q = 0; q < 4; q++) {
      const pid = k * 4 + q, p = st.paths[pid], base = ((1 - o) * bc + o * 0.62) * 0.62, fl = 0.85 + 0.15 * sin(t * (0.7 + 0.13 * pid) + pid * 1.9);
      walk(p, (x, y, s) => {
        let b = base * fl;
        for (const u of by[pid]) {
          const z = (s - u.s) / u.sg;
          if (z * z < 9) b += 0.5 * u.a * exp(-0.5 * z * z);
        }
        const nz = tex(s / 13 + pid * 3.7, t * 0.12 + pid), wid = 1 + 0.5 * tex(s / 17 + 9 + pid * 2.3, t * 0.1);
        b *= (1 - o * 0.6) + o * min(1.25, 0.25 + 1.5 * nz * nz);
        b *= 0.25 + 0.75 * st.wd.gate[k].v;
        b *= (1 - 0.7 * sstep(30, 150, s) * o) * sstep(0, q > 1 ? (o < 0.5 ? 1 : 31) : 5, s) * (q > 1 && o < 0.5 ? 0.2 + 0.4 * (1 - sstep(8, 22, s)) : 1);
        const m = sstep(14, 70, s);
        for (let i = 0; i < 3; i++) c[i] = 255 * b * ((1 - o) * pal.cl[i] + o * (pal.o1[i] * (1 - m) + pal.o2[i] * m));
        stamp(st.lr, st.lg, st.lb, x, y, c[0], c[1], c[2], 1, o > 0.5 ? wid : 1);
      });
    }
  }
}

function drawEvents(st) {
  const t = st.t, pl = st.pal.pl, c = [0, 0, 0], o1 = st.pal.o1, o2 = st.pal.o2;
  if (st.flash > 0.02) {
    scr(st, st.Dx, 0);
    glow(st, XX, YY, 2 + 5 * (1 - st.flash), pl, st.flash * 0.55);
  }
  for (const p of st.pls) {
    const tau = t - p.t0, T = p.T0 + p.v0 * tau + 0.5 * p.a * tau * tau, ell = min(16, 4 + 6 * tau), wz = min(7, 2.6 + 1.6 * tau), amp = p.amp * sstep(0, 0.4, tau) * (1 - sstep(100, 130, T));
    if (amp < 0.02) continue;
    scr(st, T, 0);
    glow(st, XX, YY, 2.2, pl, amp * 0.4);
    for (const sc of [1, 0.66, 0.36])
      for (let i = 0; i < 28; i++) {
        const a = (TAU * i) / 28, f = 255 * amp * (0.9 - 0.3 * sc);
        scr(st, T + ell * sc * cos(a) * (1 + 0.2 * cos(a)), wz * sc * sin(a));
        for (let j = 0; j < 3; j++) c[j] = (j === 2 ? o2[j] : o1[j] * sc + o2[j] * (1 - sc)) * f;
        stamp(st.lr, st.lg, st.lb, XX, YY, c[0], c[1], c[2], 1);
      }
    for (let w = p.T0; w < T - ell; w += 1.4) {
      scr(st, w, 0);
      const f = 255 * 0.6 * amp * (0.35 + 0.65 * sstep(p.T0, T - ell, w));
      stamp(st.lr, st.lg, st.lb, XX, YY, pl[0] * f, pl[1] * f, pl[2] * f, 1);
    }
  }
  for (const r of st.ropes) {
    scr(st, r.T, 0);
    glow(st, XX, YY, r.w, pl, 0.5 * r.a * sin((PI * cl(r.life, 0, 6)) / 6) * (0.4 + 0.5 * st.F));
  }
  const lc = st.lc, au = 0.2 + 0.2 * st.F + 0.5 * min(1, st.aur), sl = A * sin(lc), cs = A * cos(lc);
  for (const [T, Z] of [[-sl, cs], [sl, cs], [-sl, -cs], [sl, -cs]]) {
    scrd(st, T * 1.15, Z * 1.15);
    glow(st, XX, YY, 1, o1, au * 0.6);
  }
}

// five-tap box blur, twice in each direction
function blur(src, dst, tmp) {
  for (let pass = 0; pass < 2; pass++) {
    const a = pass ? dst : src;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) s += a[y * W + cl(x + k, 0, W - 1)];
        tmp[y * W + x] = s * 0.2;
      }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) s += tmp[cl(y + k, 0, H - 1) * W + x];
        dst[y * W + x] = s * 0.2;
      }
  }
}
const tm = (v) => {
  v /= 255;
  return 255 * (v < 0.72 ? v : 0.72 + 0.28 * (1 - exp(-(v - 0.72) / 0.28)));
};

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const G = st.geo, pal = st.pal;
  if (abs(st.k[0] - st.hue) > 1e-4 || abs(st.hw - st.hwc) > 0.004) {
    st.hue = st.k[0];
    st.hwc = st.hw;
    buildPal(st, st.hue, st.hw);
  }
  buildPaths(st, G);
  st.lr.fill(0);
  st.lg.fill(0);
  st.lb.fill(0);
  background(st, G);
  drawStreaks(st, G);
  drawBlobs(st);
  drawCurve(st, st.bsN, pal.bs, 0.5, 1.3);
  drawCurve(st, st.bsS, pal.bs, 0.5, 4.1);
  drawCurve(st, st.mpN, pal.mp, 0.45, 0);
  drawCurve(st, st.mpS, pal.mp, 0.45, 2.2);
  drawLines(st);
  drawEvents(st);
  blur(st.lr, st.hr, st.tr);
  blur(st.lg, st.hg, st.tr);
  blur(st.lb, st.hb, st.tr);
  const { r, g, b, lr, lg, lb, hr, hg, hb } = st;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x, lum = 0.3 * hr[o] + 0.59 * hg[o] + 0.11 * hb[o];
      let R = r[o] + lr[o] + 0.12 * hr[o] + 0.1 * lum, Gc = g[o] + lg[o] + 0.12 * hg[o] + 0.1 * lum, B = b[o] + lb[o] + 0.12 * hb[o] + 0.12 * lum;
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, dd = sqrt(dx * dx + dy * dy);
      if (dd < A + 2.5) {
        // a small lit planet: the Sun is up the frame's own axis, so the day side is the side toward -T
        const lit = (dx * st.s - dy * st.c) / dd, disc = 1 - sstep(A - 0.6, A + 0.3, dd), day = sstep(-0.5, 0.8, lit), rim = exp(-0.5 * ((dd - A - 0.5) / 0.6) ** 2) * (0.25 + 0.6 * day);
        const pr = 18 + 150 * day * (1 - 0.35 * sstep(0.2, 1, dd / A)), pg = 28 + 170 * day * (1 - 0.35 * sstep(0.2, 1, dd / A)), pb = 70 + 170 * day;
        R = R * (1 - disc) + pr * disc + 140 * rim * (1 - disc);
        Gc = Gc * (1 - disc) + pg * disc + 190 * rim * (1 - disc);
        B = B * (1 - disc) + pb * disc + 255 * rim * (1 - disc);
      }
      display.setPixel(x, y, floor(cl(tm(R), 0, 255)), floor(cl(tm(Gc), 0, 255)), floor(cl(tm(B), 0, 255)));
    }
}
